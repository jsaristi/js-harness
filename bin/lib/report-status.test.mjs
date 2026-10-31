import assert from 'node:assert/strict';
import test from 'node:test';
import { notesOf, renderStatus } from './report-status.mjs';

const CUT = { at: Date.parse('2026-10-29T00:00:00Z'), source: 'last-report', head: 'c0' };
const MAP = { done: 3, total: 5, phases: [{ title: 'F1 Skeleton', done: 2, total: 2, open: [] }, { title: 'F2 Board', done: 1, total: 3, open: ['y', 'z'] }] };
const BEFORE = { done: 1, total: 5, phases: [{ title: 'F1 Skeleton', done: 1, total: 2, open: ['b'] }, { title: 'F2 Board', done: 0, total: 3, open: ['x', 'y', 'z'] }] };
const FACTS = {
  cut: CUT,
  branch: 'main',
  landed: [{ hash: 'm1', at: Date.parse('2026-10-29T02:00:00Z'), subject: 'Merge pull request #645 from feat/visual-pages', number: 645, branch: 'feat/visual-pages', commits: ['feat(pages): one renderer', 'fix(pages): <the caption>'] }],
  sessions: [{ name: 'JH 79 · Visual pages', count: 4, last: { kind: 'ready', at: '2026-10-29T03:25:18Z', text: '#645 ready' } }],
  questions: { answered: [{ number: 7, at: Date.parse('2026-10-29T01:00:00Z'), notice: { text: '¿Cuál rama?' }, answer: 'main', verified: true }], open: [{ number: 8, notice: { at: '2026-10-29T03:00:00Z', text: '¿Publico?', waits: 'T9' } }] },
  map: MAP,
  before: { map: BEFORE },
};

test('the status report is the six sections as a page, the records\' facts and the notes labelled the lead\'s', () => {
  const notes = notesOf(JSON.stringify({ badNews: ['#644 fue rechazado al empujar.'], decisions: [{ text: 'Aterrizar 644 dentro de 645', changed: 'una revisión menos' }], waits: [{ what: 'T5f', why: 'otra sesión' }], proposals: [{ step: 'Tramo C', why: 'faltan páginas' }] }));
  const html = renderStatus({ ...FACTS, notes });
  assert.match(html, /^<title>Cómo vamos<\/title>/);
  assert.match(html, /Primero lo malo\.[\s\S]*#644 fue rechazado al empujar\./);
  const order = ['1. Lo que entró', '2. Las sesiones', '3. Tus decisiones y qué cambiaron', '4. El mapa', '5. Lo que espera', '6. Lo que propongo'].map((title) => html.indexOf(title));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `the six sections in order: ${order}`);
  assert.match(html, /PR 645[\s\S]*feat\/visual-pages[\s\S]*fix\(pages\): &lt;the caption&gt;/);
  assert.match(html, /JH 79 · Visual pages[\s\S]*#645 ready/);
  assert.match(html, /Aterrizar 644 dentro de 645[\s\S]*una revisión menos[\s\S]*del orquestador/);
  assert.match(html, /F1 Skeleton[\s\S]*1\/2[\s\S]*2\/2 · 100 %[\s\S]*cerrada/);
  assert.match(html, /Pregunta 8[\s\S]*¿Publico\?[\s\S]*T9/);
  assert.match(html, /T5f[\s\S]*otra sesión/);
  assert.match(html, /Tramo C[\s\S]*faltan páginas/);
});

test('with no notes each of their sections says no record holds it, and with no before the map shows now', () => {
  const html = renderStatus({ ...FACTS, before: null, notes: null });
  assert.doesNotMatch(html, /Primero lo malo/);
  assert.match(html, /3\. Tus decisiones y qué cambiaron<\/h2><p class="note">Ningún registro lo guarda/);
  assert.match(html, /6\. Lo que propongo<\/h2><p class="note">Ningún registro lo guarda/);
  assert.match(html, /4\. El mapa<\/h2>[\s\S]*sin un antes[\s\S]*F2 Board[\s\S]*1\/3 · 33 %/);
});

// odd/tasks/report-stretch-share.md: section 4 opens with the migration's share and the last stretch, from the records.
const STRETCH = {
  id: 's-1',
  state: 'closed',
  openedAt: '2026-10-29T06:00:00.000Z',
  returnAt: '2026-10-29T11:00:00.000Z',
  at: '2026-10-29T10:30:00.000Z',
  hours: 5,
  elapsedHours: 4.5,
  goals: { checkedAt: '2026-10-29T10:30:00.000Z', met: 1, total: 2, list: [{ id: 'G1', text: 'PR 630 en main', met: true, said: 'exit 0' }, { id: 'G2', text: 'S13 hecha', met: false, said: 'exit 1' }] },
  totals: { estimate: [6, 9], realHours: 7, lostHours: 0.5, lostShare: 0.07 },
  forecast: {
    named: 2,
    total: { done: 1, total: 4, forecast: 3, low: 2, high: 3 },
    plans: [{ name: 'F8 plan', done: 1, total: 2, forecast: 2, low: 1, high: 2 }],
    now: { total: { done: 3, total: 5 }, plans: [{ name: 'F8 plan', done: 2, total: 2 }], forecastDone: { done: 2, of: 2 }, gained: 1 },
  },
};
const sectionFour = (html) => html.slice(html.indexOf('4. El mapa'), html.indexOf('5. Lo que espera'));

test('section 4 opens with the migration now and at the cut, then the last stretch: each goal with its exit, its hours and its forecast against now', () => {
  const html = renderStatus({ ...FACTS, map: { ...MAP, plans: [{ name: 'F8 plan', done: 9, total: 14 }] }, before: { map: { ...BEFORE, plans: [{ name: 'F8 plan', done: 8, total: 14 }] } }, stretch: STRETCH, notes: null });
  const four = sectionFour(html);
  assert.match(four, /<h3>La migración<\/h3>[\s\S]*F8 plan[\s\S]*8 de 14 pasos · 57 %[\s\S]*9 de 14 pasos · 64 %/);
  assert.match(four, /<h3>El último tramo<\/h3>[\s\S]*s-1[\s\S]*cerrado[\s\S]*4\.5 h de 5 h[\s\S]*estimado 6-9 h, real 7 h, perdido 0\.5 h/);
  assert.match(four, /PR 630 en main[\s\S]*sí[\s\S]*exit 0[\s\S]*S13 hecha[\s\S]*no[\s\S]*exit 1/);
  assert.match(four, /F8 plan[\s\S]*1 de 2 · 50 %[\s\S]*~100 %[\s\S]*50 % a 100 %[\s\S]*2 de 2 · 100 %/);
  assert.match(four, /Mapa del proyecto[\s\S]*1 de 4 · 25 %[\s\S]*~75 %[\s\S]*50 % a 75 %[\s\S]*3 de 5 · 60 %/);
  assert.match(four, /De las filas que el pronóstico contaba, 2 de 2 están hechas/);
  assert.ok(four.indexOf('La migración') < four.indexOf('El último tramo') && four.indexOf('El último tramo') < four.indexOf('F2 Board'), 'the migration, then the stretch, then the phases');
});

test('section 4 says when no stretch ran since the cut, when the stretch record cannot be read, and when the cut has no map', () => {
  const plans = [{ name: 'F8 plan', done: 9, total: 14 }];
  const none = sectionFour(renderStatus({ ...FACTS, map: { ...MAP, plans }, before: null, stretch: null, notes: null }));
  assert.match(none, /9 de 14 pasos · 64 %/);
  assert.match(none, /En el corte no se sabe: el último reporte no guardó la rama que leyó/);
  assert.match(none, /Ningún tramo abierto ni cerrado desde el corte\./);
  const unread = sectionFour(renderStatus({ ...FACTS, map: { ...MAP, plans }, stretch: { unavailable: 'EACCES' }, notes: null }));
  assert.match(unread, /El registro de los tramos no se pudo leer: EACCES/);
  const partial = sectionFour(renderStatus({ ...FACTS, map: { ...MAP, plans }, stretch: { ...STRETCH, unread: { 'gate log': 'EACCES' } }, notes: null }));
  assert.match(partial, /real 7 h[\s\S]*No se pudo leer gate log \(EACCES\): las horas son parciales\./);
  const open = sectionFour(renderStatus({ ...FACTS, map: { ...MAP, plans: [] }, stretch: { ...STRETCH, state: 'open', goals: { checkedAt: null, met: 0, total: 1, list: [{ id: 'G1', text: 'PR 630 en main', met: null, said: null }] }, forecast: { unavailable: 'git show: bad' } }, notes: null }));
  assert.match(open, /La hoja de ruta no tiene una sección de plan/);
  assert.match(open, /abierto[\s\S]*vuelve 2026-10-29 11:00Z/);
  assert.match(open, /PR 630 en main[\s\S]*sin revisar/);
  assert.match(open, /El pronóstico no se pudo leer: git show: bad/);
});

// odd/tasks/departure-stretch.md, spec 9: "el mapa de donde vamos", the plan's steps as a chain before and now.
const STEPS = [{ name: 'F8 plan', steps: [
  { id: 'S1', title: 'One', before: { reported: 'in progress', said: 'started' }, after: { reported: 'done', said: 'all of it' }, change: 'advanced', documents: [{ path: 'odd/tasks/one.md', before: { done: 1, total: 3 }, after: { done: 3, total: 3 } }] },
  { id: 'S2', title: 'Two', before: { reported: 'to do', said: 'later' }, after: { reported: 'to do', said: 'later' }, change: 'same', documents: [] },
] }];

test('section 4 draws each plan step by step, before and now, after the migration\'s share and before the stretch', () => {
  const html = renderStatus({ ...FACTS, map: { ...MAP, plans: [{ name: 'F8 plan', done: 1, total: 2 }] }, steps: STEPS, stretch: STRETCH, notes: null });
  const four = sectionFour(html);
  assert.match(four, /<h3>F8 plan, paso por paso<\/h3>[\s\S]*S1[\s\S]*all of it[\s\S]*odd\/tasks\/one\.md: 1\/3 → 3\/3[\s\S]*avanzó[\s\S]*S2[\s\S]*igual/);
  assert.ok(four.indexOf('La migración') < four.indexOf('paso por paso') && four.indexOf('paso por paso') < four.indexOf('El último tramo'), 'the share, then the steps, then the stretch');
  const unread = sectionFour(renderStatus({ ...FACTS, map: { ...MAP, plans: [] }, steps: { unavailable: 'git show: bad' }, notes: null }));
  assert.match(unread, /Los pasos del plan no se pudieron leer: git show: bad/);
  assert.doesNotMatch(sectionFour(renderStatus({ ...FACTS, notes: null })), /paso por paso|Los pasos del plan/);
});

// The same spec: "lo que estimabamos avanzar y lo que realmente avanzamos", each proposal's estimate, set beside what
// landed by the next report.
const sectionSix = (html) => html.slice(html.indexOf('6. Lo que propongo'));

test('each proposal carries its estimate, and the next report sets the last one\'s beside what landed since', () => {
  const notes = notesOf(JSON.stringify({ proposals: [{ step: 'Tramo D', why: 'falta el mapa', estimate: '2 h, PR 740 en main' }, { step: 'Tramo E', why: 'luego' }] }));
  const cut = { ...CUT, proposals: [{ step: 'Tramo C', estimate: 'PR 645 en main en 3 h' }, { step: 'Tramo B', estimate: null }] };
  const six = sectionSix(renderStatus({ ...FACTS, cut, notes }));
  assert.match(six, /Tramo D[\s\S]*falta el mapa[\s\S]*2 h, PR 740 en main/);
  assert.match(six, /Tramo E[\s\S]*sin estimación/);
  assert.match(six, /Lo que propuse el 2026-10-29 00:00Z[\s\S]*Tramo C[\s\S]*PR 645 en main en 3 h[\s\S]*Tramo B[\s\S]*sin estimación/);
  assert.match(six, /Desde entonces entró: PR 645\./);
  assert.match(sectionSix(renderStatus({ ...FACTS, cut, landed: [], notes })), /Desde entonces no entró nada a la rama principal\./);
  assert.match(sectionSix(renderStatus({ ...FACTS, cut, landed: { error: 'git log: fatal' }, notes })), /Lo que entró desde entonces no se pudo leer: git log: fatal/);
  assert.match(sectionSix(renderStatus({ ...FACTS, cut, notes: null })), /Lo que propuse el[\s\S]*Tramo C[\s\S]*Ningún registro lo guarda/);
  assert.doesNotMatch(sectionSix(renderStatus({ ...FACTS, notes })), /Lo que propuse el/);
  assert.throws(() => notesOf(JSON.stringify({ proposals: [{ step: 'a', why: 'b', estimate: ' ' }] })), /proposals\[0\]\.estimate is a text that is not blank/);
});

test('a section the records could not give says why, and nothing that landed or wrote is said as such', () => {
  const html = renderStatus({ ...FACTS, landed: { error: 'git log: fatal' }, sessions: [], questions: { error: 'the record: EACCES' }, map: { absent: true }, before: { unavailable: 'c0: bad object' }, notes: null });
  assert.match(html, /1\. Lo que entró<\/h2><p class="note">No se pudo leer: git log: fatal/);
  assert.match(html, /2\. Las sesiones<\/h2><p class="note">Ninguna sesión escribió desde el corte/);
  assert.match(html, /5\. Lo que espera<\/h2><p class="note">No se pudo leer: the record: EACCES/);
  assert.match(html, /4\. El mapa<\/h2><p class="note">La rama main no tiene docs\/ROADMAP\.md/);
});

test('an answer no transcript confirmed is said as the sender\'s claim, and with no notes the waits are not said to be none', () => {
  const questions = { answered: [{ number: 7, at: Date.parse('2026-10-29T01:00:00Z'), notice: { text: '¿Cuál rama?' }, answer: 'main', verified: false }], open: [] };
  const html = renderStatus({ ...FACTS, questions, notes: null });
  assert.match(html, /7 \(main; sin verificar: lo dice quien la envió\)/);
  assert.doesNotMatch(html, /Nada espera/);
  assert.match(html, /5\. Lo que espera<\/h2><p class="note">Ninguna pregunta abierta\. Lo demás que espera no lo guarda ningún registro: lo escribe el orquestador en sus notas \(--notes\), y esta vez no las dio\./);
  const withNotes = renderStatus({ ...FACTS, questions: { answered: [], open: [] }, notes: notesOf('{}') });
  assert.match(withNotes, /5\. Lo que espera<\/h2><p class="note">Nada espera: ninguna pregunta abierta y ninguna espera en las notas\./);
});

test('the notes are read whole or refused with what is wrong', () => {
  assert.deepEqual(notesOf('{}'), { badNews: [], decisions: [], waits: [], proposals: [] });
  assert.throws(() => notesOf('not json'), /the notes are not JSON/);
  assert.throws(() => notesOf('{"badNews":"one"}'), /badNews is a list of texts/);
  assert.throws(() => notesOf('{"decisions":[{"text":"a"}]}'), /decisions\[0\] needs text and changed/);
  assert.throws(() => notesOf('{"other":[]}'), /unknown field: other/);
  // Every next step shown to him carries its reason, the criterion (his words, transcript 0f71b2c6 line 18204).
  for (const why of ['', '   ']) {
    assert.throws(() => notesOf(JSON.stringify({ proposals: [{ step: 'Tramo D', why }] })), /proposals\[0\] needs step and why/);
  }
  assert.throws(() => notesOf(JSON.stringify({ waits: [{ what: ' ', why: 'otra sesión' }] })), /waits\[0\] needs what and why/);
  for (const decision of [{ text: '', changed: 'una revisión menos' }, { text: 'Aterrizar 644', changed: '\t' }]) {
    assert.throws(() => notesOf(JSON.stringify({ decisions: [decision] })), /decisions\[0\] needs text and changed/);
  }
});

// His words (lead transcript 0f71b2c6 line 26049, 2026-10-30): "En la pagina como vamos no me aparece lo que me
// dices". The numbers he asks for head the page, before every commit and the sessions.
const headOf = (html) => html.slice(html.indexOf('<div class="tiles">'), html.indexOf('1. Lo que entró'));

test('the numbers head the page before section 1: the migration now and at the cut, the map, the stretch goals each sí or no', () => {
  const html = renderStatus({ ...FACTS, map: { ...MAP, plans: [{ name: 'F8 plan', done: 9, total: 14 }] }, before: { map: { ...BEFORE, plans: [{ name: 'F8 plan', done: 8, total: 14 }] } }, stretch: STRETCH, notes: notesOf(JSON.stringify({ badNews: ['algo malo'] })) });
  const tilesAt = html.indexOf('<div class="tiles">');
  assert.ok(tilesAt > html.indexOf('Primero lo malo'), 'the bad news first, then the numbers');
  assert.ok(tilesAt > 0 && tilesAt < html.indexOf('1. Lo que entró'), `the tiles before section 1: ${tilesAt}`);
  const head = headOf(html);
  assert.match(head, /64 %[\s\S]*width:64%[\s\S]*F8 plan[\s\S]*9 de 14 pasos/);
  assert.match(head, /57 %[\s\S]*en el corte[\s\S]*8 de 14 pasos/);
  assert.match(head, /60 %[\s\S]*width:60%[\s\S]*mapa[\s\S]*3 de 5/);
  assert.match(head, /1 de 2[\s\S]*width:50%[\s\S]*metas[\s\S]*s-1/);
  assert.match(head, /sí[\s\S]*PR 630 en main[\s\S]*no[\s\S]*S13 hecha/);
});

test('the head says what it does not know: no cut map, no stretch, an unread roadmap or stretch record', () => {
  const head = headOf(renderStatus({ ...FACTS, map: { ...MAP, plans: [{ name: 'F8 plan', done: 9, total: 14 }] }, before: null, stretch: null, notes: null }));
  assert.match(head, /64 %[\s\S]*F8 plan/);
  assert.match(head, /en el corte no se sabe/);
  assert.match(head, /ningún tramo desde el corte/);
  const unread = headOf(renderStatus({ ...FACTS, map: { error: 'git show: bad' }, stretch: { unavailable: 'EACCES' }, notes: null }));
  assert.match(unread, /el mapa no se pudo leer/);
  assert.match(unread, /los tramos no se pudieron leer/);
  // The reliability review, R3-002: a stretch whose goals are not checked yet, a branch with no roadmap, a roadmap with no plan.
  const unchecked = { ...STRETCH, state: 'open', goals: { checkedAt: null, met: 0, total: 1, list: [{ id: 'G1', text: 'PR 630 en main', met: null, said: null }] } };
  const open = headOf(renderStatus({ ...FACTS, map: { absent: true }, stretch: unchecked, notes: null }));
  assert.match(open, /la rama main no tiene docs\/ROADMAP\.md/);
  assert.match(open, /sin revisar[\s\S]*1 metas del último tramo, s-1 \(abierto\), sin revisar todavía[\s\S]*sin revisar[\s\S]*PR 630 en main/);
  const noPlan = headOf(renderStatus({ ...FACTS, map: { ...MAP, plans: [] }, stretch: null, notes: null }));
  assert.match(noPlan, /la hoja de ruta no tiene una sección de plan[\s\S]*El mapa del proyecto: 3 de 5 filas hechas/);
});

test('section 1 is one row a pull request, what it gives first and its commits folded', () => {
  const landed = [{ hash: 'm1', at: Date.parse('2026-10-29T02:00:00Z'), subject: 'Merge pull request #683 from feat/x', number: 683, branch: 'feat/x', commits: ['test(report): a test', 'feat(report): carry the share', 'docs: a doc'] }];
  const sectionOne = (html) => html.slice(html.indexOf('1. Lo que entró'), html.indexOf('2. Las sesiones'));
  const one = sectionOne(renderStatus({ ...FACTS, landed, notes: null }));
  assert.match(one, /PR 683[\s\S]*feat\(report\): carry the share[\s\S]*<details><summary>3 commits<\/summary><ul><li>test\(report\): a test/);
  assert.doesNotMatch(one, /<td><ul>/, 'no commit list left open');
  const noFeat = sectionOne(renderStatus({ ...FACTS, landed: [{ ...landed[0], commits: ['fix(a): first fix', 'docs: b'] }], notes: null }));
  assert.match(noFeat, /PR 683[\s\S]*fix\(a\): first fix[\s\S]*2 commits/);
  // The reliability review, R3-003: the column heads, and a merge that brought no commit of its own.
  const none = sectionOne(renderStatus({ ...FACTS, landed: [{ ...landed[0], commits: [] }], notes: null }));
  assert.match(none, /<th>Qué da<\/th><th>Cuándo<\/th><th>Commits<\/th>/);
  assert.match(none, /<strong>PR 683<\/strong> · feat\/x<\/td>[\s\S]*<td>—<\/td>/);
});
