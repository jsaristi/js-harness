import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import * as queue from './merge-queue.mjs';
import { actionsState, failedRows, failingTests, landingLines, localSuite, mergeQueueMain, staleBin, tellLeftOut } from './merge-queue.mjs';
import { appendNotice, newNotice, NOTICE_TEXT_MAX, readNotices } from './lib/channel.mjs';
import { appendGateEvent } from './lib/gate-log.mjs';
import { lensCandidate } from './lib/lens-candidate.mjs';
import { appendLensReview, LENS_REVIEW_SCHEMA } from './lib/lens-reviews.mjs';
import { repoTemplate } from './lib/git-fixture.testkit.mjs';
import { declarationOf } from './lib/rules-change-run.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';

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
  // A clone of a repository that has commits names its default branch as origin's HEAD; the queue reads it there.
  git(root, 'remote', 'set-head', 'origin', 'main');
  return { main, heads };
});

const pr = (number, branch, head, over = {}) => ({ number, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'Risk: none', headRefOid: head, headRefName: branch, ...over });

/** A runner that runs git for real and answers gh with `prs`, as GitHub does: `gh pr list --base <b>` lists the pull
 * requests based on b only, and `--limit <n>` the first n of them (`prs` in GitHub's order, newest first). `gh.view()` answers `gh repo view`, `gh.edit(args)` answers `gh pr edit`, each a
 * `{ status, stdout, stderr }`; the calls it saw. */
function runner(prs, gh = {}) {
  const calls = [];
  const run = (command, args, options) => {
    calls.push([command, ...args].join(' '));
    if (command === 'git') return spawnSync(command, args, options);
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') {
      const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
      const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
      return { status: 0, stdout: JSON.stringify((base ? prs.filter((one) => one.baseRefName === base) : prs).slice(0, limit)) };
    }
    if (command === 'gh' && args[0] === 'repo' && args[1] === 'view' && gh.view) return gh.view(args);
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'edit' && gh.edit) return gh.edit(args);
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
  const { code, out } = await dryRun(root, [pr(1, 'feat/a', heads['feat/a'], { isDraft: true })]);
  assert.equal(code, 0);
  assert.deepEqual(out, ['PR 1 is left out: PR 1 is a draft.', 'No pull request is ready to merge: nothing was built.']);
  assert.equal(git(root, 'worktree', 'list').split('\n').length, 1);
});

test('no mode, or an unknown flag, is a usage error (exit 2)', async () => {
  const { run } = runner([]);
  const out = [];
  const io = { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) };
  assert.equal(await mergeQueueMain([], io), 2);
  assert.equal(await mergeQueueMain(['--dry-run', '--bogus'], io), 2);
  assert.match(out.join('\n'), /^Usage: js-harness merge-queue --dry-run/m);
});

/** A runner for `--land`: git for real, `gh pr list` from `prs`, and the workflow runs of a commit from `checks`,
 * one answer a call (the last repeats); `onChecks(call)` runs before each answer. A run that names no branch or sha
 * takes the ones the land asked for. */
function landRunner(prs, checks, onChecks = () => {}, gh = {}) {
  const base = runner(prs, gh);
  let asked = 0;
  const run = (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && /\/actions\/runs\?/.test(args[1])) {
      base.calls.push([command, ...args].join(' '));
      onChecks(asked);
      const query = new URLSearchParams(args[1].split('?')[1]);
      const answer = checks[Math.min(asked, checks.length - 1)].map((one) => ({ head_branch: query.get('branch'), head_sha: query.get('head_sha'), ...one }));
      asked += 1;
      return { status: 0, stdout: JSON.stringify({ workflow_runs: answer }) };
    }
    return base.run(command, args, options);
  };
  return { run, calls: base.calls };
}

const workflowRun = (status, conclusion = null, more = {}) => ({ id: 1, name: 'gate', path: '.github/workflows/gate.yml', status, conclusion, html_url: 'https://github.com/o/r/actions/runs/1', ...more });

async function land(root, prs, { suite = () => ({ ok: true }), checks = [[workflowRun('completed', 'success')]], onChecks, wrap = (run) => run, env, cwd = root, gh } = {}) {
  const { run, calls } = landRunner(prs, checks, onChecks, gh);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', cwd], { run: wrap(run), covered: () => ({ pass: true }), suite, sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line), ...(env && { env }) });
  return { code, out, calls };
}

/** A runner that answers `answer(args)` for the git calls `match(args)` names, and runs the rest. */
const failingGit = (match, answer) => (run) => (command, args, options) => (command === 'git' && match(args) ? answer(run, args, options) : run(command, args, options));
const refused = () => ({ status: 1, stdout: '', stderr: 'fatal: refused by the test' });

const remoteBranches = (origin) => git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n').filter(Boolean).sort();
const queueBranches = (origin) => remoteBranches(origin).filter((name) => name.startsWith('queue/'));
/** Whether a call among `calls` pushed main; the queue branch is pushed by every land that tests a candidate. */
const pushedMain = (calls) => calls.some((line) => line.startsWith('git push') && line.endsWith(':refs/heads/main'));

/** A project whose default branch is `name`, not main: origin's HEAD names it and origin holds no main (C-b-6). */
function makeTrunkRepo(name = 'trunk') {
  const made = makeQueueRepo();
  const { root, origin } = made;
  git(origin, 'symbolic-ref', 'HEAD', `refs/heads/${name}`);
  git(origin, 'branch', '-m', 'main', name);
  git(root, 'fetch', '--quiet', '--prune', 'origin');
  git(root, 'remote', 'set-head', 'origin', name);
  return { ...made, name };
}

/** Takes origin's HEAD off `root`, and keeps a fetch from putting it back: git 2.48 and later re-create it on fetch by
 * default (`remote.<name>.followRemoteHEAD`), and the queue fetches before it reads the default branch. */
function unsetOriginHead(root) {
  git(root, 'config', 'remote.origin.followRemoteHEAD', 'never');
  git(root, 'remote', 'set-head', 'origin', '--delete');
}

/** A branch of `root` built on `base`, with one file of its own, pushed; its head. The clone goes back to where it was. */
function stackOn(root, base, branch) {
  const was = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '-b', branch, base);
  fs.writeFileSync(path.join(root, `${branch.replace('/', '-')}.txt`), `${branch}\n`, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', branch);
  git(root, 'push', '--quiet', 'origin', branch);
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', was);
  return head;
}

test('--land: a repository whose default branch is not main lands on that branch, read from origin\'s HEAD (C-b-6)', async () => {
  const { root, origin, heads, main, name } = makeTrunkRepo();
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'], { baseRefName: name })]);
  assert.equal(code, 0, out.join('\n'));
  assert.ok(!out.some((line) => /could not read origin\/main/.test(line)), out.join('\n'));
  assert.ok(calls.some((line) => line.startsWith('gh pr list') && line.includes(`--base ${name}`)), 'the pull requests asked for are based on the default branch');
  assert.ok(calls.some((line) => line.startsWith('git push') && line.endsWith(`:refs/heads/${name}`)), 'the candidate is pushed to the default branch');
  assert.notEqual(git(origin, 'rev-parse', name), main, 'the default branch moved');
  assert.ok(out.some((line) => line.startsWith(`Landed: ${name} `)), out.join('\n'));
});

test('--land: with origin\'s HEAD unset, the default branch is the one gh repo view names, and the land goes on (C-b-6)', async () => {
  const { root, origin, heads, main, name } = makeTrunkRepo();
  unsetOriginHead(root);
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'], { baseRefName: name })], { gh: { view: () => ({ status: 0, stdout: `${name}\n`, stderr: '' }) } });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(calls.includes('gh repo view --json defaultBranchRef -q .defaultBranchRef.name'), 'gh was asked for the default branch');
  assert.notEqual(git(origin, 'rev-parse', name), main, 'the default branch moved');
});

test('--land: when neither origin/HEAD nor gh repo view names the default branch, the land refuses, names both commands and pushes nothing (C-b-6)', async () => {
  const { root, origin, heads, main } = makeQueueRepo();
  unsetOriginHead(root);
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { gh: { view: () => ({ status: 1, stdout: '', stderr: 'gh: not logged in' }) } });
  assert.equal(code, 1, out.join('\n'));
  assert.match(out.at(-1), /^merge-queue: could not read the default branch: .*git symbolic-ref refs\/remotes\/origin\/HEAD.*gh repo view --json defaultBranchRef/);
  assert.equal(git(origin, 'rev-parse', 'main'), main, 'main did not move');
  assert.ok(!calls.some((line) => line.startsWith('git push')), 'nothing was pushed');
});

test('--land: a repository whose origin names main reads it there and asks gh for nothing of its own, as before (C-b-6, previous behavior)', async () => {
  const { root, origin, heads, main } = makeQueueRepo();
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.ok(!calls.some((line) => line.startsWith('gh repo view')), 'origin\'s HEAD answered, so gh is not asked');
  assert.ok(calls.some((line) => line.startsWith('gh pr list') && line.includes('--base main')));
  assert.ok(calls.some((line) => line.startsWith('git push') && line.endsWith(':refs/heads/main')), 'the candidate is pushed to main');
  assert.notEqual(git(origin, 'rev-parse', 'main'), main, 'main moved');
});

test('--land: an open pull request based on a branch that just landed is retargeted to the default branch with gh pr edit, and says so (C-b-4)', async () => {
  const { root, heads } = makeQueueRepo();
  const stacked = stackOn(root, 'feat/a', 'feat/s');
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/s', stacked, { baseRefName: 'feat/a' })];
  const { code, out, calls } = await land(root, prs, { gh: { edit: () => ({ status: 0, stdout: '', stderr: '' }) } });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(calls.includes('gh pr edit 2 --base main'), calls.join('\n'));
  assert.equal(calls.filter((line) => line.startsWith('gh pr edit')).length, 1, 'only the stacked pull request is edited');
  assert.ok(out.includes('PR 2 retargeted from feat/a to main.'), out.join('\n'));
});

// Codex review of eed429b, P2: one listing of every open pull request stops at its limit, so a stacked one older than
// the newest hundred was never retargeted. Each landed branch is asked for the pull requests based on it.
test('--land: a stacked pull request older than a hundred newer open ones is still retargeted (C-b-4)', async () => {
  const { root, heads } = makeQueueRepo();
  const stacked = stackOn(root, 'feat/a', 'feat/s');
  const newer = Array.from({ length: 100 }, (_, i) => pr(300 + i, `other/${i}`, heads['feat/b'], { baseRefName: `other/base-${i}` }));
  const prs = [...newer, pr(2, 'feat/s', stacked, { baseRefName: 'feat/a' }), pr(1, 'feat/a', heads['feat/a'])];
  const { code, out, calls } = await land(root, prs, { gh: { edit: () => ({ status: 0, stdout: '', stderr: '' }) } });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(calls.includes('gh pr edit 2 --base main'), calls.join('\n'));
  assert.equal(calls.filter((line) => line.startsWith('gh pr edit')).length, 1, 'only the stacked pull request is edited');
});

test('--land: an open pull request whose base did not land is not touched (C-b-4)', async () => {
  const { root, heads } = makeQueueRepo();
  const stacked = stackOn(root, 'feat/c', 'feat/t');
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(3, 'feat/t', stacked, { baseRefName: 'feat/c' })];
  const { code, out, calls } = await land(root, prs);
  assert.equal(code, 0, out.join('\n'));
  assert.ok(!calls.some((line) => line.startsWith('gh pr edit')), calls.join('\n'));
});

test('--land: a retarget gh refuses is said, and the land still exits 0 with main moved (C-b-4)', async () => {
  const { root, origin, heads, main } = makeQueueRepo();
  const stacked = stackOn(root, 'feat/a', 'feat/s');
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/s', stacked, { baseRefName: 'feat/a' })];
  const { code, out } = await land(root, prs, { gh: { edit: () => ({ status: 1, stdout: '', stderr: 'refused by the test' }) } });
  assert.equal(code, 0, out.join('\n'));
  assert.notEqual(git(origin, 'rev-parse', 'main'), main, 'the land happened');
  assert.ok(out.includes('Could not retarget PR 2 to main (refused by the test): it stays on feat/a until it is retargeted by hand.'), out.join('\n'));
});

test('--land: the candidate green locally and on GitHub Actions becomes main, by fast-forward, and its queue branch is removed', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { checks: [[workflowRun('in_progress')], [workflowRun('completed', 'success')]] });
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.notEqual(landed, main);
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', main, landed], { cwd: origin }).status, 0, 'a fast-forward of the main it was built from');
  for (const head of [heads['feat/a'], heads['feat/b']]) assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', head, landed], { cwd: origin }).status, 0, 'each pull request is in main');
  assert.ok(!remoteBranches(origin).some((name) => name.startsWith('queue/')), 'the queue branch is gone');
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1, PR 2.`);
});

test('--land: a candidate red locally pushes no main, and the queue branch that started its GitHub Actions run is removed', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { suite: () => ({ ok: false, said: 'npm run test exited 1' }) });
  assert.equal(code, 4, out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!pushedMain(calls));
  assert.deepEqual(queueBranches(origin), []);
  assert.match(out.at(-1), /^The candidate is red on this machine \(npm run test exited 1\): main was not pushed\.$/);
});

test('--land: a candidate red on GitHub Actions leaves main as it was', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { checks: [[workflowRun('completed', 'failure')]] });
  assert.equal(code, 4, out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!remoteBranches(origin).some((name) => name.startsWith('queue/')));
  assert.match(out.at(-1), /^The candidate is red on GitHub Actions \(gate: failure, https:\/\/github\.com\/o\/r\/actions\/runs\/1\): main was not pushed\.$/);
});

// Harness review b2, 2026-10-18: a CI run that never answered judged nothing, so it is no red (4) but 5.
test('--land: a candidate GitHub Actions gave no result for leaves main as it was, and exits 5, not red', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { checks: [[workflowRun('in_progress')]] });
  assert.equal(code, 5, out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.deepEqual(queueBranches(origin), []);
  assert.equal(out.at(-1), 'GitHub Actions gave no result for the candidate in 30 minutes: main was not pushed.');
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

// Verifier of eed429b, advisory: a branch whose head moved during the land holds commits main has not, so a pull request
// stacked on it stays there until that branch lands again; retargeted, it would show those commits as its own.
test('--land: a pull request stacked on a branch whose head moved during the land is not retargeted (C-b-4)', async () => {
  const { root, origin, heads } = makeQueueRepo();
  const stacked = stackOn(root, 'feat/a', 'feat/s');
  const other = path.join(path.dirname(origin), 'other');
  const moveHead = (call) => {
    if (call !== 0) return;
    git(path.dirname(origin), 'clone', '--quiet', '--branch', 'feat/a', origin, other);
    git(other, 'config', 'user.email', 'js-harness-test@example.invalid');
    git(other, 'config', 'user.name', 'js-harness test');
    fs.writeFileSync(path.join(other, 'a.txt'), 'A from a, later\n', 'utf8');
    git(other, 'commit', '--quiet', '-am', 'a later commit');
    git(other, 'push', '--quiet', 'origin', 'feat/a');
  };
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/s', stacked, { baseRefName: 'feat/a' })];
  const { code, out, calls } = await land(root, prs, { onChecks: moveHead, gh: { edit: () => ({ status: 0, stdout: '', stderr: '' }) } });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(!calls.some((line) => line.startsWith('gh pr edit')), calls.join('\n'));
  assert.match(out.at(-1), /^PR 1 moved to [0-9a-f]{7} during the land; its new commits are not in main\.$/);
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
  assert.ok(!pushedMain(calls));
  assert.deepEqual(queueBranches(origin), []);
  assert.match(out.join('\n'), /could not reset the candidate to the merge of PR 1 \(fatal: refused by the test\)/);
});

test('GitHub Actions is green only when the gate\'s run succeeded: a skipped or neutral run is no run of the suite (Codex, 2026-10-14)', () => {
  const at = { branch: 'queue/x', sha: 'a'.repeat(40) };
  const run = (conclusion, more = {}) => workflowRun('completed', conclusion, { head_branch: at.branch, head_sha: at.sha, ...more });
  assert.equal(actionsState([run('success')], at).state, 'green');
  assert.equal(actionsState([run('skipped')], at).state, 'pending');
  assert.equal(actionsState([run('neutral')], at).state, 'pending');
  assert.equal(actionsState([workflowRun('in_progress', null, { head_branch: at.branch, head_sha: at.sha })], at).state, 'pending');
  assert.equal(actionsState([run('failure')], at).state, 'red');
  assert.equal(actionsState([], at).state, 'pending');
});

// Codex, 2026-10-27, on 87c6f87: the land waits for gate.yml on its queue branch and its candidate, and no other run
// decides it, as a windows-daily.yml run dispatched by hand on a queue/* ref would.
test('only the gate workflow\'s newest run on the queue branch and the candidate decides the land', () => {
  const at = { branch: 'queue/x', sha: 'a'.repeat(40) };
  const run = (conclusion, more = {}) => workflowRun('completed', conclusion, { head_branch: at.branch, head_sha: at.sha, ...more });
  const daily = { path: '.github/workflows/windows-daily.yml', name: 'windows-daily' };
  assert.equal(actionsState([run('failure', daily), run('success')], at).state, 'green');
  assert.equal(actionsState([run('success', daily)], at).state, 'pending');
  assert.equal(actionsState([run('success', { head_branch: 'gate/y' })], at).state, 'pending');
  assert.equal(actionsState([run('success', { head_sha: 'b'.repeat(40) })], at).state, 'pending');
  assert.equal(actionsState([run('failure', { id: 1 }), run('success', { id: 2 })], at).state, 'green', 'the newer run counts: a re-run keeps its id, so a newer id is the run of another push');
  assert.equal(actionsState([run('success', { id: 2 }), run('failure', { id: 1 })], at).state, 'green', 'whatever order GitHub lists them in');
});

test('--land: a read of GitHub Actions that fails is asked again, never taken for an empty answer (Codex, 2026-10-14)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  let reads = 0;
  const base = landRunner([pr(1, 'feat/a', heads['feat/a'])], [[workflowRun('completed', 'success')]]);
  const run = (command, args, options) => {
    if (command === 'gh' && args[0] === 'api' && /\/actions\/runs\?/.test(args[1]) && (reads += 1) === 1) return { status: 1, stdout: '', stderr: 'HTTP 502' };
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
  const failed = await land(red.root, [pr(1, 'feat/a', red.heads['feat/a'])], { checks: [[workflowRun('completed', 'failure')]], wrap: (run) => withDoor(run, redDoor, []) });
  assert.equal(failed.code, 4, failed.out.join('\n'));
  assert.deepEqual(redSeen, [true]);
  assert.equal(git(red.root, 'worktree', 'list').split('\n').length, 1, 'no worktree is left after the red GitHub Actions');
  assert.deepEqual(fs.readdirSync(path.join(red.root, '.git', 'js-harness')), ['lands.jsonl'], 'only the land record is left (odd/tasks/land-unattended.md, B2), neither the candidate nor main');
});

// The reviews of the pull request's own commits, and the coverage commit by commit (odd/tasks/rule-hierarchy.md,
// "The merge door (T16e)", items 5 and 6). These runs read the Codex records and the branch for real: no `covered` stub.

const REVIEWED_AT = '2026-10-16T12:00:00.000Z';

/** Appends to the Codex review records of the clone at `root` one review of `base..head`, and to its lens records one
 * whose outcome is `lens` (`reviewed`, `unavailable` with a reason, or none when `null`). */
function writeRecord(root, { base, head, lens = 'reviewed' }) {
  fs.mkdirSync(path.join(root, '.git', 'js-harness'), { recursive: true });
  const rec = { schema: 'js-harness.codex-review/v1', base, head, reviewedAt: REVIEWED_AT, outcome: 'reviewed' };
  fs.appendFileSync(path.join(root, '.git', 'js-harness', 'codex-reviews.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8');
  if (lens) writeLensRecord(root, { base, head, outcome: lens });
}

/** Appends to the lens records of the clone at `root` one of `base..head` with `outcome`, as `lens-review` writes it. */
function writeLensRecord(root, { base, head, outcome }) {
  const { subjectHash } = lensCandidate(root, { base, head });
  const said = outcome === 'reviewed' ? { results: [{ lens: 'risk', outcome: 'complete', findings: [] }] } : { reason: 'the plan is out of turns' };
  appendLensReview(root, { schema: LENS_REVIEW_SCHEMA, base, head, subjectHash, reviewedAt: REVIEWED_AT, outcome, ...said });
}

/** makeQueueRepo with a branch feat/g of two commits: g.txt (code), then odd/tasks/g.md, a note. With `codex` on, main's harness.json turns the Codex review on and a record covers
 * main..feat/g, and a lens record whose outcome is `lens` (`writeRecord`). `{ root, origin, main, code, head }`. */
function makeEvidenceRepo({ codex = true, lens = 'reviewed' } = {}) {
  const made = makeQueueRepo();
  const { root } = made;
  const commit = (file, text, message) => {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text, 'utf8');
    git(root, 'add', file);
    git(root, 'commit', '--quiet', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  let main = made.main;
  if (codex) {
    main = commit('harness.json', `${JSON.stringify({ functions: { codexReview: 'on', lensReview: 'on' } })}\n`, 'main turns the Codex and lens reviews on');
    git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  }
  git(root, 'checkout', '--quiet', '-b', 'feat/g', main);
  const code = commit('g.txt', 'g\n', 'feat/g code');
  const head = commit('odd/tasks/g.md', '# G\n- notes\n', 'feat/g evidence');
  git(root, 'push', '--quiet', 'origin', 'feat/g');
  git(root, 'checkout', '--quiet', '--detach', main);
  if (codex) writeRecord(root, { base: main, head, lens });
  return { ...made, main, code, head };
}

/** `--dry-run` with no `covered` stub: `{ code, out }`. */
async function dryRunEvidence(root, prs) {
  const { run } = runner(prs);
  const out = [];
  const code = await mergeQueueMain(['--dry-run', '--cwd', root], { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out };
}

test('a code commit its Codex and lens records cover is ready, and the coverage is printed commit by commit', async () => {
  const { root, main, code, head } = makeEvidenceRepo();
  const { code: exit, out } = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.equal(exit, 0, out.join('\n'));
  assert.deepEqual(out.slice(0, 3), [
    'PR 1, commit by commit:',
    `  ${code.slice(0, 7)} feat/g code: Codex ${main.slice(0, 7)}..${head.slice(0, 7)} reviewed ${REVIEWED_AT.slice(0, 10)}`,
    `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/g).`,
  ]);
});

test('a code commit no complete lens record covers leaves the pull request out (odd/tasks/f8-s1-reviews.md, T5)', async () => {
  const { root, head } = makeEvidenceRepo({ lens: null });
  const { out } = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.match(out[0], /^PR 1 is left out: lens review: 1 of 1 code commit since origin\/main have no complete Claude lens record/);
});

test('a lens skip leaves the pull request out until a review of the same commits pays it (S7)', async () => {
  const { root, main, head } = makeEvidenceRepo({ lens: 'unavailable' });
  const skipped = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.match(skipped.out[0], new RegExp(`^PR 1 is left out: it holds a lens review skip, which owes a review before it lands: unavailable ${main.slice(0, 7)}\\.\\.${head.slice(0, 7)}: the plan is out of turns`));
  writeLensRecord(root, { base: main, head, outcome: 'reviewed' });
  const paid = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.ok(paid.out.includes(`Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/g).`), paid.out.join('\n'));
});

test('with the Codex review off, a code commit is one that changes a file that is not Markdown, and it lands on its lens record alone (L11, L14)', async () => {
  const { root, main, code, head } = makeEvidenceRepo({ codex: false });
  const unreviewed = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.match(unreviewed.out[0], /^PR 1 is left out: lens review: 1 of 1 code commit since origin\/main have no complete Claude lens record/);
  writeLensRecord(root, { base: main, head, outcome: 'reviewed' });
  const { code: exit, out } = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.equal(exit, 0, out.join('\n'));
  assert.equal(out[1], `  ${code.slice(0, 7)} feat/g code: the Codex review is off`, out.join('\n'));
  assert.ok(!out.some((line) => /gentle-ai/i.test(line)), out.join('\n'));
});

test('a pull request of documents alone prints no coverage', async () => {
  const { root, main } = makeQueueRepo();
  git(root, 'checkout', '--quiet', '-b', 'feat/docs', main);
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'odd', 'tasks', 'd.md'), '# D\n', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'feat/docs');
  git(root, 'push', '--quiet', 'origin', 'feat/docs');
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', main);
  const { code, out } = await dryRunEvidence(root, [pr(1, 'feat/docs', head)]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(out[0], `Candidate: main ${main.slice(0, 7)} with 1 pull request merged in order: PR 1 (feat/docs).`);
});

test('a merge of main into the branch, with an edit written in it, lands on the records that cover it', async () => {
  const { root, code, head } = makeEvidenceRepo();
  // main moves, and the branch merges it with a line written in the merge itself.
  git(root, 'checkout', '--quiet', '-b', 'moved', 'origin/main');
  fs.writeFileSync(path.join(root, 'm.txt'), 'm\n', 'utf8');
  git(root, 'add', 'm.txt');
  git(root, 'commit', '--quiet', '-m', 'main moves');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  git(root, 'checkout', '--quiet', 'feat/g');
  git(root, 'merge', '--quiet', '--no-ff', '--no-commit', 'moved');
  fs.writeFileSync(path.join(root, 'm.txt'), 'm, edited in the merge\n', 'utf8');
  git(root, 'add', 'm.txt');
  git(root, 'commit', '--quiet', '-m', 'merge main');
  git(root, 'push', '--quiet', 'origin', 'feat/g');
  const merged = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', 'moved');
  writeRecord(root, { base: head, head: merged });
  const { code: exit, out } = await dryRunEvidence(root, [pr(1, 'feat/g', merged)]);
  assert.equal(exit, 0, out.join('\n'));
  assert.ok(!out.some((one) => one.includes('left out')), out.join('\n'));
  assert.ok(out.some((one) => one.startsWith(`  ${code.slice(0, 7)} feat/g code:`)), out.join('\n'));
});

test('with the Codex review off, a Markdown file whose name git quotes is no code', async () => {
  const { root, main, code } = makeEvidenceRepo({ codex: false });
  // Written to the index alone, NTFS's guard off: Windows names no file with a double quote, and git quotes such a name.
  git(root, 'checkout', '--quiet', 'feat/g');
  const scratch = path.join(root, '.git', 'quoted-blob');
  fs.writeFileSync(scratch, 'notes\n', 'utf8');
  const blob = git(root, 'hash-object', '-w', scratch);
  fs.rmSync(scratch);
  git(root, 'config', 'core.protectNTFS', 'false');
  git(root, 'update-index', '--add', '--cacheinfo', `100644,${blob},notes/say "hi".md`);
  git(root, 'commit', '--quiet', '-m', 'a note with a quoted name');
  git(root, 'push', '--quiet', 'origin', 'feat/g');
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', main);
  writeLensRecord(root, { base: main, head, outcome: 'reviewed' });
  // The evidence alone is asserted: Windows cannot write the file into the candidate, which a merge then says.
  const { out } = await dryRunEvidence(root, [pr(1, 'feat/g', head)]);
  assert.deepEqual(out.slice(0, 2), ['PR 1, commit by commit:', `  ${code.slice(0, 7)} feat/g code: the Codex review is off`], out.join('\n'));
});

// A land of documents alone (the throughput plan's item 7, 2026-10-16): the suite is not run on this machine for a
// candidate whose every changed path is a document that main's harness.json declares, as a commit of documents alone runs
// no suite; GitHub Actions still runs the whole gate on it.

/** makeQueueRepo, with main declaring documents in harness.json (`declared`, an object, or a text written as it is) and
 * holding docs/kept.md, and four branches on it: feat/doc adds docs/a.md and feat/doc2 adds odd/tasks/b.md, documents
 * alone; feat/move moves docs/kept.md out of docs/, and feat/widen declares a.txt a document in its own harness.json and
 * changes it. `{ root, origin, main, heads }`, with the four in `heads`. */
function makeDocumentsRepo(declared = { documents: ['docs/', 'odd/tasks/'] }) {
  const made = makeQueueRepo();
  const { root } = made;
  const write = (file, text) => {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text, 'utf8');
    git(root, 'add', file);
  };
  write('harness.json', typeof declared === 'string' ? declared : `${JSON.stringify(declared)}\n`);
  write('docs/kept.md', 'kept\n');
  git(root, 'commit', '--quiet', '-m', 'main declares its documents');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  const main = git(root, 'rev-parse', 'HEAD');
  const heads = { ...made.heads };
  const branches = {
    'feat/doc': () => write('docs/a.md', 'feat/doc\n'),
    'feat/doc2': () => write('odd/tasks/b.md', 'feat/doc2\n'),
    'feat/move': () => git(root, 'mv', 'docs/kept.md', 'kept.md'),
    'feat/widen': () => {
      write('harness.json', `${JSON.stringify({ documents: ['docs/', 'odd/tasks/', 'a.txt'] })}\n`);
      write('a.txt', 'A from widen\n');
    },
  };
  for (const [branch, change] of Object.entries(branches)) {
    git(root, 'checkout', '--quiet', '-b', branch, main);
    change();
    git(root, 'commit', '--quiet', '-m', branch);
    git(root, 'push', '--quiet', 'origin', branch);
    heads[branch] = git(root, 'rev-parse', 'HEAD');
  }
  git(root, 'checkout', '--quiet', '--detach', main);
  return { ...made, main, heads };
}

/** `--land` of `prs` with a suite that records the folder it ran in: `{ code, out, suites }`. */
async function landCounted(root, prs, options = {}) {
  const suites = [];
  const { code, out } = await land(root, prs, { ...options, suite: (dir) => suites.push(dir) && { ok: true } });
  return { code, out, suites };
}

const DOCUMENTS_LINE = 'Every path the candidate changes is a document main\'s harness.json declares: the suite does not run on this machine, as for a commit of documents alone; GitHub Actions runs the whole gate on it.';

test('--land: a candidate of documents alone runs no suite on this machine, says so, and lands on GitHub Actions\'s green', async () => {
  const { root, origin, main, heads } = makeDocumentsRepo();
  const suites = [];
  const { code, out } = await land(root, [pr(1, 'feat/doc', heads['feat/doc']), pr(2, 'feat/doc2', heads['feat/doc2'])], { suite: (dir) => suites.push(dir) && { ok: true } });
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(suites, [], 'no suite ran on this machine');
  assert.ok(out.includes(DOCUMENTS_LINE), out.join('\n'));
  assert.ok(!out.some((line) => line.includes('is green on this machine')), out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${landed.slice(0, 7)}, with PR 1, PR 2.`);
});

test('--land: a candidate of documents alone that GitHub Actions turns red is not landed', async () => {
  const { root, origin, main, heads } = makeDocumentsRepo();
  const { code, out, suites } = await landCounted(root, [pr(1, 'feat/doc', heads['feat/doc'])], { checks: [[workflowRun('completed', 'failure')]] });
  assert.equal(code, 4, out.join('\n'));
  assert.deepEqual(suites, [], 'no suite ran on this machine');
  assert.ok(out.includes(DOCUMENTS_LINE), out.join('\n'));
  assert.ok(out.some((line) => line.startsWith('The candidate is red on GitHub Actions')), out.join('\n'));
  assert.equal(git(origin, 'rev-parse', 'main'), main);
});

test('--land: one pull request that changes more than documents runs the suite on the whole candidate, as before', async () => {
  const { root, heads } = makeDocumentsRepo();
  const { code, out, suites } = await landCounted(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/doc', heads['feat/doc'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(suites.length, 1, out.join('\n'));
  assert.ok(!out.includes(DOCUMENTS_LINE), out.join('\n'));
  assert.ok(out.some((line) => /^The candidate [0-9a-f]{7} is green on this machine\.$/.test(line)), out.join('\n'));
});

test('--land: a document moved out of the documents, or a harness.json that declares more of them, runs the suite', async () => {
  const { root, heads } = makeDocumentsRepo();
  for (const branch of ['feat/move', 'feat/widen']) {
    const { code, out, suites } = await landCounted(root, [pr(1, branch, heads[branch])]);
    assert.equal(code, 0, `${branch}\n${out.join('\n')}`);
    assert.equal(suites.length, 1, `${branch}\n${out.join('\n')}`);
    assert.ok(!out.includes(DOCUMENTS_LINE), `${branch}\n${out.join('\n')}`);
    git(root, 'fetch', '--quiet', 'origin');
    git(root, 'checkout', '--quiet', '--detach', 'origin/main');
  }
});

test('--land: a main whose harness.json does not parse runs the suite on a candidate of docs/ alone', async () => {
  const { root, heads } = makeDocumentsRepo('{ "documents": ["docs/"\n');
  const { code, out, suites } = await landCounted(root, [pr(1, 'feat/doc', heads['feat/doc'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(suites.length, 1, out.join('\n'));
});

test('--land: a submodule the candidate moves is a path that is no document, whatever the repository tells git to leave out of a diff', async () => {
  // The verifier, 2026-10-16: under diff.ignoreSubmodules=all a diff of names hides the submodule, as the commit gate
  // knows (stagedDocuments asks with --ignore-submodules=none).
  const { root, main } = makeDocumentsRepo();
  git(root, 'checkout', '--quiet', '-b', 'feat/sub', main);
  fs.writeFileSync(path.join(root, 'docs', 'c.md'), 'c\n', 'utf8');
  git(root, 'add', 'docs/c.md');
  git(root, 'update-index', '--add', '--cacheinfo', `160000,${main},sub`);
  git(root, 'commit', '--quiet', '-m', 'feat/sub');
  git(root, 'push', '--quiet', 'origin', 'feat/sub');
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', main);
  git(root, 'config', 'diff.ignoreSubmodules', 'all');
  const { code, out, suites } = await landCounted(root, [pr(1, 'feat/sub', head)]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(suites.length, 1, out.join('\n'));
  assert.ok(!out.includes(DOCUMENTS_LINE), out.join('\n'));
});

test('--land: documents are the ones main declares, so a main with no "documents" in harness.json runs the suite on a candidate of docs/ alone', async () => {
  const { root, heads } = makeDocumentsRepo({});
  const suites = [];
  const { code, out } = await land(root, [pr(1, 'feat/doc', heads['feat/doc'])], { suite: (dir) => suites.push(dir) && { ok: true } });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(suites.length, 1, out.join('\n'));
});

test('--dry-run: a candidate of documents alone says the suite would not run on this machine', async () => {
  const { root, heads } = makeDocumentsRepo();
  const { run } = runner([pr(1, 'feat/doc', heads['feat/doc'])]);
  const out = [];
  const code = await mergeQueueMain(['--dry-run', '--cwd', root], { run, covered: () => ({ pass: true }), stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(out.includes(DOCUMENTS_LINE), out.join('\n'));
});

// The landing line (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", item 7): a landed `rule/` branch confirms
// the newest "rule:<id> proposed on <branch>, not landed" relief line of each rule it changed.

const proposed = (id, branch, minute) => `2026-10-16 10:${minute} local (rules change). rule:${id} proposed on ${branch}, not landed: value; source design; supersedes no relief line`;

test('landingLines confirms the newest proposed line of each id on that branch alone, once', () => {
  const relief = ['# Relief', proposed('a', 'rule/a', '00:00'), proposed('a', 'rule/ab', '01:00'), proposed('ab', 'rule/a', '02:00'), proposed('a', 'rule/a', '03:00')].join('\n');
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a', 'b'], sha: 'abc1234' }), {
    lines: ['rule:a landed on main abc1234 from rule/a: confirms relief line 5'],
    none: ['b'],
  });
  const again = `${relief}\n2026-10-16 11:00:00 local (merge-queue). rule:a landed on main abc1234 from rule/a: confirms relief line 5\n`;
  assert.deepEqual(landingLines(again, { branch: 'rule/a', ids: ['a'], sha: 'abc1234' }), { lines: [], none: [] });
  const newer = `${again}${proposed('a', 'rule/a', '04:00')}\n`;
  assert.deepEqual(landingLines(newer, { branch: 'rule/a', ids: ['a'], sha: 'def5678' }).lines, ['rule:a landed on main def5678 from rule/a: confirms relief line 7']);
});

const RULES_DATA = (a) => `export const RULES = ${JSON.stringify([{ id: 'a', value: a }, { id: 'b', value: 2 }], null, 2)};\n`;

/** makeQueueRepo with bin/lib/rules-data.mjs on main and a branch rule/a that changes rule a; the home a temporary
 * folder whose relief file holds `lines`. `sources`, when given, is the branch's docs/rule-sources.json.
 * `{ root, origin, main, head, env, reliefFile }`. */
function makeRuleRepo(lines, { sources } = {}) {
  const made = makeQueueRepo();
  const { root } = made;
  fs.mkdirSync(path.join(root, 'bin', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'bin', 'lib', 'rules-data.mjs'), RULES_DATA(1), 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'rules on main');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  const main = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '-b', 'rule/a', main);
  fs.writeFileSync(path.join(root, 'bin', 'lib', 'rules-data.mjs'), RULES_DATA(5), 'utf8');
  if (sources !== undefined) {
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    const text = typeof sources === 'string' ? sources : `${JSON.stringify(sources, null, 2)}\n`;
    fs.writeFileSync(path.join(root, 'docs', 'rule-sources.json'), text, 'utf8');
    git(root, 'add', '.');
  }
  git(root, 'commit', '--quiet', '-am', 'rule a changes');
  git(root, 'push', '--quiet', 'origin', 'rule/a');
  const head = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '--detach', main);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-home-'));
  const slug = projectSlug(mainCheckout((command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' }), root));
  const reliefFile = path.join(home, '.js-harness', 'relief', `${slug}.md`);
  fs.mkdirSync(path.dirname(reliefFile), { recursive: true });
  fs.writeFileSync(reliefFile, `${lines.join('\n')}\n`, 'utf8');
  return { ...made, main, head, env: { JS_HARNESS_HOME: home }, reliefFile };
}

async function landRule(made, { args = ['--land'], suite = () => ({ ok: true }), wrap = (run) => run, onChecks } = {}) {
  const { run } = landRunner([pr(1, 'rule/a', made.head)], [[workflowRun('completed', 'success')]], onChecks);
  const out = [];
  const code = await mergeQueueMain([...args, '--cwd', made.root], { run: wrap(run), env: made.env, covered: () => ({ pass: true }), suite, sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out };
}

test('--land of a rule/ branch appends one line that confirms the newest proposal of each rule it changed', async () => {
  const made = makeRuleRepo(['# Relief', proposed('a', 'rule/a', '00:00'), proposed('a', 'rule/a', '01:00'), proposed('b', 'rule/a', '02:00')]);
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  const landed = git(made.origin, 'rev-parse', 'main').slice(0, 7);
  const added = fs.readFileSync(made.reliefFile, 'utf8').split('\n').filter(Boolean).slice(4);
  assert.equal(added.length, 1, added.join('\n'));
  assert.match(added[0], new RegExp(`^\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d local \\(merge-queue\\)\\. rule:a landed on main ${landed} from rule/a: confirms relief line 3$`));
  assert.ok(out.includes(`Relief: ${added[0]}`), out.join('\n'));
});

/** A push to origin's main from another clone, at the first read of GitHub Actions: the land then exits 3. */
const moveMainOf = (origin) => (call) => {
  if (call !== 0) return;
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-other-'));
  git(other, 'clone', '--quiet', origin, 'clone');
  const clone = path.join(other, 'clone');
  git(clone, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(clone, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(clone, 'z.txt'), 'z\n', 'utf8');
  git(clone, 'add', '.');
  git(clone, 'commit', '--quiet', '-m', 'main moved');
  git(clone, 'push', '--quiet', 'origin', 'HEAD:main');
};

test('--dry-run, a red land and a land whose main moved (exit 3) of a rule/ branch append no line', async () => {
  const cases = [[0, () => ({ args: ['--dry-run'] })], [4, () => ({ suite: () => ({ ok: false, said: 'npm run test exited 1' }) })], [3, (made) => ({ onChecks: moveMainOf(made.origin) })]];
  for (const [exit, options] of cases) {
    const made = makeRuleRepo(['# Relief', proposed('a', 'rule/a', '00:00')]);
    const before = fs.readFileSync(made.reliefFile, 'utf8');
    const { code, out } = await landRule(made, options(made));
    assert.equal(code, exit, out.join('\n'));
    assert.equal(fs.readFileSync(made.reliefFile, 'utf8'), before, out.join('\n'));
  }
});

test('a landed rule/ branch with no proposed line appends none and says so', async () => {
  const made = makeRuleRepo(['# Relief', proposed('a', 'rule/ab', '00:00')]);
  const before = fs.readFileSync(made.reliefFile, 'utf8');
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.readFileSync(made.reliefFile, 'utf8'), before);
  assert.ok(out.includes('PR 1 (rule/a) landed with no relief line "rule:a proposed on rule/a, not landed": no landing line is written for it.'), out.join('\n'));
});

test('a land whose push of main reported a failure, with main the candidate all the same, appends its line', async () => {
  const made = makeRuleRepo(['# Relief', proposed('a', 'rule/a', '00:00')]);
  const lost = failingGit((args) => args[0] === 'push' && args.some((arg) => arg.endsWith(':refs/heads/main')), (run, args, options) => {
    run('git', args, options);
    return { status: 1, stdout: '', stderr: 'error: the answer was lost' };
  });
  const { code, out } = await landRule(made, { wrap: lost });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(out.some((line) => line.startsWith('The push of main reported a failure')), out.join('\n'));
  assert.match(fs.readFileSync(made.reliefFile, 'utf8'), /\(merge-queue\)\. rule:a landed on main [0-9a-f]{7} from rule\/a: confirms relief line 2\n$/);
});

test('a land whose relief file cannot be found after main moved still exits 0 and says main moved', async () => {
  const made = makeRuleRepo(['# Relief', proposed('a', 'rule/a', '00:00')]);
  const before = fs.readFileSync(made.reliefFile, 'utf8');
  let pushed = false;
  const lost = (run) => (command, args, options) => {
    if (command === 'git' && args[0] === 'push' && args.some((arg) => arg.endsWith(':refs/heads/main'))) pushed = true;
    if (pushed && command === 'git' && args[0] === 'rev-parse' && args.includes('--git-common-dir')) throw new Error('the checkout went away');
    return run(command, args, options);
  };
  const { code, out } = await landRule(made, { wrap: lost });
  assert.equal(code, 0, out.join('\n'));
  assert.ok(out.some((line) => line.startsWith('Landed:')), out.join('\n'));
  assert.ok(out.includes('Could not write the landing lines of the relief file (the checkout went away): main moved all the same.'), out.join('\n'));
  assert.equal(fs.readFileSync(made.reliefFile, 'utf8'), before);
});

test('landingLines given until confirms only a proposal stamped by then, so a later one stays unconfirmed', () => {
  const relief = ['# Relief', proposed('a', 'rule/a', '00:00'), proposed('a', 'rule/a', '05:00'), 'not a stamped line rule:a proposed on rule/a, not landed'].join('\n');
  const until = new Date(2026, 9, 16, 10, 1, 0).getTime();
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until }), { lines: ['rule:a landed on main abc1234 from rule/a: confirms relief line 2'], none: [] });
  const early = new Date(2026, 9, 16, 9, 0, 0).getTime();
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until: early }), { lines: [], none: ['a'] });
});

test('a land confirms the proposal its tested head holds, not one rules change wrote after that head', async () => {
  const made = makeRuleRepo(['# Relief', proposed('a', 'rule/a', '00:00')]);
  fs.appendFileSync(made.reliefFile, `2099-01-01 00:00:00 local (rules change). rule:a proposed on rule/a, not landed: value; source design; supersedes relief line 2\n`, 'utf8');
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  assert.match(fs.readFileSync(made.reliefFile, 'utf8'), /\(merge-queue\)\. rule:a landed on main [0-9a-f]{7} from rule\/a: confirms relief line 2\n$/);
});

test('landingLines given declarations confirms the newest proposal whose declaration the landed head holds', () => {
  const relief = ['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration aaaaaaaaaaaa`, `${proposed('a', 'rule/a', '01:00')}; declaration bbbbbbbbbbbb`].join('\n');
  const until = new Date(2026, 9, 16, 11, 0, 0).getTime();
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'aaaaaaaaaaaa' } }).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 2']);
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'cccccccccccc' } }), { lines: [], none: ['a'] });
});

test('a land confirms the proposal whose declaration its head holds, not a newer one rules change wrote for another', async () => {
  const held = declarationOf(RULES_DATA(5), 'a');
  const made = makeRuleRepo(['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration ${held}`, `${proposed('a', 'rule/a', '05:00')}; declaration 000000000000`]);
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  assert.match(fs.readFileSync(made.reliefFile, 'utf8'), /\(merge-queue\)\. rule:a landed on main [0-9a-f]{7} from rule\/a: confirms relief line 2\n$/);
});

test('landingLines given sourced confirms a proposal whose declaration and source the landed head both hold', () => {
  const relief = ['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration and source aaaaaaaaaaaa`, `${proposed('a', 'rule/a', '01:00')}; declaration and source bbbbbbbbbbbb`].join('\n');
  const until = new Date(2026, 9, 16, 11, 0, 0).getTime();
  const given = { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'bbbbbbbbbbbb' } };
  assert.deepEqual(landingLines(relief, { ...given, sourced: { a: 'aaaaaaaaaaaa' } }).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 2']);
  // The declaration alone is not the declaration with its source: a line that names both is matched by both.
  assert.deepEqual(landingLines(relief, given), { lines: [], none: ['a'] });
});

test('landingLines reads a proposal with no hash beside hashed ones by its stamp, and the hashed ones by their hash', () => {
  const relief = ['# Relief', proposed('a', 'rule/a', '00:00'), `${proposed('a', 'rule/a', '01:00')}; declaration and source 000000000000`, proposed('a', 'rule/a', '30:00')].join('\n');
  const until = new Date(2026, 9, 16, 10, 10, 0).getTime();
  const given = { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'aaaaaaaaaaaa' }, sourced: { a: 'bbbbbbbbbbbb' } };
  assert.deepEqual(landingLines(relief, given).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 2']);
  assert.deepEqual(landingLines(relief, { ...given, sourced: { a: '000000000000' } }).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 3']);
});

test('landingLines reads a relief file with Windows line ends: a hashed line is matched and its place counted as with LF', () => {
  const relief = ['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration and source aaaaaaaaaaaa`, `${proposed('a', 'rule/a', '01:00')}; declaration aaaaaaaaaaaa`, 'rule:a landed on main 0000000 from rule/b: confirms relief line 9', ''].join('\r\n');
  const until = new Date(2026, 9, 16, 11, 0, 0).getTime();
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'aaaaaaaaaaaa' }, sourced: { a: 'cccccccccccc' } }).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 3']);
  assert.deepEqual(landingLines(relief, { branch: 'rule/a', ids: ['a'], sha: 'abc1234', until, declarations: { a: 'dddddddddddd' }, sourced: { a: 'aaaaaaaaaaaa' } }).lines, ['rule:a landed on main abc1234 from rule/a: confirms relief line 2']);
});

test('a land confirms the proposal whose source its head holds, not a newer one of the same declaration with another source (T16e-f)', async () => {
  const sources = { a: { kind: 'design', path: 'docs/A.md' } };
  const head = declarationOf(RULES_DATA(5), 'a', sources);
  const other = declarationOf(RULES_DATA(5), 'a', { a: { kind: 'design', path: 'docs/B.md' } });
  assert.notEqual(head, other);
  const made = makeRuleRepo(['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration and source ${head}`, `${proposed('a', 'rule/a', '05:00')}; declaration and source ${other}`], { sources });
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  assert.match(fs.readFileSync(made.reliefFile, 'utf8'), /\(merge-queue\)\. rule:a landed on main [0-9a-f]{7} from rule\/a: confirms relief line 2\n$/);
});

test('a head whose sources file does not parse still confirms a proposal that names the declaration alone', async () => {
  const made = makeRuleRepo(['# Relief', `${proposed('a', 'rule/a', '00:00')}; declaration ${declarationOf(RULES_DATA(5), 'a')}`], { sources: '{ not json' });
  const { code, out } = await landRule(made);
  assert.equal(code, 0, out.join('\n'));
  assert.match(fs.readFileSync(made.reliefFile, 'utf8'), /\(merge-queue\)\. rule:a landed on main [0-9a-f]{7} from rule\/a: confirms relief line 2\n$/);
  assert.ok(out.some((line) => line.includes('docs/rule-sources.json does not parse')), out.join('\n'));
});

test('--land whose suite did not run exits 5, bisects nothing and pushes nothing, with two pull requests', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  let runs = 0;
  const suite = () => {
    runs += 1;
    return { ok: false, notRun: true, said: 'gate: no turn in 90 minutes' };
  };
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite });
  assert.equal(code, 5, out.join('\n'));
  assert.equal(runs, 1, 'no bisection');
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!pushedMain(calls));
  assert.deepEqual(queueBranches(origin), []);
  assert.equal(out.at(-1), 'The suite did not run on this machine (gate: no turn in 90 minutes): main was not pushed, and nothing was bisected.');
});

test('--land whose suite does not run inside a bisection exits 5 and pushes nothing', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const answers = [{ ok: false, said: 'FAIL  tests' }, { ok: false, notRun: true, said: 'the gate was stopped before it ended' }];
  const { code, out, calls } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite: () => answers.shift() });
  assert.equal(code, 5, out.join('\n'));
  assert.equal(answers.length, 0);
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!pushedMain(calls));
  assert.deepEqual(queueBranches(origin), []);
  assert.equal(out.at(-1), 'The suite did not run on this machine (the gate was stopped before it ended): main was not pushed, and nothing was bisected.');
});

/** A `run` that answers the gate's calls by their first words after the candidate's bin: `answers[word]`. */
function gateRun(answers) {
  const calls = [];
  const run = (command, args) => {
    calls.push(args.slice(1));
    return answers[args[2] === 'first' ? 'first' : args[1]] ?? { status: 0, stdout: '', stderr: '' };
  };
  return { run, calls };
}

test('localSuite takes a gate-first ticket for the land, then reads a gate that did not run as not run', () => {
  const place = path.join(os.tmpdir(), 'candidate');
  const said = [];
  const { run, calls } = gateRun({ first: { status: 0, stdout: 'ticket 0a1b2c3d: the next check of session s1 goes first', stderr: '' }, gate: { status: 75, stdout: '', stderr: 'js-harness gate: no turn in 90 minutes\nmore' } });
  const result = localSuite(run, place, { env: { CLAUDE_CODE_SESSION_ID: 's1' }, say: (line) => said.push(line) });
  assert.deepEqual(calls[0], ['gate', 'first', '--session', 's1', '--tree', place, '--minutes', '60', '--reason', 'the merge queue lands a candidate']);
  assert.equal(calls[1][0], 'gate');
  assert.equal(calls[1][1], '--wait');
  assert.deepEqual(said, ['The land goes first in the gate line: ticket 0a1b2c3d: the next check of session s1 goes first']);
  assert.deepEqual(calls[2], ['gate', 'first', '--cancel', '0a1b2c3d'], 'a ticket the gate did not claim holds no slot');
  assert.deepEqual(result, { ok: false, notRun: true, said: 'js-harness gate: no turn in 90 minutes' });
});

test('localSuite reads a gate stopped before it ended as not run, and a FAIL row as red', () => {
  const place = path.join(os.tmpdir(), 'candidate');
  const stopped = gateRun({ gate: { status: null, stdout: '', stderr: '', error: new Error('spawnSync node ETIMEDOUT') } });
  assert.deepEqual(localSuite(stopped.run, place, { env: {}, say: () => {} }), { ok: false, notRun: true, said: 'the gate was stopped before it ended (spawnSync node ETIMEDOUT)' });
  const red = gateRun({ gate: { status: 1, stdout: 'FAIL  tests  1 failed\n', stderr: '' } });
  assert.deepEqual(localSuite(red.run, place, { env: {}, say: () => {} }), { ok: false, notRun: false, said: 'FAIL  tests  1 failed' });
});

test('localSuite with no session takes no ticket, and one refused says the land waits its turn', () => {
  const place = path.join(os.tmpdir(), 'candidate');
  const none = gateRun({});
  const quiet = [];
  assert.equal(localSuite(none.run, place, { env: {}, say: (line) => quiet.push(line) }).ok, true);
  assert.ok(!none.calls.some((call) => call[1] === 'first'));
  assert.deepEqual(quiet, ['No gate-first ticket for the land (no session id): it waits its turn in the gate line.']);
  const refused = gateRun({ first: { status: 1, stdout: '', stderr: 'gate first: two tickets are open: a, b' } });
  const said = [];
  assert.equal(localSuite(refused.run, place, { env: { CLAUDE_CODE_SESSION_ID: 's1' }, say: (line) => said.push(line) }).ok, true);
  assert.deepEqual(said, ['No gate-first ticket for the land (gate first: two tickets are open: a, b): it waits its turn in the gate line.']);
});

/** The land records `--land` wrote in the clone at `root` (odd/tasks/land-unattended.md, B2). */
const landsOf = (root) => {
  const file = path.join(root, '.git', 'js-harness', 'lands.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
};

/** What a land record says, without the times and the session, which no test fixes. */
const landSaid = ({ startedAt, endedAt, session, phases, ...rest }) => {
  for (const at of [startedAt, endedAt, ...phases.map((phase) => phase.startedAt)]) assert.ok(!Number.isNaN(Date.parse(at)), String(at));
  for (const { seconds } of phases) assert.ok(typeof seconds === 'number' && seconds >= 0, String(seconds));
  assert.ok(session === null || typeof session === 'string', String(session));
  return { ...rest, phases: phases.map(({ startedAt: _, seconds: __, ...phase }) => phase) };
};

test('--land writes one land record: the pull requests it looked at, each left out with its reason, its phases, GitHub Actions and what landed (odd/tasks/land-unattended.md, B2)', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const prs = [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b']), pr(3, 'feat/c', heads['feat/c']), pr(4, 'feat/d', heads['feat/d'], { isDraft: true })];
  const { code, out } = await land(root, prs);
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  const records = landsOf(root);
  assert.equal(records.length, 1);
  assert.deepEqual(landSaid(records[0]), {
    v: 1,
    main,
    considered: [1, 2, 3, 4],
    leftOut: [
      { pr: 4, reason: 'not-ready', said: 'PR 4 is a draft.', told: null },
      { pr: 3, reason: 'conflict', said: 'it conflicts with the candidate so far in a.txt.', files: ['a.txt'], told: null },
    ],
    phases: [{ phase: 'suite', ok: true }, { phase: 'actions', ok: true }, { phase: 'push', ok: true }],
    actions: { state: 'green', name: 'gate', conclusion: 'success', url: 'https://github.com/o/r/actions/runs/1' },
    candidate: landed,
    landed: [1, 2],
    removed: [],
    exit: 0,
    said: out.at(-1),
  });
});

test('a bisected land records each suite run and the pull request that turned the candidate red, with what the suite said', async () => {
  const { root, heads } = makeQueueRepo();
  const suite = (dir) => (fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b') ? { ok: false, said: 'FAIL  tests  1 failed' } : { ok: true });
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite });
  assert.equal(code, 0, out.join('\n'));
  const [record] = landsOf(root).map(landSaid);
  assert.deepEqual(record.leftOut, [{ pr: 2, reason: 'red', said: 'FAIL  tests  1 failed', told: null }]);
  assert.deepEqual(record.phases, [{ phase: 'suite', ok: false }, { phase: 'actions', ok: null }, { phase: 'suite', ok: true }, { phase: 'suite', ok: true }, { phase: 'actions', ok: true }, { phase: 'push', ok: true }]);
  assert.deepEqual(record.landed, [1]);
});

test('a land whose suite did not run records exit 5, a suite and a GitHub Actions phase that are neither green nor red, a dropped GitHub Actions run, and nothing landed', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { suite: () => ({ ok: false, notRun: true, said: 'gate: nothing ran' }) });
  assert.equal(code, 5, out.join('\n'));
  const [record] = landsOf(root).map(landSaid);
  assert.deepEqual([record.exit, record.phases, record.landed, record.actions, record.said], [5, [{ phase: 'suite', ok: null }, { phase: 'actions', ok: null }], [], { state: 'dropped', name: null, conclusion: null, url: null }, out.at(-1)]);
});

test('--dry-run writes no land record, and a land whose record cannot be written keeps its exit and says so', async () => {
  const { root, heads } = makeQueueRepo();
  assert.equal((await dryRun(root, [pr(1, 'feat/a', heads['feat/a'])])).code, 0);
  assert.deepEqual(landsOf(root), []);
  fs.mkdirSync(path.join(root, '.git', 'js-harness', 'lands.jsonl'), { recursive: true });
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.match(out.at(-1), /^Could not write the land record to .*lands\.jsonl \(.+\): the land's exit stands\.$/);
});

test('a land of one pull request red on this machine records it as left out red, with what the suite said (Codex, 2026-10-17)', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { suite: () => ({ ok: false, said: 'npm run test exited 1' }) });
  assert.equal(code, 4, out.join('\n'));
  const [record] = landsOf(root).map(landSaid);
  assert.deepEqual([record.exit, record.leftOut, record.landed], [4, [{ pr: 1, reason: 'red', said: 'npm run test exited 1', told: null }], []]);
});

test('--land starts its GitHub Actions run with the local suite: the queue branch of the candidate is on origin while the suite runs (odd/tasks/land-unattended.md, D)', async () => {
  const { root, origin, heads } = makeQueueRepo();
  const during = [];
  const suite = (dir) => {
    during.push(queueBranches(origin).map((name) => git(origin, 'rev-parse', name)));
    return { ok: true, candidate: git(dir, 'rev-parse', 'HEAD') };
  };
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { suite });
  assert.equal(code, 0, out.join('\n'));
  const landed = git(origin, 'rev-parse', 'main');
  assert.deepEqual(during, [[landed]], 'one queue branch, the candidate, pushed before the suite ran');
  assert.deepEqual(queueBranches(origin), [], 'and removed after GitHub Actions answered');
  const [record] = landsOf(root);
  const at = (name) => Date.parse(record.phases.find((phase) => phase.phase === name).startedAt);
  assert.ok(at('actions') <= at('suite'), 'the GitHub Actions phase starts no later than the suite phase');
});

test('a land red on this machine removes its queue branch before it bisects, and the shorter candidate gets its own (odd/tasks/land-unattended.md, D)', async () => {
  const { root, origin, heads } = makeQueueRepo();
  const during = [];
  const suite = (dir) => {
    during.push(queueBranches(origin).length);
    return fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b') ? { ok: false, said: 'FAIL  tests' } : { ok: true };
  };
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite });
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(during, [1, 0, 1], 'the red candidate\'s branch goes as it turns red: none while its half is tested, one for the candidate without PR 2');
  assert.deepEqual(queueBranches(origin), []);
});

test('a land whose suite did not run and whose queue branch origin keeps names that branch before its exit line, which stays the last (odd/tasks/land-unattended.md, D)', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], {
    suite: () => ({ ok: false, notRun: true, said: 'gate: nothing ran' }),
    wrap: failingGit((args) => args.includes('--delete'), refused),
  });
  assert.equal(code, 5, out.join('\n'));
  assert.match(out.at(-2), /^Could not remove queue\/\S+ from origin \(fatal: refused by the test\): remove it by hand\.$/);
  assert.equal(out.at(-1), 'The suite did not run on this machine (gate: nothing ran): main was not pushed, and nothing was bisected.');
  const [record] = landsOf(root);
  assert.equal(record.said, out.at(-1), 'the record keeps the exit line, not the cleanup');
});

// A(b) (odd/tasks/land-unattended.md, Design 6): the session of a pull request a land leaves out is told why.
const harnessHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-home-'));
const slugOf = (root) => projectSlug(mainCheckout((command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8' }), root));
const readyFrom = (title, pr, at = '2026-10-17T01:00:00.000Z') =>
  newNotice({ at, from: { host: 'pc', id: 'abc', source: 'transcript', title }, to: 'orchestrator', kind: 'ready', text: `PR ${pr} ready to land`, pr });
const toldNotes = (home, slug) => readNotices(home, slug).notices.filter((notice) => notice.from?.source === 'merge-queue');

test('failingTests names the failing tests of the last gate that ended at a folder, from the gate log, and none for another folder', () => {
  const home = harnessHome();
  const place = path.join(os.tmpdir(), 'merge-queue-1-2');
  const gate = (id, cwd, failing, at) => {
    appendGateEvent(home, { v: 1, event: 'start', id, at, cwd, command: 'check', pid: 1, lock: 'parent', waitedSeconds: 0, waitedFor: [] });
    appendGateEvent(home, { v: 1, event: 'end', id, at, seconds: 1, result: failing.length ? 'fail' : 'pass', sensors: [{ name: 'tests', seconds: 1, pass: !failing.length, timedOut: false, ...(failing.length && { failing }) }] });
  };
  gate('a', place, ['an old red'], '2026-10-17T01:00:00.000Z');
  gate('b', place, ['the land turns red', 'and so does this'], '2026-10-17T01:05:00.000Z');
  gate('c', path.join(os.tmpdir(), 'another'), ['not this land'], '2026-10-17T01:06:00.000Z');
  assert.deepEqual(failingTests(home, place), ['the land turns red', 'and so does this']);
  assert.deepEqual(failingTests(home, path.join(os.tmpdir(), 'none')), []);
  assert.deepEqual(failingTests(harnessHome(), place), [], 'no gate log: no names');
});

test('failingTests reads only the gates that began since the run it is asked about: an older red at the same folder is not this run\'s (Codex, 2026-10-17)', () => {
  const home = harnessHome();
  const place = path.join(os.tmpdir(), 'merge-queue-3-4');
  const gate = (id, failing, at, sensors = [{ name: 'tests', seconds: 1, pass: !failing.length, timedOut: false, ...(failing.length && { failing }) }]) => {
    appendGateEvent(home, { v: 1, event: 'start', id, at, cwd: place, command: 'check', pid: 1, lock: 'parent', waitedSeconds: 0, waitedFor: [] });
    appendGateEvent(home, { v: 1, event: 'end', id, at, seconds: 1, result: 'fail', sensors });
  };
  gate('old', ['a red of an earlier run'], '2026-10-17T01:00:00.000Z');
  gate('new', [], '2026-10-17T01:10:00.000Z', [{ name: 'rules', seconds: 1, pass: false, timedOut: false }]);
  const since = Date.parse('2026-10-17T01:05:00.000Z');
  assert.deepEqual(failingTests(home, place, since), [], 'this run failed on a sensor with no test names');
  assert.deepEqual(failingTests(home, place), ['a red of an earlier run'], 'with no bound, the last gate that named any');
});

test('tellLeftOut tells the session whose ready notice names a left-out pull request why, once a ready notice, and nobody for a pull request no work session named', () => {
  const home = harnessHome();
  const slug = 'project';
  appendNotice(home, slug, readyFrom('JH 7 · the feature', 2));
  appendNotice(home, slug, readyFrom('JH ORQ · js-harness', 3));
  const record = {
    leftOut: [
      { pr: 2, reason: 'red', said: 'FAIL  tests', failing: ['the one test'] },
      { pr: 3, reason: 'conflict', said: 'it conflicts with the candidate so far in a.txt.', files: ['a.txt'] },
      { pr: 4, reason: 'not-ready', said: 'PR 4 is a draft.' },
    ],
  };
  const lines = [];
  const now = () => Date.parse('2026-10-17T02:00:00.000Z');
  tellLeftOut({ record, home, slug, now, stdout: (line) => lines.push(line) });
  const notes = toldNotes(home, slug);
  assert.equal(notes.length, 1, 'only PR 2 has a work session that said it was ready');
  assert.deepEqual([notes[0].kind, notes[0].to], ['note', { role: 'work', number: 7 }]);
  assert.equal(notes[0].text, 'PR 2 was left out of a land (red): FAIL  tests. Failing tests: the one test.');
  assert.deepEqual(record.leftOut.map((out) => out.told), [7, null, null]);
  assert.deepEqual(lines, ['Told JH 7 · the feature why PR 2 was left out.']);
  tellLeftOut({ record, home, slug, now, stdout: () => {} });
  assert.equal(toldNotes(home, slug).length, 1, 'the same reason is not told twice for one ready notice');
  appendNotice(home, slug, readyFrom('JH 7 · the feature', 2, '2026-10-17T03:00:00.000Z'));
  tellLeftOut({ record, home, slug, now: () => Date.parse('2026-10-17T04:00:00.000Z'), stdout: () => {} });
  assert.equal(toldNotes(home, slug).length, 2, 'a newer ready notice is told again');
});

test('a told reason that does not fit a notice is cut to its length, and a record that cannot be read tells nobody and says so', () => {
  const home = harnessHome();
  const slug = 'project';
  appendNotice(home, slug, readyFrom('JH 7 · the feature', 2));
  const record = { leftOut: [{ pr: 2, reason: 'red', said: 'FAIL  tests', failing: Array.from({ length: 60 }, (_, index) => `test number ${index} of the suite`) }] };
  tellLeftOut({ record, home, slug, now: Date.now, stdout: () => {} });
  const [note] = toldNotes(home, slug);
  assert.equal(note.text.length, NOTICE_TEXT_MAX);
  assert.ok(note.text.endsWith('…'), note.text.slice(-20));
  const lines = [];
  const unreadable = { leftOut: [{ pr: 2, reason: 'merge', said: 'it does not merge.' }] };
  tellLeftOut({ record: unreadable, home, slug, now: Date.now, stdout: (line) => lines.push(line), readFile: () => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }); } });
  assert.match(lines.join('\n'), /^Could not read the channel's record .+ \(EBUSY\): no session was told why its pull request was left out\.$/);
  assert.deepEqual(unreadable.leftOut.map((out) => out.told), [null]);
});

test('a land tells the session of the pull request it finds red the failing tests, and records them and who was told (odd/tasks/land-unattended.md, A(b))', async () => {
  const { root, heads } = makeQueueRepo();
  const home = harnessHome();
  appendNotice(home, slugOf(root), readyFrom('JH 9 · feature b', 2));
  const suite = (dir) => (fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b') ? { ok: false, said: 'FAIL  tests', failing: ['b breaks it'] } : { ok: true });
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite, env: { JS_HARNESS_HOME: home } });
  assert.equal(code, 0, out.join('\n'));
  const [record] = landsOf(root);
  assert.deepEqual(record.leftOut, [{ pr: 2, reason: 'red', said: 'FAIL  tests', failing: ['b breaks it'], told: 9 }]);
  assert.deepEqual(toldNotes(home, slugOf(root)).map((note) => [note.to.number, note.text]), [[9, 'PR 2 was left out of a land (red): FAIL  tests. Failing tests: b breaks it.']]);
  assert.equal(record.said, `Landed: main ${record.main.slice(0, 7)} is now ${record.candidate.slice(0, 7)}, with PR 1.`, 'the record keeps the land\'s own last line');
});

test('a bisected red keeps what the shortest red candidate said and failed, not the whole candidate\'s (Codex, 2026-10-17)', async () => {
  const { root, heads } = makeQueueRepo();
  const suite = (dir) => {
    const a = fs.readFileSync(path.join(dir, 'a.txt'), 'utf8').includes('A from a');
    const b = fs.readFileSync(path.join(dir, 'b.txt'), 'utf8').includes('B from b');
    if (a && b) return { ok: false, said: 'FAIL  tests  2 failed', failing: ['a breaks it', 'b is only noise'] };
    if (a) return { ok: false, said: 'FAIL  tests  1 failed', failing: ['a breaks it'] };
    return { ok: true };
  };
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { suite });
  assert.equal(code, 0, out.join('\n'));
  const [record] = landsOf(root);
  assert.deepEqual(record.leftOut, [{ pr: 1, reason: 'red', said: 'FAIL  tests  1 failed', failing: ['a breaks it'], told: null }]);
  assert.ok(out.includes('PR 1 is left out: the candidate turns red on this machine when it is merged (FAIL  tests  1 failed).'), out.join('\n'));
});

// T7 (odd/tasks/land-unattended.md, L17): a land run from a merge-queue that is not origin/main's would run code
// main no longer has, as the lead's lands did from a stale checkout.
/** A queue repository whose origin/main holds the bin/ files `files` names, and a folder of its own that is the running copy's bin/:
 * `{ root, origin, dir, self }`, with self the merge-queue.mjs in it. The copy is written by `writeCopy`. */
function guardedBinRepo(files) {
  const made = makeQueueRepo();
  const { root } = made;
  git(root, 'checkout', '--quiet', '--detach', 'origin/main');
  writeCopy(path.join(root, 'bin'), files);
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'the queue and its modules on main');
  git(root, 'push', '--quiet', 'origin', 'HEAD:main');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-merge-queue-self-'));
  return { ...made, dir, self: path.join(dir, 'merge-queue.mjs') };
}
function writeCopy(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text, 'utf8');
  }
}
const guardedRepo = (mainText) => guardedBinRepo({ 'merge-queue.mjs': mainText });

test('--land stops before it builds anything when the merge-queue it runs from is not origin/main\'s (odd/tasks/land-unattended.md, T7)', async () => {
  const { root, origin, self } = guardedRepo('export const queue = 2;\n');
  fs.writeFileSync(self, 'export const queue = 1;\n', 'utf8');
  const main = git(origin, 'rev-parse', 'main');
  const { run, calls } = landRunner([pr(1, 'feat/a', git(origin, 'rev-parse', 'feat/a'))], [[workflowRun('completed', 'success')]]);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, self, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 1, out.join('\n'));
  assert.equal(out.at(-1), `merge-queue: ${self} is not origin/main's bin/ (differs: bin/merge-queue.mjs): a land run from it would run code main no longer has. Land from a checkout at origin/main.`);
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!calls.some((line) => line.startsWith('git push')), calls.join('\n'));
});

test('the land guard reads a merge-queue with Windows line ends as origin/main\'s, and lands', async () => {
  const { root, origin, self } = guardedRepo('export const queue = 2;\n');
  fs.writeFileSync(self, 'export const queue = 2;\r\n', 'utf8');
  const { run } = landRunner([pr(1, 'feat/a', git(origin, 'rev-parse', 'feat/a'))], [[workflowRun('completed', 'success')]]);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, self, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 0, out.join('\n'));
});

// C-b-5 (odd/tasks/launch-audit/triage.md): every bin/ file the running copy holds is compared, not only the merge-queue,
// because a stale check.mjs or lib module lands as readily as a stale queue, and an installed copy has no checkout to ask.
const MODULES = { 'merge-queue.mjs': 'export const queue = 2;\n', 'check.mjs': 'export const check = 2;\n', 'gate.mjs': 'export const gate = 2;\n', 'lib/refresh-copy.mjs': 'export const copy = 2;\n', 'lib/worktrees.mjs': 'export const trees = 2;\n' };

test('the land guard passes when every bin/ file the running copy holds is origin/main\'s, subfolders and Windows line ends aside (C-b-5)', async () => {
  const { root, origin, self, dir } = guardedBinRepo(MODULES);
  writeCopy(dir, { ...MODULES, 'lib/refresh-copy.mjs': MODULES['lib/refresh-copy.mjs'].replace('\n', '\r\n') });
  const { run } = landRunner([pr(1, 'feat/a', git(origin, 'rev-parse', 'feat/a'))], [[workflowRun('completed', 'success')]]);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, self, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 0, out.join('\n'));
});

test('the land guard refuses a stale bin/ module the running copy holds, names the differing paths (a few, then a count), and pushes nothing (C-b-5)', async () => {
  const { root, origin, self, dir } = guardedBinRepo(MODULES);
  const stale = Object.fromEntries(Object.keys(MODULES).map((name) => [name, `export const old = 1; // ${name}\n`]));
  writeCopy(dir, { ...stale, 'merge-queue.mjs': MODULES['merge-queue.mjs'] });
  const main = git(origin, 'rev-parse', 'main');
  const { run, calls } = landRunner([pr(1, 'feat/a', git(origin, 'rev-parse', 'feat/a'))], [[workflowRun('completed', 'success')]]);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, self, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 1, out.join('\n'));
  assert.equal(out.at(-1), `merge-queue: ${self} is not origin/main's bin/ (differs: bin/check.mjs, bin/gate.mjs, bin/lib/refresh-copy.mjs and 1 more): a land run from it would run code main no longer has. Land from a checkout at origin/main.`);
  assert.equal(git(origin, 'rev-parse', 'main'), main);
  assert.ok(!calls.some((line) => line.startsWith('git push')), calls.join('\n'));
});

test('the land guard refuses a bin/ file origin/main holds that the running copy lacks, and one the copy holds that main does not (C-b-5)', async () => {
  const { root, origin, self, dir } = guardedBinRepo({ ...MODULES, 'lib/new.mjs': 'export const added = 1;\n' });
  writeCopy(dir, { 'merge-queue.mjs': MODULES['merge-queue.mjs'], 'check.mjs': MODULES['check.mjs'], 'gate.mjs': MODULES['gate.mjs'], 'lib/refresh-copy.mjs': MODULES['lib/refresh-copy.mjs'], 'lib/worktrees.mjs': MODULES['lib/worktrees.mjs'], 'removed.mjs': 'export const gone = 1;\n' });
  const { run } = landRunner([pr(1, 'feat/a', git(origin, 'rev-parse', 'feat/a'))], [[workflowRun('completed', 'success')]]);
  const out = [];
  const code = await mergeQueueMain(['--land', '--cwd', root], { run, self, covered: () => ({ pass: true }), suite: () => ({ ok: true }), sleep: async () => {}, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 1, out.join('\n'));
  assert.ok(out.at(-1).includes('(differs: bin/lib/new.mjs, bin/removed.mjs)'), out.join('\n'));
});

// The fast path of the guard (C-b-5, rework): one `git ls-tree` gives each bin/ path's blob id, and a copy file whose id matches
// is the same file with no more git call. A git call is counted through the seam `staleBin` is given.
const countedGit = (root, calls) => (...args) => {
  calls.push(args);
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { ok: result.status === 0, out: String(result.stdout ?? '') };
};

test('the land guard makes one git call when every bin/ file the running copy holds is origin/main\'s (C-b-5, fast path)', () => {
  const { root, self, dir } = guardedBinRepo(MODULES);
  writeCopy(dir, MODULES);
  const calls = [];
  assert.deepEqual(staleBin(self, 'HEAD', countedGit(root, calls)), []);
  assert.equal(calls.length, 1, JSON.stringify(calls));
});

test('the land guard judges a file stored with CRLF in origin/main by its content, so an LF copy of it passes (C-b-5, fast path)', () => {
  const stored = { ...MODULES, 'lib/refresh-copy.mjs': MODULES['lib/refresh-copy.mjs'].replace('\n', '\r\n') };
  const { root, self, dir } = guardedBinRepo(stored);
  writeCopy(dir, MODULES);
  const calls = [];
  assert.deepEqual(staleBin(self, 'HEAD', countedGit(root, calls)), []);
  assert.equal(calls.length, 2, `ls-tree and one show of the CRLF blob: ${JSON.stringify(calls)}`);
});

// Blocker 1 (Codex P1, the Opus verifier): an installed copy holds what package.json `files` ships, and `files` leaves the tests out,
// so a bin/ path main holds and the copy lacks is stale only when the package ships it.
test('the paths the guard leaves out of a copy are the ones package.json `files` negates under bin/: UNSHIPPED_GLOBS and its !bin/**/ entries agree', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.files.includes('bin/'), 'package.json ships bin/');
  const negated = pkg.files.filter((entry) => entry.startsWith('!bin/**/')).map((entry) => entry.slice('!bin/**/'.length));
  assert.deepEqual([...queue.UNSHIPPED_GLOBS].sort(), negated.sort());
});

test('the land guard does not call stale a test file of main that a copy lacks, since package.json `files` leaves tests out (blocker 1)', () => {
  const { self, dir, root } = guardedBinRepo({ ...MODULES, 'x.test.mjs': 'export const t = 1;\n', 'x.testkit.mjs': 'export const k = 1;\n' });
  writeCopy(dir, MODULES);
  assert.deepEqual(staleBin(self, 'HEAD', countedGit(root, [])), []);
});

test('the land guard still calls stale a shipped bin/ file of main that a copy lacks (blocker 1)', () => {
  const { self, dir, root } = guardedBinRepo({ ...MODULES, 'y.mjs': 'export const y = 1;\n' });
  writeCopy(dir, MODULES);
  assert.deepEqual(staleBin(self, 'HEAD', countedGit(root, [])), ['bin/y.mjs']);
});

// After a land, the worktree of each landed pull request goes when nothing in it can be lost (odd/tasks/land-unattended.md,
// T9): 151 of 184 worktrees were on branches already in main, and the board took 126 s over them (L22).
const worktree = (root, dir, branch) => {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(root, 'worktree', 'add', '--quiet', dir, branch);
  return dir;
};
/** Puts the index of the worktree `dir` 20 minutes back, past the minutes a removal waits for. */
const idle = (dir) => {
  const back = (Date.now() - 20 * 60_000) / 1000;
  fs.utimesSync(path.resolve(dir, git(dir, 'rev-parse', '--git-path', 'index')), back, back);
  return dir;
};
const removedOf = (root) => landsOf(root).at(-1).removed.map((entry) => [entry.pr, path.basename(entry.path)]);

test('a land removes the worktree of a landed pull request that is clean and idle, keeps its branch and names it in its record; a dirty one stays', async () => {
  const { root, heads } = makeQueueRepo();
  const top = path.dirname(root);
  const clean = idle(worktree(root, path.join(top, 'wt-a'), 'feat/a'));
  const dirty = idle(worktree(root, path.join(top, 'wt-b'), 'feat/b'));
  fs.writeFileSync(path.join(dirty, 'notes.txt'), 'not committed\n');
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(clean), false, out.join('\n'));
  assert.equal(fs.existsSync(path.join(dirty, 'notes.txt')), true);
  assert.equal(git(root, 'rev-parse', 'feat/a'), heads['feat/a'], 'the branch of a removed worktree stays');
  assert.deepEqual(removedOf(root), [[1, 'wt-a']]);
  assert.ok(out.some((line) => line.startsWith('Removed the worktree of PR 1 at ')), out.join('\n'));
  assert.match(landsOf(root).at(-1).said, /^Landed: /);
});

test('a land keeps a landed worktree under .claude/worktrees, the app\'s, and the worktree it runs from', async () => {
  const { root, heads } = makeQueueRepo();
  const top = path.dirname(root);
  const apps = idle(worktree(root, path.join(top, '.claude', 'worktrees', 'a'), 'feat/a'));
  const from = idle(worktree(root, path.join(top, 'wt-b'), 'feat/b'));
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])], { cwd: from });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(apps), true);
  assert.equal(fs.existsSync(from), true);
  assert.deepEqual(removedOf(root), []);
});

test('a land keeps a landed worktree with a commit beyond main, and one whose index changed in the last minutes', async () => {
  const { root, heads } = makeQueueRepo();
  const top = path.dirname(root);
  const beyond = worktree(root, path.join(top, 'wt-a'), 'feat/a');
  fs.writeFileSync(path.join(beyond, 'later.txt'), 'later\n');
  git(beyond, 'add', 'later.txt');
  git(beyond, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '--quiet', '-m', 'later');
  idle(beyond);
  const fresh = worktree(root, path.join(top, 'wt-b'), 'feat/b');
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(beyond), true);
  assert.equal(fs.existsSync(fresh), true);
  assert.deepEqual(removedOf(root), []);
});

test('a removal git refuses is said, and the land still exits 0', async () => {
  const { root, heads } = makeQueueRepo();
  const kept = idle(worktree(root, path.join(path.dirname(root), 'wt-a'), 'feat/a'));
  // Only its removal: the land's own worktrees are removed by the same verb.
  const wrap = failingGit((args) => args[0] === 'worktree' && args[1] === 'remove' && path.basename(args.at(-1)) === 'wt-a', refused);
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], { wrap });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(kept), true);
  assert.ok(out.some((line) => line.startsWith('Could not remove the worktree of PR 1 at ') && line.includes('refused by the test')), out.join('\n'));
  assert.deepEqual(removedOf(root), []);
});

// `git worktree remove` takes a worktree's ignored files with it, and `git status` does not show them: an eval run kept
// under `evals/runs/` would be lost with no branch to bring it back (Codex, 2026-10-17, P1).
test('a land keeps a landed worktree that holds an ignored file', async () => {
  const { root, heads } = makeQueueRepo();
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), '*.log\n');
  const top = path.dirname(root);
  const holds = idle(worktree(root, path.join(top, 'wt-a'), 'feat/a'));
  fs.writeFileSync(path.join(holds, 'run.log'), 'a result no commit holds\n');
  const clean = idle(worktree(root, path.join(top, 'wt-b'), 'feat/b'));
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a']), pr(2, 'feat/b', heads['feat/b'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.readFileSync(path.join(holds, 'run.log'), 'utf8'), 'a result no commit holds\n');
  assert.equal(fs.existsSync(clean), false, out.join('\n'));
  assert.deepEqual(removedOf(root), [[2, 'wt-b']]);
});

// The worktrees landed by other means than a land (odd/tasks/land-unattended.md, T10): `--prune` removes, by the rule
// a land uses, every one whose branch origin/main already holds.
test('--prune removes every clean, idle worktree on a branch origin/main holds, keeps the others and writes no land record', async () => {
  const { root, origin, heads } = makeQueueRepo();
  git(root, 'push', '--quiet', 'origin', 'feat/a:main');
  const top = path.dirname(root);
  const inMain = idle(worktree(root, path.join(top, 'wt-a'), 'feat/a'));
  const notInMain = idle(worktree(root, path.join(top, 'wt-b'), 'feat/b'));
  const { run, calls } = runner([]);
  const out = [];
  const code = await mergeQueueMain(['--prune', '--cwd', root], { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(inMain), false, out.join('\n'));
  assert.equal(fs.existsSync(notInMain), true);
  assert.equal(git(root, 'rev-parse', 'feat/a'), heads['feat/a'], 'the branch stays');
  assert.equal(git(origin, 'rev-parse', 'main'), heads['feat/a'], 'main is not moved');
  assert.ok(out.some((line) => line.startsWith('Removed the worktree at ') && line.includes('feat/a')), out.join('\n'));
  assert.equal(out.at(-1), '1 worktree removed.');
  assert.deepEqual(landsOf(root), []);
  assert.equal(calls.some((call) => call.startsWith('gh ')), false, 'no pull request is asked about');
});

test('--prune is a mode of its own: with --land or --dry-run it is a usage error', async () => {
  for (const argv of [['--prune', '--land'], ['--prune', '--dry-run']]) {
    const out = [];
    const code = await mergeQueueMain(argv, { stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
    assert.equal(code, 2, argv.join(' '));
  }
});

// The Orca app's worktrees are its own, as `.claude/worktrees` are the Claude app's (odd/tasks/land-unattended.md, T11).
test('a land keeps a landed worktree of the Orca app, under orca/workspaces', async () => {
  const { root, heads } = makeQueueRepo();
  const orcas = idle(worktree(root, path.join(path.dirname(root), 'orca', 'workspaces', 'js-harness', 'copepod'), 'feat/a'));
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(fs.existsSync(orcas), true, out.join('\n'));
  assert.deepEqual(removedOf(root), []);
});

// T4 (S5b): `--land --refresh-copy` refreshes the installed copy after a land that moved main, through `refreshCopy`
// (bin/lib/refresh-copy.mjs), which is passed here as a stand-in so no package manager runs.
async function landRefreshing(root, prs, { refresh = () => 0, args = ['--land', '--refresh-copy'] } = {}) {
  const { run } = landRunner(prs, [[workflowRun('completed', 'success')]]);
  const out = [];
  const asked = [];
  const code = await mergeQueueMain([...args, '--cwd', root], {
    run,
    covered: () => ({ pass: true }),
    suite: () => ({ ok: true }),
    sleep: async () => {},
    stdout: (line) => out.push(line),
    stderr: (line) => out.push(line),
    refreshCopy: async (opts) => {
      asked.push(opts);
      return refresh(opts);
    },
  });
  return { code, out, asked };
}

test('--refresh-copy is a mode of --land: alone or with --dry-run it is a usage error, and the usage names it', async () => {
  const out = [];
  const io = { run: runner([]).run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) };
  assert.equal(await mergeQueueMain(['--refresh-copy'], io), 2);
  assert.equal(await mergeQueueMain(['--dry-run', '--refresh-copy'], io), 2);
  const usage = [];
  assert.equal(await mergeQueueMain(['--help'], { stdout: (line) => usage.push(line) }), 0);
  assert.match(usage.join('\n'), /\[--refresh-copy\]/);
});

test('--land --refresh-copy asks for the refresh after a land, with the sha main was pushed to, and the land stands', async () => {
  const { root, origin, heads } = makeQueueRepo();
  const { code, out, asked } = await landRefreshing(root, [pr(1, 'feat/a', heads['feat/a'])]);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(asked.length, 1);
  assert.equal(asked[0].landed, true);
  assert.equal(asked[0].sha, git(origin, 'rev-parse', 'main'));
});

test('--land --refresh-copy exits with the refresh code when the refresh fails, after the land printed its landing', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await landRefreshing(root, [pr(1, 'feat/a', heads['feat/a'])], { refresh: () => 6 });
  assert.equal(code, 6, out.join('\n'));
  assert.ok(out.some((line) => line.startsWith('Landed: main ')), 'the land printed its landing');
});

// gentle-ai review-fb9f66ace187f6fe, R4-refresh-uncaught-skips-land-record: a refresh that threw ended the run before
// the land record was written, though main had moved.
test('--land --refresh-copy whose refresh throws still records the land with its own exit, and exits 6', async () => {
  const { root, heads } = makeQueueRepo();
  const { code, out } = await landRefreshing(root, [pr(1, 'feat/a', heads['feat/a'])], { refresh: () => { throw new Error('boom'); } });
  assert.equal(code, 6, out.join('\n'));
  assert.ok(out.some((line) => /refresh failed: .*boom/.test(line)), out.join('\n'));
  const record = fs.readFileSync(path.join(root, '.git', 'js-harness', 'lands.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line)).at(-1);
  assert.equal(record.exit, 0);
});

test('--land --refresh-copy with nothing ready asks the refresh that nothing landed, so it refreshes nothing', async () => {
  const { root } = makeQueueRepo();
  const { code, out, asked } = await landRefreshing(root, []);
  assert.equal(code, 0, out.join('\n'));
  assert.equal(asked.length, 1);
  assert.equal(asked[0].landed, false);
});

test('--land without --refresh-copy behaves as before: no refresh is asked for, no package manager runs, the last line is the landing', async () => {
  const { root, origin, main, heads } = makeQueueRepo();
  const spawned = [];
  const { code, out } = await land(root, [pr(1, 'feat/a', heads['feat/a'])], {
    wrap: (run) => (command, args, options) => {
      if (command !== 'git' && command !== 'gh') spawned.push(command);
      return run(command, args, options);
    },
  });
  assert.equal(code, 0, out.join('\n'));
  assert.deepEqual(spawned, []);
  assert.equal(out.at(-1), `Landed: main ${main.slice(0, 7)} is now ${git(origin, 'rev-parse', 'main').slice(0, 7)}, with PR 1.`);
});
