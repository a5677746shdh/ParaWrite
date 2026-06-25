/**
 * In-memory user session store keyed by parawrite_user cookie.
 * rememberMe=false omits maxAge on the cookie (browser session); rememberMe=true uses sessionTtlHours.
 */
import { createSessionToken } from '@parawrite/core'

export const USER_SESSION_COOKIE_NAME = 'parawrite_user'

export class UserSessionManager {
  private readonly sessions = new Map<string, { userId: number; expiresAt: number }>()
  private readonly ttlMs: number

  constructor(sessionTtlHours = 168) {
    this.ttlMs = sessionTtlHours * 60 * 60 * 1000
  }

  createSession(userId: number): string {
    const token = createSessionToken()
    this.sessions.set(token, { userId, expiresAt: Date.now() + this.ttlMs })
    return token
  }

  getUserId(token: string | undefined): number | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      return null
    }
    return session.userId
  }

  revokeSession(token: string): void {
    this.sessions.delete(token)
  }
}
