// Pure markdown → step parsing shared by `bin/progress.mjs` — see odd/tasks/progress-view.md.
// No fs here: every function takes markdown text and returns data, so `bin/progress.test.mjs` and
// this file's own tests can use inline fixture strings instead of touching disk.

const FENCE_OPEN_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const HEADING_PATTERN = /^ {0,3}(#{1,6})\s+(.*)$/;
const STEP_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/;

/** A line's fence marker, whether or not it is valid as an *opener*: its character (`` ` `` or
 * `~`) and length (3+), plus whatever follows it (the info string, for an opener; must be
 * whitespace-only, for a closer). Used by both `matchFenceOpen` and `isFenceClose` below. */
function matchFenceMarker(line) {
  const m = line.match(FENCE_OPEN_PATTERN);
  if (!m) return null;
  const marker = m[1];
  return { char: marker[0], length: marker.length, rest: line.slice(m[0].length) };
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
 * -string restriction above does not apply here: a closer's `rest` must already be blank.) */
function isFenceClose(line, fence) {
  const marker = matchFenceMarker(line);
  return (
    marker !== null && marker.char === fence.char && marker.length >= fence.length && marker.rest.trim() === ''
  );
}

/** Splits markdown into lines and tags each one as a fence toggle, a heading, a checkbox step, or
 * plain text — a single fence-aware pass every parser below builds on, so a heading or checkbox
 * that only appears inside a fenced example (or inside a *nested*, mismatched fence marker) is
 * never mistaken for a real one. An opener with no matching closer runs to end of file. Every token
 * keeps its raw `line`, so `bin/lib/contract.mjs` can rebuild a section's body from them. */
export function tokenize(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const tokens = [];
  let fence = null; // { char, length } of the currently open fence, or null outside any fence
  for (const raw of lines) {
    if (fence) {
      if (isFenceClose(raw, fence)) fence = null;
      tokens.push({ fence: true, line: raw });
      continue;
    }
    const opened = matchFenceOpen(raw);
    if (opened) {
      fence = opened;
      tokens.push({ fence: true, line: raw });
      continue;
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
