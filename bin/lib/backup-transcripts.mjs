// The Claude transcripts backup (odd/tasks/transcripts-backup.md): every `~/.claude/projects/**/*.jsonl` copied as
// text into the clones of private repositories of its own, a file past the part size cut by line (D2), and put back
// byte for byte. It reads the transcripts and writes the clones' files, and runs no program: the command
// (`bin/backup.mjs`) clones, commits and pushes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, walk } from './backup.mjs';

/** GitHub refuses a push that holds a file of this size or more. */
export const GITHUB_FILE_LIMIT = 100 * 1024 * 1024;
/** A transcript larger than this is stored in parts: GitHub warns from 50 MiB, and a smaller part makes a day's push the
 * new lines of a long session, not the whole of it. */
export const PART_MAX_BYTES = 40 * 1024 * 1024;
/** A transcript that only grew since the backup and changed this recently belongs to a session running now. */
export const LIVE_MINUTES = 15;

const MANIFEST = 'manifest.json';
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** `buffer` cut by line into parts of at most `max` bytes, each as long as it can be, every part but the last ending at
 * a newline; a line longer than `max` is a part of its own. Cut from the start, so a file that only grows keeps its
 * earlier parts. `{ refusal }` instead when a line reaches `limit`, which no part can hold. */
export function splitParts(buffer, { max = PART_MAX_BYTES, limit = GITHUB_FILE_LIMIT } = {}) {
  const parts = [];
  let start = 0;
  let pos = 0;
  while (pos < buffer.length) {
    const newline = buffer.indexOf(0x0a, pos);
    const end = newline === -1 ? buffer.length : newline + 1;
    if (end - pos >= limit) {
      return { refusal: `a line of ${end - pos} bytes, and GitHub refuses a file of ${limit} bytes or more` };
    }
    if (pos > start && end - start > max) {
      parts.push(buffer.subarray(start, pos));
      start = pos;
    }
    pos = end;
  }
  parts.push(buffer.subarray(start));
  return { parts };
}

/** The parts of a file back into it. */
export function joinParts(parts) {
  return Buffer.concat(parts);
}

/** Where a transcript, by its path under `projects`, is kept in a clone: its project folder's name cut to 40
 * characters and 8 hex of the whole name's hash, then the rest of the path. A scratch folder's name alone is 150
 * characters, and git on Windows cannot add a path past 260. */
export function storedPath(relative) {
  const [slug, ...rest] = relative.split('/');
  return [`${slug.slice(0, 40)}-${sha256(slug).slice(0, 8)}`, ...rest].join('/');
}

/** Every `.jsonl` under `projects`, at any depth, as sorted paths with forward slashes. */
export function listTranscripts(projects) {
  return walk(projects).filter((relative) => relative.endsWith('.jsonl')).sort();
}

const readManifest = (dir) => readJson(path.join(dir, MANIFEST)) ?? { format: 1, files: [] };

function restoreSteps() {
  return [
    '# Restoring the Claude transcripts',
    '',
    '`manifest.json` names each transcript by its path under `~/.claude/projects`, with its sha256, and the files',
    'that hold it here. A file in parts is those parts joined in order, byte for byte.',
    '',
    'From a js-harness checkout, for each transcripts repository:',
    '',
    '    node bin/js-harness.mjs backup restore --transcripts <this repository\'s URL>',
    '',
    'It never writes over a live file. `backup verify --transcripts <URL>` checks every file first.',
    '',
  ].join('\n');
}

/** Copies every transcript under `projects` into `clones` (`[{ name, dir }]`, oldest first): a file stays in the clone
 * whose manifest holds it, a new one goes to the last unless it is `full`. Only what changed is written; a transcript
 * gone from `projects` stays in its manifest, since Claude Code deletes old sessions. Returns the new files that wait
 * for a next repository, the ones no part can hold with why, and how many files changed. */
export function copyTranscripts({ projects, clones, partMax = PART_MAX_BYTES, limit = GITHUB_FILE_LIMIT, full = false }) {
  const manifests = clones.map((clone) => readManifest(clone.dir));
  const holder = new Map();
  manifests.forEach((manifest, i) => manifest.files.forEach((entry) => holder.set(entry.path, { i, entry })));
  const waiting = [];
  const refused = [];
  let changed = 0;
  for (const relative of listTranscripts(projects)) {
    const source = path.join(projects, relative);
    const buffer = fs.readFileSync(source);
    const digest = sha256(buffer);
    const held = holder.get(relative);
    if (held?.entry.sha256 === digest) continue;
    if (!held && full) {
      waiting.push(relative);
      continue;
    }
    const split = splitParts(buffer, { max: partMax, limit });
    if (split.refusal) {
      refused.push({ path: relative, reason: split.refusal });
      continue;
    }
    const i = held?.i ?? clones.length - 1;
    const dir = clones[i].dir;
    const stored = storedPath(relative);
    const before = new Map((held?.entry.parts ?? []).map((part) => [part.path, part.sha256]));
    const parts = split.parts.map((part, n) => {
      const where = split.parts.length === 1 ? stored : `${stored}.part${String(n + 1).padStart(3, '0')}`;
      const entry = { path: where, bytes: part.length, sha256: sha256(part) };
      const target = path.join(dir, where);
      if (before.get(where) !== entry.sha256 || !fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, part);
      }
      return entry;
    });
    for (const old of before.keys()) if (!parts.some((part) => part.path === old)) fs.rmSync(path.join(dir, old), { force: true });
    const entry = { path: relative, bytes: buffer.length, sha256: digest, modified: new Date(fs.statSync(source).mtimeMs).toISOString(), parts };
    manifests[i].files = [...manifests[i].files.filter((f) => f.path !== relative), entry];
    changed += 1;
  }
  clones.forEach((clone, i) => {
    const files = manifests[i].files.sort((a, b) => (a.path < b.path ? -1 : 1));
    fs.writeFileSync(path.join(clone.dir, MANIFEST), `${JSON.stringify({ format: 1, files }, null, 2)}\n`);
    // Every byte as written: under core.autocrlf a commit or a checkout would change line endings.
    fs.writeFileSync(path.join(clone.dir, '.gitattributes'), '* -text\n');
    fs.writeFileSync(path.join(clone.dir, 'RESTORE.md'), restoreSteps());
  });
  return { waiting, refused, changed };
}

/** Whether a manifest's relative path leaves the folder it is read against: absolute, on a drive, or through `..`. A
 * manifest comes from a repository, so a tampered one must not make a restore write or read outside its folders. */
function leaves(relative) {
  return typeof relative !== 'string' || path.isAbsolute(relative) || /^[a-zA-Z]:/.test(relative) || relative.split(/[\\/]/).includes('..');
}

/** Why a manifest entry's paths cannot be used, or null. */
function pathRefusal(entry) {
  if (leaves(entry.path)) return 'its path leaves the projects folder';
  const outside = (entry.parts ?? []).find((part) => leaves(part.path));
  return outside ? `its part ${outside.path} leaves the clone` : null;
}

/** A manifest's file rejoined from its parts in `dir`, or why it cannot be: a path that leaves its folder, a part
 * missing or not its sha256, or the whole not the file's. */
function rejoin(dir, entry) {
  const refusal = pathRefusal(entry);
  if (refusal) return { reason: refusal };
  const parts = [];
  for (const part of entry.parts ?? []) {
    const where = path.join(dir, part.path);
    if (!fs.existsSync(where)) return { reason: `its part ${part.path} is missing` };
    const buffer = fs.readFileSync(where);
    if (sha256(buffer) !== part.sha256) return { reason: `its part ${part.path} does not match its sha256` };
    parts.push(buffer);
  }
  const whole = joinParts(parts);
  if (whole.length !== entry.bytes || sha256(whole) !== entry.sha256) return { reason: `${entry.path} does not match its sha256` };
  return { buffer: whole };
}

/** Rejoins every file of the transcripts clone `dir` and checks it against its manifest, writing nothing. */
export function verifyTranscripts(dir) {
  const manifest = readJson(path.join(dir, MANIFEST));
  if (!manifest) return { ok: false, lines: [`FAIL no ${MANIFEST} in ${dir}: it holds no transcripts backup`] };
  const lines = [];
  let same = 0;
  for (const entry of manifest.files) {
    const { reason } = rejoin(dir, entry);
    if (reason) lines.push(`FAIL ${entry.path}: ${reason}`);
    else same += 1;
  }
  const total = manifest.files.length;
  lines.push(`${same === total ? 'ok' : 'FAIL'} transcripts: ${same} of ${total} files byte for byte`);
  return { ok: same === total, lines };
}

/** Puts every transcript of the clone `from` into `<home>/.claude/projects`, each checked against its sha256 before it
 * is written, with the time it had when it was copied. A live file is never written over. Throws on a file that does
 * not rejoin, naming it. */
export function restoreTranscripts({ from, home, stdout }) {
  const manifest = readJson(path.join(from, MANIFEST));
  if (!manifest) throw new Error(`no ${MANIFEST} in ${from}: it holds no transcripts backup`);
  const projects = path.join(home, '.claude', 'projects');
  // Every path is checked before any file is written, so a tampered manifest restores nothing.
  for (const entry of manifest.files) {
    const refusal = pathRefusal(entry);
    if (refusal) throw new Error(`${entry.path}: ${refusal}`);
  }
  let restored = 0;
  for (const entry of manifest.files) {
    const target = path.join(projects, ...entry.path.split('/'));
    if (fs.existsSync(target)) {
      stdout.write(`kept: ${entry.path}, a live file is never written over\n`);
      continue;
    }
    const { buffer, reason } = rejoin(from, entry);
    if (reason) throw new Error(reason.startsWith(entry.path) ? reason : `${entry.path}: ${reason}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer, { flag: 'wx' });
    if (entry.modified) fs.utimesSync(target, new Date(entry.modified), new Date(entry.modified));
    restored += 1;
  }
  stdout.write(`transcripts: ${restored} restored into ${projects}\n`);
  return { restored };
}

/** What `backup ready` says of the transcripts against the clones' manifests: `missing`, the ones in no backup and the
 * ones changed since; `notes`, the ones that only grew since and changed in the last `LIVE_MINUTES`, a session
 * running now (often the one asking), so the check can pass from inside a session. Counts only: a project folder's
 * name can be a client's. */
export function transcriptsState({ projects, clones, now }) {
  const held = new Map(clones.flatMap((clone) => readManifest(clone.dir).files.map((entry) => [entry.path, entry])));
  let unheld = 0;
  let changed = 0;
  let live = 0;
  for (const relative of listTranscripts(projects)) {
    const source = path.join(projects, relative);
    const entry = held.get(relative);
    if (!entry) {
      unheld += 1;
      continue;
    }
    // Hashing every transcript is seconds of reading: a file with its entry's size and time is taken as unchanged. The
    // entry keeps whole milliseconds, and a time set through utimes can land a hair under one.
    const stat = fs.statSync(source);
    if (stat.size === entry.bytes && entry.modified && Math.abs(stat.mtimeMs - Date.parse(entry.modified)) < 1) continue;
    const buffer = fs.readFileSync(source);
    if (sha256(buffer) === entry.sha256) continue;
    const grew = buffer.length > entry.bytes && sha256(buffer.subarray(0, entry.bytes)) === entry.sha256;
    if (grew && now - stat.mtimeMs < LIVE_MINUTES * 60_000) live += 1;
    else changed += 1;
  }
  const missing = [];
  if (unheld) missing.push(`${unheld} transcripts are in no backup: js-harness backup run --transcripts copies them`);
  if (changed) missing.push(`${changed} transcripts changed since the last transcripts backup: js-harness backup run --transcripts copies them`);
  const notes = live ? [`${live} transcripts grew in the last ${LIVE_MINUTES} minutes since the last transcripts backup, a session running now`] : [];
  return { missing, notes };
}
