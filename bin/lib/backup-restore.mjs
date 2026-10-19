// The way back from a backup (odd/tasks/memory-backup.md, D5): `restoreBackup` puts a backup clone into a home,
// `verifyBackup` proves one by restoring it into a scratch home and reading it back, and `verifySummary` proves the
// public summary. They take a local folder; the command clones a URL into one first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { defaultRun, exportCounts, parseStats, readJson, walk } from './backup.mjs';
import { privacyCheck } from './backup-summary.mjs';

const COUNTED = ['sessions', 'observations', 'prompts', 'relations'];
const SECTIONS = ['## State', '## Open work', '## Features in flight', '## Decisions'];

/** The name Claude gives a checkout's memory folder: `D:\js-harness` is `D--js-harness`. A slug stays as it is. */
export function slugOf(place) {
  return place.replace(/[:\\/.]/g, '-');
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
  const held = parseStats(run('engram', ['stats', '--all'], { env: engramEnv }).stdout);
  if (held?.observations > 0 && !merge) {
    throw new Error(
      `the Engram in ${dataDir} already holds ${held.observations} observations: refused, so a restore never doubles them ` +
        '(--merge adds the backup to them)',
    );
  }
  const exportFile = path.join(from, 'engram', 'export.json');
  const imported = run('engram', ['import', exportFile], { env: engramEnv });
  if (imported.status !== 0) throw new Error(`engram import failed: ${(imported.stderr || imported.stdout).trim()}`);
  say(`engram: ${exportCounts(readJson(exportFile)).observations} observations imported into ${dataDir}`);

  const slugs = slugMap(map);
  for (const slug of fs.existsSync(path.join(from, 'claude', 'projects')) ? fs.readdirSync(path.join(from, 'claude', 'projects')) : []) {
    say(`memory: ${slug} -> ${path.join(home, '.claude', 'projects', slugs[slug] ?? slug, 'memory')}`);
  }
  const kept = [...place(from, 'claude', home, slugs), ...place(from, 'js-harness-home', home, slugs)];
  place(from, 'config', home, slugs, { overwrite: true });
  say(`config: reference copies in ${path.join(home, '.js-harness', 'restored-config')}, to compare with the live files`);
  for (const relative of kept) say(`kept: ${relative}, a live file is never written over`);

  const bundles = path.join(home, '.js-harness', 'restored-bundles');
  for (const name of walk(path.join(from, 'git')).filter((name) => name.endsWith('.bundle'))) {
    fs.mkdirSync(bundles, { recursive: true });
    const target = path.join(bundles, name);
    fs.copyFileSync(path.join(from, 'git', name), target);
    say(`commits on no remote: in the checkout they came from, git fetch ${target} '+refs/heads/*:refs/remotes/restored/*'`);
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
