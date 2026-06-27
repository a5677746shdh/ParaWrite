import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

/** Minimum source pane width (stats or translate button row). */
export const PANE_FOOTER_MIN_WIDTH = '12.5rem'

/** Minimum target pane width (lookup + icon buttons). */
export const TARGET_PANE_MIN_WIDTH = '16rem'

const SOURCE_NARROW_WIDTH_PX = 280
const TARGET_NARROW_WIDTH_PX = 360

interface PaneFooterProps {
  variant?: 'source' | 'target'
  stats: ReactNode
  leading?: ReactNode
  actions: ReactNode
}

export const PaneFooter = memo(function PaneFooter({
  variant = 'source',
  stats,
  leading,
  actions,
}: PaneFooterProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const hasLeading = variant === 'target' && !!leading
  const targetWide = hasLeading && !narrow

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const threshold = hasLeading ? TARGET_NARROW_WIDTH_PX : SOURCE_NARROW_WIDTH_PX
    const update = (width: number) => {
      setNarrow((prev) => {
        const next = width < threshold
        return prev === next ? prev : next
      })
    }

    update(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasLeading])

  return (
    <div
      ref={ref}
      className={clsx(
        'mt-auto flex w-full shrink-0 pt-3',
        targetWide && 'flex-row items-center gap-2',
        !targetWide && narrow && 'flex-col items-end gap-1.5',
        !targetWide && !narrow && 'flex-row items-center justify-between gap-3'
      )}
    >
      {targetWide ? (
        <>
          <div className="shrink-0">{leading}</div>
          <div className="flex min-w-0 flex-1 justify-center whitespace-nowrap px-1">{stats}</div>
          <div className="flex shrink-0 gap-2">{actions}</div>
        </>
      ) : hasLeading && narrow ? (
        <>
          <div className="whitespace-nowrap">{stats}</div>
          <div className="flex w-full items-center justify-between gap-2">
            <div className="shrink-0">{leading}</div>
            <div className="flex shrink-0 gap-2">{actions}</div>
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 whitespace-nowrap">{stats}</div>
          <div className="flex shrink-0 gap-2">{actions}</div>
        </>
      )}
    </div>
  )
})
