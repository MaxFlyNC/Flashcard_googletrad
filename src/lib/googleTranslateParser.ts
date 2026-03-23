import { Flashcard } from './types'

// ─── Types from Google Takeout formats ────────────────────────────────────────

interface TakeoutEntry {
  sourceText?: string
  translationText?: string
  translatedText?: string
  sourceLanguage?: string
  targetLanguage?: string
  sourceLang?: string
  targetLang?: string
  timestamp?: string
  timeUsec?: number
  'source-text'?: string
  'translated-text'?: string
  'source-language'?: string
  'target-language'?: string
}

interface TakeoutRoot {
  data?: TakeoutEntry[]
  history?: TakeoutEntry[]
  translations?: TakeoutEntry[]
  // sometimes root is an array
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseGoogleTakeout(json: unknown): Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'>[] {
  const results: Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'>[] = []

  let entries: TakeoutEntry[] = []

  if (Array.isArray(json)) {
    entries = json as TakeoutEntry[]
  } else if (json && typeof json === 'object') {
    const root = json as TakeoutRoot
    entries = root.data ?? root.history ?? root.translations ?? []

    // Some formats wrap in nested structure
    if (entries.length === 0) {
      for (const key of Object.keys(root)) {
        const val = (root as Record<string, unknown>)[key]
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          entries = val as TakeoutEntry[]
          break
        }
      }
    }
  }

  for (const entry of entries) {
    const front = (
      entry.sourceText ??
      entry['source-text'] ??
      ''
    ).trim()

    const back = (
      entry.translationText ??
      entry.translatedText ??
      entry['translated-text'] ??
      ''
    ).trim()

    const sourceLang = (
      entry.sourceLanguage ??
      entry.sourceLang ??
      entry['source-language'] ??
      'auto'
    ).toLowerCase()

    const targetLang = (
      entry.targetLanguage ??
      entry.targetLang ??
      entry['target-language'] ??
      'fr'
    ).toLowerCase()

    if (!front || !back) continue
    if (front.length > 500 || back.length > 500) continue // skip long paragraphs
    if (front === back) continue // skip no-op translations

    let createdAt = new Date()
    if (entry.timestamp) {
      const d = new Date(entry.timestamp)
      if (!isNaN(d.getTime())) createdAt = d
    } else if (entry.timeUsec) {
      createdAt = new Date(entry.timeUsec / 1000)
    }

    results.push({
      front,
      back,
      sourceLang,
      targetLang,
      createdAt,
      importedFrom: 'google_takeout',
    })
  }

  return results
}

/** Parse plain text "word = traduction" or TSV format */
export function parsePlainText(text: string): Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'>[] {
  const results: Omit<Flashcard, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'>[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    let front = ''
    let back = ''

    if (line.includes('\t')) {
      const parts = line.split('\t')
      front = parts[0].trim()
      back = parts[1]?.trim() ?? ''
    } else if (line.includes(' = ')) {
      const parts = line.split(' = ')
      front = parts[0].trim()
      back = parts[1]?.trim() ?? ''
    } else if (line.includes(' - ')) {
      const parts = line.split(' - ')
      front = parts[0].trim()
      back = parts[1]?.trim() ?? ''
    } else if (line.includes(';')) {
      const parts = line.split(';')
      front = parts[0].trim()
      back = parts[1]?.trim() ?? ''
    }

    if (front && back) {
      results.push({
        front,
        back,
        sourceLang: 'auto',
        targetLang: 'fr',
        createdAt: new Date(),
        importedFrom: 'manual',
      })
    }
  }

  return results
}

export const LANGUAGE_NAMES: Record<string, string> = {
  fr: '🇫🇷 Français',
  en: '🇬🇧 English',
  es: '🇪🇸 Español',
  de: '🇩🇪 Deutsch',
  it: '🇮🇹 Italiano',
  pt: '🇵🇹 Português',
  ja: '🇯🇵 日本語',
  zh: '🇨🇳 中文',
  ko: '🇰🇷 한국어',
  ar: '🇸🇦 العربية',
  ru: '🇷🇺 Русский',
  nl: '🇳🇱 Nederlands',
  pl: '🇵🇱 Polski',
  sv: '🇸🇪 Svenska',
  da: '🇩🇰 Dansk',
  fi: '🇫🇮 Suomi',
  nb: '🇳🇴 Norsk',
  tr: '🇹🇷 Türkçe',
  auto: '🌐 Auto',
}

export function langName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase()
}
