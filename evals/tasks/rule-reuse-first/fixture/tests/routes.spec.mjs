import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archivePath, postPath } from '../src/posts.mjs';
import { authorPath } from '../src/authors.mjs';

test('a post is found by its year and its title', () => {
  assert.equal(postPath({ title: 'Hello, World!', date: '2026-03-14' }), '/posts/2026/hello-world');
  assert.equal(archivePath({ date: '2026-03-14' }), '/archive/2026-03');
});

test('an author is found by name', () => {
  assert.equal(authorPath({ name: 'Ana Gómez' }), '/authors/ana-gomez');
});
