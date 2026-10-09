import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFindings } from './score.mjs';

// A finding as `normalizeAnswer` gives it (bin/lib/codex-review-answer.mjs), and a defect as the key holds it.
const finding = (file, start, end = start, title = `${file}:${start}`) => ({ file, start, end, severity: 'P1', title, body: 'Why it is wrong.', confidence: 0.8 });
const defect = (id, file, start, end = start, kind = `kind-${id}`) => ({ id, kind, file, start, end, summary: `What ${id} is.` });
const keyOf = (...defects) => ({ schema: 'js-harness.review-seeded-key/v1', defects });

const ids = (entries) => entries.map((entry) => entry.id);

test('a finding on the lines of a defect, in its file, finds it', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42));
  const exact = finding('src/store.mjs', 40, 42);
  assert.deepEqual(scoreFindings([exact], key), {
    found: [{ id: 'D1', kind: 'kind-D1', finding: exact }],
    missed: [],
    extra: [],
    counts: { defects: 1, found: 1, missed: 0, extra: 0 },
    recall: 1,
  });
  // One line in common is enough, at either end, and so is a finding that holds the whole defect.
  for (const [start, end] of [[42, 60], [1, 40], [41, 41], [1, 500]]) {
    assert.deepEqual(ids(scoreFindings([finding('src/store.mjs', start, end)], key).found), ['D1'], `${start}-${end}`);
  }
});

test('a finding within the tolerance of a defect finds it, and one line further does not', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42));
  // Three lines by default, on each side: a reviewer names the statement, the key the expression in it.
  for (const [start, end] of [[37, 37], [30, 37], [45, 45], [45, 90]]) {
    const scored = scoreFindings([finding('src/store.mjs', start, end)], key);
    assert.deepEqual([ids(scored.found), scored.extra.length], [['D1'], 0], `${start}-${end}`);
  }
  for (const [start, end] of [[36, 36], [30, 36], [46, 46], [46, 90]]) {
    const outside = finding('src/store.mjs', start, end);
    assert.deepEqual(scoreFindings([outside], key), {
      found: [],
      missed: [{ id: 'D1', kind: 'kind-D1' }],
      extra: [outside],
      counts: { defects: 1, found: 0, missed: 1, extra: 1 },
      recall: 0,
    }, `${start}-${end}`);
  }
});

test('the tolerance is an option: none asks for a line in common, a larger one reaches further', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42));
  assert.deepEqual(ids(scoreFindings([finding('src/store.mjs', 43)], key, { tolerance: 0 }).found), []);
  assert.deepEqual(ids(scoreFindings([finding('src/store.mjs', 42)], key, { tolerance: 0 }).found), ['D1']);
  assert.deepEqual(ids(scoreFindings([finding('src/store.mjs', 52)], key, { tolerance: 10 }).found), ['D1']);
  assert.deepEqual(ids(scoreFindings([finding('src/store.mjs', 53)], key, { tolerance: 10 }).found), []);
  for (const tolerance of [-1, 1.5, '3', null, Number.NaN]) assert.throws(() => scoreFindings([], key, { tolerance }), /tolerance/, String(tolerance));
});

test('the same lines in another file find nothing: the file is compared whole, and with its case', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42));
  for (const file of ['src/queue.mjs', 'store.mjs', 'lib/src/store.mjs', 'src/Store.mjs', 'D:/repo/src/store.mjs']) {
    const scored = scoreFindings([finding(file, 40, 42)], key);
    assert.deepEqual([scored.counts, scored.recall], [{ defects: 1, found: 0, missed: 1, extra: 1 }, 0], file);
  }
});

test('a finding that names its file with backslashes is read as the same file, and so is a key that does', () => {
  const windows = finding('src\\lib\\store.mjs', 40);
  const scored = scoreFindings([windows], keyOf(defect('D1', 'src/lib/store.mjs', 40)));
  assert.deepEqual(scored.found, [{ id: 'D1', kind: 'kind-D1', finding: windows }]);
  assert.equal(scored.found[0].finding.file, 'src\\lib\\store.mjs', 'the finding is given back as it came');
  assert.deepEqual(ids(scoreFindings([finding('src/lib/store.mjs', 40)], keyOf(defect('D1', 'src\\lib\\store.mjs', 40))).found), ['D1']);
});

test('two findings on one defect: the defect is found once, and the other finding is an extra', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42), defect('D2', 'src/queue.mjs', 7));
  const near = finding('src/store.mjs', 44, 44, 'near');
  const on = finding('src/store.mjs', 41, 42, 'on');
  const scored = scoreFindings([near, on], key);
  // The one with more lines in common is the one that found it, whatever the order they came in.
  assert.deepEqual(scored.found, [{ id: 'D1', kind: 'kind-D1', finding: on }]);
  assert.deepEqual(scored.extra, [near]);
  assert.deepEqual(scored.missed, [{ id: 'D2', kind: 'kind-D2' }]);
  assert.deepEqual(scored.counts, { defects: 2, found: 1, missed: 1, extra: 1 });
  assert.equal(scored.recall, 0.5);
  assert.deepEqual(scoreFindings([on, near], key).found, scored.found);
  // Two that are as good as each other: the first given.
  const twin = finding('src/store.mjs', 41, 42, 'twin');
  assert.deepEqual(scoreFindings([twin, on], key).found[0].finding, twin);
  assert.deepEqual(scoreFindings([twin, on], key).extra, [on]);
});

test('one finding over two defects counts for one of them: the one it has more lines in common with', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 10, 12), defect('D2', 'src/store.mjs', 30, 39));
  const wide = finding('src/store.mjs', 11, 60);
  const scored = scoreFindings([wide], key);
  assert.deepEqual(scored.found, [{ id: 'D2', kind: 'kind-D2', finding: wide }]);
  assert.deepEqual(scored.missed, [{ id: 'D1', kind: 'kind-D1' }]);
  assert.deepEqual(scored.extra, []);
  assert.deepEqual([scored.counts, scored.recall], [{ defects: 2, found: 1, missed: 1, extra: 0 }, 0.5]);
});

test('a finding as close to two defects goes to the one whose start is nearer, then to the first in the key', () => {
  // Both within the tolerance, with as many lines in common: the nearer start decides.
  const key = keyOf(defect('far', 'a.mjs', 10, 20), defect('near', 'a.mjs', 18, 28));
  assert.deepEqual(ids(scoreFindings([finding('a.mjs', 18, 20)], key).found), ['near']);
  // As near too: the order of the key decides, so the same answer always scores the same.
  const twins = keyOf(defect('first', 'a.mjs', 10, 12), defect('second', 'a.mjs', 10, 12));
  assert.deepEqual(ids(scoreFindings([finding('a.mjs', 10, 12)], twins).found), ['first']);
  assert.deepEqual(ids(scoreFindings([finding('a.mjs', 10, 12)], keyOf(twins.defects[1], twins.defects[0])).found), ['second']);
});

test('what is found does not depend on the order of the findings, and is listed in the order of the key', () => {
  const key = keyOf(defect('D1', 'a.mjs', 5), defect('D2', 'b.mjs', 50, 55), defect('D3', 'c.mjs', 9));
  const findings = [finding('c.mjs', 9), finding('z.mjs', 1), finding('a.mjs', 6), finding('b.mjs', 300)];
  const scored = scoreFindings(findings, key);
  assert.deepEqual(ids(scored.found), ['D1', 'D3']);
  assert.deepEqual(ids(scored.missed), ['D2']);
  assert.deepEqual(scored.extra, [findings[1], findings[3]], 'the extras in the order they were given');
  assert.equal(scored.recall, 2 / 3);
  const reversed = scoreFindings([...findings].reverse(), key);
  assert.deepEqual([ids(reversed.found), ids(reversed.missed), reversed.counts], [ids(scored.found), ids(scored.missed), scored.counts]);
});

test('no finding: every defect is missed, and the recall is 0', () => {
  const key = keyOf(defect('D1', 'a.mjs', 5), defect('D2', 'b.mjs', 50));
  assert.deepEqual(scoreFindings([], key), {
    found: [],
    missed: [{ id: 'D1', kind: 'kind-D1' }, { id: 'D2', kind: 'kind-D2' }],
    extra: [],
    counts: { defects: 2, found: 0, missed: 2, extra: 0 },
    recall: 0,
  });
});

test('an empty key: every finding is an extra, and there is no recall to speak of', () => {
  const findings = [finding('a.mjs', 5), finding('b.mjs', 50)];
  assert.deepEqual(scoreFindings(findings, keyOf()), {
    found: [],
    missed: [],
    extra: findings,
    counts: { defects: 0, found: 0, missed: 0, extra: 2 },
    recall: null,
  });
  assert.equal(scoreFindings([], keyOf()).recall, null);
});

test('neither the findings nor the key are changed', () => {
  const key = keyOf(defect('D1', 'src/store.mjs', 40, 42), defect('D2', 'src/queue.mjs', 7));
  const findings = [finding('src\\store.mjs', 44), finding('src/store.mjs', 41), finding('other.mjs', 1)];
  const frozen = (value) => {
    if (value !== null && typeof value === 'object') Object.values(value).forEach(frozen);
    return Object.freeze(value);
  };
  const [keyBefore, findingsBefore] = [structuredClone(key), structuredClone(findings)];
  // Frozen all the way down, so a write would throw; and compared with what they were, for good measure.
  const scored = scoreFindings(frozen(findings), frozen(key));
  assert.deepEqual(scored.counts, { defects: 2, found: 1, missed: 1, extra: 2 });
  assert.deepEqual(key, keyBefore);
  assert.deepEqual(findings, findingsBefore);
});

test('what is not findings and a key is refused, naming which', () => {
  const key = keyOf(defect('D1', 'a.mjs', 5));
  for (const bad of [null, undefined, 'none', { findings: [] }]) assert.throws(() => scoreFindings(bad, key), /findings/, String(bad));
  for (const bad of [null, undefined, [], { defects: 'none' }, {}]) assert.throws(() => scoreFindings([], bad), /key/, JSON.stringify(bad));
});
