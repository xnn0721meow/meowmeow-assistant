import { EventEmitter } from 'node:events'
import type { AppSettings, FocusState } from '@shared/focus/types'
import type {
  PomodoroEvent,
  PomodoroEventType,
  PomodoroPhase,
  PomodoroSnapshot,
  StoryChapter,
  StoryData,
  StoryProgress
} from '@shared/pomodoro/types'

export interface StoryStore {
  getStory(): StoryData
  getProgress(): StoryProgress
  saveProgress(progress: StoryProgress): StoryProgress
  readonly storyPath: string
}

const BOND_PER_SESSION = 10

type ActivePhase = 'focus' | 'break' | 'long-break'

export class PomodoroEngine extends EventEmitter {
  private settings: AppSettings
  private story: StoryStore

  private phase: PomodoroPhase = 'idle'
  private previousPhase: PomodoroPhase = 'idle'
  private pausedPhase: ActivePhase = 'focus'
  private remainingMs: number
  private totalMs: number
  private lastTickAt: number | null = null
  private focusState: FocusState = 'unknown'

  constructor(settings: AppSettings, story: StoryStore) {
    super()
    this.settings = settings
    this.story = story
    this.totalMs = this.focusDurationMs()
    this.remainingMs = this.totalMs
  }

  getSnapshot(): PomodoroSnapshot {
    const data = this.story.getStory()
    const progress = this.story.getProgress()
    const currentChapter =
      progress.storyIndex > 0 ? data.chapters[progress.storyIndex - 1] ?? null : null
    const nextChapter = data.chapters[progress.storyIndex] ?? null

    return {
      phase: this.phase,
      previousPhase: this.previousPhase,
      remainingMs: Math.max(0, Math.round(this.remainingMs)),
      totalMs: Math.max(0, Math.round(this.totalMs)),
      bond: progress.bond,
      completedPomodoros: progress.completedPomodoros,
      storyIndex: progress.storyIndex,
      chapterCount: data.chapters.length,
      currentChapter,
      nextChapter,
      nextBondRequired: nextChapter ? nextChapter.bondRequired : null,
      storyPath: this.story.storyPath,
      characterName: data.character.name,
      focusState: this.focusState,
      suppressReminders:
        this.phase === 'break' || this.phase === 'long-break' || this.phase === 'paused'
    }
  }

  emitSnapshot(): void {
    this.emit('snapshot', this.getSnapshot())
  }

  setFocusState(state: FocusState, paused: boolean): void {
    this.focusState = paused ? 'paused' : state
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    if (this.phase === 'idle') {
      this.totalMs = this.focusDurationMs()
      this.remainingMs = this.totalMs
    }
    this.emitSnapshot()
  }

  start(now = Date.now()): PomodoroEvent | null {
    if (this.phase !== 'idle') return null

    const character = this.story.getStory().character
    const duration = this.focusDurationMs()

    this.previousPhase = 'idle'
    this.phase = 'focus'
    this.totalMs = duration
    this.remainingMs = duration
    this.lastTickAt = now

    return this.publish('started', now, {
      message: `开始专注 ${this.settings.pomodoroFocusMinutes} 分钟。${character.name}会陪着你。`
    })
  }

  pause(now = Date.now()): PomodoroEvent | null {
    if (this.phase === 'idle' || this.phase === 'paused') return null

    this.pausedPhase = this.phase
    this.previousPhase = this.phase
    this.phase = 'paused'
    this.lastTickAt = now

    return this.publish('paused', now, { message: '计时已暂停，准备好再继续。' })
  }

  resume(now = Date.now()): PomodoroEvent | null {
    if (this.phase !== 'paused') return null

    this.previousPhase = 'paused'
    this.phase = this.pausedPhase
    this.lastTickAt = now

    return this.publish('resumed', now, {
      message: this.pausedPhase === 'focus' ? '继续专注。' : '继续休息。'
    })
  }

  stop(now = Date.now()): PomodoroEvent | null {
    if (this.phase === 'idle') return null

    this.previousPhase = this.phase
    this.phase = 'idle'
    this.totalMs = this.focusDurationMs()
    this.remainingMs = this.totalMs
    this.lastTickAt = null

    return this.publish('stopped', now, {
      message: '这一轮先到这里，准备好再开始。'
    })
  }

  skipBreak(now = Date.now()): PomodoroEvent | null {
    if (this.phase !== 'break' && this.phase !== 'long-break') return null
    return this.endBreak(now, true)
  }

  resetProgress(now = Date.now()): PomodoroEvent | null {
    this.previousPhase = this.phase
    this.phase = 'idle'
    this.totalMs = this.focusDurationMs()
    this.remainingMs = this.totalMs
    this.lastTickAt = null

    this.story.saveProgress({
      bond: 0,
      completedPomodoros: 0,
      storyIndex: 0,
      lastCompletedAt: null
    })
    const name = this.story.getStory().character.name

    return this.publish('progress-reset', now, {
      message: `关系值和故事进度已归零，${name}会在第一段故事重新等你。`
    })
  }

  /**
   * Timestamp-driven tick. Focus time only advances while the focus state is
   * `focused`; breaks always use wall-clock time.
   */
  tick(now = Date.now()): PomodoroEvent | null {
    if (this.phase === 'idle' || this.phase === 'paused') return null

    const last = this.lastTickAt ?? now
    const delta = Math.max(0, now - last)
    this.lastTickAt = now

    if (this.phase === 'focus') {
      if (this.focusState === 'focused' && delta > 0) {
        this.remainingMs = Math.max(0, this.remainingMs - delta)
        if (this.remainingMs <= 0) return this.completeFocus(now)
      }
    } else if (delta > 0) {
      this.remainingMs = Math.max(0, this.remainingMs - delta)
      if (this.remainingMs <= 0) return this.endBreak(now, false)
    }

    this.emitSnapshot()
    return null
  }

  private completeFocus(now: number): PomodoroEvent {
    const data = this.story.getStory()
    const current = this.story.getProgress()
    const completedPomodoros = current.completedPomodoros + 1
    const bond = current.bond + BOND_PER_SESSION
    let storyIndex = current.storyIndex
    let chapter: StoryChapter | undefined

    if (storyIndex < data.chapters.length && bond >= data.chapters[storyIndex].bondRequired) {
      chapter = data.chapters[storyIndex]
      storyIndex += 1
    }

    const progress = this.story.saveProgress({
      bond,
      completedPomodoros,
      storyIndex,
      lastCompletedAt: now
    })

    const every = Math.max(1, this.settings.pomodoroLongBreakEvery)
    const isLong = completedPomodoros % every === 0
    const duration = isLong ? this.longBreakDurationMs() : this.breakDurationMs()

    this.previousPhase = 'focus'
    this.phase = isLong ? 'long-break' : 'break'
    this.totalMs = duration
    this.remainingMs = duration
    this.lastTickAt = now

    const breakLine =
      data.breakLines.length > 0
        ? data.breakLines[(completedPomodoros - 1) % data.breakLines.length]
        : '先休息一下。'

    return this.publish('focus-completed', now, {
      message: chapter
        ? `专注完成，关系值 +${BOND_PER_SESSION}。${data.character.name}想和你分享一段新的故事。`
        : `专注完成，关系值 +${BOND_PER_SESSION}。${breakLine}`,
      chapter,
      chapterIndex: chapter ? progress.storyIndex : undefined,
      breakLine
    })
  }

  private endBreak(now: number, skipped: boolean): PomodoroEvent {
    const wasLong = this.phase === 'long-break'
    this.previousPhase = this.phase
    this.phase = 'idle'
    this.totalMs = this.focusDurationMs()
    this.remainingMs = this.totalMs
    this.lastTickAt = null

    return this.publish('break-ended', now, {
      message: skipped
        ? '休息结束，准备好就再开一轮。'
        : wasLong
          ? '长休息结束，状态回来了就继续。'
          : '休息结束，准备好就再开一轮。'
    })
  }

  private focusDurationMs(): number {
    return this.settings.pomodoroFocusMinutes * 60_000
  }

  private breakDurationMs(): number {
    return this.settings.pomodoroBreakMinutes * 60_000
  }

  private longBreakDurationMs(): number {
    return this.settings.pomodoroLongBreakMinutes * 60_000
  }

  private publish(
    type: PomodoroEventType,
    timestamp: number,
    extra: Partial<PomodoroEvent> = {}
  ): PomodoroEvent {
    const snapshot = this.getSnapshot()
    const event: PomodoroEvent = { type, timestamp, snapshot, ...extra }
    this.emit('event', event)
    this.emit('snapshot', snapshot)
    return event
  }
}
