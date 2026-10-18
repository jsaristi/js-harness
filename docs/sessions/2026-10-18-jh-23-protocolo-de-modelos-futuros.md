# JH 23 · protocolo de modelos futuros

File: docs/sessions/2026-10-18-jh-23-protocolo-de-modelos-futuros.md.

## Goal
Finish T7 (G2, the arms of one component: C3c to C7), then T10 and T11 of
`odd/tasks/future-model-protocol.md`, with no eval run and no real-claude probe. The opening read
(`js-harness sessions --opening 'JH 23 · protocolo de modelos futuros'`) resumed C6b from the shared
note `jh23-state.md`, then C7 and T11.

## The user's words
None. The session was started and resumed by the lead, JH ORQ · js-harness; Sebastián wrote nothing to
it. Its first channel notice is at 2026-10-17T22:35:10Z in `~/.js-harness/channel/D--js-harness.jsonl`.

## Delivered
- jsaristi/js-harness#426, merged: C3a to C5 of G2 and T10 (`3bb5871`, codegraph and the js-harness
  commit recorded with a run).
- jsaristi/js-harness#428, merged: C6a `cb9f1f3`, the isolation probe tracks a component per request;
  Codex's three fixes `3f3d59a`.
- jsaristi/js-harness#429, merged: C6b `d7dc0a1` (`minimal-with-mcp-<name>`), C7 `fe56f2f`
  (`docs/future-model.md` Steps 5 and 6), the pin fix `8ce9afe`.
- jsaristi/js-harness#430, merged: `e64e1df`, the setup fingerprint leaves out `.in_use/<pid>`,
  marketplace `lastUpdated` and skill-sync bookkeeping (`evals/home.mjs`, `BOOKKEEPING`, `SETTLED`).
- jsaristi/js-harness#438, merged: T11 held two hours apart (L34), T7 checked.
- Feature document `odd/tasks/future-model-protocol.md`: T7, T10, T11 done, L26 to L34.

## Decisions
- The minimal-with pin hashes the servers the arm puts in, not what is left after the cut: this
  session, taking Codex's P2 (L30).
- The three volatile kinds are left out of the fingerprint; each synced skill's `updatedAt` stays
  setup: this session (L32).
- T11 split into two PRs so the fix did not wait two hours: this session (L32, L34).
- Every branch from a fresh origin/main after a land: the lead, by notice.

## Failures and lessons
- A land removed the worktree under the session (found when `cd` failed after #428); it was
  recreated at the same path, and the later timed build ran from a `git archive` copy so a land
  could not break it.
- Codex found the minimal-with pin hashed the wrong thing (`d7dc0a1`); fixed test first in
  `8ce9afe`, recheck clean.
- A `node -e` string edit failed on a backslash and a CRLF file; those edits went through Edit.
- `rmdir D:/jh23-fp-scratch` was refused by the guard (a folder at a drive root); scratch belongs
  under the worktrees folder or the scratchpad.

## Left
- T8 and T9 wait for the WSL gate; the lead holds them.
- The empty folder `D:/jh23-fp-scratch`, for Sebastián to remove.

## Cost
- Time: first notice 2026-10-17T22:35Z, closed 2026-10-18T02:40Z.
- Context at the end: about 50 percent, after two compactions by the host.
- Codex reviews: `b743fd0..fe56f2f` (297,789 input tokens), `fe56f2f..8ce9afe` (43,990),
  `f0cd67b..e64e1df` (138,105), plus the C6a reviews of #428.
- gentle-ai: every slice assessed medium and not due (`under_budget`), docs passive.
- Gate runs: one per commit, tests on GitHub's machines; no eval run.
