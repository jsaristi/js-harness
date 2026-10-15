// What `js-harness guard --hook` decides for a `Write` or an `Edit` (T4 of odd/tasks/memory-hygiene.md): a line of a
// project's Claude Code memory index (`~/.claude/projects/<slug>/memory/MEMORY.md`) over the host's limit is refused
// when it is written. The index is read on every turn of every session, and it had grown to lines of 844
// characters. The guard runs on every Write and Edit of every session, so this file imports nothing: the path of a
// file that is no memory index returns before anything else is loaded.

/** The host's own figure for an index line (the `consolidate-memory` skill: "under ~150 chars"): a constant with
 * one home, not a rule. Counted in code points. */
export const INDEX_LINE_CHARS = 150;

const MEMORY_INDEX = /[\\/]\.claude[\\/]projects[\\/][^\\/]+[\\/]memory[\\/]MEMORY\.md$/i;

/** Whether `filePath` is a project's memory index. */
export function isMemoryIndex(filePath) {
  return typeof filePath === 'string' && MEMORY_INDEX.test(filePath);
}

/** Why the `Write` or `Edit` of `toolInput` is refused, or null: the first line it writes into a memory index that is
 * longer than the limit, with its number in what is written (the whole file for a Write, the new text for an Edit). */
export function memoryIndexRefusal(toolName, toolInput) {
  if (!isMemoryIndex(toolInput?.file_path)) return null;
  const text = toolName === 'Write' ? toolInput.content : toolName === 'Edit' ? toolInput.new_string : null;
  if (typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => [...line].length > INDEX_LINE_CHARS);
  if (at === -1) return null;
  const length = [...lines[at]].length;
  return `js-harness guard: line ${at + 1} of the memory index is ${length} characters, over the host's ${INDEX_LINE_CHARS} `
    + '(the index is read on every turn of every session). Keep the line a short hook and put the detail in the note it '
    + 'links to (the js-harness skill, "Memory hygiene").';
}
