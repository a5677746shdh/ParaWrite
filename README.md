# ParaWrite

ParaWrite is an open-source writing assistant inspired by DeepL's "Alternatives" feature. It helps you polish translations with context-aware synonyms, dictionary lookups, and sentence rephrasing—all powered by configurable LLM APIs.

**Version 0.4.1** — see [CHANGELOG.md](CHANGELOG.md) for release history.

## Features

- **Streaming translation** — SSE-based real-time output
- **DeepL-style UI** — responsive source/target panes with three layout modes (three-column, two-column, stacked)
- **Word panel** — click words in the translation for synonyms, dictionary definitions, and alternative phrasings
- **Smart selection** — single-click word, double-click clause (comma-delimited), triple-click sentence; drag to select phrases
- **Hybrid dictionary** — Free Dictionary API, Wiktionary, and LLM fallback with UI-language-aware bilingual definitions
- **Auto-translate** — configurable debounce while typing (`auto_translate_delay_seconds`)
- **UI i18n** — English and Chinese interface; 11 translation language pairs
- **PWA** — installable progressive web app with offline shell
- **YAML provider config** — OpenAI-compatible, Claude, and Ollama backends
- **Copy & text-to-speech** for translated output

## Project Structure

```
parawrite/
├── apps/
│   ├── web/          # Vite + React frontend (PWA)
│   └── server/       # Hono API proxy + static file server
├── packages/
│   └── core/         # Shared types, engines, dictionary, segmenter
├── config/
│   └── parawrite.example.yaml
├── scripts/          # Build helpers (version generation)
├── docker/           # Dockerfile and compose
├── artifacts/        # Local build outputs (gitignored)
└── ai-memory/        # AI session notes (gitignored)
```

## Prerequisites

- Node.js **≥ 22**
- pnpm **9.15** (see `packageManager` in `package.json`)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure

```bash
cp config/parawrite.example.yaml config/parawrite.yaml
export OPENAI_API_KEY=your-key-here   # or DEEPSEEK_API_KEY, etc.
```

Set `PARWRITE_CONFIG` to override the config file path.

### 3. Development

```bash
pnpm dev
```

- Frontend (Vite): http://localhost:5173 — proxies `/api` to the backend
- Backend API: http://localhost:8787

The core package is compiled in watch mode alongside the server and web app.

### 4. Production

```bash
pnpm build    # builds core, web, and server
pnpm start    # builds web, then starts server on :8787
```

Visit http://localhost:8787 for the full app (API + static frontend).

### Beta package

Build and collect deployable artifacts under `artifacts/parawrite-beta/`:

```bash
pnpm package:beta
```

Output includes pre-built `web-dist/`, `server-dist/`, `core-dist/`, plus `Dockerfile` and `docker-compose.yml` at the package root. Beta compose listens on **port 13536** and mounts host config at `/vol1/1000/DockerFiles/paraWriteBeta/config`.

```bash
cd artifacts/parawrite-beta
docker compose up --build
```

## Docker

```bash
cp config/parawrite.example.yaml config/parawrite.yaml
export OPENAI_API_KEY=your-key-here
docker compose -f docker/docker-compose.yml up --build
```

Health check: `GET /health`

## Configuration

Edit `config/parawrite.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 8787

app:
  default_provider: openai
  default_model: gpt-4o-mini
  auto_translate_delay_seconds: 2   # 0 = disabled
  runtime_env: dev
  layout:
    three_column_min_width: 1280
    two_column_min_width: 768

providers:
  openai:
    type: openai_compatible
    base_url: https://api.openai.com/v1
    api_key: ${OPENAI_API_KEY}
    models:
      - id: gpt-4o-mini
        name: GPT-4o Mini
        default: true

dictionary:
  free_dictionary: true
  wiktionary: true
  llm_fallback: true
```

### Provider types

| Type | Description |
|------|-------------|
| `openai_compatible` | OpenAI, DeepSeek, and other compatible APIs |
| `claude` | Anthropic Claude (optional `api_path`) |
| `ollama` | Local Ollama instance |

API keys support `${ENV_VAR}` substitution in YAML.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Translate |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/meta` | Public config metadata |
| `POST` | `/api/translate` | Stream translation (SSE) |
| `POST` | `/api/synonyms` | Context-aware synonyms |
| `POST` | `/api/rephrase` | Sentence alternatives |
| `POST` | `/api/dictionary/context` | Contextual dictionary lookup |
| `POST` | `/api/admin/restart` | Restart backend process |

## License

MIT
