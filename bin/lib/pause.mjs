// The context pause, as one library: `pauseNotice` is run by the hook after every tool call of a session,
// so it reads the end of the session's transcript and nothing more, and says the pause to the session once.
// Another hook (a `Stop` one) imports the same function, so the rule lives here and in the constants of
// `./sessions.mjs`, and nowhere else. Zero dependencies: it imports only `node:fs`, `node:os`, `node:path` and `./sessions.mjs`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONTEXT_COMPACTION_PERCENT, DEFAULT_CONTEXT_LAST_PERCENT, DEFAULT_CONTEXT_PAUSE_PERCENT, DEFAULT_CONTEXT_WINDOW, cutRule, percentOf, shareOf } from './sessions.mjs';

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

/** How far under its configured window the host compacts a session, in tokens. Measured over this project's
 * automatic compactions of 2026-10-11 to 2026-10-16: on a window of 500,000 they came between 466,827 and 469,728
 * tokens, on 350,000 between 316,910 and 319,101, on 300,000 between 265,976 and 268,077, so the host compacts once
 * a request passes about this many tokens under the window, whatever its size (odd/tasks/session-channel.md, T6b).
 * Taken at the top of the measures, so a point read from it is at or a little under the host's. */
export const HOST_COMPACTION_RESERVE = 34000;

/** How far from the configured point a session's measured point may lie and still be read, as a share of the window.
 * A measure taken on another window (the setting changed since) or an early compaction of the host (one came 26,000
 * tokens early, after an hour idle) is further than this, and the configured point is read instead. */
const MEASURE_TOLERANCE = 0.05;

/** The environment variable that sets the window the host compacts on, ahead of every settings file. */
const WINDOW_VARIABLE = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW';

/** `value` when it is a whole positive number of tokens, else `null`. */
const windowOf = (value) => (Number.isInteger(value) && value > 0 ? value : null);

/** The window the host is configured to compact a session on, `{ window, source }`, or `null` when nothing sets it:
 * the environment's `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, then `autoCompactWindow` of the project's
 * `.claude/settings.local.json`, of its `.claude/settings.json` and of the user's `settings.json` in `claudeHome`,
 * the first that gives a whole positive number winning. That is the order Claude Code reads its settings in; that the
 * environment comes first is how its own message names the two ("set CLAUDE_CODE_AUTO_COMPACT_WINDOW ... (or the
 * autoCompactWindow setting)"). A place that is missing, does not parse or gives another value is passed over, and
 * nothing throws. */
export function configuredWindow({ env = {}, claudeHome = null, projectDir = null, fileSystem = fs } = {}) {
  const variable = typeof env?.[WINDOW_VARIABLE] === 'string' && /^\d+$/.test(env[WINDOW_VARIABLE]) ? windowOf(Number(env[WINDOW_VARIABLE])) : null;
  if (variable !== null) return { window: variable, source: WINDOW_VARIABLE };
  const files = [
    ...(typeof projectDir === 'string' ? [path.join(projectDir, '.claude', 'settings.local.json'), path.join(projectDir, '.claude', 'settings.json')] : []),
    ...(typeof claudeHome === 'string' ? [path.join(claudeHome, 'settings.json')] : []),
  ];
  for (const file of files) {
    let settings;
    try {
      settings = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    const window = isObject(settings) ? windowOf(settings.autoCompactWindow) : null;
    if (window !== null) return { window, source: file };
  }
  return null;
}

/** The configured window in tokens for a hook that runs under `home` (the harness home: `JS_HARNESS_HOME`, else the
 * user's), or `null`: the Claude home is `CLAUDE_CONFIG_DIR`, else `.claude` under that home, so a made-up home never
 * reads the real settings. The pause notice and the reply check of `guard --stop` both read it here, so the share the
 * notice says is the share the check accepts. */
export function hostWindow({ env = {}, home, projectDir = null, fileSystem = fs } = {}) {
  const claudeHome = env?.CLAUDE_CONFIG_DIR || (typeof home === 'string' ? path.join(home, '.claude') : null);
  return configuredWindow({ env, claudeHome, projectDir, fileSystem })?.window ?? null;
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `point` when it is a compaction point a measure may give, else `null`. */
const pointOf = (point) => (Number.isFinite(point) && point >= LEAST_COMPACTION ? point : null);

/** The text of `count` with a comma between each group of three digits: what a person reads for tokens. */
const thousands = (count) => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** The pause point for a compaction point: the pause's share, on the same scale as the compaction's share
 * of the window (both shares are read from `./sessions.mjs`, so the point moves with the compaction). */
const pauseAt = (compaction) => Math.round((compaction * DEFAULT_CONTEXT_PAUSE_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT);

/** The last notice's point for a compaction point, on the same scale as `pauseAt`. */
const lastAt = (compaction) => Math.round((compaction * DEFAULT_CONTEXT_LAST_PERCENT) / DEFAULT_CONTEXT_COMPACTION_PERCENT);

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

const freshState = () => ({ compaction: null, armed: true, lastArmed: true, told: [] });

/** The states the places hold: each place that is readable, in the order of `files`. A place that is missing,
 * unreadable or unparseable holds none and is passed over. */
function readStates(files, fileSystem) {
  return files.map((file) => readStateFile(file, fileSystem)).filter((state) => state !== null);
}

/** The newest of `states`, or `null` when there is none. Each state is ranked by when it was written (`writtenOf`), and
 * only a state whose time cannot be read at all ranks oldest; a tie keeps the state that comes first.
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
 * time the state was written, in milliseconds, or `null` when neither the state nor its file tells it. */
function readStateFile(file, fileSystem) {
  try {
    const value = JSON.parse(fileSystem.readFileSync(file, 'utf8'));
    if (!isObject(value)) return null;
    return {
      compaction: pointOf(value.compaction),
      armed: typeof value.armed === 'boolean' ? value.armed : true,
      lastArmed: typeof value.lastArmed === 'boolean' ? value.lastArmed : true,
      told: Array.isArray(value.told) ? value.told : [],
      written: writtenOf(value, file, fileSystem),
    };
  } catch {
    return null;
  }
}

/** When a state was written, in milliseconds: its own stamp, or for a state written before stamps were kept, the
 * modification time of its file, which is the write that made it. `null` when neither can be read, so the state
 * ranks oldest and is still read. */
function writtenOf(value, file, fileSystem) {
  const stamp = typeof value.written === 'string' ? Date.parse(value.written) : NaN;
  if (Number.isFinite(stamp)) return stamp;
  try {
    const { mtimeMs } = fileSystem.statSync(file);
    return Number.isFinite(mtimeMs) ? mtimeMs : null;
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
 * different size is measured against its own compaction and not against the default. What the user is given is
 * `cutRule`'s: nothing to send, present or away (odd/tasks/no-manual-compact.md S1). `stage` is `pause` at the pause and `last` just
 * before the host compacts: from the pause on the state is kept current after every step and the session stores the
 * prompt that resumes it, so a compaction in the middle of a task resumes from what was written minutes before it. The
 * last notice never says to stop: the host compacts with the session's next requests, so a session that waits for it
 * waits for good. */
function noticeOf(tokens, compaction, stage, configured = null) {
  const window = configured ?? (compaction * 100) / DEFAULT_CONTEXT_COMPACTION_PERCENT;
  const compactionShare = configured === null ? DEFAULT_CONTEXT_COMPACTION_PERCENT : percentOf(compaction, configured);
  const whole = Math.round(tokens);
  const share = percentOf(whole, window);
  const room = Math.round(Math.max(0, compaction - tokens));
  const head = `js-harness: this session holds ${share}% of its context window, and the host compacts it at about ${compactionShare}%: about ${thousands(room)} tokens are left.`;
  const where = 'the "Next step" of the session\'s feature document; the relief file for an orchestrator';
  const opening = 'js-harness notify --opening "<this session\'s title>" (its text on standard input: the feature document, the task, the branch and worktree, any question still open; it is what a new session under that title reads too)';
  // Two sessions near their compaction ended their turn waiting and were never woken (odd/tasks/pause-no-idle.md).
  const noIdle = 'Never end your turn idle: the host compacts only inside a turn, and a turn that ends with nothing running to wake it is never woken. When the work waits on something, write your state, then keep a declared wait running in the background (js-harness wait, which says what it waits for and when it ends, and wakes you when it holds), so the compaction happens inside a turn.';
  const text = stage === 'last'
    ? `${head} The host compacts this session in a moment: write your state and store your resume prompt now, before anything else, then go on with the task: the compaction comes with your next requests, and never by waiting for it. The state goes where it is read after a compaction (${where}); the prompt with ${opening}. ${noIdle} The cut: ${cutRule()}.`
    : `${head} This is the context pause. From now on keep your state where it is read after a compaction (${where}): write it after every step you finish, not once, and commit it with your next commit. Store the prompt that resumes you with ${opening}, and store it again when it changes. Say this share to the user in your next reply, once, and go on with the task. ${noIdle} The cut: ${cutRule()}.`;
  return { tokens: whole, share, compactionShare, room, stage, text };
}

/** The point a session is measured against: the first of `measured` (the transcript's, then the state's) that is
 * a point at all and, when the host's window is configured, lies within `MEASURE_TOLERANCE` of the window from the
 * point that window gives; else that configured point; else the default. A session's own measure is more exact than
 * the reserve, but one taken on another window is not its point any more. */
function compactionPoint(measured, configured) {
  const expected = configured === null ? null : configured - HOST_COMPACTION_RESERVE;
  const near = (point) => expected === null || Math.abs(point - expected) <= configured * MEASURE_TOLERANCE;
  return measured.find((point) => point !== null && point !== undefined && near(point)) ?? expected ?? DEFAULT_COMPACTION;
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
export function pauseNotice({ transcript, sessionId, home, window = null, now = () => Date.now(), fileSystem = fs, tmpdir = os.tmpdir() } = {}) {
  const files = placesOf(home, sessionId, tmpdir);
  const end = readEnd(transcript, { fileSystem });
  if (end === null) return null;
  const state = readState(files, fileSystem);
  const configured = windowOf(window);
  const compaction = compactionPoint([end.compaction, state.compaction], configured);
  const past = end.tokens >= pauseAt(compaction);
  // The last notice is said once a stretch too, past its point; a call that jumps past both points gets it alone,
  // since it says everything the pause says that is still worth doing.
  const last = past && end.tokens >= lastAt(compaction) && state.lastArmed;
  const told = past && state.armed;
  const next = {
    compaction: end.compaction ?? state.compaction,
    armed: !past,
    lastArmed: !past || (state.lastArmed && !last),
    told: told ? [...state.told, { at: new Date(now()).toISOString(), tokens: end.tokens }] : state.told,
  };
  if (told || last) {
    if (!writeState(files, next, fileSystem, now)) return null;
    return noticeOf(end.tokens, compaction, last ? 'last' : 'pause', configured);
  }
  if (next.armed !== state.armed || next.lastArmed !== state.lastArmed || next.compaction !== state.compaction) writeState(files, next, fileSystem, now);
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
