/** Username: ASCII letters and digits only, at least 2 characters after trim. */
export const USERNAME_PATTERN = /^[A-Za-z0-9]+$/

export function sanitizeUsernameInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '')
}

export function isValidUsername(username: string): boolean {
  const trimmed = username.trim()
  return trimmed.length >= 2 && USERNAME_PATTERN.test(trimmed)
}
