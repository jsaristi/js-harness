import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { endsUnterminated } from './jsonl-tail.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-tail-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const fileWith = (name, text) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  return file;
};

test('a file that is missing, or empty, does not end unterminated', () => {
  assert.equal(endsUnterminated(path.join(dir, 'missing.jsonl')), false);
  assert.equal(endsUnterminated(fileWith('empty.jsonl', '')), false);
});

test('a file whose last byte is a line break does not end unterminated', () => {
  assert.equal(endsUnterminated(fileWith('whole.jsonl', '{"a":1}\n')), false);
});

test('a file whose last byte is not a line break ends unterminated', () => {
  assert.equal(endsUnterminated(fileWith('cut.jsonl', '{"a":1}\n{"b"')), true);
});

test('a descriptor that fails to close does not cost the answer, which is still given', () => {
  const file = fileWith('close.jsonl', '{"a":1}');
  const io = { ...fs, closeSync: () => { throw new Error('EIO'); } };
  assert.equal(endsUnterminated(file, io), true);
});
