import type { AppSettings, FocusEvent, FocusSnapshot, ReminderAction } from './focus/types'
import type { PomodoroEvent, PomodoroSnapshot } from './pomodoro/types'

export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',
  focusGetSnapshot: 'focus:get-snapshot',
  focusSnapshotChanged: 'focus:snapshot-changed',
  focusEvent: 'focus:event',
  focusReset: 'focus:reset',
  focusSetPaused: 'focus:set-paused',
  pomodoroGetSnapshot: 'pomodoro:get-snapshot',
  pomodoroSnapshotChanged: 'pomodoro:snapshot-changed',
  pomodoroEvent: 'pomodoro:event',
  pomodoroStart: 'pomodoro:start',
  pomodoroPause: 'pomodoro:pause',
  pomodoroResume: 'pomodoro:resume',
  pomodoroStop: 'pomodoro:stop',
  pomodoroSkipBreak: 'pomodoro:skip-break',
  pomodoroResetProgress: 'pomodoro:reset-progress',
  storyOpenFile: 'story:open-file',
  windowSetInteractive: 'window:set-interactive',
  windowOpenSettings: 'window:open-settings',
  windowCloseSettings: 'window:close-settings',
  appOpenDataFolder: 'app:open-data-folder',
  reminderAction: 'reminder:action'
} as const

export interface FocusMascotApi {
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  getSnapshot(): Promise<FocusSnapshot>
  getPomodoroSnapshot(): Promise<PomodoroSnapshot>
  resetSession(): void
  setPaused(paused: boolean): void
  startPomodoro(): void
  pausePomodoro(): void
  resumePomodoro(): void
  stopPomodoro(): void
  skipBreak(): void
  resetStoryProgress(): void
  openStoryFile(): void
  setInteractive(interactive: boolean): void
  openSettings(): void
  closeSettings(): void
  openDataFolder(): void
  reminderAction(action: ReminderAction): void
  onEvent(callback: (event: FocusEvent) => void): () => void
  onSnapshot(callback: (snapshot: FocusSnapshot) => void): () => void
  onPomodoroEvent(callback: (event: PomodoroEvent) => void): () => void
  onPomodoroSnapshot(callback: (snapshot: PomodoroSnapshot) => void): () => void
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void
}
