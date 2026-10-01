const POLL_MS = 250;

/**
 * Claims jobs one at a time and hands each to `handler` until `signal` is aborted. Resolves with the
 * number of jobs this worker completed.
 */
export async function runWorker(queue, handler, { workerId, sleep, signal }) {
  let completed = 0;
  while (!signal.aborted) {
    const job = await queue.claim(workerId);
    if (!job) {
      await sleep(POLL_MS);
      continue;
    }
    await handler(job);
    try {
      await queue.complete(job.id, workerId);
      completed += 1;
    } catch (error) {
      if (error.code !== 'ESTALE') throw error;
    }
  }
  return completed;
}
