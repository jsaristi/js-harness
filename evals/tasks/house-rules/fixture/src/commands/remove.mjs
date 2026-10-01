import { NotFoundError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { loadTasks, parseTaskId, saveTasks } from '../store.mjs';

const flags = {};

export default {
  name: 'remove',
  summary: 'Remove a task',
  usage: 'tk remove <id>',
  flags,
  async run(args, ctx) {
    const id = parseTaskId(parseFlags(flags, args).positionals);
    const tasks = loadTasks(ctx.storePath);
    if (!tasks.some((task) => task.id === id)) throw new NotFoundError(`no task ${id}`);
    saveTasks(ctx.storePath, tasks.filter((task) => task.id !== id));
    ctx.io.out(`Removed task ${id}\n`);
  },
};
