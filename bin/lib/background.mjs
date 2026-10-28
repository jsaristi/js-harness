// The background sessions the lead starts with `js-harness sessions start` (odd/tasks/background-sessions.md): the
// record of each start under the harness home, how `claude` is run for `--bg`, `agents`, `stop` and `rm`, and what the
// board says of the project's background sessions. The desktop app's `start_session` starts a session only on a turn
// the user typed; `claude --bg` starts one from any turn, and is not a row in the user's sidebar, so every start is recorded
// here and undone from here, by `sessions stop <id>` or the machine uninstall, and nothing else on the machine is.
// Zero dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveClaude } from './claude-path.mjs';
import { windowsCommandLine, quoteWindowsArg } from './windows-args.mjs';

export const BACKGROUND_SCHEMA = 'js-harness.background-session/v1';

/** The folder of the record and of the copies of the briefs, under the harness home `home`. */
export function backgroundDir(home) {
  return path.join(home, '.js-harness', 'background');
}

export const recordFileOf = (home) => path.join(backgroundDir(home), 'sessions.jsonl');
export const briefsDirOf = (home) => path.join(backgroundDir(home), 'briefs');

/** The section the copy of a brief closes with: a background session has no screen anybody watches, and a question
 * it asks with the question tool waits unseen, so it reports where the lead reads. */
export const REPORT_SECTION = [
  '## How you report',
  '',
  'The lead started this session in the background with `js-harness sessions start`: nobody watches its screen, and a',
  'question you ask with the question tool waits unseen. Report through',
  '`js-harness notify --to orchestrator --kind <kind> "<one line>"` (`js-harness notify --help` gives every kind):',
  '`waiting` when a decision blocks you, `ready` with `--pr <n>` when a pull request is ready to land, and `closed`',
  'with `--summary <file>` when the work is done.',
  '',
].join('\n');

/** The copy of a brief the session reads: the brief as given, then `REPORT_SECTION`. */
export function briefCopyOf(text) {
  return `${text.replace(/\s+$/, '')}\n\n${REPORT_SECTION}`;
}

/** The one-line prompt a background session starts with: it points at the copy of its brief. One line, because a
 * `.cmd` shim of the CLI runs through `cmd.exe`, which cannot carry a line break. */
export function startPrompt(copy) {
  return `Your brief is in ${copy}: read it whole before anything else, and do the work it gives you. Its last section says how you report.`;
}

/** The one-line prompt a background session resumed after its job stopped starts with: it keeps its conversation, and
 * is told why it was stopped and where its brief is. */
export function resumePrompt(copy) {
  return `Your background job stopped (a restart of the machine ends every one) and js-harness sessions start --resume resumed it. Your brief is in ${copy}: go on from where your work stands, checked against your feature document and git, and report as its last section says.`;
}

/** The arguments of `claude` that start the session, or resume the conversation `resume` (a session id) in a new job.
 * `--add-dir` lets it read its brief's copy without a prompt; it takes several folders, so `-n` ends it. */
export function startArgs({ title, briefs, worktree, model, effort, remoteControl, prompt, resume }) {
  return [
    '--bg', ...(resume === undefined ? [] : ['--resume', resume]), '--add-dir', briefs, '-n', title,
    ...(worktree === undefined ? [] : ['-w', worktree]),
    ...(model === undefined ? [] : ['--model', model]),
    ...(effort === undefined ? [] : ['--effort', effort]),
    ...(remoteControl ? ['--remote-control', title] : []),
    prompt,
  ];
}

/** The short id `claude --bg` prints (`backgrounded · <id> · <name>`), or null. */
export function idOfStart(stdout) {
  const match = /^backgrounded\W+([0-9a-z]{6,})\b/im.exec(String(stdout ?? '')) ?? /claude attach ([0-9a-z]{6,})\b/i.exec(String(stdout ?? ''));
  return match ? match[1] : null;
}

/** A runner of the Claude CLI found on the PATH of `env` (`resolveClaude`), or null when there is none: `run(args, {
 * cwd, input })` gives `{ status, stdout, stderr, error }`, `input` what the CLI reads on stdin (the lens review hands
 * it its block so). A `.cmd` shim runs as one command line through the shell. */
export function claudeRunner({ env = process.env, platform = process.platform, spawn = spawnSync, timeout = 60000, maxBuffer = 1024 * 1024 } = {}) {
  const claude = resolveClaude({ env, platform });
  if (claude === null) return null;
  return (args, { cwd, input } = {}) => {
    const options = { cwd, env, encoding: 'utf8', windowsHide: true, timeout, maxBuffer, ...(input !== undefined && { input }) };
    const result = claude.shell
      ? spawn(windowsCommandLine(quoteWindowsArg(claude.path), args), [], { ...options, shell: true })
      : spawn(claude.path, args, options);
    return { status: result.status, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? ''), error: result.error };
  };
}

/** What a run of `claude` said, its two streams joined, or why it did not run. */
export function saidBy(result) {
  if (result.error) return result.error.message;
  return [result.stdout, result.stderr].map((text) => text.trim()).filter(Boolean).join('\n');
}

/** Every session `claude agents --json --all` lists, interactive and background, finished ones too. Throws with why
 * when it cannot be read: a listing that failed is never "none". */
export function listAgents(run) {
  if (run === null) throw new Error('claude is not on PATH');
  const result = run(['agents', '--json', '--all']);
  if (result.error) throw new Error(`claude agents --json --all could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`claude agents --json --all exited ${result.status}: ${saidBy(result).split(/\r?\n/)[0]}`);
  const agents = JSON.parse(result.stdout);
  if (!Array.isArray(agents)) throw new Error('claude agents --json --all gave no list');
  return agents;
}

/** Appends `entry` to the record under `home`, stamped with the schema, on a line of its own: after a last line an
 * interrupted write cut, a newline first, so the entry is not read as part of it and skipped. */
export function appendRecord(home, entry) {
  fs.mkdirSync(backgroundDir(home), { recursive: true });
  const file = recordFileOf(home);
  let cut = false;
  try {
    const size = fs.statSync(file).size;
    if (size > 0) {
      const fd = fs.openSync(file, 'r');
      const last = Buffer.alloc(1);
      try {
        fs.readSync(fd, last, 0, 1, size - 1);
      } finally {
        fs.closeSync(fd);
      }
      cut = last[0] !== 0x0a;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  fs.appendFileSync(file, `${cut ? '\n' : ''}${JSON.stringify({ schema: BACKGROUND_SCHEMA, ...entry })}\n`);
}

/** The sessions the record under `home` holds, those started and not removed: `{ sessions }`, a list of their start
 * entries, oldest first, and `started`, every start entry it holds, of removed sessions too; `{ none: true }` when
 * there is no record; `{ unavailable }` when it could not be read. A line that is not an entry of this schema is
 * skipped and counted (`skipped`). */
export function readRecord(home, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(recordFileOf(home));
  } catch (err) {
    return err.code === 'ENOENT' ? { none: true, sessions: [], started: [] } : { unavailable: err.code ?? err.message };
  }
  const open = new Map();
  const started = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    if (entry?.schema !== BACKGROUND_SCHEMA || typeof entry.id !== 'string') skipped += 1;
    else if (entry.event === 'started') {
      open.set(entry.id, entry);
      started.push(entry);
    } else if (entry.event === 'removed') open.delete(entry.id);
    else skipped += 1;
  }
  return { sessions: [...open.values()], started, skipped };
}

/** The recorded session `given` names: its id, or the start of its session id, eight characters or more. */
export function recordedNamed(sessions, given) {
  return sessions.find((entry) => entry.id === given || (given.length >= 8 && String(entry.sessionId ?? '').startsWith(given))) ?? null;
}

/** The folder of the worktree a recorded session works in, or null for one started without a worktree: where claude
 * makes a worktree of that name, under the main checkout `root`. claude agents lists a session it just started in the
 * folder it was started from, so a record written before 2026-10-28 holds the main checkout as its `worktreePath`. */
export function worktreeOf(entry) {
  if (typeof entry.worktree !== 'string' || entry.worktree === '') return null;
  if (typeof entry.worktreePath === 'string' && path.basename(entry.worktreePath) === entry.worktree) return entry.worktreePath;
  return typeof entry.root === 'string' ? path.join(entry.root, '.claude', 'worktrees', entry.worktree) : null;
}

/** The sessions `sessions start` recorded for the project at `root`, those not removed, by the folder each works in:
 * `{ items }`, each `{ id, folder }`, its session id and its worktree, or the folder it was started in when it has none;
 * or `{ items: [], unavailable }` when the record could not be read. claude writes a session's transcript under the
 * folder it works in, so one in a worktree is not among the main checkout's. */
export function recordedFolders(home, root, { readFile, platform = process.platform } = {}) {
  const record = readRecord(home, { readFile });
  if (record.unavailable !== undefined) return { items: [], unavailable: record.unavailable };
  const ours = record.sessions.filter((entry) => typeof entry.root === 'string' && typeof entry.sessionId === 'string' && within(entry.root, root, platform) && within(root, entry.root, platform));
  return { items: ours.map((entry) => ({ id: entry.sessionId, folder: worktreeOf(entry) ?? entry.cwd ?? entry.root })) };
}

const lostSaid = (result) => result.status !== 0 && /no job matching/i.test(saidBy(result));

/** Stops and removes the recorded session `entry` with `claude stop` and `claude rm`, deletes the copy of its brief,
 * then records the removal: `{ outcome: 'removed', worktreeKept, worktreeGone }`, or `'gone'` when claude no longer
 * knows it, or `{ outcome: 'kept', why }` when claude refused or the brief could not be deleted, which keeps it
 * recorded, so a second run finishes it. `worktreeKept` is the session's worktree when it is still there: claude keeps
 * one that holds uncommitted changes (odd/tasks/background-sessions.md, L10); `worktreeGone` is the one it removed. */
export function undoSession(entry, { home, run, now }) {
  const stopped = run(['stop', entry.id]);
  if ((stopped.error || stopped.status !== 0) && !lostSaid(stopped)) return { outcome: 'kept', why: `claude stop ${entry.id}: ${saidBy(stopped)}` };
  const removed = run(['rm', entry.id]);
  if ((removed.error || removed.status !== 0) && !lostSaid(removed)) return { outcome: 'kept', why: `claude rm ${entry.id}: ${saidBy(removed)}` };
  if (typeof entry.brief === 'string') {
    try {
      fs.rmSync(entry.brief, { force: true });
    } catch (err) {
      return { outcome: 'kept', why: `its brief ${entry.brief} could not be deleted (${err.code ?? err.message})` };
    }
  }
  appendRecord(home, { event: 'removed', at: new Date(now()).toISOString(), id: entry.id });
  const worktree = worktreeOf(entry);
  const kept = worktree !== null && fs.existsSync(worktree);
  return { outcome: lostSaid(stopped) && lostSaid(removed) ? 'gone' : 'removed', worktreeKept: kept ? worktree : null, worktreeGone: worktree !== null && !kept ? worktree : null };
}

/** A session at work: busy, or waiting on something (a permission prompt). */
export const atWork = (agent) => agent?.status === 'busy' || agent?.status === 'waiting' || agent?.state === 'working';

/** The machine uninstall's part (S3): every recorded session undone as `sessions stop` does, except one at work, which
 * is kept; once none is left and every line of the record was read, the folder goes. `{ undone, kept, removedDir,
 * failed }`, each kept one with `settle`: `'at-work'`, `'refused'` (claude refused) or `'unknown'` (claude agents
 * could not say whether it is at work). A line that is not an entry may name a session that still runs, so it keeps the
 * folder and fails. */
export function undoBackground(home, { run, now = Date.now } = {}) {
  const record = readRecord(home);
  if (record.unavailable !== undefined) return { undone: [], kept: [], failed: `${recordFileOf(home)} could not be read (${record.unavailable}): the background sessions it records are not undone; run js-harness uninstall machine again` };
  const undone = [];
  const kept = [];
  if (record.sessions.length > 0) {
    let agents;
    try {
      agents = listAgents(run);
    } catch (err) {
      return { undone, kept: record.sessions.map((entry) => ({ entry, settle: 'unknown', why: `it cannot be told whether it is at work: ${err.message}` })), failed: null };
    }
    for (const entry of record.sessions) {
      const agent = agents.find((item) => item.id === entry.id);
      if (atWork(agent)) {
        kept.push({ entry, settle: 'at-work', why: `it is ${agent.status ?? agent.state}` });
        continue;
      }
      const done = undoSession(entry, { home, run, now });
      if (done.outcome === 'kept') kept.push({ entry, settle: 'refused', why: done.why });
      else undone.push({ entry, outcome: done.outcome, worktreeKept: done.worktreeKept });
    }
  }
  const dir = backgroundDir(home);
  if (record.skipped > 0) {
    const lines = `${record.skipped} line${record.skipped === 1 ? '' : 's'} of ${recordFileOf(home)} ${record.skipped === 1 ? 'is not an entry' : 'are not entries'} it can read`;
    return { undone, kept, removedDir: null, failed: `${lines}, so ${dir} is kept: a session such a line names may still run, and claude agents lists them` };
  }
  if (kept.length > 0 || !fs.existsSync(dir)) return { undone, kept, removedDir: null, failed: null };
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return { undone, kept, removedDir: dir, failed: null };
  } catch (err) {
    return { undone, kept, removedDir: null, failed: `could not remove ${dir} (${err.code ?? err.message}); run js-harness uninstall machine again` };
  }
}

/** Whether `child` is `parent` or inside it, as Windows compares paths when `platform` is win32. */
export function within(child, parent, platform = process.platform) {
  const paths = platform === 'win32' ? path.win32 : path;
  const fold = (text) => (platform === 'win32' ? paths.resolve(text).toLowerCase() : paths.resolve(text));
  const rel = paths.relative(fold(parent), fold(child));
  return rel === '' || (!rel.startsWith('..') && !paths.isAbsolute(rel));
}

/** The board's fact (S4): the background sessions `agents` lists whose folder is the project's (`roots`, its main
 * checkout and worktrees), each marked by whether the record of this project holds it, plus a recorded one claude no
 * longer lists. */
export function backgroundOf(agents, { roots, recorded, platform = process.platform }) {
  const ours = new Map(recorded.map((entry) => [entry.id, entry]));
  const items = agents
    .filter((agent) => agent?.kind === 'background' && typeof agent.cwd === 'string' && roots.some((root) => within(agent.cwd, root, platform)))
    .map((agent) => ({
      id: agent.id ?? String(agent.sessionId ?? '').slice(0, 8),
      sessionId: agent.sessionId ?? null,
      title: agent.name ?? null,
      status: agent.status ?? null,
      state: agent.state ?? null,
      ...(agent.waitingFor ? { waitingFor: agent.waitingFor } : {}),
      cwd: agent.cwd,
      startedAt: Number.isFinite(agent.startedAt) ? new Date(agent.startedAt).toISOString() : null,
      recorded: ours.has(agent.id),
      listed: true,
    }));
  for (const entry of recorded) {
    if (!items.some((item) => item.id === entry.id)) items.push({ id: entry.id, sessionId: entry.sessionId ?? null, title: entry.title, status: null, state: null, cwd: entry.cwd, startedAt: entry.at, recorded: true, listed: false });
  }
  return items;
}

/** How a background session stands, in words: `waiting for <what>`, or its status with its state beside it. */
function standing(item) {
  if (!item.listed) return 'not listed by claude agents';
  if (item.status === 'waiting') return `waiting for ${item.waitingFor ?? 'something'}`;
  const words = [item.status, item.state].filter(Boolean);
  if (words.length === 0) return 'unknown';
  return words.length === 2 && words[0] !== words[1] ? `${words[0]} (${words[1]})` : words[0];
}

/** The board's lines for the fact; `ago(iso)` says how long ago an instant was. */
export function backgroundLines(fact, ago) {
  const title = 'Background sessions  started with claude --bg, from claude agents --json --all; js-harness sessions stop <id> removes one js-harness started';
  if (!fact.available) return [title, `  unavailable: ${fact.reason}`, ''];
  const rows = fact.items.map((item) => {
    const whose = item.recorded ? 'recorded by js-harness sessions start' : 'not started by js-harness';
    return `  ${item.id}  ${item.title ?? '(no title)'}  ${standing(item)}  started ${ago(item.startedAt)}  ${item.cwd}  ${whose}`;
  });
  return [title, ...(rows.length === 0 ? ['  none'] : rows), ...(fact.skipped > 0 ? [`  ${fact.skipped} line${fact.skipped === 1 ? '' : 's'} of the record could not be read`] : []), ''];
}

/** The changes a watch returns for (S4): a background session that waits now and did not before. Nothing is compared
 * when either look could not read the listing. */
export function backgroundChanges(before, after) {
  if (!before?.available || !after?.available) return [];
  const waited = new Set(before.items.filter((item) => item.status === 'waiting').map((item) => item.id));
  return after.items
    .filter((item) => item.status === 'waiting' && !waited.has(item.id))
    .map((item) => `background session ${item.id} · ${item.title ?? '(no title)'} waits for ${item.waitingFor ?? 'something'}`);
}

/** The board's background sessions (S4), from one listing (`list`) and the record under `home`: those in the folders of
 * `root` and its `worktrees`, marked by whether the record of this project holds them. A failure is unavailable, never
 * none. */
export function boardBackground({ home, root, worktrees, list, platform = process.platform, readFile }) {
  try {
    const record = readRecord(home, { readFile });
    if (record.unavailable !== undefined) throw new Error(`the record of background sessions could not be read (${record.unavailable})`);
    const roots = [root, ...(worktrees.available ? worktrees.items.map((tree) => tree.path) : [])];
    const recorded = record.sessions.filter((entry) => entry.root === root);
    return { available: true, items: backgroundOf(list(), { roots, recorded, platform }), skipped: record.skipped };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}
