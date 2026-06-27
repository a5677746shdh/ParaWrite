# Deployment

## Environment variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, … | Referenced in YAML as `${VAR_NAME}` |
| `PARWRITE_CONFIG` | Override config file path |
| `PARWRITE_DATA_DIR` | Override SQLite data directory |
| `ACCESS_TOTP_SECRET` | TOTP secret for deployment access gate |
| `RESTART_TOTP_SECRET` | TOTP secret for backend restart |

Copy [`.env.example`](../.env.example) as a starting point. Never commit real keys.

## Production (Node)

```bash
cp config/config.example.yaml config/config.yaml
# Edit config and set API keys
pnpm build
pnpm start
```

`pnpm start` rebuilds the web app, then runs the server on port **8787** (configurable in YAML). The server serves `apps/web/dist` as static files and handles `/api/*`.

Health check: `GET /health`

## Docker

```bash
cp config/config.example.yaml config/config.yaml
export OPENAI_API_KEY=your-key-here
docker compose -f docker/docker-compose.yml up --build
```

See `docker/Dockerfile` for the multi-stage build. Mount config and data volumes as needed for persistence.

## Beta package

Build a self-contained artifact directory for NAS or offline deploy:

```bash
pnpm package:beta
```

Output: `artifacts/parawrite-beta/`

| Contents | Purpose |
|----------|---------|
| `web-dist/`, `server-dist/`, `core-dist/` | Pre-built binaries |
| `Dockerfile`, `docker-compose.yml` | Beta-specific image (port **13536**) |
| `config/` | Example YAML templates |
| `VERSION`, `VERSION.json` | Package manifest |

Deploy:

```bash
cd artifacts/parawrite-beta
docker compose up --build
```

Default compose mounts:

- Config: `/vol1/1000/DockerFiles/paraWriteBeta/config` → `/app/config`
- Data: host data dir → `/app/data`

Adjust volume paths in `docker-compose.yml` for your host.

## PWA installation

The web app registers a service worker with `display: standalone` and `display_override: ["standalone", "window-controls-overlay"]`. Screenshots in the manifest are served from `/screenshots/*.jpg` (copies of `docs/snapshots/`).

`theme_color` in the manifest is set to **`#ffffff`** (surface / header bar), not the primary brand blue, so Android TWA and PWABuilder status bars match the white app header. If you customize `theme.surface` in YAML, rebuild and repackage the Android app so the manifest reflects the new color (the in-app `meta theme-color` tag is updated at runtime).

### PWA manifest and icons

- Default icons live in `apps/web/public/icons/`.
- Copy `config/manifest.example.json` to **`config/manifest.json`** (gitignored) and edit for your domain (`id`, etc.). Vite loads the private file when present.
- Optional: place override PNGs in **`config/icons/`** (gitignored). `pnpm package:beta` copies them into `web-dist/icons/` after build.

After deploying a new version, users may need to reload once for the service worker to update (`skipWaiting` is enabled).

## Android app (TWA / Digital Asset Links)

Trusted Web Activity wrappers require a **Digital Asset Links** file at:

```
https://your-domain/.well-known/assetlinks.json
```

ParaWrite serves this from your local config file:

1. Copy the template: `cp config/assetlinks.example.json config/assetlinks.json`
2. Edit `package_name` and `sha256_cert_fingerprints` to match your Android signing key
3. Ensure `pwa.assetlinks_file` in `config.yaml` points to that file (default: `config/assetlinks.json`)
4. Deploy behind **HTTPS** on the same origin as your PWA

Verify:

```bash
curl -s https://your-domain/.well-known/assetlinks.json
```

The route is public (bypasses TOTP access gate) so Google Play / Android can fetch it.

## Security checklist

- Keep `config/config.yaml` out of version control (gitignored)
- Use TOTP access gate (`auth.access_totp_secret`) on public deployments
- Restrict user registration with `users.login.mode: restricted` when appropriate
- Run behind HTTPS in production so secure cookies work as intended
