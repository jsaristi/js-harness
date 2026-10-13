// Pure markdown → step parsing shared by `bin/progress.mjs` — see odd/tasks/progress-view.md.
// No fs here: every function takes markdown text and returns data, so `bin/progress.test.mjs` and
// this file's own tests can use inline fixture strings instead of touching disk.

// A fence marker at any depth. How deep one may be is measured from what it is under (`tokenize`).
const FENCE_MARKER_PATTERN = /^\s*(`{3,}|~{3,})/;
// A list item's marker, a bullet or a number, with the spaces before its text.
const LIST_ITEM_PATTERN = /^(?:[-*+]|\d{1,9}[.)])( +|$)/;
// A thematic break, trimmed: three or more of one of its characters, spaces between them allowed.
// `* * *` and `- - -` look like a list item and are none.
const THEMATIC_BREAK_PATTERN = /^([-*_])(?:[ \t]*\1){2,}$/;
// A fence, and the item of a list, may sit this far in from what they are under, and no further.
const NEAR = 3;
const HEADING_PATTERN = /^ {0,3}(#{1,6})\s+(.*)$/;
const STEP_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/;

/** A line's fence marker, whether or not it is valid as an *opener*: its character (`` ` `` or
 * `~`) and length (3+), plus whatever follows it (the info string, for an opener; must be
 * whitespace-only, for a closer). Used by both `matchFenceOpen` and `isFenceClose` below. It
 * says nothing of how deep the marker is: its callers measure that. */
function matchFenceMarker(line) {
  const m = line.match(FENCE_MARKER_PATTERN);
  if (!m) return null;
  const marker = m[1];
  return { char: marker[0], length: marker.length, rest: line.slice(m[0].length) };
}

/** The column a line's text starts at: its leading spaces, a tab taken to the next stop of four. */
function indentOf(line) {
  let column = 0;
  for (const char of line) {
    if (char === ' ') column += 1;
    else if (char === '\t') column += 4 - (column % 4);
    else break;
  }
  return column;
}

/** The column the text of a list item starts at, when `line` opens one: its indent, its marker and
 * the spaces after it, which count as one when they are five or more or when nothing follows, as
 * CommonMark counts them. `null` for a line that opens no item, a thematic break among them. */
function itemTextColumn(line) {
  if (THEMATIC_BREAK_PATTERN.test(line.trim())) return null;
  const indent = indentOf(line);
  const item = line.trimStart().match(LIST_ITEM_PATTERN);
  if (!item) return null;
  const spaces = item[1].length;
  const rest = line.trimStart().slice(item[0].length);
  return indent + item[0].length - spaces + (spaces > 4 || rest.trim() === '' ? 1 : spaces);
}

/** A line that opens a fence. Per CommonMark, a backtick fence's info string must not itself
 * contain a backtick (R3-backtick-info-string) — otherwise inline code like `` ```inline``` text ``
 * would be misread as opening a code block instead of being read as ordinary text. A tilde fence's
 * info string has no such restriction, since a tilde fence can safely contain backticks inside it. */
function matchFenceOpen(line) {
  const marker = matchFenceMarker(line);
  if (!marker) return null;
  if (marker.char === '`' && marker.rest.includes('`')) return null;
  return marker;
}

/** CommonMark's closing rule: a fence closes only on a line whose marker is the *same character*
 * as the opener, *at least as long*, and followed by nothing but whitespace — R3-fence-mismatch
 * (Codex P2). A shorter marker, a different character (` ``` ` never closes `~~~`, and vice versa),
 * or trailing text after the marker is just more fenced content, not a closer. (The backtick/info
 * -string restriction above does not apply here: a closer's `rest` must already be blank.) The
 * closer is measured as the opener was: within three spaces of the column the fence is under
 * (`fence.under`), so a deeper marker is still content. A fence that opened deeper than that, which
 * only `indentedFences` allows, is closed by its marker at any depth (`fence.under` is `null`). */
function isFenceClose(line, fence) {
  const marker = matchFenceMarker(line);
  if (marker === null || marker.char !== fence.char || marker.length < fence.length || marker.rest.trim() !== '') return false;
  return fence.under === null || indentOf(line) <= fence.under + NEAR;
}

/** Index of the first backtick run of exactly `length` backticks in `line` at or after `from`, or -1. */
function findClosingRun(line, from, length) {
  let i = from;
  while (i < line.length) {
    if (line[i] !== '`') {
      i += 1;
      continue;
    }
    let end = i;
    while (line[end] === '`') end += 1;
    if (end - i === length) return i;
    i = end;
  }
  return -1;
}

/** `line` without its HTML comments: `{ text, inComment }`, where `inComment` says a comment is still
 * open at the end of the line (`open` says whether one was open at its start). An unterminated
 * comment runs to the end of the document. A `<!--` inside an inline code span (a backtick run with a
 * closing run of the same length on the line) is content, not a comment. */
function uncomment(line, open) {
  let text = '';
  let i = 0;
  let inComment = open;
  while (i < line.length) {
    if (inComment) {
      const end = line.indexOf('-->', i);
      if (end === -1) return { text, inComment: true };
      i = end + 3;
      inComment = false;
    } else if (line.startsWith('<!--', i)) {
      inComment = true;
      i += 4;
    } else if (line[i] === '`') {
      let runEnd = i;
      while (line[runEnd] === '`') runEnd += 1;
      const length = runEnd - i;
      const close = findClosingRun(line, runEnd, length);
      // A span is copied through its closer verbatim; an opener with no closer is plain backticks.
      const stop = close === -1 ? runEnd : close + length;
      text += line.slice(i, stop);
      i = stop;
    } else {
      text += line[i];
      i += 1;
    }
  }
  return { text, inComment };
}

/** Splits markdown into lines and tags each one as a fence toggle, a heading, a checkbox step, or
 * plain text — a single fence-aware pass every parser below builds on, so a heading or checkbox
 * that only appears inside a fenced example (or inside a *nested*, mismatched fence marker) is
 * never mistaken for a real one. An opener with no matching closer runs to end of file. Every token
 * keeps its `line`, so `bin/lib/contract.mjs` can rebuild a section's body from them. With
 * `stripComments`, HTML comments (also multi-line ones) are removed from every line outside a
 * fence before it is classified, so a commented-out heading or list item is never read; a `<!--`
 * inside a fence is fenced content, and a fence marker inside a comment is not a fence.
 *
 * A fence is measured from what it is under, as CommonMark measures it: its marker may sit up to
 * three spaces in from the margin or, under a list item, from the column that item's text starts
 * at. So a fence indented with the text of a list item is a fence, and a checkbox it shows is no
 * step. A line is under an item while it is indented at least to that column; a line that is not
 * blank and starts before it leaves the item. Two things are not followed: a paragraph's line that
 * goes on at the margin (a lazy continuation) leaves its item here, and a fence still open when
 * its item ends runs on until its marker. With `indentedFences`, a marker deeper than three spaces
 * of what it is under opens a fence too, where CommonMark reads indented code. */
export function tokenize(markdown, { stripComments = false, indentedFences = false } = {}) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const tokens = [];
  let fence = null; // { char, length, under } of the currently open fence, or null outside any fence
  let inComment = false;
  const items = []; // the text column of each list item the current line is under, outermost first
  /** The column a line indented `indent` is under: the innermost open item it reaches, or the margin. */
  const under = (indent) => items.findLast((column) => column <= indent) ?? 0;
  /** Leaves every open item whose text starts further in than `indent`. */
  const leave = (indent) => {
    while (items.length > 0 && items.at(-1) > indent) items.pop();
  };
  /** The fence `line` opens, with the column it is measured from; `null` when it opens none. */
  const opening = (line) => {
    const marker = matchFenceOpen(line);
    if (!marker) return null;
    const column = under(indentOf(line));
    const near = indentOf(line) - column <= NEAR;
    return near || indentedFences ? { char: marker.char, length: marker.length, under: near ? column : null } : null;
  };
  for (const original of lines) {
    let raw = original;
    // A line that opens a fence is fenced content from its marker on, so it is not uncommented: a
    // `<!--` after the marker must not leave a comment open once the fence closes.
    if (!fence && stripComments && (inComment || !opening(original))) {
      ({ text: raw, inComment } = uncomment(original, inComment));
    }
    if (fence) {
      if (isFenceClose(raw, fence)) fence = null;
      tokens.push({ fence: true, line: raw });
      continue;
    }
    const opened = opening(raw);
    if (opened) {
      // The opener leaves the items it is not under, as any line does: a fence at the margin ends the list.
      leave(indentOf(raw));
      fence = opened;
      tokens.push({ fence: true, line: raw });
      continue;
    }
    if (raw.trim() !== '') {
      // The line leaves every item whose text starts further in than it does, then may open its own.
      const indent = indentOf(raw);
      leave(indent);
      const column = itemTextColumn(raw);
      if (column !== null && indent - (items.at(-1) ?? 0) <= NEAR) items.push(column);
    }
    const heading = raw.match(HEADING_PATTERN);
    if (heading) {
      tokens.push({ heading: { level: heading[1].length, title: heading[2].trim() }, line: raw });
      continue;
    }
    const step = raw.match(STEP_PATTERN);
    if (step) {
      tokens.push({ step: { text: step[2].trim(), done: step[1].toLowerCase() === 'x' }, line: raw });
      continue;
    }
    tokens.push({ line: raw });
  }
  return tokens;
}

/** Every checkbox list item in `markdown`, in document order: `- [ ]`/`- [x]`/`- [X]`, also `*`/`+`
 * bullets, any leading indent. Lines inside a fenced code block are ignored, and `[ ]`-looking text
 * that does not start a list item is not a step. */
export function parseSteps(markdown) {
  return tokenize(markdown)
    .filter((token) => token.step)
    .map((token) => token.step);
}

/** The project roadmap's `## Checklist` section, grouped by phase. Only that section counts: it
 * starts at the `## Checklist` heading and ends at the next `## ` heading (or end of file). Each
 * step belongs to the nearest preceding `### <title>` heading inside the section; a `###` with no
 * steps still appears, at `0/0`. Checkboxes before the first `###` go under `(unassigned)`, but
 * only when at least one such checkbox exists. No `## Checklist` section at all yields no phases. */
export function parseRoadmap(markdown) {
  const phases = [];
  let inChecklist = false;
  let currentPhase = null;

  for (const token of tokenize(markdown)) {
    if (token.heading) {
      const { level, title } = token.heading;
      if (level === 2) {
        if (inChecklist) break; // the next `## ` heading ends the Checklist section
        if (title === 'Checklist') inChecklist = true;
        continue;
      }
      if (level === 3 && inChecklist) {
        currentPhase = { title, steps: [] };
        phases.push(currentPhase);
      }
      continue;
    }
    if (!inChecklist || !token.step) continue;
    if (!currentPhase) {
      currentPhase = { title: '(unassigned)', steps: [] };
      phases.push(currentPhase);
    }
    currentPhase.steps.push(token.step);
  }

  const summaries = phases.map(({ title, steps }) => ({
    title,
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    steps,
  }));
  return {
    phases: summaries,
    done: summaries.reduce((sum, p) => sum + p.done, 0),
    total: summaries.reduce((sum, p) => sum + p.total, 0),
  };
}

/** One feature doc: titled by its first level-1 `# ` heading (fallback: `id`), with every checkbox
 * in the file counted as a step — a feature doc has no sections like the roadmap's `## Checklist`,
 * so `## Tasks` and `## Progress` checkboxes (and anything else) all count. */
export function parseFeature(markdown, id) {
  const tokens = tokenize(markdown);
  const titleToken = tokens.find((token) => token.heading?.level === 1);
  const steps = tokens.filter((token) => token.step).map((token) => token.step);
  return {
    id,
    title: titleToken ? titleToken.heading.title : id,
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    steps,
  };
}
