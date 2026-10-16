// The repository is public (2026-10-16), and a GitHub workflow of a public repository runs on GitHub's machines
// for free, 20 jobs at once. It holds one workflow, `.github/workflows/gate.yml`: the gate of a commit whose
// tests overflow this machine's line (odd/tasks/first-version.md, "Gates on CI machines"). What bounds it is
// held here, because a public repository is read and forked by anyone:
// - it runs for a push to a `gate/` branch and for nothing else, so a pull request starts no run (the merge
//   queue's CircleCI run tests main as it will be, odd/tasks/merge-queue.md S4), `pull_request_target` never
//   hands a fork's code this repository's token, and a fork starts nothing here: a push needs write access;
// - its token can only read, and it names no secret;
// - each action is pinned by commit, so a moved tag cannot change what runs; one job, a fixed runner, a bound.
// Zero deps: the file is read as text, by the few shapes it is allowed to take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = path.join(ROOT, '.github', 'workflows');
const GATE = path.join(FOLDER, 'gate.yml');

/** The workflow without its comments and blank lines, as `[{ indent, text }]`. */
function workflowLines(text = fs.readFileSync(GATE, 'utf8')) {
  return text.split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line) => ({ indent: line.length - line.trimStart().length, text: line.trim() }));
}

/** The lines below the first line that reads `key`, down to the next line indented no deeper. */
function below(lines, key) {
  const at = lines.findIndex((line) => line.text === key);
  assert.notEqual(at, -1, `the workflow has a line \`${key}\``);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => line.indent <= lines[at].indent);
  return end === -1 ? rest : rest.slice(0, end);
}

/** A secret named in an expression, by property or by index: `secrets.X`, `secrets['X']`, `secrets [ "X" ]`. */
const SECRET = /\bsecrets\s*[.[]/;

const level = (lines) => lines.filter((line) => line.indent === lines[0].indent).map((line) => line.text);

test('the repository holds one GitHub workflow, the gate', () => {
  const files = fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER, { recursive: true }) : [];
  assert.deepEqual(files, ['gate.yml']);
  assert.equal(fs.existsSync(path.join(ROOT, '.github', 'actions')), false, 'no local action for a workflow to run');
});

test('the gate runs for a push to a gate/ branch and for nothing else', () => {
  const lines = workflowLines();
  assert.deepEqual(level(lines), ['name: gate', 'on:', 'permissions:', 'jobs:']);
  assert.deepEqual(below(lines, 'on:').map((line) => line.text), ['push:', 'branches:', "- 'gate/**'"]);
});

test('its token reads the contents and nothing more, and no secret is named', () => {
  const lines = workflowLines();
  assert.deepEqual(below(lines, 'permissions:').map((line) => line.text), ['contents: read']);
  const text = fs.readFileSync(GATE, 'utf8');
  assert.doesNotMatch(text, SECRET, 'a secret');
  assert.doesNotMatch(text, /GITHUB_TOKEN|github\.token/, 'the token handed to a step');
});

test('one job on a fixed runner, bounded, running the gate', () => {
  const lines = workflowLines();
  const jobs = below(lines, 'jobs:');
  assert.deepEqual(level(jobs), ['check:']);
  const job = level(below(jobs, 'check:'));
  assert.deepEqual(job, ['runs-on: ubuntu-24.04', 'timeout-minutes: 15', 'steps:']);
  const runs = lines.filter((line) => line.text.startsWith('run:') || line.text.startsWith('- run:')).map((line) => line.text);
  assert.ok(runs.some((text) => text.endsWith('node bin/check.mjs')), 'a step runs `node bin/check.mjs`');
});

test('every action is pinned by commit and is one of GitHub\'s own', () => {
  const uses = workflowLines().filter((line) => /^(- )?uses:/.test(line.text)).map((line) => line.text.replace(/^(- )?uses:\s*/, ''));
  assert.ok(uses.length > 0);
  for (const use of uses) assert.match(use, /^actions\/(checkout|setup-node)@[0-9a-f]{40}$/, use);
  assert.doesNotMatch(fs.readFileSync(GATE, 'utf8'), /persist-credentials:\s*true/);
});

test('a secret is found in either form an expression can name it', () => {
  for (const named of ['${{ secrets.API_KEY }}', "${{ secrets['API_KEY'] }}", '${{ secrets [ "API_KEY" ] }}']) assert.match(named, SECRET, named);
  assert.doesNotMatch('the secrets of this file', SECRET);
});

test('the shapes a workflow must not take are refused', () => {
  // The reader above is the guard: a trigger added beside `push`, or a pull request event, changes `on:`.
  const pullRequest = workflowLines("name: gate\non:\n  push:\n    branches:\n      - 'gate/**'\n  pull_request_target:\npermissions:\n  contents: read\njobs:\n");
  assert.notDeepEqual(below(pullRequest, 'on:').map((line) => line.text), ['push:', 'branches:', "- 'gate/**'"]);
});
