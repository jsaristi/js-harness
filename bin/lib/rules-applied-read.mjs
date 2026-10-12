// The reader of session records for `js-harness rules applied`: the sub-agent launches and the
// sessions of one project folder, each with the few fields the count needs. Its reads are bounded
// on purpose. A transcript is read only as far as its first assistant entry (a launch) or its last
// one (a session) that the engine did not write itself, in steps from 64 KB up to 1 MB, and only the
// recent files are picked, at most
// `maxFiles` of each kind. A read of every transcript, whole, loaded the machine before. The module
// prints nothing, reads no clock and no environment variable: the time is passed in as `now`.
import fs from 'node:fs';
import path from 'node:path';

const DAY_MS = 86_400_000;
const FIRST_READ = 64 * 1024;
const MAX_READ = 1024 * 1024;
const NO_LAUNCH = 'no assistant entry in the first 1 MB';
const NO_SESSION = 'no assistant entry in the last 1 MB';

/** The result when `projectDir` cannot be listed: nothing is found and nothing is capped. */
function emptyRecords() {
  return {
    exists: false,
    launches: [],
    sessions: [],
    unreadable: [],
    files: { launches: 0, sessions: 0 },
    capped: false,
  };
}

/** `value` when it is a non-empty text, else null. */
function text(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The entries of `dir` as dirents, or null when the folder cannot be listed. */
function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** The stats of `file`, or null when it cannot be stat'ed. */
function statOrNull(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

/**
 * The candidate for `abs` when it is a file modified at or after `since`, else null. `rel` is its
 * path from the project folder in forward slashes; a file that cannot be stat'ed is not recent.
 */
function recentFile(rel, abs, since) {
  const st = statOrNull(abs);
  if (!st || !st.isFile() || !(st.mtimeMs >= since)) return null;
  return { rel, abs, size: st.size, mtimeMs: st.mtimeMs };
}

/** Sorts candidates newest first, and two of the same time by their path. */
function newestFirst(files) {
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** Sorts unreadable entries by their file. */
function byFile(a, b) {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

/**
 * The recent `agent-*.jsonl` launches under `projectDir/<folder>/subagents`, newest first. Each
 * candidate carries the path of its meta file, which may not exist.
 */
function collectLaunches(projectDir, top, since) {
  const found = [];
  for (const dir of top) {
    if (!dir.isDirectory()) continue;
    const subagents = path.join(projectDir, dir.name, 'subagents');
    const names = listDir(subagents);
    if (!names) continue;
    for (const entry of names) {
      if (!/^agent-.*\.jsonl$/.test(entry.name)) continue;
      const abs = path.join(subagents, entry.name);
      const candidate = recentFile(`${dir.name}/subagents/${entry.name}`, abs, since);
      if (candidate) {
        found.push({ ...candidate, metaAbs: abs.replace(/\.jsonl$/, '.meta.json') });
      }
    }
  }
  return newestFirst(found);
}

/** The recent `*.jsonl` sessions directly in `projectDir`, newest first. */
function collectSessions(projectDir, top, since) {
  const found = [];
  for (const entry of top) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const candidate = recentFile(entry.name, path.join(projectDir, entry.name), since);
    if (candidate) found.push(candidate);
  }
  return newestFirst(found);
}

/** The read sizes to try for a file of `size` bytes: 64 KB, then doubling, up to 1 MB, never past the
 * file. The last size is the whole file when it fits, so reading it reads the whole file. */
function readSizes(size) {
  const sizes = [];
  for (let limit = FIRST_READ; ; limit = Math.min(limit * 2, MAX_READ)) {
    const len = Math.min(size, limit);
    sizes.push(len);
    if (len >= size || limit >= MAX_READ) return sizes;
  }
}

/** The `len` bytes of `file` from `position`, as text. The file is opened read-only and closed again,
 * also when the read throws. */
function readSpan(file, position, len) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(len);
    const got = fs.readSync(fd, buf, 0, len, position);
    return buf.toString('utf8', 0, got);
  } finally {
    fs.closeSync(fd);
  }
}

/** The lines of a read. A read that began after the file's start drops its first line, which may be
 * cut; a read that did not reach the file's end drops its last line, which may be cut too. */
function completeLines(data, { cutStart, cutEnd }) {
  const lines = data.split('\n');
  if (cutStart) lines.shift();
  if (cutEnd) lines.pop();
  return lines;
}

/** The assistant entry a transcript line holds, or null. A line that is not JSON, or is not an
 * assistant entry, is passed over and is never an error. */
function assistantEntry(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  return entry !== null && typeof entry === 'object' && entry.type === 'assistant' ? entry : null;
}

/** True when an assistant entry is one the engine wrote itself: its model is '<synthetic>', or it has
 * no model that is a non-empty text. */
function isSynthetic(entry) {
  const model = entry.message?.model;
  return model === '<synthetic>' || text(model) === null;
}

/**
 * The assistant entry a transcript gives, from reads of growing size. `linesOf(len)` gives the lines
 * of a read of `len` bytes in the order they are visited. The first entry that is not synthetic is
 * taken. A read that holds only synthetic entries goes on to the next size; when no read holds a
 * real one, the first synthetic entry seen is taken (the reads nest, so it is the one the last read
 * holds too). Gives `{ entry }`, or `{ reason }` when no read holds an assistant entry.
 */
function pickAssistant(sizes, linesOf, reason) {
  let synthetic = null;
  for (const len of sizes) {
    for (const line of linesOf(len)) {
      const entry = assistantEntry(line);
      if (!entry) continue;
      if (!isSynthetic(entry)) return { entry };
      if (!synthetic) synthetic = entry;
    }
  }
  return synthetic ? { entry: synthetic } : { reason };
}

/** The first assistant entry of a transcript that is not synthetic, read from its start in the sizes
 * of `readSizes`. Gives `{ entry }`, or `{ reason }` when no read reaches one. */
function firstAssistant(file, size) {
  return pickAssistant(
    readSizes(size),
    (len) => completeLines(readSpan(file, 0, len), { cutStart: false, cutEnd: len < size }),
    NO_LAUNCH,
  );
}

/** The last assistant entry of a transcript that is not synthetic, read from its end in the sizes of
 * `readSizes`. Gives `{ entry }`, or `{ reason }` when no read reaches one. */
function lastAssistant(file, size) {
  return pickAssistant(
    readSizes(size),
    (len) => {
      const start = size - len;
      return completeLines(readSpan(file, start, len), { cutStart: start > 0, cutEnd: false }).reverse();
    },
    NO_SESSION,
  );
}

/** The meta object of a launch, or null when the file is missing, is not JSON, or is not an object. */
function readMeta(file) {
  try {
    const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
    return meta !== null && typeof meta === 'object' ? meta : null;
  } catch {
    return null;
  }
}

/**
 * The item of a launch: the alias and agentType from its meta file where they are text, and the
 * effort and the other fields from the answer, as they are. The meta file's effort is not read: it
 * says what the call asked for, and the answer's effort is what the engine ran.
 */
function launchItem(candidate, entry) {
  const meta = readMeta(candidate.metaAbs) ?? {};
  return {
    alias: text(meta.model),
    model: entry.message?.model,
    effort: text(entry.effort),
    agentType: text(meta.agentType),
    entrypoint: entry.entrypoint,
    version: entry.version,
    at: entry.timestamp,
    file: candidate.rel,
  };
}

/** The item of a session: the entry's fields, with its effort when that is text. */
function sessionItem(candidate, entry) {
  return {
    model: entry.message?.model,
    effort: text(entry.effort),
    entrypoint: entry.entrypoint,
    version: entry.version,
    at: entry.timestamp,
    file: candidate.rel,
  };
}

/** Runs `read`, and gives its result, or `{ reason }` with the error's code when it throws. */
function attempt(read) {
  try {
    return read();
  } catch (err) {
    return { reason: err.code ?? err.message };
  }
}

/**
 * Reads the session records of one project folder as of `now` (milliseconds). A file is recent when
 * it was modified at or after `now - days` days. Gives `{ exists, launches, sessions, unreadable,
 * files, capped }`: the launches and sessions picked (at most `maxFiles` of each, the newest), the
 * picked files that gave no item with their reason, how many of each were picked, and whether any
 * recent file was left out by the cap. Never throws for a file or folder it cannot read; it throws
 * only for a `now` that is no number, which would turn the window off in silence.
 */
export function readRecords(projectDir, { now, days = 7, maxFiles = 500 }) {
  if (!Number.isFinite(now)) throw new Error('readRecords needs now as a time in milliseconds');
  const top = listDir(projectDir);
  if (top === null) return emptyRecords();
  const since = now - days * DAY_MS;
  const launchFiles = collectLaunches(projectDir, top, since);
  const sessionFiles = collectSessions(projectDir, top, since);
  const pickedLaunches = launchFiles.slice(0, maxFiles);
  const pickedSessions = sessionFiles.slice(0, maxFiles);

  const launches = [];
  const sessions = [];
  const unreadable = [];
  for (const candidate of pickedLaunches) {
    const found = attempt(() => firstAssistant(candidate.abs, candidate.size));
    if (found.entry) launches.push(launchItem(candidate, found.entry));
    else unreadable.push({ file: candidate.rel, reason: found.reason });
  }
  for (const candidate of pickedSessions) {
    const found = attempt(() => lastAssistant(candidate.abs, candidate.size));
    if (found.entry) sessions.push(sessionItem(candidate, found.entry));
    else unreadable.push({ file: candidate.rel, reason: found.reason });
  }

  return {
    exists: true,
    launches,
    sessions,
    unreadable: unreadable.sort(byFile),
    files: { launches: pickedLaunches.length, sessions: pickedSessions.length },
    capped: launchFiles.length > maxFiles || sessionFiles.length > maxFiles,
  };
}
