import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseGate, main } from './release-gate.mjs';
import { JOURNEY, recordLine, practiceLayout } from './practice-lib.mjs';

// The gate of a release tag, read as the pre-push hook hands it over. The decision is a pure function of the ref,
// the commit the tag names and the text of the practice record, so most of what is tested here needs no git and
// no file. The last tests run the command the hook runs, in a temp repository holding one commit, with the record
// in a temp folder: nothing is tagged, pushed or run as a practice.

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'release-gate.mjs');
const COMMIT = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const SHORT = COMMIT.slice(0, 7);
const WHOLE = JOURNEY.map(({ id }) => ({ id, ok: true, detail: `${id}: its evidence` }));
const passLine = (commit = SHORT) => recordLine({
  date: '2026-10-24T09:00:00.000Z', candidate: { branch: 'main', commit, dirty: false }, steps: WHOLE, node: 'v24.21.0', platform: 'linux',
});

// ---- the decision ----------------------------------------------------------------------------------------------------

test('a branch push is not a release: the gate does not apply and passes', () => {
  const gate = releaseGate({ ref: 'refs/heads/feature/x', commit: COMMIT, recordText: null });
  assert.deepEqual(gate, { applies: false, ok: true });
});

test('a tag that is not a version, and a version with only two parts, are not releases', () => {
  for (const ref of ['refs/tags/vendor-snapshot', 'refs/tags/v1.0', 'refs/tags/proof']) {
    assert.deepEqual(releaseGate({ ref, commit: COMMIT, recordText: null }), { applies: false, ok: true }, ref);
  }
});

test('a version tag with no record is refused, names the missing record, and gives the push to make', () => {
  const gate = releaseGate({ ref: 'refs/tags/v1.0.0', commit: COMMIT, recordText: null });
  assert.equal(gate.applies, true);
  assert.equal(gate.ok, false);
  assert.match(gate.message, /tag v1\.0\.0 is refused: no record/);
  assert.match(gate.message, /node scripts\/practice\.mjs run --root <dir>/);
  assert.match(gate.message, /JS_HARNESS_PRACTICE_ROOT=<dir> git push origin v1\.0\.0/);
  assert.doesNotMatch(gate.message, /--no-host/, 'the command is the whole journey, with the host session');
});

test('a version tag of a prerelease counts as a release', () => {
  assert.equal(releaseGate({ ref: 'refs/tags/v1.0.0-rc.1', commit: COMMIT, recordText: null }).applies, true);
});

test('a version tag with a whole pass on its commit is released', () => {
  assert.deepEqual(releaseGate({ ref: 'refs/tags/v1.0.0', commit: COMMIT, recordText: passLine() }), { applies: true, ok: true });
});

test('a version tag whose only pass is of another commit is refused and names the commit it lacks', () => {
  const gate = releaseGate({ ref: 'refs/tags/v1.0.0', commit: COMMIT, recordText: passLine('0123456') });
  assert.equal(gate.ok, false);
  assert.match(gate.message, new RegExp(`no run of ${SHORT}`));
});

test('a non-tag ref never reads the environment or the record, even when both are handed in', () => {
  const trap = () => {
    throw new Error('the gate read something for a ref that is not a release');
  };
  const env = new Proxy({}, { get: trap, has: trap });
  assert.equal(main(['--ref', 'refs/heads/feature', '--head', COMMIT, '--record', 'x.jsonl'], { env, readFile: trap }), 0);
  assert.equal(main(['--ref', 'refs/tags/vendor-snapshot', '--head', COMMIT], { env, readFile: trap }), 0);
});

// ---- the command the hook runs ---------------------------------------------------------------------------------------

let work;
before(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-release-gate-'));
});
after(() => {
  fs.rmSync(work, { recursive: true, force: true });
});

/** The environment of a child git or gate: the test's own, with the git variables that would bind it to another repository
 * removed and the practice variable cleared, so a developer's own setting never reaches a test. */
function cleanEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return { ...env, JS_HARNESS_PRACTICE_ROOT: '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(work, 'empty.gitconfig'), ...extra };
}

/** A temp repository of one commit: its folder, its sha, and `run`, a git command in it. */
function repository(name) {
  const dir = path.join(work, name);
  fs.mkdirSync(dir);
  const run = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: cleanEnv() });
  assert.equal(run('init', '-q').status, 0);
  assert.equal(run('-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'one').status, 0);
  const sha = run('rev-parse', 'HEAD').stdout.trim();
  return { dir, sha, run };
}

/** A folder standing for the one a practice run was made in: its record holds `text`, or no record at all when `text` is null. */
function practiceFolder(name, text = null) {
  const root = path.join(work, name);
  fs.mkdirSync(root);
  if (text !== null) fs.writeFileSync(practiceLayout(root).record, text);
  return root;
}

/** Runs the gate as the hook does, in `cwd`, with `env` (the practice variable cleared unless given). */
function runGate(cwd, args, env = {}) {
  return spawnSync(process.execPath, [GATE, ...args], { cwd, encoding: 'utf8', env: cleanEnv(env) });
}

test('the command passes a branch push at once, with no record and no variable', () => {
  const repo = repository('branch');
  const result = runGate(repo.dir, ['--ref', 'refs/heads/feature', '--head', repo.sha]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});

test('a version tag with neither a record nor a practice folder named is refused in one line that names both ways', () => {
  const repo = repository('neither');
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', repo.sha]);
  assert.equal(result.status, 1);
  const lines = result.stderr.trimEnd().split('\n');
  assert.equal(lines.length, 1, result.stderr);
  assert.match(lines[0], /^tag v1\.0\.0 is refused: no practice record is named/);
  assert.match(lines[0], /--record <file>/);
  assert.match(lines[0], /JS_HARNESS_PRACTICE_ROOT=<dir> git push origin v1\.0\.0/);
});

test('an empty practice variable names nothing, and is refused the same way', () => {
  const repo = repository('empty-variable');
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', repo.sha], { JS_HARNESS_PRACTICE_ROOT: '' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no practice record is named/);
});

test('a practice folder with no record in it is refused, and the message names the record path it lacks', () => {
  const repo = repository('no-file');
  const root = practiceFolder('folder-without-record');
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', repo.sha], { JS_HARNESS_PRACTICE_ROOT: root });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.trimEnd().split('\n').length, 1, result.stderr);
  assert.ok(result.stderr.includes(practiceLayout(root).record), result.stderr);
  assert.match(result.stderr, /does not exist/);
});

test('a record named with --record that does not exist is refused, and the message names its path', () => {
  const repo = repository('missing-record');
  const missing = path.join(work, 'nowhere', 'record.jsonl');
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', repo.sha, '--record', missing]);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(missing), result.stderr);
  assert.match(result.stderr, /does not exist/);
});

test('--record names the record in place of the practice folder, and wins over the variable', () => {
  const repo = repository('record-wins');
  const elsewhere = practiceFolder('folder-empty');
  const record = path.join(work, 'record-wins.jsonl');
  fs.writeFileSync(record, `${passLine(repo.sha.slice(0, 7))}\n`);
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', repo.sha, '--record', record], { JS_HARNESS_PRACTICE_ROOT: elsewhere });
  assert.equal(result.status, 0, result.stderr);
});

test('a version tag of an annotated tag is released on a whole pass in the practice folder the variable names', () => {
  const repo = repository('annotated');
  assert.equal(repo.run('-c', 'user.name=gate', '-c', 'user.email=gate@example.invalid', 'tag', '-a', 'v1.0.0', '-m', 'release').status, 0);
  const tagObject = repo.run('rev-parse', 'v1.0.0').stdout.trim();
  assert.notEqual(tagObject, repo.sha, 'an annotated tag names a tag object, not the commit');
  const root = practiceFolder('annotated-practice', `${passLine(repo.sha.slice(0, 7))}\n`);
  const result = runGate(repo.dir, ['--ref', 'refs/tags/v1.0.0', '--head', tagObject], { JS_HARNESS_PRACTICE_ROOT: root });
  assert.equal(result.status, 0, result.stderr);
});
