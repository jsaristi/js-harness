import fs from 'node:fs';
import { StoreError, UsageError } from './errors.mjs';
import { writeFileAtomic } from './fsutil.mjs';

const highestId = (tasks) => tasks.reduce((highest, task) => Math.max(highest, task.id), 0);

/**
 * The store at `storePath`: its tasks and `nextId`, the id the next task gets. A store that does not exist
 * yet is empty. A file written before `nextId` was kept is a plain list of tasks, and its next id is the
 * one after its highest.
 */
export function loadStore(storePath) {
  let text;
  try {
    text = fs.readFileSync(storePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { tasks: [], nextId: 1 };
    throw new StoreError(`cannot read ${storePath}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StoreError(`${storePath} is not valid JSON: ${error.message}`);
  }
  const tasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
  if (!Array.isArray(tasks)) throw new StoreError(`${storePath} does not hold a list of tasks`);
  const kept = Number.isInteger(parsed.nextId) ? parsed.nextId : 1;
  return { tasks, nextId: Math.max(kept, highestId(tasks) + 1) };
}

/** The tasks in the store at `storePath`. */
export function loadTasks(storePath) {
  return loadStore(storePath).tasks;
}

export function saveStore(storePath, { tasks, nextId }) {
  const sorted = [...tasks].sort((a, b) => a.id - b.id);
  writeFileAtomic(storePath, `${JSON.stringify({ nextId, tasks: sorted }, null, 2)}\n`);
}

/** The task id a command was given as its only positional argument. */
export function parseTaskId(positionals) {
  if (positionals.length !== 1 || !/^\d+$/.test(positionals[0])) throw new UsageError('give the id of one task');
  return Number(positionals[0]);
}
