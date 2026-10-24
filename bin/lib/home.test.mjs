import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { harnessHome, homeIsSet } from './home.mjs';

const cwd = path.resolve('work', 'project');
const userHome = path.resolve('users', 'someone');
const homedir = () => userHome;

test('the --home flag wins over JS_HARNESS_HOME', () => {
  const home = harnessHome({ given: path.resolve('flag'), env: { JS_HARNESS_HOME: path.resolve('env') }, cwd, homedir });
  assert.equal(home, path.resolve('flag'));
});

test('JS_HARNESS_HOME is used when the flag is not given', () => {
  assert.equal(harnessHome({ env: { JS_HARNESS_HOME: path.resolve('env') }, cwd, homedir }), path.resolve('env'));
  assert.equal(harnessHome({ given: undefined, env: { JS_HARNESS_HOME: path.resolve('env') }, cwd, homedir }), path.resolve('env'));
});

test('an empty JS_HARNESS_HOME is unset: the user home is used, never the working directory', () => {
  assert.equal(harnessHome({ env: { JS_HARNESS_HOME: '' }, cwd, homedir }), userHome);
  assert.equal(harnessHome({ env: {}, cwd, homedir }), userHome);
});

test('an empty --home is unset too: the next source is used', () => {
  assert.equal(harnessHome({ given: '', env: { JS_HARNESS_HOME: path.resolve('env') }, cwd, homedir }), path.resolve('env'));
  assert.equal(harnessHome({ given: '', env: { JS_HARNESS_HOME: '' }, cwd, homedir }), userHome);
});

test('a relative value resolves against the working directory, from the flag or the environment', () => {
  assert.equal(harnessHome({ given: 'rel', env: {}, cwd, homedir }), path.resolve(cwd, 'rel'));
  assert.equal(harnessHome({ env: { JS_HARNESS_HOME: 'rel' }, cwd, homedir }), path.resolve(cwd, 'rel'));
});

test('the fallback is homedir(), resolved like any other value', () => {
  let asked = 0;
  const home = harnessHome({ env: {}, cwd, homedir: () => { asked += 1; return 'relative-home'; } });
  assert.equal(asked, 1);
  assert.equal(home, path.resolve(cwd, 'relative-home'));
});

test('homeIsSet is true only for a non-empty JS_HARNESS_HOME', () => {
  assert.equal(homeIsSet({ JS_HARNESS_HOME: path.resolve('env') }), true);
  assert.equal(homeIsSet({ JS_HARNESS_HOME: '' }), false);
  assert.equal(homeIsSet({}), false);
});
