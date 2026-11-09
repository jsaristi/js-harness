// Convention: a refusal ends with its next step (F8 S4b, odd/tasks/f8-s4b-contradictions.md, spec 3; the
// reverse-engineering document, 13.3 row 1). Every refusal of `check`, `check --push`, the merge door, `lens-review` and
// `codex-review` ends with one line from ./lib/next-step.mjs: the exact command (a review command bound by `--base
// <hash> --at <head>`), the step to take first, or "no command" with why. So the model is handed its next step as data,
// bound to the state it was computed for, and never a command it has to guess or one that names a branch or `<rev>`.
//
// What a test can see is checked, read from the source with its comments left out: in the files that build the rows
// of `check` and of the merge door, every row literal whose `pass` is not literally `true` carries a `next:` (one of
// the three forms, which `check` prints as the row's last line); in the two review commands, every `return 1` follows
// a printed refusal that ends through `nextLine(`, within the lines of its own block; and no file of the five surfaces
// prints a `<rev>` placeholder or a branch as the base of a command. The tests of each command run its refusals.
//
// How to comply: build the row with `next: commandStep(...)`, `firstStep(...)` or `noStep(...)`; print a command's
// refusal with `nextLine(...)` as its last line; build a review command with `reviewCommand(...)`. LEGACY lists the
// files that do not comply yet, each with why; it only shrinks (bin/lib/ratchet.testkit.mjs), and reaches 0 in S4b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { withoutComments } from './lib/source.testkit.mjs';

const REPO = path.join(import.meta.dirname, '..');

/** The files that build a row `check`, `check --push` or the merge door prints. */
const ROW_FILES = [
  'bin/check.mjs',
  'bin/lib/ci-gate.mjs',
  'bin/lib/claude-md-budget.mjs',
  'bin/lib/codex-review-rows.mjs',
  'bin/lib/flaky.mjs',
  'bin/lib/hook-count.mjs',
  'bin/lib/lens-review-rows.mjs',
  'bin/lib/merge-queue-reviews.mjs',
  'bin/lib/spec.mjs',
];
/** The review commands, and the modules that word a refusal they print. */
const COMMAND_FILES = ['bin/lens-review.mjs', 'bin/codex-review.mjs'];
const WORDING_FILES = ['bin/lib/codex-review-recheck.mjs', 'bin/lib/codex-meter.mjs', 'bin/lib/codex-review-coverage.mjs'];

const LEGACY = {
  'bin/check.mjs': 'its rows word their own next step (S4b, T7)',
  'bin/lib/ci-gate.mjs': 'its rows word their own next step (S4b, T7)',
  'bin/lib/claude-md-budget.mjs': 'its row words its own next step (S4b, T7)',
  'bin/lib/codex-review-rows.mjs': 'its rows print an unbound codex-review command (S4b, T6)',
  'bin/lib/flaky.mjs': 'its rows word their own next step (S4b, T7)',
  'bin/lib/hook-count.mjs': 'its row words its own next step (S4b, T7)',
  'bin/lib/lens-review-rows.mjs': 'its rows print an unbound lens-review command (S4b, T6)',
  'bin/lib/merge-queue-reviews.mjs': 'the merge door names no command (S4b, T6)',
  'bin/lib/spec.mjs': 'its rows word their own next step (S4b, T7)',
  'bin/lens-review.mjs': 'its refusals word their own next step (S4b, T6)',
  'bin/codex-review.mjs': 'its refusals word their own next step, some with <rev> (S4b, T6)',
  'bin/lib/codex-meter.mjs': 'its stop prints the base as typed (S4b, T6)',
};

const code = (file) => withoutComments(fs.readFileSync(path.join(REPO, file), 'utf8'));

/** The object literal around `at` in `text`: from the nearest unmatched `{` before it to its matching `}`. Braces in
 * strings are counted too, which holds while a template's `${...}` is balanced, as it always is. */
export function literalAround(text, at) {
  let depth = 0;
  let start = at;
  for (; start >= 0; start--) {
    if (text[start] === '}') depth++;
    else if (text[start] === '{' && depth-- === 0) break;
  }
  let end = at;
  for (depth = 0; end < text.length; end++) {
    if (text[end] === '{') depth++;
    else if (text[end] === '}' && depth-- === 0) break;
  }
  return text.slice(Math.max(start, 0), end + 1);
}

/** The row literals of `text` whose `pass` is not literally `true` and that carry no `next:`. */
export function rowsWithoutNext(text) {
  const found = [];
  for (const match of text.matchAll(/\bpass:\s*(?!true\b)[^,}\s]/g)) {
    const literal = literalAround(text, match.index);
    if (/\bdetail\b/.test(literal) && !/\bnext\s*:/.test(literal)) found.push(literal.split('\n')[0].trim().slice(0, 100));
  }
  return found;
}

/** The `return 1` of `text` whose block prints no line through `nextLine(` before it: the lines from the block's
 * opening brace to the return. */
export function exitsWithoutNext(text) {
  const found = [];
  for (const match of text.matchAll(/\breturn 1\b/g)) {
    let depth = 0;
    let start = match.index;
    for (; start >= 0; start--) {
      if (text[start] === '}') depth++;
      else if (text[start] === '{' && depth-- === 0) break;
    }
    const block = text.slice(start, match.index);
    if (!block.includes('nextLine(')) found.push(`line ${text.slice(0, match.index).split('\n').length}`);
  }
  return found;
}

/** The commands of `text` bound to nothing: a `<rev>` placeholder, or a branch as the base. A usage line is not one: it
 * documents the syntax, `Usage: js-harness ...` or a further form indented under it in the same string. */
export function unboundCommands(text) {
  return [...text.matchAll(/js-harness (?:lens-review|codex-review) --base (?:<rev>|origin\/|\$\{base\}(?!\^))/g)]
    .filter((match) => !/(?:Usage: |^\s*['`"] +)$/.test(text.slice(text.lastIndexOf('\n', match.index) + 1, match.index)))
    .map((match) => match[0]);
}

const faultsOf = (file) => {
  const text = code(file);
  return [
    ...(ROW_FILES.includes(file) ? rowsWithoutNext(text) : []),
    ...(COMMAND_FILES.includes(file) ? exitsWithoutNext(text) : []),
    ...unboundCommands(text),
  ];
};

test('the detectors find what they look for, and pass what complies', () => {
  assert.deepEqual(rowsWithoutNext("return { name, pass: false, detail: 'x' };"), ["{ name, pass: false, detail: 'x' }"]);
  assert.deepEqual(rowsWithoutNext("return { name, pass: ok, detail: 'x', next: noStep('git did not answer') };"), []);
  assert.deepEqual(rowsWithoutNext("return { name, pass: true, detail: 'x' };"), []);
  assert.deepEqual(exitsWithoutNext("if (a) {\n  error('no');\n  return 1;\n}"), ['line 3']);
  assert.deepEqual(exitsWithoutNext("if (a) {\n  error(`no\\n${nextLine(noStep('why'))}`);\n  return 1;\n}"), []);
  assert.deepEqual(unboundCommands('make it with: js-harness codex-review --base <rev>'), ['js-harness codex-review --base <rev>']);
  assert.deepEqual(unboundCommands('js-harness lens-review --base origin/main'), ['js-harness lens-review --base origin/']);
  assert.deepEqual(unboundCommands("  'Usage: js-harness lens-review --base <rev> --lenses <lens,...>\\n' +\n  '       js-harness lens-review --base <rev> --unavailable <reason>'"), []);
});

test('every refusal of the five surfaces ends with its next step, but the legacy files', () => {
  const files = [...new Set([...ROW_FILES, ...COMMAND_FILES, ...WORDING_FILES])];
  const broken = files.filter((file) => faultsOf(file).length > 0);
  assert.deepEqual(ratchet({ checked: files, broken, legacy: LEGACY }), [], broken.map((file) => `${file}: ${faultsOf(file).slice(0, 3).join('; ')}`).join('\n'));
});
