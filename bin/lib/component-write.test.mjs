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
