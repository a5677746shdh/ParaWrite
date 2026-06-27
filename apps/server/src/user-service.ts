import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { UserProfile } from '@parawrite/core'
import { isValidUsername, isUiLocaleCode } from '@parawrite/core'
import type { AppDatabase } from './db.js'

const scryptAsync = promisify(scrypt)
const SCRYPT_KEYLEN = 64

interface UserRow {
  id: number
  username: string
  password_hash: string
  nickname: string | null
  note: string | null
  email: string | null
  phone: string | null
  locale: string | null
  user_key: string
  config_id: string
  glossary_id: string
  updated_at: number | null
  last_login_at: number | null
  status: string | null
  email_verified_at: number | null
  created_at: number
}

function rowToProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    note: row.note,
    email: row.email,
    phone: row.phone,
    locale: row.locale,
    configId: row.config_id,
    glossaryId: row.glossary_id,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

function generateUserKey(): string {
  return randomBytes(32).toString('hex')
}

export class UserService {
  constructor(private readonly db: AppDatabase) {}

  async register(
    username: string,
    password: string,
    nickname?: string
  ): Promise<UserProfile> {
    const trimmedUsername = username.trim()
    if (!isValidUsername(trimmedUsername)) {
      throw new UserError('Username must be 2+ letters or numbers (A-Z, a-z, 0-9)')
    }
    if (!password || password.length < 4) {
      throw new UserError('Password must be at least 4 characters')
    }

    const passwordHash = await hashPassword(password)
    const now = Date.now()
    const userKey = generateUserKey()
    const configId = randomUUID()
    const glossaryId = randomUUID()

    try {
      const result = this.db
        .prepare(
          `INSERT INTO users (
             username, password_hash, nickname, note,
             email, phone, locale, user_key, config_id, glossary_id,
             updated_at, last_login_at, status, email_verified_at, created_at
           )
           VALUES (?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, ?)`
        )
        .run(
          trimmedUsername,
          passwordHash,
          nickname?.trim() || null,
          userKey,
          configId,
          glossaryId,
          now
        )

      const row = this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(result.lastInsertRowid) as UserRow

      return rowToProfile(row)
    } catch (err) {
      if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new UserError('Username already exists')
      }
      throw err
    }
  }

  async authenticate(username: string, password: string): Promise<UserProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username.trim()) as UserRow | undefined

    if (!row) return null
    const valid = await verifyPassword(password, row.password_hash)
    if (!valid) return null

    const now = Date.now()
    this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, row.id)

    return rowToProfile({ ...row, last_login_at: now })
  }

  getById(id: number): UserProfile | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined
    return row ? rowToProfile(row) : null
  }

  getUserKeyById(id: number): string | null {
    const row = this.db
      .prepare('SELECT user_key FROM users WHERE id = ?')
      .get(id) as { user_key: string } | undefined
    return row?.user_key ?? null
  }

  isUsernameAllowed(username: string, allowedUsernames: string[]): boolean {
    const normalized = username.trim().toLowerCase()
    return allowedUsernames.some((u) => u.trim().toLowerCase() === normalized)
  }

  updateLocale(userId: number, locale: string): UserProfile | null {
    if (!isUiLocaleCode(locale)) {
      throw new UserError('Invalid locale code')
    }
    const now = Date.now()
    const result = this.db
      .prepare('UPDATE users SET locale = ?, updated_at = ? WHERE id = ?')
      .run(locale, now, userId)
    if (result.changes === 0) return null
    return this.getById(userId)
  }
}

export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}
