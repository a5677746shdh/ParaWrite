import { fromConfigLang } from './lang-codes.js'
import type { PaneWidthRatioResult, PublicPaneWidthRatios } from './types.js'

const DEFAULT_PANE_RATIO = 0.5

function clampRatio(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return fallback
  return value
}

/** Map config `zho-eng` keys to runtime `zh-en` (ISO 639-1) pair keys. */
export function mapPaneWidthPairRatios(
  byPair: Record<string, number> | undefined,
  defaultRatio: number
): Record<string, number> {
  if (!byPair) return {}

  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(byPair)) {
    const parts = key.split('-')
    if (parts.length !== 2) {
      console.warn(`[parawrite] Invalid pane_width_ratios pair key: "${key}"`)
      continue
    }
    const [langA, langB] = parts
    const mappedKey = `${fromConfigLang(langA)}-${fromConfigLang(langB)}`
    result[mappedKey] = clampRatio(raw, defaultRatio)
  }
  return result
}

export function getPaneWidthRatiosMeta(config: {
  app: { layout?: { pane_width_ratios?: { default?: number; by_pair?: Record<string, number> } } }
}): PublicPaneWidthRatios {
  const ratioConfig = config.app.layout?.pane_width_ratios
  const defaultRatio = clampRatio(ratioConfig?.default ?? DEFAULT_PANE_RATIO, DEFAULT_PANE_RATIO)
  return {
    default: defaultRatio,
    byPair: mapPaneWidthPairRatios(ratioConfig?.by_pair, defaultRatio),
  }
}

function isResolvableLang(code: string | null | undefined): code is string {
  return !!code && code !== 'auto'
}

/**
 * Resolve source/target pane width ratios for the current language pair.
 * `byPair` keys use ISO 639-1 (`zh-en`). Ratio on `langA-langB` is langA's share when langA is source.
 */
export function resolvePaneWidthRatios(
  paneWidthRatios: PublicPaneWidthRatios,
  sourceLang: string | null | undefined,
  targetLang: string | null | undefined
): PaneWidthRatioResult {
  const fallback = paneWidthRatios.default
  if (!isResolvableLang(sourceLang) || !isResolvableLang(targetLang) || sourceLang === targetLang) {
    return { sourceRatio: fallback, targetRatio: 1 - fallback }
  }

  const forwardKey = `${sourceLang}-${targetLang}`
  const forwardRatio = paneWidthRatios.byPair[forwardKey]
  if (forwardRatio !== undefined) {
    const sourceRatio = clampRatio(forwardRatio, fallback)
    return { sourceRatio, targetRatio: 1 - sourceRatio }
  }

  const reverseKey = `${targetLang}-${sourceLang}`
  const reverseRatio = paneWidthRatios.byPair[reverseKey]
  if (reverseRatio !== undefined) {
    const targetRatio = clampRatio(reverseRatio, fallback)
    return { sourceRatio: 1 - targetRatio, targetRatio }
  }

  return { sourceRatio: fallback, targetRatio: 1 - fallback }
}
