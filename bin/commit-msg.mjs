#!/usr/bin/env node
// `commit-msg`: the commit-msg hook's step that takes the host's attribution lines out of a commit message
// (odd/tasks/strip-attribution.md). The Claude app tells every session to end a commit message with
// `Co-Authored-By: Claude ...` and `Claude-Session: ...`, which his rule forbids; three sightings showed the protocol
// line does not stop it (docs/FAILURES.md, commit-attribution-from-host). His answer was to take them out and let the
// commit go, so this never stops a commit: a file it cannot read or write is said and left as it is, exit 0.
// Exit 2: a usage error. It imports node's own modules and `lib/atomic-write.mjs` alone, so this repository's hook
// runs this file directly.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { renameOver } from './lib/atomic-write.mjs';

const USAGE = [
  'Usage: js-harness commit-msg <file>',
  "  The commit-msg hook's step: takes the host's attribution lines out of the commit message in <file> (git hands",
  '    the hook its path) and says in one line on stderr what it took out. A line goes when it is in the run of trailer',
  '    lines that closes the last paragraph (never the subject) and is a whole `Co-Authored-By:` trailer naming Claude',
  '    (the name alone, or with a model) or an address at anthropic.com, or a whole `Claude-Session:` line; a human',
  '    co-author stays, and every other byte is left as it was. It never stops the commit: a file it cannot read or',
  '    write is said and left as it is, exit 0. Exit 2: a usage error.',
].join('\n');

class CommitMsgArgError extends Error {}

const CO_AUTHOR = /^co-authored-by:\s*(.*?)\s*(?:<([^<>]*)>)?\s*$/i;
const SESSION = /^claude-session:/i;
// The names the host signs with: `Claude`, `Claude Code`, `Claude Opus 5.5`; a person named Claude Dupont is none.
const HOST_NAME = /^claude(?:\s+(?:code|opus|sonnet|haiku|fable|instant|\d+(?:\.\d+)*))*$/i;
const ANTHROPIC = /@(?:[a-z0-9-]+\.)*anthropic\.com$/i;
const TRAILER = /^[a-z0-9][a-z0-9-]*\s*:/i;
const CONTINUATION = /^\s+\S/;
// What `git commit -v` writes above the diff it shows; git drops it and everything under it.
const SCISSORS = /^\S+ -{24} >8 -{24}\s*$/;
// The marks `core.commentChar=auto` picks one of: the first that no line of the message starts with.
const AUTO_MARKS = ['#', ';', '@', '!', '$', '%', '^', '&', '|', ':'];

/** The marks a comment line of the message may start with, from git's `core.commentString` or `core.commentChar`
 * (`value`, null where neither is set): `#` by default, every mark `auto` may pick. */
export function commentMarks(value) {
  if (value === null || value === '') return ['#'];
  return value === 'auto' ? AUTO_MARKS : [value];
}

/** What git says of the comment mark, read where the hook runs; null where nothing is set or git cannot answer. */
function gitCommentConfig() {
  for (const key of ['core.commentString', 'core.commentChar']) {
    const result = spawnSync('git', ['config', '--get', key], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.replace(/\r?\n$/, '') !== '') return result.stdout.replace(/\r?\n$/, '');
  }
  return null;
}

/** Whether `line` (without its ending) is one the host appends: its co-author or its session. */
function hostLine(line) {
  if (SESSION.test(line)) return true;
  const coAuthor = CO_AUTHOR.exec(line);
  return coAuthor !== null && (HOST_NAME.test(coAuthor[1]) || ANTHROPIC.test(coAuthor[2] ?? ''));
}

/** The indexes of the trailers that end the message: the run of trailer lines that closes its last paragraph, comment
 * lines and what lies under the scissors left out, and never its first line, the subject. A host line quoted in the
 * body, with a line of prose under it, is in no such run. */
function trailerLines(lines, comments) {
  const scissors = lines.findIndex((line) => SCISSORS.test(line));
  const comment = (line) => comments.some((mark) => line.startsWith(mark));
  const content = (scissors === -1 ? lines : lines.slice(0, scissors)).map((line, i) => ({ line, i })).filter(({ line }) => !comment(line));
  let last = content.length - 1;
  while (last >= 0 && content[last].line.trim() === '') last -= 1;
  let first = last + 1;
  while (first > 1 && content[first - 1].line.trim() !== '' && (TRAILER.test(content[first - 1].line) || CONTINUATION.test(content[first - 1].line))) first -= 1;
  return content.slice(first, last + 1).map(({ i }) => i);
}

/** `text` without the host's attribution lines, each with its ending, and the lines removed, in order. `text` is the
 * message's bytes read as latin1, so every byte comes back as it was when the caller writes it as latin1; `comments`
 * are the marks its comment lines start with (`commentMarks`). */
export function stripAttribution(text, { comments = ['#'] } = {}) {
  const pieces = text.split(/(?<=\n)/);
  const lines = pieces.map((piece) => piece.replace(/\r?\n$/, ''));
  const gone = new Set(trailerLines(lines, comments).filter((i) => hostLine(lines[i])));
  return { text: pieces.filter((_, i) => !gone.has(i)).join(''), removed: lines.filter((_, i) => gone.has(i)) };
}

/** Writes `buffer` over `file` whole or not at all: a fresh temporary sibling, then one rename over it (`renameOver`,
 * whose seams `deps` carries), so a write that fails halfway leaves the message git reads as it was. */
export function replaceFile(file, buffer, deps = {}) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'wx');
  let open = true;
  try {
    fs.writeFileSync(fd, buffer);
    fs.closeSync(fd);
    open = false;
    renameOver(tmp, file, deps);
  } catch (error) {
    // Closed once only: a number closed again could by then name a file something else opened.
    if (open) {
      try {
        fs.closeSync(fd);
      } catch {
        // The write's own error is the one to throw.
      }
    }
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function parse(argv) {
  let file;
  for (const token of argv) {
    if (token.startsWith('-') || file !== undefined) throw new CommitMsgArgError(`unknown argument: ${token}`);
    file = token;
  }
  if (file === undefined) throw new CommitMsgArgError('the message file is required');
  return file;
}

export function commitMsgMain(
  argv,
  {
    stdout = console.log,
    stderr = console.error,
    readFile = (file) => fs.readFileSync(file),
    writeFile = replaceFile,
    commentConfig = gitCommentConfig,
  } = {},
) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) {
    stdout(USAGE);
    return 0;
  }
  let file;
  try {
    file = parse(argv);
  } catch (error) {
    if (!(error instanceof CommitMsgArgError)) throw error;
    stderr(error.message);
    stderr(USAGE);
    return 2;
  }
  const leftAsItIs = (what, error) => {
    stderr(`js-harness commit-msg: the message was left as it is: ${file} could not be ${what} (${error?.message ?? String(error)})`);
    return 0;
  };
  let bytes;
  try {
    bytes = readFile(file);
  } catch (error) {
    return leftAsItIs('read', error);
  }
  const config = commentConfig();
  const stripped = stripAttribution(bytes.toString('latin1'), { comments: commentMarks(config === null ? null : Buffer.from(config, 'utf8').toString('latin1')) });
  if (stripped.removed.length === 0) return 0;
  try {
    writeFile(file, Buffer.from(stripped.text, 'latin1'));
  } catch (error) {
    return leftAsItIs('written', error);
  }
  const said = stripped.removed.map((line) => Buffer.from(line, 'latin1').toString('utf8'));
  stderr(`js-harness commit-msg: removed the host's attribution lines: ${said.join(' | ')}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = commitMsgMain(process.argv.slice(2));
}
