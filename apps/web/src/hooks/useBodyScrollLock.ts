import { useEffect } from 'react'

/** Lock document scroll while overlays are open (iOS-safe fixed-body technique). */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const { style } = document.body
    const prev = {
      overflow: style.overflow,
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
    }

    style.overflow = 'hidden'
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.width = '100%'

    return () => {
      style.overflow = prev.overflow
      style.position = prev.position
      style.top = prev.top
      style.left = prev.left
      style.right = prev.right
      style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
