# JH 68 · F8 S11: js-harness takes over the complements

## Goal
Carry out F8's S11 as `docs/proposals/harness-diet.md` defines it: js-harness installs and registers engram, its
plugin, codegraph and context7 with their own commands; `init --preset complete|lean|custom` (G14); the gentle-ai
rows leave; `bin/` and `evals/` stop naming gentle-ai but a named list. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-28T10-57-44-850Z-c751a8fa.md`.

## The user's words
- Question 104, read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 11879`: "Las lentes Claude
  (Recomendada)".
- Question 106, read with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 13778`: "Aplicarlo al
  entrar 632 (Recomendada)".

## Delivered
- #627 `f8-s11-complements` (stack owns the complements, gentle-ai rows out): merged 2026-10-28T13:13:48Z.
- #628 `f8-s11-presets` (init presets, engram's protocol row in doctor): merged 2026-10-28T13:58:31Z.
- #629 `f8-s11-reviews` (the merge door asks for no gentle-ai line; the lens record where Codex is off, Q104):
  merged 2026-10-29T01:04:00Z.
- #632 `f8-s11-sweep` (`bin/lib/gentle-ai-absence.test.mjs`, the named list): merged 2026-10-29T04:39:36Z
  (main 5e36e820).
- `odd/tasks/f8-s11-complements.md`: T1-T8 done; the apply on his machine under its Probe.
- Applied to his machine 2026-10-29: `js-harness stack install` printed "nothing to install." (exit 0, nothing
  written); `js-harness doctor --cwd D:/js-harness` exit 0 before and after, gentle-ai still installed.

## Decisions
- His: Q104, the Claude lens review stays on where Codex is off, and the merge door asks for its record (L14).
- His: Q106, apply S11 to his machine once #632 lands and the installed copy is refreshed (L15).
- The lead: the guard's gentle-ai review-base refusal stays until S2, JH 69's files named in the list (L13).
- This session, within the specs: L6-L12 of the feature document (context7 through `init`, presets optional, the
  engram-plugin row as row 11's doctor row, the plan of the sweep).

## Failures and lessons
- The land left #632 out red twice: the absence test ran `git ls-files`, and the gate's WSL mirror is rsynced without
  `.git` (`bin/lib/gate-wsl.mjs:112`). gentle-ai's R3-002 had said so and was left. Fixed in bca90373..3fc6425f: the
  test skips only with no `.git` outside CI and fails on a CI machine without one.
- The land of 632 and 648 went red on GitHub (Actions run 40816256353): main brought three S5c-a eval results naming
  gentle-ai; listed as results in b47cd4da. The "FAIL budget 1501" in that log is the output of check.test.mjs's
  over-budget test; the real row read `PASS budget 974`.
- A lens over a main merge read 791,578 tokens against an estimate of about 20k: `lens-review --base` reads base..head.
  Later merges were measured with `git diff --shortstat` and reviewed from the second parent (44,632 for b47cd4da).
  The lead routes its `docs/FAILURES.md` "Seen" line.

## Left
- pnpm's global bin lock folder `C:\Users\Oficina\AppData\Local\pnpm\bin\.pnpm-global-bin.lock`, left at 00:30:52 by
  the refresh: `doctor` shows its `rmdir`; the lead's.
- context7 is off in the main checkout's project (`/mcp` in a Claude Code session there) and codex's hook trust is
  missing: his settings. Codex is outdated at 0.164.0.
- The guard's gentle-ai refusal and the eval guards on the named list leave at S2.

## Cost
- From the brief (2026-10-28 10:57Z) to the apply (2026-10-29 05:42Z), with two host compactions; the context at the
  close about 27% of the window.
- Every code commit of the four PRs is covered by a Codex record and a Claude lens record (the pre-push rows of
  #632: 11 of 11); gentle-ai reviewed each slice candidate except merges holding main's diff, read as status only.
- Gates: the pre-commit `check` at each commit, the GitHub gate at each push, and four lands of the merge queue
  for #632 (two red in the WSL mirror, one red on GitHub, then green).
