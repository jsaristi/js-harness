import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeVerdict, readCanClose, renderVerdict, shellsUnderSessions, stagedWorktrees } from './can-close.mjs';

/** A process of the snapshot `takeSnapshot` returns. */
const proc = (pid, ppid, name, createdAt = Date.UTC(2026, 10, 20, 19, 32, 52)) => ({ pid, ppid, name, createdAt });

// The machine at 19:48Z on 2026-11-20 (odd/tasks/closed-app-update.md, Depth pass item 2): the app's claude.exe
// (1808), three sessions under it, MCP servers under cmd.exe, engram as a direct child, and a shell under JH PLAN
// (10048) with node below it, which `claude agents` listed as idle.
const SNAPSHOT = [
  proc(1808, 900, 'claude.exe'),
  proc(10048, 1808, 'claude.exe'),
  proc(5428, 1808, 'claude.exe'),
  proc(2584, 1808, 'claude.exe'),
  proc(4952, 10048, 'cmd.exe'),
  proc(7672, 4952, 'node.exe'),
  proc(9248, 10048, 'engram.exe'),
  proc(11312, 10048, 'bash.exe'),
  proc(3692, 11312, 'node.exe'),
  proc(11184, 5428, 'cmd.exe'),
  proc(13252, 2584, 'bash.exe'),
  proc(11776, 13252, 'node.exe'),
];
const AGENTS = [
  { pid: 5428, status: 'idle', kind: 'interactive', sessionId: 'orq', name: 'JH ORQ · orquestador F8' },
  { pid: 10048, status: 'idle', kind: 'interactive', sessionId: 'plan', name: 'JH PLAN · planes' },
  { pid: 2584, status: 'busy', kind: 'interactive', sessionId: 'self', name: 'JH 258' },
  { status: 'done', kind: 'background', name: 'JH 201' },
];

test('a shell under an idle session is its background task, and the caller\'s own call is not counted', () => {
  const shells = shellsUnderSessions(SNAPSHOT, { agents: AGENTS, ownPid: 11776 });
  assert.deepEqual(shells.map((s) => [s.pid, s.session]), [[11312, 'JH PLAN · planes']]);
});

test('MCP servers under cmd.exe and engram.exe are no work', () => {
  const quiet = SNAPSHOT.filter((p) => ![11312, 3692, 13252, 11776].includes(p.pid));
  assert.deepEqual(shellsUnderSessions(quiet, { agents: AGENTS, ownPid: 1 }), []);
});

test('a session with a shell that claude agents does not list is named by its pid', () => {
  const shells = shellsUnderSessions([proc(1808, 1, 'claude.exe'), proc(77, 1808, 'claude.exe'), proc(78, 77, 'pwsh.exe')], { agents: [], ownPid: 1 });
  assert.equal(shells[0].session, 'claude.exe pid 77');
});

test('the verdict says no and why: a session at work, a background shell, a gate, staged work; the caller is left out', () => {
  const agents = [...AGENTS, { pid: 9, status: 'waiting', kind: 'interactive', sessionId: 'w', name: 'JH 250' }];
  const verdict = closeVerdict({
    agents,
    shells: shellsUnderSessions(SNAPSHOT, { agents, ownPid: 11776 }),
    gate: { pid: 4040, cwd: 'D:\\js-harness' },
    staged: ['D:\\js-harness\\.claude\\worktrees\\a'],
    selfSessionId: 'self',
  });
  assert.equal(verdict.canClose, false);
  assert.equal(verdict.reasons.length, 4);
  assert.match(verdict.reasons[0], /JH 250 is at work \(waiting\)/);
  assert.match(verdict.reasons[1], /JH PLAN · planes runs a shell \(bash\.exe, pid 11312\) since 19:32:52Z/);
  assert.match(verdict.reasons[2], /a gate holds the machine's lock \(pid 4040, D:\\js-harness\)/);
  assert.match(verdict.reasons[3], /staged and not committed in D:\\js-harness\\.claude\\worktrees\\a/);
});

test('nothing at work is a yes, and a part that could not be read is never a yes', () => {
  assert.deepEqual(closeVerdict({ agents: [], shells: [], gate: null, staged: [] }), { canClose: true, reasons: [], unread: [] });
  const verdict = closeVerdict({ agents: new Error('claude is not on PATH'), shells: [], gate: null, staged: [] });
  assert.equal(verdict.canClose, null);
  assert.deepEqual(verdict.unread, ['the sessions (claude agents): claude is not on PATH']);
  assert.match(renderVerdict(verdict).join('\n'), /^cannot tell/);
});

test('the rendered verdict opens on yes or no', () => {
  assert.match(renderVerdict({ canClose: true, reasons: [], unread: [] })[0], /^yes: /);
  const lines = renderVerdict({ canClose: false, reasons: ['JH 1 is at work (busy)'], unread: [] });
  assert.match(lines[0], /^no: 1 thing runs/);
  assert.equal(lines[1], '  - JH 1 is at work (busy)');
});

test('staged work is read from every worktree git lists, and a stale worktree whose diff cannot run is skipped', () => {
  const calls = [];
  const run = (command, args) => {
    calls.push(args.join(' '));
    if (args.includes('list')) return { status: 0, stdout: 'worktree D:/a\nHEAD 1\n\nworktree D:/b\nHEAD 2\n\nworktree D:/c\nprunable gitdir\n' };
    if (args[1] === 'D:/a') return { status: 0, stdout: '' };
    if (args[1] === 'D:/b') return { status: 1, stdout: '' };
    return { status: 128, stdout: '', stderr: 'fatal: not a git repository' };
  };
  assert.deepEqual(stagedWorktrees('D:/a', run), ['D:/b']);
  assert.ok(calls.every((c) => !/commit|add|reset|checkout|stash/.test(c)), 'it only reads');
});

test('readCanClose turns each failed read into an unread part', async () => {
  const verdict = await readCanClose({
    cwd: 'D:/a',
    home: 'H',
    listAgents: () => { throw new Error('no claude'); },
    snapshot: () => { throw new Error('no powershell'); },
    gateHolder: () => null,
    staged: () => [],
    ownPid: 1,
    selfSessionId: null,
  });
  assert.equal(verdict.canClose, null);
  assert.equal(verdict.unread.length, 2);
});

test('the caller\'s own open sub-agents and background shells say no, though its session is left out (S5)', () => {
  const verdict = closeVerdict({ agents: AGENTS, shells: [], gate: null, staged: [], selfSessionId: 'self', selfWork: [{ tool: 'Agent', description: 'verify the switch' }] });
  assert.equal(verdict.canClose, false);
  assert.match(verdict.reasons[0], /this session's Agent "verify the switch" still runs/);
  const unread = closeVerdict({ agents: [], shells: [], gate: null, staged: [], selfWork: new Error('no transcript of self') });
  assert.equal(unread.canClose, null);
});

test('a gate that waits for the lock and a blocked job say no (S5)', () => {
  const verdict = closeVerdict({
    agents: [{ state: 'blocked', name: 'JH 300', kind: 'background' }], shells: [], gate: null, staged: [],
    waiters: [{ pid: 77, cwd: 'D:\\b' }],
  });
  assert.equal(verdict.canClose, false);
  assert.match(verdict.reasons.join('\n'), /JH 300 is blocked/);
  assert.match(verdict.reasons.join('\n'), /a gate waits for the machine's lock \(pid 77, D:\\b\)/);
});

test('a worktree whose staged diff cannot be read is no clean worktree (S5)', () => {
  const run = (command, args) => (args.includes('list') ? { status: 0, stdout: 'worktree D:/a\nHEAD 1\n' } : { status: 128, stdout: '', stderr: 'fatal: index locked' });
  assert.throws(() => stagedWorktrees('D:/a', run), /D:\/a.*128/);
});

test('readCanClose reads the caller\'s open work and the gate waiters through their seams', async () => {
  const verdict = await readCanClose({
    cwd: 'D:/a', home: 'H', listAgents: () => [], snapshot: () => [], gateHolder: () => null, staged: () => [],
    gateWaiters: () => [], selfWork: () => [{ tool: 'Bash', description: 'watch CI' }], ownPid: 1, selfSessionId: 's',
  });
  assert.equal(verdict.canClose, false);
  assert.match(verdict.reasons[0], /Bash "watch CI"/);
});
