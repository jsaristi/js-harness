import { ConflictError, NotFoundError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { loadStore, parseTaskId, saveStore } from '../store.mjs';

const flags = {};

export default {
  name: 'done',
  summary: 'Mark a task as done',
  usage: 'tk done <id>',
  flags,
  async run(args, ctx) {
    const id = parseTaskId(parseFlags(flags, args).positionals);
    const store = loadStore(ctx.storePath);
    const task = store.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new NotFoundError(`no task ${id}`);
    if (task.status === 'done') throw new ConflictError(`task ${id} is already done`);
    task.status = 'done';
    task.completed = ctx.clock().toISOString();
    saveStore(ctx.storePath, store);
    ctx.io.out(`Finished task ${id}\n`);
  },
};
