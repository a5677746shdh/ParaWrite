# Security Policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report sensitive issues privately by emailing the maintainers (add your contact email when publishing the repo) or using [GitHub private vulnerability reporting](https://github.com/advisories) if enabled.

Include:

- Description of the issue and potential impact
- Steps to reproduce
- Affected version or commit

We aim to acknowledge reports within a few business days.

## Secrets and deployment

- **API keys** belong in environment variables or local `config/parawrite.yaml` (gitignored). Never commit real keys.
- **TOTP secrets** (`auth.access_totp_secret`, `auth.restart_totp_secret`) grant deployment-level access. Treat them like passwords.
- **User passwords** are stored as hashes in SQLite; the database file (`data/parawrite.db`) must not be published.
- Run production instances behind **HTTPS** so session cookies are protected in transit.
- Enable `auth.access_totp_secret` when exposing ParaWrite on the public internet.

## Scope notes

ParaWrite proxies translation requests to configured LLM providers. Prompt content (source text, selected words) is sent to those third-party APIs according to your configuration. Review provider privacy policies for your use case.
