// The program the host would run (`status-line.ps1`), run as the host runs it: Windows PowerShell, no arguments, one JSON
// line on standard input, in a scratch home. Windows only; elsewhere there is no Windows PowerShell to run it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { statusLineFile, writeStatusLine } from './status-line.mjs';

const PROGRAM = path.join(import.meta.dirname, 'status-line.ps1');
const skip = process.platform !== 'win32' && 'Windows PowerShell runs on Windows only';

function run(home, harnessHome = '') {
  const started = Date.now();
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROGRAM], {
    input: '{"session_id":"local_1","model":{"id":"claude-opus-5-5"}}\n',
    env: { ...process.env, USERPROFILE: home, JS_HARNESS_HOME: harnessHome },
    encoding: 'utf8',
    windowsHide: true,
  });
  return { ...result, ms: Date.now() - started };
}

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'status-line-program-'));

test('the program prints the line of a fresh file, well under the host limit of 10 s', { skip }, () => {
  const home = scratch();
  try {
    writeStatusLine({ home, line: '1 pregunta · 2 trabajando', now: Date.now() });
    const result = run(home);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '1 pregunta · 2 trabajando\n');
    assert.ok(result.ms < 5000, `took ${result.ms} ms`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the program marks a line older than 10 minutes in yellow with its age, and prints nothing with no file', { skip }, () => {
  const home = scratch();
  try {
    assert.deepEqual([run(home).status, run(home).stdout], [0, '']);
    writeStatusLine({ home, line: '0 preguntas', now: Date.now() - 25 * 60000 });
    assert.equal(run(home).stdout, '\u001b[33mhace 25 min\u001b[0m · 0 preguntas\n');
    fs.writeFileSync(statusLineFile(home), 'not a time\n0 preguntas\n');
    assert.equal(run(home).stdout, '', 'a file it cannot read the time of shows no line');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the program reads the home JS_HARNESS_HOME names, as the writer does, and USERPROFILE when it is empty or relative', { skip }, () => {
  const profile = scratch();
  const named = scratch();
  try {
    writeStatusLine({ home: profile, line: 'del perfil', now: Date.now() });
    writeStatusLine({ home: named, line: 'del home nombrado', now: Date.now() });
    assert.equal(run(profile, named).stdout, 'del home nombrado\n');
    assert.equal(run(profile, '').stdout, 'del perfil\n');
    assert.equal(run(profile, 'relative\\home').stdout, 'del perfil\n', 'the host runs the program in System32, so a relative home names no folder the writer meant');
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
    fs.rmSync(named, { recursive: true, force: true });
  }
});
