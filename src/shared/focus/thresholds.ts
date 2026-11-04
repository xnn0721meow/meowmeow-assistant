import type { AppSettings } from './types'

export interface FocusThresholds {
  /** How long a blocked app must stay in front before it counts as distraction. */
  blockedAppAfterMs: number
  /** How long a non-blocked app with recent input must stay in front before it counts as focus. */
  focusedAfterMs: number
  /** System-wide idle time that pauses the session. */
  awayAfterSeconds: number
}

const BASE: Record<AppSettings['reminderSensitivity'], FocusThresholds> = {
  relaxed: {
    blockedAppAfterMs: 45_000,
    focusedAfterMs: 15_000,
    awayAfterSeconds: 600
  },
  normal: {
    blockedAppAfterMs: 20_000,
    focusedAfterMs: 10_000,
    awayAfterSeconds: 300
  },
  strict: {
    blockedAppAfterMs: 10_000,
    focusedAfterMs: 8_000,
    awayAfterSeconds: 180
  }
}

export function thresholdsFor(settings: AppSettings): FocusThresholds {
  return BASE[settings.reminderSensitivity] ?? BASE.normal
}
