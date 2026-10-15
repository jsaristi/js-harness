import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSensors } from './check.mjs';

// The rerun of odd/tasks/flaky-ledger.md (Design 2): after a red tests sensor, the test files its spec summary
// names are run once more, alone, through the same sensor route.

const RED = { status: 1, signal: null, stdout: '✖ failing tests:\n\ntest at bin/a.test.mjs:10:1\n✖ one (1ms)\n', stderr: '' };
const GREEN = { status: 0, signal: null, stdout: '', stderr: '' };

/** A project of two test files whose `test` script is `node --test`; `gate(answers, more)` runs its sensors with a
 * spawn that gives `answers` in turn and answers the rows and the commands spawned. */
function project(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-flaky-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({}));
  fs.mkdirSync(path.join(root, 'bin'));
  for (const name of ['a', 'b']) fs.writeFileSync(path.join(root, 'bin', `${name}.test.mjs`), '');
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  const gate = async (answers, more = {}) => {
    const commands = [];
    const spawn = async (command) => {
      commands.push(command);
      return answers[Math.min(commands.length - 1, answers.length - 1)];
    };
    return { rows: await checkSensors(root, { spawn, ...more }), commands };
  };
  return { gate, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a red suite that names its failed test files runs those files once more, alone, and the tests row keeps its text', async () => {
  const one = project();
  try {
    const { rows, commands } = await one.gate([RED, GREEN]);
    assert.deepEqual(commands, ['npm run test', 'node --test bin/a.test.mjs']);
    const tests = rows.find((row) => row.name === 'tests');
    assert.equal(tests.detail, 'npm run test exited 1');
    assert.equal(tests.pass, false, 'a file that passes on rerun with no entry in the ledger still blocks');
  } finally {
    one.done();
  }
});

test('a red suite that names no test file, and a green one, run nothing more', async () => {
  const one = project();
  try {
    assert.deepEqual((await one.gate([{ ...RED, stdout: 'npm ERR! code 1\n' }])).commands, ['npm run test']);
    assert.deepEqual((await one.gate([GREEN])).commands, ['npm run test']);
  } finally {
    one.done();
  }
});

const LEDGER = ['### bin/a.test.mjs', '- Owner: JH 10', '- Expires: 2026-11-15', '- Failure: eval-interrupt-process-alive', ''].join('\n');

test('a red suite whose failed file passes alone and is quarantined does not block, and a rerun row says why', async () => {
  const one = project({ 'docs/FLAKY.md': LEDGER });
  try {
    const { rows, commands } = await one.gate([RED, GREEN], { today: '2026-10-15' });
    assert.deepEqual(commands, ['npm run test', 'node --test bin/a.test.mjs']);
    const tests = rows.find((row) => row.name === 'tests');
    assert.equal(tests.pass, true);
    assert.equal(tests.detail, 'npm run test exited 1; its failed test file passed alone on rerun and is quarantined in docs/FLAKY.md (the rerun row)');
    const rerun = rows.find((row) => row.name === 'rerun');
    assert.equal(rerun.info, true);
    assert.deepEqual(rerun.lines, ['bin/a.test.mjs  quarantined until 2026-11-15 (eval-interrupt-process-alive)']);
    assert.ok(rows.indexOf(rerun) === rows.indexOf(tests) + 1, 'the rerun row follows the sensors');
  } finally {
    one.done();
  }
});

test('a quarantined file that fails again on rerun, or whose entry expired, blocks with the text of today', async () => {
  const one = project({ 'docs/FLAKY.md': LEDGER });
  try {
    const again = await one.gate([RED, RED], { today: '2026-10-15' });
    const tests = again.rows.find((row) => row.name === 'tests');
    assert.equal(tests.pass, false);
    assert.equal(tests.detail, 'npm run test exited 1');
    assert.match(again.rows.find((row) => row.name === 'rerun').detail, /failed again/);
    const expired = await one.gate([RED, GREEN], { today: '2026-11-16' });
    assert.equal(expired.rows.find((row) => row.name === 'tests').pass, false);
    assert.match(expired.rows.find((row) => row.name === 'rerun').lines[0], /^bin\/a\.test\.mjs {2}its entry expired 2026-11-15: /);
  } finally {
    one.done();
  }
});
