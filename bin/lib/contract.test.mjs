import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_TEMPLATE, isContract, parseContract, validateContract, doneWhen, tasksOf, taskModes, modeLine } from './contract.mjs';

/** A complete contract; each test breaks one thing in it. */
const GOOD = [
  '# A feature',
  '',
  '## Goal',
  'Ship the thing.',
  '',
  '## Why',
  'Because the loop needs evidence.',
  '',
  '## Done when',
  '- `npm run check` exits 0',
  '- `node bin/x.mjs --flag` exits 0',
  '- The output names the failing file',
  '',
  '## In scope / Out of scope',
  '- In: bin/',
  '- Out: docs/, because they are frozen',
  '',
  '## Constraints',
  '- Zero dependencies — because it must run anywhere',
  '',
  '## Effort',
  'high',
  '',
  '## Ask me before',
  'Changing the template.',
  '',
  '## Tasks',
  '- [ ] T1 something',
  '',
].join('\n');

// The sections a contract must have; `## Effort` is optional since a task's kind sets its effort.
const SECTIONS = ['Goal', 'Why', 'Done when', 'In scope / Out of scope', 'Constraints', 'Ask me before'];

/** `GOOD` with one section's body replaced (or the whole section dropped when `body` is null). */
function withSection(title, body) {
  const pattern = new RegExp(`## ${title.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}\\n[\\s\\S]*?(?=\\n## |$)`);
  return GOOD.replace(pattern, body === null ? '' : `## ${title}\n${body}\n`);
}

test('the template fails validation: it is all placeholders', () => {
  const { ok, errors } = validateContract(CONTRACT_TEMPLATE);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /placeholder/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /^task T1 names the kind/.test(e)), errors.join('\n'));
});

test('the template is a contract with every section, in order, then a task line that names its kind', () => {
  assert.equal(isContract(CONTRACT_TEMPLATE), true);
  assert.deepEqual([...parseContract(CONTRACT_TEMPLATE).keys()], [...SECTIONS, 'Tasks']);
  assert.match(parseContract(CONTRACT_TEMPLATE).get('Tasks'), /^- \[ \] T1 \(kind: design \| build \| verify \| docs\)/);
});

test('a filled-in contract passes', () => {
  assert.deepEqual(validateContract(GOOD), { ok: true, errors: [] });
});

test('sections after the seven (Tasks, Progress) do not disturb a contract', () => {
  assert.equal(validateContract(`${GOOD}\n## Progress\n- 2026-09-29: started\n`).ok, true);
});

test('a missing section is named', () => {
  for (const title of SECTIONS) {
    const { ok, errors } = validateContract(withSection(title, null));
    assert.equal(ok, false, title);
    assert.ok(errors.some((e) => e.includes(`## ${title}`) && /missing/.test(e)), `${title}: ${errors.join('\n')}`);
  }
});

test('an empty section is named, and comments and blank lines count as empty', () => {
  const { ok, errors } = validateContract(withSection('Why', '\n<!-- to fill in -->\n'));
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('## Why') && /empty/.test(e)), errors.join('\n'));
});

test('a Done when with only prose is rejected, and the reason mentions a command', () => {
  const { ok, errors } = validateContract(withSection('Done when', '- It works\n- Reviewers are happy'));
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /command/.test(e)), errors.join('\n'));
});

test('a code span without "exits 0" is a human check, not a command', () => {
  const md = withSection('Done when', '- `npm test` passes\n- `node x.mjs` shows the rows');
  const { ok, errors } = validateContract(md);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /command/.test(e)), errors.join('\n'));
});

test('"exits 0" without a leading code span is not a command', () => {
  const { ok } = validateContract(withSection('Done when', '- npm run check exits 0'));
  assert.equal(ok, false);
});

test('a command that still holds a placeholder is rejected and quoted', () => {
  const md = withSection('Done when', '- `<script>` exits 0');
  const { ok, errors } = validateContract(md);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /placeholder/.test(e) && e.includes('<script>')), errors.join('\n'));
});

test('a redirect in a real command is not mistaken for a placeholder', () => {
  const md = withSection('Done when', '- `node x.mjs > out.txt` exits 0');
  assert.equal(validateContract(md).ok, true);
});

test('Effort must be exactly medium or high', () => {
  for (const bad of ['low', 'medium | high', 'high, probably', '']) {
    const { ok, errors } = validateContract(withSection('Effort', bad));
    assert.equal(ok, false, bad);
    assert.ok(errors.some((e) => e.includes('Effort')), `${bad}: ${errors.join('\n')}`);
  }
  for (const good of ['medium', 'high', '  High  ', 'MEDIUM']) {
    assert.equal(validateContract(withSection('Effort', good)).ok, true, good);
  }
});

test('every problem is reported, not just the first', () => {
  const md = withSection('Done when', '- It works').replace(/## Why[\s\S]*?\n(?=## Done)/, '').replace('high', 'low');
  const { errors } = validateContract(md);
  assert.ok(errors.length >= 3, errors.join('\n'));
});

test('a ## Goal inside a fenced block does not make a document a contract', () => {
  const md = ['# Notes', '', '```markdown', '## Goal', 'x', '```', ''].join('\n');
  assert.equal(isContract(md), false);
  assert.equal(parseContract(md).size, 0);
});

test('a document with no ## Goal is not a contract', () => {
  assert.equal(isContract('# Feature\n\n## Tasks\n- [ ] T1\n'), false);
});

test('CRLF input parses like LF', () => {
  const crlf = GOOD.replace(/\n/g, '\r\n');
  assert.deepEqual(validateContract(crlf), { ok: true, errors: [] });
  assert.equal(parseContract(crlf).get('Effort'), 'high');
});

test('parseContract keeps the first section of a duplicated title and its ### subheadings', () => {
  const md = `${GOOD}\n## Goal\nsecond\n`.replace('Ship the thing.', 'Ship the thing.\n### Detail\nmore');
  assert.match(parseContract(md).get('Goal'), /^Ship the thing\.\n### Detail\nmore$/);
});

test('doneWhen splits commands from human checks, in order', () => {
  assert.deepEqual(doneWhen(GOOD), {
    commands: ['npm run check', 'node bin/x.mjs --flag'],
    checks: ['The output names the failing file'],
  });
});

test('doneWhen joins a wrapped list item and skips fenced lines', () => {
  const md = withSection(
    'Done when',
    ['- `npm run check`', '  exits 0', '- A human check', '  that wraps', '```', '- `ignored` exits 0', '```'].join('\n'),
  );
  assert.deepEqual(doneWhen(md), { commands: ['npm run check'], checks: ['A human check that wraps'] });
});

test('doneWhen of a document with no Done when is empty', () => {
  assert.deepEqual(doneWhen('# x\n'), { commands: [], checks: [] });
});

// --- review follow-ups (Codex P2 x3) ---

test('a commented-out command never counts, on one line or across several', () => {
  for (const body of ['- <!-- `npm test` exits 0 -->\n- It works', '<!--\n- `npm test` exits 0\n-->\n- It works']) {
    const { ok, errors } = validateContract(withSection('Done when', body));
    assert.equal(ok, false, body);
    assert.ok(errors.some((e) => /no command/.test(e)), errors.join('\n'));
    assert.deepEqual(doneWhen(withSection('Done when', body)).commands, [], body);
  }
});

test('a comment can hide a heading: a commented ## Goal makes no contract and a commented section is not a section', () => {
  assert.equal(isContract('# x\n\n<!--\n## Goal\nnope\n-->\n'), false);
  const md = GOOD.replace('## Why', '<!--\n## Constraints\nghost\n-->\n## Why');
  assert.equal(parseContract(md).get('Constraints'), '- Zero dependencies — because it must run anywhere');
});

test('text around a comment on the same line is kept', () => {
  const md = withSection('Done when', '- `npm run check` <!-- note --> exits 0');
  assert.deepEqual(doneWhen(md).commands, ['npm run check']);
});

test('a comment opener inside a code fence is content, not a comment', () => {
  const md = GOOD.replace('Ship the thing.', 'Ship the thing.\n```\n<!-- not a comment\n```');
  assert.match(parseContract(md).get('Goal'), /<!-- not a comment/);
  assert.equal(parseContract(md).get('Why'), 'Because the loop needs evidence.'); // a real opener would swallow it
});

test('a placeholder is a code span that is wholly one <...>; an <ok> inside a real command passes', () => {
  for (const good of ['node -e "console.log(\'<ok>\')"', 'cmd <in.txt >out.txt', 'npm run <script> --silent']) {
    assert.equal(validateContract(withSection('Done when', `- \`${good}\` exits 0`)).ok, true, good);
  }
  for (const bad of ['<command>', '  <the check>  ']) {
    const { ok, errors } = validateContract(withSection('Done when', `- \`${bad}\` exits 0`));
    assert.equal(ok, false, bad);
    assert.ok(errors.some((e) => /placeholder/.test(e)), errors.join('\n'));
  }
});

test('a code span that is empty after trimming is not a command', () => {
  const md = withSection('Done when', '- ` ` exits 0');
  assert.deepEqual(doneWhen(md).commands, []);
  const { ok, errors } = validateContract(md);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /no command/.test(e)), errors.join('\n'));
});

// --- review follow-ups (slice 2) ---

test('comment markers inside an inline code span are content and survive unchanged', () => {
  const command = `node -e "console.log('<!-- marker -->')"`;
  const md = withSection('Done when', `- \`${command}\` exits 0`);
  assert.deepEqual(doneWhen(md).commands, [command]);
  assert.equal(validateContract(md).ok, true);
});

test('an unmatched <!-- inside a code span does not hide the sections after it', () => {
  const md = withSection('Done when', "- `echo '<!--'` exits 0");
  assert.deepEqual(doneWhen(md).commands, ["echo '<!--'"]);
  assert.equal(parseContract(md).get('Effort'), 'high');
  assert.equal(validateContract(md).ok, true);
});

test('a double-backtick span keeps a comment marker too, but a real comment next to a span is still removed', () => {
  const md = withSection('Done when', '- ``a ` <!-- b`` exits 0 <!-- `hidden` exits 0 -->');
  assert.deepEqual(doneWhen(md).commands, ['a ` <!-- b']);
});

test('a line that opens a fence with <!-- after the marker leaves no comment open after the fence closes', () => {
  const md = GOOD.replace('Ship the thing.', 'Ship the thing.\n```text <!-- oops\nfenced\n```');
  assert.match(parseContract(md).get('Goal'), /<!-- oops/);
  assert.equal(parseContract(md).get('Why'), 'Because the loop needs evidence.');
  assert.equal(validateContract(md).ok, true);
});
const TASKS = [
  '## Tasks',
  '- [x] T1 (kind: design) The design, read by two readers',
  '- [ ] T2 (kind: build) The parser (route: inline)',
  '  - [ ] T2a (kind: verify) Its measure',
  '- [ ] T3 The rest, with no kind',
  '- [ ] Not a task: no ID',
  '```',
  '- [ ] T9 (kind: build) inside a fence',
  '```',
].join('\n');

/** A reader of the rules as a project that declares today's table gives them. */
const DECLARED = {
  'session-effort': { value: 'high' },
  'subagent-writer-model': { value: 'claude-haiku-5-5', alias: 'haiku' },
  'subagent-reader-model': { value: 'claude-opus-5-5', alias: 'opus' },
  'subagent-effort': { value: 'high' },
};
const declared = (extra = {}) => (id) => ({ ...DECLARED, ...extra })[id] ?? null;

test('tasksOf reads each checklist line that opens with an ID, outside fences, with its kind and box', () => {
  assert.deepEqual(tasksOf(TASKS), [
    { id: 'T1', kind: 'design', done: true },
    { id: 'T2', kind: 'build', done: false },
    { id: 'T2a', kind: 'verify', done: false },
    { id: 'T3', kind: null, done: false },
  ]);
});

test('the task ID is read as the session board reads it', () => {
  // The board's `taskId` (bin/lib/sessions.mjs) is not exported; its pattern is copied here and held alike.
  const board = /^([A-Za-z]{1,6}\d+[a-z]?)(?=[\s:]|$)/;
  for (const text of ['T1 x', 'T16b: y', 'JH13 z', 'T1', 'Tx no', '12 no', 'T1· no']) {
    const step = `- [ ] ${text}`;
    assert.equal(tasksOf(step)[0]?.id ?? null, board.exec(text)?.[1] ?? null, text);
  }
});

test('taskModes gives every kind the session effort, writers only to build and to no kind', () => {
  const modes = taskModes(TASKS, declared());
  assert.deepEqual(modes.map(({ id, effort, writerModel, readerModel, subagentEffort, off }) => [id, effort, writerModel, readerModel, subagentEffort, off]), [
    ['T1', 'high', null, 'opus', 'high', null],
    ['T2', 'high', 'haiku', 'opus', 'high', null],
    ['T2a', 'high', null, 'opus', 'high', null],
    ['T3', 'high', 'haiku', 'opus', 'high', null],
  ]);
});

test('a kind with its own declared effort row takes it; the others keep the session effort', () => {
  const modes = taskModes(TASKS, declared({ 'session-effort-build': { value: 'medium' } }));
  assert.deepEqual(modes.map((m) => [m.id, m.effort]), [['T1', 'high'], ['T2', 'medium'], ['T2a', 'high'], ['T3', 'high']]);
});

test('a task with no kind takes the session rule, never the document\'s ## Effort', () => {
  const doc = withSection('Effort', 'medium') + '\n## Tasks\n- [ ] T1 Something\n';
  assert.equal(taskModes(doc, declared())[0].effort, 'high');
});

test('a project that declares no rules, or one ahead of this copy, gets off and no values', () => {
  for (const off of ['elsewhere', 'behind']) {
    const [mode] = taskModes('- [ ] T1 (kind: build) x', () => ({ off }));
    assert.deepEqual(mode, { id: 'T1', kind: 'build', done: false, effort: null, writerModel: null, readerModel: null, subagentEffort: null, off });
  }
});

test('modeLine prints the mode, the roles a kind launches, and the off reasons', () => {
  const [design, build, , none] = taskModes(TASKS, declared());
  assert.equal(modeLine(design), 'T1 (kind: design): session high; readers opus; every sub-agent at high');
  assert.equal(modeLine(build), 'T2 (kind: build): session high; writers haiku, readers opus; every sub-agent at high');
  assert.equal(modeLine(none), 'T3 (no kind): session high; writers haiku, readers opus; every sub-agent at high');
  assert.equal(modeLine({ id: 'T4', kind: 'docs', off: 'elsewhere' }), 'T4 (kind: docs): no effort or model declared in this project');
  assert.equal(modeLine({ id: 'T4', kind: null, off: 'behind' }), "T4 (no kind): this copy of the harness is older than the project's rules");
});

test('an unknown kind is a contract error naming the task and the kinds', () => {
  const { ok, errors } = validateContract(`${GOOD}\n## Tasks\n- [ ] T3 (kind: bild) The parser\n`);
  assert.equal(ok, false);
  assert.ok(errors.includes('task T3 names the kind "bild": one of design, build, verify, docs'), errors.join('\n'));
});

test('## Effort is optional: a contract without it passes, one with a wrong value still fails', () => {
  assert.deepEqual(validateContract(withSection('Effort', null)), { ok: true, errors: [] });
  assert.equal(validateContract(withSection('Effort', 'low')).ok, false);
});

test('an empty ## Effort is still named as an empty section, as before it became optional', () => {
  assert.deepEqual(validateContract(withSection('Effort', '')).errors, ['section "## Effort" is empty']);
});
