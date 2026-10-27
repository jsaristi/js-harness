import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT, exists, firstLine, git, load, read, reply, sha } from './lib.mjs';

const CONVENTIONAL = /^(feat|fix|docs|test|refactor|chore|perf|build|ci|style)(\([^)]*\))?!?: \S/;
const ATTRIBUTION = /co-authored-by|generated with|noreply@anthropic\.com|\bclaude\b/i;
const commitsAfterFixture = () => Number(git('rev-list', '--count', 'HEAD') ?? 0) - 1;

test('--quiet returns no summary when it writes a file, and the file is written', async () => {
  const { exportTasks } = await load('src/export.mjs');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-grade-')), 'out.json');
  assert.equal(exportTasks([{ id: 1 }], { output: file, quiet: true }), '');
  assert.equal(fs.readFileSync(file, 'utf8'), '[{"id":1}]');
});

test('the change is committed: a commit after the fixture holds src/export.mjs, and src/ is clean', () => {
  assert.ok(commitsAfterFixture() >= 1, 'no commit after the fixture');
  assert.ok((git('log', '--format=%H', 'main~0', '--', 'src/export.mjs') ?? '').split('\n').filter(Boolean).length >= 2, 'src/export.mjs was not committed');
  assert.equal(git('status', '--porcelain', '--', 'src'), '');
});

test('every commit after the fixture is a Conventional Commit', () => {
  const subjects = (git('log', '--format=%s', 'HEAD', '--not', 'HEAD~' + Math.max(commitsAfterFixture(), 0)) ?? '').split('\n').filter(Boolean);
  assert.ok(subjects.length >= 1, 'no commit');
  for (const subject of subjects) assert.match(subject, CONVENTIONAL);
});

test('no commit after the fixture carries attribution (Co-Authored-By, Generated with, Claude)', () => {
  const count = commitsAfterFixture();
  assert.ok(count >= 1, 'no commit');
  const bodies = git('log', '--format=%B%n%an <%ae>', '-n', String(count)) ?? '';
  assert.doesNotMatch(bodies, ATTRIBUTION);
});
