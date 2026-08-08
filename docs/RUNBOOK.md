# Project Runbook

Last reviewed: 2026-08-09
Owner: project maintainers and authorized AI assistants

## Scope

This runbook covers repeatable local operations for `cdp-tools`: dependency installation, package checks, package dry-run validation, local CDP browser launch/status, safe-client usage, and safe package maintenance.

It does not authorize remote CDP exposure, login automation, credential extraction, account recovery, payment operations, or profile-data inspection.

## Safety rules

- Keep CDP local by default.
- Do not store cookies, tokens, passwords, API keys, private keys, browser profile contents, full session configs, or sensitive screenshot contents in this file, memory docs, Nowledge Memory, or chat.
- Treat profiles, screenshots, downloads, and CDP sessions as potentially sensitive local state.
- Do not place browser profiles inside application repositories.
- Do not run tight browser polling loops or unthrottled screenshot loops.
- Check current branch and worktree state before editing or committing.

## Routine procedures

### Install dependencies

1. Run `npm install`.
2. Run `npm run check`.

Validation: checks exit successfully and `package-lock.json` changes only when dependency changes are intentional.

### Validate package contents

1. Run `npm run check`.
2. Run `npm run pack:check`.

Validation: package dry-run includes only intended files from `package.json` `files`; profiles, screenshots, downloads, and local logs are absent.

### Check CDP status

```powershell
npx cdp-status --ports 9222,9223,9333
```

Reachable endpoints should return `/json/version` metadata. Unreachable endpoints should be reported as unreachable, not silently assumed.

### Launch a local browser

```powershell
npx cdp-launch chatgpt --port 9222 --url https://chatgpt.com/
```

Validation:

- Browser uses local `127.0.0.1` CDP address.
- Profile path is outside the application repo.
- `/json/version` becomes reachable.

Escalation:

- Stop if the task asks to expose CDP on a non-local address without explicit reviewed authorization.
- Stop if login or account verification is required; the user must handle it manually.

### Use the safe client

```js
const { connectCdp, pollUntil, safeScreenshot } = require('cdp-tools/safe-client');
```

Rules:

- Pass an explicit local `cdpUrl` when possible.
- Keep `pollMs` at 5000 ms or higher.
- Keep screenshots at least 10000 ms apart.
- Enable `Network`, `Performance`, `Log`, or `Debugger` only when needed.
- Reuse browser/page/session objects.

## Incident diagnosis

| Symptom | First checks | Next action |
|---|---|---|
| `Invalid CDP port` | Port value and type | Use integer 1024-65535. |
| Port already in use | `cdp-status`, intended profile name | Reuse endpoint with reviewed option or choose another port. |
| Browser does not launch | Browser path, env var, Windows install path | Set `CHROME_PATH`, `EDGE_PATH`, or `CHROMIUM_PATH` only if needed. |
| Endpoint timeout | `/json/version`, launch args, firewall/security tooling | Verify local browser opened and remote debugging address is localhost. |
| No target page found | Target URL and browser tabs | Open the target site in the CDP browser. |
| Automation slows browser | Poll interval, screenshot rate, enabled domains | Restore safe defaults and reduce target enumeration. |

## Maintenance

Update this runbook when launch defaults, profile-root behavior, local/remote CDP policy, package exports, CLI wrappers, or safe-client throttling changes. Record major dated changes in `docs/OPERATIONS_LOG.md` and durable decisions in `docs/PROJECT_MEMORY.md`.
