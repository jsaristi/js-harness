#!/usr/bin/env node
// tk's command line: `tk add <title> [--due <date>]`, `tk export [--output <file>] [--force]`.
import { loadTasks, saveTasks } from '../src/store.mjs';
import { exportTasks } from '../src/export.mjs';

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const at = rest.indexOf(name);
  return at === -1 ? undefined : rest[at + 1];
};

if (command === 'add') {
  const tasks = loadTasks();
  const id = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
  tasks.push({ id, title: rest[0], status: 'open', due: flag('--due') ?? null, completed: null });
  saveTasks(tasks);
  console.log(`added ${id}`);
} else if (command === 'export') {
  console.log(exportTasks(loadTasks(), { output: flag('--output'), force: rest.includes('--force') }));
} else {
  console.error('usage: tk add <title> [--due <date>] | tk export [--output <file>] [--force]');
  process.exitCode = 2;
}
