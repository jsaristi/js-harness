// The install/sync/uninstall engine: components are data, so adding one never
// touches the fs-walking logic below, and uninstall can undo exactly what install wrote.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cachePath } from './cache.mjs';

function skillContent(version) {
  return `---
name: js-harness
description: Install, update, and check js-harness (v${version}) status and commands.
---

js-harness commands:
- \`js-harness status\` — installed version, manifest version, and latest available.
- \`js-harness install\` — write this skill and record a manifest under the home.
- \`js-harness sync\` — re-write installed files for the running version.
- \`js-harness update\` — check whether a newer release exists.
- \`js-harness upgrade\` — install the newer release, then sync.
- \`js-harness uninstall\` — remove exactly what install wrote.
`;
}

/** Components are data: where each one lives under a home, and what it contains at a version. */
export const components = [
  {
    id: 'claude-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'codex-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
];

/** Entry-level components: one JSON value js-harness appends to an array at `pointer` inside a
 * JSON file it does not own (e.g. another host's hook list). Unlike `components` above, install
 * never owns the whole file — only the one entry it grafts on, so every operation here reads,
 * patches and writes back the smallest possible diff instead of overwriting the file. */
export const entryComponents = [
  {
    id: 'claude-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
  {
    id: 'codex-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
];

/** `doctor --hook` (T3) registered as a `SessionStart` hook: zero model tokens on a session start
 * with nothing new to report (see odd/tasks/stack-doctor.md, "Registration"). */
function hookEntry() {
  return {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  };
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Structural equality for plain JSON values (objects/arrays/primitives) — used to recognize "the
 * same entry" regardless of key order, so a file re-saved by another tool still matches. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** True when every container in a JSON value is empty — an object we created (or its parents) is
 * safe to delete only once removing our entry leaves nothing else behind. */
function isEmptyJsonDoc(value) {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value).every(isEmptyJsonDoc);
  return false;
}

function serializeJson(data, { trailingNewline, useCRLF }) {
  let text = JSON.stringify(data, null, 2);
  if (trailingNewline) text += '\n';
  if (useCRLF) text = text.replace(/\n/g, '\r\n');
  return text;
}

/** Appends `entry` at `pointer` inside the JSON file at `target`, creating intermediate objects
 * and the array itself as needed. Missing file -> starts from `{}` (`createdFile: true`).
 * Malformed JSON, or a root/pointer shape that is not the object/array we expect -> left
 * completely untouched and reported `skipped`, never overwritten. Idempotent: an entry that is
 * already there (by deep equality) is left alone and the file is not rewritten at all, so a
 * repeat install/sync never reformats a file that already has what it needs. */
function appendEntryToFile(target, pointer, entry) {
  const fileExisted = fs.existsSync(target);
  const raw = fileExisted ? fs.readFileSync(target, 'utf8') : '{}';

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { skipped: true, createdFile: false };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { skipped: true, createdFile: false };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');

  let cursor = data;
  for (const key of pointer.slice(0, -1)) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  if (!Array.isArray(cursor[lastKey])) cursor[lastKey] = [];
  const arr = cursor[lastKey];

  if (arr.some((item) => deepEqual(item, entry))) {
    return { skipped: false, createdFile: !fileExisted };
  }

  arr.push(entry);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF }), 'utf8');
  return { skipped: false, createdFile: !fileExisted };
}

/** Removes the deep-equal entry at `pointer` inside `target`. A missing file, malformed JSON, a
 * pointer shape that does not match, or an entry that is not there (the user changed or removed
 * it) all leave the file completely untouched — reported `kept` (or nothing, for a missing file,
 * mirroring how `uninstall` already treats a missing file component). Deletes the whole file only
 * when `createdFile` is true (js-harness made it) and removing the entry leaves nothing but empty
 * containers behind. */
function removeEntryFromFile(target, pointer, entry, createdFile) {
  if (!fs.existsSync(target)) return { status: 'absent' };
  const raw = fs.readFileSync(target, 'utf8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: 'kept' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'kept' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');

  let cursor = data;
  for (const key of pointer.slice(0, -1)) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null || Array.isArray(cursor[key])) {
      return { status: 'kept' };
    }
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const arr = cursor[lastKey];
  if (!Array.isArray(arr)) return { status: 'kept' };

  const idx = arr.findIndex((item) => deepEqual(item, entry));
  if (idx === -1) return { status: 'kept' };
  arr.splice(idx, 1);

  if (createdFile && isEmptyJsonDoc(data)) {
    fs.rmSync(target, { force: true });
    return { status: 'removed' };
  }

  fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF }), 'utf8');
  return { status: 'removed' };
}

/** Installs every entry component, carrying forward `createdFile` from a previous manifest record
 * for the same target file (matched by path) rather than recomputing it from "does the file exist
 * right now" — a file js-harness created on the first install still existed for every later
 * install/sync call, but js-harness must still remember it made it, so uninstall can delete it. */
function installEntries(home, previousManifest) {
  return entryComponents.map((component) => {
    const target = component.target(home);
    const pointer = component.pointer;
    const entry = component.entry();
    const previousEntry = previousManifest?.entries?.find((e) => e.path === target);
    const result = appendEntryToFile(target, pointer, entry);
    return {
      path: target,
      pointer,
      entry,
      sha256: sha256(JSON.stringify(entry)),
      createdFile: previousEntry ? previousEntry.createdFile : result.createdFile,
      skipped: result.skipped === true,
    };
  });
}

export function manifestPath(home) {
  return path.join(home, '.js-harness', 'manifest.json');
}

export function readManifest(home) {
  const file = manifestPath(home);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeManifest(home, manifest) {
  const file = manifestPath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), 'utf8');
}

/** Removes `dir` and any now-empty parent up to (but not including) `home`. */
function removeEmptyDirsUpTo(dir, home) {
  let current = path.resolve(dir);
  const stop = path.resolve(home);
  while (current !== stop && current.startsWith(stop)) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

/** Writes every component for `version`, grafts every entry component, and records the resulting
 * manifest. Reads any previous manifest first (still on disk, since `writeManifest` below is the
 * last thing this does) so entry `createdFile` flags survive a repeat install — see
 * `installEntries`. */
export function install(home, version) {
  const previous = readManifest(home);
  const files = components.map((component) => {
    const target = component.target(home);
    const content = component.content(version);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return { path: target, sha256: sha256(content) };
  });
  const entries = installEntries(home, previous);
  const manifest = { version, files, entries };
  writeManifest(home, manifest);
  return manifest;
}

/** Re-writes components for `version`, drops files and entries the current release no longer
 * ships, and updates the manifest. An old manifest with no `entries` field (written before T4)
 * still loads: pruning simply has nothing to prune. */
export function sync(home, version) {
  const previous = readManifest(home);
  const manifest = install(home, version);

  if (previous) {
    const keep = new Set(manifest.files.map((f) => f.path));
    for (const file of previous.files) {
      if (keep.has(file.path)) continue;
      if (fs.existsSync(file.path)) {
        fs.rmSync(file.path);
        removeEmptyDirsUpTo(path.dirname(file.path), home);
      }
    }

    const keptEntries = manifest.entries ?? [];
    for (const entry of previous.entries ?? []) {
      if (entry.skipped) continue;
      const stillDeclared = keptEntries.some(
        (e) => e.path === entry.path && deepEqual(e.pointer, entry.pointer) && deepEqual(e.entry, entry.entry),
      );
      if (stillDeclared) continue;
      removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile);
    }
  }

  return manifest;
}

/** Deletes manifest files whose content is untouched; keeps and reports edited ones. Removes each
 * recorded entry the same way (deep-equal match only, file left alone otherwise — see
 * `removeEntryFromFile`), then the doctor cache (js-harness's own runtime cache, never part of
 * `files`/`entries` since it is not "installed content") and finally the manifest itself. */
export function uninstall(home) {
  const manifest = readManifest(home);
  if (!manifest) return { removed: [], kept: [], entriesRemoved: [], entriesKept: [] };

  const removed = [];
  const kept = [];
  for (const file of manifest.files) {
    if (!fs.existsSync(file.path)) continue;
    const current = fs.readFileSync(file.path, 'utf8');
    if (sha256(current) === file.sha256) {
      fs.rmSync(file.path);
      removeEmptyDirsUpTo(path.dirname(file.path), home);
      removed.push(file.path);
    } else {
      kept.push(file.path);
    }
  }

  const entriesRemoved = [];
  const entriesKept = [];
  for (const entry of manifest.entries ?? []) {
    if (entry.skipped) continue;
    const result = removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile);
    if (result.status === 'removed') entriesRemoved.push(entry.path);
    else if (result.status === 'kept') entriesKept.push(entry.path);
  }

  fs.rmSync(cachePath(home), { force: true });
  fs.rmSync(manifestPath(home), { force: true });
  removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home);

  return { removed, kept, entriesRemoved, entriesKept };
}
