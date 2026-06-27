/**
 * Per-user preference YAML (app + theme only) and path helpers for user config/glossary files.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import type { AppConfig, ThemeConfig } from './types.js'
import { resolveAppPath } from './config.js'

export interface UserPreferencesConfig {
  app?: Partial<AppConfig['app']>
  theme?: ThemeConfig
}

const ALLOWED_ROOT_KEYS = new Set(['app', 'theme'])

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => process.env[name] ?? '')
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

export function pickAllowedSections(raw: Record<string, unknown>): UserPreferencesConfig {
  const result: UserPreferencesConfig = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      console.warn(`[parawrite] Ignoring disallowed user preference key: "${key}"`)
      continue
    }
    if (key === 'app' && value && typeof value === 'object') {
      result.app = value as Partial<AppConfig['app']>
    } else if (key === 'theme' && value && typeof value === 'object') {
      result.theme = value as ThemeConfig
    }
  }
  return result
}

export function loadUserPreferencesConfig(
  filePath: string,
  baseConfig: AppConfig
): UserPreferencesConfig | null {
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = yaml.load(raw) as Record<string, unknown>
  const resolved = resolveConfigValues(parsed)
  const prefs = pickAllowedSections(resolved)

  const providerId = prefs.app?.default_provider
  if (providerId && !baseConfig.providers[providerId]) {
    console.warn(
      `[parawrite] User preferences ignored: default_provider "${providerId}" not in global config`
    )
    return null
  }

  const modelId = prefs.app?.default_model
  if (modelId && providerId) {
    const provider = baseConfig.providers[providerId]
    if (provider && !provider.models.some((m) => m.id === modelId)) {
      console.warn(
        `[parawrite] User preferences ignored: default_model "${modelId}" not in provider "${providerId}"`
      )
      return null
    }
  }

  return prefs
}

function mergeAppSection(
  base: AppConfig['app'],
  override?: Partial<AppConfig['app']>
): AppConfig['app'] {
  if (!override) return base

  const layout = override.layout
    ? {
        ...base.layout,
        ...override.layout,
        pane_width_ratios: override.layout.pane_width_ratios
          ? {
              ...base.layout?.pane_width_ratios,
              ...override.layout.pane_width_ratios,
              by_pair: {
                ...base.layout?.pane_width_ratios?.by_pair,
                ...override.layout.pane_width_ratios.by_pair,
              },
            }
          : base.layout?.pane_width_ratios,
      }
    : base.layout

  const alternatives_separator = override.alternatives_separator
    ? {
        ...base.alternatives_separator,
        ...override.alternatives_separator,
        by_language: {
          ...base.alternatives_separator?.by_language,
          ...override.alternatives_separator.by_language,
        },
      }
    : base.alternatives_separator

  const phrase_word_threshold = override.phrase_word_threshold
    ? {
        ...base.phrase_word_threshold,
        ...override.phrase_word_threshold,
        by_language: {
          ...base.phrase_word_threshold?.by_language,
          ...override.phrase_word_threshold.by_language,
        },
      }
    : base.phrase_word_threshold

  return {
    ...base,
    ...override,
    layout,
    alternatives_separator,
    phrase_word_threshold,
  }
}

export function mergeUserPreferences(
  base: AppConfig,
  prefs: UserPreferencesConfig
): AppConfig {
  return {
    ...base,
    app: mergeAppSection(base.app, prefs.app),
    theme: prefs.theme ? { ...base.theme, ...prefs.theme } : base.theme,
  }
}

const DEFAULT_USER_CONFIG_DIR = 'data/user-configs'
const DEFAULT_USER_GLOSSARY_DIR = 'data/user-glossaries'

export function resolveUserConfigDir(config: AppConfig, configPath?: string): string {
  const relative = config.users?.user_config_dir ?? DEFAULT_USER_CONFIG_DIR
  return resolveAppPath(relative, configPath)
}

export function resolveUserGlossaryDir(config: AppConfig, configPath?: string): string {
  const relative = config.users?.user_glossary_dir ?? DEFAULT_USER_GLOSSARY_DIR
  return resolveAppPath(relative, configPath)
}

export function resolveUserConfigPath(
  configId: string,
  config: AppConfig,
  configPath?: string
): string {
  const dir = resolveUserConfigDir(config, configPath)
  return path.join(dir, `${configId}.yaml`)
}

export function resolveUserGlossaryPath(
  glossaryId: string,
  config: AppConfig,
  configPath?: string
): string {
  const dir = resolveUserGlossaryDir(config, configPath)
  return path.join(dir, `${glossaryId}.yaml`)
}
