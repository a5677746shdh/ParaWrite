import type { AppConfig, ProviderConfig } from '../types.js'
import { getProviderConfig } from '../config.js'
import { createProxiedFetch } from '../proxy-fetch.js'
import { ClaudeEngine } from './claude.js'
import { OllamaEngine } from './ollama.js'
import { OpenAICompatibleEngine } from './openai.js'
import type { IEngine } from './base.js'

export function createEngine(provider: ProviderConfig): IEngine {
  const proxiedFetch = createProxiedFetch(provider.proxy)
  switch (provider.type) {
    case 'claude':
      return new ClaudeEngine(provider, proxiedFetch)
    case 'ollama':
      return new OllamaEngine(provider, proxiedFetch)
    case 'openai_compatible':
    default:
      return new OpenAICompatibleEngine(provider, proxiedFetch)
  }
}

export function getEngineForProvider(
  config: AppConfig,
  providerId: string
): IEngine {
  const provider = getProviderConfig(config, providerId)
  return createEngine(provider)
}
