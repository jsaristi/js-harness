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
