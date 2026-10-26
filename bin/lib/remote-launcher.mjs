// The login launcher of `js-harness remote`: the file `start --at-login` writes in the Windows Startup folder, how
// it replaces the batch launcher of an earlier version, and how `stop --at-login` and `status` find both. Out of
// bin/remote.mjs, which holds the command; the rules are those of bin/lib/startup-file.mjs.

import fs from 'node:fs';
import { launcherFileName, loginLauncher } from './remote.mjs';
import { batchName, lookAt, startupLocation } from './startup-file.mjs';

const isDirectory = (dir) => {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
};

/** What `start --at-login` is to do with the launcher, decided before anything is written: `{ file, content,
 * found, same }`, or `{ refusal }`. Checked here: that `APPDATA` gives a Startup folder that exists, and that no
 * value the launcher holds (the node executable, this install, the project folder, the name, the modes, the home)
 * has what cmd.exe acts on (`loginLauncher`); the caller has already refused a name the server cannot take. A
 * file already at the path is left alone when it has the very content (`same`), replaced when it is one
 * js-harness recorded writing (an earlier start with other options), and refused otherwise: it is the user's, or
 * one they edited.
 *
 * The batch launcher an earlier version wrote beside it (`batchName`), which opened a console window at every
 * login, is looked at too, as `batch`: the new launcher takes its place (`retireBatchLauncher`), so one that is not
 * still what js-harness recorded writing is refused the same way, before anything is written. */
export function planLauncher(options, { env, id, home }) {
  const where = startupLocation(env, launcherFileName(id));
  if (where.why) return { refusal: where.why };
  if (!isDirectory(where.dir)) return { refusal: `the Windows Startup folder does not exist (${where.dir}), and js-harness does not create it` };
  const batchFile = startupLocation(env, batchName(launcherFileName(id))).file;
  let content;
  let found;
  let batch;
  try {
    content = Buffer.from(loginLauncher(options), 'utf8');
    found = lookAt(home, where.file);
    batch = { file: batchFile, ...lookAt(home, batchFile) };
  } catch (err) {
    return { refusal: err.message };
  }
  const same = found.bytes !== null && found.bytes.equals(content);
  if (found.bytes !== null && !same && !found.ours) {
    const what = found.record ? `the launcher at ${where.file} was changed since js-harness wrote it` : `a file js-harness did not write is at ${where.file}`;
    return { refusal: `${what}, and is left as it is; remove it by hand, then run this again` };
  }
  if (batch.bytes !== null && !batch.ours) {
    const what = batch.record ? `the batch launcher of an earlier version at ${batchFile} was changed since js-harness wrote it` : `the file at ${batchFile} is not one js-harness recorded writing`;
    return { refusal: `${what}, and the new launcher takes its place, so it is left as it is; remove it by hand, then run this again` };
  }
  return { file: where.file, content, found, same, batch };
}

/** Removes the batch launcher `planLauncher` found (`batch`), file then record, once the new launcher is written
 * and recorded. Returns why it could not, or nothing; `enableAtLogin` then puts back what was there before. */
export function retireBatchLauncher({ batch }, { deps, home }) {
  try {
    if (batch.bytes !== null) fs.rmSync(batch.file);
    if (batch.record) deps.forgetOptionalFile(home, batch.file);
    return undefined;
  } catch (err) {
    return `the batch launcher of an earlier version at ${batch.file} could not be removed with its record (${err.message})`;
  }
}

/** Writes the launcher `planLauncher` decided on and records it in the machine manifest as an optional file, so
 * that `stop --at-login` and `uninstall` remove exactly it. Returns nothing with the launcher on, else why it is
 * not, with nothing of this command's left behind: a launcher that no record names would outlive every uninstall,
 * so when the file cannot be recorded what was there before is put back. A file this command created is removed
 * again, and one it replaced gets its earlier bytes, which its record still names. */
export function writeLauncher({ file, content, found, same }, { deps, home }) {
  if (same && found.ours) return undefined;
  try {
    // `wx` for a new file: one that appeared since the look above is not this command's to overwrite.
    if (!same) fs.writeFileSync(file, content, { flag: found.bytes === null ? 'wx' : 'w' });
  } catch (err) {
    return `${file} could not be written (${err.message})`;
  }
  try {
    deps.recordOptionalFile(home, file, content);
  } catch (err) {
    const unrecorded = `it could not be recorded in the machine manifest (${err.message})`;
    if (same) return `${unrecorded}; the file at ${file} was there before this command, and is left`;
    if (found.bytes === null) {
      try {
        fs.rmSync(file, { force: true });
      } catch (left) {
        return `${unrecorded}, and the file written could not be removed again (${left.message}): remove ${file} by hand`;
      }
      return `${unrecorded}, so the file written was removed again`;
    }
    try {
      fs.writeFileSync(file, found.bytes);
    } catch (left) {
      return `${unrecorded}, and the earlier launcher could not be put back (${left.message}): what is at ${file} is no longer what its record names, so neither js-harness remote stop --at-login nor uninstall removes it; remove it by hand`;
    }
    return `${unrecorded}, so the earlier launcher was put back: ${file} and its record are as they were`;
  }
  return undefined;
}

/** `stop --at-login`: removes the launcher and its record, and so the batch launcher of an earlier version
 * (`batchName`), which a machine keeps until its next `start --at-login`. Returns `true` with both off (removed, or
 * not there: a record whose file is gone is forgotten), and `false` after saying why a file is kept: only one that
 * is still what js-harness recorded writing is removed. The batch launcher is said only when there was one. */
export function disableLauncher({ env, deps, log, error, id, home }) {
  const where = startupLocation(env, launcherFileName(id));
  if (where.why) {
    error(`the login launcher could not be looked for: ${where.why}.`);
    return false;
  }
  const launcher = removeLauncherFile(where.file, { deps, error, home });
  const batch = removeLauncherFile(startupLocation(env, batchName(launcherFileName(id))).file, { deps, error, home });
  const batchSaid = batch.line !== undefined && !batch.nothing;
  if (launcher.line && !(launcher.nothing && batchSaid)) log(launcher.line);
  if (batchSaid) log(batch.line);
  return launcher.ok && batch.ok;
}

/** One launcher file of `disableLauncher`: `{ ok, line, nothing }`, `line` what to say once it is off, `nothing`
 * when there was neither a file nor a record. The file goes before its record, so a failure in between leaves a
 * record of a file that is gone, never a launcher that no record names. */
function removeLauncherFile(file, { deps, error, home }) {
  let found;
  try {
    found = lookAt(home, file);
  } catch (err) {
    error(`the login launcher could not be looked for: ${err.message}.`);
    return { ok: false };
  }
  const there = found.bytes !== null;
  if (there && !found.ours) {
    error(found.record
      ? `the login launcher at ${file} was changed since js-harness wrote it, so it is kept: remove it by hand, then run js-harness remote stop --at-login again to forget its record.`
      : `the file at ${file} is not one js-harness recorded writing, so it is kept: remove it by hand if it is not wanted.`);
    return { ok: false };
  }
  try {
    if (there) fs.rmSync(file);
  } catch (err) {
    error(`the login launcher at ${file} could not be removed (${err.message}); it is kept, and still recorded.`);
    return { ok: false };
  }
  try {
    if (found.record) deps.forgetOptionalFile(home, file);
  } catch (err) {
    error(`the login launcher ${there ? 'was removed' : 'was already gone'}, but its record in the machine manifest could not be (${err.message}); run js-harness remote stop --at-login again.`);
    return { ok: false };
  }
  if (there) return { ok: true, line: `login launcher: off (removed ${file})` };
  return { ok: true, line: `login launcher: off (${found.record ? 'its file was already gone, and its record was removed' : 'there was none'})`, nothing: !found.record };
}

/** The line `status` adds: `on` when the launcher file is there and the machine manifest records it. A batch
 * launcher of an earlier version still there is named: it opens a console window at login, and the next `start
 * --at-login` replaces it. */
export function launcherLine({ env, id, home }) {
  const where = startupLocation(env, launcherFileName(id));
  if (where.why) return `login launcher: unknown (${where.why})`;
  const batchFile = startupLocation(env, batchName(launcherFileName(id))).file;
  let found;
  let batch;
  try {
    found = lookAt(home, where.file);
    batch = lookAt(home, batchFile);
  } catch (err) {
    return `login launcher: unknown (${err.message})`;
  }
  const replace = 'js-harness remote start --at-login replaces it with one that opens none';
  if (found.bytes === null && batch.bytes !== null && batch.record) {
    return `login launcher: on (${batchFile}, a batch launcher that opens a console window at login${batch.ours ? '' : ', changed since js-harness wrote it'}: ${replace})`;
  }
  const also = batch.bytes === null ? '' : `; a batch launcher of an earlier version, which opens a console window at login, is still at ${batchFile}`;
  if (found.bytes !== null && found.record) return `login launcher: on (${where.file}${found.ours ? '' : ', changed since js-harness wrote it'})${also}`;
  if (found.bytes !== null) return `login launcher: off (a file js-harness did not record is at ${where.file})${also}`;
  return `login launcher: off${found.record ? ` (recorded, but its file is gone: ${where.file})` : ''}${also}`;
}
