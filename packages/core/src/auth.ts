import { randomBytes } from 'node:crypto'
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

export class AuthManager {
  private readonly sessions = new Map<string, number>()
  private readonly ttlMs: number

  constructor(sessionTtlHours = 24) {
    this.ttlMs = sessionTtlHours * 60 * 60 * 1000
  }

  createSession(): string {
    const token = createSessionToken()
    this.sessions.set(token, Date.now() + this.ttlMs)
    return token
  }

  isValidSession(token: string | undefined): boolean {
    if (!token) return false
    const expiresAt = this.sessions.get(token)
    if (!expiresAt) return false
    if (Date.now() > expiresAt) {
      this.sessions.delete(token)
      return false
    }
    return true
  }

  revokeSession(token: string): void {
    this.sessions.delete(token)
  }
}

export const SESSION_COOKIE_NAME = 'parawrite_session'
