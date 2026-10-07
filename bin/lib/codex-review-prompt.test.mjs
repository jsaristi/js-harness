import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_MAX_CHARS, IntentError, quotedPath, REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION, reviewIntent, reviewPrompt } from './codex-review-prompt.mjs';

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

// --- the prompt of one part of a range reviewed in parts ---

const PART = { index: 2, of: 3, files: ['bin/a.mjs', 'docs/my notes.md'] };

test('the prompt of a part has a version of its own, and the prompt of a whole range keeps its text and its version', () => {
  assert.equal(REVIEW_PART_PROMPT_VERSION, 'js-harness.codex-review-part-prompt/v1');
  assert.notEqual(REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION);
  // The text a whole range was asked with in the runs recorded under `v1`, to the character.
  assert.equal(
    reviewPrompt({ from: FROM, head: HEAD }),
    `Review the code changes in the committed range ${FROM}..${HEAD}.\n` +
      `Run \`git diff ${FROM} ${HEAD}\` to inspect them: its output is the whole change under review.\n` +
      'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.\n',
  );
  assert.equal(reviewPrompt({ from: FROM, head: HEAD, part: null }), reviewPrompt({ from: FROM, head: HEAD }));
});

test('reviewPrompt for a part says which part it is, and names its files in the command that shows them', () => {
  const prompt = reviewPrompt({ from: FROM, head: HEAD, part: PART });
  assert.ok(prompt.includes(`${FROM}..${HEAD}`), prompt);
  assert.match(prompt, /part 2 of 3/);
  // The files are in the command and nowhere else: the prompt is paid on every request of the review.
  assert.ok(prompt.includes(`\`git diff --no-renames ${FROM} ${HEAD} -- bin/a.mjs 'docs/my notes.md'\``), prompt);
  assert.equal(prompt.split('my notes.md').length, 2, 'each file is named once');
  assert.equal(prompt, reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, files: [...PART.files] } }), 'the same part gives the same text');
  assert.equal(prompt.endsWith('\n'), true);
  assert.equal(prompt.includes('\r'), false);
  assert.notEqual(prompt, reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, index: 3 } }));
});

test('reviewPrompt for a part says the other files of the range are reviewed in other parts: to read, not to report on', () => {
  const prompt = reviewPrompt({ from: FROM, head: HEAD, part: PART });
  assert.match(prompt, /other files .*reviewed in the other parts/i);
  assert.match(prompt, /context/i);
  assert.match(prompt, /report nothing about them/i);
  assert.match(prompt, /only .*that diff/i, 'findings stay inside the diff of the part');
  // It still says what to review and nothing of how to answer, nor who the reviewer is.
  assert.doesNotMatch(prompt, /json|schema|format|priority|confidence|P[0-3]\b|overall_|markdown/i);
  assert.doesNotMatch(prompt, /you are|act as|expert|senior/i);
});

test('reviewPrompt for a part carries the intent after it, as the prompt of a whole range does', () => {
  const intent = { goal: 'The command measures every attempt.', doneWhen: '- `npm run check` exits 0' };
  const bare = reviewPrompt({ from: FROM, head: HEAD, part: PART });
  const prompt = reviewPrompt({ from: FROM, head: HEAD, part: PART, intent });
  assert.ok(prompt.startsWith(bare), prompt);
  const whole = reviewPrompt({ from: FROM, head: HEAD, intent });
  assert.equal(prompt.slice(bare.length), whole.slice(reviewPrompt({ from: FROM, head: HEAD }).length), 'the same section, word for word');
});

test('quotedPath: a plain path is written as it is, and any other in single quotes, which no shell reads into', () => {
  for (const plain of ['a', 'bin/lib/codex-review.mjs', 'docs/ROADMAP.md', '.githooks/pre-commit', 'a_b-c.d/e']) assert.equal(quotedPath(plain), plain);
  const quoted = ['my file.txt', 'a&b.txt', '100%.txt', '$HOME/x', 'app/[id]/page.tsx', 'a(1).txt', 'packages/@scope/x.js', '-leading-dash', '~tilde', 'año/café.js', 'a;b', 'a`b', 'star*.txt', 'c:\\x'];
  for (const path of quoted) assert.equal(quotedPath(path), `'${path}'`, path);
});

test('quotedPath refuses a path that one command line cannot hold safely, instead of guessing how to write it', () => {
  for (const path of ['two\nlines.txt', 'cr\rhere', 'tab\there', 'it\'s.txt', 'say "hi".txt', 'nul\x00', 'bell\x07', 'del\x7f', '', 7, null, undefined]) {
    assert.throws(() => quotedPath(path), /cannot be written safely/, JSON.stringify(path));
  }
  // The error names the path, so that a person can find the file.
  assert.throws(() => quotedPath('it\'s.txt'), (err) => err.message.includes(JSON.stringify('it\'s.txt')));
  assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, files: ['ok.txt', 'two\nlines.txt'] } }), /cannot be written safely/);
});

test('reviewPrompt refuses a part that is not one: a number out of its range, a range in one part, no file', () => {
  const bad = [
    { ...PART, index: 0 }, { ...PART, index: 4 }, { ...PART, index: 1.5 }, { ...PART, index: '2' },
    { ...PART, of: 1, index: 1 }, { ...PART, of: 0 }, { ...PART, of: undefined },
    { ...PART, files: [] }, { ...PART, files: 'bin/a.mjs' }, { index: 2, of: 3 }, 'part 2', 7,
  ];
  for (const part of bad) assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part }), /part/i, JSON.stringify(part));
  assert.throws(() => reviewPrompt({ from: 'main', head: HEAD, part: PART }), /commit id/);
});

// --- the intent, from a feature document ---

const DOC =`# A feature

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

test('reviewIntent never cuts a character in two: a cut that falls inside a surrogate pair is made before it', () => {
  // U+1F600 is two code units. With the bound at 11 the cut falls between them, after ten `x`.
  const emoji = DOC.replace('The command measures every attempt.', `${'x'.repeat(10)}\u{1F600} and the rest`);
  const { goal } = reviewIntent(emoji, { maxChars: 11 });
  const [kept, note] = goal.split('\n[');
  assert.equal(kept, 'x'.repeat(10), 'the half that fitted is left out, not kept as a lone surrogate');
  assert.equal(goal.isWellFormed(), true);
  assert.equal(`[${note}`, '[Cut here: this section is 25 characters long, and only its first 11 are given.]');
  // A pair that ends at the bound is whole, and so is one that starts after it.
  assert.equal(reviewIntent(emoji, { maxChars: 12 }).goal.split('\n[')[0], `${'x'.repeat(10)}\u{1F600}`);
  assert.equal(reviewIntent(emoji, { maxChars: 10 }).goal.split('\n[')[0], 'x'.repeat(10));
  // A lone surrogate the document itself holds is not this function's to mend: only the cut is.
  const lone = DOC.replace('The command measures every attempt.', `${'x'.repeat(10)}\ud83d and the rest`);
  assert.equal(reviewIntent(lone, { maxChars: 11 }).goal.split('\n[')[0], `${'x'.repeat(10)}\ud83d`);
});

test('reviewIntent takes another bound when given one', () => {
  const { goal, doneWhen } = reviewIntent(DOC, { maxChars: 11 });
  assert.equal(goal, 'The command\n[Cut here: this section is 35 characters long, and only its first 11 are given.]');
  assert.equal(doneWhen, '- `npm run\n[Cut here: this section is 58 characters long, and only its first 11 are given.]');
});
