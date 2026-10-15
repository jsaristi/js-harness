// What bounds a run of the gate on CircleCI is written in `.circleci/config.yml`. CircleCI builds every push
// of every branch unless the config says otherwise, and a status it posts on the commit of a pull request
// moves GitHub's merge state of that pull request off CLEAN, which the lead's keeper requires of a pull
// request of documents (odd/tasks/merge-queue.md). The free plan has 30,000 credits a month and no card. So
// the file is held here to one job, on one fixed image and size, run only for the merge queue's candidate
// branches (`queue/*`), with no secret and no parallelism until its billing is measured. Zero deps: the
// file is read as text, by the few shapes it is allowed to take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, '.circleci', 'config.yml');

/** The config without its comments and blank lines, as `[{ indent, text }]`. */
function configLines() {
  return fs.readFileSync(CONFIG, 'utf8').split(/\r?\n/)
    .map((line) => line.replace(/(^|\s)#.*$/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line) => ({ indent: line.length - line.trimStart().length, text: line.trim() }));
}

/** The lines below the first line that reads `key`, down to the next line indented no deeper. */
function below(lines, key) {
  const at = lines.findIndex((line) => line.text === key);
  assert.notEqual(at, -1, `the config has a line \`${key}\``);
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => line.indent <= lines[at].indent);
  return end === -1 ? rest : rest.slice(0, end);
}

const level = (lines, indent) => lines.filter((line) => line.indent === indent).map((line) => line.text);

test('the config is version 2.1 with one job and one workflow, and nothing else at the top', () => {
  const lines = configLines();
  assert.deepEqual(level(lines, 0), ['version: 2.1', 'jobs:', 'workflows:']);
  const jobs = below(lines, 'jobs:');
  assert.deepEqual(level(jobs, jobs[0].indent), ['check:']);
});

test('the job runs the gate on a fixed image and size: an exact node image, medium, no parallelism', () => {
  const job = below(configLines(), 'check:');
  const texts = job.map((line) => line.text);
  const image = texts.find((text) => text.startsWith('- image:'));
  assert.match(image ?? '', /^- image: cimg\/node:\d+\.\d+\.\d+$/, 'an exact tag, never a moving one');
  assert.ok(texts.includes('resource_class: medium'), 'medium is 10 credits a minute on the free plan');
  assert.ok(!texts.some((text) => text.startsWith('parallelism:')), 'no parallelism before its billing is measured');
  assert.ok(texts.includes('- checkout'));
  assert.ok(texts.some((text) => text === 'command: node bin/check.mjs'), 'the gate, as on GitHub');
  assert.ok(texts.some((text) => /^no_output_timeout: \d+m$/.test(text)), 'a run that hangs is stopped');
});

test('the workflow runs the job only for the merge queue\'s branches, with no secret and no schedule', () => {
  const lines = configLines();
  const workflow = below(lines, 'workflows:');
  const texts = workflow.map((line) => line.text);
  assert.ok(texts.includes('only: /^queue\\/.*/'), 'only queue/* branches: no status on any other pull request');
  assert.ok(!texts.some((text) => /^(triggers|schedule|cron):/.test(text)), 'no scheduled run');
  assert.ok(!lines.some((line) => /^-?\s*context:/.test(line.text)), 'no context: the run needs no secret');
});
