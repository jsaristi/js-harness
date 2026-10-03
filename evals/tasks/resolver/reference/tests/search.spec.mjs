import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.mjs';
import { resolve } from '../src/resolve.mjs';

const v = (dependencies = {}, more = {}) => ({ dependencies, ...more });
/** @param {string[]} versions */
const plain = (...versions) => Object.fromEntries(versions.map((version) => [version, {}]));
const versionsOf = (result) => Object.fromEntries(Object.entries(result.packages).map(([name, entry]) => [name, entry.version]));
const run = (data, root, options) => resolve(root, createRegistry(data), options);

test('resolve backtracks to the latest decision that has another version', () => {
  const data = {
    a: { '2.0.0': v({ c: '^2' }), '1.0.0': v({ c: '^1' }) },
    b: { '2.0.0': v({ c: '^1' }), '1.0.0': v({ c: '^2' }) },
    c: plain('1.0.0', '2.0.0'),
  };
  assert.deepEqual(versionsOf(run(data, { dependencies: { a: '*', b: '*' } })), { a: '2.0.0', b: '1.0.0', c: '2.0.0' });
});

test('resolve skips yanked versions unless they are locked', () => {
  const data = { a: { '1.0.0': v(), '1.1.0': v({}, { yanked: true }) } };
  const root = { dependencies: { a: '^1' } };
  assert.equal(run(data, root).packages.a.version, '1.0.0');
  assert.equal(run(data, root, { lock: { packages: { a: { version: '1.1.0', dependencies: {} } } } }).packages.a.version, '1.1.0');
});

test('resolve leaves out an optional dependency that cannot be installed', () => {
  const data = { a: { '1.0.0': v({}, { optionalDependencies: { o: '1' } }) }, o: { '1.0.0': v({ gone: '1' }) } };
  assert.deepEqual(run(data, { dependencies: { a: '1' } }).packages, { a: { version: '1.0.0', dependencies: {} } });
  assert.deepEqual(run(data, { optionalDependencies: { missing: '1' } }).packages, {});
});

test('resolve checks peers after the search and restricts versions with them', () => {
  const data = {
    host: plain('1.0.0', '2.0.0'),
    plugin: { '1.0.0': v({}, { peerDependencies: { host: '^1' } }) },
  };
  assert.throws(() => run(data, { dependencies: { plugin: '*' } }), { code: 'EPEER', package: 'plugin', peer: 'host' });
  assert.deepEqual(versionsOf(run(data, { dependencies: { host: '*', plugin: '*' } })), { host: '1.0.0', plugin: '1.0.0' });
});

test('resolve reports the name of the last dead end when no assignment exists', () => {
  const data = { a: { '1.0.0': v({ c: '1' }) }, b: { '1.0.0': v({ c: '2' }) }, c: plain('1.0.0', '2.0.0') };
  assert.throws(() => run(data, { dependencies: { a: '*', b: '*' } }), { code: 'ECONFLICT', package: 'c' });
});
