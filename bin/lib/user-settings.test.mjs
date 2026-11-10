// M33 of the Fable 5.2 audit, work unit 5 of its triage (odd/tasks/audit-u5-atomic-state.md, spec 5): every write of
// js-harness to the user's Claude settings goes through a fresh temporary file and one rename, so a write that fails
// leaves the bytes that were there before instead of a truncated file. The rename onto the settings file is made to fail
// here; with an in-place write the file would change all the same. Every test runs in a scratch home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acceptSessionMessages, install, uninstall } from './manifest.mjs';
import { userSettingsPath } from './user-settings.mjs';

const fakeSchtasks = () => {
  throw new Error('no scheduled task is recorded here');
};

const USER_SETTINGS = `${JSON.stringify({ theme: 'dark', model: 'opus' }, null, 2)}\n`;

function machine() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-user-settings-'));
  const settings = userSettingsPath(home);
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, USER_SETTINGS);
  const read = () => fs.readFileSync(settings, 'utf8');
  const leftovers = () => fs.readdirSync(path.dirname(settings)).filter((name) => name.endsWith('.tmp'));
  return { home, settings, read, leftovers, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

/** Makes every rename onto `target` fail as a full disk would, the others going through. */
function failRenameOnto(t, target) {
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (path.resolve(String(to)) === path.resolve(target)) throw Object.assign(new Error('i/o error'), { code: 'EIO' });
    return rename(from, to);
  });
}

test('the session-messages setting is written by rename: a rename that fails leaves the settings as they were', (t) => {
  const m = machine();
  try {
    failRenameOnto(t, m.settings);
    assert.equal(acceptSessionMessages(m.home).status, 'skipped');
    assert.equal(m.read(), USER_SETTINGS);
    assert.deepEqual(m.leftovers(), [], 'no temporary file is left beside the settings');
  } finally {
    m.done();
  }
});

test('install writes its hook entries and permissions by rename: a rename that fails leaves the settings as they were', (t) => {
  const m = machine();
  try {
    failRenameOnto(t, m.settings);
    install(m.home, '1.0.0');
    assert.equal(m.read(), USER_SETTINGS);
    assert.deepEqual(m.leftovers(), []);
  } finally {
    m.done();
  }
});

test('uninstall takes its entries, permissions and setting out by rename: a rename that fails leaves the settings as they were', (t) => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    assert.equal(acceptSessionMessages(m.home).status, 'written');
    const installed = m.read();
    assert.notEqual(installed, USER_SETTINGS, 'install wrote into the settings');
    failRenameOnto(t, m.settings);
    try {
      uninstall(m.home, { schtasks: fakeSchtasks });
    } catch {
      // A write that fails may stop uninstall; what matters here is the file it leaves.
    }
    assert.equal(m.read(), installed);
    assert.deepEqual(m.leftovers(), []);
  } finally {
    m.done();
  }
});

const canLink = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-link-'));
  try {
    fs.writeFileSync(path.join(dir, 'a'), '');
    fs.symlinkSync(path.join(dir, 'a'), path.join(dir, 'b'), 'file');
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

test('settings linked into a dotfiles folder stay a link: install and uninstall write the file it names', { skip: !canLink && 'this machine cannot make links' }, () => {
  const m = machine();
  try {
    const real = path.join(m.home, 'dotfiles', 'settings.json');
    fs.mkdirSync(path.dirname(real), { recursive: true });
    fs.renameSync(m.settings, real);
    fs.symlinkSync(real, m.settings, 'file');
    install(m.home, '1.0.0');
    assert.equal(acceptSessionMessages(m.home).status, 'written');
    assert.ok(fs.lstatSync(m.settings).isSymbolicLink(), 'still a link after install');
    assert.equal(JSON.parse(fs.readFileSync(real, 'utf8')).crossSessionInbound, 'accept');
    uninstall(m.home, { schtasks: fakeSchtasks });
    assert.ok(fs.lstatSync(m.settings).isSymbolicLink(), 'still a link after uninstall');
    assert.deepEqual(JSON.parse(fs.readFileSync(real, 'utf8')), JSON.parse(USER_SETTINGS));
  } finally {
    m.done();
  }
});
