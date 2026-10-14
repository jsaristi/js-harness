// T5 of odd/tasks/commands-and-doctor.md: `install --accept-session-messages` sets Claude Code's
// `crossSessionInbound` to `accept` in the user settings, records what was there, and `uninstall`
// puts it back exactly. His answer (the orchestrator's transcript ffe99ebf line 3298): "Sí, con
// opción explícita (Recomendada)".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acceptSessionMessages, install, readManifest, sync, uninstall } from './manifest.mjs';

const fakeSchtasks = () => {
  throw new Error('no scheduled task is recorded here');
};

function machine() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-manifest-settings-'));
  const settings = path.join(home, '.claude', 'settings.json');
  const write = (text) => {
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, text);
  };
  const read = () => fs.readFileSync(settings, 'utf8');
  const remove = () => uninstall(home, { schtasks: fakeSchtasks });
  return { home, settings, write, read, remove, done: () => fs.rmSync(home, { recursive: true, force: true }) };
}

test('with no settings file it writes one holding the setting, and uninstall removes the file and its folders', () => {
  const m = machine();
  try {
    assert.deepEqual(acceptSessionMessages(m.home), { status: 'written', path: m.settings, was: null });
    assert.equal(m.read(), '{\n  "crossSessionInbound": "accept"\n}');
    assert.deepEqual(readManifest(m.home).settings, [{ path: m.settings, key: 'crossSessionInbound', value: 'accept', had: false, previous: null, createdFile: true }]);
    const result = m.remove();
    assert.deepEqual(result.settingsRestored, [m.settings]);
    assert.deepEqual(fs.readdirSync(m.home), [], 'the home is as it was');
  } finally {
    m.done();
  }
});

test('beside the install, uninstall leaves the settings file as an uninstall without the setting leaves it', () => {
  const plain = machine();
  const asked = machine();
  try {
    for (const m of [plain, asked]) install(m.home, '0.0.0-test');
    acceptSessionMessages(asked.home);
    assert.equal(JSON.parse(asked.read()).crossSessionInbound, 'accept');
    plain.remove();
    asked.remove();
    assert.equal(fs.existsSync(asked.settings), fs.existsSync(plain.settings));
    assert.deepEqual(fs.readdirSync(asked.home), fs.readdirSync(plain.home));
  } finally {
    plain.done();
    asked.done();
  }
});

test('in a settings file of the user its style is kept, and uninstall gives back the same bytes', () => {
  const m = machine();
  try {
    const original = '{\r\n    "model": "opus",\r\n    "crossSessionInbound": "hold"\r\n}\r\n';
    m.write(original);
    assert.equal(acceptSessionMessages(m.home).status, 'written');
    assert.equal(m.read(), '{\r\n    "model": "opus",\r\n    "crossSessionInbound": "accept"\r\n}\r\n');
    assert.deepEqual(readManifest(m.home).settings[0], { path: m.settings, key: 'crossSessionInbound', value: 'accept', had: true, previous: 'hold', createdFile: false });
    m.remove();
    assert.equal(m.read(), original);

    const without = '{\n  "model": "opus"\n}\n';
    m.write(without);
    acceptSessionMessages(m.home);
    m.remove();
    assert.equal(m.read(), without);
  } finally {
    m.done();
  }
});

test('a setting already accept is left as it is, and stays after uninstall', () => {
  const m = machine();
  try {
    m.write('{"crossSessionInbound":"accept"}');
    assert.deepEqual(acceptSessionMessages(m.home), { status: 'already', path: m.settings });
    m.remove();
    assert.equal(m.read(), '{"crossSessionInbound":"accept"}');
  } finally {
    m.done();
  }
});

test('asked twice, the record keeps what was there before the first', () => {
  const m = machine();
  try {
    m.write('{"crossSessionInbound":"refuse"}');
    acceptSessionMessages(m.home);
    assert.equal(acceptSessionMessages(m.home).status, 'already');
    assert.equal(readManifest(m.home).settings.length, 1);
    assert.equal(readManifest(m.home).settings[0].previous, 'refuse');
    m.remove();
    assert.equal(m.read(), '{"crossSessionInbound":"refuse"}');
  } finally {
    m.done();
  }
});

test('a value the user changed after the install is theirs: uninstall keeps it and says so', () => {
  const m = machine();
  try {
    m.write('{}');
    acceptSessionMessages(m.home);
    m.write('{"crossSessionInbound":"hold"}');
    const result = m.remove();
    assert.deepEqual(result.settingsKept, [m.settings]);
    assert.equal(m.read(), '{"crossSessionInbound":"hold"}');
  } finally {
    m.done();
  }
});

test('a settings file that is not a JSON object is not touched and nothing is recorded', () => {
  const m = machine();
  try {
    m.write('{ not json');
    assert.deepEqual(acceptSessionMessages(m.home), { status: 'skipped', path: m.settings, reason: 'malformed JSON' });
    assert.equal(m.read(), '{ not json');
    assert.equal(readManifest(m.home)?.settings, undefined);
  } finally {
    m.done();
  }
});

// The verifier's advisory A1 (2026-10-14): the record was written before the file, so a write that failed
// left one, and a later uninstall would take a value the user set by hand for this command's.
test('a settings file that cannot be written is skipped with the reason, and nothing is recorded', () => {
  const m = machine();
  try {
    m.write('{"model":"opus"}');
    // Injected, not a read-only mode, which a root user writes through (Codex's finding of 2026-10-14).
    const writeFile = () => {
      throw Object.assign(new Error('denied'), { code: 'EPERM' });
    };
    const result = acceptSessionMessages(m.home, { writeFile });
    assert.deepEqual(result, { status: 'skipped', path: m.settings, reason: 'not writable (EPERM)' });
    assert.equal(m.read(), '{"model":"opus"}');
    assert.equal(readManifest(m.home)?.settings, undefined);
  } finally {
    m.done();
  }
});

// Codex's finding of 2026-10-14: a setting written and then not recorded could never be put back.
test('when the record cannot be written, the settings file goes back to its bytes, or away when this made it', () => {
  const m = machine();
  try {
    const record = () => {
      throw Object.assign(new Error('full'), { code: 'ENOSPC' });
    };
    m.write('{\r\n  "model": "opus"\r\n}\r\n');
    const kept = acceptSessionMessages(m.home, { record });
    assert.deepEqual(kept, { status: 'skipped', path: m.settings, reason: 'not recorded in the manifest (ENOSPC), so the file was put back' });
    assert.equal(m.read(), '{\r\n  "model": "opus"\r\n}\r\n');
    fs.rmSync(m.settings);
    assert.equal(acceptSessionMessages(m.home, { record }).status, 'skipped');
    assert.equal(fs.existsSync(m.settings), false);
  } finally {
    m.done();
  }
});

// Advisory A2: asked again after the user changed the value, it says what it replaces now.
test('asked again after the user changed the value, it says what it replaced, and uninstall still gives back the first one', () => {
  const m = machine();
  try {
    m.write('{}');
    acceptSessionMessages(m.home);
    m.write('{"crossSessionInbound":"hold"}');
    assert.deepEqual(acceptSessionMessages(m.home), { status: 'written', path: m.settings, was: 'hold' });
    m.remove();
    assert.equal(m.read(), '{}');
  } finally {
    m.done();
  }
});

test('install and sync carry the record forward, so a later uninstall still puts the setting back', () => {
  const m = machine();
  try {
    m.write('{"crossSessionInbound":"hold"}');
    install(m.home, '0.0.0-test');
    acceptSessionMessages(m.home);
    install(m.home, '0.0.0-test');
    sync(m.home, '0.0.0-test');
    assert.equal(readManifest(m.home).settings.length, 1);
    m.remove();
    assert.equal(JSON.parse(m.read()).crossSessionInbound, 'hold');
  } finally {
    m.done();
  }
});
