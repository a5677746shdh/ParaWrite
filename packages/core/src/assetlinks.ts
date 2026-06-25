import fs from 'node:fs'
import type { AppConfig } from './types.js'
import { resolveAppPath } from './config.js'

/** URL path where Android TWA expects Digital Asset Links JSON. */
export const ASSETLINKS_SERVE_PATH = '/.well-known/assetlinks.json'

/** Resolve assetlinks.json on disk from pwa.assetlinks_file (default: config/assetlinks.json). */
export function resolveAssetLinksPath(config: AppConfig, configPath?: string): string {
  const relative = config.pwa?.assetlinks_file ?? 'config/assetlinks.json'
  return resolveAppPath(relative, configPath)
}

/** Read assetlinks file; returns raw JSON string or null if missing/invalid. */
export function loadAssetLinksFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8').trim()
  if (!raw) return null
  try {
    JSON.parse(raw)
    return raw
  } catch {
    return null
  }
}
