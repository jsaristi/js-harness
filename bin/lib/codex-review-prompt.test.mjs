import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTENT_MAX_CHARS, IntentError, quotedPath, REVIEW_MERGE_PROMPT_VERSION, REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION, reviewIntent, reviewPrompt, SUITE_RAN, CONVENTIONS } from './codex-review-prompt.mjs';
import { NO_TEST_LINE } from './no-test-outside-turn.mjs';

const FROM = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const TREE = 'c'.repeat(40);

// Every text ends with CONVENTIONS (`v2`); `body` is a text without that tail, what the tests below compare.
const TAIL = `\n${CONVENTIONS}\n`;
function body(text) {
  assert.ok(text.endsWith(TAIL), text);
  return text.slice(0, -TAIL.length);
}

// --- the prompt ---

test('the prompt is versioned', () => {
  // `v2` of the whole range and `v3` of a merge: the text ends with CONVENTIONS.
  assert.equal(REVIEW_PROMPT_VERSION, 'js-harness.codex-review-prompt/v2');
  assert.equal(REVIEW_MERGE_PROMPT_VERSION, 'js-harness.codex-review-merge-prompt/v3');
});

// odd/tasks/conventions.md, S6: what no test can judge is asked of the reviewer on each diff, in words that hold for
// any project, since this prompt is every installed project's.
test('every text of the prompt ends with the conventions around the change, once, before what is said of the tests', () => {
  const texts = [
    reviewPrompt({ from: FROM, head: HEAD }),
    reviewPrompt({ from: FROM, head: HEAD, intent: { goal: 'g', doneWhen: 'd' } }),
    reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 2, files: ['a.mjs'] } }),
    reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 1, files: ['a.mjs'] }, merge: TREE }),
  ];
  for (const text of texts) {
    assert.ok(text.endsWith(`\n\n${CONVENTIONS}\n`), text);
    assert.equal(text.split(CONVENTIONS).length, 2, text);
  }
  const ran = reviewPrompt({ from: FROM, head: HEAD, suiteRan: true });
  assert.ok(ran.endsWith(`\n\n${CONVENTIONS}\n\n${SUITE_RAN}\n`), ran);
  assert.match(CONVENTIONS, /^## The conventions around it\n/);
  for (const subject of ['pure', 'errors', 'voice', 'names', 'a finding']) assert.ok(CONVENTIONS.includes(subject), subject);
  assert.doesNotMatch(CONVENTIONS, /js-harness|bin\/|Sebasti/);
});

test('the prompt of a merge names the diff of the automatic merge and the merge by file, one part of one included, and is never that of a whole range', () => {
  const text = reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 1, files: ['bin/a.mjs', 'odd name.txt'] }, merge: TREE });
  assert.equal(
    body(text),
    [
      `Review what was written in the merge commit ${HEAD}, whose first parent is ${FROM}: the resolution of its conflicts and any edit made in it. This review covers the files the command below names.`,
      `Run \`git --literal-pathspecs diff --no-renames ${TREE} ${HEAD} -- bin/a.mjs 'odd name.txt'\` to inspect them: ${TREE} is the tree that merging its two parents again automatically gives, conflict markers included, so its output is what was written in the merge, and it is the whole change under review.`,
      'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.',
      'What the merge took unchanged from either parent was reviewed on its own branch: read them for context, and report nothing about them.',
      '',
    ].join('\n'),
  );
  assert.match(reviewPrompt({ from: FROM, head: HEAD, part: { index: 2, of: 3, files: ['c.mjs'] }, merge: TREE }), /This review covers part 2 of 3 of that review: the files the command below names\./);
  assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, merge: TREE }), /The review of a merge is asked by its files/);
  assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 1, files: ['c.mjs'] }, merge: 'HEAD^{tree}' }), /full object id/);
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

test('reviewPrompt out of a turn of the gate lock says the suite already ran and a refused node --test is no finding, with or without an intent', () => {
  for (const intent of [null, { goal: 'A goal.', doneWhen: '- it holds' }]) {
    const plain = reviewPrompt({ from: FROM, head: HEAD, intent });
    const out = reviewPrompt({ from: FROM, head: HEAD, intent, suiteRan: true });
    assert.equal(plain.includes(SUITE_RAN), false, plain);
    assert.ok(out.includes(`\n\n${SUITE_RAN}\n`), out);
    assert.ok(out.startsWith(plain.trimEnd()), 'the sentence follows what the prompt says without it');
  }
  assert.match(SUITE_RAN, /already ran the whole test suite on this range/);
  assert.match(SUITE_RAN, /exit 97/);
  assert.ok(SUITE_RAN.includes(NO_TEST_LINE), SUITE_RAN);
  assert.match(SUITE_RAN, /not a finding/);
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
  assert.ok(body(prompt).startsWith(body(reviewPrompt({ from: FROM, head: HEAD }))), 'the intent comes after the range, which stays as it was');
  const added = body(prompt).slice(body(reviewPrompt({ from: FROM, head: HEAD })).length);
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
  // `v2`: the command of a part reads its file names literally (`--literal-pathspecs`), which `v1` did not.
  // `v3`: it says so when the range leaves files out of the review, and a range of one part that does is
  // asked with it. `v4`: it ends with CONVENTIONS.
  assert.equal(REVIEW_PART_PROMPT_VERSION, 'js-harness.codex-review-part-prompt/v4');
  assert.notEqual(REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION);
  // The text a whole range was asked with in the runs recorded under `v1`, to the character, which `v2` ends with
  // CONVENTIONS.
  assert.equal(
    body(reviewPrompt({ from: FROM, head: HEAD })),
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
  assert.ok(prompt.includes(`\`git --literal-pathspecs diff --no-renames ${FROM} ${HEAD} -- bin/a.mjs 'docs/my notes.md'\``), prompt);
  assert.equal(prompt.split('my notes.md').length, 2, 'each file is named once');
  assert.equal(prompt, reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, files: [...PART.files] } }), 'the same part gives the same text');
  assert.equal(prompt.endsWith('\n'), true);
  assert.equal(prompt.includes('\r'), false);
  assert.notEqual(prompt, reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, index: 3 } }));
});

test('reviewPrompt for a part names its files as themselves: git is told to read no pattern and no magic into a name', () => {
  // Each of these is a name a file can have, and a pathspec that means something else: a pattern that takes
  // in the files of other parts (`*`, `?`, `[1]`), or magic that leaves the file itself out (a `:` first).
  // Whether git then shows the one file is asked of a real repository in `../codex-review.test.mjs`; `*`,
  // `?` and a leading `:` are no file names on Windows, so here they are text.
  const files = ['*.md', 'a?.txt', 'a[1].txt', ':(exclude)a.txt', ':!a.txt', ':/top.txt'];
  const prompt = reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 2, files } });
  // The option goes before `diff`: it is git's, for every pathspec of the command, and no part of `diff`.
  assert.ok(prompt.includes(`\`git --literal-pathspecs diff --no-renames ${FROM} ${HEAD} -- ${files.map((file) => `'${file}'`).join(' ')}\``), prompt);
  // And a shell reads no pattern into them either: each is in single quotes.
  for (const file of files) assert.equal(quotedPath(file), `'${file}'`, file);
  // The whole range names no file, so its command is as it was.
  assert.equal(reviewPrompt({ from: FROM, head: HEAD }).includes('--literal-pathspecs'), false);
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
  const bare = body(reviewPrompt({ from: FROM, head: HEAD, part: PART }));
  const prompt = body(reviewPrompt({ from: FROM, head: HEAD, part: PART, intent }));
  assert.ok(prompt.startsWith(bare), prompt);
  const whole = body(reviewPrompt({ from: FROM, head: HEAD, intent }));
  assert.equal(prompt.slice(bare.length), whole.slice(body(reviewPrompt({ from: FROM, head: HEAD })).length), 'the same section, word for word');
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

test('quotedPath refuses the quotes PowerShell reads as quotes, which would end the single quotes a path is written in', () => {
  // PowerShell takes each of these for a quote, as it takes `'` and `"`: U+2018 to U+201B close a
  // single-quoted string, and U+201C to U+201E are double quotes. `sh` reads none of them, so no one way of
  // writing such a path holds in both shells.
  const smart = ['\u2018', '\u2019', '\u201a', '\u201b', '\u201c', '\u201d', '\u201e'];
  for (const quote of smart) {
    const name = `it${quote}s.txt`;
    const code = `U+${quote.codePointAt(0).toString(16).toUpperCase()}`;
    assert.throws(() => quotedPath(name), /cannot be written safely/, code);
    assert.throws(() => quotedPath(name), (err) => err.message.includes(JSON.stringify(name)), `${code}: the error names the path`);
    assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part: { ...PART, files: ['ok.txt', name] } }), /cannot be written safely/, code);
  }
  // Other letters outside ASCII are still written, in single quotes: only what a shell reads as a quote is refused.
  for (const path of ['a\u00f1o/caf\u00e9.js', 'a\u2013b.txt', '\u00abx\u00bb.txt', 'a\u201fb.txt']) assert.equal(quotedPath(path), `'${path}'`, path);
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

// --- a range that leaves files out of the review ---

test('a part of a range that leaves files out says the other files are in the other parts or left out, and is the text it was when none is', () => {
  const none = reviewPrompt({ from: FROM, head: HEAD, part: PART });
  assert.equal(reviewPrompt({ from: FROM, head: HEAD, part: PART, leftOut: 0 }), none);
  assert.ok(body(none).endsWith('The other files the range changes are reviewed in the other parts: read them for context, and report nothing about them.\n'), none);
  const some = reviewPrompt({ from: FROM, head: HEAD, part: PART, leftOut: 4 });
  const lines = some.split('\n');
  assert.deepEqual(lines.slice(0, 3), none.split('\n').slice(0, 3), 'what is reviewed, and how it is shown, are said as they were');
  assert.equal(lines[3], 'The other files the range changes are reviewed in the other parts, or left out of the review: read them for context, and report nothing about them.');
  // How many are left out, and which, is not in the prompt: it is paid on every request of the review.
  assert.equal(some, reviewPrompt({ from: FROM, head: HEAD, part: PART, leftOut: 40 }));
  assert.doesNotMatch(some, /\b4\b|\.json|evals/);
});

test('a range of one part that leaves files out is asked by its files, as a part is, and is not called a part', () => {
  const sole = { index: 1, of: 1, files: ['bin/a.mjs', 'src/my code.js'] };
  const prompt = body(reviewPrompt({ from: FROM, head: HEAD, part: sole, leftOut: 2 }));
  assert.equal(
    prompt,
    `Review the code changes in the committed range ${FROM}..${HEAD}. This review covers the files the command below names.\n` +
      `Run \`git --literal-pathspecs diff --no-renames ${FROM} ${HEAD} -- bin/a.mjs 'src/my code.js'\` to inspect them: its output is the whole change under review.\n` +
      'Report only what is wrong with the lines that diff adds or changes. Read any other file of the repository for context, and report nothing about code the diff leaves as it was.\n' +
      'The other files the range changes are left out of this review: read them for context, and report nothing about them.\n',
  );
  assert.doesNotMatch(prompt, /\bparts?\b/);
  // The intent goes after it, as after any other.
  const intent = { goal: 'The command measures every attempt.', doneWhen: '- `npm run check` exits 0' };
  const withIntent = body(reviewPrompt({ from: FROM, head: HEAD, part: sole, leftOut: 2, intent }));
  assert.ok(withIntent.startsWith(prompt), withIntent);
  assert.equal(withIntent.slice(prompt.length), body(reviewPrompt({ from: FROM, head: HEAD, intent })).slice(body(reviewPrompt({ from: FROM, head: HEAD })).length));
});

test('reviewPrompt refuses what cannot be: a whole range that leaves files out, one part of a range that leaves none out, a count that is none', () => {
  // The prompt of a whole range names no file, so its command would show the files that were left out.
  assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, leftOut: 1 }), /leaves files out/);
  // A range of one part that leaves nothing out is reviewed whole, with the prompt of a whole range.
  assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part: { index: 1, of: 1, files: ['a.js'] } }), /part/i);
  for (const leftOut of [-1, 1.5, '2', null, Number.NaN]) assert.throws(() => reviewPrompt({ from: FROM, head: HEAD, part: PART, leftOut }), /left out/, JSON.stringify(leftOut));
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
