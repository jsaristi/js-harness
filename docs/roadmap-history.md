# The roadmap's history

Paragraphs that left [the roadmap](ROADMAP.md)'s `## Next` once the work they order was closed or recorded
elsewhere. They were moved here word for word on 2026-11-11 (F8 S6, `odd/tasks/f8-s6-read-surface.md`), from the
roadmap at `ba06e01f`, so that what a session reads to start stays within the `read surface` row of `check`.
Nothing here is the plan: the plan is the roadmap. "Above", "below" and a section named in quotation marks mean
the roadmap's, as it stood that day; one in-page link was pointed at the roadmap. This file only grows, by the
paragraphs that leave the roadmap, each under the day it left.

## Moved on 2026-11-11

### The F8 order as written on 2026-10-26

The six steps under "First: reorganize the harness (F8), in order, by his word of 2026-10-26", which stays in the
roadmap.

1. **His CLI login (step 0).** Done: he logged in again on 2026-10-26, and `claude auth status`
   shows him signed in with a refresh token present. The evals and tests run on the eval token
   (`JS_HARNESS_EVAL_OAUTH_TOKEN`, `evals/suite.mjs:94`) either way.
2. **Research (step 1).** Five passes. The second (section 14) ran the two tests the plan waited on:
   - The exclusion works in the desktop's configuration, read from `D:\js-harness\.claude\` only.
     The reason: a desktop worktree session starts with `--project-config-root D:\js-harness`.
   - A root `CLAUDE.md` importing `AGENTS.md` loads once, and only the worktree's copy.
   - 54 user reports and 15 public setups point the same way as the diet.

   The third (section 15) followed two blind grades, about 5.5 of 10 each from a Claude reviewer
   and Codex: right direction, wrong order. He approved its seven improvements on 2026-10-26.
   The fourth (section 16) followed a second blind grade, 6.3 from both: the order is right, and
   S0 now names its exact commands and the four things to build before they run. The same day he asked for a deeper reverse-engineering of
   gentle-ai; it is [its own proposal](proposals/gentle-ai-reverse-engineering.md): what stays,
   goes or merges, the TUI, and the update watch that S9 builds. A third blind grade of both
   (Claude 6.4, Codex 7.0) led to the fifth pass (section 17): one register of his decisions,
   named paid checkpoints, and a target for the incident score. The sixth (section 18) follows his
   direction (Decided, "Direction"): replace gentle-ai, Orca and herdr instead of excluding gentle-ai; two
   reviews on every slice; the same way of working in every project `init` sets up. Blind grades
   of the sixth (Claude 6.4, Codex 6.0) led to the seventh (section 19): an interim exclusion at
   S3, the full lens runner in S1, the rehearsal before his projects move, a removal that is
   recoverable in practice, and one checks-and-cost table.
3. **His decisions (step 2).** Asked from the register in the diet's section 1, one at a time,
   before the baseline, because the eval spend envelope (D2) sets what it costs. Only the
   blocking ones reach him; the lead takes the by-default ones with their stated default and
   records them (the register says which is which).
4. **A small baseline before any cut (step 3).** A step cannot be judged better or worse without
   one, but the baseline only needs what a step depends on: the 3-task eval, `honest-unknown`,
   `/context`, the `fixed load` row and a 10-case incident set, run twice so "worse" means beyond
   their spread. The credentials guard lands first, inside `evals/home.mjs`, because an eval broke
   his login. The long-session eval is built in parallel and confirms at the end.
5. **Migration (step 4).** One step at a time, in the diet's section 10 order; each step's change,
   files, probe, cost, dependencies and his decisions are under [F8 plan](#f8-plan):
   - S3, the split, with an interim exclusion of gentle-ai's global file in this repo, so the
     30.7k saving lands first; S2 reverts it.
   - S1, the two reviews, with the Claude lens runner built whole (the candidate as a commit range,
     an input packager, validation, launch and auth, records, invalidation, skips as a debt); S10,
     the port; S11, the complements under js-harness, with `bin/` and `evals/` swept.
   - S13 rehearses all of it on a scratch project before anything touches his projects; S12 then
     builds the migration of an existing project, tests it on a copy of an old one, and moves the
     listed projects.
   - S2: writers quiesced, one full backup (the whole `permissions` object and the complements'
     configuration named in it; credential files never opened or committed), a restore drill that
     proves engram answers, then gentle-ai's own uninstall, Orca's and herdr's, each asked first;
     a smoke test; every session restarts and the lead checks each.
   - Then S4a, S4b, S5 (with the rule-by-rule pass), S6 and S7. S9, the idea watch, any time after
     S2: each gentle-ai release read by area and classified adopt-into-ours, adapt or ignore;
     nothing installs. (Since question 129, 2026-10-30, S9 is the host watch instead: each Claude
     Desktop release; the idea watch leaves with gentle-ai at S2. Since 2026-11-03, by his words
     quoted under S9, a watch of gentle-ai's repository comes back as its own feature after S2.)
6. **Final certification (step 5).** The baseline and release measures, then a Claude audit and a
   Codex audit, three runs each, side by side, and the closing count of each failure class. One
   rerun rule (diet section 7.2): certification runs again on each new model and Claude Code or
   Codex CLI update, batched by G7; a gentle-ai release reruns nothing. Costs: the diet's one
   checks-and-cost table (D2).

### The frozen scope, the first version and the throughput list (2026-10-16)

**Scope frozen, by his answer of 2026-10-16.** On 2026-10-15 the sessions ticked 70 tasks and
opened 56 new ones (counted from the feature documents' history on `main`), so the open count
fell by only 14 in a day. Asked whether to freeze the scope, with 44 tasks open and about 13
hours left at that day's pace if it stays fixed, he tapped "Sí, congelá (Recomendada)" (the
lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 9186, 2026-10-16T07:49Z, read
with `js-harness sessions --quote`). From then on the first version is the tasks open on
2026-10-16 and the phases already named in this map. A new finding becomes a task only when it
breaks shipped behaviour or blocks one of those tasks; anything else goes to "Later" below, with
its source, and waits for him. This replaces his answer of 2026-10-13 that ideas keep entering
as before ("Todo sigue entrando como hoy", in the next paragraph); the rest of that paragraph
stands.

Three things the count of 44 left out, found by the lead the same morning. Seven phases show
0/0 in `js-harness progress` because their documents keep tasks in a table, not as checkboxes;
of their rows, three are still open (`odd/tasks/exact-tests.md` T3 and T4,
`odd/tasks/test-run-warning.md` T2), read from `main` with `rg '^\| T\d'` on each document. That
`progress` cannot count those rows is a defect in shipped behaviour, so it enters as a task. And
the defects with no task and the items with no design, which the next paragraph puts inside the
first version, are still a list made by readers and never checked in the code; checking each one
is a task, and each confirmed one becomes a task of its own. The Codex review switch among them
already ships (`js-harness functions`, `codexReview` in `bin/lib/functions.mjs`).

**The first version must be complete, stable and fully working, by his order of 2026-10-16.** Told
the three things above, he wrote "necesitamos si o si que la primera version sea completa y estable
y ademas super funcional" (the lead's transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 9602,
2026-10-16T08:10Z). The work it adds is tracked in `odd/tasks/first-version.md`: the three table
rows, `progress` counting table rows, the 2026-10-13 list checked in the code, the release source
("Release source" above, decided and not built, without which no machine can update to a new
version), a clean-home run of install, update and uninstall, and a stability pass at the end.
Creating the 1.0.0 tag stays his.

**Throughput, by his word of 2026-10-16, inside the frozen scope.** Shown the day's yield, he asked
to optimize until going further costs more than it returns, without trading quality or
reliability ("Ojala podamos optimizar a un nivel sin sacrificar calidad que me tengas que decir que
optimizar mas es mas el costo que el beneficio esa es la idea pero manteniendo la calidad y
fiabilidad", typed in the lead's chat during a turn, a queued message the transcript keeps without
its text), and then to apply it at once ("apliquemos todo eso de una vez para que cuando trabajes
autonomamente avancemos de una manera excepcional y a la maxima eficiencia", the lead's transcript
`e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 14742, 2026-10-16T20:48Z). The second sentence puts
these items inside the first version despite the freeze; that reading is the lead's.

The stop rule, the lead's reading: each item carries its baseline, its target and its cost, and
items stop being added when the next one is estimated to return less than it costs, which the lead
tells him. Nothing that lowers quality or reliability is an item: no dropping the Windows run from
a land, no skipped review, no weaker test. (The Windows run after each land, a hand step no land
made, became the daily run he chose, row "Windows suite" above: an automated run replaced a promise,
odd/tasks/commit-gates-first.md, L8.) Version 1 of this list was the lead's and reached him
unreviewed; two readers on Opus 5.5 at high then found most of it built or mismeasured (the
docs-only skip, the same-tree skip, exact tests, the rerun of a failed test file and the pnpm lock
fix already ship; suite gates are about 2.9 per merged PR, not 5.5; the lock was idle about 30% of
the day; the 82 conflict lines were 17 distinct PRs, mostly code; the merge door of T16e is a rules
door, not a gate moved off this machine). This is version 2. Baselines are of 2026-10-16 UTC.

| # | Item | Baseline | Owner |
|---|---|---|---|
| 1 | Fix the doctor `pnpm-lock` test (ext4 under WSL keeps the mtime 1 ms off) | 3 red land candidates | JH 27, `#315` |
| 2 | Ready pull requests land without waiting for a lead turn, with the same checks and reviews. Measured again (`odd/tasks/land-unattended.md`, Why): from each pull request's last "ready to land" note to GitHub's `mergedAt`, the 48 and 391 being creation to merge; the time queued for the gate lock, about 160 minutes that afternoon, outweighs the lead's own delay, about 5 minutes off the median. Built (#346): a land whose suite never ran exits 5 with nothing pushed or bisected, and a land's gate goes first in the line by a gate-first ticket (the lead's decision). The keeper, a loop that lands without the lead, is deferred by the stop rule (about 5 of 37 minutes). The land's items of the throughput plan v3 follow in the same document: a land record per land (B2), CircleCI started with the local suite (D), and the left-out pull requests' sessions told (A(b)) | ready to merged: median 37 min, p75 87, worst 127, over 47 pull requests merged 2026-10-16 12:35Z to 23:34Z | JH 24, `odd/tasks/land-unattended.md` |
| 3 | Stale conflicting pull requests merged with `main` or closed | 8 of 15 open conflicting | the lead |
| 4 | Shared hot files generated, not hand-edited: the README command list from `--help`, manifest rows derived | README in 26 of 61 merged PRs, ROADMAP 17, manifest 11 | JH 25, after `#282` |
| 5 | Resume reads the open task (`#332`). Closed Log sections moving to a sibling file is dropped by the stop rule: about 9k to 14k tokens per whole-document read by a verifier, against gentle-ai's one-document rule and 119 shifting citations (`odd/tasks/resume-open-task.md`, Part B) | `session-channel.md` 345 KB, `rule-hierarchy.md` 306 KB; the resume sections 381 and 1,036 lines, the mode line on a stale task in both | JH 26, `#332` |
| 6 | Dropped by the stop rule. Codex coverage surviving a rebase (commits matched by patch-id): two readers found a per-commit match unsound, since a review reads its range's net diff, and a sound match is a push-guard change (high-risk item 2); measured, 4 re-reviews in 491 records since 2026-09-29 would have been saved. Built instead: the one rebase hint, `js-harness rule change`, now says `git merge origin/main` (`odd/tasks/codex-patch-coverage.md`) | about 157k tokens per review redone (the plan's figure; records keep no token count) | JH 27, dropped by the lead |
| 7 | A land of only documentation skips the suite (the land in `bin/merge-queue.mjs` always runs `check.mjs` through `gate --wait`) | 14 of 61 merged PRs were documentation | JH 24, before item 2 |
| 8 | A session silent for 60 minutes with open work is flagged | 3 sessions stalled 5 to 6 h | JH 22, `feat/stalled-sessions` |
| 9 | Windows Defender's real-time protection off on this machine (his change); gates measured against the day's check median of about 150 s | `MsMpEng` 552 CPU-seconds in gate-start samples | the lead measures |
| 10 | Finished sessions archived, since each open one keeps a `claude` process and its MCP servers | `claude` 5.9 GB, `node` 2.1 GB, 4.5 of 19.7 GB free | the lead, with his yes per session |

Each item that needs a design passes the double review, Claude and Codex blind (`rule:double-review`), before it
is built, and
its version says what they changed; each build is test first, through the gate, gentle-ai and
Codex.

### The first version of 2026-10-13, the specification written last, the defects and what was open

**What the first version holds, by his answer of 2026-10-13.** Asked what enters the first
version, the 1.0.0, he had four options: what is already installed, well finished (the one
recommended); that and everything for several sessions; everything he asked for, with no date;
or a trial in his other project first. He tapped "Todo lo que pedí, sin fecha" (the lead's
transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 10519, 2026-10-13T09:18Z, read with
`js-harness sessions --quote`). So nothing he ordered is cut to reach it, and it has no date:
the open tasks of this map (`js-harness progress`), the defects in shipped behaviour that have
no task yet, and what he ordered that has no design yet (the functions on demand and the
switch of the Codex review among them, open decision 4) are all inside it. Which defects and
which items those are is so far a list made by the lead's readers, sub-agents' claims that
were not verified for this paragraph (the lead's relief file, lines 543 to 546); each enters
this map as a task when it has been read in the code. Tagging still starts with that version
(Decided, "Release source"). And nothing is frozen on the way to it: asked what is done with
the ideas and improvements that appear meanwhile (his own enter and the rest is noted, the one
recommended; everything keeps entering as today; everything is noted, his too), he tapped
"Todo sigue entrando como hoy" (the same transcript, line 10609, 2026-10-13T09:25Z, read the
same way). So an improvement that appears becomes a task of the first version, not a note for
after it.

**`docs/SPEC.md` is written last**, when everything else of the first version is finished and
the code is still, before the practice run and the tag; it stays rule-hierarchy's (T1). Asked
who writes it, he tapped "Al final, con el código quieto" (the lead's transcript `65318fd5`,
line 13982, 2026-10-13, read with `sessions --quote`), among a seventh session (the one
recommended) and this session after the README. His reason, in the message that asked for it
(line 13936): "necesitamos hacer la documentacion muy bien para que se pueda hacer perfecto solo
con ese documento". Its design is in "Rule hierarchy" above. Meanwhile each feature, at its
close, sends the lead one note per capability it built in the document's five parts, which the
lead keeps for whoever writes it. That is the lead's reading of his answer to how the sessions
leave those notes (line 14050, tapped "Que me lo manden a mí", among a section in each document,
the one recommended, and a file for each capability). Done otherwise since: `docs/SPEC.md` was written on
2026-10-16 (`794b7feb`), before the code was still, with the `spec` row of `check` that holds it to the code
at every commit, so it is kept alive rather than written last (its capability "The specification stays
alive").

**Defects in shipped behaviour that had no task, read in the code on 2026-10-13** (`main` at
`f98f478`). They came as claims of the lead's readers and of the session-channel session;
each was read by the rule-hierarchy session before it was written here, and all six are true.
Each has its task in the document of the feature it belongs to, none is designed, and none of
those features has a session open: the lead assigns them.

- a. **`upgrade` asks the npm registry for a name nobody holds**, the first to fix.
  `js-harness upgrade` runs `<pm> view js-harness version`, installs `js-harness@<that>` with
  no check of its source and no comparison to what is installed, and then runs the `sync` of
  the copy it installed (`bin/update.mjs:34-42`, `:200-225`); the menu of `js-harness` with no
  argument offers it too (`bin/tui.mjs:364`). `npm view js-harness version` answers 404, so
  the name is free, and whoever registers it decides what that command installs and runs on
  his machine. Today the command only fails ("could not determine the latest version to upgrade to"). The
  release source decided is git tags and is not built ("Release source").
  `odd/tasks/install-update.md`, T5. **Fixed on 2026-10-13** (branch `fix/upgrade-source`): no
  command asks a registry about the name any more. With no folder of tarballs named (`--source`
  or `JS_HARNESS_SOURCE`), `update`, `upgrade`, `status` and the menu start no process and say
  that no release is tagged yet; `upgrade` then exits 1 having installed nothing, and with a
  source it installs only a tarball newer than what is installed. Reading the tags is still
  not built: it is due with the first one. Left open and told to the lead: with no `--prefix`
  the `sync` after an install runs whatever `js-harness` the shell finds on the path. **Fixed
  on 2026-10-13** (branch `fix/upgrade-sync-from-path`, `odd/tasks/install-update.md`, T8): that
  copy is asked its version first, with a new `js-harness --version`, and only the version
  just installed is let to sync; any other answer, or none, syncs nothing and exits 1.
- b. **There is no README** (`fd -i -d 2 readme .` prints nothing, in a tree where it would
  find one). What it holds is his: open decision 9.
- c. **The package ships this repository's `AGENTS.md` and its tests.** `package.json:9-12`
  lists `bin/` and `AGENTS.md`; nothing under `bin/` reads the package's own `AGENTS.md`, which
  is this project's working agreement with him and not an installed project's; and `bin/`
  holds 58 test files, with no `.npmignore`. What ships is his: open decision 10. **Fixed on
  2026-10-13** (branch `fix/package-contents`), by his answer to question 24 ("Solo los
  comandos"): `package.json` lists `bin/` without its `*.test.mjs` and `*.testkit.mjs` files and
  no `AGENTS.md`. npm's own list went from 117 files to 56 (the 55 command files and
  `package.json`), the tarball from 1,125,283 bytes to 438,313;
  `scripts/package-contents.test.mjs` reads that list from a dry run of `npm pack` and pins it.
  `odd/tasks/install-update.md`, T7.
- d. **A timed-out command of `contract run` leaves its processes running**
  (`bin/contract.mjs:228-235`: a shell with a timeout, and only the shell is killed).
  `odd/tasks/sensors.md`, T5. **Fixed on 2026-10-13** (branch `fix/contract-timeout-tree`): a
  done-when command runs through the sensor runner (`runSensor`), which stops the whole tree
  at the timeout and whatever the command left holding its output; a test with real
  processes pins that neither the command nor what it started is left.
- e. **`status` exits 1 in a project whose `harness.json` holds no pin**, this repository
  among them: "it has no string "version"" (`bin/update.mjs:140-142`,
  `bin/lib/project.mjs:1473`; `sync` the same). `odd/tasks/install-update.md`, T6. **Fixed on
  2026-10-13** (branch `fix/status-no-pin`), by his answer to question 25 ("Vale, sin versión
  fijada"): a `harness.json` that is an object with no `version` is a project with no pin.
  `status` reports it and says how to pin one, exit 0; `sync` says there is nothing to move
  the project to and how to pin, writes nothing, exit 1. A `version` that is there and is
  not a semver string, and a file that is not a JSON object, are refused as before.
- f. **The practice run starts no host session**, so it does not prove that a host loads what
  was installed (`scripts/practice-lib.mjs:450-461`; item 4 under "Session channel" says so).
  `odd/tasks/practice-project.md`, T5; a step that spends a model is his to approve. Done on
  2026-10-14 for Claude Code (the step `host-loads`, within his allowance of three tries); Codex
  is still not proven.
- g. Already placed by the session-channel session in its own document, and only named here:
  the pause hook assumes a window of 500,000; the hook's text uses terms an installed project
  is never given; `uninstall` leaves `~/.js-harness/remote/`; and `pointersIn` of
  `bin/lib/manifest.mjs` (`odd/tasks/session-channel.md:2542-2585`).

Being built, each in a session of its own: the session channel
(`odd/tasks/session-channel.md`), the gate log (`odd/tasks/gate-log.md`) and the rule hierarchy
(`odd/tasks/rule-hierarchy.md`, current on the branch `feat/failures-register`). What is done
of each is read in its document, under "Next step"; the order they come from, with its
reasons, is under [Session channel](ROADMAP.md#session-channel). Also open:

1. F6 Codex parity, paused by Sebastián on 2026-10-06 and closed by him on 13 of the 15
   trials of T7 on 2026-10-12 (`odd/tasks/codex-parity.md`, branch `feat/codex-parity`, in the
   linked worktree `D:\js-harness-worktrees\codex-parity`). Asked by the lead whether to close
   with 13, run 15 new ones, or go back and run the two, he tapped "Cerrar con 13
   (Recomendada)" (the lead's transcript `65318fd5-80e7-4bb8-92b5-06737140185b`, line 9794,
   2026-10-13T03:33Z, read with `js-harness sessions --quote`). The two not run are resolver
   #3 and spec-drift #3 of `current` at `medium`. They could not join the same run as things
   stand: the suite refuses to continue a results file recorded on another stack
   (`evals/suite.mjs`, the warning `refusalOf` builds); that branch's document records
   codex-cli 0.160.0, gentle-ai 4.0.0 and engram 3.1.0 (`odd/tasks/codex-parity.md:1059`
   there); and this machine answers codex-cli 0.162.0, gentle-ai 4.1.1 and engram 3.4.0 (each
   `--version`, 2026-10-12). Putting the recorded versions back would have meant downgrading
   programs over the memory store in use, which is what the question named. Its result is
   written on those 13 ("F6 result") and its content is on `main` since 2026-10-13; nothing
   more of it is paid for, and no task of it is open. Sebastián approved its plan and a staged
   spend on 2026-10-03: 2 smoke trials, then 15, then his go-ahead for the other 45.
   Remote sessions, which he put before it that day, closed on 2026-10-04
   (`odd/tasks/remote-control.md`). The branch was brought up to `main` on 2026-10-04, so it
   holds the gate fix (`a3a1eb1`) without which a commit from a linked worktree can turn this
   repository bare. Slice 1 of 3 merged on 2026-10-05 (#33): one isolated Codex trial per arm,
   proven on the real binary, and the two smoke trials spent
   (`evals/proofs/codex-isolation.md`). Slice 2, the suite and the report (T4, T5), is complete
   and reviewed, and merged on 2026-10-05 (#34): `node evals/suite.mjs --agent codex`
   runs the matrix, and `node evals/report.mjs --codex-results-dir evals/results/codex` sets the
   two hosts side by side, with a Codex trial's cost estimated at the list price of its model.
   Slice 3 reached `main` on 2026-10-13 as three commits of a branch cut from it,
   `feat/codex-parity-close`: the login fix applied again on today's suite, the two results
   files and the isolation proof byte for byte, and the documents; a merge of the old branch,
   506 commits behind, would have been a code commit whose review covers everything `main`
   brought (`odd/tasks/codex-parity.md`, Progress, 2026-10-13). Still his, and the one thing
   left: what is kept of the raw trial output that lives only on this machine (`evals/runs/`
   in the old worktree, and `D:\js-harness-worktrees\codex-parity-t3-raw`); until he says,
   the old branch and its worktree stay as they are.
2. F4's follow-ups (`odd/tasks/sensors.md`), when one earns a slice; the orphaned processes of a
   timed-out `contract run` command are the most concrete.
3. F2's last step, when gentle-ai ships #4036; open decision 4 (the codegraph hook) can be
   taken at any time.
4. Session signals, asked by Sebastián on 2026-10-07: he runs several sessions
   from the phone and wants three things said by the harness itself rather than remembered by
   the agent. Whose turn it is in every reply: a prompt for him only when the work waits on
   him, and a plain "nothing to send" when the agent goes on by itself (he could not tell the
   two apart and sent stale prompts twice). A notice when a session finishes, saying which
   session to return to. And the context window watched, with its percentage reported and a
   cut proposed before auto-compact (this session reached 77% of 500k unnoticed). It is built
   inside two features and is no feature of its own: whose turn it is and the check of a
   reply are T2 of the rule hierarchy (`odd/tasks/rule-hierarchy.md`), and the context
   figure, with the context pause that took the place of the proposed cut, is T5 of the
   session channel (`odd/tasks/session-channel.md`).

   The format of the first is decided (Sebastián, 2026-10-07, "usá ese formato y cementalo en
   el harness"), after a block worded as an instruction ("run the lean review on Codex
   0.160.1") was read three times as a task for him to do in Codex. Every reply closes with
   one state of five (four until 2026-10-23):
   - working: he sends nothing; the reply says what wakes the agent and what it reports next.
     No block.
   - decision: the work waits on him. One block.
   - question: an open question of the conversation that he answers in writing, not with
     buttons; the reply asks it on the state's line, so the session is taken as neither
     working nor finished. No block. Added by Sebastián on 2026-10-23 (Pregunta 48, "Sí,
     sumalo"), proposal B of JH 43's finding 8: an onboarding session that waited for his
     written answer had no state to say so and closed as working
     (odd/tasks/reply-question-state.md).
   - cut: a new session, one block. He never compacts by hand, present or away (his words of
     2026-10-15, odd/tasks/no-manual-compact.md S1): near 88% a session writes its state and
     keeps working, the host compacts it by itself, and a session that stops gets its next
     prompt from the orchestrator. Until then a compact was two numbered blocks, the bare
     compaction command and the resume prompt.
   - finished: the session closed; the reply names the session he returns to. No block.

   A block sits under three fixed lines: what it is (for example "leave to spend one Codex
   review"), where it is sent (this chat) and what sending it does (the agent runs it; he
   runs nothing). The text of a decision is his answer in his words, as short as "Sí", never
   a technical instruction; the question, with its cost, goes above it in plain words. The
   opening prompt of a new session is the one long text, labelled as text to paste, not to
   understand.
   A decision is never asked while work still runs: the agent waits for it to end. A decision
   asked again says first that the earlier answer still holds and what changed.

   Narrowed by Sebastián on 2026-10-08 ("si el siguiente prompt es sí, seguí trabajando; solo
   pará si es una decisión que debo tomar"), when the nine Codex reviews of a comparison were
   put to him with a block that held only "Sí": a step already in the plan, whose only answer
   would be yes, is not a decision. The agent states it, with its cost, and goes on. A
   decision is a real choice between ways, something outside the plan, or something that
   cannot be undone.

   Where it lives: `AGENTS.md`, "Working with Sebastián". Still to build, in T2 of the rule
   hierarchy: a check that refuses a reply that closes with none of the states, so the
   rule stops depending on the agent reading prose.
