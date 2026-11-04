import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type FocusMascotApi } from '@shared/ipc'
import type { AppSettings, FocusEvent, FocusSnapshot } from '@shared/focus/types'
import type { PomodoroEvent, PomodoroSnapshot } from '@shared/pomodoro/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: FocusMascotApi = {
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
  getSnapshot: () => ipcRenderer.invoke(IPC.focusGetSnapshot),
  getPomodoroSnapshot: () => ipcRenderer.invoke(IPC.pomodoroGetSnapshot),
  resetSession: () => ipcRenderer.send(IPC.focusReset),
  setPaused: (paused: boolean) => ipcRenderer.send(IPC.focusSetPaused, paused),
  startPomodoro: () => ipcRenderer.send(IPC.pomodoroStart),
  pausePomodoro: () => ipcRenderer.send(IPC.pomodoroPause),
  resumePomodoro: () => ipcRenderer.send(IPC.pomodoroResume),
  stopPomodoro: () => ipcRenderer.send(IPC.pomodoroStop),
  skipBreak: () => ipcRenderer.send(IPC.pomodoroSkipBreak),
  resetStoryProgress: () => ipcRenderer.send(IPC.pomodoroResetProgress),
  openStoryFile: () => ipcRenderer.send(IPC.storyOpenFile),
  setInteractive: (interactive: boolean) => ipcRenderer.send(IPC.windowSetInteractive, interactive),
  openSettings: () => ipcRenderer.send(IPC.windowOpenSettings),
  closeSettings: () => ipcRenderer.send(IPC.windowCloseSettings),
  openDataFolder: () => ipcRenderer.send(IPC.appOpenDataFolder),
  reminderAction: (action) => ipcRenderer.send(IPC.reminderAction, action),
  onEvent: (callback: (event: FocusEvent) => void) => subscribe(IPC.focusEvent, callback),
  onSnapshot: (callback: (snapshot: FocusSnapshot) => void) =>
    subscribe(IPC.focusSnapshotChanged, callback),
  onPomodoroEvent: (callback: (event: PomodoroEvent) => void) =>
    subscribe(IPC.pomodoroEvent, callback),
  onPomodoroSnapshot: (callback: (snapshot: PomodoroSnapshot) => void) =>
    subscribe(IPC.pomodoroSnapshotChanged, callback),
  onSettingsChanged: (callback: (settings: AppSettings) => void) =>
    subscribe(IPC.settingsChanged, callback)
}

contextBridge.exposeInMainWorld('focusMascot', api)
