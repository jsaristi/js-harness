import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_ROWS, batchesOf, cursorAfter, LATE_MS, pendingRows, rowOf, STATES } from './live-rows.mjs';

// odd/tasks/live-board.md, S2-S3: the channel's notices as the live board's rows, and the cursor that says which
// were sent. Everything here is pure: the notices are synthetic.

const FROM = { host: 'claude-code', id: 'aaaaaaaa-1111-4111-8111-111111111111', source: 'environment', title: 'JH 5 · the canal' };
const notice = (at, kind = 'note', fields = {}) => ({ schema: 'js-harness.channel-notice/v1', at, from: FROM, to: { role: 'orchestrator', number: null }, kind, text: `${kind} at ${at}`, ...fields });

test('a notice becomes a row with its time, session title, kind, text and the state its kind gives', () => {
  const row = rowOf(notice('2026-10-27T05:23:50.996Z', 'waiting'));
  assert.deepEqual(row, {
    id: '2026-10-27T05:23:50.996Z-aaaaaaaa',
    time: '2026-10-27T05:23:50.996Z',
    session: 'JH 5 · the canal',
    kind: 'waiting',
    text: 'waiting at 2026-10-27T05:23:50.996Z',
    state: 'waiting',
  });
  assert.equal(rowOf(notice('2026-10-27T05:00:00.000Z', 'ready', { pr: 596 })).pr, 596);
});

test('every kind of notice has a state, and a sender with no title is named by its id', () => {
  for (const kind of ['opened', 'waiting', 'closed', 'note', 'answer', 'relieved', 'question', 'withdrawn', 'ready']) {
    assert.ok(STATES[kind], kind);
  }
  const hook = rowOf(notice('2026-10-27T05:00:00.000Z', 'note', { from: { host: 'claude-code', id: 'bbbbbbbb-2222', source: 'hook', title: null } }));
  assert.equal(hook.session, 'session bbbbbbbb');
  assert.equal(hook.id, '2026-10-27T05:00:00.000Z-bbbbbbbb');
  assert.equal(rowOf(notice('2026-10-27T05:00:00.000Z', 'note', { from: null })).session, 'unknown session');
});

test('the rows pending are those after the cursor, oldest first, and those at its time it did not send', () => {
  const notices = [notice('2026-10-27T03:00:00.000Z'), notice('2026-10-27T01:00:00.000Z'), notice('2026-10-27T02:00:00.000Z', 'note', { from: { ...FROM, id: 'cccccccc-3' } }), notice('2026-10-27T02:00:00.000Z')];
  const all = pendingRows(notices, null, '2026-10-27T00:00:00.000Z');
  // At one time the record's order holds: cccccccc was written first.
  assert.deepEqual(all.map((row) => row.id), ['2026-10-27T01:00:00.000Z-aaaaaaaa', '2026-10-27T02:00:00.000Z-cccccccc', '2026-10-27T02:00:00.000Z-aaaaaaaa', '2026-10-27T03:00:00.000Z-aaaaaaaa']);
  assert.deepEqual(pendingRows(notices, null, '2026-10-27T01:30:00.000Z').map((row) => row.time), ['2026-10-27T02:00:00.000Z', '2026-10-27T02:00:00.000Z', '2026-10-27T03:00:00.000Z']);
  const cursor = { through: '2026-10-27T02:00:00.000Z', ids: ['2026-10-27T02:00:00.000Z-aaaaaaaa'] };
  assert.deepEqual(pendingRows(notices, cursor, '2026-10-27T00:00:00.000Z').map((row) => row.id), ['2026-10-27T02:00:00.000Z-cccccccc', '2026-10-27T03:00:00.000Z-aaaaaaaa']);
});

test('two notices of one sender in one millisecond get two ids', () => {
  const rows = pendingRows([notice('2026-10-27T01:00:00.000Z'), notice('2026-10-27T01:00:00.000Z', 'closed')], null, '2026-10-27T00:00:00.000Z');
  assert.deepEqual(rows.map((row) => row.id), ['2026-10-27T01:00:00.000Z-aaaaaaaa', '2026-10-27T01:00:00.000Z-aaaaaaaa-2']);
});

test('rows are cut into batches of BATCH_ROWS, each one document named by its last row', () => {
  const notices = Array.from({ length: BATCH_ROWS + 1 }, (_, i) => notice(new Date(Date.UTC(2026, 9, 27, 1, 0, i)).toISOString()));
  const batches = batchesOf(pendingRows(notices, null, '2026-10-27T00:00:00.000Z'));
  assert.equal(batches.length, 2);
  assert.equal(batches[0].rows.length, BATCH_ROWS);
  assert.equal(batches[1].rows.length, 1);
  assert.equal(batches[1].docId, batches[1].rows[0].id);
  assert.equal(batches[1].time, batches[1].rows[0].time);
  assert.deepEqual(batchesOf([]), []);
});

test('the cursor after a sent batch is its last time, with every id sent at that time', () => {
  const rows = pendingRows([notice('2026-10-27T01:00:00.000Z'), notice('2026-10-27T02:00:00.000Z'), notice('2026-10-27T02:00:00.000Z', 'note', { from: { ...FROM, id: 'cccccccc-3' } })], null, '2026-10-27T00:00:00.000Z');
  assert.deepEqual(cursorAfter(null, rows), { through: '2026-10-27T02:00:00.000Z', ids: ['2026-10-27T02:00:00.000Z-aaaaaaaa', '2026-10-27T02:00:00.000Z-cccccccc'] });
  const earlier = { through: '2026-10-27T02:00:00.000Z', ids: ['2026-10-27T02:00:00.000Z-aaaaaaaa'] };
  assert.deepEqual(cursorAfter(earlier, rows.slice(2)), { through: '2026-10-27T02:00:00.000Z', ids: ['2026-10-27T02:00:00.000Z-aaaaaaaa', '2026-10-27T02:00:00.000Z-cccccccc'] });
  const later = { through: '2026-10-27T05:00:00.000Z', ids: ['2026-10-27T05:00:00.000Z-aaaaaaaa'] };
  assert.deepEqual(cursorAfter(later, rows), later, 'a file sent late never moves the cursor back');
});

// `notify` stamps a notice's time before it appends it, so a notice can land after a later one was sent. The cursor
// holds every id it sent within LATE_MS of its time, and such a notice is still pending; one older than that is not.
test('a notice appended after a later one was sent is still pending, within LATE_MS of the cursor', () => {
  const sent = pendingRows([notice('2026-10-27T03:00:00.000Z'), notice('2026-10-27T02:50:00.000Z', 'note', { from: { ...FROM, id: 'cccccccc-3' } })], null, '2026-10-27T00:00:00.000Z');
  const cursor = cursorAfter(null, sent);
  assert.equal(LATE_MS, 30 * 60 * 1000);
  assert.deepEqual(cursor, { through: '2026-10-27T03:00:00.000Z', ids: ['2026-10-27T02:50:00.000Z-cccccccc', '2026-10-27T03:00:00.000Z-aaaaaaaa'] });
  const record = [notice('2026-10-27T03:00:00.000Z'), notice('2026-10-27T02:50:00.000Z', 'note', { from: { ...FROM, id: 'cccccccc-3' } }), notice('2026-10-27T02:45:00.000Z', 'ready', { pr: 7 }), notice('2026-10-27T02:00:00.000Z', 'closed')];
  const late = pendingRows(record, cursor, '2026-10-27T00:00:00.000Z');
  assert.deepEqual(late.map((row) => row.id), ['2026-10-27T02:45:00.000Z-aaaaaaaa']);
  const after = cursorAfter(cursor, late);
  assert.equal(after.through, '2026-10-27T03:00:00.000Z', 'a late row never moves the cursor back');
  assert.ok(after.ids.includes('2026-10-27T02:45:00.000Z-aaaaaaaa'));
  assert.deepEqual(pendingRows(record, after, '2026-10-27T00:00:00.000Z'), []);
  // Ids older than LATE_MS before the cursor's time are dropped as it moves on, so the cursor stays small.
  const moved = cursorAfter(after, pendingRows([notice('2026-10-27T04:00:00.000Z')], after, '2026-10-27T00:00:00.000Z'));
  assert.deepEqual(moved, { through: '2026-10-27T04:00:00.000Z', ids: ['2026-10-27T04:00:00.000Z-aaaaaaaa'] });
});
