import { parseDuration } from '../duration.mjs';
import { ConflictError } from '../errors.mjs';
import { parseFlags } from '../flags.mjs';
import { csvLines } from '../format/csv.mjs';
import { exists, writeFileAtomic } from '../fsutil.mjs';
import { loadTasks } from '../store.mjs';

const COLUMNS = ['id', 'title', 'status', 'created', 'completed'];

const flags = {
  format: { type: 'string', choices: ['json', 'csv'], default: 'json', description: 'output format, json or csv' },
  output: { type: 'string', description: 'write to this file instead of stdout' },
  force: { type: 'boolean', description: 'replace the output file if it exists' },
  status: { type: 'string', choices: ['open', 'done'], description: 'keep only tasks with this status' },
  since: { type: 'string', description: 'keep only tasks created within this window, like 7d or 12h' },
};

/** The document as lines, each with its terminator. */
function render(tasks, format) {
  if (format === 'csv') return csvLines(COLUMNS, tasks.map((task) => COLUMNS.map((column) => task[column] ?? '')));
  return JSON.stringify(tasks, null, 2).split('\n').map((line) => `${line}\n`);
}

export default {
  name: 'export',
  summary: 'Write the tasks as JSON or CSV',
  usage: 'tk export [--format json|csv] [--output <path>] [--force] [--status open|done] [--since <duration>]',
  flags,
  async run(args, ctx) {
    const { flags: given } = parseFlags(flags, args);
    const earliest = given.since === undefined ? null : ctx.clock().getTime() - parseDuration(given.since);
    const tasks = loadTasks(ctx.storePath)
      .filter((task) => given.status === undefined || task.status === given.status)
      .filter((task) => earliest === null || Date.parse(task.created) >= earliest)
      .sort((a, b) => a.id - b.id);
    const lines = render(tasks, given.format);
    if (given.output === undefined) {
      for (const line of lines) ctx.io.out(line);
      return;
    }
    if (exists(given.output) && !given.force) {
      throw new ConflictError(`${given.output} already exists, use --force to replace it`);
    }
    writeFileAtomic(given.output, lines.join(''));
  },
};
