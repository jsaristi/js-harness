import { NotFoundError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { loadStore, parseTaskId, saveStore } from '../store.mjs';

const flags = {};

export default {
  name: 'remove',
  summary: 'Remove a task',
  usage: 'tk remove <id>',
  flags,
  async run(args, ctx) {
    const id = parseTaskId(parseFlags(flags, args).positionals);
    const store = loadStore(ctx.storePath);
    if (!store.tasks.some((task) => task.id === id)) throw new NotFoundError(`no task ${id}`);
    saveStore(ctx.storePath, { ...store, tasks: store.tasks.filter((task) => task.id !== id) });
    ctx.io.out(`Removed task ${id}\n`);
  },
};
