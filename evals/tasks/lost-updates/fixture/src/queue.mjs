const JOBS = 'queue:jobs';
const STATS = 'queue:stats';
const NO_JOBS = { pending: 0, claimed: 0, done: 0 };

/**
 * A job queue stored in `store`. Jobs are kept in enqueue order under one key, and the counters that
 * `stats()` reports under another.
 */
export function createQueue(store, { clock, visibilityMs }) {
  async function readJobs() {
    return (await store.get(JOBS)) ?? [];
  }

  async function readStats() {
    return (await store.get(STATS)) ?? NO_JOBS;
  }

  // Moves `count` jobs from one state to another in the counters.
  async function move(from, to, count = 1) {
    const stats = await readStats();
    await store.set(STATS, { ...stats, [from]: stats[from] - count, [to]: stats[to] + count });
  }

  async function enqueue(payload) {
    const jobs = await readJobs();
    const job = { id: jobs.length + 1, payload, status: 'pending' };
    await store.set(JOBS, [...jobs, job]);
    const stats = await readStats();
    await store.set(STATS, { ...stats, pending: stats.pending + 1 });
    return job.id;
  }

  async function claim(workerId) {
    const jobs = await readJobs();
    const job = jobs.find((entry) => entry.status === 'pending');
    if (!job) return null;
    const claimedAt = clock();
    await store.set(JOBS, jobs.map((entry) => (entry === job ? { ...entry, status: 'claimed', workerId, claimedAt } : entry)));
    await move('pending', 'claimed');
    return { id: job.id, payload: job.payload };
  }

  async function complete(id, workerId) {
    const jobs = await readJobs();
    await store.set(JOBS, jobs.map((entry) => (entry.id === id ? { ...entry, status: 'done', completedBy: workerId } : entry)));
    await move('claimed', 'done');
  }

  async function requeueExpired() {
    const jobs = await readJobs();
    const now = clock();
    const expired = jobs.filter((job) => job.status === 'claimed' && now - job.claimedAt > visibilityMs);
    if (expired.length === 0) return 0;
    await store.set(JOBS, jobs.map((job) => (expired.includes(job) ? { id: job.id, payload: job.payload, status: 'pending' } : job)));
    await move('claimed', 'pending', expired.length);
    return expired.length;
  }

  async function stats() {
    return { ...(await readStats()) };
  }

  return { enqueue, claim, complete, requeueExpired, stats };
}
