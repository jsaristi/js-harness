// Every candidate eval task under `evals/tasks/` must pass `proveTask`: a candidate that does not is a
// failing test, not a task that quietly scores every config alike. With no candidate there is nothing
// to prove, which passes. Each one also names the rules it tests in its task.json (F8 S5c-a,
// `odd/tasks/f8-s5c-a-coverage.md`, S4), and is proven to tell them apart by a current record under
// `evals/proofs/rules/` (`evals/rule-proof.mjs`) or owed in the coverage register, read here for free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCoverageText } from '../bin/lib/rules-coverage.mjs';
import { LEAD_OPENING_PROMPT } from '../bin/lib/lead-prompt.mjs';
import { RULES } from '../bin/lib/rules-data.mjs';
import { PROOFS, digestsOf, recordFaults } from './rule-proof.mjs';
import { proveTask } from './task-proof.mjs';
import { REPLY_FILE } from './task-script.mjs';

const tasksDir = fileURLToPath(new URL('./tasks/', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
const { register } = readCoverageText(fs.readFileSync(path.join(root, 'bin', 'lib', 'rules-coverage-data.mjs'), 'utf8'));
// The cases whose rule lives only in the orchestrator skill: each opens as a real lead does, with the prompt the harness
// sends one, which loads that skill on its own (odd/tasks/f8-s5c-a-coverage.md, L30), so the trial reads the rule.
const LEAD_CASES = ['rule-away-autonomy'];
const live = new Set(RULES.filter((rule) => !Object.hasOwn(rule, 'retired')).map((rule) => rule.id));

for (const { name } of candidates) {
  // A proof runs several node processes (three graders, two visible suites), each with its own cleanup.
  test(`task ${name} is proven`, { timeout: 5 * 60 * 1000 }, async () => {
    assert.deepEqual((await proveTask(path.join(tasksDir, name))).problems, []);
  });

  test(`task ${name} names its rules, and tells them apart by a current record or owes it`, () => {
    const { rules } = JSON.parse(fs.readFileSync(path.join(tasksDir, name, 'task.json'), 'utf8'));
    assert.ok(Array.isArray(rules) && rules.every((id) => live.has(id)), `${name}: task.json "rules" is a list of live rule ids (bin/lib/rules-data.mjs)`);
    if (register.cases.includes(name)) return;
    assert.ok(rules.length > 0, `${name} names no rule and the coverage register does not owe it`);
    const file = path.join(root, ...PROOFS.split('/'), `${name}.json`);
    assert.ok(fs.existsSync(file), `${name} names ${rules.join(', ')} and has no record at ${PROOFS}/${name}.json: run its proof (evals/rule-proof.mjs)`);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(recordFaults(record, { name, rules, digests: digestsOf(root, name, rules) }), []);
  });

  // The proof grades the reference's own reply file, and a trial's comes from the runner only for a task that asks:
  // without the flag every trial is graded on no reply and the proof still passes (odd/tasks/f8-s5c-a-coverage.md, L36).
  test(`task ${name} asks the runner for the agent's reply when its reference holds one`, () => {
    if (!fs.existsSync(path.join(tasksDir, name, 'reference', REPLY_FILE))) return;
    assert.equal(JSON.parse(fs.readFileSync(path.join(tasksDir, name, 'task.json'), 'utf8')).reply, true, `${name}/task.json sets "reply": true`);
  });
}

for (const name of LEAD_CASES) {
  test(`task ${name} opens with the prompt the harness sends a new lead`, () => {
    assert.ok(fs.readFileSync(path.join(tasksDir, name, 'task.md'), 'utf8').startsWith(`${LEAD_OPENING_PROMPT} `), `${name}/task.md starts with LEAD_OPENING_PROMPT (bin/lib/lead-prompt.mjs)`);
  });
}
