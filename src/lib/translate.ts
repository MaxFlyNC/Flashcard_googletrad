/**
 * Translation service using MyMemory API (free, no key required)
 * Limit: ~1000 words/day per IP
 * Docs: https://mymemory.translated.net/doc/spec.php
 */

export interface TranslationResult {
  translatedText: string
  detectedSourceLang: string
}

/**
 * Translate text using MyMemory free API.
 * @param text - text to translate
 * @param sourceLang - ISO 639-1 code (e.g. 'en') or 'auto' for auto-detect
 * @param targetLang - ISO 639-1 code (e.g. 'fr')
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  const src = sourceLang === 'auto' ? 'en' : sourceLang
  const langpair = `${src}|${targetLang}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.responseStatus !== 200) {
    throw new Error(data.responseDetails || 'Translation failed')
  }

  const translatedText: string = data.responseData.translatedText

  // MyMemory returns the detected language in match data when langpair uses 'auto'
  const detectedSourceLang: string =
    data.matches?.[0]?.source || src

  return { translatedText, detectedSourceLang }
}
