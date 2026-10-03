import { test } from 'node:test';
import assert from 'node:assert/strict';
import { satisfies } from '../src/range.mjs';

const check = (range, accepted, rejected) => {
  for (const version of accepted) assert.equal(satisfies(version, range), true, `${version} in ${range}`);
  for (const version of rejected) assert.equal(satisfies(version, range), false, `${version} in ${range}`);
};

test('exact versions and comparators', () => {
  check('1.2.3', ['1.2.3'], ['1.2.4', '1.2.2']);
  check('>=1.2.3 <1.5.0', ['1.2.3', '1.4.9'], ['1.2.2', '1.5.0']);
  check('>1.2.3', ['1.2.4'], ['1.2.3']);
});

test('caret and tilde ranges stop at the first non-zero part', () => {
  check('^1.2.3', ['1.2.3', '1.9.0'], ['1.2.2', '2.0.0']);
  check('^0.2.3', ['0.2.9'], ['0.3.0']);
  check('^0.0.3', ['0.0.3'], ['0.0.4']);
  check('~1.2.3', ['1.2.9'], ['1.3.0']);
  check('~1', ['1.9.0'], ['2.0.0']);
});

test('x-ranges, hyphen ranges and alternatives', () => {
  check('1.x', ['1.0.0', '1.8.2'], ['0.9.0', '2.0.0']);
  check('*', ['0.0.1', '7.0.0'], []);
  check('1.2.3 - 2.3', ['1.2.3', '2.3.9'], ['1.2.2', '2.4.0']);
  check('<1.0.0 || >=2.0.0 <3.0.0', ['0.5.0', '2.5.0'], ['1.5.0', '3.0.0']);
});

test('a prerelease only matches a range that names one of the same version', () => {
  check('^1.2.3', ['1.2.3'], ['1.3.0-beta.1']);
  check('>=1.3.0-alpha', ['1.3.0-beta.1', '1.3.0'], ['1.4.0-beta.1']);
  check('*', ['1.0.0'], ['2.0.0-rc.1']);
});
