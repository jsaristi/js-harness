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
// It calls no model: it takes a snapshot, runs the command it is given (with no shell, its output passed
// through), takes the snapshot again and writes a short Markdown report. No shell means the command's
// first word must be a real executable, `node <script>` for one: a `.cmd` shim, which is what `codex` and
// `npm` are on Windows, cannot be started that way.
//
// The one thing it runs of its own is a listing of the Codex processes alive, and only when something of
// the home other than the login changed: a real home is written by every Codex client of the user, so such
// a change may be another client's and not the command's, and the report names who was running
// (`codexProcesses`) instead of leaving the reader to find out by hand.
//
// What it reads. Of `auth.json`: what a stat says and a SHA-256, to tell changed bytes from unchanged; the
// bytes are never returned, printed or stored, and the report does not even hold that digest. Of every
// other entry at the top level of the home: a file by size, date and SHA-256, a folder by the count of its
// direct entries and its date. Folders are not read into: a real home holds databases and caches that a
// running Codex desktop app rewrites all the time. The report holds names, sizes, counts and dates, and
// no byte of any file.
//
// `--real-home` is required and has no default, so the tool can never read a real home by accident.
//
// `--out` is refused, before anything is run, when the report would be written into that home or over a
// file of it: the report is written after the second snapshot, so the tool itself would then change the
// home it has just said was left alone, and a report written over `auth.json` would destroy the login
// under a verdict of PASS (`refusedDestination`).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The second line is there because the failure it prevents is silent in its cause: Node refuses to start
// a `.cmd` or `.bat` file without a shell, so `-- codex …` on Windows only reports that the command could
// not be started.
const USAGE =
  'Usage: node evals/review/login-proof.mjs --real-home <path> --out <file.md> -- <command…>\n' +
  'The command is started with no shell, so its first word must be a real executable (`node <script>`, for one), not a `.cmd` shim.\n' +
  'The report is written outside the real home: an --out inside it, or one that is a file of it under another name, is refused.';

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

const FOOTER =
  'A file is compared by size, date and SHA-256 (by size and date alone above 64 MiB or when it cannot be read); ' +
  'a folder by the count of its direct entries and its date, not by what is in it. No byte of any file is in this report.';

// Said under the changes outside the login. A real home is not this tool's alone: the desktop app and any
// other Codex session of the same user write their databases, caches and histories into it all the time,
// so a change there is not shown to be the command's by having happened around it.
const MAY_BE_ANOTHER = 'Another Codex client running on this machine may be what wrote these, and the proof cannot tell: it sees that the home changed, not who changed it.';

/** The lines that say who else may have written: the sentence above, then the Codex `processes` alive at
 * the end of the run (`{ list }`, as `codexProcesses` gives them, or `{ error }` with why they could not
 * be listed; nothing at all reads as a listing that was not made). */
function otherWriters(processes) {
  if (!Array.isArray(processes?.list)) {
    return [`${MAY_BE_ANOTHER} The Codex processes alive at the end of the run could not be listed (${processes?.error ?? 'no listing was made'}).`];
  }
  if (processes.list.length === 0) return [`${MAY_BE_ANOTHER} No Codex process was alive at the end of the run.`];
  return [
    `${MAY_BE_ANOTHER} Codex processes alive at the end of the run:`,
    ...processes.list.map(({ name, pid, startedAt }) => `- \`${name}\`, pid ${pid}, ${startedAt ? `started ${startedAt}` : 'start time unknown'}`),
  ];
}

/** The Markdown report of one proof: the date, the command and its exit code (`exitCode` is `null`, with
 * `startError`, when it could not be started), the verdict on the login, and every other top-level
 * change. It holds names, sizes, counts and dates; no byte of any file, and not the login's digest.
 *
 * When something else changed, the report says that another Codex client may be the writer and names the
 * Codex `processes` alive at the end of the run (see `otherWriters`), so the reader does not have to find
 * out by hand; when nothing else changed it says nothing of them, whatever `processes` holds.
 *
 * When the home could not be read after the command, `after` and `comparison` are `null` and
 * `afterError` says why: the report then tells what was read before, that nothing is known after, and
 * FAIL, since the proof is exactly the second reading. */
export function report({ date, realHome, command, exitCode, startError, before, after, comparison, afterError, processes }) {
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
  if (!after || !comparison) {
    lines.push(
      `- The home could not be read after the command (${afterError ?? 'no reason given'}), so nothing is known about the login after it.`,
      before.auth.exists
        ? `- Names (hard links) before: ${before.auth.nlink}; size before: ${before.auth.size} bytes, last written ${dateOf(before.auth.mtimeMs)}`
        : '- Before: missing',
      '- Verdict: FAIL, the home could not be read after the command, and the proof is that second reading.',
      '',
      '## Everything else at the top level of the home',
      '',
      `${Object.keys(before.entries).length} entries before; not read after the command.`,
      '',
      FOOTER,
      '',
    );
    return lines.join('\n');
  }
  const { auth, changes } = comparison;
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
  else lines.push(...changes.map((change) => `- \`${change.path}\`: ${change.what}`), '', ...otherWriters(processes));
  lines.push('', FOOTER, '');
  return lines.join('\n');
}

// How long the listing of the processes may take: it is one question to the system, asked after the run
// the proof is about, and a listing that hangs must not keep the report from being written.
const LIST_TIMEOUT_MS = 15000;

// What PowerShell is asked on Windows: one line a process whose name holds `codex`, with its id, when it
// started (in UTC, in the round-trip format; empty when Windows does not say) and its name, a tab between
// them. `Win32_Process` is asked, as in bin/lib/process-tree.mjs: `tasklist` gives no start time.
const WINDOWS_LISTING =
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'codex' } | ForEach-Object { " +
  "$started = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { '' }; " +
  '($_.ProcessId, $started, $_.Name) -join [char]9 }';

const WINDOWS_LINE = /^(\d+)\t([^\t]*)\t(.+)$/;
// A line of `ps -o pid=,lstart=,comm=`: the id, a date as `Tue Oct  6 11:23:05 2026`, and the command.
const PS_LINE = /^\s*(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.+)$/;

/** `text` as an ISO date, or `null` when it is none: Windows gives no start time for some processes. */
function isoOf(text) {
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** The Codex processes alive now, each `{ name, pid, startedAt }` (`startedAt` an ISO date, or `null` when
 * the system did not say), sorted by pid: every process whose name holds `codex` in any case, which takes
 * in the CLI and the desktop app. On Windows (`platform` is `win32`) from PowerShell's
 * `Get-CimInstance Win32_Process`, elsewhere from `ps`, whose command is named by its last part.
 *
 * Throws, saying why, when the listing could not be run or did not end well. Nothing of a process but
 * those three is read: not its command line, which may hold what a report must not. */
export function codexProcesses(platform = process.platform, spawn = spawnSync) {
  const windows = platform === 'win32';
  const command = windows ? 'powershell.exe' : 'ps';
  const args = windows ? ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_LISTING] : ['-A', '-o', 'pid=,lstart=,comm='];
  // `ps` writes the date in the language of the machine unless it is told not to. PowerShell is given the
  // environment as it is.
  const options = { encoding: 'utf8', timeout: LIST_TIMEOUT_MS, windowsHide: true, ...(windows ? {} : { env: { ...process.env, LC_ALL: 'C' } }) };
  const ran = spawn(command, args, options);
  if (ran.error) throw new Error(`${command} could not be run (${ran.error.message})`);
  if (ran.status !== 0) {
    const said = String(ran.stderr ?? '').trim().split(/\r?\n/)[0];
    const how = typeof ran.status === 'number' ? `exited ${ran.status}` : `ended on ${ran.signal ?? 'no status'}`;
    throw new Error(`${command} ${how}${said ? `: ${said}` : ''}`);
  }
  const found = [];
  for (const line of String(ran.stdout ?? '').split(/\r?\n/)) {
    const match = (windows ? WINDOWS_LINE : PS_LINE).exec(line);
    if (!match) continue;
    const name = windows ? match[3].trim() : match[3].trim().split('/').at(-1);
    if (/codex/i.test(name)) found.push({ name, pid: Number(match[1]), startedAt: isoOf(match[2]) });
  }
  return found.sort((a, b) => a.pid - b.pid);
}

class ArgError extends Error {}

/** Which file `file` is, as `<device>:<file id>`, through any link on the way to it; `null` when nothing is
 * there or it cannot be asked. Two names with the same one are one file, whatever case or link spells them.
 * As a `bigint`, as for the login (`snapshot`): a Windows file id does not fit a number. */
function fileIdOf(file) {
  try {
    const stat = fs.statSync(file, { bigint: true, throwIfNoEntry: false });
    return stat ? `${stat.dev}:${stat.ino}` : null;
  } catch {
    return null;
  }
}

// How many links in a row are followed by hand before a destination is given up on: one that leads to
// itself would otherwise be followed for ever.
const MAX_LINK_HOPS = 40;

/** Where a write to `file` would land: the real path of the deepest part of it that exists, every link on
 * the way followed, then the names under it that do not exist yet. A link whose target is not there yet is
 * followed by hand (`realpath` refuses it): a write through it would make the target. Throws when the path
 * cannot be followed to an end, which the caller tells as a destination it cannot vouch for. */
function landingOf(file) {
  const missing = [];
  let at = file;
  let hops = 0;
  for (;;) {
    let entry;
    try {
      entry = fs.lstatSync(at, { throwIfNoEntry: false });
    } catch (err) {
      // A name under a file is not there either, and where it would be is still under that file.
      if (err.code !== 'ENOTDIR') throw err;
    }
    if (!entry) {
      const up = path.dirname(at);
      if (up === at) return path.join(at, ...missing);
      missing.unshift(path.basename(at));
      at = up;
      continue;
    }
    try {
      return path.join(fs.realpathSync.native(at), ...missing);
    } catch (err) {
      // A link to nothing: where it points is read, from the real folder it is in, and followed from there.
      if (!entry.isSymbolicLink() || err.code !== 'ENOENT') throw err;
      hops += 1;
      if (hops > MAX_LINK_HOPS) throw new Error('too many links in a row');
      at = path.resolve(fs.realpathSync.native(path.dirname(at)), fs.readlinkSync(at));
    }
  }
}

/** Why the report must not be written to `out`, as the rest of a sentence that starts with `--out <out>`,
 * or `null` when it may be: `out` and `realHome` are resolved paths, and `realHome` is a folder.
 *
 * The report is written after the home was read the second time. Written into the home, it changes the
 * home the proof has just said was left as it was; written over `auth.json`, it destroys the login under a
 * report that says PASS. So a destination is refused when it lands inside the home, or on a file that is
 * one of the home's own under another name: a hard link, or a path through a link.
 *
 * Asked of the file system and not of the spelling alone, since one place has many spellings: another
 * case on Windows, a short name, a junction or a symbolic link on the way. Where the write would land is
 * followed to a real path (`landingOf`), and every folder from there up is asked which file it is; the
 * real paths are compared as text too, for a folder that cannot be asked. Only names, ids and link targets
 * are read: no byte of any file. */
function refusedDestination(realHome, out) {
  let landing;
  let homePath;
  let names;
  try {
    landing = landingOf(out);
    homePath = fs.realpathSync.native(realHome);
    names = fs.readdirSync(homePath);
  } catch (err) {
    return `cannot be followed to where the report would be written (${err.code ?? err.message}), so it is not known to be outside the real Codex home ${realHome}`;
  }
  const inside = `is inside the real Codex home ${realHome}: the report is written after the home was read a second time, so it would change the home the proof says was left as it was`;
  // On Windows a path is the same in any case. Elsewhere a real path has one spelling.
  const spelled = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
  if (spelled(landing) === spelled(homePath) || spelled(landing).startsWith(spelled(homePath + path.sep))) return inside;
  const home = fileIdOf(homePath);
  for (let at = landing; ; at = path.dirname(at)) {
    if (home !== null && fileIdOf(at) === home) return inside;
    if (path.dirname(at) === at) break;
  }
  // The file that is there already, when one is: the same file as an entry of the home is that entry.
  const there = fileIdOf(out);
  if (there !== null) {
    for (const name of names) {
      if (fileIdOf(path.join(homePath, name)) === there) {
        return `is the same file as \`${name}\` at the top level of the real Codex home ${realHome} (the same device and file id, under another name or through a link), so the report would be written over it`;
      }
    }
  }
  return null;
}

/** Parses `argv`: the flags before the first `--`, the command after it. Throws an `ArgError` on a command
 * line that cannot be run as it is, a report destination that reaches the real home included
 * (`refusedDestination`): that is found here, before anything is read or run. */
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
  const refused = refusedDestination(realHome, out);
  if (refused !== null) throw new ArgError(`--out ${out} ${refused}`);
  return { realHome, out, command };
}

/** Runs the proof and returns the exit code: the wrapped command's, or 1 when the login is not the same
 * file after as before, when it has another number of names, when the home could not be read after the
 * command, when the command could not be started or when the report could not be written; 2 with usage,
 * and nothing run, on a bad command line. `deps` (all optional) injects `spawn`, `log`, `error`, `now`
 * and `listProcesses`, which gives the Codex processes alive (`codexProcesses`, by default, for
 * `platform`). */
export function loginProofMain(argv = process.argv.slice(2), deps = {}) {
  const { spawn = spawnSync, log = console.log, error = console.error, now = () => new Date(), platform = process.platform } = deps;
  const listProcesses = deps.listProcesses ?? (() => codexProcesses(platform));
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
  // The command has run, so from here a report is owed whatever happens: a second reading that throws
  // (the home moved, or no longer listable) is told in it, instead of leaving the run unobserved.
  let after = null;
  let afterError;
  try {
    after = snapshot(realHome);
  } catch (err) {
    afterError = err?.message ?? String(err);
  }
  const exitCode = !ran.error && typeof ran.status === 'number' ? ran.status : null;
  const startError = ran.error ? (ran.error.code ?? ran.error.message) : ran.signal ? `ended on ${ran.signal}` : undefined;
  const comparison = after ? compare(before, after) : null;
  // Who else may have written, asked only when something outside the login changed, and at the end of
  // the run: a client that is alive now is the one a reader would go looking for. A listing that fails is
  // told in the report and changes nothing of the proof, which is about the login.
  let processes;
  if (comparison && comparison.changes.length > 0) {
    try {
      processes = { list: listProcesses() };
    } catch (err) {
      processes = { error: err?.message ?? String(err) };
    }
  }
  const text = report({ date: now().toISOString(), realHome, command, exitCode, startError, before, after, comparison, afterError, processes });
  log(text);
  let written = true;
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text, 'utf8');
  } catch (err) {
    written = false;
    error(`Could not write the report to ${out}: ${err.message}`);
  }
  if (!comparison?.auth.ok || !written) return 1;
  return exitCode ?? 1;
}

// Run as a command, not when imported by a test. Compared as resolved paths, not as URLs: on Windows
// `import.meta.url` and `process.argv[1]` spell the same file differently.
const fold = (text) => (process.platform === 'win32' ? text.toLowerCase() : text);
if (process.argv[1] && fold(path.resolve(process.argv[1])) === fold(fileURLToPath(import.meta.url))) {
  process.exitCode = loginProofMain(process.argv.slice(2));
}
