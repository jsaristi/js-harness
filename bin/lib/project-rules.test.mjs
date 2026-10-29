import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRules } from './rules.mjs';
import { RULES } from './rules-data.mjs';
import { checkProjectRules, parseProjectRules, PROJECT_RULES_PATH } from './project-rules.mjs';

// A project's own rules (odd/tasks/project-rules.md, "Design"): in prose, enforced by a sensor, or retired.
const prose = { id: 'no-direct-deploy', subject: 'a deploy goes through the pipeline', since: '2026-10-14', path: 'AGENTS.md', phrases: ['Never deploy by hand'] };
const sensed = { id: 'no-secrets', subject: 'no secret is committed', since: '2026-10-14', sensor: 'secrets' };
const retired = { id: 'old-deploy', subject: 'the old way of deploying', since: '2026-01-02', retired: '2026-10-14', successors: ['no-direct-deploy'] };
const fileOf = (rules, format = 1) => JSON.stringify({ format, rules });
const AGENTS = '# app\n\n## Constraints\n- Never deploy   by hand — the pipeline holds the keys.\n';

/** The input of `checkProjectRules` for a project whose files are `files` and whose sensors are `sensors`. */
function input(text, { files = { 'AGENTS.md': AGENTS }, sensors = ['tests', 'secrets'], headText = null, failureIds = null } = {}) {
  return { text, headText, sensors, failureIds, readFile: (file) => (Object.hasOwn(files, file) ? files[file] : null) };
}

test('the list of a project lives at docs/rules.json', () => {
  assert.equal(PROJECT_RULES_PATH, 'docs/rules.json');
});

// ---- readRules in a project's mode -------------------------------------------------------------------------------

test('a project list of the three bodies, with no owner, reads with no fault', () => {
  assert.deepEqual(readRules([prose, sensed, retired].sort((a, b) => a.id.localeCompare(b.id)), { project: true }), []);
});

test('a project rule may say its owner is project', () => {
  assert.deepEqual(readRules([{ ...prose, owner: 'project' }], { project: true }), []);
});

test('a project rule whose owner is sebastian is refused: a project list holds the project rules', () => {
  assert.deepEqual(readRules([{ ...prose, owner: 'sebastian' }], { project: true }), [
    'rule "no-direct-deploy": the owner is "sebastian": in a project list the owner is project, or it is absent',
  ]);
});

test('each key that only the harness list holds is refused in a project list, with its reason', () => {
  const faults = (extra) => readRules([{ ...prose, ...extra }], { project: true });
  assert.deepEqual(faults({ scope: 'repository' }), ['rule "no-direct-deploy": scope is not for a project list: the list is the project by where it is']);
  assert.deepEqual(faults({ alias: 'x' }), ['rule "no-direct-deploy": alias is not for a project list: only the harness speaks to a host']);
  assert.deepEqual(faults({ flag: '--x' }), ['rule "no-direct-deploy": flag is not for a project list: only a command of the harness parses one']);
  assert.deepEqual(faults({ patterns: ['x'] }), ['rule "no-direct-deploy": patterns is not for a project list: a rule about the code names its sensor']);
  assert.deepEqual(faults({ row: { refuses: '2026-10-14' } }), ['rule "no-direct-deploy": row is not for a project list: a rule about the code names its sensor']);
});

test('a value is refused in a project list, because nothing of the project can read it', () => {
  const { path, phrases, ...rest } = prose;
  assert.deepEqual(readRules([{ ...rest, value: 400, unit: 'lines' }], { project: true }), [
    'rule "no-direct-deploy": value is not for a project list: a value needs a reader, and the project code cannot import the harness; write the rule in prose',
    'rule "no-direct-deploy": unit is not for a project list: a value needs a reader, and the project code cannot import the harness; write the rule in prose',
    'rule "no-direct-deploy": no body: a rule of a project is in prose (a path with phrases), names its sensor, or is retired',
  ]);
});

test('a sensor body is the name of a sensor, and it is one body', () => {
  assert.deepEqual(readRules([{ ...sensed, sensor: '' }], { project: true }), ['rule "no-secrets": the sensor is not the name of a sensor']);
  assert.deepEqual(readRules([{ ...sensed, path: 'AGENTS.md', phrases: ['Never deploy by hand'] }], { project: true }), [
    'rule "no-secrets": more than one body: a rule of a project is in prose (a path with phrases), names its sensor, or is retired',
  ]);
});

test('a failure of the register may be named by a project rule', () => {
  assert.deepEqual(readRules([{ ...sensed, failure: 'secret-leaked' }], { project: true }), []);
});

test('the harness list refuses a sensor body: a rule a sensor enforces is declared by a project', () => {
  const { path, phrases, ...rest } = prose;
  assert.deepEqual(readRules([{ ...rest, owner: 'project', sensor: 'tests' }]).slice(0, 1), [
    'rule "no-direct-deploy": a sensor body is for a project list',
  ]);
});

test('the harness list refuses a control: a harness rule\'s control is in the coverage register', () => {
  const rule = RULES.find((item) => item.id === 'questions-one-place');
  assert.deepEqual(readRules(RULES.map((item) => (item === rule ? { ...rule, control: { level: 'owed', since: '2026-10-28' } } : item))), [
    'rule "questions-one-place": a harness rule\'s control is in bin/lib/rules-coverage-data.mjs, apart from what the rule says',
  ]);
});

test('the shipped list still reads with no fault, by the default call', () => {
  assert.deepEqual(readRules(RULES), []);
});

// ---- parseProjectRules -------------------------------------------------------------------------------------------

test('a list file is parsed to its rules, with a byte-order mark and CRLF read as nothing', () => {
  const text = `﻿${JSON.stringify({ format: 1, rules: [prose] }, null, 2).replace(/\n/g, '\r\n')}`;
  assert.deepEqual(parseProjectRules(text), { rules: [prose], faults: [] });
});

test('a list file that is not JSON is one fault, named with the file', () => {
  const { rules, faults } = parseProjectRules('{ format: 1');
  assert.equal(rules, null);
  assert.equal(faults.length, 1);
  assert.match(faults[0], /^docs\/rules\.json is not JSON: /);
});

test('a list file of a later format is refused by name, with the command that reads it', () => {
  assert.deepEqual(parseProjectRules(fileOf([], 2)), {
    rules: null,
    faults: ['docs/rules.json is format 2, newer than this js-harness reads (format 1): run `js-harness sync`'],
  });
});

test('a list file with no format, a bare list, or a key of its own is refused', () => {
  assert.deepEqual(parseProjectRules('[]').faults, ['docs/rules.json is not { "format": 1, "rules": [...] }']);
  assert.deepEqual(parseProjectRules('{ "rules": [] }').faults, ['docs/rules.json is not { "format": 1, "rules": [...] }']);
  assert.deepEqual(parseProjectRules('{ "format": 1, "rules": [], "x": 1 }').faults, ['docs/rules.json holds the key "x": it holds format and rules only']);
});

// ---- checkProjectRules -------------------------------------------------------------------------------------------

test('a project whose rules all hold has no finding', () => {
  const result = checkProjectRules(input(fileOf([prose, sensed])));
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.rules.map((rule) => rule.id), ['no-direct-deploy', 'no-secrets']);
});

// ---- a project rule's control (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md, S7) ------------------------------------

const CHECKED = { level: 'check', test: 'test/deploy.test.mjs', break: { path: 'scripts/deploy.mjs', find: 'pipeline()', replace: 'byHand()' } };
const PROJECT_FILES = { 'AGENTS.md': AGENTS, 'test/deploy.test.mjs': 'test', 'scripts/deploy.mjs': 'export const go = () => pipeline();\n' };

test('a project rule may name its control; with no baseline recorded the control is optional, and held to its files', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([{ ...prose, control: CHECKED }, sensed]), { files: PROJECT_FILES })).findings, []);
  assert.deepEqual(checkProjectRules(input(fileOf([{ ...prose, control: { ...CHECKED, test: 'test/gone.test.mjs' } }]), { files: PROJECT_FILES })).findings, [
    'rule "no-direct-deploy": the test test/gone.test.mjs is not there',
  ]);
  assert.deepEqual(checkProjectRules(input(fileOf([{ ...prose, control: { level: 'check', test: 'test/deploy.test.mjs' } }]), { files: PROJECT_FILES })).findings, [
    'rule "no-direct-deploy": a check names its planted break { path, find, replace }: a proof that names only a file is refused',
  ]);
});

test('once the project\'s baseline is recorded, every live rule names its control, and only a rule of the baseline is owed', () => {
  const baseline = '2026-10-28';
  const owed = { level: 'owed', since: baseline };
  const result = checkProjectRules({ ...input(fileOf([{ ...prose, control: CHECKED }, sensed, retired]), { files: PROJECT_FILES }), baseline });
  assert.deepEqual(result.findings, [
    'rule "no-secrets": no control: it names a check, an eval case, a line, a protocol, a measurement or a dated owed (the project\'s baseline is 2026-10-28)',
  ]);
  assert.deepEqual(checkProjectRules({ ...input(fileOf([{ ...sensed, since: '2026-11-02', control: owed }]), { files: PROJECT_FILES }), baseline }).findings, [
    'rule "no-secrets": the rule is declared on 2026-11-02, after the baseline of 2026-10-28, so it is not owed: it names its control',
  ]);
});

test('a list that cannot be read gives its faults and no other finding', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([{ ...prose, owner: 'sebastian' }]))).findings, [
    'rule "no-direct-deploy": the owner is "sebastian": in a project list the owner is project, or it is absent',
  ]);
});

test('a phrase no longer in its home is a finding, and so is a home that is gone', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([prose]), { files: { 'AGENTS.md': '# app\n' } })).findings, [
    'rule "no-direct-deploy": AGENTS.md no longer holds the phrase "Never deploy by hand"',
  ]);
  assert.deepEqual(checkProjectRules(input(fileOf([prose]), { files: {} })).findings, [
    'rule "no-direct-deploy": its home AGENTS.md is not there',
  ]);
});

test('a sensor that is no longer declared is a finding that names the sensors there are', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([sensed]), { sensors: ['tests'] })).findings, [
    'rule "no-secrets": the sensor "secrets" is not declared (the sensors are: tests)',
  ]);
});

test('a failure that the register does not hold is a finding, and no register leaves it unchecked', () => {
  const named = { ...sensed, failure: 'secret-leaked' };
  assert.deepEqual(checkProjectRules(input(fileOf([named]), { failureIds: ['other'] })).findings, [
    'rule "no-secrets": the failure "secret-leaked" is not an entry of docs/FAILURES.md',
  ]);
  assert.deepEqual(checkProjectRules(input(fileOf([named]), { failureIds: null })).findings, []);
});

test('a rule of the list at HEAD that is gone now is a finding: it is retired, never deleted', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([sensed]), { headText: fileOf([prose, sensed]) })).findings, [
    'rule "no-direct-deploy" is in the list of HEAD and gone from docs/rules.json: retire it (retired, successors) instead of deleting it',
  ]);
  assert.deepEqual(checkProjectRules(input(fileOf([sensed]), { headText: 'not json' })).findings, []);
});

test('a retired rule is not looked for in its home', () => {
  assert.deepEqual(checkProjectRules(input(fileOf([prose, retired]), { files: { 'AGENTS.md': AGENTS } })).findings, []);
});

test('a project id that the harness also ships is a note, never a finding', () => {
  const same = { ...prose, id: 'gate-wait' };
  const result = checkProjectRules(input(fileOf([same])));
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.notes, ['rule "gate-wait": the harness ships a rule with the same id; `js-harness rules gate-wait` prints both']);
});

test('sensors that cannot be known leave a sensor rule unchecked, and the list is still readable', () => {
  const result = checkProjectRules(input(fileOf([sensed]), { sensors: null }));
  assert.equal(result.readable, true);
  assert.deepEqual(result.findings, []);
});

test('a list that cannot be read is marked so, whether as a file or as rules', () => {
  assert.equal(checkProjectRules(input('{')).readable, false);
  assert.equal(checkProjectRules(input(fileOf([{ ...prose, owner: 'sebastian' }]))).readable, false);
});

// ---- how a project's list reaches an agent, in text it already reads (odd/tasks/project-rules.md, "How it reaches an agent") ----

test('the js-harness skill of both hosts names the rules command and the project list', async () => {
  const { components } = await import('./manifest.mjs');
  for (const id of ['claude-skill', 'codex-skill']) {
    const text = components.find((component) => component.id === id).content('0.0.0');
    assert.match(text, /`js-harness rules`/);
    assert.match(text, /`docs\/rules\.json`/);
  }
});

test('the AGENTS.md template says where a constraint the gate must hold is declared', async () => {
  const { agentsTemplate } = await import('./project.mjs');
  assert.match(agentsTemplate('app'), /^A constraint the gate must hold gets an id in docs\/rules\.json \(`js-harness rules`\)\.$/m);
});
