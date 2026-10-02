#!/usr/bin/env node
// `js-harness codex-review --base <rev>`: run `codex exec review` over `<rev>..HEAD` and record that
// it ran, or record an explicit skip with `--unavailable <reason>`. The record is what
// `check --push` reads to catch a slice that was never reviewed (T7 in odd/tasks/project-init.md).
// A completed Codex turn does not mean it read the diff (a sandbox that denies process launch still
// completes, with a review that says so), and neither its wording nor the text of the commands it
// ran is evidence. What Codex saw is: the changed lines of `git diff <base> HEAD`, computed here, must
// all appear in the output of the commands that succeeded in its JSONL event stream (design and
// probes: odd/tasks/codex-exec-review.md).
import { spawn as spawnChild, spawnSync } from 'node:child_process';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './lib/codex-reviews.mjs';
import { killTree } from './lib/process-tree.mjs';

// `--home` used to locate the Codex plugin; it is still parsed so existing callers do not break.
const USAGE = 'Usage: js-harness codex-review --base <rev> [--unavailable <reason>] [--cwd <path>] [--home <path> (ignored)]';

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
  get('--home');
  return { base, unavailable, cwd: get('--cwd') ?? process.cwd() };
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

// Read-only sandbox, no approvals: the review reads the repository and nothing else. The two desktop
// plugins are off because their REPL (`cua_repl`) cannot launch processes, and the model used it
// instead of the shell in 6 of 41 stored reviews, so those never ran `git diff`.
const CODEX_CONFIG = [
  'sandbox_mode=read-only',
  'approval_policy=never',
  'plugins."unified-computer-use@openai-bundled".enabled=false',
  'plugins."computer-use@openai-bundled".enabled=false',
];

/** The arguments of the Codex run over `<base>..HEAD`; `base` is a full commit id. */
export function codexArgs(base) {
  return ['exec', 'review', '--json', '--ephemeral', '--base', base, ...CODEX_CONFIG.flatMap((setting) => ['-c', setting])];
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

/** One argument of a Windows command line run through `cmd.exe /s /c`, quoted for the C runtime that
 * parses it: double quotes, backslashes before a quote doubled, the quote escaped. Throws on what
 * cmd.exe itself would act on; none of Codex's arguments contain any of it. */
export function quoteWindowsArg(arg) {
  if (/[&|<>^%\r\n]/.test(arg)) throw new Error(`Cannot pass ${JSON.stringify(arg)} through cmd.exe safely.`);
  if (/^[\w.,:=@+/\\-]+$/.test(arg)) return arg;
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
}

/** `command` and its arguments as the one line `cmd.exe` gets. */
export function windowsCommandLine(command, args) {
  return [command, ...args.map(quoteWindowsArg)].join(' ');
}

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

/** Whether `codex --version` answers, through the launch path and environment of the review: a
 * missing CLI is told apart here, so a bad `-c`, a broken config or a failed login is never
 * reported as one. */
function codexRuns(spawn, platform, env) {
  try {
    const result = launchCodex(spawn, platform, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      env,
    });
    return Boolean(result) && !result.error && result.status === 0 && /\d+\.\d+\.\d+/.test(result.stdout ?? '');
  } catch {
    return false;
  }
}

/** Runs the review as an async child and resolves, like `spawnSync`, with `{ status, signal, stdout,
 * error }`. Unlike `spawnSync` it cannot be held by a grandchild that keeps the pipe open: on the
 * timer or an overflow past `maxBuffer` it kills the tree and resolves at once, without waiting for
 * the child to close. `onLine` gets each complete stdout line as it arrives.
 *
 * On Windows the child is the `cmd.exe` shim, and killing only it leaves Codex running with the stdout pipe
 * open, so the whole tree goes: found by `bin/lib/process-tree.mjs` from when the child was spawned, never by
 * parent pid alone (`kill(child, { startedAt })`). Elsewhere the child leads its own process group. */
function runReview(spawnAsync, kill, platform, argv, options, { timeoutMs, maxBuffer, onLine, signals }) {
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

/** Runs the command; returns the process exit code. `deps` (all optional) injects `spawn` (git and
 * the `codex --version` probe, sync), `spawnAsync` (the review), `killTree`, `timeoutMs`,
 * `maxBuffer`, `signals` (where SIGINT/SIGTERM arrive), `now`, `platform`, `log`, `error` and
 * `write` (the review passed through to the user)
 * so tests use fixtures; `env` is the parent environment Codex's is derived from. Exits 2 with usage
 * on a bad flag; 1 when nothing could be recorded or the review did not complete. */
export async function codexReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { spawn = spawnSync, spawnAsync = spawnChild, now = () => new Date(), log = console.log, error = console.error, platform = process.platform } = deps;
  const { timeoutMs = REVIEW_TIMEOUT_MS, maxBuffer = REVIEW_MAX_BUFFER, signals = process } = deps;
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
    const codexEnv = childEnv(env, platform);
    if (!codexRuns(spawn, platform, codexEnv)) {
      error(NO_CODEX);
      return 1;
    }
    log(`Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)}; this can take several minutes.`);
    // stdin is ignored (Codex would wait to read it), stdout carries the JSONL, stderr (the progress)
    // stays live.
    const result = await runReview(spawnAsync, kill, platform, codexArgs(from), {
      cwd: root,
      stdio: ['ignore', 'pipe', 'inherit'],
      env: codexEnv,
    }, { timeoutMs, maxBuffer, onLine: (line) => progressLine(line, log), signals });
    const evidence = reviewEvidence(parseEvents(result.stdout), expected);
    for (const warning of evidence.warnings) error(`Codex warning: ${warning}`);
    if (evidence.review) write(`${evidence.review}\n`);
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
      error(`The Codex review did not complete (${reason}); no record was written.${said}${left}\n${WAYS_ON}`);
      return typeof result.status === 'number' && result.status !== 0 ? result.status : 1;
    }
    if (!evidence.inspected) {
      const { seen, total } = evidence.coverage;
      const why = evidence.review === '' ? 'it ended without a review message'
        : total === 0 ? 'it ran no successful command'
          : `its successful commands showed ${seen} of ${total} changed lines of ${base.slice(0, 7)}..HEAD`;
      const missing = evidence.missing.slice(0, 3).map((line) => `\n  missing: ${truncate(line, 100)}`).join('');
      const ran = evidence.commands.length ? '' : '\nCodex ran no commands.';
      error(`Codex's turn completed, but ${why}; nothing was recorded.${missing}${ran}\n${WAYS_ON}`);
      return 1;
    }
    outcome = 'reviewed';
  }

  const record = {
    schema: CODEX_REVIEW_SCHEMA,
    base,
    head,
    reviewedAt: now().toISOString(),
    outcome,
    ...(outcome === 'unavailable' ? { reason: args.unavailable } : {}),
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
