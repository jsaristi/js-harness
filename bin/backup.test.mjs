import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { backupHealth, backupMain, backupPaths, bundleName, dueReason, BACKUP_EVERY_MINUTES, DEFAULT_SCOPE } from './backup.mjs';
import { defaultRun } from './lib/backup.mjs';
import { shortKey, UNTRACKED_MAX_BYTES } from './lib/backup-repos.mjs';

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
  const state = {
    engram,
    visibility,
    calls: [],
    started: [],
    now: Date.now(),
    pushUrls: [`https://github.com/${REPO}.git`],
    summaryRepo: null,
    summaryUrls: ['https://github.com/jsaristi/js-harness.git'],
  };
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
      // An engram pointed at another data folder, as restore and verify do: its database is one JSON file there.
      const dataDir = options?.env?.ENGRAM_DATA_DIR;
      if (cmd === 'engram' && dataDir) {
        const db = path.join(dataDir, 'db.json');
        const held = fs.existsSync(db) ? JSON.parse(fs.readFileSync(db, 'utf8')) : { sessions: [], observations: [], prompts: [], relations: [] };
        if (args[0] === 'import') {
          const incoming = JSON.parse(fs.readFileSync(args[1], 'utf8'));
          fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(db, JSON.stringify(Object.fromEntries(Object.keys(held).map((k) => [k, [...held[k], ...(incoming[k] ?? [])]]))));
        }
        if (args[0] === 'export') fs.writeFileSync(args[1], JSON.stringify(held));
        const stats = `  Sessions:     ${held.sessions.length}\n  Observations: ${held.observations.length}\n  Prompts:      ${held.prompts.length}\n`;
        return { status: 0, stdout: args[0] === 'stats' ? stats : args[0] === 'version' ? 'engram 3.4.0\n' : '', stderr: '' };
      }
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
      // The summary repository answers with its own URLs, the public one on github.com unless a test says otherwise.
      if (cmd === 'git' && args.includes('get-url') && state.summaryRepo && args[1] === state.summaryRepo) {
        return { status: 0, stdout: `${state.summaryUrls.join('\n')}\n`, stderr: '' };
      }
      if (cmd === 'git' && args.includes('get-url') && args.includes('--push')) {
        return { status: 0, stdout: `${state.pushUrls.join('\n')}\n`, stderr: '' };
      }
      // What origin holds, asked of the bare repository the push goes to, so `backup ready` reaches no network.
      if (cmd === 'git' && args[1] === paths.clone && args[2] === 'ls-remote') {
        return defaultRun('git', ['-C', paths.clone, 'ls-remote', bare, ...args.slice(4)], options);
      }
      if (cmd === 'git' && args[0] === 'clone' && args[2] === `https://github.com/${REPO}.git`) {
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

const MEMORY = {
  ...EXPORT,
  observations: [
    { id: 1, sync_id: 'obs-1', type: 'decision', title: 'Gate lock decided', content: '**Why**: one gate at a time', project: 'js-harness', updated_at: '2026-10-20 10:00:00' },
    { id: 2, sync_id: 'obs-2', type: 'bugfix', title: 'Client fix', content: 'fixed', project: 'client', updated_at: '2026-10-21 10:00:00' },
  ],
};

test('backup run rebuilds RECENT.md and a file per project from the export it accepted, and only then', async (t) => {
  const { bare, paths, deps, state } = setup(t, { engram: MEMORY });

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.match(remoteFile(bare, 'RECENT.md').stdout, /recent\/js-harness\.md/);
  assert.match(remoteFile(bare, 'recent/js-harness.md').stdout, /^### Gate lock decided$/m);
  assert.match(remoteFile(bare, 'recent/client.md').stdout, /^### Client fix$/m);
  const manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.deepEqual(manifest.recent.map(({ project, file, entries, observations }) => ({ project, file, entries, observations })), [
    { project: 'client', file: 'recent/client.md', entries: 1, observations: 1 },
    { project: 'js-harness', file: 'recent/js-harness.md', entries: 1, observations: 1 },
  ]);
  assert.ok(manifest.files.every((f) => !f.path.startsWith('recent/')), 'restore places only its own roots');

  // A project gone from the export loses its file; an export the shrink guard refuses leaves the files as they were.
  state.engram = { ...MEMORY, observations: [MEMORY.observations[0], { ...MEMORY.observations[0], id: 3, sync_id: 'obs-3', title: 'Second' }] };
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(remoteFile(bare, 'recent/client.md').status, 128);
  assert.ok(!fs.existsSync(path.join(paths.clone, 'recent', 'client.md')));
  const before = remoteFile(bare, 'recent/js-harness.md').stdout;
  assert.match(before, /^### Second$/m);

  state.engram = { ...MEMORY, sessions: [], observations: [], prompts: [] };
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 1);
  assert.equal(fs.readFileSync(path.join(paths.clone, 'recent', 'js-harness.md'), 'utf8'), before);
});

test('a clone with no RECENT.md is due a backup even when nothing changed, and the run rewrites RESTORE.md', async (t) => {
  const { paths, deps, state } = setup(t, { engram: MEMORY });
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  state.now += 60 * 60_000;
  assert.equal(dueReason(deps.home, state.now), 'nothing changed since the last backup');
  fs.rmSync(path.join(paths.clone, 'RECENT.md'));
  assert.equal(dueReason(deps.home, state.now), null);
  assert.match(fs.readFileSync(path.join(paths.clone, 'RESTORE.md'), 'utf8'), /recent\//);
});

test('verify, ready, status and doctor check the readable fallback against the export, naming no project', async (t) => {
  const { bare, home, paths, deps, state } = setup(t, { engram: MEMORY });
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.equal(await backupMain(['verify', '--from', bare], deps), 0, deps.stdout.text + deps.stderr.text);
  assert.match(deps.stdout.text, /^ok recent: 3 of 3 files rebuilt from the export$/m);
  deps.stdout = sink();
  assert.equal(await backupMain(['status'], deps), 0);
  assert.match(deps.stdout.text, /^recent: 2 projects, newest entry 2026-10-21$/m);
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 0, deps.stdout.text);

  // A hand edit, or a run that failed half-way: the file is not what the export rebuilds.
  const client = path.join(paths.clone, 'recent', 'client.md');
  const good = fs.readFileSync(client, 'utf8');
  fs.appendFileSync(client, 'edited by hand\n');
  deps.stdout = sink();
  assert.equal(await backupMain(['verify', '--from', paths.clone], deps), 1);
  assert.match(deps.stdout.text, /^FAIL recent: 1 of 3 files differ from what the export rebuilds: js-harness backup run rebuilds them$/m);
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1);
  assert.match(deps.stdout.text, /^missing: 1 readable fallback files differ from what the backup's export rebuilds: js-harness backup run rebuilds them$/m);
  assert.doesNotMatch(deps.stdout.text + deps.stderr.text, /client/, 'the private project is never named');

  // Another format loses nothing (the export holds it all): a note, never a failure.
  fs.writeFileSync(client, good.replace(/^format: \d+$/m, 'format: 0'));
  deps.stdout = sink();
  assert.equal(await backupMain(['verify', '--from', paths.clone], deps), 0, deps.stdout.text);
  assert.match(deps.stdout.text, /^note recent: 1 files were built by another format; the next backup run rebuilds them$/m);
  deps.stdout = sink();
  await backupMain(['ready'], deps);
  assert.match(deps.stdout.text, /^note: 1 readable fallback files were built by another format; the next backup run rebuilds them$/m);
  assert.doesNotMatch(deps.stdout.text, /missing: .*readable fallback/);
  fs.writeFileSync(client, good);

  // doctor: a success that left no RECENT.md is no backup of the fallback; ready says so too.
  assert.equal(backupHealth(home, state.now).state, 'ok');
  fs.rmSync(path.join(paths.clone, 'RECENT.md'));
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1);
  assert.match(deps.stdout.text, /^missing: the backup holds no readable fallback of Engram \(RECENT\.md\): js-harness backup run writes it$/m);
  const health = backupHealth(home, state.now);
  assert.equal(health.state, 'stale');
  assert.match(health.fix[0], /no RECENT\.md in the clone/);
});

test('a wipe of one project keeps its file and its export, and last.json names it', async (t) => {
  const many = (project, n) => Array.from({ length: n }, (_, i) => ({ id: `${project}-${i}`, sync_id: `obs-${project}-${i}`, type: 'decision', title: `${project} ${i}`, content: 'c', project, updated_at: '2026-10-20 10:00:00' }));
  const { paths, deps, state } = setup(t, { engram: { ...EXPORT, observations: [...many('big', 400), ...many('client', 30)] } });
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const kept = fs.readFileSync(path.join(paths.clone, 'recent', 'client.md'), 'utf8');

  state.engram = { ...EXPORT, observations: many('big', 400) };
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 1);
  assert.match(deps.stderr.text, /1 project lost more than a tenth/);
  assert.doesNotMatch(deps.stderr.text, /client/);
  assert.equal(fs.readFileSync(path.join(paths.clone, 'recent', 'client.md'), 'utf8'), kept);
  assert.deepEqual(JSON.parse(fs.readFileSync(paths.last, 'utf8')).lastFailure.projects, [{ project: 'client', before: 30, after: 0 }]);
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

test('a run copies Claude Desktop\'s notes, and a new note makes a backup due', async (t) => {
  const { root, bare, home, deps, state } = setup(t);
  deps.desktop = path.join(root, 'desktop');
  fs.mkdirSync(path.join(deps.desktop, 'side-session-notes', 'local_1'), { recursive: true });
  fs.writeFileSync(path.join(deps.desktop, 'side-session-notes', 'local_1', 'a.md'), 'first\n');
  await backupMain(['run'], deps);
  assert.equal(remoteFile(bare, 'config/claude-desktop/side-session-notes/local_1/a.md').stdout, 'first\n');

  state.now += 60 * 60_000;
  const old = new Date(state.now - 2 * 60 * 60_000);
  for (const file of [
    path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'),
    path.join(home, '.claude', 'projects', 'D--p', 'memory'),
    path.join(deps.desktop, 'side-session-notes', 'local_1', 'a.md'),
    path.join(deps.desktop, 'side-session-notes', 'local_1'),
    path.join(deps.desktop, 'side-session-notes'),
  ]) {
    fs.utimesSync(file, old, old);
  }
  assert.equal(dueReason(home, state.now, deps.desktop), 'nothing changed since the last backup');
  fs.writeFileSync(path.join(deps.desktop, 'side-session-notes', 'local_1', 'b.md'), 'second\n');
  fs.utimesSync(path.join(deps.desktop, 'side-session-notes', 'local_1', 'b.md'), new Date(state.now), new Date(state.now));
  assert.equal(dueReason(home, state.now, deps.desktop), null);
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

test('the bundle holds every stash entry and a worktree\'s detached commit, and the source gains no ref', async (t) => {
  const { root, paths, deps } = setup(t);
  const source = sourceRepo(path.join(root, 'work', 'app'));
  const g = (...args) => spawnSync('git', ['-C', source, ...args], { env: GIT_ENV, encoding: 'utf8' });
  for (const file of ['one.txt', 'two.txt']) {
    fs.writeFileSync(path.join(source, file), file);
    g('add', file);
    g('stash', 'push', '-q', '-m', file);
  }
  const worktree = path.join(root, 'work', 'detached');
  g('worktree', 'add', '-q', '--detach', worktree);
  spawnSync('git', ['-C', worktree, 'commit', '-q', '--allow-empty', '-m', 'only here'], { env: GIT_ENV });
  const detached = spawnSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const refsBefore = g('for-each-ref').stdout;
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  const heads = bundleHeads(path.join(paths.clone, 'git', bundleName(source)));
  const stashes = g('log', '-g', '--format=%H', 'refs/stash').stdout.trim().split('\n');
  assert.equal(stashes.length, 2);
  for (const sha of [...stashes, detached]) assert.match(heads, new RegExp(sha), `${sha} is a head of the bundle`);
  assert.equal(g('for-each-ref').stdout, refsBefore, 'the source repository gains no ref');
  const entry = JSON.parse(remoteFile(path.join(root, 'remote.git'), 'manifest.json').stdout).bundles[0];
  assert.ok(stashes.every((sha) => entry.refs.some((ref) => ref.startsWith(sha))), 'the manifest names the stash entries');
});

test('a run keeps each worktree\'s uncommitted edits and the git directory\'s js-harness records, secrets blanked', async (t) => {
  const { root, bare, paths, deps, state } = setup(t);
  const source = sourceRepo(path.join(root, 'work', 'app'));
  const g = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { env: GIT_ENV, encoding: 'utf8' });
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'one\n');
  g(source, 'add', 'tracked.txt');
  g(source, 'commit', '-q', '-m', 'tracked');
  const worktree = path.join(root, 'work', 'side');
  g(source, 'worktree', 'add', '-q', '-b', 'side', worktree);
  const secret = `ghp_${'a'.repeat(36)}`;
  fs.writeFileSync(path.join(worktree, 'tracked.txt'), `one\ntoken ${secret}\n`);
  fs.mkdirSync(path.join(worktree, 'notes'));
  fs.writeFileSync(path.join(worktree, 'notes', 'new.md'), 'not committed yet\n');
  const records = path.join(source, '.git', 'js-harness');
  fs.mkdirSync(path.join(records, 'traces'), { recursive: true });
  fs.writeFileSync(path.join(records, 'codex-reviews.jsonl'), '{"range":"a..b"}\n');
  fs.writeFileSync(path.join(records, 'traces', 'timing.json'), '{}');
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  const base = `git/${shortKey(source)}`;
  const side = shortKey(worktree);
  const patch = remoteFile(bare, `${base}/worktrees/${side}.patch`).stdout;
  assert.match(patch, /\+token <redacted>/);
  assert.doesNotMatch(patch, new RegExp(secret));
  assert.equal(remoteFile(bare, `${base}/worktrees/${side}.untracked/notes/new.md`).stdout, 'not committed yet\n');
  assert.equal(remoteFile(bare, `${base}/js-harness/codex-reviews.jsonl`).stdout, '{"range":"a..b"}\n');
  assert.equal(remoteFile(bare, `${base}/js-harness/traces/timing.json`).status, 128, 'test timing caches stay out');
  const manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.ok(manifest.files.some((f) => f.path === `${base}/worktrees/${side}.patch`), 'the manifest lists the patch');
  assert.ok(manifest.redacted.some((f) => f.path === `${base}/worktrees/${side}.patch`), 'and names its secret');
  assert.deepEqual(manifest.bundles[0].worktrees, [{ path: worktree.replace(/\\/g, '/'), key: side, patch: true, untracked: 1, binary: 0, deletedBinary: 0 }]);

  // Committed and clean again: the next run keeps no stale patch.
  g(worktree, 'checkout', '-q', '--', 'tracked.txt');
  fs.rmSync(path.join(worktree, 'notes'), { recursive: true });
  state.now += 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(remoteFile(bare, `${base}/worktrees/${side}.patch`).status, 128, 'the stale patch is gone');
  assert.equal(remoteFile(bare, `${base}/js-harness/codex-reviews.jsonl`).status, 0, 'the records stay');
});

test('a changed binary file is copied whole with its secrets blanked, never encoded inside the patch', async (t) => {
  const { root, bare, paths, deps } = setup(t);
  const source = sourceRepo(path.join(root, 'work', 'app'));
  const g = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { env: GIT_ENV, encoding: 'utf8' });
  // 0xff and 0xfe are no UTF-8: a blanking that decodes as UTF-8 would turn them into U+FFFD.
  const head = Buffer.from([0, 0xff, 0xfe, 0]);
  fs.writeFileSync(path.join(source, 'blob.dat'), Buffer.concat([head, Buffer.from('old\n')]));
  fs.writeFileSync(path.join(source, 'a.txt'), 'one\n');
  const secret = `ghp_${'b'.repeat(36)}`;
  fs.writeFileSync(path.join(source, 'gone.dat'), Buffer.concat([head, Buffer.from(`token ${secret}\n`)]));
  g(source, 'add', 'blob.dat', 'a.txt', 'gone.dat');
  g(source, 'commit', '-q', '-m', 'binary');
  fs.rmSync(path.join(source, 'gone.dat'));
  fs.writeFileSync(path.join(source, 'blob.dat'), Buffer.concat([head, Buffer.from(`token ${secret}\n`)]));
  fs.appendFileSync(path.join(source, 'a.txt'), 'more\n');
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  const base = `git/${shortKey(source)}/worktrees/${shortKey(source)}`;
  const patch = remoteFile(bare, `${base}.patch`).stdout;
  assert.match(patch, /\+more/);
  assert.doesNotMatch(patch, /blob\.dat|gone\.dat|GIT binary patch/);
  // A deleted binary file's old bytes would ride in the patch's reverse half: only its name is kept.
  assert.equal(remoteFile(bare, `${base}.deleted-binaries.txt`).stdout, 'gone.dat\n');
  const copy = remoteFile(bare, `${base}.binary/blob.dat`);
  assert.equal(copy.status, 0, 'the binary file is copied whole');
  assert.doesNotMatch(copy.stdout, new RegExp(secret));
  assert.match(copy.stdout, /token <redacted>/);
  const bytes = spawnSync('git', ['--git-dir', bare, 'show', `HEAD:${base}.binary/blob.dat`]).stdout;
  assert.deepEqual(bytes.subarray(0, 4), head, 'only the secret changes: every other byte is kept');
  const manifest = JSON.parse(remoteFile(bare, 'manifest.json').stdout);
  assert.equal(manifest.bundles[0].worktrees[0].binary, 1);
  assert.equal(manifest.bundles[0].worktrees[0].deletedBinary, 1);
});

test('a worktree git cannot diff keeps its last copies, and ready names it', async (t) => {
  const { root, bare, paths, deps, state } = setup(t);
  const source = sourceRepo(path.join(root, 'work', 'app'));
  fs.writeFileSync(path.join(source, 'a.txt'), 'one\n');
  spawnSync('git', ['-C', source, 'add', 'a.txt'], { env: GIT_ENV });
  spawnSync('git', ['-C', source, 'commit', '-q', '-m', 'a'], { env: GIT_ENV });
  fs.appendFileSync(path.join(source, 'a.txt'), 'edit\n');
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const patch = `git/${shortKey(source)}/worktrees/${shortKey(source)}.patch`;
  assert.equal(remoteFile(bare, patch).status, 0);

  const run = deps.run;
  deps.run = (cmd, args, options) =>
    cmd === 'git' && path.resolve(args[1]) === path.resolve(source) && args[2] === 'diff' ? { status: 128, stdout: Buffer.alloc(0), stderr: 'fatal' } : run(cmd, args, options);
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(remoteFile(bare, patch).status, 0, 'a failed diff is no clean worktree: the last patch stays');

  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1);
  assert.match(deps.stdout.text, /missing: .*app: its worktrees and records could not be read/);
});

test('a copied Desktop presets file or plugin list deleted whole makes a backup due', async (t) => {
  const { root, home, deps, state } = setup(t);
  deps.desktop = path.join(root, 'desktop');
  fs.mkdirSync(deps.desktop, { recursive: true });
  const presets = path.join(deps.desktop, 'ccd-session-presets.json');
  const plugins = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  fs.writeFileSync(presets, '{}\n');
  fs.mkdirSync(path.dirname(plugins), { recursive: true });
  fs.writeFileSync(plugins, '{}\n');
  await backupMain(['run'], deps);
  state.now += 60 * 60_000;
  const old = new Date(state.now - 2 * 60 * 60_000);
  for (const file of [path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), path.join(home, '.claude', 'projects', 'D--p', 'memory'), presets, plugins]) {
    fs.utimesSync(file, old, old);
  }
  assert.equal(dueReason(home, state.now, deps.desktop), 'nothing changed since the last backup');

  fs.rmSync(presets);
  assert.equal(dueReason(home, state.now, deps.desktop), null, 'the presets file is gone');
  fs.writeFileSync(presets, '{}\n');
  fs.utimesSync(presets, old, old);
  fs.rmSync(plugins);
  assert.equal(dueReason(home, state.now, deps.desktop), null, 'the plugin list is gone');
});

/** A source repository with a remote that holds its main, so only what follows is on no remote. */
function pushedRepo(root, name) {
  const origin = path.join(root, `${name}-origin.git`);
  defaultRun('git', ['init', '-q', '--bare', origin]);
  const dir = sourceRepo(path.join(root, name));
  for (const args of [['remote', 'add', 'origin', origin], ['push', '-q', 'origin', 'main']]) {
    const result = spawnSync('git', ['-C', dir, ...args], { env: GIT_ENV, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return dir;
}

/** Every file under a folder with its bytes, to prove a command wrote nothing there. */
function snapshot(dir) {
  const out = {};
  const visit = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) visit(full);
      else out[path.relative(dir, full)] = fs.readFileSync(full).toString('base64');
    }
  };
  visit(dir);
  return out;
}

test('backup ready names what has no copy off this machine, passes once a run copied it, and writes nothing', async (t) => {
  const { root, home, deps, paths, state } = setup(t);
  deps.desktop = path.join(root, 'desktop');
  fs.mkdirSync(path.join(deps.desktop, 'Cache'), { recursive: true });
  fs.writeFileSync(path.join(deps.desktop, 'Cache', 'blob'), Buffer.alloc(3 * 1024));
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'D--p', 'chat.jsonl'), Buffer.alloc(2 * 1024));
  const source = pushedRepo(root, 'app');
  const g = (cwd, ...args) => spawnSync('git', ['-C', cwd, ...args], { env: GIT_ENV, encoding: 'utf8' });
  fs.writeFileSync(path.join(source, 'a.txt'), 'a');
  g(source, 'add', 'a.txt');
  g(source, 'stash', 'push', '-q', '-m', 'kept aside');
  const worktree = path.join(root, 'side');
  g(source, 'worktree', 'add', '-q', '-b', 'side', worktree);
  fs.writeFileSync(path.join(worktree, 'draft.md'), 'not committed\n');
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));

  assert.equal(await backupMain(['ready'], deps), 1);
  assert.match(deps.stdout.text, /missing: the backup clone .* holds no backup yet/);

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 0, deps.stdout.text);
  assert.match(deps.stdout.text, /not copied: Claude transcripts \(.*\): 1 files, 2 KB/);
  assert.match(deps.stdout.text, /not copied: Claude Desktop data \(.*\), besides its notes and presets: 1 files, 3 KB/);
  assert.match(deps.stdout.text, /backup ready: yes/);

  // Each kind of loss, one at a time on the same machine.
  g(source, 'commit', '-q', '--allow-empty', '-m', 'not pushed');
  fs.writeFileSync(path.join(source, 'b.txt'), 'b');
  g(source, 'add', 'b.txt');
  g(source, 'stash', 'push', '-q', '-m', 'second');
  fs.writeFileSync(path.join(worktree, 'draft.md'), 'edited again\n');
  fs.writeFileSync(path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), '- a new note\n');
  fs.mkdirSync(path.join(source, '.git', 'js-harness'), { recursive: true });
  fs.writeFileSync(path.join(source, '.git', 'js-harness', 'codex-reviews.jsonl'), '{}\n');
  state.engram = { ...EXPORT, observations: [...EXPORT.observations, { id: 3, title: 'c' }] };
  const before = { home: snapshot(home), source: snapshot(path.join(source, '.git')) };
  deps.stdout = sink();

  assert.equal(await backupMain(['ready'], deps), 1);

  const out = deps.stdout.text;
  assert.match(out, /missing: .*app: 1 commits on no remote are not in the latest bundle/);
  assert.match(out, /missing: .*app: stash@\{0\} \(On main: second\) is in no bundle/);
  assert.doesNotMatch(out, /stash@\{1\}/, 'the entry the last run bundled is not named');
  assert.match(out, /missing: .*side: uncommitted edits the last backup does not hold/);
  assert.match(out, /missing: 1 files changed since the last backup: claude\/projects\/D--p\/memory\/MEMORY.md/);
  assert.match(out, /missing: .*app: records in .git\/js-harness changed since the last backup: js-harness\/codex-reviews.jsonl/);
  assert.match(out, /missing: Engram holds 3 observations, the last backup 2/);
  assert.match(out, /backup ready: no, 6 things have no copy off this machine/);
  assert.deepEqual({ home: snapshot(home), source: snapshot(path.join(source, '.git')) }, before, 'ready wrote nothing');
});

test('backup ready names a clone ahead of origin, a source with no remote and an untracked file too large to copy', async (t) => {
  const { root, deps, paths } = setup(t);
  const source = sourceRepo(path.join(root, 'local-only'));
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  spawnSync('git', ['-C', paths.clone, 'commit', '-q', '--allow-empty', '-m', 'here only'], { env: GIT_ENV });
  fs.writeFileSync(path.join(source, 'huge.bin'), Buffer.alloc(UNTRACKED_MAX_BYTES + 1));
  fs.writeFileSync(path.join(source, 'big.dat'), Buffer.from([0, 1]));
  fs.writeFileSync(path.join(source, 'kind.dat'), Buffer.from([0, 2]));
  spawnSync('git', ['-C', source, 'add', 'big.dat', 'kind.dat'], { env: GIT_ENV });
  spawnSync('git', ['-C', source, 'commit', '-q', '-m', 'big'], { env: GIT_ENV });
  fs.writeFileSync(path.join(source, 'big.dat'), Buffer.alloc(UNTRACKED_MAX_BYTES + 1));
  // A tracked binary file replaced by a folder is no deletion and no copy: it must still be named.
  fs.rmSync(path.join(source, 'kind.dat'));
  fs.mkdirSync(path.join(source, 'kind.dat'));
  deps.stdout = sink();

  assert.equal(await backupMain(['ready'], deps), 1);

  assert.match(deps.stdout.text, /missing: the backup clone is 1 commits ahead of origin/);
  assert.match(deps.stdout.text, /missing: .*local-only has no remote: its commits are in the bundle only/);
  assert.match(deps.stdout.text, /missing: .*huge\.bin: untracked, 5\.0 MB, too large to copy/);
  assert.match(deps.stdout.text, /missing: .*big\.dat: changed binary, 5\.0 MB, too large to copy/);
  assert.match(deps.stdout.text, /missing: .*kind\.dat: a binary file now a link or folder, not copied/);

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const manifest = JSON.parse(fs.readFileSync(path.join(paths.clone, 'manifest.json'), 'utf8'));
  const { worktrees } = manifest.bundles.find((b) => b.source === path.resolve(source));
  assert.deepEqual(worktrees, [], 'files too large to copy, or not files, are not counted as copied');
});

test('backup ready fails closed when git cannot count or read a source, and when the backup is not initialised', async (t) => {
  const { root, deps, paths } = setup(t);
  const source = sourceRepo(path.join(root, 'src'));
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const run = deps.run;
  const failing = (what) => (cmd, args, options) =>
    cmd === 'git' && args[1] === source && args.includes(what) ? { status: 128, stdout: '', stderr: 'fatal' } : run(cmd, args, options);

  deps.run = failing('rev-list');
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1, deps.stdout.text);
  assert.match(deps.stdout.text, /missing: .*src: git could not count its commits outside the bundle/);

  deps.run = failing('--git-common-dir');
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1, deps.stdout.text);
  assert.match(deps.stdout.text, /missing: .*src: its worktrees and records could not be read/);

  deps.run = run;
  fs.rmSync(paths.config);
  deps.stdout = sink();
  assert.equal(await backupMain(['ready'], deps), 1);
  assert.match(deps.stdout.text, /backup ready: no, the backup is not initialised/);
});

test('backup run never copies the file an untracked symlink points at', async (t) => {
  const { root, bare, deps, paths } = setup(t);
  const source = sourceRepo(path.join(root, 'src'));
  const outside = path.join(root, 'outside.txt');
  fs.writeFileSync(outside, 'private bytes from outside the checkout\n');
  try {
    fs.symlinkSync(outside, path.join(source, 'link.txt'), 'file');
  } catch {
    t.skip('this machine cannot create a symlink');
    return;
  }
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [source], scope: 'all' }));

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  const listed = defaultRun('git', ['--git-dir', bare, 'ls-tree', '-r', '--name-only', 'HEAD']).stdout;
  assert.ok(!listed.includes('link.txt'), listed);
  const all = defaultRun('git', ['--git-dir', bare, 'grep', '-l', 'private bytes', 'HEAD']).stdout;
  assert.equal(all, '');
});

test('backup init creates the repository private when it is missing, refuses a public one, and clones', async (t) => {
  const { paths, deps, state } = setup(t, { visibility: null });
  fs.rmSync(paths.clone, { recursive: true, force: true });

  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);
  assert.ok(state.calls.some((c) => c[0] === 'gh' && c[2] === 'create' && c.includes('--private')));
  assert.ok(fs.existsSync(path.join(paths.clone, '.git')));
  assert.equal(JSON.parse(fs.readFileSync(paths.config, 'utf8')).repo, REPO);
  const restore = fs.readFileSync(path.join(paths.clone, 'RESTORE.md'), 'utf8');
  assert.ok(restore.includes(`backup restore --from https://github.com/${REPO}.git\``), 'the steps travel with the backup');
  assert.ok(!restore.includes('%USERPROFILE%'), 'PowerShell does not expand %VAR%, so the steps name no home');
  assert.ok(restore.indexOf('backup restore') < restore.indexOf('js-harness.mjs install'), 'restore comes before install, so no hook backs up an empty memory');

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

/** A repository standing for the public one: a bare remote and a clone with a roadmap and one feature on main. */
test('the public summary is opt-in: init names a summary repository only when --summary-repo says so', async (t) => {
  const { root, paths, deps, state } = setup(t);
  const { bare, work } = summarySource(root);
  state.summaryRepo = work;
  const summaryRepo = () => JSON.parse(fs.readFileSync(paths.config, 'utf8')).summaryRepo;

  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);
  assert.equal(summaryRepo(), undefined, 'a push to a public repository is never a default');
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(defaultRun('git', ['--git-dir', bare, 'rev-parse', '-q', '--verify', 'refs/heads/memory-summary']).status, 1, 'nothing public pushed');

  deps.stdout = sink();
  assert.equal(await backupMain(['summary', '--summary-repo', work], deps), 0, deps.stderr.text);
  assert.match(deps.stdout.text, /^# js-harness memory summary$/m, 'the summary can be read before anyone opts in');

  state.summaryUrls = ['https://github.com/someone/fork.git'];
  assert.equal(await backupMain(['init', '--repo', REPO, '--summary-repo', work], deps), 1);
  assert.match(deps.stderr.text, /someone\/fork/);

  state.summaryUrls = ['https://github.com/jsaristi/js-harness.git'];
  assert.equal(await backupMain(['init', '--repo', REPO, '--summary-repo', work], deps), 0, deps.stderr.text);
  assert.equal(summaryRepo(), path.resolve(work));
});

function summarySource(root) {
  const bare = path.join(root, 'public.git');
  const work = path.join(root, 'source');
  const run = (args) => {
    const result = spawnSync('git', args, { env: GIT_ENV, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  run(['init', '-q', '--bare', '-b', 'main', bare]);
  run(['clone', '-q', bare, work]);
  fs.mkdirSync(path.join(work, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(work, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(work, 'docs', 'ROADMAP.md'), '## Checklist\n### Memory\n- [x] Design\n- [ ] Restore proven\n');
  fs.writeFileSync(path.join(work, 'odd', 'tasks', 'memory-backup.md'), '# M\n\n## Goal\nIt survives. More.\n\n## Tasks\n- [ ] T5 summary\n');
  run(['-C', work, 'add', '-A']);
  run(['-C', work, 'commit', '-q', '-m', 'main']);
  run(['-C', work, 'push', '-q', 'origin', 'HEAD:main']);
  run(['-C', work, 'fetch', '-q', 'origin']);
  return { bare, work };
}

test('backup summary prints the summary of origin/main without pushing it', async (t) => {
  const { root, paths, deps } = setup(t);
  const { bare, work } = summarySource(root);
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], scope: 'all', summaryRepo: work }));
  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'clientproject\n');

  assert.equal(await backupMain(['summary'], deps), 0, deps.stderr.text);

  assert.match(deps.stdout.text, /^# js-harness memory summary$/m);
  assert.match(deps.stdout.text, /^- Memory: 1\/2 \(50%\)$/m);
  assert.match(deps.stdout.text, /^- memory-backup: It survives\. Next: T5 summary$/m);
  assert.equal(defaultRun('git', ['--git-dir', bare, 'rev-parse', '--verify', '-q', 'refs/heads/memory-summary']).status, 1, 'nothing pushed');
});

test('backup run pushes the summary to memory-summary at most daily, one orphan commit, guarded, never failing the run', async (t) => {
  const { root, paths, deps, state } = setup(t);
  const { bare, work } = summarySource(root);
  state.summaryRepo = work;
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], scope: 'all', summaryRepo: work }));
  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'clientproject\n');
  const branch = () => defaultRun('git', ['--git-dir', bare, 'rev-parse', '-q', '--verify', 'refs/heads/memory-summary']).stdout.trim();
  const last = () => JSON.parse(fs.readFileSync(paths.last, 'utf8'));
  const changeMain = (line) => {
    fs.appendFileSync(path.join(work, 'docs', 'ROADMAP.md'), `${line}\n`);
    for (const args of [['add', '-A'], ['commit', '-q', '-m', line], ['push', '-q', 'origin', 'HEAD:main']]) {
      assert.equal(spawnSync('git', ['-C', work, ...args], { env: GIT_ENV }).status, 0);
    }
  };

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const first = branch();
  assert.ok(first, 'the branch was pushed');
  assert.match(defaultRun('git', ['--git-dir', bare, 'show', 'memory-summary:SUMMARY.md']).stdout, /^# js-harness memory summary$/m);
  assert.equal(defaultRun('git', ['--git-dir', bare, 'rev-list', '--count', 'memory-summary']).stdout.trim(), '1', 'an orphan commit');
  assert.equal(last().lastSummary.commit, first);

  changeMain('- [ ] Next day');
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(branch(), first, 'less than a day later nothing is pushed');

  state.now += 24 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const second = branch();
  assert.notEqual(second, first, 'a day later main fetched anew and the summary replaced');
  assert.match(defaultRun('git', ['--git-dir', bare, 'show', 'memory-summary:SUMMARY.md']).stdout, /^- Memory: 1\/3 \(33%\)$/m);
  assert.equal(defaultRun('git', ['--git-dir', bare, 'rev-list', '--count', 'memory-summary']).stdout.trim(), '1');

  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(branch(), second, 'an unchanged summary is not pushed again');

  defaultRun('git', ['--git-dir', bare, 'update-ref', '-d', 'refs/heads/memory-summary']);
  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  const third = branch();
  assert.ok(third, 'unchanged here, but gone from the remote: pushed again');

  changeMain('- [ ] Elsewhere');
  state.summaryUrls = ['https://github.com/jsaristi/js-harness.git', 'https://github.com/someone/fork.git'];
  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, 'a refused summary never fails the backup');
  assert.equal(branch(), third);
  assert.match(last().summaryError.error, /someone\/fork/);

  state.summaryUrls = ['https://github.com/jsaristi/js-harness.git'];
  fs.rmSync(path.join(paths.clone, 'private-terms.txt'));
  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0);
  assert.equal(branch(), third, 'no terms list, no summary');
  assert.match(last().summaryError.error, /private-terms\.txt/);
  assert.equal(await backupMain(['status'], deps), 0);
  assert.match(deps.stdout.text, new RegExp(`^summary: last pushed ${last().lastSummary.pushedAt}, ${third.slice(0, 8)}; last refused .*private-terms\\.txt`, 'm'));

  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'clientproject\n');
  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.notEqual(branch(), third);
  deps.stdout = sink();
  assert.equal(await backupMain(['status'], deps), 0);
  assert.match(deps.stdout.text, /^summary: last pushed [^;]*$/m, 'a refusal older than the last push is not shown');
});

test('backup init writes no private-terms.txt when engram cannot list the projects, and says so', async (t) => {
  const { paths, deps } = setup(t);
  fs.rmSync(paths.clone, { recursive: true, force: true });
  const run = deps.run;
  deps.run = (cmd, args, options) =>
    cmd === 'engram' && args[0] === 'stats' ? { status: 1, stdout: '', stderr: 'engram: database locked' } : run(cmd, args, options);

  assert.equal(await backupMain(['init', '--repo', REPO], deps), 0, deps.stderr.text);
  assert.equal(fs.existsSync(path.join(paths.clone, 'private-terms.txt')), false, 'an empty list would let the summary through unchecked');
  assert.match(deps.stderr.text, /private-terms\.txt.*database locked/);
});

test('backup verify --from proves a pushed backup, and backup restore puts it into a new home', async (t) => {
  const { root, bare, deps } = setup(t);
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.equal(await backupMain(['verify', '--from', bare], deps), 0, deps.stdout.text + deps.stderr.text);
  assert.match(deps.stdout.text, /^ok observations: 2 restored, 2 backed up, 2 live$/m);
  assert.match(deps.stdout.text, /^ok files: \d+ of \d+ byte for byte$/m);

  const home = path.join(root, 'new-home');
  assert.equal(await backupMain(['restore', '--from', bare, '--home', home, '--map', 'D:\\p=E:\\q'], deps), 0, deps.stderr.text);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'projects', 'E--q', 'memory', 'MEMORY.md'), 'utf8'), '- a note\n');
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 2);
  assert.equal(await backupMain(['restore', '--from', bare, '--home', home], deps), 0, 'running the same restore again is safe');
  assert.match(deps.stdout.text, /this backup was already imported/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 2, 'and does not double the memories');
  assert.equal(await backupMain(['restore', '--home', home], deps), 2);

  assert.equal(await backupMain(['restore', '--from', bare, '--home', home, '--map', 'D:\\p'], deps), 2, 'a --map with no = is refused, not dropped');
  assert.match(deps.stderr.text, /--map needs <old path>=<new path>/);

  assert.equal(await backupMain(['restore', '--from', bare, '--home', '--merge'], deps), 2, 'a flag is no value');
  assert.match(deps.stderr.text, /--home needs a value/);
  assert.ok(!fs.existsSync(path.resolve('--merge')), 'nothing is written under a folder named --merge');

  assert.equal(await backupMain(['restore', '--from', bare, '--home', '%USERPROFILE%'], deps), 2, 'an unexpanded variable is no home');
  assert.match(deps.stderr.text, /--home %USERPROFILE% was not expanded by the shell/);
  assert.ok(!fs.existsSync(path.resolve('%USERPROFILE%')), 'nothing is written under a literal %USERPROFILE%');

  const fresh = path.join(root, 'fresh-home');
  assert.equal(await backupMain(['restore', '--from', bare], { ...deps, home: fresh }), 0, deps.stderr.text);
  assert.equal(JSON.parse(fs.readFileSync(path.join(fresh, '.engram', 'db.json'), 'utf8')).observations.length, 2, 'with no --home the restore goes into this user\'s home');
});

test('backup verify --summary reads the memory-summary branch of a repository', async (t) => {
  const { root, paths, deps, state } = setup(t);
  const { bare, work } = summarySource(root);
  state.summaryRepo = work;
  fs.writeFileSync(paths.config, JSON.stringify({ repo: REPO, bundles: [], scope: 'all', summaryRepo: work }));
  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'clientproject\n');
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);

  assert.equal(await backupMain(['verify', '--summary', bare], deps), 0, deps.stdout.text + deps.stderr.text);
  assert.match(deps.stdout.text, /^ok sections: /m);
  assert.match(deps.stdout.text, /^ok privacy: 0 lines/m);

  fs.writeFileSync(path.join(paths.clone, 'private-terms.txt'), 'memory\n');
  assert.equal(await backupMain(['verify', '--summary', bare], deps), 1, 'a line naming a private term fails it');
});

test('backupHealth: n/a before init, stale with its reason when no success in a day, ok after one', async (t) => {
  const { home, paths, deps, state } = setup(t);
  assert.equal(backupHealth(path.join(home, 'nowhere'), state.now).state, 'n/a');
  const never = backupHealth(home, state.now);
  assert.equal(never.state, 'stale');
  assert.match(never.fix[0], /last success never.*js-harness backup status/);

  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  assert.equal(backupHealth(home, state.now).state, 'ok');
  state.visibility = 'PUBLIC';
  fs.appendFileSync(path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), '- more\n');
  state.now += 25 * 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 1);
  const stopped = backupHealth(home, state.now);
  assert.equal(stopped.state, 'stale');
  assert.match(stopped.fix[0], /last failure .*PUBLIC/);
  assert.ok(fs.existsSync(paths.last));
});

test('backupHealth is stale when a failure came after the last success, or the clone is gone, within the day', async (t) => {
  const { home, paths, deps, state } = setup(t);
  assert.equal(await backupMain(['run'], deps), 0, deps.stderr.text);
  state.visibility = 'PUBLIC';
  fs.appendFileSync(path.join(home, '.claude', 'projects', 'D--p', 'memory', 'MEMORY.md'), '- more\n');
  state.now += 60 * 60_000;
  assert.equal(await backupMain(['run'], deps), 1);
  const failing = backupHealth(home, state.now);
  assert.equal(failing.state, 'stale', 'an hour-old success does not hide a newer failure');
  assert.match(failing.fix[0], /last failure .*PUBLIC/);

  const last = JSON.parse(fs.readFileSync(paths.last, 'utf8'));
  delete last.lastFailure;
  fs.writeFileSync(paths.last, JSON.stringify(last));
  assert.equal(backupHealth(home, state.now).state, 'ok');
  fs.rmSync(paths.clone, { recursive: true, force: true });
  const gone = backupHealth(home, state.now);
  assert.equal(gone.state, 'stale');
  assert.match(gone.fix[0], /clone .* is gone/);
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
