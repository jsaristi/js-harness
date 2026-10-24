import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readManifest } from './lib/manifest.mjs';
import { stackMain } from './stack.mjs';

// `js-harness stack install` (odd/tasks/stack-install.md, D4-D7) against a small world: a fake spawn installs and
// registers by changing `world`, and the fake read probes it, so the order, the consent, the record and the re-probe
// after each command are seen without running anything.

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' }, languageServer: { value: 'on' } };
const OK = { installed: 'ok', claude: 'ok', codex: 'ok', project: 'n/a', upToDate: 'ok' };

function newWorld() {
  return {
    codex: { installed: 'missing', claude: 'ok', codex: 'n/a' },
    codegraph: { installed: 'missing', claude: 'missing', codex: 'missing' },
    fail: new Set(),
    lines: [],
  };
}

function read(world) {
  return ({ env } = {}) => ((world.reads ??= []).push(env), {
    rows: ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex'].map((id) => ({ id, version: '1.0.0', ...OK, fix: {}, ...world[id] })),
    functions: ON,
    prerequisites: [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }],
  });
}

/** The spawn of the world: `--version` answers for an installed binary, and each install or registration changes the
 * world, writing the entry a registration writes under `home`, unless its line is in `world.fail`. */
function spawnOf(world, home, manifestSeen = []) {
  return (file, args, options) => {
    const line = [file, ...args].join(' ');
    if (args[0] === '--version') return world[file]?.installed === 'ok' ? { status: 0, stdout: `${file} 2.0.0\n` } : { status: 1 };
    world.lines.push({ line, env: options.env, stdio: options.stdio, timeout: options.timeout, codexHomeExisted: Boolean(options.env?.CODEX_HOME) && fs.existsSync(options.env.CODEX_HOME) });
    manifestSeen.push(readManifest(home)?.stack?.map((r) => `${r.tool}.${r.dimension}`) ?? []);
    if (world.timeout?.has(line)) {
      world.onTimeout?.(line);
      return { status: null, signal: 'SIGTERM' };
    }
    if (world.fail.has(line)) {
      world.onFail?.(line);
      return { status: 1, stderr: 'it broke' };
    }
    if (line === 'pnpm add -g @openai/codex') world.codex.installed = 'ok';
    if (line === 'pnpm add -g @colbymchenry/codegraph') world.codegraph.installed = 'ok';
    if (line.startsWith('claude mcp add')) {
      world.codegraph.claude = 'ok';
      fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { codegraph: { command: 'codegraph', args: ['serve', '--mcp'] } } }));
    }
    if (line.startsWith('codex mcp add')) {
      world.codegraph.codex = 'ok';
      // Codex writes the table where CODEX_HOME says.
      if (options.env?.CODEX_HOME) {
        fs.mkdirSync(options.env.CODEX_HOME, { recursive: true });
        fs.writeFileSync(path.join(options.env.CODEX_HOME, 'config.toml'), '[mcp_servers.codegraph]\ncommand = "codegraph"\n');
      }
    }
    return { status: 0, stdout: '' };
  };
}

async function run(argv, { world, home, answers = [], interactive = false, manifestSeen, env = {}, realHome = home }) {
  const out = [];
  const err = [];
  const asked = [];
  const code = await stackMain(['install', '--home', home, ...argv], { JS_HARNESS_PM: 'pnpm', PATH: '/usr/bin', ...env }, {
    read: read(world),
    spawn: spawnOf(world, home, manifestSeen),
    platform: 'linux',
    interactive,
    realHome,
    ask: async (question) => {
      asked.push(question);
      return answers.shift() === 'y';
    },
    now: () => '2026-10-19T00:00:00.000Z',
    log: (line) => out.push(line),
    error: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), asked };
}

function withHome(fn) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
    try {
      await fn(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

test('without a terminal and without --yes, stack install shows the plan and runs nothing', withHome(async (home) => {
  const world = newWorld();
  const { code, out, err } = await run([], { world, home });
  assert.equal(code, 1);
  assert.match(out, /pnpm add -g @openai\/codex/);
  assert.match(err, /runs nothing without a terminal: pass --yes with --tool <id>/);
  assert.deepEqual(world.lines, []);
  assert.equal(readManifest(home), null);
}));

test('--yes needs --tool, and --tool names a tool stack install runs: else a usage error that runs nothing', withHome(async (home) => {
  for (const argv of [['--yes'], ['--yes', '--tool', 'gentle-ai'], ['--tool'], ['--bogus']]) {
    const world = newWorld();
    const { code, err } = await run(argv, { world, home });
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness stack install/);
    assert.deepEqual(world.lines, []);
  }
}));

test('--yes --tool runs only that tool\'s rows, in order, and records each with what its undo applies to', withHome(async (home) => {
  const world = newWorld();
  const { code, out } = await run(['--yes', '--tool', 'codegraph'], { world, home });
  assert.equal(code, 0);
  assert.deepEqual(world.lines.map((l) => l.line), [
    'pnpm add -g @colbymchenry/codegraph',
    'claude mcp add -s user codegraph -- codegraph serve --mcp',
    'codex mcp add codegraph -- codegraph serve --mcp',
  ]);
  assert.match(out, /run: {2}pnpm add -g @colbymchenry\/codegraph\n {5}undo: pnpm remove -g @colbymchenry\/codegraph/);
  const records = readManifest(home).stack;
  assert.deepEqual(records.map((r) => [r.tool, r.dimension, r.applies]), [
    ['codegraph', 'installed', '2.0.0'],
    ['codegraph', 'claude', { command: 'codegraph', args: ['serve', '--mcp'] }],
    ['codegraph', 'codex', '[mcp_servers.codegraph]\ncommand = "codegraph"'],
  ]);
  assert.deepEqual(records[0].undo, ['pnpm', 'remove', '-g', '@colbymchenry/codegraph']);
  assert.equal(records[0].at, '2026-10-19T00:00:00.000Z');
}));

test('under --yes stdin is closed and each command has its timeout', withHome(async (home) => {
  const world = newWorld();
  await run(['--yes', '--tool', 'codegraph'], { world, home });
  assert.deepEqual(world.lines.map((l) => [l.stdio[0], l.timeout]), [['ignore', 120000], ['ignore', 30000], ['ignore', 30000]]);
}));

test('the record is written before its command starts', withHome(async (home) => {
  const world = newWorld();
  const manifestSeen = [];
  await run(['--yes', '--tool', 'codex'], { world, home, manifestSeen });
  assert.deepEqual(manifestSeen, [['codex.installed']]);
}));

test('in a terminal each command is asked, and one he declines is skipped, recorded never, and exits 1', withHome(async (home) => {
  const world = newWorld();
  const { code, asked } = await run(['--tool', 'codegraph'], { world, home, interactive: true, answers: ['y', 'n', 'y'] });
  assert.equal(code, 1);
  assert.deepEqual(asked, ['Run it? [y/N] ', 'Run it? [y/N] ', 'Run it? [y/N] ']);
  assert.deepEqual(world.lines.map((l) => [l.line.split(' ')[0], l.stdio]), [['pnpm', 'inherit'], ['codex', 'inherit']]);
  assert.deepEqual(readManifest(home).stack.map((r) => r.dimension), ['installed', 'codex']);
}));

test('a command that fails with its gap still open loses its record, says why, and exits 1', withHome(async (home) => {
  const world = newWorld();
  world.fail.add('pnpm add -g @openai/codex');
  const { code, err } = await run(['--yes', '--tool', 'codex'], { world, home });
  assert.equal(code, 1);
  assert.match(err, /codex installed failed: exit 1: it broke/);
  assert.equal(readManifest(home), null);
}));

test('a row an earlier command closed is not run again', withHome(async (home) => {
  const world = newWorld();
  const spawn = spawnOf(world, home);
  const out = [];
  // The install of codegraph registers it in Claude too, as some installers do.
  await stackMain(['install', '--home', home, '--yes', '--tool', 'codegraph'], { JS_HARNESS_PM: 'pnpm' }, {
    read: read(world),
    spawn: (file, args, options) => {
      const result = spawn(file, args, options);
      if (args.join(' ') === 'add -g @colbymchenry/codegraph') world.codegraph.claude = 'ok';
      return result;
    },
    platform: 'linux', interactive: false, realHome: home, now: () => 'now', log: (line) => out.push(line), error: () => {},
  });
  assert.deepEqual(world.lines.map((l) => l.line.split(' ').slice(0, 2).join(' ')), ['pnpm add', 'codex mcp']);
  assert.match(out.join('\n'), /codegraph claude: no longer missing/);
}));

test('a scratch home is given to every child, and recorded for its undo', withHome(async (home) => {
  const world = newWorld();
  await stackMain(['install', '--home', home, '--yes', '--tool', 'codex'], { JS_HARNESS_PM: 'pnpm', PATH: '/usr/bin' }, {
    read: read(world), spawn: spawnOf(world, home), platform: 'linux', interactive: false, realHome: '/somewhere/else', now: () => 'now', log: () => {}, error: () => {},
  });
  assert.equal(world.lines[0].env.HOME, home);
  assert.equal(world.lines[0].env.CODEX_HOME, path.join(home, '.codex'));
  assert.equal(world.lines[0].env.PATH, '/usr/bin');
  assert.equal(readManifest(home).stack[0].env.HOME, home);
}));

test('--prefix puts pnpm\'s home there, for the install and in the record', withHome(async (home) => {
  const world = newWorld();
  const prefix = path.join(home, 'prefix');
  await run(['--yes', '--tool', 'codex', '--prefix', prefix], { world, home });
  assert.equal(world.lines[0].env.PNPM_HOME, prefix);
  assert.equal(world.lines[0].env.PATH, `${path.join(prefix, 'bin')}:/usr/bin`);
  assert.equal(readManifest(home).stack[0].env.PNPM_HOME, prefix);
}));

test('with nothing missing, stack install says so, runs nothing and exits 0', withHome(async (home) => {
  const world = newWorld();
  world.codex.installed = 'ok';
  Object.assign(world.codegraph, { installed: 'ok', claude: 'ok', codex: 'ok' });
  const { code, out } = await run([], { world, home });
  assert.equal(code, 0);
  assert.match(out, /nothing to install/);
  assert.deepEqual(world.lines, []);
}));

// Codex on b9722fc..e57f2d0: a prefix's binaries reach the probes and the commands after the install, a Codex home of
// his own elsewhere is never written to behind the record's back, and a failure is never reported done.
test('under --prefix the probes and every command after the install see the prefix\'s bin first', withHome(async (home) => {
  const world = newWorld();
  const { code } = await run(['--yes', '--tool', 'codex', '--tool', 'codegraph', '--prefix', '/p'], { world, home });
  assert.equal(code, 0);
  assert.ok(world.reads.every((env) => env.PATH.startsWith(path.join('/p', 'bin'))), world.reads.map((env) => env.PATH).join('\n'));
  const codexAdd = world.lines.find(({ line }) => line.startsWith('codex mcp add'));
  assert.ok(codexAdd.env.PATH.startsWith(path.join('/p', 'bin')), codexAdd.env.PATH);
  assert.ok(readManifest(home).stack.every((row) => row.env.PATH === path.join('/p', 'bin')), 'the undo gets the same PATH');
}));

// stack-install T8: doctor reads the CODEX_HOME he set, so the registration in Codex is made there, and its record
// keeps that home, so the undo and its check reach the same table.
test('a Codex home of his own on the real home gets the registration in Codex, and its record keeps that home (T8)', withHome(async (home) => {
  const world = newWorld();
  const own = path.join(home, 'his-codex');
  const { code, err } = await run(['--yes', '--tool', 'codegraph'], { world, home, env: { CODEX_HOME: own } });
  assert.equal(code, 0, err);
  const add = world.lines.find(({ line }) => line.startsWith('codex mcp add'));
  assert.equal(add.env.CODEX_HOME, own);
  assert.ok(add.codexHomeExisted, 'the folder was there when codex mcp add started');
  const record = readManifest(home).stack.find((row) => row.dimension === 'codex');
  assert.equal(record.env.CODEX_HOME, own);
  assert.equal(record.applies, '[mcp_servers.codegraph]\ncommand = "codegraph"');
}));

test('on a home that is not the real one a CODEX_HOME he set is never written to', withHome(async (home) => {
  const world = newWorld();
  const { code } = await run(['--yes', '--tool', 'codegraph'], { world, home, env: { CODEX_HOME: path.join(home, 'his-codex') }, realHome: path.join(home, 'elsewhere') });
  assert.equal(code, 0);
  assert.equal(world.lines.find(({ line }) => line.startsWith('codex mcp add')).env.CODEX_HOME, path.join(home, '.codex'));
  assert.equal(fs.existsSync(path.join(home, 'his-codex')), false);
}));

test('a failed command whose probe then cannot tell is not done: it stays recorded and the run exits 1', withHome(async (home) => {
  const world = newWorld();
  world.fail.add('pnpm add -g @openai/codex');
  world.onFail = () => { world.codex.installed = 'unknown'; };
  const { code, out, err } = await run(['--yes', '--tool', 'codex'], { world, home });
  assert.equal(code, 1);
  assert.ok(!out.includes('codex installed: done'), out);
  assert.ok(err.includes('codex installed: the command failed (exit 1: it broke) and the probe cannot tell what it left; it stays recorded, so uninstall machine judges it'), err);
  assert.deepEqual(readManifest(home).stack.map((row) => [row.tool, row.dimension, row.applies]), [['codex', 'installed', null]]);
}));

// gentle-ai review-296d60b1e90da71e (R4): a timeout kills the shell, not always what it started, which may still
// install; so a timeout keeps its record, and in a terminal, where the person watches, nothing is timed out.
test('a command that timed out keeps its record, since what it started may still finish', withHome(async (home) => {
  const world = newWorld();
  world.timeout = new Set(['pnpm add -g @openai/codex']);
  const { code, err } = await run(['--yes', '--tool', 'codex'], { world, home });
  assert.equal(code, 1);
  assert.ok(err.includes('codex installed: timed out after 120000 ms, and what it started may still be running; it stays recorded, so uninstall machine judges it'), err);
  assert.deepEqual(readManifest(home).stack.map((row) => [row.tool, row.dimension, row.applies]), [['codex', 'installed', null]]);
}));

// T7 (gentle-ai R1-001): a record left unread is read once the probe can, at the end of the run, so its undo applies
// to what it left and not to whatever answers later.
test('a timed-out install the probe reads ok at the end of the run gets what its undo applies to, and the run exits 0', withHome(async (home) => {
  const world = newWorld();
  world.timeout = new Set(['pnpm add -g @openai/codex']);
  world.onTimeout = () => { world.codex.installed = 'ok'; };
  const { code, out } = await run(['--yes', '--tool', 'codex'], { world, home });
  assert.equal(code, 0);
  assert.ok(out.includes('codex installed: read at the end of the run: done'), out);
  assert.deepEqual(readManifest(home).stack.map((row) => [row.tool, row.dimension, row.applies]), [['codex', 'installed', '2.0.0']]);
}));

test('a failed command the probe still cannot tell at the end of the run stays unread, and the run exits 1', withHome(async (home) => {
  const world = newWorld();
  world.fail.add('pnpm add -g @openai/codex');
  world.onFail = () => { world.codex.installed = 'unknown'; };
  const { code, out } = await run(['--yes', '--tool', 'codex'], { world, home });
  assert.equal(code, 1);
  assert.ok(!out.includes('read at the end of the run'), out);
  assert.deepEqual(readManifest(home).stack.map((row) => row.applies), [null]);
}));

test('in a terminal no command is timed out', withHome(async (home) => {
  const world = newWorld();
  await run(['--tool', 'codex'], { world, home, interactive: true, answers: ['y'] });
  assert.deepEqual(world.lines.map(({ line, timeout }) => [line, timeout]), [['pnpm add -g @openai/codex', undefined]]);
}));

// The trial of D9 (T4): Codex refuses a CODEX_HOME that does not exist, and a scratch home has none until Codex ran.
test('on a scratch home the Codex home is made before a registration in Codex runs', withHome(async (home) => {
  const world = newWorld();
  world.codex.installed = 'ok';
  const codexHome = path.join(home, '.codex');
  const { code } = await run(['--yes', '--tool', 'codegraph'], { world, home, realHome: path.join(home, 'elsewhere') });
  assert.equal(code, 0);
  const add = world.lines.find(({ line }) => line.startsWith('codex mcp add'));
  assert.equal(add.env.CODEX_HOME, codexHome);
  assert.ok(add.codexHomeExisted, 'the folder was there when codex mcp add started');
}));

test('the Codex home is made too when CODEX_HOME names it and the home is the one the process runs in, as in the trial', withHome(async (home) => {
  const world = newWorld();
  world.codex.installed = 'ok';
  const codexHome = path.join(home, '.codex');
  const { code } = await run(['--yes', '--tool', 'codegraph'], { world, home, env: { CODEX_HOME: codexHome } });
  assert.equal(code, 0);
  assert.ok(world.lines.find(({ line }) => line.startsWith('codex mcp add')).codexHomeExisted);
}));
