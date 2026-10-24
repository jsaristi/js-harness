import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { METER_TIMEOUT_MS, failureLine, parseRateLimits, readRateLimits } from './codex-meter.mjs';

// A fake `codex app-server`: a child whose stdin answers each request line with what `answer` returns for it.
// Nothing here starts Codex. `answer` returns the lines the server writes back, objects or already-written text.
function fakeCodex(answer, { spawnError = null, exitCode = null } = {}) {
  const sent = [];
  const killed = [];
  const spawned = [];
  const child = new EventEmitter();
  child.pid = 4321;
  child.unrefs = 0;
  child.unref = () => {
    child.unrefs += 1;
  };
  // How a real child ends: `exit` first, then its streams end and `close` follows.
  const ended = (code) => {
    child.emit('exit', code, null);
    setImmediate(() => {
      child.stdout.end();
      child.emit('close', code, null);
    });
  };
  child.ended = ended;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = {
    write(text) {
      const message = JSON.parse(text);
      sent.push(message);
      for (const line of answer(message) ?? []) {
        const text = typeof line === 'string' ? line : JSON.stringify(line);
        setImmediate(() => child.stdout.write(`${text}\n`));
      }
      return true;
    },
    end() {},
  };
  const spawn = (command, args, options) => {
    spawned.push({ command, args, options });
    if (spawnError) setImmediate(() => child.emit('error', spawnError));
    if (exitCode !== null) setImmediate(() => ended(exitCode));
    return child;
  };
  const kill = (target, lifetime) => {
    killed.push({ target, lifetime });
  };
  return { spawn, kill, sent, killed, spawned, child };
}

// The answer of codex-cli 0.163.0 to the read, with the fields this reader does not use and an account identifier
// it must never print. Its numbers were read once from the real server (fields: rateLimits, rateLimitResetCredits).
const RESULT = {
  ordinaryUsageAllowed: true,
  rateLimits: {
    limitId: 'codex',
    primary: { usedPercent: 3, windowDurationMins: 300, resetsAt: 1792839680 },
    secondary: { usedPercent: 8, windowDurationMins: 10080, resetsAt: 1793385515 },
    planType: 'plus',
  },
  rateLimitResetCredits: { availableCount: 1, credits: {} },
  accountId: 'acct-test-123',
};

/** The answers of a real server: the handshake's `initialize` gets a result, the read gets RESULT, and its
 * notification of an account change is written before the answer, as the real one does. */
function answering(result = RESULT) {
  return (message) => {
    if (message.method === 'initialize') return [{ id: message.id, result: { userAgent: 'codex/test' } }];
    if (message.method === 'account/rateLimits/read') return [{ method: 'account/updated', params: {} }, { id: message.id, result }];
    return [];
  };
}

test('the three requests go out in order: initialize, then initialized, then the rate limits read', async () => {
  const fake = fakeCodex(answering());
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(outcome.ok, true);
  assert.deepEqual(fake.sent.map((message) => message.method), ['initialize', 'initialized', 'account/rateLimits/read']);
  assert.ok(fake.sent[0].id !== undefined, 'initialize is a request, so it has an id');
  assert.equal(fake.sent[1].id, undefined, 'initialized is a notification, so it has no id');
  assert.ok(fake.sent[2].id !== undefined, 'the read is a request, so it has an id');
  assert.deepEqual(fake.spawned.map((spawned) => [spawned.command, spawned.args]), [['codex', ['app-server']]]);
});

test('notifications and lines that are not JSON before the answer are skipped', async () => {
  const fake = fakeCodex((message) => {
    if (message.method === 'initialize') return ['not json at all', { id: message.id, result: {} }];
    if (message.method === 'account/rateLimits/read') return [{ method: 'remoteControl/status/changed', params: {} }, { id: message.id, result: RESULT }];
    return [];
  });
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.rateLimits.primary.usedPercent, 3);
});

test('a full answer parses to its numbers, and nothing else of it is kept', () => {
  assert.deepEqual(parseRateLimits(RESULT), {
    fiveHour: { usedPercent: 3, resetsAt: 1792839680 },
    weekly: { usedPercent: 8, resetsAt: 1793385515 },
    resetCredits: 1,
  });
});

test('a missing field reads as unknown (null), and an answer with no limits at all still parses', () => {
  assert.deepEqual(parseRateLimits({ rateLimits: { primary: { usedPercent: 3 } } }), {
    fiveHour: { usedPercent: 3, resetsAt: null },
    weekly: { usedPercent: null, resetsAt: null },
    resetCredits: null,
  });
  assert.deepEqual(parseRateLimits({}), {
    fiveHour: { usedPercent: null, resetsAt: null },
    weekly: { usedPercent: null, resetsAt: null },
    resetCredits: null,
  });
  assert.deepEqual(parseRateLimits(null), {
    fiveHour: { usedPercent: null, resetsAt: null },
    weekly: { usedPercent: null, resetsAt: null },
    resetCredits: null,
  });
});

test('no answer within the timeout: the reason is timeout and the process is killed', async () => {
  const fake = fakeCodex(() => []);
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 30, platform: 'linux' });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'timeout');
  assert.equal(fake.killed.length, 1, 'the child is killed once');
  assert.equal(fake.killed[0].target, fake.child);
  assert.ok(Number.isFinite(fake.killed[0].lifetime.startedAt), 'the kill is given when the child started');
});

test('the answer arrives and the process is killed too, so nothing is left running', async () => {
  const fake = fakeCodex(answering());
  await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(fake.killed.length, 1);
});

test('codex is not on the PATH: the reason is missing', async () => {
  const missing = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
  const fake = fakeCodex(answering(), { spawnError: missing });
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'missing');
});

test('an error answer: the reason is error, with the code the server gave', async () => {
  const fake = fakeCodex((message) => (message.method === 'initialize'
    ? [{ id: message.id, result: {} }]
    : [{ id: message.id, error: { code: -32000, message: 'not signed in' } }]));
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'error');
  assert.equal(outcome.code, -32000);
});

test('the process exits before it answers: the reason is exited, with its exit code', async () => {
  const fake = fakeCodex(() => [], { exitCode: 3 });
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, timeoutMs: 2000, platform: 'linux' });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.reason, 'exited');
  assert.equal(outcome.code, 3);
});

test('the timeout is a named constant of a few seconds', () => {
  assert.equal(typeof METER_TIMEOUT_MS, 'number');
  assert.ok(METER_TIMEOUT_MS >= 2000 && METER_TIMEOUT_MS <= 15000, `a few seconds, not ${METER_TIMEOUT_MS} ms`);
});

// Codex review of 74d679a, P2: `exit` can come before the last stdout data, so a process that wrote its answer and
// exited is read through `close`, which comes after its streams end.
test('an answer written after the exit event and before close is read, not reported as an exit', async () => {
  let fake;
  fake = fakeCodex((message) => {
    if (message.method === 'initialize') return [{ id: message.id, result: {} }];
    if (message.method === 'account/rateLimits/read') {
      setImmediate(() => {
        fake.child.emit('exit', 0, null);
        fake.child.stdout.write(`${JSON.stringify({ id: message.id, result: RESULT })}\n`);
        setImmediate(() => fake.child.emit('close', 0, null));
      });
    }
    return [];
  });
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: fake.kill, platform: 'linux', timeoutMs: 2000 });
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
});

// Codex review of 74d679a, P2: a kill that throws must not leave the child's pipes holding the event loop.
test('a kill that throws still releases the child: its streams are destroyed and it is unref-ed', async () => {
  const fake = fakeCodex(answering());
  const outcome = await readRateLimits({ spawn: fake.spawn, kill: () => { throw new Error('access denied'); }, platform: 'linux', timeoutMs: 2000 });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.killError, 'access denied');
  assert.equal(fake.child.stdout.destroyed, true);
  assert.equal(fake.child.stderr.destroyed, true);
  assert.equal(fake.child.unrefs, 1);
});

// Codex review of 74d679a, P2: the server leads its own process group off Windows, so an interrupted read must
// stop it itself; the handlers are the read's only, and are gone once it ends.
test('an interruption stops the server and the read ends as interrupted, its signal handlers removed', async () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const fake = fakeCodex(() => []);
    const signals = new EventEmitter();
    const reading = readRateLimits({ spawn: fake.spawn, kill: fake.kill, platform: 'linux', timeoutMs: 2000, signals });
    await new Promise((resolve) => setImmediate(resolve));
    signals.emit(signal);
    const outcome = await reading;
    assert.equal(outcome.reason, 'interrupted', signal);
    assert.equal(fake.killed.length, 1, signal);
    assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0, signal);
  }
  assert.match(failureLine({ ok: false, reason: 'interrupted' }), /interrupted/);
});

test('a read that ends by its answer leaves no signal handler behind', async () => {
  const fake = fakeCodex(answering());
  const signals = new EventEmitter();
  await readRateLimits({ spawn: fake.spawn, kill: fake.kill, platform: 'linux', timeoutMs: 2000, signals });
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0);
});
