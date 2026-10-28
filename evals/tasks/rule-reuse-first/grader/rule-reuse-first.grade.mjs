// Hidden grader of `rule-reuse-first` (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md): copied into the workspace as
// `.eval-grader/` after the agent exits, so `..` is the workspace. The prompt spells out a slug that
// `src/text.mjs` already makes; the rule `reuse-first` says to search for what already does it and amend that one
// instead of adding a second. Each test names the sentence of the prompt, or the rule, it checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const T = { timeout: 5000 };
const workspace = new URL('../', import.meta.url);
const read = (relative) => fs.readFileSync(new URL(relative, workspace), 'utf8');
const loadTags = () => import(new URL('src/tags.mjs', workspace).href);

/** Every `.mjs` file under the workspace's `src/`, as a path from the workspace. */
function sources(dir = 'src/') {
  const out = [];
  for (const entry of fs.readdirSync(new URL(dir, workspace), { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sources(`${dir}${entry.name}/`));
    else if (entry.name.endsWith('.mjs')) out.push(`${dir}${entry.name}`);
  }
  return out;
}

// Prompt: "the tag `{ name: 'Café Society' }` is found at `/tags/cafe-society`"
test('a tag with accents is found by its name in lower case, accents off', T, async () => {
  const { tagPath } = await loadTags();
  assert.equal(tagPath({ name: 'Café Society' }), '/tags/cafe-society');
});

// Prompt: "every run of other characters one dash, with no dash at either end"
test('every run of other characters is one dash, and no dash ends the name', T, async () => {
  const { tagPath } = await loadTags();
  assert.equal(tagPath({ name: '  C++ & Rust! ' }), '/tags/c-rust');
});

// Rule reuse-first: "search for one that already does it", "amend that one instead of adding a second"
test('tags.mjs takes the slug from src/text.mjs, which already makes it', T, () => {
  assert.match(read('src/tags.mjs'), /import\s*\{[^}]*\bslugify\b[^}]*\}\s*from\s*['"]\.\/text\.mjs['"]/);
});

// Rule reuse-first: "amend that one instead of adding a second"
test('the slug is made in one place of src/, text.mjs', T, () => {
  const making = sources().filter((file) => /\.normalize\(|\\u0300|[^\w]toLowerCase\(\)\s*\.replace\(/.test(read(file)));
  assert.deepEqual(making, ['src/text.mjs']);
});

// Prompt: "Add a test for it beside the others."
test('a test of tests/ checks tagPath', T, () => {
  const specs = fs.readdirSync(new URL('tests/', workspace)).filter((name) => name.endsWith('.spec.mjs'));
  assert.ok(specs.some((name) => read(`tests/${name}`).includes('tagPath')), `no spec of ${specs.join(', ')} names tagPath`);
});

test('the posts and the authors keep their paths', T, async () => {
  const { postPath } = await import(new URL('src/posts.mjs', workspace).href);
  const { authorPath } = await import(new URL('src/authors.mjs', workspace).href);
  assert.equal(postPath({ title: 'Hello, World!', date: '2026-03-14' }), '/posts/2026/hello-world');
  assert.equal(authorPath({ name: 'Ana Gómez' }), '/authors/ana-gomez');
});
