import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';
import { readCache } from './lib/cache.mjs';
import { recordOptionalFile } from './lib/manifest.mjs';
import { launcherFileName, loginLauncher, remoteFiles, remoteId } from './lib/remote.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-doctor-hook-home-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// The hook path never touches the network in these tests: a resolved-but-unsuccessful fetch is
// enough to exercise "the cache was stale, a fetch was attempted, and it did not help" without
// depending on the internet.
const failFetch = async () => ({ ok: false });

function fakeSpawnMissing() {
  return () => ({ status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' });
}

/** A fully "healthy" fixture home, matching doctor.test.mjs's own — every tool installed and
 * configured everywhere it applies, so the report has zero gaps. */
function seedHealthyHome(home, project) {
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
  fs.mkdirSync(path.join(project, '.codegraph'), { recursive: true });
}

/** A healthy spawn: every tool answers its version, the Codex CLI is installed and logged in. `codexCli: false` has no
 * Codex CLI at all (`codex --version` and the login probe find no binary). */
function healthySpawn(project, { codexCli = true } = {}) {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') return { status: 0, stdout: `${project}\n`, stderr: '' };
    const line = [cmd, ...args].join(' ');
    if (codexCli && line === 'codex --version') return { status: 0, stdout: 'codex-cli 0.130.0\n', stderr: '' };
    // The Codex login probe (`codex login status`): logged in.
    if (codexCli && line === 'codex login status') return { status: 0, stdout: 'Logged in\n', stderr: '' };
    // On win32 a probe arrives as one shell command line ("codegraph --version"), so match its binary.
    const binary = cmd.split(' ')[0];
    if (['gentle-ai', 'engram', 'codegraph'].includes(binary)) return { status: 0, stdout: `${binary} 9.9.9\n`, stderr: '' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '', stderr: '' };
  };
}

async function runHook(argv, env, deps) {
  let stdout = '';
  let stderr = '';
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line) => {
    stdout += `${line}\n`;
  };
  console.error = (line) => {
    stderr += `${line}\n`;
  };
  try {
    const code = await doctorMain(argv, env, deps);
    return { code, stdout, stderr };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('doctor --hook prints one systemMessage line with the gap count on the first run with gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: every applicable dimension is `missing`, so there are gaps.
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch },
    );

    assert.equal(code, 0);
    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout.trim());
    assert.match(parsed.systemMessage, /^js-harness: \d+ stack gaps? — run js-harness doctor$/);

    const cache = readCache(home);
    assert.ok(cache.notified);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints nothing on a second run with the same gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = { spawn: fakeSpawnMissing(), fetch: failFetch };
    const first = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.ok(first.stdout.trim().length > 0);

    const second = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.equal(second.code, 0);
    assert.equal(second.stdout, '');
    assert.equal(second.stderr, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints again when the gaps change', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    const deps = { spawn: fakeSpawnMissing(), fetch: failFetch };
    const first = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.ok(first.stdout.trim().length > 0);

    // Close one gap: register gentle-ai for both hosts, changing the gap list and its digest.
    writeJson(path.join(home, '.gentle-ai', 'state.json'), { installed_agents: ['claude-code', 'codex'] });

    const second = await runHook(['--hook', '--home', home, '--cwd', project], {}, deps);
    assert.equal(second.code, 0);
    assert.ok(second.stdout.trim().length > 0);
    assert.notEqual(second.stdout, first.stdout);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook prints nothing and stores an empty digest when there are no gaps', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () => (url.includes('registry.npmjs.org') ? { version: '0.0.1' } : { tag_name: 'v0.0.1' }),
    });

    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: healthySpawn(project), fetch: fetchImpl },
    );

    assert.equal(code, 0);
    assert.equal(stdout, '');
    assert.equal(stderr, '');
    const cache = readCache(home);
    assert.equal(cache.notified, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The Claude account check: accounts that differ are a gap like any other, notified once.

const CLI_ACCOUNT = '11111111-aaaa-4bbb-8ccc-000000000001';
const APP_ACCOUNT = '22222222-dddd-4eee-8fff-000000000002';

/** Adds the two account identifiers to a seeded home: the CLI's in `~/.claude.json`, beside what is there, and
 * the desktop app's in its Windows config (the tests pass `platform: 'win32'`, so that is the place read). */
function seedAccounts(home, { cli, app }) {
  const claudeJson = path.join(home, '.claude.json');
  writeJson(claudeJson, { ...JSON.parse(fs.readFileSync(claudeJson, 'utf8')), oauthAccount: { accountUuid: cli } });
  writeJson(path.join(home, 'AppData', 'Roaming', 'Claude', 'config.json'), { lastKnownAccountUuid: app });
}

test('doctor --hook notifies once when the CLI and the desktop app are signed into different accounts, and never names them', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    seedAccounts(home, { cli: CLI_ACCOUNT, app: APP_ACCOUNT });
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () => (url.includes('registry.npmjs.org') ? { version: '0.0.1' } : { tag_name: 'v0.0.1' }),
    });
    const deps = { spawn: healthySpawn(project), fetch: fetchImpl, platform: 'win32' };
    const argv = ['--hook', '--home', home, '--cwd', project];

    const first = await runHook(argv, {}, deps);
    assert.equal(first.code, 0);
    assert.equal(first.stderr, '');
    assert.deepEqual(JSON.parse(first.stdout), { systemMessage: 'js-harness: 1 stack gap — run js-harness doctor' });

    const second = await runHook(argv, {}, deps);
    assert.equal(second.stdout, '', 'the same gap is not notified twice');

    const cacheText = fs.readFileSync(path.join(home, '.js-harness', 'doctor.json'), 'utf8');
    for (const identifier of [CLI_ACCOUNT, APP_ACCOUNT]) {
      assert.equal(`${first.stdout}${cacheText}`.includes(identifier), false, 'neither the message nor the cache holds an account identifier');
    }

    // Signed into the same account again: no gap is left, and the stored digest is the empty one.
    seedAccounts(home, { cli: APP_ACCOUNT, app: APP_ACCOUNT });
    const third = await runHook(argv, {}, deps);
    assert.equal(third.stdout, '');
    assert.equal(readCache(home).notified, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The remote server check: a recorded login launcher whose server is not running is a gap like any other.

test('doctor --hook notifies once when a recorded launcher\'s server is down, and stores the empty digest once it runs again', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    // What `remote start --at-login` leaves: the launcher, recorded by its path, here for a project that is only named.
    const root = 'D:\\work\\proj';
    const launcher = path.join(home, 'Startup', launcherFileName(remoteId(root, 'win32')));
    const content = loginLauncher({ node: 'C:\\node\\node.exe', script: 'D:\\js-harness\\bin\\remote.mjs', root, name: 'proj' });
    fs.mkdirSync(path.dirname(launcher), { recursive: true });
    fs.writeFileSync(launcher, content);
    recordOptionalFile(home, launcher, content);
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () => (url.includes('registry.npmjs.org') ? { version: '0.0.1' } : { tag_name: 'v0.0.1' }),
    });
    // The process snapshot lists the supervisor the state file will name; every other program is the healthy one.
    const snapshots = [];
    const healthy = healthySpawn(project);
    const spawn = (cmd, args, opts) => {
      if (cmd !== 'powershell') return healthy(cmd, args, opts);
      snapshots.push(args);
      return { status: 0, stdout: '4\t0\t1\tSystem\r\n4242\t4\t1759700000000\tnode.exe\r\n', stderr: '' };
    };
    const deps = { spawn, fetch: fetchImpl, platform: 'win32' };
    const argv = ['--hook', '--home', home, '--cwd', project];

    const first = await runHook(argv, {}, deps);
    assert.equal(first.code, 0);
    assert.equal(first.stderr, '');
    assert.deepEqual(JSON.parse(first.stdout), { systemMessage: 'js-harness: 1 stack gap — run js-harness doctor' });
    assert.equal(snapshots.length, 0, 'with no state file there is no process to look up: a session start pays nothing for it');

    const second = await runHook(argv, {}, deps);
    assert.equal(second.stdout, '', 'the same gap is not notified twice');

    // `remote start` ran: the state file names a supervisor that the snapshot shows, by pid and creation time.
    writeJson(remoteFiles(home, remoteId(root, 'win32')).statePath, { pid: 4242, startedAt: 1759700000000 });
    const third = await runHook(argv, {}, deps);
    assert.equal(third.stdout, '');
    assert.equal(readCache(home).notified, '');
    assert.equal(snapshots.length, 1, 'one look, for the one recorded supervisor');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// R3-001 (accepted T6b review follow-up): a fix may be a list of commands, and the hook must not
// care — its message only counts gaps, so one report carrying a list fix (gentle-ai `upToDate`, a major
// behind) and a one-step fix (codex `installed`, no Codex CLI) is still exactly one well-formed count line.
test('doctor --hook prints one well-formed count line for a report whose gaps have list fixes', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () =>
        url.includes('registry.npmjs.org')
          ? { version: '0.0.1' }
          : { tag_name: url.includes('Gentleman-Programming/gentle-ai') ? 'v99.0.0' : 'v0.0.1' },
    });

    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: healthySpawn(project, { codexCli: false }), fetch: fetchImpl },
    );

    assert.equal(code, 0);
    assert.equal(stderr, '');
    assert.equal(stdout.split('\n').filter(Boolean).length, 1, 'exactly one line on stdout');
    assert.deepEqual(JSON.parse(stdout), { systemMessage: 'js-harness: 2 stack gaps — run js-harness doctor' });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// R3-101 (accepted T2/T3 review follow-up) made `writeCache` itself best-effort, so a `--home`
// that is a file no longer throws there — the hook now computes and reports its (very real: an
// unreadable home reads every dimension as missing) gaps normally instead of going silent.
test('doctor --hook still reports gaps and exits 0 when the cache cannot be written (home is a file)', async () => {
  const parentDir = makeTmpHome();
  const home = path.join(parentDir, 'not-a-directory');
  fs.writeFileSync(home, '', 'utf8');
  const project = makeTmpHome();
  try {
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch },
    );
    assert.equal(code, 0);
    const parsed = JSON.parse(stdout.trim());
    assert.match(parsed.systemMessage, /^js-harness: \d+ stack gaps? — run js-harness doctor$/);
    assert.equal(stderr, '');
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook exits 0 with empty stdout and stderr even when something inside throws', async () => {
  // An injected `now()` that throws simulates a genuinely unexpected internal failure (as opposed
  // to a probe's own documented fail-open path), reaching hookMain's outer catch-all — the backstop
  // T3 added so a `SessionStart` hook can never break a session, no matter what throws underneath.
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // `isStale` only calls `now()` once it has a real checkedAt to compare against.
    writeJson(path.join(home, '.js-harness', 'doctor.json'), {
      latest: { checkedAt: new Date().toISOString(), versions: {} },
      notified: null,
    });
    const throwingNow = () => {
      throw new Error('clock unavailable');
    };
    const { code, stdout, stderr } = await runHook(
      ['--hook', '--home', home, '--cwd', project],
      {},
      { spawn: fakeSpawnMissing(), fetch: failFetch, now: throwingNow },
    );
    assert.equal(code, 0);
    assert.equal(stdout, '');
    assert.equal(stderr, '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctor --hook exits 0 with empty stdout and stderr even on unusable arguments', async () => {
  const { code, stdout, stderr } = await runHook(['--hook', '--home'], {}, { fetch: failFetch });
  assert.equal(code, 0);
  assert.equal(stdout, '');
  assert.equal(stderr, '');
});

test('doctor --hook starts no copy of js-harness for the hook commands its manifest records, the session-start report keeping its cost', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    writeJson(path.join(home, '.js-harness', 'manifest.json'), {
      version: '0.1.0',
      files: [],
      entries: [
        {
          path: path.join(home, '.claude', 'settings.json'),
          pointer: ['hooks', 'SessionStart'],
          entry: { hooks: [{ type: 'command', command: 'js-harness resume --hook' }] },
          createdFile: false,
          skipped: false,
        },
        {
          path: path.join(home, '.claude', 'settings.json'),
          pointer: ['hooks', 'PostToolUse'],
          entry: { hooks: [{ type: 'command', command: 'js-harness resume --pause || exit 0' }] },
          createdFile: false,
          skipped: false,
        },
      ],
    });
    const missing = fakeSpawnMissing();
    const ran = [];
    const spawn = (cmd, args, opts) => {
      ran.push([cmd, ...args].join(' '));
      return missing(cmd, args, opts);
    };
    await runHook(['--hook', '--home', home, '--cwd', project], {}, { spawn, fetch: failFetch });
    assert.deepEqual(
      ran.filter((line) => line.includes('resume')),
      [],
      'no recorded js-harness resume command is run by the session-start report',
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

// The host-update row (bin/lib/host-update.mjs) is added when the caller hands doctor the host check, as the
// dispatcher does. Its notice stays a `systemMessage` (zero model tokens) and names the update after the usual text.
test('doctor --hook names a host update since the last review and a downloaded version not applied, once', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home, project);
    const fetchImpl = async (url) => ({
      ok: true,
      json: async () => (url.includes('registry.npmjs.org') ? { version: '0.0.1' } : { tag_name: 'v0.0.1' }),
    });
    let versions = { found: true, desktop: '2.37337.1', staged: null, code: '2.1.295' };
    const deps = { spawn: healthySpawn(project), fetch: fetchImpl, platform: 'win32', host: () => versions };
    const argv = ['--hook', '--home', home, '--cwd', project];

    const baseline = await runHook(argv, {}, deps);
    assert.equal(baseline.stdout, '', 'the first reading is the reviewed baseline: no gap, no notice');
    const { at } = readCache(home).host.reviewed;
    assert.deepEqual(readCache(home).host.reviewed, { desktop: '2.37337.1', code: '2.1.295', at });

    versions = { found: true, desktop: '2.37337.1', staged: '2.42304.0', code: '2.1.295' };
    const staged = await runHook(argv, {}, deps);
    assert.deepEqual(JSON.parse(staged.stdout), { systemMessage: 'js-harness: 1 stack gap — run js-harness doctor (Claude Desktop 2.42304.0 is downloaded and not applied)' });

    versions = { found: true, desktop: '2.42304.0', staged: '2.42304.0', code: '2.1.299' };
    const updated = await runHook(argv, {}, deps);
    assert.equal(updated.code, 0);
    assert.equal(updated.stderr, '');
    assert.deepEqual(JSON.parse(updated.stdout), { systemMessage: 'js-harness: 1 stack gap — run js-harness doctor (Claude Desktop 2.37337.1 → 2.42304.0 and its Code tab CLI 2.1.295 → 2.1.299 since the last review)' });
    assert.equal((await runHook(argv, {}, deps)).stdout, '', 'the same update is not notified twice');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
