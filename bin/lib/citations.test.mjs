// T3 of odd/tasks/commands-and-doctor.md (C5 of odd/tasks/rule-hierarchy.md): the lines a pending
// change adds to a feature document are read for `path:line` and commit citations, and each one is
// resolved against the tree and the repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addedLines, citationsIn, resolveCitations } from './citations.mjs';

test('a citation is a code span: a repository path with a line or a range, or a commit id', () => {
  assert.deepEqual(citationsIn('see `bin/check.mjs:1176-1202` and `bin/lib/stack.mjs:653`, on `d3f6ac1`'), [
    { kind: 'path', text: 'bin/check.mjs:1176-1202', path: 'bin/check.mjs', line: 1176, end: 1202 },
    { kind: 'path', text: 'bin/lib/stack.mjs:653', path: 'bin/lib/stack.mjs', line: 653, end: 653 },
    { kind: 'commit', text: 'd3f6ac1', id: 'd3f6ac1' },
  ]);
  // Not citations: a path with no line, a word, an absolute path, a URL, a hex word with no digit,
  // a number alone, and anything outside a code span.
  assert.deepEqual(citationsIn('`bin/check.mjs` `check` `D:\\x\\y.mjs:3` `https://a.b/c.md:2` `deadbeef` `1234567` bin/check.mjs:3 3ed5955'), []);
});

test('added lines are read from a diff with no context, with their file and new line number', () => {
  const diff = [
    'diff --git a/odd/tasks/a.md b/odd/tasks/a.md',
    '--- a/odd/tasks/a.md',
    '+++ b/odd/tasks/a.md',
    '@@ -3,0 +4,2 @@ heading',
    '+first added',
    '+second added',
    '@@ -10 +12 @@',
    '-gone',
    '+replaced',
    'diff --git a/new.md b/new.md',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new.md',
    '@@ -0,0 +1 @@',
    '+only line',
    '\\ No newline at end of file',
  ].join('\n');
  assert.deepEqual(addedLines(diff), [
    { file: 'odd/tasks/a.md', line: 4, text: 'first added' },
    { file: 'odd/tasks/a.md', line: 5, text: 'second added' },
    { file: 'odd/tasks/a.md', line: 12, text: 'replaced' },
    { file: 'new.md', line: 1, text: 'only line' },
  ]);
});

test('each citation resolves, or says why not: no such file, past its end, no such commit', () => {
  const files = new Map([['bin/check.mjs', 1500], ['bin/lib/stack.mjs', 700]]);
  const added = [
    { file: 'odd/tasks/a.md', line: 4, text: '`bin/check.mjs:1176-1202` and `bin/lib/stack.mjs:701`' },
    { file: 'odd/tasks/a.md', line: 5, text: 'on `d3f6ac1`, and `bin/gone.mjs:3` from `abc1234`' },
  ];
  const result = resolveCitations(added, { lineCount: (p) => files.get(p) ?? null, commitExists: (id) => id === 'd3f6ac1' });
  assert.equal(result.checked, 5);
  assert.deepEqual(result.unresolved, [
    { file: 'odd/tasks/a.md', line: 4, citation: 'bin/lib/stack.mjs:701', why: 'the file has 700 lines' },
    { file: 'odd/tasks/a.md', line: 5, citation: 'bin/gone.mjs:3', why: 'no such file' },
    { file: 'odd/tasks/a.md', line: 5, citation: 'abc1234', why: 'no such commit' },
  ]);
});
