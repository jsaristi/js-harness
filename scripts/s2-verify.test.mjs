// The read-only verification of F8 S2's step 8 (scripts/s2-verify.mjs, odd/tasks/f8-s2-removal.md, T4), on fixture
// homes in the system's temp folder: one in the state the removal leaves passes every row, each row fails on a break
// planted for it alone, an engram that grew since the backup still passes, a fake context7 key never reaches any
// output, and the run changes no byte and no mtime of the home or the backup. Every process (claude, engram, reg,
// where) is a fake handed in, so nothing here runs a program or reads his machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROWS, verifyRemoval, firstDifference, main } from './s2-verify.mjs';

const SCRIPT = fileURLToPath(new URL('./s2-verify.mjs', import.meta.url));
const KEY = 'ctx7sk-FAKE-0123456789abcdef-never-printed';
const OTHER_KEY = 'ctx7sk-FAKE-fedcba9876543210-also-never';
const DENY = Array.from({ length: 24 }, (_, i) => `Bash(rm -rf /scratch-${i}:*)`);
const PERMISSIONS = { allow: ['Bash(git status:*)'], deny: DENY, defaultMode: 'bypassPermissions' };
const MCP = {
  engram: { type: 'stdio', command: 'engram', args: ['mcp', '--tools=agent'], env: {} },
  codegraph: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] },
  context7: { type: 'http', url: 'https://mcp.context7.com/mcp', headers: { CONTEXT7_API_KEY: KEY } },
};

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
};

const hook = (command) => ({ hooks: [{ type: 'command', command, timeout: 10 }] });

/** A home in the state the removal leaves, and the backup taken before it, under a fresh temp folder. */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-s2-verify-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const backup = path.join(root, 'backup');
  const ours = Array.from({ length: 15 }, (_, i) => hook(`js-harness hook-${i} --hook`));
  const kept = { SessionStart: [...ours.slice(0, 10), hook('codegraph hook session-start')], Stop: ours.slice(10) };
  write(path.join(home, '.claude', 'CLAUDE.md'), '# Global\n\n<!-- js-harness:rules -->\n## Rules\n- one\n<!-- /js-harness:rules -->\n');
  write(path.join(home, '.claude', 'settings.json'), {
    // Key order and the order of the denies differ from the backup's: neither is a difference.
    permissions: { defaultMode: 'bypassPermissions', deny: [...DENY].reverse(), allow: ['Bash(git status:*)'] },
    hooks: kept,
    outputStyle: 'js-harness',
  });
  // The backup holds the same hooks, beside gentle-ai's and Orca's, which leave.
  write(path.join(backup, 'roots', 'claude-config', 'settings.json'), { permissions: PERMISSIONS, hooks: { ...kept, PreToolUse: [hook('gentle-ai hook pre-tool'), hook('C:/Users/x/AppData/Roaming/orca/claude-hook.cmd')] } });
  write(path.join(home, '.claude.json'), { numStartups: 3, mcpServers: { context7: MCP.context7, codegraph: MCP.codegraph, engram: MCP.engram } });
  // js-harness's own skill names gentle-ai, and the machine manifest records it as installed.
  const protocols = path.join(home, '.claude', 'skills', 'js-harness-protocols', 'SKILL.md');
  write(protocols, '# Protocols\nA gentle-ai review is no longer offered.\n');
  write(path.join(home, '.claude', 'skills', 'graphify', 'SKILL.md'), '# graphify\n');
  fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true });
  write(path.join(home, '.claude', 'output-styles', 'plain.md'), '# Plain\n');
  write(path.join(home, '.js-harness', 'manifest.json'), { version: '0.97.0', files: [{ path: protocols, sha256: 'x' }], entries: [] });
  write(path.join(home, '.codex', 'AGENTS.md'), '# Codex\n<!-- js-harness:rules -->\n');
  write(path.join(home, '.codex', 'hooks.json'), { hooks: { SessionStart: [hook('js-harness resume --hook')], Stop: [hook('js-harness reply --hook')] } });
  fs.mkdirSync(path.join(home, '.codex', 'skills', '.system'), { recursive: true });
  write(path.join(home, '.codex', 'config.toml'), [
    'model = "gpt-5"', '[mcp_servers.node_repl]', 'command = "node"', '[mcp_servers.codegraph]', 'command = "codegraph"',
    '[mcp_servers.context7]', 'url = "https://mcp.context7.com/mcp"', '[mcp_servers.context7.http_headers]', `CONTEXT7_API_KEY = "${KEY}"`,
    '[mcp_servers.engram]', 'command = "engram"', '',
  ].join('\n'));
  // The backup's, in another order and with gentle-ai's section beside them: neither is a difference.
  write(path.join(backup, 'roots', 'codex-config', 'config.toml'), [
    'model = "gpt-5"', '[mcp_servers.engram]', 'command = "engram"', '', '[mcp_servers.gentle-ai]', 'command = "gentle-ai"',
    '[mcp_servers.context7]', 'url = "https://mcp.context7.com/mcp"', '[mcp_servers.context7.http_headers]', `CONTEXT7_API_KEY = "${KEY}"`,
    '[mcp_servers.codegraph]', 'command = "codegraph"', '',
  ].join('\n'));
  write(path.join(home, '.gemini', 'GEMINI.md'), '# Gemini\n');
  write(path.join(backup, 'manifest.json'), {
    schema: 'js-harness.stack-backup/v1', createdAt: '2026-11-02T21:00:00Z', home,
    roots: [{ id: 'claude', from: path.join(home, '.claude'), kind: 'config', present: true }],
    files: [{ root: 'claude', path: 'settings.json', bytes: 10, sha256: 'a'.repeat(64), secret: false }],
    links: [], exports: {}, named: { permissions: 'named/permissions.json', mcpClaude: 'named/mcp-claude.json' },
    engram: { observations: 3641 }, counts: { files: 1 },
  });
  write(path.join(backup, 'named', 'permissions.json'), PERMISSIONS);
  write(path.join(backup, 'named', 'mcp-claude.json'), MCP);
  return { root, home, backup, env: { LOCALAPPDATA: path.join(home, 'AppData', 'Local'), APPDATA: path.join(home, 'AppData', 'Roaming') } };
}

const CONNECTED = [
  'Checking MCP server health...', '',
  'engram: engram mcp --tools=agent - ✓ Connected',
  'codegraph: codegraph serve --mcp - ✓ Connected',
  'context7: https://mcp.context7.com/mcp (HTTP) - ✓ Connected', '',
].join('\n');

/** The four programs as fakes, each answering as the machine does after the removal; `over` replaces one answer. */
function fakeRun(over = {}) {
  const calls = [];
  const answers = {
    'engram search': { status: 0, stdout: 'Found 1 memories:\n\n[1] #6431 (manual) — F8 S2 restore drill marker 2026-11-02\n' },
    'engram stats': { status: 0, stdout: 'Engram Memory Stats\n  Sessions:     210\n  Observations: 3700\n  Prompts:      3\n' },
    'claude mcp': { status: 0, stdout: CONNECTED },
    where: { status: 1, stdout: '', stderr: 'INFO: Could not find files for the given pattern(s).\n' },
    reg: { status: 0, stdout: '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    C:\\Users\\x\\.local\\bin;C:\\Users\\x\\AppData\\Local\\engram\\bin\r\n\r\n' },
    ...over,
  };
  const run = (cmd, args, options = {}) => {
    calls.push({ cmd, args, env: options.env });
    const key = [`${cmd} ${args[0]}`, cmd].find((name) => name in answers);
    const answer = typeof answers[key] === 'function' ? answers[key](args) : answers[key];
    return { status: 0, stdout: '', stderr: '', ...answer };
  };
  return { run, calls };
}

const verify = (fx, over = {}, extra = {}) => verifyRemoval({ home: fx.home, env: fx.env, backup: fx.backup, platform: 'win32', deps: { run: fakeRun(over).run }, ...extra });
const failing = (result) => result.rows.filter((row) => !row.ok).map((row) => row.id);

/** Every file and folder under `dir`, each file by its bytes' hash and its mtime. */
function snapshot(dir) {
  const out = {};
  const visit = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) {
        out[full] = 'dir';
        visit(full);
      } else out[full] = `${createHash('sha256').update(fs.readFileSync(full)).digest('hex')} ${fs.statSync(full).mtimeMs}`;
    }
  };
  visit(dir);
  return out;
}

test('ROWS names the twelve rows of step 8, each once', () => {
  assert.deepEqual(ROWS, ['claude-md', 'hooks', 'permissions', 'mcp-claude', 'claude-dirs', 'codex', 'settings-owners', 'engram', 'gone', 'path', 'mcp-list', 'gemini']);
});

test('a home in the state the removal leaves passes every row, and the run starts only the four programs', (t) => {
  const fx = fixture(t);
  const fake = fakeRun();
  const result = verifyRemoval({ home: fx.home, env: fx.env, backup: fx.backup, platform: 'win32', deps: { run: fake.run } });
  assert.deepEqual(failing(result), [], JSON.stringify(result.rows, null, 2));
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((row) => row.id), ROWS);
  assert.match(result.rows.find((row) => row.id === 'hooks').said, /js-harness 15, codegraph 1/);
  assert.match(result.rows.find((row) => row.id === 'mcp-claude').said, /engram equal.*codegraph equal.*context7 equal/);
  assert.deepEqual([...new Set(fake.calls.map((call) => call.cmd))].sort(), ['claude', 'engram', 'reg', 'where']);
  assert.ok(fake.calls.every((call) => !call.args.includes('doctor')), 'doctor is never run: it writes its cache');
  const engram = fake.calls.find((call) => call.cmd === 'engram');
  assert.equal(engram.env.ENGRAM_DATA_DIR, path.join(fx.home, '.engram'), 'a home other than the running one is read through its own store');
  assert.deepEqual(fake.calls.filter((call) => call.cmd === 'where').map((call) => call.args[0]), ['gentle-ai', 'gga', 'orca', 'herdr']);
});

test('an engram that grew since the backup passes the engram row, and one that shrank fails it', (t) => {
  const fx = fixture(t);
  const grown = verify(fx, { 'engram stats': { status: 0, stdout: 'Sessions: 300\nObservations: 9999\nPrompts: 4\n' } });
  assert.equal(grown.rows.find((row) => row.id === 'engram').ok, true);
  const shrunk = verify(fx, { 'engram stats': { status: 0, stdout: 'Sessions: 300\nObservations: 3640\nPrompts: 4\n' } });
  assert.deepEqual(failing(shrunk), ['engram']);
  assert.match(shrunk.rows.find((row) => row.id === 'engram').said, /3640 .*3641/);
});

test('the marker and the id it must answer with can be named, and #64310 is not #6431', (t) => {
  const fx = fixture(t);
  const other = verify(fx, { 'engram search': (args) => ({ status: 0, stdout: args[1] === 'othermarker' ? '[1] #77 (manual) — x\n' : '' }) }, { marker: 'othermarker', expect: 77 });
  assert.equal(other.rows.find((row) => row.id === 'engram').ok, true);
  const near = verify(fx, { 'engram search': { status: 0, stdout: '[1] #64310 (manual) — x\n' } });
  assert.deepEqual(failing(near), ['engram']);
});

// Each row's own break: the fixture changed in one place, which only that row reads as a failure.
const BREAKS = {
  'claude-md': (fx) => fs.appendFileSync(path.join(fx.home, '.claude', 'CLAUDE.md'), '<!-- gentle-ai:persona -->\nx\n<!-- /gentle-ai:persona -->\n<!-- gentle-ai:engram-protocol -->\n'),
  hooks: (fx) => {
    const file = path.join(fx.home, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    settings.hooks.Stop.push(hook('C:/Users/x/.someone/agent-hooks/claude-hook.cmd || echo {} and a tail past sixty characters'));
    write(file, settings);
  },
  permissions: (fx) => {
    const file = path.join(fx.home, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    settings.permissions.deny.pop();
    write(file, settings);
  },
  'mcp-claude': (fx) => {
    const file = path.join(fx.home, '.claude.json');
    const claude = JSON.parse(fs.readFileSync(file, 'utf8'));
    claude.mcpServers.context7.headers.CONTEXT7_API_KEY = OTHER_KEY;
    write(file, claude);
  },
  'claude-dirs': (fx) => write(path.join(fx.home, '.claude', 'skills', 'sdd-apply', 'SKILL.md'), '# Apply\nBy the Gentleman Programming team.\n'),
  codex: (fx) => fs.mkdirSync(path.join(fx.home, '.codex', 'skills', 'judgment-day'), { recursive: true }),
  'settings-owners': (fx) => write(path.join(fx.home, '.codex', 'hooks.json'), { hooks: { UserPromptSubmit: [hook('pwsh -File C:/x/skill-registry/refresh.ps1')] } }),
  engram: () => ({ 'engram search': { status: 0, stdout: 'No memories found for: "s2drillmarker20261102"\n' } }),
  gone: (fx) => fs.mkdirSync(path.join(fx.home, '.gentle-ai'), { recursive: true }),
  path: () => ({ reg: { status: 0, stdout: 'HKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    C:\\a;C:\\Users\\x\\AppData\\Local\\Programs\\orca\\resources\\bin;C:\\b\r\n' } }),
  'mcp-list': () => ({ 'claude mcp': { status: 0, stdout: CONNECTED.replace('(HTTP) - ✓ Connected', '(HTTP) - ✗ Failed to connect') } }),
  gemini: (fx) => fs.appendFileSync(path.join(fx.home, '.gemini', 'GEMINI.md'), '<!-- gentle-ai:persona -->\n'),
};

for (const id of ROWS) {
  test(`the ${id} row fails on its own planted break, and no other row does`, (t) => {
    const fx = fixture(t);
    const over = BREAKS[id](fx) ?? {};
    const result = verify(fx, over);
    assert.deepEqual(failing(result), [id], JSON.stringify(result.rows, null, 2));
    assert.equal(result.ok, false);
  });
}

test('each failure says what it found by name, count or key path', (t) => {
  const fx = fixture(t);
  const said = (id, over) => verify(fx, over).rows.find((row) => row.id === id).said;
  for (const id of ['claude-md', 'hooks', 'permissions', 'claude-dirs', 'codex', 'settings-owners', 'gone', 'gemini']) BREAKS[id](fx);
  assert.match(said('claude-md'), /2 gentle-ai markers/);
  assert.match(said('hooks'), /C:\/Users\/x\/\.someone\/agent-hooks\/claude-hook\.cmd \|\| echo \{\} a(?!nd)/);
  assert.match(said('permissions'), /differs at permissions\.deny \(1 missing, 0 extra\)/);
  assert.match(said('claude-dirs'), /skills[\\/]sdd-apply[\\/]SKILL\.md/);
  assert.match(said('codex'), /judgment-day/);
  assert.match(said('settings-owners'), /skill-registry/);
  assert.match(said('gone'), /\.gentle-ai/);
  assert.match(said('gemini'), /1 gentle-ai marker/);
  assert.match(said('path', BREAKS.path()), /orca/);
  assert.match(said('mcp-list', BREAKS['mcp-list']()), /context7 not connected/);
  assert.match(said('gone', { where: (args) => (args[0] === 'gga' ? { status: 0, stdout: 'C:\\Users\\x\\bin\\gga.cmd\r\n' } : { status: 1 }) }), /where finds gga/);
});

test('the gone row fails on each data folder Orca or herdr may leave behind', (t) => {
  for (const [base, name] of [['', '.orca'], ['APPDATA', 'orca'], ['LOCALAPPDATA', 'orca-updater'], ['APPDATA', 'herdr'], ['LOCALAPPDATA', 'herdr']]) {
    const fx = fixture(t);
    const folder = path.join(base ? fx.env[base] : fx.home, name);
    fs.mkdirSync(folder, { recursive: true });
    const gone = verify(fx).rows.find((row) => row.id === 'gone');
    assert.equal(gone.ok, false, folder);
    assert.ok(gone.said.includes(folder), gone.said);
  }
});

test('the claude-dirs row fails on gentle-ai\'s style and gentleman.md, whatever they hold, and on a name that says gentle-ai', (t) => {
  for (const plant of [
    (fx) => write(path.join(fx.home, '.claude', 'output-styles', 'Neutral.md'), '# Neutral\n'),
    (fx) => write(path.join(fx.home, '.claude', 'agents', 'gentleman.md'), '# an agent\n'),
    (fx) => write(path.join(fx.home, '.claude', 'skills', 'gentle-ai-sdd', 'notes.txt'), 'nothing\n'),
  ]) {
    const fx = fixture(t);
    plant(fx);
    assert.deepEqual(failing(verify(fx)), ['claude-dirs']);
  }
});

test('the codex row fails on a gentle-ai marker, a herdr hook or a section gone from config.toml', (t) => {
  const plants = [
    (fx) => fs.appendFileSync(path.join(fx.home, '.codex', 'AGENTS.md'), '<!-- gentle-ai:persona -->\n'),
    (fx) => write(path.join(fx.home, '.codex', 'hooks.json'), { hooks: { Stop: [hook('C:/Users/x/.herdr/herdr-agent-state.ps1')] } }),
    (fx) => {
      const file = path.join(fx.home, '.codex', 'config.toml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('[mcp_servers.engram]', '[other.engram]'));
    },
  ];
  for (const plant of plants) {
    const fx = fixture(t);
    plant(fx);
    assert.ok(failing(verify(fx)).includes('codex'));
  }
});

test('the hooks row fails when a hook the backup held for js-harness or codegraph is gone, or none was backed up', (t) => {
  // Codex P2 on 84997f7..0b9f98a: a settings.json with no hooks passed as `js-harness 0, codegraph 0`.
  const plants = [
    (fx) => write(path.join(fx.home, '.claude', 'settings.json'), { permissions: PERMISSIONS, outputStyle: 'js-harness' }),
    (fx) => {
      const file = path.join(fx.home, '.claude', 'settings.json');
      const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter((group) => !group.hooks[0].command.startsWith('codegraph'));
      write(file, settings);
    },
    (fx) => fs.rmSync(path.join(fx.backup, 'roots', 'claude-config', 'settings.json')),
  ];
  const said = plants.map((plant) => {
    const fx = fixture(t);
    plant(fx);
    const result = verify(fx);
    assert.deepEqual(failing(result), ['hooks']);
    return result.rows.find((row) => row.id === 'hooks').said;
  });
  assert.match(said[0], /16 hooks the backup held for js-harness or codegraph are gone, first SessionStart js-harness hook-0/);
  assert.match(said[1], /1 hook the backup held for js-harness or codegraph is gone, first SessionStart codegraph hook session-start/);
  assert.match(said[2], /the backup's settings\.json missing/);
});

test('the codex row fails when a complement\'s entry in config.toml differs from the backup\'s, and never prints its key', (t) => {
  // Codex P2 on 84997f7..0b9f98a: the three headers alone passed with context7's key lost or a command changed.
  const plants = [
    (fx) => {
      const file = path.join(fx.home, '.codex', 'config.toml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(KEY, OTHER_KEY));
    },
    (fx) => {
      const file = path.join(fx.home, '.codex', 'config.toml');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('command = "codegraph"', 'command = "codegraph-old"'));
    },
  ];
  const said = plants.map((plant) => {
    const fx = fixture(t);
    plant(fx);
    const result = verify(fx);
    assert.deepEqual(failing(result), ['codex']);
    return result.rows.find((row) => row.id === 'codex').said;
  });
  assert.match(said[0], /\[mcp_servers\.context7\] differs from the backup's/);
  assert.match(said[1], /\[mcp_servers\.codegraph\] differs from the backup's/);
  for (const text of said) assert.ok(!text.includes(KEY) && !text.includes(OTHER_KEY), 'a key reached the output');
});

test('a home with no GEMINI.md passes the gemini row, and an entry missing from .claude.json fails the mcp-claude row', (t) => {
  const fx = fixture(t);
  fs.rmSync(path.join(fx.home, '.gemini'), { recursive: true });
  assert.deepEqual(failing(verify(fx)), []);
  const file = path.join(fx.home, '.claude.json');
  const claude = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete claude.mcpServers.engram;
  write(file, claude);
  const result = verify(fx, { 'claude mcp': { status: 0, stdout: CONNECTED.replace(/^engram:.*$/m, '') } });
  assert.deepEqual(failing(result), ['mcp-claude', 'mcp-list']);
  assert.match(result.rows.find((row) => row.id === 'mcp-claude').said, /engram missing/);
  assert.match(result.rows.find((row) => row.id === 'mcp-list').said, /engram not listed/);
});

test('firstDifference names the first key path that differs, arrays as sets only when asked', () => {
  assert.equal(firstDifference({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }), null);
  assert.equal(firstDifference({ a: { b: 'x' } }, { a: { b: 'y' } }, 'top'), 'top.a.b');
  assert.equal(firstDifference({ a: 1 }, { a: 1, z: 2 }), 'z');
  assert.equal(firstDifference({ args: ['a', 'b'] }, { args: ['b', 'a'] }), 'args[0]');
  assert.equal(firstDifference({ args: ['a', 'b'] }, { args: ['b', 'a'] }, '', { sets: true }), null);
  assert.equal(firstDifference({ deny: ['a', 'b'] }, { deny: ['a', 'c', 'd'] }, '', { sets: true }), 'deny (1 missing, 2 extra)');
  assert.equal(firstDifference([1], { 0: 1 }, 'x'), 'x');
});

test('the fake key in .claude.json and the backup never reaches any output, even when context7 differs', (t) => {
  const fx = fixture(t);
  BREAKS['mcp-claude'](fx);
  const out = [];
  const stream = { write: (text) => out.push(String(text)) };
  const code = main(['--backup', fx.backup, '--home', fx.home], { run: fakeRun(BREAKS['mcp-list']()).run, platform: 'win32', stdout: stream, stderr: stream, env: {} });
  const text = out.join('');
  assert.equal(code, 1);
  assert.match(text, /FAIL mcp-claude: .*context7 differs at headers\.CONTEXT7_API_KEY/);
  assert.ok(!text.includes(KEY) && !text.includes(OTHER_KEY), 'a key was printed');
  assert.ok(!text.includes('ctx7sk'), 'part of a key was printed');
  // A .claude.json that does not parse is named, never quoted: Node's message quotes the text around the error.
  fs.writeFileSync(path.join(fx.home, '.claude.json'), `{"mcpServers": {"context7": {"headers": {"K": "${KEY}"}} oops`);
  out.length = 0;
  main(['--backup', fx.backup, '--home', fx.home], { run: fakeRun().run, platform: 'win32', stdout: stream, stderr: stream, env: {} });
  assert.match(out.join(''), /FAIL mcp-claude: .*not valid JSON/);
  assert.ok(!out.join('').includes('ctx7sk'), 'part of a key was printed');
});

test('a run changes no byte and no mtime of the home or the backup, failing rows included', (t) => {
  const fx = fixture(t);
  BREAKS['claude-dirs'](fx);
  BREAKS.hooks(fx);
  const before = snapshot(fx.root);
  const out = { write: () => {} };
  main(['--backup', fx.backup, '--home', fx.home], { run: fakeRun().run, platform: 'win32', stdout: out, stderr: out, env: {} });
  assert.deepEqual(snapshot(fx.root), before);
});

test('main prints one line per row and exits 0 when every row passes', (t) => {
  const fx = fixture(t);
  const out = [];
  const code = main(['--backup', fx.backup, '--home', fx.home, '--marker', 's2drillmarker20261102', '--expect', '6431'], { run: fakeRun().run, platform: 'win32', stdout: { write: (text) => out.push(text) }, stderr: { write: (text) => out.push(text) }, env: {} });
  assert.equal(code, 0, out.join(''));
  const lines = out.join('').trim().split('\n');
  assert.equal(lines.length, ROWS.length);
  ROWS.forEach((id, i) => assert.match(lines[i], new RegExp(`^ok   ${id}: `)));
});

test('the command refuses an unknown argument, a missing --backup and a folder with no backup with exit 2', (t) => {
  const fx = fixture(t);
  const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 30_000 });
  const unknown = cli('--backup', fx.backup, '--no-such-flag');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /^unknown argument: --no-such-flag$/m);
  const none = cli('--home', fx.home);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--backup <dir> is required/);
  const empty = cli('--backup', fx.home, '--home', fx.home);
  assert.equal(empty.status, 2);
  assert.match(empty.stderr, /holds no stack backup/);
  const id = cli('--backup', fx.backup, '--expect', 'six');
  assert.equal(id.status, 2);
});
