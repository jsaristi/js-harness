import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTemplate, initWorkspace, removeTemplate, seedFromTemplate, seedHome } from './home.mjs';
import { currentConfig, minimalConfig, prepareSandbox, sandboxEnv } from './configs.mjs';
import { childEnv, loadTask, runTrial } from './runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_AGENT = path.join(here, 'fixtures', 'fake-agent.mjs');
const SAMPLE = path.join(here, 'fixtures', 'tasks', 'sample');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-test-'));
after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const tmp = (name) => {
  const dir = path.join(scratch, `${name}-${counter++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---- a fake real home --------------------------------------------------------------------------------

const NEVER = 'SENTINEL-NEVER-COPIED';
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

/** A believable stand-in for the machine's real home: every item of the copy list, and one of everything
 * that must never be copied (each holding the sentinel, so a copy of it anywhere is found by content as
 * well as by name). Plugin state names absolute paths inside this home, one marketplace outside it. */
function makeRealHome() {
  const home = path.join(tmp('real'), 'person');
  const claude = path.join(home, '.claude');
  const outside = path.join(scratch, 'elsewhere', 'marketplace');
  write(path.join(claude, 'settings.json'), '{"enabledPlugins":{"p@mk":true},"model":"opus"}\n');
  write(path.join(claude, 'CLAUDE.md'), '# global instructions\n');
  write(path.join(claude, 'skills', 'demo', 'SKILL.md'), '# demo skill\n');
  write(path.join(claude, 'skills', 'demo', 'refs', 'x.txt'), 'reference\n');
  write(path.join(claude, 'agents', 'a.md'), 'agent\n');
  write(path.join(claude, 'commands', 'c.md'), 'command\n');
  write(path.join(claude, 'output-styles', 'o.md'), 'style\n');
  write(path.join(claude, 'hooks', 'h.mjs'), 'export {};\n');
  const plugins = path.join(claude, 'plugins');
  write(path.join(plugins, 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: { 'p@mk': [{ scope: 'user', installPath: path.join(plugins, 'cache', 'mk', 'p', '1.0.0'), version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' }] },
  }, null, 2));
  write(path.join(plugins, 'known_marketplaces.json'), JSON.stringify({
    mk: { source: { source: 'github', repo: 'o/r' }, installLocation: path.join(plugins, 'marketplaces', 'mk'), lastUpdated: '2026-01-01T00:00:00.000Z' },
    local: { source: { source: 'directory', path: outside }, installLocation: outside },
  }, null, 2));
  write(path.join(plugins, 'cache', 'mk', 'p', '1.0.0', '.claude-plugin', 'plugin.json'), '{"name":"p"}\n');
  write(path.join(plugins, 'marketplaces', 'mk', '.claude-plugin', 'marketplace.json'), '{"name":"mk"}\n');
  write(path.join(home, '.claude.json'), JSON.stringify({
    numStartups: 3,
    projects: { [path.join(home, 'work', 'repo')]: { allowedTools: [], history: ['earlier prompt'], hasTrustDialogAccepted: true } },
    mcpServers: { engram: { command: 'engram', args: ['mcp'] }, other: { command: 'other', args: [], env: { KEEP: '1' } } },
  }, null, 2));
  write(path.join(home, '.gentle-ai', 'state.json'), '{"rdd_mode":"on"}\n');
  // Never copied.
  for (const rel of [
    ['.claude', 'projects', 'x', 'y.jsonl'], ['.claude', 'history.jsonl'], ['.claude', 'file-history', 'f.txt'], ['.claude', 'telemetry', 't.json'],
    ['.claude', 'backups', 'b.json'], ['.claude', '.credentials.json'], ['.claude', 'shell-snapshots', 's.sh'], ['.claude', 'session-env', 'e.txt'],
    ['.claude', 'todos', 't.json'], ['.claude', 'statsig', 's.json'], ['.claude', 'sessions', 's.json'], ['.claude', 'stray.txt'],
    ['.claude', 'plugins', 'data', 'state.json'], ['.engram', 'engram.db'], ['.codegraph', 'index.db'], ['.gentle-ai', 'telemetry.json'], ['notes.txt'],
  ]) write(path.join(home, ...rel), `${NEVER}\n`);
  return home;
}

/** The files of the copy list, relative to a home, with the real content they must keep (null where the
 * content is rewritten on the way and checked separately). */
const COPIED = [
  '.claude/settings.json', '.claude/CLAUDE.md', '.claude/skills/demo/SKILL.md', '.claude/skills/demo/refs/x.txt', '.claude/agents/a.md', '.claude/commands/c.md',
  '.claude/output-styles/o.md', '.claude/hooks/h.mjs', '.claude/plugins/installed_plugins.json', '.claude/plugins/known_marketplaces.json',
  '.claude/plugins/cache/mk/p/1.0.0/.claude-plugin/plugin.json', '.claude/plugins/marketplaces/mk/.claude-plugin/marketplace.json', '.claude/.claude.json',
  '.gentle-ai/state.json',
];
const REWRITTEN = new Set(['.claude/plugins/installed_plugins.json', '.claude/plugins/known_marketplaces.json', '.claude/.claude.json']);
/** Where a copied file lives in the real home. */
const realPath = (realHome, rel) => (rel === '.claude/.claude.json' ? path.join(realHome, '.claude.json') : path.join(realHome, ...rel.split('/')));

/** Every entry below `root`, path to `sha256:size` (a directory is `dir`, a link `link:<target>`), walked
 * without following links: two equal trees are byte-identical. */
function hashTree(root) {
  const tree = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.isSymbolicLink()) tree.set(rel, `link:${fs.readlinkSync(full)}`);
      else if (entry.isDirectory()) {
        tree.set(rel, 'dir');
        walk(full);
      } else {
        const bytes = fs.readFileSync(full);
        tree.set(rel, `${crypto.createHash('sha256').update(bytes).digest('hex')}:${bytes.length}`);
      }
    }
  };
  walk(root);
  return tree;
}

/** The relative paths of the files (not directories) below `root`. */
const filesOf = (root) => [...hashTree(root)].filter(([, hash]) => hash !== 'dir' && !hash.startsWith('link:')).map(([rel]) => rel).sort();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** A template of a fresh fake real home, and a function that seeds a new trial home from it. */
function setup() {
  const realHome = makeRealHome();
  const templateDir = path.join(tmp('template'), 'tpl');
  const summary = buildTemplate({ realHome, templateDir });
  const seed = () => {
    const home = path.join(tmp('trial'), 'home');
    seedHome(templateDir, home);
    return home;
  };
  return { realHome, templateDir, summary, seed };
}

// ---- buildTemplate -----------------------------------------------------------------------------------

test('buildTemplate copies exactly the copy list of the real home into a template, and reports it', () => {
  const { realHome, templateDir, summary } = setup();
  assert.deepEqual(filesOf(templateDir), ['template.json', ...COPIED.map((rel) => `home/${rel}`)].sort(), 'a copy list, not a deny list: nothing else is there');
  for (const rel of COPIED.filter((file) => !REWRITTEN.has(file))) {
    assert.equal(fs.readFileSync(path.join(templateDir, 'home', ...rel.split('/')), 'utf8'), fs.readFileSync(realPath(realHome, rel), 'utf8'), rel);
  }
  assert.equal(summary.templateDir, templateDir);
  assert.equal(summary.files, COPIED.length);
  const bytes = COPIED.reduce((total, rel) => total + fs.statSync(path.join(templateDir, 'home', ...rel.split('/'))).size, 0);
  assert.equal(summary.bytes, bytes);
  assert.deepEqual(summary.warnings.map((warning) => warning.split(':')[0]), ['known_marketplaces.json'], 'only the marketplace outside the real home, which this fake home has on purpose');
  assert.equal(readJson(path.join(templateDir, 'template.json')).kind, 'js-harness-eval-home-template');
});

test('buildTemplate keeps no path of the real home: plugin paths become a placeholder, projects are dropped', () => {
  const { realHome, templateDir } = setup();
  for (const rel of COPIED) {
    const text = fs.readFileSync(path.join(templateDir, 'home', ...rel.split('/')), 'utf8');
    assert.ok(!text.includes(realHome) && !text.includes(JSON.stringify(realHome).slice(1, -1)), `${rel} still names the real home`);
  }
  const claudeJson = readJson(path.join(templateDir, 'home', '.claude', '.claude.json'));
  assert.ok(!('projects' in claudeJson));
  assert.equal(claudeJson.numStartups, 3, 'the rest of the file is kept');
  assert.deepEqual(Object.keys(claudeJson.mcpServers).sort(), ['engram', 'other']);
});

test('buildTemplate reads the real home without changing a byte of it', () => {
  const realHome = makeRealHome();
  const before = hashTree(realHome);
  buildTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') });
  assert.deepEqual(hashTree(realHome), before);
});

test('buildTemplate takes only what exists: a real home with one item gives a template with one item', () => {
  const realHome = path.join(tmp('sparse'), 'person');
  write(path.join(realHome, '.claude', 'settings.json'), '{}\n');
  const templateDir = path.join(tmp('template'), 'tpl');
  const summary = buildTemplate({ realHome, templateDir });
  assert.deepEqual(filesOf(templateDir), ['home/.claude/settings.json', 'template.json']);
  assert.equal(summary.files, 1);
});

test('buildTemplate refuses a real home with no .claude directory: an empty current arm would pass for a result', () => {
  const realHome = tmp('empty-home');
  assert.throws(() => buildTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') }), /\.claude/);
  assert.throws(() => buildTemplate({ realHome: path.join(scratch, 'does-not-exist'), templateDir: path.join(tmp('template'), 'tpl') }), /real home/);
});

test('buildTemplate refuses a template directory that is relative, not empty, or inside the real home', () => {
  const realHome = makeRealHome();
  assert.throws(() => buildTemplate({ realHome, templateDir: 'relative-dir' }), /absolute/);
  assert.throws(() => buildTemplate({ realHome: 'relative-home', templateDir: path.join(tmp('template'), 'tpl') }), /absolute/);
  const occupied = tmp('occupied');
  write(path.join(occupied, 'keep.txt'), 'mine');
  assert.throws(() => buildTemplate({ realHome, templateDir: occupied }), /not empty/);
  assert.equal(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8'), 'mine', 'and what was there is left alone');
  assert.throws(() => buildTemplate({ realHome, templateDir: path.join(realHome, '.claude', 'template') }), /inside the real home/);
  assert.ok(!fs.existsSync(path.join(realHome, '.claude', 'template')));
  const emptyDir = tmp('empty-ok');
  assert.doesNotThrow(() => buildTemplate({ realHome, templateDir: emptyDir }), 'an existing empty directory is fine');
});

test('buildTemplate names the file that is not valid JSON instead of leaving it out', () => {
  for (const [rel, expected] of [[['.claude.json'], /\.claude\.json/], [['.claude', 'plugins', 'installed_plugins.json'], /installed_plugins\.json/], [['.claude', 'plugins', 'known_marketplaces.json'], /known_marketplaces\.json/]]) {
    const realHome = makeRealHome();
    fs.writeFileSync(path.join(realHome, ...rel), '{ nope');
    assert.throws(() => buildTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') }), expected);
  }
});

test('buildTemplate warns about what it cannot move into the sandbox, naming files and never printing values', () => {
  const realHome = makeRealHome();
  const hookPath = path.join(realHome, '.claude', 'hooks', 'h.mjs');
  fs.writeFileSync(path.join(realHome, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ command: `node ${hookPath}` }] } }));
  const { warnings } = buildTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') });
  assert.ok(warnings.some((warning) => /settings\.json/.test(warning) && /real home/.test(warning)), warnings.join('\n'));
  assert.ok(warnings.some((warning) => /known_marketplaces\.json/.test(warning) && /outside/.test(warning)), 'the marketplace outside the real home');
  assert.ok(warnings.every((warning) => !warning.includes(hookPath) && !warning.includes('elsewhere')), 'no path is printed');
});

// ---- links ---------------------------------------------------------------------------------------------

/** Links `link` to `target`, a directory (a junction on Windows, which needs no privilege). */
const linkDir = (target, link) => fs.symlinkSync(target, link, 'junction');

test('buildTemplate copies what a directory link points at instead of keeping the link', () => {
  const realHome = makeRealHome();
  const target = path.join(tmp('link-target'), 'shared-skill');
  write(path.join(target, 'SKILL.md'), '# shared\n');
  linkDir(target, path.join(realHome, '.claude', 'skills', 'linked'));
  const before = hashTree(target);
  const templateDir = path.join(tmp('template'), 'tpl');
  const { warnings } = buildTemplate({ realHome, templateDir });
  assert.equal(fs.readFileSync(path.join(templateDir, 'home', '.claude', 'skills', 'linked', 'SKILL.md'), 'utf8'), '# shared\n');
  assert.ok([...hashTree(templateDir).values()].every((hash) => !hash.startsWith('link:')), 'no link in the template');
  assert.ok(warnings.some((warning) => /skills[\\/]linked/.test(warning) && /link/.test(warning)), warnings.join('\n'));
  assert.deepEqual(hashTree(target), before, 'the link target is untouched');
});

test('buildTemplate refuses a link cycle instead of copying forever', () => {
  const realHome = makeRealHome();
  linkDir(path.join(realHome, '.claude', 'skills'), path.join(realHome, '.claude', 'skills', 'demo', 'loop'));
  assert.throws(() => buildTemplate({ realHome, templateDir: path.join(tmp('template'), 'tpl') }), /cycle/);
});

test('buildTemplate copies what a file link points at too (skipped where this machine cannot make one)', (t) => {
  const realHome = makeRealHome();
  const target = path.join(tmp('link-target'), 'CLAUDE.shared.md');
  write(target, 'shared instructions\n');
  fs.rmSync(path.join(realHome, '.claude', 'CLAUDE.md'));
  try {
    fs.symlinkSync(target, path.join(realHome, '.claude', 'CLAUDE.md'), 'file');
  } catch (err) {
    if (err.code === 'EPERM') return t.skip(`cannot create file symlinks here: ${err.code}`);
    throw err;
  }
  const templateDir = path.join(tmp('template'), 'tpl');
  buildTemplate({ realHome, templateDir });
  assert.equal(fs.readFileSync(path.join(templateDir, 'home', '.claude', 'CLAUDE.md'), 'utf8'), 'shared instructions\n');
  assert.ok([...hashTree(templateDir).values()].every((hash) => !hash.startsWith('link:')));
});

// ---- seedHome ------------------------------------------------------------------------------------------

test('seedHome copies the copy list into the trial home and nothing else', () => {
  const { realHome, seed } = setup();
  const home = seed();
  assert.deepEqual(filesOf(home), [...COPIED].sort());
  for (const rel of COPIED.filter((file) => !REWRITTEN.has(file))) {
    assert.equal(fs.readFileSync(path.join(home, ...rel.split('/')), 'utf8'), fs.readFileSync(realPath(realHome, rel), 'utf8'), rel);
  }
  for (const file of filesOf(home)) assert.ok(!fs.readFileSync(path.join(home, file), 'utf8').includes(NEVER), `${file} holds something that is never copied`);
});

test('seedHome points the plugin paths into the trial home it seeds, each one its own', () => {
  const { realHome, seed } = setup();
  const [first, second] = [seed(), seed()];
  assert.notEqual(first, second);
  for (const home of [first, second]) {
    const plugins = path.join(home, '.claude', 'plugins');
    const installed = readJson(path.join(plugins, 'installed_plugins.json'));
    assert.equal(installed.plugins['p@mk'][0].installPath, path.join(plugins, 'cache', 'mk', 'p', '1.0.0'));
    assert.ok(fs.statSync(path.join(installed.plugins['p@mk'][0].installPath, '.claude-plugin', 'plugin.json')).isFile(), 'the path leads to the copied plugin');
    assert.equal(installed.plugins['p@mk'][0].version, '1.0.0', 'the other fields are kept');
    const known = readJson(path.join(plugins, 'known_marketplaces.json'));
    assert.equal(known.mk.installLocation, path.join(plugins, 'marketplaces', 'mk'));
    assert.ok(fs.statSync(path.join(known.mk.installLocation, '.claude-plugin', 'marketplace.json')).isFile());
    assert.deepEqual(known.mk.source, { source: 'github', repo: 'o/r' });
    assert.equal(known.local.installLocation, path.join(scratch, 'elsewhere', 'marketplace'), 'a path outside the real home is left as it was');
    for (const file of ['installed_plugins.json', 'known_marketplaces.json']) {
      const text = fs.readFileSync(path.join(plugins, file), 'utf8');
      assert.ok(!text.includes(realHome) && !text.includes('@@'), `${file} holds a real path or an unreplaced placeholder`);
    }
  }
});

test('seedHome sets the engram data directory of the trial in .claude.json, drops projects, and touches no other server', () => {
  const { seed } = setup();
  const home = seed();
  const claudeJson = readJson(path.join(home, '.claude', '.claude.json'));
  assert.deepEqual(claudeJson.mcpServers.engram, { command: 'engram', args: ['mcp'], env: { ENGRAM_DATA_DIR: path.join(home, '.engram') } }, 'env is created when the server had none');
  assert.deepEqual(claudeJson.mcpServers.other, { command: 'other', args: [], env: { KEEP: '1' } });
  assert.ok(!('projects' in claudeJson));
  assert.equal(claudeJson.numStartups, 3);
});

test('seedHome keeps the other variables of an engram server that already has an env, and ignores a file with no engram', () => {
  for (const [mcpServers, expected] of [
    [{ engram: { command: 'engram', env: { OTHER: 'x', ENGRAM_DATA_DIR: 'C:\\real\\.engram' } } }, { command: 'engram', env: { OTHER: 'x', ENGRAM_DATA_DIR: null } }],
    [{ context7: { command: 'c' } }, undefined],
    [undefined, undefined],
  ]) {
    const realHome = path.join(tmp('mcp'), 'person');
    write(path.join(realHome, '.claude', 'settings.json'), '{}\n');
    write(path.join(realHome, '.claude.json'), JSON.stringify({ mcpServers }));
    const templateDir = path.join(tmp('template'), 'tpl');
    buildTemplate({ realHome, templateDir });
    const home = path.join(tmp('trial'), 'home');
    seedHome(templateDir, home);
    const seeded = readJson(path.join(home, '.claude', '.claude.json'));
    if (expected) {
      expected.env.ENGRAM_DATA_DIR = path.join(home, '.engram');
      assert.deepEqual(seeded.mcpServers.engram, expected);
    } else {
      assert.deepEqual(seeded, mcpServers ? { mcpServers } : {}, 'no engram server, so nothing was added');
    }
  }
});

test('seedHome copies the gentle-ai state and nothing else of that directory', () => {
  const { seed } = setup();
  const home = seed();
  assert.deepEqual(fs.readdirSync(path.join(home, '.gentle-ai')), ['state.json']);
  assert.equal(fs.readFileSync(path.join(home, '.gentle-ai', 'state.json'), 'utf8'), '{"rdd_mode":"on"}\n');
});

test('seeding leaves the real home byte-identical, and nothing in the template or a home is a link or leads out of it', () => {
  const { realHome, templateDir, seed } = setup();
  const before = hashTree(realHome);
  const homes = [seed(), seed()];
  assert.deepEqual(hashTree(realHome), before, 'the real home after a build and two seeds');
  for (const root of [templateDir, ...homes]) {
    const realRoot = fs.realpathSync(root);
    for (const [rel, hash] of hashTree(root)) {
      assert.ok(!hash.startsWith('link:'), `${rel} is a link`);
      const real = fs.realpathSync(path.join(root, ...rel.split('/')));
      assert.ok(real === realRoot || real.startsWith(realRoot + path.sep), `${rel} leads to ${real}`);
    }
  }
});

test('the template is frozen: a change to the real home after the build reaches no trial', () => {
  const { realHome, seed } = setup();
  fs.writeFileSync(path.join(realHome, '.claude', 'settings.json'), '{"edited":true}\n');
  fs.rmSync(path.join(realHome, '.claude', 'skills'), { recursive: true });
  const home = seed();
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), '{"enabledPlugins":{"p@mk":true},"model":"opus"}\n');
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'demo', 'SKILL.md')));
});

test('seedHome refuses a directory that is not a template, a template with a link in it, and a relative home', () => {
  const { templateDir } = setup();
  assert.throws(() => seedHome(tmp('not-a-template'), path.join(tmp('trial'), 'home')), /template/);
  assert.throws(() => seedHome(templateDir, 'relative-home'), /absolute/);
  const target = tmp('outside');
  linkDir(target, path.join(templateDir, 'home', '.claude', 'skills', 'sneaked'));
  const home = path.join(tmp('trial'), 'home');
  assert.throws(() => seedHome(templateDir, home), /holds a link at/);
});

test('removeTemplate removes a template, and refuses to remove a directory that is not one', () => {
  const { templateDir } = setup();
  removeTemplate(templateDir);
  assert.ok(!fs.existsSync(templateDir));
  removeTemplate(templateDir);
  const other = tmp('other');
  write(path.join(other, 'important.txt'), 'keep');
  assert.throws(() => removeTemplate(other), /template/);
  assert.equal(fs.readFileSync(path.join(other, 'important.txt'), 'utf8'), 'keep');
});

// ---- the workspace project layer -------------------------------------------------------------------------

/** A prepared trial: a home with the shared preparation done, and a workspace that is a git repository. */
function preparedTrial() {
  const home = path.join(tmp('init'), 'home');
  const workspace = tmp('ws');
  write(path.join(workspace, 'a.txt'), 'alpha\n');
  prepareSandbox({ home, workspace });
  return { home, workspace };
}

test('initWorkspace runs the init command in the workspace, under the sandbox env of the trial and no other', async () => {
  const { home, workspace } = preparedTrial();
  const calls = [];
  await withEnv({ CLAUDE_CODE_CHILD_SESSION: '1', GIT_DIR: path.join(scratch, 'x') }, () => initWorkspace({ home, workspace, runInit: (call) => (calls.push(call), { status: 0, stdout: '', stderr: '' }) }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].workspace, workspace);
  const expected = childEnv(sandboxEnv({ home }));
  assert.deepEqual(calls[0].env, expected);
  assert.equal(calls[0].env.HOME, home);
  assert.ok(!('CLAUDE_CODE_CHILD_SESSION' in calls[0].env) && !('GIT_DIR' in calls[0].env));
});

test('initWorkspace adds the extra env it is given on top of the sandbox env', async () => {
  const { home, workspace } = preparedTrial();
  let seen;
  await initWorkspace({ home, workspace, env: { EXTRA_FOR_INIT: 'yes' }, runInit: (call) => ((seen = call.env), { status: 0, stdout: '', stderr: '' }) });
  assert.equal(seen.EXTRA_FOR_INIT, 'yes');
  assert.equal(seen.HOME, home);
});

test('initWorkspace rejects when init exits non-zero, or reports a failed step, so a trial never runs without its project layer', async () => {
  const { home, workspace } = preparedTrial();
  await assert.rejects(initWorkspace({ home, workspace, runInit: () => ({ status: 1, stdout: '', stderr: 'not a git repository: run git init first\n' }) }), /not a git repository/);
  await assert.rejects(initWorkspace({ home, workspace, runInit: () => ({ status: 0, stdout: 'wrote harness.json\n', stderr: 'codegraph init failed: codegraph: command not found\n' }) }), /codegraph init failed/);
  await assert.rejects(initWorkspace({ home, workspace, runInit: () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' }) }), /spawn ENOENT/);
  await assert.doesNotReject(initWorkspace({ home, workspace, runInit: () => ({ status: 0, stdout: 'wrote harness.json\n', stderr: 'kept AGENTS.md (already there)\n' }) }));
});

/** A stand-in `codegraph` on PATH that makes the directory the real one would and exits 0, so the real
 * `js-harness init` runs end to end without codegraph installed, indexing or starting anything. */
function stubCodegraphDir() {
  const dir = tmp('stub-bin');
  fs.writeFileSync(path.join(dir, 'codegraph.cmd'), '@echo off\r\nmkdir .codegraph\r\nexit /b 0\r\n');
  fs.writeFileSync(path.join(dir, 'codegraph'), '#!/bin/sh\nmkdir -p .codegraph\n', { mode: 0o755 });
  return dir;
}

test('the real js-harness init, run by initWorkspace under the sandbox, writes the project layer into the workspace', async () => {
  const { home, workspace } = preparedTrial();
  const stub = stubCodegraphDir();
  await initWorkspace({ home, workspace, env: { PATH: `${stub}${path.delimiter}${process.env.PATH ?? process.env.Path}` } });
  for (const rel of ['harness.json', 'AGENTS.md', '.codegraph']) assert.ok(fs.existsSync(path.join(workspace, rel)), rel);
  const hook = spawnSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], { cwd: workspace, env: childEnv(sandboxEnv({ home })), encoding: 'utf8' }).stdout.trim();
  assert.ok(fs.existsSync(path.resolve(workspace, hook)), 'the pre-commit hook');
});

// ---- the current arm, end to end through runTrial ---------------------------------------------------------

async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((name) => [name, process.env[name]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** One trial of the sample task with the fake agent standing in for the binary of `config`. The agent
 * reports what it sees: the seeded global CLAUDE.md, the workspace entries and its commits. */
async function trialWithFakeAgent(config) {
  const report = path.join(tmp('report'), 'report.json');
  const wrapped = {
    ...config,
    args: (context) => [FAKE_AGENT, ...config.args(context)],
    versionArgs: [FAKE_AGENT, '--version'],
    env: (context) => ({
      ...config.env(context),
      FAKE_AGENT_MODE: 'noop',
      FAKE_AGENT_REPORT: report,
      FAKE_AGENT_GIT_LOG: '1',
      FAKE_AGENT_READ_FILE: path.join(context.home, '.claude', 'CLAUDE.md'),
    }),
  };
  const outcome = await runTrial({ task: loadTask(SAMPLE), config: wrapped, effort: 'medium', repeat: 1, readVersion: () => '1.0.0', workRoot: tmp('work'), runsDir: tmp('runs') });
  assert.equal(outcome.status, 'recorded');
  return JSON.parse(fs.readFileSync(report, 'utf8'));
}

const OPTIONS = { command: process.execPath, model: 'test-model', permissionMode: 'test-mode' };

test('the current arm runs init and sees the seeded home; the minimal arm runs no init and sees a bare one; both start in the same repo', async () => {
  const { templateDir } = setup();
  const inits = [];
  const runInit = (call) => (inits.push(call.workspace), { status: 0, stdout: '', stderr: '' });

  const current = await trialWithFakeAgent(currentConfig({ ...OPTIONS, seed: seedFromTemplate(templateDir, { runInit }) }));
  assert.equal(current.fileRead, '# global instructions\n', 'the agent reads the CLAUDE.md the template carried');
  assert.equal(inits.length, 1, 'init ran once, for the current arm');
  assert.equal(path.basename(inits[0]), path.basename(current.cwd), 'in the trial workspace, the one the agent then ran in');
  assert.deepEqual(current.gitLog, ['eval <eval@localhost> fixture'], 'one commit, the fixture');
  assert.ok(current.entries.includes('.git') && current.entries.includes('calc.mjs'));

  const minimal = await trialWithFakeAgent(minimalConfig(OPTIONS));
  assert.equal(inits.length, 1, 'the minimal arm ran no init');
  assert.equal(minimal.fileRead, null, 'and has no CLAUDE.md');
  assert.deepEqual(minimal.gitLog, current.gitLog, 'the same repo to start from');
  assert.deepEqual(minimal.entries, current.entries);
});

test('seedFromTemplate fails when asked for, not when a trial is already running: a directory that is not a template is refused up front', () => {
  assert.throws(() => seedFromTemplate(tmp('nothing-here')), /template/);
});

test('the seed of the current arm runs after the shared preparation and seeds the home before init runs', async () => {
  const { templateDir } = setup();
  const order = [];
  const runInit = (call) => {
    order.push({ claudeJson: fs.existsSync(path.join(call.env.HOME, '.claude', '.claude.json')), repo: fs.existsSync(path.join(call.workspace, '.git')) });
    return { status: 0, stdout: '', stderr: '' };
  };
  await trialWithFakeAgent(currentConfig({ ...OPTIONS, seed: seedFromTemplate(templateDir, { runInit }) }));
  assert.deepEqual(order, [{ claudeJson: true, repo: true }]);
});
