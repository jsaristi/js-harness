import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OWNERS, patternOf, readRules, renderList, rulesHash, ruleHere, ruleOf, ruleValue, writeRules } from './rules.mjs';
import { RULES } from './rules-data.mjs';

// Marks a field to leave out of a fixture, so one test can take one key away.
const MISSING = Symbol('missing');

/** A declaration built from `base` with `overrides` laid over it; a key set to MISSING is left out. */
function build(base, overrides) {
  const rule = { ...base, ...overrides };
  for (const key of Object.keys(rule)) {
    if (rule[key] === MISSING) delete rule[key];
  }
  return rule;
}

/** A valid rule with a value and its unit, changed one field at a time through `overrides`. */
function valueRule(id, overrides = {}) {
  return build({ id, subject: 'the test value of a thing', owner: 'project', since: '2026-10-11', value: 12, unit: 'characters' }, overrides);
}

/** A valid rule in prose, changed one field at a time through `overrides`. */
function textRule(id, overrides = {}) {
  return build(
    { id, subject: 'a rule in prose', owner: 'project', since: '2026-10-11', path: 'docs/FAILURES.md', phrases: ['the shortest phrase that is found'] },
    overrides,
  );
}

/** A valid retired rule with no successor, changed one field at a time through `overrides`. */
function retiredRule(id, overrides = {}) {
  return build({ id, subject: 'a rule that is retired', owner: 'project', since: '2026-10-11', retired: '2026-10-11', successors: [] }, overrides);
}

const WHOLE = [
  valueRule('alpha-value', {
    flag: '--wait',
    was: [{ value: 30, until: '2026-10-01' }],
    patterns: ['a {amount}'],
    row: { refuses: '2026-10-01' },
    failure: 'language-server-load',
    differs: 'the text of a sibling rule',
    review: '2026-10-20',
  }),
  textRule('beta-text', {
    patterns: ['gate {amount}'],
    row: { reports: 'the gate reports it', since: '2026-10-02' },
    failure: 'language-server-load',
    differs: 'the text of a sibling rule',
    review: '2026-10-20',
  }),
  retiredRule('gamma-retired', {
    was: [{ value: 9, until: '2026-09-01' }],
    unit: 'minutes',
    successors: ['alpha-value'],
    patterns: ['x {amount}'],
    row: { refuses: '2026-10-11' },
    failure: 'language-server-load',
    differs: 'the text of a sibling rule',
    review: '2026-10-20',
  }),
];

// ── A valid list, and the shape of the owners ─────────────────────────────────────────────────

test('a list of the three bodies, with every optional key, reads with no fault', () => {
  assert.deepEqual(readRules(WHOLE), []);
});

test('an empty list reads with no fault', () => {
  assert.deepEqual(readRules([]), []);
});

test('the owners are sebastian and project, in that order', () => {
  assert.deepEqual(OWNERS, ['sebastian', 'project']);
});

// ── Fault 1: the list itself ───────────────────────────────────────────────────────────────────

test('a list that is not an array is refused as not a list, whatever it holds', () => {
  assert.deepEqual(readRules(undefined), ['the rules are not a list']);
  assert.deepEqual(readRules({ 0: valueRule('alpha-value') }), ['the rules are not a list']);
});

// ── Fault 2: an item that is not a plain object ────────────────────────────────────────────────

test('an item that is not a plain object is refused by its index, and the next item is still read', () => {
  for (const item of [null, ['alpha-value'], 'alpha-value', 7]) {
    assert.deepEqual(readRules([item]), ['rule at index 0: not an object'], `item ${String(item)}`);
  }
  assert.deepEqual(readRules([null, valueRule('alpha-value', { subject: '' })]), [
    'rule at index 0: not an object',
    'rule "alpha-value": the subject is missing',
  ]);
});

// ── Fault 3: the id ────────────────────────────────────────────────────────────────────────────

test('an id that is missing or is not lower-case words joined by hyphens is refused by index', () => {
  for (const id of [MISSING, 'Alpha-value', 'alpha_value', '2fast', 'alpha--value', 'alpha-', 'alpha-2', 42]) {
    assert.deepEqual(
      readRules([valueRule('alpha-value', { id })]),
      ['rule at index 0: the id is missing or is not lower-case words joined by hyphens'],
      `id ${String(id)}`,
    );
  }
});

test('a rule with an unusable id keeps reading its other fields, named by index', () => {
  assert.deepEqual(readRules([valueRule('Bad_ID', { subject: '' })]), [
    'rule at index 0: the id is missing or is not lower-case words joined by hyphens',
    'rule at index 0: the subject is missing',
  ]);
});

// ── Fault 4: a duplicate id ────────────────────────────────────────────────────────────────────

test('an id declared twice is refused on its second declaration only', () => {
  assert.deepEqual(readRules([valueRule('alpha-value'), valueRule('alpha-value')]), [
    'rule "alpha-value": the id is declared twice',
  ]);
});

// ── Fault 5: the order of ids ──────────────────────────────────────────────────────────────────

test('a rule whose id is not greater than the id before it is refused as out of order', () => {
  assert.deepEqual(readRules([valueRule('beta-value'), valueRule('alpha-value')]), [
    'rule "alpha-value": the list is not sorted by id: it comes after "beta-value"',
  ]);
});

// ── Fault 6: keys ──────────────────────────────────────────────────────────────────────────────

test('a key that no declaration holds is refused by name, one fault per key in the object order', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { colour: 'red', size: 3 })]), [
    'rule "alpha-value": unknown key "colour"',
    'rule "alpha-value": unknown key "size"',
  ]);
});

// ── Fault 7: the subject ───────────────────────────────────────────────────────────────────────

test('a subject that is missing, not a text or empty after trim is refused as missing', () => {
  for (const subject of [MISSING, '', '   ', 4]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { subject })]), ['rule "alpha-value": the subject is missing'], `subject ${String(subject)}`);
  }
});

test('a subject that holds a digit is refused, because the value is written once, in "value"', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { subject: 'the 2nd thing' })]), [
    'rule "alpha-value": the subject holds a number: it is a label of what the rule is about, and the value is written once, in "value"',
  ]);
});

// ── Fault 8: the owner ─────────────────────────────────────────────────────────────────────────

test('an owner that is missing is refused with the two owners named', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { owner: MISSING })]), [
    'rule "alpha-value": the owner is missing: it is sebastian or project',
  ]);
});

test('an owner that is not sebastian or project is refused by its name', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { owner: 'team' })]), [
    'rule "alpha-value": the owner is "team": it is sebastian or project',
  ]);
});

test('an owner with no text form is refused without throwing', () => {
  assert.doesNotThrow(() => readRules([valueRule('alpha-value', { owner: Object.create(null) })]));
  assert.equal(readRules([valueRule('alpha-value', { owner: Object.create(null) })]).length, 1);
});

// ── Fault 9: since ─────────────────────────────────────────────────────────────────────────────

test('a since that is not a real day written YYYY-MM-DD is refused, and 2026-02-30 is not a day', () => {
  for (const since of ['2026-02-30', '2026-2-3', '26-10-11', MISSING]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { since })]), [
      'rule "alpha-value": since is not a day written YYYY-MM-DD',
    ], `since ${String(since)}`);
  }
});

// ── Fault 10: the body ─────────────────────────────────────────────────────────────────────────

test('a rule with no body is refused, and the faults of its body are not read', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { value: MISSING })]), [
    'rule "alpha-value": no body: a rule has a value, or a path with phrases, or is retired',
  ]);
});

test('a rule with two bodies is refused, whichever two they are', () => {
  const more = 'rule "alpha-value": more than one body: a rule has a value, or a path with phrases, or is retired';
  assert.deepEqual(readRules([valueRule('alpha-value', { path: 'docs/FAILURES.md', phrases: ['the shortest phrase that is found'] })]), [more]);
  assert.deepEqual(readRules([valueRule('alpha-value', { retired: '2026-10-11', successors: [] })]), [more]);
});

test('a path with its phrases is one body, and a rule in prose with no value reads with no fault', () => {
  assert.deepEqual(readRules([textRule('alpha-text')]), []);
});

// ── Fault 11: the value body ───────────────────────────────────────────────────────────────────

// ── The alias and the scope (items 1 and 2) ─────────────────────────────────────────────────────

test('an alias on a rule in prose or on a retired rule is refused: an alias goes with a value', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { alias: 'haiku' })]), ['rule "alpha-text": an alias goes with a value']);
  assert.deepEqual(readRules([retiredRule('alpha-retired', { alias: 'haiku' })]), ['rule "alpha-retired": an alias goes with a value']);
});

test('an alias that is not one short lower-case word is refused on a value rule', () => {
  for (const alias of ['Haiku', 'two words', '', 7, 'a'.repeat(33)]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { alias })]), [
      'rule "alpha-value": the alias is one short lower-case word',
    ], `alias ${String(alias)}`);
  }
});

test('a good alias on a value rule reads with no fault, and one of 32 characters is still short enough', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { alias: 'haiku' })]), []);
  assert.deepEqual(readRules([valueRule('alpha-value', { alias: 'a'.repeat(32) })]), []);
});

test('a scope that is not repository is refused by its value, and true is refused too', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { scope: 'project' })]), [
    'rule "alpha-value": the scope is "project": it is repository, or it is absent',
  ]);
  assert.deepEqual(readRules([valueRule('alpha-value', { scope: true })]), [
    'rule "alpha-value": the scope is "true": it is repository, or it is absent',
  ]);
});

test('a scope of repository reads with no fault on a value rule, a rule in prose and a retired rule', () => {
  assert.deepEqual(readRules([
    valueRule('alpha-value', { scope: 'repository' }),
    textRule('beta-text', { scope: 'repository' }),
    retiredRule('gamma-retired', { scope: 'repository' }),
  ]), []);
});

test('a value that is not a finite number and not a non-empty text is refused', () => {
  for (const value of [true, '', Infinity, null, NaN]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { value, unit: MISSING })]), [
      'rule "alpha-value": the value is not a number or a text',
    ], `value ${String(value)}`);
  }
});

test('a text value needs no unit and reads with no fault', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { value: 'high', unit: MISSING })]), []);
});

test('a number with no unit is refused: a number needs its unit', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { unit: MISSING })]), ['rule "alpha-value": a number needs its unit']);
});

test('a unit that is not a non-empty text is refused', () => {
  for (const unit of ['', 4]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { unit })]), ['rule "alpha-value": the unit is not a text'], `unit ${String(unit)}`);
  }
});

test('a flag that is not written --name is refused, and a flag written --name is read', () => {
  for (const flag of ['wait', '--Wait', '--wait_now', 4]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { flag })]), ['rule "alpha-value": the flag is not written --name'], `flag ${String(flag)}`);
  }
  assert.deepEqual(readRules([valueRule('alpha-value', { flag: '--part-lines' })]), []);
});

// ── Fault 12: the text body ────────────────────────────────────────────────────────────────────

test('a rule in prose with its path or its phrases missing is refused as needing both', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { phrases: MISSING })]), [
    'rule "alpha-text": a rule in prose needs its path and its phrases',
  ]);
  assert.deepEqual(readRules([textRule('alpha-text', { path: MISSING })]), [
    'rule "alpha-text": a rule in prose needs its path and its phrases',
  ]);
});

test('a path that is absolute, has a backslash, has a .. segment or is not a text is refused', () => {
  for (const path of ['/etc/passwd', 'C:/x/y.md', 'docs\\FAILURES.md', 'docs/../FAILURES.md', '', 4]) {
    assert.deepEqual(readRules([textRule('alpha-text', { path })]), [
      'rule "alpha-text": the path is not a path of the repository, written with forward slashes',
    ], `path ${String(path)}`);
  }
});

test('phrases that are not a non-empty list of texts are refused', () => {
  for (const phrases of ['a phrase', [], [12]]) {
    assert.deepEqual(readRules([textRule('alpha-text', { phrases })]), ['rule "alpha-text": the phrases are not a list of texts'], `phrases ${JSON.stringify(phrases)}`);
  }
});

test('a phrase shorter than 12 characters is refused, one fault per such phrase', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { phrases: ['too short'] })]), [
    'rule "alpha-text": the phrase "too short" is shorter than 12 characters: it could be found by accident',
  ]);
  assert.deepEqual(readRules([textRule('alpha-text', { phrases: ['too short', 'short too'] })]), [
    'rule "alpha-text": the phrase "too short" is shorter than 12 characters: it could be found by accident',
    'rule "alpha-text": the phrase "short too" is shorter than 12 characters: it could be found by accident',
  ]);
});

test('a phrase is measured after its white space is squashed, so padding does not make it long enough', () => {
  // Twenty-one characters raw, nine once the white space is squashed to single spaces.
  assert.deepEqual(readRules([textRule('alpha-text', { phrases: ['a    b    c    d    e'] })]), [
    'rule "alpha-text": the phrase "a b c d e" is shorter than 12 characters: it could be found by accident',
  ]);
  assert.deepEqual(readRules([textRule('alpha-text', { phrases: ['twelve chars'] })]), []);
});

// ── Fault 13: the retired body ─────────────────────────────────────────────────────────────────

test('a retired day that is not a real day written YYYY-MM-DD is refused', () => {
  assert.deepEqual(readRules([retiredRule('alpha-retired', { retired: '2026-13-01' })]), [
    'rule "alpha-retired": retired is not a day written YYYY-MM-DD',
  ]);
});

test('successors that are not a list of ids are refused, whether a text, a number or missing', () => {
  for (const successors of ['alpha-value', [3], MISSING]) {
    assert.deepEqual(readRules([retiredRule('alpha-retired', { successors })]), [
      'rule "alpha-retired": the successors are not a list of ids',
    ], `successors ${String(successors)}`);
  }
});

test('a retired rule that names itself as successor is refused', () => {
  assert.deepEqual(readRules([retiredRule('alpha-retired', { successors: ['alpha-retired'] })]), [
    'rule "alpha-retired": a rule is not its own successor',
  ]);
});

test('a successor that is the id of no rule in the list is refused, and one declared later is found', () => {
  assert.deepEqual(readRules([retiredRule('alpha-retired', { successors: ['nowhere-rule'] })]), [
    'rule "alpha-retired": the successor "nowhere-rule" is declared nowhere',
  ]);
  assert.deepEqual(readRules([retiredRule('alpha-retired', { successors: ['beta-value'] }), valueRule('beta-value')]), []);
});

test('a retired rule with no successor reads with no fault', () => {
  assert.deepEqual(readRules([retiredRule('alpha-retired', { successors: [] })]), []);
});

test('a retired rule whose earlier values are numbers reads with its unit, and is refused without one', () => {
  const was = [{ value: 60, until: '2026-10-01' }];
  assert.deepEqual(readRules([retiredRule('alpha-retired', { was, unit: 'minutes' })]), []);
  assert.deepEqual(readRules([retiredRule('alpha-retired', { was })]), [
    'rule "alpha-retired": a retired rule whose earlier values are numbers keeps its unit',
  ]);
  assert.deepEqual(readRules([retiredRule('alpha-retired', { was, unit: '' })]), [
    'rule "alpha-retired": a retired rule whose earlier values are numbers keeps its unit',
  ]);
});

test('a unit on a retired rule whose earlier values are not numbers keeps its fault, and a retired rule with no unit reads with none', () => {
  assert.deepEqual(readRules([retiredRule('alpha-retired', { was: [{ value: 'sixty minutes', until: '2026-10-01' }], unit: 'minutes' })]), [
    'rule "alpha-retired": a unit goes with a value',
  ]);
  assert.deepEqual(readRules([retiredRule('alpha-retired', { unit: 'minutes' })]), ['rule "alpha-retired": a unit goes with a value']);
  assert.deepEqual(readRules([retiredRule('alpha-retired')]), []);
});

// ── Fault 14: a flag or earlier values on a rule of the wrong body ─────────────────────────────

test('a unit on a rule in prose is refused: a unit goes with a value', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { unit: 'minutes' })]), ['rule "alpha-text": a unit goes with a value']);
});

test('a flag on a rule in prose is refused: a flag goes with a value', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { flag: '--wait' })]), ['rule "alpha-text": a flag goes with a value']);
});

test('successors on a rule that is not retired are refused, on a value and on a rule in prose', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { successors: [] })]), ['rule "alpha-value": successors go with a retired rule']);
  assert.deepEqual(readRules([textRule('alpha-text', { successors: [] })]), ['rule "alpha-text": successors go with a retired rule']);
});

test('earlier values on a rule in prose are refused: they go with a value or a retired rule', () => {
  assert.deepEqual(readRules([textRule('alpha-text', { was: [{ value: 1, until: '2026-01-01' }] })]), [
    'rule "alpha-text": earlier values go with a value or a retired rule',
  ]);
});

// ── Fault 15: earlier values ───────────────────────────────────────────────────────────────────

test('earlier values that are not a list of { value, until } are refused, on a value or a retired rule', () => {
  const shape = 'rule "alpha-value": an earlier value is written { value, until: YYYY-MM-DD }';
  const bad = [
    12,
    [{ value: 12 }],
    [{ value: 12, until: '2026-01-01', note: 'x' }],
    [{ value: true, until: '2026-01-01' }],
    [{ value: 12, until: '2026-02-30' }],
    ['12'],
  ];
  for (const was of bad) {
    assert.deepEqual(readRules([valueRule('alpha-value', { was })]), [shape], `was ${JSON.stringify(was)}`);
  }
  assert.deepEqual(readRules([retiredRule('alpha-value', { was: 'nope' })]), [
    'rule "alpha-value": an earlier value is written { value, until: YYYY-MM-DD }',
  ]);
});

test('earlier values that mix numbers and texts are refused, on a value rule and on a retired rule', () => {
  const was = [{ value: 12, until: '2026-05-01' }, { value: 'twelve', until: '2026-01-01' }];
  const mixed = 'the earlier values are all numbers or all texts';
  assert.deepEqual(readRules([valueRule('alpha-value', { was })]), [`rule "alpha-value": ${mixed}`]);
  assert.deepEqual(readRules([retiredRule('alpha-value', { was, unit: 'minutes' })]), [`rule "alpha-value": ${mixed}`]);
});

test('earlier values that are not newest first are refused, and equal days are allowed', () => {
  assert.deepEqual(
    readRules([
      valueRule('alpha-value', {
        was: [
          { value: 1, until: '2026-01-01' },
          { value: 2, until: '2026-05-01' },
        ],
      }),
    ]),
    ['rule "alpha-value": the earlier values are not newest first'],
  );
  assert.deepEqual(
    readRules([
      valueRule('alpha-value', {
        was: [
          { value: 2, until: '2026-05-01' },
          { value: 1, until: '2026-05-01' },
        ],
      }),
    ]),
    [],
  );
});

// ── Fault 16: the optional keys ────────────────────────────────────────────────────────────────

test('patterns that are not a non-empty list of non-empty texts are refused as a list', () => {
  for (const patterns of ['a', [], [''], [3]]) {
    assert.deepEqual(readRules([valueRule('alpha-value', { patterns })]), ['rule "alpha-value": the patterns are not a list of texts'], `patterns ${JSON.stringify(patterns)}`);
  }
});

test('a pattern that is not a regular expression is refused by its text, one fault per pattern', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { patterns: ['a('] })]), [
    'rule "alpha-value": the pattern "a(" is not a regular expression',
  ]);
  assert.deepEqual(readRules([valueRule('alpha-value', { patterns: ['{amount} ok', '(', '[' ] })]), [
    'rule "alpha-value": the pattern "(" is not a regular expression',
    'rule "alpha-value": the pattern "[" is not a regular expression',
  ]);
});

test('a pattern names its {amount}, and one that matches an empty line is refused', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { patterns: ['wait for the gate'] })]), [
    'rule "alpha-value": the pattern "wait for the gate" has no {amount}: it finds a value by its subject and any amount',
  ]);
  assert.deepEqual(readRules([valueRule('alpha-value', { patterns: ['{amount}|'] })]), [
    'rule "alpha-value": the pattern "{amount}|" matches an empty line',
  ]);
});

test('{amount} stands for any amount in any wording, so a pattern outlives a change of value', () => {
  const wait = patternOf('wait.{0,40}{amount}');
  for (const line of ['the gate may wait 60 minutes', 'a wait of 45 min', 'it waits an hour', 'wait half an hour', 'the wait is 3,600 s']) {
    assert.match(line, wait, line);
  }
  assert.doesNotMatch('the wait for its turn', wait);
  const model = patternOf('review model.{0,20}{amount}');
  assert.match('the review model is gpt-6.1-sol', model);
  assert.match('the review model is "claude-opus-5-5"', model);
  assert.match('THE REVIEW MODEL: gpt-6.1-sol', model);
  const effort = patternOf('effort.{0,10}{amount}');
  for (const line of ['the effort is high', 'review effort: medium', 'at effort xhigh', 'effort low', 'effort max']) {
    assert.match(line, effort, line);
  }
  assert.doesNotMatch('the effort of the team', effort);
});

test('{amount} takes an effort word only as a word: never inside a rule mark, a flag or a call', () => {
  const stopped = patternOf('gate.{0,50}stopped.{0,30}{amount}');
  for (const line of ['A gate is stopped at `rule:gate-max`.', 'a gate is stopped by --max', 'a gate is stopped: Math.max(x)', 'a gate is stopped at max-load', 'a gate stopped at high.js']) {
    assert.doesNotMatch(line, stopped, line);
  }
  for (const line of ['a gate is stopped at `max` effort', 'a gate is stopped at max.', 'a gate stopped at high, then']) {
    assert.match(line, stopped, line);
  }
});

test('{amount} takes a number only as a number of its own: never inside an id, a hash or a line number', () => {
  const stopped = patternOf('gate.{0,50}stopped.{0,30}{amount}');
  for (const line of ['a gate is stopped at S1', 'a gate is stopped at e5b7588', 'a gate is stopped at check.mjs:42', 'a gate is stopped at x_30', 'a gate is stopped at v2-rc', 'a gate is stopped at 3fa2b91', 'a gate is stopped at 30_000']) {
    assert.doesNotMatch(line, stopped, line);
  }
  for (const line of ['a gate is stopped after 30 minutes', 'a gate is stopped at (30 min)', 'a gate is stopped at 1,200 s', 'a gate is stopped at 1.5 h', 'a gate is stopped at `30` minutes', 'a gate is stopped at 88%', 'a gate is stopped at 30min', 'a gate is stopped at 30-minute marks', 'a gate is stopped at 60.']) {
    assert.match(line, stopped, line);
  }
  // Left out on purpose (the comment of AMOUNT says why): a signed or dotted number and a compact duration.
  const unit = patternOf('stopped at {amount}\\s*(?:h|min)\\b');
  for (const line of ['stopped at -5 min', 'stopped at .5 h', 'stopped at 1h30m']) {
    assert.doesNotMatch(line, unit, line);
  }
});

test('a row that is not { refuses: day } or { reports: text, since: day } is refused', () => {
  const shape = 'rule "alpha-value": the row is written { refuses: YYYY-MM-DD } or { reports: <reason>, since: YYYY-MM-DD }';
  const bad = [
    { refuses: '2026-02-30' },
    { reports: '', since: '2026-01-01' },
    { reports: 'the gate reports it' },
    { refuses: '2026-01-01', since: '2026-01-01' },
    '2026-01-01',
    { reports: 'the gate reports it', since: '2026-13-01' },
  ];
  for (const row of bad) {
    assert.deepEqual(readRules([valueRule('alpha-value', { row })]), [shape], `row ${JSON.stringify(row)}`);
  }
});

test('a failure that is not an id of the register is refused', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { failure: 'Bad' })]), ['rule "alpha-value": the failure is not an id of the register']);
});

test('differs that is not a non-empty text is refused', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { differs: '' })]), ['rule "alpha-value": differs is not a text']);
});

test('a review that is not a real day written YYYY-MM-DD is refused', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { review: '2026-02-30' })]), [
    'rule "alpha-value": review is not a day written YYYY-MM-DD',
  ]);
});

// ── Every fault, in order ──────────────────────────────────────────────────────────────────────

test('every fault of a rule is reported, in the order the rule is read', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { subject: '', owner: 'team', unit: MISSING })]), [
    'rule "alpha-value": the subject is missing',
    'rule "alpha-value": the owner is "team": it is sebastian or project',
    'rule "alpha-value": a number needs its unit',
  ]);
});

test('two faulty rules are both reported, in list order', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { unit: MISSING }), valueRule('beta-value', { since: '2026-02-30' })]), [
    'rule "alpha-value": a number needs its unit',
    'rule "beta-value": since is not a day written YYYY-MM-DD',
  ]);
});

// ── Never throws, and the minPhrase option ─────────────────────────────────────────────────────

test('readRules never throws, whatever it is given', () => {
  for (const given of [undefined, null, 42, [null, 3, 'x', []]]) {
    assert.doesNotThrow(() => readRules(given));
  }
  assert.deepEqual(readRules([null, 3, 'x', []]), [
    'rule at index 0: not an object',
    'rule at index 1: not an object',
    'rule at index 2: not an object',
    'rule at index 3: not an object',
  ]);
  assert.deepEqual(readRules(new Array(2)), ['rule at index 0: not an object', 'rule at index 1: not an object']);
});

test('the minPhrase option moves the bound a phrase is measured against', () => {
  const rule = textRule('alpha-text', { phrases: ['eleven char'] });
  assert.deepEqual(readRules([rule]), [
    'rule "alpha-text": the phrase "eleven char" is shorter than 12 characters: it could be found by accident',
  ]);
  assert.deepEqual(readRules([rule], { minPhrase: 11 }), []);
  assert.deepEqual(readRules([rule], { minPhrase: 20 }), [
    'rule "alpha-text": the phrase "eleven char" is shorter than 20 characters: it could be found by accident',
  ]);
});

test('an unreadable shortest phrase is the first fault, and the bound is then 0, so no phrase is too short', () => {
  assert.deepEqual(readRules([valueRule('alpha-value', { subject: '' }), textRule('beta-text', { phrases: ['abc'] })], { declared: [] }), [
    'the shortest phrase cannot be read: no rule "control-phrase-min" is declared (bin/lib/rules-data.mjs)',
    'rule "alpha-value": the subject is missing',
  ]);
});

test('an explicit minPhrase is used as it is, and nothing is read from the declared list', () => {
  assert.deepEqual(readRules([textRule('alpha-text')], { minPhrase: 12, declared: [] }), []);
});

// ── ruleValue ──────────────────────────────────────────────────────────────────────────────────

const LIST = [
  valueRule('alpha-value'),
  valueRule('beta-value', { value: 'high', unit: MISSING }),
  retiredRule('gamma-retired', { retired: '2026-10-01' }),
  retiredRule('delta-retired', { retired: '2026-10-02', successors: ['alpha-value', 'beta-value'] }),
  textRule('epsilon-text'),
];

test('a number is read with its unit, and gives its value', () => {
  assert.equal(ruleValue('alpha-value', 'characters', LIST), 12);
});

test('a text is read with no unit, and gives its value', () => {
  assert.equal(ruleValue('beta-value', undefined, LIST), 'high');
});

test('the declared list is read when no list is given', () => {
  assert.equal(ruleValue('gate-wait', 'minutes'), 60);
});

test('an id that no rule declares throws, and names where the rules are declared', () => {
  assert.throws(() => ruleValue('nowhere', undefined, LIST), {
    name: 'Error',
    message: 'no rule "nowhere" is declared (bin/lib/rules-data.mjs)',
  });
});

test('a retired rule with no successor throws: nothing reads it any more', () => {
  assert.throws(() => ruleValue('gamma-retired', undefined, LIST), {
    name: 'Error',
    message: 'rule "gamma-retired" is retired since 2026-10-01: nothing reads it any more',
  });
});

test('a retired rule with successors throws, and names them to read instead', () => {
  assert.throws(() => ruleValue('delta-retired', undefined, LIST), {
    name: 'Error',
    message: 'rule "delta-retired" is retired since 2026-10-02: read alpha-value, beta-value instead',
  });
});

test('a rule in prose throws: it has no value to read', () => {
  assert.throws(() => ruleValue('epsilon-text', undefined, LIST), {
    name: 'Error',
    message: 'rule "epsilon-text" is a rule in prose: it has no value to read',
  });
});

test('a unit that differs from the declared unit throws, and a missing unit prints as no unit', () => {
  assert.throws(() => ruleValue('alpha-value', 'minutes', LIST), {
    name: 'Error',
    message: 'rule "alpha-value" is in characters, and it was read as minutes',
  });
  assert.throws(() => ruleValue('beta-value', 'characters', LIST), {
    name: 'Error',
    message: 'rule "beta-value" is in no unit, and it was read as characters',
  });
  assert.throws(() => ruleValue('alpha-value', undefined, LIST), {
    name: 'Error',
    message: 'rule "alpha-value" is in characters, and it was read as no unit',
  });
});

// ── The real data ──────────────────────────────────────────────────────────────────────────────

// ── A rule of this repository only: ruleValue refuses it, ruleHere and ruleOf read it (items 3 to 5) ──

test('ruleValue throws for a rule of scope repository: it is of this repository only', () => {
  const list = [valueRule('alpha-value', { scope: 'repository' })];
  assert.throws(() => ruleValue('alpha-value', 'characters', list), {
    name: 'Error',
    message: 'rule "alpha-value" is of this repository only: read it with ruleHere',
  });
});

test('ruleHere gives the value of a rule with no scope, whatever the project holds', () => {
  const list = [valueRule('alpha-value')];
  for (const projectData of [undefined, null, 'anything at all']) {
    assert.deepEqual(ruleHere('alpha-value', 'characters', projectData, list), { value: 12 }, `projectData ${String(projectData)}`);
  }
});

test('ruleHere gives the value of a scoped rule when the project holds the same list, with either line ending', () => {
  const list = [valueRule('alpha-value', { scope: 'repository' })];
  const written = writeRules(list);
  assert.deepEqual(ruleHere('alpha-value', 'characters', written, list), { value: 12 });
  assert.deepEqual(ruleHere('alpha-value', 'characters', written.replace(/\n/g, '\r\n'), list), { value: 12 });
});

test('ruleHere says elsewhere for a scoped rule when the project holds no list, and behind when it holds another text', () => {
  const list = [valueRule('alpha-value', { scope: 'repository' })];
  assert.deepEqual(ruleHere('alpha-value', 'characters', null, list), { off: 'elsewhere' });
  assert.deepEqual(ruleHere('alpha-value', 'characters', undefined, list), { off: 'elsewhere' });
  assert.deepEqual(ruleHere('alpha-value', 'characters', 'an older list\n', list), { off: 'behind' });
});

// 2026-10-23 to 25: each landed rule change made the installed copy's list differ from the project's, so every rule of
// this repository the guard held went off with it, and three sessions opened with free titles (odd/tasks/behind-copy-guard.md).
test('ruleHere, behind a project whose list declares the rule, gives the copy\'s value as held, and whether the project declares it the same', () => {
  const list = [valueRule('alpha-value', { scope: 'repository' }), valueRule('beta-value', { scope: 'repository' })];
  const otherBeta = writeRules([list[0], { ...list[1], value: 13 }]);
  assert.deepEqual(ruleHere('alpha-value', 'characters', otherBeta, list), { off: 'behind', held: 12, same: true });
  assert.deepEqual(ruleHere('beta-value', 'characters', otherBeta, list), { off: 'behind', held: 12, same: false });
  // A wording the hash does not name leaves the declaration the same.
  const reworded = writeRules([{ ...list[0], subject: 'another subject' }, { ...list[1], value: 13 }]);
  assert.deepEqual(ruleHere('alpha-value', 'characters', reworded, list), { off: 'behind', held: 12, same: true });
  // A list that does not declare the rule live, of this repository, holds nothing: it is not of the rule.
  for (const project of [[list[1]], [{ ...list[0], scope: undefined }, list[1]], [{ ...list[0], retired: '2026-10-20' }, list[1]]]) {
    assert.deepEqual(ruleHere('alpha-value', 'characters', writeRules(project.map((rule) => JSON.parse(JSON.stringify(rule)))), list), { off: 'behind' });
  }
});

test('ruleHere throws for a scoped rule when projectData is neither a text nor nothing, and reads an unscoped rule whatever it is', () => {
  const list = [valueRule('alpha-value', { scope: 'repository' }), valueRule('beta-value')];
  for (const projectData of [Buffer.from('x'), 7, {}]) {
    assert.throws(() => ruleHere('alpha-value', 'characters', projectData, list), {
      name: 'Error',
      message: 'rule "alpha-value": ruleHere takes the text of the project\'s rules file, or nothing',
    }, `projectData ${String(projectData)}`);
  }
  assert.deepEqual(ruleHere('beta-value', 'characters', 7, list), { value: 12 });
});

test('ruleHere refuses as ruleValue does: an unknown id, a retired rule, a rule in prose and another unit', () => {
  const list = [
    valueRule('alpha-value', { scope: 'repository' }),
    retiredRule('gamma-retired', { retired: '2026-10-01' }),
    textRule('epsilon-text', { scope: 'repository' }),
  ];
  assert.throws(() => ruleHere('nowhere', undefined, undefined, list), {
    message: 'no rule "nowhere" is declared (bin/lib/rules-data.mjs)',
  });
  assert.throws(() => ruleHere('gamma-retired', undefined, undefined, list), {
    message: 'rule "gamma-retired" is retired since 2026-10-01: nothing reads it any more',
  });
  assert.throws(() => ruleHere('epsilon-text', undefined, undefined, list), {
    message: 'rule "epsilon-text" is a rule in prose: it has no value to read',
  });
  assert.throws(() => ruleHere('alpha-value', 'minutes', undefined, list), {
    message: 'rule "alpha-value" is in characters, and it was read as minutes',
  });
});

test('ruleOf gives a copy that is equal to the declaration and is not the same object, and a change of the copy leaves the list as it was', () => {
  const list = [valueRule('alpha-value', { was: [{ value: 9, until: '2026-01-01' }] })];
  const copy = ruleOf('alpha-value', list);
  assert.deepEqual(copy, list[0]);
  assert.notEqual(copy, list[0]);
  copy.value = 99;
  copy.was[0].value = 98;
  assert.equal(list[0].value, 12);
  assert.equal(list[0].was[0].value, 9);
});

test('ruleOf throws for an unknown id and for a retired rule, and gives a rule in prose', () => {
  const list = [retiredRule('gamma-retired', { retired: '2026-10-01' }), textRule('epsilon-text')];
  assert.throws(() => ruleOf('nowhere', list), {
    message: 'no rule "nowhere" is declared (bin/lib/rules-data.mjs)',
  });
  assert.throws(() => ruleOf('gamma-retired', list), {
    message: 'rule "gamma-retired" is retired since 2026-10-01: nothing reads it any more',
  });
  assert.deepEqual(ruleOf('epsilon-text', list), list[1]);
});

test('the declared rules in rules-data.mjs read with no fault', () => {
  assert.deepEqual(readRules(RULES), []);
});

// ── writeRules ─────────────────────────────────────────────────────────────────────────────────

// The header of rules-data.mjs, line by line, as writeRules must give it.
const HEADER_LINES = [
  '// The rules of this project that are declared, one object each, sorted by id. For a rule with a value',
  '// this is its home: the value is written here, in the unit a person says it in, and nowhere else; the',
  '// code that needs it reads it with `ruleValue` of ./rules.mjs (odd/tasks/rule-hierarchy.md, "How a rule',
  '// is declared"). This file is data and imports nothing. Its text is what `writeRules` of ./rules.mjs',
  '// gives for the list, and a test holds it to that: a rule is changed there, never in another shape.',
];

const RULES_PREFIX = 'export const RULES = ';

/** The lines given, each ended by a line break, as the text a file holds. */
const text = (...lines) => `${lines.join('\n')}\n`;

/** The list that `written` holds, read back from its text as JSON, with the keys in the order the text gives them. */
const parsed = (written) => JSON.parse(written.slice(written.indexOf(RULES_PREFIX) + RULES_PREFIX.length, -2));

test('writeRules sorts the rules by id', () => {
  assert.deepEqual(parsed(writeRules([valueRule('beta-value'), valueRule('alpha-value')])).map((rule) => rule.id), ['alpha-value', 'beta-value']);
});

test('writeRules orders the keys of a rule as the file holds them, whatever order it was given in', () => {
  const given = { owner: 'project', unit: 'characters', value: 12, since: '2026-10-11', subject: 'the test value of a thing', id: 'alpha-value' };
  assert.deepEqual(Object.keys(parsed(writeRules([given]))[0]), ['id', 'subject', 'owner', 'since', 'value', 'unit']);
});

test('writeRules orders the keys inside was and row, and keeps only the keys of each', () => {
  const rule = valueRule('alpha-value', {
    was: [{ until: '2026-01-01', value: 3, note: 'dropped' }],
    row: { since: '2026-10-02', reports: 'the gate reports it' },
  });
  const [out] = parsed(writeRules([rule]));
  assert.deepEqual(Object.keys(out.was[0]), ['value', 'until']);
  assert.deepEqual(Object.keys(out.row), ['reports', 'since']);
});

test('writeRules keeps the alias and the scope, in the order the file gives its keys, and the text reads back as the list', () => {
  const given = { alias: 'haiku', unit: 'characters', value: 12, scope: 'repository', since: '2026-10-11', subject: 'the test value of a thing', owner: 'project', id: 'alpha-value' };
  const written = writeRules([given]);
  assert.deepEqual(Object.keys(parsed(written)[0]), ['id', 'subject', 'owner', 'scope', 'since', 'value', 'unit', 'alias']);
  assert.deepEqual(parsed(written), [given]);
});

test('writeRules drops a key the file does not hold', () => {
  const [out] = parsed(writeRules([valueRule('alpha-value', { colour: 'red' })]));
  assert.equal(Object.hasOwn(out, 'colour'), false);
});

test('writeRules does not change the list it is given', () => {
  const given = [valueRule('beta-value', { was: [{ value: 1, until: '2026-01-01', note: 'x' }] }), valueRule('alpha-value')];
  const before = structuredClone(given);
  writeRules(given);
  assert.deepEqual(given, before);
  assert.deepEqual(given.map((rule) => rule.id), ['beta-value', 'alpha-value']);
});

test('writeRules gives the exact text of a list of one rule, header included', () => {
  assert.equal(writeRules([valueRule('alpha-value')]), text(
    ...HEADER_LINES,
    'export const RULES = [',
    '  {',
    '    "id": "alpha-value",',
    '    "subject": "the test value of a thing",',
    '    "owner": "project",',
    '    "since": "2026-10-11",',
    '    "value": 12,',
    '    "unit": "characters"',
    '  }',
    '];',
  ));
});

test('writeRules of the declared list is the text of rules-data.mjs itself', () => {
  const file = readFileSync(new URL('./rules-data.mjs', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(writeRules(RULES), file);
});

// ── rulesHash ──────────────────────────────────────────────────────────────────────────────────

test('rulesHash is 12 hexadecimal characters', () => {
  assert.match(rulesHash(WHOLE), /^[0-9a-f]{12}$/);
});

test('rulesHash is the same for the list in another order', () => {
  assert.equal(rulesHash([...WHOLE].reverse()), rulesHash(WHOLE));
});

test('rulesHash is the same when a subject changes', () => {
  assert.equal(rulesHash([valueRule('alpha-value', { subject: 'another subject' })]), rulesHash([valueRule('alpha-value')]));
});

test('rulesHash is different when a value changes', () => {
  assert.notEqual(rulesHash([valueRule('alpha-value', { value: 13 })]), rulesHash([valueRule('alpha-value')]));
});

test('rulesHash moves with the alias and with the scope', () => {
  const base = rulesHash([valueRule('alpha-value')]);
  assert.notEqual(rulesHash([valueRule('alpha-value', { alias: 'haiku' })]), base);
  assert.notEqual(rulesHash([valueRule('alpha-value', { scope: 'repository' })]), base);
});

test('rulesHash is different when a rule is retired', () => {
  assert.notEqual(rulesHash([retiredRule('alpha-value')]), rulesHash([valueRule('alpha-value')]));
});

test('rulesHash of a retired rule moves when its unit changes', () => {
  const was = [{ value: 60, until: '2026-10-01' }];
  assert.notEqual(rulesHash([retiredRule('alpha-retired', { was, unit: 'minutes' })]), rulesHash([retiredRule('alpha-retired', { was, unit: 'seconds' })]));
});

test('rulesHash is different when a unit, a flag, a path or the phrases change, and the same when a row is added', () => {
  const base = rulesHash([valueRule('alpha-value')]);
  assert.notEqual(rulesHash([valueRule('alpha-value', { unit: 'seconds' })]), base);
  assert.notEqual(rulesHash([valueRule('alpha-value', { flag: '--wait' })]), base);
  assert.notEqual(rulesHash([textRule('alpha-text', { path: 'docs/origin.md' })]), rulesHash([textRule('alpha-text')]));
  assert.notEqual(rulesHash([textRule('alpha-text', { phrases: ['another phrase that is found'] })]), rulesHash([textRule('alpha-text')]));
  assert.equal(rulesHash([valueRule('alpha-value', { row: { refuses: '2026-10-01' } })]), base);
});

// ── renderList ─────────────────────────────────────────────────────────────────────────────────

const NOTE = 'Rendered by `js-harness rules render` from `bin/lib/rules-data.mjs` and `docs/rule-sources.json`: do not edit it. A rule is changed with `js-harness rules change <id>`, which writes its declaration (`odd/tasks/rule-hierarchy.md`, "How a rule is declared"), its source and this list together, and this is the one text that shows a value.\nThe list holds no engine version and no date of a check: `js-harness rules applied` reads them from the session records.';

// One rule of each kind: his with a value and words, a project rule with a unit, a flag, earlier values,
// two readers and a design source; prose with its sentence and without it; retired with successors and without.
const SHOWN = [
  valueRule('alpha-value', { owner: 'sebastian', subject: 'the wait before a retry', since: '2026-10-01', value: 90, unit: 'seconds' }),
  valueRule('beta-value', { owner: 'project', subject: 'the most lines a file holds', since: '2026-10-03', value: 1200, unit: 'lines', flag: '--part-lines', was: [{ value: 800, until: '2026-10-02' }] }),
  textRule('gamma-text', { subject: 'a rule in prose', since: '2026-10-04', path: 'docs/FAILURES.md' }),
  textRule('delta-text', { owner: 'sebastian', subject: 'a prose rule with no sentence', since: '2026-10-05', path: 'docs/origin.md' }),
  retiredRule('epsilon-retired', { subject: 'a rule that is retired with successors', since: '2026-09-01', retired: '2026-10-06', successors: ['alpha-value', 'beta-value'], was: [{ value: 5, until: '2026-09-20' }] }),
  retiredRule('zeta-retired', { owner: 'sebastian', subject: 'a retired rule with no successor', since: '2026-09-02', retired: '2026-10-07' }),
];

const SOURCES = {
  'alpha-value': { kind: 'words', quotes: [{ quote: 'first', date: '2026-09-30', session: 'a1', line: 4 }, { quote: 'second', date: '2026-10-01', session: 'a2', line: 9 }], reading: 'the wait is in seconds', accepted: true, checked: { date: '2026-10-02', by: 'session' } },
  'beta-value': { kind: 'design', path: 'docs/origin.md' },
  'epsilon-retired': { kind: 'words', quotes: [{ quote: 'third', date: '2026-10-06', session: 'a3', line: 2 }], reading: 'the rule is replaced', accepted: true, checked: { date: '2026-10-06', by: 'command' } },
};
const READERS = { 'beta-value': ['bin/lib/a.mjs', 'bin/lib/b.mjs'] };
const SENTENCES = { 'gamma-text': 'the sentence the rule quotes' };

test('renderList gives the exact text of a list with every kind of block', () => {
  assert.equal(renderList(SHOWN, { sources: SOURCES, readers: READERS, sentences: SENTENCES }), text(
    '# Rules',
    '',
    NOTE,
    '',
    `Hash \`${rulesHash(SHOWN)}\`. In force: 4 (2 of Sebastián, 2 of the project). Retired: 2.`,
    '',
    "## Sebastián's",
    '',
    '### alpha-value',
    'The wait before a retry: 90 seconds.',
    '- Read by: none.',
    '- Since 2026-10-01. Row: reports. Source: his words of 2026-09-30, 2026-10-01, checked by a session on 2026-10-02.',
    '',
    '### delta-text',
    'A prose rule with no sentence: its text was not found in `docs/origin.md`.',
    '- Home: `docs/origin.md`.',
    '- Since 2026-10-05. Row: reports. Source: none recorded.',
    '',
    "## The project's",
    '',
    '### beta-value',
    'The most lines a file holds: 1,200 lines. The flag `--part-lines` overrides it for one run.',
    '- Was: 800 lines until 2026-10-02.',
    '- Read by: `bin/lib/a.mjs`, `bin/lib/b.mjs`.',
    '- Since 2026-10-03. Row: reports. Source: design, `docs/origin.md`.',
    '',
    '### gamma-text',
    'A rule in prose: "the sentence the rule quotes"',
    '- Home: `docs/FAILURES.md`.',
    '- Since 2026-10-04. Row: reports. Source: none recorded.',
    '',
    '## Retired',
    '',
    '### epsilon-retired',
    'A rule that is retired with successors. Retired on 2026-10-06: read `alpha-value`, `beta-value` instead.',
    '- Was: 5 until 2026-09-20.',
    '- Source: his words of 2026-10-06, checked by the command on 2026-10-06.',
    '',
    '### zeta-retired',
    'A retired rule with no successor. Retired on 2026-10-07: no rule replaces it.',
    '- Source: none recorded.',
  ));
});

test('renderList of an empty list keeps its three sections, each with None, and the counts at zero', () => {
  assert.equal(renderList([]), text(
    '# Rules',
    '',
    NOTE,
    '',
    `Hash \`${rulesHash([])}\`. In force: 0 (0 of Sebastián, 0 of the project). Retired: 0.`,
    '',
    "## Sebastián's",
    '',
    'None.',
    '',
    "## The project's",
    '',
    'None.',
    '',
    '## Retired',
    '',
    'None.',
  ));
});

test('renderList prints a number with its digits grouped, so 1200 prints as 1,200', () => {
  assert.ok(renderList([valueRule('alpha-value', { value: 1200 })]).split('\n').includes('The test value of a thing: 1,200 characters.'));
});

test('renderList keeps the fraction digits of a value, so 0.0001 seconds and 1234.5678 are not rounded', () => {
  assert.ok(renderList([valueRule('alpha-value', { value: 0.0001, unit: 'seconds' })]).split('\n').includes('The test value of a thing: 0.0001 seconds.'));
  assert.ok(renderList([valueRule('alpha-value', { value: 1234.5678 })]).split('\n').includes('The test value of a thing: 1,234.5678 characters.'));
  assert.ok(renderList([valueRule('alpha-value', { value: 1200 })]).split('\n').includes('The test value of a thing: 1,200 characters.'));
});

test('renderList shows a number as its own value: grouped in threes, and a very small or large one in exponent form, never as another number', () => {
  const shownAs = (value) => renderList([valueRule('alpha-value', { value, unit: 'characters' })]).split('\n')
    .find((line) => line.startsWith('The test value of a thing: '));
  assert.equal(shownAs(1200), 'The test value of a thing: 1,200 characters.');
  assert.equal(shownAs(1234.5678), 'The test value of a thing: 1,234.5678 characters.');
  assert.equal(shownAs(0.0001), 'The test value of a thing: 0.0001 characters.');
  assert.equal(shownAs(1e-21), 'The test value of a thing: 1e-21 characters.');
  assert.equal(shownAs(-1234567), 'The test value of a thing: -1,234,567 characters.');
  assert.equal(shownAs(1e21), 'The test value of a thing: 1e+21 characters.');
});

test('renderList gives the earlier values of a retired rule with its unit, as a value with a unit', () => {
  const lines = renderList([retiredRule('alpha-retired', { was: [{ value: 60, until: '2026-10-01' }], unit: 'minutes' })]).split('\n');
  assert.ok(lines.includes('- Was: 60 minutes until 2026-10-01.'));
});

test('renderList prints the alias, the scope and the review day of a value rule, after its value and before its earlier values', () => {
  const rule = valueRule('alpha-value', { alias: 'haiku', scope: 'repository', review: '2026-10-20', was: [{ value: 9, until: '2026-09-01' }] });
  assert.equal(renderList([rule]), text(
    '# Rules',
    '',
    NOTE,
    '',
    `Hash \`${rulesHash([rule])}\`. In force: 1 (0 of Sebastián, 1 of the project). Retired: 0.`,
    '',
    "## Sebastián's",
    '',
    'None.',
    '',
    "## The project's",
    '',
    '### alpha-value',
    'The test value of a thing: 12 characters.',
    '- Passed on a call as `haiku`.',
    '- Of this repository only: not in force in a project that installs the harness.',
    '- Looked at again on 2026-10-20.',
    '- Was: 9 characters until 2026-09-01.',
    '- Read by: none.',
    '- Since 2026-10-11. Row: reports. Source: none recorded.',
    '',
    '## Retired',
    '',
    'None.',
  ));
});

test('renderList prints the scope and the review day of a rule in prose, after its home and before its source line', () => {
  const lines = renderList([textRule('gamma-text', { scope: 'repository', review: '2026-10-20' })]).split('\n');
  const at = lines.indexOf('### gamma-text');
  assert.deepEqual(lines.slice(at, at + 6), [
    '### gamma-text',
    'A rule in prose: its text was not found in `docs/FAILURES.md`.',
    '- Home: `docs/FAILURES.md`.',
    '- Of this repository only: not in force in a project that installs the harness.',
    '- Looked at again on 2026-10-20.',
    '- Since 2026-10-11. Row: reports. Source: none recorded.',
  ]);
});

test('renderList shows a source it cannot read as not readable, and does not throw on it', () => {
  for (const source of [null, 'x', { kind: 'words' }, { kind: 'design' }]) {
    const lines = renderList([valueRule('alpha-value')], { sources: { 'alpha-value': source } }).split('\n');
    assert.ok(lines.includes('- Since 2026-10-11. Row: reports. Source: not readable.'), JSON.stringify(source));
  }
});

test('renderList prints each form of the row: reports, refuses since a day, or reports since a day with its reason', () => {
  const sinceLine = (row) => renderList([valueRule('alpha-value', row === undefined ? {} : { row })]).split('\n').find((line) => line.startsWith('- Since '));
  assert.equal(sinceLine(undefined), '- Since 2026-10-11. Row: reports. Source: none recorded.');
  assert.equal(sinceLine({ refuses: '2026-10-01' }), '- Since 2026-10-11. Row: refuses since 2026-10-01. Source: none recorded.');
  assert.equal(sinceLine({ reports: 'the gate reports it', since: '2026-10-02' }), '- Since 2026-10-11. Row: reports since 2026-10-02 (the gate reports it). Source: none recorded.');
});

test('renderList names the failure a rule guards against beside its row', () => {
  const lines = renderList([valueRule('alpha-value', { row: { refuses: '2026-10-01' }, failure: 'old-rule-beside-new' })]).split('\n');
  assert.ok(lines.includes('- Since 2026-10-11. Row: refuses since 2026-10-01, against the failure `old-rule-beside-new`. Source: none recorded.'), lines.join('\n'));
});

test('the head of the list says it holds no engine version and no date of a check, as the last line of its explaining paragraph', () => {
  const head = renderList([]).split('\n').slice(0, 5);
  assert.deepEqual([head[0], head[1], head[3], head[4]], [
    '# Rules',
    '',
    'The list holds no engine version and no date of a check: `js-harness rules applied` reads them from the session records.',
    '',
  ]);
  assert.ok(head[2].startsWith('Rendered by `js-harness rules render`'), head[2]);
});
