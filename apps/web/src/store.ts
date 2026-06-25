/**
 * Global UI state: languages, translation text, word-panel data, and meta from /api/meta.
 * Mutations that reset selection also clear synonyms/dictionary loaded for the prior word.
 */
import { create } from 'zustand'
import type {
  DictionaryEntry,
  PublicMeta,
  RephraseOption,
  SelectionGranularity,
  SynonymOption,
} from '@parawrite/core/client'
import { fetchMeta } from './api'

interface TranslationState {
  meta: PublicMeta | null
  sourceLang: string
  targetLang: string
  detectedSourceLang: string | null
  provider: string
  model: string
  sourceText: string
  targetText: string
  isTranslating: boolean
  isStreaming: boolean
  error: string | null
  selectedWord: string | null
  selectedRange: { start: number; end: number } | null
  selectionGranularity: SelectionGranularity | null
  synonyms: SynonymOption[]
  dictionary: DictionaryEntry | null
  rephraseOptions: RephraseOption[]
  rephraseOriginalSentence: string | null
  isPanelLoading: boolean
  historyRefreshKey: number
  setMeta: (meta: PublicMeta) => void
  refreshMeta: () => Promise<PublicMeta>
  bumpHistoryRefresh: () => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  setDetectedSourceLang: (lang: string | null) => void
  swapLanguages: () => void
  setProvider: (provider: string) => void
  setModel: (model: string) => void
  setProviderModel: (provider: string, model: string) => void
  setSourceText: (text: string) => void
  setTargetText: (text: string) => void
  appendTargetText: (chunk: string) => void
  setTranslating: (value: boolean) => void
  setStreaming: (value: boolean) => void
  setError: (error: string | null) => void
  setSelection: (
    word: string | null,
    range: { start: number; end: number } | null,
    granularity?: SelectionGranularity | null,
    preservePanel?: boolean
  ) => void
  setSynonyms: (synonyms: SynonymOption[]) => void
  setDictionary: (entry: DictionaryEntry | null) => void
  setRephraseOptions: (options: RephraseOption[], originalSentence?: string | null) => void
  setPanelLoading: (value: boolean) => void
  clear: () => void
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  meta: null,
  sourceLang: 'auto',
  targetLang: 'en',
  detectedSourceLang: null,
  provider: '',
  model: '',
  sourceText: '',
  targetText: '',
  isTranslating: false,
  isStreaming: false,
  error: null,
  selectedWord: null,
  selectedRange: null,
  selectionGranularity: null,
  synonyms: [],
  dictionary: null,
  rephraseOptions: [],
  rephraseOriginalSentence: null,
  isPanelLoading: false,
  historyRefreshKey: 0,
  setMeta: (meta) =>
    set({
      meta,
      provider: meta.defaultProvider,
      model: meta.defaultModel,
    }),
  refreshMeta: async () => {
    const meta = await fetchMeta()
    set({
      meta,
      provider: meta.defaultProvider,
      model: meta.defaultModel,
    })
    return meta
  },
  bumpHistoryRefresh: () =>
    set((s) => ({ historyRefreshKey: s.historyRefreshKey + 1 })),
  setSourceLang: (sourceLang) => set({ sourceLang, detectedSourceLang: null }),
  setTargetLang: (targetLang) => set({ targetLang }),
  setDetectedSourceLang: (detectedSourceLang) => set({ detectedSourceLang }),
  swapLanguages: () => {
    const { sourceLang, targetLang, sourceText, targetText, detectedSourceLang } = get()
    const effectiveSource = sourceLang === 'auto' ? detectedSourceLang : sourceLang
    if (!effectiveSource) return

    set({
      sourceLang: targetLang,
      targetLang: effectiveSource,
      sourceText: targetText,
      targetText: sourceText,
      detectedSourceLang: null,
    })
  },
  setProvider: (provider) => {
    const meta = get().meta
    const providerInfo = meta?.providers.find((p) => p.id === provider)
    const defaultModel =
      providerInfo?.models.find((m) => m.default)?.id ?? providerInfo?.models[0]?.id ?? ''
    set({ provider, model: defaultModel })
  },
  setModel: (model) => set({ model }),
  setProviderModel: (provider, model) => set({ provider, model }),
  setSourceText: (sourceText) =>
    set({
      sourceText,
      detectedSourceLang: sourceText.trim() ? get().detectedSourceLang : null,
    }),
  setTargetText: (targetText) => set({ targetText }),
  appendTargetText: (chunk) => set((s) => ({ targetText: s.targetText + chunk })),
  setTranslating: (isTranslating) => set({ isTranslating }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  setSelection: (
    selectedWord,
    selectedRange,
    selectionGranularity = null,
    preservePanel = false
  ) =>
    set({
      selectedWord,
      selectedRange,
      selectionGranularity,
      ...(preservePanel ? {} : { synonyms: [], dictionary: null }),
    }),
  setSynonyms: (synonyms) => set({ synonyms }),
  setDictionary: (dictionary) => set({ dictionary }),
  setRephraseOptions: (rephraseOptions, rephraseOriginalSentence = null) =>
    set({ rephraseOptions, rephraseOriginalSentence }),
  setPanelLoading: (isPanelLoading) => set({ isPanelLoading }),
  clear: () =>
    set({
      sourceText: '',
      targetText: '',
      detectedSourceLang: null,
      error: null,
      selectedWord: null,
      selectedRange: null,
      selectionGranularity: null,
      synonyms: [],
      dictionary: null,
      rephraseOptions: [],
      rephraseOriginalSentence: null,
    }),
}))
