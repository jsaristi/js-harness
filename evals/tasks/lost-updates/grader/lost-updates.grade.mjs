// Hidden grader of `lost-updates`. Copied into the workspace as `.eval-grader/` after the agent exits, so
// `..` is the workspace. Every test imports the project itself, so a broken module fails tests one by one
// and the score stays fractional. Each test names the clause of docs/DESIGN.md (G1 to G7, Q1 to Q3, "The
// store", "The queue") or docs/ADAPTER.md or the README that it checks. The disk is the fake adapter of
// fake-adapter.mjs, which completes calls in an order the test chooses and fails the calls it picks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFakeAdapter } from './fake-adapter.mjs';

const T = { timeout: 5000 };
const CHILD = { timeout: 20000 };
const PATH = '/data/cellar.json';
// docs/DESIGN.md G4: `<path>.tmp-<n>`, with `<n>` a decimal number
const TEMP = new RegExp(`^${PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.tmp-\\d+$`);
const SCENARIO = fileURLToPath(new URL('./unhandled-scenario.mjs', import.meta.url));
const WORKSPACE = fileURLToPath(new URL('..', import.meta.url));
const loadIndex = () => import('../src/index.mjs');

async function open({ files } = {}) {
  const { createStore } = await loadIndex();
  const fake = createFakeAdapter({ files });
  return { fake, store: createStore({ path: PATH, fs: fake.adapter }) };
}

/** A store and a queue on a fake clock; `setNow` moves the clock. The visibility timeout is 500 ms. */
async function openQueue() {
  const { createQueue } = await loadIndex();
  const { fake, store } = await open();
  let now = 0;
  const queue = createQueue(store, { clock: () => now, visibilityMs: 500 });
  return { fake, store, queue, setNow: (value) => { now = value; } };
}

const fileData = (fake) => JSON.parse(fake.files.get(PATH));
const parse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};
/** A failure rule for the `writeFile` calls whose new state satisfies `holds`. */
const writes = (holds) => ({ method, data }) => method === 'writeFile' && holds(parse(data));
/** The same for the `rename` calls that move a file whose state satisfies `holds`. */
const renames = (holds) => ({ method, data }) => method === 'rename' && holds(parse(data));
const later = () => new Promise((resolve) => setImmediate(resolve));
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
const stats = (pending, claimed, done) => ({ pending, claimed, done });

// A script of operations, with the outcome of applying it to a plain object in call order.
const inc = (n) => (n ?? 0) + 1;
const twice = (n) => (n ?? 1) * 2;
const SCRIPT = [
  { op: 'set', key: 'a', value: 1 },
  { op: 'update', key: 'a', fn: inc },
  { op: 'set', key: 'b', value: 10 },
  { op: 'delete', key: 'a' },
  { op: 'update', key: 'b', fn: twice },
  { op: 'update', key: 'c', fn: inc },
  { op: 'set', key: 'a', value: 5 },
  { op: 'delete', key: 'b' },
  { op: 'update', key: 'a', fn: twice },
  { op: 'update', key: 'c', fn: inc },
];

function callStore(store, step) {
  if (step.op === 'set') return store.set(step.key, step.value);
  if (step.op === 'update') return store.update(step.key, step.fn);
  return store.delete(step.key);
}

/** Applies a step to `model` and returns what the store's call must resolve with. */
function callModel(model, step) {
  if (step.op === 'set') {
    model[step.key] = step.value;
    return undefined;
  }
  if (step.op === 'update') {
    model[step.key] = step.fn(model[step.key]);
    return model[step.key];
  }
  const existed = Object.hasOwn(model, step.key);
  delete model[step.key];
  return existed;
}

function unhandledIn(scenario) {
  const run = spawnSync(process.execPath, [SCENARIO, scenario], { cwd: WORKSPACE, env: childEnv(), encoding: 'utf8', timeout: 15000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').at(-1)).unhandled;
}

// ---- the store: one call at a time ---------------------------------------------------------------------

// DESIGN "The store": get resolves with the value or undefined; delete resolves true when the key existed
test('model: set, get and delete work one call at a time', T, async () => {
  const { store } = await open();
  await store.set('a', { n: 1 });
  assert.deepEqual(await store.get('a'), { n: 1 });
  assert.equal(await store.get('missing'), undefined);
  assert.equal(await store.delete('a'), true);
  assert.equal(await store.delete('a'), false);
  assert.equal(await store.get('a'), undefined);
});

// DESIGN "The store": the file is one JSON object of keys and values, and a new store reads it back
test('model: the file is one JSON object that a new store reads back', T, async () => {
  const { createStore } = await loadIndex();
  const { fake, store } = await open();
  await store.set('a', 1);
  await store.set('b', [2, 3]);
  await store.set('c', 'x');
  await store.delete('c');
  assert.deepEqual(fileData(fake), { a: 1, b: [2, 3] });
  const next = createStore({ path: PATH, fs: fake.adapter });
  assert.deepEqual(await next.get('b'), [2, 3]);
  assert.equal(await next.get('c'), undefined);
});

// DESIGN "The store": a missing file (ENOENT) is an empty store; an existing one is read
test('model: a missing file is an empty store and an existing file is read', T, async () => {
  const empty = await open();
  assert.equal(await empty.store.get('a'), undefined);
  const { store } = await open({ files: { [PATH]: '{"a":1,"b":{"c":2}}' } });
  assert.equal(await store.get('a'), 1);
  assert.deepEqual(await store.get('b'), { c: 2 });
});

// DESIGN "The store": any other read error rejects that operation, and the next operation reads again
test('model: a failed first read rejects with its code and the next operation reads again', T, async () => {
  const { fake, store } = await open({ files: { [PATH]: '{"a":1}' } });
  fake.failWhen(({ method }) => method === 'readFile', 'EIO');
  await assert.rejects(store.get('a'), { code: 'EIO' });
  fake.heal();
  assert.equal(await store.get('a'), 1);
});

// ---- G1 atomic update ----------------------------------------------------------------------------------

// DESIGN G1: if fn throws or rejects, update rejects with that error, nothing changes, later operations go on
test('G1: a function that throws makes update reject and changes nothing', T, async () => {
  const { store } = await open();
  await store.set('n', 1);
  const boom = new RangeError('boom');
  await assert.rejects(store.update('n', () => { throw boom; }), (error) => error === boom);
  await assert.rejects(store.update('n', async () => { throw boom; }), (error) => error === boom);
  assert.equal(await store.get('n'), 1);
  assert.equal(await store.update('n', (n) => n + 1), 2);
  assert.equal(await store.update('fresh', (n) => n ?? 'none'), 'none');
});

// DESIGN G1: N concurrent increments never lose one
test('G1: ten concurrent increments are all applied', T, async () => {
  const { fake, store } = await open();
  await Promise.all(Array.from({ length: 10 }, () => store.update('hits', inc)));
  assert.equal(await store.get('hits'), 10);
  await store.flush();
  assert.equal(fileData(fake).hits, 10);
});

// DESIGN G1: fn may return a promise; update resolves with the new value, in call order
test('G1: fifty concurrent increments with an asynchronous function are all applied', T, async () => {
  const { store } = await open();
  const results = await Promise.all(
    Array.from({ length: 50 }, () => store.update('hits', async (n) => { await later(); return inc(n); })),
  );
  assert.deepEqual(results, Array.from({ length: 50 }, (_, index) => index + 1));
  assert.equal(await store.get('hits'), 50);
});

// DESIGN G1 ("after every operation called before it has finished") with G2, the I/O completing in reverse
test('G1: an update sees the result of every operation called before it', T, async () => {
  const { fake, store } = await open();
  fake.hold();
  const calls = [store.set('n', 100), store.update('n', (n) => n + 1), store.update('n', (n) => n * 2), store.get('n')];
  await fake.drain('lifo');
  assert.deepEqual(await Promise.all(calls), [undefined, 101, 202, 202]);
});

// ---- G2 call order -------------------------------------------------------------------------------------

// DESIGN G2: after flush() the file holds the state of the calls in order, even if the first write completes last
test('G2: writes that complete in reverse order leave the state of the last call', T, async () => {
  const { fake, store } = await open();
  fake.hold();
  const calls = [1, 2, 3, 4, 5].map((n) => store.set('mode', n));
  calls.push(store.set('other', 'x'));
  const flushed = store.flush();
  await fake.drain('lifo');
  await Promise.all([...calls, flushed]);
  assert.deepEqual(fileData(fake), { mode: 5, other: 'x' });
});

// DESIGN G2: operations take effect in call order, not in the order their I/O completes
test('G2: any order of completion gives the state of applying the calls in order', T, async () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { fake, store } = await open();
    const model = {};
    const expected = SCRIPT.map((step) => callModel(model, step));
    fake.hold();
    const calls = SCRIPT.map((step) => callStore(store, step));
    const flushed = store.flush();
    await fake.drain({ seed });
    assert.deepEqual(await Promise.all(calls), expected, `results, seed ${seed}`);
    await flushed;
    assert.deepEqual(fileData(fake), model, `file, seed ${seed}`);
  }
});

// DESIGN G2: a get sees the operations called before it and none called after it
test('G2: a get sees the operations called before it and none called after it', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.hold();
  const before = store.get('a');
  const write = store.set('a', 2);
  const after = store.get('a');
  await fake.drain('lifo');
  assert.deepEqual(await Promise.all([before, write, after]), [1, undefined, 2]);
});

// ---- G3 read your writes -------------------------------------------------------------------------------

// DESIGN G3: get called after set resolves to the value, even when the set was not awaited
test('G3: a get right after an unawaited set resolves to the new value', T, async () => {
  const { store } = await open();
  store.set('a', 1);
  assert.equal(await store.get('a'), 1);
  store.update('a', inc);
  assert.equal(await store.get('a'), 2);
});

// DESIGN G3, with the I/O completing in reverse order
test('G3: a get after a set sees it however the I/O completes', T, async () => {
  const { fake, store } = await open();
  fake.hold();
  const write = store.set('a', 1);
  const read = store.get('a');
  await fake.drain('lifo');
  await write;
  assert.equal(await read, 1);
});

// DESIGN G3 ("unless the write of that set fails") and G5 (a get returns the old values)
test('G3: a get after a set whose write fails resolves to the old value', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.failWhen(writes((data) => data.a === 2), 'ENOSPC');
  const [write, read] = await Promise.allSettled([store.set('a', 2), store.get('a')]);
  assert.equal(write.status, 'rejected');
  assert.equal(write.reason.code, 'ENOSPC');
  assert.deepEqual(read, { status: 'fulfilled', value: 1 });
  assert.equal(await store.get('a'), 1);
});

// ---- G4 crash-safe writes ------------------------------------------------------------------------------

// DESIGN G4: writeFile('<path>.tmp-<n>') then rename onto the path; the file itself is never written
test('G4: every write goes to a temporary file in the same directory and is renamed over the file', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  await store.update('a', inc);
  await store.set('b', 'x');
  await store.delete('a');
  const writeCalls = fake.calls.filter((call) => call.method === 'writeFile');
  assert.ok(writeCalls.length >= 4, 'each operation writes');
  for (const call of writeCalls) {
    assert.match(call.path, TEMP);
    const after = fake.calls.slice(fake.calls.indexOf(call) + 1);
    assert.ok(after.some((next) => next.method === 'rename' && next.path === call.path && next.to === PATH), `${call.path} is renamed onto the file`);
  }
  assert.deepEqual([...fake.files.keys()], [PATH]);
  assert.deepEqual(fileData(fake), { b: 'x' });
});

// DESIGN G4: a failure at any point leaves the file holding a complete earlier state, never half of a new one
test('G4: a write that fails half way leaves the store file as it was', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.failWhen(writes((data) => data.a === 2), 'ENOSPC', { partial: true });
  await assert.rejects(store.set('a', 2), { code: 'ENOSPC' });
  assert.deepEqual(fileData(fake), { a: 1 });
});

// ---- G5 failure isolation ------------------------------------------------------------------------------

// DESIGN G5 (1) and "the write carried exactly one operation": only the operation whose write failed rejects
test('G5: a failed write rejects only its own operation, with the code of the adapter', T, async () => {
  for (const order of ['fifo', 'lifo']) {
    const { fake, store } = await open();
    fake.failWhen(writes((data) => data.b !== undefined), 'ENOSPC');
    fake.hold();
    const outcomes = Promise.allSettled([store.set('a', 1), store.set('b', 2), store.set('c', 3)]);
    await fake.drain(order);
    const results = await outcomes;
    assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected', 'fulfilled'], order);
    assert.equal(results[1].reason.code, 'ENOSPC', order);
    await store.flush();
    assert.deepEqual(fileData(fake), { a: 1, c: 3 }, order);
    assert.equal(await store.get('b'), undefined, order);
  }
});

// DESIGN G5 (2): operations already waiting apply to the last durable state, not to the one that failed
test('G5: operations waiting behind a failed write apply to the last durable state', T, async () => {
  const { fake, store } = await open();
  await store.set('n', 1);
  fake.failWhen(writes((data) => data.n === 2), 'EIO');
  const [failed, next, read] = await Promise.allSettled([store.update('n', (n) => n + 1), store.update('n', (n) => n + 10), store.get('n')]);
  assert.equal(failed.status, 'rejected');
  assert.equal(failed.reason.code, 'EIO');
  assert.deepEqual(next, { status: 'fulfilled', value: 11 });
  assert.deepEqual(read, { status: 'fulfilled', value: 11 });
  assert.equal(fileData(fake).n, 11);
});

// DESIGN G5 with G2: which operations fail does not depend on the order in which the I/O completes
test('G5: any order of completion rejects the same operations and keeps the others', T, async () => {
  const failing = ['k2', 'k4', 'k6', 'k8'];
  for (const seed of [1, 2, 3, 4]) {
    const { fake, store } = await open();
    fake.failWhen(writes((data) => failing.some((key) => data[key] !== undefined)), 'ENOSPC');
    fake.hold();
    const outcomes = Promise.allSettled(Array.from({ length: 8 }, (_, index) => store.set(`k${index + 1}`, index)));
    await fake.drain({ seed });
    const results = await outcomes;
    assert.deepEqual(
      results.map((result) => result.status),
      ['fulfilled', 'rejected', 'fulfilled', 'rejected', 'fulfilled', 'rejected', 'fulfilled', 'rejected'],
      `seed ${seed}`,
    );
    await store.flush();
    assert.deepEqual(fileData(fake), { k1: 0, k3: 2, k5: 4, k7: 6 }, `seed ${seed}`);
  }
});

// DESIGN G1 (fn may change the value in place; if it throws nothing changes), G5 (back at the last durable
// state) and "The store" (values handed out are copies)
test('G5: a failed update leaves no trace of a function that changed the value in place', T, async () => {
  const { fake, store } = await open();
  await store.set('o', { n: 1 });
  fake.failWhen(writes((data) => data.o?.n === 2), 'ENOSPC');
  await assert.rejects(store.update('o', (o) => { o.n += 1; return o; }), { code: 'ENOSPC' });
  assert.deepEqual(await store.get('o'), { n: 1 });
  await assert.rejects(store.update('o', (o) => { o.n = 50; throw new Error('boom'); }), /boom/);
  assert.deepEqual(await store.get('o'), { n: 1 });
  const copy = await store.get('o');
  copy.n = 99;
  assert.deepEqual(await store.get('o'), { n: 1 });
  const returned = await store.update('o', (o) => ({ ...o, m: 1 }));
  returned.m = 5;
  assert.deepEqual(await store.get('o'), { n: 1, m: 1 });
  assert.deepEqual(fileData(fake).o, { n: 1, m: 1 });
});

// DESIGN G5 (3): the temporary file of a failed write is removed with unlink
test('G5: a failed write removes its temporary file', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.failWhen(writes((data) => data.a === 2), 'ENOSPC', { partial: true });
  await assert.rejects(store.set('a', 2), { code: 'ENOSPC' });
  assert.ok(fake.calls.some((call) => call.method === 'unlink' && TEMP.test(call.path)), 'the temporary file is unlinked');
  assert.deepEqual([...fake.files.keys()], [PATH]);
});

// DESIGN G4 and G5: a failed rename is a failed write too; the store file keeps its earlier state
test('G5: a failed rename removes the temporary file and leaves the store file untouched', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.failWhen(renames((data) => data.a === 2), 'EXDEV');
  await assert.rejects(store.set('a', 2), { code: 'EXDEV' });
  assert.ok(fake.calls.some((call) => call.method === 'unlink' && TEMP.test(call.path)), 'the temporary file is unlinked');
  assert.deepEqual([...fake.files.keys()], [PATH]);
  assert.deepEqual(fileData(fake), { a: 1 });
  assert.equal(await store.get('a'), 1);
});

// DESIGN G5 (3), (4): the failure of that unlink is ignored, the caller gets the error of the write, and later operations go on
test('G5: a failing unlink does not hide the error of the write', T, async () => {
  const { fake, store } = await open();
  await store.set('a', 1);
  fake.failWhen(writes((data) => data.a === 2), 'ENOSPC');
  fake.failWhen(({ method }) => method === 'unlink', 'EPERM');
  await assert.rejects(store.set('a', 2), { code: 'ENOSPC' });
  assert.ok(fake.calls.some((call) => call.method === 'unlink'), 'the cleanup was tried');
  await store.set('b', 3);
  assert.deepEqual(fileData(fake), { a: 1, b: 3 });
});

// ---- G6 flush ------------------------------------------------------------------------------------------

// DESIGN G6: flush() resolves once every operation called before it is durable or has rejected
test('G6: flush on a store with nothing to do resolves', T, async () => {
  const { store } = await open();
  assert.equal(await store.flush(), undefined);
  await store.set('a', 1);
  assert.equal(await store.flush(), undefined);
});

// DESIGN G6: flush() waits for every operation called before it, even those that have not started their I/O
test('G6: flush waits for every operation called before it', T, async () => {
  const { fake, store } = await open();
  fake.hold();
  const calls = [store.set('a', 1), store.update('a', inc), store.set('b', 5)];
  let flushed = false;
  const done = store.flush().then(() => { flushed = true; });
  await fake.settle();
  assert.equal(flushed, false, 'flush resolved while operations were waiting');
  await fake.drain('fifo');
  await done;
  await Promise.all(calls);
  assert.deepEqual(fileData(fake), { a: 2, b: 5 });
});

// DESIGN G6: flush() resolves with nothing and never rejects, whatever happened to those operations
test('G6: flush resolves and does not reject when operations failed', T, async () => {
  const { fake, store } = await open();
  fake.failWhen(writes((data) => data.b !== undefined), 'ENOSPC');
  const outcomes = Promise.allSettled([store.set('a', 1), store.set('b', 2), store.set('c', 3)]);
  assert.equal(await store.flush(), undefined);
  assert.deepEqual(fileData(fake), { a: 1, c: 3 });
  assert.equal((await outcomes)[1].status, 'rejected');
});

// ---- G7 no unhandled rejections ------------------------------------------------------------------------
// Each scenario runs in a process of its own (unhandled-scenario.mjs), in which every caller handles the
// promise of its own operation.

// DESIGN G7: a failed write raises unhandledRejection nowhere, whether or not anyone calls flush()
test('G7: failing writes raise no unhandled rejection', CHILD, () => {
  assert.deepEqual(unhandledIn('writes'), []);
});

// DESIGN G7, with failing renames, failing cleanups and a flush() while the operations run
test('G7: failing renames and cleanups raise none, with a flush', CHILD, () => {
  assert.deepEqual(unhandledIn('cleanup'), []);
});

// DESIGN G7, through the queue
test('G7: failing queue operations raise none', CHILD, () => {
  assert.deepEqual(unhandledIn('queue'), []);
});

// ---- Q1 exactly-once claim -----------------------------------------------------------------------------

// DESIGN "The queue": enqueue resolves with a unique id, claim with { id, payload }, complete with nothing
test('Q1: a job is enqueued, claimed and completed in sequence', T, async () => {
  const { queue } = await openQueue();
  const first = await queue.enqueue({ task: 'a' });
  const second = await queue.enqueue({ task: 'b' });
  assert.notEqual(first, second);
  assert.deepEqual(await queue.stats(), stats(2, 0, 0));
  const job = await queue.claim('w1');
  assert.equal(job.id, first);
  assert.deepEqual(job.payload, { task: 'a' });
  assert.deepEqual(await queue.stats(), stats(1, 1, 0));
  assert.equal(await queue.complete(job.id, 'w1'), undefined);
  assert.deepEqual(await queue.stats(), stats(1, 0, 1));
  assert.equal((await queue.claim('w2')).id, second);
});

// DESIGN "The queue": claim resolves with null when no job is pending
test('Q1: claim resolves null when no job is pending', T, async () => {
  const { queue } = await openQueue();
  assert.equal(await queue.claim('w1'), null);
  assert.deepEqual(await queue.stats(), stats(0, 0, 0));
  await queue.enqueue('only');
  await queue.claim('w1');
  assert.equal(await queue.claim('w2'), null);
});

// DESIGN Q1: concurrent claims never return the same job; the first call gets the oldest, the second the
// next oldest, and a call that finds none gets null
test('Q1: concurrent claims never return the same job and take the oldest first', T, async () => {
  for (const order of [null, { seed: 3 }]) {
    const { fake, queue } = await openQueue();
    const ids = [];
    for (let index = 0; index < 10; index += 1) ids.push(await queue.enqueue({ index }));
    if (order) fake.hold();
    const claims = Array.from({ length: 12 }, (_, index) => queue.claim(`w${index % 4}`));
    if (order) await fake.drain(order);
    const jobs = await Promise.all(claims);
    assert.deepEqual(jobs.slice(0, 10).map((job) => job?.id), ids, JSON.stringify(order));
    assert.deepEqual(jobs.slice(10), [null, null], JSON.stringify(order));
    assert.deepEqual(await queue.stats(), stats(0, 10, 0));
  }
});

// DESIGN Q1: enqueue order is the order of the enqueue calls (G2); ids are unique and no job is lost
test('Q1: concurrent enqueues keep every job, with distinct ids, in call order', T, async () => {
  const { queue } = await openQueue();
  const ids = await Promise.all(Array.from({ length: 20 }, (_, index) => queue.enqueue({ index })));
  assert.equal(new Set(ids).size, 20);
  assert.deepEqual(await queue.stats(), stats(20, 0, 0));
  const order = [];
  for (let index = 0; index < 20; index += 1) order.push((await queue.claim('w1'))?.payload.index);
  assert.deepEqual(order, Array.from({ length: 20 }, (_, index) => index));
});

// DESIGN Q1 (README "Worker" for runWorker): jobs are not run twice, however the I/O completes
test('Q1: workers running together handle every job exactly once', T, async () => {
  const { runWorker } = await loadIndex();
  const { fake, queue } = await openQueue();
  const ids = [];
  for (let index = 0; index < 9; index += 1) ids.push(await queue.enqueue({ index }));
  fake.hold();
  const controller = new AbortController();
  const handled = [];
  const workers = ['w1', 'w2', 'w3'].map((workerId) =>
    runWorker(queue, async (job) => { handled.push(job.id); }, { workerId, sleep: async () => controller.abort(), signal: controller.signal }),
  );
  await fake.drain({ seed: 7 });
  const completed = await Promise.all(workers);
  assert.deepEqual(handled.toSorted(), ids.toSorted());
  assert.equal(completed.reduce((sum, count) => sum + count, 0), 9);
  assert.deepEqual(await queue.stats(), stats(0, 0, 9));
});

// ---- Q2 visibility timeout -----------------------------------------------------------------------------

// DESIGN Q2: expired means clock() - t > visibilityMs, so exactly visibilityMs is not; the job returns to its
// original place in the enqueue order
test('Q2: requeueExpired uses a strict timeout and keeps the place of the job', T, async () => {
  const { queue, setNow } = await openQueue();
  const a = await queue.enqueue('a');
  await queue.enqueue('b');
  const c = await queue.enqueue('c');
  setNow(1000);
  await queue.claim('w1');
  setNow(1200);
  await queue.claim('w2');
  setNow(1500);
  assert.equal(await queue.requeueExpired(), 0);
  assert.deepEqual(await queue.stats(), stats(1, 2, 0));
  setNow(1501);
  assert.equal(await queue.requeueExpired(), 1);
  assert.deepEqual(await queue.stats(), stats(2, 1, 0));
  assert.equal((await queue.claim('w3')).id, a);
  assert.equal((await queue.claim('w3')).id, c);
});

// DESIGN Q2: complete succeeds only if the worker holds the claim now
test('Q2: a worker whose claim expired and was taken cannot complete the job', T, async () => {
  const { queue, setNow } = await openQueue();
  const id = await queue.enqueue('job');
  await queue.claim('w1');
  setNow(501);
  assert.equal(await queue.requeueExpired(), 1);
  assert.equal((await queue.claim('w2')).id, id);
  await assert.rejects(queue.complete(id, 'w1'), { code: 'ESTALE' });
  assert.deepEqual(await queue.stats(), stats(0, 1, 0));
  await queue.complete(id, 'w2');
  assert.deepEqual(await queue.stats(), stats(0, 0, 1));
});

// DESIGN Q2: pending, claimed by another worker, done or unknown: ESTALE, and nothing changes
test('Q2: complete rejects with ESTALE whenever the worker holds no claim', T, async () => {
  const { queue } = await openQueue();
  const a = await queue.enqueue('a');
  const b = await queue.enqueue('b');
  await assert.rejects(queue.complete(a, 'w1'), { code: 'ESTALE' });
  await queue.claim('w1');
  await assert.rejects(queue.complete(a, 'w2'), { code: 'ESTALE' });
  await assert.rejects(queue.complete('no-such-job', 'w1'), { code: 'ESTALE' });
  assert.deepEqual(await queue.stats(), stats(1, 1, 0));
  await queue.complete(a, 'w1');
  await assert.rejects(queue.complete(a, 'w1'), { code: 'ESTALE' });
  assert.deepEqual(await queue.stats(), stats(1, 0, 1));
  assert.equal((await queue.claim('w2')).id, b);
});

// README "Worker": a job whose claim was lost (ESTALE on complete) is dropped, not counted
test('Q2: a worker drops a job whose claim was lost', T, async () => {
  const { runWorker } = await loadIndex();
  const { queue, setNow } = await openQueue();
  const id = await queue.enqueue('job');
  const controller = new AbortController();
  const handler = async () => {
    setNow(10000);
    await queue.requeueExpired();
    await queue.claim('w2');
  };
  const completed = await runWorker(queue, handler, { workerId: 'w1', sleep: async () => controller.abort(), signal: controller.signal });
  assert.equal(completed, 0);
  assert.deepEqual(await queue.stats(), stats(0, 1, 0));
  await queue.complete(id, 'w2');
  assert.deepEqual(await queue.stats(), stats(0, 0, 1));
});

// ---- Q3 counters ---------------------------------------------------------------------------------------

// DESIGN Q3: stats() always agrees with the jobs, whatever mix of calls ran
test('Q3: stats agree with the jobs after a mixed concurrent run', T, async () => {
  const { queue, setNow } = await openQueue();
  await Promise.all(Array.from({ length: 20 }, (_, index) => queue.enqueue(index)));
  const claimed = await Promise.all(Array.from({ length: 8 }, (_, index) => queue.claim(`w${index % 3}`)));
  setNow(600);
  const results = await Promise.all([
    queue.complete(claimed[0].id, 'w0'),
    queue.complete(claimed[1].id, 'w1'),
    queue.complete(claimed[2].id, 'w2'),
    queue.requeueExpired(),
    queue.stats(),
  ]);
  assert.equal(results[3], 5);
  assert.deepEqual(results[4], stats(17, 0, 3));
  assert.deepEqual(await queue.stats(), stats(17, 0, 3));
});

// DESIGN "The queue" (completely or not at all), G5 and Q1: a claim whose write fails leaves the job pending
test('Q3: a claim whose write fails rejects and leaves the job pending', T, async () => {
  const { fake, queue } = await openQueue();
  const ids = [];
  for (const task of ['a', 'b', 'c']) ids.push(await queue.enqueue(task));
  fake.failWrites('ENOSPC');
  await assert.rejects(queue.claim('w1'), { code: 'ENOSPC' });
  fake.heal();
  assert.deepEqual(await queue.stats(), stats(3, 0, 0));
  assert.equal((await queue.claim('w1')).id, ids[0]);
  assert.deepEqual(await queue.stats(), stats(2, 1, 0));
});

// DESIGN "The queue" (completely or not at all) and Q3, for enqueue and complete
test('Q3: an enqueue or a complete that fails changes nothing', T, async () => {
  const { fake, queue } = await openQueue();
  const first = await queue.enqueue('a');
  await queue.claim('w1');
  fake.failWrites('EIO');
  await assert.rejects(queue.enqueue('b'), { code: 'EIO' });
  await assert.rejects(queue.complete(first, 'w1'), { code: 'EIO' });
  fake.heal();
  assert.deepEqual(await queue.stats(), stats(0, 1, 0));
  await queue.complete(first, 'w1');
  assert.deepEqual(await queue.stats(), stats(0, 0, 1));
  assert.notEqual(await queue.enqueue('c'), first);
  assert.deepEqual(await queue.stats(), stats(1, 0, 1));
});

// DESIGN "The queue": the jobs live in the store, so a new queue on the same file sees them
test('Q3: a new queue on the same file sees the same jobs', T, async () => {
  const { createQueue, createStore } = await loadIndex();
  const { fake, queue } = await openQueue();
  await queue.enqueue('a');
  const second = await queue.enqueue('b');
  await queue.enqueue('c');
  await queue.complete((await queue.claim('w1')).id, 'w1');
  const again = createQueue(createStore({ path: PATH, fs: fake.adapter }), { clock: () => 0, visibilityMs: 500 });
  assert.deepEqual(await again.stats(), stats(2, 0, 1));
  assert.equal((await again.claim('w2')).id, second);
});

// Definition of done: the project's own tests are green when the work ends.
test("the project's own test suite passes", { timeout: 30000 }, () => {
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'], {
    cwd: WORKSPACE,
    env: childEnv(),
    encoding: 'utf8',
    timeout: 25000,
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# tests [1-9]\d*$/m);
});
