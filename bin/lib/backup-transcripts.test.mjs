import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  copyTranscripts,
  GITHUB_FILE_LIMIT,
  joinParts,
  listTranscripts,
  PART_MAX_BYTES,
  restoreTranscripts,
  splitParts,
  storedPath,
  transcriptsState,
  verifyTranscripts,
} from './backup-transcripts.mjs';

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-transcripts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Lines of JSON as a transcript holds them, with UTF-8 beyond ASCII, a CRLF and no newline at the very end. */
const transcript = (lines) => Buffer.from(`${Array.from({ length: lines }, (_, i) => JSON.stringify({ n: i, text: `línea ${i} ✓` })).join('\n')}\r\n{"last":true}`);

test('GitHub refuses a file of 100 MiB, and a part is cut well under it', () => {
  assert.equal(GITHUB_FILE_LIMIT, 100 * 1024 * 1024);
  assert.ok(PART_MAX_BYTES < GITHUB_FILE_LIMIT / 2, 'under the 50 MiB GitHub warns at');
});

test('a file is cut by line into parts under the limit, and the parts rejoin byte-identical', () => {
  const file = transcript(200);
  const { parts } = splitParts(file, { max: 1000 });
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(part.length <= 1000, `a part of ${part.length} bytes`);
  for (const part of parts.slice(0, -1)) assert.equal(part.at(-1), 0x0a, 'every part but the last ends at a newline');
  assert.ok(joinParts(parts).equals(file));
  assert.equal(sha256(joinParts(parts)), sha256(file));
});

test('a file under the limit is one part, and an empty file rejoins empty', () => {
  const file = transcript(3);
  assert.deepEqual(splitParts(file, { max: 10_000 }).parts, [file]);
  assert.ok(joinParts(splitParts(Buffer.alloc(0)).parts).equals(Buffer.alloc(0)));
});

test('a file that only grows keeps its earlier parts as they were', () => {
  const before = splitParts(transcript(200), { max: 1000 }).parts;
  const after = splitParts(Buffer.concat([transcript(200), Buffer.from('\n{"more":1}\n'.repeat(80))]), { max: 1000 }).parts;
  for (let i = 0; i < before.length - 1; i += 1) assert.ok(after[i].equals(before[i]), `part ${i + 1} changed`);
});

test('a line longer than a part is a part of its own; one at the GitHub limit is refused', () => {
  const long = Buffer.concat([Buffer.from('a\n'), Buffer.alloc(3000, 0x78), Buffer.from('\nb\n')]);
  const { parts } = splitParts(long, { max: 1000, limit: 5000 });
  assert.equal(parts.length, 3);
  assert.equal(parts[1].length, 3001);
  assert.ok(joinParts(parts).equals(long));
  const refused = splitParts(long, { max: 1000, limit: 3001 });
  assert.equal(refused.parts, undefined);
  assert.match(refused.refusal, /a line of 3001 bytes, and GitHub refuses a file of 3001 bytes or more/);
});

test('the stored path keeps a long slug under Windows\' path limit and two slugs apart', () => {
  const slug = `C--Users-Oficina-AppData-Local-Temp-claude-${'x'.repeat(120)}`;
  const stored = storedPath(`${slug}/0f8e/subagents/agent-a1.jsonl`);
  assert.ok(stored.split('/')[0].length <= 49);
  assert.ok(stored.endsWith('/0f8e/subagents/agent-a1.jsonl'));
  assert.notEqual(storedPath(`${slug}a/s.jsonl`), storedPath(`${slug}b/s.jsonl`));
});

test('listTranscripts finds every .jsonl at any depth and nothing else', (t) => {
  const projects = path.join(scratch(t), 'projects');
  write(path.join(projects, 'D--p', 's1.jsonl'), '{}\n');
  write(path.join(projects, 'D--p', 's1', 'subagents', 'agent-a.jsonl'), '{}\n');
  write(path.join(projects, 'D--p', 's1', 'tool-results', 'r.txt'), 'x');
  write(path.join(projects, 'D--p', 'memory', 'MEMORY.md'), '- a\n');
  assert.deepEqual(listTranscripts(projects), ['D--p/s1.jsonl', 'D--p/s1/subagents/agent-a.jsonl']);
});

/** A home with three transcripts, one of them past the part size, and an empty clone folder. */
function fixture(t) {
  const root = scratch(t);
  const projects = path.join(root, 'home', '.claude', 'projects');
  write(path.join(projects, 'D--p', 'small.jsonl'), '{"a":1}\n');
  write(path.join(projects, 'D--p', 'big.jsonl'), transcript(200));
  write(path.join(projects, 'D--q', 's', 'subagents', 'agent-x.jsonl'), '{"b":2}\n');
  const clone = path.join(root, 'clone');
  fs.mkdirSync(clone, { recursive: true });
  return { root, home: path.join(root, 'home'), projects, clone };
}

test('copyTranscripts writes each file whole or in parts with a manifest, and a restore puts it back identical', (t) => {
  const { root, projects, clone } = fixture(t);
  const result = copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  assert.deepEqual(result.waiting, []);
  assert.deepEqual(result.refused, []);
  const manifest = JSON.parse(fs.readFileSync(path.join(clone, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.map((f) => f.path), ['D--p/big.jsonl', 'D--p/small.jsonl', 'D--q/s/subagents/agent-x.jsonl']);
  const big = manifest.files[0];
  assert.ok(big.parts.length > 1);
  assert.ok(big.parts.every((p) => /\.part\d{3}$/.test(p.path) && p.bytes <= 1000));
  assert.equal(manifest.files[1].parts.length, 1);
  assert.equal(manifest.files[1].parts[0].path, storedPath('D--p/small.jsonl'));
  assert.equal(fs.readFileSync(path.join(clone, '.gitattributes'), 'utf8'), '* -text\n');
  assert.ok(fs.existsSync(path.join(clone, 'RESTORE.md')));

  assert.equal(verifyTranscripts(clone).ok, true);
  assert.match(verifyTranscripts(clone).lines.join('\n'), /ok transcripts: 3 of 3 files byte for byte/);

  const home = path.join(root, 'new-home');
  const out = { text: '', write(chunk) { this.text += chunk; } };
  restoreTranscripts({ from: clone, home, stdout: out });
  for (const f of manifest.files) {
    assert.ok(fs.readFileSync(path.join(home, '.claude', 'projects', f.path)).equals(fs.readFileSync(path.join(projects, f.path))), f.path);
  }
  assert.match(out.text, /transcripts: 3 restored/);
});

test('a restore never writes over a live file, and verify fails on a part that changed', (t) => {
  const { root, projects, clone } = fixture(t);
  copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  const home = path.join(root, 'new-home');
  write(path.join(home, '.claude', 'projects', 'D--p', 'small.jsonl'), 'mine\n');
  const out = { text: '', write(chunk) { this.text += chunk; } };
  restoreTranscripts({ from: clone, home, stdout: out });
  assert.equal(fs.readFileSync(path.join(home, '.claude', 'projects', 'D--p', 'small.jsonl'), 'utf8'), 'mine\n');
  assert.match(out.text, /kept: D--p\/small\.jsonl, a live file is never written over/);

  const manifest = JSON.parse(fs.readFileSync(path.join(clone, 'manifest.json'), 'utf8'));
  fs.appendFileSync(path.join(clone, manifest.files[0].parts[1].path), 'x');
  const checked = verifyTranscripts(clone);
  assert.equal(checked.ok, false);
  assert.match(checked.lines.join('\n'), /FAIL D--p\/big\.jsonl/);
  assert.throws(() => restoreTranscripts({ from: clone, home: path.join(root, 'third'), stdout: out }), /D--p\/big\.jsonl: its part \S+\.part002 does not match its sha256/);
});

test('a second copy rewrites only what changed, keeps a transcript Claude deleted, and moves a grown file to parts', (t) => {
  const { projects, clone } = fixture(t);
  copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  const firstPart = path.join(clone, JSON.parse(fs.readFileSync(path.join(clone, 'manifest.json'), 'utf8')).files[0].parts[0].path);
  const before = Math.floor(fs.statSync(firstPart).mtimeMs / 1000) * 1000;
  fs.rmSync(path.join(projects, 'D--q'), { recursive: true });
  fs.appendFileSync(path.join(projects, 'D--p', 'small.jsonl'), '{"grown":true}\n'.repeat(100));
  fs.utimesSync(firstPart, new Date(before - 60_000), new Date(before - 60_000));
  copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  const manifest = JSON.parse(fs.readFileSync(path.join(clone, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.map((f) => f.path), ['D--p/big.jsonl', 'D--p/small.jsonl', 'D--q/s/subagents/agent-x.jsonl']);
  assert.ok(manifest.files[1].parts.length > 1, 'the grown file is in parts now');
  assert.ok(!fs.existsSync(path.join(clone, storedPath('D--p/small.jsonl'))), 'its whole copy is gone');
  assert.equal(fs.statSync(firstPart).mtimeMs, before - 60_000, 'an unchanged part is not written again');
  assert.equal(verifyTranscripts(clone).ok, true);
});

test('a file stays in the repository that holds it, new files go to the last, and a full one takes no new file', (t) => {
  const { root, projects, clone } = fixture(t);
  copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  write(path.join(projects, 'D--p', 'new.jsonl'), '{"n":1}\n');
  fs.appendFileSync(path.join(projects, 'D--p', 'small.jsonl'), '{"c":3}\n');
  const second = path.join(root, 'clone2');
  fs.mkdirSync(second);
  const clones = [{ name: 'r1', dir: clone }, { name: 'r2', dir: second }];
  copyTranscripts({ projects, clones, partMax: 1000 });
  const paths = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).files.map((f) => f.path);
  assert.deepEqual(paths(second), ['D--p/new.jsonl']);
  assert.ok(paths(clone).includes('D--p/small.jsonl'));
  assert.ok(!paths(clone).includes('D--p/new.jsonl'));

  write(path.join(projects, 'D--p', 'newer.jsonl'), '{"n":2}\n');
  const full = copyTranscripts({ projects, clones, partMax: 1000, full: true });
  assert.deepEqual(full.waiting, ['D--p/newer.jsonl']);
  assert.ok(!paths(second).includes('D--p/newer.jsonl'));
});

test('a file with a line at the GitHub limit is refused by name and the others are copied', (t) => {
  const { projects, clone } = fixture(t);
  write(path.join(projects, 'D--p', 'huge.jsonl'), Buffer.concat([Buffer.alloc(5000, 0x78), Buffer.from('\n')]));
  const result = copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000, limit: 4000 });
  assert.deepEqual(result.refused.map((r) => r.path), ['D--p/huge.jsonl']);
  assert.ok(!JSON.parse(fs.readFileSync(path.join(clone, 'manifest.json'), 'utf8')).files.some((f) => f.path === 'D--p/huge.jsonl'));
});

test('transcriptsState: missing for a new or rewritten file, a note for a live session that only grew', (t) => {
  const { projects, clone } = fixture(t);
  copyTranscripts({ projects, clones: [{ name: 'r1', dir: clone }], partMax: 1000 });
  const now = Date.now();
  assert.deepEqual(transcriptsState({ projects, clones: [{ name: 'r1', dir: clone }], now }), { missing: [], notes: [] });

  fs.appendFileSync(path.join(projects, 'D--p', 'small.jsonl'), '{"live":1}\n');
  let state = transcriptsState({ projects, clones: [{ name: 'r1', dir: clone }], now });
  assert.deepEqual(state.missing, []);
  assert.match(state.notes[0], /1 transcripts grew in the last 15 minutes/);

  const old = new Date(now - 60 * 60_000);
  fs.utimesSync(path.join(projects, 'D--p', 'small.jsonl'), old, old);
  write(path.join(projects, 'D--p', 'new.jsonl'), '{}\n');
  fs.writeFileSync(path.join(projects, 'D--p', 'big.jsonl'), 'rewritten\n');
  state = transcriptsState({ projects, clones: [{ name: 'r1', dir: clone }], now });
  assert.match(state.missing.join('\n'), /1 transcripts are in no backup/);
  assert.match(state.missing.join('\n'), /2 transcripts changed since the last transcripts backup/);
});
