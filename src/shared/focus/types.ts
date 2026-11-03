export type FocusState = 'unknown' | 'focused' | 'distracted' | 'away' | 'paused'

export type DistractionReason = 'blocked-app' | 'gaze-away' | 'idle' | 'no-face' | 'unknown'

export type ReminderAction = 'returned' | 'snooze' | 'end-session' | 'dismiss'

export type VisionStatus = 'idle' | 'starting' | 'active' | 'unavailable' | 'error'

export interface Reminder {
  reason: DistractionReason
  title: string
  body: string
  evidence: FocusEvidence
}

export interface VisionSignal {
  /** Whether a face is visible in the current frame. */
  facePresent: boolean
  /** Horizontal attention: face roughly facing the screen. */
  lookingAtScreen: boolean
  eyesOpen: boolean
  /** Head rotation in degrees, kept for future posture features. */
  yaw: number
  pitch: number
  confidence: number
  timestamp: number
}

export interface ActivitySignal {
  appName: string | null
  windowTitle: string | null
  idleSeconds: number
  available: boolean
  timestamp: number
}

export interface SignalSnapshot {
  timestamp: number
  vision: VisionSignal | null
  activity: ActivitySignal
}

export interface FocusEvidence {
  appName?: string | null
  windowTitle?: string | null
  gazeAwayMs?: number
  idleSeconds?: number
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
  visionAvailable: boolean
  visionStatus: VisionStatus
  visionMessage?: string
  activityAvailable: boolean
  currentApp: string | null
  currentTitle: string | null
}

export interface AppSettings {
  cameraEnabled: boolean
  activityTrackingEnabled: boolean
  reminderSensitivity: 'relaxed' | 'normal' | 'strict'
  maxRemindersPerHour: number
  allowedApps: string[]
  blockedApps: string[]
  live2dModelPath: string | null
  avatarScale: number
  avatarPosition: { x: number; y: number } | null
}
