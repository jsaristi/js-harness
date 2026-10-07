#!/usr/bin/env node
// The login proof: shows that one command left a real Codex home as it found it, and above all that the
// login in it is the same file before and after, under the same number of names.
//
//   node evals/review/login-proof.mjs --real-home <path> --out <file.md> -- <command…>
//
// It is made for the first real run of `js-harness codex-review --session lean`, whose Codex home holds
// the login as a hard link to the real `auth.json` (bin/lib/codex-review-home.mjs). That design rests on
// three things this tool reads off the file system around the run: nothing else of the real home changed,
// the real `auth.json` is still the file it was (same device and file id), and it has as many names after
// the run as before it, so the lean home's link is gone. Bytes that changed in that same file are not a
// failure: a refresh of the login through the link is meant to reach the real file.
//
// It calls no model and runs nothing of its own: it takes a snapshot, runs the command it is given (with
// no shell, its output passed through), takes the snapshot again and writes a short Markdown report.
//
// What it reads. Of `auth.json`: what a stat says and a SHA-256, to tell changed bytes from unchanged; the
// bytes are never returned, printed or stored, and the report does not even hold that digest. Of every
// other entry at the top level of the home: a file by size, date and SHA-256, a folder by the count of its
// direct entries and its date. Folders are not read into: a real home holds databases and caches that a
// running Codex desktop app rewrites all the time. The report holds names, sizes, counts and dates, and
// no byte of any file.
//
// `--real-home` is required and has no default, so the tool can never read a real home by accident.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node evals/review/login-proof.mjs --real-home <path> --out <file.md> -- <command…>';

const AUTH = 'auth.json';

// A larger file is described by size and date: hashing it twice would take longer than it is worth.
const MAX_HASH_BYTES = 64 * 1024 * 1024;

/** The SHA-256 of `file` as hex, read in pieces that are never kept, or `null` when it cannot be read. */
function digest(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
    return hash.digest('hex');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** How many direct entries `dir` has, or `null` when it cannot be listed. */
function countEntries(dir) {
  try {
    return fs.readdirSync(dir).length;
  } catch {
    return null;
  }
}

/** What `realHome` looks like now. `auth` is the login: `{ exists: false }`, or `exists`, `size`,
 * `mtimeMs`, `nlink` (how many names the file has), `dev` and `ino` (which file it is, as strings) and
 * `sha256` (the digest only). `entries` maps every other name at the top level, sorted, to `{ size,
 * mtimeMs, sha256 }` for a file (`sha256` is `null` above `maxHashBytes`, or when it cannot be read),
 * `{ entries, mtimeMs }` for a folder, which is counted and not read into, and `{ mtimeMs }` for
 * anything else. */
export function snapshot(realHome, { maxHashBytes = MAX_HASH_BYTES } = {}) {
  const authFile = path.join(realHome, AUTH);
  const stat = fs.statSync(authFile, { bigint: true, throwIfNoEntry: false });
  const auth = stat
    ? {
      exists: true,
      size: Number(stat.size),
      mtimeMs: Number(stat.mtimeMs),
      nlink: Number(stat.nlink),
      dev: String(stat.dev),
      ino: String(stat.ino),
      sha256: digest(authFile),
    }
    : { exists: false };
  const entries = {};
  const names = fs.readdirSync(realHome).filter((name) => name !== AUTH).sort();
  for (const name of names) {
    const file = path.join(realHome, name);
    const entry = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!entry) continue; // gone between the listing and the stat
    if (entry.isDirectory()) entries[name] = { entries: countEntries(file), mtimeMs: entry.mtimeMs };
    else if (entry.isFile()) entries[name] = { size: entry.size, mtimeMs: entry.mtimeMs, sha256: entry.size > maxHashBytes ? null : digest(file) };
    else entries[name] = { mtimeMs: entry.mtimeMs };
  }
  return { auth, entries };
}

const kindOf = (entry) => ('entries' in entry ? 'folder' : 'size' in entry ? 'file' : 'link or other');
const shown = (name, entry) => (kindOf(entry) === 'folder' ? `${name}/` : name);
const sizeOf = (entry) => (kindOf(entry) === 'folder' ? `${entry.entries ?? 'unknown'} entries` : kindOf(entry) === 'file' ? `${entry.size} bytes` : 'not a file');

/** What changed in one entry between two snapshots, as a phrase, or `null` when nothing did. */
function changeOf(before, after) {
  if (kindOf(before) !== kindOf(after)) return `was a ${kindOf(before)}, now a ${kindOf(after)}`;
  if (kindOf(after) === 'folder') {
    if (before.entries !== after.entries) return `entries ${before.entries ?? 'unknown'} → ${after.entries ?? 'unknown'}`;
    return before.mtimeMs === after.mtimeMs ? null : `date changed, ${after.entries ?? 'unknown'} entries`;
  }
  if (kindOf(after) === 'file') {
    if (before.sha256 === null || after.sha256 === null) {
      return before.size === after.size && before.mtimeMs === after.mtimeMs ? null : `size or date changed (${before.size} → ${after.size} bytes; not read)`;
    }
    if (before.sha256 !== after.sha256) return `bytes changed (${before.size} → ${after.size} bytes)`;
  }
  return before.mtimeMs === after.mtimeMs ? null : 'date changed, bytes unchanged';
}

/** What differs between two snapshots of the same home. `changes` lists every top-level entry but the
 * login that was added, removed or changed, as `{ path, what }` sorted by path (a folder's path ends in
 * `/`). `auth` is the login, apart: `existed` and `exists`, `sameFile` (the same device and file id),
 * `bytes` (`unchanged`, `changed`, or `null` when it could not be told), `nlinkBefore` and `nlinkAfter`,
 * and `ok`: it is the same file and has as many names as before. Changed bytes are not a failure. */
export function compare(before, after) {
  const changes = [];
  for (const name of new Set([...Object.keys(before.entries), ...Object.keys(after.entries)])) {
    const [was, is] = [before.entries[name], after.entries[name]];
    if (!was) changes.push({ path: shown(name, is), what: `added (${kindOf(is)}, ${sizeOf(is)})` });
    else if (!is) changes.push({ path: shown(name, was), what: `removed (${kindOf(was)}, ${sizeOf(was)})` });
    else {
      const what = changeOf(was, is);
      if (what) changes.push({ path: shown(name, is), what });
    }
  }
  changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const [a, b] = [before.auth, after.auth];
  const both = a.exists && b.exists;
  const sameFile = both && a.dev === b.dev && a.ino === b.ino;
  const auth = {
    existed: a.exists,
    exists: b.exists,
    sameFile,
    bytes: both && a.sha256 !== null && b.sha256 !== null ? (a.sha256 === b.sha256 ? 'unchanged' : 'changed') : null,
    nlinkBefore: a.exists ? a.nlink : null,
    nlinkAfter: b.exists ? b.nlink : null,
    ok: sameFile && a.nlink === b.nlink,
  };
  return { changes, auth };
}

const dateOf = (ms) => new Date(ms).toISOString();
const spelled = (command) => command.map((word) => (/^[^\s"`]+$/.test(word) ? word : JSON.stringify(word))).join(' ');

/** The Markdown report of one proof: the date, the command and its exit code (`exitCode` is `null`, with
 * `startError`, when it could not be started), the verdict on the login, and every other top-level
 * change. It holds names, sizes, counts and dates; no byte of any file, and not the login's digest. */
export function report({ date, realHome, command, exitCode, startError, before, after, comparison }) {
  const { auth, changes } = comparison;
  const lines = [
    '# Login proof: a real Codex home around one command',
    '',
    `- Date: ${date}`,
    `- Real Codex home: \`${realHome}\``,
    `- Command: \`${spelled(command)}\``,
    `- Exit code: ${exitCode === null ? `none, the command could not be started (${startError ?? 'no status'})` : exitCode}`,
    '',
    '## auth.json',
    '',
  ];
  if (!auth.existed || !auth.exists) {
    lines.push(`- Before: ${auth.existed ? 'there' : 'missing'}; after: ${auth.exists ? 'there' : 'missing'}`);
  } else {
    lines.push(
      `- Same file before and after (device and file id): ${auth.sameFile ? 'yes' : 'no'}`,
      `- Bytes: ${auth.bytes ?? 'could not be read'}${auth.bytes === 'changed' && auth.sameFile ? ' (rewritten in place, as a refresh of the login through the hard link does)' : ''}`,
      `- Names (hard links): ${auth.nlinkBefore} → ${auth.nlinkAfter}`,
      `- Size: ${before.auth.size} → ${after.auth.size} bytes; last written ${dateOf(before.auth.mtimeMs)} → ${dateOf(after.auth.mtimeMs)}`,
    );
  }
  const why = !auth.existed ? 'there was no login to prove anything about'
    : !auth.exists ? 'the login is gone'
      : !auth.sameFile ? 'the login is another file than it was, so something replaced it instead of writing it in place'
        : auth.nlinkAfter !== auth.nlinkBefore ? 'the login has another number of names than it had, so a hard link was left behind or removed'
          : 'the login is the file it was, under as many names as before';
  lines.push(`- Verdict: ${auth.ok ? 'PASS' : 'FAIL'}, ${why}.`, '', '## Everything else at the top level of the home', '');
  lines.push(`${Object.keys(before.entries).length} entries before, ${Object.keys(after.entries).length} after.`, '');
  if (changes.length === 0) lines.push('Nothing else changed.');
  else lines.push(...changes.map((change) => `- \`${change.path}\`: ${change.what}`));
  lines.push(
    '',
    'A file is compared by size, date and SHA-256 (by size and date alone above 64 MiB or when it cannot be read); ' +
      'a folder by the count of its direct entries and its date, not by what is in it. No byte of any file is in this report.',
    '',
  );
  return lines.join('\n');
}

class ArgError extends Error {}

/** Parses `argv`: the flags before the first `--`, the command after it. */
function parseArgs(argv) {
  const cut = argv.indexOf('--');
  const flags = cut === -1 ? argv : argv.slice(0, cut);
  const command = cut === -1 ? [] : argv.slice(cut + 1);
  const get = (flag) => {
    const i = flags.indexOf(flag);
    if (i === -1) throw new ArgError(`${flag} is required`);
    const value = flags[i + 1];
    if (value === undefined || value.startsWith('--')) throw new ArgError(`${flag} requires a value`);
    return value;
  };
  const realHome = path.resolve(get('--real-home'));
  const out = path.resolve(get('--out'));
  if (command.length === 0) throw new ArgError('a command is required after `--`');
  if (fs.statSync(realHome, { throwIfNoEntry: false })?.isDirectory() !== true) throw new ArgError(`--real-home ${realHome} is not a folder`);
  return { realHome, out, command };
}

/** Runs the proof and returns the exit code: the wrapped command's, or 1 when the login is not the same
 * file after as before, when it has another number of names, when the command could not be started or
 * when the report could not be written; 2 with usage, and nothing run, on a bad command line. `deps`
 * (all optional) injects `spawn`, `log`, `error` and `now`. */
export function loginProofMain(argv = process.argv.slice(2), deps = {}) {
  const { spawn = spawnSync, log = console.log, error = console.error, now = () => new Date() } = deps;
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof ArgError)) throw err;
    error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { realHome, out, command } = args;
  const before = snapshot(realHome);
  // No shell: the words reach the command as they are, and its output goes straight through.
  const ran = spawn(command[0], command.slice(1), { stdio: 'inherit' });
  const after = snapshot(realHome);
  const exitCode = !ran.error && typeof ran.status === 'number' ? ran.status : null;
  const startError = ran.error ? (ran.error.code ?? ran.error.message) : ran.signal ? `ended on ${ran.signal}` : undefined;
  const comparison = compare(before, after);
  const text = report({ date: now().toISOString(), realHome, command, exitCode, startError, before, after, comparison });
  log(text);
  let written = true;
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
  } catch (err) {
    written = false;
    error(`Could not write the report to ${out}: ${err.message}`);
  }
  if (!comparison.auth.ok || !written) return 1;
  return exitCode ?? 1;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = loginProofMain(process.argv.slice(2));
}
