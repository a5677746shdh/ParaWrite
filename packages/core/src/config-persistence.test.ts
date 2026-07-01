import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { AppConfig } from './types.js'
import {
  getUserSessionPersistenceMode,
  isAccessSessionPersistent,
  shouldClearAccessOnUserLogout,
  shouldPersistAccessSession,
  shouldPersistUserSession,
} from './config.js'

const baseConfig = {
  server: { host: '0.0.0.0', port: 8787 },
  app: { default_provider: 'openai' },
  providers: {
    openai: {
      type: 'openai_compatible' as const,
      base_url: 'https://api.openai.com/v1',
      models: [{ id: 'gpt-4o-mini', name: 'Mini', default: true }],
    },
  },
  dictionary: { free_dictionary: true, wiktionary: true, llm_fallback: true, llm_show_examples: false },
} satisfies AppConfig

describe('session persistence config', () => {
  it('defaults to disabled modes', () => {
    assert.equal(getUserSessionPersistenceMode(baseConfig), 'disabled')
    assert.equal(isAccessSessionPersistent(baseConfig), false)
  })

  it('requires rememberMe for access persistence', () => {
    const config: AppConfig = {
      ...baseConfig,
      auth: { access_totp_secret: 'secret', persistent_sessions: true },
    }
    assert.equal(isAccessSessionPersistent(config), true)
    assert.equal(shouldPersistAccessSession(config, false), false)
    assert.equal(shouldPersistAccessSession(config, true), true)
  })

  it('user persistence respects mode and allowlist', () => {
    const config: AppConfig = {
      ...baseConfig,
      users: {
        login: {
          mode: 'open',
          persistent_sessions: 'restricted',
          allowed_usernames: ['Alice'],
        },
      },
    }
    assert.equal(shouldPersistUserSession(config, 'alice', false), false)
    assert.equal(shouldPersistUserSession(config, 'alice', true), true)
    assert.equal(shouldPersistUserSession(config, 'bob', true), false)
    assert.equal(shouldPersistUserSession(config, 'bob', false), false)
  })

  it('user persistence all mode', () => {
    const config: AppConfig = {
      ...baseConfig,
      users: { login: { mode: 'open', persistent_sessions: 'all' } },
    }
    assert.equal(shouldPersistUserSession(config, 'anyone', true), true)
    assert.equal(shouldPersistUserSession(config, 'anyone', false), false)
  })

  it('clear access on user logout defaults to false', () => {
    assert.equal(shouldClearAccessOnUserLogout(baseConfig), false)
    const config: AppConfig = {
      ...baseConfig,
      users: { login: { mode: 'open', clear_access_on_logout: true } },
    }
    assert.equal(shouldClearAccessOnUserLogout(config), true)
  })
})
