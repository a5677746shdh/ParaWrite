#!/usr/bin/env node
import { rmSync, rmdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const distPaths = [
  'packages/core/dist',
  'apps/server/dist',
  'apps/web/dist',
  'apps/web/dev-dist',
]

const emptyDirs = [
  'packages/core/src/users',
  'apps/server/src/db',
  'apps/server/src/routes',
]

for (const rel of distPaths) {
  const abs = path.join(root, rel)
  try {
    rmSync(abs, { recursive: true, force: true })
    console.log(`removed ${rel}`)
  } catch (err) {
    console.warn(`skip ${rel}:`, err instanceof Error ? err.message : err)
  }
}

for (const rel of emptyDirs) {
  const abs = path.join(root, rel)
  try {
    rmdirSync(abs)
    console.log(`removed empty ${rel}`)
  } catch {
    // directory missing or not empty — ignore
  }
}
