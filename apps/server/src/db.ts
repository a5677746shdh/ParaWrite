/**
 * SQLite schema for users and translation history.
 * Index on (user_id, created_at DESC) supports paginated history queries.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  username          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT NOT NULL,
  nickname          TEXT,
  note              TEXT,
  email             TEXT,
  phone             TEXT,
  locale            TEXT,
  user_key          TEXT NOT NULL UNIQUE,
  config_id         TEXT NOT NULL UNIQUE,
  glossary_id       TEXT NOT NULL UNIQUE,
  updated_at        INTEGER,
  last_login_at     INTEGER,
  status            TEXT,
  email_verified_at INTEGER,
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS translation_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_text  TEXT NOT NULL,
  target_text  TEXT NOT NULL,
  source_lang  TEXT NOT NULL,
  target_lang  TEXT NOT NULL,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_user_time
  ON translation_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_dedup
  ON translation_history(user_id, source_lang, target_lang, source_text, target_lang);

CREATE INDEX IF NOT EXISTS idx_history_dedup_target
  ON translation_history(user_id, source_lang, target_lang, source_text, target_text);

CREATE INDEX IF NOT EXISTS idx_history_recent_non_fav
  ON translation_history(user_id, created_at DESC)
  WHERE is_favorite = 0;
`

export function openDatabase(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true })
  const dbPath = path.join(dataDir, 'parawrite.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

export type AppDatabase = Database.Database
