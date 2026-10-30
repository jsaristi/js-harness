# Memory notes

The 23 notes doctor's `memory-rules` row flags are each placed where their rule lives, and the ones he approves are
deleted, so the memory folder holds no rule. Branch `docs/memory-notes`; test runner `node --test`; delivery
`single-pr`.

## Goal
Every `feedback` or `project` note of this project's Claude Code memory folder is either gone, its rule living in the
repository, or kept for a reason doctor's row and this document name.

## Why
`js-harness doctor` read `memory-rules stale` with 23 notes on 2026-10-30. A rule kept in memory is read by an agent
that may or may not recall it (`bin/lib/memory-rules.mjs`, header); the move pass of 2026-10-22
(`odd/tasks/memory-feedback-home.md`) already moved most of their content and left pointers, which still count as
rule notes.

## Done when
- `npm run check` exits 0
- `js-harness rules check` exits 0
- `js-harness memory verify <stamp> --approved <the notes he approved>` exits 0 for the pass that deletes them
- Doctor's `memory-rules` row lists only the notes he kept, each with its reason in "Classification" below.

## In scope / Out of scope
- In: this document, `docs/FAILURES.md` (the failures two notes record), `docs/ROADMAP.md` (the decision one note
  records), and, after his yes, the notes he approves and their lines of `MEMORY.md`.
- Out: any rule change (his typed words are needed, listed below); `~/.codex`, gentle-ai's config and credentials.

## Constraints
- No memory note is deleted or edited before his yes, carried by the lead — because the brief says so and memory is his.
- The memory backup is taken before any deletion — because a deleted note cannot be recovered otherwise.
- Every quotation a deleted note holds is in a home `memory verify` reads first — because on 2026-10-23 a list said the
  repository held two notes' lessons and `memory verify` refused them (`odd/tasks/memory-feedback-home.md`, L13).

## Ask me before
Deleting or retyping any memory note: one question, sent through the lead.

## Specs
- S1 The lead's brief of 2026-10-30 (JH 100), not his words: "place each note by the protocol 'Changing a rule, a new
  one included' of the js-harness-protocols skill (a check first, else a line of AGENTS.md or CLAUDE.md, else a
  protocol), then delete the note."
- S2 The same brief: "Some notes are facts, not rules (reinstall-checklist, plan-max-20x, claude-models): say whether the
  check should take them as reference notes instead, and if the check is wrong about them, fix it test first."

## Tasks
- [x] T1 (docs) S1: class each note with its home and evidence ("Classification"), route inline, commit with this doc.
- [x] T2 (docs) S1: place what had no home: two `- Seen:` lines in `docs/FAILURES.md`, his 2026-10-14 decision in the
  roadmap row "First version's scope", and every quotation of a note to delete in "Moved out of memory".
- [x] T3 (verify) S2: the check is right about the fact notes; no code change (see "The fact notes").
- [ ] T4 (docs) S1: the question to the lead, one notice; then, after his yes, the backup, the memory pass and its verify (the 17 pointers and the retype done, L5; the 5 placed notes after this branch lands).
- [ ] T5 (docs) the summary under `docs/sessions/`, the ready notice with the pull request.

## Classification

Every rule id below was read with `js-harness rules <id>` on 2026-10-30 (live unless said). Every note's quotations
were run against the homes `memory verify` reads (`bin/memory.mjs` `homesText`) with `extractQuotes` of
`bin/lib/memory-pass.mjs`; the ones missing then are now in "Moved out of memory".

### Pointers: the rule has a home, the note only names it (17)

The move pass of 2026-10-22 shrank these to pointers; what they held is in `odd/tasks/memory-feedback-home.md`,
"Moved out of memory", and every quotation of theirs is found in a home except the one moved below.

| Note | Its rule's home now |
|---|---|
| ask-before-he-leaves.md | `rule:away-autonomy` (bin/lib/manifest.mjs), successor of the rule the note names, retired 2026-10-27; `rule:questions-one-place` |
| background-tasks-declare-and-dismount.md | `rule:background-task-declared` (bin/lib/manifest.mjs) |
| cross-session-prompts.md | `rule:session-prompts` (bin/lib/manifest.mjs) |
| dogfooding-rules-go-in-the-harness.md | `rule:rules-live-in-the-harness` (bin/lib/protocols-skill.mjs); `rule:memory-feedback-home` (check: bin/lib/memory-feedback-guard.mjs) |
| double-review-before-proposing.md | `rule:double-review` (bin/lib/protocols-skill.mjs:102, bin/lib/manifest.mjs:140) |
| effort-by-kind-of-work.md | `rule:recap-effort-line`, `rule:session-effort` (check: bin/lib/guard.mjs), `rule:subagent-effort`, `rule:subagent-writer-model` (check: bin/lib/guard.mjs) |
| guide-not-literal.md | `rule:wording-is-the-need` (bin/lib/project.mjs) |
| mistake-report-four-parts.md | `rule:mistake-report` (bin/lib/protocols-skill.mjs); CLAUDE.md:55-58 |
| notify-when-done.md | `rule:announce-finished` (bin/lib/manifest.mjs); `rule:context-pause` (check: bin/lib/sessions.mjs) |
| one-prompt-per-reply.md | `rule:reply-five-states` (check: bin/lib/reply.mjs, the Stop hook); `rule:questions-one-place`; `rule:question-context` |
| orchestrator-autonomy-charter.md | `rule:lead-charter` (bin/lib/manifest.mjs:153); `rule:codex-review-rate` (check: bin/lib/codex-review-allowance.mjs); `rule:context-pause`; `rule:questions-one-place` |
| questions-with-buttons.md | `rule:questions-one-place` (bin/lib/project.mjs:401); `rule:question-context`; `rule:reply-five-states` |
| reports-spanish-visual.md | `rule:reports-spanish-visual` (bin/lib/protocols-skill.mjs:103, bin/lib/project.mjs:417) |
| restart-announce-caps.md | `rule:restart-announce` (bin/lib/manifest.mjs:194, "The restart") |
| review-consent-pregranted.md | CLAUDE.md:77-83, "Review is not his to decide: the consent he granted for every candidate here is his standing selection"; the AGENTS.md phrase the note quotes left AGENTS.md since |
| session-housekeeping-reminder.md | `rule:session-housekeeping` (bin/lib/manifest.mjs); `rule:session-stall` (check: bin/lib/sessions.mjs, bin/loop.mjs) |
| status-report-protocol.md | `rule:status-report`, `rule:report-table` (bin/lib/manifest.mjs) |

### Agents' lessons and one decision of his, now placed (5)

| Note | Its home now | Placed by this branch |
|---|---|---|
| board-rows-through-notify.md | `rule:live-board`, bin/lib/manifest.mjs:146: the board's rows are the record's notices, pushed by `js-harness sessions live` on every wake, so no key or time is typed by hand; the failure, `docs/FAILURES.md` `hand-made-output` (control: bin/template.test.mjs) | a `- Seen: 2026-10-27` line in `hand-made-output` |
| conflict-merge-costs-review.md | a check: `mergeStart` of bin/lib/codex-review-coverage.mjs:462 reviews a merge of main by what was written in it (odd/tasks/merge-review.md); `docs/FAILURES.md` `merge-review-covers-main`, control since 2026-10-16. The note's premise, a whole-branch re-review of about 390,000 tokens, no longer holds, so "move the change instead of merging" has no cost left to save | the quotation, below |
| corrections-before-date.md | his decision, now in `docs/ROADMAP.md`, row "First version's scope": his words of 2026-10-14, read with `js-harness sessions --quote ffe99ebf-72fb-48da-a79b-e7db21a20b3f 5853`, and his tapped "Seguir sumando" at line 5837 | the roadmap row; the note's "how to apply" (a correction before a new capability in every queue) is the lead's reading, not his words: optional rule below |
| hidden-load-slows-gates.md | checks: a gate names the processes that spent the processor (bin/check.mjs `watchRun`, bin/lib/machine-busiest.mjs `watchBusiest`) and samples the load once (`docs/FAILURES.md` `outside-load-unseen`); the language server's plugin is off where a project has no TypeScript (`language-server-load`, control bin/lib/project-apply.test.mjs) | nothing: the note's own text says the gate reads the load |
| one-sample-is-not-a-diagnosis.md | CLAUDE.md:52-54 ("Each claim is checked with its evidence, assumed, or not known"), CLAUDE.md:104 ("Verify technical claims before stating them. If unsure, investigate first."); the failure, `docs/FAILURES.md` `told-him-unverified` | a `- Seen: 2026-10-20` line in `told-him-unverified`; no new rule: it happened once, and two existing lines already ask for it (protocol section 4) |

### The fact notes (S2)

| Note | Type | Doctor flags it | Verdict |
|---|---|---|---|
| reinstall-checklist.md | `project` | yes | a fact note by design: the orchestrator skill's "Before a reinstall", step 2 (bin/lib/manifest.mjs:243), says "Recall your private checklist of the machine: it names other projects, so it lives in your memory, never in the repository". Its type is wrong, not the check: retype it to `reference`, which needs his yes as any edit of a note |
| plan-max-20x.md | `user` | no | right as it is |
| claude-models-2026-10.md | `reference` | no | right as it is |

The check reads the note's own `type` (`memoryRulesState`, `RULE_TYPES` of bin/lib/memory-index-guard.mjs:10) and so
is right about all three: a type the note states is the host's own classification, and a check that guessed a fact
from a note's text would be less exact than the one word that says it. No code change, so no test.

### What he would type, if he wants more than the deletions

Only one note's reading could become a rule; the lead asks it only if it is worth one (protocol section 4: it
happened? once, as the scope question of 2026-10-14):

- corrections-before-date, as an amendment of `rule:lead-charter`: "Cuando ordenes la cola, una corrección (una falla
  vista, un defecto, un atasco) va antes que una capacidad nueva, y la fecha de 1.0.0 se informa, nunca se usa para
  saltar una corrección."

## The question

To the lead, one notice (`notify --kind question`), for him: delete the 22 notes above whose rules live in the harness
(17 pointers, 5 placed) and retype reinstall-checklist.md to `reference`; the backup is taken first. After the pass,
doctor's row reads `ok`, or lists what he kept.

## Moved out of memory

What each note to delete holds that no other home does, its quotations verbatim, so that `memory verify` finds them
and nothing of the note is lost.

**board-rows-through-notify.md** (project, 2026-10-27):

> The home of this rule is rule:live-board. This note records how the lead failed it and how it keeps it.
>
> The live board groups cards by a row's `session` key (`docs/live-board.html` renderSessions). On 2026-10-27,
> hand-written rows used two keys for the lead ("JH ORQ orchestrator setup" and "JH ORQ orchestrator"), so the board
> showed two orchestrators, one quiet and one working. He said: "necesito que hagas las cosas bien". Other mistakes the
> same day: archived sessions still showed as ready, a row was timestamped in the future, and nobody pushed rows for 2
> hours.
>
> **Why:** a hand-typed key or time drifts. The pusher (`js-harness sessions live`) takes keys and times from the record.
>
> **How to apply:**
> - Post the lead's own events with `js-harness notify`, then push them with `sessions live`.
> - When archiving a session, post its closing through the record too.
> - Push the board on every wake.
> - Before telling him the board is right, simulate renderSessions on the db as he would see it.

**conflict-merge-costs-review.md** (project, retyped from feedback 2026-10-22):

> A merge of origin/main whose conflict was resolved by hand is a code commit to `check --push`:
> "c36f162 Merge … has no Codex review record", and `codex-review --plan --base origin/main` put the re-review at about 390,000 input tokens
> (JH 5, 2026-10-14). Clean merges pushed with no new review (PR 149, 151).
>
> **Why:** the review records cover the branch's own commits; a conflict resolution is new code no record covers.
>
> **How to apply:** before merging main, run `git merge-tree --write-tree HEAD origin/main`. On a conflict, undo nothing
> pushed; instead move the branch's change away from the conflicting spot in a small commit (its own cheap Codex
> review), check merge-tree is clean, then merge.

**corrections-before-date.md** (project, 2026-10-14):

> The goal is 1.0.0, but tasks added to fix how the harness works come first; if the date slips, it slips:
> "tiene que quedar funcionando como un reloj suizo" (his words, 2026-10-14, ffe99ebf line 5853, after he chose not to freeze the
> scope).
>
> **Why:** asked whether to freeze the 1.0.0 scope (tasks were added as fast as they closed: net 56 to 53 in 15 h), he
> chose "Seguir sumando" and explained that the additions are corrections and quality is the priority.
>
> **How to apply:** in every queue I set, a correction (a failure seen, a defect, a stall) goes before a new capability;
> report the net burn (closed minus added) and the date estimate as information, never as a reason to skip a correction.

**hidden-load-slows-gates.md** (project, 2026-10-11):

> On 2026-10-11 a gate on main timed out at 1,200 s and one of `feat/gate-lock` took 1,069 s (usual: 670 to 870 s). The
> cause was not the tree: a `tsserver.js` started by the measuring session itself (parent chain: tsserver,
> typescript-language-server, that session's `claude.exe`) used about 1.5 logical processors with nothing to do, and
> Chrome played a video (about 1.4 more). The look for `check.mjs|--test|suite.mjs|review` sees neither. With the server
> stopped the same tree ran in 832 to 867 s.
>
> **How to apply:** before reading a slow gate as the tree's fault, or before a timing that will be quoted, sample CPU by
> process over 5 s (`Get-Process` twice, difference of `.CPU`). A hot `tsserver.js` whose parent chain ends in this
> session's own `claude.exe` is this session's and may be stopped with `Stop-Process`; it comes back on a later edit,
> so look again. Someone else's process, or Sebastián's browser, is reported and left alone.

**one-sample-is-not-a-diagnosis.md** (project, retyped from feedback 2026-10-22):

> On 2026-10-20 the lead saw `git ls-remote` fail over Schannel and succeed over OpenSSL once. It told him and three
> sessions that Schannel was the cause. Three OpenSSL fetches a minute later failed too
> ("Connection was reset", "Could not connect"). The real cause was a flaky path to github.com, while api.github.com and google answered. The lead had
> to correct itself to him and to every session.
>
> **How to apply:**
> - Before naming a cause, repeat the probe at least three times, on both sides of the comparison.
> - Compare against a neighbour that should behave the same (api.github.com, another host).
> - Say "intermittent, cause unknown" until the comparison holds.

**restart-announce-caps.md** (feedback), his words as the note quotes them, 2026-10-20 (transcript 908805db):
"Recuerdame avisarme cuando tenga que reiniciar y por favor escribemelo en mayusculas ... YA PUEDES REINICIAR Y
ACTUALIZAR!!! y pausas todo para darme tiempo a hacerlo".

**review-consent-pregranted.md** (feedback): its pointer quoted AGENTS.md "he has pre-granted gentle-ai review consent
for every candidate here", a phrase AGENTS.md no longer holds; the rule is CLAUDE.md:77-83.

**reinstall-checklist.md** is kept; its quotation stays in the note: "Los otros proyectos ya los tratamos despues ...
lo mas importante ahora es este proyecto ... cuando yo vaya a reiniciar te voy a preguntar primero y tu ya me
recordaras todo y ahi si solucionaremos lo demas".

## Log
- L1 (2026-10-30) The lead's brief (JH 100), not his words: "place the 23 notes doctor flags, so memory holds no rules"
  (S1, S2; brief file `~/.js-harness/background/briefs/2026-10-30T14-31-27-443Z-f17a9da5.md`).
- L2 (2026-10-30) Evidence: `js-harness doctor` lists 23 notes under `memory-rules (claude)`; `js-harness rules` lists
  69 rules (hash a7f087c64ca7), not the brief's 70. The quotation run found 13 quotations of 9 notes in no home
  (board-rows 3, conflict-merge 1, corrections-before-date 1, one-sample 3, reinstall-checklist 1, restart-announce-caps
  1, review-consent-pregranted 1); all are in "Moved out of memory" now. Searched for a home of each note's lesson:
  `js-harness rules`, `grep` of bin/lib/manifest.mjs, bin/lib/protocols-skill.mjs, CLAUDE.md, AGENTS.md,
  docs/FAILURES.md, docs/ROADMAP.md for merge-tree, conflict, correction, suizo, Schannel, network, renderSessions,
  reinstall.
- L3 (2026-10-30) Decision (this session's): reinstall-checklist.md is retyped, not deleted, and the check is not
  changed (T3). corrections-before-date: his 2026-10-14 decision goes to the roadmap's row, its queue reading stays the
  lead's, offered as an optional rule.
- L4 (2026-10-30) e3926468 (T1-T3) passed the pre-commit gate ("PASS check 17 rows passed") and `js-harness rules
  check` (69 rules, a7f087c64ca7); docs only, so no Codex or lens record is owed. Draft PR 700. Question 117 recorded
  for the lead at 14:45:05Z (the text in `## The question`, with three options: all 22 and the retype, only the 17
  pointers, nothing). Waiting for his answer through the lead: `js-harness wait --notice-to 100` in the background.
- L5 (2026-10-30) His answer to question 117, read with `js-harness sessions --quote
  0f71b2c6-cbce-43ca-a031-276a4b2c381f 31693`: tapped "Sí, las 22 y el tipo (Recomendada)", 14:57:26Z. The lead's
  condition, by message: the 17 pointers and the retype now; the 5 placed notes only once this branch is in main, since
  until then the branch is their only other home. Done: `js-harness backup run` ("6156 observations ... committed, 1
  pushed"); memory pass 20261030T150050643Z deleted the 17 pointers and their MEMORY.md lines and retyped
  reinstall-checklist.md to `reference`; `memory verify 20261030T150050643Z --approved <the 17>` passed ("verified:
  journaled, lock released"). Doctor's `memory-rules` row now lists only the 5, which wait for this branch to land.
  Found after the pass: restart-announce-caps.md's quotation of 2026-10-20 ("Recuerdame avisarme ...") is in no home on
  main either (`rule:restart-announce` quotes his words of 2026-10-24), so until this branch lands its copies are this
  document, the backup of 15:0xZ and the pass's snapshot (`memory undo 20261030T150050643Z`).
