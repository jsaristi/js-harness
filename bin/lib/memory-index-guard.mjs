// What `js-harness guard --hook` decides for a `Write` or an `Edit` (T4 of odd/tasks/memory-hygiene.md): a line of a
// project's Claude Code memory index (`~/.claude/projects/<slug>/memory/MEMORY.md`) over the host's limit is refused
// when it is written. The index is read on every turn of every session, and it had grown to lines of 844
// characters. The guard runs on every Write and Edit of every session, so this file imports nothing: the path of a
// file that is no memory index returns before anything else is loaded.

/** The host's own figure for an index line (the `consolidate-memory` skill: "under ~150 chars"): a constant with
 * one home, not a rule. Counted in code points. */
const INDEX_LINE_CHARS = 150;

const MEMORY_FILE = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]([^\\/]+)$/i;

/** The name of the file `filePath` is in a project's memory folder, or null when it is in none: under a `.claude`
 * folder, or under `configDir` (Claude Code's `CLAUDE_CONFIG_DIR`, which need not be named `.claude`), compared
 * without case and with either separator (a name under `configDir` comes back in lower case). */
export function memoryFileOf(filePath, configDir) {
  if (typeof filePath !== 'string') return null;
  const match = MEMORY_FILE.exec(filePath);
  if (match) return match[1];
  if (typeof configDir !== 'string' || configDir === '') return null;
  const norm = (text) => text.replace(/\\/g, '/').toLowerCase();
  const root = `${norm(configDir).replace(/\/+$/, '')}/projects/`;
  const file = norm(filePath);
  const inside = file.startsWith(root) ? /^[^/]+\/memory\/([^/]+)$/.exec(file.slice(root.length)) : null;
  return inside === null ? null : inside[1];
}

/** The `type:` of a note's leading `---` front matter, at any indentation, or `null` when it has
 * none. A flat reader: the front matter of a memory note is a few `key: value` lines. It is here, in the file
 * the guard loads for every Write and Edit, so that a note's type is known before any other module is loaded. */
export function memoryNoteType(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  for (const line of lines.slice(1)) {
    if (line === '---') return null;
    const match = /^\s*type:\s*([A-Za-z]+)\s*$/.exec(line);
    if (match) return match[1];
  }
  return null;
}

/** Whether `filePath` is a project's memory index, `MEMORY.md` of its memory folder. */
function isMemoryIndex(filePath, configDir) {
  return memoryFileOf(filePath, configDir)?.toLowerCase() === 'memory.md';
}

/** The file the `Write` or `Edit` of `toolInput` leaves, given the file on disk (`before`, null when unreadable), or
 * null when it cannot be known. An Edit whose file cannot be read, or whose old text is not in it, is judged by its
 * new text alone. The replacement is spliced, not passed to `String.replace`, so `$&` in the text stays literal. */
export function resultOf(toolName, toolInput, before) {
  if (toolName === 'Write') return typeof toolInput.content === 'string' ? toolInput.content : null;
  if (toolName !== 'Edit' || typeof toolInput.new_string !== 'string') return null;
  const { old_string: oldText, new_string: newText } = toolInput;
  const at = before === null || typeof oldText !== 'string' || oldText === '' ? -1 : before.indexOf(oldText);
  if (at === -1) return newText;
  if (toolInput.replace_all === true) return before.split(oldText).join(newText);
  return before.slice(0, at) + newText + before.slice(at + oldText.length);
}

/** Why the `Write` or `Edit` of `toolInput` is refused, or null: the first line of the file it leaves that is longer
 * than the limit and was not already in the file, numbered in that file. `readIndex(path)` reads the file on disk; a
 * line already long there is the hygiene pass's to shorten, not a reason to block every other edit until then. */
export function memoryIndexRefusal(toolName, toolInput, readIndex, configDir) {
  if (!isMemoryIndex(toolInput?.file_path, configDir)) return null;
  let before = null;
  try {
    before = readIndex(toolInput.file_path);
  } catch {
    // A new index, or one that cannot be read: every line of the call is judged.
  }
  const text = resultOf(toolName, toolInput, typeof before === 'string' ? before : null);
  if (typeof text !== 'string') return null;
  const existing = new Set(typeof before === 'string' ? before.split(/\r?\n/) : []);
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => [...line].length > INDEX_LINE_CHARS && !existing.has(line));
  if (at === -1) return null;
  const length = [...lines[at]].length;
  return `js-harness guard: line ${at + 1} of the memory index is ${length} characters, over the host's ${INDEX_LINE_CHARS} `
    + '(the index is read on every turn of every session). Keep the line a short hook and put the detail in the note it '
    + 'links to (the js-harness skill, "Memory hygiene").';
}
