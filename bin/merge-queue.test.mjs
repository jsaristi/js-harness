import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { circleciState, failedRows, mergeQueueMain } from './merge-queue.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';

// The fixtures are real repositories: the host's git configuration (hooks, signing, rename or identity settings)
// would change what they do, so it is left out of every git this file starts (Codex, 2026-10-14).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

/** An origin with main and four branches, and a clone of it: a and b merge cleanly, c conflicts with a, d is
 * a draft. `{ root, origin, main, heads }`. The pair is built once and copied as one folder
 * (`lib/git-fixture.testkit.mjs`); the copy's clone is then pointed at the copy's origin. */
function makeQueueRepo() {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-'));
  const origin = path.join(top, 'origin.git');
  const root = path.join(top, 'clone');
  const { main, heads } = queueRepo(top);
  git(root, 'remote', 'set-url', 'origin', origin);
  return { root, origin, main, heads };
}

/** Builds in `top` the origin and the clone `makeQueueRepo` hands out copies of: `{ main, heads }`. */
const queueRepo = repoTemplate((top) => {
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
  return { main, heads };
});

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
    'main\'s check.mjs has no merge door yet (odd/tasks/rule-hierarchy.md, T16e): no door ran',
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

test('a run leaves the configuration of the repository as it found it: the candidate\'s identity is given to each merge, never written (verifier, 2026-10-14)', async () => {
  const { root, heads } = makeQueueRepo();
  const before = git(root, 'config', '--local', '--list');
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(git(root, 'config', '--local', '--list'), before);
});

test('a pull request GitHub has not yet computed (mergeable UNKNOWN, about a minute after main moves) is decided by its merge into the candidate; CONFLICTING is still left out', async () => {
  // Batch 4 lost 6 ready pull requests to UNKNOWN (the lead, 2026-10-15): the merge into the candidate is the
  // queue's own test of whether a pull request merges, so a mergeable GitHub has not computed waits for it.
  const { root, main, heads } = makeQueueRepo();
  const prs = [
    pr(1, 'feat/a', heads['feat/a'], { mergeable: 'UNKNOWN' }),
    pr(2, 'feat/b', heads['feat/b']),
    pr(3, 'feat/c', heads['feat/c'], { mergeable: 'UNKNOWN' }),
    pr(4, 'feat/d', heads['feat/d'], { mergeable: 'CONFLICTING' }),
  ];
  const { code, out } = await dryRun(root, prs);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(out, [
    'PR 4 is left out: PR 4 is not mergeable (CONFLICTING).',
    'PR 3 is left out: it conflicts with the candidate so far in a.txt.',
    `Candidate: main ${main.slice(0, 7)} with 2 pull requests merged in order: PR 1 (feat/a), PR 2 (feat/b).`,
    'main\'s check.mjs has no merge door yet (odd/tasks/rule-hierarchy.md, T16e): no door ran',
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
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

async function land(root, prs, { suite = () => ({ ok: true }), checks = [[circle('completed', 'success')]], onChecks, wrap = (run) => run } = {}) {
  const { run, calls } = landRunner(prs, checks, onChecks);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run: wrap(run), covered: () => ({ pass: true }), suite, sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out, calls };
}

/** A runner that answers `answer(args)` for the git calls `match(args)` names, and runs the rest. */
const failingGit = (match, answer) => (run) => (command, args, options) => (command === 'git' && match(args) ? answer(run, args, options) : run(command, args, options));
const refused = () => ({ status: 1, stdout: '', stderr: 'fatal: refused by the test' });

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

test('--land: a pull request whose head moved during the land is named after the landing, which still happens (lead, 2026-10-15)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const other = path.join(path.dirname(origin), 'other');
  let moved = '';
  const moveHead = (call) => {
    if (call !== 0) return;
    git(path.dirname(origin), 'clone', '--quiet', '--branch', 'feat/a', origin, other);
    git(other, 'config', 'user.email', 'js-harness-test@example.invalid');
    git(other, 'config', 'user.name', 'js-harness test');
    fs.writeFileSync(path.join(other, 'a.txt'), 'A from a, later\n', 'utf8');
    git(other, 'commit', '--quiet', '-am', 'a later commit');
    git(other, 'push', '--quiet', 'origin', 'feat/a');
    moved = git(other, 'rev-parse', 'HEAD');
  };
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { onChecks: moveHead });
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', heads['feat/a'], landed], { cwd: origin }).status, 0, 'the head the candidate merged is landed');
  assert.notEqual(spawnSync('git', ['merge-base', '--is-ancestor', moved, landed], { cwd: origin }).status, 0, 'the later commit is not');
  assert.deepEqual(out.slice(-2), [
    `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1, PR 2.`,
    `PR 1 moved to ${moved.slice(0, 7)} during the land; its new commits are not in main.`,
  ]);
});

test('--land: heads that cannot be read after the landing are said to be unread, never taken for unmoved', async () => {
  const { root, main, heads } = makeQueueRepo();
  const wrap = failingGit((args) => args[0] === 'ls-remote' && args.includes('refs/heads/feat/a'), refused);
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { wrap });
  assert.equal(code, 0, out.join('\n'));
  assert.match(out.at(-2), new RegExp(`^Landed: main ${main.slice(0, 7)} is now [0-9a-f]{7}, with PR 1\\.$`));
  assert.equal(out.at(-1), 'Could not read the heads of the landed pull requests (fatal: refused by the test): check none moved during the land.');
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

test('--land: a queue branch that origin keeps is named, so it can be removed by hand (verifier, 2026-10-14)', async () => {
  const { root, origin, heads } = makeQueueRepo();
  const wrap = failingGit((args) => args[0] === 'push' && args.includes('--delete'), refused);
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { wrap });
  assert.equal(code, 0, out.join('\n'));
  const [left] = remoteBranches(origin).filter((name) => name.startsWith('queue/'));
  assert.ok(left, 'the delete was refused, so origin keeps the branch');
  assert.ok(out.includes(`Could not remove ${left} from origin (fatal: refused by the test): remove it by hand.`), out.join('\n'));
});

test('--land: a push of main that reports a failure, while origin\'s main is the candidate, is a landing, not a main that moved (verifier, 2026-10-14)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  // The push reaches origin, and its answer is lost, as a timeout loses it.
  const wrap = failingGit((args) => args[0] === 'push' && args.includes('origin') && args.at(-1).endsWith(':refs/heads/main'), (run, args, options) => {
    run('git', args, options);
    return { status: null, error: new Error('spawnSync git ETIMEDOUT'), stdout: '', stderr: '' };
  });
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { wrap });
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.notEqual(landed, main);
  assert.ok(!out.some((line) => line.startsWith('Main moved')), out.join('\n'));
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1.`);
});

test('--land: a bisection whose reset fails stops, tests nothing more and pushes nothing (verifier, 2026-10-14)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const seen = [];
  const suite = () => {
    seen.push('suite');
    return { ok: false, said: 'FAIL  tests' };
  };
  const wrap = failingGit((args) => args[0] === 'reset', refused);
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite, wrap });
  assert.equal(code, 1, out.join('\n'));
  assert.deepEqual(seen, ['suite'], 'the whole candidate only: a tree the reset did not make is never tested');
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!calls.some((line) => line.startsWith('git push')));
  assert.match(out.join('\n'), /could not reset the candidate to the merge of PR 1 \(fatal: refused by the test\)/);
});

test('CircleCI is green only when every run of it succeeded: a skipped or neutral run is no run of the suite (Codex, 2026-10-14)', () => {
  const run = (conclusion) => ({ name: 'check', status: 'completed', conclusion, app: { slug: 'circleci-checks' } });
  assert.equal(circleciState([run('success')], []).state, 'green');
  assert.equal(circleciState([run('skipped')], []).state, 'pending');
  assert.equal(circleciState([run('neutral')], []).state, 'pending');
  assert.equal(circleciState([run('success'), run('skipped')], []).state, 'pending');
  assert.equal(circleciState([], [{ context: 'ci/circleci: check', state: 'success' }]).state, 'green');
  assert.equal(circleciState([], []).state, 'pending');
});

test('--land: a read of CircleCI that fails is asked again, never taken for an empty answer (Codex, 2026-10-14)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  let reads = 0;
  const base = landRunner([pr(1, 'feat/a', heads['feat/a'])], [[circle('completed', 'success')]]);
  const run = (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && /\/check-runs$/.test(args[1]) && (reads += 1) === 1) return { status: 1, stdout: '', stderr: 'HTTP 502' };
    if (command === 'gh' && args[0] === 'api' && /\/status$/.test(args[1])) return { status: 0, stdout: JSON.stringify({ statuses: [{ context: 'ci/circleci: check', state: 'success' }] }) };
    return base.run(command, args, options);
  };
  let slept = 0;
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => { slept += 1; }, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(slept, 1, 'the failed read was waited on and asked again');
  assert.notEqual(git(origin, 'rev-parse', 'main'), main);
});

test('the red rows of the candidate are the gate\'s own FAIL rows, never a FAIL a test printed in the output below them', () => {
  // The first land of PR 167, 2026-10-15: the message quoted "FAIL  budget  1501 estimated tokens (budget 1500)",
  // a test's own output, beside the tests row, while the candidate's AGENTS.md was 1478.
  const output = [
    'gate: the machine\'s gate lock is free',
    'PASS  budget  1478 estimated tokens (budget 1500)',
    'FAIL  tests  npm run test exited 1 in WSL2 (Ubuntu)',
    '      a.test.mjs',
    'INFO  review  medium risk',
    '',
    '✖ failing tests:',
    'FAIL  budget  1501 estimated tokens (budget 1500)',
    '  FAIL  contracts  an indented one',
  ].join('\n');
  assert.deepEqual(failedRows(output), ['FAIL  tests  npm run test exited 1 in WSL2 (Ubuntu)']);
  assert.deepEqual(failedRows('npm ERR! nothing like a row'), []);
});

// The merge door (odd/tasks/rule-hierarchy.md, "The merge door (T16e)"): each pull request merged into the candidate
// runs main's `check.mjs --door`. The fixtures below give main a check.mjs of its own, and the door is answered by a stub
// (`withDoor`), except that main's check.mjs is read for real: the queue decides from its text whether main has a door.

/** Commits `checker` as bin/check.mjs on the detached `root` and pushes it as main: main's source, as the door reads it.
 * Returns the new main. */
function landChecker(root, checker) {
  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(root, 'bin', 'check.mjs'), checker, 'utf8');
  git(root, 'add', 'bin/check.mjs');
  git(root, 'commit', '--quiet', '-m', 'main has a check.mjs');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  return git(root, 'rev-parse', 'HEAD');
}

/** makeQueueRepo, with a feat/e branch that adds e.txt (it merges cleanly with the others), and main carrying a check.mjs
 * with the door's flag (or `checker`). `{ root, origin, main, heads }`, with feat/e in `heads`. */
function makeDoorRepo(checker = "const FLAGS = ['--door'];\n") {
  const made = makeQueueRepo();
  const { root } = made;
  git(root, 'checkout', '--quiet', '-b', 'feat/e', made.main);
  fs.writeFileSync(path.join(root, 'e.txt'), 'E from e\n', 'utf8');
  git(root, 'add', 'e.txt');
  git(root, 'commit', '--quiet', '-m', 'feat/e');
  git(root, 'push', '--quiet', 'origin', 'feat/e');
  const e = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', made.main);
  return { ...made, main: landChecker(root, checker), heads: { ...made.heads, 'feat/e': e } };
}

const passes = () => ({ status: 0, stdout: 'PASS  rules  the rule rows hold\n', stderr: '' });
const branchOf = (args) => args[args.indexOf('--branch') + 1];

/** `base` with every `node <...>/check.mjs --door ...` answered by `door(args, options)`, each one recorded in `doors`. */
function withDoor(base, door, doors) {
  return (command, args, options) => {
    if (command === process.execPath && args.includes('--door')) {
      doors.push({ args, cwd: options.cwd });
      return door(args, options);
    }
    return base(command, args, options);
  };
}

/** `--dry-run` with the merge door answered by `door`: `{ code, out, calls, doors }`. */
async function dryRunWithDoor(root, prs, door) {
  const { run, calls } = runner(prs);
  const doors = [];
  const out = [];
  const code = await mergeQueueMain(['--dry-run', '--cwd', root], { run: withDoor(run, door, doors), covered: () => ({ pass: true }), stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out, calls, doors };
}

test('a pull request whose merge door refuses it leaves the batch with the door\'s FAIL row, its merge is taken back, and the batch goes on', async () => {
  const { root, main, heads } = makeDoorRepo();
  const seen = [];
  const door = (args, options) => {
    if (branchOf(args) === 'feat/e') seen.push(fs.readFileSync(path.join(options.cwd, 'b.txt'), 'utf8'));
    return branchOf(args) === 'feat/b' ? { status: 1, stdout: 'PASS  rules  the rule rows hold\nFAIL  rules  feat/b turns a rule to refuse\n', stderr: '' } : passes();
  };
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b']), pr(3, 'feat/e', heads['feat/e'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.ok(out.includes('PR 2 is left out: the merge door refuses it: FAIL  rules  feat/b turns a rule to refuse.'), out.join('\n'));
  assert.ok(out.includes(`Candidate: main ${main.slice(0, 7)} with 2 pull requests merged in order: PR 1 (feat/a), PR 3 (feat/e).`), out.join('\n'));
  assert.deepEqual(seen, ['b1\n'], 'the merge of PR 2 was taken back before PR 3 merged');
});

test('a pull request whose merge door passes stays in the candidate, and the door\'s INFO rows for it are printed, indented', async () => {
  const { root, main, heads } = makeDoorRepo();
  const door = () => ({ status: 0, stdout: 'PASS  rules  the rule rows hold\nINFO  rules  one line added to a text in force\n', stderr: '' });
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(out, [
    'PR 1 notes from the merge door:',
    '  INFO  rules  one line added to a text in force',
    `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/a).`,
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
});

test('the merge door\'s rows keep their indented lines: under the INFO notes, and in the line that leaves a refused pull request out', async () => {
  const { root, main, heads } = makeDoorRepo();
  const door = (args) => (branchOf(args) === 'feat/b'
    ? { status: 1, stdout: 'FAIL  rules  1 restated value, 1 of a rule that refuses it\n      AGENTS.md:3 restates 88% (rule:context-pause)\nPASS  failures  none open\n', stderr: '' }
    : { status: 0, stdout: 'INFO  rules  1 restated value, none of a rule that refuses it\n      AGENTS.md:4 restates 400 lines (rule:slice-size)\n', stderr: '' });
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(out, [
    'PR 1 notes from the merge door:',
    '  INFO  rules  1 restated value, none of a rule that refuses it',
    '      AGENTS.md:4 restates 400 lines (rule:slice-size)',
    'PR 2 is left out: the merge door refuses it: FAIL  rules  1 restated value, 1 of a rule that refuses it: AGENTS.md:3 restates 88% (rule:context-pause).',
    `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/a).`,
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
});

test('a pull request whose merge makes no commit (its head is in the candidate already) runs no door, and a refusal never takes back the pull request before it', async () => {
  // Codex on dc03f8b..bbf7dc2: a merge that brings nothing leaves HEAD where it was, so HEAD^1..HEAD was the
  // previous pull request's merge, and the reset that took the refused merge back took that one instead.
  const { root, main, heads } = makeDoorRepo();
  const seen = [];
  const door = (args, options) => {
    seen.push(`${branchOf(args)} ${fs.readFileSync(path.join(options.cwd, 'a.txt'), 'utf8').trim()}`);
    return branchOf(args) === 'feat/a-again' ? { status: 1, stdout: 'FAIL  rules  refused\n', stderr: '' } : passes();
  };
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/a-again', heads['feat/a']), pr(3, 'feat/e', heads['feat/e'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(seen, ['feat/a A from a', 'feat/e A from a'], 'no door ran on the merge that brought nothing, and PR 1 is still in the candidate');
  assert.ok(out.includes(`Candidate: main ${main.slice(0, 7)} with 3 pull requests merged in order: PR 1 (feat/a), PR 2 (feat/a-again), PR 3 (feat/e).`), out.join('\n'));
});

test('a pull request whose merge door does not answer leaves the batch, and says the exit code it gave', async () => {
  const { root, main, heads } = makeDoorRepo();
  const door = (args) => (branchOf(args) === 'feat/a' ? { status: 2, stdout: '', stderr: 'unknown flag --door' } : passes());
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a']), pr(3, 'feat/e', heads['feat/e'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(out, [
    'PR 1 is left out: the merge door did not answer (exit 2).',
    `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 3 (feat/e).`,
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
});

test('a main whose check.mjs has no merge door runs no door: the batch merges as today, and one line says so', async () => {
  const { root, main, heads } = makeDoorRepo("console.log('no merge door yet');\n");
  const { code, out, doors } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a']), pr(3, 'feat/e', heads['feat/e'])], passes);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(doors, []);
  assert.deepEqual(out, [
    `Candidate: main ${main.slice(0, 7)} with 2 pull requests merged in order: PR 1 (feat/a), PR 3 (feat/e).`,
    'main\'s check.mjs has no merge door yet (odd/tasks/rule-hierarchy.md, T16e): no door ran',
    'Dry run: nothing was tested or pushed, and the candidate was removed.',
  ]);
});

test('the merge door runs in the candidate, with --base HEAD^1 and the pull request\'s branch, from main\'s check.mjs in the main worktree', async () => {
  const { root, heads } = makeDoorRepo();
  const { out, doors } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a'])], passes);
  assert.equal(doors.length, 1, out.join('\n'));
  const [{ args, cwd }] = doors;
  assert.deepEqual(args.slice(1), ['--door', '--base', 'HEAD^1', '--branch', 'feat/a']);
  assert.match(args[0], /merge-queue-\d+-\d+-main[\\/]bin[\\/]check\.mjs$/);
  assert.match(cwd, /merge-queue-\d+-\d+$/, 'the door runs in the candidate');
});

test('--land: a pull request merged again by the bisection passes the merge door again', async () => {
  const { root, heads } = makeDoorRepo();
  // Red whenever feat/b's change is in the tree under test, so the bisection merges PR 3 a second time.
  const suite = (dir) => (fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b') ? { ok: false, said: 'FAIL  tests' } : { ok: true });
  const doors = [];
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b']), pr(3, 'feat/e', heads['feat/e'])];
  const { code, out } = await land(root, prs, { suite, wrap: (run) => withDoor(run, passes, doors) });
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(doors.map((one) => branchOf(one.args)), ['feat/a', 'feat/b', 'feat/e', 'feat/e'], 'the door ran on each merge, and again on PR 3 merged a second time');
  assert.ok(out.includes('PR 2 is left out: the candidate turns red on this machine when it is merged (FAIL  tests).'), out.join('\n'));
});

test('the main worktree is made beside the candidate, and removed with it: on success, and on a failure after the merges', async () => {
  const { root, heads } = makeDoorRepo();
  const seen = [];
  const door = (args) => {
    seen.push(fs.existsSync(args[0]));
    return passes();
  };
  const { code, out } = await dryRunWithDoor(root, [pr(1, 'feat/a', heads['feat/a'])], door);
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(seen, [true], 'main\'s check.mjs was in its worktree when the door ran');
  assert.equal(git(root, 'worktree', 'list').split('\n').length, 1, 'no worktree is left');
  assert.deepEqual(fs.readdirSync(path.join(root, '.git', 'js-harness')), [], 'neither the candidate nor main is left under the git directory');

  const red = makeDoorRepo();
  const redSeen = [];
  const redDoor = (args) => {
    redSeen.push(fs.existsSync(args[0]));
    return passes();
  };
  const failed = await land(red.root, [pr(1, 'feat/a', red.heads['feat/a'])], { checks: [[circle('completed', 'failure')]], wrap: (run) => withDoor(run, redDoor, []) });
  assert.equal(failed.code, 4, failed.out.join('\n'));
  assert.deepEqual(redSeen, [true]);
  assert.equal(git(red.root, 'worktree', 'list').split('\n').length, 1, 'no worktree is left after the red CircleCI');
  assert.deepEqual(fs.readdirSync(path.join(red.root, '.git', 'js-harness')), []);
});
