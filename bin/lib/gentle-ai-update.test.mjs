import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeMdSnapshots, gentleAiNotice, gentleAiUpdateRow } from './gentle-ai-update.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gentle-ai-update-'));

/** A backup as gentle-ai leaves one before each sync: a folder under ~/.gentle-ai/backups with its manifest and the
 * snapshot archive. Only the manifest is read; the archive is named, never opened. */
function seedBackup(home, id, createdAt, originals) {
  const dir = path.join(home, '.gentle-ai', 'backups', id);
  fs.mkdirSync(dir, { recursive: true });
  const entries = originals.map((original) => ({
    original_path: original,
    snapshot_path: `files/${original.replace(/^([A-Z]:)?[\\/]/, '').replace(/\\/g, '/')}`,
    existed: true,
    mode: 438,
    kind: 'regular',
  }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id, created_at: createdAt, root_dir: dir, entries }));
  fs.writeFileSync(path.join(dir, 'snapshot.tar.gz'), '');
  return dir;
}

test('the snapshots holding the global CLAUDE.md are read from the backup manifests under the home, oldest first', () => {
  const home = tmp();
  try {
    const later = seedBackup(home, '20261016044645.4', '2026-10-16T04:46:45.6Z', ['C:\\Users\\me\\.claude.json', 'C:\\Users\\me\\.claude\\CLAUDE.md']);
    const earlier = seedBackup(home, '20261016044556.1', '2026-10-16T04:45:56.4Z', ['C:\\Users\\me\\.claude\\CLAUDE.md']);
    seedBackup(home, 'upgrade-20261016T044339Z', '2026-10-16T04:43:39.9Z', ['C:\\Users\\me\\AppData\\Roaming\\gga\\AGENTS.md']);
    seedBackup(home, 'mac', '2026-10-16T05:00:00.0Z', ['/Users/me/.claude/CLAUDE.md']);
    const broken = path.join(home, '.gentle-ai', 'backups', 'broken');
    fs.mkdirSync(broken);
    fs.writeFileSync(path.join(broken, 'manifest.json'), '{ not json');

    assert.deepEqual(claudeMdSnapshots(home), [
      { at: '2026-10-16T04:45:56.4Z', dir: earlier, entry: 'files/Users/me/.claude/CLAUDE.md' },
      { at: '2026-10-16T04:46:45.6Z', dir: later, entry: 'files/Users/me/.claude/CLAUDE.md' },
      { at: '2026-10-16T05:00:00.0Z', dir: path.join(home, '.gentle-ai', 'backups', 'mac'), entry: 'files/Users/me/.claude/CLAUDE.md' },
    ]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('no backups folder is no snapshot, never a throw', () => {
  const home = tmp();
  try {
    assert.deepEqual(claudeMdSnapshots(home), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

const NOW = () => new Date('2026-10-16T12:00:00.000Z');
const reviewed = { version: '4.1.1', at: '2026-10-16T04:00:00.000Z' };

test('the first reading with no record is taken as reviewed: the row is ok and the record holds the version', () => {
  const { row, record } = gentleAiUpdateRow({ version: '4.2.0', reviewed: null, snapshots: [], home: '/h', now: NOW });
  assert.deepEqual(row, { id: 'gentle-ai-sync', version: '4.2.0', installed: 'ok', claude: 'ok', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} });
  assert.deepEqual(record, { version: '4.2.0', at: '2026-10-16T12:00:00.000Z' });
});

test('a gentle-ai version since the reviewed one is stale until reviewed: its steps diff the global CLAUDE.md against the first snapshot after the review', () => {
  const snapshots = [
    { at: '2026-10-15T20:00:00.000Z', dir: '/h/.gentle-ai/backups/old', entry: 'files/h/.claude/CLAUDE.md' },
    { at: '2026-10-16T04:45:56.400Z', dir: '/h/.gentle-ai/backups/first', entry: 'files/h/.claude/CLAUDE.md' },
    { at: '2026-10-16T04:46:45.600Z', dir: '/h/.gentle-ai/backups/second', entry: 'files/h/.claude/CLAUDE.md' },
  ];
  const { row, record } = gentleAiUpdateRow({ version: '4.2.0', reviewed, snapshots, home: '/h', now: NOW });
  assert.equal(record, null);
  assert.equal(row.claude, 'stale');
  assert.equal(row.change, 'gentle-ai 4.1.1 → 4.2.0');
  assert.deepEqual(row.fix.claude, [
    'gentle-ai 4.1.1 → 4.2.0 since the last review; review the update:',
    'read the gentle-ai release notes from 4.1.1 to 4.2.0 (https://github.com/Gentleman-Programming/gentle-ai/releases)',
    "diff the global CLAUDE.md, which gentle-ai rewrites on sync, against its copy from before the first sync since the review: diff -u <(cd '/h/.gentle-ai/backups/first' && tar -xzOf snapshot.tar.gz 'files/h/.claude/CLAUDE.md') '/h/.claude/CLAUDE.md'",
    "check each change against the project's AGENTS.md for conflicts: a rule that contradicts it, or a tool it mandates that this machine lacks",
    'report the changes and any conflict to the user',
    'then record the review: js-harness doctor --gentle-ai-reviewed',
  ]);
});

test("an apostrophe in a path is quoted in the diff command, so the shell still reads one argument (Codex, 2026-10-16)", () => {
  const snapshots = [{ at: '2026-10-16T04:45:56.400Z', dir: "/home/o'brien/.gentle-ai/backups/first", entry: "files/home/o'brien/.claude/CLAUDE.md" }];
  const { row } = gentleAiUpdateRow({ version: '4.2.0', reviewed, snapshots, home: "/home/o'brien", now: NOW });
  assert.ok(
    row.fix.claude[2].endsWith(
      `diff -u <(cd '/home/o'\\''brien/.gentle-ai/backups/first' && tar -xzOf snapshot.tar.gz 'files/home/o'\\''brien/.claude/CLAUDE.md') '/home/o'\\''brien/.claude/CLAUDE.md'`,
    ),
    row.fix.claude[2],
  );
});

test('with no snapshot since the review the diff step says so and asks for the whole file to be read', () => {
  const { row } = gentleAiUpdateRow({ version: '4.2.0', reviewed, snapshots: [], home: '/h', now: NOW });
  assert.equal(row.fix.claude[2], 'no copy of the global CLAUDE.md from before the sync was found under ~/.gentle-ai/backups: read /h/.claude/CLAUDE.md whole');
});

test('the same version as the reviewed one is ok; gentle-ai not read is n/a and records nothing', () => {
  assert.equal(gentleAiUpdateRow({ version: '4.1.1', reviewed, snapshots: [], home: '/h', now: NOW }).row.claude, 'ok');
  assert.deepEqual(gentleAiUpdateRow({ version: null, reviewed: null, snapshots: [], home: '/h', now: NOW }), {
    row: { id: 'gentle-ai-sync', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} },
    record: null,
  });
});

test("the hook's notice names the change while it is unreviewed, and nothing otherwise", () => {
  assert.equal(gentleAiNotice(gentleAiUpdateRow({ version: '4.2.0', reviewed, snapshots: [], home: '/h', now: NOW }).row), 'gentle-ai 4.1.1 → 4.2.0 since the last review');
  assert.equal(gentleAiNotice(gentleAiUpdateRow({ version: '4.1.1', reviewed, snapshots: [], home: '/h', now: NOW }).row), '');
  assert.equal(gentleAiNotice(undefined), '');
});
