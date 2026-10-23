// The summary a work session leaves when it finishes (odd/tasks/session-close.md): one committed file,
// `docs/sessions/<date>-<title-slug>.md`, that the lead reads before it archives the session. It is kept for
// reverse engineering how the work went, so it holds facts with their evidence, not prose. The template and
// the check `notify --kind closed --summary` makes read the same headings, so they cannot drift (S5).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { titleSlug } from './channel.mjs';

/** The folder of the summaries, relative to the repository's root. */
const SUMMARY_DIR = 'docs/sessions';

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
const PLACEHOLDERS = new Set(SECTIONS.map(([, holds]) => `<${holds}>`));

/** `text` with the line ends git keeps, so a working copy with CRLF reads as the blob it was committed as. */
const lf = (text) => String(text).replace(/\r\n/g, '\n');

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
  let fence = null;
  for (const line of lf(text).split('\n')) {
    // A heading inside a fenced block is the block's text, not a section. As Markdown reads it, a fence opens on
    // three or more backticks or tildes indented three spaces at most, whose text after a run of backticks holds no
    // backtick, and closes only on a bare run of the same character at least as long as the one that opened it.
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const wasFenced = fence !== null;
    if (!wasFenced && marker !== null && !(marker[1][0] === '`' && marker[2].includes('`'))) fence = marker[1];
    else if (wasFenced && marker !== null && marker[1][0] === fence[0] && marker[1].length >= fence.length && marker[2].trim() === '') fence = null;
    const heading = wasFenced || fence !== null ? null : /^## (.+?)\s*$/.exec(line);
    if (heading) {
      current = heading[1];
      if (!bodies.has(current)) bodies.set(current, []);
    } else if (current !== null) bodies.get(current).push(line.trim());
  }
  const problems = [];
  for (const heading of SUMMARY_HEADINGS) {
    if (!bodies.has(heading)) problems.push(`"${heading}" is missing`);
    // Only the template's own placeholder is no content: a line in angle brackets may be an autolink, a fact.
    else if (!bodies.get(heading).some((line) => line !== '' && !PLACEHOLDERS.has(line))) problems.push(`"${heading}" is empty`);
  }
  return problems;
}

/** What keeps the summary `file` (relative to the repository's root) from closing a session, `[]` when nothing
 * does: it is not in the worktree at `cwd`, a section of it is missing or empty, or neither origin/main nor the
 * session's branch on origin holds it as it is now, as this clone last fetched origin. The lead reads it from git,
 * and a file only on one worktree's disk dies with that worktree (S2). `run` is `spawnSync`'s shape. */
export function closeProblems(file, cwd, { run = (command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true, timeout: 30000 }), readFile = (absolute) => fs.readFileSync(absolute, 'utf8') } = {}) {
  const git = (...args) => {
    const result = run('git', args, { cwd });
    return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? '') };
  };
  const top = git('rev-parse', '--show-toplevel');
  if (!top.ok) return [`${cwd} is not in a git repository, so ${file} cannot be read as committed.`];
  let text;
  try {
    text = readFile(path.join(top.out.trim(), file));
  } catch (err) {
    return [`${file} is not in this worktree (${err.code ?? err.message}): write it from js-harness summary template.`];
  }
  const sections = summaryProblems(text);
  if (sections.length > 0) return [`${file}: ${sections.join(', ')}.`];
  const branch = git('branch', '--show-current').out.trim();
  // The default branch as origin names it, then origin/main, which the brief names even where origin's default
  // is another branch, then the session's own branch on origin: the first that holds the file as it is wins.
  const main = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD').out.trim();
  const refs = [...new Set([main, 'origin/main', branch === '' ? '' : `origin/${branch}`].filter((ref) => ref !== ''))];
  let differs = null;
  for (const ref of refs) {
    const shown = git('show', `${ref}:${file}`);
    if (!shown.ok) continue;
    if (lf(shown.out) === lf(text)) return [];
    differs ??= ref;
  }
  if (differs !== null) return [`${differs} holds a different copy of ${file}: commit and push it as it is now.`];
  const where = refs.length === 1 ? `${refs[0]} does not hold it` : `neither ${refs.join(' nor ')} holds it`;
  return [`${file} is not pushed: ${where}; commit it and push.`];
}
