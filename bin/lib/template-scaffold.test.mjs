// `template new`, the template of templates (odd/tasks/templates.md, "js-harness template", spec 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkTemplates } from './template-check.mjs';
import { FIELDS, firstMissing, scaffold } from './template-scaffold.mjs';

const SAMPLE = Buffer.from('<p>Pregunta 7: ¿Qué rama?</p>\n');
const GIVEN = {
  id: 'question',
  what: 'the questions to the user',
  when: 'when a decision is the user\'s',
  where: 'the lead chat, as buttons',
  sample: 'C:/somewhere/approved.html',
  source: '0f71b2c6:15262',
};

test('the fields are his Plantilla line in its order, then the sample\'s approval', () => {
  assert.deepEqual(FIELDS.map((field) => field.flag), ['--what', '--when', '--sample', '--where', '--source']);
});

test('firstMissing names only the first field not given, so the lead asks for that one alone', () => {
  assert.equal(firstMissing(GIVEN), null);
  const { when, where, ...lacking } = GIVEN;
  assert.ok(when && where);
  const missing = firstMissing(lacking);
  assert.equal(missing.flag, '--when');
  assert.match(missing.ask, /cuándo aparece/);
  assert.equal(firstMissing({ ...GIVEN, what: '  ' }).flag, '--what');
});

test('scaffold refuses an id that cannot name a file and a kind or surface it does not know', () => {
  assert.match(scaffold({ ...GIVEN, id: 'Bad Id' }, SAMPLE).error, /id/);
  assert.match(scaffold({ ...GIVEN, kind: 'drawn' }, SAMPLE).error, /kind/);
  assert.match(scaffold({ ...GIVEN, surface: 'mail' }, SAMPLE).error, /surface/);
});

test('scaffold writes the five parts as files and a draft entry pinned to the sample\'s bytes', () => {
  const { files, entry } = scaffold({ ...GIVEN, surface: 'ask' }, SAMPLE);
  assert.deepEqual(files.map((file) => file.path), [
    'templates/question/sample.html',
    'templates/question/records.json',
    'bin/lib/template-question.mjs',
    'bin/lib/template-question.test.mjs',
  ]);
  assert.equal(files[0].content, SAMPLE);
  assert.equal(entry.draft, true);
  assert.equal(entry.sample.sha256, createHash('sha256').update(SAMPLE).digest('hex'));
  assert.equal(entry.sample.source, '0f71b2c6:15262');
  assert.deepEqual(entry.plantilla, { what: GIVEN.what, when: GIVEN.when, looks: 'templates/question/sample.html', where: GIVEN.where });
  assert.equal(entry.surface, 'ask');
  assert.equal(entry.kind, 'rendered');
  const module = files[2].content;
  assert.match(module, /^\/\/ Template `question`/);
  assert.match(module, /templates\/question\/sample\.html/);
  assert.match(module, /Plantilla: the questions to the user · when a decision is the user's · templates\/question\/sample\.html · the lead chat, as buttons/);
  assert.match(module, /export function render/);
  assert.match(module, /export function admit/);
  const tests = files[3].content;
  assert.match(tests, /test\('template:question golden'/);
  assert.match(tests, /test\('template:question refuses a hand-made one'/);
  // The golden reads the sample as LF, as its digest does; the hand-made output always differs from the sample.
  assert.match(tests, /\.replace\(\/\\r\\n\/g, '\\n'\)/);
  assert.match(tests, /admit\(\{ output: `\$\{SAMPLE\} hand-made` \}\)/);
});

test('what scaffold writes passes template check but for its draft and its scaffold body, so it cannot land half done', () => {
  const { files, entry } = scaffold({ ...GIVEN, surface: 'ask' }, SAMPLE);
  const map = Object.fromEntries(files.map((file) => [file.path, Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)]));
  const readFile = (rel) => (Object.hasOwn(map, rel) ? map[rel] : null);
  const faults = checkTemplates([entry], { readFile, hooked: new Set(['AskUserQuestion']) }).map((one) => one.fault);
  assert.equal(faults.length, 2, faults.join('\n'));
  assert.match(faults[0], /^a draft/);
  assert.match(faults[1], /still holds the scaffold body/);
  const finished = { ...entry, draft: false };
  map['bin/lib/template-question.mjs'] = Buffer.from('export function render(r) { return r; }\nexport function admit() { return { admitted: false }; }\n');
  assert.deepEqual(checkTemplates([finished], { readFile, hooked: new Set(['AskUserQuestion']) }), []);
});

test('a shape template gets no records file', () => {
  const { files, entry } = scaffold({ ...GIVEN, kind: 'shape', surface: 'stop' }, SAMPLE);
  assert.ok(!files.some((file) => file.path.endsWith('records.json')));
  assert.equal(entry.records, undefined);
});
