// The fixed context load of a session: what Claude Code sent at the first turn of this project's latest
// sessions, read from their own transcripts — see odd/tasks/fixed-load.md. Read-only: it reads files,
// never starts a host. The first turn is the fixed load (system prompt, tools, memory files, skills) plus
// the first message. The median of several sessions is the measure: a large first message (a brief, a resume
// prompt) raises one session and a headless `claude -p` run, which loads fewer tools, lowers one; neither moves it.
import fs from 'node:fs';
import path from 'node:path';

/** His "100 mil" (2026-10-15, odd/tasks/fixed-load.md S6), until he sets another (D1). */
export const FIXED_LOAD_BUDGET = 100_000;

const SESSIONS = 5;
const CHUNK = 64 * 1024;
// A first turn is near the top of a transcript; a file that has none in its first 8 MiB is not read further.
const READ_LIMIT = 8 * 1024 * 1024;

/** The transcript folder name Claude Code uses for a project: its resolved path with every character
 * outside `[A-Za-z0-9]` replaced by `-` (`D:\js-harness` -> `D--js-harness`). */
function projectSlug(dir) {
  return path.resolve(dir).replace(/[^A-Za-z0-9]/g, '-');
}

/** The main checkout of a worktree at `cwd`, from its `.git` file (`gitdir: <main>/.git/worktrees/<name>`),
 * or `null` when `cwd` is not a linked worktree. Reads the file; runs no git. */
function mainCheckout(cwd) {
  let text;
  try {
    text = fs.readFileSync(path.join(cwd, '.git'), 'utf8');
  } catch {
    return null; // a directory (`.git` of a main checkout) or no git at all
  }
  const gitdir = text.match(/^gitdir:\s*(.+?)\s*$/m)?.[1];
  const main = gitdir?.match(/^(.*)[\\/]\.git[\\/]worktrees[\\/][^\\/]+$/)?.[1];
  return main ? path.resolve(cwd, main) : null; // a relative gitdir is relative to the worktree
}

/** The input of the first assistant record of a transcript that is not a subagent's: `{ at, tokens }`, or
 * `null` when there is none yet or the file cannot be read (the row informs; a read error never fails a
 * gate). Reads in chunks and stops at that record, so a long session costs little. A line is kept as the
 * byte pieces it arrived in and decoded once whole: a long line is not scanned again at every read, and a
 * character cut between two reads is not broken. */
function firstTurn(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return null;
  }
  try {
    const buffer = Buffer.alloc(CHUNK);
    let pieces = [];
    for (let offset = 0; offset < READ_LIMIT; ) {
      const read = fs.readSync(fd, buffer, 0, CHUNK, offset);
      if (read === 0) return turnOf(Buffer.concat(pieces).toString('utf8'));
      offset += read;
      let start = 0;
      for (let end = buffer.indexOf(0x0a, start); end !== -1 && end < read; end = buffer.indexOf(0x0a, start)) {
        pieces.push(buffer.subarray(start, end));
        const turn = turnOf(Buffer.concat(pieces).toString('utf8'));
        if (turn) return turn;
        pieces = [];
        start = end + 1;
      }
      // The buffer is read into again, so the unfinished line keeps a copy of its bytes.
      if (start < read) pieces.push(Buffer.from(buffer.subarray(start, read)));
    }
    return null;
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/** `{ at, tokens }` when `line` is a main-thread assistant record with usage, else `null`. */
function turnOf(line) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return null;
  }
  const usage = record?.message?.usage;
  if (record?.type !== 'assistant' || record.isSidechain || !usage) return null;
  const count = (key) => (Number.isFinite(usage[key]) ? usage[key] : 0);
  const tokens = count('input_tokens') + count('cache_creation_input_tokens') + count('cache_read_input_tokens');
  return { at: record.timestamp ?? null, tokens };
}

/** The transcripts of the project at `cwd` (and, from a worktree, of its main checkout), newest first. */
function transcripts(home, cwd) {
  const projects = [cwd, mainCheckout(cwd)].filter(Boolean);
  const files = projects.flatMap((project) => {
    const dir = path.join(home, '.claude', 'projects', projectSlug(project));
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    return names
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => {
        const file = path.join(dir, name);
        try {
          return { id: path.basename(name, '.jsonl'), file, mtime: fs.statSync(file).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  });
  return files.sort((a, b) => b.mtime - a.mtime);
}

/** The middle value of `values`, the lower of the two middle ones for an even count: always a measured value. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** The first-turn input of the newest `SESSIONS` sessions of the project that have one (newest by their
 * transcript's last write), newest first, and their median (`null` with none). */
export function measureFixedLoad({ home, cwd }) {
  const sessions = [];
  for (const { id, file } of transcripts(home, cwd)) {
    if (sessions.length === SESSIONS) break;
    const turn = firstTurn(file);
    if (turn) sessions.push({ id, ...turn });
  }
  const typical = sessions.length ? median(sessions.map((s) => s.tokens)) : null;
  return { sessions, median: typical };
}

/** The `fixed load` row of `check`: informs, never fails, and warns over `FIXED_LOAD_BUDGET`. */
export function fixedLoadRow(cwd, home) {
  const { sessions, median: typical } = measureFixedLoad({ home, cwd });
  const row = { name: 'fixed load', pass: true, info: true };
  if (typical === null) return { ...row, detail: 'no session transcript of this project found', lines: [] };
  const plural = sessions.length === 1 ? 'session' : 'sessions';
  const detail = `${typical} tokens at the first turn, median of the latest ${sessions.length} ${plural} (budget ${FIXED_LOAD_BUDGET})`;
  const lines = sessions.map((s) => `${String(s.tokens).padStart(9)}  ${s.at ?? 'no time'}  ${s.id}`);
  if (typical > FIXED_LOAD_BUDGET) {
    lines.push(`warning: the fixed load is over its budget of ${FIXED_LOAD_BUDGET} tokens (odd/tasks/fixed-load.md)`);
  }
  return { ...row, detail, lines };
}
