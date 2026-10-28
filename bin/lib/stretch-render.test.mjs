import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDeparture, renderView } from './stretch-render.mjs';

const departure = {
  id: '2026-10-28T12:00:00.000Z',
  openedAt: '2026-10-28T12:00:00.000Z',
  returnAt: '2026-10-28T20:00:00.000Z',
  hours: 8,
  slots: 2,
  items: [
    { id: 'W1', title: 'registros <b>', kind: 'build', hours: [2, 3], corrected: [3, 4.5], correction: { factor: 1.5, samples: 4, from: 'kind' }, session: 'JH 69' },
    { id: 'W2', title: 'gasto', kind: 'verify', hours: [2, 2], corrected: [2, 2], correction: { factor: 1, samples: 0, from: 'none' }, session: null, waitsFor: 'su sí' },
  ],
  lanes: [{ items: [{ id: 'W1', start: [0, 0], end: [3, 4.5] }], end: [3, 4.5] }, { items: [], end: [0, 0] }],
  queued: [3, 4.5],
  fills: false,
  idle: { hours: 13, from: 0 },
  goals: { checkedAt: null, met: 0, total: 1, list: [{ id: 'G1', text: 'PR 630 en main', command: 'git merge-base --is-ancestor x origin/main', met: null, said: null }] },
  waits: ['el gasto de S5c-a'],
};

test('the departure says the hours, whether the work fills them, each lane on the hour scale, the goals and what waits for the user', () => {
  const html = renderDeparture(departure);
  assert.match(html, /8 h/);
  assert.match(html, /No cubre/);
  assert.match(html, /13 h de sesión sin trabajo desde la hora 0/);
  assert.match(html, /Cupo 1/);
  assert.match(html, /PR 630 en main/);
  assert.match(html, /git merge-base --is-ancestor x origin\/main/);
  assert.match(html, /el gasto de S5c-a/);
  assert.match(html, /gasto.*su sí/s);
  // A corrected estimate says by how much and from what.
  assert.match(html, /×1\.5/);
});

test('a text from the plan is escaped: the fragment shows it and never runs it', () => {
  const html = renderDeparture(departure);
  assert.match(html, /registros &lt;b&gt;/);
  assert.doesNotMatch(html, /registros <b>/);
});

const view = {
  id: departure.id,
  openedAt: departure.openedAt,
  returnAt: departure.returnAt,
  at: '2026-10-28T20:10:00.000Z',
  state: 'closed',
  hours: 8,
  elapsedHours: 8.17,
  items: [
    { ...departure.items[0], state: 'finished', clipped: false, realHours: 5, lostHours: 1, failures: [{ at: '2026-10-28T13:00:00.000Z', seconds: 3600, what: 'gate fail: bin/a.test.mjs' }] },
    { ...departure.items[1], state: 'queued', clipped: false, realHours: 0, lostHours: 0, failures: [] },
  ],
  failures: [{ at: '2026-10-28T15:00:00.000Z', seconds: 600, what: 'land exit 1' }],
  totals: { estimate: [3, 4.5], realHours: 5, lostHours: 1.17, lostShare: 0.23 },
  goals: { checkedAt: '2026-10-28T20:10:00.000Z', met: 1, total: 2, list: [{ id: 'G1', text: 'PR 630 en main', command: 'a', met: true, said: 'exit 0' }, { id: 'G2', text: 'S11 revisada', command: 'b', met: false, said: 'exit 1' }] },
  waits: ['el gasto de S5c-a'],
  unmeasured: ['review-rewrite'],
  unavailable: { lands: 'EACCES' },
};

test('the return checks each goal, met or not with its command\'s answer, and counts them', () => {
  const html = renderView(view);
  assert.match(html, /1 de 2/);
  assert.match(html, /cumplida/);
  assert.match(html, /no cumplida/);
  assert.match(html, /exit 1/);
});

test('the return draws each item\'s estimate against its real time, the lost part apart, on one scale, with the failures and what was not measured', () => {
  const html = renderView(view);
  // The scale runs to the largest of the hours, the estimates and the real times: 8 h here.
  assert.match(html, /registros &lt;b&gt;[\s\S]*estimado 3-4\.5 h[\s\S]*5 h/);
  assert.match(html, /width:12\.5%/); // the lost hour of item W1, 1 of 8 h
  assert.match(html, /gate fail: bin\/a\.test\.mjs/);
  assert.match(html, /land exit 1/);
  assert.match(html, /23%/);
  assert.match(html, /sin empezar/);
  assert.match(html, /No se mide.*lo rehecho tras una revisión/);
  assert.match(html, /lands no se pudo leer: EACCES/);
});

test('the open stretch reads as in course, goals not checked yet said so', () => {
  const html = renderView({ ...view, state: 'open', goals: { ...view.goals, checkedAt: null, met: 0, list: view.goals.list.map((goal) => ({ ...goal, met: null, said: null })) } });
  assert.match(html, /en curso/);
  assert.match(html, /sin revisar/);
});
