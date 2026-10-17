// Every commit's gate runs its tests on GitHub's machines first (./lib/ci-gate.mjs), and one that gets no answer
// there runs them here as before. `checkSensors` is called with stand-ins for the lock,
// the sensors, and the two halves of the CI gate, so nothing is pushed and no suite runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensors } from './check.mjs';
import { readGateLog } from './lib/gate-log.mjs';

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ci-gate-'));
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ sensors: { tests: 'run-tests' } }));
  return dir;
}

/** The deps of a gate: a sensor that passes and counts its runs, a lock taken at once that counts its takes, and
 * the CI gate as `wanted` and `ci` say. */
function deps({ wanted, ci }) {
  const seen = { sensors: 0, takes: 0, ciRuns: 0, wantedWith: null, ranWith: null };
  return {
    seen,
    spawn: () => {
      seen.sensors += 1;
      return { status: 0, signal: null, stdout: '', stderr: '' };
    },
    git: () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' }),
    takeGateLock: async () => {
      seen.takes += 1;
      return { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 0 };
    },
    ciGateWanted: (asked) => {
      seen.wantedWith = asked;
      return wanted;
    },
    runCiGate: async (asked) => {
      seen.ciRuns += 1;
      seen.ranWith = asked;
      return ci;
    },
  };
}

async function gate(over, { log = false, look = () => {} } = {}) {
  const dir = project();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ci-gate-home-'));
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  try {
    const d = deps(over);
    const rows = await checkSensors(dir, d, { home, wait: true, waitMinutes: 1, load: false, log, env: { SOME: 'env' }, remote: 'upstream' });
    look(home);
    return { rows, seen: d.seen, errors: errors.join('\n'), dir, home };
  } finally {
    console.error = original;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
}

const URL = 'https://github.com/o/r/actions/runs/42';

const FIRST = 'the project holds .github/workflows/gate.yml, so a commit\'s tests go to GitHub\'s machines first';

test('a gate CI is wanted for runs its tests on CI, takes no lock and runs no sensor here', async () => {
  const { rows, seen, errors, dir } = await gate({ wanted: FIRST, ci: { ran: true, pass: true, url: URL, seconds: 190, output: '' } });
  assert.deepEqual({ sensors: seen.sensors, takes: seen.takes, ciRuns: seen.ciRuns }, { sensors: 0, takes: 0, ciRuns: 1 });
  assert.deepEqual(seen.wantedWith, { cwd: dir, env: { SOME: 'env' } }, 'the lock is not asked');
  assert.deepEqual(seen.ranWith, { cwd: dir, remote: 'upstream', env: { SOME: 'env' } }, 'the remote check was given');
  const tests = rows.find((row) => row.name === 'tests');
  assert.equal(tests.pass, true);
  assert.equal(tests.detail, `ran on GitHub's machines in 190s (.github/workflows/gate.yml): ${URL}`);
  assert.equal(rows.find((row) => row.name === 'gate').detail, `the tests ran on CI: ${FIRST}`);
  assert.ok(errors.split('\n').includes(`check: ${FIRST}; the push of the tree being committed starts their run`), errors);
});

test('a red run on CI fails the gate with the end of its log', async () => {
  const { rows, seen } = await gate({ wanted: FIRST, ci: { ran: true, pass: false, url: URL, seconds: 200, output: 'not ok 3 - a test' } });
  assert.equal(seen.sensors, 0);
  const tests = rows.find((row) => row.name === 'tests');
  assert.equal(tests.pass, false);
  assert.equal(tests.output, 'not ok 3 - a test');
});

test('a gate with no answer from CI runs here under the lock, and says why', async () => {
  const { rows, seen, errors } = await gate({ wanted: FIRST, ci: { ran: false, why: 'gh run list failed: no auth' } });
  assert.deepEqual({ sensors: seen.sensors, takes: seen.takes, ciRuns: seen.ciRuns }, { sensors: 1, takes: 1, ciRuns: 1 });
  assert.equal(rows.find((row) => row.name === 'tests').pass, true);
  assert.match(errors, /^check: no answer from GitHub's machines \(gh run list failed: no auth\), so the tests run here$/m);
});

test('a gate CI is not wanted for (no workflow, the switch, a CI machine) runs here and never asks CI', async () => {
  const { seen } = await gate({ wanted: null, ci: { ran: true, pass: true, url: URL, seconds: 1, output: '' } });
  assert.deepEqual({ sensors: seen.sensors, takes: seen.takes, ciRuns: seen.ciRuns }, { sensors: 1, takes: 1, ciRuns: 0 });
});

test('a gate run on CI leaves its record in the gate log, its tests marked as run there', async () => {
  let events;
  await gate({ wanted: FIRST, ci: { ran: true, pass: false, url: URL, seconds: 230, output: 'x' } }, { log: true, look: (home) => { events = readGateLog(home).events; } });
  assert.deepEqual(events.map((event) => event.event), ['start', 'end']);
  assert.equal(events[0].lock, 'ci');
  assert.equal(events[1].result, 'fail');
  assert.deepEqual(events[1].sensors, [{ name: 'tests', seconds: 230, pass: false, ranIn: 'ci' }]);
});
