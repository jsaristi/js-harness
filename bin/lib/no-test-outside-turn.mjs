// The preload a Codex review out of the lock carries in NODE_OPTIONS, by name, with the line it prints and
// the exit code it ends with, which the review reads in Codex's events to tell a refused suite from a failed
// command (odd/tasks/faster-check.md, part 2). The preload itself is ./no-test-outside-turn.cjs, a CommonJS
// file because --require takes one.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The path of the preload, for `NODE_OPTIONS=--require=<path>`. */
export const NO_TEST_PRELOAD = path.join(path.dirname(fileURLToPath(import.meta.url)), 'no-test-outside-turn.cjs');

/** The exit code of a `node --test` the preload ended. */
export const NO_TEST_EXIT = 97;

/** The one line it prints on stderr. */
export const NO_TEST_LINE = 'js-harness: no `node --test` outside a turn of the gate lock: the gate already ran the suite on this range';

/** `NODE_OPTIONS` with the preload added after `existing`, the ones the review was given. A path with a space
 * goes in double quotes, inside which node reads a backslash as an escape, so each one is doubled there. */
export function noTestNodeOptions(existing = '', preload = NO_TEST_PRELOAD) {
  const value = /\s/.test(preload) ? `"${preload.replace(/[\\"]/g, '\\$&')}"` : preload;
  const own = `--require=${value}`;
  return typeof existing === 'string' && existing.trim() !== '' ? `${existing.trim()} ${own}` : own;
}

/** Whether a command Codex ran is a `node --test` the preload refused: its exit code and its line in the
 * output, the two together, since either alone could be another command's. */
export const isRefusal = ({ exitCode, output }) => exitCode === NO_TEST_EXIT && String(output ?? '').includes(NO_TEST_LINE);

const BLOCKING = ['P0', 'P1', 'P2'];

/** The mark of a review `excusedByRefusal` let through, in its run line's `answer` and in its record, so that
 * how many reviews went through this way can be counted from the records. */
export const EXCUSED_REFUSED_TESTS = 'refused-tests';

/** Whether a review's `incorrect` verdict owes no correction because it rests on refused test runs alone: no
 * finding of P0 to P2, and every command that failed (`commands`, each with `exitCode` and `refused`, as
 * `reviewEvidence` keeps them) was refused, at least one. Any finding still blocks, and so does a verdict
 * beside another failed command, which the review may have judged by. */
export function excusedByRefusal(answer, commands) {
  if (answer?.verdict !== 'incorrect' || !Array.isArray(answer.findings)) return false;
  if (answer.findings.some((one) => BLOCKING.includes(one?.severity))) return false;
  const failed = commands.filter((one) => one.exitCode !== 0);
  return failed.length > 0 && failed.every((one) => one.refused === true);
}
