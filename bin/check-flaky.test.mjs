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

/** A project of two test files whose `test` script is `node --test`; `gate(answers)` runs its sensors with a
 * spawn that gives `answers` in turn and answers the rows and the commands spawned. */
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-flaky-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(root, 'harness.json'), JSON.stringify({}));
  fs.mkdirSync(path.join(root, 'bin'));
  for (const name of ['a', 'b']) fs.writeFileSync(path.join(root, 'bin', `${name}.test.mjs`), '');
  const gate = async (answers) => {
    const commands = [];
    const spawn = async (command) => {
      commands.push(command);
      return answers[Math.min(commands.length - 1, answers.length - 1)];
    };
    return { rows: await checkSensors(root, { spawn }), commands };
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
