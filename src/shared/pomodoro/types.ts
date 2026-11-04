import type { FocusState } from '../focus/types'

export type PomodoroPhase = 'idle' | 'focus' | 'break' | 'long-break' | 'paused'

export interface StoryCharacter {
  name: string
  title: string
  description: string
  greeting: string
}

export interface StoryChapter {
  id: string
  title: string
  bondRequired: number
  text: string
}

export interface StoryData {
  character: StoryCharacter
  breakLines: string[]
  chapters: StoryChapter[]
}

export interface StoryProgress {
  bond: number
  completedPomodoros: number
  storyIndex: number
  lastCompletedAt: number | null
}

export interface PomodoroSnapshot {
  phase: PomodoroPhase
  previousPhase: PomodoroPhase
  remainingMs: number
  totalMs: number
  bond: number
  completedPomodoros: number
  storyIndex: number
  chapterCount: number
  currentChapter: StoryChapter | null
  nextChapter: StoryChapter | null
  nextBondRequired: number | null
  storyPath: string
  characterName: string
  focusState: FocusState
  suppressReminders: boolean
}

export type PomodoroEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'focus-completed'
  | 'break-ended'
  | 'progress-reset'

export interface PomodoroEvent {
  type: PomodoroEventType
  timestamp: number
  snapshot: PomodoroSnapshot
  message?: string
  chapter?: StoryChapter
  chapterIndex?: number
  breakLine?: string
}
