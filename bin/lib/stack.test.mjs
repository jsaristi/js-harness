import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tools, resolveProjectRoot, probeTool, probeStack } from './stack.mjs';

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

test('tools carries exactly the five stack tools, in Design-table order', () => {
  assert.deepEqual(
    tools.map((t) => t.id),
    ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp'],
  );
});

test('no tool ever recommends `codegraph upgrade` (user rule)', () => {
  for (const tool of tools) {
    for (const fix of Object.values(tool.fix({ project: '/some/project' }))) {
      assert.doesNotMatch(fix, /codegraph upgrade/);
    }
  }
});

// --- per-dimension fix maps ---

test('gentle-ai fix covers installed, claude, codex and upToDate but not project', () => {
  const fix = findTool('gentle-ai').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'upToDate']);
});

test('engram fix covers installed, claude, codex and upToDate but not project', () => {
  const fix = findTool('engram').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'upToDate']);
});

test('codegraph fix covers all five dimensions, and its project fix carries the resolved project root', () => {
  const fix = findTool('codegraph').fix({ project: 'D:/some/resolved/root' });
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'project', 'upToDate']);
  assert.match(fix.project, /D:\/some\/resolved\/root/);
  assert.doesNotMatch(fix.installed, /codegraph upgrade/);
});

test('codegraph registers Claude and Codex through their own mcp add commands, not the npm install', () => {
  const fix = findTool('codegraph').fix({ project: '/root' });
  assert.match(fix.claude, /^claude mcp add /);
  assert.match(fix.codex, /^codex mcp add /);
});

test('context7 fix covers claude, codex and upToDate but has no installed or project fix', () => {
  const fix = findTool('context7').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'upToDate']);
});

test('typescript-lsp fix covers installed, claude and upToDate but has no codex or project fix', () => {
  const fix = findTool('typescript-lsp').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'installed', 'upToDate']);
});

// --- installed + version: version-command tools (gentle-ai, engram, codegraph) ---

test('a version-command tool reports ok + the first semver on a zero exit', () => {
  const tool = findTool('gentle-ai');
  const result = tool.installed({ spawn: fakeSpawnOk('gentle-ai 3.7.0\n') });
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
  const tool = findTool('gentle-ai');
  const result = tool.installed({ spawn: fakeSpawnOk('not a version') });
  assert.deepEqual(result, { state: 'unknown', version: null });
});

test('a version-command tool spawns through a shell on win32 (npm .cmd shims)', () => {
  const tool = findTool('codegraph');
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { status: 0, stdout: '1.6.0', stderr: '' };
  };
  tool.installed({ spawn, platform: 'win32' });
  assert.equal(calls[0].cmd, 'codegraph');
  assert.deepEqual(calls[0].args, ['--version']);
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
  const tool = findTool('gentle-ai');
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

// --- configured per host ---

test('gentle-ai reads configured per host from ~/.gentle-ai/state.json installed_agents', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code'] });
    const tool = findTool('gentle-ai');
    assert.deepEqual(tool.configured({ home }), { claude: 'ok', codex: 'missing' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('gentle-ai configured is missing for both hosts when state.json does not exist', () => {
  const home = makeTmpHome();
  try {
    const tool = findTool('gentle-ai');
    assert.deepEqual(tool.configured({ home }), { claude: 'missing', codex: 'missing' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

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
  for (const id of ['gentle-ai', 'engram', 'context7', 'typescript-lsp']) {
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
    writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });
    const tool = findTool('gentle-ai');
    const deps = { home, project, spawn: fakeSpawnOk('gentle-ai 3.7.0') };
    const row = probeTool(tool, deps);
    assert.deepEqual(row, {
      id: 'gentle-ai',
      version: '3.7.0',
      installed: 'ok',
      claude: 'ok',
      codex: 'ok',
      project: 'n/a',
      upToDate: 'unknown',
      fix: tool.fix(deps),
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('probeStack returns one row per tool, in order, never throwing on an empty home', () => {
  const home = makeTmpHome();
  const project = makeTmpHome('js-harness-stack-project4-');
  try {
    const rows = probeStack({ home, project, spawn: fakeSpawnMissing() });
    assert.deepEqual(
      rows.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp'],
    );
    for (const row of rows) assert.equal(row.upToDate, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
