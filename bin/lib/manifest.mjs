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
- \`js-harness status --global\` — installed version, manifest version, and latest available, for the machine.
- \`js-harness install\` — write this skill and record a manifest under the home.
- \`js-harness sync --global\` — re-write installed files for the running version.
- \`js-harness update\` — check whether a newer release exists.
- \`js-harness upgrade\` — install the newer release, then sync.
- \`js-harness uninstall --global\` — remove exactly what install wrote.
- \`js-harness codex-review --base <rev>\` — run \`codex exec review\` over <rev>..HEAD and record it, only when its successful commands showed every changed line of the patch; \`--unavailable <reason>\` records a skip when Codex cannot run.
- \`js-harness check --push\` — the gate a push must pass, and the only check it runs: every code commit since the remote's default branch lies in a recorded Codex review (\`--remote <name>\`, default origin).

Without \`--global\`, \`status\`, \`sync\` and \`uninstall\` act on the project inside an initialized repository
(report it, move it to its pin, undo it) and refuse in a git repository that is not one.
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

/** R3-003 (accepted T4 review follow-up): true when `value`, restricted to exactly our own
 * `pointer` path, has nothing else in it — at every level along the pointer that key must be the
 * *only* key present (any other key, even one with an empty-looking value like `{}` or `null`,
 * means this document is not ours alone to delete), and the value at the end of the pointer must
 * be the empty array we left behind after removing our entry. */
function isOnlyOurPointerPath(value, pointer) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  const [head, ...rest] = pointer;
  if (keys.length !== 1 || keys[0] !== head) return false;
  if (rest.length === 0) return Array.isArray(value[head]) && value[head].length === 0;
  return isOnlyOurPointerPath(value[head], rest);
}

/** R3-005 (accepted T4 review follow-up): detects the indent unit already used by `raw` so a
 * rewrite matches it instead of always reformatting to 2 spaces. `null` means compact single-line
 * JSON (no newlines besides, at most, one trailing one) and must stay compact; a tab or space run
 * right after the first real newline becomes the indent unit; anything else (a multi-line document
 * with no indented line, which should not normally happen) falls back to the historical default. */
function detectIndent(raw) {
  const body = raw.replace(/\r?\n$/, '');
  if (!body.includes('\n')) return null;
  const match = /\n([\t ]+)\S/.exec(body);
  if (!match) return 2;
  return match[1].includes('\t') ? '\t' : match[1].length;
}

function serializeJson(data, { trailingNewline, useCRLF, indent }) {
  let text = indent === null ? JSON.stringify(data) : JSON.stringify(data, null, indent);
  if (trailingNewline) text += '\n';
  if (useCRLF) text = text.replace(/\n/g, '\r\n');
  return text;
}

/** Appends `entry` at `pointer` inside the JSON file at `target`, creating intermediate objects
 * and the array itself as needed. Missing file -> starts from `{}` (`createdFile: true`).
 * Malformed JSON, a root/pointer shape that is not the object/array we expect, or any fs failure
 * reading or writing the target (R3-002: an unreadable file, a directory sitting at the path, an
 * unwritable or missing-as-a-directory host dir, ...) all leave the file completely untouched and
 * report `skipped`, never overwritten and never thrown out of install/sync. R3-001: an intermediate
 * key that already exists but is not a plain object, or a leaf that already exists but is not an
 * array, is treated the same way — a value of an unexpected shape is never clobbered. Idempotent:
 * an entry that is already there (by deep equality) is left alone and the file is not rewritten at
 * all, so a repeat install/sync never reformats a file that already has what it needs. */
function appendEntryToFile(target, pointer, entry) {
  let fileExisted;
  let raw;
  try {
    fileExisted = fs.existsSync(target);
    raw = fileExisted ? fs.readFileSync(target, 'utf8') : '{}';
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { skipped: true, createdFile: false, reason: 'malformed JSON' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { skipped: true, createdFile: false, reason: 'not a JSON object' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');
  const indent = fileExisted ? detectIndent(raw) : 2;

  let cursor = data;
  for (const key of pointer.slice(0, -1)) {
    const existing = cursor[key];
    if (existing === undefined) {
      cursor[key] = {};
    } else if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
      return { skipped: true, createdFile: false, reason: `"${key}" is not an object` };
    }
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const existingLeaf = cursor[lastKey];
  if (existingLeaf === undefined) {
    cursor[lastKey] = [];
  } else if (!Array.isArray(existingLeaf)) {
    return { skipped: true, createdFile: false, reason: `"${lastKey}" is not an array` };
  }
  const arr = cursor[lastKey];

  if (arr.some((item) => deepEqual(item, entry))) {
    return { skipped: false, createdFile: !fileExisted };
  }

  arr.push(entry);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }
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
  const indent = detectIndent(raw);

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

  // R3-003: only delete a file we created when nothing but empty containers along our own pointer
  // path remains — any other key, even one with an empty-looking value, keeps the file.
  if (createdFile && isOnlyOurPointerPath(data, pointer)) {
    fs.rmSync(target, { force: true });
    return { status: 'removed' };
  }

  fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
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
      ...(result.skipped ? { reason: result.reason } : {}),
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

/** Optional files: a file js-harness writes outside the home's own folders only when asked (the login launcher
 * of `remote start --at-login`, in the Windows Startup folder), kept in the manifest's `optional` array as
 * `{ path, sha256 }`, apart from `files`. No component declares one, so `install` and `sync` carry the array
 * forward as it is and never write, prune or drop such a file; `uninstall` removes each one whose bytes are
 * still what was recorded, and never the folder it is in, which is not ours.
 *
 * Records that `content` (a string, or the bytes) was written to `file`, replacing any record of that path. With
 * no manifest (js-harness was never installed on this machine) it creates one whose `version` is `null`: every
 * reader takes that for "not installed", and the record still lets `uninstall` undo the file. */
export function recordOptionalFile(home, file, content) {
  const manifest = readManifest(home) ?? { version: null, files: [], entries: [] };
  const record = { path: file, sha256: sha256(content) };
  const optional = [...(manifest.optional ?? [])];
  const at = optional.findIndex((entry) => entry.path === file);
  if (at === -1) optional.push(record);
  else optional[at] = record;
  writeManifest(home, { ...manifest, optional });
  return record;
}

/** Forgets the record of `file`, never touching the file itself; `false` when there was none. An empty `optional`
 * is dropped, so the manifest reads as it did before the first record, and a manifest left with nothing in it
 * (the one `recordOptionalFile` created) is removed, with its folder when that is empty. */
export function forgetOptionalFile(home, file) {
  const manifest = readManifest(home);
  if (!manifest?.optional?.some((entry) => entry.path === file)) return false;
  const { optional, ...rest } = manifest;
  const left = optional.filter((entry) => entry.path !== file);
  const empty = rest.version === null && (rest.files ?? []).length === 0 && (rest.entries ?? []).length === 0;
  if (left.length > 0) {
    writeManifest(home, { ...rest, optional: left });
  } else if (empty) {
    fs.rmSync(manifestPath(home), { force: true });
    removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home);
  } else {
    writeManifest(home, rest);
  }
  return true;
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
 * `installEntries`. `deps.writeFile` (default `fs.writeFileSync`) is an injectable seam so tests can
 * force a component write to fail without depending on real file permissions (chmod is unreliable
 * on Windows). R3-002 (accepted T4 review follow-up): a component whose host directory cannot be
 * reached (e.g. `.claude`/`.codex` is itself a plain file) is left out of `files` for this run
 * rather than throwing out of install/sync — the manifest still records whatever else was actually
 * written, and a later, healthy run picks the missing component back up. R3-001 (accepted final
 * review follow-up, lineage review-cef5637e2884c12a): when the previous manifest already had a
 * record for that same target, that record is carried forward instead of dropped — marked
 * `skipped: true` with the failure's `reason` — so a file js-harness already wrote is never
 * orphaned: uninstall can still find and remove it (see `uninstall` below, unchanged: it already
 * compares the real file's sha256 against whatever record it is handed), and `sync`'s pruning
 * (below) never mistakes a merely-failed rewrite for a component that is no longer shipped. */
export function install(home, version, deps = {}) {
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const previous = readManifest(home);
  const files = [];
  for (const component of components) {
    const target = component.target(home);
    const content = component.content(version);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeFile(target, content, 'utf8');
      files.push({ path: target, sha256: sha256(content), skipped: false });
    } catch (err) {
      const previousRecord = previous?.files?.find((f) => f.path === target);
      if (previousRecord) {
        files.push({ path: previousRecord.path, sha256: previousRecord.sha256, skipped: true, reason: err.message });
      }
      // else: never installed before, so there is nothing to carry forward or report as orphaned.
    }
  }
  const entries = installEntries(home, previous);
  // Optional files are carried forward as recorded (see `recordOptionalFile`): nothing here writes or drops one.
  const manifest = { version, files, entries, ...(previous?.optional ? { optional: previous.optional } : {}) };
  writeManifest(home, manifest);
  return manifest;
}

/** Re-writes components for `version`, drops files and entries the current release no longer
 * ships, and updates the manifest. An old manifest with no `entries` field (written before T4)
 * still loads: pruning simply has nothing to prune. `deps` is forwarded to `install` (see its
 * `deps.writeFile` seam above). */
export function sync(home, version, deps = {}) {
  const previous = readManifest(home);
  const manifest = install(home, version, deps);

  if (previous) {
    // R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): prune a file only
    // when its component is no longer *declared* at all — compared against `components`' own
    // current targets, not against this run's successful writes — so a component that is still
    // declared but merely failed to (re)write this run (carried forward above with `skipped: true`)
    // is never treated as "no longer shipped" and deleted.
    const declaredTargets = new Set(components.map((c) => c.target(home)));
    for (const file of previous.files) {
      if (declaredTargets.has(file.path)) continue;
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

/** Deletes manifest files whose content is untouched; keeps and reports edited ones, optional files
 * included (reported in the same two lists). Removes each
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

  // Optional files, compared by their bytes (a launcher need not be UTF-8). Their folder is left even when
  // empty: it is the system's (the Windows Startup folder), not one install made.
  for (const file of manifest.optional ?? []) {
    if (!fs.existsSync(file.path)) continue;
    if (sha256(fs.readFileSync(file.path)) === file.sha256) {
      fs.rmSync(file.path);
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
