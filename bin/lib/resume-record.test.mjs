import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago, cutTo, waitingLinesOf } from './resume-record.mjs';

// What the resume after a compaction reads from the channel's record beside the questions (odd/tasks/refresh-open-apply.md,
// T3): on 2026-10-31 JH 114 sent `waiting` at 03:06Z, the lead was compacted minutes later, and its resume named the open
// questions but not the session waiting on it, which sat 50 minutes. The records here are written by hand.
const NOW = Date.parse('2026-10-31T04:00:00.000Z');
const at = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const notice = (title, kind, text, minutes, more = {}) => ({ schema: 1, at: at(minutes), from: { host: 'h', id: `${title}-id`, source: 'claude-code', title }, to: { role: 'orchestrator' }, kind, text, ...more });
const record = (notices) => ({ path: '/h/channel/p.jsonl', notices, questions: [], readings: [], reports: [], skipped: 0 });

test('each work session whose newest notice is waiting is listed with its text, the one waiting longest first', () => {
  const lines = waitingLinesOf(record([
    notice('JH 114 · strip attribution', 'opened', 'starting', 80),
    notice('JH 114 · strip attribution', 'waiting', 'PR 731 waits on the land; I restart it only when told', 54),
    notice('JH 120 · reply', 'note', 'T2 done', 30),
    notice('JH 120 · reply', 'waiting', 'his answer to question 142', 10),
  ]), NOW);
  assert.deepEqual(lines, [
    'Work sessions whose newest notice in the record is waiting (2), each waiting on this session:',
    '  JH 114 "JH 114 · strip attribution"  waiting since 54m ago: PR 731 waits on the land; I restart it only when told',
    '  JH 120 "JH 120 · reply"  waiting since 10m ago: his answer to question 142',
    'Answer each, or start what it waits for, before other work; the board shows each one: js-harness sessions',
  ]);
});

test('a session whose newest notice is not waiting is not listed, whatever it sent before, and none listed gives no lines', () => {
  const lines = waitingLinesOf(record([
    notice('JH 114 · strip attribution', 'waiting', 'I restart it only when told', 54),
    notice('JH 114 · strip attribution', 'ready', 'PR 731 is ready', 20, { pr: 731 }),
    notice('JH 115 · lead duties', 'waiting', 'the land', 40),
    notice('JH 115 · lead duties', 'closed', 'done', 5, { summary: 'docs/sessions/x.md' }),
  ]), NOW);
  assert.deepEqual(lines, []);
});

test('the newest notice is the newest by its time, then by the order written, as the board reads it', () => {
  const late = notice('JH 7 · a', 'waiting', 'sent first, stamped later', 5);
  const early = notice('JH 7 · a', 'note', 'written after, stamped earlier', 30);
  assert.equal(waitingLinesOf(record([late, early]), NOW).length, 3);
  const same = [notice('JH 7 · a', 'note', 'first', 5), notice('JH 7 · a', 'waiting', 'second, same time', 5)];
  assert.equal(waitingLinesOf(record(same), NOW).length, 3);
});

test('notices of the orchestrator, of a sender with no work title, and to a work session are not a work session waiting on the lead', () => {
  const lines = waitingLinesOf(record([
    notice('JH ORQ · orquestador', 'waiting', 'the lead waits', 5),
    notice(null, 'waiting', 'no title', 5),
    { ...notice('JH 9 · b', 'waiting', 'to another session', 5), to: { role: 'work', number: 7 } },
  ]), NOW);
  assert.deepEqual(lines, []);
});

test('a record that could not be read gives no lines here: the questions block already says it was not read', () => {
  assert.deepEqual(waitingLinesOf({ path: '/h/p.jsonl', unavailable: 'EACCES', notices: [] }, NOW), []);
});

test('a long text is cut, and the text is made one line', () => {
  const [, line] = waitingLinesOf(record([notice('JH 7 · a', 'waiting', `${'x'.repeat(400)}`, 5)]), NOW);
  assert.equal(line, `  JH 7 "JH 7 · a"  waiting since 5m ago: ${'x'.repeat(300)}…`);
});

test('ago and cutTo say an age and cut a text as the resume always has', () => {
  assert.deepEqual([ago(NOW - 12 * 60_000, NOW), ago(NOW - 5 * 3600_000, NOW), ago(NOW - 72 * 3600_000, NOW)], ['12m ago', '5h ago', '3d ago']);
  assert.deepEqual([cutTo('abc', 3), cutTo('abcd', 3), cutTo('🙂🙂🙂🙂', 2)], ['abc', 'abc…', '🙂🙂…']);
});
