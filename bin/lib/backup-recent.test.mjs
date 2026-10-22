import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecent, compareRecent, formatOf, RECENT_FORMAT, recentFiles, selectRecent } from './backup-recent.mjs';

let next = 0;
const obs = (fields) => {
  next += 1;
  return {
    id: next,
    sync_id: `obs-${next}`,
    type: 'decision',
    title: `Observation ${next}`,
    content: `**What**: thing ${next}\n**Why**: reason ${next}`,
    project: 'proj',
    scope: 'project',
    created_at: '2026-10-01 10:00:00',
    updated_at: '2026-10-01 10:00:00',
    pinned: false,
    ...fields,
  };
};
const day = (n) => `2026-10-${String(n).padStart(2, '0')} 12:00:00`;

test('only the important types of the project are selected, newest first', () => {
  const kept = [obs({ type: 'bugfix', updated_at: day(2) }), obs({ type: 'discovery', updated_at: day(5) }), obs({ type: 'decision', updated_at: day(3) })];
  const noise = [
    obs({ type: 'passive', updated_at: day(9) }),
    obs({ type: 'session_summary', updated_at: day(9) }),
    obs({ type: 'manual', updated_at: day(9) }),
    obs({ type: 'decision', project: 'other', updated_at: day(9) }),
  ];
  const { entries } = selectRecent({ observations: [...kept, ...noise], relations: [], project: 'proj' });
  assert.deepEqual(entries.map((e) => e.sync_id), [kept[1].sync_id, kept[2].sync_id, kept[0].sync_id]);
});

test('a deleted observation and the target of a supersedes relation are left out', () => {
  const old = obs({ updated_at: day(1) });
  const replacement = obs({ updated_at: day(2) });
  const deleted = obs({ updated_at: day(3), deleted_at: day(4) });
  const relations = [
    { source_id: replacement.sync_id, target_id: old.sync_id, relation: 'supersedes', judgment_status: 'judged', updated_at: day(2) },
    { source_id: 'obs-elsewhere', target_id: replacement.sync_id, relation: 'related', judgment_status: 'judged' },
  ];
  const { entries } = selectRecent({ observations: [old, replacement, deleted], relations, project: 'proj' });
  assert.deepEqual(entries.map((e) => e.sync_id), [replacement.sync_id]);
});

test('a supersedes relation whose source is not in the export, or still pending, drops nothing', () => {
  const target = obs({ updated_at: day(1) });
  const other = obs({ updated_at: day(2) });
  const relations = [
    { source_id: 'obs-missing', target_id: target.sync_id, relation: 'supersedes', judgment_status: 'judged' },
    { source_id: other.sync_id, target_id: target.sync_id, relation: 'supersedes', judgment_status: 'pending' },
  ];
  const { entries } = selectRecent({ observations: [target, other], relations, project: 'proj' });
  assert.equal(entries.length, 2);
});

test('one entry per topic_key: its newest revision', () => {
  const first = obs({ topic_key: 'architecture/x', updated_at: day(1) });
  const latest = obs({ topic_key: 'architecture/x', updated_at: day(6) });
  const untouched = obs({ updated_at: day(2) });
  const { entries } = selectRecent({ observations: [first, latest, untouched], relations: [], project: 'proj' });
  assert.deepEqual(entries.map((e) => e.sync_id), [latest.sync_id, untouched.sync_id]);
});

test('weight: pinned always, then up to 70 decisions or architecture, then the newest others up to 100', () => {
  const pinned = obs({ type: 'discovery', pinned: true, updated_at: '2026-01-01 00:00:00' });
  const decisions = Array.from({ length: 90 }, (_, i) => obs({ type: i % 2 ? 'architecture' : 'decision', updated_at: `2026-09-01 00:${String(i).padStart(2, '0')}:00` }));
  const others = Array.from({ length: 50 }, (_, i) => obs({ type: 'bugfix', updated_at: `2026-10-01 00:${String(i).padStart(2, '0')}:00` }));
  const { entries } = selectRecent({ observations: [pinned, ...decisions, ...others], relations: [], project: 'proj' });
  assert.equal(entries.length, 100);
  assert.ok(entries.some((e) => e.sync_id === pinned.sync_id));
  const kinds = (type) => entries.filter((e) => e.type === type).length;
  assert.equal(kinds('decision') + kinds('architecture'), 70);
  assert.equal(kinds('bugfix'), 29);
  // The 70 newest decisions, and the 29 newest others.
  assert.ok(entries.some((e) => e.sync_id === decisions[89].sync_id));
  assert.ok(!entries.some((e) => e.sync_id === decisions[19].sync_id));
  assert.ok(!entries.some((e) => e.sync_id === others[20].sync_id));
});

test('slots one kind leaves unused go to the other', () => {
  const decisions = Array.from({ length: 95 }, (_, i) => obs({ updated_at: `2026-09-01 01:${String(i).padStart(2, '0')}:00` }));
  const others = Array.from({ length: 10 }, () => obs({ type: 'bugfix' }));
  const many = selectRecent({ observations: [...decisions, ...others], relations: [], project: 'proj' }).entries;
  assert.equal(many.length, 100);
  assert.equal(many.filter((e) => e.type === 'bugfix').length, 10);

  const fewDecisions = Array.from({ length: 5 }, () => obs({}));
  const manyOthers = Array.from({ length: 120 }, () => obs({ type: 'discovery' }));
  const flipped = selectRecent({ observations: [...fewDecisions, ...manyOthers], relations: [], project: 'proj' }).entries;
  assert.equal(flipped.length, 100);
  assert.equal(flipped.filter((e) => e.type === 'decision').length, 5);
});

test('the state holds the three newest session summaries of the project', () => {
  const summaries = [1, 2, 3, 4].map((n) => obs({ type: 'session_summary', updated_at: day(n), title: `Session ${n}` }));
  const { state } = selectRecent({ observations: summaries, relations: [], project: 'proj' });
  assert.deepEqual(state.map((s) => s.title), ['Session 4', 'Session 3', 'Session 2']);
});

const EXPORT = () => ({
  exported_at: '2026-10-22T00:00:00Z',
  observations: [
    obs({ project: 'js-harness', title: 'Gate lock decided', updated_at: day(20), topic_key: 'decision/gate' }),
    obs({ project: 'js-harness', type: 'bugfix', title: 'Fixed the hook', updated_at: day(21), scope: 'personal' }),
    obs({ project: 'js-harness', type: 'session_summary', title: 'Session summary: js-harness', content: '## Goal\nShip RECENT.md', updated_at: day(22) }),
    obs({ project: 'Client App/2', type: 'architecture', title: 'Client layering', updated_at: day(10) }),
    obs({ project: 'noise-only', type: 'passive', updated_at: day(10) }),
  ],
  relations: [],
});

test('buildRecent writes one file per project with an important observation, and the index', () => {
  const { files } = buildRecent(EXPORT());
  assert.deepEqual([...files.keys()].sort(), ['RECENT.md', 'recent/client-app-2.md', 'recent/js-harness.md']);
  const index = files.get('RECENT.md');
  assert.match(index, /recent\/js-harness\.md/);
  assert.match(index, /recent\/client-app-2\.md/);
  assert.doesNotMatch(index, /noise-only/);
});

test('a project file holds the state, the index and each entry with date, type, topic, scope and full content', () => {
  const text = buildRecent(EXPORT()).files.get('recent/js-harness.md');
  assert.match(text, /^# js-harness: recent memory$/m);
  assert.match(text, /^## State$/m);
  assert.match(text, /Ship RECENT\.md/);
  assert.match(text, /^## Index$/m);
  assert.match(text, /^## Entries$/m);
  assert.match(text, /^### Fixed the hook$/m);
  assert.match(text, /2026-10-21 · bugfix · personal · obs-\d+/);
  assert.match(text, /2026-10-20 · decision · decision\/gate · obs-\d+/);
  assert.match(text, /\*\*Why\*\*: reason/);
  // Newest first in the index and in the entries.
  assert.ok(text.indexOf('### Fixed the hook') < text.indexOf('### Gate lock decided'));
});

test('the same export builds the same bytes: nothing in the text depends on the time', () => {
  const data = EXPORT();
  const a = buildRecent(data).files;
  const later = { ...data, exported_at: '2027-01-01T00:00:00Z' };
  const b = buildRecent(later).files;
  assert.deepEqual([...a.entries()], [...b.entries()]);
});

test('every entry is printed in full, and the index gives the line of its heading', () => {
  const long = Array.from({ length: 400 }, (_, i) => `line ${i} of a long feature document`).join('\n');
  const data = { observations: [obs({ project: 'p', content: long, updated_at: day(2) }), obs({ project: 'p', title: 'Short one', updated_at: day(1) })], relations: [] };
  const { files, projects } = buildRecent(data);
  const lines = files.get('recent/p.md').split('\n');
  assert.ok(lines.includes('line 399 of a long feature document'));
  const indexLines = lines.filter((l) => / \(line \d+\)$/.test(l));
  assert.equal(indexLines.length, 2);
  for (const indexLine of indexLines) {
    const [, title, at] = /^\d+\. \S+ \S+: (.*) \(line (\d+)\)$/.exec(indexLine);
    assert.equal(lines[Number(at) - 1], `### ${title}`);
  }
  // The head is everything before the entries.
  const [p] = projects;
  assert.equal(lines[p.head], '## Entries');
});

test('a superseded target stays when Engram revised it after the relation', () => {
  const revised = obs({ updated_at: day(9), topic_key: 'odd/x/tasks' });
  const newer = obs({ updated_at: day(5) });
  const relations = [{ source_id: newer.sync_id, target_id: revised.sync_id, relation: 'supersedes', judgment_status: 'judged', updated_at: day(6) }];
  assert.equal(selectRecent({ observations: [revised, newer], relations, project: 'proj' }).entries.length, 2);
  const after = [{ ...relations[0], updated_at: day(10) }];
  assert.deepEqual(selectRecent({ observations: [revised, newer], relations: after, project: 'proj' }).entries.map((e) => e.sync_id), [newer.sync_id]);
});

test('an entry with a pending conflict is marked contested, and the head counts them', () => {
  const a = obs({ project: 'p', updated_at: day(3) });
  const b = obs({ project: 'p', updated_at: day(2) });
  const relations = [{ source_id: a.sync_id, target_id: b.sync_id, relation: 'pending', judgment_status: 'pending' }];
  const text = buildRecent({ observations: [a, b], relations }).files.get('recent/p.md');
  assert.match(text, new RegExp(`contested by ${b.sync_id} · ${a.sync_id}`));
  assert.match(text, new RegExp(`contested by ${a.sync_id} · ${b.sync_id}`));
  assert.match(text, /\(2 here\)/);
});

test('the manifest line of a project holds its baseline count and the directories its sessions ran in', () => {
  const data = {
    observations: [obs({ project: 'p', session_id: 's1' }), obs({ project: 'p', type: 'passive' }), obs({ project: 'q' })],
    sessions: [{ id: 's1', project: 'p', directory: 'D:/p' }, { id: 's2', project: 'p', directory: 'D:/p' }, { id: 's3', project: 'p', directory: 'D:/p/.claude/worktrees/x' }, { id: 's4', project: 'q' }],
    relations: [],
  };
  const [p, q] = buildRecent(data).projects;
  assert.deepEqual({ ...p, head: 0 }, { project: 'p', file: 'recent/p.md', entries: 1, head: 0, observations: 2, directories: ['D:/p', 'D:/p/.claude/worktrees/x'] });
  assert.deepEqual(q.directories, []);
});

test('file names are safe, lower case, never a Windows reserved name, and never shared', () => {
  const files = recentFiles(['js-harness', 'Client App/../x', 'CON', 'My-App', 'my app']);
  assert.equal(files.get('js-harness'), 'recent/js-harness.md');
  assert.equal(files.get('Client App/../x'), 'recent/client-app----x.md');
  assert.equal(files.get('CON'), 'recent/con-project.md');
  assert.match(files.get('My-App'), /^recent\/my-app-[0-9a-f]{8}\.md$/);
  assert.match(files.get('my app'), /^recent\/my-app-[0-9a-f]{8}\.md$/);
  assert.notEqual(files.get('My-App'), files.get('my app'));
});

test('compareRecent: equal files, a changed or missing one of this format, and one of another format', () => {
  const data = EXPORT();
  const { files } = buildRecent(data);
  assert.equal(formatOf(files.get('recent/js-harness.md')), RECENT_FORMAT);
  assert.deepEqual(compareRecent(data, (f) => files.get(f) ?? null), { same: 3, differ: [], otherFormat: [] });
  const edited = (f) => (f === 'recent/js-harness.md' ? `${files.get(f)}hand edit\n` : f === 'RECENT.md' ? null : files.get(f));
  assert.deepEqual(compareRecent(data, edited), { same: 1, differ: ['RECENT.md', 'recent/js-harness.md'], otherFormat: [] });
  const older = (f) => files.get(f).replace(`format: ${RECENT_FORMAT}`, 'format: 0');
  assert.deepEqual(compareRecent(data, older).otherFormat.length, 3);
});
