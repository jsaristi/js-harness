import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAILURES_TEMPLATE, agentsTemplate, claudeTemplate } from './project.mjs';
import { projectCoverage, projectCoverageForm } from './project-coverage.mjs';
import { spanId } from './rules-coverage.mjs';

// F8 S5c-a (`odd/tasks/f8-s5c-a-coverage.md`, S7): in a project, each span of a text `init` wrote is bound to the
// harness's proof while it is the harness's text, and is on the project's side once the project edits it.

const RECORD = { baseline: '2026-10-28', release: '0.98.0' };
const ADDED = 'Deploys run from the pipeline only.';

test('a span init wrote is bound while the project keeps its words; an edit or a new span is the project\'s side', () => {
  const agents = agentsTemplate('app');
  const files = { 'AGENTS.md': `${agents}\n${ADDED}\n`, 'CLAUDE.md': claudeTemplate(), 'docs/FAILURES.md': null };
  const report = projectCoverage({ record: RECORD, version: '0.98.0', name: 'app', readFile: (file) => files[file] ?? null });
  assert.deepEqual(report.release, { recorded: '0.98.0', running: '0.98.0' });
  const [first, second, third] = report.files;
  assert.deepEqual([first.path, first.present, first.own.map((span) => span.id)], ['AGENTS.md', true, [spanId(ADDED)]]);
  assert.ok(first.bound > 5, `${first.bound} spans bound`);
  assert.deepEqual([second.path, second.own], ['CLAUDE.md', []]);
  assert.deepEqual([third.path, third.present], ['docs/FAILURES.md', false]);
  assert.equal(projectCoverage({ record: RECORD, version: '0.98.0', name: 'app', readFile: (file) => (file === 'docs/FAILURES.md' ? FAILURES_TEMPLATE : null) }).files[2].own.length, 0);
});

/** A git repository in a new temporary folder named `app`, with `files` written. */
function project(t, files) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'project-coverage-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'app');
  fs.mkdirSync(root);
  spawnSync('git', ['init', '-q'], { cwd: root });
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}
const run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true });
const form = (parsed, root) => {
  const out = [];
  const code = projectCoverageForm(parsed, root, { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line), version: '0.98.0' });
  return { code, out, all: out.join('\n') };
};

test('rules coverage in a project says each text init wrote, the project\'s side and its rules\' controls; --strict holds the controls', (t) => {
  const prose = { id: 'no-direct-deploy', subject: 'a deploy goes through the pipeline', since: '2026-10-14', path: 'AGENTS.md', phrases: ['Deploys run from the pipeline only'] };
  const root = project(t, {
    'AGENTS.md': `${agentsTemplate('app')}\n${ADDED}\n`,
    'docs/rules.json': JSON.stringify({ format: 1, rules: [prose] }),
    '.git/js-harness/manifest.json': JSON.stringify({ version: '0.98.0', coverage: RECORD }),
  });
  const plain = form({ command: 'coverage' }, root);
  assert.equal(plain.code, 0, plain.all);
  assert.ok(plain.out.includes('Directive coverage of this project, from its baseline of 2026-10-28 (set by js-harness 0.98.0; this is 0.98.0):'), plain.all);
  assert.ok(plain.out.some((line) => /^ {2}AGENTS\.md: \d+ spans bound to the harness's proof, 1 on the project's side$/.test(line)), plain.all);
  assert.ok(plain.out.includes(`    ${spanId(ADDED)}: "${ADDED}"`), plain.all);
  const strict = form({ command: 'coverage', strict: true }, root);
  assert.equal(strict.code, 1, strict.all);
  assert.ok(strict.out.some((line) => line.includes('rule "no-direct-deploy": no control')), strict.all);
  assert.equal(form({ command: 'coverage', refresh: true }, root).code, 1, 'a project has no register to refresh');
});

test('rules coverage --prove --json prints one JSON document, each planted break\'s proof in it', (t) => {
  const control = { level: 'check', test: 'held.test.mjs', break: { path: 'value.mjs', find: 'value = 1', replace: 'value = 2' } };
  const root = project(t, {
    'value.mjs': 'export const value = 1;\n',
    'held.test.mjs': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from './value.mjs';\ntest('held', () => assert.equal(value, 1));\n",
    'docs/rules.json': JSON.stringify({ format: 1, rules: [{ id: 'value-one', subject: 'the value is one', since: '2026-10-14', sensor: 'held', control }] }),
  });
  for (const strict of [false, true]) {
    const { code, out, all } = form({ command: 'coverage', prove: true, json: true, strict }, root);
    assert.equal(out.length, 1, all);
    const document = JSON.parse(out[0]);
    assert.deepEqual(document.proofs.map((proof) => [proof.rule, proof.red]), [['value-one', true]]);
    assert.equal(code, strict && document.findings.length > 0 ? 1 : 0, all);
  }
  // A check that names no break is a finding, and its proof proves nothing; neither stops the document.
  const unplanted = { id: 'no-break', subject: 'a check with no break', since: '2026-10-14', sensor: 'held', control: { level: 'check', test: 'held.test.mjs' } };
  fs.writeFileSync(path.join(root, 'docs', 'rules.json'), JSON.stringify({ format: 1, rules: [unplanted] }));
  const { code, out, all } = form({ command: 'coverage', prove: true, json: true }, root);
  assert.equal(code, 1, all);
  const document = JSON.parse(out[0]);
  assert.deepEqual(document.proofs.map((proof) => [proof.rule, proof.red, proof.baseline]), [['no-break', false, 'malformed']]);
  assert.ok(document.findings.some((finding) => finding.startsWith('rule "no-break"')), all);
});

test('rules coverage --strict in a project holds a rule to the sensors check runs there, as rules check does', async (t) => {
  const control = { level: 'line', path: 'AGENTS.md', phrase: 'Deploys run from the pipeline only' };
  const root = project(t, {
    'AGENTS.md': `${agentsTemplate('app')}\n${ADDED}\n`,
    'harness.json': JSON.stringify({ sensors: { tests: 'node --test' } }),
    'docs/rules.json': JSON.stringify({ format: 1, rules: [{ id: 'gone-sensor', subject: 'a sensor that is not there', since: '2026-10-14', sensor: 'nope', failure: 'x', control }] }),
  });
  const out = [];
  const { rulesMain } = await import('../rules.mjs');
  const code = await rulesMain(['coverage', '--strict'], { cwd: root, root, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  assert.equal(code, 1, out.join('\n'));
  assert.ok(out.some((line) => line.includes('rule "gone-sensor": the sensor "nope" is not declared')), out.join('\n'));
});

test('a project with no coverage record says init records it, and holds no rule to a control', async (t) => {
  const root = project(t, { 'AGENTS.md': agentsTemplate('app') });
  const plain = form({ command: 'coverage', strict: true }, root);
  assert.equal(plain.code, 0, plain.all);
  assert.ok(plain.out[0].startsWith('This project records no coverage baseline'), plain.all);
  const out = [];
  const { rulesMain } = await import('../rules.mjs');
  assert.equal(await rulesMain(['coverage'], { cwd: root, root, stdout: (line) => out.push(line), stderr: (line) => out.push(line) }), 0, 'the command sends a project to this form');
  assert.ok(out[0].startsWith('This project records no coverage baseline'), out.join('\n'));
});
