import { segmentText } from './segmenter.js'

export interface DiffPart {
  text: string
  highlight: boolean
}

function extractWordSet(text: string, lang: string): Set<string> {
  const words = new Set<string>()
  for (const token of segmentText(text, lang)) {
    if (token.isWord) {
      words.add(token.text.toLowerCase())
    }
  }
  return words
}

function mergeDiffParts(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = []
  for (const part of parts) {
    const last = merged[merged.length - 1]
    if (last && last.highlight === part.highlight) {
      last.text += part.text
    } else {
      merged.push({ ...part })
    }
  }
  return merged
}

/**
 * Highlight word tokens in `alternative` that do not appear in `original`.
 * Compared against the local clause/sentence baseline — not LCS — so a word
 * like "errors" is highlighted when it is new to the selected context even if
 * the same token appears elsewhere in the full translation.
 */
export function diffHighlight(
  original: string,
  alternative: string,
  lang = 'en'
): DiffPart[] {
  if (!alternative) return []
  if (original === alternative) {
    return [{ text: alternative, highlight: false }]
  }

  const originalWords = extractWordSet(original, lang)
  const altTokens = segmentText(alternative, lang)

  const parts = altTokens.map((token) => ({
    text: token.text,
    highlight: token.isWord && !originalWords.has(token.text.toLowerCase()),
  }))

  return mergeDiffParts(parts)
}
