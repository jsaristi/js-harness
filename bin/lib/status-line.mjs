// The line Claude Desktop's `sessionStatusLine` would show above the message box: the board said in one Spanish line,
// and the file it is kept in. The board takes about 24 s and the host stops its program at 10 s, so the program
// (`status-line.ps1`, beside this file) only prints this file, which `js-harness status-line write` keeps
// (odd/tasks/status-line.md, Design and L8). Today the app reads the key only on third-party inference.
import fs from 'node:fs';
import path from 'node:path';

/** The most the host shows of the line (the status-line doc, "Output"). */
export const LINE_LIMIT = 200;

const RED = '\u001b[31m';
const RESET = '\u001b[0m';

const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The board (`js-harness sessions --json`) in one line: the questions that wait for him, red when any does, the
 * sessions working and waiting, the open pull requests and the gate. What the board could not read is `?`. */
export function statusLineOf(board) {
  const open = board.questions?.open;
  const questions = Array.isArray(open) ? counted(open.length, 'pregunta', 'preguntas') : '? preguntas';
  const states = (board.sessions ?? []).map((session) => session.state);
  const prs = board.pullRequests?.available ? `${board.pullRequests.items.length} PR` : '? PR';
  const lock = board.gateLock;
  const gate = !lock?.available ? 'gate ?' : lock.holder ? `gate ocupado${lock.waiters?.length ? `, ${lock.waiters.length} en cola` : ''}` : 'gate libre';
  const parts = [
    Array.isArray(open) && open.length > 0 ? `${RED}${questions}${RESET}` : questions,
    `${states.filter((state) => state === 'working').length} trabajando`,
    `${states.filter((state) => state === 'waiting').length} esperando`,
    prs,
    gate,
  ];
  return parts.join(' · ').slice(0, LINE_LIMIT);
}

/** Where the line is kept under the home `home`. */
export function statusLineFile(home) {
  return path.join(home, '.js-harness', 'status-line', 'line.txt');
}

/** How many times the rename is tried, and the wait between tries: a reader such as the program, an antivirus or the
 * indexer holds the file without delete sharing for a moment, and Windows then refuses the rename with EPERM. */
const RENAME_TRIES = 5;
const RENAME_WAIT_MS = 50;

/** Writes the time `now` and `line` to the line file, whole: to a file beside it first, then renamed over it, so the
 * program never reads half a line. A rename refused while the file is held is tried again; one never made throws, and
 * the file beside it is removed. Returns the file's path. */
export function writeStatusLine({ home, line, now, fileSystem = fs }) {
  const file = statusLineFile(home);
  fileSystem.mkdirSync(path.dirname(file), { recursive: true });
  const staged = `${file}.${process.pid}.tmp`;
  fileSystem.writeFileSync(staged, `${new Date(now).toISOString()}\n${line}\n`, 'utf8');
  try {
    for (let tried = 1; ; tried += 1) {
      try {
        fileSystem.renameSync(staged, file);
        return file;
      } catch (err) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(err.code) || tried === RENAME_TRIES) throw err;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_WAIT_MS);
      }
    }
  } finally {
    fileSystem.rmSync(staged, { force: true });
  }
}
