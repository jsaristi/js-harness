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

test('installMain resolves home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    const code = await installMain([], { JS_HARNESS_HOME: home });
    assert.equal(code, 0);
    assert.equal(readManifest(home).version, currentVersion());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): a component write that
// fails on an already-installed target is reported to the user, not silently dropped. Injected
// through the `deps.writeFile` seam manifest.mjs's `install`/`sync` now accept (chmod is unreliable
// on Windows, so a real permission failure is not how this is simulated).

test('syncMain prints a stderr skip line when a component write fails, naming the path and reason', async () => {
  const home = makeTmpHome();
  try {
    await installMain(['--home', home]);
    const manifest = readManifest(home);
    const target = manifest.files[0].path;
    const failingWriteFile = (writeTarget, ...rest) => {
      if (writeTarget === target) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      fs.writeFileSync(writeTarget, ...rest);
    };

    const errLines = [];
    const originalError = console.error;
    console.error = (line) => errLines.push(String(line));
    let code;
    try {
      code = await syncMain(['--home', home], process.env, { writeFile: failingWriteFile });
    } finally {
      console.error = originalError;
    }

    assert.equal(code, 0);
    assert.ok(
      errLines.includes(`skipped ${target}: EACCES: permission denied`),
      `expected a skip line for ${target}, got:\n${errLines.join('\n')}`,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('syncMain and uninstallMain also resolve home from JS_HARNESS_HOME when --home is not given', async () => {
  const home = makeTmpHome();
  try {
    await installMain([], { JS_HARNESS_HOME: home });
    const syncCode = await syncMain([], { JS_HARNESS_HOME: home });
    assert.equal(syncCode, 0);
    assert.equal(readManifest(home).version, currentVersion());

    const uninstallCode = await uninstallMain([], { JS_HARNESS_HOME: home });
    assert.equal(uninstallCode, 0);
    assert.equal(fs.existsSync(manifestPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
