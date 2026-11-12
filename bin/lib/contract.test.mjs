import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_TEMPLATE, cmdShellGap, commandsIn,isContract, parseContract, validateContract, doneWhen, tasksOf, taskModes, modeLine } from './contract.mjs';
import { taskId } from './sessions.mjs';

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

// Rule 1 puts the depth pass after the contract (odd/tasks/double-review-alignment.md, older text 8).
// F8 S6 opens it on the State head, what a resumed session reads first (odd/tasks/f8-s6-read-surface.md, spec 4).
test('the template opens on its State head, then is a contract with every section, in order, then the depth pass and a task line that names its kind', () => {
  assert.equal(isContract(CONTRACT_TEMPLATE), true);
  assert.deepEqual([...parseContract(CONTRACT_TEMPLATE).keys()], ['State', ...SECTIONS, 'Depth pass', 'Tasks']);
  assert.match(parseContract(CONTRACT_TEMPLATE).get('State'), /rewritten at each step and never appended to/);
  assert.match(parseContract(CONTRACT_TEMPLATE).get('Depth pass'), /- 1\. Method:[\s\S]*- 5\. Request:[\s\S]*Adds: none/);
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

// JH 136: cmd.exe passed `$(git` to `test` as written, and a met goal read "not met (exit 2)".
test('cmdShellGap names a $( ) cmd.exe would pass on as written, and not one handed to a program that has its own', () => {
  for (const bad of ['test $(git rev-list --count HEAD) -ge 3', 'git fetch -q origin && test $(git rev-list --count HEAD) -ge 3', 'test "$(git rev-list --count HEAD)" -ge 3', 'bash -c "true" && echo $(date)', 'node -e "process.exit(+process.argv[1] >= 3 ? 0 : 1)" $(git rev-list --count HEAD)', 'node -e "process.exit(+process.argv[1] >= 3 ? 0 : 1)" "$(git rev-list --count HEAD)"', 'bash x.sh "$(date)"']) {
    assert.match(cmdShellGap(bad) ?? '', /\$\( \).*cmd\.exe.*node -e/, bad);
  }
  for (const good of ['npm run check', 'git fetch -q && bash -c "test $(git rev-list --count HEAD) -ge 3"', 'powershell -c "$(Get-Date)"', 'pwsh -NoProfile -Command "$(Get-Date)"', '"C:\\Program Files\\Git\\usr\\bin\\sh.exe" -c "echo $(date)"', 'node -e "process.exit(0)" && node x.mjs']) {
    assert.equal(cmdShellGap(good), null, good);
  }
});

// M13 of the Fable 5.2 audit: cmd.exe has no backtick substitution, no `$VAR` and no single quotes, and passes each on
// as written, as it does a `$( )` (odd/tasks/audit-u4-refusals.md, spec 3).
test('cmdShellGap names a backtick, a $VAR and single quotes cmd.exe would pass on as written, and not inside code a program reads', () => {
  const cases = [
    ['test `git rev-list --count HEAD` -ge 3', /backtick/],
    ['git fetch -q && test "`date`" = x', /backtick/],
    ['test $COUNT -ge 3', /\$VAR/],
    ['test "${COUNT}" -ge 3', /\$VAR/],
    ['node x.mjs && test "$HOME" != ""', /\$VAR/],
    ["node -e 'process.exit(0)'", /single quote/],
    ["grep -q 'two words' notes.txt", /single quote/],
    ["bash -c 'test $(date) = x'", /single quote/],
    // Two backslashes before a quote are one backslash, and the quote ends the code: what follows is the shell's.
    ['node -e "console.log(1)\\\\" && test $COUNT -ge 3', /\$VAR/],
    // The verifier, 2026-11-10: a split cmd.exe makes ends the code, and the special parameters are variables too.
    ['node -e "a(\\" & echo $X & \\")"', /\$VAR/],
    ['node x.mjs && test $? -eq 0', /\$VAR/],
    ['node x.mjs && test $1 = a', /\$VAR/],
  ];
  for (const [bad, said] of cases) {
    const gap = cmdShellGap(bad) ?? '';
    assert.match(gap, said, bad);
    assert.match(gap, /cmd\.exe/, bad);
  }
  for (const good of [
    'node -e "const x = `a${1}`; process.exit(x === \'a1\' ? 0 : 1)"',
    'bash -c "test $COUNT -ge 3 && echo `date`"',
    'powershell -c "$env:PATH"',
    'git commit -m "it\'s done"',
    'grep -E "end$" notes.txt',
    'node x.mjs --price "5$"',
    "node -e \"process.exit(JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')).claudeMdExcludes[0]==='**/.claude/CLAUDE.md'?0:1)\"",
    // Codex, 2026-11-10: an escaped double quote does not end the code the program reads, so what follows it is code.
    'node -e "process.exit(\\"it\'s\\" === \\"it\'s\\" ? 0 : 1)"',
    'node -e "console.log(\\"a\\\\\\\\\\"); process.exit(`${1}` === \'1\' ? 0 : 1)"',
    'node -e"process.exit(`${1}` === \'1\' ? 0 : 1)"',
  ]) {
    assert.equal(cmdShellGap(good), null, good);
  }
});

test('a done-when command with a $( ) cmd.exe cannot run is rejected on Windows alone', () => {
  const md = withSection('Done when', '- `test $(git rev-list --count HEAD) -ge 3` exits 0');
  const { ok, errors } = validateContract(md, { platform: 'win32' });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.includes('test $(git rev-list --count HEAD) -ge 3') && /cmd\.exe/.test(e)), errors.join('\n'));
  assert.equal(validateContract(md, { platform: 'linux' }).ok, true);
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
  // Off Windows: on it, the single quotes are a cmd.exe gap of their own (cmdShellGap), which is not this test's subject.
  assert.equal(validateContract(md, { platform: 'linux' }).ok, true);
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

/** A reader of the rules as a project that declares the Claude home gives them (odd/tasks/one-model-home.md,
 * spec 2): one model and one level for the session and for every sub-agent it launches. The values are made up. */
const DECLARED = {
  'session-model': { value: 'claude-saga-9-1' },
  'session-effort': { value: 'medium' },
};
const declared = (extra = {}) => (id) => ({ ...DECLARED, ...extra })[id] ?? null;

test('tasksOf reads each checklist line that opens with an ID, outside fences, with its kind, box and lines', () => {
  assert.deepEqual(tasksOf(TASKS), [
    { id: 'T1', kind: 'design', done: true, start: 2, end: 2 },
    { id: 'T2', kind: 'build', done: false, start: 3, end: 4 },
    { id: 'T2a', kind: 'verify', done: false, start: 4, end: 4 },
    { id: 'T3', kind: null, done: false, start: 5, end: 5 },
  ]);
});

test('a task runs over its wrapped lines and stops at the first line that leaves its item', () => {
  const md = [
    '## Tasks',
    '- [ ] T1 (kind: build) The first, whose line',
    '  wraps and names S3',
    '',
    '- [ ] T2 The second',
    '  goes on',
    '',
    'A paragraph at the margin',
    '- [ ] T3 The last line of the file',
    '',
  ].join('\n');
  assert.deepEqual(tasksOf(md).map(({ id, start, end }) => ({ id, start, end })), [
    { id: 'T1', start: 2, end: 3 },
    { id: 'T2', start: 5, end: 6 },
    { id: 'T3', start: 9, end: 9 },
  ]);
});

test('the task ID is read as the session board reads it', () => {
  for (const text of ['T1 x', 'T16b: y', 'JH13 z', 'T1', 'Tx no', '12 no', 'T1· no']) {
    const step = `- [ ] ${text}`;
    assert.equal(tasksOf(step)[0]?.id ?? null, taskId(text), text);
  }
});

test('taskModes gives every kind the home\'s model and level, whatever its kind', () => {
  const modes = taskModes(TASKS, declared());
  assert.deepEqual(modes.map(({ id, model, effort, off }) => [id, model, effort, off]), [
    ['T1', 'claude-saga-9-1', 'medium', null],
    ['T2', 'claude-saga-9-1', 'medium', null],
    ['T2a', 'claude-saga-9-1', 'medium', null],
    ['T3', 'claude-saga-9-1', 'medium', null],
  ]);
  // The rules that restated the home for a kind of work are read no more: one that a list still declared changes nothing.
  const old = { 'subagent-effort': { value: 'max' }, 'subagent-writer-model': { value: 'claude-old-1-0' }, 'subagent-reader-model': { value: 'claude-old-1-0' } };
  assert.deepEqual(taskModes(TASKS, declared(old)), modes);
});

// A kind had its own row to look up, `session-effort-<kind>`, which no rule ever declared (his answer of 2026-10-14,
// "Ninguno todavía"). The home is one level for every kind, so the row is looked up no more.
test('a row named for a kind is not read: every kind keeps the home\'s level', () => {
  const modes = taskModes(TASKS, declared({ 'session-effort-build': { value: 'max' } }));
  assert.deepEqual(modes.map((m) => [m.id, m.effort]), [['T1', 'medium'], ['T2', 'medium'], ['T2a', 'medium'], ['T3', 'medium']]);
});

test('a task with no kind takes the session rule, never the document\'s ## Effort', () => {
  const doc = withSection('Effort', 'high') + '\n## Tasks\n- [ ] T1 Something\n';
  assert.equal(taskModes(doc, declared())[0].effort, 'medium');
});

test('a project that declares no rules, or one ahead of this copy, gets off and no values', () => {
  for (const off of ['elsewhere', 'behind']) {
    const [mode] = taskModes('- [ ] T1 (kind: build) x', () => ({ off }));
    assert.deepEqual(mode, { id: 'T1', kind: 'build', done: false, model: null, effort: null, off });
  }
});

test('modeLine prints the mode, one model and one level, and the off reasons', () => {
  const [design, build, , none] = taskModes(TASKS, declared());
  assert.equal(modeLine(design), 'T1 (kind: design): the session and every sub-agent on claude-saga-9-1 at medium');
  assert.equal(modeLine(build), 'T2 (kind: build): the session and every sub-agent on claude-saga-9-1 at medium');
  assert.equal(modeLine(none), 'T3 (no kind): the session and every sub-agent on claude-saga-9-1 at medium');
  // A list that declares one of the two says the other is not declared.
  const [noModel] = taskModes(TASKS, declared({ 'session-model': null }));
  assert.equal(modeLine(noModel), 'T1 (kind: design): the session and every sub-agent on a model not declared at medium');
  const [noEffort] = taskModes(TASKS, declared({ 'session-effort': null }));
  assert.equal(modeLine(noEffort), 'T1 (kind: design): the session and every sub-agent on claude-saga-9-1 at an effort not declared');
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

test('commandsIn finds each code span right before "exits 0" in a sentence or a table cell, and no placeholder', () => {
  assert.deepEqual(commandsIn('`npm test` exits 0 and `node e2e.mjs` exits 0; the page loads'), ['npm test', 'node e2e.mjs']);
  assert.deepEqual(commandsIn('the page loads, then `npm test`  exits 0'), ['npm test']);
  assert.deepEqual(commandsIn('`npm test` passes'), []);
  assert.deepEqual(commandsIn('`<command>` exits 0'), []);
  assert.deepEqual(commandsIn('`` exits 0'), []);
  // A span never runs over its closing delimiter into a later one.
  assert.deepEqual(commandsIn('`npm run build` then `npm test` exits 0'), ['npm test']);
  assert.deepEqual(commandsIn('`catalog` works; `<command>` exits 0'), []);
  assert.deepEqual(commandsIn('``a ` b`` exits 0'), ['a ` b']);
});
