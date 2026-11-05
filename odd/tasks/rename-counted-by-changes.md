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
- A rename is left out of a review, or read, by its new name — because the marks are read at the head, where the file
  has its new name.
- A range where git finds no rename is counted as today — because only a rename record changes anything.

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
  spec 1: `node --test --test-name-pattern "renamed" bin/check.test.mjs`: none, new behaviour; today a staged rename of a
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
- [ ] T1 (kind: build) specs 1-2: the tests first, then renames on in `commit-size` and `codex-review`, and the
  declaration by `rules change` · `bin/check.mjs`, `bin/lib/codex-review-*.mjs`, `bin/lib/rules-data.mjs`
- [ ] T2 (kind: verify) Codex, the lenses and an independent verifier over the branch; the pull request

## Log
- L1 2026-11-05, question 193 (the lead's transcript `0f71b2c6`, line 67310), tapped: "Contar lo que cambia".
- L2 2026-11-05, the lead's brief to JH 142, as Spec 2 quotes it.
- L3 2026-11-05, the source: `rules change` refuses a tapped answer as a quotation (the option's text was written by a
  session), so the source quotes what he typed for the number on 2026-10-11 ("Sí, quedan los tres números y el piso",
  `130317af`, line 2963), and his tapped answer to question 193 is where he accepted the reading, as the source of
  `depth-pass` does. The dry run passes: "form; source words".
