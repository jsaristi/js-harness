// A file js-harness keeps in the user's Windows Startup folder, which Windows runs at every login: where it goes,
// how it is written and recorded, and how it is removed, so that `uninstall` and the command that wrote it
// remove exactly it and nothing of the user's.
//
// Why. Anything js-harness writes outside a repository is recorded so it can be undone exactly (AGENTS.md):
// the predecessor stack needed four hand-written purge scripts. A file in the Startup folder runs at every
// login, so one no record names would outlive every uninstall. The rules are those `remote start --at-login`
// keeps for its launcher (bin/remote.mjs, `planLauncher`, `writeLauncher`, `disableLauncher`), which reads them
// from this file too.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { forgetOptionalFile, putOptionalRecordBack, readManifest, recordOptionalFile } from './manifest.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Why a launcher is a VBScript file. Windows opens a console window for a batch file in the Startup folder, and it
// stays while the command runs: two at every login, until 2026-10-26 (odd/tasks/login-launchers.md). The Windows
// Script Host runs `WScript.Shell.Run` with window style 0, which starts the command with its window hidden; measured
// on Windows 10 19044 that day, node so started has no window at all. `Run` expands `%NAME%` in what it runs, which
// no launcher holds (`UNSAFE_IN_BATCH` in bin/lib/remote.mjs refuses `%`).

/** The one line of a launcher that runs something, around the command as a VBScript expression. */
const RUN_LINE = /^CreateObject\("WScript\.Shell"\)\.Run (.+), 0, False$/;

/** `text` as a VBScript string expression: printable ASCII between quotes (a quote doubled), every other UTF-16
 * code unit as `ChrW(n)`, joined by `&`. The file stays ASCII, so the code page that reads it does not matter. */
function vbsString(text) {
  const parts = [];
  let run = '';
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0x20 && unit <= 0x7e) {
      run += text[i] === '"' ? '""' : text[i];
      continue;
    }
    if (run !== '') parts.push(`"${run}"`);
    run = '';
    parts.push(`ChrW(${unit})`);
  }
  if (run !== '' || parts.length === 0) parts.push(`"${run}"`);
  return parts.join(' & ');
}

/** The string a `vbsString` expression stands for, or `null` for anything that is not one from end to end. */
function readVbsString(expression) {
  const part = /("(?:[^"]|"")*"|ChrW\((\d{1,5})\))(?: & |$)/y;
  let text = '';
  while (part.lastIndex < expression.length) {
    const at = part.lastIndex;
    const match = part.exec(expression);
    if (!match || match.index !== at) return null;
    if (match[2] === undefined) text += match[1].slice(1, -1).replace(/""/g, '"');
    else if (Number(match[2]) <= 0xffff) text += String.fromCharCode(Number(match[2]));
    else return null;
    if (part.lastIndex === expression.length && match[0].endsWith(' & ')) return null;
  }
  return expression === '' ? null : text;
}

/** The text of a launcher the Startup folder runs at login with no window: a VBScript file whose first line is the
 * comment `remark` and whose one statement runs `command` hidden, without waiting for it. Every line ends in CRLF.
 * `wake --at-login` and `remote start --at-login` write their launchers this way. */
export function hiddenLauncherText(remark, command) {
  return [`' ${remark}`, `CreateObject("WScript.Shell").Run ${vbsString(command)}, 0, False`, ''].join('\r\n');
}

/** The command a launcher of `hiddenLauncherText` runs, read back from its one `Run` line, or `null` when no line
 * is such a statement from end to end. A comment is not read. */
export function hiddenLauncherCommand(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const match = RUN_LINE.exec(line);
    const command = match ? readVbsString(match[1]) : null;
    if (command !== null) return command;
  }
  return null;
}

/** The name the batch launcher of the Startup file `name` had, before launchers opened no window: the next
 * `--at-login` replaces it, and every removal looks for it too. */
export const batchName = (name) => name.replace(/\.vbs$/i, '.cmd');

/** Where the Startup file `name` goes: `{ dir, file }`, from the `APPDATA` of `env` and nothing else; `{ why }`
 * when `env` has none. Nothing is created: that folder is Windows's to make. */
export function startupLocation(env, name) {
  const key = Object.keys(env).find((one) => /^appdata$/i.test(one));
  const appData = key === undefined ? '' : String(env[key]).trim();
  if (appData === '') return { why: 'APPDATA is not set, so the Windows Startup folder cannot be found' };
  const dir = path.resolve(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  return { dir, file: path.join(dir, name) };
}

/** What is at `file` and what the machine manifest records for it: `{ bytes, record, ours }`, `ours` when the
 * file is, byte for byte, what js-harness recorded writing. Throws when either cannot be read. */
export function lookAt(home, file) {
  let bytes = null;
  try {
    bytes = fs.readFileSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`what is at ${file} could not be read (${err.message})`);
  }
  let record;
  try {
    record = readManifest(home)?.optional?.find((entry) => entry.path === file);
  } catch (err) {
    throw new Error(`the machine manifest under ${home} could not be read (${err.message})`);
  }
  return { bytes, record, ours: bytes !== null && record !== undefined && sha256(bytes) === record.sha256 };
}

/** Writes `content` as the Startup file `name` and records it in the machine manifest as an optional file:
 * `{ file, written }` (`written` is false when the file already held that content and its record), or
 * `{ refusal }` with nothing of this call left behind. A file there is replaced only when it is one js-harness
 * recorded writing; one it did not write, or one changed since, is kept. When the record cannot be written,
 * what was there before is put back: a new file is removed again, a replaced one gets its earlier bytes.
 *
 * `replaces` names an earlier Startup file this one takes the place of (`batchName`): it is looked at first, and
 * one js-harness did not record writing, or one changed since, is refused before anything is written. Once the
 * new file is written and recorded, the earlier one and its record are removed, and `replaced` names it; when that
 * fails, the earlier file and the new one are put back as they were, with their records. */
export function writeStartupFile({ env, home, name, content, replaces, record = recordOptionalFile, forget = forgetOptionalFile }) {
  const where = startupLocation(env, name);
  if (where.why) return { refusal: where.why };
  let isDir = false;
  try {
    isDir = fs.statSync(where.dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) return { refusal: `the Windows Startup folder does not exist (${where.dir}), and js-harness does not create it` };
  const bytes = Buffer.from(content, 'utf8');
  let found;
  let earlier = null;
  try {
    found = lookAt(home, where.file);
    if (replaces !== undefined) {
      const file = startupLocation(env, replaces).file;
      earlier = { file, ...lookAt(home, file) };
    }
  } catch (err) {
    return { refusal: err.message };
  }
  const same = found.bytes !== null && found.bytes.equals(bytes);
  if (found.bytes !== null && !same && !found.ours) {
    const what = found.record ? `the file at ${where.file} was changed since js-harness wrote it` : `a file js-harness did not write is at ${where.file}`;
    return { refusal: `${what}, and is left as it is; remove it by hand, then run this again` };
  }
  if (earlier && earlier.bytes !== null && !earlier.ours) {
    const what = earlier.record ? `the earlier file at ${earlier.file} was changed since js-harness wrote it` : `the file at ${earlier.file} is not one js-harness recorded writing`;
    return { refusal: `${what}, and this one takes its place, so nothing was written; remove it by hand, then run this again` };
  }
  const wrote = same && found.ours ? { written: false } : writeAndRecord({ home, file: where.file, bytes, found, same, record });
  if (wrote.refusal || earlier === null || (earlier.bytes === null && !earlier.record)) return wrote.refusal ? wrote : { file: where.file, written: wrote.written };
  try {
    if (earlier.bytes !== null) fs.rmSync(earlier.file);
    if (earlier.record) forget(home, earlier.file);
  } catch (err) {
    const left = putBack(home, earlier, wrote.written ? [{ file: where.file, ...found }] : []);
    const state = left.length === 0 ? 'so both are as they were before this command' : `and what was there before could not be put back: ${left.join('; ')}`;
    return { refusal: `the earlier file at ${earlier.file} could not be removed with its record (${err.message}), ${state}` };
  }
  return { file: where.file, written: wrote.written, ...(earlier.bytes !== null ? { replaced: earlier.file } : {}) };
}

/** Puts back the files `looks` found (`{ file, bytes, record }`, as `lookAt` gave them) with their records, the
 * earlier file first. Returns what could not be put back. */
function putBack(home, ...looks) {
  return looks.flat().flatMap(({ file, bytes, record }) => {
    try {
      if (bytes === null) fs.rmSync(file, { force: true });
      else if (!(fs.existsSync(file) && fs.readFileSync(file).equals(bytes))) fs.writeFileSync(file, bytes);
      putOptionalRecordBack(home, file, record);
      return [];
    } catch (err) {
      return [`${file} (${err.message})`];
    }
  });
}

/** The write of `writeStartupFile` once it is decided: `{ written: true }`, or `{ refusal }` with what was there
 * before put back. */
function writeAndRecord({ home, file, bytes, found, same, record }) {
  try {
    // `wx` for a new file: one that appeared since the look above is not this call's to overwrite.
    if (!same) fs.writeFileSync(file, bytes, { flag: found.bytes === null ? 'wx' : 'w' });
  } catch (err) {
    return { refusal: `${file} could not be written (${err.message})` };
  }
  try {
    record(home, file, bytes);
  } catch (err) {
    const unrecorded = `it could not be recorded in the machine manifest (${err.message})`;
    if (same) return { refusal: `${unrecorded}; the file at ${file} was there before this command, and is left` };
    try {
      if (found.bytes === null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, found.bytes);
    } catch (left) {
      return { refusal: `${unrecorded}, and the file could not be put back as it was (${left.message}): remove ${file} by hand` };
    }
    return { refusal: `${unrecorded}, so the file written was ${found.bytes === null ? 'removed again' : 'put back as it was'}` };
  }
  return { written: true };
}

/** Removes the Startup file `name` and its record: `{ file, removed }` (`removed` is false when no file was
 * there; a record whose file is gone is forgotten), or `{ refusal }` when the file is not one js-harness
 * recorded writing, which is kept. The file goes before its record, so a failure in between leaves a record of
 * a file that is gone, never a file that no record names. */
export function removeStartupFile({ env, home, name, forget = forgetOptionalFile }) {
  const where = startupLocation(env, name);
  if (where.why) return { refusal: where.why };
  let found;
  try {
    found = lookAt(home, where.file);
  } catch (err) {
    return { refusal: err.message };
  }
  const there = found.bytes !== null;
  if (there && !found.ours) {
    return {
      refusal: found.record
        ? `the file at ${where.file} was changed since js-harness wrote it, so it is kept: remove it by hand, then run this again to forget its record`
        : `the file at ${where.file} is not one js-harness recorded writing, so it is kept`,
    };
  }
  try {
    if (there) fs.rmSync(where.file);
  } catch (err) {
    return { refusal: `${where.file} could not be removed (${err.message}); it is kept, and still recorded` };
  }
  try {
    if (found.record) forget(home, where.file);
  } catch (err) {
    return { refusal: `${where.file} ${there ? 'was removed' : 'was already gone'}, but its record in the machine manifest could not be (${err.message}); run this again` };
  }
  return { file: where.file, removed: there };
}
