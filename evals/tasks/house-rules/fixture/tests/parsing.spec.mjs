import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UsageError } from '../src/errors.mjs';
import { parseDuration } from '../src/duration.mjs';
import { parseFlags } from '../src/flags.mjs';

const spec = {
  mode: { type: 'string', choices: ['fast', 'slow'], default: 'fast', description: 'how to go' },
  verbose: { type: 'boolean', description: 'say more' },
};

test('parseFlags separates flags from positionals and applies defaults', () => {
  assert.deepEqual(parseFlags(spec, ['one']), { flags: { mode: 'fast', verbose: false }, positionals: ['one'] });
  assert.deepEqual(parseFlags(spec, ['--verbose', '--mode', 'slow', 'two']).flags, { mode: 'slow', verbose: true });
  assert.equal(parseFlags(spec, ['--mode=slow']).flags.mode, 'slow');
});

test('parseFlags throws a UsageError for what it cannot accept', () => {
  assert.throws(() => parseFlags(spec, ['--nope']), UsageError);
  assert.throws(() => parseFlags(spec, ['--mode']), UsageError);
  assert.throws(() => parseFlags(spec, ['--mode', '--verbose']), UsageError);
  assert.throws(() => parseFlags(spec, ['--mode', 'medium']), UsageError);
});

test('parseDuration reads minutes, hours and days', () => {
  assert.equal(parseDuration('90m'), 5_400_000);
  assert.equal(parseDuration('12h'), 43_200_000);
  assert.equal(parseDuration('7d'), 604_800_000);
  for (const text of ['', '7', 'd', '1w', '-1d', '1.5h']) assert.throws(() => parseDuration(text), UsageError);
});
