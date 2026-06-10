# Local CDP Tools

Shared utilities for Chrome DevTools Protocol automation on this machine.

Use these tools instead of launching Chrome or connecting to CDP directly from
individual projects.

## Commands

`D:\projects\cdp-tools\bin` is intended to be on the user PATH. Open a new
terminal after PATH changes so Windows reloads the environment.

Launch a dedicated ChatGPT CDP browser:

```powershell
cdp-launch chatgpt
```

Launch with custom values:

```powershell
cdp-launch -Name chatgpt -Port 9222 -ProfileRoot D:\chrome-cdp-profiles
```

Inspect CDP listeners, active clients, and related process trees:

```powershell
cdp-status
```

## Node Usage

Install the local wrapper in a project:

```powershell
npm install --save file:D:/projects/cdp-tools/packages/cdp-safe-client
```

Then use it from scripts:

```js
const { connectCdp, pollUntil, safeScreenshot } = require('@local/cdp-safe-client');

const { browser, page } = await connectCdp({
  cdpUrl: process.env.CDP_URL || 'http://127.0.0.1:9222',
  targetUrl: 'https://chatgpt.com/',
  pollMs: Number(process.env.CDP_POLL_MS || 8000),
});

await pollUntil(async () => {
  return page.url().includes('chatgpt.com');
}, { pollMs: 8000, timeoutMs: 60000 });

await safeScreenshot(page, { path: 'out.png' });
await browser.disconnect();
```

## Policy

- Launch Chrome with `cdp-launch`, not raw `chrome.exe --remote-debugging-port`.
- Connect through `@local/cdp-safe-client` for Node scripts when practical.
- Do not repeatedly enumerate all tabs or targets inside polling loops.
- Do not enable `Network`, `Performance`, `Log`, or `Debugger` domains unless needed.
- Do not take screenshots on every poll loop.
- Default polling interval should be 5000-8000 ms.
- Write batch logs to files instead of streaming large logs into Codex Desktop.
- Use CDP profiles under `D:\chrome-cdp-profiles\`, not C drive project folders.
