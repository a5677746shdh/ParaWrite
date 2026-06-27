import { memo, useEffect, useMemo, type KeyboardEvent, type MutableRefObject } from 'react'
import clsx from 'clsx'
import {
  findGlossaryMarkRanges,
  type GlossaryEntry,
  type PointOutGlossaryMode,
} from '@parawrite/core/client'
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea'
import { GlossaryMarkedText } from './GlossaryMarkedText'
import { paneEditorTextClass, panePlaceholderFieldClass } from '../ui'

interface GlossarySourceEditorProps {
  value: string
  lang: string
  pointOutGlossary: PointOutGlossaryMode
  glossaryEntries: GlossaryEntry[]
  placeholder?: string
  remeasureKey?: string | number
  inputRef?: MutableRefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

export const GlossarySourceEditor = memo(function GlossarySourceEditor({
  value,
  lang,
  pointOutGlossary,
  glossaryEntries,
  placeholder,
  remeasureKey,
  inputRef,
  onChange,
  onKeyDown,
}: GlossarySourceEditorProps) {
  const textareaRef = useAutoResizeTextarea(value, 6, remeasureKey)

  useEffect(() => {
    if (inputRef) {
      inputRef.current = textareaRef.current
    }
  }, [inputRef, textareaRef, value])

  const ranges = useMemo(() => {
    if (pointOutGlossary === 'off' || glossaryEntries.length === 0 || !value) {
      return []
    }
    return findGlossaryMarkRanges(value, glossaryEntries, lang)
  }, [value, lang, glossaryEntries, pointOutGlossary])

  const showMarks = pointOutGlossary !== 'off' && ranges.length > 0

  return (
    <div className="relative w-full">
      {showMarks && (
        <div
          aria-hidden
          className={clsx(
            'pointer-events-none absolute inset-0 overflow-hidden',
            paneEditorTextClass
          )}
        >
          <GlossaryMarkedText
            text={value}
            mode={pointOutGlossary}
            ranges={ranges}
          />
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={clsx(
          'relative block min-h-[6rem] w-full resize-none overflow-hidden border-0 bg-transparent outline-none',
          paneEditorTextClass,
          panePlaceholderFieldClass,
          showMarks && 'text-transparent caret-deepl-blue selection:bg-deepl-accent/20'
        )}
      />
    </div>
  )
})
