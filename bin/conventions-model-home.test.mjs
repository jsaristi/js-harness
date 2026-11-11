// Convention: a model and an effort are written once (odd/tasks/one-model-home.md, spec 2). The rules of the two
// homes declare them, `session-model` at `session-effort` for everything Claude the harness starts and `review-model`
// at `review-effort` for a Codex review, and `bin/lib/model-home.mjs` is how code reads them. On 2026-11-10 the user
// changed model and effort twice in a day, and each change was carried by hand through three constants that no rule
// reached; a constant that is forgotten keeps a launch on the model he left.
//
// How to comply: where code needs the model or the effort of a launch, read `claudeHome()` or `codexHome()` of
// `bin/lib/model-home.mjs` (a guard reads `claudeHeld`), and pass that value on. Do not write a model as a value,
// by its id or by a short name, nor an effort level at a launch (`--effort`, `effort:`, a constant named for one).
//
// Only what a test can see is checked, read from the source with its comment lines left out: a quoted text that is
// a whole Claude or Codex model id, or one of the homes' values as it is written today; a model after `--model` or
// given to a name of model, by its id or by a short name (SHORT_NAMES, and the family of the home's model); and a
// level after `--effort` or given to a name of effort. An id inside a longer text that is no launch, a usage line or
// a message, is prose, which the convention over the texts reads. Every module under `bin/`, `workshop/` and
// `scripts/` is read, at any depth (bin/lib/source.testkit.mjs), the two modules of the home among them; `evals/` is
// not, since its models are what a measurement was or will be made on and `docs/future-model.md` owns changing them.
// LIST is the one file where the values belong. LEGACY lists the modules that still write one, each with why; it
// only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EFFORTS, claudeHome, codexHome } from './lib/model-home.mjs';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { sourceModules, withoutComments } from './lib/source.testkit.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const FOLDERS = ['bin', 'workshop', 'scripts'];
// The list that declares the values: the one module that is not read.
const LIST = 'bin/lib/rules-data.mjs';
// The fewest modules a walk of the three folders gives. They hold over 270 today, so a count under this says the
// walk went wrong, a folder moved or the filter of the testkit changed, and every check below would pass on nothing;
// lower it only if the repository itself shrank that far.
const FLOOR = 100;
// The short names a host has taken for a Claude model. Each gives whatever model the engine in use has for it.
const SHORT_NAMES = ['opus', 'sonnet', 'haiku', 'fable'];

const MODEL_LEGACY = {
  'scripts/practice.mjs': 'a rehearsal host on a cheaper model under a cap of 0.5 USD a run; the user\'s to decide (the feature document, Ask me before, 2)',
  'scripts/rehearsal.mjs': 'a rehearsal host on a cheaper model under a cap of 0.5 USD a run; the user\'s to decide (the feature document, Ask me before, 2)',
};
const EFFORT_LEGACY = {};

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEVEL = `(?:${EFFORTS.join('|')})`;
const QUOTE = '[\'"`]';

const FULL_IDS = ['claude-[a-z]+-\\d[\\w.-]*', 'gpt-\\d[\\w.-]*'];

/** The family of a Claude id, `saga` of `claude-saga-9-1`, in a list that is empty for an id of another shape. */
const familyOf = (id) => /^claude-([a-z]+)-\d/.exec(id)?.slice(1) ?? [];

/** True when `code` holds a model as a value. `models` are the homes' values as they are written, so an id of
 * another shape is found the day it is a home's. Three forms: a quoted text that is a whole Claude or Codex id or
 * one of `models`; an id, one of `models` or a short name after `--model`, as the next argument or in the same text;
 * and a short name, with a bracket or without, given to a key or a constant named for a model. */
function holdsModel(code, models) {
  const ids = [...FULL_IDS, ...models.map(escaped)].join('|');
  const short = [...new Set([...SHORT_NAMES, ...models.flatMap(familyOf)])].join('|');
  const whole = new RegExp(`(${QUOTE})(?:${ids})\\1`);
  const flag = new RegExp(`--model(?:${QUOTE}\\s*,\\s*${QUOTE}|[ =])(?:${ids}|(?:${short})\\b)`);
  const named = new RegExp(`model\\w*${QUOTE}?\\s*[:=]\\s*(${QUOTE})(?:${short})(?:\\[[^\\]]*\\])?\\1`, 'i');
  return whole.test(code) || flag.test(code) || named.test(code);
}

/** True when `code` writes an effort level at a launch: after `--effort`, as the next argument or in the same text,
 * or as what a key or a constant named for an effort is given. */
function holdsEffort(code) {
  const flag = new RegExp(`--effort(?:${QUOTE}\\s*,\\s*${QUOTE}|[ =])${LEVEL}\\b`);
  const named = new RegExp(`effort\\w*${QUOTE}?\\s*[:=]\\s*${QUOTE}${LEVEL}${QUOTE}`, 'i');
  return flag.test(code) || named.test(code);
}

/** Every module the convention reads, as its path from the repository's root: all but LIST. */
function modules() {
  return FOLDERS.flatMap((folder) => sourceModules(path.join(ROOT, folder)).map((name) => `${folder}/${name}`)).filter((name) => name !== LIST);
}

const code = (name) => withoutComments(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const homeModels = () => [claudeHome().model, codexHome().model];

test('the modules of bin, workshop and scripts are read, at any depth, and only the list of rules is left out', () => {
  const read = modules();
  assert.ok(read.length >= FLOOR, `the walk of ${FOLDERS.join(', ')} read only ${read.length} modules, under its floor of ${FLOOR}: it reads less than it should, so no check below holds`);
  for (const folder of FOLDERS) assert.ok(read.some((name) => name.startsWith(`${folder}/`)), `no module of ${folder}/ was read`);
  assert.ok(fs.existsSync(path.join(ROOT, LIST)), `${LIST} is a file of the repository`);
  assert.ok(!read.includes(LIST), `${LIST} is where the values belong`);
  for (const name of ['bin/lib/model-home.mjs', 'bin/lib/model-shape.mjs']) assert.ok(read.includes(name), `${name} is read as any other module`);
});

test('no module writes a model id as a value, but the legacy ones', () => {
  const read = modules();
  const broken = read.filter((name) => holdsModel(code(name), homeModels()));
  const problems = ratchet({ checked: read, broken, legacy: MODEL_LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nread the model from claudeHome() or codexHome() of bin/lib/model-home.mjs`);
});

test('no module writes an effort level at a launch, but the legacy ones', () => {
  const read = modules();
  const broken = read.filter((name) => holdsEffort(code(name)));
  const problems = ratchet({ checked: read, broken, legacy: EFFORT_LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nread the effort from claudeHome() or codexHome() of bin/lib/model-home.mjs`);
});

test('a quoted model id is a value: Claude\'s, Codex\'s, and a home\'s id of another shape', () => {
  assert.ok(holdsModel('const MODEL = \'claude-saga-9-1\';\n', []));
  assert.ok(holdsModel('const ARGS = ["--model", "claude-haiku-4-5-20251001"];\n', []));
  assert.ok(holdsModel('const MODEL = `gpt-7.2-nova`;\n', []));
  // An id with no hyphen and no digit has no shape to know it by: it is found because a home holds it.
  assert.ok(!holdsModel('const MODEL = \'astra\';\n', []));
  assert.ok(holdsModel('const MODEL = \'astra\';\n', ['claude-saga-9-1', 'astra']));
});

test('a short name at a launch is a model written by hand too: after --model, or given to a name of model', () => {
  // The form the launchers held until 2026-11-10: a short name gives whatever model the engine in use has for it.
  assert.ok(holdsModel('const ARGS = [\'--model\', \'opus\'];\n', []));
  assert.ok(holdsModel('const LINE = \'claude -p --model sonnet --effort\';\n', []));
  assert.ok(holdsModel('const LINE = `claude -p --model=claude-saga-9-1 -p`;\n', []));
  assert.ok(holdsModel('const MODEL = \'sonnet\';\n', []));
  assert.ok(holdsModel('start({ model: "opus[1m]" });\n', []));
  assert.ok(holdsModel('const READER_MODEL = \'saga\';\n', ['claude-saga-9-1']), 'the family of the home\'s model is a short name whatever it is');
  assert.ok(!holdsModel('const READER_MODEL = \'saga\';\n', []));
  assert.ok(!holdsModel('const ARGS = [\'--model\', claudeHome().model];\n', ['claude-saga-9-1']));
  assert.ok(!holdsModel('const USAGE = \'[--model <id>]\';\nconst model = \'none\';\nconst opus = \'a work\';\n', []));
});

test('an id inside a longer text, a comment line and a read of the home are no value', () => {
  assert.ok(!holdsModel('const USAGE = \'runs each lens on claude-saga-9-1, one at a time\';\n', ['claude-saga-9-1']));
  assert.ok(!holdsModel(withoutComments('// until 2026-11-10 this was \'claude-saga-9-1\'\nconst MODEL = claudeHome().model;\n'), ['claude-saga-9-1']));
  assert.ok(!holdsModel('const family = \'claude-saga\';\n', []));
});

test('a level after --effort or given to a name of effort is one written at a launch', () => {
  assert.ok(holdsEffort('const ARGS = [\'--effort\', \'high\'];\n'));
  assert.ok(holdsEffort('const LINE = \'claude -p --effort xhigh\';\n'));
  assert.ok(holdsEffort('const LINE = `claude -p --effort=max`;\n'));
  assert.ok(holdsEffort('start({ effort: \'medium\' });\n'));
  assert.ok(holdsEffort('export const LENS_EFFORT = \'high\';\n'));
  assert.ok(holdsEffort('const input = { "effort": "low" };\n'));
});

test('an effort read from the home, a level that is no launch and a word that is no level are not', () => {
  assert.ok(!holdsEffort('const ARGS = [\'--effort\', claudeHome().effort];\n'));
  assert.ok(!holdsEffort('const { effort } = claudeHome();\nstart({ effort });\n'));
  assert.ok(!holdsEffort('const priority = \'high\';\n'));
  assert.ok(!holdsEffort('const effort = \'highest\';\n'));
});
