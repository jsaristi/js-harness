// What bounds a run of the gate on GitHub is written in `.github/workflows/gate.yml`, and a pull request runs
// its own copy of that file: a branch that widened it (a second system, a longer bound, a run for every push)
// would spend minutes of an account that has 2,000 a month and no payment method. These tests hold the file
// to its bounds, so widening it fails the gate, here and there. Zero deps: the file is read as text, by the
// few shapes it is allowed to take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'gate.yml');

/** The workflow without its comments and blank lines, as `[{ indent, text }]`. A `#` starts a comment at the
 * start of a line or after a space; no value of this file holds one. */
function workflowLines() {
  return fs.readFileSync(WORKFLOW, 'utf8').split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line) => ({ indent: line.length - line.trimStart().length, text: line.trim() }));
}

/** The lines below the line that reads `key` (the first one), down to the next line indented no deeper. */
function below(lines, key) {
  const at = lines.findIndex((line) => line.text === key);
  assert.notEqual(at, -1, `the workflow has a line \`${key}\``);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => line.indent <= lines[at].indent);
  return end === -1 ? rest : rest.slice(0, end);
}

const topLevel = (lines) => lines.filter((line) => line.indent === 0).map((line) => line.text);

test('the gate on GitHub is the only workflow of the repository', () => {
  assert.deepEqual(fs.readdirSync(path.dirname(WORKFLOW)).sort(), ['gate.yml']);
});

test('it runs for a pull request and for nothing else: no push, no schedule, no run asked for by hand', () => {
  const lines = workflowLines();
  assert.deepEqual(topLevel(lines), ['name: gate', 'on:', 'permissions:', 'concurrency:', 'jobs:']);
  const on = below(lines, 'on:');
  assert.deepEqual(on.filter((line) => line.indent === on[0].indent).map((line) => line.text), ['pull_request:']);
});

test('the paths it ignores are the documents of harness.json, so a pull request of documents alone runs nothing', () => {
  const { documents } = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness.json'), 'utf8'));
  const event = below(workflowLines(), 'pull_request:');
  assert.deepEqual(event.filter((line) => line.indent === event[0].indent).map((line) => line.text), ['paths-ignore:'], 'the paths are its only filter');
  const ignored = below(event, 'paths-ignore:').map((line) => line.text);
  // A document is a path under one of the folders `documents` names; `**` is every path under a folder.
  assert.deepEqual(ignored, documents.map((folder) => `- '${folder}**'`));
});

test('the token reads the repository and writes nothing, and the job is given no secret', () => {
  const lines = workflowLines();
  assert.deepEqual(below(lines, 'permissions:').map((line) => line.text), ['contents: read']);
  assert.ok(!lines.some((line) => /secrets\./.test(line.text)), 'no secret is read');
  assert.equal(lines.filter((line) => line.text.startsWith('permissions:')).length, 1, 'no job widens the permissions');
});

test('one job on Linux, bounded at fifteen minutes, with no matrix: a run is one job of one system', () => {
  const lines = workflowLines();
  const jobs = below(lines, 'jobs:');
  assert.deepEqual(jobs.filter((line) => line.indent === jobs[0].indent).map((line) => line.text), ['check:']);
  const job = below(lines, 'check:');
  const keys = job.filter((line) => line.indent === job[0].indent).map((line) => line.text);
  assert.deepEqual(keys, ['name: check on Linux', 'runs-on: ubuntu-latest', 'timeout-minutes: 15', 'steps:']);
});

test('a second push to a pull request stops the run of the first', () => {
  assert.deepEqual(below(workflowLines(), 'concurrency:').map((line) => line.text), ['group: gate-${{ github.event.pull_request.number }}', 'cancel-in-progress: true']);
});

test('every action is pinned to a commit, and the gate it runs is check', () => {
  const steps = below(workflowLines(), 'steps:');
  const uses = steps.map((line) => /^(?:- )?uses: (.+)$/.exec(line.text)?.[1]).filter(Boolean);
  assert.equal(uses.length, 2);
  for (const action of uses) assert.match(action, /^actions\/(checkout|setup-node)@[0-9a-f]{40}$/, action);
  const runs = steps.map((line) => /^(?:- )?run: (.+)$/.exec(line.text)?.[1]).filter(Boolean);
  assert.equal(runs.length, 2);
  assert.equal(runs[1], 'node bin/check.mjs');
  assert.match(runs[0], /^node -e "/, 'the other step only prints what the runner is');
});
