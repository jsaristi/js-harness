import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commitTree, functionsOf, gitIn, harnessOfCommit, harnessOfTree, workingTree } from './project-functions.mjs';

// Every test here runs a real git, which must not pick up the host's configuration, nor the repository a
// commit's hook points at through GIT_DIR and its like (the same isolation as bin/lib/project.test.mjs).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

function folder(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function repo(t, files = {}) {
  const root = folder(t);
  run(root, 'init');
  run(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  run(root, 'config', 'user.name', 'js-harness test');
  write(root, files);
  return root;
}

function write(root, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
}

function commit(root, message = 'a commit') {
  run(root, 'add', '-A');
  run(root, 'commit', '-m', message);
  return run(root, 'rev-parse', 'HEAD');
}

test('the working tree is what git tracks, has staged and sees untracked, and not what it ignores', (t) => {
  const root = repo(t, { 'notes.md': 'x', '.gitignore': 'out/\n' });
  commit(root);
  write(root, { 'staged.py': 'x', 'new/untracked.go': 'x', 'out/built.js': 'x' });
  run(root, 'add', 'staged.py');
  assert.deepEqual(workingTree(gitIn(root)).paths.sort(), ['.gitignore', 'new/untracked.go', 'notes.md', 'staged.py']);
});

test('a name with a space or a letter outside ASCII comes back as it is', (t) => {
  const root = repo(t, { 'mis notas/año.md': 'x' });
  assert.deepEqual(workingTree(gitIn(root)).paths, ['mis notas/año.md']);
});

test('the working tree of a folder that is no git repository is unknown, with the reason', (t) => {
  assert.deepEqual(workingTree(gitIn(folder(t))), { unknown: 'git could not list the files' });
});

test('the tree of a commit is that commit, whatever the working tree holds now', (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  const first = commit(root);
  write(root, { 'src/fetch.py': 'x' });
  commit(root, 'code appears');
  assert.deepEqual(commitTree(gitIn(root), first), { paths: ['notes.md'] });
  assert.deepEqual(commitTree(gitIn(root), 'HEAD').paths.sort(), ['notes.md', 'src/fetch.py']);
});

test('the tree of a commit git does not know is unknown', (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  commit(root);
  assert.deepEqual(commitTree(gitIn(root), 'no-such-rev'), { unknown: 'git could not list the files of no-such-rev' });
});

test('harness.json of a commit is read from the commit, not from the working tree', (t) => {
  const root = repo(t, { 'harness.json': '{ "functions": { "codexReview": "on" } }' });
  const on = commit(root);
  write(root, { 'harness.json': '{ "functions": { "codexReview": "off" } }' });
  assert.deepEqual(harnessOfCommit(gitIn(root), on), { declared: { functions: { codexReview: 'on' } } });
  assert.deepEqual(harnessOfTree(root), { declared: { functions: { codexReview: 'off' } } });
});

test('a commit, or a folder, with no harness.json declares nothing, and that is no error', (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  const rev = commit(root);
  assert.deepEqual(harnessOfCommit(gitIn(root), rev), { declared: undefined });
  assert.deepEqual(harnessOfTree(root), { declared: undefined });
});

test('a harness.json that is not JSON, or holds no object, is an error in a commit and in a folder alike', (t) => {
  for (const [text, reason] of [
    ['{ broken', /harness\.json is not valid JSON/],
    ['[]', /harness\.json must be a JSON object/],
  ]) {
    const root = repo(t, { 'harness.json': text });
    const rev = commit(root);
    assert.match(harnessOfCommit(gitIn(root), rev).error, reason);
    assert.match(harnessOfTree(root).error, reason);
  }
});

test('a harness.json that opens with a byte-order mark is read all the same', (t) => {
  const root = repo(t, { 'harness.json': '﻿{ "functions": { "codeMap": "off" } }' });
  const rev = commit(root);
  assert.deepEqual(harnessOfCommit(gitIn(root), rev), { declared: { functions: { codeMap: 'off' } } });
  assert.deepEqual(harnessOfTree(root), { declared: { functions: { codeMap: 'off' } } });
});

test('harness.json of a commit git does not know is an error, never a project that declares nothing', (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  commit(root);
  assert.match(harnessOfCommit(gitIn(root), 'no-such-rev').error, /git could not read no-such-rev/);
});

test('the functions of a project: what it declares, resolved over its files', (t) => {
  const harness = { declared: { functions: { codexReview: 'off' } } };
  const { errors, resolved } = functionsOf(harness, { paths: ['notes.md', 'src/fetch.py'] });
  assert.deepEqual(errors, []);
  assert.equal(resolved.codexReview.value, 'off');
  assert.deepEqual(resolved.codeMap, { value: 'on-demand', declared: 'auto', because: 'src/fetch.py is a program' });
});

test('the functions of a project whose harness.json cannot be read: the error, and every switch on', (t) => {
  const { errors, resolved } = functionsOf({ error: 'harness.json is not valid JSON: x' }, { paths: [] });
  assert.deepEqual(errors, ['harness.json is not valid JSON: x']);
  assert.deepEqual(
    Object.fromEntries(Object.entries(resolved).map(([name, { value }]) => [name, value])),
    { codeMap: 'on-demand', languageServer: 'on', codexReview: 'on' },
  );
});

test('a harness.json that is there and cannot be read is an error, not a throw and not a project that declares nothing', (t) => {
  const root = folder(t);
  fs.mkdirSync(path.join(root, 'harness.json'));
  assert.match(harnessOfTree(root).error, /harness\.json could not be read/);
});
