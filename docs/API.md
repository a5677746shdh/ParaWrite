# API Reference

Base URL: `http://localhost:8787` (or your deployed host).

All `/api/*` requests from the browser use `credentials: 'include'` for session cookies.

When `auth.access_totp_secret` is set, protected routes require a valid `parawrite_session` cookie (obtain via `POST /api/auth/verify`).

## Public endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check `{ "status": "ok" }` |
| `GET` | `/api/meta` | Public app metadata (providers, layout, auth flags, user login state) |
| `POST` | `/api/auth/verify` | Submit TOTP code; sets access session cookie |

## Translation

### `POST /api/translate`

Stream translation via **Server-Sent Events**.

**Body (JSON):**

```json
{
  "text": "Hello world",
  "sourceLang": "auto",
  "targetLang": "zh",
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

`provider` and `model` are optional; defaults come from config.

**Response:** `text/event-stream`

```
data: {"content":"你"}

data: {"content":"好"}

data: [DONE]
```

On error:

```
data: {"error":"Translation failed"}
```

## Word panel

### `POST /api/synonyms`

**Body:** `{ word, sentence, sourceText, sourceLang, targetLang, provider?, model? }`

**Response:** `{ "synonyms": [{ "word": "...", "note": "..." }] }`

### `POST /api/rephrase`

**Body:** `{ sentence, sourceText, fullTranslation, sourceLang, targetLang, provider?, model? }`

**Response:** `{ "alternatives": [{ "text": "...", "style": "..." }] }`

### `POST /api/dictionary/context`

Contextual dictionary lookup with hybrid sources and LLM fallback.

**Body:** `{ word, sentence, sourceText, sourceLang, targetLang, uiLang?, provider?, model? }`

**Response:** `DictionaryEntry` JSON (`phonetic`, `meanings[]`).

## User login (when `users.login.mode` ≠ `disabled`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/user/register` | Register; body `{ username, password, nickname?, rememberMe? }` |
| `POST` | `/api/user/login` | Login; body `{ username, password, rememberMe? }` |
| `POST` | `/api/user/logout` | Clear user session |
| `GET` | `/api/user/me` | Current user profile |

`rememberMe: false` (default) uses a session cookie; `true` sets `maxAge` from `users.login.session_ttl_hours`.

## Translation history (authenticated users)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/history` | Paginated list; query `filter=all\|favorites`, `page`, `pageSize` |
| `POST` | `/api/history` | Save entry after translation |
| `POST` | `/api/history/favorite` | Add current translation as favorite |
| `PATCH` | `/api/history/:id/favorite` | Toggle favorite flag |
| `DELETE` | `/api/history/:id` | Delete entry |
| `POST` | `/api/history/delete-bulk` | Delete multiple entries (see below) |

### `POST /api/history/delete-bulk`

**Body (by ids):** `{ "mode": "ids", "ids": [1, 2, 3] }`

**Body (by filter):** `{ "mode": "filter", "filter": "all" | "favorites", "excludeIds": [4] }` — deletes all matching entries except those in `excludeIds`.

**Response:** `{ "ok": true, "deleted": <number> }`

## Admin

### `POST /api/admin/restart`

Gracefully exits the server process (for process managers to restart). When `auth.restart_totp_secret` is set, body must include `{ "totpCode": "123456" }`.

## Error responses

Most errors return JSON `{ "error": "message" }` with HTTP 4xx/5xx. Unauthorized access gate returns `401`.
