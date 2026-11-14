# JH 198 · cement the directives audit's corrections

## Goal
Implement every correction of the directives audit and its two blind reviews, and fix each one where a check can hold it. The work came from the lead's brief, `C:\Users\Oficina\.js-harness\background\briefs\2026-11-13T21-21-03-133Z-9d4bac6c.md`. The plan, task contract and log are in `odd/tasks/audit-cement.md`.

## The user's words
- "Ok implementa todas las correciones y cementalas en el harness para que esto nunca jamas vuelva a suceder". This is quoted in the brief. The user typed it in the lead's session.
- Spec 10: "dime si de la forma como planeamos las cosas que tanto porcentaje de implementacion pudimos hacer quiero que agregues esta nueva funcionalidad para ver que tanto cambio nuestro plan". Read from the lead's transcript 69918425, line 3312; typed, 2026-11-13T22:01:59Z, checked with `sessions --quote` (L4).

## Delivered
| Task | Pull request | State |
|---|---|---|
| T1, `opus` as the session model's short name | 863 | merged 2026-11-13 |
| T2, the guard refuses `cd` into another session's worktree | 864 | merged |
| T3, no false STALLED for a batch or an open question; a wait ignores its own notices | 865 | merged |
| T4, `--remove-worktree` copies or refuses what no branch keeps | 867 | merged |
| T4 follow-up: junctions, `..foo` folders, unborn branches | 873 | merged 2026-11-14 |
| T5, `yours` drops only with a reason | 868 | merged |
| T6, the throughput command is named, the senior is the strongest model, the 2026-11-13 failures | 869 | merged |
| T7, the senior section and closing before the last ready | 876 | merged, main 01f7588 |
| T8, `progress --baseline <day>` | `feat/progress-baseline` | 13c0a5d4 and 6c6889ca; its pull request carries this file |

## Decisions
- §1 ships with its mismatch against the recheck code left as is, for JH 199 to settle. The lead decided (L23).
- The HEAD-reflog case of L12 is left out: refusing a commit that only the reflog holds would refuse every worktree after a rebase. Agreed with the lead (L25).
- The senior section lives in `bin/lib/lead-protocols.mjs`, not `manifest.mjs`, because the manifest is at its 1,644-line ceiling. The lead cleared the file (L30).
- The ready bullet keeps `closed` after the last `ready`. The advisor found the first wording reversed that order (L30).
- `--baseline` reads git on the default branch: the last first-parent commit before the day, then whole-tree diffs from the empty tree. Steps are matched as `--pace` matches them. This session's design; Codex and the lenses reviewed it.

## Failures and lessons
- **Heredocs and `node -e` ate backslashes in regexes and tests**, three times. Each time a test failed and the file was fixed with Edit. Code that holds a backslash is written with Write or Edit, never through a shell heredoc.
- **A refused commit was followed by a push on its own line.** The push sent only an earlier merge, so nothing was harmed. Steps that depend on each other are chained with `&&`.
- **A FAILURES control phrase with an apostrophe did not match the escaped test name.** The phrase was shortened.
- **Notice waits died with 127** when `merge-queue --refresh-copy` refreshed the installed copy. Each was re-armed.
- **T8's first edits went on T7's branch.** They were moved with a tagged stash before any commit.

## Left
- T8's pull request waits to land. The lead holds the merge queue.
- `docs/FAILURES.md` `sub-agents-inherited-model` has no control yet (L23).
- The low findings of the T4 follow-up's verifier are answered in L29, not fixed: a junction inside a worktree that points out of it, `realpath` on an unreachable UNC host, and a branch ref moved from outside and then deleted.

## Cost
- Time: the brief was written 2026-11-13T21:21Z; T7's ready went out 2026-11-14T22:54Z. This session was compacted twice, at 18:35Z and 22:12Z.
- Context at the last notice: 43%.
- Reviews: Codex and the Claude lenses on every code commit of each slice. The independent verifier ran on the high-risk slices: T1, T2 and T3, T4 over three rounds (L11, L12), T5 (L21), and the T4 follow-up (L27, L29).
- Gates: `js-harness gate` on the touched suites before each commit, and the pre-commit `npm run check` on GitHub's machines.
