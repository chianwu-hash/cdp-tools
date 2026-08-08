# AGENTS.md

This repository uses repo-local memory. Before making changes, read the project memory documents.

## Required startup steps

1. Read `docs/PROJECT_MEMORY.md`.
2. Read `docs/RUNBOOK.md` when the task involves CDP ports, browser launch, profiles, Playwright/Puppeteer clients, screenshots, polling, package exports, command wrappers, or cross-repo browser automation.
3. Read `docs/OPERATIONS_LOG.md` when recent work may matter.
4. Read `README.md` and `package.json` for the current package contract.
5. Treat repository documents as the source of truth over Nowledge Memory, Working Memory, or raw Threads.
6. Preserve unrelated user changes. Do not overwrite dirty worktree changes unless explicitly authorized.

## Safety rules

- This package owns low-level local browser and CDP lifecycle behavior. Treat CDP endpoints, browser profiles, cookies, sessions, screenshots, and downloaded artifacts as potentially sensitive local data.
- Do not expose CDP outside localhost unless the user explicitly authorizes the exact reviewed exception.
- Do not store cookies, tokens, passwords, API keys, private keys, browser profile contents, full session configs, or sensitive screenshot contents in memory docs, Nowledge Memory, or chat.
- Do not automate login, credential extraction, account recovery, payments, identity verification, or admin-account changes.
- Keep browser profiles outside application repositories.
- Prefer throttled polling and screenshot capture. Do not repeatedly enumerate all browser targets in tight loops.

## Memory update policy

Update memory docs after significant changes to CDP launch defaults, localhost policy, browser profile behavior, package exports, npm binaries, safe-client throttling, screenshots, target selection, or cross-repo relationships with `cbs-workflows` / `browser-automation-workflow`.

Security, privacy, account, permission, and cross-project rules require explicit user confirmation before being written as memory.

## Communication

Use Traditional Chinese when responding to the user unless the user asks otherwise.
