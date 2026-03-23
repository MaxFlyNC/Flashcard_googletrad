import Dexie, { Table } from 'dexie'
import { Flashcard, ReviewSession, UserProgress } from './types'
import { getInitialCardState } from './srs'

export class FlashDB extends Dexie {
  flashcards!: Table<Flashcard>
  sessions!: Table<ReviewSession>
  progress!: Table<UserProgress>

  constructor() {
    super('FlashCardTradDB')
    this.version(1).stores({
      flashcards: '++id, nextReview, sourceLang, targetLang, createdAt, repetitions',
      sessions: '++id, date',
      progress: '++id',
    })
  }
}

export const db = new FlashDB()

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getOrCreateProgress(): Promise<UserProgress> {
  const existing = await db.progress.toArray()
  if (existing.length > 0) return existing[0]

  const fresh: UserProgress = {
    totalXP: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    dailyGoal: 20,
    totalCardsReviewed: 0,
    totalCorrect: 0,
    achievements: [],
  }
  const id = await db.progress.add(fresh)
  return { ...fresh, id }
}

export async function updateProgress(partial: Partial<UserProgress>): Promise<void> {
  const prog = await getOrCreateProgress()
  await db.progress.update(prog.id!, partial)
}

export async function getDueCards(limit = 50): Promise<Flashcard[]> {
  const now = new Date()
  const all = await db.flashcards.toArray()
  return all
    .filter((c) => c.nextReview <= now)
    .sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime())
    .slice(0, limit)
}

export async function importCards(
  cards: Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'>[]
): Promise<{ imported: number; skipped: number }> {
  const existing = await db.flashcards.toArray()
  const existingSet = new Set(existing.map((c) => `${c.front}||${c.back}`))

  let imported = 0
  let skipped = 0

  for (const raw of cards) {
    const key = `${raw.front.trim()}||${raw.back.trim()}`
    if (existingSet.has(key)) {
      skipped++
      continue
    }
    await db.flashcards.add({
      ...raw,
      ...getInitialCardState(),
    })
    existingSet.add(key)
    imported++
  }

  return { imported, skipped }
}
