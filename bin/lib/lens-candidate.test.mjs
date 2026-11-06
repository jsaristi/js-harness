import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONTEXT_END, CONTEXT_START, lensCandidate, SUBJECT_LINE } from './lens-candidate.mjs';
import { withoutAutoMaintenance } from './git-fixture.testkit.mjs';

let dir;
const git = (...args) => {
  const ran = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout.trim();
};
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const commit = (message) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

let base;
let head;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-candidate-'));
  withoutAutoMaintenance(() => {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    git('config', 'core.autocrlf', 'false');
    write('bin/a.mjs', 'export const a = 1;\n');
    write('README.md', '# r\n');
    base = commit('first');
    write('bin/a.mjs', 'export const a = 2;\n');
    write('bin/b.mjs', 'export const b = 1;\n');
    write('README.md', '# r\nmore\n');
    head = commit('second');
  });
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('the candidate is the range: its two commits, the code paths in git order, each with its own patch', () => {
  const candidate = lensCandidate(dir, { base: 'HEAD~1', head: 'HEAD' });
  assert.equal(candidate.error, undefined);
  assert.deepEqual([candidate.base, candidate.head], [base, head]);
  assert.match(candidate.subjectHash, /^[0-9a-f]{64}$/);
  // The Markdown file is left out, as Codex leaves it out: what a lens reads is what Codex reads.
  assert.deepEqual(candidate.manifest, [
    { index: 0, path: 'bin/a.mjs', status: 'M', added: 1, deleted: 1 },
    { index: 1, path: 'bin/b.mjs', status: 'A', added: 1, deleted: 0 },
  ]);
  assert.deepEqual(candidate.leftOut, ['README.md']);
  assert.match(candidate.patches[0], /^diff --git a\/bin\/a\.mjs b\/bin\/a\.mjs\n[\s\S]*\+export const a = 2;\n$/);
  assert.match(candidate.patches[1], /^diff --git a\/bin\/b\.mjs b\/bin\/b\.mjs\n[\s\S]*\+export const b = 1;\n$/);
});

test('the block a lens reads opens with the subject line, holds the manifest and every patch in order, and closes', () => {
  const { block, subjectHash } = lensCandidate(dir, { base, head });
  const lines = block.split('\n');
  assert.equal(lines[0], `${SUBJECT_LINE} ${JSON.stringify({ base, head, subject_hash: subjectHash, paths: 2 })}`);
  assert.equal(lines[1], CONTEXT_START);
  assert.equal(lines.at(-2), CONTEXT_END);
  assert.ok(block.indexOf('path 0 "bin/a.mjs"') < block.indexOf('path 1 "bin/b.mjs"'));
  assert.ok(block.includes('0\tM\t+1 -1\t"bin/a.mjs"'));
  assert.ok(!block.includes('README.md'));
});

test('the subject hash does not move with the git configuration: the abbreviation of the index lines is fixed', () => {
  const first = lensCandidate(dir, { base, head }).subjectHash;
  for (const [key, value] of [['core.abbrev', '12'], ['diff.interHunkContext', '1000'], ['diff.noprefix', 'true']]) {
    git('config', key, value);
    try {
      assert.equal(lensCandidate(dir, { base, head }).subjectHash, first, key);
    } finally {
      git('config', '--unset', key);
    }
  }
});

test('the subject hash is of the patch alone: a message-only amend keeps it, a changed line does not', () => {
  const first = lensCandidate(dir, { base, head });
  withoutAutoMaintenance(() => git('commit', '-q', '--amend', '-m', 'second, said again'));
  const amended = lensCandidate(dir, { base, head: 'HEAD' });
  assert.notEqual(amended.head, first.head);
  assert.equal(amended.subjectHash, first.subjectHash);
  withoutAutoMaintenance(() => {
    write('bin/b.mjs', 'export const b = 3;\n');
    git('add', '-A');
    git('commit', '-q', '--amend', '--no-edit');
  });
  assert.notEqual(lensCandidate(dir, { base, head: 'HEAD' }).subjectHash, first.subjectHash);
});

test('a range whose every path is left out has an empty manifest, and a name that is no commit is an error', () => {
  withoutAutoMaintenance(() => {
    write('README.md', '# only a document\n');
    commit('docs');
  });
  const docs = lensCandidate(dir, { base: 'HEAD~1', head: 'HEAD' });
  assert.deepEqual(docs.manifest, []);
  assert.deepEqual(docs.leftOut, ['README.md']);
  assert.match(lensCandidate(dir, { base: 'no-such-ref', head: 'HEAD' }).error, /no-such-ref.*commit/);
});

/** A repository of its own, with `steps` run in it: each `{ files, message }` writes its files (a `null` text removes
 * one) and commits them. Returns the folder and the commit of each step. */
function repoOf(steps) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lens-candidate-renames-'));
  const run = (...args) => {
    const ran = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(ran.status, 0, `git ${args.join(' ')}: ${ran.stderr}`);
    return ran.stdout.trim();
  };
  const commits = [];
  withoutAutoMaintenance(() => {
    run('init', '-q', '--initial-branch=main');
    run('config', 'user.email', 't@example.com');
    run('config', 'user.name', 'T');
    run('config', 'core.autocrlf', 'false');
    for (const { files, message } of steps) {
      for (const [file, text] of Object.entries(files)) {
        const at = path.join(root, file);
        if (text === null) fs.rmSync(at);
        else {
          fs.mkdirSync(path.dirname(at), { recursive: true });
          fs.writeFileSync(at, text);
        }
      }
      run('add', '-A');
      run('commit', '-q', '-m', message);
      commits.push(run('rev-parse', 'HEAD'));
    }
  });
  return { root, commits };
}

const LINES = Array.from({ length: 200 }, (_, at) => `export const line${at} = ${at};\n`).join('');

test('a renamed file is one entry by its new path, naming its old one, with only the lines it changes', () => {
  const { root, commits: [from, to] } = repoOf([
    { files: { 'bin/old.mjs': LINES }, message: 'first' },
    { files: { 'bin/old.mjs': null, 'lib/new.mjs': LINES.replace('line7 = 7', 'line7 = 70') }, message: 'move' },
  ]);
  try {
    const candidate = lensCandidate(root, { base: from, head: to });
    assert.equal(candidate.error, undefined);
    assert.deepEqual(candidate.manifest, [{ index: 0, path: 'lib/new.mjs', from: 'bin/old.mjs', status: 'R', added: 1, deleted: 1 }]);
    assert.equal(candidate.patches.length, 1);
    assert.match(candidate.patches[0], /^diff --git a\/bin\/old\.mjs b\/lib\/new\.mjs\n[\s\S]*rename from bin\/old\.mjs\nrename to lib\/new\.mjs\n/);
    assert.equal(candidate.patches[0].split('\n').filter((line) => /^[+-][^+-]/.test(line)).length, 2, 'the patch holds the changed lines, not the whole file');
    assert.ok(candidate.block.includes('0\tR\t+1 -1\t"lib/new.mjs"\t"bin/old.mjs"'));
    assert.ok(candidate.block.includes('path 0 "lib/new.mjs"'));
    // Read renames off, as before this change, the same range is the whole file removed and added.
    const before = lensCandidate(root, { base: from, head: to, renames: '--no-renames' });
    assert.deepEqual(before.manifest.map(({ path: name, status, added, deleted }) => [name, status, added, deleted]), [['bin/old.mjs', 'D', 0, 200], ['lib/new.mjs', 'A', 200, 0]]);
    assert.notEqual(before.subjectHash, candidate.subjectHash);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a range that renames a document into code is read renames off: the code is read whole, the document left out', () => {
  const { root, commits: [from, to] } = repoOf([
    { files: { 'notes/plan.md': LINES } , message: 'first' },
    { files: { 'notes/plan.md': null, 'bin/plan.mjs': LINES.replace('line7 = 7', 'line7 = 70') }, message: 'the document becomes code' },
  ]);
  try {
    const candidate = lensCandidate(root, { base: from, head: to });
    assert.deepEqual(candidate.manifest, [{ index: 0, path: 'bin/plan.mjs', status: 'A', added: 200, deleted: 0 }]);
    assert.deepEqual(candidate.leftOut, ['notes/plan.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a range with no rename hands a lens what it was handed before: the same block and the same subject hash', () => {
  const now = lensCandidate(dir, { base, head: 'HEAD' });
  const before = lensCandidate(dir, { base, head: 'HEAD', renames: '--no-renames' });
  assert.equal(now.error, undefined);
  assert.equal(now.block, before.block);
  assert.equal(now.subjectHash, before.subjectHash);
});

test('the prompt tells every lens how a renamed file is written in the manifest it is handed', async () => {
  const { lensPrompt, LENS_NAMES } = await import('./lens-prompts.mjs');
  for (const name of LENS_NAMES) assert.match(lensPrompt(name), /a renamed file's line then holds its old path as a JSON string/, name);
});

test('the counts of each file are read whole: a path that starts with a tab is a path, not a rename', async () => {
  // Codex's review of 61aacc5..318fbae, P2: a path cut at its first tab read empty, as a rename's does.
  const { numstatCounts } = await import('./lens-candidate.mjs');
  const numstat = ['1\t2\t\tlead.mjs', '3\t4\tplain.mjs', '5\t6\t', 'old.mjs', 'new.mjs', '-\t-\tpicture.png', ''].join('\0');
  assert.deepEqual(numstatCounts(numstat), [[1, 2], [3, 4], [5, 6], [0, 0]]);
});
