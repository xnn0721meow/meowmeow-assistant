import { describe, expect, it } from 'vitest'
import { FocusStateMachine } from './stateMachine'
import type { AppSettings, SignalSnapshot, VisionSignal } from './types'

const settings: AppSettings = {
  cameraEnabled: true,
  activityTrackingEnabled: true,
  reminderSensitivity: 'normal',
  maxRemindersPerHour: 3,
  allowedApps: ['code', 'obsidian'],
  blockedApps: ['bilibili', 'steam'],
  live2dModelPath: null,
  avatarScale: 1,
  avatarPosition: null
}

function vision(overrides: Partial<VisionSignal> = {}): VisionSignal {
  return {
    facePresent: true,
    lookingAtScreen: true,
    eyesOpen: true,
    yaw: 0,
    pitch: 0,
    confidence: 1,
    timestamp: 0,
    ...overrides
  }
}

function snapshot(timestamp: number, overrides: Partial<SignalSnapshot> = {}): SignalSnapshot {
  return {
    timestamp,
    vision: vision({ timestamp }),
    activity: {
      appName: 'Code',
      windowTitle: 'focus-mascot',
      idleSeconds: 0,
      available: true,
      timestamp
    },
    ...overrides
  }
}

describe('FocusStateMachine', () => {
  it('enters focused after a stable good signal window', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    expect(machine.getState()).toBe('unknown')

    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('focused')
  })

  it('marks gaze-away as distracted only after the threshold', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    expect(machine.getState()).toBe('focused')

    machine.update(snapshot(30_000, { vision: vision({ lookingAtScreen: false, timestamp: 30_000 }) }))
    expect(machine.getState()).toBe('focused')

    const events = machine.update(
      snapshot(95_000, { vision: vision({ lookingAtScreen: false, timestamp: 95_000 }) })
    )
    expect(machine.getState()).toBe('distracted')
    expect(events.at(-1)?.reason).toBe('gaze-away')
  })

  it('uses a shorter threshold for a blocked app', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))

    machine.update(
      snapshot(20_000, {
        activity: {
          appName: 'chrome',
          windowTitle: 'bilibili.com 首页',
          idleSeconds: 0,
          available: true,
          timestamp: 20_000
        }
      })
    )
    expect(machine.getState()).toBe('focused')

    machine.update(
      snapshot(45_000, {
        activity: {
          appName: 'chrome',
          windowTitle: 'bilibili.com 首页',
          idleSeconds: 0,
          available: true,
          timestamp: 45_000
        }
      })
    )
    expect(machine.getState()).toBe('distracted')
  })

  it('goes away when the face disappears and returns when it comes back', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000))
    machine.update(snapshot(11_000))
    machine.update(snapshot(20_000, { vision: vision({ facePresent: false, timestamp: 20_000 }) }))
    machine.update(snapshot(140_000, { vision: vision({ facePresent: false, timestamp: 140_000 }) }))

    expect(machine.getState()).toBe('away')

    const events = machine.update(snapshot(145_000))
    expect(machine.getState()).toBe('unknown')
    expect(events[0]?.type).toBe('returned')
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

  it('falls back to activity when the camera is unavailable', () => {
    const machine = new FocusStateMachine(settings, 0)
    machine.update(snapshot(1_000, { vision: null }))
    machine.update(snapshot(11_000, { vision: null }))
    expect(machine.getState()).toBe('focused')

    machine.update(
      snapshot(40_000, {
        vision: null,
        activity: {
          appName: 'chrome',
          windowTitle: 'bilibili',
          idleSeconds: 0,
          available: true,
          timestamp: 40_000
        }
      })
    )
    expect(machine.getState()).toBe('focused')

    machine.update(
      snapshot(65_000, {
        vision: null,
        activity: {
          appName: 'chrome',
          windowTitle: 'bilibili',
          idleSeconds: 0,
          available: true,
          timestamp: 65_000
        }
      })
    )
    expect(machine.getState()).toBe('distracted')
  })
})
