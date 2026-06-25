import { useEffect } from 'react'
import type { ThemeColors } from '@parawrite/core/client'

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  primary: '--color-primary',
  accent: '--color-accent',
  background: '--color-background',
  surface: '--color-surface',
  border: '--color-border',
  muted: '--color-muted',
  success: '--color-success',
  error: '--color-error',
  warning: '--color-warning',
  alert: '--color-alert',
}

export function applyTheme(theme: ThemeColors): void {
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(cssVar, theme[key as keyof ThemeColors])
  }
  // Android TWA / PWA status bar — match header surface color
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.surface)
}

export function useTheme(theme: ThemeColors | undefined): void {
  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])
}
