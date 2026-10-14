// `js-harness rules` run in a project that installs the harness: its own list, docs/rules.json, beside the rules of the
// harness in force there (odd/tasks/project-rules.md, "How it is checked"). In the harness's own repository the command
// is what bin/rules.test.mjs holds it to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rulesMain } from './rules.mjs';
import { RULES } from './lib/rules-data.mjs';

const prose = { id: 'no-direct-deploy', subject: 'a deploy goes through the pipeline', since: '2026-10-14', path: 'AGENTS.md', phrases: ['Never deploy by hand'] };
const listOf = (rules) => JSON.stringify({ format: 1, rules }, null, 2);
const inForce = RULES.filter((rule) => rule.scope === undefined);

/** A git repository in a new temporary folder holding `files`, with a subfolder `sub`. */
function project(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-project-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'sub'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

async function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = await rulesMain(argv, { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line) });
  return { code, out, err };
}

test('rules in a project lists the harness rules in force there, then the project own, from any folder of it', async (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' });
  const { code, out } = await run([], path.join(root, 'sub'));
  assert.equal(code, 0);
  assert.equal(out[0], 'The rules of the harness in force here:');
  assert.deepEqual(out.slice(1, 1 + inForce.length).map((line) => line.split('  ')[0]), inForce.map((rule) => rule.id));
  assert.deepEqual(out.slice(1 + inForce.length), [
    'This project\'s own rules (docs/rules.json):',
    'no-direct-deploy  prose, AGENTS.md  project',
    '1 rule of the project',
  ]);
});

test('rules in a project with no list says it declares none', async (t) => {
  const { code, out } = await run([], project(t, {}));
  assert.equal(code, 0);
  assert.equal(out.at(-1), 'This project declares no rules of its own: they would be in docs/rules.json');
});

test('rules check in a project passes when its rules hold, and fails with each finding when one does not', async (t) => {
  const root = project(t, { 'docs/rules.json': listOf([prose]), 'AGENTS.md': '- Never deploy by hand.\n' });
  assert.deepEqual(await run(['check'], root), { code: 0, out: ['PASS  rules  1 rule of the project holds'], err: [] });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# x\n');
  assert.deepEqual(await run(['check'], root), {
    code: 1,
    out: ['FAIL  rules  1 finding', '      rule "no-direct-deploy": AGENTS.md no longer holds the phrase "Never deploy by hand"'],
    err: [],
  });
});

test('rules check in a project with no list passes and says there is nothing to check', async (t) => {
  assert.deepEqual(await run(['check'], project(t, {})), { code: 0, out: ['PASS  rules  no docs/rules.json: this project declares no rules of its own'], err: [] });
});

test('rules check in a project holds a sensor rule to the sensors check runs there', async (t) => {
  const sensed = { id: 'no-secrets', subject: 'no secret is committed', since: '2026-10-14', sensor: 'secrets' };
  const root = project(t, { 'docs/rules.json': listOf([sensed]), 'harness.json': JSON.stringify({ sensors: { tests: 'node --test' } }) });
  assert.equal((await run(['check'], root)).out[1], '      rule "no-secrets": the sensor "secrets" is not declared (the sensors are: tests)');
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({ sensors: { tests: 'node --test', secrets: 'node scan.mjs' } }));
  assert.equal((await run(['check'], root)).code, 0);
});

test('rules <id> in a project prints the project rule, both when the harness ships the same id, and fails on neither', async (t) => {
  const same = { ...prose, id: 'gate-wait' };
  const root = project(t, { 'docs/rules.json': listOf([prose, same].sort((a, b) => a.id.localeCompare(b.id))), 'AGENTS.md': '- Never deploy by hand.\n' });
  const own = await run(['no-direct-deploy'], root);
  assert.equal(own.code, 0);
  assert.equal(own.out[0], 'This project\'s rule (docs/rules.json):');
  assert.deepEqual(JSON.parse(own.out.slice(1).join('\n')), prose);
  const both = await run(['gate-wait'], root);
  assert.equal(both.code, 0);
  assert.equal(both.out[0], 'The harness\'s rule:');
  assert.ok(both.out.includes('This project\'s rule (docs/rules.json):'));
  assert.deepEqual(await run(['no-such-rule'], root), { code: 1, out: [], err: ['no rule "no-such-rule" is declared, by the harness or by this project'] });
});

test('rules render in a project is refused: it writes the harness list, in the harness repository', async (t) => {
  assert.deepEqual(await run(['render'], project(t, {})), {
    code: 1,
    out: [],
    err: ['rules render writes the harness\'s docs/RULES.md and runs only in the harness\'s own repository; a project\'s list is printed by `js-harness rules`'],
  });
});

test('a list that cannot be read fails the check with its fault, and the listing says so', async (t) => {
  const root = project(t, { 'docs/rules.json': '{ not json' });
  const checked = await run(['check'], root);
  assert.equal(checked.code, 1);
  assert.match(checked.out[1], /^ {6}docs\/rules\.json is not JSON: /);
  const listed = await run([], root);
  assert.equal(listed.code, 1);
  assert.match(listed.err[0], /^docs\/rules\.json is not JSON: /);
});

test('in the harness repository, a docs/rules.json is a finding: the shipped list is its one home', async (t) => {
  const root = project(t, { 'docs/rules.json': listOf([]) });
  const out = [];
  const code = await rulesMain(['check'], { root, stdout: (line) => out.push(line), stderr: () => {} });
  assert.equal(code, 1);
  assert.ok(out.includes('      docs/rules.json is a project\'s list: in the harness\'s own repository the rules live in bin/lib/rules-data.mjs'), out.join('\n'));
});
