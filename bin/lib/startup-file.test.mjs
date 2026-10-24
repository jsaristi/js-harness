import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readManifest, uninstall } from './manifest.mjs';
import { batchText, removeStartupFile, startupLocation, writeStartupFile } from './startup-file.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');

test('batchText writes a batch file: @echo off, the rem line, a chcp line only for a command beyond ASCII, CRLF throughout', () => {
  assert.equal(batchText('Says what it does.', 'node.exe x.mjs'), '@echo off\r\nrem Says what it does.\r\nnode.exe x.mjs\r\n');
  assert.equal(batchText('Says it.', 'node.exe D:\\año\\x.mjs'), '@echo off\r\nrem Says it.\r\nchcp 65001 >nul\r\nnode.exe D:\\año\\x.mjs\r\n');
});

/** An APPDATA whose Startup folder exists, and a home for the machine manifest. */
function places({ startup = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-startup-'));
  const appData = path.join(root, 'AppData');
  const dir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  if (startup) fs.mkdirSync(dir, { recursive: true });
  const home = path.join(root, 'home');
  fs.mkdirSync(home);
  return { env: { APPDATA: appData }, home, dir, file: path.join(dir, 'js-harness-wake-x.cmd') };
}
const recorded = (home, file) => readManifest(home)?.optional?.find((entry) => entry.path === file);

test('the file goes in the Startup folder of APPDATA, and nowhere without one', () => {
  const { env, dir } = places();
  assert.deepEqual(startupLocation(env, 'a.cmd'), { dir, file: path.join(dir, 'a.cmd') });
  assert.match(startupLocation({}, 'a.cmd').why, /APPDATA is not set/);
});

test('a written file is recorded with its sha256, and writing the same content again changes nothing', () => {
  const { env, home, file } = places();
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' }), { file, written: true });
  assert.equal(fs.readFileSync(file, 'utf8'), 'one\r\n');
  assert.deepEqual(recorded(home, file), { path: file, sha256: sha('one\r\n') });
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' }), { file, written: false });
});

test('a file js-harness recorded is replaced with new content; one it did not write, or one changed since, is refused and kept', () => {
  const { env, home, file } = places();
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' });
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'two\r\n' }), { file, written: true });
  assert.equal(recorded(home, file).sha256, sha('two\r\n'));
  fs.writeFileSync(file, 'edited by hand');
  assert.match(writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'three\r\n' }).refusal, /was changed since js-harness wrote it/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'edited by hand');
  const other = places();
  fs.writeFileSync(other.file, 'the user\'s own');
  assert.match(writeStartupFile({ env: other.env, home: other.home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' }).refusal, /a file js-harness did not write/);
  assert.equal(fs.readFileSync(other.file, 'utf8'), 'the user\'s own');
  assert.equal(recorded(other.home, other.file), undefined);
});

test('a missing Startup folder is refused, and nothing is created', () => {
  const { env, home, dir } = places({ startup: false });
  assert.match(writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' }).refusal, /Startup folder does not exist/);
  assert.equal(fs.existsSync(dir), false);
  assert.equal(readManifest(home), null);
});

test('removal takes the file and its record; a file changed since is kept; nothing there is already off', () => {
  const { env, home, file } = places();
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' });
  assert.deepEqual(removeStartupFile({ env, home, name: 'js-harness-wake-x.cmd' }), { file, removed: true });
  assert.equal(fs.existsSync(file), false);
  assert.equal(recorded(home, file), undefined);
  assert.deepEqual(removeStartupFile({ env, home, name: 'js-harness-wake-x.cmd' }), { file, removed: false });
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' });
  fs.writeFileSync(file, 'edited by hand');
  assert.match(removeStartupFile({ env, home, name: 'js-harness-wake-x.cmd' }).refusal, /was changed since js-harness wrote it/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'edited by hand');
});

test('uninstall removes a written Startup file and its record, and keeps one changed since', () => {
  const { env, home, file } = places();
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' });
  uninstall(home);
  assert.equal(fs.existsSync(file), false);
  assert.equal(recorded(home, file), undefined);
  const other = places();
  writeStartupFile({ env: other.env, home: other.home, name: 'js-harness-wake-x.cmd', content: 'one\r\n' });
  fs.writeFileSync(other.file, 'edited by hand');
  uninstall(other.home);
  assert.equal(fs.readFileSync(other.file, 'utf8'), 'edited by hand');
});

test('a file the manifest cannot record is removed again, and the refusal says so', () => {
  const { env, home, file } = places();
  const record = () => {
    throw new Error('disk full');
  };
  const result = writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: 'one\r\n', record });
  assert.match(result.refusal, /could not be recorded in the machine manifest \(disk full\), so the file written was removed again/);
  assert.equal(fs.existsSync(file), false);
});

// The Opus verifier of slice B: a caller that wraps the error of a malformed manifest goes on after it (remote stop
// --at-login stops the server), so its text names the file and claims nothing of what was or was not changed.
test('a machine manifest that does not parse is named, and its error claims nothing of what the caller changes', () => {
  const { env, home } = places();
  fs.mkdirSync(path.join(home, '.js-harness'));
  fs.writeFileSync(path.join(home, '.js-harness', 'manifest.json'), '{');
  const { refusal } = removeStartupFile({ env, home, name: 'js-harness-wake-x.cmd' });
  assert.match(refusal, /manifest\.json is not valid JSON\)$/);
  assert.doesNotMatch(refusal, /nothing was changed/);
});
