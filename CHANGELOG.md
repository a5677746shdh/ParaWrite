# Changelog

All notable changes to ParaWrite are documented in this file.

## [0.3.1] — 2026-06-25

### Added
- Startup log with ISO timestamp and build version
- `config/parawrite.docker.example.yaml` for NAS/Docker deployment
- `config/.gitignore` to keep local secrets out of Git

### Changed
- Beta compose: `container_name: parawrite-beta`, `image: parawrite:<version>`
- Docker base image upgraded to `node:22-alpine`
- Default DeepSeek model → `deepseek-v4-flash` (local + docker example)
- Local `parawrite.yaml` gitignored; plain-text API keys allowed for dev

## [0.3.0] — 2026-06-24

### Added
- Beta packaging script (`pnpm package:beta`) outputs deployable artifacts to `artifacts/parawrite-beta/`
- `CHANGELOG.md` and `VERSION.json` in beta package manifest

### Changed
- Header app icon enlarged to 48×48 px
- App icon asset regenerated at native 48 px resolution
- Docker runner image installs `wget` for health checks
- Docker build runs version generation before compile

### Fixed
- Docker health check failing on Alpine (missing `wget`)
- Beta Docker build failing when compose referenced parent `docker/` directory (now self-contained in `artifacts/parawrite-beta/`)

## [0.2.0] — 2026-06-24

### Added
- App branding icons (favicon, PWA, header logo)
- `artifacts/` and `ai-memory/` local workspace folders
- `prestart` hook to rebuild frontend before `npm start`
- Comprehensive README with API endpoints and configuration reference

### Changed
- Streaming translation batches SSE chunks per animation frame (fewer re-renders)
- Zustand selective subscriptions in `Header` and `App`
- `TextStats` and `TokenEditor` memoized for performance
- Server refactored to `createApp(config)` with single config load
- Auto-translate only reschedules when source text actually changes
- Translation panes use flex footer pinned to column bottom
- Full-height divider between source and target columns
- Dictionary API passes `uiLang` for bilingual definitions
- Bilingual dictionary falls back to free dictionary when LLM returns empty

### Fixed
- Duplicate translation caused by auto-translate timer and meta load race
- Dictionary context failed (stale server build / missing `uiLang` parameter)
- Divider not extending to pane bottom
- Header icon missing in production (stale `web/dist`)

### Removed
- Incorrect README claim about token reordering (move up/down)
- Redundant large icon copies from `public/`
- Debug instrumentation from development session

## [0.1.0] — 2026-06-24

### Added
- Initial release: DeepL-style translation UI with LLM providers
- Streaming translation, word panel (synonyms, dictionary, rephrase)
- YAML-configured providers (OpenAI-compatible, Claude, Ollama)
- Hybrid dictionary (Free Dictionary, Wiktionary, LLM fallback)
- Responsive three-column / two-column / stacked layouts
- PWA support, Docker deployment, UI i18n (en/zh)
- Auto-translate debounce, keyboard shortcut (Ctrl/Cmd+Enter)
