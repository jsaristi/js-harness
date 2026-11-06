// D8: the engram plugin's prompt hook turned off, and back on (odd/tasks/f8-s4a-hook-count.md, T4). The hook prints a
// "CRITICAL FIRST ACTION" at a session's first message, saves each prompt to engram and reminds the session to save;
// he answered "Apagarlo igual" to question 208. The script has no switch of its own, so the entry is taken out of the
// plugin's `hooks/hooks.json`, and the file's exact bytes before and after are recorded in the machine manifest
// (`pluginHooks`), so `promptHookOn` and `uninstall` put back exactly what was there. A plugin update writes a new
// file with the entry in it; the `hooks` row of `check` then fails and names the command that takes it out again.
// It imports the engine (./manifest.mjs) and the engine imports `restorePluginHooks`, functions only, as
// ./user-settings.mjs does.
import fs from 'node:fs';
import path from 'node:path';
import { detectIndent, forgetPluginHook, keepRecord, readManifest, serializeJson } from './manifest.mjs';

/** The plugin, as Claude Code's `installed_plugins.json` names it, and the event whose entry is taken out. */
export const ENGRAM_PLUGIN = 'engram@engram';
export const PROMPT_EVENT = 'UserPromptSubmit';

/** The `hooks/hooks.json` of engram's user-level install under `home`, or `null` when there is none. */
export function engramHooksFile(home) {
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'))?.plugins?.[ENGRAM_PLUGIN];
  } catch {
    return null;
  }
  const record = (Array.isArray(installed) ? installed : []).find((entry) => typeof entry?.installPath === 'string' && typeof entry.projectPath !== 'string' && entry.scope !== 'project' && entry.scope !== 'local');
  return record ? path.join(record.installPath, 'hooks', 'hooks.json') : null;
}

const samePath = (a, b) => (entry) => entry.path === a && entry.event === b;

/** Takes the `PROMPT_EVENT` entry out of engram's hooks file under `home` and records the file's bytes before and after
 * as `{ path, event, original, written, at }`. Returns `{ status, path }`: `off`; `already` when the file holds no such
 * entry (nothing written or recorded); `skipped` with a `reason` when there is no engram plugin, the file cannot be read
 * as a JSON object or cannot be written, or its record cannot be kept, in which case the file is put back. */
export function promptHookOff(home, { writeFile = fs.writeFileSync, record: recordIt = keepRecord, now = () => new Date() } = {}) {
  const file = engramHooksFile(home);
  if (file === null) return { status: 'skipped', path: null, reason: `no user-level install of ${ENGRAM_PLUGIN} in ${path.join(home, '.claude', 'plugins')}` };
  let raw;
  let data;
  try {
    raw = fs.readFileSync(file, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    return { status: 'skipped', path: file, reason: err instanceof SyntaxError ? 'not valid JSON' : `not readable (${err.code ?? err.message})` };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { status: 'skipped', path: file, reason: 'not a JSON object' };
  const hooks = data.hooks;
  if (!hooks || typeof hooks !== 'object' || !Object.hasOwn(hooks, PROMPT_EVENT)) return { status: 'already', path: file };
  const { [PROMPT_EVENT]: removed, ...rest } = hooks;
  const style = { trailingNewline: raw.endsWith('\n'), useCRLF: raw.includes('\r\n'), indent: detectIndent(raw) };
  const written = serializeJson({ ...data, hooks: rest }, style);
  try {
    writeFile(file, written, 'utf8');
  } catch (err) {
    return { status: 'skipped', path: file, reason: `not writable (${err.code ?? err.message})` };
  }
  // A change nothing records could never be put back: when the record cannot be kept, the file goes back to its bytes.
  try {
    recordIt(home, 'pluginHooks', { path: file, event: PROMPT_EVENT, original: raw, written, at: now().toISOString() }, samePath(file, PROMPT_EVENT));
  } catch (err) {
    fs.writeFileSync(file, raw, 'utf8');
    return { status: 'skipped', path: file, reason: `not recorded in the manifest (${err.code ?? err.message}), so the file was put back` };
  }
  return { status: 'off', path: file, removed: Array.isArray(removed) ? removed.length : 1 };
}

/** Puts back each recorded hooks file, as `{ restored, kept, failedRecords }`: a file still holding the bytes this
 * wrote gets its original bytes again; one that is gone or changed since (a plugin update, an edit) is left as it is and
 * named in `kept` with its `reason`; a write that fails is named with `failed` and its record returned in
 * `failedRecords`, so a second run can finish it. */
export function restorePluginHooks(records, { writeFile = fs.writeFileSync } = {}) {
  const restored = [];
  const kept = [];
  const failedRecords = [];
  for (const record of records ?? []) {
    let now;
    try {
      now = fs.readFileSync(record.path, 'utf8');
    } catch {
      kept.push({ path: record.path, reason: 'gone' });
      continue;
    }
    if (now !== record.written) {
      kept.push({ path: record.path, reason: 'changed' });
      continue;
    }
    try {
      writeFile(record.path, record.original, 'utf8');
      restored.push(record.path);
    } catch (err) {
      kept.push({ path: record.path, reason: 'failed', code: err.code ?? 'unknown error' });
      failedRecords.push(record);
    }
  }
  return { restored, kept, failedRecords };
}

/** Turns the prompt hook back on: every recorded file put back by `restorePluginHooks`, and the record of each one
 * restored, gone or changed forgotten; a failed one stays recorded. */
export function promptHookOn(home, deps = {}) {
  const records = readManifest(home)?.pluginHooks ?? [];
  const result = restorePluginHooks(records, deps);
  for (const record of records) {
    if (!result.failedRecords.includes(record)) forgetPluginHook(home, record, deps);
  }
  return result;
}
