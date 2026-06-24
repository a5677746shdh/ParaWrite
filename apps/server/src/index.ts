import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { BUILD_VERSION, loadConfig } from '@parawrite/core'

const startedAt = new Date()

let config
try {
  config = loadConfig()
} catch (error) {
  console.error('Failed to load config:', error)
  process.exit(1)
}

const app = createApp(config)

serve(
  {
    fetch: app.fetch,
    hostname: config.server.host,
    port: config.server.port,
  },
  (info) => {
    const elapsedMs = Date.now() - startedAt.getTime()
    console.log(
      `[${startedAt.toISOString()}] ParaWrite ${BUILD_VERSION} started in ${elapsedMs}ms — http://localhost:${info.port}`
    )
  }
)
