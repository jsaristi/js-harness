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

test('the departure says the hours, each lane on the hour scale, the goals and what waits for the user', () => {
  const html = renderDeparture(departure);
  assert.match(html, /8 h/);
  assert.match(html, /Sesión 1/);
  assert.match(html, /PR 630 en main/);
  assert.match(html, /git merge-base --is-ancestor x origin\/main/);
  assert.match(html, /el gasto de S5c-a/);
  assert.match(html, /gasto.*su sí/s);
});

// --- the departure made plain (spec 6) ---

test('the departure opens with what will advance: each item that can run, as its title says, its session and hours', () => {
  const html = renderDeparture(departure);
  const advance = html.indexOf('Lo que va a avanzar');
  assert.ok(advance > 0 && advance < html.indexOf('Sesión 1'), 'what will advance comes before the lanes');
  assert.match(html, /Lo que va a avanzar[\s\S]*registros &lt;b&gt;[\s\S]*JH 69/);
  // An item that waits for the user cannot run while they are away: it is under what waits, not under what advances.
  assert.doesNotMatch(html.slice(advance, html.indexOf('Sesión 1')), /gasto/);
});

test('whether the queue fills the hours is a sentence that shows its arithmetic and its condition, not a yes or no', () => {
  const html = renderDeparture(departure);
  assert.doesNotMatch(html, /No cubre|Sí cubre/);
  // 2 sessions over 8 h are 16 session-hours against 3-4.5 h queued; idle is by the low estimate.
  assert.match(html, /2 sesiones a la vez durante tus 8 h: 16 h de sesión/);
  assert.match(html, /suma 3-4\.5 h/);
  assert.match(html, /si todo va tan rápido como su estimado más bajo, quedan 13 h de sesión sin trabajo antes de tu vuelta/i);
  assert.match(html, /desde el principio/);
  assert.match(renderDeparture({ ...departure, idle: { hours: 2, from: 3 } }), /3 h después de que salgas/);
  // One session and one idle hour read in the singular; fractional hours print rounded.
  const one = renderDeparture({ ...departure, hours: 2.2, lanes: [departure.lanes[0]], idle: { hours: 1, from: 0 } });
  assert.match(one, /Corre 1 sesión durante tus 2\.2 h: 2\.2 h de sesión/);
  assert.match(one, /queda 1 h de sesión sin trabajo/);
  const three = renderDeparture({ ...departure, hours: 2.2, lanes: [departure.lanes[0], departure.lanes[1], departure.lanes[1]] });
  assert.match(three, /3 sesiones a la vez durante tus 2\.2 h: 6\.6 h de sesión/);
  const full = renderDeparture({ ...departure, fills: true, idle: { hours: 0, from: null } });
  assert.match(full, /llena tus 8 h: aunque todo vaya rápido, ninguna sesión se queda sin trabajo antes de tu vuelta/);
});

test('an estimate reads as hours, with how it was adjusted in words; one not adjusted says why', () => {
  const unadjusted = { id: 'W3', title: 'JH 70: plantillas', kind: 'docs', hours: [1, 2], corrected: [1, 2], correction: { factor: 1, samples: 1, from: 'none' }, session: 'JH 70' };
  const html = renderDeparture({ ...departure, items: [...departure.items, unadjusted] });
  assert.match(html, /3-4\.5 h \(estimado 2-3 h, ajustado ×1\.5 por lo que tardaron los trabajos de construcción\)/);
  assert.match(html, /1-2 h \(sin ajustar: hay menos de 3 trabajos medidos\)/);
  assert.doesNotMatch(html, /escrito|corregido|sin historia/);
  // A title that starts with its session does not repeat it; one that starts with a longer label does.
  assert.doesNotMatch(html, /\(JH 70\)/);
  const other = renderDeparture({ ...departure, items: [{ ...unadjusted, title: 'JH 196: el hook', session: 'JH 19' }] });
  assert.match(other, /\(JH 19\)/);
});

test('with no map the departure fragment still opens with what will advance', () => {
  const html = renderDeparture(departure);
  assert.doesNotMatch(html, /Cuánto avanzaremos/);
  assert.match(html, /Lo que va a avanzar/);
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
  // Said once, at the top of what will advance, and the items are still listed by what they deliver.
  const advance = none.slice(none.indexOf('Lo que va a avanzar'), none.indexOf('Cuánto avanzaremos'));
  assert.equal(advance.match(/Ninguno de estos trabajos dice qué fila de la hoja de ruta cierra/g)?.length, 1);
  assert.match(advance, /registros &lt;b&gt;/);
  assert.doesNotMatch(advance, /no dice qué fila cierra/i);
  const blind = renderDeparture({ ...departure, map: MAP, forecast: { unavailable: 'git show: fatal' } });
  assert.match(blind, /no se pudo leer: git show: fatal/);
});

test('on the page, what will advance leads, each item with the rows it closes and when; one that names none says so', () => {
  const forecast = { ...FORECAST, rows: [{ in: 'F8 plan', step: 'S13', plan: true, text: 'S13 <x>', items: ['W1'], when: 'likely' }] };
  const extra = { id: 'W3', title: 'plantillas', kind: 'docs', hours: [1, 2], corrected: [1, 2], correction: { factor: 1, samples: 0, from: 'none' }, session: null };
  const html = renderDeparture({ ...departure, items: [...departure.items, extra], map: MAP, forecast });
  const advance = html.indexOf('Lo que va a avanzar');
  assert.ok(advance > 0 && advance < html.indexOf('Cuánto avanzaremos'), 'what will advance is the first section');
  const section = html.slice(advance, html.indexOf('Cuánto avanzaremos'));
  assert.match(section, /registros &lt;b&gt;[\s\S]*Paso que cierra: «S13 &lt;x&gt;» del F8 plan, cierra si va como se estimó/);
  assert.match(section, /plantillas[\s\S]*no dice qué fila cierra/i);
  // A row two items name closes with the first to end: the row's when is said as the row's, not each item's.
  const shared = { ...forecast, rows: [{ ...forecast.rows[0], items: ['W1', 'W3'] }] };
  const both = renderDeparture({ ...departure, items: [...departure.items, extra], map: MAP, forecast: shared });
  assert.match(both, /cierra si va como se estimó \(lo cierra el primero de los 2 trabajos que lo nombran\)/);
  // The plan's items are listed once on the page, under what will advance; the plan keeps only their lanes.
  assert.doesNotMatch(html, /<h3>Lo que va a avanzar<\/h3>|<h3>Trabajo<\/h3>/);
});

test('the phase table keeps only the phases that move, with their names as the roadmap writes them; none moving is one sentence', () => {
  const html = renderDeparture({ ...departure, map: MAP, forecast: FORECAST });
  const section = html.slice(html.indexOf('Cuánto avanzaremos'), html.indexOf('El plan'));
  assert.match(section, /Review and release/);
  assert.doesNotMatch(section, /F1 Skeleton/);
  assert.match(section, /como las nombra la hoja de ruta/);
  const still = { ...FORECAST, phases: [FORECAST.phases[0]] };
  const quiet = renderDeparture({ ...departure, map: MAP, forecast: still });
  assert.match(quiet.slice(quiet.indexOf('Cuánto avanzaremos'), quiet.indexOf('El plan')), /Ninguna fase del mapa del proyecto cambia con este tramo/);
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
  assert.match(html, /1 de 3 filas y pasos del pronóstico hechos/);
  // The map's range has no width here: the page says it closes even long, not "between 91 % and 91 %".
  const even = renderReturn({ ...view, state: 'open', moments: { ...moments, forecast: { ...moments.forecast, total: { ...FORECAST.total, low: 100 } } } });
  assert.match(even, /al volver, aunque el trabajo se alargue/);
  assert.match(html, /el mapa ganó 2 filas/);
  assert.match(html, />hecha</);
  assert.match(html, /ya no está/);
  // Measured, a phase moved outside the forecast is kept; a closed stretch with no phase moved says it in the past.
  const moved = { ...now, phases: [{ title: 'F1 Skeleton', done: 3, total: 4 }] };
  const shown = renderReturn({ ...view, state: 'open', moments: { ...moments, forecast: { ...FORECAST, now: moved } } });
  assert.match(shown, /F1 Skeleton/);
  const still = { ...FORECAST, phases: [FORECAST.phases[0]], now: { ...now, phases: [{ title: 'F1 Skeleton', done: 3, total: 3 }] } };
  const closed = renderReturn({ ...view, state: 'closed', moments: { ...moments, forecast: still } });
  assert.match(closed, /Ninguna fase del mapa del proyecto cambió/);
  // With the map of now unread, nothing was measured: the page does not say no phase changed.
  const unread = renderReturn({ ...view, state: 'closed', moments: { ...moments, forecast: { ...still, now: { unavailable: 'git show: fatal' } } } });
  assert.doesNotMatch(unread, /Ninguna fase del mapa del proyecto cambió/);
  assert.match(unread, /no pronosticaba que cambiara ninguna fase del mapa del proyecto/);
});

// odd/tasks/stretch-protocol.md, spec 7: the plan's block says what the plan is, how it differs from its phase in the
// map, its steps by state, and which steps move: forecast on the departure, measured on the return.
const STEPS = [
  { id: 'S0', title: 'S0 Baseline', reported: 'done' }, { id: 'S6', title: 'S6 The read surface', reported: 'to do' },
  { id: 'S9', title: 'S9 The host watch', reported: 'in progress' }, { id: 'S8', title: 'S8 Certification', reported: 'to do' },
];
const PLAN_FORECAST = {
  ...FORECAST,
  named: 1,
  phases: [...FORECAST.phases, { title: 'F8 Harness reorganization', done: 3, total: 7, forecast: 3, low: 3, high: 3 }],
  plans: [{ name: 'F8 plan', done: 1, total: 4, forecast: 2, low: 1, high: 2, steps: STEPS }],
  rows: [{ in: 'F8 plan', step: 'S8', plan: true, text: 'S8', items: ['s8'], when: 'likely' }],
};
const planBlock = (html) => html.slice(html.indexOf('<strong>F8 plan</strong>'), html.indexOf('Mapa del proyecto'));

test('the departure\'s plan block says what the plan is, its steps by state and the step the stretch closes', () => {
  const html = renderDeparture({ ...departure, items: [...departure.items, { id: 's8', title: 'la certificación', kind: 'verify', hours: [1, 2], corrected: [1, 2], correction: { factor: 1, samples: 0, from: 'none' }, session: null }], map: MAP, forecast: PLAN_FORECAST });
  const block = planBlock(html);
  assert.match(block, /sección de la hoja de ruta[\s\S]*1 de 4 pasos hechos \(25 %\)/);
  assert.match(block, /fase «F8 Harness reorganization»[\s\S]*3 de 7 filas \(43 %\)/);
  assert.match(block, /Hechos \(1\)[\s\S]*S0 Baseline[\s\S]*En curso \(1\)[\s\S]*Por hacer \(2\)[\s\S]*S6 The read surface · S8 Certification/);
  assert.match(block, /Pasos que nombra este tramo: S8 Certification \(cierra si va como se estimó\)/);
  assert.match(block, /~50 %/, 'a plan that moves keeps its tiles');
});

test('a plan the stretch does not touch says so in one line, with no tiles of three equal numbers', () => {
  const still = { ...PLAN_FORECAST, named: 0, rows: [], plans: [{ ...PLAN_FORECAST.plans[0], forecast: 1, high: 1 }] };
  const block = planBlock(renderDeparture({ ...departure, map: MAP, forecast: still }));
  assert.match(block, /Ningún trabajo de este tramo dice que cierre un paso de este plan/);
  assert.doesNotMatch(block, /~25 %|al volver/);
  // With no phase of the same name in the map, the block does not invent one; nor with two that share its first word.
  const alone = planBlock(renderDeparture({ ...departure, map: MAP, forecast: { ...still, phases: FORECAST.phases } }));
  assert.doesNotMatch(alone, /fase «/);
  const two = [...FORECAST.phases, { title: 'F8 One', done: 1, total: 2, forecast: 1, low: 1, high: 1 }, { title: 'F8 Two', done: 0, total: 1, forecast: 0, low: 0, high: 0 }];
  assert.doesNotMatch(planBlock(renderDeparture({ ...departure, map: MAP, forecast: { ...still, phases: two } })), /fase «/);
});

test('the departure marks where it is listed each step the stretch names, with its own when, and says closing a step marks no phase row', () => {
  const block = planBlock(renderDeparture({ ...departure, map: MAP, forecast: PLAN_FORECAST }));
  assert.match(block, /Por hacer \(2\)[\s\S]*S8 Certification <em>\(este tramo: cierra si va como se estimó\)<\/em>/);
  // Codex, P2: the mark keeps the row's when, so a step that ends after the return is not promised in the stretch.
  const late = { ...PLAN_FORECAST, rows: [{ ...PLAN_FORECAST.rows[0], when: 'beyond' }] };
  const lateBlock = planBlock(renderDeparture({ ...departure, map: MAP, forecast: late }));
  assert.match(lateBlock, /S8 Certification <em>\(este tramo: después de tu vuelta\)<\/em>/);
  assert.doesNotMatch(lateBlock, /lo cierra|Este tramo cierra/);
  assert.match(block, /cerrar un paso no marca por sí solo una fila de la fase/);
  assert.doesNotMatch(block, /S6 The read surface <em>/);
});

test('the return\'s plan block names the steps whose state moved in the stretch, from what to what', () => {
  const nowSteps = STEPS.map((one) => (one.id === 'S6' ? { ...one, reported: 'done' } : one));
  const now = { total: { done: 99, total: 109 }, phases: [], plans: [{ name: 'F8 plan', done: 2, total: 4, steps: nowSteps }], rows: [{ ...PLAN_FORECAST.rows[0], now: 'open' }], forecastDone: { done: 0, of: 1 }, gained: 0 };
  const moments = { head: { open: 'c0', now: 'c1', reconstructed: false }, goals: { met: { met: 1, of: 2, unknown: 0 }, inTime: { met: 1, of: 1, unknown: 0 } }, work: { met: 1, of: 2, unknown: 0, others: {}, waiting: [] }, outside: { sessions: [], untitled: 0 }, map: null, plans: [], forecast: { ...PLAN_FORECAST, now }, timeline: [], why: [], unavailable: {} };
  const block = planBlock(renderReturn({ ...view, state: 'closed', moments }));
  assert.match(block, /al abrir[\s\S]*1 de 4[\s\S]*ahora[\s\S]*2 de 4/);
  assert.match(block, /Cambiaron de estado en el tramo: S6 The read surface \(por hacer → hecho\)/);
  assert.match(block, /Hechos \(2\)[\s\S]*S0 Baseline · S6 The read surface/, 'the steps by their state now');
  const same = { ...now, plans: [{ name: 'F8 plan', done: 1, total: 4, steps: STEPS }] };
  const quiet = planBlock(renderReturn({ ...view, state: 'closed', moments: { ...moments, forecast: { ...PLAN_FORECAST, now: same } } }));
  assert.match(quiet, /Ningún paso cambió de estado en el tramo/);
  // The reliability lens: a plan the roadmap of now no longer holds says so, with no tiles of the opening's numbers.
  const gone = planBlock(renderReturn({ ...view, state: 'closed', moments: { ...moments, forecast: { ...PLAN_FORECAST, named: 0, rows: [], plans: [{ ...PLAN_FORECAST.plans[0], forecast: 1, high: 1 }], now: { ...now, plans: [] } } } }));
  assert.match(gone, /ya no está en la hoja de ruta de ahora/);
  assert.doesNotMatch(gone, /al volver|ahora: 1 de 4/);
});

test('the return says the forecast in the past, drops "0 de 0", and leaves out a step-by-step section with no step changed', () => {
  const sameSteps = STEPS.map((one) => ({ id: one.id, title: one.title, before: { said: 's', reported: one.reported }, after: { said: 's', reported: one.reported }, change: 'same', documents: [] }));
  const now = { total: { done: 99, total: 109 }, phases: [], plans: [{ name: 'F8 plan', done: 1, total: 4, steps: STEPS }], rows: [], forecastDone: { done: 0, of: 0 }, gained: 0 };
  const forecast = { ...PLAN_FORECAST, named: 0, rows: [], now };
  const moments = { head: { open: 'c0', now: 'c1', reconstructed: false }, goals: { met: { met: 1, of: 2, unknown: 0 }, inTime: { met: 1, of: 1, unknown: 0 } }, work: { met: 1, of: 2, unknown: 0, others: {}, waiting: [] }, outside: { sessions: [], untitled: 0 }, map: null, plans: [{ name: 'F8 plan', steps: sameSteps }], forecast, timeline: [], why: [], unavailable: {} };
  const html = renderReturn({ ...view, state: 'closed', moments });
  assert.match(html, /pronosticado al volver/);
  assert.doesNotMatch(html, /0 de 0 filas/);
  assert.match(html, /El mapa no ganó filas desde la apertura/);
  assert.doesNotMatch(html, /paso por paso/);
  // A step that changed keeps the section; so does a forecast that could not be read.
  const changed = [{ ...sameSteps[0], change: 'text changed' }, ...sameSteps.slice(1)];
  assert.match(renderReturn({ ...view, state: 'closed', moments: { ...moments, plans: [{ name: 'F8 plan', steps: changed }] } }), /paso por paso/);
  assert.match(renderReturn({ ...view, state: 'closed', moments: { ...moments, forecast: { unavailable: 'git show: fatal' } } }), /paso por paso/);
});

test('the open stretch reads as in course, goals not checked yet said so', () => {
  const html = renderView({ ...view, state: 'open', goals: { ...view.goals, checkedAt: null, met: 0, list: view.goals.list.map((goal) => ({ ...goal, met: null, said: null })) } });
  assert.match(html, /en curso/);
  assert.match(html, /sin revisar/);
});
