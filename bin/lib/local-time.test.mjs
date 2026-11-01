// The local clock the user reads (bin/lib/local-time.mjs, rule:local-time). Node reads `TZ` again whenever it is set,
// so each test names the zone it runs in and the machine's own zone never decides a result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { localHour, localMinute, localZone } from './local-time.mjs';

const inZone = (tz, body) => {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    body();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
};

test('a UTC instant reads as the local minute, hour and zone of the machine: 05:46Z is 00:46 at UTC-05:00', () => {
  inZone('America/Bogota', () => {
    assert.equal(localMinute('2026-11-01T05:46:19Z'), '2026-11-01 00:46');
    assert.equal(localMinute(Date.parse('2026-11-01T04:10:00Z')), '2026-10-31 23:10');
    assert.equal(localHour('2026-11-01T05:46:19Z'), '00:46');
    assert.equal(localZone('2026-11-01T05:46:19Z'), 'UTC-05:00');
  });
});

test('the offset is read from the clock, never a constant: another zone, and a clock change, give their own', () => {
  inZone('Asia/Kolkata', () => {
    assert.equal(localHour('2026-11-01T05:46:19Z'), '11:16');
    assert.equal(localZone('2026-11-01T05:46:19Z'), 'UTC+05:30');
  });
  inZone('America/New_York', () => {
    assert.equal(localZone('2026-10-31T12:00:00Z'), 'UTC-04:00');
    assert.equal(localZone('2026-11-02T12:00:00Z'), 'UTC-05:00');
  });
});
