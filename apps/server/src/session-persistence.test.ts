import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { AuthManager, hashSessionToken } from '@parawrite/core'
import { UserSessionManager } from './user-session.js'
import { createAccessSessionStore, createUserSessionStore } from './session-store.js'

const SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  user_key TEXT NOT NULL UNIQUE,
  config_id TEXT NOT NULL UNIQUE,
  glossary_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE access_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(SCHEMA)
  return db
}

describe('session persistence', () => {
  it('access session round-trips through SQLite after restart', () => {
    const db = openTestDb()
    const store = createAccessSessionStore(db)
    const manager1 = new AuthManager(24, { store })
    const token = manager1.createSession({ persist: true })

    const manager2 = new AuthManager(24, { store })
    assert.equal(manager2.isValidSession(token), true)
  })

  it('non-persisted access session fails after new manager', () => {
    const db = openTestDb()
    const store = createAccessSessionStore(db)
    const manager1 = new AuthManager(24, { store })
    const token = manager1.createSession({ persist: false })

    const manager2 = new AuthManager(24, { store })
    assert.equal(manager2.isValidSession(token), false)
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS n FROM access_sessions').get() as { n: number }).n,
      0
    )
  })

  it('user session round-trips through SQLite after restart', () => {
    const db = openTestDb()
    const userId = (
      db
        .prepare(
          `INSERT INTO users (username, password_hash, user_key, config_id, glossary_id, created_at)
           VALUES ('alice', 'hash', 'key', 'cfg', 'glo', ?)`
        )
        .run(Date.now()).lastInsertRowid as number
    )
    const store = createUserSessionStore(db)
    const manager1 = new UserSessionManager(168, { store })
    const token = manager1.createSession(userId, { persist: true })

    const manager2 = new UserSessionManager(168, { store })
    assert.equal(manager2.getUserId(token), userId)
  })

  it('revoke removes persisted session', () => {
    const db = openTestDb()
    const store = createAccessSessionStore(db)
    const manager = new AuthManager(24, { store })
    const token = manager.createSession({ persist: true })
    manager.revokeSession(token)

    const manager2 = new AuthManager(24, { store })
    assert.equal(manager2.isValidSession(token), false)
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS n FROM access_sessions').get() as { n: number }).n,
      0
    )
  })

  it('stores token hash not plaintext', () => {
    const db = openTestDb()
    const store = createAccessSessionStore(db)
    const manager = new AuthManager(24, { store })
    const token = manager.createSession({ persist: true })

    const row = db
      .prepare('SELECT token_hash FROM access_sessions')
      .get() as { token_hash: string }
    assert.equal(row.token_hash, hashSessionToken(token))
    assert.notEqual(row.token_hash, token)
  })

  it('cascade deletes user sessions when user is removed', () => {
    const db = openTestDb()
    const userId = (
      db
        .prepare(
          `INSERT INTO users (username, password_hash, user_key, config_id, glossary_id, created_at)
           VALUES ('bob', 'hash', 'key2', 'cfg2', 'glo2', ?)`
        )
        .run(Date.now()).lastInsertRowid as number
    )
    const store = createUserSessionStore(db)
    const manager = new UserSessionManager(168, { store })
    manager.createSession(userId, { persist: true })

    db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS n FROM user_sessions').get() as { n: number }).n,
      0
    )
  })
})
