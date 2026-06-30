/** @type {import('tailwindcss').Config} */
import containerQueries from '@tailwindcss/container-queries'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        deepl: {
          blue: 'var(--color-primary)',
          accent: 'var(--color-accent)',
          light: 'var(--color-background)',
          border: 'var(--color-border)',
          muted: 'var(--color-muted)',
          surface: 'var(--color-surface)',
          success: 'var(--color-success)',
          error: 'var(--color-error)',
          warning: 'var(--color-warning)',
          alert: 'var(--color-alert)',
          icon: 'var(--color-icon-button)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [containerQueries],
}
