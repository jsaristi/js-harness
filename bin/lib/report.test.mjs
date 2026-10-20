import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newNotice } from './channel.mjs';
import { cutOf, landedOf, mapOf, parseMergeLog, questionsOf, reportLines, sessionsOf } from './report.mjs';

// odd/tasks/status-report.md: the pure parts of `js-harness report`. Nothing here runs git or reads a file.

const at = (iso) => Date.parse(iso);
const NOW = at('2026-10-20T12:00:00Z');
const FROM = (title, id = 'aaaaaaaa-1111-4111-8111-111111111111') => ({ host: 'claude-code', id, source: 'environment', title });
const notice = (fields) => newNotice({ at: '2026-10-20T10:00:00.000Z', from: FROM('JH 35 · notify reads title'), to: 'orchestrator', kind: 'note', text: 'a note', ...fields });

// --- S3: the cut ---

test('the cut is --since when given, else the last recorded report, else 24 hours before now', () => {
  const reports = [{ at: '2026-10-19T08:00:00.000Z', head: 'aaa' }, { at: '2026-10-20T07:30:00.000Z', head: 'bbb' }];
  assert.deepEqual(cutOf({ since: '2026-10-18T00:00:00Z', reports, now: NOW }), { at: at('2026-10-18T00:00:00Z'), source: 'since', head: null });
  assert.deepEqual(cutOf({ reports, now: NOW }), { at: at('2026-10-20T07:30:00.000Z'), source: 'last-report', head: 'bbb' });
  assert.deepEqual(cutOf({ reports: [], now: NOW }), { at: at('2026-10-19T12:00:00Z'), source: 'window', head: null });
});

test('the last report is the latest by time, not the last line written', () => {
  const reports = [{ at: '2026-10-20T07:30:00.000Z' }, { at: '2026-10-19T08:00:00.000Z' }];
  assert.equal(cutOf({ reports, now: NOW }).at, at('2026-10-20T07:30:00.000Z'));
});

// --- S2: landed ---

test('parseMergeLog reads one merge a line: its hash, its commit time and its subject', () => {
  const text = 'abc\u001f2026-10-20T06:42:48-05:00\u001fMerge pull request #478 from fix/notify-worktree-title\n\n';
  assert.deepEqual(parseMergeLog(text), [{ hash: 'abc', at: at('2026-10-20T11:42:48Z'), subject: 'Merge pull request #478 from fix/notify-worktree-title' }]);
});

test('landedOf keeps the merges after the cut, oldest first, each pull request once with all its commits', () => {
  const merges = [
    { hash: 'c3', at: at('2026-10-20T11:00:00Z'), subject: 'Merge pull request #478 from fix/title', commits: ['docs(notify): record the recheck'] },
    { hash: 'c2', at: at('2026-10-20T10:00:00Z'), subject: 'Merge pull request #478 from fix/title', commits: ['fix(notify): read the title'] },
    { hash: 'c1', at: at('2026-10-20T09:00:00Z'), subject: 'Merge branch docs/hotfix', commits: ['docs: fix a typo'] },
    { hash: 'c0', at: at('2026-10-19T09:00:00Z'), subject: 'Merge pull request #470 from feat/old', commits: ['feat: old'] },
  ];
  assert.deepEqual(landedOf(merges, at('2026-10-19T12:00:00Z')), [
    { number: null, branch: null, subject: 'Merge branch docs/hotfix', at: at('2026-10-20T09:00:00Z'), commits: ['docs: fix a typo'] },
    { number: 478, branch: 'fix/title', subject: 'Merge pull request #478 from fix/title', at: at('2026-10-20T11:00:00Z'), commits: ['fix(notify): read the title', 'docs(notify): record the recheck'] },
  ]);
});

// --- S2: sessions ---

test('sessionsOf groups the notices after the cut by session, with the last one and the count, latest session last', () => {
  const notices = [
    notice({ at: '2026-10-19T09:00:00.000Z', kind: 'opened', text: 'before the cut' }),
    notice({ at: '2026-10-20T09:00:00.000Z', kind: 'opened', text: 'opened the fix' }),
    notice({ at: '2026-10-20T09:30:00.000Z', from: { host: 'unknown', id: null, source: null, title: null }, kind: 'waiting', text: 'on review' }),
    notice({ at: '2026-10-20T10:00:00.000Z', kind: 'closed', text: 'delivered the fix', summary: 'docs/sessions/x.md' }),
    notice({ at: '2026-10-20T09:45:00.000Z', from: FROM(null, 'bbbbbbbb-2222-4222-8222-222222222222'), kind: 'ready', text: 'PR ready', pr: 480 }),
  ];
  const sessions = sessionsOf(notices, at('2026-10-19T12:00:00Z'));
  assert.deepEqual(sessions.map((one) => [one.name, one.count, one.last.kind, one.last.text]), [
    ['unknown senders', 1, 'waiting', 'on review'],
    ['bbbbbbbb-2222-4222-8222-222222222222', 1, 'ready', 'PR ready'],
    ['JH 35 · notify reads title', 2, 'closed', 'delivered the fix'],
  ]);
});

// gentle-ai review R2-004: a title is not unique, a session id is.
test('two sessions that share a title are two lines, each by its title', () => {
  const notices = [
    notice({ at: '2026-10-20T09:00:00.000Z', from: FROM('JH 9 · reserve', 'aaaaaaaa-1111-4111-8111-111111111111'), text: 'first' }),
    notice({ at: '2026-10-20T09:30:00.000Z', from: FROM('JH 9 · reserve', 'bbbbbbbb-2222-4222-8222-222222222222'), text: 'second' }),
  ];
  assert.deepEqual(sessionsOf(notices, at('2026-10-20T00:00:00Z')).map((one) => [one.name, one.count, one.last.text]), [['JH 9 · reserve', 1, 'first'], ['JH 9 · reserve', 1, 'second']]);
});

// --- S2: questions ---

test('questionsOf gives the questions answered after the cut and every question still open, whenever asked', () => {
  const ask = (id, text, when) => notice({ at: when, kind: 'question', id, text, options: [], waits: 'the slice' });
  const asked = [ask('q-1', 'old and open', '2026-10-10T00:00:00.000Z'), ask('q-2', 'answered today', '2026-10-20T08:00:00.000Z'), ask('q-3', 'answered before', '2026-10-18T08:00:00.000Z')];
  const answers = [
    notice({ at: '2026-10-20T09:00:00.000Z', kind: 'answer', text: 'B, the small one', transcript: 't', line: 4, question: 2, verified: false, copy: null }),
    notice({ at: '2026-10-18T09:00:00.000Z', kind: 'answer', text: 'A', transcript: 't', line: 2, question: 3, verified: false, copy: null }),
  ];
  const record = { notices: [...asked, ...answers], questions: asked.map((one, index) => ({ number: index + 1, notice: one })) };
  const { answered, open } = questionsOf(record, at('2026-10-19T12:00:00Z'));
  assert.deepEqual(answered.map((one) => [one.number, one.notice.text, one.answer]), [[2, 'answered today', 'B, the small one']]);
  assert.deepEqual(open.map((one) => [one.number, one.notice.text]), [[1, 'old and open']]);
});

test('an answer that copied his words gives those words', () => {
  const asked = notice({ kind: 'question', id: 'q-1', text: 'Which?', options: [], waits: 'w' });
  const copy = { tool: 'AskUserQuestion', answers: [{ question: 'Which?', options: ['A', 'B'], answer: 'B', how: 'option' }] };
  const answer = notice({ at: '2026-10-20T11:00:00.000Z', kind: 'answer', text: 'the lead said B', transcript: 't', line: 4, question: 1, verified: true, copy });
  const { answered } = questionsOf({ notices: [asked, answer], questions: [{ number: 1, notice: asked }] }, at('2026-10-20T00:00:00Z'));
  assert.equal(answered[0].answer, 'B');
});

// Codex review of ddd4058..0bf3ea7, part 1: an answer no transcript confirmed is the sender's claim, not his word.
test('an answer no transcript confirmed is printed as the sender\'s claim', () => {
  const asked = notice({ kind: 'question', id: 'q-1', text: 'Which?', options: [], waits: 'w' });
  const claim = notice({ at: '2026-10-20T11:00:00.000Z', kind: 'answer', text: 'B', transcript: 't', line: 4, question: 1, verified: false, copy: null });
  const questions = questionsOf({ notices: [asked, claim], questions: [{ number: 1, notice: asked }] }, at('2026-10-20T00:00:00Z'));
  assert.equal(questions.answered[0].verified, false);
  const lines = reportLines({ cut: { at: at('2026-10-20T00:00:00Z'), source: 'since' }, branch: 'main', landed: [], sessions: [], questions, map: { absent: true } });
  assert.ok(lines.includes('      answer, not verified (the sender\'s claim): B'), lines.join('\n'));
});

// --- S2: the map ---

test('mapOf counts each phase of the roadmap and keeps the open steps', () => {
  const markdown = '# R\n\n## Checklist\n\n### One\n- [x] a\n- [ ] b\n\n### Two\n- [x] c\n';
  const map = mapOf(markdown);
  assert.equal(map.done, 2);
  assert.equal(map.total, 3);
  assert.deepEqual(map.phases.map((phase) => [phase.title, phase.done, phase.total, phase.open]), [['One', 1, 2, ['b']], ['Two', 1, 1, []]]);
});

// --- the text ---

test('reportLines prints the cut, then Landed, Sessions, Questions and Map, each in plain lines', () => {
  const lines = reportLines({
    cut: { at: at('2026-10-20T07:30:00Z'), source: 'last-report' },
    branch: 'origin/main',
    landed: [{ number: 478, branch: 'fix/title', subject: 'Merge pull request #478 from fix/title', at: at('2026-10-20T11:00:00Z'), commits: ['fix(notify): read the title'] }],
    sessions: [{ name: 'JH 35 · notify reads title', count: 2, last: { kind: 'closed', at: '2026-10-20T10:00:00.000Z', text: 'delivered the fix' } }],
    questions: {
      answered: [{ number: 2, notice: { text: 'Which?' }, answer: 'B', at: at('2026-10-20T09:00:00Z') }],
      open: [{ number: 1, notice: { text: 'Old?', at: '2026-10-10T00:00:00.000Z', waits: 'the slice' } }],
    },
    map: { path: 'docs/ROADMAP.md', done: 2, total: 3, phases: [{ title: 'One', done: 1, total: 2, open: ['b'] }, { title: 'Two', done: 1, total: 1, open: [] }] },
  });
  assert.deepEqual(lines, [
    'Since 2026-10-20 07:30Z, the last report',
    '',
    'Landed on origin/main: 1 pull request',
    '  #478 fix/title  merged 2026-10-20 11:00Z',
    '      - fix(notify): read the title',
    '',
    'Sessions: 1 wrote notices',
    '  JH 35 · notify reads title  closed 2026-10-20 10:00Z  (2 notices)',
    '      delivered the fix',
    '',
    'Questions: 1 answered, 1 open',
    '  answered #2 at 2026-10-20 09:00Z: Which?',
    '      answer: B',
    '  open #1 since 2026-10-10 00:00Z: Old?',
    '      waits: the slice',
    '',
    'Map: docs/ROADMAP.md on origin/main  2/3  67%',
    '  [ ] One  1/2  50%',
    '      - b',
    '  [x] Two  1/1  100%',
  ]);
});

test('a question or an answer written on several lines is printed on one, its lines joined by a slash', () => {
  const lines = reportLines({
    cut: { at: at('2026-10-20T07:30:00Z'), source: 'last-report' },
    branch: 'main',
    landed: [],
    sessions: [],
    questions: { answered: [{ number: 2, notice: { text: 'Which\nprofiles?' }, answer: 'all of them\n\nand TUI  ', at: at('2026-10-20T09:00:00Z') }], open: [] },
    map: { absent: true },
  });
  assert.ok(lines.includes('  answered #2 at 2026-10-20 09:00Z: Which / profiles?'), lines.join('\n'));
  assert.ok(lines.includes('      answer: all of them / and TUI'), lines.join('\n'));
});

test('reportLines says the source of the cut, and a section with nothing or an error says so in its place', () => {
  const lines = reportLines({
    cut: { at: at('2026-10-19T12:00:00Z'), source: 'window' },
    branch: 'main',
    landed: { error: 'git log: not a git repository' },
    sessions: [],
    questions: { answered: [], open: [] },
    map: { absent: true },
  });
  assert.deepEqual(lines, [
    'Since 2026-10-19 12:00Z, the last 24 hours: no report is recorded',
    '',
    'Landed on main: could not read: git log: not a git repository',
    '',
    'Sessions: no notice since the cut',
    '',
    'Questions: none answered since the cut, none open',
    '',
    'Map: no docs/ROADMAP.md on main',
  ]);
  assert.equal(reportLines({ cut: { at: at('2026-10-19T12:00:00Z'), source: 'since' }, branch: 'main', landed: [], sessions: { error: 'the record: EACCES' }, questions: { error: 'the record: EACCES' }, map: { error: 'git show: bad' } })[0], 'Since 2026-10-19 12:00Z, as --since asked');
});
