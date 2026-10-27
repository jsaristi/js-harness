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
