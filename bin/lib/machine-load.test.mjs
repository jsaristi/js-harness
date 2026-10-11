import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATE_LOAD_ENV, LOAD_SAID_PROCESSORS, isLoaded, loadBetween, loadDetail, loadSwitchedOff, readLoad, sampleLoad } from './machine-load.mjs';

// The load a gate starts under: how many logical processors were busy during one sample, from two readings
// of `os.cpus()`. No test here sleeps or reads the machine: the readings are made up, and the clock is a
// stand-in. The one real sample of the suite is in check.test.mjs.

/** One processor as `os.cpus()` gives it, with the milliseconds it has spent so far. */
const cpu = (busy, idle) => ({ model: 'made up', speed: 1000, times: { user: busy, nice: 0, sys: 0, idle, irq: 0 } });
/** A reading of the machine: one `[busy, idle]` pair of milliseconds for each of its processors. */
const reading = (...processors) => processors.map(([busy, idle]) => cpu(busy, idle));

test('loadBetween counts the logical processors that were busy between two readings, and their share of all', () => {
  const before = reading([100, 900], [500, 500], [0, 2000], [40, 60]);
  // A second later: the first was idle throughout, the second half busy, the other two busy for 750 ms.
  const after = reading([100, 1900], [1000, 1000], [750, 2250], [790, 310]);
  assert.deepEqual(loadBetween(before, after), { busy: 2, processors: 4, share: 0.5 });
  // Every kind of time that is not idle is busy time.
  const spent = (times) => [{ model: 'made up', speed: 1000, times }];
  const all = loadBetween(spent({ user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }), spent({ user: 100, nice: 100, sys: 100, idle: 600, irq: 100 }));
  assert.deepEqual(all, { busy: 0.4, processors: 1, share: 0.4 });
  assert.deepEqual(loadBetween(reading([0, 0]), reading([0, 1000])), { busy: 0, processors: 1, share: 0 });
  assert.deepEqual(loadBetween(reading([0, 0], [0, 0]), reading([1000, 0], [1000, 0])), { busy: 2, processors: 2, share: 1 });
});

test('loadBetween says why it read nothing, and never gives a figure that is not a number: no processor, two equal readings, readings that cannot be compared', () => {
  const one = reading([100, 900], [500, 500]);
  assert.deepEqual(loadBetween([], []), { notRead: 'os.cpus() gave no processor' });
  assert.deepEqual(loadBetween(one, []), { notRead: 'os.cpus() gave no processor' });
  assert.deepEqual(loadBetween(one, reading([100, 900], [500, 500])), { notRead: 'the two readings of os.cpus() do not differ' });
  assert.deepEqual(loadBetween(one, reading([200, 1800])), { notRead: 'os.cpus() gave 2 processors and then 1' });
  // Times that went back, as after a reading of another machine, and times that are no numbers.
  const back = 'the processor times of os.cpus() did not go forward between the two readings';
  assert.deepEqual(loadBetween(reading([100, 900], [500, 500]), reading([50, 400], [250, 250])), { notRead: back });
  // An idle time that went back alone, whether or not the sum of the times moved with it.
  assert.deepEqual(loadBetween(reading([100, 900]), reading([200, 800])), { notRead: back });
  assert.deepEqual(loadBetween(reading([100, 900]), reading([300, 800])), { notRead: back });
  assert.deepEqual(loadBetween(reading([100, 900]), [{ model: 'made up', speed: 1000, times: {} }]), { notRead: back });
});

test('sampleLoad reads the processors, waits for the sample and reads them again: a second unless told otherwise', async () => {
  const readings = [reading([0, 0], [0, 0]), reading([250, 750], [500, 500])];
  const events = [];
  const cpus = () => {
    events.push('read');
    return readings.shift();
  };
  const sleep = async (ms) => {
    events.push(`sleep ${ms}`);
  };
  assert.deepEqual(await sampleLoad({ cpus, sleep }), { busy: 0.75, processors: 2, share: 0.375, sampleMs: 1000 });
  assert.deepEqual(events, ['read', 'sleep 1000', 'read']);

  // What could not be read still says how long the sample was.
  const same = reading([100, 900]);
  const slept = [];
  const notRead = await sampleLoad({ ms: 250, cpus: () => same, sleep: async (ms) => slept.push(ms) });
  assert.deepEqual(notRead, { notRead: 'the two readings of os.cpus() do not differ', sampleMs: 250 });
  assert.deepEqual(slept, [250]);
});

test('readLoad gives the sample of the sampler it is handed, and a sampler that throws is a load that was not read', async () => {
  const sample = { busy: 2.16, processors: 8, share: 0.27, sampleMs: 1000 };
  assert.equal(await readLoad(async () => sample), sample);
  const threw = async () => {
    throw new Error('the sampler blew up');
  };
  assert.deepEqual(await readLoad(threw), { notRead: 'the sampler blew up' });
  assert.deepEqual(await readLoad(() => { throw 'not an error'; }), { notRead: 'not an error' });
});

test('loadDetail says the load in one line: the busy processors of all, before what, the share and the sample', () => {
  const load = { busy: 2.16, processors: 8, share: 0.27, sampleMs: 1000 };
  assert.equal(loadDetail(load), '2.2 of 8 logical processors busy before the sensors (27%, 1 s sample)');
  assert.equal(loadDetail(load, { before: 'the command' }), '2.2 of 8 logical processors busy before the command (27%, 1 s sample)');
  // A gate that waited for another samples the tail of that gate, and the line says so.
  assert.equal(loadDetail(load, { afterGate: true }), '2.2 of 8 logical processors busy before the sensors (27%, 1 s sample), right after another gate');
  assert.equal(loadDetail({ busy: 0, processors: 1, share: 0, sampleMs: 500 }), '0.0 of 1 logical processor busy before the sensors (0%, 0.5 s sample)');
  assert.equal(loadDetail({ busy: 1.5, processors: 4, share: 0.375, sampleMs: 2000 }), '1.5 of 4 logical processors busy before the sensors (38%, 2 s sample)');
  // What was not read says why, and nothing of a gate before it: there is no figure to qualify.
  assert.equal(loadDetail({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 }), 'not read: os.cpus() gave no processor');
  assert.equal(loadDetail({ notRead: 'os.cpus() gave no processor' }, { before: 'the command', afterGate: true }), 'not read: os.cpus() gave no processor');
});

test('a machine is loaded from one busy logical processor on, whatever share of its processors that is', () => {
  assert.equal(LOAD_SAID_PROCESSORS, 1);
  assert.equal(isLoaded({ busy: 0.99, processors: 4, share: 0.2475, sampleMs: 1000 }), false);
  assert.equal(isLoaded({ busy: 1, processors: 4, share: 0.25, sampleMs: 1000 }), true);
  // 15% is 0.6 of four processors and 4.8 of thirty-two.
  assert.equal(isLoaded({ busy: 0.6, processors: 4, share: 0.15, sampleMs: 1000 }), false);
  assert.equal(isLoaded({ busy: 4.8, processors: 32, share: 0.15, sampleMs: 1000 }), true);
  assert.equal(isLoaded({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 }), false);
});

test('only JS_HARNESS_GATE_LOAD=off switches the sample off', () => {
  assert.equal(GATE_LOAD_ENV, 'JS_HARNESS_GATE_LOAD');
  assert.equal(loadSwitchedOff({ JS_HARNESS_GATE_LOAD: 'off' }), true);
  for (const env of [{}, { JS_HARNESS_GATE_LOAD: '' }, { JS_HARNESS_GATE_LOAD: '0' }, { JS_HARNESS_GATE_LOAD: 'on' }, { JS_HARNESS_GATE_LOAD: 'OFF' }]) {
    assert.equal(loadSwitchedOff(env), false, JSON.stringify(env));
  }
});
