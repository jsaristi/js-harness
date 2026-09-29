import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The hook is plain POSIX sh. It runs here against a temp repo whose `bin/check.mjs` is a stub that
// logs its arguments, so what is tested is the hook's own plumbing: which refs it checks and how it
// turns the results into an exit code. What the check itself decides is covered in
// check-codex-reviews.test.mjs.
const hookSource = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.githooks', 'pre-push');
const hasSh = spawnSync('sh', ['-c', 'true']).status === 0;
const skip = hasSh ? false : 'sh is not on PATH';

const ZEROS = '0'.repeat(40);
const made = [];
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pre-push-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A repo holding the real hook and a stub check that appends `--head`'s value to `calls.log` and
 * exits 1 when that value is listed in `failing.txt`. */
function makeRepo(failing = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pre-push-'));
  made.push(root);
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'failing.txt'), failing.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(root, 'bin', 'check.mjs'),
    `import fs from 'node:fs';\n` +
      `const argv = process.argv.slice(2);\n` +
      `const head = argv[argv.indexOf('--head') + 1];\n` +
      `fs.appendFileSync(${JSON.stringify(path.join(root, 'calls.log'))}, argv.join(' ') + '\\n');\n` +
      `const failing = fs.readFileSync(${JSON.stringify(path.join(root, 'failing.txt'))}, 'utf8').split('\\n');\n` +
      `process.exit(failing.includes(head) ? 1 : 0);\n`,
    'utf8',
  );
  fs.copyFileSync(hookSource, path.join(root, 'pre-push'));
  return root;
}

function runHook(root, stdin) {
  const result = spawnSync('sh', ['pre-push', 'origin', 'https://example.invalid/repo.git'], {
    cwd: root,
    input: stdin,
    encoding: 'utf8',
  });
  const log = path.join(root, 'calls.log');
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
  return { status: result.status, calls, stderr: result.stderr };
}

const line = (localSha, remoteSha = ZEROS) => `refs/heads/feature ${localSha} refs/heads/feature ${remoteSha}\n`;
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

test('the hook is POSIX sh and starts with a shebang', () => {
  const text = fs.readFileSync(hookSource, 'utf8');
  assert.match(text, /^#!\/bin\/sh\r?\n/);
});

test('each pushed ref is checked with --push --head <its local sha>', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, line(A) + line(B, A));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --head ${A}`, `--push --head ${B}`]);
});

test('a deleted ref (local sha all zeros) is not checked', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, `(delete) ${ZEROS} refs/heads/gone ${A}\n` + line(B));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --head ${B}`]);
});

test('a push of only deletes runs no check and passes', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, `(delete) ${ZEROS} refs/heads/gone ${A}\n`);
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, []);
});

test('a failing check stops the push, but every ref is still checked', { skip }, () => {
  const root = makeRepo([A]);
  const result = runHook(root, line(A) + line(B));
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.calls, [`--push --head ${A}`, `--push --head ${B}`]);
});

test('an empty stdin runs no check and passes', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, '');
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, []);
});
