const JOBS = 'queue:jobs';

const stale = (id, workerId) => Object.assign(new Error(`job ${id} is not claimed by ${workerId}`), { code: 'ESTALE' });

/**
 * A job queue stored in `store`. The jobs are kept in enqueue order under one key and every operation
 * is a single `update` of that list, so it is atomic, takes effect in call order and either happens
 * completely or not at all. `stats()` counts the jobs, so it cannot disagree with them.
 */
export function createQueue(store, { clock, visibilityMs }) {
  // Runs `edit` on the job list inside one update and resolves with what `edit` returns. The list is
  // the store's copy, so `edit` changes it in place; when `edit` throws, nothing is stored.
  async function change(edit) {
    /** @type {any} */
    let result;
    await store.update(JOBS, (jobs = []) => {
      result = edit(jobs);
      return jobs;
    });
    return result;
  }

  const enqueue = (payload) =>
    change((jobs) => {
      const id = jobs.length + 1;
      jobs.push({ id, payload, status: 'pending' });
      return id;
    });

  const claim = (workerId) =>
    change((jobs) => {
      const job = jobs.find((entry) => entry.status === 'pending');
      if (!job) return null;
      Object.assign(job, { status: 'claimed', workerId, claimedAt: clock() });
      return { id: job.id, payload: job.payload };
    });

  const complete = (id, workerId) =>
    change((jobs) => {
      const job = jobs.find((entry) => entry.id === id);
      if (job?.status !== 'claimed' || job.workerId !== workerId) throw stale(id, workerId);
      job.status = 'done';
      job.completedBy = workerId;
    });

  const requeueExpired = () =>
    change((jobs) => {
      const now = clock();
      const expired = jobs.filter((job) => job.status === 'claimed' && now - job.claimedAt > visibilityMs);
      for (const job of expired) {
        job.status = 'pending';
        delete job.workerId;
        delete job.claimedAt;
      }
      return expired.length;
    });

  async function stats() {
    const jobs = (await store.get(JOBS)) ?? [];
    const count = (status) => jobs.filter((job) => job.status === status).length;
    return { pending: count('pending'), claimed: count('claimed'), done: count('done') };
  }

  return { enqueue, claim, complete, requeueExpired, stats };
}
