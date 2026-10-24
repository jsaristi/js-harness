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
import { forgetOptionalFile, readManifest, recordOptionalFile } from './manifest.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The text of a batch file a Startup folder runs at login: `@echo off`, a `rem` line that says what the file does,
 * a `chcp 65001` line first when `command` holds a letter beyond ASCII (`loginLauncher` in bin/lib/remote.mjs says
 * why), then `command`. Every line ends in CRLF. `wake --at-login` and `remote start --at-login` write their
 * batch files this way. */
export function batchText(remark, command) {
  return [
    '@echo off',
    `rem ${remark}`,
    ...(/[^\x00-\x7f]/.test(command) ? ['chcp 65001 >nul'] : []),
    command,
    '',
  ].join('\r\n');
}

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
 * what was there before is put back: a new file is removed again, a replaced one gets its earlier bytes. */
export function writeStartupFile({ env, home, name, content, record = recordOptionalFile }) {
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
  try {
    found = lookAt(home, where.file);
  } catch (err) {
    return { refusal: err.message };
  }
  const same = found.bytes !== null && found.bytes.equals(bytes);
  if (found.bytes !== null && !same && !found.ours) {
    const what = found.record ? `the file at ${where.file} was changed since js-harness wrote it` : `a file js-harness did not write is at ${where.file}`;
    return { refusal: `${what}, and is left as it is; remove it by hand, then run this again` };
  }
  if (same && found.ours) return { file: where.file, written: false };
  try {
    // `wx` for a new file: one that appeared since the look above is not this call's to overwrite.
    if (!same) fs.writeFileSync(where.file, bytes, { flag: found.bytes === null ? 'wx' : 'w' });
  } catch (err) {
    return { refusal: `${where.file} could not be written (${err.message})` };
  }
  try {
    record(home, where.file, bytes);
  } catch (err) {
    const unrecorded = `it could not be recorded in the machine manifest (${err.message})`;
    if (same) return { refusal: `${unrecorded}; the file at ${where.file} was there before this command, and is left` };
    try {
      if (found.bytes === null) fs.rmSync(where.file, { force: true });
      else fs.writeFileSync(where.file, found.bytes);
    } catch (left) {
      return { refusal: `${unrecorded}, and the file could not be put back as it was (${left.message}): remove ${where.file} by hand` };
    }
    return { refusal: `${unrecorded}, so the file written was ${found.bytes === null ? 'removed again' : 'put back as it was'}` };
  }
  return { file: where.file, written: true };
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
