import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repositoryRoot } from './remote-status.mjs';

const tmpDirs = [];
test.after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-remote-status-'));
  tmpDirs.push(dir);
  return dir;
}

test('repositoryRoot returns the top level, or which lookup failed, and prints nothing: the command says why', () => {
  const dir = tempDir();
  const asked = [];
  const topLevel = (answer) => (cwd) => {
    asked.push(cwd);
    return answer;
  };
  assert.deepEqual(repositoryRoot(path.join(dir, 'missing'), topLevel('D:/a')), { error: 'noSuchDirectory' });
  assert.deepEqual(asked, [], 'git is not asked about a folder that does not exist');
  assert.deepEqual(repositoryRoot(dir, topLevel(null)), { error: 'notGit' });
  assert.deepEqual(repositoryRoot(dir, topLevel('D:/a')), { root: 'D:/a' });
  assert.deepEqual(asked, [dir, dir]);
});
