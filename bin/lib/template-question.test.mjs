// The golden and refusal tests of template `question` (odd/tasks/templates.md, T5), and the cases of its gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TOOL_OPTIONS, admit, render } from './template-question.mjs';

// Read as LF, as its digest is, so a checkout with CRLF holds the same sample.
const SAMPLE = fs.readFileSync(new URL('../../templates/question/sample.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const RECORD = JSON.parse(fs.readFileSync(new URL('../../templates/question/records.json', import.meta.url), 'utf8'));

const open = (record = RECORD) => [{ ...record, closed: null }];
const shown = () => JSON.parse(SAMPLE).questions[0];

test('template:question golden', () => {
  assert.equal(render(RECORD), SAMPLE);
});

test('template:question refuses a hand-made one', () => {
  const asked = shown();
  assert.equal(admit({ asked, questions: open() }).admitted, true, 'the rendered question is admitted');
  const retyped = { ...asked, question: `${asked.question} hand-made` };
  assert.deepEqual(admit({ asked: retyped, questions: open() }), { admitted: false, number: RECORD.number, why: `its text is not question ${RECORD.number}'s as recorded` });
});

test('a question that names no record, or a closed one, is refused with why', () => {
  const asked = shown();
  assert.match(admit({ asked: { ...asked, question: 'Sin número: ¿seguimos?' }, questions: open() }).why, /does not open with "Pregunta <n>: "/);
  assert.equal(admit({ asked, questions: [] }).why, `the record holds no question ${RECORD.number}`);
  assert.equal(admit({ asked, questions: [{ ...RECORD, closed: { by: 'answer' } }] }).why, `question ${RECORD.number} is answered`);
  assert.equal(admit({ asked, questions: [{ ...RECORD, closed: { by: 'withdrawn' } }] }).why, `question ${RECORD.number} is withdrawn`);
});

test('a question whose options differ from the record\'s, by label, order or number, is refused', () => {
  const asked = shown();
  const why = `its options are not question ${RECORD.number}'s as recorded`;
  for (const options of [asked.options.slice().reverse(), asked.options.slice(1), [...asked.options, { label: 'Otra', description: '' }], asked.options.map((one, i) => (i === 0 ? { ...one, label: `${one.label}!` } : one))]) {
    assert.equal(admit({ asked: { ...asked, options }, questions: open() }).why, why);
  }
  assert.equal(admit({ asked: { ...asked, options: asked.options.map((one) => ({ ...one, description: 'otra' })) }, questions: open() }).admitted, true, 'a description is the asker\'s words');
});

test('render refuses a question the tool cannot show, and heads a long number with #', () => {
  const options = (n) => Array.from({ length: n }, (_, i) => ({ label: `Opción ${i + 1}`, description: '' }));
  assert.throws(() => render({ number: 3, notice: { text: 't', options: options(TOOL_OPTIONS.min - 1) } }), /ask it in writing/);
  assert.throws(() => render({ number: 3, notice: { text: 't', options: options(TOOL_OPTIONS.max + 1) } }), /ask it in writing/);
  assert.equal(JSON.parse(render({ number: 1234, notice: { text: 't', options: options(2) } })).questions[0].header, '#1234');
  assert.equal(JSON.parse(render({ number: 123, notice: { text: 't', options: options(2) } })).questions[0].header, 'Pregunta 123');
});
