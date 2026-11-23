# resume-legacy-shorten

Locator: `odd/tasks/resume-legacy-shorten.md` · Branch: none yet (written on `claude/jh301-next-unit-docs`, documents
only) · Session: JH 301, unit 3 of the lead's brief `brief-301-plans-ready.md` · Test runner: `node --test`

## State
Written 2026-11-22 by JH 301, documents only, nothing built. Next: the lead puts the roadmap line "Shorter resume
sections" to him once (it says "it waits for him"); on a yes, T1. Open: nothing else.

## Goal
The three feature documents on `RESUME_LEGACY` bring their resume head under the 5,000-token bound by moving history,
never deleting it, and the list in `bin/lib/read-surface.mjs` ends empty.

## Why
A resumed session reads a document's resume sections whole, and nothing bounded them until F8's S6 added the `read
surface` row of `check`. Three documents were over the bound when the row arrived and sit on a legacy list that only
shrinks (`bin/lib/read-surface.mjs:24-27`). Each still costs a session that resumes it three to four and a half times
the bound. The roadmap's Later list holds the entry, "Not tracked yet; it waits for him" (`docs/ROADMAP.md`, "Shorter
resume sections in feature documents").

## Done when
- `node --test bin/lib/read-surface.test.mjs` exits 0
- `npm run check` exits 0
- `RESUME_LEGACY` in `bin/lib/read-surface.mjs` is `[]`, and the `read surface` row names no legacy document
- every line moved out of a resume section is still in the same document, under a history title, word for word
  (`git diff --stat` shows each document's line count unchanged or grown by its new headings only)

## In scope / Out of scope
- In: `odd/tasks/one-model-home.md`, `odd/tasks/rule-hierarchy.md`, `odd/tasks/session-channel.md`;
  `RESUME_LEGACY` and its test.
- Out: the bound itself (5,000, `STATE_HEAD_BUDGET`, the plan's frozen figure); `featureParts`' title pattern; any
  other document; deleting history, because the history is the record the documents exist to keep.

## Constraints
- History moves under a title the resume pattern does not match (`bin/lib/feature-parts.mjs:8-11`): `## Next step,
  history` or `## Progress, history`. A title such as `## Next step (history)` would still match — because the
  pattern takes a parenthesis after a resume title.
- Each document keeps a short head that a session can resume from: what is done, what is next, what is open.
- One document a commit, so each move is reviewed on its own and undone by one revert.

## Ask me before
Whether to take it now: the roadmap line names him. Nothing else here is his.

## Depth pass
- 1. Method: a resume head is a working memory, not an archive; the standard (the contract template's `## State`,
  "rewritten at each step and never appended to; history goes to the Log") is a few lines rewritten in place, with
  history kept below. The smallest change is a move under a non-resume title, not a rewrite.
- 2. Raw material:
  - `bin/lib/read-surface.mjs:17-27`: `STATE_HEAD_BUDGET = 5000`, `RESUME_LEGACY` = the three names.
  - `bin/lib/read-surface.mjs:56-59`, `resumeHead`: the sum of every section `featureParts` keeps.
  - `bin/lib/feature-parts.mjs:11`: `RESUME_TITLE = /^(?:state|next step|next|state for a resume|resume here)(?:\s*\(.*\)|\s*:.*)?$/i`.
  - Resume titles today: `one-model-home.md:361` `## Next step`; `rule-hierarchy.md:4609` `## Next step`;
    `session-channel.md:3217` `## State for a resume` and `:3467` `## Next step`.
  - `docs/ROADMAP.md`, Later, "Shorter resume sections": 381 lines in `rule-hierarchy.md` and 1,036 in
    `session-channel.md` at `64933f6`, and "Not tracked yet; it waits for him".
- 3. The bar:
  spec 1: `node -e "import('./bin/lib/read-surface.mjs').then(m => ...resumeHead(text) per legacy file)"`: 16,604,
  7,977 and 22,989 today; the bar is each under 5,000 and `RESUME_LEGACY` empty.
- 4. Refutation: if moving text under a history title did not take it out of the head, the move would need a code
  change. Run 2026-11-22: `resumeHead('## State\nshort\n\n## Next step, history\n' + 'x'.repeat(40000))` gives 4,
  and the same text under `## Next step` gives 10,004 (node over `bin/lib/read-surface.mjs`, `origin/main`
  `6d6a5d85`). The three heads, by the same function: one-model-home 16,604, rule-hierarchy 7,977, session-channel
  22,989.
  Verdict: supports
- 5. Request: in each of the three documents, keep a resume head under 5,000 estimated tokens and move the rest, word
  for word, under a history title; then empty `RESUME_LEGACY` in the same last commit, its test kept green.
  Adds: none

## Specs
1. The roadmap entry, as written there (`docs/ROADMAP.md`, Later): "Shorter resume sections in feature documents.
   The "Next step" and "State for a resume" sections have grown into history".

## Tasks
- [ ] T1 (kind: docs) `one-model-home.md`: a head under 5,000, the rest under `## Next step, history`; its name leaves
  `RESUME_LEGACY` in the same commit — spec 1; inline; one commit
- [ ] T2 (kind: docs) `rule-hierarchy.md`, as T1 — spec 1; inline; one commit
- [ ] T3 (kind: docs) `session-channel.md`, both resume sections, as T1; `RESUME_LEGACY` ends `[]` — spec 1; inline;
  one commit

## Log
- L1 (2026-11-22, JH 301, the lead's brief as written): "The next roadmap units (`js-harness progress`,
  `docs/ROADMAP.md`): for the next 2-3 units with no feature document yet, write `odd/tasks/<feature>.md` with its
  task contract and `## Depth pass` ... docs only, so Codex day starts with builds ready."
- L2: the roadmap is left untouched here because open PRs 888, 934 and 935 edit `docs/ROADMAP.md`; the lead links
  this document from the Later line when it lands.
