import type { DictionaryEntry, PublicMeta, RephraseOption, SynonymOption } from '@parawrite/core/client'

export async function fetchMeta(): Promise<PublicMeta> {
  const res = await fetch('/api/meta')
  if (!res.ok) throw new Error('Failed to load config')
  return res.json()
}

export async function streamTranslate(
  params: {
    text: string
    sourceLang: string
    targetLang: string
    provider: string
    model: string
  },
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!res.ok) {
    throw new Error('Translation request failed')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const dataLine = event.split('\n').find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      const data = dataLine.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data) as { content?: string; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.content) onChunk(parsed.content)
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
          throw e
        }
      }
    }
  }
}

export async function fetchSynonyms(params: {
  word: string
  sentence: string
  sourceText: string
  sourceLang: string
  targetLang: string
  provider: string
  model: string
}): Promise<SynonymOption[]> {
  const res = await fetch('/api/synonyms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Synonyms request failed')
  const data = await res.json()
  return data.synonyms ?? []
}

export async function fetchRephrase(params: {
  sentence: string
  sourceText: string
  fullTranslation: string
  sourceLang: string
  targetLang: string
  provider: string
  model: string
}): Promise<RephraseOption[]> {
  const res = await fetch('/api/rephrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Rephrase request failed')
  const data = await res.json()
  return data.alternatives ?? []
}

export async function fetchDictionary(
  lang: string,
  word: string
): Promise<DictionaryEntry | null> {
  const res = await fetch(`/api/dictionary/${lang}/${encodeURIComponent(word)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Dictionary lookup failed')
  return res.json()
}

export async function fetchDictionaryContext(params: {
  word: string
  sentence: string
  sourceText: string
  sourceLang: string
  targetLang: string
  uiLang: string
  provider: string
  model: string
}): Promise<DictionaryEntry | null> {
  const res = await fetch('/api/dictionary/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Dictionary context failed')
  return res.json()
}

export async function restartServer(): Promise<void> {
  const res = await fetch('/api/admin/restart', { method: 'POST' })
  if (!res.ok) throw new Error('Restart failed')
}
