#!/usr/bin/env node

'use strict';

const { launchCdpBrowser } = require('..');

function parseArgs(argv) {
  const options = {
    name: 'chatgpt',
    port: 9222,
    url: 'https://chatgpt.com/',
    profileRoot: process.env.CDP_PROFILE_ROOT || '',
    allowExtensions: false,
    noLaunchIfRunning: false,
    json: false,
  };
  let positionalName = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const key = arg.toLowerCase();
    if (!arg.startsWith('-') && !positionalName) {
      options.name = arg;
      positionalName = true;
    } else if ((key === '--name' || key === '-name') && argv[i + 1]) {
      options.name = argv[++i];
    } else if ((key === '--port' || key === '-port') && argv[i + 1]) {
      options.port = Number(argv[++i]);
    } else if ((key === '--url' || key === '-url') && argv[i + 1]) {
      options.url = argv[++i];
    } else if ((key === '--profile-root' || key === '-profileroot') && argv[i + 1]) {
      options.profileRoot = argv[++i];
    } else if (key === '--allow-extensions' || key === '-allowextensions') {
      options.allowExtensions = true;
    } else if (key === '--no-launch-if-running' || key === '-nolaunchifrunning') {
      options.noLaunchIfRunning = true;
    } else if (key === '--json' || key === '-json') {
      options.json = true;
    } else if ((key === '--browser' || key === '-browser') && argv[i + 1]) {
      options.browserId = argv[++i].toLowerCase();
    } else if ((key === '--executable-path' || key === '-executablepath') && argv[i + 1]) {
      options.executablePath = argv[++i];
    }
  }
  if (!options.profileRoot) {
    delete options.profileRoot;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await launchCdpBrowser(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.alreadyRunning ? 'Reused Chrome CDP' : 'Launched Chrome CDP');
  console.log(`  Name: ${result.profileName}`);
  console.log(`  URL:  ${result.url}`);
  console.log(`  CDP:  ${result.cdpUrl}`);
  console.log(`  Dir:  ${result.profilePath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
