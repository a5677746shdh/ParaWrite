# Changelog

All notable changes to ParaWrite are documented in this file.

## [Unreleased]

## [0.8.1] — 2026-06-27

### Added
- Rephrase back-translation preload: `rephrase_back_translation_preload` (`off` | `partial` | `all`)
- Target pane footer layout: lookup button left, stats centered when lookup is visible; responsive narrow/wide breakpoints
- Client-side word-panel result cache for repeat lookups on the same selection
- `/api/meta` includes user `locale` to skip an extra `/api/user/me` on startup when logged in

### Changed
- Favorite “added” hint stays right-aligned until source or target text changes; favorite button disabled while pinned
- Back-translation prefetch capped at 3 concurrent requests in preload modes
- Language auto-detect and auto-swap share one debounced detection pass
- Backend caches merged user config/glossary with mtime TTL; history queries use prepared statements
- Dictionary bilingual LLM results are cached and respect request abort

### Fixed
- Auto language swap no longer triggers duplicate re-translation after swap
- History dedup index includes `target_text`

## [0.8.0] — 2026-06-27

### Added
- Per-user `config_id` / `glossary_id` with optional YAML overrides (`user-configs/`, `user-glossaries/`) merged at runtime for logged-in users
- User profile fields: `locale`, `email`, `phone`, `user_key`, plus reserved columns for future use
- **Remember** interface language preference (Settings → language selector) stored in `users.locale` and applied on sign-in
- `auto_swap_languages`: when enabled, swap language pair if source text matches target language; dedicated swap icon
- `PATCH /api/user/locale`; `/api/meta` and `/api/translate` merge user preferences and glossary when authenticated
- Example files: `config/config.example.yaml`, `config/glossary.example.yaml`, `config/user.config.example.yaml`, `config/user.glossary.example.yaml`
- Unit tests for user preference merge and glossary merge

### Changed
- Config file rename: `parawrite.yaml` → `config.yaml`, `custom-dictionary.yaml` → `glossary.yaml` (ISO 639-1 keys throughout)
- Removed ISO 639-2 `lang-codes` mapping layer; glossary and layout config use `zh`, `en`, `ja`, etc. directly

### Fixed
- Favorite action no longer duplicates history rows when a matching translation already exists
- Rephrase hover back-translation no longer aborts immediately in sheet/modal layout (hover zone includes preview area)
- Auto language swap keeps source text in the source pane instead of moving it to the target pane

## [0.7.2] — 2026-06-26

### Added
- Rephrase hover back-translation preview with diff highlighting (`rephrase_hover_preview_enabled`, `rephrase_hover_preview_delay_ms`)
- Batch back-translate button for all alternatives in the word panel (toggle expand/collapse)

### Changed
- Batch back-translate button shows whenever source language is resolved, independent of hover preview setting

### Fixed
- Word panel opens as modal when resizing from three-column to two-column with an active word selection
- Source textarea height recalculates on layout/width change (fixes truncated content after column layout switch)

## [0.7.1] — 2026-06-25

### Added
- Configurable source/target pane width ratios per language pair (`app.layout.pane_width_ratios` in YAML)
- Auto re-translate when target language changes if the target pane already has content
- Root `pnpm test` and `pnpm clean` scripts

### Changed
- History panel no longer re-renders on every translation stream chunk (isolated favorite-button subscriptions)
- Login failure tracker evicts stale entries after 24 hours
- Register username hint appears only after invalid input, until dialog close

### Fixed
- Rephrase apply no longer replaces the entire translation when token replacement fails
- Synonym apply clears word selection (consistent with rephrase)
- Model API error logging no longer suppresses generic app API error logs when `model_api_errors` is disabled
- Target-language change effect no longer retriggers on every streaming chunk

### Removed
- Unused clipboard exports (`canReadClipboard`, `copyToClipboard`); use `pasteFromClipboard` and `copyWithExecCommand`
- Empty legacy directories (`packages/core/src/users`, `apps/server/src/db`, `apps/server/src/routes`)

## [0.7.0] — 2026-06-26

### Added
- Access TOTP “do not verify again for X days” checkbox (configurable via `auth.session_ttl_hours`)
- “Forget page verification” in options when access auth is enabled; user logout also clears access session
- Configurable server terminal logging (`logging.*` in config): security events and app/model API errors
- Six UI languages (en, zh, ru, ja, fr, es); locale modules under `apps/web/src/i18n/locales/`
- PWA icons under `public/icons/`; optional private `config/manifest.json` via `scripts/load-pwa-manifest.mjs`
- Register username validation: ASCII letters and digits only (2+ characters)
- HTTP paste fallback when Clipboard API read is unavailable

### Changed
- `npm start` prestart rebuilds core, server, and web (fixes stale server dist)
- Source/target placeholder styling; shared `panePlaceholderClass` / `paneEditorTextClass`
- Reset dialog language picker uses full UI language list

### Fixed
- Model API errors logged to terminal when `logging.model_api_errors` is enabled
- Paste button works on non-HTTPS deployments

## [0.6.2] — 2026-06-26

### Added
- Source pane paste button when empty; clear (brush icon) when text is present
- Clipboard read helper for paste (`pasteFromClipboard`, with `execCommand` fallback on HTTP)
- Button icon conventions in `docs/UI-DESIGN.md` (inline SVG, `refer/` workflow)

### Changed
- Document `refer/` and other local-only directories; do not delete during workspace cleanup
- Beta and production Dockerfiles: Alpine build deps for `better-sqlite3` on ARM64 when prebuild download fails

## [0.6.1] — 2026-06-25

### Added
- `selection_copy_enabled` — copy selected phrase when multi-word selection (≥2 words)
- `word_lookup_mode`: `immediate` | `manual` | `adaptive` (manual on 1–2 column layouts, immediate on 3-column)
- Manual lookup button in target pane footer; legacy values `off`/`on`/`auto` still accepted
- Multi-select guidance: briefly highlight words adjacent to selection on non-consecutive click
- Icon-only footer buttons (backspace clear, copy, speak); speak glow animation with stop on re-click
- Incremental word panel: synonyms, dictionary, and alternatives render as each API returns
- Panel loader shuttle animation replaces per-section loading text
- Chinese changelog (`CHANGELOG.zh-CN.md`)

### Changed
- Copy button uses selection highlight style when regional copy is active
- Word panel close button: circular with background; cancel-selection matches selection style
- Dictionary service reuses cached LLM engine instances
- Panel API requests support `AbortSignal` and cancel on selection change or new translation

### Fixed
- Manual/adaptive lookup modes no longer fetch on word select (only on lookup click)
- Multi-word selection debounced (400 ms) in immediate mode to reduce API calls
- Word panel no longer waits for all requests before showing partial results
- Translation aborts in-flight word-panel requests; TokenEditor timer cleanup on unmount

## [0.6.0] — 2026-06-25

### Added
- English technical docs under `docs/` (architecture, configuration, API, deployment, development)
- Chinese README (`README.zh-CN.md`)
- PWA manifest screenshots and `display_override` for install UI
- Android TWA support: `config/assetlinks.json` served at `/.well-known/assetlinks.json`
- `.env.example`, CI workflow, CONTRIBUTING.md, SECURITY.md, Issue/PR templates

### Changed
- README slimmed to intro, quick start, and documentation index
- UI screenshots renamed to English in `docs/snapshots/`
- Module-level comments on core, server, and web entry points
- PWA `theme_color` matches white header surface (Android TWA status bar)

### Fixed
- Modal/sheet scroll no longer propagates to the page behind (body scroll lock)
- iOS Safari: source and target pane auto-height for stacked mobile layout

## [0.5.2] — 2026-06-25

### Changed
- Non-blocking startup model API checks; engine and segmenter instance caching
- Frontend performance: Zustand shallow selectors, incremental word-panel loading, diff memoization
- Login "remember me" checkbox unchecked by default; session cookie unless opted in
- Simplified DOM structure in header, word panel, settings dialog, and history pagination

### Removed
- Legacy `GET /api/dictionary/:lang/:word` endpoint and unused `fetchDictionary` client

## [0.5.1] — 2026-06-25

### Added
- Startup check for configured model API availability with per-model log output

### Changed
- User data directory defaults to project root `data/` (not `config/data/`); beta compose mounts `/data` volume
- Config file paths (`glossary.file`, `users.data_dir`) resolve relative to app root
- UI button padding standard (`px-6`); compact chips for synonyms and alternative expressions
- History filter tabs: Favorites left, All right

## [0.5.0] — 2026-06-25

### Added
- Optional user login and translation history (SQLite) — `users.login.mode`: disabled, restricted, or open
- History panel with favorites, pagination, and auto-save after successful translation
- Custom theme colors in YAML (`theme`) with CSS variable mapping
- UI design guide at `docs/UI-DESIGN.md`
- Remember-me option on login (session vs persistent cookie)
- Restricted registration whitelist (`allowed_usernames`) — existing users can always sign in

### Changed
- Reset dialog renamed to Options — UI language, reload, restart, and logout grouped under settings gear
- Semantic color tokens (`deepl-error`, `deepl-success`, `deepl-alert`, etc.) replace hardcoded reds/greens
- Provider/model select auto-sizes to label width; header layout polish

## [0.4.1] — 2026-06-25

### Added
- Click selected word again to deselect; multi-word selection shrinks from edges only (middle clicks ignored)
- Sentence/clause selection uses the same consecutive shrink rules; double/triple-click clears the full selection

### Fixed
- Copy button on HTTP/Docker deployments — `execCommand` fallback when Clipboard API is unavailable
- PWA stale cache after updates — `skipWaiting`/`clientsClaim` and no-cache headers for HTML and service worker

## [0.4.0] — 2026-06-25

### Added
- Custom glossary via `glossary.file` — prompt injection for domain-specific terms (ISO 639-2 keys)
- Alternative expression diff highlighting — changed words/phrases highlighted in amber in the word panel
- Consecutive word multi-select in target pane (click adjacent words to extend selection)
- Per-provider proxy support (`proxy.url`) for HTTP, HTTPS, and SOCKS5 (with username/password)
- `app.phrase_word_threshold` — hide synonyms/dictionary when selection exceeds word count (default + per-language via ISO 639-2)
- `app.translate_on_enter` — optional Enter-to-translate in source pane (Shift+Enter for newline)
- `app.alternatives_separator` — per-language comma/period splitting for alternative expressions (default: comma)
- Optional TOTP authentication for app access (`auth.access_totp_secret`) and backend restart (`auth.restart_totp_secret`)
- ISO 639-2 language code support in configuration files with runtime ISO 639-1 mapping
- Client-side language detection (`franc`) for auto source language — enables correct language swap

### Changed
- Rephrase scope limited to selected clause/phrase instead of full sentence
- Copy button shows green checkmark with 1 s cooldown
- Auth and restart errors shown inline on buttons instead of separate error lines

### Fixed
- Language swap with auto source now exchanges detected language (A↔B) instead of moving `auto` to target
- Swap button disabled when auto source language cannot be detected yet

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
