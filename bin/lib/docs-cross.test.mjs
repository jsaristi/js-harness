import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_LIMIT, crossIndex, parseRules } from './docs-cross.mjs';

/** A rendered list of rules, as `js-harness rules render` writes it: `inForce` and `retired` are `[id, lines]`. */
function rulesList(inForce, retired = []) {
  return [
    '# Rules',
    '',
    "## Sebastián's",
    '',
    ...inForce.flatMap(([id, lines]) => [`### ${id}`, 'What the rule says.', ...lines, '']),
    '## Retired',
    '',
    ...retired.flatMap(([id, successor]) => [`### ${id}`, `What it said. Retired on 2026-10-27: read \`${successor}\` instead.`, '']),
  ].join('\n');
}

/** A capability as `parseSpec` gives it. */
const capability = (title, fields) => ({ title, line: 1, fields: { Problem: '', Requirement: '', Reason: '', Proof: '', Discarded: '', Today: '', ...fields } });

test('parseRules reads each rule in force with its home, its readers and its failure, and the retired ones with their successors', () => {
  const rules = parseRules(rulesList(
    [
      ['double-review', ['- Home: `bin/lib/protocols-skill.mjs`.', '- Since 2026-11-01. Row: reports, against the failure `proposal-unreviewed`. Source: design.']],
      ['codex-review-floor', ['- Read by: `bin/lib/codex-review-allowance.mjs`, `bin/codex-review.mjs`.', '- Since 2026-10-11. Row: reports.']],
    ],
    [['ask-before-away', 'away-autonomy']],
  ));
  assert.deepEqual(rules, [
    { id: 'double-review', files: ['bin/lib/protocols-skill.mjs'], failure: 'proposal-unreviewed' },
    { id: 'codex-review-floor', files: ['bin/lib/codex-review-allowance.mjs', 'bin/codex-review.mjs'], failure: null },
    { id: 'ask-before-away', retired: true, successors: ['away-autonomy'] },
  ]);
});

/** The inputs of a cross index: two rules, two failure entries, two feature documents and the files they name. */
function inputs(capabilities, more = {}) {
  return {
    capabilities,
    rules: [
      { id: 'double-review', files: ['bin/lib/double-review.mjs'], failure: 'proposal-unreviewed' },
      { id: 'gate-max', files: ['bin/gate.mjs'], failure: null },
      { id: 'old-rule', retired: true, successors: ['gate-max'] },
    ],
    failures: [
      { id: 'proposal-unreviewed', control: 'bin/lib/protocols-skill.mjs' },
      { id: 'gate-left-running', control: 'bin/gate.test.mjs' },
    ],
    tracked: new Set(['bin/gate.mjs', 'bin/gate.test.mjs', 'bin/lib/double-review.mjs', 'bin/lib/protocols-skill.mjs', 'odd/tasks/gate.md', 'odd/tasks/review.md', 'docs/SPEC.md']),
    texts: new Map([['odd/tasks/gate.md', '# Gate\n\n## How the lock is held\n'], ['odd/tasks/review.md', '# Review\n']]),
    ...more,
  };
}

test('explicit links come from what the capability cites: a document of odd/ or docs/ with its section, a rule by id, a failure by id, and the failure its rule declares', () => {
  const index = crossIndex(inputs([
    capability('The gate', { Reason: 'Decided in `odd/tasks/gate.md`, "How the lock is held"; held by `rule:double-review`, against `gate-left-running`.' }),
  ]));
  assert.deepEqual(index.capabilities[0].explicit, {
    documents: ['odd/tasks/gate.md'],
    rules: ['double-review'],
    failures: ['gate-left-running', 'proposal-unreviewed'],
  });
  assert.deepEqual(index.broken, []);
});

test('inferred links are kept apart, each with the file that made it: a rule whose file is in the Today line, a failure whose control is in Today or Proof', () => {
  const index = crossIndex(inputs([
    capability('The gate', { Today: '`bin/gate.mjs`', Proof: '`node --test bin/gate.test.mjs`' }),
  ]));
  const [gate] = index.capabilities;
  assert.deepEqual(gate.explicit, { documents: [], rules: [], failures: [] });
  assert.deepEqual(gate.inferred, {
    rules: [{ id: 'gate-max', via: 'bin/gate.mjs' }],
    failures: [{ id: 'gate-left-running', via: 'bin/gate.test.mjs' }],
  });
});

test('an explicit link wins over the same link inferred, so a link is never counted twice', () => {
  const index = crossIndex(inputs([capability('The gate', { Today: '`bin/gate.mjs`', Reason: 'See `rule:gate-max`.' })]));
  assert.deepEqual(index.capabilities[0].explicit.rules, ['gate-max']);
  assert.deepEqual(index.capabilities[0].inferred.rules, []);
});

test('a file more than SHARED_LIMIT rules name, or more than SHARED_LIMIT Today lines claim, is printed as too shared and infers nothing', () => {
  const many = Array.from({ length: SHARED_LIMIT + 1 }, (_, i) => ({ id: `rule-${String.fromCharCode(97 + i)}`, files: ['bin/lib/manifest.mjs'], failure: null }));
  const byRules = crossIndex(inputs([capability('Install', { Today: '`bin/lib/manifest.mjs`' })], { rules: many, tracked: new Set(['bin/lib/manifest.mjs']) }));
  assert.deepEqual(byRules.capabilities[0].inferred.rules, []);
  assert.deepEqual(byRules.shared, [{ file: 'bin/lib/manifest.mjs', rules: SHARED_LIMIT + 1, todays: 1 }]);
  assert.deepEqual(byRules.unreached.rules.map((rule) => rule.shared), many.map(() => 'bin/lib/manifest.mjs'));

  const claims = Array.from({ length: SHARED_LIMIT + 1 }, (_, i) => capability(`Capability ${i}`, { Today: '`bin/gate.mjs`' }));
  const byTodays = crossIndex(inputs(claims));
  assert.ok(byTodays.capabilities.every((one) => one.inferred.rules.length === 0));
  assert.deepEqual(byTodays.shared, [{ file: 'bin/gate.mjs', rules: 1, todays: SHARED_LIMIT + 1 }]);
});

test('what no capability reaches is listed: rules in force, failure entries and feature documents', () => {
  const index = crossIndex(inputs([capability('The gate', { Reason: 'In `odd/tasks/gate.md`.' })]));
  assert.deepEqual(index.unreached, {
    rules: [{ id: 'double-review' }, { id: 'gate-max' }],
    failures: ['gate-left-running', 'proposal-unreviewed'],
    features: ['odd/tasks/review.md'],
  });
});

test('an explicit link that does not resolve is broken: a path not tracked, a quoted section not in its file, a rule not in force, a retired one with its successor', () => {
  const index = crossIndex(inputs([
    capability('The gate', { Reason: 'See `odd/tasks/gone.md`, `odd/tasks/gate.md`, "No such section", `rule:no-such-rule` and `rule:old-rule`.' }),
  ]));
  assert.deepEqual(index.broken, [
    '"The gate" (line 1) cites odd/tasks/gone.md, which is not a tracked file',
    '"The gate" (line 1) quotes "No such section" of odd/tasks/gate.md, which that file does not hold',
    '"The gate" (line 1) names rule:no-such-rule, which is no rule',
    '"The gate" (line 1) names rule:old-rule, retired: read gate-max instead',
  ]);
  assert.deepEqual(index.capabilities[0].explicit.rules, []);
});

test('a quoted section wrapped across lines still resolves, since prose reflowed is the same section', () => {
  const index = crossIndex(inputs([capability('The gate', { Reason: 'Decided in `odd/tasks/gate.md`, "How the lock\nis held".' })]));
  assert.deepEqual(index.broken, []);
});

test('a failure id is read only as a whole word, so an id inside a longer one, a path or a rule id is no link', () => {
  const index = crossIndex(inputs([capability('The gate', { Reason: 'Not `gate-left-running-twice`, nor proposal-unreviewed-again, nor `odd/tasks/gate-left-running.md` or `rule:gate-left-running`.' })], {
    tracked: new Set(['odd/tasks/gate-left-running.md']),
    rules: [{ id: 'gate-left-running', files: [], failure: null }],
  }));
  assert.deepEqual(index.capabilities[0].explicit.failures, []);
  const ended = crossIndex(inputs([capability('The gate', { Reason: 'Against gate-left-running.' })]));
  assert.deepEqual(ended.capabilities[0].explicit.failures, ['gate-left-running']);
});

test('the failure a named rule declares is a link only where the register holds it, and is broken otherwise', () => {
  const index = crossIndex(inputs([capability('The gate', { Reason: 'Held by `rule:gate-max`.' })], {
    rules: [{ id: 'gate-max', files: [], failure: 'gone-failure' }],
  }));
  assert.deepEqual(index.capabilities[0].explicit.failures, []);
  assert.deepEqual(index.broken, ['"The gate" (line 1) names rule:gate-max, whose failure gone-failure is no entry of the register']);
});

test('a retired rule with no successor is said to have none', () => {
  const index = crossIndex(inputs([capability('The gate', { Reason: 'Held by `rule:lost`.' })], {
    rules: [{ id: 'lost', retired: true, successors: [] }],
  }));
  assert.deepEqual(index.broken, ['"The gate" (line 1) names rule:lost, retired with no successor']);
});
