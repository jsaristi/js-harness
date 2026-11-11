// The Rules block of the user's own Claude file, `~/.claude/CLAUDE.md` (F8 S10, odd/tasks/f8-s10-port.md, T7): his
// answer to question 99 (G12) was that `install` writes his nine Rules lines there, as his answer D7 left them, in a
// small recorded block that `uninstall` undoes, and touches nothing else of `~/.claude`; so his other projects keep
// them once the global file that had them is gone. It is the marked block of ./project-template.mjs: rendered again while it
// is unedited, and his once he edits it. The text around it is his or the global file's and is never changed.
import fs from 'node:fs';
import path from 'node:path';
import { realPlace, writeWhole } from './atomic-write.mjs';
import { markedBlock, removeBlock, renderBlock } from './project-template.mjs';
import { recordWith, sameFile } from './permissions.mjs';

/** His nine Rules lines, word for word as his answer D7 left them. The root `CLAUDE.md` of this repo kept the same
 * lines under "Kept from the global file" until F8 S2's T9; a test holds them to the diet's Appendix A.1 where it
 * quotes them, and all nine by a hash. */
export const RULES_LINES = [
  'One question at a time; keep doing what does not depend on the answer.',
  'Verify a claim before building on it.',
  "Prefer the agent's native file-reading, search, and editing tools. When shell commands are necessary, use tools available on the current platform; do not require a specific package manager.",
  'Do not present option menus, exhaustive lists, or multiple approaches unless there is a real fork with meaningful tradeoffs.',
  'Never add "Co-Authored-By" or AI attribution to commits. Use conventional commits only.',
  'If user is wrong, explain WHY with evidence. If you were wrong, acknowledge with proof.',
  'Verify technical claims before stating them. If unsure, investigate first.',
  'Ask before destructive git operations, publishing, or irreversible file changes.',
  'Preserve human control: user decisions beat agent momentum.',
];

/** The rest of the diet's Appendix A.1 (docs/proposals/harness-diet.md), word for word as the root `CLAUDE.md` kept it
 * under "Kept from the global file" until F8 S2's T9, so every project keeps these lines once the old stack's blocks leave his global file
 * (F8 S2, T13: his answer to question 181). graphify's lines are left out, since graphify's own install writes them there, and so are the engram lines, since engram's protocol comes from engram alone (row 11, odd/tasks/f8-s11-complements.md). A
 * test holds the lines to A.1 where it quotes them and the grouping by a hash. The root `AGENTS.md` copies the High risk
 * line, since a Codex review reads that file and never his global one (odd/tasks/high-risk-list.md), and a test holds
 * that copy to this line. */
export const KEPT_GROUPS = [
  {
    title: "CodeGraph",
    lines: [
      "Create Git worktrees that may need CodeGraph under the user's home directory, preferably as a sibling such as `<repo-parent>/<repo-name>-worktrees/<worktree-name>`. Never place a CodeGraph-dependent worktree under `/tmp`, `/var/tmp`, or `/tmp/opencode`; generic temporary-work guidance does not override this rule.",
      "Every worktree needs its own `.codegraph/` index. Never copy, symlink, or reuse another checkout's index because its root and checked-out bytes may differ.",
      "Never run or recommend destructive or administrative lifecycle commands: `codegraph uninit`, `codegraph install`, `codegraph uninstall`, or `codegraph upgrade`. Reserve `codegraph index` for explicit index-corruption recovery, never routine use.",
    ],
  },
  {
    title: "Delegation",
    lines: [
      "Delegate through the runtime's subagent/delegation mechanism, when available, only when a Delegation Trigger's condition truly holds and names a reason: a map you need to decide or route, a writer reason (parallel units launched together, or the context backstop), or an independent verifier for a change that names a high-risk item.",
      "understanding that needs more evidence or more than approximately 5 sequential lookups requires one read-only explorer",
      "a small task's writes stay inline, even across files; delegate a writer only for a named reason: parallel units launched together (two or more independent units of behavior with disjoint edit surfaces, each needing several minutes of work: several files or roughly 100+ changed lines, because a subagent spends one to two minutes reading before it writes) or the context backstop.",
      "only a change that names a Task Size high-risk item gets an independent verifier after the change's own checks, as rarely as possible",
      "derive the allowed edit surface from the task being delegated — the files the planned change must touch, plus the directories where the task authorizes new files — and pass it in the delegated prompt under an `## Allowed edit surfaces` heading",
      "When delegating to a generic exploration, writer, or verification worker, include the same `## Key Learnings` closing instruction in the delegated prompt: after the worker returns its normal result envelope or handoff, it closes its final response text with a `## Key Learnings` block of 1–5 numbered items, each a standalone factual sentence of at least 20 characters and at least 4 words, omitting the block when there is genuinely no reusable learning.",
    ],
  },
  {
    title: "Task Size and scratch",
    lines: [
      "**High risk**: a mistake would be hard to detect, hard to undo, or reaches beyond the change. It touches (1) data or irreversible effects: migrations, changing or deleting existing stored data, persisted format changes (not saving new records); (2) security: auth, permissions, credentials, secrets, guards, sandbox; (3) contracts others consume: changing or removing public API, CLI flags, config formats, published exports, or mirrored prompts or contracts others already consume (not adding a flag, command, or optional field; requested changes are not high risk by themselves; unrequested breaks in shared code are); (4) concurrency: locks, races, async ordering; (5) delivery or environment: installers, release, CI, deploy, dependencies; (6) no test would catch a regression in what changes.",
      "Keep test scratch state (temporary directories, `HOME`, `TMPDIR`, tool caches) outside the worktree in a `mktemp -d` directory; when it must live inside the worktree, use a path git excludes and remove it before finishing, so no tool cache or scratch path remains in the change.",
    ],
  },
  {
    title: "Remote operation authorization",
    lines: [
      "Permission to develop locally does not authorize remote execution or file transfer. Before remote work, require explicit user authorization for the destination, operation, and credential/session to use. If any part is missing or ambiguous, ask and remain local; do not probe the destination to resolve the ambiguity.",
      "Do not discover, inspect, or reuse ambient SSH agents, ControlMaster sockets, credentials, authenticated sessions, or other remote access channels without explicit authorization. Their availability is not permission to use them.",
      "Explicitly authorized remote work is allowed within that scope. Preserve stricter user instructions and runtime restrictions; do not weaken them or change approval settings to proceed.",
    ],
  },
];

/** The block's lines: a heading and the nine lines as a list. */
export const rulesBody = () => `## Rules\n${RULES_LINES.map((line) => `- ${line}`).join('\n')}\n${KEPT_GROUPS.map(({ title, lines }) => `\n${title}:\n${lines.map((line) => `- ${line}`).join('\n')}\n`).join('')}`;

const rulesFile = (home) => path.join(home, '.claude', 'CLAUDE.md');

/** The texts install puts before the block; a record edited by hand to another one is read as none (the independent
 * verifier of T7, L20: a separator such as his own line would take that line out). */
const SEPARATORS = new Set(['', '\n', '\r\n', '\n\n', '\r\n\r\n']);
const separatorOf = (record) => (SEPARATORS.has(record?.separator) ? record.separator : '');

/** `before`, the text a removed block followed, without the line ends install put there: at most as many as
 * `separator` holds, either kind, and never the last one when `rest`, text after the block, follows, so no two of his
 * lines are joined (the verifier, L20). */
function withoutSeparator(before, rest, separator) {
  let left = (separator.match(/\n/g) ?? []).length;
  if (rest !== '') left = Math.min(left, (before.match(/(?:\r?\n)+$/)?.[0].match(/\n/g) ?? []).length - 1);
  let text = before;
  for (; left > 0; left -= 1) {
    const end = text.match(/\r?\n$/);
    if (!end) break;
    text = text.slice(0, -end[0].length);
  }
  return text;
}

/** The text of `file` and whether it was there; a file that is not there reads as empty, any other error throws. */
function readText(file) {
  try {
    return { text: fs.readFileSync(file, 'utf8'), existed: true };
  } catch (err) {
    if (err.code === 'ENOENT') return { text: '', existed: false };
    throw err;
  }
}

/** Puts the Rules block in the user's `CLAUDE.md` under `home`: at its end when it has none, with a line end before it
 * when the text does not end with one and a blank line otherwise (none in an empty file); its lines again when it holds
 * an unedited block of other lines. Returns `{ held, record, keep }`: `held` is `{ status, path }`, `written`,
 * `updated`, `already`, `edited` (a block whose lines he changed, left as they are), or `skipped` with a `reason` (a
 * file that cannot be read or written), and then nothing is written. `record`, what `uninstall` undoes, is
 * `{ path, createdFile, separator }`, the text put before the block; `previous`'s when this writes no new block, and
 * none for an edited block nothing recorded. `keep(write)` runs the caller's write of the manifest, and puts the file
 * back when it throws. */
export function holdRulesBlock(home, previous) {
  const target = rulesFile(home);
  const skipped = (reason) => ({ held: { status: 'skipped', path: target, reason }, record: previous ?? null, keep: recordWith(null) });
  let place;
  let read;
  try {
    place = realPlace(target);
    read = readText(place);
  } catch (err) {
    return skipped(`not readable (${err.code ?? err.message})`);
  }
  const { text, existed } = read;
  const body = rulesBody();
  const rendered = renderBlock(text, body, 'rules');
  const record = { path: target, createdFile: previous?.createdFile === true || !existed, separator: separatorOf(previous) };
  if (rendered.state === 'current') return { held: { status: 'already', path: target }, record, keep: recordWith(null) };
  if (rendered.state === 'edited') return { held: { status: 'edited', path: target }, record: previous ?? null, keep: recordWith(null) };
  let next = rendered.text;
  if (rendered.state === 'none') {
    const lineEnd = text.includes('\r\n') ? '\r\n' : '\n';
    record.separator = text === '' ? '' : text.endsWith('\n') ? lineEnd : lineEnd + lineEnd;
    next = `${text}${record.separator}${`${markedBlock(body, 'rules')}\n`.replace(/\n/g, lineEnd)}`;
  }
  try {
    fs.mkdirSync(path.dirname(place), { recursive: true });
    writeWhole(place, next);
  } catch (err) {
    return skipped(`not writable (${err.code ?? err.message})`);
  }
  const putBack = () => (existed ? writeWhole(place, text) : fs.rmSync(place, { force: true }));
  const status = rendered.state === 'none' ? 'written' : 'updated';
  return { held: { status, path: target }, record, keep: recordWith(putBack) };
}

/** Takes out of the user's `CLAUDE.md` what `record` says `install` wrote: the block and the text it put before it,
 * and the file when install made it and nothing else is left. Returns `{ status, path }`: `released`; `gone` when
 * there is no block or no file; `edited` when its lines were changed, left as his; `kept` with a `reason` when the
 * record names another file than the one under `home`, left as it is; `failed` with a `code` when the file cannot be
 * read or written, and then the caller keeps the record for a run again. */
export function releaseRulesBlock(record, home, { writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  const at = rulesFile(home);
  if (!sameFile(record.path, at)) return { status: 'kept', path: String(record.path), reason: "the record names another file than the user's CLAUDE.md" };
  let place;
  let read;
  try {
    place = realPlace(at);
    read = readText(place);
  } catch (err) {
    return { status: 'failed', path: at, code: err.code ?? err.message };
  }
  const out = removeBlock(read.text, 'rules');
  if (!read.existed || out.state === 'none') return { status: 'gone', path: at };
  if (out.state === 'edited') return { status: 'edited', path: at };
  const rest = out.text.slice(out.at);
  const text = withoutSeparator(out.text.slice(0, out.at), rest, separatorOf(record)) + rest;
  try {
    // A file install made goes once empty, but never a link he put there since: the file it names keeps his text.
    if (record.createdFile === true && text === '' && place === at) removeFile(at);
    else writeWhole(place, text, writeFile);
  } catch (err) {
    return { status: 'failed', path: at, code: err.code ?? 'unknown error' };
  }
  return { status: 'released', path: at };
}
