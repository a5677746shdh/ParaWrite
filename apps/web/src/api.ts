/**
 * Browser API client. All requests use credentials: 'include' for TOTP and user session cookies.
 * SSE translation parses double-newline delimited events with data: JSON lines.
 */
import type {
  DictionaryEntry,
  HistoryPageResult,
  PublicMeta,
  PublicUserSummary,
  RephraseOption,
  SynonymOption,
  TranslationHistoryEntry,
} from '@parawrite/core/client'

const fetchOptions: RequestInit = { credentials: 'include' }

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}))
  return (data as { error?: string }).error ?? fallback
}

async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    const message = await parseApiError(res, fallback)
    throw new Error(message)
  }
}

export async function fetchMeta(): Promise<PublicMeta> {
  const res = await fetch('/api/meta', fetchOptions)
  await throwIfNotOk(res, 'Failed to load config')
  return res.json()
}

export async function verifyAccess(code: string, rememberMe = false): Promise<void> {
  const res = await fetch('/api/auth/verify', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, rememberMe }),
  })
  await throwIfNotOk(res, 'Invalid code')
}

export async function clearAccessAuth(): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    ...fetchOptions,
    method: 'POST',
  })
  await throwIfNotOk(res, 'Failed to clear access verification')
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
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })

  if (!res.ok) {
    await throwIfNotOk(res, 'Translation request failed')
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

export async function translateText(
  params: {
    text: string
    sourceLang: string
    targetLang: string
    provider: string
    model: string
  },
  signal?: AbortSignal
): Promise<string> {
  let result = ''
  await streamTranslate(params, (chunk) => {
    result += chunk
  }, signal)
  return result
}

export async function fetchSynonyms(
  params: {
    word: string
    sentence: string
    sourceText: string
    sourceLang: string
    targetLang: string
    provider: string
    model: string
  },
  signal?: AbortSignal
): Promise<SynonymOption[]> {
  const res = await fetch('/api/synonyms', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  await throwIfNotOk(res, 'Synonyms request failed')
  const data = await res.json()
  return data.synonyms ?? []
}

export async function fetchRephrase(
  params: {
    sentence: string
    sourceText: string
    fullTranslation: string
    sourceLang: string
    targetLang: string
    provider: string
    model: string
  },
  signal?: AbortSignal
): Promise<RephraseOption[]> {
  const res = await fetch('/api/rephrase', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  await throwIfNotOk(res, 'Rephrase request failed')
  const data = await res.json()
  return data.alternatives ?? []
}

export async function fetchDictionaryContext(
  params: {
    word: string
    sentence: string
    sourceText: string
    sourceLang: string
    targetLang: string
    uiLang: string
    provider: string
    model: string
  },
  signal?: AbortSignal
): Promise<DictionaryEntry | null> {
  const res = await fetch('/api/dictionary/context', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  await throwIfNotOk(res, 'Dictionary context failed')
  return res.json()
}

export async function restartServer(totpCode?: string): Promise<void> {
  const res = await fetch('/api/admin/restart', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(totpCode ? { totpCode } : {}),
  })
  await throwIfNotOk(res, 'Restart failed')
}

export async function registerUser(params: {
  username: string
  password: string
  nickname?: string
  rememberMe?: boolean
}): Promise<PublicUserSummary> {
  const res = await fetch('/api/user/register', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  await throwIfNotOk(res, 'Registration failed')
  const data = await res.json()
  return data.user
}

export async function loginUser(params: {
  username: string
  password: string
  rememberMe?: boolean
}): Promise<PublicUserSummary> {
  const res = await fetch('/api/user/login', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  await throwIfNotOk(res, 'Login failed')
  const data = await res.json()
  return data.user
}

export async function logoutUser(): Promise<void> {
  const res = await fetch('/api/user/logout', {
    ...fetchOptions,
    method: 'POST',
  })
  await throwIfNotOk(res, 'Logout failed')
}

export async function fetchHistory(
  filter: 'all' | 'favorites' = 'favorites',
  page = 1,
  pageSize?: number
): Promise<HistoryPageResult> {
  const params = new URLSearchParams({
    filter,
    page: String(page),
  })
  if (pageSize !== undefined) {
    params.set('pageSize', String(pageSize))
  }
  const res = await fetch(`/api/history?${params}`, fetchOptions)
  await throwIfNotOk(res, 'Failed to load history')
  return res.json()
}

export async function saveHistory(params: {
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
}): Promise<TranslationHistoryEntry> {
  const res = await fetch('/api/history', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  await throwIfNotOk(res, 'Failed to save history')
  const data = await res.json()
  return data.entry
}

export async function addHistoryFavorite(params: {
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
}): Promise<TranslationHistoryEntry> {
  const res = await fetch('/api/history/favorite', {
    ...fetchOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  await throwIfNotOk(res, 'Failed to add favorite')
  const data = await res.json()
  return data.entry
}

export async function toggleHistoryFavorite(id: number): Promise<TranslationHistoryEntry> {
  const res = await fetch(`/api/history/${id}/favorite`, {
    ...fetchOptions,
    method: 'PATCH',
  })
  await throwIfNotOk(res, 'Failed to toggle favorite')
  const data = await res.json()
  return data.entry
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const res = await fetch(`/api/history/${id}`, {
    ...fetchOptions,
    method: 'DELETE',
  })
  await throwIfNotOk(res, 'Failed to delete history entry')
}
