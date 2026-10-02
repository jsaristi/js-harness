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

test('tools carries exactly the six stack tools, in Design-table order', () => {
  assert.deepEqual(
    tools.map((t) => t.id),
    ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex-plugin'],
  );
});

test('no tool ever recommends `codegraph upgrade` (user rule)', () => {
  for (const tool of tools) {
    for (const fix of Object.values(tool.fix({ project: '/some/project' }))) {
      for (const command of [fix].flat()) assert.doesNotMatch(command, /codegraph upgrade/);
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

test('codegraph project fix never prints a null or undefined root when no project resolved', () => {
  for (const project of [undefined, null, '']) {
    const fix = findTool('codegraph').fix({ project });
    assert.doesNotMatch(fix.project, /null|undefined|--cwd\s*$/);
    assert.match(fix.project, /^gentle-ai codegraph init --cwd <project root>$/);
  }
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

test('codex-plugin fix covers installed, claude, codex and upToDate with its own commands, and no project fix', () => {
  const fix = findTool('codex-plugin').fix({});
  assert.deepEqual(Object.keys(fix).sort(), ['claude', 'codex', 'installed', 'upToDate']);
  // A fix with more than one step is a list of commands run in order: no single separator works in
  // both `cmd.exe` (no `;`) and Windows PowerShell 5.1 (no `&&`).
  assert.deepEqual(fix.installed, [
    'claude plugin marketplace add openai/codex-plugin-cc',
    'claude plugin install codex@openai-codex',
  ]);
  assert.equal(fix.claude, 'claude plugin enable codex@openai-codex');
  assert.equal(fix.codex, 'codex login');
  assert.equal(fix.upToDate, 'claude plugin update codex@openai-codex');
});

test('gentle-ai upToDate fix is a two-step list, not one line joined by a separator', () => {
  assert.deepEqual(findTool('gentle-ai').fix({}).upToDate, ['gentle-ai upgrade', 'gentle-ai sync']);
});

test('gentle-ai upgrade fix goes through go install for the new module path when the latest crosses a major', () => {
  const { upToDateFix } = findTool('gentle-ai');
  assert.deepEqual(upToDateFix('3.7.0', '4.0.0'), [
    'go install github.com/gentleman-programming/gentle-ai/v4/cmd/gentle-ai@v4.0.0',
    'gentle-ai sync',
  ]);
  assert.deepEqual(upToDateFix('3.7.0', '5.2.1')[0], 'go install github.com/gentleman-programming/gentle-ai/v5/cmd/gentle-ai@v5.2.1');
});

test('gentle-ai upgrade fix builds the tag from the parsed semver, so a v-prefixed latest never prints @vv', () => {
  const { upToDateFix } = findTool('gentle-ai');
  assert.equal(
    upToDateFix('4.0.0', 'v5.0.0')[0],
    'go install github.com/gentleman-programming/gentle-ai/v5/cmd/gentle-ai@v5.0.0',
  );
});

test('gentle-ai upgrade fix is unchanged within a major and when a version is unknown or unparseable', () => {
  const { upToDateFix } = findTool('gentle-ai');
  const unchanged = ['gentle-ai upgrade', 'gentle-ai sync'];
  assert.deepEqual(upToDateFix('4.0.0', '4.1.0'), unchanged);
  assert.deepEqual(upToDateFix('3.7.0', null), unchanged);
  assert.deepEqual(upToDateFix(null, '4.0.0'), unchanged);
  assert.deepEqual(upToDateFix('3.7.0', 'not-a-version'), unchanged);
  assert.deepEqual(upToDateFix('4.0.0', '3.9.0'), unchanged);
});

test('no fix command string carries a shell separator (`;` or `&&`), and codegraph installed stays one string', () => {
  for (const tool of tools) {
    for (const fix of Object.values(tool.fix({ project: '/some/project' }))) {
      for (const command of [fix].flat()) assert.doesNotMatch(command, /;|&&/);
    }
  }
  assert.equal(typeof findTool('codegraph').fix({}).installed, 'string');
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

// --- installed + version: codex-plugin (same installed_plugins.json, its own plugin id) ---

test('codex-plugin reads its version from installed_plugins.json under codex@openai-codex', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }],
        'codex@openai-codex': [{ version: '1.0.6' }],
      },
    });
    assert.deepEqual(findTool('codex-plugin').installed({ home }), { state: 'ok', version: '1.0.6' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin is missing when installed_plugins.json has no codex@openai-codex entry, whatever else is installed', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }] },
    });
    assert.deepEqual(findTool('codex-plugin').installed({ home }), { state: 'missing', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin is missing when installed_plugins.json does not exist', () => {
  const home = makeTmpHome();
  try {
    assert.deepEqual(findTool('codex-plugin').installed({ home }), { state: 'missing', version: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin is unknown when installed_plugins.json is malformed', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'not json', 'utf8');
    assert.deepEqual(findTool('codex-plugin').installed({ home }), { state: 'unknown', version: null });
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

// --- gentle-ai: a host hook that runs a command `gentle-ai help` does not list is `stale` ---

// The shape of gentle-ai 4's `help`: a command line is indented by exactly two spaces, a
// continuation line deeper, and the USAGE section has two-space lines of its own.
const GENTLE_AI_HELP = [
  'USAGE',
  '  gentle-ai <command> [flags]',
  '',
  'COMMANDS',
  '  install      Configure AI coding agents on this machine',
  '  sync         Sync agent configs and skills to current version',
  '  skill-registry refresh',
  '               Refresh .atl/skill-registry.md with cache-hit fast path',
  '  review start [--cwd <repo>] [--base-ref <ref>]',
  '  review mode <enable|disable|status> [--cwd <repo>] [--scope <global|clone>]',
  '               User-owned kill switch; off wins',
  'COMPATIBILITY COMMANDS',
  '  review-start --cwd <repo> --lineage <id> --policy-file <path>',
  '  telemetry <status|enable|disable|preview|trigger> [--json]',
  '  doctor       Run ecosystem health diagnostics',
  '  version      Print version',
  '',
].join('\n');

const DEAD_HOOK = 'gentle-ai sdd-preflight-hook --agent claude-code';

/** A fake spawn that answers `gentle-ai help` and records every command line it was asked to run. */
function helpSpawn(help, calls = []) {
  return (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    return help;
  };
}

const helpOk = { status: 0, stdout: GENTLE_AI_HELP, stderr: '' };

/** A hooks config in the shape both hosts use: `hooks.<Event>[].hooks[].command`. */
function hooksConfig(events) {
  const hooks = {};
  for (const [event, commands] of Object.entries(events)) {
    hooks[event] = [{ matcher: '*', hooks: commands.map((command) => ({ type: 'command', command })) }];
  }
  return { hooks };
}

/** A fixture home with gentle-ai configured for both hosts and the given hooks files. */
function makeGentleAiHome({ claude, codex } = {}) {
  const home = makeTmpHome();
  writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });
  if (claude !== undefined) writeJson(path.join(home, '.claude', 'settings.json'), claude);
  if (codex !== undefined) writeJson(path.join(home, '.codex', 'hooks.json'), codex);
  return home;
}

test('a dead gentle-ai hook in Claude settings makes the claude cell stale and the fix names hook, event and file', () => {
  const home = makeGentleAiHome({
    claude: hooksConfig({ PreToolUse: [DEAD_HOOK], SessionStart: ['gentle-ai sync'] }),
    codex: hooksConfig({ SessionStart: ['gentle-ai sync'] }),
  });
  try {
    const tool = findTool('gentle-ai');
    const configured = tool.configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.equal(configured.claude, 'stale');
    assert.equal(configured.codex, 'ok');
    const fix = tool.fix({}, configured);
    assert.equal(fix.claude.length, 1);
    assert.match(fix.claude[0], /^remove the hook "gentle-ai sdd-preflight-hook --agent claude-code" \(PreToolUse\)/);
    assert.match(fix.claude[0], /from ~\/\.claude\/settings\.json: /);
    assert.match(fix.claude[0], /"gentle-ai help" lists no "sdd-preflight-hook" command/);
    assert.equal(fix.codex, 'gentle-ai install');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a dead gentle-ai hook in Codex hooks.json makes the codex cell stale and leaves claude alone', () => {
  const home = makeGentleAiHome({
    claude: hooksConfig({ SessionStart: ['gentle-ai sync'] }),
    codex: hooksConfig({ Stop: ['gentle-ai sdd-preflight-hook --agent codex'] }),
  });
  try {
    const tool = findTool('gentle-ai');
    const configured = tool.configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.equal(configured.claude, 'ok');
    assert.equal(configured.codex, 'stale');
    const fix = tool.fix({}, configured);
    assert.match(fix.codex[0], /^remove the hook "gentle-ai sdd-preflight-hook --agent codex" \(Stop\)/);
    assert.match(fix.codex[0], /from ~\/\.codex\/hooks\.json: /);
    assert.equal(fix.claude, 'gentle-ai install');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('each dead hook gets its own fix line, and a live hook next to a dead one is not listed', () => {
  const home = makeGentleAiHome({
    claude: hooksConfig({
      PreToolUse: [DEAD_HOOK, 'gentle-ai sync'],
      PostToolUse: ['gentle-ai sdd-status-hook'],
    }),
  });
  try {
    const tool = findTool('gentle-ai');
    const configured = tool.configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    const fix = tool.fix({}, configured);
    assert.equal(fix.claude.length, 2);
    assert.ok(fix.claude.every((line) => !line.includes('"gentle-ai sync"')));
    assert.match(fix.claude[1], /\(PostToolUse\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a wrapped or .exe gentle-ai call counts, so a dead one inside a wrapper is stale', () => {
  const wrapped = `powershell -Command 'Write-Host hi; ${DEAD_HOOK} --quiet'`;
  for (const command of [wrapped, '"C:\\Users\\x\\go\\bin\\gentle-ai.exe" sdd-preflight-hook']) {
    const home = makeGentleAiHome({ claude: hooksConfig({ PreToolUse: [command] }) });
    try {
      const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
      assert.equal(configured.claude, 'stale', command);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

test('a wrapped call to a listed gentle-ai command, or a listed multi-word command, is not stale', () => {
  const commands = [
    "powershell -Command '$ErrorActionPreference = \"Stop\"; gentle-ai skill-registry refresh --quiet --cwd .'",
    '"C:\\Users\\x\\go\\bin\\gentle-ai.exe" skill-registry refresh',
    'gentle-ai review stop-hook',
    'gentle-ai telemetry runtime claude --json',
    'cat ~/.gentle-ai/state.json',
  ];
  const home = makeGentleAiHome({ claude: hooksConfig({ SessionStart: commands }) });
  try {
    const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.deepEqual(configured, { claude: 'ok', codex: 'ok' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('gentle-ai stays as it is when `gentle-ai help` cannot be read: no help, no claim', () => {
  const failures = [
    { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' },
    { status: 1, stdout: GENTLE_AI_HELP, stderr: 'boom' },
    { status: null, signal: 'SIGTERM', stdout: '', stderr: '' },
    { status: 0, stdout: 'no command lines here\n', stderr: '' },
    { status: 0, stdout: '', stderr: '' },
  ];
  const home = makeGentleAiHome({ claude: hooksConfig({ PreToolUse: [DEAD_HOOK] }) });
  try {
    for (const failure of failures) {
      const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(failure), platform: 'linux' });
      assert.deepEqual(configured, { claude: 'ok', codex: 'ok' });
    }
    const throwing = () => {
      throw new Error('spawn blew up');
    };
    assert.equal(findTool('gentle-ai').configured({ home, spawn: throwing, platform: 'linux' }).claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a malformed or missing hooks file never makes a gentle-ai cell stale', () => {
  const home = makeGentleAiHome();
  try {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{ nope', 'utf8');
    const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.deepEqual(configured, { claude: 'ok', codex: 'ok' });
    // A well-formed file of the wrong shape contributes nothing either.
    writeJson(path.join(home, '.claude', 'settings.json'), { hooks: { PreToolUse: 'nope', Stop: [{ hooks: [null, 3] }] } });
    assert.deepEqual(
      findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' }),
      { claude: 'ok', codex: 'ok' },
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('help that is only partly understood makes no claim: no command found in a COMMANDS section, no stale host', () => {
  const usageOnly = ['USAGE', '  gentle-ai <command> [flags]', ''].join('\n');
  // The COMMANDS section is indented differently, so none of its lines parse as command lines.
  const reindented = ['USAGE', '  gentle-ai <command> [flags]', '', 'COMMANDS', '    sync     Sync', '    review stop-hook', ''].join('\n');
  const home = makeGentleAiHome({
    claude: hooksConfig({ SessionStart: ['gentle-ai review stop-hook', 'gentle-ai telemetry runtime claude --json'] }),
    codex: hooksConfig({ Stop: [DEAD_HOOK] }),
  });
  try {
    for (const stdout of [usageOnly, reindented]) {
      const spawn = helpSpawn({ status: 0, stdout, stderr: '' });
      const configured = findTool('gentle-ai').configured({ home, spawn, platform: 'linux' });
      assert.deepEqual(configured, { claude: 'ok', codex: 'ok' });
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('commands are read from every section whose header names COMMANDS, and from no other', () => {
  const home = makeGentleAiHome({
    claude: hooksConfig({ SessionStart: ['gentle-ai review-start --cwd .', 'gentle-ai flags-only'] }),
  });
  const help = ['USAGE', '  gentle-ai <command> [flags]', '', 'FLAGS', '  flags-only  not a command', ''].join('\n');
  try {
    // review-start sits under COMPATIBILITY COMMANDS in the shared help; `flags-only` under FLAGS.
    const spawn = helpSpawn({ status: 0, stdout: `${GENTLE_AI_HELP}\n${help}`, stderr: '' });
    const tool = findTool('gentle-ai');
    const configured = tool.configured({ home, spawn, platform: 'linux' });
    assert.equal(configured.claude, 'stale');
    const fix = tool.fix({}, configured);
    assert.equal(fix.claude.length, 1);
    assert.match(fix.claude[0], /lists no "flags-only" command/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a longer name that ends in gentle-ai is not a gentle-ai call, but the binary by full path is', () => {
  const longer = ['my-gentle-ai sdd-preflight-hook', 'not-gentle-ai sdd-preflight-hook', 'x_gentle-ai sdd-preflight-hook'];
  const home = makeGentleAiHome({ claude: hooksConfig({ SessionStart: longer }) });
  try {
    const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.deepEqual(configured, { claude: 'ok', codex: 'ok' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  const byPath = ['C:\\Users\\x\\go\\bin\\gentle-ai.exe sdd-preflight-hook', '/home/x/go/bin/gentle-ai sdd-preflight-hook'];
  for (const command of byPath) {
    const pathHome = makeGentleAiHome({ claude: hooksConfig({ SessionStart: [command] }) });
    try {
      const configured = findTool('gentle-ai').configured({ home: pathHome, spawn: helpSpawn(helpOk), platform: 'linux' });
      assert.equal(configured.claude, 'stale', command);
    } finally {
      fs.rmSync(pathHome, { recursive: true, force: true });
    }
  }
});

test('a gentle-ai call is detected only where a command can start', () => {
  const stale = [
    'gentle-ai sdd-preflight-hook --agent claude-code',
    '"C:\\Users\\x\\go\\bin\\gentle-ai.exe" sdd-preflight-hook',
    '/home/x/go/bin/gentle-ai sdd-preflight-hook',
    "powershell -NoProfile -Command 'if ($x) { $d = 1 }; gentle-ai sdd-preflight-hook --quiet; exit 0'",
    'bash -c "gentle-ai sdd-preflight-hook"',
    'cd repo && gentle-ai sdd-preflight-hook',
    'true || gentle-ai sdd-preflight-hook',
    'echo hi | gentle-ai sdd-preflight-hook',
    'echo hi\ngentle-ai sdd-preflight-hook',
  ];
  const unclassified = [
    'echo "gentle-ai sdd-preflight-hook was retired"',
    'echo gentle-ai sdd-preflight-hook',
    'my-gentle-ai sdd-preflight-hook',
    "powershell -NoProfile -Command 'if (Test-Path env:CLAUDE_PROJECT_DIR) { $dir = $env:CLAUDE_PROJECT_DIR } else { $dir = $PWD }; gentle-ai skill-registry refresh --quiet --no-gitignore --cwd \"$dir\"; exit 0'",
  ];
  const home = makeGentleAiHome({ claude: hooksConfig({ SessionStart: [] }) });
  try {
    const tool = findTool('gentle-ai');
    for (const [commands, expected] of [[stale, 'stale'], [unclassified, 'ok']]) {
      for (const command of commands) {
        writeJson(path.join(home, '.claude', 'settings.json'), hooksConfig({ SessionStart: [command] }));
        const configured = tool.configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
        assert.equal(configured.claude, expected, command);
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a host that is not configured stays missing even when its hooks file has a dead hook', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['codex'] });
    writeJson(path.join(home, '.claude', 'settings.json'), hooksConfig({ PreToolUse: [DEAD_HOOK] }));
    const configured = findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk), platform: 'linux' });
    assert.deepEqual(configured, { claude: 'missing', codex: 'ok' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the only command run is `gentle-ai help`, and only when a hook calls gentle-ai', () => {
  const home = makeGentleAiHome({ claude: hooksConfig({ PreToolUse: [DEAD_HOOK] }) });
  const quietHome = makeGentleAiHome({ claude: hooksConfig({ SessionStart: ['echo hello'] }) });
  try {
    const calls = [];
    findTool('gentle-ai').configured({ home, spawn: helpSpawn(helpOk, calls), platform: 'linux' });
    assert.deepEqual(calls, ['gentle-ai help']);

    const quietCalls = [];
    findTool('gentle-ai').configured({ home: quietHome, spawn: helpSpawn(helpOk, quietCalls), platform: 'linux' });
    assert.deepEqual(quietCalls, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(quietHome, { recursive: true, force: true });
  }
});

test('probeTool puts stale in the row and keeps the internal hook list out of it', () => {
  const home = makeGentleAiHome({ claude: hooksConfig({ PreToolUse: [DEAD_HOOK] }) });
  try {
    const spawn = (cmd, args) =>
      [cmd, ...args].join(' ') === 'gentle-ai help' ? helpOk : { status: 0, stdout: 'gentle-ai 4.0.0', stderr: '' };
    const row = probeTool(findTool('gentle-ai'), { home, project: home, spawn, platform: 'linux' });
    assert.equal(row.claude, 'stale');
    assert.equal(row.codex, 'ok');
    assert.equal(row.staleHooks, undefined);
    assert.equal(row.fix.claude.length, 1);
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

// --- configured per host: codex-plugin (enabled in Claude Code; "logged in" on the Codex side) ---

/** A fake spawn recording every call, answering the `codex login status` probe with `result`. */
function loginSpawn(result, calls = []) {
  return (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return result;
  };
}

/** A fixture home with the Codex plugin installed: the login probe only runs for an installed plugin. */
function makeCodexHome() {
  const home = makeTmpHome();
  writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    plugins: { 'codex@openai-codex': [{ version: '1.0.6' }] },
  });
  return home;
}

test('codex-plugin claude is ok when settings.json enables codex@openai-codex', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'settings.json'), { enabledPlugins: { 'codex@openai-codex': true } });
    const configured = findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }) });
    assert.equal(configured.claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin claude is missing when it is disabled or only another plugin is enabled', () => {
  const home = makeTmpHome();
  try {
    writeJson(path.join(home, '.claude', 'settings.json'), {
      enabledPlugins: { 'codex@openai-codex': false, 'typescript-lsp@claude-plugins-official': true },
    });
    const configured = findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }) });
    assert.equal(configured.claude, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin codex is ok when `codex login status` exits 0', () => {
  const home = makeCodexHome();
  try {
    const configured = findTool('codex-plugin').configured({
      home,
      spawn: loginSpawn({ status: 0, stdout: 'Logged in using ChatGPT\n', stderr: '' }),
    });
    assert.equal(configured.codex, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin codex is missing when `codex login status` exits non-zero (not logged in)', () => {
  const home = makeCodexHome();
  try {
    const configured = findTool('codex-plugin').configured({
      home,
      spawn: loginSpawn({ status: 1, stdout: '', stderr: 'Not logged in' }),
    });
    assert.equal(configured.codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin codex is unknown when the login probe is killed by a timeout signal', () => {
  const home = makeCodexHome();
  try {
    const configured = findTool('codex-plugin').configured({
      home,
      spawn: loginSpawn({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
    });
    assert.equal(configured.codex, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin codex is unknown when the login probe result carries an ETIMEDOUT error', () => {
  const home = makeCodexHome();
  try {
    const error = new Error('spawnSync codex ETIMEDOUT');
    error.code = 'ETIMEDOUT';
    const configured = findTool('codex-plugin').configured({
      home,
      spawn: loginSpawn({ status: null, error, stdout: '', stderr: '' }),
    });
    assert.equal(configured.codex, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin codex is missing when codex is not on PATH (ENOENT) or the spawn throws', () => {
  const home = makeCodexHome();
  try {
    const tool = findTool('codex-plugin');
    assert.equal(tool.configured({ home, spawn: fakeSpawnMissing() }).codex, 'missing');
    const throwing = () => {
      throw new Error('spawn blew up');
    };
    assert.equal(tool.configured({ home, spawn: throwing }).codex, 'missing');
    assert.equal(tool.configured({ home, spawn: () => undefined }).codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login probe points CODEX_HOME at <home>/.codex and keeps the rest of the environment', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }, calls), platform: 'linux' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.env.CODEX_HOME, path.join(home, '.codex'));
    assert.equal(calls[0].opts.env.PATH ?? calls[0].opts.env.Path, process.env.PATH ?? process.env.Path);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login probe passes the 5000ms timeout, and no env is added to the version probes', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }, calls) });
    assert.equal(calls[0].opts.timeout, 5000);

    const versionCalls = [];
    findTool('gentle-ai').installed({ spawn: loginSpawn({ status: 0, stdout: '3.7.0' }, versionCalls) });
    assert.equal('env' in versionCalls[0].opts, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login probe is one shell command line with no args array on win32, an args array elsewhere', () => {
  const home = makeCodexHome();
  try {
    const win = [];
    findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }, win), platform: 'win32' });
    assert.equal(win[0].cmd, 'codex login status');
    assert.deepEqual(win[0].args, []);
    assert.equal(win[0].opts.shell, true);

    const posix = [];
    findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }, posix), platform: 'linux' });
    assert.equal(posix[0].cmd, 'codex');
    assert.deepEqual(posix[0].args, ['login', 'status']);
    assert.equal(posix[0].opts.shell, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login answer comes only from the probe, never from an auth.json in the Codex home', () => {
  const home = makeCodexHome();
  try {
    writeJson(path.join(home, '.codex', 'auth.json'), { tokens: { access_token: 'sentinel-secret' } });
    const configured = findTool('codex-plugin').configured({ home, spawn: loginSpawn({ status: 1, stdout: '' }) });
    assert.equal(configured.codex, 'missing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T6d (Codex P2): when the login probe fails, `codex --version` tells a missing Codex CLI from a
// logged-out one. The `codex` cell is `missing` either way; only the fix differs. ---

/** A fake spawn answering per command line (`codex login status`, `codex --version`), recording each. */
function commandSpawn(answers, calls = []) {
  return (cmd, args, opts) => {
    const line = [cmd, ...args].join(' ');
    calls.push({ line, opts });
    return answers[line] ?? { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

const LOGGED_OUT = { status: 1, stdout: '', stderr: 'Not logged in' };
const CLI_VERSION = { status: 0, stdout: 'codex-cli 0.130.0\n', stderr: '' };

test('a healthy login probe never spawns codex --version', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex login status': { status: 0, stdout: 'Logged in\n' } }, calls);
    const configured = findTool('codex-plugin').configured({ home, spawn, platform: 'linux' });
    assert.equal(configured.codex, 'ok');
    assert.deepEqual(calls.map((c) => c.line), ['codex login status']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a timed-out login probe does not spawn codex --version either', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex login status': { status: null, signal: 'SIGTERM', stdout: '' } }, calls);
    assert.equal(findTool('codex-plugin').configured({ home, spawn, platform: 'linux' }).codex, 'unknown');
    assert.deepEqual(calls.map((c) => c.line), ['codex login status']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a failed login with a working Codex CLI is logged out: codex missing, fix is just `codex login`', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex login status': LOGGED_OUT, 'codex --version': CLI_VERSION }, calls);
    const tool = findTool('codex-plugin');
    const configured = tool.configured({ home, spawn, platform: 'linux' });
    assert.equal(configured.codex, 'missing');
    assert.equal(configured.codexCli, 'ok');
    assert.deepEqual(calls.map((c) => c.line), ['codex login status', 'codex --version']);
    assert.equal(tool.fix({}, configured).codex, 'codex login');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a failed login with no Codex CLI is a missing CLI: codex missing, fix installs it first', () => {
  const home = makeCodexHome();
  try {
    const tool = findTool('codex-plugin');
    for (const spawn of [
      commandSpawn({ 'codex login status': LOGGED_OUT, 'codex --version': { status: 1, stdout: '' } }),
      commandSpawn({}),
      () => {
        throw new Error('spawn blew up');
      },
    ]) {
      const configured = tool.configured({ home, spawn, platform: 'linux' });
      assert.equal(configured.codex, 'missing');
      assert.equal(configured.codexCli, 'missing');
      assert.deepEqual(tool.fix({}, configured).codex, ['npm i -g @openai/codex', 'codex login']);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the codex --version probe reuses the login probe\'s CODEX_HOME, timeout and win32 shell form', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex login status': LOGGED_OUT, 'codex --version': CLI_VERSION }, calls);
    findTool('codex-plugin').configured({ home, spawn, platform: 'linux', env: {}, homedir: path.join(home, 'x') });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].opts.env.CODEX_HOME, path.join(home, '.codex'));
    assert.equal(calls[1].opts.timeout, 5000);

    const win = [];
    const winSpawn = (cmd, args, opts) => {
      win.push({ cmd, args, opts });
      return cmd === 'codex --version' ? CLI_VERSION : LOGGED_OUT;
    };
    findTool('codex-plugin').configured({ home, spawn: winSpawn, platform: 'win32' });
    assert.deepEqual(win.map((c) => [c.cmd, c.args, c.opts.shell]), [
      ['codex login status', [], true],
      ['codex --version', [], true],
    ]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a kept user CODEX_HOME applies to the codex --version probe too', () => {
  const home = makeCodexHome();
  try {
    const calls = [];
    const spawn = commandSpawn({ 'codex login status': LOGGED_OUT, 'codex --version': CLI_VERSION }, calls);
    findTool('codex-plugin').configured({ home, spawn, platform: 'linux', env: { CODEX_HOME: '/own' }, homedir: home });
    assert.equal(calls.length, 2);
    for (const call of calls) assert.equal('env' in call.opts, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('probeTool hands the probed result to fix and keeps the internal codexCli field out of the row', () => {
  const home = makeCodexHome();
  const project = makeTmpHome('js-harness-stack-project5-');
  try {
    writeJson(path.join(home, '.claude', 'settings.json'), { enabledPlugins: { 'codex@openai-codex': true } });
    const spawn = commandSpawn({ 'codex login status': LOGGED_OUT });
    const row = probeTool(findTool('codex-plugin'), { home, project, spawn, platform: 'linux' });
    assert.equal(row.codex, 'missing');
    assert.equal('codexCli' in row, false);
    assert.deepEqual(row.fix.codex, ['npm i -g @openai/codex', 'codex login']);

    const loggedOut = commandSpawn({ 'codex login status': LOGGED_OUT, 'codex --version': CLI_VERSION });
    const other = probeTool(findTool('codex-plugin'), { home, project, spawn: loggedOut, platform: 'linux' });
    assert.equal(other.fix.codex, 'codex login');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('every other tool ignores fix\'s second argument', () => {
  for (const tool of tools.filter((t) => t.id !== 'codex-plugin')) {
    assert.deepEqual(tool.fix({ project: '/p' }, { codexCli: 'missing' }), tool.fix({ project: '/p' }));
  }
});

// R3-login-probe-runs-when-plugin-absent (accepted T6 review follow-up): no plugin, nothing to be
// logged in for — the `codex` cell is `n/a` and `codex login status` is never spawned.
test('codex-plugin codex is n/a and the login probe never spawns when the plugin is not installed', () => {
  const tool = findTool('codex-plugin');
  const cases = {
    'no installed_plugins.json': () => {},
    'no codex entry': (home) =>
      writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
        plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }] },
      }),
    'malformed installed_plugins.json': (home) => {
      fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
      fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'not json', 'utf8');
    },
  };
  for (const [label, seed] of Object.entries(cases)) {
    const home = makeTmpHome();
    try {
      seed(home);
      const calls = [];
      const configured = tool.configured({ home, spawn: loginSpawn({ status: 0, stdout: '' }, calls) });
      assert.equal(configured.codex, 'n/a', label);
      assert.equal(calls.length, 0, `${label}: codex login status must not be spawned`);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
});

// --- R3-codex-home-overrides-user-env (accepted T6 review follow-up): a `CODEX_HOME` the user
// already set is kept when `home` is the real home. `env` and `homedir` are injectable so no test
// ever touches `process.env`. The MCP probes still read `<home>/.codex` regardless — a pre-existing
// gap, out of scope here. ---

function loginEnvFor({ home, env, homedir, platform = 'linux' }) {
  const calls = [];
  findTool('codex-plugin').configured({ home, env, homedir, platform, spawn: loginSpawn({ status: 0, stdout: '' }, calls) });
  assert.equal(calls.length, 1);
  return calls[0].opts;
}

test('codex-plugin login probe keeps a CODEX_HOME the user set when home is the real home', () => {
  const home = makeCodexHome();
  try {
    const opts = loginEnvFor({ home, env: { CODEX_HOME: '/users/own/codex' }, homedir: home });
    assert.equal('env' in opts, false, 'the child must inherit the user\'s own CODEX_HOME untouched');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login probe overrides CODEX_HOME when home is not the real home', () => {
  const home = makeCodexHome();
  try {
    const opts = loginEnvFor({ home, env: { CODEX_HOME: '/users/own/codex' }, homedir: path.join(home, 'elsewhere') });
    assert.equal(opts.env.CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('codex-plugin login probe sets <home>/.codex on the real home when the user has no CODEX_HOME', () => {
  const home = makeCodexHome();
  try {
    const opts = loginEnvFor({ home, env: {}, homedir: home });
    assert.equal(opts.env.CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('the real-home comparison ignores case on win32 only', () => {
  const home = makeCodexHome();
  try {
    // Same directory, differing only in case (the tmp path always has lowercase letters).
    const homedir = home.toUpperCase();
    const env = { CODEX_HOME: '/users/own/codex' };
    assert.equal('env' in loginEnvFor({ home, env, homedir, platform: 'win32' }), false);
    assert.equal(loginEnvFor({ home, env, homedir, platform: 'linux' }).env.CODEX_HOME, path.join(home, '.codex'));
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
  for (const id of ['gentle-ai', 'engram', 'context7', 'typescript-lsp', 'codex-plugin']) {
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
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex-plugin'],
    );
    for (const row of rows) assert.equal(row.upToDate, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
