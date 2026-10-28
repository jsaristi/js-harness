import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corrections, gateRuns, itemMeasure, laneOut, parsePlan, sessionTrail, stretchLost } from './stretch.mjs';

const H = 3_600_000;
const T0 = Date.parse('2026-10-28T12:00:00Z');
const at = (hours) => new Date(T0 + hours * H).toISOString();

const goal = (id, command = 'exit 0') => ({ id, text: `goal ${id}`, command });
const item = (id, kind, hours, session) => ({ id, title: `work ${id}`, kind, hours, ...(session ? { session } : {}) });
const plan = (overrides = {}) => ({ hours: 8, slots: 2, goals: [goal('G1')], items: [item('W1', 'build', [2, 3])], ...overrides });

// --- the plan ---

test('a plan of hours, slots, goals with commands and items of the contract kinds is read as written', () => {
  const read = parsePlan(plan({ waits: ['the spend of S5c-a'] }));
  assert.equal(read.error, undefined);
  assert.equal(read.plan.hours, 8);
  assert.deepEqual(read.plan.items[0], { id: 'W1', title: 'work W1', kind: 'build', hours: [2, 3], session: null });
  assert.deepEqual(read.plan.waits, ['the spend of S5c-a']);
});

test('a goal without a command is refused: no goal is graded by the session that ran it', () => {
  assert.match(parsePlan(plan({ goals: [{ id: 'G1', text: 'done' }] })).error, /G1.*command/);
});

test('a plan with no goal, an unknown kind, a range upside down, a repeated id or no slot is refused with why', () => {
  assert.match(parsePlan(plan({ goals: [] })).error, /goal/);
  assert.match(parsePlan(plan({ items: [item('W1', 'chores', [1, 2])] })).error, /W1.*kind.*design, build, verify, docs/);
  assert.match(parsePlan(plan({ items: [item('W1', 'build', [3, 2])] })).error, /W1.*hours/);
  assert.match(parsePlan(plan({ items: [item('W1', 'build', [1, 2]), item('W1', 'docs', [1, 2])] })).error, /W1.*twice/);
  assert.match(parsePlan(plan({ slots: 0 })).error, /slots/);
  assert.match(parsePlan(plan({ hours: -1 })).error, /hours/);
  assert.match(parsePlan('not an object').error, /object/);
});

test('an item is one session\'s work: two items naming the same session are refused', () => {
  assert.match(parsePlan(plan({ items: [item('W1', 'build', [1, 2], 'JH 7'), item('W2', 'docs', [1, 2], 'JH 7')] })).error, /JH 7.*W1.*W2/);
});

// --- the history ---

const done = (kind, estimate, realHours) => ({ kind, estimate, realHours, finished: true });

test('a kind with three items that teach or more is corrected by the median of real over the middle of its estimate', () => {
  const byKind = corrections([done('build', [1, 3], 3), done('build', [2, 2], 3), done('build', [4, 4], 4), done('docs', [1, 1], 5)]);
  // build: 3/2 = 1.5, 3/2 = 1.5, 4/4 = 1: the median is 1.5.
  assert.deepEqual(byKind.build, { factor: 1.5, samples: 3, from: 'kind' });
  // docs has one item of its own: the four items together say 1.5 (1.5, 1.5, 1, 5).
  assert.deepEqual(byKind.docs, { factor: 1.5, samples: 1, from: 'all' });
});

test('with under three items that teach in all, no estimate is corrected', () => {
  assert.deepEqual(corrections([done('docs', [1, 1], 5)]).docs, { factor: 1, samples: 1, from: 'none' });
  assert.deepEqual(corrections([]).verify, { factor: 1, samples: 0, from: 'none' });
});

test('a kind with too few items of its own takes the correction of every kind together', () => {
  const byKind = corrections([done('build', [1, 1], 2), done('build', [1, 1], 2), done('docs', [2, 2], 4), done('verify', [1, 1], 1)]);
  assert.deepEqual(byKind.design, { factor: 2, samples: 0, from: 'all' });
  assert.deepEqual(byKind.build, { factor: 2, samples: 2, from: 'all' });
});

test('only the last ten items that teach count: an unfinished one teaches only once it has run past its estimate', () => {
  const old = Array.from({ length: 10 }, () => done('build', [1, 1], 4));
  const recent = Array.from({ length: 9 }, () => done('build', [1, 1], 2));
  const short = { kind: 'build', estimate: [1, 1], realHours: 0.5, finished: false };
  const over = { kind: 'build', estimate: [1, 1], realHours: 2, finished: false };
  assert.deepEqual(corrections([...old, ...recent, over, short]).build, { factor: 2, samples: 10, from: 'kind' });
});

test('an item whose session started before the stretch was measured in part and teaches nothing', () => {
  const clipped = Array.from({ length: 3 }, () => ({ ...done('verify', [1, 1], 0.2), clipped: true }));
  assert.deepEqual(corrections(clipped).verify, { factor: 1, samples: 0, from: 'none' });
});

// --- the lanes ---

test('items go in plan order to the lane that frees first, and the stretch is filled when no lane ends before it by the low estimate', () => {
  const out = laneOut([{ id: 'A', corrected: [4, 6] }, { id: 'B', corrected: [2, 3] }, { id: 'C', corrected: [6, 8] }], { slots: 2, hours: 8 });
  assert.deepEqual(out.lanes.map((lane) => lane.items.map((one) => one.id)), [['A'], ['B', 'C']]);
  assert.deepEqual(out.lanes[1].items[1].start, [2, 3]);
  assert.deepEqual(out.lanes.map((lane) => lane.end), [[4, 6], [8, 11]]);
  assert.deepEqual(out.queued, [12, 17]);
  assert.equal(out.fills, false);
  // Lane 1 runs out at 4 h by the low estimate: 4 session-hours wait idle before the return.
  assert.deepEqual(out.idle, { hours: 4, from: 4 });
});

test('a stretch whose every lane runs past it by the low estimate is filled, with no idle hours', () => {
  const out = laneOut([{ id: 'A', corrected: [9, 12] }, { id: 'B', corrected: [8, 9] }], { slots: 2, hours: 8 });
  assert.equal(out.fills, true);
  assert.deepEqual(out.idle, { hours: 0, from: null });
});

test('an item that waits for the user is read with what it waits for, and laid in no lane: it cannot run while they are away', () => {
  const read = parsePlan(plan({ items: [{ ...item('W1', 'build', [2, 3]), waitsFor: 'the spend of S5c-a' }] }));
  assert.equal(read.plan.items[0].waitsFor, 'the spend of S5c-a');
  assert.match(parsePlan(plan({ items: [{ ...item('W1', 'build', [2, 3]), waitsFor: 3 }] })).error, /W1.*waitsFor/);
  const out = laneOut([{ id: 'A', corrected: [9, 12] }, { id: 'B', corrected: [9, 9], waitsFor: 'his yes' }], { slots: 2, hours: 8 });
  assert.deepEqual(out.lanes.map((lane) => lane.items.map((one) => one.id)), [['A'], []]);
  assert.deepEqual(out.queued, [9, 12]);
  assert.equal(out.fills, false);
});

test('a slot with no item at all is idle the whole stretch', () => {
  const out = laneOut([{ id: 'A', corrected: [9, 12] }], { slots: 2, hours: 8 });
  assert.equal(out.fills, false);
  assert.deepEqual(out.idle, { hours: 8, from: 0 });
});

// --- a session in the records ---

const notice = (hours, title, kind, extra = {}) => ({ at: at(hours), from: { id: extra.id ?? `id-${title.slice(0, 5)}`, title }, kind, cwd: extra.cwd ?? null });

test('a session is found by its label at the head of a title, and a longer number is another session', () => {
  const notices = [notice(1, 'JH 7 · old', 'note'), notice(2, 'JH 71 · stretch', 'note', { id: 's71', cwd: 'D:\\p\\.claude\\worktrees\\stretch' }), notice(5, 'JH 71 · stretch', 'closed', { id: 's71' })];
  const starts = [{ event: 'started', at: at(0.5), id: 's71b', title: 'JH 71 · stretch', sessionId: 's71-bg', root: 'D:\\p' }];
  const trail = sessionTrail('JH 71', { notices, starts, root: 'D:\\p' });
  assert.equal(trail.firstAt, T0 + 0.5 * H);
  assert.deepEqual(trail.closes, [T0 + 5 * H]);
  assert.equal(trail.lastAt, T0 + 5 * H);
  assert.equal(trail.stoppedAt, null);
  assert.deepEqual([...trail.ids].sort(), ['s71', 's71-bg']);
  assert.deepEqual(trail.cwds, ['d:/p/.claude/worktrees/stretch']);
  assert.equal(sessionTrail('JH 72', { notices, starts, root: 'D:\\p' }), null);
});

test('the main checkout is never a session worktree, so a gate there is not charged to it', () => {
  const trail = sessionTrail('JH 9', { notices: [notice(1, 'JH 9 · x', 'note', { cwd: 'D:\\p' })], starts: [], root: 'D:\\p' });
  assert.deepEqual(trail.cwds, []);
});

test('a background session removed from the record is stopped at that time', () => {
  const starts = [{ event: 'started', at: at(0), id: 'ab12', title: 'JH 9 · x', sessionId: 'ab12-full', root: 'D:\\p' }, { event: 'removed', at: at(2), id: 'ab12' }];
  assert.equal(sessionTrail('JH 9', { notices: [], starts, root: 'D:\\p' }).stoppedAt, T0 + 2 * H);
});

test('a background session another project started under the same label is not this one\'s', () => {
  const starts = [{ event: 'started', at: at(0), id: 'q1', title: 'JH 9 · other', sessionId: 'q1-full', root: 'E:\\q' }, { event: 'removed', at: at(2), id: 'q1' }];
  assert.equal(sessionTrail('JH 9', { notices: [], starts, root: 'D:\\p' }), null);
  const mine = sessionTrail('JH 9', { notices: [], starts: [...starts, { event: 'started', at: at(1), id: 'p1', title: 'JH 9 · x', sessionId: 'p1-full', root: 'd:/p/' }], root: 'D:\\p' });
  assert.deepEqual([[...mine.ids], mine.firstAt, mine.stoppedAt], [['p1-full'], T0 + H, null]);
});

// --- measuring an item ---

const gate = (hours, seconds, result, extra = {}) => ({ id: `g${hours}`, startedAt: at(hours), seconds, result, session: extra.session ?? null, cwd: extra.cwd ?? null, failing: extra.failing ?? [] });
const measure = (trail, now, gates = [], session = 'JH 1') => itemMeasure({ ...item('W1', 'build', [2, 3], session), corrected: [2, 3] }, trail, { openedAt: T0, now, gates });

test('an item runs from the later of the opening and its first record to its first close after that, and its failed gates are its lost time', () => {
  const trail = { ids: new Set(['s1']), cwds: ['d:/p/.claude/worktrees/a'], firstAt: T0 - H, closes: [T0 - 0.5 * H, T0 + 3 * H, T0 + 5 * H], stoppedAt: null };
  const gates = [
    gate(1, 1800, 'fail', { session: 's1', failing: ['bin/x.test.mjs'] }),
    gate(2, 600, 'exit 1', { cwd: 'D:\\p\\.claude\\worktrees\\a\\bin' }),
    gate(2.5, 900, 'pass', { session: 's1' }),
    gate(2.6, 900, 'fail', { session: 'other' }),
    gate(-0.5, 900, 'fail', { session: 's1' }),
  ];
  const measured = measure(trail, T0 + 6 * H, gates);
  assert.equal(measured.state, 'finished');
  assert.equal(measured.clipped, true);
  assert.equal(measured.realHours, 3);
  assert.equal(measured.lostHours, 0.67);
  assert.deepEqual(measured.failures.map((one) => [one.at, one.seconds, one.what]), [[at(1), 1800, 'gate fail: bin/x.test.mjs'], [at(2), 600, 'gate exit 1']]);
});

test('an item whose session has not closed runs to now, one removed is stopped, and one with no record has not started', () => {
  const trail = { ids: new Set(['s1']), cwds: [], firstAt: T0 + H, lastAt: T0 + 3.5 * H, closes: [], stoppedAt: null };
  const running = measure(trail, T0 + 4 * H);
  assert.deepEqual([running.state, running.realHours, running.clipped], ['running', 3, false]);
  const stopped = measure({ ...trail, stoppedAt: T0 + 2 * H }, T0 + 4 * H);
  assert.deepEqual([stopped.state, stopped.realHours], ['stopped', 1]);
  const queued = itemMeasure({ ...item('W2', 'docs', [1, 1]), corrected: [1, 1] }, null, { openedAt: T0, now: T0 + 4 * H, gates: [] });
  assert.deepEqual([queued.state, queued.realHours, queued.lostHours], ['queued', 0, 0]);
});

test('a session that closed or was removed before the opening, with no record after, is done at the opening: 0 h, never running', () => {
  const closed = measure({ ids: new Set(['s1']), cwds: [], firstAt: T0 - 3 * H, lastAt: T0 - H, closes: [T0 - H], stoppedAt: T0 - 0.5 * H }, T0 + 0.5 * H);
  assert.deepEqual([closed.state, closed.realHours], ['finished', 0]);
  const removed = measure({ ids: new Set(['s1']), cwds: [], firstAt: T0 - 3 * H, lastAt: T0 - H, closes: [], stoppedAt: T0 - 0.5 * H }, T0 + 0.5 * H);
  assert.deepEqual([removed.state, removed.realHours], ['stopped', 0]);
  // A record after the opening means it went on: it runs again.
  const reopened = measure({ ids: new Set(['s1']), cwds: [], firstAt: T0 - 3 * H, lastAt: T0 + 0.25 * H, closes: [T0 - H], stoppedAt: null }, T0 + 0.5 * H);
  assert.equal(reopened.state, 'running');
});

test('a running session with no record for longer than the stall rule is silent, measured to its last record and not past it', () => {
  const trail = { ids: new Set(['s1']), cwds: [], firstAt: T0, lastAt: T0 + H, closes: [], stoppedAt: null };
  const silent = measure(trail, T0 + 4 * H, [gate(1.5, 1800, 'pass', { session: 's1' })]);
  // Its last gate ended at 2 h, later than its last notice: that is its last record.
  assert.deepEqual([silent.state, silent.realHours, silent.lastAt], ['silent', 2, at(2)]);
});

test('a gate is a record until it ends: a long failed gate keeps its session running and is lost whole', () => {
  const trail = { ids: new Set(['s1']), cwds: [], firstAt: T0, lastAt: T0 + H, closes: [], stoppedAt: null };
  const gates = [gate(1, 2 * 3600, 'fail', { session: 's1' })];
  assert.deepEqual(['state', 'realHours', 'lostHours'].map((key) => measure(trail, T0 + 3.5 * H, gates)[key]), ['running', 3.5, 2]);
  assert.deepEqual(['state', 'realHours', 'lostHours'].map((key) => measure(trail, T0 + 4.5 * H, gates)[key]), ['silent', 3, 2]);
  // A gate still running counts from its start.
  assert.equal(measure(trail, T0 + 2.5 * H, [gate(2, null, null, { session: 's1' })]).lastAt, at(2));
});

test('a failure that crosses the edge of the span counts only its part inside it', () => {
  const trail = { ids: new Set(['s1']), cwds: [], firstAt: T0, lastAt: T0 + 2 * H, closes: [T0 + 2 * H], stoppedAt: null };
  const measured = measure(trail, T0 + 4 * H, [gate(-0.5, 3600, 'fail', { session: 's1' }), gate(1.5, 3600, 'fail', { session: 's1' })]);
  assert.equal(measured.lostHours, 1);
  assert.deepEqual(measured.failures.map((one) => one.seconds), [1800, 1800]);
});

test('a gate the lead ran in a merge-queue folder is never an item\'s', () => {
  const trail = { ids: new Set(), cwds: ['d:/p'], firstAt: T0, closes: [T0 + 3 * H], stoppedAt: null };
  assert.equal(measure(trail, T0 + 4 * H, [gate(1, 600, 'fail', { cwd: 'D:\\p\\.git\\js-harness\\merge-queue-1-2' })]).lostHours, 0);
});

test('a gate nested in another (lock parent) is folded into the one around it: its failing tests named there, its time once', () => {
  const runs = gateRuns([
    { event: 'start', id: 'outer', at: at(1), session: 's1', cwd: 'D:\\p\\w', lock: 'own', command: 'gate -- npm test' },
    { event: 'start', id: 'inner', at: at(1.01), cwd: 'D:\\p\\w', lock: 'parent', command: 'check' },
    { event: 'end', id: 'inner', at: at(1.4), result: 'fail', sensors: [{ name: 'tests', failing: ['bin/a.test.mjs'] }] },
    { event: 'end', id: 'outer', at: at(1.5), result: 'exit 1' },
    { event: 'start', id: 'open', at: at(2), session: 's1', cwd: 'D:\\p\\w', lock: 'own', command: 'check' },
  ]);
  assert.deepEqual(runs.map((run) => [run.id, run.seconds, run.result, run.failing]), [['outer', 1800, 'exit 1', ['bin/a.test.mjs']], ['open', null, null, []]]);
});

test('a gate that names another session is that session\'s, even in this one\'s worktree; one with no session goes by its folder', () => {
  const trail = { ids: new Set(['s1']), cwds: ['d:/p/.claude/worktrees/a'], firstAt: T0, closes: [T0 + 3 * H], stoppedAt: null };
  const gates = [gate(1, 600, 'fail', { session: 's2', cwd: 'D:\\p\\.claude\\worktrees\\a' }), gate(2, 600, 'fail', { cwd: 'D:\\p\\.claude\\worktrees\\a' })];
  assert.deepEqual(measure(trail, T0 + 4 * H, gates).failures.map((one) => one.at), [at(2)]);
});

test('two failed gates at once are lost once', () => {
  const trail = { ids: new Set(['s1']), cwds: [], firstAt: T0, closes: [T0 + 3 * H], stoppedAt: null };
  assert.equal(measure(trail, T0 + 4 * H, [gate(1, 3600, 'fail', { session: 's1' }), gate(1.5, 3600, 'fail', { session: 's1' })]).lostHours, 1.5);
});

test('the stretch carries the failed lands, their failed gates and the failed Codex runs inside it, which are no item\'s', () => {
  const lands = [{ startedAt: at(1), seconds: 600, exit: 1 }, { startedAt: at(2), seconds: 300, exit: 0 }, { startedAt: at(-1), seconds: 300, exit: 1 }];
  const codex = [{ startedAt: at(3), seconds: 120, outcome: 'failed' }, { startedAt: at(3.5), seconds: 120, outcome: 'reviewed' }];
  const gates = [gate(4, 300, 'fail', { cwd: 'D:\\p\\.git\\js-harness\\merge-queue-1-2' }), gate(5, 300, 'fail', { cwd: 'D:\\p\\w' })];
  const lost = stretchLost({ lands, codex, gates }, { from: T0, to: T0 + 8 * H, root: 'D:\\p' });
  assert.deepEqual(lost.map((one) => [one.at, one.seconds, one.what]), [[at(1), 600, 'land exit 1'], [at(3), 120, 'Codex review failed'], [at(4), 300, 'land gate fail']]);
  // A land that started before the stretch and ended inside it counts its part inside.
  assert.deepEqual(stretchLost({ lands: [{ startedAt: at(-0.25), seconds: 1800, exit: 1 }], codex: [] }, { from: T0, to: T0 + 8 * H, root: 'D:\\p' }).map((one) => one.seconds), [900]);
});

test('a failed land gate of another project is not this stretch\'s: the gate log is the machine\'s', () => {
  const gates = [gate(1, 300, 'fail', { cwd: 'E:\\q\\.git\\js-harness\\merge-queue-1-2' }), gate(2, 300, 'fail', { cwd: 'D:\\p\\.git\\js-harness\\merge-queue-3-4' })];
  assert.deepEqual(stretchLost({ lands: [], codex: [], gates }, { from: T0, to: T0 + 8 * H, root: 'D:\\p' }).map((one) => one.at), [at(2)]);
});
