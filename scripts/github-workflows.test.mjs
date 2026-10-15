// The gate's CI run is the merge queue's CircleCI run of each candidate, main as it will be
// (odd/tasks/merge-queue.md S4, odd/tasks/drop-github-gate.md S3). A GitHub workflow would run again on each
// pull request, an older merge of it, and spend minutes of an account that has 2,000 a month and no payment
// method. So the repository holds no workflow, and one added later fails the gate, here and on CircleCI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the repository holds no GitHub workflow: no pull request starts an Actions run', () => {
  const folder = path.join(ROOT, '.github', 'workflows');
  const files = fs.existsSync(folder) ? fs.readdirSync(folder, { recursive: true }) : [];
  assert.deepEqual(files, [], 'a file under .github/workflows');
});
