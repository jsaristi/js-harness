# Throughput protocol: the command and recorders

## Goal
Build the throughput review protocol the user approved on 2026-10-17, as Part 2 and "Version 2" of the plan describe, in four units: the `js-harness throughput` command and its snapshots, the recorders B3-B6, the daily trigger, and section 7 of the protocols skill. The brief came from the lead (JH ORQ) and is L1 of `odd/tasks/throughput-review.md`. The opening read was "Throughput protocol: the command and recorders".

## The user's words
"Sí, aprobalo (Recomendada)": the user's approval of the plan on 2026-10-17, as the lead's brief quotes it (L1 of `odd/tasks/throughput-review.md`). The transcript line was not read in this session: the brief came from the lead.

## Delivered
All merged on 2026-10-17:

| PR | Merged | What |
| --- | --- | --- |
| 357 | 04:58Z | `js-harness throughput`: the table, `snapshot`, `status`, `--against` |
| 359 | 05:29Z | a copy of the gate log made before its day settled keeps the day partial |
| 362 | 05:50Z | B3: a CI gate records its red tests and its fallbacks in the gate log |
| 365 | 06:35Z | rows from the B1, B2 and B3 records |
| 368 | 06:53Z | B5: per-test-file times and their row |
| 373 | 08:53Z | B6: gentle-ai review starts and ends, and their row |
| 378 | 09:03Z | B4a: the questions row |
| 380 | 09:38Z | the four rules `throughput-backfill-days`, `throughput-compare-days`, `throughput-quiet-days`, `throughput-quiet-runs` |
| 384 | 10:35Z | T4, the daily trigger: `throughput reviewed`/`shipped`, the `DUE:` lines, the heartbeat's backfill and DUE ending. T5, section 7 of `js-harness-protocols` |
| 389 | 10:50Z | the feature document records PR 384 and what is left |

Feature document: `odd/tasks/throughput-review.md`, 4/5 tasks (`js-harness progress`). T3 is open only for B4b.

## Decisions
- **The user:** approved the protocol and its plan on 2026-10-17 (L1).
- **The lead:**
  - B6 and B4a went first; the four rules went on their own `rule/` branch once PR 377 freed the slot (messages of 08:31Z and 08:55Z, L29-L32).
  - The user is away, so take the recommended answers.
- **This session:** each one is recorded in the feature document.
  - T4's design: outcomes in `outcomes.jsonl`, a pure `throughputDues`, the DUE ending on the stall's doubling (L33).
  - T4's two units shipped in one commit and PR, and T5 in the same PR because it cites `throughput reviewed` (L34-L35).
  - The review line reads from the day after the last recorded review.
  - The DUE lines change no exit code of `status`.
  - The heartbeat never keeps a day the live gate log does not reach (L34).
  - The protocols skill test now searches a cited rule's value with its unit, so numeric rules can be cited by id (L35).
- **Codex's two findings** on T4 were taken and fixed in 9c5eda8a (L36).

## Failures and lessons
- **PR 373 was left out of the land:**
  - Its gentle-ai line did not name the branch's commits (lead's message, 08:31Z).
  - Fixed with an evidence line covering b6ad179b, and checked with the land's own `gentleAiEvidence` before the push.
  - Since then, every PR of this session ran that check first: `missing: []` for 906afea1..36ce6cf6.
- **Stale "Read by" lines in `docs/RULES.md` failed the gate twice** (`bin/rules.test.mjs:518`):
  - On the compare-days commit (L32) and on T4's first commit (L34). `rules change` and the earlier render ran before the code read the rule.
  - Lesson: run `js-harness rules render` after any edit that adds a reader of a rule, before committing. Each miss cost one gate run.
- **A Git Bash heredoc ate a backslash** in a `SOURCES` literal and broke it. Since then, text with backslashes goes through Edit or Write.
- **`rules change` refused twice:**
  - First while another `rule/` branch held a change (PR 377). The patch was kept in the lead's notes and proposed after 377 landed.
  - Then because main had moved. Merging origin/main fixed it.
- **A wrong session link:** in a reply of this session, JH 26 was linked as `local_a8ef1e36-…`, a notes folder id. Its session is `local_e9636dc4-bc88-49e1-a28f-5cdaeef34d3f` (the linked-sessions note). Links now come only from that note or a tool result.

## Left
- **B4b:** the shown and answered times of an answer in `notify` (`bin/notify.mjs`, `bin/lib/channel.mjs`).
  - It is the channel session's code (JH 26). It waits for that session's agreement, which was asked by message and has had no answer.
  - The Next step of `odd/tasks/throughput-review.md` says how to build it. Until then the questions row says those times are not recorded.

## Cost
- **Time:** from 02:39Z (the first transcript record) to 10:53Z on 2026-10-17. The host compacted the session twice (07:34Z and about 10:02Z).
- **Context share at the end:** not read.
- **Gate runs:** 35 recorded under this session in the gate log (`~/.js-harness/gate-log`, start events with session c01411c5).
- **gentle-ai:** assessments only, every slice medium or passive and not due. No review was started, and Stop-hook offers of the whole branch got the read-only status only.
- **Codex:** these ranges are recorded in `.git/js-harness/codex-reviews.jsonl`, plus those named in the bodies of PRs 357-368:
  - 459a882..b6ad179
  - 222539c..ecacb89
  - 8e96779..b28f3fa
  - 9aee330..2903ba6
  - 30517a3..49de368, with two P2 findings, both fixed
  - 49de368..9c5eda8
