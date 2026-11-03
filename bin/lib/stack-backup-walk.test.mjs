import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { copyAndHash, hashFile, inside, plainCount, powershellCount, walkRoot } from './stack-backup-walk.mjs';

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-backup-walk-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

const sha = (data) => createHash('sha256').update(data).digest('hex');

/** A link to the folder `target` at `at`: a junction on Windows, which needs no privilege, a symlink elsewhere; the
 * reason when this machine cannot make one. */
function linkFolder(target, at) {
  try {
    fs.symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir');
    return null;
  } catch (error) {
    return error.code ?? error.message;
  }
}

test('walkRoot lists every file with posix paths, keeps the top-level filters, and reads an absent root as not present', (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'root', 'settings.json'), '{}');
  write(path.join(dir, 'root', 'agents', 'a.md'), 'a');
  write(path.join(dir, 'root', 'projects', 'p', 't.jsonl'), 't');
  const root = path.join(dir, 'root');
  assert.deepEqual(walkRoot(root, {}).files.map((f) => f.path).sort(), ['agents/a.md', 'projects/p/t.jsonl', 'settings.json']);
  assert.deepEqual(walkRoot(root, { include: ['settings.json', 'agents'] }).files.map((f) => f.path).sort(), ['agents/a.md', 'settings.json']);
  assert.deepEqual(walkRoot(root, { exclude: ['settings.json', 'agents'] }).files.map((f) => f.path), ['projects/p/t.jsonl']);
  assert.deepEqual(walkRoot(path.join(dir, 'none'), {}), { present: false, files: [], links: [] });
  const one = walkRoot(path.join(root, 'settings.json'), {});
  assert.deepEqual(one.files.map((f) => [f.path, f.source]), [['settings.json', path.join(root, 'settings.json')]]);
});

test('walkRoot throws naming the folder it cannot read, never returning a shorter list', (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'ok', 'a.txt'), 'a');
  write(path.join(dir, 'locked', 'b.txt'), 'b');
  const locked = path.join(dir, 'locked');
  const fsx = {
    ...fs,
    readdirSync: (p, ...rest) => {
      if (path.resolve(p) === locked) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      return fs.readdirSync(p, ...rest);
    },
  };
  assert.throws(() => walkRoot(dir, {}, fsx), (error) => error.message.includes(locked) && /EACCES/.test(error.message));
});

test('walkRoot refuses an entry that is no file, folder or link, naming it', (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'odd'), '');
  const odd = path.join(dir, 'odd');
  const fsx = {
    ...fs,
    lstatSync: (p, ...rest) => {
      if (path.resolve(p) === odd) return { isFile: () => false, isDirectory: () => false, isSymbolicLink: () => false };
      return fs.lstatSync(p, ...rest);
    },
  };
  assert.throws(() => walkRoot(dir, {}, fsx), new RegExp(`${odd.replace(/[\\.]/g, '\\$&')}.*neither a file, a folder nor a link`));
});

test(`walkRoot records a ${process.platform === 'win32' ? 'junction' : 'symlink'} as a link with its target and never follows it`, (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'outside', 'big.bin'), 'x'.repeat(100));
  write(path.join(dir, 'root', 'a.txt'), 'a');
  const why = linkFolder(path.join(dir, 'outside'), path.join(dir, 'root', 'linked'));
  if (why) return t.skip(`this machine cannot make a folder link: ${why}`);
  const walked = walkRoot(path.join(dir, 'root'), {});
  assert.deepEqual(walked.files.map((f) => f.path), ['a.txt']);
  assert.equal(walked.links.length, 1);
  assert.equal(walked.links[0].path, 'linked');
  assert.equal(path.resolve(walked.links[0].target), path.resolve(dir, 'outside'));
  assert.deepEqual(plainCount({ from: path.join(dir, 'root') }), { files: 1, bytes: 1 });
  if (process.platform === 'win32') assert.deepEqual(powershellCount({ from: path.join(dir, 'root') }), { files: 1, bytes: 1 });
});

test('copyAndHash copies byte for byte, keeps the time, and flags a key even across its chunk boundary', (t) => {
  const dir = scratch(t);
  const key = 'ctx7sk-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  const text = `${'a '.repeat(40)}${key} trailing words\n`;
  write(path.join(dir, 'k.txt'), text);
  const out = path.join(dir, 'copy', 'k.txt');
  const copied = copyAndHash(path.join(dir, 'k.txt'), out, { chunk: 64 });
  assert.equal(fs.readFileSync(out, 'utf8'), text);
  assert.deepEqual(copied, { bytes: Buffer.byteLength(text), sha256: sha(text), flagged: true });
  assert.equal(hashFile(out), sha(text));
  assert.equal(Math.round(fs.statSync(out).mtimeMs / 1000), Math.round(fs.statSync(path.join(dir, 'k.txt')).mtimeMs / 1000));

  write(path.join(dir, 'plain.txt'), 'nothing secret here\n');
  assert.equal(copyAndHash(path.join(dir, 'plain.txt'), path.join(dir, 'copy', 'plain.txt')).flagged, false);
  // A binary file is not read as text: a store such as engram's is copied, never classified by its bytes.
  write(path.join(dir, 'store.db'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(key)]));
  assert.equal(copyAndHash(path.join(dir, 'store.db'), path.join(dir, 'copy', 'store.db')).flagged, false);
});

test('copyAndHash reads a UTF-16 text with its byte order mark for a key, as PowerShell writes one', (t) => {
  // The independent verifier on 84997f7..45d764f: its NUL bytes read as binary, so a key in it was never seen.
  const dir = scratch(t);
  const key = 'sk-ant-oat01-FAKEtokenFAKEtokenFAKEtoken0123456789';
  write(path.join(dir, 'token.txt'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`token = ${key}\r\n`, 'utf16le')]));
  assert.equal(copyAndHash(path.join(dir, 'token.txt'), path.join(dir, 'copy', 'token.txt'), { chunk: 16 }).flagged, true);
});

test('copyAndHash writes a chunk whole when a write takes part of it, and throws naming the file when one takes none', (t) => {
  const dir = scratch(t);
  const text = 'abcdefghijklmnopqrstuvwxyz\n'.repeat(5);
  write(path.join(dir, 'k.txt'), text);
  // A disk near full takes a few bytes a write; the copy goes on with the rest of the chunk (Codex P2 on 84997f7..0b9f98a).
  const short = { ...fs, writeSync: (fd, buffer, offset = 0, length = buffer.length - offset) => fs.writeSync(fd, buffer, offset, Math.min(length, 7)) };
  const out = path.join(dir, 'copy', 'k.txt');
  assert.equal(copyAndHash(path.join(dir, 'k.txt'), out, { fsx: short, chunk: 32 }).sha256, sha(text));
  assert.equal(fs.readFileSync(out, 'utf8'), text);
  const full = { ...fs, writeSync: () => 0 };
  const stuck = path.join(dir, 'copy', 'stuck.txt');
  assert.throws(() => copyAndHash(path.join(dir, 'k.txt'), stuck, { fsx: full }), (error) => error.message.includes(stuck));
});

test('copyAndHash keeps the source\'s mode outside Windows, so a backed-up program still runs once restored', (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'tool'), '#!/bin/sh\necho hi\n');
  const modes = [];
  // The mode a chmod is asked for, read through a seam: Windows keeps only a read-only bit, so the real one is read on POSIX.
  const fsx = { ...fs, statSync: (file) => Object.assign(fs.statSync(file), file.endsWith('tool') ? { mode: 0o100755 } : {}), chmodSync: (file, mode) => modes.push([path.basename(file), mode]) };
  copyAndHash(path.join(dir, 'tool'), path.join(dir, 'copy', 'tool'), { fsx, platform: 'linux' });
  assert.deepEqual(modes, [['tool', 0o755]]);
  modes.length = 0;
  copyAndHash(path.join(dir, 'tool'), path.join(dir, 'copy', 'tool-win'), { fsx, platform: 'win32' });
  assert.deepEqual(modes, [], 'on Windows a mode is a read-only bit, which a scratch drill could not then remove');
});

test('copyAndHash really keeps an executable bit', { skip: process.platform === 'win32' && 'Windows has no executable bit' }, (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'tool'), '#!/bin/sh\n');
  fs.chmodSync(path.join(dir, 'tool'), 0o755);
  copyAndHash(path.join(dir, 'tool'), path.join(dir, 'copy', 'tool'));
  assert.equal(fs.statSync(path.join(dir, 'copy', 'tool')).mode & 0o777, 0o755);
});

test('inside tells a path within a folder from a sibling with the same prefix, case-blind on Windows', () => {
  assert.equal(inside('/h/.js-harness/x', '/h/.js-harness', 'linux'), true);
  assert.equal(inside('/h/.js-harness', '/h/.js-harness', 'linux'), true);
  assert.equal(inside('/h/.js-harness-other/x', '/h/.js-harness', 'linux'), false);
  assert.equal(inside('C:\\Users\\A\\.JS-HARNESS\\x', 'C:\\Users\\a\\.js-harness', 'win32'), true);
});

test('plainCount and the PowerShell count agree on a tree, filters included', { skip: process.platform !== 'win32' && 'PowerShell is the default count on Windows only' }, (t) => {
  const dir = scratch(t);
  write(path.join(dir, 'settings.json'), '{"a":1}');
  write(path.join(dir, 'agents', 'deep', 'a.md'), 'agent text');
  write(path.join(dir, '.hidden', 'h.txt'), 'hh');
  write(path.join(dir, 'projects', 't.jsonl'), 'tt');
  for (const root of [{ from: dir }, { from: dir, include: ['settings.json', 'agents'] }, { from: dir, exclude: ['settings.json', 'agents'] }, { from: path.join(dir, 'settings.json') }, { from: path.join(dir, 'gone') }]) {
    assert.deepEqual(powershellCount(root), plainCount(root), JSON.stringify(root));
  }
  assert.deepEqual(plainCount({ from: dir }), { files: 4, bytes: 7 + 10 + 2 + 2 });
  // A path past 260 characters, which Node reads and Windows PowerShell's .NET reads only through the \\?\ prefix.
  let deep = path.join(dir, 'long');
  while (deep.length < 300) deep = path.join(deep, 'a-forty-character-folder-name-for-depth');
  write(path.join(deep, 'f.txt'), 'deep');
  assert.deepEqual(powershellCount({ from: path.join(dir, 'long') }), { files: 1, bytes: 4 });
  assert.deepEqual(plainCount({ from: path.join(dir, 'long') }), { files: 1, bytes: 4 });
});
