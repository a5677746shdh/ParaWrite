const FAILURE_TTL_MS = 24 * 60 * 60 * 1000

interface FailureEntry {
  count: number
  updatedAt: number
}

const failures = new Map<string, FailureEntry>()

function pruneStaleFailures(now = Date.now()): void {
  for (const [key, entry] of failures) {
    if (now - entry.updatedAt > FAILURE_TTL_MS) {
      failures.delete(key)
    }
  }
}

export function loginAttemptKey(ip: string | undefined, username: string): string {
  return `${ip ?? 'unknown'}:${username.trim().toLowerCase()}`
}

/** Returns the new consecutive failure count after recording one failed attempt. */
export function recordLoginFailure(key: string): number {
  pruneStaleFailures()
  const now = Date.now()
  const count = (failures.get(key)?.count ?? 0) + 1
  failures.set(key, { count, updatedAt: now })
  return count
}

export function clearLoginFailures(key: string): void {
  failures.delete(key)
}
