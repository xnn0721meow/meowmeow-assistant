import { describe, expect, it } from 'vitest'
import { FocusStateMachine } from './stateMachine'
import type { ActivitySignal, AppSettings, SignalSnapshot } from './types'

const settings: AppSettings = {
  activityTrackingEnabled: true,
  reminderSensitivity: 'normal',
  maxRemindersPerHour: 3,
  blockedApps: ['bilibili', 'steam'],
  live2dModelPath: null,
  avatarScale: 1,
  avatarPosition: null
}

function activity(overrides: Partial<ActivitySignal> = {}): ActivitySignal {
  return {
    appName: 'Code',
    windowTitle: 'meowmeow-assistant',
    idleSeconds: 0,
    available: true,
    timestamp: 0,
    ...overrides
  }
}

function snapshot(timestamp: number, overrides: Partial<ActivitySignal> = {}): SignalSnapshot {
  return {
    timestamp,
    activity: activity({ timestamp, ...overrides })
  }
}

describe('FocusStateMachine', () => {
  it('enters focused after a stable active window', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    expect(machine.getState()).toBe('unknown')

    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('focused')
  })

  it('marks a blocked app as distracted only after the threshold', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('focused')

    machine.update(
      snapshot(20_000, {
        appName: 'chrome',
        windowTitle: 'bilibili.com 首页'
      })
    )
    expect(machine.getState()).toBe('focused')

    const events = machine.update(
      snapshot(45_000, {
        appName: 'chrome',
        windowTitle: 'bilibili.com 首页'
      })
    )
    expect(machine.getState()).toBe('distracted')
    expect(events.at(-1)?.reason).toBe('blocked-app')
  })

  it('goes away after the idle threshold and returns when activity resumes', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('focused')

    machine.update(snapshot(20_000, { idleSeconds: 300 }))
    expect(machine.getState()).toBe('away')

    const events = machine.update(snapshot(25_000, { idleSeconds: 0 }))
    expect(machine.getState()).toBe('unknown')
    expect(events[0]?.type).toBe('returned')

    machine.update(snapshot(35_000, { idleSeconds: 0 }))
    expect(machine.getState()).toBe('focused')
  })

  it('does not accumulate focus time while paused', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    machine.setPaused(true, 20_000)

    const before = machine.getFocusedMs()
    machine.update(snapshot(120_000))
    expect(machine.getFocusedMs()).toBe(before)
    expect(machine.getState()).toBe('paused')

    machine.setPaused(false, 121_000)
    expect(machine.getState()).toBe('unknown')
  })

  it('stays unknown when the window probe is unavailable', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000, { available: false }))
    machine.update(snapshot(11_000, { available: false }))
    expect(machine.getState()).toBe('unknown')
  })

  it('stays unknown when activity tracking is disabled', () => {
    const machine = new FocusStateMachine({ ...settings, activityTrackingEnabled: false }, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('unknown')
  })

  it('returns to focused after distraction when a study app comes back', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))

    machine.update(snapshot(20_000, { appName: 'chrome', windowTitle: 'bilibili.com' }))
    machine.update(snapshot(45_000, { appName: 'chrome', windowTitle: 'bilibili.com' }))
    expect(machine.getState()).toBe('distracted')

    machine.update(snapshot(60_000))
    const events = machine.update(snapshot(70_000))
    expect(machine.getState()).toBe('focused')
    expect(events.some((event) => event.type === 'returned')).toBe(true)
  })

  it('prefers the away state over a blocked app when idle is long enough', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))

    machine.update(
      snapshot(20_000, {
        appName: 'chrome',
        windowTitle: 'bilibili.com',
        idleSeconds: 300
      })
    )
    expect(machine.getState()).toBe('away')
  })
})
