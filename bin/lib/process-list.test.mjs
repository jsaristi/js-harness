import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCommandLines, listingScript } from './process-list.mjs';

// The process listing the board and `quiet` share (odd/tasks/quiet-machine.md, L3).

test('the listing script filters the command lines by the pattern it is given, inside single quotes', () => {
  const script = listingScript(String.raw`merge-queue|codex`);
  assert.ok(script.includes(String.raw`if (-not $line -or $line -notmatch 'merge-queue|codex') { continue }`));
  assert.ok(script.includes(`'OK' + [char]9 + $written`));
});

test('a pattern with a single quote is refused before anything runs', () => {
  let ran = false;
  assert.throws(() => listCommandLines(() => { ran = true; return { status: 0, stdout: '' }; }, 'win32', "it's"), /no single quote/);
  assert.equal(ran, false);
});

test('a listing that could not run, or did not finish, throws: none is never read from could not look', () => {
  assert.throws(() => listCommandLines(() => ({ error: new Error('spawn powershell ENOENT') }), 'win32', 'x'), /ENOENT/);
  assert.throws(() => listCommandLines(() => ({ status: 0, stdout: 'C\t1\tnode x\n' }), 'win32', 'x'), /did not finish/);
  assert.throws(() => listCommandLines(() => ({ status: 1, stderr: 'ps: bad option\n' }), 'linux', 'x'), /ps: bad option/);
  assert.deepEqual(listCommandLines(() => ({ status: 0, stdout: '  7 node merge-queue.mjs --land\n' }), 'linux', 'x'), [{ pid: 7, createdAt: null, commandLine: 'node merge-queue.mjs --land' }]);
});
