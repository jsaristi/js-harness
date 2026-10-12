// The session channel's files — see odd/tasks/session-channel.md (points 2, 6 and 7). The sessions of a
// project tell each other what happened through a record that a command writes and a command reads: one
// JSON Lines file per project under the harness home, beside the orchestrator's relief file. The app's
// message is only the doorbell, since a message can be held, expire or reach a session that left, and
// none of that can be read afterwards. This file holds what `bin/notify.mjs` writes (a notice, a relief
// line, an opening) and the readers the board takes them back with. A notice is a claim of the session
// that wrote it, never the user's word.
//
// The shape of the record is the one of `appendJsonLine` and `readJsonLines` (./codex-reviews.mjs), with
// a writer of its own: theirs writes in the repository's git folder, and a project that is no repository
// has none.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isSelf, roleNamed, roleOfTitle, sessionFacts } from './sessions.mjs';

export const NOTICE_SCHEMA = 'js-harness.channel-notice/v1';
export const OPENING_SCHEMA = 'js-harness.channel-opening/v1';
/** The schema of a reading: the line `sessions --opening` appends to the record, which says that a session
 * read the opening written for a title. It is not a notice: nobody is told anything by it, and it has no
 * kind. It is how a session whose transcript carries no title (one opened from the phone, whose title
 * lives in the app only) is known by one: the board and `notify` take the title from the latest reading
 * of that session's id. */
export const READING_SCHEMA = 'js-harness.channel-reading/v1';

/** The kinds of a notice, and no other: each one costs its receiver a turn. `opened` (feature, worktree,
 * branch), `waiting` (on what, and whose it is), `closed` (what was delivered, and that nothing more goes
 * to the sender), `note` (from the orchestrator: only what the receiver cannot see), `answer` (the user's
 * words given in the orchestrator's chat, with the transcript and the line they are read at) and
 * `relieved` (who has the role now). */
export const NOTICE_KINDS = ['opened', 'waiting', 'closed', 'note', 'answer', 'relieved'];

/** The longest text of a notice, in characters: two or three sentences. A notice says that something
 * happened; what happened is in the feature document, the commit or the transcript it points at. */
export const NOTICE_TEXT_MAX = 500;
/** The longest line `notify --relief` appends. The relief file is the orchestrator's own log in prose,
 * one line per event: of the 217 lines of this project's on 2026-10-11 the median held 1,006 characters
 * and the longest 4,870. */
export const RELIEF_LINE_MAX = 6000;
/** The longest title of an opening: a session's title is a code, a role and a few words. */
export const OPENING_TITLE_MAX = 120;
/** The longest text of an opening. It is a prompt, of a few thousand characters; this only stops a file
 * sent to standard input by mistake. */
export const OPENING_TEXT_MAX = 100000;

/** What the caller gave is not a notice, a relief line or an opening: `bin/notify.mjs` answers it with
 * its usage, and nothing is written. */
export class ChannelInputError extends Error {}

/** Everything `notify` writes for the channel: deleting this folder undoes it (`uninstall` does). The
 * relief file is not in it: it is the orchestrator's log, older than the channel. */
export function channelDir(home) {
  return path.join(home, '.js-harness', 'channel');
}

/** The record of the project whose sessions folder is named `slug` (`projectSlug`). */
export function recordPath(home, slug) {
  return path.join(channelDir(home), `${slug}.jsonl`);
}

/** The folder of the openings written for the sessions of the project `slug`. */
export function openingsDir(home, slug) {
  return path.join(channelDir(home), 'openings', slug);
}

/** The relief file of the orchestrator of the project `slug`: where the board reads it. */
export function reliefPath(home, slug) {
  return path.join(home, '.js-harness', 'relief', `${slug}.md`);
}

// A line break as any reader may take one: the two of a text file, and the three Unicode has besides.
const LINE_BREAK = /[\r\n\u0085\u2028\u2029]/;

/** `text` as one line of at most `max` characters, with the blanks around it removed. Throws a
 * `ChannelInputError` that names `what` when it is empty, holds a line break or is longer. */
function oneLine(text, max, what) {
  const line = typeof text === 'string' ? text.trim() : '';
  if (line === '') throw new ChannelInputError(`${what} is empty`);
  if (LINE_BREAK.test(line)) throw new ChannelInputError(`${what} is one line: it holds a line break`);
  if (line.length > max) throw new ChannelInputError(`${what} has ${line.length} characters, ${max} at most`);
  return line;
}

/** A notice as the record keeps it, from what the command read: `at` (the clock's time, ISO), `from`
 * (`senderOf`), `to` (a role as `roleNamed` takes it: `orchestrator`, `ORQ` or a work session's number),
 * `kind`, `text`, and where it was run from: `cwd`, and the `worktree` and `branch` git gave there, each
 * `null` when it could not be read. An `answer` also has the `transcript` (a file or a session id) and the
 * `line` the user's words are read at; nothing here checks the quote. Throws a `ChannelInputError` for
 * anything that is not a notice. */
export function newNotice({ at, from, to, kind, text, cwd = null, worktree = null, branch = null, transcript, line }) {
  const role = typeof to === 'string' ? roleNamed(to) : null;
  if (role === null) throw new ChannelInputError('--to takes a role: orchestrator (or ORQ), or the number of a work session');
  if (!NOTICE_KINDS.includes(kind)) throw new ChannelInputError(`--kind takes one of ${NOTICE_KINDS.join(', ')}`);
  const notice = { schema: NOTICE_SCHEMA, at, from, to: role, kind, text: oneLine(text, NOTICE_TEXT_MAX, 'the text of a notice'), cwd, worktree, branch };
  if (kind !== 'answer') {
    if (transcript !== undefined || line !== undefined) throw new ChannelInputError('only an answer takes --transcript and --line');
    return notice;
  }
  if (transcript === undefined || line === undefined) throw new ChannelInputError('an answer says where his words are read: --transcript <file or session id> and --line <n>');
  if (!Number.isSafeInteger(line) || line < 1) throw new ChannelInputError('--line takes the number of a line of the transcript, from 1');
  return { ...notice, transcript: oneLine(transcript, 1000, 'the value of --transcript'), line };
}

/** Whether `file` exists, is not empty and does not end with a line break. */
function endsUnterminated(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Appends `line` to `file` as a line of its own, creating the file and its folder.
 *
 * Two sessions may write at the same moment. What this relies on: the file is opened for appending and
 * the line goes out in one write, which the system puts at the end of the file whole; a line here is a
 * few kilobytes at most (`NOTICE_TEXT_MAX`, `RELIEF_LINE_MAX`), far under what one write takes. The test
 * of this file has several processes do it together. A tail with no line break is what a crash or a
 * hand edit left: the line then starts on a fresh one, so the tail never swallows it. */
function appendLine(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${endsUnterminated(file) ? '\n' : ''}${line}\n`, 'utf8');
}

/** Appends `notice` (`newNotice`) to the record of the project `slug` under `home`, and returns the
 * record's path. */
export function appendNotice(home, slug, notice) {
  const file = recordPath(home, slug);
  appendLine(file, JSON.stringify(notice));
  return file;
}

/** A reading as the record keeps it: `{ schema, at, reader: { host, id, source }, title }`. `reader` is the
 * session that read, as `senderOf` gives it, and `title` the title of the opening it was given, one line.
 * Throws a `ChannelInputError` for a reader with no session id: a reading says something of one session,
 * so the caller writes none when the host names no session. */
export function newReading({ at, reader, title }) {
  if (!isObject(reader) || typeof reader.id !== 'string' || reader.id === '') throw new ChannelInputError('a reading is of a session: it takes its session id');
  return { schema: READING_SCHEMA, at, reader: { host: reader.host ?? 'unknown', id: reader.id, source: reader.source ?? null }, title: openingTitleOf(title) };
}

/** Appends `reading` (`newReading`) to the record of the project `slug` under `home`, as a line of its
 * own beside the notices, and returns the record's path. */
export function appendReading(home, slug, reading) {
  const file = recordPath(home, slug);
  appendLine(file, JSON.stringify(reading));
  return file;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Whether `value` is a reading of this schema: enough of one to give a session its title. */
function isReading(value) {
  return (
    isObject(value) &&
    value.schema === READING_SCHEMA &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at)) &&
    typeof value.title === 'string' &&
    value.title.trim() !== '' &&
    isObject(value.reader) &&
    typeof value.reader.id === 'string' &&
    value.reader.id !== ''
  );
}

/** Whether `value` is a notice of this schema: enough of one for a board to print it. */
function isNotice(value) {
  return (
    isObject(value) &&
    value.schema === NOTICE_SCHEMA &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at)) &&
    NOTICE_KINDS.includes(value.kind) &&
    typeof value.text === 'string' &&
    isObject(value.to) &&
    (value.to.role === 'orchestrator' || (value.to.role === 'work' && Number.isSafeInteger(value.to.number)))
  );
}

/** The record of the project `slug` under `home`: `{ path, notices, readings, skipped }`, the notices and
 * the readings (`newReading`), each in the order written. A project with no record yet has none. A line
 * that is torn (a session appends while this reads), that is not JSON or that is neither a notice nor a
 * reading of these schemas is counted in `skipped` and left out, never fatal. A record that is there and
 * cannot be read is `unavailable` with the reason, so that "could not look" is never read as "no
 * notices". */
export function readNotices(home, slug, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const file = recordPath(home, slug);
  let text;
  try {
    text = readFile(file);
  } catch (err) {
    const none = { path: file, notices: [], readings: [], skipped: 0 };
    return err.code === 'ENOENT' ? none : { path: file, unavailable: err.code ?? err.message, notices: [], readings: [], skipped: 0 };
  }
  const notices = [];
  const readings = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
    if (isNotice(parsed)) notices.push(parsed);
    else if (isReading(parsed)) readings.push(parsed);
    else skipped += 1;
  }
  return { path: file, notices, readings, skipped };
}

// ---- the relief file ----------------------------------------------------------------------------------

const two = (number) => String(number).padStart(2, '0');

/** How a line of the relief file starts when the command writes it: the local date and time of `ms`, as
 * the lines an orchestrator wrote by hand start (`2026-10-11 06:15 local (date).`), and `(notify)` where
 * those name the source of their hour, so a stamped line is told from one whose hour was typed. */
export function reliefStamp(ms) {
  const at = new Date(ms);
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())} local (notify).`;
}

/** Appends `line` to the relief file of the project `slug` under `home`, stamped with the clock's time
 * `ms`, creating the file and its folder: `{ path, line }`, the line as written. Throws a
 * `ChannelInputError`, and writes nothing, for a line that is empty, more than one, or too long. */
export function appendRelief(home, slug, line, ms) {
  const written = `${reliefStamp(ms)} ${reliefLineOf(line)}`;
  const file = reliefPath(home, slug);
  appendLine(file, written);
  return { path: file, line: written };
}

/** A line for the relief file as it is written after its stamp: one line. Throws a `ChannelInputError`
 * otherwise. */
export function reliefLineOf(line) {
  return oneLine(line, RELIEF_LINE_MAX, 'the relief line');
}

// ---- the openings -------------------------------------------------------------------------------------

/** A title as it is compared and stored: without the blanks around it, its accents composed, so the same
 * title typed on two devices is one. */
const titleOf = (text) => text.trim().normalize('NFC');

/** The name of the file that holds the opening of the session titled `title`: what the title has of
 * letters and digits, in lower case and without accents, so a person who lists the folder can tell the
 * files apart, then the start of the title's hash, which is what makes the name the title's own. Nothing
 * of the title reaches the name as it is: a title holds spaces, a middle dot and accents, and may hold
 * what Windows refuses in a name (`\ / : * ? " < > |`, a dot at the end, `CON`, `NUL`). Two titles that
 * differ by case or by an accent get two names on a disk that ignores case. */
export function openingFileName(title) {
  const wanted = titleOf(title);
  const readable = wanted
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  const hash = crypto.createHash('sha256').update(wanted, 'utf8').digest('hex').slice(0, 12);
  return `${readable === '' ? '' : `${readable}-`}${hash}.json`;
}

/** Stores the opening of the session titled `title` for the project `slug` under `home`: `{ path,
 * replaced }`, `replaced` when an opening for that title was there and is gone. The file holds the title,
 * the clock's time `at`, who wrote it (`from`, `senderOf`) and the text, which loses a byte order mark and
 * its carriage returns (what a Windows pipe adds) and nothing else. Throws a `ChannelInputError`, and
 * writes nothing, for a title that is not one line or a text that is empty or too long. */
export function writeOpening(home, slug, { title, text, at, from }) {
  const named = openingTitleOf(title);
  const body = openingTextOf(text);
  const file = path.join(openingsDir(home, slug), openingFileName(named));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const replaced = fs.existsSync(file);
  fs.writeFileSync(file, `${JSON.stringify({ schema: OPENING_SCHEMA, title: named, at, from, text: body })}\n`, 'utf8');
  return { path: file, replaced };
}

/** The title of an opening as it is stored: one line (`titleOf`). Throws a `ChannelInputError` otherwise. */
export function openingTitleOf(title) {
  return oneLine(title, OPENING_TITLE_MAX, 'the title of an opening').normalize('NFC');
}

/** The text of an opening as it is stored: without a byte order mark and with plain line breaks. Throws a
 * `ChannelInputError` for one that is empty or too long. */
export function openingTextOf(text) {
  const body = typeof text === 'string' ? text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n') : '';
  if (body.trim() === '') throw new ChannelInputError('the text of an opening is empty: it is read from standard input');
  if (body.length > OPENING_TEXT_MAX) throw new ChannelInputError(`the text of an opening has ${body.length} characters, ${OPENING_TEXT_MAX} at most`);
  return body;
}

// `<code> <role>`, which is how a title starts and how the line that opens a session names it (`JH 5`).
const CODE_AND_ROLE = /^(\S+) (\S+)$/;

/** The openings of the project `slug` under `home` that `wanted` names: `{ dir, openings, unreadable }`,
 * each opening as `{ path, title, at, from, text }`, the latest first. `wanted` is a whole title, or the
 * code and the role a title starts with (`JH 5`, `JH ORQ`): a session's purpose may be reworded between
 * two openings, and then both are found. `unreadable` counts the `.json` files of the folder that are not
 * an opening (torn, or another schema). A project with no opening has none; a folder that is there and
 * cannot be listed is `unavailable` with the reason. */
export function findOpenings(home, slug, wanted, { readdir = (dir) => fs.readdirSync(dir), readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const dir = openingsDir(home, slug);
  let names;
  try {
    names = readdir(dir);
  } catch (err) {
    return err.code === 'ENOENT' ? { dir, openings: [], unreadable: 0 } : { dir, openings: [], unreadable: 0, unavailable: err.code ?? err.message };
  }
  const title = titleOf(wanted);
  const prefix = CODE_AND_ROLE.exec(title);
  const role = prefix ? roleNamed(prefix[2]) : null;
  const named = (opening) => {
    if (opening.title === title) return true;
    const said = role ? roleOfTitle(opening.title) : null;
    // `ORQ` as the titles spell it, not `orchestrator`: this is the start of a title, not a role by name.
    return Boolean(said) && said.code === prefix[1] && said.role === role.role && said.number === role.number && (role.role === 'work' || prefix[2] === 'ORQ');
  };
  const openings = [];
  let unreadable = 0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(dir, name);
    let stored;
    try {
      stored = JSON.parse(readFile(file));
    } catch {
      stored = null;
    }
    if (!isObject(stored) || stored.schema !== OPENING_SCHEMA || typeof stored.title !== 'string' || typeof stored.text !== 'string') {
      unreadable += 1;
      continue;
    }
    if (named(stored)) openings.push({ path: file, title: stored.title, at: stored.at ?? null, from: stored.from ?? null, text: stored.text });
  }
  const recency = (opening) => opening.at ?? '';
  openings.sort((one, other) => (recency(one) < recency(other) ? 1 : recency(one) > recency(other) ? -1 : 0));
  return { dir, openings, unreadable };
}

// ---- where a notice is run from, and who sends it ------------------------------------------------------

/** The git worktree `cwd` is in and the branch it has checked out, `{ worktree, branch }`, each `null`
 * when git does not say: outside a repository, without git, on a detached HEAD. Two calls of `run`
 * (`spawnSync`'s shape), which is what git needs to answer both in a repository with no commit yet. A
 * notice records them because a transcript does not: a session that reaches a worktree by `cd` still
 * records the folder it was opened in. Never throws: a notice is not lost for want of a branch. */
export function placeOf(run, cwd) {
  const firstLine = (args) => {
    try {
      const result = run('git', args, { cwd });
      if (result.error || result.status !== 0) return null;
      return String(result.stdout ?? '').split(/\r?\n/)[0].trim() || null;
    } catch {
      return null;
    }
  };
  const top = firstLine(['rev-parse', '--show-toplevel']);
  return { worktree: top === null ? null : path.resolve(top), branch: top === null ? null : firstLine(['branch', '--show-current']) };
}

/** Who sends: `{ host, id, source, title, permissionMode }`.
 *
 * The id is the one Claude Code gives every command a session runs (`CLAUDE_CODE_SESSION_ID`, `source:
 * 'environment'`), or the one `self` names in its place, as on the board (`--self`, `source: 'flag'`, a
 * whole id or its first eight characters or more). The title and the permission mode are read from that
 * session's transcript in `projectDir`, with the board's reader: a title only when the session was given
 * one, `null` for whatever cannot be read. An id from the flag that no transcript carries is only what the
 * caller typed, so no host is named for it.
 *
 * With neither, the sender is not known and the notice is recorded all the same: `{ host: 'unknown', id:
 * null, ... }`. That is every Codex session today: nothing in this repository reads a session id from
 * Codex, and none of the variables its commands carry is known to hold one. */
export function senderOf({ self = null, env = {}, projectDir, readdir, readFile, readFacts = sessionFacts }) {
  const fromFlag = typeof self === 'string' && self !== '';
  const given = fromFlag ? self : env.CLAUDE_CODE_SESSION_ID || null;
  if (given === null) return { host: 'unknown', id: null, source: null, title: null, permissionMode: null };
  const sender = { host: fromFlag ? 'unknown' : 'claude-code', id: given, source: fromFlag ? 'flag' : 'environment', title: null, permissionMode: null };
  try {
    const ids = readdir(projectDir).filter((name) => name.endsWith('.jsonl')).map((name) => name.slice(0, -'.jsonl'.length)).filter((id) => isSelf(id, given));
    if (ids.length !== 1) return sender;
    [sender.id] = ids;
    sender.host = 'claude-code';
    const facts = readFacts(readFile(path.join(projectDir, `${sender.id}.jsonl`)), { tail: 0 });
    sender.title = facts.titleSource === 'custom-title' && typeof facts.title === 'string' ? facts.title : null;
    sender.permissionMode = facts.permissionMode ?? null;
  } catch {
    // A sessions folder that is not there, a transcript that cannot be read: the sender keeps what is known.
  }
  return sender;
}
