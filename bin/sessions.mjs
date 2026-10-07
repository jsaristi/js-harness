#!/usr/bin/env node
// `sessions`: a board of the project's recent Claude Code sessions, from facts on disk — each one's state,
// the background work it still has open and the tail of its last reply — next to the worktrees, the
// running gates and the open pull requests. See odd/tasks/session-board.md. The facts are computed by
// bin/lib/sessions.mjs; this file only finds the folders, reads them and runs `git`, `gh` and one process
// listing. Read-only: it opens files for reading and signals no process, because it runs while other
// sessions work in the same checkout. Zero dependencies; `--json` gives the same data as the text.
// `--watch` takes the same board again and again and returns when two of them differ in a way that needs
// a decision, so a session can wait on the others without spending anything while nothing happens.
// The board also prints the relief file of the session that orchestrates the others (its path and last
// lines): that session writes it, this command only reads it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { POWERSHELL_ROW_FUNCTION } from './lib/process-tree.mjs';
import { DEFAULT_CONTEXT_LIMIT_PERCENT, DEFAULT_CONTEXT_WINDOW, NOT_VISIBLE, boardChanges, isSelf, parseProcessList, parsePsList, percentOf, projectSlug, readGates, readPullRequests, readWorktrees, reliefTail, renderBoard, sessionFacts, watchBaseline } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness sessions [--hours <n>] [--tail <n>] [--self <session id>] [--json]',
  '                           [--context-window <tokens>] [--context-limit <tokens>|<n>%]',
  '                           [--watch [--interval <seconds>] [--timeout <seconds>]]',
  '                           [--cwd <path>] [--claude-home <path>] [--tmp <path>] [--relief <path>]',
].join('\n');

// How often a watch looks, and how long it waits before it returns with nothing, in seconds. A look is
// one process listing, one `gh` call and a few `git` calls per worktree: every 30 s that is some 120 `gh`
// calls an hour, far from any limit, and a change is seen within half a minute. The timeout keeps a
// watch under an hour, so whoever waits on it hears "nothing changed" before it could take the silence
// for a watch that died.
const DEFAULT_INTERVAL = 30;
const DEFAULT_TIMEOUT = 3000;

class SessionsArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value === '' || value.startsWith('--')) throw new SessionsArgError(`${flag} requires a value`);
  return value;
}

/** The number `value` spells in plain digits, with an optional decimal part when `decimals` allows it, or
 * `NaN`. `Number` alone would take an empty or blank value for 0, and `0x2` and `1e1` for numbers; and
 * digits enough to overflow are `Infinity` to it, which no flag here can mean. */
function plainNumber(value, { decimals }) {
  const number = (decimals ? /^(\d+\.?\d*|\.\d+)$/ : /^\d+$/).test(value) ? Number(value) : NaN;
  return Number.isFinite(number) ? number : NaN;
}

// The longest wait a watch takes, in seconds: the largest delay a Node timer accepts is 2,147,483,647 ms,
// and one above it fires after a millisecond, which would make the watch look at the machine in a loop.
const MAX_WAIT = 2147483;

/** `--context-limit` as tokens: a whole number of them, or `<N>%` of `window` (above zero, up to 100).
 * `NaN` for anything else. */
function contextLimitOf(spec, window) {
  if (!spec.endsWith('%')) return plainNumber(spec, { decimals: false });
  const percent = plainNumber(spec.slice(0, -1), { decimals: true });
  return percent > 0 && percent <= 100 ? Math.round((window * percent) / 100) : NaN;
}

/** Walks argv token by token, like `progress`: anything that is not a known flag is a usage error, never
 * a token that is silently ignored. `--hours` is a number above zero, `--tail` a whole number from zero. */
function parseArgs(argv) {
  const parsed = { hours: 12, tail: 3, json: false, contextWindow: DEFAULT_CONTEXT_WINDOW, contextLimitSpec: `${DEFAULT_CONTEXT_LIMIT_PERCENT}%`, watch: false };
  // A Map, not an object: `constructor`, `toString` and `__proto__` are keys of every object literal, and
  // would pass for flags.
  const paths = new Map([['--cwd', 'cwd'], ['--claude-home', 'claudeHome'], ['--tmp', 'tmp'], ['--relief', 'relief']]);
  const waits = new Map([['--interval', 'interval'], ['--timeout', 'timeout']]);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json' || token === '--watch') {
      parsed[token.slice(2)] = true;
      continue;
    }
    if (waits.has(token)) {
      const seconds = plainNumber(requireValue(argv, i, token), { decimals: true });
      if (!(seconds > 0 && seconds <= MAX_WAIT)) throw new SessionsArgError(`${token} takes a number of seconds above zero, up to ${MAX_WAIT}`);
      parsed[waits.get(token)] = seconds;
    } else if (token === '--self') {
      parsed.self = requireValue(argv, i, token);
      if (parsed.self.length < 8) throw new SessionsArgError('--self takes a session id, or its first eight characters or more');
    } else if (paths.has(token)) {
      parsed[paths.get(token)] = requireValue(argv, i, token);
    } else if (token === '--hours') {
      parsed.hours = plainNumber(requireValue(argv, i, token), { decimals: true });
      if (!(parsed.hours > 0)) throw new SessionsArgError('--hours takes a number above zero');
    } else if (token === '--tail') {
      parsed.tail = plainNumber(requireValue(argv, i, token), { decimals: false });
      if (Number.isNaN(parsed.tail)) throw new SessionsArgError('--tail takes a whole number, zero or more');
    } else if (token === '--context-window') {
      parsed.contextWindow = plainNumber(requireValue(argv, i, token), { decimals: false });
      if (!(parsed.contextWindow > 0)) throw new SessionsArgError('--context-window takes a whole number of tokens above zero');
    } else if (token === '--context-limit') {
      parsed.contextLimitSpec = requireValue(argv, i, token);
    } else {
      throw new SessionsArgError(`unknown argument: ${token}`);
    }
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  // A wait given to a board that does not wait is a mistake to name, not a flag to ignore.
  for (const [flag, key] of waits) {
    if (!parsed.watch && parsed[key] !== undefined) throw new SessionsArgError(`${flag} only applies with --watch`);
  }
  // The limit is read last: as a percentage it is a share of the window, whichever flag came first.
  const contextLimit = contextLimitOf(parsed.contextLimitSpec, parsed.contextWindow);
  if (!(contextLimit > 0)) throw new SessionsArgError('--context-limit takes a whole number of tokens above zero, or a percentage of the context window above zero and up to 100 (73%)');
  return { ...parsed, contextLimit, interval: parsed.interval ?? DEFAULT_INTERVAL, timeout: parsed.timeout ?? DEFAULT_TIMEOUT };
}

/** The main checkout of the repository `cwd` is in, so the board is the same from any worktree: the
 * folder that holds the common git dir. Outside a repository (or without git) the folder itself is the
 * project, as it is for Claude Code. */
function mainCheckout(run, cwd) {
  const result = run('git', ['rev-parse', '--git-common-dir'], { cwd });
  if (result.error || result.status !== 0 || result.stdout.trim() === '') return cwd;
  const commonDir = path.resolve(cwd, result.stdout.trim());
  return path.basename(commonDir) === '.git' ? path.dirname(commonDir) : commonDir;
}

// One row of the shared listing (`Format-ProcessRow`, bin/lib/process-tree.mjs) and one `C` line per
// process whose command line mentions `check.mjs`; `findGates` decides which of those are gates. The
// last line is `OK` with the number of `C` lines written, which `parseProcessList` compares with the
// lines it read: a listing that stopped half way, or lost a line, is refused. Tabs and line breaks in a
// command line become spaces, so a line of output is always one fact. Progress output is off: under
// `-EncodedCommand` it would arrive as CLIXML.
const GATE_LISTING_SCRIPT = String.raw`
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
${POWERSHELL_ROW_FUNCTION}
try {
  $written = 0
  foreach ($process in @(Get-CimInstance Win32_Process)) {
    $line = $process.CommandLine
    if (-not $line -or $line.IndexOf('check.mjs', [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
    Format-ProcessRow $process
    'C' + [char]9 + $process.ProcessId + [char]9 + ($line -replace '\s+', ' ')
    $written += 1
  }
  'OK' + [char]9 + $written
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

/** The processes a gate can be among, `[{ pid, createdAt, commandLine }]`. Throws when the listing could
 * not run or did not finish: "no gate is running" must never be read from "could not look". */
function listGateCandidates(run, platform) {
  const windows = platform === 'win32';
  const result = windows
    ? run('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(GATE_LISTING_SCRIPT, 'utf16le').toString('base64')], {})
    : run('ps', ['-A', '-o', 'pid=,args='], {});
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(String(result.stderr ?? '').trim().split(/\r?\n/)[0] || `exit ${result.status}`);
  return windows ? parseProcessList(result.stdout) : parsePsList(result.stdout);
}

/** The id of the subagent the tool call `toolUseId` launched, from the `agent-<id>.meta.json` that names
 * it — the only place it is written while a foreground subagent runs. `null` when no file names it. */
function agentOfCall(subagentsDir, toolUseId, { readdir, readFile }) {
  let names;
  try {
    names = readdir(subagentsDir);
  } catch {
    return null;
  }
  for (const name of names) {
    const match = /^agent-(.+)\.meta\.json$/.exec(name);
    if (!match) continue;
    try {
      if (JSON.parse(readFile(path.join(subagentsDir, name))).toolUseId === toolUseId) return match[1];
    } catch {
      // a meta file being written, or one that is not JSON, names nothing
    }
  }
  return null;
}

/** Where a piece of work writes while it runs, and when it last did: a subagent's own transcript, a
 * shell's output file. `{ path, modifiedAt }`, or `unavailable` with the reason. */
function workFile(work, { sessionDir, tasksDir }, io) {
  let file;
  if (work.tool === 'Agent') {
    const subagentsDir = path.join(sessionDir, 'subagents');
    const agent = work.id ?? agentOfCall(subagentsDir, work.toolUseId, io);
    if (agent === null) return { unavailable: 'no subagent file of the session names this tool call' };
    file = path.join(subagentsDir, `agent-${agent}.jsonl`);
  } else {
    if (work.id === null) return { unavailable: 'the transcript does not record its task id yet' };
    file = path.join(tasksDir, `${work.id}.output`);
  }
  try {
    return { path: file, modifiedAt: new Date(io.stat(file).mtimeMs).toISOString() };
  } catch (err) {
    return { path: file, unavailable: err.code ?? err.message };
  }
}

/** One session of the board: its transcript's facts plus, for each piece of work with no recorded end,
 * the last write of its file. A transcript that cannot be read, or that the reader cannot turn into
 * facts, is a session with `unavailable` and the reason: one transcript never costs the whole board. */
function readSession(id, modifiedAt, { projectDir, tasksRoot, tail, contextLimit, contextWindow }, io) {
  let text;
  try {
    text = io.readFile(path.join(projectDir, `${id}.jsonl`));
  } catch (err) {
    return { id, modifiedAt, unavailable: err.code ?? err.message };
  }
  let facts;
  try {
    facts = io.readFacts(text, { tail, contextLimit, contextWindow });
  } catch (err) {
    return { id, modifiedAt, unavailable: `its transcript could not be read into facts: ${err.message}` };
  }
  const folders = { sessionDir: path.join(projectDir, id), tasksDir: path.join(tasksRoot, id, 'tasks') };
  for (const work of facts.work) {
    if (!work.ended) work.file = workFile(work, folders, io);
  }
  return { id, modifiedAt, ...facts };
}

/** The relief file at `file` as the board shows it: `{ path, exists: true, lineCount, lines }`, `{ path,
 * exists: false }` when there is none yet, or `{ path, unavailable }` with the reason when it is there
 * and cannot be read. */
function readRelief(file, readFile) {
  try {
    return { path: file, exists: true, ...reliefTail(readFile(file)) };
  } catch (err) {
    return err.code === 'ENOENT' ? { path: file, exists: false } : { path: file, unavailable: err.code ?? err.message };
  }
}

export async function sessionsMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    now = Date.now,
    platform = process.platform,
    homedir = os.homedir,
    tmpdir = os.tmpdir,
    // Everything that touches the disk or starts a process is injectable, so the tests read fixture
    // folders and fake commands, never this machine's sessions. `run` is `git` and `gh` (and the process
    // listing, unless `listProcesses` replaces it); each is given a time limit so a stuck command becomes
    // an unavailable fact, not a board that never prints.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
    listProcesses = () => listGateCandidates(run, platform),
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    readdir = (absolute) => fs.readdirSync(absolute),
    stat = (absolute) => fs.statSync(absolute),
    // The transcript reader, replaceable so a test can make it fail on one transcript.
    readFacts = sessionFacts,
    // How a watch waits between two looks; with `now` it is all of its time, so a test waits for nothing.
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr(`${err.message}\n\n${USAGE}`);
    return 2; // a usage error, as in `progress`, `remote` and `codex-review`; 1 is "no sessions folder" below
  }

  const root = mainCheckout(run, path.resolve(parsed.cwd ?? defaultCwd));
  const slug = projectSlug(root);
  const claudeHome = parsed.claudeHome ?? env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude');
  const projectDir = path.join(claudeHome, 'projects', slug);
  const io = { readFile, readdir, stat, readFacts };
  // Where the session that orchestrates this project keeps its notes: one file per project under the
  // harness home, which is JS_HARNESS_HOME or the user's home, as for `install` and `remote`.
  const reliefFile = path.resolve(parsed.relief ?? path.join(env.JS_HARNESS_HOME ?? homedir(), '.js-harness', 'relief', `${slug}.md`));
  // The session that asked: Claude Code names it in the environment of every command it runs.
  const self = parsed.self ?? env.CLAUDE_CODE_SESSION_ID ?? null;

  /** One look at the machine: the board, or `null` (said on stderr) when the project has no sessions folder. */
  const look = () => {
    let names;
    try {
      names = readdir(projectDir);
    } catch (err) {
      stderr(`js-harness sessions: no sessions folder for ${root}: ${projectDir} (${err.code ?? err.message})`);
      return null;
    }

    const generatedAt = now();
    const since = generatedAt - parsed.hours * 3600 * 1000;
    const where = { projectDir, tasksRoot: path.join(parsed.tmp ?? tmpdir(), 'claude', slug), tail: parsed.tail, contextLimit: parsed.contextLimit, contextWindow: parsed.contextWindow };
    const sessions = [];
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const id = name.slice(0, -'.jsonl'.length);
      let changedAt;
      try {
        changedAt = stat(path.join(projectDir, name)).mtimeMs;
      } catch (err) {
        // A transcript whose date cannot be read cannot be placed outside the window either: it is listed.
        sessions.push({ id, modifiedAt: null, unavailable: err.code ?? err.message });
        continue;
      }
      if (changedAt >= since) sessions.push(readSession(id, new Date(changedAt).toISOString(), where, io));
    }
    // Most recent first, by the last entry when the transcript has one and by its last write otherwise.
    const recency = (session) => session.lastEntryAt ?? session.modifiedAt ?? '';
    sessions.sort((a, b) => (recency(a) < recency(b) ? 1 : recency(a) > recency(b) ? -1 : 0));
    for (const session of sessions) if (isSelf(session.id, self)) session.self = true;

    const worktrees = readWorktrees(run, root, { readFile });
    return {
      root,
      projectDir,
      hours: parsed.hours,
      contextWindow: parsed.contextWindow,
      contextLimit: parsed.contextLimit,
      contextLimitPercent: percentOf(parsed.contextLimit, parsed.contextWindow),
      self,
      generatedAt: new Date(generatedAt).toISOString(),
      sessions,
      worktrees,
      gates: readGates(listProcesses, worktrees.available ? worktrees.items.map((tree) => tree.path) : []),
      pullRequests: readPullRequests(run, root),
      relief: readRelief(reliefFile, readFile),
      notVisible: NOT_VISIBLE,
    };
  };
  const boardLines = (board) => renderBoard(board, { now: Date.parse(board.generatedAt) });

  const first = look();
  if (first === null) return 1;
  if (!parsed.watch) {
    for (const line of parsed.json ? [JSON.stringify(first, null, 2)] : boardLines(first)) stdout(line);
    return 0;
  }

  // The watch: look, wait, look again, and say nothing until two looks differ in a way that matters
  // (`boardChanges`) or the timeout is up. Whoever waits on it pays for one answer, not for the waiting.
  const started = now();
  const waited = () => Math.round((now() - started) / 1000);
  let baseline = first;
  for (let left = parsed.timeout * 1000; left > 0; left = parsed.timeout * 1000 - (now() - started)) {
    await sleep(Math.min(parsed.interval * 1000, left));
    const board = look();
    if (board === null) return 1;
    const changes = boardChanges(baseline, board, { self });
    if (changes.length === 0) {
      baseline = watchBaseline(baseline, board);
      continue;
    }
    if (parsed.json) {
      stdout(JSON.stringify({ watch: { changed: true, waitedSeconds: waited(), changes }, board }, null, 2));
      return 0;
    }
    stdout(`sessions --watch: ${changes.length} change${changes.length === 1 ? '' : 's'} after ${waited()}s`);
    for (const change of changes) stdout(`  ${change}`);
    stdout('');
    for (const line of boardLines(board)) stdout(line);
    return 0;
  }
  // Nothing to decide: one line and no board, so a watch that wakes for nothing costs next to nothing.
  stdout(parsed.json ? JSON.stringify({ watch: { changed: false, waitedSeconds: waited(), changes: [] } }, null, 2) : `sessions --watch: nothing changed in ${waited()}s`);
  return 0;
}
