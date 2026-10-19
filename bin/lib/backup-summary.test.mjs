import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary, privacyCheck, readTerms, renderSummary, seedTerms } from './backup-summary.mjs';

const ROADMAP = [
  '# Roadmap',
  '## Checklist',
  '### Phase one',
  '- [x] Built the gate',
  '- [ ] Memory that survives the machine',
  '### Phase two',
  '- [ ] Onboarding',
  '- [ ] Remote server',
  '## Notes',
  '- [ ] not a step of the checklist',
].join('\n');

const feature = (goal, tasks) => ['# A feature', '', '## Goal', goal, '', '## Tasks', ...tasks].join('\n');
const FEATURES = [
  { id: 'memory-backup', markdown: feature('Everything survives a cleanup. A second sentence stays out.', ['- [x] T1 design', '- [ ] T2 build the run', '- [ ] T3 init']) },
  { id: 'done-feature', markdown: feature('It is finished.', ['- [x] T1 all of it']) },
];

const observation = (id, title, topic, created, project = 'js-harness') => ({ id, title, topic_key: topic, created_at: created, project, content: 'never shown' });
const OBSERVATIONS = [
  observation(1, 'Backup design v2 after the readers', 'odd/memory-backup/tasks', '2026-10-19 07:12:00'),
  observation(2, 'A note with no feature topic', 'some/other', '2026-10-19 08:00:00'),
  observation(3, 'Another project decision', 'odd/client/tasks', '2026-10-19 09:00:00', 'client-project'),
  observation(4, 'Gate lock decided', 'odd/done-feature/tasks', '2026-10-18 10:00:00'),
  observation(6, 'Unpublished feature plan', 'odd/unmerged-feature/tasks', '2026-10-19 11:00:00'),
  { id: 5, title: 'no topic at all', created_at: '2026-10-19 10:00:00', project: 'js-harness' },
];

test('buildSummary holds the four sections, from the allowlist only', () => {
  const lines = buildSummary({ roadmap: ROADMAP, features: FEATURES, observations: OBSERVATIONS });
  const text = lines.join('\n');

  assert.match(text, /^## State$/m);
  assert.match(text, /^- Phase one: 1\/2 \(50%\)$/m);
  assert.match(text, /^- Phase two: 0\/2 \(0%\)$/m);
  assert.match(text, /^- Total: 1\/4 \(25%\)$/m);
  assert.match(text, /^## Open work$/m);
  assert.match(text, /^- Phase one: Memory that survives the machine$/m);
  assert.match(text, /^- Phase two: Remote server$/m);
  assert.doesNotMatch(text, /Built the gate|not a step of the checklist/);
  assert.match(text, /^## Features in flight$/m);
  assert.match(text, /^- memory-backup: Everything survives a cleanup\. Next: T2 build the run$/m);
  assert.doesNotMatch(text, /^- done-feature:|A second sentence/m, 'a finished feature is not in flight');
  assert.match(text, /^## Decisions$/m);
  const decisions = lines.slice(lines.indexOf('## Decisions') + 1).filter((line) => line.startsWith('- '));
  assert.deepEqual(decisions, ['- 2026-10-19 memory-backup: Backup design v2 after the readers', '- 2026-10-18 done-feature: Gate lock decided']);
  assert.doesNotMatch(text, /never shown|no feature topic|Another project|no topic at all/);
  assert.doesNotMatch(text, /Unpublished|unmerged-feature/, 'a feature with no document on main is not public yet');
});

test('buildSummary keeps the newest decisions up to its limit', () => {
  const many = Array.from({ length: 40 }, (_, i) => observation(i, `Decision ${i}`, 'odd/f/tasks', `2026-10-${String(1 + (i % 28)).padStart(2, '0')} 00:00:${String(i).padStart(2, '0')}`));
  const decisions = buildSummary({ roadmap: ROADMAP, features: [{ id: 'f', markdown: '# F\n' }], observations: many }).filter((line) => / f: Decision /.test(line));
  assert.equal(decisions.length, 30);
  assert.equal(decisions[0], '- 2026-10-28 f: Decision 27');
});

test('privacyCheck drops a line with an email, a secret, a home path or a private term, and counts them', () => {
  const lines = [
    '- kept: the gate runs on CI',
    '- mail me at someone@example.com',
    '- token ghp_' + 'a'.repeat(36),
    '- the file at C:\\Users\\someone\\notes.md',
    '- the file at /home/someone/notes.md',
    '- worked on Clientname matters',
    '- a template is not the term temp',
  ];
  const { kept, dropped } = privacyCheck(lines, ['clientname', 'temp']);
  assert.deepEqual(kept, ['- kept: the gate runs on CI']);
  assert.equal(dropped, 6);
  assert.deepEqual(privacyCheck(['- a template here'], ['temp']).kept, ['- a template here'], 'a term is a whole word');
  // Project names are slugs: the term `harness` (another project) is not inside `js-harness`.
  assert.deepEqual(privacyCheck(['- js-harness gate'], ['harness']).kept, ['- js-harness gate']);
  assert.equal(privacyCheck(['- a _clientname_ plan', '- a __clientname__ plan'], ['clientname']).dropped, 2, 'Markdown emphasis does not hide a term');
  assert.equal(privacyCheck(['- the harness repo', '- in harness-lab'], ['harness']).dropped, 2, 'the term alone, or as the first part of a longer slug, is still dropped');
});

test('renderSummary ends with the count of dropped lines, and refuses without a terms list', () => {
  const { text, dropped } = renderSummary({ roadmap: ROADMAP, features: FEATURES, observations: OBSERVATIONS, terms: ['gate'] });
  assert.equal(dropped, 1, 'the decision "Gate lock decided" holds a private term');
  assert.match(text, /^# js-harness memory summary$/m);
  assert.match(text, /Lines left out by the privacy check: 1\.\n$/);
  assert.doesNotMatch(text, /Gate lock decided/);
  assert.throws(() => renderSummary({ roadmap: ROADMAP, features: [], observations: [], terms: null }), /private-terms\.txt/);
});

test('readTerms and seedTerms keep whole names of three letters or more, never the project itself', () => {
  assert.deepEqual(readTerms('# comment\nClientname\n\nab\n  spaced name  \n'), ['clientname', 'spaced name']);
  assert.deepEqual(seedTerms(['js-harness', 'abogadoclient', 'v', 'app', 'temp', 'harness-lab']), ['abogadoclient', 'harness-lab', 'temp']);
});
