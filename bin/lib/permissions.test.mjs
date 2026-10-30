// T4 of odd/tasks/f8-s10-port.md: `install` holds the `permissions` object of the user's Claude settings (the allow entry,
// `defaultMode`, the 24 denies), records only what it wrote,
// and `uninstall` takes out exactly that; a value found there is never removed. Every test runs in a scratch home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, readManifest, sync, uninstall } from './manifest.mjs';
import { PERMISSIONS_ALLOW, PERMISSIONS_DENY, permissionsHealth } from './permissions.mjs';

const fakeSchtasks = () => {
  throw new Error('no scheduled task is recorded here');
};

function machine() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-permissions-'));
  const settings = path.join(home, '.claude', 'settings.json');
  const write = (value) => {
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  };
  const read = () => fs.readFileSync(settings, 'utf8');
  const data = () => JSON.parse(read());
  const remove = () => uninstall(home, { schtasks: fakeSchtasks });
  return { home, settings, write, read, data, remove, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

/** Every file under `dir` with its bytes, so a home can be compared byte for byte before and after. */
function tree(dir) {
  const out = {};
  for (const name of fs.readdirSync(dir, { recursive: true })) {
    const file = path.join(dir, name);
    out[name] = fs.statSync(file).isDirectory() ? 'dir' : fs.readFileSync(file).toString('base64');
  }
  return out;
}

// The object another tool writes (the reverse-engineering document, section 3; his settings, L2).
const PRIOR ={ allow: [...PERMISSIONS_ALLOW], defaultMode: 'bypassPermissions', deny: [...PERMISSIONS_DENY] };

test('the lists are the ones install holds: one allow entry and 24 denies, each once', () => {
  assert.deepEqual(PERMISSIONS_ALLOW, ['mcp__codegraph__*']);
  assert.equal(PERMISSIONS_DENY.length, 24);
  assert.equal(new Set(PERMISSIONS_DENY).size, 24);
  for (const entry of ['Bash(rm -rf /)', 'Read(.env)', 'Edit(.ssh/*)', 'Read(**/*.pem)', 'Edit(**/secrets/*)']) assert.ok(PERMISSIONS_DENY.includes(entry), entry);
});

test('in an empty home install writes the allow entry and the denies, never a defaultMode, and uninstall leaves the home as it was', () => {
  const m = machine();
  try {
    const manifest = install(m.home, '1.0.0');
    assert.deepEqual(m.data().permissions, { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY });
    assert.equal(manifest.permissionsHeld.status, 'written');
    assert.deepEqual(readManifest(m.home).permissions, {
      path: m.settings, added: { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY }, defaultMode: null, wroteMode: false,
      createdFile: false, createdObject: true, createdLists: ['allow', 'deny'],
    });
    const result = m.remove();
    assert.deepEqual(result.permissions, { status: 'released', path: m.settings, removed: 25 });
    assert.deepEqual(fs.readdirSync(m.home), [], 'the home is as it was');
  } finally {
    m.done();
  }
});

test('over the object another tool wrote it writes nothing, adopts the defaultMode, and uninstall leaves the file byte for byte', () => {
  const m = machine();
  try {
    m.write({ outputStyle: 'Gentleman', permissions: PRIOR });
    const before = m.read();
    const manifest = install(m.home, '1.0.0');
    assert.equal(manifest.permissionsHeld.status, 'already');
    assert.deepEqual(m.data().permissions, PRIOR);
    const record = readManifest(m.home).permissions;
    assert.deepEqual(record.added, { allow: [], deny: [] });
    assert.equal(record.defaultMode, 'bypassPermissions');
    assert.equal(record.wroteMode, false);
    m.remove();
    assert.equal(m.read(), before, 'what was found is never removed');
  } finally {
    m.done();
  }
});

test('with part of the list there it adds the rest after the user\'s own, and uninstall takes out only those', () => {
  const m = machine();
  try {
    const own = { allow: ['Bash(npm test)'], deny: ['Bash(git push --force)', ...PERMISSIONS_DENY.slice(0, 10)] };
    m.write(`{\r\n    "permissions": ${JSON.stringify(own)}\r\n}`);
    const before = m.read();
    install(m.home, '1.0.0');
    const held = m.data().permissions;
    assert.deepEqual(held.allow, ['Bash(npm test)', ...PERMISSIONS_ALLOW]);
    assert.deepEqual(held.deny, [...own.deny, ...PERMISSIONS_DENY.slice(10)]);
    assert.ok(m.read().includes('\r\n    "permissions"'), 'written back in the file\'s own style');
    const result = m.remove();
    assert.equal(result.permissions.removed, 15);
    assert.deepEqual(m.data(), { permissions: own });
    assert.equal(JSON.stringify(JSON.parse(m.read())), JSON.stringify(JSON.parse(before)));
  } finally {
    m.done();
  }
});

test('once another tool\'s uninstall took the object away, the next install writes it back with the adopted defaultMode, and uninstall takes that out too', () => {
  const m = machine();
  try {
    m.write({ permissions: PRIOR });
    install(m.home, '1.0.0');
    m.write({ theme: 'dark' });
    const afterOther = m.read();
    // Putting a mode back is said, never silent: the user may have taken it out on purpose.
    assert.equal(sync(m.home, '1.0.1').permissionsHeld.restoredMode, 'bypassPermissions');
    assert.deepEqual(m.data().permissions, { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY, defaultMode: 'bypassPermissions' });
    const record = readManifest(m.home).permissions;
    assert.equal(record.wroteMode, true);
    assert.equal(record.createdObject, true);
    assert.equal(permissionsHealth(m.home).state, 'ok');
    m.remove();
    assert.equal(m.read(), afterOther);
  } finally {
    m.done();
  }
});

test('a defaultMode the user changed after install wrote it is theirs, and uninstall keeps it', () => {
  const m = machine();
  try {
    m.write({ permissions: PRIOR });
    install(m.home, '1.0.0');
    m.write({});
    sync(m.home, '1.0.1');
    m.write({ ...m.data(), permissions: { ...m.data().permissions, defaultMode: 'acceptEdits' } });
    const result = m.remove();
    assert.equal(result.permissions.removed, 25);
    assert.deepEqual(m.data(), { permissions: { defaultMode: 'acceptEdits' } });
  } finally {
    m.done();
  }
});

test('a repeat install keeps what the first one made, so uninstall still leaves the home as it was', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    sync(m.home, '1.0.1');
    const record = readManifest(m.home).permissions;
    assert.equal(record.createdObject, true);
    assert.deepEqual(record.added.deny, PERMISSIONS_DENY, 'each entry recorded once');
    m.remove();
    assert.deepEqual(fs.readdirSync(m.home), []);
  } finally {
    m.done();
  }
});

test('a settings file that does not parse is left alone and reported, and the record of an earlier install is kept', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const record = readManifest(m.home).permissions;
    m.write('{ not json');
    const manifest = sync(m.home, '1.0.1');
    assert.deepEqual(manifest.permissionsHeld, { status: 'skipped', path: m.settings, reason: 'malformed JSON' });
    assert.equal(m.read(), '{ not json');
    assert.deepEqual(readManifest(m.home).permissions, record);
    // The denies are not there: a gap the session-start hook announces, never the `unknown` it stays quiet on
    // (the verifier of T4, finding 1).
    const health = permissionsHealth(m.home);
    assert.equal(health.state, 'stale');
    assert.match(health.fix[0], /cannot hold the permissions \(malformed JSON\): fix it, then run js-harness install$/);
  } finally {
    m.done();
  }
});

test('a list broken after a recorded install is a gap too, and permissions set to null are left as they are', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    m.write({ ...m.data(), permissions: { deny: 'Read(.env)' } });
    assert.equal(sync(m.home, '1.0.1').permissionsHeld.status, 'skipped');
    assert.equal(permissionsHealth(m.home).state, 'stale');
  } finally {
    m.done();
  }
  const n = machine();
  try {
    n.write('{"permissions":null}');
    assert.match(install(n.home, '1.0.0').permissionsHeld.reason, /"permissions" is not an object/);
    n.remove();
    assert.equal(n.read(), '{"permissions":null}');
  } finally {
    n.done();
  }
});

test('an entry found twice loses one copy to uninstall, and a record edited by hand takes out only entries of the lists', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const data = m.data();
    m.write({ ...data, permissions: { ...data.permissions, deny: [...data.permissions.deny, 'Read(.env)', 'Bash(curl)'] } });
    const manifest = readManifest(m.home);
    manifest.permissions.added.deny = [...manifest.permissions.added.deny, 'Bash(curl)', 42];
    fs.writeFileSync(path.join(m.home, '.js-harness', 'manifest.json'), JSON.stringify(manifest));
    m.remove();
    assert.deepEqual(m.data(), { permissions: { deny: ['Read(.env)', 'Bash(curl)'] } });
  } finally {
    m.done();
  }
});

// Codex on c7445ca..e523ac7, part 1: the permissions written and then no manifest to record them would be left for good.
test('when the manifest cannot be written, the permissions install wrote are taken back', () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    fs.writeFileSync(path.join(m.home, '.js-harness'), 'a file where the manifest\'s folder goes');
    assert.throws(() => install(m.home, '1.0.0'));
    assert.equal(m.data().permissions, undefined);
  } finally {
    m.done();
  }
});

// Codex on c7445ca..e523ac7, part 1: lists another tool emptied still go, with the object and the file install made.
test('lists someone else emptied are still taken out with the object install made', () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    install(m.home, '1.0.0');
    m.write({ ...m.data(), permissions: { allow: [], deny: [] } });
    assert.equal(m.remove().permissions.status, 'released');
    assert.deepEqual(m.data(), { theme: 'dark' });
  } finally {
    m.done();
  }
});

test('a record kept by a failed uninstall still takes the file away after a reinstall', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const failing = (file, ...rest) => {
      if (file === m.settings) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
      return fs.writeFileSync(file, ...rest);
    };
    uninstall(m.home, { schtasks: fakeSchtasks, writeFile: failing });
    install(m.home, '1.0.0');
    m.remove();
    assert.deepEqual(fs.readdirSync(m.home), [], 'no {} left behind (the verifier of T4, finding 3)');
  } finally {
    m.done();
  }
});

test('permissions that are not an object, or a list that is not one, are left alone and reported', () => {
  for (const permissions of ['ask', { deny: 'Read(.env)' }]) {
    const m = machine();
    try {
      m.write({ permissions });
      const manifest = install(m.home, '1.0.0');
      assert.equal(manifest.permissionsHeld.status, 'skipped');
      assert.match(manifest.permissionsHeld.reason, /not (an object|a list)/);
      assert.deepEqual(m.data().permissions, permissions);
      assert.equal(readManifest(m.home).permissions, undefined);
    } finally {
      m.done();
    }
  }
});

test('a write that fails on uninstall keeps the record, so a second uninstall takes the entries out', () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    install(m.home, '1.0.0');
    const failing = (file, ...rest) => {
      if (file === m.settings) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
      return fs.writeFileSync(file, ...rest);
    };
    const first = uninstall(m.home, { schtasks: fakeSchtasks, writeFile: failing });
    assert.deepEqual(first.permissions, { status: 'failed', path: m.settings, code: 'EBUSY' });
    assert.ok(readManifest(m.home).permissions, 'still recorded');
    m.remove();
    assert.deepEqual(m.data(), { theme: 'dark' });
  } finally {
    m.done();
  }
});

// A review's reliability lens on PR 2: a record that names the file in another spelling was refused and dropped.
test('on Windows a record that names the user settings in another case is that file, and uninstall takes the entries out', { skip: process.platform !== 'win32' }, () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    install(m.home, '1.0.0');
    const file = path.join(m.home, '.js-harness', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.permissions.path = manifest.permissions.path.toUpperCase();
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.equal(m.remove().permissions.status, 'released');
    assert.deepEqual(m.data(), { theme: 'dark' });
  } finally {
    m.done();
  }
});

// A review's lens on 8c684535: a record kept forever would make every later uninstall fail, and nothing the user can
// do changes the path it names. So a file that cannot be read now is a failure that stays recorded for a run again,
// and a record that names another file is left out of the manifest, its entries said to be removed by hand.
test('a settings file that cannot be read on uninstall is a failure that stays recorded, and a run after it is fixed takes the entries out', () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    install(m.home, '1.0.0');
    const good = m.read();
    m.write('{ not json');
    const first = m.remove();
    assert.equal(first.permissions.status, 'failed');
    assert.ok(readManifest(m.home).permissions, 'still recorded');
    m.write(good);
    assert.equal(m.remove().permissions.status, 'released');
    // The hook entries are the hook engine's to report (its own kept record); the permissions are out.
    assert.equal(m.data().permissions, undefined);
    assert.equal(m.data().theme, 'dark');
  } finally {
    m.done();
  }
});

test('a record that names another file than the user settings is left as it is, said, and not kept to fail every uninstall', () => {
  const m = machine();
  try {
    m.write({ theme: 'dark' });
    install(m.home, '1.0.0');
    const file = path.join(m.home, '.js-harness', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.permissions.path = path.join(m.home, 'elsewhere.json');
    fs.writeFileSync(file, JSON.stringify(manifest));
    const removed = m.remove();
    assert.equal(removed.permissions.status, 'kept');
    assert.match(removed.permissions.reason, /names another file than the user settings/);
    assert.equal(readManifest(m.home)?.permissions, undefined);
    assert.deepEqual(m.data().permissions.deny, PERMISSIONS_DENY);
  } finally {
    m.done();
  }
});

test('a kept record takes the file install made with it, so a second uninstall still leaves an empty home', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const failing = (file, ...rest) => {
      if (file === m.settings) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
      return fs.writeFileSync(file, ...rest);
    };
    uninstall(m.home, { schtasks: fakeSchtasks, writeFile: failing });
    assert.equal(readManifest(m.home).permissions.createdFile, true, 'the hooks made the file, and they are gone');
    m.remove();
    assert.deepEqual(fs.readdirSync(m.home), []);
  } finally {
    m.done();
  }
});

test('the doctor row: n/a with nothing installed, ok while every entry is there, stale naming each missing one', () => {
  const m = machine();
  try {
    assert.deepEqual(permissionsHealth(m.home), { state: 'n/a', fix: [] });
    m.write({ permissions: PRIOR });
    install(m.home, '1.0.0');
    assert.deepEqual(permissionsHealth(m.home), { state: 'ok', fix: [] });
    const data = m.data();
    m.write({ ...data, permissions: { allow: [], deny: data.permissions.deny.filter((entry) => entry !== 'Read(.env)') } });
    const { state, fix } = permissionsHealth(m.home);
    assert.equal(state, 'stale');
    assert.match(fix[0], /^permissions: 3 entries missing from .*settings\.json: run js-harness install$/);
    assert.deepEqual(fix.slice(1), ['allow mcp__codegraph__*', 'deny Read(.env)', 'defaultMode bypassPermissions']);
  } finally {
    m.done();
  }
});

test('the doctor row is stale when js-harness is installed and nothing holds the permissions yet', () => {
  const m = machine();
  try {
    install(m.home, '1.0.0');
    const manifest = readManifest(m.home);
    delete manifest.permissions;
    fs.writeFileSync(path.join(m.home, '.js-harness', 'manifest.json'), JSON.stringify(manifest));
    assert.equal(permissionsHealth(m.home).state, 'stale');
  } finally {
    m.done();
  }
});
