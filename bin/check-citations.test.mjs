// T3 of odd/tasks/commands-and-doctor.md: the row `citations` of `check`, INFO, reads only the lines the
// staged change adds to feature documents and counts the citations that do not resolve.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCitations } from './check.mjs';

let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-citations-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  // The dates of every commit, fixed: a short hash cited as a commit must hold a digit and a letter, and one
  // made at the hour of the run came out all digits about one run in 27 (docs/FAILURES.md,
  // citations-test-reads-clock). With these dates the hash is the same at every run.
  process.env.GIT_AUTHOR_DATE = '2026-01-01T00:00:00Z';
  process.env.GIT_COMMITTER_DATE = '2026-01-01T00:00:00Z';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-citations-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'bin', 'a.mjs'), 'one\ntwo\nthree\n');
  fs.mkdirSync(path.join(root, 'odd', 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'odd', 'tasks', 'f.md'), 'Cites `bin/gone.mjs:1` already.\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

test('only the lines a staged change adds to a feature document are read, and each unresolved citation is a line', () => {
  const root = repo();
  try {
    const head = git(root, 'rev-parse', '--short', 'HEAD');
    fs.appendFileSync(path.join(root, 'odd', 'tasks', 'f.md'), `At \`bin/a.mjs:2-3\` on \`${head}\`; \`bin/a.mjs:9\` and \`abc1234\` are not.\n`);
    fs.writeFileSync(path.join(root, 'notes.md'), 'Not a feature document: `bin/none.mjs:1`.\n');
    git(root, 'add', '.');
    const [row] = checkCitations(root);
    assert.deepEqual(row, {
      name: 'citations',
      pass: true,
      info: true,
      detail: '4 citations in the lines this change adds to feature documents, 2 of them not resolved',
      lines: ['odd/tasks/f.md:2 `bin/a.mjs:9`: the file has 3 lines', 'odd/tasks/f.md:2 `abc1234`: no such commit'],
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('with no feature document staged there is no row, and with nothing unresolved the row has no lines', () => {
  const root = repo();
  try {
    assert.deepEqual(checkCitations(root), []);
    fs.appendFileSync(path.join(root, 'odd', 'tasks', 'f.md'), 'See `bin/a.mjs:1`.\n');
    git(root, 'add', '.');
    assert.deepEqual(checkCitations(root), [{ name: 'citations', pass: true, info: true, detail: '1 citation in the lines this change adds to feature documents, all resolved' }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a citation resolves against the staged file, not the working tree', () => {
  const root = repo();
  try {
    fs.writeFileSync(path.join(root, 'bin', 'b.mjs'), 'one\n');
    fs.appendFileSync(path.join(root, 'odd', 'tasks', 'f.md'), 'See `bin/b.mjs:1` and `bin/a.mjs:5`.\n');
    git(root, 'add', '.');
    // Unstaged: the staged target is deleted, and lines that the staged file lacks are added.
    fs.rmSync(path.join(root, 'bin', 'b.mjs'));
    fs.appendFileSync(path.join(root, 'bin', 'a.mjs'), 'four\nfive\n');
    assert.deepEqual(checkCitations(root), [{
      name: 'citations',
      pass: true,
      info: true,
      detail: '2 citations in the lines this change adds to feature documents, 1 of them not resolved',
      lines: ['odd/tasks/f.md:2 `bin/a.mjs:5`: the file has 3 lines'],
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// T6 of odd/tasks/commands-and-doctor.md (docs/FAILURES.md, record-states-wrong-fact): tasks were checked off
// while their files were in no commit.
test('a task the change checks off names a commit reachable from HEAD, unless it rides with staged work', () => {
  const root = repo();
  try {
    const tasks = path.join(root, 'odd', 'tasks', 'f.md');
    fs.writeFileSync(tasks, '- [ ] T1 one\n- [ ] T2 two\n- [ ] T3 three\n- [x] T4 done before\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'tasks');
    const head = git(root, 'rev-parse', 'HEAD');
    // A commit this repository holds that HEAD does not reach.
    const side = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'side');
    fs.writeFileSync(tasks, `- [x] T1 one\n  Commit \`${head}\`.\n- [x] T2 two, at \`${side}\`\n- [x] T3 three\n- [x] T4 done before, reworded\n`);
    git(root, 'add', '.');
    const said = '2 citations in the lines this change adds to feature documents, all resolved; 3 tasks checked off';
    assert.deepEqual(checkCitations(root), [{
      name: 'citations',
      pass: true,
      info: true,
      detail: `${said}, 2 of them in no commit HEAD reaches`,
      lines: [`odd/tasks/f.md:3 T2 \`${side}\`: not reachable from HEAD`, 'odd/tasks/f.md:4 T3: names no commit, and nothing but feature documents is staged'],
    }]);
    // Staged beside its work, a task is checked off in the commit being made, which it cannot name.
    fs.appendFileSync(path.join(root, 'bin', 'a.mjs'), 'four\n');
    git(root, 'add', '.');
    assert.deepEqual(checkCitations(root), [{
      name: 'citations',
      pass: true,
      info: true,
      detail: `${said}, 1 of them in no commit HEAD reaches`,
      lines: [`odd/tasks/f.md:3 T2 \`${side}\`: not reachable from HEAD`],
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a checked-off task that names a commit of an unrelated history is not reachable, and a nested task is read alone', () => {
  const root = repo();
  try {
    const tasks = path.join(root, 'odd', 'tasks', 'f.md');
    fs.writeFileSync(tasks, '- [ ] T1 one\n- [ ] T2 parent\n  - [ ] T2a first\n  - [ ] T2b second\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'tasks');
    const head = git(root, 'rev-parse', 'HEAD');
    // A root commit with no parent: git finds no merge base of it and HEAD (Codex, 2026-10-17).
    const orphan = git(root, 'commit-tree', 'HEAD^{tree}', '-m', 'orphan');
    fs.writeFileSync(tasks, `- [x] T1 one, at \`${orphan}\`\n- [ ] T2 parent\n  - [x] T2a first\n  - [ ] T2b second, at \`${head}\`\n`);
    git(root, 'add', '.');
    const [row] = checkCitations(root);
    assert.deepEqual(row.lines, [`odd/tasks/f.md:1 T1 \`${orphan}\`: not reachable from HEAD`, 'odd/tasks/f.md:3 T2a: names no commit, and nothing but feature documents is staged']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
