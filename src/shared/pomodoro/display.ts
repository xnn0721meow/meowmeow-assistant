import type { PomodoroPhase, PomodoroSnapshot } from './types'

export function pomodoroPhaseLabel(phase: PomodoroPhase): string {
  switch (phase) {
    case 'focus':
      return '专注中'
    case 'break':
      return '短休息'
    case 'long-break':
      return '长休息'
    case 'paused':
      return '已暂停'
    default:
      return '准备开始'
  }
}

export function formatPomodoroClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const EMPTY_POMODORO_SNAPSHOT: PomodoroSnapshot = {
  phase: 'idle',
  previousPhase: 'idle',
  remainingMs: 0,
  totalMs: 0,
  bond: 0,
  completedPomodoros: 0,
  storyIndex: 0,
  chapterCount: 0,
  currentChapter: null,
  nextChapter: null,
  nextBondRequired: null,
  storyPath: '',
  characterName: '小喵',
  focusState: 'unknown',
  suppressReminders: false
}
