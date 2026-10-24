// The package's bin/ is checked out with LF on every machine (.gitattributes): a CRLF checkout, this machine's default
// (core.autocrlf=true), would give bin/js-harness.mjs a `node\r` shebang, and pnpm's pack refuses that
// (docs/FAILURES.md, pnpm-pack-refuses-crlf; launch audit B10).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './lib.mjs';

// The attribute, not the bytes: a tree checked out as CRLF before the rule keeps its bytes until it is checked out again.
// It is read in a repository of its own that holds only a copy of the checkout's .gitattributes (check-attr needs no
// files), so the test runs where the tree has no .git, as the WSL gate's mirror has none.
test('every file under bin/ has the eol=lf attribute, so a checkout writes it with LF whatever core.autocrlf says', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gitattributes-'));
  let out;
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    fs.copyFileSync(path.join(REPO_ROOT, '.gitattributes'), path.join(repo, '.gitattributes'));
    out = execFileSync('git', ['check-attr', 'eol', '--', 'bin/js-harness.mjs', 'bin/lib/manifest.mjs', 'bin/check.test.mjs'], { cwd: repo, encoding: 'utf8' });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
  assert.deepEqual(out.trim().split(/\r?\n/), [
    'bin/js-harness.mjs: eol: lf',
    'bin/lib/manifest.mjs: eol: lf',
    'bin/check.test.mjs: eol: lf',
  ]);
});
