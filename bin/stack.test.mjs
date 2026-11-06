import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stackMain, readStack, resolveStackPm } from './stack.mjs';
import { plainCount } from './lib/stack-backup-walk.mjs';

const ON = { codeMap: { value: 'auto' }, codexReview: { value: 'on' }, languageServer: { value: 'on' } };

function row(id, cells = {}) {
  return { id, version: '1.0.0', installed: 'ok', claude: 'ok', codex: 'ok', project: 'n/a', upToDate: 'ok', fix: { installed: `fix ${id}`, claude: `claude fix ${id}`, codex: `codex fix ${id}` }, ...cells };
}

function stack(overrides = {}, prerequisites = [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }]) {
  const rows = ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex'].map((id) => row(id, overrides[id]));
  return () => ({ rows, functions: ON, prerequisites });
}

/** Runs `stackMain` with its output captured. */
async function run(argv, deps, env = { JS_HARNESS_PM: 'pnpm' }) {
  const out = [];
  const err = [];
  const code = await stackMain(argv, env, { ...deps, platform: 'linux', log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('stack with nothing missing says so and exits 0', async () => {
  const { code, out } = await run([], { read: stack() });
  assert.equal(code, 0);
  assert.match(out, /nothing the harness requires is missing/);
});

test('stack lists each install with its command and its undo, and exits 1', async () => {
  const { code, out } = await run([], { read: stack({ codegraph: { installed: 'missing', claude: 'missing' } }) });
  assert.equal(code, 1);
  assert.match(out, /run: {2}pnpm add -g @colbymchenry\/codegraph/);
  assert.match(out, /undo: pnpm remove -g @colbymchenry\/codegraph/);
  assert.match(out, /run: {2}claude mcp add -s user codegraph -- codegraph serve --mcp/);
  assert.ok(out.indexOf('@colbymchenry/codegraph') < out.indexOf('claude mcp add'), 'the install comes before the registration');
});

test('stack names his own steps and exits 1 when only they are left', async () => {
  const { code, out } = await run([], { read: stack({ engram: { claude: 'missing', fix: { claude: 'engram setup claude-code' } } }) });
  assert.equal(code, 1);
  assert.match(out, /Your steps \(never run\)/);
  assert.match(out, /engram setup claude-code/);
  assert.match(out, /undo: claude plugin uninstall engram@engram/);
});

test('optional gaps alone exit 0', async () => {
  const { code, out } = await run([], { read: stack({ 'typescript-lsp': { installed: 'missing', codex: 'n/a' } }) });
  assert.equal(code, 0);
  assert.match(out, /Optional \(never run\)/);
  assert.match(out, /fix typescript-lsp/);
});

// F8 S11, S7 (odd/tasks/f8-s11-complements.md): on a home with none of the complements, each one is listed with a
// command of its own and an undo, and nothing names gentle-ai. The fixes are doctor's real ones.
test('a home with no complement lists engram, its plugin, codegraph and context7, each with its own command and undo', async () => {
  const { tools } = await import('./lib/stack.mjs');
  const real = (id) => tools.find((tool) => tool.id === id).fix({ project: '/p', env: { JS_HARNESS_PM: 'pnpm' }, platform: 'linux' });
  const none = { installed: 'missing', claude: 'missing', codex: 'missing' };
  const { code, out } = await run([], {
    read: stack({
      engram: { ...none, fix: real('engram') },
      'engram-plugin': { ...none, codex: 'n/a', fix: real('engram-plugin') },
      codegraph: { ...none, fix: real('codegraph') },
      context7: { ...none, fix: real('context7') },
    }),
  });
  assert.equal(code, 1);
  assert.doesNotMatch(out, /gentle-ai/);
  for (const [tool, command, undo] of [
    ['engram', /engram setup codex/, /undo: codex mcp remove engram/],
    ['engram-plugin', /engram setup claude-code/, /undo: claude plugin marketplace remove engram/],
    ['codegraph', /run: {2}pnpm add -g @colbymchenry\/codegraph/, /undo: pnpm remove -g @colbymchenry\/codegraph/],
    ['context7', /run: {2}claude mcp add -s user --transport http context7 https:\/\/mcp\.context7\.com\/mcp/, /undo: claude mcp remove -s user context7/],
  ]) {
    assert.match(out, command, tool);
    assert.match(out, undo, tool);
  }
});

test('stack --json prints the plan in the shape onboarding reads', async () => {
  const { code, out } = await run(['--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) });
  assert.equal(code, 1);
  const plan = JSON.parse(out);
  assert.deepEqual(Object.keys(plan), ['mandatory', 'manual', 'optional']);
  assert.deepEqual(plan.mandatory, [{ tool: 'codex', dimension: 'installed', kind: 'package', bin: 'codex', run: ['pnpm', 'add', '-g', '@openai/codex'], undo: ['pnpm', 'remove', '-g', '@openai/codex'], env: {} }]);
});

test('--pm names the package manager over JS_HARNESS_PM', async () => {
  const { out } = await run(['--pm', 'npm', '--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) });
  assert.deepEqual(JSON.parse(out).mandatory[0].run, ['npm', 'install', '-g', '@openai/codex']);
});

test('resolveStackPm: --pm, else JS_HARNESS_PM, else the manager of the running copy, never the word npm alone', () => {
  assert.deepEqual(resolveStackPm('npm', { JS_HARNESS_PM: 'pnpm' }, '/x'), { words: ['npm'], kind: 'npm' });
  assert.deepEqual(resolveStackPm(undefined, { JS_HARNESS_PM: 'pnpm' }, '/x'), { words: ['pnpm'], kind: 'pnpm' });
  const pnpmCopy = 'C:\\Users\\a\\AppData\\Local\\pnpm\\global\\5\\node_modules\\js-harness\\bin\\stack.mjs';
  assert.equal(resolveStackPm(undefined, {}, pnpmCopy).kind, 'pnpm');
  assert.equal(resolveStackPm(undefined, {}, '/usr/lib/node_modules/js-harness/bin/stack.mjs').kind, 'npm');
});

test('a package manager given as a command line is split into its words (Codex on 553900a..12e46c4)', async () => {
  assert.deepEqual(resolveStackPm('node /tools/pnpm.cjs', {}, '/x'), { words: ['node', '/tools/pnpm.cjs'], kind: 'pnpm' });
  const { out } = await run(['--json'], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) }, { JS_HARNESS_PM: 'node /tools/pnpm.cjs' });
  assert.deepEqual(JSON.parse(out).mandatory[0].run, ['node', '/tools/pnpm.cjs', 'add', '-g', '@openai/codex']);
});

test('a package manager whose whole line is a file, a path with a space, stays one word (Codex on 12e46c4..6a2b0ad)', () => {
  const file = 'C:\\Program Files\\nodejs\\npm.cmd';
  const exists = (p) => p === file;
  assert.deepEqual(resolveStackPm(file, {}, '/x', exists), { words: [file], kind: 'npm' });
  assert.deepEqual(resolveStackPm('node /tools/pnpm.cjs', {}, '/x', exists).words, ['node', '/tools/pnpm.cjs']);
});

test('a shown command quotes a word the shell would read, so it runs as printed (Codex on 553900a..12e46c4)', async () => {
  const { out } = await run([], { read: stack({ codex: { installed: 'missing', codex: 'n/a' } }) }, { JS_HARNESS_PM: 'node /tools/$pm.cjs' });
  assert.match(out, /run: {2}node '\/tools\/\$pm\.cjs' install -g @openai\/codex/);
  assert.match(out, /undo: node '\/tools\/\$pm\.cjs' uninstall -g @openai\/codex/);
});

test('an unknown argument, or a missing value, is a usage error that reads nothing', async () => {
  let read = 0;
  const deps = { read: () => { read += 1; return stack()(); } };
  for (const argv of [['--bogus'], ['bogus'], ['--home']]) {
    const { code, err } = await run(argv, deps);
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness stack/);
  }
  assert.equal(read, 0);
});

test('readStack keeps only the tool rows, resolves the switches and probes git and gh', () => {
  const spawned = [];
  const spawn = (file, args) => {
    const line = [file, ...args].join(' ');
    spawned.push(line);
    if (line.startsWith('git rev-parse')) return { status: 1, stdout: '' };
    if (/^(git|gh) --version/.test(line)) return { status: 0, stdout: line.startsWith('git') ? 'git version 2.54.0' : 'gh version 2.80.0' };
    return { status: null, error: new Error('spawn ENOENT'), stdout: '' };
  };
  const { rows, functions, prerequisites } = readStack({ home: '/no/such/home', cwd: '/no/such/project', spawn, platform: 'linux', env: {} });
  assert.deepEqual(rows.map((r) => r.id), ['engram', 'engram-plugin', 'codegraph', 'context7', 'typescript-lsp', 'codex']);
  assert.ok(functions.codeMap, 'the switches are resolved');
  assert.deepEqual(prerequisites, [{ id: 'git', state: 'ok' }, { id: 'gh', state: 'ok' }]);
});

// odd/tasks/user-guide.md S4: the help of stack names install and the ids --tool takes, and reads nothing.
test('stack --help and stack install --help print the usage of both, with the --tool ids, and read nothing', async () => {
  let read = 0;
  const deps = { read: () => { read += 1; return stack()(); } };
  for (const argv of [['--help'], ['-h'], ['install', '--help'], ['install', '-h']]) {
    const { code, out } = await run(argv, deps);
    assert.equal(code, 0, argv.join(' '));
    assert.match(out, /^Usage: js-harness stack \[/m);
    assert.match(out, /^Usage: js-harness stack install /m);
    assert.match(out, /--tool: codex, codegraph/);
  }
  assert.equal(read, 0);
});

test('stack takes an empty JS_HARNESS_HOME as unset: the engram plugin is read from the user home, not the working directory', async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-home-stack-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-home-user-'));
  try {
    // Installed and disabled in the user home: read from there, its one gap is `claude`; read from the working
    // directory, which holds nothing, it would be `installed` too.
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'engram@engram': [{ version: '0.1.19' }] } }));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'engram@engram': false } }));

    const run = spawnSync(process.execPath, [fileURLToPath(new URL('./js-harness.mjs', import.meta.url)), 'stack', '--json', '--cwd', work], {
      cwd: work,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home, JS_HARNESS_HOME: '' },
    });

    const plugin = JSON.parse(run.stdout).manual.filter((row) => row.tool === 'engram-plugin');
    assert.equal(plugin.length, 1, run.stdout);
    assert.deepEqual(plugin[0].dimensions, ['claude'], run.stdout);
  } finally {
    // On win32 a probe runs through cmd.exe, and its timeout kills only cmd.exe: the tool under it can live on with
    // its working directory in `work`, which Windows will not remove until it exits (the daily Windows run, three
    // times from 2026-10-28). The removal waits for it; the promise form, since Node 24's rmSync fails an EPERM at
    // once whatever its maxRetries.
    await fs.promises.rm(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await fs.promises.rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

// F8 S2 (odd/tasks/f8-s2-removal.md, T3): `stack backup run|verify|restore`, dispatched to bin/lib/stack-backup.mjs with
// every seam injected, so no process, registry, engram or real home is touched.
function backupSeams(extra = {}) {
  const reg = (args) => (args[0] === 'query' && args[1] === 'HKCU\\Environment'
    ? { status: 0, stdout: '    Path    REG_SZ    C:\\tools\r\n', stderr: '' }
    : { status: 1, stdout: '', stderr: 'not found' });
  const engram = (cmd, args) => (args[0] === 'stats'
    ? { status: 0, stdout: 'Sessions: 1\nObservations: 5\nPrompts: 1\n', stderr: '' }
    : { status: 0, stdout: '[1] #6431 (discovery) marker\n', stderr: '' });
  return { platform: 'win32', processes: () => [], reg, run: engram, independentCount: plainCount, interactive: false, ...extra };
}

function backupHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-stack-backup-'));
  const home = path.join(root, 'home');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(home, rel)), { recursive: true });
    fs.writeFileSync(path.join(home, rel), text);
  };
  put('.claude/settings.json', '{\n  "permissions": { "deny": ["Read(./.env)"] }\n}\n');
  put('.claude/agents/a.md', 'agent\n');
  put('.claude.json', '{\n  "mcpServers": { "engram": {}, "codegraph": {}, "context7": {} }\n}\n');
  put('.codex/config.toml', '[mcp_servers.engram]\n[mcp_servers.codegraph]\n[mcp_servers.context7]\n');
  put('.engram/engram.db', 'store');
  return { root, home };
}

test('stack backup --help prints the three forms and reads nothing; stack --help names them too', async () => {
  for (const argv of [['backup', '--help'], ['backup', 'run', '--help'], ['backup', 'restore', '-h'], ['--help']]) {
    const { code, out } = await run(argv, {});
    assert.equal(code, 0, argv.join(' '));
    assert.match(out, /^Usage: js-harness stack backup run \[--home <dir>\] \[--to <dir>\]/m, argv.join(' '));
    assert.match(out, /stack backup verify --from <dir>/);
    assert.match(out, /stack backup restore --from <dir>/);
  }
});

test('stack backup refuses a usage error with exit 2 and its usage', async () => {
  for (const argv of [
    ['backup'],
    ['backup', 'bogus'],
    ['backup', 'run', '--bogus'],
    ['backup', 'run', '--to'],
    ['backup', 'verify'],
    ['backup', 'verify', '--from', 'x', '--marker', 'm'],
    // The drill always searches engram, so the token and the id are required, the id a number (Codex P2 and gentle-ai
    // R3 on 84997f7..0b9f98a).
    ['backup', 'verify', '--from', 'x'],
    ['backup', 'verify', '--from', 'x', '--marker', 'm', '--expect', '64.31'],
    ['backup', 'restore'],
    ['backup', 'restore', '--from', 'x', '--only', 'nope'],
  ]) {
    const { code, err } = await run(argv, backupSeams());
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, /Usage: js-harness stack backup/, argv.join(' '));
  }
  assert.match((await run(['backup', 'run', '--bogus'], backupSeams())).err, /^unknown argument: --bogus$/m);
});

test('stack backup run, verify and restore exit 0 in scratch homes, 1 on a failed check, and restore writes nothing without --yes', async () => {
  const { root, home } = backupHome();
  try {
    const to = path.join(root, 'backup');
    const ran = await run(['backup', 'run', '--home', home, '--to', to], backupSeams());
    assert.equal(ran.code, 0, ran.err);
    assert.ok(fs.existsSync(path.join(to, 'manifest.json')));
    const verified = await run(['backup', 'verify', '--from', to, '--marker', 'm', '--expect', '6431'], backupSeams());
    assert.equal(verified.code, 0, verified.out);
    assert.match(verified.out, /^ok row 12/m);
    assert.equal((await run(['backup', 'verify', '--from', to, '--marker', 'm', '--expect', '1'], backupSeams())).code, 1);

    const target = path.join(root, 'target');
    const planned = await run(['backup', 'restore', '--from', to, '--home', target], backupSeams());
    assert.equal(planned.code, 1);
    assert.match(planned.out, /nothing written/);
    assert.ok(!fs.existsSync(target));
    const restored = await run(['backup', 'restore', '--from', to, '--home', target, '--yes'], backupSeams());
    assert.equal(restored.code, 0, restored.err);
    assert.equal(fs.readFileSync(path.join(target, '.claude', 'agents', 'a.md'), 'utf8'), 'agent\n');
    const only = await run(['backup', 'restore', '--from', to, '--home', target, '--only', 'permissions', '--only', 'mcp:context7', '--yes'], backupSeams());
    assert.equal(only.code, 0, only.err);

    const busy = await run(['backup', 'run', '--home', home, '--to', path.join(root, 'b2')], backupSeams({ processes: () => ['codex.exe'] }));
    assert.equal(busy.code, 1);
    assert.match(busy.out, /FAIL quiesce: codex\.exe runs/);
    const missing = await run(['backup', 'verify', '--from', path.join(root, 'none'), '--marker', 'm', '--expect', '6431'], backupSeams());
    assert.equal(missing.code, 1);
    assert.match(missing.err, /holds no js-harness\.stack-backup\/v1 manifest/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stack backup restore asks on a terminal and restores only on y', async () => {
  const { root, home } = backupHome();
  try {
    const to = path.join(root, 'backup');
    assert.equal((await run(['backup', 'run', '--home', home, '--to', to], backupSeams())).code, 0);
    const target = path.join(root, 'target');
    const asked = [];
    const no = await run(['backup', 'restore', '--from', to, '--home', target], backupSeams({ interactive: true, ask: async (q) => { asked.push(q); return false; } }));
    assert.equal(no.code, 1);
    assert.ok(!fs.existsSync(target));
    const yes = await run(['backup', 'restore', '--from', to, '--home', target], backupSeams({ interactive: true, ask: async () => true }));
    assert.equal(yes.code, 0, yes.err);
    assert.ok(fs.existsSync(path.join(target, '.claude', 'agents', 'a.md')));
    assert.equal(asked.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stack engram-prompt off takes the prompt hook out of a scratch home, on puts it back, and a bad form is a usage error', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-engram-prompt-'));
  const installPath = path.join(home, '.claude', 'plugins', 'cache', 'engram', 'engram', '0.1.19');
  const file = path.join(installPath, 'hooks', 'hooks.json');
  const text = `${JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'prompt.sh' }] }], SessionEnd: [{ hooks: [{ type: 'command', command: 'end.sh' }] }] } }, null, 2)}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'engram@engram': [{ scope: 'user', installPath }] } }));
  try {
    const off = await run(['engram-prompt', 'off', '--home', home], {});
    assert.equal(off.code, 0, off.err);
    assert.match(off.out, /took the UserPromptSubmit hook out of .*hooks\.json; restart Claude Code/);
    // The undo line names the home it was given, so it puts back the file it took out (Codex P2 over dc0d6c5..b309c50).
    assert.ok(off.out.includes(`undo: js-harness stack engram-prompt on --home ${/\s/.test(home) ? JSON.stringify(home) : home}`), off.out);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.UserPromptSubmit, undefined);
    const again = await run(['engram-prompt', 'off', '--home', home], {});
    assert.equal(again.code, 0);
    assert.match(again.out, /already off/);
    const on = await run(['engram-prompt', 'on', '--home', home], {});
    assert.equal(on.code, 0, on.err);
    assert.match(on.out, /put back/);
    assert.equal(fs.readFileSync(file, 'utf8'), text);
    const bad = await run(['engram-prompt', 'sideways', '--home', home], {});
    assert.equal(bad.code, 2);
    assert.match(bad.err, /stack engram-prompt needs off or on/);
    const none = await run(['engram-prompt', 'off', '--home', fs.mkdtempSync(path.join(os.tmpdir(), 'stack-engram-prompt-'))], {});
    assert.equal(none.code, 1);
    assert.match(none.err, /no user-level install of engram@engram/);
    // A machine manifest that does not parse is one line and exit 1, not a stack trace (Codex P2 over dc0d6c5..b309c50).
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(path.join(home, '.js-harness', 'manifest.json'), '{ not json');
    const broken = await run(['engram-prompt', 'on', '--home', home], {});
    assert.equal(broken.code, 1);
    assert.match(broken.err, /js-harness stack engram-prompt on: the machine manifest .* is not valid JSON; nothing was changed/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
