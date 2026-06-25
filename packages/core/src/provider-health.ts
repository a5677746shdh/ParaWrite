/**
 * Startup model availability checks (non-blocking).
 * Lists models from each provider when possible; falls back to a minimal chat probe.
 * Runs after serve() so HTTP is available immediately.
 */
import type { AppConfig, ProviderConfig, ProviderType } from './types.js'
import { createProxiedFetch, type EngineFetch } from './proxy-fetch.js'

const CHECK_TIMEOUT_MS = 15_000

export interface ModelAvailabilityResult {
  providerId: string
  modelId: string
  modelName: string
  available: boolean
  detail: string
  latencyMs: number
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

function summarizeHttpError(status: number, body: string): string {
  const trimmed = body.replace(/\s+/g, ' ').trim().slice(0, 160)
  return trimmed ? `HTTP ${status}: ${trimmed}` : `HTTP ${status}`
}

function summarizeFetchError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? err.cause.message : undefined
    return cause ? `${err.message} (${cause})` : err.message
  }
  return String(err)
}

async function fetchWithTimeout(
  fetch: EngineFetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  })
}

async function listOpenAiCompatibleModels(
  provider: ProviderConfig,
  fetch: EngineFetch
): Promise<Set<string> | null> {
  const url = `${trimBaseUrl(provider.base_url)}/models`
  const response = await fetchWithTimeout(fetch, url, {
    method: 'GET',
    headers: provider.api_key ? { Authorization: `Bearer ${provider.api_key}` } : {},
  })
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as { data?: Array<{ id?: string }> }
  const ids = new Set<string>()
  for (const item of data.data ?? []) {
    if (item.id) ids.add(item.id)
  }
  return ids
}

async function listOllamaModels(
  provider: ProviderConfig,
  fetch: EngineFetch
): Promise<Set<string> | null> {
  const url = `${trimBaseUrl(provider.base_url)}/api/tags`
  const response = await fetchWithTimeout(fetch, url, { method: 'GET' })
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as { models?: Array<{ name?: string }> }
  const names = new Set<string>()
  for (const item of data.models ?? []) {
    if (item.name) names.add(item.name)
  }
  return names
}

async function listClaudeModels(
  provider: ProviderConfig,
  fetch: EngineFetch
): Promise<Set<string> | null> {
  const base = trimBaseUrl(provider.base_url)
  const url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`
  const response = await fetchWithTimeout(fetch, url, {
    method: 'GET',
    headers: {
      'x-api-key': provider.api_key ?? '',
      'anthropic-version': '2023-06-01',
    },
  })
  if (!response.ok) {
    return null
  }
  const data = (await response.json()) as { data?: Array<{ id?: string }> }
  const ids = new Set<string>()
  for (const item of data.data ?? []) {
    if (item.id) ids.add(item.id)
  }
  return ids
}

async function listProviderModels(
  provider: ProviderConfig,
  fetch: EngineFetch
): Promise<Set<string> | null> {
  switch (provider.type) {
    case 'ollama':
      return listOllamaModels(provider, fetch)
    case 'claude':
      return listClaudeModels(provider, fetch)
    case 'openai_compatible':
    default:
      return listOpenAiCompatibleModels(provider, fetch)
  }
}

function isModelListed(modelId: string, listed: Set<string>, type: ProviderType): boolean {
  if (listed.has(modelId)) return true
  if (type !== 'ollama') return false
  for (const name of listed) {
    if (name === modelId || name.startsWith(`${modelId}:`) || modelId.startsWith(`${name}:`)) {
      return true
    }
  }
  return false
}

async function probeOpenAiCompatibleModel(
  provider: ProviderConfig,
  modelId: string,
  fetch: EngineFetch
): Promise<{ ok: boolean; detail: string }> {
  const url = `${trimBaseUrl(provider.base_url)}/chat/completions`
  const response = await fetchWithTimeout(fetch, url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(provider.api_key ? { Authorization: `Bearer ${provider.api_key}` } : {}),
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      stream: false,
    }),
  })
  if (response.ok) {
    return { ok: true, detail: 'probe OK' }
  }
  const body = await response.text()
  return { ok: false, detail: summarizeHttpError(response.status, body) }
}

async function probeOllamaModel(
  provider: ProviderConfig,
  modelId: string,
  fetch: EngineFetch
): Promise<{ ok: boolean; detail: string }> {
  const url = `${trimBaseUrl(provider.base_url)}/api/chat`
  const response = await fetchWithTimeout(fetch, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'ping' }],
      stream: false,
      options: { num_predict: 1 },
    }),
  })
  if (response.ok) {
    return { ok: true, detail: 'probe OK' }
  }
  const body = await response.text()
  return { ok: false, detail: summarizeHttpError(response.status, body) }
}

async function probeClaudeModel(
  provider: ProviderConfig,
  modelId: string,
  fetch: EngineFetch
): Promise<{ ok: boolean; detail: string }> {
  const base = trimBaseUrl(provider.base_url)
  const path = provider.api_path ?? '/v1/messages'
  const url = `${base}${path}`
  const response = await fetchWithTimeout(fetch, url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.api_key ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  if (response.ok) {
    return { ok: true, detail: 'probe OK' }
  }
  const body = await response.text()
  return { ok: false, detail: summarizeHttpError(response.status, body) }
}

async function probeModel(
  provider: ProviderConfig,
  modelId: string,
  fetch: EngineFetch
): Promise<{ ok: boolean; detail: string }> {
  switch (provider.type) {
    case 'ollama':
      return probeOllamaModel(provider, modelId, fetch)
    case 'claude':
      return probeClaudeModel(provider, modelId, fetch)
    case 'openai_compatible':
    default:
      return probeOpenAiCompatibleModel(provider, modelId, fetch)
  }
}

function requiresApiKey(type: ProviderType): boolean {
  return type === 'openai_compatible' || type === 'claude'
}

async function checkProviderModels(
  providerId: string,
  provider: ProviderConfig
): Promise<ModelAvailabilityResult[]> {
  const fetch = createProxiedFetch(provider.proxy)
  const results: ModelAvailabilityResult[] = []

  if (requiresApiKey(provider.type) && !provider.api_key?.trim()) {
    for (const model of provider.models) {
      results.push({
        providerId,
        modelId: model.id,
        modelName: model.name,
        available: false,
        detail: 'api_key not configured',
        latencyMs: 0,
      })
    }
    return results
  }

  let listedModels: Set<string> | null = null
  let listError: string | null = null

  try {
    listedModels = await listProviderModels(provider, fetch)
  } catch (err) {
    listError = summarizeFetchError(err)
  }

  for (const model of provider.models) {
    const started = Date.now()
    try {
      if (listedModels) {
        if (isModelListed(model.id, listedModels, provider.type)) {
          results.push({
            providerId,
            modelId: model.id,
            modelName: model.name,
            available: true,
            detail: 'listed by provider',
            latencyMs: Date.now() - started,
          })
          continue
        }
      }

      const probe = await probeModel(provider, model.id, fetch)
      results.push({
        providerId,
        modelId: model.id,
        modelName: model.name,
        available: probe.ok,
        detail: probe.ok
          ? listedModels
            ? 'probe OK (not in model list)'
            : probe.detail
          : probe.detail,
        latencyMs: Date.now() - started,
      })
    } catch (err) {
      results.push({
        providerId,
        modelId: model.id,
        modelName: model.name,
        available: false,
        detail: listError ?? summarizeFetchError(err),
        latencyMs: Date.now() - started,
      })
    }
  }

  return results
}

export async function checkConfiguredModelAvailability(
  config: AppConfig
): Promise<ModelAvailabilityResult[]> {
  const checks = Object.entries(config.providers).map(([providerId, provider]) =>
    checkProviderModels(providerId, provider)
  )
  const nested = await Promise.all(checks)
  return nested.flat()
}

export function logModelAvailabilityResults(results: ModelAvailabilityResult[]): void {
  if (results.length === 0) {
    console.log('[parawrite] No provider models configured to check')
    return
  }

  console.log(`[parawrite] Checking ${results.length} configured model API(s)...`)
  for (const result of results) {
    const status = result.available ? 'OK' : 'FAIL'
    const latency = result.latencyMs > 0 ? ` (${result.latencyMs}ms)` : ''
    console.log(
      `[parawrite]   ${status} ${result.providerId}/${result.modelId}${latency} — ${result.detail}`
    )
  }
  const available = results.filter((r) => r.available).length
  console.log(`[parawrite] Model API check: ${available}/${results.length} available`)
}
