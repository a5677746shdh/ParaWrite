import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { UserProfile } from '@parawrite/core'
import { isValidUsername } from '@parawrite/core'
import type { AppDatabase } from './db.js'

const scryptAsync = promisify(scrypt)
const SCRYPT_KEYLEN = 64

interface UserRow {
  id: number
  username: string
  password_hash: string
  nickname: string | null
  note: string | null
  created_at: number
}

function rowToProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    note: row.note,
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

    try {
      const result = this.db
        .prepare(
          `INSERT INTO users (username, password_hash, nickname, note, created_at)
           VALUES (?, ?, ?, NULL, ?)`
        )
        .run(trimmedUsername, passwordHash, nickname?.trim() || null, now)

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
    return rowToProfile(row)
  }

  getById(id: number): UserProfile | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined
    return row ? rowToProfile(row) : null
  }

  isUsernameAllowed(username: string, allowedUsernames: string[]): boolean {
    const normalized = username.trim().toLowerCase()
    return allowedUsernames.some((u) => u.trim().toLowerCase() === normalized)
  }
}

export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}
