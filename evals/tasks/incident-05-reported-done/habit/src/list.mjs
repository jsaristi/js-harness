import { normalizeTask } from './schema.mjs';

/** The tasks of `store` (an array of raw records), normalized, by priority, highest first. */
export function listTasks(store) {
  return [...store].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map(normalizeTask);
}
