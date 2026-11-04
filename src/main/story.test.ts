import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StoryService } from './story'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meowmeow-story-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('StoryService', () => {
  it('creates a default story file and empty progress on first run', () => {
    const service = new StoryService(dir)

    expect(existsSync(join(dir, 'story.json'))).toBe(true)
    expect(service.getStory().character.name).toBe('小喵')
    expect(service.getStory().chapters.length).toBeGreaterThan(0)
    expect(service.getProgress()).toMatchObject({
      bond: 0,
      completedPomodoros: 0,
      storyIndex: 0
    })
  })

  it('reads progress files saved with a UTF-8 BOM', () => {
    writeFileSync(
      join(dir, 'progress.json'),
      `\uFEFF${JSON.stringify({
        bond: 10,
        completedPomodoros: 1,
        storyIndex: 1,
        lastCompletedAt: 1_700_000_000_000
      })}`,
      'utf8'
    )

    const service = new StoryService(dir)
    expect(service.getProgress()).toMatchObject({
      bond: 10,
      completedPomodoros: 1,
      storyIndex: 1
    })
  })

  it('sanitizes custom stories and clamps progress to available chapters', () => {
    writeFileSync(
      join(dir, 'story.json'),
      JSON.stringify({
        character: { name: '阿团' },
        breakLines: ['   ', '歇一会儿'],
        chapters: [
          { id: 'b', title: '后一段', bondRequired: 50, text: '后一段故事。' },
          { id: 'a', title: '前一段', bondRequired: 10, text: '前一段故事。' },
          { id: 'a', title: '重复', bondRequired: 20, text: '重复故事。' }
        ]
      }),
      'utf8'
    )
    writeFileSync(
      join(dir, 'progress.json'),
      JSON.stringify({ bond: 80, completedPomodoros: 8, storyIndex: 99 }),
      'utf8'
    )

    const service = new StoryService(dir)
    const story = service.getStory()

    expect(story.character.name).toBe('阿团')
    expect(story.character.title).toBe('自习室的常驻居民')
    expect(story.breakLines).toEqual(['歇一会儿'])
    expect(story.chapters.map((chapter) => chapter.id)).toEqual(['a', 'b'])
    expect(service.getProgress().storyIndex).toBe(2)

    service.saveProgress({
      bond: 80,
      completedPomodoros: 8,
      storyIndex: 10,
      lastCompletedAt: 1_700_000_000_000
    })
    const saved = JSON.parse(readFileSync(join(dir, 'progress.json'), 'utf8')) as {
      storyIndex: number
    }
    expect(saved.storyIndex).toBe(2)
  })
})
