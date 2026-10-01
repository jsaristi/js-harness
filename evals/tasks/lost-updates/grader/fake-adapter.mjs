// An in-memory storage adapter for docs/ADAPTER.md that records every call, lets a test choose when each
// call completes, and fails the calls a test picks. As the contract says, the effect of a call happens
// when it completes, not when it was made.
//
//   const fake = createFakeAdapter({ files: { '/data/x.json': '{}' } });
//   createStore({ path, fs: fake.adapter });
//
// `fake.hold()` makes every later call wait; `await fake.drain('fifo' | 'lifo' | { seed })` then completes
// the waiting calls one at a time, in that order, until none is left (calls the store makes in reply wait
// too) and stops holding. Without `hold()` a call completes on its own, one microtask after it was made.

const DEFAULT_SEED = 1;

/** A small seeded generator (mulberry32): the same seed always gives the same sequence. */
function random(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const failure = (code) => Object.assign(new Error(`${code}: simulated failure`), { code });

/** Lets everything that can run without a new adapter completion run. */
async function settle() {
  for (let round = 0; round < 3; round += 1) await new Promise((resolve) => setImmediate(resolve));
}

export function createFakeAdapter({ files = {} } = {}) {
  const disk = new Map(Object.entries(files));
  const calls = [];
  const pending = [];
  const rules = [];
  let holding = false;

  function complete(call) {
    // For a rename the data a rule sees is the content of the file being moved.
    const seen = { method: call.method, path: call.path, to: call.to, data: call.method === 'rename' ? disk.get(call.path) : call.data };
    const rule = rules.find((candidate) => candidate.when(seen));
    if (rule) {
      if (rule.partial && call.method === 'writeFile') disk.set(call.path, call.data.slice(0, Math.ceil(call.data.length / 2)));
      call.reject(failure(rule.code));
      return;
    }
    if (call.method === 'writeFile') {
      disk.set(call.path, call.data);
      call.resolve();
    } else if (!disk.has(call.path)) {
      call.reject(failure('ENOENT'));
    } else if (call.method === 'readFile') {
      call.resolve(disk.get(call.path));
    } else if (call.method === 'rename') {
      disk.set(call.to, disk.get(call.path));
      disk.delete(call.path);
      call.resolve();
    } else {
      disk.delete(call.path);
      call.resolve();
    }
  }

  function start(method, fields) {
    return new Promise((resolve, reject) => {
      const call = { method, ...fields };
      calls.push(call);
      const running = { ...call, resolve, reject };
      if (holding) pending.push(running);
      else queueMicrotask(() => complete(running));
    });
  }

  const adapter = {
    readFile: (path) => start('readFile', { path }),
    writeFile: (path, data) => start('writeFile', { path, data }),
    rename: (from, to) => start('rename', { path: from, to }),
    unlink: (path) => start('unlink', { path }),
  };

  async function drain(order = 'fifo') {
    const next = typeof order === 'object' ? random(order.seed ?? DEFAULT_SEED) : null;
    await settle();
    while (pending.length > 0) {
      let index = 0;
      if (next) index = Math.floor(next() * pending.length);
      else if (order === 'lifo') index = pending.length - 1;
      const [call] = pending.splice(index, 1);
      complete(call);
      await settle();
    }
    holding = false;
  }

  return {
    adapter,
    files: disk,
    calls,
    pending,
    settle,
    drain,
    hold() {
      holding = true;
    },
    /** Fails every call that `when({ method, path, to, data })` accepts, with an error of this `code`. */
    failWhen(when, code, { partial = false } = {}) {
      rules.push({ when, code, partial });
    },
    failWrites(code) {
      rules.push({ when: ({ method }) => method === 'writeFile', code, partial: false });
    },
    heal() {
      rules.length = 0;
    },
  };
}
