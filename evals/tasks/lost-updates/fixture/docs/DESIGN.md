# Design

cellar keeps a set of JSON values in one file and runs a job queue on top of that set. This document is
the contract: what a caller can rely on however calls overlap and however the disk fails.
[ADAPTER.md](ADAPTER.md) says what the disk may do.

## The store

- The store file is one JSON object: its keys are the store's keys and its values are their values.
  A key is any string, and values are anything `JSON.stringify` keeps.
- The file is read once, by the first operation. A missing file (`ENOENT`) is an empty store. Any other
  read error rejects that operation with the adapter's error, and the next operation reads again.
- Every call returns a promise, and a caller does not have to await one before making the next call.
- `get(key)` resolves with the value, or `undefined` when the key is missing. `set(key, value)` resolves
  with nothing. `update(key, fn)` resolves with the new value. `delete(key)` resolves with `true` when
  the key existed and `false` when it did not.
- Values the store hands out, from `get` and `update`, are copies: changing one never changes the store.

## Guarantees

### G1 Atomic update

`update(key, fn)` calls `fn` with the latest value of `key` (`undefined` when it is missing), after
every operation called before it has finished, and stores what `fn` returns. `fn` may return its result
or a promise of it. It may change the value it receives in place and return that value. It must not call
the store itself.

If `fn` throws or rejects, `update` rejects with that error, nothing changes, and later operations are
not affected.

```js
await Promise.all(Array.from({ length: 50 }, () => store.update('hits', (n) => (n ?? 0) + 1)));
await store.get('hits'); // 50, never fewer
```

### G2 Call order

Operations take effect in the order they were called, not in the order their I/O completes. After
`flush()` the file holds the state that all the operations produced when applied in call order, and a
`get` sees the operations called before it and none called after it.

```js
store.set('mode', 'a');
store.set('mode', 'b');
store.set('mode', 'c');
await store.flush(); // the file says "c", even if the first write was the last to complete
```

### G3 Read your writes

`get(key)` called after `set(key, v)` resolves to `v`, even when the `set` was not awaited, unless the
write of that `set` fails (G5).

```js
store.set('user', 'ada');
await store.get('user'); // 'ada'
```

### G4 Crash-safe writes

The store never writes its file in place. Each `set`, `update` and `delete` is made durable by its own
write of the whole new state: `writeFile('<path>.tmp-<n>', text)` followed by
`rename('<path>.tmp-<n>', path)`, where `<n>` is a decimal number. An operation is durable once its
rename has completed. A crash, or a failure, at any point leaves the file holding a complete earlier
state, never half of a new one.

### G5 Failure isolation

When the adapter rejects a write (the `writeFile` or the `rename`), the write carried exactly one
operation, and:

1. that operation rejects with the adapter's error, `code` intact;
2. the store is back at its last durable state: operations called after it, including those already
   waiting, apply to that state, and a `get` returns the old values, not the ones that were never saved;
3. the temporary file is removed with `unlink`, and a failure of that `unlink` is ignored: the caller
   still gets the error of the write;
4. later operations proceed normally.

```js
await store.set('plan', 'free');
// the disk is full for the next write
await store.set('plan', 'pro'); // rejects with code 'ENOSPC'
await store.get('plan'); // 'free'
```

### G6 Flush

`flush()` resolves once every operation called before it is durable or has rejected. It resolves with
nothing and never rejects itself, whatever happened to those operations.

### G7 No unhandled rejections

A failed write raises `unhandledRejection` nowhere in the process, whether or not anyone calls
`flush()`. The caller of an operation sees its error through the promise that operation returned, and
nowhere else.

## The queue

`createQueue(store, { clock, visibilityMs })` keeps its jobs in the store and relies on the guarantees
above. `clock()` returns the current time in milliseconds.

- `enqueue(payload)` resolves with the id of the new job, which is unique within the queue.
- `claim(workerId)` resolves with `{ id, payload }` for the oldest pending job, which `workerId` now
  holds, or with `null` when no job is pending.
- `complete(id, workerId)` marks a job done. It resolves with nothing.
- `requeueExpired()` resolves with the number of jobs it made pending again.
- `stats()` resolves with `{ pending, claimed, done }`.

A queue operation takes effect completely or, when it rejects, not at all.

### Q1 Exactly-once claim

Concurrent `claim()` calls never return the same job. Jobs are claimed in enqueue order, which is the
order of the `enqueue` calls. Claims take effect in call order (G2), so the first call gets the oldest
pending job, the second the next oldest, and so on, and a call that finds none gets `null`.

### Q2 Visibility timeout

A job claimed at time `t` has expired when `clock() - t > visibilityMs`: at exactly `visibilityMs` it
has not. `requeueExpired()` makes every expired job pending again, in its original place in the enqueue
order, and forgets who held it.

`complete(id, workerId)` succeeds only if `workerId` holds the claim on that job right now. In every
other case (the job is pending, claimed by another worker, done, or unknown) it rejects with
`error.code === 'ESTALE'` and changes nothing.

```js
// w1 claims job 7 and stalls; the claim expires and requeueExpired() runs; w2 claims job 7
await queue.complete(7, 'w1'); // rejects, code 'ESTALE'
await queue.complete(7, 'w2'); // resolves
```

### Q3 Counters

`stats()` always agrees with the jobs: `pending`, `claimed` and `done` are the numbers of jobs in each
state, whatever mix of calls ran and whichever of them failed.
