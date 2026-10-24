import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { codexMeterMain, USAGE } from './codex-meter.mjs';

// A fake `codex app-server` (see bin/lib/codex-meter.test.mjs): nothing here starts Codex.
function fakeCodex(answer, { spawnError = null } = {}) {
  const sent = [];
  const killed = [];
  const spawned = [];
  const child = new EventEmitter();
  child.pid = 4321;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = {
    write(text) {
      const message = JSON.parse(text);
      sent.push(message);
      for (const line of answer(message) ?? []) {
        const written = typeof line === 'string' ? line : JSON.stringify(line);
        setImmediate(() => child.stdout.write(`${written}\n`));
      }
      return true;
    },
    end() {},
  };
  const spawn = (command, args, options) => {
    spawned.push({ command, args, options });
    if (spawnError) setImmediate(() => child.emit('error', spawnError));
    return child;
  };
  const kill = (target, lifetime) => {
    killed.push({ target, lifetime });
  };
  return { spawn, kill, sent, killed, spawned, child };
}

// Read the way codex-cli 0.163.0 answers it (numbers read once from the real server; the account identifier is
// one the output must never print).
const RESULT = {
  rateLimits: {
    primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1792839680 },
    secondary: { usedPercent: 8, windowDurationMins: 10080, resetsAt: 1793385515 },
  },
  rateLimitResetCredits: { availableCount: 1 },
  accountId: 'acct-test-123',
};

function answering(result = RESULT) {
  return (message) => {
    if (message.method === 'initialize') return [{ id: message.id, result: {} }];
    if (message.method === 'account/rateLimits/read') return [{ id: message.id, result }];
    return [];
  };
}

/** The clock of the host's time zone, as the command prints a reset: `YYYY-MM-DD HH:MM`, written out here
 * by hand so the test does not call the function it checks. */
function localClock(seconds) {
  const date = new Date(seconds * 1000);
  const two = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Runs the command with a fake server, capturing what it prints and its exit code. */
async function run(argv, fake, extra = {}) {
  const out = [];
  const err = [];
  const code = await codexMeterMain(argv, {
    spawn: fake.spawn,
    kill: fake.kill,
    timeoutMs: 2000,
    platform: 'linux',
    log: (text) => out.push(text),
    error: (text) => err.push(text),
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('the human form: a line for the five-hour window, one for the weekly, and the reset credits left; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out, err } = await run([], fake);
  assert.equal(code, 0, err);
  assert.equal(
    out,
    [
      `five-hour: 3% used, resets at ${localClock(1792839680)}`,
      `weekly: 8% used, resets at ${localClock(1793385515)}`,
      'reset credits left: 1',
    ].join('\n'),
  );
});

test('--json prints the parsed numbers, and no account identifier; exit 0', async () => {
  const fake = fakeCodex(answering());
  const { code, out } = await run(['--json'], fake);
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), {
    fiveHour: { usedPercent: 3, resetsAt: 1792839680 },
    weekly: { usedPercent: 8, resetsAt: 1793385515 },
    resetCredits: 1,
  });
  assert.ok(!out.includes('acct-test-123'), 'no account identifier is printed');
});

test('a field the answer does not hold is printed as unknown, and the command still exits 0', async () => {
  const fake = fakeCodex(answering({ rateLimits: { primary: { usedPercent: 3 } } }));
  const { code, out } = await run([], fake);
  assert.equal(code, 0);
  assert.match(out, /^five-hour: 3% used, resets at unknown$/m);
  assert.match(out, /^weekly: unknown$/m);
  assert.match(out, /^reset credits left: unknown$/m);
});

test('no answer within the timeout: exit 1, one line saying so, and the process is killed', async () => {
  const fake = fakeCodex(() => []);
  const { code, err } = await run([], fake, { timeoutMs: 30 });
  assert.equal(code, 1);
  assert.match(err, /codex app-server did not answer within/);
  assert.equal(fake.killed.length, 1, 'the child is killed once');
});

test('codex is not on the PATH: exit 1 with the line that says so', async () => {
  const missing = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
  const fake = fakeCodex(answering(), { spawnError: missing });
  const { code, err } = await run([], fake);
  assert.equal(code, 1);
  assert.match(err, /^codex is not on PATH: install the Codex CLI, then run this again\.$/m);
});

test('an error answer: exit 1 with one line that names the code', async () => {
  const fake = fakeCodex((message) => (message.method === 'initialize'
    ? [{ id: message.id, result: {} }]
    : [{ id: message.id, error: { code: -32000, message: 'not signed in' } }]));
  const { code, err } = await run([], fake);
  assert.equal(code, 1);
  assert.match(err, /codex app-server answered with an error \(code -32000\)\./);
});

test('an unknown argument: exit 2 with the usage, and codex is not started', async () => {
  const fake = fakeCodex(answering());
  const { code, err } = await run(['--plan'], fake);
  assert.equal(code, 2);
  assert.match(err, /--plan/);
  assert.ok(err.includes(USAGE), 'the usage is printed');
  assert.equal(fake.spawned.length, 0, 'no process is started for a usage error');
});

test('the usage line names the command and its one option', () => {
  assert.match(USAGE, /^Usage: js-harness codex-meter \[--json\]$/m);
});
