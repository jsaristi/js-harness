import { UsageError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { loadStore, saveStore } from '../store.mjs';

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
    const store = loadStore(ctx.storePath);
    const task = { id: store.nextId, title, status: 'open', created: ctx.clock().toISOString(), completed: null };
    saveStore(ctx.storePath, { tasks: [...store.tasks, task], nextId: task.id + 1 });
    ctx.io.out(`Added task ${task.id}\n`);
  },
};
