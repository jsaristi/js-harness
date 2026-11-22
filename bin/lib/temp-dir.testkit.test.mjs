import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tempDir } from './temp-dir.testkit.mjs';

let fromTest;

test('a folder made with the test context is under the temporary folder, carries the prefix and exists while the test runs', (t) => {
  fromTest = tempDir('js-harness-temp-dir-test-', t);
  assert.equal(path.dirname(fromTest), path.resolve(os.tmpdir()));
  assert.match(path.basename(fromTest), /^js-harness-temp-dir-test-.{6}$/);
  assert.ok(fs.statSync(fromTest).isDirectory());
  fs.mkdirSync(path.join(fromTest, 'deep', 'er'), { recursive: true });
  fs.writeFileSync(path.join(fromTest, 'deep', 'er', 'file'), 'x');
});

test('the folder of the test before, and all it held, is gone once that test ended', () => {
  assert.ok(fromTest, 'the test before made no folder');
  assert.equal(fs.existsSync(fromTest), false);
});

test('a folder made with no test context is removed when the process exits, and one removed already is no error', () => {
  const script = [
    `import { tempDir } from ${JSON.stringify(new URL('./temp-dir.testkit.mjs', import.meta.url).href)};`,
    "import fs from 'node:fs';",
    "const kept = tempDir('js-harness-temp-dir-exit-');",
    "const gone = tempDir('js-harness-temp-dir-exit-');",
    "fs.writeFileSync(kept + '/file', 'x');",
    'fs.rmSync(gone, { recursive: true });',
    'console.log(kept);',
  ].join('\n');
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const kept = run.stdout.trim();
  assert.match(path.basename(kept), /^js-harness-temp-dir-exit-/);
  assert.equal(fs.existsSync(kept), false);
});

test('a prefix with a path separator is refused: the folder stays a direct child of the temporary folder', () => {
  assert.throws(() => tempDir('a/b-'), /prefix/);
  assert.throws(() => tempDir('a\\b-'), /prefix/);
  assert.throws(() => tempDir(''), /prefix/);
});
