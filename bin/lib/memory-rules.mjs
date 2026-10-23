// The `memory-rules` check of `doctor` (C6 of odd/tasks/rule-hierarchy.md, built as T4 of
// odd/tasks/commands-and-doctor.md): a note of the project's Claude Code memory whose type is
// `feedback` or `project` is a rule or a decision kept where nothing acts on it, since memory is read
// by an agent that may or may not recall it. `user` and `reference` notes are facts of the machine
// and are left. The note's type is the one Claude Code's memory instructions define, in its front
// matter: at the top, or under `metadata:` as this host writes it (31 notes read on 2026-10-14).
import fs from 'node:fs';
import path from 'node:path';
import { memoryNoteType } from './memory-index-guard.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';
import { PROTOCOLS } from './protocols-skill.mjs';

const RULE_TYPES = new Set(['feedback', 'project']);
const INDEX = 'MEMORY.md';

/** The fix of a `stale` row: where a rule goes, in order, then what is done to the note. The protocol's home
 * is section 4 of the protocols skill, whose title is read from there; the order is repeated for a host that
 * has not loaded it. */
export const MEMORY_RULES_FIX =
  `place each note with the protocol "${PROTOCOLS[3]}" of the js-harness-protocols skill (a check first, else a line of AGENTS.md, else a protocol), then delete the note:`;

// The reader of a note's type lives with the guard's memory checks, which import nothing (./memory-index-guard.mjs).
export { memoryNoteType };

/** The memory folder of the project `slug`: under `CLAUDE_CONFIG_DIR` when the host sets it, else under the `.claude` of
 * `home`, the rule every reader of the host's folder keeps (`bin/lib/pause.mjs`, `bin/rules.mjs`). The hook's notice,
 * `js-harness memory` and doctor's memory-rules row all name it here, so they read the same folder the host writes. */
export function memoryFolderOf(slug, { home, env = process.env }) {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'projects', slug, 'memory');
}

/** The check's cells and lines: `stale` with one line per rule note (`<file> (<type>)`, by name),
 * `ok` when the memory folder holds none, `n/a` when the project has no memory folder, `unknown`
 * when anything throws. The folder is the main checkout's, so a worktree reads the same notes as
 * the checkout: Claude Code keeps one memory for a repository. */
export function memoryRulesState({ home, project, spawn, env = process.env }) {
  try {
    const run = (command, args, options) => spawn(command, args, { ...options, encoding: 'utf8', windowsHide: true });
    const folder = memoryFolderOf(projectSlug(mainCheckout(run, project)), { home, env });
    if (!fs.existsSync(folder)) return { claude: 'n/a', codex: 'n/a', lines: [] };
    const lines = [];
    for (const name of fs.readdirSync(folder).sort()) {
      if (name === INDEX || !name.endsWith('.md')) continue;
      const type = memoryNoteType(fs.readFileSync(path.join(folder, name), 'utf8'));
      if (RULE_TYPES.has(type)) lines.push(`${name} (${type})`);
    }
    return { claude: lines.length > 0 ? 'stale' : 'ok', codex: 'n/a', lines };
  } catch {
    return { claude: 'unknown', codex: 'n/a', lines: [] };
  }
}
