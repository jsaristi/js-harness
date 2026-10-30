# JH 103 · doctor: a row for Codex's managed daemon, and engram's mismatch text

## Goal
Opened from the lead's brief `briefs/2026-10-30T16-08-45-364Z-78590333.md` (main at `04e3d29d`): build the
`codex-daemon` doctor row JH 97 proposed, test first and read-only on ~/.codex, and add it to the roadmap under F8 by
his answer to question 123; and fix the engram plugin's ahead-of-binary text, which told him to update a binary that
was already engram's latest release. Branch `feat/codex-daemon-row`.

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-10-30T16-08-45-364Z-78590333.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (this session's first
user message). The brief's items, quoted, are S1-S3 of `odd/tasks/codex-daemon-row.md`; his answer to question 123,
"Sí, agrégala", is its L1.

## Delivered
- `odd/tasks/codex-daemon-row.md`: contract, S1-S3, T1-T4, D1-D5, L1-L9.
- `1da156e7` feat(doctor): the `codex-daemon` check (`bin/lib/codex-daemon.mjs`), after `codex-trust`: `ok`, `missing`
  (2026-10-21's state, a dangling `current`, or no `current` while the daemon's files keep Codex from reinstalling),
  `n/a`, `unknown`; its fix names the repair of `codex-trust-table.md`. Red 8 of 351, green 358 of 358 (L4); on this
  machine the branch's doctor reads it `ok` (L5).
- `22c6317d` fix(doctor): the engram plugin's ahead fix reads engram's latest version doctor already resolves: a newer
  release names it, the binary at the latest says nothing is to be done until the next one, unknown says both. Red 4
  of 211, green (L6); on this machine it now says "nothing is to be done until the next one" (L7).
- `27bba804` docs(roadmap): "The Codex daemon row (JH 103, beside S11's doctor rows)" under the F8 plan, with his answer.
- `36dbe52a` fix(doctor): the entrypoint must be a file (Codex's P2, L8).
- PR 704 (`feat/codex-daemon-row`), with its ready notice.

## Decisions
- This session's, within the plan: D1 (`missing`, no new gap state), D2 (no `current` is a gap only while Codex will not
  reinstall), D3 (an unreadable release manifest is `unknown`), D4 (the engram text uses the cached latest, no new
  request), D5 (the cell stays `mismatch`: the protocols do differ).
- The branch was renamed from `worktree-feat-codex-daemon-row`.

## Failures and lessons
- Codex found a false `ok` in the first range: a folder at the entrypoint's path passed `existsSync`, and the stack test
  built its healthy fixture that way. Fixed and reviewed (L8, L9).

## Left
- The installed `js-harness` still prints the old engram text and has no daemon row until a release carries this PR.
- Not checked: what Codex does with a release whose `codex-package.json` is missing (the row says `unknown`, D3).

## Cost
- Time: brief at 16:08Z, this summary at about 16:40Z.
- Reviews: Codex twice (127,922 and 31,491 input tokens); the lenses reliability, readability and resilience on the
  range (about 40,000 input tokens each), reliability and resilience on the fix (10,903 and 5,170).
- Gates: four pre-commit runs of `npm run check`, all PASS, and the closing one.
