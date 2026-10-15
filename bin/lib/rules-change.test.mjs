import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedList, RuleChangeError, sourceOf } from './rules-change.mjs';

const TODAY = '2026-10-16';

// A small list of the four shapes a declaration takes: a number, a string, a text and a retired rule.
const LIST = [
  { id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes', flag: '--wait', was: [{ value: 45, until: '2026-10-11' }] },
  { id: 'old-bound', subject: 'an old bound', owner: 'project', since: '2026-10-01', retired: '2026-10-10', successors: [], unit: 'minutes', was: [{ value: 5, until: '2026-10-10' }] },
  { id: 'review-model', subject: 'the model of a review', owner: 'sebastian', since: '2026-10-12', value: 'gpt-fixture', alias: 'model' },
  { id: 'who-decides', subject: 'what is his to decide', owner: 'sebastian', since: '2026-10-11', path: 'AGENTS.md', phrases: ['He decides spend, anything irreversible'] },
];

const ruleOf = (list, id) => list.find((rule) => rule.id === id);
const refusal = (fn, pattern) => assert.throws(fn, (err) => err instanceof RuleChangeError && pattern.test(err.message));

test('a new value moves the one in force into was, newest first, and since becomes today', () => {
  const { list, what } = changedList(LIST, 'gate-wait', { value: 30 }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'gate-wait'), {
    id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: TODAY, value: 30, unit: 'minutes', flag: '--wait',
    was: [{ value: 60, until: TODAY }, { value: 45, until: '2026-10-11' }],
  });
  assert.equal(what, '60 minutes to 30 minutes');
});

test('a string value changes the same way, with no unit', () => {
  const { list, what } = changedList(LIST, 'review-model', { value: 'gpt-other' }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'review-model'), {
    id: 'review-model', subject: 'the model of a review', owner: 'sebastian', since: TODAY, value: 'gpt-other', alias: 'model',
    was: [{ value: 'gpt-fixture', until: TODAY }],
  });
  assert.equal(what, 'gpt-fixture to gpt-other');
});

test('a value equal to the one in force is refused', () => {
  refusal(() => changedList(LIST, 'gate-wait', { value: 60 }, { today: TODAY }), /already 60 minutes/);
});

test('a change of unit is refused: a new unit is a new id', () => {
  refusal(() => changedList(LIST, 'gate-wait', { value: 1, unit: 'hours' }, { today: TODAY }), /unit .*minutes.*new id/);
});

test('a rule in prose that takes a value keeps its id, with no earlier values', () => {
  const { list } = changedList(LIST, 'who-decides', { value: 3, unit: 'decisions' }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'who-decides'), {
    id: 'who-decides', subject: 'what is his to decide', owner: 'sebastian', since: TODAY, value: 3, unit: 'decisions',
  });
});

test('a number given to a rule in prose needs its unit', () => {
  refusal(() => changedList(LIST, 'who-decides', { value: 3 }, { today: TODAY }), /unit/);
});

test('a rule with a value does not become prose: that is a retirement and a new id', () => {
  refusal(() => changedList(LIST, 'gate-wait', { path: 'docs/X.md', phrases: ['a phrase long enough'] }, { today: TODAY }), /retire/);
});

test('a new text replaces the path and the phrases, and since becomes today', () => {
  const { list, what } = changedList(LIST, 'who-decides', { path: 'docs/PROTOCOLS.md', phrases: ['He decides spend and product choices'] }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'who-decides'), {
    id: 'who-decides', subject: 'what is his to decide', owner: 'sebastian', since: TODAY, path: 'docs/PROTOCOLS.md', phrases: ['He decides spend and product choices'],
  });
  assert.equal(what, 'text of docs/PROTOCOLS.md');
});

test('a retirement of a value keeps its last value in was, drops the flag and the alias, and keeps a unit for numbers', () => {
  const { list, what } = changedList(LIST, 'gate-wait', { retire: { successors: ['review-model'] } }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'gate-wait'), {
    id: 'gate-wait', subject: 'the wait for a turn of the gate lock', owner: 'project', since: '2026-10-11', unit: 'minutes',
    was: [{ value: 60, until: TODAY }, { value: 45, until: '2026-10-11' }], retired: TODAY, successors: ['review-model'],
  });
  assert.equal(what, 'retired, successors review-model');
  const model = changedList(LIST, 'review-model', { retire: { successors: [] } }, { today: TODAY });
  assert.deepEqual(ruleOf(model.list, 'review-model'), {
    id: 'review-model', subject: 'the model of a review', owner: 'sebastian', since: '2026-10-12',
    was: [{ value: 'gpt-fixture', until: TODAY }], retired: TODAY, successors: [],
  });
  assert.equal(model.what, 'retired, successors none');
});

test('a retirement of a text drops its path and phrases', () => {
  const { list } = changedList(LIST, 'who-decides', { retire: { successors: [] } }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'who-decides'), {
    id: 'who-decides', subject: 'what is his to decide', owner: 'sebastian', since: '2026-10-11', retired: TODAY, successors: [],
  });
});

test('a change of form moves neither since nor was, and null removes a key', () => {
  const { list, what } = changedList(LIST, 'gate-wait', { set: { subject: 'the wait for the gate lock', flag: null } }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'gate-wait'), {
    id: 'gate-wait', subject: 'the wait for the gate lock', owner: 'project', since: '2026-10-11', value: 60, unit: 'minutes',
    was: [{ value: 45, until: '2026-10-11' }],
  });
  assert.equal(what, 'form');
});

test('set refuses the keys a change manages, the keys of a later letter, and a project key', () => {
  refusal(() => changedList(LIST, 'gate-wait', { set: { since: TODAY } }, { today: TODAY }), /"since" is not set/);
  refusal(() => changedList(LIST, 'gate-wait', { set: { row: { refuses: TODAY } } }, { today: TODAY }), /"row" .*T16d/);
  refusal(() => changedList(LIST, 'gate-wait', { set: { sensor: 'x' } }, { today: TODAY }), /"sensor" .*project/);
});

test('a new rule enters with since today and the keys set gives it', () => {
  const { list, what } = changedList(LIST, 'new-bound', { value: 12, unit: 'lines', set: { subject: 'a new bound', owner: 'project' } }, { today: TODAY });
  assert.deepEqual(ruleOf(list, 'new-bound'), { id: 'new-bound', subject: 'a new bound', owner: 'project', since: TODAY, value: 12, unit: 'lines' });
  assert.deepEqual(list.map((rule) => rule.id), ['gate-wait', 'new-bound', 'old-bound', 'review-model', 'who-decides']);
  assert.equal(what, 'new');
});

test('an unknown id with no subject or owner is refused, and so is a new rule with no body', () => {
  refusal(() => changedList(LIST, 'no-such', { value: 1, unit: 'lines' }, { today: TODAY }), /no rule "no-such".*subject and owner/);
  refusal(() => changedList(LIST, 'no-such', { set: { subject: 'x', owner: 'project' } }, { today: TODAY }), /new rule .*body/);
});

test('a retired rule is not changed, and its id is never reused', () => {
  refusal(() => changedList(LIST, 'old-bound', { value: 6 }, { today: TODAY }), /"old-bound" is retired since 2026-10-10/);
  refusal(() => changedList(LIST, 'old-bound', { value: 6, unit: 'minutes', set: { subject: 'x', owner: 'project' } }, { today: TODAY }), /retired .*never reused/);
});

test('a change that names nothing, or more than one body, is refused', () => {
  refusal(() => changedList(LIST, 'gate-wait', {}, { today: TODAY }), /names nothing/);
  refusal(() => changedList(LIST, 'gate-wait', { value: 1, retire: { successors: [] } }, { today: TODAY }), /one body/);
});

test('the list given is not changed', () => {
  const before = JSON.stringify(LIST);
  changedList(LIST, 'gate-wait', { value: 30 }, { today: TODAY });
  changedList(LIST, 'gate-wait', { retire: { successors: [] } }, { today: TODAY });
  assert.equal(JSON.stringify(LIST), before);
});

test('a revert is a new value that is in was, and gives back the value in force', () => {
  const first = changedList(LIST, 'gate-wait', { value: 30 }, { today: TODAY });
  const back = changedList(first.list, 'gate-wait', { value: 60 }, { today: TODAY });
  assert.equal(ruleOf(back.list, 'gate-wait').value, 60);
  assert.deepEqual(ruleOf(back.list, 'gate-wait').was[0], { value: 30, until: TODAY });
});

// The list a change gives is one readRules reads with no fault, on the real list: a new value, a retirement of a rule
// with an alias, a change of form, and a new rule.
test('on the real list, each kind of change gives a list readRules reads with no fault', async () => {
  const { RULES } = await import('./rules-data.mjs');
  const { readRules } = await import('./rules.mjs');
  const withAlias = RULES.find((rule) => rule.alias !== undefined && !Object.hasOwn(rule, 'retired'));
  const withUnit = RULES.find((rule) => typeof rule.value === 'number' && rule.flag !== undefined);
  const changes = [
    [withUnit.id, { value: withUnit.value + 1 }],
    [withAlias.id, { retire: { successors: [] } }],
    [withUnit.id, { set: { review: TODAY } }],
    ['zz-new-bound', { value: 3, unit: 'lines', set: { subject: 'a bound made in a test', owner: 'project' } }],
  ];
  for (const [id, change] of changes) {
    const { list } = changedList(RULES, id, change, { today: TODAY });
    assert.deepEqual(readRules(list, { declared: list }), [], `${id} ${JSON.stringify(change)}`);
  }
});

// ---- the source of a change ---------------------------------------------------------------------------

const AT = '2026-10-15T17:00:00.000Z'; // midday in Colombia and in UTC alike, so the local day is the same day
const said = (content) => JSON.stringify({ type: 'user', origin: { kind: 'human' }, timestamp: AT, message: { role: 'user', content } });
const PASTE = '<pasted_content id="p1">a text he pasted, written by a session</pasted_content id="p1">';
const TRANSCRIPT = [
  said('Sí, la espera del gate queda en treinta minutos'),
  JSON.stringify({ type: 'assistant', timestamp: AT, message: { role: 'assistant', content: [{ type: 'text', text: 'the session speaks' }] } }),
  said(PASTE),
  said(`${PASTE}\nY esto lo escribí yo, treinta minutos`),
  JSON.stringify({ type: 'attachment', timestamp: AT, attachment: { type: 'queued_command', prompt: 'Lo mando mientras trabajás: treinta', origin: { kind: 'human' }, humanTurn: true, timestamp: AT } }),
  JSON.stringify({ type: 'assistant', timestamp: AT, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'q1', name: 'AskUserQuestion', input: { questions: [{ question: '¿Treinta?', header: 'Espera', options: [{ label: 'Sí', description: 'treinta' }, { label: 'No', description: 'sesenta' }] }] } }] } }),
  JSON.stringify({ type: 'user', timestamp: AT, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'q1', content: 'answered' }] }, toolUseResult: { answers: { '¿Treinta?': 'Sí' } } }),
].join('\n');
const TRANSCRIPTS = { s1: TRANSCRIPT };
const transcriptOf = (session) => (Object.hasOwn(TRANSCRIPTS, session) ? TRANSCRIPTS[session] : null);
const words = (quotes) => ({ kind: 'words', quotes, reading: 'he set the wait to thirty minutes', accepted: 'the line he typed says so' });
const CONTEXT = { owner: 'project', today: TODAY, transcriptOf, exists: (file) => file === 'docs/ROADMAP.md' };

test('a source of his words stores the quotation the transcript gives, its local day, and a check by the command', () => {
  assert.deepEqual(sourceOf(words([{ session: 's1', line: 1 }]), CONTEXT), {
    kind: 'words',
    quotes: [{ quote: 'Sí, la espera del gate queda en treinta minutos', date: '2026-10-15', session: 's1', line: 1 }],
    reading: 'he set the wait to thirty minutes', accepted: 'the line he typed says so', checked: { date: TODAY, by: 'command' },
  });
});

test('an excerpt is stored when the typed words hold it, white space squashed, and refused when they do not', () => {
  const { quotes } = sourceOf(words([{ session: 's1', line: 1, excerpt: 'queda  en treinta\nminutos' }]), CONTEXT);
  assert.equal(quotes[0].quote, 'queda en treinta minutos');
  refusal(() => sourceOf(words([{ session: 's1', line: 1, excerpt: 'queda en sesenta' }]), CONTEXT), /not in what he typed/);
});

test('of a message part pasted, only what he typed is stored, and a paste alone is refused', () => {
  assert.equal(sourceOf(words([{ session: 's1', line: 4 }]), CONTEXT).quotes[0].quote, 'Y esto lo escribí yo, treinta minutos');
  refusal(() => sourceOf(words([{ session: 's1', line: 3 }]), CONTEXT), /only a paste/);
  refusal(() => sourceOf(words([{ session: 's1', line: 4, excerpt: 'written by a session' }]), CONTEXT), /not in what he typed/);
});

test('a message he queued while the session worked is his', () => {
  assert.equal(sourceOf(words([{ session: 's1', line: 5 }]), CONTEXT).quotes[0].quote, 'Lo mando mientras trabajás: treinta');
});

test('a line that is not his, a tapped answer, a missing session and a line past the end are refused', () => {
  refusal(() => sourceOf(words([{ session: 's1', line: 2 }]), CONTEXT), /line 2 of s1 is not his: an assistant entry/);
  refusal(() => sourceOf(words([{ session: 's1', line: 7 }]), CONTEXT), /tapped/);
  refusal(() => sourceOf(words([{ session: 's9', line: 1 }]), CONTEXT), /no transcript "s9"/);
  refusal(() => sourceOf(words([{ session: 's1', line: 99 }]), CONTEXT), /line 99 of s1 is not his: no line/);
});

test('one bad quotation among several refuses the source', () => {
  refusal(() => sourceOf(words([{ session: 's1', line: 1 }, { session: 's1', line: 2 }]), CONTEXT), /line 2 of s1/);
});

test('a source needs its reading and where he accepted it, and at least one quotation', () => {
  refusal(() => sourceOf({ ...words([{ session: 's1', line: 1 }]), reading: ' ' }, CONTEXT), /reading/);
  refusal(() => sourceOf({ ...words([{ session: 's1', line: 1 }]), accepted: undefined }, CONTEXT), /accepted/);
  refusal(() => sourceOf(words([]), CONTEXT), /at least one quotation/);
});

test('a design source names a path that exists, and a rule of his takes his words only', () => {
  assert.deepEqual(sourceOf({ kind: 'design', path: 'docs/ROADMAP.md' }, CONTEXT), { kind: 'design', path: 'docs/ROADMAP.md' });
  refusal(() => sourceOf({ kind: 'design', path: 'docs/NOPE.md' }, CONTEXT), /docs\/NOPE.md does not exist/);
  refusal(() => sourceOf({ kind: 'design', path: 'docs/ROADMAP.md' }, { ...CONTEXT, owner: 'sebastian' }), /his words/);
  refusal(() => sourceOf({ kind: 'notes' }, CONTEXT), /words or design/);
});
