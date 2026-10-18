// The helpers the end-to-end proof and the sandbox share (scripts/lib.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { globalPackageDir, nextVersion } from './lib.mjs';

// Harness review e6, 2026-10-18: the proof packed the repository as 0.1.0 and upgraded to a fixed 0.2.0, so it broke
// once the repository's own version moved. The upgrade goes from the repository's version to the next minor.
test('nextVersion is the next minor of the version it is given, its patch back to 0', () => {
  assert.equal(nextVersion('0.1.0'), '0.2.0');
  assert.equal(nextVersion('0.9.3'), '0.10.0');
  assert.equal(nextVersion('1.0.0'), '1.1.0');
  assert.throws(() => nextVersion('1.0'), /not a version/);
});

// Harness review e5, 2026-10-18: npm installs a global package under <prefix>/node_modules on Windows and under
// <prefix>/lib/node_modules elsewhere, so a proof that assumed the first failed under WSL2.
test('globalPackageDir is where npm install -g --prefix puts the package, on Windows and elsewhere', () => {
  assert.equal(globalPackageDir('P', 'win32'), path.join('P', 'node_modules', 'js-harness'));
  assert.equal(globalPackageDir('P', 'linux'), path.join('P', 'lib', 'node_modules', 'js-harness'));
  assert.equal(globalPackageDir('P', 'darwin'), path.join('P', 'lib', 'node_modules', 'js-harness'));
});
