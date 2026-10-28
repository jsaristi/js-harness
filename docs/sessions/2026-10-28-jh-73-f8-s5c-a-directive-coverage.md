# JH 73 · F8 S5c-a: directive coverage, the mechanism

## Goal
Build S5c-a's mechanism, the reverse-engineering document's section 14.5 items 1 to 5 with the bootstrap, `init`
and the project binding, from the lead's brief
`~/.js-harness/background/briefs/2026-10-28T17-34-30-440Z-2b199716.md`, with no paid run: every eval trial is his.

## The user's words
None in this session; the brief is the lead's, quoted in `odd/tasks/f8-s5c-a-coverage.md`, L1.

## Delivered
- PR 638, `f8-s5c-a-coverage`, open: spans and ties, the coverage register with each rule's control, `rules
  coverage` (`--json`, `--strict`, `--refresh`, `--prove`), the `rules check` refusal of a new gap, the
  `current-without-rule-<id>` arm and `evals/rule-proof.mjs`'s records with their free check, a project rule's
  `control` and a project's `rules coverage`, and two eval cases, `rule-reuse-first` and `rule-away-autonomy`.
- Feature document `odd/tasks/f8-s5c-a-coverage.md`: T1-T7 and T4b checked, Log L1-L10, `## Paid runs`.
- The roadmap's S5c-a state line.

## Decisions
The session's, in the feature document's L3; with the lead: the `init` baseline line is a ready patch for JH 68
(L5, 13:49), and the lens skip waits for the lead's fix of `lens-review` instead of a fourth run (L10, 15:14).

## Spent
- Evals: nothing. P1-P4 are ready commands, 28 trials, about $15.70 to $18.20.
- Codex: 947ac91..f39c41a in 8 parts (1,690,061 input tokens) after a run broken at part 2 (353,663, L6) and one
  refused at 8 parts (nothing); the recheck f39c41a..f9c1057 (130,726); again 62f4a62..d095412 (353,905); the
  recheck d095412..37cdab2 (38,018).
- Claude lenses: six runs on sonnet, about 9,000 to 90,000 input tokens a lens.
- One independent verifier on slices 1-2 (L4).

## Failures and lessons
- A test file was written while Codex reviewed, so the run recorded nothing after two parts of eight (353,663
  input tokens): `docs/FAILURES.md`, `edit-during-review`, a `Seen:` line. No file was written during a review
  after it.
- Codex found ten defects across its runs that the tests had not, among them proofs that a red or missing test
  passed, a move that took every entry of one hash, and records stamped with a checkout's digests rather than
  the runs' (L7-L9). Each fix came with the test that failed before it.
- Three lens runs over `f9c10579..37cdab21` each cut one lens's answer short; the lead holds it as a defect of
  `lens-review` and is fixing it (L10).

## Left
- The lens run over `f9c10579..37cdab21`, once the lead's fix lands and the copy is refreshed; then the `ready`
  notice for PR 638.
- The paid runs P1-P4, his to start.
- 13 to 23 more eval cases section 14.4 counts, a later session's.
- The `init` baseline line (L5), routed to JH 68.
