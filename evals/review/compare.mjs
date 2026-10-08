#!/usr/bin/env node
// The comparison of the review's configurations: one Codex review a cell, each stored as a reading.
//
//   node evals/review/compare.mjs --list
//   node evals/review/compare.mjs --cell <config>:<range> [--force] [--dry-run] [--keep-checkout]
//
// Why. `js-harness codex-review` has two sessions, and which one is the default was decided by what each
// finds and what it costs (odd/tasks/codex-review-lean.md, T11 to T13): `current` was the default while
// the cells were read, and `lean` is since. A cell is one configuration reviewing one range. What it spent
// and what it found is written to one JSON file, the reading, and `./report.mjs` sets the readings side by
// side. This tool decides nothing, and no cell rests on the default: each names its session to the command,
// so a cell run again measures the configuration it measured the first time.
//
// The matrix is data, below: five configurations over two ranges. `real` is a range of this repository
// with no known defect, where a configuration shows what it costs and what it reports on ordinary work.
// `seeded` is the repository `./seeded.mjs` builds, wrong in seven known places, where a reading is scored
// against the key (`./score.mjs`). The CodeGraph configuration runs on the real range alone.
//
// One cell an invocation, on purpose. Every cell is a call to the model through Codex, which draws on a
// cap that cannot be measured in advance, so nothing here runs a batch: a second cell is a second command,
// and `--dry-run` shows what one would start without starting it. A recorded cell is not run again without
// `--force`.
//
// How a configuration is varied. The command line of `codex-review` is not: it fixes the model and the
// effort. This tool calls its entry, `codexReviewMain`, with injected `deps` (the effort, more `-c`
// settings, the measured `current` session) and collects each attempt through `onResult`.
//
// Where a range is reviewed. Never in this repository's own tree: `codex-review` reviews `base..HEAD` of
// the folder it runs in and writes its record and its run log into that folder's git dir. `real` is a
// `git clone` beside the repository, detached at the head of the range: a clone and not a worktree,
// because a worktree shares the git dir, and the record of an eval run would then count as a review of the
// real branch. It is beside the repository and not under the temp folder because the CodeGraph cell needs
// an index there, and CodeGraph does not index a temporary folder. `seeded` is built under the temp folder.
// Both are removed after the cell.
//
// How `current` is measured. As a person runs it, that session is ephemeral, in the user's own Codex home,
// so what it spends is written nowhere. Here it runs in a copy of that home, made by `../codex-home.mjs` as for the
// eval suite: `config.toml` without the desktop app's pieces and with an engram of the run's own, the
// global `AGENTS.md`, the hooks, the skills and the plugin cache. The login is not part of the copy and is
// never copied or opened: `codexReviewMain` hard-links the real `auth.json` into the copy, as it does for
// the lean home (bin/lib/codex-review-home.mjs). Nothing is written into the real home.
//
// It calls the model only through a cell that is really run. `--list` and `--dry-run` start nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexArgs, codexReviewMain, LEAN_EFFORT } from '../../bin/codex-review.mjs';
import { leanHomesDir, realCodexHome } from '../../bin/lib/codex-review-home.mjs';
import { runSessionModel } from '../../bin/lib/codex-review-runs.mjs';
import { quoteWindowsArg, windowsCommandLine } from '../../bin/lib/windows-args.mjs';
import { buildCodexTemplate, removeCodexTemplate, seedCodexHome } from '../codex-home.mjs';
import { allocatePort as allocateTrialPort, killByPort, releasePort as releaseTrialPort } from '../ports.mjs';
import { scoreFindings } from './score.mjs';
import { buildSeededRepo, gitEnv, SEEDED_DIR } from './seeded.mjs';

export const READING_SCHEMA = 'js-harness.review-reading/v1';

// The longest body of a finding a reading keeps: enough to tell what the finding says, in a file that is
// committed. A longer one is cut, and the reading says at which length (`findingBodyMax`).
export const FINDING_BODY_MAX = 600;

// The folders made beside the repository: the clone of the real range, and the template the copy of the
// Codex home is seeded from (which `../codex-home.mjs` refuses to build inside the user's home).
export const CHECKOUT_NAME = 'codex-review-lean-range';
export const TEMPLATE_NAME = 'codex-review-lean-home-template';

const SEEDED_KEY = JSON.parse(fs.readFileSync(path.join(SEEDED_DIR, 'key.json'), 'utf8'));

/** The configurations, in the order of the report. `session` and `prompt` are `codex-review`'s; `effort` is
 * the lean session's (`null` under `current`, whose effort is the user's configuration's); `doc` is whether
 * the review is given the range's feature document; `codegraph`, whether the CodeGraph MCP server of the
 * user's configuration is added; `only`, the ranges it runs on when not all. */
export const CONFIGS = [
  { name: 'current', session: 'current', prompt: 'codex', effort: null, doc: false, codegraph: false, only: null, what: 'the current session, the default while the cells were read: the user\'s whole Codex configuration, measured in a copy of his Codex home' },
  { name: 'lean', session: 'lean', prompt: 'codex', effort: LEAN_EFFORT, doc: false, codegraph: false, only: null, what: 'the lean session, asked with the sentence Codex writes for `--base`' },
  { name: 'lean-own', session: 'lean', prompt: 'own', effort: LEAN_EFFORT, doc: true, codegraph: false, only: null, what: 'the lean session, asked with this harness\'s own prompt and the range\'s feature document' },
  { name: 'lean-high', session: 'lean', prompt: 'codex', effort: 'high', doc: false, codegraph: false, only: null, what: 'the lean session at high effort' },
  { name: 'lean-codegraph', session: 'lean', prompt: 'codex', effort: LEAN_EFFORT, doc: false, codegraph: true, only: ['real'], what: 'the lean session with the CodeGraph MCP server of the user\'s configuration' },
];

/** The ranges. `base` and `head` are full commit ids, `doc` the feature document of the range, from the
 * root of its tree. `seeded` says how the tree is made: built by `./seeded.mjs`, else cloned from this
 * repository. */
export const RANGES = [
  {
    name: 'real',
    base: '338386a6de63e4a47ef0515ceb6fda5f99846df8',
    head: 'e3aad4802d4604fbc4976e2ad5c4a40e2f5de42e',
    doc: 'odd/tasks/codex-review-lean.md',
    seeded: false,
    what: 'this repository, 255 changed lines with no known defect',
  },
  { name: 'seeded', base: SEEDED_KEY.base, head: SEEDED_KEY.head, doc: 'odd/tasks/stocktake.md', seeded: true, what: 'the repository of evals/review/seeded.mjs, wrong in seven known places' },
];

/** Every cell, `{ config, range }` by name: each configuration over each range it runs on. */
export const CELLS = CONFIGS.flatMap((config) => RANGES.filter((range) => config.only === null || config.only.includes(range.name)).map((range) => ({ config: config.name, range: range.name })));

/** What is left out of the matrix, and why. */
export const EXCLUDED = [{ config: 'lean-codegraph', range: 'seeded', why: 'an index means nothing on a toy project' }];

const USAGE =
  'Usage: node evals/review/compare.mjs --list\n' +
  '       node evals/review/compare.mjs --cell <config>:<range> [--force] [--dry-run] [--keep-checkout]\n' +
  `Cells: ${CELLS.map(({ config, range }) => `${config}:${range}`).join(', ')}.\n` +
  'One cell an invocation: each is one Codex review, a call to the model. --dry-run prints what a cell would start and starts nothing.';

/** The file of a cell's reading in `readingsDir`. */
export function readingFile(readingsDir, config, range) {
  return path.join(readingsDir, `${config}__${range}.json`);
}

/** The reading of a cell: `{ ok: true, reading }`, or `{ ok: false, missing, why }` when there is none:
 * `missing` is whether no file is there at all, and `why` says what is wrong with one that is (it cannot be
 * read, is not JSON, has another schema, or is the reading of another cell). */
export function readReading(readingsDir, config, range) {
  const file = readingFile(readingsDir, config, range);
  const name = path.basename(file);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, missing: true, why: 'no reading' };
    return { ok: false, missing: false, why: `${name} cannot be read (${err.code ?? err.message}), so it is not a reading` };
  }
  let reading;
  try {
    reading = JSON.parse(text);
  } catch {
    return { ok: false, missing: false, why: `${name} is not JSON, so it is not a reading` };
  }
  const not = (what) => ({ ok: false, missing: false, why: `${name} ${what}, so it is not a reading of this cell` });
  if (reading === null || typeof reading !== 'object' || Array.isArray(reading)) return not('holds no object');
  if (reading.schema !== READING_SCHEMA) return not(`has the schema ${JSON.stringify(reading.schema)} and not ${READING_SCHEMA}`);
  if (reading.config !== config || reading.range?.name !== range) return not(`is the reading of ${reading.config}:${reading.range?.name}`);
  if (typeof reading.outcome !== 'string') return not('names no outcome');
  return { ok: true, reading };
}

// ---- the user's config.toml, read as text ----------------------------------------------------------------

const BARE_KEY = /^[A-Za-z0-9_-]+$/;
const KEY_PART = /\s*(?:([A-Za-z0-9_-]+)|"((?:[^"\\]|\\.)*)"|'([^']*)')\s*/y;

/** The dotted TOML key of `line` that starts at `from` (`a.b`, `a."b"`), as `{ parts, end }` with `end` the
 * index after it, or `null` when none that can be read starts there. A quoted part is taken as written
 * between its quotes: a name with an escape in it is not one this reader looks for. */
function dottedKey(line, from) {
  const parts = [];
  let index = from;
  for (;;) {
    KEY_PART.lastIndex = index;
    const part = KEY_PART.exec(line);
    if (!part) return null;
    parts.push(part[1] ?? part[2] ?? part[3]);
    index = KEY_PART.lastIndex;
    if (line[index] !== '.') return { parts, end: index };
    index += 1;
  }
}

/** The TOML value `rest` starts with, as the file writes it and without the comment after it, or `null`
 * when it does not end on its line for certain (an open string or bracket, a multi-line string). Strings
 * are read first, so a `#` or a bracket inside one is neither a comment nor a bracket. */
function valueOnItsLine(rest) {
  if (/"""|'''/.test(rest)) return null;
  let value = '';
  let bare = '';
  for (const [piece] of rest.matchAll(/"(?:[^"\\]|\\.)*"|'[^']*'|#.*|["']|[^"'#]+/g)) {
    if (piece.startsWith('#')) break;
    if (piece === '"' || piece === '\'') return null;
    value += piece;
    if (!/^["']/.test(piece)) bare += piece;
  }
  if (value.trim() === '') return null;
  const paired = (open, close) => bare.split(open).length === bare.split(close).length;
  return paired('[', ']') && paired('{', '}') ? value.trim() : null;
}

/** The keys of a `config.toml`, line by line: `{ table, key, value }` for a `key = value` line, with the
 * table it is in and its value as written (`null` when the value does not end on its line), and
 * `{ table, unread: <line> }` for a line that is neither a key, a table header, a comment nor blank. It
 * reads and never edits, so what it cannot read is handed on for the caller to mind or not. */
function* tomlKeys(toml) {
  let table = [];
  for (const line of String(toml).split(/\r?\n/)) {
    const text = line.trim();
    if (text === '' || text.startsWith('#')) continue;
    if (text.startsWith('[')) {
      const open = text.startsWith('[[') ? 2 : 1;
      const header = dottedKey(text, open);
      if (header && text.startsWith(']'.repeat(open), header.end)) table = header.parts;
      else yield { table, unread: text };
      continue;
    }
    const key = dottedKey(text, 0);
    if (!key || text[key.end] !== '=') yield { table, unread: text };
    else yield { table, key: key.parts, value: valueOnItsLine(text.slice(key.end + 1)) };
  }
}

const CODEGRAPH_SERVER = ['mcp_servers', 'codegraph'];
const startsWith = (list, prefix) => prefix.every((part, index) => list[index] === part);
const spelled = (parts) => parts.map((part) => (BARE_KEY.test(part) ? part : JSON.stringify(part))).join('.');

/** The CodeGraph MCP server of the `config.toml` text `toml`, as the settings `codex -c` takes: one
 * `mcp_servers.codegraph.<key>=<value>` for each key of its table and of the tables under it, the value as
 * the file writes it (`-c` reads a value as TOML). The lean session ignores the user's configuration, so
 * this is how one server of it is handed over, and no other.
 *
 * Throws when the text declares no such server, and when a line of its table cannot be read for certain (a
 * value over several lines): a server passed on half would be measured as if it were whole. */
export function codegraphSettings(toml) {
  const settings = [];
  const unreadable = (line) => new Error(`The [mcp_servers.codegraph] table holds a line this reader cannot hand over, since its value does not end on one line: ${line}`);
  for (const { table, key, value, unread } of tomlKeys(toml)) {
    if (unread !== undefined) {
      if (startsWith(table, CODEGRAPH_SERVER)) throw unreadable(unread);
      continue;
    }
    const full = [...table, ...key];
    if (!startsWith(full, CODEGRAPH_SERVER)) continue;
    if (value === null) throw unreadable(spelled(full));
    settings.push(`${spelled(full)}=${value}`);
  }
  if (settings.length === 0) throw new Error('it declares no CodeGraph MCP server: there is no [mcp_servers.codegraph] table in it');
  return settings;
}

/** The text of a TOML string `value` as written (`"gpt"` or `'gpt'`), or `null` for anything else. */
function tomlString(value) {
  if (typeof value !== 'string') return null;
  if (/^'[^']*'$/.test(value)) return value.slice(1, -1);
  if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null; // an escape TOML has and JSON has not
  }
}

/** The `model` and the `model_reasoning_effort` the top of the `config.toml` text `toml` names, each `null`
 * when it names none: what the `current` session is asked to run on. Not what it ran on, which only the
 * session's own rollout file says (`buildReading`): Codex may run the review's sub-agent on another model.
 * A profile or a flag could name another; no cell passes either. */
export function configuredModel(toml) {
  const top = { model: null, model_reasoning_effort: null };
  for (const { table, key, value } of tomlKeys(toml)) {
    if (table.length === 0 && key?.length === 1 && Object.hasOwn(top, key[0])) top[key[0]] = tomlString(value);
  }
  return { model: top.model, effort: top.model_reasoning_effort };
}

// ---- the reading ---------------------------------------------------------------------------------------

const isCount = (value) => Number.isFinite(value) && value >= 0;

/** `body` cut to `FINDING_BODY_MAX` characters, the last of them `…`, and never between the two code units
 * of one character. */
function cut(body) {
  const text = String(body ?? '');
  if (text.length <= FINDING_BODY_MAX) return text;
  let kept = text.slice(0, FINDING_BODY_MAX - 1);
  const last = kept.charCodeAt(kept.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) kept = kept.slice(0, -1);
  return `${kept}…`;
}

/** The reading of one cell, from what `codexReviewMain` handed over for each attempt it launched
 * (`results`, each `{ run, review }`: the run line and the answer as data), or `null` when it launched
 * none: a review that never started measured nothing.
 *
 * A range reviewed in parts is several attempts and one reading. What they spent is added up, and a count
 * one of them did not report makes the sum `null`: not known, never the sum of the rest. The findings are
 * those of all the parts, `null` when the answer of any attempt could not be read, which is not a review
 * that found nothing. `outcome` and `reason` are those of the last attempt, the one that ended the run:
 * `reviewed`, or how it fell short. A reading is kept whatever the outcome, and says it.
 *
 * `config` and `range` are the cell's, from the matrix. `key`, for the seeded range, is the answer key the
 * findings are scored against (`./score.mjs`): `found` and `missed` by defect id, how many findings were
 * `extra`, and the `recall`.
 *
 * `model` and `effort` are what the session ran with, and `modelSource` says where that was read, which is
 * how far it can be trusted:
 *  - `session`: from the session's own rollout file, through its run line (`runSessionModel`). The one
 *    source that is a measurement. The reading then keeps beside it, as `configuredModel` and
 *    `configuredEffort`, what was asked for (the next two sources, in that order; `null` when neither names
 *    one), whether or not it is the same, so that a session that ran another model than the one asked for
 *    is seen in the file and one that ran the same is not merely assumed to have.
 *  - `command`: what the command passed, which the lean session's does. What was asked for, not what ran.
 *  - `config.toml`: what the user's configuration names (`configured`, read by the caller), for a session
 *    whose command names none. A guess: Codex may run the review's sub-agent on another model.
 *  - `null`: none of them names a model or an effort.
 * A reading that is not `session` has no `configuredModel` and no `configuredEffort`: its `model` and
 * `effort` are already those, and it has the fields every reading had before the session's model was read.
 * For a range in parts the model is that of the last attempt, as the outcome is. */
export function buildReading({ config, range, results, recordedAt, key = null, configured = null }) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const runs = results.map((result) => result.run);
  const last = runs.at(-1);
  const sum = (pick) => runs.reduce((total, run) => (total === null || !isCount(pick(run)) ? null : total + pick(run)), 0);
  const reviews = results.map((result) => result.review ?? null);
  const answered = reviews.every((review) => review !== null);
  const findings = answered ? reviews.flatMap((review) => review.findings.map((finding) => ({ ...finding, body: cut(finding.body) }))) : null;
  // What was asked for: by the command when it names a model, else by the user's configuration.
  const named = typeof last.model === 'string';
  const asked = named ? { model: last.model, effort: last.effort ?? null } : { model: configured?.model ?? null, effort: configured?.effort ?? null };
  const askedSource = named ? 'command' : asked.model !== null || asked.effort !== null ? 'config.toml' : null;
  // What ran, when the session's own file said it; else what was asked for stands in, and is said to.
  const ran = runSessionModel(last);
  const { model, effort } = ran ?? asked;
  const score = () => {
    if (findings === null) return null;
    const { found, missed, counts, recall } = scoreFindings(findings, key);
    return { defects: counts.defects, found: found.map(({ id }) => id), missed: missed.map(({ id }) => id), extra: counts.extra, recall };
  };
  return {
    schema: READING_SCHEMA,
    config: config.name,
    range: { name: range.name, base: range.base, head: range.head },
    recordedAt,
    cli: last.cli ?? null,
    session: last.session ?? null,
    model,
    effort,
    modelSource: ran ? 'session' : askedSource,
    ...(ran ? { configuredModel: asked.model, configuredEffort: asked.effort } : {}),
    prompt: last.prompt ?? null,
    promptVersion: last.promptVersion ?? null,
    outcome: last.outcome,
    reason: last.reason ?? null,
    usage: Object.fromEntries(['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningOutputTokens'].map((name) => [name, sum((run) => run.usage?.[name])])),
    requests: sum((run) => run.requests),
    firstRequestInputTokens: runs[0].firstRequestInputTokens ?? null,
    durationMs: sum((run) => run.durationMs),
    coverage: { seen: sum((run) => run.coverage?.seen), total: sum((run) => run.coverage?.total) },
    parts: last.part?.of ?? 1,
    findings,
    findingBodyMax: FINDING_BODY_MAX,
    verdict: answered ? (reviews.some((review) => review.verdict === 'incorrect') ? 'incorrect' : 'correct') : null,
    ...(key === null ? {} : { score: score() }),
  };
}

// ---- the checkout of a range ---------------------------------------------------------------------------

// The file that says a clone is this tool's, inside its `.git`, where a checkout cannot reach it.
const MARKER = 'js-harness-review-range.json';
const TOOL = 'evals/review/compare.mjs';

const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

/** Whether the folder `dir` is a clone this tool made: its `.git` holds the marker, written by this tool. */
function isOurClone(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, '.git', MARKER), 'utf8'))?.tool === TOOL;
  } catch {
    return false;
  }
}

/** Clones `repoRoot` into `dir`, detached at the head of `range`, and returns `dir`. A clone this tool left
 * there is replaced; anything else at `dir` is refused and left as it is. A clone that cannot be brought
 * to the range (the repository does not hold its commits) is removed again. Git runs with no configuration
 * but the clone's own (`gitEnv`), so nothing of the user's changes what is checked out. */
function cloneRange({ spawn, env, repoRoot, dir, range }) {
  if (fs.lstatSync(dir, { throwIfNoEntry: false })) {
    if (!isOurClone(dir)) throw new Error(`${dir} is there and is not a clone this tool made, so it is left as it is: move it away or delete it, then run the cell again.`);
    removeDir(dir);
  }
  const git = (cwd, args) => {
    const ran = spawn('git', args, { cwd, env: gitEnv(env), encoding: 'utf8' });
    if (ran.error || ran.status !== 0) throw new Error(`git ${args.join(' ')} failed (${ran.error?.message ?? String(ran.stderr).trim()})`);
    return String(ran.stdout).trim();
  };
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(path.dirname(dir), ['clone', '--quiet', '--no-checkout', repoRoot, dir]);
  try {
    // First, so that a clone a later step leaves behind is still one this tool may replace.
    fs.writeFileSync(path.join(dir, '.git', MARKER), `${JSON.stringify({ tool: TOOL, range: range.name, base: range.base, head: range.head }, null, 2)}\n`, 'utf8');
    for (const commit of [range.base, range.head]) {
      const there = spawn('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: dir, env: gitEnv(env), encoding: 'utf8' });
      if (there.error || there.status !== 0) throw new Error(`The repository ${repoRoot} does not hold the commit ${commit.slice(0, 12)} of the ${range.name} range, so there is nothing to review.`);
    }
    git(dir, ['checkout', '--quiet', '--detach', range.head]);
    if (git(dir, ['rev-parse', 'HEAD']) !== range.head) throw new Error(`The clone ${dir} is not at ${range.head.slice(0, 12)} after the checkout.`);
  } catch (err) {
    removeDir(dir);
    throw err;
  }
  return dir;
}

/** Builds the seeded repository in a new folder under `tmpdir` and returns that folder. The two commits
 * must be the ones the key was written for: a reading scored against a key of other lines says nothing. */
function buildSeeded({ spawn, env, tmpdir, range }) {
  const dir = fs.mkdtempSync(path.join(tmpdir, 'codex-review-seeded-'));
  try {
    const built = buildSeededRepo(dir, { spawn, env });
    if (built.base !== range.base || built.head !== range.head) {
      throw new Error(`The seeded repository was built as ${built.base.slice(0, 12)}..${built.head.slice(0, 12)}, and its key names ${range.base.slice(0, 12)}..${range.head.slice(0, 12)}.`);
    }
  } catch (err) {
    removeDir(dir);
    throw err;
  }
  return dir;
}

// How long the index of a checkout may take to build: a clone of this repository, once.
const INDEX_TIMEOUT_MS = 10 * 60 * 1000;

/** Builds the CodeGraph index of `checkout` when it holds none, with the command that initializes one for
 * a project root. `gentle-ai` may be a shim on Windows, so it is started as Codex is, through a shell. */
function ensureIndex({ spawn, env, platform, checkout, log }) {
  if (fs.existsSync(path.join(checkout, '.codegraph'))) return;
  const args = ['codegraph', 'init', '--cwd', checkout];
  const options = { cwd: checkout, env, encoding: 'utf8', timeout: INDEX_TIMEOUT_MS, windowsHide: true };
  log(`Building the CodeGraph index of ${checkout}: gentle-ai ${args.join(' ')}`);
  const ran = platform === 'win32' ? spawn(windowsCommandLine('gentle-ai', args), [], { ...options, shell: true }) : spawn('gentle-ai', args, options);
  if (ran?.error || ran?.status !== 0) {
    const said = String(ran?.stderr ?? '').trim().split(/\r?\n/)[0];
    const how = ran?.error ? `could not be run (${ran.error.message})` : `exited ${ran?.status ?? `on ${ran?.signal ?? 'no status'}`}`;
    throw new Error(`\`gentle-ai ${args.join(' ')}\` ${how}${said ? `: ${said}` : ''}. The cell measures a review with an index, so it is not run without one.`);
  }
}

// ---- the command ---------------------------------------------------------------------------------------

class ArgError extends Error {}

/** Parses `argv` against the cells of `ranges`: `{ list: true }`, or `{ config, range, force, dryRun,
 * keepCheckout }` with the configuration and the range of the one cell. */
function parseArgs(argv, ranges) {
  const cells = [];
  const flags = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cell') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new ArgError('--cell requires a value, `<config>:<range>`');
      cells.push(value);
      i += 1;
    } else if (['--list', '--force', '--dry-run', '--keep-checkout'].includes(arg)) flags.add(arg);
    else throw new ArgError(`Unknown argument ${JSON.stringify(arg)}`);
  }
  if (flags.has('--list')) {
    if (cells.length > 0 || flags.size > 1) throw new ArgError('--list takes nothing else');
    return { list: true };
  }
  if (cells.length === 0) throw new ArgError('--list or one --cell is required');
  if (cells.length > 1) throw new ArgError('Exactly one --cell an invocation: each cell is one Codex review, and they are run one at a time');
  const [configName, rangeName, ...more] = cells[0].split(':');
  const left = EXCLUDED.find((cell) => cell.config === configName && cell.range === rangeName);
  if (left && more.length === 0) throw new ArgError(`${cells[0]} is not a cell: ${left.why}`);
  const config = CONFIGS.find((one) => one.name === configName);
  const range = ranges.find((one) => one.name === rangeName);
  if (more.length > 0 || !config || !range || !CELLS.some((cell) => cell.config === configName && cell.range === rangeName)) throw new ArgError(`${JSON.stringify(cells[0])} is not a cell of the comparison`);
  return { config, range, force: flags.has('--force'), dryRun: flags.has('--dry-run'), keepCheckout: flags.has('--keep-checkout') };
}

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** Runs the command and returns its exit code: 0 when the reading of the cell was written, whatever the
 * review came to (and for `--list` and a dry run); 1 when it could not be, the review that was never
 * launched included; 2 with the usage on a bad command line.
 *
 * `deps` (all optional) injects `log` and `error`; `env`, `platform` and `homedir`, as `codexReviewMain`
 * takes them; `spawn`, the synchronous one (git, `gentle-ai`, and the review's own git and probe);
 * `review`, more `deps` for `codexReviewMain` (its `spawnAsync`, for one); `repoRoot`, the repository the
 * real range is cloned from; `checkoutParent`, where the clone and the template of the home go;
 * `tmpdir`, where the seeded repository is built; `readingsDir`; `ranges`, in place of `RANGES`;
 * `configToml`, the user's Codex configuration, in place of the one in his Codex home; `now`; and
 * `allocatePort`, `releasePort` and `killPort`, the engram port of a measured `current` session
 * (`../ports.mjs`). */
export async function compareMain(argv = process.argv.slice(2), deps = {}) {
  const { log = console.log, error = console.error, env = process.env, platform = process.platform, homedir = os.homedir, spawn = spawnSync, now = () => new Date() } = deps;
  const { repoRoot = REPO_ROOT, tmpdir = os.tmpdir(), ranges = RANGES } = deps;
  const { allocatePort = allocateTrialPort, releasePort = releaseTrialPort, killPort = killByPort } = deps;
  const checkoutParent = deps.checkoutParent ?? path.dirname(repoRoot);
  const readingsDir = deps.readingsDir ?? path.join(repoRoot, 'evals', 'results', 'review', 'readings');
  let args;
  try {
    args = parseArgs(argv, ranges);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  if (args.list) {
    log(`The comparison: ${CONFIGS.length} configurations over ${ranges.length} ranges, ${CELLS.length} cells, one Codex review a cell.`);
    const width = Math.max(...CELLS.map(({ config, range }) => config.length + range.length + 1)) + 2;
    let recorded = 0;
    for (const { config, range } of CELLS) {
      const read = readReading(readingsDir, config, range);
      const name = `${config}:${range}`.padEnd(width);
      if (read.ok) {
        recorded += 1;
        log(`${name}recorded  ${read.reading.outcome}  ${read.reading.recordedAt}  codex-cli ${read.reading.cli}`);
      } else log(`${name}missing${read.missing ? '' : ` (${read.why})`}`);
    }
    log(`${recorded} of ${CELLS.length} cells are recorded.`);
    for (const { config, range, why } of EXCLUDED) log(`Not a cell: ${config}:${range} (${why}).`);
    return 0;
  }

  const { config, range } = args;
  const cell = `${config.name}:${range.name}`;
  const file = readingFile(readingsDir, config.name, range.name);
  const recorded = readReading(readingsDir, config.name, range.name).ok;
  const codexHome = realCodexHome(env, homedir(), platform);
  const configToml = deps.configToml ?? path.join(codexHome, 'config.toml');
  const clone = path.join(checkoutParent, CHECKOUT_NAME);
  const templateDir = path.join(checkoutParent, TEMPLATE_NAME);
  // As `codexReviewMain` finds it: the state dir the home of a run is made in.
  const homes = leanHomesDir(path.resolve(env.JS_HARNESS_HOME || homedir()));

  // The CodeGraph server, read before anything is made: a configuration that names none is a cell that
  // cannot run, and a dry run says so too.
  let extraConfig = [];
  if (config.codegraph) {
    try {
      let toml;
      try {
        toml = fs.readFileSync(configToml, 'utf8');
      } catch (err) {
        throw new Error(`it cannot be read (${err.code ?? err.message})`);
      }
      extraConfig = codegraphSettings(toml);
      // On Windows Codex is started through cmd.exe, which acts on some characters whatever the quoting.
      if (platform === 'win32') extraConfig.forEach((setting) => quoteWindowsArg(setting));
    } catch (err) {
      error(`Cell ${cell} cannot run. The CodeGraph server is taken from ${configToml}: ${err.message}.`);
      return 1;
    }
  }

  /** What `codex-review` is called with for the tree at `checkout`, and what Codex is launched with: the
   * one place both a dry run and a real one take them from. The session is always named, `current` too:
   * left out, it would be whichever one the command runs by default, and the `current` cell would then
   * measure the lean session with the seam of the measured one ignored. */
  const reviewOf = (checkout) => ({
    command: ['--base', range.base, '--session', config.session, ...(config.prompt === 'own' ? ['--prompt', 'own', '--doc', range.doc] : []), '--cwd', checkout],
    codexArgv: codexArgs(range.base, config.session, platform, config.prompt, { effort: config.effort ?? LEAN_EFFORT, extraConfig, ephemeral: config.session !== 'current' }),
  });

  if (args.dryRun) {
    const checkout = range.seeded ? path.join(tmpdir, 'codex-review-seeded-*') : clone;
    const { command, codexArgv } = reviewOf(checkout);
    log(`Cell ${cell}, a dry run: nothing is started.`);
    log(`Configuration: ${config.what}.`);
    log(`Range: ${range.name} ${range.base.slice(0, 7)}..${range.head.slice(0, 7)}, ${range.what}.`);
    log(range.seeded
      ? `Checkout: the seeded repository, built by evals/review/seeded.mjs in a new folder, ${checkout}; removed after the cell unless --keep-checkout.`
      : `Checkout: git clone ${repoRoot} ${clone}, then detached at ${range.head}; a clone and not a worktree, so its record and run log stay in its own git folder; removed after the cell unless --keep-checkout.`);
    if (config.codegraph) log(`Index: gentle-ai codegraph init --cwd ${checkout}, when ${path.join(checkout, '.codegraph')} is missing.`);
    if (config.session === 'current') {
      log(
        `Home: a copy of ${codexHome} (config.toml without the desktop app's pieces and with an engram of its own, the global AGENTS.md, hooks, skills, the plugin cache; never auth.json), ` +
          `from a template built at ${templateDir}, in ${path.join(homes, '<run id>', '.codex')}; the login is a hard link to the real auth.json, never a copy; both are removed after the cell.`,
      );
    }
    log(`Command: js-harness codex-review ${command.join(' ')}`);
    log(`Codex argv: ${JSON.stringify(codexArgv)}`);
    log(`Reading: ${file} (${recorded ? 'recorded: --force replaces it' : 'missing'})`);
    return 0;
  }

  if (recorded && !args.force) {
    error(`Cell ${cell} is already recorded in ${file}; --force runs it again and replaces that reading.`);
    return 1;
  }

  let checkout = null;
  let template = false;
  let port = null;
  let reading = null;
  let exit = null;
  const results = [];
  try {
    checkout = range.seeded ? buildSeeded({ spawn, env, tmpdir, range }) : cloneRange({ spawn, env, repoRoot, dir: clone, range });
    if (config.codegraph) ensureIndex({ spawn, env, platform, checkout, log });
    const reviewDeps = { spawn, log, error, platform, homedir, now, ...deps.review, onResult: (result) => results.push(result) };
    let configured = null;
    if (config.session === 'lean') Object.assign(reviewDeps, { effort: config.effort, extraCodexConfig: extraConfig });
    else {
      // The copy is made from a home directory with `.codex` in it, which is what the template reads.
      if (path.basename(codexHome) !== '.codex') throw new Error(`The Codex home ${codexHome} is not a \`.codex\` folder, and the copy the current session is measured in is made from one (evals/codex-home.mjs).`);
      try {
        configured = configuredModel(fs.readFileSync(configToml, 'utf8'));
      } catch {
        // No configuration to read: the model the session runs on is then not known, and the reading says so.
      }
      port = await allocatePort();
      // What a killed run left; a folder that is not a template is refused, and left alone.
      removeCodexTemplate(templateDir);
      const built = buildCodexTemplate({ realHome: path.dirname(codexHome), templateDir });
      template = true;
      log(`The copy of ${codexHome}: ${built.files} files, ${built.bytes} bytes, from the template ${templateDir}.`);
      for (const warning of built.warnings) log(`  note: ${warning}`);
      const engramPort = port;
      reviewDeps.measuredCurrent = {
        // The engram of the copy is the run's own: its store is in the run's folder and its port is free, so
        // neither the MCP server nor a hook of the copied configuration reaches the real one.
        seed: ({ folder }) => {
          seedCodexHome(templateDir, folder, { engramPort });
          return {
            env: { ENGRAM_PORT: String(engramPort), ENGRAM_DATA_DIR: path.join(folder, '.engram'), ENGRAM_URL: null, ENGRAM_SOCKET: null },
            release: () => killPort(engramPort),
          };
        },
      };
    }
    const { command } = reviewOf(checkout);
    log(`Cell ${cell}: js-harness codex-review ${command.join(' ')}`);
    exit = await codexReviewMain(command, env, reviewDeps);
    reading = buildReading({ config, range, results, recordedAt: now().toISOString(), key: range.seeded ? SEEDED_KEY : null, configured });
  } catch (err) {
    error(`Cell ${cell} could not be run: ${err.message}`);
    return 1;
  } finally {
    // Whatever happened: the template holds a copy of the user's configuration, and the port is one of a pool.
    if (template) {
      try {
        removeCodexTemplate(templateDir);
      } catch (err) {
        error(`Warning: the template ${templateDir} could not be removed (${err.message}); delete that folder by hand.`);
      }
    }
    if (port !== null) releasePort(port);
    if (checkout !== null && !args.keepCheckout) {
      try {
        removeDir(checkout);
      } catch (err) {
        error(`Warning: the checkout ${checkout} could not be removed (${err.code ?? err.message}); delete that folder by hand.`);
      }
    }
  }
  if (checkout !== null && args.keepCheckout) log(`The checkout was kept: ${checkout}`);

  if (reading === null) {
    error(`The review of ${cell} was never launched (codex-review exited ${exit}), so it measured nothing and no reading was written.`);
    return 1;
  }
  try {
    fs.mkdirSync(readingsDir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(reading, null, 2)}\n`, 'utf8');
  } catch (err) {
    error(`Could not write the reading of ${cell} to ${file}: ${err.message}`);
    return 1;
  }
  log(`Recorded ${cell} (${reading.outcome}${reading.reason ? `: ${reading.reason}` : ''}) in ${file}.`);
  return 0;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = await compareMain(process.argv.slice(2));
}
