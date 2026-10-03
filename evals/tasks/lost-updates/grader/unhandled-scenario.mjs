// Run by the grader in a process of its own, as `node unhandled-scenario.mjs <name>`: it drives the
// project through a scenario with failing writes, in which every caller handles the promise of its own
// operation, and prints the reasons of every `unhandledRejection` the process saw.
import { createFakeAdapter } from './fake-adapter.mjs';
import { parse } from './json.mjs';

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(String(reason?.code ?? reason)));

const { createQueue, createStore } = await import('../src/index.mjs');
const PATH = '/data/cellar.json';
const fake = createFakeAdapter();
const store = createStore({ path: PATH, fs: fake.adapter });
const carries = (key) => ({ method, data }) => method === 'writeFile' && parse(data)[key] !== undefined;

const scenarios = {
  // A write fails and nobody calls flush().
  async writes() {
    fake.failWhen(carries('b'), 'ENOSPC');
    await Promise.allSettled([store.set('a', 1), store.set('b', 2), store.update('c', () => 3)]);
  },
  // A rename fails and so does the cleanup after it, a write fails, and flush() is called while the
  // operations are still running.
  async cleanup() {
    fake.failWhen(({ method, data }) => method === 'rename' && parse(data).b !== undefined, 'EXDEV');
    fake.failWhen(carries('d'), 'ENOSPC');
    fake.failWhen(({ method }) => method === 'unlink', 'EPERM');
    const calls = Promise.allSettled([store.set('a', 1), store.set('b', 2), store.set('c', 3), store.set('d', 4)]);
    await store.flush();
    await calls;
  },
  // The same through the queue.
  async queue() {
    const queue = createQueue(store, { clock: () => 0, visibilityMs: 100 });
    await queue.enqueue('first');
    fake.failWrites('EIO');
    await Promise.allSettled([queue.enqueue('second'), queue.claim('w1'), queue.complete(1, 'w1'), queue.requeueExpired()]);
  },
};

await scenarios[process.argv[2]]();
await new Promise((resolve) => setTimeout(resolve, 50));
console.log(JSON.stringify({ unhandled }));
