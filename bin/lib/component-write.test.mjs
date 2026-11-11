import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeComponent } from './component-write.mjs';

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-component-'));
  return { file: path.join(dir, 'skills', 'x', 'SKILL.md'), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a file with no record is written and recorded', () => {
  const s = scratch();
  try {
    assert.deepEqual(writeComponent(s.file, 'v2', undefined), { path: s.file, sha256: sha256('v2'), skipped: false });
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'v2');
  } finally {
    s.done();
  }
});

test('a recorded file he changed is left, and its record carried forward as his', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his');
    const previous = { path: s.file, sha256: sha256('v1'), skipped: false };
    assert.deepEqual(writeComponent(s.file, 'v2', previous), { path: s.file, sha256: sha256('v1'), skipped: true, edited: true, reason: 'changed since it was written' });
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his');
  } finally {
    s.done();
  }
});

// Codex on 0d97e52..98f9145 (P2): a read that failed for another reason than a missing file was taken as no file, and
// the file was written over unread. Only a missing file is written again; any other read failure leaves it.
test('a recorded file that cannot be read is left unread and unwritten, its record carried forward with the reason', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his');
    const previous = { path: s.file, sha256: sha256('v1'), skipped: false };
    const readFile = () => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    };
    const writes = [];
    const writeFile = (...args) => writes.push(args);
    assert.deepEqual(writeComponent(s.file, 'v2', previous, writeFile, readFile), { path: s.file, sha256: sha256('v1'), skipped: true, reason: 'not readable (EACCES)' });
    assert.deepEqual(writes, []);
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his');
  } finally {
    s.done();
  }
});

test('a recorded file he deleted is written again', () => {
  const s = scratch();
  try {
    const previous = { path: s.file, sha256: sha256('v1'), skipped: false };
    assert.deepEqual(writeComponent(s.file, 'v2', previous), { path: s.file, sha256: sha256('v2'), skipped: false });
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'v2');
  } finally {
    s.done();
  }
});

test('a failed write carries a record forward, and gives nothing for a file never recorded', () => {
  const s = scratch();
  try {
    const writeFile = () => {
      throw new Error('EBUSY: resource busy');
    };
    const previous = { path: s.file, sha256: sha256('v1'), skipped: false };
    assert.deepEqual(writeComponent(s.file, 'v2', previous, writeFile), { path: s.file, sha256: sha256('v1'), skipped: true, reason: 'EBUSY: resource busy' });
    assert.equal(writeComponent(s.file, 'v2', undefined, writeFile), null);
  } finally {
    s.done();
  }
});

// A first install wrote over whatever was at a component's path and kept no copy (the audit's L3): a file `uninstall`
// had left as the person's, or one of their own under the same name, was lost on the next install.
test('a file with no record that holds other text is copied beside itself before it is written over', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his own text');
    const copy = `${s.file}.before-js-harness-${sha256('his own text').slice(0, 8)}`;
    assert.deepEqual(writeComponent(s.file, 'v2', undefined), { path: s.file, sha256: sha256('v2'), skipped: false, replaced: copy });
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'v2');
    assert.equal(fs.readFileSync(copy, 'utf8'), 'his own text');
    // The same text put back and installed again: the copy is already there, and is not made twice.
    fs.writeFileSync(s.file, 'his own text');
    assert.deepEqual(writeComponent(s.file, 'v3', undefined), { path: s.file, sha256: sha256('v3'), skipped: false, replaced: copy });
    assert.deepEqual(fs.readdirSync(path.dirname(s.file)).sort(), ['SKILL.md', path.basename(copy)]);
  } finally {
    s.done();
  }
});

test('a file with no record that already holds the text to write gets no copy', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'v2');
    assert.deepEqual(writeComponent(s.file, 'v2', undefined), { path: s.file, sha256: sha256('v2'), skipped: false });
    assert.deepEqual(fs.readdirSync(path.dirname(s.file)), ['SKILL.md']);
  } finally {
    s.done();
  }
});

test('a file with no record is left as it is when its copy cannot be made, or when it cannot be read', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his own text');
    const noCopy = (target, ...rest) => {
      if (target !== s.file) throw new Error('ENOSPC: no space left');
      fs.writeFileSync(target, ...rest);
    };
    assert.equal(writeComponent(s.file, 'v2', undefined, noCopy), null);
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his own text');
    const unreadable = () => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    };
    assert.equal(writeComponent(s.file, 'v2', undefined, fs.writeFileSync, unreadable), null);
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his own text');
  } finally {
    s.done();
  }
});

// Codex on 62bb01f..99020c1: a copy under the right name was taken as whole. A run stopped while it wrote the copy
// (no space left) leaves a short one, and the next run then wrote over the original with that as its only copy.
test('a short copy that a stopped run left is made whole before the file is written over', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his own text');
    const copy = `${s.file}.before-js-harness-${sha256('his own text').slice(0, 8)}`;
    fs.writeFileSync(copy, 'his ow');
    assert.deepEqual(writeComponent(s.file, 'v2', undefined), { path: s.file, sha256: sha256('v2'), skipped: false, replaced: copy });
    assert.equal(fs.readFileSync(copy, 'utf8'), 'his own text');
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'v2');
  } finally {
    s.done();
  }
});

// The independent verifier on 62bb01f..db26cbd: the copy is named by eight characters of a hash, which two texts can
// share. A file under that name that is no beginning of this one is another file's copy, not a short copy of this
// one, and was written over: the first original was then nowhere.
test('a file under the copy name that is no beginning of this one is left, and nothing is written', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his own text');
    const copy = `${s.file}.before-js-harness-${sha256('his own text').slice(0, 8)}`;
    fs.writeFileSync(copy, 'another text, kept earlier');
    assert.equal(writeComponent(s.file, 'v2', undefined), null);
    assert.equal(fs.readFileSync(copy, 'utf8'), 'another text, kept earlier');
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his own text');
    // A longer file that begins with this one is no short copy of it either.
    fs.writeFileSync(copy, 'his own text and more');
    assert.equal(writeComponent(s.file, 'v2', undefined), null);
    assert.equal(fs.readFileSync(copy, 'utf8'), 'his own text and more');
    // An empty one is what a run stopped before its first byte leaves: made whole.
    fs.writeFileSync(copy, '');
    assert.equal(writeComponent(s.file, 'v2', undefined)?.replaced, copy);
    assert.equal(fs.readFileSync(copy, 'utf8'), 'his own text');
  } finally {
    s.done();
  }
});

test('the file is left as it is when the copy just written does not hold its bytes', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'his own text');
    // A write that ends short and reports no failure, for the copy alone.
    const short = (target, data, ...rest) => fs.writeFileSync(target, target === s.file ? data : String(data).slice(0, 3), ...rest);
    assert.equal(writeComponent(s.file, 'v2', undefined, short), null);
    assert.equal(fs.readFileSync(s.file, 'utf8'), 'his own text');
  } finally {
    s.done();
  }
});

test('a recorded file is never copied: its record says the harness wrote it', () => {
  const s = scratch();
  try {
    fs.mkdirSync(path.dirname(s.file), { recursive: true });
    fs.writeFileSync(s.file, 'v1');
    const previous = { path: s.file, sha256: sha256('v1'), skipped: false };
    assert.deepEqual(writeComponent(s.file, 'v2', previous), { path: s.file, sha256: sha256('v2'), skipped: false });
    assert.deepEqual(fs.readdirSync(path.dirname(s.file)), ['SKILL.md']);
  } finally {
    s.done();
  }
});
