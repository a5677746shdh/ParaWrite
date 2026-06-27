# Architecture

ParaWrite is a pnpm monorepo with three runtime packages and shared configuration.

## Package layout

| Package | Path | Role |
|---------|------|------|
| **web** | `apps/web` | Vite + React SPA, Zustand state, PWA shell |
| **server** | `apps/server` | Hono HTTP API, SQLite persistence, static file serving |
| **core** | `packages/core` | LLM engines, dictionary, config loader, segmenter, prompts |

Build order: `core` → `server` + `web`. In development, `core` runs `tsc --watch` alongside Vite and the server.

## Request flow

```
Browser (React)
    │  fetch /api/*  (credentials: include)
    ▼
Hono (apps/server)
    ├── Auth middleware (optional TOTP access gate)
    ├── Route handlers
    │     ├── Translation → core engine → SSE stream
    │     ├── Synonyms / rephrase / dictionary → core engine or DictionaryService
    │     └── User / history → SQLite via UserService / HistoryService
    └── serveStatic → apps/web/dist (production)
```

### Translation (SSE)

1. Client `POST /api/translate` with text, languages, provider, model.
2. Server builds prompt via `packages/core` (`buildTranslatePrompt`, glossary injection).
3. Engine streams chunks; server wraps each as `data: {"content":"..."}\n\n`.
4. Client parses SSE and appends to target pane (batched with `requestAnimationFrame`).

### Word panel

On word selection the client may call:

- `POST /api/synonyms` — context-aware synonym list (JSON)
- `POST /api/dictionary/context` — hybrid dictionary + LLM fallback (JSON)
- `POST /api/rephrase` — alternative phrasings (JSON)

Rephrase results render first; synonyms and dictionary load in parallel for single-word selections.

## Authentication layers

Two independent mechanisms (both optional):

| Layer | Config | Purpose |
|-------|--------|---------|
| **Access gate** | `auth.access_totp_secret` | TOTP required before any API use; session cookie `parawrite_session` |
| **User login** | `users.login.mode` | SQLite accounts, history, favorites; cookie `parawrite_user` |

User login modes: `disabled`, `restricted` (whitelist registration), `open`.

## Data directories

| Path | Contents |
|------|----------|
| `config/config.yaml` | Local secrets and settings (gitignored) |
| `data/` | SQLite database `parawrite.db` (gitignored) |
| `config/glossary.yaml` | Optional glossary terms |

Override paths with `PARWRITE_CONFIG` and `PARWRITE_DATA_DIR` environment variables.

## Engine abstraction

`packages/core/src/engines/` implements a common `IEngine` interface:

- `openai_compatible` — OpenAI, DeepSeek, and compatible APIs
- `claude` — Anthropic Messages API
- `ollama` — Local Ollama chat endpoint

The server caches one engine instance per provider ID (`createEngineCache`) to avoid recreating proxied fetch clients on every request.

## Frontend layout modes

Controlled by viewport width and `app.layout` breakpoints in YAML:

| Mode | Condition | Word panel |
|------|-----------|------------|
| Three-column | ≥ `three_column_min_width` (1280) | Resident sidebar |
| Two-column | ≥ `two_column_min_width` (768) | Modal overlay |
| Stacked | &lt; 768px | Bottom sheet |

See [UI-DESIGN.md](UI-DESIGN.md) for visual details and screenshots.
