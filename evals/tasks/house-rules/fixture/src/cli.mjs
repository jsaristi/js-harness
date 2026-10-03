import { commands } from './commands/index.mjs';
import { exitCodeFor, UsageError } from './errors.mjs';

const printLines = (ctx, lines) => {
  for (const line of lines) ctx.io.out(`${line}\n`);
};

function overview() {
  const width = Math.max(...commands.map((command) => command.name.length));
  return [
    'Usage: tk <command> [options]',
    '',
    'Commands:',
    ...commands.map((command) => `  ${command.name.padEnd(width)}  ${command.summary}`),
    '',
    'Run "tk help <command>" for the details of one command.',
  ];
}

function details(command) {
  const lines = [`Usage: ${command.usage}`, '', command.summary];
  const flags = Object.entries(command.flags);
  if (flags.length === 0) return lines;
  const labels = flags.map(([name, spec]) => `--${name}${spec.type === 'string' ? ' <value>' : ''}`);
  const width = Math.max(...labels.map((label) => label.length));
  const rows = flags.map(([, spec], index) => `  ${labels[index].padEnd(width)}  ${spec.description ?? ''}`.trimEnd());
  return [...lines, '', 'Flags:', ...rows];
}

function help(args, ctx) {
  if (args.length === 0) {
    printLines(ctx, overview());
    return;
  }
  const command = commands.find((candidate) => candidate.name === args[0]);
  if (!command) throw new UsageError(`unknown command "${args[0]}"`);
  printLines(ctx, details(command));
}

/** Runs `tk` with `argv` (the arguments after the program name) and returns the exit code; it never throws. */
export async function main(argv, ctx) {
  const [name = 'help', ...args] = argv;
  try {
    if (name === 'help') {
      help(args, ctx);
      return 0;
    }
    const command = commands.find((candidate) => candidate.name === name);
    if (!command) throw new UsageError('unknown command, run "tk help" to see the commands');
    await command.run(args, ctx);
    return 0;
  } catch (error) {
    ctx.io.err(`tk ${name}: ${error.message}\n`);
    return exitCodeFor(error);
  }
}
