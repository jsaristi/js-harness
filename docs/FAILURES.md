# Failures

What went wrong in this project: one entry per failure, with each time it was seen and the
control that corrects it. A failure is work that went wrong in a way a control could prevent: he
was asked, or kept waiting, for what was not his; something false or unchecked was stated as a
fact; a tool showed a state that was not the real one; the machine's load or its leftovers hurt a
run; a rule existed and nothing made it act; a command failed or did the wrong thing. A test that
fails and is fixed inside its own task is not one: the gate is that control, working.

A failure is recorded by hand: one more `- Seen:` line in its entry, or a new entry in the
alphabetical order of the ids. The state of an entry is never written, because a state written by
hand could be false: `js-harness failures` computes it and counts, and
`js-harness failures check --settled` exits 1 while an entry is not settled. The design and its
reasons are in `odd/tasks/rule-hierarchy.md`, "The failures register".

## Classes

- `wrong-information`: stated as a fact, and not checked or not true.
- `asked-of-him`: asked or kept waiting for what was not his.
- `unseen-state`: a tool showed a state that was not the real one, or did not show it.
- `machine`: load or leftovers: processes, folders, locks.
- `rule-not-acting`: a rule existed and nothing made it act.
- `tool`: a command of the harness or of the stack failed or did the wrong thing.
- `delivery`: a commit, a review or a merge left in a shape that could not be checked.

## Entries

In the evidence, "relief file" is the orchestrator's relief file,
`.js-harness/relief/D--js-harness.md` under his home and not in the repository, and "(claimed)"
marks what a record only reports from a session's message. One `- Seen:` line is one occurrence;
other places that record the same occurrence are named in its note.

### asked-yes-not-his
A session stopped and asked him for a yes on a step that was not one of the things that are his.
- Class: asked-of-him
- Aka: failure 1 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-09 — relief file, line 26 — session 593da809 waited 17 hours for his "Sí" to run its
  gate, push and pull request; withdrawn by it at line 141 as no question of his
- Seen: 2026-10-10 — relief file, line 119 — the orchestrator called the deferral of a test "his to
  accept" and JH 3 asked him; his words and the withdrawal at line 124; also
  odd/tasks/session-board.md:1598-1608
- Control: owed — odd/tasks/rule-hierarchy.md — "The reply check: `bin/lib/reply.mjs`,
  `bin/reply.mjs`"
- Proof: count of bare yes per session is 0 (owed: nothing prints it yet)

### assessment-counts-main
After `main` is merged into a branch, the review assessment and the push check's hint count the
commits of `main` and answer with a range many times too large.
- Class: tool
- Aka: failure 15 (odd/tasks/rule-hierarchy.md; relief file, line 144); the defect "the push check
  hints a wrong base" (relief file, line 17)
- Seen: 2026-10-09 — odd/tasks/session-board.md:1101-1110 — the hint planned 41 parts, 21,461
  changed lines; nothing spent, the plan was read first
- Seen: 2026-10-10 — relief file, line 144 — `gentle-ai review assess` answered "review due" for
  26,343 lines (claimed); also odd/tasks/subagent-model-routing.md:390-397
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — `main` had moved without being merged
  in, and an assessment asked with `--base-ref origin/main` counted 2,552 lines that were not the
  branch's; the branch point as the base gave the real range
- Control: owed — odd/tasks/rule-hierarchy.md — "the push row hints the merge commit as the base
  after `main` is merged in"

### block-read-as-task
A block meant to hold his answer was worded as an instruction and he read it as a task for him to
run.
- Class: asked-of-him
- Seen: 2026-10-07 — odd/tasks/codex-review-lean.md:528-529 — read three times as a task to run in
  Codex; also docs/ROADMAP.md:1075-1077 and odd/tasks/rule-hierarchy.md:162
- Control: line — AGENTS.md — "never an instruction: one was read as his task." — since 2026-10-09

### block-referred-by-hour
A block he had not used yet was referred to by the hour it was given ("the block of 08:35") instead
of being repeated, and he had to search for it from the phone.
- Class: asked-of-him
- Aka: failure 3 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 142 — his words: "no me aparece el bloque del JH2"
- Control: owed — odd/tasks/session-channel.md — "The failures this feature owns closed with their
  proofs"
- Proof: notices carried by his paste, counted by the board: 0 in the stretch of its "Done when"
  (owed: nothing prints it yet)

### board-read-loads-gate
A read of the board is heavy enough to slow a gate, and watches and waiting scripts read it while
one runs.
- Class: machine
- Seen: 2026-10-10 — relief file, line 74 — about 43 board reads in the 20 minutes of a gate that
  timed out (the count is a sub-agent's claim; 12 to 40 s each is assumed); also
  odd/tasks/session-board.md:1352-1358
- Seen: 2026-10-11 — relief file, line 222 — the board takes 34 to 41 s beside a gate, 80 git calls
  over 16 worktrees (claimed by JH 5)
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — a session that knew the rule ran
  `js-harness sessions` once while another session's gate ran

### broken-wait-script
A private script written to wait or to check was broken, kept running, and reported a state that was
not the real one.
- Class: tool
- Seen: 2026-10-10 — relief file, line 74 — the waiter of JH 1 printed "rg: command not found" 61
  times and never saw a free machine; also odd/tasks/gate-lock.md:283-287 (46 minutes)
- Seen: 2026-10-10 — relief file, line 87 — the orchestrator's wait failed on its own quoting 18
  times and reported "no gate appeared in 3 minutes" with a gate running
- Seen: 2026-10-11 — relief file, line 233 — a check script answered "no" for five commits because
  `jq` printed carriage returns
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — a script that was to launch a commit
  only after another session's turn called `rg`, which a script run by `sh` does not find; it read
  that as "that session no longer waits" and took the lock it was written to yield
- Control: check — bin/check.test.mjs — "main waits for the gate that holds the lock, says once on
  stderr whose it is, and reports the time it waited" — since 2026-10-11

### chained-step-not-conditional
A check and the step it should allow were started in one command, and the step ran whatever the
check said or before its answer was read.
- Class: delivery
- Seen: 2026-10-10 — odd/tasks/practice-project.md:456-464 — a read chained with `;` printed `ALIVE
  14664` and the reviewer ran beside that gate
- Seen: 2026-10-10 — odd/tasks/practice-project.md:582-584 — a commit was started before its message
  file was written (called a mistake in relief file, line 134, claimed)
- Seen: 2026-10-10 — odd/tasks/practice-project.md:709-727 — commit `2333c66` did not wait on the
  proof of the script it described; a second gate
- Seen: 2026-10-10 — odd/tasks/subagent-model-routing.md:390-397 — the push ran before the
  assessment's answer was read; also relief file, line 144
- Seen: 2026-10-11 — odd/tasks/gate-log.md:430-441 — a review command printed that the lock was held
  and went on
- Seen: 2026-10-11 — relief file, line 286 — the line that records "merged" was written by the command
  whose merge was refused; corrected in line 287 (the orchestrator's own report, not read here)
- Control: owed — odd/tasks/rule-hierarchy.md — "The skill `js-harness-protocols`, six sections"

### checked-not-read
A record or a message said "checked" for something that had not been read, or that was another
session's claim.
- Class: wrong-information
- Seen: 2026-10-10 — relief file, line 92 — "checked" written before the output of `git status` was
  read (it corrects line 91)
- Seen: 2026-10-10 — relief file, line 137 — a session's own figure (70 percent) listed as checked
  by the orchestrator
- Seen: 2026-10-11 — relief file, line 224 — JH 6 said a language server was not its own without
  walking its parents; also odd/tasks/gate-log.md:597-600
- Seen: 2026-10-11 — relief file, line 290 — a transcript line cited as his words from a text search,
  without reading the entry's type: it was a queue entry with the same text (the orchestrator's own
  report)
- Control: owed — odd/tasks/rule-hierarchy.md — "The honesty audit (C9): the transcript reader read
  first"

### cli-updated-itself
A tool of the measured stack updated itself and nobody saw it until a measurement was about to run
on it.
- Class: unseen-state
- Seen: 2026-10-09 — relief file, line 13 — engram on the machine is 3.3.0, so the two trials left
  of F6 cannot run as planned
- Seen: 2026-10-10 — relief file, line 146 — `claude` on PATH is 2.1.296, replaced by the native
  updater on 2026-10-09 14:36 (claimed); also odd/tasks/subagent-model-routing.md:399-404

### codex-cap-too-small
A fixed cap of Codex input tokens per feature was met again and again, and each time finished slices
waited for his answer.
- Class: asked-of-him
- Seen: 2026-10-10 — relief file, line 135 — 2,081,562 of 3 million used with tasks left (claimed);
  raised to 5 million at line 140; foreseen at odd/tasks/gate-lock.md:346-349
- Seen: 2026-10-10 — relief file, line 156 — 4,528,135 of 5 million used; the pre-push hook refuses
  the branch (line 163); raised to 6.5 million at line 164
- Seen: 2026-10-11 — relief file, line 218 — session channel: 2,780,275 of 3 million after two
  slices of five; the next slice gets no Codex review and no push (claimed)
- Seen: 2026-10-11 — relief file, line 220 — gate log: three slices do not fit in 3 million; both
  raised to 7 million at line 232

### codex-model-at-capacity
A Codex review ended on its first part with "Selected model is at capacity", recorded nothing, and
the input tokens it had read were spent.
- Class: tool
- Seen: 2026-10-12 — odd/tasks/rule-hierarchy.md, Progress, "T16b, design and first slice" —
  `859a797..6a721cc`, part 1 of 7, 49,568 input tokens; run again in a turn of the gate lock, on
  the same model, and not recorded as a skip

### codex-review-incomplete
A Codex review followed the delegation rules of its home instead of reading the patch, read a tenth
of it and recorded nothing.
- Class: tool
- Seen: 2026-10-06 — odd/tasks/session-board.md:856-866 — exit 1 after 64 s, "367 of 3356 changed
  lines", "Access denied (os error 5)"
- Control: check — bin/lib/codex-review-home.test.mjs — "gives the login a second name there: the
  same file, not a copy" — since 2026-10-09

### command-run-for-help
A session ran a command it did not know, to read its help, and the command acted.
- Class: rule-not-acting
- Aka: the defect "install acts on a flag it does not know" (relief file, line 17)
- Seen: 2026-10-09 — odd/tasks/session-board.md:1183-1198 — `install --help` installed two skills
  and two hook entries on his machine; also docs/ROADMAP.md:434-436 and :481
- Seen: 2026-10-10 — relief file, line 54 — `claude remote-control --help` printed nothing and hung
  120 s; odd/tasks/session-board.md:1335-1339 calls it the same mistake, a day after the rule was
  written
- Seen: 2026-10-12 — relief file, line 349 — the lead ran `install --help` to read the help and it
  installed four files and a hook entry on his machine
- Seen: 2026-10-12 — relief file, line 409 — JH 8 ran `check --help` and it started a gate, which
  went to wait and was stopped before it ran anything (claimed)
- Control: owed — odd/tasks/rule-hierarchy.md — "Every command that writes outside the repository
  refuses a flag it does not know"

### commit-too-large-to-review
A commit passed the gate and was too large for the reviewer, so it went unreviewed or was remade at
the cost of more gates.
- Class: delivery
- Aka: failure 10 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-08 — odd/tasks/codex-review-cost.md:151-163 — 2,540 lines,
  `lens_context_budget_exceeded`; `14cd8bf` has no gentle-ai review
- Seen: 2026-10-08 — odd/tasks/codex-review-cost.md:474-480 — 1,571 lines refused; taken back and
  made again as two
- Seen: 2026-10-10 — relief file, line 138 — 2,250 lines refused; split in two, two more gates
  (claimed)
- Seen: 2026-10-11 — relief file, line 218 — a code commit of about 1,900 lines, over the 1,200 kept
  as a rule; Codex took it in seven parts
- Seen: 2026-10-11 — relief file, line 222 — 2,221 lines did not fit one review; reviewed in two
  halves (claimed)
- Proof: the row `codex-review` (debt) prints the size (`checkCodexReviewDebt`, `bin/check.mjs`);
  whether it refuses is its session's to name

### context-cut-by-percentage
Sessions were told to cut, or proposed a cut, near 70 percent of their context because of a mark of
73 percent that limits nothing and was never his number.
- Class: wrong-information
- Aka: failure 6 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 53 — JH 1 told at 67 percent to finish its task and cut
- Seen: 2026-10-10 — relief file, line 117 — JH 2 told at 70 percent to finish and cut; it cut at 74
  (line 122)
- Seen: 2026-10-10 — relief file, line 137 — JH 1 proposed a cut at 70 after his rule of lines 126
  and 127; withdrawn at line 138
- Control: check — bin/sessions.test.mjs — "no text of this feature writes a share the context rule
  left behind" — since 2026-10-12
- Proof: count of cuts proposed under 85% is 0 (owed: nothing prints it yet)

### context-fills-unnoticed
A session's context reached a level nobody had looked at.
- Class: unseen-state
- Seen: 2026-10-07 — docs/ROADMAP.md:1071 — a session reached 77 percent of 500k unnoticed (the day
  is that of his request; the day it happened is not stated)
- Seen: 2026-10-10 — relief file, line 75 — a session said 80 percent where the board said 68,
  inside a task that could not close
- Seen: 2026-10-10 — relief file, line 155 — the orchestrator went from 63 to 79 percent with its
  own context "read too seldom"
- Seen: 2026-10-11 — relief file, lines 276 to 285 — the orchestrator passed the pause, judged four
  times that little was left, and the host compacted it with no word to him (its own report)
- Control: check — bin/sessions.test.mjs — "--watch returns when a session reaches the context
  pause" — since 2026-10-09

### cross-session-message-held
A message between a session opened from the phone and a desktop session is held and expires, so that
session can neither be told nor tell, and each notice becomes his paste.
- Class: tool
- Aka: failure 5 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 48 — the notice "opened" of JH 2 never arrived; cause at
  lines 49 and 60
- Seen: 2026-10-10 — relief file, line 84 — JH 2 took the gate by itself because it could not be
  told the order
- Seen: 2026-10-10 — relief file, line 140 — a finished feature waited six hours for his paste
  (given at line 134, pasted at line 143)
- Control: owed — odd/tasks/session-channel.md — "The row `session-classes` of `doctor`, with the
  exact fix in its line"
- Proof: a practice step: a notice read with no message sent (owed: nothing prints it yet)

### design-not-faithful
A design document passed gentle-ai and its own contract and still dropped or misstated decisions of
his and named files that do not exist.
- Class: delivery
- Seen: 2026-10-10 — relief file, line 181 — four blocking items found by a reader that did not
  write it; also odd/tasks/rule-hierarchy.md:768
- Control: owed — odd/tasks/rule-hierarchy.md — "The row `citations`, INFO"

### diagnostic-whole-gate
A retry command ran a whole gate as a diagnostic after a failed commit, twenty minutes of the
machine for nothing.
- Class: machine
- Seen: 2026-10-10 — relief file, line 83 — the third run, 03:21 to 03:41 (claimed); also
  odd/tasks/session-board.md:1350-1351

### documents-commit-skips-suite
A commit of declared documents alone runs no sensor, and the suite reads those documents: such a
commit can break a test, pass its own gate, and fail the next gate with code in any session.
- Class: rule-not-acting
- Seen: 2026-10-12 — relief file, line 407 — found by reading and not by a gate that broke (JH 8,
  claimed): the skip is `bin/check.mjs:279-287`, and `bin/rules.test.mjs:480` runs `rules check`
  on the real `docs/RULES.md` and `docs/rule-sources.json` (`bin/rules.mjs:24-25`); until the gate
  runs the readers of a staged document, `rules check` is run by hand after such a commit

### engram-writes-lost
A session lost what it had written to engram after each of its two compactions.
- Class: tool
- Seen: 2026-10-06 — odd/tasks/session-board.md:280-281 — one sentence; nothing else about it was
  found

### estimate-passed-as-fact
A figure that was an estimate, or came from notes, was passed on as a fact and a decision was taken
on it.
- Class: wrong-information
- Seen: 2026-10-10 — odd/tasks/gate-lock.md:927-930 — the premise "most of its time is fixtures"
  came from notes and was wrong by a factor of three
- Seen: 2026-10-10 — relief file, line 183 — "three shards bring the gate near 500 s", arithmetic
  and not measured, told to him as what brings the gate down; he approved on it; also
  odd/tasks/gate-lock.md:1088-1096
- Seen: 2026-10-11 — relief file, line 186 — context percentages told to him between two reads were
  estimates and not marked
- Seen: 2026-10-11 — relief file, line 220 — the roadmap says "some fifty thousand git processes"
  (docs/ROADMAP.md:767); counted, 15,467 (claimed by JH 6)
- Control: owed — odd/tasks/rule-hierarchy.md — "The honesty audit (C9): the transcript reader read
  first"

### gate-at-its-bound
A gate reached, or came within seconds of, its bound of 1,200 s with no test failing, and the commit
was not made. Since 2026-10-11 a gate on a loaded machine names what loads it under its load row
(`bin/check.test.mjs`, "a gate on a loaded machine names what loads it in lines under the load
row"); that tells the load and stops nothing.
- Class: machine
- Seen: 2026-10-10 — relief file, line 71 — run 1, 02:40 to 03:00, cause given at line 72 as an
  assumption
- Seen: 2026-10-10 — relief file, line 75 — run 2, ended 03:21:25
- Seen: 2026-10-10 — relief file, line 90 — run 4, 04:01 to 04:21, on a machine the sessions kept
  quiet
- Seen: 2026-10-10 — relief file, line 100 — the gate of JH 1, 04:22 to 04:42; "five gates failed at
  the bound" that night, one of them the diagnostic of `diagnostic-whole-gate`
- Seen: 2026-10-10 — relief file, line 179 — 1,167 s of 1,200 on the tree with main merged in
  (claimed)
- Seen: 2026-10-11 — relief file, line 192 — the gate of JH 4 timed out, 03:27:59 to 03:48:06
- Seen: 2026-10-11 — relief file, line 224 — 1,188 s of 1,200 (claimed); also
  odd/tasks/gate-log.md:590-596
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — the gate on the result of merging
  `main` in timed out at 1,206 s with 3,195 tests passed and none failed; run again, it passed

### gate-ran-unseen
"No gate runs" was said while a gate of a session that cannot notify was running.
- Class: unseen-state
- Aka: failure 9 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 122 — a gate of JH 2 ran 05:39 to about 05:53 unseen
- Seen: 2026-10-10 — relief file, line 131 — a second one, from 06:41, again unseen
- Control: check — bin/gate.test.mjs — "gate writes a start after the sample and before the command,
  and an end after it with its exit code" — since 2026-10-11
- Proof: the log; none exists on the branch yet, so the proof is owed by its session (owed: nothing
  prints it yet)

### gate-tests-wrote-repository
Tests run by the gate from a linked worktree wrote into the real repository and turned its
configuration to bare.
- Class: tool
- Seen: 2026-10-04 — odd/tasks/codex-parity.md:185-196 — `core.bare=true` in the shared
  `.git/config`, a worktree's index replaced; the same incident at
  odd/tasks/remote-control.md:312-323
- Control: check — bin/js-harness.test.mjs — "run from the pre-commit hook of a linked worktree,
  this file leaves the repository being committed as it was" — since 2026-10-04

### heavy-run-beside-gate
A test run or a count started while a gate, or a batch that measures durations, was running.
- Class: rule-not-acting
- Aka: failure 16 (odd/tasks/rule-hierarchy.md; relief file, lines 167 and 202)
- Seen: 2026-10-08 — odd/tasks/subagent-model-routing.md:301-302 — a writer's tests beside a gate
  "cost one gate"; one sentence
- Seen: 2026-10-10 — relief file, line 51 — JH 1 ran a test file while a gate ran; also
  odd/tasks/gate-lock.md:280-283
- Seen: 2026-10-10 — relief file, line 74 — the writer of JH 2 ran `node --test` at 03:02:11 beside
  a gate
- Seen: 2026-10-10 — relief file, line 167 — tests started at 20:27:21 beside a batch of 12 trials,
  because the look named processes and `evals/suite.mjs` was not on the list; also
  odd/tasks/gate-lock.md:1033-1045
- Seen: 2026-10-11 — odd/tasks/gate-log.md:594-596 — a writer ran a count outside the lock for about
  four minutes beside a gate (its own report)
- Control: protocol — bin/lib/manifest.mjs — "A whole test run of your own goes through" — since
  2026-10-11
- Proof: the gate log shows no overlap; owed with 9 (`gate-ran-unseen`) (owed: nothing prints it
  yet)

### host-restart-unseen
The app restarts a session's process: the session goes on in a new transcript, its background work
has no owner, and the board keeps showing rows and work that nobody holds.
- Class: unseen-state
- Aka: "FAILURE FOR THE PRODUCT, a new one" (relief file, line 235)
- Seen: 2026-10-10 — relief file, line 148 — the orchestrator restarted about 14:40; one session,
  two transcript ids, a dead row
- Seen: 2026-10-11 — relief file, line 211 — again at 05:18; two rows with the orchestrator's title
- Seen: 2026-10-11 — relief file, line 235 — the whole app at 13:14; two gates left as orphans,
  messages "not delivered" (the restart of the orchestrator itself is at line 234)
- Control: check — bin/lib/sessions.test.mjs — "rosterOf: the transcripts of one title are one row,
  which says what the latest of them records" — since 2026-10-11

### hours-guessed
Hours written in the relief file were not read from a clock.
- Class: wrong-information
- Aka: failure 18 (odd/tasks/rule-hierarchy.md); unnumbered in relief file, line 202
- Seen: 2026-10-10 — relief file, line 96 — a roster line said 04:40 and was written about 04:29
- Seen: 2026-10-10 — relief file, line 172 — seven hours in lines 166, 169 and 171 were guessed
- Control: check — bin/lib/channel.test.mjs — "a relief line is stamped with the local date and time
  of the clock, and says the command wrote it" — since 2026-10-11

### installed-copy-stale
The command on PATH was an old copy with no way to tell: the version reads 0.1.0 before and after,
and the installed skill named commands that copy did not have.
- Class: unseen-state
- Seen: 2026-10-09 — odd/tasks/session-board.md:1194-1198 — a copy of 2026-09-28 with no `sessions`,
  `contract`, `init`, `remote` or `codex-review`; the version finding at :1213-1215; also relief
  file, line 15

### known-defect-left-for-review
A defect already reported was written down for later instead of fixed, and a paid review spent its
dearest part finding it again.
- Class: delivery
- Seen: 2026-10-08 — odd/tasks/codex-review-cost.md:234-239 — "the parent's error, to not repeat"

### language-server-load
A TypeScript language server per session works whenever tests write files, takes up to a whole
processor, and gates slow down or reach their bound. Since 2026-10-11 a gate on a loaded machine
names the server under its load row (`bin/check.test.mjs`, "a gate on a loaded machine names what
loads it in lines under the load row"); that row tells of it and stops nothing.
- Class: machine
- Aka: failure 20 (relief file, lines 195, 202, 220 and 224)
- Seen: 2026-10-11 — relief file, line 194 — pid 4536, 6.3 CPU-seconds in 5 s, found after a gate
  timed out; owner and cause at line 195; also odd/tasks/gate-lock.md:1227-1238
- Seen: 2026-10-11 — relief file, line 220 — the gate of 07:33 named a `tsserver.js`, pid 41012, at
  1.1 s of CPU per 2 s (claimed)
- Seen: 2026-10-11 — relief file, line 224 — "THIRD SIGHTING": pid 7996 at a whole processor beside
  a gate of 1,188 s of 1,200; also odd/tasks/gate-log.md:597-609
- Seen: 2026-10-12 — odd/tasks/rule-hierarchy.md, `## Progress`, the entry of the second part of
  T16b — pid 59656 of the session of this feature spun one processor from 01:48 to 08:53; the gate
  of 07:50 named it and the session reported it without looking at whose it was

### linux-probe-misnames-process
On Linux the probe of a port named the process that listened by `ps -o comm=`, which answered the
thread's name, so a listener was left alone as "not engram".
- Class: tool
- Seen: 2026-10-12 — relief file, line 425 — run 38296748258 of the suite on GitHub's Linux
  (claimed; classified in odd/tasks/gate-wait.md of `feat/gate-wait` at ea02144, lines 1037-1039):
  `evals/ports.mjs:168-169` got `MainThread` for a Node child; whether the real engram binary is
  named right is not known. It can be reproduced only on Linux: a run there in which the probe
  names a Node listener and the engram binary by what they are would prove a fix

### lock-folder-left
The gate lock left an empty folder under his home after every run, and `uninstall` did not remove
it.
- Class: machine
- Aka: failure 12 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 131 — `C:\Users\Oficina\.js-harness\gate` exists and is empty
  after the gate; `uninstall` leaves it (line 134)
- Control: check — bin/lib/gate-lock.test.mjs — "release removes the folder `gate` itself when
  nothing else is in it" — since 2026-10-11

### lock-not-a-queue
The gate lock is not a line by arrival: a command that had waited an hour was passed by one that
came later.
- Class: tool
- Aka: "FOR THE PRODUCT" (relief file, line 227)
- Seen: 2026-10-11 — relief file, line 227 — a waiter of 1 h 04 min while a later gate took the
  lock; the same fact at odd/tasks/gate-log.md:757-758
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — a commit waited 60 min 1 s and gave up
  with no sensor run, while four sessions asked for the lock

### message-to-wrong-session
A prompt or a message went to a session that was not the one for it: one that never existed, or one
that no longer held the role.
- Class: unseen-state
- Seen: 2026-10-06 — odd/tasks/session-board.md:16-17 — a finished side session handed him prompts,
  one addressed to a session that never existed
- Seen: 2026-10-10 — relief file, line 72 — a session answered to the reply address of the relieved
  orchestrator; his words about it at line 78
- Control: check — bin/sessions.test.mjs — "--address prints the title of the one session that holds
  a role and exits 0, and reads nothing but the transcripts" — since 2026-10-11

### missed-wake
A session started waiting on him between two runs of the watch, and neither run reported it.
- Class: unseen-state
- Seen: 2026-10-09 — relief file, line 37 — 50 minutes unreported; cause at line 39; also
  odd/tasks/session-board.md:1293-1305

### old-rule-beside-new
A rule changed and the places that state it did not all change with it: the old one stayed, read
as in force, beside the new one.
- Class: wrong-information
- Seen: 2026-10-11 — docs/sweep-2026-10-11.md, Why — the share of its context at which a session
  writes its state changed three times in two days and was carried by hand to each place that
  states it; his words on it are quoted there
- Seen: 2026-10-11 — docs/sweep-2026-10-11.md, Counts — the sweep he ordered found 247 places that
  a reader would take as in force and that said something no longer true
- Control: owed — odd/tasks/rule-hierarchy.md — "T16 One home for every rule"

### opening-pasted-no-line
The opening of a session reached it as pasted text with no typed line of his, so the session waited
for a yes or went on by its own judgment.
- Class: asked-of-him
- Aka: failures 4 and 17 (odd/tasks/rule-hierarchy.md); failure 4 (relief file, line 143); failure
  17 (relief file, lines 175 and 202)
- Seen: 2026-10-09 — relief file, line 38 — JH 1 asked him to confirm and built nothing
- Seen: 2026-10-10 — relief file, line 111 — an orchestrator did nothing until his "si"
- Seen: 2026-10-10 — relief file, line 175 — JH 4 waited 28 minutes; carrying his words did not
  spare the yes (line 177)
- Seen: 2026-10-11 — relief file, line 204 — JH 5; it compared the paste with the block and did not
  ask
- Seen: 2026-10-11 — relief file, line 206 — a new orchestrator asked him ("third time" by that
  line's count)
- Seen: 2026-10-11 — relief file, line 238 — JH 7; it compared the paste and read his words, no yes
  asked; also odd/tasks/rule-hierarchy.md:797-798
- Control: check — bin/sessions.test.mjs — "--opening prints the text of the opening stored for a
  title" — since 2026-10-11
- Proof: count of a yes after a paste is 0 (owed: nothing prints it yet)

### outside-load-unseen
Programs that are not the harness took one to two processors while gates and measured runs ran, and
no look saw them because the looks counted names. Since 2026-10-11 a gate samples the load once and
says it in one INFO row named load (`bin/check.test.mjs`, "a gate samples the load once, before its
first sensor and inside its turn, and says it in one INFO row named load"); that row tells of it and
stops nothing.
- Class: machine
- Aka: failure 19 (relief file, lines 194 and 202)
- Seen: 2026-10-10 — relief file, line 76 — Microsoft PC Manager used as much CPU as the whole gate
  (11.5 against 11.2 CPU-seconds in 15 s)
- Seen: 2026-10-10 — relief file, line 100 — Brave 16.7 CPU-seconds in 10 s; he closed both at line
  102 and the next gate passed in 916 s (line 109)
- Seen: 2026-10-10 — relief file, line 174 — Brave open with a video beside a batch that compares
  durations
- Seen: 2026-10-11 — relief file, line 194 — Chrome with a video open six and a half hours and
  nobody saw it

### pnpm-update-leaves-lock
The only road to update the installed command exits 1 on this machine and leaves a lock folder that
makes the next try wait five minutes and fail.
- Class: tool
- Aka: failure 21 (relief file, lines 201 and 202)
- Seen: 2026-10-09 — relief file, line 17 — "pnpm left the old copy's folder on disk"; the lock
  found on 2026-10-11 was dated 2026-10-09 17:40
- Seen: 2026-10-11 — relief file, line 201 — two tries, both exit 1; the lock folder left again,
  removed by hand twice

### process-left-after-stop
Stopping a task from the app or with `pkill` ended what the app tracks and left the process under it
alive.
- Class: machine
- Seen: 2026-10-07 — odd/tasks/session-board.md:942-945 — the stop ended the shell while `git
  commit` and the gate under it lived on
- Seen: 2026-10-10 — relief file, line 75 — the broken waiter, pid 10452, alive and reading the
  board through a gate after `TaskStop` (said at line 76, claimed)
- Seen: 2026-10-11 — relief file, line 233 — `pkill` did not stop the first watch; two ran at once

### push-check-read-as-gate
The board counted the few seconds of a push's check as a second gate.
- Class: unseen-state
- Seen: 2026-10-07 — odd/tasks/session-board.md:978-984 — "gate started ... while another runs" for
  a pre-push hook

### record-states-wrong-fact
A record held a fact that was not true when written or stopped being true, and was read later as it
stood.
- Class: wrong-information
- Seen: 2026-10-06 — odd/tasks/session-board.md:18-19 — a process recorded as "was not killed" while
  another session killed it
- Seen: 2026-10-07 — odd/tasks/session-board.md:932-937 — an entry named the wrong cause of a wake;
  corrected with its proof
- Seen: 2026-10-10 — relief file, line 67 — line 62 cites "his decision of line 62"; the decision is
  line 58
- Seen: 2026-10-10 — odd/tasks/session-board.md:1368 — the entry at :1347 said the commit "failed
  three times before it was made"; the fourth failed too and no commit existed; also relief file,
  line 99
- Seen: 2026-10-11 — relief file, line 201 — `D:/js-harness` was at `df15929`, not at `9510a2a` as
  lines 155 and 171 said
- Seen: 2026-10-11 — odd/tasks/gate-log.md:315-333 — at `51a24db` T3 to T8 are checked off while
  `bin/lib/gate-log.mjs` and `scripts/count-git.mjs` are in no commit of `main`

### refusal-in-system-words
A path helper let a system error through, so a run was refused in the system's words and not in
the harness's.
- Class: tool
- Seen: 2026-10-12 — relief file, line 425 — `evals/paths.mjs:6` lets `ENOTDIR` through for a
  path below a file (claimed; odd/tasks/gate-wait.md of `feat/gate-wait` at ea02144, line 1040);
  the run is still refused

### review-tool-timeout
The bound status of a gentle-ai review failed with `operation_timeout`, the candidate was left
without that review, and the choice went to him.
- Class: tool
- Seen: 2026-10-07 — odd/tasks/codex-review-lean.md:796-806 — `b5c8766..b0053cf` has no gentle-ai
  review
- Seen: 2026-10-11 — relief file, line 228 — twice on one slice, beside a running gate (an
  observation, not a cause shown); JH 5 stopped on him

### rule-only-in-memory
A rule lived only in an agent's memory note, so he repeated it and sessions already open did not get
it or did not follow it.
- Class: rule-not-acting
- Aka: failure 2 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-08 — docs/ROADMAP.md:381-395 — two rules of that day existed only in memory; his
  wording rule said for the first time
- Seen: 2026-10-09 — relief file, line 3 — his wording rule again, with the lead
- Seen: 2026-10-10 — relief file, line 80 — "third time he states it"; also
  odd/tasks/rule-hierarchy.md:15-18
- Seen: 2026-10-10 — relief file, line 137 — a rule changed in a memory note; a session with the new
  note loaded still proposed the cut (line 138)
- Control: owed — odd/tasks/rule-hierarchy.md — "The row `memory-rules` of `doctor`"
- Proof: `doctor`: no `memory-rules` gap (owed: nothing prints it yet)

### script-ate-backslashes
Text with backslashes written through a shell script lost them, and a commit carries the broken
path.
- Class: tool
- Seen: 2026-10-10 — odd/tasks/practice-project.md:577-579 — `d639bdf` carries
  `D:js-harnesspractice`

### secret-printed
A secret reached output that is kept: a sub-agent printed a token into its transcript, and a gate's
report could print a password from a command line.
- Class: tool
- Seen: 2026-10-10 — odd/tasks/practice-project.md:362-366 — `env | rg` printed the value of
  `JS_HARNESS_EVAL_OAUTH_TOKEN`; also relief file, line 134
- Seen: 2026-10-11 — relief file, line 230 — a P1 of Codex: "a password printed in a gate's report"
  (claimed); also odd/tasks/gate-log.md:134
- Control: check — bin/lib/machine-busiest.test.mjs — "scriptOf says nothing of an argument that is
  not the whole path of a file that exists, however it is spelled" — since 2026-10-11

### session-state-misreported
A session was reported to him as waiting for his prompt while it still had a commit in the gate and
a sub-agent running.
- Class: unseen-state
- Seen: 2026-10-06 — odd/tasks/session-board.md:20-22 — his words: "creo que das por hecho que ya
  terminó"
- Control: check — bin/lib/sessions.test.mjs — "state is background when the turn ended and some
  background work has no recorded end" — since 2026-10-09

### session-title-not-role
A session's title on the board did not say what the session was: the first words of its opening
prompt, or the name of a feature it no longer did.
- Class: unseen-state
- Seen: 2026-10-10 — relief file, line 67 — the board shows a phone-opened session under the first
  words of its opening (answer 3c); also line 46 and odd/tasks/session-board.md:1510
- Seen: 2026-10-10 — relief file, line 85 — his remark that "F6 Codex parity en slice C" was still
  used, for work that was not F6
- Seen: 2026-10-11 — relief file, line 218 — a phone-opened session's transcript carries no title,
  so its roster row has no role (claimed)

### stacked-pr-base-order
A stacked pull request had its base changed after the one under it was merged; GitHub reported a
conflict git did not reproduce and the merge was refused.
- Class: delivery
- Seen: 2026-10-10 — relief file, line 164 — pull request 53: DIRTY, CONFLICTING; two merge bases
  found at lines 166 and 167
- Control: owed — odd/tasks/rule-hierarchy.md — "The skill `js-harness-protocols`, six sections"

### stale-prompts-sent
He could not tell a session that worked from one that waited on him, and sent prompts that were
already stale.
- Class: asked-of-him
- Seen: 2026-10-07 — docs/ROADMAP.md:1067-1069 — "sent stale prompts twice"; the day is that of his
  request, the days of the two sends are not stated
- Control: line — AGENTS.md — "End each reply with one state" — since 2026-10-09

### stopped-work-shown-live
A task stopped by hand, and a session that was archived, are printed by the board as live.
- Class: unseen-state
- Aka: failure 8 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-07 — odd/tasks/session-board.md:954-959 — a helper stopped at 05:47 still listed 38
  minutes later as work "with no recorded end"
- Seen: 2026-10-10 — relief file, line 67 — a Bash stopped with `TaskStop` keeps showing (answer 2)
- Seen: 2026-10-10 — relief file, line 117 — the killed waiter still shows; archived sessions
  printed like live ones (line 118; odd/tasks/session-board.md:1508-1510)
- Control: check — bin/lib/sessions.test.mjs — "renderBoard: a stopped task reads as stopped, and a
  session that closed or was relieved no longer reads as live" — since 2026-10-11

### stray-folder-untracked
A test run leaves `Microsoft/Windows/PowerShell/ModuleAnalysisCache` untracked in the worktree, and
an untracked path makes the review assessment answer "unassessable".
- Class: machine
- Aka: failure 11 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-07 — odd/tasks/codex-review-lean.md:758-763 — after the gate of `1c7b561`; removed
  by hand
- Seen: 2026-10-07 — odd/tasks/session-board.md:889-890 — "the second time in two gates"
- Seen: 2026-10-07 — odd/tasks/session-board.md:950-952 — again, seen while the gate ran
- Seen: 2026-10-08 — odd/tasks/codex-review-cost.md:166-169 — it made the first assessment read the
  candidate as unassessable
- Seen: 2026-10-10 — relief file, line 75 — in the worktree `session-board`; cause given at line 83
  (claimed); also odd/tasks/session-board.md:1362-1364
- Seen: 2026-10-10 — relief file, line 86 — in the worktree of JH 2; deleted at line 89
- Seen: 2026-10-10 — odd/tasks/gate-lock.md:318-320 — in the worktree `gate-lock`
- Seen: 2026-10-10 — relief file, line 118 — it made `gentle-ai review assess` return high,
  unassessable (claimed); untracked new files did the same at line 139
- Seen: 2026-10-11 — odd/tasks/rule-hierarchy.md, Progress — a gate killed at its bound left
  `Microsoft/` in the worktree `failures-register`, and the review row could not assess for it
- Seen: 2026-10-11 — relief file, line 292 — in a worktree of JH 5 during a gate; which test starts
  PowerShell with a stripped environment is not known, and nobody owns finding it (claimed)

### temp-folders-left
A test run killed at the gate's bound never removes its temporary folders; 2,357 of them were on his
disk.
- Class: machine
- Aka: failure 13 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 101 — 2,357 `js-harness-*` folders dated 10-01 to 10-10,
  counted by the orchestrator; 2,358 at line 105; also odd/tasks/gate-lock.md:316-317

### test-skipped-here-never-run
A test that this machine skips is run by no gate, so its expectation went stale and stood red with
nothing to say so.
- Class: unseen-state
- Seen: 2026-10-12 — relief file, line 425 — `bin/lib/project.test.mjs:1936` expects a reason that
  changed at ae471e7; Windows skips the test, and the first run on Linux (run 38296748258) showed
  it red (claimed; odd/tasks/gate-wait.md of `feat/gate-wait` at ea02144)

### test-wrote-real-home
A test that forgot `--home` wrote into the real home.
- Class: tool
- Seen: 2026-09-26 — bin/check.mjs:406-407 — the comment says "that happened once, and a rule in
  prose would not have stopped it"; 2026-09-26 is the day of that record (the comment, commit
  `59b18cb`), and the incident itself is not later than it and is in no record read
- Control: check — bin/check.test.mjs — "checkSensor runs the command with the home directory
  pointed at a throwaway directory" — since 2026-09-30

### told-him-unverified
He was told something about what he would see or what had happened that nobody had checked, and it
was not so.
- Class: wrong-information
- Seen: 2026-10-09 — docs/ROADMAP.md:436-437 — a session told him its check "runs on GitHub", where
  no workflow exists; also odd/tasks/subagent-model-routing.md:306-307
- Seen: 2026-10-09 — odd/tasks/session-board.md:1243-1244 — "you will see it in your list", without
  having checked; he did not see it
- Seen: 2026-10-10 — odd/tasks/session-board.md:1351-1353 — told that another session had probably
  run tests beside the failed gate; four transcripts showed none did
- Seen: 2026-10-10 — relief file, line 59 — what he was told about option 2 (a phone session
  inherits his default mode, line 49) was wrong: the transcripts record `auto`; corrected to him at
  line 61
- Seen: 2026-10-11 — relief file, line 196 — the lead's reading that pull requests 53 and 54 put the
  gate at its bound; they add 3.4 s (it had been said as an assumption)
- Seen: 2026-10-12 — the orchestrator's transcript 65318fd5, line 2008 (claimed) — the lead told him
  four times that JH 8's cut was pending after he had sent both blocks: a notice between sessions
  carried forward as a present fact; the stopgap is one line to the lead as a session's first act
  after a compaction
- Control: owed — odd/tasks/rule-hierarchy.md — "The honesty audit (C9): the transcript reader read
  first"

### two-blocks-out-of-order
Two blocks were given in one reply, he sent them out of order, and it cost a session.
- Class: asked-of-him
- Seen: 2026-10-07 — AGENTS.md:81-82 — "two, sent out of order, once cost a session"; 2026-10-07 is
  the day of that record (the sentence, commit `9c9b00d`), and the incident itself is not later than
  it and is in no record read
- Control: line — AGENTS.md — "Otherwise one block: two, sent out of order, once" — since 2026-10-09

### two-gates-at-once
Two sessions ran their gates at the same time, both ended red at the time bound and neither commit
was made; the rule "never two gates" was kept by hand.
- Class: rule-not-acting
- Seen: 2026-10-04 — odd/tasks/remote-control.md:312-321 — "the timeout was two gates at once" (a
  cap of 600 s then)
- Seen: 2026-10-07 — odd/tasks/session-board.md:879-888 — the first collision; this gate ended red
  after about 19 minutes
- Seen: 2026-10-07 — odd/tasks/session-board.md:942-949 — "two gates at once a second time", by the
  parent's own doing
- Seen: 2026-10-08 — odd/tasks/session-board.md:1037-1049 — both red, two commits not made; the same
  evening at odd/tasks/codex-review-cost.md:661-666 ("may have been two gates at once")
- Control: check — bin/check.test.mjs — "two check processes that share a home run their sensors one
  after the other, and the second says whose gate it waits for" — since 2026-10-11

### upgrade-cannot-work
`js-harness upgrade` cannot bring a copy up to date, and the hint it gives on a version mismatch
names something that does not exist.
- Class: tool
- Aka: the defect "upgrade cannot work" (relief file, line 17)
- Seen: 2026-10-09 — odd/tasks/session-board.md:1204-1211 — it asks a registry the package is not on
  (`404 Not Found`)
- Seen: 2026-10-10 — relief file, line 57 — on a mismatch the harness suggests installing from a tag
  `v0.1.0` and the repository has no tag; also odd/tasks/practice-project.md:194

### wait-not-attributable
A process that waits for a free machine cannot be attributed to its session from the board, and one
was taken for a leftover of another session.
- Class: unseen-state
- Aka: failure 7 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 115 — pid 28560 assumed to be the relieved orchestrator's; it
  was JH 2's (lines 116 and 117); also odd/tasks/session-board.md:1504-1507
- Seen: 2026-10-10 — relief file, line 174 — two `Wait-Process` alive, "owners not read, so not
  attributed"
- Control: check — bin/sessions.test.mjs — "each wait on the board is printed with the session it
  hangs from" — since 2026-10-11

### wait-tied-to-commit
A notice told a session that could not be reached to wait for commits that might never come, and
blocked it.
- Class: tool
- Seen: 2026-10-10 — relief file, line 96 — the wait of JH 2 would end only when two other branches
  moved; a second paste of his undid it (line 97); also odd/tasks/session-board.md:1461-1463

### wake-with-no-news
The watch returns on changes that ask nothing of anybody, and each return costs the orchestrator
context until it has to be relieved.
- Class: tool
- Aka: failure 14 (odd/tasks/rule-hierarchy.md; relief file, line 143); "FOR THE PRODUCT" (relief
  file, line 217)
- Seen: 2026-10-07 — odd/tasks/session-board.md:891 — "one more kind of wake that asks nothing of
  anybody" (only the entry's first line was read)
- Seen: 2026-10-09 — relief file, line 17 — "the watch wakes too often", written down as a defect
- Seen: 2026-10-10 — relief file, line 112 — about 60 wakes took an orchestrator from 28 to 72
  percent, each with a hook block of about 16 KB (a reading, not measured)
- Seen: 2026-10-11 — relief file, line 217 — twelve points of context in an hour, most of it wakes
  with no news
- Control: owed — odd/tasks/session-channel.md — "the watch wakes on a notice for the orchestrator"
- Proof: reliefs per working day, from `relieved` lines: at most one (owed: nothing prints it yet)
