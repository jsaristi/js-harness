import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import {
  ENGRAM_PROCESS_NAME, REAL_ENGRAM_PORT, allocatePort, assertTrialPort, findListeners, findProcesses, isListening, killByPort, releasePort,
} from './ports.mjs';

/** A `spawnSync` that answers from `script`, one `[matcher, result]` per expected call in order, and keeps the
 * calls. The matcher is the command name; a result is what `spawnSync` returns (`status`, `stdout`, ...) or
 * a function of the call. Nothing is ever started. */
function scripted(script) {
  const calls = [];
  const sync = (command, args = [], options = {}) => {
    calls.push({ command, args, options });
    const [expected, result] = script[calls.length - 1] ?? [undefined, { status: 0, stdout: '', stderr: '' }];
    if (expected !== undefined) assert.equal(command, expected, `call ${calls.length} runs ${expected}`);
    const value = typeof result === 'function' ? result({ command, args, options }) : result;
    return { status: 0, stdout: '', stderr: '', ...value };
  };
  sync.calls = calls;
  return sync;
}
const noSleep = () => {};

// ---- assertTrialPort and allocatePort ---------------------------------------------------------------------------

test('a trial port is an integer from 1024 to 65535 that is not the real engram port', () => {
  assert.equal(REAL_ENGRAM_PORT, 7437);
  for (const port of [1024, 41000, 65535]) assert.doesNotThrow(() => assertTrialPort(port), String(port));
  for (const port of [undefined, null, '41000', 41000.5, 0, 80, 1023, 65536, -1, NaN]) assert.throws(() => assertTrialPort(port), /engram port/, String(port));
  assert.throws(() => assertTrialPort(7437), /7437/);
  assert.throws(() => assertTrialPort(8000, { protectedPorts: [7437, 8000] }), /8000/);
});

test('a free port comes back, never the real engram port and never one still reserved for another trial', async () => {
  const reserved = new Set();
  const offered = [7437, 41000, 41000, 80, 41001];
  const listen = async () => offered.shift();
  assert.equal(await allocatePort({ listen, reserved }), 41000);
  assert.equal(await allocatePort({ listen, reserved }), 41001, '7437, a port in use by another trial and a privileged one are skipped');
  assert.deepEqual([...reserved].sort(), [41000, 41001]);
  releasePort(41000, { reserved });
  assert.deepEqual([...reserved], [41001]);
});

test('an allocation that cannot find a usable port in its attempts fails instead of settling for the real one', async () => {
  await assert.rejects(allocatePort({ listen: async () => 7437, attempts: 4, reserved: new Set() }), /free port/);
});

test('real allocations are distinct, bindable once released, and none is the real engram port', async () => {
  const ports = await Promise.all(Array.from({ length: 12 }, () => allocatePort()));
  try {
    assert.equal(new Set(ports).size, 12);
    for (const port of ports) {
      assert.ok(Number.isInteger(port) && port >= 1024 && port !== REAL_ENGRAM_PORT, String(port));
      assert.equal(await isListening(port), false, 'nothing holds it');
    }
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(ports[0], '127.0.0.1', resolve);
    });
    assert.equal(await isListening(ports[0]), true);
    await new Promise((resolve) => server.close(resolve));
    assert.equal(await isListening(ports[0]), false);
  } finally {
    for (const port of ports) releasePort(port);
  }
});

test('isListening asks a connection to the loopback and never throws on a refusal', async () => {
  const seen = [];
  const connect = (port, host) => {
    seen.push([port, host]);
    return Promise.resolve(false);
  };
  assert.equal(await isListening(41000, { connect }), false);
  assert.deepEqual(seen, [[41000, '127.0.0.1']]);
});

// ---- findListeners ----------------------------------------------------------------------------------------------

test('on Windows the listener is found through PowerShell, with the port in the environment and never in the script', () => {
  const sync = scripted([['powershell', { stdout: '4242\tengram\r\n' }]]);
  assert.deepEqual(findListeners(41000, { platform: 'win32', spawnSync: sync }), [{ pid: 4242, name: 'engram' }]);
  const [{ args, options }] = sync.calls;
  assert.ok(args.includes('-EncodedCommand') && args.includes('-NoProfile'));
  assert.equal(options.env.JS_HARNESS_PORT, '41000');
  const script = Buffer.from(args[args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
  assert.ok(!script.includes('41000'), 'a port spliced into a script is a port that could be anything');
  assert.match(script, /Get-NetTCPConnection/);
  assert.match(script, /Listen/);
});

test('on Windows an empty answer is no listener, a malformed line is skipped and a failed lookup throws', () => {
  assert.deepEqual(findListeners(41000, { platform: 'win32', spawnSync: scripted([['powershell', { stdout: '' }]]) }), []);
  assert.deepEqual(findListeners(41000, { platform: 'win32', spawnSync: scripted([['powershell', { stdout: 'noise\n12\tnode\n\n12\tnode\n' }]]) }), [{ pid: 12, name: 'node' }], 'a pid listed twice (IPv4 and IPv6) is one listener');
  assert.throws(() => findListeners(41000, { platform: 'win32', spawnSync: scripted([['powershell', { status: 1, stderr: 'boom' }]]) }), /boom/);
  assert.throws(() => findListeners(41000, { platform: 'win32', spawnSync: scripted([['powershell', { error: new Error('spawn powershell ENOENT') }]]) }), /ENOENT/);
});

test('on POSIX the listener comes from lsof and ps, and lsof exiting 1 with nothing printed is no listener', () => {
  const sync = scripted([
    ['lsof', { stdout: 'p321\np322\n' }],
    ['ps', { stdout: 'engram\n' }],
    ['ps', { stdout: 'node\n' }],
  ]);
  assert.deepEqual(findListeners(41000, { platform: 'linux', spawnSync: sync }), [{ pid: 321, name: 'engram' }, { pid: 322, name: 'node' }]);
  assert.deepEqual(sync.calls[0].args, ['-nP', '-iTCP:41000', '-sTCP:LISTEN', '-Fp']);
  assert.deepEqual(sync.calls[1].args, ['-o', 'comm=', '-p', '321']);
  assert.deepEqual(findListeners(41000, { platform: 'linux', spawnSync: scripted([['lsof', { status: 1, stdout: '' }]]) }), []);
});

test('without lsof, ss is used; without either, the lookup fails loudly instead of reporting a free port', () => {
  const enoent = Object.assign(new Error('spawn lsof ENOENT'), { code: 'ENOENT' });
  const ss = scripted([['lsof', { error: enoent }], ['ss', { stdout: 'LISTEN 0 4096 127.0.0.1:41000 0.0.0.0:* users:(("engram",pid=555,fd=7))\n' }]]);
  assert.deepEqual(findListeners(41000, { platform: 'darwin', spawnSync: ss }), [{ pid: 555, name: 'engram' }]);
  assert.deepEqual(ss.calls[1].args, ['-H', '-ltnp', 'sport', '=', ':41000']);
  const neither = scripted([['lsof', { error: enoent }], ['ss', { error: Object.assign(new Error('spawn ss ENOENT'), { code: 'ENOENT' }) }]]);
  assert.throws(() => findListeners(41000, { platform: 'linux', spawnSync: neither }), /lsof/);
});

test('a port that is not a trial port is refused before anything runs', () => {
  const sync = scripted([]);
  assert.throws(() => findListeners(7437, { platform: 'win32', spawnSync: sync }), /7437/);
  assert.throws(() => findListeners('41000; rm -rf', { platform: 'linux', spawnSync: sync }), /engram port/);
  assert.equal(sync.calls.length, 0);
});

// ---- killByPort -------------------------------------------------------------------------------------------------

test('the listener on a trial port is killed with its tree on Windows and the lookup then comes back empty', () => {
  const sync = scripted([
    ['powershell', { stdout: '4242\tengram\n' }],
    ['taskkill', {}],
    ['powershell', { stdout: '' }],
  ]);
  const result = killByPort(41000, { platform: 'win32', spawnSync: sync, sleep: noSleep });
  assert.deepEqual(result, { killed: [4242] });
  assert.deepEqual(sync.calls[1].args, ['/pid', '4242', '/T', '/F']);
});

test('on POSIX the listener gets SIGKILL through the injected kill', () => {
  const sync = scripted([
    ['lsof', { stdout: 'p321\n' }],
    ['ps', { stdout: 'engram\n' }],
    ['lsof', { status: 1 }],
  ]);
  const killed = [];
  assert.deepEqual(killByPort(41000, { platform: 'linux', spawnSync: sync, kill: (pid, signal) => killed.push([pid, signal]), sleep: noSleep }), { killed: [321] });
  assert.deepEqual(killed, [[321, 'SIGKILL']]);
});

test('a free port is not an error, and nothing is killed', () => {
  const sync = scripted([['powershell', { stdout: '' }]]);
  assert.deepEqual(killByPort(41000, { platform: 'win32', spawnSync: sync, sleep: noSleep }), { killed: [] });
  assert.equal(sync.calls.length, 1);
});

test('the real engram port is never searched or killed, whatever listens there', () => {
  const sync = scripted([]);
  for (const platform of ['win32', 'linux']) {
    assert.throws(() => killByPort(REAL_ENGRAM_PORT, { platform, spawnSync: sync, kill: () => assert.fail('killed') }), /7437/);
  }
  assert.throws(() => killByPort(41000, { platform: 'linux', spawnSync: sync, protectedPorts: [41000] }), /41000/);
  assert.equal(sync.calls.length, 0, 'not even a lookup');
});

test('a listener that is not engram is left alone and reported, because the port was not the trial\'s to free', () => {
  const sync = scripted([['powershell', { stdout: '99\tchrome\n' }]]);
  assert.throws(() => killByPort(41000, { platform: 'win32', spawnSync: sync, sleep: noSleep }), /pid 99 \(chrome\).*not engram/s);
  assert.equal(sync.calls.length, 1, 'no taskkill');
});

test('the name to kill is a parameter, and the default matches engram with or without .exe', () => {
  assert.ok(ENGRAM_PROCESS_NAME.test('engram') && ENGRAM_PROCESS_NAME.test('Engram.EXE'));
  assert.ok(!ENGRAM_PROCESS_NAME.test('engram-helper') && !ENGRAM_PROCESS_NAME.test('node'));
  const sync = scripted([['powershell', { stdout: '7\tnode\n' }], ['taskkill', {}], ['powershell', { stdout: '' }]]);
  assert.deepEqual(killByPort(41000, { platform: 'win32', spawnSync: sync, name: /^node$/, sleep: noSleep }), { killed: [7] });
});

test('a listener that survives the kill makes the call fail after retries, and a later lookup that is empty ends them early', () => {
  const stubborn = [['powershell', { stdout: '4242\tengram\n' }], ['taskkill', {}], ...Array.from({ length: 12 }, () => ['powershell', { stdout: '4242\tengram\n' }])];
  assert.throws(() => killByPort(41000, { platform: 'win32', spawnSync: scripted(stubborn), sleep: noSleep }), /still listens/);
  let waited = 0;
  const late = scripted([['powershell', { stdout: '4242\tengram\n' }], ['taskkill', {}], ['powershell', { stdout: '4242\tengram\n' }], ['powershell', { stdout: '' }]]);
  assert.deepEqual(killByPort(41000, { platform: 'win32', spawnSync: late, sleep: () => { waited += 1; } }), { killed: [4242] });
  assert.equal(waited, 1, 'one wait, then the port was free');
});

test('a taskkill that cannot run fails the call', () => {
  const sync = scripted([['powershell', { stdout: '4242\tengram\n' }], ['taskkill', { error: new Error('spawn taskkill ENOENT') }]]);
  assert.throws(() => killByPort(41000, { platform: 'win32', spawnSync: sync, sleep: noSleep }), /taskkill/);
});

// ---- findProcesses ----------------------------------------------------------------------------------------------

test('processes are listed by image name: on Windows through CIM with the name in the environment, on POSIX through ps', () => {
  const win = scripted([['powershell', { stdout: '100\tC:\\bin\\engram.exe mcp --tools=agent\r\n200\t\r\n' }]]);
  assert.deepEqual(findProcesses('engram', { platform: 'win32', spawnSync: win }), [{ pid: 100, command: 'C:\\bin\\engram.exe mcp --tools=agent' }, { pid: 200, command: '' }]);
  assert.equal(win.calls[0].options.env.JS_HARNESS_PROCESS_NAME, 'engram');
  const script = Buffer.from(win.calls[0].args[win.calls[0].args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
  assert.ok(!script.includes('engram'), 'the name is data, not script text');

  const posix = scripted([['ps', { stdout: '  11 engram /usr/bin/engram serve\n  12 node node a.js\n  13 engram engram mcp\n' }]]);
  assert.deepEqual(findProcesses('engram', { platform: 'linux', spawnSync: posix }), [{ pid: 11, command: '/usr/bin/engram serve' }, { pid: 13, command: 'engram mcp' }]);
  assert.deepEqual(posix.calls[0].args, ['-eo', 'pid=,comm=,args=']);
});

test('a listing that cannot run throws, so "no engram process survived" is never read from a failed lookup', () => {
  assert.throws(() => findProcesses('engram', { platform: 'win32', spawnSync: scripted([['powershell', { status: 1, stderr: 'denied' }]]) }), /denied/);
  assert.throws(() => findProcesses('engram', { platform: 'linux', spawnSync: scripted([['ps', { error: new Error('spawn ps ENOENT') }]]) }), /ENOENT/);
  assert.throws(() => findProcesses('en gram', { platform: 'linux', spawnSync: scripted([]) }), /name/);
});

// ---- the real thing, against a process of this test's own ---------------------------------------------------------

test('a real listener of a trial port is found by number and killed, and a connection is then refused', async () => {
  const port = await allocatePort();
  const child = spawn(process.execPath, ['-e', `require('node:net').createServer().listen(${port}, '127.0.0.1'); setInterval(() => {}, 1000)`], { stdio: 'ignore', windowsHide: true });
  try {
    for (let attempt = 0; attempt < 100 && !(await isListening(port)); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(await isListening(port), true, 'the listener is up');
    const found = findListeners(port);
    assert.deepEqual(found.map((entry) => entry.pid), [child.pid]);
    assert.throws(() => killByPort(port), /not engram/, 'the default name keeps a node process safe');
    assert.deepEqual(killByPort(port, { name: /^node(\.exe)?$/i }).killed, [child.pid]);
    assert.equal(await isListening(port), false);
    assert.ok(findProcesses('node').some((entry) => entry.pid === process.pid), 'the process list sees this very process');
  } finally {
    child.kill('SIGKILL');
    releasePort(port);
  }
});
