// Codex's trust of the hooks an earlier install wrote in its hooks.json (odd/tasks/codex-hook-trust.md), through the
// public commands on throwaway homes. Install writes no Codex hook any more (odd/tasks/drop-codex-components.md), so each
// test seeds a home as 0.97.0 installed it (./lib/earlier-codex.testkit.mjs): `uninstall` and `sync` take the trust of
// the entries they remove and move the trust of the user's own hooks to the places they move to. The home is never the
// real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncMain, uninstallMain } from './install.mjs';
import { install, readManifest } from './lib/manifest.mjs';
import { EARLIER_INSTALL } from './lib/earlier-codex.testkit.mjs';

function makeTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function quietly(fn) {
  const out = [];
  const err = [];
  const [log, error] = [console.log, console.error];
  console.log = (line) => out.push(String(line));
  console.error = (line) => err.push(String(line));
  try {
    return { code: await fn(), out, err };
  } finally {
    console.log = log;
    console.error = error;
  }
}

const hooksPathOf = (codexHome) => path.join(codexHome, 'hooks.json');
const readHooks = (codexHome) => JSON.parse(fs.readFileSync(hooksPathOf(codexHome), 'utf8'));
const trustHeader = (hooksPath, event, group, handler = 0) => `[hooks.state.'${hooksPath}:${event}:${group}:${handler}']`;
const trustTable = (hooksPath, event, group, hash = `sha256:${event}${group}`) => `${trustHeader(hooksPath, event, group)}\ntrusted_hash = "${hash}"\n`;

/** The `[hooks.state.'…']` tables of `text`, as `event:group:handler` → hash, for the one hooks.json `hooksPath`. */
function trustOf(text, hooksPath) {
  const found = {};
  const pattern = /^\[hooks\.state\.'(.*):([a-z_]+):(\d+):(\d+)'\]\r?\ntrusted_hash = "([^"]*)"/gm;
  for (const [, file, event, group, handler, hash] of text.matchAll(pattern)) {
    if (file === hooksPath) found[`${event}:${group}:${handler}`] = hash;
  }
  return found;
}

/** The trust Codex would record for every group of the hooks.json, as Codex keys it, each hash naming the group's
 * command, so a test sees which hook a key holds after a move. */
function trustEverything(codexHome) {
  const hooksPath = hooksPathOf(codexHome);
  const tables = [];
  for (const [event, groups] of Object.entries(readHooks(codexHome).hooks)) {
    const snake = event.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();
    groups.forEach((group, i) => tables.push(trustTable(hooksPath, snake, i, `sha256:${group.hooks[0].command}`)));
  }
  return tables.join('\n');
}

/** Installs into `home` what 0.97.0 installed, its five Codex entries recording `configs` (default the config.toml of
 * `<home>/.codex`) as the config.toml files their trust is in, one install a file, as each install then resolved it. */
function installEarlier(home, configs = [path.join(home, '.codex', 'config.toml')]) {
  for (const codexConfig of configs) install(home, '0.97.0', { ...EARLIER_INSTALL, codexConfig });
}

/** Installs what 0.96.0 and older installed: the same entries with no `trustConfigs`, which came later (c7af39e2). */
function installOlder(home) {
  install(home, '0.96.0', EARLIER_INSTALL);
  const manifest = readManifest(home);
  assert.ok(manifest.entries.every((entry) => entry.trustConfigs === undefined));
}

/** A home as an earlier install left it with the user's own Stop hook after the harness's two, and Codex's trust of
 * every group: `{ codexHome, hooksPath, config, mine }`. */
function withMineAfter(home, installed) {
  installed(home);
  const codexHome = path.join(home, '.codex');
  const hooksPath = hooksPathOf(codexHome);
  const mine = { hooks: [{ type: 'command', command: 'mine-stop' }] };
  const hooks = readHooks(codexHome);
  hooks.hooks.Stop.push(mine);
  fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2), 'utf8');
  const config = path.join(codexHome, 'config.toml');
  fs.writeFileSync(config, trustEverything(codexHome), 'utf8');
  return { codexHome, hooksPath, config, mine };
}

test('an earlier install under two CODEX_HOMEs recorded both config.toml files, and uninstall takes the trust out of both', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    const [first, second] = [path.join(home, 'codex-a'), path.join(home, 'codex-b')];
    const codexHome = path.join(home, '.codex');
    const [firstConfig, secondConfig] = [path.join(first, 'config.toml'), path.join(second, 'config.toml')];
    installEarlier(home, [firstConfig, secondConfig]);
    for (const record of readManifest(home).entries.filter((entry) => entry.path === hooksPathOf(codexHome))) {
      assert.deepEqual(record.trustConfigs, [firstConfig, secondConfig]);
    }
    for (const config of [firstConfig, secondConfig]) {
      fs.mkdirSync(path.dirname(config), { recursive: true });
      fs.writeFileSync(config, `model = "gpt"\n\n${trustEverything(codexHome)}`, 'utf8');
    }

    const { code, err } = await quietly(() => uninstallMain(['--global', '--home', home], {}));

    assert.equal(code, 0, err.join('\n'));
    for (const config of [firstConfig, secondConfig]) assert.equal(fs.readFileSync(config, 'utf8'), 'model = "gpt"\n\n', config);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall drops the trust of the harness entries it removes and moves the trust of the user\'s hooks to their new places', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const first = { matcher: 'startup', hooks: [{ type: 'command', command: 'mine-first' }] };
    fs.writeFileSync(hooksPathOf(codexHome), JSON.stringify({ hooks: { SessionStart: [first], Stop: [] } }, null, 2), 'utf8');
    installEarlier(home);
    // The user adds hooks after install: one between the harness's, one after them, in both events.
    const hooks = readHooks(codexHome);
    const between = { hooks: [{ type: 'command', command: 'mine-between' }] };
    const last = { hooks: [{ type: 'command', command: 'mine-last' }, { type: 'command', command: 'mine-last-second' }] };
    hooks.hooks.SessionStart.splice(2, 0, between);
    hooks.hooks.SessionStart.push(last);
    hooks.hooks.Stop.splice(1, 0, between);
    hooks.hooks.Stop.push(last);
    fs.writeFileSync(hooksPathOf(codexHome), JSON.stringify(hooks, null, 2), 'utf8');
    const hooksPath = hooksPathOf(codexHome);
    const config = path.join(codexHome, 'config.toml');
    const settings = 'model = "gpt"\n\n[tui]\nnotifications = true\n';
    // Every group trusted, the second handler of `last` too, and a trust of another hooks.json at a harness place.
    const other = path.join(home, 'plugin', 'hooks.json');
    const lastSecond = (event, group) => `${trustHeader(hooksPath, event, group, 1)}\ntrusted_hash = "sha256:mine-last-second"\n`;
    fs.writeFileSync(config, [settings, trustEverything(codexHome), lastSecond('session_start', 5), lastSecond('stop', 3), trustTable(other, 'session_start', 1, 'sha256:plugin')].join('\n'), 'utf8');
    // SessionStart: 0 mine-first, 1 doctor, 2 mine-between, 3 resume, 4 fallback, 5 mine-last; Stop: 0 reply,
    // 1 mine-between, 2 backup, 3 mine-last.
    assert.deepEqual(readHooks(codexHome).hooks.SessionStart.map((group) => group.hooks[0].command.split(' ')[0]), ['mine-first', 'js-harness', 'mine-between', 'js-harness', 'js-harness', 'mine-last']);

    const { code, out, err } = await quietly(() => uninstallMain(['--global', '--home', home]));

    assert.equal(code, 0, err.join('\n'));
    assert.deepEqual(readHooks(codexHome).hooks, { SessionStart: [first, between, last], Stop: [between, last] });
    const after = fs.readFileSync(config, 'utf8');
    assert.deepEqual(trustOf(after, hooksPath), {
      'session_start:0:0': 'sha256:mine-first',
      'session_start:1:0': 'sha256:mine-between',
      'session_start:2:0': 'sha256:mine-last',
      'session_start:2:1': 'sha256:mine-last-second',
      'stop:0:0': 'sha256:mine-between',
      'stop:1:0': 'sha256:mine-last',
      'stop:1:1': 'sha256:mine-last-second',
    });
    assert.deepEqual(trustOf(after, other), { 'session_start:1:0': 'sha256:plugin' }, 'the trust of another hooks.json is left');
    assert.ok(after.startsWith(settings), 'the settings before the trust are kept byte for byte');
    assert.ok(out.includes(`removed 5 trust records of the harness's Codex hooks from ${config}`), out.join('\n'));
    assert.ok(out.includes(`moved 6 trust records of your own Codex hooks in ${config} to their hooks' new places`), out.join('\n'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall of a hooks.json that held only the harness takes every trust of it and keeps the rest of config.toml', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    installEarlier(home);
    const codexHome = path.join(home, '.codex');
    const hooksPath = hooksPathOf(codexHome);
    const config = path.join(codexHome, 'config.toml');
    const settings = 'model = "gpt"\r\n\r\n[tui]\r\nnotifications = true\r\n\r\n';
    fs.writeFileSync(config, `${settings}${trustEverything(codexHome).replaceAll('\n', '\r\n')}\r\n# kept\r\n[projects.'D:\\x']\r\ntrust_level = "trusted"\r\n`, 'utf8');

    const { code } = await quietly(() => uninstallMain(['--global', '--home', home]));

    assert.equal(code, 0);
    assert.equal(fs.existsSync(hooksPath), false, 'the hooks.json install made is gone');
    assert.equal(fs.readFileSync(config, 'utf8'), `${settings}# kept\r\n[projects.'D:\\x']\r\ntrust_level = "trusted"\r\n`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall leaves a config.toml whose hook trust it cannot read as it is, and says so', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    installEarlier(home);
    const config = path.join(home, '.codex', 'config.toml');
    const text = `hooks.state."${hooksPathOf(path.join(home, '.codex')).replaceAll('\\', '\\\\')}:stop:0:0".trusted_hash = "sha256:1"\n`;
    fs.writeFileSync(config, text, 'utf8');

    const { code, err } = await quietly(() => uninstallMain(['--global', '--home', home]));

    assert.equal(code, 1, 'trust left in a file nothing records any more is not a finished uninstall');
    assert.equal(fs.readFileSync(config, 'utf8'), text);
    assert.ok(err.some((line) => line.startsWith(`could not take the trust of the harness's Codex hooks out of ${config}`)), err.join('\n'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync over an earlier install drops the harness\'s Codex entries with their trust and moves the trust of the user\'s hooks after them', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    const { codexHome, hooksPath, config, mine } = withMineAfter(home, (h) => installEarlier(h));
    const skills = readManifest(home).files.map((file) => file.path).filter((p) => p.startsWith(path.join(codexHome, 'skills')));

    const { code, out } = await quietly(() => syncMain(['--global', '--home', home], {}));

    assert.equal(code, 0);
    assert.deepEqual(readHooks(codexHome).hooks, { Stop: [mine] }, 'only the user\'s hook is left; the SessionStart list the install made went with its last entry');
    assert.deepEqual(trustOf(fs.readFileSync(config, 'utf8'), hooksPath), { 'stop:0:0': 'sha256:mine-stop' });
    assert.ok(out.includes(`removed 5 trust records of the harness's Codex hooks from ${config}`), out.join('\n'));
    assert.ok(out.includes(`moved 1 trust record of your own Codex hooks in ${config} to their hooks' new places`), out.join('\n'));
    assert.equal(fs.existsSync(path.join(codexHome, 'skills')), false, 'and the Codex skills the earlier install wrote');
    // What it took out is said, as `uninstall` says it, one line a file and one for the entries of a host file.
    assert.equal(skills.length, 3);
    for (const skill of skills) assert.ok(out.includes(`removed ${skill}: no longer shipped`), out.join('\n'));
    assert.ok(out.includes(`removed 5 hook entries from ${hooksPath}: no longer shipped`), out.join('\n'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('sync and uninstall over an install that recorded no trustConfigs (0.96.0 and older) move the trust in today\'s config.toml', async () => {
  for (const command of [(home) => syncMain(['--global', '--home', home], {}), (home) => uninstallMain(['--global', '--home', home], {})]) {
    const home = makeTmp('js-harness-trust-home-');
    try {
      const { hooksPath, config } = withMineAfter(home, installOlder);

      const { code, out, err } = await quietly(() => command(home));

      assert.equal(code, 0, err.join('\n'));
      assert.deepEqual(trustOf(fs.readFileSync(config, 'utf8'), hooksPath), { 'stop:0:0': 'sha256:mine-stop' }, 'the user\'s hook keeps its trust at its new place');
      assert.ok(out.includes(`removed 5 trust records of the harness's Codex hooks from ${config}`), out.join('\n'));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('uninstall with no config.toml, or one without hook trust, writes nothing there', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    installEarlier(home);
    const config = path.join(home, '.codex', 'config.toml');
    assert.equal((await quietly(() => uninstallMain(['--global', '--home', home]))).code, 0);
    assert.equal(fs.existsSync(config), false);

    installEarlier(home);
    fs.writeFileSync(config, 'model = "gpt"\n', 'utf8');
    const { out } = await quietly(() => uninstallMain(['--global', '--home', home]));
    assert.equal(fs.readFileSync(config, 'utf8'), 'model = "gpt"\n');
    assert.ok(!out.some((line) => line.includes('trust record')), out.join('\n'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
