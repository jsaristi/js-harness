# JH 133 · fix PR 758's docs row

## Goal
Turn PR 758 (audit-pack-records, JH 132's T5) green again after it was red in the merge queue on main 13c6153 with
"FAIL docs 1 finding in the index of docs/README.md, the reading plan, the records or the cross index". Opening read:
the lead's brief `~/.js-harness/background/briefs/2026-11-02T16-20-50-587Z-f66d2bc4.md`.

## The user's words
None in this session: it was started by the lead with `js-harness sessions start`, from the brief above
("fix PR 758's docs row (small fix, no feature document)").

## Delivered
- 27d4b1d1 on audit-pack-records (PR 758, ready): the merge of origin/main 13c6153, whose resolution adds
  `bin/lib/merge-queue-refresh-now.mjs` to the `files` of the `<*>.jsonl` entry of `NOT_RECORDS`
  (`bin/lib/docs-records.mjs:23`).
- Notice `ready --pr 758` recorded (channel record, 2026-11-02T16:28:16.745Z).
- After a restart, the lead's second brief (`2026-11-02T16-34-55-362Z-8543d40c.md`): PR 758 red on the tests sensor in
  WSL2, "the harness's own table of records holds against its source". 2f9a312 on audit-pack-records (PR 758, ready):
  the test reads bin's files from the disk when there is no `.git` (`bin/lib/docs-records.test.mjs`, `sourceFiles`),
  with a test of that listing written first and seen red.

## Decisions
- This session: the finding was a false positive, not a missing row of SPEC's table, since
  `bin/lib/merge-queue-refresh-now.mjs:76` joins `${id}.jsonl` under `~/.claude/projects` to read Claude's transcripts,
  the reason the `<*>.jsonl` entry already gives for the four other readers. Recorded in the merge commit's body.
- This session: the fix went into the merge commit as its resolution (a semantic conflict between main and the
  branch), so `codex-review` reviewed it as what was written in the merge.

## Failures and lessons
- The record check's `files`-scoped exceptions go stale when main adds a new reader of the same host files; the
  check caught it at the merge queue, as designed. Nothing changed: the failure is the check working.
- T5's repository test listed its sources with `git ls-files`, and the gate's WSL mirror is synced with
  `--exclude=/.git` (`bin/lib/gate-wsl.mjs:111`), so the listing was empty there and every row came out as a finding.
  Found by reproducing the mirror (rsync without `.git`, the test run with WSL's node). It is not caught before the
  merge queue: not checked why the gate on commit did not catch it (it says a commit's tests go to GitHub's machines
  first). The fix keeps the test meaningful on Linux rather than skipping it.
- The gentle-ai review status that the Stop hook asked for timed out twice (`operation_timeout`): 13c6153..dea3763
  "not reviewed" by gentle-ai, told to the lead in a note.

## Left
- PR 758 to land through the merge queue: the lead.
- docs/README.md's auditor model line not touched: the owner's answer on the model is pending.

## Cost
- From the brief (its file name's stamp) to the closed notice, written at 11:29 local; about 16% of the context at the
  ready notice.
- Codex review 75d0ea1..27d4b1d: "correct" (0.99), 36,579 input tokens. Claude lens reliability: 0 findings,
  97,861 input tokens. One gate on the merge commit (PASS) and the pre-push checks (PASS).
- Codex review dea3763..2f9a312: "correct" (0.97). Claude lens reliability: 0 findings, 10,555 input tokens. One more
  gate on commit (PASS).
- Checks: `node bin/js-harness.mjs docs check` PASS (44 records held); `node --test bin/lib/docs-records.test.mjs` 16/16
  on Windows and 16/16 in WSL2 Ubuntu on a copy synced without `.git`, as the gate's mirror is.
