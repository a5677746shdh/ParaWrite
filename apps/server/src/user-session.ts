/**
 * User session store keyed by parawrite_user cookie.
 * rememberMe=false: browser session cookie + in-memory only.
 * rememberMe=true with persistence enabled: also stored in SQLite for restart survival.
 */
import {
  createSessionToken,
  hashSessionToken,
  type SessionStore,
} from '@parawrite/core'

export const USER_SESSION_COOKIE_NAME = 'parawrite_user'

export interface UserSessionManagerOptions {
  store?: SessionStore
}

export class UserSessionManager {
  private readonly sessions = new Map<string, { userId: number; expiresAt: number }>()
  private readonly ttlMs: number
  private readonly store?: SessionStore

  constructor(sessionTtlHours = 168, options?: UserSessionManagerOptions) {
    this.ttlMs = sessionTtlHours * 60 * 60 * 1000
    this.store = options?.store
  }

  createSession(userId: number, options?: { persist?: boolean }): string {
    const token = createSessionToken()
    const expiresAt = Date.now() + this.ttlMs
    this.sessions.set(token, { userId, expiresAt })
    if (options?.persist && this.store) {
      this.store.save(hashSessionToken(token), { expiresAt, userId })
    }
    return token
  }

  getUserId(token: string | undefined): number | null {
    if (!token) return null

    let session = this.sessions.get(token)
    if (!session && this.store) {
      const record = this.store.find(hashSessionToken(token))
      if (record?.userId !== undefined && Date.now() <= record.expiresAt) {
        session = { userId: record.userId, expiresAt: record.expiresAt }
        this.sessions.set(token, session)
      }
    }

    if (!session) return null
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      if (this.store) this.store.delete(hashSessionToken(token))
      return null
    }
    return session.userId
  }

  revokeSession(token: string): void {
    this.sessions.delete(token)
    if (this.store) this.store.delete(hashSessionToken(token))
  }
}
