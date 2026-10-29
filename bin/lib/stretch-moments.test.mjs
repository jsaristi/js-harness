import assert from 'node:assert/strict';
import test from 'node:test';
import { goalShares, outsidePlan, timelineOf, workShare } from './stretch-moments.mjs';

const RETURN = Date.parse('2026-10-28T22:00:00Z');
const goals = [{ id: 'G1' }, { id: 'G2' }, { id: 'G3' }, { id: 'G4' }];
const check = (at, results) => ({ at, goals: Object.entries(results).map(([id, met]) => ({ id, met })) });

test('goals met count the last check of each, a goal never checked is unknown and not unmet', () => {
  const shares = goalShares(goals, [check('2026-10-28T13:00:00Z', { G1: true, G2: false, G3: true })], RETURN);
  assert.deepEqual(shares.met, { met: 2, of: 4, unknown: 1 });
});

test('a goal is met in time when the first check that found it met was at or before the return', () => {
  const checks = [
    check('2026-10-28T13:00:00Z', { G1: true, G2: false, G3: false, G4: false }),
    check('2026-10-28T21:00:00Z', { G1: true, G2: true, G3: false, G4: false }),
    check('2026-10-28T23:00:00Z', { G1: true, G2: true, G3: true, G4: false }),
  ];
  const shares = goalShares(goals, checks, RETURN);
  assert.deepEqual(shares.met, { met: 3, of: 4, unknown: 0 });
  // G1 and G2 were found met before the return; G3 only after it, with a check before the return that found it unmet.
  assert.deepEqual(shares.inTime, { met: 2, of: 3, unknown: 0 });
});

test('a goal met with no check before the return is unknown in time, and with every goal so the share is not measured', () => {
  const shares = goalShares(goals.slice(0, 2), [check('2026-10-28T23:00:00Z', { G1: true, G2: true })], RETURN);
  assert.deepEqual(shares.inTime, { met: null, of: 2, unknown: 2 });
});

test('no check at all leaves every goal unknown: the share is not measured, never zero', () => {
  assert.deepEqual(goalShares(goals, [], RETURN).met, { met: null, of: 4, unknown: 4 });
});

test('work done is the finished items among those that do not wait for the user, the others by state', () => {
  const items = [{ id: 'W1', state: 'finished' }, { id: 'W2', state: 'running' }, { id: 'W3', state: 'queued', waitsFor: 'his yes' }, { id: 'W4', state: 'finished' }, { id: 'W5', state: 'silent' }];
  assert.deepEqual(workShare(items), { met: 2, of: 4, unknown: 0, others: { running: ['W2'], silent: ['W5'] }, waiting: ['W3'] });
  assert.deepEqual(workShare([]), { met: 0, of: 0, unknown: 0, others: {}, waiting: [] });
});

const notice = (at, title, kind = 'note', id = title) => ({ at, kind, text: `${kind} of ${title}`, from: { title, id } });

test('outside the plan are the work sessions whose first notice falls inside the stretch and that no item holds', () => {
  const notices = [
    notice('2026-10-28T11:00:00Z', 'JH 70 · docs'),
    notice('2026-10-28T13:00:00Z', 'JH 70 · docs'),
    notice('2026-10-28T13:10:00Z', 'JH 72 · board', 'opened'),
    notice('2026-10-28T15:00:00Z', 'JH 72 · board', 'closed'),
    notice('2026-10-28T14:00:00Z', 'JH 71 · stretch', 'opened'),
    notice('2026-10-28T14:30:00Z', 'JH ORQ · orquestador F8'),
    { at: '2026-10-28T14:40:00Z', kind: 'note', text: 'x', from: { id: 'abc' } },
    notice('2026-10-28T23:30:00Z', 'JH 78 · paid runs', 'opened'),
  ];
  const items = [{ id: 'W1', session: 'JH 71' }];
  const outside = outsidePlan(notices, items, { from: Date.parse('2026-10-28T12:11:00Z'), to: RETURN });
  assert.deepEqual(outside.sessions, [{ label: 'JH 72', title: 'JH 72 · board', first: '2026-10-28T13:10:00Z', last: '2026-10-28T15:00:00Z', notices: 2 }]);
  assert.equal(outside.untitled, 1);
});

test('the timeline holds the merges, the notices that change a state, the failures and the stretch\'s own events, oldest first and cut to the stretch', () => {
  const rows = timelineOf({
    from: Date.parse('2026-10-28T12:11:00Z'),
    to: RETURN,
    prs: [{ number: 626, subject: 'Merge pull request #626 from docs/f8', branch: 'docs/f8', at: '2026-10-28T12:19:00.000Z' }, { number: 600, branch: 'x', at: '2026-10-28T11:00:00.000Z' }],
    notices: [notice('2026-10-28T14:09:00Z', 'JH 68 · s11', 'question'), notice('2026-10-28T14:10:00Z', 'JH 68 · s11', 'note'), notice('2026-10-28T15:00:00Z', 'JH 69 · rec', 'answer')],
    failures: [{ at: '2026-10-28T16:27:00Z', seconds: 1500, what: 'land exit 1', who: 'orquestador' }],
    events: [{ event: 'open', at: '2026-10-28T12:11:00Z' }, { event: 'check', at: '2026-10-28T13:00:00Z', goals: [{ met: true }, { met: false }] }, { event: 'close', at: '2026-10-28T22:00:00Z' }],
  });
  assert.deepEqual(rows.map((row) => [row.at, row.type]), [
    ['2026-10-28T12:11:00.000Z', 'open'],
    ['2026-10-28T12:19:00.000Z', 'merge'],
    ['2026-10-28T13:00:00.000Z', 'check'],
    ['2026-10-28T14:09:00.000Z', 'question'],
    ['2026-10-28T15:00:00.000Z', 'answer'],
    ['2026-10-28T16:27:00.000Z', 'failure'],
    ['2026-10-28T22:00:00.000Z', 'close'],
  ]);
  assert.equal(rows[1].pr, 626);
  assert.equal(rows[2].met, 1);
  assert.equal(rows[3].who, 'JH 68 · s11');
});
