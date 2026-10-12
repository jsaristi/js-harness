import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numstatFiles, PART_MAX_CHANGED_LINES, PART_MAX_FILES, reviewParts } from './codex-review-parts.mjs';
import { ruleValue } from './rules.mjs';

const file = (path, changedLines) => ({ path, changedLines });
/** The parts as lists of paths, which is what most tests compare. */
const paths = (parts) => parts.map((part) => part.files);

// --- the parts of a range ---

test('the bound of a part is the declared rule review-part-lines', () => {
  assert.equal(PART_MAX_CHANGED_LINES, ruleValue('review-part-lines', 'changed lines'));
  assert.ok(Number.isInteger(PART_MAX_CHANGED_LINES) && PART_MAX_CHANGED_LINES > 0);
});

test('a range at or under the bound is one part, with its files in path order', () => {
  const parts = reviewParts([file('src/b.mjs', 100), file('README.md', 50), file('src/a.mjs', 250)]);
  assert.deepEqual(parts, [{ files: ['README.md', 'src/a.mjs', 'src/b.mjs'], changedLines: 400 }]);
  assert.deepEqual(paths(reviewParts([file('only.mjs', 1)])), [['only.mjs']]);
});

test('a range over the bound is grouped by whole files, in path order, each part within the bound', () => {
  const files = [file('a', 150), file('b', 150), file('c', 150), file('d', 50), file('e', 300), file('f', 100)];
  assert.deepEqual(reviewParts(files, 400), [
    { files: ['a', 'b'], changedLines: 300 },
    { files: ['c', 'd'], changedLines: 200 },
    { files: ['e', 'f'], changedLines: 400 },
  ]);
  // One line over the bound is another part.
  assert.deepEqual(paths(reviewParts([file('a', 200), file('b', 201)], 400)), [['a'], ['b']]);
  assert.deepEqual(paths(reviewParts([file('a', 200), file('b', 200)], 400)), [['a', 'b']]);
});

test('a file larger than the bound is alone in its own part, and is never split', () => {
  const files = [file('a', 10), file('big', 1200), file('c', 10), file('d', 10)];
  assert.deepEqual(reviewParts(files, 400), [
    { files: ['a'], changedLines: 10 },
    { files: ['big'], changedLines: 1200 },
    { files: ['c', 'd'], changedLines: 20 },
  ]);
  // Alone also beside a file that changes no line.
  assert.deepEqual(paths(reviewParts([file('big', 401), file('logo.png', 0)], 400)), [['big'], ['logo.png']]);
  assert.deepEqual(paths(reviewParts([file('big', 401)], 400)), [['big']], 'a range that is one file is one part, whatever its size');
});

test('a file that changes no line (a binary one, a mode change) is still listed, in the part its place gives it', () => {
  assert.deepEqual(reviewParts([file('a.mjs', 400), file('a.png', 0), file('b.mjs', 1)], 400), [
    { files: ['a.mjs', 'a.png'], changedLines: 400 },
    { files: ['b.mjs'], changedLines: 1 },
  ]);
  assert.deepEqual(reviewParts([file('x.png', 0), file('y.png', 0)], 400), [{ files: ['x.png', 'y.png'], changedLines: 0 }]);
});

test('no part is empty, and a range that changes no file has no part', () => {
  assert.deepEqual(reviewParts([]), []);
  for (const bound of [1, 7, 400]) {
    const parts = reviewParts(Array.from({ length: 40 }, (_, index) => file(`f${String(index).padStart(2, '0')}`, (index * 37) % 23)), bound);
    assert.equal(parts.every((part) => part.files.length > 0), true, `bound ${bound}`);
  }
});

test('every file is in exactly one part, and the changed lines of the parts add up to those of the range', () => {
  const files = Array.from({ length: 60 }, (_, index) => file(`dir${index % 7}/f${index}.mjs`, (index * 53) % 311));
  const parts = reviewParts(files, 400);
  assert.equal(parts.length > 1, true);
  assert.deepEqual(parts.flatMap((part) => part.files), files.map((entry) => entry.path).sort());
  assert.equal(parts.reduce((sum, part) => sum + part.changedLines, 0), files.reduce((sum, entry) => sum + entry.changedLines, 0));
  for (const part of parts) assert.equal(part.changedLines <= 400 || part.files.length === 1, true, JSON.stringify(part));
});

test('the same range gives the same parts in whatever order its files are given, and the input is left as it was', () => {
  const files = [file('z', 300), file('B', 300), file('a/b', 300), file('a', 300), file('a.b', 300)];
  const given = files.map((entry) => entry.path);
  const parts = reviewParts(files, 400);
  // Path order is the order of the code units, with no locale: the same on every machine.
  assert.deepEqual(paths(parts), [['B'], ['a'], ['a.b'], ['a/b'], ['z']]);
  assert.deepEqual(reviewParts([...files].reverse(), 400), parts);
  assert.deepEqual(files.map((entry) => entry.path), given);
});

// --- the files of a part: every path of a part goes on one command line ---

test('a part holds the declared count of files at most (40 in this case), however few lines they change', () => {
  assert.equal(PART_MAX_FILES, ruleValue('review-part-files', 'files'));
  assert.ok(Number.isInteger(PART_MAX_FILES) && PART_MAX_FILES > 0);
  // A hundred files of one line each: far under the bound of changed lines, and too many paths for one command.
  const files = Array.from({ length: 100 }, (_, index) => file(`src/f${String(index).padStart(3, '0')}.mjs`, 1));
  const parts = reviewParts(files);
  assert.deepEqual(parts.map((part) => [part.files.length, part.changedLines]), [[40, 40], [40, 40], [20, 20]]);
  assert.deepEqual(parts.flatMap((part) => part.files), files.map((entry) => entry.path), 'every file once, in path order');
  // Exactly the bound is one part, and one more file is another.
  assert.deepEqual(reviewParts(files.slice(0, 40)).map((part) => part.files.length), [40]);
  assert.deepEqual(reviewParts(files.slice(0, 41)).map((part) => part.files.length), [40, 1]);
});

test('files that change no line (binary ones) are bounded by their count too', () => {
  const images = Array.from({ length: 90 }, (_, index) => file(`img/${String(index).padStart(2, '0')}.png`, 0));
  assert.deepEqual(reviewParts(images).map((part) => [part.files.length, part.changedLines]), [[40, 0], [40, 0], [10, 0]]);
  // Whichever bound is reached first ends the part: the lines after `a.mjs`, the files after `b.mjs` and 39 images.
  const mixed = [file('a.mjs', 300), file('b.mjs', 200), ...images.slice(0, 45)];
  assert.deepEqual(reviewParts(mixed).map((part) => [part.files.length, part.changedLines]), [[1, 300], [40, 200], [6, 0]]);
});

test('the bound of files is the third argument, and is refused when it is not a positive integer', () => {
  const files = Array.from({ length: 5 }, (_, index) => file(`f${index}`, 1));
  assert.deepEqual(paths(reviewParts(files, 400, 2)), [['f0', 'f1'], ['f2', 'f3'], ['f4']]);
  assert.deepEqual(paths(reviewParts(files, 400, 1)), [['f0'], ['f1'], ['f2'], ['f3'], ['f4']]);
  for (const bound of [0, -1, 1.5, '40', null, Number.NaN, Infinity]) assert.throws(() => reviewParts(files, 400, bound), /positive integer of files/, String(bound));
});

test('reviewParts refuses a bound that is not a positive integer, and a file that is not a path with a count', () => {
  for (const bound of [0, -1, 1.5, '400', null, Number.NaN, Infinity]) assert.throws(() => reviewParts([file('a', 1)], bound), /positive integer/, String(bound));
  for (const bad of [file('', 1), file(7, 1), file('a', -1), file('a', 1.5), file('a', '3'), null, 'a']) {
    assert.throws(() => reviewParts([bad], 400), /changed file/, JSON.stringify(bad));
  }
});

// --- the changed files of a range, from `git diff --numstat -z --no-renames` ---

test('numstatFiles reads each record: the path, and its additions plus its deletions', () => {
  assert.deepEqual(numstatFiles('3\t2\tbin/a.mjs\x0010\t0\tdocs/new.md\x000\t7\tgone.txt\x00'), [
    { path: 'bin/a.mjs', changedLines: 5, binary: false },
    { path: 'docs/new.md', changedLines: 10, binary: false },
    { path: 'gone.txt', changedLines: 7, binary: false },
  ]);
  assert.deepEqual(numstatFiles(''), []);
});

test('numstatFiles: a binary file counts as no changed line and is still listed', () => {
  assert.deepEqual(numstatFiles('-\t-\tlogo.png\x001\t1\ta.txt\x00'), [
    { path: 'logo.png', changedLines: 0, binary: true },
    { path: 'a.txt', changedLines: 2, binary: false },
  ]);
});

test('numstatFiles keeps a path as git wrote it: spaces, tabs, quotes, a newline, another alphabet', () => {
  const odd = ['my file.txt', 'tab\there.txt', 'say "hi".txt', 'two\nlines.txt', 'año/café.js', ' lead and trail '];
  assert.deepEqual(numstatFiles(odd.map((path) => `1\t0\t${path}\x00`).join('')).map((entry) => entry.path), odd);
});

test('numstatFiles refuses what is not such a record, instead of guessing a path', () => {
  // A rename as `-z` writes it without `--no-renames`: an empty path, then the two names.
  assert.throws(() => numstatFiles('1\t0\t\x00old.txt\x00new.txt\x00'), /numstat/);
  assert.throws(() => numstatFiles('1\t0\ta.txt\n2\t0\tb.txt\n'), /numstat/, 'the output without -z, cut at no NUL');
  assert.throws(() => numstatFiles('x\t0\ta.txt\x00'), /numstat/);
  assert.throws(() => numstatFiles('1\t-\ta.txt\x00'), /numstat/);
  assert.throws(() => numstatFiles('1\t0\ta.txt'), /numstat/, 'a last record that was cut short');
  assert.throws(() => numstatFiles(undefined), /numstat/);
});
