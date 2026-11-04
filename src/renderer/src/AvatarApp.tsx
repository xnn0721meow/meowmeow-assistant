import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, FocusEvent, FocusSnapshot, Reminder, ReminderAction } from '@shared/focus/types'
import { formatDuration, stateLabel, buildStartMessage } from '@shared/focus/messages'
import { Mascot } from './components/Mascot'
import { SpeechBubble } from './components/SpeechBubble'
import { mountLive2D } from './live2d/live2dStage'

const EMPTY_SNAPSHOT: FocusSnapshot = {
  state: 'unknown',
  previousState: 'unknown',
  paused: false,
  focusedMs: 0,
  sessionStartedAt: Date.now(),
  lastReminderAt: null,
  remindersThisHour: 0,
  snoozedUntil: null,
  activityAvailable: false,
  currentApp: null,
  currentTitle: null
}

export function AvatarApp() {
  const [snapshot, setSnapshot] = useState<FocusSnapshot>(EMPTY_SNAPSHOT)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [live2dError, setLive2dError] = useState<string | null>(null)
  const [live2dActive, setLive2dActive] = useState(false)

  const live2dHostRef = useRef<HTMLDivElement | null>(null)
  const live2dCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([window.focusMascot.getSnapshot(), window.focusMascot.getSettings()])
      .then(([initialSnapshot, initialSettings]) => {
        if (cancelled) return
        setSnapshot(initialSnapshot)
        setSettings(initialSettings)
        setMessage(buildStartMessage())
      })
      .catch((error) => {
        console.warn('Could not load initial state:', error)
      })

    const offSnapshot = window.focusMascot.onSnapshot((next) => setSnapshot(next))

    const offEvent = window.focusMascot.onEvent((event: FocusEvent) => {
      if (event.type === 'reminder' && event.reminder) {
        setReminder(event.reminder)
        setMessage(null)
        return
      }

      if (event.type === 'returned') {
        setReminder(null)
        setMessage(event.message ?? null)
        return
      }

      if (event.type === 'session-started' || event.type === 'session-reset') {
        setReminder(null)
        setMessage(event.message ?? null)
        return
      }

      if (event.type === 'state-changed') {
        if (event.state === 'away') {
          setReminder(null)
          setMessage(event.message ?? null)
        } else if (event.state === 'paused') {
          setReminder(null)
          setMessage('已暂停检测，随时回来。')
        } else if (event.state === 'focused') {
          setReminder(null)
        }
      }
    })

    const offSettings = window.focusMascot.onSettingsChanged((next) => {
      setSettings(next)
    })

    return () => {
      cancelled = true
      offSnapshot()
      offEvent()
      offSettings()
    }
  }, [])

  useEffect(() => {
    if (!message || reminder) return
    const timer = window.setTimeout(() => setMessage(null), 6_000)
    return () => window.clearTimeout(timer)
  }, [message, reminder])

  useEffect(() => {
    if (!reminder) return
    const timer = window.setTimeout(() => setReminder(null), 90_000)
    return () => window.clearTimeout(timer)
  }, [reminder])

  useEffect(() => {
    if (snapshot.state === 'focused' && reminder) {
      setReminder(null)
    }
  }, [snapshot.state, reminder])

  useEffect(() => {
    const modelPath = settings?.live2dModelPath
    if (!modelPath) {
      live2dCleanupRef.current?.()
      live2dCleanupRef.current = null
      setLive2dError(null)
      setLive2dActive(false)
      return
    }
    if (!live2dHostRef.current) return

    let cancelled = false
    const host = live2dHostRef.current

    mountLive2D(host, modelPath)
      .then((cleanup) => {
        if (cancelled) {
          cleanup()
          return
        }
        live2dCleanupRef.current = cleanup
        setLive2dError(null)
        setLive2dActive(true)
      })
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : 'Live2D 加载失败'
        console.warn('Live2D unavailable:', error)
        setLive2dError(text)
        setLive2dActive(false)
      })

    return () => {
      cancelled = true
      live2dCleanupRef.current?.()
      live2dCleanupRef.current = null
    }
  }, [settings?.live2dModelPath])

  useEffect(() => {
    let interactive = false
    let frame = 0

    const update = (event: MouseEvent): void => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const target = document.elementFromPoint(event.clientX, event.clientY)
        const next = Boolean(target?.closest('.interactive'))
        if (next !== interactive) {
          interactive = next
          window.focusMascot.setInteractive(next)
        }
      })
    }

    const leave = (): void => {
      if (!interactive) return
      interactive = false
      window.focusMascot.setInteractive(false)
    }

    const blur = (): void => leave()

    window.addEventListener('mousemove', update)
    window.addEventListener('mouseleave', leave)
    window.addEventListener('blur', blur)

    return () => {
      window.removeEventListener('mousemove', update)
      window.removeEventListener('mouseleave', leave)
      window.removeEventListener('blur', blur)
      if (frame !== 0) cancelAnimationFrame(frame)
      leave()
    }
  }, [])

  const handleReminderAction = (action: ReminderAction): void => {
    window.focusMascot.reminderAction(action)
    setReminder(null)
    if (action === 'end-session') {
      setMessage('今天就到这里，休息一下吧。')
    }
  }

  const togglePause = (): void => {
    window.focusMascot.setPaused(!snapshot.paused)
  }

  const statusText = useMemo(() => {
    if (snapshot.paused) return '已暂停'
    return stateLabel(snapshot.state)
  }, [snapshot.paused, snapshot.state])

  const scale = settings?.avatarScale ?? 1
  const bubbleVisible = Boolean(reminder || message)

  return (
    <div className="avatar-root" data-state={snapshot.state} data-bubble={bubbleVisible}>
      <div className="bubble-slot">
        <SpeechBubble
          reminder={reminder}
          message={message}
          onAction={handleReminderAction}
          onDismiss={() => {
            window.focusMascot.reminderAction('dismiss')
            setReminder(null)
            setMessage(null)
          }}
        />
      </div>

      <div className="pet-area">
        <div
          className={live2dActive ? 'mascot-shell interactive live2d-active' : 'mascot-shell interactive'}
          style={{ transform: `scale(${scale})` }}
          onDoubleClick={() => window.focusMascot.openSettings()}
          title="双击打开设置"
        >
          <Mascot state={snapshot.state} />
          <div ref={live2dHostRef} className="live2d-host" aria-hidden="true" />
        </div>

        <div className="drag-handle interactive" title="拖动桌宠">
          <span className="drag-dot" />
          <span className="drag-dot" />
          <span className="drag-dot" />
          <span className="drag-dot" />
        </div>

        <div className="status-row">
          <span className="status-dot" data-state={snapshot.state} />
          <span className="status-label">{statusText}</span>
          <span className="status-time">{formatDuration(snapshot.focusedMs)}</span>
        </div>

        {live2dError && (
          <div className="error-hint" title={live2dError}>
            Live2D 加载失败，使用内置形象
          </div>
        )}

        <div className="quick-actions interactive">
          <button className="quick-button" onClick={togglePause}>
            {snapshot.paused ? '继续' : '暂停'}
          </button>
          <button className="quick-button" onClick={() => window.focusMascot.openSettings()}>
            设置
          </button>
          <button className="quick-button ghost" onClick={() => window.focusMascot.resetSession()}>
            新会话
          </button>
        </div>
      </div>
    </div>
  )
}
