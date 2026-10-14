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

/** The citations in one line of Markdown: each code span that is a path with a line (`kind: 'path'`, with `path`,
 * `line` and `end`, the last line of a range or the line itself) or a commit id (`kind: 'commit'`, with `id`). */
export function citationsIn(text) {
  const found = [];
  for (const [, span] of text.matchAll(/`([^`\n]+)`/g)) {
    const path = PATH_CITATION.exec(span);
    if (path) {
      const line = Number(path[2]);
      found.push({ kind: 'path', text: span, path: path[1], line, end: path[3] === undefined ? line : Number(path[3]) });
    } else if (COMMIT_CITATION.test(span)) {
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
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? null : line.slice(4).replace(/^b\//, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      next = Number(hunk[1]);
      continue;
    }
    if (file !== null && line.startsWith('+')) {
      added.push({ file, line: next, text: line.slice(1) });
      next += 1;
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
