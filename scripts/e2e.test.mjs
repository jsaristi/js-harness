// The `--pm` that `npm run e2e` hands `upgrade` (C-e-6): `upgrade` splits its value on whitespace, so the path of
// node and of the npm CLI, which may hold a space (the Windows default, C:\Program Files\nodejs), cannot be named on
// the command line. These tests build the value and the wrapper in a throwaway folder; no test installs anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { upgradePm } from './e2e.mjs';

const WIN_NODE = 'C:\Program Files\nodejs\node.exe';
const WIN_NPM = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js';

test('the --pm of upgrade is one word when node sits under a path with a space', () => {
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

test('the posix wrapper runs node and the npm CLI by their quoted paths and forwards the arguments', () => {
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
