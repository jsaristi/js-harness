// `js-harness double-review`: the double review of `rule:double-review` (odd/tasks/double-review-alignment.md, T3), one
// Claude reader and one Codex reader, blind, on the same frozen material: a plan, a design, a document that proposes
// something, or a small code change with its request.
//
// Why a command of its own and not a mode of `codex-review` (the feature document, L7). That command reviews a range
// of commits, and its records are what the push and the merge door read; a read here is of files, launches Claude as
// well as Codex, and must never cover code. As `codex-meter` is apart from it for the same reason, so is this; what
// they share is imported: the Codex launcher, its lean session (`leanFlags`, `leanEnv`) and lean home, the Claude
// path, and the environment of a Claude review (`lensEnv`).
//
// Blind by construction, not by intention. The material is copied into a folder outside the repository and hashed,
// and each reader must echo that hash in its answer or its answer does not count. Both readers are started at once,
// in two processes, on the same prompt. The Claude reader may read the repository and, through `--add-dir`, the copy
// and nothing else; its answer stays in this process until both have returned. Codex writes its answer in a folder
// no prompt names. The record holds both, written once both have returned, and the copy is removed after it. What
// each found and what the writer took is recorded (./lib/double-review-records.mjs) for the judgement of 2026-11-16.
//
// Exit 0 when the read, the plan, the judgement, the skip or the tally is done; 1 when a reader could not answer (the
// read is recorded with why), a file or the repository is missing, or a record cannot be written; 2 for a usage error,
// which starts nothing.
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REVIEW_EFFORT, REVIEW_MODEL, childEnv, leanEnv, leanFlags } from './codex-review.mjs';
import { lensEnv } from './lens-review.mjs';
import { unknownArgument } from './lib/args.mjs';
import { resolveClaude } from './lib/claude-path.mjs';
import { launchCodex } from './lib/codex-launch.mjs';
import { createLeanHome, leanHomesDir, realCodexHome } from './lib/codex-review-home.mjs';
import { readerPrompt } from './lib/double-review-prompt.mjs';
import { appendDoubleReview, findingsOf, READERS, readDoubleReviews, readOf, SEVERITIES, tallyOf } from './lib/double-review-records.mjs';
import { harnessHome } from './lib/home.mjs';
import { killTree } from './lib/process-tree.mjs';
import { ruleHere } from './lib/rules.mjs';
import { quoteWindowsArg, windowsCommandLine } from './lib/windows-args.mjs';

export const USAGE =
  'Usage: js-harness double-review read <file>... [--diff <rev>] [--plan] [--cwd <path>]\n' +
  '       js-harness double-review take <read id> <reader> --taken <n,...|none> [--shared <n,...>] [--why <text>] [--cwd <path>]\n' +
  '       js-harness double-review skip --what <text> --words <the user\'s words> --transcript <session id> --line <n> [--cwd <path>]\n' +
  '       js-harness double-review tally [--since <YYYY-MM-DD>] [--cwd <path>]\n' +
  'read gives the files, and with --diff the diff <rev>...HEAD, to a Claude reader and a Codex reader at once, blind, on one frozen copy, and records what each found; --plan says what a read costs and the words that skip it, and starts nothing. ' +
  'take records which of a reader\'s findings the writer took, and which of those the other reader also found. skip records the user\'s words that skip a read, and where they are read. tally gives each reader its reads, findings, taken and found by it alone.';

// The phrase that skips a read: the user's words of question 146, "a menos que yo como usuario te diga que no quiero la revision".
export const SKIP_PHRASE = 'no quiero la revisión';
// The Claude reader runs on `rule:subagent-reader-model`, a rule of this repository: a project that does not declare
// it reads on that rule's alias.
const CLAUDE_FALLBACK = 'opus';
// What one read cost when it was measured, on this feature's own plan (the feature document, L8): said as measured
// once, not as a bound.
const MEASURED_COST = 'about 116k tokens of Claude and 55k of Codex, about 1% of Codex\'s weekly limit';
// A Claude reader took four minutes on a plan; past this a reader has stalled.
export const READ_TIMEOUT_MS = 20 * 60 * 1000;
// The settings a reader adds over the user's: `--safe-mode` keeps the user's `language`, as for a lens (lens-review).
const CLAUDE_SETTINGS = { language: 'English' };

/** The answer both readers give, enforced by each CLI. */
export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['inputHash', 'findings', 'sound', 'unchecked'],
  properties: {
    inputHash: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'claim', 'evidence', 'fix'],
        properties: { severity: { type: 'string', enum: SEVERITIES }, claim: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
      },
    },
    sound: { type: 'array', items: { type: 'string' } },
    unchecked: { type: 'array', items: { type: 'string' } },
  },
};

class DoubleReviewArgError extends Error {}

const VERBS = ['read', 'take', 'skip', 'tally'];
const VALUED = { read: ['--diff', '--cwd'], take: ['--taken', '--shared', '--why', '--cwd'], skip: ['--what', '--words', '--transcript', '--line', '--cwd'], tally: ['--since', '--cwd'] };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The numbers of a list `1,3`: distinct integers from 1, else a usage error naming `flag`. */
function numbers(value, flag) {
  const out = String(value).split(',').map((one) => one.trim()).filter(Boolean).map(Number);
  if (out.length === 0 || out.some((n) => !Number.isInteger(n) || n < 1) || new Set(out).size !== out.length) {
    throw new DoubleReviewArgError(`${flag} takes distinct finding numbers from 1, as 1,3`);
  }
  return out;
}

/** The command's verb and options from `argv`, `defaultCwd` where no `--cwd` is given; throws a usage error. */
export function parseArgs(argv, defaultCwd = process.cwd()) {
  const [verb, ...rest] = argv;
  if (verb?.startsWith('-')) throw new DoubleReviewArgError(`unknown argument: ${verb}`);
  if (!VERBS.includes(verb)) throw new DoubleReviewArgError(verb === undefined ? 'a verb is needed' : `not a verb: ${verb}`);
  const valued = VALUED[verb];
  const unknown = unknownArgument(rest, { valued, bare: verb === 'read' ? ['--plan'] : [], positional: verb === 'read' || verb === 'take' });
  if (unknown !== null) throw new DoubleReviewArgError(`unknown argument: ${unknown}`);
  const values = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (valued.includes(rest[i])) {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) throw new DoubleReviewArgError(`${rest[i]} needs a value`);
      if (Object.hasOwn(values, rest[i])) throw new DoubleReviewArgError(`${rest[i]} is given twice`);
      values[rest[i]] = value;
      i += 1;
    } else if (rest[i] !== '--plan') positional.push(rest[i]);
  }
  const cwd = path.resolve(defaultCwd, values['--cwd'] ?? '.');
  if (verb === 'read') {
    if (positional.length === 0) throw new DoubleReviewArgError('read needs the files it reads');
    return { verb, files: positional, diff: values['--diff'], plan: rest.includes('--plan'), cwd };
  }
  if (verb === 'take') {
    const [read, reader, more] = positional;
    if (read === undefined || reader === undefined || more !== undefined) throw new DoubleReviewArgError('take needs a read id and a reader');
    if (!READERS.includes(reader)) throw new DoubleReviewArgError(`not a reader: ${reader} (the readers are ${READERS.join(', ')})`);
    if (values['--taken'] === undefined) throw new DoubleReviewArgError('take needs --taken (none for no finding taken)');
    const taken = values['--taken'] === 'none' ? [] : numbers(values['--taken'], '--taken');
    const shared = values['--shared'] === undefined ? [] : numbers(values['--shared'], '--shared');
    return { verb, read, reader, taken, shared, why: values['--why'], cwd };
  }
  if (verb === 'skip') {
    for (const flag of VALUED.skip.slice(0, 4)) {
      if (!values[flag]?.trim()) throw new DoubleReviewArgError(`skip needs ${flag}: only the user's words skip a read, recorded with where they are read`);
    }
    const line = Number(values['--line']);
    if (!Number.isInteger(line) || line < 1) throw new DoubleReviewArgError('--line is a line number from 1');
    return { verb, what: values['--what'], words: values['--words'], transcript: values['--transcript'], line, cwd };
  }
  if (values['--since'] !== undefined && !DAY.test(values['--since'])) throw new DoubleReviewArgError('--since is a day, YYYY-MM-DD');
  return { verb, since: values['--since'], cwd };
}

/** What a read is and costs, said before it starts and by `--plan`, with the words that skip it. */
export function announceLines({ files, diff, model }) {
  return [
    `double review of ${files.join(', ')}${diff === undefined ? '' : ` and the diff ${diff}...HEAD`}: a Claude reader on ${model} and a Codex reader on ${REVIEW_MODEL}, blind, started at once on one frozen copy`,
    `cost: measured once, ${MEASURED_COST} (odd/tasks/double-review-alignment.md, L8); js-harness codex-meter reads what is left`,
    `only the user's own words skip it, "${SKIP_PHRASE}", recorded with js-harness double-review skip`,
  ];
}

/** The arguments of the Claude reader: a fresh print run with read-only tools, the copy its one folder past the
 * repository, its answer held to the schema. */
export function claudeReaderArgs(settingsFile, material, model) {
  return ['-p', '--safe-mode', '--tools', 'Read,Grep,Glob', '--add-dir', material, '--model', model, '--settings', settingsFile, '--output-format', 'json', '--json-schema', JSON.stringify(ANSWER_SCHEMA), '--no-session-persistence'];
}

/** The arguments of the Codex reader: `codex exec` in the lean session of `codex-review`, the prompt on stdin. */
export function codexReaderArgs(platform, root, schemaFile, answerFile) {
  return ['exec', '--json', ...leanFlags(platform, REVIEW_EFFORT), '-C', root, '--output-schema', schemaFile, '-o', answerFile, '-'];
}

/** Runs a child to its end: `{ status, stdout, stderr, error, durationMs }`; killed with its tree past `timeoutMs`.
 * A kill that fails leaves the reader running: `stillRunning` says so, and its streams are let go so it does not hold
 * this process open. */
function runChild(start, { input, timeoutMs, kill }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let child;
    try {
      child = start();
    } catch (error) {
      resolve({ status: null, stdout: '', stderr: '', error, durationMs: 0 });
      return;
    }
    let stdout = '';
    let stderr = '';
    let done = false;
    let timer = null;
    const finish = (fields) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, durationMs: Date.now() - startedAt, ...fields });
    };
    timer = setTimeout(() => {
      const late = `no answer within ${Math.round(timeoutMs / 1000)} seconds`;
      try {
        kill(child, { startedAt });
      } catch (err) {
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy?.();
        child.unref?.();
        finish({ status: null, stillRunning: true, error: new Error(`${late}, and it could not be stopped: ${err.message}`) });
        return;
      }
      finish({ status: null, error: new Error(late) });
    }, timeoutMs);
    child.stdout?.setEncoding?.('utf8');
    child.stderr?.setEncoding?.('utf8');
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
    child.on('error', (error) => finish({ status: null, error }));
    child.on('close', (status) => finish({ status, error: null }));
    child.stdin?.on?.('error', () => {});
    child.stdin?.end(input);
  });
}

const isText = (value) => typeof value === 'string';
function isAnswer(answer) {
  return answer !== null && typeof answer === 'object' && isText(answer.inputHash)
    && Array.isArray(answer.findings) && answer.findings.every((f) => SEVERITIES.includes(f?.severity) && isText(f.claim) && isText(f.evidence) && isText(f.fix))
    && Array.isArray(answer.sound) && answer.sound.every(isText) && Array.isArray(answer.unchecked) && answer.unchecked.every(isText);
}

/** `answer` as a reader's outcome once its echo is checked against `hash`: what it found, or why it does not count. */
function echoed(answer, hash, rest) {
  if (!isAnswer(answer)) return { outcome: 'failed', reason: 'its answer is not in the schema' };
  if (answer.inputHash !== hash) return { outcome: 'failed', reason: 'it answered without echoing the material\'s hash, so it is not known to have read that material' };
  const { inputHash, ...found } = answer;
  return { outcome: 'answered', ...found, ...rest };
}

/** The outcome of the Claude run: its `structured_output`, with its usage, or why there is none. */
export function claudeOutcome(ran, hash) {
  if (ran.error) return { outcome: 'failed', reason: ran.error.message };
  let parsed;
  try {
    parsed = JSON.parse(ran.stdout);
  } catch {
    return { outcome: 'failed', reason: `the CLI printed no JSON (exit ${ran.status}): ${(ran.stdout || ran.stderr).slice(0, 200)}` };
  }
  const usage = parsed?.usage;
  const spent = usage ? { inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0), outputTokens: usage.output_tokens ?? 0 } : null;
  return echoed(parsed?.structured_output ?? null, hash, { usage: spent, costUsd: parsed?.total_cost_usd ?? null });
}

/** The outcome of the Codex run: the answer file it wrote, with the usage of its `turn.completed` events, or why there
 * is none. */
export function codexOutcome(ran, answerText, hash) {
  if (ran.error) return { outcome: 'failed', reason: ran.error.message };
  let answer;
  try {
    answer = JSON.parse(answerText ?? '');
  } catch {
    return { outcome: 'failed', reason: `Codex wrote no JSON answer (exit ${ran.status}): ${ran.stderr.trim().split('\n').at(-1) ?? ''}` };
  }
  let usage = null;
  for (const line of ran.stdout.split('\n')) {
    try {
      const event = JSON.parse(line);
      if (event?.type === 'turn.completed' && event.usage) {
        usage = { inputTokens: (usage?.inputTokens ?? 0) + (event.usage.input_tokens ?? 0), outputTokens: (usage?.outputTokens ?? 0) + (event.usage.output_tokens ?? 0) };
      }
    } catch {
      // Not an event.
    }
  }
  return echoed(answer, hash, { usage });
}

/** The model of the Claude reader in the project at `root`: `rule:subagent-reader-model` where its rules file is this
 * copy's list, else the fallback. */
export function readerModel(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, 'bin', 'lib', 'rules-data.mjs'), 'utf8');
  } catch {
    text = undefined;
  }
  return ruleHere('subagent-reader-model', undefined, text).value ?? CLAUDE_FALLBACK;
}

/** The repository's top level around `cwd`, or `null` outside one. */
function topLevel(cwd) {
  const ran = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return ran.status === 0 ? path.resolve(ran.stdout.trim()) : null;
}

/** The frozen copy in `folder`: each file as `<n>-<name>`, and the diff as `diff.patch`. Returns the material and its hash. */
function freeze(folder, sources, diffText, diff) {
  const material = [];
  sources.forEach((source, i) => {
    const copy = path.join(folder, `${i + 1}-${path.basename(source.abs)}`);
    fs.copyFileSync(source.abs, copy);
    material.push({ copy, from: `a copy of ${source.rel}` });
  });
  if (diffText !== null) {
    const copy = path.join(folder, 'diff.patch');
    fs.writeFileSync(copy, diffText, 'utf8');
    material.push({ copy, from: `git diff ${diff}...HEAD` });
  }
  const hash = createHash('sha256');
  for (const one of material) hash.update(`${path.basename(one.copy)}\0`).update(fs.readFileSync(one.copy)).update('\0');
  return { material, hash: hash.digest('hex') };
}

/** The two readers, started at once on `prompt`: `{ readers, stillRunning }`, their outcomes in the order of `READERS`,
 * and whether one could not be stopped past its timeout, whose lean home is then kept. */
async function readBoth({ root, model, prompt, hash, folder, material, env, deps, error }) {
  const platform = deps.platform ?? process.platform;
  const spawn = deps.spawn ?? spawnChild;
  const kill = deps.kill ?? ((child, lifetime) => killTree(child, lifetime, { platform }));
  const timeoutMs = deps.readTimeoutMs ?? READ_TIMEOUT_MS;
  const settingsFile = path.join(folder, 'settings.json');
  const schemaFile = path.join(folder, 'schema.json');
  const answers = path.join(folder, 'answers');
  fs.mkdirSync(answers);
  fs.writeFileSync(settingsFile, JSON.stringify(CLAUDE_SETTINGS), 'utf8');
  fs.writeFileSync(schemaFile, JSON.stringify(ANSWER_SCHEMA), 'utf8');
  const answerFile = path.join(answers, 'codex.json');
  const options = { cwd: root, windowsHide: true, detached: platform !== 'win32' };

  const claude = (deps.resolveClaude ?? resolveClaude)({ env, platform });
  const claudeArgs = claudeReaderArgs(settingsFile, material, model);
  const claudeRan = claude === null
    ? Promise.resolve({ error: new Error('the Claude CLI was not found on the PATH') })
    : runChild(() => (claude.shell
      ? spawn(windowsCommandLine(quoteWindowsArg(claude.path), claudeArgs), [], { ...options, env: lensEnv(env), shell: true })
      : spawn(claude.path, claudeArgs, { ...options, env: lensEnv(env) })), { input: prompt, timeoutMs, kill });

  let lean = null;
  let codexRan;
  try {
    const homedir = deps.homedir ?? os.homedir;
    lean = (deps.makeLeanHome ?? createLeanHome)({ realHome: realCodexHome(env, homedir(), platform), parent: leanHomesDir(harnessHome({ env, homedir })), id: `double-review-${path.basename(folder)}` });
    const codexEnv = leanEnv(childEnv(env, platform), lean.home, platform);
    codexRan = runChild(() => launchCodex(spawn, platform, codexReaderArgs(platform, root, schemaFile, answerFile), { ...options, env: codexEnv }), { input: prompt, timeoutMs, kill });
  } catch (err) {
    codexRan = Promise.resolve({ error: err });
  }

  const [claudeDone, codexDone] = await Promise.all([claudeRan, codexRan]);
  if (codexDone.stillRunning && lean !== null) {
    error(`the lean Codex home ${lean.home} is kept: its reader could not be stopped and may still use it; a later lean review sweeps it once stale`);
  } else {
    // `dispose` returns what it could not leave clean rather than throwing, as `codex-review` reads it.
    let left;
    try {
      left = lean?.dispose();
    } catch (err) {
      left = err.message;
    }
    if (left) error(`Warning: the lean Codex home of this read was not left clean: ${left}`);
  }
  const answerText = fs.existsSync(answerFile) ? fs.readFileSync(answerFile, 'utf8') : null;
  const readers = [
    { reader: 'claude', model, durationMs: claudeDone.durationMs ?? null, ...claudeOutcome(claudeDone, hash) },
    { reader: 'codex', model: REVIEW_MODEL, durationMs: codexDone.durationMs ?? null, ...codexOutcome(codexDone, answerText, hash) },
  ];
  return { readers, stillRunning: Boolean(claudeDone.stillRunning || codexDone.stillRunning) };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The lines a finished read prints: each reader's outcome, its findings numbered, and the command that judges them. */
function readLines(id, readers) {
  const lines = [`read ${id}: ${readers.map((one) => {
    if (one.outcome !== 'answered') return `${one.reader} failed (${one.reason})`;
    const spent = one.usage ? `, ${(one.usage.inputTokens + one.usage.outputTokens).toLocaleString('en-US')} tokens` : '';
    return `${one.reader} answered, ${plural(one.findings.length, 'finding')}${spent}`;
  }).join('; ')}`];
  for (const one of readers) findingsOf(one).forEach((f, i) => lines.push(`${one.reader} ${i + 1}. [${f.severity}] ${f.claim} (${f.evidence}) fix: ${f.fix}`));
  const judged = readers.filter((one) => one.outcome === 'answered').map((one) => one.reader);
  if (judged.length > 0) lines.push(`judge each reader's findings: ${judged.map((reader) => `js-harness double-review take ${id} ${reader} --taken <n,...|none> [--shared <n,...>]`).join('; ')}`);
  return lines;
}

async function readCommand(args, root, env, deps, { log, error }) {
  const sources = [];
  for (const file of args.files) {
    const abs = path.resolve(args.cwd, file);
    if (!fs.statSync(abs, { throwIfNoEntry: false })?.isFile()) {
      error(`no such file: ${file}; nothing was started`);
      return 1;
    }
    sources.push({ abs, rel: path.relative(root, abs).split(path.sep).join('/') });
  }
  const model = readerModel(root);
  for (const line of announceLines({ files: sources.map((one) => one.rel), diff: args.diff, model })) log(line);
  if (args.plan) return 0;
  let diffText = null;
  if (args.diff !== undefined) {
    // Git's own patch: an external diff tool or a text conversion in the user's config would freeze its output instead.
    const ran = spawnSync('git', ['diff', '--no-ext-diff', '--no-textconv', '--no-color', `${args.diff}...HEAD`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (ran.status !== 0) {
      error(`git diff ${args.diff}...HEAD failed: ${String(ran.stderr).trim().split('\n')[0]}; nothing was started`);
      return 1;
    }
    diffText = ran.stdout;
  }
  const folder = fs.mkdtempSync(path.join((deps.tmpdir ?? os.tmpdir)(), 'js-harness-double-review-'));
  let keep = false;
  try {
    const copies = path.join(folder, 'material');
    fs.mkdirSync(copies);
    const { material, hash } = freeze(copies, sources, diffText, args.diff);
    const prompt = readerPrompt(material, hash);
    const { readers, stillRunning } = await readBoth({ root, model, prompt, hash, folder, material: copies, env, deps, error });
    keep = stillRunning;
    const id = (deps.id ?? randomUUID)();
    const at = (deps.now ?? (() => new Date()))().toISOString();
    // What the readers found is printed first: it cost both readers' tokens, and a record that cannot be written must
    // not lose it.
    for (const line of readLines(id, readers)) log(line);
    try {
      appendDoubleReview(root, { kind: 'read', id, at, files: sources.map((one) => one.rel), ...(args.diff === undefined ? {} : { diff: args.diff }), hash, readers });
    } catch (err) {
      error(`the read could not be recorded: ${err.message}; its findings are above, and take cannot judge them until a read is recorded`);
      return 1;
    }
    return readers.every((one) => one.outcome === 'answered') ? 0 : 1;
  } finally {
    // A reader that could not be stopped may still read the copy: it is kept, and said, rather than removed under it.
    if (keep) error(`kept ${folder}: a reader that could not be stopped may still read it; remove it once that reader is gone`);
    else fs.rmSync(folder, { recursive: true, force: true });
  }
}

function takeCommand(args, root, deps, { log, error }) {
  const read = readOf(readDoubleReviews(root), args.read);
  if (read === null) {
    error(`no read ${args.read} in the record; js-harness double-review tally counts the reads`);
    return 1;
  }
  const count = findingsOf(read.readers.find((one) => one.reader === args.reader)).length;
  const past = [...args.taken, ...args.shared].filter((n) => n > count);
  if (past.length > 0) {
    error(`${args.reader} gave ${plural(count, 'finding')} in read ${args.read}, so there is no finding ${past.join(', ')}`);
    return 1;
  }
  const at = (deps.now ?? (() => new Date()))().toISOString();
  appendDoubleReview(root, { kind: 'take', at, read: args.read, reader: args.reader, taken: args.taken, shared: args.shared, ...(args.why === undefined ? {} : { why: args.why }) });
  log(`recorded: ${plural(args.taken.length, 'finding')} of ${count} of ${args.reader}'s taken in read ${args.read}, ${args.shared.length} also found by the other reader`);
  return 0;
}

function skipCommand(args, root, deps, { log }) {
  const at = (deps.now ?? (() => new Date()))().toISOString();
  appendDoubleReview(root, { kind: 'skip', at, what: args.what, words: args.words, transcript: args.transcript, line: args.line });
  log(`recorded: the double review of ${args.what} skipped in the user's words, line ${args.line} of ${args.transcript}`);
  return 0;
}

function tallyCommand(args, root, { log }) {
  const rows = tallyOf(readDoubleReviews(root), { since: args.since });
  if (rows.length === 0) {
    log(`no double review read${args.since === undefined ? '' : ` since ${args.since}`}`);
    return 0;
  }
  for (const row of rows) {
    log(`${row.reader}: ${plural(row.reads, 'read')}, ${plural(row.findings, 'finding')}, ${row.judged} judged, ${row.taken} taken, ${row.alone} found by it alone`);
  }
  return 0;
}

/** Runs the command; returns its exit code. `deps` (all optional) are for the tests: `log` and `error` take the lines
 * printed, `cwd` is the folder without `--cwd`, and `spawn`, `platform`, `resolveClaude`, `makeLeanHome`, `homedir`,
 * `tmpdir`, `now` and `id` replace what a read starts and stamps. */
export async function doubleReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const out = { log: deps.log ?? console.log, error: deps.error ?? console.error };
  let args;
  try {
    args = parseArgs(argv, deps.cwd ?? process.cwd());
  } catch (err) {
    if (!(err instanceof DoubleReviewArgError)) throw err;
    out.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const root = topLevel(args.cwd);
  if (root === null) {
    out.error(`not a git repository: ${args.cwd}; the double review is recorded under its git folder`);
    return 1;
  }
  try {
    if (args.verb === 'read') return await readCommand(args, root, env, deps, out);
    if (args.verb === 'take') return takeCommand(args, root, deps, out);
    if (args.verb === 'skip') return skipCommand(args, root, deps, out);
    return tallyCommand(args, root, out);
  } catch (err) {
    out.error(`double-review ${args.verb} failed: ${err.message}`);
    return 1;
  }
}
