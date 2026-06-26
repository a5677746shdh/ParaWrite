import type { ResolvedLoggingConfig } from '@parawrite/core'
import { getClientIp } from './client-ip.js'

type RequestContext = {
  req: { header: (name: string) => string | undefined }
}

function formatSecurityExtras(
  logging: ResolvedLoggingConfig,
  c: RequestContext,
  username?: string
): string {
  const parts: string[] = []
  if (logging.include_client_ip) {
    const ip = getClientIp(c)
    if (ip) parts.push(`ip=${ip}`)
  }
  if (logging.include_user_input && username?.trim()) {
    parts.push(`username=${username.trim()}`)
  }
  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

function writeSecurityEvent(
  logging: ResolvedLoggingConfig,
  enabled: boolean,
  c: RequestContext,
  message: string,
  username?: string
): void {
  if (!enabled) return
  console.error(`[parawrite] ${message}${formatSecurityExtras(logging, c, username)}`)
}

export function createEventLogger(logging: ResolvedLoggingConfig) {
  return {
    invalidAccessCode(c: RequestContext) {
      writeSecurityEvent(logging, logging.invalid_access_code, c, 'invalid access code')
    },

    invalidRestartCode(c: RequestContext) {
      writeSecurityEvent(logging, logging.invalid_restart_code, c, 'invalid restart code')
    },

    restrictedRegistration(c: RequestContext, username: string) {
      writeSecurityEvent(
        logging,
        logging.restricted_registration,
        c,
        'restricted registration attempt',
        username
      )
    },

    loginFailures(c: RequestContext, username: string) {
      writeSecurityEvent(logging, logging.login_failures, c, 'login failed 3 times', username)
    },

    backendRestart(c: RequestContext) {
      writeSecurityEvent(logging, logging.backend_restart, c, 'backend restart requested')
    },

    appApiError(method: string, path: string, message: string): boolean {
      if (!logging.app_api_errors) return false
      console.error(`[parawrite] ${method} ${path}: ${message}`)
      return true
    },

    modelApiError(method: string, path: string, message: string): boolean {
      if (!logging.model_api_errors) return false
      console.error(`[parawrite] ${method} ${path}: ${message}`)
      return true
    },
  }
}

export type EventLogger = ReturnType<typeof createEventLogger>

/** Routes handled by dedicated security event logs; skip generic app API error middleware. */
export function shouldSkipAppApiErrorLog(pathname: string, status: number): boolean {
  if (status < 400) return false
  if (pathname === '/api/auth/verify' && status === 401) return true
  if (pathname === '/api/admin/restart' && status === 403) return true
  if (pathname === '/api/user/register' && status === 403) return true
  if (pathname === '/api/user/login' && status === 401) return true
  return false
}
