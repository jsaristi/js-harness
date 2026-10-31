#!/usr/bin/env node
// `commit-msg`: the commit-msg hook's step that takes the host's attribution lines out of a commit message
// (odd/tasks/strip-attribution.md). The Claude app tells every session to end a commit message with
// `Co-Authored-By: Claude ...` and `Claude-Session: ...`, which his rule forbids; three sightings showed the protocol
// line does not stop it (docs/FAILURES.md, commit-attribution-from-host). His answer was to take them out and let the
// commit go, so this never stops a commit: a file it cannot read or write is said and left as it is, exit 0.
// Exit 2: a usage error. It imports nothing but node's own modules, so this repository's hook runs this file directly.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const USAGE = [
  'Usage: js-harness commit-msg <file>',
  "  The commit-msg hook's step: takes the host's attribution lines out of the commit message in <file> (git hands",
  '    the hook its path) and says in one line on stderr what it took out. A line goes when it is a whole',
  '    `Co-Authored-By:` trailer naming Claude or an address at anthropic.com, or a whole `Claude-Session:` line; a',
  '    human co-author stays, and every other byte is left as it was. It never stops the commit: a file it cannot read',
  '    or write is said and left as it is, exit 0. Exit 2: a usage error.',
].join('\n');

class CommitMsgArgError extends Error {}

const CO_AUTHOR = /^co-authored-by:\s*(.*?)\s*<([^<>]*)>\s*$/i;
const SESSION = /^claude-session:/i;
const ANTHROPIC = /@(?:[a-z0-9-]+\.)*anthropic\.com$/i;

/** Whether `line` (without its ending) is one the host appends: its co-author or its session. */
function hostLine(line) {
  if (SESSION.test(line)) return true;
  const coAuthor = CO_AUTHOR.exec(line);
  return coAuthor !== null && (/\bclaude\b/i.test(coAuthor[1]) || ANTHROPIC.test(coAuthor[2]));
}

/** `text` without the host's attribution lines, each with its ending, and the lines removed, in order. */
export function stripAttribution(text) {
  const kept = [];
  const removed = [];
  for (const piece of text.split(/(?<=\n)/)) {
    const line = piece.replace(/\r?\n$/, '');
    if (hostLine(line)) removed.push(line);
    else kept.push(piece);
  }
  return { text: kept.join(''), removed };
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
    readFile = (file) => fs.readFileSync(file, 'utf8'),
    writeFile = (file, text) => fs.writeFileSync(file, text, 'utf8'),
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
  let text;
  try {
    text = readFile(file);
  } catch (error) {
    return leftAsItIs('read', error);
  }
  const stripped = stripAttribution(text);
  if (stripped.removed.length === 0) return 0;
  try {
    writeFile(file, stripped.text);
  } catch (error) {
    return leftAsItIs('written', error);
  }
  stderr(`js-harness commit-msg: removed the host's attribution lines: ${stripped.removed.join(' | ')}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = commitMsgMain(process.argv.slice(2));
}
