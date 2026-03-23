import { Flashcard, SM2Rating } from './types'
import { addDays, startOfDay } from 'date-fns'

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo SM-2 (1987) with modern adjustments
 */
export function applyReview(card: Flashcard, rating: SM2Rating): Flashcard {
  let { easeFactor, interval, repetitions } = card

  if (rating >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  } else {
    // Incorrect response – reset
    repetitions = 0
    interval = 1
  }

  // Adjust ease factor: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  easeFactor = Math.max(1.3, easeFactor)

  const now = new Date()
  const nextReview = addDays(startOfDay(now), interval)

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    nextReview,
    lastReview: now,
    lastScore: rating,
  }
}

export function getInitialCardState(): Pick<Flashcard, 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'> {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date(), // due immediately
  }
}

export function isDue(card: Flashcard): boolean {
  return new Date() >= card.nextReview
}

export function getDueCount(cards: Flashcard[]): number {
  return cards.filter(isDue).length
}

/** XP earned per review based on rating and streak */
export function calculateXP(rating: SM2Rating, streak: number, isNewCard: boolean): number {
  const base = rating >= 4 ? 15 : rating >= 3 ? 10 : 3
  const streakBonus = Math.min(streak, 30) * 0.5 // up to +15 XP for long streaks
  const newCardBonus = isNewCard ? 5 : 0
  return Math.round(base + streakBonus + newCardBonus)
}

/** XP required to reach a given level */
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.4, level - 1))
}

/** Current level from total XP */
export function levelFromXP(totalXP: number): number {
  let level = 1
  let accumulated = 0
  while (accumulated + xpForLevel(level) <= totalXP) {
    accumulated += xpForLevel(level)
    level++
  }
  return level
}

/** XP progress within current level */
export function xpProgress(totalXP: number): { current: number; needed: number; percent: number } {
  let level = 1
  let accumulated = 0
  while (accumulated + xpForLevel(level) <= totalXP) {
    accumulated += xpForLevel(level)
    level++
  }
  const current = totalXP - accumulated
  const needed = xpForLevel(level)
  return { current, needed, percent: Math.round((current / needed) * 100) }
}

export function ratingLabel(rating: SM2Rating): { label: string; color: string; emoji: string } {
  const map: Record<SM2Rating, { label: string; color: string; emoji: string }> = {
    5: { label: 'Parfait', color: 'text-emerald-400', emoji: '🌟' },
    4: { label: 'Bien', color: 'text-green-400', emoji: '✅' },
    3: { label: 'Correct', color: 'text-yellow-400', emoji: '👍' },
    2: { label: 'Difficile', color: 'text-orange-400', emoji: '😅' },
    1: { label: 'Raté', color: 'text-red-400', emoji: '❌' },
    0: { label: 'Oublié', color: 'text-red-600', emoji: '💀' },
  }
  return map[rating]
}
