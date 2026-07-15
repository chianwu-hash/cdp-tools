'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DEFAULT_PORT = 9222;

const BROWSERS = Object.freeze({
  chrome: {
    envVar: 'CHROME_PATH',
    commandNames: ['chrome.exe', 'chrome', 'google-chrome', 'google-chrome-stable'],
    windowsPaths: ['Google\\Chrome\\Application\\chrome.exe'],
  },
  edge: {
    envVar: 'EDGE_PATH',
    commandNames: ['msedge.exe', 'msedge', 'microsoft-edge'],
    windowsPaths: ['Microsoft\\Edge\\Application\\msedge.exe'],
  },
  chromium: {
    envVar: 'CHROMIUM_PATH',
    commandNames: ['chromium.exe', 'chromium'],
    windowsPaths: [],
  },
});

function normalizePort(value = DEFAULT_PORT) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Invalid CDP port. Use an integer between 1024 and 65535.');
  }
  return port;
}

function sanitizeProfileName(value = 'browser') {
  const name = String(value)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (!name) {
    throw new Error('CDP profile name cannot be empty.');
  }
  return name;
}

function defaultProfileRoot(env = process.env) {
  if (env.CDP_PROFILE_ROOT) {
    return path.resolve(env.CDP_PROFILE_ROOT);
  }
  if (process.platform === 'win32') {
    return path.resolve(env.LOCALAPPDATA || os.homedir(), 'cdp-tools', 'profiles');
  }
  return path.resolve(os.homedir(), '.local', 'share', 'cdp-tools', 'profiles');
}

function resolveProfilePath(profileRoot, profileName) {
  const root = path.resolve(profileRoot || defaultProfileRoot());
  const profilePath = path.resolve(root, sanitizeProfileName(profileName));
  const relative = path.relative(root, profilePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Resolved profile path escaped the configured profile root.');
  }
  return { profileRoot: root, profilePath };
}

function candidateWindowsPaths(browser) {
  const roots = [
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);
  return roots.flatMap((root) => browser.windowsPaths.map((item) => path.join(root, item)));
}

function findCommandOnPath(commandNames) {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  for (const command of commandNames) {
    const result = spawnSync(finder, [command], { encoding: 'utf8', windowsHide: true });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split(/\r?\n/)[0];
    }
  }
  return null;
}

function findBrowserExecutable(browserId = 'chrome', explicitPath = '') {
  if (explicitPath) {
    return explicitPath;
  }
  const browser = BROWSERS[browserId] || BROWSERS.chrome;
  if (process.env[browser.envVar]) {
    return process.env[browser.envVar];
  }
  for (const candidate of candidateWindowsPaths(browser)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return findCommandOnPath(browser.commandNames) || browser.commandNames[0];
}

function isPortFree(port, host = '127.0.0.1') {
  const normalizedPort = normalizePort(port);
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(normalizedPort, host, () => server.close(() => resolve(true)));
  });
}

async function findFreePort(startPort = DEFAULT_PORT, host = '127.0.0.1', attempts = 50) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = normalizePort(Number(startPort) + offset);
    if (await isPortFree(port, host)) {
      return port;
    }
  }
  throw new Error(`Could not find a free port starting from ${startPort}.`);
}

function buildCdpUrl(port = DEFAULT_PORT, host = '127.0.0.1') {
  return `http://${host}:${normalizePort(port)}`;
}

function buildBrowserArgs(options = {}) {
  const port = normalizePort(options.port);
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${options.profilePath}`,
    '--no-first-run',
    '--new-window',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
  if (!options.allowExtensions) {
    args.push('--disable-extensions');
  }
  if (options.url) {
    args.push(options.url);
  }
  return args;
}

function quoteCommandArg(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function buildLaunchCommand(options = {}) {
  const browserPath = options.browserPath || findBrowserExecutable(options.browserId, options.executablePath);
  return [browserPath, ...buildBrowserArgs(options)].map(quoteCommandArg).join(' ');
}

function ensureDownloadPreferences(profilePath) {
  const defaultDir = path.join(profilePath, 'Default');
  const preferencesFile = path.join(defaultDir, 'Preferences');
  const downloadsPath = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(defaultDir, { recursive: true });

  let preferences = {};
  if (fs.existsSync(preferencesFile)) {
    try {
      preferences = JSON.parse(fs.readFileSync(preferencesFile, 'utf8'));
    } catch {
      return;
    }
  }
  if (!preferences.download || !preferences.download.default_directory) {
    preferences.download = {
      ...(preferences.download || {}),
      default_directory: downloadsPath,
      prompt_for_download: false,
    };
    fs.writeFileSync(preferencesFile, JSON.stringify(preferences), 'utf8');
  }
}

function launchBrowserProcess(options = {}) {
  fs.mkdirSync(options.profilePath, { recursive: true });
  ensureDownloadPreferences(options.profilePath);
  const browserPath = options.browserPath || findBrowserExecutable(options.browserId, options.executablePath);
  const args = options.args || buildBrowserArgs(options);
  const child = spawn(browserPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  return { pid: child.pid, browserPath, args };
}

function readJsonFromUrl(url, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error(`Timed out reading ${url}.`)));
    request.on('error', reject);
  });
}

async function waitForCdpEndpoint(cdpUrl, timeoutMs = 15000, pollMs = 500) {
  const deadline = Date.now() + timeoutMs;
  const versionUrl = `${cdpUrl.replace(/\/$/, '')}/json/version`;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await readJsonFromUrl(versionUrl);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  throw new Error(`CDP endpoint did not become ready at ${versionUrl}. Last error: ${lastError && lastError.message}`);
}

async function launchCdpBrowser(options = {}) {
  const port = normalizePort(options.port || DEFAULT_PORT);
  const profileName = sanitizeProfileName(options.name || options.profileName || 'browser');
  const { profileRoot, profilePath } = resolveProfilePath(options.profileRoot, profileName);
  const cdpUrl = buildCdpUrl(port);
  const free = await isPortFree(port);

  if (!free) {
    if (!options.noLaunchIfRunning) {
      throw new Error(`CDP port ${port} is already in use.`);
    }
    const version = await waitForCdpEndpoint(cdpUrl, options.timeoutMs || 5000);
    return {
      alreadyRunning: true,
      pid: null,
      port,
      cdpUrl,
      profileName,
      profileRoot,
      profilePath,
      url: options.url || '',
      browserPath: null,
      version,
    };
  }

  const launched = launchBrowserProcess({
    ...options,
    port,
    profilePath,
  });
  const version = await waitForCdpEndpoint(cdpUrl, options.timeoutMs || 15000);
  return {
    alreadyRunning: false,
    pid: launched.pid,
    port,
    cdpUrl,
    profileName,
    profileRoot,
    profilePath,
    url: options.url || '',
    browserPath: launched.browserPath,
    version,
  };
}

async function getCdpStatus(options = {}) {
  const ports = options.ports || [9222, 9223, 9333];
  const results = [];
  for (const value of ports) {
    const port = normalizePort(value);
    const cdpUrl = buildCdpUrl(port);
    try {
      const version = await readJsonFromUrl(`${cdpUrl}/json/version`, options.timeoutMs || 750);
      results.push({ port, cdpUrl, reachable: true, version });
    } catch (error) {
      results.push({ port, cdpUrl, reachable: false, error: error.message });
    }
  }
  return results;
}

module.exports = {
  BROWSERS,
  DEFAULT_PORT,
  buildBrowserArgs,
  buildCdpUrl,
  buildLaunchCommand,
  defaultProfileRoot,
  findBrowserExecutable,
  findFreePort,
  getCdpStatus,
  isPortFree,
  launchBrowserProcess,
  launchCdpBrowser,
  normalizePort,
  readJsonFromUrl,
  resolveProfilePath,
  sanitizeProfileName,
  waitForCdpEndpoint,
};
