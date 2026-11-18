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
//
// `--per-pr` answers the other half of the question, what Codex was spent on (odd/tasks/codex-spend.md, spec 6): Codex
// input per landed PR, from the records under `<git common dir>/js-harness/` alone (`perLandedPr`,
// ./lib/land-records.mjs), so it starts no app-server. It exits 0 with its report, 1 when the records cannot be read.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { unknownArgument } from './lib/args.mjs';
import { failureLine, humanLines, parseRateLimits, readRateLimits } from './lib/codex-meter.mjs';
import { floorDebtLines } from './lib/codex-meter.mjs';
import { admittedCodexReviews, defaultBranch, gitOut, reviewCoverage } from './lib/codex-review-coverage.mjs';
import { codexReviewRunsPath } from './lib/codex-review-runs.mjs';
import { isValidCodexReview, jsonLinesPath, readCodexReviews } from './lib/codex-reviews.mjs';
import { DOUBLE_REVIEWS_FILE } from './lib/double-review-records.mjs';
import { perLandedPr, perPrLines, readLandRecord, readRecordLines } from './lib/land-records.mjs';
import { gitDirs } from './lib/project.mjs';
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
  const floor = orElse(() => floorDebtLines(readCodexReviews(cwd).filter(isValidCodexReview), (rec) => !paid(rec), skipLine), []);
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

/** Codex input per landed PR in the repository of `cwd`, read from its records: the run log and the land records read
 * so that a file there that cannot be read throws, the Codex review records with the run log's admission, and git
 * for the commits each land brought in. Each re-read is counted by `reviewCoverage` as the push counts it, handed
 * where the repository is (`where`: its top, its common git dir, and the marks it was told), as a `codex-review` run
 * hands it, so each of its calls asks git none of that again. */
function workingPerPr(cwd = process.cwd()) {
  const git = (args, input) => gitOut(spawnSync, cwd, args, input);
  const top = gitOut(spawnSync, cwd, ['rev-parse', '--show-toplevel']);
  const { commonGitDir } = gitDirs(cwd, spawnSync);
  const where = top && commonGitDir ? { top: path.resolve(top), marks: new Map(), commonGitDir } : undefined;
  const { records, admitted } = admittedCodexReviews(cwd, { where });
  return perLandedPr({
    runs: readRecordLines(codexReviewRunsPath(cwd, { where }), fs),
    records,
    admitted,
    lands: readLandRecord(cwd, spawnSync, fs),
    doubleReviews: readRecordLines(jsonLinesPath(cwd, DOUBLE_REVIEWS_FILE, { where }), fs),
    git,
    defaultRef: defaultBranch(spawnSync, cwd, 'origin')?.ref ?? null,
    coverage: ({ from, tip, records: before }) => reviewCoverage(cwd, { from, tip, where, read: () => before, isValid: () => true, beyondTip: false }),
  });
}

export const USAGE = 'Usage: js-harness codex-meter [--json] [--per-pr]';

class CodexMeterArgError extends Error {}

/** The flags the command takes, `--json` and `--per-pr`; anything else is a usage error, refused before a process
 * starts. */
function parseArgs(argv) {
  const unknown = unknownArgument(argv, { bare: ['--json', '--per-pr'] });
  if (unknown !== null) throw new CodexMeterArgError(`unknown argument: ${unknown}`);
  return { json: argv.includes('--json'), perPrOnly: argv.includes('--per-pr') };
}

/** Runs the command; returns its exit code. `deps` (all optional) pass to `readRateLimits` (`spawn`, `kill`,
 * `platform`, `timeoutMs`, `now`), `codexDebts` gives the Codex debts of the branch, `perPr` the report of Codex input
 * per landed PR, and `log` and `error` take the lines printed, so the tests run no server and read no repository. */
export async function codexMeterMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error, codexDebts = workingDebts, perPr = workingPerPr } = deps;
  let json;
  let perPrOnly;
  try {
    ({ json, perPrOnly } = parseArgs(argv));
  } catch (err) {
    if (!(err instanceof CodexMeterArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  if (perPrOnly) {
    let report;
    try {
      report = perPr();
    } catch (err) {
      error(`could not read the records for Codex input per landed PR: ${err.message}`);
      return 1;
    }
    if (json) log(JSON.stringify(report, null, 2));
    else for (const line of perPrLines(report)) log(line);
    return 0;
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
