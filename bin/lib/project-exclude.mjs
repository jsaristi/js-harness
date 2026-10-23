// The line `init` adds to the clone's `info/exclude` so git leaves `.atl/` out of what is untracked: gentle-ai
// keeps its skill registry there (`.atl/skill-registry.md`), and its review called that file an unassessable
// untracked one at every commit of a project (finding 5 of JH 43, odd/tasks/quiet-gate.md). The exclude file is
// the clone's own, like the hook and the manifest, and what was added is recorded so `uninstall` takes back that
// and nothing else. Zero deps; the file system is injectable for the writes and removals.
import fs from 'node:fs';
import path from 'node:path';

/** The line added: every `.atl` folder of the working tree, as gentle-ai writes one at the root. */
export const EXCLUDED = '.atl/';

/** The spellings of a line that already leaves `.atl/` out, so none is added beside it. */
const SAME = new Set(['.atl/', '.atl', '/.atl/', '/.atl']);

/** Whether the lines of `text` leave `.atl/` out: git follows the last line that matches, so a `!.atl/` after one of
 * `SAME` brings it back (Codex P2 on dea129b..118f479). */
const leavesOut = (text) => {
  const last = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .findLast((line) => SAME.has(line.replace(/^!/, '')));
  return last !== undefined && !last.startsWith('!');
};

const readOrNull = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
};

/** Adds `EXCLUDED` to the exclude file `file` once: the record to keep in the manifest, `{ line, separator,
 * createdFile, createdDir }`, or `null` where its lines already leave `.atl` out, nothing being written.
 * `separator` says a line break was put before the line, to end a last line that had none. */
export function addExclude(file, { writeFile = fs.writeFileSync, mkdir = fs.mkdirSync } = {}) {
  const text = readOrNull(file);
  if (text !== null && leavesOut(text)) return null;
  const createdDir = text === null && !fs.existsSync(path.dirname(file));
  if (createdDir) mkdir(path.dirname(file), { recursive: true });
  const separator = text !== null && text !== '' && !text.endsWith('\n');
  writeFile(file, `${text ?? ''}${separator ? '\n' : ''}${EXCLUDED}\n`, 'utf8');
  return { line: EXCLUDED, separator, createdFile: text === null, createdDir };
}

/** Whether `record` is one `addExclude` returned, so a manifest cannot point an undo at another line. */
export function isValidExcludeRecord(record) {
  return (
    record !== null &&
    typeof record === 'object' &&
    !Array.isArray(record) &&
    record.line === EXCLUDED &&
    ['separator', 'createdFile', 'createdDir'].every((key) => typeof record[key] === 'boolean')
  );
}

/** Takes back what `addExclude` recorded in `file`: the line with the break put before it, where it is still the
 * end of the file, or else the last line that is `EXCLUDED` alone, wherever lines were added after it; then the
 * file, where this made it and nothing else is left, and its folder, where that is empty too. `'removed'`, or
 * `'gone'` where neither the file nor such a line is there. */
export function undoExclude(file, record, { writeFile = fs.writeFileSync, rm = fs.rmSync, rmdir = fs.rmdirSync } = {}) {
  const text = readOrNull(file);
  if (text === null) return 'gone';
  const tail = `${record.separator ? '\n' : ''}${EXCLUDED}\n`;
  const start = text.length - tail.length;
  // Without a separator the line is whole only where it begins the file or follows a break: `x.atl/` is another line.
  const atEnd = text.endsWith(tail) && (record.separator || start === 0 || text[start - 1] === '\n');
  let rest;
  if (atEnd) {
    rest = text.slice(0, start);
  } else {
    const lines = text.split('\n');
    const at = lines.findLastIndex((line) => line.replace(/\r$/, '') === EXCLUDED);
    if (at === -1) return 'gone';
    lines.splice(at, 1);
    rest = lines.join('\n');
  }
  if (record.createdFile && rest === '') {
    rm(file, { force: true });
    if (record.createdDir) {
      try {
        rmdir(path.dirname(file));
      } catch {
        // A folder that holds something else now, or is gone, is not this undo's to judge.
      }
    }
  } else {
    writeFile(file, rest, 'utf8');
  }
  return 'removed';
}
