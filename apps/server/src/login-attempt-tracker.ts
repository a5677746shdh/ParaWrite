const failures = new Map<string, number>()

export function loginAttemptKey(ip: string | undefined, username: string): string {
  return `${ip ?? 'unknown'}:${username.trim().toLowerCase()}`
}

/** Returns the new consecutive failure count after recording one failed attempt. */
export function recordLoginFailure(key: string): number {
  const count = (failures.get(key) ?? 0) + 1
  failures.set(key, count)
  return count
}

export function clearLoginFailures(key: string): void {
  failures.delete(key)
}
