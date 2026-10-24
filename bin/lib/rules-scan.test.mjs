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
const PLANTED = {
  'agents-budget': { line: 'AGENTS.md stays within its budget of 1500 estimated tokens.', marked: 'AGENTS.md stays within its budget (`rule:agents-budget`).' },
  'codex-review-floor': { line: 'A review is never put under its floor of 300,000 input tokens.', marked: 'A review is never put under its floor (`rule:codex-review-floor`).' },
  'codex-review-margin': { line: 'The plan keeps a margin of 5% of the allowance.', marked: 'The plan keeps its margin (`rule:codex-review-margin`).' },
  'ci-gate-bound': { line: 'A run on GitHub not done within 20 minutes of the push is cancelled.', marked: 'A run on GitHub not done within `rule:ci-gate-bound` of the push is cancelled.' },
  'codex-review-rate': { line: 'A part is put at 1,200 input tokens a changed line.', marked: 'A part is put at the rate of `rule:codex-review-rate`.' },
  'context-pause': { line: 'Near 88% of its window a session writes its state.', marked: 'At the pause of `rule:context-pause` a session writes its state.' },
  'contract-run-timeout': { line: 'A contract command is stopped after 30 minutes.', marked: 'A contract command is stopped at `rule:contract-run-timeout`.' },
  'control-phrase-min': { line: 'A control phrase needs at least 12 characters.', marked: 'A control phrase needs the length of `rule:control-phrase-min`.' },
  'gate-log-command': { line: 'The gate log keeps a command cut at 120 characters.', marked: 'The gate log keeps a command cut as `rule:gate-log-command` says.' },
  'gate-log-size': { line: 'When the gate log is past 512 KiB it is renamed.', marked: 'When the gate log is past `rule:gate-log-size` it is renamed.' },
  'gate-max': { line: 'A gate is stopped after 30 minutes.', marked: 'A gate is stopped at `rule:gate-max`.' },
  'gate-wait': { line: 'A commit waits for its turn of the lock for up to 60 minutes.', marked: 'A commit waits for its turn of the lock as `rule:gate-wait` says.' },
  'person-present': { line: 'He is here when he wrote within 15 minutes.', marked: 'He is here when he wrote within `rule:person-present`.' },
  'review-effort': { line: 'Codex reviews at `medium` effort.', marked: 'Codex reviews at the effort of `rule:review-effort`.' },
  'review-model': { line: 'Codex reviews on gpt-6.1-sol.', marked: 'Codex reviews on the model of `rule:review-model`.' },
  'review-part-files': { line: 'A part holds 40 files at most.', marked: 'A part holds the files of `rule:review-part-files` at most.' },
  'review-part-lines': { line: 'A part holds up to 400 changed lines.', marked: 'A part holds up to `rule:review-part-lines`.' },
  'review-parts-unflagged': { line: 'A run of more than 6 parts needs its flag.', marked: 'A run of more parts than `rule:review-parts-unflagged` needs its flag.' },
  'review-timeout': { line: 'A Codex review is stopped after 30 minutes.', marked: 'A Codex review is stopped at `rule:review-timeout`.' },
  'reviewed-commit-lines': { line: 'A reviewed commit holds up to 1,200 changed lines.', marked: 'A reviewed commit holds up to `rule:reviewed-commit-lines`.' },
  'sensor-silence': { line: 'A sensor that stays silent for 20 minutes is stopped.', marked: 'A sensor that stays silent for `rule:sensor-silence` is stopped.' },
  'sensor-timeout': { line: 'A sensor is stopped after 60 minutes.', marked: 'A sensor is stopped at `rule:sensor-timeout`.' },
  'session-effort': { line: 'A work session runs at `high` effort.', marked: 'A work session runs at the effort of `rule:session-effort`.' },
  'session-model': { line: 'A work session runs on claude-opus-5-5.', marked: 'A work session runs on the model of `rule:session-model`.' },
  'subagent-effort': { line: 'Every subagent runs at `high` effort.', marked: 'Every subagent runs at the effort of `rule:subagent-effort`.' },
  'subagent-reader-model': { line: 'A verifier runs on claude-opus-5-5.', marked: 'A verifier runs on the model of `rule:subagent-reader-model`.' },
  'subagent-writer-model': { line: 'A narrow writer runs on claude-haiku-5-5.', marked: 'A narrow writer runs on the model of `rule:subagent-writer-model`.' },
  'wait-every': { line: 'js-harness wait looks again every 120 seconds.', marked: 'js-harness wait looks again as often as `rule:wait-every` says.' },
  'wait-for': { line: 'js-harness wait gives up after 480 minutes.', marked: 'js-harness wait gives up at `rule:wait-for`.' },
};

test('on the real list, every rule with patterns finds its own planted line, and loses it to its mark', () => {
  const withPatterns = RULES.filter((rule) => !Object.hasOwn(rule, 'retired') && Array.isArray(rule.patterns)).map((rule) => rule.id);
  assert.deepEqual(Object.keys(PLANTED).sort(), [...withPatterns].sort(), 'a planted line for each rule with patterns, and for no other');
  for (const id of withPatterns) {
    const lines = inForceLines('docs/ROADMAP.md', `${PLANTED[id].line}\n${PLANTED[id].marked}\n`);
    assert.deepEqual(scanLines(RULES, lines).filter((finding) => finding.id === id).map((finding) => finding.line), [1], id);
  }
});

// The lines each narrowed rule once caught and must not catch again: the false positives it was narrowed for.
const NEAR_MISS = {
  'codex-review-floor': ['const mid = Math.floor(sorted.length / 2);', 'The floor is the cheapest part ever measured (24,206).'],
  'codex-review-margin': 'The gate keeps a margin of 30 seconds on its bound.',
  'codex-review-rate': 'That part cost 325 input tokens a changed line.',
  'context-pause': [
    'The parent was at 70% of its window.',
    'The busiest 24 hours of the window hold 47 events.',
    'The context limit defaults to 73%.',
  ],
  'gate-log-command': 'The Codex command line is cut to 100 characters.',
  'gate-log-size': 'Search the git log over 3 days.',
  'gate-max': 'The gate is stopped when 90 percent are done.',
  'gate-wait': 'A commit waits for its turn of the lock, as S1 says.',
  'person-present': 'The flag is here for 3 releases.',
  'review-effort': ['| lean | `gpt-6.1-sol` `medium` | 7 |', 'Explore, review and verify stay on Opus 5.5 at high effort.'],
  'review-part-files': 'Each part is read as { of: 1, files }.',
  'review-parts-unflagged': 'A run of 28 parts started without the numbers.',
  'review-timeout': 'The Codex login is stopped past codex-review-prompt.mjs:51.',
  'reviewed-commit-lines': 'The commit is 5,222 changed lines.',
  'subagent-effort': [
    'The orchestrator runs on gpt-6.1-sol with effort: "medium".',
    'Two readers on Opus at high effort read the first version.',
    'Measured (`odd/tasks/subagent-model-routing.md`): Opus 5.5 at high effort.',
  ],
};

test('on the real list, a narrowed rule no longer finds the line it was narrowed for', () => {
  for (const [id, lines] of Object.entries(NEAR_MISS)) {
    for (const line of [lines].flat()) {
      assert.deepEqual(scanLines(RULES, inForceLines('docs/ROADMAP.md', `${line}\n`)).filter((finding) => finding.id === id), [], `${id}: ${line}`);
    }
  }
});

test('a pattern that is no regular expression is not scanned, so the scan never throws: readRules reports it', () => {
  const broken = { ...WAIT, patterns: ['(', 'wait.{0,40}{amount}'] };
  const files = [{ path: 'docs/ROADMAP.md', text: 'wait 60 minutes\n' }];
  assert.deepEqual(countFindings([broken, { ...PAUSE, patterns: ['['] }], files), { counts: { 'gate-wait': 1, 'context-pause': 0 }, unscanned: [] });
  assert.deepEqual(scanLines([{ ...WAIT, patterns: [')', 7] }], inForceLines('docs/ROADMAP.md', 'wait 60 minutes\n')), []);
});
