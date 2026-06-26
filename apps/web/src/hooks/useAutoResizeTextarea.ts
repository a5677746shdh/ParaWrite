import { useLayoutEffect, useRef } from 'react'

const MIN_HEIGHT_REM = 6

function measureTextarea(el: HTMLTextAreaElement, minHeightRem: number): void {
  const minPx = minHeightRem * 16
  el.style.height = '0px'
  el.style.height = `${Math.max(el.scrollHeight, minPx)}px`
}

/** Grow textarea height with content; Safari iOS does not support field-sizing: content reliably. */
export function useAutoResizeTextarea(
  value: string,
  minHeightRem = MIN_HEIGHT_REM,
  /** Re-run measurement when layout or pane width changes (e.g. 3-column → 2-column). */
  remeasureKey?: string | number
) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const resize = () => {
      measureTextarea(el, minHeightRem)
      requestAnimationFrame(() => measureTextarea(el, minHeightRem))
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, minHeightRem, remeasureKey])

  return ref
}
