import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { AlternativesSeparator, AppConfig, PublicMeta, ProviderConfig } from './types.js'
import { BUILD_VERSION } from './version.generated.js'
import { fromConfigLang, mapConfigLangRecord } from './lang-codes.js'

const DEFAULT_THREE_COLUMN_MIN = 1280
const DEFAULT_TWO_COLUMN_MIN = 768

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
    return process.env[name] ?? ''
  })
}

function resolveConfigValues<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveConfigValues(item)) as T
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveConfigValues(value)
    }
    return result as T
  }
  return obj
}

export function findConfigPath(): string {
  const candidates = [
    process.env.PARWRITE_CONFIG,
    path.resolve(process.cwd(), 'config/parawrite.yaml'),
    path.resolve(process.cwd(), '../config/parawrite.yaml'),
    path.resolve(process.cwd(), '../../config/parawrite.yaml'),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  const examplePath = path.resolve(process.cwd(), 'config/parawrite.example.yaml')
  if (fs.existsSync(examplePath)) {
    return examplePath
  }

  throw new Error(
    'Config not found. Copy config/parawrite.example.yaml to config/parawrite.yaml'
  )
}

export function getConfigDir(configPath?: string): string {
  const filePath = configPath ?? findConfigPath()
  return path.dirname(filePath)
}

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath ?? findConfigPath()
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = yaml.load(raw) as AppConfig
  const config = resolveConfigValues(parsed)
  validateConfig(config)
  return config
}

function validateConfig(config: AppConfig): void {
  if (!config.server?.port) {
    throw new Error('Invalid config: server.port is required')
  }
  if (!config.providers || Object.keys(config.providers).length === 0) {
    throw new Error('Invalid config: at least one provider is required')
  }
  if (!config.app?.default_provider) {
    throw new Error('Invalid config: app.default_provider is required')
  }
  if (!config.providers[config.app.default_provider]) {
    throw new Error(`Invalid config: default provider "${config.app.default_provider}" not found`)
  }
}

export function getProviderConfig(
  config: AppConfig,
  providerId: string
): ProviderConfig {
  const provider = config.providers[providerId]
  if (!provider) {
    throw new Error(`Provider "${providerId}" not found`)
  }
  return provider
}

export function getDefaultModel(
  config: AppConfig,
  providerId?: string
): string {
  const pid = providerId ?? config.app.default_provider
  const provider = getProviderConfig(config, pid)
  const explicit = config.app.default_model
  if (explicit && provider.models.some((m) => m.id === explicit)) {
    return explicit
  }
  const defaultModel = provider.models.find((m) => m.default)
  return defaultModel?.id ?? provider.models[0]?.id ?? ''
}

export function getLayoutBreakpoints(config: AppConfig) {
  return {
    threeColumnMinWidth:
      config.app.layout?.three_column_min_width ?? DEFAULT_THREE_COLUMN_MIN,
    twoColumnMinWidth:
      config.app.layout?.two_column_min_width ?? DEFAULT_TWO_COLUMN_MIN,
  }
}

export function resolveAlternativesSeparator(
  config: AppConfig,
  targetLang6391: string
): AlternativesSeparator {
  const sepConfig = config.app.alternatives_separator
  const defaultSep = sepConfig?.default ?? 'comma'
  if (!sepConfig?.by_language) return defaultSep

  const byLang = mapConfigLangRecord(sepConfig.by_language)
  return byLang[targetLang6391] ?? defaultSep
}

export function getAlternativesSeparatorsMeta(config: AppConfig) {
  const sepConfig = config.app.alternatives_separator
  return {
    default: (sepConfig?.default ?? 'comma') as AlternativesSeparator,
    byLanguage: mapConfigLangRecord(sepConfig?.by_language) as Record<
      string,
      AlternativesSeparator
    >,
  }
}

export function getPhraseWordThresholdsMeta(config: AppConfig) {
  const thresholdConfig = config.app.phrase_word_threshold
  return {
    default: thresholdConfig?.default ?? 1,
    byLanguage: mapConfigLangRecord(thresholdConfig?.by_language) as Record<string, number>,
  }
}

export function resolvePhraseWordThreshold(
  config: AppConfig,
  targetLang6391: string
): number {
  const thresholdConfig = config.app.phrase_word_threshold
  const defaultThreshold = thresholdConfig?.default ?? 1
  if (!thresholdConfig?.by_language) return defaultThreshold

  const byLang = mapConfigLangRecord(thresholdConfig.by_language)
  return byLang[targetLang6391] ?? defaultThreshold
}

export function isAccessAuthEnabled(config: AppConfig): boolean {
  return !!config.auth?.access_totp_secret?.trim()
}

export function isRestartAuthEnabled(config: AppConfig): boolean {
  return !!config.auth?.restart_totp_secret?.trim()
}

export function toPublicMeta(config: AppConfig, authenticated = false): PublicMeta {
  const providers = Object.entries(config.providers).map(([id, provider]) => ({
    id,
    type: provider.type,
    models: provider.models,
  }))

  const runtimeEnv = config.app.runtime_env?.trim()

  return {
    defaultProvider: config.app.default_provider,
    defaultModel: getDefaultModel(config),
    providers,
    version: BUILD_VERSION,
    runtimeEnv: runtimeEnv || undefined,
    autoTranslateDelaySeconds: config.app.auto_translate_delay_seconds ?? 0,
    layoutBreakpoints: getLayoutBreakpoints(config),
    authRequired: isAccessAuthEnabled(config),
    restartAuthRequired: isRestartAuthEnabled(config),
    authenticated,
    translateOnEnter: config.app.translate_on_enter ?? false,
    alternativesSeparators: getAlternativesSeparatorsMeta(config),
    phraseWordThresholds: getPhraseWordThresholdsMeta(config),
  }
}
