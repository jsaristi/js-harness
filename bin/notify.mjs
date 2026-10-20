#!/usr/bin/env node
// `notify`: the one writer of the session channel — see odd/tasks/session-channel.md (points 2, 3, 6 and
// 7). It appends a notice to the project's record, a line to the orchestrator's relief file, or stores
// the opening of a session, each stamped with the clock it reads itself: nothing here asks an agent to
// remember an hour, a session id, a worktree or a branch that a program can read. The files and their
// rules are bin/lib/channel.mjs; this file reads the arguments, the clock, git and the sender's
// transcript, and writes under the harness home. Zero dependencies.
//
// It never sends a message. After a notice it prints the address of the role, which is the answer of
// `sessions --address` and is asked of that command itself, so the sender can ring it; the notice is
// recorded whether or not there is an address, and a recorded notice is exit 0. A notice is a claim of
// the session that wrote it, never the user's word.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { spawnSync } from 'node:child_process';
import { sessionsMain } from './sessions.mjs';
import { stampOff } from './lib/guard.mjs';
import { pullRequestProblems } from './lib/pull-request.mjs';
import { closeProblems } from './lib/summary.mjs';
import { ChannelInputError, NOTICE_KINDS, NOTICE_TEXT_MAX, OPENING_TEXT_MAX, OPENING_TITLE_MAX, RELIEF_LINE_MAX, appendNotice, appendRelief, newNotice, openingCommand, openingTextOf, openingTitleOf, placeOf, questionFieldsOf, readNotices, recordPath, recordedQuestions, reliefLineOf, reliefPath, senderOf, writeOpening } from './lib/channel.mjs';
import { askingRule, mainCheckout, projectSlug, questionPrefix, quoteOf, roleOfTitle, sessionFacts, titleRead, transcriptNamed } from './lib/sessions.mjs';

export const USAGE = [
  'Usage: js-harness notify --to orchestrator|<number> --kind <kind> [--transcript <file or session id> --line <n>] [--question <n>] [--pr <n>] [--summary <file>] "<one line>"',
  '       js-harness notify --to orchestrator --kind question   (the fields of the question as JSON on standard input)',
  '       js-harness notify --relief "<one line>"',
  '       js-harness notify --opening "<title>"   (the opening\'s text on standard input)',
  '                         [--self <session id>] [--cwd <path>] [--home <path>] [--claude-home <path>]',
  '  --to and --kind append one notice to the project\'s record, <home>/.js-harness/channel/<project>.jsonl,',
  '    with the time of the clock, the sender\'s session and the worktree and branch it ran in, then print',
  '    the address of the role as `sessions --address` gives it. The exit is 0 once the notice is recorded,',
  '    with an address or without one. The exit is 1 when a check refuses the notice and it is not recorded (a text that',
  '    stamps the wrong hour, a ready pull request the land would leave out, a summary not ready, a record that cannot',
  '    be written), and 2 for a usage error.',
  `    Kinds: ${NOTICE_KINDS.join(', ')}. An answer carries the user's words and says where they`,
  '    are read, with --transcript and --line; no other kind takes them. The text is one line of',
  `    ${NOTICE_TEXT_MAX} characters at most.`,
  '  A ready notice says a pull request is ready to land, and names it with --pr <n>, so the land knows whose it',
  '    is from the record and not from a branch; no other kind takes --pr. It is refused, with the land\'s reasons,',
  '    while the land would leave that pull request out: its state, its body\'s gentle-ai line, its reviews.',
  '  A closed notice gives the work back and names the summary the session leaves with --summary <file>, a file of',
  '    docs/sessions/ (js-harness summary template prints it); no other kind takes --summary. It is refused while a',
  '    section of that file is empty or missing, or while neither origin\'s default branch, origin/main nor the session\'s',
  '    branch on origin holds it as it is: commit it and push it first.',
  '  A question takes no text on the command line. Its fields are one JSON object on standard input, with the',
  '    keys text, options and waits, for example:',
  '    {"text":"Which branch?","options":[{"label":"main","description":"the default branch"}],"waits":"T3"}',
  '    The record numbers it, and the number is printed: the user is asked with its text headed by',
  '    "Pregunta <n>: ". An answer or a withdrawal names its question with --question <n>. A verified answer',
  '    is one read at its line of the transcript, and its copy is kept with it, with the time of his line and,',
  '    for a question-tool answer, the time the question was shown; with no transcript to read,',
  '    the answer is recorded unverified, and that is said.',
  `  --relief appends one line, of ${RELIEF_LINE_MAX} characters at most, to the orchestrator's relief file, with the`,
  '    local date and time of the clock.',
  `  --opening stores the opening of the session with that title (one line, ${OPENING_TITLE_MAX} characters at most):`,
  `    its text is read from standard input as UTF-8, ${OPENING_TEXT_MAX} characters at most, and the same title`,
  '    again replaces it. It then prints the session\'s first message as a block to copy.',
  '  A text, a line or a title that begins with -- goes after a lone --: -- "--a text", --relief -- "--a line", --opening -- "--a title".',
  '    Without it, it is read as an option this command does not know, and refused.',
  '  A notice is a claim of the session that wrote it, never the user\'s word. It sends no message.',
  '  Exit 2: a usage error, and nothing is written. Exit 1: the file could not be written, or the text stamps an hour off the clock.',
].join('\n');

/** A mistake in the arguments: answered with the usage and exit 2, like a `ChannelInputError`. */
class NotifyArgError extends Error {}

// What is said to whoever wrote a text that begins with `--` where an option is read.
const AFTER_DASHES = 'a text that begins with -- goes after a lone --';

function requireValue(argv, i, flag) {
  const value = argv[i + 1];
  if (value === undefined) throw new NotifyArgError(`${flag} requires a value`);
  if (value.startsWith('--')) throw new NotifyArgError(`${flag} requires a value (${AFTER_DASHES})`);
  return value;
}

/** Walks argv token by token, like `sessions`: a flag it does not know is a usage error, never a token
 * that is silently ignored, and so is a second text. A lone `--` ends the options, so that a text, a
 * relief line or a title may begin with `--`. What comes out is one of three things to write:
 * `{ notice }` (a draft of it: `to`, `kind`, `text`, and `transcript` and `line` when given), `{ relief }`
 * or `{ opening }`, with the places and the sender the flags name. There is no flag for the time. */
function parseArgs(argv) {
  const parsed = {};
  // A Map, not an object: `constructor` and `__proto__` are keys of every object literal.
  const values = new Map([['--to', 'to'], ['--kind', 'kind'], ['--transcript', 'transcript'], ['--line', 'line'], ['--question', 'question'], ['--pr', 'pr'], ['--summary', 'summary'], ['--relief', 'relief'], ['--opening', 'opening'], ['--self', 'self'], ['--cwd', 'cwd'], ['--home', 'home'], ['--claude-home', 'claudeHome']]);
  const texts = [];
  // `--relief` or `--opening` when a lone `--` follows it: its value is the text after that `--`.
  let fromText;
  // What follows the lone `--`, apart from the texts before it: only this is the value of `fromText`.
  let afterDashes = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    // A lone `--` ends the options: what follows is text as it is, so a text may begin with `--`.
    if (token === '--') {
      afterDashes = argv.slice(i + 1);
      texts.push(...afterDashes);
      break;
    }
    if (!token.startsWith('--')) {
      texts.push(token);
      continue;
    }
    if (!values.has(token)) throw new NotifyArgError(`unknown argument: ${token} (${AFTER_DASHES})`);
    if ((token === '--relief' || token === '--opening') && argv[i + 1] === '--') {
      fromText = token;
      continue;
    }
    parsed[values.get(token)] = requireValue(argv, i, token);
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  if (fromText !== undefined) {
    // A text given before the flag is not its value: a first version took it for one when nothing
    // followed the `--`, and wrote it as the line or the title (found in review, 2026-10-11).
    if (afterDashes.length === 0) throw new NotifyArgError(`${fromText} requires a value`);
    if (texts.length === 1) parsed[values.get(fromText)] = texts.pop();
  }
  for (const flag of ['self', 'cwd', 'home', 'claudeHome']) {
    if (parsed[flag] === '') throw new NotifyArgError(`--${flag === 'claudeHome' ? 'claude-home' : flag} requires a value`);
  }
  if (parsed.self !== undefined && parsed.self.length < 8) throw new NotifyArgError('--self takes a session id, or its first eight characters or more');
  if (texts.length > 1) throw new NotifyArgError('the text is one argument: put it between quotes');

  const places = { self: parsed.self, cwd: parsed.cwd, home: parsed.home, claudeHome: parsed.claudeHome };
  const ofANotice = ['to', 'kind', 'transcript', 'line', 'question', 'pr', 'summary'].filter((key) => parsed[key] !== undefined).map((key) => `--${key}`);
  for (const [flag, other] of [['relief', 'opening'], ['opening', 'relief']]) {
    if (parsed[flag] === undefined) continue;
    const extra = [...ofANotice, ...(parsed[other] !== undefined ? [`--${other}`] : []), ...(texts.length > 0 ? ['a text'] : [])];
    if (extra.length > 0) throw new NotifyArgError(`--${flag} writes one thing: it does not go with ${extra.join(', ')}`);
    return { ...places, [flag]: parsed[flag] };
  }
  if (parsed.to === undefined || parsed.kind === undefined) throw new NotifyArgError('a notice takes --to and --kind');
  // A question's text is its fields on standard input, which `notifyMain` reads: no text may come with it.
  if (parsed.kind === 'question' && texts.length > 0) throw new NotifyArgError('a question takes its fields from standard input, not from the command line');
  if (parsed.kind !== 'question' && texts.length === 0) throw new NotifyArgError('a notice takes its text: one line, between quotes');
  let line;
  if (parsed.line !== undefined) {
    if (!/^\d+$/.test(parsed.line)) throw new NotifyArgError('--line takes the number of a line of the transcript, from 1');
    line = Number(parsed.line);
  }
  let question;
  if (parsed.question !== undefined) {
    if (!/^\d+$/.test(parsed.question) || Number(parsed.question) < 1) throw new NotifyArgError('--question takes the number of a question, from 1');
    question = Number(parsed.question);
  }
  let pr;
  if (parsed.pr !== undefined) {
    if (!/^\d+$/.test(parsed.pr) || Number(parsed.pr) < 1) throw new NotifyArgError('--pr takes the number of a pull request, from 1');
    pr = Number(parsed.pr);
  }
  // A session that finishes hands the lead its summary (odd/tasks/session-close.md, S2): the command asks for it,
  // while the record, and a notice another command builds, may hold a closed notice without one.
  if (parsed.kind === 'closed' && parsed.summary === undefined) throw new NotifyArgError('a closed notice names the summary the session leaves: --summary <file> (js-harness summary template prints it)');
  return { ...places, notice: { to: parsed.to, kind: parsed.kind, text: texts[0], transcript: parsed.transcript, line, question, pr, summary: parsed.summary } };
}

/** The copy an answer to question `number` keeps, read from the transcript's `text` at `line`: `{ copy }`, or
 * `{ refused }` in words when that line is not his answer to it. A typed answer counts when it was sent after the
 * question was recorded (`asked`, its notice). A question-tool answer counts when its call was asked after that
 * and holds a question that starts with the question's prefix: one call may ask several questions. With the copy come
 * its `times` (throughput B4): `answeredAt`, the time of his line, and for a question-tool answer `shownAt`, its call's. */
function copyOfAnswer(text, { line, file, number, asked }) {
  const quote = quoteOf(text, line);
  if (!quote.person) return { refused: `line ${line} of ${file} is ${quote.what}: not the user's answer` };
  const recordedAt = Date.parse(asked.at);
  if (quote.answered === undefined) {
    if (quote.pastedOnly) return { refused: `line ${line} of ${file} holds only pasted text: not the user's words typed in the chat` };
    if (quote.at === null) return { refused: `line ${line} of ${file} has no time, so it cannot be told to come after question ${number}` };
    if (!(Date.parse(quote.at) > recordedAt)) return { refused: `line ${line} of ${file} was sent before question ${number} was recorded` };
    return { copy: { tool: null, answers: [{ question: asked.text, options: [], answer: quote.text, how: 'typed in the chat' }] }, times: { answeredAt: quote.at } };
  }
  const { answered } = quote;
  if (answered.askedAt === null) return { refused: `the call that line ${line} answers has no time, so it cannot be told to answer question ${number}` };
  if (!(Date.parse(answered.askedAt) > recordedAt)) return { refused: `the call that line ${line} answers was asked at ${answered.askedAt}, before question ${number} was recorded at ${asked.at}: it answers another question` };
  const prefix = questionPrefix(number);
  const answers = answered.answers.filter((one) => typeof one.question === 'string' && one.question.startsWith(prefix));
  if (answers.length === 0) return { refused: `no question of that call starts with ${JSON.stringify(prefix)}: it answers another question` };
  return { copy: { tool: answered.tool, answers }, times: { shownAt: answered.askedAt, ...(quote.at === null ? {} : { answeredAt: quote.at }) } };
}

/** The text of an opening, from what standard input gave: bytes read as UTF-8, or a string as it is. Bytes
 * that are not UTF-8 are refused, since a letter read wrong would be stored wrong: a Windows shell that
 * pipes in its own code page sends them. */
function decoded(input) {
  if (typeof input === 'string') return input;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new ChannelInputError('the text on standard input is not UTF-8');
  }
}

const roleWords = (role) => (role.role === 'orchestrator' ? 'the orchestrator' : `work session ${role.number}`);
const senderWords = (sender) => (sender.title !== null ? JSON.stringify(sender.title) : sender.id !== null ? `session ${sender.id.slice(0, 8)}` : 'a sender the host does not name');
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// How much of a relief line the command prints back: the stamp and the start of it. The file has it whole.
const SHOWN = 300;

/** What would leave pull request `pr` out of a land before it builds, by the land's own functions and words: its
 * `pullRequestProblems` (UNKNOWN mergeable read as the land reads it, GitHub not having computed it yet), then its
 * `reviewEvidence` of the head against origin/main, fetched first. `[]` when the land would build it. */
export async function readyProblems(pr, cwd, { run, evidence = null }) {
  const answered = (command, args) => {
    const done = run(command, args, { cwd });
    return done.status === 0 ? { ok: true, out: done.stdout } : { ok: false, why: String(done.stderr || done.error?.message || `exit ${done.status}`).trim() };
  };
  const view = answered('gh', ['pr', 'view', String(pr), '--json', 'number,state,isDraft,mergeable,baseRefName,body,headRefOid']);
  let found = null;
  try {
    found = view.ok ? JSON.parse(view.out) : null;
  } catch {
    found = null;
  }
  if (found === null) return [`could not read pull request ${pr} with gh (${view.ok ? 'its answer is no JSON' : view.why}).`];
  const problems = pullRequestProblems(found.mergeable === 'UNKNOWN' ? { ...found, mergeable: 'MERGEABLE' } : found);
  if (problems.length) return problems;
  const fetched = answered('git', ['fetch', '-q', 'origin']);
  if (!fetched.ok) return [`could not fetch origin (${fetched.why}).`];
  const main = answered('git', ['rev-parse', 'origin/main']);
  if (!main.ok) return [`could not read origin/main (${main.why}).`];
  // The land's module is loaded only for a ready notice: every other notice stays as light as it was.
  const covers = evidence ?? (await import('./merge-queue.mjs')).reviewEvidence;
  const coverage = covers(cwd, main.out.trim(), found.headRefOid);
  return coverage?.pass ? [] : [`PR ${pr}: ${String(coverage?.detail ?? 'its review records could not be read').replace(/\.$/, '')}.`];
}

export async function notifyMain(
  argv,
  {
    cwd: defaultCwd = process.cwd(),
    stdout = console.log,
    stderr = console.error,
    env = process.env,
    // The clock every stamp comes from. It is a seam for the tests and nothing else: no flag sets it.
    now = Date.now,
    homedir = os.homedir,
    // `git`, with a time limit, so a stuck command is a notice with no branch and not a notice never written.
    run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }),
    readFile = (absolute) => fs.readFileSync(absolute, 'utf8'),
    readdir = (absolute) => fs.readdirSync(absolute),
    readStdin = () => fs.readFileSync(0),
    stdinIsTTY = tty.isatty(0),
    // `sessions`, asked for the address of a role exactly as a session would ask it.
    sessions = sessionsMain,
    // The id of a question: the record is searched for it after the append, which has no lock to say where
    // the line went. A random one, unless a test fixes it.
    newId = () => crypto.randomUUID(),
    // What would leave the pull request of a ready notice out of a land, `[]` when nothing would.
    landChecks = readyProblems,
    // What keeps the summary of a closed notice from closing the session, `[]` when nothing does.
    closeChecks = closeProblems,
  } = {},
) {
  let parsed;
  let draft;
  // What an answer's copy could not be read as: why the answer is recorded unverified, or `null` when it is verified.
  let unverified = null;
  try {
    parsed = parseArgs(argv);
    // Everything the caller gave is checked before anything is run or written. An answer to a question is
    // checked again once its transcript is read, below.
    if (parsed.notice?.kind === 'question') {
      if (stdinIsTTY) throw new NotifyArgError('--kind question reads the question\'s fields from standard input, and standard input is a terminal: pipe them in');
      let input;
      try {
        input = readStdin();
      } catch (err) {
        // Windows answers the read of a standard input that is closed or empty with EOF as an error.
        if (err.code !== 'EOF') {
          stderr(`js-harness notify: could not read the question from standard input (${err.code ?? err.message})`);
          return 1;
        }
        input = '';
      }
      draft = newNotice({ at: null, from: null, ...parsed.notice, ...questionFieldsOf(decoded(input)), id: newId() });
    } else if (parsed.notice) {
      const verifiedLater = parsed.notice.kind === 'answer' && parsed.notice.question !== undefined;
      draft = newNotice({ at: null, from: null, ...parsed.notice, ...(verifiedLater ? { verified: false, copy: null } : {}) });
    } else if (parsed.relief !== undefined) draft = reliefLineOf(parsed.relief);
    else {
      const title = openingTitleOf(parsed.opening);
      if (stdinIsTTY) throw new NotifyArgError('--opening reads the opening\'s text from standard input, and standard input is a terminal: pipe the text in');
      let input;
      try {
        input = readStdin();
      } catch (err) {
        // Windows answers the read of a standard input that is closed or empty with EOF as an error.
        if (err.code !== 'EOF') {
          stderr(`js-harness notify: could not read the opening from standard input (${err.code ?? err.message})`);
          return 1;
        }
        input = '';
      }
      draft = { title, text: openingTextOf(decoded(input)) };
    }
  } catch (err) {
    if (!(err instanceof NotifyArgError) && !(err instanceof ChannelInputError)) throw err;
    stderr(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  // The project is the main checkout, from any worktree, as for the board: its record and its relief file
  // are one per project. The harness home is JS_HARNESS_HOME or the user's home, as for `install` and the
  // board, and an empty JS_HARNESS_HOME is no home.
  const cwd = path.resolve(defaultCwd, parsed.cwd ?? '.');
  const slug = projectSlug(mainCheckout(run, cwd));
  const home = path.resolve(defaultCwd, parsed.home ?? (env.JS_HARNESS_HOME || homedir()));
  const at = new Date(now()).toISOString();

  // An hour the text stamps as its sending is held to the clock the notice is stamped with, as the guard holds a
  // message's (odd/tasks/wake-and-flag.md, T4): 73 of 74 lead notices that opened "HH:MM JH ORQ" were off. An answer
  // quotes his words, which are not the sender's stamp.
  if (parsed.relief === undefined && parsed.opening === undefined && draft.kind !== 'answer') {
    const off = stampOff(draft.text, new Date(at));
    if (off !== null) {
      stderr(`js-harness notify: the text stamps ${off.stamped}, and the clock says ${off.right}. Stamp ${off.right}, or no hour: the record already stamps every notice with its time. Not recorded.`);
      return 1;
    }
  }

  // A ready notice is held to the checks the land runs before it builds: 360, 365 and 367 were announced ready and
  // left out of a land for want of gentle-ai evidence, a relay and some 13 minutes each (odd/tasks/ready-checks.md, S1).
  if (draft.kind === 'ready') {
    const problems = await landChecks(draft.pr, cwd, { run });
    if (problems.length) {
      stderr(`js-harness notify: pull request ${draft.pr} is not ready to land: ${problems.join(' ')} Not recorded.`);
      return 1;
    }
  }

  // A closed notice is held to its summary: written, filled and pushed, so the lead can read it from git before it
  // archives the session (odd/tasks/session-close.md, S2).
  if (draft.kind === 'closed') {
    const problems = await closeChecks(draft.summary, cwd, { run });
    if (problems.length) {
      stderr(`js-harness notify: the summary is not ready: ${problems.join(' ')} Not recorded.`);
      return 1;
    }
  }

  if (parsed.relief !== undefined) {
    let written;
    try {
      written = appendRelief(home, slug, draft, now());
    } catch (err) {
      stderr(`js-harness notify: could not write ${reliefPath(home, slug)} (${err.code ?? err.message})`);
      return 1;
    }
    const shown = written.line.length > SHOWN ? `${written.line.slice(0, SHOWN)}… (${plural(draft.length, 'character')})` : written.line;
    stdout(`js-harness notify: appended to the relief file ${written.path}: ${shown}`);
    return 0;
  }

  // Who sends, from the transcript the host's id names: read where the board reads the sessions.
  const claudeHome = path.resolve(defaultCwd, parsed.claudeHome ?? env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'));
  const projectDir = path.join(claudeHome, 'projects', slug);
  const from = senderOf({ self: parsed.self ?? null, env, projectDir, readdir, readFile });
  // A session opened from the phone has no title in its transcript: its title is the one of the opening
  // it read, which `sessions --opening` wrote in the record. A title in the transcript wins.
  // A record that cannot be read gives no title and stops nothing: the notice is written without one,
  // and that is said, so a notice with no title is never taken for a session that read no opening.
  let titleNotRead = null;
  if (from.id !== null && from.title === null) {
    const record = readNotices(home, slug, { readFile });
    from.title = titleRead(record.readings, from.id);
    if (record.unavailable !== undefined) titleNotRead = `the channel's record ${record.path} could not be read (${record.unavailable})`;
  }
  const senderNotKnown = () => {
    if (from.id === null) stderr('js-harness notify: the sender is not known: the host gave no session id (CLAUDE_CODE_SESSION_ID is not set) and --self names none');
    if (titleNotRead !== null) stderr(`js-harness notify: the title of the sender is not known: its transcript carries none, and ${titleNotRead} to look for the opening it read`);
  };

  if (parsed.opening !== undefined) {
    let stored;
    try {
      stored = writeOpening(home, slug, { ...draft, at, from });
    } catch (err) {
      stderr(`js-harness notify: could not write the opening for ${JSON.stringify(draft.title)} under ${home} (${err.code ?? err.message})`);
      return 1;
    }
    const lines = draft.text.replace(/\n$/, '').split('\n').length;
    stdout(`js-harness notify: opening for ${JSON.stringify(draft.title)} ${stored.replaced ? 'replaced' : 'written'} in ${stored.path} (${plural(lines, 'line')}, ${plural(draft.text.length, 'character')})`);
    // The first message of the session, as a block to copy: the user pastes it as it is into the new session.
    const quoted = JSON.stringify(draft.title);
    stdout(`The first message of the session ${quoted}, to send in it as it is:`);
    stdout('```');
    // The command only for a title every shell reads alike; for another, the request in words (`openingCommand`).
    const command = openingCommand(draft.title);
    stdout(command !== null
      ? `You are the session ${quoted}. Read your opening with ${command} and follow it.`
      : `You are the session ${quoted}. Read your opening with js-harness sessions --opening, giving it your title as one argument, after a lone -- when it begins with --, and follow it.`);
    stdout('```');
    senderNotKnown();
    if (roleOfTitle(draft.title) === null) {
      stderr(`js-harness notify: ${JSON.stringify(draft.title)} is not of the shape <code> <role> · <what it does>: the opening is found by its whole title, not by a code and a role`);
    }
    return 0;
  }

  // An answer or a withdrawal to a question: the record must hold that question and leave it open, and an
  // answer's words are read from its transcript before anything is written. Nothing here writes.
  if (parsed.notice?.question !== undefined) {
    const notRecorded = (why) => {
      stderr(`js-harness notify: not recorded: ${why}`);
      return 1;
    };
    const number = parsed.notice.question;
    const record = readNotices(home, slug, { readFile });
    if (record.unavailable !== undefined) return notRecorded(`the channel's record ${record.path} could not be read (${record.unavailable})`);
    const questions = recordedQuestions(record);
    const theQuestion = questions.find((one) => one.number === number);
    if (theQuestion === undefined) return notRecorded(`the record holds no question ${number} (it holds ${plural(questions.length, 'question')})`);
    // An answer no transcript confirmed is the sender's claim: it shuts out a withdrawal and another claim, and
    // lets in his answer read at its line, which `recordedQuestions` then gives as what closed the question.
    const claimed = theQuestion.closed !== null && theQuestion.closed.by === 'answer' && theQuestion.closed.notice.verified === false;
    const closedSaid = () => {
      const { by, notice: closing } = theQuestion.closed;
      if (by === 'withdrawn') return `question ${number} is closed: withdrawn: ${closing.text}`;
      return `question ${number} is closed: answered at ${closing.transcript}:${closing.line}${claimed ? ', unverified: only an answer read at its line replaces it' : ''}`;
    };
    if (theQuestion.closed !== null && !(claimed && parsed.notice.kind === 'answer')) return notRecorded(closedSaid());
    if (parsed.notice.kind === 'answer') {
      const found = transcriptNamed(projectDir, parsed.notice.transcript, { cwd, readdir });
      let copy = null;
      let times = {};
      if (found.not === 'outside') return notRecorded(`${parsed.notice.transcript} is not a transcript of this project: a file outside its sessions folder is none`);
      if (found.not === 'several') return notRecorded(`${plural(found.count, 'transcript')} start with ${parsed.notice.transcript}: give more of the session id`);
      if (found.not === 'short') return notRecorded(`${parsed.notice.transcript} is too short to name a session: a session id takes its first eight characters or more`);
      if (found.not === 'none') unverified = `no transcript starts with ${parsed.notice.transcript}`;
      else if (found.not === 'unlisted') unverified = `the sessions folder ${projectDir} could not be read (${found.code})`;
      else {
        let text;
        try {
          text = readFile(found.file);
        } catch (failed) {
          unverified = `the transcript ${found.file} could not be read (${failed.code ?? failed.message})`;
        }
        if (text !== undefined) {
          const read = copyOfAnswer(text, { line: parsed.notice.line, file: found.file, number, asked: theQuestion.notice });
          if (read.refused !== undefined) return notRecorded(read.refused);
          copy = read.copy;
          times = read.times;
        }
      }
      if (claimed && copy === null) return notRecorded(closedSaid());
      try {
        draft = newNotice({ at: null, from: null, ...parsed.notice, verified: copy !== null, copy, ...times });
      } catch (failed) {
        if (!(failed instanceof ChannelInputError)) throw failed;
        return notRecorded(failed.message);
      }
    }
  }

  // The notice, with what was read here in the place of what the draft left empty: same keys, same order.
  const notice = { ...draft, at, from, cwd, ...placeOf(run, cwd) };
  let file;
  try {
    file = appendNotice(home, slug, notice);
  } catch (err) {
    stderr(`js-harness notify: could not write ${recordPath(home, slug)} (${err.code ?? err.message})`);
    return 1;
  }
  const role = roleWords(notice.to);
  // The number a question has in the record: it is read back by the id the question was given.
  let questionNumber = null;
  let numberNotKnown = null;
  // How many questions of the record wait for him once this one is written: the rule for asking him says how many.
  let questionsWaiting = 0;
  if (notice.kind === 'question') {
    const back = readNotices(home, slug, { readFile });
    const found = back.unavailable === undefined ? back.questions.find((one) => one.notice.id === notice.id) : undefined;
    if (found !== undefined) {
      questionNumber = found.number;
      questionsWaiting = recordedQuestions(back).filter((one) => one.closed === null).length;
    } else numberNotKnown = back.unavailable !== undefined ? `the channel's record ${back.path} could not be read back (${back.unavailable})` : 'the question is not in the record';
  }
  const what = notice.kind === 'question' ? (questionNumber === null ? 'question (number not known)' : `question ${questionNumber}`)
    : notice.kind === 'answer' && notice.question !== undefined ? `answer to question ${notice.question}`
      : notice.kind === 'withdrawn' ? `withdrawn question ${notice.question}`
        : notice.kind === 'ready' ? `ready for pull request ${notice.pr}`
        : notice.kind;
  // The hour is read from this clock at the instant `at` names, and the share from the sender's transcript: nobody types either.
  const clock = new Date(at);
  const hour = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  const holding = from.context ? `, holding ${from.context.percent}% of its context` : '';
  stdout(`js-harness notify: recorded ${what} for ${role} at ${hour} local (${at}) from ${senderWords(from)}${holding} in ${file}`);
  if (notice.copy) {
    for (const one of notice.copy.answers) stdout(`the user's answer, ${one.how}: ${one.answer.length > SHOWN ? `${one.answer.slice(0, SHOWN)}…` : one.answer}`);
  }
  if (questionNumber !== null) stdout(`prefix: ${JSON.stringify(questionPrefix(questionNumber))}`);
  senderNotKnown();
  if (unverified !== null) stderr(`js-harness notify: the answer to question ${notice.question} is recorded UNVERIFIED: ${unverified}: it is the sender's claim until the line is read`);
  if (numberNotKnown !== null) stderr(`js-harness notify: the number of the question is not known: ${numberNotKnown}: its number is read with js-harness sessions`);

  // When he last wrote in the sender's own transcript: the rule for asking him reads it. A transcript that cannot be
  // read gives no time, and the rule says so rather than guess where he is.
  const personAtOf = () => {
    if (from.id === null) return null;
    try {
      return sessionFacts(readFile(path.join(projectDir, `${from.id}.jsonl`)), { tail: 0 }).personAt;
    } catch {
      return null;
    }
  };

  // What the sender does with a question once its number is known: ring the one orchestrator, or, when the
  // sender is that orchestrator or there is none to ring, ask him itself. The line says which, and is the
  // last thing printed. `address` is the one title the address is, or `null` when there is no single one.
  // The orchestrator is known by its own title, since `sessions --address` does not count the session that
  // asks. Whoever asks him is told how: the question tool holds the session that calls it until he answers, so
  // `askingRule` says whether he is there to be asked now or only in the reply to his next message.
  const followUp = (address) => {
    if (questionNumber === null) return;
    const ask = JSON.stringify(questionPrefix(questionNumber));
    const rule = () => askingRule(personAtOf(), now(), { waiting: questionsWaiting });
    if (roleOfTitle(from.title)?.role === 'orchestrator') stdout(`you hold that role: ${rule()}. Its text is headed by ${ask}; until it is asked the question waits as this notice`);
    else if (address === null) stdout(`no orchestrator to show it: ask the user yourself: ${rule()}. Its text is headed by ${ask}. Then record the user's answer: js-harness notify --to orchestrator --kind answer --question ${questionNumber} --transcript <session id> --line <n> "<the user's answer in one line>"`);
    else stdout(`question ${questionNumber} is recorded for ${address} to show to the user: ring it with the number, and go on with what does not wait on it`);
  };

  // The address of the role, so the sender can ring it: the answer of `sessions --address`, asked of the
  // command itself with the folder, the Claude home and the sender this one was given. Only its exit 0 is
  // an address; any other answer is said in one line, and changes nothing of what was recorded.
  const out = [];
  const err = [];
  let code;
  try {
    const asked = ['--address', parsed.notice.to, '--cwd', cwd, ...(parsed.claudeHome !== undefined ? ['--claude-home', claudeHome] : []), ...(parsed.self !== undefined ? ['--self', parsed.self] : [])];
    // The harness home goes in the environment, where the board looks for it: it reads the record this
    // command writes, by which a session with no title in its transcript holds its role.
    code = await sessions(asked, { cwd: defaultCwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), env: { ...env, JS_HARNESS_HOME: home }, now, homedir, run, readFile, readdir });
  } catch (failure) {
    stdout(`address of ${role}: not known: sessions --address could not be asked (${failure.message})`);
    followUp(null);
    return 0;
  }
  const address = code === 0 && out.length === 1 ? out[0] : null;
  if (address !== null) {
    stdout(`address of ${role}: ${address}`);
    // What it says beside a title (the title is also the asker's own, a transcript it could not read).
    for (const line of err) stderr(line);
  } else {
    const said = [...out.map((title) => JSON.stringify(title)), ...err.map((line) => line.replace(/^js-harness sessions: /, '').replace(/\s*\n\s*/g, ' '))];
    stdout(`address of ${role}: no single one now (sessions --address exit ${code}): ${said.join('; ')}`);
  }
  followUp(address);
  return 0;
}
