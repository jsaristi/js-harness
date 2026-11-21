// The template of a work session's brief, the file the lead hands `js-harness sessions start --brief` or points a
// `start_session` prompt at (docs/ROADMAP.md, "sessions start takes a base"): the review-gate brief was patched four
// times and three briefs carried a stale gate step. So the template holds the sections a brief needs and names no step
// the project's own text already holds: how a session reviews, gates and closes is CLAUDE.md's and the protocols',
// read by the session itself, never copied into a brief where it goes stale. The report section is not here either:
// `briefCopyOf` (./background.mjs) appends it to every brief `sessions start` copies.

/** The sections of a brief, in order, each with what it holds: the placeholder the template prints under it. */
const SECTIONS = [
  ['Do', 'the item the session carries out, as path:line of the roadmap or its feature document, and what it covers'],
  ['Done when', 'commands that exit 0, or the task contract of its feature document (js-harness contract goal on that document)'],
  ['Do not', 'each file another open session holds, with that session; what is held and until when (a review, a land)'],
  ['Budget', 'the estimate, with what it is measured on, and the stop line past which the session stops and tells the lead'],
];

/** The template of the brief of the session titled `title`, or of `<code> <n> · <purpose>` when none is given. */
export function briefTemplate(title) {
  const named = typeof title === 'string' && title.trim() !== '' ? title.trim() : '<code> <n> · <purpose>';
  const lines = [
    `# Brief — ${named}`,
    '',
    'From <the lead\'s title>, <local date and time>, for <who starts it>. The title\'s number from js-harness sessions --next-number;',
    'its own worktree, on a new branch from <the base: main\'s short sha, or the branch it stacks on> (sessions start --base <ref>).',
    'How it reviews, gates and closes is CLAUDE.md\'s and the protocols\': name here only what differs for this task.',
  ];
  for (const [heading, holds] of SECTIONS) lines.push('', `## ${heading}`, `<${holds}>`);
  return `${lines.join('\n')}\n`;
}
