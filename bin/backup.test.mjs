import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { backupMain, backupPaths, bundleName, dueReason, BACKUP_EVERY_MINUTES, DEFAULT_SCOPE } from './backup.mjs';
import { defaultRun } from './lib/backup.mjs';

// Git is real, against a bare repository in a scratch folder; engram and gh are fakes that record what they were
// asked. The clone's fetch URL names the private repository, its push URL the bare one, so the origin guard reads the
// name a real clone would have and nothing reaches the network.
const REPO = 'jsaristi/js-harness-memory';
const EXPORT = {
  version: '0.2.0',
  exported_at: '2026-10-19T07:00:00Z',
  sessions: [{ id: 's1' }, { id: 's2' }],
  observations: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }],
  prompts: [{ id: 'p' }],
  relations: [],
};
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'backup test',
  GIT_AUTHOR_EMAIL: 'backup@test.invalid',
  GIT_COMMITTER_NAME: 'backup test',
  GIT_COMMITTER_EMAIL: 'backup@test.invalid',
};

function sink() {
  let text = '';
  return { write: (chunk) => (text += chunk), get text() { return text; } };
}

function setup(t, { visibility = 'PRIVATE', engram = EXPORT, machine = 'DESKTOP-1', scope = 'all' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-cmd-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const bare = path.join(root, 'remote.git');
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'D--p', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), '- a note\n');
  defaultRun('git', ['init', '-q', '--bare', bare]);
  const paths = backupPaths(home);
  fs.mkdirSync(paths.dir, { recursive: true });
  defaultRun('git', ['clone', '-q', bare, paths.clone]);
  defaultRun('git', ['-C', paths.clone, 'remote', 'set-url', 'origin', `https://github.com/${REPO}.git`]);
  defaultRun('git', ['-C', paths.clone, 'remote', 'set-url', '--push', 'origin', bare]);
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], ...(scope ? { scope } : {}) }));

  // What `git remote get-url --push` reports: the github URL a real clone has, while the push itself goes to the bare
  // repository; a test that sets another one sees what the guard does with it.
  const state = { engram, visibility, calls: [], started: [], now: Date.now(), pushUrls: [`https://github.com/${REPO}.git`] };
  const deps = {
    home,
    env: GIT_ENV,
    machine,
    now: () => state.now,
    stdout: sink(),
    stderr: sink(),
    bundles: [],
    startDetached: (args) => state.started.push(args),
    run: (cmd, args, options) => {
      state.calls.push([cmd, ...args]);
      if (cmd === 'engram' && args[0] === 'export') {
        fs.writeFileSync(args[1], JSON.stringify({ ...state.engram, exported_at: new Date(state.now).toISOString() }));
        return { status: 0, stdout: '', stderr: '' };
      }
      if (cmd === 'engram' && args[0] === 'stats') {
        const e = state.engram;
        return { status: 0, stdout: `Engram Memory Stats\n  Sessions:     ${e.sessions.length}\n  Observations: ${e.observations.length}\n  Prompts:      ${e.prompts.length}\n  Projects:     js-harness, clientproject, v\n`, stderr: '' };
      }
      if (cmd === 'engram' && args[0] === 'version') return { status: 0, stdout: 'engram 3.4.0\n', stderr: '' };
      if (cmd === 'gh' && args[1] === 'view') {
        return state.visibility ? { status: 0, stdout: `${state.visibility}\n`, stderr: '' } : { status: 1, stdout: '', stderr: 'not found' };
      }
      if (cmd === 'gh' && args[1] === 'create') {
        state.visibility = 'PRIVATE';
        return { status: 0, stdout: '', stderr: '' };
      }
      if (cmd === 'git' && args.includes('get-url') && args.includes('--push')) {
        return { status: 0, stdout: `${state.pushUrls.join('\n')}\n`, stderr: '' };
      }
      if (cmd === 'git' && args[0] === 'clone') {
        defaultRun('git', ['clone', '-q', bare, args[3]]);
        return { status: 0, stdout: '', stderr: '' };
      }
      return defaultRun(cmd, args, options);
    },
  };
  return { root, home, bare, paths, deps, state };
}

const remoteFile = (bare, file) => defaultRun('git', ['--git-dir', bare, 'show', `HEAD:${file}`]);
const remoteCommits = (bare) => Number(defaultRun('git', ['--git-dir', bare, 'rev-list', '--count', '--all']).stdout.trim());

test('backup run exports, copies, commits and pushes, and records the success', async (t) => {
  const { bare, paths, deps } = setup(t);

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.match(deps.stdout.text, /2 observations, 2 sessions, 1 prompts, 0 relations; committed, 1 pushed/);
  const manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.deepEqual(manifest.export, { sessions: 2, observations: 2, prompts: 1, relations: 0 });
  assert.deepEqual(manifest.live, { sessions: 2, observations: 2, prompts: 1 });
  assert.equal(manifest.machine, 'DESKTOP-1');
  assert.equal(manifest.engramVersion, 'engram 3.4.0');
  assert.deepEqual(manifest.files.map((f) => f.path), ['claude/projects/D--p/memory/MEMORY.md']);
  assert.equal(JSON.parse(remoteFile(bare, 'engram/export.json').stdout).observations.length, 2);
  const last = JSON.parse(fs.readFileSync(paths.last, 'utf8'));
  assert.equal(last.lastSuccess.at, new Date(deps.now()).toISOString());
  assert.ok(!fs.existsSync(paths.lock), 'the lock is released');
});

test('the scope is one switch: unset backs up the default project only, "all" every project', async (t) => {
  const { bare, home, paths, deps, state } = setup(t, { scope: null });
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'D--js-harness', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'D--js-harness', 'memory', 'MEMORY.md'), '- harness note\n');

  assert.equal(DEFAULT_SCOPE, 'js-harness');
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  const engramCalls = state.calls.filter(([cmd, verb]) => cmd === 'engram' && (verb === 'export' || verb === 'stats'));
  assert.deepEqual(engramCalls.map((call) => call.slice(-2)), [['--project', 'js-harness'], ['--project', 'js-harness']]);
  let manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.equal(manifest.scope, 'js-harness');
  assert.deepEqual(manifest.files.map((f) => f.path), ['claude/projects/D--js-harness/memory/MEMORY.md']);

  // Widening the scope is the one change: the next run takes every project, and its bigger export is no shrink.
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], scope: 'all' }));
  state.now += 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.equal(manifest.scope, 'all');
  assert.deepEqual(manifest.files.map((f) => f.path), [
    'claude/projects/D--js-harness/memory/MEMORY.md',
    'claude/projects/D--p/memory/MEMORY.md',
  ]);

  // Narrowing it again drops the other project from the clone, and the smaller export is taken, not refused as a wipe.
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], scope: 'js-harness' }));
  state.engram = { ...EXPORT, observations: [{ id: 1, title: 'a' }], sessions: [{ id: 's1' }] };
  state.now += 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.deepEqual(manifest.files.map((f) => f.path), ['claude/projects/D--js-harness/memory/MEMORY.md']);
  assert.equal(remoteFile(bare, 'claude/projects/D--p/memory/MEMORY.md').status, 128, 'the other project is gone from the head');
});

test('a second run with nothing new commits and pushes nothing', async (t) => {
  const { bare, deps, state } = setup(t);
  await backupMain(['run'], deps);
  state.now += 60 * 60_000;

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.match(deps.stdout.text, /nothing new, 0 pushed/);
  assert.equal(remoteCommits(bare), 1);
});

test('backup run pushes nothing while the repository does not read PRIVATE, and records why', async (t) => {
  for (const visibility of ['PUBLIC', null]) {
    const { bare, paths, deps } = setup(t, { visibility });

    assert.equal(await backupMain(['run'], deps), 1);

    assert.equal(remoteCommits(bare), 0);
    const failure = JSON.parse(fs.readFileSync(paths.last, 'utf8')).lastFailure.error;
    assert.match(failure, visibility ? /reads PUBLIC, not PRIVATE/ : /could not be read/);
    assert.match(deps.stderr.text, /refused/);
  }
});

test('a wiped Engram never replaces the backup, and --allow-shrink lets a meant drop through', async (t) => {
  const { bare, deps, state } = setup(t);
  await backupMain(['run'], deps);
  state.engram = { ...EXPORT, sessions: [], observations: [], prompts: [] };

  assert.equal(await backupMain(['run'], deps), 1);
  assert.match(deps.stderr.text, /holds 0 sessions, the last backup 2: refused/);
  assert.equal(JSON.parse(remoteFile(bare, 'engram/export.json').stdout).observations.length, 2);

  assert.equal(await backupMain(['run', '--allow-shrink'], deps), 0, deps.stderr.text);
  assert.equal(JSON.parse(remoteFile(bare, 'engram/export.json').stdout).observations.length, 0);
});

test('a backup another machine made is taken over only with --adopt', async (t) => {
  const { deps } = setup(t);
  await backupMain(['run'], deps);
  deps.machine = 'NEW-PC';
  deps.stdout = sink();

  assert.equal(await backupMain(['run'], deps), 1);
  assert.match(deps.stderr.text, /made on DESKTOP-1, this machine is NEW-PC: run backup run --adopt/);
  assert.equal(await backupMain(['run', '--adopt'], deps), 0, deps.stderr.text);
});

test('a live lock refuses a second run, and a stale one is taken over', async (t) => {
  const { paths, deps, state } = setup(t);
  fs.writeFileSync(paths.lock, JSON.stringify({ pid: 4242, at: new Date(state.now - 60_000).toISOString() }));
  assert.equal(await backupMain(['run'], deps), 1);
  assert.match(deps.stderr.text, /already running \(pid 4242\)/);

  fs.writeFileSync(paths.lock, JSON.stringify({ pid: 4242, at: new Date(state.now - 11 * 60_000).toISOString() }));
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
});

test('the hook starts a detached run only when one is due', async (t) => {
  const { home, paths, deps, state } = setup(t);

  assert.equal(await backupMain(['--hook'], deps), 0);
  assert.deepEqual(state.started, [['backup', 'run']], 'never backed up: due');

  await backupMain(['run'], deps);
  state.started = [];
  state.now += 10 * 60_000;
  assert.equal(dueReason(home, state.now), `backed up less than ${BACKUP_EVERY_MINUTES} minutes ago`);

  state.now += 60 * 60_000;
  const old = new Date(state.now - 2 * 60 * 60_000);
  for (const file of [path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), path.join(home, '.claude', 'projects', 'D--p', 'memory')]) {
    fs.utimesSync(file, old, old);
  }
  assert.equal(dueReason(home, state.now), 'nothing changed since the last backup');

  fs.mkdirSync(path.join(home, '.engram'), { recursive: true });
  fs.writeFileSync(path.join(home, '.engram', 'engram.db-wal'), 'new memory');
  fs.utimesSync(path.join(home, '.engram', 'engram.db-wal'), new Date(state.now), new Date(state.now));
  await backupMain(['--hook'], deps);
  assert.deepEqual(state.started, [['backup', 'run']], 'a write to the WAL alone makes it due');

  fs.rmSync(paths.clone, { recursive: true, force: true });
  assert.equal(dueReason(home, state.now), 'not initialised');
});

test('a memory folder deleted whole makes a backup due, so the clone stops holding it', async (t) => {
  const { home, deps, state } = setup(t);
  await backupMain(['run'], deps);
  state.now += 60 * 60_000;
  const old = new Date(state.now - 2 * 60 * 60_000);
  for (const file of [path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), path.join(home, '.claude', 'projects', 'D--p', 'memory')]) {
    fs.utimesSync(file, old, old);
  }
  assert.equal(dueReason(home, state.now), 'nothing changed since the last backup');

  fs.rmSync(path.join(home, '.claude', 'projects', 'D--p'), { recursive: true });

  assert.equal(dueReason(home, state.now), null);
});

test('every push URL is checked: a pushurl elsewhere sends nothing', async (t) => {
  const { bare, paths, deps, state } = setup(t);
  state.pushUrls = ['https://github.com/jsaristi/js-harness.git'];

  assert.equal(await backupMain(['run'], deps), 1);

  assert.equal(remoteCommits(bare), 0);
  assert.match(JSON.parse(fs.readFileSync(paths.last, 'utf8')).lastFailure.error, /public repository/);
});

test('a run never removes a lock it does not hold, and a lock still being written counts as held', async (t) => {
  const { paths, deps, state } = setup(t);
  const run = deps.run;
  deps.run = (cmd, args, options) => {
    // Another run took the lock over while this one worked (its own was taken for stale).
    if (cmd === 'engram' && args[0] === 'export') fs.writeFileSync(paths.lock, JSON.stringify({ pid: 999, at: new Date(state.now).toISOString() }));
    return run(cmd, args, options);
  };
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(JSON.parse(fs.readFileSync(paths.lock, 'utf8')).pid, 999);

  fs.writeFileSync(paths.lock, '');
  deps.run = run;
  assert.equal(await backupMain(['run'], deps), 1);
  assert.match(deps.stderr.text, /already running/);
});

function sourceRepo(dir, file = 'a.txt') {
  fs.mkdirSync(dir, { recursive: true });
  for (const args of [['init', '-q', '-b', 'main', dir], ['-C', dir, 'commit', '-q', '--allow-empty', '-m', 'one']]) {
    const result = spawnSync('git', args, { env: GIT_ENV, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return dir;
}

const bundleHeads = (file) => defaultRun('git', ['bundle', 'list-heads', file]).stdout;

test('bundles: two sources of one name kept apart, a new tag rebundles, and an unreadable source keeps its bundle', async (t) => {
  const { root, paths, deps } = setup(t);
  const first = sourceRepo(path.join(root, 'work', 'app'));
  const second = sourceRepo(path.join(root, 'personal', 'app'));
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [first, second], scope: 'all' }));

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const bundles = fs.readdirSync(path.join(paths.clone, 'git')).sort();
  assert.equal(bundles.length, 2, `two bundles, not one overwriting the other: ${bundles}`);
  const named = (source) => path.join(paths.clone, 'git', bundles.find((name) => name.includes(source)));
  assert.match(bundleHeads(named('work')), /refs\/heads\/main/);

  // A tag on a commit no branch reaches: the refs of the branches are the same, the bundle must not be.
  for (const args of [['checkout', '-q', '--detach'], ['commit', '-q', '--allow-empty', '-m', 'tagged'], ['tag', 'kept'], ['checkout', '-q', 'main']]) {
    spawnSync('git', ['-C', first, ...args], { env: GIT_ENV });
  }
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.match(bundleHeads(named('work')), /refs\/tags\/kept/);

  assert.notEqual(bundleName('D:/work/a-b/app'), bundleName('D:/work/a/b/app'), 'a path is never folded into another');
  // A bundle no manifest entry names (an older layout's, or one put there by hand) is never removed by a run.
  fs.writeFileSync(path.join(paths.clone, 'git', 'legacy.bundle'), 'kept');
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.ok(fs.existsSync(path.join(paths.clone, 'git', 'legacy.bundle')));

  const before = fs.readFileSync(named('personal'));
  fs.rmSync(second, { recursive: true, force: true });
  deps.stdout = sink();
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.deepEqual(fs.readFileSync(named('personal')), before, 'the last good bundle stays');
  assert.match(deps.stdout.text, /could not be read/);
});

test('backup init creates the repository private when it is missing, refuses a public one, and clones', async (t) => {
  const { paths, deps, state } = setup(t, { visibility: null });
  fs.rmSync(paths.clone, { recursive: true, force: true });

  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);
  assert.ok(state.calls.some((c) => c[0] === 'gh' && c[2] === 'create' && c.includes('--private')));
  assert.ok(fs.existsSync(path.join(paths.clone, '.git')));
  assert.equal(JSON.parse(fs.readFileSync(paths.config, 'utf8')).repo, REPO);

  state.visibility = 'PUBLIC';
  assert.equal(await backupMain(['init', '--repo', REPO], deps), 1);
  assert.match(deps.stderr.text, /reads PUBLIC, not PRIVATE/);
  assert.equal(await backupMain(['init', '--repo', 'jsaristi/js-harness'], deps), 1);
  assert.match(deps.stderr.text, /public repository/);
});

test('backup init seeds private-terms.txt from the other Engram projects, and keeps one already there', async (t) => {
  const { paths, deps } = setup(t);
  fs.rmSync(paths.clone, { recursive: true, force: true });

  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);

  const terms = fs.readFileSync(path.join(paths.clone, 'private-terms.txt'), 'utf8');
  assert.match(terms, /^# /, 'it says what it is for');
  assert.deepEqual(terms.split('\n').filter((line) => line && !line.startsWith('#')), ['clientproject']);
  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'added by hand\n');
  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);
  assert.equal(fs.readFileSync(path.join(paths.clone, 'private-terms.txt'), 'utf8'), 'added by hand\n');
});

test('backup status names the last success, the last failure and the commits to push', async (t) => {
  const { deps, state } = setup(t);
  const first = new Date(state.now).toISOString();
  await backupMain(['run'], deps);
  state.visibility = 'PUBLIC';
  state.engram = { ...EXPORT, observations: [...EXPORT.observations, { id: 3 }] };
  state.now += 60 * 60_000;
  const second = new Date(state.now).toISOString();
  await backupMain(['run'], deps);
  deps.stdout = sink();

  assert.equal(await backupMain(['status'], deps), 0);

  assert.match(deps.stdout.text, /repository: jsaristi\/js-harness-memory/);
  assert.ok(deps.stdout.text.includes(`last success: ${first}, 2 observations`), deps.stdout.text);
  assert.ok(deps.stdout.text.includes(`last failure: ${second}, refused: `), deps.stdout.text);
  assert.match(deps.stdout.text, /reads PUBLIC, not PRIVATE/);
  assert.match(deps.stdout.text, /to push: 1 commits/);
});
