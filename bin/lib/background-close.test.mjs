// Closing the finished background sessions (odd/tasks/sessions-close-themselves.md): against a real git repository in a
// temp folder, since what is held here is what git removes and what it refuses, and a `claude` that only logs its calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appendRecord, backgroundLines, boardBackground, finishedHere, finishedOf, readRecord, recordFileOf } from './background.mjs';
import { REMOVAL_WAIT_MS, closeAfterLand, closeFinished, closeFinishedIn, closedLines, finishedIn } from './background-close.mjs';
import { NOTICE_SCHEMA, recordPath } from './channel.mjs';
import { projectSlug } from './sessions.mjs';

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
    // No optional locks, as `boundedGit` asks: a git status that rewrote the index would make the next look find it fresh.
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
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
function startSession(world, id, { worktree = id, landed = true, title = `JH 1 · ${id}`, resumedFrom, cwd = world.root } = {}) {
  const entry = { event: 'started', at: new Date(Date.now() - 3 * HOUR).toISOString(), id, sessionId: `${id}-0000-4000-8000-000000000000`, title, root: world.root, cwd, worktree: null, worktreePath: null, brief: path.join(world.dir, `${id}.md`), ...(resumedFrom ? { resumedFrom } : {}) };
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
  assert.equal(running.kept[0].stopped, true);
  assert.match(closedLines(running).join('\n'), /claude stop was sent to its job before that, which deletes nothing; js-harness sessions start --resume aaaa1111 resumes it/);
  world.refuse.stop = 'stop: made up';
  const refused = closeFinished({ ...given, alive: () => false, pause: () => {} });
  assert.match(refused.kept[0].why, /stays: claude stop aaaa1111: stop: made up/);
  assert.ok(!world.claudeCalls.some((args) => args[0] === 'rm'));
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
  assert.equal(fs.existsSync(path.join(entry.worktreePath, 'aaaa1111.txt')), true);
  assert.deepEqual(open(world), ['aaaa1111']);
}));

/** claude's lock on the worktree of `entry`, as it reads on every worktree a background job runs in. */
const claudeLock = (world, entry, pid) => world.git(world.root, 'worktree', 'lock', '--reason', `claude session ${path.basename(entry.worktreePath)} (pid ${pid})`, entry.worktreePath);

// The independent verifier, 2026-11-11: claude locks the worktree of every job it runs there, and the lock is there
// while a session that said closed idles (JH 174 and JH 175 that day), so a rule that kept every locked worktree closed
// no session until the machine restarted. The lock of the session's own job is what claude stop is sent to end.
test('closeFinished closes a session whose worktree claude locked for its own job, and unlocks it only once that process has ended', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const stale = startSession(world, 'bbbb2222');
  claudeLock(world, entry, 4242);
  // A lock whose process is gone and that no listed job holds: a job that died with the lock in place.
  claudeLock(world, stale, 7777);
  const running = new Set([4242]);
  const order = [];
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [entry, stale].map((item) => notice(item, 'closed', 30)),
    agents: [{ id: 'aaaa1111', kind: 'background', pid: 4242, status: 'idle', state: 'done' }],
    gitIn: (cwd, ...args) => { if (args[0] === 'worktree' && args[1] !== 'list') order.push(`git worktree ${args[1]}`); return world.gitIn(cwd, ...args); },
    claude: (args) => { order.push(`claude ${args[0]} ${args[1]}`); if (args[0] === 'stop') running.delete(4242); return world.claude(args); },
    alive: (pid) => running.has(pid),
    pause: () => {},
  });
  assert.deepEqual(result.kept, []);
  assert.deepEqual(order, [
    'claude stop aaaa1111', 'git worktree unlock', 'git worktree remove', 'claude stop aaaa1111', 'claude rm aaaa1111',
    'git worktree unlock', 'git worktree remove', 'claude stop bbbb2222', 'claude rm bbbb2222',
  ]);
  assert.deepEqual([fs.existsSync(entry.worktreePath), fs.existsSync(stale.worktreePath)], [false, false]);
  assert.ok(!world.gitCalls.flat().some((arg) => arg === '--force' || arg === '-f'), 'nothing is forced');
}));

test('closeFinished keeps a worktree claude locked for a process that runs and is no job of the session, and one locked anew while its job was stopped', withWorld((world) => {
  const foreign = startSession(world, 'aaaa1111');
  const woken = startSession(world, 'bbbb2222');
  claudeLock(world, foreign, 5555);
  claudeLock(world, woken, 4242);
  const running = new Set([5555, 4242]);
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [foreign, woken].map((item) => notice(item, 'closed', 30)), gitIn: world.gitIn,
    agents: [{ id: 'bbbb2222', kind: 'background', pid: 4242, status: 'idle', state: 'done' }],
    // A message woke the session between the stop and the removal: claude runs it anew and locks its worktree again.
    claude: (args) => {
      if (args[0] === 'stop') {
        running.delete(4242);
        running.add(6666);
        world.git(world.root, 'worktree', 'unlock', woken.worktreePath);
        claudeLock(world, woken, 6666);
      }
      return world.claude(args);
    },
    alive: (pid) => running.has(pid),
    pause: () => {},
  });
  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.kept.map((item) => [item.entry.id, item.why, item.stopped === true]), [
    ['aaaa1111', `its worktree ${foreign.worktreePath} stays: it is locked: claude session aaaa1111 (pid 5555)`, false],
    ['bbbb2222', `its worktree ${woken.worktreePath} stays: it is locked: claude session bbbb2222 (pid 6666)`, true],
  ]);
  assert.match(result.kept[0].settle, /js-harness sessions stop --finished tries again/);
  assert.deepEqual(world.claudeCalls, [['stop', 'bbbb2222']]);
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
  assert.deepEqual([fs.existsSync(foreign.worktreePath), fs.existsSync(woken.worktreePath)], [true, true]);
}));

// JH 155 stood in the worktree of another session on 2026-11-11: a job that is not the session's own is not stopped
// here, and no folder is removed from under one.
test('closeFinished keeps a session while a job that is not its own stands in its worktree, at work or with a process that runs', withWorld((world) => {
  const first = startSession(world, 'aaaa1111');
  const second = startSession(world, 'bbbb2222');
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [first, second].map((item) => notice(item, 'closed', 30)), gitIn: world.gitIn, claude: world.claude,
    agents: [
      { id: 'cccc3333', name: 'JH 2 · guest', kind: 'background', cwd: path.join(first.worktreePath, '.claude'), status: 'busy', state: 'working' },
      { id: 'dddd4444', kind: 'background', cwd: second.worktreePath, pid: 9999, status: 'idle', state: 'done' },
      { id: 'eeee5555', kind: 'background', cwd: world.root, pid: 9998, status: 'busy', state: 'working' },
    ],
    alive: (pid) => pid === 9999,
    pause: () => {},
  });
  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.kept.map((item) => [item.entry.id, item.why]), [
    ['aaaa1111', `another job, cccc3333 · JH 2 · guest, stands in its worktree ${first.worktreePath}`],
    ['bbbb2222', `another job, dddd4444, stands in its worktree ${second.worktreePath}`],
  ]);
  assert.match(result.kept[0].settle, /js-harness sessions stop --finished tries again/);
  assert.deepEqual(world.claudeCalls, []);
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
}));

test('closeFinished reads claude\'s listing again after the wait for its job, and keeps a session a message woke meanwhile', withWorld((world) => {
  const woken = startSession(world, 'aaaa1111');
  const blind = startSession(world, 'bbbb2222');
  const idle = (id) => ({ id, kind: 'background', pid: 4242, status: 'idle', state: 'done' });
  let lists = 0;
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [woken, blind].map((item) => notice(item, 'closed', 30)), gitIn: world.gitIn, claude: world.claude,
    agents: [idle('aaaa1111'), idle('bbbb2222')],
    // After the first stop the session is at work again; before the second session it reads idle; after its stop it fails.
    list: () => {
      lists += 1;
      if (lists === 1) return [{ ...idle('aaaa1111'), status: 'busy', state: 'working' }, idle('bbbb2222')];
      if (lists === 2) return [idle('bbbb2222')];
      throw new Error('claude agents: made up');
    },
    alive: () => false,
    pause: () => {},
  });
  assert.deepEqual(result.closed, []);
  assert.deepEqual(result.kept.map((item) => [item.entry.id, item.why, item.stopped]), [
    ['aaaa1111', `its worktree ${woken.worktreePath} stays: it is busy again, after claude stop was sent to its job`, true],
    ['bbbb2222', `its worktree ${blind.worktreePath} stays: whether it went back to work cannot be told (claude agents: made up)`, true],
  ]);
  assert.deepEqual(world.claudeCalls, [['stop', 'aaaa1111'], ['stop', 'bbbb2222']]);
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
}));

// What odd/tasks/stop-keeps-worktree.md and odd/tasks/land-unattended.md (L23) protect: nothing git would not bring back
// is deleted, an ignored file included, and no claude command runs while the worktree stands. What time or an unlock
// settles is tried again; what holds files is looked at by hand.
const BY_HAND = /js-harness sessions stop aaaa1111 --remove-worktree/;
const TRY_AGAIN = /js-harness sessions stop --finished tries again/;
for (const [name, spoil, why, settle] of [
  ['a changed file', (place) => fs.writeFileSync(path.join(place, 'aaaa1111.txt'), 'changed\n'), /holds what no branch brings back: M aaaa1111\.txt/, BY_HAND],
  ['an untracked file', (place) => fs.writeFileSync(path.join(place, 'notes.md'), 'mine\n'), /holds what no branch brings back: \?\? notes\.md/, BY_HAND],
  ['an ignored file that is not claude\'s', (place) => { fs.mkdirSync(path.join(place, 'evals', 'runs'), { recursive: true }); fs.writeFileSync(path.join(place, 'evals', 'runs', 'r.json'), '{}'); }, /holds what no branch brings back: !! evals\/$/, BY_HAND],
  ['an index that changed a moment ago', (place, world) => { const index = path.resolve(place, world.git(place, 'rev-parse', '--git-path', 'index')); fs.utimesSync(index, new Date(), new Date()); }, /its index changed \d+ minutes? ago/, TRY_AGAIN],
  ['a lock put by hand', (place, world) => world.git(world.root, 'worktree', 'lock', '--reason', 'mine, keep', place), /it is locked: mine, keep$/, TRY_AGAIN],
  ['a lock with no reason', (place, world) => world.git(world.root, 'worktree', 'lock', place), /it is locked$/, TRY_AGAIN],
]) {
  test(`closeFinished keeps a session whose worktree has ${name}, and runs no claude command`, withWorld((world) => {
    const entry = startSession(world, 'aaaa1111');
    spoil(entry.worktreePath, world);
    const before = fs.readdirSync(entry.worktreePath).sort();
    const result = close(world, [notice(entry, 'closed', 30)]);
    assert.deepEqual(result.closed, []);
    assert.equal(result.kept.length, 1);
    assert.match(result.kept[0].why, why);
    assert.match(result.kept[0].settle, settle);
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

// JH 155 on 2026-11-11: no worktree in the record, and its job stood in the worktree of another session, full of files.
// The guard of `sessions stop` looks only at the recorded worktree, so claude rm would have run with nobody looking.
test('closeFinished keeps a session with no worktree of its own whose job stands in another folder that holds files, and closes it once that folder holds none', withWorld((world) => {
  const startedIn = path.join(world.dir, 'started-in');
  const listedIn = path.join(world.dir, 'listed-in');
  for (const folder of [startedIn, listedIn]) {
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'notes.txt'), 'work\n');
  }
  const started = startSession(world, 'aaaa1111', { worktree: null, cwd: startedIn });
  const listed = startSession(world, 'bbbb2222', { worktree: null });
  // A folder that cannot be read is not one that holds nothing: here, a path that is no folder at all.
  const unread = path.join(world.dir, 'no-folder');
  fs.writeFileSync(unread, 'x\n');
  const blind = startSession(world, 'cccc3333', { worktree: null, cwd: unread });
  const agents = [{ id: 'zzzz9999', sessionId: listed.sessionId, state: 'done', cwd: listedIn }];
  const notices = [started, listed, blind].map((entry) => notice(entry, 'closed', 30));
  const run = () => closeFinished({ home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices, agents, gitIn: world.gitIn, claude: world.claude });
  const first = run();
  assert.deepEqual(first.closed, []);
  assert.deepEqual(world.claudeCalls, [], 'claude was asked nothing');
  assert.deepEqual(first.kept.map((item) => item.entry.id), ['aaaa1111', 'bbbb2222', 'cccc3333']);
  assert.ok(first.kept[2].why.includes(`its job stands in ${unread}`), first.kept[2].why);
  fs.rmSync(unread);
  assert.ok(first.kept[0].why.includes(`its job stands in ${startedIn}, which is not the main checkout and holds files`), first.kept[0].why);
  assert.ok(first.kept[1].why.includes(`its job stands in ${listedIn}`), first.kept[1].why);
  assert.equal(first.kept[0].settle, 'once nothing there is needed, js-harness sessions stop aaaa1111 removes its job and leaves that folder to you');
  assert.deepEqual(open(world), ['aaaa1111', 'bbbb2222', 'cccc3333']);
  // A land removed the worktree it stood in, and the folder stays empty under the job: nothing is left to lose.
  fs.rmSync(path.join(startedIn, 'notes.txt'));
  fs.rmSync(listedIn, { recursive: true });
  const second = run();
  assert.deepEqual(second.kept, []);
  assert.deepEqual(second.closed.map((item) => item.entry.id), ['aaaa1111', 'bbbb2222', 'cccc3333']);
}));

test('closeFinished keeps the job when git says it removed the worktree and the folder still holds files', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const result = closeFinished({ home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)], agents: [], gitIn: world.gitIn, claude: world.claude, removeIn: () => ({ ok: true, out: '', err: '' }) });
  assert.deepEqual(result.closed, []);
  assert.equal(result.kept[0].why, `its worktree ${entry.worktreePath} stays: git removed it and its folder still holds files`);
  assert.deepEqual(world.claudeCalls.filter((args) => args[0] === 'rm'), []);
  assert.deepEqual(open(world), ['aaaa1111']);
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

// Five sessions stood this way on 2026-11-11 (L5): an earlier claude rm emptied the folder, left its .git, and now refuses.
test('closeFinished says what settles a session whose folder holds only a leftover .git, which claude will not remove', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  for (const name of fs.readdirSync(entry.worktreePath)) if (name !== '.git') fs.rmSync(path.join(entry.worktreePath, name), { recursive: true, force: true });
  world.refuse.rm = `kept aaaa1111 — its worktree is still at "${entry.worktreePath}"`;
  const result = close(world, [notice(entry, 'closed', 30)]);
  assert.deepEqual(result.closed, []);
  assert.match(result.kept[0].why, /claude rm aaaa1111: kept aaaa1111/);
  assert.ok(result.kept[0].settle.includes(`claude keeps the job while its folder ${entry.worktreePath} is there, and it holds nothing but a leftover .git: once that folder is deleted by hand, js-harness sessions stop aaaa1111 tries the job again`), result.kept[0].settle);
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'), 'git is asked to remove nothing: its files are not there to judge');
  assert.equal(fs.existsSync(path.join(entry.worktreePath, '.git')), true);
}));

// Three findings of the lenses on 8cee927..d77b331 (2026-11-11): the look at the worktree came once, before a wait of up
// to a minute; the listing was read once for every session; a job listed under another id was not stopped.
test('closeFinished looks at the worktree again after the wait for its job, and keeps one that gained a file meanwhile', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)], gitIn: world.gitIn, claude: world.claude,
    // claude lists the job under another id, on the session's conversation: it is stopped and waited for all the same.
    agents: [{ id: 'zzzz9999', sessionId: entry.sessionId, kind: 'background', pid: 4242, status: 'idle', state: 'done' }],
    alive: () => { fs.mkdirSync(path.join(entry.worktreePath, 'evals', 'runs'), { recursive: true }); fs.writeFileSync(path.join(entry.worktreePath, 'evals', 'runs', 'late.json'), '{}\n'); return false; },
    pause: () => {},
  });
  assert.deepEqual(result.closed, []);
  assert.match(result.kept[0].why, /stays: it holds what no branch brings back: !! evals\//);
  assert.equal(result.kept[0].stopped, true);
  assert.deepEqual(world.claudeCalls, [['stop', 'zzzz9999']]);
  assert.ok(!world.gitCalls.some((args) => args[0] === 'worktree' && args[1] === 'remove'));
  assert.equal(fs.existsSync(path.join(entry.worktreePath, 'evals', 'runs', 'late.json')), true);
}));

test('closeFinished reads claude\'s listing again after it acted, and keeps a session that went to work meanwhile', withWorld((world) => {
  const [first, second, third] = ['aaaa1111', 'bbbb2222', 'cccc3333'].map((id) => startSession(world, id, { worktree: null }));
  let lists = 0;
  const result = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [first, second, third].map((entry) => notice(entry, 'closed', 30)), agents: [], gitIn: world.gitIn, claude: world.claude,
    // Read again only after an act, since only an act takes time: once and it fails, then once more.
    list: () => { lists += 1; if (lists === 1) throw new Error('claude agents: made up'); return [{ id: 'cccc3333', kind: 'background', status: 'busy', state: 'working' }]; },
  });
  assert.deepEqual(result.closed.map((item) => item.entry.id), ['aaaa1111']);
  assert.deepEqual(result.kept.map((item) => [item.entry.id, item.why]), [
    ['bbbb2222', 'whether it is at work cannot be told (claude agents: made up)'],
    ['cccc3333', 'it is busy: a session at work is not closed'],
  ]);
  assert.equal(lists, 2);
  assert.deepEqual(open(world), ['bbbb2222', 'cccc3333']);
}));

test('the removal is the one git call given the long bound, and closeFinishedIn closes nothing when it cannot look', withWorld((world) => {
  const entry = startSession(world, 'aaaa1111');
  const removals = [];
  const done = closeFinished({
    home: world.home, root: world.root, cwd: world.root, base: 'origin/main', notices: [notice(entry, 'closed', 30)], agents: [], claude: world.claude,
    gitIn: (cwd, ...args) => { assert.notEqual(args[1], 'remove', 'a question\'s git does not delete'); return world.gitIn(cwd, ...args); },
    removeIn: (cwd, ...args) => { removals.push(args); return world.gitIn(cwd, ...args); },
  });
  assert.deepEqual([done.closed.length, removals.map((args) => args.slice(0, 2))], [1, [['worktree', 'remove']]]);
  assert.ok(REMOVAL_WAIT_MS >= 5 * 60_000);
  // What is left is finished too, so each look below would have something to close.
  const left = startSession(world, 'bbbb2222', { worktree: null });
  const channel = recordPath(world.home, projectSlug(world.root));
  fs.mkdirSync(path.dirname(channel), { recursive: true });
  fs.writeFileSync(channel, `${JSON.stringify({ schema: NOTICE_SCHEMA, text: 'delivered', to: { role: 'orchestrator' }, ...notice(left, 'closed', 30) })}\n`);
  const given = { home: world.home, root: world.root, run: spawnSync, claude: world.claude, list: () => [] };
  // This repository has no origin: the default branch cannot be named, so nothing is compared against a guess.
  const noBranch = closeFinishedIn(given);
  assert.equal(typeof noBranch.unavailable, 'string', JSON.stringify(noBranch));
  assert.match(closeFinishedIn({ ...given, list: () => { throw new Error('made up'); } }).unavailable, /whether a session is at work cannot be told \(made up\)/);
  assert.match(closeFinishedIn({ ...given, claude: null }).unavailable, /^claude is not on PATH$/);
  // A line of a record that cannot be read may be a newer word than closed, or a resume: nothing is closed over it.
  for (const [file, named] of [[recordFileOf(world.home), /1 line of the record of background sessions could not be read/], [channel, /1 line of the channel's record .* could not be read/]]) {
    const whole = fs.readFileSync(file, 'utf8');
    fs.appendFileSync(file, '{"cut\n');
    assert.match(closeFinishedIn({ ...given, base: 'main' }).unavailable, named);
    fs.writeFileSync(file, whole);
  }
  assert.deepEqual(world.claudeCalls.filter((args) => args[1] === 'bbbb2222'), []);
  // What doctor lists reads the same records: the one left, and a throw where it cannot look.
  assert.deepEqual(finishedIn({ home: world.home, root: world.root, list: () => [] }).map((item) => item.id), ['bbbb2222']);
  assert.deepEqual(finishedIn({ home: world.home, root: world.root, list: () => [{ id: 'bbbb2222', status: 'busy' }] }), []);
  const record = recordFileOf(world.home);
  fs.renameSync(record, `${record}.aside`);
  fs.mkdirSync(record);
  assert.match(closeFinishedIn(given).unavailable, /the record of background sessions could not be read/);
  assert.throws(() => finishedIn({ home: world.home, root: world.root, list: () => [] }), /the record of background sessions could not be read/);
  fs.rmdirSync(record);
  fs.renameSync(`${record}.aside`, record);
  fs.rmSync(channel);
  fs.mkdirSync(channel);
  assert.match(closeFinishedIn(given).unavailable, /the channel's record .* could not be read/);
  assert.deepEqual(world.claudeCalls.filter((args) => args[1] === 'bbbb2222'), []);
  assert.deepEqual(open(world), ['bbbb2222']);
}));

test('after a land the finished sessions are closed against the main it pushed, each said in a line, and what cannot look only says so', withWorld((world) => {
  const done = startSession(world, 'aaaa1111');
  const ahead = startSession(world, 'bbbb2222', { landed: false });
  const channel = recordPath(world.home, projectSlug(world.root));
  fs.mkdirSync(path.dirname(channel), { recursive: true });
  fs.writeFileSync(channel, [done, ahead].map((entry) => `${JSON.stringify({ schema: NOTICE_SCHEMA, text: 'delivered', to: { role: 'orchestrator' }, ...notice(entry, 'closed', 30) })}\n`).join(''));
  const said = [];
  const given = { home: world.home, root: world.root, cwd: world.root, base: world.git(world.root, 'rev-parse', 'main'), run: spawnSync, claude: world.claude, list: () => [], say: (line) => said.push(line) };
  assert.deepEqual(closeAfterLand({ ...given, claude: null }), []);
  assert.deepEqual(closeAfterLand({ ...given, list: () => { throw new Error('made up'); } }), []);
  assert.deepEqual(said, [
    'No finished background session was closed: claude is not on PATH. js-harness sessions stop --finished tries again.',
    'No finished background session was closed: whether a session is at work cannot be told (made up). js-harness sessions stop --finished tries again.',
  ]);
  assert.deepEqual(world.claudeCalls, []);
  said.length = 0;
  assert.deepEqual(closeAfterLand(given), [{ id: 'aaaa1111', title: 'JH 1 · aaaa1111', worktree: done.worktreePath }]);
  assert.equal(said[0], 'Finished background sessions: 1 closed, 1 kept.');
  assert.match(said[1], /^closed aaaa1111 · JH 1 · aaaa1111: git removed its worktree /);
  assert.match(said[2], /^kept bbbb2222 · JH 1 · bbbb2222: its worktree .* stays: its head is not in main$/);
  assert.deepEqual([fs.existsSync(done.worktreePath), fs.existsSync(ahead.worktreePath)], [false, true]);
  // With none finished and still here, a land says nothing of them.
  fs.rmSync(channel);
  said.length = 0;
  assert.deepEqual([closeAfterLand(given), said], [[], []]);
}));

test('the board names each finished session still on the machine with the command that closes it, and none that is at work', withWorld((world) => {
  const [done, busy, open] = ['aaaa1111', 'bbbb2222', 'cccc3333'].map((id) => startSession(world, id, { worktree: null }));
  const notices = [notice(done, 'closed', 30), notice(busy, 'closed', 20), notice(open, 'ready', 10)];
  const given = { home: world.home, root: world.root, worktrees: { available: false }, list: () => [{ id: 'bbbb2222', kind: 'background', cwd: world.root, status: 'busy', state: 'working' }] };
  const fact = boardBackground({ ...given, notices });
  assert.deepEqual(fact.finished, [{ id: 'aaaa1111', title: 'JH 1 · aaaa1111', closedAt: notices[0].at }]);
  assert.deepEqual(finishedHere(readRecord(world.home), notices, world.root, []).map((item) => item.id), ['aaaa1111', 'bbbb2222']);
  const lines = backgroundLines(fact, (iso) => (iso === notices[0].at ? '30 min ago' : 'some time ago'));
  const at = lines.findIndex((line) => line.startsWith('  1 finished and still on the machine'));
  assert.match(lines[at], /js-harness sessions stop --finished closes each that loses nothing and says why it keeps the rest$/);
  assert.equal(lines[at + 1], '    aaaa1111  JH 1 · aaaa1111  closed 30 min ago');
  // A board with no channel record at hand (`notices` null) names none, and prints no line for none.
  const blind = boardBackground(given);
  assert.deepEqual(blind.finished, []);
  assert.ok(!backgroundLines(blind, () => 'some time ago').some((line) => /finished/.test(line)));
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
