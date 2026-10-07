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
// Codex runs in one of two sessions, chosen with `--session`. `current`, the default, is the review
// as it has run so far: the user's whole Codex config, with a read-only sandbox and two desktop plugins
// off. `lean` ignores that config and its rules, disables plugins, apps and hooks, sets the model and
// the effort itself (`LEAN_MODEL`, `LEAN_EFFORT`), and runs in a Codex home of its own, because that is
// the only way to leave the user's global `AGENTS.md` out. `lean` lives beside `current` until a
// comparison of the two decides the default (odd/tasks/codex-review-lean.md).
//
// The lean session's home is a folder made for the one run, `<home>/.js-harness/codex-review-homes/<run
// id>/`, handed to Codex as `CODEX_HOME` and removed when the run ends, however it ends. It is made with
// one thing in it: the login, as a hard link to the real `auth.json`, never a copy, so a refresh of the
// login inside the review is a refresh of the real one (`bin/lib/codex-review-home.mjs` has the reasons and
// how to undo it). `<home>` is `--home`, else `JS_HARNESS_HOME`, else the OS home, an empty one counting as
// unset; the real Codex home is `CODEX_HOME`, else `.codex` under the OS home. `current` makes no folder
// and sets no `CODEX_HOME`. `--keep-home`, for the lean session alone, leaves the folder after the run
// without the login and prints its path, so a person can read what the session wrote there.
//
// What a review spent is read from that home. `codex exec review --json` reports a `usage` of zeros,
// whatever the review spent (see `rolloutReading` in `bin/lib/codex-usage.mjs`), and the tokens are on disk
// only for a session that is not `--ephemeral`, in the rollout files of its home. So the lean session is
// not ephemeral, and its rollout files are read after Codex ends and before the home goes. The `current`
// session is ephemeral in the user's own home, which this command never reads: its tokens are not known,
// and the run line says so with `null`, never with a zero.
//
// What a review answered is read from that home too. Codex's rubric makes the review end with its findings
// as JSON, which `--json` prints only rendered as text; the JSON is the last message in the rollout file of
// the review's sub-agent (`bin/lib/codex-review-answer.mjs`). Under the lean session it is read, checked
// against a schema, printed as one line per finding and counted in the run line. A lean review whose answer
// cannot be read that way is a failed attempt, and no review is recorded. The `current` session has no such
// file, so it is as it was: the rendered text passed through, and no findings as data.
//
// What a review is asked is chosen with `--prompt`, for the lean session alone. `codex`, the default, is
// `--base <merge-base>` with the sentence Codex writes itself. `own` is this command's prompt
// (`bin/lib/codex-review-prompt.mjs`): it names the committed range and the command that shows it, and with
// `--doc <feature document>` carries that document's Goal and Done when, to judge the change against.
// `--base` and a prompt exclude each other on Codex's command line, so under `own` there is no `--base`
// there, and the prompt goes in on stdin (`-`): it has newlines, and may hold quotes, `%` and `&`, none of
// which the one command line `cmd.exe` runs on Windows can carry. Codex's rubric applies under either, so
// the answer is read the same way; which prompt becomes the default is decided by a comparison.
//
// Two files are written, both in `<git common dir>/js-harness/`. `codex-reviews.jsonl` is the record
// above: a line for a review that met the evidence rule, or for an explicit skip. `codex-review-runs.jsonl`
// is the run log: a line for EVERY attempt that launched Codex, also the ones that failed, timed out or
// were interrupted, with its outcome, the range, the session, the codex-cli version, the wall time, what
// the rollout files say it spent (tokens, requests, threads), what Codex's events say it did (turns,
// items by type, commands), the prompt it was asked with and, when its answer was read, the findings by
// severity and the verdict. A reviewed record names its run line by id; a run line is a measurement and
// never evidence of a review, so `check --push` does not read it.
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { randomUUID as newUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { findingCounts, normalizeAnswer, REVIEW_ANSWER_SCHEMA_VERSION, rolloutAnswer } from './lib/codex-review-answer.mjs';
import { createLeanHome as makeLeanHome, leanHomesDir, realCodexHome, sweepStaleLeanHomes } from './lib/codex-review-home.mjs';
import { IntentError, REVIEW_PROMPT_VERSION, reviewIntent, reviewPrompt } from './lib/codex-review-prompt.mjs';
import { appendCodexReviewRun, CODEX_REVIEW_RUN_SCHEMA } from './lib/codex-review-runs.mjs';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './lib/codex-reviews.mjs';
import { noRolloutReading, rolloutReading, sessionReading } from './lib/codex-usage.mjs';
import { killTree } from './lib/process-tree.mjs';
import { quoteWindowsArg, windowsCommandLine } from './lib/windows-args.mjs';

// `--home` is where the harness keeps its machine state (`<home>/.js-harness/`), as in the other
// commands: `--home`, else `JS_HARNESS_HOME`, else the OS home. Only the lean session keeps anything
// there, the Codex home of its run; under `current` the flag is read and nothing uses it. `--keep-home`
// leaves that home after the run, so it needs the session that has one. `--prompt own` and its `--doc`
// are configurations of the lean session too: `--doc` is a path, taken from `--cwd` when it is relative.
const USAGE =
  'Usage: js-harness codex-review --base <rev> [--session <current|lean>] [--prompt <codex|own>] [--doc <feature document>] [--keep-home] ' +
  '[--unavailable <reason>] [--cwd <path>] [--home <path>]';

// The session configurations Codex can be launched with (see `codexArgs`); the first is the default.
const SESSIONS = ['current', 'lean'];

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
  const session = get('--session') ?? SESSIONS[0];
  if (!SESSIONS.includes(session)) throw new ArgError('--session must be `current` or `lean`');
  const keepHome = argv.includes('--keep-home');
  if (keepHome && session !== 'lean') throw new ArgError('--keep-home needs --session lean: only the lean session has a Codex home of its own to keep');
  const prompt = get('--prompt') ?? PROMPTS[0];
  if (!PROMPTS.includes(prompt)) throw new ArgError('--prompt must be `codex` or `own`');
  if (prompt === 'own' && session !== 'lean') throw new ArgError('--prompt own needs --session lean: this command\'s own prompt is a configuration of the lean session');
  const doc = get('--doc');
  if (doc !== undefined && prompt !== 'own') throw new ArgError('--doc needs --prompt own: only this command\'s own prompt carries the intent of a feature document');
  return { base, unavailable, session, home, keepHome, prompt, doc, cwd: get('--cwd') ?? process.cwd() };
}

const REVIEW_MAX_BUFFER = 64 * 1024 * 1024;

/** Trimmed stdout of a successful `git <args>` run in `cwd` (empty when it printed nothing), else
 * `null`: a failed run and an empty answer are different things. `options` extend the spawn's. */
function git(spawn, cwd, args, options = {}) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8', ...options });
    if (result && !result.error && result.status === 0) return (result.stdout ?? '').trim();
  } catch {
    // No git on PATH: the caller reports it as an unresolvable repository or revision.
  }
  return null;
}

// Read-only sandbox, no approvals: the review reads the repository and nothing else. Both sessions.
const SANDBOX_CONFIG = ['sandbox_mode=read-only', 'approval_policy=never'];

// The `current` session, on top of the user's whole Codex config: the two desktop plugins are off
// because their REPL (`cua_repl`) cannot launch processes, and the model used it instead of the shell
// in 6 of 41 stored reviews, so those never ran `git diff`.
const CURRENT_CONFIG = [
  ...SANDBOX_CONFIG,
  'plugins."unified-computer-use@openai-bundled".enabled=false',
  'plugins."computer-use@openai-bundled".enabled=false',
];

// The model and the effort of the lean session. Sebastián fixed both on 2026-10-06, and the command
// sets them itself instead of taking them from the user's Codex config.
export const LEAN_MODEL = 'gpt-6.1-sol';
export const LEAN_EFFORT = 'medium';

// The Windows sandbox of the lean session. The command's own choice, as the model and the effort are, and
// the one the user's config names: it needs no administrator, no setup step and, for a read-only session,
// no change to the access lists of the workspace or of the home. It writes `cap_sid` and `.sandbox/` into
// `CODEX_HOME`, which is the lean home and goes with it.
const LEAN_WINDOWS_SANDBOX = 'unelevated';

// The `lean` session: what a review needs and nothing else. Why each flag is here, with the lines of
// Codex's source it was read from, is the section "What Codex loads, and what `exec review` accepts
// (T4, 2026-10-06)" of odd/tasks/codex-review-lean.md. It is not `--ephemeral`: its home is thrown away
// after the run, and only a session that is not ephemeral writes there the rollout files the tokens are
// read from.
const leanFlags = (platform) => [
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
  // With the user's config ignored, the command names the model and the effort itself.
  '-m', LEAN_MODEL,
  '-c', `model_reasoning_effort="${LEAN_EFFORT}"`,
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

/** The arguments of the Codex run over `<base>..HEAD`; `base` is a full commit id. `session` is
 * `current`, today's configuration on top of the user's Codex config and the default, or `lean`, the
 * one that loads only what a review needs. `platform` is where Codex runs: the lean list has one more
 * setting on `win32`, and the current one is the same everywhere. The global `AGENTS.md` is in neither
 * list: no flag leaves it out, only a home of the review's own, which `codexReviewMain` sets for `lean`
 * in the environment (`leanEnv`).
 *
 * `prompt` is what the review is asked with. `codex`, the default, is `--base <base>`: Codex writes the
 * sentence itself. `own`, for the lean session alone, is a custom-target review: no `--base`, which Codex
 * refuses beside a prompt, and `-` in its place, so Codex reads the prompt from stdin; `base` is then in
 * that prompt and not in this list. */
export function codexArgs(base, session = 'current', platform = process.platform, prompt = 'codex') {
  if (!PROMPTS.includes(prompt)) throw new Error(`Unknown prompt ${JSON.stringify(prompt)}: it must be \`codex\` or \`own\`.`);
  if (session === 'lean') return ['exec', 'review', '--json', ...leanFlags(platform), ...(prompt === 'own' ? [PROMPT_ON_STDIN] : ['--base', base])];
  if (session !== 'current') throw new Error(`Unknown session ${JSON.stringify(session)}: it must be \`current\` or \`lean\`.`);
  if (prompt !== 'codex') throw new Error('The own prompt is a configuration of the lean session: the current one is asked with Codex\'s sentence.');
  return ['exec', 'review', '--json', '--ephemeral', '--base', base, ...CURRENT_CONFIG.flatMap((setting) => ['-c', setting])];
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
 * `missing` up to five that were not, as `file: line`. `errors` are the failed turn's messages;
 * `warnings` are error items Codex raises without failing (an unrecognized configuration setting, for
 * one). */
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
  return { inspected: completed && review !== '' && covered, completed, review, commands, errors, warnings, coverage, missing };
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

const WAYS_ON = 'Rerun the review, or record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

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
 * of `unknown`: the `current` session is ephemeral, so Codex writes its tokens nowhere, and a `lean` one
 * left no count in its home. */
function spentLine(spent, items, durationMs, lean) {
  const seconds = durationMs === null ? 'unknown' : Math.round(durationMs / 1000);
  const did = Object.entries(items)
    .sort(([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : 1))
    .map(([type, count]) => `${thousands(count)} ${type}`)
    .join(', ') || 'no items';
  if (!tokensKnown(spent)) {
    const why = lean ? 'its Codex home held no token count' : 'an ephemeral review reports none';
    return `Codex ran for ${seconds} s; its tokens are not known for this session (${why}): ${did}.`;
  }
  const { inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens } = spent.usage;
  return (
    `Codex used ${spoken(inputTokens)} input tokens (${spoken(cachedInputTokens)} cached) and ${spoken(outputTokens)} output ` +
    `(${spoken(reasoningOutputTokens)} reasoning) in ${seconds} s over ${spoken(spent.requests)} request${spent.requests === 1 ? '' : 's'}: ${did}.`
  );
}

/** A text on one line: a title or an explanation the model wrapped must not break the line it is printed in. */
const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

/** The answer of a review (`normalizeAnswer`) as lines: one per finding, `file:start-end severity title`
 * (`file:start` for a single line, and `-` for a finding the model gave no priority), then the verdict
 * with its explanation. The body of each finding is not repeated here: it is in the review as Codex
 * rendered it, which is passed through above these lines. */
function answerLines({ findings, verdict, explanation, confidence }) {
  const lines = findings.map(({ file, start, end, severity, title }) => `${file}:${start === end ? start : `${start}-${end}`} ${severity ?? '-'} ${oneLine(title)}`);
  const sure = confidence === null ? '' : ` (confidence ${confidence})`;
  return [...lines, `Codex's verdict: the patch is ${verdict}${sure}. ${oneLine(explanation)}`.trimEnd()];
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
 * `randomUUID` (the id of the run line, and under `lean` the name of its Codex home), `homedir` (the
 * OS home, which the harness's state dir and the real Codex home default to), `createLeanHome` (what
 * makes the lean session's home), `platform`, `log`, `error` and `write` (the review passed through
 * to the user)
 * so tests use fixtures; `env` is the parent environment Codex's is derived from. Exits 2 with usage
 * on a bad flag; 1 when nothing could be recorded or the review did not complete. */
export async function codexReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { spawn = spawnSync, spawnAsync = spawnChild, now = () => new Date(), log = console.log, error = console.error, platform = process.platform } = deps;
  const { timeoutMs = REVIEW_TIMEOUT_MS, maxBuffer = REVIEW_MAX_BUFFER, signals = process, randomUUID = newUUID } = deps;
  const { monotonicNow = () => performance.now(), homedir = os.homedir, createLeanHome = makeLeanHome } = deps;
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
  const base = git(spawn, root, ['rev-parse', '--verify', `${args.base}^{commit}`]);
  if (!base) {
    error(`Cannot resolve --base ${args.base} to a commit in ${root}.`);
    return 1;
  }
  const head = git(spawn, root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head) {
    error(`Cannot resolve HEAD to a commit in ${root}.`);
    return 1;
  }

  let outcome = 'unavailable';
  // The id of the run line of a reviewed attempt, for its record; a skip launches nothing and has none.
  let runId;
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
    const from = git(spawn, root, ['merge-base', base, 'HEAD']);
    if (!from) {
      error(`${base.slice(0, 7)} and HEAD share no history, so there is no range to review; nothing was recorded.`);
      return 1;
    }
    // The patch Codex has to have seen; the buffer holds a large diff, far above Node's 1 MiB default.
    const patch = git(spawn, root, ['diff', '--no-color', '--no-ext-diff', from, 'HEAD'], { maxBuffer: REVIEW_MAX_BUFFER });
    if (patch === null) {
      error(`Could not run \`git diff ${from.slice(0, 7)} HEAD\` to know what the review must see, so it was not started and nothing was recorded.`);
      return 1;
    }
    const expected = patchKeys(patch);
    // The environment of the `--version` probe and of the `current` session, which sets no `CODEX_HOME`
    // and so runs in the user's real Codex home. The lean session adds a `CODEX_HOME` of its own below;
    // the probe only asks for the version, which no home changes, so it runs before that home is made.
    const codexEnv = childEnv(env, platform);
    const cli = codexVersion(spawn, platform, codexEnv);
    if (!cli) {
      error(NO_CODEX);
      return 1;
    }
    const { session } = args;
    const lean = session === 'lean';
    // This command's own prompt, for the range the record will claim: from the merge-base to the commit
    // HEAD is now, both by id, so what the model is told to diff cannot move under it. `undefined` under
    // the default prompt, where Codex writes its sentence from `--base`. Built before anything is made
    // or launched, so a range that cannot be named leaves nothing behind.
    const own = args.prompt === 'own';
    let promptText;
    if (own) {
      try {
        promptText = reviewPrompt({ from, head, intent });
      } catch (err) {
        error(`Could not write the review prompt (${err.message}), so the review was not started and nothing was recorded.`);
        return 1;
      }
    }
    // The lean session's own Codex home, named after the run: the id is made here, before the launch,
    // and the run line reuses it. Until the home exists nothing is launched, so a failure here writes no
    // run line and no record. `current` makes no id yet, no folder, and never asks where the home is.
    let leanHome = null;
    let leanRunId;
    if (lean) {
      try {
        leanRunId = randomUUID();
      } catch (err) {
        error(`Could not make the id of this run, which names the lean session's Codex home (${err.message}), so the review was not started and nothing was recorded.`);
        return 1;
      }
      try {
        // `||`, not `??`: an empty `--home` or `JS_HARNESS_HOME` is unset, and the next source is asked.
        // Resolved as it is, an empty path is the working directory, and the lean home, with its link to
        // the login, would be made there.
        const homes = leanHomesDir(path.resolve(args.home || env.JS_HARNESS_HOME || homedir()));
        // What a killed run left, or a kept one. Twice the timeout: no review that is still running is that old.
        sweepStaleLeanHomes(homes, { olderThanMs: 2 * timeoutMs, now: now().getTime() });
        leanHome = createLeanHome({ realHome: realCodexHome(env, homedir(), platform), parent: homes, id: leanRunId });
      } catch (err) {
        error(`${err.message}\nThe lean review was not started and nothing was recorded.`);
        return 1;
      }
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
    // rust-v0.160.0). The counts are in the rollout files of the session's home, read below for `lean`.
    // `current` is ephemeral, which writes none, in the user's own home, which this command never reads:
    // nothing is known of it, and that stays `null`.
    let spent = noRolloutReading();
    // What the review answered, as `rolloutAnswer` gives it, from the same rollout files and so for `lean`
    // alone; `null` under `current`, where no answer is read and none is asked for.
    let answered = null;
    try {
      const how = lean ? ` with the lean session (${LEAN_MODEL}, ${LEAN_EFFORT})${own ? ' and this command\'s own prompt' : ''}` : '';
      log(`Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)}${how}; this can take several minutes.`);
      startedAt = now();
      launchedAt = readClock(monotonicNow);
      // stdin is ignored under the default prompt (Codex would wait to read it) and carries the prompt
      // under the own one; stdout carries the JSONL, stderr (the progress) stays live.
      result = await runReview(spawnAsync, kill, platform, codexArgs(from, session, platform, args.prompt), {
        cwd: root,
        stdio: [own ? 'pipe' : 'ignore', 'pipe', 'inherit'],
        env: leanHome ? leanEnv(codexEnv, leanHome.home, platform) : codexEnv,
      }, { timeoutMs, maxBuffer, onLine: (line) => progressLine(line, log), signals, input: promptText });
      endedAt = readClock(monotonicNow);
    } finally {
      // The lean home goes on every way out, whatever the review came to: Codex has ended or was
      // killed. Its rollout files are read first, since they go with it: what the session spent, and what
      // the review answered. What could not be cleaned is a warning and never changes how the attempt ends.
      if (leanHome) {
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
    }
    const durationMs = elapsedMs(launchedAt, endedAt);
    const events = parseEvents(result.stdout);
    const evidence = reviewEvidence(events, expected);
    // The turns, the items and the commands of the session. Its `usage` is left out on purpose: see `spent`.
    const reading = sessionReading(events);
    // The answer as this command keeps it, when there is one that is valid: under `lean` alone. It is kept
    // in the run line whatever the attempt comes to, as what it spent is: a measurement.
    const review = answered?.ok ? normalizeAnswer(answered.answer, { root, platform }) : null;
    /** Appends this attempt's line to the run log and returns its id, or `undefined` when the line
     * could not be built or written: the measurement is lost and said so, and the attempt ends as it
     * would. Building the line is inside the `try` for that reason: its id and its date come from
     * injected sources, and neither may change how a review ends. */
    const logRun = (runOutcome, reason) => {
      try {
        const run = {
          schema: CODEX_REVIEW_RUN_SCHEMA,
          // The lean session made its id before the launch, to name its home; `current` makes it here.
          id: leanRunId ?? randomUUID(),
          startedAt: startedAt.toISOString(),
          durationMs,
          base,
          from,
          head,
          outcome: runOutcome,
          ...(reason === undefined ? {} : { reason }),
          cli,
          session,
          // Under `lean` the command sets both, so they are known. Under `current` the user's Codex
          // config sets them and Codex's events do not name them, so they are `null`, not a guess.
          model: lean ? LEAN_MODEL : null,
          effort: lean ? LEAN_EFFORT : null,
          // What the review was asked with, and the version of the text when it is this command's own.
          prompt: args.prompt,
          promptVersion: own ? REVIEW_PROMPT_VERSION : null,
          // The four counts, each `null` when it is not known, and where they were read from: `rollout`,
          // or `null` when none was. A line written before `usageSource` existed took its `usage` from
          // Codex's events (`bin/lib/codex-review-runs.mjs`).
          usage: spent.usage,
          usageSource: tokensKnown(spent) ? 'rollout' : null,
          requests: spent.requests,
          firstRequestInputTokens: spent.firstRequestInputTokens,
          threads: spent.threads,
          turns: reading.turns,
          items: reading.items,
          commands: reading.commands,
          coverage: evidence.coverage,
          // What the review answered, read as data: how many findings, by severity, and the verdict, with
          // where they were read from. All `null` when no answer was read (`current`) or none was valid,
          // which is never the same as a review that found nothing: that one counts 0.
          findings: review ? findingCounts(review.findings) : null,
          verdict: review ? review.verdict : null,
          answerSource: review ? 'rollout' : null,
        };
        appendCodexReviewRun(root, run, { spawn });
        return run.id;
      } catch (err) {
        error(`Could not write the run log, so what this attempt measured was not kept: ${err.message}`);
        return undefined;
      }
    };
    for (const warning of evidence.warnings) error(`Codex warning: ${warning}`);
    if (evidence.review) write(`${evidence.review}\n`);
    if (review) for (const line of answerLines(review)) log(line);
    log(spentLine(spent, reading.items, durationMs, lean));
    if (result.status !== 0 || !evidence.completed) {
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
      return typeof result.status === 'number' && result.status !== 0 ? result.status : 1;
    }
    // A lean review answers in a structure this command reads. A turn that completed and left no such
    // answer did not do what a review does, so the attempt failed, whatever its commands showed: asked
    // before the evidence rule, which says how much of the diff was read and nothing of what came of it.
    if (answered && !answered.ok) {
      const why = answerFailure(answered);
      logRun('failed', why);
      error(`Codex's turn completed, but ${why}; no record was written.\n${WAYS_ON}`);
      return 1;
    }
    if (!evidence.inspected) {
      const { seen, total } = evidence.coverage;
      const why = evidence.review === '' ? 'it ended without a review message'
        : total === 0 ? 'it ran no successful command'
          : `its successful commands showed ${seen} of ${total} changed lines of ${base.slice(0, 7)}..HEAD`;
      const missing = evidence.missing.slice(0, 3).map((line) => `\n  missing: ${truncate(line, 100)}`).join('');
      const ran = evidence.commands.length ? '' : '\nCodex ran no commands.';
      logRun('not-inspected', why);
      error(`Codex's turn completed, but ${why}; nothing was recorded.${missing}${ran}\n${WAYS_ON}`);
      return 1;
    }
    outcome = 'reviewed';
    // The run line goes first, so that the record can name it. If the record then cannot be written
    // the command exits 1 and the log keeps a `reviewed` line no record names: a measurement of a
    // session that did meet the evidence rule, and still not a review `check --push` will count.
    runId = logRun('reviewed');
  }

  const record = {
    schema: CODEX_REVIEW_SCHEMA,
    base,
    head,
    reviewedAt: now().toISOString(),
    outcome,
    ...(outcome === 'unavailable' ? { reason: args.unavailable } : {}),
    // The run line this review was measured in; absent when that line could not be written.
    ...(runId === undefined ? {} : { run: runId }),
  };
  let file;
  try {
    file = appendCodexReview(root, record, { spawn });
  } catch (err) {
    error(`Could not write the record: ${err.message}`);
    return 1;
  }
  const what = outcome === 'reviewed' ? 'the Codex review' : `an unavailable Codex review (${args.unavailable})`;
  log(`Recorded ${what} of ${base.slice(0, 7)}..${head.slice(0, 7)} in ${file}.`);
  return 0;
}
