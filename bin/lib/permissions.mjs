// The `permissions` object of the user's Claude settings, held by js-harness (F8 S10, odd/tasks/f8-s10-port.md, T4):
// gentle-ai writes it today and its uninstall takes the whole object away (S2), with the denies that keep a session
// off credentials. `install` adds what is missing, records only what it wrote, and `uninstall` takes out exactly that:
// an entry or a `defaultMode` it found is the user's, never removed. The hook-entry engine cannot do this, since it
// does not remember whether an entry was there before it (L4). It and ./manifest.mjs import each other's functions
// only, which an ES module cycle allows.
import fs from 'node:fs';
import path from 'node:path';
import { readManifest, removeEmptyDirsUpTo, serializeJson } from './manifest.mjs';
import { readSettings, userSettingsPath } from './user-settings.mjs';
import { PERMISSIONS_ALLOW, PERMISSIONS_DENY } from './deny-paths.mjs';

// The lists live with the paths `guard` refuses (./deny-paths.mjs), which loads nothing else.
export { PERMISSIONS_ALLOW, PERMISSIONS_DENY };

const LISTS = { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const union = (a, b) => [...new Set([...a, ...b])];

/** Runs the write of the manifest that records what was held; when it throws, `undo` takes the settings back first, so
 * no entry is left that nothing records (Codex on c7445ca..e523ac7, as `acceptSessionMessages` does). */
const recordWith = (undo) => (write) => {
  try {
    write();
  } catch (err) {
    try {
      undo?.();
    } catch {
      // The write's own error is the one to tell.
    }
    throw err;
  }
};

/** The user's `permissions` in `data`, or why it cannot be held: `{ permissions }` or `{ reason }`. */
function permissionsOf(data) {
  const permissions = data.permissions === undefined ? {} : data.permissions;
  if (!isObject(permissions)) return { reason: '"permissions" is not an object' };
  const bad = Object.keys(LISTS).find((name) => permissions[name] !== undefined && !Array.isArray(permissions[name]));
  return bad ? { reason: `"permissions.${bad}" is not a list` } : { permissions };
}

/** Adds to the user settings under `home` every entry of `PERMISSIONS_ALLOW` and `PERMISSIONS_DENY` they lack, and
 * puts back a `defaultMode` adopted before that has gone missing; never invents one. Returns `{ held, record, keep }`:
 * `held` is `{ status, path }`, `written` (with `restoredMode` when it put a mode back) or `already`, or `skipped`
 * with a `reason` (a file that cannot be read or written, or a `permissions` that is not the shape it holds), and then
 * nothing is written and `record` is `previous`. `record` is what `uninstall` undoes, `{ path, added: { allow, deny }, defaultMode, wroteMode,
 * createdFile, createdObject, createdLists }`: `added` only the entries this wrote, carried over from `previous`, the
 * record of an earlier install, as its flags are. `keep(write)` runs the caller's write of the manifest, and takes the
 * settings back when it throws. */
export function holdPermissions(home, previous) {
  const target = userSettingsPath(home);
  const skipped = (reason) => ({ held: { status: 'skipped', path: target, reason }, record: previous ?? null, keep: recordWith(null) });
  let settings;
  try {
    settings = readSettings(target);
  } catch (err) {
    return skipped(err.message);
  }
  const { data, existed, style } = settings;
  const found = permissionsOf(data);
  if (found.reason) return skipped(found.reason);
  const permissions = { ...found.permissions };
  const added = { allow: [...(previous?.added?.allow ?? [])], deny: [...(previous?.added?.deny ?? [])] };
  const createdLists = new Set(previous?.createdLists ?? []);
  let changed = false;
  for (const [name, wanted] of Object.entries(LISTS)) {
    const list = permissions[name] ?? [];
    const missing = wanted.filter((entry) => !list.includes(entry));
    if (missing.length === 0) continue;
    if (permissions[name] === undefined) createdLists.add(name);
    permissions[name] = [...list, ...missing];
    added[name] = union(added[name], missing);
    changed = true;
  }
  // A mode there now is adopted, unless it is the one this wrote back earlier; one adopted earlier and gone is put back.
  let defaultMode = previous?.defaultMode ?? null;
  let wroteMode = Boolean(previous?.wroteMode);
  let restored = null;
  if (permissions.defaultMode !== undefined) {
    if (!(wroteMode && permissions.defaultMode === defaultMode)) [defaultMode, wroteMode] = [permissions.defaultMode, false];
  } else if (defaultMode !== null) {
    permissions.defaultMode = restored = defaultMode;
    wroteMode = true;
    changed = true;
  }
  const record = {
    path: target, added, defaultMode, wroteMode,
    createdFile: Boolean(previous?.createdFile) || !existed,
    createdObject: Boolean(previous?.createdObject) || data.permissions === undefined,
    createdLists: Object.keys(LISTS).filter((name) => createdLists.has(name)),
  };
  if (!changed) return { held: { status: 'already', path: target }, record, keep: recordWith(null) };
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serializeJson({ ...data, permissions }, style), 'utf8');
  } catch (err) {
    return skipped(`not writable (${err.code ?? err.message})`);
  }
  const putBack = () => (existed ? fs.writeFileSync(target, settings.raw, 'utf8') : fs.rmSync(target, { force: true }));
  return { held: { status: 'written', path: target, ...(restored !== null && { restoredMode: restored }) }, record, keep: recordWith(putBack) };
}

/** Whether `a` and `b` name one file: resolved, and in any case on Windows, whose paths ignore it. */
function sameFile(a, b) {
  const [x, y] = [path.resolve(String(a)), path.resolve(b)];
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** Takes out of the settings what `record` says `install` wrote: its entries, the `defaultMode` it wrote back while it
 * is still that value, and a list, the object or the file it made once nothing else is in them. Returns `{ status,
 * path }`: `released` with `removed`, the count taken out (one copy of each recorded entry of the lists); `gone` with
 * nothing of it left to take; `kept` with a `reason` when the record names another file than the user settings of
 * `home`, left as it is, a record no run can clear; `failed` with a `code` when the file cannot be read or written,
 * and then the caller keeps the record for a run again once it is fixed. */
export function releasePermissions(record, home, listDir, { writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  const at = userSettingsPath(home);
  if (!sameFile(record.path, at)) return { status: 'kept', path: String(record.path), reason: 'the record names another file than the user settings' };
  let settings;
  try {
    settings = readSettings(at);
  } catch (err) {
    return { status: 'failed', path: at, code: err.message };
  }
  const { data, existed, style } = settings;
  if (!existed || !isObject(data.permissions)) return { status: 'gone', path: at };
  const before = JSON.stringify(data.permissions);
  const permissions = { ...data.permissions };
  let removed = 0;
  for (const [name, known] of Object.entries(LISTS)) {
    if (!Array.isArray(permissions[name])) continue;
    // One copy of each entry recorded, and only an entry of the lists: a copy someone added again stays, and a
    // manifest edited by hand cannot name the user's own entries (the verifier of T4, findings 4 and 5).
    const ours = Array.isArray(record.added?.[name]) ? record.added[name].filter((entry) => known.includes(entry)) : [];
    const left = [...permissions[name]];
    for (const entry of new Set(ours)) {
      const index = left.indexOf(entry);
      if (index !== -1) left.splice(index, 1);
    }
    removed += permissions[name].length - left.length;
    permissions[name] = left;
    if (left.length === 0 && (record.createdLists ?? []).includes(name)) delete permissions[name];
  }
  if (record.wroteMode && permissions.defaultMode === record.defaultMode) {
    delete permissions.defaultMode;
    removed += 1;
  }
  if (record.createdObject && Object.keys(permissions).length === 0) delete data.permissions;
  else data.permissions = permissions;
  // An emptied list or object install made goes too, though no entry is left in it (Codex on c7445ca..e523ac7).
  if (JSON.stringify(data.permissions) === before) return { status: 'gone', path: at };
  try {
    if (record.createdFile && Object.keys(data).length === 0) {
      removeFile(at);
      removeEmptyDirsUpTo(path.dirname(at), home, listDir);
    } else {
      writeFile(at, serializeJson(data, style), 'utf8');
    }
  } catch (err) {
    return { status: 'failed', path: at, code: err.code ?? 'unknown error' };
  }
  return { status: 'released', path: at, removed };
}

/** Once the hook entries are out too, removes the settings file `record` says install made when it holds nothing at
 * all, with the folders it leaves empty: the case of a record a failed uninstall kept, whose file the hooks of a later
 * install found there (the verifier of T4, finding 3). A file that holds anything, or cannot be read, stays. */
export function removeMadeFile(record, home, listDir, removeFile = fs.rmSync) {
  if (!record.createdFile || record.path !== userSettingsPath(home)) return;
  try {
    const { data, existed } = readSettings(record.path);
    if (!existed || Object.keys(data).length > 0) return;
    removeFile(record.path);
    removeEmptyDirsUpTo(path.dirname(record.path), home, listDir);
  } catch {
    // Tidying after the work is done: a file that cannot be read or removed is left.
  }
}

/** The doctor row's reading (`{ state, fix }`): `n/a` where js-harness is not installed; `ok` while the settings hold
 * every entry and the adopted `defaultMode`; `stale` naming each one missing, when nothing holds them yet, or when the
 * settings cannot hold them (a file that does not parse, a `permissions` of another shape). */
export function permissionsHealth(home) {
  const manifest = readManifest(home);
  if (!manifest?.version) return { state: 'n/a', fix: [] };
  const target = userSettingsPath(home);
  const run = `run js-harness install`;
  if (!manifest.permissions) return { state: 'stale', fix: [`permissions: not held yet in ${target}: ${run}`] };
  let found;
  try {
    found = permissionsOf(readSettings(target).data);
  } catch (err) {
    found = { reason: err.message };
  }
  // A file that cannot hold them holds none of them: a gap, never the `unknown` the hook stays quiet on.
  if (found.reason) return { state: 'stale', fix: [`permissions: ${target} cannot hold the permissions (${found.reason}): fix it, then ${run}`] };
  const { permissions } = found;
  const missing = Object.entries(LISTS).flatMap(([name, wanted]) => wanted.filter((entry) => !(permissions[name] ?? []).includes(entry)).map((entry) => `${name} ${entry}`));
  if (manifest.permissions.defaultMode !== null && permissions.defaultMode === undefined) missing.push(`defaultMode ${manifest.permissions.defaultMode}`);
  if (missing.length === 0) return { state: 'ok', fix: [] };
  return { state: 'stale', fix: [`permissions: ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} missing from ${target}: ${run}`, ...missing] };
}
