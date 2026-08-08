# Operations Log

This file records dated changes that future AI assistants and maintainers may need before modifying CDP lifecycle or safe-client behavior.

Do not record cookies, tokens, passwords, browser profile contents, full session configs, sensitive screenshots, or account data.

## 2026-08-09 — Add repo-local AI memory layer

Changed:

- Added `AGENTS.md` and `CLAUDE.md`.
- Added `docs/PROJECT_MEMORY.md`.
- Added `docs/RUNBOOK.md`.
- Added this operations log.
- Updated `README.md` to point to the memory docs.

Reason:

- `cdp-tools` is a low-level browser/CDP safety foundation used by higher-level AI browser workflows.
- Future agents need clear local-CDP, browser-profile, polling, screenshot, and package-boundary rules before changing it.

Validation:

- Docs-only change.
- No browser automation was run.
- No browser profile, cookie, session config, screenshot, download, or generated artifact was read or copied into memory docs.

Next-time warnings:

- Keep CDP localhost-first.
- Keep profiles outside repos.
- Do not duplicate low-level browser launch logic in higher-level workflow repos.
