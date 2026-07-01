/**
 * SQLite-backed session stores for access and user login tokens.
 * Tokens are stored as SHA-256 hashes; plain tokens remain in httpOnly cookies only.
 */
import type { SessionStore } from '@parawrite/core'
import type { AppDatabase } from './db.js'

export function createAccessSessionStore(db: AppDatabase): SessionStore {
  const stmtSave = db.prepare(
    'INSERT OR REPLACE INTO access_sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)'
  )
  const stmtFind = db.prepare(
    'SELECT expires_at FROM access_sessions WHERE token_hash = ?'
  )
  const stmtDelete = db.prepare('DELETE FROM access_sessions WHERE token_hash = ?')

  return {
    save(tokenHash, record) {
      stmtSave.run(tokenHash, record.expiresAt, Date.now())
    },
    find(tokenHash) {
      const row = stmtFind.get(tokenHash) as { expires_at: number } | undefined
      if (!row) return null
      return { expiresAt: row.expires_at }
    },
    delete(tokenHash) {
      stmtDelete.run(tokenHash)
    },
  }
}

export function createUserSessionStore(db: AppDatabase): SessionStore {
  const stmtSave = db.prepare(
    'INSERT OR REPLACE INTO user_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  )
  const stmtFind = db.prepare(
    'SELECT user_id, expires_at FROM user_sessions WHERE token_hash = ?'
  )
  const stmtDelete = db.prepare('DELETE FROM user_sessions WHERE token_hash = ?')

  return {
    save(tokenHash, record) {
      if (record.userId === undefined) return
      stmtSave.run(tokenHash, record.userId, record.expiresAt, Date.now())
    },
    find(tokenHash) {
      const row = stmtFind.get(tokenHash) as { user_id: number; expires_at: number } | undefined
      if (!row) return null
      return { expiresAt: row.expires_at, userId: row.user_id }
    },
    delete(tokenHash) {
      stmtDelete.run(tokenHash)
    },
  }
}
