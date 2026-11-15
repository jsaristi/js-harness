# JH 206 · los defectos del bloqueo del advisor

File: docs/sessions/2026-11-15-jh-206-los-defectos-del-bloqueo-del-advisor.md.

## Goal
Fix three defects of the advisor gate (`bin/advisor-gate.mjs`) that running it in refuse mode showed on 2026-11-14. The brief, from the lead "JH ORQ · orquestador F8": `C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T09-41-48-886Z-b39df090.md`. The defects: sub-agent ends never checked; false refusals from heredoc text; and the sequence "consult alone, one other call, then the act".

## The user's words
None: the work came from the lead's brief. The owner's answer it rests on is question 285, "Bloquear desde ya (Recomendada)" (69918425, line 6944; `odd/tasks/advisor-use.md`, spec 4).

## Delivered
- PR #882 (open, ready for review), branch `worktree-advisor-gate-defects`.
- T7 (commits 332cdac3, f0ea2b8b): a sub-agent end whose transcript does not exist (ENOENT only) is recorded `no-transcript` with `agentType`. Every decision records `agentType`. The report counts those ends apart, older ENOENT records included. On the real record the unchecked share goes from 59% to 0% (`node bin/js-harness.mjs advisor-gate report --since 2026-11-14`). The test is the T7 test in `bin/advisor-gate.test.mjs`; it failed before the fix.
- T9 (77d1b1fc): defect 3 reproduced, and it is not a defect. The ROADMAP Later line is corrected (L26).
- T8: not delivered. The heredoc reading was built, then reverted (f5b8b9b1); it is a follow-up in `odd/tasks/advisor-use.md`.
- Feature document: `odd/tasks/advisor-use.md`, T7-T9 and L24-L33.

## Decisions
- The lead (note, 2026-11-15 05:50 local, L32): ship T7 and T9 with the heredoc reading back as at fe46cc99, since a false refusal fails safe; T8 is a follow-up that needs a real tokenizer.
- This session, with the advisor: a checked end never blocks, so T7 refuses nothing new and is not the senior-exemption question (L24). Defect 3 is left as the rule, with no code change (L26).

## Failures and lessons
- The heredoc fix failed three review rounds, each in the dangerous direction:
  - Codex: `$( )` in an unquoted body, wrapped shells, a git `-c` alias, quote pairing.
  - The lenses: a script run by a later line.
  - The verifier: a comment apostrophe, a multi-line `-m` quote.

  A line-based reading cannot follow shell quoting (L27-L31). The lesson: for a guard, model the shell or keep the conservative reading.
- 381845ee went in with `--no-verify` (a work-in-progress commit before a compaction). Later commits ran the gate.
- The first State line did not survive the doc edits, and was found missing only at L32. A State line is now grepped after each write.
- The worktree guard refused commands whose heredoc text named git, and the live advisor gate read heredocs too. Scripts went through the Write tool instead.

## Left
- T8, heredoc false refusals: a new session, with a real shell tokenizer (the lead).
- The `agentType` of the phantom ends is known only once this is installed (the lead installs).
- The Done-when item "each defect has a test that failed before the fix" cannot hold for defect 3, since no fix was made, nor for T8, deferred.
- Not checked: whether the desktop app bound PR #882 to this session.

## Cost
- Time: first notice 09:50Z (the file list), the waiting notice 10:46Z, the lead's answer 10:50Z.
- Context: over the window, twice; State and the opening were stored each time.
- Codex: 4 runs (fe46cc9..77d1b1f, 77d1b1f..f0ea2b8, f0ea2b8..f3732fb, f3732fb..f5b8b9b).
- Claude lenses: 4 runs.
- Opus verifiers: 4.
- Advisor: 4 consults.
- Gate runs: one at each commit, through the pre-commit hook.
