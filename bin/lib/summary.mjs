// The summary a work session leaves when it finishes (odd/tasks/session-close.md): one committed file,
// `docs/sessions/<date>-<title-slug>.md`, that the lead reads before it archives the session. It is kept for
// reverse engineering how the work went, so it holds facts with their evidence, not prose. The template and
// the check `notify --kind closed --summary` makes read the same headings, so they cannot drift (S5).
import { titleSlug } from './channel.mjs';

/** The folder of the summaries, relative to the repository's root. */
export const SUMMARY_DIR = 'docs/sessions';

/** The sections of a summary, in order, each with what it holds: the placeholder the template prints under it. */
const SECTIONS = [
  ['Goal', 'what the session was opened for, in one or two sentences, and the opening it read'],
  ["The user's words", "the user's words that started the work, quoted, with the transcript and line they are read from (js-harness sessions --quote)"],
  ['Delivered', 'each pull request, commit and feature document, with its state (merged, ready, open)'],
  ['Decisions', 'each decision, whose it was (the user, the lead, this session) and where it is recorded'],
  ['Failures and lessons', 'what failed, how it was found, and what changed so it does not come back'],
  ['Left', 'what is not done, and who holds it'],
  ['Cost', 'time (first and last notice), context share at the end, reviews run (gentle-ai, Codex) and gate runs'],
];

export const SUMMARY_HEADINGS = SECTIONS.map(([heading]) => heading);

/** The UTC day of `at` (milliseconds), as `YYYY-MM-DD`. */
const dayOf = (at) => new Date(at).toISOString().slice(0, 10);

/** The file of the summary of the session titled `title`, written on the day of `at`: `null` for a title with
 * no letter or digit, which gives no name. */
export function summaryPath(title, at) {
  const slug = titleSlug(title);
  return slug === '' ? null : `${SUMMARY_DIR}/${dayOf(at)}-${slug}.md`;
}

/** The template of the summary of the session titled `title`, written on the day of `at`. */
export function summaryTemplate(title, at) {
  const lines = [
    `# ${title.trim()}`,
    '',
    `File: ${summaryPath(title, at)}. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".`,
  ];
  for (const [heading, holds] of SECTIONS) lines.push('', `## ${heading}`, `<${holds}>`);
  return `${lines.join('\n')}\n`;
}

/** What keeps `text` from being a summary, `[]` when nothing does: each heading missing, and each one with
 * nothing under it but blank lines and the template's placeholders. */
export function summaryProblems(text) {
  const bodies = new Map();
  let current = null;
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      if (!bodies.has(current)) bodies.set(current, []);
    } else if (current !== null) bodies.get(current).push(line.trim());
  }
  const problems = [];
  for (const heading of SUMMARY_HEADINGS) {
    if (!bodies.has(heading)) problems.push(`"${heading}" is missing`);
    else if (!bodies.get(heading).some((line) => line !== '' && !/^<.*>$/.test(line))) problems.push(`"${heading}" is empty`);
  }
  return problems;
}
