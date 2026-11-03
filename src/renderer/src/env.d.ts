/// <reference types="vite/client" />
import type { FocusMascotApi } from '@shared/ipc'

declare global {
  interface Window {
    focusMascot: FocusMascotApi
  }
}

export {}
