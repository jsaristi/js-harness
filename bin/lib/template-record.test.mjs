import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RENDERED_SCHEMA, SHOWN_SCHEMA, appendRecord, normalText, readRecord, recordRendered, recordShown, renderedFile, shownFile,
} from './template-record.mjs';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function scratch(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-record-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('both records live in the throughput folder of the project, beside the page record', () => {
  assert.equal(renderedFile('/h', 'D--js-harness'), path.join('/h', '.js-harness', 'throughput', 'D--js-harness', 'templates-rendered.jsonl'));
  assert.equal(shownFile('/h', 'D--js-harness'), path.join('/h', '.js-harness', 'throughput', 'D--js-harness', 'templates-shown.jsonl'));
});

test('normalText reads CRLF as LF and cuts trailing spaces of each line and the blank lines at the end', () => {
  assert.equal(normalText('<p>a</p>  \r\n<p>b</p>\t\r\n\r\n'), '<p>a</p>\n<p>b</p>');
  assert.equal(normalText('x'), 'x');
});

test('recordRendered reads the bytes the command wrote and appends their sha256, their normal hash and the moment', () => {
  scratch((dir) => {
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, '<p>hola</p>\r\n');
    const file = renderedFile(dir, 'p');
    const line = recordRendered(file, { template: 'stretch-return', subject: 's-1', path: page, at: '2026-10-29T05:00:00.000Z', head: 'abc1234' });
    assert.deepEqual(line, {
      schema: RENDERED_SCHEMA, template: 'stretch-return', subject: 's-1', sha256: sha('<p>hola</p>\r\n'), normal: sha('<p>hola</p>'),
      bytes: 13, at: '2026-10-29T05:00:00.000Z', head: 'abc1234', path: page,
    });
    assert.deepEqual(readRecord(file, RENDERED_SCHEMA), [line]);
  });
});

test('recordRendered throws when the page cannot be read, and writes nothing', () => {
  scratch((dir) => {
    const file = renderedFile(dir, 'p');
    assert.throws(() => recordRendered(file, { template: 't', subject: 's', path: path.join(dir, 'none.html'), at: '2026-10-29T05:00:00.000Z', head: 'h' }), /ENOENT/);
    assert.equal(fs.existsSync(file), false);
  });
});

test('recordRendered refuses a call without its template, subject or path', () => {
  assert.throws(() => recordRendered('/x', { subject: 's', path: '/p', at: 'a', head: 'h' }), /template/);
});

test('recordRendered refuses a time that does not parse, which could never admit its page, and writes nothing', () => {
  scratch((dir) => {
    const file = renderedFile(dir, 'p');
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, '<p>x</p>');
    for (const at of [undefined, '', 'yesterday', 7]) {
      assert.throws(() => recordRendered(file, { template: 't', subject: 's', path: page, at, head: 'h' }), /recordRendered: at must be a time/);
    }
    assert.equal(fs.existsSync(file), false);
  });
});

test('a line left without its newline is ended before the next, and a line that does not parse is skipped', () => {
  scratch((dir) => {
    const file = shownFile(dir, 'p');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"schema":"js-harness.shown/v1","decision":"cut');
    const line = recordShown(file, { at: 'a', session: 's', tool: 'Artifact', template: null, subject: null, decision: 'free', sha256: 'f', reason: 'a research page for him' });
    assert.equal(fs.readFileSync(file, 'utf8').split('\n').length, 3);
    assert.deepEqual(readRecord(file, SHOWN_SCHEMA), [line]);
  });
});

test('recordShown refuses a decision it does not know', () => {
  assert.throws(() => recordShown('/x', { decision: 'maybe' }), /decision/);
});

test('readRecord gives none when there is no file, and keeps only lines of its schema', () => {
  scratch((dir) => {
    const file = path.join(dir, 'r.jsonl');
    assert.deepEqual(readRecord(file, SHOWN_SCHEMA), []);
    appendRecord(file, { schema: 'other/v1' });
    appendRecord(file, { schema: SHOWN_SCHEMA, decision: 'shown' });
    assert.deepEqual(readRecord(file, SHOWN_SCHEMA), [{ schema: SHOWN_SCHEMA, decision: 'shown' }]);
  });
});

test('two writers of 200 lines each at once leave 400 whole lines', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-record-'));
  try {
    const file = path.join(dir, 'r.jsonl');
    const module = new URL('./template-record.mjs', import.meta.url).href;
    const writer = (name) => new Promise((resolve, reject) => {
      const code = `const { appendRecord } = await import(${JSON.stringify(module)});`
        + `for (let i = 0; i < 200; i += 1) appendRecord(${JSON.stringify(file)}, { schema: 'w/v1', name: ${JSON.stringify(name)}, i, pad: 'x'.repeat(300) });`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: 'inherit' });
      child.on('exit', (status) => (status === 0 ? resolve() : reject(new Error(`writer ${name} exited ${status}`))));
    });
    await Promise.all([writer('a'), writer('b')]);
    const lines = readRecord(file, 'w/v1');
    assert.equal(lines.length, 400);
    assert.equal(lines.filter((line) => line.name === 'a').length, 200);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
