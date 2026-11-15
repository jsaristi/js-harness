# JH 204 · el land no borra worktrees vivos

## Goal
A land never removes the worktree of a live session. Opening: the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T08-02-31-062Z-d1a1c98b.md`; feature document
`odd/tasks/land-live-worktree.md`.

## The user's words
None in this session: the request came from the orchestrator's brief, which relays the incident of 2026-11-14.

## Delivered
- Pull request 881, `worktree-land-live-worktree`, not merged:
  - `merge-queue --land` and `--prune` read `claude agents` once and keep a worktree a listed session stands in (cwd
    there, and at work, blocked or a live pid); a listing that cannot be read removes none.
  - `standingIn` (`bin/lib/background.mjs`) is the close's guest check, shared; the removal is `removeUnlived`
    (`bin/lib/worktrees.mjs`).
  - A removal git fails part-way says whether git still lists the worktree, not "it stays".
  - `land-removed-live-worktree` in `docs/FAILURES.md`; the roadmap's Later entry marked done with what is left.

## Decisions
- "Live" is read from claude's listing, the reading the close already had (L1 of the depth pass), not from the
  board or a lock.
- Only `working` and `blocked` count among job states; any other ended state keeps nothing (the verifier, L7).
- `--prune` gets the same protection, since it runs the same removal.

## Failures and lessons
- The land of PR 878 did call `git worktree remove`; on Windows git deletes the files and the registration before
  it fails on a folder a process stands in. Checked in a scratch repository (L3).
- The pre-commit hook refuses a red commit, so the failing tests went in with their fix (L5).
- `merge-queue.mjs` may not grow past 1,000 lines: the shared removal moved to `bin/lib/worktrees.mjs`.

## Left
- A session whose listed cwd is elsewhere, or that enters after the listing, is not seen; a transcript's last
  entry's `cwd` is the candidate (L9).
- Follow-up F1: a notice from a session whose folder vanished still goes to a record no lead reads ("notices that
  are never lost", question 287).
- A half-removed worktree is printed, not recorded in the land's record.

## Cost
- Codex: three reviews, 113,291, 74,553 and 62,848 input tokens (L7, L8, L10).
- Lenses: four on each of three ranges, about 15,800, 11,000 and 6,700 input tokens each.
- Verifier (opus): two passes, 86,085 and 97,471 tokens.
