// The pure part of the sandbox (scripts/sandbox.mjs, C-e-8): where npm's global install of the candidate puts its
// entry file, which differs by platform. The sandbox itself packs and installs, so only this layout is tested here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { installedBinPath } from './sandbox.mjs';

const ENTRY = path.join('js-harness', 'bin', 'js-harness.mjs');

test('Windows puts the global install directly under the prefix', () => {
  assert.equal(installedBinPath('/p', 'win32'), path.join('/p', 'node_modules', ENTRY));
});

test('every other platform puts it under prefix/lib', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.equal(installedBinPath('/p', platform), path.join('/p', 'lib', 'node_modules', ENTRY), platform);
  }
});
