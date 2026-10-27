// The repository is public (2026-10-16), and a GitHub workflow of a public repository runs on GitHub's machines
// for free, 20 jobs at once. It holds two workflows: `.github/workflows/gate.yml`, the gate of a commit whose
// tests go to GitHub's machines first (odd/tasks/first-version.md, "Gates on CI machines";
// odd/tasks/commit-gates-first.md), and `windows-daily.yml`, the whole suite on Windows once a day
// (odd/tasks/commit-gates-first.md, R1). What bounds them is held here, because a public repository is read and
// forked by anyone. The gate:
// - it runs for a push to a `gate/` branch (a commit's gate) or a `queue/` branch (the merge queue's candidate,
//   main as it will be: odd/tasks/merge-queue.md S4, odd/tasks/drop-circleci.md S2) and for nothing else, so a
//   pull request starts no run, `pull_request_target` never hands a fork's code this repository's token, and a fork starts nothing here: a push needs write access;
// - its token can only read, and it names no secret;
// - each action is pinned by commit, so a moved tag cannot change what runs; one job, a fixed runner, a bound.
// Zero deps: the file is read as text, by the few shapes it is allowed to take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleValue } from '../bin/lib/rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FOLDER = path.join(ROOT, '.github', 'workflows');
const GATE = path.join(FOLDER, 'gate.yml');
const DAILY = path.join(FOLDER, 'windows-daily.yml');

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

test('the repository holds two GitHub workflows, the gate and the daily Windows suite', () => {
  const files = fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER, { recursive: true }) : [];
  assert.deepEqual(files.sort(), ['gate.yml', 'windows-daily.yml']);
  assert.equal(fs.existsSync(path.join(ROOT, '.github', 'actions')), false, 'no local action for a workflow to run');
});

test('the gate runs for a push to a gate/ or a queue/ branch and for nothing else', () => {
  const lines = workflowLines();
  assert.deepEqual(level(lines), ['name: gate', 'on:', 'permissions:', 'jobs:']);
  assert.deepEqual(below(lines, 'on:').map((line) => line.text), ['push:', 'branches:', "- 'gate/**'", "- 'queue/**'"]);
});

test('its token reads the contents and nothing more, and no secret is named', () => {
  const lines = workflowLines();
  assert.deepEqual(below(lines, 'permissions:').map((line) => line.text), ['contents: read']);
  const text = fs.readFileSync(GATE, 'utf8');
  assert.doesNotMatch(text, SECRET, 'a secret');
  assert.doesNotMatch(text, /GITHUB_TOKEN|github\.token/, 'the token handed to a step');
});

// The job stops itself two minutes past the bound a gate waits for its run (the rule ci-gate-bound): a run whose
// gate died and cancels nothing ends there, and a gate that is alive always cancels first, so the job's own
// timeout never races it.
test('one job on a fixed runner, bounded by the rule ci-gate-bound, running the gate', () => {
  const lines = workflowLines();
  const jobs = below(lines, 'jobs:');
  assert.deepEqual(level(jobs), ['check:']);
  const job = level(below(jobs, 'check:'));
  assert.deepEqual(job, ['runs-on: ubuntu-24.04', `timeout-minutes: ${ruleValue('ci-gate-bound', 'minutes') + 2}`, 'steps:']);
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
  assert.notDeepEqual(below(pullRequest, 'on:').map((line) => line.text), ['push:', 'branches:', "- 'gate/**'", "- 'queue/**'"]);
});

// The daily Windows suite (odd/tasks/commit-gates-first.md, S5 and R1): it runs on its schedule and by hand, never
// for a push or a pull request, so it holds up no gate and no land; it reads and names no secret; its actions are
// pinned as the gate's are; one job on an exact Windows image, bounded, running the whole suite.
test('the daily Windows suite runs on its schedule and by hand, and for nothing else', () => {
  const lines = workflowLines(fs.readFileSync(DAILY, 'utf8'));
  assert.deepEqual(level(lines), ['name: windows-daily', 'on:', 'permissions:', 'jobs:']);
  assert.deepEqual(below(lines, 'on:').map((line) => line.text), ['schedule:', "- cron: '23 7 * * *'", 'workflow_dispatch:']);
  assert.deepEqual(below(lines, 'permissions:').map((line) => line.text), ['contents: read']);
});

test('the daily Windows suite is one bounded job on an exact Windows image, with pinned actions and no secret', () => {
  const text = fs.readFileSync(DAILY, 'utf8');
  const lines = workflowLines(text);
  const jobs = below(lines, 'jobs:');
  assert.deepEqual(level(jobs), ['suite:']);
  assert.deepEqual(level(below(jobs, 'suite:')), ['runs-on: windows-2025', 'timeout-minutes: 60', 'steps:']);
  const runs = lines.filter((line) => /^(- )?run:/.test(line.text)).map((line) => line.text.replace(/^(- )?run:\s*/, ''));
  assert.equal(runs.at(-1), 'node --test', 'the last step runs the whole suite');
  // The runner's TEMP is an 8.3 short path that git answers in its long form; the suite runs under the runner's own.
  const suite = below(lines, '- name: The whole suite');
  assert.deepEqual(below(suite, 'env:').map((line) => line.text), ['TEMP: ${{ runner.temp }}', 'TMP: ${{ runner.temp }}']);
  const uses = lines.filter((line) => /^(- )?uses:/.test(line.text)).map((line) => line.text.replace(/^(- )?uses:\s*/, ''));
  const gateUses = workflowLines().filter((line) => /^(- )?uses:/.test(line.text)).map((line) => line.text.replace(/^(- )?uses:\s*/, ''));
  assert.deepEqual(uses, gateUses, 'the same actions at the same commits as the gate');
  assert.doesNotMatch(text, SECRET, 'a secret');
  assert.doesNotMatch(text, /GITHUB_TOKEN|github\.token/, 'the token handed to a step');
  assert.doesNotMatch(text, /persist-credentials:\s*true/);
});

/** The node versions a text names: each `node-version:` value and each `cimg/node:<tag>`, in order. */
const nodeVersions = (text) => [...text.matchAll(/node-version:\s*([\d.]+)|cimg\/node:([\d.]+)/g)].map((match) => match[1] ?? match[2]);

// C-e-1: `engines` names the Node major the gate runs, and the README and the guide say the same. The check is equality,
// not "not above": a minimum below the gate's major promises a Node that no run tests (the defect of 2026-10-24, when
// `>=22` stood against a gate on 24.21.0), and a minimum above it refuses a Node the gate tests as if it were fine.
test('engines names the Node major the gate runs, and the README and the guide say the same', () => {
  const engines = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).engines?.node;
  const minimum = /^>=(\d+)$/.exec(engines ?? '')?.[1];
  assert.ok(minimum !== undefined, `engines.node is ">=<major>", and is ${JSON.stringify(engines)}`);
  const [gateNode] = nodeVersions(fs.readFileSync(GATE, 'utf8'));
  const major = gateNode.split('.')[0];
  assert.equal(minimum, major, `engines promises Node ${minimum} or newer, and the gate runs Node ${gateNode}`);
  for (const file of ['README.md', 'docs/GUIDE.md']) {
    assert.match(fs.readFileSync(path.join(ROOT, file), 'utf8'), new RegExp(`Node ${major} or newer`), `${file} names Node ${major}`);
  }
});

// C-e-14: both workflows say their node is the one the CircleCI image runs, so a bump of one without the other fails here.
test('the workflows set up the node of the CircleCI image, and say so', () => {
  const [image, ...others] = nodeVersions(fs.readFileSync(path.join(ROOT, '.circleci', 'config.yml'), 'utf8'));
  assert.match(image ?? '', /^\d+\.\d+\.\d+$/);
  assert.deepEqual(others, [], 'one cimg/node image in .circleci/config.yml');
  for (const file of [GATE, DAILY]) {
    const versions = nodeVersions(fs.readFileSync(file, 'utf8'));
    assert.ok(versions.length >= 2, `${path.basename(file)} names its node and the image`);
    assert.deepEqual(versions, versions.map(() => image), path.basename(file));
  }
  // The control: a workflow one patch behind the image is caught.
  assert.notDeepEqual(nodeVersions('# cimg/node:24.21.0\nnode-version: 24.20.0'), ['24.21.0', '24.21.0']);
});
