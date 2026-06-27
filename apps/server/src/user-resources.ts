/**
 * Caches per-user merged config and glossary (invalidated by user YAML mtime).
 */
import fs from 'node:fs'
import {
  GlossaryService,
  loadUserGlossary,
  loadUserPreferencesConfig,
  mergeGlossaryEntries,
  mergeUserPreferences,
  resolveUserConfigPath,
  resolveUserGlossaryPath,
  type AppConfig,
  type UserProfile,
} from '@parawrite/core'

/** Re-check file mtime at most this often when cache entry exists. */
const MTIME_RECHECK_MS = 5_000

function fileMtimeMs(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs
  } catch {
    return -1
  }
}

interface CachedResource<T> {
  mtimeMs: number
  checkedAt: number
  value: T
}

export class UserResourceCache {
  private readonly configById = new Map<string, CachedResource<AppConfig>>()
  private readonly glossaryById = new Map<string, CachedResource<GlossaryService>>()

  constructor(
    private readonly baseConfig: AppConfig,
    private readonly configPath: string | undefined,
    private readonly globalGlossary: GlossaryService
  ) {}

  getEffectiveConfig(profile: UserProfile): AppConfig {
    const prefsPath = resolveUserConfigPath(profile.configId, this.baseConfig, this.configPath)
    const cached = this.configById.get(profile.configId)
    const now = Date.now()

    if (cached && now - cached.checkedAt < MTIME_RECHECK_MS) {
      return cached.value
    }

    const mtimeMs = fileMtimeMs(prefsPath)
    if (cached && cached.mtimeMs === mtimeMs) {
      cached.checkedAt = now
      return cached.value
    }

    const prefs = loadUserPreferencesConfig(prefsPath, this.baseConfig)
    const merged = prefs ? mergeUserPreferences(this.baseConfig, prefs) : this.baseConfig
    this.configById.set(profile.configId, { mtimeMs, checkedAt: now, value: merged })
    return merged
  }

  getEffectiveGlossary(profile: UserProfile): GlossaryService {
    const glossaryPath = resolveUserGlossaryPath(
      profile.glossaryId,
      this.baseConfig,
      this.configPath
    )
    const cached = this.glossaryById.get(profile.glossaryId)
    const now = Date.now()

    if (cached && now - cached.checkedAt < MTIME_RECHECK_MS) {
      return cached.value
    }

    const mtimeMs = fileMtimeMs(glossaryPath)
    if (cached && cached.mtimeMs === mtimeMs) {
      cached.checkedAt = now
      return cached.value
    }

    const userEntries = loadUserGlossary(glossaryPath)
    const service =
      userEntries.length === 0
        ? this.globalGlossary
        : GlossaryService.fromEntries(
            mergeGlossaryEntries(this.globalGlossary.getEntries(), userEntries)
          )

    this.glossaryById.set(profile.glossaryId, { mtimeMs, checkedAt: now, value: service })
    return service
  }
}
