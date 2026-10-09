import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, withStateFile } from './helpers.mjs';

test('receive, issue and list print the items and exit 0', () =>
  withStateFile(async (file) => {
    assert.equal((await run(file, ['receive', 'BOLT-M8', '40', 'Bolt M8'])).code, 0);
    const issued = await run(file, ['issue', 'BOLT-M8', '15']);
    assert.equal(issued.code, 0);
    assert.match(issued.out, /^BOLT-M8\s+25 {2}Bolt M8$/);
    assert.equal((await run(file, ['list'])).out, issued.out);
  }));

test('a value that is not what the command takes is one line on stderr and exit 1, and nothing is stored', () =>
  withStateFile(async (file) => {
    const refused = await run(file, ['receive', 'bolt', '40', 'Bolt M8']);
    assert.deepEqual([refused.code, refused.out], [1, '']);
    assert.match(refused.err, /^stockroom: not a SKU: "bolt"$/);
    assert.equal((await run(file, ['issue', 'BOLT-M8', '1'])).code, 1);
    await assert.rejects(fs.access(file));
  }));

test('snapshot copies the state file under the name it is given, and takes a plain name only', () =>
  withStateFile(async (file, dir) => {
    await run(file, ['receive', 'BOLT-M8', '40', 'Bolt M8']);
    const done = await run(file, ['snapshot', 'monday']);
    assert.equal(done.code, 0, done.err);
    assert.equal(await fs.readFile(path.join(dir, 'snapshots', 'monday.json'), 'utf8'), await fs.readFile(file, 'utf8'));
    const refused = await run(file, ['snapshot', '../monday']);
    assert.equal(refused.code, 1);
    assert.match(refused.err, /not a file name/);
    assert.deepEqual((await fs.readdir(dir)).sort(), ['snapshots', 'stockroom.json']);
  }));

test('what is no command prints the usage and exits 2', () =>
  withStateFile(async (file) => {
    const unknown = await run(file, ['restock']);
    assert.equal(unknown.code, 2);
    assert.match(unknown.err, /^Usage: stockroom <command>/);
  }));
