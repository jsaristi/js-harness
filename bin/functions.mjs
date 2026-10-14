// `functions`: what each switch of this project is, what it resolves to and why. Read-only: it writes
// nothing and changes no switch. The switches live under `harness.json` `"functions"`; the rules are
// bin/lib/functions.mjs. See odd/tasks/on-demand-functions.md.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { functionsOf, gitIn, harnessOfTree, workingTree } from './lib/project-functions.mjs';

const USAGE = [
  'Usage: js-harness functions [--json] [--cwd <path>]',
  'Prints each function this project can turn off and on (harness.json "functions"): its value here and why.',
].join('\n');

function parseArgs(argv, cwd) {
  const parsed = { cwd, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--cwd' && argv[index + 1]) parsed.cwd = path.resolve(argv[(index += 1)]);
    else return { error: `unknown argument: ${arg}` };
  }
  return parsed;
}

/** One line per switch: its name, its value, and why; `auto: ` goes before a reason read from the files. */
function lines(resolved) {
  const nameWidth = Math.max(...Object.keys(resolved).map((name) => name.length)) + 2;
  return Object.entries(resolved).map(([name, { value, declared, because }]) =>
    `${name.padEnd(nameWidth)}${value.padEnd(11)}${declared === 'auto' ? 'auto: ' : ''}${because}`,
  );
}

/** Exit 0, or 1 when `harness.json` or a switch in it cannot be read (each reason on stderr; the switches
 * are still printed, read as on), or 2 for an argument it does not take. */
export async function functionsMain(
  argv,
  env = process.env,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error, spawn = spawnSync } = {},
) {
  const args = parseArgs(argv, cwd);
  if (args.error) {
    stderr(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  // The project is the repository's top, where harness.json lives; outside a repository, the folder itself.
  const top = gitIn(args.cwd, spawn)(['rev-parse', '--show-toplevel'])?.trim() || args.cwd;
  const { errors, resolved } = functionsOf(harnessOfTree(top), workingTree(gitIn(top, spawn)));

  for (const error of errors) stderr(error);
  stdout(args.json ? JSON.stringify({ errors, functions: resolved }, null, 2) : lines(resolved).join('\n'));
  return errors.length > 0 ? 1 : 0;
}
