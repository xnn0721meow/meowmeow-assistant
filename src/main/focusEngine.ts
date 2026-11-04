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
  SignalSnapshot
} from '@shared/focus/types'
import type { ActivitySample } from './activityProbe'

const SNOOZE_MS = 5 * 60_000

export class FocusEngine extends EventEmitter {
  private machine: FocusStateMachine
  private budget: ReminderBudget
  private settings: AppSettings
  private timer: NodeJS.Timeout | null = null

  private activity: ActivitySignal = {
    appName: null,
    windowTitle: null,
    idleSeconds: 0,
    available: false,
    timestamp: 0
  }
  private activityProbeAvailable = false

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

  ingestActivity(sample: ActivitySample): void {
    this.activity = {
      appName: sample.appName,
      windowTitle: sample.windowTitle,
      idleSeconds: this.activity.idleSeconds,
      available: this.activityProbeAvailable && this.settings.activityTrackingEnabled,
      timestamp: sample.timestamp
    }
  }

  setActivityAvailable(available: boolean): void {
    this.activityProbeAvailable = available
    this.activity.available = available && this.settings.activityTrackingEnabled
    this.emitSnapshot()
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    this.machine.applySettings(settings)
    this.budget.setMaxPerHour(settings.maxRemindersPerHour)
    this.activity.available = this.activityProbeAvailable && settings.activityTrackingEnabled
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

    return {
      state: this.machine.getState(),
      previousState: this.machine.getPreviousState(),
      paused: this.machine.isPaused(),
      focusedMs: this.machine.getFocusedMs(),
      sessionStartedAt: this.machine.getSessionStartedAt(),
      lastReminderAt: this.lastReminderAt,
      remindersThisHour: this.budget.count(now),
      snoozedUntil: this.snoozedUntil,
      activityAvailable: this.activityProbeAvailable && this.settings.activityTrackingEnabled,
      currentApp: this.activity.appName,
      currentTitle: this.activity.windowTitle
    }
  }

  private tick(): void {
    const now = Date.now()
    const activity: ActivitySignal = {
      ...this.activity,
      idleSeconds: powerMonitor.getSystemIdleTime(),
      available: this.activityProbeAvailable && this.settings.activityTrackingEnabled,
      timestamp: now
    }
    this.activity = activity

    const snapshot: SignalSnapshot = { timestamp: now, activity }
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
