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
  assert.ok(stdout.text.includes(`git fetch ${bundle}`), 'the bundle is not unbundled by itself; the line to do it is printed');
});

test('restore refuses a home whose Engram already holds observations, unless --merge', async (t) => {
  const root = scratch(t);
  const from = backupDir(root);
  const home = path.join(root, 'home');
  const engram = fakeEngram();
  restoreBackup({ from, home, run: engram.run, env: {}, stdout: sink() });

  assert.throws(() => restoreBackup({ from, home, run: engram.run, env: {}, stdout: sink() }), /already holds 3 observations.*--merge/);
  restoreBackup({ from, home, merge: true, run: engram.run, env: {}, stdout: sink() });
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.engram', 'db.json'), 'utf8')).observations.length, 6);
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
