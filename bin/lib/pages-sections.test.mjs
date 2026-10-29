import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSection, planSections, sharesTiles, timelineSection } from './pages-sections.mjs';

test('the shares are tiles that say their denominator, an unknown share "sin medir" and the work outside the plan a count', () => {
  const html = sharesTiles({
    goals: { met: { met: 4, of: 4, unknown: 0 }, inTime: { met: 3, of: 4, unknown: 0 } },
    work: { met: 3, of: 4, unknown: 0, others: { running: ['W4'] }, waiting: [] },
    outside: { sessions: [{ label: 'JH 72' }, { label: 'JH 73' }], untitled: 0 },
  });
  assert.match(html, /100 %[\s\S]*4 de 4 metas cumplidas/);
  assert.match(html, /75 %[\s\S]*3 de 4 cumplidas a tiempo/);
  assert.match(html, /75 %[\s\S]*3 de 4 trabajos terminados/);
  assert.match(html, /\+2[\s\S]*sesiones fuera del plan/);
  const unknown = sharesTiles({ goals: { met: { met: null, of: 2, unknown: 2 }, inTime: { met: 0, of: 0, unknown: 0 } }, work: { met: 0, of: 0, unknown: 0, others: {}, waiting: [] }, outside: { sessions: [], untitled: 0 } });
  assert.match(unknown, /sin medir[\s\S]*2 metas sin revisar/);
  assert.match(unknown, /nada que medir/);
  assert.doesNotMatch(unknown, /ninguna meta cumplida todavía/, 'goals not reviewed are not "none met"');
  assert.match(unknown, /a tiempo sin medir: las metas no se revisaron/);
  assert.match(unknown, /nada planeado/, 'no work planned');
});

test('the in-time tile over no goal met says why from the goals: none met, nothing planned or not reviewed', () => {
  const empty = { work: { met: 0, of: 0, unknown: 0, others: {}, waiting: [] }, outside: { sessions: [], untitled: 0 } };
  const inTime = { met: 0, of: 0, unknown: 0 };
  const noneMet = sharesTiles({ ...empty, goals: { met: { met: 0, of: 3, unknown: 0 }, inTime } });
  assert.match(noneMet, /0 de 3 metas cumplidas[\s\S]*ninguna meta cumplida todavía/);
  const nonePlanned = sharesTiles({ ...empty, goals: { met: { met: 0, of: 0, unknown: 0 }, inTime } });
  assert.doesNotMatch(nonePlanned, /ninguna meta cumplida todavía/);
  assert.equal(nonePlanned.match(/nada planeado/g).length, 3, 'goals, in time and work each say nothing was planned');
});

test('the map shows each phase before and now, the ones that changed marked, and the total', () => {
  const html = mapSection({
    total: { before: { done: 95, total: 106 }, after: { done: 95, total: 107 } },
    phases: [{ title: 'Session board', before: { done: 13, total: 15 }, after: { done: 13, total: 16 }, open: ['stretch <b>', 'x'], change: 'changed' }, { title: 'F1', before: { done: 3, total: 3 }, after: { done: 3, total: 3 }, open: [], change: 'same' }],
  });
  assert.match(html, /Session board[\s\S]*13\/15[\s\S]*13\/16 · 81 %[\s\S]*cambió[\s\S]*stretch &lt;b&gt;/);
  assert.match(html, /Total[\s\S]*95\/106 · 90 %[\s\S]*95\/107 · 89 %/);
});

test('a map with no before says it has none and still shows now', () => {
  const html = mapSection({ total: { before: null, after: { done: 1, total: 2 } }, phases: [{ title: 'A', before: null, after: { done: 1, total: 2 }, open: ['b'], change: 'same' }] });
  assert.match(html, /Sin antes/);
  assert.match(html, /1\/2 · 50 %/);
});

test('each plan is a chain of its steps by the state the roadmap reports, and a table of what it says and its documents\' tasks before and now', () => {
  const [section] = planSections([{ name: 'F8 plan', steps: [
    { id: 'S0', title: 'S0 Baseline', before: { said: 'done', reported: 'done' }, after: { said: 'done', reported: 'done' }, change: 'same', documents: [{ path: 'odd/tasks/a.md', before: { done: 8, total: 9 }, after: { done: 8, total: 9 } }] },
    { id: 'S11', title: 'S11 Complements', before: { said: 'in progress', reported: 'in progress' }, after: { said: 'in progress, two PRs', reported: 'in progress' }, change: 'advanced', documents: [{ path: 'odd/tasks/b.md', before: null, after: { done: 3, total: 6 } }] },
    { id: 'S13', title: 'S13 R', before: { said: 'to do', reported: 'to do' }, after: { said: 'to do, planned', reported: 'to do' }, change: 'text changed', documents: [] },
  ] }]);
  assert.equal(section.title, 'F8 plan, paso por paso');
  assert.match(section.html, /step done">S0[\s\S]*step moving moved">S11[\s\S]*step todo">S13/);
  assert.match(section.html, /odd\/tasks\/b\.md[\s\S]*— → 3\/6/);
  assert.match(section.html, /avanzó/);
  assert.match(section.html, /texto cambiado/);
  assert.match(section.note, /dice la hoja de ruta/);
});

test('the timeline words each row in Spanish, the record\'s own texts as written', () => {
  const html = timelineSection([
    { at: '2026-10-28T12:11:00Z', type: 'open' },
    { at: '2026-10-28T12:19:00Z', type: 'merge', pr: 626, branch: 'docs/f8' },
    { at: '2026-10-28T13:00:00Z', type: 'check', met: 3, of: 4 },
    { at: '2026-10-28T14:09:00Z', type: 'question', who: 'JH 68 · s11', text: 'which preset?' },
    { at: '2026-10-28T16:27:00Z', type: 'failure', who: 'orquestador', what: 'land exit 1', seconds: 1500 },
    { at: '2026-10-28T22:54:00Z', type: 'close' },
  ]);
  assert.match(html, /Se abre el tramo/);
  assert.match(html, /PR 626 entra en main \(docs\/f8\)/);
  assert.match(html, /Metas revisadas: 3 de 4/);
  assert.match(html, /dot part[\s\S]*JH 68 · s11 pregunta: which preset\?/);
  assert.match(html, /dot bad[\s\S]*orquestador · 25 min · land exit 1/);
  assert.match(html, /Se cierra el tramo/);
});
