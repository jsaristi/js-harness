import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { redactSecrets, collectFiles, exportEngram, parseStats, buildManifest, pushRefusal } from './backup.mjs';

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-lib-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const sha = (text) => createHash('sha256').update(text).digest('hex');

test('redactSecrets blanks each secret value in place, names its kind, and leaves plain text alone', () => {
  const plain = 'a task-list note about risk-assessment-for-the-whole-team, tokens and passwords in general';
  assert.deepEqual(redactSecrets(plain), { text: plain, kinds: [] });
  const cases = [
    ['remote: gho_' + 'a'.repeat(36), 'GitHub token'],
    ['x = "github_pat_' + 'B'.repeat(40) + '"', 'GitHub token'],
    ['ANTHROPIC_API_KEY=sk-ant-api03-' + 'c1'.repeat(20), 'API key'],
    ['"CONTEXT7_API_KEY": "ctx7sk-ad19' + 'f0'.repeat(14) + '"', 'API key'],
    // The shape of the real Context7 key (round 2): a UUID after `sk-`, loose in a note.
    ['note: ctx7sk-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d end', 'API key'],
    ['Authorization = "Bearer ' + 'Zx9'.repeat(10) + '"', 'bearer token'],
    ['{ "accessToken": "' + 'd'.repeat(32) + '" }', 'credential field'],
    ['refresh_token = "' + 'e'.repeat(32) + '"', 'credential field'],
    ['AKIA' + 'E'.repeat(16), 'AWS key'],
  ];
  for (const [text, kind] of cases) {
    const result = redactSecrets(text);
    assert.deepEqual(result.kinds, [kind], text);
    assert.match(result.text, /<redacted>/, text);
    assert.doesNotMatch(result.text, /a{36}|B{40}|(c1){20}|(f0){14}|(Zx9){10}|d{32}|e{32}|E{16}|5e6f/, text);
  }
  assert.deepEqual(redactSecrets('{ "password": "short" }').kinds, [], 'a short value is a placeholder');
  const key = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA\n-----END OPENSSH PRIVATE KEY-----';
  assert.deepEqual(redactSecrets(key), { text: '<redacted>', kinds: ['private key'] });
  const inJson = JSON.stringify({ a: key.slice(0, 50), b: 'kept' });
  assert.deepEqual(JSON.parse(redactSecrets(inJson).text), { a: '<redacted>', b: 'kept' }, 'a key with no end stops at its quote');
});

test('redactSecrets keeps a JSON document parseable', () => {
  const doc = JSON.stringify({ observations: [{ content: 'used gho_' + 'a'.repeat(36) + ' to push' }] });
  const { text, kinds } = redactSecrets(doc);
  assert.deepEqual(kinds, ['GitHub token']);
  assert.equal(JSON.parse(text).observations[0].content, 'used <redacted> to push');
});

test('collectFiles copies the Claude memory folders and the js-harness home, leaving out its backup and logs', (t) => {
  const home = scratch(t);
  const dest = scratch(t);
  write(path.join(home, '.claude', 'projects', 'D--a', 'memory', 'MEMORY.md'), '- [x](x.md)\n');
  write(path.join(home, '.claude', 'projects', 'D--a', 'memory', 'x.md'), 'fact\n');
  write(path.join(home, '.claude', 'projects', 'D--a', 'transcript.jsonl'), '{}\n');
  fs.mkdirSync(path.join(home, '.claude', 'projects', 'D--empty', 'memory'), { recursive: true });
  write(path.join(home, '.js-harness', 'manifest.json'), '{"v":1}\n');
  write(path.join(home, '.js-harness', 'lead', 'notes.md'), 'lead notes\n');
  write(path.join(home, '.js-harness', 'remote', 'server.log'), 'log line\n');
  write(path.join(home, '.js-harness', 'memory-backup', 'repo', 'big.json'), '{}\n');

  const { files, redacted } = collectFiles({ home, dest });

  assert.deepEqual(files.map((f) => f.path).sort(), [
    'claude/projects/D--a/memory/MEMORY.md',
    'claude/projects/D--a/memory/x.md',
    'js-harness-home/lead/notes.md',
    'js-harness-home/manifest.json',
  ]);
  assert.deepEqual(redacted, []);
  assert.equal(fs.readFileSync(path.join(dest, 'claude/projects/D--a/memory/x.md'), 'utf8'), 'fact\n');
  assert.equal(files.find((f) => f.path.endsWith('x.md')).sha256, sha('fact\n'));
  assert.ok(!fs.existsSync(path.join(dest, 'js-harness-home', 'remote', 'server.log')));
  assert.ok(!fs.existsSync(path.join(dest, 'js-harness-home', 'memory-backup')));
});

test('collectFiles copies a file holding a secret with the value blanked, names it, and removes a stale copy', (t) => {
  const home = scratch(t);
  const dest = scratch(t);
  const secretFile = path.join(home, '.js-harness', 'backups', 'claude.json.before');
  write(secretFile, '{ "oauthToken": "' + 'f'.repeat(40) + '" }\n');
  write(path.join(dest, 'js-harness-home', 'gone.md'), 'a file the home no longer has\n');
  write(path.join(dest, 'engram', 'export.json'), '{}');

  const { files, redacted } = collectFiles({ home, dest });

  const copy = '{ "oauthToken": "<redacted>" }\n';
  assert.deepEqual(files, [{ path: 'js-harness-home/backups/claude.json.before', bytes: copy.length, sha256: sha(copy) }]);
  assert.deepEqual(redacted, [{ path: 'js-harness-home/backups/claude.json.before', kinds: ['credential field'] }]);
  assert.equal(fs.readFileSync(path.join(dest, 'js-harness-home', 'backups', 'claude.json.before'), 'utf8'), copy);
  assert.ok(fs.readFileSync(secretFile, 'utf8').includes('f'.repeat(40)), 'the home itself is never touched');
  assert.ok(!fs.existsSync(path.join(dest, 'js-harness-home', 'gone.md')));
  assert.ok(fs.existsSync(path.join(dest, 'engram', 'export.json')), 'only the copied trees are mirrored');
});

const EXPORT = {
  version: '1',
  exported_at: '2026-10-19T07:00:00Z',
  sessions: [{ id: 's1' }],
  observations: [{ id: 1 }, { id: 2 }],
  prompts: [],
  relations: [{ id: 'r' }],
};

test('exportEngram writes the export where it belongs only after reading it back, and returns its counts', (t) => {
  const dest = scratch(t);
  const calls = [];
  const run = (cmd, args) => {
    calls.push([cmd, ...args]);
    fs.writeFileSync(args[1], JSON.stringify(EXPORT));
    return { status: 0, stdout: '', stderr: '' };
  };

  const result = exportEngram({ dest, run });

  assert.deepEqual(result, { counts: { sessions: 1, observations: 2, prompts: 0, relations: 1 }, changed: true, kinds: [] });
  assert.equal(calls[0][0], 'engram');
  assert.deepEqual([calls[0][1], calls[0][3]], ['export', '--all']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'engram', 'export.json'), 'utf8')), EXPORT);
  assert.deepEqual(fs.readdirSync(path.join(dest, 'engram')), ['export.json'], 'no temporary file is left');
});

test('exportEngram never writes the raw export inside the clone, so a run killed mid-way leaves nothing git would add', (t) => {
  const dest = path.join(scratch(t), 'repo');
  const raw = [];
  const run = (cmd, args) => {
    raw.push(args[1]);
    fs.writeFileSync(args[1], JSON.stringify({ ...EXPORT, observations: [{ id: 1, content: 'token ghp_' + 'a'.repeat(36) }] }));
    // A run the host kills here never reaches its cleanup: what it wrote stays where it was written.
    throw new Error('killed');
  };

  assert.throws(() => exportEngram({ dest, run }), /killed/);

  assert.equal(path.relative(dest, raw[0]).startsWith('..'), true, `the raw export went to ${raw[0]}, inside the clone`);
  const inClone = fs.existsSync(dest) ? fs.readdirSync(dest, { recursive: true }) : [];
  assert.deepEqual(inClone.filter((name) => !fs.statSync(path.join(dest, name)).isDirectory()), []);
});

test('exportEngram keeps the previous export when the new one fails, is not JSON, or lost observations', (t) => {
  const dest = scratch(t);
  write(path.join(dest, 'engram', 'export.json'), JSON.stringify(EXPORT));
  const fails = () => ({ status: 1, stdout: '', stderr: 'database is locked' });
  const garbage = (cmd, args) => {
    fs.writeFileSync(args[1], '{"version": "1", "obs');
    return { status: 0, stdout: '', stderr: '' };
  };
  const shrunk = (cmd, args) => {
    fs.writeFileSync(args[1], JSON.stringify({ ...EXPORT, observations: [] }));
    return { status: 0, stdout: '', stderr: '' };
  };

  assert.throws(() => exportEngram({ dest, run: fails }), /engram export failed: database is locked/);
  assert.throws(() => exportEngram({ dest, run: garbage }), /engram export is not readable JSON/);
  assert.throws(() => exportEngram({ dest, run: shrunk }), /holds 0 observations, the last backup 2/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, 'engram', 'export.json'), 'utf8')), EXPORT);
  assert.deepEqual(fs.readdirSync(path.join(dest, 'engram')), ['export.json']);
});

const exporting = (data) => (cmd, args) => {
  fs.writeFileSync(args[1], JSON.stringify(data));
  return { status: 0, stdout: '', stderr: '' };
};

test('exportEngram refuses a drop of more than a tenth in any count, and allowShrink lets a meant one through', (t) => {
  const dest = scratch(t);
  const big = { ...EXPORT, sessions: Array.from({ length: 20 }, (_, i) => ({ id: i })) };
  write(path.join(dest, 'engram', 'export.json'), JSON.stringify(big));

  const fewerSessions = { ...big, sessions: big.sessions.slice(0, 17) };
  assert.throws(() => exportEngram({ dest, run: exporting(fewerSessions) }), /holds 17 sessions, the last backup 20/);
  const oneLess = { ...big, sessions: big.sessions.slice(0, 19) };
  assert.equal(exportEngram({ dest, run: exporting(oneLess) }).counts.sessions, 19, 'within a tenth is a deletion, not a wipe');
  assert.equal(exportEngram({ dest, run: exporting(EXPORT), allowShrink: true }).counts.sessions, 1);
});

test('exportEngram leaves the file untouched when only exported_at changed', (t) => {
  const dest = scratch(t);
  const file = path.join(dest, 'engram', 'export.json');
  write(file, JSON.stringify(EXPORT));
  const before = fs.readFileSync(file, 'utf8');

  const result = exportEngram({ dest, run: exporting({ ...EXPORT, exported_at: '2026-10-19T08:00:00Z' }) });

  assert.equal(result.changed, false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('exportEngram blanks a secret inside an observation and names its kind', (t) => {
  const dest = scratch(t);
  const leaky = { ...EXPORT, observations: [{ id: 1, content: 'pushed with gho_' + 'a'.repeat(36) }, { id: 2 }] };

  const result = exportEngram({ dest, run: exporting(leaky) });

  assert.deepEqual(result.kinds, ['GitHub token']);
  const written = JSON.parse(fs.readFileSync(path.join(dest, 'engram', 'export.json'), 'utf8'));
  assert.equal(written.observations[0].content, 'pushed with <redacted>');
});

test('parseStats reads the three counts engram stats prints, and null when one is missing', () => {
  const text = 'Engram Memory Stats\n  Sessions:     301\n  Observations: 5074\n  Prompts:      267\n  Projects:     js-harness\n';
  assert.deepEqual(parseStats(text), { sessions: 301, observations: 5074, prompts: 267 });
  assert.equal(parseStats('Engram Memory Stats\n  Sessions: 3\n'), null);
});

test('collectFiles leaves out gate-log and copies the config files under config/', (t) => {
  const home = scratch(t);
  const dest = scratch(t);
  write(path.join(home, '.js-harness', 'gate-log', 'gates.jsonl'), '{}\n');
  write(path.join(home, '.claude', 'CLAUDE.md'), '# global\n');
  write(path.join(home, '.claude', 'scheduled-tasks', 'wake', 'SKILL.md'), 'wake\n');
  write(path.join(home, '.codex', 'config.toml'), 'model = "x"\n');
  write(path.join(home, '.codex', 'auth.json'), '{}\n');
  write(path.join(home, '.engram', 'protocol-mode.json'), '{}\n');

  const { files } = collectFiles({ home, dest });

  assert.deepEqual(files.map((f) => f.path).sort(), [
    'config/claude/CLAUDE.md',
    'config/claude/scheduled-tasks/wake/SKILL.md',
    'config/codex/config.toml',
    'config/engram/protocol-mode.json',
  ]);
});

test('buildManifest holds no time, so the same content gives the same bytes', () => {
  const input = {
    machine: 'DESKTOP-1',
    engramVersion: 'engram v3.4.0',
    counts: { sessions: 1, observations: 2, prompts: 0, relations: 1 },
    live: { sessions: 1, observations: 2, prompts: 0 },
    files: [{ path: 'b', bytes: 1, sha256: 'x' }, { path: 'a', bytes: 2, sha256: 'y' }],
    redacted: [],
  };
  const text = buildManifest(input);
  assert.equal(buildManifest(input), text);
  assert.doesNotMatch(text, /20\d\d-\d\d-\d\dT/);
  assert.deepEqual(JSON.parse(text).files.map((f) => f.path), ['a', 'b'], 'files sorted by path');
});

test('pushRefusal allows only the configured repository, and only while it reads private', () => {
  const ok = { origin: 'https://github.com/jsaristi/js-harness-memory.git', repo: 'jsaristi/js-harness-memory', visibility: 'PRIVATE' };
  assert.equal(pushRefusal(ok), null);
  assert.match(pushRefusal({ ...ok, visibility: 'PUBLIC' }), /reads PUBLIC, not PRIVATE/);
  assert.match(pushRefusal({ ...ok, visibility: null }), /could not be read/);
  assert.match(pushRefusal({ ...ok, origin: 'https://github.com/jsaristi/other.git' }), /origin is jsaristi\/other, not jsaristi\/js-harness-memory/);
  assert.match(pushRefusal({ ...ok, origin: 'https://github.com/jsaristi/js-harness.git' }), /public repository/);
  assert.match(pushRefusal({ ...ok, repo: 'jsaristi/js-harness', origin: 'git@github.com:jsaristi/js-harness.git' }), /public repository/);
});
