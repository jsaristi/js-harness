// The warning for a whole test run started beside a gate: a `node --test` of several files run by hand while
// another gate holds the machine's lock shares its cores, and both miss their time bounds with every test
// green. On the night of 2026-10-14 JH 9 and JH 10 each started one. `js-harness guard --hook` (JH 15's)
// calls this for a Bash command and, by his decision (`ffe99ebf` line 5718), refuses the call with the line
// it answers (odd/tasks/test-run-warning.md).
import os from 'node:os';
import { readGateHolder } from './gate-lock.mjs';

/** The flags of `node --test` that take the next word as their value, so that word is no file. */
const VALUED = new Set(['--test-name-pattern', '--test-skip-pattern', '--test-reporter', '--test-reporter-destination', '--test-concurrency', '--test-timeout', '--test-shard', '--import', '--require', '-r', '--env-file']);

/** The commands of a command line, each as its words with quotes taken off. A command ends at `&&`, `||`,
 * `;`, `|`, `&`, `(`, `)` or a line break outside quotes: a `|` in a quoted pattern ends nothing (Codex,
 * 2026-10-14). A word keeps whether it held a wildcard outside quotes (`globbed`), which the shell expands. */
export function commandsOf(text) {
  const commands = [];
  let words = [];
  let word = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  const source = String(text);
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'") {
      const close = source.indexOf(char, i + 1);
      const inside = close === -1 ? source.slice(i + 1) : source.slice(i + 1, close);
      word ??= { text: '', globbed: false };
      word.text += inside;
      i = close === -1 ? source.length : close;
    } else if (/[;&|()\n]/.test(char)) {
      endCommand();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word ??= { text: '', globbed: false };
      word.text += char;
      if (char === '*' || char === '?') word.globbed = true;
    }
  }
  endCommand();
  return commands;
}

const isNode = (word) => /(^|[\\/])node(\.exe)?$/i.test(word?.text ?? '');

/** The words a `js-harness gate` command runs after its `--`, or `null` for a command that is no gate:
 * `js-harness gate ...` or `node .../js-harness.mjs gate ...`. One word after `--` is a command line of
 * its own, as `gate` reads it. */
function gateWraps(words) {
  const at = /(^|[\\/])js-harness(\.mjs)?$/.test(words[0]?.text ?? '') ? 0 : isNode(words[0]) && /js-harness\.mjs$/.test(words[1]?.text ?? '') ? 1 : -1;
  if (at === -1 || words[at + 1]?.text !== 'gate') return null;
  const split = words.findIndex((word) => word.text === '--');
  if (split === -1) return [];
  const rest = words.slice(split + 1);
  return rest.length === 1 ? commandsOf(rest[0].text).flat() : rest;
}

/** How many files the `node --test` of `words` names: `0` for none (every test file the runner finds),
 * `Infinity` when one is a wildcard (several, as a rule), or `null` for words that run no `node --test`. */
function filesOf(words) {
  const [program, ...rest] = words;
  if (!isNode(program) || !rest.some((word) => word.text === '--test')) return null;
  let files = 0;
  for (let i = 0; i < rest.length; i += 1) {
    const { text, globbed } = rest[i];
    if (VALUED.has(text)) i += 1;
    else if (!text.startsWith('-')) files += globbed ? Infinity : 1;
  }
  return files;
}

/** How many files the first `node --test` of `command` that runs outside `js-harness gate` names (see
 * `filesOf`), or `null` where there is none: a run that `js-harness gate --` wraps is in a turn. */
export function testRunFiles(command) {
  for (const words of commandsOf(command)) {
    if (gateWraps(words) !== null) continue;
    const files = filesOf(words);
    if (files !== null) return files;
  }
  return null;
}

/** The warning for `command`, or `null`: one line, when the command runs, outside `js-harness gate --`, a
 * `node --test` of two or more files, of a wildcard or of none (every test file); is not inside a turn
 * already (`JS_HARNESS_GATE_HELD=1`, or `JS_HARNESS_CHECK_INNER=1` in a gate's sensor); and the machine's
 * lock is held now (`readGateHolder`). One test file stays free, as the skill says. `deps.holder` stands in
 * for the look at the lock, which is made only for a command that qualifies; `deps.home` is the home of the
 * lock (`JS_HARNESS_HOME`, else the user's). */
export function testRunWarning(command, { env = process.env, home = env.JS_HARNESS_HOME || os.homedir(), holder = () => readGateHolder(home) } = {}) {
  const files = testRunFiles(command);
  if (files === null || files === 1) return null;
  if (env.JS_HARNESS_GATE_HELD === '1' || env.JS_HARNESS_CHECK_INNER === '1') return null;
  const held = holder();
  if (!held) return null;
  const what = files === 0 ? 'every test file' : files === Infinity ? 'several test files' : `${files} test files`;
  const whose = held.cwd ? `the gate of ${held.cwd}` : 'another gate';
  return `node --test of ${what} starts outside a turn while ${whose} holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, or one file at a time`;
}
