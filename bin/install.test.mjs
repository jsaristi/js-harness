import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installMain, syncMain, uninstallMain, currentVersion } from './install.mjs';
import { manifestPath, readManifest } from './lib/manifest.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cli-home-'));
}

test('currentVersion reads this package\'s own package.json version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'));
  assert.equal(currentVersion(), pkg.version);
});

test('installMain writes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain(['--home', home]);
    assert.equal(code, 0);
    const manifest = readManifest(home);
    assert.equal(manifest.version, currentVersion());
    assert.ok(manifest.files.length > 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain updates the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const code = await syncMain(['--home', home]);
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstallMain removes the manifest under --home and exits 0', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const code = await uninstallMain(['--home', home]);
    assert.equal(code, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
