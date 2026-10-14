import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mergeQueueMain } from './merge-queue.mjs';

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

/** An origin with main and four branches, and a clone of it: a and b merge cleanly, c conflicts with a, d is
 * a draft. `{ root, origin, main, heads }`. */
function makeQueueRepo() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-'));
  const origin = path.join(top, 'origin.git');
  const root = path.join(top, 'clone');
  git(top, 'init', '--quiet', '--bare', '-b', 'main', origin);
  git(top, 'clone', '--quiet', origin, root);
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  git(root, 'config', 'core.autocrlf', 'false');
  const write = (name, text) => fs.writeFileSync(path.join(root, name), text, 'utf8');
  write('a.txt', 'a1\n');
  write('b.txt', 'b1\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'one');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  const main = git(root, 'rev-parse', 'HEAD');
  const heads = {};
  for (const [branch, file, text] of [['feat/a', 'a.txt', 'A from a\n'], ['feat/b', 'b.txt', 'B from b\n'], ['feat/c', 'a.txt', 'A from c\n'], ['feat/d', 'b.txt', 'b1\nd\n']]) {
    git(root, 'checkout', '--quiet', '-b', branch, main);
    write(file, text);
    git(root, 'commit', '--quiet', '-am', branch);
    git(root, 'push', '--quiet', 'origin', branch);
    heads[branch] = git(root, 'rev-parse', 'HEAD');
  }
  git(root, 'checkout', '--quiet', '--detach', main);
  git(root, 'fetch', '--quiet', 'origin');
  return { root, origin, main, heads };
}

const pr = (number, branch, head, over = {}) => ({ number, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'gentle-ai: passive', headRefOid: head, headRefName: branch, ...over });

/** A runner that runs git for real and answers gh with `prs`; the calls it saw. */
function runner(prs) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push([command, ...args].join(' '));
    if (command === 'git') return spawnSync(command, args, options);
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') return { status: 0, stdout: JSON.stringify(prs) };
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
  return { run, calls };
}

async function dryRun(root, prs, covered = () => ({ pass: true })) {
  const { run, calls } = runner(prs);
  const out = [];
  const code = await mergeQueueMain(['--dry-run', '--cwd', root], { run, covered, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out, calls };
}

test('--dry-run builds the candidate of main and the ready pull requests in order, names each one left out and why, and pushes nothing', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const prs = [pr(3, 'feat/c', heads['feat/c']), pr(2, 'feat/b', heads['feat/b']), pr(1, 'feat/a', heads['feat/a']), pr(4, 'feat/d', heads['feat/d'], { isDraft: true })];
  const { code, out, calls } = await dryRun(root, prs);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(out, [
    `PR 4 is left out: PR 4 is a draft.`,
    `PR 3 is left out: it conflicts with the candidate so far in a.txt.`,
    `Candidate: main ${main.slice(0, 7)} with 2 pull requests merged in order: PR 1 (feat/a), PR 2 (feat/b).`,
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
  assert.equal(git(origin, 'rev-parse', 'main'), main, 'main did not move');
  assert.ok(!calls.some((line) => /^git push/.test(line)), 'nothing was pushed');
  assert.equal(git(root, 'worktree', 'list').split('\n').length, 1, 'the candidate worktree was removed');
});

test('the merges of the candidate run no hook: the repository\'s pre-merge-commit gate is the queue\'s own suite, run on the whole candidate', async () => {
  const { root, main, heads } = makeQueueRepo();
  const hooks = path.join(root, '.git', 'hooks');
  fs.writeFileSync(path.join(hooks, 'pre-merge-commit'), '#!/bin/sh\necho "the gate refuses" >&2\nexit 1\n', { mode: 0o755 });
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(out[0], `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/a).`);
});

test('a merge that fails with no conflict says what git said, not that it conflicts', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', 'f'.repeat(40))]);
  assert.equal(code, 0, out.join('\n'));
  assert.match(out[0], /^PR 1 is left out: it does not merge into the candidate so far: .+\.$/);
  assert.ok(heads);
});

test('a pull request whose code commits have no Codex review record is left out, saying so', async () => {
  const { root, heads } = makeQueueRepo();
  const covered = (head) => (head === heads['feat/b'] ? { pass: false, detail: '1 of 1 code commit since origin/main have no Codex review record' } : { pass: true });
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], covered);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(out[0], 'PR 2 is left out: 1 of 1 code commit since origin/main have no Codex review record.');
  assert.match(out[1], /with 1 pull request merged in order: PR 1 \(feat\/a\)\.$/);
});

test('with no pull request ready the queue says so and exits 0 having built nothing', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', heads['feat/a'], { body: 'no checks' })]);
  assert.equal(code, 0);
  assert.deepEqual(out, ['PR 1 is left out: PR 1: its body has no gentle-ai line.', 'No pull request is ready to merge: nothing was built.']);
  assert.equal(git(root, 'worktree', 'list').split('\n').length, 1);
});

test('merge-queue without --dry-run refuses for now, and a usage error is exit 2', async () => {
  const { run } = runner([]);
  const out = [];
  const io = { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) };
  assert.equal(await mergeQueueMain([], io), 2);
  assert.equal(await mergeQueueMain(['--dry-run', '--bogus'], io), 2);
  assert.match(out.join('\n'), /^Usage: js-harness merge-queue --dry-run/m);
});
