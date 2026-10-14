import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GATE_WSL_ENV, SYNCED_MARK, gateWslPath, innerSeconds, mirrorName, readGateWsl, runnerScript, syncedMs, toWslPath, wslCommand } from './gate-wsl.mjs';

const tempHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gate-wsl-home-'));
const writeSwitch = (home, text) => {
  fs.mkdirSync(path.dirname(gateWslPath(home)), { recursive: true });
  fs.writeFileSync(gateWslPath(home), text);
};

test('a machine with no switch file runs its sensors on Windows', () => {
  const home = tempHome();
  assert.equal(readGateWsl(home, {}), null);
  fs.rmSync(home, { recursive: true, force: true });
});

test('the switch file names the distribution and the node folder', () => {
  const home = tempHome();
  writeSwitch(home, JSON.stringify({ distro: 'Ubuntu', node: '/home/a/.local/node/bin' }));
  assert.deepEqual(readGateWsl(home, {}), { distro: 'Ubuntu', node: '/home/a/.local/node/bin' });
  assert.deepEqual(readGateWsl(home, { [GATE_WSL_ENV]: '0' }), { windows: GATE_WSL_ENV }, 'the variable runs one gate on Windows');
  fs.rmSync(home, { recursive: true, force: true });
  assert.equal(readGateWsl(tempHome(), { [GATE_WSL_ENV]: '0' }), null, 'with no switch file the variable changes nothing');
});

test('a switch file that cannot be taken is an error, never a silent Windows run', () => {
  const home = tempHome();
  for (const [text, said] of [
    ['{', /is not JSON/],
    ['[]', /must be a JSON object/],
    [JSON.stringify({ distro: 'Ubuntu; rm', node: '/x' }), /needs "distro"/],
    [JSON.stringify({ distro: 'Ubuntu', node: 'C:\\node' }), /needs "node"/],
  ]) {
    writeSwitch(home, text);
    assert.match(readGateWsl(home, {}).error, said, text);
  }
  fs.rmSync(home, { recursive: true, force: true });
});

test('a Windows path is the path WSL mounts it at, and a share has none', () => {
  assert.equal(toWslPath('D:\\js-harness-worktrees\\gate-wsl'), '/mnt/d/js-harness-worktrees/gate-wsl');
  assert.equal(toWslPath('c:/Users/a b/x/'), '/mnt/c/Users/a b/x');
  assert.equal(toWslPath('D:\\'), '/mnt/d');
  assert.equal(toWslPath('\\\\server\\share\\x'), null);
  assert.equal(toWslPath('/home/a'), null);
});

test('two trees of one name never share a mirror', () => {
  const one = mirrorName(path.join(os.tmpdir(), 'a', 'tree'));
  const two = mirrorName(path.join(os.tmpdir(), 'b', 'tree'));
  assert.match(one, /^tree-[0-9a-f]{10}$/);
  assert.notEqual(one, two);
  assert.equal(mirrorName(path.join(os.tmpdir(), 'a', 'tree')), one);
});

test('the command runs the runner by its mounted path, and the bound inside is shorter', () => {
  assert.equal(wslCommand('Ubuntu', toWslPath('C:\\Temp\\h\\gate-wsl.sh')), 'wsl.exe -d Ubuntu --exec bash "/mnt/c/Temp/h/gate-wsl.sh"');
  assert.equal(innerSeconds(20 * 60 * 1000), 1185);
  assert.equal(innerSeconds(1000), 1);
});

test('the sync is read from the mark, and no mark is a mirror never reached', () => {
  assert.equal(syncedMs(`noise\n${SYNCED_MARK}1234 ms\nmore`), 1234);
  assert.equal(syncedMs('wsl: there is no distribution with the supplied name'), null);
});

test('the runner script quotes every value it is given and holds no carriage return', () => {
  const script = runnerScript({ source: "/mnt/d/it's", mirror: 'tree-0123456789', node: '/n/bin', command: "npm run test -- 'x'", held: true, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 30 });
  assert.ok(!script.includes('\r'));
  assert.match(script, /source='\/mnt\/d\/it'\\''s'/);
  assert.match(script, /JS_HARNESS_GATE_HELD=1 /);
  assert.match(script, /timeout -k 10 30 bash -c 'npm run test -- '\\''x'\\'''/);
  assert.doesNotMatch(runnerScript({ source: '/s', mirror: 'm', node: '/n', command: 'c', held: false, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 5 }), /GATE_HELD/);
});

const posixWithRsync = process.platform !== 'win32' && spawnSync('bash', ['-c', 'command -v rsync && command -v timeout'], { encoding: 'utf8' }).status === 0;

test('the runner syncs the tree without .git, runs the command in the mirror with a clean environment, and passes its exit on', { skip: !posixWithRsync && 'needs bash, rsync and timeout on a POSIX system' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-wsl-run-'));
  const source = path.join(root, 'tree');
  const linuxHome = path.join(root, 'home');
  fs.mkdirSync(path.join(source, '.git'), { recursive: true });
  fs.mkdirSync(linuxHome);
  fs.writeFileSync(path.join(source, 'a.txt'), 'one');
  fs.writeFileSync(path.join(source, '.git', 'HEAD'), 'ref');
  const command = 'cat a.txt; ls -A; echo "[$SECRET_OF_CALLER][$JS_HARNESS_CHECK_INNER][$JS_HARNESS_GATE_HELD]"; exit 3';
  const runner = path.join(root, 'runner.sh');
  fs.writeFileSync(runner, runnerScript({ source, mirror: 'm', node: path.dirname(process.execPath), command, held: true, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 30 }));
  const run = spawnSync('bash', [runner], { encoding: 'utf8', env: { ...process.env, HOME: linuxHome, SECRET_OF_CALLER: 'leaked' } });
  assert.equal(run.status, 3, run.stderr);
  assert.notEqual(syncedMs(run.stderr), null);
  assert.equal(run.stdout, 'onea.txt\n[][1][1]\n');
  // A file gone from the tree goes from the mirror at the next run.
  fs.rmSync(path.join(source, 'a.txt'));
  fs.writeFileSync(path.join(source, 'b.txt'), 'two');
  fs.writeFileSync(runner, runnerScript({ source, mirror: 'm', node: path.dirname(process.execPath), command: 'ls -A', held: false, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 30 }));
  const again = spawnSync('bash', [runner], { encoding: 'utf8', env: { ...process.env, HOME: linuxHome } });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout, 'b.txt\n');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a tree the runner cannot sync exits 97 before the mark', { skip: !posixWithRsync && 'needs bash, rsync and timeout on a POSIX system' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-wsl-run-'));
  const runner = path.join(root, 'runner.sh');
  fs.writeFileSync(runner, runnerScript({ source: path.join(root, 'absent'), mirror: 'm', node: '/n', command: 'true', held: false, heldVariable: 'JS_HARNESS_GATE_HELD', seconds: 5 }));
  const run = spawnSync('bash', [runner], { encoding: 'utf8', env: { ...process.env, HOME: root } });
  assert.equal(run.status, 97);
  assert.equal(syncedMs(run.stderr), null);
  fs.rmSync(root, { recursive: true, force: true });
});
