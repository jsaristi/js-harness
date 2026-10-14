// How `check` ends its process. The first run of the gate on GitHub's Linux (pull request 109) printed the
// output of a failed suite and lost its end: no failing test and no summary reached the log, because the
// process exited while the write to its pipe was still under way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { exitWhenWritten } from './check.mjs';

test('check exits only once what it printed has been written, to every stream it names, in order', () => {
  const calls = [];
  const pending = [];
  const stream = (name) => ({
    write: (chunk, done) => {
      calls.push(`write ${name}`);
      pending.push(done);
      return false;
    },
  });
  exitWhenWritten(1, { streams: [stream('stdout'), stream('stderr')], exit: (code) => calls.push(`exit ${code}`) });
  assert.deepEqual(calls, ['write stdout'], 'nothing exits while stdout is still being written');
  pending.shift()();
  assert.deepEqual(calls, ['write stdout', 'write stderr']);
  pending.shift()();
  assert.deepEqual(calls, ['write stdout', 'write stderr', 'exit 1']);
});

test('a stream that cannot be written any more still lets check exit, with its own code', () => {
  const exited = [];
  const broken = { write: (chunk, done) => done(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })) };
  exitWhenWritten(2, { streams: [broken], exit: (code) => exited.push(code) });
  assert.deepEqual(exited, [2]);
});

test('the whole output of a failed sensor reaches the reader of a pipe, its last line included', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-check-exit-'));
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# A project\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'p', private: true, scripts: { test: 'node loud.js' } }));
    // About 2 MB, far more than a pipe holds at once, and then the line its reader must still see.
    fs.writeFileSync(
      path.join(dir, 'loud.js'),
      "for (let i = 0; i < 20000; i += 1) console.log('line ' + i + ' ' + 'x'.repeat(90));\nconsole.log('THE LAST LINE');\nprocess.exitCode = 1;\n",
    );
    // The child runs its sensors as the gate of a turn already held, with no load sample and no gate log, so
    // it takes no lock of the machine and writes nothing outside its folder.
    const env = { ...process.env, JS_HARNESS_GATE_HELD: '1', JS_HARNESS_GATE_LOAD: 'off', JS_HARNESS_GATE_LOG: 'off' };
    delete env.JS_HARNESS_CHECK_INNER;
    const check = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check.mjs');
    const child = spawn(process.execPath, [check, '--cwd', dir, '--home', dir], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.resume();
    const status = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(status, 1);
    assert.match(stdout, /FAIL {2}tests/);
    assert.match(stdout, /line 19999 x+\r?\nTHE LAST LINE/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
