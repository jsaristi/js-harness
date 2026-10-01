import { parseFlags } from '../flags.mjs';
import { formatTable } from '../format/table.mjs';
import { loadTasks } from '../store.mjs';

const flags = {
  all: { type: 'boolean', description: 'include finished tasks' },
};

export default {
  name: 'list',
  summary: 'List the open tasks',
  usage: 'tk list [--all]',
  flags,
  async run(args, ctx) {
    const { flags: given } = parseFlags(flags, args);
    const tasks = loadTasks(ctx.storePath).filter((task) => given.all || task.status === 'open');
    if (tasks.length === 0) {
      ctx.io.out('No tasks\n');
      return;
    }
    const rows = tasks.map((task) => [String(task.id), task.title.replace(/\s+/g, ' '), task.status, task.created]);
    for (const line of formatTable(['ID', 'TITLE', 'STATUS', 'CREATED'], rows)) ctx.io.out(`${line}\n`);
  },
};
