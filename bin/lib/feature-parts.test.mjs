import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureParts } from './feature-parts.mjs';

// A document shaped like `odd/tasks/session-channel.md` at 64933f6: its first unchecked task (T2) is stale,
// and the task the session works on is the one its first resume section names first (T6b).
const DOC = [
  '# Feature', //                                         1
  '', //                                                  2
  '## Specs', //                                          3
  '- S1. The first spec', //                              4
  '  goes on.', //                                        5
  '- **S2** (the lead): the second', //                   6
  'S3. A paragraph spec', //                              7
  '', //                                                  8
  '## Tasks', //                                          9
  '- [x] T1 (kind: design) Done', //                     10
  '- [ ] T2 (kind: build) Stale, never ticked (S1)', //  11
  '- [ ] T6 (kind: build) Another', //                   12
  '- [ ] T6b (kind: build) The one in progress,', //     13
  '  for S1 and S3', //                                  14
  '', //                                                 15
  '## Progress', //                                      16
  '- 2026-10-10, T1. Designed.', //                      17
  '- 2026-10-11, T6b. Started,', //                      18
  '  with a second line.', //                            19
  '- 2026-10-12, T6. Not the same task.', //             20
  '- 2026-10-13, T6b\'s second day.', //                 21
  '', //                                                 22
  '## State for a resume', //                            23
  'T6b is half built; T2 can wait.', //                  24
  '', //                                                 25
  '## Next step', //                                     26
  '1. T6b, built in this order.', //                     27
  '### A sub-heading stays inside', //                   28
  'More.', //                                            29
  '', //                                                 (the final newline)
].join('\n');

test('lines is the number of the last line, with or without a final newline', () => {
  assert.equal(featureParts(DOC).lines, 29);
  assert.equal(featureParts('a\nb').lines, 2);
  assert.equal(featureParts('a\nb\n').lines, 2);
  assert.equal(featureParts('a\r\nb\r\n').lines, 2);
});

test('the resume sections are found by title, in document order, each ending at its last written line', () => {
  assert.deepEqual(featureParts(DOC).sections, [
    { title: 'State for a resume', start: 23, end: 24 },
    { title: 'Next step', start: 26, end: 29 },
  ]);
});

test('a resume title matches ignoring case, with a parenthesis or a colon after it, and history is left out', () => {
  const md = [
    '## Resume here (2026-10-16)', 'a', //   1-2
    '## next', 'b', //                       3-4
    '## Next step: T3', 'c', //              5-6
    '## Next step, earlier', 'd', //         7-8
    '## Next step, history', 'e', //         9-10
    '## Next steps for him', 'f', //         11-12
    '```', '## Next step', '```', //         13-15
  ].join('\n');
  assert.deepEqual(featureParts(md).sections.map(({ title, start, end }) => [title, start, end]), [
    ['Resume here (2026-10-16)', 1, 2],
    ['next', 3, 4],
    ['Next step: T3', 5, 6],
  ]);
});

test('the task is the open one the first resume section names first, not the first one unchecked', () => {
  assert.deepEqual(featureParts(DOC).task, { id: 'T6b', start: 13, end: 14 });
});

test('an id is named only as a whole word: T6b does not name T6', () => {
  const md = DOC.replace('T6b is half built; T2 can wait.', 'T6b is half built.');
  assert.equal(featureParts(md).task.id, 'T6b');
});

test('a task the resume section names that is done is passed over for the next one it names', () => {
  const md = DOC.replace('T6b is half built; T2 can wait.', 'T1 is done; T6 is next.');
  assert.equal(featureParts(md).task.id, 'T6');
});

test('without a resume section that names an open task, the task is the first one open', () => {
  const md = DOC.replace('T6b is half built; T2 can wait.', 'Nothing named.').replace('1. T6b, built in this order.', 'Nothing.');
  assert.deepEqual(featureParts(md).task, { id: 'T2', start: 11, end: 11 });
  assert.equal(featureParts('# Done\n\n## Tasks\n- [x] T1 Done\n').task, null);
  assert.equal(featureParts('# No tasks\n').task, null);
});

test('the specs are those the whole task item names, in the order of the specs section', () => {
  assert.deepEqual(featureParts(DOC).specs, [
    { id: 'S1', start: 4, end: 5 },
    { id: 'S3', start: 7, end: 7 },
  ]);
});

test('a spec item may open with a bold id, and only the first specs section is read', () => {
  const md = DOC.replace('  for S1 and S3', '  for S2').concat('\n## Specs\n- S2. A second section\n');
  assert.deepEqual(featureParts(md).specs, [{ id: 'S2', start: 6, end: 6 }]);
});

test('the entries are the log bullets that name the task as a whole word, each with its wrapped lines', () => {
  assert.deepEqual(featureParts(DOC).entries, [
    { start: 18, end: 19 },
    { start: 21, end: 21 },
  ]);
});

test('only the last five entries are kept, and an L<n> paragraph is an entry', () => {
  const log = Array.from({ length: 7 }, (_, n) => (n % 2 === 0 ? `- L${n + 1} T6b, entry ${n + 1}` : `L${n + 1} (T6b) entry ${n + 1}`));
  const md = DOC.replace(/## Progress[\s\S]*?\n\n## State/, `## Log\n${log.join('\n')}\n\n## State`);
  const { entries } = featureParts(md);
  assert.equal(entries.length, 5);
  assert.deepEqual(entries.map(({ start }) => start), [19, 20, 21, 22, 23]);
});

test('a document with nothing to name gives no parts', () => {
  assert.deepEqual(featureParts('# A note\n\nSome text.\n'), { lines: 3, sections: [], task: null, specs: [], entries: [] });
});
