import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unknownArgument } from './args.mjs';

const known = { valued: ['--home', '--cwd'], bare: ['--hook', '--json'] };

test('known flags and the values after valued ones pass', () => {
  assert.equal(unknownArgument(['--hook', '--home', 'x', '--json', '--cwd', '-1'], known), null);
  assert.equal(unknownArgument([], known), null);
});

test('a token starting with -- after a valued flag is no value of it, as requireValue reads it', () => {
  // `--home --cwd x`: the command's own parse then says --home requires a value.
  assert.equal(unknownArgument(['--home', '--cwd', 'x'], known), null);
  assert.equal(unknownArgument(['--home', '--bogus'], known), '--bogus');
});

test('the first flag it does not know is returned, wherever it stands', () => {
  assert.equal(unknownArgument(['--hook', '--bogus', '--other'], known), '--bogus');
  assert.equal(unknownArgument(['--help'], known), '--help');
  assert.equal(unknownArgument(['-h'], known), '-h');
});

test('a word that is no flag is unknown unless positionals are allowed', () => {
  assert.equal(unknownArgument(['--hook', 'stray'], known), 'stray');
  assert.equal(unknownArgument(['stray', '--hook'], { ...known, positional: true }), null);
  assert.equal(unknownArgument(['stray', '--nope'], { ...known, positional: true }), '--nope');
});

test('a valued flag at the end consumes nothing and is not unknown', () => {
  assert.equal(unknownArgument(['--home'], known), null);
});
