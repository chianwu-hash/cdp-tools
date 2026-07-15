#!/usr/bin/env node

'use strict';

const { getCdpStatus } = require('..');

function parsePorts(argv) {
  const index = argv.findIndex((arg) => ['--ports', '-ports'].includes(arg.toLowerCase()));
  if (index === -1 || !argv[index + 1]) {
    return [9222, 9223, 9333];
  }
  return argv[index + 1].split(',').map((value) => Number(value.trim()));
}

async function main() {
  const argv = process.argv.slice(2);
  const results = await getCdpStatus({ ports: parsePorts(argv) });
  if (argv.some((arg) => ['--json', '-json'].includes(arg.toLowerCase()))) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const result of results) {
    const label = result.reachable ? 'ready' : 'not reachable';
    const browser = result.reachable ? ` (${result.version.Browser || 'Chrome'})` : '';
    console.log(`${result.cdpUrl}  ${label}${browser}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
