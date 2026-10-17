import { test } from 'node:test';
import assert from 'node:assert/strict';

import { busySeconds, channelIdle, compareWindows, dailyValues, dayBounds, daysBetween, gateFacts, codexFacts, conflictFiles, gateKind, landFacts, reviewFacts, testTimeFacts, median, outsideChance, parseCommitTimes, parseMergeFiles, parseMerges, percentile, prFacts, taskChanges, taskCounts, throughputRows, withReadyAt } from './throughput.mjs';

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
    seconds: 240, waitedSeconds: 30, result: 'fail', ranIn: 'wsl', traced: false, failing: ['x fails'], land: null, load: null,
  });
  assert.equal(facts.gates[1].ranIn, 'ci');
  assert.equal(facts.gates[2].endedAt, null);
  assert.equal(facts.partialFrom, null);
});

test('a land gate names its candidate folder, and a gate keeps the share of the machine its start found busy', () => {
  const events = [
    start('l', '2026-10-16T10:00:00Z', { cwd: 'D:\\js-harness\\.git\\js-harness\\merge-queue-94876-1792083819428', load: { busy: 6, processors: 8, share: 0.75 } }),
    start('n', '2026-10-16T11:00:00Z', { load: { processors: 8 } }),
  ];
  const [land, other] = gateFacts(events, { from, to }).gates;
  assert.equal(land.land, 'merge-queue-94876-1792083819428');
  assert.equal(land.load, 0.75);
  assert.equal(other.land, null);
  assert.equal(other.load, null);
});

test('a day the log no longer covers from its start says from when it is covered', () => {
  const facts = gateFacts([start('b', '2026-10-16T10:00:00Z'), end('b', '2026-10-16T10:04:00Z')], { from, to });
  assert.equal(facts.partialFrom, '2026-10-16T10:00:00Z');
  assert.equal(gateFacts([start('a', '2026-10-15T20:00:00Z')], { from, to }).partialFrom, null);
  // A log with no event covers nothing of the day, never all of it.
  assert.equal(gateFacts([], { from, to }).partialFrom, '2026-10-17T00:00:00.000Z');
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
    { number: 301, mergedAt: '2026-10-16T00:00:00.000Z', lastCommitAt: '2026-10-15T23:00:00.000Z', docsOnly: null },
  ]);
  assert.equal(prFacts(merges, new Map(), dayBounds('2026-10-17'))[0].lastCommitAt, null);
});

test('a pull request is docs-only when every file its merge changed is Markdown, unknown when git gave none', () => {
  const merges = parseMerges('a1\t2026-10-16T10:00:00Z\tp1 h1\tMerge pull request #1 from x\na2\t2026-10-16T11:00:00Z\tp2 h2\tMerge pull request #2 from y\na3\t2026-10-16T12:00:00Z\tp3 h3\tMerge pull request #3 from z\n');
  const files = parseMergeFiles('\u0001a1\n\nodd/tasks/x.md\nREADME.MD\n\u0001a2\n\nbin/x.mjs\nodd/tasks/x.md\n');
  assert.deepEqual(prFacts(merges, new Map(), { from, to }, files).map((pr) => pr.docsOnly), [true, false, null]);
});

test('the Codex runs of a day, with their seconds and outcome', () => {
  const runs = [
    { startedAt: '2026-10-15T23:59:59Z', durationMs: 1000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T08:00:00Z', durationMs: 49_000, outcome: 'reviewed' },
    { startedAt: '2026-10-16T09:00:00Z', outcome: 'failed' },
  ];
  runs[1].findings = { total: 2 };
  runs[1].part = { index: 1, of: 2 };
  assert.deepEqual(codexFacts(runs, { from, to }), [
    { startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed', findings: 2, part: true },
    { startedAt: '2026-10-16T09:00:00Z', seconds: null, outcome: 'failed', findings: null, part: false },
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
  assert.equal(rowOf(rows, 'ready to merged').value, 'not recorded: 2026-10-16 (before B1, 2026-10-17)');
  assert.equal(rowOf(rows, 'land phases').value, 'not recorded: 2026-10-16 (before B2, 2026-10-17)');
  assert.match(rowOf(rows, 'idle with nothing armed').value, /^not recorded \(B8\)/);
  assert.match(rowOf(rows, 'tool calls open long').value, /^not recorded \(G, JH 26\)/);
});

test('the table reads the gates, the pull requests and the Codex runs of every day of the window together', () => {
  const day1 = dayOf({
    prs: [{ number: 1, mergedAt: '2026-10-16T10:30:00.000Z', lastCommitAt: '2026-10-16T10:00:00.000Z' }],
    gates: [
      gate({ id: 'a', seconds: 200, waitedSeconds: 60, session: 's1' }),
      gate({ id: 'b', lock: 'ci', ranIn: 'ci', seconds: 140, startedAt: '2026-10-16T11:00:00Z', endedAt: '2026-10-16T11:02:20Z' }),
      gate({ id: 'c', kind: 'land', land: 'merge-queue-1', seconds: 230, result: 'fail', startedAt: '2026-10-16T12:00:00Z', endedAt: '2026-10-16T12:03:50Z' }),
      // The check a gate runs under its lock writes a line of its own (lock "parent"): counted once, in its gate.
      gate({ id: 'd', kind: 'land', land: 'merge-queue-1', lock: 'parent', seconds: 220, result: 'fail', failing: ['x fails'], startedAt: '2026-10-16T12:00:05Z', endedAt: '2026-10-16T12:03:45Z' }),
      gate({ id: 'e', kind: 'commit', seconds: 300, startedAt: '2026-10-16T13:00:00Z', endedAt: '2026-10-16T13:05:00Z' }),
    ],
    codex: [{ startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed', findings: 2, part: true }],
    branchMerges: 3,
    conflicts: [{ merge: 'm1', files: ['bin/x.mjs'] }],
  });
  const day2 = dayOf({ day: '2026-10-17', prs: [{ number: 2, mergedAt: '2026-10-17T11:00:00.000Z', lastCommitAt: '2026-10-17T10:00:00.000Z', docsOnly: true }] });
  const rows = throughputRows([day1, day2]);
  assert.equal(rowOf(rows, 'pull requests merged').value, '2 (0.04 an hour)');
  assert.equal(rowOf(rows, 'last commit to merge commit').value, 'median 45 min, p75 60 min, worst 60 min (2); docs-only median 60 min (1); code none');
  // Lock free is the measure's: a session's own check that waited under 5 s, a wrapped commit not among them.
  assert.equal(rowOf(rows, 'commit gates').value, 'here: median 250 s (2), lock free none; GitHub: median 140 s (1)');
  assert.equal(rowOf(rows, 'gate waits').value, '1 min in all; most: s1 1 min');
  assert.equal(rowOf(rows, 'lock busy').value, '0.2 h of 48 h; by kind: commit 1 / 5 min, land 1 / 4 min, check 1 / 3 min');
  assert.equal(rowOf(rows, 'lands').value, '1, median 230 s, red 1; 1 gates for 1 lands');
  assert.equal(rowOf(rows, 'failing tests').value, 'x fails ×1');
  assert.equal(rowOf(rows, 'Codex reviews').value, '1 attempts (1 parts), median 49 s, p90 49 s, 1 min in all; 2 findings');
  assert.equal(rowOf(rows, 'conflicts by file').value, '1 of 3 merges into branches conflicted: bin/x.mjs ×1');
});

test('the load at gate starts is the share of the machine each own gate found busy', () => {
  const rows = throughputRows([dayOf({ gates: [gate({ load: 1 }), gate({ load: 0.5 }), gate({ load: null }), gate({ lock: 'parent', load: 1 })] })]);
  assert.equal(rowOf(rows, 'load at gate starts').value, 'median share 0.75 (2); full at 1 of 2');
});

test('the idle upper bound is each waiting notice of a session to that session next notice, which a session may outwork', () => {
  const notices = [
    { at: '2026-10-16T10:00:00Z', kind: 'waiting', from: { id: 's1', title: 'JH 28' } },
    { at: '2026-10-16T10:30:00Z', kind: 'note', from: { id: 's2', title: 'JH 26' } },
    { at: '2026-10-16T11:00:00Z', kind: 'note', from: { id: 's1', title: 'JH 28' } },
    { at: '2026-10-16T12:00:00Z', kind: 'question', from: { id: 's2', title: 'JH 26' } },
    { at: '2026-10-16T12:10:00Z', kind: 'closed', from: { id: 's2', title: 'JH 26' } },
    { at: '2026-10-16T23:00:00Z', kind: 'waiting', from: { id: 's3', title: 'JH 29' } },
    // As the measure read them: a note that says it is ready, or asks to be told, waits too.
    { at: '2026-10-16T13:00:00Z', kind: 'note', text: 'PR 5 is Ready to land', from: { id: 's4', title: 'JH 30' } },
    { at: '2026-10-16T13:05:00Z', kind: 'note', text: 'notify me when main has it', from: { id: 's4', title: 'JH 30' } },
    { at: '2026-10-16T13:06:00Z', kind: 'note', text: 'already merged', from: { id: 's4', title: 'JH 30' } },
  ];
  const idle = channelIdle(notices, { from, to });
  assert.deepEqual(idle, [
    { session: 's1', title: 'JH 28', at: '2026-10-16T10:00:00Z', minutes: 60 },
    { session: 's2', title: 'JH 26', at: '2026-10-16T12:00:00Z', minutes: 10 },
    { session: 's4', title: 'JH 30', at: '2026-10-16T13:00:00Z', minutes: 5 },
    { session: 's4', title: 'JH 30', at: '2026-10-16T13:05:00Z', minutes: 1 },
  ]);
  idle.splice(2);
  const rows = throughputRows([dayOf({ idle })]);
  assert.equal(rowOf(rows, 'idle upper bound').value, '2 waits, median 35 min, 1.2 session-h in all; longest: JH 28 60 min');
  assert.match(rowOf(rows, 'idle upper bound').source, /may keep working/);
});

test('a gate row of a day the gate log no longer covers says from when it is partial', () => {
  const rows = throughputRows([dayOf({ partialFrom: '2026-10-16T10:00:00Z' })]);
  assert.match(rowOf(rows, 'lock busy').value, /partial: 2026-10-16 from 10:00Z/);
});

test('a source that could not be read is said on its rows, not read as nothing', () => {
  const rows = throughputRows([dayOf({ unavailable: { git: 'origin/main is not there' } })]);
  assert.match(rowOf(rows, 'pull requests merged').value, /^not read: 2026-10-16 origin\/main is not there/);
});

test('a pull request merged twice into main is one pull request, and the table names it', () => {
  const twice = [
    { number: 217, mergedAt: '2026-10-16T10:30:00.000Z', lastCommitAt: '2026-10-16T10:00:00.000Z' },
    { number: 217, mergedAt: '2026-10-16T12:30:00.000Z', lastCommitAt: '2026-10-16T12:00:00.000Z' },
    { number: 218, mergedAt: '2026-10-16T13:00:00.000Z', lastCommitAt: '2026-10-16T12:00:00.000Z' },
  ];
  const rows = throughputRows([dayOf({ prs: twice })]);
  assert.equal(rowOf(rows, 'pull requests merged').value, '2 (0.08 an hour); merged twice: #217');
  // The time of a merge commit is when its land built it, before the land's tests: the row says so.
  assert.match(rowOf(rows, 'last commit to merge commit').source, /before the land's tests/);
  assert.equal(rowOf(rows, 'last commit to merge commit').value, 'median 30 min, p75 60 min, worst 60 min (3); docs-only none; code none');
});

test('a day reads as one value a row, null where its source was not read or the gate log covers it in part', () => {
  const day = dayOf({
    prs: [{ number: 1, mergedAt: '2026-10-16T10:30:00.000Z', lastCommitAt: '2026-10-16T10:00:00.000Z' }],
    gates: [gate({ waitedSeconds: 120 })],
    codex: [{ startedAt: '2026-10-16T08:00:00Z', seconds: 49 }],
  });
  const values = dailyValues(day);
  assert.equal(values['pull requests merged'], 1);
  assert.equal(values['last commit to merge commit, median min'], 30);
  assert.equal(values['gate waits, min'], 2);
  assert.equal(values['Codex attempts'], 1);
  assert.equal(dailyValues({ ...day, partialFrom: '2026-10-16T10:00:00Z' })['gate waits, min'], null);
  assert.equal(dailyValues({ ...day, unavailable: { git: 'no main' } })['pull requests merged'], null);
});

test('under 7 days a side, the comparison prints the ranges and the false-alarm chance and judges nothing', () => {
  const day = (waits) => dayOf({ gates: [gate({ waitedSeconds: waits * 60 })] });
  const [row] = compareWindows([day(216), day(69)], [day(30), day(40)]).filter((r) => r.label === 'gate waits, min');
  assert.deepEqual(row.before, [216, 69]);
  assert.deepEqual(row.after, [30, 40]);
  assert.equal(row.verdict, 'not judged: 2 days a side, under 7; with nothing changed, the after median falls outside the before range at most 100% of the time');
});

test('the chance that an unchanged window\'s median falls outside the before range is the after values taking the far ranks', () => {
  // Seven a side: the median is outside when the 4 highest (or lowest) of 14 are all after, 2 * (7/14 * 6/13 * 5/12 * 4/11).
  assert.equal(outsideChance(7, 7), '7%');
  assert.equal(outsideChance(1, 1), '100%');
  assert.equal(outsideChance(3, 3), '40%');
  // An even after window's median is a mean of two: at least half of them past the range is a bound, not the chance.
  assert.equal(outsideChance(8, 8), 'at most 8%');
  // With a side empty there is no range or no median: no chance to state, never a 0%.
  assert.equal(outsideChance(0, 3), null);
  assert.equal(outsideChance(3, 0), null);
  const empty = compareWindows([dayOf()], [dayOf({ gates: [gate({})] })]).find((row) => row.label === 'commit gates here, median s');
  assert.equal(empty.verdict, 'not judged: 0 days a side, under 7; one side has no value');
});

test('a gate row of a day whose gate log ends before the day settled is partial, said with when it ends', () => {
  const day = dayOf({ gates: [gate({})], partialUntil: '2026-10-16T18:30:00.000Z' });
  assert.equal(rowOf(throughputRows([day]), 'gate waits').value, `0 min in all; partial: ${DAY} until 2026-10-16T18:30Z`);
  assert.equal(dailyValues(day)['gate waits, min'], null);
});

test('with 7 days a side, a row moved only when the after median lies outside the before range', () => {
  const day = (waits) => dayOf({ gates: [gate({ waitedSeconds: waits * 60 })] });
  const before = [100, 120, 90, 110, 130, 95, 105].map(day);
  const label = 'gate waits, min';
  const verdict = (after) => compareWindows(before, after.map(day)).find((r) => r.label === label).verdict;
  assert.equal(verdict([40, 50, 60, 45, 55, 70, 300]), 'moved down: after median 55, before 90 to 130; chance 7% if nothing changed');
  assert.equal(verdict([100, 95, 92, 140, 150, 160, 99]), 'within the before range 90 to 130');
  assert.throws(() => compareWindows(before, [day(1)]), /equal windows/);
});

test('the tasks closed and added are each commit of the day compared with the one before, never the totals subtracted', () => {
  const doc = (lines) => `# F\n\n## Tasks\n\n${lines.join('\n')}\n`;
  const ten = Array.from({ length: 10 }, (_, n) => `- [x] T${n + 1} done`);
  const commits = [
    // Deleting a document of ten done tasks removes ten and closes none.
    { date: '2026-10-16T12:00:00Z', parents: ['p'], files: [{ path: 'odd/tasks/old.md', before: doc(ten), after: null }] },
    // A task closed and then removed counts as closed, and then as removed.
    { date: '2026-10-16T10:00:00Z', parents: ['p'], files: [{ path: 'odd/tasks/a.md', before: doc(['- [ ] T1 one']), after: doc(['- [x] T1 one', '- [ ] T2 two']) }] },
    { date: '2026-10-16T11:00:00Z', parents: ['p'], files: [{ path: 'odd/tasks/a.md', before: doc(['- [x] T1 one', '- [ ] T2 two']), after: doc(['- [ ] T2 two']) }] },
    // A commit outside the day counts nothing in it.
    { date: '2026-10-15T23:00:00Z', parents: ['p'], files: [{ path: 'odd/tasks/a.md', before: null, after: doc(['- [x] T9 x']) }] },
  ];
  assert.deepEqual(taskChanges(commits, dayBounds(DAY)), { closed: 1, reopened: 0, added: 1, removed: 11 });
});

test('the task row sums each day\'s changes, and a task read that failed says so instead of a figure', () => {
  const tasks = (open, changes) => ({ start: { open, done: 0 }, end: { open: open + 1, done: 0 }, changes });
  const rows = throughputRows([
    dayOf({ tasks: tasks(5, { closed: 2, reopened: 1, added: 3, removed: 10 }) }),
    dayOf({ day: '2026-10-17', tasks: tasks(6, { closed: 1, reopened: 0, added: 0, removed: 0 }) }),
  ]);
  assert.equal(rowOf(rows, 'tasks closed and added').value, 'closed 3, reopened 1, added 3, removed 10; open 5 to 7');
  const failed = throughputRows([dayOf({ unavailable: { tasks: 'git log: exit 128' } })]);
  assert.equal(rowOf(failed, 'tasks closed and added').value, `not read: ${DAY} git log: exit 128`);
});

test('a merge-tree that failed leaves the conflicts unread, never a measured zero', () => {
  const rows = throughputRows([dayOf({ branchMerges: 4, unavailable: { conflicts: 'git merge-tree: exit 128' } })]);
  assert.equal(rowOf(rows, 'conflicts by file').value, `not read: ${DAY} git merge-tree: exit 128`);
  assert.match(rowOf(rows, 'pull requests merged').value, /^0 /);
});

test('a Codex run that recorded no count of findings is not counted as none', () => {
  const run = (findings) => ({ startedAt: '2026-10-16T08:00:00Z', seconds: 60, outcome: 'reviewed', findings, part: false });
  assert.match(rowOf(throughputRows([dayOf({ codex: [run(2), run(null)] })]), 'Codex reviews').value, /; 2 findings, 1 attempt with no count$/);
  assert.match(rowOf(throughputRows([dayOf({ codex: [run(null), run(null)] })]), 'Codex reviews').value, /; findings: 2 attempts with no count$/);
  assert.match(rowOf(throughputRows([dayOf({ codex: [run(0)] })]), 'Codex reviews').value, /; 0 findings$/);
});

test('a gate CI gave no answer is a fallback of the day, with why and what the wait cost', () => {
  const events = [
    { v: 1, event: 'ci-fallback', id: 'g1', at: '2026-10-16T10:00:00Z', seconds: 185, reason: 'the run never started' },
    { v: 1, event: 'start', id: 'g1', at: '2026-10-16T10:00:01Z', command: 'check', lock: 'own', waitedSeconds: 0 },
    { v: 1, event: 'end', id: 'g1', at: '2026-10-16T10:04:01Z', seconds: 240, result: 'pass' },
  ];
  const facts = gateFacts(events, dayBounds(DAY));
  assert.deepEqual(facts.fallbacks, [{ id: 'g1', at: '2026-10-16T10:00:00Z', seconds: 185, reason: 'the run never started' }]);
  assert.equal(facts.gates.length, 1);
  const rows = throughputRows([dayOf({ day: '2026-10-17', fallbacks: facts.fallbacks, gates: [gate({ lock: 'ci', ranIn: 'ci', failing: ['a test'] }), gate({ id: 'h', lock: 'ci', ranIn: 'ci', failing: ['a test'] })] })]);
  assert.equal(rowOf(rows, 'CI fallbacks').value, '1, 3 min waited before them; why: the run never started ×1');
  assert.equal(rowOf(rows, 'red tests on CI').value, 'a test ×2');
  // The local row counts what it counted before CI's names were kept, so a before and an after read the same thing.
  assert.equal(rowOf(rows, 'failing tests').value, 'none');
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17' })]), 'CI fallbacks').value, 'none');
});

test('a day before its recorder reached main says so instead of a zero', () => {
  const before = rowOf(throughputRows([dayOf({ day: '2026-10-15' }), dayOf()]), 'CI fallbacks');
  assert.equal(before.value, 'not recorded: 2026-10-15, 2026-10-16 (before B3, 2026-10-17)');
  const mixed = rowOf(throughputRows([dayOf(), dayOf({ day: '2026-10-17', fallbacks: [{ id: 'g', at: '2026-10-17T10:00:00Z', seconds: 60, reason: 'x' }] })]), 'CI fallbacks');
  assert.equal(mixed.value, '1, 1 min waited before them; why: x ×1; not recorded: 2026-10-16 (before B3, 2026-10-17)');
  assert.match(rowOf(throughputRows([dayOf()]), 'red tests on CI').value, /^not recorded: 2026-10-16 \(before B3/);
});

test('a merged pull request is ready from the newest ready notice naming it before its merge', () => {
  const notice = (pr, at, kind = 'ready') => ({ kind, pr, at, from: { id: 's' } });
  const notices = [notice(7, '2026-10-17T04:00:00Z'), notice(7, '2026-10-17T05:00:00Z'), notice(7, '2026-10-17T08:00:00Z'), notice(8, '2026-10-17T05:00:00Z', 'note'), { kind: 'ready', at: '2026-10-17T05:00:00Z' }];
  const prs = withReadyAt([{ number: 7, mergedAt: '2026-10-17T06:00:00Z' }, { number: 8, mergedAt: '2026-10-17T06:00:00Z' }], notices);
  assert.deepEqual(prs.map((pr) => pr.readyAt), ['2026-10-17T05:00:00Z', null]);
  const row = rowOf(throughputRows([dayOf({ day: '2026-10-17', prs: [...prs, { number: 9, mergedAt: '2026-10-17T07:00:00Z', readyAt: '2026-10-17T06:30:00Z' }] })]), 'ready to merged');
  assert.equal(row.value, 'median 45 min, p75 60 min, worst 60 min (2); no ready notice: #8');
  assert.match(row.source, /ready notice/);
  assert.match(rowOf(throughputRows([dayOf()]), 'ready to merged').value, /^not recorded: 2026-10-16 \(before B1, 2026-10-17\)$/);
  // On B1's own day, a pull request merged before B1 did could not be named by a ready notice: said apart, not missing.
  const early = rowOf(throughputRows([dayOf({ day: '2026-10-17', prs: [{ number: 5, mergedAt: '2026-10-17T03:00:00Z', readyAt: null }, ...prs] })]), 'ready to merged');
  assert.equal(early.value, 'median 60 min, p75 60 min, worst 60 min (1); no ready notice: #8; merged before B1 reached main at 03:24Z: 1');
  assert.match(rowOf(throughputRows([dayOf({ day: '2026-10-17', unavailable: { channel: 'no channel record' } })]), 'ready to merged').value, /^not read: 2026-10-17 no channel record$/);
});

test('a land record of the day gives its phases, and a land that ran none is still a land', () => {
  const land = (startedAt, exit, phases) => ({ v: 1, startedAt, endedAt: new Date(Date.parse(startedAt) + 300_000).toISOString(), considered: [1, 2], landed: exit === 0 ? [1] : [], phases, exit });
  const records = [
    land('2026-10-17T05:00:00Z', 0, [{ phase: 'suite', seconds: 270, ok: true }, { phase: 'circleci', seconds: 280, ok: true }, { phase: 'push', seconds: 4, ok: true }]),
    land('2026-10-17T06:00:00Z', 4, [{ phase: 'suite', seconds: 200, ok: false }, { phase: 'suite', seconds: 100, ok: true }]),
    land('2026-10-17T07:00:00Z', 1, []),
    land('2026-10-16T23:00:00Z', 0, []),
    { v: 1, startedAt: 'not a time' },
  ];
  const lands = landFacts(records, dayBounds('2026-10-17'));
  assert.deepEqual(lands.map((one) => [one.startedAt, one.seconds, one.exit, one.landed, one.considered]), [['2026-10-17T05:00:00Z', 300, 0, 1, 2], ['2026-10-17T06:00:00Z', 300, 4, 0, 2], ['2026-10-17T07:00:00Z', 300, 1, 0, 2]]);
  const row = rowOf(throughputRows([dayOf({ day: '2026-10-17', lands })]), 'land phases');
  assert.equal(row.value, '3 lands, median 300 s, landed 1 of 6 looked at; exit 0 ×1, 1 ×1, 4 ×1; suite 3, median 200 s, red 1; circleci 1, median 280 s; push 1, median 4 s');
  assert.match(row.source, /lands\.jsonl/);
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17' })]), 'land phases').value, 'none');
});

test('a day keeps each test file\'s runs, total and longest seconds over the gates of the day that kept times', () => {
  const ends = (id, tests) => [{ v: 1, event: 'start', id, at: '2026-10-17T10:00:00Z', lock: 'own' }, { v: 1, event: 'end', id, at: '2026-10-17T10:04:00Z', seconds: 240, result: 'pass', sensors: [{ name: 'tests', ...tests }] }];
  const events = [...ends('g1', { shadow: { files: 2 } }), ...ends('g2', { skip: { files: 2, skipped: 1 } }), ...ends('g3', {})];
  const facts = gateFacts(events, dayBounds('2026-10-17'));
  assert.deepEqual(facts.gates.map((one) => one.traced), [true, true, false]);
  const kept = new Map([
    ['g1', { id: 'g1', files: [{ test: 'a.test.mjs', seconds: 3 }, { test: 'b.test.mjs', seconds: 1 }] }],
    ['g2', { id: 'g2', files: [{ test: 'a.test.mjs', seconds: 5 }] }],
    ['other-day', { id: 'other-day', files: [{ test: 'a.test.mjs', seconds: 99 }] }],
  ]);
  const times = testTimeFacts(kept, facts.gates.map((one) => one.id));
  assert.deepEqual(times, { gates: 2, files: [{ test: 'a.test.mjs', runs: 2, seconds: 8, max: 5 }, { test: 'b.test.mjs', runs: 1, seconds: 1, max: 1 }] });
  const row = rowOf(throughputRows([dayOf({ day: '2026-10-17', gates: facts.gates, testTimes: times })]), 'test files');
  assert.equal(row.value, '2 of 2 local gates that traced; slowest by mean: a.test.mjs 4 s (max 5 s, 2 runs), b.test.mjs 1 s (max 1 s, 1 run)');
  assert.match(row.source, /test-times\.jsonl/);
  // A day whose facts hold no times (a snapshot or a copy from before B5) says so; a day where nothing traced says that.
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', gates: facts.gates })]), 'test files').value, 'not recorded: 2026-10-17 (no test times kept)');
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', testTimes: { gates: 0, files: [] } })]), 'test files').value, 'no local gate traced');
});

test('the test files row counts only local gates among those that traced, and a day whose times could not be read says so', () => {
  const ends = (id, lock) => [{ v: 1, event: 'start', id, at: '2026-10-17T10:00:00Z', lock }, { v: 1, event: 'end', id, at: '2026-10-17T10:04:00Z', seconds: 240, result: 'pass', sensors: [{ name: 'tests', shadow: { files: 1 } }] }];
  const facts = gateFacts([...ends('local', 'own'), ...ends('remote', 'ci')], dayBounds('2026-10-17'));
  const times = { gates: 1, files: [{ test: 'a.test.mjs', runs: 1, seconds: 2, max: 2 }] };
  // A gate sent to GitHub's machines never writes local times, so it is not one that could have.
  assert.match(rowOf(throughputRows([dayOf({ day: '2026-10-17', gates: facts.gates, testTimes: times })]), 'test files').value, /^1 of 1 local gates that traced/);
  // A day whose times or gate log could not be read was not read, never "not recorded".
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', gates: facts.gates, unavailable: { times: 'EACCES' } })]), 'test files').value, 'not read: 2026-10-17 EACCES');
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', unavailable: { 'gate log': 'EBUSY' } })]), 'test files').value, 'not read: 2026-10-17 EBUSY');
});

test('a day\'s gentle-ai reviews: acknowledged once the record is there and the folder gone, started from when this machine began recording them', () => {
  const start = (lineage, at, seenAt = '2026-10-17T08:00:00.000Z') => ({ v: 1, lineage, at, from: 'birthtime', seenAt });
  const record = {
    starts: [
      start('old', '2026-10-15T09:00:00.000Z'), // live when recording began, born before it: not counted as started
      start('acked', '2026-10-17T09:00:00.000Z'),
      start('acked', '2026-10-17T09:30:00.000Z', '2026-10-17T09:40:00.000Z'), // a second session's line: the earliest kept
      start('open', '2026-10-17T10:00:00.000Z'),
      start('gone', '2026-10-17T11:00:00.000Z'),
      start('burning', '2026-10-17T12:00:00.000Z'),
    ],
    ends: [
      { lineage: 'acked', at: '2026-10-17T09:24:00.000Z' },
      { lineage: 'burning', at: '2026-10-17T12:10:00.000Z' }, // record written, folder not yet deleted: not ended
      { lineage: 'before', at: '2026-10-16T10:00:00.000Z' },
      { lineage: 'untimed', at: '2026-10-17T13:00:00.000Z' },
    ],
    live: ['old', 'open', 'burning'],
  };
  const facts = reviewFacts(record, dayBounds('2026-10-17'));
  assert.equal(facts.since, '2026-10-17T08:00:00.000Z');
  assert.deepEqual(facts.started.map((one) => one.lineage), ['acked', 'open', 'gone', 'burning']);
  assert.deepEqual(facts.ended, [{ lineage: 'acked', at: '2026-10-17T09:24:00.000Z', minutes: 24 }, { lineage: 'untimed', at: '2026-10-17T13:00:00.000Z', minutes: null }]);
  assert.deepEqual([facts.open, facts.gone], [['open', 'burning'], ['gone']]);
  const before = reviewFacts(record, dayBounds('2026-10-16'));
  assert.deepEqual([before.started, before.ended.map((one) => one.lineage)], [[], ['before']]);

  const row = rowOf(throughputRows([dayOf({ day: '2026-10-16', reviews: before }), dayOf({ day: '2026-10-17', reviews: facts })]), 'gentle-ai reviews');
  assert.equal(row.value, '3 acknowledged, median 24 min (1 timed, one lineage each); 4 started, 2 open, 1 gone without acknowledgement; started not recorded: 2026-10-16 (this machine records starts from 2026-10-17 08:00Z)');
  assert.match(row.source, /review-transactions/);
  // No start recorded on this machine at all; a day whose store could not be read says so.
  const none = reviewFacts({ starts: [], ends: [], live: [] }, dayBounds('2026-10-17'));
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', reviews: none })]), 'gentle-ai reviews').value, '0 acknowledged; started not recorded: 2026-10-17 (no review start recorded on this machine)');
  assert.equal(rowOf(throughputRows([dayOf({ day: '2026-10-17', unavailable: { reviews: 'EACCES' } })]), 'gentle-ai reviews').value, 'not read: 2026-10-17 EACCES');
});
