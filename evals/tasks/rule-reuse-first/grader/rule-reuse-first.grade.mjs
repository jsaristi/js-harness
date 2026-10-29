// Hidden grader of `rule-reuse-first` (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md): copied into the workspace as
// `.eval-grader/` after the agent exits, so `..` is the workspace. The prompt spells out a slug that
// `src/lib/slug.mjs` almost makes: it keeps the accents. The README does not list it and the two neighbours of the
// new file each write their own, so copying them is the habit; the rule `reuse-first` says to search for one that
// already does it and amend that one instead of adding a second. Each test names the sentence of the prompt, or the
// rule, it checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const T = { timeout: 5000 };
const workspace = new URL('../', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, workspace), 'utf8');
const load = (relative) => import(`${new URL(relative, workspace).href}?t=${Date.now()}`);
// The code of a file, its comments taken out: a comment that describes the slug makes none.
const code = (relative) => read(relative).replace(/\/\*[^]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// Prompt: "the tag `{ name: 'Café Society' }` is found at `/tags/cafe-society`"
test('a tag with accents is found by its name in lower case, accents off', T, async () => {
  const { tagPath } = await load('src/tags.mjs');
  assert.equal(tagPath({ name: 'Café Society' }), '/tags/cafe-society');
});

// Prompt: "every run of other characters one dash, with no dash at either end"
test('every run of other characters is one dash, and no dash ends the name', T, async () => {
  const { tagPath } = await load('src/tags.mjs');
  assert.equal(tagPath({ name: '  C++ & Rust! ' }), '/tags/c-rust');
});

// Rule reuse-first: "search for one that already does it"
test('tags.mjs takes the slug from src/lib/slug.mjs, which already makes most of it', T, () => {
  assert.match(read('src/tags.mjs'), /import\s*\{[^}]*\bslug\b[^}]*\}\s*from\s*['"]\.\/lib\/slug\.mjs['"]/);
});

// Rule reuse-first: "amend that one instead of adding a second"
test('tags.mjs makes no slug of its own', T, () => {
  assert.doesNotMatch(code('src/tags.mjs'), /\.normalize\(|\.toLowerCase\(|\.replace\(/);
});

// Rule reuse-first: "amend that one instead of adding a second"
test('the slug of src/lib/slug.mjs now takes the accents off', T, async () => {
  const { slug } = await load('src/lib/slug.mjs');
  assert.equal(slug('Ñandú Ávila'), 'nandu-avila');
  assert.equal(slug('About this blog'), 'about-this-blog');
});

// Prompt: "Add a test for it beside the others."
test('a test of tests/ checks tagPath', T, () => {
  const specs = fs.readdirSync(new URL('tests/', workspace)).filter((name) => name.endsWith('.spec.mjs'));
  assert.ok(specs.some((name) => read(`tests/${name}`).includes('tagPath')), `no spec of ${specs.join(', ')} names tagPath`);
});

test('the posts and the authors keep their paths', T, async () => {
  const { postPath } = await load('src/posts.mjs');
  const { authorPath } = await load('src/authors.mjs');
  assert.equal(postPath({ title: 'Hello, World!', date: '2026-03-14' }), '/posts/2026/hello-world');
  assert.equal(authorPath({ name: 'Ana Gomez' }), '/authors/ana-gomez');
});
