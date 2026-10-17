A finished work session writes a summary file, closes with it, and the lead reads it and archives the session.
Branch: feat/session-close. Delivery: ask-on-risk. Tests: `node --test` through `js-harness gate`; the commit's tests run on CI.

## Goal
Every work session that finishes leaves one committed summary, `docs/sessions/<date>-<title-slug>.md`, filled from a template a command prints. `notify --kind closed` refuses to close without it. The board lists such a session as "to archive", and the orchestrator skill tells the lead to read the summary and archive the session without asking.

## Why
His words (S0): the lead must always archive finished sessions, and every session must hand the lead a summary when it ends, "para despues nosotros poderle hacer a esto ingenieria inversa". Until now the archiving lived only in a memory note, which is why it was not kept. Today a session's record is spread over its transcript, feature documents and notices, with no single file that says what it was for, what it delivered and what it cost.

## Done when
- `node --test bin/summary.test.mjs bin/notify.test.mjs bin/lib/channel.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs bin/lib/manifest.test.mjs bin/js-harness.test.mjs` exits 0
- `npm run check` exits 0
- JH 24 closes with its own summary, committed and pushed, and the lead archives it (S6).

## In scope / Out of scope
- In: a new `bin/summary.mjs` with its template; `bin/notify.mjs` and `bin/lib/channel.mjs` (`--summary` on `closed`); the board in `bin/lib/sessions.mjs`; the skill text in `bin/lib/manifest.mjs`; `bin/js-harness.mjs` help; README; `docs/sessions/`.
- Out: the GitHub workflow files (the brief says so); archiving itself, which the lead does with the host's `archive_session` tool, since a command cannot reach the app.

## Constraints
- A notice that is refused writes nothing — because a refused close must leave the record as it was, as a refused ready does.
- The summary file is committed and pushed before the close — because the lead reads it from git, and a file on one worktree's disk dies with that worktree.
- The title's slug reuses `openingFileName`'s rule — because two spellings of one title must give one name.

## Effort
high

## Ask me before
Nothing: he is at the PC but the lead said to take recommended answers; product choices below are the recommended ones.

## Specs
- S0 (his words, typed, lead transcript e152c9d8-53bc-4366-8fa5-526b1576bcb6.jsonl line 21112, 2026-10-17T09:20:53Z, read with `js-harness sessions --quote`): "Siempre archiva cuando ya hayan terminado y haz que hagan un resumen siempre que terminen, hay que cementarlo y protocolizarlo, cuando terminen hacen el resumen y te lo pasan a ti, recueda que todo va a ir documentado para despues nosotros poderle hacer a esto ingenieria inversa."
- S1 (the lead's scope, 1): "The summary: one committed file per session, docs/sessions/<date>-<title-slug>.md, from a template a command prints: goal and his words that started it; what was delivered (PRs, commits, feature docs); decisions and whose; what failed and what was learned; what is left and who holds it; cost (time, context, reviews). It is for reverse engineering: facts with their evidence, not prose." Chosen: `js-harness summary template --title "<title>"` prints the template headed by the title and naming its file; `js-harness summary path --title "<title>"` prints only the path.
- S2 (the lead's scope, 2): "notify --kind closed takes --summary <path> and refuses one with no summary file that is committed and pushed (on main or the session's branch)." Chosen: `--summary` is taken only with `closed`, as `--pr` only with `ready`; a closed notice without it is refused; the file must lie under `docs/sessions/`, hold every heading of the template with something under each, and be at the same content in `origin/main` or `origin/<the session's branch>`.
- S3 (the lead's scope, 3): "The board shows a session closed with its summary and not yet archived, as \"to archive\"."
- S4 (the lead's scope, 4): "The orchestrator skill: on a closed notice with a summary, the lead reads it and archives the session with archive_session, no question; the work-session text says to write the summary at the end. The memory stopgap goes once it is in the harness."
- S5 (assumption): the summary command and the notify check share one list of headings, so the template and the check cannot drift.
- S6 (the lead's scope, then): "Then dogfood it: write your own summary, close with it, and I archive you."

## Tasks
- [x] T1 (kind: build) (S1, S5) `bin/summary.mjs`: `template` and `path`, the headings in `bin/lib/summary.mjs`, `titleSlug` taken out of `openingFileName`; registered in `bin/js-harness.mjs`; README. Tests first. Route: inline. RED: `bin/summary.test.mjs` could not load its module (pass 0); GREEN: `bin/summary.test.mjs`, `bin/lib/channel.test.mjs` and `bin/js-harness.test.mjs` 102 of 102.
- [x] T2 (kind: build) (S2) `notify --kind closed --summary <path>`: stored on the notice; refused without it, outside `docs/sessions/`, with a heading missing or empty, or not pushed. Tests first. Route: inline. RED: `bin/summary.test.mjs` could not load `closeProblems`, and 6 tests of `bin/notify.test.mjs` and `bin/lib/channel.test.mjs` failed (pass 206, fail 6); GREEN: the three files 219 of 219. The command requires `--summary`; `newNotice` only checks its shape, since the record and other callers hold closed notices without one. The stop hook's advice (`bin/lib/stop-wake.mjs`) now names `--summary`.
- [ ] T3 (kind: build) (S3) The board's `to archive:` line. Tests first. Route: inline.
- [ ] T4 (kind: docs) (S4) The skill text, both halves, with its tests. Route: inline.
- [ ] T5 (kind: verify) (S6) JH 24's own summary, the close with it. Route: inline.

## Log
- L1 (2026-10-17, the lead's message to JH 24 at 09:22Z, a claim of that session, its quote of his words checked with `sessions --quote`): "new order, a protocol and its mechanism: a session that finishes writes a summary, hands it to the lead, and the lead archives it. [...] Scope (new feature doc odd/tasks/session-close.md with the task contract; tests first): [S1-S4 above] Then dogfood it: write your own summary, close with it, and I archive you. He is at the PC now; take recommended answers."
- L2 (2026-10-17) Map (read-only explorer): `--pr` only on `ready` is enforced in `newNotice` (`bin/lib/channel.mjs:119`); the ready check runs at `bin/notify.mjs:310-318`, before `placeOf` stamps the branch (:433); the board's ended sessions come from `recordOfRows` (`bin/lib/sessions.mjs:1265`) and archived rows carry `where: 'archived'` (`bin/lib/app-record.mjs:42-56`); the skill is `orchestratorSkillContent` (`bin/lib/manifest.mjs:74-184`), its close sentence at :179 pinned by `bin/lib/manifest.test.mjs:2613-2619`. Feature worktree D:/js-harness-worktrees/session-close, cut from origin/main 297c407.
- L3 (2026-10-17) T1's first commit was refused twice, both mine: `check`'s spec row wanted a capability claiming `js-harness summary` (added: "A finished session leaves a summary" in `docs/SPEC.md`), then CI's run 39021347547 failed `bin/readme.test.mjs`, which holds the README's sections to the dispatcher's order (the section moved after `contract`; `bin/readme.test.mjs` 5 of 5). Lesson: a new command's README section goes where its `COMMANDS` entry is, and `bin/readme.test.mjs` runs with the command's own tests.
- L4 (2026-10-17) gentle-ai on 297c407..cee0036 (T1, T2): lenses risk, readability and reliability, approved and acknowledged, lineage review-669122b033233208, findings non-blocking. Being fixed, uncommitted at the context pause: the slug's accent range had been written as raw combining characters by an edit (restored to the escaped range); still to do: placeholders matched exactly per section (an autolink line is content), fenced code ignored by the section parser, "older copy" worded "a different copy", `lf` reused in `summaryProblems`, the default branch read from origin/HEAD with origin/main as fallback, a notify test that runs the real close check on a real clone, and a test pinning `openingFileName('JH 24 · gate más rápido')` to `jh-24-gate-mas-rapido-2e7abe831746.json` (the file on this machine).

## State for a resume
- Worktree D:/js-harness-worktrees/session-close, branch feat/session-close, not pushed. Committed: T1 668ccaa, T2 cee0036. Uncommitted: T3 done and green (`bin/lib/sessions.mjs`, its test; 537 of 537), the slug fix above, this log.
- Next: the L4 fixes, tests first; then T4, the skill text in `bin/lib/manifest.mjs` (:158 the lead archives a session that closed with its summary, listed `to archive`, after reading it; :179 the work session writes the summary from `js-harness summary template`, commits and pushes it, closes with `--summary`), and its tests (`bin/lib/manifest.test.mjs:2616` and :3629); README and SPEC for T3 and T4; commit; gentle-ai on cee0036..HEAD; Codex on 297c407..HEAD; push; PR; `notify --kind ready --pr N`. Then T5: JH 24's summary, committed and pushed, closed with `--summary` (run this worktree's `node bin/js-harness.mjs`, since the installed command has no `--summary` until the land). The memory note session-housekeeping-reminder.md goes once this is installed; the lead holds that.
- L5 (2026-10-17, at the second pause, uncommitted) L4 fixes in progress in `bin/lib/summary.mjs`: done, the fenced-block parser, exact placeholders, `lf` at :28 and their tests (`bin/summary.test.mjs`, with the openingFileName pin, which passes). Left: delete the second `lf` (:76), rename `older` to `differs` with "holds a different copy" (:99-106; the test already expects it), read the default branch from `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` with origin/main as fallback (:98), then the notify test that runs the real close check on a real clone. Then T4 as "State for a resume" says.
- L6 (2026-10-17) L5's `summary.mjs` items done and committed (`bin/summary.test.mjs` and `bin/notify.test.mjs` 166 of 166). Left of L4: the notify test that runs the real close check on a real clone; then T4.
