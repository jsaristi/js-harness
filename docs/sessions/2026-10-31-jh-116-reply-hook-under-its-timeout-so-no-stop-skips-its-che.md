# JH 116 · reply hook: under its timeout, so no stop skips its checks

File: docs/sessions/2026-10-31-jh-116-reply-hook-under-its-timeout-so-no-stop-skips-its-che.md.

## Goal
Measure where the reply Stop hook (`js-harness reply --hook`, 5 s timeout) spends a lead's stop, then make its p90 on
a lead-sized transcript and channel at most half its timeout without dropping or weakening any check, with a test that
holds the budget. Opened by the lead's brief
`C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T03-00-48-294Z-b392e219.md`, from the JH 115 verifier's
finding (`odd/tasks/lead-duty-checks.md` L12: 58 timed-out runs in ~499 stops of the lead's transcript 0f71b2c6).

## The user's words
None in this session: the brief is the lead's. The only message of the session points to the brief (this session's
transcript, line 1).

## Delivered
- Pull request 732 (https://github.com/jsaristi/js-harness/pull/732), open, ready notice recorded
  2026-10-31T05:10:45Z:
  - `odd/tasks/reply-hook-latency.md`: contract, specs, `## Measure` before and after with each command, Log L1–L10;
  - `bin/reply.mjs` (`stopIo`: one read of each file, one parse of the record, one git answer a stop), the buffer read,
    `bin/lib/stop-wake.mjs` (windowed forward search, title before marks, empty-needle guard),
    `bin/lib/person-times.mjs` (one regex pass), their tests (b42532d7, 7f06e840);
  - `bin/reply-budget.test.mjs`, the budget on a lead-sized fixture; `scripts/reply-hook-time.mjs`, the measure
    (b42532d7, 8c746b16, c76d97d1);
  - `docs/FAILURES.md`: one more sighting each of `edit-during-review` and `commit-attribution-from-host`.
- Measured: the lead's real files, in turn, 15 runs: p90 1798 → 955 ms, p50 1412 → 663 ms, the same answer byte for
  byte. Fixture: lead p90 2231 ms (under load), work p90 807 ms, budget 2500 ms.
- Question 138 to the lead (recorded 2026-10-31T03:56Z): raise this hook's timeout from 5 to 15 s.

## Decisions
- This session: skip-unchanged-input rejected (the hook writes nothing to compare against), `## Measure`.
- This session: a failed git answer is kept for the stop (asking a timed-out git again costs each check 2 s), L9.
- This session, after the verifier: the project asked of git again, once a stop, instead of read from the `.git`
  files, which named another project for a removed worktree or an empty `.git` folder; cost one git call, L9.
- This session: the budget does not hold the PowerShell parser's start (a separate process, 1.4–2.3 s), stated in the
  test's header and the feature document; follow-up T8 for the lead.
- His (pending, question 138): the hook's timeout.
- gentle-ai's Stop hook offered the whole branch four times; its status was run and nothing started (`CLAUDE.md`).

## Failures and lessons
- The first commit carried an AI attribution line against `CLAUDE.md`; amended before any push.
- `odd/tasks/reply-hook-latency.md` was edited while Codex reviewed; part 3 of 3 was discarded (128,821 input tokens)
  and run again. Recorded in `docs/FAILURES.md`; the control is the check that refused the record.
- A failed gate was run again before its failure was read (only the last 15 lines had been looked at); the second run
  wrote its whole output to a file, and the failure (the new test reached no parser in WSL) was fixed from it.
- The host reaped the gate and the notice wait for low memory; the gate's orphaned check was left to finish and read.
- The first after-measure used a files-first project lookup that the verifier showed was not git's answer: a claim of
  "same answer" checked on the lead's files only, not on edge inputs. The verifier's mapping of inputs found it.
- The budget fixture missed two paths (the return check's publish search, the command-block check) until the verifier
  said so; widening it found the parser's cost, which no earlier measure had seen.

## Left
- Merge of PR 732: the lead's.
- Question 138 (timeout 5 → 15 s): his; on a yes, `replyHookEntry`'s timeout and its test change on a branch, and his
  settings are changed by him or the lead.
- T8: the PowerShell parser's start on a stop whose reply hands him a block; the lead's to open.
- The in-situ p90 after the release is installed: `node scripts/reply-hook-time.mjs in-situ <transcript>`.

## Cost
- Time: brief at 2026-10-31T03:00Z; ready notice at 05:10Z. One host compaction at about 03:58Z.
- Context at the ready notice: 50% of the window (the notify's own reading).
- Reviews: Codex 5 runs (one discarded part, one refused at no cost; recorded: `f91cbcc..3543c9f` 3 parts 292,323
  input tokens, `3543c9f..8c746b1` 67,312, `8dd55c8..7f06e84` 96,129); Claude lenses 5 runs, 0 findings in all; one
  independent verifier (102,801 tokens).
- Gates: 6 pre-commit gates (one failed in WSL, fixed), one orphaned gate read, one pre-push.
