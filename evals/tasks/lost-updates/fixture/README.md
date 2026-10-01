# cellar

A small key-value store that keeps its data in one JSON file, with a job queue on top of it. It has no
dependencies and needs Node 22 or newer. The disk is reached through a four-method adapter, so tests and
other hosts can bring their own.

## Use

```js
import { createStore, createQueue, runWorker } from './src/index.mjs';

const store = createStore({ path: 'data/cellar.json' });

await store.set('theme', 'dark');
await store.update('visits', (n) => (n ?? 0) + 1);
console.log(await store.get('visits')); // 1
await store.flush();
```

`createStore({ path, fs })` returns `get`, `set`, `update`, `delete` and `flush`. `fs` is a storage
adapter ([docs/ADAPTER.md](docs/ADAPTER.md)); it defaults to `nodeAdapter`, which uses
`node:fs/promises`.

## Queue

```js
const queue = createQueue(store, { clock: Date.now, visibilityMs: 30_000 });

const id = await queue.enqueue({ to: 'ada@example.com' });
const job = await queue.claim('worker-1'); // { id, payload }, or null when nothing is pending
await queue.complete(job.id, 'worker-1');
console.log(await queue.stats()); // { pending: 0, claimed: 0, done: 1 }
```

A worker that stops without completing its job loses the claim after `visibilityMs`. Call
`requeueExpired()` regularly, from one worker's loop for example, to make such jobs pending again.

## Worker

`runWorker(queue, handler, { workerId, sleep, signal })` claims one job at a time, passes it to
`handler` and completes it. When nothing is pending it calls `sleep(250)` and tries again. It stops when
`signal` is aborted, and resolves with the number of jobs it completed.

A job whose claim was lost (`complete` rejects with `ESTALE`) is dropped, not counted: another worker
holds it now. Any other error ends the worker, and the job stays claimed until it expires.

## Guarantees

What callers can rely on when calls overlap and when the disk fails is written down in
[docs/DESIGN.md](docs/DESIGN.md). The tests run with `npm test`.
