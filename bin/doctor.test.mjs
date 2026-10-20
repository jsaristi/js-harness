import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain, resolveLatestVersions } from './doctor.mjs';
import { readCache, writeCache } from './lib/cache.mjs';
import { recordOptionalFile } from './lib/manifest.mjs';
import { launcherFileName, loginLauncher, remoteFiles, remoteId } from './lib/remote.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { unseenToClear } from './unseen.mjs';
import { MAIN_LIST_URL } from './lib/rules-installed.mjs';
import { RULES } from './lib/rules-data.mjs';
import { shippedRulesHash, writeRules } from './lib/rules.mjs';

// T2 introduces a real default `fetch` for latest-version lookups. Every test below that does not
// specifically exercise the network path injects this instead, so the suite never depends on
// internet access — a failed fetch is itself a valid, tested outcome (`upToDate: 'unknown'`).
const noopFetch = async () => {
  throw new Error('network disabled in tests');
};

// Every looked-up tool but gentle-ai, cached as "looked up, nothing found": a fresh cache with a key
// for every row (a `null` counts as present) is what "nothing left to refetch" looks like.
const NULL_VERSIONS = { engram: null, codegraph: null, context7: null, 'typescript-lsp': null, codex: null };

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-doctor-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** A fully "healthy" fixture home: every tool installed and configured everywhere it applies. */
function seedHealthyHome(home) {
  writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });
  writeJson(path.join(home, '.claude.json'), {
    mcpServers: {
      engram: { command: 'engram' },
      codegraph: { command: 'codegraph' },
      context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
    },
  });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.codex', 'config.toml'),
    '[mcp_servers.engram]\ncommand = "engram"\n\n[mcp_servers.codegraph]\ncommand = "codegraph"\n\n' +
      '[mcp_servers.context7]\nurl = "x"\n',
    'utf8',
  );
  writeJson(path.join(home, '.claude', 'settings.json'), {
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': true },
  });
  writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }] },
  });
}

/** A fake spawn: resolves `git rev-parse --show-toplevel` to `gitToplevel` (or fails, as a real
 * one would outside a repo), `git ls-files` to `lsFiles` (NUL-separated names) when given, and any
 * version command named in `versions` to its stdout. The Codex CLI per `codexLogin`: `'in'`, `'out'`
 * and `'timeout'` have it installed (`codex --version` answers 0.130.0); `'in'` logs in (exit 0),
 * `'out'` exits 1, `'timeout'` is killed by a signal, and `'no-cli'` has no CLI at all. Anything else
 * looks like a missing binary — never a real spawn, never the network. Every login probe's `env`
 * lands in `loginEnvs`, so a test can see which Codex home it read. */
function fakeSpawn({ versions = {}, gitToplevel, lsFiles, codexLogin, loginEnvs = [] } = {}) {
  return (cmd, args, opts) => {
    if (cmd === 'git' && args[0] === 'rev-parse') {
      return gitToplevel
        ? { status: 0, stdout: `${gitToplevel}\n`, stderr: '' }
        : { status: 128, stdout: '', stderr: 'not a git repository' };
    }
    if (cmd === 'git' && args[0] === 'ls-files' && lsFiles !== undefined) {
      return { status: 0, stdout: lsFiles, stderr: '' };
    }
    const line = [cmd, ...args].join(' ');
    if (line === 'codex --version' && codexLogin && codexLogin !== 'no-cli') {
      return { status: 0, stdout: 'codex-cli 0.130.0\n', stderr: '' };
    }
    if (line === 'codex login status') {
      loginEnvs.push(opts?.env);
      if (codexLogin === 'in') return { status: 0, stdout: 'Logged in using ChatGPT\n', stderr: '' };
      if (codexLogin === 'out' || codexLogin === 'no-cli') return { status: 1, stdout: '', stderr: 'Not logged in' };
      if (codexLogin === 'timeout') return { status: null, signal: 'SIGTERM', stdout: '', stderr: '' };
    }
    // On win32 a probe arrives as one shell command line ("codegraph --version"), so match its binary.
    const binary = cmd.split(' ')[0];
    if (versions[binary]) return { status: 0, stdout: versions[binary], stderr: '' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

/** Runs `doctorMain`, capturing everything it printed via console.log and the exit code. */
async function runDoctor(argv, env, deps) {
  let output = '';
  const original = console.log;
  console.log = (line) => {
    output += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, env, deps);
    return { code, output };
  } finally {
    console.log = original;
  }
}

test('doctorMain prints one line per tool and exits 0 on a fully healthy fixture', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
      gitToplevel: project,
      codexLogin: 'in',
    });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    for (const id of ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex']) {
      assert.match(output, new RegExp(id));
    }
    assert.match(output, /codex\s+0\.130\.0\s+n\/a\s+ok\s+n\/a/);
    assert.match(output, /3\.7\.0/);
    assert.match(output, /hosted/);
    assert.doesNotMatch(output, /\nFix:/, 'a fully healthy fixture must report no gaps');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("doctorMain --json prints a parseable array with the six tool ids, then the checks, then the harness's own row, and upToDate unknown (or n/a where there is no version to compare)", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp', 'codex', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'hook-commands', 'pnpm-lock', 'js-harness'],
    );
    for (const row of rows) {
      // Network is disabled and there is no cache, so every real lookup fails open to `unknown` —
      // except hosted context7 and the two checks, which have no version of their own to compare
      // and are `n/a` instead. The harness's own row could not read main's list either: `unknown`.
      assert.equal(row.upToDate, ['context7', 'memory-rules', 'session-classes', 'claude-account', 'remote-server', 'hook-commands', 'pnpm-lock'].includes(row.id) ? 'n/a' : 'unknown');
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// odd/tasks/engram-plugin-lag.md: the engram binary at 3.5.1 and its Claude plugin at 0.1.12, while the v3.5.1 tag in
// Claude Code's clone of the engram marketplace ships 0.1.14. `git show` is the fake `git` runner's, never a real clone.
function seedEngramPluginLag(home, { gitShow }) {
  writeJson(path.join(home, '.claude', 'settings.json'), {
    enabledPlugins: { 'typescript-lsp@claude-plugins-official': true, 'engram@engram': true },
  });
  writeJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), {
    plugins: { 'typescript-lsp@claude-plugins-official': [{ version: '1.0.0' }], 'engram@engram': [{ version: '0.1.12' }] },
  });
  fs.mkdirSync(path.join(home, '.claude', 'plugins', 'marketplaces', 'engram', '.git'), { recursive: true });
  const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 3.5.1' } });
  const shown = [];
  const git = async (args) => {
    shown.push(args[3]);
    return gitShow(args[3]);
  };
  return { spawn, git, shown };
}

test('doctorMain --offline shows the engram plugin outdated against the plugin the engram binary\'s tag ships, with both versions in its fix', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const manifest = JSON.stringify({ plugins: [{ name: 'engram', version: '0.1.14' }] });
    const { spawn, git, shown } = seedEngramPluginLag(home, {
      gitShow: (spec) => (spec === 'v3.5.1:.claude-plugin/marketplace.json' ? { status: 0, stdout: manifest, stderr: '' } : { status: 128, stdout: '', stderr: 'bad revision' }),
    });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--offline'], {}, { spawn, git, fetch: noopFetch });

    assert.equal(code, 0);
    assert.deepEqual(shown, ['v3.5.1:.claude-plugin/marketplace.json']);
    assert.match(output, /\nengram\s+3\.5\.1\s+ok\s+ok\s+n\/a\s+unknown\n/);
    assert.match(output, /\nengram-plugin\s+0\.1\.12\s+ok\s+n\/a\s+n\/a\s+outdated\n/);
    assert.match(
      output,
      / {2}engram-plugin \(upToDate\):\n {4}plugin 0\.1\.12 is behind 0\.1\.14, the plugin engram v3\.5\.1 ships; update it, then restart Claude Code:\n {4}claude plugin marketplace update engram\n {4}claude plugin update engram@engram\n/,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain fails open to unknown for the engram plugin when the clone cannot answer, and shows no gap for it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const { spawn, git } = seedEngramPluginLag(home, { gitShow: () => ({ status: null, error: new Error('spawn git ENOENT'), stdout: '', stderr: '' }) });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--offline', '--json'], {}, { spawn, git, fetch: noopFetch });

    assert.equal(code, 0);
    const row = JSON.parse(output).find((r) => r.id === 'engram-plugin');
    assert.equal(row.upToDate, 'unknown');
    assert.deepEqual(row.gaps, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain names the fix commands for gaps and never recommends codegraph upgrade', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: every dimension that applies is `missing`.
    const spawn = fakeSpawn({});

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /Fix:/);
    assert.match(output, /codegraph \(installed\): npm i -g @colbymchenry\/codegraph/);
    assert.doesNotMatch(output, /codegraph upgrade/);
    assert.match(output, /gentle-ai \(claude\): gentle-ai install/);
    assert.match(output, /  codex \(installed\): npm i -g @openai\/codex\n/);
    // Not installed, so there is nothing to be logged in for: no `codex` gap for this row.
    assert.match(output, /codex\s+missing\s+n\/a\s+n\/a\s+n\/a/);
    assert.doesNotMatch(output, /codex \(codex\)/);
    assert.doesNotMatch(output, /codex-plugin/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows a stale gentle-ai cell and prints one fix line per dead hook', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    // The hook is declared in the Claude settings next to the plugins the healthy seed enables.
    const settingsPath = path.join(home, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.hooks = {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'gentle-ai sdd-preflight-hook --agent claude-code' }] }],
    };
    writeJson(settingsPath, settings);
    const base = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 4.0.0' } });
    const spawn = (cmd, args, opts) =>
      [cmd, ...args].join(' ') === 'gentle-ai help'
        ? { status: 0, stdout: 'COMMANDS\n  sync         Sync agent configs\n', stderr: '' }
        : base(cmd, args, opts);

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--offline'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /gentle-ai\s+4\.0\.0\s+stale\s+ok/);
    assert.match(
      output,
      /  gentle-ai \(claude\):\n    remove the hook "gentle-ai sdd-preflight-hook --agent claude-code" \(PreToolUse\) from ~\/\.claude\/settings\.json: /,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain prints a header row above the tool table, aligned with the column widths', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const expectedHeader =
      'tool'.padEnd(16) + 'version'.padEnd(10) + 'claude'.padEnd(10) + 'codex'.padEnd(10) + 'project'.padEnd(10) +
      'up to date';
    assert.equal(output.split('\n')[0], expectedHeader);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain prints exactly the Codex mcp add command when codegraph is missing only in Codex, not the npm install', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    // Codex config lacks the codegraph section: registered everywhere except Codex.
    fs.writeFileSync(
      path.join(home, '.codex', 'config.toml'),
      '[mcp_servers.engram]\ncommand = "engram"\n\n[mcp_servers.context7]\nurl = "x"\n',
      'utf8',
    );
    const spawn = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
      gitToplevel: project,
    });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /codegraph \(codex\): codex mcp add codegraph -- codegraph serve --mcp/);
    assert.doesNotMatch(output, /codegraph \(installed\)/);
    assert.doesNotMatch(output, /codegraph \(claude\)/);
    assert.doesNotMatch(output, /codegraph \(project\)/);
    assert.doesNotMatch(output, /npm i -g @colbymchenry\/codegraph/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("doctorMain's codegraph project fix carries the actual resolved project root, not a literal placeholder", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    // No .codegraph/ in the project: codegraph's project dimension is a gap.
    const spawn = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
      gitToplevel: project,
    });

    const { code, output } = await runDoctor(
      ['--home', home, '--cwd', project, '--json'],
      {},
      { spawn, fetch: noopFetch },
    );

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    const codegraphRow = rows.find((r) => r.id === 'codegraph');
    assert.equal(codegraphRow.project, 'missing');
    assert.doesNotMatch(codegraphRow.fix.project, /<root>/);
    assert.ok(codegraphRow.fix.project.includes(project), 'expected the fix text to carry the resolved root');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --json exposes each row\'s fix map and a gaps array of {dimension, state, fix}', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: gentle-ai's installed/claude/codex are all `missing`.
    const spawn = fakeSpawn({});

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    const gentleAi = rows.find((r) => r.id === 'gentle-ai');
    assert.equal(typeof gentleAi.fix, 'object');
    assert.ok(Array.isArray(gentleAi.gaps));
    assert.deepEqual(
      gentleAi.gaps.map((g) => g.dimension).sort(),
      ['claude', 'codex', 'installed'],
    );
    for (const gap of gentleAi.gaps) {
      assert.equal(gap.state, 'missing');
      assert.equal(gap.fix, gentleAi.fix[gap.dimension]);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain resolves --home from JS_HARNESS_HOME when the flag is absent', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(
      ['--cwd', project, '--json'],
      { JS_HARNESS_HOME: home },
      { spawn, fetch: noopFetch },
    );

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').claude, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain resolves the project root through the injected spawn\'s git toplevel', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    fs.mkdirSync(path.join(project, '.codegraph'));
    const nested = path.join(project, 'nested', 'dir');
    fs.mkdirSync(nested, { recursive: true });
    const spawn = fakeSpawn({ gitToplevel: project });

    const { code, output } = await runDoctor(['--home', home, '--cwd', nested, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'codegraph').project, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain never throws and always exits 0, even on a completely empty home outside any repo', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({});
    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a gap with no known fix command is still reported, in --json gaps and in the Fix section', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home: context7 is registered nowhere, so `installed` is missing, and context7 has no
    // CLI to install, so that dimension has no fix command.
    const spawn = fakeSpawn({});
    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });
    const context7 = JSON.parse(json.output).find((row) => row.id === 'context7');
    assert.deepEqual(
      context7.gaps.find((gap) => gap.dimension === 'installed'),
      { dimension: 'installed', state: 'missing', fix: null },
    );

    const text = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.match(text.output, /context7 \(installed\): no fix command known/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- the Claude account check: the CLI and the desktop app signed into the same account ---

const CLI_ACCOUNT = '11111111-aaaa-4bbb-8ccc-000000000001';
const APP_ACCOUNT = '22222222-dddd-4eee-8fff-000000000002';

/** Adds the two account identifiers to a home: the CLI's in `~/.claude.json`, beside what is there, and the
 * desktop app's in its Windows config. The tests below pass `platform: 'win32'`, so that is the place read on
 * whatever machine runs them. */
function seedAccounts(home, { cli, app }) {
  const claudeJson = path.join(home, '.claude.json');
  const existing = fs.existsSync(claudeJson) ? JSON.parse(fs.readFileSync(claudeJson, 'utf8')) : {};
  writeJson(claudeJson, { ...existing, oauthAccount: { accountUuid: cli, emailAddress: 'someone@example.com' } });
  writeJson(path.join(home, 'AppData', 'Roaming', 'Claude', 'config.json'), {
    lastKnownAccountUuid: app,
    'oauth:tokenCache': 'never read',
  });
}

/** A healthy home and project with the two accounts given, and the deps that read them. */
function seedHealthyWithAccounts(home, project, accounts) {
  seedHealthyHome(home);
  fs.mkdirSync(path.join(project, '.codegraph'));
  if (accounts) seedAccounts(home, accounts);
  const spawn = fakeSpawn({
    versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
    gitToplevel: project,
    codexLogin: 'in',
  });
  return { spawn, fetch: noopFetch, platform: 'win32' };
}

const accountLine = (state) =>
  'claude-account'.padEnd(16) + 'n/a'.padEnd(10) + state.padEnd(10) + 'n/a'.padEnd(10) + 'n/a'.padEnd(10) + 'n/a';

// T4 of odd/tasks/commands-and-doctor.md: a memory note that holds a rule is a gap of the report, of
// `--json` and of the session-start hook, which says so once.
test('doctorMain reports the rule notes of the project memory as the memory-rules gap, in the table, under Fix, in --json and from the hook', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    const memory = path.join(home, '.claude', 'projects', project.replace(/[^A-Za-z0-9]/g, '-'), 'memory');
    fs.mkdirSync(memory, { recursive: true });
    fs.writeFileSync(path.join(memory, 'MEMORY.md'), '- [Rule](rule.md)\n');
    fs.writeFileSync(path.join(memory, 'rule.md'), '---\nname: rule\nmetadata:\n  type: feedback\n---\nAlways do X.\n');
    fs.writeFileSync(path.join(memory, 'me.md'), '---\nname: me\nmetadata:\n  type: user\n---\nThe user.\n');

    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.equal(text.code, 0);
    assert.ok(text.output.includes(`\n${'memory-rules'.padEnd(16)}${'n/a'.padEnd(10)}${'stale'.padEnd(10)}${'n/a'.padEnd(10)}${'n/a'.padEnd(10)}n/a\n`), text.output);
    assert.match(text.output, /\nFix:\n {2}memory-rules \(claude\):\n {4}place each note with the protocol "Changing a rule, a new one included" of the js-harness-protocols skill .*then delete the note:\n {4}rule\.md \(feedback\)\n/);

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, deps);
    const row = JSON.parse(json.output).find((r) => r.id === 'memory-rules');
    assert.deepEqual(row.gaps.map((gap) => [gap.dimension, gap.state]), [['claude', 'stale']]);

    const first = await runDoctor(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.deepEqual([first.code, JSON.parse(first.output).systemMessage], [0, 'js-harness: 1 stack gap — run js-harness doctor']);
    const again = await runDoctor(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.deepEqual([again.code, again.output], [0, ''], 'the same gap is told once');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// T5 of odd/tasks/commands-and-doctor.md: sessions of both permission classes with nothing joining them.
test('doctorMain reports recent sessions of both permission classes as the session-classes gap, whose fix is the install flag', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    const sessions = path.join(home, '.claude', 'projects', project.replace(/[^A-Za-z0-9]/g, '-'));
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, 'a.jsonl'), '{"type":"user","permissionMode":"bypassPermissions"}\n');
    fs.writeFileSync(path.join(sessions, 'b.jsonl'), '{"type":"user","permissionMode":"auto"}\n');

    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.match(text.output, /\n {2}session-classes \(claude\):\n {4}js-harness install --accept-session-messages, .*\n {4}1 of the project's sessions of the last 7 days bypass permission prompts and 1 asks for them; crossSessionInbound is not set in .*settings\.json, so a message from one class to the other is held\n/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows the account check after the tools, ok when both accounts match, with nothing to fix', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, deps);

    assert.equal(code, 0);
    const lines = output.split('\n').filter(Boolean);
    assert.equal(lines.at(-5), accountLine('ok'), output);
    assert.equal(lines.at(-4), remoteLine('n/a'), 'then the remote server check, with no launcher recorded under this home');
    assert.equal(lines.at(-3), hookLine('n/a'), 'then the hook commands check, with no manifest to read');
    assert.match(lines.at(-2), /^pnpm-lock\s+n\/a\s+n\/a/, 'then the pnpm lock check, with no PNPM_HOME in the env given');
    assert.match(lines.at(-1), /^js-harness\s+[0-9a-f]{8}\s+n\/a\s+n\/a\s+n\/a\s+unknown$/, "then the harness's own rules, main unread");
    assert.equal(lines.length, 14, "the header, the six tools, the six checks and the harness's own row");
    assert.doesNotMatch(output, /\nFix:/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain reports accounts that differ as a mismatch gap whose fix is claude auth login, in the table, under Fix and in --json', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: APP_ACCOUNT });

    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.equal(text.code, 0);
    assert.ok(text.output.split('\n').includes(accountLine('mismatch')), text.output);
    assert.match(text.output, /\nFix:\n  claude-account \(claude\): claude auth login\n$/, 'the only gap of this home');

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, deps);
    const row = JSON.parse(json.output).find((r) => r.id === 'claude-account');
    assert.deepEqual(row, {
      id: 'claude-account',
      version: null,
      installed: 'n/a',
      claude: 'mismatch',
      codex: 'n/a',
      project: 'n/a',
      upToDate: 'n/a',
      fix: { claude: 'claude auth login' },
      gaps: [{ dimension: 'claude', state: 'mismatch', fix: 'claude auth login' }],
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain never prints or stores an account identifier: not in the table, the Fix section, --json or the cache', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: APP_ACCOUNT });
    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, deps);
    const cache = fs.readFileSync(path.join(home, '.js-harness', 'doctor.json'), 'utf8');
    for (const [where, written] of Object.entries({ 'the plain output': text.output, 'the --json output': json.output, 'the cache': cache })) {
      for (const identifier of [CLI_ACCOUNT, APP_ACCOUNT]) {
        assert.equal(written.toLowerCase().includes(identifier), false, `${where} holds an account identifier`);
      }
      assert.doesNotMatch(written, /someone@example\.com|never read/, `${where} holds something else of those files`);
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows the account check as unknown, with no fix, when an identifier is missing', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, undefined);

    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.ok(text.output.split('\n').includes(accountLine('unknown')), text.output);
    assert.doesNotMatch(text.output, /\nFix:/, 'unknown is not a gap');

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, deps);
    assert.deepEqual(JSON.parse(json.output).find((r) => r.id === 'claude-account').gaps, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('the account check has no latest version: it is never looked up, and never makes a fresh cache refetch', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: APP_ACCOUNT });
    const checkedAt = new Date().toISOString();
    writeCache(home, { latest: { checkedAt, versions: { 'gentle-ai': '3.7.0', ...NULL_VERSIONS } }, notified: null });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return { ok: false };
    };

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { ...deps, fetch: fetchImpl });

    // The one request is the harness's own row, which reads main's list fresh and never from the cache.
    assert.deepEqual(urls, [MAIN_LIST_URL]);
    assert.equal(readCache(home).latest.checkedAt, checkedAt);
    assert.equal(JSON.parse(output).find((r) => r.id === 'claude-account').upToDate, 'n/a');
    assert.equal(JSON.parse(output).find((r) => r.id === 'remote-server').upToDate, 'n/a', 'nor has the remote server check');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- the remote server check: a recorded login launcher whose server is not running is a gap ---

const remoteLine = (state) =>
  'remote-server'.padEnd(16) + 'n/a'.padEnd(10) + state.padEnd(10) + 'n/a'.padEnd(10) + 'n/a'.padEnd(10) + 'n/a';
const hookLine = (state) =>
  'hook-commands'.padEnd(16) + 'n/a'.padEnd(10) + state.padEnd(10) + 'n/a'.padEnd(10) + 'n/a'.padEnd(10) + 'n/a';
const SUPERVISOR = { pid: 4242, startedAt: 1_759_700_000_000 };
/** Project folders are only named: the check reads the launcher and the state file, never the project. */
const PROJ = 'D:\\work\\proj';
const SPACED_PROJ = 'D:\\my work\\other proj';

/** What `remote start --at-login` leaves under `home` for the project at `root`: the launcher (in a folder of the
 * test's, recorded by its path in the machine manifest), the state file when `state` is given, and the marker of
 * a `remote stop` when `stopped`. */
function seedLauncher(home, root, { state, stopped = false } = {}) {
  const id = remoteId(root, 'win32');
  const launcher = path.join(home, 'Startup', launcherFileName(id));
  const content = loginLauncher({ node: 'C:\\node\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root, name: 'proj' });
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, content);
  recordOptionalFile(home, launcher, content);
  const files = remoteFiles(home, id);
  if (state) writeJson(files.statePath, state);
  if (stopped) {
    fs.mkdirSync(path.dirname(files.stoppedPath), { recursive: true });
    fs.writeFileSync(files.stoppedPath, 'stopped on purpose\n');
  }
}

test('doctorMain reports a recorded launcher whose server is down as a gap whose fix starts it, in the table, under Fix and in --json', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    seedLauncher(home, PROJ);

    const text = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.equal(text.code, 0);
    assert.equal(text.output.split('\n').filter(Boolean).at(10), remoteLine('down'), text.output);
    assert.match(text.output, /\nFix:\n  remote-server \(claude\): js-harness remote start --cwd D:\\work\\proj --name proj\n$/, 'the only gap of this home');

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, deps);
    assert.deepEqual(JSON.parse(json.output).find((r) => r.id === 'remote-server'), {
      id: 'remote-server',
      version: null,
      installed: 'n/a',
      claude: 'down',
      codex: 'n/a',
      project: 'n/a',
      upToDate: 'n/a',
      fix: { claude: 'js-harness remote start --cwd D:\\work\\proj --name proj' },
      gaps: [{ dimension: 'claude', state: 'down', fix: 'js-harness remote start --cwd D:\\work\\proj --name proj' }],
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain lists one start command for each server that is down, and says which was stopped on purpose', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    seedLauncher(home, PROJ, { stopped: true });
    seedLauncher(home, SPACED_PROJ);

    const { output } = await runDoctor(['--home', home, '--cwd', project], {}, deps);

    assert.ok(output.split('\n').includes(remoteLine('down')), output);
    assert.ok(
      output.endsWith(
        '\nFix:\n  remote-server (claude):\n' +
          '    js-harness remote start --cwd D:\\work\\proj --name proj (stopped on purpose with js-harness remote stop, so the watchdog leaves it down)\n' +
          '    js-harness remote start --cwd "D:\\my work\\other proj" --name proj\n',
      ),
      output,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows the remote server check ok while the recorded supervisor runs, and unknown, with no fix, when the processes cannot be listed', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = seedHealthyWithAccounts(home, project, { cli: CLI_ACCOUNT, app: CLI_ACCOUNT });
    seedLauncher(home, PROJ, { state: SUPERVISOR });
    const listing = (processes) => (cmd, args, opts) => (cmd === 'powershell'
      ? { status: 0, stdout: `4\t0\t1\tSystem\r\n${processes.map(([pid, createdAt]) => `${pid}\t4\t${createdAt}\tnode.exe\r\n`).join('')}`, stderr: '' }
      : deps.spawn(cmd, args, opts));
    const argv = ['--home', home, '--cwd', project];

    const running = await runDoctor(argv, {}, { ...deps, spawn: listing([[SUPERVISOR.pid, SUPERVISOR.startedAt]]) });
    assert.ok(running.output.split('\n').includes(remoteLine('ok')), running.output);
    assert.doesNotMatch(running.output, /\nFix:/);

    // The same pid, created at another time, is another program: the supervisor is gone.
    const reused = await runDoctor(argv, {}, { ...deps, spawn: listing([[SUPERVISOR.pid, SUPERVISOR.startedAt + 60_000]]) });
    assert.ok(reused.output.split('\n').includes(remoteLine('down')), reused.output);

    // The fixture's own spawn knows no PowerShell: the look fails, and nothing is claimed.
    const unlisted = await runDoctor(argv, {}, deps);
    assert.ok(unlisted.output.split('\n').includes(remoteLine('unknown')), unlisted.output);
    assert.doesNotMatch(unlisted.output, /\nFix:/, 'unknown is not a gap');
    const json = await runDoctor([...argv, '--json'], {}, deps);
    assert.deepEqual(JSON.parse(json.output).find((row) => row.id === 'remote-server').gaps, []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- T6: the Codex row (`codex`, the Codex CLI itself: installed, then logged in) ---

test('doctorMain --json reports a logged-out Codex as a codex gap with its own fix, exit still 0', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ codexLogin: 'out' });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    const row = JSON.parse(output).find((r) => r.id === 'codex');
    assert.equal(row.version, '0.130.0');
    assert.equal(row.installed, 'ok');
    assert.equal(row.claude, 'n/a');
    assert.equal(row.codex, 'missing');
    assert.equal(row.project, 'n/a');
    assert.deepEqual(row.gaps, [{ dimension: 'codex', state: 'missing', fix: 'codex login' }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain reports a missing Codex CLI as an installed gap with one fix, and asks Codex nothing about login', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const loginEnvs = [];
    const noCli = await runDoctor(
      ['--home', home, '--cwd', project, '--json'],
      {},
      { spawn: fakeSpawn({ codexLogin: 'no-cli', loginEnvs }), fetch: noopFetch },
    );
    const row = JSON.parse(noCli.output).find((r) => r.id === 'codex');
    assert.equal(row.installed, 'missing');
    assert.equal(row.codex, 'n/a');
    assert.deepEqual(row.gaps, [{ dimension: 'installed', state: 'missing', fix: 'npm i -g @openai/codex' }]);
    assert.equal('codexCli' in row, false);
    assert.equal(loginEnvs.length, 0, 'no `codex login status` without a Codex CLI');

    const text = await runDoctor(
      ['--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawn({ codexLogin: 'no-cli' }), fetch: noopFetch },
    );
    assert.match(text.output, /\n  codex \(installed\): npm i -g @openai\/codex\n/);
    assert.doesNotMatch(text.output, /codex \(codex\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows a timed-out login probe as unknown and lists no codex fix for it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ codexLogin: 'timeout' });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /codex\s+0\.130\.0\s+n\/a\s+unknown\s+n\/a/);
    assert.doesNotMatch(output, /codex \(codex\)/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("doctorMain's login probe reads the Codex home under --home, never the real one", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const loginEnvs = [];
    const spawn = fakeSpawn({ codexLogin: 'in', loginEnvs });

    await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(loginEnvs.length, 1);
    assert.equal(loginEnvs[0].CODEX_HOME, path.join(home, '.codex'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The npm registry is the Codex CLI's latest-version source: outdated against it with its upgrade fix, then ok once it matches.
const CODEX_REGISTRY = 'https://registry.npmjs.org/%40openai%2Fcodex/latest';

/** A fetch answering the npm registry's `@openai/codex` entry with `version`, and every other URL with a failure. */
function codexRegistry(version) {
  return async (url) => (url === CODEX_REGISTRY ? { ok: true, json: async () => ({ version }) } : { ok: false });
}

test('doctorMain compares the Codex CLI against the npm registry: outdated, with its upgrade fix', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ codexLogin: 'in' });

    const { output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: codexRegistry('0.131.0') });

    assert.match(output, /codex\s+0\.130\.0\s+n\/a\s+ok\s+n\/a\s+outdated/);
    assert.match(output, /codex \(upToDate\): npm i -g @openai\/codex@latest/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain reports the Codex CLI up to date when the npm registry has its version', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ codexLogin: 'in' });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: codexRegistry('0.130.0') });

    assert.equal(JSON.parse(output).find((r) => r.id === 'codex').upToDate, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- the codex row follows the project's codexReview switch (harness.json "functions"); auto reads the program files ---

test('doctorMain leaves the codex row out when the project declares codexReview off, and asks Codex nothing', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeJson(path.join(project, 'harness.json'), { functions: { codexReview: 'off' } });
    const loginEnvs = [];
    const spawn = fakeSpawn({ codexLogin: 'in', loginEnvs });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.equal(JSON.parse(output).some((r) => r.id === 'codex'), false);
    assert.equal(loginEnvs.length, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain on auto shows the codex row only for a project with a program file', async () => {
  for (const [lsFiles, shown] of [
    ['README.md\0docs/notes.txt\0', false],
    ['README.md\0src/app.ts\0', true],
  ]) {
    const home = makeTmpHome();
    const project = makeTmpHome();
    try {
      seedHealthyHome(home);
      const spawn = fakeSpawn({ codexLogin: 'in', lsFiles });

      const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

      assert.equal(JSON.parse(output).some((r) => r.id === 'codex'), shown, JSON.stringify(lsFiles));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

// --- the typescript-lsp row follows the project's languageServer switch: off is the control of language-server-load ---

test('doctorMain leaves the typescript-lsp row out, and offers no enable, when the project declares languageServer off', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeJson(path.join(project, 'harness.json'), { functions: { languageServer: 'off' } });
    const spawn = fakeSpawn({ codexLogin: 'in', lsFiles: 'src/app.ts\0' });

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });
    const text = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(JSON.parse(json.output).some((r) => r.id === 'typescript-lsp'), false);
    assert.doesNotMatch(text.output, /typescript-lsp/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain on auto shows the typescript-lsp row only for a project with a TypeScript file', async () => {
  for (const [lsFiles, shown] of [
    ['README.md\0bin/app.mjs\0', false],
    ['README.md\0src/app.ts\0', true],
  ]) {
    const home = makeTmpHome();
    const project = makeTmpHome();
    try {
      seedHealthyHome(home);
      const spawn = fakeSpawn({ codexLogin: 'in', lsFiles });

      const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

      assert.equal(JSON.parse(output).some((r) => r.id === 'typescript-lsp'), shown, JSON.stringify(lsFiles));
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

test('doctorMain shows codegraph project n/a, with no gap and no init offered, where codeMap is off', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeJson(path.join(project, 'harness.json'), { functions: { codeMap: 'off' } });
    const spawn = fakeSpawn({ codexLogin: 'in' });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    const row = JSON.parse(output).find((r) => r.id === 'codegraph');
    assert.equal(row.project, 'n/a');
    assert.equal(row.gaps.some((gap) => gap.dimension === 'project'), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain keeps the codex row when codexReview is declared on, with no program file', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeJson(path.join(project, 'harness.json'), { functions: { codexReview: 'on' } });
    const spawn = fakeSpawn({ codexLogin: 'in', lsFiles: 'README.md\0' });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(JSON.parse(output).some((r) => r.id === 'codex'), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain keeps the codex row when harness.json cannot be read: every switch is read as on', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.writeFileSync(path.join(project, 'harness.json'), '{ not json', 'utf8');
    const spawn = fakeSpawn({ codexLogin: 'in', lsFiles: 'README.md\0' });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });

    assert.equal(JSON.parse(output).some((r) => r.id === 'codex'), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});


// --- T6b: a fix with several steps is a list, printed one command per line ---

// gentle-ai 3.7.0 is installed while GitHub's latest is v99.0.0: a major behind, so its upToDate fix is a list.
const GO_INSTALL = 'go install github.com/gentleman-programming/gentle-ai/v99/cmd/gentle-ai@v99.0.0';

/** A fetch answering GitHub's gentle-ai latest release with v99.0.0, and every other URL with a failure. */
async function gentleAiBehind(url) {
  return url.includes('Gentleman-Programming/gentle-ai')
    ? { ok: true, json: async () => ({ tag_name: 'v99.0.0' }) }
    : { ok: false };
}

test('doctorMain prints a one-step fix on the gap line and a multi-step fix as a header plus indented lines', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // gentle-ai behind by a major (a list `upToDate` fix); the Codex CLI missing (a one-step `installed` fix).
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: gentleAiBehind });

    assert.match(output, new RegExp(`\\n  gentle-ai \\(upToDate\\):\\n    ${GO_INSTALL}\\n    gentle-ai sync\\n`));
    assert.match(output, /\n  codex \(installed\): npm i -g @openai\/codex\n/);
    // Once each command has its own line there is no `;` joining commands anywhere in the section.
    assert.doesNotMatch(output.slice(output.indexOf('Fix:')), /;/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --json carries a multi-step fix as an array, in the row fix map and in the gap', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: gentleAiBehind });

    const rows = JSON.parse(output);
    const steps = [GO_INSTALL, 'gentle-ai sync'];
    const gentle = rows.find((r) => r.id === 'gentle-ai');
    assert.deepEqual(gentle.fix.upToDate, steps);
    assert.deepEqual(gentle.gaps.find((g) => g.dimension === 'upToDate').fix, steps);
    assert.equal(rows.find((r) => r.id === 'codex').fix.installed, 'npm i -g @openai/codex');
    assert.equal(typeof rows.find((r) => r.id === 'codegraph').fix.installed, 'string');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});


// --- the hook commands check: the copy on the path answers the recorded `js-harness resume` hook commands ---

const HOOK_GAP_FIX = 'the js-harness on the path is older than these entries: run js-harness upgrade, or install the newest copy (npm i -g --allow-git=all github:jsaristi/js-harness, or pnpm add -g github:jsaristi/js-harness where pnpm installed it), then run js-harness doctor again';

test('doctorMain reports a recorded hook command that the copy on the path does not answer, in the table, under Fix and in --json', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeJson(path.join(home, '.js-harness', 'manifest.json'), {
      version: '0.1.0',
      files: [],
      entries: [
        {
          path: path.join(home, '.claude', 'settings.json'),
          pointer: ['hooks', 'PostToolUse'],
          entry: { hooks: [{ type: 'command', command: 'js-harness resume --pause || exit 0' }] },
          createdFile: false,
          skipped: false,
        },
      ],
    });
    const base = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    // The copy on the path is one that predates `resume`: it answers 2 to the command, as it did on 2026-10-12.
    const spawn = (cmd, args, opts) =>
      [cmd, ...args].join(' ') === 'js-harness resume --pause'
        ? { status: 2, stdout: '', stderr: 'Unknown command: resume\n' }
        : base(cmd, args, opts);
    const gap = ['the js-harness on the path is older than these entries', 'js-harness resume --pause: exit 2; stderr: Unknown command: resume'];

    const text = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.equal(text.code, 0);
    assert.match(text.output, /hook-commands\s+n\/a\s+stale\s+n\/a\s+n\/a/);
    assert.match(text.output, /\n  hook-commands \(claude\):\n    the js-harness on the path is older than these entries: run js-harness upgrade, or install the newest copy \(npm i -g/);
    assert.match(text.output, /\n    js-harness resume --pause: exit 2; stderr: Unknown command: resume\n/);

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });
    const row = JSON.parse(json.output).find((r) => r.id === 'hook-commands');
    assert.equal(row.claude, 'stale');
    assert.deepEqual(row.fix, { claude: [HOOK_GAP_FIX, gap[1]] });
    assert.deepEqual(row.gaps, [{ dimension: 'claude', state: 'stale', fix: [HOOK_GAP_FIX, gap[1]] }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- T6b (Codex P2): a fresh cache written before a row existed must not hide that row for 6 h ---

/** The typescript-lsp fixture for the local-source cache tests: its latest version is 1.0.0, read from its own marketplace. */
function seedTypeScriptMarketplace(home) {
  writeJson(
    path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', '.claude-plugin', 'marketplace.json'),
    { plugins: [{ name: 'typescript-lsp', version: '1.0.0' }] },
  );
}

test('an online run refetches when a fresh cache has no key for a network row, and fills it in', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    // A minute old: still fresh, and a restamp can never land on the same millisecond.
    const freshAt = new Date(Date.now() - 60_000).toISOString();
    writeCache(home, {
      latest: { checkedAt: freshAt, versions: { 'gentle-ai': '3.7.0', codegraph: null, context7: null } },
      notified: null,
    });
    const spawn = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1' },
      codexLogin: 'in',
    });
    const fetchImpl = async (url) =>
      url.includes('Gentleman-Programming/engram') ? { ok: true, json: async () => [{ tag_name: 'v2.2.1' }] } : { ok: false };

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(JSON.parse(output).find((r) => r.id === 'engram').upToDate, 'ok');
    const cache = readCache(home);
    assert.equal(cache.latest.versions.engram, '2.2.1');
    assert.equal(cache.latest.versions['gentle-ai'], '3.7.0', 'a failed lookup keeps what was cached for it');
    assert.notEqual(cache.latest.checkedAt, freshAt, 'the refetch succeeded for one row, so the cache is stamped again');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--offline never refetches for a network row the cache predates: it stays unknown', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeCache(home, { latest: { checkedAt: new Date().toISOString(), versions: {} }, notified: null });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, codexLogin: 'in' });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called in --offline mode');
    };

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--json', '--offline'], {}, { spawn, fetch: fetchImpl });

    assert.equal(fetchCalled, false);
    assert.equal(JSON.parse(output).find((r) => r.id === 'gentle-ai').upToDate, 'unknown');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- T6d (Codex P2): a latest version read from a local marketplace file is never taken from the
// cache. It is read on every run, online or --offline, and overlays whatever the cache holds. It
// is not written to the cache either (the simpler of the two options: nothing is stored that a
// later run must remember not to read), and it never counts as an attempted lookup. ---

// The engram plugin's local read is a git process of up to 5s. It runs beside the network lookups, never blocking them:
// a blocked event loop lets a request's timeout run out while its response cannot be read (review R4, lineage
// review-bc11b71ae8b02ac4; Codex P2 on 37a5709..e234e5d). Each side here answers only once the other has started, so
// a run that waits on one before starting the other never resolves.
test('resolveLatestVersions reads the engram plugin with git while the network lookups are in flight', async () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.claude', 'plugins', 'marketplaces', 'engram', '.git'), { recursive: true });
    const started = {};
    const both = new Promise((resolve) => {
      started.check = () => started.fetch && started.git && resolve();
    });
    const fetchImpl = async () => {
      started.fetch = true;
      started.check();
      await both;
      return { ok: true, json: async () => [{ tag_name: 'v3.5.1' }] };
    };
    const git = async () => {
      started.git = true;
      started.check();
      await both;
      return { status: 0, stdout: JSON.stringify({ plugins: [{ name: 'engram', version: '0.1.14' }] }) };
    };
    const rows = [
      { id: 'engram', installed: 'ok', version: '3.5.1' },
      { id: 'engram-plugin', installed: 'ok', version: '0.1.12' },
    ];
    const resolved = resolveLatestVersions(rows, { home, offline: false, fetch: fetchImpl, now: () => new Date(), git });
    const deadlock = new Promise((_, reject) => setTimeout(() => reject(new Error('git and the network ran one after the other')), 2000).unref());
    const versions = await Promise.race([resolved, deadlock]);
    assert.equal(versions.engram, '3.5.1');
    assert.equal(versions['engram-plugin'], '0.1.14');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('doctorMain --json gives an outdated engram plugin its fix as the line that names the versions, then the two commands', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const manifest = JSON.stringify({ plugins: [{ name: 'engram', version: '0.1.14' }] });
    const { spawn, git } = seedEngramPluginLag(home, { gitShow: () => ({ status: 0, stdout: manifest, stderr: '' }) });

    const { output } = await runDoctor(['--home', home, '--cwd', project, '--offline', '--json'], {}, { spawn, git, fetch: noopFetch });

    const row = JSON.parse(output).find((r) => r.id === 'engram-plugin');
    assert.deepEqual(row.gaps, [{
      dimension: 'upToDate',
      state: 'outdated',
      fix: [
        'plugin 0.1.12 is behind 0.1.14, the plugin engram v3.5.1 ships; update it, then restart Claude Code:',
        'claude plugin marketplace update engram',
        'claude plugin update engram@engram',
      ],
    }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a plugin installed after a run cached null for it is compared at once, online and --offline', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    seedTypeScriptMarketplace(home);
    writeCache(home, {
      latest: { checkedAt: new Date().toISOString(), versions: { ...NULL_VERSIONS, 'gentle-ai': '3.7.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, codexLogin: 'in' });

    const online = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch });
    assert.equal(JSON.parse(online.output).find((r) => r.id === 'typescript-lsp').upToDate, 'ok');

    const offline = await runDoctor(['--home', home, '--cwd', project, '--json', '--offline'], {}, { spawn, fetch: noopFetch });
    assert.equal(JSON.parse(offline.output).find((r) => r.id === 'typescript-lsp').upToDate, 'ok');

    assert.equal(readCache(home).latest.versions['typescript-lsp'], null, 'the local answer is never written to the cache');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a fresh cache with a key for every network row is not refetched, whatever it lacks for local rows', async () => {
  const home = makeTmpHome();
  try {
    const checkedAt = new Date().toISOString();
    writeCache(home, { latest: { checkedAt, versions: { 'gentle-ai': '3.7.0', codex: null } }, notified: null });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called');
    };
    const rows = [
      { id: 'gentle-ai', version: '3.7.0' },
      { id: 'typescript-lsp', version: '1.0.0' },
      { id: 'codex', version: '0.130.0' },
    ];

    await resolveLatestVersions(rows, { home, offline: false, fetch: fetchImpl, now: () => new Date() });

    assert.equal(fetchCalled, false);
    assert.equal(readCache(home).latest.checkedAt, checkedAt);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('local lookups are not "attempted": a row set of only local rows leaves the cache fresh and writes no local key', async () => {
  const home = makeTmpHome();
  try {
    seedTypeScriptMarketplace(home);
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, { latest: { checkedAt: staleCheckedAt, versions: {} }, notified: null });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called');
    };

    const versions = await resolveLatestVersions([{ id: 'typescript-lsp', version: '1.0.0' }], {
      home,
      offline: false,
      fetch: fetchImpl,
      now: () => new Date(),
    });

    assert.equal(versions['typescript-lsp'], '1.0.0');
    assert.equal(fetchCalled, false);
    const cache = readCache(home);
    assert.notEqual(cache.latest.checkedAt, staleCheckedAt, 'nothing was attempted, so there was nothing to fail');
    assert.equal('typescript-lsp' in cache.latest.versions, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a local answer never hides an outage: a failing network row alongside it keeps the cache stale', async () => {
  const home = makeTmpHome();
  try {
    seedTypeScriptMarketplace(home);
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, { latest: { checkedAt: staleCheckedAt, versions: {} }, notified: null });
    const failingFetch = async () => {
      throw new Error('offline');
    };
    const rows = [
      { id: 'typescript-lsp', version: '1.0.0' },
      { id: 'gentle-ai', version: '3.7.0' },
    ];

    const versions = await resolveLatestVersions(rows, { home, offline: false, fetch: failingFetch, now: () => new Date() });

    assert.equal(versions['typescript-lsp'], '1.0.0');
    assert.equal(versions['gentle-ai'], null);
    assert.equal(readCache(home).latest.checkedAt, staleCheckedAt);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a cached null counts as present: an outage never retriggers the refetch on every run', async () => {
  const home = makeTmpHome();
  try {
    const checkedAt = new Date().toISOString();
    writeCache(home, { latest: { checkedAt, versions: { 'gentle-ai': null } }, notified: null });
    let fetchCalls = 0;
    const fetchImpl = async () => {
      fetchCalls += 1;
      throw new Error('offline');
    };
    const rows = [{ id: 'gentle-ai', version: '3.7.0' }];

    await resolveLatestVersions(rows, { home, offline: false, fetch: fetchImpl, now: () => new Date() });

    assert.equal(fetchCalls, 0);
    assert.equal(readCache(home).latest.checkedAt, checkedAt);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a refetch for a missing key that fails everywhere leaves checkedAt alone and stores a null, so the next run does not retry', async () => {
  const home = makeTmpHome();
  try {
    const checkedAt = new Date(Date.now() - 60_000).toISOString();
    writeCache(home, { latest: { checkedAt, versions: {} }, notified: null });
    let fetchCalls = 0;
    const fetchImpl = async () => {
      fetchCalls += 1;
      throw new Error('offline');
    };
    const rows = [{ id: 'gentle-ai', version: '3.7.0' }];
    const deps = { home, offline: false, fetch: fetchImpl, now: () => new Date() };

    await resolveLatestVersions(rows, deps);
    assert.equal(fetchCalls, 1);
    assert.equal(readCache(home).latest.checkedAt, checkedAt, 'no lookup succeeded, so the stamp does not move');
    assert.equal(readCache(home).latest.versions['gentle-ai'], null);

    await resolveLatestVersions(rows, deps);
    assert.equal(fetchCalls, 1, 'the key is now present, so a still-fresh cache is not refetched again');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a hosted context7 row (never looked up) does not count as a missing key', async () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { latest: { checkedAt: new Date().toISOString(), versions: {} }, notified: null });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called');
    };

    await resolveLatestVersions([{ id: 'context7', version: 'hosted' }], {
      home,
      offline: false,
      fetch: fetchImpl,
      now: () => new Date(),
    });

    assert.equal(fetchCalled, false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- T2: latest-version lookup, cache, `outdated`, `--offline` ---

test('doctorMain marks a tool ok when its installed version is at least the fetched latest', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v3.7.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'ok');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain gives gentle-ai a go install fix when the latest release crosses a major', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.0.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    assert.match(output, /gentle-ai\s.*outdated/);
    assert.match(
      output,
      /Fix:\n(.*\n)*  gentle-ai \(upToDate\):\n    go install github\.com\/gentleman-programming\/gentle-ai\/v4\/cmd\/gentle-ai@v4\.0\.0\n    gentle-ai sync\n/,
    );
    assert.doesNotMatch(output, /gentle-ai \(upToDate\):\n    gentle-ai upgrade/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain marks a tool outdated and lists its fix when the fetched latest is newer', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 4.0.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.1.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    assert.match(output, /gentle-ai\s.*outdated/);
    assert.match(output, /Fix:\n(.*\n)*  gentle-ai \(upToDate\):\n    gentle-ai upgrade\n    gentle-ai sync\n/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --offline reads only the cache and never calls fetch', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { 'gentle-ai': '9.9.9' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    let fetchCalled = false;
    const fetchImpl = async () => {
      fetchCalled = true;
      throw new Error('must not be called in --offline mode');
    };

    const { code, output } = await runDoctor(
      ['--home', home, '--cwd', project, '--json', '--offline'],
      {},
      { spawn, fetch: fetchImpl },
    );

    assert.equal(code, 0);
    assert.equal(fetchCalled, false);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'outdated');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain skips fetching when the cache was checked within the last 6 hours', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date().toISOString(), versions: { 'gentle-ai': '3.7.0', ...NULL_VERSIONS } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ tag_name: 'v3.7.0' }) };
    };

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    // No version is looked up: the one request is the harness's own row, which reads main's list fresh.
    assert.deepEqual(urls, [MAIN_LIST_URL]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain refetches and updates the cache when it is stale, storing a fresh checkedAt', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { 'gentle-ai': '1.0.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.0.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'outdated');

    const cache = readCache(home);
    assert.equal(cache.latest.versions['gentle-ai'], '4.0.0');
    assert.notEqual(cache.latest.checkedAt, new Date(0).toISOString());
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a failed fetch for one tool keeps its previously cached version; a successful one still refreshes', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeCache(home, {
      latest: { checkedAt: new Date(0).toISOString(), versions: { engram: '2.0.0', 'gentle-ai': '1.0.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({});
    const fetchImpl = async (url) => {
      if (url.includes('gentle-ai')) throw new Error('offline for this tool only');
      if (url.includes('Gentleman-Programming/engram')) return { ok: true, json: async () => [{ tag_name: 'v2.2.1' }] };
      return { ok: false };
    };

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });
    assert.equal(code, 0);

    const cache = readCache(home);
    assert.equal(cache.latest.versions['gentle-ai'], '1.0.0', 'kept: this tool could not be refreshed');
    assert.equal(cache.latest.versions.engram, '2.2.1', 'refreshed: this tool succeeded');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a malformed cache file is treated as absent, not a crash', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'doctor.json'), 'not json', 'utf8');
    const spawn = fakeSpawn({});

    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-101 (accepted T2/T3 review follow-up): the report survives a cache write failure ---

test('doctorMain still prints the report and exits 0 when the cache cannot be written (home is a file)', async () => {
  const parent = makeTmpHome();
  const home = path.join(parent, 'not-a-directory');
  const project = makeTmpHome();
  try {
    fs.writeFileSync(home, 'this is a file, not a home directory', 'utf8');
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const fetchImpl = async (url) =>
      url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v3.7.0' }) } : { ok: false };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });

    assert.equal(code, 0);
    assert.match(output, /gentle-ai/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-102 (accepted T2/T3 review follow-up): a refetch where everything fails must not reset
// checkedAt to now, or the next run would wait out a fresh 6h window instead of retrying ---

test('doctorMain keeps the old checkedAt (and retries next run) when a refetch fails for every tool', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, {
      latest: { checkedAt: staleCheckedAt, versions: { 'gentle-ai': '1.0.0' } },
      notified: null,
    });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const alwaysFailFetch = async () => {
      throw new Error('offline');
    };

    const first = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: alwaysFailFetch });
    assert.equal(first.code, 0);

    const afterFirstRun = readCache(home);
    assert.equal(afterFirstRun.latest.checkedAt, staleCheckedAt, 'checkedAt must not move on a total failure');
    assert.equal(afterFirstRun.latest.versions['gentle-ai'], '1.0.0', 'the last-known version must survive');

    // The next run must still see the cache as stale and try the network again.
    let secondRunFetchCalled = false;
    const fetchImpl = async (url) => {
      secondRunFetchCalled = true;
      return url.includes('gentle-ai') ? { ok: true, json: async () => ({ tag_name: 'v4.0.0' }) } : { ok: false };
    };
    const second = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });

    assert.equal(second.code, 0);
    assert.equal(secondRunFetchCalled, true, 'a run after a total failure must retry the network');
    const rows = JSON.parse(second.output);
    assert.equal(readCache(home).latest.versions['gentle-ai'], '4.0.0', 'the retried fetch must now be reflected');
    assert.equal(rows.find((r) => r.id === 'gentle-ai').upToDate, 'outdated');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// --- R3-003: a flag missing its value, or immediately followed by another flag, is an error ---

async function runDoctorExpectingError(argv) {
  let errOutput = '';
  const originalError = console.error;
  console.error = (line) => {
    errOutput += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, {}, {});
    return { code, errOutput };
  } finally {
    console.error = originalError;
  }
}

test('doctorMain errors with usage on stderr and exits 2 when --home is the last argument', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--home']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

test('doctorMain errors with usage on stderr and exits 2 when --home is immediately followed by another flag', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--home', '--json']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

test('doctorMain errors with usage on stderr and exits 2 when --cwd is missing its value', async () => {
  const { code, errOutput } = await runDoctorExpectingError(['--cwd']);
  assert.equal(code, 2);
  assert.match(errOutput, /Usage: js-harness doctor/);
});

// --- R3-004 (accepted T4 native review follow-up): a successful lookup that legitimately has
// nothing to check (context7 hosted, or no rows at all) must mark the cache fresh, not stale.
// Stale must still mean "at least one attempted lookup failed" (R3-102's own scenario keeps
// working: some tools do get attempted, and either succeed or genuinely fail).

test('R3-004: resolveLatestVersions marks the cache fresh when the only row is hosted context7 (nothing to check)', async () => {
  const home = makeTmpHome();
  try {
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, { latest: { checkedAt: staleCheckedAt, versions: {} }, notified: null });
    const rows = [{ id: 'context7', version: 'hosted' }];

    await resolveLatestVersions(rows, { home, offline: false, fetch: noopFetch, now: () => new Date() });

    const cache = readCache(home);
    assert.notEqual(
      cache.latest.checkedAt,
      staleCheckedAt,
      'expected the cache to become fresh when nothing needed checking',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('R3-004: resolveLatestVersions marks the cache fresh for a genuinely empty row set', async () => {
  const home = makeTmpHome();
  try {
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, { latest: { checkedAt: staleCheckedAt, versions: {} }, notified: null });

    await resolveLatestVersions([], { home, offline: false, fetch: noopFetch, now: () => new Date() });

    const cache = readCache(home);
    assert.notEqual(cache.latest.checkedAt, staleCheckedAt);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// --- R3-003 (accepted final review follow-up, lineage review-cef5637e2884c12a): the attempted set
// is derived from lib/latest.mjs's own `isLookupAttempted` predicate, not a second inline copy of
// the context7-hosted rule, so a realistic mixed row set — a hosted context7 with nothing to check
// alongside a real tool whose lookup genuinely fails — must still leave the cache stale: the row
// with nothing to attempt must never make a genuine failure look like "nothing attempted, so it's
// fine to call this fresh".

test('R3-003: resolveLatestVersions keeps the cache stale for a mixed row set (hosted context7 + one failing lookup)', async () => {
  const home = makeTmpHome();
  try {
    const staleCheckedAt = new Date(0).toISOString();
    writeCache(home, { latest: { checkedAt: staleCheckedAt, versions: {} }, notified: null });
    const rows = [
      { id: 'context7', version: 'hosted' },
      { id: 'gentle-ai', version: '1.0.0' },
    ];
    const failingFetch = async () => {
      throw new Error('offline');
    };

    await resolveLatestVersions(rows, { home, offline: false, fetch: failingFetch, now: () => new Date() });

    const cache = readCache(home);
    assert.equal(cache.latest.checkedAt, staleCheckedAt, 'a genuinely failed lookup must keep the cache stale');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The pnpm-lock row reads `PNPM_HOME` from the env doctor is given, never from the process: a pnpm install running
// on the machine while the tests run cannot turn their rows into gaps.
test('doctorMain shows the pnpm-lock row stale for a global bin lock left over in the given PNPM_HOME, its rmdir under Fix, and the hook notices it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  const pnpmHome = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const lockPath = path.join(pnpmHome, 'bin', '.pnpm-global-bin.lock');
    fs.mkdirSync(lockPath, { recursive: true });
    const leftAt = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(lockPath, leftAt, leftAt);
    // The time doctor reads back is the one the file system kept: ext4 under WSL loses a millisecond of leftAt
    // about one time in three, so the expected line is built from the stored time, not from leftAt.
    const stored = new Date(fs.statSync(lockPath).mtimeMs);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], { PNPM_HOME: pnpmHome }, { spawn, fetch: noopFetch });

    assert.equal(code, 0);
    assert.match(output, /^pnpm-lock\s+n\/a\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.ok(output.includes(`  pnpm-lock (claude):\n    pnpm left its global bin lock behind`), output);
    assert.ok(output.includes(`\n    rmdir "${lockPath}"\n    the folder was left there at ${stored.toISOString()}\n`), output);

    const hook = await runDoctor(['--hook', '--home', home, '--cwd', project], { PNPM_HOME: pnpmHome }, { spawn, fetch: noopFetch });
    assert.equal(hook.code, 0);
    // The healthy fixture has no other gap, so the one the hook counts is the lock.
    assert.equal(hook.output.trim(), JSON.stringify({ systemMessage: 'js-harness: 1 stack gap — run js-harness doctor' }));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(pnpmHome, { recursive: true, force: true });
  }
});

test('doctorMain shows the pnpm-lock row n/a, with no gap, when the env it is given names no PNPM_HOME', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });

    const { output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    assert.match(output, /^pnpm-lock\s+n\/a\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.doesNotMatch(output, /pnpm-lock \(/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The unseen row (`js-harness unseen`) is added only when the caller hands doctor the check, as the
// dispatcher does; the dependency returns the FAIL items' texts, or throws when the check cannot run.
test('doctorMain shows the unseen row ok, with no gap, when the check has nothing to clear', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, unseen: () => [] });

    assert.equal(code, 0);
    assert.match(output, /^unseen\s+n\/a\s+ok\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.doesNotMatch(output, /^ {2}unseen \(/m, 'no fix line for the unseen row');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows the unseen row stale when there is something to clear: its fix names the count and each item, in the table, under Fix and in --json', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const unseen = () => ['enabled scheduled task jh-wake runs in this project'];

    const table = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, unseen });
    assert.match(table.output, /^unseen\s+n\/a\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.match(table.output, /\nFix:\n[\s\S]*  unseen \(claude\):\n {4}unseen: 1 to clear: run js-harness unseen\n {4}enabled scheduled task jh-wake runs in this project/);

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch, unseen });
    const row = JSON.parse(json.output).find((item) => item.id === 'unseen');
    assert.equal(row.claude, 'stale');
    assert.deepEqual(row.gaps, [{ dimension: 'claude', state: 'stale', fix: row.fix.claude }]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The row is the records-only path of `unseen`: it reads no transcript. The transcript here says another title than
// the app record, and the reader is injected and counted: the row names the record's title, and the reader is never called.
test('the unseen row reads no transcript: its fix names the app record, and the injected transcript reader is never called', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  const appData = makeTmpHome();
  const claude = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const sessions = path.join(appData, 'Claude', 'claude-code-sessions', 'acct', 'org');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, 'local_1.json'), JSON.stringify({ cliSessionId: 'c-1', scheduledTaskId: 'jh-wake', isArchived: false, cwd: project, title: 'From the record' }));
    const projectDir = path.join(claude, 'projects', projectSlug(project));
    fs.mkdirSync(projectDir, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(projectDir, 'c-1.jsonl'), [
      { type: 'custom-title', sessionId: 'c-1', customTitle: 'From the transcript' },
      { type: 'user', uuid: 'c-1-1', timestamp: now, cwd: project, gitBranch: 'main', isSidechain: false, turnOrigin: 'scheduled', entrypoint: 'claude-desktop', message: { role: 'user', content: 'hola' } },
    ].map((line) => JSON.stringify(line)).join('\n') + '\n');
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    let readerCalls = 0;
    const readFacts = () => {
      readerCalls += 1;
      throw new Error('the transcript reader was called');
    };
    const unseen = (cwd) => unseenToClear(cwd, { env: { APPDATA: appData, CLAUDE_CONFIG_DIR: claude, JS_HARNESS_HOME: home }, platform: 'win32', homedir: () => claude, readFacts });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, unseen });

    assert.equal(code, 0);
    assert.equal(readerCalls, 0, 'the row never reads a transcript');
    assert.match(output, /^unseen\s+n\/a\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.match(output, /  unseen \(claude\):\n {4}unseen: 1 to clear: run js-harness unseen\n {4}From the record \(c-1\): opened by a scheduled task, in Routines/);
    assert.doesNotMatch(output, /From the transcript/);
  } finally {
    for (const dir of [home, project, appData, claude]) fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('doctorMain shows the unseen row unknown, and lists no fix for it, when the check cannot run', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const unseen = () => {
      throw new Error('the sessions folder is busy');
    };

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, unseen });

    assert.equal(code, 0);
    assert.match(output, /^unseen\s+n\/a\s+unknown\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.doesNotMatch(output, /^ {2}unseen \(/m, 'an unknown check is no gap, so no fix line');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The host-update row (bin/lib/host-update.mjs) is added only when the caller hands doctor the host check, as the
// dispatcher does; the dependency returns the versions read from the app's folder.
test('doctorMain records the first host reading as reviewed, and shows a staged update not applied as outdated with the quit as its fix', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const host = () => ({ found: true, desktop: '2.37337.1', staged: '2.42304.0', code: '2.1.295' });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, host });

    assert.equal(code, 0);
    assert.match(output, /^host-update\s+2\.37337\.1\s+ok\s+n\/a\s+n\/a\s+outdated$/m);
    assert.ok(output.includes('\n  host-update (upToDate): Claude Desktop 2.42304.0 is downloaded and not applied (running 2.37337.1): quit Claude fully, the tray icon included, and open it again\n'), output);
    const { at } = readCache(home).host.reviewed;
    assert.deepEqual(readCache(home).host.reviewed, { desktop: '2.37337.1', code: '2.1.295', at });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('a host update since the reviewed versions is stale, with the versions and the review steps, until --host-reviewed records it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeCache(home, { ...readCache(home), host: { reviewed: { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' } } });
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const host = () => ({ found: true, desktop: '2.42304.0', staged: '2.42304.0', code: '2.1.299' });

    const table = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, host });
    assert.match(table.output, /^host-update\s+2\.42304\.0\s+stale\s+n\/a\s+n\/a\s+ok$/m);
    const steps = [
      '  host-update (claude):',
      '    Claude Desktop 2.37337.1 → 2.42304.0 and its Code tab CLI 2.1.295 → 2.1.299 since the last review; review the update:',
      '    read https://claude.com/docs/cowork/claude-desktop-changelog from 2.37337.1 to 2.42304.0',
      '    read the Claude Code CHANGELOG (https://code.claude.com/docs/en/changelog) from 2.1.295 to 2.1.299',
      '    check that the harness hooks in ~/.claude/settings.json still run',
      '    turn Remote Control back on in each work session without asking the user (a standing yes of 2026-10-15); a session that has run no turn since the restart refuses it, so send it a message first',
      '    report to the user a full summary in everyday words: what improved, what changed and what was fixed; for each, how it helps or hurts the harness and the way the user works; and what the harness should change to work better, or must change; a version the changelog has no entry for is reported as having none',
      '    then record the review: js-harness doctor --host-reviewed',
    ].join('\n');
    assert.ok(table.output.includes(`\n${steps}\n`), table.output);
    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: noopFetch, host });
    const row = JSON.parse(json.output).find((item) => item.id === 'host-update');
    assert.deepEqual(row.gaps, [{ dimension: 'claude', state: 'stale', fix: row.fix.claude }]);
    assert.equal(readCache(home).host.reviewed.desktop, '2.37337.1', 'a report records nothing while the update is unreviewed');

    const reviewed = await runDoctor(['--home', home, '--cwd', project, '--host-reviewed'], {}, { spawn, fetch: noopFetch, host });
    assert.equal(reviewed.code, 0);
    assert.equal(reviewed.output, 'Recorded Claude Desktop 2.42304.0 and its Code tab CLI 2.1.299 as reviewed.\n');
    assert.deepEqual([readCache(home).host.reviewed.desktop, readCache(home).host.reviewed.code], ['2.42304.0', '2.1.299']);
    const after = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, host });
    assert.match(after.output, /^host-update\s+2\.42304\.0\s+ok\s+n\/a\s+n\/a\s+ok$/m);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// docs/FAILURES.md, cli-updated-itself: a tool of the stack that updated itself is seen at the next start of a
// session, not when a measurement is about to run on it.
test('a stack tool updated since the reviewed versions is stale, named by the hook, until --stack-reviewed records it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawnWith = (claude) => fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', claude: `${claude} (Claude Code)\n` }, gitToplevel: project, codexLogin: 'in' });
    const deps = (claude) => ({ spawn: spawnWith(claude), fetch: noopFetch, stackUpdate: true });

    const first = await runDoctor(['--home', home, '--cwd', project], {}, deps('2.1.296'));
    assert.match(first.output, /^stack-update\s+\d+ tools?\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
    const baseline = readCache(home).stack.reviewed.versions;
    assert.equal(baseline.claude, '2.1.296', 'the first reading is the reviewed one');
    assert.equal(baseline.codex, '0.130.0');
    assert.equal(baseline['gentle-ai'], undefined, 'gentle-ai has the gentle-ai-sync row');

    const table = await runDoctor(['--home', home, '--cwd', project], {}, deps('2.1.299'));
    assert.match(table.output, /^stack-update\s+stale\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
    const steps = [
      '  stack-update (installed):',
      '    claude 2.1.296 → 2.1.299 since the last review; review the update:',
      '    read the changelog of each tool between those versions',
      '    check that the hooks and commands of the harness that run them still work',
      '    say it to the user, and to whoever plans a measurement on the versions before',
      '    then record the review: js-harness doctor --stack-reviewed',
    ].join('\n');
    assert.ok(table.output.includes(`\n${steps}\n`), table.output);
    assert.equal(readCache(home).stack.reviewed.versions.claude, '2.1.296', 'a report records nothing while the update is unreviewed');

    const hook = await runDoctor(['--hook', '--home', home, '--cwd', project], {}, deps('2.1.299'));
    assert.match(JSON.parse(hook.output).systemMessage, /claude 2\.1\.296 → 2\.1\.299 since the last review/);

    const reviewed = await runDoctor(['--home', home, '--cwd', project, '--stack-reviewed'], {}, deps('2.1.299'));
    assert.equal(reviewed.code, 0);
    assert.match(reviewed.output, /^Recorded (.+, )?claude 2\.1\.299(, .+)? as reviewed\.\n$/);
    assert.equal(readCache(home).stack.reviewed.versions.claude, '2.1.299');
    const after = await runDoctor(['--home', home, '--cwd', project], {}, deps('2.1.299'));
    assert.match(after.output, /^stack-update\s+\d+ tools?\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--stack-reviewed keeps the reviewed version of a tool whose probe failed this time', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    writeCache(home, { ...readCache(home), stack: { reviewed: { versions: { claude: '2.1.290', codex: '0.120.0' }, at: '2026-10-09T00:00:00.000Z' } } });
    // The Claude CLI does not answer: only the codex update is reviewed, and claude's baseline stays for its own review.
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const reviewed = await runDoctor(['--home', home, '--cwd', project, '--stack-reviewed'], {}, { spawn, fetch: noopFetch, stackUpdate: true });
    assert.equal(reviewed.code, 0);
    const { versions } = readCache(home).stack.reviewed;
    assert.equal(versions.codex, '0.130.0');
    assert.equal(versions.claude, '2.1.290');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--stack-reviewed with no tool version read records nothing and exits 1; without the switch doctor shows no stack-update row', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const spawn = fakeSpawn({ gitToplevel: project });
    const errors = [];
    const original = console.error;
    console.error = (line) => errors.push(line);
    let refused;
    try {
      refused = await runDoctor(['--home', home, '--cwd', project, '--stack-reviewed'], {}, { spawn, fetch: noopFetch, stackUpdate: true });
    } finally {
      console.error = original;
    }
    assert.equal(refused.code, 1);
    assert.deepEqual(errors, ['js-harness doctor: could not read the version of any tool of the stack: nothing was recorded.']);
    assert.equal(readCache(home).stack, undefined);
    const plain = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.doesNotMatch(plain.output, /stack-update/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The host check is handed doctor's own home, so `--home` decides which app folder is read (gentle-ai review of
// PR 242), and `--host-reviewed --json` prints the record it wrote, for a caller that parses it.
test('the host check reads the home doctor was given, and --host-reviewed --json prints the recorded versions as JSON', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const homes = [];
    const host = (given) => {
      homes.push(given);
      return { found: true, desktop: '2.42304.0', staged: null, code: '2.1.299' };
    };
    const now = () => new Date('2026-10-15T23:00:00.000Z');

    await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, host, now });
    const recorded = await runDoctor(['--home', home, '--cwd', project, '--host-reviewed', '--json'], {}, { spawn, fetch: noopFetch, host, now });

    assert.deepEqual(homes, [home, home]);
    assert.equal(recorded.code, 0);
    const reviewed = { desktop: '2.42304.0', code: '2.1.299', at: '2026-10-15T23:00:00.000Z' };
    assert.deepEqual(JSON.parse(recorded.output), { reviewed });
    assert.deepEqual(readCache(home).host.reviewed, reviewed);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The gentle-ai-sync row (bin/lib/gentle-ai-update.mjs) is added only when the caller hands doctor the snapshot
// reader, as the dispatcher does; the version is the gentle-ai row's own.
test('a gentle-ai version since the reviewed one is stale with the CLAUDE.md diff step, until --gentle-ai-reviewed --json records it', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const homes = [];
    const snapshot = { at: '2026-10-16T04:45:56.400Z', dir: path.join(home, '.gentle-ai', 'backups', 'first'), entry: 'files/h/.claude/CLAUDE.md' };
    const gentleAiSnapshots = (given) => {
      homes.push(given);
      return [snapshot];
    };
    const now = () => new Date('2026-10-16T12:00:00.000Z');
    const deps = { spawn, fetch: noopFetch, gentleAiSnapshots, now };

    const baseline = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.match(baseline.output, /^gentle-ai-sync\s+3\.7\.0\s+ok\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.deepEqual(readCache(home).gentleAi.reviewed, { version: '3.7.0', at: '2026-10-16T12:00:00.000Z' });

    writeCache(home, { ...readCache(home), gentleAi: { reviewed: { version: '3.6.0', at: '2026-10-16T04:00:00.000Z' } } });
    const table = await runDoctor(['--home', home, '--cwd', project], {}, deps);
    assert.match(table.output, /^gentle-ai-sync\s+3\.7\.0\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
    const posix = (file) => file.replace(/\\/g, '/');
    const steps = [
      '  gentle-ai-sync (claude):',
      '    gentle-ai 3.6.0 → 3.7.0 since the last review; review the update:',
      '    read the gentle-ai release notes from 3.6.0 to 3.7.0 (https://github.com/Gentleman-Programming/gentle-ai/releases)',
      `    diff the global CLAUDE.md, which gentle-ai rewrites on sync, against its copy from before the first sync since the review: diff -u <(cd '${posix(snapshot.dir)}' && tar -xzOf snapshot.tar.gz 'files/h/.claude/CLAUDE.md') '${posix(path.join(home, '.claude', 'CLAUDE.md'))}'`,
      "    check each change against the project's AGENTS.md for conflicts: a rule that contradicts it, or a tool it mandates that this machine lacks",
      '    report the changes and any conflict to the user',
      '    then record the review: js-harness doctor --gentle-ai-reviewed',
    ].join('\n');
    assert.ok(table.output.includes(`\n${steps}\n`), table.output);
    assert.equal(readCache(home).gentleAi.reviewed.version, '3.6.0', 'a report records nothing while the update is unreviewed');

    const recorded = await runDoctor(['--home', home, '--cwd', project, '--gentle-ai-reviewed', '--json'], {}, deps);
    assert.equal(recorded.code, 0);
    assert.deepEqual(JSON.parse(recorded.output), { reviewed: { version: '3.7.0', at: '2026-10-16T12:00:00.000Z' } });
    const text = await runDoctor(['--home', home, '--cwd', project, '--gentle-ai-reviewed'], {}, deps);
    assert.equal(text.output, 'Recorded gentle-ai 3.7.0 as reviewed.\n');
    assert.match((await runDoctor(['--home', home, '--cwd', project], {}, deps)).output, /^gentle-ai-sync\s+3\.7\.0\s+ok/m);
    assert.deepEqual([...new Set(homes)], [home]);
    assert.ok(readCache(home).host === undefined, 'no host record is written without the host check');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--gentle-ai-reviewed with no readable gentle-ai version records nothing and exits 1; without the snapshot reader doctor shows no gentle-ai-sync row', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ gitToplevel: project, codexLogin: 'in' });
    const deps = { spawn, fetch: noopFetch, gentleAiSnapshots: () => [] };
    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--gentle-ai-reviewed'], {}, deps);
    assert.equal(code, 1);
    assert.equal(output, '');
    assert.deepEqual(errors, ['js-harness doctor: could not read the gentle-ai version: nothing was recorded.']);
    assert.equal('gentleAi' in readCache(home), false);

    const plain = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.doesNotMatch(plain.output, /gentle-ai-sync/);
    assert.equal('gentleAi' in readCache(home), false);
  } finally {
    console.error = original;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('--host-reviewed with no readable desktop version records nothing and exits 1; without the host check doctor shows no host row', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(line);
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' }, gitToplevel: project, codexLogin: 'in' });
    const host = () => ({ found: true, desktop: null, staged: null, code: '2.1.295' });
    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--host-reviewed'], {}, { spawn, fetch: noopFetch, host });
    assert.equal(code, 1);
    assert.equal(output, '');
    assert.deepEqual(errors, ['js-harness doctor: could not read the running Claude Desktop version: nothing was recorded.']);
    assert.equal('host' in readCache(home), false);

    const plain = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });
    assert.doesNotMatch(plain.output, /host-update/);
    assert.equal('host' in readCache(home), false);
  } finally {
    console.error = original;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The harness's own row (odd/tasks/rule-hierarchy.md, "Reach: the hash of the installed command (T16f, second part)").

/** A copy of `RULES` with the first unscoped rule that has a number one more, so its unscoped hash differs. */
function mainAhead(step = 1) {
  const target = RULES.find((rule) => rule.scope === undefined && typeof rule.value === 'number' && rule.retired === undefined);
  return { id: target.id, list: RULES.map((rule) => (rule.id === target.id ? { ...rule, value: rule.value + step } : rule)) };
}

test("doctorMain names an installed copy whose unscoped rules differ from main's, in the table, under Fix and in --json", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const { id, list } = mainAhead();
    const fetchImpl = async (url) => {
      if (url === MAIN_LIST_URL) return { ok: true, status: 200, text: async () => writeRules(list) };
      throw new Error('network disabled in tests');
    };

    const text = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });
    assert.match(text.output, new RegExp(`\\njs-harness\\s+${shippedRulesHash(RULES).slice(0, 8)}\\s+n/a\\s+n/a\\s+n/a\\s+outdated\\n`));
    assert.match(text.output, /\n {2}js-harness \(upToDate\):\n {4}the installed copy's unscoped rules differ from main's: install the newest copy \(npm i -g --allow-git=all github:jsaristi\/js-harness/);
    assert.match(text.output, new RegExp(`\\n {4}unscoped rules on main that differ: changed ${id}\\n`));

    const json = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });
    const row = JSON.parse(json.output).find((r) => r.id === 'js-harness');
    assert.equal(row.rulesHash, shippedRulesHash(RULES));
    assert.equal(row.mainRulesHash, shippedRulesHash(list));
    assert.deepEqual(row.differs.changed, [id]);
    assert.deepEqual(row.gaps.map((gap) => [gap.dimension, gap.state]), [['upToDate', 'outdated']]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("an online doctor asks for main's list while the latest versions are still being looked up, not after them", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    // Each lookup of a latest version waits for main's list to be asked, or gives up after a second: run one after
    // the other, every lookup gives up before main's list is asked.
    let mainAsked;
    const asked = new Promise((resolve) => { mainAsked = resolve; });
    const lookups = [];
    const fetchImpl = async (url) => {
      if (url === MAIN_LIST_URL) {
        mainAsked();
        return { ok: true, status: 200, text: async () => writeRules(RULES) };
      }
      let timer;
      const gaveUp = new Promise((resolve) => { timer = setTimeout(resolve, 1000, 'gave up'); });
      lookups.push(await Promise.race([asked.then(() => 'asked'), gaveUp]));
      clearTimeout(timer);
      throw new Error('network disabled in tests');
    };
    await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn, fetch: fetchImpl });
    assert.ok(lookups.length > 0, 'the run looked up no latest version, so it proves nothing');
    assert.deepEqual([...new Set(lookups)], ['asked']);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("doctor --offline and the hook read no main list outside the harness's checkout: the row is n/a and no request is made", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      throw new Error('network disabled in tests');
    };
    const offline = await runDoctor(['--home', home, '--cwd', project, '--offline', '--json'], {}, { spawn, fetch: fetchImpl });
    assert.equal(JSON.parse(offline.output).find((r) => r.id === 'js-harness').upToDate, 'n/a');
    await runDoctor(['--hook', '--home', home, '--cwd', project], {}, { spawn, fetch: fetchImpl });
    assert.ok(!urls.includes(MAIN_LIST_URL), urls.join(', '));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test("in the harness's checkout the hook tells a copy behind main once, and again when main moves", async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    fs.mkdirSync(path.join(project, 'bin', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(project, 'bin', 'lib', 'rules-data.mjs'), writeRules(RULES));
    let onMain = mainAhead(1).list;
    const base = fakeSpawn({
      versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' },
      gitToplevel: project,
      codexLogin: 'in',
    });
    const spawn = (cmd, args, opts) => {
      if (cmd === 'git' && args[0] === 'for-each-ref') return { status: 0, stdout: 'refs/remotes/origin/main abc\n', stderr: '' };
      if (cmd === 'git' && args[0] === 'show' && args[1] === 'origin/main:bin/lib/rules-data.mjs') return { status: 0, stdout: writeRules(onMain), stderr: '' };
      return base(cmd, args, opts);
    };
    const hook = () => runDoctor(['--hook', '--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch });

    const first = await hook();
    assert.match(first.output, /"systemMessage":"js-harness: 1 stack gap — run js-harness doctor"/);
    assert.doesNotMatch(first.output, new RegExp(shippedRulesHash(onMain)), 'the hash is in the digest, not in the notice');
    assert.equal((await hook()).output, '', 'the same main is told once');
    onMain = mainAhead(2).list;
    assert.match((await hook()).output, /1 stack gap/, 'a main that moved again is told again');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The memory-backup row (odd/tasks/memory-backup.md, D2): a backup that stopped is a gap, so the hook says so at the
// next session start; one never set up is no gap.
test('doctorMain shows the memory-backup row stale with its reason, and n/a where no backup was set up', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });
    const stale = () => ({ state: 'stale', fix: ['memory backup: last success never; last failure 2026-10-19T08:00:00.000Z: git push failed: run js-harness backup status'] });

    const { output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, backup: stale });
    assert.match(output, /^memory-backup\s+n\/a\s+stale\s+n\/a\s+n\/a\s+n\/a$/m);
    assert.ok(output.includes('git push failed: run js-harness backup status'), output);

    const off = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, backup: () => ({ state: 'n/a', fix: [] }) });
    assert.match(off.output, /^memory-backup\s+n\/a\s+n\/a\s+n\/a\s+n\/a\s+n\/a$/m);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The worktrees row (odd/tasks/land-unattended.md, T10): the worktrees on branches origin/main already holds, clean
// and idle, which no land removed, counted with the command that removes them. Counting asks a `git status` of each,
// so the hook, run at every session start, does not ask.
test('doctorMain shows the worktrees row stale, naming the command that removes them, when some are in main', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });
    const worktrees = () => [{ path: 'D:/w/one', branch: 'feat/one' }, { path: 'D:/w/two', branch: 'feat/two' }];

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, worktrees });

    assert.equal(code, 0);
    assert.match(output, /^worktrees\s+n\/a\s+n\/a\s+n\/a\s+stale\s+n\/a$/m);
    assert.ok(output.includes('  worktrees (project):\n    2 worktrees on branches origin/main holds, clean and idle: js-harness merge-queue --prune removes them\n    D:/w/one (feat/one)\n    D:/w/two (feat/two)\n'), output);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain shows the worktrees row ok with none, unknown when it cannot tell, and its hook never counts them', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    fs.mkdirSync(path.join(project, '.codegraph'));
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0', engram: 'engram 2.2.1', codegraph: '1.6.0' }, gitToplevel: project, codexLogin: 'in' });

    const none = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, worktrees: () => [] });
    assert.match(none.output, /^worktrees\s+n\/a\s+n\/a\s+n\/a\s+ok\s+n\/a$/m);
    assert.doesNotMatch(none.output, /^ {2}worktrees \(/m, 'no fix line for the worktrees row');

    const unread = await runDoctor(['--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, worktrees: () => null });
    assert.match(unread.output, /^worktrees\s+n\/a\s+n\/a\s+n\/a\s+unknown\s+n\/a$/m);

    let asked = false;
    const hook = await runDoctor(['--hook', '--home', home, '--cwd', project], {}, { spawn, fetch: noopFetch, worktrees: () => { asked = true; return [{ path: 'D:/w/one', branch: 'feat/one' }]; } });
    assert.equal(hook.code, 0);
    assert.equal(asked, false, 'the hook counted the worktrees');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
