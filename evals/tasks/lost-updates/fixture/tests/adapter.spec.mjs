import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { nodeAdapter } from '../src/index.mjs';
import { withTempDir } from './helpers.mjs';

test('nodeAdapter reads, writes, renames and removes files', () =>
  withTempDir(async (dir) => {
    const first = path.join(dir, 'first.txt');
    const second = path.join(dir, 'second.txt');
    await nodeAdapter.writeFile(first, 'one');
    assert.equal(await nodeAdapter.readFile(first), 'one');
    await nodeAdapter.writeFile(second, 'two');
    await nodeAdapter.rename(first, second);
    assert.equal(await nodeAdapter.readFile(second), 'one');
    await nodeAdapter.unlink(second);
    await assert.rejects(nodeAdapter.readFile(second), { code: 'ENOENT' });
  }));

test('nodeAdapter rejects with the code of the failure', () =>
  withTempDir(async (dir) => {
    const missing = path.join(dir, 'missing.txt');
    await assert.rejects(nodeAdapter.readFile(missing), { code: 'ENOENT' });
    await assert.rejects(nodeAdapter.unlink(missing), { code: 'ENOENT' });
    await assert.rejects(nodeAdapter.rename(missing, path.join(dir, 'other.txt')), { code: 'ENOENT' });
  }));
