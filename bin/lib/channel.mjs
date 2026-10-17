// The session channel's files — see odd/tasks/session-channel.md (points 2, 6 and 7). The sessions of a
// project tell each other what happened through a record that a command writes and a command reads: one
// JSON Lines file per project under the harness home, beside the orchestrator's relief file. The app's
// message is only the doorbell, since a message can be held, expire or reach a session that left, and
// none of that can be read afterwards. This file holds what `bin/notify.mjs` writes (a notice, a relief
// line, an opening) and the readers the board takes them back with. A notice is a claim of the session
// that wrote it, never the user's word. A question put to him is a notice of kind `question`, and one closed
// without his answer a notice of kind `withdrawn`; the board reads both from the record.
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
 * words given in the orchestrator's chat, with the transcript and the line they are read at), `relieved`
 * (who has the role now), `question` (a question put to him, written before it is asked: its options, what
 * waits on it, and the number it is known by, which is its line's place in the record) and `withdrawn` (a
 * question closed without his answer, said as not his). */
export const NOTICE_KINDS = ['opened', 'waiting', 'closed', 'note', 'answer', 'relieved', 'question', 'withdrawn', 'ready'];

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
/** The limits of a question and of the copy of an answer, in characters. They exist for the same reason as
 * the others: the record is appended with one small write (`appendLine`), and a question with its six
 * options and what waits on it stays far under what that write takes. */
export const QUESTION_TEXT_MAX = 2000;
export const QUESTION_OPTIONS_MAX = 6;
export const OPTION_LABEL_MAX = 120;
export const OPTION_DESCRIPTION_MAX = 500;
export const QUESTION_WAITS_MAX = 500;
export const ANSWER_COPY_TEXT_MAX = 2000;
/** The longest id of a question: a random one of its own, by which the record finds the notice again. */
const QUESTION_ID_MAX = 100;
/** The most options of an answer that its copy keeps: the rest of a question's options are not kept. */
const ANSWER_COPY_OPTIONS_MAX = 12;

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
 * `line` the user's words are read at; nothing here checks the quote. A `question` has no text of a note's
 * length: its `text` is the question, and it has an `id`, its `options` (`checkedQuestion`) and its `waits`.
 * A `withdrawn` closes the question numbered `question` without his answer, and its text is the reason. A `ready`
 * says the pull request numbered `pr` is ready to land, so the land can tell whose it is without a branch. An
 * `answer` may name the question it answers with `question`, with `verified` (whether its line was read) and
 * `copy` (`answerCopyOf` what the line holds, or `null` when no transcript could be read). Throws a
 * `ChannelInputError` for anything that is not a notice. */
export function newNotice({ at, from, to, kind, text, cwd = null, worktree = null, branch = null, transcript, line, id, options, waits, question, verified, copy, pr, summary }) {
  const role = typeof to === 'string' ? roleNamed(to) : null;
  if (role === null) throw new ChannelInputError('--to takes a role: orchestrator (or ORQ), or the number of a work session');
  if (!NOTICE_KINDS.includes(kind)) throw new ChannelInputError(`--kind takes one of ${NOTICE_KINDS.join(', ')}`);
  if (kind !== 'answer' && (transcript !== undefined || line !== undefined)) throw new ChannelInputError('only an answer takes --transcript and --line');
  if (kind !== 'question' && (id !== undefined || options !== undefined || waits !== undefined)) throw new ChannelInputError('only a question takes id, options and waits');
  if (kind !== 'answer' && kind !== 'withdrawn' && question !== undefined) throw new ChannelInputError('only an answer or a withdrawal takes --question');
  if (kind !== 'answer' && (verified !== undefined || copy !== undefined)) throw new ChannelInputError('only an answer with a question takes verified and copy');
  if (kind !== 'ready' && pr !== undefined) throw new ChannelInputError('only a ready notice takes --pr');
  if (kind !== 'closed' && summary !== undefined) throw new ChannelInputError('only a closed notice takes --summary');
  if (kind === 'question' && role.role !== 'orchestrator') throw new ChannelInputError('a question goes to the orchestrator, who asks the user: --to orchestrator');
  const asked = kind === 'question' ? checkedQuestion({ text, options, waits }) : null;
  const notice = { schema: NOTICE_SCHEMA, at, from, to: role, kind, text: asked === null ? oneLine(text, NOTICE_TEXT_MAX, 'the text of a notice') : asked.text, cwd, worktree, branch };
  if (kind === 'question') return { ...notice, id: oneLine(id, QUESTION_ID_MAX, 'the id of a question'), options: asked.options, waits: asked.waits };
  if (kind === 'ready') {
    if (pr === undefined) throw new ChannelInputError('a ready notice names its pull request: --pr <n>');
    if (!isPullRequestNumber(pr)) throw new ChannelInputError('--pr takes the number of a pull request, from 1');
    return { ...notice, pr };
  }
  if (kind === 'withdrawn') {
    if (question === undefined) throw new ChannelInputError('a withdrawal names its question: --question <n>');
    return { ...notice, question: questionNumberOf(question) };
  }
  if (kind === 'closed' && summary !== undefined) return { ...notice, summary: summaryFileOf(summary) };
  if (kind !== 'answer') return notice;
  if (transcript === undefined || line === undefined) throw new ChannelInputError('an answer says where the user\'s words are read: --transcript <file or session id> and --line <n>');
  if (!Number.isSafeInteger(line) || line < 1) throw new ChannelInputError('--line takes the number of a line of the transcript, from 1');
  const answer = { ...notice, transcript: oneLine(transcript, 1000, 'the value of --transcript'), line };
  if (question === undefined) {
    if (verified !== undefined || copy !== undefined) throw new ChannelInputError('only an answer with a question takes verified and copy');
    return answer;
  }
  const number = questionNumberOf(question);
  if (typeof verified !== 'boolean') throw new ChannelInputError('verified takes true or false: whether the line of the user\'s words was read');
  if (verified) {
    if (!isObject(copy)) throw new ChannelInputError('a verified answer takes copy, what its line holds (answerCopyOf)');
    return { ...answer, question: number, verified, copy: answerCopyOf(copy) };
  }
  if (copy !== null) throw new ChannelInputError('an answer that was not verified takes copy null: no transcript could be read');
  return { ...answer, question: number, verified, copy: null };
}

/** The file of the summary a closed notice names (odd/tasks/session-close.md, T2): a Markdown file directly under
 * `docs/sessions/`, relative to the repository, with forward slashes. Throws a `ChannelInputError` for anything else. */
function summaryFileOf(summary) {
  const file = typeof summary === 'string' ? summary.replace(/\\/g, '/') : '';
  if (!/^docs\/sessions\/[^/.][^/]*\.md$/.test(file)) throw new ChannelInputError('--summary takes a file of docs/sessions/, as js-harness summary path names it');
  return file;
}

/** The number of a question, as the command and the record take it: a whole number from 1. Throws a
 * `ChannelInputError` otherwise. */
function questionNumberOf(question) {
  if (!isQuestionNumber(question)) throw new ChannelInputError('--question takes the number of a question, from 1');
  return question;
}

/** Whether `value` is the number of a pull request: a whole number from 1. */
function isPullRequestNumber(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

/** Whether `value` is the number of a question: a whole number from 1. */
function isQuestionNumber(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

/** The fields of a question as a notice keeps them, checked: `text` one line of `QUESTION_TEXT_MAX`, `options`
 * a list of at most `QUESTION_OPTIONS_MAX` (the recommended one first; an empty list is a question with nothing
 * to tap), no two with one label, and `waits` one line. It is the one check of a question, whether it comes
 * from standard input (`questionFieldsOf`) or from a caller (`newNotice`). Throws a `ChannelInputError`. */
function checkedQuestion({ text, options, waits }) {
  const line = oneLine(text, QUESTION_TEXT_MAX, 'the text of a question');
  if (!Array.isArray(options)) throw new ChannelInputError('the options of a question are a list, the recommended one first');
  if (options.length > QUESTION_OPTIONS_MAX) throw new ChannelInputError(`a question has ${options.length} options, ${QUESTION_OPTIONS_MAX} at most`);
  const checked = options.map(optionOf);
  const labels = new Set();
  for (const { label } of checked) {
    if (labels.has(label)) throw new ChannelInputError(`two options of a question have the label "${label}"`);
    labels.add(label);
  }
  return { text: line, options: checked, waits: oneLine(waits, QUESTION_WAITS_MAX, 'what waits on a question') };
}

/** One option of a question as it is kept: `{ label, description }`, a missing description stored as `''`. It
 * takes no other key, so a misspelt one is named rather than dropped. Throws a `ChannelInputError`. */
function optionOf(option) {
  if (!isObject(option)) throw new ChannelInputError('an option of a question is an object, with a label and a description');
  const extra = Object.keys(option).find((key) => key !== 'label' && key !== 'description');
  if (extra !== undefined) throw new ChannelInputError(`an option takes no key "${extra}": it takes label and description`);
  const label = oneLine(option.label, OPTION_LABEL_MAX, 'the label of an option');
  const description = option.description === undefined ? '' : option.description;
  if (typeof description !== 'string') throw new ChannelInputError('the description of an option is a text');
  return { label, description: description.trim() === '' ? '' : oneLine(description, OPTION_DESCRIPTION_MAX, 'the description of an option') };
}

const QUESTION_KEYS = ['text', 'options', 'waits'];

/** The fields of a question from the JSON text standard input gave: `{ text, options, waits }`, each checked as
 * `checkedQuestion` checks it. The text may start with a byte order mark, as a Windows pipe may give one. A
 * question takes no key but these three, so one that is misspelt is named. Throws a `ChannelInputError` in words
 * that name what is wrong: text that is not JSON, JSON that is not an object, a key it does not take, or a field. */
export function questionFieldsOf(json) {
  let fields;
  try {
    fields = JSON.parse(typeof json === 'string' ? json.replace(/^\uFEFF/, '') : '');
  } catch {
    throw new ChannelInputError('the question is read from standard input as JSON, and what came is not JSON');
  }
  if (!isObject(fields)) throw new ChannelInputError('the question is a JSON object with text, options and waits, and what came is not an object');
  const extra = Object.keys(fields).find((key) => !QUESTION_KEYS.includes(key));
  if (extra !== undefined) throw new ChannelInputError(`a question takes no key "${extra}": it takes text, options and waits`);
  return checkedQuestion(fields);
}

/** The copy of his answer that a `question` keeps, from what `quoteOf` gives as `answered`, `{ tool, answers:
 * [{ question, options, answer, how }] }`: the question and the answer of each, cut to `ANSWER_COPY_TEXT_MAX`
 * characters, each option's label cut to `OPTION_LABEL_MAX` (at most twelve an answer), and how he gave it.
 * A label alone reads as nothing a week later, and a transcript does not live for ever, so the words are kept
 * here. Keys it does not know (`askedAt`) are dropped. Throws a `ChannelInputError` for another shape. */
export function answerCopyOf(answered) {
  if (!isObject(answered) || (answered.tool !== null && typeof answered.tool !== 'string')) throw new ChannelInputError('the copy of an answer takes the tool that asked, a name or null, and its answers');
  if (!Array.isArray(answered.answers) || answered.answers.length === 0) throw new ChannelInputError('the copy of an answer has no answers');
  return { tool: answered.tool, answers: answered.answers.map(answerCopyEntry) };
}

/** One answer of `answerCopyOf`'s copy. Throws a `ChannelInputError` for one that has no question, no answer or
 * a list of options that is not a list of labels. */
function answerCopyEntry(entry) {
  if (!isObject(entry)) throw new ChannelInputError('an answer of a copy is an object, with its question, options, answer and how');
  if (typeof entry.question !== 'string' || entry.question.trim() === '') throw new ChannelInputError('the question of an answer is empty or not a text');
  if (typeof entry.answer !== 'string' || entry.answer.trim() === '') throw new ChannelInputError('the answer to a question is empty or not a text');
  if (!Array.isArray(entry.options) || !entry.options.every((label) => typeof label === 'string')) throw new ChannelInputError('the options of an answer are a list of labels');
  return {
    question: cutTo(entry.question, ANSWER_COPY_TEXT_MAX),
    options: entry.options.slice(0, ANSWER_COPY_OPTIONS_MAX).map((label) => cutTo(label, OPTION_LABEL_MAX)),
    answer: cutTo(entry.answer, ANSWER_COPY_TEXT_MAX),
    how: entry.how,
  };
}

/** `text` as it is kept: whole when it has `max` characters or fewer, else cut to `max` with `…` at its end. */
function cutTo(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
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
 * few kilobytes at most (`NOTICE_TEXT_MAX`, `RELIEF_LINE_MAX`, and a question's limits), far under what one
 * write takes. The test of this file has several processes do it together. A tail with no line break is what a crash or a
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

/** Whether `value` is a notice of this schema: enough of one for a board to print it. A question needs its id,
 * its options and its waits; a withdrawal and an answer that names a question need that question's number. */
function isNotice(value) {
  return (
    isObject(value) &&
    value.schema === NOTICE_SCHEMA &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at)) &&
    NOTICE_KINDS.includes(value.kind) &&
    typeof value.text === 'string' &&
    isObject(value.to) &&
    (value.to.role === 'orchestrator' || (value.to.role === 'work' && Number.isSafeInteger(value.to.number))) &&
    (value.kind !== 'question' || (typeof value.id === 'string' && value.id !== '' && Array.isArray(value.options) && typeof value.waits === 'string')) &&
    (value.kind !== 'withdrawn' || isQuestionNumber(value.question)) &&
    (value.kind !== 'ready' || isPullRequestNumber(value.pr)) &&
    (value.kind !== 'answer' || value.question === undefined || isQuestionNumber(value.question))
  );
}

/** The record of the project `slug` under `home`: `{ path, notices, readings, questions, skipped }`, the notices
 * and the readings (`newReading`), each in the order written, and `questions`: the valid `question` notices, each
 * as `{ number, notice }`. A question's number is its ordinal among the lines of the record that are question
 * notices, valid or not, so a broken one still takes a number and the next valid question has the following one:
 * the number is computed here, never stored, so that the record needs no lock. A project with no record yet has
 * none. A line that is torn (a session appends while this reads), that is not JSON or that is neither a notice nor
 * a reading of these schemas is counted in `skipped` and left out, never fatal. A record that is there and cannot
 * be read is `unavailable` with the reason, so that "could not look" is never read as "no notices". */
export function readNotices(home, slug, { readFile = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const file = recordPath(home, slug);
  let text;
  try {
    text = readFile(file);
  } catch (err) {
    const none = { path: file, notices: [], readings: [], questions: [], skipped: 0 };
    return err.code === 'ENOENT' ? none : { path: file, unavailable: err.code ?? err.message, notices: [], readings: [], questions: [], skipped: 0 };
  }
  const notices = [];
  const readings = [];
  const questions = [];
  let questionLines = 0;
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = null;
    }
    if (isObject(parsed) && parsed.schema === NOTICE_SCHEMA && parsed.kind === 'question') questionLines += 1;
    if (isNotice(parsed)) {
      notices.push(parsed);
      if (parsed.kind === 'question') questions.push({ number: questionLines, notice: parsed });
    } else if (isReading(parsed)) readings.push(parsed);
    else skipped += 1;
  }
  return { path: file, notices, readings, questions, skipped };
}

/** The questions of a record (`readNotices`), in the order written: `[{ number, notice, closed }]`. `closed` is
 * `null` while nothing has closed the question; otherwise `{ by, notice }`, the notice of the record that
 * closes it: an `answer` naming its number (`by: 'answer'`) or a `withdrawn` (`by: 'withdrawn'`). An answer that
 * names no question closes none.
 *
 * The first notice that settles the question is the one given: a withdrawal, or an answer read at its line. An
 * answer that no transcript confirmed (`verified: false`) is the sender's claim, so it closes the question only
 * until his answer is read: one recorded later with its line replaces it here, and `notify` lets that one in. */
export function recordedQuestions(record) {
  return record.questions.map(({ number, notice }) => {
    const closing = record.notices.filter((one) => (one.kind === 'answer' || one.kind === 'withdrawn') && one.question === number);
    const settled = closing.find((one) => one.kind === 'withdrawn' || one.verified !== false) ?? closing[0];
    return { number, notice, closed: settled === undefined ? null : { by: settled.kind, notice: settled } };
  });
}

// ---- the relief file ----------------------------------------------------------------------------------

const two = (number) => String(number).padStart(2, '0');

/** How a line of the relief file starts when the command writes it: the local date and time of `ms`, as
 * the lines an orchestrator wrote by hand start (`2026-10-11 06:15 local (date).`), and the command that wrote it,
 * `(notify)` unless another says so (`(rules change)`), where
 * those name the source of their hour, so a stamped line is told from one whose hour was typed. The seconds are
 * written too (since 2026-10-15): the measure of a compaction compares a line with the notice, which has them. */
export function reliefStamp(ms, by = 'notify') {
  const at = new Date(ms);
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())} local (${by}).`;
}

/** Appends `line` to the relief file of the project `slug` under `home`, stamped with the clock's time
 * `ms`, creating the file and its folder: `{ path, line }`, the line as written. Throws a
 * `ChannelInputError`, and writes nothing, for a line that is empty, more than one, or too long. */
export function appendRelief(home, slug, line, ms, by = 'notify') {
  const written = `${reliefStamp(ms, by)} ${reliefLineOf(line)}`;
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

/** What the title `title` has of letters and digits, in lower case and without accents, joined by dashes and
 * cut at 60 characters: the readable part of an opening's file name and of a session's summary file, so one
 * title gives one name in both. Empty for a title with no letter or digit. */
export function titleSlug(title) {
  return titleOf(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

/** The name of the file that holds the opening of the session titled `title`: what the title has of
 * letters and digits, in lower case and without accents, so a person who lists the folder can tell the
 * files apart, then the start of the title's hash, which is what makes the name the title's own. Nothing
 * of the title reaches the name as it is: a title holds spaces, a middle dot and accents, and may hold
 * what Windows refuses in a name (`\ / : * ? " < > |`, a dot at the end, `CON`, `NUL`). Two titles that
 * differ by case or by an accent get two names on a disk that ignores case. */
export function openingFileName(title) {
  const wanted = titleOf(title);
  const readable = titleSlug(title);
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

// A title the command that prints its opening can be written for: letters, digits, blanks and the marks
// below, after a first letter or digit. The session that reads the line may run it in PowerShell or in a
// POSIX shell, through the batch file or the script a package manager puts before the command, and only
// such a title reaches the command the same by every one of them. Single quotes are what the two shells
// share: inside them neither expands a `$`. A single quote has no spelling both take; Windows PowerShell
// drops a double quote on the way to a program; a batch file expands `%NAME%` and cuts at `&`; and a title
// that begins with `--` needs a lone `--` before it, which PowerShell takes away from a script. A list of
// what is safe, not of what is not, so a mark nobody thought of gets the words and not a wrong command.
export const PLAIN_TITLE = /^[\p{L}\p{N}][\p{L}\p{N} ·.,:()#+$/_-]*$/u;

/** The command that prints the opening of `title`, its title between single quotes, or `null` for a title
 * shells read each its own way (`PLAIN_TITLE`): a command that asks for another title is worse than none. */
export function openingCommand(title) {
  const asked = title.trim();
  return PLAIN_TITLE.test(asked) ? `js-harness sessions --opening '${asked}'` : null;
}

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

/** Who sends: `{ host, id, source, title, permissionMode, context }`.
 *
 * The id is the one Claude Code gives every command a session runs (`CLAUDE_CODE_SESSION_ID`, `source:
 * 'environment'`), or the one `self` names in its place, as on the board (`--self`, `source: 'flag'`, a
 * whole id or its first eight characters or more). The title, the permission mode and the share of the
 * context (`context`: `{ tokens, percent }`, the tokens of its last reply with usage and their whole
 * percentage of the window, as the board says it) are read from that session's transcript in `projectDir`,
 * with the board's reader: a title only when the session was given one, `null` for whatever cannot be
 * read, and `context` is `null` when the transcript gives no context. An id from the flag that no transcript
 * carries is only what the caller typed, so no host is named for it.
 *
 * With neither, the sender is not known and the notice is recorded all the same: `{ host: 'unknown', id:
 * null, ... }`. That is every Codex session today: nothing in this repository reads a session id from
 * Codex, and none of the variables its commands carry is known to hold one. */
export function senderOf({ self = null, env = {}, projectDir, readdir, readFile, readFacts = sessionFacts }) {
  const fromFlag = typeof self === 'string' && self !== '';
  const given = fromFlag ? self : env.CLAUDE_CODE_SESSION_ID || null;
  if (given === null) return { host: 'unknown', id: null, source: null, title: null, permissionMode: null, context: null };
  const sender = { host: fromFlag ? 'unknown' : 'claude-code', id: given, source: fromFlag ? 'flag' : 'environment', title: null, permissionMode: null, context: null };
  try {
    const ids = readdir(projectDir).filter((name) => name.endsWith('.jsonl')).map((name) => name.slice(0, -'.jsonl'.length)).filter((id) => isSelf(id, given));
    if (ids.length !== 1) return sender;
    [sender.id] = ids;
    sender.host = 'claude-code';
    const facts = readFacts(readFile(path.join(projectDir, `${sender.id}.jsonl`)), { tail: 0 });
    sender.title = facts.titleSource === 'custom-title' && typeof facts.title === 'string' ? facts.title : null;
    sender.permissionMode = facts.permissionMode ?? null;
    const measured = Number.isFinite(facts.context?.tokens) && Number.isFinite(facts.contextPercent);
    sender.context = measured ? { tokens: facts.context.tokens, percent: facts.contextPercent } : null;
  } catch {
    // A sessions folder that is not there, a transcript that cannot be read: the sender keeps what is known.
  }
  return sender;
}
