import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { doctorMain } from './doctor.mjs';

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
 * one would outside a repo), and any version command named in `versions` to its stdout. Anything
 * else looks like a missing binary — never a real spawn, never the network. */
function fakeSpawn({ versions = {}, gitToplevel } = {}) {
  return (cmd, args) => {
    if (cmd === 'git' && args[0] === 'rev-parse') {
      return gitToplevel
        ? { status: 0, stdout: `${gitToplevel}\n`, stderr: '' }
        : { status: 128, stdout: '', stderr: 'not a git repository' };
    }
    if (versions[cmd]) return { status: 0, stdout: versions[cmd], stderr: '' };
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
    });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn });

    assert.equal(code, 0);
    for (const id of ['gentle-ai', 'engram', 'codegraph', 'context7', 'typescript-lsp']) {
      assert.match(output, new RegExp(id));
    }
    assert.match(output, /3\.7\.0/);
    assert.match(output, /hosted/);
    assert.doesNotMatch(output, /\nFix:/, 'a fully healthy fixture must report no gaps');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('doctorMain --json prints a parseable array with the five tool ids and upToDate unknown', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    seedHealthyHome(home);
    const spawn = fakeSpawn({ versions: { 'gentle-ai': 'gentle-ai 3.7.0' } });

    const { code, output } = await runDoctor(['--home', home, '--cwd', project, '--json'], {}, { spawn });

    assert.equal(code, 0);
    const rows = JSON.parse(output);
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

test('doctorMain names the fix commands for gaps and never recommends codegraph upgrade', async () => {
  const home = makeTmpHome();
  const project = makeTmpHome();
  try {
    // Empty home + no git repo: every dimension that applies is `missing`.
    const spawn = fakeSpawn({});

    const { code, output } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn });

    assert.equal(code, 0);
    assert.match(output, /Fix:/);
    assert.match(output, /codegraph: npm i -g @colbymchenry\/codegraph/);
    assert.doesNotMatch(output, /codegraph upgrade/);
    assert.match(output, /gentle-ai: gentle-ai upgrade/);
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
      { spawn },
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

    const { code, output } = await runDoctor(['--home', home, '--cwd', nested, '--json'], {}, { spawn });

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
    const { code } = await runDoctor(['--home', home, '--cwd', project], {}, { spawn });
    assert.equal(code, 0);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
