import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoadmap, parseFeature, tokenize } from './progress.mjs';

// Every checkbox list item of `markdown`, in document order: `- [ ]`/`- [x]`/`- [X]`, also `*`/`+` bullets, any
// leading indent. Lines inside a fenced code block are ignored, and `[ ]`-looking text that does not start a list
// item is not a step. The tests below pin the tokenizer's steps through it.
const stepsOf = (markdown) => tokenize(markdown).filter((token) => token.step).map((token) => token.step);

// --- stepsOf ---

test('stepsOf reads `- [ ]` and `- [x]` bullets, trims text', () => {
  const md = '- [ ] pending step\n- [x] done step\n';
  assert.deepEqual(stepsOf(md), [
    { text: 'pending step', done: false },
    { text: 'done step', done: true },
  ]);
});

test('stepsOf accepts an uppercase `X`', () => {
  assert.deepEqual(stepsOf('- [X] done step\n'), [{ text: 'done step', done: true }]);
});

test('stepsOf accepts `*` and `+` bullets', () => {
  const md = '* [ ] star bullet\n+ [x] plus bullet\n';
  assert.deepEqual(stepsOf(md), [
    { text: 'star bullet', done: false },
    { text: 'plus bullet', done: true },
  ]);
});

test('stepsOf accepts any leading indent', () => {
  const md = '  - [ ] indented two\n\t- [x] indented tab\n      - [ ] indented six\n';
  assert.deepEqual(stepsOf(md), [
    { text: 'indented two', done: false },
    { text: 'indented tab', done: true },
    { text: 'indented six', done: false },
  ]);
});

test('stepsOf trims surrounding whitespace from the step text', () => {
  assert.deepEqual(stepsOf('- [ ]   spaced out text   \n'), [{ text: 'spaced out text', done: false }]);
});

test('stepsOf ignores lines inside a fenced code block, both ``` and ~~~ fences', () => {
  const md = [
    '- [ ] a real step',
    '```',
    '- [ ] fenced, not a step',
    '```',
    '~~~',
    '- [x] also fenced, not a step',
    '~~~',
    '- [x] another real step',
    '',
  ].join('\n');
  assert.deepEqual(stepsOf(md), [
    { text: 'a real step', done: false },
    { text: 'another real step', done: true },
  ]);
});

test('stepsOf does not treat `[ ]`-looking text as a step unless it starts a list item', () => {
  const md = 'Some prose with [ ] in the middle, not a step.\n- [ ] a real step\n';
  assert.deepEqual(stepsOf(md), [{ text: 'a real step', done: false }]);
});

// --- fence closer must match the opener's character and length (R3-fence-mismatch, Codex P2) ---

test('stepsOf: a ```` opener is not closed by a shorter ``` line, only by ```` or longer', () => {
  const md = [
    '````',
    '- [ ] fenced',
    '```',
    '- [ ] still fenced (3 backticks is shorter than the 4-backtick opener)',
    '````',
    '- [x] real step after the fence closes',
    '',
  ].join('\n');
  assert.deepEqual(stepsOf(md), [{ text: 'real step after the fence closes', done: true }]);
});

test('stepsOf: a ~~~~ opener wrapping a ``` block keeps the checkbox inside fenced, and counts real steps after it closes', () => {
  const md = [
    '~~~~markdown',
    '```',
    '- [ ] fenced, inside the outer ~~~~ block',
    '```',
    '~~~~',
    '- [x] real step after the outer fence closes',
    '',
  ].join('\n');
  assert.deepEqual(stepsOf(md), [{ text: 'real step after the outer fence closes', done: true }]);
});

test('stepsOf: a ``` line inside a ~~~ fence does not close it (different fence character)', () => {
  const md = [
    '~~~',
    '- [ ] fenced',
    '```',
    '- [ ] still fenced, backticks do not close a tilde fence',
    '~~~',
    '- [x] real step after',
    '',
  ].join('\n');
  assert.deepEqual(stepsOf(md), [{ text: 'real step after', done: true }]);
});

test('stepsOf: an unclosed fence runs to end of file, so nothing inside it is ever a step', () => {
  const md = ['```', '- [ ] fenced, never closed', '- [x] also fenced, still never closed', ''].join('\n');
  assert.deepEqual(stepsOf(md), []);
});

test('stepsOf: a longer closing fence than the opener still closes it', () => {
  const md = ['```', '- [ ] fenced', '````', '- [x] real step after (longer closer still closes)', ''].join('\n');
  assert.deepEqual(stepsOf(md), [{ text: 'real step after (longer closer still closes)', done: true }]);
});

// --- a backtick fence opener's info string may not contain a backtick (R3-backtick-info-string) ---

test('stepsOf: a line with backticks after a leading ``` is not a fence opener, so it does not fence what follows', () => {
  const md = [
    "```inline``` text",
    "- [x] counted, not fenced (the opener's info string contains a backtick)",
    '# Heading still seen',
    '',
  ].join('\n');
  assert.deepEqual(stepsOf(md), [
    { text: "counted, not fenced (the opener's info string contains a backtick)", done: true },
  ]);
});

test('stepsOf: a plain ```js opener (no backtick in its info string) still fences normally', () => {
  const md = ['```js', '- [ ] fenced (a valid opener, no backtick in the info string)', '```', '- [x] real step after', ''].join(
    '\n',
  );
  assert.deepEqual(stepsOf(md), [{ text: 'real step after', done: true }]);
});

test('stepsOf: a ~~~ opener may contain backticks in its info string and still fences', () => {
  const md = ['~~~ a`b`', '- [ ] fenced (tilde openers may contain backticks)', '~~~', '- [x] real step after', ''].join(
    '\n',
  );
  assert.deepEqual(stepsOf(md), [{ text: 'real step after', done: true }]);
});

test('parseFeature: a heading is still seen after a line whose backtick-info disqualifies it as a fence opener', () => {
  const md = ["# My feature", '', "```inline``` text", '- [x] a real step', ''].join('\n');
  const result = parseFeature(md, 'my-feature');
  assert.equal(result.title, 'My feature');
  assert.deepEqual(result.steps, [{ text: 'a real step', done: true }]);
});

test('stepsOf works on CRLF input', () => {
  const md = '- [ ] first\r\n- [x] second\r\n';
  assert.deepEqual(stepsOf(md), [
    { text: 'first', done: false },
    { text: 'second', done: true },
  ]);
});

test('stepsOf returns an empty array for markdown with no checkboxes', () => {
  assert.deepEqual(stepsOf('# Title\n\nJust prose.\n'), []);
});

// --- parseRoadmap ---

test('parseRoadmap returns empty phases/done/total when there is no `## Checklist` section', () => {
  const md = '# Roadmap\n\n## Phases\n\n- [ ] not counted\n';
  assert.deepEqual(parseRoadmap(md), { phases: [], done: 0, total: 0 });
});

test('parseRoadmap groups steps under the nearest preceding `### <title>` heading', () => {
  const md = [
    '## Checklist',
    '',
    '### Phase one',
    '- [x] step a',
    '- [ ] step b',
    '',
    '### Phase two',
    '- [x] step c',
    '',
  ].join('\n');
  assert.deepEqual(parseRoadmap(md), {
    phases: [
      { title: 'Phase one', done: 1, total: 2, steps: [{ text: 'step a', done: true }, { text: 'step b', done: false }] },
      { title: 'Phase two', done: 1, total: 1, steps: [{ text: 'step c', done: true }] },
    ],
    done: 2,
    total: 3,
  });
});

test('parseRoadmap stops the Checklist section at the next `## ` heading', () => {
  const md = [
    '## Checklist',
    '',
    '### Phase one',
    '- [x] step a',
    '',
    '## Next section',
    '',
    '### Not a phase',
    '- [ ] not counted',
    '',
  ].join('\n');
  assert.deepEqual(parseRoadmap(md), {
    phases: [{ title: 'Phase one', done: 1, total: 1, steps: [{ text: 'step a', done: true }] }],
    done: 1,
    total: 1,
  });
});

test('parseRoadmap shows a `###` heading with no steps as 0/0', () => {
  const md = ['## Checklist', '', '### Empty phase', '', '### Phase with steps', '- [x] step a', ''].join('\n');
  assert.deepEqual(parseRoadmap(md), {
    phases: [
      { title: 'Empty phase', done: 0, total: 0, steps: [] },
      { title: 'Phase with steps', done: 1, total: 1, steps: [{ text: 'step a', done: true }] },
    ],
    done: 1,
    total: 1,
  });
});

test('parseRoadmap puts checkboxes before the first `###` in the section under `(unassigned)`', () => {
  const md = ['## Checklist', '', '- [ ] loose step', '', '### Phase one', '- [x] step a', ''].join('\n');
  assert.deepEqual(parseRoadmap(md), {
    phases: [
      { title: '(unassigned)', done: 0, total: 1, steps: [{ text: 'loose step', done: false }] },
      { title: 'Phase one', done: 1, total: 1, steps: [{ text: 'step a', done: true }] },
    ],
    done: 1,
    total: 2,
  });
});

test('parseRoadmap never creates `(unassigned)` when the section has no steps before the first `###`', () => {
  const md = ['## Checklist', '', '### Phase one', '- [x] step a', ''].join('\n');
  const result = parseRoadmap(md);
  assert.equal(result.phases.some((p) => p.title === '(unassigned)'), false);
});

test('parseRoadmap ignores checkboxes and headings inside a fenced code block', () => {
  const md = [
    '## Checklist',
    '',
    '### Phase one',
    '- [ ] real step',
    '```',
    '### Fake phase',
    '- [x] fenced, not a step',
    '```',
    '- [x] another real step',
    '',
  ].join('\n');
  assert.deepEqual(parseRoadmap(md), {
    phases: [
      {
        title: 'Phase one',
        done: 1,
        total: 2,
        steps: [{ text: 'real step', done: false }, { text: 'another real step', done: true }],
      },
    ],
    done: 1,
    total: 2,
  });
});

test('parseRoadmap works on CRLF input', () => {
  const md = '## Checklist\r\n\r\n### Phase one\r\n- [x] step a\r\n';
  assert.deepEqual(parseRoadmap(md), {
    phases: [{ title: 'Phase one', done: 1, total: 1, steps: [{ text: 'step a', done: true }] }],
    done: 1,
    total: 1,
  });
});

// --- parseFeature ---

test('parseFeature titles from the first `# ` heading and collects every checkbox in the file', () => {
  const md = [
    '# My feature',
    '',
    '## Tasks',
    '- [x] T1 done',
    '- [ ] T2 pending',
    '',
    '## Progress',
    '- [ ] not a task, still a checkbox',
    '',
  ].join('\n');
  assert.deepEqual(parseFeature(md, 'my-feature'), {
    id: 'my-feature',
    title: 'My feature',
    done: 1,
    total: 3,
    steps: [
      { text: 'T1 done', done: true },
      { text: 'T2 pending', done: false },
      { text: 'not a task, still a checkbox', done: false },
    ],
  });
});

test('parseFeature falls back to the id when there is no `# ` heading', () => {
  const md = '## Tasks\n- [x] T1 done\n';
  const result = parseFeature(md, 'untitled-feature');
  assert.equal(result.title, 'untitled-feature');
});

test('parseFeature trims the title text', () => {
  const md = '#   Spaced title   \n';
  assert.equal(parseFeature(md, 'x').title, 'Spaced title');
});

// S2 of odd/tasks/first-version.md: a feature whose tasks are a table counted 0/0. A task table is one whose header
// names an `ID` and a `Status` cell; each row whose ID is a task (`T2`, `T3c`) is a step, done when its status cell
// starts with `done`.
const TASK_TABLE = [
  '# Test run warning',
  '',
  '## Tasks',
  '',
  '| ID | Specs | Route | Status | Evidence |',
  '|----|-------|-------|--------|----------|',
  '| T1 | S1, S2 | inline | done | RED: the module missing; GREEN: 3/3 |',
  '| T2 | S2 | JH 15 | pending | the Bash case in `js-harness guard --hook` |',
  '| T3a | S3 | inline | T3a done, T3b not yet | half of it |',
  '| T4 | S4 | inline | Done, `850cc9f` | the status is read without regard to case |',
  '',
].join('\n');

test('parseFeature counts the rows of a task table, each done when its status cell starts with done', () => {
  const result = parseFeature(TASK_TABLE, 'test-run-warning');
  assert.deepEqual([result.done, result.total], [2, 4]);
  assert.deepEqual(result.steps, [
    { text: 'T1 | S1, S2 | inline | done | RED: the module missing; GREEN: 3/3', done: true },
    { text: 'T2 | S2 | JH 15 | pending | the Bash case in `js-harness guard --hook`', done: false },
    { text: 'T3a | S3 | inline | T3a done, T3b not yet | half of it', done: false },
    { text: 'T4 | S4 | inline | Done, `850cc9f` | the status is read without regard to case', done: true },
  ]);
});

test('the status cell is found by its header, wherever the column is, and an escaped pipe stays inside its cell', () => {
  const md = ['| Status | ID | Note |', '| --- | :-: | --- |', '| done | T1 | a \\| b |', '| open | T2 | c |', ''].join('\n');
  const { done, total, steps } = parseFeature(md, 'x');
  assert.deepEqual([done, total], [1, 2]);
  assert.equal(steps[0].text, 'done | T1 | a \\| b');
});

test('a table with no ID or no Status header, a row whose ID is no task, and a table in a fence are not counted', () => {
  const md = [
    '| Page | Status |',
    '|------|--------|',
    '| T1 | done |',
    '',
    '| ID | Owner |',
    '|----|-------|',
    '| T2 | him |',
    '',
    '| ID | Status |',
    '|----|--------|',
    '| L1 | done |',
    '| ID | done |',
    '',
    '```',
    '| ID | Status |',
    '|----|--------|',
    '| T3 | done |',
    '```',
    '',
  ].join('\n');
  assert.deepEqual(parseFeature(md, 'x').total, 0);
});

test('a header row with no delimiter row under it is no table, and a table ends at its first line that is not a row', () => {
  const md = ['| ID | Status |', '| T1 | done |', '', '| ID | Status |', '|---|---|', '| T2 | done |', 'text', '| T3 | done |', ''].join('\n');
  assert.deepEqual(parseFeature(md, 'x').steps, [{ text: 'T2 | done', done: true }]);
});

test('checkboxes and table rows are both steps, in the order of the document', () => {
  const md = ['# Mixed', '- [x] T0 a checkbox', '', '| ID | Status |', '|---|---|', '| T1 | pending |', '', '- [ ] T9 another', ''].join('\n');
  assert.deepEqual(parseFeature(md, 'mixed').steps.map((step) => step.text), ['T0 a checkbox', 'T1 | pending', 'T9 another']);
});

test('parseRoadmap still counts checkboxes only: a task table in the Checklist is not its phase\'s step', () => {
  const md = ['## Checklist', '### Phase', '- [x] a', '| ID | Status |', '|---|---|', '| T1 | pending |', ''].join('\n');
  assert.deepEqual([parseRoadmap(md).done, parseRoadmap(md).total], [1, 1]);
});

test('tokenize keeps HTML comments unless stripComments is set, so progress counts are unchanged', () => {
  const md = '<!--\n- [ ] hidden\n-->\n- [x] shown\n';
  assert.equal(stepsOf(md).length, 2);
  assert.deepEqual(tokenize(md, { stripComments: true }).filter((t) => t.step).map((t) => t.step.text), ['shown']);
});

test('tokenize takes a fence indented past three spaces of what it is under only with indentedFences', () => {
  const kinds = (tokens) => tokens.map((t) => (t.fence ? 'fence' : t.step ? 'step' : 'text'));
  // Under no list item, four spaces is past three: text without the option, a fence with it.
  const loose = 'a paragraph\n\n    ```\n    - [ ] an example\n    ```\n- [ ] the next task\n';
  assert.equal(stepsOf(loose).length, 2);
  assert.deepEqual(kinds(tokenize(loose)), ['text', 'text', 'text', 'step', 'text', 'step', 'text']);
  assert.deepEqual(kinds(tokenize(loose, { indentedFences: true })), ['text', 'text', 'fence', 'fence', 'fence', 'step', 'text']);
  // Under a list item whose text starts at column 2, eight spaces is past three of it.
  const deep = '- [ ] a task\n        ```\n        - [ ] an example\n        ```\n- [ ] the next task\n';
  assert.equal(stepsOf(deep).length, 3);
  assert.deepEqual(kinds(tokenize(deep, { indentedFences: true })), ['step', 'fence', 'fence', 'fence', 'step', 'text']);
  const md = '- [ ] a task\n    ```\n    - [ ] an example\n    <!-- never closed\n    ```\n- [ ] the next task\n';
  assert.deepEqual(kinds(tokenize(md, { indentedFences: true })), ['step', 'fence', 'fence', 'fence', 'fence', 'step', 'text']);
  // The comment the fence holds opens nothing, and the code span below opens no fence.
  assert.deepEqual(kinds(tokenize(md, { indentedFences: true, stripComments: true })), ['step', 'fence', 'fence', 'fence', 'fence', 'step', 'text']);
  const span = '- [ ] a task\n    ```inline``` in a wrapped line\n- [ ] the next task\n';
  assert.deepEqual(kinds(tokenize(span, { indentedFences: true })), ['step', 'text', 'step', 'text']);
});

test('with indentedFences a fence still closes by the rule it opened with: a deeper marker inside a fence at the margin is its content', () => {
  const kinds = (md) => tokenize(md, { indentedFences: true }).map((t) => (t.fence ? 'fence' : t.step ? 'step' : 'text'));
  const atTheMargin = '```\n    ```\n- [ ] an example\n```\n- [ ] the next task\n';
  assert.deepEqual(kinds(atTheMargin), ['fence', 'fence', 'fence', 'fence', 'step', 'text']);
  assert.deepEqual(tokenize(atTheMargin).map((t) => Boolean(t.fence)), tokenize(atTheMargin, { indentedFences: true }).map((t) => Boolean(t.fence)));
  // A fence that opened deeper is closed by its marker at any depth, the margin included.
  const deeper = '- [ ] a task\n    ```\n    - [ ] an example\n```\n- [ ] the next task\n';
  assert.deepEqual(kinds(deeper), ['step', 'fence', 'fence', 'fence', 'step', 'text']);
});

// A fence is measured from the list item it is under, as CommonMark does, not from the margin.
const fenceKinds = (md, options) => tokenize(md, options).map((t) => (t.fence ? 'fence' : t.step ? 'step' : 'text'));

test('a fence under a list item is a fence without the option, so a checkbox it shows is no step', () => {
  const md = '- [ ] a task\n    ```\n    - [ ] an example\n    ```\n- [ ] the next task\n';
  assert.deepEqual(fenceKinds(md), ['step', 'fence', 'fence', 'fence', 'step', 'text']);
  assert.deepEqual(stepsOf(md).map((step) => step.text), ['a task', 'the next task']);
  assert.equal(parseFeature(`# F\n${md}`, 'f').total, 2);
  // Under a numbered item and under an item of an item, the text's column is further in.
  const numbered = '10. a numbered line\n    ```\n    - [ ] an example\n    ```\n- [ ] the next task\n';
  assert.deepEqual(fenceKinds(numbered), ['text', 'fence', 'fence', 'fence', 'step', 'text']);
  const nested = '- a list\n  - [ ] a task\n       ```\n       - [ ] an example\n       ```\n- [ ] the next task\n';
  assert.deepEqual(fenceKinds(nested), ['text', 'step', 'fence', 'fence', 'fence', 'step', 'text']);
});

test('a fence under a list item closes by a marker within three spaces of the item, deeper than three of the margin too', () => {
  // Codex's case: opened at two spaces, closed at four, under an item whose text starts at column 2.
  const md = '- [ ] a task\n  ```\n  - [ ] an example\n    ```\n- [ ] the next task\n';
  for (const options of [{}, { indentedFences: true }]) {
    assert.deepEqual(fenceKinds(md, options), ['step', 'fence', 'fence', 'fence', 'step', 'text'], JSON.stringify(options));
  }
  // Past three spaces of the item, the marker is content of the fence, which runs on.
  const tooDeep = '- [ ] a task\n  ```\n  - [ ] an example\n      ```\n- [ ] fenced still\n';
  assert.deepEqual(fenceKinds(tooDeep), ['step', 'fence', 'fence', 'fence', 'fence', 'fence']);
});

test('a fence that opens at the margin leaves the list item, so a later fence is measured from the margin', () => {
  // Were the item still open, the four-space marker would close the second fence and the last line be a step.
  const md = '- [ ] a task\n```\nat the margin\n```\n  ```\n  - [ ] an example\n    ```\n- [ ] fenced still\n';
  assert.deepEqual(fenceKinds(md), ['step', 'fence', 'fence', 'fence', 'fence', 'fence', 'fence', 'fence', 'fence']);
  assert.deepEqual(stepsOf(md).map((step) => step.text), ['a task']);
});

test('a thematic break written with spaces opens no list item', () => {
  for (const rule of ['* * *', '- - -', '  -  -  -  ']) {
    const md = `${rule}\n  \`\`\`\n  - [ ] an example\n    \`\`\`\n- [ ] fenced still\n`;
    assert.deepEqual(fenceKinds(md), ['text', 'fence', 'fence', 'fence', 'fence', 'fence'], rule);
  }
  // A bullet whose text is a star is still an item.
  const item = '* a\n    ```\n    - [ ] an example\n    ```\n- [ ] the next task\n';
  assert.deepEqual(fenceKinds(item), ['text', 'fence', 'fence', 'fence', 'step', 'text']);
});

test('a line back at the margin leaves the list item: a fence four spaces in is then text again', () => {
  const md = '- [ ] a task\nback at the margin\n    ```\n    - [ ] an example\n    ```\n';
  assert.deepEqual(fenceKinds(md), ['step', 'text', 'text', 'step', 'text', 'text']);
  // A blank line does not leave it.
  const blank = '- [ ] a task\n\n    ```\n    - [ ] an example\n    ```\n';
  assert.deepEqual(fenceKinds(blank), ['step', 'text', 'fence', 'fence', 'fence', 'text']);
});
