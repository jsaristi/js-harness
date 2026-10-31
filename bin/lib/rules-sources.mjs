// The sources of directive coverage (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md; the reverse-engineering document,
// section 14.2 item 1): every text the harness ships or sends to an agent. Each file `install` writes whole is a
// source, read from the manifest's components so a new one is a source the day it is added; so are the Rules block
// it writes into the user's `~/.claude/CLAUDE.md`, the files `init` writes into a project, the lead's opening prompt
// and this repository's own `CLAUDE.md` and `AGENTS.md`, which every session here loads. A producer of a hook's
// messages builds them at run time, so it is listed by its path and owed whole until its messages are cut (S5c-b),
// or, added after the baseline, cut from the start into a text source of its own (`CUT_MESSAGE_SOURCES`);
// bin/lib/rules-sources.test.mjs finds every producer in the code and holds the two lists to it.
import { components } from './manifest.mjs';
import { rulesBody } from './rules-block.mjs';
import { FAILURES_TEMPLATE, agentsTemplate, claudeTemplate } from './project.mjs';
import { LEAD_OPENING_PROMPT } from './lead-prompt.mjs';
import { GATE_MESSAGES } from './template-gate.mjs';

/** The files of this repository that are sources, read where `rules coverage` runs. */
export const REPOSITORY_FILES = ['AGENTS.md', 'CLAUDE.md'];

/** The modules that build at run time a text an agent is sent: a hook's messages (`systemMessage`,
 * `additionalContext`, a decision and its reason), a review's or a background session's prompt, the pause notice
 * (`cutRule`). Each is a source owed whole since the baseline. */
export const MESSAGE_SOURCES = [
  'bin/backup.mjs',
  'bin/doctor.mjs',
  'bin/guard.mjs',
  'bin/lib/background.mjs',
  'bin/lib/codex-review-prompt.mjs',
  'bin/lib/codex-review-recheck.mjs',
  'bin/lib/guard.mjs',
  'bin/lib/hook-entries.mjs',
  'bin/lib/lens-prompts.mjs',
  'bin/lib/payload.mjs',
  'bin/lib/rules-reach.mjs',
  'bin/lib/sessions.mjs',
  'bin/reply.mjs',
  'bin/resume.mjs',
];

/** The producers whose messages are cut: each one sends only the sentences of a text source, named here, whose spans
 * the register declares like any other source's, so none is owed whole. A producer added after the baseline goes
 * here, never into `MESSAGE_SOURCES`. */
export const CUT_MESSAGE_SOURCES = Object.freeze({
  'bin/template.mjs': 'template-gate',
});

// The folder name a project's AGENTS.md is titled with; its title is a heading, and no span.
const PROJECT = 'project';

/** A component's source id: its id without the host it is written for. Only Claude Code's are written now (D4), and the
 * ids an earlier version's Codex copies shared stay as the coverage data names them. */
const shippedId = (component) => component.id.replace(/^(?:claude|codex)-/, '');

/** The text sources at `version`: `{ id, from, text }` each, `from` saying where the text goes. Each file `install`
 * writes is one source. `readFile(path)` gives a file of this repository, or `null` when it is not
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
    { id: 'template-gate', from: 'hook', text: GATE_MESSAGES },
  );
  for (const file of REPOSITORY_FILES) {
    const text = readFile(file);
    if (text !== null) sources.push({ id: file, from: 'repository', text });
  }
  return sources;
}
