import { useEffect, useState } from 'react'
import type { AppSettings, FocusSnapshot } from '@shared/focus/types'
import type { PomodoroSnapshot } from '@shared/pomodoro/types'
import {
  EMPTY_POMODORO_SNAPSHOT,
  formatPomodoroClock,
  pomodoroPhaseLabel
} from '@shared/pomodoro/display'
import { formatDuration, stateLabel } from '@shared/focus/messages'

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

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

export function SettingsApp() {
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [snapshot, setSnapshot] = useState<FocusSnapshot>(EMPTY_SNAPSHOT)
  const [pomodoro, setPomodoro] = useState<PomodoroSnapshot>(EMPTY_POMODORO_SNAPSHOT)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      window.focusMascot.getSettings(),
      window.focusMascot.getSnapshot(),
      window.focusMascot.getPomodoroSnapshot()
    ])
      .then(([initialSettings, initialSnapshot, initialPomodoro]) => {
        if (cancelled) return
        setDraft(initialSettings)
        setSnapshot(initialSnapshot)
        setPomodoro(initialPomodoro)
      })
      .catch((error) => {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : '读取设置失败')
      })

    const offSnapshot = window.focusMascot.onSnapshot((next) => setSnapshot(next))
    const offPomodoro = window.focusMascot.onPomodoroSnapshot((next) => setPomodoro(next))
    const offSettings = window.focusMascot.onSettingsChanged((next) => setDraft(next))

    return () => {
      cancelled = true
      offSnapshot()
      offPomodoro()
      offSettings()
    }
  }, [])

  const updateDraft = (patch: Partial<AppSettings>): void => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setSaved(false)
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    setSaveError(null)
    try {
      const next = await window.focusMascot.updateSettings(draft)
      setDraft(next)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2_000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败')
    }
  }

  if (!draft) {
    return (
      <main className="settings-page">
        <div className="settings-loading">正在读取设置…</div>
      </main>
    )
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <h1>喵喵助手</h1>
          <p>MeowMeow Assistant · 本地优先的学习伴侣。只读取前台窗口和键鼠空闲，不读取画面。</p>
        </div>
        <div className="header-status">
          <span className="status-dot" data-state={snapshot.state} />
          <span>{snapshot.paused ? '已暂停' : stateLabel(snapshot.state)}</span>
          <span className="header-time">{formatDuration(snapshot.focusedMs)}</span>
        </div>
      </header>

      <section className="settings-card">
        <div className="card-heading">
          <h2>电脑活动</h2>
          <span className="card-hint">仅本机</span>
        </div>

        <label className="toggle-row">
          <span>
            <strong>跟踪前台窗口与键鼠空闲</strong>
            <small>读取当前窗口的进程名/标题和系统空闲秒数，用来判断你在用什么、是否还在操作。</small>
          </span>
          <input
            type="checkbox"
            checked={draft.activityTrackingEnabled}
            onChange={(event) => updateDraft({ activityTrackingEnabled: event.target.checked })}
          />
        </label>
        <div className="status-line">
          <span className="status-dot" data-state={snapshot.activityAvailable ? 'focused' : 'unknown'} />
          <span>窗口信号：{snapshot.activityAvailable ? '运行中' : '不可用'}</span>
          <span className="muted">
            {snapshot.currentApp ?? '—'}
            {snapshot.currentTitle
              ? ` · ${snapshot.currentTitle.slice(0, 36)}${snapshot.currentTitle.length > 36 ? '…' : ''}`
              : ''}
          </span>
        </div>
        <p className="field-hint">
          只读取进程名、窗口标题和键鼠空闲秒数。不截图、不读取画面、不上传。
          分心应用连续停留达到阈值会提醒；空闲超过一段时间会暂停计时。
        </p>
      </section>

      <section className="settings-card">
        <div className="card-heading">
          <h2>番茄钟与故事</h2>
          <span className="card-hint">每完成一轮 +10 关系值</span>
        </div>

        <div className="field-row">
          <span className="field-label">专注时长（分钟）</span>
          <input
            className="number-input"
            type="number"
            min={1}
            max={180}
            value={draft.pomodoroFocusMinutes}
            onChange={(event) =>
              updateDraft({ pomodoroFocusMinutes: Number(event.target.value) })
            }
          />
        </div>

        <div className="field-row">
          <span className="field-label">短休息（分钟）</span>
          <input
            className="number-input"
            type="number"
            min={1}
            max={60}
            value={draft.pomodoroBreakMinutes}
            onChange={(event) =>
              updateDraft({ pomodoroBreakMinutes: Number(event.target.value) })
            }
          />
        </div>

        <div className="field-row">
          <span className="field-label">长休息（分钟）</span>
          <input
            className="number-input"
            type="number"
            min={1}
            max={120}
            value={draft.pomodoroLongBreakMinutes}
            onChange={(event) =>
              updateDraft({ pomodoroLongBreakMinutes: Number(event.target.value) })
            }
          />
        </div>

        <div className="field-row">
          <span className="field-label">每几轮长休息</span>
          <input
            className="number-input"
            type="number"
            min={1}
            max={12}
            value={draft.pomodoroLongBreakEvery}
            onChange={(event) =>
              updateDraft({ pomodoroLongBreakEvery: Number(event.target.value) })
            }
          />
        </div>

        <div className="session-grid story-grid">
          <div>
            <span className="muted">角色</span>
            <strong>{pomodoro.characterName}</strong>
          </div>
          <div>
            <span className="muted">关系值</span>
            <strong>{pomodoro.bond}</strong>
          </div>
          <div>
            <span className="muted">已完成</span>
            <strong>{pomodoro.completedPomodoros} 轮</strong>
          </div>
          <div>
            <span className="muted">故事</span>
            <strong>
              {pomodoro.storyIndex}/{pomodoro.chapterCount}
            </strong>
          </div>
        </div>

        <div className="status-line">
          <span className="status-dot" data-state={pomodoro.phase === 'idle' ? 'unknown' : 'focused'} />
          <span>
            {pomodoroPhaseLabel(pomodoro.phase)}
            {pomodoro.phase !== 'idle' ? ` · ${formatPomodoroClock(pomodoro.remainingMs)}` : ''}
          </span>
          <span className="muted">
            {pomodoro.currentChapter
              ? `最近解锁：${pomodoro.currentChapter.title}`
              : '还没有解锁故事'}
            {pomodoro.nextChapter
              ? ` · 下一段需要 ${pomodoro.nextBondRequired} 关系值`
              : ' · 全部故事已解锁'}
          </span>
        </div>

        <div className="button-row">
          {pomodoro.phase === 'idle' && (
            <button
              className="settings-button primary"
              onClick={() => window.focusMascot.startPomodoro()}
            >
              开始专注
            </button>
          )}
          {(pomodoro.phase === 'focus' ||
            pomodoro.phase === 'break' ||
            pomodoro.phase === 'long-break') && (
            <button
              className="settings-button"
              onClick={() => window.focusMascot.pausePomodoro()}
            >
              暂停计时
            </button>
          )}
          {pomodoro.phase === 'paused' && (
            <button
              className="settings-button primary"
              onClick={() => window.focusMascot.resumePomodoro()}
            >
              继续计时
            </button>
          )}
          {pomodoro.phase !== 'idle' && (
            <button
              className="settings-button"
              onClick={() => window.focusMascot.stopPomodoro()}
            >
              结束这一轮
            </button>
          )}
          {(pomodoro.phase === 'break' || pomodoro.phase === 'long-break') && (
            <button className="settings-button" onClick={() => window.focusMascot.skipBreak()}>
              跳过休息
            </button>
          )}
          <button
            className="settings-button ghost"
            onClick={() => window.focusMascot.openStoryFile()}
          >
            打开 story.json
          </button>
          <button
            className="settings-button ghost"
            onClick={() => {
              if (!window.confirm('确定重置关系值和故事进度吗？已完成轮数也会归零。')) return
              window.focusMascot.resetStoryProgress()
            }}
          >
            重置剧情进度
          </button>
        </div>

        <p className="field-hint">
          剧情与关系值保存在应用数据目录的 <code>story.json</code> 和{' '}
          <code>progress.json</code>。可以直接编辑 <code>story.json</code> 的{' '}
          <code>character</code>、<code>breakLines</code> 和 <code>chapters</code>，保存后重启应用生效。
          默认角色「小喵」是内置原创示例，不含游戏原文。
        </p>
      </section>

      <section className="settings-card">
        <div className="card-heading">
          <h2>提醒</h2>
          <span className="card-hint">少而准</span>
        </div>

        <div className="field-row">
          <span className="field-label">灵敏度</span>
          <div className="segmented">
            {(
              [
                ['relaxed', '宽松'],
                ['normal', '标准'],
                ['strict', '严格']
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={draft.reminderSensitivity === value ? 'segment active' : 'segment'}
                onClick={() => updateDraft({ reminderSensitivity: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <span className="field-label">每小时最多提醒</span>
          <input
            className="number-input"
            type="number"
            min={0}
            max={10}
            value={draft.maxRemindersPerHour}
            onChange={(event) =>
              updateDraft({ maxRemindersPerHour: Number(event.target.value) })
            }
          />
        </div>

        <div className="status-line">
          <span className="muted">
            本小时已提醒 {snapshot.remindersThisHour} 次
            {snapshot.snoozedUntil
              ? ` · 已推迟到 ${formatClock(snapshot.snoozedUntil)}`
              : ''}
          </span>
        </div>
      </section>

      <section className="settings-card">
        <div className="card-heading">
          <h2>分心应用</h2>
          <span className="card-hint">匹配进程名或窗口标题</span>
        </div>

        <div className="textarea-grid single">
          <label className="textarea-field">
            <span>关键词（每行一个）</span>
            <textarea
              rows={6}
              value={draft.blockedApps.join('\n')}
              onChange={(event) =>
                updateDraft({ blockedApps: event.target.value.split('\n') })
              }
            />
          </label>
        </div>
        <p className="field-hint">
          命中这些关键词时，连续停留达到阈值会提醒；其他应用默认算作学习。
          例如在浏览器里打开 B 站，进程名是 chrome，但窗口标题会命中 bilibili。
        </p>
      </section>

      <section className="settings-card">
        <div className="card-heading">
          <h2>外观</h2>
          <span className="card-hint">Live2D 可选</span>
        </div>

        <div className="field-row">
          <span className="field-label">桌宠大小</span>
          <input
            className="range-input"
            type="range"
            min={0.6}
            max={1.2}
            step={0.05}
            value={draft.avatarScale}
            onChange={(event) => updateDraft({ avatarScale: Number(event.target.value) })}
          />
          <span className="range-value">{Math.round(draft.avatarScale * 100)}%</span>
        </div>

        <label className="text-field">
          <span>Live2D 模型路径（可选）</span>
          <input
            type="text"
            placeholder="/live2d/models/your_model/your_model.model3.json"
            value={draft.live2dModelPath ?? ''}
            onChange={(event) =>
              updateDraft({ live2dModelPath: event.target.value.trim() || null })
            }
          />
        </label>
        <p className="field-hint">
          需要把 Cubism Core 放到 <code>src/renderer/public/live2d/core/</code>，模型放到
          <code>src/renderer/public/live2d/models/</code>。未配置时使用内置形象。
        </p>
      </section>

      <section className="settings-card">
        <div className="card-heading">
          <h2>当前会话</h2>
          <span className="card-hint">全部数据保存在本机</span>
        </div>

        <div className="session-grid">
          <div>
            <span className="muted">开始时间</span>
            <strong>{formatClock(snapshot.sessionStartedAt)}</strong>
          </div>
          <div>
            <span className="muted">专注时长</span>
            <strong>{formatDuration(snapshot.focusedMs)}</strong>
          </div>
          <div>
            <span className="muted">状态</span>
            <strong>{snapshot.paused ? '已暂停' : stateLabel(snapshot.state)}</strong>
          </div>
        </div>

        <div className="button-row">
          <button
            className="settings-button"
            onClick={() => window.focusMascot.setPaused(!snapshot.paused)}
          >
            {snapshot.paused ? '继续检测' : '暂停检测'}
          </button>
          <button className="settings-button" onClick={() => window.focusMascot.resetSession()}>
            开始新的专注
          </button>
          <button className="settings-button ghost" onClick={() => window.focusMascot.openDataFolder()}>
            打开数据目录
          </button>
        </div>
      </section>

      <footer className="settings-footer">
        <div className="footer-copy">
          <strong>隐私说明</strong>
          <span>原始画面不会离开这台电脑，也不会保存。设置与专注记录只写入本地应用目录。</span>
        </div>
        <div className="footer-actions">
          {saveError && <span className="save-error">{saveError}</span>}
          {saved && <span className="save-ok">已保存</span>}
          <button className="settings-button ghost" onClick={() => window.focusMascot.closeSettings()}>
            关闭
          </button>
          <button className="settings-button primary" onClick={() => void save()}>
            保存设置
          </button>
        </div>
      </footer>
    </main>
  )
}
