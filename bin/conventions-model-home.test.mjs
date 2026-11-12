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
// a message, is prose, which the convention over the texts reads (below, with its own header). Every module under `bin/`, `workshop/` and
// `scripts/` is read, at any depth (bin/lib/source.testkit.mjs), the two modules of the home among them; `evals/` is
// not, since its models are what a measurement was or will be made on and `docs/future-model.md` owns changing them.
// LIST is the one file where the values belong. LEGACY lists the modules that still write one, each with why; it
// only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_HOME, CODEX_HOME, EFFORTS, claudeHome, codexHome } from './lib/model-home.mjs';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { RULES } from './lib/rules-data.mjs';
import { inForceLines } from './lib/rules-scan.mjs';
import { sourceModules, withoutComments } from './lib/source.testkit.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const FOLDERS = ['bin', 'workshop', 'scripts'];
// The list that declares the values: the one module that is not read.
const LIST = 'bin/lib/rules-data.mjs';
// The fewest modules a walk of each folder gives, about a tenth under what it held on 2026-11-11 (277, 18 and 23).
// A count under its floor says the walk went wrong, a subfolder was not entered or the filter of the testkit
// changed, and every check below would pass on less than the code; lower one only when its folder really shrank.
const FLOORS = { bin: 250, workshop: 15, scripts: 20 };
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
  assert.deepEqual(Object.keys(FLOORS), FOLDERS);
  for (const folder of FOLDERS) {
    const count = read.filter((name) => name.startsWith(`${folder}/`)).length;
    assert.ok(count >= FLOORS[folder], `the walk of ${folder}/ read only ${count} modules, under its floor of ${FLOORS[folder]}: it reads less than the code, so no check below holds`);
  }
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

// ── the texts (odd/tasks/one-model-home.md, spec 4) ─────────────────────────────────────────────
//
// Convention: a text in force that states a model or an effort names the rule and does not repeat its value, so a
// switch of a home changes no document. On 2026-11-10 the roadmap's Decided row still gave the model of a month
// before, a writer on a cheaper one, while the rules it marked said another.
//
// How to comply: where the value would go, write `rule:session-model`, `rule:session-effort`, `rule:lead-effort`,
// `rule:review-model` or `rule:review-effort`; a sample of output shows `<model>` and `<effort>`; a help text that
// must show the value prints it from the home.
//
// What is read, fences included, since a sample restates a value as prose does: the eight texts of TEXTS, for a
// Claude model id, a value Codex's home holds or held (its `was`), a model's family with its version ("Saga 9.1")
// and a level beside the word effort; and each feature document above its Log, for a value Codex's home holds or
// held alone, since the patterns of its rules find only an id with a hyphen and a digit. DATED lists the lines that
// stay, by a piece of each that names it, with its day and why: the conclusion of a past measurement, the sample of
// a host's attribution line. DATED_DOCUMENTS lists the feature documents that say what Codex ran on when they were
// written. Both only shrink.
const TEXTS = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'docs/SPEC.md', 'docs/GUIDE.md', 'docs/README.md', 'docs/future-model.md', 'docs/ROADMAP.md'];
const ATTRIBUTION = 'the sample of a host\'s attribution line that the commit-msg hook removes: the name a host signs with, not a pick';
const DATED = {
  'README.md: alone or with a model: `Claude Opus 5.5`,': `2026-10-20: ${ATTRIBUTION}`,
  'README.md: $ git commit -m "fix: a change" -m "Co-Authored-By: Claude Opus 5.5': `2026-10-20: ${ATTRIBUTION}`,
  'README.md: js-harness commit-msg: removed the host\'s attribution lines: Co-Authored-By: Claude Opus 5.5': `2026-10-20: ${ATTRIBUTION}`,
  'docs/future-model.md: Claude: F5 on Opus 5.5, at `medium` its 30 trials cost': '2026-10-14: the conclusion of a past measurement, the model F5\'s trials ran on',
  'docs/future-model.md: Codex: F6 on `gpt-6.1-sol`,': '2026-10-14: the conclusion of a past measurement, the model F6\'s trials ran on',
  'docs/ROADMAP.md: or after two compactions; Haiku 5.5 helpers with': '2026-10-28: what a past design of F8 proposed, kept as it was written',
  'docs/ROADMAP.md: scores the same on Haiku 5.5 as on Opus 5.5 at 58% less session cost': '2026-10-11: the conclusion of a past measurement, the models its arms ran on',
  'docs/ROADMAP.md: two readers on Opus 5.5 at high then found most of it built or mismeasured': '2026-10-30: the record of a past review, the model its readers ran on',
  'docs/ROADMAP.md: decided (2026-10-11): the writing sub-agent on Haiku 5.5.': '2026-10-11: a closed decision of the list, superseded by the home and kept as it was answered',
  'docs/ROADMAP.md: - Opus 5.5 defaults may shift after launch.': '2026-09-27: a risk written of one model by its name',
};
const THEN = 'a closed feature\'s record of the model Codex ran on when it was written';
const DATED_DOCUMENTS = {
  'odd/tasks/codex-exec-review.md': `2026-09-29: ${THEN}`,
  'odd/tasks/codex-parity.md': `2026-10-01: ${THEN}`,
  'odd/tasks/codex-review-cost.md': `2026-10-08: ${THEN}`,
  'odd/tasks/codex-review-lean.md': `2026-10-06: ${THEN}`,
  'odd/tasks/faster-check.md': `2026-10-14: ${THEN}`,
  'odd/tasks/stack-v4.md': `2026-10-04: ${THEN}`,
  'odd/tasks/one-model-home.md': '2026-11-11: this convention\'s own design, whose inventory says what the rules held that day',
};

// A Claude id in prose: a version follows its family, and no dot and digit follow it, which a file's version does
// (`docs/host-updates/claude-desktop-4.4212.0.md`).
const CLAUDE_ID_IN_PROSE = /(?<![\w-])claude-[a-z]+-\d+(?:-\d{1,2})*(?:-\d{8})?(?![\w-]|\.\d)/;

/** The values the rule `id` holds and held, as they are written. */
const valuesOf = (id) => {
  const rule = RULES.find((one) => one.id === id);
  return [rule.value, ...(rule.was ?? []).map((one) => one.value)];
};

/** What the line `line` states of a model or an effort, in words, or null. `codex` are the values Codex's home holds
 * or held and `families` the families of the Claude ids the home holds or held, beside the short names. */
function statedIn(line, { codex = [], families = [] } = {}) {
  if (CLAUDE_ID_IN_PROSE.test(line)) return 'a Claude model id';
  if (codex.length > 0 && new RegExp(`(?<![\\w.-])(?:${codex.map(escaped).join('|')})(?![\\w-])`).test(line)) return 'a value of Codex\'s home';
  const names = [...new Set([...SHORT_NAMES, ...families])].join('|');
  if (new RegExp(`\\b(?:${names})[ -]\\d+(?:\\.\\d+)?\\b`, 'i').test(line)) return 'a model\'s name with its version';
  if (new RegExp(`\\b${LEVEL}\`?\\s+effort\\b|\\beffort\\b\`?(?:\\s+(?:of|at|is|to|level))?:?\\s+\`?${LEVEL}\\b`, 'i').test(line)) return 'a level beside the word effort';
  return null;
}

const homesThen = () => ({ codex: valuesOf(CODEX_HOME.model), families: valuesOf(CLAUDE_HOME.model).flatMap(familyOf) });

test('no text in force states a model or an effort, but the dated lines', () => {
  const home = homesThen();
  const checked = [];
  const broken = [];
  for (const file of TEXTS) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is a text of the repository`);
    const pieces = Object.keys(DATED).filter((name) => name.startsWith(`${file}: `));
    fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).forEach((line, index) => {
      const listed = pieces.filter((name) => line.includes(name.slice(file.length + 2)));
      checked.push(...listed);
      const what = statedIn(line, home);
      if (what === null) return;
      if (listed.length > 0) broken.push(...listed);
      else {
        const name = `${file}:${index + 1} states ${what} (${line.trim().slice(0, 100)})`;
        checked.push(name);
        broken.push(name);
      }
    });
  }
  const problems = ratchet({ checked, broken, legacy: DATED });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nname the rule where the value would go: rule:session-model, rule:session-effort, rule:lead-effort, rule:review-model, rule:review-effort`);
});

test('no feature document states above its Log a value Codex\'s home holds or held, but the dated ones', () => {
  const { codex } = homesThen();
  const folder = path.join(ROOT, 'odd', 'tasks');
  const read = fs.readdirSync(folder).filter((name) => name.endsWith('.md')).map((name) => `odd/tasks/${name}`);
  assert.ok(read.length >= 100, `the walk of odd/tasks read only ${read.length} documents`);
  const broken = read.filter((name) => inForceLines(name, fs.readFileSync(path.join(ROOT, name), 'utf8')).some((line) => statedIn(line.text, { codex }) === 'a value of Codex\'s home'));
  const problems = ratchet({ checked: read, broken, legacy: DATED_DOCUMENTS });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nname rule:review-model where the value would go`);
});

test('a line of prose states a model by its id, by a value of Codex\'s home or by its family and version', () => {
  assert.equal(statedIn('Each lens runs on `claude-saga-9-1`, one at a time.'), 'a Claude model id');
  assert.equal(statedIn('a record of claude-haiku-4-5-20251001.'), 'a Claude model id');
  assert.equal(statedIn('The review runs on `gpt-7.2-nova`.', { codex: ['gpt-7.2-nova'] }), 'a value of Codex\'s home');
  // An id with no hyphen and no digit has no shape to know it by: it is found because the home holds or held it.
  assert.equal(statedIn('The review runs on astra.'), null);
  assert.equal(statedIn('The review runs on astra.', { codex: ['gpt-7.2-nova', 'astra'] }), 'a value of Codex\'s home');
  assert.equal(statedIn('an astral plane', { codex: ['astra'] }), null);
  assert.equal(statedIn('designing runs on Opus 5.5 at least'), 'a model\'s name with its version');
  assert.equal(statedIn('everything moves to Saga 9.1', { families: ['saga'] }), 'a model\'s name with its version');
  assert.equal(statedIn('everything moves to Saga 9.1'), null);
});

test('a line of prose states an effort by a level beside the word', () => {
  assert.equal(statedIn('a sub-agent runs at `high` effort'), 'a level beside the word effort');
  assert.equal(statedIn('the effort is xhigh for a lead'), 'a level beside the word effort');
  assert.equal(statedIn('the effort level max'), 'a level beside the word effort');
  assert.equal(statedIn('launched with effort: "medium"'), null, 'a launch in code is the convention over code\'s');
});

test('a rule named, a sample\'s placeholder, a file\'s version and a level that is no effort state nothing', () => {
  for (const line of [
    'Each lens runs on the model of `rule:session-model` at the effort of `rule:lead-effort`.',
    'Plan of the Codex review: <model> at <effort> effort, 2 parts',
    '`docs/host-updates/claude-desktop-4.4212.0.md`, passes `host-watch check`',
    'The cap of the effort in his user settings (`maxEffortLevel`) is his.',
    'a high risk item, at low cost, with medium confidence',
    'the claude-code CLI and the opus of a composer',
  ]) assert.equal(statedIn(line, { codex: ['gpt-7.2-nova'], families: ['saga'] }), null, line);
});
