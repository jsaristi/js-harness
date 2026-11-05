import { test } from 'node:test';
import assert from 'node:assert/strict';
import { busySeconds, codexFacts, landFacts, median, readRecordLines } from './land-records.mjs';

const from = Date.parse('2026-10-16T00:00:00Z');
const to = Date.parse('2026-10-17T00:00:00Z');

test('busy time is the union of the runs, so two gates at once count once', () => {
  assert.equal(busySeconds([[0, 100_000], [50_000, 150_000], [200_000, 260_000]]), 210);
  assert.equal(busySeconds([]), 0);
});

test('the median of a list, null for none', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
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
    { startedAt: '2026-10-16T08:00:00Z', seconds: 49, outcome: 'reviewed', findings: 2, part: true, reason: null },
    { startedAt: '2026-10-16T09:00:00Z', seconds: null, outcome: 'failed', findings: null, part: false, reason: null },
  ]);
});

// docs/sessions/2026-10-29-jh-79-visual-pages-the-harness-shows-its-moments-as-pages.md, "Left": the pages read
// these facts, and a failure lost the words that say why it failed.
test('a land keeps the last line it said, and a Codex run the reason it was logged with', () => {
  const day = { from: Date.parse('2026-10-29T00:00:00Z'), to: Date.parse('2026-10-30T00:00:00Z') };
  const land = (said) => ({ v: 1, startedAt: '2026-10-29T05:00:00Z', endedAt: '2026-10-29T05:05:00Z', considered: [1], landed: [], phases: [], exit: 1, ...said });
  const lands = landFacts([land({ said: 'PR 644 was refused at push: its head is past the reviewed range' }), land({}), land({ said: 7 })], day);
  assert.deepEqual(lands.map((one) => one.said), ['PR 644 was refused at push: its head is past the reviewed range', null, null]);
  const run = (reason) => ({ startedAt: '2026-10-29T06:00:00Z', durationMs: 1000, outcome: 'failed', ...reason });
  const runs = codexFacts([run({ reason: 'the session ran gpt-5.4 at low, not gpt-5.5 at high' }), run({}), run({ reason: { not: 'words' } })], day);
  assert.deepEqual(runs.map((one) => one.reason), ['the session ran gpt-5.4 at low, not gpt-5.5 at high', null, null]);
});

test('the lands of a day, in order, with their seconds, exit and counts, and none outside it or without a time', () => {
  const land = (startedAt, exit, phases) => ({ v: 1, startedAt, endedAt: new Date(Date.parse(startedAt) + 300_000).toISOString(), considered: [1, 2], landed: exit === 0 ? [1] : [], phases, exit });
  const records = [
    land('2026-10-16T07:00:00Z', 1, []),
    land('2026-10-16T05:00:00Z', 0, [{ phase: 'suite', seconds: 270, ok: true }, { phase: 'bad' }]),
    land('2026-10-15T23:00:00Z', 0, []),
    { v: 1, startedAt: 'not a time' },
    null,
  ];
  assert.deepEqual(landFacts(records, { from, to }), [
    { startedAt: '2026-10-16T05:00:00Z', seconds: 300, exit: 0, landed: 1, considered: 2, phases: [{ phase: 'suite', seconds: 270, ok: true }], said: null },
    { startedAt: '2026-10-16T07:00:00Z', seconds: 300, exit: 1, landed: 0, considered: 2, phases: [], said: null },
  ]);
});

test('a record file reads as its JSON objects: none for no file or one not there, a throw for one that cannot be read', () => {
  const fileSystem = (read) => ({ readFileSync: read });
  assert.deepEqual(readRecordLines(null, fileSystem(() => assert.fail('no file is read'))), []);
  const missing = Object.assign(new Error('gone'), { code: 'ENOENT' });
  assert.deepEqual(readRecordLines('lands.jsonl', fileSystem(() => { throw missing; })), []);
  const denied = Object.assign(new Error('denied'), { code: 'EACCES' });
  assert.throws(() => readRecordLines('lands.jsonl', fileSystem(() => { throw denied; })), /EACCES/);
  const text = '{"a":1}\r\n{broken\n[1,2]\n"word"\nnull\n\n{"b":2}\n';
  assert.deepEqual(readRecordLines('lands.jsonl', fileSystem(() => text)), [{ a: 1 }, { b: 2 }]);
});
