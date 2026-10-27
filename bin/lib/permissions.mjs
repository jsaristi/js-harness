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

/** The allow entry gentle-ai writes: codegraph's tools run without a prompt. */
export const PERMISSIONS_ALLOW = Object.freeze(['mcp__codegraph__*']);

/** The 24 denies gentle-ai writes (the reverse-engineering document, section 3): no wipe of the root or the home,
 * and no read or edit of a secret's usual places. `guard` refuses the same paths for a file tool (T5). */
export const PERMISSIONS_DENY = Object.freeze([
  'Bash(rm -rf /)', 'Bash(sudo rm -rf /)', 'Bash(rm -rf ~)', 'Bash(sudo rm -rf ~)',
  ...['.env', '.env.*', '.ssh/*', '.credentials/*', 'Library/Keychains/*', '.aws/credentials', '.config/gh/hosts.yml', '**/*.pem', '**/*.key', '**/secrets/*']
    .flatMap((place) => [`Read(${place})`, `Edit(${place})`]),
]);

const LISTS = { allow: PERMISSIONS_ALLOW, deny: PERMISSIONS_DENY };
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const union = (a, b) => [...new Set([...a, ...b])];

/** The user's `permissions` in `data`, or why it cannot be held: `{ permissions }` or `{ reason }`. */
function permissionsOf(data) {
  const permissions = data.permissions ?? {};
  if (!isObject(permissions)) return { reason: '"permissions" is not an object' };
  const bad = Object.keys(LISTS).find((name) => permissions[name] !== undefined && !Array.isArray(permissions[name]));
  return bad ? { reason: `"permissions.${bad}" is not a list` } : { permissions };
}

/** Adds to the user settings under `home` every entry of `PERMISSIONS_ALLOW` and `PERMISSIONS_DENY` they lack, and
 * puts back a `defaultMode` adopted before that has gone missing; never invents one. Returns `{ held, record }`:
 * `held` is `{ status, path }`, `written` or `already`, or `skipped` with a `reason` (a file that cannot be read or
 * written, or a `permissions` that is not the shape it holds), and then nothing is written and `record` is
 * `previous`. `record` is what `uninstall` undoes, `{ path, added: { allow, deny }, defaultMode, wroteMode,
 * createdFile, createdObject, createdLists }`: `added` only the entries this wrote, carried over from `previous`, the
 * record of an earlier install, as its flags are. */
export function holdPermissions(home, previous) {
  const target = userSettingsPath(home);
  const skipped = (reason) => ({ held: { status: 'skipped', path: target, reason }, record: previous ?? null });
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
  if (permissions.defaultMode !== undefined) {
    if (!(wroteMode && permissions.defaultMode === defaultMode)) [defaultMode, wroteMode] = [permissions.defaultMode, false];
  } else if (defaultMode !== null) {
    permissions.defaultMode = defaultMode;
    wroteMode = true;
    changed = true;
  }
  const record = {
    path: target, added, defaultMode, wroteMode,
    createdFile: Boolean(previous?.createdFile) || !existed,
    createdObject: Boolean(previous?.createdObject) || data.permissions === undefined,
    createdLists: Object.keys(LISTS).filter((name) => createdLists.has(name)),
  };
  if (!changed) return { held: { status: 'already', path: target }, record };
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serializeJson({ ...data, permissions }, style), 'utf8');
  } catch (err) {
    return skipped(`not writable (${err.code ?? err.message})`);
  }
  return { held: { status: 'written', path: target }, record };
}

/** Takes out of the settings what `record` says `install` wrote: its entries, the `defaultMode` it wrote back while it
 * is still that value, and a list, the object or the file it made once nothing else is in them. Returns `{ status,
 * path }`: `released` with `removed`, the count taken out; `gone` with nothing of it left to take; `kept` with a
 * `reason` when the file cannot be read, left as it is; `failed` with a `code` when it cannot be written, and then the
 * caller keeps the record for a second run. */
export function releasePermissions(record, home, listDir, { writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  const at = record.path;
  let settings;
  try {
    settings = readSettings(at);
  } catch (err) {
    return { status: 'kept', path: at, reason: err.message };
  }
  const { data, existed, style } = settings;
  if (!existed || !isObject(data.permissions)) return { status: 'gone', path: at };
  const permissions = { ...data.permissions };
  let removed = 0;
  for (const name of Object.keys(LISTS)) {
    if (!Array.isArray(permissions[name])) continue;
    const left = permissions[name].filter((entry) => !(record.added?.[name] ?? []).includes(entry));
    removed += permissions[name].length - left.length;
    permissions[name] = left;
    if (left.length === 0 && (record.createdLists ?? []).includes(name)) delete permissions[name];
  }
  if (record.wroteMode && permissions.defaultMode === record.defaultMode) {
    delete permissions.defaultMode;
    removed += 1;
  }
  if (removed === 0) return { status: 'gone', path: at };
  if (record.createdObject && Object.keys(permissions).length === 0) delete data.permissions;
  else data.permissions = permissions;
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

/** The doctor row's reading (`{ state, fix }`): `n/a` where js-harness is not installed; `ok` while the settings hold
 * every entry and the adopted `defaultMode`; `stale` naming each one missing, or when nothing holds them yet;
 * `unknown` when the settings cannot be read. */
export function permissionsHealth(home) {
  const manifest = readManifest(home);
  if (!manifest?.version) return { state: 'n/a', fix: [] };
  const target = userSettingsPath(home);
  const run = `run js-harness install`;
  if (!manifest.permissions) return { state: 'stale', fix: [`permissions: not held yet in ${target}: ${run}`] };
  let found;
  try {
    found = permissionsOf(readSettings(target).data);
  } catch {
    return { state: 'unknown', fix: [] };
  }
  if (found.reason) return { state: 'unknown', fix: [] };
  const { permissions } = found;
  const missing = Object.entries(LISTS).flatMap(([name, wanted]) => wanted.filter((entry) => !(permissions[name] ?? []).includes(entry)).map((entry) => `${name} ${entry}`));
  if (manifest.permissions.defaultMode !== null && permissions.defaultMode === undefined) missing.push(`defaultMode ${manifest.permissions.defaultMode}`);
  if (missing.length === 0) return { state: 'ok', fix: [] };
  return { state: 'stale', fix: [`permissions: ${missing.length} entr${missing.length === 1 ? 'y' : 'ies'} missing from ${target}: ${run}`, ...missing] };
}
