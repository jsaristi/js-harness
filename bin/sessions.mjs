#!/usr/bin/env node
// `sessions`: a board of the project's recent Claude Code sessions, from facts on disk — each one's state,
// the background work it still has open and the tail of its last reply — next to the worktrees, the
// running gates and the open pull requests. See odd/tasks/session-board.md. The facts are computed by
// bin/lib/sessions.mjs; this file only finds the folders, reads them and runs `git`, `gh` and one process
// listing. Read-only: it opens files for reading and signals no process, because it runs while other
// sessions work in the same checkout. Zero dependencies; `--json` gives the same data as the text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { POWERSHELL_ROW_FUNCTION } from './lib/process-tree.mjs';
import { NOT_VISIBLE, parseProcessList, parsePsList, projectSlug, readGates, readPullRequests, readWorktrees, renderBoard, sessionFacts } from './lib/sessions.mjs';

const USAGE = 'Usage: js-harness sessions [--hours <n>] [--tail <n>] [--json] [--cwd <path>] [--claude-home <path>] [--tmp <path>]';

class SessionsArgError extends Error {}

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new SessionsArgError(`${flag} requires a value`);
  return value;
}

/** Walks argv token by token, like `progress`: anything that is not a known flag is a usage error, never
 * a token that is silently ignored. `--hours` is a number above zero, `--tail` a whole number from zero. */
function parseArgs(argv) {
  const parsed = { hours: 12, tail: 3, json: false };
  const paths = { '--cwd': 'cwd', '--claude-home': 'claudeHome', '--tmp': 'tmp' };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json') {
      parsed.json = true;
      continue;
    }
    if (token in paths) {
      parsed[paths[token]] = requireValue(argv, i, token);
    } else if (token === '--hours') {
      parsed.hours = Number(requireValue(argv, i, token));
      if (!(parsed.hours > 0) || !Number.isFinite(parsed.hours)) throw new SessionsArgError('--hours takes a number above zero');
    } else if (token === '--tail') {
      parsed.tail = Number(requireValue(argv, i, token));
      if (!Number.isInteger(parsed.tail) || parsed.tail < 0) throw new SessionsArgError('--tail takes a whole number, zero or more');
    } else {
      throw new SessionsArgError(`unknown argument: ${token}`);
    }
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  return parsed;
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
 * the last write of its file. A transcript that cannot be read is a session with `unavailable`. */
function readSession(id, modifiedAt, { projectDir, tasksRoot, tail }, io) {
  let text;
  try {
    text = io.readFile(path.join(projectDir, `${id}.jsonl`));
  } catch (err) {
    return { id, modifiedAt, unavailable: err.code ?? err.message };
  }
  const facts = sessionFacts(text, { tail });
  const folders = { sessionDir: path.join(projectDir, id), tasksDir: path.join(tasksRoot, id, 'tasks') };
  for (const work of facts.work) {
    if (!work.ended) work.file = workFile(work, folders, io);
  }
  return { id, modifiedAt, ...facts };
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
  const io = { readFile, readdir, stat };

  let names;
  try {
    names = readdir(projectDir);
  } catch (err) {
    stderr(`js-harness sessions: no sessions folder for ${root}: ${projectDir} (${err.code ?? err.message})`);
    return 1;
  }

  const generatedAt = now();
  const since = generatedAt - parsed.hours * 3600 * 1000;
  const where = { projectDir, tasksRoot: path.join(parsed.tmp ?? tmpdir(), 'claude', slug), tail: parsed.tail };
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

  const worktrees = readWorktrees(run, root);
  const board = {
    root,
    projectDir,
    hours: parsed.hours,
    generatedAt: new Date(generatedAt).toISOString(),
    sessions,
    worktrees,
    gates: readGates(listProcesses, worktrees.available ? worktrees.items.map((tree) => tree.path) : []),
    pullRequests: readPullRequests(run, root),
    notVisible: NOT_VISIBLE,
  };

  if (parsed.json) {
    stdout(JSON.stringify(board, null, 2));
    return 0;
  }
  for (const line of renderBoard(board, { now: generatedAt })) stdout(line);
  return 0;
}
