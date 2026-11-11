// Convention: a model and an effort are written once (odd/tasks/one-model-home.md, spec 2). The rules of the two
// homes declare them, `session-model` at `session-effort` for everything Claude the harness starts and `review-model`
// at `review-effort` for a Codex review, and `bin/lib/model-home.mjs` is how code reads them. On 2026-11-10 the user
// changed model and effort twice in a day, and each change was carried by hand through three constants that no rule
// reached; a constant that is forgotten keeps a launch on the model he left.
//
// How to comply: where code needs the model or the effort of a launch, read `claudeHome()` or `codexHome()` of
// `bin/lib/model-home.mjs` (a guard reads `claudeHeld`), and pass that value on. Do not write a model id as a
// value, nor an effort level at a launch (`--effort`, `effort:`, a constant named for an effort).
//
// Only what a test can see is checked: a quoted text that is a whole Claude or Codex model id, or one of the homes'
// values as it is written today, and a level beside a name of effort, read from the source with its comment lines
// left out. An id inside a longer text, a usage line or a message, is prose, which the convention over the texts
// reads. Every module under `bin/`, `workshop/` and `scripts/` is read, at any depth (bin/lib/source.testkit.mjs);
// `evals/` is not, since its models are what a measurement was or will be made on and `docs/future-model.md` owns
// changing them. HOME names the two files where the values belong. LEGACY lists the modules that still write one,
// each with why; it only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EFFORTS, claudeHome, codexHome } from './lib/model-home.mjs';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { sourceModules, withoutComments } from './lib/source.testkit.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const FOLDERS = ['bin', 'workshop', 'scripts'];
// The list that declares the values, and the module that names their shape and their levels.
const HOME = ['bin/lib/rules-data.mjs', 'bin/lib/model-home.mjs'];

const MODEL_LEGACY = {
  'bin/double-review.mjs': 'CLAUDE_FALLBACK, the reader\'s model where a project declares no rule, written by hand',
  'bin/lens-review.mjs': 'LENS_MODEL, written by hand',
  'scripts/practice.mjs': 'a rehearsal host on a cheaper model under a cap of 0.5 USD a run; the user\'s to decide (the feature document, Ask me before, 2)',
  'scripts/rehearsal.mjs': 'a rehearsal host on a cheaper model under a cap of 0.5 USD a run; the user\'s to decide (the feature document, Ask me before, 2)',
};
const EFFORT_LEGACY = {
  'bin/lens-review.mjs': 'LENS_EFFORT, written by hand',
};

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEVEL = `(?:${EFFORTS.join('|')})`;
const QUOTE = '[\'"`]';

/** True when `code` holds a model id as a value: a quoted text that is a whole Claude or Codex id, or one of
 * `models`, the homes' values as they are written, so an id of another shape is found the day it is a home's. */
function holdsModel(code, models) {
  const ids = ['claude-[a-z]+-\\d[\\w.-]*', 'gpt-\\d[\\w.-]*', ...models.map(escaped)];
  return new RegExp(`(${QUOTE})(?:${ids.join('|')})\\1`).test(code);
}

/** True when `code` writes an effort level at a launch: after `--effort`, as the next argument or in the same text,
 * or as what a key or a constant named for an effort is given. */
function holdsEffort(code) {
  const flag = new RegExp(`--effort(?:${QUOTE}\\s*,\\s*${QUOTE}|[ =])${LEVEL}\\b`);
  const named = new RegExp(`effort\\w*${QUOTE}?\\s*[:=]\\s*${QUOTE}${LEVEL}${QUOTE}`, 'i');
  return flag.test(code) || named.test(code);
}

/** Every module the convention reads, as its path from the repository's root, but the two of HOME. */
function modules() {
  return FOLDERS.flatMap((folder) => sourceModules(path.join(ROOT, folder)).map((name) => `${folder}/${name}`)).filter((name) => !HOME.includes(name));
}

const code = (name) => withoutComments(fs.readFileSync(path.join(ROOT, name), 'utf8'));
const homeModels = () => [claudeHome().model, codexHome().model];

test('the modules of bin, workshop and scripts are read, at any depth, and the two of the home are left out', () => {
  const read = modules();
  assert.ok(read.length >= 250, `only ${read.length} modules were read`);
  for (const folder of FOLDERS) assert.ok(read.some((name) => name.startsWith(`${folder}/`)), `no module of ${folder}/ was read`);
  for (const name of HOME) {
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} is a file of the repository`);
    assert.ok(!read.includes(name), `${name} is where the values belong`);
  }
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
