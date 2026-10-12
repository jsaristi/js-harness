#!/usr/bin/env node
// `js-harness codex-review --base <rev>`: run `codex exec review` over `<rev>..HEAD` and record that
// it ran, or record an explicit skip with `--unavailable <reason>`. The record is what
// `check --push` reads to catch a slice that was never reviewed (T7 in odd/tasks/project-init.md).
// A completed Codex turn does not mean it read the diff (a sandbox that denies process launch still
// completes, with a review that says so), and neither its wording nor the text of the commands it
// ran is evidence. What Codex saw is: the changed lines of `git diff <base> HEAD`, computed here, must
// all appear in the output of the commands that succeeded in its JSONL event stream (design and
// probes: odd/tasks/codex-exec-review.md).
//
// A review runs on one model at one effort, `REVIEW_MODEL` at `REVIEW_EFFORT`, which the command names to
// Codex itself and no flag changes (Sebastián, 2026-10-08; odd/tasks/codex-review-cost.md). The session's
// own rollout file says what it ran with, and the review is held to that: one that ran on anything else
// does not stand, and nothing it answered is shown.
//
// Codex runs in one session, the lean one, which loads what a review needs and nothing else: the diff,
// read access to the repository, the project's `AGENTS.md` and Codex's own review rubric. It ignores the
// user's Codex config and its rules, disables plugins, apps and hooks, and runs in a Codex home of its own,
// because that is the only way to leave the user's global `AGENTS.md` out. It is called lean because there
// was a second one, `current`, the review on top of the user's whole Codex configuration, chosen with
// `--session current`. That session was removed on 2026-10-08: a review runs on one model alone, and what
// `current` ran on could not be verified. As a person ran it, it was ephemeral in the user's own Codex
// home, so nothing said which model it ran on; a `review_model` or a profile of that configuration could
// still win over the model the command passed; and measuring it would have meant writing sessions into the
// user's real Codex home. A session whose model nobody can check is how a review runs on another model
// unnoticed. So the one session left is the one whose rollout file is read, and a review is held to what
// that file says it ran on; a machine where the lean session cannot run records an explicit skip with
// `--unavailable <reason>`. `--session lean` is still read, and means what no flag means; `--session
// current` is a usage error that says why it is gone and what to do instead.
// (`lean` had become the default once a comparison of the two over two ranges showed it finding the same
// or more with fewer tokens: odd/tasks/codex-review-lean.md, T12 and T13; the numbers are in
// evals/results/review/report.md.)
//
// The session's home is a folder made for the one run, `<home>/.js-harness/codex-review-homes/<run
// id>/`, handed to Codex as `CODEX_HOME` and removed when the run ends, however it ends, with the folder of
// the homes and `.js-harness` when that leaves them empty: a review leaves nothing on the machine. It is made with
// one thing in it: the login, as a hard link to the real `auth.json`, never a copy, so a refresh of the
// login inside the review is a refresh of the real one (`bin/lib/codex-review-home.mjs` has the reasons and
// how to undo it). `<home>` is `--home`, else `JS_HARNESS_HOME`, else the OS home, an empty one counting as
// unset; the real Codex home is `CODEX_HOME`, else `.codex` under the OS home. `--keep-home` leaves the
// folder after the run without the login and prints its path, so a person can read what the session wrote
// there.
//
// What a review spent is read from that home. `codex exec review --json` reports a `usage` of zeros,
// whatever the review spent (see `rolloutReading` in `bin/lib/codex-usage.mjs`), and the tokens are on disk
// only for a session that is not `--ephemeral`, in the rollout files of its home. So the session is not
// ephemeral, and its rollout files are read after Codex ends and before the home goes. A home that holds
// no count leaves the tokens unknown, and the run line says so with `null`, never with a zero.
//
// What a review answered is read from that home too. Codex's rubric makes the review end with its findings
// as JSON, which `--json` prints only rendered as text; the JSON is the last message in the rollout file of
// the review's sub-agent (`bin/lib/codex-review-answer.mjs`). It is read, checked against a schema, printed
// as one line per finding and counted in the run line. A review whose answer cannot be read that way is a
// failed attempt, and no review is recorded. The findings and the verdict are printed only for an attempt
// that stands (completed, on the model and at the effort it was asked for, answered, every changed line
// shown): above an error they would read as the review the attempt is not, so one line says instead that
// it does not stand.
//
// What a review ran on is read from that home as well: the model and the effort the review's sub-agent
// wrote in its rollout file (`rolloutReading`). A session that ran on another model or at another effort
// than the command passed is a failed attempt, whatever it answered, and so is one whose file names no
// model at all: a review that cannot say which model it ran on is not a review on the one model. Theirs are
// the attempts whose rendered review is not passed through either. An effort the file does not name is not
// held against a review.
//
// What a review is asked is chosen with `--prompt`. `codex`, the default, is
// `--base <merge-base>` with the sentence Codex writes itself. `own` is this command's prompt
// (`bin/lib/codex-review-prompt.mjs`): it names the committed range and the command that shows it, and with
// `--doc <feature document>` carries that document's Goal and Done when, to judge the change against.
// `--base` and a prompt exclude each other on Codex's command line, so under `own` there is no `--base`
// there, and the prompt goes in on stdin (`-`): it has newlines, and may hold quotes, `%` and `&`, none of
// which the one command line `cmd.exe` runs on Windows can carry. Codex's rubric applies under either, so
// the answer is read the same way. `codex` stays the default: in the comparison the two found the same at
// about the same cost (odd/tasks/codex-review-lean.md, Progress, 2026-10-08).
//
// A range too large for one session is reviewed in parts. The model reads the
// diff through a tool whose output is bounded, so on a large range some changed lines are never shown and
// the evidence rule says, rightly, that the range was not inspected. The rule is not relaxed for that: the
// range is split by whole files into parts of at most `PART_MAX_CHANGED_LINES` changed lines, or
// `--part-lines <n>`, and of at most `PART_MAX_FILES` files, whose paths go on one command line
// (`bin/lib/codex-review-parts.mjs`), and the parts are reviewed one after another, never two at once.
// Each part is a Codex session of its own, in a lean home of its own, asked with this command's own
// prompt naming its files (`--base` cannot be limited to files), held to the evidence rule for the
// changed lines of its own files, and logged in a run line of its own. The first part that does not pass
// stops the run. The review is recorded, in one record for the whole range, only when every part passed,
// and what the parts answered is shown then, together and not before: the review Codex rendered of each,
// and the findings of all of them. When a part does not pass, nothing any part answered is shown, since
// the parts that passed are no review of the range. A range within both bounds is one part, and
// its review is the one described above, unchanged.
//
// A review reads code, and leaves the rest out (`bin/lib/codex-review-scope.mjs`): Markdown files, and the
// paths the project marks with `-codex-review` in a `.gitattributes`, as the commit at the head of the range
// holds it. One review of a whole branch found all it found in the quarter of its lines that was code, and
// nothing in its documents, the fixture of an eval and the JSON readings of evals
// (odd/tasks/codex-review-cost.md). A file that is left out is in no part, in no prompt and not among the
// changed lines a session must have seen, and the plan of every run says how many were left out and why.
// `--base` reviews every file of a range, so a range that leaves some out is asked by its files with this
// command's own prompt, under either `--prompt`, also when those files fit in one part: that one session is
// then shown and recorded as the review of a whole range is, its run line says which files it covered
// (`part`, 1 of 1), and the record says what was left out (`leftOut`). A range whose files are all left
// out has no part, like one that changes no file.
//
// What a run will cost is said before it is spent (`bin/lib/codex-review-plan.mjs`). `--plan` prints the
// plan and exits 0: the range, the model and the effort, the parts with their files and changed lines, and
// an estimate of the input tokens, from a likely figure to a high one, made from this machine's own run log
// and never from a number written here.
// It starts nothing: no Codex is looked for, no home is made, no login is looked at, and nothing is logged
// or recorded, so it works on a machine with no Codex and over a tree with uncommitted changes. A real run
// prints the same plan before its first session; one whose range changes no file has no part, so it starts
// nothing either and exits 0, having recorded, when the range holds a commit, that there was nothing to
// review in it (`NOTHING_TO_REVIEW`); so does one whose files are all left out. And a run of more parts than `MAX_PARTS_WITHOUT_FLAG` is
// refused before anything is started, with its plan, until it names its count with `--max-parts <n>`: one
// run of 28 parts, started without either number having been seen, was more than half of what fifty
// reviews spent (odd/tasks/codex-review-cost.md).
//
// No review is paid for twice (`bin/lib/codex-review-coverage.mjs`). Before its plan a run reads the review
// records against the range it was given, by the definition `check --push` reads them with: the code commits
// of the range, and which of them a record already covers. It starts at the parent of the oldest one no
// record covers, where that is safe, and says so in a line that counts them; from there on its range is that
// one, in the plan, the parts and their bound, the prompts, the lines a session must have seen, the run
// lines and the record. A range with no code commit left starts nothing and records nothing, also when it
// holds none at all (documents only), since the push check asks a record of code commits alone. `--plan`
// says the same and spends nothing, and `--unavailable` records its skip for the range that is left.
// `--again` is the way to review on purpose what has a record: the range as it was given, with the records
// not read. So is a range whose records cannot be read against it, with a line that says why.
//
// Two files are written, both in `<git common dir>/js-harness/`. `codex-reviews.jsonl` is the record
// above: a line for a review that met the evidence rule, for an explicit skip, or for a range that held
// commits and nothing to review, which started no session. `codex-review-runs.jsonl`
// is the run log: a line for EVERY attempt that launched Codex, also the ones that failed, timed out or
// were interrupted, with its outcome, the range, the session, the codex-cli version, the wall time, what
// the rollout files say it spent (tokens, requests, threads) and ran with (the model and the effort of the
// session, beside the two the command passed), what Codex's events say it did (turns,
// items by type, commands), the prompt it was asked with, which part of the range it was when the range was
// reviewed in parts and, when its answer was read, the findings by severity and the verdict. A reviewed record names its run line by id (`run`), and the record of a range
// reviewed in parts the lines of all its parts (`runs`, one entry a part, `null` for a line that could not be
// written, with `run` the last); a run line is a measurement and never evidence of a review, so
// `check --push` does not read it.
//
// What the comparison of the configurations varies (`evals/review/compare.mjs`) is not on the command line,
// on purpose: the command fixes the model and the effort, and a person who runs it gets exactly the
// session above. The comparison calls `codexReviewMain` with injected `deps` instead: `effort`, the effort
// the command passes, in place of `REVIEW_EFFORT` (its cells were measured at `medium` and at `high`, and
// stay what they measured); `extraCodexConfig`, more `-c` settings for the session (an MCP server);
// `everyFile`, which makes the review read every file of the range, as every review did while the cells were
// measured, so that none of them leaves a document out, is asked by its files, or starts later than its
// range because a record covers part of it; and `onResult`, which hands back each attempt's run line and
// answer.
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { randomUUID as newUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { findingCounts, normalizeAnswer, REVIEW_ANSWER_SCHEMA_VERSION, rolloutAnswer } from './lib/codex-review-answer.mjs';
import { MARKS_UNREAD, notReviews, reviewCoverage, reviewStart } from './lib/codex-review-coverage.mjs';
import { createLeanHome as makeLeanHome, leanHomesDir, realCodexHome, sweepStaleLeanHomes } from './lib/codex-review-home.mjs';
import { numstatFiles, PART_MAX_CHANGED_LINES, PART_MAX_FILES, reviewParts } from './lib/codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG, needsFlagLine, partsBound, planLines, reviewPlan } from './lib/codex-review-plan.mjs';
import { IntentError, REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION, reviewIntent, reviewPrompt } from './lib/codex-review-prompt.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA, keptPartFor, partKey, readCodexReviewRuns, runKept } from './lib/codex-review-runs.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA, NOTHING_TO_REVIEW } from './lib/codex-reviews.mjs';
import { noRolloutReading, rolloutReading, sessionReading } from './lib/codex-usage.mjs';
import { leftOutOf, leftOutSaid, patchOfRead, reviewScope } from './lib/codex-review-scope.mjs';
import { killTree } from './lib/process-tree.mjs';
import { gitDirs } from './lib/project.mjs';
import { quoteWindowsArg, windowsCommandLine } from './lib/windows-args.mjs';

// The model and the effort of a review. Sebastián fixed both on 2026-10-08
// (odd/tasks/codex-review-cost.md): the one model a review runs on, at `high`, in place of the `medium` he
// had fixed for the lean session on 2026-10-06. The command names them to Codex itself, and the session
// ignores the user's Codex config, which could name others. They are up here because the usage names them.
export const REVIEW_MODEL = 'gpt-6.1-sol';
export const REVIEW_EFFORT = 'high';

// `--home` is where the harness keeps its machine state (`<home>/.js-harness/`), as in the other
// commands: `--home`, else `JS_HARNESS_HOME`, else the OS home. A review keeps one thing there, the Codex
// home of its run, and `--keep-home` leaves that home after the run. `--doc`, for `--prompt own`, is a
// path, taken from `--cwd` when it is relative. `--part-lines` is how many changed lines a part of a large
// range holds at most, in place of `PART_MAX_CHANGED_LINES`. `--plan` prints what the run would start and
// starts nothing, and `--max-parts` is how many parts a run may start, in place of `MAX_PARTS_WITHOUT_FLAG`.
// `--fresh` asks every part of a range reviewed in parts again, where a run otherwise takes from the run log the
// parts that passed in an earlier run of the same range.
//
// The second line of the usage is there because a person has to know that their own Codex configuration
// is not loaded, and that nothing they pass or configure changes the model and the effort. The third, because
// what a review costs is theirs to see before it is spent. The fourth, because a project has to know that a
// review does not read every file, and how it says which others to leave out. The fifth, because a run that
// reviews less than it was asked, or nothing, must not come as a surprise, and `--again` is the way round it.
// `--session` is not in the usage: there is one session, so there is nothing to choose (see `SESSION`).
const USAGE =
  'Usage: js-harness codex-review --base <rev> [--plan] [--again] [--prompt <codex|own>] [--doc <feature document>] [--part-lines <n>] [--max-parts <n>] [--fresh] [--keep-home] ' +
  '[--unavailable <reason>] [--cwd <path>] [--home <path>]\n' +
  'Codex gets the diff, the repository to read and the project\'s AGENTS.md, and none of your Codex configuration; ' +
  `the review runs on ${REVIEW_MODEL} at ${REVIEW_EFFORT} effort, which the command fixes.\n` +
  `--plan prints what the run would start and what it is estimated to send, and starts nothing; a run of more than ${MAX_PARTS_WITHOUT_FLAG} parts is not started without --max-parts <n>.\n` +
  'A review reads code: Markdown files and the paths a .gitattributes marks `-codex-review` are left out of it, and the plan says how many.\n' +
  'A run starts where the Codex review records end: commits a record covers are not reviewed again, and a range they cover whole starts nothing; --again takes the range as it was given.';

// The one session a review runs in, as the run log names it (`session`): a line written while there were
// two says `current` or `lean`, and a new one only ever says this.
const SESSION = 'lean';

// What `--session current` is answered with since that session was removed. It is a flag given wrong, so
// the usage follows it and nothing is launched or recorded, also beside `--unavailable`: a command line
// that still names the removed session is one to correct, not one to guess the meaning of.
const SESSION_REMOVED =
  `\`--session current\` was removed on 2026-10-08: a review runs only on ${REVIEW_MODEL} at ${REVIEW_EFFORT} effort, and the model that session ran on could not be verified. ` +
  'On a machine where the lean session cannot run, record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

// What the review is asked with; the first is the default. `codex` is the sentence Codex writes itself for
// `--base`, `own` this command's prompt (`reviewPrompt`).
const PROMPTS = ['codex', 'own'];

// The PROMPT argument that makes `codex exec review` read its prompt from stdin (its `--help`, 0.160.1:
// "If `-` is used, read from stdin").
const PROMPT_ON_STDIN = '-';

class ArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new ArgError(`${flag} requires a value`);
  return value;
}

/** Parses `argv`. `--base` is required even with `--unavailable`: the record needs its range. */
function parseArgs(argv) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? requireValue(argv, i, flag) : undefined;
  };
  const base = get('--base');
  if (base === undefined) throw new ArgError('--base is required');
  const unavailable = get('--unavailable')?.trim();
  if (unavailable === '') throw new ArgError('--unavailable needs a non-empty reason');
  const home = get('--home');
  // `--session lean` is still read, and means what no flag means: it was the way to name this session
  // while there were two, and the command lines that carry it (a script, a note, a habit) must not break
  // over a flag that changes nothing. Every `--session` on the line is asked, not the first alone, so that
  // the removed one is refused wherever it stands.
  for (let i = argv.indexOf('--session'); i !== -1; i = argv.indexOf('--session', i + 1)) {
    const session = requireValue(argv, i, '--session');
    if (session === 'current') throw new ArgError(SESSION_REMOVED);
    if (session !== SESSION) throw new ArgError('--session must be `lean`: a review runs in one session, and the flag is still read only for the command lines that named it');
  }
  // Beside `--unavailable` the four that follow are taken and change nothing: a skip launches nothing, so
  // there is no home to keep, no prompt to send, no range to split and no parts to count, and the skip that
  // was asked for is recorded all the same (`--doc` is still read first, as a flag given wrong is).
  const keepHome = argv.includes('--keep-home');
  const prompt = get('--prompt') ?? PROMPTS[0];
  if (!PROMPTS.includes(prompt)) throw new ArgError('--prompt must be `codex` or `own`');
  const doc = get('--doc');
  if (doc !== undefined && prompt !== 'own') throw new ArgError('--doc needs --prompt own: only this command\'s own prompt carries the intent of a feature document');
  /** The count `flag` was given, a positive integer, or `undefined` when the flag is not there; `what` says
   * what it counts, for the error of one that is anything else. */
  const count = (flag, what) => {
    const given = get(flag);
    if (given === undefined) return undefined;
    const value = /^[1-9]\d*$/.test(given) ? Number(given) : Number.NaN;
    if (!Number.isSafeInteger(value)) throw new ArgError(`${flag} must be a positive integer: ${what}`);
    return value;
  };
  const partLines = count('--part-lines', 'how many changed lines a part of a large range holds at most') ?? PART_MAX_CHANGED_LINES;
  // Left `undefined` when no count was named: the plan says which of the two bounds a run is over.
  const maxParts = count('--max-parts', 'how many parts the run may start');
  // A plan beside a skip is two commands in one line: the first starts and records nothing, and the second
  // is a record. Neither is guessed at.
  const plan = argv.includes('--plan');
  if (plan && unavailable !== undefined) throw new ArgError('--plan does not go with --unavailable: a plan starts nothing and records nothing, and a skip is a record');
  // The range as it was given, whatever the records say of it: beside a plan and beside a skip too.
  const again = argv.includes('--again');
  // The parts that passed in earlier runs of the range are asked again, not taken from the run log.
  const fresh = argv.includes('--fresh');
  return { base, unavailable, home, keepHome, prompt, doc, partLines, maxParts, plan, again, fresh, cwd: get('--cwd') ?? process.cwd() };
}

const REVIEW_MAX_BUFFER = 64 * 1024 * 1024;

/** The stdout of a successful `git <args>` run in `cwd`, as git wrote it (empty when it printed nothing),
 * else `null`: a failed run and an empty answer are different things. `options` extend the spawn's. */
function gitOutput(spawn, cwd, args, options = {}) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8', ...options });
    if (result && !result.error && result.status === 0) return result.stdout ?? '';
  } catch {
    // No git on PATH: the caller reports it as an unresolvable repository or revision.
  }
  return null;
}

/** `gitOutput`, trimmed: for an answer of one line, or one whose ends do not matter. Not for a list of
 * paths (`-z`), where a path may begin or end with a space. */
function git(spawn, cwd, args, options = {}) {
  return gitOutput(spawn, cwd, args, options)?.trim() ?? null;
}

// Read-only sandbox, no approvals: the review reads the repository and nothing else.
const SANDBOX_CONFIG = ['sandbox_mode=read-only', 'approval_policy=never'];

/** The model and the effort, as Codex is handed them, right before the sandbox settings. `-m` is the model
 * of the session, and the review's sub-agent runs on it unless a `review_model` is configured, which wins
 * over it (odd/tasks/codex-review-lean.md, "Model and effort", read from Codex's source). The session
 * ignores the configuration that could name one, and what it ran on is read back from its rollout file
 * (`ranOnAnother`): the two are passed here and checked there. */
const modelFlags = (effort) => ['-m', REVIEW_MODEL, '-c', `model_reasoning_effort="${effort}"`];

// The Windows sandbox of the lean session. The command's own choice, as the model and the effort are, and
// the one the user's config names: it needs no administrator, no setup step and, for a read-only session,
// no change to the access lists of the workspace or of the home. It writes `cap_sid` and `.sandbox/` into
// `CODEX_HOME`, which is the lean home and goes with it.
const LEAN_WINDOWS_SANDBOX = 'unelevated';

// The `lean` session: what a review needs and nothing else. Why each flag is here, with the lines of
// Codex's source it was read from, is the section "What Codex loads, and what `exec review` accepts
// (T4, 2026-10-06)" of odd/tasks/codex-review-lean.md. It is not `--ephemeral`: its home is thrown away
// after the run, and only a session that is not ephemeral writes there the rollout files the tokens are
// read from. `effort` is `REVIEW_EFFORT` for everyone but the comparison of the configurations, whose cells
// stay at the effort they were measured with.
const leanFlags = (platform, effort) => [
  // Leaves out every key of `$CODEX_HOME/config.toml`: the MCP servers, the plugins, the model
  // instructions file, and the user's model and effort. Auth still uses the home.
  '--ignore-user-config',
  // Leaves out the execpolicy `.rules` files, which are found through the home's folder, not the config.
  '--ignore-rules',
  // Leave out the plugins wholesale (so no plugin is turned off one by one), the built-in
  // `codex_apps` MCP server, and the handlers of `hooks.json`, which is read from the home either way.
  '--disable', 'plugins',
  '--disable', 'apps',
  '--disable', 'hooks',
  // With the user's config ignored, nothing but the command names the model and the effort.
  ...modelFlags(effort),
  ...SANDBOX_CONFIG.flatMap((setting) => ['-c', setting]),
  // On Windows alone. With approvals at `never`, a read-only sandbox and NO Windows sandbox configured,
  // Codex forbids every shell command, "rejected: blocked by policy" (`core/src/exec_policy.rs:789-806` at
  // rust-v0.160.0), so the review cannot read the diff. The user's `[windows] sandbox` is a key of the
  // config this session ignores, so the session names one itself.
  ...(platform === 'win32' ? ['-c', `windows.sandbox="${LEAN_WINDOWS_SANDBOX}"`] : []),
  // Leaves out the instructions of the skills in `$CODEX_HOME/skills` and `~/.agents/skills`. INFERRED
  // from source (the key is read; its effect was not seen in a run): T5's first real run confirms it.
  '-c', 'skills.include_instructions=false',
];

/** The arguments of the Codex run over `<base>..HEAD`; `base` is a full commit id. There is one list, that
 * of the lean session (`leanFlags`), and no session to choose: until 2026-10-08 a second parameter named
 * one. `platform` is where Codex runs: the list has one more setting on `win32`. The global `AGENTS.md`
 * is not in it: no flag leaves that out, only a home of the review's own, which `codexReviewMain` sets in
 * the environment (`leanEnv`).
 *
 * `prompt` is what the review is asked with. `codex`, the default, is `--base <base>`: Codex writes the
 * sentence itself. `own` is a custom-target review: no `--base`, which Codex refuses beside a prompt, and
 * `-` in its place, so Codex reads the prompt from stdin; `base` is then in that prompt and not in this
 * list.
 *
 * The last argument is what the comparison of the configurations varies, each with today's value as its
 * default; no flag of the command sets either. `effort` is the effort the command passes. `extraConfig` is
 * more `key=value` settings, each handed over with `-c` after the session's own and before what is
 * reviewed. */
export function codexArgs(base, platform = process.platform, prompt = PROMPTS[0], { effort = REVIEW_EFFORT, extraConfig = [] } = {}) {
  if (!PROMPTS.includes(prompt)) throw new Error(`Unknown prompt ${JSON.stringify(prompt)}: it must be \`codex\` or \`own\`.`);
  // Both end up inside one argument of a command line, the effort between the quotes of a TOML string.
  if (typeof effort !== 'string' || !/^[a-z]+$/.test(effort)) throw new Error(`The effort of a review must be one lowercase word, got ${JSON.stringify(effort)}.`);
  if (!Array.isArray(extraConfig) || !extraConfig.every((setting) => typeof setting === 'string' && /^[^=\s][^=]*=/.test(setting))) {
    throw new Error(`Extra Codex configuration must be a list of \`key=value\` settings, got ${JSON.stringify(extraConfig)}.`);
  }
  const extra = extraConfig.flatMap((setting) => ['-c', setting]);
  return ['exec', 'review', '--json', ...leanFlags(platform, effort), ...extra, ...(prompt === 'own' ? [PROMPT_ON_STDIN] : ['--base', base])];
}

const isWindowsApps = (dir) => /\\microsoft\\windowsapps$/i.test(dir.trim().replace(/^"|"$/g, '').replace(/\//g, '\\').replace(/\\+$/, ''));

/** The environment Codex runs in. On Windows the PATH loses every `...\Microsoft\WindowsApps` entry:
 * Codex finds the Store PowerShell 7 there (an app-exec alias), the unelevated sandbox cannot start it
 * (`CreateProcessAsUserW failed: 5`), and every shell command of the review then fails; without it
 * Codex falls back to `powershell.exe` 5.1, which works. Elsewhere the environment is untouched. */
export function childEnv(env, platform) {
  if (platform !== 'win32') return env;
  const out = { ...env };
  for (const key of Object.keys(out)) {
    if (/^path$/i.test(key) && typeof out[key] === 'string') out[key] = out[key].split(';').filter((dir) => !isWindowsApps(dir)).join(';');
  }
  return out;
}

/** The environment of the lean session: `env` (already a child's, see `childEnv`) with `CODEX_HOME` set
 * to the run's own `home`. On Windows names are case-insensitive, so one spelled in another case is
 * dropped instead of left beside it. */
function leanEnv(env, home, platform) {
  const out = { ...env };
  for (const key of Object.keys(out)) {
    if (platform === 'win32' && /^codex_home$/i.test(key)) delete out[key];
  }
  out.CODEX_HOME = home;
  return out;
}

// How an argument is quoted for `cmd.exe`, and the line the arguments make: none of Codex's arguments holds what
// `quoteWindowsArg` refuses. Exported from here as before, for this command's tests.
export { quoteWindowsArg, windowsCommandLine };

/** One line of a diff or of a command's output, comparable across shells: PowerShell 5.1 re-encodes
 * non-ASCII text, so only printable ASCII is kept (which also drops `\r` and tabs), and trailing
 * space goes. */
const normalizeLine = (line) => line.replace(/[^\x20-\x7e]/g, '').trimEnd();

// Complete ANSI CSI sequences (`--color=always`, `color.ui=always`), then any ESC left over.
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/** The file a `diff --git` header names, its new side: `a/X b/Y` gives Y, `--no-prefix` `X Y` gives Y.
 * A path with spaces cannot be split at a space, so when both halves name the same path the header
 * is cut at its midpoint, and otherwise (a rename) at the last ` b/`. */
function headerFile(rest) {
  const mid = (rest.length - 1) / 2;
  if (Number.isInteger(mid) && rest[mid] === ' ') {
    const [left, right] = [rest.slice(0, mid), rest.slice(mid + 1)];
    if (left === right) return right;
    if (left.startsWith('a/') && right.startsWith('b/') && left.slice(2) === right.slice(2)) return right.slice(2);
  }
  const at = rest.lastIndexOf(' b/');
  return at !== -1 ? rest.slice(at + 3) : rest.slice(rest.lastIndexOf(' ') + 1);
}

/** The changes of a unified diff (or of a command's output that holds one) as keys `<file>\n<line>`,
 * deduplicated, in order: the `+`/`-` lines inside the hunks of each `diff --git` file, so the same
 * change in two files is two keys, file headers are not mistaken for changes (nor an added line that
 * starts with `++`), and lines outside a `diff --git` and `@@` context (a file's own text) yield
 * nothing. Colors are stripped first and both file and line are normalized. A line that is just `+`
 * or `-` (a blank line added or removed) is dropped: it carries no evidence. Our own diff and each
 * command's output go through this same parser, so they compare. */
export function patchKeys(text) {
  const keys = new Set();
  let file = null;
  let inHunk = false;
  const plain = typeof text === 'string' ? text.replace(ANSI, '').replace(/\x1b/g, '') : '';
  for (const raw of plain.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('diff --git ')) {
      file = normalizeLine(headerFile(line.slice('diff --git '.length)));
      inHunk = false;
    } else if (line.startsWith('@@')) inHunk = file !== null;
    else if (inHunk && (line.startsWith('+') || line.startsWith('-'))) {
      const normalized = normalizeLine(line);
      if (normalized !== '+' && normalized !== '-') keys.add(`${file}\n${normalized}`);
    }
  }
  return [...keys];
}

/** The JSON objects among the lines of Codex's `--json` output; anything else is ignored. */
export function parseEvents(text) {
  const events = [];
  for (const line of typeof text === 'string' ? text.split('\n') : []) {
    try {
      const event = JSON.parse(line);
      if (event && typeof event === 'object' && !Array.isArray(event)) events.push(event);
    } catch {
      // Not an event: a banner, a blank line or a truncated tail.
    }
  }
  return events;
}

/** What the event stream proves. `inspected` is the evidence rule: the turn completed and did not
 * fail, it ended with a message, and every one of `expectedKeys` (see `patchKeys`) is among the keys
 * of the output of a command that exited 0: the union over the commands, since Codex may read the
 * diff in pieces, and never a failed command's, which may have printed the patch before failing.
 * Exact coverage is the bar; every changed line of a real run was found. With no expected keys (a
 * range of binary files or blank lines only) there is nothing to match, so one successful command
 * stands in. Without `expectedKeys` nothing is inspected. `coverage` is how many were seen, and
 * `missing` up to five that were not, as `file: line`. `missingFiles` is every file with a changed line
 * that was not seen, in the order of the diff, each `{ file, missing, total }`: its path as the diff names
 * it, from the root of the repository, how many of its changed lines were not seen, and how many it has.
 * `errors` are the failed turn's messages; `warnings` are error items Codex raises without failing (an
 * unrecognized configuration setting, for one). */
export function reviewEvidence(events, expectedKeys = null) {
  let turnCompleted = false;
  let turnFailed = false;
  let review = '';
  const commands = [];
  const errors = [];
  const warnings = [];
  const shown = new Set();
  let succeeded = false;
  for (const event of events) {
    const item = event.item;
    if (event.type === 'turn.completed') turnCompleted = true;
    else if (event.type === 'turn.failed' || event.type === 'error') {
      if (event.type === 'turn.failed') turnFailed = true;
      const message = event.error?.message ?? event.message ?? (typeof event.error === 'string' ? event.error : undefined);
      if (message) errors.push(String(message));
    } else if (event.type === 'item.completed' && item) {
      if (item.type === 'agent_message' && typeof item.text === 'string') review = item.text.trim();
      else if (item.type === 'command_execution') {
        commands.push({ command: String(item.command ?? ''), exitCode: item.exit_code });
        if (item.exit_code === 0) {
          succeeded = true;
          for (const shownKey of patchKeys(String(item.aggregated_output ?? ''))) shown.add(shownKey);
        }
      } else if (item.type === 'error' && item.message) warnings.push(String(item.message));
    }
  }
  const completed = turnCompleted && !turnFailed;
  const expected = Array.isArray(expectedKeys) ? expectedKeys : [];
  const missingAll = expected.filter((expectedKey) => !shown.has(expectedKey));
  const coverage = { seen: expected.length - missingAll.length, total: expected.length };
  const covered = Array.isArray(expectedKeys) && (expected.length === 0 ? succeeded : missingAll.length === 0);
  const missing = missingAll.slice(0, 5).map((missingKey) => missingKey.replace('\n', ': '));
  // A key is `<file>\n<line>` (see `patchKeys`), and a `Map` keeps the files in the order they were first seen.
  const perFile = (keys) => {
    const counts = new Map();
    for (const fileKey of keys) {
      const file = fileKey.slice(0, fileKey.indexOf('\n'));
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
    return counts;
  };
  const totals = perFile(expected);
  const missingFiles = [...perFile(missingAll)].map(([file, count]) => ({ file, missing: count, total: totals.get(file) }));
  return { inspected: completed && review !== '' && covered, completed, review, commands, errors, warnings, coverage, missing, missingFiles };
}

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** One command as one line, `  exit N  <command>`, cut to 100 characters. */
function commandLine(command, exitCode) {
  return `  exit ${exitCode ?? '?'}  ${truncate(command.replace(/\s+/g, ' ').trim(), 100)}`;
}

const PROBE_TIMEOUT_MS = 15000;

/** Runs `codex <argv>` through `spawnFn` (sync or async, same signature). `codex` is a `.cmd` shim on
 * Windows, which only a shell can start. */
function launchCodex(spawnFn, platform, argv, options) {
  return platform === 'win32'
    ? spawnFn(windowsCommandLine('codex', argv), [], { ...options, shell: true })
    : spawnFn('codex', argv, options);
}

// A version as `codex --version` prints it after the name: `0.160.0`, or `0.161.0-alpha.2`.
const CLI_VERSION = /\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?/;

/** The version `codex --version` answers with (`0.160.0`), through the launch path and environment
 * of the review, or `null` when it does not answer with one: a missing CLI is told apart here, so a
 * bad `-c`, a broken config or a failed login is never reported as one. */
function codexVersion(spawn, platform, env) {
  try {
    const result = launchCodex(spawn, platform, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      env,
    });
    if (!result || result.error || result.status !== 0) return null;
    return CLI_VERSION.exec(result.stdout ?? '')?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Runs the review as an async child and resolves, like `spawnSync`, with `{ status, signal, stdout,
 * error }`. Unlike `spawnSync` it cannot be held by a grandchild that keeps the pipe open: on the
 * timer or an overflow past `maxBuffer` it kills the tree and resolves at once, without waiting for
 * the child to close. `onLine` gets each complete stdout line as it arrives. `input`, when given, is
 * written to the child's stdin, which is then closed: the review prompt, for a Codex told to read it there.
 *
 * On Windows the child is the `cmd.exe` shim, and killing only it leaves Codex running with the stdout pipe
 * open, so the whole tree goes: found by `bin/lib/process-tree.mjs` from when the child was spawned, never by
 * parent pid alone (`kill(child, { startedAt })`). Elsewhere the child leads its own process group. */
function runReview(spawnAsync, kill, platform, argv, options, { timeoutMs, maxBuffer, onLine, signals, input }) {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let pending = '';
    let bytes = 0;
    let timer;
    let child;
    const startedAt = Date.now(); // before the spawn: the child cannot have been created earlier
    // Off Windows the child is detached, so Ctrl-C no longer reaches it: kill the tree ourselves
    // before exiting, or Codex keeps running with nobody reading its output.
    const interrupted = () => stop(Object.assign(new Error('codex interrupted'), { code: 'EINTR' }));
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signals.removeListener('SIGINT', interrupted);
      signals.removeListener('SIGTERM', interrupted);
      if (pending) onLine(pending);
      resolve({ status: null, signal: null, ...result, stdout });
    };
    const stop = (error) => {
      let killFailure;
      try {
        kill(child, { startedAt });
      } catch (killError) {
        // The run is reported as stopped either way, and says that the tree may still be running.
        killFailure = killError.message;
      }
      // A descendant the kill missed could still hold the pipe; releasing it and the child lets this
      // process exit anyway.
      child?.stdout?.destroy?.();
      child?.unref?.();
      finish({ signal: 'SIGKILL', error, ...(killFailure && { killFailure }) });
    };
    try {
      child = launchCodex(spawnAsync, platform, argv, { ...options, detached: platform !== 'win32' });
    } catch (error) {
      finish({ error });
      return;
    }
    timer = setTimeout(() => stop(Object.assign(new Error('codex ETIMEDOUT'), { code: 'ETIMEDOUT' })), timeoutMs);
    signals.once('SIGINT', interrupted);
    signals.once('SIGTERM', interrupted);
    child.stdout?.setEncoding?.('utf8');
    child.stdout?.on('data', (chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBuffer) {
        stop(Object.assign(new Error('codex ENOBUFS'), { code: 'ENOBUFS' }));
        return;
      }
      stdout += chunk;
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) onLine(line);
    });
    child.on('error', (error) => finish({ error }));
    child.on('close', (status, signal) => finish({ status, signal }));
    if (input !== undefined) {
      if (!child.stdin) {
        // Codex was told to read its prompt from stdin and would wait there until the timeout.
        stop(Object.assign(new Error('Codex was started with no stdin to read the review prompt from'), { code: 'ENOSTDIN' }));
        return;
      }
      // A child that ends before it has read the prompt closes the pipe under the write: how it ended is
      // what gets reported, by `close`, so the write's own error is dropped instead of thrown.
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
  });
}

// Reviews seen so far took 1 to 15 minutes; a run past this has stalled (a hung sandboxed command,
// a network stall), and without a bound the command would wait forever.
const REVIEW_TIMEOUT_MS = 30 * 60 * 1000;

// What a review that did not stand ends with. A review that failed is run again, in a turn of the gate
// lock; the explicit skip is for a machine where Codex cannot run (`NO_CODEX`, `SKIP_IS_THE_WAY_OUT`). The
// command does not tell a spent usage limit from another failure, so every failed review is sent to the rerun.
const WAYS_ON =
  'Rerun the review in a turn of the gate lock: `js-harness gate -- js-harness codex-review --base <rev>`. ' +
  'A review that failed is run again, not skipped: `--unavailable <reason>` is for a machine where Codex cannot run.';

// What a refusal to make the session's home ends with. The home needs two things: a login in `auth.json`,
// to link, and the harness's state dir on the volume of the Codex home, since a hard link cannot cross
// volumes. On a machine without one of them no review can run, and there is no other session to send a
// person to: until 2026-10-08 this sentence named `--session current`, which needed no home and whose
// model nobody could check. So the way out is the one the command has for a review that could not be
// made, the explicit skip, in the words it uses for it elsewhere (`NO_CODEX`), whatever the reason the
// home could not be made and whatever flags the refused command carried.
const SKIP_IS_THE_WAY_OUT =
  'The way out, on a machine where the lean session cannot run: record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

const NO_CODEX =
  'Could not run `codex`. Install it with `npm i -g @openai/codex` and log in with `codex login`, ' +
  'or record an explicit skip with `--unavailable <reason>`; nothing was recorded.';

/** Prints each command as it completes, so a long review shows progress. */
function progressLine(line, log) {
  try {
    const event = JSON.parse(line);
    if (event?.type === 'item.completed' && event.item?.type === 'command_execution') log(commandLine(String(event.item.command ?? ''), event.item.exit_code));
  } catch {
    // Not an event.
  }
}

const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A count for a person: grouped by thousands, and `unknown` for one Codex did not report. */
const spoken = (count) => (count === null ? 'unknown' : thousands(count));

/** A reading of the monotonic clock, or `NaN` when the source throws: the clock is injected, and it may
 * not change how an attempt ends. */
function readClock(monotonicNow) {
  try {
    return monotonicNow();
  } catch {
    return Number.NaN;
  }
}

/** The whole milliseconds between two readings of the monotonic clock, never below zero. `null`, on
 * purpose, when either reading is not a finite number: a wall time that was not measured is said to be
 * unknown, instead of a `NaN` that only happens to be written as `null`. */
function elapsedMs(from, to) {
  return Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, Math.round(to - from)) : null;
}

/** Whether a reading of rollout files (`rolloutReading`) holds any count at all. */
const tokensKnown = (spent) => Object.values(spent.usage).some((count) => count !== null);

/** What an attempt spent and did, as one line: the tokens and the requests of `spent` (a
 * `rolloutReading`), the seconds (`unknown` when the wall time was not measured) and `items` by type, the
 * most frequent first. When no token is known the line says that, and why, instead of a row of zeros or
 * of `unknown`: the home of the run held no count to read. */
function spentLine(spent, items, durationMs) {
  const seconds = durationMs === null ? 'unknown' : Math.round(durationMs / 1000);
  const did = Object.entries(items)
    .sort(([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : 1))
    .map(([type, count]) => `${thousands(count)} ${type}`)
    .join(', ') || 'no items';
  if (!tokensKnown(spent)) return `Codex ran for ${seconds} s; its tokens are not known for this session (its Codex home held no token count): ${did}.`;
  const { inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens } = spent.usage;
  return (
    `Codex used ${spoken(inputTokens)} input tokens (${spoken(cachedInputTokens)} cached) and ${spoken(outputTokens)} output ` +
    `(${spoken(reasoningOutputTokens)} reasoning) in ${seconds} s over ${spoken(spent.requests)} request${spent.requests === 1 ? '' : 's'}: ${did}.`
  );
}

/** A text on one line: a title or an explanation the model wrapped must not break the line it is printed in. */
const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

/** One finding of a review's answer (`normalizeAnswer`) as a line: `file:start-end severity title`, with
 * `file:start` for a single line and `-` for a finding the model gave no priority. The body of the finding
 * is not repeated here: it is in the review as Codex rendered it, which is passed through above. */
function findingLine({ file, start, end, severity, title }) {
  return `${file}:${start === end ? start : `${start}-${end}`} ${severity ?? '-'} ${oneLine(title)}`;
}

/** The verdict of a review's answer as a line, with its explanation. */
function verdictLine({ verdict, explanation, confidence }) {
  const sure = confidence === null ? '' : ` (confidence ${confidence})`;
  return `Codex's verdict: the patch is ${verdict}${sure}. ${oneLine(explanation)}`.trimEnd();
}

/** Findings in the order a person reads a change in: by file, then by the line each starts at, then by the
 * one it ends at. The order of the code units, with no locale, so the same on every machine. */
const byPlace = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.start - b.start || a.end - b.end);

// What is said of an answer that was read from an attempt that does not stand, in place of its findings and
// its verdict: "the patch is correct" above an error would be read as the review it is not. The counts of
// that answer stay in the run line, which is a measurement and no review.
const NOT_STANDING = 'Codex answered, but this attempt does not stand, so what it answered is not shown as a review; the run log keeps its counts.';

/** A model and an effort as a person reads them, `gpt-6.1-sol at high effort`; one that is `null`, which a
 * rollout file may leave a session's, is said to be one the file does not name. */
const modelAt = (model, effort) => `${model ?? 'a model its rollout file does not name'} at ${effort === null ? 'an effort its rollout file does not name' : `${effort} effort`}`;

/** Why a session that ran with `ran` (a `rolloutReading`: its `model` and its `effort`, each `null` when its
 * rollout file names none) is not the review the command asked for, as a sentence for the run log and the
 * error; `null` when it is, as far as it was measured. `passed` is what the command passed, `{ model, effort }`.
 *
 * Each of the two is held to on its own, and only where it is known: a model or an effort the file does not
 * name is not measured, and here what was not measured is not held against a review. So a home with no
 * rollout file, or one whose files name neither, gives `null`: that its model has to be named at all is
 * another rule, asked after this one (`MODEL_NOT_NAMED`). */
function ranOnAnother(ran, passed) {
  const differs = (measured, named) => measured !== null && measured !== named;
  if (!differs(ran.model, passed.model) && !differs(ran.effort, passed.effort)) return null;
  return `its session ran on ${modelAt(ran.model, ran.effort)}, and the command passed ${modelAt(passed.model, passed.effort)}`;
}

/** Why a session whose rollout file names no model is not the review the command asked for, as a sentence
 * for the run log and the error; `model` is the one the command passed.
 *
 * A review runs on one model alone, and the rollout file is the one place that says which it ran on. A
 * session that names another is refused (`ranOnAnother`); one that names none was let stand, as not
 * measured, and three reviews ran on another model unnoticed while nothing was read at all
 * (odd/tasks/codex-review-cost.md). Every real lean session so far wrote the line, so a review that cannot
 * say what it ran on is refused like one that ran on something else (decided on 2026-10-08). The model
 * alone: an effort the file does not name is still not held against a review. */
const MODEL_NOT_NAMED = (model) => `its session's rollout file names no model, so nothing says that it ran on ${model}, the model the command passed`;

// How many files a message names before it counts the rest: a range has no bound of its own.
const FILES_SHOWN = 8;

/** `names` as a list for a message: the first `FILES_SHOWN`, then how many more there are. */
function listed(names) {
  const more = names.length > FILES_SHOWN ? `, and ${names.length - FILES_SHOWN} more` : '';
  return `${names.slice(0, FILES_SHOWN).join(', ')}${more}`;
}

/** `count` things, with `noun` in the singular for one: `1 file`, `2 files`. */
const counted = (count, noun) => `${thousands(count)} ${noun}${count === 1 ? '' : 's'}`;

/** The sum of what `pick` gives for each of `attempts`, or `null` when one of them is `null`: a total with
 * a part that was not measured is not known, and is never the sum of the rest. */
const totalOf = (attempts, pick) => attempts.reduce((total, attempt) => (total === null || pick(attempt) === null ? null : total + pick(attempt)), 0);

/** What a kept part spent, as an attempt's `spent` gives it, read off its run line: the four counts and the
 * requests the line holds, each `null` when it does not hold it. */
function spentOfKept(run) {
  const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
  const usage = run.usage ?? {};
  return {
    ...noRolloutReading(),
    usage: {
      inputTokens: count(usage.inputTokens),
      cachedInputTokens: count(usage.cachedInputTokens),
      outputTokens: count(usage.outputTokens),
      reasoningOutputTokens: count(usage.reasoningOutputTokens),
    },
    requests: count(run.requests),
  };
}

/** What the kept parts of a run had used when they ran, as the sentence that ends the totals of a run: their
 * input tokens, or that they are not known. `kept` are their results. */
function keptSentence(kept) {
  const input = totalOf(kept, (attempt) => attempt.spent.usage.inputTokens);
  const parts = kept.length === 1 ? 'kept part' : `${kept.length} kept parts`;
  if (input === null) return `What the ${parts} had used is not known.`;
  return `The ${parts} had used ${spoken(input)} input tokens when ${kept.length === 1 ? 'it' : 'they'} ran.`;
}

/** What the parts of a range spent together, as one line, once all of them passed: `attempts` are their
 * results, each with its `spent` (a `rolloutReading`) and its `durationMs`. When a part left no token
 * count the line says the tokens of the whole are not known, as `spentLine` does for one session. A part
 * kept from an earlier run (`kept`) spent nothing in this one: with one, the line says what this run's parts
 * spent, and what the kept parts had spent when they ran, apart. */
function totalsLine(attempts) {
  const kept = attempts.filter((attempt) => attempt.kept === true);
  const asked = attempts.filter((attempt) => attempt.kept !== true);
  if (asked.length === 0) return `All ${attempts.length} parts passed in earlier runs and are kept, so this run asked Codex nothing. ${keptSentence(kept)}`;
  const ms = totalOf(asked, (attempt) => attempt.durationMs);
  const seconds = ms === null ? 'unknown' : Math.round(ms / 1000);
  const [input, cached, output, reasoning] = ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningOutputTokens'].map((name) => totalOf(asked, (attempt) => attempt.spent.usage[name]));
  // With no kept part the line is the one it always was. With some, it names what this run's parts spent.
  const head = kept.length === 0 ? `All ${attempts.length} parts passed` : `All ${attempts.length} parts passed, ${kept.length} of them kept from ${kept.length === 1 ? 'an earlier run' : 'earlier runs'}`;
  const subject = kept.length === 0 ? 'Codex' : `this run's ${asked.length === 1 ? 'part' : `${asked.length} parts`}`;
  let line;
  if ([input, cached, output, reasoning].every((count) => count === null)) {
    line = kept.length === 0
      ? `${head}, in ${seconds} s; the tokens of the whole are not known, since the Codex home of a part held no token count.`
      : `${head}: ${subject} ran in ${seconds} s; the tokens of this run are not known, since the Codex home of a part held no token count.`;
  } else {
    const requests = totalOf(asked, (attempt) => attempt.spent.requests);
    line =
      `${head}: ${subject} used ${spoken(input)} input tokens (${spoken(cached)} cached) and ${spoken(output)} output ` +
      `(${spoken(reasoning)} reasoning) in ${seconds} s over ${spoken(requests)} request${requests === 1 ? '' : 's'}.`;
  }
  return kept.length === 0 ? line : `${line} ${keptSentence(kept)}`;
}

/** The files `from..head` changes (both full commit ids), as a review of the range takes them. The files it
 * reads are grouped (`reviewParts`): `groups`, each `{ files, changedLines }`, of at most `maxChangedLines`
 * changed lines and `PART_MAX_FILES` files, one group for a range within both bounds and none for a range
 * that changes no file a review reads. The files it leaves out, the documents and what the project marks
 * (`bin/lib/codex-review-scope.mjs`), are in no group: `leftOut` counts them, by why, and `paths` (every
 * file of the range, in git's order) with `why` (which of them are left out) are what tells their sections
 * of a patch apart (`patchOfRead`). What is marked is read from the commit `head`, the one the range is
 * reviewed up to, so a plan made over a tree that is being edited is the plan of the run.
 *
 * `{ error }`, a sentence, when git cannot say how large the range is or what the project marks: a file is
 * never left out, nor read, by guess. These are the two git commands a plan needs, so `--plan` runs this
 * and nothing else of a review. Renames are off, as in `planParts`.
 *
 * With `everyFile`, which only a caller of `codexReviewMain` can ask for, nothing is left out and git is
 * not asked what is marked: every file of the range is in a group, as it was before a review left any out.
 *
 * `where` is what the run knows of its repository (`codexReviewMain`), so that git is not asked once more
 * where the top is, nor about a file it has already answered for at `head`. */
function rangeGroups(spawn, root, { from, head, maxChangedLines, everyFile, where }) {
  const numstat = gitOutput(spawn, root, ['diff', '--numstat', '-z', '--no-renames', from, head], { maxBuffer: REVIEW_MAX_BUFFER });
  if (numstat === null) return { error: `Could not run \`git diff --numstat\` over ${from.slice(0, 7)}..${head.slice(0, 7)} to know how large the range is` };
  try {
    const files = numstatFiles(numstat);
    const paths = files.map((changed) => changed.path);
    const why = everyFile ? new Map() : leftOutOf(paths, { cwd: root, source: head, spawn, where });
    if (why === null) {
      return { error: `Could not ask git which files of the range the project leaves out of a review (\`git check-attr --source ${head.slice(0, 7)}\` failed; it needs git 2.40 or later)` };
    }
    const { read, leftOut } = reviewScope(files, why);
    return { groups: reviewParts(read, maxChangedLines), leftOut, paths, why };
  } catch (err) {
    return { error: `Could not read which files the range changes (${err.message})` };
  }
}

// A submodule that moved, written as the patch of a file: one `diff --git` section with the two commits as
// its lines, which is what git writes unless `diff.submodule` is configured. Under `log` or `diff` it
// writes a line of summary instead, and no section, while `--numstat` still counts the path as a file: a
// patch read by one section a file (`patchOfRead`) would be a section short, or take the summary for the
// end of the file before it.
const SUBMODULE_AS_A_FILE = '--submodule=short';

/** The parts the lean session reviews `from..head` in (both full commit ids), when the range changes more
 * lines than a part holds or more files (`PART_MAX_FILES`), from its `groups` (`rangeGroups`): `{ parts }`,
 * each `{ index, of, files, changedLines, prompt, expected }` with the prompt its session is asked with and
 * the keys of the changed lines it must have seen (`patchKeys`). `{ parts: null }` when the range is one
 * part, which is reviewed whole. `{ error }`, a sentence, when the range cannot be split in a way that is
 * known to show all of it; nothing is launched then. `intent` is what `--doc` gave, for the prompt of every
 * part.
 *
 * A range that leaves files out of its review (`paths` and `why`, from `rangeGroups`) is never reviewed
 * whole, since the review of a whole range reads every file of it: it has parts also when its files fit in
 * one, and that one part, 1 of 1, is asked and held to its files as any other. The files left out are in no
 * part, so the proof below is made against the patch of the range without their sections.
 *
 * Everything here is with renames off (`--no-renames`), in the count, in the command of each prompt and in
 * what each part must have seen: only then is the diff of some files the diff of each of them, whatever
 * the other files are, so that the parts add up to the range. A renamed file is then two files, the old
 * name removed whole and the new one added whole, and every line of both is to be shown.
 *
 * And the files of a part are named to git literally (`--literal-pathspecs`), in the command of its prompt
 * and in what it must have seen: a file name is a pathspec, and one that holds `*`, `?` or `[…]`, or starts
 * with `:`, would stand for other files than itself. The count and the check of the whole range name no file.
 *
 * Two diffs are made of the files of each part, alike unless the configuration of git says how a submodule
 * is shown (`diff.submodule`). What a part must have seen is its diff as its session's own git prints it,
 * under that configuration: under `log` or `diff` git writes one line of summary for a submodule that
 * moved, and a session cannot be held to lines its git never prints. The check that the parts add up to the
 * range is made on patches with `SUBMODULE_AS_A_FILE`, where the patch of a range is one section a file
 * whatever is configured, which is what tells the sections of the files left out apart. */
function planParts(spawn, root, { from, head, groups, intent, paths, why }) {
  const room = { maxBuffer: REVIEW_MAX_BUFFER };
  if (groups.length <= 1 && why.size === 0) return { parts: null };
  const parts = [];
  const inAPart = new Set();
  for (const [at, group] of groups.entries()) {
    const part = { index: at + 1, of: groups.length, files: group.files, changedLines: group.changedLines };
    const which = `part ${part.index} of ${part.of}`;
    let prompt;
    try {
      prompt = reviewPrompt({ from, head, intent, part, leftOut: why.size });
    } catch (err) {
      const needs = part.of === 1 ? 'The range leaves files out of its review, so it is asked by the files it reads' : `The range needs ${part.of} parts`;
      return { error: `${needs}, and the prompt of ${which} cannot be written. ${err.message}` };
    }
    // `--literal-pathspecs`, as in the command the prompt of the part names: a file name is a pathspec to
    // git, and one such as `app/[id]/page.tsx` or `*.md` is a pattern that takes in the files of other
    // parts. What a part must have seen is the diff of its own files and no more, or the part is held to
    // lines its prompt never asks for and its count of changed lines does not hold.
    const ofPart = (shape) => git(spawn, root, ['--literal-pathspecs', 'diff', '--no-color', '--no-ext-diff', ...shape, '--no-renames', from, head, '--', ...group.files], room);
    const shown = ofPart([]);
    const proved = shown === null ? null : ofPart([SUBMODULE_AS_A_FILE]);
    if (proved === null) return { error: `Could not run \`git diff\` over the files of ${which} to know what its review must see` };
    parts.push({ ...part, prompt, expected: patchKeys(shown) });
    for (const partKey of patchKeys(proved)) inAPart.add(partKey);
  }
  // The proof that the split leaves nothing out: every changed line of the range is one the files of a
  // part show. A path a pathspec reads as something else, or one cut on its way here, would be a file in
  // no part. The files a review leaves out are in no part on purpose, so their sections are taken out of
  // the patch of the range first, by their place in it and never by a name (`patchOfRead`).
  const whole = git(spawn, root, ['diff', '--no-color', '--no-ext-diff', SUBMODULE_AS_A_FILE, '--no-renames', from, head], room);
  if (whole === null) return { error: `Could not run \`git diff --no-renames ${from.slice(0, 7)} ${head.slice(0, 7)}\` to check the parts against the range` };
  let read;
  try {
    read = patchOfRead(whole, paths, why);
  } catch (err) {
    return { error: `Could not check the parts against the range. ${err.message}` };
  }
  const left = patchKeys(read).filter((rangeKey) => !inAPart.has(rangeKey));
  if (left.length > 0) {
    const first = `(the first: ${truncate(left[0].replace('\n', ': '), 100)})`;
    // One part is the files of a range that leaves the others out, which is not said to be in parts.
    if (parts.length === 1) {
      return { error: `The files the range would be reviewed by do not show ${thousands(left.length)} of the changed lines a review of the range reads ${first}, so their review would not be a review of the range` };
    }
    return { error: `The ${parts.length} parts the range would be reviewed in do not show ${thousands(left.length)} of the changed lines of the range between them ${first}, so their reviews would not be a review of the range` };
  }
  return { parts };
}

/** What the Codex review records leave of `from..head` for a run to do (both full commit ids, `from` the
 * commit the range starts at), by the definition `check --push` reads them with
 * (`bin/lib/codex-review-coverage.mjs`); `given` is the range as the run names it, for what is said.
 *
 *  - `{ covered }`: nothing. No code commit of the range is without a record, or it holds none. `covered`
 *    says which, how many they are and, since covered is not reviewed, how many of the records that cover
 *    them are a skip or a range with nothing to review. The run then starts nothing and records nothing:
 *    a second record of a range adds nothing the first did not say, and a second review of it is paid twice.
 *  - `{ start, said }`: the range from `start`, the commit before the oldest code commit no record covers,
 *    or `from` where starting later is not safe (`reviewStart`). `said` is the line that says the run
 *    starts later than it was asked to, and how many of the records it starts past are no review either;
 *    `null` when it does not start later.
 *
 * When the records cannot be read against the range, the range is taken as it was given, `from`, and `said`
 * says so and why: in doubt a run does what it was asked, never less. Nothing here throws.
 *
 * `where` is what the run knows of its repository (`codexReviewMain`), handed on to the reading of the
 * records. */
function leftByRecords(spawn, root, { from, head, given, where }) {
  const asGiven = (why) => ({ start: from, said: `Could not tell which commits of ${given} a Codex review record already covers (${why}), so the range is taken as it was given.` });
  let coverage;
  let start;
  try {
    coverage = reviewCoverage(root, { from, tip: head, spawn, where });
    if (coverage.unknown) return asGiven(coverage.unknown === MARKS_UNREAD ? 'git could not say which of their files a review leaves out' : 'git could not list them');
    ({ start } = reviewStart(coverage.uncovered, { cwd: root, from, tip: head, spawn }));
  } catch (err) {
    return asGiven(`reading them failed: ${err?.message ?? err}`);
  }
  const held = coverage.codeCommits.length;
  if (coverage.uncovered.length === 0) {
    const done = 'Nothing was started and nothing was recorded';
    if (held === 0) return { covered: `Nothing to review: ${given} holds no code commit, since none of its commits changes a file a review reads. ${done}.` };
    // Where every code commit has a record the push check lists the ones that are no review, so it is named.
    const notReviewed = notReviewedSaid(coverage, ': `js-harness check --push` lists them');
    return { covered: `Nothing to review: ${given} holds ${counted(held, 'code commit')}, and a Codex review record already covers ${held === 1 ? 'it' : 'all of them'}${notReviewed}. ${done}; \`--again\` takes the range as it was given.` };
  }
  if (start === from) return { start, said: null };
  const covered = held - coverage.uncovered.length;
  return {
    start,
    said:
      `${given} holds ${counted(held, 'code commit')}, and a Codex review record already covers ${covered === 0 ? 'none' : thousands(covered)} of them${notReviewedSaid(coverage)}: ` +
      `this run starts at ${start.slice(0, 7)}, the commit before the oldest one no record covers. \`--again\` takes the range as it was given.`,
  };
}

/** What a run says, in brackets after the count of code commits a record covers, of the records that do and
 * are no review of Codex's (`notReviews`): how many they are, then `more`. Nothing when there is none.
 *
 * Covered is not reviewed, and a run that leaves commits out for their record says so wherever it does: over
 * a range covered whole, and where it starts later. Said only of the first, a commit that an earlier skip
 * covers would be left out of every later run with nothing saying that no review ever read it. */
function notReviewedSaid(coverage, more = '') {
  const others = notReviews(coverage).length;
  return others === 0 ? '' : ` (${others} of the records that do ${others === 1 ? 'is' : 'are'} a skip or a range with nothing to review, not a review${more})`;
}

// How many errors of an answer off its schema are named in the reason; the rest are counted.
const ANSWER_ERRORS_SHOWN = 3;

/** Why the answer of a lean review could not be read as data (a `rolloutAnswer` that is not `ok`), as the
 * run log and the error say it. */
function answerFailure({ reason, errors = [] }) {
  if (reason === 'no-review-session') return 'its Codex home holds no session of the review sub-agent, so there is no answer to read';
  if (reason === 'no-answer') return 'the session of the review sub-agent holds no answer';
  if (reason === 'not-json') return 'the answer of the review is not JSON';
  const more = errors.length > ANSWER_ERRORS_SHOWN ? `; and ${errors.length - ANSWER_ERRORS_SHOWN} more` : '';
  return `the answer of the review is off its schema (${REVIEW_ANSWER_SCHEMA_VERSION}): ${errors.slice(0, ANSWER_ERRORS_SHOWN).join('; ')}${more}`;
}

/** Runs the command; returns the process exit code. `deps` (all optional) injects `spawn` (git and
 * the `codex --version` probe, sync), `spawnAsync` (the review), `killTree`, `timeoutMs`,
 * `maxBuffer`, `signals` (where SIGINT/SIGTERM arrive), `now` (the wall clock, for the dates),
 * `monotonicNow` (milliseconds on a clock that never steps, for the wall time of the review),
 * `randomUUID` (the id of the run line, which is also the name of its Codex home), `homedir` (the
 * OS home, which the harness's state dir and the real Codex home default to), `createLeanHome` (what
 * makes the session's home), `platform`, `log`, `error` and `write` (the review passed through
 * to the user)
 * so tests use fixtures; `env` is the parent environment Codex's is derived from. Exits 2 with usage
 * on a bad flag; 1 when nothing could be recorded or the review did not complete, and for a run of more
 * parts than it may start, which starts nothing; 0 for `--plan`, which prints the plan and starts nothing,
 * and for a run over a range that changes no file a review reads, which has nothing to review, starts
 * nothing, and records that when the range holds a commit.
 *
 * Four more `deps` are what the comparison of the configurations varies, and nothing on the command line
 * reaches them (see the top of this file):
 *  - `effort`: the effort the command passes, in place of `REVIEW_EFFORT`; the run line says it, and it is
 *    the effort the session is then held to (`ranOnAnother`).
 *  - `extraCodexConfig`: `key=value` settings added to the argv (`codexArgs`).
 *  - `everyFile`: `true` makes the review read every file of the range, the documents and what the project
 *    marks too (`rangeGroups`): nothing is left out, so a range of one part is reviewed whole, with Codex's
 *    own review under `--prompt codex` and the prompt of a range under `--prompt own`. The range is the one
 *    it was given, whatever the Codex review records cover (`startingAt`).
 *  - `onResult`: called with `{ run, logged, review }` for every attempt that launched Codex: its run line,
 *    whether the line reached the run log, and its answer as `normalizeAnswer` gives it (`null` when none
 *    was read). */
export async function codexReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { spawn = spawnSync, spawnAsync = spawnChild, now = () => new Date(), log = console.log, error = console.error, platform = process.platform } = deps;
  const { timeoutMs = REVIEW_TIMEOUT_MS, maxBuffer = REVIEW_MAX_BUFFER, signals = process, randomUUID = newUUID } = deps;
  const { monotonicNow = () => performance.now(), homedir = os.homedir, createLeanHome = makeLeanHome } = deps;
  const { effort = REVIEW_EFFORT, extraCodexConfig = [], onResult = null, everyFile = false } = deps;
  const kill = deps.killTree ?? ((child, lifetime) => killTree(child, lifetime, { platform }));
  const write = deps.write ?? ((text) => process.stdout.write(text));
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  // The intent the own prompt carries, read before anything runs: a document that cannot be read, or that
  // holds no Goal or no Done when, is a flag given wrong, and no review is started to find that out.
  let intent = null;
  if (args.doc !== undefined) {
    try {
      intent = reviewIntent(fs.readFileSync(path.resolve(args.cwd, args.doc), 'utf8'));
    } catch (err) {
      error(`--doc ${args.doc}: ${err instanceof IntentError ? err.message : `cannot read it (${err.code ?? err.message})`}\n\n${USAGE}`);
      return 2;
    }
  }

  const root = git(spawn, args.cwd, ['rev-parse', '--show-toplevel']);
  if (!root) {
    error(`${args.cwd} is not a git repository, so there is no range to record.`);
    return 1;
  }
  // Where the repository of this run is, for whatever would ask git that (`jsonLinesPath`, `leftOutOf`): a
  // review asked where the git folder is four times and where the top is twice, the same two answers each
  // time. The top is `root`, which git has just named, written as the answer of `git rev-parse --show-cdup`
  // asked there is: nothing more to go up. The git folder is asked for the first time something reads or
  // writes a file in it, so a run that ends before that never asks, and is kept from then on. An answer git
  // did not give is not kept: the next read or write asks again, as each did before. With them goes what
  // git says the project marks at `head` (`marks`, which `leftOutOf` fills): the files of the commits the
  // records are read against hold the files the review then reads, and were asked about twice. All of it is
  // this run's and ends with it, never the module's: the next run in this process may be of another
  // repository, or of this one with HEAD somewhere else.
  let commonGitDir = null;
  const where = {
    top: path.resolve(root),
    marks: new Map(),
    get commonGitDir() {
      commonGitDir ??= gitDirs(root, spawn).commonGitDir;
      return commonGitDir;
    },
  };
  // Where the range of this run starts: the commit `--base` names, until the records have been read. A run
  // that starts later than it was asked to (`startingAt`) has that later commit here from then on, so that
  // its plan, its sessions, its run lines and its record are all of the one range it reviews.
  let base = git(spawn, root, ['rev-parse', '--verify', `${args.base}^{commit}`]);
  if (!base) {
    error(`Cannot resolve --base ${args.base} to a commit in ${root}.`);
    return 1;
  }
  const head = git(spawn, root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head) {
    error(`Cannot resolve HEAD to a commit in ${root}.`);
    return 1;
  }

  /** The plan of the review of this range in `groups`, with what it leaves out, `leftOut` (`rangeGroups`),
   * on the model and at the effort the command passes, with its estimate from the run log of this
   * repository's machine. A log that cannot be read is one that measured nothing: the plan then says there
   * is no estimate, and a run goes on as it would. */
  const planOf = ({ groups, leftOut }) => {
    let runs = [];
    try {
      runs = readCodexReviewRuns(root, { spawn, where });
    } catch {
      // Nothing measured.
    }
    return reviewPlan({ base, head, model: REVIEW_MODEL, effort, parts: groups, runs, maxParts: args.maxParts, leftOut });
  };

  /** Where this run starts, once the Codex review records have been read against its range, `given..head`
   * (`given` the commit the range starts at as it was asked for): that commit, a later one, or `null` when
   * the records leave nothing of the range, which is then said, and is all the run does. A run that starts
   * later says so here, before its plan, and `base` is that commit from here on.
   *
   * Nothing twice (odd/tasks/codex-review-cost.md): a review of a whole branch held four reviews of ranges
   * reviewed an hour before, since a run reviewed from the base it was given whatever had a record. A plan,
   * a review and a skip all start here, so a plan is of the run it stands before.
   *
   * `--again` is the way to review on purpose what has a record: the range is then taken as it was given,
   * and the records are not read. Nor are they for a range that holds no commit, which has none a record
   * could cover and no part either. A caller that asks for `everyFile` measures the review of the range it
   * names, so its range is taken as it was given too. */
  const startingAt = (given) => {
    if (args.again || everyFile || given === head) return given;
    const left = leftByRecords(spawn, root, { from: given, head, given: `${base.slice(0, 7)}..${head.slice(0, 7)}`, where });
    if (left.covered !== undefined) {
      log(left.covered);
      return null;
    }
    if (left.said !== null) log(left.said);
    if (left.start !== given) base = left.start;
    return left.start;
  };

  // `--plan`: the plan, and nothing else. It needs the range and how its files group, which is git alone:
  // no Codex is looked for, no home is made or asked for, and nothing is logged or recorded. The tree may
  // hold uncommitted changes, which stop a review: a plan is of the committed range and claims nothing.
  // It never refuses a range for its size either, since saying the size is what it is for.
  if (args.plan) {
    const given = git(spawn, root, ['merge-base', base, head]);
    if (!given) {
      error(`${base.slice(0, 7)} and HEAD share no history, so there is no range to plan the review of.`);
      return 1;
    }
    const from = startingAt(given);
    if (from === null) return 0;
    const split = rangeGroups(spawn, root, { from, head, maxChangedLines: args.partLines, everyFile, where });
    if (split.error) {
      error(`${split.error}, so there is no plan of its review.`);
      return 1;
    }
    const plan = planOf(split);
    for (const line of planLines(plan)) log(line);
    const needs = needsFlagLine(plan);
    if (needs !== null) log(needs);
    return 0;
  }

  /** Appends the record of this range, `base..head` at this moment with `fields` after them (its `outcome`
   * and what goes with it), and returns the file it is in; or says why it could not be written and returns
   * `null`, for the caller to exit 1 on. */
  const writeRecord = (fields) => {
    try {
      return appendCodexReview(root, { schema: CODEX_REVIEW_SCHEMA, base, head, reviewedAt: now().toISOString(), ...fields }, { spawn, where });
    } catch (err) {
      error(`Could not write the record: ${err.message}`);
      return null;
    }
  };

  let outcome = 'unavailable';
  // The id of the run line of a reviewed attempt, for its record; a skip launches nothing and has none.
  let runId;
  // The parts a large range was reviewed in, and the ids of their run lines, one for each part (`null` for
  // a line that could not be written); `null` and none for a range reviewed whole, and for a skip.
  let parts = null;
  let runIds = [];
  // What the review of the range left out, for its record: the count `reviewScope` gives, `{ files,
  // changedLines, documents, marked }`, the last two the same two counts of each kind. `null` when it left
  // nothing out, and for a skip, which looked at no file. The kinds are kept apart because `check --push`
  // reads them: a document is left out at every commit, but a mark is that of the head of this range, so a
  // record that left a marked file out covers only what is pushed up to that head (`leftMarkedFilesOut`).
  let leftOut = null;
  if (args.unavailable === undefined) {
    // The record claims the committed range base..HEAD, so the review must see exactly that: a
    // dirty tracked tree would be reviewed and then recorded as if it were committed.
    const dirty = git(spawn, root, ['status', '--porcelain', '--untracked-files=no']);
    if (dirty === null) {
      error('Could not run `git status` to check for uncommitted changes, so the review was not started and nothing was recorded.');
      return 1;
    }
    if (dirty) {
      error(
        `Tracked files have uncommitted changes, but the record claims the committed range base..HEAD (${base.slice(0, 7)}..HEAD); ` +
          `commit or stash them first, then rerun.\n${dirty}`,
      );
      return 1;
    }
    // The branch's own changes start at the merge-base: a base that moved past the fork point (a
    // fetched main) would add its newer commits to a two-point diff, lines no review of the branch
    // prints. Codex reviews from the same commit, so both sides mean the same patch.
    const given = git(spawn, root, ['merge-base', base, head]);
    if (!given) {
      error(`${base.slice(0, 7)} and HEAD share no history, so there is no range to review; nothing was recorded.`);
      return 1;
    }
    // The review starts where the records end, and there is none to start over a range they cover whole.
    const from = startingAt(given);
    if (from === null) return 0;
    // The patch Codex has to have seen; the buffer holds a large diff, far above Node's 1 MiB default.
    const patch = git(spawn, root, ['diff', '--no-color', '--no-ext-diff', from, head], { maxBuffer: REVIEW_MAX_BUFFER });
    if (patch === null) {
      error(`Could not run \`git diff ${from.slice(0, 7)} HEAD\` to know what the review must see, so it was not started and nothing was recorded.`);
      return 1;
    }
    const expected = patchKeys(patch);
    // What the command passes to Codex (`modelFlags`): what the run line says was asked for, and what the
    // session is held to. The effort is the injected one when the comparison asked for another, so a cell
    // is held to the effort it was launched with, not to the constant.
    const wanted = { model: REVIEW_MODEL, effort };
    // How the files of the range group, its plan, and the parts a large range is reviewed in. All of it is
    // worked out before anything is probed, made or launched, so a range that cannot be split, or that is
    // more parts than a run starts, leaves nothing behind.
    const notSplit = (why) => {
      error(`${why}${why.endsWith('.') ? '' : '.'}\nThe review was not started and nothing was recorded.`);
      return 1;
    };
    const split = rangeGroups(spawn, root, { from, head, maxChangedLines: args.partLines, everyFile, where });
    if (split.error) return notSplit(split.error);
    // The plan, where the progress of the run is written and before its first session: what the run is
    // about to spend is on the screen before any of it is spent.
    const plan = planOf(split);
    for (const line of planLines(plan)) log(line);
    if (split.leftOut.files > 0) leftOut = split.leftOut;
    // A range that changes no file has no part, and a run with no part starts nothing: no Codex is looked
    // for, no home is made, and there is no session to log. The run says so and exits 0, having done all
    // there was to do. It used to start one session all the same, over an empty diff. A range whose files
    // are all left out of a review is the same case, and says which of the two it is.
    //
    // What it records depends on whether the range holds a commit. One that holds none (`--base HEAD`)
    // has nothing a record could cover, so nothing is recorded. One that does, a change and its revert
    // for one, is recorded as what it is, a range with nothing to review (`NOTHING_TO_REVIEW`), with why:
    // `check --push` asks for a record over every code commit, and without this one it would send a
    // person back to this command, which would again record nothing. It is not recorded as `reviewed`,
    // which would say Codex looked at it. The range holds a commit when HEAD is past the merge-base.
    if (plan.parts.length === 0) {
      const changes = leftOut === null ? 'changes no file' : 'changes no file a review reads';
      const nothing = `There was nothing to review: ${plan.range} ${changes}. Nothing was started`;
      if (from === head) {
        log(`${nothing} and nothing was recorded.`);
        return 0;
      }
      const reason = leftOut === null ? `the range ${changes}` : `the range ${changes}: it leaves out ${leftOutSaid(split.leftOut)}`;
      const file = writeRecord({ outcome: NOTHING_TO_REVIEW, reason, ...(leftOut === null ? {} : { leftOut }) });
      if (file === null) return 1;
      log(`${nothing}, and the range was recorded as having nothing to review in ${file}.`);
      return 0;
    }
    // A bound of parts. A run over it is one nobody chose the size of: it is not started until it names
    // its count, and the refusal says the count, so that going on is a decision made with the plan above
    // it. The bound is the count the run named when it named one, larger or smaller than the default.
    if (plan.over) {
      error(
        `The review of ${plan.range} was not started and nothing was recorded: its ${plan.parts.length} parts are more than ${partsBound(plan)}.\n` +
          `To run it all the same, pass \`--max-parts ${plan.parts.length}\`. The cheaper way is to review each slice when it closes, from the commit before it (\`--base\`).`,
      );
      return 1;
    }
    // `null` for a range that is one part and leaves no file out.
    const made = planParts(spawn, root, { from, head, groups: split.groups, intent, paths: split.paths, why: split.why });
    if (made.error) return notSplit(made.error);
    ({ parts } = made);
    // The environment of the `--version` probe, and what the session's is made from: the session adds a
    // `CODEX_HOME` of its own below. The probe only asks for the version, which no home changes, so it
    // runs before that home is made.
    const codexEnv = childEnv(env, platform);
    const cli = codexVersion(spawn, platform, codexEnv);
    if (!cli) {
      error(NO_CODEX);
      return 1;
    }
    // This command's own prompt, for the range the record will claim: from the merge-base to the commit
    // HEAD is now, both by id, so what the model is told to diff cannot move under it. `undefined` under
    // the default prompt, where Codex writes its sentence from `--base`. Built before anything is made
    // or launched, so a range that cannot be named leaves nothing behind. A range in parts has the
    // prompts of its parts instead (`planParts`).
    const own = args.prompt === 'own';
    let promptText;
    if (own && parts === null) {
      try {
        promptText = reviewPrompt({ from, head, intent });
      } catch (err) {
        error(`Could not write the review prompt (${err.message}), so the review was not started and nothing was recorded.`);
        return 1;
      }
    }
    const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
    /** One attempt: one Codex session, over the whole range or over one `part` of it (see `planParts`),
     * from the making of its lean home to its line in the run log. `expectedKeys` are the changed lines
     * its commands must have shown (`patchKeys`), `prompt` what it is asked with (`codex` or `own`),
     * `promptText` the text of the own prompt and `promptVersion` the version of that text.
     *
     * A part that is 1 of 1 is the one session of a range that leaves files out: it is asked and held to
     * its files as a part is, and what it answered is shown as that of a whole range is, since no other
     * part is waited for.
     *
     * Resolves with `{ exit }`, the exit code of the command when the attempt does not stand, whatever
     * the reason; or, when it stands, `{ exit: 0, runId, review, rendered, spent, durationMs }`: the id of
     * its run line (`undefined` when the line could not be written), its answer as data, the review as
     * Codex rendered it, what it spent and how long it took. It prints what a
     * single review prints, but for what a part answered: the review Codex rendered, the findings and the
     * verdict of a part wait for the other parts, and are shown by the caller or not at all.
     *
     * `keptRuns`, the run log when a range in parts may take a part from it, is what a part that passed in
     * an earlier run is taken from instead of launching Codex: then the result has `kept: true` and no run
     * line is written for it. */
    const attempt = async ({ expectedKeys, prompt, promptText: asked, promptVersion, part = null, keptRuns = null }) => {
      const ownPrompt = prompt === 'own';
      // Whether this is the only session of its run, whose answer waits for no other.
      const alone = part === null || part.of === 1;
      // What Codex is launched with, worked out before anything is made: an injected effort or setting that
      // cannot go on a command line is the caller's mistake, and leaves no home behind.
      const codexArgv = codexArgs(from, platform, prompt, { effort, extraConfig: extraCodexConfig });
      // The key of what this part's session is sent. A part whose key is in the run log passed in an earlier
      // run that sent the very same thing, and is taken from there: nothing is launched and no line is written.
      // Only a part of a range reviewed in parts has one: the one session of a range that leaves files out, or
      // of a range within the bound, keeps nothing, so its line has the fields a whole range's line has.
      const key = alone ? null : partKey({ base, from, head, prompt: asked, argv: codexArgv });
      const keptLine = keptRuns === null || key === null ? null : keptPartFor(keptRuns, key);
      if (keptLine !== null) {
        const kept = runKept(keptLine);
        const when = typeof keptLine.startedAt === 'string' && keptLine.startedAt !== '' ? keptLine.startedAt : 'an earlier day';
        log(`Part ${part.index} of ${part.of} of ${range} passed in the run of ${when} and is kept: it is not asked again.`);
        return {
          exit: 0,
          runId: typeof keptLine.id === 'string' && keptLine.id !== '' ? keptLine.id : undefined,
          review: kept.review,
          rendered: kept.rendered,
          spent: spentOfKept(keptLine),
          durationMs: Number.isFinite(keptLine.durationMs) ? keptLine.durationMs : null,
          kept: true,
        };
      }
      // The session's own Codex home, named after the run: the id is made here, before the launch, and the
      // run line reuses it. Until the home exists nothing is launched, so a failure here writes no run line
      // and no record.
      let leanHome;
      let leanRunId;
      try {
        leanRunId = randomUUID();
      } catch (err) {
        error(`Could not make the id of this run, which names the lean session's Codex home (${err.message}), so the review was not started and nothing was recorded.`);
        return { exit: 1 };
      }
      try {
        // `||`, not `??`: an empty `--home` or `JS_HARNESS_HOME` is unset, and the next source is asked.
        // Resolved as it is, an empty path is the working directory, and the lean home, with its link to
        // the login, would be made there.
        const homes = leanHomesDir(path.resolve(args.home || env.JS_HARNESS_HOME || homedir()));
        // What a killed run left, or a kept one. Twice the timeout: no review that is still running is
        // that old. Once a run, before its first session: the parts of a range may together take longer
        // than that, and a later part must not remove the home `--keep-home` kept for an earlier one.
        if (part === null || part.index === 1) sweepStaleLeanHomes(homes, { olderThanMs: 2 * timeoutMs, now: now().getTime() });
        leanHome = createLeanHome({ realHome: realCodexHome(env, homedir(), platform), parent: homes, id: leanRunId });
      } catch (err) {
        error(`${err.message}\nThe lean review was not started and nothing was recorded.\n${SKIP_IS_THE_WAY_OUT}`);
        return { exit: 1 };
      }
      // From here on Codex is launched, so every way out leaves one line in the run log. `startedAt` is
      // the date on the wall clock; how long the review took is read off the monotonic one, because the
      // wall clock can be stepped while Codex runs (a time sync, a manual change).
      let startedAt;
      let launchedAt;
      let endedAt;
      let result;
      // What the session spent. Not what Codex's own events say: `exec review --json` reports a `usage` of
      // zeros in `turn.completed` by construction, since the review runs in a sub-agent whose token counts
      // are dropped before they reach the parent thread (`core/src/codex_delegate.rs:311-319` at
      // rust-v0.160.0). The counts are in the rollout files of the session's home, read below; until they
      // are read nothing is known of what it spent, and that is `null`, not zero.
      let spent = noRolloutReading();
      // What the review answered, as `rolloutAnswer` gives it, from the same rollout files.
      let answered = null;
      try {
        // The session, and the model and the effort it is handed: said before every launch, so that what
        // a review runs on is never something to look up afterwards.
        const how = ` with the lean session (${REVIEW_MODEL}, ${effort})${ownPrompt ? ' and this command\'s own prompt' : ''}`;
        const what = part === null ? range
          : part.of === 1 ? `${counted(part.files.length, 'file')} of ${range} (${counted(part.changedLines, 'changed line')})`
            : `part ${part.index} of ${part.of} of ${range} (${counted(part.files.length, 'file')}, ${counted(part.changedLines, 'changed line')})`;
        log(`Codex is reviewing ${what}${how}; this can take several minutes.`);
        startedAt = now();
        launchedAt = readClock(monotonicNow);
        // stdin is ignored under the default prompt (Codex would wait to read it) and carries the prompt
        // under the own one; stdout carries the JSONL, stderr (the progress) stays live.
        result = await runReview(spawnAsync, kill, platform, codexArgv, {
          cwd: root,
          stdio: [ownPrompt ? 'pipe' : 'ignore', 'pipe', 'inherit'],
          // The home of the run, and nothing else added or taken away.
          env: leanEnv(codexEnv, leanHome.home, platform),
        }, { timeoutMs, maxBuffer, onLine: (line) => progressLine(line, log), signals, input: asked });
        endedAt = readClock(monotonicNow);
      } finally {
        // The lean home goes on every way out, whatever the review came to: Codex has ended or was
        // killed. Its rollout files are read first, since they go with it: what the session spent, and what
        // the review answered. What could not be cleaned is a warning and never changes how the attempt ends.
        spent = rolloutReading(leanHome.home);
        answered = rolloutAnswer(leanHome.home);
        const left = leanHome.dispose({ keep: args.keepHome });
        if (left) error(`Warning: the lean Codex home of this run was not left clean: ${left}.`);
        // The path comes last, so that it can be copied whole. Kept is not for ever: the folder is still
        // where the sweep of a later lean review looks, and that removes it like one a killed run left.
        if (args.keepHome) {
          log(
            `The lean Codex home of this run was kept${left ? '' : ', without the login'}, for its rollout files under \`sessions\` (what the session sent and spent); ` +
              `the next lean review removes it once it is ${Math.ceil((2 * timeoutMs) / 60000)} minutes old, and it can be deleted by hand at any time: ${leanHome.home}`,
          );
        }
      }
      const durationMs = elapsedMs(launchedAt, endedAt);
      const events = parseEvents(result.stdout);
      const evidence = reviewEvidence(events, expectedKeys);
      // The turns, the items and the commands of the session. Its `usage` is left out on purpose: see `spent`.
      const reading = sessionReading(events);
      // The answer as this command keeps it, when there is one that is valid. It is kept
      // in the run line whatever the attempt comes to, as what it spent is: a measurement.
      const review = answered?.ok ? normalizeAnswer(answered.answer, { root, platform }) : null;
      /** Appends this attempt's line to the run log and returns its id, or `undefined` when the line
       * could not be built or written: the measurement is lost and said so, and the attempt ends as it
       * would. Building the line is inside the `try` for that reason: its id and its date come from
       * injected sources, and neither may change how a review ends. */
      const logRun = (runOutcome, reason) => {
        let run;
        let logged = false;
        try {
          run = {
            schema: CODEX_REVIEW_RUN_SCHEMA,
            // The id made before the launch, which named the home of the run.
            id: leanRunId,
            startedAt: startedAt.toISOString(),
            durationMs,
            base,
            from,
            head,
            // Which part of that range the line measured. The line of a review of the whole range has no
            // such field, as no line had before a range was reviewed in parts (`runPart`). That of a range
            // reviewed by its files in one session has it, 1 of 1, with the files and the lines it covered.
            ...(part === null ? {} : { part: { index: part.index, of: part.of, files: part.files.length, changedLines: part.changedLines } }),
            outcome: runOutcome,
            ...(reason === undefined ? {} : { reason }),
            cli,
            session: SESSION,
            // What the command passed. (A line of the removed `current` session written before 2026-10-08
            // has `null` in both, since the user's Codex config set them then.) What the session really
            // ran with is `sessionModel` and `sessionEffort`, below.
            model: wanted.model,
            effort: wanted.effort,
            // What the review was asked with, and the version of the text when it is this command's own.
            prompt,
            promptVersion,
            // The four counts, each `null` when it is not known, and where they were read from: `rollout`,
            // or `null` when none was. A line written before `usageSource` existed took its `usage` from
            // Codex's events (`bin/lib/codex-review-runs.mjs`).
            usage: spent.usage,
            usageSource: tokensKnown(spent) ? 'rollout' : null,
            requests: spent.requests,
            firstRequestInputTokens: spent.firstRequestInputTokens,
            threads: spent.threads,
            // The model and the effort the session itself wrote in its rollout file: what ran, where `model`
            // and `effort` above are what this command passed. Each `null` when it is not known: a home
            // that held no such line.
            sessionModel: spent.model,
            sessionEffort: spent.effort,
            turns: reading.turns,
            items: reading.items,
            commands: reading.commands,
            coverage: evidence.coverage,
            // What the review answered, read as data: how many findings, by severity, and the verdict, with
            // where they were read from. All `null` when no answer could be read as one, which is never
            // the same as a review that found nothing: that one counts 0.
            findings: review ? findingCounts(review.findings) : null,
            verdict: review ? review.verdict : null,
            answerSource: review ? 'rollout' : null,
            // A part that passed keeps what it answered, and the key of what its session was sent, so that a later
            // run of the same range does not ask it again (`runKept`, `keptPartFor`). No other line keeps one.
            ...(runOutcome === 'reviewed' && key !== null && review !== null ? { kept: { key, review, rendered: evidence.review } } : {}),
          };
          appendCodexReviewRun(root, run, { spawn, where });
          logged = true;
        } catch (err) {
          error(`Could not write the run log, so what this attempt measured was not kept: ${err.message}`);
        }
        // The caller that asked for it gets the line, logged or not, with the answer as data: a comparison
        // keeps what the review found, which no line printed here holds whole. A line that could not even be
        // built is not handed over. What the callback throws is its own, and never how a review ends.
        if (onResult !== null && run !== undefined) {
          try {
            onResult({ run, logged, review });
          } catch (err) {
            error(`Warning: the result of this attempt could not be handed to the caller: ${err?.message ?? err}`);
          }
        }
        return logged ? run.id : undefined;
      };
      const completed = result.status === 0 && evidence.completed;
      // Whether the session ran on another model or at another effort than the command passed, as its own
      // rollout file says, and then the sentence that says so (`ranOnAnother`). Asked of every attempt: each
      // ran in a home of its own, which was read.
      const another = ranOnAnother(spent, wanted);
      // Whether its rollout file says which model it ran on at all: one that does not is no review of the
      // one model either (`MODEL_NOT_NAMED`).
      const named = spent.model !== null;
      // Whether the attempt stands: Codex completed, on the model it was asked for, which its rollout file
      // names, and at the effort it was asked for as far as that was measured, its answer could be read
      // when one is read, and its commands showed every changed line. Known before anything of the answer
      // is printed, because the findings and the verdict of an attempt that does not stand are not a
      // review, and are not shown as one.
      const stands = completed && another === null && named && !(answered && !answered.ok) && evidence.inspected;
      for (const warning of evidence.warnings) error(`Codex warning: ${warning}`);
      // The review as Codex rendered it, passed through here for a range reviewed whole, as it always was.
      // That of a part is not: it holds the findings of the part, in Codex's words, and shown now it would
      // stand on the screen as a review of files whose range a later part may still leave unreviewed. It is
      // handed back instead (`rendered`), and shown with the others once every part has passed. Nor is that
      // of a session that ran on another model, or that names none, however it ended: the other attempts
      // that do not stand show what the model that was asked for rendered, and this would be the review of
      // one that was not, or of one nobody can name.
      if (evidence.review && alone && another === null && named) write(`${evidence.review}\n`);
      if (review && !stands) {
        log(NOT_STANDING);
      } else if (review && alone) {
        // The answer of a part is not printed here: it waits for the other parts, and the findings of a
        // range are printed together once every part has passed.
        for (const line of [...review.findings.map(findingLine), verdictLine(review)]) log(line);
      }
      log(spentLine(spent, reading.items, durationMs));
      if (!completed) {
        const reason = result.error?.code === 'ENOBUFS'
          ? `its output exceeded ${REVIEW_MAX_BUFFER / (1024 * 1024)} MiB`
          : result.error?.code === 'ETIMEDOUT' ? `it ran past ${REVIEW_TIMEOUT_MS / 60000} minutes and was stopped`
          : result.error?.code === 'EINTR' ? 'it was interrupted and stopped'
          : result.error ? `could not start it: ${result.error.message}`
            : result.status !== 0 ? `it exited ${result.status ?? `on ${result.signal ?? 'a signal'}`}`
              : evidence.errors.length ? 'the turn failed' : 'the turn never completed';
        const said = evidence.errors.map((message) => `\n  Codex said: ${message}`).join('');
        const left = result.killFailure ? `\n  The process tree could not be killed (${result.killFailure}): Codex may still be running.` : '';
        logRun(result.error?.code === 'ETIMEDOUT' ? 'timed-out' : result.error?.code === 'EINTR' ? 'interrupted' : 'failed', reason);
        error(`The Codex review did not complete (${reason}); no record was written.${said}${left}\n${WAYS_ON}`);
        return { exit: typeof result.status === 'number' && result.status !== 0 ? result.status : 1 };
      }
      // A review runs on one model at one effort. A turn that completed on anything else is no review of
      // this command's, whatever it answered and however much of the diff it read, so it is asked first of
      // a turn that completed: a failed attempt, with what ran and what was asked in its line and its error.
      if (another !== null) {
        logRun('failed', another);
        error(`Codex's turn completed, but ${another}; a review that ran on anything else does not stand, so nothing of what it answered is shown and no record was written.\n${WAYS_ON}`);
        return { exit: 1 };
      }
      // A lean review answers in a structure this command reads. A turn that completed and left no such
      // answer did not do what a review does, so the attempt failed, whatever its commands showed: asked
      // before the evidence rule, which says how much of the diff was read and nothing of what came of it.
      if (answered && !answered.ok) {
        const why = answerFailure(answered);
        logRun('failed', why);
        error(`Codex's turn completed, but ${why}; no record was written.\n${WAYS_ON}`);
        return { exit: 1 };
      }
      // The session answered and its file does not say on which model. Asked after the answer, because a
      // home with no rollout file names none either, and what is wrong there is that there is no session
      // to read; asked before the evidence rule, which says how much was read and nothing of by what.
      if (!named) {
        const why = MODEL_NOT_NAMED(wanted.model);
        logRun('failed', why);
        error(`Codex's turn completed, but ${why}; a review that cannot say which model it ran on does not stand, so nothing of what it answered is shown and no record was written.\n${WAYS_ON}`);
        return { exit: 1 };
      }
      if (!evidence.inspected) {
        const { seen, total } = evidence.coverage;
        const within = part === null ? '' : part.of === 1 ? 'the files under review of ' : `part ${part.index} of ${part.of} of `;
        const why = evidence.review === '' ? 'it ended without a review message'
          : total === 0 ? 'it ran no successful command'
            : `its successful commands showed ${seen} of ${total} changed lines of ${within}${base.slice(0, 7)}..HEAD`;
        // The files whose changed lines were not all shown, so that a person knows where the review fell
        // short without reading the session.
        const unread = evidence.missingFiles.length > 0
          ? `\n  not read in full: ${listed(evidence.missingFiles.map(({ file, missing: lines, total: all }) => `${file} (${lines} of ${all} changed lines missing)`))}`
          : '';
        const missing = evidence.missing.slice(0, 3).map((line) => `\n  missing: ${truncate(line, 100)}`).join('');
        const ran = evidence.commands.length ? '' : '\nCodex ran no commands.';
        logRun('not-inspected', why);
        error(`Codex's turn completed, but ${why}; nothing was recorded.${unread}${missing}${ran}\n${WAYS_ON}`);
        return { exit: 1 };
      }
      // The run line goes first, so that the record can name it. If the record then cannot be written
      // the command exits 1 and the log keeps a `reviewed` line no record names: a measurement of a
      // session that did meet the evidence rule, and still not a review `check --push` will count.
      return { exit: 0, runId: logRun('reviewed'), review, rendered: evidence.review, spent, durationMs };
    };

    if (parts === null) {
      const whole = await attempt({ expectedKeys: expected, prompt: args.prompt, promptText, promptVersion: own ? REVIEW_PROMPT_VERSION : null });
      if (whole.exit !== 0) return whole.exit;
      runId = whole.runId;
    } else if (parts.length === 1) {
      // A range that leaves files out, whose other files fit in one part: one session, asked by its files
      // as a part is, since Codex's own review of a range reads every file of it. Said when the prompt
      // that was asked for, or the default, is not the one that is sent.
      if (!own) log('The review is asked with this command\'s own prompt, by its files: the sentence Codex writes for `--base` cannot be limited to some files.');
      const [part] = parts;
      const sole = await attempt({ expectedKeys: part.expected, prompt: 'own', promptText: part.prompt, promptVersion: REVIEW_PART_PROMPT_VERSION, part });
      if (sole.exit !== 0) return sole.exit;
      runId = sole.runId;
    } else {
      const lines = parts.reduce((sum, part) => sum + part.changedLines, 0);
      const files = parts.reduce((sum, part) => sum + part.files.length, 0);
      // The lines and the files of the parts, which are those of the range unless it leaves some out.
      const read = leftOut === null ? '' : ' that a review reads';
      // Which bound of a part the range is over: its changed lines, or, when those would fit, its files alone.
      const over = lines > args.partLines ? `more than the ${thousands(args.partLines)} a part holds` : `more files than the ${thousands(PART_MAX_FILES)} a part holds`;
      log(`The range ${range} changes ${counted(lines, 'line')} in ${counted(files, 'file')}${read}, ${over}, so it is reviewed in ${parts.length} parts, one after another.`);
      if (!own) log('Each part is asked with this command\'s own prompt: the sentence Codex writes for `--base` cannot be limited to some files.');
      // One part at a time, in order, and the next only once the one before it has passed: the first that
      // does not pass ends the run with the exit code of its own failure. The lines of the parts before
      // it stay in the run log, as measurements; none of them is a review of the range, so nothing they
      // answered is shown: what each part answered is held here until the last one has passed.
      // The parts that passed in earlier runs of this range are taken from the run log, where their lines keep
      // what they answered: not under `--fresh`, and not for a caller that asked for the result of every attempt
      // (`onResult`), which must see each one run. A log that cannot be read measured nothing, so nothing is kept.
      let keptRuns = null;
      if (!args.fresh && onResult === null) {
        try {
          keptRuns = readCodexReviewRuns(root, { spawn, where });
        } catch {
          keptRuns = [];
        }
      }
      const passed = [];
      for (const part of parts) {
        const one = await attempt({ expectedKeys: part.expected, prompt: 'own', promptText: part.prompt, promptVersion: REVIEW_PART_PROMPT_VERSION, part, keptRuns });
        if (one.exit !== 0) {
          const later = part.of - part.index;
          const unstarted = later === 0 ? '' : later === 1 ? 'the part after it was not started and ' : `the ${later} parts after it were not started and `;
          // Said only when a part did pass: a person who saw it pass would look for what it found.
          const held = passed.length === 0 ? ''
            : `\n${passed.length === 1 ? 'The part before it passed, and what it answered is' : `The ${passed.length} parts before it passed, and what they answered is`} not shown: without every part it is no review of ${range}.`;
          // And that what passed is kept for the next run of the range, which asks only the parts that did not pass: said only when one of them has its line in the run log, since a part whose line could not be written is kept nowhere.
          const keptHeld = onResult !== null || !passed.some((one) => one.runId !== undefined) ? ''
            : '\nWhat passed is kept in the run log: the next run of this range asks only the parts that did not pass (`--fresh` asks every part again).';
          error(`Part ${part.index} of ${part.of} (${listed(part.files)}) did not pass, so ${unstarted}no review of ${range} was recorded.${held}${keptHeld}`);
          return one.exit;
        }
        passed.push(one);
      }
      // Every part stands, so what they answered is the review of the range. First each part's review as
      // Codex rendered it, in the order of the parts, under a line that says which part it is of: they are
      // no longer between the lines of their own sessions, which is what told them apart. Then the findings
      // of them all, in the order of the files, then what each part concluded, then what they spent together.
      passed.forEach((one, at) => {
        // Guarded as the pass-through of a whole range is: nothing rendered is nothing shown, not a line
        // that says whose review follows above a blank one. No part gets here that way today, since the
        // evidence rule asks every attempt that stands for a review message (`reviewEvidence`).
        if (!one.rendered) return;
        log(`Part ${at + 1} of ${passed.length}, as Codex rendered its review:`);
        write(`${one.rendered}\n`);
      });
      for (const finding of passed.flatMap((one) => one.review.findings).sort(byPlace)) log(findingLine(finding));
      passed.forEach((one, at) => log(`Part ${at + 1} of ${passed.length}: ${verdictLine(one.review)}`));
      log(totalsLine(passed));
      // One entry for every part, in order: `null` where the line of a part could not be written, so that
      // the record says how many parts the review was made in and which of them were measured.
      runIds = passed.map((one) => one.runId ?? null);
      runId = passed.at(-1).runId;
    }
    outcome = 'reviewed';
  } else {
    // A skip follows the records as a review does: it is recorded for the range the records leave, and not
    // at all over a range they cover whole, where it would say of commits that have a record that their
    // review could not be made. A base that shares no history with HEAD is still a range a skip can name.
    const from = startingAt(git(spawn, root, ['merge-base', base, head]) ?? base);
    if (from === null) return 0;
  }

  // The record claims the committed range as it was when the review started. A commit made, or a tracked file
  // edited, while Codex read would be reviewed in part and recorded as if it were not there, so HEAD and the
  // tracked tree are read again here, after the review, and nothing is written unless both are as they were.
  // A skip reviewed nothing, so there is nothing to hold.
  if (args.unavailable === undefined) {
    const headNow = git(spawn, root, ['rev-parse', '--verify', 'HEAD^{commit}']);
    const tree = git(spawn, root, ['status', '--porcelain', '--untracked-files=no']);
    if (headNow !== null && headNow !== head) {
      error(
        `HEAD moved from ${head.slice(0, 7)} to ${headNow.slice(0, 7)} while Codex was reviewing, so what it read is not the range ${base.slice(0, 7)}..${head.slice(0, 7)} alone and no record was written. ` +
          'Nothing is committed in a worktree while its review runs; run the review again.',
      );
      return 1;
    }
    if (tree !== null && tree !== '') {
      error(
        `Tracked files changed while Codex was reviewing, so what it read is not the committed range ${base.slice(0, 7)}..${head.slice(0, 7)} alone and no record was written. ` +
          'Nothing is edited in a worktree while its review runs; run the review again.',
      );
      return 1;
    }
    if (headNow === null || tree === null) {
      error(
        `Could not read HEAD and the state of the tree again after the review, so it is not known that Codex read the range ${base.slice(0, 7)}..${head.slice(0, 7)} alone and no record was written.`,
      );
      return 1;
    }
  }

  const file = writeRecord({
    outcome,
    ...(outcome === 'unavailable' ? { reason: args.unavailable } : {}),
    // The run line this review was measured in; absent when that line could not be written. For a range
    // reviewed in parts it is the line of the last part, the one that completed the review, and `runs`
    // names the line of every part, in order, with `null` in the place of a part whose line could not be
    // written: `runs` is as long as the parts were many, and `run`, when it is there, is its last entry.
    ...(runId === undefined ? {} : { run: runId }),
    ...(runIds.length === 0 ? {} : { runs: runIds }),
    // What the review did not read, by count: the record says "reviewed" of the range, and this is how
    // much of the range that is not said of.
    ...(leftOut === null ? {} : { leftOut }),
  });
  if (file === null) return 1;
  const what = outcome === 'reviewed' ? 'the Codex review' : `an unavailable Codex review (${args.unavailable})`;
  // One part is one session, reviewed and recorded as a whole range is.
  const how = parts === null || parts.length === 1 ? '' : `, made in ${parts.length} parts,`;
  log(`Recorded ${what} of ${base.slice(0, 7)}..${head.slice(0, 7)}${how} in ${file}.`);
  return 0;
}
