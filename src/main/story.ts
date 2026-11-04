import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { StoryChapter, StoryData, StoryProgress } from '@shared/pomodoro/types'
import { DEFAULT_STORY } from './defaultStory'

const EMPTY_PROGRESS: StoryProgress = {
  bond: 0,
  completedPomodoros: 0,
  storyIndex: 0,
  lastCompletedAt: null
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : fallback
}

function sanitizeChapter(input: unknown): StoryChapter | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const id = asText(raw.id, '')
  const title = asText(raw.title, '')
  const text = asText(raw.text, '')
  if (!id || !title || !text) return null
  return {
    id,
    title,
    bondRequired: asNumber(raw.bondRequired, 0),
    text
  }
}

function sanitizeStory(input: unknown): StoryData | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const rawCharacter =
    raw.character && typeof raw.character === 'object'
      ? (raw.character as Record<string, unknown>)
      : {}
  const fallbackCharacter = DEFAULT_STORY.character

  const character = {
    name: asText(rawCharacter.name, fallbackCharacter.name),
    title: asText(rawCharacter.title, fallbackCharacter.title),
    description: asText(rawCharacter.description, fallbackCharacter.description),
    greeting: asText(rawCharacter.greeting, fallbackCharacter.greeting)
  }

  const breakLines = Array.isArray(raw.breakLines)
    ? raw.breakLines
        .filter((line): line is string => typeof line === 'string' && Boolean(line.trim()))
        .map((line) => line.trim())
    : []
  if (breakLines.length === 0) breakLines.push(...DEFAULT_STORY.breakLines)

  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters
        .map(sanitizeChapter)
        .filter((chapter): chapter is StoryChapter => chapter !== null)
        .sort((a, b) => a.bondRequired - b.bondRequired)
    : []
  if (chapters.length === 0) return null

  const seen = new Set<string>()
  const uniqueChapters = chapters.filter((chapter) => {
    if (seen.has(chapter.id)) return false
    seen.add(chapter.id)
    return true
  })

  return { character, breakLines, chapters: uniqueChapters }
}

function sanitizeProgress(input: unknown, chapterCount: number): StoryProgress {
  if (!input || typeof input !== 'object') return { ...EMPTY_PROGRESS }
  const raw = input as Record<string, unknown>
  return {
    bond: asNumber(raw.bond, 0),
    completedPomodoros: asNumber(raw.completedPomodoros, 0),
    storyIndex: Math.min(chapterCount, asNumber(raw.storyIndex, 0)),
    lastCompletedAt:
      typeof raw.lastCompletedAt === 'number' && Number.isFinite(raw.lastCompletedAt)
        ? raw.lastCompletedAt
        : null
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temp, path)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as unknown
}

export class StoryService {
  private readonly dir: string
  private story: StoryData
  private progress: StoryProgress

  constructor(dir: string) {
    this.dir = dir
    this.ensureStoryFile()
    this.story = this.readStory()
    this.progress = this.readProgress()
  }

  get storyPath(): string {
    return join(this.dir, 'story.json')
  }

  get progressPath(): string {
    return join(this.dir, 'progress.json')
  }

  getStory(): StoryData {
    return this.story
  }

  getProgress(): StoryProgress {
    return this.progress
  }

  saveProgress(next: StoryProgress): StoryProgress {
    const clean = sanitizeProgress(next, this.story.chapters.length)
    this.progress = clean
    try {
      writeJson(this.progressPath, clean)
    } catch (error) {
      console.warn('Could not save story progress:', error)
    }
    return { ...clean }
  }

  resetProgress(): StoryProgress {
    return this.saveProgress({ ...EMPTY_PROGRESS })
  }

  ensureStoryFile(): void {
    if (existsSync(this.storyPath)) return
    try {
      writeJson(this.storyPath, DEFAULT_STORY)
    } catch (error) {
      console.warn('Could not create story file:', error)
    }
  }

  private readStory(): StoryData {
    try {
      const parsed = readJson(this.storyPath)
      return sanitizeStory(parsed) ?? { ...DEFAULT_STORY }
    } catch (error) {
      console.warn('Could not read story.json, using built-in story:', error)
      return { ...DEFAULT_STORY }
    }
  }

  private readProgress(): StoryProgress {
    try {
      if (!existsSync(this.progressPath)) return { ...EMPTY_PROGRESS }
      const parsed = readJson(this.progressPath)
      return sanitizeProgress(parsed, this.story.chapters.length)
    } catch (error) {
      console.warn('Could not read story progress:', error)
      return { ...EMPTY_PROGRESS }
    }
  }
}
