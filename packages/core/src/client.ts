export * from './types.js'
export * from './segmenter.js'
export { detectTextLanguage } from './lang-detect.js'
export { BUILD_VERSION } from './version.generated.js'
export { splitAlternatives } from './segmenter.js'
export { diffHighlight } from './diff.js'
export { isValidUsername, sanitizeUsernameInput } from './username.js'
export { resolvePaneWidthRatios } from './layout.js'
export {
  collectGlossaryTermsInText,
  findGlossaryMarkRanges,
  findGlossaryOccurrences,
} from './glossary.js'
export type { CharRange } from './glossary.js'
export type { PaneWidthRatioResult, PublicPaneWidthRatios } from './types.js'
export type {
  AlternativesSeparator,
  GlossaryEntry,
  PointOutGlossaryMode,
  HistoryPageResult,
  PublicMeta,
  PublicUserSummary,
  ThemeColors,
  TranslationHistoryEntry,
  UserProfile,
  UserMeProfile,
} from './types.js'
export type { DiffPart } from './diff.js'
