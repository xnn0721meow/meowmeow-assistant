import { describe, expect, it } from 'vitest'
import type { AppSettings } from '@shared/focus/types'
import type {
  PomodoroEvent,
  StoryData,
  StoryProgress
} from '@shared/pomodoro/types'
import { PomodoroEngine, type StoryStore } from './pomodoroEngine'

const story: StoryData = {
  character: {
    name: '小喵',
    title: '自习室的常驻居民',
    description: '测试用角色',
    greeting: '一起坐一会儿吧。'
  },
  breakLines: ['先喝口水。'],
  chapters: [
    { id: 'c1', title: '第一段', bondRequired: 10, text: '第一段故事。' },
    { id: 'c2', title: '第二段', bondRequired: 20, text: '第二段故事。' }
  ]
}

class MemoryStoryStore implements StoryStore {
  readonly storyPath = 'story.json'
  private story: StoryData
  private progress: StoryProgress

  constructor(story: StoryData, progress: Partial<StoryProgress> = {}) {
    this.story = story
    this.progress = {
      bond: 0,
      completedPomodoros: 0,
      storyIndex: 0,
      lastCompletedAt: null,
      ...progress
    }
  }

  getStory(): StoryData {
    return this.story
  }

  getProgress(): StoryProgress {
    return this.progress
  }

  saveProgress(next: StoryProgress): StoryProgress {
    this.progress = {
      ...next,
      storyIndex: Math.min(next.storyIndex, this.story.chapters.length)
    }
    return { ...this.progress }
  }
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    activityTrackingEnabled: true,
    reminderSensitivity: 'normal',
    maxRemindersPerHour: 3,
    blockedApps: [],
    pomodoroFocusMinutes: 25,
    pomodoroBreakMinutes: 5,
    pomodoroLongBreakMinutes: 15,
    pomodoroLongBreakEvery: 4,
    live2dModelPath: null,
    avatarScale: 1,
    avatarPosition: null,
    ...overrides
  }
}

describe('PomodoroEngine', () => {
  it('advances focus time only while the focus state is focused', () => {
    const engine = new PomodoroEngine(makeSettings(), new MemoryStoryStore(story))

    engine.start(0)
    engine.tick(60_000)
    expect(engine.getSnapshot().remainingMs).toBe(25 * 60_000)

    engine.setFocusState('focused', false)
    engine.tick(120_000)
    expect(engine.getSnapshot().remainingMs).toBe(24 * 60_000)
  })

  it('awards bond, unlocks one chapter and starts a break on completion', () => {
    const store = new MemoryStoryStore(story)
    const engine = new PomodoroEngine(makeSettings(), store)
    const events: PomodoroEvent[] = []
    engine.on('event', (event: PomodoroEvent) => events.push(event))

    engine.setFocusState('focused', false)
    engine.start(0)
    const completed = engine.tick(25 * 60_000)

    expect(completed?.type).toBe('focus-completed')
    expect(completed?.chapter?.id).toBe('c1')
    expect(completed?.chapterIndex).toBe(1)
    expect(completed?.snapshot.phase).toBe('break')
    expect(completed?.snapshot.remainingMs).toBe(5 * 60_000)
    expect(store.getProgress()).toMatchObject({
      bond: 10,
      completedPomodoros: 1,
      storyIndex: 1
    })
    expect(events.map((event) => event.type)).toEqual(['started', 'focus-completed'])
  })

  it('unlocks at most one chapter per completed focus session', () => {
    const denseStory: StoryData = {
      ...story,
      chapters: [
        { id: 'c1', title: '第一段', bondRequired: 5, text: '第一段故事。' },
        { id: 'c2', title: '第二段', bondRequired: 10, text: '第二段故事。' }
      ]
    }
    const store = new MemoryStoryStore(denseStory)
    const engine = new PomodoroEngine(makeSettings(), store)

    engine.setFocusState('focused', false)
    engine.start(0)
    engine.tick(25 * 60_000)
    expect(store.getProgress().storyIndex).toBe(1)

    engine.skipBreak(25 * 60_000)
    engine.start(25 * 60_000)
    engine.tick(50 * 60_000)
    expect(store.getProgress().storyIndex).toBe(2)
  })

  it('uses a long break every configured number of sessions', () => {
    const store = new MemoryStoryStore(story, {
      bond: 10,
      completedPomodoros: 1,
      storyIndex: 1
    })
    const engine = new PomodoroEngine(
      makeSettings({ pomodoroLongBreakEvery: 2, pomodoroLongBreakMinutes: 15 }),
      store
    )

    engine.setFocusState('focused', false)
    engine.start(0)
    const completed = engine.tick(25 * 60_000)

    expect(completed?.snapshot.phase).toBe('long-break')
    expect(completed?.snapshot.remainingMs).toBe(15 * 60_000)
    expect(store.getProgress().completedPomodoros).toBe(2)
  })

  it('keeps counting breaks on wall-clock time even when focus is lost', () => {
    const engine = new PomodoroEngine(makeSettings(), new MemoryStoryStore(story))

    engine.setFocusState('focused', false)
    engine.start(0)
    engine.tick(25 * 60_000)

    engine.setFocusState('away', false)
    engine.tick(25 * 60_000 + 60_000)
    expect(engine.getSnapshot().remainingMs).toBe(4 * 60_000)
  })

  it('freezes the countdown while paused and resumes from the same point', () => {
    const engine = new PomodoroEngine(makeSettings(), new MemoryStoryStore(story))

    engine.setFocusState('focused', false)
    engine.start(0)
    engine.tick(60_000)
    expect(engine.getSnapshot().remainingMs).toBe(24 * 60_000)

    engine.pause(60_000)
    expect(engine.getSnapshot().phase).toBe('paused')
    engine.tick(120_000)
    expect(engine.getSnapshot().remainingMs).toBe(24 * 60_000)

    engine.resume(120_000)
    engine.tick(180_000)
    expect(engine.getSnapshot().phase).toBe('focus')
    expect(engine.getSnapshot().remainingMs).toBe(23 * 60_000)
  })

  it('returns to idle when a break is skipped', () => {
    const engine = new PomodoroEngine(makeSettings(), new MemoryStoryStore(story))

    engine.setFocusState('focused', false)
    engine.start(0)
    engine.tick(25 * 60_000)

    const event = engine.skipBreak(25 * 60_000)
    expect(event?.type).toBe('break-ended')
    expect(engine.getSnapshot().phase).toBe('idle')
    expect(engine.getSnapshot().remainingMs).toBe(25 * 60_000)
  })

  it('applies new durations while idle and resets story progress', () => {
    const store = new MemoryStoryStore(story, {
      bond: 20,
      completedPomodoros: 2,
      storyIndex: 2
    })
    const engine = new PomodoroEngine(makeSettings(), store)

    engine.updateSettings(makeSettings({ pomodoroFocusMinutes: 40 }))
    expect(engine.getSnapshot().remainingMs).toBe(40 * 60_000)

    const event = engine.resetProgress(0)
    expect(event?.type).toBe('progress-reset')
    expect(store.getProgress()).toMatchObject({
      bond: 0,
      completedPomodoros: 0,
      storyIndex: 0,
      lastCompletedAt: null
    })
    expect(engine.getSnapshot().phase).toBe('idle')
  })
})
