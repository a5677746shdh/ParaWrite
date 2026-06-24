import { getLangName } from './types.js'

export function buildTranslatePrompt(
  text: string,
  sourceLang: string,
  targetLang: string
): { system: string; user: string } {
  const sourceName = sourceLang === 'auto' ? 'the source language' : getLangName(sourceLang)
  const targetName = getLangName(targetLang)

  return {
    system: `You are a professional translator. Translate accurately and naturally. Output only the translation without explanations or notes.`,
    user: `Translate the following text from ${sourceName} to ${targetName}. Return only the translation:\n\n${text}`,
  }
}

export function buildSynonymsPrompt(
  word: string,
  sentence: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string
): { system: string; user: string } {
  const targetName = getLangName(targetLang)

  return {
    system: `You are a bilingual lexicographer. Suggest context-aware synonyms in ${targetName}. Respond with valid JSON only.`,
    user: `Source text: ${sourceText}
Translated sentence: ${sentence}
Selected word/phrase: "${word}"

Return JSON: {"synonyms":[{"word":"...","note":"brief usage note"}]}
Provide 3-5 synonyms that fit this context. Keep notes concise.`,
  }
}

export function buildRephrasePrompt(
  sentence: string,
  sourceText: string,
  fullTranslation: string,
  sourceLang: string,
  targetLang: string
): { system: string; user: string } {
  const targetName = getLangName(targetLang)

  return {
    system: `You are a professional editor. Suggest alternative phrasings in ${targetName}. Respond with valid JSON only.`,
    user: `Source text: ${sourceText}
Full translation: ${fullTranslation}
Sentence to rephrase: ${sentence}

Return JSON: {"alternatives":[{"text":"...","style":"formal|neutral|concise"}]}
Provide 2-3 alternatives preserving the original meaning.`,
  }
}

export function buildDictionaryContextPrompt(
  word: string,
  sentence: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  definitionLang: string
): { system: string; user: string } {
  const targetName = getLangName(targetLang)
  const definitionName = getLangName(definitionLang)
  const bilingual = definitionLang !== targetLang

  return {
    system: `You are a bilingual dictionary assistant. Explain words in context. Respond with valid JSON only.`,
    user: `Source: ${sourceText}
Translation: ${sentence}
Word: "${word}"
Word language: ${targetName}
${bilingual ? `Write all definitions and notes in ${definitionName} (bilingual dictionary style).` : `Write all definitions in ${targetName}.`}

Return JSON: {"word":"...","phonetic":"...","meanings":[{"partOfSpeech":"...","definition":"...","example":"..."}]}`,
  }
}

export function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON from model response')
  }
  return JSON.parse(jsonMatch[0]) as T
}
