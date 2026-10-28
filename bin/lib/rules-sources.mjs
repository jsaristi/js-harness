// The sources of directive coverage (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md; the reverse-engineering document,
// section 14.2 item 1): every text the harness ships or sends to an agent. Each file `install` writes whole is a
// source, read from the manifest's components so a new one is a source the day it is added; so are the Rules block
// it writes into the user's `~/.claude/CLAUDE.md`, the files `init` writes into a project, the lead's opening prompt
// and this repository's own `CLAUDE.md` and `AGENTS.md`, which every session here loads. A producer of a hook's
// messages builds them at run time, so it is listed by its path and owed whole until its messages are cut (S5c-b);
// bin/lib/rules-sources.test.mjs finds every producer in the code and holds this list to it.
import { components } from './manifest.mjs';
import { rulesBody } from './rules-block.mjs';
import { FAILURES_TEMPLATE, agentsTemplate, claudeTemplate } from './project.mjs';
import { LEAD_OPENING_PROMPT } from './lead-prompt.mjs';

/** The files of this repository that are sources, read where `rules coverage` runs. */
export const REPOSITORY_FILES = ['AGENTS.md', 'CLAUDE.md'];

/** The modules that build a hook's messages (`systemMessage`, `additionalContext`, a decision and its reason), each a
 * source owed whole since the baseline. */
export const MESSAGE_SOURCES = [
  'bin/backup.mjs',
  'bin/doctor.mjs',
  'bin/guard.mjs',
  'bin/lib/guard.mjs',
  'bin/lib/hook-entries.mjs',
  'bin/lib/payload.mjs',
  'bin/lib/rules-reach.mjs',
  'bin/reply.mjs',
  'bin/resume.mjs',
];

// The folder name a project's AGENTS.md is titled with; its title is a heading, and no span.
const PROJECT = 'project';

/** A component's source id: its id without the host it is written for, since both hosts get the same text. */
const shippedId = (component) => component.id.replace(/^(?:claude|codex)-/, '');

/** The text sources at `version`: `{ id, from, text }` each, `from` saying where the text goes. Each file `install`
 * writes for both hosts is one source. `readFile(path)` gives a file of this repository, or `null` when it is not
 * there, which leaves that source out. */
export function textSources(version, readFile) {
  const sources = [];
  const seen = new Set();
  for (const component of components) {
    const id = shippedId(component);
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({ id, from: 'install', text: String(component.content(version)) });
  }
  sources.push(
    { id: 'rules-block', from: 'install', text: rulesBody() },
    { id: 'init-agents', from: 'init', text: agentsTemplate(PROJECT) },
    { id: 'init-agents-whole', from: 'init', text: agentsTemplate(PROJECT, { split: false }) },
    { id: 'init-claude', from: 'init', text: claudeTemplate() },
    { id: 'init-failures', from: 'init', text: FAILURES_TEMPLATE },
    { id: 'lead-prompt', from: 'sessions', text: LEAD_OPENING_PROMPT },
  );
  for (const file of REPOSITORY_FILES) {
    const text = readFile(file);
    if (text !== null) sources.push({ id: file, from: 'repository', text });
  }
  return sources;
}
