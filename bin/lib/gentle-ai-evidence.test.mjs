import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceLines, namedIds } from './gentle-ai-evidence.mjs';

test('evidenceLines reads the gentle-ai lines a diff adds to feature documents, numbered as they stand in the result', () => {
  const diff = [
    'diff --git a/odd/tasks/a.md b/odd/tasks/a.md',
    '--- a/odd/tasks/a.md',
    '+++ b/odd/tasks/a.md',
    '@@ -3,0 +4,2 @@ heading',
    '+- gentle-ai on 1234567..89abcde: approved',
    '+- a line that names 1234567 and no review',
    '@@ -10 +12 @@',
    '-old',
    '+- GENTLE-AI: abcdef0 approved',
    'diff --git a/docs/b.md b/docs/b.md',
    '--- a/docs/b.md',
    '+++ b/docs/b.md',
    '@@ -0,0 +1 @@',
    '+gentle-ai: 7654321 in a document that is no feature document',
    'diff --git a/odd/tasks/deep/c.md b/odd/tasks/deep/c.md',
    '+++ b/odd/tasks/deep/c.md',
    '@@ -0,0 +1 @@',
    '+gentle-ai: 7654321 below a folder of odd/tasks',
    'diff --git a/odd/tasks/gone.md b/odd/tasks/gone.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-gentle-ai: 7654321',
  ].join('\n');
  assert.deepEqual(evidenceLines(diff), [
    { path: 'odd/tasks/a.md', line: 4, text: '- gentle-ai on 1234567..89abcde: approved' },
    { path: 'odd/tasks/a.md', line: 12, text: '- GENTLE-AI: abcdef0 approved' },
  ]);
  assert.deepEqual(evidenceLines(''), []);
});

test('evidenceLines reads an added line that starts with "++" as a line, and a header git ends with a tab as its path', () => {
  const diff = [
    'diff --git a/odd/tasks/my feat.md b/odd/tasks/my feat.md',
    '--- a/odd/tasks/my feat.md\t',
    '+++ b/odd/tasks/my feat.md\t',
    '@@ -1,0 +2,2 @@',
    '+++ b/odd/tasks/other.md gentle-ai: 1234567',
    '+- gentle-ai: 89abcde approved',
  ].join('\n');
  assert.deepEqual(evidenceLines(diff), [
    { path: 'odd/tasks/my feat.md', line: 2, text: '++ b/odd/tasks/other.md gentle-ai: 1234567' },
    { path: 'odd/tasks/my feat.md', line: 3, text: '- gentle-ai: 89abcde approved' },
  ]);
});

test('namedIds reads the ranges a..b of a line and the hashes of seven characters or more outside them', () => {
  assert.deepEqual(namedIds('gentle-ai: `dc03f8b..689621f` high, approved; and 3d0cc94; not abc123 nor 1234567890123456789012345678901234567890a'), {
    ranges: [['dc03f8b', '689621f']],
    hashes: ['3d0cc94'],
  });
  assert.deepEqual(namedIds('gentle-ai: approved, lineage review-702ae2f77ce86f47'), { ranges: [], hashes: [] });
});
