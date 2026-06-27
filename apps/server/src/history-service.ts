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
  constructor(
    private readonly db: AppDatabase,
    private readonly similarityThreshold: number,
    private readonly dedupIntervalSeconds: number
  ) {}

  list(
    userId: number,
    filter: 'all' | 'favorites',
    limit = 50,
    offset = 0
  ): TranslationHistoryEntry[] {
    const favoriteClause = filter === 'favorites' ? 'AND is_favorite = 1' : ''
    const rows = this.db
      .prepare(
        `SELECT * FROM translation_history
         WHERE user_id = ? ${favoriteClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, limit, offset) as HistoryRow[]

    return rows.map(rowToEntry)
  }

  count(userId: number, filter: 'all' | 'favorites'): number {
    const favoriteClause = filter === 'favorites' ? 'AND is_favorite = 1' : ''
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM translation_history
         WHERE user_id = ? ${favoriteClause}`
      )
      .get(userId) as { count: number }
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
      this.db
        .prepare(
          `UPDATE translation_history
           SET source_text = ?, target_text = ?, source_lang = ?, target_lang = ?, created_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(
          input.sourceText,
          input.targetText,
          input.sourceLang,
          input.targetLang,
          now,
          last.id,
          userId
        )

      const updated = this.db
        .prepare('SELECT * FROM translation_history WHERE id = ?')
        .get(last.id) as HistoryRow
      return rowToEntry(updated)
    }

    const result = this.db
      .prepare(
        `INSERT INTO translation_history
         (user_id, source_text, target_text, source_lang, target_lang, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
        userId,
        input.sourceText,
        input.targetText,
        input.sourceLang,
        input.targetLang,
        now
      )

    const row = this.db
      .prepare('SELECT * FROM translation_history WHERE id = ?')
      .get(result.lastInsertRowid) as HistoryRow
    return rowToEntry(row)
  }

  addFavorite(userId: number, input: SaveHistoryInput): TranslationHistoryEntry {
    const now = Date.now()
    const existing = this.findMatchingEntry(userId, input)

    if (existing) {
      if (existing.is_favorite === 1) {
        return rowToEntry(existing)
      }
      this.db
        .prepare(
          `UPDATE translation_history
           SET is_favorite = 1, created_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(now, existing.id, userId)

      const updated = this.db
        .prepare('SELECT * FROM translation_history WHERE id = ?')
        .get(existing.id) as HistoryRow
      return rowToEntry(updated)
    }

    const last = this.getLatestNonFavorite(userId)
    if (
      last &&
      textSimilarity(input.sourceText, last.source_text) >= this.similarityThreshold &&
      now - last.created_at < this.dedupIntervalSeconds * 1000
    ) {
      this.db
        .prepare(
          `UPDATE translation_history
           SET source_text = ?, target_text = ?, source_lang = ?, target_lang = ?,
               is_favorite = 1, created_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(
          input.sourceText,
          input.targetText,
          input.sourceLang,
          input.targetLang,
          now,
          last.id,
          userId
        )

      const updated = this.db
        .prepare('SELECT * FROM translation_history WHERE id = ?')
        .get(last.id) as HistoryRow
      return rowToEntry(updated)
    }

    const result = this.db
      .prepare(
        `INSERT INTO translation_history
         (user_id, source_text, target_text, source_lang, target_lang, is_favorite, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        userId,
        input.sourceText,
        input.targetText,
        input.sourceLang,
        input.targetLang,
        now
      )

    const row = this.db
      .prepare('SELECT * FROM translation_history WHERE id = ?')
      .get(result.lastInsertRowid) as HistoryRow
    return rowToEntry(row)
  }

  toggleFavorite(userId: number, id: number): TranslationHistoryEntry | null {
    const row = this.db
      .prepare('SELECT * FROM translation_history WHERE id = ? AND user_id = ?')
      .get(id, userId) as HistoryRow | undefined
    if (!row) return null

    const newFavorite = row.is_favorite === 1 ? 0 : 1
    this.db
      .prepare('UPDATE translation_history SET is_favorite = ? WHERE id = ? AND user_id = ?')
      .run(newFavorite, id, userId)

    const updated = this.db
      .prepare('SELECT * FROM translation_history WHERE id = ?')
      .get(id) as HistoryRow
    return rowToEntry(updated)
  }

  delete(userId: number, id: number): boolean {
    const result = this.db
      .prepare('DELETE FROM translation_history WHERE id = ? AND user_id = ?')
      .run(id, userId)
    return result.changes > 0
  }

  private getLatestNonFavorite(userId: number): HistoryRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM translation_history
         WHERE user_id = ? AND is_favorite = 0
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(userId) as HistoryRow | undefined
  }

  private findMatchingEntry(
    userId: number,
    input: SaveHistoryInput
  ): HistoryRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM translation_history
         WHERE user_id = ?
           AND source_text = ?
           AND target_text = ?
           AND source_lang = ?
           AND target_lang = ?
         ORDER BY is_favorite ASC, created_at DESC
         LIMIT 1`
      )
      .get(
        userId,
        input.sourceText,
        input.targetText,
        input.sourceLang,
        input.targetLang
      ) as HistoryRow | undefined
  }
}
