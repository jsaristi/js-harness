// A session's SessionStart env files kept short (odd/tasks/session-env-trim.md). Claude Code hands every SessionStart
// hook a file of its own, `CLAUDE_ENV_FILE` (`~/.claude/session-env/<session>/sessionstart-hook-<index>.sh`), and puts
// what those files hold into every Bash command line of the session. The codex plugin's hook appends three `export`
// lines to its file at every start and never replaces them, so a long-lived session's file grows until the command line
// passes the 8,191 characters Windows allows and every Bash call fails (`session-env-file-cut` in docs/FAILURES.md).
// The plugin is not this repository's to edit, so a start rewrites a file that grew past `TRIM_AT_BYTES` to the last
// occurrence of each of its lines, after a backup and a record under the harness home that undo it exactly. It reads
// and writes the session's env folder and the record's folder; `backup --session-start` calls it at every start.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** The size past which a start rewrites an env file: about seven starts of the codex plugin's three lines, a quarter of
 * the 8,191-character command line it shares with the session's own command. */
export const TRIM_AT_BYTES = 2048;

/** The env files a SessionStart hook writes, the only ones rewritten; Claude Code empties the `cwdchanged-` and
 * `filechanged-` ones itself. */
const ENV_FILE = /^sessionstart-hook-\d+\.sh$/;

/** A line that sets one variable and reads none: `export NAME='value'`, with the codex plugin's `'"'"'` for a quote. */
const ASSIGNMENT = /^export [A-Za-z_][A-Za-z0-9_]*='(?:[^']|'"'"')*'$/;

/** `text` with only the last occurrence of each line, in the order those last occurrences come, or `null` when nothing
 * repeats or any line is not a plain assignment. For lines that each set one variable from a literal, the last
 * assignment of a variable is the last occurrence of its own text, so it is kept and nothing after it overrides it:
 * every variable ends with the value it had. A line of any other shape may depend on order, so its file is kept whole. */
export function trimmedEnvText(text) {
  const lines = text.split(/\r?\n/).filter((line) => line !== '');
  if (lines.length === 0 || !lines.every((line) => ASSIGNMENT.test(line))) return null;
  const last = new Map(lines.map((line, index) => [line, index]));
  if (last.size === lines.length) return null;
  return `${lines.filter((line, index) => last.get(line) === index).join('\n')}\n`;
}

/** A path quoted for a POSIX shell, so the record's undo runs as written. */
const quoted = (value) => `'${String(value).replace(/'/g, `'"'"'`)}'`;

/** The folder of the trims' backups and record under `home`. */
export function trimsDir(home) {
  return path.join(home, '.js-harness', 'session-env-trims');
}

/** A backup of `text` that overwrites none: `<dir>/<name>.<stamp>.sh`, numbered when that name is taken. */
function writeBackup(dir, name, stamp, text) {
  fs.mkdirSync(dir, { recursive: true });
  for (let n = 0; ; n += 1) {
    const file = path.join(dir, `${name.replace(/\.sh$/, '')}.${stamp}${n === 0 ? '' : `.${n}`}.sh`);
    try {
      fs.writeFileSync(file, text, { flag: 'wx' });
      return file;
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }
  }
}

/** `file` replaced by `text` through a temporary file beside it and a rename, so no reader sees half of it; the
 * temporary file is removed when the rename fails, and the failure is thrown. */
function replace(file, text) {
  const temp = `${file}.js-harness-trim-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, text);
    fs.renameSync(temp, file);
  } catch (err) {
    fs.rmSync(temp, { force: true });
    throw err;
  }
}

/** Rewrites each SessionStart env file of the session whose own file is `envFile` that is past `TRIM_AT_BYTES` and
 * `trimmedEnvText` shortens, and returns what it did, `[{ file, backup, bytesBefore, bytesAfter }]`; none when
 * `envFile` is not set or its folder is gone. Each rewrite writes the backup first, then reads the file again and goes
 * on only when it still holds what was read, since the codex hook appends in parallel with this one; the new text
 * replaces the file by a rename, so no reader sees half of it, and a line in `<home>/.js-harness/session-env-trims/
 * trims.jsonl` records the undo. A file that changed, or that cannot be replaced, is left as it is, with no backup and
 * no record; when the record cannot be written, the file gets its text back, with what was appended since kept after
 * it, and the backup goes; when the file was otherwise rewritten, or putting it back fails, the error is thrown with the
 * backup kept. `io.readFile` is for tests. */
export function trimSessionEnv({ envFile, home, now }, io = {}) {
  if (typeof envFile !== 'string' || envFile === '') return [];
  const readFile = io.readFile ?? ((file) => fs.readFileSync(file, 'utf8'));
  const folder = path.dirname(envFile);
  let names;
  try {
    names = fs.readdirSync(folder);
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  const at = new Date(now).toISOString();
  const stamp = at.replace(/[:.]/g, '-');
  const dir = trimsDir(home);
  const trims = [];
  for (const name of names.filter((entry) => ENV_FILE.test(entry)).sort()) {
    const file = path.join(folder, name);
    if (fs.statSync(file).size <= TRIM_AT_BYTES) continue;
    const text = readFile(file);
    const next = trimmedEnvText(text);
    if (next === null) continue;
    const backup = writeBackup(path.join(dir, path.basename(folder)), name, stamp, text);
    try {
      if (readFile(file) !== text) throw new Error('changed');
      replace(file, next);
    } catch {
      fs.rmSync(backup, { force: true });
      continue;
    }
    const trim = { file, backup, bytesBefore: Buffer.byteLength(text), bytesAfter: Buffer.byteLength(next) };
    const record = { at, ...trim, sha256Before: createHash('sha256').update(text).digest('hex'), undo: `cp -p ${quoted(backup)} ${quoted(file)}` };
    try {
      fs.appendFileSync(path.join(dir, 'trims.jsonl'), `${JSON.stringify(record)}\n`);
    } catch {
      // No change is left without its record: the file gets its text back, and only then does the backup go. What the
      // codex hook appended since the replace stays after that text; a file rewritten by anything else is not touched.
      const current = readFile(file);
      if (!current.startsWith(next)) throw new Error(`${file} changed after it was trimmed; its backup is ${backup}`);
      replace(file, text + current.slice(next.length));
      fs.rmSync(backup, { force: true });
      continue;
    }
    trims.push(trim);
  }
  return trims;
}

/** `trimSessionEnv` as a SessionStart hook calls it: on the hook's own `CLAUDE_ENV_FILE` in `env`, and never throwing,
 * since a hook never breaks a session; a folder or a file it cannot read or write is left as it was. */
export function trimAtSessionStart({ env, home, now }) {
  try {
    return trimSessionEnv({ envFile: env?.CLAUDE_ENV_FILE, home, now });
  } catch {
    return [];
  }
}
