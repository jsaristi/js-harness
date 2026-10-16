// The gentle-ai-sync row of `doctor`: the installed gentle-ai version against the version last reviewed (the
// `gentleAi` record of the doctor cache, bin/lib/cache.mjs). A gentle-ai sync rewrites the global CLAUDE.md, which
// gentle-ai owns and js-harness never writes, so a new version stays a gap until its review is recorded
// (`doctor --gentle-ai-reviewed`); one review step diffs that file against the copy gentle-ai saved before the sync
// (odd/tasks/gentle-ai-update-check.md). Every read fails open: nothing here throws.
import fs from 'node:fs';
import path from 'node:path';

const RELEASES = 'https://github.com/Gentleman-Programming/gentle-ai/releases';
const CLAUDE_MD = /(^|[\\/])\.claude[\\/]CLAUDE\.md$/i;

const posix = (file) => file.replace(/\\/g, '/');
/** One shell word in single quotes: an apostrophe inside closes the quote, escapes itself, and reopens it. */
const quote = (word) => `'${word.replace(/'/g, "'\\''")}'`;

/** `[{ at, dir, entry }]`, oldest first: the gentle-ai backups under `home` whose snapshot holds the global
 * CLAUDE.md, with the backup's folder and the file's path inside `snapshot.tar.gz`. gentle-ai takes one before each
 * sync, so the first one after a review holds the file as that review left it. Only the manifests are read. */
export function claudeMdSnapshots(home) {
  const root = path.join(home, '.gentle-ai', 'backups');
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const snapshots = [];
  for (const name of names) {
    const dir = path.join(root, name);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    } catch {
      continue;
    }
    const entry = Array.isArray(manifest?.entries)
      ? manifest.entries.find((item) => typeof item?.original_path === 'string' && CLAUDE_MD.test(item.original_path) && typeof item.snapshot_path === 'string')
      : undefined;
    if (entry && typeof manifest.created_at === 'string') snapshots.push({ at: manifest.created_at, dir, entry: entry.snapshot_path });
  }
  return snapshots.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** The diff step: the global CLAUDE.md against the copy in the first snapshot taken after the review. */
function diffStep(reviewed, snapshots, home) {
  const claudeMd = posix(path.join(home, '.claude', 'CLAUDE.md'));
  const since = snapshots.find((snapshot) => Date.parse(snapshot.at) > Date.parse(reviewed.at));
  if (!since) return `no copy of the global CLAUDE.md from before the sync was found under ~/.gentle-ai/backups: read ${claudeMd} whole`;
  // `cd` first: Git Bash's tar takes a drive letter in an archive path for a remote host.
  const before = `cd ${quote(posix(since.dir))} && tar -xzOf snapshot.tar.gz ${quote(since.entry)}`;
  return `diff the global CLAUDE.md, which gentle-ai rewrites on sync, against its copy from before the first sync since the review: diff -u <(${before}) ${quote(claudeMd)}`;
}

/** `{ row, record }`: the `gentle-ai-update` row for the installed gentle-ai `version` (the gentle-ai row's, `null`
 * when it was not read) and the `reviewed` record (or `null`), and the record to write: the version read, taken as
 * reviewed, when there is no record yet; `null` otherwise. */
export function gentleAiUpdateRow({ version, reviewed, snapshots, home, now = () => new Date() }) {
  const row = { id: 'gentle-ai-sync', version: null, installed: 'n/a', claude: 'n/a', codex: 'n/a', project: 'n/a', upToDate: 'n/a', fix: {} };
  if (!version) return { row, record: null };
  const read = { ...row, version, installed: 'ok', claude: 'ok' };
  if (!reviewed) return { row: read, record: { version, at: now().toISOString() } };
  if (reviewed.version === version) return { row: read, record: null };
  const change = `gentle-ai ${reviewed.version} → ${version}`;
  read.claude = 'stale';
  read.change = change;
  read.fix.claude = [
    `${change} since the last review; review the update:`,
    `read the gentle-ai release notes from ${reviewed.version} to ${version} (${RELEASES})`,
    diffStep(reviewed, snapshots, home),
    "check each change against the project's AGENTS.md for conflicts: a rule that contradicts it, or a tool it mandates that this machine lacks",
    'report the changes and any conflict to the user',
    'then record the review: js-harness doctor --gentle-ai-reviewed',
  ];
  return { row: read, record: null };
}

/** What the hook's notice adds for this row: the version change since the last review. */
export function gentleAiNotice(row) {
  return row?.claude === 'stale' && row.change ? `${row.change} since the last review` : '';
}
