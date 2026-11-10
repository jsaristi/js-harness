// The files the board reads whole or in part: the orchestrator's relief file, the tail of a transcript, and the file a
// running piece of work writes (moved here from bin/sessions.mjs, which was at its size ceiling).

import fs from 'node:fs';
import path from 'node:path';

/** How many lines of the relief file the board prints: enough to see what the orchestrator noted last,
 * and whoever needs the rest reads the file. */
export const RELIEF_LINES = 5;

/** The text of an orchestrator's relief file as the board shows it: how many lines it holds and the last
 * `count` of them. It is one dated line per event, so a blank line is not one. */
export function reliefTail(text, count = RELIEF_LINES) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  return { lineCount: lines.length, lines: lines.slice(lines.length - Math.min(count, lines.length)) };
}

/** The relief file at `file` as the board shows it: `{ path, exists: true, lineCount, lines }`, `{ path,
 * exists: false }` when there is none yet, or `{ path, unavailable }` with the reason when it is there
 * and cannot be read. */
export function readRelief(file, readFile) {
  try {
    return { path: file, exists: true, ...reliefTail(readFile(file)) };
  } catch (err) {
    return err.code === 'ENOENT' ? { path: file, exists: false } : { path: file, unavailable: err.code ?? err.message };
  }
}

/** The last `bytes` of `file` as text; its first line may be cut, and the transcript parser skips it. */
export function tailOfFile(file, bytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
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
export function workFile(work, { sessionDir, tasksDir }, io) {
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
