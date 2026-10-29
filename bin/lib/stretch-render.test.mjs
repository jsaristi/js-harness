import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDeparture, renderReturn, renderView, whySection } from './stretch-render.mjs';

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

test('the why section has a row for each thing left undone: what, why, how it was or can be fixed, why not; an empty cell says "no registrado"', () => {
  const rows = [
    { kind: 'goal', target: 'G2', what: 'PR <644>', why: [{ text: 'la cola la rechazó', source: 'commit e6c8214c' }], fix: [{ text: 'aterrizó en #645', source: 'commit e6c8214c' }], open: [{ text: 'la raíz es T5f', source: 'commit e6c8214c' }], fixed: false },
    { kind: 'failure', target: 'W1', what: 'JH 69 · 13:00Z · 10 min', why: [{ text: 'gate fail', source: 'el registro de gates' }], fix: [{ text: 'una corrida posterior pasó a las 13:30Z', source: 'el registro de gates' }], open: [], fixed: true },
    { kind: 'item', target: 'W3', what: 'plantillas', why: [{ text: 'ninguna sesión la tomó', source: 'el plan del tramo' }], fix: [], open: [], fixed: false },
  ];
  const html = whySection(rows);
  assert.match(html, /Qué[\s\S]*Por qué[\s\S]*Cómo se arregló o se puede arreglar[\s\S]*Por qué no se ha arreglado/);
  assert.match(html, /PR &lt;644&gt;/);
  assert.match(html, /la cola la rechazó[\s\S]*commit e6c8214c/);
  assert.match(html, /Meta/);
  assert.match(html, /Falla/);
  assert.match(html, /Trabajo/);
  // A fixed row has nothing open; one with no fix recorded says so in both cells.
  assert.match(html, /13:30Z[\s\S]*se arregló/);
  assert.equal(html.match(/no registrado/g).length, 2);
  assert.match(whySection([]), /Nada quedó sin hacer/);
});

// --- the forecast (odd/tasks/stretch-forecast.md) ---

const FORECAST = {
  named: 3,
  total: { done: 99, total: 109, forecast: 100, low: 99, high: 100 },
  phases: [
    { title: 'F1 Skeleton', done: 3, total: 3, forecast: 3, low: 3, high: 3 },
    { title: 'Review and release', done: 4, total: 5, forecast: 5, low: 4, high: 5 },
  ],
  plans: [{ name: 'F8 plan', done: 6, total: 19, forecast: 8, low: 7, high: 8 }],
  rows: [
    { in: 'F8 plan', step: 'S5c-a', plan: true, text: 'S5c-a', items: ['s5ca'], when: 'sure' },
    { in: 'F8 plan', step: 'S13', plan: true, text: 'S13', items: ['s13'], when: 'likely' },
    { in: 'Review and release', step: 'The lead', plan: false, text: 'The lead\'s manual steps <are> commands', items: ['lead'], when: 'likely' },
  ],
  problems: [],
};
const MAP = { done: 99, total: 109, phases: [{ title: 'F1 Skeleton', done: 3, total: 3, open: [] }, { title: 'Review and release', done: 4, total: 5, open: ['x'] }] };

test('the departure leads with the migration\'s plan and then the map: the share now and about where it reaches, its range beside it', () => {
  const html = renderDeparture({ ...departure, map: MAP, forecast: FORECAST });
  const lead = html.indexOf('Cuánto avanzaremos');
  assert.ok(lead > 0 && lead < html.indexOf('El plan'), 'the forecast comes before the plan');
  // The plan's steps first: 6 of 19 is 32 %, about 8 of 19 (42 %) at the return, from 37 % to 42 %.
  assert.match(html, /F8 plan[\s\S]*32 %[\s\S]*~42 %[\s\S]*entre 37 % y 42 %/);
  assert.ok(html.indexOf('F8 plan') < html.indexOf('Mapa del proyecto'), 'the migration leads, the map comes second');
  assert.match(html, /Mapa del proyecto[\s\S]*91 %[\s\S]*~92 %[\s\S]*entre 91 % y 92 %/);
  // Each phase now and at the return, and each row with when it closes; the row's text escaped.
  assert.match(html, /Review and release[\s\S]*4\/5 · 80 %[\s\S]*5\/5 · 100 %/);
  assert.match(html, /cierra aunque se alargue/);
  assert.match(html, /cierra si va como se estimó/);
  assert.match(html, /The lead&#39;s manual steps &lt;are&gt; commands/);
});

test('a departure whose items name nothing says the forecast is today\'s share; one with no map says why', () => {
  const none = renderDeparture({ ...departure, map: MAP, forecast: { ...FORECAST, named: 0, rows: [], total: { ...FORECAST.total, forecast: 99, high: 99 } } });
  assert.match(none, /Ningún trabajo del plan dice qué cierra/);
  const blind = renderDeparture({ ...departure, map: MAP, forecast: { unavailable: 'git show: fatal' } });
  assert.match(blind, /no se pudo leer: git show: fatal/);
});

test('the status measures the stretch against its forecast: at the opening, the forecast, now, the named rows done and the rows added', () => {
  const now = {
    total: { done: 100, total: 111 },
    phases: [],
    plans: [{ name: 'F8 plan', done: 7, total: 19 }],
    rows: FORECAST.rows.map((row, index) => ({ ...row, now: ['done', 'open', 'gone'][index] })),
    forecastDone: { done: 1, of: 3 },
    gained: 2,
  };
  const moments = {
    head: { open: 'c0', now: 'c1', reconstructed: false },
    goals: { met: { met: 1, of: 2, unknown: 0 }, inTime: { met: 1, of: 1, unknown: 0 } },
    work: { met: 1, of: 2, unknown: 0, others: {}, waiting: [] },
    outside: { sessions: [], untitled: 0 },
    map: null,
    plans: [],
    forecast: { ...FORECAST, now },
    timeline: [],
    why: [],
    unavailable: {},
  };
  const html = renderReturn({ ...view, state: 'open', moments });
  assert.ok(html.indexOf('Cuánto avanzaremos') < html.indexOf('Cuánto se cumplió'), 'the forecast section comes first');
  // At the opening 32 %, about 42 % forecast from 37 %, and 37 % now.
  assert.match(html, /F8 plan[\s\S]*32 %[\s\S]*~42 %[\s\S]*37 %[\s\S]*37 %/);
  assert.match(html, /1 de 3 filas del pronóstico hechas/);
  assert.match(html, /el mapa ganó 2 filas/);
  assert.match(html, />hecha</);
  assert.match(html, /ya no está/);
});

test('the open stretch reads as in course, goals not checked yet said so', () => {
  const html = renderView({ ...view, state: 'open', goals: { ...view.goals, checkedAt: null, met: 0, list: view.goals.list.map((goal) => ({ ...goal, met: null, said: null })) } });
  assert.match(html, /en curso/);
  assert.match(html, /sin revisar/);
});
