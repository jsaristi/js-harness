# Resume reads the open task

Locator: `odd/tasks/resume-open-task.md` · Engram mirror: `odd/resume-open-task/tasks` · Branch:
`feat/resume-open-task` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal

A session resumed after a compaction is pointed at the task it was working on and at the exact lines of its feature document that this task needs.

## Why

Throughput item 5 of the roadmap ("Next"). It comes from his word of 2026-10-16: optimize without trading quality or reliability (L1).

The `js-harness resume` hook names the feature document and says "Read \"Next step\" in that document, and \"State for a resume\" if it has one" (`bin/resume.mjs:389`, `:853`, `:870`). The session then searches the file for those headings, because the hook gives no lines.

The two open features that sessions resume most are large. Both figures are read at 64933f6 with `git show`, so LF bytes:

| Document | Lines | Size |
|---|---|---|
| `rule-hierarchy.md` | 4,555 | 349 KiB |
| `session-channel.md` | 4,070 | 333 KiB |

Neither fits one Read call, which takes 2,000 lines by default. The two readers measured two more things:

- The resume sections themselves have grown into history:
  - `rule-hierarchy.md`: `## Next step` is lines 4175-4555, 381 lines.
  - `session-channel.md`: `## State for a resume` is lines 3035-3284 (250 lines), and `## Next step` is lines 3285-4070 (786 lines).
- The task the hook's mode line names, the first unchecked task in the document, is stale in both:
  - `rule-hierarchy.md`: the line names T1 (line 2587, built but never checked), while its Next step works on T16f.
  - `session-channel.md`: the line names T2 (line 1653), while its Next step starts with T6b.

So a resumed session today finds its sections by search, reads up to about 1,000 lines of them, and is told the wrong task.

## Done when

- `node --test bin/lib/feature-parts.test.mjs` exits 0
- `node --test bin/resume.test.mjs` exits 0
- `npm run check` exits 0
- On a fixture shaped like `session-channel.md`, where the first unchecked task is not the one its Next step names first, the hook names the Next step's task and the line ranges of its parts, each range with its line count.

## In scope / Out of scope

- In:
  - `bin/resume.mjs`;
  - `tasksOf` in `bin/lib/contract.mjs`, which gains the line of each task;
  - a new `bin/lib/feature-parts.mjs`;
  - their tests;
  - `docs/SPEC.md` (the resume capability) and the README where it quotes the hook's lines;
  - this document and item 5's row in `docs/ROADMAP.md`.
- Out:
  - Part B, closed log entries moved to a sibling file. It is measured below, recommended against, and the lead decides (T1b). It is not built unless the lead says so.
  - Making the resume sections shorter. Those sections are the largest cost, but bounding them would be a new requirement. Under the freeze it goes to "Later" in the roadmap, with its source.
  - The format of feature documents. The parser reads the shapes the 59 documents already use.

## Constraints

- The hook keeps its 9 s deadline (`HOOK_DEADLINE`) — because it runs at the start of a turn. It reads the document once: the read that the mode line makes today (`bin/resume.mjs:901`) moves before the feature-document line. Parsing is pure and calls no git.
- `TRUST` (`bin/resume.mjs:389`) stays as it is for the folders path (`:863`) and the several-documents path (`:873`) — because those paths name no single document. Only the two one-document paths (`:853`, `:870`) use the new lines.
- When a document gives no part, the one-document line stays as it is today, word for word.
- Line numbers are 1-based and inclusive, as the Read tool's `offset` takes them. A range a-b is read with `offset=a, limit=b-a+1`, or with `sed -n 'a,bp'` on Codex.

## Ask me before

- Nothing in this build is his. Part B is the lead's call (T1b), and he carries it to Sebastián if it reaches him.

## Specs

- S1. The lead's order, verbatim (notice of 2026-10-16 16:30): "Start throughput item 5 now (resume
  reads the open task; closed Log sections to a sibling file), design first with two readers; the
  table is in docs/ROADMAP.md 'Next'."
- S2. Item 5's row of the roadmap, verbatim: "Resume reads the open task, and closed Log sections
  move to a sibling file", with the baseline "`session-channel.md` 345 KB, `rule-hierarchy.md` 306 KB".
- S3. `tasksOf` gives each task its `start` and `end`: the 1-based lines of its list item, wrapped lines included. Everything else about it stays as it is. It still skips fences, strips HTML comments, and reads indented items and documents with no `## Tasks` heading.
- S4. `featureParts(markdown)` returns `{ lines, sections, task, specs, entries }`:
  - **`lines`**: the number of the last line, the one `wc -l` and the Read tool end on.
  - **`sections`**: the resume sections, one `{ title, start, end }` per section, kept in document order. Each one ends before the next `## ` heading or at the last line.
    - A resume section is a `## ` heading whose text is `Next step`, `Next`, `State for a resume` or `Resume here`, matched ignoring case.
    - The text may be followed by nothing, by ` (…)` or by `:`.
    - `## Next step, earlier` and `## Next step, history` are left out: they are history, not the next step.
  - **`task`**: the task the session works on, `{ id, start, end }`, or `null`.
    - It is the open task (by `tasksOf`) that the first resume section names first, as a whole word.
    - Without one, it is the first open task.
  - **`specs`**: the `S<n>` items that the task's list item names, each `{ id, start, end }`.
    - They are read under the first `## Specs` heading.
    - An item starts at a line at column 0 that opens with `- S<n>`, `- **S<n>**` or `S<n>.`, and ends before the next such line or the next heading.
  - **`entries`**: the entries of the first `## Log` or `## Progress` section that name the task's id as a whole word, the last five at most, each `{ start, end }`.
    - An entry starts at a column-0 line that opens with `- ` or `L<n>`.

  Known limits, accepted:

  - An id of another document that is written the same way (`exact-tests T3`) counts as a hit.
  - A range written in words (`T3a to T3c`) names only its two ends.
  - `T16` does not find `T16f`.
- S5. The mode line (`Mode of the next open task: …`) names the same task as `featureParts`. When the document gives no task, it keeps today's choice, the first task not done.
- S6. On the two one-document paths, the line after `Feature document: …` is replaced by these lines, in this order:

  ```text
  Read these parts of it (<lines> lines in all), not the whole file:
    "<title>": lines a-b (n lines)
    the task <id>: lines a-b (n lines)
    its specs <S1, S3>: lines a-b, c-d (n lines)
    its last log entries: lines a-b, c-d (n lines)
  Trust them over the summary. Then repeat to the user any question that is still open.
  ```

  - There is one `"<title>"` line for each resume section.
  - A part that is not found has no line.
  - A range of one line is written `line a (1 line)`.
  - When no part is found, the line stays as it is today.
- S7. The hook's other lines, its order and its deadline do not change.

## Design

Version 2. Version 1 was read by two readers that did not write it (Opus at high effort, read-only). What they changed, the readers named A and B:

- Both: the estimate of "about 30 to 300 lines" was false. The resume sections alone are 381 and 1,036 lines, so every range now carries its line count (S6).
- B: the baseline was wrong. The hook already names "Next step" and "State for a resume", so a resumed session does not read the whole file; "about 90k tokens" holds only for a whole read. "Why" now says what a session faces today.
- B: wrong figures fixed: `session-channel.md` has 4,070 lines, not 3,300, and all sizes are now LF KiB from `git show`.
- A: the first unchecked task is stale in both target documents (T1 and T2, while the work is on T16f and T6b). The task is now the one the Next step names (S4), and the mode line follows it (S5).
- A: the parser reuses `tasksOf`, which gains the line of each task, so the two cannot drift (S3).
- A: titles are matched by prefix, since `## Resume here (…)` and `## Next step (2026-10-16)` exist.
- A: specs and entries that are paragraphs at column 0 are accepted (`future-model-protocol.md` writes `S1.` and `L1 (`).
- A: `TRUST` stays for the paths with no single document.
- A: the eleven tests built on the `READ` line are updated by T3 (`bin/resume.test.mjs:24`, its default fixture at `:33`).
- A, B: the "Done when" example on `first-version.md` was invented. That document has no Next step, is 325 lines long, and T6 is at line 174. The check is now a fixture shaped like the case it exists for.
- B: Part B is no longer marked "Out" as if it were decided; it is the lead's (T1b). Its figures are corrected below.

### Part A: the hook points at the task and its lines (built)

- `tasksOf` keeps the index of the token it reads. `tokenize` gives one token per line (`bin/lib/progress.mjs:144`), so its index plus one is the line. The end of a task is the last line before the next line that is not indented under the item.
- `featureParts` lives in `bin/lib/feature-parts.mjs` and takes its tasks from `tasksOf`.
- `resume.mjs` reads the document once and passes the text to `featureParts` and to the mode line.

Cost and return:

- Cost (estimate): about 150 lines of parser and tests, 40 lines in `resume.mjs`, and the eleven resume test expectations; one gate and one Codex review.
- Return (estimate):
  - It saves the search for the headings.
  - It names the right task where the mode line names a stale one today.
  - It shows the session each range's size before it reads, so that it can read the Next step's start first.
  - It does not make the 381- and 1,036-line sections smaller.

### Part B: closed log entries in a sibling file (measured, the lead's call)

Measured at 64933f6, LF bytes. An entry is closed when every task id it names is checked done, and `L1`, his request, always stays. Both documents keep their history under `## Progress`, as dated bullets.

| Document | Size | History section | Closed entries | Entries naming no task | Open tasks |
|---|---|---|---|---|---|
| `rule-hierarchy.md` | 349 KiB | 116 KiB | 54 KiB | — | 13 |
| `session-channel.md` | 333 KiB | 102 KiB | 37 KiB | 38 KiB (37 entries) | 3 |

Most of each document is its `## Design`, 166 KiB and 112 KiB.

What it would return:

- Workers are told to read up to `## Log` and resumed sessions get named ranges, so B saves them nothing.
- It saves about 37 to 54 KiB per whole-document read by a verifier or a design reader of these two documents, about 9k to 14k tokens (estimate). The gentle-ai rules hand verifiers the whole document, and verifiers run only for high-risk items.

What it would cost:

- **gentle-ai's rule.** "Keep one feature document, not a separate plan file or topic", with "the growing log last" and an Engram mirror of "the full current document" (`~/.claude/CLAUDE.md`, ODD).
- **Readers that would take a sibling `odd/tasks/x.log.md` as a feature document.**
  - Code that picks it up:
    - `progress` (`bin/progress.mjs:175`);
    - `sessions` (`bin/lib/sessions.mjs:907`), which would count two documents;
    - `resume` (`bin/resume.mjs:253`), which would point a session that last wrote the log at it.
  - The `rules` scan would read a whole file with no history heading as "in force" (`bin/lib/rules-scan.mjs:10-11`, `:32`).
  - `contract` skips the file because it has no `## Goal`.
  - A folder outside `odd/tasks`, such as `odd/log/`, avoids all of these readers.
- **Citations into the moved part.** Of the 243 `odd/tasks/<doc>.md:<line>` citations at 64933f6 (112 in `docs/sweep-2026-10-11.md`, 75 in `docs/FAILURES.md`), 119 point at or after the history heading and would shift. Citations already drift when a document grows above them, and the `citations` row checks only the lines a change adds.

Recommendation: do not build B. Its return is about 9k to 14k tokens on a read that happens only on high-risk work, and it goes against gentle-ai's one-document rule. If the lead wants it anyway, the cheaper form is `odd/log/<doc>.md` for the two open documents only, with the citations accepted as they are.

## Tasks

- [x] T1 (kind: design) This design, read by two readers that did not write it; version 2 says what they changed (S1, S2)
- [ ] T1b (kind: design) The lead's answer on Part B, recorded in the Log (S1, S2)
- [x] T2 (kind: build) `tasksOf` gives each task its lines, and `featureParts`, test first (S3, S4)
- [ ] T3 (kind: build) The hook names the task and its parts, and the mode line follows it, test first; the resume tests updated; SPEC and README (S5, S6, S7)
- [ ] T4 (kind: verify) Gate, gentle-ai, Codex review, PR ready, the lead told (S1)

## Log

- L1 — The lead's notice of 2026-10-16 16:30, quoted verbatim in S1. It carries Sebastián's word of 2026-10-16 on throughput, quoted in `docs/ROADMAP.md` "Next".
- L2 — 2026-10-16, design version 1. It rested on a read-only map of every reader of feature documents (Explore sub-agent, Opus at high effort) and on a measure of the history sections. One spot check: `modeLines` returns the mode text, not a line number (`bin/contract.mjs:332`).
- L3 — 2026-10-16, two readers (Opus at high effort) read version 1. Reader A checked whether it fits the code; reader B weighed its return against its cost. They found:
  - two blockers: the invented example, and the false estimate of 30 to 300 lines;
  - about a dozen should-fix findings.
  
  Version 2 takes them all, as "Design" lists. Reader B's call against Part B stands, on corrected figures. The question on B went to the lead (T1b).

- L4 — 2026-10-16, T2 built, test first. RED: the `tasksOf` expectation got `start` and `end` as
  `undefined`, and `feature-parts.test.mjs` could not import its module. GREEN: both files pass. S4 now
  says "names first", meaning the order of mention, because a Next step that also names a stale task
  later must not pick it. On the real documents at 64933f6:

  | Document | Task picked | Today's mode line | Named lines | Document lines |
  |---|---|---|---|---|
  | `session-channel.md` | T6b | T2 | 1,143 | 4,070 |
  | `rule-hierarchy.md` | T16f | T1 | 419 | 4,555 |
  | `first-version.md` | T6 | — | 31 | 325 |

  Most of the named lines are the resume sections themselves.

## Next step

T3: test first. The hook prints S6's lines on its two one-document paths, and the mode line follows the same task (S5). Update the eleven tests built on `READ`. T1b waits for the lead and blocks nothing in T3.
