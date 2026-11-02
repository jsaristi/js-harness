import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { FLOOR_SKIP, METER_TIMEOUT_MS, failureLine, floorDebtLines, floorStopped, launchWord, parseRateLimits, readRateLimits, weeklyFloor } from './codex-meter.mjs';

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

// The floor of the weekly limit (rule:codex-weekly-floor), as `codex-review` reads it just before a launch.
const weeklyUsed = (usedPercent) => ({ ok: true, result: { rateLimits: { secondary: { usedPercent, resetsAt: null } } } });

test('the weekly floor stops a launch at or under it, and lets one through above it', () => {
  assert.deepEqual(weeklyFloor(weeklyUsed(98), 2), { stop: true, left: 2 });
  assert.deepEqual(weeklyFloor(weeklyUsed(99.5), 2), { stop: true, left: 0.5 });
  assert.deepEqual(weeklyFloor(weeklyUsed(97), 2), { stop: false, left: 3 });
  assert.deepEqual(weeklyFloor(weeklyUsed(104), 2), { stop: true, left: 0 });
});

test('a reading that failed, or that holds no weekly limit, stops nothing and says why', () => {
  const failed = weeklyFloor({ ok: false, reason: 'missing' }, 2);
  assert.equal(failed.stop, false);
  assert.equal(failed.unread, failureLine({ ok: false, reason: 'missing' }));
  const none = weeklyFloor({ ok: true, result: {} }, 2);
  assert.equal(none.stop, false);
  assert.match(none.unread, /no weekly limit/);
});

test('the stop at the floor starts nothing, asks the user about the reset and says what a typed no runs', () => {
  const said = floorStopped({ left: 2, floor: 2, base: 'abc1234' });
  assert.match(said, /2% left, at or under its floor of 2% \(rule:codex-weekly-floor\)/);
  assert.match(said, /not started and nothing was recorded/);
  assert.match(said, /whether to reset/);
  assert.match(said, /js-harness codex-review --base abc1234 --unavailable/);
  assert.match(said, /js-harness lens-review --base abc1234/);
  assert.match(said, /codex-meter lists on every branch, and the merge door shows, until a Codex review of its range pays it/);
});

test('an interrupted read of the weekly limit stops the launch: the Ctrl-C was meant for the command', () => {
  assert.deepEqual(weeklyFloor({ ok: false, reason: 'interrupted' }, 2), { stop: true, interrupted: true });
  const word = launchWord({ ok: false, reason: 'interrupted' }, { floor: 2, base: 'abc1234' });
  assert.equal(word.note, null);
  assert.match(word.stop, /interrupted, so the review was not started and nothing was recorded/);
});

test('a later part of a review in parts stopped at the floor says the parts before it are kept for the next run', () => {
  const word = launchWord(weeklyUsed(99), { floor: 2, base: 'abc1234', part: { index: 2, of: 3 } });
  assert.match(word.stop, /so part 2 of 3 was not started, the parts before it kept for the next run, and nothing was recorded/);
  assert.match(launchWord(weeklyUsed(99), { floor: 2, base: 'abc1234', part: { index: 1, of: 3 } }).stop, /so the review was not started/);
  assert.deepEqual(launchWord(weeklyUsed(50), { floor: 2, base: 'abc1234' }), { note: null, stop: null });
  assert.match(launchWord({ ok: false, reason: 'missing' }, { floor: 2, base: 'abc1234' }).note, /could not be read before the launch: .+ The review runs without it\./);
});

test('the weekly window is the one whose length says a week, wherever the answer puts it', () => {
  const swapped = parseRateLimits({ rateLimits: { primary: { usedPercent: 99, windowDurationMins: 10080 }, secondary: { usedPercent: 4, windowDurationMins: 300 } } });
  assert.equal(swapped.weekly.usedPercent, 99);
  assert.equal(swapped.fiveHour.usedPercent, 4);
  const alone = parseRateLimits({ rateLimits: { primary: { usedPercent: 99, windowDurationMins: 10080 }, secondary: null } });
  assert.equal(alone.weekly.usedPercent, 99);
  assert.equal(parseRateLimits({ rateLimits: { primary: { usedPercent: 3 }, secondary: { usedPercent: 8 } } }).weekly.usedPercent, 8);
});

test('the share left at the floor is said to one decimal, and a read of a plan says neither reader started and what a no runs', () => {
  assert.match(launchWord(weeklyUsed(98.1), { floor: 2, base: 'abc1234' }).stop, /has 1\.9% left/);
  const read = launchWord(weeklyUsed(99), { floor: 2, read: true });
  assert.match(read.stop, /so neither reader was started and nothing was recorded/);
  assert.match(read.stop, /js-harness double-review skip/);
  assert.match(launchWord({ ok: false, reason: 'missing' }, { floor: 2, read: true }).note, /The read runs without it\./);
  assert.match(floorStopped({ left: 1, floor: 2, base: 'abc1234' }), new RegExp(`--unavailable "${FLOOR_SKIP}: `));
});

test('the floor debts are the skips made at the floor that no Codex review paid, each with the command that pays it', () => {
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const records = [
    { outcome: 'unavailable', base, head, reason: `${FLOOR_SKIP}: no` },
    { outcome: 'unavailable', base, head: 'c'.repeat(40), reason: `${FLOOR_SKIP}: no` },
    { outcome: 'unavailable', base, head, reason: 'codex is not installed here' },
    { outcome: 'reviewed', base, head },
  ];
  const owed = (rec) => rec.head === head;
  const lines = floorDebtLines(records, owed, (rec) => `unavailable ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason}`);
  assert.deepEqual(lines, [`unavailable aaaaaaa..bbbbbbb: ${FLOOR_SKIP}: no; a Codex review pays it: git worktree add --detach <folder> bbbbbbb && js-harness codex-review --base aaaaaaa --again --cwd <folder>`]);
});

test('a damaged record, or one whose debt cannot be told, hides no other floor debt', () => {
  const base = 'a'.repeat(40);
  const lineOf = (rec) => `unavailable ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason}`;
  const records = [
    { outcome: 'unavailable', reason: `${FLOOR_SKIP}: no` },
    { outcome: 'unavailable', base, head: 'd'.repeat(40), reason: `${FLOOR_SKIP}: no` },
    { outcome: 'unavailable', base, head: 'b'.repeat(40), reason: `${FLOOR_SKIP}: no` },
  ];
  const owedOf = (rec) => {
    if (rec.head.startsWith('d')) throw new Error('git could not list the range');
    return true;
  };
  const lines = floorDebtLines(records, owedOf, lineOf);
  assert.equal(lines.length, 2, lines.join('\n'));
  assert.ok(lines[0].startsWith('unavailable aaaaaaa..ddddddd'), 'a debt that cannot be told is listed, not hidden');
  assert.ok(lines[1].startsWith('unavailable aaaaaaa..bbbbbbb'));
});
