// What a gate whose tests went to GitHub's machines leaves in the gate log for the throughput review
// (odd/tasks/throughput-review.md, B3): the names of the tests that failed there, as a local gate leaves them, and a
// line for a gate that got no answer and ran here, with the seconds that wait cost. `checkSensors` runs with
// stand-ins for the lock, the sensors and the two halves of the CI gate, so nothing is pushed and no suite runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensors } from './check.mjs';
import { readGateLog } from './lib/gate-log.mjs';

const FIRST = 'the project holds .github/workflows/gate.yml, so a commit\'s tests go to GitHub\'s machines first';

/** The gate log's events after one gate of `ci` (the CI gate's answer), the sensor here passing. */
async function eventsOf(ci) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ci-record-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ci-record-home-'));
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ sensors: { tests: 'run-tests' } }));
  const original = console.error;
  console.error = () => {};
  try {
    await checkSensors(dir, {
      spawn: () => ({ status: 0, signal: null, stdout: '', stderr: '' }),
      git: () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }),
      takeGateLock: async () => ({ release: () => {}, beat: () => {}, lost: () => false, waitedMs: 0 }),
      ciGateWanted: () => FIRST,
      runCiGate: async () => ci,
    }, { home, wait: true, waitMinutes: 1, load: false, log: true, env: {}, remote: 'origin' });
    return readGateLog(home).events;
  } finally {
    console.error = original;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('a red run on CI writes the names of the tests that failed there into its end, as a gate here does', async () => {
  const output = ['✖ failing tests:', '', 'test at bin/x.test.mjs:3:1', '✖ the table reads a day (12.5ms)', '✖ a snapshot is kept once (3ms)'].join('\n');
  const events = await eventsOf({ ran: true, pass: false, url: 'https://github.com/o/r/actions/runs/1', seconds: 230, output });
  const end = events.find((event) => event.event === 'end');
  assert.deepEqual(end.sensors, [{ name: 'tests', seconds: 230, pass: false, ranIn: 'ci', failing: ['the table reads a day', 'a snapshot is kept once'] }]);
});

test('a green run on CI names no failing test', async () => {
  const events = await eventsOf({ ran: true, pass: true, url: 'https://github.com/o/r/actions/runs/1', seconds: 190, output: '' });
  assert.deepEqual(events.find((event) => event.event === 'end').sensors, [{ name: 'tests', seconds: 190, pass: true, ranIn: 'ci' }]);
});

test('a gate with no answer from CI writes why and what the wait cost, under the id of the gate that then runs here', async () => {
  const events = await eventsOf({ ran: false, why: 'the run never started' });
  assert.deepEqual(events.map((event) => event.event), ['ci-fallback', 'start', 'end']);
  const [fallback, start] = events;
  assert.equal(fallback.id, start.id);
  assert.equal(fallback.reason, 'the run never started');
  assert.ok(Number.isFinite(fallback.seconds) && fallback.seconds >= 0);
  assert.equal(start.lock, 'own');
});
