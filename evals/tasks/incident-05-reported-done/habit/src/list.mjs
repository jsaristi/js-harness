import { normalizeTask } from './schema.mjs';

/** The tasks of `store` (an array of raw records), normalized. */
export function listTasks(store) {
  return store.map(normalizeTask).sort((a, b) => b.priority - a.priority);
}
