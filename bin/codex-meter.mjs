// `js-harness codex-meter`: Codex's five-hour and weekly limits and its reset credits, read from the local
// `codex app-server`, which answers without running a model, so the read spends no tokens. It writes no file.
//
// Why a command of its own and not `codex-review --plan`. `codex-review` runs a model over a range of commits and
// records the answer; this command reads an account's limits and runs no model, writes nothing, and answers a
// person's question about how much of the window is left. Putting the read inside the review would make one
// command do two unrelated things, and the review's plan is about what a review will cost, not what the account
// has left.
//
// The protocol, the process and the wording are in `./lib/codex-meter.mjs`; this file holds the command's
// arguments, its output and its exit code. It exits 0 with a reading, 1 when the read fails (codex is missing, the
// server does not answer in time, answers with an error, or exits first), and 2 for a usage error, which starts
// no process.
import { unknownArgument } from './lib/args.mjs';
import { failureLine, humanLines, parseRateLimits, readRateLimits } from './lib/codex-meter.mjs';

export const USAGE = 'Usage: js-harness codex-meter [--json]';

class CodexMeterArgError extends Error {}

/** The one flag the command takes, `--json`; anything else is a usage error, refused before a process starts. */
function parseArgs(argv) {
  const unknown = unknownArgument(argv, { bare: ['--json'] });
  if (unknown !== null) throw new CodexMeterArgError(`unknown argument: ${unknown}`);
  return { json: argv.includes('--json') };
}

/** Runs the command; returns its exit code. `deps` (all optional) pass to `readRateLimits` (`spawn`, `kill`,
 * `platform`, `timeoutMs`, `now`), and `log` and `error` take the lines printed, so the tests run no server. */
export async function codexMeterMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error } = deps;
  let json;
  try {
    ({ json } = parseArgs(argv));
  } catch (err) {
    if (!(err instanceof CodexMeterArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const outcome = await readRateLimits(deps);
  if (outcome.killError) error(`could not stop codex app-server: ${outcome.killError}`);
  if (!outcome.ok) {
    error(failureLine(outcome));
    return 1;
  }
  const reading = parseRateLimits(outcome.result);
  if (json) log(JSON.stringify(reading, null, 2));
  else for (const line of humanLines(reading)) log(line);
  return 0;
}
