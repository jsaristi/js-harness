// The Codex components install wrote up to 0.97.0, for the tests that hold what happens to them now
// (odd/tasks/drop-codex-components.md): the harness serves Claude Desktop's Code tab, with Codex as its reviewer, so
// `install` writes nothing under `~/.codex`, and a home an earlier version installed loses these on its next `sync` or
// `uninstall`. A test installs them through `install`'s `components` and `entryComponents` seams, as 0.97.0 declared
// them, then runs today's commands over that home. Nothing here touches the real home.
import path from 'node:path';
import { components, entryComponents } from './manifest.mjs';
import { backupHookEntry, fallbackHookEntry, hookEntry, replyHookEntry, resumeHookEntry } from './hook-entries.mjs';

const contentOf = (id) => components.find((component) => component.id === id).content;
const codexSkill = (id, folder, claudeId) => ({ id, target: (home) => path.join(home, '.codex', 'skills', folder, 'SKILL.md'), content: contentOf(claudeId) });
const codexHooks = (home) => path.join(home, '.codex', 'hooks.json');

/** The three Codex skills, a copy each of the Claude one. */
export const EARLIER_CODEX_FILES = Object.freeze([
  codexSkill('codex-skill', 'js-harness', 'claude-skill'),
  codexSkill('codex-orchestrator-skill', 'js-harness-orchestrator', 'claude-orchestrator-skill'),
  codexSkill('codex-protocols-skill', 'js-harness-protocols', 'claude-protocols-skill'),
]);

/** The five entries of the Codex hooks.json, in the order 0.97.0 grafted them. */
export const EARLIER_CODEX_ENTRIES = Object.freeze([
  { id: 'codex-hook', target: codexHooks, pointer: ['hooks', 'SessionStart'], entry: hookEntry },
  { id: 'codex-resume-hook', target: codexHooks, pointer: ['hooks', 'SessionStart'], entry: resumeHookEntry },
  { id: 'codex-reply-hook', target: codexHooks, pointer: ['hooks', 'Stop'], entry: replyHookEntry },
  { id: 'codex-backup-hook', target: codexHooks, pointer: ['hooks', 'Stop'], entry: backupHookEntry },
  { id: 'codex-fallback-hook', target: codexHooks, pointer: ['hooks', 'SessionStart'], entry: fallbackHookEntry },
]);

/** The `deps` of an install as 0.97.0 made it: today's components with the Codex ones after them. */
export const EARLIER_INSTALL = Object.freeze({
  components: [...components, ...EARLIER_CODEX_FILES],
  entryComponents: [...entryComponents, ...EARLIER_CODEX_ENTRIES],
});
