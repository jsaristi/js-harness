// `js-harness codex-meter`: Codex's five-hour and weekly limits and its reset credits, read from the local
// `codex app-server`, which answers without running a model, so the read spends no tokens. It writes no file.
//
// Why a command of its own and not `codex-review --plan`. `codex-review` runs a model over a range of commits and
// records the answer; this command reads an account's limits and runs no model, writes nothing, and answers a
// person's question about how much of the window is left. It also lists the Codex debts of the branch, the skips no
// Codex review has paid yet, and every skip made at the floor of the weekly limit (rule:codex-weekly-floor) that no Codex
// review has paid, on any branch, a merged one among them, so the reading that tells a reset came also tells what is
// owed after it. Putting the read inside the review would make one
// command do two unrelated things, and the review's plan is about what a review will cost, not what the account
// has left.
//
// The protocol, the process and the wording are in `./lib/codex-meter.mjs`; this file holds the command's
// arguments, its output and its exit code. It exits 0 with a reading, 1 when the read fails (codex is missing, the
// server does not answer in time, answers with an error, or exits first), and 2 for a usage error, which starts
// no process.
import { unknownArgument } from './lib/args.mjs';
import { failureLine, humanLines, parseRateLimits, readRateLimits } from './lib/codex-meter.mjs';
import { floorDebtLines } from './lib/codex-meter.mjs';
import { readCodexReviews } from './lib/codex-reviews.mjs';
import { branchCodexSkips, codexSkipsOwed, skipLine } from './lib/lens-review-rows.mjs';

/** What `fn` gives, or `fallback` when it throws: a debt that cannot be read must not cost the reading. */
function orElse(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** The Codex debts of the working directory, each as its line: the skips of the branch at HEAD that still owe a review,
 * and the skips made at the floor of the weekly limit that no Codex review has paid, on any branch, with the command
 * that pays each. `null` when neither can be told. */
function workingDebts(cwd = process.cwd()) {
  const branch = orElse(() => branchCodexSkips(cwd), null);
  const paid = (rec) => !(codexSkipsOwed(cwd, { from: rec.base, tip: rec.head }) ?? [rec]).some((owed) => owed.base === rec.base && owed.head === rec.head);
  const floor = orElse(() => floorDebtLines(readCodexReviews(cwd), (rec) => !paid(rec), skipLine), []);
  if (branch === null && floor.length === 0) return null;
  // A floor skip of this branch is listed once, with the command that pays it.
  const lines = (branch ?? []).map(skipLine).filter((line) => !floor.some((one) => one.startsWith(`${line};`)));
  return [...lines, ...floor];
}

/** The lines that list `debts`: none, unknown, or one for each. */
function debtLines(debts) {
  if (debts === null) return ['Codex debts: unknown (no branch with a default branch to compare with here, and no record read)'];
  return debts.length === 0 ? ['Codex debts: none'] : debts.map((debt) => `Codex debt: ${debt}`);
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
  const { log = console.log, error = console.error, codexDebts = workingDebts } = deps;
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
    const debts = codexDebts();
    if (json) log(JSON.stringify({ codexDebts: debts }, null, 2));
    else for (const line of debtLines(debts)) log(line);
    return 1;
  }
  const reading = parseRateLimits(outcome.result);
  const debts = codexDebts();
  if (json) log(JSON.stringify({ ...reading, codexDebts: debts }, null, 2));
  else for (const line of [...humanLines(reading), ...debtLines(debts)]) log(line);
  return 0;
}
