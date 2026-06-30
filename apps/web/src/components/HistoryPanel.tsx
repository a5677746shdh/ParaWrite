import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import type { TranslationHistoryEntry } from '@parawrite/core/client'
import {
  addHistoryFavorite,
  deleteHistoryBulk,
  type DeleteHistoryBulkBody,
  fetchHistory,
  toggleHistoryFavorite,
} from '../api'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useTranslationStore } from '../store'
import { UserAuthDialog } from './UserAuthDialog'
import { textButtonPx, formInputClass, historyEntryIconButtonClass, historyHeaderIconButtonClass, historyIconButtonShellClass, iconButtonColorClass, iconButtonDeleteClass, iconButtonFavoriteActiveClass } from '../ui'

function HistoryIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

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

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {checked ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" stroke="currentColor" />
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" />
        </>
      ) : (
        <rect x="3" y="3" width="18" height="18" rx="2" />
      )}
    </svg>
  )
}

function HistoryIconButton({
  onClick,
  title,
  disabled = false,
  destructive = false,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        historyIconButtonShellClass,
        destructive && !disabled
          ? iconButtonDeleteClass
          : iconButtonColorClass
      )}
    >
      {children}
    </button>
  )
}

function MoreVerticalIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}

function BackIconWide() {
  return (
    <HistoryIcon>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </HistoryIcon>
  )
}

function BackIconNarrow() {
  return (
    <HistoryIcon>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </HistoryIcon>
  )
}

function HistoryBackIcon() {
  return (
    <>
      <span className="hidden @[480px]/history:inline-flex">
        <BackIconWide />
      </span>
      <span className="inline-flex @[480px]/history:hidden">
        <BackIconNarrow />
      </span>
    </>
  )
}

function SelectAllIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 60 60" fill="currentColor" aria-hidden="true">
      <g transform="matrix(0.058594,0,0,0.058594,0,0)">
        <path d="M870.4,204.8L819.2,204.8L819.2,153.6C819.2,69.338 749.862,0 665.6,0L153.6,0C69.338,0 -0,69.338 0,153.6L0,665.6C0,749.862 69.338,819.2 153.6,819.2L204.8,819.2L204.8,870.4C204.8,954.662 274.138,1024 358.4,1024L870.4,1024C954.662,1024 1024,954.662 1024,870.4L1024,358.4C1024,274.138 954.662,204.8 870.4,204.8ZM204.8,358.4L204.8,716.8L153.6,716.8C125.513,716.8 102.4,693.687 102.4,665.6L102.4,153.6C102.4,125.513 125.513,102.4 153.6,102.4L665.6,102.4C693.687,102.4 716.8,125.513 716.8,153.6L716.8,204.8L358.4,204.8C274.138,204.8 204.8,274.138 204.8,358.4ZM921.6,870.4C921.6,898.487 898.487,921.6 870.4,921.6L358.4,921.6C330.313,921.6 307.2,898.487 307.2,870.4L307.2,358.4C307.2,330.313 330.313,307.2 358.4,307.2L870.4,307.2C898.487,307.2 921.6,330.313 921.6,358.4L921.6,870.4Z" />
      </g>
      <g transform="matrix(0.058594,0,0,0.058594,1,-1)">
        <path d="M813.312,499.968C793.474,480.247 760.958,480.247 741.12,499.968L553.216,687.616L462.592,596.992C452.988,587.388 439.949,581.988 426.368,581.988C398.265,581.988 375.14,605.113 375.14,633.216C375.14,646.797 380.54,659.836 390.144,669.44L515.328,793.6L516.864,795.392C526.464,805.002 539.504,810.408 553.088,810.408C566.672,810.408 579.712,805.002 589.312,795.392L813.312,571.136C833.033,551.298 833.033,518.782 813.312,498.944L813.312,499.968Z" />
      </g>
    </svg>
  )
}

function DeselectAllIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 60 60" fill="currentColor" aria-hidden="true">
      <g transform="matrix(0.058594,0,0,0.058594,0,0)">
        <path d="M870.4,204.8C954.662,204.8 1024,274.138 1024,358.4L1024,870.4C1024,954.662 954.662,1024 870.4,1024L358.4,1024C274.138,1024 204.8,954.662 204.8,870.4L204.8,819.2L153.6,819.2C69.338,819.2 0,749.862 0,665.6L0,153.6C-0,69.338 69.338,0 153.6,0L665.6,0C749.862,0 819.2,69.338 819.2,153.6L819.2,204.8L870.4,204.8ZM543.833,611.926L418.503,737.256C399.306,756.453 399.306,787.624 418.503,806.821C437.7,826.018 468.871,826.018 488.068,806.821L613.398,681.491L738.728,806.821C757.925,826.018 789.096,826.018 808.293,806.821C827.49,787.624 827.49,756.453 808.293,737.256L682.963,611.926L808.293,486.596C827.49,467.399 827.49,436.228 808.293,417.031C789.096,397.834 757.925,397.834 738.728,417.031L613.398,542.361L488.068,417.031C468.871,397.834 437.7,397.834 418.503,417.031C399.306,436.228 399.306,467.399 418.503,486.596L543.833,611.926ZM204.8,358.4C204.8,274.138 274.138,204.8 358.4,204.8L716.8,204.8L716.8,153.6C716.8,125.513 693.687,102.4 665.6,102.4L153.6,102.4C125.513,102.4 102.4,125.513 102.4,153.6L102.4,665.6C102.4,693.687 125.513,716.8 153.6,716.8L204.8,716.8L204.8,358.4Z" />
      </g>
    </svg>
  )
}

const tabButtonClass = (active: boolean) =>
  clsx(
    `flex h-full items-center rounded-md ${textButtonPx} text-sm font-medium`,
    active ? 'bg-deepl-accent text-white' : 'text-deepl-blue hover:bg-deepl-light'
  )

function HistoryAddFavoriteButton({
  onAdded,
  locked,
}: {
  onAdded: () => void
  locked: boolean
}) {
  const { t } = useTranslation()
  const { sourceText, targetText, sourceLang, targetLang } = useTranslationStore(
    useShallow((s) => ({
      sourceText: s.sourceText,
      targetText: s.targetText,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
    }))
  )

  const handleAddFavorite = async () => {
    if (locked || !sourceText.trim() || !targetText.trim()) return
    try {
      await addHistoryFavorite({
        sourceText,
        targetText,
        sourceLang,
        targetLang,
      })
      onAdded()
    } catch {
      // ignore
    }
  }

  const canAdd = sourceText.trim() && targetText.trim() && !locked

  return (
    <button
      type="button"
      onClick={() => void handleAddFavorite()}
      disabled={!canAdd}
      title={locked ? t('historyFavoriteAdded') : t('historyAddFavorite')}
      aria-label={locked ? t('historyFavoriteAdded') : t('historyAddFavorite')}
      className={clsx(historyHeaderIconButtonClass, locked && iconButtonFavoriteActiveClass)}
    >
      <FavoriteIcon filled={locked} />
    </button>
  )
}

function HistoryDeleteConfirmDialog({
  open,
  count,
  deleting,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  count: number
  deleting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  useBodyScrollLock(open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-black/30 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-deepl-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-lg font-semibold text-deepl-blue">
          {t('historyDeleteConfirmTitle')}
        </h2>
        <p className="mt-3 text-center text-sm text-deepl-blue/80">
          {t('historyDeleteConfirmMessage', { count })}
        </p>
        {error && (
          <p className="mt-3 rounded-lg border border-deepl-error/30 bg-deepl-error/10 px-3 py-2 text-center text-sm text-deepl-error">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className={clsx(
              'rounded-lg bg-deepl-error py-2.5 text-sm font-medium text-white hover:bg-deepl-error/90 disabled:opacity-50',
              textButtonPx
            )}
          >
            {t('historyDeleteConfirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className={clsx(
              'rounded-lg bg-deepl-light py-2.5 text-sm text-deepl-blue hover:bg-deepl-border/50 disabled:opacity-50',
              textButtonPx
            )}
          >
            {t('historyDeleteCancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HistoryPanel() {
  const { t } = useTranslation()
  const meta = useTranslationStore((s) => s.meta)
  const refreshMeta = useTranslationStore((s) => s.refreshMeta)
  const historyRefreshKey = useTranslationStore((s) => s.historyRefreshKey)
  const bumpHistoryRefresh = useTranslationStore((s) => s.bumpHistoryRefresh)
  const { sourceText, targetText } = useTranslationStore(
    useShallow((s) => ({
      sourceText: s.sourceText,
      targetText: s.targetText,
    }))
  )

  const [authOpen, setAuthOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'favorites'>('favorites')
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<TranslationHistoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [pinnedFavorite, setPinnedFavorite] = useState<{ source: string; target: string } | null>(
    null
  )
  const [pageInput, setPageInput] = useState('1')
  const [selectionMode, setSelectionMode] = useState(false)
  const [allSelected, setAllSelected] = useState(false)
  const [includedIds, setIncludedIds] = useState<Set<number>>(() => new Set())
  const [excludedIds, setExcludedIds] = useState<Set<number>>(() => new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isCurrentFavorited =
    pinnedFavorite !== null &&
    sourceText === pinnedFavorite.source &&
    targetText === pinnedFavorite.target

  const isSelected = useCallback(
    (id: number) => (allSelected ? !excludedIds.has(id) : includedIds.has(id)),
    [allSelected, excludedIds, includedIds]
  )

  const selectedCount = allSelected ? total - excludedIds.size : includedIds.size

  const isAllSelected =
    total > 0 && (allSelected ? excludedIds.size === 0 : includedIds.size === total)

  const clearSelection = useCallback(() => {
    setAllSelected(false)
    setIncludedIds(new Set())
    setExcludedIds(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    clearSelection()
  }, [clearSelection])

  useEffect(() => {
    if (!pinnedFavorite) return
    if (sourceText !== pinnedFavorite.source || targetText !== pinnedFavorite.target) {
      setPinnedFavorite(null)
    }
  }, [sourceText, targetText, pinnedFavorite])

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
      setTotal(result.total)
      setTotalPages(result.totalPages)
      if (result.page !== page) {
        setPage(result.page)
      }
    } catch {
      setEntries([])
      setTotal(0)
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
      setTotal(0)
      setTotalPages(1)
      exitSelectionMode()
    }
  }, [authenticated, loadHistory, historyRefreshKey, exitSelectionMode])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const handleFilterChange = (next: 'all' | 'favorites') => {
    setFilter(next)
    setPage(1)
    exitSelectionMode()
  }

  const handleAuthSuccess = () => {
    void refreshMeta().then(() => loadHistory())
  }

  const handleFavoriteAdded = useCallback(async () => {
    setPinnedFavorite({ source: sourceText, target: targetText })
    setPage(1)
    const result = await fetchHistory(filter, 1, pageSize)
    setEntries(result.entries)
    setTotal(result.total)
    setTotalPages(result.totalPages)
  }, [filter, pageSize, sourceText, targetText])

  const handleToggleFavorite = async (id: number) => {
    try {
      await toggleHistoryFavorite(id)
      void loadHistory()
    } catch {
      // ignore
    }
  }

  const handleToggleSelect = (id: number) => {
    if (allSelected) {
      setExcludedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
      return
    }

    setIncludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      if (next.size === total) {
        setAllSelected(true)
        setExcludedIds(new Set())
        return new Set()
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection()
      return
    }
    setAllSelected(true)
    setIncludedIds(new Set())
    setExcludedIds(new Set())
  }

  const buildDeletePayload = (): DeleteHistoryBulkBody => {
    if (allSelected && excludedIds.size === 0) {
      return { mode: 'filter', filter }
    }
    if (allSelected && excludedIds.size > 0) {
      return { mode: 'filter', filter, excludeIds: [...excludedIds] }
    }
    return { mode: 'ids', ids: [...includedIds] }
  }

  const handleDeleteConfirm = async () => {
    if (selectedCount <= 0) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteHistoryBulk(buildDeletePayload())
      setDeleteConfirmOpen(false)
      exitSelectionMode()
      bumpHistoryRefresh()
    } catch {
      setDeleteError(t('historyDeleteError'))
    } finally {
      setDeleting(false)
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
      <section className="@container/history mt-4 w-full overflow-hidden rounded-2xl border border-deepl-border bg-deepl-surface shadow-sm">
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
                <HistoryAddFavoriteButton
                  locked={isCurrentFavorited}
                  onAdded={() => void handleFavoriteAdded()}
                />
              </div>
            </div>
          )}
          {isCurrentFavorited && (
            <p className="mt-2 text-right text-xs text-deepl-success">
              {t('historyFavoriteAdded')}
            </p>
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
                        {selectionMode ? (
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(entry.id)}
                            title={
                              isSelected(entry.id)
                                ? t('historyDeselectItem')
                                : t('historySelectItem')
                            }
                            aria-label={
                              isSelected(entry.id)
                                ? t('historyDeselectItem')
                                : t('historySelectItem')
                            }
                            className={historyEntryIconButtonClass}
                          >
                            <CheckboxIcon checked={isSelected(entry.id)} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleToggleFavorite(entry.id)}
                            title={t('historyFavorites')}
                            aria-label={t('historyFavorites')}
                            className={clsx(
                              historyEntryIconButtonClass,
                              entry.isFavorite && iconButtonFavoriteActiveClass
                            )}
                          >
                            <FavoriteIcon filled={entry.isFavorite} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!loading && (
              <div
                className={clsx(
                  'flex flex-col gap-3 border-t border-deepl-border px-4 py-3',
                  '@[480px]/history:flex-row @[480px]/history:items-center @[480px]/history:justify-between @[480px]/history:gap-2'
                )}
              >
                {selectionMode && (
                  <div className="flex items-center justify-between gap-2 @[480px]/history:hidden">
                    <HistoryIconButton
                      onClick={() => setDeleteConfirmOpen(true)}
                      title={t('historyDelete')}
                      disabled={selectedCount <= 0}
                      destructive={selectedCount > 0}
                    >
                      <HistoryIcon>
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </HistoryIcon>
                    </HistoryIconButton>
                    <HistoryIconButton
                      onClick={handleSelectAll}
                      title={isAllSelected ? t('historyDeselectAll') : t('historySelectAll')}
                      disabled={total <= 0}
                    >
                      {isAllSelected ? <DeselectAllIcon /> : <SelectAllIcon />}
                    </HistoryIconButton>
                  </div>
                )}

                {selectionMode && (
                  <div className="hidden shrink-0 @[480px]/history:block @[480px]/history:order-1">
                    <HistoryIconButton
                      onClick={() => setDeleteConfirmOpen(true)}
                      title={t('historyDelete')}
                      disabled={selectedCount <= 0}
                      destructive={selectedCount > 0}
                    >
                      <HistoryIcon>
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </HistoryIcon>
                    </HistoryIconButton>
                  </div>
                )}

                <div className="flex w-full min-w-0 items-center gap-2 @[480px]/history:contents">
                  {totalPages > 1 && (
                    <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-center gap-2 @[480px]/history:order-2 @[480px]/history:flex-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        className={clsx('h-10 shrink-0 rounded-lg border border-deepl-border text-sm hover:bg-deepl-light disabled:opacity-50', textButtonPx)}
                      >
                        {t('historyPagePrev')}
                      </button>
                      <div className="inline-flex h-10 shrink-0 items-center justify-center gap-0 rounded-lg border border-deepl-border px-4 text-sm leading-none">
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
                          className={clsx(formInputClass, 'border-0 bg-transparent p-0 text-center outline-none')}
                          style={{ width: `${Math.max(1, pageInput.length || 1)}ch` }}
                        />
                        <span className="whitespace-nowrap text-deepl-muted"> / {totalPages}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className={clsx('h-10 shrink-0 rounded-lg border border-deepl-border text-sm hover:bg-deepl-light disabled:opacity-50', textButtonPx)}
                      >
                        {t('historyPageNext')}
                      </button>
                    </div>
                  )}

                  {totalPages <= 1 && (
                    <div className="hidden @[480px]/history:order-2 @[480px]/history:block @[480px]/history:flex-1" />
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-2 @[480px]/history:order-3 @[480px]/history:ml-0">
                    {selectionMode && (
                      <div className="hidden @[480px]/history:block">
                        <HistoryIconButton
                          onClick={handleSelectAll}
                          title={isAllSelected ? t('historyDeselectAll') : t('historySelectAll')}
                          disabled={total <= 0}
                        >
                          {isAllSelected ? <DeselectAllIcon /> : <SelectAllIcon />}
                        </HistoryIconButton>
                      </div>
                    )}
                    <HistoryIconButton
                      onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
                      title={selectionMode ? t('historyBack') : t('historyOptions')}
                    >
                      {selectionMode ? <HistoryBackIcon /> : <MoreVerticalIcon />}
                    </HistoryIconButton>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <HistoryDeleteConfirmDialog
        open={deleteConfirmOpen}
        count={selectedCount}
        deleting={deleting}
        error={deleteError}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDeleteError(null)
        }}
      />

      <UserAuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        sessionTtlHours={userLogin?.sessionTtlHours ?? 168}
      />
    </>
  )
}
