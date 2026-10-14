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
// messages, the last reply, and the questions the channel's record holds. It
// reads for nine seconds at most and says what it left unread. Each comes from a file, and what no file says
// is said as not known, with where to look. Like every
// hook: it acts only in a project that opted in (a `harness.json` at the root of the checkout the session
// is in) and prints nothing elsewhere; it never fails a session (a file or a folder it cannot read is said
// as not looked at, and whatever else goes wrong, it prints nothing; either way it exits 0); and it writes
// nothing, not even the reading `sessions --opening` records. The one thing it says on standard error is
// that its input was not read, when it was not: a person who runs it at a shell is told why nothing came
// out, and a host shows a hook's standard error to nobody when it exits 0. Zero dependencies.
//
// The questions block gives each question of the channel's record with the call the transcript makes for it, in
// every state, the answered ones too. A block that named only the unanswered calls would leave a question he has
// answered with no call to it in the record, and an orchestrator compacted just after his tap would ask him again.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { spawnSync } from 'node:child_process';
import { findOpenings, openingCommand, openingsDir, placeOf, recordedQuestions, reliefPath, readNotices } from './lib/channel.mjs';
import { readGateHolder, readGateWaiters } from './lib/gate-lock.mjs';
import { inboxNotice, mainCheckoutByFiles } from './lib/inbox.mjs';
import { pauseNotice, toldBetween } from './lib/pause.mjs';
import { askingRule, comparable, compactionStretch, isSelf, mainCheckout, parseWorktreeList, projectSlug, QUESTION_WORD, questionPrefix, questionRecordOf, readPlans, recordQuestionsIn, reliefTail, replyOf, roleOfTitle, sameSession, sessionFacts, thousands, titleRead, workNameOf } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness resume --hook',
  '         a SessionStart hook for the matcher "compact": it reads the hook\'s input from standard input and,',
  '         after a compaction in a project with a harness.json, prints the session\'s title, its opening,',
  '         its feature document (its relief file, for an orchestrator) and what to read there. It prints',
  '         nothing anywhere else and writes nothing; when its standard input was not read, it says so on',
  '         standard error. It always exits 0.',
  'Usage: js-harness resume --pause',
  '         a PostToolUse hook for the context pause: it reads the hook\'s input from standard input and prints',
  '         one JSON line with the notice the first time a stretch of work passes the pause, and the notices of the',
  '         channel addressed to the session that it was not told yet, once each; nothing else.',
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
  feature: 'the feature document',
  folders: 'the feature document folders',
  pause: 'the pause\'s notice',
  written: 'when the state was last written and committed',
  worktree: 'the worktree\'s changes',
  flight: 'the work in flight and the machine\'s gate',
  reply: 'this session\'s last reply',
  questions: 'the questions',
};

// Why a git call was not started, and why a search was cut short: the words of the hook's own deadline.
const DEADLINE_PASSED = 'this hook\'s own deadline passed';

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


/** How the session prints its stored opening, as what goes in brackets after the file's path: the
 * command, for a title every shell reads alike (`PLAIN_TITLE`), and otherwise how to ask, in words: a
 * command printed here is run as it is, so one that asks for another title is worse than none. */
function printing(title) {
  const asked = title.trim();
  const command = openingCommand(asked);
  if (command !== null) return `print it: ${command}`;
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

/** Whether `file` holds more than its last commit in `worktree`, by git's status of that one path: `true`, `false`, or
 * `null` when git could not say. A file's time does not tell: a checkout or a restore gives a new time to a file that
 * holds exactly what its commit holds. */
function changedOf(run, worktree, file) {
  const relative = path.relative(worktree, file).split(path.sep).join('/');
  const asked = run('git', gitIn(worktree, ['status', '--porcelain', '--', relative]), { cwd: worktree });
  if (asked.error || asked.status !== 0) return null;
  return String(asked.stdout ?? '').trim() !== '';
}

/** When the state file was last written, and for a file in a worktree when it was last committed, as the line `State:` says
 * it, with what the pause's notice says of those times: `noticedAt`, the ISO time of the notice in the stretch, or `null`.
 * `worktree` is `null` for the relief file, which is in no repository and has no commit. A notice written before both
 * times, or the file, says that what the file holds may be older than the work. A file written after the notice and
 * committed before it is "not committed" only when git says it differs from that commit (`changedOf`): one that holds
 * what the commit holds is as old as the commit, whatever its time. */
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
  if (committed >= noticed) return `${line} Both are after the pause's notice.`;
  const changed = changedOf(run, worktree, file);
  if (changed === null) return `${line} It was written after the pause's notice, and whether that is committed is not read.`;
  if (changed) return `${line} It was written after the pause's notice and that is not committed.`;
  return `${line} It holds what that commit holds, from before the pause's notice of ${noticedAt}: what it holds may be older than the work, so say so in your next reply to the user.`;
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
    // A timer outlived what it waited for and could have acted on its own (his correction, 2026-10-14): after a
    // compaction each piece is judged at once, by what its description says.
    lines.push('Each says in its description what it is for and what ends it. Stop now (TaskStop) one whose condition resolved another way, or that says neither; write what stays running, and who stops it, to this session\'s state.');
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
 * the command that reads each of them, for `target` (the session's id). `target` is `null` for a transcript that is not in
 * `projectDir`, the one folder `sessions --quote` reads: by the id it would answer for another file of that folder, or for
 * none, so no command is written and the line says why. */
function userSaid(person, target, projectDir) {
  if (person.length === 0) return 'The user wrote nothing in this stretch.';
  const last = person.slice(-LISTED).map((item) => item.line);
  if (target === null) return `The user wrote at ${person.length} lines of it, the last at ${last.join(', ')}: no command reads them, since js-harness sessions --quote reads only the transcripts of ${projectDir} and this one is filed under another project; read them in the file itself.`;
  return `The user wrote at ${person.length} lines of it, the last at ${last.join(', ')}: read each with  js-harness sessions --quote ${target} <line>`;
}

/** The messages of other sessions in the stretch, `sessions` (`{ line, at, name }`): how many, the last few line numbers,
 * and the names of the sessions with their counts, in the order they were first written; a message with no name is
 * `no name`. Null when there is none, and no line is said for it. The command of the user's line is named only when
 * there is one (`target`, as `userSaid` takes it). */
function othersSaid(sessions, target) {
  if (sessions.length === 0) return null;
  const counts = new Map();
  for (const { name } of sessions) counts.set(name ?? null, (counts.get(name ?? null) ?? 0) + 1);
  const names = [...counts].map(([name, count]) => `${name === null ? 'no name' : printedTitle(name)} ×${count}`).join(', ');
  const last = sessions.slice(-LISTED).map((item) => item.line);
  return `Other sessions wrote at ${sessions.length} lines, the last at ${last.join(', ')} (from ${names})${target === null ? '.' : ': the same command says whose each is.'}`;
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
function beforeLines(file, stretch, { transcript, sessionId, target, projectDir, home, tmpdir, late, left, subject, run, stat, now, gate }) {
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
    lines.push(userSaid(facts.person, target, projectDir));
    const others = othersSaid(facts.sessions, target);
    if (others !== null) lines.push(others);
    const reply = replySaid(facts, transcript, { late, left });
    if (reply !== null) lines.push(reply);
  }
  // A compaction the host made by itself, or one whose boundary is not written yet (which the host does when it makes one).
  if (facts.current === null || facts.current.automatic === true) lines.push(HOST_COMPACTED);
  return [head, ...lines.map((line) => `  ${line}`)];
}

// How many characters of a question's text the hook prints, and of the answers a closed question's line names; how many
// closed questions the list of a work session prints, the last ones by number; and the line the list ends with.
const QUESTION_LISTED = 200;
const ANSWER_LISTED = 300;
const CLOSED_LISTED = 5;
const BOARD_QUESTIONS = 'The board lists the questions of every session: js-harness sessions';

/** A text cut to `max` characters, as the reply's cut counts them, so a cut never splits a character; with an ellipsis at
 * its end when it was longer. */
const cutTo = (text, max) => {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
};

/** How long before `now` a notice's time was, as `ago` says it, or that the time is not known: a record holds text, and a
 * notice whose time does not parse says so rather than a number of minutes that is not one. */
const agoOf = (at, now) => (Number.isNaN(Date.parse(at)) ? 'at an unknown time' : ago(Date.parse(at), now));

/** Who asked a question, as the line names the asker: its title in JSON quotes, else its session by the first eight characters
 * of its id, else that the host named no sender. `from` is a notice's `from`, or what `questionRecordOf` gives. */
function askerOf(from) {
  if (isObject(from) && typeof from.title === 'string' && from.title !== '') return printedTitle(from.title);
  if (isObject(from) && typeof from.id === 'string' && from.id !== '') return `session ${from.id.slice(0, 8)}`;
  return 'a sender the host does not name';
}

/** What the transcript holds of a question of the record, in words, for the line under the question: that no call of it is in
 * the transcript, or the state of the call it is joined to (`recordQuestionsIn`). `ownWork` is true for a work session's own
 * question, which the orchestrator shows him; `sessionId` is the session's id, or `null` when the hook has none. `read`
 * is whether the hook has the transcript: without it, a question with no call is not known to be unasked, and the line says
 * to look, never to ask. `ask` is how to ask him now, `askingRule`'s sentence, for a question that has to be asked again.
 * `quoted` is whether `sessions --quote` can read this transcript, which is true only in this project's sessions folder. */
function callSaid(item, { ownWork, sessionId, read, ask, quoted }) {
  const { call } = item;
  if (call === null && !read) return 'this session\'s transcript was not read, so it is not known whether it was asked or answered here: look (js-harness sessions) before asking';
  // An orchestrator's line sends it to look first: a work session may have asked the question and had his answer, with no
  // answer notice yet, and only the board sees that, not this transcript.
  if (call === null) {
    return ownWork
      ? 'recorded, no answer yet: the orchestrator shows it to the user; go on with what does not wait on it (js-harness sessions lists it)'
      : `not asked in this transcript: look first (js-harness sessions), since another session may have asked it and had the user's answer; if it is open there: ${ask}. Its text is headed by "${questionPrefix(item.number)}"`;
  }
  if (call.state === 'pending') return `asked at line ${call.line} of this transcript, with no answer in it: it may be on the user's screen; look (js-harness sessions) before asking again`;
  if (call.state === 'closed') return `the user closed it without answering (asked at line ${call.line}): ask it again: ${ask}`;
  if (call.state === 'unanswered') return `asked at line ${call.line}, and its result is no answer of the user's: ask it again: ${ask}`;
  // Answered: the reply goes back to the asker's work session when its title names one, else to the orchestrator, which asks him.
  const role = roleOfTitle(item.from.title);
  const to = role?.role === 'work' ? role.number : 'orchestrator';
  const id = sessionId ?? '<session id>';
  // `sessions --quote` reads only this project's sessions folder: a transcript filed elsewhere cannot be quoted from there,
  // so its answer is recorded from the line, as unverified, and no quote command is named. The transcript is named by the word
  // `outside-the-project-folder`, which is no file and starts no transcript id: `transcriptNamed` resolves nothing from it, so
  // `notify` cannot check the answer against another session's transcript in this project's folder.
  if (!quoted) return `the user ANSWERED it at line ${call.answeredLine} of this transcript: do not ask it again. This transcript is not in this project's sessions folder, so the harness cannot read that line: record it as the sender's claim with js-harness notify --to ${to} --kind answer --question ${item.number} --transcript outside-the-project-folder --line ${call.answeredLine} "<the user's answer in one line>", which keeps it unverified`;
  return `the user ANSWERED it at line ${call.answeredLine} of this transcript: do not ask it again. Read it: js-harness sessions --quote ${id} ${call.answeredLine}  Then record it: js-harness notify --to ${to} --kind answer --question ${item.number} --transcript ${id} --line ${call.answeredLine} "<the user's answer in one line>"`;
}

/** A question of the record that no notice closed, as two lines: the question with its asker, its age and what waits on it,
 * and under it what the transcript holds of it (`callSaid`). `ask` is how to ask him now (`askingRule`), `quoted` as `callSaid` takes it. */
function openLinesOf(item, { ownWork, sessionId, now, read, ask, quoted }) {
  return [
    `  ${QUESTION_WORD} ${item.number}  recorded ${agoOf(item.at, now)} by ${askerOf(item.from)}  waits: ${item.waits ?? ''}  ${cutTo(oneLine(item.text), QUESTION_LISTED)}`,
    `    ${callSaid(item, { ownWork, sessionId, read, ask, quoted })}`,
  ];
}

/** A question of the record that a notice closed, as one line: a withdrawal with its reason; an answer that was read, with the
 * answers its copy holds; or an answer that no transcript confirmed, which is the sender's claim and says where it was read. */
function closedLineOf(question) {
  const { by, notice } = question.closed;
  const head = `  ${QUESTION_WORD} ${question.number}  `;
  if (by === 'withdrawn') return `${head}withdrawn by ${askerOf(notice.from)}: ${notice.text}`;
  const read = `${notice.transcript}:${notice.line}`;
  if (notice.verified === true) {
    const answers = oneLine((notice.copy?.answers ?? []).map((answer) => answer.answer).join('; '));
    return `${head}ANSWERED, read at ${read}: ${cutTo(answers, ANSWER_LISTED)}`;
  }
  return `${head}answered by the claim of ${askerOf(notice.from)}, NOT VERIFIED (${read}): ${notice.text}`;
}

/** The lines of the questions of the channel's record, for the session the hook speaks to, or none when the record holds none
 * for it. An orchestrator gets every question that no notice closed, each with what its transcript holds of it. A work session
 * gets the questions it recorded itself: its open ones with the same lines, and its last closed ones, one line each. A record
 * that could not be read is said in one line. The record is what `readNotices` read; the calls are the transcript's own
 * (`sessionFacts`), and none when no transcript could be read. `quoted` is whether the transcript is in this project's sessions
 * folder, which `sessions --quote` reads (`resumeLines` computes it once for the stretch's lines too). */
function questionLinesOf(record, { transcript, sessionId, orchestrator, now, quoted }) {
  if (record.unavailable !== undefined) return [`Questions: not read (the channel's record ${record.path} could not be read: ${record.unavailable})`];
  const recorded = recordedQuestions(record);
  if (recorded.length === 0) return [];
  const mine = orchestrator ? recorded : recorded.filter((question) => isObject(question.notice.from) && sameSession(question.notice.from.id, sessionId));
  if (mine.length === 0) return [];
  // One reading of the transcript for both: its question calls, and when he last wrote in it.
  const facts = transcript === null ? null : sessionFacts(transcript, { tail: 0 });
  const calls = facts === null ? [] : facts.questions;
  const items = recordQuestionsIn(questionRecordOf(mine), calls);
  const open = items.filter((item) => !item.closed);
  // How to ask him a question that has to be asked again: when he last wrote in this transcript, and how many wait.
  const ask = askingRule(facts?.personAt ?? null, now, { waiting: open.length });
  if (orchestrator) {
    if (open.length === 0) return [`Questions: the record holds ${recorded.length}, none open.`];
    return [
      `Questions with no answer in the record (${open.length} of ${recorded.length} recorded), with what this transcript holds of each:`,
      ...open.flatMap((item) => openLinesOf(item, { ownWork: false, sessionId, now, read: transcript !== null, ask, quoted })),
      BOARD_QUESTIONS,
    ];
  }
  const closed = mine.filter((question) => question.closed !== null);
  const shown = closed.slice(-CLOSED_LISTED);
  const earlier = closed.length - shown.length;
  return [
    `Questions this session recorded (${mine.length}):`,
    ...open.flatMap((item) => openLinesOf(item, { ownWork: true, sessionId, now, read: transcript !== null, ask, quoted })),
    ...shown.map(closedLineOf),
    ...(earlier > 0 ? [`  ${earlier} earlier ones are in the record: ${record.path}`] : []),
    BOARD_QUESTIONS,
  ];
}

/** The lines the hook prints for the hook input `input`, or none when it is not for it to speak: an input
 * that is not a compaction's, a sub-agent's, or a project that did not opt in. */
function resumeLines(input, { defaultCwd, env, homedir, run: git, readFile, readdir, stat, now, late, isFile, gate }) {
  if (!isObject(input) || input.source !== 'compact') return [];
  // A sub-agent's start is not the session's: the hook speaks to the session, not to a sub-agent inside it.
  if (typeof input.agent_id === 'string' && input.agent_id !== '') return [];
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd) : defaultCwd;
  // No git is started once the hook's own deadline has passed: each call is allowed its own time limit, and what the
  // host allows is for the whole hook, whose lines are lost when it is passed. A call that is not started reads as one
  // git could not make, with why, and `refused` tells a search made of several calls that it was cut short.
  const guard = { refused: false };
  const run = (command, args, options) => {
    if (!late()) return git(command, args, options);
    guard.refused = true;
    return { error: new Error(DEADLINE_PASSED), status: null, stdout: '', stderr: '' };
  };
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
  // Whether `sessions --quote` can read the transcript: it is in the project's sessions folder, the one that command reads.
  // The stretch's lines and the questions' lines take this one fact; without a transcript it is not used.
  const transcriptFile = transcriptFileOf(input, sessionId, { projectDir, projectsDir });
  const quoted = transcriptFile !== null && path.relative(projectDir, transcriptFile) === path.basename(transcriptFile);
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
  } else if (late()) {
    // The search costs up to four calls of git: past the deadline it is not started, and neither are the folders.
    left.push(STEP.feature, STEP.folders);
    lines.push(`Feature document: not known (${DEADLINE_PASSED} before it was looked for)`);
  } else {
    // What the session wrote last is the best word on where it works; the notice and its folders are asked only without it.
    const wrote = writtenOf(stretch?.facts?.wrote ?? null, { run, isFile });
    const feature = wrote === null ? featureOf(record, sessionId, title, { run, readFile }) : null;
    if (wrote !== null) {
      subject = { file: wrote.path, worktree: wrote.worktree };
      lines.push(`Feature document: ${wrote.path}  (${wrote.branch === null ? 'branch not known' : `branch ${wrote.branch}`}, the last feature document this session wrote, by its transcript)`, `Read "Next step" in that document, ${TRUST}`);
    } else if (feature.unknown !== undefined && guard.refused) {
      // The deadline passed between two of the search's calls: what git "did not say" is that it was not asked.
      left.push(STEP.feature, STEP.folders);
      lines.push(`Feature document: not known (${DEADLINE_PASSED} while it was looked for)`);
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
    // The session is named by its id, as `sessions --quote` takes it, when its transcript is in the project's sessions
    // folder (`quoted`); a transcript is read only when the hook has one.
    lines.push(...beforeLines(transcriptFile, stretch, { transcript, sessionId, target: quoted ? sessionId : null, projectDir, home: harnessHome, tmpdir: tempOf(env), late, left, subject, run, stat, now, gate }));
  }
  // The questions come after the stretch's lines and before the deadline's line. Past the deadline they are named as not read.
  if (late()) left.push(STEP.questions);
  else lines.push(...stepLines('The questions', () => questionLinesOf(record, { transcript, sessionId, orchestrator, now: now(), quoted })));
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
function pauseLine(input, { defaultCwd, env, homedir, isFile, run }) {
  if (!isObject(input) || (typeof input.agent_id === 'string' && input.agent_id !== '')) return null;
  if (typeof input.transcript_path !== 'string' || input.transcript_path === '') return null;
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd) : defaultCwd;
  if (!hasHarnessJson(cwd, isFile)) return null;
  const home = env.JS_HARNESS_HOME || homedir();
  const notice = pauseNotice({ transcript: input.transcript_path, sessionId: input.session_id, home, tmpdir: tempOf(env) });
  // The channel's notes to this session ride on the same call: the record is the main checkout's, as `notify` writes it.
  const inbox = inboxNotice({ transcript: input.transcript_path, sessionId: input.session_id, cwd, home, slugOf: (folder) => projectSlug(mainCheckoutByFiles(folder)) });
  const said = [notice?.text, inbox?.text].filter((text) => typeof text === 'string');
  if (said.length === 0) return null;
  // Another entry (a `Stop` hook, later) runs this command too, so the event is the input's own when it names one.
  const event = typeof input.hook_event_name === 'string' && input.hook_event_name !== '' ? input.hook_event_name : 'PostToolUse';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: said.join('\n\n') } });
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
  // person who types one at a shell gets the usage. `--hook` takes none either: `install` writes it alone, so
  // another one means the copy on the path is older than the install, and it is named (T1 of
  // odd/tasks/commands-and-doctor.md); a SessionStart hook's exit 2 shows the line and stops nothing.
  const pause = argv.includes('--pause');
  const mode = pause ? '--pause' : '--hook';
  if (argv.length !== 1 || argv[0] !== mode) {
    const unknown = argv.includes(mode) ? argv.find((token) => token !== mode) : undefined;
    if (unknown !== undefined) stderr(`unknown argument: ${unknown}`);
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
      const line = pauseLine(input, { defaultCwd, env, homedir, isFile, run });
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
