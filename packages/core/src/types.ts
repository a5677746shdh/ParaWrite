export type ProviderType = 'openai_compatible' | 'claude' | 'ollama'

export interface ModelConfig {
  id: string
  name: string
  default?: boolean
}

export interface ProviderConfig {
  type: ProviderType
  base_url: string
  api_key?: string
  api_path?: string
  models: ModelConfig[]
}

export interface DictionaryConfig {
  free_dictionary: boolean
  wiktionary: boolean
  llm_fallback: boolean
}

export interface LayoutConfig {
  three_column_min_width?: number
  two_column_min_width?: number
}

export interface AppConfig {
  server: {
    host: string
    port: number
  }
  app: {
    default_provider: string
    default_model?: string
    auto_translate_delay_seconds?: number
    runtime_env?: string
    layout?: LayoutConfig
  }
  providers: Record<string, ProviderConfig>
  dictionary: DictionaryConfig
}

export interface PublicProviderInfo {
  id: string
  type: ProviderType
  models: ModelConfig[]
}

export interface PublicMeta {
  defaultProvider: string
  defaultModel: string
  providers: PublicProviderInfo[]
  version: string
  runtimeEnv?: string
  autoTranslateDelaySeconds: number
  layoutBreakpoints: {
    threeColumnMinWidth: number
    twoColumnMinWidth: number
  }
}

export type LayoutMode = 'threeColumn' | 'twoColumn' | 'stacked'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  model: string
  temperature?: number
  signal?: AbortSignal
}

export interface TranslateRequest {
  text: string
  sourceLang: string
  targetLang: string
  provider: string
  model?: string
}

export interface SynonymsRequest {
  word: string
  sentence: string
  sourceText: string
  sourceLang: string
  targetLang: string
  provider: string
  model?: string
}

export interface RephraseRequest {
  sentence: string
  sourceText: string
  fullTranslation: string
  sourceLang: string
  targetLang: string
  provider: string
  model?: string
}

export interface DictionaryContextRequest {
  word: string
  sentence: string
  sourceText: string
  sourceLang: string
  targetLang: string
  uiLang: string
  provider: string
  model?: string
}

export interface SynonymOption {
  word: string
  note?: string
}

export interface RephraseOption {
  text: string
  style?: string
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech?: string
    definition: string
    example?: string
  }>
  source: 'free_dictionary' | 'wiktionary' | 'llm'
}

export interface TokenSegment {
  text: string
  index: number
  isWord: boolean
}

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
] as const

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

export function getLangName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code)
  return found?.name ?? code
}
