import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { backupRoots, restoreBackup, runBackup, verifyBackup, QUIESCE } from './stack-backup.mjs';
import { plainCount } from './stack-backup-walk.mjs';

// Fake secrets: no output of run, verify or restore may hold either, and no drill home may hold a credential.
const FAKE_TOKEN = 'sk-ant-oat01-FAKEtokenFAKEtokenFAKEtoken0123456789';
const FAKE_KEY = 'ctx7sk-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
const PERMISSIONS = { allow: ['Bash(ls:*)'], deny: ['Read(./.env)', 'Bash(rm -rf:*)'], defaultMode: 'bypassPermissions' };

function scratch(t, name = 'stack-backup-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

const sha = (data) => createHash('sha256').update(data).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** A home as his machine holds it, in miniature, with fake credentials and keys planted. */
function plant(home) {
  write(path.join(home, '.claude', 'settings.json'), json({ permissions: PERMISSIONS, hooks: { Stop: [] }, outputStyle: 'Neutral' }));
  write(path.join(home, '.claude', 'CLAUDE.md'), '# rules\n');
  write(path.join(home, '.claude', 'agents', 'reader.md'), 'an agent\n');
  write(path.join(home, '.claude', '.credentials.json'), json({ claudeAiOauth: { accessToken: FAKE_TOKEN } }));
  write(path.join(home, '.claude', 'projects', 'D--p', 'old.jsonl'), '{"turn":1}\n');
  write(path.join(home, '.claude.json'), json({ numStartups: 3, mcpServers: { engram: { command: 'engram', args: ['mcp'] }, codegraph: { command: 'codegraph', args: ['serve', '--mcp'] }, context7: { type: 'http', url: 'https://mcp.context7.com/mcp', headers: { CONTEXT7_API_KEY: FAKE_KEY } } } }));
  write(path.join(home, '.codex', 'config.toml'), `model = "gpt"\n[mcp_servers.engram]\ncommand = "engram"\n[mcp_servers.codegraph]\ncommand = "codegraph"\n[mcp_servers.context7]\nurl = "https://mcp.context7.com/mcp"\n[mcp_servers.context7.http_headers]\nCONTEXT7_API_KEY = "${FAKE_KEY}"\n`);
  write(path.join(home, '.codex', 'auth.json'), json({ tokens: { access_token: FAKE_TOKEN } }));
  write(path.join(home, '.codex', 'sessions', 's.jsonl'), '{"codex":1}\n');
  write(path.join(home, '.engram', 'engram.db'), Buffer.from([0, 1, 2, 3, 0x36, 0x34, 0x33, 0x31]));
  write(path.join(home, '.js-harness', 'manifest.json'), '{"v":1}\n');
  write(path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Orca.lnk'), 'shortcut');
  write(path.join(home, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Notepad.lnk'), 'other');
}

const UNINSTALL = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';

/** `reg`, as his machine answers it: a user PATH, one Orca uninstall key, no orca URL class. */
function fakeReg(calls = []) {
  return (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'query' && args[1] === 'HKCU\\Environment') return { status: 0, stdout: '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    C:\\tools;%USERPROFILE%\\.herdr\\bin\r\n\r\n', stderr: '' };
    if (args[0] === 'query' && /Uninstall$/.test(args[1])) return { status: 0, stdout: `\r\n${UNINSTALL}\\1a2b-orca\r\n    DisplayName    REG_SZ    Orca 1.4.0\r\n\r\nEnd of search: 1 match(es) found.\r\n`, stderr: '' };
    if (args[0] === 'query') return { status: 1, stdout: '', stderr: 'ERROR: The system was unable to find the specified registry key or value.' };
    if (args[0] === 'export') {
      write(args[2], `Windows Registry Editor Version 5.00\r\n\r\n[${args[1]}]\r\n`);
      return { status: 0, stdout: 'The operation completed successfully.', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unexpected' };
  };
}

/** `engram`, answering stats from any store and the marker only from a store that holds the planted bytes; each call
 * checks the drill home it reads holds no credential or key. */
function fakeEngram(seen = []) {
  return (cmd, args, { env }) => {
    const dir = env.ENGRAM_DATA_DIR;
    seen.push({ args, dir });
    const home = path.dirname(dir);
    for (const secret of [['.claude', '.credentials.json'], ['.codex', 'auth.json'], ['.claude.json'], ['.codex', 'config.toml']]) {
      if (args[0] === 'search') assert.ok(!fs.existsSync(path.join(home, ...secret)), `the drill home holds ${secret.join('/')}`);
    }
    if (args[0] === 'stats') return { status: 0, stdout: 'Engram Memory Stats\n  Sessions:     2\n  Observations: 12\n  Prompts:      4\n', stderr: '' };
    if (args[0] === 'search') {
      const held = fs.existsSync(path.join(dir, 'engram.db'));
      return { status: 0, stdout: held ? `Found 1 memories:\n[1] #6431 (discovery) — F8 S2 restore drill marker 2026-11-02\n` : 'No memories found\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'unknown' };
  };
}

/** The seams of one test: nothing runs, nothing of this machine is read, and every line is kept. */
function seams(extra = {}) {
  const out = [];
  return {
    out,
    deps: { platform: 'win32', env: {}, processes: () => ['explorer.exe'], reg: fakeReg(), run: fakeEngram(), independentCount: plainCount, log: (line) => out.push(line), now: () => new Date('2026-11-02T21:00:00.000Z'), ...extra },
  };
}

const noSecret = (text) => {
  assert.ok(!text.includes(FAKE_TOKEN), 'an output printed the fake token');
  assert.ok(!text.includes(FAKE_KEY), 'an output printed the fake key');
};

/** Every file under `dir`, with its content's hash, so a run that changed nothing compares equal. */
function snapshot(dir) {
  const files = {};
  const visit = (d, rel) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(full, r);
      else files[r] = sha(fs.readFileSync(full));
    }
  };
  visit(dir, '');
  return files;
}

function backedUp(t, extra = {}) {
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const dest = path.join(scratch(t, 'stack-backup-dest-'), 'b');
  const { out, deps } = seams(extra);
  const result = runBackup({ home, env: {}, platform: 'win32', dest, deps });
  return { home, dest, out, deps, result };
}

test('backupRoots names the roots of item 5, splits ~/.claude, and derives AppData for a home other than the real one', () => {
  const home = path.join(os.tmpdir(), 'h');
  const roots = backupRoots({ home, env: { APPDATA: 'C:\\R', LOCALAPPDATA: 'C:\\L' }, platform: 'win32', realHome: 'C:\\Users\\real' });
  const byId = Object.fromEntries(roots.map((r) => [r.id, r]));
  assert.equal(byId['claude-config'].kind, 'config');
  assert.equal(byId['claude-data'].kind, 'data');
  assert.deepEqual(byId['claude-config'].include, ['settings.json', 'CLAUDE.md', 'agents', 'skills', 'output-styles', 'hooks', 'commands', 'plugins']);
  assert.deepEqual(byId['claude-data'].exclude, byId['claude-config'].include);
  assert.equal(byId.engram.kind, 'data');
  assert.equal(byId['claude-json'].kind, 'file');
  assert.equal(byId['claude-json'].from, path.join(home, '.claude.json'));
  assert.equal(byId['orca-roaming'].from, path.join(home, 'AppData', 'Roaming', 'orca'));
  assert.equal(byId['orca-programs'].from, path.join(home, 'AppData', 'Local', 'Programs', 'orca'));
  for (const from of ['.gemini', '.gentle-ai', '.orca', '.herdr', 'bin']) assert.ok(roots.some((r) => r.from === path.join(home, from)), from);
  assert.ok(roots.some((r) => r.from === path.join(home, 'go', 'bin', 'gentle-ai.exe')));
  assert.ok(roots.some((r) => r.from === path.join(home, '.js-harness', 'manifest.json')));
  const real = backupRoots({ home: 'C:\\Users\\real', env: { APPDATA: 'C:\\R', LOCALAPPDATA: 'C:\\L' }, platform: 'win32', realHome: 'C:\\Users\\real' });
  assert.equal(real.find((r) => r.id === 'orca-roaming').from, path.join('C:\\R', 'orca'));
  assert.equal(real.find((r) => r.id === 'herdr-local').from, path.join('C:\\L', 'herdr'));
});

test('run copies every root into a .partial folder, writes the manifest and the exports, and publishes it only then', (t) => {
  const { home, dest, out, result } = backedUp(t);
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(dest) && !fs.existsSync(`${dest}.partial`));
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest), ['schema', 'createdAt', 'home', 'roots', 'files', 'links', 'exports', 'named', 'engram', 'counts']);
  assert.equal(manifest.schema, 'js-harness.stack-backup/v1');
  assert.equal(manifest.home, home);
  assert.deepEqual(Object.keys(manifest.roots[0]), ['id', 'from', 'kind', 'present']);
  assert.equal(manifest.roots.find((r) => r.id === 'orca').present, false);
  const file = (root, p) => manifest.files.find((f) => f.root === root && f.path === p);
  assert.deepEqual(Object.keys(file('claude-config', 'settings.json')), ['root', 'path', 'bytes', 'sha256', 'secret']);
  assert.equal(file('claude-config', 'agents/reader.md').sha256, sha('an agent\n'));
  assert.equal(fs.readFileSync(path.join(dest, 'roots', 'claude-config', 'agents', 'reader.md'), 'utf8'), 'an agent\n');
  for (const [root, p] of [['claude-data', '.credentials.json'], ['codex-data', 'auth.json'], ['claude-json', '.claude.json'], ['codex-config', 'config.toml']]) {
    assert.equal(file(root, p).secret, true, `${root}/${p}`);
  }
  assert.equal(file('claude-config', 'settings.json').secret, false);
  assert.equal(file('engram', 'engram.db').secret, false);
  assert.ok(!manifest.files.some((f) => f.root === 'claude-data' && f.path === 'settings.json'), 'a config file is in one root only');
  assert.equal(fs.readFileSync(path.join(dest, 'exports', 'user-path.txt'), 'utf8'), 'C:\\tools;%USERPROFILE%\\.herdr\\bin\n');
  assert.deepEqual(manifest.exports.registry, ['exports/registry/uninstall-1a2b-orca.reg']);
  assert.ok(fs.existsSync(path.join(dest, 'exports', 'registry', 'uninstall-1a2b-orca.reg')));
  assert.deepEqual(manifest.exports.shortcuts, ['exports/shortcuts/Orca.lnk']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'named', 'permissions.json'), 'utf8')), PERMISSIONS);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(dest, 'named', 'mcp-claude.json'), 'utf8'))), ['engram', 'codegraph', 'context7']);
  assert.deepEqual(manifest.engram, { observations: 12 });
  assert.equal(manifest.counts.files, manifest.files.length);
  assert.equal(manifest.counts.bytes, manifest.files.reduce((sum, f) => sum + f.bytes, 0));
  noSecret(out.join('\n'));
});

test('the default destination is ~/js-harness-s2-backup/<UTC stamp>, and one inside the memory backup is refused', (t) => {
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const { out, deps } = seams();
  const result = runBackup({ home, env: {}, platform: 'win32', deps });
  assert.equal(result.ok, true);
  assert.equal(result.dest, path.join(home, 'js-harness-s2-backup', '2026-11-02T21-00-00-000Z'));
  const inside = runBackup({ home, env: {}, platform: 'win32', dest: path.join(home, '.js-harness', 'b'), deps });
  assert.equal(inside.ok, false);
  assert.match(out.at(-1), /^FAIL destination: .*\.js-harness/);
  assert.ok(!fs.existsSync(path.join(home, '.js-harness', 'b.partial')));
  const inRoot = runBackup({ home, env: {}, platform: 'win32', dest: path.join(home, '.claude', 'b'), deps });
  assert.equal(inRoot.ok, false);
});

test('a running claude.exe stops run before it copies anything, and stops a restore of the real home', (t) => {
  const { home, dest } = backedUp(t);
  const { out, deps: busy } = seams({ processes: () => ['explorer.exe', 'Claude.exe'] });
  const second = path.join(path.dirname(dest), 'c');
  const result = runBackup({ home, env: {}, platform: 'win32', dest: second, deps: busy });
  assert.equal(result.ok, false);
  assert.match(out.join('\n'), /^FAIL quiesce: claude\.exe runs/m);
  assert.ok(!fs.existsSync(second) && !fs.existsSync(`${second}.partial`));
  const before = snapshot(home);
  const restored = restoreBackup({ from: dest, home, yes: true, deps: { ...busy, realHome: home } });
  assert.equal(restored.ok, false);
  assert.deepEqual(snapshot(home), before);
  assert.ok(QUIESCE.includes('claude.exe') && QUIESCE.includes('engram.exe'));
});

test('an unreadable folder makes run throw, naming it, and leaves no published backup', (t) => {
  const locked = [];
  const fsx = {
    ...fs,
    readdirSync: (p, ...rest) => {
      if (/[\\/]\.claude[\\/]agents$/.test(p)) {
        locked.push(p);
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      }
      return fs.readdirSync(p, ...rest);
    },
  };
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const dest = path.join(scratch(t), 'b');
  assert.throws(() => runBackup({ home, env: {}, platform: 'win32', dest, deps: { ...seams().deps, fs: fsx } }), /agents.*EACCES/);
  assert.ok(locked.length > 0);
  assert.ok(!fs.existsSync(dest));
});

test('a copy interrupted midway leaves only the .partial folder', (t) => {
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const dest = path.join(scratch(t), 'b');
  let copies = 0;
  const copy = () => {
    copies += 1;
    if (copies === 3) throw new Error('disk full');
    return { bytes: 0, sha256: sha(''), flagged: false };
  };
  assert.throws(() => runBackup({ home, env: {}, platform: 'win32', dest, deps: { ...seams().deps, copy } }), /disk full/);
  assert.ok(fs.existsSync(`${dest}.partial`));
  assert.ok(!fs.existsSync(dest));
});

test('a count the independent count does not match throws and publishes nothing', (t) => {
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const dest = path.join(scratch(t), 'b');
  const independentCount = (root) => (root.id === 'claude-data' ? { files: 99, bytes: 1 } : plainCount(root));
  assert.throws(() => runBackup({ home, env: {}, platform: 'win32', dest, deps: { ...seams().deps, independentCount } }), /claude-data: copied \d+ files, \d+ bytes; an independent count reads 99 files, 1 bytes/);
  assert.ok(!fs.existsSync(dest));
});

test('verify drills the backup on a scratch home with no credential in it, removed after, and every check passes', (t) => {
  const seen = [];
  const { dest } = backedUp(t);
  const tmp = scratch(t, 'stack-backup-tmp-');
  const { out, deps } = seams({ run: fakeEngram(seen) });
  const result = verifyBackup({ from: dest, deps, marker: 's2drillmarker20261102', expectId: '6431', tmp });
  assert.deepEqual(result.lines.filter((line) => !line.startsWith('ok ')), []);
  assert.equal(result.ok, true);
  for (const name of ['files', 'links', 'exports', 'secrets', 'engram', 'permissions', 'mcp claude', 'mcp codex', 'row 12']) {
    assert.ok(result.lines.some((line) => line.startsWith(`ok ${name}`)), name);
  }
  const search = seen.find((call) => call.args[0] === 'search');
  assert.deepEqual(search.args, ['search', 's2drillmarker20261102', '--all']);
  assert.ok(search.dir.startsWith(tmp));
  assert.deepEqual(fs.readdirSync(tmp), [], 'the drill home is gone');
  noSecret(out.join('\n'));
});

test('verify fails on a changed byte, a missing marker or a wrong permissions object, and still removes its home', (t) => {
  const { dest } = backedUp(t);
  const tmp = scratch(t, 'stack-backup-tmp-');
  fs.appendFileSync(path.join(dest, 'roots', 'claude-config', 'agents', 'reader.md'), 'x');
  write(path.join(dest, 'named', 'permissions.json'), json({ allow: [] }));
  const { out, deps } = seams();
  const result = verifyBackup({ from: dest, deps, marker: 's2drillmarker20261102', expectId: '9999', tmp });
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), /^FAIL files: 1 differ, first claude-config\/agents\/reader\.md/m);
  assert.match(result.lines.join('\n'), /^FAIL engram: #9999 not found/m);
  assert.match(result.lines.join('\n'), /^FAIL permissions/m);
  assert.deepEqual(fs.readdirSync(tmp), []);
  noSecret(out.join('\n'));
});

test('verify removes its home when a step throws', (t) => {
  const { dest } = backedUp(t);
  const tmp = scratch(t, 'stack-backup-tmp-');
  const run = () => {
    throw new Error('engram crashed');
  };
  const result = verifyBackup({ from: dest, deps: { ...seams().deps, run }, marker: 'm', expectId: '1', tmp });
  assert.equal(result.ok, false);
  assert.deepEqual(fs.readdirSync(tmp), []);
});

test('a junction or symlink is backed up as a link and restored as one', (t) => {
  const home = scratch(t, 'stack-backup-home-');
  plant(home);
  const outside = scratch(t, 'stack-backup-outside-');
  write(path.join(outside, 'SKILL.md'), 'skill');
  fs.mkdirSync(path.join(home, '.claude', 'skills'));
  try {
    fs.symlinkSync(outside, path.join(home, '.claude', 'skills', 'mine'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    return t.skip(`this machine cannot make a folder link: ${error.code}`);
  }
  const dest = path.join(scratch(t), 'b');
  const { deps } = seams();
  assert.equal(runBackup({ home, env: {}, platform: 'win32', dest, deps }).ok, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.links.map((l) => [l.root, l.path, path.resolve(l.target)]), [['claude-config', 'skills/mine', path.resolve(outside)]]);
  assert.ok(!manifest.files.some((f) => f.path.includes('SKILL.md')), 'a link is never followed');
  const target = scratch(t, 'stack-backup-target-');
  assert.equal(restoreBackup({ from: dest, home: target, yes: true, deps }).ok, true);
  const restored = path.join(target, '.claude', 'skills', 'mine');
  assert.ok(fs.lstatSync(restored).isSymbolicLink());
  assert.equal(path.resolve(fs.readlinkSync(restored)), path.resolve(outside));
  const drill = verifyBackup({ from: dest, deps, marker: 's2drillmarker20261102', expectId: '6431', tmp: scratch(t, 'stack-backup-tmp-') });
  assert.ok(drill.lines.includes('ok links: 1 restored as links'), drill.lines.join('\n'));
  // The drill removes its home, links included, and never what a link points to (gentle-ai R3 on 84997f7..0b9f98a).
  assert.equal(fs.readFileSync(path.join(outside, 'SKILL.md'), 'utf8'), 'skill');
});

/** Replaces the folder `at` with a link to `target`; the reason when this machine cannot make one. */
function relink(target, at) {
  fs.rmSync(at, { recursive: true, force: true });
  try {
    fs.symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir');
    return null;
  } catch (error) {
    return error.code ?? error.message;
  }
}

test('a folder that became a link since the backup is never written through: config replaces the link, data skips it', (t) => {
  const { home, dest, deps } = backedUp(t);
  const outside = scratch(t, 'stack-backup-outside-');
  write(path.join(outside, 'reader.md'), 'not his agent\n');
  const why = relink(outside, path.join(home, '.claude', 'agents'));
  if (why) return t.skip(`this machine cannot make a folder link: ${why}`);
  const empty = scratch(t, 'stack-backup-outside-');
  assert.equal(relink(empty, path.join(home, '.claude', 'projects', 'D--p')), null);
  const out = [];
  const result = restoreBackup({ from: dest, home, yes: true, deps: { ...deps, log: (line) => out.push(line) } });
  assert.equal(result.ok, true, out.join('\n'));
  // Codex P1 on 84997f7..0b9f98a: the write followed the link and the deletion then removed it.
  assert.equal(fs.readFileSync(path.join(outside, 'reader.md'), 'utf8'), 'not his agent\n');
  assert.ok(!fs.lstatSync(path.join(home, '.claude', 'agents')).isSymbolicLink());
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'agents', 'reader.md'), 'utf8'), 'an agent\n');
  assert.deepEqual(fs.readdirSync(empty), [], 'a data folder that is a link now is left as it is');
  assert.match(out.join('\n'), /skip .*D--p.*a link now, never followed/);
});

test('a root that became a link since the backup is skipped whole, its target never written', (t) => {
  const { home, dest, deps } = backedUp(t);
  const outside = scratch(t, 'stack-backup-outside-');
  write(path.join(outside, 'settings.json'), '{}\n');
  const why = relink(outside, path.join(home, '.claude'));
  if (why) return t.skip(`this machine cannot make a folder link: ${why}`);
  const out = [];
  assert.equal(restoreBackup({ from: dest, home, yes: true, deps: { ...deps, log: (line) => out.push(line) } }).ok, true);
  // Codex P1 recheck on 0b9f98a..d9806c8: the ancestors were checked below the root, never the root itself.
  assert.deepEqual(fs.readdirSync(outside), ['settings.json']);
  assert.equal(fs.readFileSync(path.join(outside, 'settings.json'), 'utf8'), '{}\n');
  assert.ok(fs.lstatSync(path.join(home, '.claude')).isSymbolicLink(), 'the link is left for him to put back by hand');
  assert.match(out.join('\n'), /skip claude-config: .* is a link now, never followed/);
  assert.match(out.join('\n'), /skip claude-data: .* is a link now, never followed/);
});

test('a restore puts back a file that is read-only now, since it replaces a file and never writes into one', (t) => {
  // gentle-ai R3 on 0b9f98a..0275e71d asked whether a kept read-only mode blocks a second restore: the write step removes
  // the target and copies anew, which a read-only file allows on Windows and in a writable folder elsewhere.
  const { home, dest, deps } = backedUp(t);
  const reader = path.join(home, '.claude', 'agents', 'reader.md');
  fs.writeFileSync(reader, 'changed\n');
  fs.chmodSync(reader, 0o444);
  assert.equal(restoreBackup({ from: dest, home, yes: true, deps }).ok, true);
  assert.equal(fs.readFileSync(reader, 'utf8'), 'an agent\n');
});

test('on Windows a config file renamed only in case is kept, never deleted as one the backup lacks', { skip: process.platform !== 'win32' && 'only Windows reads two names that differ in case as one file' }, (t) => {
  const { home, dest, deps } = backedUp(t);
  const agents = path.join(home, '.claude', 'agents');
  fs.renameSync(path.join(agents, 'reader.md'), path.join(agents, 'Reader.md'));
  assert.equal(restoreBackup({ from: dest, home, yes: true, deps }).ok, true);
  assert.deepEqual(fs.readdirSync(agents).map((name) => name.toLowerCase()), ['reader.md']);
  assert.equal(fs.readFileSync(path.join(agents, 'reader.md'), 'utf8'), 'an agent\n');
});

test('verify fails when an export changed or is gone, and when no marker is given to search', (t) => {
  const { dest } = backedUp(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'));
  assert.ok(Object.keys(manifest.exports.sha256).length >= 3, 'the user PATH, a registry key and a shortcut are hashed');
  fs.appendFileSync(path.join(dest, 'exports', 'user-path.txt'), 'x');
  fs.rmSync(path.join(dest, manifest.exports.registry[0]));
  const { deps } = seams();
  const result = verifyBackup({ from: dest, deps, tmp: scratch(t, 'stack-backup-tmp-') });
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), /^FAIL exports: 2 differ or are gone, first exports\/user-path\.txt/m);
  // Codex P2 on 84997f7..0b9f98a: a drill that never searched engram is no proof the store answers.
  assert.match(result.lines.join('\n'), /^FAIL engram: no marker to search/m);
  // A manifest from before the exports were hashed says what to do (gentle-ai R3 on 0b9f98a..35e67e1).
  delete manifest.exports.sha256;
  write(path.join(dest, 'manifest.json'), json(manifest));
  const legacy = verifyBackup({ from: dest, deps, marker: 's2drillmarker20261102', expectId: '6431', tmp: scratch(t, 'stack-backup-tmp-') });
  assert.match(legacy.lines.join('\n'), /^FAIL exports: the manifest records no hash of its exports: take a new backup with js-harness stack backup run$/m);
});

test('restore without yes prints the plan by path and writes nothing', (t) => {
  const { home, dest } = backedUp(t);
  fs.rmSync(path.join(home, '.claude', 'agents', 'reader.md'));
  write(path.join(home, '.claude', 'agents', 'new.md'), 'new');
  const before = snapshot(home);
  const { out, deps } = seams({ realHome: home });
  const result = restoreBackup({ from: dest, home, deps });
  assert.equal(result.planned, true);
  assert.deepEqual(snapshot(home), before);
  const text = out.join('\n');
  assert.ok(text.includes(`write ${path.join(home, '.claude', 'agents', 'reader.md')}`), text);
  assert.ok(text.includes(`delete ${path.join(home, '.claude', 'agents', 'new.md')}`), text);
  assert.match(text, /nothing written/);
  noSecret(text);
});

test('restore puts config back as a snapshot, never deletes or overwrites data, and puts engram only into an empty store', (t) => {
  const { home, dest } = backedUp(t);
  fs.rmSync(path.join(home, '.claude', 'agents', 'reader.md'));
  write(path.join(home, '.claude', 'agents', 'new.md'), 'created after');
  write(path.join(home, '.claude', 'commands', 'deep', 'only.md'), 'created after');
  write(path.join(home, '.claude', 'CLAUDE.md'), '# changed\n');
  write(path.join(home, '.claude', 'projects', 'D--p', 'old.jsonl'), '{"turn":1}\n{"turn":2}\n');
  write(path.join(home, '.claude', 'projects', 'D--p', 'newer.jsonl'), '{"after":true}\n');
  fs.rmSync(path.join(home, '.codex', 'sessions', 's.jsonl'));
  write(path.join(home, '.engram', 'engram.db'), 'grown since');
  const { out, deps } = seams({ realHome: home });
  const result = restoreBackup({ from: dest, home, yes: true, deps });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'agents', 'reader.md'), 'utf8'), 'an agent\n');
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'agents', 'new.md')));
  assert.ok(!fs.existsSync(path.join(home, '.claude', 'commands')), 'an emptied folder of a config root goes');
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), '# rules\n');
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'projects', 'D--p', 'old.jsonl'), 'utf8'), '{"turn":1}\n{"turn":2}\n');
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'projects', 'D--p', 'newer.jsonl'), 'utf8'), '{"after":true}\n');
  assert.equal(fs.readFileSync(path.join(home, '.codex', 'sessions', 's.jsonl'), 'utf8'), '{"codex":1}\n');
  assert.equal(fs.readFileSync(path.join(home, '.engram', 'engram.db'), 'utf8'), 'grown since');
  assert.match(out.join('\n'), /skip engram: .* holds files; .*js-harness backup restore --merge/);
  noSecret(out.join('\n'));
});

test('restore --only permissions puts back the permissions object alone, other keys and the file style kept', (t) => {
  const { home, dest } = backedUp(t);
  const settings = path.join(home, '.claude', 'settings.json');
  fs.writeFileSync(settings, '{\r\n    "hooks": {\r\n        "Stop": [1]\r\n    },\r\n    "theme": "dark"\r\n}');
  const { deps } = seams({ realHome: home });
  assert.equal(restoreBackup({ from: dest, home, only: ['permissions'], yes: true, deps }).ok, true);
  const text = fs.readFileSync(settings, 'utf8');
  assert.deepEqual(JSON.parse(text), { hooks: { Stop: [1] }, theme: 'dark', permissions: PERMISSIONS });
  assert.ok(text.includes('\r\n    "hooks"') && !text.endsWith('\n'), 'its indent, line ends and last line kept');
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), '# rules\n');
});

test('restore --only mcp:context7 puts that entry back alone, the others untouched, and prints no key', (t) => {
  const { home, dest } = backedUp(t);
  const file = path.join(home, '.claude.json');
  write(file, json({ numStartups: 9, mcpServers: { engram: { command: 'engram2' } } }));
  const { out, deps } = seams({ realHome: home });
  assert.equal(restoreBackup({ from: dest, home, only: ['mcp:context7'], yes: true, deps }).ok, true);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.numStartups, 9);
  assert.deepEqual(after.mcpServers.engram, { command: 'engram2' });
  assert.equal(after.mcpServers.context7.headers.CONTEXT7_API_KEY, FAKE_KEY);
  assert.equal(after.mcpServers.codegraph, undefined);
  assert.throws(() => restoreBackup({ from: dest, home, only: ['mcp:nothere'], yes: true, deps }), /holds no mcpServers entry nothere/);
  noSecret(out.join('\n'));
});

test('a full run, verify and restore into an empty home rebuilds it, credentials included, and no output prints a secret', (t) => {
  const { home, dest, out } = backedUp(t);
  const tmp = scratch(t, 'stack-backup-tmp-');
  const { out: verifyOut, deps } = seams();
  assert.equal(verifyBackup({ from: dest, deps, marker: 'm', expectId: '6431', tmp }).ok, true);
  const target = scratch(t, 'stack-backup-target-');
  const { out: restoreOut, deps: restoreDeps } = seams();
  assert.equal(restoreBackup({ from: dest, home: target, yes: true, deps: restoreDeps }).ok, true);
  const original = snapshot(home);
  const rebuilt = snapshot(target);
  for (const rel of Object.keys(original).filter((r) => !r.startsWith('AppData/'))) assert.equal(rebuilt[rel], original[rel], rel);
  noSecret([...out, ...verifyOut, ...restoreOut].join('\n'));
});
