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
  getConfigDir,
  getDefaultModel,
  getEngineForProvider,
  getHistoryConfig,
  getUserLoginMode,
  getUserSessionTtlHours,
  GlossaryService,
  isAccessAuthEnabled,
  isRestartAuthEnabled,
  isUserLoginEnabled,
  parseJsonResponse,
  resolveDataDir,
  SESSION_COOKIE_NAME,
  toPublicMeta,
  verifyTotp,
  type AppConfig,
  type RephraseOption,
  type SynonymOption,
} from '@parawrite/core'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openDatabase } from './db.js'
import { HistoryService } from './history-service.js'
import { UserError, UserService } from './user-service.js'
import { USER_SESSION_COOKIE_NAME, UserSessionManager } from './user-session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PUBLIC_API_ROUTES = new Set([
  '/api/meta',
  '/api/auth/verify',
  '/api/user/register',
  '/api/user/login',
])

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.has(pathname)
}

function getUserLoginMeta(
  userSessionManager: UserSessionManager,
  userService: UserService,
  token: string | undefined
) {
  const userId = userSessionManager.getUserId(token)
  if (!userId) {
    return { authenticated: false, user: null }
  }
  const profile = userService.getById(userId)
  if (!profile) {
    return { authenticated: false, user: null }
  }
  return {
    authenticated: true,
    user: {
      id: profile.id,
      username: profile.username,
      nickname: profile.nickname,
    },
  }
}

export function createApp(config: AppConfig, configPath?: string): Hono {
  const dictionary = new DictionaryService(config)
  const configDir = getConfigDir(configPath)
  const glossary = GlossaryService.fromConfig(configDir, config.glossary?.file)
  const authManager = new AuthManager(config.auth?.session_ttl_hours ?? 24)
  const accessAuthEnabled = isAccessAuthEnabled(config)
  const restartAuthEnabled = isRestartAuthEnabled(config)
  const userLoginEnabled = isUserLoginEnabled(config)
  const userLoginMode = getUserLoginMode(config)

  let userService: UserService | null = null
  let historyService: HistoryService | null = null
  let userSessionManager: UserSessionManager | null = null

  if (userLoginEnabled) {
    const dataDir = resolveDataDir(config, configDir)
    const db = openDatabase(dataDir)
    userService = new UserService(db)
    const historyConfig = getHistoryConfig(config)
    historyService = new HistoryService(
      db,
      historyConfig.similarityThreshold,
      historyConfig.dedupIntervalSeconds
    )
    userSessionManager = new UserSessionManager(getUserSessionTtlHours(config))
  }

  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: '*',
      credentials: true,
    })
  )

  app.use('*', async (c, next) => {
    if (!accessAuthEnabled) return next()

    const pathname = new URL(c.req.url).pathname
    if (pathname === '/health' || isPublicApiRoute(pathname)) {
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

  app.get('/api/meta', (c) => {
    const token = getCookie(c, SESSION_COOKIE_NAME)
    const authenticated = !accessAuthEnabled || authManager.isValidSession(token)

    const userToken = getCookie(c, USER_SESSION_COOKIE_NAME)
    const userLogin =
      userLoginEnabled && userService && userSessionManager
        ? getUserLoginMeta(userSessionManager, userService, userToken)
        : { authenticated: false, user: null }

    return c.json(toPublicMeta(config, authenticated, userLogin))
  })

  app.post('/api/auth/verify', async (c) => {
    if (!accessAuthEnabled) {
      return c.json({ ok: true, authenticated: true })
    }

    const body = await c.req.json<{ code?: string }>()
    const secret = config.auth?.access_totp_secret?.trim()
    if (!secret || !body.code || !verifyTotp(secret, body.code)) {
      return c.json({ error: 'Invalid code' }, 401)
    }

    const token = authManager.createSession()
    setCookie(c, SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: (config.auth?.session_ttl_hours ?? 24) * 60 * 60,
    })

    return c.json({ ok: true, authenticated: true })
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
        return c.json({ error: 'Invalid username or password' }, 401)
      }

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
      })
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
    const engine = getEngineForProvider(config, provider)

    const relevantGlossary = glossary.findRelevant(body.text, body.sourceLang)
    const glossarySection = glossary.buildPromptSection(
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
        const message = error instanceof Error ? error.message : 'Translation failed'
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
    const engine = getEngineForProvider(config, provider)
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
      const message = error instanceof Error ? error.message : 'Synonyms request failed'
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
    const engine = getEngineForProvider(config, provider)
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
      const message = error instanceof Error ? error.message : 'Rephrase request failed'
      return c.json({ error: message }, 500)
    }
  })

  app.get('/api/dictionary/:lang/:word', async (c) => {
    const lang = c.req.param('lang')
    const word = c.req.param('word')

    try {
      const entry = await dictionary.lookup(lang, decodeURIComponent(word))
      if (!entry) {
        return c.json({ error: 'Not found' }, 404)
      }
      return c.json(entry)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dictionary lookup failed'
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
        return c.json({ error: 'Invalid restart code' }, 403)
      }
    }

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
        body.model
      )
      return c.json(entry)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dictionary context failed'
      return c.json({ error: message }, 500)
    }
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
