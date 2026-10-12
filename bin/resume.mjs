#!/usr/bin/env node
// `resume --hook`: what a session reads when it comes back from a compaction, so nobody pastes it a
// resume prompt (odd/tasks/session-channel.md, "Context"). It is registered as a `SessionStart` hook with
// the matcher `compact` (bin/lib/manifest.mjs): the host hands it one JSON object on standard input and
// adds what it prints to what the session reads next. Both hosts document that input and that matcher
// (Claude Code: `session_id`, `transcript_path`, `cwd`, `source`, and `session_title` when the session has
// one; Codex: the same without the title), and this project's transcripts record the hooks of other tools
// run under `SessionStart:compact` after 40 compactions.
//
// It prints a few plain lines: the session's title, the opening stored for that title, the feature
// document it works on, and what to read there (for an orchestrator, the relief file it keeps instead).
// After a compaction it adds what its transcript holds of the stretch of work before the compaction: the
// compaction itself, the pause's notice, how old the state the session wrote is and what its worktree holds
// uncommitted, the work the transcript leaves in flight and the machine's gate, the user's and other sessions'
// messages, and the last reply. It
// reads for nine seconds at most and says what it left unread. Each comes from a file, and what no file says
// is said as not known, with where to look. Like every
// hook: it acts only in a project that opted in (a `harness.json` at the root of the checkout the session
// is in) and prints nothing elsewhere; it never fails a session (a file or a folder it cannot read is said
// as not looked at, and whatever else goes wrong, it prints nothing; either way it exits 0); and it writes
// nothing, not even the reading `sessions --opening` records. The one thing it says on standard error is
// that its input was not read, when it was not: a person who runs it at a shell is told why nothing came
// out, and a host shows a hook's standard error to nobody when it exits 0. Zero dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { spawnSync } from 'node:child_process';
import { findOpenings, openingsDir, placeOf, reliefPath, readNotices } from './lib/channel.mjs';
import { readGateHolder, readGateWaiters } from './lib/gate-lock.mjs';
import { pauseNotice, toldBetween } from './lib/pause.mjs';
import { comparable, compactionStretch, isSelf, mainCheckout, parseWorktreeList, projectSlug, readPlans, reliefTail, replyOf, roleOfTitle, sessionFacts, thousands, titleRead, workNameOf } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness resume --hook',
  '         a SessionStart hook for the matcher "compact": it reads the hook\'s input from standard input and,',
  '         after a compaction in a project with a harness.json, prints the session\'s title, its opening,',
  '         its feature document (its relief file, for an orchestrator) and what to read there. It prints',
  '         nothing anywhere else and writes nothing; when its standard input was not read, it says so on',
  '         standard error. It always exits 0.',
  'Usage: js-harness resume --pause',
  '         a PostToolUse hook for the context pause: it reads the hook\'s input from standard input and prints',
  '         one JSON line with the notice the first time a stretch of work passes the pause, and nothing else.',
  '         It never fails and always exits 0.',
].join('\n');

// How long one `git` may take, in milliseconds. The hook asks at most seven questions and the host gives
// it fifteen seconds (the entry `install` writes): a `git` that hangs costs the session a moment, not
// its start.
const GIT_TIMEOUT = 2000;

// How long the hook reads, in milliseconds, counted from the start of its mode. The host takes what the hook
// printed only when it ends, and gives it fifteen seconds (on a loaded machine the hook took 7.4): a hook still
// reading after nine says what it did not read, prints what it has, and ends well inside the host's limit.
const HOOK_DEADLINE = 9000;

// How many lines of the stretch a list prints (the last ones), and how many characters of the session's last reply.
const LISTED = 8;
const REPLY_TAIL = 300;

// The steps the hook reads after the stretch, as the line that says what it left unread names them.
const STEP = {
  stretch: 'the stretch of work before this compaction',
  folders: 'the feature document folders',
  pause: 'the pause\'s notice',
  written: 'when the state was last written and committed',
  worktree: 'the worktree\'s changes',
  flight: 'the work in flight and the machine\'s gate',
  reply: 'this session\'s last reply',
};

const NO_REPLY = 'This session\'s last reply with text: none in this stretch.';
const HOST_COMPACTED = 'The host compacted this session by itself: say so in your next reply to the user, first, with what was and was not written before it.';
const NOTIFY = `Then tell the orchestrator in one line that this session was compacted and what it resumes:  js-harness notify --to orchestrator --kind note "<this session's title>: compacted at <HH:MM by the clock>, resumes <what>"  (it answers with the orchestrator's title, or that there is none).`;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const oneLine = (text) => text.replace(/\s+/g, ' ').trim();

/** The hook's input as an object, `{ input }`, or `{ why }`: why standard input was not read, in words, for a
 * person who ran the command at a shell. A pipe of Windows PowerShell puts a byte order mark before what it
 * sends, and it is not part of the input. */
function inputOf(text) {
  if (text.trim() === '') return { why: 'standard input is empty' };
  let input;
  try {
    input = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return { why: 'standard input is not JSON' };
  }
  return isObject(input) ? { input } : { why: 'standard input is not a JSON object' };
}

/** The title a transcript carries: the `customTitle` of its last `custom-title` entry, or `null`. It is
 * the rule of the board's reader (`sessionFacts`, `titleSource: 'custom-title'`) without the rest of it:
 * a transcript runs to tens of megabytes, and only the few lines that name the entry are parsed. A line
 * that does not parse (the last one, while the session writes) is skipped. */
export function transcriptTitle(text) {
  let title = null;
  for (const line of text.split('\n')) {
    if (!line.includes('"custom-title"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (isObject(entry) && entry.type === 'custom-title' && typeof entry.customTitle === 'string') title = entry.customTitle;
  }
  return title;
}

/** The text of a record after its `fixed` fields: what follows the last of them and its blank, so a path may hold blanks. */
function pathAfter(record, fixed) {
  let at = -1;
  for (let count = 0; count < fixed; count++) at = record.indexOf(' ', at + 1);
  return record.slice(at + 1);
}

/** The branch, the head and the paths a worktree has not committed, from `git status --porcelain=v2 --branch -z`: `{ branch,
 * head, paths }`. `branch` is the branch's name, `no branch (detached)` for a detached head; `head` is the commit, or
 * `(initial)` before the first one. A changed file (kind `1`), an unmerged one (`u`) and an untracked one (`?`) is one path;
 * a renamed one (`2`) is its new path, and the old one that the record is followed by, a field of its own, is no path. */
export function parseStatus(text) {
  const status = { branch: null, head: null, paths: [] };
  const fields = text.split('\0');
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field.startsWith('# branch.oid ')) status.head = field.slice('# branch.oid '.length);
    else if (field.startsWith('# branch.head ')) {
      const name = field.slice('# branch.head '.length);
      status.branch = name === '(detached)' ? 'no branch (detached)' : name;
    } else if (field.startsWith('1 ')) status.paths.push(pathAfter(field, 8));
    else if (field.startsWith('2 ')) {
      status.paths.push(pathAfter(field, 9));
      index += 1;
    } else if (field.startsWith('u ')) status.paths.push(pathAfter(field, 10));
    else if (field.startsWith('? ')) status.paths.push(field.slice(2));
  }
  return status;
}

/** The checkout `cwd` is in, or `cwd` itself outside a repository: where a project's `harness.json` is. */
function checkoutOf(run, cwd) {
  const asked = run('git', ['rev-parse', '--show-toplevel'], { cwd });
  const top = asked.error || asked.status !== 0 ? '' : String(asked.stdout ?? '').split(/\r?\n/)[0].trim();
  return top === '' ? cwd : path.resolve(top);
}

/** The file of the session's transcript, resolved: the one the host names in the input when that is the session's own
 * file under the projects folder (`isOwnTranscript`), else the session's own file in this project's sessions folder by
 * its id; `null` when no session id is known. The host's path is not read on trust: a session opened in another folder
 * is filed under another project, so any project's folder counts, but a path that leaves the projects folder does not. */
function transcriptFileOf(input, sessionId, { projectDir, projectsDir }) {
  if (sessionId !== null && typeof input.transcript_path === 'string' && isOwnTranscript(input.transcript_path, sessionId, projectsDir)) return path.resolve(input.transcript_path);
  return sessionId === null ? null : path.join(projectDir, `${sessionId}.jsonl`);
}

/** Whether `file` is the session's own transcript under `projectsDir`: its name is exactly `<session id>.jsonl`, and
 * resolved it lies inside the folder below a separator, so `projects-backup` is not inside `projects`. On win32 the two
 * paths are compared without case, as the file system compares them. */
function isOwnTranscript(file, sessionId, projectsDir) {
  const resolved = path.resolve(file);
  if (path.basename(resolved) !== `${sessionId}.jsonl`) return false;
  const folded = (name) => (process.platform === 'win32' ? name.toLowerCase() : name);
  return folded(resolved).startsWith(folded(path.resolve(projectsDir)) + path.sep);
}

/** The session's transcript as text, or `null` when there is none that can be read. The file is the one `transcriptFileOf`
 * gives: the host's path when it is the session's own under the projects folder, else the session's own file in the
 * project's sessions folder, by its id, as the board finds it. Nothing else is read for the session. */
function transcriptOf(input, sessionId, { projectDir, projectsDir, readFile }) {
  const file = transcriptFileOf(input, sessionId, { projectDir, projectsDir });
  if (file === null) return null;
  try {
    return readFile(file);
  } catch {
    return null;
  }
}

/** The session's title and where it was read, `{ title, from }`, in the order of trust: what the host
 * gave the hook, what the transcript carries, the title of the opening the record says the session read.
 * `{ title: null, from }` with what was looked at when none of them has one. The transcript is the text
 * `transcriptOf` read, so the file is read once for the title and for the feature document.
 * The title is the one given, with every blank it holds: an opening is stored under its whole title and a
 * notice carries the one of its transcript, so a title with two blanks in a row made one finds neither.
 * It is made one line (`oneLine`) where the session's line prints it, and nowhere else: the titles of the
 * openings the hook lists are printed as they are stored (`printedTitle`), since a blank is what tells two
 * openings apart. */
function titleOf(input, sessionId, { transcript, record }) {
  if (typeof input.session_title === 'string' && input.session_title.trim() !== '') return { title: input.session_title, from: 'the title the host gave the hook' };
  // No transcript (a Codex session has none here, or it cannot be read) carries no title.
  const carried = transcript === null ? null : transcriptTitle(transcript);
  if (carried !== null && carried.trim() !== '') return { title: carried, from: 'the title its transcript carries' };
  if (sessionId === null) return { title: null, from: transcript === null ? 'the host gave the hook none and no session id a transcript could be found by' : 'the host gave the hook none and its transcript gives none' };
  const read = titleRead(record.readings, sessionId);
  if (read !== null) return { title: read, from: 'the title of the opening it read, by the channel\'s record' };
  // A record that could not be read has no readings to give, which is not a record with none in it.
  const recorded = record.unavailable === undefined ? 'the channel\'s record has no opening read by it' : `the channel's record could not be read (${record.unavailable})`;
  return { title: null, from: `the host gave the hook none, its transcript ${sessionId.slice(0, 8)} gives none and ${recorded}` };
}

/** The feature documents the session works on, `{ worktree, branch, noticed, documents }`, or `{ unknown }` with
 * why they cannot be told. They are the ones the branch of a worktree changed (`readPlans`, as the board
 * lists them), and the worktree is the one the session's last notice was written from: a transcript only
 * records the folder a session was opened in, and a notice records where its command ran. A notice is the
 * session's by its id, or by its title, which a session the app restarted keeps. The worktree may have
 * another branch checked out now: its documents are the ones it has now, and `branch` is that one, with
 * `noticed` the branch the notice was written on, so the line can say both. */
function featureOf(record, sessionId, title, { run, readFile }) {
  if (record.unavailable !== undefined) return { unknown: `the channel's record could not be read (${record.unavailable})` };
  const own = (notice) => {
    const sender = isObject(notice.from) ? notice.from : {};
    if (sessionId !== null && typeof sender.id === 'string' && sender.id !== '' && isSelf(sessionId, sender.id)) return true;
    return title !== null && sender.title === title;
  };
  const last = record.notices.filter((notice) => own(notice) && typeof notice.worktree === 'string' && notice.worktree !== '').at(-1);
  if (!last) return { unknown: 'no notice of this session in the channel\'s record names a worktree' };
  const { worktree, branch } = last;
  if (typeof branch !== 'string') return { unknown: `this session's last notice was written in ${worktree} on no branch` };
  const current = placeOf(run, worktree).branch;
  if (current === null) return { unknown: `git does not say which branch ${worktree} is on now` };
  const plans = readPlans(run, readFile, worktree);
  if (!plans.available) return { unknown: plans.reason };
  if (plans.items.length === 0) return { unknown: `the branch ${current} of ${worktree} changed no feature document` };
  return { worktree, branch: current, noticed: branch, documents: plans.items.map((plan) => path.join(worktree, plan.path)) };
}

/** Where a feature document of the session is, as its line says it: in the worktree its last notice was written
 * from, and, when that worktree is on another branch now, both branches, so that the reader can judge. */
const placeOfFeature = (feature) => (feature.noticed === feature.branch
  ? WRITTEN_FROM
  : `${WRITTEN_FROM}, which is on ${feature.branch} now, and this session's last notice was written there on ${feature.noticed}`);

// A feature document is `<tree>/odd/tasks/<name>.md`, with either slash: `<tree>` is everything before `/odd/tasks/`.
const FEATURE_DOCUMENT = /^(.*)[\\/]odd[\\/]tasks[\\/][^\\/]+\.md$/;

/** The feature document the session wrote last, by the Edit and Write calls its transcript records, `{ path, branch }`,
 * or `null` when none of them is still there. `wrote` is `compactionStretch(transcript).wrote`, read once by the hook:
 * it holds every Edit and Write the session made, and a session that reached its worktree by `cd` records no other
 * folder it works in. `branch` is the one git says the document's worktree is on now, `null` when it does not say;
 * `null` for `wrote` is a transcript that gave nothing, and the notice of the session is asked next. */
function writtenOf(wrote, { run, isFile }) {
  if (wrote === null) return null;
  // The record is oldest first: the latest document the session wrote that is still there is the last one of it.
  for (let index = wrote.length - 1; index >= 0; index--) {
    const file = wrote[index].path;
    const match = FEATURE_DOCUMENT.exec(file);
    if (match === null || !isFile(file)) continue;
    return { path: file, worktree: match[1], branch: placeOf(run, match[1]).branch };
  }
  return null;
}

// How many folders of feature documents the hook lists: the lines are read at the start of a turn, and a
// project has a worktree per feature in flight (fifteen in this one on 2026-10-11).
const FOLDERS_LISTED = 6;

/** `12m ago`, `5h ago`, `3d ago`: how long before `now` the time `ms` was. */
function ago(ms, now) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

/** Why a read failed, as it is printed: the code of the error, or what it says (as `findOpenings` has it). */
const reasonOf = (err) => err?.code ?? err?.message ?? String(err);

/** The lines that say where an orchestrator's state is: its relief file, how many lines it holds and when it was
 * last written, or why it could not be read (`missing` for a file that is not there). The text is never printed:
 * the file grows to hundreds of kilobytes, and the session reads its last lines itself. */
function reliefLinesOf(file, { readFile, stat, now }) {
  let state;
  try {
    const text = readFile(file);
    state = `${reliefTail(text).lineCount} lines, last written ${ago(stat(file).mtimeMs, now())}`;
  } catch (err) {
    state = `${err?.code === 'ENOENT' ? 'missing' : 'not read'}: ${reasonOf(err)}`;
  }
  return [`Relief file: ${file}  (${state})`, RELIEF_READ];
}

/** When a feature document of `folder` was last written, `{ written }` in ms, `null` for a folder that
 * holds none; and `{ written: null, unseen }` for a folder that could not be looked at, with what could
 * not be done and why. A folder that is not there holds no document, which is known; any other failure
 * says nothing of what the folder holds. A session writes its state in its feature document before it is
 * compacted, so the folder written last is the first place to look; it is a fact about the folder, and
 * says nothing of whose it is. */
function lastWritten(folder, { readdir, stat }) {
  let names;
  try {
    names = readdir(folder);
  } catch (err) {
    return err?.code === 'ENOENT' ? { written: null } : { written: null, unseen: `could not be listed (${reasonOf(err)})` };
  }
  try {
    const times = names.filter((name) => name.endsWith('.md')).map((name) => stat(path.join(folder, name)).mtimeMs);
    return { written: times.length === 0 ? null : Math.max(...times) };
  } catch (err) {
    // One document's time is missing, and it may be the latest: the others' would be a guess.
    return { written: null, unseen: `the time of a document in it could not be read (${reasonOf(err)})` };
  }
}

/** Where the feature documents of the project are, as the lines under "not known": the `odd/tasks`
 * folder of each worktree git lists (the project's own when git lists none), with its branch and when a
 * document was last written in it, that one first. A folder that could not be looked at is said so, and
 * never as one with no document. No more than `FOLDERS_LISTED`: the rest is a count, with where to see
 * them. */
function documentFolders(run, root, files) {
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: root });
  const trees = listed.error || listed.status !== 0 ? [] : parseWorktreeList(String(listed.stdout ?? '')).filter((tree) => !tree.bare && tree.prunable === null);
  const folders = (trees.length === 0 ? [{ path: root, branch: null }] : trees).map((tree) => {
    const folder = path.join(tree.path, 'odd', 'tasks');
    return { folder, branch: tree.branch, ...lastWritten(folder, files) };
  });
  // The latest first; then the folders that could not be looked at, which may hold the document; then
  // the ones known to hold none. Within each of the last two, the order git gave.
  const place = (item) => (item.written !== null ? 0 : item.unseen !== undefined ? 1 : 2);
  folders.sort((one, other) => place(one) - place(other) || (other.written ?? 0) - (one.written ?? 0));
  const said = (item) => item.unseen ?? (item.written === null ? 'no document' : `last written ${ago(item.written, files.now())}`);
  const lines = folders.slice(0, FOLDERS_LISTED).map((item) => `  ${item.folder}  (${[item.branch ? `branch ${item.branch}` : null, said(item)].filter(Boolean).join(', ')})`);
  const rest = folders.slice(FOLDERS_LISTED);
  if (rest.length > 0) {
    // "None with a document" is said only of folders that were all looked at.
    const unseen = rest.filter((item) => item.unseen !== undefined).length;
    const ofThem = [rest[0].written === null ? null : `the last of them written ${ago(rest[0].written, files.now())}`, unseen === 0 ? null : `${unseen} of them not looked at`].filter(Boolean);
    lines.push(`  and ${rest.length} more worktree${rest.length === 1 ? '' : 's'} (git worktree list names them), ${ofThem.length === 0 ? 'none with a document' : ofThem.join(', ')}`);
  }
  return ['Feature documents are in these folders, the one written last first:', ...lines];
}

// A title the command that prints its opening can be written for: letters, digits, blanks and the marks
// below, after a first letter or digit. The session that reads the line may run it in PowerShell or in a
// POSIX shell, through the batch file or the script a package manager puts before the command, and only
// such a title reaches the command the same by every one of them. Single quotes are what the two shells
// share: inside them neither expands a `$`. A single quote has no spelling both take; Windows PowerShell
// drops a double quote on the way to a program; a batch file expands `%NAME%` and cuts at `&`; and a title
// that begins with `--` needs a lone `--` before it, which PowerShell takes away from a script. A list of
// what is safe, not of what is not, so a mark nobody thought of gets the words and not a wrong command.
const PLAIN_TITLE = /^[\p{L}\p{N}][\p{L}\p{N} ·.,:()#+$/_-]*$/u;

/** How the session prints its stored opening, as what goes in brackets after the file's path: the
 * command, for a title every shell reads alike (`PLAIN_TITLE`), and otherwise how to ask, in words: a
 * command printed here is run as it is, so one that asks for another title is worse than none. */
function printing(title) {
  const asked = title.trim();
  if (PLAIN_TITLE.test(asked)) return `print it: js-harness sessions --opening '${asked}'`;
  return 'no command is written for it: its title holds marks that shells read each its own way. To print it, give js-harness sessions --opening that title, as the file holds it, as one argument, after a lone -- when it begins with --';
}

/** An opening's title as the list prints it: between double quotes, with every blank it holds, on one line.
 * `JSON.stringify` escapes a quote, a backslash and the line breaks a hand-written file may hold, and leaves
 * the line separators that `channel.mjs` counts as line breaks: those are escaped here too. */
const printedTitle = (title) => JSON.stringify(title).replace(/[\u0085\u2028\u2029]/g, (mark) => `\\u${mark.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** The lines that say which opening is stored for `title`, from what `findOpenings` found. They say what
 * `sessions --opening` says for the same folder, so the session is never sent to a command that refuses
 * it: "none stored" only of a folder that was listed and whose every file was read; "not known" when a
 * file that could not be read may be the one; and for a title that names several (the code and the role
 * a title starts with, after a purpose was reworded), their titles and no command, since the command for
 * that title exits 2. A file that could not be read beside the ones found may be one more of that title:
 * it is said as not counted. The titles listed are not flattened: `findOpenings` compares a whole title exactly,
 * so two titles that differ by a blank are two openings, and a list that made them one line would send the
 * session to the wrong one. */
function openingLines(found, title) {
  const { dir, openings } = found;
  if (found.unavailable !== undefined) return [`Opening: could not look in ${dir} (${found.unavailable})`];
  const unread = found.unreadable > 0 ? `${found.unreadable} file${found.unreadable === 1 ? '' : 's'} of ${dir} could not be read as an opening` : null;
  if (openings.length === 0) return [unread === null ? `Opening: none stored for that title (the openings of this project are in ${dir})` : `Opening: not known whether one is stored for that title (${unread})`];
  const uncounted = unread === null ? '' : `; ${unread} and ${found.unreadable === 1 ? 'is' : 'are'} not counted`;
  if (openings.length === 1) return [`Opening: ${openings[0].path}  (${printing(title)}${uncounted})`];
  return [
    `Opening: ${openings.length} openings are named by that title, the latest first: ask for one by its whole title (js-harness sessions --opening "<whole title>" prints it${uncounted})`,
    ...openings.map((opening) => `  ${printedTitle(opening.title)}  (${opening.path})`),
  ];
}

const TRUST = 'and "State for a resume" if it has one, and trust them over the summary. Then repeat to the user any question that is still open.';
const WRITTEN_FROM = 'in the worktree this session\'s last notice was written from';
const RELIEF_READ = 'Read its last lines before anything else: it is the orchestrator\'s state, and no feature document is. Trust it over the summary. Then repeat to the user any question that is still open.';

/** The temp folder the pause's state falls back to: under the harness home when `JS_HARNESS_HOME` is set, so a made-up
 * home never reaches the real temp folder, and the system's otherwise. */
const tempOf = (env) => (env.JS_HARNESS_HOME ? path.join(env.JS_HARNESS_HOME, 'tmp') : undefined);

/** What a step says: the line it gives, or, when it throws, `<step>: not read (<reason>)`, so the rest of the hook goes on. */
function stepSaid(step, work) {
  try {
    return work();
  } catch (err) {
    return `${step}: not read (${reasonOf(err)})`;
  }
}

/** The stretch of the transcript before the compaction, `{ facts }` from `compactionStretch`, or `{ failed }` with why it
 * could not be read. It is read once and shared: the feature document and the lines of the stretch both come from it. */
function stretchOf(transcript) {
  try {
    return { facts: compactionStretch(transcript) };
  } catch (err) {
    return { failed: reasonOf(err) };
  }
}

/** The compaction the session came back from, in words. With one the session has not replied since (`current`): its
 * maker, its time, what it held and its line. Without one, why there is none to name: the host writes a boundary after
 * the hook runs, so the one just made is not in the transcript yet, and the one before it is named when there is one. */
function compactionSaid({ current, boundaries }) {
  if (current !== null) {
    const when = current.at === null ? '' : ` at ${current.at}`;
    const held = Number.isFinite(current.before) ? `, holding ${thousands(current.before)} tokens` : '';
    return `Compaction: ${current.automatic ? 'made by the host' : 'asked for by the user'}${when}${held} (line ${current.line}).`;
  }
  const first = 'Compaction: its boundary is not in the transcript yet, which is how one made by the host looks when this hook runs (the host writes it after)';
  const newest = boundaries.at(-1);
  return newest === undefined ? `${first}; the transcript records none before it.` : `${first}; the one before it was at ${newest.at ?? 'an unknown time'}.`;
}

/** The pause's notice for the stretch, in words: whether the session was told the pause in it, when, and with how many
 * tokens; or that the state of the pause says nothing about it (`toldBetween`). */
function pauseSaid(told) {
  if (!told.known) return 'The pause: not known whether this session was told (it keeps no state of the pause\'s notice: that entry may not be installed).';
  if (told.at === null) return 'The pause: this session was not told it had passed the context pause in this stretch.';
  const held = Number.isFinite(told.tokens) ? `, holding ${thousands(told.tokens)} tokens` : '';
  return `The pause: this session was told it had passed the context pause at ${told.at}${held}.`;
}

/** The arguments of a `git` that reads a worktree: `--no-optional-locks`, so the hook never takes the index lock a session
 * committing in that worktree needs. */
const gitIn = (worktree, args) => ['--no-optional-locks', '-C', worktree, ...args];

/** Why a `git` call that did not succeed did not: the code of the error that stopped it (a time limit is `ETIMEDOUT`), or
 * the first line git printed, or its exit status when it printed none. */
function gitReasonOf(asked) {
  if (asked.error) return reasonOf(asked.error);
  const said = String(asked.stderr ?? '').trim().split(/\r?\n/)[0];
  return said === '' ? `exit ${asked.status}` : said;
}

/** The last commit of `file` in `worktree`: `{ hash, at }`, `null` for a file in no commit, or `{ unavailable }` with why git
 * could not say. `at` is the commit's time as ISO in UTC, the form the file's own time takes too; git's offset is only
 * converted, and a time that does not parse is kept as git gave it. */
function commitOf(run, worktree, file) {
  const relative = path.relative(worktree, file).split(path.sep).join('/');
  const asked = run('git', gitIn(worktree, ['log', '-1', '--format=%h%x09%cI', '--', relative]), { cwd: worktree });
  if (asked.error || asked.status !== 0) return { unavailable: gitReasonOf(asked) };
  const said = String(asked.stdout ?? '').trim();
  if (said === '') return null;
  const [hash, given] = said.split('\t');
  const time = Date.parse(given);
  return { hash, at: Number.isNaN(time) ? given : new Date(time).toISOString() };
}

/** When the state file was last written, and for a file in a worktree when it was last committed, as the line `State:` says
 * it, with what the pause's notice says of those times: `noticedAt`, the ISO time of the notice in the stretch, or `null`.
 * `worktree` is `null` for the relief file, which is in no repository and has no commit. A notice written before both
 * times, or the file, says that what the file holds may be older than the work. */
function stateLineOf(file, { run, stat, now, worktree, noticedAt }) {
  const written = stat(file).mtimeMs;
  const when = `was last written at ${new Date(written).toISOString()} (${ago(written, now())})`;
  const commit = worktree === null ? null : commitOf(run, worktree, file);
  let line = `State: ${file} ${when}`;
  if (worktree === null) line += '.';
  else if (commit === null) line += ' and is in no commit yet.';
  else if (commit.unavailable !== undefined) line += ` and its commit is not read (${commit.unavailable}).`;
  else line += ` and last committed at ${commit.at} (${commit.hash}).`;
  const noticed = noticedAt === null ? NaN : Date.parse(noticedAt);
  if (Number.isNaN(noticed)) return line;
  if (written < noticed) return `${line} It was last written before the pause's notice of ${noticedAt}: what it holds may be older than the work, so say so in your next reply to the user.`;
  if (worktree === null) return `${line} It was written after the pause's notice.`;
  if (commit === null) return `${line} It was written after the pause's notice and that is not committed.`;
  if (commit.unavailable !== undefined) return `${line} It was written after the pause's notice, and whether that is committed is not read.`;
  // A commit time git gave in a form that does not parse proves nothing either way.
  const committed = Date.parse(commit.at);
  if (Number.isNaN(committed)) return `${line} It was written after the pause's notice, and whether that is committed is not read.`;
  return committed >= noticed ? `${line} Both are after the pause's notice.` : `${line} It was written after the pause's notice and that is not committed.`;
}

// How many of a worktree's uncommitted paths the line names; the rest are a count and "…".
const PATHS_LISTED = 5;

/** What git says of the worktree of a feature document: its branch, its head, and what it has not committed, the first
 * paths named (`parseStatus`). A git that cannot say is said as not read, with why. */
function worktreeLineOf(worktree, run) {
  const asked = run('git', gitIn(worktree, ['status', '--porcelain=v2', '--branch', '-z']), { cwd: worktree });
  if (asked.error || asked.status !== 0) return `Worktree ${worktree}: its changes are not read (${gitReasonOf(asked)}).`;
  const status = parseStatus(String(asked.stdout ?? ''));
  const head = /^[0-9a-f]{7,}$/.test(status.head ?? '') ? status.head.slice(0, 7) : (status.head ?? 'not known');
  const { paths } = status;
  const changed = paths.length === 0
    ? 'nothing changed and not committed'
    : `${paths.length} files changed and not committed (${paths.slice(0, PATHS_LISTED).join(', ')}${paths.length > PATHS_LISTED ? ', …' : ''})`;
  return `Worktree ${worktree}: branch ${status.branch ?? 'not known'}, head ${head}, ${changed}.`;
}

// How many pieces of work the in-flight line names; the rest are a count and "…".
const IN_FLIGHT_LISTED = 5;

/** The lines of what the transcript leaves in flight when the session was compacted: the pieces of work it started with no
 * end recorded, named as the board names them (`workNameOf`), and the machine's gate when a turn at it is held from
 * `worktree` or waits from it (`gateLinesOf`). `worktree` is `null` where the state is in no worktree. */
function flightLinesOf(transcript, worktree, { gate, home }) {
  const lines = [];
  const open = sessionFacts(transcript).work.filter((work) => !work.ended);
  if (open.length > 0) {
    const named = open.slice(0, IN_FLIGHT_LISTED).map(workNameOf);
    lines.push(`In flight when it was compacted, by the transcript: ${open.length} (${named.join(', ')}${open.length > IN_FLIGHT_LISTED ? ', …' : ''}).`);
  }
  if (worktree !== null) lines.push(...gateLinesOf(worktree, { gate, home }));
  return lines;
}

/** The lines of the machine's gate for `worktree`: a turn held from it, and one that waits from it. A gate that cannot be read
 * says nothing, and is not a failure of the hook. `gate` reads the holder and the waiters of the lock under `home`. */
function gateLinesOf(worktree, { gate, home }) {
  const here = (folder) => typeof folder === 'string' && comparable(folder) === comparable(worktree);
  const lines = [];
  let holder = null;
  try {
    holder = gate.holder(home);
  } catch {
    holder = null;
  }
  if (holder !== null && here(holder.cwd)) lines.push(`A turn at the machine's gate is held from this worktree (since ${holder.startedAt ?? 'a time not known'}): it may be this session's.`);
  let waiters = [];
  try {
    waiters = gate.waiters(home);
  } catch {
    waiters = [];
  }
  if (waiters.some((waiter) => here(waiter.cwd))) lines.push('A turn at the machine\'s gate waits from this worktree.');
  return lines;
}

/** What a step says as lines: the lines it gives, or, when it throws, `<step>: not read (<reason>)`, as `stepSaid` says it for one line. */
function stepLines(step, work) {
  try {
    return work();
  } catch (err) {
    return [`${step}: not read (${reasonOf(err)})`];
  }
}

/** The lines of the stretch the user wrote, `person` (`{ line, at }`): how many, the last few line numbers, oldest first, and
 * the command that reads each of them, for `target` (the session's id). */
function userSaid(person, target) {
  if (person.length === 0) return 'The user wrote nothing in this stretch.';
  const last = person.slice(-LISTED).map((item) => item.line);
  return `The user wrote at ${person.length} lines of it, the last at ${last.join(', ')}: read each with  js-harness sessions --quote ${target} <line>`;
}

/** The messages of other sessions in the stretch, `sessions` (`{ line, at, name }`): how many, the last few line numbers,
 * and the names of the sessions with their counts, in the order they were first written; a message with no name is
 * `no name`. Null when there is none, and no line is said for it. */
function othersSaid(sessions) {
  if (sessions.length === 0) return null;
  const counts = new Map();
  for (const { name } of sessions) counts.set(name ?? null, (counts.get(name ?? null) ?? 0) + 1);
  const names = [...counts].map(([name, count]) => `${name === null ? 'no name' : printedTitle(name)} ×${count}`).join(', ');
  const last = sessions.slice(-LISTED).map((item) => item.line);
  return `Other sessions wrote at ${sessions.length} lines, the last at ${last.join(', ')} (from ${names}): the same command says whose each is.`;
}

/** This session's last reply with text in the stretch, in words: its line, its time, and its last characters made one line,
 * with a leading ellipsis when the reply is longer. Null when the deadline passed before it was read: `left` names it. */
function replySaid(facts, transcript, { late, left }) {
  const { lastReply } = facts;
  if (lastReply === null) return NO_REPLY;
  if (late()) {
    left.push(STEP.reply);
    return null;
  }
  return stepSaid('This session\'s last reply with text', () => {
    const read = replyOf(transcript, lastReply.line);
    if (!read.reply) return NO_REPLY;
    // Characters, not UTF-16 units: a cut must not split a character, and the length is counted the same way.
    const chars = Array.from(read.text);
    const tail = oneLine(chars.slice(-REPLY_TAIL).join(''));
    const at = read.at ?? lastReply.at;
    const stamp = at === null ? '' : ` (${at})`;
    return `This session's last reply with text is line ${lastReply.line}${stamp}; it ended: "${chars.length > REPLY_TAIL ? '…' : ''}${tail}"`;
  });
}

/** The lines of the stretch before the compaction, read from `file`, the transcript the session was compacted in, with
 * the head line that says so. `stretch` is `stretchOf`'s: a stretch that could not be read says so in its place. A step
 * the deadline passed is not read and is named in `left`; a step that throws is said as not read. */
function beforeLines(file, stretch, { transcript, sessionId, target, home, tmpdir, late, left, subject, run, stat, now, gate }) {
  const head = `Before this compaction, read from ${file}:`;
  if (stretch.failed !== undefined) return [head, `  The stretch of work before this compaction: not read (${stretch.failed})`];
  const { facts } = stretch;
  const lines = [compactionSaid(facts)];
  // What the pause's notice says of the stretch is read once: the pause's line says it, and the state's line compares its time.
  let told = null;
  if (late()) left.push(STEP.pause);
  else lines.push(stepSaid('The pause', () => {
    told = toldBetween({ home, sessionId, after: facts.stretch.after, before: facts.stretch.before, tmpdir });
    return pauseSaid(told);
  }));
  // Each of the next steps is checked against the hook's deadline before it starts, as the stretch's own lines are.
  if (subject !== null) {
    if (late()) left.push(STEP.written);
    else lines.push(stepSaid('The state', () => stateLineOf(subject.file, { run, stat, now, worktree: subject.worktree, noticedAt: told?.at ?? null })));
  }
  // The worktree is the one of a feature document: the relief file has none.
  if (subject !== null && subject.worktree !== null) {
    if (late()) left.push(STEP.worktree);
    else lines.push(stepSaid('The worktree', () => worktreeLineOf(subject.worktree, run)));
  }
  // A file the host continued holds none of the stretch: the lines of its entries say nothing of it.
  if (!facts.stretch.inThisFile) {
    lines.push('The stretch of work before this compaction is not in this transcript: the host continued the session in a new file, and no other session\'s file is read.');
  } else {
    // The work in flight is the transcript's own, so it is said only where the transcript holds the stretch: a continued one
    // holds the work after the compaction.
    if (late()) left.push(STEP.flight);
    else lines.push(...stepLines('The work in flight', () => flightLinesOf(transcript, subject?.worktree ?? null, { gate, home })));
    lines.push(userSaid(facts.person, target));
    const others = othersSaid(facts.sessions);
    if (others !== null) lines.push(others);
    const reply = replySaid(facts, transcript, { late, left });
    if (reply !== null) lines.push(reply);
  }
  // A compaction the host made by itself, or one whose boundary is not written yet (which the host does when it makes one).
  if (facts.current === null || facts.current.automatic === true) lines.push(HOST_COMPACTED);
  return [head, ...lines.map((line) => `  ${line}`)];
}

/** The lines the hook prints for the hook input `input`, or none when it is not for it to speak: an input
 * that is not a compaction's, a sub-agent's, or a project that did not opt in. */
function resumeLines(input, { defaultCwd, env, homedir, run, readFile, readdir, stat, now, late, isFile, gate }) {
  if (!isObject(input) || input.source !== 'compact') return [];
  // A sub-agent's start is not the session's: the hook speaks to the session, not to a sub-agent inside it.
  if (typeof input.agent_id === 'string' && input.agent_id !== '') return [];
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd) : defaultCwd;
  // The opt-in comes first and costs one question to git: elsewhere nothing more is looked at.
  if (!isFile(path.join(checkoutOf(run, cwd), 'harness.json'))) return [];

  // The project is the main checkout, from any worktree, as for the board and for `notify`; the homes are
  // found as they find them.
  const root = mainCheckout(run, cwd);
  const slug = projectSlug(root);
  const projectsDir = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'), 'projects');
  const projectDir = path.join(projectsDir, slug);
  const harnessHome = env.JS_HARNESS_HOME || homedir();
  const sessionId = typeof input.session_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{7,}$/.test(input.session_id) ? input.session_id : null;
  const record = readNotices(harnessHome, slug, { readFile });
  const transcript = transcriptOf(input, sessionId, { projectDir, projectsDir, readFile });
  const { title, from } = titleOf(input, sessionId, { transcript, record });

  const lines = ['js-harness resume: this session was just compacted. What follows is read from files; the summary of the compaction is not the record.'];
  lines.push(title === null ? `Session: title not known (${from})` : `Session: "${oneLine(title)}" (${from})`);

  const dir = openingsDir(harnessHome, slug);
  if (title === null) lines.push(`Opening: not known without a title (the openings of this project are in ${dir}; js-harness sessions --opening "<title>" prints one)`);
  else lines.push(...openingLines(findOpenings(harnessHome, slug, title, { readdir, readFile }), title));

  // The stretch of work before the compaction is read once, here, and only when the transcript was read: the feature
  // document and the lines of the stretch both come from it. A deadline that passed first names it as not read.
  const left = [];
  let stretch = null;
  if (transcript !== null) {
    if (late()) left.push(STEP.stretch);
    else stretch = stretchOf(transcript);
  }

  // An orchestrator keeps its state in its relief file, and no feature document is its: that file is named in
  // place of the feature document and of the folders.
  // The file whose state the block says the age of (`subject`): the relief file, or the one feature document the hook found.
  // Its `worktree` is `null` for the relief file, which is in no repository.
  let subject = null;
  const orchestrator = roleOfTitle(title)?.role === 'orchestrator';
  if (orchestrator) {
    const relief = reliefPath(harnessHome, slug);
    subject = { file: relief, worktree: null };
    lines.push(...reliefLinesOf(relief, { readFile, stat, now }));
  } else {
    // What the session wrote last is the best word on where it works; the notice and its folders are asked only without it.
    const wrote = writtenOf(stretch?.facts?.wrote ?? null, { run, isFile });
    const feature = wrote === null ? featureOf(record, sessionId, title, { run, readFile }) : null;
    if (wrote !== null) {
      subject = { file: wrote.path, worktree: wrote.worktree };
      lines.push(`Feature document: ${wrote.path}  (${wrote.branch === null ? 'branch not known' : `branch ${wrote.branch}`}, the last feature document this session wrote, by its transcript)`, `Read "Next step" in that document, ${TRUST}`);
    } else if (feature.unknown !== undefined) {
      lines.push(`Feature document: not known (${feature.unknown})`);
      if (late()) left.push(STEP.folders);
      else {
        try {
          lines.push(...documentFolders(run, root, { readdir, stat, now }), `Find there the document of the feature this session was working on, read its "Next step", ${TRUST}`);
        } catch (err) {
          lines.push(`Feature documents: not read (${reasonOf(err)})`);
        }
      }
    } else if (feature.documents.length === 1) {
      subject = { file: feature.documents[0], worktree: feature.worktree };
      lines.push(`Feature document: ${feature.documents[0]}  (branch ${feature.branch}, ${placeOfFeature(feature)})`, `Read "Next step" in that document, ${TRUST}`);
    } else {
      lines.push(`Feature documents: the branch ${feature.branch} changed ${feature.documents.length}, ${placeOfFeature(feature)}; this session works on one of them`);
      lines.push(...feature.documents.map((document) => `  ${document}`), `Read "Next step" in the one this session was working on, ${TRUST}`);
    }
  }

  // The stretch's own steps after the folders: a stretch the deadline passed names the pause and the reply with it.
  if (transcript !== null && stretch === null) left.push(STEP.pause, ...(subject === null ? [] : [STEP.written]), ...(subject?.worktree ? [STEP.worktree] : []), STEP.flight, STEP.reply);
  if (transcript !== null && stretch !== null) {
    // The session is named by its id, as `sessions --quote` takes it: a transcript is read only when the hook has one.
    const file = transcriptFileOf(input, sessionId, { projectDir, projectsDir });
    lines.push(...beforeLines(file, stretch, { transcript, sessionId, target: sessionId, home: harnessHome, tmpdir: tempOf(env), late, left, subject, run, stat, now, gate }));
  }
  if (left.length > 0) lines.push(`Not read before this hook's own deadline (9 s): ${left.join(', ')}.`);
  // A work session tells the orchestrator that it was compacted; the orchestrator has no one above it to tell.
  if (!orchestrator) lines.push(NOTIFY);
  return lines;
}

/** Whether `folder` or one of its parents holds a `harness.json`: the walk `--pause` makes, each folder tested with
 * `isFile`, up to the root of the file system. It is a walk of files and no `git` call, since a `git` for each tool
 * call would cost the hook more than the pause is worth; a checkout's root holds the file, and so does a folder under it. */
function hasHarnessJson(folder, isFile) {
  for (let dir = folder; ; dir = path.dirname(dir)) {
    if (isFile(path.join(dir, 'harness.json'))) return true;
    if (path.dirname(dir) === dir) return false;
  }
}

/** The line `--pause` prints for the hook input `input`, or `null` when it says nothing: an input that is not an
 * object, a sub-agent's call (`agent_id`), a call without a transcript, a project with no `harness.json` above the
 * call's folder, or a call that does not pass the pause. `pauseNotice` throws for a session id it cannot name a
 * state file by; the caller's catch turns that into silence. The state goes to the harness home, and its temp folder
 * is under the same home when `JS_HARNESS_HOME` is set, so a made-up home never reaches the real temp folder. */
function pauseLine(input, { defaultCwd, env, homedir, isFile }) {
  if (!isObject(input) || (typeof input.agent_id === 'string' && input.agent_id !== '')) return null;
  if (typeof input.transcript_path !== 'string' || input.transcript_path === '') return null;
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd) : defaultCwd;
  if (!hasHarnessJson(cwd, isFile)) return null;
  const notice = pauseNotice({
    transcript: input.transcript_path,
    sessionId: input.session_id,
    home: env.JS_HARNESS_HOME || homedir(),
    tmpdir: tempOf(env),
  });
  if (notice === null) return null;
  // Another entry (a `Stop` hook, later) runs this command too, so the event is the input's own when it names one.
  const event = typeof input.hook_event_name === 'string' && input.hook_event_name !== '' ? input.hook_event_name : 'PostToolUse';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: notice.text } });
}

export async function resumeMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    homedir = os.homedir,
    // Everything that reads the disk or starts a process is a seam, so the tests hand in a machine of
    // their own. `run` is `git`, with a time limit.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: GIT_TIMEOUT }),
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    readdir = (absolute) => fs.readdirSync(absolute),
    stat = (absolute) => fs.statSync(absolute),
    now = Date.now,
    readStdin = () => fs.readFileSync(0, 'utf8'),
    stdinIsTTY = tty.isatty(0),
    // The machine's gate, read as `gate-lock.mjs` reads it: its holder, and the gates that wait. Each read may throw.
    gate = { holder: (home) => readGateHolder(home), waiters: (home) => readGateWaiters(home) },
  } = {},
) {
  // `--pause` is the mode of a `PostToolUse` hook, so it takes no other argument: a hook never sends one, and a
  // person who types one at a shell gets the usage.
  const pause = argv.includes('--pause');
  if (pause ? argv.length !== 1 : !argv.includes('--hook')) {
    stderr(USAGE);
    return 2;
  }
  // From here on nothing fails and nothing is half said: the lines are printed once they are all there,
  // and whatever throws on the way leaves the session as it would be without the hook. The pause mode is
  // run after every tool call, so it is also silent on every failure: exit 2 from a hook would block the host.
  try {
    // The hook's own deadline counts from the start of its mode (`HOOK_DEADLINE`), before anything is read.
    const started = now();
    const late = () => now() - started >= HOOK_DEADLINE;
    // A terminal is nobody's hook input, and reading it would wait for a key.
    const parsed = stdinIsTTY ? { why: 'standard input is a terminal' } : inputOf(readStdin());
    if (parsed.why !== undefined) {
      // The hook is run by hand when a person tries it at a shell, and only then is the reason said: a host
      // shows a hook's standard error to nobody on exit 0. `--pause` is a host's hook, and stays silent.
      if (!pause) stderr(`js-harness resume --hook: the host's JSON was expected on standard input and none was read (${parsed.why}); nothing was looked at.`);
      return 0;
    }
    const input = parsed.input;
    const isFile = (absolute) => {
      try {
        return stat(absolute).isFile();
      } catch {
        return false;
      }
    };
    if (pause) {
      const line = pauseLine(input, { defaultCwd, env, homedir, isFile });
      if (line !== null) stdout(line);
      return 0;
    }
    const lines = resumeLines(input, { defaultCwd, env, homedir, run, readFile, readdir, stat, now, late, isFile, gate });
    if (lines.length > 0) stdout(lines.join('\n'));
  } catch {
    // Fail open: a hook that breaks a session's start is worse than one that says nothing.
  }
  return 0;
}
