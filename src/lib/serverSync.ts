/**
 * Synchronisation avec l'API backend FlashCardTrad.
 * L'API est peuplée par n8n après enrichissement Claude.
 *
 * En développement : http://localhost:4000
 * En production    : /api  (proxy Nginx → conteneur flashcardtrad-api)
 */

import { db } from './db'
import { getInitialCardState } from './srs'

// En dev : API locale sur 4000, en prod : proxy Nginx via /api
const API_BASE =
  (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:4000/api'
    : '/api'

export interface ServerCard {
  id: number
  front: string
  back: string
  source_lang: string
  target_lang: string
  context: string | null
  tags: string | null
  created_at: string
  imported_from: string
}

/**
 * Récupère les cartes enrichies par n8n depuis l'API backend
 * et les importe dans IndexedDB en évitant les doublons.
 */
export async function syncFromServer(): Promise<{ imported: number; skipped: number }> {
  const response = await fetch(`${API_BASE}/flashcards`)
  if (!response.ok) throw new Error(`Erreur API: ${response.status}`)

  const data = await response.json() as { cards: ServerCard[]; total: number }
  const serverCards = data.cards

  const existing = await db.flashcards.toArray()
  const existingSet = new Set(existing.map(c => `${c.front}||${c.back}`))

  let imported = 0
  let skipped = 0

  for (const sc of serverCards) {
    const key = `${sc.front}||${sc.back}`
    if (existingSet.has(key)) { skipped++; continue }

    await db.flashcards.add({
      front: sc.front,
      back: sc.back,
      sourceLang: sc.source_lang,
      targetLang: sc.target_lang,
      context: sc.context ?? undefined,
      createdAt: new Date(sc.created_at),
      importedFrom: 'manual',
      ...getInitialCardState(),
    })

    existingSet.add(key)
    imported++
  }

  return { imported, skipped }
}

/**
 * Vérifie que l'API est joignable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}
