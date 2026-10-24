import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appliesOf, codexMcpSection, homeEnv, realSpawn, refusedWord, runWords, undoStack, withEnv } from './stack-run.mjs';

function withHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
  try {
    return fn(home);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** A spawn that records each call and answers from `answer(file, args, options)`. */
function fakeSpawn(answer = () => ({ status: 0, stdout: '', stderr: '' })) {
  const calls = [];
  const spawn = (file, args, options) => {
    calls.push({ file, args, options });
    return answer(file, args, options);
  };
  return { spawn, calls };
}

test('the real runner refuses under test: no test installs anything', () => {
  assert.throws(() => realSpawn('pnpm', ['add', '-g', 'x'], {}), /never run from a test/);
});

test('homeEnv gives a scratch home to every child, and nothing for the real home', () => {
  assert.deepEqual(homeEnv('/real', '/real', 'linux'), {});
  assert.deepEqual(homeEnv('/s', '/real', 'linux'), { HOME: '/s', USERPROFILE: '/s', CODEX_HOME: path.join('/s', '.codex') });
  const win = homeEnv('C:\\s', 'C:\\real', 'win32');
  assert.equal(win.APPDATA, path.join('C:\\s', 'AppData', 'Roaming'));
  assert.equal(win.LOCALAPPDATA, path.join('C:\\s', 'AppData', 'Local'));
});

test('withEnv puts a delta over the environment and its PATH before the one there', () => {
  assert.deepEqual(withEnv({ Path: '/usr/bin', A: '1' }, { PATH: '/p/bin', B: '2' }, 'win32'), { Path: '/p/bin;/usr/bin', A: '1', B: '2' });
  assert.deepEqual(withEnv({ PATH: '/usr/bin' }, { PATH: '/p/bin' }, 'linux'), { PATH: '/p/bin:/usr/bin' });
  assert.deepEqual(withEnv({ PATH: '/usr/bin' }, {}, 'linux'), { PATH: '/usr/bin' });
});

test('a word holding % or a double quote is refused on Windows, never run', () => {
  assert.equal(refusedWord(['pnpm', 'add', '%x%'], 'win32'), '%x%');
  assert.equal(refusedWord(['pnpm', 'add', 'a"b'], 'win32'), 'a"b');
  assert.equal(refusedWord(['pnpm', 'add', '%x%'], 'linux'), null);
  assert.equal(refusedWord(['pnpm', 'add', '@openai/codex'], 'win32'), null);
});

test('runWords runs one joined line through the shell on Windows, an argv elsewhere, with its timeout', () => {
  const win = fakeSpawn();
  assert.deepEqual(runWords(['pnpm', 'add', '-g', '@openai/codex'], { spawn: win.spawn, env: { A: '1' }, timeout: 5, platform: 'win32' }), { ok: true, status: 0, why: null });
  assert.equal(win.calls[0].file, 'pnpm add -g @openai/codex');
  assert.deepEqual(win.calls[0].args, []);
  assert.equal(win.calls[0].options.shell, true);
  assert.equal(win.calls[0].options.timeout, 5);
  assert.deepEqual(win.calls[0].options.env, { A: '1' });
  const posix = fakeSpawn();
  runWords(['claude', 'mcp', 'add'], { spawn: posix.spawn, env: {}, timeout: 5, platform: 'linux' });
  assert.equal(posix.calls[0].file, 'claude');
  assert.deepEqual(posix.calls[0].args, ['mcp', 'add']);
});

test('runWords ignores stdin unless it runs in a terminal, where stdio is inherited', () => {
  const quiet = fakeSpawn();
  runWords(['x'], { spawn: quiet.spawn, env: {}, timeout: 5, platform: 'linux' });
  assert.equal(quiet.calls[0].options.stdio[0], 'ignore');
  const loud = fakeSpawn();
  runWords(['x'], { spawn: loud.spawn, env: {}, timeout: 5, platform: 'linux', interactive: true });
  assert.equal(loud.calls[0].options.stdio, 'inherit');
});

test('runWords says why a command failed: its exit code, a timeout, a spawn error, or a refused word', () => {
  const failing = fakeSpawn(() => ({ status: 3, stderr: 'boom\n' }));
  assert.deepEqual(runWords(['x'], { spawn: failing.spawn, env: {}, timeout: 5, platform: 'linux' }), { ok: false, status: 3, why: 'exit 3: boom' });
  const slow = fakeSpawn(() => ({ status: null, signal: 'SIGTERM', error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }) }));
  assert.equal(runWords(['x'], { spawn: slow.spawn, env: {}, timeout: 5, platform: 'linux' }).why, 'timed out after 5 ms');
  const absent = fakeSpawn(() => ({ status: null, error: Object.assign(new Error('spawn x ENOENT'), { code: 'ENOENT' }) }));
  assert.equal(runWords(['x'], { spawn: absent.spawn, env: {}, timeout: 5, platform: 'linux' }).why, 'spawn x ENOENT');
  const never = fakeSpawn(() => assert.fail('ran a refused word'));
  assert.deepEqual(runWords(['x', '%y%'], { spawn: never.spawn, env: {}, timeout: 5, platform: 'win32' }), { ok: false, status: null, why: 'refused the word %y%: cmd.exe would read it' });
});

test('codexMcpSection reads one [mcp_servers.<name>] table with its subtables, or null', () => withHome((home) => {
  assert.equal(codexMcpSection(home, 'codegraph'), null);
  fs.mkdirSync(path.join(home, '.codex'));
  const text = 'model = "x"\n\n[mcp_servers.codegraph]\ncommand = "codegraph"\nargs = ["serve", "--mcp"]\n\n[mcp_servers.codegraph.env]\nA = "1"\n\n[mcp_servers.engram]\ncommand = "engram"\n';
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), text);
  assert.equal(codexMcpSection(home, 'codegraph'), '[mcp_servers.codegraph]\ncommand = "codegraph"\nargs = ["serve", "--mcp"]\n\n[mcp_servers.codegraph.env]\nA = "1"');
  assert.equal(codexMcpSection(home, 'context7'), null);
}));

test('appliesOf reads a package\'s version, Claude\'s entry and Codex\'s table', () => withHome((home) => {
  const version = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: 'codex-cli 0.50.0\n' } : { status: 1 }));
  assert.deepEqual(appliesOf({ tool: 'codex', dimension: 'installed', kind: 'package', bin: 'codex' }, { home, spawn: version.spawn, platform: 'linux', env: {} }), { present: true, value: '0.50.0', readable: true });
  assert.deepEqual(appliesOf({ tool: 'codegraph', dimension: 'installed', kind: 'package', bin: 'codegraph' }, { home, spawn: version.spawn, platform: 'linux', env: {} }), { present: false, value: null, readable: true });
  assert.deepEqual(appliesOf({ tool: 'codegraph', dimension: 'claude', kind: 'registration' }, { home }), { present: false, value: null, readable: true });
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { codegraph: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] } }, readable: true }));
  assert.deepEqual(appliesOf({ tool: 'codegraph', dimension: 'claude', kind: 'registration' }, { home }), { present: true, value: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] }, readable: true });
  fs.mkdirSync(path.join(home, '.codex'));
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.codegraph]\ncommand = "codegraph"\n');
  assert.deepEqual(appliesOf({ tool: 'codegraph', dimension: 'codex', kind: 'registration' }, { home }), { present: true, value: '[mcp_servers.codegraph]\ncommand = "codegraph"', readable: true });
}));

const PACKAGE = { tool: 'codex', dimension: 'installed', kind: 'package', bin: 'codex', run: ['pnpm', 'add', '-g', '@openai/codex'], undo: ['pnpm', 'remove', '-g', '@openai/codex'], applies: '0.50.0', env: { PNPM_HOME: '/p' } };
const CLAUDE = { tool: 'codegraph', dimension: 'claude', kind: 'registration', run: ['claude', 'mcp', 'add'], undo: ['claude', 'mcp', 'remove', '-s', 'user', 'codegraph'], applies: { command: 'codegraph' }, env: {} };

test('undoStack undoes in reverse order, printing each undo first, with the record\'s environment', () => withHome((home) => {
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { codegraph: { command: 'codegraph' } } }));
  const lines = [];
  const { spawn, calls } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: '0.50.0' } : { status: 0, stdout: '' }));
  const result = undoStack([PACKAGE, CLAUDE], { home, spawn, platform: 'linux', env: { PATH: '/usr/bin' }, log: (line) => lines.push(line) });
  assert.deepEqual(result.undone, [{ tool: 'codegraph', dimension: 'claude' }, { tool: 'codex', dimension: 'installed' }]);
  assert.deepEqual(result.failedRecords, []);
  const undos = calls.filter((call) => call.file !== 'codex');
  assert.deepEqual(undos.map((call) => [call.file, ...call.args]), [CLAUDE.undo, PACKAGE.undo]);
  assert.equal(undos[1].options.env.PNPM_HOME, '/p');
  assert.match(lines[0], /^undo codegraph claude: claude mcp remove -s user codegraph$/);
}));

test('undoStack drops the record of a tool already gone, and keeps, named, one that changed', () => withHome((home) => {
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { codegraph: { command: 'his-own' } } }));
  const { spawn, calls } = fakeSpawn((file) => (file === 'codex' ? { status: 1 } : assert.fail('ran an undo')));
  const result = undoStack([PACKAGE, CLAUDE], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(result.undone, []);
  assert.deepEqual(result.kept, [{ tool: 'codegraph', dimension: 'claude', reason: 'changed' }, { tool: 'codex', dimension: 'installed', reason: 'gone' }]);
  assert.deepEqual(result.failedRecords, []);
  assert.equal(calls.length, 1);
}));

test('undoStack keeps the record of an undo that failed, for a second run', () => withHome((home) => {
  const { spawn } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: '0.50.0' } : { status: 1, stderr: 'locked' }));
  const result = undoStack([PACKAGE], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(result.kept, [{ tool: 'codex', dimension: 'installed', reason: 'failed', why: 'exit 1: locked' }]);
  assert.deepEqual(result.failedRecords, [PACKAGE]);
}));

// gentle-ai R1-001 (T7): a record whose `applies` was never read cannot tell the harness's install from a later one of
// his own, so its undo is named, never run, and the record dropped.
test('undoStack never runs the undo of a record whose applies was never read: it names it and drops the record', () => withHome((home) => {
  const { spawn, calls } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: '0.51.0' } : assert.fail('ran an undo')));
  const result = undoStack([{ ...PACKAGE, applies: null }], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(result.undone, []);
  assert.deepEqual(result.kept, [{ tool: 'codex', dimension: 'installed', reason: 'unread', undo: 'pnpm remove -g @openai/codex, with PNPM_HOME=/p' }]);
  assert.deepEqual(result.failedRecords, []);
  assert.equal(calls.length, 1);
}));

// Codex on 612ceff..4c2955d (P2): the record is dropped, so the undo it names carries the environment it was given,
// or it would remove the default install, possibly his, and not the one under the prefix.
test('the undo named for a never-read record carries its recorded environment, a PATH as what goes first', () => withHome((home) => {
  const { spawn } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: '0.51.0' } : assert.fail('ran an undo')));
  const record = { ...PACKAGE, applies: null, env: { PNPM_HOME: '/p', PATH: '/p/bin' } };
  const result = undoStack([record], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.equal(result.kept[0].undo, 'pnpm remove -g @openai/codex, with PNPM_HOME=/p and /p/bin first on the PATH');
  const bare = undoStack([{ ...record, env: {} }], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.equal(bare.kept[0].undo, 'pnpm remove -g @openai/codex');
}));

test('undoStack drops a never-read record whose tool is already gone, as any other', () => withHome((home) => {
  const { spawn } = fakeSpawn((file) => (file === 'codex' ? { status: 1 } : assert.fail('ran an undo')));
  const result = undoStack([{ ...PACKAGE, applies: null }], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(result.kept, [{ tool: 'codex', dimension: 'installed', reason: 'gone' }]);
}));

const CODEX_REG = { tool: 'codegraph', dimension: 'codex', kind: 'registration', run: ['codex', 'mcp', 'add'], undo: ['codex', 'mcp', 'remove', 'codegraph'], applies: '[mcp_servers.codegraph]', env: {} };

test('undoStack keeps a record whose probe cannot tell, never dropping it (Codex on b9722fc..e57f2d0)', () => withHome((home) => {
  const { spawn } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: 'no version here' } : assert.fail('ran an undo')));
  const result = undoStack([PACKAGE], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(result.kept, [{ tool: 'codex', dimension: 'installed', reason: 'unreadable', why: 'it answers, but its version cannot be read' }]);
  assert.deepEqual(result.failedRecords, [PACKAGE]);
}));

test('undoStack keeps the Codex CLI while the undo of a registration in Codex failed, so a run again has it', () => withHome((home) => {
  fs.mkdirSync(path.join(home, '.codex'));
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.codegraph]\n');
  const { spawn, calls } = fakeSpawn(() => ({ status: 1, stderr: 'locked' }));
  const result = undoStack([PACKAGE, CODEX_REG], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(calls.map((call) => call.args.slice(0, 2)), [['mcp', 'remove']], 'only the registration\'s undo ran');
  assert.deepEqual(result.kept.map((k) => [k.tool, k.dimension, k.reason]), [['codegraph', 'codex', 'failed'], ['codex', 'installed', 'needed']]);
  assert.deepEqual(result.failedRecords, [PACKAGE, CODEX_REG], 'in the order they were installed');
}));

// The T7 verifier's advisory: the undo named for a never-read registration in Codex needs the Codex CLI to run.
test('undoStack keeps the Codex CLI while the undo of a registration in Codex is left to him unread', () => withHome((home) => {
  fs.mkdirSync(path.join(home, '.codex'));
  fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.codegraph]\n');
  const { spawn, calls } = fakeSpawn((file) => (file === 'codex' ? { status: 0, stdout: '0.50.0' } : assert.fail('ran an undo')));
  const result = undoStack([PACKAGE, { ...CODEX_REG, applies: null }], { home, spawn, platform: 'linux', env: {}, log: () => {} });
  assert.deepEqual(calls.filter((call) => call.args[0] !== '--version'), [], 'no undo ran');
  assert.deepEqual(result.kept.map((k) => [k.tool, k.dimension, k.reason]), [['codegraph', 'codex', 'unread'], ['codex', 'installed', 'needed']]);
  assert.equal(result.kept[1].why, 'the undo of a registration in Codex left to you needs it');
  assert.deepEqual(result.failedRecords, [PACKAGE]);
}));
