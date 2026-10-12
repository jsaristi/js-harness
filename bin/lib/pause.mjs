// The context pause, as one library: `pauseNotice` is run by the hook after every tool call of a session,
// so it reads the end of the session's transcript and nothing more, and says the pause to the session once.
// Another hook (a `Stop` one) imports the same function, so the rule lives here and in the constants of
// `./sessions.mjs`, and nowhere else. Zero dependencies: it imports only `node:fs`, `node:os`, `node:path` and `./sessions.mjs`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, shareOf } from './sessions.mjs';

/** The most of a transcript's end that the hook reads, in bytes. The hook runs after every tool call, so a
 * file of megabytes costs what this many bytes cost: the end is all it may look at. */
const END_BYTES = 262144;

/** The most of a transcript's end that the hook reads while it looks for a reply with usage. The first `END_BYTES`
 * may hold only one large tool result after the last reply, and the reply before it is still the session's count,
 * so the read grows; past this bound a file with no such reply costs no more than this many bytes. */
const END_MAX_BYTES = 8388608;

/** The shape `bin/resume.mjs` accepts for a session id, since the id becomes a file name. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,}$/;

/** The compaction point of a session that has measured none: the share the host compacts at, in tokens. */
const DEFAULT_COMPACTION = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT);

/** The least compaction point a measure may give: a tenth of the default, because no window the host offers is a
 * tenth of the default. A point under it is a broken measure (a zero would put every reply past the pause), so
 * it is read as if it were absent. */
const LEAST_COMPACTION = DEFAULT_COMPACTION / 10;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `point` when it is a compaction point a measure may give, else `null`. */
const pointOf = (point) => (Number.isFinite(point) && point >= LEAST_COMPACTION ? point : null);

/** The text of `count` with a comma between each group of three digits: what a person reads for tokens. */
const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The pause point for a compaction point: the pause's share, on the same scale as the compaction's share
 * of the window (both shares are read from `./sessions.mjs`, so the point moves with the compaction). */
const pauseAt = (compaction) => Math.round((compaction * DEFAULT_CONTEXT_PAUSE_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT);

/** An entry's `JSON` object, or `null` for a line that does not parse or that is not an object. */
function objectOf(line) {
  try {
    const value = JSON.parse(line);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

/** The tokens a reply was sent with, when the entry is the session's own reply with usage: the rule of
 * `contextOf` in `./sessions.mjs`, so the two readers of a transcript agree. `null` for any other entry, and
 * for a reply that counts zero (the harness writes those for itself). */
function tokensOf(entry) {
  if (entry.type !== 'assistant' || entry.isSidechain || !isObject(entry.message) || entry.message.model === '<synthetic>') return null;
  const { usage } = entry.message;
  if (!isObject(usage) || !Number.isFinite(usage.input_tokens)) return null;
  const counted = (value) => (Number.isFinite(value) ? value : 0);
  const tokens = usage.input_tokens + counted(usage.cache_read_input_tokens) + counted(usage.cache_creation_input_tokens);
  return tokens > 0 ? tokens : null;
}

/** The `preTokens` of a compaction the host made by itself, or `null` for any other entry (a manual one is
 * the user's, and a boundary without a count says nothing about the point). A count under the least point is
 * `null` too, so the scan goes on to an earlier boundary. */
function automaticCompactionOf(entry) {
  if (entry.type !== 'system' || entry.subtype !== 'compact_boundary' || !isObject(entry.compactMetadata)) return null;
  const { compactMetadata: said } = entry;
  return said.trigger === 'auto' ? pointOf(said.preTokens) : null;
}

/** What the end of a transcript says: its last own reply's tokens and the last automatic compaction's
 * `preTokens`, from the lines of `text` read from the end. The lines are only parsed when they can hold one
 * of the two, which keeps a call cheap on a piece of a quarter megabyte. */
function endOf(text) {
  let tokens = null;
  let compaction = null;
  const lines = text.split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.includes('usage') && !line.includes('compact_boundary')) continue;
    const entry = objectOf(line);
    if (entry === null) continue;
    if (tokens === null) tokens = tokensOf(entry);
    if (compaction === null) compaction = automaticCompactionOf(entry);
    if (tokens !== null && compaction !== null) break;
  }
  return tokens === null ? null : { tokens, compaction };
}

/** The bytes of `fd` from `from` up to `to`, in as many reads as the file system takes: fewer when the file ends. */
function readBack(fileSystem, fd, from, to) {
  const piece = Buffer.alloc(Math.max(0, to - from));
  let done = 0;
  while (done < piece.length) {
    const read = fileSystem.readSync(fd, piece, done, piece.length - done, from + done);
    if (read === 0) break;
    done += read;
  }
  return piece.subarray(0, done);
}

/** The end of a session's transcript: `{ tokens, compaction }`, or `null` when the file cannot be read or
 * holds no reply with usage in its end. It reads the last `bytes` of the file (open, read at an offset, close;
 * never the whole file). When that piece holds no reply with usage, which one large tool result after the last
 * reply is enough to cause, it reads a longer end, four times as long each time, up to `maxBytes`, and stops at
 * the first piece that holds one or at the whole file. Only the bytes before the piece read so far are read on a
 * longer end, so the bytes read in all are the longest piece and never more than `maxBytes`. The first line of a
 * piece may be cut, which is why a line that does not parse is skipped rather than fatal. `compaction` is the
 * `preTokens` of the last automatic compaction in the piece that was read, or `null`: it is what the session held
 * when the host last compacted it by itself. */
export function readEnd(file, { bytes = END_BYTES, maxBytes = END_MAX_BYTES, fileSystem = fs } = {}) {
  let fd;
  try {
    fd = fileSystem.openSync(file, 'r');
    const { size } = fileSystem.fstatSync(fd);
    let piece = Buffer.alloc(0);
    let want = Math.max(1, Math.min(bytes, maxBytes));
    for (;;) {
      const start = Math.max(0, size - want);
      piece = Buffer.concat([readBack(fileSystem, fd, start, size - piece.length), piece]);
      const end = endOf(piece.toString('utf8'));
      if (end !== null || start === 0 || want >= maxBytes) return end;
      want = Math.min(want * 4, maxBytes);
    }
  } catch {
    return null;
  } finally {
    try {
      if (fd !== undefined) fileSystem.closeSync(fd);
    } catch {
      // the look is over either way, and a file that cannot be closed must not cost the session its notice
    }
  }
}

/** The state file of a session: `<home>/.js-harness/channel/pause/<sessionId>.json`. It is the record of
 * when a session was told the pause, which a measure reads later, and of the compaction point the session
 * was seen to have. A session id that is not of the shape of one throws, since it becomes a file name. */
export function statePath(home, sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new TypeError(`not a session id: ${JSON.stringify(sessionId)}`);
  return path.join(home, '.js-harness', 'channel', 'pause', `${sessionId}.json`);
}

const freshState = () => ({ compaction: null, armed: true, told: [] });

/** The states the places hold: each place that is readable, in the order of `files`. A place that is missing,
 * unreadable or unparseable holds none and is passed over. */
function readStates(files, fileSystem) {
  return files.map((file) => readStateFile(file, fileSystem)).filter((state) => state !== null);
}

/** The newest of `states`, or `null` when there is none. A state stamped with its write's time is newer than one
 * with no stamp, which a state written before stamps were kept is, and a tie keeps the state that comes first.
 * The newest is the one a session reads: a place written before the other one, and then made unwritable, must
 * not speak for the session again. */
function newestOf(states) {
  const rank = (state) => state.written ?? -Infinity;
  return states.reduce((newest, state) => (newest === null || rank(state) > rank(newest) ? state : newest), null);
}

/** The state a session holds: the newest of the places, or the state of a session never told and armed when
 * no place holds one, so a crossing tells it. */
function readState(files, fileSystem) {
  return newestOf(readStates(files, fileSystem)) ?? freshState();
}

/** One place of the state, or `null` when the file cannot be read or does not parse as a state. `written` is the
 * time the state was written, in milliseconds, or `null` for a state that carries none. */
function readStateFile(file, fileSystem) {
  try {
    const value = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
    if (!isObject(value)) return null;
    const written = typeof value.written === 'string' ? Date.parse(value.written) : NaN;
    return {
      compaction: pointOf(value.compaction),
      armed: typeof value.armed === 'boolean' ? value.armed : true,
      told: Array.isArray(value.told) ? value.told : [],
      written: Number.isFinite(written) ? written : null,
    };
  } catch {
    return null;
  }
}

/** Writes the state, stamped with the time of this write, to the first of `files` that takes it, and says whether
 * one did. Each place is written as a temp file beside it that is renamed over it, so a reader never sees half of it. */
function writeState(files, state, fileSystem, now) {
  const stamped = { ...state, written: new Date(now()).toISOString() };
  return files.some((file) => writeStateFile(file, stamped, fileSystem));
}

/** Writes one place of the state, `true` when it is kept there. A write that fails leaves nothing behind: the
 * rename is the last step, and a temp file that outlived a failed one is removed, its own failure swallowed. */
function writeStateFile(file, state, fileSystem) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    fileSystem.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fileSystem.renameSync(temp, file);
    return true;
  } catch {
    try {
      fileSystem.unlinkSync(temp);
    } catch {
      // there may be no temp file to remove: the write failed before it was made, and that is no reason to fail again
    }
    return false;
  }
}

/** What the session is told at the pause: its share of the window, the compaction it is measured against
 * and the room left before it, as whole numbers, with the text the session reads. The window is the
 * compaction point of the session scaled to the share the host compacts at, so a session on a window of a
 * different size is measured against its own compaction and not against the default. */
function noticeOf(tokens, compaction) {
  const window = (compaction * 100) / DEFAULT_CONTEXT_COMPACTION_PERCENT;
  const whole = Math.round(tokens);
  const share = percentOf(whole, window);
  const room = Math.round(Math.max(0, compaction - tokens));
  const text = `js-harness: this session holds ${share}% of its context window, and the host compacts it at about ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%: about ${thousands(room)} tokens are left. This is the context pause. Now write your state where it is read after a compaction (the "Next step" of the session's feature document, committed; the relief file for an orchestrator), say this share to the user in your next reply with the two blocks of a cut, once, and then go on with the task.`;
  return { tokens: whole, share, compactionShare: DEFAULT_CONTEXT_COMPACTION_PERCENT, room, text };
}

/** The places a session's state is kept in, the state file under `home` first and then the file of the same name in
 * `tmpdir`. A session id that is not of the shape of one throws, from `statePath`. */
function placesOf(home, sessionId, tmpdir) {
  return [statePath(home, sessionId), path.join(tmpdir, `js-harness-pause-${sessionId}.json`)];
}

/** The context pause for a session, run after every tool call: `null`, or the notice the one time a stretch
 * of work passes the pause. A stretch is told by the context falling under the pause again, which a
 * compaction does, and not by looking for a boundary, which may be megabytes before the end of the file.
 * So the state holds one flag: armed, which a crossing disarms and an under-the-pause call re-arms.
 *
 * The session's compaction point is the one its own transcript measured, else the one remembered in its
 * state, else the default, and the pause is that point scaled to the share the host compacts at. A state is
 * written only when something in it changes (a re-arm, a crossing, a new point), so under the pause with
 * nothing new no file is made.
 *
 * The state is kept in its file under `home`, or, when that cannot be written, in a file of the same name in
 * `tmpdir`. A read takes the newer of the two (the stamp of each write decides), so a home that was written and
 * then became unwritable never speaks for the session over the newer state kept in the temp folder. A crossing gives the notice only when the disarmed state was kept in one of them: when neither
 * takes it the session is not told, and the board and the reply check still say the pause. Telling a session
 * twice, once each time the write fails, would cost it the context the pause is there to protect. It never
 * throws for a transcript or a state it cannot read or write. */
export function pauseNotice({ transcript, sessionId, home, now = () => Date.now(), fileSystem = fs, tmpdir = os.tmpdir() } = {}) {
  const files = placesOf(home, sessionId, tmpdir);
  const end = readEnd(transcript, { fileSystem });
  if (end === null) return null;
  const state = readState(files, fileSystem);
  const compaction = end.compaction ?? state.compaction ?? DEFAULT_COMPACTION;
  const past = end.tokens >= pauseAt(compaction);
  const told = past && state.armed;
  const next = {
    compaction: end.compaction ?? state.compaction,
    armed: !past,
    told: told ? [...state.told, { at: new Date(now()).toISOString(), tokens: end.tokens }] : state.told,
  };
  if (told) return writeState(files, next, fileSystem, now) ? noticeOf(end.tokens, compaction) : null;
  if (next.armed !== state.armed || next.compaction !== state.compaction) writeState(files, next, fileSystem, now);
  return null;
}

/** What the session's state says about a stretch of its work: whether the session was told the pause at all, and
 * the tokens and time of the latest telling whose `at` is after `after` and before `before` (ISO strings, compared
 * as strings; a bound that is `null` is open). `known` is `false` when neither place holds a state, or when the
 * session id or the home cannot be read: the reader never throws for them. `at` and `tokens` are `null` when no
 * telling falls in the stretch. It reads the newer place, as `pauseNotice` does, and writes nothing. */
export function toldBetween({ home, sessionId, after = null, before = null, fileSystem = fs, tmpdir = os.tmpdir() } = {}) {
  const unknown = { known: false, at: null, tokens: null };
  let states;
  try {
    states = readStates(placesOf(home, sessionId, tmpdir), fileSystem);
  } catch {
    return unknown;
  }
  const state = newestOf(states);
  if (state === null) return unknown;
  const inside = (entry) => isObject(entry) && typeof entry.at === 'string'
    && (after === null || entry.at > after) && (before === null || entry.at < before);
  const latest = state.told.filter(inside).pop();
  if (latest === undefined) return { known: true, at: null, tokens: null };
  return { known: true, at: latest.at, tokens: Number.isFinite(latest.tokens) ? latest.tokens : null };
}
