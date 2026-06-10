'use strict';

const DEFAULTS = Object.freeze({
  cdpUrl: 'http://127.0.0.1:9222',
  targetUrl: 'https://chatgpt.com/',
  pollMs: 8000,
  screenshotMinIntervalMs: 10000,
  minPollMs: 5000,
  minScreenshotIntervalMs: 10000,
  enableNetwork: false,
  enablePerformance: false,
  enableLog: false,
  enableDebugger: false,
  defaultViewport: null,
  allowNonLocalCdpUrl: false,
  allowFirstPageFallback: false,
});

const lastScreenshotAt = new WeakMap();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInterval(value, fallback, minimum = 1000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(parsed, minimum);
}

function normalizeOptions(options = {}) {
  return {
    ...DEFAULTS,
    ...options,
    pollMs: clampInterval(
      options.pollMs ?? process.env.CDP_POLL_MS,
      DEFAULTS.pollMs,
      options.minPollMs || DEFAULTS.minPollMs,
    ),
    screenshotMinIntervalMs: clampInterval(
      options.screenshotMinIntervalMs ?? process.env.CDP_SCREENSHOT_MIN_INTERVAL_MS,
      DEFAULTS.screenshotMinIntervalMs,
      options.minScreenshotIntervalMs || DEFAULTS.minScreenshotIntervalMs,
    ),
  };
}

function parseUrl(value, label) {
  try {
    return new URL(value);
  } catch (error) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function assertLocalCdpUrl(cdpUrl, options = {}) {
  const settings = normalizeOptions(options);
  if (settings.allowNonLocalCdpUrl) {
    return;
  }

  const parsed = parseUrl(cdpUrl, 'CDP URL');
  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      `Refusing non-local CDP URL: ${cdpUrl}. Use 127.0.0.1 or localhost, or pass allowNonLocalCdpUrl for a reviewed exception.`,
    );
  }
}

function requirePuppeteer() {
  try {
    return require('puppeteer-core');
  } catch (coreError) {
    try {
      return require('puppeteer');
    } catch (fullError) {
      const error = new Error(
        'Install puppeteer-core or puppeteer in the project that uses @local/cdp-safe-client.',
      );
      error.cause = fullError;
      throw error;
    }
  }
}

async function connectCdp(options = {}) {
  const settings = normalizeOptions(options);
  assertLocalCdpUrl(settings.cdpUrl, settings);
  const puppeteer = options.puppeteer || requirePuppeteer();
  const browser = await puppeteer.connect({
    browserURL: settings.cdpUrl,
    defaultViewport: settings.defaultViewport,
  });

  const page = await findTargetPage(browser, settings);
  const session = await page.target().createCDPSession();
  await enableRequestedDomains(session, settings);

  return {
    browser,
    page,
    session,
    settings,
    disconnect: () => browser.disconnect(),
  };
}

async function findTargetPage(browser, options = {}) {
  const settings = normalizeOptions(options);
  const pages = await browser.pages();
  const targetUrl = parseUrl(settings.targetUrl, 'target URL');
  const target = pages.find((page) => page.url().startsWith(settings.targetUrl)) ||
    pages.find((page) => {
      try {
        return new URL(page.url()).hostname === targetUrl.hostname;
      } catch (error) {
        return false;
      }
    });

  if (!target) {
    if (settings.allowFirstPageFallback && pages[0]) {
      return pages[0];
    }
    throw new Error(`No page target found for ${settings.targetUrl}`);
  }

  return target;
}

async function enableRequestedDomains(session, options = {}) {
  const settings = normalizeOptions(options);
  const domains = [
    ['Network', settings.enableNetwork],
    ['Performance', settings.enablePerformance],
    ['Log', settings.enableLog],
    ['Debugger', settings.enableDebugger],
  ];

  for (const [domain, enabled] of domains) {
    if (enabled) {
      await session.send(`${domain}.enable`);
    }
  }
}

async function safeScreenshot(page, options = {}) {
  const minIntervalMs = clampInterval(
    options.minIntervalMs ?? options.screenshotMinIntervalMs ?? process.env.CDP_SCREENSHOT_MIN_INTERVAL_MS,
    DEFAULTS.screenshotMinIntervalMs,
    options.minScreenshotIntervalMs || DEFAULTS.minScreenshotIntervalMs,
  );
  const now = Date.now();
  const previous = lastScreenshotAt.get(page) || 0;
  const elapsed = now - previous;

  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }

  lastScreenshotAt.set(page, Date.now());
  const screenshotOptions = { ...options };
  delete screenshotOptions.minIntervalMs;
  delete screenshotOptions.screenshotMinIntervalMs;
  return page.screenshot(screenshotOptions);
}

async function pollUntil(check, options = {}) {
  const settings = normalizeOptions(options);
  const timeoutMs = Number(options.timeoutMs || 60000);
  const startedAt = Date.now();
  let lastValue;

  while (Date.now() - startedAt <= timeoutMs) {
    lastValue = await check();
    if (lastValue) {
      return lastValue;
    }
    await sleep(settings.pollMs);
  }

  throw new Error(`Timed out after ${timeoutMs} ms while polling.`);
}

function createThrottled(fn, minIntervalMs = DEFAULTS.pollMs) {
  let lastRun = 0;
  let inflight = null;

  return async (...args) => {
    if (inflight) {
      return inflight;
    }

    const elapsed = Date.now() - lastRun;
    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }

    inflight = Promise.resolve()
      .then(() => fn(...args))
      .finally(() => {
        lastRun = Date.now();
        inflight = null;
      });

    return inflight;
  };
}

module.exports = {
  DEFAULTS,
  connectCdp,
  createThrottled,
  enableRequestedDomains,
  findTargetPage,
  assertLocalCdpUrl,
  normalizeOptions,
  pollUntil,
  safeScreenshot,
  sleep,
};
