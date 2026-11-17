import test from 'node:test';
import assert from 'node:assert/strict';
import { questionRecordRefusal } from './reply-question.mjs';

const question = (number, options = 2, closed = null) => ({
  number,
  notice: { text: '¿Biblioteca o aplicación?', options: Array.from({ length: options }, (_, i) => ({ label: `Opción ${i + 1}`, description: '' })) },
  closed,
});
const refusal = (number, questions) => questionRecordRefusal({ number, label: 'Te pregunto', word: 'Pregunta', questions });

test('a question close that names an open question of the record, recorded with 2 to 4 options, passes', () => {
  assert.equal(refusal(7, [question(6), question(7, 4)]), null);
});

// The reliability lens on 924c111..263c293: a reply that numbers its own question passed the text check alone.
test('a question close naming a number the record holds no question of is turned back, saying how to record one', () => {
  const reason = refusal(1, []);
  assert.match(reason, /^js-harness reply: "Te pregunto" names Pregunta 1, and the record holds no question 1: /);
  assert.match(reason, /notify --to orchestrator --kind question/);
  assert.match(reason, /Other/);
});

test('a question close naming a question already answered or withdrawn is turned back', () => {
  assert.match(refusal(2, [question(2, 2, { by: 'answer' })]), /question 2 is already answered: name the open question this reply waits on/);
  assert.match(refusal(2, [question(2, 2, { by: 'withdrawn' })]), /question 2 is already withdrawn/);
});

test('a question close naming an old question recorded with too few or too many options is turned back', () => {
  for (const count of [0, 1, 5]) {
    assert.match(refusal(3, [question(3, count)]), new RegExp(`question 3 was recorded with ${count} options, and the question tool shows 2 to 4: withdraw it and record it again`));
  }
});
