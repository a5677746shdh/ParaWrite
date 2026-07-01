/**
 * Deployment access auth: TOTP verification and in-memory session tokens.
 * Separate from user login (UserSessionManager in apps/server).
 */
import { createHash, randomBytes } from 'node:crypto'
import { authenticator } from 'otplib'

authenticator.options = { window: 1 }

export function verifyTotp(secret: string, code: string): boolean {
  if (!secret?.trim() || !code?.trim()) return false
  try {
    return authenticator.verify({ token: code.trim(), secret: secret.trim() })
  } catch {
    return false
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionRecord {
  expiresAt: number
  userId?: number
}

export interface SessionStore {
  save(tokenHash: string, record: SessionRecord): void
  find(tokenHash: string): SessionRecord | null
  delete(tokenHash: string): void
}

export interface AuthManagerOptions {
  store?: SessionStore
}

export class AuthManager {
  private readonly sessions = new Map<string, number>()
  private readonly ttlMs: number
  private readonly store?: SessionStore

  constructor(sessionTtlHours = 24, options?: AuthManagerOptions) {
    this.ttlMs = sessionTtlHours * 60 * 60 * 1000
    this.store = options?.store
  }

  createSession(options?: { persist?: boolean }): string {
    const token = createSessionToken()
    const expiresAt = Date.now() + this.ttlMs
    this.sessions.set(token, expiresAt)
    if (options?.persist && this.store) {
      this.store.save(hashSessionToken(token), { expiresAt })
    }
    return token
  }

  isValidSession(token: string | undefined): boolean {
    if (!token) return false

    let expiresAt = this.sessions.get(token)
    if (expiresAt === undefined && this.store) {
      const record = this.store.find(hashSessionToken(token))
      if (record && Date.now() <= record.expiresAt) {
        expiresAt = record.expiresAt
        this.sessions.set(token, expiresAt)
      }
    }

    if (expiresAt === undefined) return false
    if (Date.now() > expiresAt) {
      this.sessions.delete(token)
      if (this.store) this.store.delete(hashSessionToken(token))
      return false
    }
    return true
  }

  revokeSession(token: string): void {
    this.sessions.delete(token)
    if (this.store) this.store.delete(hashSessionToken(token))
  }
}

export const SESSION_COOKIE_NAME = 'parawrite_session'
