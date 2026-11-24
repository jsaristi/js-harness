import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as status from './remote-status.mjs';
import { repositoryRoot } from './remote-status.mjs';

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'remote-status-'));

test('the module exports what the command uses and nothing of how it parses the log', () => {
  assert.deepEqual(Object.keys(status).sort(), ['clearStopped', 'logTail', 'markStopped', 'readServerState', 'reportStatus', 'repositoryRoot', 'stoppedOnPurpose']);
});

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
