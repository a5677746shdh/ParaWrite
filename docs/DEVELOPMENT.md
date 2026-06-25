# Development

## Setup

```bash
pnpm install
cp config/parawrite.example.yaml config/parawrite.yaml
export OPENAI_API_KEY=your-key-here
pnpm dev
```

`pnpm dev` runs in parallel:

- `packages/core` — `tsc --watch`
- `apps/server` — `tsx watch` on port 8787
- `apps/web` — Vite dev server on port 5173 (proxies `/api` to 8787)

## Scripts (root `package.json`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Development with hot reload |
| `pnpm build` | Build core, web, and server |
| `pnpm start` | Production server (rebuilds web first) |
| `pnpm lint` | Typecheck all packages |
| `pnpm package:beta` | Build and collect `artifacts/parawrite-beta/` |

`predev` and `prebuild` run `scripts/generate-version.mjs`, which writes `packages/core/src/version.generated.ts` (gitignored). Format: `{package.version}+{4-char suffix}`.

## Package scripts

- **web:** `dev`, `build` (`tsc -b && vite build`), `lint`
- **server:** `dev` (`tsx watch`), `build` (`tsc`), `start` (`node dist/index.js`)
- **core:** `dev` (`tsc --watch`), `build` (`tsc`)

## Local-only directories

These paths are listed in `.gitignore`. They are **not** part of the published repo but should **stay on your machine** — do not delete them during workspace cleanup.

| Path | Purpose |
|------|---------|
| `refer/` | Project reference library (design sources, Affinity `.af` files, icon drafts). Shipped assets live under `apps/web/public/` and `apps/web/src/assets/`. |
| `artifacts/` | Output of `pnpm package:beta` — safe to delete and regenerate |
| `ai-memory/` | Optional local AI session notes |
| `config/parawrite.yaml` | Local secrets and overrides |

## Project conventions

- **TypeScript** strict mode; ESM throughout (`"type": "module"`)
- **Imports** in server/core use `.js` extensions for Node ESM resolution
- **Shared types** live in `packages/core`; web imports browser-safe exports from `@parawrite/core/client`
- **Config paths** in YAML resolve relative to the app root (parent of `config/`)
- **Styling:** Tailwind CSS with `deepl-*` semantic tokens; see [UI-DESIGN.md](UI-DESIGN.md) (including [button icons](UI-DESIGN.md#button-icons))

## Adding a provider

1. Add a block under `providers` in `config/parawrite.yaml`
2. Set `type` to `openai_compatible`, `claude`, or `ollama`
3. List models with one `default: true`
4. Restart the server; optional model availability check logs on startup (non-blocking)

## Testing changes

```bash
pnpm lint        # TypeScript checks
pnpm build       # Full production build including PWA service worker
```

Verify PWA manifest after web build:

```bash
cat apps/web/dist/manifest.webmanifest | jq '.screenshots, .display_override'
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).
