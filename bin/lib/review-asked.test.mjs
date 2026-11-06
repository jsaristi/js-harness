import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { AskedError, askedIntent } from './review-asked.mjs';
import { requestIntent, reviewIntent } from './codex-review-prompt.mjs';

const DOC = '# F\n\n## Goal\nMeasure every attempt.\n\n## Done when\n- `npm run check` exits 0\n';
const files = (byPath) => (file) => {
  if (!(file in byPath)) throw Object.assign(new Error('no such file'), { code: 'ENOENT' });
  return byPath[file];
};

test('askedIntent gives the request as written, the feature document read from cwd, or null with neither', () => {
  const cwd = path.resolve('/repo');
  const read = files({ [path.resolve(cwd, 'odd/f.md')]: DOC });
  assert.deepEqual(askedIntent({ request: ' fix the wait ', cwd }, read), requestIntent('fix the wait'));
  assert.deepEqual(askedIntent({ doc: 'odd/f.md', cwd }, read), reviewIntent(DOC));
  assert.equal(askedIntent({ cwd }, read), null);
});

test('askedIntent names the flag and what is wrong: a document unread or with no intent, an empty request', () => {
  const cwd = path.resolve('/repo');
  const read = files({ [path.resolve(cwd, 'notes.md')]: '# Notes\n' });
  assert.throws(() => askedIntent({ doc: 'gone.md', cwd }, read), (err) => err instanceof AskedError && /^--doc gone\.md: cannot read it \(ENOENT\)$/.test(err.message));
  assert.throws(() => askedIntent({ doc: 'notes.md', cwd }, read), (err) => err instanceof AskedError && /^--doc notes\.md: .*no `## Goal` heading/.test(err.message));
  assert.throws(() => askedIntent({ request: '  ', cwd }, read), (err) => err instanceof AskedError && /^--request: The request is empty/.test(err.message));
  assert.throws(() => askedIntent({ doc: 'notes.md', request: 'fix it', cwd }, read), (err) => err instanceof AskedError && /^--doc and --request do not go together/.test(err.message));
});
