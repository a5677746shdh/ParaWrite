import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { applyPrivatePwaToWebDist } from './load-pwa-manifest.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'artifacts', 'parawrite-beta')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
const version = pkg.version

const BETA_DOCKERFILE = `FROM node:22-alpine
RUN apk add --no-cache wget python3 make g++ \\
  && corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod \\
  && apk del python3 make g++

COPY server-dist ./apps/server/dist
COPY web-dist ./apps/web/dist
COPY core-dist ./packages/core/dist

EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
`

const BETA_COMPOSE = `services:
  parawrite:
    build:
      context: .
      dockerfile: Dockerfile
    image: parawrite:${version}
    container_name: parawrite-beta
    ports:
      - '13536:8787'
    volumes:
      - /vol1/1000/DockerFiles/paraWriteBeta/config:/app/config
      - /vol1/1000/DockerFiles/paraWriteBeta/data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:8787/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
`

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(from, to)
    } else {
      fs.copyFileSync(from, to)
    }
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

console.log(`Packaging ParaWrite beta v${version}...`)

execSync('pnpm build', { cwd: root, stdio: 'inherit' })

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true })
}
fs.mkdirSync(outDir, { recursive: true })

copyDir(path.join(root, 'apps/web/dist'), path.join(outDir, 'web-dist'))
applyPrivatePwaToWebDist(path.join(outDir, 'web-dist'))
copyDir(path.join(root, 'apps/server/dist'), path.join(outDir, 'server-dist'))
copyDir(path.join(root, 'packages/core/dist'), path.join(outDir, 'core-dist'))

copyFile(path.join(root, 'package.json'), path.join(outDir, 'package.json'))
copyFile(path.join(root, 'pnpm-workspace.yaml'), path.join(outDir, 'pnpm-workspace.yaml'))
copyFile(path.join(root, 'pnpm-lock.yaml'), path.join(outDir, 'pnpm-lock.yaml'))
copyFile(
  path.join(root, 'apps/server/package.json'),
  path.join(outDir, 'apps/server/package.json')
)
copyFile(
  path.join(root, 'packages/core/package.json'),
  path.join(outDir, 'packages/core/package.json')
)

copyFile(
  path.join(root, 'config/config.example.yaml'),
  path.join(outDir, 'config/config.example.yaml')
)
copyFile(
  path.join(root, 'config/config.docker.example.yaml'),
  path.join(outDir, 'config/config.docker.example.yaml')
)
copyFile(
  path.join(root, 'config/manifest.example.json'),
  path.join(outDir, 'config/manifest.example.json')
)
copyFile(
  path.join(root, 'config/assetlinks.example.json'),
  path.join(outDir, 'config/assetlinks.example.json')
)
for (const name of [
  'glossary.example.yaml',
  'user.config.example.yaml',
  'user.glossary.example.yaml',
]) {
  copyFile(path.join(root, 'config', name), path.join(outDir, 'config', name))
}
copyFile(path.join(root, 'CHANGELOG.md'), path.join(outDir, 'CHANGELOG.md'))
copyFile(path.join(root, 'CHANGELOG.zh-CN.md'), path.join(outDir, 'CHANGELOG.zh-CN.md'))
copyFile(path.join(root, 'README.md'), path.join(outDir, 'README.md'))
copyFile(path.join(root, 'LICENSE'), path.join(outDir, 'LICENSE'))

fs.writeFileSync(path.join(outDir, 'Dockerfile'), BETA_DOCKERFILE)
fs.writeFileSync(path.join(outDir, 'docker-compose.yml'), BETA_COMPOSE)

const manifest = {
  name: 'parawrite-beta',
  version,
  builtAt: new Date().toISOString(),
  layout: {
    'web-dist': 'Static frontend (served by server)',
    'server-dist': 'Hono API server',
    'core-dist': 'Shared core package',
    Dockerfile: 'Self-contained image build from pre-built artifacts',
    'docker-compose.yml': 'Beta deployment compose (port 13536)',
    config: 'Example configuration — mount host config dir in compose',
    data: 'SQLite user data — mount host data dir in compose',
  },
  docker: {
    build: 'docker compose up --build',
    port: 13536,
    configMount: '/vol1/1000/DockerFiles/paraWriteBeta/config:/app/config',
    dataMount: '/vol1/1000/DockerFiles/paraWriteBeta/data:/app/data',
    health: 'GET /health',
  },
}

fs.writeFileSync(path.join(outDir, 'VERSION.json'), JSON.stringify(manifest, null, 2))
fs.writeFileSync(path.join(outDir, 'VERSION'), `${version}\n`)

console.log(`\nBeta package written to: ${outDir}`)
console.log('Deploy: cd artifacts/parawrite-beta && docker compose up --build')
