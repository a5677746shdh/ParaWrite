/**
 * YAML configuration loader and public metadata builder.
 * Resolves ${ENV_VAR} placeholders, theme defaults, and path helpers (app root, data dir).
 * Only non-secret fields are exposed via toPublicMeta() for the /api/meta endpoint.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type {
  AlternativesSeparator,
  AppConfig,
  PublicMeta,
  PublicUserSummary,
  ProviderConfig,
  ThemeColors,
  UserLoginMode,
  WordLookupMode,
} from './types.js'
import { BUILD_VERSION } from './version.generated.js'
import { fromConfigLang, mapConfigLangRecord } from './lang-codes.js'

const DEFAULT_THREE_COLUMN_MIN = 1280
const DEFAULT_TWO_COLUMN_MIN = 768

const DEFAULT_THEME: ThemeColors = {
  primary: '#0f2b46',
  accent: '#2d7ff9',
  background: '#f5f7fa',
  surface: '#ffffff',
  border: '#d8dee9',
  muted: '#6b7c93',
  success: '#16a34a',
  error: '#dc2626',
  warning: '#f59e0b',
  alert: '#ea580c',
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

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
  // PARWRITE_CONFIG → cwd/config/parawrite.yaml → cwd/config/parawrite.docker.yaml
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

/** Application root — parent directory of the config folder (e.g. repo root or `/app`). */
export function getAppRoot(configPath?: string): string {
  return path.resolve(getConfigDir(configPath), '..')
}

/** Resolve a config file path: absolute paths unchanged, relative paths from app root. */
export function resolveAppPath(relativePath: string, configPath?: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath
  }
  return path.resolve(getAppRoot(configPath), relativePath)
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

export function getSelectionCopyEnabled(config: AppConfig): boolean {
  return config.app.selection_copy_enabled ?? false
}

export function normalizeWordLookupMode(raw?: string): WordLookupMode {
  switch (raw?.trim().toLowerCase()) {
    case 'manual':
    case 'on':
      return 'manual'
    case 'immediate':
    case 'off':
      return 'immediate'
    case 'adaptive':
    case 'auto':
      return 'adaptive'
    default:
      return 'adaptive'
  }
}

export function getWordLookupMode(config: AppConfig): WordLookupMode {
  return normalizeWordLookupMode(config.app.word_lookup_mode)
}

export function isManualWordLookup(config: AppConfig): boolean {
  return getWordLookupMode(config) === 'manual'
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

export function getUserLoginMode(config: AppConfig): UserLoginMode {
  return config.users?.login?.mode ?? 'disabled'
}

export function isUserLoginEnabled(config: AppConfig): boolean {
  return getUserLoginMode(config) !== 'disabled'
}

export function resolveThemeColors(config: AppConfig): ThemeColors {
  const theme = config.theme ?? {}
  const resolve = (key: keyof ThemeColors): string => {
    const value = theme[key]
    return value && HEX_COLOR_RE.test(value) ? value : DEFAULT_THEME[key]
  }
  return {
    primary: resolve('primary'),
    accent: resolve('accent'),
    background: resolve('background'),
    surface: resolve('surface'),
    border: resolve('border'),
    muted: resolve('muted'),
    success: resolve('success'),
    error: resolve('error'),
    warning: resolve('warning'),
    alert: resolve('alert'),
  }
}

export function getHistoryConfig(config: AppConfig) {
  const history = config.users?.history
  const threshold = history?.similarity_threshold ?? 0.85
  const interval = history?.dedup_interval_seconds ?? 60
  const pageSize = history?.page_size ?? 5
  return {
    similarityThreshold: Math.min(1, Math.max(0, threshold)),
    dedupIntervalSeconds: Math.max(1, interval),
    pageSize: Math.min(50, Math.max(1, Math.round(pageSize))),
  }
}

export function getUserSessionTtlHours(config: AppConfig): number {
  return config.users?.login?.session_ttl_hours ?? 168
}

export function resolveDataDir(config: AppConfig, configPath?: string): string {
  if (process.env.PARWRITE_DATA_DIR) {
    return path.resolve(process.env.PARWRITE_DATA_DIR)
  }
  const dataDir = config.users?.data_dir ?? 'data'
  return resolveAppPath(dataDir, configPath)
}

export function canRestartBackend(
  config: AppConfig,
  userLogin?: { authenticated: boolean; user: PublicUserSummary | null }
): boolean {
  const mode = getUserLoginMode(config)
  if (mode === 'disabled') return true
  if (!userLogin?.authenticated || !userLogin.user) return false
  const allowed = config.users?.login?.allowed_usernames ?? []
  const username = userLogin.user.username.trim().toLowerCase()
  return allowed.some((u) => u.trim().toLowerCase() === username)
}

export function toPublicMeta(
  config: AppConfig,
  authenticated = false,
  userLogin?: { authenticated: boolean; user: PublicUserSummary | null }
): PublicMeta {
  const providers = Object.entries(config.providers).map(([id, provider]) => ({
    id,
    type: provider.type,
    models: provider.models,
  }))

  const runtimeEnv = config.app.runtime_env?.trim()
  const loginMode = getUserLoginMode(config)
  const loginEnabled = loginMode !== 'disabled'

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
    canRestartBackend: canRestartBackend(config, userLogin),
    authenticated,
    translateOnEnter: config.app.translate_on_enter ?? false,
    alternativesSeparators: getAlternativesSeparatorsMeta(config),
    phraseWordThresholds: getPhraseWordThresholdsMeta(config),
    selectionCopyEnabled: getSelectionCopyEnabled(config),
    wordLookupMode: getWordLookupMode(config),
    userLogin: {
      enabled: loginEnabled,
      mode: loginMode,
      authenticated: userLogin?.authenticated ?? false,
      user: userLogin?.user ?? null,
      sessionTtlHours: getUserSessionTtlHours(config),
    },
    theme: resolveThemeColors(config),
    historyConfig: getHistoryConfig(config),
  }
}
