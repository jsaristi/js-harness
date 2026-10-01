import { UsageError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { loadTasks, nextId, saveTasks } from '../store.mjs';

const flags = {};

export default {
  name: 'add',
  summary: 'Add a task',
  usage: 'tk add <title>',
  flags,
  async run(args, ctx) {
    const { positionals } = parseFlags(flags, args);
    const title = positionals.join(' ').trim();
    if (title === '') throw new UsageError('give the title of the task');
    const tasks = loadTasks(ctx.storePath);
    const task = { id: nextId(tasks), title, status: 'open', created: ctx.clock().toISOString(), completed: null };
    saveTasks(ctx.storePath, [...tasks, task]);
    ctx.io.out(`Added task ${task.id}\n`);
  },
};
