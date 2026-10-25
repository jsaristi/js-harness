// The files the board reads whole or in part: the orchestrator's relief file, and the tail of a transcript.

import fs from 'node:fs';

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
