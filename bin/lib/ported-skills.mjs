// The two skills ported from gentle-ai for Claude Code (F8 S10, G8; odd/tasks/f8-s10-port.md), each for the need
// the reverse-engineering document's section 3 names: every slice gets two reviews, so a slice must be one
// reviewable unit (`js-harness-work-units`), and two reviews cost limits by size, so a change over about 400 lines is
// split into chained slices (`js-harness-chained-prs`).
//
// Adapted from gentle-ai 4.2.0's `work-unit-commits` and `chained-pr` skills
// (<https://github.com/Gentleman-Programming/gentle-ai>), which declare `license: Apache-2.0`; the copies keep that
// line, and THIRD_PARTY_NOTICES.md carries the license's text and the repository's MIT notice. Our names, not
// theirs: under gentle-ai's names `install` would write over gentle-ai's own files in `~/.claude/skills` (L3).
// Kept: the rules, the checklist and the decision gates. Rewritten: the review and delivery steps name ours (Codex
// and the Claude lenses on every slice, the feature document, the merge queue). Dropped: gentle-ai's own delivery
// vocabulary (`delivery_strategy`, `review_budget_lines`, `size:exception` labels) and the reference file.

const NOTICE = (original) => `Adapted from gentle-ai's \`${original}\` skill (Apache-2.0; the js-harness package's THIRD_PARTY_NOTICES.md holds
its license). Changed: the review and delivery steps name js-harness's, and gentle-ai's own delivery vocabulary is
dropped.`;

/** The text of `js-harness-work-units`. */
export function workUnitsSkillContent() {
  return `---
name: js-harness-work-units
description: "Plan commits as reviewable work units. Use when deciding what goes in a commit or a slice, splitting a change, or keeping tests and docs with the code they cover."
license: Apache-2.0
---

${NOTICE('work-unit-commits')}

## When to use

When deciding what belongs in a commit or a slice: splitting a feature, preparing commits before a pull request,
turning a large change into chained slices (\`js-harness-chained-prs\`).

## Rules

| Rule | Requirement |
|------|-------------|
| Commit by work unit | A commit is one deliverable behavior, fix, migration or docs unit. |
| Not by file type | Never models, then services, then tests, when none of them works alone. |
| Tests with the code | A test goes in the commit of the behavior it proves, written first. |
| Docs with the change | Docs go with the change they explain. |
| Tell a story | A reviewer understands why each commit exists from its diff and its message. |
| Slice-ready | Each commit could become a slice of its own when the change grows. |
| No code golf | Never delete comments, blank lines, docs or tests, or compress code, to fit a size: slice by unit, or report the overage. |

## Before each commit

- [ ] One clear purpose.
- [ ] The repository still makes sense with only this commit applied.
- [ ] Its tests or docs are in it.
- [ ] It can be reverted without reverting unrelated work.
- [ ] The focused test command and its result are written in the feature document.
- [ ] A change that names a high-risk item is a commit of its own, so its review takes it alone.
- [ ] The message is a Conventional Commit that says why, not which files.

## Reviews

Every slice with code gets two reviews against the last reviewed boundary, never the whole branch:
\`js-harness codex-review --base <boundary>\` and \`js-harness lens-review --base <boundary> --lenses <pertinent>
--reason <why>\`. The feature document names each task's commit and each review's range. Slices of about 400 changed
lines keep both reviews within their limits.

## Commands

\`\`\`bash
git diff --stat
git diff --cached --stat
git log --oneline -5
\`\`\`
`;
}

/** The text of `js-harness-chained-prs`. */
export function chainedPrsSkillContent() {
  return `---
name: js-harness-chained-prs
description: "Split a change over about 400 changed lines into chained pull requests. Use for large or stacked pull requests, review slices, or when a slice outgrows its reviews."
license: Apache-2.0
---

${NOTICE('chained-pr')}

## When to use

When a planned pull request may pass **400 changed lines**, when the feature document's running count of a slice
passes about 400, or when chained or stacked pull requests are asked for.

## Rules

- Split a pull request over 400 changed lines, unless the user accepts it whole.
- The size shapes how work is sliced, never the code: never delete comments, blank lines, docs or tests, or
  compress or restyle code, to fit.
- One honest slicing pass. If no cohesive split brings every slice within the size, keep the best one and report
  its count and why it cannot shrink.
- One deliverable work unit a pull request (\`js-harness-work-units\`), with its tests and docs.
- Each pull request states its start, its end, what it depends on, what follows and what is out of its scope.
- Each child pull request shows the chain, marking itself with 📍.
- A diff that shows more than its own unit has the wrong base: retarget or rebase until only its unit shows.
- Never mix chain strategies once one is chosen.

## Decision gates

| Condition | Action |
|---|---|
| ≤ 400 changed lines and focused | One pull request. |
| > 400, each slice can land on its own | Stacked pull requests to main, landed in order by the merge queue. |
| > 400, the feature must integrate before main | A feature branch chain: a draft tracker pull request, the first child on the tracker's branch, each later child on its parent. |
| A generated, vendored or migration diff that cannot split | Ask the user to accept it whole. |

## Steps

1. Count the changed lines and name the independent units.
2. Choose the strategy, and write it with the slice boundaries in the feature document.
3. Open the branches and pull requests of that strategy only.
4. Give each slice its two reviews (Codex and the Claude lenses) before it is pushed.
5. Check each pull request alone: its tests, its rollback, a clean diff.
6. Keep a tracker a draft until every child is reviewed and landed.

## What to report

The strategy, the order, the current pull request's boundary, the chain with 📍, the size (additions plus
deletions), how each slice is checked, and why any slice is over the size.
`;
}
