# A renamed file counts by the lines it changes

Locator: `odd/tasks/rename-counted-by-changes.md` · Branch: `rule/reviewed-commit-lines` · Delivery: one pull request to
main · Test runner: `node --test`

## Goal
The rule `reviewed-commit-lines` (1,200 changed lines a commit) counts a file a commit renames by the lines it changes,
as git measures a rename, in the gate's `commit-size` row and in `js-harness codex-review`, which also shows Codex a
renamed file as a rename; the cap itself stays.

## Why
JH 142 moves 16 files of the workshop, already reviewed, under `workshop/` with a few repaths. Renames off, the staged
move is 15,333 changed lines and one file alone, `throughput.mjs` (672 lines, counted 1,344), is over the cap, so no
split of the move passes `commit-size`; renames on, it is 569 (`odd/tasks/workshop-product-split.md`, L19). The owner answered
question 193 "Contar lo que cambia" (2026-11-05, the lead's transcript `0f71b2c6`, line 67310), whose yes covered only
this change to his rule, through `rules change`, and neither a higher cap nor any other change.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/rename-counted-by-changes.md` exits 0
- `node --test bin/lib/codex-review-parts.test.mjs bin/lib/codex-review-prompt.test.mjs` exits 0
- `node --test bin/codex-review.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is opened, named in `## Log`, with Codex and the Claude lenses recorded over its code and an
  independent verifier's verdict in `## Log`

## In scope / Out of scope
- In: the declaration and source of `reviewed-commit-lines` (`bin/lib/rules-data.mjs`, `docs/rule-sources.json`,
  `docs/RULES.md`, by `rules change`); `checkCommitSize` (`bin/check.mjs`); `numstatFiles` and `reviewParts`
  (`bin/lib/codex-review-parts.mjs`); `rangeDiff` (`bin/lib/codex-review-coverage.mjs`); the part prompt
  (`bin/lib/codex-review-prompt.mjs`); `reviewSize` (`bin/lib/codex-review-rows.mjs`); the texts of
  `bin/codex-review.mjs` and `bin/lib/codex-review-scope.mjs` that say renames are off; their tests; this document.
- Out, each with its reason:
  - the cap of 1,200: his answer kept it.
  - the Claude lenses (`bin/lib/lens-candidate.mjs`), which read a range renames off: the brief names `commit-size` and
    `codex-review`; a follow-up if the lenses of the move cost too much.
  - which commits a Codex record covers (`bin/lib/codex-review-coverage.mjs`, `--name-only`), and the turns of a cut
    range (`bin/lib/codex-review-turns.mjs`): they list names, and a rename's two names stay two names there.

## Constraints
- A renamed file's two names are always in one part, the old name before the new — because a part shown with renames
  on and only one of the names would show the file whole, added or removed, and its count would not hold.
- Renames are asked for with `--find-renames` wherever a range is counted, split or shown — because a diff without it
  follows `diff.renames` of whoever runs it, and the count, the parts and what Codex is shown must agree.
- A rename is left out of a review only when both its names are, under the reason of its new name — because a move of
  code a review reads to a path the project marks would otherwise take the code out of every review (L6).
- A range where git finds no rename is counted as today — because only a rename record changes anything.
- A range that renames a file a review leaves out into one it reads is counted and reviewed renames off, whole —
  because its content had no review, and as a rename it would be shown by its changed lines alone (L7).

## Ask me before
Nothing planned: question 193 decided the change. A question goes to the lead with
`js-harness notify --to orchestrator --kind question`.

## Depth pass
- 1. Method: change review sizing, the discipline of code review tooling, to the standard of `git diff --stat` and of
  every code review tool that shows a move as a rename with its edits (GitHub's "renamed with changes"): a reviewer
  reads what changed, and a moved file's unchanged lines carry no new evidence. The smallest change: turn renames on in
  the one place each count or diff is built, parse git's rename record, and keep a rename's two names together.
  Searched first (`rule:reuse-first`): `--no-renames` in `bin/` (34 lines of source), `numstatFiles` (the one parser of
  `--numstat -z`), `rangeDiff` (the one builder of a range's diff), `reviewParts` (the one grouping); no rename handling
  exists to reuse.
- 2. Raw material: the row `bin/check.mjs:629` (`--no-renames` in `checkCommitSize`); the parser
  `bin/lib/codex-review-parts.mjs:45`, which throws on a rename record; `rangeDiff`,
  `bin/lib/codex-review-coverage.mjs:437`; the part command `bin/lib/codex-review-prompt.mjs:132` and `:141`;
  `reviewSize`, `bin/lib/codex-review-rows.mjs:304`; the staged move of JH 142 in
  `D:/js-harness-worktrees/workshop-dispatch` on `f78479af`; his answer, the lead's transcript `0f71b2c6`, line 67310.
- 3. The bar:
  spec 1: `node --test --test-name-pattern "rename" bin/check-commit-size.test.mjs`: none, new behaviour; today a staged rename of a
  672-line file with 11 lines changed each way is counted 1,344 changed lines, renames off, where git counts 22.
  spec 2: `node --test bin/lib/codex-review-parts.test.mjs bin/lib/codex-review-prompt.test.mjs`: none, new behaviour; today `numstatFiles` throws on a rename record and every part is shown renames off.
  spec 3: `node bin/js-harness.mjs rules check`: today passes with the old subject; the dry run of the change passes.
- 4. Refutation: does git's measure of the move fall under the cap, and does a part that names both of a rename's names
  show it as the whole range does? `git diff --cached --numstat -M` over the staged move: 57 records, 569 changed lines,
  32 of 32 moved files found as renames (renames off: 89 records, 15,333). `git diff --cached -M -- bin/throughput.mjs
  workshop/bin/throughput.mjs`: one section, `similarity index 98%`, 11 added and 11 removed, as in the whole range.
  Verdict: supports
- 5. Request: as the Goal, with the constraints above read from it: a rename's names kept in one part is what "counted
  by its changed lines" needs for Codex to be shown the same lines; nothing more.
  Adds: none

## Specs
1. Question 193, as he said yes to it: "JH 142 recomienda que la revisión del commit y la de Codex cuenten un archivo
   movido con pocos cambios solo por las líneas que cambian, que es como git ya lo mide. Un sí cubre ese cambio a tu
   regla, en su propio commit con `js-harness rules change`, con tus palabras citadas, revisado como todo. No cubre
   subir el tope ni ningún otro cambio." His answer: "Contar lo que cambia".
2. The lead's brief (2026-11-05): "a renamed file with few changes counts only by its changed lines in commit-size and
   codex-review, changed through `js-harness rules change reviewed-commit-lines` on a rule/ branch in its own commit,
   his tapped words quoted with the date, test first, reviewed like any slice. The 1,200 cap itself stays."

## Tasks
- [x] T1 (kind: build) specs 1-2: the tests first, then renames on in `commit-size` and `codex-review`, and the
  declaration by `rules change` · `bin/check.mjs`, `bin/lib/codex-review-*.mjs`, `bin/lib/rules-data.mjs`
- [x] T2 (kind: verify) Codex, the lenses and an independent verifier over the branch; the pull request

## Log
- L1 2026-11-05, question 193 (the lead's transcript `0f71b2c6`, line 67310), tapped: "Contar lo que cambia".
- L2 2026-11-05, the lead's brief to JH 142, as Spec 2 quotes it.
- L3 2026-11-05, the source: `rules change` refuses a tapped answer as a quotation (the option's text was written by a
  session), so the source quotes what he typed for the number on 2026-10-11 ("Sí, quedan los tres números y el piso",
  `130317af`, line 2963), and his tapped answer to question 193 is where he accepted the reading, as the source of
  `depth-pass` does. The dry run passes: "form; source words".
- L4 2026-11-05, the bound of files: each of a rename's two names counts toward `review-part-files`, since each goes
  on the command line the bound protects, and a part of a rename alone holds both. The commits: the code and its
  tests first, then the declaration by `rules change`, which refuses a tree with changes outside the rule's home.
- L5 2026-11-05, the tests first, each seen red before its code: `check-commit-size.test.mjs` (2,401 changed lines
  where 1 was expected), `codex-review-parts.test.mjs` (2 failing), `codex-review-prompt.test.mjs` (4 failing), the
  rename test of `codex-review.test.mjs` ("showed 0 of 8 changed lines of part 2 of 4").
- L6 2026-11-05, the first gate of the code refused it (GitHub run 42065401146): `check-codex-reviews.test.mjs`, "a
  commit that moves a file a review reads to a path the project marks", found that a rename classed by its new name
  alone took code out of the review. The constraint is corrected: a rename is left out only when both its names are
  (`leftOutOfFiles`, `bin/lib/codex-review-scope.mjs`), under the reason of its new name; the test now expects the
  move read, by its 0 changed lines.
- L7 2026-11-05, the reviews of `7b311d8..119b8e5`: the lenses (risk, reliability, readability) 0 findings; Codex one
  P2, the whole-range patch and prompt followed `diff.renames` (fixed: both ask `--find-renames`); the verifier
  refuted it. Its blocking finding: a rename whose old name a review leaves out (a document, a marked file) and whose
  new name it reads brings content no review read into code, counted and shown as 0 changed lines. Decided: a range
  that holds such a rename is counted and reviewed renames off, whole, as before this change; any other range
  renames on. Also owed from it: the part and merge prompt versions bumped, the stale texts of
  `codex-review-coverage.mjs:203` and `lens-candidate.mjs:22`, and the spec 1 command of the depth pass.
- L8 2026-11-05, the fix of L7's findings. `rangeFiles` (`bin/lib/codex-review-scope.mjs`) reads a range renames on and,
  when a rename's old name is left out and its new one read, again renames off; `checkCommitSize`, `reviewSize` and
  `rangeGroups` read through it, and `planParts` and the part prompt take its `renames`. Under renames off the old
  name is a left-out deletion, so such a range always goes through parts. The prompt versions: the whole range v4
  (Codex's P2 changed its command), a part v6, a merge v5. Each new test seen red first: the commit-size one on
  `119b8e5` ("1 changed line" where 301 was expected); the codex-review one on `119b8e5` (no part session started,
  the range was reviewed whole). Known and kept: a rename is 2 files in a part's count (both names go on its command
  line, L4) and 1 in `reviewSize`'s, which counts files.
- L9 2026-11-05, the reviews of `119b8e5..f67d773` (the commit of L8). Codex: a recheck, its P2 fixed, "the patch is
  correct" (0.97). The lenses: reliability 0 findings; readability 1 suggestion, the names of a range's files built
  twice (fixed: `namesOf`, and `leftOutOfFiles`'s `said` documented). The verifier: holds, nothing blocking; one test
  gap, the fallback in `reviewSize` (fixed: a test in `check-codex-reviews.test.mjs`, red on `119b8e5` with "0
  changed lines"). Kept, with its reason: under `--prompt codex` Codex writes its own diff, which follows
  `diff.renames`, while the whole range's patch asks `--find-renames`. They differ only where `diff.renames` is
  `false` or `copies`. git's default is renames on, and Codex's P2 asked for the fixed option. The recheck prompt's
  version stays, as it versions only the text it adds.
- L10 2026-11-05, `3f9600f` (L9's commit): Codex "the patch is correct" (0.98); the lenses 0 findings, readability's
  earlier one rechecked fixed. Each code commit of the branch has a Codex and a lens record (the pre-push rows).
  The pull request: https://github.com/jsaristi/js-harness/pull/775, to main; its merge is the owner's.
- Next step: none here. The move of JH 142 goes on top of this branch, in `odd/tasks/workshop-product-split.md`.
