// The scan of the texts in force for restated values (odd/tasks/rule-hierarchy.md, "The row `rules` (T16d)").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from './rules-data.mjs';
import { countFindings, inForceLines, registerFindings, scanLines } from './rules-scan.mjs';

const WAIT = { id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', patterns: ['wait.{0,40}{amount}'] };
const PAUSE = { id: 'context-pause', subject: 'the pause', owner: 'project', since: '2026-10-11', value: 88, unit: 'percent' };
const GONE = { id: 'old-wait', subject: 'an old wait', owner: 'project', since: '2026-10-01', retired: '2026-10-11', successors: [], patterns: ['wait.{0,40}{amount}'] };

test('a line that restates a value by its subject is a finding, with its place', () => {
  const lines = inForceLines('docs/ROADMAP.md', '# Roadmap\nThe gate may wait 60 minutes.\nNothing here.\n');
  assert.deepEqual(scanLines([WAIT, PAUSE], lines), [{ id: 'gate-wait', path: 'docs/ROADMAP.md', line: 2, text: 'The gate may wait 60 minutes.' }]);
});

test('a mark of the rule beside the value does not excuse it: the mark is the cure instead of the value', () => {
  const lines = inForceLines('docs/ROADMAP.md', 'The gate may wait 60 minutes (`rule:gate-wait`).\nThe gate waits as `rule:gate-wait` says.\n');
  assert.deepEqual(scanLines([WAIT], lines).map((finding) => finding.line), [1]);
});

test('a line in a fence, in the history of a feature document, or in a home of the list is no finding', () => {
  const doc = '# A feature\nThe gate may wait 60 minutes.\n```\nwait 60 minutes\n```\n## Progress\n- the gate waited an hour\n';
  assert.deepEqual(inForceLines('odd/tasks/a.md', doc).map((line) => line.line), [1, 2]);
  const logged = '# A feature\n## Log\nL1 wait 45 minutes\n';
  assert.deepEqual(inForceLines('odd/tasks/b.md', logged).map((line) => line.line), [1]);
  for (const home of ['bin/lib/rules-data.mjs', 'docs/rule-sources.json', 'docs/RULES.md', 'docs/FAILURES.md', 'docs/origin.md']) {
    assert.deepEqual(inForceLines(home, 'wait 60 minutes\n'), [], home);
  }
  assert.equal(inForceLines('docs/ROADMAP.md', '## Progress\nwait 60 minutes\n').length, 2, 'only a feature document has a history');
});

test('the counts name every scanned rule, and the rules with no patterns are listed as unscanned', () => {
  const files = [
    { path: 'docs/ROADMAP.md', text: 'wait 60 minutes\nwait an hour\n' },
    { path: 'odd/tasks/a.md', text: 'wait 60 minutes\n## Progress\nwait 60 minutes\n' },
  ];
  assert.deepEqual(countFindings([WAIT, PAUSE, GONE], files), { counts: { 'gate-wait': 3 }, unscanned: ['context-pause'] });
});

test('a failure that names no register entry, and a switch back with no sighting since, are findings', () => {
  const entries = [{ id: 'old-rule-beside-new', seen: [{ date: '2026-10-12' }, { date: '2026-10-16' }] }, { id: 'quiet-entry', seen: [{ date: '2026-10-01' }] }];
  const rules = [
    { ...WAIT, failure: 'old-rule-beside-new', row: { refuses: '2026-10-14' } },
    { ...WAIT, id: 'gate-max', failure: 'no-such-entry' },
    { ...WAIT, id: 'gate-sat', failure: 'old-rule-beside-new', row: { reports: 'a wrong pattern', since: '2026-10-15' } },
    { ...WAIT, id: 'gate-cold', failure: 'quiet-entry', row: { reports: 'a wrong pattern', since: '2026-10-15' } },
  ];
  assert.deepEqual(registerFindings(rules, entries), [
    'rule "gate-max": its failure "no-such-entry" names no entry of docs/FAILURES.md',
    'rule "gate-cold": it reports again since 2026-10-15 (a wrong pattern), and its failure "quiet-entry" has no "- Seen:" line on or after that day',
  ]);
});

// One line for each rule of the real list that carries patterns, restating its value as a text might: a rule gets
// its patterns and its planted line in the same change, so a pattern that finds nothing in particular never lands.
const PLANTED = {};

test('on the real list, every rule with patterns finds its own planted line, and loses it to its mark', () => {
  const withPatterns = RULES.filter((rule) => !Object.hasOwn(rule, 'retired') && Array.isArray(rule.patterns)).map((rule) => rule.id);
  assert.deepEqual(Object.keys(PLANTED).sort(), [...withPatterns].sort(), 'a planted line for each rule with patterns, and for no other');
  for (const id of withPatterns) {
    const lines = inForceLines('docs/ROADMAP.md', `${PLANTED[id].line}\n${PLANTED[id].marked}\n`);
    assert.deepEqual(scanLines(RULES, lines).filter((finding) => finding.id === id).map((finding) => finding.line), [1], id);
  }
});

test('a pattern that is no regular expression is not scanned, so the scan never throws: readRules reports it', () => {
  const broken = { ...WAIT, patterns: ['(', 'wait.{0,40}{amount}'] };
  const files = [{ path: 'docs/ROADMAP.md', text: 'wait 60 minutes\n' }];
  assert.deepEqual(countFindings([broken, { ...PAUSE, patterns: ['['] }], files), { counts: { 'gate-wait': 1, 'context-pause': 0 }, unscanned: [] });
  assert.deepEqual(scanLines([{ ...WAIT, patterns: [')', 7] }], inForceLines('docs/ROADMAP.md', 'wait 60 minutes\n')), []);
});
