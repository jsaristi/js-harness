// The last line of a refusal (F8 S4b, odd/tasks/f8-s4b-contradictions.md, specs 3 and 4): its next step in one of three
// forms, and the review command bound to the head it was computed at, which the review commands refuse once that head
// moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atRefusal, commandStep, firstStep, formatRow, nextLine, noStep, rerunFlags, reviewCommand } from './next-step.mjs';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

test('each of the three forms gives one last line that says which it is', () => {
  assert.equal(nextLine(commandStep('js-harness contract template')), 'next: js-harness contract template');
  assert.equal(nextLine(firstStep('commit the correction')), 'next: commit the correction; then run again what printed this, for the command at the new head');
  assert.equal(nextLine(noStep('git did not answer, so nothing here can name one')), 'next: no command, git did not answer, so nothing here can name one');
});

test('a review command carries the base and the head it was computed at, as hashes', () => {
  assert.equal(reviewCommand('codex-review', { base: BASE, at: HEAD }), `js-harness codex-review --base ${BASE.slice(0, 12)} --at ${HEAD.slice(0, 12)}`);
  assert.equal(reviewCommand('codex-review', { base: `${BASE.slice(0, 7)}^`, at: HEAD, flags: ['--again'] }), `js-harness codex-review --base ${BASE.slice(0, 7)}^ --at ${HEAD.slice(0, 12)} --again`);
  assert.equal(
    reviewCommand('lens-review', { base: BASE, at: HEAD, lenses: 'reliability,security' }),
    `js-harness lens-review --base ${BASE.slice(0, 12)} --at ${HEAD.slice(0, 12)} --lenses reliability,security --reason "<what it touched and how>"`,
  );
  assert.equal(
    reviewCommand('lens-review', { base: BASE, at: HEAD }),
    `js-harness lens-review --base ${BASE.slice(0, 12)} --at ${HEAD.slice(0, 12)} --lenses <lens,...> --reason "<what it touched and how>"`,
  );
});

test('a review command refuses to be built from a label or a placeholder, which would not be bound to anything', () => {
  for (const base of ['origin/main', '<rev>', 'HEAD', '']) assert.throws(() => reviewCommand('codex-review', { base, at: HEAD }), /hash/);
  assert.throws(() => reviewCommand('codex-review', { base: BASE, at: 'HEAD' }), /hash/);
  assert.throws(() => reviewCommand('check', { base: BASE, at: HEAD }), /lens-review or codex-review/);
});

test('--at is refused once HEAD is another commit, and passes at the same one', () => {
  assert.equal(atRefusal({ at: HEAD.slice(0, 12), atCommit: HEAD, head: HEAD }), null);
  const refused = atRefusal({ at: HEAD.slice(0, 12), atCommit: HEAD, head: BASE });
  assert.match(refused, /computed at bbbbbbb, and HEAD is aaaaaaa now/);
  assert.match(refused.split('\n').at(-1), /^next: run again what printed this command/);
  assert.match(atRefusal({ at: 'nope', atCommit: null, head: HEAD }), /--at nope does not name a commit/);
  const unborn = atRefusal({ at: HEAD.slice(0, 12), atCommit: HEAD, head: null });
  assert.match(unborn, /HEAD names no commit here/);
  assert.match(unborn.split('\n').at(-1), /^next: /);
});

test('a rerun repeats the flags of the command refused, but the ones it binds or gives again', () => {
  const valued = ['--base', '--at', '--unavailable', '--max-parts', '--cwd'];
  const argv = ['--base', 'HEAD~1', '--again', '--unavailable', 'no quota today', '--max-parts', '6', '--cwd', 'D:\\a b'];
  assert.deepEqual(rerunFlags(argv, { valued, dropped: ['--base', '--at'] }), ['--again', '--unavailable "no quota today"', '--max-parts 6', '--cwd "D:\\a b"']);
  assert.deepEqual(rerunFlags(argv, { valued, dropped: ['--base', '--at', '--max-parts'] }), ['--again', '--unavailable "no quota today"', '--cwd "D:\\a b"']);
  assert.deepEqual(rerunFlags(['--base', 'x', '--at', 'y'], { valued, dropped: ['--base', '--at'] }), []);
});

test('check prints a failing row\'s next step as its last line, and none on a row that passes or informs', () => {
  const next = noStep('git did not answer');
  assert.equal(formatRow({ name: 'x', pass: false, detail: 'd', lines: ['a line'], next }), 'FAIL  x  d\n      a line\n      next: no command, git did not answer');
  assert.equal(formatRow({ name: 'x', pass: true, detail: 'd', next }), 'PASS  x  d');
  assert.equal(formatRow({ name: 'x', pass: true, info: true, detail: 'd', next }), 'INFO  x  d');
  assert.equal(formatRow({ name: 'x', pass: false, detail: 'd' }), 'FAIL  x  d');
});
