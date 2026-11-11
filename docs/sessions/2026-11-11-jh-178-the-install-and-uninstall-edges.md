# JH 178 · the install and uninstall edges

File: docs/sessions/2026-11-11-jh-178-the-install-and-uninstall-edges.md.

## Goal
Build the audit triage's work unit 7, the six install and uninstall edges the Fable 5.2 audit verified (M29, M30,
M35, M36, L2, L3), from the brief `C:\Users\Oficina\.js-harness\background\briefs\2026-11-11T06-06-47-550Z-9d2b5c87.md`
and the unit's text (`docs/proposals/2026-11-10-audit-triage.md`, "### 7.", on `origin/docs/audit-triage`).

## The user's words
None in this session. The brief gives the authority, and quotes his words to the lead's session (transcript
`ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, read with `js-harness sessions --quote`): line 6716, 2026-11-11T05:26:36Z,
"une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion recomendada, no
preguntes, avanza y se completamente autonomo."; line 6905, 2026-11-11T05:30:20Z, "contesta TODAS las preguntas con
recomendado TODAS y avanza los mas posible eres completamente autonomo". The triage puts no question of his on this
unit ("Whose call: the lead's"), and the brief answers it: "This unit is the lead's call in the triage, no question
of his: build it as the unit says."

## Delivered
The feature document is `odd/tasks/install-uninstall-edges.md` (contract, depth pass, S1 to S6, Log L1 to L26). The
branch is `worktree-install-uninstall-edges`, seven commits on `fbaa7df5` and the one that adds this file, one pull
request, ready and not merged. The contract's test commands, whole: 735 tests, 726 pass, 0 fail, 9 skipped (L26).

- `62bb01f6` docs: the feature document, before any code.
- `620f337d` slice A. S2 (M30): `upgrade` prints what its sync said when it fails (`bin/update.mjs`). S4 (M36):
  the prompt of `uninstall machine` names the seven folders of `.js-harness` it removes, and a test holds the prompt
  to what `uninstallMain` removes (`bin/tui.mjs`, `docs/GUIDE.md`). S5 (L2): `compareSemver` orders prereleases as
  semver does (`bin/lib/version.mjs`). S6 (L3): a first write over a file that is already there keeps a copy
  beside it, `<name>.before-js-harness-<8 hex>`, and `install` says where (`bin/lib/component-write.mjs`,
  `bin/install.mjs`).
- `99020c10` slice B. S1 (M29): in a linked worktree `init` and `sync` write no hook outside the working tree and
  no line of the shared `info/exclude`; each is reported with the checkout whose `sync` writes and records it
  (`bin/lib/project-shared.mjs`, new; `bin/lib/project.mjs`; `bin/lib/project-migrate.mjs`; `README.md`). S3 (M35):
  the status-line undo removes the policy value only when it holds the install's (`bin/lib/status-line-uninstall.ps1`).
- `c36f512a`, `90f32411`, `db26cbd2`, `1637dcde`: what the reviews and the verifier found, each fixed test first
  (below).

## Decisions
All this session's, recorded in the feature document's Log; none was his, and none was sent to the lead.
- S1, of the two ways the unit allows: refuse the shared files alone, neither the whole `init` nor a write into the
  main checkout's manifest (L2). One verdict, `hookElsewhere`, for `sync` and for what the plan and the gate say (L19).
- S6: the copy beside the file, named by its bytes; `uninstall` leaves it; a restore by `uninstall` is out of scope,
  because it is inside `bin/lib/manifest.mjs`, at its ceiling and under JH 172 and JH 175 (L3, L9).
- S3: no test writes to the registry; the script's text is held by a test and the script was run by hand against a
  throwaway key, twice (L4, L5, L25). Letter case is left apart in the comparison, as the install compares it (L25).
- A new module, `bin/lib/project-shared.mjs`, because `bin/lib/project.mjs` was at its ceiling; that file went from
  1,978 lines to 1,975 and its ceiling with it (L7, L20).
- The missing push check stays a line of the gate's row in a linked worktree, with the checkout that writes it,
  where leaving it out would have hidden that the repository has none (L25).

## Failures and lessons
- This session's own, L20: the document said the guard covered "every writer of a shared file" and it did not.
  `restoreRecordedHook` wrote a shared hook again from a linked worktree whose record named it. The claim rested on
  reading one function's callers, not on a search for every write of a hook's content. Found by the test written
  for a lens finding; fixed; the search that closes it is in L20 (two write sites, both behind `hookElsewhere`), and
  the verifier's greps found no third.
- L12: a run filtered by test name missed a test pinned to the old behaviour, and a background run reported exit 0
  because the command line ended in an `echo`. Since then the whole file is run and the command whose exit matters
  is the last.
- L15: slice B was committed before Codex had read slice A alone, so one Codex run read both. Nothing went unread.
- What review found that the first code had wrong: a copy taken as whole by its name (Codex), numeric prerelease
  identifiers through `Number` (Codex), "could not start" for any spawn error (a lens), the migration's plan
  naming a hook `sync` skips (a lens), the plan judging the wrong path once `core.hooksPath` changed (Codex), the
  gate's push-check line in a linked worktree, `-eq` on a registry value of several strings and a shared copy name
  (the verifier). Eight findings, eight fixed, each with a test seen failing first, but for two cases said in the
  Log (L10: S3's first test; L17: one added case of S5).
- The guard refused compound commands (git text beside a redirection or a heredoc) several times; each was split.

## Left
- The pull request, ready: the lead lands it.
- For whoever works in `bin/lib/manifest.mjs`: `install` says nothing when a component is not written because its
  copy could not be made (`manifest.mjs:960-961` drops the `null`), and `uninstall` does not put the kept copy back.
- The header of the gate's `functions` row still reads "js-harness functions apply makes it so" above a line that
  names the main checkout's `sync` (`bin/check.mjs:1633`), and `migrate` prints that line under "would write:".
- The plan's line for the `.atl/` exclude record is printed where the line is already in the file and `sync` then
  records nothing; older than this feature, the same in a main checkout (L22).
- A status-line install with a custom `-Folder` holding `&` or `'`, installed by one PowerShell (5.1 or 7) and
  undone by the other, keeps the policy value: the two spell those characters differently in JSON.
- The three core numbers of a version still go through `Number`, as before this feature.

## Cost
- Time: the brief is of 01:06 local (UTC-5); the last review ended at about 04:55. One compaction by the host.
- Codex, five runs on gpt-6.1-sol at medium effort: 391,970 input tokens (245 s, two findings), 50,712 (72 s,
  correct), 72,324 (82 s, one finding), 66,964 (60 s, correct), 68,400 (53 s, correct); 650,370 input tokens in all.
- The Claude lenses, 15 runs on claude-fable-5-2 at high effort in four ranges: slice A, four of about 16,000 input
  tokens; slice B, three of about 22,200; the first three fix commits, four of about 18,000; the last, four of
  about 10,300.
- The independent verifier, one read-only sub-agent: 211,383 tokens, 59 tool uses, about 15 minutes.
- Pre-commit gates on GitHub's machines: one a commit, all green (236 s and 201 s for the two slices, the gate log).
- This session's own tokens are not known.

## Not checked
- On this machine, the ten tests that need a symbolic link (no privilege): they are skipped here and run in the
  gate's Linux job; that they passed there is read from the job's pass, not line by line.
- Either status-line script end to end with a real install: the undo was run against a throwaway key only.
- A worktree of a bare repository and a submodule, beyond the unit tests of `sharedElsewhere`.
- `uninstall machine` on a real home.
