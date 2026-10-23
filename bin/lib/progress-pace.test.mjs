import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSteps, dayKey, PACE_DAYS, paceLines, paceLogArgs, paceOf, paceRef, parsePaceLog, stepsOf, windowStart } from './progress-pace.mjs';

const step = (text, done = false) => ({ text, done });

// --- matching the steps of one file ---

test('a task open before and checked now is closed, and one checked before and open now is reopened', () => {
  assert.deepEqual(compareSteps([step('T1 a'), step('T2 b', true)], [step('T1 a', true), step('T2 b')]), { closed: 1, reopened: 1, added: 0, removed: 0 });
});

test('a task is matched by its leading ID, with or without bold, so one reworded as it is checked is closed', () => {
  assert.deepEqual(compareSteps([step('T3 · the first words')], [step('T3 · other words, done', true)]), { closed: 1, reopened: 0, added: 0, removed: 0 });
  assert.deepEqual(compareSteps([step('**T5b** the plan')], [step('**T5b** the plan, reworded', true)]), { closed: 1, reopened: 0, added: 0, removed: 0 });
  // A table row's text starts with its ID cell.
  assert.deepEqual(compareSteps([step('T2 | build | pending')], [step('T2 | build it | done', true)]), { closed: 1, reopened: 0, added: 0, removed: 0 });
});

// The ID grammar of the session board and of contract (`taskId`, bin/lib/sessions.mjs): `C3` is an ID, as `T3` is.
test('a task whose ID is a letter prefix other than T, as the board reads it, is matched by that ID (C-d-19)', () => {
  assert.deepEqual(compareSteps([step('C3 a')], [step('C3 a, reworded', true)]), { closed: 1, reopened: 0, added: 0, removed: 0 });
});

test('a task without an ID is matched by its exact text: reworded, it is removed and added', () => {
  assert.deepEqual(compareSteps([step('write the docs')], [step('write the docs', true)]), { closed: 1, reopened: 0, added: 0, removed: 0 });
  assert.deepEqual(compareSteps([step('write the docs')], [step('write the help', true)]), { closed: 1, reopened: 0, added: 1, removed: 1 });
});

test('a new task already checked is added and closed, and a task that is gone is removed', () => {
  assert.deepEqual(compareSteps([], [step('T1 a', true), step('T2 b')]), { closed: 1, reopened: 0, added: 2, removed: 0 });
  assert.deepEqual(compareSteps([step('T1 a', true), step('T2 b')], []), { closed: 0, reopened: 0, added: 0, removed: 2 });
  // Two tasks of one ID are matched in order.
  assert.deepEqual(compareSteps([step('T1 a'), step('T1 b')], [step('T1 a', true), step('T1 b')]), { closed: 1, reopened: 0, added: 0, removed: 0 });
});

test('the steps of a file are those progress counts: the roadmap\'s checklist alone, and every step of a feature document', () => {
  const roadmap = ['# Roadmap', '- [x] not in the checklist', '## Checklist', '### One', '- [ ] a', '### Two', '- [x] b', '## After', '- [ ] not either', ''].join('\n');
  assert.deepEqual(stepsOf('docs/ROADMAP.md', roadmap), [step('a'), step('b', true)]);
  const feature = ['# F', '## Tasks', '- [x] T1 a', '', '| ID | Status |', '|---|---|', '| T2 | pending |', ''].join('\n');
  assert.deepEqual(stepsOf('odd/tasks/f.md', feature), [step('T1 a', true), step('T2 | pending')]);
  assert.deepEqual(stepsOf('odd/tasks/f.md', null), []);
});

// --- reading git's log ---

const MARK = '\u0001';

test('the log is read as commits, each with the content of every file it changed before and after it', () => {
  const log = [
    `${MARK}bbb 2026-10-15T12:00:00-05:00 aaa`,
    '',
    'diff --git a/odd/tasks/f.md b/odd/tasks/f.md',
    'index 1111111..2222222 100644',
    '--- a/odd/tasks/f.md',
    '+++ b/odd/tasks/f.md',
    '@@ -1,3 +1,3 @@',
    ' # F',
    '-- [ ] T1 a',
    '+- [x] T1 a',
    ' ',
    'diff --git a/docs/ROADMAP.md b/docs/ROADMAP.md',
    'new file mode 100644',
    'index 0000000..3333333',
    '--- /dev/null',
    '+++ b/docs/ROADMAP.md',
    '@@ -0,0 +1 @@',
    '+# R',
    '\\ No newline at end of file',
    `${MARK}aaa 2026-10-14T12:00:00-05:00`,
    '',
    'diff --git a/odd/tasks/g h.md b/odd/tasks/g h.md',
    'deleted file mode 100644',
    'index 4444444..0000000',
    '--- a/odd/tasks/g h.md\t',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-# G',
    '',
  ].join('\n');
  assert.deepEqual(parsePaceLog(log), [
    {
      id: 'bbb',
      date: '2026-10-15T12:00:00-05:00',
      parents: ['aaa'],
      files: [
        { path: 'odd/tasks/f.md', before: '# F\n- [ ] T1 a\n', after: '# F\n- [x] T1 a\n' },
        { path: 'docs/ROADMAP.md', before: null, after: '# R' },
      ],
    },
    { id: 'aaa', date: '2026-10-14T12:00:00-05:00', parents: [], files: [{ path: 'odd/tasks/g h.md', before: '# G', after: null }] },
  ]);
});

test('a change with no content to compare, a mode alone or an empty file born or gone, is no file of the commit', () => {
  const log = [
    `${MARK}ccc ${new Date(2026, 9, 16, 12).toISOString()} bbb`,
    '',
    'diff --git a/odd/tasks/f.md b/odd/tasks/f.md',
    'old mode 100644',
    'new mode 100755',
    'diff --git a/odd/tasks/empty.md b/odd/tasks/empty.md',
    'new file mode 100644',
    'index 0000000..e69de29',
    'diff --git a/odd/tasks/gone.md b/odd/tasks/gone.md',
    'deleted file mode 100644',
    'index e69de29..0000000',
    'diff --git a/odd/tasks/g.md b/odd/tasks/g.md',
    'new file mode 100644',
    'index 0000000..5555555',
    '--- /dev/null',
    '+++ b/odd/tasks/g.md',
    '@@ -0,0 +1 @@',
    '+- [x] T1 a',
    '',
  ].join('\n');
  const commits = parsePaceLog(log);
  assert.deepEqual(commits[0].files, [{ path: 'odd/tasks/g.md', before: null, after: '- [x] T1 a' }]);
  assert.deepEqual(paceOf({ commits, now: new Date(2026, 9, 16, 15), days: 1 }).total, { closed: 1, reopened: 0, added: 1, removed: 0 });
});

test('git is asked for the first-parent line of the roadmap and the feature documents, with the full content of each change', () => {
  const args = paceLogArgs({ ref: 'refs/remotes/origin/main', since: '2026-10-03T05:00:00Z' });
  for (const flag of ['--first-parent', '--diff-merges=first-parent', '--no-renames', '-p', '-U100000', '--since=2026-10-03T05:00:00Z', '--src-prefix=a/', '--dst-prefix=b/', '--relative']) {
    assert.ok(args.includes(flag), flag);
  }
  assert.deepEqual(args.slice(0, 3), ['-c', 'core.quotePath=false', 'log']);
  assert.deepEqual(args.slice(-4), ['refs/remotes/origin/main', '--', 'docs/ROADMAP.md', ':(glob)odd/tasks/*.md']);
});

test('the branch read is origin/HEAD\'s, else main, else HEAD', () => {
  assert.deepEqual(paceRef('refs/heads/main\0\nrefs/remotes/origin/HEAD\0refs/remotes/origin/main\n'), { ref: 'refs/remotes/origin/main', name: 'origin/main' });
  assert.deepEqual(paceRef('refs/remotes/origin/HEAD\0\n'), { ref: 'refs/remotes/origin/HEAD', name: 'origin/HEAD' });
  assert.deepEqual(paceRef('refs/heads/main\0\n'), { ref: 'refs/heads/main', name: 'main' });
  assert.deepEqual(paceRef(''), { ref: 'HEAD', name: 'HEAD' });
});

// --- the pace ---

/** A local date: noon of `day` days before 2026-10-16, in this machine's time zone. */
const daysAgo = (day, hour = 12) => new Date(2026, 9, 16 - day, hour);
const NOW = daysAgo(0, 15);
const commit = (id, when, files, parents = ['p']) => ({ id, date: when.toISOString(), parents, files });
const feature = (...lines) => ['# F', ...lines, ''].join('\n');

test('the window is the last n days by this machine\'s calendar, from the midnight of its first', () => {
  assert.equal(PACE_DAYS, 14);
  assert.equal(windowStart(NOW, 3).getTime(), new Date(2026, 9, 14).getTime());
  assert.equal(dayKey(daysAgo(2)), '2026-10-14');
});

test('each day of the window counts the tasks closed, reopened, added and removed; a day with no commit is 0, and today is partial', () => {
  const commits = [
    commit('c3', daysAgo(0), [{ path: 'odd/tasks/f.md', before: feature('- [ ] T1 a', '- [ ] T2 b'), after: feature('- [x] T1 a', '- [ ] T2 b', '- [ ] T3 c') }]),
    // A merge that brings a task already checked: added and closed.
    commit('c2', daysAgo(2), [{ path: 'odd/tasks/f.md', before: feature('- [ ] T1 a'), after: feature('- [ ] T1 a', '- [x] T2 b') }], ['p', 'side']),
    // A file born in the window counts every task in it as added.
    commit('c1', daysAgo(2, 9), [{ path: 'odd/tasks/f.md', before: null, after: feature('- [ ] T1 a') }]),
    // Older than the window: not counted.
    commit('c0', daysAgo(5), [{ path: 'odd/tasks/f.md', before: null, after: feature('- [x] T9 z') }]),
  ];
  const pace = paceOf({ commits, now: NOW, days: 3 });
  assert.deepEqual(pace, {
    days: 3,
    from: '2026-10-14',
    to: '2026-10-16',
    perDay: [
      { date: '2026-10-14', closed: 1, reopened: 0, added: 2, removed: 0, partial: false },
      { date: '2026-10-15', closed: 0, reopened: 0, added: 0, removed: 0, partial: false },
      { date: '2026-10-16', closed: 1, reopened: 0, added: 1, removed: 0, partial: true },
    ],
    total: { closed: 2, reopened: 0, added: 3, removed: 0 },
    meanPerDay: { closed: 0.7, reopened: 0, added: 1, removed: 0 },
  });
});

test('a commit with no parent is the start of the history, never a day of added work', () => {
  const commits = [commit('root', daysAgo(1), [{ path: 'odd/tasks/f.md', before: null, after: feature('- [x] T1 a') }], [])];
  assert.deepEqual(paceOf({ commits, now: NOW, days: 2 }).total, { closed: 0, reopened: 0, added: 0, removed: 0 });
});

test('a moved file counts its tasks as removed from one path and added at the other', () => {
  const commits = [
    commit('move', daysAgo(0), [
      { path: 'odd/tasks/old.md', before: feature('- [x] T1 a'), after: null },
      { path: 'odd/tasks/new.md', before: null, after: feature('- [x] T1 a') },
    ]),
  ];
  assert.deepEqual(paceOf({ commits, now: NOW, days: 1 }).total, { closed: 1, reopened: 0, added: 1, removed: 1 });
});

test('the pace is said as a line a day under the branch it read, then the totals and the mean a day', () => {
  const pace = paceOf({ commits: [commit('c', daysAgo(0), [{ path: 'odd/tasks/f.md', before: feature('- [ ] T1 a'), after: feature('- [x] T1 a') }])], now: NOW, days: 2 });
  assert.deepEqual(paceLines({ ...pace, branch: 'origin/main' }), [
    'Pace of origin/main, its first-parent line, by committer day over the last 2 days:',
    '  2026-10-15  closed 0  reopened 0  added 0  removed 0',
    '  2026-10-16  closed 1  reopened 0  added 0  removed 0  (today, so far)',
    'Total       closed 1  reopened 0  added 0  removed 0',
    'A day       closed 0.5  reopened 0  added 0  removed 0',
  ]);
});
