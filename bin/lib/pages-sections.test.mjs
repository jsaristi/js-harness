import assert from 'node:assert/strict';
import test from 'node:test';
import { mapNowSection, mapSection, planSections, sharesTiles, stepsByState, timelineSection } from './pages-sections.mjs';

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

test('what is left in a phase shows each item\'s first sentence, cut short, the rest folded', () => {
  const long = `Visual pages: the harness shows its moments as pages. ${'More words here and there. '.repeat(20)}`;
  const longFirst = `${'a'.repeat(300)}. Then.`;
  const html = mapSection({ total: { before: null, after: { done: 1, total: 3 } }, phases: [{ title: 'A', before: null, after: { done: 1, total: 3 }, open: [long, 'Short one', longFirst], change: 'same' }] });
  assert.match(html, /<details><summary>Visual pages: the harness shows its moments as pages\.<\/summary>[\s\S]*More words here/);
  assert.match(html, /<li>Short one<\/li>/);
  // The reliability review, R3-001: an item of one sentence with blanks at its edges is that sentence, not a fold of itself.
  const padded = mapSection({ total: { before: null, after: { done: 0, total: 1 } }, phases: [{ title: 'A', before: null, after: { done: 0, total: 1 }, open: ['  One sentence only.  '], change: 'same' }] });
  assert.match(padded, /<li>One sentence only\.<\/li>/);
  assert.doesNotMatch(padded, /<details>/);
  const [, summary] = /<summary>(a+…)<\/summary>/.exec(html);
  assert.ok(summary.length <= 160, `cut to about 160 characters: ${summary.length}`);
  const now = mapNowSection({ done: 1, total: 2, phases: [{ title: 'A', done: 1, total: 2, open: [long] }] });
  assert.match(now, /<details><summary>Visual pages: the harness shows its moments as pages\.<\/summary>/);
});

// odd/tasks/stretch-protocol.md, spec 7: the F8 phase's items open "2. ", and the summary stopped at the number.
test('a left item numbered "2. " is summarised by its first sentence, number included, not by the number alone', () => {
  const item = '2. His decisions from [the register](proposals/harness-diet.md#1-what-is-his), split by kind. Blocking, asked one at a time.';
  const html = mapNowSection({ done: 0, total: 1, phases: [{ title: 'F8', done: 0, total: 1, open: [item] }] });
  assert.match(html, /<summary>2\. His decisions from \[the register\]\(proposals\/harness-diet\.md#1-what-is-his\), split by kind\.<\/summary>/);
  assert.doesNotMatch(html, /<summary>2\.<\/summary>/);
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
  // Spec 7: only the steps that changed are rows; the rest are one line of their titles.
  assert.doesNotMatch(section.html, /<td[^>]*>S0<\/td>/);
  assert.match(section.html, /Sin cambio \(1\): S0 Baseline/);
});

test('a step\'s long State is folded under its first sentence, and a plan with no step changed says so', () => {
  const long = `done 2026-10-29 (PRs 622, 638). ${'More of the record here. '.repeat(30)}`;
  const [section] = planSections([{ name: 'F8 plan', steps: [
    { id: 'S5c-a', title: 'S5c-a Coverage', before: { said: 'in progress', reported: 'in progress' }, after: { said: long, reported: 'done' }, change: 'advanced', documents: [] },
  ] }]);
  assert.match(section.html, /<details><summary>done 2026-10-29 \(PRs 622, 638\)\.<\/summary>/);
  const [still] = planSections([{ name: 'F8 plan', steps: [{ id: 'S0', title: 'S0 Baseline', before: { said: 'done', reported: 'done' }, after: { said: 'done', reported: 'done' }, change: 'same', documents: [] }] }]);
  assert.match(still.html, /Ningún paso cambió/);
  assert.doesNotMatch(still.html, /<table>/);
  const [unmeasured] = planSections([{ name: 'F8 plan', steps: [{ id: 'S0', title: 'S0 Baseline', before: null, after: { said: 'done', reported: 'done' }, change: 'unmeasured', documents: [] }] }]);
  assert.match(unmeasured.html, /Sin medir \(1\): S0 Baseline/);
});

test('a plan\'s steps grouped by the state the roadmap reports, each group its count and its steps by title', () => {
  const html = stepsByState([
    { id: 'S0', title: 'S0 Baseline', reported: 'done' }, { id: 'S3', title: 'S3 <Split>', reported: 'built' },
    { id: 'S9', title: 'S9 Host watch', reported: 'in progress' }, { id: 'S8', title: 'S8 Certification', reported: 'to do' },
    { id: 'S4a', title: 'S4a Hook', reported: 'other' },
  ]);
  assert.match(html, /Hechos \(2\)[\s\S]*S0 Baseline · S3 &lt;Split&gt;[\s\S]*En curso \(1\)[\s\S]*S9 Host watch[\s\S]*Por hacer \(1\)[\s\S]*S8 Certification[\s\S]*Sin estado claro \(1\)[\s\S]*S4a Hook/);
  assert.match(html, /no empieza por una palabra de estado conocida[\s\S]*Cuentan en el total, no como hechos/);
  assert.doesNotMatch(stepsByState([{ id: 'S0', title: 'S0', reported: 'done' }]), /Sin estado claro|no empieza/);
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
