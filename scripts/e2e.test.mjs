// The `--pm` that `npm run e2e` hands `upgrade` (C-e-6): `upgrade` splits its value on whitespace, so the path of
// node and of the npm CLI, which may hold a space (the Windows default, C:\Program Files\nodejs), cannot be named on
// the command line. These tests build the value and the wrapper in a throwaway folder; no test installs anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { upgradePm } from './e2e.mjs';

const WIN_NODE = String.raw`C:\Program Files\nodejs\node.exe`;
const WIN_NPM = String.raw`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`;
// The wrapper sits in a temp folder, which can itself hold a space (a profile named "John Doe"): there the tests that
// write one are skipped, and the refusal is proven with a folder named on purpose.
const TMP_HAS_SPACE = /\s/.test(os.tmpdir()) && 'the temp folder holds a space, so no wrapper can be written in it';

test('the fixture paths are real Windows paths, with their backslashes', () => {
  assert.equal(WIN_NODE.split('\\').length, 4, WIN_NODE);
  assert.equal(/[\n\b]/.test(WIN_NPM), false, 'no escape sequence turned a backslash into a control character');
});

test('the --pm of upgrade is node and the npm CLI, two words and no wrapper, when neither path holds a space', () => {
  const dir = path.join(os.tmpdir(), 'a folder that is never written');
  assert.equal(upgradePm(dir, String.raw`C:\nvm4w\nodejs\node.exe`, String.raw`C:\nvm4w\nodejs\npm-cli.js`, 'win32'), String.raw`C:\nvm4w\nodejs\node.exe C:\nvm4w\nodejs\npm-cli.js`);
  assert.equal(fs.existsSync(dir), false, 'no wrapper was written');
});

test('a wrapper that would sit in a folder with a space, for a node path with one, is refused by name', () => {
  assert.throws(() => upgradePm(path.join(os.tmpdir(), 'John Doe'), WIN_NODE, WIN_NPM, 'win32'), /a path with a space, which upgrade cannot hold/);
});

test('the --pm of upgrade is one word when node sits under a path with a space', { skip: TMP_HAS_SPACE }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-e2e-pm-'));
  try {
    const pm = upgradePm(dir, WIN_NODE, WIN_NPM, 'win32');
    assert.equal(/\s/.test(pm), false, `upgrade splits --pm on spaces, so this is not one word: ${pm}`);
    assert.equal(fs.existsSync(pm), true, `the --pm names a file that exists: ${pm}`);
    const wrapper = fs.readFileSync(pm, 'utf8');
    assert.ok(wrapper.includes(`"${WIN_NODE}"`), `the wrapper runs node by its quoted path: ${wrapper}`);
    assert.ok(wrapper.includes(`"${WIN_NPM}"`), `the wrapper runs the npm CLI by its quoted path: ${wrapper}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the posix wrapper runs node and the npm CLI by their quoted paths and forwards the arguments', { skip: TMP_HAS_SPACE }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-e2e-pm-'));
  try {
    const pm = upgradePm(dir, '/opt/node dir/bin/node', '/opt/node dir/lib/npm-cli.js', 'linux');
    assert.equal(/\s/.test(pm), false, `upgrade splits --pm on spaces: ${pm}`);
    assert.equal(
      fs.readFileSync(pm, 'utf8'),
      '#!/bin/sh\nexec "/opt/node dir/bin/node" "/opt/node dir/lib/npm-cli.js" "$@"\n',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
