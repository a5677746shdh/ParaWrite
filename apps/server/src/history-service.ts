import { textSimilarity } from '@parawrite/core'
import type { TranslationHistoryEntry } from '@parawrite/core'
import type { AppDatabase } from './db.js'

interface HistoryRow {
  id: number
  user_id: number
  source_text: string
  target_text: string
  source_lang: string
  target_lang: string
  is_favorite: number
  created_at: number
}

function rowToEntry(row: HistoryRow): TranslationHistoryEntry {
  return {
    id: row.id,
    sourceText: row.source_text,
    targetText: row.target_text,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
  }
}

export interface SaveHistoryInput {
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
}

export class HistoryService {
  private readonly stmtListAll
  private readonly stmtListFavorites
  private readonly stmtCountAll
  private readonly stmtCountFavorites
  private readonly stmtUpdateDedup
  private readonly stmtSelectById
  private readonly stmtInsert
  private readonly stmtFindMatching
  private readonly stmtPromoteFavorite
  private readonly stmtUpdateFavoriteDedup
  private readonly stmtToggleFavorite
  private readonly stmtDelete
  private readonly stmtGetLatestNonFavorite

  constructor(
    private readonly db: AppDatabase,
    private readonly similarityThreshold: number,
    private readonly dedupIntervalSeconds: number
  ) {
    this.stmtListAll = db.prepare(
      `SELECT * FROM translation_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    this.stmtListFavorites = db.prepare(
      `SELECT * FROM translation_history
       WHERE user_id = ? AND is_favorite = 1
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    this.stmtCountAll = db.prepare(
      `SELECT COUNT(*) as count FROM translation_history WHERE user_id = ?`
    )
    this.stmtCountFavorites = db.prepare(
      `SELECT COUNT(*) as count FROM translation_history
       WHERE user_id = ? AND is_favorite = 1`
    )
    this.stmtUpdateDedup = db.prepare(
      `UPDATE translation_history
       SET source_text = ?, target_text = ?, source_lang = ?, target_lang = ?, created_at = ?
       WHERE id = ? AND user_id = ?`
    )
    this.stmtSelectById = db.prepare('SELECT * FROM translation_history WHERE id = ?')
    this.stmtInsert = db.prepare(
      `INSERT INTO translation_history
       (user_id, source_text, target_text, source_lang, target_lang, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    this.stmtFindMatching = db.prepare(
      `SELECT * FROM translation_history
       WHERE user_id = ?
         AND source_text = ?
         AND target_text = ?
         AND source_lang = ?
         AND target_lang = ?
       ORDER BY is_favorite ASC, created_at DESC
       LIMIT 1`
    )
    this.stmtPromoteFavorite = db.prepare(
      `UPDATE translation_history SET is_favorite = 1, created_at = ? WHERE id = ? AND user_id = ?`
    )
    this.stmtUpdateFavoriteDedup = db.prepare(
      `UPDATE translation_history
       SET source_text = ?, target_text = ?, source_lang = ?, target_lang = ?,
           is_favorite = 1, created_at = ?
       WHERE id = ? AND user_id = ?`
    )
    this.stmtToggleFavorite = db.prepare(
      'UPDATE translation_history SET is_favorite = ? WHERE id = ? AND user_id = ?'
    )
    this.stmtDelete = db.prepare('DELETE FROM translation_history WHERE id = ? AND user_id = ?')
    this.stmtGetLatestNonFavorite = db.prepare(
      `SELECT * FROM translation_history
       WHERE user_id = ? AND is_favorite = 0
       ORDER BY created_at DESC
       LIMIT 1`
    )
  }

  list(
    userId: number,
    filter: 'all' | 'favorites',
    limit = 50,
    offset = 0
  ): TranslationHistoryEntry[] {
    const rows = (
      filter === 'favorites' ? this.stmtListFavorites : this.stmtListAll
    ).all(userId, limit, offset) as HistoryRow[]

    return rows.map(rowToEntry)
  }

  count(userId: number, filter: 'all' | 'favorites'): number {
    const row = (
      filter === 'favorites' ? this.stmtCountFavorites : this.stmtCountAll
    ).get(userId) as { count: number }
    return row.count
  }

  listPage(
    userId: number,
    filter: 'all' | 'favorites',
    page: number,
    pageSize: number
  ) {
    const total = this.count(userId, filter)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const offset = (safePage - 1) * pageSize
    const entries = this.list(userId, filter, pageSize, offset)
    return { entries, total, page: safePage, pageSize, totalPages }
  }

  save(userId: number, input: SaveHistoryInput): TranslationHistoryEntry {
    const now = Date.now()
    const last = this.getLatestNonFavorite(userId)

    if (
      last &&
      textSimilarity(input.sourceText, last.source_text) >= this.similarityThreshold &&
      now - last.created_at < this.dedupIntervalSeconds * 1000
    ) {
      this.stmtUpdateDedup.run(
        input.sourceText,
        input.targetText,
        input.sourceLang,
        input.targetLang,
        now,
        last.id,
        userId
      )

      const updated = this.stmtSelectById.get(last.id) as HistoryRow
      return rowToEntry(updated)
    }

    const result = this.stmtInsert.run(
      userId,
      input.sourceText,
      input.targetText,
      input.sourceLang,
      input.targetLang,
      0,
      now
    )

    const row = this.stmtSelectById.get(result.lastInsertRowid) as HistoryRow
    return rowToEntry(row)
  }

  addFavorite(userId: number, input: SaveHistoryInput): TranslationHistoryEntry {
    const now = Date.now()
    const existing = this.findMatchingEntry(userId, input)

    if (existing) {
      if (existing.is_favorite === 1) {
        return rowToEntry(existing)
      }
      this.stmtPromoteFavorite.run(now, existing.id, userId)

      const updated = this.stmtSelectById.get(existing.id) as HistoryRow
      return rowToEntry(updated)
    }

    const last = this.getLatestNonFavorite(userId)
    if (
      last &&
      textSimilarity(input.sourceText, last.source_text) >= this.similarityThreshold &&
      now - last.created_at < this.dedupIntervalSeconds * 1000
    ) {
      this.stmtUpdateFavoriteDedup.run(
        input.sourceText,
        input.targetText,
        input.sourceLang,
        input.targetLang,
        now,
        last.id,
        userId
      )

      const updated = this.stmtSelectById.get(last.id) as HistoryRow
      return rowToEntry(updated)
    }

    const result = this.stmtInsert.run(
      userId,
      input.sourceText,
      input.targetText,
      input.sourceLang,
      input.targetLang,
      1,
      now
    )

    const row = this.stmtSelectById.get(result.lastInsertRowid) as HistoryRow
    return rowToEntry(row)
  }

  toggleFavorite(userId: number, id: number): TranslationHistoryEntry | null {
    const row = this.stmtSelectById.get(id) as HistoryRow | undefined
    if (!row || row.user_id !== userId) return null

    const newFavorite = row.is_favorite === 1 ? 0 : 1
    this.stmtToggleFavorite.run(newFavorite, id, userId)

    const updated = this.stmtSelectById.get(id) as HistoryRow
    return rowToEntry(updated)
  }

  delete(userId: number, id: number): boolean {
    const result = this.stmtDelete.run(id, userId)
    return result.changes > 0
  }

  deleteMany(userId: number, ids: number[]): number {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id)))]
    if (uniqueIds.length === 0) return 0

    const placeholders = uniqueIds.map(() => '?').join(', ')
    const stmt = this.db.prepare(
      `DELETE FROM translation_history WHERE user_id = ? AND id IN (${placeholders})`
    )
    return this.db.transaction(() => stmt.run(userId, ...uniqueIds).changes)()
  }

  deleteByFilter(
    userId: number,
    filter: 'all' | 'favorites',
    excludeIds: number[] = []
  ): number {
    const uniqueExcludeIds = [...new Set(excludeIds.filter((id) => Number.isFinite(id)))]
    const excludeClause =
      uniqueExcludeIds.length > 0
        ? ` AND id NOT IN (${uniqueExcludeIds.map(() => '?').join(', ')})`
        : ''
    const favoriteClause = filter === 'favorites' ? ' AND is_favorite = 1' : ''
    const stmt = this.db.prepare(
      `DELETE FROM translation_history WHERE user_id = ?${favoriteClause}${excludeClause}`
    )
    return this.db.transaction(() => stmt.run(userId, ...uniqueExcludeIds).changes)()
  }

  private getLatestNonFavorite(userId: number): HistoryRow | undefined {
    return this.stmtGetLatestNonFavorite.get(userId) as HistoryRow | undefined
  }

  private findMatchingEntry(
    userId: number,
    input: SaveHistoryInput
  ): HistoryRow | undefined {
    return this.stmtFindMatching.get(
      userId,
      input.sourceText,
      input.targetText,
      input.sourceLang,
      input.targetLang
    ) as HistoryRow | undefined
  }
}
