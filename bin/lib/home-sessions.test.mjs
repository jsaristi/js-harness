import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeInForce, offHomeLines, sessionsOffHome } from './home-sessions.mjs';

// odd/tasks/one-model-home.md, spec 6: every session off the home, what each source gives, and the act that corrects it.
const HOME = { model: 'claude-fable-5-2', effort: 'medium', lead: 'high' };
const isLead = (title) => String(title).startsWith('JH ORQ');
const on = { model: 'claude-fable-5-2', effort: 'medium' };

test('a home is in force when it holds a model, a level or a lead\'s level', () => {
  assert.equal(homeInForce(HOME), true);
  assert.equal(homeInForce({ model: null, effort: null, lead: 'high' }), true);
  assert.equal(homeInForce({ model: null, effort: null, lead: null, advisor: 'claude-fable-5-2' }), true);
  for (const none of [null, undefined, 'claude-fable-5-2', { model: null, effort: null, lead: null }, {}]) assert.equal(homeInForce(none), false, JSON.stringify(none));
});

test('a desktop session is judged by what its app record holds: his menu corrects a lead, the lead\'s session tools any other', () => {
  const desktop = [
    { id: 'a', title: 'JH 7 · on it', ...on, archived: false },
    { id: 'b', title: 'JH 8 · higher', ...on, effort: 'high', archived: false },
    { id: 'c', title: 'JH ORQ · lead', ...on, effort: 'high', archived: false },
    { id: 'd', title: 'JH ORQ · old lead', model: 'claude-opus-5-5', effort: 'xhigh', archived: false },
    { id: 'e', title: null, model: null, effort: null, archived: false },
  ];
  const result = sessionsOffHome(HOME, { desktop, isLead });
  assert.deepEqual(result.rows, [
    { kind: 'desktop', id: 'b', title: 'JH 8 · higher', holds: { ...on, effort: 'high' }, held: on, off: { model: null, effort: 'high' }, corrects: 'the lead\'s session tools' },
    { kind: 'desktop', id: 'd', title: 'JH ORQ · old lead', holds: { model: 'claude-opus-5-5', effort: 'xhigh' }, held: { ...on, effort: 'high' }, off: { model: 'claude-opus-5-5', effort: 'xhigh' }, corrects: 'his menu' },
  ]);
  assert.deepEqual(result.on, { desktop: 3, background: 0 }, 'a record that says neither is off nothing');
  assert.deepEqual(result.archived, []);
});

test('an archived desktop session is in no row: the archived ones off the home are counted by what they hold, the most first', () => {
  const archived = (model, effort) => ({ id: 'x', title: 'JH 1 · old', model, effort, archived: true });
  const result = sessionsOffHome(HOME, { desktop: [archived('claude-opus-5-5', 'high'), archived('claude-opus-5-5', 'max'), archived('claude-opus-5-5', 'high'), archived(on.model, on.effort)], isLead });
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.archived, [{ holds: 'claude-opus-5-5 at high', count: 2 }, { holds: 'claude-opus-5-5 at max', count: 1 }]);
  assert.deepEqual(result.on, { desktop: 0, background: 0 }, 'an archived session on the home is not counted as open');
});

test('a background session is judged by its last reply, by what its start asked where no reply was read, and a resume corrects it unless its job was removed', () => {
  const job = (id, more) => ({ id, title: `JH ${id} · job`, asked: { model: null, effort: null }, replied: null, state: 'idle', working: false, removed: false, ...more });
  const background = [
    job('1', { asked: on, replied: on }),
    job('2', { asked: on, replied: { ...on, effort: 'high' } }),
    job('3', { asked: { model: 'claude-opus-5-5', effort: 'medium' }, replied: on }),
    job('4', { asked: { model: null, effort: 'high' } }),
    job('5', {}),
    job('6', { replied: { model: 'claude-opus-5-5', effort: 'medium' }, state: null, removed: true }),
    job('7', { replied: on, removed: true }),
    job('8', { replied: { ...on, effort: 'high' }, state: 'busy', working: true }),
    job('9', { replied: { ...on, effort: 'high' }, state: null, working: null }),
  ];
  const result = sessionsOffHome(HOME, { background, isLead });
  assert.deepEqual(result.rows.map((row) => [row.id, row.off, row.corrects]), [
    ['2', { model: null, effort: 'high' }, 'a resume, js-harness sessions start --resume 2'],
    ['4', { model: null, effort: 'high' }, 'a resume, js-harness sessions start --resume 4'],
    // Codex on e878d8b..533f8a6: `sessions start --resume` refuses a conversation a job works, so the act says when.
    ['8', { model: null, effort: 'high' }, 'a resume once its job is no longer at work, which a resume refuses until then: js-harness sessions start --resume 8'],
    ['9', { model: null, effort: 'high' }, 'a resume, js-harness sessions start --resume 9'],
  ]);
  assert.equal(result.removedOff, 1, 'a removed job off the home is counted, and is no row: nothing corrects a job that is gone');
  assert.deepEqual(result.rows[0], { kind: 'background', id: '2', title: 'JH 2 · job', asked: on, replied: { ...on, effort: 'high' }, state: 'idle', held: on, off: { model: null, effort: 'high' }, corrects: 'a resume, js-harness sessions start --resume 2' });
  assert.deepEqual(result.on, { desktop: 0, background: 3 }, 'a start that asked another model and now replies on the home is on it; a removed job is not counted');
});

test('the block says of each session what its source gives, what it is held to and what corrects it, then the archived ones, those on the home and what was not read', () => {
  const result = sessionsOffHome(HOME, {
    desktop: [
      { id: 'a', title: 'JH ORQ · lead', ...on, effort: 'xhigh', archived: false },
      { id: 'b', title: 'JH 1 · old', model: 'claude-opus-5-5', effort: 'high', archived: true },
      { id: 'c', title: 'JH 2 · on it', ...on, archived: false },
    ],
    background: [
      { id: 'j1', title: 'JH 3 · job', asked: { model: null, effort: null }, replied: { ...on, effort: 'high' }, state: 'busy', working: true, removed: false },
      { id: 'j2', title: 'JH 4 · gone', asked: { ...on, effort: 'high' }, replied: null, state: null, removed: true },
      { id: 'j3', title: null, asked: { model: 'claude-opus-5-5', effort: null }, replied: null, state: null, removed: false },
    ],
    isLead,
  });
  assert.deepEqual(offHomeLines(result, HOME, { unread: ['the state of the background jobs (claude is not on PATH)'] }), [
    '',
    'Sessions off the home: a session is held to claude-fable-5-2 at medium, and the lead to high',
    '  desktop  "JH ORQ · lead"  its menu holds claude-fable-5-2 at xhigh; held to claude-fable-5-2 at high; corrected by his menu',
    '  background  "JH 3 · job" (j1)  its last reply ran on claude-fable-5-2 at high; its start named no model and no level; its job: busy; held to claude-fable-5-2 at medium; corrected by a resume once its job is no longer at work, which a resume refuses until then: js-harness sessions start --resume j1',
    '  background  "(no title)" (j3)  no reply of it was read; its start asked for claude-opus-5-5 at no level; its job: not read; held to claude-fable-5-2 at medium; corrected by a resume, js-harness sessions start --resume j3',
    '  1 archived desktop session is off it too (1 at claude-opus-5-5 at high): nothing corrects one while it is archived; he can unarchive it, and it is then listed',
    '  1 background job the harness removed ran off it too: nothing corrects a job that is gone',
    '  on the home: 1 desktop, not archived, and 0 background',
    '  not read: the state of the background jobs (claude is not on PATH)',
    '  The app\'s record does not say whether a session that is not archived is running. Nothing was written.',
  ]);
  const none = offHomeLines(sessionsOffHome({ model: 'claude-fable-5-2', effort: null, lead: null }, {}), { model: 'claude-fable-5-2', effort: null, lead: null });
  assert.deepEqual(none.slice(1, 4), ['Sessions off the home: a session is held to claude-fable-5-2 at no level', '  none that is open or runs', '  on the home: 0 desktop, not archived, and 0 background']);
});

// odd/tasks/advisor-home.md, spec 6: a background session's advisor, judged from the advisorModel of its last reply.
const ADVISED = { ...HOME, model: 'claude-opus-5-5', advisor: 'claude-fable-5-2' };
const opus = { model: 'claude-opus-5-5', effort: 'medium' };
const job = (id, replied, more = {}) => ({ id, title: `JH ${id} · job`, asked: { model: null, effort: null }, replied, state: 'idle', working: false, removed: false, ...more });

test('where the home declares an advisor, a background session is on it only when its last reply names that advisor, not its own model', () => {
  const background = [
    job('1', { ...opus, advisor: 'claude-fable-5-2' }),
    job('2', { ...opus, advisor: 'claude-fable-5-2[1m]' }),
    // The host repeats the session's own model where no advisor was asked.
    job('3', { ...opus, advisor: 'claude-opus-5-5' }),
    job('4', { ...opus, advisor: 'claude-fable-5-1' }),
    // Not known: no advisorModel on the reply, no reply read, or a reply on the home's advisor itself.
    job('5', opus),
    job('6', null),
    job('7', { model: 'claude-fable-5-2', effort: 'medium', advisor: 'claude-fable-5-2' }),
    job('8', { ...opus, advisor: 'claude-opus-5-5' }, { removed: true, state: null }),
  ];
  const result = sessionsOffHome(ADVISED, { background, isLead });
  assert.deepEqual(result.rows.map((row) => [row.id, row.off]), [
    ['3', { model: null, effort: null, advisor: 'none' }],
    ['4', { model: null, effort: null, advisor: 'claude-fable-5-1' }],
    ['7', { model: 'claude-fable-5-2', effort: null, advisor: null }],
  ]);
  assert.deepEqual(result.rows[0].held, { ...opus, advisor: 'claude-fable-5-2' });
  assert.equal(result.rows[0].corrects, 'a resume, js-harness sessions start --resume 3');
  assert.deepEqual(result.on, { desktop: 0, background: 2 });
  assert.equal(result.removedOff, 1);
  assert.deepEqual(result.unknownAdvisor, [
    { id: '5', title: 'JH 5 · job', why: 'its last reply holds no advisorModel' },
    { id: '6', title: 'JH 6 · job', why: 'no reply of it was read' },
  ], 'a session whose advisor is not known is named, never counted on the home; one off the home already is its row');
  // A home with no advisor judges none, and adds nothing to a row.
  const plain = sessionsOffHome(HOME, { background: [job('3', { ...on, advisor: 'claude-opus-5-5' })], isLead });
  assert.deepEqual([plain.rows, plain.unknownAdvisor, plain.on.background], [[], [], 1]);
});

test('the block says the advisor a session is held to, what its last reply named, and each session whose advisor was not read', () => {
  const result = sessionsOffHome(ADVISED, {
    background: [job('j1', { ...opus, advisor: 'claude-opus-5-5' }), job('j2', opus), job('j3', { ...opus, effort: 'high' })],
    isLead,
  });
  const lines = offHomeLines(result, ADVISED);
  assert.equal(lines[1], 'Sessions off the home: a session is held to claude-opus-5-5 at medium, and the lead to high; a background session to the advisor claude-fable-5-2');
  assert.equal(lines[2], '  background  "JH j1 · job" (j1)  its last reply ran on claude-opus-5-5 at medium with no advisor; its start named no model and no level; its job: idle; held to claude-opus-5-5 at medium with the advisor claude-fable-5-2; corrected by a resume, js-harness sessions start --resume j1');
  assert.equal(lines[3], '  background  "JH j3 · job" (j3)  its last reply ran on claude-opus-5-5 at high with an advisor not known (its last reply holds no advisorModel); its start named no model and no level; its job: idle; held to claude-opus-5-5 at medium with the advisor claude-fable-5-2; corrected by a resume, js-harness sessions start --resume j3');
  assert.ok(lines.includes('  not read: the advisor of "JH j2 · job" (j2): its last reply holds no advisorModel, so it is not counted on the home'), lines.join('\n'));
  assert.ok(lines.includes('  on the home: 0 desktop, not archived, and 0 background'), lines.join('\n'));
  // odd/tasks/lead-effort-split.md: the reviewers' level is said apart from the lead's where the home declares it.
  assert.equal(offHomeLines(result, { ...ADVISED, lead: 'xhigh', lenses: 'high' })[1], 'Sessions off the home: a session is held to claude-opus-5-5 at medium, the lead to xhigh, and the lenses and the double review\'s Claude reader to high; a background session to the advisor claude-fable-5-2');
});
