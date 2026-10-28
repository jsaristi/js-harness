// The Rules block of the user's own Claude file, `~/.claude/CLAUDE.md` (F8 S10, odd/tasks/f8-s10-port.md, T7): his
// answer to question 99 (G12) was that `install` writes his nine Rules lines there, as his answer D7 left them, in a
// small recorded block that `uninstall` undoes, and touches nothing else of `~/.claude`; so his other projects keep
// them once gentle-ai's global file is gone. It is the marked block of ./project-template.mjs: rendered again while it
// is unedited, and his once he edits it. The text around it is his or gentle-ai's and is never changed.
import fs from 'node:fs';
import path from 'node:path';
import { markedBlock, removeBlock, renderBlock } from './project-template.mjs';
import { recordWith, sameFile } from './permissions.mjs';

/** His nine Rules lines, word for word as his answer D7 left them. The root `CLAUDE.md` of this repo keeps the same
 * lines under "Kept from the global file", and a test holds the two together. */
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

/** The block's lines: a heading and the nine lines as a list. */
export const rulesBody = () => `## Rules\n${RULES_LINES.map((line) => `- ${line}`).join('\n')}\n`;

const rulesFile = (home) => path.join(home, '.claude', 'CLAUDE.md');

/** The texts install puts before the block; a record edited by hand to another one is read as none (the independent
 * verifier of T7, L20: a separator such as his own line would take that line out). */
const SEPARATORS = new Set(['', '\n', '\r\n', '\n\n', '\r\n\r\n']);
const separatorOf = (record) => (SEPARATORS.has(record?.separator) ? record.separator : '');

/** Writes `text` to `target` through a sibling renamed over it, so a write that fails partway leaves the file as it was
 * (the verifier, L20); the sibling is removed when the write or the rename fails. */
function writeWhole(target, text, writeFile = fs.writeFileSync) {
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    writeFile(tmp, text, 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

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
  let read;
  try {
    read = readText(target);
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
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeWhole(target, next);
  } catch (err) {
    return skipped(`not writable (${err.code ?? err.message})`);
  }
  const putBack = () => (existed ? fs.writeFileSync(target, text, 'utf8') : fs.rmSync(target, { force: true }));
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
  let read;
  try {
    read = readText(at);
  } catch (err) {
    return { status: 'failed', path: at, code: err.code ?? err.message };
  }
  const out = removeBlock(read.text, 'rules');
  if (!read.existed || out.state === 'none') return { status: 'gone', path: at };
  if (out.state === 'edited') return { status: 'edited', path: at };
  const rest = out.text.slice(out.at);
  const text = withoutSeparator(out.text.slice(0, out.at), rest, separatorOf(record)) + rest;
  try {
    if (record.createdFile === true && text === '') removeFile(at);
    else writeWhole(at, text, writeFile);
  } catch (err) {
    return { status: 'failed', path: at, code: err.code ?? 'unknown error' };
  }
  return { status: 'released', path: at };
}
