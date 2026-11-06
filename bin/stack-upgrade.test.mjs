import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readManifest, recordStackRow } from './lib/manifest.mjs';
import { readUpgrade, stackMain } from './stack.mjs';

// `js-harness stack upgrade` (odd/tasks/stack-upgrade.md, S1) against a small world: the fake read gives the installed
// and the latest versions, the fake spawn installs by changing the world, and the engram binary's update is a seam,
// so the order, the consent, the records and their undo are seen without running or downloading anything.

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' } };
const PLUGIN_FILE = (home) => path.join(home, '.claude', 'plugins', 'installed_plugins.json');

function newWorld(versions = {}, latest = {}) {
  return {
    versions: { engram: '3.6.2', 'engram-plugin': '0.1.19', codegraph: '1.6.2', context7: 'hosted', codex: '0.167.0', ...versions },
    latest: { engram: '3.6.2', 'engram-plugin': '0.1.19', codegraph: '1.6.2', codex: '0.167.0', ...latest },
    fail: new Set(),
    hang: new Set(),
    engramDeps: [],
    lines: [],
    seen: [],
    engramCalls: [],
  };
}

function withHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-stack-upgrade-'));
  return Promise.resolve(fn(home)).finally(() => fs.rmSync(home, { recursive: true, force: true }));
}

/** The seams of `stack upgrade` for `world` under `home`; `answers` are the y/N answers in order. */
function seams(world, home, { answers = [], interactive = true, engram } = {}) {
  const asked = [];
  const out = [];
  const err = [];
  return {
    asked,
    out,
    err,
    deps: {
      readUpgrade: () => ({
        rows: Object.entries(world.versions).map(([id, version]) => ({ id, version, installed: 'ok' })),
        functions: ON,
        latest: world.latest,
      }),
      spawn: (file, args, options) => {
        const line = [file, ...args].join(' ');
        // On Windows a probe is one shell line, `codegraph --version`, with no arguments.
        const probed = /^(\S+) --version$/.exec(line)?.[1];
        if (probed) return { status: 0, stdout: `${probed} ${world.versions[probed]}\n` };
        world.lines.push({ line, env: options.env, stdio: options.stdio });
        world.seen.push((readManifest(home)?.stack ?? []).map((r) => `${r.tool}.${r.dimension}:${r.applies}`));
        if (world.fail.has(line)) return { status: 1, stderr: 'it broke' };
        if (world.hang.has(line)) return { status: null, signal: 'SIGTERM', stdout: '' };
        const pinned = /^pnpm add -g (@[\w-]+\/)?([\w-]+)@(.+)$/.exec(line);
        if (pinned) world.versions[pinned[2] === 'codegraph' ? 'codegraph' : 'codex'] = pinned[3];
        if (line === 'claude plugin update engram@engram') {
          fs.mkdirSync(path.dirname(PLUGIN_FILE(home)), { recursive: true });
          fs.writeFileSync(PLUGIN_FILE(home), JSON.stringify({ version: 2, plugins: { 'engram@engram': [{ version: '0.1.21' }] } }));
        }
        return { status: 0, stdout: '' };
      },
      updateEngram: async (update, given) => {
        world.engramCalls.push(update);
        world.engramDeps.push(given);
        world.seen.push((readManifest(home)?.stack ?? []).map((r) => `${r.tool}.${r.dimension}:${r.applies}`));
        return engram ?? { ok: true, record: { path: 'C:\\e\\engram.exe', backup: `C:\\e\\engram-${update.from}.exe.bak`, sha256: 'abc' } };
      },
      ask: async (question) => {
        asked.push(question);
        return answers.shift() === 'y';
      },
      interactive,
      platform: 'win32',
      arch: 'x64',
      now: () => 'now',
      log: (line) => out.push(line),
      error: (line) => err.push(line),
    },
  };
}

const run = (argv, home, deps) => stackMain(['upgrade', '--home', home, '--pm', 'pnpm', ...argv], {}, deps);

test('a stack at its latest versions updates nothing and says so', () => withHome(async (home) => {
  const world = newWorld();
  const s = seams(world, home);
  assert.equal(await run([], home, s.deps), 0);
  assert.ok(s.out.includes('js-harness stack upgrade: every tool is at its latest version.'), s.out.join('\n'));
  assert.ok(s.out.includes('  context7: hosted, always the newest'), s.out.join('\n'));
  assert.deepEqual(world.lines, []);
  assert.equal(readManifest(home), null);
}));

test('an outdated package is shown with its undo, asked, recorded before it runs, and read back', () => withHome(async (home) => {
  const world = newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  const s = seams(world, home, { answers: ['y'] });
  assert.equal(await run([], home, s.deps), 0, s.err.join('\n'));
  assert.deepEqual(s.asked, ['Update it? [y/N] ']);
  assert.ok(s.out.includes('codegraph 1.6.0 → 1.7.0'), s.out.join('\n'));
  assert.ok(s.out.includes('     run:  pnpm add -g @colbymchenry/codegraph@1.7.0'));
  assert.ok(s.out.includes('     undo: pnpm add -g @colbymchenry/codegraph@1.6.0'));
  assert.deepEqual(world.lines.map((l) => l.line), ['pnpm add -g @colbymchenry/codegraph@1.7.0']);
  assert.deepEqual(world.seen[0], ['codegraph.upToDate:null'], 'the record is written before the command runs');
  const [record] = readManifest(home).stack;
  assert.equal(record.applies, '1.7.0');
  assert.deepEqual(record.undo, ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.6.0']);
  assert.ok(s.out.includes('codegraph 1.7.0: done'), s.out.join('\n'));
}));

test('a declined update runs nothing, records nothing and exits 1', () => withHome(async (home) => {
  const world = newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  const s = seams(world, home, { answers: ['n'] });
  assert.equal(await run([], home, s.deps), 1);
  assert.deepEqual(world.lines, []);
  assert.equal(readManifest(home), null);
  assert.ok(s.out.includes('codegraph: skipped'));
}));

test('without a terminal and without --yes it prints the plan and runs nothing', () => withHome(async (home) => {
  const world = newWorld({ codex: '0.160.0' }, { codex: '0.167.0' });
  const s = seams(world, home, { interactive: false });
  assert.equal(await run([], home, s.deps), 1);
  assert.deepEqual(world.lines, []);
  assert.ok(s.out.includes('  1. codex 0.160.0 → 0.167.0'), s.out.join('\n'));
  assert.match(s.err.join('\n'), /runs nothing without a terminal: pass --yes with --tool <id>/);
}));

test('--yes runs only the tools --tool names', () => withHome(async (home) => {
  const world = newWorld({ codegraph: '1.6.0', codex: '0.160.0' }, { codegraph: '1.7.0', codex: '0.167.0' });
  const s = seams(world, home, { interactive: false });
  assert.equal(await run(['--yes', '--tool', 'codex'], home, s.deps), 0, s.err.join('\n'));
  assert.deepEqual(world.lines.map((l) => l.line), ['pnpm add -g @openai/codex@0.167.0']);
  assert.deepEqual(s.asked, []);
}));

test('--yes without --tool, and a --tool it does not update, are usage errors', () => withHome(async (home) => {
  const s = seams(newWorld(), home);
  assert.equal(await run(['--yes'], home, s.deps), 2);
  assert.equal(await run(['--tool', 'context7'], home, s.deps), 2);
  assert.match(s.err.join('\n'), /--tool context7: stack upgrade updates only engram, engram-plugin, codegraph and codex/);
}));

test('a failed package update forgets its new record and puts an earlier one back', () => withHome(async (home) => {
  const earlier = { tool: 'codegraph', dimension: 'upToDate', kind: 'package', bin: 'codegraph', from: '1.5.0', to: '1.6.0', run: ['x'], undo: ['pnpm', 'add', '-g', '@colbymchenry/codegraph@1.5.0'], applies: '1.6.0', env: {}, at: 'then' };
  recordStackRow(home, earlier);
  const world = newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  world.fail.add('pnpm add -g @colbymchenry/codegraph@1.7.0');
  const s = seams(world, home, { answers: ['y'] });
  assert.equal(await run([], home, s.deps), 1);
  assert.deepEqual(readManifest(home).stack, [earlier]);
  assert.match(s.err.join('\n'), /codegraph 1\.7\.0 failed: exit 1: it broke/);
}));

test('the engram binary goes first, recorded with its backup and sha256, then the plugin, read back from Claude\'s file', () => withHome(async (home) => {
  const world = newWorld({ engram: '3.6.1' }, { engram: '3.6.2' });
  const s = seams(world, home, { answers: ['y', 'y'] });
  assert.equal(await run([], home, s.deps), 0, s.err.join('\n'));
  assert.equal(world.engramCalls[0].asset, 'engram_3.6.2_windows_amd64.zip');
  assert.deepEqual(world.seen[0], ['engram.upToDate:null'], 'the binary is recorded before it is replaced');
  assert.deepEqual(world.lines.map((l) => l.line), ['claude plugin marketplace update engram', 'claude plugin update engram@engram']);
  const [engram, plugin] = readManifest(home).stack;
  assert.deepEqual([engram.kind, engram.path, engram.backup, engram.applies], ['binary', 'C:\\e\\engram.exe', 'C:\\e\\engram-3.6.1.exe.bak', 'abc']);
  assert.deepEqual([plugin.kind, plugin.from, plugin.to, plugin.applies, plugin.undo], ['plugin', '0.1.19', '0.1.21', '0.1.21', null]);
  assert.ok(s.out.some((line) => /^engram 3\.6\.1 → 3\.6\.2$/.test(line)), s.out.join('\n'));
  assert.ok(s.out.includes('engram-plugin 0.1.19 → the version engram v3.6.2 ships'), s.out.join('\n'));
  assert.ok(s.out.some((line) => /undo: put engram-3\.6\.1\.exe\.bak back in its place/.test(line)), s.out.join('\n'));
  assert.ok(s.out.some((line) => /undo: none: Claude Code installs no earlier version of a plugin/.test(line)), s.out.join('\n'));
}));

test('a second engram update keeps the first version and backup as its undo', () => withHome(async (home) => {
  recordStackRow(home, { tool: 'engram', dimension: 'upToDate', kind: 'binary', bin: 'engram', from: '3.6.0', to: '3.6.1', path: 'C:\\e\\engram.exe', backup: 'C:\\e\\engram-3.6.0.exe.bak', applies: 'old', env: {}, at: 'then' });
  const world = newWorld({ engram: '3.6.1' }, { engram: '3.6.2' });
  const s = seams(world, home, { answers: ['y', 'n'] });
  await run([], home, s.deps);
  const [engram] = readManifest(home).stack;
  assert.deepEqual([engram.from, engram.to, engram.backup, engram.applies], ['3.6.0', '3.6.2', 'C:\\e\\engram-3.6.0.exe.bak', 'abc']);
}));

test('an engram update that fails forgets its record and skips the plugin that follows it', () => withHome(async (home) => {
  const world = newWorld({ engram: '3.6.1' }, { engram: '3.6.2' });
  const s = seams(world, home, { answers: ['y'], engram: { ok: false, why: 'the sha256 differs: nothing was replaced' } });
  assert.equal(await run([], home, s.deps), 1);
  assert.equal(readManifest(home), null);
  assert.deepEqual(world.lines, []);
  assert.deepEqual(s.asked, ['Update it? [y/N] '], 'the plugin is not asked');
  assert.match(s.err.join('\n'), /engram 3\.6\.2 failed: the sha256 differs: nothing was replaced/);
  assert.ok(s.out.includes('engram-plugin: skipped, since the engram binary was not updated'), s.out.join('\n'));
}));

test('--list prints what is behind with its command and undo, runs nothing and exits 0', () => withHome(async (home) => {
  const world = newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  const s = seams(world, home, { interactive: false });
  assert.equal(await run(['--list'], home, s.deps), 0);
  assert.deepEqual(world.lines, []);
  assert.deepEqual(s.asked, []);
  assert.ok(s.out.includes('  1. codegraph 1.6.0 → 1.7.0'), s.out.join('\n'));
  assert.ok(s.out.includes('js-harness upgrade updates them, each shown with its undo and asked y/N.'), s.out.join('\n'));
  assert.deepEqual(s.err, []);
}));

test('--list with nothing behind says every tool is at its latest version', () => withHome(async (home) => {
  const s = seams(newWorld(), home, { interactive: false });
  assert.equal(await run(['--list'], home, s.deps), 0);
  assert.ok(s.out.includes('js-harness stack upgrade: every tool is at its latest version.'));
}));

// The gate's clean home (bin/clean-home.test.mjs) runs `upgrade` in a scratch home: gh, run there, writes its
// device-id into it, and the uninstall that follows cannot leave it empty. Upgrade needs no prerequisite.
test('the upgrade read probes the stack and never runs gh', () => withHome(async (home) => {
  const ran = [];
  const spawn = (file, args = []) => {
    ran.push([file, ...args].join(' '));
    return { status: 1, stdout: '', stderr: '' };
  };
  const fetch = async () => { throw new Error('offline'); };
  await readUpgrade({ home, cwd: home, spawn, fetch, homedir: home, env: {} });
  assert.ok(ran.length > 0, 'the read probes the stack through the spawn it is given');
  assert.deepEqual(ran.filter((line) => /^gh\b/.test(line)), []);
}));

// --- Codex's review of the slice (2026-11-06) ---

test('latest versions that could not be read are never called the latest (Codex P2)', () => withHome(async (home) => {
  const s = seams(newWorld({}, { codex: null }), home);
  assert.equal(await run([], home, s.deps), 0);
  assert.ok(!s.out.includes('js-harness stack upgrade: every tool is at its latest version.'), s.out.join('\n'));
  assert.ok(s.out.includes('js-harness stack upgrade: nothing to update among the tools whose latest version is known; 1 could not be checked.'), s.out.join('\n'));
}));

test('a plugin update that exits 0 without reaching its known version failed, and its record is forgotten (Codex P2)', () => withHome(async (home) => {
  const world = newWorld({}, { 'engram-plugin': '0.1.22' });
  const s = seams(world, home, { answers: ['y'] });
  assert.equal(await run([], home, s.deps), 1);
  assert.match(s.err.join('\n'), /engram-plugin 0\.1\.22 failed: it exited 0 and answers 0\.1\.21/);
  assert.equal(readManifest(home)?.stack?.length ?? 0, 0);
}));

test('an update that times out keeps its record unread, since what it started may still install (Codex P2)', () => withHome(async (home) => {
  const world = newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' });
  world.hang.add('pnpm add -g @colbymchenry/codegraph@1.7.0');
  const s = seams(world, home, { answers: ['y'] });
  assert.equal(await run([], home, s.deps), 1);
  const [record] = readManifest(home).stack;
  assert.deepEqual([record.tool, record.to, record.applies], ['codegraph', '1.7.0', null]);
  assert.match(s.err.join('\n'), /codegraph 1\.7\.0: timed out .*may still be running; it stays recorded, so uninstall machine judges it/);
}));

test('the engram binary is updated under the environment its probe used, and a prefix is kept in each record (Codex P2)', () => withHome(async (home) => {
  const prefix = path.join(home, 'prefix');
  const world = newWorld({ engram: '3.6.1', codegraph: '1.6.0' }, { engram: '3.6.2', codegraph: '1.7.0' });
  const s = seams(world, home, { answers: ['y', 'n', 'y'] });
  await run(['--prefix', prefix], home, s.deps);
  assert.ok(world.engramDeps[0].env?.PATH?.includes(prefix), 'the binary is located on the PATH the probe used');
  const byTool = Object.fromEntries(readManifest(home).stack.map((r) => [r.tool, r]));
  assert.equal(byTool.engram.prefix, prefix);
  assert.equal(byTool.codegraph.prefix, prefix);
}));

test('a package whose earlier upgrade is recorded under another prefix is held and said (Codex P2)', () => withHome(async (home) => {
  recordStackRow(home, { tool: 'codegraph', dimension: 'upToDate', kind: 'package', bin: 'codegraph', from: '1.5.0', to: '1.6.0', prefix: 'P:/a', undo: ['x'], applies: '1.6.0', env: {}, at: 'then' });
  const s = seams(newWorld({ codegraph: '1.6.0' }, { codegraph: '1.7.0' }), home);
  assert.equal(await run([], home, s.deps), 1);
  assert.ok(s.out.some((line) => /^ {2}codegraph: an earlier upgrade of it is recorded under the prefix P:\/a/.test(line)), s.out.join('\n'));
}));
