export type ProviderType = 'openai_compatible' | 'claude' | 'ollama'

export interface ModelConfig {
  id: string
  name: string
  default?: boolean
}

export interface ProxyConfig {
  /** http(s)://user:pass@host:port or socks5://user:pass@host:port */
  url: string
}

export interface ProviderConfig {
  type: ProviderType
  base_url: string
  api_key?: string
  api_path?: string
  proxy?: ProxyConfig
  models: ModelConfig[]
}

export interface DictionaryConfig {
  free_dictionary: boolean
  wiktionary: boolean
  llm_fallback: boolean
}

export interface GlossaryConfig {
  file?: string
}

export interface PwaConfig {
  /** Path to Digital Asset Links JSON for Android TWA (default: config/assetlinks.json). */
  assetlinks_file?: string
}

export type AlternativesSeparator = 'comma' | 'period'

export interface AlternativesSeparatorConfig {
  default?: AlternativesSeparator
  by_language?: Record<string, AlternativesSeparator>
}

export interface PhraseWordThresholdConfig {
  /** Selections with more than this many words are treated as phrases (synonyms/dictionary hidden). */
  default?: number
  by_language?: Record<string, number>
}

export interface AuthConfig {
  access_totp_secret?: string
  restart_totp_secret?: string
  session_ttl_hours?: number
}

/** Server-side terminal logging toggles (all default off). */
export interface LoggingConfig {
  /** Include client IP in security event logs. Default false. */
  include_client_ip?: boolean
  /** Include user-supplied fields (e.g. username) in security event logs. Default false. */
  include_user_input?: boolean
  invalid_access_code?: boolean
  invalid_restart_code?: boolean
  restricted_registration?: boolean
  /** Log after 3 consecutive failed logins for the same IP + username. */
  login_failures?: boolean
  backend_restart?: boolean
  app_api_errors?: boolean
  model_api_errors?: boolean
}

export interface ResolvedLoggingConfig {
  include_client_ip: boolean
  include_user_input: boolean
  invalid_access_code: boolean
  invalid_restart_code: boolean
  restricted_registration: boolean
  login_failures: boolean
  backend_restart: boolean
  app_api_errors: boolean
  model_api_errors: boolean
}

export type UserLoginMode = 'disabled' | 'restricted' | 'open'

export interface UserLoginConfig {
  mode?: UserLoginMode
  allowed_usernames?: string[]
  session_ttl_hours?: number
}

export interface UserHistoryConfig {
  similarity_threshold?: number
  dedup_interval_seconds?: number
  page_size?: number
}

export interface UsersConfig {
  login?: UserLoginConfig
  history?: UserHistoryConfig
  data_dir?: string
  /** Relative to app root; default `data/user-configs`. */
  user_config_dir?: string
  /** Relative to app root; default `data/user-glossaries`. */
  user_glossary_dir?: string
}

export interface ThemeConfig {
  primary?: string
  accent?: string
  background?: string
  surface?: string
  border?: string
  muted?: string
  success?: string
  error?: string
  warning?: string
  alert?: string
}

export interface ThemeColors {
  primary: string
  accent: string
  background: string
  surface: string
  border: string
  muted: string
  success: string
  error: string
  warning: string
  alert: string
}

export interface LayoutConfig {
  three_column_min_width?: number
  two_column_min_width?: number
  /** Source/target pane width ratios by language pair (ISO 639-1 keys in config, e.g. zh-en). */
  pane_width_ratios?: PaneWidthRatiosConfig
}

/** `langA-langB` ratio = langA pane share when langA is source and langB is target. */
export interface PaneWidthRatiosConfig {
  default?: number
  by_pair?: Record<string, number>
}

export interface PublicPaneWidthRatios {
  default: number
  byPair: Record<string, number>
}

export interface PaneWidthRatioResult {
  sourceRatio: number
  targetRatio: number
}

/** `immediate` = lookup on select; `manual` = lookup button; `adaptive` = manual in 1–2 column, immediate in 3 column. */
export type WordLookupMode = 'immediate' | 'manual' | 'adaptive'

/** Preload back-translations for rephrase alternatives: off, on hover, or when panel loads. */
export type RephraseBackTranslationPreload = 'off' | 'partial' | 'all'

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
    translate_on_enter?: boolean
    alternatives_separator?: AlternativesSeparatorConfig
    phrase_word_threshold?: PhraseWordThresholdConfig
    layout?: LayoutConfig
    /** When true, multi-word selection turns the copy button into a selection copier. */
    selection_copy_enabled?: boolean
    /** `immediate` / `manual` / `adaptive` (layout-aware manual vs immediate). */
    word_lookup_mode?: WordLookupMode
    /** Hover on a rephrase option to back-translate and show diff vs the current phrase. */
    rephrase_hover_preview_enabled?: boolean
    /** Milliseconds to wait before fetching back-translation on hover. */
    rephrase_hover_preview_delay_ms?: number
    /** Preload back-translations: `off`, `partial` (on hover), or `all` (when alternatives load). */
    rephrase_back_translation_preload?: RephraseBackTranslationPreload
    /** When true, swap languages automatically if source text matches target language. */
    auto_swap_languages?: boolean
  }
  providers: Record<string, ProviderConfig>
  dictionary: DictionaryConfig
  glossary?: GlossaryConfig
  pwa?: PwaConfig
  auth?: AuthConfig
  logging?: LoggingConfig
  users?: UsersConfig
  theme?: ThemeConfig
}

export interface PublicProviderInfo {
  id: string
  type: ProviderType
  models: ModelConfig[]
}

export interface PublicUserSummary {
  id: number
  username: string
  nickname: string | null
  locale: string | null
}

export interface PublicUserLoginMeta {
  enabled: boolean
  mode: UserLoginMode
  authenticated: boolean
  user: PublicUserSummary | null
  sessionTtlHours: number
}

export interface PublicHistoryConfig {
  similarityThreshold: number
  dedupIntervalSeconds: number
  pageSize: number
}

export interface HistoryPageResult {
  entries: TranslationHistoryEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
  paneWidthRatios: PublicPaneWidthRatios
  authRequired: boolean
  restartAuthRequired: boolean
  canRestartBackend: boolean
  authenticated: boolean
  /** TOTP access session TTL from `auth.session_ttl_hours` (for remember-me checkbox). */
  accessSessionTtlHours: number
  translateOnEnter: boolean
  alternativesSeparators: {
    default: AlternativesSeparator
    byLanguage: Record<string, AlternativesSeparator>
  }
  phraseWordThresholds: {
    default: number
    byLanguage: Record<string, number>
  }
  selectionCopyEnabled: boolean
  wordLookupMode: WordLookupMode
  rephraseHoverPreviewEnabled: boolean
  rephraseHoverPreviewDelayMs: number
  rephraseBackTranslationPreload: RephraseBackTranslationPreload
  autoSwapLanguages: boolean
  userLogin: PublicUserLoginMeta
  theme: ThemeColors
  historyConfig: PublicHistoryConfig
}

export interface TranslationHistoryEntry {
  id: number
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
  isFavorite: boolean
  createdAt: number
}

export interface UserProfile {
  id: number
  username: string
  nickname: string | null
  note: string | null
  email: string | null
  phone: string | null
  locale: string | null
  configId: string
  glossaryId: string
  updatedAt: number | null
  lastLoginAt: number | null
  status: string | null
  emailVerifiedAt: number | null
  createdAt: number
}

export interface UserMeProfile {
  id: number
  username: string
  nickname: string | null
  note: string | null
  email: string | null
  phone: string | null
  locale: string | null
  configId: string
  glossaryId: string
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
