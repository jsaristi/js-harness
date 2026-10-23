import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { restoreBackup, slugOf, verifyBackup, verifySummary } from './backup-restore.mjs';

const EXPORT = {
  sessions: [{ id: 's1' }, { id: 's2' }],
  observations: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }],
  prompts: [{ id: 'p1' }],
  relations: [{ id: 'r1' }],
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** A backup clone as `backup run` leaves it: the export, a memory folder, the home, a config copy, a bundle and the
 * manifest that names every file with its sha256. */
function backupDir(root, { live = { sessions: 2, observations: 3, prompts: 1 } } = {}) {
  const dir = path.join(root, 'backup');
  const files = {
    'engram/export.json': JSON.stringify(EXPORT),
    'claude/projects/C--old-place/memory/MEMORY.md': '- a note\n',
    'claude/projects/C--old-place/memory/topic.md': 'detail\n',
    'js-harness-home/manifest.json': '{"installed":true}\n',
    'js-harness-home/state.json': '{"a":1}\n',
    'config/claude/settings.json': '{"hooks":{}}\n',
    'git/js-harness-12345678.bundle': 'bundle bytes',
  };
  for (const [relative, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), text);
  }
  const listed = Object.entries(files)
    .filter(([relative]) => !relative.startsWith('engram/') && !relative.startsWith('git/'))
    .map(([relative, text]) => ({ path: relative, bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) }));
  const manifest = { format: 1, machine: 'OLD-PC', engramVersion: 'engram 3.4.0', export: { sessions: 2, observations: 3, prompts: 1, relations: 1 }, live, files: listed, redacted: [] };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

function sink() {
  let text = '';
  return { write: (chunk) => (text += chunk), get text() { return text; } };
}

/** An engram that keeps its database as one JSON file in ENGRAM_DATA_DIR, so a restore and a verify read real state. */
function fakeEngram({ version = 'engram 3.4.0' } = {}) {
  const calls = [];
  const db = (options) => path.join(options.env.ENGRAM_DATA_DIR, 'db.json');
  const read = (options) => (fs.existsSync(db(options)) ? JSON.parse(fs.readFileSync(db(options), 'utf8')) : { sessions: [], observations: [], prompts: [], relations: [] });
  const run = (cmd, args, options = {}) => {
    calls.push({ cmd, args, dataDir: options.env?.ENGRAM_DATA_DIR });
    assert.equal(cmd, 'engram');
    if (args[0] === 'version') return { status: 0, stdout: `${version}\n`, stderr: '' };
    if (args[0] === 'stats') {
      const d = read(options);
      return { status: 0, stdout: `  Sessions:     ${d.sessions.length}\n  Observations: ${d.observations.length}\n  Prompts:      ${d.prompts.length}\n`, stderr: '' };
    }
    if (args[0] === 'import') {
      const incoming = JSON.parse(fs.readFileSync(args[1], 'utf8'));
      const d = read(options);
      const merged = Object.fromEntries(Object.keys(d).map((key) => [key, [...d[key], ...incoming[key]]]));
      fs.mkdirSync(options.env.ENGRAM_DATA_DIR, { recursive: true });
      fs.writeFileSync(db(options), JSON.stringify(merged));
      return { status: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'export') {
      fs.writeFileSync(args[1], JSON.stringify(read(options)));
      return { status: 0, stdout: '', stderr: '' };
    }
    throw new Error(`unexpected engram ${args.join(' ')}`);
  };
  return { run, calls };
}

test('slugOf names a checkout the way Claude names its memory folder', () => {
  assert.equal(slugOf('D:\\js-harness'), 'D--js-harness');
  assert.equal(slugOf('D:/js-harness/.claude/worktrees/x'), 'D--js-harness--claude-worktrees-x');
  assert.equal(slugOf('D--js-harness'), 'D--js-harness', 'a slug stays as it is');
  assert.equal(slugOf('D:\\my_project'), 'D--my-project', 'as projectSlug: every character but a letter or digit is a dash');
  assert.equal(slugOf('E:\\a b'), 'E--a-b');
});

test('restore refuses when it cannot read how much the Engram holds, unless --merge', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const home = path.join(root, 'home');
  const engram = fakeEngram();
  const run = (cmd, args, options) => (args[0] === 'stats' ? { status: 1, stdout: '', stderr: 'database is locked' } : engram.run(cmd, args, options));

  assert.throws(() => restoreBackup({ from, home, run, env: {}, stdout: sink() }), /could not read how many observations.*database is locked.*--merge adds only what Engram lacks/);
  assert.equal(engram.calls.some((c) => c.args[0] === 'import'), false, 'nothing is imported when the occupancy is unknown');
  restoreBackup({ from, home, merge: true, run, env: {}, stdout: sink() });
  assert.ok(engram.calls.some((c) => c.args[0] === 'import'), '--merge does not need the count');
});

test('restore prints a fetch line that brings back tags and stashes, not only branches', async (t) => {
  const root = scratch(t);
  const stdout = sink();
  restoreBackup({ from: backupDir(root), home: path.join(root, 'home'), run: fakeEngram().run, env: {}, stdout });
  assert.ok(stdout.text.includes("'+refs/*:refs/restored/*'"), stdout.text);
});

test('restore puts the worktree patches and the git records beside the bundles, with the lines that use them', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const copies = {
    'git/app-1a2b3c4d/worktrees/side-5e6f7a8b.patch': 'diff --git a/x b/x\n',
    'git/app-1a2b3c4d/worktrees/side-5e6f7a8b.untracked/notes/new.md': 'new\n',
    'git/app-1a2b3c4d/js-harness/codex-reviews.jsonl': '{"range":"a..b"}\n',
  };
  const manifest = JSON.parse(fs.readFileSync(path.join(from, 'manifest.json'), 'utf8'));
  for (const [relative, text] of Object.entries(copies)) {
    fs.mkdirSync(path.dirname(path.join(from, relative)), { recursive: true });
    fs.writeFileSync(path.join(from, relative), text);
    manifest.files.push({ path: relative, bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) });
  }
  manifest.bundles = [{ source: 'D:\\work\\app', folder: 'app-1a2b3c4d', commits: 0, refs: [], worktrees: [{ path: 'D:/work/side', key: 'side-5e6f7a8b', patch: true, untracked: 1, binary: 1, deletedBinary: 1 }] }];
  fs.writeFileSync(path.join(from, 'manifest.json'), JSON.stringify(manifest));
  const home = path.join(root, 'home');
  const stdout = sink();

  restoreBackup({ from, home, run: fakeEngram().run, env: {}, stdout });

  const restored = path.join(home, '.js-harness', 'restored-bundles', 'app-1a2b3c4d');
  for (const [relative, text] of Object.entries(copies)) {
    assert.equal(fs.readFileSync(path.join(home, '.js-harness', 'restored-bundles', relative.slice('git/'.length)), 'utf8'), text);
  }
  // Quoted, so a path with a space (C:\Users\First Last) stays one argument.
  assert.ok(stdout.text.includes(`uncommitted edits of D:/work/side: git -C "D:/work/side" apply "${path.join(restored, 'worktrees', 'side-5e6f7a8b.patch')}"`), stdout.text);
  assert.ok(stdout.text.includes(`its untracked files are in ${path.join(restored, 'worktrees', 'side-5e6f7a8b.untracked')}`), stdout.text);
  assert.ok(stdout.text.includes(`its changed binary files are in ${path.join(restored, 'worktrees', 'side-5e6f7a8b.binary')}: copy them over the checkout after the patch`), stdout.text);
  assert.ok(stdout.text.includes(`the binary files it deleted are named in ${path.join(restored, 'worktrees', 'side-5e6f7a8b.deleted-binaries.txt')}: delete them after the patch`), stdout.text);
  assert.ok(stdout.text.includes(`js-harness records of D:\\work\\app: copy ${path.join(restored, 'js-harness')} into its .git/js-harness/`), stdout.text);
  const verified = verifyBackup({ from, run: fakeEngram().run, env: {}, tmp: root });
  assert.ok(verified.lines.some((line) => /^ok files: 8 of 8/.test(line)), verified.lines.join('\n'));
});

test('a restore that stopped after the import runs again without importing twice', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const home = path.join(root, 'home');
  const engram = fakeEngram();
  // A file in the way of the memory folder: the copy fails after Engram took the import.
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'projects'), 'not a folder');
  assert.throws(() => restoreBackup({ from, home, run: engram.run, env: {}, stdout: sink() }));
  fs.rmSync(path.join(home, '.claude', 'projects'));

  const stdout = sink();
  restoreBackup({ from, home, run: engram.run, env: {}, stdout });
  assert.equal(engram.calls.filter((c) => c.args[0] === 'import').length, 1, 'the second run skips the import it already did');
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 3);
  assert.match(stdout.text, /engram: this backup was already imported into .* at /);
  assert.ok(fs.existsSync(path.join(home, '.claude', 'projects', 'C--old-place', 'memory', 'MEMORY.md')), 'the rest is put back');

  fs.rmSync(path.join(home, '.engram'), { recursive: true });
  restoreBackup({ from, home, run: engram.run, env: {}, stdout: sink() });
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 3, 'a mark whose Engram was emptied since is not trusted');
});

test('restore says when a --map names no project of the backup', async (t) => {
  const root = scratch(t);
  const stdout = sink();
  restoreBackup({ from: backupDir(root), home: path.join(root, 'home'), map: { 'C:\\no\\such': 'D:\\x' }, run: fakeEngram().run, env: {}, stdout });
  assert.match(stdout.text, /warning: --map C:\\no\\such=D:\\x matched no project of the backup \(C--no-such\)/);
});

test('restore imports Engram into the home, places every copy, and never writes over a live file', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const home = path.join(root, 'home');
  fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
  fs.writeFileSync(path.join(home, '.js-harness', 'state.json'), '{"live":true}\n');
  const engram = fakeEngram({ version: 'engram 3.5.0' });
  const stdout = sink();

  const result = restoreBackup({ from, home, map: { 'C:\\old\\place': 'D:\\new\\place' }, run: engram.run, env: {}, stdout });

  const imported = engram.calls.find((c) => c.args[0] === 'import');
  assert.equal(imported.dataDir, path.join(home, '.engram'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 3);
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'projects', 'D--new-place', 'memory', 'MEMORY.md'), 'utf8'), '- a note\n');
  assert.ok(fs.existsSync(path.join(home, '.claude', 'projects', 'D--new-place', 'memory', 'topic.md')));
  assert.equal(fs.existsSync(path.join(home, '.js-harness', 'manifest.json')), false, 'the install manifest of the old machine stays out');
  assert.equal(fs.readFileSync(path.join(home, '.js-harness', 'state.json'), 'utf8'), '{"live":true}\n', 'a live file is kept');
  assert.equal(fs.readFileSync(path.join(home, '.js-harness', 'restored-config', 'claude', 'settings.json'), 'utf8'), '{"hooks":{}}\n');
  const bundle = path.join(home, '.js-harness', 'restored-bundles', 'js-harness-12345678.bundle');
  assert.ok(fs.existsSync(bundle));
  assert.deepEqual(result.kept, ['js-harness-home/state.json']);
  assert.match(stdout.text, /C--old-place -> .*D--new-place/);
  assert.match(stdout.text, /engram 3\.4\.0.*engram 3\.5\.0/, 'a version difference is said');
  assert.ok(stdout.text.includes(`git fetch "${bundle}"`), 'the bundle is not unbundled by itself; the line to do it is printed');
});

test('restore refuses a home whose Engram already holds observations, unless --merge', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const home = path.join(root, 'home');
  const engram = fakeEngram();
  fs.mkdirSync(path.join(home, '.engram'), { recursive: true });
  fs.writeFileSync(path.join(home, '.engram', 'db.json'), JSON.stringify({ sessions: [], observations: [{ id: 'x' }, { id: 'y' }], prompts: [], relations: [] }));

  assert.throws(() => restoreBackup({ from, home, run: engram.run, env: {}, stdout: sink() }), /already holds 2 observations.*--merge adds only what Engram lacks/);
  restoreBackup({ from, home, merge: true, run: engram.run, env: {}, stdout: sink() });
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 5);
  restoreBackup({ from, home, merge: true, run: engram.run, env: {}, stdout: sink() });
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 5, 'the same backup is never imported twice, --merge or not');
});

test('restore refuses a folder that holds no backup', async (t) => {
  const root = scratch(t);
  assert.throws(() => restoreBackup({ from: root, home: path.join(root, 'home'), run: fakeEngram().run, env: {}, stdout: sink() }), /no manifest\.json/);
});

test('verify restores into a scratch home, checks the counts and every file, and removes the scratch home', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const tmp = path.join(root, 'tmp');
  fs.mkdirSync(tmp);

  const good = verifyBackup({ from, run: fakeEngram().run, env: {}, tmp });
  assert.equal(good.ok, true, good.lines.join('\n'));
  assert.ok(good.lines.some((line) => /observations: 3 restored, 3 backed up, 3 live/.test(line)));
  assert.ok(good.lines.some((line) => /files: 5 of 5 byte for byte/.test(line)));
  // A backup made before the readable fallback existed is still a good backup: its export holds everything.
  assert.ok(good.lines.includes('note recent: this backup holds no readable fallback yet; the next backup run writes it'), good.lines.join('\n'));
  assert.deepEqual(fs.readdirSync(tmp), [], 'the scratch home is gone');

  fs.appendFileSync(path.join(from, 'claude', 'projects', 'C--old-place', 'memory', 'MEMORY.md'), 'changed\n');
  const tampered = verifyBackup({ from, run: fakeEngram().run, env: {}, tmp });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.lines.some((line) => line.includes('claude/projects/C--old-place/memory/MEMORY.md')));
  assert.deepEqual(fs.readdirSync(tmp), []);
});

test('verify fails when the backed-up counts are not what the live Engram held', async (t) => {
  const root = scratch(t);
  const from = backupDir(root, { live: { sessions: 2, observations: 9, prompts: 1 } });
  const result = verifyBackup({ from, run: fakeEngram().run, env: {}, tmp: root });
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => /observations: 3 restored, 3 backed up, 9 live/.test(line)));
});

test('verifySummary checks the four sections and that no line is private', () => {
  const good = ['# js-harness memory summary', '', '## State', '- Total: 1/2 (50%)', '## Open work', '## Features in flight', '## Decisions', 'Lines left out by the privacy check: 0.'].join('\n');
  assert.equal(verifySummary({ text: good, terms: ['clientproject'] }).ok, true);
  const missing = verifySummary({ text: good.replace('## Decisions', ''), terms: [] });
  assert.equal(missing.ok, false);
  assert.ok(missing.lines.some((line) => /## Decisions/.test(line)));
  const leaked = verifySummary({ text: `${good}\n- 2026-10-19 clientproject: a plan`, terms: ['clientproject'] });
  assert.equal(leaked.ok, false);
  const unchecked = verifySummary({ text: good, terms: null });
  assert.ok(unchecked.lines.some((line) => /no private-terms\.txt/.test(line)), 'it says when there is no terms list');
});
