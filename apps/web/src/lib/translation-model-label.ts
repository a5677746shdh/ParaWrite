import type { PublicMeta } from '@parawrite/core/client'

/** Whether the header translation model select should use translation-specific labels. */
function shouldUseTranslationModelLabel(
  meta: PublicMeta,
  translateProvider: string,
  translateModel: string,
  lookupProvider: string,
  lookupModel: string
): boolean {
  if (meta.lookupModelSeparate) return true
  if (!meta.enableLookupModelSelect) return false
  return lookupProvider !== translateProvider || lookupModel !== translateModel
}

export function getTranslationModelLabelKey(
  meta: PublicMeta,
  translateProvider: string,
  translateModel: string,
  lookupProvider: string,
  lookupModel: string
): string {
  const showProvider = meta.showProviderInModelSelect
  const useTranslationLabel = shouldUseTranslationModelLabel(
    meta,
    translateProvider,
    translateModel,
    lookupProvider,
    lookupModel
  )
  if (showProvider) {
    return useTranslationLabel ? 'translationProviderModel' : 'providerModel'
  }
  return useTranslationLabel ? 'translationModel' : 'model'
}
