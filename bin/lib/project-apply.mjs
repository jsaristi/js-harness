// What a project's switches ask of one clone, and the keys they write into its Claude settings. The rules
// that resolve a switch are bin/lib/functions.mjs; writing one key and undoing it exactly is
// bin/lib/settings-key.mjs; the project manifest that records what was done is bin/lib/project.mjs, which
// calls this. See odd/tasks/on-demand-functions.md ("Slice 2, read before it is written").
import path from 'node:path';
import { applySettingsEntries, applySettingsKey, undoSettingsEntries, undoSettingsKey } from './settings-key.mjs';
import { PERMISSIONS_DENY } from './deny-paths.mjs';
import { OUTPUT_STYLE_NAME } from './output-style.mjs';

/** The clone's own Claude settings: per clone, like the hook, the index and the project manifest. Never the
 * tracked `.claude/settings.json`, which every clone shares. Repository-relative, with forward slashes. */
export const SETTINGS_FILE = '.claude/settings.local.json';

/** The keys a switch writes, by the name a manifest records: the paste of the code map into every prompt,
 * off, and the TypeScript plugin, off; and the two every clone holds (F8 S10, odd/tasks/f8-s10-port.md, T5): the
 * `js-harness` output style, and the denies that keep a session off secrets, whatever the user settings hold. The
 * denies are `entries` added to a list the user may hold entries in too (./settings-key.mjs, `applySettingsEntries`).
 * `format` is the project manifest's a record of the key needs (bin/lib/project.mjs, `MANIFEST_FORMAT`). */
export const SETTINGS_KEYS = {
  outputStyle: { pointer: ['outputStyle'], value: OUTPUT_STYLE_NAME, format: 3 },
  denies: { pointer: ['permissions', 'deny'], entries: PERMISSIONS_DENY, format: 3 },
  paste: { pointer: ['env', 'CODEGRAPH_NO_PROMPT_HOOK'], value: '1' },
  languageServer: { pointer: ['enabledPlugins', 'typescript-lsp@claude-plugins-official'], value: false },
};

/** What the resolved switches (`resolveFunctions`) ask of this clone:
 * - `settings`: the names of `SETTINGS_KEYS` to hold: the output style and the denies always, the paste off where the map is `off` or `on-demand`
 *   (`always` leaves codegraph to paste as it does by itself), the plugin off where the language server is;
 * - `index`: `'make'` where the map is on and no index is there, `'remove'` only where `off` is declared,
 *   since `auto` never deletes an index, and `'leave'` otherwise. Whether the harness made the index it would
 *   remove is the manifest's to say;
 * - `prePush`: whether the push check is wired, where the Codex review is on. */
export function planFunctions(resolved, { indexPresent }) {
  const codeMap = resolved.codeMap.value;
  const settings = ['outputStyle', 'denies'];
  if (codeMap === 'off' || codeMap === 'on-demand') settings.push('paste');
  if (resolved.languageServer.value === 'off') settings.push('languageServer');
  let index = 'leave';
  if (codeMap !== 'off' && !indexPresent) index = 'make';
  else if (resolved.codeMap.declared === 'off' && indexPresent) index = 'remove';
  return { settings, index, prePush: resolved.codexReview.value === 'on' };
}

/** How a key is named in a report: the file, then the key as a JSON pointer. */
export function settingLabel(pointer) {
  return `${SETTINGS_FILE}#/${pointer.join('/')}`;
}

/** The value at `pointer` of `data`, or `undefined`. */
export function valueAt(data, pointer) {
  return pointer.reduce((object, key) => (object !== null && typeof object === 'object' && Object.hasOwn(object, key) ? object[key] : undefined), data);
}

/** What the clone's `settings` lack of key `key`, in words, or null: a key that is not there, or the entries of
 * a list that are not in it (a value somebody else put there is apply's to report, never a difference). */
export function settingPending(key, settings) {
  const { pointer, value, entries } = SETTINGS_KEYS[key];
  const there = valueAt(settings, pointer);
  if (!entries) return there === undefined ? `${settingLabel(pointer)} is not ${JSON.stringify(value)}` : null;
  const lacking = entries.filter((entry) => !(Array.isArray(there) && there.includes(entry))).length;
  return lacking > 0 ? `${settingLabel(pointer)} lacks ${lacking} of the ${entries.length} entries js-harness holds` : null;
}

/** `run()`, or `{ state: 'problem', reason }` when it throws. */
function attempt(run) {
  try {
    return run();
  } catch (err) {
    return { state: 'problem', reason: err.message };
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether `record` is one this module wrote: a known key, its own pointer and value (for a list, the entries it
 * added, as strings, whatever the shipped list holds now), in the settings file and nowhere else, so a manifest
 * cannot point an undo at another file or another key. */
export function isValidSettingsRecord(record) {
  if (!isPlainObject(record) || !Object.hasOwn(SETTINGS_KEYS, record.key)) return false;
  const { pointer, value, entries } = SETTINGS_KEYS[record.key];
  const held = entries
    ? Array.isArray(record.entries) && record.entries.every((entry) => typeof entry === 'string') && typeof record.createdList === 'boolean'
    : JSON.stringify(record.value) === JSON.stringify(value);
  return (
    record.path === SETTINGS_FILE &&
    JSON.stringify(record.pointer) === JSON.stringify(pointer) &&
    held &&
    typeof record.createdFile === 'boolean' &&
    typeof record.createdDir === 'boolean' &&
    Number.isInteger(record.createdContainers) &&
    record.createdContainers >= 0 &&
    record.createdContainers < pointer.length
  );
}

/** Makes the settings file of the clone at `root` hold the keys named in `wanted`, and only those of the keys
 * the harness recorded. `records` are the manifest's `settings` (each valid). Returns the records to keep in
 * the manifest, `written` (not enumerable: the records of what this call alone wrote, for a rollback) and the
 * actions to report, in the kinds `init`, `sync` and `uninstall` already print:
 * - a wanted key: `wrote` when written; `kept` when it already holds the value (somebody else's then, unless
 *   a record says it is the harness's) or holds another value, which is never overwritten and leaves the
 *   switch not applied; `problem` when the file cannot be read;
 * - a recorded key no longer wanted: `removed`; `kept` when somebody changed it since; `alreadyGone`; a
 *   `failed` when the file cannot be read, whose record stays so that a later run can undo it.
 * A write or an undo that throws (a disk error) is that key's `problem` or `failed`, never the whole call's:
 * the keys already written are returned with the rest, so a caller can record them or take them back.
 * A list key undoes only entries of its shipped list. `deps` (`applyKey`, `undoKey`) stand in for
 * bin/lib/settings-key.mjs in a test. */
export function applySettings(root, records, wanted, deps = {}) {
  const applyKey = deps.applyKey ?? applySettingsKey;
  const undoKey = deps.undoKey ?? undoSettingsKey;
  const file = path.join(root, ...SETTINGS_FILE.split('/'));
  const actions = [];
  let held = [];
  const written = [];

  for (const record of records) {
    if (wanted.includes(record.key)) {
      held.push(record);
      continue;
    }
    const label = settingLabel(record.pointer);
    const { entries } = SETTINGS_KEYS[record.key];
    const undone = attempt(() => (entries
      ? undoSettingsEntries(file, { ...record, entries: record.entries.filter((entry) => entries.includes(entry)) })
      : undoKey(file, record)));
    if (undone.state === 'removed') actions.push({ kind: 'removed', path: label });
    else if (undone.state === 'changed') actions.push({ kind: 'kept', path: label, reason: 'changed since it was written' });
    else if (undone.state === 'gone') actions.push({ kind: 'alreadyGone', path: label });
    else {
      held.push(record);
      actions.push({ kind: 'failed', path: label, reason: undone.reason });
    }
  }

  for (const key of wanted) {
    const { pointer, value, entries } = SETTINGS_KEYS[key];
    const label = settingLabel(pointer);
    const recorded = held.find((record) => record.key === key);
    const others = held.filter((record) => record !== recorded);
    // The earlier record of this key goes in with the others: what it made (the file, its folder, an object
    // of the path) is still the harness's when the key is written again into it.
    const applied = attempt(() => (entries ? applySettingsEntries(file, pointer, entries, held) : applyKey(file, pointer, value, held)));
    if (applied.state === 'written') {
      // Written again where a record says it was before: the key had gone, and the new record replaces it.
      held = [...others, { key, path: SETTINGS_FILE, ...applied.record }];
      written.push({ key, path: SETTINGS_FILE, ...(applied.undo ?? applied.record) });
      actions.push({ kind: 'wrote', path: label });
    } else if (applied.state === 'kept') {
      if (!recorded) actions.push({ kind: 'kept', path: label, reason: 'already holds this value' });
    } else if (applied.state === 'conflict') {
      held = others;
      actions.push({
        kind: 'kept',
        path: label,
        reason: `holds ${JSON.stringify(applied.holds)}, never overwritten; the switch is not applied here`,
      });
    } else {
      actions.push({ kind: 'problem', path: label, reason: applied.reason });
    }
  }

  // What this call alone wrote, for a run whose manifest cannot be written to take back and no more (Codex on
  // d0d6807..1f607cb): a record held before stays in the manifest on disk, so what it holds stays too.
  return Object.defineProperty({ records: held, actions }, 'written', { value: written, enumerable: false });
}
