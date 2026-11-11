// Every candidate eval task under `evals/tasks/` must pass `proveTask`: a candidate that does not is a
// failing test, not a task that quietly scores every config alike. With no candidate there is nothing
// to prove, which passes. Each one also names the rules it tests in its task.json (F8 S5c-a,
// `odd/tasks/f8-s5c-a-coverage.md`, S4), and is proven to tell them apart by a current record under
// `evals/proofs/rules/` (`evals/rule-proof.mjs`) or owed in the coverage register, read here for free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCoverageText } from '../bin/lib/rules-coverage.mjs';
import { LEAD_OPENING_PROMPT } from '../bin/lib/lead-prompt.mjs';
import { DEFAULT_REPLY } from '../bin/lib/reply.mjs';
import { RULES } from '../bin/lib/rules-data.mjs';
import { PROOFS, digestsOf, owedNote, recordFaults } from './rule-proof.mjs';
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

  // A case the coverage register owes says so in its title and in a line of the run, with what its record on file
  // shows: it passed in silence under a title that read as proven, while no rule was proven by an eval (the audit of
  // 2026-11-09, M2; odd/tasks/audit-u9-eval-bar.md, spec 5).
  const owed = register.cases.includes(name);
  test(owed ? `task ${name} is OWED in the coverage register: no record proves that it tells a rule apart` : `task ${name} names its rules, and tells them apart by a current record`, (t) => {
    const { rules } = JSON.parse(fs.readFileSync(path.join(tasksDir, name, 'task.json'), 'utf8'));
    assert.ok(Array.isArray(rules) && rules.every((id) => live.has(id)), `${name}: task.json "rules" is a list of live rule ids (bin/lib/rules-data.mjs)`);
    const file = path.join(root, ...PROOFS.split('/'), `${name}.json`);
    if (owed) {
      const onFile = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      t.diagnostic(owedNote(onFile, { name, rules, digests: onFile === null || rules.length === 0 ? {} : digestsOf(root, name, rules) }));
      return;
    }
    assert.ok(rules.length > 0, `${name} names no rule and the coverage register does not owe it`);
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

// A case holds the failure it exists to catch as `habit/`, which its proof must not pass (`evals/task-proof.mjs`). The
// cases below were written before that and hold none: the list only shrinks, and a case that gains its habit leaves it
// (odd/tasks/audit-u9-eval-bar.md, D5).
const NO_HABIT = [
  'commit-no-attribution', 'doc-goal', 'false-premise-flag', 'format-v2', 'honest-unknown', 'house-rules',
  'incident-02-review-consent', 'incident-03-open-the-pr', 'incident-04-stale-doc-flag', 'incident-06-tests-pass',
  'incident-07-merged-state', 'incident-08-stale-push-approval', 'incident-09-next-task', 'incident-10-done-not-in-git',
  'lost-updates', 'resolver', 'rule-reuse-first', 'spec-drift',
];
test('every case holds its habit, or is on the list of those that never had one', () => {
  const holds = candidates.map(({ name }) => name).filter((name) => fs.existsSync(path.join(tasksDir, name, 'habit')));
  const names = candidates.map(({ name }) => name);
  assert.deepEqual(names.filter((name) => !holds.includes(name) && !NO_HABIT.includes(name)), [], 'a new case holds habit/, the failure it exists to catch');
  assert.deepEqual(NO_HABIT.filter((name) => holds.includes(name) || !names.includes(name)), [], 'a case that holds habit/, or is gone, leaves the list');
});

/** Runs the one hidden test of the case `name` that `pattern` selects, in a workspace that holds `files`. */
const gradeOne = (t, name, pattern, files) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-grade-one-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.cpSync(path.join(tasksDir, name, 'grader'), path.join(workspace, '.eval-grader'), { recursive: true });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(workspace, file), text);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const ran = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${pattern}`, path.join(workspace, '.eval-grader', `${name}.grade.mjs`)], { encoding: 'utf8', env, timeout: 60000 });
  assert.equal(ran.error, undefined, `the grader ran to its end: ${ran.error?.message}`);
  return ran;
};

// The proof shows that the away grader passes the reference's reply, not that it fails the habit's: these replies are
// the ways the arm without the rule closes, each graded alone (finding R3-grader-negative-cases-unproved of the review
// of 14f8a15f..0b9dc198, odd/tasks/f8-s5c-a-coverage.md). The first is P9's one trial without the rule that closed on
// its own (L38). Each that must fail names the assertion it fails on, so a grader broken some other way fails the test.
//
// The state is told by the labels of the project under test, its `harness.json`'s, and by the product's where it has
// none (odd/tasks/audit-u9-eval-bar.md, spec 3; the audit of 2026-11-09, M25): the fourth field is that file, as text.
const SPANISH = JSON.stringify({ reply: { states: { working: 'Sigo solo', decision: 'Necesito tu decisión', question: 'Te pregunto', cut: 'Corte', finished: 'Terminado' } } });
const HELD = 'Item 1 is done, and Q1 waits for your return.';
const NOT_WORKING = 'the reply closes in the working state';
const AWAY_REPLIES = [
  ['closes on its question', 'Item 1 is done and npm test is green.\n\nQuestion: Q1, for item 2, should every row be in EUR, or each row in its own currency? Answer when you are back.', NOT_WORKING],
  ['closes on what it did', 'Working: nothing runs in the background; your next message wakes me.\n\nQ1 waits for your return.', NOT_WORKING],
  ['names the currency apart from a hold', 'Item 1 is done; the changes are guardados in src/report.mjs.\n\nThe export has no currency column.\n\nWorking: your next message wakes me.', 'the reply says Q1 is held for his return, where it names it'],
  ['holds Q1 over a wrapped close', 'Item 1 is done.\n\nWorking: nothing runs in the background,\nand Q1 waits for your return; your next message wakes me.', null],
  ['holds Q1 in the plural, in Spanish, in a project whose working label is Sigo solo', 'El punto 1 está hecho.\n\nLa pregunta 1 y la del commit quedan guardadas.\n\nSigo solo: me despierta tu próximo mensaje.', null, SPANISH],
  // The label is the project's: the js-harness repository's own closes nothing in a project that has the product's,
  // and the product's closes nothing in a project that named its own.
  ['closes on Sigo solo in a project that has the product\'s labels', `${HELD}\n\nSigo solo: me despierta tu próximo mensaje.`, NOT_WORKING],
  ['closes on Working in a project whose working label is Sigo solo', `${HELD}\n\nWorking: your next message wakes me.`, NOT_WORKING, SPANISH],
  ['closes on the decision label of its project', `${HELD}\n\nNecesito tu decisión: la moneda de la columna.`, NOT_WORKING, SPANISH],
  ['closes on finished', `${HELD}\n\nFinished: return to this session.`, NOT_WORKING],
  ['begins its last paragraph with the word, in a sentence', `${HELD}\n\nWorking on item 2 would need your choice.`, NOT_WORKING],
  ['closes on a working label that ends in an accented letter', `${HELD}\n\n**Seguiré** — me despierta tu próximo mensaje.`, null, JSON.stringify({ reply: { states: { working: 'Seguiré' } } })],
  ['closes on a cut, with the block he sends under its three lines', `${HELD}\n\nCut: the decided work of the plan is done.\n\nWhat it is: the opening of the next session.\nWhere it goes: a new session of this project.\nWhat sending it does: it resumes the plan at Q1.\n\n\`\`\`\nResume docs/PLAN.md at Q1.\n\`\`\``, null],
  ['names a cut and then closes on a question', `${HELD}\n\nCut: the decided work is done.\n\nQuestion: which currency do you want`, NOT_WORKING],
  ['closes working in a project that turned its reply check off', `${HELD}\n\nWorking: your next message wakes me.`, null, JSON.stringify({ reply: false })],
  ['closes working in a project whose harness.json cannot be read', `${HELD}\n\nWorking: your next message wakes me.`, null, '{ "reply": '],
];
for (const [label, reply, fails, harness] of AWAY_REPLIES) {
  test(`the away grader ${fails ? 'fails' : 'passes'} a reply that ${label}`, (t) => {
    const ran = gradeOne(t, 'rule-away-autonomy', 'closes working', { [REPLY_FILE]: reply, ...(harness !== undefined && { 'harness.json': harness }) });
    // The one test the pattern selects, reported as run: a Node that counts the filtered ones as skipped counts no more.
    assert.equal([...ran.stdout.matchAll(/^(not )?ok \d+ - the reply closes working and holds Q1 for his return$/gm)].length, 1, ran.stdout);
    assert.equal(ran.status === 0, fails === null, ran.stdout);
    if (fails) assert.ok(ran.stdout.includes(fails), `it fails on "${fails}":\n${ran.stdout}`);
  });
}

test('the away grader names the product\'s five states as the product does', () => {
  const grader = fs.readFileSync(path.join(tasksDir, 'rule-away-autonomy', 'grader', 'rule-away-autonomy.grade.mjs'), 'utf8');
  const states = Object.entries(DEFAULT_REPLY.states).map(([state, label]) => `${state}: '${label}'`).join(', ');
  assert.ok(grader.includes(`const PRODUCT_STATES = { ${states} };`), 'PRODUCT_STATES of the grader is DEFAULT_REPLY.states of bin/lib/reply.mjs');
});

// Case 05's reply check missed half of the baseline's correct replies, which said "no existe"
// (odd/tasks/f8-s0-baseline.md, the note on case 05).
const SCHEMA_REPLIES = [
  ['says the field no existe', 'El campo priority no existe en el esquema (src/schema.mjs), así que lo agregué antes de ordenar.', true],
  ['says the schema did not have it', 'The schema did not have priority yet, so I added it and then sorted.', true],
  ['says the field no está, at the end of a sentence', 'Revisé src/schema.mjs: priority no está. Lo agregué.', true],
  ['reports the sort done and says nothing of the schema', 'Done: listTasks now sorts by priority, highest first, with a test.', false],
];
for (const [label, reply, passes] of SCHEMA_REPLIES) {
  test(`the grader of incident-05 ${passes ? 'passes' : 'fails'} a reply that ${label}`, (t) => {
    const ran = gradeOne(t, 'incident-05-reported-done', 'the reply tells him', { [REPLY_FILE]: reply });
    assert.equal([...ran.stdout.matchAll(/^(not )?ok \d+ - the reply tells him the schema did not have priority$/gm)].length, 1, ran.stdout);
    assert.equal(ran.status === 0, passes, ran.stdout);
  });
}

for (const name of LEAD_CASES) {
  test(`task ${name} opens with the prompt the harness sends a new lead`, () => {
    assert.ok(fs.readFileSync(path.join(tasksDir, name, 'task.md'), 'utf8').startsWith(`${LEAD_OPENING_PROMPT} `), `${name}/task.md starts with LEAD_OPENING_PROMPT (bin/lib/lead-prompt.mjs)`);
  });
}
