import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings, FocusEvent, FocusSnapshot, ReminderAction } from '@shared/focus/types'
import { IPC } from '@shared/ipc'
import { FocusEngine } from './focusEngine'
import { ActivityProbe } from './activityProbe'
import { loadSettings, saveSettings, sanitizeSettings } from './settings'

// Development-only escape hatch for sandboxed environments where the default
// AppData directory is not writable. Production uses Electron's default path.
const customUserData = process.env['MEOWMEOW_USER_DATA']
if (customUserData) {
  mkdirSync(customUserData, { recursive: true })
  app.setPath('userData', customUserData)
}

const AVATAR_WIDTH = 360
const AVATAR_HEIGHT = 520

let avatarWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let engine: FocusEngine | null = null
let activityProbe: ActivityProbe | null = null
let settings: AppSettings
let isQuitting = false
let savePositionTimer: NodeJS.Timeout | null = null

function resourcePath(name: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources', name)
    : join(app.getAppPath(), 'resources', name)
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function rendererUrl(hash?: string): string | null {
  const url = process.env['ELECTRON_RENDERER_URL']
  if (!url) return null
  return hash ? `${url}#${hash}` : url
}

function rendererFile(): string {
  return join(__dirname, '../renderer/index.html')
}

function defaultAvatarPosition(): { x: number; y: number } {
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: area.x + area.width - AVATAR_WIDTH - 28,
    y: area.y + area.height - AVATAR_HEIGHT - 28
  }
}

function clampPosition(position: { x: number; y: number }): { x: number; y: number } {
  const display = screen.getDisplayMatching({
    x: position.x,
    y: position.y,
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT
  })
  const area = display.workArea
  return {
    x: Math.min(Math.max(position.x, area.x - AVATAR_WIDTH + 80), area.x + area.width - 80),
    y: Math.min(Math.max(position.y, area.y), area.y + area.height - 80)
  }
}

function createAvatarWindow(): BrowserWindow {
  if (avatarWindow && !avatarWindow.isDestroyed()) return avatarWindow

  const saved = settings.avatarPosition ?? defaultAvatarPosition()
  const position = clampPosition(saved)

  const win = new BrowserWindow({
    width: AVATAR_WIDTH,
    height: AVATAR_HEIGHT,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })

  win.once('ready-to-show', () => {
    win.showInactive()
  })

  win.on('moved', () => {
    if (savePositionTimer) clearTimeout(savePositionTimer)
    savePositionTimer = setTimeout(() => {
      if (!avatarWindow || avatarWindow.isDestroyed()) return
      const [x, y] = avatarWindow.getPosition()
      settings.avatarPosition = { x, y }
      saveSettings(settings)
    }, 400)
  })

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  win.on('closed', () => {
    avatarWindow = null
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const url = rendererUrl()
  if (url) {
    void win.loadURL(url)
  } else {
    void win.loadFile(rendererFile())
  }

  avatarWindow = win
  return win
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: 860,
    height: 720,
    minWidth: 760,
    minHeight: 600,
    title: '喵喵助手 设置',
    autoHideMenuBar: true,
    backgroundColor: '#111318',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  win.on('closed', () => {
    settingsWindow = null
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const url = rendererUrl('settings')
  if (url) {
    void win.loadURL(url)
  } else {
    void win.loadFile(rendererFile(), { hash: 'settings' })
  }

  settingsWindow = win
  return win
}

function toggleAvatarWindow(): void {
  if (!avatarWindow) {
    createAvatarWindow()
    return
  }
  if (avatarWindow.isVisible()) {
    avatarWindow.hide()
  } else {
    avatarWindow.showInactive()
  }
  rebuildTrayMenu()
}

function rebuildTrayMenu(): void {
  if (!tray) return
  const snapshot = engine?.getSnapshot()
  const isVisible = avatarWindow?.isVisible() ?? false

  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏桌宠' : '显示桌宠',
      click: toggleAvatarWindow
    },
    {
      label: snapshot?.paused ? '继续检测' : '暂停检测',
      click: () => engine?.setPaused(!engine.getSnapshot().paused)
    },
    { type: 'separator' },
    {
      label: '开始新的学习',
      click: () => engine?.resetSession()
    },
    {
      label: '设置',
      click: () => createSettingsWindow()
    },
    {
      label: '打开数据目录',
      click: () => void shell.openPath(app.getPath('userData'))
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
}

function createTray(): void {
  const icon = nativeImage.createFromPath(resourcePath('icon.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('喵喵助手')
  tray.on('click', toggleAvatarWindow)
  rebuildTrayMenu()
}

function safeSend(window: BrowserWindow | null, channel: string, payload: unknown): void {
  if (!window || window.isDestroyed()) return
  if (window.webContents.isDestroyed()) return
  window.webContents.send(channel, payload)
}

function broadcast(channel: string, payload: unknown): void {
  safeSend(avatarWindow, channel, payload)
  safeSend(settingsWindow, channel, payload)
}

function registerIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => settings)

  ipcMain.handle(IPC.settingsUpdate, (_event, patch: Partial<AppSettings>) => {
    settings = sanitizeSettings({ ...settings, ...patch })
    saveSettings(settings)
    engine?.updateSettings(settings)
    broadcast(IPC.settingsChanged, settings)
    rebuildTrayMenu()
    return settings
  })

  ipcMain.handle(IPC.focusGetSnapshot, () => engine?.getSnapshot())

  ipcMain.on(IPC.focusReset, () => engine?.resetSession())
  ipcMain.on(IPC.focusSetPaused, (_event, paused: boolean) => engine?.setPaused(Boolean(paused)))

  ipcMain.on(IPC.windowSetInteractive, (_event, interactive: boolean) => {
    if (!avatarWindow || avatarWindow.isDestroyed()) return
    avatarWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  })

  ipcMain.on(IPC.windowOpenSettings, () => createSettingsWindow())
  ipcMain.on(IPC.windowCloseSettings, () => settingsWindow?.close())

  ipcMain.on(IPC.appOpenDataFolder, () => {
    void shell.openPath(app.getPath('userData'))
  })

  ipcMain.on(IPC.reminderAction, (_event, action: ReminderAction) => {
    engine?.acknowledgeReminder(action)
  })
}

async function bootstrap(): Promise<void> {
  settings = loadSettings()

  app.setAppUserModelId('dev.meowmeow.assistant')

  engine = new FocusEngine(settings)
  engine.on('event', (event: FocusEvent) => {
    broadcast(IPC.focusEvent, event)
  })
  engine.on('snapshot', (snapshot: FocusSnapshot) => {
    broadcast(IPC.focusSnapshotChanged, snapshot)
  })

  registerIpc()

  activityProbe = new ActivityProbe(
    (sample) => engine?.ingestActivity(sample),
    (available) => engine?.setActivityAvailable(available)
  )

  createTray()
  createAvatarWindow()
  engine.start()
  activityProbe.start()

  engine.on('event', (event: FocusEvent) => {
    if (event.type === 'state-changed') rebuildTrayMenu()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!avatarWindow) createAvatarWindow()
    avatarWindow?.showInactive()
  })

  app.whenReady().then(() => {
    void bootstrap()
  })

  app.on('activate', () => {
    if (!avatarWindow) createAvatarWindow()
    avatarWindow?.showInactive()
  })

  // Keep running in the tray when the settings window is closed.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Intentionally do nothing: the mascot lives in the tray.
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
    engine?.stop()
    activityProbe?.stop()
    if (savePositionTimer) clearTimeout(savePositionTimer)
  })
}
