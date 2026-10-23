// The citations of a pending change (C5 of odd/tasks/rule-hierarchy.md, built as T3 of
// odd/tasks/commands-and-doctor.md): a feature document that cites a `path:line` or a commit that does
// not exist sends its reader to nothing. Only the lines the change adds are read, and only code spans,
// since documents name other branches and removed files on purpose; the row that uses this is INFO
// until its count of false alarms has been zero for twenty commits.

// A repository path (no drive, no scheme) with a dot in its last part, then `:line` or `:line-line`.
const PATH_CITATION = /^((?:[\w.-]+\/)*[\w-][\w.-]*\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?$/;
// A short or full commit id: hexadecimal, 7 to 40 characters, with at least one digit and one letter
// so that neither a word nor a number is taken for one.
const COMMIT_CITATION = /^(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}$/;
// A session's transcript has a hexadecimal id too, and the documents name it "transcript `<id>`": no commit.
const TRANSCRIPT_BEFORE = /\btranscript\s*$/i;

/** The citations in one line of Markdown: each code span that is a path with a line (`kind: 'path'`, with `path`,
 * `line` and `end`, the last line of a range or the line itself) or a commit id (`kind: 'commit'`, with `id`). */
export function citationsIn(text) {
  const found = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const span = match[1];
    const path = PATH_CITATION.exec(span);
    if (path) {
      const line = Number(path[2]);
      found.push({ kind: 'path', text: span, path: path[1], line, end: path[3] === undefined ? line : Number(path[3]) });
    } else if (COMMIT_CITATION.test(span) && !TRANSCRIPT_BEFORE.test(text.slice(0, match.index))) {
      found.push({ kind: 'commit', text: span, id: span });
    }
  }
  return found;
}

/** The lines a unified diff with no context (`git diff -U0`) adds, as `{ file, line, text }`, `line` being the
 * line's number in the new file. A deleted file adds nothing. */
export function addedLines(diff) {
  const added = [];
  let file = null;
  let next = 0;
  // The new-file lines of the current hunk the header has not yet counted: while any remain, a `+` line is
  // added text, even one that starts with `+++ `.
  let left = 0;
  for (const line of diff.split(/\r?\n/)) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      next = Number(hunk[1]);
      left = hunk[2] === undefined ? 1 : Number(hunk[2]);
      continue;
    }
    if (line.startsWith('diff --git ')) left = 0;
    if (left === 0 && line.startsWith('+++ ')) {
      // Git ends the name of a path that holds a space with a tab.
      file = line === '+++ /dev/null' ? null : line.slice(4).replace(/\t$/, '').replace(/^b\//, '');
      continue;
    }
    if (file !== null && line.startsWith('+')) {
      added.push({ file, line: next, text: line.slice(1) });
      next += 1;
      if (left > 0) left -= 1;
    }
  }
  return added;
}

/** Resolves every citation of `added` (from `addedLines`): `lineCount(path)` is the number of lines of the file at
 * that repository path, or `null` when there is none; `commitExists(id)` says whether the repository has that
 * commit. Returns `{ checked, unresolved }`, each unresolved one as `{ file, line, citation, why }`. */
export function resolveCitations(added, { lineCount, commitExists }) {
  let checked = 0;
  const unresolved = [];
  for (const { file, line, text } of added) {
    for (const citation of citationsIn(text)) {
      checked += 1;
      let why = null;
      if (citation.kind === 'commit') {
        if (!commitExists(citation.id)) why = 'no such commit';
      } else {
        const count = lineCount(citation.path);
        if (count === null) why = 'no such file';
        else if (citation.line < 1 || citation.end < citation.line) why = 'no such line or range';
        else if (citation.end > count) why = `the file has ${count} lines`;
      }
      if (why !== null) unresolved.push({ file, line, citation: citation.text, why });
    }
  }
  return { checked, unresolved };
}

// A task line checked off, `- [x] T6 …`: its id is the first word after the box.
const CHECKED_TASK = /^\s*- \[x\] (T[\w.-]*\w)/;

/** The ids of the tasks `text`, a feature document, holds checked off. */
export function checkedTasks(text) {
  return new Set(text.split(/\r?\n/).map((line) => CHECKED_TASK.exec(line)?.[1]).filter(Boolean));
}

/** The tasks `added` (from `addedLines`) checks off, as `{ file, line, id }`: each added `- [x]` task line whose id
 * `before(file)`, the set of ids the file held checked off before the change (`checkedTasks`), lacks. A checked-off
 * line that is only reworded checks nothing off. */
export function checkedOff(added, before) {
  const ticks = [];
  for (const { file, line, text } of added) {
    const id = CHECKED_TASK.exec(text)?.[1];
    if (id !== undefined && !before(file).has(id)) ticks.push({ file, line, id });
  }
  return ticks;
}

/** The text of the task that starts at `line` (counted from 1) of `text`: that line and the lines indented deeper
 * that continue it, up to the next task line, so a nested task is read apart from its siblings (Codex, 2026-10-17). */
export function taskText(text, line) {
  const lines = text.split(/\r?\n/);
  const held = [lines[line - 1] ?? ''];
  const indent = /^\s*/.exec(held[0])[0].length;
  for (let next = line; next < lines.length; next += 1) {
    const one = lines[next];
    if (!/\S/.test(one) || /^\s*/.exec(one)[0].length <= indent || /^\s*- \[[ x]\] /.test(one)) break;
    held.push(one);
  }
  return held.join('\n');
}

/** Resolves each task `ticks` (from `checkedOff`) checks off (T6 of odd/tasks/commands-and-doctor.md): it names a
 * commit, and one commit it names is reachable from HEAD, since a feature branch checks its tasks off before it
 * merges. A task that names none passes only when `rides`, the change staging more than feature documents: it is
 * then checked off in the commit being made, which it cannot name. `text(file, line)` is the task's text
 * (`taskText`), `commitExists(id)` whether the repository has that commit, and `reaches(id)` whether HEAD reaches
 * it, `null` when git cannot say, which is no claim. Returns the unresolved ones as `{ file, line, id, citation,
 * why }`, `citation` being `null` when the task names no commit. */
export function resolveTicks(ticks, { text, commitExists, reaches, rides }) {
  const unresolved = [];
  for (const { file, line, id } of ticks) {
    const named = citationsIn(text(file, line)).filter((citation) => citation.kind === 'commit');
    if (named.length === 0) {
      if (!rides) unresolved.push({ file, line, id, citation: null, why: 'names no commit, and nothing but feature documents is staged' });
      continue;
    }
    const whys = named.map((citation) => {
      if (!commitExists(citation.id)) return 'no such commit';
      return reaches(citation.id) === false ? 'not reachable from HEAD' : null;
    });
    if (whys.includes(null)) continue;
    unresolved.push({ file, line, id, citation: named[0].text, why: whys[0] });
  }
  return unresolved;
}
