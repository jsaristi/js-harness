// `js-harness reply --hook`: the `Stop` hook of the reply check, C1 of odd/tasks/rule-hierarchy.md (T2). It reads the
// host's payload on standard input and judges the reply that ends the turn (`last_assistant_message`) by
// bin/lib/reply.mjs. A reply is already shown when the hook runs, so it cannot be refused before it is sent: the hook
// turns the stop back with the hooks contract's `decision: "block"` and its reason, and the session writes its close
// again in its next words.
//
// It acts only where the nearest `harness.json` above the session's folder holds a `reply` key, so the entry install
// writes for every session of the machine does nothing in a project that did not turn it on. It lets through a stop
// the hooks already turned back (`stop_hook_active`), so a session is turned back once per stop and never loops. It
// does not run for sub-agents: their end is the host's `SubagentStop`, not `Stop`. Its answer is always JSON and it
// always exits 0: Codex reads a `Stop` hook's exit 0 only with JSON on standard output (its hooks documentation, read
// on 2026-10-16), Claude Code reads `{}` as nothing to say, and whatever the hook cannot read lets the session stop.
//
// In the same projects it also turns back, once, a work session that ends its turn holding work the orchestrator
// handed it with nothing in its background to wake it (bin/lib/stop-wake.mjs, A(a) of odd/tasks/wake-and-flag.md);
// both reasons go in one block when both apply. Codex sends no background tasks, so there that check does not run.
// And it turns back, once a pending set, the lead of a project with a live board whose rows have waited longer than
// one check of the board holds (bin/lib/stale-board.mjs, spec 3 of odd/tasks/visual-pages.md). And it turns back, once
// a return, the lead whose replies since the user's message after a long absence link no status page of
// `report --html` (bin/lib/return-report.mjs, spec 2 of odd/tasks/lead-duty-checks.md). And it turns back a
// reply that hands the user a shell command block not tagged for his shell, not run by the session with success first,
// or rejected by his shell's parser (bin/lib/reply-commands.mjs, S1 of odd/tasks/f8-lead-rigor.md).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closingState, fencedBlocks, replyConfig, replyRefusal } from './lib/reply.mjs';
import { COMMANDS_DEADLINE_MS, commandBlocks, commandRefusals, commandsWarning, shellParser } from './lib/reply-commands.mjs';

const USAGE = 'Usage: js-harness reply --hook\n'
  + '  reads a Stop payload on standard input; where the nearest harness.json holds a "reply" key, turns the stop back\n'
  + '  when the reply does not close with exactly one state (working, decision, question, cut, finished, in the labels\n'
  + '  the key names) and what that state needs, and, once, when a work session ends its turn holding handed work with\n'
  + '  nothing in its background to wake it, and, once, when the lead of a project with a live board ends its turn\n'
  + '  while the board\'s rows waited longer than one check, and, once, when the lead\'s replies since the user\'s\n'
  + '  message after a long absence link no status page of report --html, and when a fenced block hands the user a\n'
  + '  shell command\n'
  + '  not tagged for his shell, not run by the session with success first, or rejected by his shell\'s parser;\n'
  + '  writes nothing and always exits 0\n';

/** The parsed `harness.json` nearest above `start` (that folder included), or `null` when none is found. A file that
 * is there and cannot be read or parsed throws. */
export function nearestHarness(start, readFile) {
  let dir = path.resolve(start);
  for (;;) {
    let text;
    try {
      text = readFile(path.join(dir, 'harness.json'));
    } catch (err) {
      if (err?.code !== 'ENOENT' && err?.code !== 'ENOTDIR') throw err;
    }
    if (text !== undefined) {
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error(`${path.join(dir, 'harness.json')} is not JSON (${err.message})`);
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** How many of the payload's background tasks still run (Claude Code's `background_tasks`; Codex sends none). */
const runningOf = (tasks) => (Array.isArray(tasks) ? tasks.filter((task) => task?.status === 'running').length : 0);

/** `fn` answering once for each key `keyOf` gives its arguments: a call that throws is not kept. */
function once(fn, keyOf) {
  const done = new Map();
  return (...args) => {
    const key = keyOf(...args);
    if (!done.has(key)) done.set(key, fn(...args));
    return done.get(key);
  };
}

/** The `io` the checks of one stop share, over the host's `readFile`, `readdir`, `run`, `env`, `homedir` and `now`.
 * What the checks share is read once a stop, whichever check asks first: a file (the transcript above all), where the
 * project is (`mainCheckout`), and the record of notices, parsed (each was read or asked up to three times a lead's
 * stop, odd/tasks/reply-hook-latency.md). A read that throws is tried again by the next check, which then says so
 * itself; git's answer, a failure included, is the stop's one answer, as a timed-out git would cost each check its two
 * seconds. The modules these need are loaded here, only where the reply check is on; when one cannot be loaded it is
 * said on standard error and each check reads the record and asks git itself, so the reply check still answers.
 * scripts/reply-hook-time.mjs builds its profile on it, so what it times is what the hook does. */
export async function stopIo({ readFile, readdir, run, env, homedir, now }, stderr) {
  const readOnce = once(readFile, (file) => file);
  const runOnce = once(run, (command, args, options) => JSON.stringify([command, args, options?.cwd ?? null]));
  let readNotices;
  let mainCheckout;
  try {
    const [channel, inbox, sessions] = await Promise.all([import('./lib/channel.mjs'), import('./lib/inbox.mjs'), import('./lib/sessions.mjs')]);
    readNotices = once((home, slug) => channel.readNotices(home, slug, { readFile: readOnce }), (home, slug) => JSON.stringify([home, slug]));
    // Where the project is, read from the `.git` files as the inbox hook reads it, and asked of git only when they do
    // not say: under a stop's load a git process takes about half a second to start (p50 468 ms, odd/tasks/
    // reply-hook-latency.md), which a lead's stop, in its main checkout, never needs.
    mainCheckout = once((cwd) => inbox.mainCheckoutByFiles(cwd) ?? sessions.mainCheckout(runOnce, cwd), (cwd) => cwd);
  } catch (err) {
    stderr(`js-harness reply: ${err?.message ?? err}; each check reads the record and finds the project by itself\n`);
  }
  return { readFile: readOnce, readdir, run: runOnce, env, homedir, now, readNotices, mainCheckout };
}

/** The wake check's warning (bin/lib/stop-wake.mjs), or `null`; a record it cannot read is said on standard error
 * and costs nothing else: the reply check above still answers. */
async function wakeOf(payload, state, io, stderr) {
  try {
    // Loaded only where the reply check is on: the board's module is large, and every project pays the hook.
    const { wakeWarning } = await import('./lib/stop-wake.mjs');
    return wakeWarning(payload, state, io);
  } catch (err) {
    stderr(`js-harness reply: ${err?.message ?? err}; the wake check did not run\n`);
    return null;
  }
}

/** The stale-board check's warning (bin/lib/stale-board.mjs), or `null`, read as the wake check is. */
async function staleOf(payload, state, io, stderr) {
  try {
    const { staleBoardWarning } = await import('./lib/stale-board.mjs');
    return staleBoardWarning(payload, state, io, io.now());
  } catch (err) {
    stderr(`js-harness reply: ${err?.message ?? err}; the stale-board check did not run\n`);
    return null;
  }
}

/** The return check's warning (bin/lib/return-report.mjs), or `null`, read as the wake check is. */
async function returnOf(payload, state, io, stderr) {
  try {
    const { returnReportWarning } = await import('./lib/return-report.mjs');
    return returnReportWarning(payload, state, io);
  } catch (err) {
    stderr(`js-harness reply: ${err?.message ?? err}; the return check did not run\n`);
    return null;
  }
}

/** The command-block check's warning (bin/lib/reply-commands.mjs), or `null`. The transcript is read only when the
 * reply holds a command block, and the parser gets what is left of the check's one deadline; a check that throws is
 * said on standard error and lets the rest answer. */
export function commandsOf(payload, message, { readFile, platform, parse, now, started }, stderr) {
  try {
    const blocks = fencedBlocks(message);
    if (commandBlocks(blocks).length === 0) return null;
    let transcript = null;
    if (typeof payload.transcript_path === 'string' && payload.transcript_path !== '') {
      try {
        transcript = readFile(payload.transcript_path);
      } catch {
        // No transcript to read (Codex sends none): every block goes to the parser instead.
      }
    }
    const until = started + COMMANDS_DEADLINE_MS;
    const reasons = commandRefusals(blocks, { platform, transcript, parse: parse ?? shellParser(platform), now, until });
    return commandsWarning(reasons, platform);
  } catch (err) {
    stderr(`js-harness reply: ${err?.message ?? err}; the command-block check did not run\n`);
    return null;
  }
}

export async function replyMain(argv, {
  readStdin = () => fs.readFileSync(0, 'utf8'),
  // Read as bytes, then decoded: the same text, about three times faster on a lead's 60 MB transcript than
  // `readFileSync(file, 'utf8')` (77–132 ms against 236–385 ms, Node 24.15, odd/tasks/reply-hook-latency.md).
  readFile = (file) => fs.readFileSync(file).toString('utf8'),
  readdir = (dir) => fs.readdirSync(dir),
  run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 2000 }),
  env = process.env,
  homedir = os.homedir,
  now = () => Date.now(),
  platform = process.platform,
  parse = null,
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
} = {}) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(USAGE);
    return 0;
  }
  if (argv.length !== 1 || argv[0] !== '--hook') {
    // The first token that is not the lone --hook, named as the other commands name a refused argument.
    const unknown = argv.find((token, i) => i > 0 || token !== '--hook');
    stderr(`${unknown === undefined ? '' : `js-harness reply: unknown argument: ${unknown}\n\n`}${USAGE}`);
    return 2;
  }
  const started = now();
  let reason = null;
  let payload = null;
  try {
    payload = JSON.parse(readStdin());
  } catch {
    // Input the host did not send as JSON is no reply to check.
  }
  const message = payload?.last_assistant_message;
  if (payload?.stop_hook_active !== true && typeof message === 'string') {
    try {
      const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
      const config = replyConfig(nearestHarness(cwd, readFile));
      if (config?.error) stderr(`js-harness reply: ${config.error}; the reply check did not run\n`);
      else if (config !== null) {
        reason = replyRefusal(message, config, { running: runningOf(payload.background_tasks) });
        const state = closingState(message, config);
        const io = await stopIo({ readFile, readdir, run, env, homedir, now }, stderr);
        const wake = await wakeOf(payload, state, io, stderr);
        const stale = await staleOf(payload, state, io, stderr);
        const back = await returnOf(payload, state, io, stderr);
        // Last, so its one deadline, counted from the hook's start, holds the other checks' time too.
        const commands = commandsOf(payload, message, { readFile: io.readFile, platform, parse, now, started }, stderr);
        for (const warning of [commands, wake, stale, back]) {
          if (warning !== null) reason = reason === null ? warning : `${reason}\n\n${warning}`;
        }
      }
    } catch (err) {
      // A harness.json that is there and cannot be read lets the session stop, and says why the check did not run.
      reason = null;
      stderr(`js-harness reply: ${err?.message ?? err}; the reply check did not run\n`);
    }
  }
  stdout(`${JSON.stringify(reason === null ? {} : { decision: 'block', reason })}\n`);
  return 0;
}
