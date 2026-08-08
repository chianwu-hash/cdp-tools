# Project Memory

Last reviewed: 2026-08-09

## Project identity

- Project name: `cdp-tools`
- Repository: `https://github.com/chianwu-hash/cdp-tools`
- Main local path: `D:\projects\cdp-tools`
- Main branch: `main`
- Package type: Node.js CommonJS package with CLI binaries and a safe CDP client.
- Purpose: portable local Chrome DevTools Protocol lifecycle and safety tools for AI-assisted browser automation.

## Source-of-truth order

1. Current repo files and Git state.
2. `README.md`, `package.json`, and package source files.
3. `docs/PROJECT_MEMORY.md`, `docs/RUNBOOK.md`, and `docs/OPERATIONS_LOG.md` for orientation.
4. Nowledge Memory for cross-tool recall only.
5. Raw Threads as unverified evidence only.

## Current package contract

`cdp-tools` owns low-level browser concerns: finding Chrome / Edge / Chromium, validating local CDP ports, creating dedicated persistent browser profiles, launching browsers with safe CDP defaults, checking CDP readiness, exposing JavaScript APIs, and providing a throttled Puppeteer-compatible safe client.

Higher-level workflow packages should depend on this package instead of launching browsers with ad hoc `chrome.exe --remote-debugging-port` commands.

## CLI and API surfaces

- Package binaries: `cdp-launch`, `cdp-status`
- Main exports: `launchCdpBrowser`, `getCdpStatus`, `findFreePort`, `buildCdpUrl`, browser executable helpers, profile helpers
- Safe client export: `cdp-tools/safe-client`
- Safe client functions: `connectCdp`, `pollUntil`, `safeScreenshot`, `createThrottled`

## Active decisions

### 2026-08-09 CDP is localhost-first

Status: active
Scope: CDP URLs and browser automation safety
Source: `README.md`, `packages/cdp-safe-client/index.js`

Decision:

- Accept local CDP URLs by default.
- Reject non-local CDP URLs unless `allowNonLocalCdpUrl` is explicitly passed for a reviewed exception.
- Default CDP URL is `http://127.0.0.1:9222`.

Reason:

- CDP exposes powerful browser-control capability.
- Localhost-first behavior reduces accidental exposure of logged-in browser sessions.

### 2026-08-09 Browser profiles stay outside application repositories

Status: active
Scope: browser profile management
Source: `README.md`, `.env.cdp.example`, `lib/browser-lifecycle.js`

Decision:

- Default profile root is `%LOCALAPPDATA%\cdp-tools\profiles` on Windows and `~/.local/share/cdp-tools/profiles` elsewhere.
- `CDP_PROFILE_ROOT` may override this, but profiles should not live inside application repositories.

Reason:

- Browser profiles can contain cookies, sessions, cache, downloads, and other local private state.

### 2026-08-09 Safe client throttles expensive browser operations

Status: active
Scope: polling, screenshots, CDP domains
Source: `README.md`, `packages/cdp-safe-client/index.js`

Decision:

- Normal polling should stay around 5000-8000 ms.
- Screenshots should be 10000 ms or longer between captures.
- Network, Performance, Log, and Debugger domains are disabled unless explicitly requested.
- Reuse one browser connection, page, and CDP session where practical.

Reason:

- Tight polling, target enumeration, screenshots, and expensive CDP domains can destabilize browser automation and leak more data than needed.

## Sensitive surfaces

| Surface | Purpose | Boundary |
|---|---|---|
| Local CDP endpoint | Browser control over localhost | Keep local by default; non-local is reviewed exception only. |
| Browser profile | Persistent login/session state | Do not commit, copy, or summarize profile contents. |
| Screenshots | Debugging evidence | Treat as potentially sensitive; throttle and inspect before sharing. |
| Downloads | Browser workflow artifacts | Validate in higher-level workflow repos. |

## Known failure modes

| Issue | Root cause | Fix or first response |
|---|---|---|
| Invalid CDP port | Port outside 1024-65535 or non-integer | Use a valid local port such as 9222. |
| Port already in use | Existing browser or another process owns the port | Use `noLaunchIfRunning` for reuse or choose another reviewed port. |
| CDP endpoint not ready | Browser launch delay or wrong executable | Wait for `/json/version`; verify browser executable path. |
| Profile path escapes root | Unsafe profile name or path input | Use sanitized profile names and `resolveProfilePath`. |
| No target page found | Target URL does not match existing pages | Open the target site in the CDP browser or pass a reviewed fallback option. |
| Screenshot/polling overload | Tight loops or unthrottled screenshots | Use `pollUntil`, `safeScreenshot`, and default intervals. |

## Relationship to other repos

- `cbs-workflows`: guided workflow orchestration that should call `cdp-tools` for browser lifecycle.
- `browser-automation-workflow`: consumes CBS-facing setup or explicit local `--cdp-url`; it should not duplicate low-level launch logic.
- Project-specific repos should not embed browser launch/session logic directly when this package can provide it.
