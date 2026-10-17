// The gate of a commit on GitHub's machines (./ci-gate.mjs): when it is wanted, and the run itself against a real
// git repository and a bare remote on disk, with `gh` and the clock stood in for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CI_GATE_ENV, ciGateWanted, runCiGate } from './ci-gate.mjs';
import { ruleValue } from './rules.mjs';

// A gate runs inside a git hook, which sets GIT_DIR and GIT_INDEX_FILE for the repository being committed.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

function git(cwd, ...args) {
  const run = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', env: cleanEnv });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/** A project with one commit and the gate's workflow, a bare remote it pushes to, and a change staged on top. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-'));
  const remote = path.join(root, 'remote.git');
  const cwd = path.join(root, 'work');
  git(root, 'init', '-q', '--bare', remote);
  fs.mkdirSync(path.join(cwd, '.github', 'workflows'), { recursive: true });
  git(cwd, 'init', '-q');
  fs.writeFileSync(path.join(cwd, '.github', 'workflows', 'gate.yml'), 'name: gate\n');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'one\n');
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'first');
  // A GitHub URL, as a real remote is, that git rewrites to the bare remote on disk.
  git(cwd, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
  git(cwd, 'config', `url.${remote}.insteadOf`, 'https://github.com/o/r.git');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'staged\n');
  git(cwd, 'add', 'a.txt');
  // Not staged: the commit being made does not hold it, so neither does its gate.
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'not staged\n');
  return { root, cwd, remote, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** A clock that moves only when the code sleeps. */
function clock() {
  let at = 1_000_000;
  return { now: () => at, sleep: async (ms) => { at += ms; } };
}

/** A stand-in for `gh`: `runs` is what each `run list` of a commit answers, in turn (the last one again once
 * spent), `views` what each `run view` answers (`null` for a view that fails), and a `run list` of no commit, the
 * probe before the push, answers `[]`. Every call is kept. */
function fakeGh({ runs = [[]], views = [], log = '' } = {}) {
  const calls = [];
  let listed = 0;
  let viewed = 0;
  const cwds = [];
  const gh = (args, { cwd } = {}) => {
    calls.push(args);
    cwds.push(cwd);
    if (args[0] === 'run' && args[1] === 'list' && !args.includes('--commit')) return { status: 0, stdout: '[]', stderr: '' };
    if (args[0] === 'run' && args[1] === 'list') return { status: 0, stdout: JSON.stringify(runs[Math.min(listed++, runs.length - 1)]), stderr: '' };
    if (args[0] === 'run' && args[1] === 'view' && args.includes('--log-failed')) return { status: 0, stdout: log, stderr: '' };
    if (args[0] === 'run' && args[1] === 'view') {
      const view = views[Math.min(viewed++, views.length - 1)];
      return view === null ? { status: 1, stdout: '', stderr: 'HTTP 502: Bad Gateway' } : { status: 0, stdout: JSON.stringify(view), stderr: '' };
    }
    if (args[0] === 'run' && args[1] === 'cancel') return { status: 0, stdout: '', stderr: '' };
    return { status: 1, stdout: '', stderr: `unexpected gh ${args.join(' ')}` };
  };
  gh.calls = calls;
  gh.cwds = cwds;
  return gh;
}

const RUN = { databaseId: 42, status: 'queued', conclusion: '', url: 'https://github.com/o/r/actions/runs/42' };
const remoteBranches = (remote) => git(remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/');
// The commit object of a gate is made with the identity of the machine, which a CI runner has none of.
const identity = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const options = (p, gh, c, more = {}) => ({ cwd: p.cwd, env: { ...cleanEnv, ...identity }, gh, ...c, ...more });

test('a commit\'s gate goes to CI first whenever the project has the workflow and nothing switches it off, whatever the lock says', () => {
  const p = project();
  try {
    const first = /^the project holds \.github\/workflows\/gate\.yml, so a commit's tests go to GitHub's machines first$/;
    // git hands every hook that commits the index it commits; a check by hand is given none.
    const hook = { GIT_INDEX_FILE: '.git/index' };
    assert.match(ciGateWanted({ cwd: p.cwd, env: hook }), first, 'a free lock no longer keeps the gate here');
    assert.match(ciGateWanted({ cwd: p.cwd, env: { git_index_file: 'x' } }), first, 'Windows names variables in any case');
    assert.equal(ciGateWanted({ cwd: p.cwd, env: {} }), null, 'a check by hand tests the working tree here, not the index there');
    assert.equal(ciGateWanted({ cwd: p.cwd, env: { ...hook, [CI_GATE_ENV]: '0' } }), null, 'switched off');
    assert.equal(ciGateWanted({ cwd: p.cwd, env: { ...hook, CI: 'true' } }), null, 'already on a CI machine');
    assert.match(ciGateWanted({ cwd: p.cwd, env: { ...hook, CI: 'false' } }), first, 'CI=false is no CI machine');
    fs.rmSync(path.join(p.cwd, '.github'), { recursive: true });
    assert.equal(ciGateWanted({ cwd: p.cwd, env: hook }), null, 'a project with no gate workflow');
  } finally {
    p.done();
  }
});

test('a green run passes the gate: the staged tree went to gate/<sha>, and the branch is gone after', async () => {
  const p = project();
  try {
    const gh = fakeGh({ runs: [[], [RUN]], views: [{ ...RUN, status: 'in_progress' }, { ...RUN, status: 'completed', conclusion: 'success' }] });
    let pushed;
    const spy = (args) => { pushed ??= args.find((arg) => arg.includes(':refs/heads/gate/')); };
    const result = await runCiGate(options(p, gh, clock(), { onGit: spy }));
    assert.equal(result.ran, true, result.why);
    assert.equal(result.pass, true);
    assert.equal(result.url, RUN.url);
    const sha = pushed.split(':')[0];
    assert.equal(git(p.remote, 'show', `${sha}:a.txt`), 'staged', 'the commit being made, not the working tree');
    assert.equal(git(p.remote, 'rev-parse', `${sha}^`), git(p.cwd, 'rev-parse', 'HEAD'), 'its parent is HEAD');
    assert.deepEqual(gh.calls[0], ['run', 'list', '--repo', 'o/r', '--workflow', 'gate.yml', '--json', 'databaseId', '--limit', '1'], 'gh is asked before the push');
    assert.deepEqual(gh.calls[1], ['run', 'list', '--repo', 'o/r', '--commit', sha, '--workflow', 'gate.yml', '--json', 'databaseId,status,conclusion,url', '--limit', '1']);
    assert.ok(gh.calls.every((args) => args[2] === '--repo' && args[3] === 'o/r'), 'every gh call names the repository of the remote');
    assert.ok(gh.cwds.every((cwd) => cwd === p.cwd), 'gh runs in the project');
    assert.equal(remoteBranches(p.remote), '', 'the gate branch is deleted');
    assert.equal(git(p.cwd, 'rev-list', '--count', 'HEAD'), '1', 'no commit was made here');
  } finally {
    p.done();
  }
});

test('a red run fails the gate with the end of its failed log', async () => {
  const p = project();
  try {
    const log = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const gh = fakeGh({ runs: [[RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'failure' }], log });
    const result = await runCiGate(options(p, gh, clock()));
    assert.equal(result.ran, true);
    assert.equal(result.pass, false);
    assert.match(result.output, /line 199$/);
    assert.doesNotMatch(result.output, /line 100\n/, 'only the end of the log');
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('a red run\'s log loses gh\'s job, step and time before each line, and keeps the failing tests\' list the end would cut', async () => {
  const p = project();
  try {
    const prefix = 'gate\tRun the gate\t2026-10-17T05:00:00.0000000Z ';
    const lines = ['✖ failing tests:', '', '✖ the table reads a day (12.5ms)', ...Array.from({ length: 120 }, (_, i) => `detail ${i}`)];
    const gh = fakeGh({ runs: [[RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'failure' }], log: lines.map((line) => prefix + line).join('\n') });
    const result = await runCiGate(options(p, gh, clock()));
    assert.match(result.output, /^✖ failing tests:\n\n✖ the table reads a day \(12\.5ms\)\ndetail 0\n/);
    assert.doesNotMatch(result.output, /Run the gate/);
    // The lines the window leaves out at the end are said, with where to read them.
    assert.match(result.output, /\ndetail 76\n… 43 more lines: gh run view \d+ --log-failed$/);
  } finally {
    p.done();
  }
});

test('a run that never starts, or ends neither green nor red, is no answer: the gate runs here', async () => {
  const p = project();
  try {
    const none = await runCiGate(options(p, fakeGh(), clock()));
    assert.equal(none.ran, false);
    assert.match(none.why, /no run of \.github\/workflows\/gate\.yml started within 3 minutes/);
    assert.equal(remoteBranches(p.remote), '');
    const timedOut = await runCiGate(options(p, fakeGh({ runs: [[RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'timed_out' }] }), clock()));
    assert.equal(timedOut.ran, false, 'a job past its own timeout proves nothing of the tests');
    assert.match(timedOut.why, /ended timed_out/);
    const cancelled = await runCiGate(options(p, fakeGh({ runs: [[RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'cancelled' }] }), clock()));
    assert.equal(cancelled.ran, false);
    assert.match(cancelled.why, /ended cancelled/);
  } finally {
    p.done();
  }
});

test('a run past its bound, the rule ci-gate-bound counted from the push, is cancelled and is no answer', async () => {
  const p = project();
  try {
    const gh = fakeGh({ runs: [[RUN]], views: [{ ...RUN, status: 'in_progress' }] });
    const c = clock();
    const pushedAt = c.now();
    const result = await runCiGate(options(p, gh, c));
    const bound = ruleValue('ci-gate-bound', 'minutes');
    assert.equal(result.ran, false);
    assert.equal(result.why, `its run (${RUN.url}) was not done after ${bound} minutes, and was cancelled`);
    assert.equal(c.now() - pushedAt, bound * 60_000, 'cancelled at the bound, not a poll later or sooner');
    assert.deepEqual(gh.calls.at(-1), ['run', 'cancel', '--repo', 'o/r', '42']);
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('a remote that is not on GitHub is no answer, and nothing is pushed', async () => {
  const p = project();
  try {
    git(p.cwd, 'remote', 'set-url', 'origin', p.remote);
    const gh = fakeGh();
    const result = await runCiGate(options(p, gh, clock()));
    assert.equal(result.ran, false);
    assert.match(result.why, /^origin is not a GitHub repository/);
    assert.deepEqual(gh.calls, []);
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('the GitHub repository of a remote is read from its URL, in each form git takes', async () => {
  const { githubRepository } = await import('./ci-gate.mjs');
  assert.equal(githubRepository('https://github.com/jsaristi/js-harness.git'), 'jsaristi/js-harness');
  assert.equal(githubRepository('https://github.com/jsaristi/js-harness'), 'jsaristi/js-harness');
  assert.equal(githubRepository('git@github.com:jsaristi/js-harness.git'), 'jsaristi/js-harness');
  assert.equal(githubRepository('ssh://git@github.com/jsaristi/js-harness.git'), 'jsaristi/js-harness');
  assert.equal(githubRepository('https://gitlab.com/jsaristi/js-harness.git'), null);
  assert.equal(githubRepository('D:/repos/js-harness.git'), null);
});

test('a push that fails, or a gh that cannot list runs, is no answer', async () => {
  const p = project();
  try {
    git(p.cwd, 'config', '--unset', `url.${p.remote}.insteadOf`);
    git(p.cwd, 'config', `url.${path.join(p.root, 'nowhere.git')}.insteadOf`, 'https://github.com/o/r.git');
    const unpushed = await runCiGate(options(p, fakeGh(), clock()));
    assert.equal(unpushed.ran, false);
    assert.match(unpushed.why, /^git push to origin failed/);
    git(p.cwd, 'config', '--unset', `url.${path.join(p.root, 'nowhere.git')}.insteadOf`);
    git(p.cwd, 'config', `url.${p.remote}.insteadOf`, 'https://github.com/o/r.git');
    const noGh = () => ({ status: 1, stdout: '', stderr: 'gh: To get started with GitHub CLI, please run: gh auth login' });
    const gitCalls = [];
    const unlisted = await runCiGate(options(p, noGh, clock(), { onGit: (args) => gitCalls.push(args[0]) }));
    assert.equal(unlisted.ran, false);
    assert.equal(unlisted.why, 'gh cannot read the runs of o/r, so nothing was pushed: gh: To get started with GitHub CLI, please run: gh auth login');
    assert.deepEqual(gitCalls.filter((verb) => verb !== 'config'), [], 'a gh that cannot answer is found before any tree is written or pushed');
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('a gh that fails after the run started cancels that run, which is then no answer', async () => {
  const p = project();
  try {
    const gh = fakeGh({ runs: [[RUN]], views: [null] });
    const result = await runCiGate(options(p, gh, clock()));
    assert.equal(result.ran, false);
    assert.match(result.why, /^gh run view failed: HTTP 502: Bad Gateway$/);
    assert.deepEqual(gh.calls.at(-1), ['run', 'cancel', '--repo', 'o/r', '42'], 'the run started is not left running');
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('git asks no one for credentials during a gate: a push that would prompt fails at once', async () => {
  const { pushEnv } = await import('./ci-gate.mjs');
  assert.deepEqual(pushEnv({ PATH: 'p', GIT_TERMINAL_PROMPT: '1' }), { PATH: 'p', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' });
});
