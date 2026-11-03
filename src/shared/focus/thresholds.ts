import type { AppSettings, DistractionReason } from './types'

export interface FocusThresholds {
  distractedAfterMs: number
  blockedAppAfterMs: number
  gazeAwayAfterMs: number
  focusedAfterMs: number
  awayAfterMs: number
  idleAwaySeconds: number
}

const BASE: Record<AppSettings['reminderSensitivity'], FocusThresholds> = {
  relaxed: {
    distractedAfterMs: 90_000,
    blockedAppAfterMs: 45_000,
    gazeAwayAfterMs: 90_000,
    focusedAfterMs: 15_000,
    awayAfterMs: 180_000,
    idleAwaySeconds: 600
  },
  normal: {
    distractedAfterMs: 60_000,
    blockedAppAfterMs: 20_000,
    gazeAwayAfterMs: 60_000,
    focusedAfterMs: 10_000,
    awayAfterMs: 120_000,
    idleAwaySeconds: 300
  },
  strict: {
    distractedAfterMs: 45_000,
    blockedAppAfterMs: 10_000,
    gazeAwayAfterMs: 30_000,
    focusedAfterMs: 8_000,
    awayAfterMs: 90_000,
    idleAwaySeconds: 180
  }
}

export function thresholdsFor(settings: AppSettings): FocusThresholds {
  return BASE[settings.reminderSensitivity] ?? BASE.normal
}

export function thresholdFor(reason: DistractionReason, thresholds: FocusThresholds): number {
  switch (reason) {
    case 'blocked-app':
      return thresholds.blockedAppAfterMs
    case 'gaze-away':
      return thresholds.gazeAwayAfterMs
    case 'idle':
      return thresholds.distractedAfterMs
    case 'no-face':
      return thresholds.awayAfterMs
    default:
      return thresholds.distractedAfterMs
  }
}
