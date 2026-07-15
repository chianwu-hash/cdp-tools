const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dirs = ['cli', 'lib', 'packages', 'scripts'];

function collect(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(relative) : entry.name.endsWith('.js') ? [relative] : [];
  });
}

let failed = false;
for (const file of ['index.js', ...dirs.flatMap(collect)].sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);

const lifecycle = require('../lib/browser-lifecycle');
const sample = lifecycle.resolveProfilePath(lifecycle.defaultProfileRoot(), 'chatgpt');
if (!sample.profilePath.startsWith(sample.profileRoot)) {
  throw new Error('Profile path safety check failed.');
}
console.log('cdp-tools checks passed.');
