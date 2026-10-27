// What js-harness writes into the user's Claude settings besides its hook entries, each recorded in the machine
// manifest so `uninstall` puts back what was there: `crossSessionInbound` on request. Moved out of the engine
// (./manifest.mjs) whole when F8 S10 added the permissions it holds there (odd/tasks/f8-s10-port.md). It and the engine
// import each other's functions only, which an ES module cycle allows.
import fs from 'node:fs';
import path from 'node:path';
import { NEW_SETTINGS_STYLE, SESSION_MESSAGES, detectIndent, keepRecord, readManifest, removeEmptyDirsUpTo, serializeJson, userSettingsPath } from './manifest.mjs';

/** Reads a JSON settings file as `{ data, style }`, `style` being what `serializeJson` needs to write it back as it
 * was; a missing file is an empty object written in `NEW_SETTINGS_STYLE`. Throws with the reason a file cannot be taken. */
function readSettings(target) {
  const existed = fs.existsSync(target);
  const raw = existed ? fs.readFileSync(target, 'utf8') : '{}';
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('malformed JSON');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a JSON object');
  return { data, existed, raw, style: existed ? { trailingNewline: raw.endsWith('\n'), useCRLF: raw.includes('\r\n'), indent: detectIndent(raw) } : NEW_SETTINGS_STYLE };
}

/** Sets `SESSION_MESSAGES` in the user settings and records it in the manifest's `settings` array as `{ path, key,
 * value, had, previous, createdFile }`, what was there before (`had: false` when the key was not, `createdFile` when
 * the file was not). Returns `{ status, path }`:
 * `written`, with `was`, the value it replaced (`null` for none); `already` when it already holds the value
 * (recorded all the same, so `uninstall` knows to leave it); `skipped` with a `reason` when the file cannot be
 * read, is no JSON object or cannot be written, and then nothing is written or recorded. A second call keeps the first record, which holds what the user had. Like the other records kept on
 * request, `install` and `sync` carry it forward and `uninstall` puts the value back (`restoreSettings`). */
export function acceptSessionMessages(home, { writeFile = fs.writeFileSync, record: recordIt = keepRecord } = {}) {
  const target = userSettingsPath(home);
  const { key, value } = SESSION_MESSAGES;
  let settings;
  try {
    settings = readSettings(target);
  } catch (err) {
    return { status: 'skipped', path: target, reason: err.message };
  }
  const { data, existed, style } = settings;
  const matches = (entry) => entry.path === target && entry.key === key;
  const record = { path: target, key, value, had: Object.hasOwn(data, key), previous: data[key] ?? null, createdFile: !existed };
  // Recorded only once the file holds the value: a write that fails leaves no record that would later have
  // `uninstall` take a value the user set by hand for one this command wrote.
  const keep = () => {
    if (!readManifest(home)?.settings?.some(matches)) recordIt(home, 'settings', record, matches);
  };
  if (data[key] === value) {
    keep();
    return { status: 'already', path: target };
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeFile(target, serializeJson({ ...data, [key]: value }, style), 'utf8');
  } catch (err) {
    return { status: 'skipped', path: target, reason: `not writable (${err.code ?? err.message})` };
  }
  // A setting nothing records could never be put back (Codex's finding of 2026-10-14): when the record cannot
  // be written, the file goes back to the bytes it had, or away when this made it.
  try {
    keep();
  } catch (err) {
    if (existed) fs.writeFileSync(target, settings.raw, 'utf8');
    else fs.rmSync(target, { force: true });
    return { status: 'skipped', path: target, reason: `not recorded in the manifest (${err.code ?? err.message}), so the file was put back` };
  }
  return { status: 'written', path: target, was: record.previous };
}

/** Puts back each setting the manifest records, as `{ restored, kept }` (paths): a value still the one recorded is
 * set back to what was there before, or its key removed when there was none, and a file left holding nothing it did
 * not hold before is removed (`createdFile`, and nothing else in it), with the folders it leaves empty; a value the
 * user changed since is theirs and is kept, and so is a file that cannot be read. A record whose value was already
 * there before is left with nothing to do. */
export function restoreSettings(manifest, home, listDir, { writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  const restored = [];
  const kept = [];
  const failed = [];
  const failedRecords = [];
  for (const record of manifest.settings ?? []) {
    if (record.had && record.previous === record.value) continue;
    let settings;
    try {
      settings = readSettings(record.path);
    } catch {
      kept.push(record.path);
      continue;
    }
    const { data, existed, style } = settings;
    if (!existed) continue;
    if (data[record.key] !== record.value) {
      kept.push(record.path);
      continue;
    }
    if (record.had) data[record.key] = record.previous;
    else delete data[record.key];
    // A write or removal that fails keeps the setting, said as kept, rather than throw out of uninstall halfway
    // (harness-review a4).
    try {
      if (record.createdFile && Object.keys(data).length === 0) {
        removeFile(record.path);
        removeEmptyDirsUpTo(path.dirname(record.path), home, listDir);
      } else {
        writeFile(record.path, serializeJson(data, style), 'utf8');
      }
    } catch (err) {
      failed.push({ path: record.path, code: err.code ?? 'unknown error' });
      failedRecords.push(record);
      continue;
    }
    restored.push(record.path);
  }
  return { restored, kept, failed, failedRecords };
}
