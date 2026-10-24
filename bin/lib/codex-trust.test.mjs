import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrustFormError, moveTrust, snakeEvent, trustedPlaces } from './codex-trust.mjs';

const HOOKS = 'C:\\Users\\me\\.codex\\hooks.json';

test('snakeEvent writes a hooks.json event as Codex keys it', () => {
  assert.equal(snakeEvent('SessionStart'), 'session_start');
  assert.equal(snakeEvent('Stop'), 'stop');
  assert.equal(snakeEvent('PostToolUse'), 'post_tool_use');
});

test('trustedPlaces reads literal and basic keys, the path without case on win32, and only tables with a trusted_hash', () => {
  const text = [
    `[hooks.state.'${HOOKS}:session_start:0:0']`,
    'trusted_hash = "sha256:a"',
    '',
    `[hooks.state."${HOOKS.toUpperCase().replaceAll('\\', '\\\\')}:stop:1:0"]`,
    'trusted_hash = "sha256:b"',
    '',
    `[hooks.state.'${HOOKS}:stop:2:0']`,
    'enabled = true',
    '',
  ].join('\n');
  assert.deepEqual([...trustedPlaces(text, HOOKS, 'win32')], ['session_start:0:0', 'stop:1:0']);
  assert.deepEqual([...trustedPlaces(text, HOOKS, 'linux')], ['session_start:0:0'], 'case counts off Windows');
});

test('trustedPlaces takes no header inside a multi-line string or a multi-line array', () => {
  const text = [
    'notes = """',
    `[hooks.state.'${HOOKS}:stop:0:0']`,
    'trusted_hash = "x"',
    '"""',
    'args = [',
    '  [1, 2]',
    ']',
    `[hooks.state.'${HOOKS}:stop:1:0']`,
    'trusted_hash = "y"',
    '',
  ].join('\n');
  assert.deepEqual([...trustedPlaces(text, HOOKS, 'win32')], ['stop:1:0']);
});

test('hook trust in any form but a table header is refused, never guessed at', () => {
  for (const text of [
    '[hooks.state]\n"a:stop:0:0" = { trusted_hash = "x" }\n',
    'hooks.state."a:stop:0:0".trusted_hash = "x"\n',
    'hooks = { state = {} }\n',
    '[hooks]\nstate = {}\n',
    `[hooks.state."${HOOKS.replaceAll('\\', '\\u005c')}:stop:0:0"]\n`,
  ]) {
    assert.throws(() => trustedPlaces(text, HOOKS, 'win32'), TrustFormError, text);
    assert.throws(() => moveTrust(text, HOOKS, { stop: [-1] }, 'win32'), TrustFormError, text);
  }
  // A `hooks` key elsewhere is no hook trust.
  assert.equal(trustedPlaces('[tui]\nhooks = true\n[hooks]\nenabled = true\n', HOOKS, 'win32').size, 0);
});

test('moveTrust drops gone groups with their handlers, renames moved ones keeping the hash, and keeps every other byte', () => {
  const text = [
    'model = "gpt"',
    '',
    `[hooks.state.'${HOOKS}:stop:0:0']`,
    'trusted_hash = "sha256:gone"',
    '',
    `[hooks.state.'${HOOKS}:stop:1:0'] # mine`,
    'trusted_hash = "sha256:mine"',
    '',
    `[hooks.state.'${HOOKS}:stop:1:1']`,
    'trusted_hash = "sha256:mine-second"',
    '',
    '# about the projects',
    `[hooks.state.'${HOOKS}:stop:9:0']`,
    'trusted_hash = "sha256:no-such-place"',
    '',
    `[hooks.state.'D:\\other\\hooks.json:stop:0:0']`,
    'trusted_hash = "sha256:other"',
    '',
  ].join('\n');

  const result = moveTrust(text, HOOKS, { stop: [-1, 0] }, 'win32');

  assert.equal(result.dropped, 1);
  assert.equal(result.moved, 2);
  assert.equal(result.text, [
    'model = "gpt"',
    '',
    `[hooks.state.'${HOOKS}:stop:0:0'] # mine`,
    'trusted_hash = "sha256:mine"',
    '',
    `[hooks.state.'${HOOKS}:stop:0:1']`,
    'trusted_hash = "sha256:mine-second"',
    '',
    '# about the projects',
    `[hooks.state.'${HOOKS}:stop:9:0']`,
    'trusted_hash = "sha256:no-such-place"',
    '',
    `[hooks.state.'D:\\other\\hooks.json:stop:0:0']`,
    'trusted_hash = "sha256:other"',
    '',
  ].join('\n'));
});

test('moveTrust keeps the comments above the next header when it drops the table before them', () => {
  const text = `[hooks.state.'${HOOKS}:stop:0:0']\ntrusted_hash = "x"\n\n# the TUI\n[tui]\nx = 1\n`;
  assert.equal(moveTrust(text, HOOKS, { stop: [-1] }, 'win32').text, '# the TUI\n[tui]\nx = 1\n');
});
