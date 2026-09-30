#!/usr/bin/env node
// `js-harness codex-review --base <rev>`: run `codex exec review` over `<rev>..HEAD` and record that
// it ran, or record an explicit skip with `--unavailable <reason>`. The record is what
// `check --push` reads to catch a slice that was never reviewed (T7 in odd/tasks/project-init.md).
// A completed Codex turn does not mean it read the diff (a sandbox that denies process launch still
// completes, with a review that says so), and its wording is not evidence either. So the JSONL event
// stream is read instead: a record is written only when a git command that reads the diff really ran
// and succeeded (design and probes: odd/tasks/codex-exec-review.md).
import { spawnSync } from 'node:child_process';
import { appendCodexReview, CODEX_REVIEW_SCHEMA } from './lib/codex-reviews.mjs';

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

/** Trimmed stdout of a successful `git <args>` run in `cwd` (empty when it printed nothing), else
 * `null`: a failed run and an empty answer are different things. */
function git(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
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

// `git diff` and `git show` print the patch; `git log` only with `-p`/`--patch`. Options between
// `git` and the subcommand (`--no-pager`, `-C <dir>`, `-c <k=v>`) are allowed. A command often
// chains several (`git diff --stat x; git diff x`), so each segment is judged alone, and one that
// asks for names or counts only (`--stat`, `--name-only`, `-s`, …) never counts, even beside `-p`.
const GIT = String.raw`\bgit(?:\.exe)?(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?))*\s+`;
const DIFF_OR_SHOW = new RegExp(String.raw`${GIT}(?:diff|show)\b`);
const LOG = new RegExp(String.raw`${GIT}log\b`);
const PATCH = /\s(?:-p|--patch)(?=\s|$)/;
const NO_PATCH = /\s(?:--(?:stat|shortstat|numstat|dirstat|summary|name-only|name-status|quiet|no-patch|raw)\b|-s(?=\s|$))/;

/** Whether `command` runs git in a way that prints the patch itself. */
function readsDiff(command) {
  return command.split(/;|&&|\|\||\||\n/).some((segment) =>
    !NO_PATCH.test(segment) && (DIFF_OR_SHOW.test(segment) || (LOG.test(segment) && PATCH.test(segment))));
}

/** What the event stream proves. `inspected` is the evidence rule: the turn completed and did not
 * fail, it ended with a message, and a completed command that reads the diff exited 0. `errors` are
 * the failed turn's messages; `warnings` are error items Codex raises without failing (an
 * unrecognized configuration setting, for one). */
export function reviewEvidence(events) {
  let turnCompleted = false;
  let turnFailed = false;
  let review = '';
  const commands = [];
  const errors = [];
  const warnings = [];
  for (const event of events) {
    const item = event.item;
    if (event.type === 'turn.completed') turnCompleted = true;
    else if (event.type === 'turn.failed' || event.type === 'error') {
      if (event.type === 'turn.failed') turnFailed = true;
      const message = event.error?.message ?? event.message ?? (typeof event.error === 'string' ? event.error : undefined);
      if (message) errors.push(String(message));
    } else if (event.type === 'item.completed' && item) {
      if (item.type === 'agent_message' && typeof item.text === 'string') review = item.text.trim();
      else if (item.type === 'command_execution') commands.push({ command: String(item.command ?? ''), exitCode: item.exit_code });
      else if (item.type === 'error' && item.message) warnings.push(String(item.message));
    }
  }
  const completed = turnCompleted && !turnFailed;
  const readDiff = commands.some((c) => c.exitCode === 0 && readsDiff(c.command));
  return { inspected: completed && review !== '' && readDiff, completed, review, commands, errors, warnings };
}

/** The commands as one line each, `exit N  <command>`, cut to 100 characters. */
function commandLines(commands) {
  return commands.map(({ command, exitCode }) => {
    const oneLine = command.replace(/\s+/g, ' ').trim();
    return `  exit ${exitCode ?? '?'}  ${oneLine.length > 100 ? `${oneLine.slice(0, 99)}…` : oneLine}`;
  });
}

const REVIEW_MAX_BUFFER = 64 * 1024 * 1024;

const WAYS_ON = 'Rerun the review, or record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

const NO_CODEX =
  'Could not run `codex`. Install it with `npm i -g @openai/codex` and log in with `codex login`, ' +
  'or record an explicit skip with `--unavailable <reason>`; nothing was recorded.';

/** Runs the command; returns the process exit code. `deps` (all optional) injects `spawn` (for git
 * and Codex), `now`, `platform`, `log`, `error` and `write` (the review passed through to the user)
 * so tests use fixtures; `env` is the parent environment Codex's is derived from. Exits 2 with usage
 * on a bad flag; 1 when nothing could be recorded or the review did not complete. */
export async function codexReviewMain(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { spawn = spawnSync, now = () => new Date(), log = console.log, error = console.error, platform = process.platform } = deps;
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
    log(`Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)}; this can take several minutes.`);
    let result;
    try {
      // stdin is ignored (Codex would wait to read it), stdout carries the JSONL, stderr (the
      // progress) stays live. The buffer is far above Node's 1 MiB default, which a long review with
      // command output could exceed. `codex` is a `.cmd` shim on Windows, which needs a shell.
      const options = {
        cwd: root,
        stdio: ['ignore', 'pipe', 'inherit'],
        encoding: 'utf8',
        maxBuffer: REVIEW_MAX_BUFFER,
        env: childEnv(env, platform),
      };
      const codexArgv = codexArgs(base);
      result = platform === 'win32'
        ? spawn(windowsCommandLine('codex', codexArgv), [], { ...options, shell: true })
        : spawn('codex', codexArgv, options);
    } catch (err) {
      result = { status: null, error: err };
    }
    const events = parseEvents(result?.stdout);
    const evidence = reviewEvidence(events);
    // A missing CLI: ENOENT, or on Windows the shell's own "not recognized" (exit 1 or 9009) with
    // nothing on stdout.
    if (result?.error?.code === 'ENOENT' || (platform === 'win32' && [1, 9009].includes(result?.status) && events.length === 0)) {
      error(NO_CODEX);
      return 1;
    }
    for (const warning of evidence.warnings) error(`Codex warning: ${warning}`);
    if (evidence.review) write(`${evidence.review}\n`);
    if (result?.status !== 0 || !evidence.completed) {
      const reason = result?.error?.code === 'ENOBUFS'
        ? `its output exceeded ${REVIEW_MAX_BUFFER / (1024 * 1024)} MiB`
        : result?.error ? `could not start it: ${result.error.message}`
          : result?.status !== 0 ? `it exited ${result?.status ?? `on ${result?.signal ?? 'a signal'}`}`
            : evidence.errors.length ? 'the turn failed' : 'the turn never completed';
      const said = evidence.errors.map((message) => `\n  Codex said: ${message}`).join('');
      error(`The Codex review did not complete (${reason}); no record was written.${said}\n${WAYS_ON}`);
      return typeof result?.status === 'number' && result.status !== 0 ? result.status : 1;
    }
    const ran = evidence.commands.length ? ['Codex ran:', ...commandLines(evidence.commands)].join('\n') : 'Codex ran no commands.';
    if (!evidence.inspected) {
      error(`Codex's turn completed, but it ran no successful git command that reads the diff (git diff, git show or git log -p), or it ended without a review; nothing was recorded.\n${ran}\n${WAYS_ON}`);
      return 1;
    }
    log(ran);
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
