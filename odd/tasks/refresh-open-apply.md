# JH 121 · refresh: refuse while an open question asks to apply what it would install; and the lead's two misses of 2026-10-31

Locator: `odd/tasks/refresh-open-apply.md` · Engram mirror: `odd/refresh-open-apply/tasks` · Branch: `worktree-refresh-open-apply`
Delivery: one pull request to main per slice · Test runner: `node --test`

## Goal
`merge-queue --refresh-copy` and `--land --refresh-copy` refuse, before they install anything, while an open question
of the project's channel record asks to apply a pull request that the main they would install holds; and the resume
after a compaction lists, for the orchestrator, each work session whose newest notice is `waiting`, with its text.

## Why
On 2026-10-31 at 05:59Z the lead ran `merge-queue --refresh-copy`, which installed main b0c658c with PR 729; its
`install` pruned the js-harness Codex skills and hooks from his `~/.codex` and moved hook trust in his
`~/.codex/config.toml` while question 140, which asked his consent for exactly that apply, was still open. And JH 114
sent `waiting` at 03:06Z; the host compacted the lead minutes later, and the resume listed the open questions and the
background tasks but not the sessions waiting on the lead, so JH 114 sat 50 minutes.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/refresh-open-apply.md` exits 0
- `node --test bin/lib/refresh-consent.test.mjs bin/lib/merge-queue-refresh.test.mjs bin/lib/refresh-copy.test.mjs bin/lib/channel.test.mjs` exits 0
- `node --test bin/lib/resume-record.test.mjs bin/resume.test.mjs` exits 0
- `node bin/js-harness.mjs failures check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: the question's optional `applies` field (`bin/lib/channel.mjs`, `bin/notify.mjs`'s usage), the refusal
  (`bin/lib/refresh-consent.mjs`, `bin/lib/refresh-copy.mjs`, `bin/lib/merge-queue-refresh.mjs`,
  `bin/lib/merge-queue-refresh-now.mjs`, `bin/merge-queue.mjs`), the waiting lines of the resume
  (`bin/lib/resume-record.mjs`, `bin/resume.mjs`), `docs/FAILURES.md`, `docs/sessions/`.
- Out: `bin/lib/reply.mjs` (JH 120 works on it); his `~/.claude`, `~/.codex`, credentials and gentle-ai's config.

## Constraints
- The record keeps reading the notices written before the field, and an older reader keeps reading the new ones —
  because the record is a persisted format (Task Size item 1): `isNotice` takes keys it does not know.
- "Could not tell" refuses as "holds" does — because the refresh's harm (his machine changed without his yes) is worse
  than a refresh run again once he answers.
- Run only the tests the change needs before the gate — because the machine is short of memory.

## Ask me before
Nothing beyond the brief: the field's shape and the exit code are decided here (L3).

## Specs
1. "`merge-queue --refresh-copy` (and `--land --refresh-copy`) refuses, before it installs anything, while an open
   question in the project's channel record asks to apply a change the copy would install. Decide and write how such a
   question is known [...], what the refusal says (the question's number, and that the land itself still lands), and
   its exit code next to 75."
2. "the resume after a compaction (`bin/lib/sessions.mjs` and the SessionStart compact hook) lists each work session
   whose newest notice is `waiting`, with its text, as it lists the open questions."
3. Both mistakes get a `- Seen:` line in `docs/FAILURES.md`, in the class each belongs to or a new one.

## Tasks
- [x] T1 (kind: build) spec 1: the `applies` field, red then green (`bin/lib/channel.test.mjs`).
- [x] T2 (kind: build) spec 1: the refusal in the refresh, a planted open question that turns it red, then green.
- [x] T3 (kind: build) spec 2: the waiting lines of the resume, a planted waiting notice that turns it red, then green.
- [x] T4 (kind: docs) spec 3: the two `- Seen:` lines with their controls.
- [ ] T5 (kind: verify) Codex, the Claude lenses and an independent verifier over each code slice; PR; ready notice.

## State for a resume
Done: every code commit has a Codex record and a lens record (L8, L9). Pushed; PR 736 open; ready notice recorded
2026-10-31T08:41:28Z; the summary committed (`cd53d7d`). Next step (T5): once PR 736 is merged, `npm run check` on
main, mark T5, then `js-harness notify --to orchestrator --kind closed --summary
docs/sessions/2026-10-31-jh-121-refresh-refuse-while-an-open-question-asks-to-apply-w.md "..."`. The merge is the
lead's land. Left: L9's verified "No".

## Log
- L1 (2026-10-31, his request: the lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T07-48-31-030Z-fbafab31.md`,
  "JH 121 · refresh: refuse while an open question asks to apply what it would install; and the lead's two misses of
  2026-10-31"; his answer to question 141, read with `js-harness sessions --quote
  0f71b2c6-cbce-43ca-a031-276a4b2c381f 40996`: "Dejarlo así (Recomendada)", tapped 2026-10-31T07:41:03Z).
- L2 (2026-10-31, searched before writing): codegraph over the refresh's preflight, the question fields and the
  compaction resume; `grep` over `bin/` for `refresh-copy`, `refreshNowRun`, `refreshAfterLand`, `questionFieldsOf`,
  `'waiting'`, `STATUS_KINDS` and exit codes 76 and 77 (none used). The refresh's checks before the install are
  `waitForQuiet`/`lookOnce` (`bin/lib/merge-queue-refresh.mjs`) and the copy's looks (`refreshNow`), and under the gate
  lock `stillQuiet` (`bin/lib/refresh-copy.mjs`); none reads the channel record. A question is
  `{ text, options, waits }` (`checkedQuestion`, `bin/lib/channel.mjs`); `isNotice` ignores other keys, so an optional
  field reads in old and new readers. The resume's question lines are `questionLinesOf` (`bin/resume.mjs`); the
  board's last state of a session is `recordOfRows` (`bin/lib/sessions.mjs`), which needs the roster's transcripts the
  hook does not read. `bin/resume.mjs` and `bin/lib/sessions.mjs` sit at their size ceilings, so the new code goes in
  new modules. No rule of `js-harness rules` names the refresh or the resume's lists.
- L3 (2026-10-31, decided): a question that asks to apply a pull request says so in a field, `"applies": {"pr": <n>}`
  on standard input, kept as is in its notice: the record's own number, never a reading of Spanish text. The refresh
  reads the record's open questions with that field, and for each asks gh for the pull request's head and merge commit;
  main holds it when either is an ancestor of the sha it would install. One that holds it, or one it cannot tell
  (no record read, gh or git failing), refuses with exit 77 (sysexits' EX_NOPERM: his permission is what is missing),
  next to 75 in the usage, naming the question's number and, after a land, that the land landed and stands. It looks
  before its wait for the sessions and the copy's looks, and again under the gate lock right before the install, before
  any wait is stopped. A component form (a question about what `install` writes whatever the pull request) is left out:
  every refresh runs `install`, so it would refuse every refresh while open, and the pull request names what changes.
- L4 (2026-10-31, T1 and T2, tests first): the `applies` tests of `bin/lib/channel.test.mjs` were red on the old
  `checkedQuestion` (6 failing, among them the old wording "only a question takes id, options and waits") and green
  after (64 of 64); `bin/lib/refresh-consent.test.mjs` red with no module, then 9 of 9. Each wiring was planted out and
  turned red: the look under the lock in `refreshCopy` (the exit-77 test, 1 failing), the looks before the wait and the
  copy's looks in `refreshAfterLand` and `refreshNow` (4 failing), and the line in `mergeQueueMain` (the end-to-end land
  test, 1 failing). Then `node --test --test-concurrency=1` over `bin/lib/channel.test.mjs`,
  `bin/lib/refresh-consent.test.mjs`, `bin/lib/refresh-copy.test.mjs`, `bin/lib/merge-queue-refresh.test.mjs`,
  `bin/lib/merge-queue-refresh-now.test.mjs`, `bin/notify.test.mjs` and `bin/merge-queue.test.mjs`: 413 pass, 0 fail;
  `bin/conventions-*.test.mjs`, `bin/lib/spec.test.mjs` and `bin/lib/gentle-ai-absence.test.mjs`: 50 pass. Not tested:
  the `unanswered` line of `refreshNowRun` (`bin/lib/merge-queue-refresh-now.mjs`), whose other effects are this
  machine's processes; it is the same call as the land's, which the end-to-end test holds.
- L5 (2026-10-31, slice A committed): `3fde3ae2`, its pre-commit gate PASS (17 rows).
- L6 (2026-10-31, T3, decided and tested first): the orchestrator's resume lists, before its questions, each work
  session whose newest notice to the orchestrator is `waiting`, by the work number its title names, newest by time then
  by order written (the board's reading, `recordOfRows`); nothing when none waits, and nothing when the record cannot be
  read, which the questions' lines already say. A work session is not given them: the notices are to the lead. The
  code is `waitingLinesOf` in a new `bin/lib/resume-record.mjs`, with `ago` and `cutTo` moved there from
  `bin/resume.mjs`, which was at its ceiling of 1123 lines and is now 1111 (the ceiling lowered with it). Past the
  hook's deadline an orchestrator's "Not read" line names "the work sessions waiting" too.
  `bin/lib/resume-record.test.mjs` red with no module, then 7 of 7; the resume test red with the call planted out (1
  failing), green after; `node --test --test-concurrency=1` over `bin/resume.test.mjs`,
  `bin/lib/resume-record.test.mjs`, `bin/conventions-*.test.mjs` and `bin/lib/gentle-ai-absence.test.mjs`: 132 pass.
- L7 (2026-10-31, T4): `docs/FAILURES.md` gains two entries, both new ids since no entry's text fits:
  `refresh-applied-unanswered` (rule-not-acting: his consent was the rule, and nothing made the refresh read it;
  `land-took-pending-pr` is the land's, a step of his on the console) and `compaction-dropped-waiting` (unseen-state;
  `missed-wake` is the watch missing a session waiting on him). Evidence read in the record: question 140 recorded
  04:37Z by JH 117 and withdrawn 06:47Z "already applied"; JH 114's `waiting` at 03:06:05Z. The compaction and the 50
  minutes are the brief's claim. `js-harness failures check` PASS; both entries `controlled`.
- L8 (2026-10-31, T5, Codex over `2947b29..3d02efb`, 2 parts, 349,918 input tokens, recorded): two P2, both taken.
  (1) `refresh-consent.mjs` failed open in a shallow history, where a merged pull request's commits can be missing
  though main holds them, and took any `cat-file` failure for a missing commit: it now asks `git rev-parse
  --is-shallow-repository` first (shallow, or no clear answer, is not known and refuses) and tells a missing commit by
  `git rev-parse --verify --quiet`'s exit 1 alone (this git: exit 1 for a missing commit, where `cat-file -e` exits
  128 for both). (2) `resume-record.mjs` printed "JH <n>" whatever the project's code: it names the code the title
  carries, and keys sessions by code and number. Tests first: 6 red in `refresh-consent.test.mjs` and 1 in
  `resume-record.test.mjs`, then green (10 of 10, 8 of 8).
- L9 (2026-10-31, T5, the independent verifier, read-only, over a copy of `3d02efbf`): A1 to A4, B1 and B2 held
  (channel 64/64, refresh-consent 9/9, merge-queue-refresh 24/24, refresh-copy 24/24, merge-queue "refresh" 9/9,
  resume-record 7/7, resume 103/103). Its defects 1 and 2 are Codex's two P2, fixed in L8. Defect 4: L6 and the code's
  comment said the newest notice is "the board's reading"; it is not (the board's last state counts only opened,
  waiting, closed and relieved). The brief's words are "newest notice", so the code stays and the claim is corrected:
  a later note or ready ends the wait in the resume, not on the board. Defect 3, in part: a question closed only by an
  answer no transcript confirmed now stays open to the refresh (the sender's claim is not his yes), test red then
  green. Its other part stays open (Left): a verified "No" closes the question, and the refresh then installs what he
  declined, since nothing reads what the answer says; reading it needs the question to name its yes option, a design
  change beyond spec 1's "open question". Minor ones taken: gh runs with a 30 s limit, and `refreshNow` turns a throw of
  the early look into the exit-77 refusal (both tests red then green). Not taken: a `waiting` of a session that never
  closed stays listed whatever its age, as the board keeps it.
