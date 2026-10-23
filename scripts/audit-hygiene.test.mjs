// Tests of scripts/audit-hygiene.mjs. Each test builds a temporary git repository with commits, runs the script on
// it through the command line and asserts its lines and exit code. Every fake secret is assembled at run time from
// pieces, so this file holds no literal the scan would match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyAllowList, isIgnoredEmail, isPlaceholderName, parseArgs, scanLine } from './audit-hygiene.mjs';

const TOOL = fileURLToPath(new URL('./audit-hygiene.mjs', import.meta.url));
const TOKEN = 'gh' + 'p_' + 'a'.repeat(36);
const MAX_BYTES = 2 * 1024 * 1024;
const SUMMARY = '1 blobs read, 0 skipped (binary or over 2 MB)';

function git(dir, ...args) {
  const result = spawnSync('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
    '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function makeRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-hygiene-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '-q');
  return dir;
}

/** One commit: writes the files (strings or buffers) and removes the listed ones first. */
function commit(dir, files, remove = []) {
  for (const name of remove) fs.rmSync(path.join(dir, name));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'test');
}

function audit(dir, ...args) {
  return spawnSync(process.execPath, [TOOL, '--cwd', dir, ...args], { encoding: 'utf8' });
}

function lines(result) {
  return result.stdout.split('\n').filter(Boolean);
}

test('a token in an old commit that a later commit deletes is found and marked history only', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'old.txt': `token ${TOKEN}\n` });
  commit(dir, { 'kept.txt': 'clean\n' }, ['old.txt']);
  const result = audit(dir);
  assert.equal(result.status, 1, result.stderr);
  const out = lines(result);
  assert.match(out[0], new RegExp(`^secret  ${TOKEN}  old\\.txt@[0-9a-f]{8}:1, 1 blobs, history only$`));
  assert.equal(out[out.length - 1], '1 findings, 0 allowed');
});

test('a token at HEAD is found and marked at HEAD, with the summary line before the count', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'config.txt': `token ${TOKEN}\n` });
  const result = audit(dir);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(lines(result).slice(1), [SUMMARY, '1 findings, 0 allowed']);
  assert.match(lines(result)[0], new RegExp(`^secret  ${TOKEN}  config\\.txt@[0-9a-f]{8}:1, 1 blobs, at HEAD$`));
});

test('the same token in two blobs is one finding with 2 blobs', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'a.txt': `${TOKEN}\n`, 'b.txt': `copy ${TOKEN}\n` });
  const out = lines(audit(dir));
  const secrets = out.filter((line) => line.startsWith('secret  '));
  assert.equal(secrets.length, 1);
  assert.match(secrets[0], new RegExp(`^secret  ${TOKEN}  [ab]\\.txt@[0-9a-f]{8}:1, 2 blobs, at HEAD$`));
  assert.equal(out[out.length - 1], '1 findings, 0 allowed');
});

test('a private key header is found', (t) => {
  const dir = makeRepo(t);
  const header = '-----BEGIN ' + 'OPENSSH ' + 'PRIVATE KEY-----';
  commit(dir, { 'key.pem': `${header}\nAAAA\n` });
  const out = lines(audit(dir));
  assert.match(out[0], new RegExp(`^secret  ${header}  key\\.pem@[0-9a-f]{8}:1, 1 blobs, at HEAD$`));
});

test('a password assignment with a real value is found and the placeholder assignments are not', (t) => {
  const dir = makeRepo(t);
  const weak = 'pass' + "word = '" + 'hunter2hunter2' + "'";
  commit(dir, {
    'settings.txt': [
      weak,
      "token = '<token-value-here>'",
      'api_key: "xxxxxxxxxxxxxxxx"',
      "secret: '${SECRET_FROM_ENV}'",
      "passwd: 'process.env.DB_PASSWORD'",
    ].join('\n') + '\n',
  });
  const result = audit(dir);
  const secrets = lines(result).filter((line) => line.startsWith('secret  '));
  assert.equal(result.status, 1);
  assert.equal(secrets.length, 1);
  assert.match(secrets[0], /^secret  password = '[^']+'  settings\.txt@[0-9a-f]{8}:1, 1 blobs, at HEAD$/);
  assert.equal(secrets[0].split('  ')[1], weak);
});

test('an e-mail address is found, and the noreply and reserved-domain addresses are not', (t) => {
  const dir = makeRepo(t);
  const address = 'jane' + '@mail.io';
  commit(dir, {
    'contact.txt': [
      `write ${address}`,
      'noreply@anthropic.com',
      'dev@corp.test',
      '1234+user@users.noreply.github.com',
      'me@example.com',
    ].join('\n') + '\n',
  });
  const out = lines(audit(dir));
  assert.match(out[0], /^email  jane@mail\.io  contact\.txt@[0-9a-f]{8}:1, 1 blobs, at HEAD$/);
  assert.equal(out.filter((line) => line.startsWith('email  ')).length, 1);
  assert.equal(out[out.length - 1], '1 findings, 0 allowed');
});

test('a personal Windows path is found, and the placeholder user is not', (t) => {
  const dir = makeRepo(t);
  const home = 'C:' + '\\Users\\' + 'Ana';
  commit(dir, { 'notes.txt': [`${home}\\AppData`, 'C:\\Users\\<user>\\AppData', '/Users/<name>/Library', '/home/runner/work'].join('\n') + '\n' });
  const out = lines(audit(dir));
  assert.equal(out[0].split('  ')[0], 'personal-path');
  assert.equal(out[0].split('  ')[1], home);
  assert.match(out[0], /^personal-path  .+  notes\.txt@[0-9a-f]{8}:1, 1 blobs, at HEAD$/);
  assert.equal(out.filter((line) => line.startsWith('personal-path  ')).length, 1);
});

test('a binary blob is skipped and counted, and it holds nothing that is reported', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'data.bin': Buffer.concat([Buffer.from([0]), Buffer.from(TOKEN)]), 'ok.txt': 'clean\n' });
  const result = audit(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result), ['1 blobs read, 1 skipped (binary or over 2 MB)', '0 findings, 0 allowed']);
});

test('a blob over 2 MB is skipped and counted without being read', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'big.txt': Buffer.concat([Buffer.from(`${TOKEN}\n`), Buffer.alloc(MAX_BYTES, 0x61)]), 'ok.txt': 'clean\n' });
  const result = audit(dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result), ['1 blobs read, 1 skipped (binary or over 2 MB)', '0 findings, 0 allowed']);
});

test('an npm access token is found, and an npm_ word of another length is not', () => {
  const npmToken = 'npm' + '_' + 'Ab3'.repeat(12);
  assert.deepEqual(scanLine(`//registry.npmjs.org/:_authToken=${npmToken}`).filter((hit) => hit.kind === 'secret').map((hit) => hit.text), [npmToken]);
  assert.deepEqual(scanLine(`npm_${'a'.repeat(35)} and npm_config_cache`).filter((hit) => hit.kind === 'secret'), []);
  assert.deepEqual(scanLine(`npm_${'a'.repeat(37)} and x_npm_${'a'.repeat(36)}`).filter((hit) => hit.kind === 'secret'), []);
});

test('the current OpenAI key forms and a JSON credential are found', () => {
  for (const key of ['sk-' + 'proj-' + 'Ab1_'.repeat(12), 'sk-' + 'svcacct-' + 'Cd2-'.repeat(12)]) {
    assert.deepEqual(scanLine(`key ${key} here`).filter((hit) => hit.kind === 'secret').map((hit) => hit.text), [key]);
  }
  const json = '{"pass' + 'word":"hunter2hunter2"}';
  assert.deepEqual(scanLine(json).map((hit) => hit.kind), ['secret']);
});

test('the default allow-list is not scanned, so an entry nothing else holds is stale', (t) => {
  const dir = makeRepo(t);
  const allowDir = path.join(dir, 'odd', 'tasks', 'launch-audit', 'allow');
  fs.mkdirSync(allowDir, { recursive: true });
  const entry = { kind: 'email', location: 'ana@corp.io', why: 'gone from every other file' };
  commit(dir, { 'odd/tasks/launch-audit/allow/hygiene.json': JSON.stringify([entry]), 'a.txt': 'clean\n' });
  const result = audit(dir);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(lines(result), [
    'stale-allow  ana@corp.io  no email finding matches this allow entry',
    '1 blobs read, 0 skipped (binary or over 2 MB)',
    '1 findings, 0 allowed',
  ]);
});

test('an allow entry matching a finding counts it as allowed and exits 0', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'a.txt': `${TOKEN}\n` });
  const allow = path.join(dir, '..', `allow-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(allow, JSON.stringify([{ kind: 'secret', location: TOKEN, why: 'test fixture' }]));
  t.after(() => fs.rmSync(allow, { force: true }));
  const result = audit(dir, '--allow', allow);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(lines(result).slice(-1), ['0 findings, 1 allowed']);
  assert.equal(lines(result).some((line) => line.startsWith('secret  ')), false);
});

test('a stale allow entry is a stale-allow finding and exits 1', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'ok.txt': 'clean\n' });
  const location = 'nobody' + '@mail.io';
  const allow = path.join(dir, '..', `stale-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(allow, JSON.stringify([{ kind: 'email', location, why: 'gone' }]));
  t.after(() => fs.rmSync(allow, { force: true }));
  const result = audit(dir, '--allow', allow);
  assert.equal(result.status, 1, result.stderr);
  const out = lines(result);
  assert.match(out[0], new RegExp(`^stale-allow  ${location}  `));
  assert.equal(out[out.length - 1], '1 findings, 0 allowed');
});

test('an unknown argument exits 2 with its line and the usage on stderr', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'ok.txt': 'clean\n' });
  const result = audit(dir, '--bogus');
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.split('\n')[0], 'unknown argument: --bogus');
  assert.match(result.stderr, /^usage: node scripts\/audit-hygiene\.mjs/m);
});

test('--json prints one object with the findings and the allowed count, and nothing else', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'a.txt': `${TOKEN}\n`, 'b.txt': 'clean\n' });
  const result = audit(dir, '--json');
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(report), ['findings', 'allowed']);
  assert.equal(report.allowed, 0);
  assert.equal(report.findings.length, 1);
  assert.deepEqual(Object.keys(report.findings[0]), ['kind', 'location', 'detail']);
  assert.equal(report.findings[0].kind, 'secret');
  assert.equal(report.findings[0].location, TOKEN);
  assert.match(report.findings[0].detail, /^a\.txt@[0-9a-f]{8}:1, 1 blobs, at HEAD$/);
});

test('an explicit allow file that does not exist exits 2', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'ok.txt': 'clean\n' });
  const result = audit(dir, '--allow', path.join(dir, '..', `missing-${process.pid}-${Date.now()}.json`));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^audit-hygiene: allow list not found: /m);
});

test('an allow entry without a why exits 2 and hides nothing', (t) => {
  const dir = makeRepo(t);
  commit(dir, { 'ok.txt': 'clean\n' });
  const allow = path.join(dir, '..', `nowhy-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(allow, JSON.stringify([{ kind: 'email', location: 'a@b.co' }]));
  t.after(() => fs.rmSync(allow, { force: true }));
  const result = audit(dir, '--allow', allow);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^audit-hygiene: allow list .* must be an array of \{ kind, location, why \}$/m);
});

test('parseArgs names an unknown argument and takes the flags it knows', () => {
  assert.equal(parseArgs(['--bogus']).error, 'unknown argument: --bogus');
  assert.equal(parseArgs(['--allow']).error, '--allow takes a value');
  const options = parseArgs(['--json', '--allow', 'x.json', '--cwd', 'repo']);
  assert.equal(options.json, true);
  assert.equal(options.allow, 'x.json');
  assert.equal(options.cwd, 'repo');
});

test('a placeholder user name is not a person; the names of people and of the profiles are', () => {
  for (const name of ['<user>', '<name>', 'USER', 'USERNAME', 'you', 'me', 'runner', '$USER', '%USERNAME%', 'Public']) {
    assert.equal(isPlaceholderName(name), true, name);
  }
  assert.equal(isPlaceholderName('Ana'), false);
});

test('the reserved and noreply addresses are ignored and an ordinary one is not', () => {
  for (const address of ['noreply@anthropic.com', '1234+user@users.noreply.github.com', 'a@example.com',
    'a@example.org', 'a@example.net', 'dev@corp.test', 'dev@corp.invalid', 'dev@app.localhost']) {
    assert.equal(isIgnoredEmail(address), true, address);
  }
  assert.equal(isIgnoredEmail('jane' + '@mail.io'), false);
});

test('a POSIX home is found once, and a drive path is not reported a second time', () => {
  assert.deepEqual(scanLine('/home/' + 'ana' + '/src').map((hit) => hit.text), ['/home/ana']);
  assert.deepEqual(scanLine('C:/Users/' + 'Ana/x').map((hit) => hit.text), ['C:/Users/Ana']);
  assert.deepEqual(scanLine('/home/runner/work'), []);
});

test('applyAllowList matches on kind and location and reports every entry that matches nothing', () => {
  const hits = [
    { kind: 'secret', location: 'one', atHead: { path: 'a', sha: 'a'.repeat(40), line: 1 }, first: null, blobs: new Set(['x']) },
    { kind: 'email', location: 'two', atHead: null, first: { path: 'b', sha: 'b'.repeat(40), line: 2 }, blobs: new Set(['y', 'z']) },
  ];
  const { findings, allowed } = applyAllowList(hits, [
    { kind: 'secret', location: 'one', why: 'fixture' },
    { kind: 'secret', location: 'two', why: 'wrong kind' },
  ]);
  assert.equal(allowed, 1);
  assert.deepEqual(findings.map((finding) => [finding.kind, finding.location]), [
    ['email', 'two'],
    ['stale-allow', 'two'],
  ]);
  assert.equal(findings[0].detail, `b@${'b'.repeat(8)}:2, 2 blobs, history only`);
});
