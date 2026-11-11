// Closing the finished background sessions (odd/tasks/sessions-close-themselves.md): against a real git repository in a
// temp folder, since what is held here is what git removes and what it refuses, and a `claude` that only logs its calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appendRecord, finishedOf, readRecord } from './background.mjs';
import { closeFinished } from './background-close.mjs';

const HOUR = 60 * 60_000;

/** A temp machine: a harness home and a repository whose `origin/main` is its `main`, with claude's settings copy
 * ignored as this repository ignores it. `claude` logs each call and answers 0; `gitIn` logs each call and runs git. */
function makeWorld() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-close-')));
  const world = { dir, home: path.join(dir, 'home'), root: path.join(dir, 'proj'), claudeCalls: [], gitCalls: [], refuse: {} };
  fs.mkdirSync(world.home);
  fs.mkdirSync(path.join(world.root, '.claude'), { recursive: true });
  world.git = (cwd, ...args) => {
    const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  world.git(world.root, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(world.root, '.gitignore'), '.claude/settings.local.json\nevals/runs/\n');
  fs.writeFileSync(path.join(world.root, '.claude', 'settings.json'), '{}\n');
  world.git(world.root, 'add', '.');
  world.git(world.root, 'commit', '-q', '-m', 'init');
  world.gitIn = (cwd, ...args) => {
    world.gitCalls.push(args);
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return { ok: result.status === 0, out: String(result.stdout ?? ''), err: String(result.stderr ?? '').trim() };
  };
  world.claude = (args) => {
    world.claudeCalls.push(args);
    const said = world.refuse[args[0]];
    return said ? { status: 1, stdout: said, stderr: '' } : { status: 0, stdout: `${args[0]} ${args[1]}`, stderr: '' };
  };
  return world;
}

/** A recorded session `id` with a worktree of its own, as `sessions start --worktree` leaves one once its work is in
 * main: a branch with a commit main holds, claude's settings copy in it, an index that stood still for an hour. */
function startSession(world, id, { worktree = id, landed = true, title = `JH 1 · ${id}`, resumedFrom } = {}) {
  const entry = { event: 'started', at: new Date(Date.now() - 3 * HOUR).toISOString(), id, sessionId: `${id}-0000-4000-8000-000000000000`, title, root: world.root, cwd: world.root, worktree: null, worktreePath: null, brief: path.join(world.dir, `${id}.md`), ...(resumedFrom ? { resumedFrom } : {}) };
  fs.writeFileSync(entry.brief, 'brief\n');
  if (worktree !== null) {
    const place = path.join(world.root, '.claude', 'worktrees', worktree);
    if (!fs.existsSync(place)) {
      world.git(world.root, 'worktree', 'add', '-q', '-b', `feat/${worktree}`, place);
      fs.writeFileSync(path.join(place, `${worktree}.txt`), 'work\n');
      world.git(place, 'add', '.');
      world.git(place, 'commit', '-q', '-m', `work of ${worktree}`);
      fs.writeFileSync(path.join(place, '.claude', 'settings.local.json'), '{"permissions":{}}\n');
      if (landed) world.git(world.root, 'merge', '-q', '--ff-only', `feat/${worktree}`);
      rest(world, place);
    }
    Object.assign(entry, { worktree, worktreePath: place });
  }
  world.git(world.root, 'update-ref', 'refs/remotes/origin/main', 'main');
  appendRecord(world.home, entry);
  return entry;
}

/** The index of the worktree at `place` last changed an hour ago. */
function rest(world, place) {
  const index = path.resolve(place, world.git(place, 'rev-parse', '--git-path', 'index'));
  const old = new Date(Date.now() - HOUR);
  fs.utimesSync(index, old, old);
}

const notice = (entry, kind, minutesAgo) => ({ kind, at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), from: { id: entry.sessionId, title: entry.title } });

const close = (world, notices) => closeFinished({ home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices, agents: [], gitIn: world.gitIn, claude: world.claude });

const open = (world) => readRecord(world.home).sessions.map((entry) => entry.id);

function withWorld(body) {
  return () => {
    const world = makeWorld();
    try {
      body(world);
    } finally {
      fs.rmSync(world.dir, { recursive: true, force: true });
    }
  };
}

test('a session is finished when the newest notice of its state is closed, whichever job of it sent it', withWorld((world) => {
  const done = startSession(world, 'aaaa1111');
  const again = startSession(world, 'bbbb2222');
  const silent = startSession(world, 'cccc3333');
  const first = startSession(world, 'dddd4444');
  const copy = startSession(world, 'eeee5555', { worktree: 'dddd4444', resumedFrom: 'dddd4444' });
  const other = { ...startSession(world, 'ffff6666', { worktree: null }), root: path.join(world.dir, 'elsewhere') };
  appendRecord(world.home, { ...other, id: 'ffff7777' });
  const notices = [
    notice(done, 'opened', 90), notice(done, 'ready', 60), notice(done, 'closed', 50), notice(done, 'note', 10),
    // Asked for more after it closed: it sent ready again, so it is not finished.
    notice(again, 'closed', 50), notice(again, 'ready', 20),
    notice(first, 'closed', 40),
    { ...notice(other, 'closed', 30), from: { id: 'ffff7777' } },
  ];
  const found = finishedOf(readRecord(world.home), notices, world.root);
  // The job that resumed another stands for both; the one that sent nothing, and another project's, are left out.
  assert.deepEqual(found.map((item) => [item.entry.id, item.chain.map((job) => job.id)]), [['aaaa1111', ['aaaa1111']], [copy.id, [copy.id, first.id]]]);
  assert.equal(found[0].closedAt, notices[2].at);
  assert.ok(!found.some((item) => item.entry.id === silent.id));
}));

// A finished session idles in its worktree (JH 171 on 2026-11-11: status idle, state done, a pid), and Windows deletes
// no folder a process stands in: its process ends first, by claude stop, which deletes nothing.
test('closeFinished ends the job\'s process, removes the worktree with git and no --force, then the job with claude, and keeps the branch', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const order = [];
  let looks = 0;
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)],
    agents: [{ id: 'aaaa1111', kind: 'background', pid: 4242, status: 'idle', state: 'done' }],
    gitIn: (cwd, ...args) => { if (args[1] === 'remove') order.push('git worktree remove'); return world.gitIn(cwd, ...args); },
    claude: (args) => { order.push(`claude ${args[0]}`); return world.claude(args); },
    alive: () => { order.push('look'); looks += 1; return looks < 3; },
    pause: () => {},
  });
  assert.deepEqual(result.kept, []);
  assert.deepEqual(result.closed.map((item) => [item.entry.id, item.worktree, item.jobs]), [['aaaa1111', entry.worktreePath, 1]]);
  assert.equal(fs.existsSync(entry.worktreePath), false);
  assert.deepEqual(order, ['claude stop', 'look', 'look', 'look', 'git worktree remove', 'claude stop', 'claude rm']);
  assert.deepEqual(world.claudeCalls, [['stop', 'aaaa1111'], ['stop', 'aaaa1111'], ['rm', 'aaaa1111']]);
  const removal = world.gitCalls.find((args) => args[0] === 'worktree' && args[1] === 'remove');
  assert.deepEqual([removal.length, path.resolve(removal[2])], [3, path.resolve(entry.worktreePath)]);
  assert.ok(!world.gitCalls.flat().some((arg) => arg === '--force' || arg === '-f'), 'nothing is forced');
  assert.equal(world.git(world.root, 'branch', '--list', 'feat/aaaa1111').trim(), 'feat/aaaa1111');
  assert.deepEqual(open(world), []);
  assert.equal(fs.existsSync(entry.brief), false);
}));

test('closeFinished leaves the worktree while the job\'s process still runs or claude will not stop it', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const agents = [{ id: 'aaaa1111', kind: 'background', pid: 4242, status: 'idle', state: 'done' }];
  let clock = 0;
  const given = { home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)], agents, gitIn: world.gitIn, claude: world.claude };
  const running = closeFinished({ ...given, now: () => Date.now() + clock, alive: () => true, pause: (ms) => { clock += ms * 100; } });
  assert.deepEqual(running.closed, []);
  assert.match(running.kept[0].why, /stays: the process of aaaa1111, pid 4242, still ran \d+ s after claude stop/);
  assert.match(running.kept[0].settle, /js-harness sessions stop --finished tries again/);
  world.refuse.stop = 'stop: made up';
  // The first look ran git status with no GIT_OPTIONAL_LOCKS=0 (this world's git, not boundedGit), which rewrote the index.
  rest(world, entry.worktreePath);
  const refused = closeFinished({ ...given, alive: () => false, pause: () => {} });
  assert.match(refused.kept[0].why, /stays: claude stop aaaa1111: stop: made up/);
  assert.ok(!world.claudeCalls.some((args) => args[0] === 'rm'));
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
  assert.equal(fs.existsSync(path.join(entry.worktreePath, 'aaaa1111.txt')), true);
  assert.deepEqual(open(world), ['aaaa1111']);
}));

// What odd/tasks/stop-keeps-worktree.md and odd/tasks/land-unattended.md (L23) protect: nothing git would not bring back
// is deleted, an ignored file included, and no claude command runs while the worktree stands.
for (const [name, spoil, why] of [
  ['a changed file', (place) => fs.writeFileSync(path.join(place, 'aaaa1111.txt'), 'changed\n'), /holds what no branch brings back: M aaaa1111\.txt/],
  ['an untracked file', (place) => fs.writeFileSync(path.join(place, 'notes.md'), 'mine\n'), /holds what no branch brings back: \?\? notes\.md/],
  ['an ignored file that is not claude\'s', (place) => { fs.mkdirSync(path.join(place, 'evals', 'runs'), { recursive: true }); fs.writeFileSync(path.join(place, 'evals', 'runs', 'r.json'), '{}'); }, /holds what no branch brings back: !! evals\/$/],
  ['an index that changed a moment ago', (place, world) => { const index = path.resolve(place, world.git(place, 'rev-parse', '--git-path', 'index')); fs.utimesSync(index, new Date(), new Date()); }, /its index changed \d+ minutes? ago/],
  ['a lock', (place, world) => world.git(world.root, 'worktree', 'lock', place), /it is locked/],
]) {
  test(`closeFinished keeps a session whose worktree has ${name}, and runs no claude command`, withWorld((world) => {
    const entry = startSession(world, 'aaaa1111');
    spoil(entry.worktreePath, world);
    const before = fs.readdirSync(entry.worktreePath).sort();
    const result = close(world, [notice(entry, 'closed', 30)]);
    assert.deepEqual(result.closed, []);
    assert.equal(result.kept.length, 1);
    assert.match(result.kept[0].why, why);
    assert.match(result.kept[0].settle, /js-harness sessions stop aaaa1111 --remove-worktree/);
    assert.deepEqual(fs.readdirSync(entry.worktreePath).sort(), before);
    assert.deepEqual(world.claudeCalls, []);
    assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
    assert.deepEqual(open(world), ['aaaa1111']);
    assert.ok(fs.existsSync(entry.brief));
  }));
}

test('closeFinished keeps a session whose branch is not in main, one at work and one git will not remove', withWorld((world) => {
  const ahead = startSession(world, 'aaaa1111', { landed: false });
  const busy = startSession(world, 'bbbb2222');
  const stuck = startSession(world, 'cccc3333');
  const gitIn = (cwd, ...args) => (args[0] === 'worktree' && args[1] === 'remove' ? { ok: false, out: '', err: 'fatal: made up\nmore' } : world.gitIn(cwd, ...args));
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', gitIn, claude: world.claude,
    notices: [ahead, busy, stuck].map((entry) => notice(entry, 'closed', 30)),
    agents: [{ id: 'bbbb2222', kind: 'background', status: 'busy', state: 'working' }],
  });
  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.kept.map((item) => item.entry.id), ['aaaa1111', 'bbbb2222', 'cccc3333']);
  assert.match(result.kept[0].why, /its head is not in origin\/main/);
  assert.match(result.kept[1].why, /it is busy/);
  assert.equal(result.kept[1].settle, null);
  assert.match(result.kept[2].why, /git worktree remove refused: fatal: made up$/);
  assert.deepEqual(world.claudeCalls, []);
  assert.deepEqual(open(world), ['aaaa1111', 'bbbb2222', 'cccc3333']);
}));

test('closeFinished keeps the worktree the command runs from, and one git does not list', withWorld((world) => {
  const here = startSession(world, 'aaaa1111');
  const loose = startSession(world, 'bbbb2222', { worktree: null });
  const place = path.join(world.root, '.claude', 'worktrees', 'loose');
  fs.mkdirSync(place, { recursive: true });
  fs.writeFileSync(path.join(place, 'work.js'), 'x\n');
  appendRecord(world.home, { ...loose, worktree: 'loose', worktreePath: place });
  const result = closeFinished({ home: world.home, root: world.root, cwd: path.join(here.worktreePath, '.claude'), base: 'origin/main', notices: [notice(here, 'closed', 30), notice(loose, 'closed', 30)], agents: [], gitIn: world.gitIn, claude: world.claude });
  assert.deepEqual(result.closed, []);
  assert.match(result.kept[0].why, /this command runs from its worktree/);
  assert.match(result.kept[1].why, /git lists no worktree at /);
  assert.deepEqual(world.claudeCalls, []);
  assert.equal(fs.readFileSync(path.join(place, 'work.js'), 'utf8'), 'x\n');
}));

test('closeFinished closes a session with no worktree, one whose worktree is gone and a resumed one with the job it resumed', withWorld((world) => {
  const plain = startSession(world, 'aaaa1111', { worktree: null });
  const gone = startSession(world, 'bbbb2222');
  world.git(world.root, 'worktree', 'remove', gone.worktreePath);
  const first = startSession(world, 'cccc3333');
  startSession(world, 'dddd4444', { worktree: 'cccc3333', resumedFrom: 'cccc3333' });
  const result = close(world, [plain, gone, first].map((entry) => notice(entry, 'closed', 30)));
  assert.deepEqual(result.kept, []);
  assert.deepEqual(result.closed.map((item) => [item.entry.id, item.worktree, item.jobs]), [['aaaa1111', null, 1], ['bbbb2222', null, 1], ['dddd4444', first.worktreePath, 2]]);
  assert.deepEqual(world.claudeCalls.slice(-4), [['stop', 'dddd4444'], ['rm', 'dddd4444'], ['stop', 'cccc3333'], ['rm', 'cccc3333']]);
  assert.deepEqual(open(world), []);
  assert.equal(world.gitCalls.filter((args) => args[0] === 'worktree' && args[1] === 'remove').length, 1);
}));

test('closeFinished says so when claude keeps the job after its worktree went, and touches no session that is not finished', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const waiting = startSession(world, 'bbbb2222');
  world.refuse.rm = 'kept aaaa1111: made up';
  const result = close(world, [notice(entry, 'closed', 30), notice(waiting, 'waiting', 30)]);
  assert.deepEqual(result.closed, []);
  assert.equal(result.kept.length, 1);
  assert.match(result.kept[0].why, /claude rm aaaa1111: kept aaaa1111: made up/);
  assert.match(result.kept[0].why, /its worktree .* was removed/);
  assert.match(result.kept[0].settle, /js-harness sessions stop aaaa1111$/);
  assert.equal(fs.existsSync(waiting.worktreePath), true);
  assert.deepEqual(open(world), ['aaaa1111', 'bbbb2222']);
}));

test('closeFinished closes nothing when git cannot list the worktrees', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const gitIn = (cwd, ...args) => (args[0] === 'worktree' && args[1] === 'list' ? { ok: false, out: '', err: 'fatal: made up' } : world.gitIn(cwd, ...args));
  const result = closeFinished({ home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)], agents: [], gitIn, claude: world.claude });
  assert.deepEqual(result.closed, []);
  assert.match(result.kept[0].why, /git could not list the worktrees/);
  assert.deepEqual(world.claudeCalls, []);
  assert.equal(fs.existsSync(entry.worktreePath), true);
}));
