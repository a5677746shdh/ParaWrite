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
  GlossaryService,
  isAccessAuthEnabled,
  isRestartAuthEnabled,
  parseJsonResponse,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PUBLIC_API_ROUTES = new Set(['/api/meta', '/api/auth/verify'])

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.has(pathname)
}

export function createApp(config: AppConfig, configPath?: string): Hono {
  const dictionary = new DictionaryService(config)
  const configDir = getConfigDir(configPath)
  const glossary = GlossaryService.fromConfig(configDir, config.glossary?.file)
  const authManager = new AuthManager(config.auth?.session_ttl_hours ?? 24)
  const accessAuthEnabled = isAccessAuthEnabled(config)
  const restartAuthEnabled = isRestartAuthEnabled(config)

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
    return c.json(toPublicMeta(config, authenticated))
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
    app.use('/*', serveStatic({ root: webDistPath }))
    app.get('*', serveStatic({ path: path.join(webDistPath, 'index.html') }))
  }

  return app
}
