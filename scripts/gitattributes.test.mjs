// The package's bin/ is checked out with LF on every machine (.gitattributes): a CRLF checkout, this machine's default
// (core.autocrlf=true), would give bin/js-harness.mjs a `node\r` shebang, and pnpm's pack refuses that
// (docs/FAILURES.md, pnpm-pack-refuses-crlf; launch audit B10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './lib.mjs';

// The attribute, not the bytes: a tree checked out as CRLF before the rule keeps its bytes until it is checked out again.
test('every file under bin/ has the eol=lf attribute, so a checkout writes it with LF whatever core.autocrlf says', () => {
  const out = execFileSync('git', ['check-attr', 'eol', '--', 'bin/js-harness.mjs', 'bin/lib/manifest.mjs', 'bin/check.test.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.deepEqual(out.trim().split(/\r?\n/), [
    'bin/js-harness.mjs: eol: lf',
    'bin/lib/manifest.mjs: eol: lf',
    'bin/check.test.mjs: eol: lf',
  ]);
});
