import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readProjectRules } from './project-rules-read.mjs';

const prose = { id: 'no-direct-deploy', subject: 'a deploy goes through the pipeline', since: '2026-10-14', path: 'AGENTS.md', phrases: ['Never deploy by hand'] };
const sensed = { id: 'no-secrets', subject: 'no secret is committed', since: '2026-10-14', sensor: 'secrets', failure: 'secret-leaked' };
const listOf = (rules) => JSON.stringify({ format: 1, rules }, null, 2);

/** A git repository in a new temporary folder, with `files` written and, when `commit`, committed. */
function project(t, files, { commit = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-rules-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  write(root, files);
  if (commit) {
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
  }
  return root;
}

function write(root, files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
}

const REGISTER = '# Failures\n\n## Classes\n\n- `leak`: a secret reaches the repository.\n\n## Entries\n\n### secret-leaked\nA key was committed.\n- Class: leak\n- Seen: 2026-10-14 — the log of the commit — a key in a commit\n';

test('the register of the fixture parses, so its ids are read', async () => {
  const { parseRegister } = await import('./failures.mjs');
  assert.deepEqual(parseRegister(REGISTER).errors, []);
});

test('a project with no docs/rules.json keeps no list', (t) => {
  assert.deepEqual(readProjectRules(project(t, { 'AGENTS.md': '# x\n' })), { present: false });
});

test('a list that holds, read from the files, has no finding', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' });
  const result = readProjectRules(root);
  assert.equal(result.present, true);
  assert.deepEqual(result.findings, []);
});

test('a phrase deleted from AGENTS.md is a finding read from the file', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '# x\n' });
  assert.deepEqual(readProjectRules(root).findings, ['rule "no-direct-deploy": AGENTS.md no longer holds the phrase "Never deploy by hand"']);
});

test('a rule committed at HEAD and deleted from the list since is a finding', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' }, { commit: true });
  write(root, { 'docs/rules.json': listOf([]) });
  assert.deepEqual(readProjectRules(root).findings, [
    'rule "no-direct-deploy" is in the list of HEAD and gone from docs/rules.json: retire it (retired, successors) instead of deleting it',
  ]);
});

test('a list committed at HEAD and deleted whole is a finding for each of its rules, as if each were deleted', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose, sensed]), 'AGENTS.md': '- Never deploy by hand.\n' }, { commit: true });
  fs.rmSync(path.join(root, 'docs', 'rules.json'));
  const result = readProjectRules(root, { sensors: ['secrets'] });
  assert.equal(result.present, true);
  assert.deepEqual(result.findings, [
    'rule "no-direct-deploy" is in the list of HEAD and gone from docs/rules.json: retire it (retired, successors) instead of deleting it',
    'rule "no-secrets" is in the list of HEAD and gone from docs/rules.json: retire it (retired, successors) instead of deleting it',
  ]);
});

test('a project whose HEAD has no list either still keeps no list', (t) => {
  assert.deepEqual(readProjectRules(project(t, { 'AGENTS.md': '# x\n' }, { commit: true })), { present: false });
});

test('the sensors named by the caller and the register of the project are what a rule is held to', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([sensed]), 'docs/FAILURES.md': REGISTER });
  assert.deepEqual(readProjectRules(root, { sensors: ['secrets'] }).findings, []);
  assert.deepEqual(readProjectRules(root, { sensors: [] }).findings, ['rule "no-secrets": the sensor "secrets" is not declared (none is declared)']);
  write(root, { 'docs/FAILURES.md': REGISTER.replace('secret-leaked', 'other-leak') });
  assert.deepEqual(readProjectRules(root, { sensors: ['secrets'] }).findings, ['rule "no-secrets": the failure "secret-leaked" is not an entry of docs/FAILURES.md']);
});

test('the baseline the project manifest records makes every live rule name its control', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' });
  assert.deepEqual(readProjectRules(root).findings, [], 'no manifest, no baseline');
  write(root, { '.git/js-harness/manifest.json': JSON.stringify({ version: '0.98.0', coverage: { baseline: '2026-10-28', release: '0.98.0' } }) });
  assert.deepEqual(readProjectRules(root).findings, [
    "rule \"no-direct-deploy\": no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed (the project's baseline is 2026-10-28)",
  ]);
  write(root, { 'docs/rules.json': listOf([{ ...prose, control: { level: 'line', path: 'AGENTS.md', phrase: 'Never deploy by hand' } }]) });
  assert.deepEqual(readProjectRules(root).findings, []);
  write(root, { '.git/js-harness/manifest.json': JSON.stringify({ version: '0.98.0', coverage: { baseline: 'soon' } }) });
  assert.throws(() => readProjectRules(root), /coverage record .* is not \{ baseline, release \}/);
});

test('a manifest that does not parse, or is no object, is said as the manifest, never a raw parse error', (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' });
  for (const text of ['{ not json', 'null', '[]']) {
    write(root, { '.git/js-harness/manifest.json': text });
    assert.throws(() => readProjectRules(root), (err) => err.constructor === Error && /the project manifest .*manifest\.json is not a JSON object/.test(err.message), text);
  }
});
