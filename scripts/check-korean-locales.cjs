'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${key}` : key, out);
  } else out[prefix] = value;
  return out;
}
const tokens = (s) => (s.match(/\{\{.*?\}\}|\{[A-Za-z_][A-Za-z_0-9]*\}/g) || []).sort();
function check(en, ko, label) {
  const a = flatten(en), b = flatten(ko);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${label}: keys`);
  for (const [key, value] of Object.entries(a)) {
    if (typeof value !== 'string') continue;
    assert.equal(typeof b[key], 'string', `${label}.${key}: type`);
    assert.ok(b[key].trim(), `${label}.${key}: empty translation`);
    assert.deepEqual(tokens(value), tokens(b[key]), `${label}.${key}: interpolation/branches`);
    assert.deepEqual(value.match(/\{\{[#/]\w+[^}]*\}\}/g) || [], b[key].match(/\{\{[#/]\w+[^}]*\}\}/g) || [], `${label}.${key}: conditional order`);
    assert.ok(!/ZXQ\d+QXZ|PPID\d+PP/.test(b[key]), `${label}.${key}: translation marker`);
  }
  console.log(`${label}: ${Object.keys(a).length} keys verified`);
}
check(require(path.join(root, 'frontend/src/i18n/locales/en.json')), require(path.join(root, 'frontend/src/i18n/locales/ko.json')), 'UI');
// Exact flattened key parity includes all _one/_other plural variants.
const english = flatten(require(path.join(root, 'frontend/src/i18n/locales/en.json')));
const korean = flatten(require(path.join(root, 'frontend/src/i18n/locales/ko.json')));
const koreanRules = new Intl.PluralRules('ko');
for (const [key, value] of Object.entries(english)) {
  if (!key.endsWith('_other')) continue;
  const stem = key.slice(0, -6);
  assert.ok(korean[`${stem}_${koreanRules.select(2)}`], `${stem}: Korean plural resolution`);
}
