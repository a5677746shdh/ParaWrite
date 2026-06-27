/**
 * Hono application: API routes, optional auth gates, SSE translation, static web dist.
 * Middleware order: CORS → access TOTP gate → route handlers → serveStatic (production).
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serveStatic } from '@hono/node-server/serve-static'
import { getCookie, setCookie } from 'hono/cookie'
import {
  AuthManager,
  buildMessages,
  buildRephrasePrompt,
  buildSynonymsPrompt,
  buildTranslatePrompt,
  DictionaryService,
  getAppRoot,
  getDefaultModel,
  createEngineCache,
  getHistoryConfig,
  getUserLoginMode,
  getUserSessionTtlHours,
  getAccessSessionTtlHours,
  getLoggingConfig,
  getPointOutGlossary,
  GlossaryService,
  isAccessAuthEnabled,
  isRestartAuthEnabled,
  isUserLoginEnabled,
  parseJsonResponse,
  resolveDataDir,
  ASSETLINKS_SERVE_PATH,
  resolveAssetLinksPath,
  loadAssetLinksFile,
  SESSION_COOKIE_NAME,
  toPublicMeta,
  verifyTotp,
  type AppConfig,
  type RephraseOption,
  type SynonymOption,
  type UserProfile,
} from '@parawrite/core'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openDatabase } from './db.js'
import { HistoryService } from './history-service.js'
import { UserError, UserService } from './user-service.js'
import { USER_SESSION_COOKIE_NAME, UserSessionManager } from './user-session.js'
import {
  createEventLogger,
  shouldSkipAppApiErrorLog,
  type EventLogger,
} from './event-log.js'
import { getClientIp } from './client-ip.js'
import {
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
} from './login-attempt-tracker.js'
import { UserResourceCache } from './user-resources.js'
import { isClientAbort } from './request-abort.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type AppEnv = { Variables: { apiErrorLogged?: boolean } }

function logModelRouteError(
  c: { req: { method: string; path: string }; set: (key: 'apiErrorLogged', value: boolean) => void },
  events: EventLogger,
  message: string
): void {
  if (events.modelApiError(c.req.method, c.req.path, message)) {
    c.set('apiErrorLogged', true)
  }
}

function logAppRouteError(
  c: { req: { method: string; path: string }; set: (key: 'apiErrorLogged', value: boolean) => void },
  events: EventLogger,
  message: string
): void {
  if (events.appApiError(c.req.method, c.req.path, message)) {
    c.set('apiErrorLogged', true)
  }
}

const PUBLIC_API_ROUTES = new Set([
  '/api/meta',
  '/api/auth/verify',
  '/api/auth/logout',
  '/api/user/register',
  '/api/user/login',
])

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.has(pathname)
}

function getAuthenticatedProfile(
  userSessionManager: UserSessionManager,
  userService: UserService,
  token: string | undefined
): UserProfile | null {
  const userId = userSessionManager.getUserId(token)
  if (!userId) return null
  return userService.getById(userId)
}

function toPublicUserSummary(profile: UserProfile) {
  return {
    authenticated: true as const,
    user: {
      id: profile.id,
      username: profile.username,
      nickname: profile.nickname,
      locale: profile.locale,
    },
  }
}

export function createApp(config: AppConfig, configPath?: string): Hono<AppEnv> {
  const getEngine = createEngineCache(config)
  const dictionary = new DictionaryService(config, getEngine)
  const appRoot = getAppRoot(configPath)
  const glossary = GlossaryService.fromConfig(appRoot, config.glossary?.file)
  const authManager = new AuthManager(getAccessSessionTtlHours(config))
  const accessAuthEnabled = isAccessAuthEnabled(config)
  const restartAuthEnabled = isRestartAuthEnabled(config)
  const userLoginEnabled = isUserLoginEnabled(config)
  const userLoginMode = getUserLoginMode(config)
  const events = createEventLogger(getLoggingConfig(config))

  let userService: UserService | null = null
  let historyService: HistoryService | null = null
  let userSessionManager: UserSessionManager | null = null
  let userResourceCache: UserResourceCache | null = null

  if (userLoginEnabled) {
    const dataDir = resolveDataDir(config, configPath)
    const db = openDatabase(dataDir)
    userService = new UserService(db)
    const historyConfig = getHistoryConfig(config)
    historyService = new HistoryService(
      db,
      historyConfig.similarityThreshold,
      historyConfig.dedupIntervalSeconds
    )
    userSessionManager = new UserSessionManager(getUserSessionTtlHours(config))
    userResourceCache = new UserResourceCache(config, configPath, glossary)
  }

  const assetLinksPath = resolveAssetLinksPath(config, configPath)
  const assetLinksBody = loadAssetLinksFile(assetLinksPath)

  const app = new Hono<AppEnv>()

  app.use(
    '*',
    cors({
      origin: '*',
      credentials: true,
    })
  )

  app.use('/api/*', async (c, next) => {
    await next()
    if (c.res.status < 400 || c.get('apiErrorLogged')) return

    const pathname = new URL(c.req.url).pathname
    if (shouldSkipAppApiErrorLog(pathname, c.res.status)) return

    try {
      const cloned = c.res.clone()
      const text = await cloned.text()
      let message = `HTTP ${c.res.status}`
      try {
        const json = JSON.parse(text) as { error?: string }
        if (json.error) message = json.error
      } catch {
        if (text.trim()) message = text.trim()
      }
      events.appApiError(c.req.method, pathname, message)
    } catch {
      events.appApiError(c.req.method, pathname, `HTTP ${c.res.status}`)
    }
  })

  app.use('*', async (c, next) => {
    if (!accessAuthEnabled) return next()

    const pathname = new URL(c.req.url).pathname
    if (
      pathname === '/health' ||
      pathname === ASSETLINKS_SERVE_PATH ||
      isPublicApiRoute(pathname)
    ) {
      return next()
    }

    if (pathname.startsWith('/api/')) {
      const token = getCookie(c, SESSION_COOKIE_NAME)
      if (!authManager.isValidSession(token)) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }

    return next()
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.get(ASSETLINKS_SERVE_PATH, (c) => {
    if (!assetLinksBody) {
      return c.json({ error: 'assetlinks not configured' }, 404)
    }
    return c.body(assetLinksBody, 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    })
  })

  app.get('/api/meta', (c) => {
    const token = getCookie(c, SESSION_COOKIE_NAME)
    const authenticated = !accessAuthEnabled || authManager.isValidSession(token)

    const userToken = getCookie(c, USER_SESSION_COOKIE_NAME)
    let userLogin: { authenticated: false; user: null } | ReturnType<typeof toPublicUserSummary> =
      { authenticated: false, user: null }
    let effectiveConfig = config
    let profile: UserProfile | null = null

    if (userService && userSessionManager && userResourceCache) {
      profile = getAuthenticatedProfile(userSessionManager, userService, userToken)
      if (profile) {
        userLogin = toPublicUserSummary(profile)
        effectiveConfig = userResourceCache.getEffectiveConfig(profile)
      }
    }

    const pointOutGlossary = getPointOutGlossary(effectiveConfig)
    let effectiveGlossary = glossary
    if (profile && userResourceCache) {
      effectiveGlossary = userResourceCache.getEffectiveGlossary(profile)
    }

    return c.json({
      ...toPublicMeta(effectiveConfig, authenticated, userLogin),
      glossaryEntries: pointOutGlossary !== 'off' ? effectiveGlossary.getEntries() : [],
    })
  })

  app.post('/api/auth/verify', async (c) => {
    if (!accessAuthEnabled) {
      return c.json({ ok: true, authenticated: true })
    }

    const body = await c.req.json<{ code?: string; rememberMe?: boolean }>()
    const secret = config.auth?.access_totp_secret?.trim()
    if (!secret || !body.code || !verifyTotp(secret, body.code)) {
      events.invalidAccessCode(c)
      return c.json({ error: 'Invalid code' }, 401)
    }

    const token = authManager.createSession()
    const sessionTtlHours = getAccessSessionTtlHours(config)
    const rememberMe = body.rememberMe === true
    setCookie(c, SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      ...(rememberMe ? { maxAge: sessionTtlHours * 60 * 60 } : {}),
    })

    return c.json({ ok: true, authenticated: true })
  })

  app.post('/api/auth/logout', (c) => {
    if (!accessAuthEnabled) {
      return c.json({ ok: true })
    }

    const token = getCookie(c, SESSION_COOKIE_NAME)
    if (token) authManager.revokeSession(token)
    setCookie(c, SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 0,
    })
    return c.json({ ok: true })
  })

  if (userLoginEnabled && userService && userSessionManager && historyService) {
    const allowedUsernames = config.users?.login?.allowed_usernames ?? []
    const userSessionTtlHours = getUserSessionTtlHours(config)

    const setUserCookie = (
      c: Parameters<typeof setCookie>[0],
      token: string,
      rememberMe = true
    ) => {
      setCookie(c, USER_SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'Strict',
        path: '/',
        ...(rememberMe ? { maxAge: userSessionTtlHours * 60 * 60 } : {}),
      })
    }

    app.post('/api/user/register', async (c) => {
      const body = await c.req.json<{
        username?: string
        password?: string
        nickname?: string
        rememberMe?: boolean
      }>()
      if (!body.username?.trim() || !body.password) {
        return c.json({ error: 'Username and password are required' }, 400)
      }

      if (
        userLoginMode === 'restricted' &&
        !userService.isUsernameAllowed(body.username, allowedUsernames)
      ) {
        events.restrictedRegistration(c, body.username)
        return c.json({ error: 'Registration not allowed for this username' }, 403)
      }

      try {
        const profile = await userService.register(body.username, body.password, body.nickname)
        const token = userSessionManager.createSession(profile.id)
        setUserCookie(c, token, body.rememberMe !== false)
        return c.json({
          user: {
            id: profile.id,
            username: profile.username,
            nickname: profile.nickname,
          },
        })
      } catch (err) {
        if (err instanceof UserError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    })

    app.post('/api/user/login', async (c) => {
      const body = await c.req.json<{
        username?: string
        password?: string
        rememberMe?: boolean
      }>()
      if (!body.username?.trim() || !body.password) {
        return c.json({ error: 'Username and password are required' }, 400)
      }

      const profile = await userService.authenticate(body.username, body.password)
      if (!profile) {
        const attemptKey = loginAttemptKey(getClientIp(c), body.username)
        const failures = recordLoginFailure(attemptKey)
        if (failures >= 3) {
          events.loginFailures(c, body.username)
          clearLoginFailures(attemptKey)
        }
        return c.json({ error: 'Invalid username or password' }, 401)
      }

      clearLoginFailures(loginAttemptKey(getClientIp(c), body.username))

      const token = userSessionManager.createSession(profile.id)
      setUserCookie(c, token, body.rememberMe !== false)
      return c.json({
        user: {
          id: profile.id,
          username: profile.username,
          nickname: profile.nickname,
        },
      })
    })

    app.post('/api/user/logout', (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      if (token) userSessionManager.revokeSession(token)
      setCookie(c, USER_SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 0,
      })

      if (accessAuthEnabled) {
        const accessToken = getCookie(c, SESSION_COOKIE_NAME)
        if (accessToken) authManager.revokeSession(accessToken)
        setCookie(c, SESSION_COOKIE_NAME, '', {
          httpOnly: true,
          sameSite: 'Strict',
          path: '/',
          maxAge: 0,
        })
      }

      return c.json({ ok: true })
    })

    app.get('/api/user/me', (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const profile = userService.getById(userId)
      if (!profile) return c.json({ error: 'Unauthorized' }, 401)

      return c.json({
        id: profile.id,
        username: profile.username,
        nickname: profile.nickname,
        note: profile.note,
        email: profile.email,
        phone: profile.phone,
        locale: profile.locale,
        configId: profile.configId,
        glossaryId: profile.glossaryId,
      })
    })

    app.patch('/api/user/locale', async (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const body = await c.req.json<{ locale?: string }>()
      const locale = body.locale?.trim()
      if (!locale) return c.json({ error: 'Locale is required' }, 400)

      try {
        const profile = userService.updateLocale(userId, locale)
        if (!profile) return c.json({ error: 'Unauthorized' }, 401)
        return c.json({ locale: profile.locale })
      } catch (err) {
        if (err instanceof UserError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    })

    app.get('/api/history', (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const filter = c.req.query('filter') === 'favorites' ? 'favorites' : 'all'
      const historyConfig = getHistoryConfig(config)
      const pageSize = Math.min(
        50,
        Math.max(1, Number(c.req.query('pageSize')) || historyConfig.pageSize)
      )
      const page = Math.max(1, Number(c.req.query('page')) || 1)

      const result = historyService.listPage(userId, filter, page, pageSize)
      return c.json(result)
    })

    app.post('/api/history', async (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const body = await c.req.json<{
        sourceText?: string
        targetText?: string
        sourceLang?: string
        targetLang?: string
      }>()

      if (!body.sourceText?.trim() || !body.targetText?.trim()) {
        return c.json({ error: 'Source and target text are required' }, 400)
      }

      const entry = historyService.save(userId, {
        sourceText: body.sourceText,
        targetText: body.targetText,
        sourceLang: body.sourceLang ?? 'auto',
        targetLang: body.targetLang ?? 'en',
      })
      return c.json({ entry })
    })

    app.post('/api/history/favorite', async (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const body = await c.req.json<{
        sourceText?: string
        targetText?: string
        sourceLang?: string
        targetLang?: string
      }>()

      if (!body.sourceText?.trim() || !body.targetText?.trim()) {
        return c.json({ error: 'Source and target text are required' }, 400)
      }

      const entry = historyService.addFavorite(userId, {
        sourceText: body.sourceText,
        targetText: body.targetText,
        sourceLang: body.sourceLang ?? 'auto',
        targetLang: body.targetLang ?? 'en',
      })
      return c.json({ entry })
    })

    app.patch('/api/history/:id/favorite', (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400)

      const entry = historyService.toggleFavorite(userId, id)
      if (!entry) return c.json({ error: 'Not found' }, 404)
      return c.json({ entry })
    })

    app.delete('/api/history/:id', (c) => {
      const token = getCookie(c, USER_SESSION_COOKIE_NAME)
      const userId = userSessionManager.getUserId(token)
      if (!userId) return c.json({ error: 'Unauthorized' }, 401)

      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id)) return c.json({ error: 'Invalid id' }, 400)

      const deleted = historyService.delete(userId, id)
      if (!deleted) return c.json({ error: 'Not found' }, 404)
      return c.json({ ok: true })
    })
  }

  app.post('/api/translate', async (c) => {
    const body = await c.req.json<{
      text: string
      sourceLang: string
      targetLang: string
      provider?: string
      model?: string
    }>()

    if (!body.text?.trim()) {
      return c.json({ error: 'Text is required' }, 400)
    }

    const provider = body.provider ?? config.app.default_provider
    const model = body.model ?? getDefaultModel(config, provider)
    const engine = getEngine(provider)

    const userToken = getCookie(c, USER_SESSION_COOKIE_NAME)
    let effectiveGlossary = glossary
    if (userService && userSessionManager && userResourceCache) {
      const profile = getAuthenticatedProfile(userSessionManager, userService, userToken)
      if (profile) {
        effectiveGlossary = userResourceCache.getEffectiveGlossary(profile)
      }
    }

    const relevantGlossary = effectiveGlossary.findRelevant(body.text, body.sourceLang)
    const glossarySection = effectiveGlossary.buildPromptSection(
      relevantGlossary,
      body.text,
      body.sourceLang,
      body.targetLang
    )
    const prompt = buildTranslatePrompt(
      body.text,
      body.sourceLang,
      body.targetLang,
      glossarySection
    )

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of engine.chatStream({
          model,
          messages: buildMessages(prompt.system, prompt.user),
          temperature: 0.3,
          signal: c.req.raw.signal,
        })) {
          await stream.writeSSE({ data: JSON.stringify({ content: chunk }) })
        }
        await stream.writeSSE({ data: '[DONE]' })
      } catch (error) {
        if (isClientAbort(error, c.req.raw.signal)) return
        const message = error instanceof Error ? error.message : 'Translation failed'
        logModelRouteError(c, events, message)
        await stream.writeSSE({ data: JSON.stringify({ error: message }) })
      }
    })
  })

  app.post('/api/synonyms', async (c) => {
    const body = await c.req.json<{
      word: string
      sentence: string
      sourceText: string
      sourceLang: string
      targetLang: string
      provider?: string
      model?: string
    }>()

    const provider = body.provider ?? config.app.default_provider
    const model = body.model ?? getDefaultModel(config, provider)
    const engine = getEngine(provider)
    const prompt = buildSynonymsPrompt(
      body.word,
      body.sentence,
      body.sourceText,
      body.sourceLang,
      body.targetLang
    )

    try {
      const response = await engine.chat({
        model,
        messages: buildMessages(prompt.system, prompt.user),
        temperature: 0.4,
        signal: c.req.raw.signal,
      })

      const parsed = parseJsonResponse<{ synonyms: SynonymOption[] }>(response)
      return c.json({ synonyms: parsed.synonyms ?? [] })
    } catch (error) {
      if (isClientAbort(error, c.req.raw.signal)) {
        return c.body(null, 204)
      }
      const message = error instanceof Error ? error.message : 'Synonyms request failed'
      logModelRouteError(c, events, message)
      return c.json({ error: message }, 500)
    }
  })

  app.post('/api/rephrase', async (c) => {
    const body = await c.req.json<{
      sentence: string
      sourceText: string
      fullTranslation: string
      sourceLang: string
      targetLang: string
      provider?: string
      model?: string
    }>()

    const provider = body.provider ?? config.app.default_provider
    const model = body.model ?? getDefaultModel(config, provider)
    const engine = getEngine(provider)
    const prompt = buildRephrasePrompt(
      body.sentence,
      body.sourceText,
      body.fullTranslation,
      body.sourceLang,
      body.targetLang
    )

    try {
      const response = await engine.chat({
        model,
        messages: buildMessages(prompt.system, prompt.user),
        temperature: 0.5,
        signal: c.req.raw.signal,
      })

      const parsed = parseJsonResponse<{ alternatives: RephraseOption[] }>(response)
      return c.json({ alternatives: parsed.alternatives ?? [] })
    } catch (error) {
      if (isClientAbort(error, c.req.raw.signal)) {
        return c.body(null, 204)
      }
      const message = error instanceof Error ? error.message : 'Rephrase request failed'
      logModelRouteError(c, events, message)
      return c.json({ error: message }, 500)
    }
  })

  app.post('/api/admin/restart', async (c) => {
    if (restartAuthEnabled) {
      let body: { totpCode?: string } = {}
      try {
        body = await c.req.json<{ totpCode?: string }>()
      } catch {
        body = {}
      }
      const secret = config.auth?.restart_totp_secret?.trim()
      if (!secret || !body.totpCode || !verifyTotp(secret, body.totpCode)) {
        events.invalidRestartCode(c)
        return c.json({ error: 'Invalid restart code' }, 403)
      }
    }

    events.backendRestart(c)
    setTimeout(() => process.exit(0), 300)
    return c.json({ ok: true })
  })

  app.post('/api/dictionary/context', async (c) => {
    const body = await c.req.json<{
      word: string
      sentence: string
      sourceText: string
      sourceLang: string
      targetLang: string
      uiLang?: string
      provider?: string
      model?: string
    }>()

    try {
      const entry = await dictionary.lookupWithContext(
        body.word,
        body.sentence,
        body.sourceText,
        body.sourceLang,
        body.targetLang,
        body.uiLang ?? 'en',
        body.provider ?? config.app.default_provider,
        body.model,
        c.req.raw.signal
      )
      return c.json(entry)
    } catch (error) {
      if (isClientAbort(error, c.req.raw.signal)) {
        return c.body(null, 204)
      }
      const message = error instanceof Error ? error.message : 'Dictionary context failed'
      logModelRouteError(c, events, message)
      return c.json({ error: message }, 500)
    }
  })

  app.onError((err, c) => {
    const message = err instanceof Error ? err.message : 'Internal error'
    logAppRouteError(c, events, message)
    return c.json({ error: message }, 500)
  })

  const webDistPath = path.resolve(__dirname, '../../web/dist')
  if (fs.existsSync(webDistPath)) {
    app.use('*', async (c, next) => {
      await next()
      const pathname = new URL(c.req.url).pathname
      if (
        pathname === '/' ||
        pathname.endsWith('.html') ||
        pathname.endsWith('/sw.js') ||
        pathname.endsWith('/registerSW.js')
      ) {
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    })
    app.use('/*', serveStatic({ root: webDistPath }))
    app.get('*', serveStatic({ path: path.join(webDistPath, 'index.html') }))
  }

  return app
}
