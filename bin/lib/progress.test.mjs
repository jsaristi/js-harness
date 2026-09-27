import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSteps, parseRoadmap, parseFeature } from './progress.mjs';

// --- parseSteps ---

test('parseSteps reads `- [ ]` and `- [x]` bullets, trims text', () => {
  const md = '- [ ] pending step\n- [x] done step\n';
  assert.deepEqual(parseSteps(md), [
    { text: 'pending step', done: false },
    { text: 'done step', done: true },
  ]);
});

test('parseSteps accepts an uppercase `X`', () => {
  assert.deepEqual(parseSteps('- [X] done step\n'), [{ text: 'done step', done: true }]);
});

test('parseSteps accepts `*` and `+` bullets', () => {
  const md = '* [ ] star bullet\n+ [x] plus bullet\n';
  assert.deepEqual(parseSteps(md), [
    { text: 'star bullet', done: false },
    { text: 'plus bullet', done: true },
  ]);
});

test('parseSteps accepts any leading indent', () => {
  const md = '  - [ ] indented two\n\t- [x] indented tab\n      - [ ] indented six\n';
  assert.deepEqual(parseSteps(md), [
    { text: 'indented two', done: false },
    { text: 'indented tab', done: true },
    { text: 'indented six', done: false },
  ]);
});

test('parseSteps trims surrounding whitespace from the step text', () => {
  assert.deepEqual(parseSteps('- [ ]   spaced out text   \n'), [{ text: 'spaced out text', done: false }]);
});

test('parseSteps ignores lines inside a fenced code block, both ``` and ~~~ fences', () => {
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
  assert.deepEqual(parseSteps(md), [
    { text: 'a real step', done: false },
    { text: 'another real step', done: true },
  ]);
});

test('parseSteps does not treat `[ ]`-looking text as a step unless it starts a list item', () => {
  const md = 'Some prose with [ ] in the middle, not a step.\n- [ ] a real step\n';
  assert.deepEqual(parseSteps(md), [{ text: 'a real step', done: false }]);
});

// --- fence closer must match the opener's character and length (R3-fence-mismatch, Codex P2) ---

test('parseSteps: a ```` opener is not closed by a shorter ``` line, only by ```` or longer', () => {
  const md = [
    '````',
    '- [ ] fenced',
    '```',
    '- [ ] still fenced (3 backticks is shorter than the 4-backtick opener)',
    '````',
    '- [x] real step after the fence closes',
    '',
  ].join('\n');
  assert.deepEqual(parseSteps(md), [{ text: 'real step after the fence closes', done: true }]);
});

test('parseSteps: a ~~~~ opener wrapping a ``` block keeps the checkbox inside fenced, and counts real steps after it closes', () => {
  const md = [
    '~~~~markdown',
    '```',
    '- [ ] fenced, inside the outer ~~~~ block',
    '```',
    '~~~~',
    '- [x] real step after the outer fence closes',
    '',
  ].join('\n');
  assert.deepEqual(parseSteps(md), [{ text: 'real step after the outer fence closes', done: true }]);
});

test('parseSteps: a ``` line inside a ~~~ fence does not close it (different fence character)', () => {
  const md = [
    '~~~',
    '- [ ] fenced',
    '```',
    '- [ ] still fenced, backticks do not close a tilde fence',
    '~~~',
    '- [x] real step after',
    '',
  ].join('\n');
  assert.deepEqual(parseSteps(md), [{ text: 'real step after', done: true }]);
});

test('parseSteps: an unclosed fence runs to end of file, so nothing inside it is ever a step', () => {
  const md = ['```', '- [ ] fenced, never closed', '- [x] also fenced, still never closed', ''].join('\n');
  assert.deepEqual(parseSteps(md), []);
});

test('parseSteps: a longer closing fence than the opener still closes it', () => {
  const md = ['```', '- [ ] fenced', '````', '- [x] real step after (longer closer still closes)', ''].join('\n');
  assert.deepEqual(parseSteps(md), [{ text: 'real step after (longer closer still closes)', done: true }]);
});

test('parseSteps works on CRLF input', () => {
  const md = '- [ ] first\r\n- [x] second\r\n';
  assert.deepEqual(parseSteps(md), [
    { text: 'first', done: false },
    { text: 'second', done: true },
  ]);
});

test('parseSteps returns an empty array for markdown with no checkboxes', () => {
  assert.deepEqual(parseSteps('# Title\n\nJust prose.\n'), []);
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
