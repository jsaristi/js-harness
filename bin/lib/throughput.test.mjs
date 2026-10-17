import { test } from 'node:test';
import assert from 'node:assert/strict';

import { busySeconds, dayBounds, daysBetween, gateFacts, codexFacts, conflictFiles, gateKind, median, parseCommitTimes, parseMerges, percentile, prFacts, taskCounts, throughputRows } from './throughput.mjs';

const DAY = '2026-10-16';
const { from, to } = dayBounds(DAY);

const start = (id, at, fields = {}) => ({ v: 1, event: 'start', id, at, cwd: 'D:\\js-harness', command: 'check', pid: 1, lock: 'own', waitedSeconds: 0, waitedFor: [], ...fields });
const end = (id, at, fields = {}) => ({ v: 1, event: 'end', id, at, seconds: 100, result: 'pass', ...fields });

test('a day is its UTC midnight to the next, and a window is its whole days', () => {
  assert.deepEqual(dayBounds(DAY), { from: Date.parse('2026-10-16T00:00:00Z'), to: Date.parse('2026-10-17T00:00:00Z') });
  assert.deepEqual(daysBetween('2026-10-15', '2026-10-17'), ['2026-10-15', '2026-10-16']);
  assert.deepEqual(daysBetween('2026-10-16', '2026-10-16'), []);
});

test('a gate is a land, a session check, a wrapped commit, the copy update or another run, as the measure classified them', () => {
  assert.equal(gateKind({ cwd: 'C:\\Users\\x\\AppData\\Local\\Temp\\merge-queue-123-456', command: 'check' }), 'land');
  assert.equal(gateKind({ cwd: 'D:\\js-harness', command: 'check' }), 'check');
  assert.equal(gateKind({ cwd: 'D:\\js-harness', command: 'gate -- git commit -m x' }), 'commit');
  assert.equal(gateKind({ cwd: 'C:\\Users\\x\\.js-harness', command: 'gate -- bash lead/update-copy.sh' }), 'copy');
  assert.equal(gateKind({ cwd: 'D:\\js-harness', command: 'gate -- node --test' }), 'run');
});

test('the facts of a day are its gates started in it, joined by id, with where the tests ran and what failed', () => {
  const events = [
    start('a', '2026-10-15T23:59:00Z'),
    end('a', '2026-10-16T00:02:00Z'),
    start('b', '2026-10-16T10:00:00Z', { session: 's1', waitedSeconds: 30 }),
    end('b', '2026-10-16T10:04:00Z', { result: 'fail', sensors: [{ name: 'tests', seconds: 200, pass: false, ranIn: 'wsl', failing: ['x fails'] }] }),
    start('c', '2026-10-16T11:00:00Z', { lock: 'ci' }),
    end('c', '2026-10-16T11:02:24Z', { sensors: [{ name: 'tests', seconds: 140, pass: true, ranIn: 'ci' }] }),
    start('d', '2026-10-16T23:00:00Z'),
  ];
  const facts = gateFacts(events, { from, to });
  assert.deepEqual(facts.gates.map((gate) => gate.id), ['b', 'c', 'd']);
  assert.deepEqual(facts.gates[0], {
    id: 'b', kind: 'check', lock: 'own', session: 's1', startedAt: '2026-10-16T10:00:00Z', endedAt: '2026-10-16T10:04:00Z',
    seconds: 240, waitedSeconds: 30, result: 'fail', ranIn: 'wsl', failing: ['x fails'],
  });
  assert.equal(facts.gates[1].ranIn, 'ci');
  assert.equal(facts.gates[2].endedAt, null);
  assert.equal(facts.partialFrom, null);
});

test('a day the log no longer covers from its start says from when it is covered', () => {
  const facts = gateFacts([start('b', '2026-10-16T10:00:00Z'), end('b', '2026-10-16T10:04:00Z')], { from, to });
  assert.equal(facts.partialFrom, '2026-10-16T10:00:00Z');
  assert.equal(gateFacts([start('a', '2026-10-15T20:00:00Z')], { from, to }).partialFrom, null);
});

test('busy time is the union of the runs, so two gates at once count once', () => {
  assert.equal(busySeconds([[0, 100_000], [50_000, 150_000], [200_000, 260_000]]), 210);
  assert.equal(busySeconds([]), 0);
});

test('the median and a percentile of a list, null for none', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
});

test('the pull requests merged in a day are the first-parent merges of main whose subject names one, with the last commit of each', () => {
  const log = [
    'a1\t2026-10-16T21:16:29-05:00\tp1 h1\tMerge pull request #346 from feat/land-unattended',
    'a2\t2026-10-16T18:00:00-05:00\tp2 h2\tMerge branch main into x',
    'a3\t2026-10-15T18:59:00-05:00\tp3 h3\tMerge pull request #300 from feat/old',
    'a4\t2026-10-15T19:00:00-05:00\tp4 h4\tMerge pull request #301 from feat/edge',
  ].join('\n');
  const merges = parseMerges(log);
  assert.deepEqual(merges.map((merge) => merge.number), [346, 300, 301]);
  const heads = parseCommitTimes('h1\t2026-10-16T20:00:00-05:00\nh4\t2026-10-15T18:00:00-05:00\n');
  // 346 merged at 02:16Z of the 17th and 300 at 23:59Z of the 15th: a UTC day, not the machine's.
  assert.deepEqual(prFacts(merges, heads, { from, to }), [
    { number: 301, mergedAt: '2026-10-16T00:00:00.000Z', lastCommitAt: '2026-10-15T23:00:00.000Z' },
  ]);
  assert.equal(prFacts(merges, new Map(), dayBounds('2026-10-17'))[0].lastCommitAt, null);
});

test('the Codex runs of a day, with their seconds and outcome', () => {
  const runs = [
    { startedAt: '2026-10-15T23:59:59Z', durationMs: 1000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T08:00:00Z', durationMs: 49_000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T09:00:00Z', outcome: 'failed' },
  ];
  assert.deepEqual(codexFacts(runs, { from, to }), [
    { startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed' },
    { startedAt: '2026-10-16T09:00:00Z', seconds: null, outcome: 'failed' },
  ]);
});

test('the open and done tasks are the checkboxes git grep prints, a table row counted by nothing here', () => {
  const text = ['odd/tasks/a.md:- [ ] T1 one', 'odd/tasks/a.md:  - [x] T2 two', 'docs/ROADMAP.md:- [X] done', 'odd/tasks/a.md:| T3 | row |'].join('\n');
  assert.deepEqual(taskCounts(text), { open: 1, done: 2 });
});

test('a merge that conflicts names its files, from git merge-tree --name-only', () => {
  assert.deepEqual(conflictFiles('4b825dc\nbin/js-harness.mjs\nREADME.md\n'), ['bin/js-harness.mjs', 'README.md']);
});

const dayOf = (fields = {}) => ({
  day: DAY, source: 'live', partialFrom: null, gates: [], prs: [], codex: [], tasks: null, conflicts: [], unavailable: {}, ...fields,
});
const gate = (fields) => ({ id: 'g', kind: 'check', lock: 'own', session: null, startedAt: '2026-10-16T10:00:00Z', endedAt: '2026-10-16T10:04:00Z', seconds: 240, waitedSeconds: 0, result: 'pass', ranIn: 'wsl', failing: [], ...fields });
const rowOf = (rows, label) => rows.find((row) => row.label === label);

test('every row of the table names its source, and a fact no record holds says which recorder it waits for, never a zero', () => {
  const rows = throughputRows([dayOf()]);
  for (const row of rows) assert.ok(row.source, `${row.label} names its source`);
  assert.match(rowOf(rows, 'ready to merged').value, /^not recorded \(B1, JH 26\)/);
  assert.match(rowOf(rows, 'idle with nothing armed').value, /^not recorded \(B8\)/);
  assert.match(rowOf(rows, 'tool calls open long').value, /^not recorded \(G, JH 26\)/);
});

test('the table reads the gates, the pull requests and the Codex runs of every day of the window together', () => {
  const day1 = dayOf({
    prs: [{ number: 1, mergedAt: '2026-10-16T10:30:00.000Z', lastCommitAt: '2026-10-16T10:00:00.000Z' }],
    gates: [
      gate({ id: 'a', seconds: 200, waitedSeconds: 60, session: 's1' }),
      gate({ id: 'b', lock: 'ci', ranIn: 'ci', seconds: 140, startedAt: '2026-10-16T11:00:00Z', endedAt: '2026-10-16T11:02:20Z' }),
      gate({ id: 'c', kind: 'land', seconds: 230, result: 'fail', failing: ['x fails'], startedAt: '2026-10-16T12:00:00Z', endedAt: '2026-10-16T12:03:50Z' }),
    ],
    codex: [{ startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed' }],
  });
  const day2 = dayOf({ day: '2026-10-17', prs: [{ number: 2, mergedAt: '2026-10-17T11:00:00.000Z', lastCommitAt: '2026-10-17T10:00:00.000Z' }] });
  const rows = throughputRows([day1, day2]);
  assert.equal(rowOf(rows, 'pull requests merged').value, '2 (0.04 an hour)');
  assert.equal(rowOf(rows, 'last commit to merged').value, 'median 45 min, worst 60 min (2)');
  assert.equal(rowOf(rows, 'commit gates').value, 'here: median 200 s (1); GitHub: median 140 s (1)');
  assert.equal(rowOf(rows, 'gate waits').value, '1 min in all; most: s1 1 min');
  assert.equal(rowOf(rows, 'lands').value, '1, median 230 s, red 1: x fails');
  assert.equal(rowOf(rows, 'Codex reviews').value, '1 runs, median 49 s, p90 49 s, 1 min in all');
});

test('a gate row of a day the gate log no longer covers says from when it is partial', () => {
  const rows = throughputRows([dayOf({ partialFrom: '2026-10-16T10:00:00Z' })]);
  assert.match(rowOf(rows, 'lock busy').value, /partial: 2026-10-16 from 10:00Z/);
});

test('a source that could not be read is said on its rows, not read as nothing', () => {
  const rows = throughputRows([dayOf({ unavailable: { git: 'origin/main is not there' } })]);
  assert.match(rowOf(rows, 'pull requests merged').value, /^not read: 2026-10-16 origin\/main is not there/);
});
