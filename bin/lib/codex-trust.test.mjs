import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TrustFormError, moveTrust, planTrustMoves, snakeEvent, trustedPlaces } from './codex-trust.mjs';

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

// The shape Codex 0.166 writes (its values made up): an empty `[hooks.state]` table before the trust tables, and a
// plugin's hooks keyed by `<plugin>@<marketplace>:<hooks.json>` with a `trusted_content_hash` beside the hash.
const CODEX_0166 = [
  'model = "x"',
  '',
  '[hooks.state]',
  '',
  `[hooks.state.'${HOOKS}:session_start:0:0']`,
  'trusted_hash = "sha256:a"',
  '',
  `[hooks.state.'${HOOKS}:stop:1:0']`,
  'trusted_hash = "sha256:b"',
  '',
  '[hooks.state."engram@engram:hooks/hooks.json:session_start:0:0"]',
  'trusted_hash = "sha256:c"',
  'trusted_content_hash = "sha256:d"',
  '',
  '[tui]',
  'x = 1',
  '',
].join('\n');

test('trustedPlaces reads the shape Codex 0.166 writes: an empty [hooks.state] table, and a plugin\'s trust beside', () => {
  assert.deepEqual([...trustedPlaces(CODEX_0166, HOOKS, 'win32')], ['session_start:0:0', 'stop:1:0']);
  const { text, dropped, moved } = moveTrust(CODEX_0166, HOOKS, { stop: [-1, 0] }, 'win32');
  assert.deepEqual([dropped, moved], [0, 1]);
  assert.equal(text, CODEX_0166.replace(`${HOOKS}:stop:1:0`, `${HOOKS}:stop:0:0`), 'the empty table and the plugin\'s trust are kept as written');
});

test('hook trust in any form but a table header is refused, never guessed at', () => {
  for (const text of [
    '[hooks.state]\n"a:stop:0:0" = { trusted_hash = "x" }\n',
    '[hooks.state]\n# a comment, then a key\nenabled = true\n',
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

test('a """ or a [ inside a comment or a one-line string opens nothing, so the tables after it are read and kept', () => {
  const text = [
    '# a note with """ in it',
    "path = 'C:\\a[1'",
    'title = "say \\"\'\'\'\\""',
    `[hooks.state.'${HOOKS}:stop:0:0']`,
    'trusted_hash = "sha256:gone"',
    '',
    '[tui]',
    'x = 1',
    '',
  ].join('\n');
  assert.deepEqual([...trustedPlaces(text, HOOKS, 'win32')], ['stop:0:0']);
  const result = moveTrust(text, HOOKS, { stop: [-1] }, 'win32');
  assert.equal(result.dropped, 1);
  assert.equal(result.text, ['# a note with """ in it', "path = 'C:\\a[1'", 'title = "say \\"\'\'\'\\""', '[tui]', 'x = 1', ''].join('\n'));
});

test('moveTrust renames the key itself, never a comment after it that repeats the key\'s end', () => {
  const text = `[hooks.state.'${HOOKS}:stop:1:0'] # was :stop:1:0\ntrusted_hash = "x"\n`;
  assert.equal(moveTrust(text, HOOKS, { stop: [-1, 0] }, 'win32').text, `[hooks.state.'${HOOKS}:stop:0:0'] # was :stop:1:0\ntrusted_hash = "x"\n`);
});

test('quoted spellings of hooks.state are the same tables: a trust key is read and moved, any other form refused', () => {
  const text = `["hooks" . 'state'.'${HOOKS}:stop:1:0']\ntrusted_hash = "x"\n`;
  assert.deepEqual([...trustedPlaces(text, HOOKS, 'win32')], ['stop:1:0']);
  assert.equal(moveTrust(text, HOOKS, { stop: [-1, 0] }, 'win32').text, `["hooks" . 'state'.'${HOOKS}:stop:0:0']\ntrusted_hash = "x"\n`);
  // An empty `[hooks.state]` table, however quoted, holds no trust: it is read as Codex 0.166 writes it.
  assert.equal(trustedPlaces("['hooks'.state] # Codex's\n\n", HOOKS, 'win32').size, 0);
  for (const refused of [
    '["hooks"."state"]\n"a:stop:0:0" = { trusted_hash = "x" }\n',
    `[hooks.state.'${HOOKS}:stop:0:0'.extra]\n`,
    `[[hooks.state.'${HOOKS}:stop:0:0']]\n`,
    '["hooks"]\nstate = {}\n',
    '"hooks".state."a:stop:0:0".trusted_hash = "x"\n',
  ]) {
    assert.throws(() => trustedPlaces(refused, HOOKS, 'win32'), TrustFormError, refused);
  }
});

test('planTrustMoves gives a record that recorded no trustConfigs the config of `earlier`, only for the hooks.json it names', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-trust-plan-'));
  try {
    const ours = { hooks: [{ type: 'command', command: 'js-harness doctor' }] };
    const mine = { hooks: [{ type: 'command', command: 'mine' }] };
    const [codexHooks, other] = [path.join(dir, '.codex', 'hooks.json'), path.join(dir, 'other', 'hooks.json')];
    for (const file of [codexHooks, other]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ hooks: { Stop: [ours, mine] } }), 'utf8');
    }
    const record = (file) => ({ path: file, pointer: ['hooks', 'Stop'], entry: ours });
    const config = path.join(dir, '.codex', 'config.toml');
    const plans = planTrustMoves([record(codexHooks), record(other)], { hooksPath: codexHooks, config });
    assert.deepEqual(plans, [{ hooksPath: codexHooks, config, moves: { stop: [-1, 0] } }]);
    assert.deepEqual(planTrustMoves([record(codexHooks)]), [], 'with no earlier config, a record with none has no plan');
    const recorded = path.join(dir, 'recorded.toml');
    assert.deepEqual(planTrustMoves([{ ...record(codexHooks), trustConfigs: [recorded] }], { hooksPath: codexHooks, config }).map((plan) => plan.config), [recorded], 'what a record holds wins');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
