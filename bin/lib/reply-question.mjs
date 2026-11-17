// The record check of the reply's question state (odd/tasks/questions-with-options.md, T3): a reply that closes on
// the question state names, on that line, the recorded question it waits on (`Pregunta 12`, ./reply.mjs), and here the
// record says whether that question is one: recorded, still open, and with the options the question tool shows.
//
// Why. His answer to question 325 (2026-11-17, transcript 699d7c29, line 8070): a question he answers in writing
// reaches him through the question tool, its options giving examples, answered in its Other. The text check alone let
// a reply number its own question ("Te pregunto: Pregunta 1, ¿…?") with nothing recorded (the reliability lens on
// 924c111..263c293). This module only judges; `bin/reply.mjs` reads the record and hands it the questions.
import { TOOL_OPTIONS } from './template-question.mjs';

/** Why the question `number` a question close named (by `word`, under the state's `label`) is no open question of the
 * record recorded with 2 to 4 options, or `null` when it is one. `questions` are `recordedQuestions`'s
 * (./channel.mjs): `[{ number, notice, closed }]`. */
export function questionRecordRefusal({ number, label, word, questions }) {
  const named = `js-harness reply: "${label}" names ${word} ${number}`;
  const found = questions.find((one) => one.number === number);
  if (found === undefined) {
    return `${named}, and the record holds no question ${number}: record it with js-harness notify --to orchestrator --kind question, its options giving examples of the answer and its text saying plainly that the user writes it in the question tool's Other, and name the number it prints`;
  }
  if (found.closed !== null) {
    return `${named}, and question ${number} is already ${found.closed.by === 'withdrawn' ? 'withdrawn' : 'answered'}: name the open question this reply waits on`;
  }
  const count = found.notice.options.length;
  if (count < TOOL_OPTIONS.min || count > TOOL_OPTIONS.max) {
    return `${named}, and question ${number} was recorded with ${count} options, and the question tool shows ${TOOL_OPTIONS.min} to ${TOOL_OPTIONS.max}: withdraw it and record it again with its options`;
  }
  return null;
}
