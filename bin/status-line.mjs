// `js-harness status-line`: keeps the line Claude Desktop's sessionStatusLine program prints above the Code tab's
// message box (odd/tasks/status-line.md). The board takes about 24 s and the host stops its program at 10 s, so `write`
// runs the board here and keeps its line in a file, and the program (`program` prints its path) only prints that file.
// Exit 0, 1 when the board could not be read (the last line is left as it was), 2 for a usage error.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { unknownArgument } from './lib/args.mjs';
import { harnessHome } from './lib/home.mjs';
import { statusLineOf, writeStatusLine } from './lib/status-line.mjs';

export const USAGE = [
  'Usage: js-harness status-line write [--cwd <path>] [--home <path>]',
  '       js-harness status-line program',
  '',
  '  write runs `js-harness sessions --json` in the project at --cwd and keeps the board in one Spanish line, with the',
  '  time it was written, in .js-harness/status-line/line.txt under the home; a board that fails leaves the last line',
  '  as it was. program prints the path of status-line.ps1, the program sessionStatusLine runs: it prints that file\'s',
  '  line, its age first past 10 minutes, and nothing when the file is missing. The program reads the file under',
  '  USERPROFILE, so --home is for tests. Claude Desktop reads the key only on third-party inference today.',
].join('\n');
const KNOWN = { valued: ['--cwd', '--home'], bare: ['--help', '-h'], positional: true };
const SUBCOMMANDS = ['write', 'program'];
const DISPATCHER = path.join(import.meta.dirname, 'js-harness.mjs');
const PROGRAM = path.join(import.meta.dirname, 'lib', 'status-line.ps1');

class StatusLineArgError extends Error {}

const valueOf = (argv, flag) => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};

/** The subcommand and the paths `argv` gives; a usage error throws StatusLineArgError. */
function parse(argv) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new StatusLineArgError(`unknown argument: ${unknown}`);
  for (const flag of KNOWN.valued) {
    if (argv.includes(flag) && (valueOf(argv, flag) === undefined || valueOf(argv, flag).startsWith('--'))) throw new StatusLineArgError(`${flag} takes a path`);
  }
  const positionals = argv.filter((token, at) => !token.startsWith('-') && !KNOWN.valued.includes(argv[at - 1]));
  if (positionals.length !== 1 || !SUBCOMMANDS.includes(positionals[0])) throw new StatusLineArgError(`say one of ${SUBCOMMANDS.join(', ')}`);
  return { subcommand: positionals[0], cwd: valueOf(argv, '--cwd'), home: valueOf(argv, '--home') };
}

export async function statusLineMain(
  argv = [],
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    homedir = os.homedir,
    now = Date.now,
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024 }),
  } = {},
) {
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  let options;
  try {
    options = parse(argv);
  } catch (err) {
    if (!(err instanceof StatusLineArgError)) throw err;
    stderr(`js-harness status-line: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.subcommand === 'program') {
    stdout(PROGRAM);
    return 0;
  }
  const cwd = path.resolve(defaultCwd, options.cwd ?? '.');
  const home = harnessHome({ given: options.home, env, cwd: defaultCwd, homedir });
  const result = run(process.execPath, [DISPATCHER, 'sessions', '--json'], { cwd });
  let board = null;
  if (!result.error && result.status === 0) {
    try {
      board = JSON.parse(result.stdout);
    } catch {
      board = null;
    }
  }
  if (board === null || typeof board !== 'object') {
    const why = result.error?.message ?? (result.status !== 0 ? `exit ${result.status}: ${String(result.stderr ?? '').trim().split('\n').at(-1)}` : 'its output is not JSON');
    stderr(`js-harness status-line: the board could not be read (${why}); the last line is left as it was`);
    return 1;
  }
  const line = statusLineOf(board);
  const file = writeStatusLine({ home, line, now: now() });
  stdout(`status-line: wrote ${file}: ${line}`);
  return 0;
}
