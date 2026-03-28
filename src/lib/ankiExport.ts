import { Flashcard } from './types'

/**
 * Génère un fichier texte compatible avec l'import natif d'Anki.
 *
 * Import dans Anki :
 *   Fichier → Importer → sélectionnez le fichier .txt
 *   → Séparateur : Tabulation → Importer
 */
export function generateAnkiTSV(
  cards: Flashcard[],
  deckName = 'FlashCardTrad'
): string {
  const sanitize = (s: string) =>
    s.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>')

  const lines: string[] = [
    '#separator:tab',
    '#html:true',
    '#notetype:Basic',
    `#deck:${deckName}`,
    '#columns:Front\tBack\tTags',
    '',
  ]

  for (const card of cards) {
    const front = sanitize(card.front)
    const back = sanitize(card.back)
    const contextLine = card.context ? `<br><em>${sanitize(card.context)}</em>` : ''
    const tags = `${card.sourceLang}-${card.targetLang}`
    lines.push(`${front}\t${back}${contextLine}\t${tags}`)
  }

  return lines.join('\n')
}

/**
 * Déclenche le téléchargement d'un fichier dans le navigateur.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Filtres optionnels pour l'export.
 */
export interface ExportFilter {
  sourceLang?: string
  targetLang?: string
}

export function filterCards(cards: Flashcard[], filter: ExportFilter): Flashcard[] {
  return cards.filter(c => {
    if (filter.sourceLang && c.sourceLang !== filter.sourceLang) return false
    if (filter.targetLang && c.targetLang !== filter.targetLang) return false
    return true
  })
}
