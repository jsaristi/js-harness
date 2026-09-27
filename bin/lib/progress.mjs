// Pure markdown → step parsing shared by `bin/progress.mjs` — see odd/tasks/progress-view.md.
// No fs here: every function takes markdown text and returns data, so `bin/progress.test.mjs` and
// this file's own tests can use inline fixture strings instead of touching disk.

const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;
const HEADING_PATTERN = /^ {0,3}(#{1,6})\s+(.*)$/;
const STEP_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/;

/** Splits markdown into lines and tags each one as a fence toggle, a heading, a checkbox step, or
 * plain text — a single fence-aware pass every parser below builds on, so a heading or checkbox
 * that only appears inside a fenced example is never mistaken for a real one. */
function tokenize(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const tokens = [];
  let inFence = false;
  for (const raw of lines) {
    if (FENCE_PATTERN.test(raw)) {
      inFence = !inFence;
      tokens.push({ fence: true });
      continue;
    }
    if (inFence) {
      tokens.push({});
      continue;
    }
    const heading = raw.match(HEADING_PATTERN);
    if (heading) {
      tokens.push({ heading: { level: heading[1].length, title: heading[2].trim() } });
      continue;
    }
    const step = raw.match(STEP_PATTERN);
    if (step) {
      tokens.push({ step: { text: step[2].trim(), done: step[1].toLowerCase() === 'x' } });
      continue;
    }
    tokens.push({});
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
