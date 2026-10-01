import fs from 'node:fs';
import { StoreError, UsageError } from './errors.mjs';
import { writeFileAtomic } from './fsutil.mjs';

/** The tasks in the store at `storePath`; a store that does not exist yet holds none. */
export function loadTasks(storePath) {
  let text;
  try {
    text = fs.readFileSync(storePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new StoreError(`cannot read ${storePath}: ${error.message}`);
  }
  let tasks;
  try {
    tasks = JSON.parse(text);
  } catch (error) {
    throw new StoreError(`${storePath} is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(tasks)) throw new StoreError(`${storePath} does not hold a list of tasks`);
  return tasks;
}

export function saveTasks(storePath, tasks) {
  const sorted = [...tasks].sort((a, b) => a.id - b.id);
  writeFileAtomic(storePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function nextId(tasks) {
  return tasks.reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
}

/** The task id a command was given as its only positional argument. */
export function parseTaskId(positionals) {
  if (positionals.length !== 1 || !/^\d+$/.test(positionals[0])) throw new UsageError('give the id of one task');
  return Number(positionals[0]);
}
