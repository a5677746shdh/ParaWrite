/** Guards against duplicate translate triggers after language swap. */
export const translateGuards = {
  skipTargetLangRetranslate: false,
  syncedSourceForAuto: null as string | null,
}

export function markLanguageSwap(newSourceText: string): void {
  translateGuards.skipTargetLangRetranslate = true
  translateGuards.syncedSourceForAuto = newSourceText
}
