# JH 169 · audit unit 4: refusals with a way past

## Goal
Work unit 4 of the audit triage (PR 805): close M11, M12, M13, M14 and M27 of the Fable 5.2 audit, five refusals
that each had a way past. Opened by the brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T09-10-57-018Z-1ef3d85e.md`; channel notice of
2026-11-10T09:10:57.587Z (`sessions start`).

## The user's words
"Your brief is in C:\Users\Oficina\.js-harness\background\briefs\2026-11-10T09-10-57-018Z-1ef3d85e.md: read it whole
before anything else, and do the work it gives you. Its last section says how you report." (transcript
`C:\Users\Oficina\.claude\projects\D--js-harness--claude-worktrees-audit-u4-refusals\34409f55-1cd2-497f-b013-9d86924d2b89.jsonl`,
the session's one user message). The brief's asks are quoted as specs 1-5 in `odd/tasks/audit-u4-refusals.md`.

## Delivered
- PR 811, ready (notice of 2026-11-10T11:06:58.241Z), branch `worktree-audit-u4-refusals`, 13 commits from
  d52ab74c to 8eeb1c09 plus this file.
- Feature document `odd/tasks/audit-u4-refusals.md`: contract, depth pass, specs 1-5, T1-T6 ticked, Log L1-L7.
- M11 eb1ecf8a, 130b2373 (`bin/lib/test-run-warning.mjs`); M12 ea621c72, 3b2ea1c1, de9e7c10 (`bin/codex-review.mjs`,
  `bin/lib/codex-review-recheck.mjs`); M13 ee0fd35a, 8ef687f8, 130b2373, 8eeb1c09 (`bin/lib/contract.mjs`,
  `docs/RECORDS.md:108`); M14 cf6a38ed (`bin/check.mjs`); M27 e6b3760b, 8f6b893f (`.github/workflows/gate.yml`,
  `scripts/github-workflows.test.mjs`, README.md).
- Gate run 42796545026: windows job, `bin/remote.test.mjs` 119 tests, 119 pass, 0 skipped, 48 s. Run 42802554026:
  check and windows both success.

## Decisions
- M12 bound (this session, the brief handed it over): only a change whose three reviews left findings open is
  refused, and the refusal's own route stays for new code. Recorded in the feature document, L3.
- M27 (this session, by what the repo does, as the brief asked): a Windows job in gate.yml, not the local Windows
  run before the WSL mirror; every commit's gate goes to GitHub first (`bin/lib/ci-gate.mjs`). L4 and depth pass
  item 5.
- V1, V3, V4 of the verifier left unfixed as out of scope and reported to the lead (ready notice, PR body, L6).

## Failures and lessons
- The first M14 commit's GitHub gate went red: `bin/check.mjs` reached 1941 lines against its 1938 ceiling
  (`bin/conventions-structure.test.mjs`). Fixed by rewrapping a comment; the conventions tests now run before each
  commit here.
- A reply ended with no state line and the Stop hook turned it back; every reply since ends on one.
- The first Goal said "`--again` cannot buy a fourth Codex review of a change", more than L3 decided; the verifier
  found it (V1) and the Goal now names a change whose three reviews left findings open.
- The Log first said commit bodies record each red run; `git log` showed they do not, and L5 says so.
- Codex's estimate for the last slice was 80,000-120,000 input tokens; it used 171,128.

## Left
- V1: repeated `--again` full reviews outside a three-review chain, or after one recheck, still run; a decision on
  the owner's rule (lead).
- V3 (preexisting): without `--again`, a start behind the chain reviews it a fourth time (lead).
- V4: an `--again` base at a reviewed head never rechecked skips the check (lead).
- `cmdShellGap` still reads a doubled `""` and `^"` as a quote toggle; both refuse more, never less.
- Merging PR 811: the lead's, after the owner's yes.

## Cost
- Time: 2026-11-10T09:10:57Z (opening) to about 11:10Z; one compaction by the host at about 10:38Z.
- Context at the ready notice: 21%.
- Codex: four reviews and one recheck (302,320 + 32,596 + 224,957 + 59,329 + 171,128 input tokens).
- Claude lenses: four runs, 0 findings in all; one verifier sub-agent (Opus 5.5, high, read-only).
- Gate runs: one per commit through the pre-commit hook, plus `npm run check` at 8eeb1c09 (PASS).
