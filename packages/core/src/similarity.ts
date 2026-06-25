function bigrams(text: string): Set<string> {
  const normalized = text.trim().toLowerCase()
  const set = new Set<string>()
  if (normalized.length < 2) {
    if (normalized.length === 1) set.add(normalized)
    return set
  }
  for (let i = 0; i < normalized.length - 1; i++) {
    set.add(normalized.slice(i, i + 2))
  }
  return set
}

/** Bigram Dice coefficient in [0, 1]. */
export function textSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.trim() || !b.trim()) return 0

  const bigramsA = bigrams(a)
  const bigramsB = bigrams(b)
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0

  let intersection = 0
  for (const gram of bigramsA) {
    if (bigramsB.has(gram)) intersection++
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size)
}
