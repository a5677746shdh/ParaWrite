import { useLayoutEffect, useRef } from 'react'

const MIN_HEIGHT_REM = 6

/** Grow textarea height with content; Safari iOS does not support field-sizing: content reliably. */
export function useAutoResizeTextarea(value: string, minHeightRem = MIN_HEIGHT_REM) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const minPx = minHeightRem * 16
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, minPx)}px`
  }, [value, minHeightRem])

  return ref
}
