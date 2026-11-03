import type {
  AppSettings,
  DistractionReason,
  FocusEvent,
  FocusEvidence,
  FocusState,
  SignalSnapshot
} from './types'
import { classifyApp } from './classify'
import { buildAwayMessage, buildReturnedMessage, buildStartMessage } from './messages'
import { thresholdFor, thresholdsFor, type FocusThresholds } from './thresholds'

/**
 * Pure, timestamp-driven focus state machine.
 *
 * It deliberately has no DOM, no Electron and no timers. Callers feed it
 * snapshots; it returns events. That makes the "did I get distracted?" logic
 * testable with synthetic sequences instead of a real camera.
 */
export class FocusStateMachine {
  private state: FocusState = 'unknown'
  private previousState: FocusState = 'unknown'
  private paused = false
  private focusedMs = 0
  private sessionStartedAt: number
  private lastUpdateAt: number

  private badSince: number | null = null
  private badReason: DistractionReason | null = null
  private goodSince: number | null = null
  private noFaceSince: number | null = null

  private thresholds: FocusThresholds
  private allowedApps: string[]
  private blockedApps: string[]
  private activityEnabled: boolean

  constructor(settings: AppSettings, now = Date.now()) {
    this.sessionStartedAt = now
    this.lastUpdateAt = now
    this.thresholds = thresholdsFor(settings)
    this.allowedApps = settings.allowedApps
    this.blockedApps = settings.blockedApps
    this.activityEnabled = settings.activityTrackingEnabled
  }

  applySettings(settings: AppSettings): void {
    this.thresholds = thresholdsFor(settings)
    this.allowedApps = settings.allowedApps
    this.blockedApps = settings.blockedApps
    this.activityEnabled = settings.activityTrackingEnabled
  }

  getState(): FocusState {
    return this.state
  }

  getPreviousState(): FocusState {
    return this.previousState
  }

  getFocusedMs(): number {
    return this.focusedMs
  }

  isPaused(): boolean {
    return this.paused
  }

  getSessionStartedAt(): number {
    return this.sessionStartedAt
  }

  reset(now = Date.now()): FocusEvent[] {
    this.state = 'unknown'
    this.previousState = 'unknown'
    this.paused = false
    this.focusedMs = 0
    this.sessionStartedAt = now
    this.lastUpdateAt = now
    this.clearCandidates()
    return [
      {
        type: 'session-reset',
        timestamp: now,
        state: 'unknown',
        previousState: 'unknown',
        focusedMs: 0,
        message: buildStartMessage()
      }
    ]
  }

  setPaused(paused: boolean, now = Date.now()): FocusEvent[] {
    if (paused === this.paused) return []

    this.lastUpdateAt = now
    if (paused) {
      this.previousState = this.state
      this.state = 'paused'
    } else {
      this.previousState = 'paused'
      this.state = 'unknown'
    }
    this.paused = paused
    this.clearCandidates()

    return [this.event('state-changed', now, this.state)]
  }

  update(snapshot: SignalSnapshot): FocusEvent[] {
    const now = snapshot.timestamp
    const delta = Math.max(0, now - this.lastUpdateAt)

    if (!this.paused && this.state === 'focused') {
      this.focusedMs += delta
    }
    this.lastUpdateAt = now

    if (this.paused) return []

    const events: FocusEvent[] = []
    const vision = snapshot.vision
    const activity = snapshot.activity
    const facePresent = vision ? vision.facePresent : null
    const lookingAtScreen = vision ? vision.lookingAtScreen : null
    const classification = classifyApp(
      activity.appName,
      activity.windowTitle,
      this.allowedApps,
      this.blockedApps
    )
    const activityUsable = this.activityEnabled && activity.available

    if (facePresent === false) {
      this.noFaceSince ??= now
    } else {
      this.noFaceSince = null
    }

    // Returning after an absence is acknowledged immediately; the mascot
    // should look happy before it starts judging anything again.
    if (this.state === 'away' && facePresent === true) {
      this.previousState = 'away'
      this.state = 'unknown'
      this.clearCandidates()
      events.push(
        this.event('returned', now, 'unknown', {
          message: buildReturnedMessage(this.focusedMs)
        })
      )
    }

    let candidate: DistractionReason | null = null

    if (facePresent === true) {
      if (classification === 'blocked') {
        candidate = 'blocked-app'
      } else if (lookingAtScreen === false) {
        candidate = 'gaze-away'
      } else if (!vision!.eyesOpen && activity.idleSeconds >= this.thresholds.idleAwaySeconds) {
        candidate = 'idle'
      }
    } else if (facePresent === false) {
      // Mark "no face" immediately; the away transition still waits for the
      // full away threshold. This keeps the timer anchored to when the face
      // actually disappeared, not when the threshold was first evaluated.
      candidate = 'no-face'
    } else if (activityUsable) {
      if (classification === 'blocked' && activity.idleSeconds < this.thresholds.idleAwaySeconds) {
        candidate = 'blocked-app'
      } else if (activity.idleSeconds >= this.thresholds.idleAwaySeconds) {
        candidate = 'idle'
      }
    }

    const good = this.isGoodSignal(facePresent, lookingAtScreen, classification, activityUsable, activity.idleSeconds)

    if (candidate !== null) {
      this.goodSince = null
      if (this.badReason !== candidate || this.badSince === null) {
        this.badSince = now
        this.badReason = candidate
      }

      const elapsed = now - this.badSince
      const threshold = thresholdFor(candidate, this.thresholds)

      if (elapsed >= threshold && this.state !== 'distracted' && this.state !== 'away') {
        const evidence: FocusEvidence = {
          appName: activity.appName,
          windowTitle: activity.windowTitle,
          idleSeconds: activity.idleSeconds,
          gazeAwayMs: candidate === 'gaze-away' ? elapsed : undefined
        }

        let nextState: FocusState = 'distracted'
        let eventType: FocusEvent['type'] = 'state-changed'
        let message: string | undefined

        if (candidate === 'no-face') {
          nextState = 'away'
          message = buildAwayMessage()
        }

        this.previousState = this.state
        this.state = nextState
        events.push(
          this.event(eventType, now, nextState, {
            reason: candidate,
            evidence,
            message
          })
        )
      }
    } else {
      this.badSince = null
      this.badReason = null

      if (good) {
        this.goodSince ??= now
        if (
          now - this.goodSince >= this.thresholds.focusedAfterMs &&
          this.state !== 'focused' &&
          this.state !== 'paused'
        ) {
          const wasDistracted = this.state === 'distracted'
          this.previousState = this.state
          this.state = 'focused'

          if (wasDistracted) {
            events.push(
              this.event('returned', now, 'focused', {
                message: buildReturnedMessage(this.focusedMs)
              })
            )
          }

          events.push(this.event('state-changed', now, 'focused'))
        }
      } else {
        this.goodSince = null
      }
    }

    return events
  }

  private isGoodSignal(
    facePresent: boolean | null,
    lookingAtScreen: boolean | null,
    classification: ReturnType<typeof classifyApp>,
    activityUsable: boolean,
    idleSeconds: number
  ): boolean {
    if (classification === 'blocked') return false

    if (facePresent === true) {
      return lookingAtScreen === true
    }

    if (facePresent === null && activityUsable) {
      // Camera unavailable: fall back to "a non-blocked window with recent
      // input". This is less precise, and the UI says so.
      return idleSeconds < 120
    }

    return false
  }

  private clearCandidates(): void {
    this.badSince = null
    this.badReason = null
    this.goodSince = null
    this.noFaceSince = null
  }

  private event(
    type: FocusEvent['type'],
    timestamp: number,
    state: FocusState,
    extra: Partial<FocusEvent> = {}
  ): FocusEvent {
    return {
      type,
      timestamp,
      state,
      previousState: this.previousState,
      focusedMs: this.focusedMs,
      ...extra
    }
  }
}
