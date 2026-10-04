'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const baseline = require('../../aio-baseline.json');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const entries = git('ls-tree', '-r', baseline.sourceCommit, '--', 'backend',
  'frontend/src/constants/currencies.ts', 'frontend/src/utils/money.ts',
  'frontend/src/utils/lineItemTotals.ts').trim().split('\n');
const expected = new Set();
for (const entry of entries) {
  const [meta, file] = entry.split('\t');
  const hash = meta.split(' ')[2];
  expected.add(file);
  assert.ok(fs.existsSync(file), `Missing official file: ${file}`);
  assert.equal(git('hash-object', '--no-filters', file).trim(), hash, `Official source changed: ${file}`);
}
// Detect old fork files even when they are untracked after aligning the source.
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) walk(file);
    else assert.ok(expected.has(file), `Extra backend file: ${file}`);
  }
}
for (const dir of ['backend/src', 'backend/migrations', 'backend/assets', 'backend/__tests__']) walk(dir);
assert.ok(fs.readFileSync('Dockerfile.aio', 'utf8').includes(`FROM ${baseline.image}\n`));
assert.ok(fs.readFileSync('Dockerfile.aio', 'utf8').includes(baseline.sourceCommit));
console.log(`Official backend, migrations and money helpers match ${baseline.sourceCommit}`);
