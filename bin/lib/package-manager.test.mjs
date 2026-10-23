import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { npmCliOf } from './package-manager.mjs';

test('npmCliOf is the npm beside the node that runs js-harness, and null where that file is not there', () => {
  const win = path.join('C:', 'nvm4w', 'nodejs', 'node.exe');
  const posix = path.join('/opt', 'node', 'bin', 'node');
  const winCli = path.join('C:', 'nvm4w', 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const posixCli = path.join('/opt', 'node', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.equal(npmCliOf(win, 'win32', (file) => file === winCli), winCli);
  assert.equal(npmCliOf(posix, 'linux', (file) => file === posixCli), posixCli);
  assert.equal(npmCliOf(posix, 'linux', () => false), null);
});
