import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, entryState, holdsPhrase, isSettled, parseRegister, sightings, summarize, weeklyCounts } from './failures.mjs';

const CLASSES = [
  '## Classes',
  '- `machine` — load or leftovers: processes, folders, locks',
  '- `tool` — a command of the harness or of the stack failed or did the',
  '  wrong thing',
  '',
];

/** A register that declares `machine` and `tool` and holds `entries`, each a list of lines. */
function register(...entries) {
  return ['# Failures', '', ...CLASSES, '## Entries', '', ...entries.flatMap((lines) => [...lines, ''])].join('\n');
}

/** The lines of an entry with one line of text and the given field lines. */
function entry(id, ...fields) {
  return [`### ${id}`, 'What happened, in a sentence.', ...fields];
}

const SEEN = '- Seen: 2026-10-11 — relief file, line 224 — a gate at 1,188 s of 1,200';
const EARLIER = '- Seen: 2026-10-09 — odd/tasks/gate-log.md, Progress — a gate timed out';

const LOAD = [
  '### language-server-load',
  'A TypeScript language server per session works while tests write files, and a gate reaches its',
  'bound.',
  '- Class: machine',
  '- Aka: failure 20',
  SEEN,
];

/** The one entry of a register that holds `lines`, which must be read without a fault. */
function only(lines) {
  const { entries, errors } = parseRegister(register(lines));
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 1);
  return entries[0];
}

/** The faults of a register that holds `entries`. */
function faults(...entries) {
  return parseRegister(register(...entries)).errors;
}

/** Asserts the register is refused for exactly one reason, and that the reason reads like `pattern`. */
function refusedOnce(errors, pattern) {
  assert.equal(errors.length, 1, errors.join('\n') || '(no fault)');
  assert.match(errors[0], pattern);
}

/** An entry as the states and the counts take it, without going through the text. */
function recorded({ id = 'some-failure', className = 'machine', dates = ['2026-10-11'], control = null, was = [] } = {}) {
  const seen = dates.map((date, i) => ({ date, evidence: `record ${i}`, note: 'seen' }));
  return { id, text: 'What happened.', class: className, aka: [], seen, control, proof: [], was };
}

const yes = () => true;
const no = () => false;

// ── What a register holds ───────────────────────────────────────────────────────────────────────

test('a register gives its classes and, for each entry, its id, text, class, earlier numbers and sightings', () => {
  const { classes, entries, errors } = parseRegister(register(LOAD));
  assert.deepEqual(errors, []);
  assert.deepEqual(classes, ['machine', 'tool']);
  assert.equal(entries.length, 1);
  const [load] = entries;
  assert.equal(load.id, 'language-server-load');
  assert.equal(
    load.text,
    'A TypeScript language server per session works while tests write files, and a gate reaches its\nbound.',
  );
  assert.equal(load.class, 'machine');
  assert.deepEqual(load.aka, ['failure 20']);
  assert.deepEqual(load.seen, [{ date: '2026-10-11', evidence: 'relief file, line 224', note: 'a gate at 1,188 s of 1,200' }]);
  assert.equal(load.control, null);
  assert.deepEqual(load.proof, []);
  assert.deepEqual(load.was, []);
});

test('a register with its two sections and no entry is read with no fault', () => {
  assert.deepEqual(parseRegister(register()), { classes: ['machine', 'tool'], entries: [], errors: [] });
});

test('everything between the heading and the first field is the text of the entry, a closed fence included', () => {
  const read = only([
    '### gate-reaches-its-bound',
    'The gate printed:',
    '',
    '```',
    '### not-an-entry',
    '- Class: tool',
    '```',
    '',
    '- a bullet of the text, which is no field',
    '- Class: machine',
    SEEN,
  ]);
  assert.equal(
    read.text,
    'The gate printed:\n\n```\n### not-an-entry\n- Class: tool\n```\n\n- a bullet of the text, which is no field',
  );
  assert.equal(read.class, 'machine');
});

test('an entry keeps its own lines as written, so it can be printed whole', () => {
  assert.equal(only(LOAD).source, LOAD.join('\n'));
});

test('a Seen line is cut at its first two long dashes, so its note may hold dashes, quotes and a date', () => {
  const read = only(entry(
    'note-with-dashes',
    '- Class: tool',
    '- Seen: 2026-10-11 — relief file, line 224 — he said "no — not yet" on 2026-10-09 - twice — and again',
  ));
  assert.deepEqual(read.seen, [
    { date: '2026-10-11', evidence: 'relief file, line 224', note: 'he said "no — not yet" on 2026-10-09 - twice — and again' },
  ]);
});

test('a control owed gives its document and its phrase', () => {
  const read = only(entry('owed-control', '- Class: tool', SEEN, '- Control: owed — odd/tasks/gate-log.md — "T4 the gate stops before its sensors"'));
  assert.deepEqual(read.control, { level: 'owed', path: 'odd/tasks/gate-log.md', phrase: 'T4 the gate stops before its sensors' });
});

test('a control in place gives its level, its path, its phrase and the day it reached main', () => {
  for (const level of ['check', 'line', 'protocol']) {
    const read = only(entry('control-in-place', '- Class: tool', SEEN, `- Control: ${level} — bin/check.test.mjs — "two gates never run together" — since 2026-10-12`));
    assert.deepEqual(read.control, { level, path: 'bin/check.test.mjs', phrase: 'two gates never run together', since: '2026-10-12' }, level);
  }
});

test('a control measured gives the file of the measurement, its dated phrase and the day it was measured', () => {
  const control = '- Control: measured — odd/tasks/honesty-audit.md — "2026-10-15: the audit caught 2 or 3 of 14" — since 2026-10-15';
  const read = only(entry('measured-control', '- Class: tool', SEEN, control));
  assert.deepEqual(read.control, { level: 'measured', path: 'odd/tasks/honesty-audit.md', phrase: '2026-10-15: the audit caught 2 or 3 of 14', since: '2026-10-15' });
});

test('a Control phrase is what stands between the outermost quotes, so it may hold a quote and a dash', () => {
  const read = only(entry(
    'phrase-with-a-quote',
    '- Class: tool',
    SEEN,
    '- Control: check — bin/check.test.mjs — "a gate says "busy" — and waits its turn" — since 2026-10-12',
  ));
  assert.deepEqual(read.control, {
    level: 'check',
    path: 'bin/check.test.mjs',
    phrase: 'a gate says "busy" — and waits its turn',
    since: '2026-10-12',
  });
});

test('a long field continues on indented lines, and a break beside a dash or inside a phrase changes nothing', () => {
  const read = only([
    '### wrapped-fields',
    'What happened.',
    '- Class: machine',
    '- Seen: 2026-10-11 — relief file,',
    '  line 224 —',
    '  a gate at 1,188 s',
    '- Control: owed — odd/tasks/gate-log.md — "T4 the gate stops',
    '    before its sensors"',
    '- Proof: the board prints 0 under',
    '  "gates that waited"',
  ]);
  assert.deepEqual(read.seen, [{ date: '2026-10-11', evidence: 'relief file, line 224', note: 'a gate at 1,188 s' }]);
  assert.deepEqual(read.control, { level: 'owed', path: 'odd/tasks/gate-log.md', phrase: 'T4 the gate stops before its sensors' });
  assert.deepEqual(read.proof, ['the board prints 0 under "gates that waited"']);
});

test('Proof and Was are free text, and every Was line is kept', () => {
  const read = only(entry(
    'control-that-left',
    '- Class: tool',
    SEEN,
    '- Proof: `js-harness sessions` prints 0 under "gates that waited"',
    '- Was: line — AGENTS.md — "never two gates" — dropped on 2026-10-10',
    '- Was: a note in memory, which no session read',
  ));
  assert.deepEqual(read.proof, ['`js-harness sessions` prints 0 under "gates that waited"']);
  assert.deepEqual(read.was, ['line — AGENTS.md — "never two gates" — dropped on 2026-10-10', 'a note in memory, which no session read']);
});

test('carriage returns at the ends of the lines change nothing', () => {
  const text = register(LOAD, entry('other-failure', '- Class: tool', SEEN));
  assert.deepEqual(parseRegister(text.replace(/\n/g, '\r\n')), parseRegister(text));
  assert.equal(parseRegister(text).entries.length, 2);
});

test('a byte-order mark at the start of the file is dropped', () => {
  const text = `## Classes\n- \`machine\` — load\n\n## Entries\n\n${LOAD.join('\n')}\n`;
  const read = parseRegister(`\uFEFF${text}`);
  assert.deepEqual(read, parseRegister(text));
  assert.deepEqual([read.classes, read.entries.length, read.errors], [['machine'], 1, []]);
});

test('a heading of the third level outside "## Entries" is no entry', () => {
  const text = `${register(LOAD)}\n## Notes\n\n### not-an-entry\nSome words.\n`;
  const { entries, errors } = parseRegister(text);
  assert.deepEqual([entries.map((read) => read.id), errors], [['language-server-load'], []]);
});

// ── Sightings ───────────────────────────────────────────────────────────────────────────────────

test('the Seen lines stand in any order among the fields and are read sorted by day', () => {
  const read = only(entry('seen-in-any-order', SEEN, '- Class: machine', '- Seen: 2026-10-12 — board — once more', EARLIER));
  assert.deepEqual(sightings(read).map((sighting) => sighting.date), ['2026-10-09', '2026-10-11', '2026-10-12']);
});

test('two Seen lines with the same date and the same evidence are one sighting, whatever their notes', () => {
  const read = only(entry(
    'read-by-two-sessions',
    '- Class: machine',
    SEEN,
    '- Seen: 2026-10-11 — relief   file, line 224 — the same record, read by another session',
    '- Seen: 2026-10-11 — relief file, line 301 — another record of the same day',
  ));
  assert.equal(read.seen.length, 3);
  assert.deepEqual(sightings(read).map((sighting) => sighting.evidence), ['relief file, line 224', 'relief file, line 301']);
});

// ── What is refused ─────────────────────────────────────────────────────────────────────────────

test('an entry with no text is refused, and told where the text goes', () => {
  refusedOnce(faults(['### no-text', '', '- Class: machine', SEEN]), /^entry "no-text": has no text: .*between the heading and the first field/);
});

test('an entry with no class is refused, and told how a class is written', () => {
  refusedOnce(faults(entry('no-class', SEEN)), /^entry "no-class": has no class: .*- Class: /);
});

test('an entry with no sighting is refused, and told how a sighting is written', () => {
  refusedOnce(faults(entry('no-sighting', '- Class: machine')), /^entry "no-sighting": has no sighting: .*- Seen: <YYYY-MM-DD> — /);
});

test('a class the file does not declare is refused, and the declared ones are named', () => {
  refusedOnce(faults(entry('odd-class', '- Class: weather', SEEN)), /^entry "odd-class": class "weather" is not declared.*machine, tool.*## Classes/);
});

test('an id that is not lowercase words joined by hyphens is refused', () => {
  for (const id of ['Language-Server', '20', 'failure-20', 'two  words', 'under_score', 'trailing-', '-leading', 'double--hyphen']) {
    refusedOnce(faults(entry(id, '- Class: machine', SEEN)), /the id is not lowercase words joined by hyphens.*language-server-load/);
  }
});

test('a word of an id may hold a digit, as long as it is not a number', () => {
  assert.deepEqual(faults(entry('utf8-mark-in-a-file', '- Class: machine', SEEN)), []);
});

test('an id that appears twice is refused', () => {
  const twice = entry('same-id', '- Class: machine', SEEN);
  refusedOnce(faults(twice, twice), /^entry "same-id": the id appears twice/);
});

test('entries out of the alphabetical order of their ids are refused, and the pair is named', () => {
  const errors = faults(entry('beta-failure', '- Class: machine', SEEN), entry('alpha-failure', '- Class: machine', SEEN));
  refusedOnce(errors, /^entry "alpha-failure": comes after "beta-failure".*alphabetical order of their ids/);
});

test('a date that is no date is refused, in a sighting and in a control', () => {
  for (const date of ['2026-13-01', '2026-02-30', '11-10-2026', '2026-10-1', 'yesterday']) {
    refusedOnce(faults(entry('bad-date', '- Class: machine', `- Seen: ${date} — relief file — a note`)), /^entry "bad-date": .*is no date.*YYYY-MM-DD/);
  }
  refusedOnce(
    faults(entry('bad-since', '- Class: machine', SEEN, '- Control: check — bin/check.test.mjs — "two gates never run together" — since 2026-02-30')),
    /^entry "bad-since": .*"2026-02-30" is no date.*YYYY-MM-DD/,
  );
});

test('a field it does not know is refused, and the fields are named', () => {
  refusedOnce(faults(entry('odd-field', '- Class: machine', SEEN, '- State: repeated')), /^entry "odd-field": field "State" is not known.*Class, Aka, Seen, Control, Proof and Was/);
});

test('a Seen line without its two long dashes is refused, and told how it is written', () => {
  for (const seen of ['- Seen: 2026-10-11', '- Seen: 2026-10-11 — relief file', '- Seen: 2026-10-11 - relief file - a note', '- Seen: 2026-10-11 —  — a note']) {
    refusedOnce(faults(entry('short-seen', '- Class: machine', seen)), /^entry "short-seen": .*- Seen: <YYYY-MM-DD> — <where the evidence is> — <a note>/);
  }
});

test('a field with nothing after its name is refused', () => {
  refusedOnce(faults(entry('empty-field', '- Class: machine', SEEN, '- Was:')), /^entry "empty-field": field "Was" is empty/);
});

test('a Class field with nothing after its name is one fault, not also an entry with no class', () => {
  refusedOnce(faults(entry('empty-class', '- Class:', SEEN)), /^entry "empty-class": field "Class" is empty/);
});

test('a list item of the text that opens with a capitalised word and a colon is read as a field, and refused', () => {
  refusedOnce(
    faults(entry('noted-entry', '- Note: the gate was slow that day', '- Class: machine', SEEN)),
    /^entry "noted-entry": field "Note" is not known.*Class, Aka, Seen, Control, Proof and Was/,
  );
  assert.deepEqual(faults(entry('noted-entry', '- note: the gate was slow that day', '- Class: machine', SEEN)), []);
});

test('a line after the first field that is neither a field nor an indented continuation is refused', () => {
  const lines = [...entry('stray-line', '- Class: machine', SEEN), '', 'A paragraph that came after the fields.'];
  refusedOnce(faults(lines), /^entry "stray-line": cannot read the line "A paragraph that came after the fields\.".*indented/);
});

test('a fence after the first field is refused by its first line, and what it holds is no field', () => {
  const lines = entry('late-fence', '- Class: machine', SEEN, '```', '- Seen: someday — nowhere — a line of code', '```');
  refusedOnce(faults(lines), /^entry "late-fence": cannot read the line "```"/);
});

test('an entry with two classes or two controls is refused', () => {
  refusedOnce(faults(entry('two-classes', '- Class: machine', '- Class: tool', SEEN)), /^entry "two-classes": has 2 Class fields/);
  const owed = '- Control: owed — odd/tasks/gate-log.md — "T4 the gate stops before its sensors"';
  refusedOnce(faults(entry('two-controls', '- Class: machine', SEEN, owed, owed)), /^entry "two-controls": has 2 Control fields.*Was/);
});

test('a control in a shape it does not know is refused, and both shapes are shown', () => {
  const shapes =
    /^entry "odd-control": .*owed — <document> — "<phrase>".*<check\|line\|protocol> — <path> — "<phrase>" — since <YYYY-MM-DD>.*measured — <path> — "<phrase>" — since <YYYY-MM-DD>/;
  for (const control of [
    'hook — bin/check.mjs — "two gates never run together" — since 2026-10-12',
    'check — bin/check.test.mjs — two gates never run together — since 2026-10-12',
    'check — bin/check.test.mjs — "two gates never run together"',
    'check — bin/check.test.mjs — "two gates never run together" since 2026-10-12',
    'check — "two gates never run together" — since 2026-10-12',
    'check bin/check.test.mjs "two gates never run together" — since 2026-10-12',
    'owed — odd/tasks/gate-log.md — "T4 the gate stops before its sensors" — since 2026-10-12',
    'owed',
    'measured — odd/tasks/honesty-audit.md — "2026-10-15: the audit caught 2 or 3 of 14"',
  ]) {
    refusedOnce(faults(entry('odd-control', '- Class: machine', SEEN, `- Control: ${control}`)), shapes);
  }
});

test('a phrase shorter than twelve characters is refused, because it could be found by accident', () => {
  refusedOnce(
    faults(entry('short-phrase', '- Class: machine', SEEN, '- Control: owed — odd/tasks/gate-log.md — "T4 the gate"')),
    /^entry "short-phrase": the phrase "T4 the gate" has 11 characters: a phrase has at least 12 characters, so that it is not found by accident/,
  );
  assert.deepEqual(faults(entry('long-enough', '- Class: machine', SEEN, '- Control: owed — odd/tasks/gate-log.md — "T4 the gates"')), []);
});

test('a path that is absolute, written with a backslash or holding ".." is refused', () => {
  const cases = [
    ['/etc/passwd', /is an absolute path/],
    ['C:/js-harness/AGENTS.md', /is an absolute path/],
    ['bin\\check.test.mjs', /is written with a backslash/],
    ['../other/AGENTS.md', /"\.\." segment/],
    ['docs/../../AGENTS.md', /"\.\." segment/],
    ['./AGENTS.md', /"\." or "\.\." segment/],
    ['docs//SPEC.md', /empty, "\." or "\.\." segment/],
  ];
  for (const [badPath, why] of cases) {
    const inPlace = faults(entry('bad-path', '- Class: machine', SEEN, `- Control: line — ${badPath} — "never two gates at once" — since 2026-10-12`));
    refusedOnce(inPlace, /^entry "bad-path": the path /);
    assert.match(inPlace[0], why, badPath);
    const owed = faults(entry('bad-path', '- Class: machine', SEEN, `- Control: owed — ${badPath} — "T4 the gate stops early"`));
    refusedOnce(owed, why);
  }
});

test('a check is never a .md file, though a line or a protocol may be', () => {
  const control = (level) => `- Control: ${level} — docs/SPEC.md — "never two gates at once" — since 2026-10-12`;
  refusedOnce(faults(entry('check-in-prose', '- Class: machine', SEEN, control('check'))), /^entry "check-in-prose": a check is never a \.md file.*test/);
  assert.deepEqual(faults(entry('line-in-prose', '- Class: machine', SEEN, control('line'))), []);
  assert.deepEqual(faults(entry('protocol-in-prose', '- Class: machine', SEEN, control('protocol'))), []);
});

test('a measurement whose phrase does not hold its date is refused, so measuring again is a new dated line', () => {
  const control = '- Control: measured — odd/tasks/honesty-audit.md — "the audit caught 2 or 3 of 14" — since 2026-10-15';
  refusedOnce(faults(entry('undated-measure', '- Class: tool', SEEN, control)), /^entry "undated-measure": .*phrase .*holds .*"2026-10-15"/);
});

test('the register itself is refused as the file of any control, since its own Control line holds every phrase', () => {
  for (const control of [
    'owed — docs/FAILURES.md — "T4 the gate stops before its sensors"',
    'line — docs/FAILURES.md — "never two gates at once" — since 2026-10-12',
    'measured — docs/FAILURES.md — "2026-10-15: the audit caught 2 or 3 of 14" — since 2026-10-15',
  ]) {
    refusedOnce(faults(entry('own-register', '- Class: tool', SEEN, `- Control: ${control}`)), /^entry "own-register": the path "docs\/FAILURES\.md" is the register/);
  }
});

test('a fence left open inside an entry is refused, and is the only fault of that entry', () => {
  const open = ['### open-fence', 'The gate printed:', '```', 'FAIL  tests', '- Class: machine', SEEN];
  const errors = faults(entry('alpha-failure', '- Class: machine', SEEN), open, entry('swallowed-entry', '- Class: machine', SEEN));
  refusedOnce(errors, /^entry "open-fence": a code fence is left open.*every entry after it/);
});

test('a fence left open before any entry is refused too', () => {
  const text = ['## Classes', '- `machine` — load', '```', '', '## Entries', '', ...LOAD, ''].join('\n');
  refusedOnce(parseRegister(text).errors, /^a code fence is left open.*every entry after it/);
});

test('a class shown inside a fence under "## Classes" is not declared', () => {
  const text = ['## Classes', '- `machine` — load', '```', '- `ghost` — how a class is written', '```', '', '## Entries', '', ...LOAD, ''].join('\n');
  const { classes, errors } = parseRegister(text);
  assert.deepEqual(classes, ['machine']);
  assert.deepEqual(errors, []);
});

test('a class declared twice is refused, so no class is counted twice', () => {
  const text = ['## Classes', '- `tool` — a command failed', '- `tool` — the same class again', '', '## Entries', '', ...entry('some-failure', '- Class: tool', SEEN), ''].join('\n');
  const { classes, errors } = parseRegister(text);
  assert.deepEqual(classes, ['tool']);
  refusedOnce(errors, /^class "tool" is declared twice under "## Classes": declare it once/);
});

test('a register with no "## Entries" section is refused, so its entries are not lost without a word', () => {
  refusedOnce(parseRegister(['## Classes', '- `machine` — load', '', ...LOAD, ''].join('\n')).errors, /^missing section "## Entries"/);
});

test('every fault is reported, not only the first', () => {
  const errors = faults(entry('zeta-failure', '- Class: weather', '- Seen: someday — relief file — a note'), entry('Alpha', '- Class: machine'));
  assert.equal(errors.length, 4, errors.join('\n'));
  for (const pattern of [/"zeta-failure": class "weather" is not declared/, /"zeta-failure": .*"someday" is no date/, /"Alpha": the id is not/, /"Alpha": has no sighting/]) {
    assert.ok(errors.some((fault) => pattern.test(fault)), `${pattern}\n${errors.join('\n')}`);
  }
});

test('the order is judged among the ids that are in the shape, so one fault is not told twice', () => {
  refusedOnce(faults(entry('zeta-failure', '- Class: machine', SEEN), entry('Alpha', '- Class: machine', SEEN)), /the id is not lowercase words/);
});

// ── Whether a file holds a phrase ───────────────────────────────────────────────────────────────

test('a phrase is found across a wrapped line, carriage returns and runs of spaces, on both sides', () => {
  const file = "test('two gates never run\r\n   together, whatever  the project', () => {});\r\n";
  assert.equal(holdsPhrase(file, 'two gates never run together, whatever the project'), true);
  assert.equal(holdsPhrase(file, 'two gates  never run\n together'), true);
  assert.equal(holdsPhrase(file, 'two gates never ran together'), false);
});

test('an owed phrase is found only in a list item that is not checked off', () => {
  const document = [
    '# A feature',
    'T4 the gate stops before its sensors, said in the prose.',
    '',
    '## Tasks',
    '- [x] T3 the gate stops before its sensors when a row fails',
    '- [ ] T5 the row prints every entry that is not settled',
    '```',
    '- [ ] T6 an example of a task, inside a fence',
    '```',
    '',
  ].join('\r\n');
  assert.equal(holdsPhrase(document, 'the gate stops before its sensors', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the gate stops before its sensors'), true);
  assert.equal(holdsPhrase(document, 'prints every entry that is not settled', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'an example of a task', { unchecked: true }), false);
});

test('a list item with no checkbox owes nothing, so a control owed names a checkbox item', () => {
  const document = ['## Next', '- T7 the row names the entries that are not settled', '- [ ] T8 the command prints one entry whole', ''].join('\n');
  assert.equal(holdsPhrase(document, 'the row names the entries that are not settled', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the command prints one entry whole', { unchecked: true }), true);
});

test('a task kept inside a comment owes nothing', () => {
  const document = ['- [x] T1 done', '<!--', '- [ ] T9 an old task kept in a comment', '-->', '- [ ] T2 a task <!-- with a note aside --> still owed', ''].join('\n');
  assert.equal(holdsPhrase(document, 'an old task kept in a comment', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'with a note aside', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'a task', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'an old task kept in a comment'), true, 'a control in place is looked for in the whole file');
});

test('a fence indented under a task is not part of it, and a checkbox inside it is no task', () => {
  const document = [
    '- [ ] T4 the gate stops early',
    '    ```',
    '    - [ ] T6 an example of a task, under a task',
    '    the phrase only an example holds',
    '    ```',
    '- [ ] T5 the row prints every entry',
    '    ~~~~',
    '    ```',
    '    a line between two kinds of marker',
    '    ~~~~',
    '',
  ].join('\n');
  assert.equal(holdsPhrase(document, 'an example of a task', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the phrase only an example holds', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'a line between two kinds of marker', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the gate stops early', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'the row prints every entry', { unchecked: true }), true);
});

test('a fence indented under a task that holds "<!--" hides no task after it', () => {
  const document = ['- [ ] T4 the gate stops early', '    ```', '    <!-- an opening that never closes', '    ```', '- [ ] T5 the row prints every entry', ''].join('\n');
  assert.equal(holdsPhrase(document, 'the row prints every entry', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'an opening that never closes', { unchecked: true }), false);
});

test('a fence at the margin that holds a deeper marker still hides its example and no task after it', () => {
  const document = ['```', '    ```', '- [ ] T6 an example of a task', '```', '- [ ] T5 the row prints every entry', ''].join('\n');
  assert.equal(holdsPhrase(document, 'an example of a task', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the row prints every entry', { unchecked: true }), true);
});

test('three backticks that open a code span in a wrapped line open no fence', () => {
  const document = ['- [ ] T4 the gate stops early, and its message is', '    ```no sensor ran``` in one line', '- [ ] T5 the row prints every entry', ''].join('\n');
  assert.equal(holdsPhrase(document, 'its message is ```no sensor ran``` in one line', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'the row prints every entry', { unchecked: true }), true);
});

test('a list item with no checkbox under an unchecked task ends it', () => {
  const document = ['- [ ] Another task', '  - the gate stops before its sensors', '- [ ] A third task', '  1. a numbered note under the task', '  and a line after the note', ''].join('\n');
  assert.equal(holdsPhrase(document, 'the gate stops before its sensors', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'a numbered note under the task', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'and a line after the note', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'Another task', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'A third task', { unchecked: true }), true);
});

test('a wrapped list item counts as one item, and ends where the next item or a blank line begins', () => {
  const document = [
    '- [ ] T4 the gate stops',
    '  before its sensors when',
    '    a static row already fails',
    '  - [x] T4a the row is computed first',
    '- [x] T5 done long ago',
    '  and wrapped as well',
    '- [ ] T6 the last task',
    '',
    '  a paragraph after a blank line',
    '',
  ].join('\n');
  assert.equal(holdsPhrase(document, 'gate stops before its sensors when a static row', { unchecked: true }), true);
  assert.equal(holdsPhrase(document, 'the row is computed first', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'done long ago and wrapped', { unchecked: true }), false);
  assert.equal(holdsPhrase(document, 'the last task a paragraph', { unchecked: true }), false);
});

test('a measurement is found in the prose, a checked item or an unchecked one, and never in a comment or a fence', () => {
  const document = [
    '## Measured',
    '- [x] T15 2026-10-15: the audit caught 2 or 3 of',
    '  14, measured not worth it',
    '- [ ] T16 2026-10-16: the share check, measured',
    '2026-10-17: a paragraph of prose',
    '<!-- 2026-10-18: an old measurement kept in a comment -->',
    '```',
    '2026-10-19: an example inside a fence',
    '```',
    '  ~~~',
    '  2026-10-20: an example in an indented fence',
    '  ~~~',
    '',
  ].join('\r\n');
  const prose = { prose: true };
  assert.equal(holdsPhrase(document, '2026-10-15: the audit caught 2 or 3 of 14', prose), true);
  assert.equal(holdsPhrase(document, '2026-10-16: the share check', prose), true);
  assert.equal(holdsPhrase(document, '2026-10-17: a paragraph of prose', prose), true);
  assert.equal(holdsPhrase(document, '2026-10-18: an old measurement', prose), false);
  assert.equal(holdsPhrase(document, '2026-10-19: an example inside a fence', prose), false);
  assert.equal(holdsPhrase(document, '2026-10-20: an example in an indented fence', prose), false);
  assert.equal(holdsPhrase(document, '2026-10-18: an old measurement'), true, 'a control in place is looked for in the whole file');
});

// ── The ten states ──────────────────────────────────────────────────────────────────────────────

const OWED = { level: 'owed', path: 'odd/tasks/gate-log.md', phrase: 'T4 the gate stops before its sensors' };
const IN_PLACE = { level: 'check', path: 'bin/check.test.mjs', phrase: 'two gates never run together', since: '2026-10-12' };
const MEASURED = { level: 'measured', path: 'odd/tasks/honesty-audit.md', phrase: '2026-10-15: the audit caught 2 or 3 of 14', since: '2026-10-15' };

test('seen once with no control is "once"', () => {
  assert.equal(entryState(recorded(), no), 'once');
});

test('seen twice or more with no control is "repeated"', () => {
  assert.equal(entryState(recorded({ dates: ['2026-10-09', '2026-10-11'] }), yes), 'repeated');
});

test('the same sighting recorded twice does not make an entry "repeated"', () => {
  const twice = recorded();
  twice.seen.push({ ...twice.seen[0], note: 'read by another session' });
  assert.equal(entryState(twice, yes), 'once');
});

test('a control owed whose document holds the phrase in an unchecked item is "owed", however often it was seen', () => {
  assert.equal(entryState(recorded({ control: OWED, dates: ['2026-10-09', '2026-10-11'] }), yes), 'owed');
});

test('a control owed whose document is gone or whose task was checked off is "owed, stale"', () => {
  assert.equal(entryState(recorded({ control: OWED }), no), 'owed, stale');
});

test('a control in place whose path holds the phrase, with no sighting after it, is "controlled"', () => {
  assert.equal(entryState(recorded({ control: IN_PLACE, dates: ['2026-10-09', '2026-10-11'] }), yes), 'controlled');
});

test('a sighting on the very day the control reached main is not after it', () => {
  assert.equal(entryState(recorded({ control: IN_PLACE, dates: ['2026-10-12'] }), yes), 'controlled');
});

test('a control in place whose path is gone or no longer holds the phrase is "control lost"', () => {
  assert.equal(entryState(recorded({ control: IN_PLACE }), no), 'control lost');
  assert.equal(entryState(recorded({ control: IN_PLACE, dates: ['2026-10-13'] }), no), 'control lost');
});

test('a sighting later than the day the control reached main is "seen again"', () => {
  assert.equal(entryState(recorded({ control: IN_PLACE, dates: ['2026-10-09', '2026-10-13'] }), yes), 'seen again');
});

test('a measurement whose file holds its phrase, with no sighting after it, is "measured", however often it was seen', () => {
  assert.equal(entryState(recorded({ control: MEASURED, dates: ['2026-10-09', '2026-10-11', '2026-10-14'] }), yes), 'measured');
});

test('a sighting on the very day of the measurement is counted by it', () => {
  assert.equal(entryState(recorded({ control: MEASURED, dates: ['2026-10-15'] }), yes), 'measured');
});

test('a sighting later than the measurement is "measured, seen again": its count is out of date', () => {
  assert.equal(entryState(recorded({ control: MEASURED, dates: ['2026-10-09', '2026-10-16'] }), yes), 'measured, seen again');
});

test('a measurement whose file is gone or no longer holds its phrase is "measure lost", not "control lost"', () => {
  assert.equal(entryState(recorded({ control: MEASURED }), no), 'measure lost');
  assert.equal(entryState(recorded({ control: MEASURED, dates: ['2026-10-16'] }), no), 'measure lost');
});

test('the state asks for an unchecked item of the owed document, for the phrase anywhere in a control in place, and in the prose of a measurement', () => {
  const asked = [];
  const holds = (...question) => {
    asked.push(question);
    return true;
  };
  entryState(recorded({ control: OWED }), holds);
  entryState(recorded({ control: IN_PLACE }), holds);
  entryState(recorded({ control: MEASURED }), holds);
  entryState(recorded(), holds);
  assert.deepEqual(asked, [
    ['odd/tasks/gate-log.md', 'T4 the gate stops before its sensors', { unchecked: true }],
    ['bin/check.test.mjs', 'two gates never run together', { unchecked: false }],
    ['odd/tasks/honesty-audit.md', '2026-10-15: the audit caught 2 or 3 of 14', { unchecked: false, prose: true }],
  ]);
});

test('there are ten states, and "once", "owed", "measured" and "controlled" are the settled ones', () => {
  assert.deepEqual(STATES, [
    'once',
    'repeated',
    'owed',
    'owed, stale',
    'measured',
    'measured, seen again',
    'measure lost',
    'controlled',
    'control lost',
    'seen again',
  ]);
  assert.deepEqual(STATES.filter(isSettled), ['once', 'owed', 'measured', 'controlled']);
});

// ── The counts ──────────────────────────────────────────────────────────────────────────────────

test('the counts give the entries, the sightings, those seen more than once, those not settled and the Was lines', () => {
  const entries = [
    recorded({ id: 'alpha-failure', dates: ['2026-10-09', '2026-10-11', '2026-10-12'] }),
    recorded({ id: 'beta-failure', className: 'tool', control: IN_PLACE, dates: ['2026-10-09', '2026-10-10'], was: ['a note in memory', 'a line that left'] }),
    recorded({ id: 'gamma-failure', className: 'tool', control: OWED, was: ['a rule kept by hand'] }),
    recorded({ id: 'delta-failure' }),
  ];
  const counts = summarize({ classes: ['machine', 'tool', 'delivery'], entries }, yes);
  assert.deepEqual(
    { entries: counts.entries, sightings: counts.sightings, repeated: counts.repeated, unsettled: counts.unsettled, was: counts.was },
    { entries: 4, sightings: 7, repeated: 2, unsettled: 1, was: 3 },
  );
});

test('the counts by class follow the order the classes are declared in, a class with no entry included', () => {
  const entries = [
    recorded({ id: 'alpha-failure', dates: ['2026-10-09', '2026-10-11'] }),
    recorded({ id: 'beta-failure', className: 'tool' }),
    recorded({ id: 'gamma-failure', className: 'tool', dates: ['2026-10-09', '2026-10-10', '2026-10-11'] }),
  ];
  assert.deepEqual(summarize({ classes: ['tool', 'delivery', 'machine'], entries }, no).byClass, [
    { class: 'tool', entries: 2, sightings: 4 },
    { class: 'delivery', entries: 0, sightings: 0 },
    { class: 'machine', entries: 1, sightings: 2 },
  ]);
});

test('the counts by state name all ten, and count the same sighting once', () => {
  const twice = recorded({ id: 'read-twice' });
  twice.seen.push({ ...twice.seen[0] });
  const entries = [
    twice,
    recorded({ id: 'came-back', dates: ['2026-10-09', '2026-10-11'] }),
    recorded({ id: 'lost-control', control: IN_PLACE }),
    recorded({ id: 'measured-once', control: MEASURED }),
    recorded({ id: 'measured-and-back', control: MEASURED, dates: ['2026-10-16'] }),
  ];
  const holds = (path) => path !== IN_PLACE.path;
  const counts = summarize({ classes: ['machine'], entries }, holds);
  assert.deepEqual(counts.byState, {
    once: 1,
    repeated: 1,
    owed: 0,
    'owed, stale': 0,
    measured: 1,
    'measured, seen again': 1,
    'measure lost': 0,
    controlled: 0,
    'control lost': 1,
    'seen again': 0,
  });
  assert.equal(counts.sightings, 6);
  assert.equal(counts.unsettled, 3);
});

test('the counts give one row per entry, the most seen first, with its state and the first day it was seen', () => {
  const entries = [
    recorded({ id: 'alpha-failure' }),
    recorded({ id: 'beta-failure', className: 'tool', dates: ['2026-10-11', '2026-10-09'] }),
    recorded({ id: 'gamma-failure', dates: ['2026-10-12'] }),
  ];
  assert.deepEqual(summarize({ classes: ['machine', 'tool'], entries }, no).rows, [
    { id: 'beta-failure', class: 'tool', state: 'repeated', settled: false, sightings: 2, firstSeen: '2026-10-09' },
    { id: 'alpha-failure', class: 'machine', state: 'once', settled: true, sightings: 1, firstSeen: '2026-10-11' },
    { id: 'gamma-failure', class: 'machine', state: 'once', settled: true, sightings: 1, firstSeen: '2026-10-12' },
  ]);
});

// ── By week ─────────────────────────────────────────────────────────────────────────────────────

test('weeklyCounts groups the sightings by ISO week, Monday first, and counts the lead\'s own and each class', () => {
  const lines = (id, className, seen) => [`### ${id}`, 'What happened.', `- Class: ${className}`, ...seen];
  const { classes, entries, errors } = parseRegister(register(
    lines('a-command', 'tool', [
      '- Seen: 2026-10-30 — the lead\'s transcript 0f71b2c6, line 32954 (the lead\'s own) — a bash block handed on win32',
      '- Seen: 2026-10-27 — the lead\'s note to JH 7 (claimed; JH 7\'s) — the lead names the source, not the maker',
    ]),
    lines('b-gate', 'machine', [
      '- Seen: 2026-10-11 — relief file, line 224 — a Sunday, so the week of Monday the 5th',
      '- Seen: 2026-10-12 — relief file, line 300 — a Monday',
      '- Seen: 2026-10-12 — relief file, line 300 — the same record read twice is one sighting',
    ]),
  ));
  assert.deepEqual(errors, []);
  const counts = weeklyCounts({ classes, entries }, new Date('2026-11-03T12:00:00Z'));
  assert.deepEqual(counts.map((week) => [week.week, week.sightings, week.lead]), [
    ['2026-10-05', 1, 0],
    ['2026-10-12', 1, 0],
    ['2026-10-19', 0, 0],
    ['2026-10-26', 2, 1],
    ['2026-11-02', 0, 0],
  ]);
  assert.deepEqual(counts[3].byClass, { machine: 0, tool: 2 });
  assert.deepEqual(counts[0].byClass, { machine: 1, tool: 0 });
});

test('weeklyCounts of a register with no sighting is no week', () => {
  assert.deepEqual(weeklyCounts({ classes: ['machine'], entries: [] }, new Date('2026-10-30T00:00:00Z')), []);
});
