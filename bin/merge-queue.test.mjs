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

/** A runner for `--land`: git for real, `gh pr list` from `prs`, and the check runs of a commit from `checks`,
 * one answer a call (the last repeats); `onChecks(call)` runs before each answer. */
function landRunner(prs, checks, onChecks = () => {}) {
  const base = runner(prs);
  let asked = 0;
  const run = (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && /\/check-runs$/.test(args[1])) {
      base.calls.push([command, ...args].join(' '));
      onChecks(asked);
      const answer = checks[Math.min(asked, checks.length - 1)];
      asked += 1;
      return { status: 0, stdout: JSON.stringify({ check_runs: answer }) };
    }
    if (command === 'gh' && args[0] === 'api' && /\/status$/.test(args[1])) return { status: 0, stdout: JSON.stringify({ statuses: [] }) };
    return base.run(command, args, options);
  };
  return { run, calls: base.calls };
}

const circle = (status, conclusion = null) => ({ name: 'check', status, conclusion, app: { slug: 'circleci-checks' }, html_url: 'https://app.circleci.com/x' });

async function land(root, prs, { suite = () => ({ ok: true }), checks = [[circle('completed', 'success')]], onChecks } = {}) {
  const { run, calls } = landRunner(prs, checks, onChecks);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, covered: () => ({ pass: true }), suite, sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out, calls };
}

const remoteBranches = (origin) => git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean).sort();

test('--land: the candidate green locally and on CircleCI becomes main, by fast-forward, and its queue branch is removed', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { checks: [[circle('in_progress')], [circle('completed', 'success')]] });
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.notEqual(landed, main);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', main, landed], { cwd: origin }).status, 0, 'a fast-forward of the main it was built from');
  for (const head of [heads['feat/a'], heads['feat/b']]) assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', head, landed], { cwd: origin }).status, 0, 'each pull request is in main');
  assert.ok(!remoteBranches(origin).some((name) => name.startsWith('queue/')), 'the queue branch is gone');
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1, PR 2.`);
});

test('--land: a candidate red locally pushes nothing, not even its queue branch', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { suite: () => ({ ok: false, said: 'npm run test exited 1' }) });
  assert.equal(code, 4, out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!calls.some((line) => line.startsWith('git push')));
  assert.match(out.at(-1), /^The candidate is red on this machine \(npm run test exited 1\): nothing was pushed\.$/);
});

test('--land: a candidate red on CircleCI leaves main as it was', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { checks: [[circle('completed', 'failure')]] });
  assert.equal(code, 4, out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!remoteBranches(origin).some((name) => name.startsWith('queue/')));
  assert.match(out.at(-1), /^The candidate is red on CircleCI \(check: failure, https:\/\/app\.circleci\.com\/x\): main was not pushed\.$/);
});

test('--land: a main that moved while the candidate was tested is not overwritten', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const other = path.join(path.dirname(origin), 'other');
  const moveMain = (call) => {
    if (call !== 0) return;
    git(path.dirname(origin), 'clone', '--quiet', origin, other);
    git(other, 'config', 'user.email', 'js-harness-test@example.invalid');
    git(other, 'config', 'user.name', 'js-harness test');
    fs.writeFileSync(path.join(other, 'z.txt'), 'z\n', 'utf8');
    git(other, 'add', '.');
    git(other, 'commit', '--quiet', '-m', 'main moved');
    git(other, 'push', '--quiet', 'origin', 'HEAD:main');
  };
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { onChecks: moveMain });
  assert.equal(code, 3, out.join('\n'));
  assert.notEqual(git(origin, 'rev-parse', 'main'), main, 'the other push stands');
  assert.equal(git(origin, 'log', '-1', '--format=%s', 'main'), 'main moved');
  assert.match(out.at(-1), /^Main moved while the candidate was tested: nothing was pushed to main; run the queue again\.$/);
});

test('--land: a candidate red on this machine is bisected, the pull request that turns it red leaves, and the rest lands', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const seen = [];
  // Red whenever feat/b's change is in the tree under test.
  const suite = (dir) => {
    const red = fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b');
    seen.push(red ? 'red' : 'green');
    return red ? { ok: false, said: 'FAIL  tests' } : { ok: true };
  };
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])];
  const { code, out } = await land(root, prs, { suite });
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(seen, ['red', 'green', 'green'], 'the whole candidate, its first half, then the candidate without PR 2');
  assert.ok(out.includes('PR 2 is left out: the candidate turns red on this machine when it is merged (FAIL  tests).'), out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', heads['feat/a'], landed], { cwd: origin }).status, 0);
  assert.notEqual(spawnSync('git', ['merge-base', '--is-ancestor', heads['feat/b'], landed], { cwd: origin }).status, 0, 'PR 2 is not in main');
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1.`);
});
