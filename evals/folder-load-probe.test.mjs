// The reader of the folder load probe (odd/tasks/folder-instructions.md, spec 1): the probe itself starts `claude` and
// runs only by hand, so the test holds what it reads from a transcript.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { nestedLoads } from './folder-load-probe.mjs';

test('nestedLoads gives each nested_memory attachment as a path relative to the fixture, and skips everything else', () => {
  const root = path.join('C:', 'fixture');
  const entries = [
    null,
    { type: 'user', message: { content: 'Read bin/neighbour.txt' } },
    { attachment: { type: 'instructions', files: [{ path: path.join(root, 'CLAUDE.md') }] } },
    { attachment: { type: 'nested_memory', path: path.join(root, 'bin', 'CLAUDE.md') } },
    { attachment: { type: 'nested_memory', path: path.join(root, 'odd', 'tasks', 'CLAUDE.md') } },
    { attachment: { type: 'nested_memory' } },
  ];
  assert.deepEqual(nestedLoads(entries, root), ['bin/CLAUDE.md', 'odd/tasks/CLAUDE.md']);
  assert.deepEqual(nestedLoads([], root), []);
});
