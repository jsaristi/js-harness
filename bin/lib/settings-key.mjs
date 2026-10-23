// One key inside a JSON settings file the harness does not own (a clone's `.claude/settings.local.json`):
// written beside what is there, recorded so it can be undone exactly, and never written over a value
// somebody else put there. The machine manifest's entries (bin/lib/manifest.mjs) append to arrays; a switch
// of a project (odd/tasks/on-demand-functions.md) is a key of an object, which is this module.
import fs from 'node:fs';
import path from 'node:path';
import { NEW_SETTINGS_STYLE, detectIndent, serializeJson } from './manifest.mjs';

// A file this module creates: the manifest's new-file style, with the final newline these files have always had.
const NEW_FILE = { ...NEW_SETTINGS_STYLE, trailingNewline: true };

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `data` as the text of a file that looked like `raw`: its indent, its line endings, and a newline at the
 * end only if it had one. The manifest reads and writes a host's file the same way (`serializeJson`). */
export function textLike(raw, data) {
  return serializeJson(data, { trailingNewline: raw.endsWith('\n'), useCRLF: raw.includes('\r\n'), indent: detectIndent(raw) });
}

/** The file as `{ raw, data }`, `{ absent: true }`, or `{ reason }` when it is not a JSON object. */
function readObject(file) {
  if (!fs.existsSync(file)) return { absent: true };
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { reason: `${file} could not be read: ${err.message}` };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { reason: `${file} is not valid JSON: ${err.message}` };
  }
  if (!isObject(data)) return { reason: `${file} must hold a JSON object` };
  return { raw, data };
}

/** The object that holds the pointer's last key, as `{ holder }`, walking down from `data`; `{ missing }`,
 * the count of objects of the path that are not there; or `{ reason }` when something that is no object
 * stands where one must be. With `create`, the missing ones are made on the way. */
function holderOf(file, data, pointer, create) {
  let holder = data;
  let missing = 0;
  for (const key of pointer.slice(0, -1)) {
    if (!(key in holder)) {
      if (!create) return { missing: true };
      holder[key] = {};
      missing += 1;
    } else if (!isObject(holder[key])) {
      return { reason: `${file}: "${key}" is not an object, so no key can be written under it` };
    }
    holder = holder[key];
  }
  return { holder, missing };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Writes `value` at `pointer` (the keys from the root down) of the JSON object in `file`:
 * - `{ state: 'written', record }`: the key was not there. `record` is what `undoSettingsKey` needs: the
 *   pointer, the value, whether the file and its folder were made here, and how many objects of the path;
 * - `{ state: 'kept' }`: the key already holds the value. Nothing is written and there is no record: a
 *   key the harness did not write is not the harness's to remove;
 * - `{ state: 'conflict', holds }`: the key holds another value, which is never overwritten;
 * - `{ state: 'problem', reason }`: the file cannot be read as a JSON object. It is left as it is.
 *
 * `earlier` holds the records of the keys the harness already wrote into this same file. What one of them
 * made (the file, its folder, an object of the path) is the harness's for this key too, so the keys can be
 * undone in any order: whichever goes last takes with it what is then empty. */
export function applySettingsKey(file, pointer, value, earlier = []) {
  const read = readObject(file);
  if (read.reason) return { state: 'problem', reason: read.reason };
  const data = read.absent ? {} : read.data;

  const found = holderOf(file, data, pointer, true);
  if (found.reason) return { state: 'problem', reason: found.reason };
  const leaf = pointer.at(-1);
  if (leaf in found.holder) {
    return same(found.holder[leaf], value) ? { state: 'kept' } : { state: 'conflict', holds: found.holder[leaf] };
  }
  found.holder[leaf] = value;

  // The objects of this key's path that are the harness's, counted from the deepest up: one made just now,
  // or one an earlier key of the harness made. The count stops at the first that was somebody else's.
  const ours = new Set(earlier.flatMap((record) => madeObjects(record)));
  let createdContainers = 0;
  for (let depth = pointer.length - 1; depth >= 1; depth -= 1) {
    const madeNow = pointer.length - 1 - depth < found.missing;
    if (!madeNow && !ours.has(JSON.stringify(pointer.slice(0, depth)))) break;
    createdContainers += 1;
  }

  const madeDir = !fs.existsSync(path.dirname(file));
  if (madeDir) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, read.absent ? serializeJson(data, NEW_FILE) : textLike(read.raw, data));
  return {
    state: 'written',
    record: {
      pointer,
      value,
      createdFile: Boolean(read.absent) || earlier.some((record) => record.createdFile),
      createdDir: madeDir || earlier.some((record) => record.createdDir),
      createdContainers,
    },
  };
}

/** The objects a record says the harness made, each as the JSON of its keys from the root: the last
 * `createdContainers` objects of the record's path. */
function madeObjects(record) {
  const last = record.pointer.length - 1;
  return Array.from({ length: record.createdContainers }, (_, index) => JSON.stringify(record.pointer.slice(0, last - index)));
}

/** Undoes one `record` of `applySettingsKey` in `file`:
 * - `{ state: 'removed' }`: the key still held what was written and is gone, with each object of its path
 *   that was made here and is empty again; a file made here that holds nothing more is deleted, and its
 *   folder if that was made here and is empty;
 * - `{ state: 'changed', holds }`: someone changed the key since. It is theirs now and is kept;
 * - `{ state: 'gone' }`: the key or the file is no longer there. Nothing to do;
 * - `{ state: 'problem', reason }`: the file can no longer be read. It is left as it is. */
export function undoSettingsKey(file, record) {
  const read = readObject(file);
  if (read.absent) return { state: 'gone' };
  if (read.reason) return { state: 'problem', reason: read.reason };

  const { pointer } = record;
  const found = holderOf(file, read.data, pointer, false);
  if (found.reason) return { state: 'problem', reason: found.reason };
  const leaf = pointer.at(-1);
  if (found.missing || !(leaf in found.holder)) return { state: 'gone' };
  if (!same(found.holder[leaf], record.value)) return { state: 'changed', holds: found.holder[leaf] };
  delete found.holder[leaf];

  // The objects made here, from the deepest up: one that holds something of somebody else stays, and so
  // does everything above it.
  for (let made = 0, depth = pointer.length - 1; made < record.createdContainers && depth > 0; made += 1, depth -= 1) {
    const parent = pointer.slice(0, depth - 1).reduce((object, key) => object[key], read.data);
    const key = pointer[depth - 1];
    if (Object.keys(parent[key]).length > 0) break;
    delete parent[key];
  }

  if (record.createdFile && Object.keys(read.data).length === 0) {
    fs.rmSync(file);
    const dir = path.dirname(file);
    if (record.createdDir && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } else {
    fs.writeFileSync(file, textLike(read.raw, read.data));
  }
  return { state: 'removed' };
}
