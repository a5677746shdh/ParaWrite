/** Horizontal padding for standard labeled text buttons (`px-6`, 1.5rem). */
export const textButtonPx = 'px-6'

/** Source/target pane editor body text. */
export const paneEditorTextClass = 'text-lg leading-relaxed text-deepl-blue'

/** Empty source/target pane hint (muted placeholder). */
export const panePlaceholderClass = 'text-deepl-muted'

/** Native textarea placeholder — pair with `paneEditorTextClass`. */
export const panePlaceholderFieldClass = 'placeholder:text-deepl-muted'

/** Translation pane footer icon buttons (copy, speak, clear). */
export const paneIconButtonClass =
  'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-deepl-border bg-white hover:bg-deepl-light disabled:opacity-50'

/** Source pane muted clear icon when text is present. */
export const paneClearIconClass = 'text-deepl-blue/40'

/** Translation pane footer outline accent text button (e.g. manual lookup). */
export const paneOutlineAccentButtonClass =
  'flex h-[34px] shrink-0 items-center justify-center rounded-lg border border-deepl-accent bg-white text-sm text-deepl-accent hover:bg-deepl-accent/10 disabled:opacity-50'

/** Selected word token highlight in the target editor. */
export const wordSelectionClass = 'bg-deepl-accent/25 ring-2 ring-deepl-accent/40'

/** Deselect control — matches word selection styling. */
export const wordSelectionCancelButtonClass =
  'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-deepl-accent/25 ring-2 ring-deepl-accent/40 text-deepl-accent hover:bg-deepl-accent/35'

/** Circular close control for modal/sheet panels. */
export const modalCloseButtonClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deepl-light text-deepl-blue/70 hover:bg-deepl-border/60'

/** Active speak button — pulsing accent glow while TTS is playing. */
export const speakActiveButtonClass = 'speak-active-glow border-deepl-accent bg-deepl-accent/10 text-deepl-accent'

/** Compact synonym chips in the word panel. */
export const optionChipClass =
  'rounded-lg border border-deepl-accent/30 bg-deepl-accent/10 px-2 py-1 text-sm hover:bg-deepl-accent/20'

/** Compact alternative-expression rows in the word panel. */
export const optionListButtonClass =
  'w-full rounded-lg border border-deepl-border px-2 py-1.5 text-left text-sm hover:border-deepl-accent hover:bg-deepl-light'
