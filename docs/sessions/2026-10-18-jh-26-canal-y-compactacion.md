# JH 26 · canal y compactación

File: docs/sessions/2026-10-18-jh-26-canal-y-compactacion.md. It covers the stretch after the clear of T2 test 6
(transcript `a6db53fe`). The work before the clear (`odd/tasks/wake-and-flag.md`, pull requests 349, 351 and 352)
was closed to the lead at 2026-10-17 07:59Z, as B3 in the feature document's test 6 entry says.

## Goal
Run T2 test 6 of `odd/tasks/session-channel.md` on this session itself (a `clear_session`, then come back from
files only), then test 4 as the document allows, and close T2. The opening read was `js-harness sessions --opening
"JH 26 · canal y compactación"`, exit 0; the channel records the reading at 2026-10-17T22:37:20Z.

## The user's words
"Sí, que la corra (Recomendada)", his answer to the lead's question on test 6 (`e152c9d8`:20292, 08:10Z, as quoted
with `sessions --quote` in the feature document's entry "2026-10-17, JH 26, T2 test 6"). The question named JH 5;
the lead moved the run to JH 26.

## Delivered
- Pull request 424, merged 2026-10-17T22:53:15Z (`gh pr view 424`): commit `ad0868f9` records the After of test 6
  (one line per B1-B7, its source, the first prompt at 22:36:57Z, the verdict) and test 4, marks T2 done in
  Tasks, and adds the two results to section 13; merge commit `4166f0af` takes `main`.

## Decisions
- Test 4 read from transcripts, not run: this session's, from the feature document (section 13 and Progress of
  2026-10-15 23:32 say it does not need him; since T16 no session opens where he does not see it).
- The merge conflict with `main` kept both Progress insertions, `main`'s first: this session's.

## Failures and lessons
- A clear starts the new transcript with the `SessionStart` source `startup`, so no hook of this project runs
  after it (the resume hook matches `compact`, the rules hook `compact|clear|resume`), and the session opens in
  `D:\js-harness` on `main`, not its worktree. Found in this transcript's first hook records. Nothing changed for it
  yet; it is recorded in the test 6 entry for whoever builds on it.
- `js-harness doctor --hook` was cancelled at its 10 s timeout at this session's start (11,180 ms). Not changed.
- An inline `node -e` with conflict markers in its text found nothing under Git Bash; a script file did. A `;`
  after a failing `&&` chain staged the file with markers once, unstaged by the fix before any commit.

## Left
- Whether a js-harness hook runs in a remote-control session after a compaction: not shown (test 4's entry);
  it needs a remote session he opens. Held by the lead.
- What to build on test 6's result (a hook on `startup` that reads the session's opening, or a worktree cwd): no
  task yet. Held by the lead.

## Cost
- Time: opening read 2026-10-17T22:37:20Z; ready notice 22:46:47Z; this closed notice after 2026-10-18T06:47Z (by `date`), after an
  eight-hour `wait --notice-to 26` that no notice ended.
- Context: 30% at the ready notice.
- Reviews: gentle-ai assess on `ed04d7cf..ad0868f9`, passive, not due; no Codex (no code).
- Gate runs: two commits (`ad0868f9`, `4166f0af`), both passed; this summary's commit is the third.
