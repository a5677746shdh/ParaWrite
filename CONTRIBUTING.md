# Contributing to ParaWrite

Thank you for your interest in contributing!

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies: `pnpm install`
3. Copy config: `cp config/config.example.yaml config/config.yaml`
4. Set API keys via environment variables or `.env` (see [`.env.example`](.env.example)).
5. Run development: `pnpm dev`

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for scripts, build order, and conventions.

## Before submitting

```bash
pnpm lint
pnpm test
pnpm build
```

Ensure TypeScript passes and the production build completes (including PWA manifest generation).

## Pull requests

- Use a clear title and description of the problem and solution.
- Keep changes focused; avoid unrelated refactors in the same PR.
- Update [CHANGELOG.md](CHANGELOG.md) under `Unreleased` or the next version section for user-visible changes.
- Add or update documentation in `docs/` when behavior or configuration changes.

## Commit messages

Follow the existing style: short imperative summary, optional body explaining *why*.

Examples:

- `Fix copy fallback when Clipboard API is unavailable`
- `Release v0.5.2: performance optimizations and UI cleanup`

## Code style

- TypeScript strict mode; match surrounding naming and patterns.
- Prefer extending `@parawrite/core` over duplicating logic in web or server.
- Comments: module-level purpose and non-obvious business rules only — avoid narrating obvious code.
- **Button icons:** inline SVG in the using component; reference files from `refer/` are read-only sources. See [docs/UI-DESIGN.md — Button icons](docs/UI-DESIGN.md#button-icons).

## Security

Do not commit API keys, `config/config.yaml`, database files, or the local `refer/` reference library. Report vulnerabilities per [SECURITY.md](SECURITY.md).

## Questions

Open a [GitHub Discussion](https://github.com/YOUR_ORG/ParaWrite/discussions) or issue for design questions before large changes.
