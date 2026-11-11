// `node workshop/js-harness-workshop.mjs ticks [--hook]`: whether the heartbeat's three workshop ticks still run, read
// from what each leaves behind, since a tick that never starts reports nothing (odd/tasks/audit-u3-heartbeat-ticks.md).
// The ticks run only in the workshop's `loop heartbeat`; the product's runs none, and from 2026-11-03 to 2026-11-10
// nothing ran them and nothing said so (the audit's M37). `--hook` is this repository's `SessionStart` hook
// (.claude/settings.json, accepted by his answer to question 245): it also carries the idea-watch row, which the product's `doctor --hook` does not give, and,
// like `doctor --hook`, it prints one `systemMessage` line or nothing, never stderr, and exits 0 whatever fails. It
// writes nothing, so deleting its entry undoes it. Exit 0, 1 when a tick is stale (by hand), 2 for a usage error.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { unknownArgument } from '../../bin/lib/args.mjs';
import { harnessHome } from '../../bin/lib/home.mjs';
import { mainCheckoutByFiles } from '../../bin/lib/inbox.mjs';
import { loopRecordPath, readRecord } from '../../bin/lib/loops.mjs';
import { mainCheckout, projectSlug } from '../../bin/lib/sessions.mjs';
import { askedFile } from '../lib/windows-daily.mjs';
import { addDays, lastSettledDay } from '../lib/throughput.mjs';
import { hostAskedFile } from './host-watch.mjs';
import { settlesAt, snapshotFolder } from './throughput.mjs';

export const USAGE = [
  'Usage: node workshop/js-harness-workshop.mjs ticks [--hook] [--cwd <path>] [--home <path>]',
  '',
  '  Prints the age of what each of the heartbeat\'s three ticks leaves: the newest throughput snapshot, and when the',
  '  daily Windows run and the host watch were last read. A tick is stale when it has not run for the hours of',
  '  TICKS_STALE_HOURS; the heartbeat that runs them is the workshop\'s loop heartbeat, not the product\'s.',
  '  --hook is the SessionStart hook: one systemMessage line when a tick is stale or an upstream release is unread,',
  '  else nothing; never stderr, always exit 0. Exit 0, 1 when a tick is stale, 2 for a usage error.',
].join('\n');

/** How long a tick may go without running before it is said, in hours: half a day, so a night away is not a stall,
 * and a heartbeat that runs no tick is told on the first session start of the next day. The two ticks that read
 * every hour leave the time they read; the throughput tick keeps a day within minutes of its settling. */
export const TICKS_STALE_HOURS = 12;

// The idea-watch row lists the upstream's tags over the network: bounded well under the hook's 15 s.
const IDEAS_TIMEOUT_MS = 5000;

class TicksArgError extends Error {}

const KNOWN = { valued: ['--cwd', '--home'], bare: ['--hook', '--help', '-h'] };

/** `{ hook, help, cwd, home }` from `argv`, or a `TicksArgError` naming the first argument it does not take. */
function parseArgs(argv) {
  const unknown = unknownArgument(argv, KNOWN);
  if (unknown !== null) throw new TicksArgError(`unknown argument: ${unknown}`);
  const valueOf = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  for (const flag of KNOWN.valued) if (argv.includes(flag) && (valueOf(flag) === undefined || valueOf(flag).startsWith('--'))) throw new TicksArgError(`${flag} requires a value`);
  return { hook: argv.includes('--hook'), help: argv.includes('--help') || argv.includes('-h'), cwd: valueOf('--cwd'), home: valueOf('--home') };
}
const STALE_MS = TICKS_STALE_HOURS * 3600 * 1000;
const WORKSHOP_SCRIPT = /(^|[\\/])workshop[\\/]js-harness-workshop\.mjs$/;
const FIX = 'the workshop\'s heartbeat runs them: node workshop/js-harness-workshop.mjs loop heartbeat, as the body of js-harness loop run heartbeat';

const iso = (ms) => new Date(ms).toISOString();
const why = (err) => err?.code ?? err?.message ?? String(err);

/** The throughput tick, by its newest snapshot: stale when the day after it settled more than the hours ago. */
function throughputRow({ home, slug, now, fileSystem }) {
  const folder = snapshotFolder(home, slug);
  let names;
  try {
    names = fileSystem.readdirSync(folder);
  } catch (err) {
    if (err.code !== 'ENOENT') return { stale: true, line: `throughput: the snapshots could not be read (${why(err)})` };
    names = [];
  }
  const newest = names.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().at(-1)?.slice(0, -'.json'.length);
  if (newest === undefined) return { stale: true, line: `throughput: no snapshot is kept (${folder})` };
  const next = addDays(newest, 1);
  if (next > lastSettledDay(now, settlesAt)) return { stale: false, line: `throughput: the newest snapshot is ${newest}` };
  const at = settlesAt(next);
  return { stale: now - at > STALE_MS, line: `throughput: the newest snapshot is ${newest}, and ${next}, settled at ${iso(at)}, has none` };
}

/** A tick that leaves the time it last read in `file`: stale when that is more than the hours ago, or not there. */
function askedRow(name, file, { now, fileSystem }) {
  let text;
  try {
    text = fileSystem.readFileSync(file, 'utf8');
  } catch (err) {
    return { stale: true, line: err.code === 'ENOENT' ? `${name}: never read` : `${name}: could not be read (${why(err)})` };
  }
  const at = Date.parse(text.trim());
  if (!Number.isFinite(at)) return { stale: true, line: `${name}: its last read is no time (${file})` };
  return { stale: now - at > STALE_MS, line: `${name}: last read at ${iso(at)}` };
}

/** What the heartbeat on record runs, when it is not the workshop's: the cause of every stale tick on 2026-11-10. */
function loopLine({ home, slug, fileSystem }) {
  const { record } = readRecord(loopRecordPath(home, slug, 'heartbeat'), { readFile: (file) => fileSystem.readFileSync(file, 'utf8') });
  const command = Array.isArray(record?.command) ? record.command : null;
  if (command === null || command.some((part) => WORKSHOP_SCRIPT.test(String(part)))) return null;
  return `the heartbeat on record (since ${record.startedAt}) runs ${command.join(' ')}, the product's, which runs none of these ticks`;
}

/** The idea-watch reading of `project`, its network read bounded: `{ last, unread }`, or `null` with no record. */
async function readIdeas(project) {
  const { ideaWatchHealth } = await import('./idea-watch.mjs');
  const git = (args) => spawnSync('git', args, { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true, timeout: IDEAS_TIMEOUT_MS });
  return ideaWatchHealth(project, { git });
}

async function ideaLine(ideas, project) {
  let state;
  try {
    state = await ideas(project);
  } catch (err) {
    return `idea-watch: could not be read (${err?.message ?? String(err)})`;
  }
  if (!state || state.unread.length === 0) return null;
  const { unreadLine } = await import('../lib/idea-watch.mjs');
  return `idea-watch: ${unreadLine(state)}`;
}

/** Every reading: the three ticks' rows, the loop on record when one is stale, and the idea-watch line. */
async function readTicks({ home, slug, project, now, fileSystem, ideas }) {
  const at = { home, slug, now, fileSystem };
  const rows = [
    throughputRow(at),
    askedRow('windows-daily', askedFile(home, slug), at),
    askedRow('host-watch', hostAskedFile(home, slug), at),
  ];
  const stale = rows.some((row) => row.stale);
  return { rows, stale, loop: stale ? loopLine(at) : null, idea: await ideaLine(ideas, project) };
}

/** The hook's one message, or `null` when nothing is to be said. */
function messageOf({ rows, stale, loop, idea }) {
  const parts = [];
  if (stale) parts.push(`the heartbeat's ticks have not run for ${TICKS_STALE_HOURS} hours: ${rows.filter((row) => row.stale).map((row) => row.line).join('; ')}`, ...(loop ? [loop] : []), FIX);
  if (idea) parts.push(idea);
  return parts.length === 0 ? null : `js-harness workshop: ${parts.join('; and ')}`;
}

export async function ticksMain(
  argv = [],
  {
    cwd: defaultCwd = process.cwd(),
    env = process.env,
    homedir = os.homedir,
    now = Date.now,
    stdout = console.log,
    stderr = console.error,
    fileSystem = fs,
    ideas = readIdeas,
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof TicksArgError)) throw err;
    stderr(`js-harness-workshop ticks: ${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.help) {
    stdout(USAGE);
    return 0;
  }
  const { hook } = parsed;
  try {
    const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
    // A relative home is read from where the command runs, as `loop`, `throughput` and `windows-daily` read it.
    const home = harnessHome({ given: parsed.home, env, cwd: defaultCwd, homedir });
    const project = mainCheckoutByFiles(cwd) ?? mainCheckout((command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 5000 }), cwd);
    const found = await readTicks({ home, slug: projectSlug(project), project, now: now(), fileSystem, ideas });
    if (hook) {
      const message = messageOf(found);
      if (message !== null) stdout(JSON.stringify({ systemMessage: message }));
      return 0;
    }
    for (const row of found.rows) stdout(`${row.stale ? 'STALE  ' : 'ok     '}${row.line}`);
    if (found.stale) for (const line of [...(found.loop ? [found.loop] : []), FIX]) stdout(`       ${line}`);
    if (found.idea) stdout(found.idea);
    return found.stale ? 1 : 0;
  } catch (err) {
    // The hook never fails a session start: what broke is said where he reads it, never on stderr.
    if (!hook) throw err;
    stdout(JSON.stringify({ systemMessage: `js-harness workshop: the heartbeat's ticks could not be read (${why(err)})` }));
    return 0;
  }
}
