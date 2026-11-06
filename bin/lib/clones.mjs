// The clones js-harness fetches on request (odd/tasks/idea-watch.md, S6): the idea watch's bare clone of the upstream
// repository, under ~/.js-harness/upstream. What the harness writes outside a repository is undone exactly (AGENTS.md),
// so a clone is recorded in the machine manifest's `clones` before it is fetched, and `uninstall machine` removes it.
// A folder has no bytes to hash, so it is judged by where it is: only a folder strictly inside `~/.js-harness`, as
// written and as it resolves, is removed, so neither a manifest edited by hand nor a link or junction under
// `~/.js-harness` can point the recursive removal anywhere else. `uninstall` hands each
// record here through `deps.removeClones`, as it hands `stack install`'s rows to `deps.undoStack`, since this module
// imports the manifest's helpers (bin/lib/manifest.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { keepRecord, removeEmptyDirsUpTo } from './manifest.mjs';

/** Records that the repository `url` is fetched into the folder `path`, in place of any record of that path, creating
 * the manifest (with a `null` version: nothing is installed) when there is none. Like an optional file, no component
 * declares one, and `install` and `sync` carry the array as it is. Returns the record. */
export function recordClone(home, clone) {
  const record = { path: clone.path, url: clone.url };
  return keepRecord(home, 'clones', record, (entry) => entry.path === clone.path);
}

/** Removes each recorded clone whole, as `{ removed, kept, failedRecords }`. One recorded outside `~/.js-harness`, or
 * resolving outside it through a link, is kept with reason `outside` and its record dropped, since no run will ever remove it; one already gone is neither.
 * One that cannot be looked at or removed is kept with reason `unremovable` and the error's `code`, and its record
 * stays for a run again. The folders a removal leaves empty go with it, up to the home. The fs seams are
 * `uninstall`'s own. */
export function removeClones(records, home, { removeFile = fs.rmSync, statFile = fs.statSync, listDir = fs.readdirSync, realPath = fs.realpathSync.native } = {}) {
  const ours = path.join(home, '.js-harness');
  const inside = (root, target) => {
    const relative = path.relative(root, target);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  const removed = [];
  const kept = [];
  const failedRecords = [];
  for (const record of records) {
    if (!inside(ours, path.resolve(record.path))) {
      kept.push({ path: record.path, reason: 'outside' });
      continue;
    }
    let real;
    try {
      statFile(record.path);
      // Judged where it resolves too: a link or junction above it, or the folder itself, may point out of ours.
      real = { clone: realPath(record.path), ours: realPath(ours) };
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      kept.push({ path: record.path, reason: 'unremovable', code: err.code ?? 'unknown error' });
      failedRecords.push(record);
      continue;
    }
    if (!inside(real.ours, real.clone)) {
      kept.push({ path: record.path, reason: 'outside' });
      continue;
    }
    try {
      removeFile(record.path, { recursive: true, force: true });
    } catch (err) {
      kept.push({ path: record.path, reason: 'unremovable', code: err.code ?? 'unknown error' });
      failedRecords.push(record);
      continue;
    }
    removeEmptyDirsUpTo(path.dirname(record.path), home, listDir);
    removed.push(record.path);
  }
  return { removed, kept, failedRecords };
}
