import type { AppSettings, FocusEvent, FocusSnapshot, ReminderAction } from './focus/types'

export const IPC = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',
  focusGetSnapshot: 'focus:get-snapshot',
  focusSnapshotChanged: 'focus:snapshot-changed',
  focusEvent: 'focus:event',
  focusReset: 'focus:reset',
  focusSetPaused: 'focus:set-paused',
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
  resetSession(): void
  setPaused(paused: boolean): void
  setInteractive(interactive: boolean): void
  openSettings(): void
  closeSettings(): void
  openDataFolder(): void
  reminderAction(action: ReminderAction): void
  onEvent(callback: (event: FocusEvent) => void): () => void
  onSnapshot(callback: (snapshot: FocusSnapshot) => void): () => void
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void
}
