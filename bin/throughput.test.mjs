import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SNAPSHOT_SCHEMA, throughputMain, throughputTick } from './throughput.mjs';
import { newNotice } from './lib/channel.mjs';

const NOW = Date.parse('2026-10-17T03:00:00Z');
const ROOT = path.resolve('/project/js-harness');
const homes = [];
afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

function makeHome(gateLines = []) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-throughput-'));
  homes.push(home);
  if (gateLines.length) {
    fs.mkdirSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'gate-log', 'log.jsonl'), gateLines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  }
  return home;
}

/** An archived copy of the gate log holding `lines`, made at `madeAt`: its modification time, which says up to when
 * it can hold the log. */
function writeCopy(file, lines, madeAt = NOW) {
  fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join(String.fromCharCode(10)) + String.fromCharCode(10));
  fs.utimesSync(file, madeAt / 1000, madeAt / 1000);
}

/** A git that answers as a repository whose main merged pull request 7 at 10:30Z on the 16th. */
function fakeGit({ origin = true, branchMerge = null, mergeTree = null, pace = null, mergedAt = '2026-10-16T10:30:00Z' } = {}) {
  return (command, args) => {
    const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
    if (args[0] === 'rev-parse' && args[1] === '--git-common-dir') return ok(`${ROOT}/.git\n`);
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return ok(`${ROOT}\n`);
    if (args[0] === 'rev-parse') return origin ? ok('abc\n') : { status: 1, stdout: '', stderr: '' };
    if (args[0] === 'log' && args[1] === '-m') return ok('\u0001m7\n\nodd/tasks/x.md\n');
    if (args[0] === 'log' && args[1] === '--first-parent') return ok(`m7\t${mergedAt}\tp7 h7\tMerge pull request #7 from feat/x\n`);
    if (args[0] === 'show' && args[1] === 'c1:odd/tasks/a.md') return ok('# A\n- [ ] T1\n- [x] T2\n');
    if (args[0] === 'show') return ok('h7\t2026-10-16T10:00:00Z\n');
    if (args[0] === 'ls-tree') return ok('odd/tasks/a.md\nodd/tasks/notes/b.md\n');
    if (args[0] === 'rev-list') return ok('c1\n');
    // The history progress reads, one commit compared with the one before (progress-pace.mjs, `paceLogArgs`).
    if (args[0] === '-c' && args.includes('-U100000')) return pace ?? ok('');
    if (args[0] === 'merge-tree' && mergeTree) return mergeTree;
    if (args[0] === 'log' && args[1] === '--merges' && branchMerge) return ok(branchMerge);
    if (args[0] === 'log') return ok('');
    return { status: 1, stdout: '', stderr: `unexpected git ${args.join(' ')}` };
  };
}

async function run(argv, { home, git = fakeGit(), codex = [], lands = [], now = NOW, timezoneOffset = 300 } = {}) {
  const out = [];
  const err = [];
  const code = await throughputMain(argv, {}, {
    cwd: ROOT, stdout: (line) => out.push(line), stderr: (line) => err.push(line), now: () => now, run: git,
    homedir: () => home, readCodexRuns: () => codex, readLands: () => lands, timezoneOffset: () => timezoneOffset,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const GATES = [
  { v: 1, event: 'start', id: 'g0', at: '2026-10-15T23:00:00Z', cwd: ROOT, command: 'check', pid: 1, lock: 'own', waitedSeconds: 0, waitedFor: [] },
  { v: 1, event: 'start', id: 'g1', at: '2026-10-16T09:00:00Z', cwd: ROOT, command: 'check', pid: 1, lock: 'own', waitedSeconds: 120, waitedFor: [], session: 'aaaaaaaa-1' },
  { v: 1, event: 'end', id: 'g1', at: '2026-10-16T09:03:20Z', seconds: 200, result: 'pass', sensors: [{ name: 'tests', seconds: 190, pass: true, ranIn: 'wsl' }] },
];

test('a usage error exits 2 and does nothing', async () => {
  const home = makeHome();
  assert.equal((await run(['--since', '16-10-2026'], { home })).code, 2);
  assert.equal((await run(['--bogus'], { home })).code, 2);
  assert.equal((await run(['snapshot', '--since', '2026-10-15'], { home })).code, 2);
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput')), false);
});

test('the table of the day before today names, for each row, its source, and the day it read from the live records', async () => {
  const home = makeHome(GATES);
  const { code, stdout } = await run([], { home, codex: [{ startedAt: '2026-10-16T08:00:00Z', durationMs: 49_000, outcome: 'reviewed' }] });
  assert.equal(code, 0);
  assert.match(stdout, /2026-10-16 to 2026-10-17/);
  assert.match(stdout, /2026-10-16 {2}live records/);
  assert.match(stdout, /pull requests merged +1 \(0\.04 an hour\) +\[git log of origin\/main/);
  assert.match(stdout, /gate waits +2 min in all; most: aaaaaaaa 2 min +\[the gate log/);
  assert.match(stdout, /Codex reviews +1 attempts \(0 parts\), median 49 s/);
  // No channel record here, and still a day before B1 is said to be one: there was nothing to read.
  assert.match(stdout, /ready to merged +not recorded: 2026-10-16 \(before B1, 2026-10-17\)/);
  // The window in the machine's own hours too, and the gates said to be the machine's, not this project's.
  assert.match(stdout, /local UTC-05:00: 2026-10-15 19:00 to 2026-10-16 19:00/);
  assert.match(stdout, /gates: every project of this machine/);
  // A merge whose every file is Markdown is a docs-only pull request.
  assert.match(stdout, /last commit to merge commit +median 30 min, p75 30 min, worst 30 min \(1\); docs-only median 30 min \(1\); code none/);
});

test('the idle upper bound is read from the channel record of the project', async () => {
  const home = makeHome(GATES);
  const channel = path.join(home, '.js-harness', 'channel');
  fs.mkdirSync(channel, { recursive: true });
  const notices = [
    { schema: 'js-harness.channel-notice/v1', at: '2026-10-16T10:00:00Z', kind: 'waiting', from: { id: 's1', title: 'JH 28' }, to: { role: 'orchestrator' }, text: 'ready' },
    { schema: 'js-harness.channel-notice/v1', at: '2026-10-16T10:45:00Z', kind: 'note', from: { id: 's1', title: 'JH 28' }, to: { role: 'orchestrator' }, text: 'back' },
  ];
  fs.writeFileSync(path.join(channel, `${ROOT.replace(/[^A-Za-z0-9]/g, '-')}.jsonl`), notices.map((notice) => JSON.stringify(notice)).join(String.fromCharCode(10)) + String.fromCharCode(10) + 'not json' + String.fromCharCode(10));
  const { stdout } = await run([], { home });
  assert.match(stdout, /idle upper bound +1 waits, median 45 min, 0\.8 session-h in all; longest: JH 28 45 min/);
});

test('the questions are read from the channel record of the project, numbered as its board numbers them', async () => {
  const home = makeHome(GATES);
  const channel = path.join(home, '.js-harness', 'channel');
  fs.mkdirSync(channel, { recursive: true });
  const from = { host: 'h', id: 's1', source: 'test', title: 'JH 28' };
  const notices = [
    newNotice({ at: '2026-10-16T10:00:00.000Z', from, to: 'orchestrator', kind: 'question', text: '¿a?', id: 'q1', options: [], waits: 'T4' }),
    newNotice({ at: '2026-10-16T11:00:00.000Z', from, to: 'orchestrator', kind: 'question', text: '¿b?', id: 'q2', options: [], waits: 'T4' }),
    newNotice({ at: '2026-10-16T10:20:00.000Z', from, to: 'orchestrator', kind: 'answer', text: 'a', transcript: 't', line: 3, question: 1, verified: false, copy: null }),
    newNotice({ at: '2026-10-16T11:30:00.000Z', from, to: 'orchestrator', kind: 'withdrawn', text: 'no longer', question: 2 }),
  ];
  fs.writeFileSync(path.join(channel, `${ROOT.replace(/[^A-Za-z0-9]/g, '-')}.jsonl`), notices.map((notice) => JSON.stringify(notice)).join(String.fromCharCode(10)) + String.fromCharCode(10));
  const { stdout } = await run([], { home });
  assert.match(stdout, /questions +2 recorded; 1 answered \(1 not verified\), 1 withdrawn; recorded to answer relayed: median 20 min \(1\); shown and answered times: not recorded \(B4\)/);
});

test('a channel record that is not there is said on its row, never read as no wait', async () => {
  const home = makeHome(GATES);
  const { stdout } = await run([], { home });
  assert.match(stdout, /idle upper bound +not read: 2026-10-16 no channel record/);
  assert.match(stdout, /questions +not read: 2026-10-16 no channel record/);
});

test('a main that is not there is said on the rows git gives, never read as no pull request', async () => {
  const home = makeHome(GATES);
  const { stdout } = await run([], { home, git: fakeGit({ origin: false }) });
  assert.match(stdout, /pull requests merged +not read: 2026-10-16 origin\/main is not there/);
});

test('snapshot keeps a closed day once, and the table then reads the day from it', async () => {
  const home = makeHome(GATES);
  const first = await run(['snapshot', '--day', '2026-10-16'], { home });
  assert.equal(first.code, 0, first.stderr);
  const file = path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json');
  const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(kept.schema, SNAPSHOT_SCHEMA);
  assert.deepEqual(kept.gates.map((gate) => gate.id), ['g1']);
  // main's history is append-only and is read live, never kept: a stale fetch freezes nothing.
  assert.equal(kept.prs, undefined);

  const again = await run(['snapshot', '--day', '2026-10-16'], { home });
  assert.equal(again.code, 1);
  assert.match(again.stderr, /already kept/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), kept);

  // The live log loses the day (rotation): the table still prints it, from the snapshot.
  fs.rmSync(path.join(home, '.js-harness', 'gate-log'), { recursive: true });
  const { stdout } = await run(['--since', '2026-10-16', '--until', '2026-10-17'], { home });
  assert.match(stdout, /2026-10-16 {2}snapshot/);
  assert.match(stdout, /gate waits +2 min in all/);
});

test('snapshot refuses a day that is not over yet', async () => {
  const home = makeHome(GATES);
  const { code, stderr } = await run(['snapshot', '--day', '2026-10-17'], { home });
  assert.equal(code, 2);
  assert.match(stderr, /settles at 2026-10-18T01:00:00.000Z/);
});

test('status names each day since the first one kept that has none, and exits 1', async () => {
  const home = makeHome(GATES);
  // No snapshot at all: a project whose heartbeat never ran is flagged, not passed.
  const none = await run(['status'], { home });
  assert.equal(none.code, 1);
  assert.match(none.stdout, /^MISSING: no day is kept for this project .*js-harness throughput snapshot --day 2026-10-16/m);
  await run(['snapshot', '--day', '2026-10-14'], { home });
  await run(['snapshot', '--day', '2026-10-16'], { home });
  const { code, stdout } = await run(['status'], { home });
  assert.equal(code, 1);
  assert.match(stdout, /2026-10-14 {2}kept/);
  assert.match(stdout, /2026-10-15 {2}MISSING/);
  assert.match(stdout, /2026-10-16 {2}kept/);
});

test('a day is kept only once its last gates can have ended: two gate-max after its midnight', async () => {
  const home = makeHome(GATES);
  const early = await run(['snapshot', '--day', '2026-10-16'], { home, now: Date.parse('2026-10-17T00:30:00Z') });
  assert.equal(early.code, 2);
  assert.match(early.stderr, /settles at 2026-10-17T01:00:00.000Z/);
});

test('snapshot --gate-log keeps a day from archived copies of the log and says where it came from', async () => {
  const home = makeHome();
  const copy = path.join(home, 'gate-log.jsonl');
  writeCopy(copy, GATES);
  const { code, stderr } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home });
  assert.equal(code, 0, stderr);
  const kept = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json'), 'utf8'));
  assert.deepEqual(kept.from, [copy]);
  assert.deepEqual(kept.gates.map((gate) => gate.id), ['g1']);
});

test('a partial day is replaced by a fuller one, and the replacement is recorded', async () => {
  const home = makeHome(GATES.slice(1));
  assert.equal((await run(['snapshot', '--day', '2026-10-16'], { home })).code, 0);
  const copy = path.join(home, 'gate-log.jsonl');
  writeCopy(copy, GATES);
  const { code, stdout } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home });
  assert.equal(code, 0);
  assert.match(stdout, /replaced a partial snapshot/);
  const kept = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json'), 'utf8'));
  assert.equal(kept.partialFrom, null);
  assert.equal(kept.replaced.partialFrom, '2026-10-16T09:00:00Z');
});

test('with the git of the machine, not a fake, it reads a repository', async () => {
  const home = makeHome();
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-throughput-repo-'));
  homes.push(repo);
  const { spawnSync } = await import('node:child_process');
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
  const out = [];
  const code = await throughputMain(['status', '--home', home], {}, { cwd: repo, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  // Nothing kept yet, so the project's own folder is named as missing (A8).
  assert.equal(code, 1, out.join('\n'));
  assert.match(out[0], new RegExp(`^MISSING: no day is kept for this project \\(.*js-harness-throughput-repo-`));
});

test('--against compares the window with an equal one before it, row by row, and judges nothing under 7 days', async () => {
  const home = makeHome(GATES);
  const { code, stdout } = await run(['--since', '2026-10-16', '--until', '2026-10-17', '--against', '2026-10-15..2026-10-16'], { home });
  assert.equal(code, 0);
  assert.match(stdout, /before 2026-10-15 to 2026-10-16, after 2026-10-16 to 2026-10-17/);
  assert.match(stdout, /pull requests merged +before 0 +after 1 +not judged: 1 days a side, under 7/);
  // 10-15 is covered by the gate log only from 23:00: a part of a day is no day's value.
  assert.match(stdout, /gate waits, min +before none +after 2 +not judged: 0 days a side/);
});

test('--against a window of another length is a usage error', async () => {
  const home = makeHome(GATES);
  const { code, stderr } = await run(['--since', '2026-10-16', '--until', '2026-10-17', '--against', '2026-10-13..2026-10-16'], { home });
  assert.equal(code, 2);
  assert.match(stderr, /equal windows/);
  assert.equal((await run(['--against', '2026-10-15'], { home })).code, 2);
});

test('a gate log that is missing, empty or unreadable never writes over a kept day, and a mistyped copy is a usage error', async () => {
  const home = makeHome(GATES.slice(1));
  const file = path.join(home, '.js-harness', 'throughput', ROOT.replace(/[^A-Za-z0-9]/g, '-'), '2026-10-16.json');
  assert.equal((await run(['snapshot', '--day', '2026-10-16'], { home })).code, 0);
  const partial = fs.readFileSync(file, 'utf8');

  const missing = await run(['snapshot', '--day', '2026-10-16', '--gate-log', path.join(home, 'no-such-copy.jsonl')], { home });
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /no-such-copy\.jsonl: no such file/);

  const empty = path.join(home, 'empty.jsonl');
  fs.writeFileSync(empty, '');
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--gate-log', empty], { home })).code, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), partial);
});

test('a day kept from a log that holds no gate of it is partial, so a fuller copy replaces it', async () => {
  const home = makeHome();
  const empty = path.join(home, 'empty.jsonl');
  fs.writeFileSync(empty, '');
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--gate-log', empty], { home })).code, 0);
  const copy = path.join(home, 'gate-log.jsonl');
  writeCopy(copy, GATES);
  const { code, stdout } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home });
  assert.equal(code, 0);
  assert.match(stdout, /replaced a partial snapshot/);
});

test('an unreadable gate log keeps nothing', async () => {
  const home = makeHome(GATES);
  const denied = { ...fs, readFileSync: (file, ...rest) => (String(file).includes('gate-log') ? (() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); })() : fs.readFileSync(file, ...rest)) };
  const out = [];
  const code = await throughputMain(['snapshot', '--day', '2026-10-16'], {}, { cwd: ROOT, stdout: (l) => out.push(l), stderr: (l) => out.push(l), now: () => NOW, run: fakeGit(), homedir: () => home, readCodexRuns: () => [], fileSystem: denied });
  assert.equal(code, 1, out.join('\n'));
  assert.match(out.join('\n'), /gate log could not be read/);
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput')), false);
});

test('a day that is no day of the calendar is a usage error on every option that takes one', async () => {
  const home = makeHome();
  for (const argv of [['--since', '2026-13-01'], ['--until', '2026-10-32'], ['snapshot', '--day', '2026-00-10'], ['--against', '2026-13-01..2026-13-02']]) {
    const { code, stderr } = await run(argv, { home });
    assert.equal(code, 2, argv.join(' '));
    assert.match(stderr, /takes (a day|the window before)/, argv.join(' '));
  }
});

test('a merge-tree that fails leaves the conflicts row unread, never a count of none', async () => {
  const home = makeHome(GATES);
  const git = fakeGit({ branchMerge: "b1\t2026-10-16T12:00:00Z\to1 t1\tMerge branch 'main' into feat/x\n", mergeTree: { status: 129, stdout: '', stderr: 'error: unknown option `write-tree`\n' } });
  const { stdout } = await run([], { home, git });
  assert.match(stdout, /conflicts by file +not read: 2026-10-16 git merge-tree: error: unknown option `write-tree`/);
  assert.match(stdout, /pull requests merged +1 /);
});

test('a history read that fails leaves the task row unread', async () => {
  const home = makeHome(GATES);
  const { stdout } = await run([], { home, git: fakeGit({ pace: { status: 128, stdout: '', stderr: 'fatal: bad object\n' } }) });
  assert.match(stdout, /tasks closed and added +not read: 2026-10-16 git log: fatal: bad object/);
});

test('a copy of the gate log made before its day settled keeps the day as partial until then, and a later copy replaces it', async () => {
  const home = makeHome();
  const early = path.join(home, 'early.jsonl');
  writeCopy(early, GATES, Date.parse('2026-10-16T18:30:00Z'));
  const first = await run(['snapshot', '--day', '2026-10-16', '--gate-log', early], { home });
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /partial: the copies end at 2026-10-16T18:30:00.000Z, before the day settles/);
  assert.match((await run([], { home })).stdout, /gate waits +.*partial: 2026-10-16 until 2026-10-16T18:30Z/);
  const late = path.join(home, 'late.jsonl');
  writeCopy(late, GATES);
  const second = await run(['snapshot', '--day', '2026-10-16', '--gate-log', late], { home });
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /replaced a partial snapshot/);
  // The early copy covers less at its end, so it writes nothing over the later one.
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--gate-log', early], { home })).code, 1);
});

test('--copied-at says when a copy was made, for one that kept its source\'s modification time', async () => {
  const home = makeHome();
  const preserved = path.join(home, 'preserved.jsonl');
  // Copied at 03:00 with its time kept: its last write, 09:03:20 on the 16th, is all the file says.
  writeCopy(preserved, GATES, Date.parse('2026-10-16T09:03:20Z'));
  const partial = await run(['snapshot', '--day', '2026-10-16', '--gate-log', preserved], { home });
  assert.match(partial.stdout, /before the day settles; --copied-at <time> says when it was made/);
  const { code, stdout } = await run(['snapshot', '--day', '2026-10-16', '--gate-log', preserved, '--copied-at', '2026-10-17T03:00:00Z'], { home });
  assert.equal(code, 0);
  assert.match(stdout, /replaced a partial snapshot/);
  assert.doesNotMatch(stdout, /partial: the copies end/);
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--copied-at', '2026-10-17T03:00:00Z'], { home })).code, 2);
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--gate-log', preserved, '--copied-at', 'yesterday'], { home })).code, 2);
  // A copy is not made later than now: a future time would settle a day no copy holds whole.
  const future = await run(['snapshot', '--day', '2026-10-16', '--gate-log', preserved, '--copied-at', '2026-10-17T03:01:00Z'], { home });
  assert.equal(future.code, 2);
  assert.match(future.stderr, /--copied-at 2026-10-17T03:01:00.000Z is after now/);
});

test('the tasks row reads a commit of the history as progress parses it', async () => {
  const home = makeHome(GATES);
  const nl = String.fromCharCode(10);
  const history = [
    `${String.fromCharCode(1)}c2 2026-10-16T12:00:00Z c1`,
    '',
    'diff --git a/odd/tasks/a.md b/odd/tasks/a.md',
    'index 1111111..2222222 100644',
    '--- a/odd/tasks/a.md',
    '+++ b/odd/tasks/a.md',
    '@@ -1,2 +1,2 @@',
    '-- [ ] T1 one',
    '+- [x] T1 one',
    ' - [ ] T2 two',
  ].join(nl) + nl;
  const { stdout } = await run([], { home, git: fakeGit({ pace: { status: 0, stdout: history, stderr: '' } }) });
  assert.match(stdout, /tasks closed and added +closed 1, reopened 0, added 0, removed 0; open 1 to 1/);
});

test('--against takes a window before the one it compares', async () => {
  const home = makeHome(GATES);
  const { code, stderr } = await run(['--since', '2026-10-15', '--until', '2026-10-16', '--against', '2026-10-16..2026-10-17'], { home });
  assert.equal(code, 2);
  assert.match(stderr, /--against takes the window before: 2026-10-16\.\.2026-10-17 does not end by 2026-10-15/);
});

test('status does not name as missing a day that has not settled yet', async () => {
  const home = makeHome(GATES);
  await run(['snapshot', '--day', '2026-10-15'], { home });
  const { code, stdout } = await run(['status'], { home, now: Date.parse('2026-10-17T00:30:00Z') });
  assert.equal(code, 0, stdout);
  assert.doesNotMatch(stdout, /2026-10-16 {2}MISSING/);
});

test('a day after B1 and B2 reads its ready notices from the channel and its lands from the land record', async () => {
  const home = makeHome(GATES);
  const channel = path.join(home, '.js-harness', 'channel');
  fs.mkdirSync(channel, { recursive: true });
  const ready = { schema: 'js-harness.channel-notice/v1', at: '2026-10-17T09:30:00Z', kind: 'ready', pr: 7, from: { id: 's1', title: 'JH 28' }, to: { role: 'orchestrator' }, text: '#7 ready' };
  fs.writeFileSync(path.join(channel, `${ROOT.replace(/[^A-Za-z0-9]/g, '-')}.jsonl`), JSON.stringify(ready) + String.fromCharCode(10));
  const lands = [{ v: 1, startedAt: '2026-10-17T10:20:00Z', endedAt: '2026-10-17T10:25:00Z', considered: [7], landed: [7], phases: [{ phase: 'suite', startedAt: '2026-10-17T10:20:10Z', seconds: 270.4, ok: true }], exit: 0 }];
  const { code, stdout } = await run(['--since', '2026-10-17', '--until', '2026-10-18'], { home, git: fakeGit({ mergedAt: '2026-10-17T10:30:00Z' }), lands, now: Date.parse('2026-10-18T12:00:00Z') });
  assert.equal(code, 0);
  assert.match(stdout, /ready to merged +median 60 min, p75 60 min, worst 60 min \(1\) +\[the newest ready notice/);
  assert.match(stdout, /land phases +1 lands, median 300 s, landed 1 of 1 looked at; exit 0 ×1; suite 1, median 270 s +\[<git common dir>\/js-harness\/lands\.jsonl/);
});

test('a test times file that is there and cannot be read is said on its row, never read as no times', async () => {
  const home = makeHome(GATES);
  const out = [];
  const timesFile = (file) => String(file).replace(/[\\/]+/g, '/').endsWith('/gate-log/test-times.jsonl');
  const readFileSync = (file, ...rest) => (timesFile(file) ? (() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); })() : fs.readFileSync(file, ...rest));
  await throughputMain(['--since', '2026-10-17', '--until', '2026-10-18'], {}, {
    cwd: ROOT, stdout: (l) => out.push(l), stderr: (l) => out.push(l), now: () => Date.parse('2026-10-18T12:00:00Z'), run: fakeGit(), homedir: () => home, readCodexRuns: () => [], fileSystem: { ...fs, readFileSync },
  });
  assert.match(out.join(String.fromCharCode(10)), /test files +not read: 2026-10-17 EACCES/);
});

test('a land record that is there and cannot be read is said on its row, never read as no land', async () => {
  const home = makeHome(GATES);
  const table = async (readFileSync) => {
    const out = [];
    await throughputMain(['--since', '2026-10-17', '--until', '2026-10-18'], {}, {
      cwd: ROOT, stdout: (l) => out.push(l), stderr: (l) => out.push(l), now: () => Date.parse('2026-10-18T12:00:00Z'), run: fakeGit(), homedir: () => home, readCodexRuns: () => [], fileSystem: { ...fs, readFileSync },
    });
    return out.join(String.fromCharCode(10));
  };
  const lands = (file) => String(file).replace(/[\\/]+/g, '/').endsWith('/.git/js-harness/lands.jsonl');
  const denied = await table((file, ...rest) => (lands(file) ? (() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); })() : fs.readFileSync(file, ...rest)));
  assert.match(denied, /land phases +not read: 2026-10-17 EACCES/);
  // No record at all is a machine where no land ran: nothing to read, and so none.
  const absent = await table((file, ...rest) => (lands(file) ? (() => { throw Object.assign(new Error('absent'), { code: 'ENOENT' }); })() : fs.readFileSync(file, ...rest)));
  assert.match(absent, /land phases +none/);
  const kept = await table((file, ...rest) => (lands(file) ? `${JSON.stringify({ v: 1, startedAt: '2026-10-17T10:00:00Z', endedAt: '2026-10-17T10:01:00Z', considered: [7], landed: [7], phases: [], exit: 0 })}${String.fromCharCode(10)}torn` : fs.readFileSync(file, ...rest)));
  assert.match(kept, /land phases +1 lands, median 60 s/);
});

test('the test files row reads the live folder\'s test times of the day\'s traced gates, and a day kept from copies has none', async () => {
  const traced = [
    { v: 1, event: 'start', id: 't1', at: '2026-10-16T09:00:00Z', cwd: ROOT, command: 'check', pid: 1, lock: 'own', waitedSeconds: 0, waitedFor: [] },
    { v: 1, event: 'end', id: 't1', at: '2026-10-16T09:03:00Z', seconds: 180, result: 'pass', sensors: [{ name: 'tests', seconds: 170, pass: true, shadow: { files: 1, wouldSkip: 0, failedOfSkipped: [] } }] },
  ];
  const home = makeHome(traced);
  const line = { v: 1, id: 't1', at: '2026-10-16T09:03:01Z', files: [{ test: 'a.test.mjs', seconds: 3.2 }] };
  fs.writeFileSync(path.join(home, '.js-harness', 'gate-log', 'test-times.jsonl'), JSON.stringify(line) + String.fromCharCode(10));
  const { stdout } = await run([], { home });
  assert.match(stdout, /test files +1 of 1 local gates that traced; slowest by mean: a\.test\.mjs 3 s \(max 3 s, 1 run\); partial: 2026-10-16 from 09:00Z +\[test-times\.jsonl/);
  assert.equal((await run(['snapshot', '--day', '2026-10-16'], { home })).code, 0);
  assert.match((await run([], { home })).stdout, /test files +1 of 1 local gates that traced; slowest by mean: a\.test\.mjs 3 s/);
  const fromCopies = makeHome([]);
  const copy = path.join(fromCopies, 'copy.jsonl');
  writeCopy(copy, traced);
  assert.equal((await run(['snapshot', '--day', '2026-10-16', '--gate-log', copy], { home: fromCopies })).code, 0);
  assert.match((await run([], { home: fromCopies })).stdout, /test files +not recorded: 2026-10-16 \(no test times kept\)/);
});

test('the gentle-ai reviews row reads the store and the starts once a run, and a store that cannot be read says so', async () => {
  const home = makeHome(GATES);
  const out = [];
  let reads = 0;
  const reviews = {
    starts: [{ v: 1, lineage: 'review-a', at: '2026-10-17T09:00:00.000Z', from: 'birthtime', seenAt: '2026-10-17T08:00:00.000Z' }],
    ends: [{ lineage: 'review-a', at: '2026-10-17T09:30:00.000Z' }],
    live: [],
  };
  const main = (deps) => throughputMain(['--since', '2026-10-16', '--until', '2026-10-18'], {}, {
    cwd: ROOT, stdout: (l) => out.push(l), stderr: (l) => out.push(l), now: () => Date.parse('2026-10-18T12:00:00Z'), run: fakeGit(), homedir: () => home, readCodexRuns: () => [], readLands: () => [], ...deps,
  });
  await main({ readReviews: () => { reads += 1; return reviews; } });
  assert.equal(reads, 1);
  assert.match(out.join(String.fromCharCode(10)), /gentle-ai reviews +1 acknowledged, median 30 min \(1 timed, one lineage each\); 1 started, 0 open, 0 gone without acknowledgement; started not recorded: 2026-10-16 \(this machine records starts from 2026-10-17 08:00Z\) +\[gentle-ai's store/);
  out.length = 0;
  const denied = { ...fs, readdirSync: (dir, ...rest) => (String(dir).includes('review-transactions') ? (() => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); })() : fs.readdirSync(dir, ...rest)) };
  await main({ fileSystem: denied });
  assert.match(out.join(String.fromCharCode(10)), /gentle-ai reviews +not read: 2026-10-16 EACCES; 2026-10-17 EACCES/);
});

test('a starts file that cannot be read leaves the acknowledgements from gentle-ai\'s store on the row', async () => {
  const home = makeHome(GATES);
  const out = [];
  const starts = (file) => String(file).replace(/[\\/]+/g, '/').endsWith('/review-starts.jsonl');
  const fileSystem = { ...fs, readFileSync: (file, ...rest) => (starts(file) ? (() => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }); })() : fs.readFileSync(file, ...rest)) };
  await throughputMain(['--since', '2026-10-17', '--until', '2026-10-18'], {}, {
    cwd: ROOT, stdout: (l) => out.push(l), stderr: (l) => out.push(l), now: () => Date.parse('2026-10-18T12:00:00Z'), run: fakeGit(), homedir: () => home, readCodexRuns: () => [], readLands: () => [], fileSystem,
  });
  assert.match(out.join(String.fromCharCode(10)), /gentle-ai reviews +0 acknowledged; started not read: 2026-10-17 EBUSY/);
});

/** The outcomes file of the one project the home holds. */
function outcomesFile(home) {
  const folder = path.join(home, '.js-harness', 'throughput');
  return path.join(folder, fs.readdirSync(folder)[0], 'outcomes.jsonl');
}
const outcomesOf = (home) => fs.readFileSync(outcomesFile(home), 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

test('reviewed and shipped record the outcomes, and status prints the reviews they leave due', async () => {
  const home = makeHome(GATES);
  await run(['snapshot', '--day', '2026-10-16'], { home });
  let status = await run(['status'], { home });
  assert.equal(status.code, 0, status.stdout);
  assert.match(status.stdout, /^DUE: throughput review of 2026-10-16: js-harness throughput --since 2026-10-16 --until 2026-10-17; js-harness-protocols section 7; then js-harness throughput reviewed --day 2026-10-16 --found nothing\|candidates$/m);

  const reviewed = await run(['reviewed', '--day', '2026-10-16', '--found', 'nothing'], { home });
  assert.equal(reviewed.code, 0, reviewed.stderr);
  assert.match(reviewed.stdout, /recorded the review of 2026-10-16 \(found nothing\)/);
  assert.doesNotMatch((await run(['status'], { home })).stdout, /DUE/);

  assert.equal((await run(['shipped', 'the faster gate', '--day', '2026-10-05'], { home })).code, 0);
  assert.equal((await run(['shipped', 'the lean session'], { home, now: Date.parse('2026-10-05T18:00:00Z') })).code, 0);
  status = await run(['status'], { home });
  assert.match(status.stdout, /^DUE: throughput re-measure of the faster gate, the lean session, shipped 2026-10-05: js-harness throughput --since 2026-10-06 --until 2026-10-13 --against 2026-09-29\.\.2026-10-06; then js-harness throughput reviewed --shipped 2026-10-05 --found nothing\|candidates$/m);

  assert.equal((await run(['reviewed', '--shipped', '2026-10-05', '--found', 'candidates'], { home })).code, 0);
  assert.doesNotMatch((await run(['status'], { home })).stdout, /DUE/);
  assert.deepEqual(outcomesOf(home).map(({ v, at, ...rest }) => [v, typeof at, rest]), [
    [1, 'string', { kind: 'reviewed', day: '2026-10-16', found: 'nothing' }],
    [1, 'string', { kind: 'shipped', item: 'the faster gate', day: '2026-10-05' }],
    [1, 'string', { kind: 'shipped', item: 'the lean session', day: '2026-10-05' }],
    [1, 'string', { kind: 'reviewed', shipped: '2026-10-05', found: 'candidates' }],
  ]);
});

test('a torn last line of the outcomes is ended before the next one, and left out when read', async () => {
  const home = makeHome(GATES);
  await run(['snapshot', '--day', '2026-10-16'], { home });
  fs.writeFileSync(outcomesFile(home), '{"v":1,"kind":"revie');
  assert.equal((await run(['reviewed', '--day', '2026-10-16', '--found', 'nothing'], { home })).code, 0);
  const lines = fs.readFileSync(outcomesFile(home), 'utf8').split(String.fromCharCode(10));
  assert.equal(lines[0], '{"v":1,"kind":"revie');
  assert.equal(JSON.parse(lines[1]).day, '2026-10-16');
  const status = await run(['status'], { home });
  assert.equal(status.code, 0, status.stdout);
  assert.doesNotMatch(status.stdout, /DUE/);
});

test('the heartbeat\'s tick keeps each settled day the live gate log holds that has no snapshot, and remembers a day it does not hold', async () => {
  const home = makeHome(GATES);
  const skip = new Set();
  const tick = (options = {}) => throughputTick({ home, cwd: ROOT, now: NOW, run: fakeGit(), skip, ...options });
  const first = tick();
  // The log begins at 23:00Z on the 15th: the 15th is kept as partial, the 16th whole, and the twelve days before
  // (throughput-backfill-days, 14, back from the 16th) hold no gate, so they are remembered and never kept empty.
  assert.deepEqual(first.lines, [
    'throughput: kept 2026-10-15 (partial: the gate log begins at 2026-10-15T23:00:00Z)',
    'throughput: kept 2026-10-16',
  ]);
  assert.deepEqual([...skip].sort(), ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(first.dues.map((due) => due.id), ['review 2026-10-16']);
  assert.deepEqual(tick().lines, []);
  const status = await run(['status'], { home });
  assert.match(status.stdout, /2026-10-16 {2}kept$/m);
  assert.doesNotMatch(status.stdout, /2026-10-14/);
});

test('the heartbeat\'s tick writes nothing while a gate holds the lock, and still says what is due', async () => {
  const home = makeHome(GATES);
  const held = throughputTick({ home, cwd: ROOT, now: NOW, run: fakeGit(), skip: new Set(), gateHolder: () => ({ stale: false }) });
  assert.deepEqual(held.lines, []);
  assert.deepEqual(held.dues.map((due) => due.id), ['review 2026-10-16']);
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput')), false);
  // A stale holder is no gate: the days are kept.
  const stale = throughputTick({ home, cwd: ROOT, now: NOW, run: fakeGit(), skip: new Set(), gateHolder: () => ({ stale: true }) });
  assert.equal(stale.lines.length, 2);
});

test('reviewed and shipped refuse what they cannot record, and write nothing', async () => {
  const home = makeHome(GATES);
  for (const argv of [
    ['reviewed', '--day', '2026-10-16'],
    ['reviewed', '--day', '2026-10-16', '--found', 'maybe'],
    ['reviewed', '--found', 'nothing'],
    ['reviewed', '--day', '2026-10-16', '--shipped', '2026-10-05', '--found', 'nothing'],
    ['reviewed', '--day', '2026-10-17', '--found', 'nothing'],
    ['reviewed', '--shipped', '2026-10-12', '--found', 'nothing'],
    ['shipped'],
    ['shipped', 'a', 'b'],
    ['shipped', 'a', '--day', '2026-10-18'],
    ['shipped', 'a', '--found', 'nothing'],
  ]) {
    const result = await run(argv, { home });
    assert.equal(result.code, 2, `${argv.join(' ')}: ${result.stdout}`);
  }
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'throughput')), false);
});
