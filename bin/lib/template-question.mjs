// Template `question` (odd/tasks/templates.md, T5): the questions to the user.
// Plantilla: the questions to the user · when a decision is his, recorded by notify --kind question · templates/question/sample.json · the question tool of the lead's chat.
// `render` makes the question tool's input from a question of the channel's record, and `admit` is what the `ask`
// gate asks of each question a call of that tool shows, before it reaches the user. Both are handed the record's
// questions (`recordedQuestions`, bin/lib/channel.mjs); the command and the gate read it.
import { QUESTION_WORD, questionPrefix } from './sessions.mjs';

/** How many options the question tool shows: a question with fewer or more is asked in writing. */
export const TOOL_OPTIONS = Object.freeze({ min: 2, max: 4 });

/** The longest header the question tool shows. */
const HEADER_MAX = 12;

const NUMBERED = new RegExp(`^${QUESTION_WORD} (\\d+): `);

/** The question tool's input for question `number` of the record, `notice` its question notice, as JSON text with
 * its newline: the one question, opened by its prefix, headed by its number, its options in the record's order (the
 * recommended one first). Throws when the question tool cannot show it: too few or too many options. */
export function render({ number, notice }) {
  const count = notice.options.length;
  if (count < TOOL_OPTIONS.min || count > TOOL_OPTIONS.max) {
    throw new Error(`question ${number} has ${count} options and the question tool shows ${TOOL_OPTIONS.min} to ${TOOL_OPTIONS.max}: ask it in writing`);
  }
  const named = questionPrefix(number).replace(/: $/, '');
  const question = {
    question: `${questionPrefix(number)}${notice.text}`,
    header: named.length <= HEADER_MAX ? named : `#${number}`,
    multiSelect: false,
    options: notice.options.map(({ label, description }) => ({ label, description })),
  };
  return `${JSON.stringify({ questions: [question] }, null, 2)}\n`;
}

/** Whether one question a call of the question tool shows, `asked` (`{ question, options }`), is a question of the
 * record as `render` made it: `{ admitted, number, why }`, `number` the question it names or `null`, and `why` what
 * does not hold. It is admitted when its text opens with a prefix whose question is in the record and still open,
 * and its text and its options' labels are that question's. */
export function admit({ asked, questions }) {
  const text = typeof asked?.question === 'string' ? asked.question : '';
  const named = NUMBERED.exec(text);
  if (named === null) return { admitted: false, number: null, why: `its text does not open with "${QUESTION_WORD} <n>: "` };
  const number = Number(named[1]);
  const recorded = questions.find((one) => one.number === number);
  if (recorded === undefined) return { admitted: false, number, why: `the record holds no question ${number}` };
  if (recorded.closed !== null) return { admitted: false, number, why: `question ${number} is ${recorded.closed.by === 'withdrawn' ? 'withdrawn' : 'answered'}` };
  if (text !== `${questionPrefix(number)}${recorded.notice.text}`) return { admitted: false, number, why: `its text is not question ${number}'s as recorded` };
  const labels = (options) => (Array.isArray(options) ? options.map((option) => option?.label) : []);
  if (JSON.stringify(labels(asked.options)) !== JSON.stringify(labels(recorded.notice.options))) {
    return { admitted: false, number, why: `its options are not question ${number}'s as recorded` };
  }
  return { admitted: true, number, why: null };
}

/** The moments of the `ask` surface since `since` (milliseconds): `[{ template: 'question', subject }]`, a question
 * of the record recorded since then, answered, with options the tool shows. Each was asked, so a `shown` line of its
 * number should hold; one asked in writing (too few or too many options) or withdrawn has none to hold, and one still
 * open may not have been asked yet. */
export function answeredMoments(questions, since) {
  const showable = (count) => count >= TOOL_OPTIONS.min && count <= TOOL_OPTIONS.max;
  return questions
    .filter((one) => one.closed?.by === 'answer' && Date.parse(one.notice.at) >= since && showable(one.notice.options.length))
    .map((one) => ({ template: 'question', subject: String(one.number) }));
}
