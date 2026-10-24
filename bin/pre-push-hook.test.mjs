import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOURNEY, practiceLayout, recordLine } from '../scripts/practice-lib.mjs';

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

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The release gate the hook runs for a version tag, with what it imports: `scripts/practice-lib.mjs` imports the
 * evals' configs, which import their own helpers and one file of `bin/lib`, and the gate reads what a release is from
 * `bin/lib/version.mjs`. The stub carries the real files, not
 * copies of their decisions, so a change to the gate is what this test runs. */
function copyGate(root) {
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'evals'));
  fs.mkdirSync(path.join(root, 'bin', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'release-gate.mjs'), path.join(root, 'scripts', 'release-gate.mjs'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'practice-lib.mjs'), path.join(root, 'scripts', 'practice-lib.mjs'));
  for (const name of fs.readdirSync(path.join(REPO, 'evals'))) {
    if (name.endsWith('.mjs') && !name.endsWith('.test.mjs')) fs.copyFileSync(path.join(REPO, 'evals', name), path.join(root, 'evals', name));
  }
  for (const name of ['process-tree.mjs', 'version.mjs']) fs.copyFileSync(path.join(REPO, 'bin', 'lib', name), path.join(root, 'bin', 'lib', name));
}

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
      `try { fs.readFileSync(0); } catch {}\n` +
      `fs.appendFileSync(${JSON.stringify(path.join(root, 'calls.log'))}, argv.join(' ') + '\\n');\n` +
      `const failing = fs.readFileSync(${JSON.stringify(path.join(root, 'failing.txt'))}, 'utf8').split('\\n');\n` +
      `process.exit(failing.includes(head) ? 1 : 0);\n`,
    'utf8',
  );
  fs.copyFileSync(hookSource, path.join(root, 'pre-push'));
  copyGate(root);
  return root;
}

/** Makes one commit in `root` and returns its full sha: the commit a version tag names, which the gate reads with git. */
function commitIn(root) {
  const run = spawnSync('git', ['-c', 'user.name=hook', '-c', 'user.email=hook@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'one'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  assert.match(sha, /^[0-9a-f]{40}$/);
  return sha;
}

/** A folder standing for the one a practice run was made in, whose record holds one whole pass on `sha`. */
function practiceWithPass(root, sha) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pre-push-practice-'));
  made.push(folder);
  const steps = JOURNEY.map(({ id }) => ({ id, ok: true, detail: `${id}: its evidence` }));
  const line = recordLine({ date: '2026-10-24T09:00:00.000Z', candidate: { branch: 'main', commit: sha.slice(0, 7), dirty: false }, steps, node: 'v24.21.0', platform: 'linux' });
  fs.writeFileSync(practiceLayout(folder).record, `${line}\n`);
  return folder;
}

function runHook(root, stdin, env = {}) {
  const result = spawnSync('sh', ['pre-push', 'origin', 'https://example.invalid/repo.git'], {
    cwd: root,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, JS_HARNESS_MERGE_QUEUE: '', JS_HARNESS_PRACTICE_ROOT: '', ...env },
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

test('each pushed ref is checked with --push --remote <the remote> --head <its local sha>', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, line(A) + line(B, A));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${A}`, `--push --remote origin --head ${B}`]);
});

test('a deleted ref (local sha all zeros) is not checked', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, `(delete) ${ZEROS} refs/heads/gone ${A}\n` + line(B));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${B}`]);
});

test('a version tag is checked with --ref <the tag>, then refused with no practice folder named, in one line that says how to name it', { skip }, () => {
  const root = makeRepo();
  const sha = commitIn(root);
  const result = runHook(root, `refs/tags/v1.0.0 ${sha} refs/tags/v1.0.0 ${ZEROS}\n`);
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${sha} --ref refs/tags/v1.0.0`]);
  const lines = result.stderr.trimEnd().split('\n');
  assert.equal(lines.length, 1, result.stderr);
  assert.match(lines[0], /^tag v1\.0\.0 is refused: no practice record is named/);
  assert.match(lines[0], /JS_HARNESS_PRACTICE_ROOT=<dir> git push origin v1\.0\.0/);
});

test('a version tag whose commit has a whole practice pass in the folder named is pushed', { skip }, () => {
  const root = makeRepo();
  const sha = commitIn(root);
  const folder = practiceWithPass(root, sha);
  const result = runHook(root, `refs/tags/v1.0.0 ${sha} refs/tags/v1.0.0 ${ZEROS}\n`, { JS_HARNESS_PRACTICE_ROOT: folder });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${sha} --ref refs/tags/v1.0.0`]);
});

test('a tag that is not a version is checked as before, with no practice folder and no gate', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, `refs/tags/proof ${B} refs/tags/proof ${ZEROS}\n`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${B}`]);
});

test('a branch push is unaffected by the release gate, even with a practice folder that holds no record', { skip }, () => {
  const root = makeRepo();
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-pre-push-empty-'));
  made.push(empty);
  const result = runHook(root, line(B), { JS_HARNESS_PRACTICE_ROOT: empty });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(result.calls, [`--push --remote origin --head ${B}`]);
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
  assert.deepEqual(result.calls, [`--push --remote origin --head ${A}`, `--push --remote origin --head ${B}`]);
});

test('an empty stdin runs no check and passes', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, '');
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, []);
});

test('the remote the push goes to is passed through, and the check never reads the ref list', { skip }, () => {
  const root = makeRepo();
  const result = spawnSync('sh', ['pre-push', 'upstream', 'https://example.invalid/repo.git'], {
    cwd: root,
    input: line(A) + line(B, A) + line('c'.repeat(40)),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(path.join(root, 'calls.log'), 'utf8').split('\n').filter(Boolean);
  assert.deepEqual(calls, [
    `--push --remote upstream --head ${A}`,
    `--push --remote upstream --head ${B}`,
    `--push --remote upstream --head ${'c'.repeat(40)}`,
  ]);
});

// The merge queue is the only pusher of main (odd/tasks/merge-queue.md, S9): main tested as a candidate is
// main as pushed only when nothing else pushes it. The queue says it is the queue in its own push.
const toMain = (localSha, remoteSha = A) => `refs/heads/main ${localSha} refs/heads/main ${remoteSha}
`;

test('a push of main from anywhere but the merge queue is refused, and names the queue', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, line(B) + toMain(B));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /main is pushed only by js-harness merge-queue --land/);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${B}`], 'the other refs are still checked');
});

test('a delete of main is refused too', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, `(delete) ${ZEROS} refs/heads/main ${A}
`);
  assert.notEqual(result.status, 0);
});

test('the push of main by the merge queue is checked as any other ref', { skip }, () => {
  const root = makeRepo();
  const result = runHook(root, toMain(B), { JS_HARNESS_MERGE_QUEUE: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [`--push --remote origin --head ${B}`]);
});
