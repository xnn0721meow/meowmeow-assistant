import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppSettings } from '@shared/focus/types'

const DEFAULTS: AppSettings = {
  activityTrackingEnabled: true,
  reminderSensitivity: 'normal',
  maxRemindersPerHour: 3,
  blockedApps: [
    'bilibili',
    '哔哩哔哩',
    'youtube',
    '抖音',
    'douyin',
    'tiktok',
    'steam',
    'epicgames',
    'leagueclient',
    'league of legends',
    'valorant',
    'cs2',
    'counter-strike',
    'apex',
    'pubg',
    'minecraft',
    'genshin',
    '原神',
    '崩坏',
    'starrail',
    'netflix',
    'iqiyi',
    '爱奇艺',
    '腾讯视频',
    '优酷'
  ],
  pomodoroFocusMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodoroLongBreakEvery: 4,
  live2dModelPath: null,
  avatarScale: 1,
  avatarPosition: null
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function cleanStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
}

function cleanNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value as number)))
}

export function sanitizeSettings(input: Partial<AppSettings>): AppSettings {
  const merged = { ...DEFAULTS, ...input }
  const sensitivity =
    merged.reminderSensitivity === 'relaxed' || merged.reminderSensitivity === 'strict'
      ? merged.reminderSensitivity
      : 'normal'
  const scale = Number.isFinite(merged.avatarScale)
    ? Math.min(1.2, Math.max(0.6, merged.avatarScale))
    : 1
  const maxReminders = Number.isFinite(merged.maxRemindersPerHour)
    ? Math.min(10, Math.max(0, Math.floor(merged.maxRemindersPerHour)))
    : 3

  return {
    activityTrackingEnabled: Boolean(merged.activityTrackingEnabled),
    reminderSensitivity: sensitivity,
    maxRemindersPerHour: maxReminders,
    blockedApps: cleanStringList(merged.blockedApps, DEFAULTS.blockedApps),
    pomodoroFocusMinutes: cleanNumber(
      merged.pomodoroFocusMinutes,
      1,
      180,
      DEFAULTS.pomodoroFocusMinutes
    ),
    pomodoroBreakMinutes: cleanNumber(
      merged.pomodoroBreakMinutes,
      1,
      60,
      DEFAULTS.pomodoroBreakMinutes
    ),
    pomodoroLongBreakMinutes: cleanNumber(
      merged.pomodoroLongBreakMinutes,
      1,
      120,
      DEFAULTS.pomodoroLongBreakMinutes
    ),
    pomodoroLongBreakEvery: cleanNumber(
      merged.pomodoroLongBreakEvery,
      1,
      12,
      DEFAULTS.pomodoroLongBreakEvery
    ),
    live2dModelPath:
      typeof merged.live2dModelPath === 'string' && merged.live2dModelPath.trim()
        ? merged.live2dModelPath.trim()
        : null,
    avatarScale: scale,
    avatarPosition:
      merged.avatarPosition &&
      Number.isFinite(merged.avatarPosition.x) &&
      Number.isFinite(merged.avatarPosition.y)
        ? { x: Math.round(merged.avatarPosition.x), y: Math.round(merged.avatarPosition.y) }
        : null
  }
}

export function loadSettings(): AppSettings {
  try {
    const path = settingsPath()
    if (!existsSync(path)) return { ...DEFAULTS }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppSettings>
    return sanitizeSettings(parsed)
  } catch (error) {
    console.warn('Could not read settings, using defaults:', error)
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    const path = settingsPath()
    mkdirSync(dirname(path), { recursive: true })
    const temp = `${path}.tmp`
    writeFileSync(temp, JSON.stringify(settings, null, 2), 'utf8')
    renameSync(temp, path)
  } catch (error) {
    console.error('Could not save settings:', error)
  }
}

export function defaultSettings(): AppSettings {
  return { ...DEFAULTS }
}
