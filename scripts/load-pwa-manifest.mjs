import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const PRIVATE_MANIFEST = path.join(root, 'config/manifest.json')
const EXAMPLE_MANIFEST = path.join(root, 'config/manifest.example.json')

/** PWA manifest: `config/manifest.json` when present, else `config/manifest.example.json`. */
export function loadPwaManifest() {
  const file = fs.existsSync(PRIVATE_MANIFEST) ? PRIVATE_MANIFEST : EXAMPLE_MANIFEST
  if (!fs.existsSync(file)) {
    throw new Error(`PWA manifest not found: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

export const pwaManifestPaths = {
  private: PRIVATE_MANIFEST,
  example: EXAMPLE_MANIFEST,
  privateIconsDir: path.join(root, 'config/icons'),
  publicIconsDir: path.join(root, 'apps/web/public/icons'),
}

/** Overlay private manifest and optional `config/icons/` onto a built web dist folder. */
export function applyPrivatePwaToWebDist(webDistDir) {
  if (fs.existsSync(PRIVATE_MANIFEST)) {
    const manifest = JSON.parse(fs.readFileSync(PRIVATE_MANIFEST, 'utf-8'))
    fs.writeFileSync(
      path.join(webDistDir, 'manifest.webmanifest'),
      `${JSON.stringify(manifest, null, 2)}\n`
    )
  }

  const privateIconsDir = pwaManifestPaths.privateIconsDir
  if (!fs.existsSync(privateIconsDir)) return

  const destIconsDir = path.join(webDistDir, 'icons')
  fs.mkdirSync(destIconsDir, { recursive: true })
  for (const name of fs.readdirSync(privateIconsDir)) {
    const from = path.join(privateIconsDir, name)
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(destIconsDir, name))
    }
  }
}
