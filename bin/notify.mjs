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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tty from 'node:tty';
import { spawnSync } from 'node:child_process';
import { sessionsMain } from './sessions.mjs';
import { ChannelInputError, NOTICE_KINDS, NOTICE_TEXT_MAX, OPENING_TEXT_MAX, OPENING_TITLE_MAX, RELIEF_LINE_MAX, appendNotice, appendRelief, newNotice, openingTextOf, openingTitleOf, placeOf, readNotices, recordPath, reliefLineOf, reliefPath, senderOf, writeOpening } from './lib/channel.mjs';
import { mainCheckout, projectSlug, roleOfTitle, titleRead } from './lib/sessions.mjs';

const USAGE = [
  'Usage: js-harness notify --to orchestrator|<number> --kind <kind> [--transcript <file or session id> --line <n>] "<one line>"',
  '       js-harness notify --relief "<one line>"',
  '       js-harness notify --opening "<title>"   (the opening\'s text on standard input)',
  '                         [--self <session id>] [--cwd <path>] [--home <path>] [--claude-home <path>]',
  '  --to and --kind append one notice to the project\'s record, <home>/.js-harness/channel/<project>.jsonl,',
  '    with the time of the clock, the sender\'s session and the worktree and branch it ran in, then print',
  '    the address of the role as `sessions --address` gives it. The exit is 0 once the notice is recorded,',
  '    with an address or without one.',
  `    Kinds: ${NOTICE_KINDS.join(', ')}. An answer carries the user's words and says where they`,
  '    are read, with --transcript and --line; no other kind takes them. The text is one line of',
  `    ${NOTICE_TEXT_MAX} characters at most.`,
  `  --relief appends one line, of ${RELIEF_LINE_MAX} characters at most, to the orchestrator's relief file, with the`,
  '    local date and time of the clock.',
  `  --opening stores the opening of the session with that title (one line, ${OPENING_TITLE_MAX} characters at most):`,
  `    its text is read from standard input as UTF-8, ${OPENING_TEXT_MAX} characters at most, and the same title`,
  '    again replaces it.',
  '  A text, a line or a title that begins with -- goes after a lone --: -- "--a text", --relief -- "--a line", --opening -- "--a title".',
  '    Without it, it is read as an option this command does not know, and refused.',
  '  A notice is a claim of the session that wrote it, never the user\'s word. It sends no message.',
  '  Exit 2: a usage error, and nothing is written. Exit 1: the file could not be written.',
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
  const values = new Map([['--to', 'to'], ['--kind', 'kind'], ['--transcript', 'transcript'], ['--line', 'line'], ['--relief', 'relief'], ['--opening', 'opening'], ['--self', 'self'], ['--cwd', 'cwd'], ['--home', 'home'], ['--claude-home', 'claudeHome']]);
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
  const ofANotice = ['to', 'kind', 'transcript', 'line'].filter((key) => parsed[key] !== undefined).map((key) => `--${key}`);
  for (const [flag, other] of [['relief', 'opening'], ['opening', 'relief']]) {
    if (parsed[flag] === undefined) continue;
    const extra = [...ofANotice, ...(parsed[other] !== undefined ? [`--${other}`] : []), ...(texts.length > 0 ? ['a text'] : [])];
    if (extra.length > 0) throw new NotifyArgError(`--${flag} writes one thing: it does not go with ${extra.join(', ')}`);
    return { ...places, [flag]: parsed[flag] };
  }
  if (parsed.to === undefined || parsed.kind === undefined) throw new NotifyArgError('a notice takes --to and --kind');
  if (texts.length === 0) throw new NotifyArgError('a notice takes its text: one line, between quotes');
  let line;
  if (parsed.line !== undefined) {
    if (!/^\d+$/.test(parsed.line)) throw new NotifyArgError('--line takes the number of a line of the transcript, from 1');
    line = Number(parsed.line);
  }
  return { ...places, notice: { to: parsed.to, kind: parsed.kind, text: texts[0], transcript: parsed.transcript, line } };
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
  } = {},
) {
  let parsed;
  let draft;
  try {
    parsed = parseArgs(argv);
    // Everything the caller gave is checked before anything is run or written.
    if (parsed.notice) draft = newNotice({ at: null, from: null, ...parsed.notice });
    else if (parsed.relief !== undefined) draft = reliefLineOf(parsed.relief);
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
  const from = senderOf({ self: parsed.self ?? null, env, projectDir: path.join(claudeHome, 'projects', slug), readdir, readFile });
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
    senderNotKnown();
    if (roleOfTitle(draft.title) === null) {
      stderr(`js-harness notify: ${JSON.stringify(draft.title)} is not of the shape <code> <role> · <what it does>: the opening is found by its whole title, not by a code and a role`);
    }
    return 0;
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
  stdout(`js-harness notify: recorded ${notice.kind} for ${role} at ${at} from ${senderWords(from)} in ${file}`);
  senderNotKnown();

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
    return 0;
  }
  if (code === 0 && out.length === 1) {
    stdout(`address of ${role}: ${out[0]}`);
    // What it says beside a title (the title is also the asker's own, a transcript it could not read).
    for (const line of err) stderr(line);
    return 0;
  }
  const said = [...out.map((title) => JSON.stringify(title)), ...err.map((line) => line.replace(/^js-harness sessions: /, '').replace(/\s*\n\s*/g, ' '))];
  stdout(`address of ${role}: no single one now (sessions --address exit ${code}): ${said.join('; ')}`);
  return 0;
}
