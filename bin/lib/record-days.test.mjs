import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DAYS, parseDayArgs, shiftDay, zone } from './record-days.mjs';

test('the day arguments parse with their defaults: one day, text output, and the flags given', () => {
  assert.deepEqual(parseDayArgs([], Error), { days: 1, json: false });
  assert.deepEqual(parseDayArgs(['--day', '2026-03-08', '--days', '2', '--json', '--cwd', '/work'], Error), { day: '2026-03-08', days: 2, json: true, cwd: '/work' });
});

test('a day argument that is no date, a window out of 1 to 7 days, a flag with no value and an unknown flag are refused', () => {
  assert.equal(MAX_DAYS, 7);
  const refused = (argv) => {
    try {
      parseDayArgs(argv, Error);
    } catch (err) {
      return err.message;
    }
    return null;
  };
  assert.equal(refused(['--day', '2026-02-30']), '--day takes a date as YYYY-MM-DD');
  assert.equal(refused(['--day', '14-10-2026']), '--day takes a date as YYYY-MM-DD');
  assert.equal(refused(['--days', '8']), '--days takes a whole number from 1 to 7');
  assert.equal(refused(['--days', '0']), '--days takes a whole number from 1 to 7');
  assert.equal(refused(['--day']), '--day requires a value');
  assert.equal(refused(['--day', '--json']), '--day requires a value');
  assert.equal(refused(['--what']), 'unknown argument: --what');
});

test('a day moves by calendar days across a clock change, and an offset reads as its UTC label', () => {
  // The clock changes on 2026-03-08 and 2026-11-01; a day is a day of the calendar, whatever the offset then.
  assert.equal(shiftDay('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDay('2026-03-08', -1), '2026-03-07');
  assert.equal(shiftDay('2026-11-01', 1 - 7), '2026-10-26');
  assert.equal(zone(-300), 'UTC-05:00');
  assert.equal(zone(330), 'UTC+05:30');
  assert.equal(zone(0), 'UTC+00:00');
});
