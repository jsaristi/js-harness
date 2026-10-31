// `js-harness quiet`: whether anything still runs on this machine, and `--wait`, which ends once nothing has run for
// a while (odd/tasks/quiet-machine.md). The user leaves the lead alone for hours; once every session has finished, the
// PC stays on for nothing, and a session that waits for him moves only when he answers. The lead keeps the wait
// running while he is away and tells him, by a push notification, when it ends. The sources are the board's: the
// sessions `claude agents --json --all` lists, the record of `js-harness sessions start`, the machine's gate lock and
// the process listing (merge-queue lands, Codex reviews). Read-only; a source that could not be read is never quiet.
// Zero dependencies; `--json` gives the same data as the text.

import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { claudeRunner, listAgents, readRecord } from './lib/background.mjs';
import { readGateHolder, readGateWaiters } from './lib/gate-lock.mjs';
import { harnessHome } from './lib/home.mjs';
import { listCommandLines } from './lib/process-list.mjs';
import { QUIET_PROCESSES, lookAtMachine, lookLines } from './lib/quiet.mjs';
import { mainCheckout, projectSlug, readGateLock } from './lib/sessions.mjs';
import { eventsOf, openEvent, stretchFile } from './lib/stretch.mjs';
import fs from 'node:fs';

const DEFAULT_SETTLE_MINUTES = 10;
const DEFAULT_FOR_MINUTES = 720;
const DEFAULT_EVERY_SECONDS = 60;

export const USAGE = [
  'Usage: js-harness quiet [--json] [--self <session id>] [--home <path>]',
  `       js-harness quiet --wait [--settle <minutes>] [--for <minutes>] [--every <seconds>] [--json] [--self <session id>] [--home <path>]`,
  '',
  'One look at the machine: quiet (exit 0), busy (exit 1) or unknown (exit 3, a source could not be read and nothing',
  'was seen to run), with what runs, what needs you and what could not be read. Work is a session claude agents',
  '--json --all lists as busy (or a background one working), the gate lock\'s holder and the gates that wait for it, a',
  'merge-queue --land and a codex exec or codex-review process. A session waiting on a permission prompt or a question',
  'needs you and is not work. A session the listing does not show is not seen. --self (else CLAUDE_CODE_SESSION_ID)',
  'leaves out the session that runs the command, by its id or its first eight characters or more.',
  '',
  `--wait looks at once, then every --every seconds (${DEFAULT_EVERY_SECONDS}), and exits 0 once nothing has run for`,
  `--settle minutes (${DEFAULT_SETTLE_MINUTES}; 0 ends at the first quiet look), saying what it saw and what needs you; a busy`,
  `or unknown look starts the count again. After --for minutes (${DEFAULT_FOR_MINUTES}) with no settle it exits 1 with the`,
  'last look. Run it as a background task, and stop it with TaskStop when it is no longer needed. Exit 2: a usage error.',
  'The wait runs while he is away, so with no stretch open (js-harness stretch status exits 1) it refuses, exit 4,',
  'unless --no-stretch <reason> says why none is needed.',
].join('\n');

class QuietArgError extends Error {}

/** A whole number of `what` for `flag`, at least `min`. */
function wholeNumber(flag, value, what, min) {
  if (!/^\d+$/.test(value) || Number(value) < min) throw new QuietArgError(`${flag} takes ${what}${min > 0 ? ` of ${min} or more` : ''}, not ${value}`);
  return Number(value);
}

const VALUED = new Map([['--self', 'self'], ['--home', 'home'], ['--settle', 'settle'], ['--for', 'forMinutes'], ['--every', 'every'], ['--no-stretch', 'noStretch']]);

function parseArgs(argv) {
  const values = {};
  let json = false;
  let wait = false;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--json') json = true;
    else if (flag === '--wait') wait = true;
    else if (VALUED.has(flag)) {
      const key = VALUED.get(flag);
      if (values[key] !== undefined) throw new QuietArgError(`${flag} is given twice`);
      const value = argv[i + 1];
      if (value === undefined || value === '' || value.startsWith('--')) throw new QuietArgError(`${flag} requires a value`);
      values[key] = value;
      i += 1;
    } else throw new QuietArgError(flag.startsWith('-') ? `unknown argument: ${flag}` : `unexpected argument: ${flag}`);
  }
  for (const flag of ['--settle', '--for', '--every', '--no-stretch']) {
    if (!wait && values[VALUED.get(flag)] !== undefined) throw new QuietArgError(`${flag} goes with --wait`);
  }
  if (values.self !== undefined && values.self.length < 8) throw new QuietArgError('--self takes a session id, or its first eight characters or more');
  return {
    json,
    wait,
    self: values.self,
    home: values.home,
    noStretch: values.noStretch ?? null,
    settle: values.settle === undefined ? DEFAULT_SETTLE_MINUTES : wholeNumber('--settle', values.settle, 'a number of minutes', 0),
    forMinutes: values.forMinutes === undefined ? DEFAULT_FOR_MINUTES : wholeNumber('--for', values.forMinutes, 'a number of minutes', 1),
    every: values.every === undefined ? DEFAULT_EVERY_SECONDS : wholeNumber('--every', values.every, 'a number of seconds', 1),
  };
}

const hourOf = (ms) => new Date(ms).toTimeString().slice(0, 5);

export async function quietMain(
  argv,
  {
    cwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    now = Date.now,
    platform = process.platform,
    homedir = os.homedir,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    // Everything that starts a process is injectable, so a test gives its own listing; `claude` is found on the PATH of `env`.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
    listProcesses = () => listCommandLines(run, platform, QUIET_PROCESSES),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const home = harnessHome({ given: parsed.home, env, cwd, homedir });
  const self = parsed.self ?? env.CLAUDE_CODE_SESSION_ID ?? null;
  const claude = claudeRunner({ env, platform, timeout: 15000 });
  const read = {
    agents: () => listAgents(claude),
    recorded: () => {
      const record = readRecord(home);
      if (record.unavailable !== undefined) throw new Error(record.unavailable);
      return record.sessions.map((entry) => entry.id);
    },
    gateLock: () => readGateLock(() => {
      const readAt = now();
      const reading = { now: () => readAt };
      const waiters = readGateWaiters(home, reading);
      return { holder: readGateHolder(home, reading), waiters, readAt };
    }),
    processes: listProcesses,
  };
  const look = () => lookAtMachine(read, { self, now });

  if (!parsed.wait) {
    const seen = look();
    stdout(parsed.json ? JSON.stringify(seen, null, 2) : lookLines(seen).join('\n'));
    return { quiet: 0, busy: 1, unknown: 3 }[seen.state];
  }

  // The wait runs while he is away, so it asks the stretch of his absence first (odd/tasks/departure-stretch.md, 1a):
  // on 2026-10-31 the lead started it twice with none open.
  if (parsed.noStretch === null) {
    const file = stretchFile(home, projectSlug(mainCheckout(run, cwd)));
    let open = null;
    try {
      open = openEvent(eventsOf(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        stderr(`js-harness quiet --wait: the stretch record ${file} cannot be read (${err.code ?? err.message}); pass --no-stretch <reason> to wait without one`);
        return 4;
      }
    }
    if (open === null) {
      stderr('js-harness quiet --wait: no stretch is open, and the wait runs while he is away (rule:away-autonomy): open one with `js-harness stretch open --plan <file> --html <file>` and show its departure, or pass --no-stretch <reason> to wait without one');
      return 4;
    }
  } else (parsed.json ? stderr : stdout)(`js-harness quiet --wait: no stretch open: ${parsed.noStretch}`);
  // Under --json the whole of stdout is the JSON, so the line that says what the wait is goes to stderr.
  (parsed.json ? stderr : stdout)(`js-harness quiet --wait: waits until nothing has run on this machine for ${parsed.settle} minutes, looking every ${parsed.every} seconds; ends then, or after ${parsed.forMinutes} minutes; stop it with TaskStop when it is no longer needed`);
  const began = now();
  const deadline = began + parsed.forMinutes * 60_000;
  let looks = 0;
  let quietSince = null;
  let lastWork = null;
  for (;;) {
    const seen = look();
    looks += 1;
    if (seen.state === 'quiet') quietSince ??= Date.parse(seen.at);
    else quietSince = null;
    if (seen.work.length > 0) lastWork = { at: seen.at, items: seen.work };
    const settled = quietSince !== null && Date.parse(seen.at) - quietSince >= parsed.settle * 60_000;
    if (settled || now() >= deadline) {
      if (parsed.json) {
        stdout(JSON.stringify({ settled, quietSince: quietSince === null ? null : new Date(quietSince).toISOString(), looks, lastWork, look: seen }, null, 2));
      } else if (settled) {
        const quietMinutes = Math.floor((Date.parse(seen.at) - quietSince) / 60_000);
        stdout(`js-harness quiet --wait: nothing has run on this machine since ${hourOf(quietSince)}, ${quietMinutes} minute${quietMinutes === 1 ? '' : 's'} (${looks} looks); the PC can be turned off`);
        stdout(lastWork === null ? 'no work was seen since the wait began' : lastWork.items.map((item) => `last work seen: ${item.text} (${hourOf(Date.parse(lastWork.at))})`).join('\n'));
        stdout(seen.needsYou.length === 0 ? 'needs you: nothing' : ['needs you:', ...seen.needsYou.map((item) => `  ${item.text}`)].join('\n'));
      } else {
        stdout(`js-harness quiet --wait: after ${parsed.forMinutes} minutes the machine had not been quiet for ${parsed.settle} minutes (${looks} looks); the last look:`);
        stdout(lookLines(seen).join('\n'));
      }
      return settled ? 0 : 1;
    }
    await sleep(Math.min(parsed.every * 1000, deadline - now()));
  }
}
