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
import { thresholdsFor, type FocusThresholds } from './thresholds'

/**
 * Pure, timestamp-driven focus state machine.
 *
 * Inputs are intentionally cheap and local: the foreground app/title plus the
 * system idle time. No camera, no screenshots, no vision model.
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

  private thresholds: FocusThresholds
  private blockedApps: string[]
  private activityEnabled: boolean

  constructor(settings: AppSettings, now = Date.now()) {
    this.sessionStartedAt = now
    this.lastUpdateAt = now
    this.thresholds = thresholdsFor(settings)
    this.blockedApps = settings.blockedApps
    this.activityEnabled = settings.activityTrackingEnabled
  }

  applySettings(settings: AppSettings): void {
    this.thresholds = thresholdsFor(settings)
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
    const activity = snapshot.activity
    const activityUsable = this.activityEnabled && activity.available
    const evidence: FocusEvidence = {
      appName: activity.appName,
      windowTitle: activity.windowTitle,
      idleSeconds: activity.idleSeconds
    }

    if (!activityUsable) {
      this.clearCandidates()
      if (this.state === 'focused' || this.state === 'distracted') {
        this.previousState = this.state
        this.state = 'unknown'
        events.push(this.event('state-changed', now, 'unknown', { evidence }))
      }
      return events
    }

    const classification = classifyApp(
      activity.appName,
      activity.windowTitle,
      this.blockedApps
    )

    // A long period without keyboard/mouse input pauses the session. The user
    // may simply be reading, so we do not nag; we just stop counting.
    if (activity.idleSeconds >= this.thresholds.awayAfterSeconds) {
      this.clearCandidates()
      if (this.state !== 'away') {
        this.previousState = this.state
        this.state = 'away'
        events.push(
          this.event('state-changed', now, 'away', {
            reason: 'idle',
            evidence,
            message: buildAwayMessage()
          })
        )
      }
      return events
    }

    if (this.state === 'away') {
      this.previousState = 'away'
      this.state = 'unknown'
      this.clearCandidates()
      events.push(
        this.event('returned', now, 'unknown', {
          evidence,
          message: buildReturnedMessage(this.focusedMs)
        })
      )
    }

    if (classification === 'blocked') {
      this.goodSince = null
      this.badSince ??= now
      this.badReason = 'blocked-app'

      if (
        now - this.badSince >= this.thresholds.blockedAppAfterMs &&
        this.state !== 'distracted'
      ) {
        this.previousState = this.state
        this.state = 'distracted'
        events.push(
          this.event('state-changed', now, 'distracted', {
            reason: 'blocked-app',
            evidence
          })
        )
      }
      return events
    }

    // Anything that is not explicitly blocked counts as study time. The app
    // lists exist so users can correct the default without us guessing intent.
    this.badSince = null
    this.badReason = null
    this.goodSince ??= now

    if (now - this.goodSince >= this.thresholds.focusedAfterMs && this.state !== 'focused') {
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

      events.push(this.event('state-changed', now, 'focused', { evidence }))
    }

    return events
  }

  private clearCandidates(): void {
    this.badSince = null
    this.badReason = null
    this.goodSince = null
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
