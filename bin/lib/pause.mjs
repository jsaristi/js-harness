// The context pause, as one library: `pauseNotice` is run by the hook after every tool call of a session,
// so it reads the end of the session's transcript and nothing more, and says the pause to the session once.
// Another hook (a `Stop` one) imports the same function, so the rule lives here and in the constants of
// `./sessions.mjs`, and nowhere else. Zero dependencies: it imports only `node:fs`, `node:path` and `./sessions.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, percentOf, shareOf } from './sessions.mjs';

/** The most of a transcript's end that the hook reads, in bytes. The hook runs after every tool call, so a
 * file of megabytes costs what this many bytes cost: the end is all it may look at. */
const END_BYTES = 262144;

/** The shape `bin/resume.mjs` accepts for a session id, since the id becomes a file name. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,}$/;

/** The compaction point of a session that has measured none: the share the host compacts at, in tokens. */
const DEFAULT_COMPACTION = shareOf(DEFAULT_CONTEXT_WINDOW, DEFAULT_CONTEXT_COMPACTION_PERCENT);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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
 * the user's, and a boundary without a count says nothing about the point). */
function automaticCompactionOf(entry) {
  if (entry.type !== 'system' || entry.subtype !== 'compact_boundary' || !isObject(entry.compactMetadata)) return null;
  const { compactMetadata: said } = entry;
  return said.trigger === 'auto' && Number.isFinite(said.preTokens) ? said.preTokens : null;
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

/** The end of a session's transcript: `{ tokens, compaction }`, or `null` when the file cannot be read or
 * holds no reply with usage in its end. It reads at most the last `bytes` of the file (open, read at an
 * offset, close; never the whole file), and the first line of that piece may be cut, which is why a line
 * that does not parse is skipped rather than fatal. `compaction` is the `preTokens` of the last automatic
 * compaction in the piece, or `null`: it is what the session held when the host last compacted it by itself. */
export function readEnd(file, { bytes = END_BYTES, fileSystem = fs } = {}) {
  let fd;
  try {
    fd = fileSystem.openSync(file, 'r');
    const { size } = fileSystem.fstatSync(fd);
    const start = Math.max(0, size - bytes);
    const piece = Buffer.alloc(size - start);
    let done = 0;
    while (done < piece.length) {
      const read = fileSystem.readSync(fd, piece, done, piece.length - done, start + done);
      if (read === 0) break;
      done += read;
    }
    return endOf(piece.subarray(0, done).toString('utf8'));
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

/** The state a session's file holds. A missing, unreadable or unparseable file reads as a session that has
 * never been told and is armed, so a crossing tells it: telling twice is better than never. */
function readState(file, fileSystem) {
  try {
    const value = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
    if (!isObject(value)) return freshState();
    return {
      compaction: Number.isFinite(value.compaction) ? value.compaction : null,
      armed: typeof value.armed === 'boolean' ? value.armed : true,
      told: Array.isArray(value.told) ? value.told : [],
    };
  } catch {
    return freshState();
  }
}

/** Writes the state as a temp file beside the state file, then renames it over the state file, so a reader
 * never sees half of it. A write that fails is not fatal: the notice of a crossing is still given, and the
 * session is told again at the next crossing rather than never. */
function writeState(file, state, fileSystem) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fileSystem.mkdirSync(path.dirname(file), { recursive: true });
    fileSystem.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fileSystem.renameSync(temp, file);
  } catch {
    // the state could not be kept: nothing else depends on the write being there
  }
}

/** What the session is told at the pause: its share of the window, the compaction it is measured against
 * and the room left before it, as whole numbers, with the text the session reads. The window is the
 * compaction point of the session scaled to the share the host compacts at, so a session on a window of a
 * different size is measured against its own compaction and not against the default. */
function noticeOf(tokens, compaction) {
  const window = (compaction * 100) / DEFAULT_CONTEXT_COMPACTION_PERCENT;
  const share = percentOf(tokens, window);
  const room = Math.max(0, compaction - tokens);
  const text = `js-harness: this session holds ${share}% of its context window, and the host compacts it at about ${DEFAULT_CONTEXT_COMPACTION_PERCENT}%: about ${thousands(room)} tokens are left. This is the context pause. Now write your state where it is read after a compaction (the "Next step" of the session's feature document, committed; the relief file for an orchestrator), say this share to the user in your next reply with the two blocks of a cut, once, and then go on with the task.`;
  return { tokens, share, compactionShare: DEFAULT_CONTEXT_COMPACTION_PERCENT, room, text };
}

/** The context pause for a session, run after every tool call: `null`, or the notice the one time a stretch
 * of work passes the pause. A stretch is told by the context falling under the pause again, which a
 * compaction does, and not by looking for a boundary, which may be megabytes before the end of the file.
 * So the state holds one flag: armed, which a crossing disarms and an under-the-pause call re-arms.
 *
 * The session's compaction point is the one its own transcript measured, else the one remembered in its
 * state, else the default, and the pause is that point scaled to the share the host compacts at. A state is
 * written only when something in it changes (a re-arm, a crossing, a new point), so under the pause with
 * nothing new no file is made. It never throws for a transcript or a state it cannot read or write. */
export function pauseNotice({ transcript, sessionId, home, now = () => Date.now(), fileSystem = fs } = {}) {
  const file = statePath(home, sessionId);
  const end = readEnd(transcript, { fileSystem });
  if (end === null) return null;
  const state = readState(file, fileSystem);
  const compaction = end.compaction ?? state.compaction ?? DEFAULT_COMPACTION;
  const past = end.tokens >= pauseAt(compaction);
  const told = past && state.armed;
  const next = {
    compaction: end.compaction ?? state.compaction,
    armed: !past,
    told: told ? [...state.told, { at: new Date(now()).toISOString(), tokens: end.tokens }] : state.told,
  };
  if (told || next.armed !== state.armed || next.compaction !== state.compaction) writeState(file, next, fileSystem);
  return told ? noticeOf(end.tokens, compaction) : null;
}
