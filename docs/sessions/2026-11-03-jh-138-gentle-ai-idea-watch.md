# JH 138 · gentle-ai idea watch

File: docs/sessions/2026-11-03-jh-138-gentle-ai-idea-watch.md.

## Goal
Build the idea watch of `docs/proposals/gentle-ai-reverse-engineering.md` section 5, test-first: a fetch-only clone
that `uninstall machine` removes, a diff bucketed by area, a verdict per change, the record, and a doctor row; large
work, `odd/tasks/idea-watch.md`, from the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-04T02-11-47-437Z-ec70b4e5.md`.

## The user's words
His lines 61838, 62036 and 62099 of the lead's transcript (2026-11-03), quoted as S1 to S3 of the feature document:
read what each gentle-ai release adds or removes for what helps the harness, with gentle-ai uninstalled everywhere,
and without copying it.

## Delivered
- Branch `idea-watch`, a pull request marked ready, not merged.
- 155a118b, 847a608d: the feature document, opened before the first source write, then its tasks, probe and log.
- 1c083486 `bin/lib/idea-watch.mjs`: `AREAS` (13 rows, the 54 paths section 5 left unmatched in v4.2.0 → v4.3.1 given
  rows), the numstat parser, the buckets, the draft, the stable tags and the last release read.
- 4f2122ed `bin/lib/clones.mjs`: the machine manifest's `clones` record, removed by `uninstall machine` only inside
  `~/.js-harness`.
- 08458520 `js-harness idea-watch status|draft`; the record `odd/tasks/gentle-ai-update-check.md` seeded with v4.3.1;
  SPEC, RECORDS, README.
- 009dd2e1 doctor's `idea-watch` row, interactive and online only.
- 426bbfe0 Codex's five findings fixed (one P1: the clone removal judged by where the path resolves).

## Decisions
- This session's: a bare clone (nothing in it can run) in a manifest array of its own, `clones`, since a folder has
  no bytes to hash; recorded before it is fetched. Feature document, L2.
- This session's: a drafted section counts as read only when decided, so no separate check command. L2, then L6.
- His, not taken: the first real clone in his home, asked through the lead; nothing needs it today, v4.3.1 is read.
- The lead's: the roadmap's S9 line (JH 137 owns it); the suggested text is in the feature document's `## Next step`.

## Failures and lessons
- The gate refused two commits, each read before the next run: manifest.mjs past its 1752-line ceiling (the clone
  code moved to `bin/lib/clones.mjs`), and a command with no README section.
- The feature document edited during Codex's first run voided it (168,141 input tokens): `docs/FAILURES.md`,
  edit-during-review, its tenth sighting.
- The host compacted this session at 21:57 local; it resumed from the feature document and the transcript.

## Left
- The S9 roadmap line, the lead's. His decision on the first real clone.
- Not checked: the probe ran on Windows only; the junction test needs no admin rights there.

## Cost
- From the brief at 21:11 to the ready notice at about 22:40 local (2026-11-03).
- Gates: six pre-commit gates passed, two refused (both read and fixed).
- Reviews: Codex 168,141 (voided) + 472,277 (five findings) + 79,692 (correct, 0.96) input tokens; the Claude lenses
  risk, resilience, reliability, readability over the branch (0 findings, about 228,000 input tokens), then risk and
  reliability over the fix (0 findings, about 50,000). No gentle-ai review.
