// What a linked worktree leaves to the main checkout (./project-shared.mjs): the verdict from the two git dirs alone,
// with no git run. `init` in a real linked worktree is in project.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { excludeToWrite, hookElsewhere, sharedElsewhere } from './project-shared.mjs';

/** A folder laid out as a main checkout with one linked worktree's git dir, or as a bare repository with one. */
function layout(common) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-shared-')));
  const commonGitDir = path.join(dir, ...common);
  const gitDir = path.join(commonGitDir, 'worktrees', 'feature');
  fs.mkdirSync(path.join(commonGitDir, 'info'), { recursive: true });
  fs.mkdirSync(gitDir, { recursive: true });
  return { dir, commonGitDir, gitDir, exclude: path.join(commonGitDir, 'info', 'exclude'), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a checkout whose git dir is the common one shares nothing elsewhere, however the two are spelled', () => {
  const repo = layout(['main', '.git']);
  try {
    assert.equal(sharedElsewhere({ gitDir: repo.commonGitDir, commonGitDir: repo.commonGitDir }, 'do it by hand'), null);
    assert.equal(sharedElsewhere({ gitDir: path.join(repo.commonGitDir, 'info', '..'), commonGitDir: repo.commonGitDir }, 'do it by hand'), null);
    assert.equal(sharedElsewhere({ gitDir: null, commonGitDir: null }, 'do it by hand'), null, 'git named neither: as before');
    assert.equal(sharedElsewhere(undefined, 'do it by hand'), null);
  } finally {
    repo.done();
  }
});

test('a linked worktree is told which checkout writes and records what it shares', () => {
  const repo = layout(['main', '.git']);
  try {
    assert.equal(
      sharedElsewhere({ gitDir: repo.gitDir, commonGitDir: repo.commonGitDir }, 'do it by hand'),
      `shared by every worktree of this repository, so the record of this one would not outlive it: js-harness sync in ${path.join(repo.dir, 'main')} writes and records it once that checkout holds harness.json`,
    );
  } finally {
    repo.done();
  }
});

test('a worktree of a repository with no main checkout is told what to do by hand', () => {
  const repo = layout(['project.git']);
  try {
    assert.equal(
      sharedElsewhere({ gitDir: repo.gitDir, commonGitDir: repo.commonGitDir }, 'add the line yourself'),
      'shared by every worktree of this repository, which has no main checkout whose record would keep it: add the line yourself',
    );
  } finally {
    repo.done();
  }
});

test('a hook is left to the main checkout only where a linked worktree would write one every worktree shares', () => {
  const repo = layout(['main', '.git']);
  try {
    const linked = { gitDir: repo.gitDir, commonGitDir: repo.commonGitDir };
    const main = { gitDir: repo.commonGitDir, commonGitDir: repo.commonGitDir };
    assert.match(hookElsewhere({ outside: false, occupied: false, isWorkingTree: false }, linked, 'by hand'), /^shared by every worktree/);
    assert.match(hookElsewhere({ isWorkingTree: false }, linked, 'by hand'), /^shared by every worktree/, 'a place half described');
    assert.equal(hookElsewhere({ isWorkingTree: true }, linked, 'by hand'), null, 'under its own working tree (core.hooksPath)');
    assert.equal(hookElsewhere({ occupied: true, isWorkingTree: false }, linked, 'by hand'), null, 'already there: kept, as in any checkout');
    assert.equal(hookElsewhere({ outside: true, isWorkingTree: false }, linked, 'by hand'), null, 'outside the repository: kept, as in any checkout');
    assert.equal(hookElsewhere({ isWorkingTree: false }, main, 'by hand'), null, 'the main checkout writes it');
  } finally {
    repo.done();
  }
});

test('the exclude file is kept only in a linked worktree whose line is still to be added', () => {
  const repo = layout(['main', '.git']);
  try {
    const linked = { gitDir: repo.gitDir, commonGitDir: repo.commonGitDir };
    const main = { gitDir: repo.commonGitDir, commonGitDir: repo.commonGitDir };
    const target = { file: repo.exclude };
    assert.deepEqual(excludeToWrite(target, main), target, 'the main checkout writes it');
    assert.match(excludeToWrite(target, linked).reason, /^shared by every worktree of this repository, so the record of this one would not outlive it: /);
    assert.equal(excludeToWrite(target, linked).file, repo.exclude);
    fs.writeFileSync(repo.exclude, '# git ls-files --others --exclude-from=.git/info/exclude\n');
    assert.match(excludeToWrite(target, linked).reason, /^shared by every worktree/, 'a file without the line');
    fs.writeFileSync(repo.exclude, '.atl/\n');
    assert.deepEqual(excludeToWrite(target, linked), target, 'the line is there: nothing to write, nothing to say');
    const refused = { file: repo.exclude, reason: 'a link is in its path' };
    assert.deepEqual(excludeToWrite(refused, linked), refused, 'a reason already given stands');
    assert.deepEqual(excludeToWrite({ file: null, reason: 'git did not name the exclude file' }, linked), { file: null, reason: 'git did not name the exclude file' });
  } finally {
    repo.done();
  }
});
