import type { PublicProviderInfo } from '@parawrite/core/client'

export const PROVIDER_MODEL_SEP = '::'

export interface ProviderModelOption {
  value: string
  label: string
}

export function buildProviderModelOptions(
  providers: PublicProviderInfo[],
  showProvider: boolean
): ProviderModelOption[] {
  return providers.flatMap((p) =>
    p.models.map((m) => ({
      value: `${p.id}${PROVIDER_MODEL_SEP}${m.id}`,
      label: showProvider ? `${p.id}-${m.name}` : m.name,
    }))
  )
}

export function formatProviderModelValue(provider: string, model: string): string {
  return `${provider}${PROVIDER_MODEL_SEP}${model}`
}

export function parseProviderModelValue(value: string): { provider: string; model: string } | null {
  const [provider, model] = value.split(PROVIDER_MODEL_SEP)
  if (!provider || !model) return null
  return { provider, model }
}
