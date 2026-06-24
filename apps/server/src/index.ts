import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { BUILD_VERSION, findConfigPath, loadConfig } from '@parawrite/core'

const startedAt = new Date()

let config
let configPath: string
try {
  configPath = findConfigPath()
  config = loadConfig(configPath)
} catch (error) {
  console.error('Failed to load config:', error)
  process.exit(1)
}

const app = createApp(config, configPath)

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
