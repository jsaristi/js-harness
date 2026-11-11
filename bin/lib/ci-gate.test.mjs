// The gate of a commit on GitHub's machines (./ci-gate.mjs): when it is wanted, and the run itself against a real
// git repository and a bare remote on disk, with `gh` and the clock stood in for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CI_GATE_ENV, ciGateWanted, remoteGateKeeps, runCiGate } from './ci-gate.mjs';
import { ruleValue } from './rules.mjs';

// A gate runs inside a git hook, which sets GIT_DIR and GIT_INDEX_FILE for the repository being committed.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

function git(cwd, ...args) {
  const run = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', env: cleanEnv });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/** A project with one commit and the gate's workflow, a bare remote it pushes to, and a change staged on top. Its
 * harness.json declares the remote gate `remoteGate` (on, as this repository does), holds `harness` as its text, or
 * is not there for `null`: a project that says nothing. With `ssh`, the remote is written `git@github.com:o/r.git`
 * and nothing rewrites it: `env` then makes git's ssh a script that serves the bare remote on disk, so a real push
 * goes through a real transport to a destination git itself calls GitHub's. */
function project({ remoteGate = 'on', harness = remoteGate === null ? null : JSON.stringify({ functions: { remoteGate } }), ssh = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-'));
  const remote = path.join(root, 'remote.git');
  const cwd = path.join(root, 'work');
  git(root, 'init', '-q', '--bare', remote);
  fs.mkdirSync(path.join(cwd, '.github', 'workflows'), { recursive: true });
  git(cwd, 'init', '-q');
  fs.writeFileSync(path.join(cwd, '.github', 'workflows', 'gate.yml'), 'name: gate\n');
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'one\n');
  if (harness !== null) fs.writeFileSync(path.join(cwd, 'harness.json'), harness);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', 'first');
  let env = {};
  if (ssh) {
    // git runs `<GIT_SSH_COMMAND> git@github.com "git-receive-pack 'o/r.git'"`: the script runs that verb on the bare
    // remote, whatever repository was named.
    const shim = path.join(root, 'ssh.mjs');
    fs.writeFileSync(shim, [
      "import { spawnSync } from 'node:child_process';",
      "const verb = process.argv.at(-1).split(' ')[0].replace(/^git-/, '');",
      "process.exit(spawnSync('git', [verb, process.env.CI_GATE_TEST_REMOTE], { stdio: 'inherit' }).status ?? 1);",
    ].join('\n'));
    git(cwd, 'remote', 'add', 'origin', 'git@github.com:o/r.git');
    env = { GIT_SSH_COMMAND: `node "${shim.replace(/\\/g, '/')}"`, GIT_SSH_VARIANT: 'simple', CI_GATE_TEST_REMOTE: remote };
  } else {
    // A GitHub URL, as a real remote is, that git rewrites to the bare remote on disk.
    git(cwd, 'remote', 'add', 'origin', 'https://github.com/o/r.git');
    git(cwd, 'config', `url.${remote}.insteadOf`, 'https://github.com/o/r.git');
  }
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'staged\n');
  git(cwd, 'add', 'a.txt');
  // Not staged: the commit being made does not hold it, so neither does its gate.
  fs.writeFileSync(path.join(cwd, 'a.txt'), 'not staged\n');
  return { root, cwd, remote, env, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** A clock that moves only when the code sleeps. */
function clock() {
  let at = 1_000_000;
  return { now: () => at, sleep: async (ms) => { at += ms; } };
}

/** A stand-in for `gh`: `runs` is what each `run list` of a commit answers, in turn (the last one again once
 * spent), `views` what each `run view` answers (`null` for a view that fails), and a `run list` of no commit, the
 * probe before the push, answers `[]`. `visibility` is what `repo view` says of the repository (`null` for a read
 * that fails), or an object of what it says of each one by its `owner/name`. Every call is kept. */
function fakeGh({ runs = [[]], views = [], log = '', visibility: said = 'PUBLIC' } = {}) {
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
    if (args[0] === 'repo' && args[1] === 'view') {
      const visibility = said !== null && typeof said === 'object' ? said[args[2].replace(/^github\.com\//, '')] : said;
      return visibility === null ? { status: 1, stdout: '', stderr: 'HTTP 401: Bad credentials' } : { status: 0, stdout: `${visibility}\n`, stderr: '' };
    }
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
const options = (p, gh, c, more = {}) => ({ cwd: p.cwd, env: { ...cleanEnv, ...identity, ...p.env }, gh, ...c, ...more });

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
    fs.writeFileSync(path.join(p.cwd, 'harness.json'), JSON.stringify({ functions: { remoteGate: 'off' } }));
    assert.equal(ciGateWanted({ cwd: p.cwd, env: hook }), null, 'the project keeps the trees of its commits here');
    fs.writeFileSync(path.join(p.cwd, 'harness.json'), JSON.stringify({ functions: { remoteGate: 'on', remotegate: 'off' } }));
    assert.equal(ciGateWanted({ cwd: p.cwd, env: hook }), null, 'a file with an error in its switches is read as off, whatever else it says');
    fs.rmSync(path.join(p.cwd, 'harness.json'));
    assert.match(ciGateWanted({ cwd: p.cwd, env: hook }), first, 'a project that says nothing is asked at the push, where its visibility is read');
    fs.writeFileSync(path.join(p.cwd, 'harness.json'), JSON.stringify({ functions: { remoteGate: 'on' } }));
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
    assert.deepEqual(git(p.remote, 'rev-list', '--parents', '-n', '1', sha).split(' ').slice(1), [git(p.cwd, 'rev-parse', 'HEAD')], 'its one parent is HEAD: no merge, no MERGE_HEAD');
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

// odd/tasks/publish-decision.md: what a commit's gate publishes is the project's written decision (the audit's M1).
// The repository is named with its host: `gh` asks the host of `GH_HOST` about a bare `owner/name`, which may be
// another GitHub than the one the push goes to.
const VISIBILITY = ['repo', 'view', 'github.com/o/r', '--json', 'visibility', '-q', '.visibility'];
const GREEN = () => ({ runs: [[RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'success' }] });
/** What git was asked beyond reading its configuration, where the remote pushes and where the working tree starts:
 * nothing, for a tree that stays. */
const written = (calls) => calls.filter((args) => args[0] !== 'config' && args[0] !== 'remote' && args.join(' ') !== 'rev-parse --show-toplevel');

test('a public repository that says nothing pushes nothing: the tree of its commit stays here', async () => {
  const p = project({ remoteGate: null, ssh: true });
  try {
    const gh = fakeGh({ ...GREEN(), visibility: 'PUBLIC' });
    const gitCalls = [];
    const result = await runCiGate(options(p, gh, clock(), { onGit: (args) => gitCalls.push(args) }));
    assert.deepEqual(result, { ran: false, why: 'o/r reads PUBLIC, not PRIVATE, and harness.json does not turn remoteGate on (js-harness functions set remoteGate on), so the tree being committed was not pushed' });
    assert.deepEqual(gh.calls, [VISIBILITY], 'the visibility is asked, and nothing after it');
    assert.deepEqual(written(gitCalls), [], 'no tree is written, no commit made, nothing pushed');
    assert.equal(remoteBranches(p.remote), '');
  } finally {
    p.done();
  }
});

test('a private repository that says nothing sends its gate to CI as before, and one that declares on is not asked its visibility', async () => {
  const p = project({ remoteGate: null, ssh: true });
  try {
    const gh = fakeGh({ ...GREEN(), visibility: 'PRIVATE' });
    let pushed;
    const result = await runCiGate(options(p, gh, clock(), { onGit: (args) => { pushed ??= args.find((arg) => arg.includes(':refs/heads/gate/')); } }));
    assert.equal(result.ran, true, result.why);
    assert.equal(result.pass, true);
    assert.deepEqual(gh.calls[0], VISIBILITY, 'asked before anything else');
    assert.equal(git(p.remote, 'show', `${pushed.split(':')[0]}:a.txt`), 'staged', 'the tree went to the remote');
    assert.equal(remoteBranches(p.remote), '', 'and its branch is gone after');
  } finally {
    p.done();
  }
  const declared = project({ remoteGate: 'on' });
  try {
    const gh = fakeGh({ ...GREEN(), visibility: 'PUBLIC' });
    const result = await runCiGate(options(declared, gh, clock()));
    assert.equal(result.ran, true, result.why);
    assert.ok(gh.calls.every((args) => args[0] === 'run'), 'a project that declares on is public by its owner\'s decision: nobody asks');
  } finally {
    declared.done();
  }
});

test('whatever does not say the repository is private keeps the tree here: a read that fails, an internal repository, a switch off or unreadable', async () => {
  const cases = [
    [{ remoteGate: null, ssh: true }, null, 'the visibility of o/r could not be read (HTTP 401: Bad credentials), so it is not known to be private and the tree being committed was not pushed', [VISIBILITY]],
    [{ remoteGate: 'private', ssh: true }, 'INTERNAL', 'o/r reads INTERNAL, not PRIVATE, and harness.json does not turn remoteGate on (js-harness functions set remoteGate on), so the tree being committed was not pushed', [VISIBILITY]],
    [{ remoteGate: 'private', ssh: true }, '', 'the visibility of o/r could not be read (gh said nothing), so it is not known to be private and the tree being committed was not pushed', [VISIBILITY]],
    [{ remoteGate: 'off' }, 'PRIVATE', 'remoteGate reads off in harness.json, so the tree being committed was not pushed', []],
    // Read as off, never as on: a switch nobody could read publishes nothing (`strict` of ./functions.mjs), and says why.
    [{ harness: '{ "functions": { "remoteGate": "yes" } }' }, 'PRIVATE', 'remoteGate reads off in harness.json (harness.json "functions"."remoteGate" must be one of "auto", "private", "on", "off"; it is "yes"), so the tree being committed was not pushed', []],
    [{ harness: '{ not json' }, 'PRIVATE', /^remoteGate reads off in harness\.json \(harness\.json is not valid JSON: .+\), so the tree being committed was not pushed$/, []],
    // A switch misspelt is an error of the file, and a file with an error declares nothing that publishes: the
    // default would have pushed this one to its private repository while the gate's `functions` row refused it.
    [{ harness: '{ "functions": { "remotegate": "off" } }', ssh: true }, 'PRIVATE', /^remoteGate reads off in harness\.json \(harness\.json "functions" holds "remotegate", which is no switch; .+\), so the tree being committed was not pushed$/, []],
    [{ harness: '{ "functions": { "remoteGate": "on", "codexreview": "on" } }' }, 'PRIVATE', /^remoteGate reads off in harness\.json \(harness\.json "functions" holds "codexreview", which is no switch; .+\), so the tree being committed was not pushed$/, []],
  ];
  for (const [declares, visibility, why, asked] of cases) {
    const p = project(declares);
    try {
      const gh = fakeGh({ ...GREEN(), visibility });
      const gitCalls = [];
      const result = await runCiGate(options(p, gh, clock(), { onGit: (args) => gitCalls.push(args) }));
      assert.equal(result.ran, false);
      if (why instanceof RegExp) assert.match(result.why, why);
      else assert.equal(result.why, why);
      assert.deepEqual(gh.calls, asked);
      assert.deepEqual(written(gitCalls), []);
      assert.equal(remoteBranches(p.remote), '');
    } finally {
      p.done();
    }
  }
});

test('remoteGateKeeps answers before any push, for the gate that asks it first: null where the tree may go, and why where it stays', () => {
  const on = project();
  const silent = project({ remoteGate: null, ssh: true });
  try {
    const asked = (p, gh) => remoteGateKeeps({ cwd: p.cwd, env: { ...cleanEnv, ...identity, ...p.env }, gh });
    const none = fakeGh();
    assert.equal(asked(on, none), null);
    assert.deepEqual(none.calls, [], 'declared on, gh is not asked');
    assert.equal(asked(silent, fakeGh({ visibility: 'PRIVATE' })), null);
    // `known` tells a decision (the project's switch and what GitHub says) from a read that failed.
    const open = asked(silent, fakeGh({ visibility: 'PUBLIC' }));
    assert.match(open.why, /^o\/r reads PUBLIC, not PRIVATE/);
    assert.equal(open.known, true);
    const unread = asked(silent, fakeGh({ visibility: null }));
    assert.match(unread.why, /^the visibility of o\/r could not be read/);
    assert.equal(unread.known, false, 'a failure of gh, not a decision of the project');
    // A remote that is not GitHub's has no visibility to read: nothing says it is private.
    git(silent.cwd, 'remote', 'set-url', 'origin', silent.remote);
    const elsewhere = fakeGh({ visibility: 'PRIVATE' });
    const local = asked(silent, elsewhere);
    assert.match(local.why, /^origin pushes to .*remote\.git, which is not a GitHub repository, so nothing says it is private and the tree being committed was not pushed$/);
    assert.equal(local.known, true);
    assert.deepEqual(elsewhere.calls, []);
    git(silent.cwd, 'remote', 'remove', 'origin');
    assert.deepEqual(asked(silent, elsewhere), { why: 'git could not say where origin pushes to, so nothing says it is private and the tree being committed was not pushed', known: false });
  } finally {
    on.done();
    silent.done();
  }
});

// Codex, 2026-11-11, on c0d570d3: the visibility was asked of the one URL `git config --get` answers, while a push
// goes to every push URL of the remote, each after git's rewrites. A public destination beside a private one, or
// behind a rewrite, was published to under the default.
test('every place the push goes to must be private: a second push URL, or a URL git rewrites, keeps the tree here', async () => {
  const two = project({ remoteGate: null, ssh: true });
  try {
    git(two.cwd, 'config', '--add', 'remote.origin.pushurl', 'git@github.com:o/open.git');
    git(two.cwd, 'config', '--add', 'remote.origin.pushurl', 'git@github.com:o/r.git');
    const gh = fakeGh({ ...GREEN(), visibility: { 'o/r': 'PRIVATE', 'o/open': 'PUBLIC' } });
    const gitCalls = [];
    const result = await runCiGate(options(two, gh, clock(), { onGit: (args) => gitCalls.push(args) }));
    assert.deepEqual(result, { ran: false, why: 'o/open reads PUBLIC, not PRIVATE, and harness.json does not turn remoteGate on (js-harness functions set remoteGate on), so the tree being committed was not pushed' });
    assert.deepEqual(written(gitCalls), []);
    assert.equal(remoteBranches(two.remote), '');
    // Both private: each is asked once, and the tree goes.
    const both = fakeGh({ ...GREEN(), visibility: { 'o/r': 'PRIVATE', 'o/open': 'PRIVATE' } });
    assert.equal(remoteGateKeeps({ cwd: two.cwd, env: { ...cleanEnv, ...identity, ...two.env }, gh: both }), null);
    assert.deepEqual(both.calls.map((args) => args[2]), ['github.com/o/open', 'github.com/o/r']);
  } finally {
    two.done();
  }
  // The remote is written as a private GitHub repository, and git rewrites it to somewhere else: where the tree
  // would go is what counts, not what the remote is called. A password in that URL is not printed.
  const rewritten = project({ remoteGate: null });
  try {
    git(rewritten.cwd, 'config', '--unset', `url.${rewritten.remote}.insteadOf`);
    git(rewritten.cwd, 'config', 'url.https://user:secret@example.com/.insteadOf', 'https://github.com/');
    const gh = fakeGh({ ...GREEN(), visibility: 'PRIVATE' });
    const gitCalls = [];
    const result = await runCiGate(options(rewritten, gh, clock(), { onGit: (args) => gitCalls.push(args) }));
    assert.deepEqual(result, { ran: false, why: 'origin pushes to https://example.com/o/r.git, which is not a GitHub repository, so nothing says it is private and the tree being committed was not pushed' });
    assert.deepEqual(gh.calls, []);
    assert.deepEqual(written(gitCalls), []);
  } finally {
    rewritten.done();
  }
});

// The independent verifier, 2026-11-11, on 445a43c4 (odd/tasks/publish-decision.md, L13): three states in which a
// tree was pushed that the switch should have kept. Each is a reading of the wrong thing: the host of a URL, the
// GitHub that `gh` asks, the folder harness.json is read from.
test('a URL is GitHub\'s only where git would go to github.com: a host before an "@" that is no user name is not read as one', async () => {
  const { githubRepository } = await import('./ci-gate.mjs');
  // What comes before "@" is a user name only while it holds no "#", "?" or "\": with one, the host is what comes
  // before it, and "@github.com/..." is a fragment, a query or a path of that host.
  for (const host of ['example.invalid#', 'example.invalid?', 'example.invalid\\', 'example.invalid/x', 'a b', '']) {
    assert.equal(githubRepository(`https://${host}@github.com/o/r`), null, `https://${host}@github.com/o/r`);
  }
  assert.equal(githubRepository('https://github.com:8443/o/r'), null, 'another port is another server');
  assert.equal(githubRepository('https://github.com.example.invalid/o/r'), null);
  assert.equal(githubRepository('https://x-access-token:ghs_A1b2%40c@github.com/o/r.git'), 'o/r', 'a user and a token are still read past');
  assert.equal(githubRepository('https://user@github.com/o/r'), 'o/r');
  // And the gate keeps the tree of such a remote, whatever `gh` would say of the name after the "@".
  const p = project({ remoteGate: null });
  try {
    git(p.cwd, 'config', '--unset', `url.${p.remote}.insteadOf`);
    git(p.cwd, 'remote', 'set-url', 'origin', 'https://example.invalid#@github.com/o/r');
    const gh = fakeGh({ ...GREEN(), visibility: 'PRIVATE' });
    const gitCalls = [];
    const result = await runCiGate(options(p, gh, clock(), { onGit: (args) => gitCalls.push(args) }));
    assert.equal(result.ran, false);
    assert.match(result.why, /is not a GitHub repository/);
    assert.deepEqual(gh.calls, []);
    assert.deepEqual(written(gitCalls), []);
  } finally {
    p.done();
  }
});

test('the switch is the one at the top of the working tree, from whatever folder below it the gate is asked', async () => {
  const p = project({ remoteGate: 'off', ssh: true });
  try {
    const below = path.join(p.cwd, 'packages', 'one');
    fs.mkdirSync(below, { recursive: true });
    const gh = fakeGh({ ...GREEN(), visibility: 'PRIVATE' });
    const gitCalls = [];
    const result = await runCiGate({ ...options(p, gh, clock(), { onGit: (args) => gitCalls.push(args) }), cwd: below });
    assert.deepEqual(result, { ran: false, why: 'remoteGate reads off in harness.json, so the tree being committed was not pushed' });
    assert.deepEqual(gh.calls, [], 'the visibility is not asked: the project said off');
    assert.deepEqual(written(gitCalls), []);
    assert.equal(remoteBranches(p.remote), '');
    assert.deepEqual(remoteGateKeeps({ cwd: below, env: { ...cleanEnv, ...identity, ...p.env }, gh }), { why: 'remoteGate reads off in harness.json, so the tree being committed was not pushed', known: true });
  } finally {
    p.done();
  }
  // A folder git knows no working tree of has no harness.json to read: nothing says the tree may go.
  const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-nowhere-'));
  try {
    const gh = fakeGh({ visibility: 'PRIVATE' });
    const kept = remoteGateKeeps({ cwd: nowhere, env: { ...cleanEnv, GIT_CEILING_DIRECTORIES: path.dirname(nowhere) }, gh });
    assert.match(kept.why, /^git could not say where the working tree of .+ starts, so its harness\.json was not read and the tree being committed was not pushed$/);
    assert.equal(kept.known, false);
    assert.deepEqual(gh.calls, []);
  } finally {
    fs.rmSync(nowhere, { recursive: true, force: true });
  }
});

test('the gate of a merge being made sends CI both its parents, HEAD and MERGE_HEAD, as the merge commit will have', async () => {
  // Without MERGE_HEAD the merged branch's commits look like this branch's own on CI, and checks that read the
  // branch's history (rule depth-pass) judge them as new: odd/tasks/stack-upgrade.md, L10.
  const p = project();
  try {
    git(p.cwd, 'reset', '-q', '--hard');
    git(p.cwd, 'checkout', '-q', '-b', 'side');
    fs.writeFileSync(path.join(p.cwd, 'b.txt'), 'side\n');
    git(p.cwd, 'add', 'b.txt');
    git(p.cwd, 'commit', '-q', '-m', 'side');
    const side = git(p.cwd, 'rev-parse', 'HEAD');
    git(p.cwd, 'checkout', '-q', '-');
    git(p.cwd, 'merge', '-q', '--no-ff', '--no-commit', 'side');
    const head = git(p.cwd, 'rev-parse', 'HEAD');
    const gh = fakeGh({ runs: [[], [RUN]], views: [{ ...RUN, status: 'completed', conclusion: 'success' }] });
    let pushed;
    const spy = (args) => { pushed ??= args.find((arg) => arg.includes(':refs/heads/gate/')); };
    const result = await runCiGate(options(p, gh, clock(), { onGit: spy }));
    assert.equal(result.pass, true, result.why);
    const sha = pushed.split(':')[0];
    assert.deepEqual(git(p.remote, 'rev-list', '--parents', '-n', '1', sha).split(' ').slice(1), [head, side]);
    assert.equal(git(p.remote, 'show', `${sha}:b.txt`), 'side', 'the merged tree');
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
    const unlisted = await runCiGate(options(p, noGh, clock(), { onGit: (args) => gitCalls.push(args) }));
    assert.equal(unlisted.ran, false);
    assert.equal(unlisted.why, 'gh cannot read the runs of o/r, so nothing was pushed: gh: To get started with GitHub CLI, please run: gh auth login');
    assert.deepEqual(written(gitCalls), [], 'a gh that cannot answer is found before any tree is written or pushed');
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
