// The UTC-time check of a reply (bin/lib/reply-time.mjs, rule:local-time): a clock time in UTC in the reply's prose is
// found, and one in a code block, inline code, a quoted line or a path is not. The zone is named, so the local times
// the warning gives do not depend on the machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { utcTimesIn, utcTimeWarning } from './reply-time.mjs';

process.env.TZ = 'America/Bogota';
const NOW = Date.parse('2026-11-01T06:00:00Z');

test('the lead\'s reply of 2026-11-01 is caught: its HH:MMZ and its ISO time, each with its line', () => {
  const reply = 'Te fuiste a las 20:04Z y volviste.\nEl informe es de 2026-10-31T19:29:00.000Z.\n\n**Sigo solo** — espero.';
  assert.deepEqual(utcTimesIn(reply).map(({ text, line }) => [text, line]), [['20:04Z', 1], ['2026-10-31T19:29:00.000Z', 2]]);
});

test('a time with "UTC" after it is UTC too, and a date with its minute; a zone named as an offset is not a time', () => {
  assert.deepEqual(utcTimesIn('volvió a las 05:46 UTC, el 2026-10-31 14:08Z').map(({ text }) => text), ['05:46 UTC', '2026-10-31 14:08Z']);
  assert.deepEqual(utcTimesIn('a las 00:46 (hora local, UTC-05:00), y 08:15:12 sin zona, a las 12:30'), []);
});

test('a code block, inline code, a quoted line and a path or URL keep their UTC times: a record shown as a record', () => {
  const reply = [
    'El aviso: `recorded at 00:46 local (2026-11-01T05:46:19Z)`.',
    '> 2026-11-01T05:46:19Z sent by the user',
    'El archivo C:\\logs\\run-05:46Z.txt y https://example.test/at/05:46Z',
    '```',
    'started 2026-10-31T19:29:00Z',
    '```',
  ].join('\n');
  assert.deepEqual(utcTimesIn(reply), []);
});

test('Codex\'s cases: a one-digit hour is a time, a link\'s label is prose, and a code span over two lines keeps its line', () => {
  assert.deepEqual(utcTimesIn('Volvió a las 5:46 UTC, no a las 15:46Z.').map(({ text }) => text), ['5:46 UTC', '15:46Z']);
  assert.deepEqual(utcTimesIn('El aviso es de [05:46Z](https://example.test/record).').map(({ text }) => text), ['05:46Z']);
  assert.deepEqual(utcTimesIn('El registro `started\n2026-10-31T19:29:00Z` y luego\na las 20:04Z.').map(({ text, line }) => [text, line]), [['20:04Z', 3]]);
});

test('a converted time carries the zone of its own instant: one zone is said once, two are said with each time', () => {
  const before = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const now = Date.parse('2026-11-02T12:00:00Z');
    const two = utcTimeWarning('El 2026-07-01T19:29:00Z y el 2026-11-02T10:00:00Z.', { now });
    assert.match(two, /"2026-07-01T19:29:00Z" \(line 1\) is 2026-07-01 15:29 UTC-04:00/);
    assert.match(two, /"2026-11-02T10:00:00Z" \(line 1\) is 2026-11-02 05:00 UTC-05:00/);
    assert.doesNotMatch(two, /, local time UTC/);
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test('the warning names each time with its local time and the rule, and asks for the times again; none when there is none', () => {
  const warning = utcTimeWarning('Te fuiste a las 20:04Z; el informe es de 2026-10-31T19:29:00Z.', { now: NOW });
  assert.match(warning, /^js-harness reply: /);
  assert.match(warning, /rule:local-time/);
  assert.match(warning, /"20:04Z" \(line 1\) is 15:04/);
  assert.match(warning, /"2026-10-31T19:29:00Z" \(line 1\) is 2026-10-31 14:29/);
  assert.match(warning, /UTC-05:00/);
  assert.equal(utcTimeWarning('A las 15:04, hora local (UTC-05:00).', { now: NOW }), null);
  assert.equal(utcTimeWarning('', { now: NOW }), null);
});
