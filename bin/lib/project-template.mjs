// The files that hold the harness's lines in a project, AGENTS.md and CLAUDE.md, and their marked block that `sync`
// renders again while it is unedited (odd/tasks/rule-hierarchy.md, T16f; odd/tasks/f8-s3-split.md, S3). The user's own
// `~/.claude/CLAUDE.md` holds one too, his Rules lines (./rules-block.mjs). The lines themselves stay with their
// callers, which pass them in.
import path from 'node:path';
import { sha256 } from './manifest.mjs';

/** The base `AGENTS.md` template `init` writes when a project has none of its own: short (this
 * file loads on every turn — see "T2 design"), titled with the project's own folder name. Placeholder
 * prompts are left in angle brackets for the project to fill in. The harness's lines, `body`, are in their marked block. */
export function agentsFile(root, body) {
  const name = path.basename(path.resolve(root));
  return `<!-- Written by \`js-harness init\`. This file loads on every turn: keep it short. -->
# ${name}

## What this project is
<what this project does, and who it is for, in one or two lines>

## How it works
<where the work lives: the code, the data, the documents>. The single command that checks a change:
\`<command>\`.

${markedBlock(body)}

## Constraints
- <a real constraint> — <the reason behind it>

A constraint the gate must hold gets an id in docs/rules.json (\`js-harness rules\`).
`;
}

/** The base `CLAUDE.md` template `init` writes beside the `AGENTS.md` it writes: the import of that file, which Claude
 * then loads once, and the harness's lines, `body`, in their marked block. A reviewer such as Codex reads `AGENTS.md`
 * alone (odd/tasks/f8-s3-split.md, S3: his answer D3). */
export function claudeFile(body) {
  return `<!-- Written by \`js-harness init\`. Claude loads this file and the AGENTS.md it imports on every turn: keep it short. -->
@AGENTS.md

${markedBlock(body)}
`;
}

/** The marks of each kind of block, so code that handles one never matches the other: `block`, the harness's lines of a
 * project's `AGENTS.md` or `CLAUDE.md`, and `rules`, his Rules lines in his own `~/.claude/CLAUDE.md` (the independent
 * verifier of T7, odd/tasks/f8-s10-port.md, L20). Each opening mark carries the hash of its lines: lines that no longer
 * match it were edited. */
const MARKS = {
  block: { word: 'block', says: 'sync renders the lines to the end mark again while they are unedited' },
  rules: { word: 'rules', says: 'js-harness install renders the lines to the end mark again while they are unedited, and uninstall takes them out' },
};
const endMark = (kind) => `<!-- js-harness ${MARKS[kind].word} end -->`;
const openMark = (kind) => new RegExp(`^<!-- js-harness ${MARKS[kind].word} ([0-9a-f]{12}): .*-->\\r?$`, 'm');
/** The mark that opens a project's block. */
export const TEMPLATE_BLOCK_MARK = openMark('block');
/** The hash a block's mark carries: of its lines with LF line ends, so a checkout with CRLF ones reads as unedited. */
const blockHash = (body) => sha256(body.replace(/\r\n/g, '\n')).slice(0, 12);
const templateBlockMark = (body, kind) => `<!-- js-harness ${MARKS[kind].word} ${blockHash(body)}: ${MARKS[kind].says} -->`;
/** `body`, lines that end with a line end, in the harness's marked block of `kind`: its mark, the lines, its end mark. */
export const markedBlock = (body, kind = 'block') => `${templateBlockMark(body, kind)}\n${body}${endMark(kind)}`;

/** Where the block of `kind` in `text` is, `{ start, from, to }`: its mark, its lines and its end mark; or its `state`,
 * `none` when there is no mark and `edited` when the lines no longer match the mark's hash or there is no end mark. */
function blockIn(text, kind) {
  const opened = openMark(kind).exec(text);
  if (opened === null) return { state: 'none' };
  const after = opened.index + opened[0].length;
  const from = after + (text.startsWith('\n', after) ? 1 : 0);
  const to = text.indexOf(endMark(kind), from);
  if (to === -1 || blockHash(text.slice(from, to)) !== opened[1]) return { state: 'edited' };
  return { start: opened.index, from, to };
}

/** `text`, an `AGENTS.md` or a `CLAUDE.md`, with the harness's block rendered as `body`, this version's lines for that
 * file: `{ text, state }`. The state
 * is `rendered` when the block's lines matched the hash of its mark and differed from this version's, `current` when
 * they are this version's already, `edited` when they no longer match their mark (or the block has no end mark), and
 * `none` when the file has no block. Every line outside the block is kept, and the file's line ends with them. */
export function renderBlock(text, body, kind = 'block') {
  const found = blockIn(text, kind);
  if (found.state) return { text, state: found.state };
  const { start, from, to } = found;
  if (text.slice(from, to).replace(/\r\n/g, '\n') === body) return { text, state: 'current' };
  const lineEnd = text.includes('\r\n') ? '\r\n' : '\n';
  const block = `${templateBlockMark(body, kind)}\n${body}`.replace(/\n/g, lineEnd);
  return { text: text.slice(0, start) + block + text.slice(to), state: 'rendered' };
}

/** `text` with the block of `kind` taken out, with the line end after its end mark: `{ text, state, at }`. The state is
 * `removed`, with `at` where the block began; or, with `text` as it was, `edited` or `none`, as `blockIn` says. */
export function removeBlock(text, kind = 'block') {
  const found = blockIn(text, kind);
  if (found.state) return { text, state: found.state };
  const end = found.to + endMark(kind).length;
  const tail = text.startsWith('\r\n', end) ? 2 : text.startsWith('\n', end) ? 1 : 0;
  return { text: text.slice(0, found.start) + text.slice(end + tail), state: 'removed', at: found.start };
}
