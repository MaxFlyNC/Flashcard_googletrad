// ─── Flashcard ────────────────────────────────────────────────────────────────
export interface Flashcard {
  id?: number
  front: string          // source text (langue d'origine)
  back: string           // translated text
  sourceLang: string     // 'fr', 'en', 'es', etc.
  targetLang: string
  context?: string       // optional example sentence
  tags?: string[]
  createdAt: Date
  importedFrom?: 'google_takeout' | 'manual'

  // SM-2 fields
  easeFactor: number     // ≥ 1.3, starts at 2.5
  interval: number       // days until next review
  repetitions: number    // number of successful repetitions
  nextReview: Date
  lastReview?: Date
  lastScore?: number     // 0–5
}

// ─── Review Session ───────────────────────────────────────────────────────────
export interface ReviewSession {
  id?: number
  date: Date
  cardsReviewed: number
  correctCount: number
  xpEarned: number
  durationSeconds: number
}

// ─── User Progress ────────────────────────────────────────────────────────────
export interface UserProgress {
  id?: number
  totalXP: number
  level: number
  streak: number               // days in a row
  longestStreak: number
  lastStudyDate?: Date
  dailyGoal: number            // cards per day
  totalCardsReviewed: number
  totalCorrect: number
  achievements: string[]       // achievement ids
}

// ─── Achievement ──────────────────────────────────────────────────────────────
export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  condition: (progress: UserProgress, stats: { totalCards: number }) => boolean
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

// ─── SM-2 Rating ──────────────────────────────────────────────────────────────
export type SM2Rating = 0 | 1 | 2 | 3 | 4 | 5
// 0: blackout, 1: wrong, 2: wrong but remembered, 3: correct difficult, 4: correct, 5: perfect
