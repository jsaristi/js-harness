import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { functionsMain } from './functions.mjs';

// A real git runs here: not the host's configuration, nor the repository of a commit's hook (see
// bin/lib/project.test.mjs).
let configDir;
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
after(() => fs.rmSync(configDir, { recursive: true, force: true }));

function repo(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  assert.equal(init.status, 0, `git init failed: ${init.stderr}`);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

async function functions(cwd, ...argv) {
  const out = [];
  const err = [];
  const code = await functionsMain(argv, process.env, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a project with a program and no switches: each switch, what it resolves to and why', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'src/fetch.py': 'x' });
  assert.deepEqual(await functions(root), {
    code: 0,
    out: [
      'codeMap         on-demand  auto: src/fetch.py is a program',
      'languageServer  off        auto: no file of the project is TypeScript',
      'codexReview     on         auto: src/fetch.py is a program',
    ].join('\n'),
    err: '',
  });
});

test('a project with no program: every function of code is off, and it says why', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'data/survey.csv': 'x' });
  assert.equal(
    (await functions(root)).out,
    [
      'codeMap         off        auto: no file of the project is a program',
      'languageServer  off        auto: no file of the project is TypeScript',
      'codexReview     off        auto: no file of the project is a program',
    ].join('\n'),
  );
});

test('a declared switch is shown as declared', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x', 'harness.json': '{ "functions": { "codexReview": "off" } }' });
  assert.match((await functions(root)).out, /^codexReview {5}off {8}declared in harness\.json$/m);
});

test('run from a folder inside the project, it reads the project and not the folder', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x', 'harness.json': '{ "functions": { "codeMap": "always" } }' });
  assert.match((await functions(path.join(root, 'src'))).out, /^codeMap {9}always {5}declared in harness\.json$/m);
});

test('a switch that cannot be read: the error on stderr, exit 1, and the switch shown as on', async (t) => {
  const root = repo(t, { 'notes.md': 'x', 'harness.json': '{ "functions": { "codexReview": "no" } }' });
  const { code, out, err } = await functions(root);
  assert.equal(code, 1);
  assert.equal(err, 'harness.json "functions"."codexReview" must be one of "auto", "on", "off"; it is "no"');
  assert.match(out, /^codexReview {5}on {9}declared in harness\.json$/m);
});

test('--json prints the same as one object', async (t) => {
  const root = repo(t, { 'src/fetch.py': 'x' });
  const { code, out } = await functions(root, '--json');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out), {
    errors: [],
    functions: {
      codeMap: { value: 'on-demand', declared: 'auto', because: 'src/fetch.py is a program' },
      languageServer: { value: 'off', declared: 'auto', because: 'no file of the project is TypeScript' },
      codexReview: { value: 'on', declared: 'auto', because: 'src/fetch.py is a program' },
    },
  });
});

test('outside a git repository nothing is turned off: every auto is on, with the reason', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-functions-cmd-nogit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { code, out } = await functions(root);
  assert.equal(code, 0);
  assert.match(out, /^codexReview {5}on {9}auto: the files of the project could not be read \(git could not list the files\), so it is read as on$/m);
});

test('an argument it does not take is a usage error: exit 2, nothing on stdout', async (t) => {
  const root = repo(t, { 'notes.md': 'x' });
  const { code, out, err } = await functions(root, '--apply-everything');
  assert.equal(code, 2);
  assert.equal(out, '');
  assert.match(err, /^unknown argument: --apply-everything\n\nUsage: js-harness functions/);
});
