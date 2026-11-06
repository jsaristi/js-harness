import test from 'node:test';
import assert from 'node:assert/strict';
import { lastLineWith } from './stop-wake.mjs';

// The transcript search the reply hook's checks share (odd/tasks/reply-hook-latency.md, T3). It searches forwards a
// window at a time from the end, where it used to walk back with `lastIndexOf`: the answer must be the one that walk
// gave, so the walk is kept here as the reference and both read the same texts. The wake check itself is tested
// through the hook, in bin/reply.test.mjs.

/** The search as it was before the windows: the reference. */
function walkedBack(text, needle, accept) {
  let at = text.lastIndexOf(needle);
  while (at >= 0) {
    const start = text.lastIndexOf('\n', at) + 1;
    const end = text.indexOf('\n', at);
    let entry = null;
    try {
      entry = JSON.parse(text.slice(start, end < 0 ? undefined : end));
    } catch {
      // A torn or quoted line is no entry.
    }
    if (entry !== null && accept(entry)) return { entry, start };
    if (start === 0) return null;
    at = text.lastIndexOf(needle, start - 1);
  }
  return null;
}

/** Numbers from a fixed seed, so a failure is the same at every run. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const NEEDLE = 'nothing will wake this session';

/** A text of about `chars` characters of JSON lines, accented, some holding the needle (some twice), some torn. */
function textOf(random, chars) {
  const lines = [];
  let size = 0;
  for (let i = 0; size < chars; i += 1) {
    const pad = 'á'.repeat(Math.floor(random() * 3000));
    const roll = random();
    let written;
    if (roll < 0.002) written = JSON.stringify({ i, keep: random() < 0.5, said: `${pad}${NEEDLE}` });
    else if (roll < 0.003) written = JSON.stringify({ i, keep: random() < 0.5, said: `${NEEDLE} ${pad} ${NEEDLE}` });
    else if (roll < 0.004) written = `{"i":${i},"torn":"${NEEDLE}`;
    else written = JSON.stringify({ i, pad });
    lines.push(written);
    size += written.length + 1;
  }
  return `${lines.join('\n')}\n`;
}

test('lastLineWith gives what the backwards walk gave, across windows, on texts of several megabytes', () => {
  const random = seeded(116);
  for (let round = 0; round < 6; round += 1) {
    const text = textOf(random, 1_500_000 + Math.floor(random() * 2_500_000));
    for (const accept of [(entry) => entry.keep === true, () => true, () => false]) {
      assert.deepEqual(lastLineWith(text, NEEDLE, accept), walkedBack(text, NEEDLE, accept), `round ${round}`);
    }
  }
});

test('a needle cut by a window edge at any of its characters is found whole', () => {
  // The first line holds the needle, and the filler after it is sized so that a window of `edge` characters back from
  // the end starts at each character of the needle in turn, and just before and after it. The module's window is
  // 1 << 20; the other sizes hold the search whatever its window.
  const head = JSON.stringify({ keep: true, said: NEEDLE });
  const at = head.indexOf(NEEDLE);
  const wrapper = JSON.stringify({ pad: '' }).length;
  for (const edge of [1 << 16, 1 << 20]) {
    for (let k = -2; k <= NEEDLE.length + 2; k += 1) {
      // text.length - edge === at + k, with text = head \n filler \n.
      const text = `${head}\n${JSON.stringify({ pad: 'é'.repeat(edge + at + k - head.length - 2 - wrapper) })}\n`;
      assert.equal(text.length - edge, at + k);
      assert.deepEqual(lastLineWith(text, NEEDLE, (entry) => entry.keep), { entry: JSON.parse(head), start: 0 }, `edge ${edge}, offset ${k}`);
    }
  }
});

test('each line is judged once, newest first, and a line that is no JSON is passed over', () => {
  const lines = [
    JSON.stringify({ n: 1, said: NEEDLE }),
    `{"torn":"${NEEDLE}`,
    JSON.stringify({ n: 2, said: `${NEEDLE} and ${NEEDLE}` }),
    JSON.stringify({ n: 3, said: 'none' }),
  ];
  const text = `${lines.join('\n')}\n`;
  const judged = [];
  const found = lastLineWith(text, NEEDLE, (entry) => {
    judged.push(entry.n);
    return entry.n === 1;
  });
  assert.deepEqual(judged, [2, 1], 'the line holding the needle twice is judged once');
  assert.deepEqual(found, { entry: JSON.parse(lines[0]), start: 0 });
  assert.equal(lastLineWith(text, 'absent', () => true), null);
  assert.equal(lastLineWith('', NEEDLE, () => true), null);
});

test('an empty needle is in every line, and the newest line accepted is found', () => {
  // Every position holds it, so the search must still move on at the end of a window (the verifier's finding: it did
  // not, and the hook ran out of memory on a tool call whose id was empty). The walk is no reference here: on a text
  // that ends in a newline it stays on the empty last line for ever.
  const text = '{"type":"user","id":1}\n{"type":"assistant"}\n{"type":"user","id":2}\ntorn {\n';
  assert.deepEqual(lastLineWith(text, '', (entry) => entry.type === 'user'), { entry: { type: 'user', id: 2 }, start: 44 });
  assert.deepEqual(lastLineWith(text, '', (entry) => entry.type === 'assistant'), { entry: { type: 'assistant' }, start: 23 });
  assert.equal(lastLineWith(text, '', () => false), null);
  assert.equal(lastLineWith('', '', () => true), null);
  assert.deepEqual(lastLineWith('{"a":1}', '', () => true), { entry: { a: 1 }, start: 0 });
});
