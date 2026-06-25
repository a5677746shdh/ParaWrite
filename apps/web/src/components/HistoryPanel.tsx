import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import type { TranslationHistoryEntry } from '@parawrite/core/client'
import {
  addHistoryFavorite,
  fetchHistory,
  toggleHistoryFavorite,
} from '../api'
import { useTranslationStore } from '../store'
import { UserAuthDialog } from './UserAuthDialog'
import { textButtonPx } from '../ui'

function FavoriteIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

const tabButtonClass = (active: boolean) =>
  clsx(
    `flex h-full items-center rounded-md ${textButtonPx} text-sm font-medium`,
    active ? 'bg-deepl-accent text-white' : 'text-deepl-blue hover:bg-deepl-light'
  )

export function HistoryPanel() {
  const { t } = useTranslation()
  const meta = useTranslationStore((s) => s.meta)
  const sourceText = useTranslationStore((s) => s.sourceText)
  const targetText = useTranslationStore((s) => s.targetText)
  const sourceLang = useTranslationStore((s) => s.sourceLang)
  const targetLang = useTranslationStore((s) => s.targetLang)
  const refreshMeta = useTranslationStore((s) => s.refreshMeta)
  const historyRefreshKey = useTranslationStore((s) => s.historyRefreshKey)

  const [authOpen, setAuthOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'favorites'>('favorites')
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<TranslationHistoryEntry[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState('1')

  const userLogin = meta?.userLogin
  const enabled = userLogin?.enabled ?? false
  const authenticated = userLogin?.authenticated ?? false
  const displayName = userLogin?.user?.nickname || userLogin?.user?.username
  const pageSize = meta?.historyConfig.pageSize ?? 5

  const loadHistory = useCallback(async () => {
    if (!authenticated) return
    setLoading(true)
    try {
      const result = await fetchHistory(filter, page, pageSize)
      setEntries(result.entries)
      setTotalPages(result.totalPages)
      if (result.page !== page) {
        setPage(result.page)
      }
    } catch {
      setEntries([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [authenticated, filter, page, pageSize])

  useEffect(() => {
    if (authenticated) {
      void loadHistory()
    } else {
      setEntries([])
      setTotalPages(1)
    }
  }, [authenticated, loadHistory, historyRefreshKey])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const handleFilterChange = (next: 'all' | 'favorites') => {
    setFilter(next)
    setPage(1)
  }

  const handleAuthSuccess = () => {
    void refreshMeta().then(() => loadHistory())
  }

  const handleAddFavorite = async () => {
    if (!sourceText.trim() || !targetText.trim()) return
    try {
      await addHistoryFavorite({
        sourceText,
        targetText,
        sourceLang,
        targetLang,
      })
      setFavoriteMessage(t('historyFavoriteAdded'))
      setTimeout(() => setFavoriteMessage(null), 2000)
      setPage(1)
      const result = await fetchHistory(filter, 1, pageSize)
      setEntries(result.entries)
      setTotalPages(result.totalPages)
    } catch {
      // ignore
    }
  }

  const handleToggleFavorite = async (id: number) => {
    try {
      await toggleHistoryFavorite(id)
      void loadHistory()
    } catch {
      // ignore
    }
  }

  const handlePageJump = () => {
    const trimmed = pageInput.trim()
    if (!trimmed) {
      setPageInput(String(page))
      return
    }
    const target = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(target)) {
      setPageInput(String(page))
      return
    }
    const clamped = Math.min(Math.max(1, target), totalPages)
    setPageInput(String(clamped))
    if (clamped !== page) {
      setPage(clamped)
    }
  }

  if (!enabled) return null

  return (
    <>
      <section className="mt-4 w-full overflow-hidden rounded-2xl border border-deepl-border bg-deepl-surface shadow-sm">
        <div className="border-b border-deepl-border px-4 py-3">
          {!authenticated ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-deepl-blue/70">{t('historyLoginHint')}</p>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className={clsx('h-10 rounded-lg bg-deepl-accent text-sm font-medium text-white hover:bg-deepl-accent/90', textButtonPx)}
              >
                {t('historyLogin')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-deepl-blue">{t('historyTitle')}</h2>
                {displayName && (
                  <span className="text-xs text-deepl-muted">
                    {t('loggedInAs', { name: displayName })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 rounded-lg border border-deepl-border p-0.5">
                  <button
                    type="button"
                    onClick={() => handleFilterChange('favorites')}
                    className={tabButtonClass(filter === 'favorites')}
                  >
                    {t('historyFavorites')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('all')}
                    className={tabButtonClass(filter === 'all')}
                  >
                    {t('historyAll')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddFavorite()}
                  disabled={!sourceText.trim() || !targetText.trim()}
                  title={t('historyAddFavorite')}
                  aria-label={t('historyAddFavorite')}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-deepl-border text-deepl-blue hover:bg-deepl-light disabled:opacity-50"
                >
                  <FavoriteIcon filled={false} />
                </button>
              </div>
            </div>
          )}
          {favoriteMessage && (
            <p className="mt-2 text-xs text-deepl-success">{favoriteMessage}</p>
          )}
        </div>

        {authenticated && (
          <>
            <div className="p-4">
              {loading ? (
                <p className="text-sm text-deepl-muted">{t('loading')}</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-deepl-muted">{t('historyEmpty')}</p>
              ) : (
                <ul className="divide-y divide-deepl-border">
                  {entries.map((entry) => (
                    <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-relaxed text-deepl-blue">
                            {entry.targetText}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-deepl-muted">
                            {entry.sourceText}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleToggleFavorite(entry.id)}
                          title={t('historyFavorites')}
                          aria-label={t('historyFavorites')}
                          className={clsx(
                            'shrink-0 rounded p-1',
                            entry.isFavorite
                              ? 'text-deepl-warning'
                              : 'text-deepl-muted hover:text-deepl-blue'
                          )}
                        >
                          <FavoriteIcon filled={entry.isFavorite} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-deepl-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className={clsx('h-10 rounded-lg border border-deepl-border text-sm hover:bg-deepl-light disabled:opacity-50', textButtonPx)}
                >
                  {t('historyPagePrev')}
                </button>
                <div className="inline-flex h-10 items-center justify-center rounded-lg border border-deepl-border px-4 text-sm">
                  <span className="inline-flex items-center leading-none">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                      onBlur={handlePageJump}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          ;(e.currentTarget as HTMLInputElement).blur()
                        }
                      }}
                      aria-label={t('historyPageJumpLabel')}
                      className="border-0 bg-transparent p-0 text-center text-deepl-blue outline-none"
                      style={{ width: `${Math.max(1, pageInput.length || 1)}ch` }}
                    />
                    <span className="whitespace-nowrap text-deepl-muted"> / {totalPages}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className={clsx('h-10 rounded-lg border border-deepl-border text-sm hover:bg-deepl-light disabled:opacity-50', textButtonPx)}
                >
                  {t('historyPageNext')}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <UserAuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        sessionTtlHours={userLogin?.sessionTtlHours ?? 168}
      />
    </>
  )
}
