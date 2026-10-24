// `js-harness windows-daily`: the newest run of the daily Windows suite (.github/workflows/windows-daily.yml), read
// by hand. It prints what the run says and, for a red run not told before, writes the notice to the orchestrator
// that the lead's heartbeat would write (bin/lib/windows-daily.mjs says what is told and when). Exit 0, 1 when the
// notice could not be written, 2 for a usage error.
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { unknownArgument } from './lib/args.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { windowsDaily } from './lib/windows-daily.mjs';
import { harnessHome } from './lib/home.mjs';

const USAGE = [
  'Usage: js-harness windows-daily [--cwd <path>] [--home <path>]',
  '',
  '  Reads the newest completed run of .github/workflows/windows-daily.yml on the default branch of the GitHub',
  '  repository origin names, and prints whether it passed. A red run (failure, timed_out or cancelled) not told',
  '  before is told to the orchestrator once, with its failing test names, unless every file it failed in is',
  '  quarantined in docs/FLAKY.md; so is a schedule whose newest run ended more than 26 hours ago. The lead\'s',
  '  `js-harness loop heartbeat` runs the same reading every hour.',
].join('\n');
const KNOWN = { valued: ['--cwd', '--home'], bare: ['--help', '-h'] };

const valueOf = (argv, flag) => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};

export async function windowsDailyMain(
  argv = [],
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    homedir = os.homedir,
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
    daily = windowsDaily,
  } = {},
) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) {
    stderr(`js-harness windows-daily: unknown argument: ${unknown}\n\n${USAGE}`);
    return 2;
  }
  for (const flag of KNOWN.valued) {
    if (argv.includes(flag) && (valueOf(argv, flag) === undefined || valueOf(argv, flag).startsWith('--'))) {
      stderr(`js-harness windows-daily: ${flag} takes a path\n\n${USAGE}`);
      return 2;
    }
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  const cwd = path.resolve(defaultCwd, valueOf(argv, '--cwd') ?? '.');
  const home = harnessHome({ given: valueOf(argv, '--home'), env, cwd: defaultCwd, homedir });
  const slug = projectSlug(mainCheckout(run, cwd));
  const result = await daily({ home, slug, cwd });
  for (const line of result.lines) stdout(line);
  // The end line says the run was told, so a notice that failed prints none (harness review d7).
  if (result.told !== null && result.failed === null) stdout(result.told);
  if (result.failed !== null) {
    stderr(`js-harness windows-daily: ${result.failed}`);
    return 1;
  }
  return 0;
}
