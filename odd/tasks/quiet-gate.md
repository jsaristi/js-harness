# quiet-gate

Branch `feat/quiet-gate`, from main. One pull request. Runner: `node --test`.

## Goal
A commit whose gate passes prints one line, and `init` keeps gentle-ai's `.atl/` out of what git calls untracked, undone exactly by `uninstall`.

## Why
Finding 5 of JH 43: every onboarding commit printed dozens of lines (the payload and hook inventory in a project, the name of every contract here), and gentle-ai's review called `.atl/skill-registry.md`, its own file, an unassessable untracked file at every commit.

## Done when
- `node --test bin/check-quiet.test.mjs bin/lib/project-exclude.test.mjs` exits 0
- `node --test bin/check.test.mjs bin/lib/project.test.mjs bin/lib/project-switches.test.mjs bin/merge-queue.test.mjs` exits 0
- A commit in this repository prints `PASS  check  …` alone when its gate passes.

## In scope / Out of scope
- In: `bin/check.mjs` (the plain gate's output, `--verbose`), `bin/lib/project.mjs` and `bin/lib/project-exclude.mjs` (the exclude line and its record), `bin/init.mjs` and `bin/install.mjs` (the line they print), `scripts/practice.mjs`, the tests that read the rows, `README.md` and the installed skill text in `bin/lib/manifest.mjs`.
- Out: `check --push` and `check --door`, whose rows the pre-push hook and `merge-queue` read, print as they did. A project initialized before this change gets no `.atl/` line from `sync` (a follow-up if he wants it).

## Constraints
- A failing gate prints every row, as before — because `merge-queue` (`failedRows`), the practice run and a reader of a red commit read them.
- The exclude record names no path: `uninstall` asks git for the exclude file again — because a manifest must not be able to point an undo at another file.
- A manifest that records the line is format 2 — because an older copy would delete the manifest and leave the line behind.

## Ask me before
Nothing: he approved both parts.

## Specs
- S1. Pregunta 49 (session 908805db, line 20702): "Para que el gate haga menos ruido en cada commit (propuesta A, del hallazgo 5 de JH 43): ¿hacemos que cuando pasa imprima una sola línea, con el detalle solo si falla o con --verbose, y que init agregue .atl/ a las exclusiones locales de git?" His answer: "Sí, las dos".
- S2. A gate that passes prints one line, `PASS  check  <n> rows passed[, <m> of them INFO]; --verbose prints each[; review: <the review row's detail>]`. Assumption: the review's verdict rides on the line, since `AGENTS.md` says the gate says whether a change is due a review.
- S3. A gate that fails prints every row, as before.
- S4. `--verbose`, or `JS_HARNESS_CHECK_VERBOSE=1` for a hook, prints every row of a gate that passes, as before.
- S5. `init` adds `.atl/` to the clone's `info/exclude` once, and none where a line already excludes `.atl`; the manifest records it, and `uninstall` takes back exactly what was added.

## Tasks
- [x] T1 (kind: build) S2-S4: the quiet gate, its tests, the readers that need every row (`runCheck` of check.test.mjs, the practice run), the docs. Route: inline. Commit c227396f.
- [x] T2 (kind: build) S5: the exclude line, its record and undo, its tests and docs. Route: inline. Commit 118f4790.
- [x] T3 (kind: build) S5: Codex's two P2s on T2 (L6). Route: inline. Commit 0fbfb134.

## Log
- L1. 2026-10-23, his approval, quoted in S1; the proposal is in the side-session notes, `jh36-t4-findings-5-8-proposals.md`.
- L2. 2026-10-23, readers of the gate's output found: `.githooks/pre-commit` and the init hook (print only), `merge-queue` (`failedRows` on a red suite, `rowsAndLines` INFO of `--door`), `scripts/practice.mjs` (`PASS budget`, `PASS tests`, `PASS rules` of a commit), and the tests through `runCheck`. The gate log is written from rows, not from stdout.
- L3. 2026-10-23, T1 committed c227396f (its gate printed `PASS  check  15 rows passed, 7 of them INFO; …`); T2 committing on `feat/quiet-gate` (worktree backup-ready-a4ce86). Tests changed to read rows set JS_HARNESS_CHECK_VERBOSE=1; manifest format pins moved to 2.

- L4. 2026-10-23, gentle-ai on c227396f (dea129b7..c227396f): high (escalated, item 3), lenses readability and reliability, approved and acknowledged (lineage review-25107bdfbd7264de).
- L5. 2026-10-23, gentle-ai on 118f4790 (c227396f..118f4790): high (escalated, items 1 and 3), lenses risk and reliability, approved and acknowledged (lineage review-afc5abaa4780fa5a). Codex review of dea129b7..118f4790 started (2 parts, about 240,000 input tokens planned).
- L6. 2026-10-23, Codex on dea129b..118f479 (2 parts, 255,829 input tokens, recorded): two P2s on T2. (1) `addExclude` took any `.atl` line as enough, though a later `!.atl/` brings the folder back; (2) init and uninstall wrote the exclude file git names without checking its real path, so a link swapped in after init sent the undo to another file. Both fixed test-first in 0fbfb134 (T3): the last matching line decides, as in git, and a path with a link on its way or a real path outside the clone is left as it is and reported (`kept` by init, `could not remove` by uninstall).
- L7. 2026-10-23, gentle-ai on 0fbfb134 (118f4790..0fbfb134): high (escalated, item 2: a containment guard), lenses risk and reliability, approved and acknowledged (lineage review-04931d2458a0b67f).
- L8. 2026-10-23, Codex on 118f479..0fbfb13 (41,715 input tokens, recorded): correct, both P2s of L6 fixed. In all the reviews spent about 297,544 Codex input tokens and four gentle-ai lens runs on two commits plus two on the fix.

## Next step
Pull request opened; the orchestrator merges. Follow-up if he wants it: `sync` adds the `.atl/` line to a project initialized before this change.
