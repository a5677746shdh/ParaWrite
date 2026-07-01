# Configuration

ParaWrite reads a single YAML file. Default search order:

1. `PARWRITE_CONFIG` environment variable
2. `config/config.yaml` (relative to cwd)
3. `config/config.docker.yaml`

Copy [`config/config.example.yaml`](../config/config.example.yaml) to `config/config.yaml` for local development. The live file is gitignored.

String values support `${ENV_VAR}` substitution from the process environment.

## Server

```yaml
server:
  host: 0.0.0.0
  port: 8787
```

## Application

```yaml
app:
  default_provider: openai
  default_model: gpt-4o-mini
  auto_translate_delay_seconds: 2   # 0 = disabled
  runtime_env: dev                  # Shown next to version in UI
  translate_on_enter: false         # true: Enter; false: Ctrl/Cmd+Enter
  auto_swap_languages: false        # true: swap language pair when source text matches target language
  point_out_glossary: off           # off | first | full — glossary term marks in editor panes
  # language_order: [zh, en, ja, auto]  # source language dropdown; omitted langs sort A–Z after these
  # target_language_order: [en, zh, ja] # target language dropdown; falls back to language_order when unset
  alternatives_separator:
    default: comma                  # comma | period — rephrase unit boundaries + API response splitting
    by_language:
      zh: period
      ja: period
  phrase_word_threshold:            # Words above this count = phrase (no synonyms/dict)
    default: 4
    by_language:
      zh: 5
      ja: 5
  layout:
    three_column_min_width: 1280
    two_column_min_width: 768
    pane_width_ratios:
      default: 0.5
      by_pair:
        zh-en: 0.4
  selection_copy_enabled: false
  word_lookup_mode: adaptive
```

### Pane width ratios

In two-column and three-column layouts, adjust source/target pane widths by language pair. Keys use **ISO 639-1** (`zh-en`). The value is the **source** pane share when the first language is source and the second is target (0–1, exclusive).

| Current pair | Config | Result |
|--------------|--------|--------|
| zh → en | `zh-en: 0.4` | Source 40%, target 60% |
| en → zh | (no `en-zh`) | Mirrors: source 60%, target 40% |
| en → zh | `en-zh: 0.6` | Source 60% (forward key wins) |

Ratios apply when the user selects languages or when auto-detect resolves the source language. Stacked (mobile) layout stays single-column.

### Alternatives separator

`alternatives_separator` controls both **rephrase selection range** (single-click word lookup) and how multi-alternative API responses are split.

| Value | Rephrase unit boundaries |
|-------|--------------------------|
| `comma` | Comma-like (`,，、;；:：`) **and** sentence-ending (`.。．!?！？…`) |
| `period` | Sentence-ending only (`.。．!?！？…`) |

Per-language overrides use the **target language** code (e.g. English target → `default: comma`).

### Auto language swap

When `auto_swap_languages: true`, if the text in the source box is detected as the **target** language, the UI swaps source and target automatically. The swap button icon changes to indicate auto-swap mode. Manual swap still works.

When the source language is **auto**, the partner language for the swap is the logged-in user’s saved interface locale (if set), otherwise the current UI language.

### Language dropdown order

Translation language selects sort options **alphabetically by display name** by default.

- `app.language_order` — source language dropdown (includes `auto` when shown). Listed codes appear first; others follow A–Z.
- `app.target_language_order` — target language dropdown. When unset or empty, uses `language_order`.

Logged-in users may override either via per-user `app` preferences.

### Phrase word threshold

`phrase_word_threshold` hides synonyms and dictionary in the word panel when the selection exceeds the configured word count (default **4**). Per-language overrides use the **target** language code.

### Word lookup mode

`word_lookup_mode` controls when dictionary/synonyms load after selecting a word:

| Value | Behavior |
|-------|----------|
| `immediate` | Lookup on every word click |
| `manual` | User taps the lookup button in the target pane footer |
| `adaptive` | Manual on narrow layouts; immediate in three-column mode (default) |

### Selection copy

When `selection_copy_enabled: true`, selecting multiple consecutive words turns the target-pane copy button into a selection copier (instead of copying the full translation).

### Rephrase hover preview

When enabled, hovering an alternative in the word panel (after a delay) back-translates it to the source language and shows the result below the option. Words that differ from the back-translation of the **current** target phrase are highlighted. The preview disappears when the pointer leaves.

```yaml
app:
  rephrase_hover_preview_enabled: false
  rephrase_hover_preview_delay_ms: 800
  rephrase_back_translation_preload: off   # off | partial | all
```

Requires a resolved source language (not `auto` without detection). Each hover triggers one translation API call; the baseline for the current phrase is fetched once per selection.

### Rephrase back-translation preload

Preload back-translations before the user opens a preview, so hover and batch back-translate feel instant when data is ready.

| Value | Behavior |
|-------|----------|
| `off` | Default. Fetch on hover (after delay) or when expanding batch back-translate. |
| `partial` | Start fetching as soon as the pointer enters an alternative; show after the hover delay or when expanding batch. |
| `all` | After alternatives finish loading in the word panel, fetch back-translations for every option; show after the hover delay (cached results appear without extra wait). |

```yaml
app:
  rephrase_back_translation_preload: off   # off | partial | all
```

Works with `rephrase_hover_preview_enabled` for per-option hover display and the batch back-translate button. In `all` mode, the batch button uses the same cache without extra API calls.

## Providers

Each key under `providers` is a provider ID used in the UI and API.

| `type` | Backends |
|--------|----------|
| `openai_compatible` | OpenAI, DeepSeek, and compatible chat APIs |
| `claude` | Anthropic Claude (`api_path` optional, default `/v1/messages`) |
| `ollama` | Local Ollama (`/api/chat`) |

```yaml
providers:
  openai:
    type: openai_compatible
    base_url: https://api.openai.com/v1
    api_key: ${OPENAI_API_KEY}
    # proxy:                        # Optional HTTP/SOCKS5 proxy
    #   url: http://127.0.0.1:7890
    models:
      - id: gpt-4o-mini
        name: GPT-4o Mini
        default: true
```

Mark exactly one model per provider with `default: true`, or set `app.default_model` explicitly.

## Dictionary

```yaml
dictionary:
  free_dictionary: true   # English: Free Dictionary API
  wiktionary: true        # Multilingual Wiktionary
  llm_fallback: true      # LLM-generated definitions when APIs miss
  llm_show_examples: false  # Include usage examples in LLM dictionary entries (default: false)
```

Contextual lookups (`POST /api/dictionary/context`) combine these sources and respect UI language for bilingual definitions. When `llm_show_examples` is `false`, the LLM prompt omits the `example` field and results are returned without usage examples. Free Dictionary API examples are unaffected.

## Glossary

```yaml
glossary:
  file: config/glossary.yaml
```

Relative paths resolve from the app root. Terms are injected into translation prompts when relevant. See [`config/glossary.example.yaml`](../config/glossary.example.yaml). Language keys use **ISO 639-1** (`zh`, `en`, …).

Each entry may include an optional **`other`** key: when the target language is not listed for that entry, the `other` translation is used instead (explicit language keys always take priority). An entry needs at least two language keys, or one language key plus `other`.

### Glossary marks in editor panes

Configure under `app.point_out_glossary` (`off` | `first` | `full`). Logged-in users may override via per-user `app` preferences (see [User config](#user-config-per-account)).

When enabled, terms from the effective glossary (global + per-user merge when logged in) are marked in the source and target panes:

| Value | Display |
|-------|---------|
| `off` | No marking (default) |
| `first` | Border-colored dot (4px) under the first character of each matched term |
| `full` | Border-colored line (2px) under the entire matched term |

Matching uses the source language in the source pane (all glossary languages when source is `auto`) and the target language in the target pane. Longer terms take priority; overlaps are skipped.

Entries are sent to the browser via `/api/meta` when `app.point_out_glossary` is not `off`.

## PWA / Android TWA

```yaml
pwa:
  assetlinks_file: config/assetlinks.json
```

The server publishes this file at `GET /.well-known/assetlinks.json` for Android Trusted Web Activity verification. Copy [`config/assetlinks.example.json`](../config/assetlinks.example.json) and set your app `package_name` and signing certificate SHA-256 fingerprint. See [DEPLOYMENT.md](DEPLOYMENT.md#android-app-twa--digital-asset-links).

## Deployment access (TOTP)

Independent from user accounts:

```yaml
auth:
  access_totp_secret: ${ACCESS_TOTP_SECRET}
  restart_totp_secret: ${RESTART_TOTP_SECRET}
  session_ttl_hours: 24
  persistent_sessions: false   # true: remember-me TOTP sessions survive server restart
```

- **access_totp_secret** — When set, all `/api/*` routes (except public meta/auth) require a TOTP-verified session cookie.
- **restart_totp_secret** — When set, `POST /api/admin/restart` requires a TOTP code in the body.
- **persistent_sessions** — When `true`, sessions created with **remember me** checked on the TOTP gate are stored in SQLite and survive server restarts. Unchecked sessions remain in-memory only.

## User login and history

```yaml
users:
  login:
    mode: disabled          # disabled | restricted | open
    allowed_usernames:      # restricted: registration whitelist
      - alice
    session_ttl_hours: 168  # Remember-me cookie lifetime (7 days)
    persistent_sessions: disabled  # disabled | restricted | all
    clear_access_on_logout: false  # true: user logout also clears TOTP access session
  history:
    similarity_threshold: 0.85
    dedup_interval_seconds: 60
    page_size: 5
  data_dir: data            # SQLite directory; override with PARWRITE_DATA_DIR
  # user_config_dir: data/user-configs       # Per-user app/theme YAML (see below)
  # user_glossary_dir: data/user-glossaries  # Per-user glossary YAML (see below)
```

| `mode` | Behavior |
|--------|----------|
| `disabled` | No user routes or history UI |
| `restricted` | Only `allowed_usernames` may register; existing users can always log in |
| `open` | Anyone may register; `allowed_usernames` controls restart-button visibility |

**Session persistence across server restarts** (`persistent_sessions`): only applies when the user checks **remember me** on login/register (or **do not verify again** for TOTP). Unchecked sessions stay in-memory and are invalidated on restart.

| `persistent_sessions` | Behavior |
|-----------------------|----------|
| `disabled` | Default; no SQLite session storage |
| `restricted` | Remember-me sessions for `allowed_usernames` only |
| `all` | Remember-me sessions for all users |

**User logout** (`clear_access_on_logout`): when `false` (default), signing out clears only the user account session; the TOTP access gate session is kept. Set `true` to also revoke the access session on logout.

Logged-in users may save an **interface language** preference (Settings → language selector → **Remember**). It is stored in the `users.locale` column and applied on the next sign-in.

## Server logging

Optional terminal logging for security events and API errors. All switches default to **off**.

```yaml
logging:
  include_client_ip: false       # Attach client IP to security event logs
  include_user_input: false      # Attach user-supplied fields (e.g. username)
  invalid_access_code: false     # Wrong page access TOTP
  invalid_restart_code: false    # Wrong backend restart TOTP
  restricted_registration: false # Registration denied in restricted mode
  login_failures: false          # After 3 consecutive wrong passwords (per IP + username)
  backend_restart: false         # Frontend restart button used
  app_api_errors: false          # Non-model API errors
  model_api_errors: false        # LLM errors (translate, synonyms, rephrase, dictionary)
```

Client IP is read from `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` when `include_client_ip` is true.

## Theme

Override CSS variables at runtime:

```yaml
theme:
  primary: '#0f2b46'
  accent: '#2d7ff9'
  background: '#f5f7fa'
  surface: '#ffffff'
  border: '#d8dee9'
  muted: '#6b7c93'
  success: '#16a34a'
  error: '#dc2626'
  warning: '#f59e0b'
  alert: '#ea580c'
  icon_button: '#4a6280'
```

Colors must be `#RRGGBB` hex. See [UI-DESIGN.md](UI-DESIGN.md) for token usage.

## User config (per account)

When user login is enabled, each registered user gets a `config_id`. Optional YAML at `{user_config_dir}/{config_id}.yaml` (default `data/user-configs/`) may override **only** `app` and `theme` from the global config when the user is logged in. Secrets (`providers`, `auth`, etc.) are ignored if present.

See [`config/user.config.example.yaml`](../config/user.config.example.yaml). User `app.default_provider` must exist in the global `providers` block. Any `app` key from the global config may be overridden, including `point_out_glossary`.

## User glossary (per account)

Each user also gets a `glossary_id`. Optional YAML at `{user_glossary_dir}/{glossary_id}.yaml` (default `data/user-glossaries/`) uses the same format as the global glossary. When logged in, user entries merge with the global glossary; conflicting `lang:term` pairs prefer the user entry.

See [`config/user.glossary.example.yaml`](../config/user.glossary.example.yaml).

## Docker template

For container deploys, start from [`config/config.docker.example.yaml`](../config/config.docker.example.yaml).

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Translate (when `translate_on_enter: false`) |
| `Enter` | Translate (when `translate_on_enter: true`) |

Word selection in the target pane: single-click word, double-click clause, triple-click sentence; drag for phrases.
