import { EventEmitter } from 'node:events'
import { powerMonitor } from 'electron'
import { FocusStateMachine } from '@shared/focus/stateMachine'
import { ReminderBudget } from '@shared/focus/reminderBudget'
import { activityEvidence, buildReminder, buildStartMessage } from '@shared/focus/messages'
import type {
  ActivitySignal,
  AppSettings,
  FocusEvent,
  FocusSnapshot,
  ReminderAction,
  SignalSnapshot,
  VisionSignal,
  VisionStatus
} from '@shared/focus/types'
import type { ActivitySample } from './activityProbe'

const VISION_STALE_MS = 6_000
const SNOOZE_MS = 5 * 60_000

export class FocusEngine extends EventEmitter {
  private machine: FocusStateMachine
  private budget: ReminderBudget
  private settings: AppSettings
  private timer: NodeJS.Timeout | null = null

  private latestVision: VisionSignal | null = null
  private lastVisionAt = 0
  private activity: ActivitySignal = {
    appName: null,
    windowTitle: null,
    idleSeconds: 0,
    available: false,
    timestamp: 0
  }
  private activityAvailable = false

  private visionStatus: VisionStatus = 'idle'
  private visionMessage: string | undefined
  private lastReminderAt: number | null = null
  private snoozedUntil: number | null = null

  constructor(settings: AppSettings) {
    super()
    this.settings = settings
    this.machine = new FocusStateMachine(settings)
    this.budget = new ReminderBudget(settings.maxRemindersPerHour)
  }

  start(): void {
    if (this.timer) return
    this.emit('event', {
      type: 'session-started',
      timestamp: Date.now(),
      state: this.machine.getState(),
      focusedMs: 0,
      message: buildStartMessage()
    } satisfies FocusEvent)
    this.emitSnapshot()
    this.timer = setInterval(() => this.tick(), 1_000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  ingestVision(signal: VisionSignal): void {
    if (!this.settings.cameraEnabled) return
    this.latestVision = signal
    this.lastVisionAt = signal.timestamp
    if (this.visionStatus !== 'active') {
      this.visionStatus = 'active'
      this.visionMessage = undefined
      this.emit('vision-status', { status: this.visionStatus })
    }
  }

  reportVisionStatus(status: VisionStatus, message?: string): void {
    this.visionStatus = status
    this.visionMessage = message
    if (status !== 'active') {
      this.latestVision = null
      this.lastVisionAt = 0
    }
    this.emit('vision-status', { status, message })
    this.emitSnapshot()
  }

  ingestActivity(sample: ActivitySample): void {
    this.activity = {
      appName: sample.appName,
      windowTitle: sample.windowTitle,
      idleSeconds: this.activity.idleSeconds,
      available: this.activityAvailable && this.settings.activityTrackingEnabled,
      timestamp: sample.timestamp
    }
  }

  setActivityAvailable(available: boolean): void {
    this.activityAvailable = available
    this.activity.available = available && this.settings.activityTrackingEnabled
    this.emitSnapshot()
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    this.machine.applySettings(settings)
    this.budget.setMaxPerHour(settings.maxRemindersPerHour)

    if (!settings.cameraEnabled) {
      this.latestVision = null
      this.lastVisionAt = 0
      this.visionStatus = 'idle'
      this.visionMessage = '摄像头已关闭'
    }

    if (!settings.activityTrackingEnabled) {
      this.activityAvailable = false
      this.activity.available = false
    }

    this.emitSnapshot()
  }

  setPaused(paused: boolean): void {
    const events = this.machine.setPaused(paused)
    for (const event of events) this.emit('event', event)
    this.emitSnapshot()
  }

  resetSession(): void {
    this.budget.reset()
    this.lastReminderAt = null
    this.snoozedUntil = null
    for (const event of this.machine.reset()) this.emit('event', event)
    this.emitSnapshot()
  }

  acknowledgeReminder(action: ReminderAction): void {
    const now = Date.now()

    switch (action) {
      case 'returned':
      case 'snooze':
        this.snoozedUntil = now + SNOOZE_MS
        break
      case 'end-session':
        this.setPaused(true)
        break
      case 'dismiss':
      default:
        break
    }

    this.emitSnapshot()
  }

  getSnapshot(): FocusSnapshot {
    const now = Date.now()
    if (this.snoozedUntil !== null && this.snoozedUntil <= now) {
      this.snoozedUntil = null
    }

    const visionFresh =
      this.settings.cameraEnabled &&
      this.latestVision !== null &&
      now - this.lastVisionAt < VISION_STALE_MS

    return {
      state: this.machine.getState(),
      previousState: this.machine.getPreviousState(),
      paused: this.machine.isPaused(),
      focusedMs: this.machine.getFocusedMs(),
      sessionStartedAt: this.machine.getSessionStartedAt(),
      lastReminderAt: this.lastReminderAt,
      remindersThisHour: this.budget.count(now),
      snoozedUntil: this.snoozedUntil,
      visionAvailable: visionFresh && this.visionStatus === 'active',
      visionStatus: this.settings.cameraEnabled ? this.visionStatus : 'idle',
      visionMessage: this.settings.cameraEnabled
        ? this.visionMessage
        : '摄像头已关闭，仅使用窗口与空闲信号',
      activityAvailable: this.activityAvailable && this.settings.activityTrackingEnabled,
      currentApp: this.activity.appName,
      currentTitle: this.activity.windowTitle
    }
  }

  private tick(): void {
    const now = Date.now()
    const vision =
      this.settings.cameraEnabled && this.latestVision !== null && now - this.lastVisionAt < VISION_STALE_MS
        ? this.latestVision
        : null

    const activity: ActivitySignal = {
      ...this.activity,
      idleSeconds: powerMonitor.getSystemIdleTime(),
      available: this.activityAvailable && this.settings.activityTrackingEnabled,
      timestamp: now
    }
    this.activity = activity

    const snapshot: SignalSnapshot = { timestamp: now, vision, activity }
    const events = this.machine.update(snapshot)

    for (const event of events) {
      this.emit('event', event)

      if (
        event.type === 'state-changed' &&
        event.state === 'distracted' &&
        event.previousState === 'focused'
      ) {
        const snoozed = this.snoozedUntil !== null && this.snoozedUntil > now
        if (!snoozed && this.budget.consume(now)) {
          this.lastReminderAt = now
          const reminder = buildReminder(
            event.reason ?? 'unknown',
            event.evidence ?? activityEvidence(activity),
            activity.appName,
            activity.windowTitle
          )
          const reminderEvent: FocusEvent = {
            type: 'reminder',
            timestamp: now,
            state: event.state,
            previousState: event.previousState,
            reason: event.reason,
            evidence: event.evidence,
            focusedMs: event.focusedMs,
            message: `${reminder.title}：${reminder.body}`,
            reminder
          }
          this.emit('event', reminderEvent)
        }
      }
    }

    this.emitSnapshot()
  }

  private emitSnapshot(): void {
    this.emit('snapshot', this.getSnapshot())
  }
}
