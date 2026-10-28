// `js-harness lens-review`: the Claude half of the two reviews every slice gets (odd/tasks/f8-s1-reviews.md, T3;
// his words of 2026-10-26, "revision siempre ... una segunda opinion con un segundo modelo pero tambien una
// revision del mismo claude").
//
// The session picks one to four lenses by the consequence of what the range touched and says why in one line.
// Each lens is a fresh headless Claude run with its prompt as the system prompt, no tools and none of the user's
// customizations (`--safe-mode`), on the user's own CLI login, as `codex-review` runs on his Codex login: a review
// is work, never an eval, so the eval token and any API key are taken out of its environment. What it reads is the
// block `./lib/lens-candidate.mjs` packages, and what it answers counts only as `./lib/lens-result.mjs` says. One
// record a run (`./lib/lens-reviews.mjs`), naming the run line written before any lens ran, since a check admits no
// record that names none; `--unavailable <reason>` records a skip, which the push lets through and
// `check`, `doctor` and the merge door keep listing until a review covers it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unknownArgument } from './lib/args.mjs';
import { claudeRunner } from './lib/background.mjs';
import { NOTHING_TO_REVIEW } from './lib/codex-reviews.mjs';
import { lensCandidate } from './lib/lens-candidate.mjs';
import { LENS_NAMES, LENSES, lensPrompt } from './lib/lens-prompts.mjs';
import { lensResult } from './lib/lens-result.mjs';
import { appendLensReview, INCOMPLETE, LENS_REVIEW_SCHEMA, startLensRun } from './lib/lens-reviews.mjs';

// The model gentle-ai's lens agents name (`model: sonnet`), as an alias, so the newest Sonnet answers.
export const LENS_MODEL = 'sonnet';
// The most a lens is handed, in estimated tokens (four characters a token): a range past it is reviewed in smaller
// ranges, since a lens that cannot hold the whole block can only answer incomplete.
export const LENS_INPUT_LIMIT = 150_000;
// A lens answers in under two minutes on a slice; a run past this has stalled.
export const LENS_TIMEOUT_MS = 10 * 60 * 1000;
// How many characters of an answer that is no lens result its record keeps: enough to tell prose from a broken
// object, so why it failed is read before the lens runs again (odd/tasks/f8-s1-reviews.md, L10).
export const LENS_ANSWER_KEPT = 300;
// What the child must not inherit: a review runs on the user's CLI login, never on the eval token or a key.
const NOT_INHERITED = ['JS_HARNESS_EVAL_OAUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY'];

export const USAGE =
  'Usage: js-harness lens-review --base <rev> --lenses <lens,...> --reason "<what the range touched and how>" [--head <rev>] [--plan] [--cwd <path>]\n' +
  '       js-harness lens-review --base <rev> --unavailable <reason> [--head <rev>] [--cwd <path>]\n' +
  `Runs the Claude lenses picked over <base>..<head> (HEAD unless named), one fresh tool-less run on ${LENS_MODEL} each, and records the run beside Codex's reviews. ` +
  'Pick every lens pertinent to what the range touched and how, and only those; judge by consequence, not by file names or counts:\n' +
  LENS_NAMES.map((name) => `  ${name} when ${LENSES[name].when}\n`).join('') +
  'A result counts only when it echoes the range\'s subject hash and inspected every path; one incomplete lens makes the run incomplete (exit 1), recorded and covering nothing. ' +
  'Markdown files and the paths a .gitattributes marks `-codex-review` are left out, as Codex leaves them out. --plan prints the candidate and starts nothing. ' +
  '--unavailable <reason> records a skip: the push lets it through, and check, doctor and merge-queue list it until a review covers the range.';

/** The environment a lens runs in: `env` without the eval token or any key, so the CLI's own login answers. */
export function lensEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !NOT_INHERITED.includes(name)));
}

/** The CLI arguments of one lens run, its prompt read from `promptFile`. */
export function claudeArgs(promptFile) {
  return ['-p', '--safe-mode', '--tools', '', '--system-prompt-file', promptFile, '--model', LENS_MODEL, '--output-format', 'json', '--no-session-persistence'];
}

/** One lens run with the real CLI: `{ status, stdout, stderr, error, durationMs }`. The prompt goes in a file of its
 * own, since a prompt of many lines cannot cross `cmd.exe` as an argument; the block goes on stdin. The CLI is run
 * as `claudeRunner` runs it, which quotes every argument when it is an npm shim, the empty `--tools` value among
 * them. `deps` (`spawn`, `platform`) are for the tests. */
export function runLens({ prompt, block, env }, deps = {}) {
  const run = claudeRunner({ env, timeout: LENS_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, ...deps });
  if (!run) return { error: new Error('the Claude CLI was not found on the PATH') };
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-lens-'));
  const promptFile = path.join(folder, 'prompt.md');
  const started = Date.now();
  try {
    fs.writeFileSync(promptFile, prompt, 'utf8');
    const ran = run(claudeArgs(promptFile), { cwd: folder, input: block });
    return { ...ran, durationMs: Date.now() - started };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

/** What one lens run gave: the `result` entry of the run's record. */
function lensOutcome(lens, ran, candidate) {
  const durationMs = ran.durationMs ?? null;
  let out = null;
  try {
    out = JSON.parse(ran.stdout ?? '');
  } catch {
    // Read below as a run that gave no result.
  }
  const usage = out?.usage ?? {};
  const spent = {
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    costUsd: typeof out?.total_cost_usd === 'number' ? out.total_cost_usd : null,
    durationMs,
    model: Object.keys(out?.modelUsage ?? {})[0] ?? null,
  };
  if (ran.error || ran.status !== 0 || !out || out.is_error || typeof out.result !== 'string') {
    const why = ran.error ? ran.error.message : out?.is_error ? `the CLI reported an error: ${String(out.result ?? '').slice(0, 200)}` : `the CLI exited ${ran.status} with no result${ran.stderr ? `: ${String(ran.stderr).trim().split('\n')[0]}` : ''}`;
    return { lens, outcome: INCOMPLETE, why, findings: [], ...spent };
  }
  const read = lensResult(out.result, candidate);
  return read.complete
    ? { lens, outcome: 'complete', findings: read.findings, evidence: read.evidence, ...spent }
    : { lens, outcome: INCOMPLETE, why: read.why, answered: answerKept(out.result), findings: [], ...spent };
}

/** The start of an answer the lens result could not read, on one line, as its record keeps it: cut by characters, not
 * UTF-16 units, so the cut never leaves half of one. */
const answerKept = (text) => [...text.replace(/\s+/g, ' ').trim()].slice(0, LENS_ANSWER_KEPT).join('');

class LensReviewArgError extends Error {}

/** The lenses `--lenses` names: one to four distinct lens names, else a usage error. */
function pickedLenses(value) {
  const names = String(value).split(',').map((name) => name.trim()).filter(Boolean);
  const unknown = names.filter((name) => !LENS_NAMES.includes(name));
  if (names.length === 0) throw new LensReviewArgError('--lenses names no lens');
  if (unknown.length) throw new LensReviewArgError(`not a lens: ${unknown.join(', ')} (the lenses are ${LENS_NAMES.join(', ')})`);
  if (new Set(names).size !== names.length) throw new LensReviewArgError('--lenses names a lens twice');
  return names;
}

/** The command's options from `argv`: `{ base, head, cwd, skip, lenses, reason, plan }`; throws a usage error. */
function parseArgs(argv) {
  const unknown = unknownArgument(argv, { valued: ['--base', '--head', '--lenses', '--reason', '--unavailable', '--cwd'], bare: ['--plan'] });
  if (unknown !== null) throw new LensReviewArgError(`unknown argument: ${unknown}`);
  const value = (flag) => {
    const at = argv.indexOf(flag);
    if (at === -1) return undefined;
    const given = argv[at + 1];
    if (given === undefined || given.startsWith('--') || !given.trim()) throw new LensReviewArgError(`${flag} needs a value`);
    return given.trim();
  };
  const base = value('--base');
  if (!base) throw new LensReviewArgError('--base <rev> is required');
  const options = { base, head: value('--head') ?? 'HEAD', cwd: path.resolve(value('--cwd') ?? process.cwd()), skip: value('--unavailable'), plan: argv.includes('--plan') };
  if (options.skip !== undefined && options.plan) throw new LensReviewArgError('--plan records nothing, so it does not go with --unavailable');
  if (options.skip !== undefined) return options;
  const lenses = value('--lenses');
  if (lenses === undefined) throw new LensReviewArgError('--lenses <lens,...> is required: pick the lenses pertinent to what the range touched');
  const reason = value('--reason');
  if (reason === undefined) throw new LensReviewArgError('--reason "<what the range touched and how>" is required');
  return { ...options, lenses: pickedLenses(lenses), reason };
}

export function lensReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const stdout = deps.stdout ?? ((line) => console.log(line));
  const stderr = deps.stderr ?? ((line) => console.error(line));
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof LensReviewArgError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { base, head, cwd, skip, reason } = options;
  const picked = { names: options.lenses };

  const candidate = lensCandidate(cwd, { base, head });
  if (candidate.error) {
    stderr(`js-harness lens-review: ${candidate.error}`);
    return 1;
  }
  const range = `${candidate.base.slice(0, 7)}..${candidate.head.slice(0, 7)}`;
  const record = {
    schema: LENS_REVIEW_SCHEMA,
    base: candidate.base,
    head: candidate.head,
    subjectHash: candidate.subjectHash,
    paths: candidate.manifest.length,
    leftOut: { files: candidate.leftOut.length, marked: { files: candidate.markedLeftOut } },
  };
  // The run line goes first, before any lens runs, and the record names it: a check admits no record that names none.
  let runId = null;
  const start = () => (runId ??= startLensRun(cwd, record));
  const write = (fields) => appendLensReview(cwd, { ...record, run: start(), ...fields, reviewedAt: new Date().toISOString() });
  if (skip !== undefined) {
    const file = write({ outcome: 'unavailable', reason: skip });
    stdout(`Recorded a skip of the Claude lenses over ${range} (${skip}) in ${file}: the push lets it through, and check, doctor and merge-queue list it until a review covers the range.`);
    return 0;
  }
  if (candidate.manifest.length === 0) {
    const reason = `no path a review reads changes in ${range}`;
    if (options.plan) {
      stdout(`Nothing to review: ${reason}. Nothing was started or recorded.`);
      return 0;
    }
    const file = write({ outcome: NOTHING_TO_REVIEW, reason });
    stdout(`Nothing to review: ${reason}. Recorded in ${file}; no lens was started.`);
    return 0;
  }
  const estimated = Math.ceil((candidate.block.length + lensPrompt(picked.names[0]).length) / 4);
  const said = `${range}: ${candidate.manifest.length} path${candidate.manifest.length === 1 ? '' : 's'} (${candidate.leftOut.length} left out), about ${estimated.toLocaleString('en-US')} estimated input tokens a lens, ${picked.names.length} lens${picked.names.length === 1 ? '' : 'es'} (${picked.names.join(', ')})`;
  if (estimated > LENS_INPUT_LIMIT) {
    stderr(`js-harness lens-review: ${said}, more than the ${LENS_INPUT_LIMIT.toLocaleString('en-US')} a lens is handed; review the range in smaller ranges, each with its own --base and --head.`);
    return 1;
  }
  if (options.plan) {
    stdout(`Would review ${said}. Nothing was started.`);
    return 0;
  }

  const run = deps.runLens ?? runLens;
  start();
  const results = [];
  for (const lens of picked.names) {
    stdout(`${lens}: running over ${range}...`);
    results.push(lensOutcome(lens, run({ lens, prompt: lensPrompt(lens), block: candidate.block, env: lensEnv(env), cwd }), candidate));
  }
  const complete = results.every((result) => result.outcome === 'complete');
  const file = write({ outcome: complete ? 'reviewed' : INCOMPLETE, lenses: picked.names, lensReason: reason, results });
  for (const result of results) {
    if (result.outcome !== 'complete') {
      stderr(`${result.lens}: incomplete, ${result.why}${result.answered === undefined ? '' : `; it answered: ${JSON.stringify(result.answered)}`}`);
      continue;
    }
    stdout(`${result.lens}: complete, ${result.findings.length} finding${result.findings.length === 1 ? '' : 's'}, ${result.inputTokens} input and ${result.outputTokens} output tokens`);
    for (const finding of result.findings) stdout(`  ${finding.severity} ${finding.location}: ${finding.claim}`);
  }
  if (!complete) {
    stderr(`The lens run over ${range} is incomplete and covers nothing; recorded in ${file}. Read why above before running it again.`);
    return 1;
  }
  stdout(`The Claude lenses reviewed ${range}; recorded in ${file}. Treat their findings as Codex's: fix, then review the fix.`);
  return 0;
}
