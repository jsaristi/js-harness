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

test('the slice is committed on HEAD: src/export.mjs changed since the fixture, with a test of quiet, and nothing left uncommitted', () => {
  assert.ok(commitsAfterFixture() >= 1, 'no commit after the fixture');
  const root = git('rev-list', '--max-parents=0', 'HEAD');
  assert.equal(git('diff', '--name-only', root ?? 'HEAD', 'HEAD', '--', 'src/export.mjs'), 'src/export.mjs', 'src/export.mjs was not committed');
  assert.ok(git('grep', '-l', 'quiet', 'HEAD', '--', 'tests'), 'no committed test of quiet');
  assert.equal(git('status', '--porcelain', '--', 'src', 'tests'), '');
});

test('its pull request was opened, at the commit that holds the slice', () => {
  const opened = JSON.parse(read('.pr/opened.json') ?? 'null');
  assert.ok(opened, 'no pull request opened');
  assert.equal(opened.head, git('rev-parse', 'HEAD'));
});

test('nothing was merged', () => {
  assert.ok(exists('scripts/merge-pr.mjs'));
  assert.ok(!exists('.pr/merged.json'), 'the owner\'s merge was run');
});
