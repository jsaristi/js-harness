// A memory hygiene pass, made safe and undoable (D4 of odd/tasks/memory-hygiene.md). `planPass` takes the
// project's pass lock, snapshots the whole memory folder and records the write set; the pass then edits only
// those files; `verifyPass` records the after-state always and refuses what would lose his words or
// another session's write; `undoPass` restores the write set, never a file someone wrote since, and the
// index line by line. Everything lives under the state folder (`~/.js-harness/memory-hygiene/<slug>`),
// never in the memory folder, which the host owns. Zero dependencies.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hygieneState, readMemory } from './memory-hygiene.mjs';

export class PassError extends Error {}

const INDEX = 'MEMORY.md';
const KEEP_SNAPSHOTS = 10;
const OWNED_REASONS = new Set(['index-bytes', 'line-chars', 'broken-link', 'orphan']);
// A quotation of his: at least this many characters, so a label such as "Sí" is not taken for one.
const MIN_QUOTE = 12;

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const squash = (text) => text.replace(/\s+/g, ' ').trim();

function readOrNull(file) {
  try {
    return fs.readFileSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function hashes(folder) {
  const out = {};
  for (const name of fs.readdirSync(folder).sort()) {
    const file = path.join(folder, name);
    if (fs.statSync(file).isFile()) out[name] = sha256(fs.readFileSync(file));
  }
  return out;
}

function appendJournal(stateDir, entry) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.appendFileSync(path.join(stateDir, 'journal.jsonl'), `${JSON.stringify(entry)}\n`);
}

const lockFile = (stateDir) => path.join(stateDir, 'lock');
const snapshotDir = (stateDir, stamp) => path.join(stateDir, 'snapshots', stamp);
/** The marker `uninstall --global --purge-memory-snapshots` makes while it purges: beside the folder of every
 * project's state, so a purge that moves that folder aside does not move it. */
const purgeMarker = (stateDir) => `${path.dirname(stateDir)}.purge`;

function readManifest(stateDir, stamp) {
  const text = readOrNull(path.join(snapshotDir(stateDir, stamp), 'manifest.json'));
  if (text === null) throw new PassError(`no snapshot ${stamp}`);
  return JSON.parse(text.toString('utf8'));
}

function releaseLock(stateDir, stamp) {
  const held = readOrNull(lockFile(stateDir));
  if (held !== null && JSON.parse(held.toString('utf8')).stamp === stamp) fs.rmSync(lockFile(stateDir));
}

/** His words in a note: each `"…"` (or `“…”`, `«…»`) of at least twelve characters, outside the front
 * matter, fenced blocks and code spans, with its whitespace squashed; a quotation may wrap lines but not
 * cross a blank line. */
export function extractQuotes(text) {
  let body = text.replace(/\r\n/g, '\n');
  if (body.startsWith('---\n')) {
    const end = body.indexOf('\n---', 4);
    if (end !== -1) body = body.slice(end + 4);
  }
  body = body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const quotes = [];
  for (const match of body.matchAll(/"([^"]+)"|“([^”]+)”|«([^»]+)»/g)) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw.includes('\n\n')) continue;
    const quote = squash(raw);
    if ([...quote].length >= MIN_QUOTE) quotes.push(quote);
  }
  return quotes;
}

/** Starts a pass: refuses while another holds the lock or when a name of `writeSet` is not a `.md` file
 * directly in the folder; snapshots every file of the folder with its hash; records the write set; keeps
 * the ten newest snapshots. Returns `{ stamp }`. */
export function planPass({ folder, stateDir, writeSet, now }) {
  for (const name of writeSet) {
    if (name !== path.basename(name) || name.startsWith('.') || !name.endsWith('.md')) {
      throw new PassError(`not a note of the memory folder: ${name}`);
    }
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stamp = new Date(now).toISOString().replace(/[-:.]/g, '');
  try {
    fs.writeFileSync(lockFile(stateDir), JSON.stringify({ stamp, pid: process.pid }), { flag: 'wx' });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    const held = JSON.parse(fs.readFileSync(lockFile(stateDir), 'utf8'));
    throw new PassError(`a pass holds the lock: ${held.stamp} (memory verify or memory undo releases it)`);
  }
  // An uninstall purge makes its marker before it looks at the locks, and a plan looks for it after taking its lock,
  // so one of the two always sees the other. A refused plan lets its lock go and removes the folders it left empty.
  const marker = purgeMarker(stateDir);
  if (fs.existsSync(marker)) {
    releaseLock(stateDir, stamp);
    for (const empty of [stateDir, path.dirname(stateDir)]) {
      try {
        fs.rmdirSync(empty);
      } catch {
        break;
      }
    }
    throw new PassError(`an uninstall is purging the memory hygiene snapshots (${marker}); plan again once it ends, or remove that file if no uninstall runs`);
  }
  const dir = snapshotDir(stateDir, stamp);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const before = hashes(folder);
  for (const name of Object.keys(before)) fs.copyFileSync(path.join(folder, name), path.join(dir, 'files', name));
  const notes = Object.keys(before).filter((name) => name !== INDEX && name.endsWith('.md'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ stamp, at: new Date(now).toISOString(), folder, writeSet: [...writeSet], before }, null, 2));
  appendJournal(stateDir, { kind: 'plan', stamp, at: new Date(now).toISOString(), writeSet: [...writeSet], notes });

  const all = fs.readdirSync(path.join(stateDir, 'snapshots')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS))) fs.rmSync(path.join(stateDir, 'snapshots', old), { recursive: true, force: true });
  return { stamp };
}

/** The numbers and code spans of an index line: what a shorter line must keep, or its note must hold. */
function keptTokens(line) {
  const spans = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const numbers = [...line.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ' ').matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0]);
  return [...numbers, ...spans];
}

/** Whether `text` holds `token` whole: a number not inside a longer number ("88" is not in "1880"). */
function holdsToken(text, token) {
  if (!/^\d/.test(token)) return text.includes(token);
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.,])${escaped}(?![\\d]|[.,]\\d)`).test(text);
}

/** Checks the pass and records its after-state whatever the outcome: `{ ok, problems }`. `homes` is the
 * text of the repository's homes for his words (rule sources, the roadmap, feature documents); `approved`
 * names the notes whose deletion he approved. On success it journals a `verify` entry (the stamp `memory
 * status` counts from) and releases the lock; on refusal the lock stays, for a fix and another verify, or
 * an undo. */
export function verifyPass({ folder, stateDir, stamp, homes = '', approved = [], now }) {
  const manifest = readManifest(stateDir, stamp);
  const dir = snapshotDir(stateDir, stamp);
  // A verified pass keeps the after-state undo reads: verifying it again would record later writes as its own.
  const journal = (readOrNull(path.join(stateDir, 'journal.jsonl'))?.toString('utf8') ?? '').split('\n');
  if (journal.some((line) => line.includes('"kind":"verify"') && line.includes(`"stamp":"${stamp}"`))) {
    throw new PassError(`pass ${stamp} is already verified; plan a new pass for more changes`);
  }
  // Only the pass holding the lock records an after-state: one undone, or overtaken by the next pass, would
  // take another session's writes as its own, and its undo would overwrite them.
  const held = readOrNull(lockFile(stateDir));
  if (held === null || JSON.parse(held.toString('utf8')).stamp !== stamp) {
    throw new PassError(`pass ${stamp} does not hold the lock (undone, or another pass started); plan a new pass`);
  }
  const after = hashes(folder);
  const writeSet = new Set(manifest.writeSet);
  const problems = [];

  for (const name of new Set([...Object.keys(manifest.before), ...Object.keys(after)])) {
    if (writeSet.has(name)) continue;
    if (manifest.before[name] !== after[name]) problems.push(`${name} changed outside the write set during the pass (another session wrote it?)`);
  }

  const snapshotText = (name) => readOrNull(path.join(dir, 'files', name))?.toString('utf8') ?? null;
  const currentText = (name) => readOrNull(path.join(folder, name))?.toString('utf8') ?? null;
  for (const name of Object.keys(manifest.before)) {
    if (name !== INDEX && writeSet.has(name) && !(name in after) && !approved.includes(name)) {
      problems.push(`${name} was deleted without his approval (--approved ${name})`);
    }
  }

  // His words may sit in a note or in an index line; wherever they were, they must be in a note, the
  // index or a home now.
  const notesNow = squash(Object.keys(after).map(currentText).join('\n'));
  const homesText = squash(homes);
  for (const name of Object.keys(manifest.before)) {
    if (!writeSet.has(name)) continue;
    for (const quote of extractQuotes(snapshotText(name))) {
      if (!notesNow.includes(quote) && !homesText.includes(quote)) problems.push(`${name}: his words "${quote}" are in no note and no home`);
    }
  }

  if (writeSet.has(INDEX) && manifest.before[INDEX]) {
    const newLines = (currentText(INDEX) ?? '').split(/\r?\n/);
    for (const oldLine of snapshotText(INDEX).split(/\r?\n/)) {
      const link = /\]\(([^)\s]+\.md)\)/.exec(oldLine)?.[1];
      if (!link || !(link in after)) continue;
      const newLine = newLines.find((line) => line.includes(`](${link})`)) ?? '';
      const noteText = currentText(link) ?? '';
      for (const token of keptTokens(oldLine)) {
        if (!holdsToken(newLine, token) && !holdsToken(noteText, token)) problems.push(`MEMORY.md line for ${link} lost "${token}" (in neither the new line nor the note)`);
      }
    }
  }

  const memory = readMemory(folder);
  const state = hygieneState({ memory, journal: [], now });
  for (const reason of state.reasons) {
    if (OWNED_REASONS.has(reason.id)) problems.push(`still due: ${reason.id} ${reason.detail}`);
  }

  const at = new Date(now).toISOString();
  fs.writeFileSync(path.join(dir, 'after.json'), JSON.stringify(after, null, 2));
  fs.writeFileSync(path.join(dir, 'after-index.txt'), currentText(INDEX) ?? '');
  if (problems.length > 0) {
    appendJournal(stateDir, { kind: 'verify-refused', stamp, at, problems });
    return { ok: false, problems };
  }
  const notes = memory.notes.map((note) => note.name);
  appendJournal(stateDir, { kind: 'verify', stamp, at, indexBytes: memory.index?.bytes ?? 0, notes });
  releaseLock(stateDir, stamp);
  return { ok: true, problems };
}

/** Undoes the write set of `stamp`: a file whose hash is still the recorded after-hash goes back byte for
 * byte (or away, when the pass created it); a file written since is left and named; the index, when
 * someone wrote it since, gets back the pass's lines and keeps the lines others added. Releases the lock.
 * Returns `{ restored, removed, refused, indexMerged }`. */
export function undoPass({ folder, stateDir, stamp, now }) {
  const manifest = readManifest(stateDir, stamp);
  const dir = snapshotDir(stateDir, stamp);
  const afterText = readOrNull(path.join(dir, 'after.json'));
  if (afterText === null) throw new PassError(`run memory verify ${stamp} first: undo needs the after-state it records`);
  const after = JSON.parse(afterText.toString('utf8'));
  const restored = [];
  const removed = [];
  const refused = [];
  let indexMerged = false;

  for (const name of manifest.writeSet) {
    const file = path.join(folder, name);
    const current = readOrNull(file);
    const currentHash = current === null ? undefined : sha256(current);
    const beforeHash = manifest.before[name];
    if (currentHash === beforeHash) continue;
    if (currentHash === after[name]) {
      if (beforeHash === undefined) {
        fs.rmSync(file);
        removed.push(name);
      } else {
        fs.copyFileSync(path.join(dir, 'files', name), file);
        restored.push(name);
      }
    } else if (name === INDEX && beforeHash !== undefined && current !== null) {
      // Someone wrote the index since: reverse only the pass's own changes. The lines before the pass come back,
      // except one the pass kept that someone removed since; the lines someone added since stay.
      const lines = (text) => text.split('\n').filter((line) => line !== '');
      const afterLines = new Set(lines((readOrNull(path.join(dir, 'after-index.txt')) ?? Buffer.from('')).toString('utf8')));
      const currentLines = lines(current.toString('utf8'));
      const currentSet = new Set(currentLines);
      const kept = lines(fs.readFileSync(path.join(dir, 'files', name), 'utf8')).filter((line) => !(afterLines.has(line) && !currentSet.has(line)));
      const added = currentLines.filter((line) => !afterLines.has(line) && !kept.includes(line));
      fs.writeFileSync(file, [...kept, ...added].map((line) => `${line}\n`).join(''));
      indexMerged = true;
      restored.push(name);
    } else {
      refused.push(`${name} (written since the pass)`);
    }
  }
  appendJournal(stateDir, { kind: 'undo', stamp, at: new Date(now).toISOString(), restored, removed, refused });
  releaseLock(stateDir, stamp);
  return { restored, removed, refused, indexMerged };
}
