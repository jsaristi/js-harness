import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A context for `main` that keeps everything in memory: `out()` and `err()` return what was printed,
 * `stored()` the tasks in the store, which lives in a temporary directory that `cleanup()` removes.
 * @param {{ now?: string, tasks?: object[] }} [options]
 */
export function fakeContext({ now = '2025-03-02T09:30:00.000Z', tasks } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-spec-'));
  const storePath = path.join(dir, 'tasks.json');
  if (tasks) fs.writeFileSync(storePath, JSON.stringify(tasks));
  const printed = { out: [], err: [] };
  return {
    ctx: {
      io: { out: (text) => printed.out.push(text), err: (text) => printed.err.push(text) },
      clock: () => new Date(now),
      storePath,
    },
    out: () => printed.out.join(''),
    err: () => printed.err.join(''),
    stored: () => JSON.parse(fs.readFileSync(storePath, 'utf8')),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

export const task = (id, title, status = 'open') => ({
  id,
  title,
  status,
  created: '2025-03-01T08:00:00.000Z',
  completed: status === 'done' ? '2025-03-01T18:00:00.000Z' : null,
});
