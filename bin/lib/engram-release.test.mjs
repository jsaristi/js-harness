import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { swapBackEngram, updateEngramBinary } from './engram-release.mjs';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const UPDATE = {
  tool: 'engram', dimension: 'upToDate', kind: 'binary', bin: 'engram', from: '3.6.1', to: '3.6.2',
  asset: 'engram_3.6.2_windows_amd64.zip', release: 'https://github.com/Gentleman-Programming/engram/releases/download/v3.6.2',
};
const ARCHIVE = Buffer.from('the archive bytes');
const NEW_EXE = 'new engram 3.6.2';

/** A folder with `engram.exe` (the running 3.6.1) and the seams of one update: `fetch` serves the archive and its
 * checksums, `spawn` extracts (it writes `extracted` into tar's -C folder) and answers `engram version` with the
 * content of the file it runs. */
function machine({ checksum = sha(ARCHIVE), extracted = NEW_EXE, answers } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-engram-release-'));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const exe = path.join(bin, 'engram.exe');
  fs.writeFileSync(exe, 'old engram 3.6.1');
  const fetched = [];
  const spawned = [];
  const fetch = async (url) => {
    fetched.push(url);
    if (url.endsWith('/checksums.txt')) return { ok: true, status: 200, text: async () => `${checksum}  ${UPDATE.asset}\n0000  engram_3.6.2_linux_amd64.tar.gz\n` };
    if (url.endsWith(`/${UPDATE.asset}`)) return { ok: true, status: 200, arrayBuffer: async () => ARCHIVE.buffer.slice(ARCHIVE.byteOffset, ARCHIVE.byteOffset + ARCHIVE.length) };
    return { ok: false, status: 404 };
  };
  const spawn = (file, args) => {
    spawned.push([file, ...args]);
    if (/tar(\.exe)?$/i.test(file)) {
      const into = args[args.indexOf('-C') + 1];
      if (extracted !== null) fs.writeFileSync(path.join(into, 'engram.exe'), extracted);
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'version') {
      const text = fs.readFileSync(file, 'utf8');
      return { status: 0, stdout: answers ?? `engram ${text.split(' ').at(-1)}\n`, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
  return { root, bin, exe, fetch, spawn, fetched, spawned, deps: { fetch, spawn, locate: () => exe, platform: 'win32', tmp: root, systemRoot: 'C:\\Windows' } };
}

test('the release is downloaded, checked, extracted, swapped in with the old exe kept, and verified by its version', async () => {
  const m = machine();
  try {
    const result = await updateEngramBinary(UPDATE, m.deps);
    assert.equal(result.ok, true, result.why);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), NEW_EXE);
    const backup = path.join(m.bin, 'engram-3.6.1.exe.bak');
    assert.equal(fs.readFileSync(backup, 'utf8'), 'old engram 3.6.1');
    assert.deepEqual(m.fetched, [`${UPDATE.release}/checksums.txt`, `${UPDATE.release}/${UPDATE.asset}`]);
    assert.equal(m.spawned[0][0], 'C:\\Windows\\System32\\tar.exe', 'Windows extracts a zip with its own bsdtar');
    assert.deepEqual(result.record, { path: m.exe, backup, sha256: sha(NEW_EXE) });
    assert.deepEqual(fs.readdirSync(m.root).sort(), ['bin'], 'the download folder is removed');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('an archive whose sha256 is not the release\'s replaces nothing', async () => {
  const m = machine({ checksum: 'f'.repeat(64) });
  try {
    const result = await updateEngramBinary(UPDATE, m.deps);
    assert.equal(result.ok, false);
    assert.match(result.why, /sha256/);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), 'old engram 3.6.1');
    assert.deepEqual(fs.readdirSync(m.bin), ['engram.exe']);
    assert.equal(m.spawned.length, 0, 'nothing is extracted');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('a release whose checksums do not name the archive replaces nothing', async () => {
  const m = machine();
  try {
    const result = await updateEngramBinary({ ...UPDATE, asset: 'engram_3.6.2_windows_arm64.zip' }, { ...m.deps, fetch: async (url) => (url.endsWith('checksums.txt') ? { ok: true, text: async () => 'abc  other.zip\n' } : m.fetch(url)) });
    assert.equal(result.ok, false);
    assert.match(result.why, /checksums\.txt does not name engram_3\.6\.2_windows_arm64\.zip/);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), 'old engram 3.6.1');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('a download that fails replaces nothing and says the address', async () => {
  const m = machine();
  try {
    const result = await updateEngramBinary(UPDATE, { ...m.deps, fetch: async () => ({ ok: false, status: 404 }) });
    assert.equal(result.ok, false);
    assert.match(result.why, /checksums\.txt: it answered 404: nothing was replaced/);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), 'old engram 3.6.1');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('an archive without the binary replaces nothing', async () => {
  const m = machine({ extracted: null });
  try {
    const result = await updateEngramBinary(UPDATE, m.deps);
    assert.equal(result.ok, false);
    assert.match(result.why, /holds no engram\.exe/);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), 'old engram 3.6.1');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('a new binary that does not answer its version is taken out and the old one put back', async () => {
  const m = machine({ answers: 'engram 3.6.1\n' });
  try {
    const result = await updateEngramBinary(UPDATE, m.deps);
    assert.equal(result.ok, false);
    assert.match(result.why, /answers engram 3\.6\.1, not 3\.6\.2: the old one is back/);
    assert.equal(fs.readFileSync(m.exe, 'utf8'), 'old engram 3.6.1');
    assert.deepEqual(fs.readdirSync(m.bin), ['engram.exe']);
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('a backup name already taken gets a number, never overwritten', async () => {
  const m = machine();
  try {
    fs.writeFileSync(path.join(m.bin, 'engram-3.6.1.exe.bak'), 'an earlier backup');
    const result = await updateEngramBinary(UPDATE, m.deps);
    assert.equal(result.ok, true, result.why);
    assert.equal(result.record.backup, path.join(m.bin, 'engram-3.6.1-2.exe.bak'));
    assert.equal(fs.readFileSync(path.join(m.bin, 'engram-3.6.1.exe.bak'), 'utf8'), 'an earlier backup');
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('no engram on the PATH replaces nothing', async () => {
  const m = machine();
  try {
    const result = await updateEngramBinary(UPDATE, { ...m.deps, locate: () => null });
    assert.equal(result.ok, false);
    assert.match(result.why, /no engram on the PATH/);
  } finally {
    fs.rmSync(m.root, { recursive: true, force: true });
  }
});

test('the swap back puts the backup in place and keeps the updated binary beside it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-engram-back-'));
  try {
    const exe = path.join(root, 'engram.exe');
    const backup = path.join(root, 'engram-3.6.1.exe.bak');
    fs.writeFileSync(exe, NEW_EXE);
    fs.writeFileSync(backup, 'old engram 3.6.1');
    const back = swapBackEngram({ to: '3.6.2', path: exe, backup });
    assert.equal(back.ok, true, back.why);
    assert.equal(fs.readFileSync(exe, 'utf8'), 'old engram 3.6.1');
    assert.equal(fs.readFileSync(path.join(root, 'engram-3.6.2.exe.bak'), 'utf8'), NEW_EXE);
    assert.equal(fs.existsSync(backup), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the swap back without its backup changes nothing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-engram-back-'));
  try {
    const exe = path.join(root, 'engram.exe');
    fs.writeFileSync(exe, NEW_EXE);
    const back = swapBackEngram({ to: '3.6.2', path: exe, backup: path.join(root, 'engram-3.6.1.exe.bak') });
    assert.equal(back.ok, false);
    assert.match(back.why, /no backup/);
    assert.equal(fs.readFileSync(exe, 'utf8'), NEW_EXE);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
