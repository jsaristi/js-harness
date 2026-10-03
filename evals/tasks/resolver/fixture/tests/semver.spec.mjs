import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, parse } from '../src/semver.mjs';

test('parse reads the numbers and the prerelease identifiers', () => {
  assert.deepEqual(parse('1.20.3'), { major: 1, minor: 20, patch: 3, prerelease: [] });
  assert.deepEqual(parse('2.0.0-rc.1').prerelease, ['rc', '1']);
  for (const text of ['1.2', '01.2.3', 'v1.2.3', '1.2.3-', '1.2.3+build']) assert.throws(() => parse(text), TypeError, text);
});

test('compare orders the numbers numerically', () => {
  assert.equal(compare('1.9.0', '1.10.0'), -1);
  assert.equal(compare('2.0.0', '1.99.99'), 1);
  assert.equal(compare('1.2.3', '1.2.3'), 0);
});

test('compare puts a prerelease below its release and orders prereleases by identifier', () => {
  const ascending = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
  for (let index = 1; index < ascending.length; index += 1) assert.equal(compare(ascending[index - 1], ascending[index]), -1, ascending[index]);
});
