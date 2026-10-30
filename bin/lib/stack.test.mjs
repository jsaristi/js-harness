import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tools, checks, resolveProjectRoot, probeTool, probeStack, hookCommandPlan, ENGRAM_INSTALL } from './stack.mjs';
import { recordOptionalFile } from './manifest.mjs';
import { CODEX_DAEMON_FIX } from './codex-daemon.mjs';
import { launcherFileName, loginLauncher, remoteFiles, remoteId } from './remote.mjs';

function makeTmpHome(prefix = 'js-harness-stack-home-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function fakeSpawnOk(stdout) {
  return () => ({ status: 0, stdout, stderr: '' });
}

function fakeSpawnMissing() {
  return () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
}

function findTool(id) {
  const tool = tools.find((t) => t.id === id);
  assert.ok(tool, `expected a tool record for ${id}`);
  return tool;
}

test('tools carries exactly the six stack tools, in Design-table order, engram\'s plugin after engram, the last one the Codex CLI', () => {
  assert.deepEqual(
    tools.map((t) => t.id),
    ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex'],
  );
});

// F8 S11 (odd/tasks/f8-s11-complements.md, S4): gentle-ai installs nothing any more, so no row of the stack names it.
test('no tool is gentle-ai, and no fix of any tool names it', () => {
  assert.equal(tools.some((tool) => /gentle-ai/i.test(tool.id)), false);
  for (const tool of tools) {
    const fixes = [tool.fix({ project: '/root' }), { upToDate: tool.upToDateFix?.('1.0.0', '2.0.0', [{ id: 'engram', version: '3.6.0' }]) ?? [] }];
    for (const command of fixes.flatMap((fix) => Object.values(fix).flat())) assert.doesNotMatch(command, /gentle-ai/i, `${tool.id}: ${command}`);
  }
});

// --- engram-plugin (odd/tasks/engram-plugin-lag.md): engram's Claude Code plugin ---

function seedEngramPlugin(home, { version = '0.1.12', enabled = true } = {}) {
  writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), { version: 2, plugins: { 'engram@engram': [{ version }] } });
  writeJson(path.join(home, '.claude', 'settings.json'), { enabledPlugins: { 'engram@engram': enabled } });
}

// F8 S11 (S1): js-harness installs the plugin now, so a machine without it sees the gap and engram's own command.
test('engram-plugin is a row on a machine without it: installed and claude missing, with engram setup and the enable as fixes', () => {
  const home = makeTmpHome();
  try {
    const row = probeTool(findTool('engram-plugin'), { home });
    assert.deepEqual({ installed: row.installed, claude: row.claude, codex: row.codex }, { installed: 'missing', claude: 'missing', codex: 'n/a' });
    assert.deepEqual(row.fix, {
      installed: 'engram setup claude-code',
      claude: 'claude plugin enable engram@engram',
      upToDate: ['claude plugin marketplace update engram', 'claude plugin update engram@engram'],
    });
    seedEngramPlugin(home, { enabled: false });
    assert.equal(probeTool(findTool('engram-plugin'), { home }).claude, 'missing', 'installed but disabled: its hooks do not run');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('engram-plugin reads its version from installed_plugins.json, claude ok, codex and project n/a', () => {
  const home = makeTmpHome();
  try {
    seedEngramPlugin(home);
    const row = probeTool(findTool('engram-plugin'), { home });
    assert.deepEqual(
      { version: row.version, installed: row.installed, claude: row.claude, codex: row.codex, project: row.project },
      { version: '0.1.12', installed: 'ok', claude: 'ok', codex: 'n/a', project: 'n/a' },
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('engram-plugin upToDate fix refreshes the engram catalog, then updates the plugin (verified by --help 2026-10-20)', () => {
  assert.deepEqual(findTool('engram-plugin').fix({}).upToDate, ['claude plugin marketplace update engram', 'claude plugin update engram@engram']);
});

test('engram-plugin upToDate fix names the installed version, the one the engram binary\'s tag ships, and the restart', () => {
  const { upToDateFix } = findTool('engram-plugin');
  const rows = [{ id: 'engram', installed: 'ok', version: '3.5.1' }];
  assert.deepEqual(upToDateFix('0.1.12', '0.1.14', rows), [
    'plugin 0.1.12 is behind 0.1.14, the plugin engram v3.5.1 ships; update it, then restart Claude Code:',
    'claude plugin marketplace update engram',
    'claude plugin update engram@engram',
  ]);
  assert.deepEqual(upToDateFix('0.1.12', null, rows), ['claude plugin marketplace update engram', 'claude plugin update engram@engram']);
});

test('engram-plugin upToDate fix, when the binary\'s tag cannot be read from the marketplace clone, fetches that tag into it', () => {
  const { upToDateFix } = findTool('engram-plugin');
  const rows = [{ id: 'engram', installed: 'ok', version: '3.6.0' }];
  const home = path.join(os.tmpdir(), 'a home');
  const clone = path.join(home, '.claude', 'plugins', 'marketplaces', 'engram');
  const lead = 'the plugin engram v3.6.0 ships cannot be read from tag v3.6.0 of Claude Code\'s engram marketplace clone, which it clones shallow, without tags; fetch that tag into the clone, then run doctor again:';
  assert.deepEqual(upToDateFix('0.1.19', null, rows, { home, platform: 'linux' }), [lead, `git -C '${clone}' fetch --depth 1 origin tag v3.6.0`]);
  assert.deepEqual(upToDateFix('0.1.19', null, rows, { home, platform: 'win32' }), [lead, `git -C "${clone}" fetch --depth 1 origin tag v3.6.0`]);
  // With no binary version there is no tag to name: the catalog and plugin update, as before.
  assert.deepEqual(upToDateFix('0.1.19', null, [], { home, platform: 'linux' }), ['claude plugin marketplace update engram', 'claude plugin update engram@engram']);
});

test('engram-plugin upToDate fix for a plugin ahead of its binary\'s tag updates the binary, not the plugin (row 11)', () => {
  const { upToDateFix } = findTool('engram-plugin');
  const rows = [{ id: 'engram', installed: 'ok', version: '3.5.1' }];
  const ahead = 'plugin 0.1.16 is ahead of 0.1.14, the plugin engram v3.5.1 ships, so the two serve different protocols';
  // A newer engram release known (the engram row's latest version, which doctor already resolves): the binary moves.
  assert.deepEqual(upToDateFix('0.1.16', '0.1.14', rows, { latestVersions: { engram: '3.6.0' } }), [
    `${ahead}; engram v3.6.0 is out: update the engram binary, then restart Claude Code:`,
    ENGRAM_INSTALL,
  ]);
});

// odd/tasks/codex-daemon-row.md, S2: on 2026-10-30 the binary, 3.6.0, was engram's latest release, so "update the engram
// binary" could not be followed.
test('engram-plugin upToDate fix for a plugin ahead of a binary that is engram\'s latest release says nothing is to be done until the next one', () => {
  const { upToDateFix } = findTool('engram-plugin');
  const rows = [{ id: 'engram', installed: 'ok', version: '3.6.0' }];
  const said = [
    'plugin 0.1.19 is ahead of 0.1.17, the plugin engram v3.6.0 ships, so the two serve different protocols; engram v3.6.0 is engram\'s latest release, so the plugin is ahead of engram\'s last release and nothing is to be done until the next one: then update the engram binary and restart Claude Code',
  ];
  assert.deepEqual(upToDateFix('0.1.19', '0.1.17', rows, { latestVersions: { engram: '3.6.0' } }), said);
  assert.deepEqual(upToDateFix('0.1.19', '0.1.17', rows, { latestVersions: { engram: '3.5.1' } }), said, 'a binary past the latest read');
});

test('engram-plugin upToDate fix for a plugin ahead of its binary\'s tag, with engram\'s latest release unknown, says both cases', () => {
  const { upToDateFix } = findTool('engram-plugin');
  const rows = [{ id: 'engram', installed: 'ok', version: '3.6.0' }];
  const both = [
    'plugin 0.1.19 is ahead of 0.1.17, the plugin engram v3.6.0 ships, so the two serve different protocols; if engram has a release newer than v3.6.0, update the engram binary, then restart Claude Code; if not, the plugin is ahead of engram\'s last release and nothing is to be done until the next one:',
    ENGRAM_INSTALL,
  ];
  assert.deepEqual(upToDateFix('0.1.19', '0.1.17', rows), both, 'no latest versions given');
  assert.deepEqual(upToDateFix('0.1.19', '0.1.17', rows, { latestVersions: { engram: null } }), both, 'engram\'s latest not looked up');
  assert.deepEqual(upToDateFix('0.1.19', '0.1.17', rows, { latestVersions: { engram: 'not a version' } }), both, 'an unreadable latest');
});

test('no tool ever recommends `codegraph upgrade` (user rule)', () => {
  for (const tool of tools) {
    for (const fix of Object.values(tool.fix({ project: '/some/project' }))) {
      for (const command of [fix].flat()) assert.doesNotMatch(command, /codegraph upgrade/);
    }
  }
});

// --- per-dimension fix maps ---

test('engram fix covers installed, claude, codex and upToDate but not project', () => {
  const fix = findTool('engram').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'upToDate']);
});

// F8 S11 (L3, L4): engram's own commands, read in its v3.6.0 source and README: the release page for the binary, and
// `engram setup` for each host.
test('engram fixes are engram\'s own: its release page for the binary, engram setup for each host', () => {
  const fix = findTool('engram').fix({});
  assert.equal(fix.installed, ENGRAM_INSTALL);
  assert.equal(fix.upToDate, ENGRAM_INSTALL);
  assert.equal(fix.claude, 'engram setup claude-code');
  assert.equal(fix.codex, 'engram setup codex');
  assert.match(ENGRAM_INSTALL, /https:\/\/github\.com\/Gentleman-Programming\/engram\/releases/);
});

test('codegraph fix covers all five dimensions, and its project fix carries the resolved project root', () => {
  const fix = findTool('codegraph').fix({ project: 'D:/some/resolved/root' });
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'project', 'upToDate']);
  assert.match(fix.project, /D:\/some\/resolved\/root/);
  assert.doesNotMatch(fix.installed, /codegraph upgrade/);
});

test('codegraph project fix never prints a null or undefined root when no project resolved', () => {
  for (const project of [undefined, null, '']) {
    const fix = findTool('codegraph').fix({ project });
    assert.doesNotMatch(fix.project, /null|undefined|--cwd\s*$/);
    assert.equal(fix.project, 'codegraph init --yes <project root>');
  }
});

test('codegraph registers Claude and Codex through their own mcp add commands, not the npm install', () => {
  const fix = findTool('codegraph').fix({ project: '/root' });
  assert.match(fix.claude, /^claude mcp add /);
  assert.match(fix.codex, /^codex mcp add /);
});

test('context7 fix covers claude, codex, project and upToDate but has no installed fix', () => {
  const fix = findTool('context7').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'project', 'upToDate']);
});

test('typescript-lsp fix covers installed, claude and upToDate but has no codex or project fix', () => {
  const fix = findTool('typescript-lsp').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'installed', 'upToDate']);
});

test('codex fix covers installed, codex and upToDate with the Codex CLI commands, and no claude or project fix', () => {
  const fix = findTool('codex').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['codex', 'installed', 'upToDate']);
  assert.equal(fix.installed, 'npm i -g @openai/codex');
  assert.equal(fix.codex, 'codex login');
  assert.equal(fix.upToDate, 'npm i -g @openai/codex@latest');
});

test('the codegraph and codex install lines run the machine\'s package manager, never npm on a pnpm machine (launch audit C-stack-1)', () => {
  const pnpm = { JS_HARNESS_PM: 'pnpm' };
  const codex = findTool('codex').fix({ env: pnpm });
  assert.equal(codex.installed, 'pnpm add -g @openai/codex');
  assert.equal(codex.upToDate, 'pnpm add -g @openai/codex@latest');
  // Codex on 46e3842..96de03d: a word is quoted for the platform the line is run on, never as cmd.exe quotes it.
  const spaced = { JS_HARNESS_PM: '/opt/a&b/pnpm' };
  assert.equal(findTool('codex').fix({ env: spaced, platform: 'linux' }).installed, "'/opt/a&b/pnpm' add -g @openai/codex");
  assert.equal(findTool('codex').fix({ env: spaced, platform: 'win32' }).installed, '"/opt/a&b/pnpm" add -g @openai/codex');
  const codegraph = findTool('codegraph').fix({ env: pnpm, project: '/root' });
  assert.equal(codegraph.installed, 'pnpm add -g @colbymchenry/codegraph');
  assert.equal(codegraph.upToDate, 'pnpm add -g @colbymchenry/codegraph');
  for (const tool of tools) {
    for (const command of Object.values(tool.fix({ env: pnpm, project: '/root' })).flat()) assert.doesNotMatch(command, /^npm /, `${tool.id}: ${command}`);
  }
  assert.equal(findTool('codex').fix({ env: { JS_HARNESS_PM: 'npm' } }).installed, 'npm i -g @openai/codex', 'npm keeps the line doctor always wrote');
});

test('no fix command string carries a shell separator (`;` or `&&`), and codegraph installed stays one string', () => {
  for (const tool of tools) {
    for (const fix of Object.values(tool.fix({ project: '/some/project' }))) {
      for (const command of [fix].flat()) assert.doesNotMatch(command, /;|&&/);
    }
  }
  assert.equal(typeof findTool('codegraph').fix({}).installed, 'string');
});

// --- installed + version: version-command tools (engram, codegraph) ---

test('a version-command tool reports ok + the first semver on a zero exit', () => {
  const tool = findTool('engram');
  const result = tool.installed({ spawn: fakeSpawnOk('engram 3.7.0\n') });
  assert.deepEqual(result, { state: 'ok', version: '3.7.0' });
});

test('a version-command tool reports missing when the binary is not found', () => {
  const tool = findTool('engram');
  const result = tool.installed({ spawn: fakeSpawnMissing() });
  assert.deepEqual(result, { state: 'missing', version: null });
});

test('a version-command tool reports missing on a non-zero exit', () => {
  const tool = findTool('codegraph');
  const spawn = () => ({ status: 1, stdout: '', stderr: 'boom' });
  assert.deepEqual(tool.installed({ spawn }), { state: 'missing', version: null });
});

test('a version-command tool reports unknown when stdout has no parseable semver', () => {
  const tool = findTool('engram');
  const result = tool.installed({ spawn: fakeSpawnOk('not a version') });
  assert.deepEqual(result, { state: 'unknown', version: null });
});

test('a version-command tool spawns through a shell on win32 as one command line, no args array', () => {
  // Node 24 warns (DEP0190) on stderr when a shell spawn also gets an args array, and the hook
  // path must never write to stderr. The probe args are fixed literals, so joining is safe.
  const tool = findTool('codegraph');
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '1.6.0', stderr: '' };
  };
  tool.installed({ spawn, platform: 'win32' });
  assert.equal(calls[0].cmd, 'codegraph --version');
  assert.deepEqual(calls[0].args, []);
  assert.equal(calls[0].opts.shell, true);
});

test('a version-command tool does not use a shell off win32', () => {
  const tool = findTool('codegraph');
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '1.6.0', stderr: '' };
  };
  tool.installed({ spawn, platform: 'linux' });
  assert.equal(calls[0].opts.shell, false);
});

// --- R3-001: every version-probe spawn gets a 5s timeout; a timed-out probe is `unknown` ---

test('a version-command tool passes a 5000ms timeout to spawn', () => {
  const tool = findTool('engram');
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push(opts);
    return { status: 0, stdout: '3.7.0', stderr: '' };
  };
  tool.installed({ spawn });
  assert.equal(calls[0].timeout, 5000);
});

test('a timed-out (killed by signal) probe reports unknown, not missing', () => {
  const tool = findTool('engram');
  // This is the shape Node's own spawnSync returns when it kills the child after `timeout` elapses:
  // no exit status, a signal, and whatever partial stdout it had.
  const spawn = () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' });
  assert.deepEqual(tool.installed({ spawn }), { state: 'unknown', version: null });
});

test('a probe whose spawn result carries an ETIMEDOUT error reports unknown, not missing', () => {
  const tool = findTool('codegraph');
  const error = new Error('spawnSync codegraph ETIMEDOUT');
  error.code = 'ETIMEDOUT';
  const spawn = () => ({ status: null, error, stdout: '', stderr: '' });
  assert.deepEqual(tool.installed({ spawn }), { state: 'unknown', version: null });
});

// --- installed + version: context7 (no CLI, derived from host config) ---

test('context7 reports version "hosted" when Claude Code has a type: http entry with a url', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp', args: [] } },
    });
    const tool = findTool('context7');
    assert.deepEqual(tool.installed({ home }), { state: 'ok', version: 'hosted' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 reads the pinned npx package version when it is not hosted', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: {
        context7: { command: 'npx', args: ['-y', '--package=@upstash/context7-mcp@2.2.5', '--', 'context7-mcp'] },
      },
    });
    const tool = findTool('context7');
    assert.deepEqual(tool.installed({ home }), { state: 'ok', version: '2.2.5' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 is missing when registered nowhere', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), { mcpServers: {} });
    const tool = findTool('context7');
    assert.deepEqual(tool.installed({ home }), { state: 'missing', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 is unknown (not missing) when registered only in Codex, whose TOML we never parse', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), { mcpServers: {} });
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.context7]\nurl = "x"\n', 'utf8');
    const tool = findTool('context7');
    assert.deepEqual(tool.installed({ home }), { state: 'unknown', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('context7 is unknown when .claude.json exists but is malformed', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, '.claude.json'), '{ not json', 'utf8');
    const tool = findTool('context7');
    assert.deepEqual(tool.installed({ home }), { state: 'unknown', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- installed + version: typescript-lsp (from the plugin marketplace's own record) ---

test('typescript-lsp reads its version from installed_plugins.json', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }] },
    });
    const tool = findTool('typescript-lsp');
    assert.deepEqual(tool.installed({ home }), { state: 'ok', version: '1.0.0' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp is missing when installed_plugins.json does not exist', () => {
  const home = makeTmpHome();
  try {
    const tool = findTool('typescript-lsp');
    assert.deepEqual(tool.installed({ home }), { state: 'missing', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp is unknown when installed_plugins.json is malformed', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'not json', 'utf8');
    const tool = findTool('typescript-lsp');
    assert.deepEqual(tool.installed({ home }), { state: 'unknown', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- installed + version: codex (the Codex CLI's own `--version`) ---

test('codex installed is the version `codex --version` prints', () => {
  const spawn = commandSpawn({ 'codex --version': CLI_VERSION });
  assert.deepEqual(findTool('codex').installed({ spawn }), { state: 'ok', version: '0.130.0' });
});

test('codex is missing when `codex --version` cannot run, exits non-zero, or the spawn throws', () => {
  const tool = findTool('codex');
  assert.deepEqual(tool.installed({ spawn: fakeSpawnMissing() }), { state: 'missing', version: null });
  assert.deepEqual(tool.installed({ spawn: commandSpawn({ 'codex --version': { status: 1, stdout: '' } }) }), {
    state: 'missing',
    version: null,
  });
  const throwing = () => {
    throw new Error('spawn blew up');
  };
  assert.deepEqual(tool.installed({ spawn: throwing }), { state: 'missing', version: null });
});

test('codex is unknown when its version output has no version, or the probe is killed by a timeout', () => {
  const tool = findTool('codex');
  assert.deepEqual(tool.installed({ spawn: commandSpawn({ 'codex --version': { status: 0, stdout: 'codex (no build)' } }) }), {
    state: 'unknown',
    version: null,
  });
  assert.deepEqual(tool.installed({ spawn: commandSpawn({ 'codex --version': { status: null, signal: 'SIGTERM', stdout: '' } }) }), {
    state: 'unknown',
    version: null,
  });
});


// --- configured per host ---

test('codegraph configured reads Claude from mcpServers and Codex from a config.toml presence check', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), { mcpServers: { codegraph: { command: 'codegraph' } } });
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.engram]\ncommand = "engram"\n', 'utf8');
    const tool = findTool('codegraph');
    assert.deepEqual(tool.configured({ home }), { claude: 'ok', codex: 'missing' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the Codex presence check does not match a section that merely starts with the same name', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    // A `codegraph-extra` section must never satisfy a presence check for `codegraph`.
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), '[mcp_servers.codegraph-extra]\nurl = "x"\n', 'utf8');
    const tool = findTool('codegraph');
    assert.equal(tool.configured({ home }).codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('typescript-lsp configured reads Claude from settings.json enabledPlugins and n/a for Codex', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'settings.json'), {
      enabledPlugins: { 'typescript-lsp@claude-plugins-official': true },
    });
    const tool = findTool('typescript-lsp');
    assert.deepEqual(tool.configured({ home }), { claude: 'ok', codex: 'n/a' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- configured: codex (logged in, asked of the Codex CLI itself; `claude` is n/a, Claude Code has no Codex side) ---

const LOGGED_IN = { status: 0, stdout: 'Logged in using ChatGPT\n', stderr: '' };
const LOGGED_OUT = { status: 1, stdout: '', stderr: 'Not logged in' };
const CLI_VERSION = { status: 0, stdout: 'codex-cli 0.130.0\n', stderr: '' };

/** A fake spawn answering per command line (`codex --version`, `codex login status`), recording each as
 * `{ line, cmd, args, opts }` in `calls`. A line with no answer looks like a missing binary. */
function commandSpawn(answers, calls = []) {
  return (cmd, args, opts) => {
    const line = [cmd, ...args].join(' ');
    calls.push({ line, cmd, args, opts });
    return answers[line] ?? { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

/** The calls of the login probe among `calls`. */
const loginCalls = (calls) => calls.filter((call) => call.line === 'codex login status');

test('codex claude is n/a: Claude Code has no Codex side to be configured', () => {
  const home = makeTmpHome();
  try {
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN });
    assert.deepEqual(findTool('codex').configured({ home, spawn }), { claude: 'n/a', codex: 'ok' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is ok when `codex login status` exits 0', () => {
  const home = makeTmpHome();
  try {
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': { ...LOGGED_IN } });
    assert.equal(findTool('codex').configured({ home, spawn }).codex, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is missing when `codex login status` exits non-zero (not logged in)', () => {
  const home = makeTmpHome();
  try {
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_OUT });
    assert.equal(findTool('codex').configured({ home, spawn }).codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is unknown when the login probe is killed by a timeout signal', () => {
  const home = makeTmpHome();
  try {
    const spawn = commandSpawn({
      'codex --version': CLI_VERSION,
      'codex login status': { status: null, signal: 'SIGTERM', stdout: '', stderr: '' },
    });
    assert.equal(findTool('codex').configured({ home, spawn }).codex, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is unknown when the login probe result carries an ETIMEDOUT error', () => {
  const home = makeTmpHome();
  try {
    const error = new Error('spawnSync codex ETIMEDOUT');
    error.code = 'ETIMEDOUT';
    const spawn = commandSpawn({
      'codex --version': CLI_VERSION,
      'codex login status': { status: null, error, stdout: '', stderr: '' },
    });
    assert.equal(findTool('codex').configured({ home, spawn }).codex, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is missing when the login probe cannot run: no answer, a spawn that throws, or no result', () => {
  const home = makeTmpHome();
  try {
    const tool = findTool('codex');
    assert.equal(tool.configured({ home, spawn: commandSpawn({ 'codex --version': CLI_VERSION }) }).codex, 'missing');
    const throwing = (cmd, args) => {
      if ([cmd, ...args].join(' ') === 'codex login status') throw new Error('spawn blew up');
      return CLI_VERSION;
    };
    assert.equal(tool.configured({ home, spawn: throwing }).codex, 'missing');
    const noResult = (cmd, args) => ([cmd, ...args].join(' ') === 'codex --version' ? CLI_VERSION : undefined);
    assert.equal(tool.configured({ home, spawn: noResult }).codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex is n/a and the login probe never spawns when the Codex CLI is missing', () => {
  const home = makeTmpHome();
  try {
    for (const [label, answers] of Object.entries({
      'no answer (ENOENT)': {},
      'a version that exits non-zero': { 'codex --version': { status: 1, stdout: '' } },
    })) {
      const calls = [];
      const configured = findTool('codex').configured({ home, spawn: commandSpawn(answers, calls) });
      assert.equal(configured.codex, 'n/a', label);
      assert.deepEqual(calls.map((call) => call.line), ['codex --version'], `${label}: only the version is asked`);
    }
    const thrown = [];
    const throwing = (cmd, args) => {
      thrown.push([cmd, ...args].join(' '));
      throw new Error('spawn blew up');
    };
    assert.equal(findTool('codex').configured({ home, spawn: throwing }).codex, 'n/a');
    assert.deepEqual(thrown, ['codex --version']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a missing Codex CLI costs the row one process: the version probe, and no login probe', () => {
  const calls = [];
  const row = probeTool(findTool('codex'), { home: makeTmpHome(), spawn: commandSpawn({}, calls), platform: 'linux' });
  assert.equal(row.installed, 'missing');
  assert.equal(row.codex, 'n/a');
  assert.deepEqual(calls.map((call) => call.line), ['codex --version']);
});

test('a healthy Codex probes its version and then its login, once each', () => {
  const home = makeTmpHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, calls);
    const row = probeTool(findTool('codex'), { home, spawn, platform: 'linux' });
    assert.equal(row.codex, 'ok');
    assert.deepEqual(calls.map((call) => call.line), ['codex --version', 'codex login status']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a logged-out Codex row: installed ok, codex missing, its fix is `codex login`, and no codexCli field', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project5-');
  try {
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_OUT });
    const row = probeTool(findTool('codex'), { home, project, spawn, platform: 'linux' });
    assert.equal(row.version, '0.130.0');
    assert.equal(row.installed, 'ok');
    assert.equal(row.claude, 'n/a');
    assert.equal(row.codex, 'missing');
    assert.equal(row.project, 'n/a');
    assert.equal('codexCli' in row, false);
    assert.equal(row.fix.codex, 'codex login');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('the login probe points CODEX_HOME at <home>/.codex and keeps the rest of the environment', () => {
  const home = makeTmpHome();
  try {
    const calls = [];
    findTool('codex').configured({ home, spawn: commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, calls), platform: 'linux' });
    const [login] = loginCalls(calls);
    assert.equal(login.opts.env.CODEX_HOME, path.join(home, '.codex'));
    assert.equal(login.opts.env.PATH ?? login.opts.env.Path, process.env.PATH ?? process.env.Path);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the login probe passes the 5000ms timeout, and the version probe gets no env', () => {
  const home = makeTmpHome();
  try {
    const calls = [];
    findTool('codex').configured({ home, spawn: commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, calls) });
    assert.equal(loginCalls(calls)[0].opts.timeout, 5000);
    const version = calls.find((call) => call.line === 'codex --version');
    assert.equal('env' in version.opts, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the login probe is one shell command line with no args array on win32, an args array elsewhere', () => {
  const home = makeTmpHome();
  try {
    const win = [];
    findTool('codex').configured({ home, spawn: commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, win), platform: 'win32' });
    const winLogin = loginCalls(win)[0];
    assert.equal(winLogin.cmd, 'codex login status');
    assert.deepEqual(winLogin.args, []);
    assert.equal(winLogin.opts.shell, true);

    const posix = [];
    findTool('codex').configured({ home, spawn: commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, posix), platform: 'linux' });
    const posixLogin = loginCalls(posix)[0];
    assert.equal(posixLogin.cmd, 'codex');
    assert.deepEqual(posixLogin.args, ['login', 'status']);
    assert.equal(posixLogin.opts.shell, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the codex login answer comes only from the probe, never from an auth.json in the Codex home', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.codex', 'auth.json'), { tokens: { access_token: 'sentinel-secret' } });
    const spawn = commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_OUT });
    assert.equal(findTool('codex').configured({ home, spawn }).codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- R3-codex-home-overrides-user-env (accepted T6 review follow-up): a `CODEX_HOME` the user already set is kept
// when `home` is the real home. `env` and `homedir` are injectable so no test ever touches `process.env`. ---

function loginOptsFor({ home, env, homedir, platform = 'linux' }) {
  const calls = [];
  findTool('codex').configured({ home, env, homedir, platform, spawn: commandSpawn({ 'codex --version': CLI_VERSION, 'codex login status': LOGGED_IN }, calls) });
  const logins = loginCalls(calls);
  assert.equal(logins.length, 1);
  return logins[0].opts;
}

test('the codex login probe keeps a CODEX_HOME the user set when home is the real home', () => {
  const home = makeTmpHome();
  try {
    const opts = loginOptsFor({ home, env: { CODEX_HOME: '/users/own/codex' }, homedir: home });
    assert.equal('env' in opts, false, 'the child must inherit the user\'s own CODEX_HOME untouched');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the codex login probe overrides CODEX_HOME when home is not the real home', () => {
  const home = makeTmpHome();
  try {
    const opts = loginOptsFor({ home, env: { CODEX_HOME: '/users/own/codex' }, homedir: path.join(home, 'elsewhere') });
    assert.equal(opts.env.CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the codex login probe sets <home>/.codex on the real home when the user has no CODEX_HOME', () => {
  const home = makeTmpHome();
  try {
    const opts = loginOptsFor({ home, env: {}, homedir: home });
    assert.equal(opts.env.CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the real-home comparison ignores case on win32 only', () => {
  const home = makeTmpHome();
  try {
    // Same directory, differing only in case (the tmp path always has lowercase letters).
    const homedir = home.toUpperCase();
    const env = { CODEX_HOME: '/users/own/codex' };
    assert.equal('env' in loginOptsFor({ home, env, homedir, platform: 'win32' }), false);
    assert.equal(loginOptsFor({ home, env, homedir, platform: 'linux' }).env.CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- codegraph's project cell: `n/a` where the project's codeMap switch is off, so no index fix is offered ---

test('codegraph project cell is n/a where codeMap is off, and reads the index otherwise', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-stack-codemap-'));
  try {
    const cell = findTool('codegraph').project;
    const off = { codeMap: { value: 'off' } };
    assert.equal(cell({ project, functions: off }), 'n/a');
    assert.equal(cell({ project, functions: { codeMap: { value: 'on-demand' } } }), 'missing');
    assert.equal(cell({ project }), 'missing');
    fs.mkdirSync(path.join(project, '.codegraph'));
    assert.equal(cell({ project, functions: off }), 'n/a');
    assert.equal(cell({ project, functions: { codeMap: { value: 'always' } } }), 'ok');
    assert.equal(cell({ project }), 'ok');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- when: the codex row is shown unless the project's codexReview switch is off (an unresolved switch shows it) ---

test('codex has a when that hides it only for codexReview off', () => {
  const when = findTool('codex').when;
  assert.equal(when({ functions: { codexReview: { value: 'off' } } }), false);
  assert.equal(when({ functions: { codexReview: { value: 'on' } } }), true);
  assert.equal(when({ functions: { codexReview: { value: 'auto' } } }), true);
  assert.equal(when({}), true);
});

test('probeStack leaves the codex row out only when codexReview resolves off, and no other row', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project-when-');
  try {
    const ids = (functions) => probeStack({ home, project, spawn: fakeSpawnMissing(), functions }).map((row) => row.id);
    const off = ids({ codexReview: { value: 'off' } });
    assert.equal(off.includes('codex'), false);
    assert.deepEqual(off, ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'codex-trust', 'codex-daemon', 'pnpm-lock']);
    assert.equal(ids({ codexReview: { value: 'on' } }).includes('codex'), true);
    assert.equal(ids(undefined).includes('codex'), true, 'with no switches resolved the row is shown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('the engram-plugin row is left out only where the engramPlugin switch resolves off (F8 S11, L9)', () => {
  const when = findTool('engram-plugin').when;
  assert.equal(when({ functions: { engramPlugin: { value: 'off' } } }), false);
  assert.equal(when({ functions: { engramPlugin: { value: 'on' } } }), true);
  assert.equal(when({}), true, 'with no switches resolved the row is shown');
});

test('probeStack leaves the engram-plugin row out only when engramPlugin resolves off, and no other row (gentle-ai R3-002)', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project-engram-plugin-');
  try {
    const ids = (functions) => probeStack({ home, project, spawn: fakeSpawnMissing(), functions }).map((row) => row.id);
    const all = ids({ engramPlugin: { value: 'on' } });
    assert.equal(all.includes('engram-plugin'), true);
    assert.deepEqual(ids({ engramPlugin: { value: 'off' } }), all.filter((id) => id !== 'engram-plugin'));
    assert.deepEqual(ids(undefined), all, 'with no switches resolved the row is shown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- context7's project cell: a gap where Claude Code turns it off for the project (F8 S11, L5 and L6) ---

test('context7 project is missing where ~/.claude.json disables it for the project, by either slash, with /mcp as the fix', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project-context7-');
  try {
    const tool = findTool('context7');
    assert.equal(tool.project({ home, project }), 'ok', 'no ~/.claude.json disables nothing');
    writeJson(path.join(home, '.claude.json'), { projects: { [project]: { disabledMcpServers: ['context7'] } } });
    assert.equal(tool.project({ home, project }), 'missing');
    writeJson(path.join(home, '.claude.json'), { projects: { [project.replaceAll('\\', '/')]: { disabledMcpServers: ['context7'] } } });
    assert.equal(tool.project({ home, project }), 'missing', 'Claude Code keys a Windows project with forward slashes');
    writeJson(path.join(home, '.claude.json'), { projects: { [project]: { disabledMcpServers: ['engram'] } } });
    assert.equal(tool.project({ home, project }), 'ok');
    assert.equal(tool.project({ home }), 'n/a', 'no project, no project cell');
    fs.writeFileSync(path.join(home, '.claude.json'), '{ not json');
    assert.equal(tool.project({ home, project }), 'unknown');
    assert.match(tool.fix({ project }).project, /\/mcp/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-004: Claude MCP configured also reads a project-scoped registration ---

test('engram configured.claude reads a project-scoped registration from projects[<root>].mcpServers', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: {},
      projects: { '/repo/root': { mcpServers: { engram: { command: 'engram' } } } },
    });
    const tool = findTool('engram');
    assert.equal(tool.configured({ home, project: '/repo/root' }).claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a global mcpServers registration still wins when there is no matching project scope', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: { codegraph: { command: 'codegraph' } },
      projects: { '/some/other/root': { mcpServers: {} } },
    });
    const tool = findTool('codegraph');
    assert.equal(tool.configured({ home, project: '/repo/root' }).claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('neither global nor the current project scope registered is still missing', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude.json'), {
      mcpServers: {},
      projects: { '/some/other/root': { mcpServers: { context7: { type: 'http', url: 'x' } } } },
    });
    const tool = findTool('context7');
    assert.equal(tool.configured({ home, project: '/repo/root' }).claude, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a JSON-backed configured check is unknown when its file is malformed, not missing', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, '.claude.json'), '{ nope', 'utf8');
    const tool = findTool('engram');
    assert.equal(tool.configured({ home }).claude, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- configured per project ---

test('codegraph configured for the project is ok when .codegraph/ exists', () => {
  const project = makeTmpHome('js-harness-stack-project-');
  try {
    fs.mkdirSync(path.join(project, '.codegraph'));
    const tool = findTool('codegraph');
    assert.equal(tool.project({ project }), 'ok');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('codegraph configured for the project is missing when .codegraph/ does not exist', () => {
  const project = makeTmpHome('js-harness-stack-project2-');
  try {
    const tool = findTool('codegraph');
    assert.equal(tool.project({ project }), 'missing');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('project is n/a for every tool that has no per-project meaning', () => {
  for (const id of ['engram', 'engram-plugin', 'typescript-lsp', 'codex']) {
    assert.equal(findTool(id).project({ project: '/does/not/matter' }), 'n/a');
  }
});

// --- resolveProjectRoot ---

test('resolveProjectRoot returns the injected spawn\'s git toplevel', () => {
  const spawn = () => ({ status: 0, stdout: 'D:/some/repo\n', stderr: '' });
  assert.equal(resolveProjectRoot('D:/some/repo/nested', spawn), 'D:/some/repo');
});

test('resolveProjectRoot falls back to cwd when git fails', () => {
  const spawn = () => ({ status: 128, stdout: '', stderr: 'not a git repository' });
  assert.equal(resolveProjectRoot('/tmp/not-a-repo', spawn), '/tmp/not-a-repo');
});

test('resolveProjectRoot falls back to cwd when spawning git throws', () => {
  const spawn = () => {
    throw new Error('spawn ENOENT');
  };
  assert.equal(resolveProjectRoot('/tmp/no-git', spawn), '/tmp/no-git');
});

// --- probeTool / probeStack ---

test('probeTool assembles one full row, leaving upToDate unknown for T2', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project3-');
  try {
    writeJson(path.join(home, '.claude.json'), { mcpServers: { engram: { command: 'engram', args: ['mcp', '--tools=agent'] } } });
    const tool = findTool('engram');
    const deps = { home, project, spawn: fakeSpawnOk('engram 3.6.0') };
    const row = probeTool(tool, deps);
    assert.deepEqual(row, {
      id: 'engram',
      version: '3.6.0',
      installed: 'ok',
      claude: 'ok',
      codex: 'missing',
      project: 'n/a',
      upToDate: 'unknown',
      fix: tool.fix(deps),
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('probeStack returns one row per tool, in order, then one per check, never throwing on an empty home', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project4-');
  try {
    const rows = probeStack({ home, project, spawn: fakeSpawnMissing() });
    assert.deepEqual(
      rows.map((r) => r.id),
      ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'codex-trust', 'codex-daemon', 'pnpm-lock'],
    );
    for (const row of rows) assert.equal(row.upToDate, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- the Claude account check: the CLI and the desktop app signed into the same account ---

const CLI_ACCOUNT = '11111111-aaaa-4bbb-8ccc-000000000001';
const OTHER_ACCOUNT = '22222222-dddd-4eee-8fff-000000000002';
/** Where the desktop app keeps its config under a home, on the platforms it has one the check reads. */
const APP_CONFIG = {
  win32: ['AppData', 'Roaming', 'Claude', 'config.json'],
  darwin: ['Library', 'Application Support', 'Claude', 'config.json'],
};

/** Writes the two files the check reads, each with its identifier among other keys; `undefined` writes no file. */
function seedAccounts(home, { cli, app, platform = 'win32' }) {
  if (cli !== undefined) {
    writeJson(path.join(home, '.claude.json'), { mcpServers: {}, oauthAccount: { accountUuid: cli, emailAddress: 'someone@example.com' } });
  }
  if (app !== undefined) {
    writeJson(path.join(home, ...APP_CONFIG[platform]), { lastKnownAccountUuid: app, 'oauth:tokenCache': 'never read' });
  }
}

/** The check's `claude` cell for a home seeded by `seed`. A spawn that throws proves nothing is run to find it. */
function accountState(seed, platform = 'win32') {
  const home = makeTmpHome('js-harness-stack-account-');
  try {
    seed(home);
    const spawn = () => {
      throw new Error('the account check runs nothing');
    };
    return checks.find((check) => check.id === 'claude-account').configured({ home, platform, spawn }).claude;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('checks carries the Claude account check and then the remote server one, apart from the tools', () => {
  assert.deepEqual(checks.map((check) => check.id), ['memory-rules', 'session-classes', 'claude-account', 'remote-server', 'codex-trust', 'codex-daemon', 'hook-commands', 'pnpm-lock']);
  assert.equal(tools.some((tool) => ['claude-account', 'remote-server'].includes(tool.id)), false);
});

// odd/tasks/codex-daemon-row.md, S1: the daemon check reads the Codex home of `home`, and its fix is the reason, then
// what the state says is wrong and the repair, each on its own line.
test('the codex-daemon check reads <home>/.codex: missing on a current with no executable, with the repair as its fix', () => {
  const home = makeTmpHome('js-harness-stack-daemon-');
  try {
    const pkg = path.join(home, '.codex', 'packages', 'app-server-daemon');
    const release = path.join(pkg, 'releases', '0.162.0-x86_64-pc-windows-msvc');
    fs.mkdirSync(path.join(release, 'bin'), { recursive: true });
    writeJson(path.join(release, 'codex-package.json'), { version: '0.162.0', entrypoint: 'bin/codex.exe' });
    fs.symlinkSync(release, path.join(pkg, 'current'), 'junction');
    const check = checks.find((candidate) => candidate.id === 'codex-daemon');
    const row = probeTool(check, { home, project: home, spawn: fakeSpawnMissing() });
    assert.equal(row.codex, 'missing');
    assert.equal(row.claude, 'n/a');
    assert.equal(row.installed, 'n/a');
    assert.equal(row.fix.codex[0], CODEX_DAEMON_FIX);
    assert.match(row.fix.codex[1], /bin\/codex\.exe, which is not there$/);
    assert.ok(row.fix.codex.length > 3, 'the repair follows');
    fs.writeFileSync(path.join(release, 'bin', 'codex.exe'), 'binary');
    const healthy = probeTool(check, { home, project: home, spawn: fakeSpawnMissing() });
    assert.equal(healthy.codex, 'ok');
    assert.deepEqual(healthy.fix, {});
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('claude-account is ok when the CLI and the desktop app name the same account, on Windows and on macOS', () => {
  for (const platform of ['win32', 'darwin']) {
    assert.equal(accountState((home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT, platform }), platform), 'ok', platform);
  }
  // An identifier is hexadecimal: the same account written in another letter case is the same account.
  assert.equal(accountState((home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT.toUpperCase() })), 'ok');
});

test('claude-account is mismatch when both identifiers are there and differ', () => {
  for (const platform of ['win32', 'darwin']) {
    assert.equal(accountState((home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT, platform }), platform), 'mismatch', platform);
  }
});

test('claude-account is unknown, never a gap, when either identifier cannot be had', () => {
  const appConfig = (home) => path.join(home, ...APP_CONFIG.win32);
  const cases = {
    'an empty home': () => {},
    'no ~/.claude.json': (home) => seedAccounts(home, { app: CLI_ACCOUNT }),
    'no desktop app config': (home) => seedAccounts(home, { cli: CLI_ACCOUNT }),
    '~/.claude.json is not JSON': (home) => {
      seedAccounts(home, { app: CLI_ACCOUNT });
      fs.writeFileSync(path.join(home, '.claude.json'), '{ nope');
    },
    'the app config is not JSON': (home) => {
      seedAccounts(home, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
      fs.writeFileSync(appConfig(home), 'not json');
    },
    'the app config cannot be read (a folder is there)': (home) => {
      seedAccounts(home, { cli: CLI_ACCOUNT });
      fs.mkdirSync(appConfig(home), { recursive: true });
    },
    'the CLI is signed out (no oauthAccount)': (home) => {
      seedAccounts(home, { app: CLI_ACCOUNT });
      writeJson(path.join(home, '.claude.json'), { mcpServers: {} });
    },
    'the app has no account key': (home) => {
      seedAccounts(home, { cli: CLI_ACCOUNT });
      writeJson(appConfig(home), { locale: 'en' });
    },
    'an identifier is the empty string': (home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: '' }),
    'an identifier is blank': (home) => seedAccounts(home, { cli: '  ', app: '  ' }),
    'an identifier is not a string': (home) => seedAccounts(home, { cli: 7, app: 7 }),
    'a file holds JSON that is not an object': (home) => {
      seedAccounts(home, { app: CLI_ACCOUNT });
      fs.writeFileSync(path.join(home, '.claude.json'), 'null');
    },
  };
  for (const [what, seed] of Object.entries(cases)) assert.equal(accountState(seed), 'unknown', what);
});

test('claude-account is unknown on a platform where the desktop app has no known config, whatever the home holds', () => {
  const seed = (home) => {
    seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT, platform: 'win32' });
    seedAccounts(home, { app: OTHER_ACCOUNT, platform: 'darwin' });
  };
  assert.equal(accountState(seed, 'linux'), 'unknown');
});

/** Moves the Windows app config `seedAccounts` wrote to where the app keeps it since 2026-10-21: its folder under
 * `AppData\Local\Claude-Data\claude_<id>`, and in the old one only the marker that names it (`windowsFolder`). */
function moveAppFolder(home, id = 'claude_0a1b2c') {
  const old = path.join(home, 'AppData', 'Roaming', 'Claude');
  const moved = path.join(home, 'AppData', 'Local', 'Claude-Data', id);
  fs.mkdirSync(path.dirname(moved), { recursive: true });
  fs.renameSync(old, moved);
  fs.mkdirSync(old);
  fs.writeFileSync(path.join(old, `.user-data-left.${id}`), '');
}

test('claude-account reads the desktop app config from the folder the app moved it to on Windows', () => {
  const same = (home) => {
    seedAccounts(home, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    moveAppFolder(home);
  };
  assert.equal(accountState(same), 'ok');
  const other = (home) => {
    seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT });
    moveAppFolder(home);
  };
  assert.equal(accountState(other), 'mismatch');
});

test('claude-account reads only under the home it is given, whatever APPDATA and LOCALAPPDATA name', () => {
  const home = makeTmpHome('js-harness-stack-account-');
  const elsewhere = makeTmpHome('js-harness-stack-account-env-');
  try {
    seedAccounts(home, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    seedAccounts(elsewhere, { app: OTHER_ACCOUNT });
    const env = { APPDATA: path.join(elsewhere, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(elsewhere, 'AppData', 'Local') };
    const state = checks.find((check) => check.id === 'claude-account').configured({ home, platform: 'win32', env }).claude;
    assert.equal(state, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('claude-account reads the app config of the platform it is given, under the home it is given', () => {
  // The macOS location is not read on Windows, nor the Windows one on macOS.
  assert.equal(accountState((home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT, platform: 'darwin' }), 'win32'), 'unknown');
  assert.equal(accountState((home) => seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT, platform: 'win32' }), 'darwin'), 'unknown');
});

test('the claude-account row has only a claude cell, the sign-in command as its fix, and neither identifier', () => {
  const home = makeTmpHome('js-harness-stack-account-');
  try {
    seedAccounts(home, { cli: CLI_ACCOUNT, app: OTHER_ACCOUNT });
    const row = probeTool(checks.find((check) => check.id === 'claude-account'), { home, project: home, spawn: fakeSpawnMissing(), platform: 'win32' });
    assert.deepEqual(row, {
      id: 'claude-account',
      version: null,
      installed: 'n/a',
      claude: 'mismatch',
      codex: 'n/a',
      project: 'n/a',
      upToDate: 'unknown',
      fix: { claude: 'claude auth login' },
    });
    const all = JSON.stringify(probeStack({ home, project: home, spawn: fakeSpawnMissing(), platform: 'win32' }));
    assert.equal(all.includes(CLI_ACCOUNT) || all.includes(OTHER_ACCOUNT), false, 'no row carries an account identifier');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- the remote server check: the server of every recorded login launcher is running ---

const REMOTE_CHECK = checks.find((check) => check.id === 'remote-server');
const STARTED_AT = 1_759_700_000_000;
/** Project folders are only ever named here, never opened: the check reads the launcher, not the project. */
const PROJ = 'D:\\work\\proj';
const OTHER_PROJ = 'D:\\my work\\other proj';

/** What `remote start --at-login` leaves for the project at `root`, under `home`: the launcher, in a folder of the
 * test's own (the machine manifest names it by its absolute path, which is all the check finds it by), and its
 * record. `state` is the state file's content (an object, or text as it is; none when omitted) and `stopped`
 * leaves the marker of a `remote stop`. Returns the paths. */
function seedLauncher(home, root, { state, stopped = false, text, options } = {}) {
  const files = remoteFiles(home, remoteId(root, 'win32'));
  const launcher = path.join(home, 'Startup', launcherFileName(remoteId(root, 'win32')));
  const content = text ?? loginLauncher({ node: 'C:\\node\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root, name: 'proj', ...options });
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, content);
  recordOptionalFile(home, launcher, content);
  fs.mkdirSync(path.dirname(files.statePath), { recursive: true });
  if (state !== undefined) fs.writeFileSync(files.statePath, typeof state === 'string' ? state : JSON.stringify(state));
  if (stopped) fs.writeFileSync(files.stoppedPath, 'stopped on purpose\n');
  return { ...files, launcher };
}

/** A spawn that knows one program, the process snapshot: PowerShell lists `System` and then `processes`
 * (`[pid, createdAt]`, `null` for a creation time Windows does not give), in the rows `takeSnapshot` reads.
 * Every look's options land in `looks`. Anything else run is a failure: the check runs nothing but that. */
function fakeProcesses(processes, looks = []) {
  return (cmd, _args, options) => {
    assert.equal(cmd, 'powershell', 'the remote server check runs nothing but the process snapshot');
    looks.push(options);
    const rows = [[4, 1], ...processes].map(([pid, createdAt]) => `${pid}\t0\t${createdAt ?? ''}\tnode.exe`);
    return { status: 0, stdout: `${rows.join('\r\n')}\r\n`, stderr: '' };
  };
}

/** The check's row for a home seeded by `seed`, with `spawn` as the only way to look at the processes. Without
 * one, nothing may be run at all: no recorded state file names a process, so there is none to look up. */
function remoteRow(seed, spawn) {
  const home = makeTmpHome('js-harness-stack-remote-');
  const ran = [];
  const runsNothing = (cmd) => {
    ran.push(cmd);
    return { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
  try {
    seed(home);
    const row = probeTool(REMOTE_CHECK, { home, project: home, spawn: spawn ?? runsNothing, platform: 'win32' });
    assert.deepEqual(ran, [], 'nothing is run when no recorded state file names a process');
    return row;
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('remote-server is n/a, and looks at no process, when the machine manifest records no login launcher', () => {
  const cases = {
    // This machine may have a launcher of its own recorded: a temp home never sees it, nor its state.
    'an empty home': () => {},
    'a manifest with no optional file': (home) => writeJson(path.join(home, '.js-harness', 'manifest.json'), { version: '1.0.0', files: [], entries: [] }),
    'an optional file that is not a launcher': (home) => recordOptionalFile(home, path.join(home, 'Startup', 'notes.cmd'), 'x'),
    'a launcher whose file is gone: nothing starts that server at login': (home) => fs.rmSync(seedLauncher(home, PROJ).launcher),
  };
  for (const [what, seed] of Object.entries(cases)) {
    assert.deepEqual(
      remoteRow(seed),
      { id: 'remote-server', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'unknown', fix: {} },
      what,
    );
  }
});

test('remote-server is ok when every recorded launcher\'s server runs, told by pid and creation time from one look', () => {
  const looks = [];
  const row = remoteRow((home) => {
    seedLauncher(home, PROJ, { state: { pid: 4242, startedAt: STARTED_AT } });
    seedLauncher(home, OTHER_PROJ, { state: { pid: 4343, startedAt: STARTED_AT + 9 } });
  }, fakeProcesses([[4242, STARTED_AT], [4343, STARTED_AT + 9]], looks));
  assert.equal(row.claude, 'ok');
  assert.deepEqual(row.fix, {});
  assert.equal(looks.length, 1, 'one snapshot serves every launcher');
  assert.equal(looks[0].timeout, 5000, 'bounded like every other probe: doctor runs at each session start');
});

test('remote-server is down, a gap whose fix starts that server, when a recorded launcher\'s server is not running', () => {
  const fix = { claude: 'js-harness remote start --cwd D:\\work\\proj --name proj' };
  // Nothing recorded: no supervisor was started, or a stop removed its record. No process is looked up for that.
  assert.deepEqual(
    remoteRow((home) => seedLauncher(home, PROJ)),
    { id: 'remote-server', version: null, installed: 'n/a', claude: 'down', codex: 'n/a', project: 'n/a', upToDate: 'unknown', fix },
  );
  const recorded = (home) => seedLauncher(home, PROJ, { state: { pid: 4242, startedAt: STARTED_AT } });
  // The supervisor died: nothing has its pid.
  assert.deepEqual(remoteRow(recorded, fakeProcesses([])).fix, fix);
  assert.equal(remoteRow(recorded, fakeProcesses([])).claude, 'down');
  // Its pid went to another program: a pid alone is never taken for the supervisor.
  assert.equal(remoteRow(recorded, fakeProcesses([[4242, STARTED_AT + 60_000]])).claude, 'down');
});

test('remote-server reads the state file under the home it is given, for the folder the launcher itself names', () => {
  const home = makeTmpHome('js-harness-stack-remote-');
  const elsewhere = makeTmpHome('js-harness-stack-remote-');
  try {
    // The launcher starts OTHER_PROJ, whatever its file is called; a record for PROJ, and one under another home, are not its server's.
    const { launcher } = seedLauncher(home, PROJ, { state: { pid: 4242, startedAt: STARTED_AT }, text: loginLauncher({ node: 'C:\\node\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root: OTHER_PROJ, name: 'other' }) });
    const other = remoteFiles(elsewhere, remoteId(OTHER_PROJ, 'win32'));
    writeJson(other.statePath, { pid: 4242, startedAt: STARTED_AT });
    const deps = { home, project: home, spawn: fakeProcesses([[4242, STARTED_AT]]), platform: 'win32' };
    assert.equal(probeTool(REMOTE_CHECK, deps).claude, 'down');
    assert.deepEqual(probeTool(REMOTE_CHECK, deps).fix, { claude: 'js-harness remote start --cwd "D:\\my work\\other proj" --name other' }, 'the folder is quoted where a command line needs it');

    fs.copyFileSync(other.statePath, remoteFiles(home, remoteId(OTHER_PROJ, 'win32')).statePath);
    assert.equal(probeTool(REMOTE_CHECK, deps).claude, 'ok');
    assert.ok(fs.existsSync(launcher));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('remote-server says a server was stopped on purpose, which is why the watchdog left it down, and names every server that is down', () => {
  const stoppedFix = 'js-harness remote start --cwd D:\\work\\proj --name proj (stopped on purpose with js-harness remote stop, so the watchdog leaves it down)';
  assert.deepEqual(remoteRow((home) => seedLauncher(home, PROJ, { stopped: true })).fix, { claude: stoppedFix });
  // The marker of a stop says nothing of a server that runs: a start removes it, and a stale one is not a gap.
  const running = remoteRow((home) => seedLauncher(home, PROJ, { state: { pid: 4242, startedAt: STARTED_AT }, stopped: true }), fakeProcesses([[4242, STARTED_AT]]));
  assert.equal(running.claude, 'ok');

  const several = remoteRow((home) => {
    seedLauncher(home, PROJ, { stopped: true });
    seedLauncher(home, OTHER_PROJ, { state: { pid: 4343, startedAt: STARTED_AT } });
    seedLauncher(home, 'D:\\work\\third', { state: { pid: 4242, startedAt: STARTED_AT } });
  }, fakeProcesses([[4242, STARTED_AT]]));
  assert.equal(several.claude, 'down');
  assert.deepEqual(several.fix, { claude: [stoppedFix, 'js-harness remote start --cwd "D:\\my work\\other proj" --name proj'] }, 'one command for each server that is down, none for the one that runs');
});

test('remote-server\'s fix starts the server as its launcher does: every option of the launcher\'s own line, in its order', () => {
  const fixOf = (root, options) => remoteRow((home) => seedLauncher(home, root, { options })).fix.claude;
  // A name that is not the folder's, a permission mode, a spawn mode and a home: a bare `start --cwd` would bring
  // the server back under the folder's name and the user's own modes, its state under another home.
  assert.equal(
    fixOf(PROJ, { name: 'phone', permissionMode: 'acceptEdits', spawnMode: 'worktree', home: 'D:\\homes\\alt' }),
    'js-harness remote start --cwd D:\\work\\proj --name phone --permission-mode acceptEdits --spawn worktree --home D:\\homes\\alt',
  );
  assert.equal(fixOf(PROJ, { name: 'phone' }), 'js-harness remote start --cwd D:\\work\\proj --name phone', 'only what the launcher holds: no option is made up');
  assert.equal(
    fixOf(OTHER_PROJ, { name: 'my phone', home: 'D:\\other home' }),
    'js-harness remote start --cwd "D:\\my work\\other proj" --name "my phone" --home "D:\\other home"',
    'a value with a space is quoted, as the launcher quotes it',
  );
  for (const command of [fixOf(PROJ, { name: 'phone', spawnMode: 'session' }), fixOf(PROJ, { name: 'phone' })]) {
    assert.doesNotMatch(command, /--at-login|--watchdog/);
  }
});

test('remote-server is unknown, with no fix, for a launcher whose start line cannot be read back whole: a fix is never a guess', () => {
  const line = (rest) => `@echo off\r\n"C:\\node\\node.exe" D:\\js-harness\\bin\\remote.mjs start --cwd D:\\work\\proj ${rest}\r\n`;
  // Each of these servers is down (no state file): with a line read whole it would be a gap with a command.
  assert.equal(remoteRow((home) => seedLauncher(home, PROJ, { text: line('--name proj') })).claude, 'down');
  for (const rest of ['--name proj --verbose', '--name', '--name proj extra', '--name "my phone']) {
    const row = remoteRow((home) => seedLauncher(home, PROJ, { text: line(rest) }));
    assert.equal(row.claude, 'unknown', rest);
    assert.deepEqual(row.fix, {}, rest);
  }
  // The flag the scheduled task adds says how the start is run, not which server: it is read, and left out.
  assert.equal(remoteRow((home) => seedLauncher(home, PROJ, { text: line('--name proj --watchdog') })).fix.claude, 'js-harness remote start --cwd D:\\work\\proj --name proj');
});

test('remote-server names a server once when its launcher is recorded under two spellings of its path', () => {
  const row = remoteRow((home) => {
    const { launcher } = seedLauncher(home, PROJ);
    // The record matches by the exact path string, so another spelling of one path is a second record.
    recordOptionalFile(home, `${path.dirname(launcher)}${path.sep}.${path.sep}${path.basename(launcher)}`, 'x');
  });
  assert.equal(row.claude, 'down');
  assert.deepEqual(row.fix, { claude: 'js-harness remote start --cwd D:\\work\\proj --name proj' });
});

test('remote-server is unknown, never a gap, when it cannot tell whether a recorded launcher\'s server runs', () => {
  const recorded = (home) => seedLauncher(home, PROJ, { state: { pid: 4242, startedAt: STARTED_AT } });
  const cases = {
    'the manifest is not JSON': [(home) => {
      fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
      fs.writeFileSync(path.join(home, '.js-harness', 'manifest.json'), '{ nope');
    }],
    'the launcher cannot be read (a folder is there)': [(home) => {
      const { launcher } = seedLauncher(home, PROJ);
      fs.rmSync(launcher);
      fs.mkdirSync(launcher);
    }],
    'the launcher starts no server this can read': [(home) => seedLauncher(home, PROJ, { text: '@echo off\r\nnotepad.exe\r\n' })],
    'the state file is not a record of a supervisor': [(home) => seedLauncher(home, PROJ, { state: '{ nope' })],
    'the processes could not be listed': [recorded, fakeSpawnMissing()],
    'the snapshot was killed after its timeout': [recorded, () => ({ status: null, signal: 'SIGTERM', error: Object.assign(new Error('spawnSync powershell ETIMEDOUT'), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' })],
    'the look-up itself throws': [recorded, () => {
      throw new Error('spawn failed');
    }],
    'a process has the pid and no creation time': [recorded, fakeProcesses([[4242, null]])],
  };
  for (const [what, [seed, spawn]] of Object.entries(cases)) {
    const row = remoteRow(seed, spawn);
    assert.equal(row.claude, 'unknown', what);
    assert.deepEqual(row.fix, {}, what);
  }
});

test('remote-server: one server down is the gap whatever the others are, and one that cannot be told hides no running one as ok', () => {
  const mixed = (others) => remoteRow((home) => {
    seedLauncher(home, PROJ, { state: '{ nope' });
    others(home);
  }, fakeProcesses([[4242, STARTED_AT]]));
  assert.equal(mixed((home) => seedLauncher(home, OTHER_PROJ, { state: { pid: 4242, startedAt: STARTED_AT } })).claude, 'unknown');
  const down = mixed((home) => seedLauncher(home, OTHER_PROJ));
  assert.equal(down.claude, 'down');
  assert.deepEqual(down.fix, { claude: 'js-harness remote start --cwd "D:\\my work\\other proj" --name proj' }, 'only the server known to be down has a command');
});

// --- the hook commands check: the copy on the path answers every command the recorded hook entries run ---

test('hookCommandPlan tries a js-harness resume command with its guard taken off', () => {
  assert.deepEqual(hookCommandPlan(['js-harness resume --pause || exit 0', 'js-harness resume --hook']), [
    { command: 'js-harness resume --pause', tried: true },
    { command: 'js-harness resume --hook', tried: true },
  ]);
});

test('hookCommandPlan tries the turn-start hook of the rules too, which with empty input writes nothing and ends at once', () => {
  assert.deepEqual(hookCommandPlan(['js-harness rules --hook || exit 0']), [{ command: 'js-harness rules --hook', tried: true }]);
});

test('hookCommandPlan lists any other command as not tried, the session-start report among them', () => {
  assert.deepEqual(hookCommandPlan(['js-harness doctor --hook']), [{ command: 'js-harness doctor --hook', tried: false }]);
});

test('hookCommandPlan plans a command named twice, with and without its guard, once', () => {
  assert.deepEqual(hookCommandPlan(['js-harness resume --pause || exit 0', 'js-harness resume --pause']), [
    { command: 'js-harness resume --pause', tried: true },
  ]);
});

const HOOK_FIX = 'the js-harness on the path is older than these entries: run js-harness upgrade, or install the newest copy (npm i -g --allow-git=all github:jsaristi/js-harness, or pnpm add -g github:jsaristi/js-harness where pnpm installed it), then run js-harness doctor again';

function findCheck(id) {
  const check = checks.find((c) => c.id === id);
  assert.ok(check, `expected a check record for ${id}`);
  return check;
}

/** Writes the manifest `install` leaves under `home`: one entry per hook command, its command at `entry.hooks[0]` as
 * install grafts it, and `skipped` for each index install could not write. */
function seedHookEntries(home, commands, { skipped = [] } = {}) {
  writeJson(path.join(home, '.js-harness', 'manifest.json'), {
    version: '0.1.0',
    files: [],
    entries: commands.map((command, i) => ({
      path: path.join(home, '.claude', 'settings.json'),
      pointer: ['hooks', 'SessionStart'],
      entry: { hooks: [{ type: 'command', command }] },
      sha256: 'not read here',
      createdFile: false,
      skipped: skipped.includes(i),
    })),
  });
}

/** A runner for the check: records each call as `{ file, argv, options }` and answers it with `answer(file, argv)`. */
function recordingRunner(answer) {
  const calls = [];
  const spawn = (file, argv, options) => {
    calls.push({ file, argv, options });
    return answer(file, argv);
  };
  return { spawn, calls };
}

/** Answers each call by the command it runs (`js-harness resume --pause`); a command not named answers as missing. */
function answering(byCommand) {
  return (file, argv) =>
    byCommand[[file, ...argv].join(' ')] ?? { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
}

/** The calls that run a `js-harness resume` command, as a command line. */
function resumeCalls(calls) {
  return calls.map((c) => [c.file, ...c.argv].join(' ')).filter((line) => line.startsWith('js-harness resume'));
}

/** The check's row, probed as `doctor` probes it. On `linux` a command is run as a file and its arguments. */
function hookRow(home, spawn, platform = 'linux') {
  return probeTool(findCheck('hook-commands'), { home, project: home, spawn, platform });
}

const ANSWER_0 = { status: 0, stdout: '', stderr: '' };

test('the hook commands check runs only in the interactive report, so the session-start report and the TUI start no copy', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook']);
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    assert.equal(probeStack({ home, project: home, spawn }).some((row) => row.id === 'hook-commands'), false);
    assert.deepEqual(resumeCalls(calls), []);
    assert.equal(probeStack({ home, project: home, spawn, interactive: true }).at(-2).id, 'hook-commands');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the hook commands check has nothing to try without a manifest: n/a, no gap, and no copy started', () => {
  const home = makeTmpHome();
  try {
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'n/a');
    assert.deepEqual(row.fix, {});
    assert.deepEqual(resumeCalls(calls), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the hook commands check is ok when every tried command exits 0, runs each once, and never runs the session-start report', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook', 'js-harness resume --pause || exit 0', 'js-harness doctor --hook', 'js-harness resume --hook']);
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'ok');
    assert.deepEqual(row.fix, {});
    assert.deepEqual(resumeCalls(calls), ['js-harness resume --hook', 'js-harness resume --pause']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an entry that install skipped was never written, so its command is not run', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook'], { skipped: [0] });
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'n/a');
    assert.deepEqual(resumeCalls(calls), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a tried command that does not exit 0 makes the check stale: each command says what it answered, and the fix line says to install the newest copy', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook', 'js-harness resume --pause || exit 0', 'js-harness doctor --hook']);
    const { spawn } = recordingRunner(
      answering({
        'js-harness resume --hook': ANSWER_0,
        'js-harness resume --pause': { status: 2, stdout: '', stderr: 'Unknown command: resume\nUsage: js-harness\n' },
      }),
    );
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'stale');
    assert.deepEqual(row.fix, {
      claude: [
        HOOK_FIX,
        'js-harness resume --hook: answered',
        'js-harness resume --pause: exit 2; stderr: Unknown command: resume',
        'js-harness doctor --hook: not tried',
      ],
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a tried command that cannot be started is a gap that says so', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --pause || exit 0']);
    const { spawn } = recordingRunner(answering({}));
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'stale');
    assert.deepEqual(row.fix, { claude: [HOOK_FIX, 'js-harness resume --pause: could not be started'] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a tried command that times out is a gap that says so', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --pause || exit 0']);
    const { spawn } = recordingRunner(() => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }));
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'stale');
    assert.deepEqual(row.fix, { claude: [HOOK_FIX, 'js-harness resume --pause: timed out after 5 seconds'] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a runner that throws leaves the check unknown, with no fix and nothing thrown out of the report', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook']);
    const { spawn } = recordingRunner(() => {
      throw new Error('spawn exploded');
    });
    const row = hookRow(home, spawn);
    assert.equal(row.claude, 'unknown');
    assert.deepEqual(row.fix, {});
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a manifest that does not parse leaves the check unknown, and no copy is started', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'manifest.json'), 'not json', 'utf8');
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    assert.equal(hookRow(home, spawn).claude, 'unknown');
    assert.deepEqual(resumeCalls(calls), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the runner gets empty standard input, five seconds, and a JS_HARNESS_HOME of its own under the temp folder, never the real home', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --hook']);
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    hookRow(home, spawn);
    const [{ options }] = calls;
    assert.equal(options.input, '');
    assert.equal(options.timeout, 5000);
    const probeHome = path.resolve(options.env.JS_HARNESS_HOME);
    assert.ok(probeHome.startsWith(path.resolve(os.tmpdir()) + path.sep), 'a folder under the system temp folder');
    assert.notEqual(probeHome, path.resolve(os.homedir()));
    assert.notEqual(probeHome, path.resolve(home));
    assert.equal(fs.existsSync(probeHome), false, 'a folder that does not exist');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('on Windows a tried command runs through a shell as one line, as the other probes run a .cmd shim', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --pause || exit 0']);
    const { spawn, calls } = recordingRunner(() => ANSWER_0);
    hookRow(home, spawn, 'win32');
    assert.deepEqual(calls.map((c) => [c.file, c.argv, c.options.shell]), [['js-harness resume --pause', [], true]]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the first line of standard error is cut to 160 characters', () => {
  const home = makeTmpHome();
  try {
    seedHookEntries(home, ['js-harness resume --pause || exit 0']);
    const { spawn } = recordingRunner(answering({ 'js-harness resume --pause': { status: 2, stdout: '', stderr: `${'x'.repeat(200)}\nsecond line` } }));
    assert.deepEqual(hookRow(home, spawn).fix, { claude: [HOOK_FIX, `js-harness resume --pause: exit 2; stderr: ${'x'.repeat(160)}`] });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
