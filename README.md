# cdp-tools

Portable local Chrome DevTools Protocol lifecycle and safety tools.

The package owns low-level browser concerns:

- finding Chrome or Edge
- selecting and validating a local CDP port
- creating a dedicated persistent profile
- launching the browser with safe CDP defaults
- checking CDP endpoint readiness
- providing a throttled Puppeteer safety client

Higher-level workflow packages should depend on this package instead of
launching `chrome.exe --remote-debugging-port` themselves.

## Install

Until the package is published to npm, install it from GitHub:

```powershell
npm install github:chianwu-hash/cdp-tools
```

This installs the `cdp-launch` and `cdp-status` npm binaries. Projects should
normally call them through an npm script or use the JavaScript API rather than
requiring users to modify the machine PATH.

## Commands

```powershell
npx cdp-launch chatgpt --port 9222 --url https://chatgpt.com/
npx cdp-status --ports 9222,9223,9333
```

PowerShell-style flag names such as `-Name`, `-Port`, and `-ProfileRoot` remain
accepted for compatibility.

The profile root is portable:

- `CDP_PROFILE_ROOT`, when set
- `%LOCALAPPDATA%\cdp-tools\profiles` on Windows
- `~/.local/share/cdp-tools/profiles` on other platforms

## Node API

```js
const {
  launchCdpBrowser,
  getCdpStatus,
} = require('cdp-tools');

const session = await launchCdpBrowser({
  name: 'chatgpt',
  port: 9222,
  url: 'https://chatgpt.com/',
  noLaunchIfRunning: true,
});

console.log(session.cdpUrl);
console.log(await getCdpStatus({ ports: [9222] }));
```

## Safe Client

```js
const { connectCdp, pollUntil, safeScreenshot } = require('cdp-tools/safe-client');
```

The safe client accepts local CDP URLs by default, avoids enabling expensive
CDP domains unless requested, clamps polling intervals, and throttles
screenshots.

## Policy

- Reuse one browser connection, page, and CDP session where practical.
- Do not repeatedly enumerate all targets inside polling loops.
- Do not enable Network, Performance, Log, or Debugger unless required.
- Keep polling at 5000-8000 ms for normal automation.
- Keep screenshot intervals at 10000 ms or longer.
- Store browser profiles outside application repositories.
