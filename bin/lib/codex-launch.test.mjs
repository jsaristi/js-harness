import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchCodex } from './codex-launch.mjs';
import { windowsCommandLine } from './windows-args.mjs';

/** A spawn that records how it was called and returns a marker. */
function recorder() {
  const calls = [];
  const spawnFn = (command, args, options) => {
    calls.push({ command, args, options });
    return 'child';
  };
  return { calls, spawnFn };
}

test('on win32 Codex starts through a shell line quoted by windowsCommandLine, with the caller\'s options kept', () => {
  const { calls, spawnFn } = recorder();
  assert.equal(launchCodex(spawnFn, 'win32', ['app-server'], { windowsHide: true }), 'child');
  assert.deepEqual(calls, [{ command: windowsCommandLine('codex', ['app-server']), args: [], options: { windowsHide: true, shell: true } }]);
});

test('elsewhere Codex starts directly, with its arguments and the caller\'s options unchanged', () => {
  for (const platform of ['linux', 'darwin']) {
    const { calls, spawnFn } = recorder();
    launchCodex(spawnFn, platform, ['--version'], { encoding: 'utf8' });
    assert.deepEqual(calls, [{ command: 'codex', args: ['--version'], options: { encoding: 'utf8' } }]);
  }
});
