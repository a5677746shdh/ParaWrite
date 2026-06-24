import type { AppConfig, ProviderConfig } from '../types.js'
import { getProviderConfig } from '../config.js'
import { ClaudeEngine } from './claude.js'
import { OllamaEngine } from './ollama.js'
import { OpenAICompatibleEngine } from './openai.js'
import type { IEngine } from './base.js'

export function createEngine(provider: ProviderConfig): IEngine {
  switch (provider.type) {
    case 'claude':
      return new ClaudeEngine(provider)
    case 'ollama':
      return new OllamaEngine(provider)
    case 'openai_compatible':
    default:
      return new OpenAICompatibleEngine(provider)
  }
}

export function getEngineForProvider(
  config: AppConfig,
  providerId: string
): IEngine {
  const provider = getProviderConfig(config, providerId)
  return createEngine(provider)
}
