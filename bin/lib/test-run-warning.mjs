// The warning for a whole test run started beside a gate: a `node --test` of several files run by hand while
// another gate holds the machine's lock shares its cores, and both miss their time bounds with every test
// green. On the night of 2026-10-14 JH 9 and JH 10 each started one. `js-harness guard --hook` (JH 15's)
// calls this for a Bash command and says what it answers; nothing here blocks anything
// (odd/tasks/test-run-warning.md).
import os from 'node:os';
import { readGateHolder } from './gate-lock.mjs';

/** The flags of `node --test` that take the next word as their value, so that word is no file. */
const VALUED = new Set(['--test-name-pattern', '--test-skip-pattern', '--test-reporter', '--test-reporter-destination', '--test-concurrency', '--test-timeout', '--test-shard', '--import', '--require', '-r', '--env-file']);

/** The words of a command line, quotes taken off: enough to count the files of a `node --test`. */
function words(text) {
  return [...text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);
}

/** How many files the `node --test` in `command` names: `0` for none, which is every test file the runner
 * finds, or `null` where the command runs no `node --test` as a command of its own (at its start, or after
 * `&&`, `||`, `;`, `|` or `(`). The first such run counts. */
export function testRunFiles(command) {
  for (const part of String(command).split(/&&|\|\||[;|(\n]/)) {
    const [program, ...rest] = words(part.trim());
    if (!program || !/(^|[\\/])node(\.exe)?$/i.test(program) || !rest.includes('--test')) continue;
    let files = 0;
    for (let i = 0; i < rest.length; i += 1) {
      const word = rest[i];
      if (VALUED.has(word)) i += 1;
      else if (!word.startsWith('-')) files += 1;
    }
    return files;
  }
  return null;
}

/** Whether `command` asks for a turn of the lock itself: through `js-harness gate --` (or the dispatcher's
 * file, `bin/js-harness.mjs gate`). */
const inATurn = (command) => /\bjs-harness(?:\.mjs)?\s+gate\b/.test(command);

/** The warning for `command`, or `null`: one line, when the command runs `node --test` of two or more files
 * or of none (every test file), is not run under `js-harness gate --`, is not inside a turn already
 * (`JS_HARNESS_GATE_HELD=1`, or `JS_HARNESS_CHECK_INNER=1` in a gate's sensor), and the machine's lock is
 * held now (`readGateHolder`). One test file stays free, as the skill says. `deps.holder` stands in for
 * the look at the lock; `deps.home` is the home of the lock (`JS_HARNESS_HOME`, else the user's). */
export function testRunWarning(command, { env = process.env, home = env.JS_HARNESS_HOME || os.homedir(), holder = () => readGateHolder(home) } = {}) {
  const files = testRunFiles(command);
  if (files === null || files === 1) return null;
  if (inATurn(String(command)) || env.JS_HARNESS_GATE_HELD === '1' || env.JS_HARNESS_CHECK_INNER === '1') return null;
  const held = holder();
  if (!held) return null;
  const what = files === 0 ? 'every test file' : `${files} test files`;
  const whose = held.cwd ? `the gate of ${held.cwd}` : 'another gate';
  return `node --test of ${what} starts outside a turn while ${whose} holds the machine's gate lock: both share the cores and miss their bounds; run it with js-harness gate -- <command>, or one file at a time`;
}
