import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { redactSecrets, collectFiles, exportEngram, parseStats, buildManifest, pushRefusal, repoOf, scopeArgs, inScope } from './backup.mjs';

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

test('redactSecrets blanks a credential field inside a JSON string, the shape an Engram export gives it', () => {
  const doc = JSON.stringify({ observations: [{ content: '{"password":"' + 'z'.repeat(32) + '"} and api_key="' + 'y'.repeat(24) + '"' }] });
  const { text, kinds } = redactSecrets(doc);
  assert.deepEqual(kinds, ['credential field']);
  assert.equal(JSON.parse(text).observations[0].content, '{"password":"<redacted>"} and api_key="<redacted>"');
});

test('redactSecrets blanks a private key up to its end line and keeps the prose after it', () => {
  const body = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ';
  const key = `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n${body}\n-----END OPENSSH PRIVATE KEY-----`;
  assert.equal(redactSecrets(`${key}\nImportant memory about the project.`).text, '<redacted>\nImportant memory about the project.');
  const inJson = JSON.stringify({ note: `${key}\nkept words`, next: 'kept' });
  assert.deepEqual(JSON.parse(redactSecrets(inJson).text), { note: '<redacted>\nkept words', next: 'kept' });
  // A key cut before its end line is blanked through its base64 lines, and the line after them stays.
  const cut = `-----BEGIN RSA PRIVATE KEY-----\n${body}\n${body}\nImportant memory about the project.`;
  assert.equal(redactSecrets(cut).text, '<redacted>\nImportant memory about the project.');
  // With no end line, a body pasted on one line or split by spaces, or a cut one whose last line runs into an
  // ellipsis, is blanked as well: no base64 run of the key is left.
  for (const [text, rest] of [
    [`-----BEGIN RSA PRIVATE KEY----- ${body} ${body}`, ''],
    [`-----BEGIN RSA PRIVATE KEY-----\n${body}\n${body}... and so on`, '... and so on'],
  ]) {
    assert.equal(redactSecrets(text).text, `<redacted>${rest}`, text);
  }
});

test('redactSecrets keeps a JSON document parseable', () => {
  const doc = JSON.stringify({ observations: [{ content: 'used gho_' + 'a'.repeat(36) + ' to push' }] });
  const { text, kinds } = redactSecrets(doc);
  assert.deepEqual(kinds, ['GitHub token']);
  assert.equal(JSON.parse(text).observations[0].content, 'used <redacted> to push');
});

test('collectFiles copies the Claude memory folders and the js-harness home, leaving out its backup, logs and what a restore left', (t) => {
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
  write(path.join(home, '.js-harness', 'restored-config', 'claude', 'settings.json'), '{}\n');
  write(path.join(home, '.js-harness', 'restored-bundles', 'p-1.bundle'), 'bundle\n');
  write(path.join(home, '.js-harness', 'restore-progress.json'), '{}\n');
  write(path.join(home, '.js-harness', 'codex-review-homes', 'run-1', 'auth.json'), '{"tokens":{"id_token":"x"}}\n');
  write(path.join(home, '.js-harness', 'codex-review-homes', 'run-1', 'thread-writer-locks', 'a.lock'), '');

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
  assert.ok(!files.some((f) => /codex-review-homes|auth\.json/.test(f.path)), "Codex's login link never reaches the backup");
  assert.ok(!fs.existsSync(path.join(dest, 'js-harness-home', 'codex-review-homes')));
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

test('a project scope keeps only the memory folders of that project and removes the stale copy of another', (t) => {
  const home = scratch(t);
  const dest = scratch(t);
  for (const slug of ['D--proj', 'D--proj--claude-worktrees-x', 'D--other', 'D--proj-lab', 'C--Temp-claude-D--proj-1234-scratchpad']) {
    write(path.join(home, '.claude', 'projects', slug, 'memory', 'MEMORY.md'), `${slug}\n`);
  }
  write(path.join(dest, 'claude', 'projects', 'D--other', 'memory', 'MEMORY.md'), 'copied under the old scope\n');

  const { files } = collectFiles({ home, dest, scope: 'proj' });

  assert.deepEqual(files.map((f) => f.path).sort(), [
    'claude/projects/D--proj--claude-worktrees-x/memory/MEMORY.md',
    'claude/projects/D--proj/memory/MEMORY.md',
  ]);
  assert.ok(!fs.existsSync(path.join(dest, 'claude', 'projects', 'D--other')), 'nothing of another project stays in the clone');
  assert.equal(collectFiles({ home, dest: scratch(t), scope: 'all' }).files.length, 5);
});

test('scopeArgs and inScope read one scope value: "all" or one project name', () => {
  assert.deepEqual(scopeArgs('all'), ['--all']);
  assert.deepEqual(scopeArgs('js-harness'), ['--project', 'js-harness']);
  assert.equal(inScope('D--anything', 'all'), true);
  assert.equal(inScope('D--js-harness', 'js-harness'), true);
  assert.equal(inScope('D--js-harness--claude-worktrees-a', 'js-harness'), true);
  assert.equal(inScope('D--harness', 'js-harness'), false);
  assert.equal(inScope('D--js-harness-worktrees-a', 'js-harness'), false);
  assert.throws(() => scopeArgs(''), /scope/);
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

test('exportEngram exports one project under a project scope', (t) => {
  const dest = scratch(t);
  const calls = [];
  const run = (cmd, args) => {
    calls.push(args);
    fs.writeFileSync(args[1], JSON.stringify(EXPORT));
    return { status: 0, stdout: '', stderr: '' };
  };

  exportEngram({ dest, run, scope: 'js-harness' });

  assert.deepEqual(calls[0].slice(2), ['--project', 'js-harness']);
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

test('exportEngram refuses a wipe of one project the totals hide, and allowShrink lets it through', (t) => {
  const dest = scratch(t);
  const of = (project, n) => Array.from({ length: n }, (_, i) => ({ id: `${project}-${i}`, project }));
  const before = { ...EXPORT, observations: [...of('big', 400), ...of('client', 30), ...of('tiny', 5)] };
  write(path.join(dest, 'engram', 'export.json'), JSON.stringify(before));

  // 30 of 435 is under a tenth of the total, so only the per-project check sees it.
  const clientGone = { ...before, observations: [...of('big', 400), ...of('tiny', 5)] };
  assert.throws(
    () => exportEngram({ dest, run: exporting(clientGone) }),
    (error) => /1 project lost more than a tenth of its observations/.test(error.message) && /restore it first/.test(error.message) && error.projects?.[0]?.project === 'client',
  );
  const clientHalved = { ...before, observations: [...of('big', 400), ...of('client', 15), ...of('tiny', 5)] };
  assert.throws(() => exportEngram({ dest, run: exporting(clientHalved) }), /1 project lost/);
  // A project under 20 observations is too small to tell a wipe from a cleanup.
  const tinyGone = { ...before, observations: [...of('big', 400), ...of('client', 30)] };
  assert.equal(exportEngram({ dest, run: exporting(tinyGone) }).counts.observations, 430);
  assert.equal(exportEngram({ dest, run: exporting({ ...tinyGone, observations: of('big', 400) }), allowShrink: true }).counts.observations, 400);
});

test('the refusal of a total drop says to restore first, never to force it', (t) => {
  const dest = scratch(t);
  write(path.join(dest, 'engram', 'export.json'), JSON.stringify({ ...EXPORT, sessions: Array.from({ length: 20 }, (_, i) => ({ id: i })) }));
  assert.throws(() => exportEngram({ dest, run: exporting(EXPORT) }), /restore it first \(js-harness backup restore --from .+ --merge\); --allow-shrink only when the drop is meant/);
  // One argument even where the home has a space (Codex).
  assert.throws(() => exportEngram({ dest, run: exporting(EXPORT) }), (error) => error.message.includes(`--from "${dest}" --merge`));
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

test('collectFiles copies the plugin lists and Claude Desktop\'s notes and presets as reference copies, secrets blanked', (t) => {
  const home = scratch(t);
  const desktop = scratch(t);
  const dest = scratch(t);
  write(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), '{"plugins":{}}\n');
  write(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), '{"m":{}}\n');
  write(path.join(home, '.claude', 'plugins', 'cache', 'big.bin'), 'not a list');
  write(path.join(desktop, 'side-session-notes', 'local_1', 'state.md'), `token ghp_${'b'.repeat(36)}\n`);
  write(path.join(desktop, 'ccd-session-presets.json'), '{"presets":[]}\n');
  write(path.join(desktop, 'config.json'), '{"desktop":"settings"}\n');

  const { files, redacted } = collectFiles({ home, dest, desktop });

  assert.deepEqual(files.map((f) => f.path).sort(), [
    'config/claude-desktop/ccd-session-presets.json',
    'config/claude-desktop/side-session-notes/local_1/state.md',
    'config/claude/plugins/installed_plugins.json',
    'config/claude/plugins/known_marketplaces.json',
  ]);
  assert.equal(fs.readFileSync(path.join(dest, 'config', 'claude-desktop', 'side-session-notes', 'local_1', 'state.md'), 'utf8'), 'token <redacted>\n');
  assert.deepEqual(redacted, [{ path: 'config/claude-desktop/side-session-notes/local_1/state.md', kinds: ['GitHub token'] }]);
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
  const ok = { urls: ['https://github.com/jsaristi/js-harness-memory.git'], repo: 'jsaristi/js-harness-memory', visibility: 'PRIVATE' };
  assert.equal(pushRefusal(ok), null);
  assert.match(pushRefusal({ ...ok, visibility: 'PUBLIC' }), /reads PUBLIC, not PRIVATE/);
  assert.match(pushRefusal({ ...ok, visibility: null }), /could not be read/);
  assert.match(pushRefusal({ ...ok, urls: ['https://github.com/jsaristi/other.git'] }), /remote is jsaristi\/other, not jsaristi\/js-harness-memory/);
  assert.match(pushRefusal({ ...ok, urls: ['https://github.com/jsaristi/js-harness.git'] }), /public repository/);
  assert.match(pushRefusal({ ...ok, repo: 'jsaristi/js-harness', urls: ['git@github.com:jsaristi/js-harness.git'] }), /public repository/);
  // Every URL a push may use is checked: a push URL beside a good fetch URL is where the backup would go.
  assert.match(pushRefusal({ ...ok, urls: [...ok.urls, 'https://github.com/jsaristi/js-harness.git'] }), /public repository/);
  assert.match(pushRefusal({ ...ok, urls: [...ok.urls, 'D:/elsewhere.git'] }), /remote is D:\/elsewhere.git, not/);
  assert.match(pushRefusal({ ...ok, urls: [] }), /no remote/);
});

test('repoOf reads only github.com itself, over https or ssh', () => {
  assert.equal(repoOf('https://github.com/o/n.git'), 'o/n');
  assert.equal(repoOf('https://user@github.com/o/n'), 'o/n');
  assert.equal(repoOf('git@github.com:o/n.git'), 'o/n');
  assert.equal(repoOf('ssh://git@github.com/o/n.git'), 'o/n');
  for (const url of ['https://notgithub.com/o/n.git', 'https://github.com.evil.example/o/n.git', 'https://evil.example/github.com/o/n.git', 'http://github.com/o/n.git', 'D:/github.com/o/n.git']) {
    assert.equal(repoOf(url), null, url);
  }
});
