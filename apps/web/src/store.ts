import { create } from 'zustand'
import type {
  DictionaryEntry,
  PublicMeta,
  RephraseOption,
  SelectionGranularity,
  SynonymOption,
} from '@parawrite/core/client'

interface TranslationState {
  meta: PublicMeta | null
  sourceLang: string
  targetLang: string
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
  isPanelLoading: boolean
  setMeta: (meta: PublicMeta) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
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
    granularity?: SelectionGranularity | null
  ) => void
  setSynonyms: (synonyms: SynonymOption[]) => void
  setDictionary: (entry: DictionaryEntry | null) => void
  setRephraseOptions: (options: RephraseOption[]) => void
  setPanelLoading: (value: boolean) => void
  clear: () => void
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  meta: null,
  sourceLang: 'auto',
  targetLang: 'en',
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
  isPanelLoading: false,
  setMeta: (meta) =>
    set({
      meta,
      provider: meta.defaultProvider,
      model: meta.defaultModel,
    }),
  setSourceLang: (sourceLang) => set({ sourceLang }),
  setTargetLang: (targetLang) => set({ targetLang }),
  swapLanguages: () => {
    const { sourceLang, targetLang, sourceText, targetText } = get()
    set({
      sourceLang: targetLang === 'auto' ? 'en' : targetLang,
      targetLang: sourceLang === 'auto' ? 'en' : sourceLang,
      sourceText: targetText,
      targetText: sourceText,
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
  setSourceText: (sourceText) => set({ sourceText }),
  setTargetText: (targetText) => set({ targetText }),
  appendTargetText: (chunk) => set((s) => ({ targetText: s.targetText + chunk })),
  setTranslating: (isTranslating) => set({ isTranslating }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  setSelection: (selectedWord, selectedRange, selectionGranularity = null) =>
    set({
      selectedWord,
      selectedRange,
      selectionGranularity,
      synonyms: [],
      dictionary: null,
    }),
  setSynonyms: (synonyms) => set({ synonyms }),
  setDictionary: (dictionary) => set({ dictionary }),
  setRephraseOptions: (rephraseOptions) => set({ rephraseOptions }),
  setPanelLoading: (isPanelLoading) => set({ isPanelLoading }),
  clear: () =>
    set({
      sourceText: '',
      targetText: '',
      error: null,
      selectedWord: null,
      selectedRange: null,
      selectionGranularity: null,
      synonyms: [],
      dictionary: null,
      rephraseOptions: [],
    }),
}))
