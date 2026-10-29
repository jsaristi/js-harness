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
