# Operations Log

This file records dated changes that future AI assistants and maintainers may need before modifying CDP lifecycle or safe-client behavior.

Do not record cookies, tokens, passwords, browser profile contents, full session configs, sensitive screenshots, or account data.

## 2026-10-16 — cdp-safe-client 預設背景操作

Changed:

- 新增 `packages/cdp-safe-client/background-policy.js`，與 `browser-automation-workflow/lib/ai-work-browser/background-policy.js`、`D:/ai-browser/background-policy.cjs` 同源（2026-10-16 核對 SHA-256 一致）。
- `connectCdp()` 以 `guardPuppeteer()` 包裝連線：拒絕 `Page.bringToFront`、`Target.activateTarget`、視窗調整；新分頁確認已有視窗後於背景建立。連線後找頁或啟用 domain 失敗會先 `disconnect()`。
- README 說明保護範圍；這是合作式用戶端保護，不攔截獨立 CDP 或桌面程式。

Reason:

- 2026-10-13 使用者要求 AI 工作瀏覽器除非明確指示，不得擅自帶到前景（決策與完整紀錄見 `browser-automation-workflow` 的 OPERATIONS_LOG）。本 repo 為共用 safe client，需同步同一保護。

Validation:

- `npm run check` 通過；模組匯出不變。
- 實機透過 `D:/ai-browser/run-background.cjs` 連線分身 01 的 ChatGPT 分頁（唯讀），`bringToFront` 與 `Target.activateTarget` 均回 `AI_BROWSER_FOREGROUND_REQUIRED`。保護入口本身也會攔截，因此此實測不單獨證明 safe client 的攔截；保護邏輯由 browser-automation-workflow 的背景保護測試涵蓋。

Next-time warnings:

- 修改保護邏輯時三份副本需同步並核對雜湊，來源以 browser-automation-workflow 為準。

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
