import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readManifest, uninstall } from './manifest.mjs';
import { batchName, hiddenLauncherCommand, hiddenLauncherText, removeStartupFile, startupLocation, writeStartupFile } from './startup-file.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');

test('hiddenLauncherText writes a VBScript file that runs the command with no window: the remark, then one Run line, CRLF throughout', () => {
  assert.equal(
    hiddenLauncherText('Says what it does.', '"C:\\node.exe" x.mjs --name p'),
    '\' Says what it does.\r\nCreateObject("WScript.Shell").Run """C:\\node.exe"" x.mjs --name p", 0, False\r\n',
  );
});

test('hiddenLauncherText writes every letter beyond printable ASCII as ChrW, so the file reads the same under any code page', () => {
  const text = hiddenLauncherText('Says it.', '"C:\\Año\\node.exe" D:\\ñandú 😀\\x.mjs');
  assert.match(text, /^[\x20-\x7e\r\n]*$/, 'the file is printable ASCII and line ends');
  assert.equal(
    text.split('\r\n')[1],
    'CreateObject("WScript.Shell").Run """C:\\A" & ChrW(241) & "o\\node.exe"" D:\\" & ChrW(241) & "and" & ChrW(250) & " " & ChrW(55357) & ChrW(56832) & "\\x.mjs", 0, False',
  );
});

test('hiddenLauncherCommand reads back the command of every launcher hiddenLauncherText writes, and nothing else', () => {
  for (const command of ['"C:\\node.exe" x.mjs', '"C:\\Año\\node.exe" "D:\\ñandú 😀\\x.mjs" --cwd D:\\', 'ñ', '""', 'a""b']) {
    assert.equal(hiddenLauncherCommand(hiddenLauncherText('Says it.', command)), command, command);
  }
  const run = (expression) => `' x\r\nCreateObject("WScript.Shell").Run ${expression}, 0, False\r\n`;
  const others = {
    'an empty file': '',
    'a batch file': '@echo off\r\n"C:\\node.exe" x.mjs start --cwd D:\\p\r\n',
    'only the remark': '\' CreateObject("WScript.Shell").Run "x", 0, False\r\n',
    'a Run with a window': '\' x\r\nCreateObject("WScript.Shell").Run "x", 1, False\r\n',
    'a string that never closes': run('"x'),
    'a lone quote inside a string': run('"a"b"'),
    'a ChrW of no number': run('"a" & ChrW(x)'),
    'a ChrW beyond a code unit': run('"a" & ChrW(65536)'),
    'something that is not a string': run('"a" & Environ("PATH")'),
    'two strings with no &': run('"a" "b"'),
  };
  for (const [what, text] of Object.entries(others)) assert.equal(hiddenLauncherCommand(text), null, what);
});

test('batchName is the name the batch launcher of the same file had, before launchers opened no window', () => {
  assert.equal(batchName('js-harness-wake-x.vbs'), 'js-harness-wake-x.cmd');
});

// A real Windows Script Host, as the Startup folder runs a .vbs: the command reaches node whole. That it opens no
// window was measured by hand (odd/tasks/login-launchers.md, L3): a window handle is not something a test can read.
test('a launcher run by the real wscript.exe hands node its arguments intact, through a space and a letter beyond ASCII', { skip: process.platform === 'win32' ? false : 'wscript.exe only', timeout: 60000 }, async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-startup-')), 'lanzador ñ');
  fs.mkdirSync(dir);
  const script = path.join(dir, 'fake ñandú.mjs');
  fs.writeFileSync(script, "import fs from 'node:fs';\nfs.writeFileSync(new URL('./args.json', import.meta.url), JSON.stringify(process.argv.slice(2)));\n");
  const launcher = path.join(dir, 'launcher.vbs');
  fs.writeFileSync(launcher, hiddenLauncherText('A test.', `"${process.execPath}" "${script}" start --cwd "${dir}" --name café`));
  const wscript = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'wscript.exe');
  const ran = (await import('node:child_process')).spawnSync(wscript, ['//B', '//Nologo', launcher], { windowsHide: true, timeout: 30000 });
  assert.equal(ran.status, 0, String(ran.stderr));
  const received = path.join(dir, 'args.json');
  for (let waited = 0; !fs.existsSync(received) && waited < 20000; waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(JSON.parse(fs.readFileSync(received, 'utf8')), ['start', '--cwd', dir, '--name', 'café']);
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

test('writing with replaces removes the earlier file js-harness recorded, with its record, after the new one is written', () => {
  const { env, home, dir } = places();
  const old = path.join(dir, 'js-harness-wake-x.cmd');
  const file = path.join(dir, 'js-harness-wake-x.vbs');
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: '@echo off\r\n' });
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.vbs', content: 'new\r\n', replaces: 'js-harness-wake-x.cmd' }), { file, written: true, replaced: old });
  assert.deepEqual(fs.readdirSync(dir), ['js-harness-wake-x.vbs']);
  assert.deepEqual(readManifest(home).optional, [{ path: file, sha256: sha('new\r\n') }]);
  // Nothing to replace: as a write without it. A record whose file is gone is forgotten all the same.
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.vbs', content: 'new\r\n', replaces: 'js-harness-wake-x.cmd' }), { file, written: false });
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: '@echo off\r\n' });
  fs.rmSync(old);
  assert.deepEqual(writeStartupFile({ env, home, name: 'js-harness-wake-x.vbs', content: 'new\r\n', replaces: 'js-harness-wake-x.cmd' }), { file, written: false });
  assert.equal(recorded(home, old), undefined);
});

test('writing with replaces refuses, writing nothing, when the earlier file is not one js-harness recorded writing, or was changed since', () => {
  for (const [what, arrange, says] of [
    ['changed since', (env, home, old) => { writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: '@echo off\r\n' }); fs.writeFileSync(old, 'edited'); }, /was changed since js-harness wrote it/],
    ['not recorded', (env, home, old) => fs.writeFileSync(old, 'the user\'s own'), /not one js-harness recorded writing/],
  ]) {
    const { env, home, dir } = places();
    const old = path.join(dir, 'js-harness-wake-x.cmd');
    arrange(env, home, old);
    const before = readManifest(home);
    const { refusal } = writeStartupFile({ env, home, name: 'js-harness-wake-x.vbs', content: 'new\r\n', replaces: 'js-harness-wake-x.cmd' });
    assert.match(refusal, says, what);
    assert.ok(refusal.includes(old), refusal);
    assert.deepEqual(fs.readdirSync(dir), ['js-harness-wake-x.cmd'], `${what}: the new file is not written`);
    assert.deepEqual(readManifest(home), before, what);
  }
});

test('writing with replaces puts the new file back as it was when the earlier one cannot be removed', () => {
  const { env, home, dir } = places();
  const old = path.join(dir, 'js-harness-wake-x.cmd');
  writeStartupFile({ env, home, name: 'js-harness-wake-x.cmd', content: '@echo off\r\n' });
  const before = readManifest(home);
  const forget = () => {
    throw new Error('disk full');
  };
  const { refusal } = writeStartupFile({ env, home, name: 'js-harness-wake-x.vbs', content: 'new\r\n', replaces: 'js-harness-wake-x.cmd', forget });
  assert.match(refusal, /disk full/);
  assert.deepEqual(fs.readdirSync(dir), ['js-harness-wake-x.cmd'], 'the earlier file is back and the new one gone');
  assert.equal(fs.readFileSync(old, 'utf8'), '@echo off\r\n');
  assert.deepEqual(readManifest(home), before);
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
