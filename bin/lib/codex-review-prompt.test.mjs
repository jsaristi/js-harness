import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_MAX_CHARS, IntentError, REVIEW_PROMPT_VERSION, reviewIntent, reviewPrompt } from './codex-review-prompt.mjs';

const FROM = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

// --- the prompt ---

test('the prompt is versioned', () => {
  assert.equal(REVIEW_PROMPT_VERSION, 'js-harness.codex-review-prompt/v1');
});

test('reviewPrompt names the committed range and the command that shows it', () => {
  const prompt = reviewPrompt({ from: FROM, head: HEAD });
  assert.ok(prompt.includes(`${FROM}..${HEAD}`), prompt);
  assert.ok(prompt.includes(`\`git diff ${FROM} ${HEAD}\``), prompt);
  assert.match(prompt, /committed range/);
  assert.equal(prompt, reviewPrompt({ from: FROM, head: HEAD }), 'the same range gives the same text');
  assert.equal(prompt.endsWith('\n'), true);
  assert.equal(prompt.includes('\r'), false);
});

test('reviewPrompt asks for findings only inside that diff', () => {
  const prompt = reviewPrompt({ from: FROM, head: HEAD });
  assert.match(prompt, /only .*that diff/i);
  assert.match(prompt, /context/i, 'reading other files is allowed, reporting on them is not');
});

test('reviewPrompt leaves the format of the answer to the rubric: it names no field and no format', () => {
  const intent = { goal: 'Ship it.', doneWhen: '- `npm test` exits 0' };
  for (const prompt of [reviewPrompt({ from: FROM, head: HEAD }), reviewPrompt({ from: FROM, head: HEAD, intent })]) {
    assert.doesNotMatch(prompt, /json|schema|format|priority|confidence|P[0-3]\b|overall_|markdown/i);
    // No persona either: it says what to review, not who the reviewer is.
    assert.doesNotMatch(prompt, /you are|act as|expert|senior/i);
  }
});

test('reviewPrompt without an intent says nothing of one', () => {
  const prompt = reviewPrompt({ from: FROM, head: HEAD });
  assert.doesNotMatch(prompt, /goal|done when|intent/i);
  assert.equal(reviewPrompt({ from: FROM, head: HEAD, intent: null }), prompt);
});

test('reviewPrompt with an intent adds the goal and the done-when under a heading, to judge the change against', () => {
  const intent = { goal: 'The command measures every attempt.', doneWhen: '- `npm run check` exits 0\n- The roadmap records the result' };
  const prompt = reviewPrompt({ from: FROM, head: HEAD, intent });
  assert.ok(prompt.startsWith(reviewPrompt({ from: FROM, head: HEAD })), 'the intent comes after the range, which stays as it was');
  const added = prompt.slice(reviewPrompt({ from: FROM, head: HEAD }).length);
  assert.match(added, /^\n## What the change is for\n/);
  assert.match(added, /judge the change against/i);
  // A reviewed range is a slice of its feature, so a criterion a later slice meets is not a defect of this one.
  assert.match(added, /one step .* not a finding/i);
  assert.ok(added.includes('### Goal\nThe command measures every attempt.\n'), added);
  assert.ok(added.includes('### Done when\n- `npm run check` exits 0\n- The roadmap records the result\n'), added);
  assert.ok(added.indexOf('### Goal') < added.indexOf('### Done when'));
});

test('reviewPrompt carries the intent as written: quotes, percent signs, ampersands and other alphabets', () => {
  const intent = { goal: 'Say "done" & keep 100% of %PATH%', doneWhen: '- `a && b | c > d` exits 0\n- Sebastián decide ^' };
  const prompt = reviewPrompt({ from: FROM, head: HEAD, intent });
  assert.ok(prompt.includes(intent.goal));
  assert.ok(prompt.includes(intent.doneWhen));
});

test('reviewPrompt refuses a range that is not two commit ids, since both go into a command the model runs', () => {
  for (const bad of ['HEAD~1', 'main', '', `${FROM} --output=x`, `${FROM}\n`, 'ABCDEF1', undefined, null, 7]) {
    assert.throws(() => reviewPrompt({ from: bad, head: HEAD }), /commit id/, JSON.stringify(bad));
    assert.throws(() => reviewPrompt({ from: FROM, head: bad }), /commit id/, JSON.stringify(bad));
  }
  // A SHA-256 repository's ids are longer, and they are ids too.
  assert.doesNotThrow(() => reviewPrompt({ from: 'c'.repeat(64), head: 'd'.repeat(64) }));
});

// --- the intent, from a feature document ---

const DOC = `# A feature

Locator: \`odd/tasks/a-feature.md\`

## Goal
The command measures every attempt.

## Why
Nobody could say what a review cost.

## Done when
- \`npm run check\` exits 0
- The roadmap records the result

## Constraints
- Zero dependencies — because nothing is installed
`;

test('reviewIntent reads the Goal and the Done when of a feature document, trimmed', () => {
  assert.deepEqual(reviewIntent(DOC), {
    goal: 'The command measures every attempt.',
    doneWhen: '- `npm run check` exits 0\n- The roadmap records the result',
  });
  assert.deepEqual(reviewIntent(DOC.replaceAll('\n', '\r\n')), reviewIntent(DOC), 'a document checked out with CRLF reads the same');
});

test('reviewIntent takes the real headings, not the ones inside a fenced example', () => {
  const fenced = `\`\`\`md\n## Goal\nthe template's\n\n## Done when\n- the template's\n\`\`\`\n\n${DOC}`;
  assert.deepEqual(reviewIntent(fenced), reviewIntent(DOC));
});

test('reviewIntent: a document without one of the two headings is an error that names it', () => {
  const noDone = DOC.replace('## Done when', '## Finished when');
  assert.throws(() => reviewIntent(noDone), (err) => err instanceof IntentError && /no `## Done when` heading/.test(err.message));
  const noGoal = DOC.replace('## Goal', '### Goal');
  assert.throws(() => reviewIntent(noGoal), (err) => err instanceof IntentError && /no `## Goal` heading/.test(err.message));
  assert.throws(() => reviewIntent('just notes'), (err) => err instanceof IntentError && /`## Goal`/.test(err.message));
  assert.throws(() => reviewIntent(''), IntentError);
});

test('reviewIntent: a heading with nothing under it is an error too, since there is no intent to carry', () => {
  const empty = DOC.replace('The command measures every attempt.\n', '');
  assert.throws(() => reviewIntent(empty), (err) => err instanceof IntentError && /`## Goal` section of the feature document is empty/.test(err.message));
});

test('reviewIntent bounds each section, and says in the text that it was cut', () => {
  assert.equal(INTENT_MAX_CHARS, 2000);
  const long = DOC.replace('The command measures every attempt.', `${'word '.repeat(600)}end`);
  const { goal, doneWhen } = reviewIntent(long);
  assert.equal(goal.startsWith('word word'), true);
  assert.equal(goal.includes('end'), false);
  const [kept, note] = goal.split('\n[');
  assert.equal(kept.length <= INTENT_MAX_CHARS, true);
  assert.equal(`[${note}`, '[Cut here: this section is 3,003 characters long, and only its first 2,000 are given.]');
  assert.equal(doneWhen, '- `npm run check` exits 0\n- The roadmap records the result', 'a section within the bound is whole, with no note');
  // A section exactly at the bound is whole.
  const exact = DOC.replace('The command measures every attempt.', 'x'.repeat(INTENT_MAX_CHARS));
  assert.equal(reviewIntent(exact).goal, 'x'.repeat(INTENT_MAX_CHARS));
});

test('reviewIntent takes another bound when given one', () => {
  const { goal, doneWhen } = reviewIntent(DOC, { maxChars: 11 });
  assert.equal(goal, 'The command\n[Cut here: this section is 35 characters long, and only its first 11 are given.]');
  assert.equal(doneWhen, '- `npm run\n[Cut here: this section is 58 characters long, and only its first 11 are given.]');
});
