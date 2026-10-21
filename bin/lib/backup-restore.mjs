// The way back from a backup (odd/tasks/memory-backup.md, D5): `restoreBackup` puts a backup clone into a home,
// `verifyBackup` proves one by restoring it into a scratch home and reading it back, and `verifySummary` proves the
// public summary. They take a local folder; the command clones a URL into one first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { defaultRun, exportCounts, parseStats, readJson, walk } from './backup.mjs';
import { privacyCheck } from './backup-summary.mjs';
import { projectSlug } from './sessions.mjs';

const COUNTED = ['sessions', 'observations', 'prompts', 'relations'];
const SECTIONS = ['## State', '## Open work', '## Features in flight', '## Decisions'];

/** The name Claude gives a checkout's memory folder: `D:\js-harness` is `D--js-harness`. A slug stays as it is. */
export function slugOf(place) {
  return projectSlug(place);
}

function slugMap(map) {
  return Object.fromEntries(Object.entries(map).map(([from, to]) => [slugOf(from), slugOf(to)]));
}

/** Where a file of the backup lands in `home`, or null for one a restore leaves out. */
function restoredPath(home, relative, slugs) {
  const [root, ...rest] = relative.split('/');
  if (root === 'claude' && rest[0] === 'projects') {
    const [, slug, ...inside] = rest;
    return path.join(home, '.claude', 'projects', slugs[slug] ?? slug, ...inside);
  }
  // The install manifest records an install the new machine does not have yet; `install` writes its own.
  if (root === 'js-harness-home') return rest.join('/') === 'manifest.json' ? null : path.join(home, '.js-harness', ...rest);
  if (root === 'config') return path.join(home, '.js-harness', 'restored-config', ...rest);
  if (root === 'git') return path.join(home, '.js-harness', 'restored-bundles', ...rest);
  return null;
}

/** Copies every file under `from/<root>` to where it lands in `home`. A live file is never written over, unless the
 * copy is only for him to compare (`overwrite`); the files kept are returned. */
function place(from, root, home, slugs, { overwrite = false } = {}) {
  const kept = [];
  for (const inside of walk(path.join(from, root))) {
    const relative = `${root}/${inside}`;
    const target = restoredPath(home, relative, slugs);
    if (!target) continue;
    if (!overwrite && fs.existsSync(target)) {
      kept.push(relative);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, relative), target);
  }
  return kept;
}

/** Restores the backup clone `from` into `home`, in D5's order: Engram, the memory folders (`map` moves a project now
 * at another path), the js-harness home, the config copies beside the live files, the bundles beside them with the line
 * that fetches them. Refuses a home whose Engram already holds observations unless `merge`. */
export function restoreBackup({ from, home, merge = false, map = {}, run = defaultRun, env = process.env, stdout }) {
  const manifest = readJson(path.join(from, 'manifest.json'));
  if (!manifest) throw new Error(`no manifest.json in ${from}: it holds no backup`);
  const say = (line) => stdout.write(`${line}\n`);
  const dataDir = path.join(home, '.engram');
  const engramEnv = { ...env, ENGRAM_DATA_DIR: dataDir };

  const installed = run('engram', ['version'], { env: engramEnv }).stdout.trim();
  if (manifest.engramVersion && installed !== manifest.engramVersion) {
    say(`warning: the backup was made with ${manifest.engramVersion}, this machine has ${installed || 'no engram'}`);
  }
  // The import is the one step a re-run must not repeat, so it is marked done: a restore stopped by a later copy runs
  // again without doubling the observations.
  const progressFile = path.join(home, '.js-harness', 'restore-progress.json');
  const backupId = sha256(path.join(from, 'manifest.json'));
  const progress = readJson(progressFile);
  const exportFile = path.join(from, 'engram', 'export.json');
  const stats = run('engram', ['stats', '--all'], { env: engramEnv });
  const held = stats.status === 0 ? parseStats(stats.stdout) : null;
  // The mark is trusted only while that Engram still holds observations: one emptied since gets the import again.
  if (progress?.manifest === backupId && progress.dataDir === dataDir && held?.observations > 0) {
    say(`engram: this backup was already imported into ${dataDir} at ${progress.importedAt}`);
  } else {
    if (!merge) {
      if (!held) {
        throw new Error(
          `could not read how many observations the Engram in ${dataDir} holds (${(stats.stderr || stats.stdout).trim() || 'no counts'}): ` +
            'refused, so a restore never doubles them (--merge adds the backup to them)',
        );
      }
      if (held.observations > 0) {
        throw new Error(
          `the Engram in ${dataDir} already holds ${held.observations} observations: refused, so a restore never doubles them ` +
            '(--merge adds the backup to them)',
        );
      }
    }
    const imported = run('engram', ['import', exportFile], { env: engramEnv });
    if (imported.status !== 0) throw new Error(`engram import failed: ${(imported.stderr || imported.stdout).trim()}`);
    fs.mkdirSync(path.dirname(progressFile), { recursive: true });
    fs.writeFileSync(progressFile, `${JSON.stringify({ manifest: backupId, dataDir, importedAt: new Date().toISOString() })}\n`);
    say(`engram: ${exportCounts(readJson(exportFile)).observations} observations imported into ${dataDir}`);
  }

  const slugs = slugMap(map);
  const backedUp = fs.existsSync(path.join(from, 'claude', 'projects')) ? fs.readdirSync(path.join(from, 'claude', 'projects')) : [];
  for (const [old, now] of Object.entries(map)) {
    if (!backedUp.includes(slugOf(old))) say(`warning: --map ${old}=${now} matched no project of the backup (${slugOf(old)})`);
  }
  for (const slug of backedUp) {
    say(`memory: ${slug} -> ${path.join(home, '.claude', 'projects', slugs[slug] ?? slug, 'memory')}`);
  }
  const kept = [...place(from, 'claude', home, slugs), ...place(from, 'js-harness-home', home, slugs)];
  place(from, 'config', home, slugs, { overwrite: true });
  say(`config: reference copies in ${path.join(home, '.js-harness', 'restored-config')}, to compare with the live files`);
  for (const relative of kept) say(`kept: ${relative}, a live file is never written over`);

  // The bundles, and beside them each repository's worktree patches and js-harness records: they are put back by hand,
  // in a checkout that may not exist yet, so every copy comes with the line that uses it.
  const bundles = path.join(home, '.js-harness', 'restored-bundles');
  place(from, 'git', home, slugs, { overwrite: true });
  for (const name of walk(path.join(from, 'git')).filter((name) => name.endsWith('.bundle'))) {
    // Quoted, so a home with a space (C:\Users\First Last) stays one argument.
    say(`commits on no remote: in the checkout they came from, git fetch "${path.join(bundles, name)}" '+refs/*:refs/restored/*'`);
  }
  for (const entry of (manifest.bundles ?? []).filter((b) => b.folder)) {
    const folder = path.join(bundles, entry.folder);
    for (const w of entry.worktrees ?? []) {
      if (w.patch) say(`uncommitted edits of ${w.path}: git -C "${w.path}" apply "${path.join(folder, 'worktrees', `${w.key}.patch`)}"`);
      if (w.untracked) say(`  its untracked files are in ${path.join(folder, 'worktrees', `${w.key}.untracked`)}`);
      if (w.binary) say(`  its changed binary files are in ${path.join(folder, 'worktrees', `${w.key}.binary`)}: copy them over the checkout after the patch`);
    }
    if (fs.existsSync(path.join(folder, 'js-harness'))) {
      say(`js-harness records of ${entry.source}: copy ${path.join(folder, 'js-harness')} into its .git/js-harness/, so its reviewed commits need no new review`);
    }
  }
  return { manifest, kept, slugs };
}

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Restores the backup clone `from` into a scratch home under `tmp`, exports Engram there and checks the four counts
 * against the manifest and the manifest's against the live Engram it recorded, then every backed-up file byte for byte.
 * The scratch home is removed whatever happens. */
export function verifyBackup({ from, run = defaultRun, env = process.env, tmp = os.tmpdir() }) {
  const home = fs.mkdtempSync(path.join(tmp, 'backup-verify-'));
  const lines = [];
  let ok = true;
  try {
    const { manifest, slugs } = restoreBackup({ from, home, run, env, stdout: { write: () => {} } });
    const out = path.join(home, 'verify-export.json');
    const exported = run('engram', ['export', out, '--all'], { env: { ...env, ENGRAM_DATA_DIR: path.join(home, '.engram') } });
    if (exported.status !== 0) throw new Error(`engram export failed in the scratch home: ${(exported.stderr || exported.stdout).trim()}`);
    const counts = exportCounts(readJson(out));
    for (const key of COUNTED) {
      const backed = manifest.export?.[key];
      const live = manifest.live?.[key];
      const good = counts[key] === backed && (live === undefined || live === backed);
      ok &&= good;
      lines.push(`${good ? 'ok' : 'FAIL'} ${key}: ${counts[key]} restored, ${backed} backed up, ${live === undefined ? 'not counted live' : `${live} live`}`);
    }
    let same = 0;
    for (const file of manifest.files ?? []) {
      const where = restoredPath(home, file.path, slugs) ?? path.join(from, file.path);
      if (fs.existsSync(where) && sha256(where) === file.sha256) same += 1;
      else lines.push(`FAIL differs from the manifest: ${file.path}`);
    }
    const total = (manifest.files ?? []).length;
    ok &&= same === total;
    lines.push(`${same === total ? 'ok' : 'FAIL'} files: ${same} of ${total} byte for byte`);
  } catch (error) {
    ok = false;
    lines.push(`FAIL ${error.message}`);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  return { ok, lines };
}

/** Checks the public summary `text`: its four sections, and no line the privacy check would drop, with the terms list
 * when there is one (`terms` null says there is none). */
export function verifySummary({ text, terms }) {
  const lines = [];
  const all = text.split(/\r?\n/);
  const missing = SECTIONS.filter((section) => !all.includes(section));
  for (const section of missing) lines.push(`FAIL no ${section} section`);
  if (!missing.length) lines.push(`ok sections: ${SECTIONS.join(', ')}`);
  const { dropped } = privacyCheck(all, terms ?? []);
  lines.push(`${dropped ? 'FAIL' : 'ok'} privacy: ${dropped} lines the check would drop`);
  if (terms === null) lines.push('note: no private-terms.txt here: checked emails, secrets and home paths only');
  return { ok: !missing.length && !dropped, lines };
}
