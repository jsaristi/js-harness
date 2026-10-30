import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CODEX_DAEMON_FIX, codexDaemonState } from './codex-daemon.mjs';

const TARGET = 'x86_64-pc-windows-msvc';
const EXE = process.platform === 'win32' ? 'codex.exe' : 'codex';

/** A Codex home in a fresh temporary folder, shaped as Codex lays out its managed daemon: `release(name, opts)` writes
 * `packages/app-server-daemon/releases/<name>` with its `codex-package.json` and, unless `exe` is false, the executable
 * it names; `point(name)` makes `current` a junction (a symlink off Windows) to that release; `state(...files)` leaves
 * the daemon's own files in `app-server-daemon/`. */
function codexHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-daemon-'));
  const pkg = path.join(root, 'packages', 'app-server-daemon');
  const release = (name, { exe = true, manifest } = {}) => {
    const dir = path.join(pkg, 'releases', name);
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
    const text = manifest ?? JSON.stringify({ layoutVersion: 1, version: name.split('-')[0], target: TARGET, entrypoint: `bin/${EXE}` });
    fs.writeFileSync(path.join(dir, 'codex-package.json'), text);
    if (exe) fs.writeFileSync(path.join(dir, 'bin', EXE), 'binary');
    return dir;
  };
  const point = (name) => fs.symlinkSync(path.join(pkg, 'releases', name), path.join(pkg, 'current'), 'junction');
  const state = (...files) => {
    fs.mkdirSync(path.join(root, 'app-server-daemon'), { recursive: true });
    for (const file of files) fs.writeFileSync(path.join(root, 'app-server-daemon', file), '');
  };
  return { root, pkg, release, point, state, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** Every path under `root` with its size and modification time, to prove a read left the tree as it was. */
function snapshot(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const stat = fs.lstatSync(full);
      out.push(`${path.relative(root, full)} ${stat.size} ${stat.mtimeMs}`);
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(root);
  return out.sort();
}

test('a current that resolves to a release with its executable is ok, with nothing to say', () => {
  const home = codexHome();
  try {
    home.release(`0.166.0-${TARGET}`);
    home.point(`0.166.0-${TARGET}`);
    home.state('daemon.pid', 'daemon-updater.pid');
    assert.deepEqual(codexDaemonState({ codexHome: home.root }), { claude: 'n/a', codex: 'ok', lines: [] });
  } finally {
    home.cleanup();
  }
});

// The state of 2026-10-21 (odd/tasks/codex-trust-table.md, L3): `current` named release 0.162.0, whose
// `codex-package.json` names `bin/codex.exe` while `bin/` was empty, and the daemon's files were in place.
test('the state of 2026-10-21, a current whose release has no executable, is missing, and its fix names the repair', () => {
  const home = codexHome();
  try {
    home.release(`0.162.0-${TARGET}`, { exe: false });
    home.point(`0.162.0-${TARGET}`);
    home.state('daemon.pid', 'daemon.stderr.log', 'daemon-updater.pid', 'daemon-updater.stderr.log');
    const before = snapshot(home.root);
    const state = codexDaemonState({ codexHome: home.root });
    assert.equal(state.codex, 'missing');
    assert.equal(state.claude, 'n/a');
    const current = path.join(home.pkg, 'current');
    assert.equal(state.lines[0], `${current} resolves to ${path.join(home.pkg, 'releases', `0.162.0-${TARGET}`)}, whose codex-package.json names bin/${EXE}, which is not there`);
    const steps = state.lines.slice(1).join('\n');
    assert.match(steps, /app-server-daemon\.broken/, 'the broken package is kept aside');
    assert.match(steps, /codex-package\.json/, 'the CLI\'s own platform package is copied in');
    assert.ok(steps.includes(current), 'current is pointed at the copy');
    assert.match(steps, /codex app-server daemon start/);
    assert.match(steps, /codex app-server daemon version/);
    assert.match(steps, /undo: /);
    assert.deepEqual(snapshot(home.root), before, 'the row only reads');
  } finally {
    home.cleanup();
  }
});

// Codex's review of 04e3d29..27bba80 (P2): a folder where the executable should be is no executable.
test('a release whose entrypoint is a folder is missing', () => {
  const home = codexHome();
  try {
    const dir = home.release(`0.166.0-${TARGET}`, { exe: false });
    fs.mkdirSync(path.join(dir, 'bin', EXE));
    home.point(`0.166.0-${TARGET}`);
    const state = codexDaemonState({ codexHome: home.root });
    assert.equal(state.codex, 'missing');
    assert.match(state.lines[0], new RegExp(`names bin/${EXE.replace('.', '\\.')}, which is not there$`));
  } finally {
    home.cleanup();
  }
});

test('a current whose release folder is gone is missing', () => {
  const home = codexHome();
  try {
    const dir = home.release(`0.162.0-${TARGET}`);
    home.point(`0.162.0-${TARGET}`);
    fs.rmSync(dir, { recursive: true, force: true });
    const state = codexDaemonState({ codexHome: home.root });
    assert.equal(state.codex, 'missing');
    assert.equal(state.lines[0], `${path.join(home.pkg, 'current')} points at ${dir}, which is not there`);
  } finally {
    home.cleanup();
  }
});

// 2026-10-30, before the repair (odd/tasks/codex-trust-table.md, `## Daemon`): the package folder renamed aside, so no
// `current`, while the daemon's files still kept Codex from installing a new one.
test('no current while the daemon\'s own files are there is missing: Codex installs none then', () => {
  for (const file of ['daemon.pid', 'daemon.stderr.log', 'daemon-updater.pid', 'daemon-updater.stderr.log']) {
    const home = codexHome();
    try {
      home.state(file);
      const state = codexDaemonState({ codexHome: home.root });
      assert.equal(state.codex, 'missing', file);
      assert.equal(state.lines[0], `${path.join(home.pkg, 'current')} is not there, and ${path.join(home.root, 'app-server-daemon', file)} keeps Codex from installing a daemon: it fails "daemon executable not found"`);
    } finally {
      home.cleanup();
    }
  }
});

test('no current and none of the daemon\'s files is n/a: no managed daemon yet, and the next start installs one', () => {
  const home = codexHome();
  try {
    assert.deepEqual(codexDaemonState({ codexHome: home.root }), { claude: 'n/a', codex: 'n/a', lines: [] }, 'an empty Codex home');
    home.release(`0.166.0-${TARGET}`);
    home.state('daemon.lock', 'daemon-updater.sock');
    assert.deepEqual(codexDaemonState({ codexHome: home.root }), { claude: 'n/a', codex: 'n/a', lines: [] }, 'a release and lock files, no current');
  } finally {
    home.cleanup();
  }
  assert.deepEqual(codexDaemonState({ codexHome: path.join(os.tmpdir(), 'js-harness-no-such-codex-home') }), { claude: 'n/a', codex: 'n/a', lines: [] });
});

test('a release whose codex-package.json cannot be read or names no entrypoint is unknown: nothing is claimed', () => {
  for (const manifest of ['{not json', JSON.stringify({ version: '0.166.0' })]) {
    const home = codexHome();
    try {
      home.release(`0.166.0-${TARGET}`, { manifest });
      home.point(`0.166.0-${TARGET}`);
      assert.deepEqual(codexDaemonState({ codexHome: home.root }), { claude: 'n/a', codex: 'unknown', lines: [] }, manifest);
    } finally {
      home.cleanup();
    }
  }
  const home = codexHome();
  try {
    const dir = home.release(`0.166.0-${TARGET}`);
    fs.rmSync(path.join(dir, 'codex-package.json'));
    home.point(`0.166.0-${TARGET}`);
    assert.deepEqual(codexDaemonState({ codexHome: home.root }), { claude: 'n/a', codex: 'unknown', lines: [] }, 'no codex-package.json');
  } finally {
    home.cleanup();
  }
});

test('the fix says why the daemon cannot start and that the harness never repairs it', () => {
  assert.match(CODEX_DAEMON_FIX, /daemon executable not found/);
  assert.match(CODEX_DAEMON_FIX, /never writes/);
});
