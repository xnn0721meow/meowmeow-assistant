export type FocusState = 'unknown' | 'focused' | 'distracted' | 'away' | 'paused'

export type DistractionReason = 'blocked-app' | 'idle' | 'unknown'

export type ReminderAction = 'returned' | 'snooze' | 'end-session' | 'dismiss'

export interface ActivitySignal {
  appName: string | null
  windowTitle: string | null
  idleSeconds: number
  available: boolean
  timestamp: number
}

export interface SignalSnapshot {
  timestamp: number
  activity: ActivitySignal
}

export interface FocusEvidence {
  appName?: string | null
  windowTitle?: string | null
  idleSeconds?: number
}

export interface Reminder {
  reason: DistractionReason
  title: string
  body: string
  evidence: FocusEvidence
}

export interface FocusEvent {
  type: 'state-changed' | 'reminder' | 'returned' | 'session-started' | 'session-reset'
  timestamp: number
  state: FocusState
  previousState?: FocusState
  reason?: DistractionReason
  evidence?: FocusEvidence
  focusedMs: number
  message?: string
  reminder?: Reminder
}

export interface FocusSnapshot {
  state: FocusState
  previousState: FocusState
  paused: boolean
  focusedMs: number
  sessionStartedAt: number
  lastReminderAt: number | null
  remindersThisHour: number
  snoozedUntil: number | null
  activityAvailable: boolean
  currentApp: string | null
  currentTitle: string | null
}

export interface AppSettings {
  activityTrackingEnabled: boolean
  reminderSensitivity: 'relaxed' | 'normal' | 'strict'
  maxRemindersPerHour: number
  blockedApps: string[]
  pomodoroFocusMinutes: number
  pomodoroBreakMinutes: number
  pomodoroLongBreakMinutes: number
  pomodoroLongBreakEvery: number
  live2dModelPath: string | null
  avatarScale: number
  avatarPosition: { x: number; y: number } | null
}
