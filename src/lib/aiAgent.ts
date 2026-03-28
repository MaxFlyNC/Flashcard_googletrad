/**
 * AI Agent — enrichit les flashcards via l'API Claude (Anthropic).
 * La clé API est fournie par l'utilisateur et stockée localement (localStorage).
 * Utilise claude-haiku pour la rapidité et le coût minimal.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const STORAGE_KEY = 'claude_api_key'

// ─── Clé API ──────────────────────────────────────────────────────────────────

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

export function saveApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey())
}

// ─── Enrichissement d'une carte ───────────────────────────────────────────────

export interface EnrichmentResult {
  context: string      // phrase d'exemple dans la langue source
}

export async function enrichCard(
  front: string,
  back: string,
  sourceLang: string,
  targetLang: string
): Promise<EnrichmentResult> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Clé API manquante')

  const prompt = `You are a language learning expert. Given this word/phrase pair:
- Word in ${sourceLang}: "${front}"
- Translation in ${targetLang}: "${back}"

Write ONE short example sentence (max 80 characters) in ${sourceLang} that uses "${front}" naturally in context. This helps learners remember the word.

Respond with ONLY a JSON object like: {"context": "example sentence here"}
No explanation, no markdown, just the JSON.`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
      `Erreur API ${response.status}`
    )
  }

  const data = await response.json()
  const text: string = data.content?.[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(text) as { context?: string }
    return { context: parsed.context ?? text }
  } catch {
    return { context: text }
  }
}
