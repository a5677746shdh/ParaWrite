#!/usr/bin/env node
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const removePaths = [
  'packages/core/dist',
  'apps/server/dist',
  'apps/web/dist',
  'apps/web/dev-dist',
  'artifacts/parawrite-beta',
  'apps/web/tsconfig.tsbuildinfo',
  'apps/server/tsconfig.tsbuildinfo',
]

for (const rel of removePaths) {
  const abs = path.join(root, rel)
  try {
    rmSync(abs, { recursive: true, force: true })
    console.log(`removed ${rel}`)
  } catch (err) {
    console.warn(`skip ${rel}:`, err instanceof Error ? err.message : err)
  }
}
