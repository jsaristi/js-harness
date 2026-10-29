import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateOf, featureFacts, featureNumbers, featureView, prsOf, renderFeature } from './report-feature.mjs';

const DOC = [
  '# visual-pages',
  '',
  'Branch `feat/visual-pages`, from main (62315e61). Runner: `node --test`. Session JH 79.',
  '',
  '## Goal',
  'Pages.',
  '',
  '## Done when',
  '- `npm run check` exits 0.',
  '- `node --test bin/report.test.mjs` exits 0.',
  '- He reads the page.',
  '',
  '## Specs',
  '1. The percent of the planned that was met',
  '   and the map.',
  '2. The harness shows <almost> everything this way.',
  '',
  '## Tasks',
  '- [x] T1 (kind: design) the design.',
  '- [ ] T2 (kind: build) the page.',
  '',
  '## Log',
  '- L1. His request.',
].join('\n');

const at = (iso) => Date.parse(iso);
const MERGES = [
  { hash: 'm3', at: at('2026-10-29T06:29:00Z'), subject: 'Merge pull request #647 from feat/visual-pages-board', commits: [{ hash: 'c3', at: at('2026-10-29T01:00:00Z') }] },
  { hash: 'm9', at: at('2026-10-29T05:00:00Z'), subject: 'Merge pull request #649 from feat/templates-a', commits: [{ hash: 'x1', at: at('2026-10-29T04:00:00Z') }] },
  { hash: 'm2', at: at('2026-10-29T03:00:00Z'), subject: 'Merge pull request #645 from jsaristi/feat/visual-pages', commits: [{ hash: 'c2', at: at('2026-10-28T23:00:00Z') }] },
  { hash: 'm1', at: at('2026-10-29T00:10:00Z'), subject: 'Merge pull request #643 from feat/visual-pages', commits: [{ hash: 'c1', at: at('2026-10-28T22:00:00Z') }] },
  { hash: 'm4', at: at('2026-10-29T02:00:00Z'), subject: 'Merge pull request #645 from feat/visual-pages', commits: [{ hash: 'c2b', at: at('2026-10-29T01:30:00Z') }] },
];

test('the facts of a feature document: its specs by number, its done-when commands, its tasks, branch and session', () => {
  const facts = featureFacts(DOC);
  assert.deepEqual(facts.specs, [{ n: 1, text: 'The percent of the planned that was met and the map.' }, { n: 2, text: 'The harness shows <almost> everything this way.' }]);
  assert.deepEqual(facts.commands, ['npm run check', 'node --test bin/report.test.mjs']);
  assert.deepEqual(facts.tasks, { done: 1, total: 2 });
  assert.deepEqual(facts.branches, ['feat/visual-pages']);
  assert.equal(facts.session, 'JH 79');
});

test('a document with no head line names no branch and no session', () => {
  const facts = featureFacts('# x\n\n## Specs\n1. One.\n');
  assert.deepEqual(facts.branches, []);
  assert.equal(facts.session, null);
});

test('its pull requests are the merges of its branch, its slices and an owner prefix, grouped by number, oldest first', () => {
  const prs = prsOf(MERGES, { branches: ['feat/visual-pages'], numbers: [] });
  assert.deepEqual(prs.map((pr) => [pr.number, pr.branch, pr.commits.map((one) => one.hash)]), [
    [643, 'feat/visual-pages', ['c1']],
    [645, 'feat/visual-pages', ['c2b', 'c2']],
    [647, 'feat/visual-pages-board', ['c3']],
  ]);
  assert.equal(prs[1].at, at('2026-10-29T03:00:00Z'));
  assert.deepEqual(prs[1].merges, ['m4', 'm2']);
  assert.deepEqual(prsOf(MERGES, { branches: [], numbers: [649] }).map((pr) => pr.number), [649]);
});

test('a history whose merges name no pull request, or none of the feature, is unknown with why', () => {
  assert.match(prsOf([{ hash: 'a', at: 1, subject: 'Merge branch x', commits: [] }], { branches: ['feat/visual-pages'], numbers: [] }).unknown, /no merge of the default branch names a pull request/);
  assert.match(prsOf(MERGES, { branches: ['feat/other'], numbers: [] }).unknown, /none of them is of feat\/other/);
});

test('the estimate is the plan items of the document\'s session, declared or bound, summed; none is null', () => {
  const events = [
    { event: 'open', id: 's1', plan: { items: [{ id: 'W1', hours: [2, 4], session: 'JH 79' }, { id: 'W2', hours: [1, 2], session: null }, { id: 'W3', hours: [5, 6], session: 'JH 80' }] } },
    { event: 'bind', id: 's1', item: 'W2', session: 'JH 79' },
  ];
  assert.deepEqual(estimateOf(events, 'JH 79'), { hours: [3, 6], items: ['W1', 'W2'] });
  assert.equal(estimateOf(events, 'JH 81'), null);
  assert.equal(estimateOf(events, null), null);
});

const RECORDS = {
  codexReviews: [
    { head: 'c3', outcome: 'reviewed' },
    { head: 'c1', outcome: 'reviewed' },
    { head: 'x1', outcome: 'reviewed' },
  ],
  codexRuns: [
    { id: 'r1', head: 'c3', usage: { inputTokens: 1000, cachedInputTokens: 400 }, verdict: 'incorrect' },
    { id: 'r2', head: 'c3', usage: { inputTokens: 500, cachedInputTokens: 100 }, verdict: 'correct' },
    { id: 'r3', head: 'c1' },
    { id: 'r4', head: 'x1', usage: { inputTokens: 9, cachedInputTokens: 0 } },
  ],
  lensReviews: [{ head: 'c2', outcome: 'reviewed', results: [{ lens: 'reliability', inputTokens: 300, outputTokens: 20, costUsd: 0.25 }, { lens: 'resilience', inputTokens: 100, outputTokens: 10, costUsd: null }] }],
};

const MAP_BEFORE = { done: 1, total: 4, phases: [{ title: 'F1', done: 1, total: 2, open: ['b'] }, { title: 'F2', done: 0, total: 2, open: ['c', 'd'] }] };
const MAP_AFTER = { done: 3, total: 4, phases: [{ title: 'F1', done: 2, total: 2, open: [] }, { title: 'F2', done: 1, total: 2, open: ['d'] }] };

function view(over = {}) {
  const facts = featureFacts(DOC);
  return featureView({
    path: 'odd/tasks/visual-pages.md',
    facts,
    prs: prsOf(MERGES, { branches: facts.branches, numbers: [] }),
    ...RECORDS,
    estimate: { hours: [3, 6], items: ['W1', 'W2'] },
    failures: [{ startedAt: '2026-10-29T02:00:00Z', result: 'fail', cwd: 'D:/w/visual-pages', failing: ['a test'] }],
    before: { commit: 'b0', map: MAP_BEFORE },
    after: { commit: 'm3', map: MAP_AFTER },
    ...over,
  });
}

test('the view counts time, reviews and spend over the feature\'s own commits, never another feature\'s', () => {
  const v = view();
  assert.equal(v.time.realHours, 8.5);
  assert.deepEqual(v.time.estimate, { hours: [3, 6], items: ['W1', 'W2'] });
  assert.deepEqual(v.reviews.codex, { reviewed: 2 });
  assert.deepEqual(v.reviews.lens, { reviewed: 1 });
  assert.deepEqual(v.reviews.attempts, { runs: 3, byVerdict: { incorrect: 1, correct: 1, unknown: 1 } });
  assert.equal(v.reviews.covered, 2);
  assert.equal(v.reviews.commits, 4);
  assert.deepEqual(v.spend.codex, { inputTokens: 1500, cachedInputTokens: 500, unknownRuns: 1 });
  assert.deepEqual(v.spend.lens, { inputTokens: 400, outputTokens: 30, costUsd: 0.25, unknownCost: 1 });
  assert.equal(v.failures.length, 1);
  assert.deepEqual(v.map.total, { before: { done: 1, total: 4 }, after: { done: 3, total: 4 } });
});

test('the page says promised against delivered, the pull requests, time, reviews, spend, failures and the map, in Spanish', () => {
  const html = renderFeature(view());
  assert.match(html, /^<title>Cierre de visual-pages<\/title>/);
  assert.match(html, /1\. The percent of the planned that was met and the map\./);
  assert.match(html, /The harness shows &lt;almost&gt; everything/);
  assert.match(html, /1 de 2 tareas/);
  assert.match(html, /npm run check[\s\S]*no los corre esta página/);
  assert.match(html, /PR 643[\s\S]*PR 645[\s\S]*PR 647/);
  assert.match(html, /8\.5 h[\s\S]*3–6 h estimadas \(W1, W2\)/);
  assert.match(html, /2 de 4 commits/);
  assert.match(html, /1\.500 tokens de entrada[\s\S]*500 en caché[\s\S]*1 corrida sin medir/);
  assert.match(html, /US\$ 0\.25[\s\S]*1 lente sin costo registrado/);
  assert.match(html, /Las evaluaciones y los tokens de la sesión no se miden/);
  assert.match(html, /a test/);
  assert.match(html, /F1[\s\S]*1\/2[\s\S]*2\/2 · 100 %/);
});

test('what the records cannot tell is said, never invented: no estimate, unknown pull requests, no map before', () => {
  const html = renderFeature(view({ estimate: null, prs: { unknown: 'no merge of the default branch names a pull request' }, before: { commit: 'b0', unavailable: 'bad object' }, failures: [] }));
  assert.match(html, /sin estimado registrado/);
  assert.match(html, /No se sabe qué pull requests son suyos: no merge of the default branch names a pull request/);
  assert.match(html, /Ningún gate falló/);
  assert.match(html, /sin un antes: b0: bad object/);
});

test('the numbers a feature page keeps: delivered, time, reviews, spend and the map now', () => {
  const numbers = featureNumbers(view());
  assert.deepEqual(numbers, { tasks: { done: 1, total: 2 }, prs: 3, realHours: 8.5, estimate: [3, 6], covered: 2, commits: 4, codexInputTokens: 1500, lensCostUsd: 0.25, failures: 1, map: { done: 3, total: 4 } });
});
