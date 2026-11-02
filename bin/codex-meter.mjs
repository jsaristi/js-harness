// `js-harness codex-meter`: Codex's five-hour and weekly limits and its reset credits, read from the local
// `codex app-server`, which answers without running a model, so the read spends no tokens. It writes no file.
//
// Why a command of its own and not `codex-review --plan`. `codex-review` runs a model over a range of commits and
// records the answer; this command reads an account's limits and runs no model, writes nothing, and answers a
// person's question about how much of the window is left. It also lists the Codex debts of the branch, the skips no
// Codex review has paid yet, among them those made at the floor of the weekly limit (rule:codex-weekly-floor), so the
// reading that tells a reset came also tells what is owed after it. Putting the read inside the review would make one
// command do two unrelated things, and the review's plan is about what a review will cost, not what the account
// has left.
//
// The protocol, the process and the wording are in `./lib/codex-meter.mjs`; this file holds the command's
// arguments, its output and its exit code. It exits 0 with a reading, 1 when the read fails (codex is missing, the
// server does not answer in time, answers with an error, or exits first), and 2 for a usage error, which starts
// no process.
import { unknownArgument } from './lib/args.mjs';
import { failureLine, humanLines, parseRateLimits, readRateLimits } from './lib/codex-meter.mjs';
import { owedSkipLines } from './lib/lens-review-rows.mjs';

const CODEX_SKIP = 'codex: ';

/** The Codex skips that still owe a review on the branch at HEAD of the working directory, each as its line; `null` when
 * it cannot be told. */
function branchCodexDebts() {
  const lines = owedSkipLines(process.cwd());
  return lines === null ? null : lines.filter((line) => line.startsWith(CODEX_SKIP)).map((line) => line.slice(CODEX_SKIP.length));
}

/** The lines that list `debts`: none, unknown, or one for each. */
function debtLines(debts) {
  if (debts === null) return ['Codex debts on this branch: unknown (no branch with a default branch to compare with here)'];
  return debts.length === 0 ? ['Codex debts on this branch: none'] : debts.map((debt) => `Codex debt on this branch: ${debt}`);
}

export const USAGE = 'Usage: js-harness codex-meter [--json]';

class CodexMeterArgError extends Error {}

/** The one flag the command takes, `--json`; anything else is a usage error, refused before a process starts. */
function parseArgs(argv) {
  const unknown = unknownArgument(argv, { bare: ['--json'] });
  if (unknown !== null) throw new CodexMeterArgError(`unknown argument: ${unknown}`);
  return { json: argv.includes('--json') };
}

/** Runs the command; returns its exit code. `deps` (all optional) pass to `readRateLimits` (`spawn`, `kill`,
 * `platform`, `timeoutMs`, `now`), `codexDebts` gives the Codex debts of the branch, and `log` and `error` take the
 * lines printed, so the tests run no server and read no repository. */
export async function codexMeterMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error, codexDebts = branchCodexDebts } = deps;
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
    for (const line of debtLines(codexDebts())) log(line);
    return 1;
  }
  const reading = parseRateLimits(outcome.result);
  const debts = codexDebts();
  if (json) log(JSON.stringify({ ...reading, codexDebts: debts }, null, 2));
  else for (const line of [...humanLines(reading), ...debtLines(debts)]) log(line);
  return 0;
}
