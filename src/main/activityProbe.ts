import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ActivitySample {
  appName: string | null
  windowTitle: string | null
  timestamp: number
}

const SCRIPT = String.raw`
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FocusWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
while ($true) {
  try {
    $handle = [FocusWin32]::GetForegroundWindow()
    $procId = [uint32]0
    [FocusWin32]::GetWindowThreadProcessId($handle, [ref]$procId) | Out-Null
    $title = New-Object System.Text.StringBuilder 512
    [FocusWin32]::GetWindowText($handle, $title, 512) | Out-Null
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { $null }
    [pscustomobject]@{
      appName = $name
      windowTitle = $title.ToString()
    } | ConvertTo-Json -Compress
  } catch {
    '{"appName":null,"windowTitle":null}'
  }
  Start-Sleep -Milliseconds 2000
}
`

/**
 * Foreground-window probe.
 *
 * It intentionally avoids a native Node addon: a small PowerShell process is
 * easier to ship and to audit. Windows-only for now; other platforms fall
 * back to "activity unavailable" and the camera remains the primary signal.
 */
export class ActivityProbe {
  private process: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private stopping = false

  constructor(
    private readonly onSample: (sample: ActivitySample) => void,
    private readonly onAvailability: (available: boolean) => void
  ) {}

  start(): void {
    if (process.platform !== 'win32') {
      this.onAvailability(false)
      return
    }

    try {
      const scriptPath = join(app.getPath('temp'), 'focus-mascot-active-window.ps1')
      writeFileSync(scriptPath, SCRIPT, 'utf8')

      this.process = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { windowsHide: true }
      ) as ChildProcessWithoutNullStreams

      this.process.stdout.setEncoding('utf8')
      this.process.stdout.on('data', (chunk: string) => this.handleChunk(chunk))
      this.process.stderr.on('data', (chunk: string) => {
        console.warn('Activity probe stderr:', chunk.trim().slice(0, 200))
      })
      this.process.on('error', (error) => {
        console.warn('Activity probe failed:', error.message)
        this.onAvailability(false)
      })
      this.process.on('exit', () => {
        this.process = null
        this.onAvailability(false)
        if (!this.stopping) {
          setTimeout(() => this.start(), 30_000)
        }
      })

      this.onAvailability(true)
      console.info('Activity probe started')
    } catch (error) {
      console.warn('Could not start activity probe:', error)
      this.onAvailability(false)
    }
  }

  stop(): void {
    this.stopping = true
    this.process?.kill()
    this.process = null
  }

  private handleChunk(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as { appName?: string | null; windowTitle?: string | null }
        this.onSample({
          appName: parsed.appName ?? null,
          windowTitle: parsed.windowTitle ?? null,
          timestamp: Date.now()
        })
      } catch {
        // Ignore partial or malformed lines; the next sample will arrive shortly.
      }
    }
  }
}
