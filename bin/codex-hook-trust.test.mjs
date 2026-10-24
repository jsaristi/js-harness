// Codex's trust of the harness's hooks (odd/tasks/codex-hook-trust.md), through the public commands on throwaway
// homes: `doctor` names each harness entry of the Codex hooks.json that has no trust record, and `uninstall` takes the
// trust of the entries it removes and moves the trust of the user's own hooks to the places they move to. The home is
// never the real one: a test home is not `os.homedir()`, so its Codex home is `<home>/.codex` (stack-install T8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';
import { installMain, syncMain, uninstallMain } from './install.mjs';
import { readManifest } from './lib/manifest.mjs';

const noopFetch = async () => {
  throw new Error('network disabled in tests');
};

// Never a real spawn: every probe looks at a missing binary, and git says there is no repository.
const noSpawn = () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });

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

async function doctorRow(home, env = {}, deps = {}) {
  const { code, out } = await quietly(() => doctorMain(['--home', home, '--cwd', home, '--json', '--offline'], env, { spawn: noSpawn, fetch: noopFetch, ...deps }));
  assert.equal(code, 0);
  return JSON.parse(out.join('\n')).find((row) => row.id === 'codex-trust');
}

test('doctor names every harness entry of the Codex hooks.json with no trust record, with the step that trusts them', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    assert.equal((await quietly(() => installMain(['--home', home]))).code, 0);
    const codexHome = path.join(home, '.codex');
    const hooksPath = hooksPathOf(codexHome);
    // Only the first SessionStart group is trusted: the four other harness entries are not.
    fs.writeFileSync(path.join(codexHome, 'config.toml'), `model = "x"\n\n${trustTable(hooksPath, 'session_start', 0)}`, 'utf8');

    const row = await doctorRow(home);

    assert.equal(row.codex, 'missing');
    assert.deepEqual(row.gaps.map((gap) => [gap.dimension, gap.state]), [['codex', 'missing']]);
    const [fix, ...lines] = row.fix.codex;
    assert.match(fix, /run `codex` in a terminal/);
    assert.match(fix, /Trust all and continue/);
    assert.match(fix, /never writes/);
    assert.ok(lines.some((line) => line.includes(path.join(codexHome, 'config.toml'))), 'the fix names the config.toml it read');
    const untrusted = lines.filter((line) => line.startsWith('  '));
    assert.deepEqual(untrusted.map((line) => line.trim()), [
      'session_start:1:0 js-harness resume --hook',
      'session_start:2:0 js-harness backup --session-start || exit 0',
      'stop:0:0 js-harness reply --hook || exit 0',
      'stop:1:0 js-harness backup --hook || exit 0',
    ]);
    const before = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    await doctorRow(home);
    assert.equal(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), before, 'doctor never writes a trust record');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('doctor reads the harness hooks as trusted once every one has a trusted_hash, and counts a table without one as untrusted', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    await quietly(() => installMain(['--home', home]));
    const codexHome = path.join(home, '.codex');
    const config = path.join(codexHome, 'config.toml');
    fs.writeFileSync(config, trustEverything(codexHome), 'utf8');
    const ok = await doctorRow(home);
    assert.equal(ok.codex, 'ok');
    assert.deepEqual(ok.gaps, []);

    // A table at the place with no trusted_hash is no trust.
    fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(/(stop:1:0'\]\r?\n)trusted_hash = "[^"]*"/, '$1enabled = true'), 'utf8');
    const row = await doctorRow(home);
    assert.equal(row.codex, 'missing');
    assert.deepEqual(row.fix.codex.filter((line) => line.startsWith('  ')).map((line) => line.trim()), ['stop:1:0 js-harness backup --hook || exit 0']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('doctor keys each harness entry by its place among the user\'s own hooks, and reads no trust of another hooks.json', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    const codexHome = path.join(home, '.codex');
    fs.mkdirSync(codexHome, { recursive: true });
    const mine = { matcher: 'startup', hooks: [{ type: 'command', command: 'my-own-hook' }] };
    fs.writeFileSync(hooksPathOf(codexHome), JSON.stringify({ hooks: { SessionStart: [mine], Stop: [mine] } }, null, 2), 'utf8');
    await quietly(() => installMain(['--home', home]));
    const hooksPath = hooksPathOf(codexHome);
    const other = path.join(home, 'elsewhere', 'hooks.json');
    // The user's own hooks at 0 are trusted, the harness's at 1.. of this file are trusted only under another path.
    fs.writeFileSync(path.join(codexHome, 'config.toml'), [
      trustTable(hooksPath, 'session_start', 0),
      trustTable(hooksPath, 'stop', 0),
      trustTable(other, 'session_start', 1),
      trustTable(hooksPath, 'stop', 1),
    ].join('\n'), 'utf8');

    const row = await doctorRow(home);

    assert.equal(row.codex, 'missing');
    assert.deepEqual(row.fix.codex.filter((line) => line.startsWith('  ')).map((line) => line.trim().split(' ')[0]), ['session_start:1:0', 'session_start:2:0', 'session_start:3:0', 'stop:2:0']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('doctor reads the config.toml of the CODEX_HOME the user set when the home is the real one', async () => {
  const home = makeTmp('js-harness-trust-home-');
  const codexHomeSet = makeTmp('js-harness-trust-codex-');
  try {
    await quietly(() => installMain(['--home', home]));
    // Trusted under <home>/.codex, and nothing under the CODEX_HOME the user set: doctor reads the second.
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), trustEverything(path.join(home, '.codex')), 'utf8');
    const row = await doctorRow(home, { CODEX_HOME: codexHomeSet }, { homedir: home });
    assert.equal(row.codex, 'missing');
    assert.ok(row.fix.codex.some((line) => line.includes(path.join(codexHomeSet, 'config.toml'))));
    // A home that is not the real one keeps `<home>/.codex`, whatever CODEX_HOME says.
    assert.equal((await doctorRow(home, { CODEX_HOME: codexHomeSet })).codex, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(codexHomeSet, { recursive: true, force: true });
  }
});

test('doctor says n/a with no Codex entry installed, and unknown for trust it cannot read', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    assert.equal((await doctorRow(home)).codex, 'n/a');
    await quietly(() => installMain(['--home', home]));
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[hooks.state]\n"x:session_start:0:0" = { trusted_hash = "sha256:1" }\n', 'utf8');
    const row = await doctorRow(home);
    assert.equal(row.codex, 'unknown');
    assert.deepEqual(row.gaps, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('install records the config.toml of the Codex home on each Codex entry, so uninstall edits that file', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    await quietly(() => installMain(['--home', home]));
    const config = path.join(home, '.codex', 'config.toml');
    const { entries } = readManifest(home);
    const codexRecords = entries.filter((entry) => entry.path === hooksPathOf(path.join(home, '.codex')));
    assert.equal(codexRecords.length, 5);
    for (const record of codexRecords) assert.equal(record.trustConfig, config);
    for (const record of entries.filter((entry) => !codexRecords.includes(entry))) assert.equal(record.trustConfig, undefined);
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
    await quietly(() => installMain(['--home', home]));
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
    await quietly(() => installMain(['--home', home]));
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
    await quietly(() => installMain(['--home', home]));
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

test('sync that drops an entry no longer shipped takes its trust and moves the trust of the hooks after it', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    await quietly(() => installMain(['--home', home]));
    const codexHome = path.join(home, '.codex');
    const hooksPath = hooksPathOf(codexHome);
    const config = path.join(codexHome, 'config.toml');
    // An entry an earlier release wrote first in Stop, and that this one no longer ships.
    const retired = { hooks: [{ type: 'command', command: 'js-harness retired --hook' }] };
    const hooks = readHooks(codexHome);
    hooks.hooks.Stop.unshift(retired);
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(path.join(home, '.js-harness', 'manifest.json'), 'utf8'));
    manifest.entries.push({ path: hooksPath, pointer: ['hooks', 'Stop'], entry: retired, createdFile: true, createdFolders: [], createdContainers: 0, skipped: false, trustConfig: config });
    fs.writeFileSync(path.join(home, '.js-harness', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(config, trustEverything(codexHome), 'utf8');

    const { code, out } = await quietly(() => syncMain(['--global', '--home', home], {}));

    assert.equal(code, 0);
    assert.deepEqual(readHooks(codexHome).hooks.Stop.map((group) => group.hooks[0].command), ['js-harness reply --hook || exit 0', 'js-harness backup --hook || exit 0']);
    const after = trustOf(fs.readFileSync(config, 'utf8'), hooksPath);
    assert.deepEqual([after['stop:0:0'], after['stop:1:0'], after['stop:2:0']], ['sha256:js-harness reply --hook || exit 0', 'sha256:js-harness backup --hook || exit 0', undefined]);
    assert.equal(after['session_start:0:0'], 'sha256:js-harness doctor --hook', 'another event is left as it was');
    assert.ok(out.includes(`removed 1 trust record of the harness's Codex hooks from ${config}`), out.join('\n'));
    assert.equal((await doctorRow(home)).codex, 'ok', 'the hooks that moved are still trusted where they are now');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall with no config.toml, or one without hook trust, writes nothing there', async () => {
  const home = makeTmp('js-harness-trust-home-');
  try {
    await quietly(() => installMain(['--home', home]));
    const config = path.join(home, '.codex', 'config.toml');
    assert.equal((await quietly(() => uninstallMain(['--global', '--home', home]))).code, 0);
    assert.equal(fs.existsSync(config), false);

    await quietly(() => installMain(['--home', home]));
    fs.writeFileSync(config, 'model = "gpt"\n', 'utf8');
    const { out } = await quietly(() => uninstallMain(['--global', '--home', home]));
    assert.equal(fs.readFileSync(config, 'utf8'), 'model = "gpt"\n');
    assert.ok(!out.some((line) => line.includes('trust record')), out.join('\n'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
