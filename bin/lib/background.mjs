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

/** The arguments of `claude` that start the session. `--add-dir` lets it read its brief's copy without a prompt; it
 * takes several folders, so it comes first and `-n` ends it. */
export function startArgs({ title, briefs, worktree, model, effort, remoteControl, prompt }) {
  return [
    '--bg', '--add-dir', briefs, '-n', title,
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
 * cwd })` gives `{ status, stdout, stderr, error }`. A `.cmd` shim runs as one command line through the shell. */
export function claudeRunner({ env = process.env, platform = process.platform, spawn = spawnSync, timeout = 60000 } = {}) {
  const claude = resolveClaude({ env, platform });
  if (claude === null) return null;
  return (args, { cwd } = {}) => {
    const options = { cwd, env, encoding: 'utf8', windowsHide: true, timeout };
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

/** Appends `entry` to the record under `home`, stamped with the schema. */
export function appendRecord(home, entry) {
  fs.mkdirSync(backgroundDir(home), { recursive: true });
  fs.appendFileSync(recordFileOf(home), `${JSON.stringify({ schema: BACKGROUND_SCHEMA, ...entry })}\n`);
}

/** The sessions the record under `home` holds, those started and not removed: `{ sessions }`, a list of their start
 * entries, oldest first; `{ none: true }` when there is no record; `{ unavailable }` when it could not be read. A line
 * that is not an entry of this schema is skipped and counted (`skipped`). */
export function readRecord(home, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(recordFileOf(home));
  } catch (err) {
    return err.code === 'ENOENT' ? { none: true, sessions: [] } : { unavailable: err.code ?? err.message };
  }
  const open = new Map();
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
    else if (entry.event === 'started') open.set(entry.id, entry);
    else if (entry.event === 'removed') open.delete(entry.id);
    else skipped += 1;
  }
  return { sessions: [...open.values()], skipped };
}

/** The recorded session `given` names: its id, or the start of its session id, eight characters or more. */
export function recordedNamed(sessions, given) {
  return sessions.find((entry) => entry.id === given || (given.length >= 8 && String(entry.sessionId ?? '').startsWith(given))) ?? null;
}

const lostSaid = (result) => result.status !== 0 && /no job matching/i.test(saidBy(result));

/** Stops and removes the recorded session `entry` with `claude stop` and `claude rm`, then records the removal and
 * deletes the copy of its brief: `{ outcome: 'removed' }`, or `'gone'` when claude no longer knows it, or `{ outcome:
 * 'kept', why }` when claude refused, which keeps it recorded. */
export function undoSession(entry, { home, run, now }) {
  const stopped = run(['stop', entry.id]);
  if ((stopped.error || stopped.status !== 0) && !lostSaid(stopped)) return { outcome: 'kept', why: `claude stop ${entry.id}: ${saidBy(stopped)}` };
  const removed = run(['rm', entry.id]);
  if ((removed.error || removed.status !== 0) && !lostSaid(removed)) return { outcome: 'kept', why: `claude rm ${entry.id}: ${saidBy(removed)}` };
  appendRecord(home, { event: 'removed', at: new Date(now()).toISOString(), id: entry.id });
  if (typeof entry.brief === 'string') fs.rmSync(entry.brief, { force: true });
  return { outcome: lostSaid(stopped) && lostSaid(removed) ? 'gone' : 'removed' };
}

/** A session at work: busy, or waiting on something (a permission prompt). */
export const atWork = (agent) => agent?.status === 'busy' || agent?.status === 'waiting' || agent?.state === 'working';

/** The machine uninstall's part (S3): every recorded session undone as `sessions stop` does, except one at work, which
 * is kept; once none is left, the folder goes. `{ undone, kept, removedDir, failed }`. */
export function undoBackground(home, { run, now = Date.now } = {}) {
  const record = readRecord(home);
  if (record.unavailable !== undefined) return { undone: [], kept: [], failed: `${recordFileOf(home)} could not be read (${record.unavailable})` };
  const undone = [];
  const kept = [];
  if (record.sessions.length > 0) {
    let agents;
    try {
      agents = listAgents(run);
    } catch (err) {
      return { undone, kept: record.sessions.map((entry) => ({ entry, why: `it cannot be told whether it is at work: ${err.message}` })), failed: null };
    }
    for (const entry of record.sessions) {
      const agent = agents.find((item) => item.id === entry.id);
      if (atWork(agent)) {
        kept.push({ entry, why: `it is ${agent.status ?? agent.state}` });
        continue;
      }
      const done = undoSession(entry, { home, run, now });
      if (done.outcome === 'kept') kept.push({ entry, why: done.why });
      else undone.push({ entry, outcome: done.outcome });
    }
  }
  const dir = backgroundDir(home);
  if (kept.length > 0 || !fs.existsSync(dir)) return { undone, kept, removedDir: null, failed: null };
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return { undone, kept, removedDir: dir, failed: null };
  } catch (err) {
    return { undone, kept, removedDir: null, failed: `could not remove ${dir} (${err.code ?? err.message})` };
  }
}

/** Whether `child` is `parent` or inside it, as Windows compares paths when `platform` is win32. */
function within(child, parent, platform) {
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
