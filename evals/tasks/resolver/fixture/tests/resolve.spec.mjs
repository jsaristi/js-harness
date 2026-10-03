import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.mjs';
import { resolve } from '../src/resolve.mjs';

const registry = createRegistry({
  app: { '1.0.0': { dependencies: { util: '^1.0.0', http: '^2.0.0' } } },
  http: { '2.0.0': { dependencies: { util: '>=1.1.0' } }, '2.1.0': { dependencies: { util: '>=1.1.0' } }, '3.0.0': {} },
  util: { '1.0.0': {}, '1.1.0': {}, '1.2.0': {}, '2.0.0': {} },
});

test('resolve picks the highest version that fits and lists the dependencies of each package', () => {
  assert.deepEqual(resolve({ dependencies: { util: '^1.0.0' } }, registry), {
    packages: { util: { version: '1.2.0', dependencies: {} } },
  });
  assert.deepEqual(resolve({ dependencies: { util: '1.0.0 - 1.1.0', http: '2.x' } }, registry).packages, {
    http: { version: '2.1.0', dependencies: { util: '1.1.0' } },
    util: { version: '1.1.0', dependencies: {} },
  });
});

test('resolve follows a chain of dependencies once per package', () => {
  const result = resolve({ dependencies: { app: '1.0.0' } }, registry);
  assert.deepEqual(Object.keys(result.packages), ['app', 'http', 'util']);
  assert.deepEqual(result.packages.app, { version: '1.0.0', dependencies: { http: '2.1.0', util: '1.2.0' } });
});

test('resolve fails with ENOVERSION when no version fits a root dependency', () => {
  assert.throws(() => resolve({ dependencies: { util: '^3.0.0' } }, registry), { code: 'ENOVERSION', package: 'util', range: '^3.0.0', requiredBy: '<root>' });
  assert.throws(() => resolve({ dependencies: { missing: '*' } }, registry), { code: 'ENOVERSION', package: 'missing' });
});

test('resolve prefers a locked version that still fits', () => {
  const lock = { packages: { util: { version: '1.1.0', dependencies: {} } } };
  assert.equal(resolve({ dependencies: { util: '^1.0.0' } }, registry, { lock }).packages.util.version, '1.1.0');
  assert.equal(resolve({ dependencies: { util: '^2.0.0' } }, registry, { lock }).packages.util.version, '2.0.0');
});
