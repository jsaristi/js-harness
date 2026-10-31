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
other places that record the same occurrence are named in its note. "The lead's own" in the evidence
marks a mistake the lead made itself, which `js-harness failures weeks` counts as the lead's; "the
lead's" alone names where a sighting was read, not who made it.

### answer-line-wrong-entry
The line of his answer was found by a text search and taken from the wrong entry, then written to
the record and sent to sessions without the line being read, in a command where the append did not
depend on `sessions --quote` exiting 0.
- Class: wrong-information
- Seen: 2026-10-13 — relief file, line 615 — lines 9780 and 9799 of the lead's transcript, early
  that day
- Seen: 2026-10-13 — the lead's message to JH 7 at 19:54 (claimed; the lead's own) — that evening,
  lines 12783, 12805, 12818 and 12838 were sent to four sessions for his answers at 12777, 12795,
  12814 and 12828 (each of the four read here with `sessions --quote`)
- Control: check — bin/notify.test.mjs — "an answer to a question-tool call is verified when the call
  was asked after its question, and answers it only by its prefix" — since 2026-10-13

### asked-yes-not-his
A session stopped and asked him for a yes on a step that was not one of the things that are his.
- Class: asked-of-him
- Aka: failure 1 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-09 — relief file, line 26 — session 593da809 waited 17 hours for his "Sí" to run its
  gate, push and pull request; withdrawn by it at line 141 as no question of his
- Seen: 2026-10-10 — relief file, line 119 — the orchestrator called the deferral of a test "his to
  accept" and JH 3 asked him; his words and the withdrawal at line 124; also
  odd/tasks/session-board.md:1598-1608
- Control: protocol — bin/lib/protocols-skill.mjs — "Decide everything else, say what it costs, and go on." — since
  2026-10-30
- Was: protocol — bin/lib/protocols-skill.mjs — "Ask only what is the user's; the project's" — replaced on
  2026-10-30: section 1's first line now holds the list of `rule:owner-decisions` instead of sending the reader to the
  project's files (odd/tasks/instruction-homes.md, T4), and keeps its last sentence
- Was: owed — odd/tasks/rule-hierarchy.md — "The reply check: `bin/lib/reply.mjs`,
  `bin/reply.mjs`"; that task landed as pull request 282, and the reply check turns back a reply with no
  state or a decision while work runs, not a yes asked on a step that is not his, so the control is the
  protocol written from this incident (section 1, its incident of 2026-10-09)
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
- Control: check — bin/check-codex-reviews.test.mjs — "after main is merged in, the push row hints
  the base the plain row sizes" — since 2026-10-14

### block-read-as-task
A block meant to hold his answer was worded as an instruction and he read it as a task for him to
run.
- Class: asked-of-him
- Seen: 2026-10-07 — odd/tasks/codex-review-lean.md:528-529 — read three times as a task to run in
  Codex; also docs/ROADMAP.md:363-365 and odd/tasks/rule-hierarchy.md:162
- Control: protocol — bin/lib/manifest.mjs — "Every question of the project reaches the user in one
  place" — since 2026-10-14
- Was: line — AGENTS.md — "never an instruction: one was read as his task." — replaced on
  2026-10-14, when a decision moved from a block he sends to the question tool, by his words (the
  lead's transcript 65318fd5, lines 12735 and 13110)

### block-referred-by-hour
A block he had not used yet was referred to by the hour it was given ("the block of 08:35") instead
of being repeated, and he had to search for it from the phone.
- Class: asked-of-him
- Aka: failure 3 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 142 — his words: "no me aparece el bloque del JH2"
- Control: check — bin/notify.test.mjs — "record with the clock, the sender, the role, the kind, the
  text and where it ran, then prints the address" — since 2026-10-11
- Proof: notices carried by his paste, counted by the board: 0 in the stretch of its "Done when"
  (owed: T9 and T11 of odd/tasks/session-channel.md; nothing prints it yet)
- Was: owed — odd/tasks/session-channel.md — "The failures this feature owns closed with their
  proofs" — replaced on 2026-10-15, when T12 closed, by the control the failure's row names in
  odd/tasks/rule-hierarchy.md ("no block for another session; a notice is a record"): a notice
  between sessions is a line of the record since pull request 59 (2026-10-11), not a block he
  carries

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
- Seen: 2026-10-15 — odd/tasks/future-model-protocol.md, L17 — JH 14 chained a board read after a
  test file's output while the gate of another worktree ran; it passed 120 s and was stopped
- Control: check — bin/lib/test-run-warning.test.mjs — "a board read waits for another gate" — since 2026-10-23
- Was: protocol — bin/lib/manifest.mjs — "a whole test suite, a measure, a read of the board and
  a sub-agent that runs tests wait for the gate to end" — replaced on 2026-10-23:
  it was seen again on 2026-10-15, after it; guard --hook now refuses the read while another gate holds the lock

### brief-waived-review-lines
A lead's brief for code work waived the feature document, whose gentle-ai lines the merge door asks
for every code commit while gentle-ai reviews (until F8's S2).
- Class: delivery
- Seen: 2026-10-28 — odd/tasks/board-follow-ups.md, L2 — the brief for JH 72 said "no feature
  document needed"; the merge door then refused PR 636, and JH 72 added per-slice gentle-ai reviews
  afterwards. The prevention: a lead's brief for code work never waives the feature document's
  gentle-ai lines before S2

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
- Seen: 2026-10-12 — session 9265156a (JH 7), by its own messages to the lead (claimed) — a commit,
  its push and its pull request were joined by `;` in one command, twice; each step succeeded, so
  nothing went out that its check would have stopped
- Seen: 2026-10-16 — session 265bdd78 (JH 21), its notices to the lead (read here) — the push of pull
  request 290 and the notice that it was pushed were joined by `;` in one command; the pre-push hook
  refused the push (a merge that resolved a conflict in code had no Codex record) and the notice said
  "pushed"; a second notice corrected it, and the push ran alone after the record
- Seen: 2026-10-16 — session fc81b0d2 (JH 24), its notices to the lead at 17:39 local (read here)
  — the push of pull request 328 after a merge of main and the notice "ready to land" were joined
  by `;`; the pre-push hook refused the push (the merge 78a5853 had no Codex record) and a second
  notice corrected the first, the same shape as the line above, with the protocol in force
- Seen: 2026-10-16 — session JH 26, commit `ff795ff` on `feat/resume-open-task` (read here) — an edit
  script and the gate's commit were joined by `;` in one command. The script threw on the feature
  document, and the commit ran with the roadmap change alone and a message saying the document closed.
  Commit `1f28794` wrote the document. The next tries were joined by `&&` and stopped where they failed
- Control: protocol — bin/lib/protocols-skill.mjs — "Two steps share one command only when the second is conditional on the first" — since 2026-10-16

### check-survivor-test-fails
A gate failed on one test of `bin/check.test.mjs`, "checkSensor kills a background process the command
left behind, and still passes", in a change that the test does not read, and the file passed alone. In
WSL2 the test's command is `node child.js &`: the survivor is the shell's background child, and the test
asserts the sensor returns within 60 s, passes, and that the survivor is gone within its bound. The
cause, reproduced in WSL2 by a survivor that writes its pid after 2.5 s: once the shell exits, the sensor
waits for the pipes only for its grace (`PIPE_GRACE_MS`, 2 s, `bin/check.mjs`) and then kills what the
shell left, so a survivor slower than that to start dies before it writes its pid. The test's shell now
waits for the pid before it exits.
- Class: machine
- Seen: 2026-10-15 — gate df5cd3cb of `D:\js-harness-worktrees\honesty-audit` (JH 15), in WSL2, end at
  15:48Z, by the gate log and the lead's notice — the only failing test of the run; its commit on
  feat/honesty-eval was refused, and the file passed alone on rerun — its output (JH 15's scratchpad
  `commit-pilot.log`, lines 5650 to 5663, read here): after 2,033 ms, `ENOENT ... survivor.pid` from the
  `readFileSync` of line 517, so the survivor never wrote its pid file; likely (not yet proven) the
  shell exits at once and the sensor kills what it left before a node slowed by load has started
- Control: check — bin/check.test.mjs — "checkSensor kills a background process the command left behind,
  and still passes" — since 2026-10-15

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
- Seen: 2026-10-12 — relief file, lines 325 and 337 — gentle-ai's review of pull requests 68 and 69
  was claimed in a message and written in a document of another branch; the merge queue now asks
  for it on the pull request's own branch (odd/tasks/rule-hierarchy.md, "The merge door (T16e)",
  item 5)
- Seen: 2026-10-28 — odd/tasks/f8-s10-port.md, L22 — the style probe scored 5 of 5 on replies it had not
  read, which only said the prompt was cut at its first space; read before it was reported, and the
  rerun counts a reply only when it answers
- Control: measured — odd/tasks/honesty-audit.md — "on 2026-10-15 the general honesty audit was measured not worth building" — since 2026-10-15

### citations-test-reads-clock
A test of citations cited a fresh commit's short hash, which a citation must hold a digit and a
letter to be (`bin/lib/citations.mjs:11`): about one run in 27 the hash came out all digits, was no
citation, and the test failed by the clock alone.
- Class: tool
- Seen: 2026-10-14 — odd/tasks/exact-tests.md, L9 — two gates of feat/exact-tests (19:28 and 19:56)
  failed it, the second in shadow, where selection would have skipped it
- Control: check — bin/check-citations.test.mjs — "only the lines a staged change adds to a feature
  document are read, and each unresolved citation is a line" — since 2026-10-14

### cli-updated-itself
A tool of the measured stack updated itself and nobody saw it until a measurement was about to run
on it.
- Class: unseen-state
- Seen: 2026-10-09 — relief file, line 13 — engram on the machine is 3.3.0, so the two trials left
  of F6 cannot run as planned
- Seen: 2026-10-10 — relief file, line 146 — `claude` on PATH is 2.1.296, replaced by the native
  updater on 2026-10-09 14:36 (claimed); also odd/tasks/subagent-model-routing.md:399-404
- Control: check — bin/doctor.test.mjs — "a stack tool updated since the reviewed versions is stale,
  named by the hook" — since 2026-10-16

### codex-cap-too-small
A fixed cap of Codex input tokens per feature was met again and again, and each time finished slices
waited for his answer. Since 2026-10-11 his rules give each review an allowance by the changed lines
of its slice (`codex-review-floor` and `codex-review-rate`, docs/RULES.md), and the plan of a review
says it.
- Class: asked-of-him
- Seen: 2026-10-10 — relief file, line 135 — 2,081,562 of 3 million used with tasks left (claimed);
  raised to 5 million at line 140; foreseen at odd/tasks/gate-lock.md:346-349
- Seen: 2026-10-10 — relief file, line 156 — 4,528,135 of 5 million used; the pre-push hook refuses
  the branch (line 163); raised to 6.5 million at line 164
- Seen: 2026-10-11 — relief file, line 218 — session channel: 2,780,275 of 3 million after two
  slices of five; the next slice gets no Codex review and no push (claimed)
- Seen: 2026-10-11 — relief file, line 220 — gate log: three slices do not fit in 3 million; both
  raised to 7 million at line 232
- Control: check — bin/lib/codex-review-allowance.test.mjs — "the allowance is the larger of the
  floor and the rate times the changed lines the plan holds" — since 2026-10-13

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

### command-handed-untested
A command he was handed to run on his machine had not been run first, and it broke what it wrote.
- Class: wrong-information
- Seen: 2026-10-30 — relief file, line 1963 (the lead's own) — the lead gave him `pnpm config set
  minimumReleaseAgeExclude "a,b" --global` untested; pnpm 12 wrote a string, his `config.yaml` no longer parsed and
  every pnpm and npm command failed; the lead rewrote it as a YAML list and read it back with `pnpm config get`
- Seen: 2026-10-30 — the lead's transcript 0f71b2c6, line 32954 (the lead's own) — the lead handed him a `bash` block,
  `rm -rf /d/js-harness-worktrees`, after its own runs of it were refused by the guard (lines 32882 to 32895); his
  shell is PowerShell, where `rm` is `Remove-Item`, and he got "Remove-Item: No se encuentra un parámetro que
  coincida con el nombre de parámetro "rf"" (line 32965); the fix then was a PowerShell command run first
- Control: check — bin/reply.test.mjs — "a reply handing him a block the session never ran with success is turned
  back" — since 2026-10-30
- Proof: `js-harness failures weeks`: no sighting of this entry from the week the reply check lands; its replay over
  the lead's transcript 0f71b2c6 refused all 9 of the replies that handed him a command block (odd/tasks/f8-lead-rigor.md, L11)
- Was: owed — odd/tasks/instruction-homes.md — "a command handed to him that writes his configuration is run
  first against a scratch configuration"; replaced on 2026-10-30 by the reply check's refusal of a command block not
  tagged for his shell, not run with success first or rejected by his shell's parser (odd/tasks/f8-lead-rigor.md, T4)

### command-run-for-help
A session ran a command it did not know, to read its help, and the command acted.
- Class: rule-not-acting
- Aka: the defect "install acts on a flag it does not know" (relief file, line 17)
- Seen: 2026-10-09 — odd/tasks/session-board.md:1183-1198 — `install --help` installed two skills
  and two hook entries on his machine; also odd/tasks/subagent-model-routing.md, "Subagent models result" and :481
- Seen: 2026-10-10 — relief file, line 54 — `claude remote-control --help` printed nothing and hung
  120 s; odd/tasks/session-board.md:1335-1339 calls it the same mistake, a day after the rule was
  written
- Seen: 2026-10-12 — relief file, line 349 — the lead ran `install --help` to read the help and it
  installed four files and a hook entry on his machine
- Seen: 2026-10-12 — relief file, line 409 — JH 8 ran `check --help` and it started a gate, which
  went to wait and was stopped before it ran anything (claimed)
- Control: check — bin/writing-flags.test.mjs — "exits 2, names the flag and writes nothing" — since
  2026-10-14

### commit-attribution-from-host
A session wrote the host's attribution lines into a commit message, which this repo's own rule
forbids: the host's reminder asks for them, and its own text says the user's instructions come first.
- Class: rule-not-acting
- Seen: 2026-10-29 — JH 88, its first commit of feat/lead-manual-steps — the message carried
  `Co-Authored-By` and `Claude-Session`; the commit was stopped while its pre-commit gate waited for
  the gate lock, so none was made, and it was made again without them
- Seen: 2026-10-30 — JH 107, commit 09489509 of worktree-f8-desktop-plan — the message carried
  `Co-Authored-By` and `Claude-Session`, and it was pushed before the session saw it; it stays, since
  the branch is never force-pushed, and the next commits carry neither
- Seen: 2026-10-30 — JH 109, every commit of f8-s9-host-watch from 6de916b7 to the fix of R3-001 on
  f8-s9-review, 20 in all, those of PRs 717 and 718 merged — the session's summary of its own rules,
  carried over two compactions, listed the attribution lines as this project's rule; it saw the
  breach only on reading JH 107's summary; nothing is rewritten (main is never rewritten, the branch
  never force-pushed), and the next commits carry neither. Third sighting: the protocol line did not
  stop it, so a `commit-msg` check is the next step (`bin/`), proposed to the lead
- Control: protocol — bin/lib/rules-block.mjs — "or AI attribution to commits. Use conventional
  commits only" — since 2026-10-29

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
- Control: check — bin/check-commit-size.test.mjs — "a staged change over the changed lines a
  reviewed commit holds fails the gate" — since 2026-10-16
- Proof: the row `codex-review` (debt) prints the size of a range (`checkCodexReviewDebt`,
  `bin/check.mjs`), and the row `commit-size` that of each commit before it is made

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
- Seen: 2026-10-07 — docs/ROADMAP.md:359 — a session reached 77 percent of 500k unnoticed (the day
  is that of his request; the day it happened is not stated)
- Seen: 2026-10-10 — relief file, line 75 — a session said 80 percent where the board said 68,
  inside a task that could not close
- Seen: 2026-10-10 — relief file, line 155 — the orchestrator went from 63 to 79 percent with its
  own context "read too seldom"
- Seen: 2026-10-11 — relief file, lines 276 to 285 — the orchestrator passed the pause, judged four
  times that little was left, and the host compacted it with no word to him (its own report)
- Control: check — bin/lib/pause.test.mjs — "the crossing: the first call at the pause says the
  share, the room and the text" — since 2026-10-12
- Was: check — bin/sessions.test.mjs — "--watch returns when a session reaches the context pause" —
  replaced on 2026-10-16: it was seen again on 2026-10-11, since a watch never reports the session
  that runs it; since 2026-10-12 a hook after each tool call tells the session itself that it is at
  the pause (bin/lib/pause.mjs)

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
- Seen: 2026-10-13 — relief file, line 550 — three messages of JH 7, written between 00:52 and
  01:10, reached the lead after 04:20, held by the host
- Control: check — bin/doctor.test.mjs — "as the session-classes gap, whose fix is the install
  flag" — since 2026-10-14
- Proof: a practice step: a notice read with no message sent (owed: the journey's step `channel`,
  `scripts/practice-lib.mjs` JOURNEY, ran "13 of 13 steps passed" on b0d0af2 in draft pull request
  199, not on main yet; odd/tasks/session-channel.md, Progress, 2026-10-15 06:27)

### design-not-faithful
A design document passed gentle-ai and its own contract and still dropped or misstated decisions of
his and named files that do not exist.
- Class: delivery
- Seen: 2026-10-10 — relief file, line 181 — four blocking items found by a reader that did not
  write it; also odd/tasks/rule-hierarchy.md:768
- Control: check — bin/check-citations.test.mjs — "each unresolved citation is a line" — since
  2026-10-14

### diagnostic-whole-gate
A retry command ran a whole gate as a diagnostic after a failed commit, twenty minutes of the
machine for nothing.
- Class: machine
- Seen: 2026-10-10 — relief file, line 83 — the third run, 03:21 to 03:41 (claimed); also
  odd/tasks/session-board.md:1350-1351
- Seen: 2026-10-27 — odd/tasks/f8-s1-reviews.md, L9 — JH 62 ran a failed commit again to read its failing
  test, a second CI run of about 165 s, when the first run's output, cut by `tail`, already pointed at the
  failure; the name of the failing test is on the gate's `✖ failing tests:` lines, read from the first run
- Seen: 2026-10-30 — odd/tasks/f8-lead-rigor.md, L13 (JH 106) — in small: eight test files run twice through
  `js-harness gate`, about four minutes, because a `grep | head` of the first run kept help lines and cut its summary

### doctor-lock-mtime-ms
A test of `bin/doctor.test.mjs`, "doctorMain shows the pnpm-lock row stale for a global bin lock left over
in the given PNPM_HOME, its rmdir under Fix, and the hook notices it", set the lock folder's time an hour
back and expected doctor to print that exact millisecond. ext4 under WSL2 loses a millisecond of it about
one time in three, so the test failed at random in the gate's WSL leg, on branches and land candidates that
touched nothing of doctor, and pull requests 305 and 313 were blamed for it. It was fixed in 18f2a598 (PR
315, on main at 20:49Z): doctor prints the stored time, and the test now expects the stored time too.
- Class: tool
- Seen: 2026-10-16 — the gate log (~/.js-harness/gate-log), read by JH 28 on 2026-10-17 — it failed in 6
  gates on 5 worktrees from 17:45Z to 21:13Z: plan-from-records, the land candidates merge-queue-155940
  (19:20Z, 19:41Z) and merge-queue-167556 (20:24Z), jh25 and stalled-sessions, the last two on branches
  not yet merged with the fix; JH 25's notice of 20:57Z named the cause
- Control: check — bin/doctor.test.mjs — "doctorMain shows the pnpm-lock row stale for a global bin lock
  left over in the given PNPM_HOME" — since 2026-10-16

### documents-commit-skips-suite
A commit of declared documents alone runs no sensor, and the suite reads those documents: such a
commit can break a test, pass its own gate, and fail the next gate with code in any session.
- Class: rule-not-acting
- Seen: 2026-10-12 — relief file, line 407 — found by reading and not by a gate that broke (JH 8,
  claimed): the skip is `bin/check.mjs:279-287`, and `bin/rules.test.mjs:480` runs `rules check`
  on the real `docs/RULES.md` and `docs/rule-sources.json` (`bin/rules.mjs:24-25`); until the gate
  runs the readers of a staged document, `rules check` is run by hand after such a commit
- Control: check — bin/check.test.mjs — "a commit of documents alone runs the sensors of documents,
  in their order and with a bound of two minutes" — since 2026-10-12

### documents-merge-runs-gate
A merge of `main` into a pull request of documents alone staged `main`'s code, so its hook ran a whole
gate for a change that held no code.
- Class: machine
- Seen: 2026-10-14 — relief file, line 720 — the merge into pull request 120 ran a whole Windows check
  at 03:09 and cost about 10 minutes of the lock; the skip owed (the merge equals its `main` parent
  plus declared documents) is JH 8's, in docs/todo.md
- Seen: 2026-10-14 — relief file, line 741 — at 05:40 documents commits still took a whole gate
- Control: check — bin/check.test.mjs — "a merge of the trunk into a branch of documents runs no
  sensor when the merge differs from the side it merges only in documents" — since 2026-10-14

### door-covers-past-tip
The merge queue's door called a pull request's commit covered by a record whose head lies past the
pull request's head, a cover that holds only while that head is the tip; the push of main checks the
candidate's merge, past which nothing lies, and refused it after a whole land, whose refusal then
printed only git's "failed to push some refs".
- Class: tool
- Seen: 2026-10-29 — the channel, the lead's notice at 03:01Z and JH 79's answer at 03:04Z — the land
  of 644 and 646, green here and on GitHub Actions, refused at the push: 35c8d1fd of PR 644 lay in
  Codex c8ee437..8a412b7 and lens 62315e6..8a412b7, whose head 8a412b7 was past PR 644's own head,
  the first of a stack landed alone; about 25 minutes lost
- Seen: 2026-10-30 — `odd/tasks/f8-s12-migration.md` L18 (JH 93) — a chain cut at `1488343e`, `abe05fd3` and
  `5058d55e`, inside Codex and lens `24c47ca..09ae012`, passed the pre-push hook at each cut and opened PRs 690-692;
  `notify --kind ready --pr 690` refused it as the door does; the three were folded into 693, about 10 minutes lost
- Seen: 2026-10-29 — the lead's land log `land-658-660.log` and notice at 10:29Z — the door printed
  "4b85503f ...: Codex a7b6ae4..f30d360 reviewed"; feat/visual-pages-e was reviewed to f30d360 and
  its PR then ended at 4b85503f, its parent, so the push of the candidate b5236e3 refused 4b85503f
  for both records (reproduced on the records as they stood at 10:25Z: covered at the tip 4b85503f,
  uncovered at b5236e3)
- Control: check — bin/check-codex-reviews.test.mjs — "check --push refuses a cut inside a reviewed range on both
  rows, as the merge door refuses it, and names the head to push to" — since 2026-10-30
- Was: check — bin/merge-queue.test.mjs — "a record whose head lies past the pull request covers it at its head and
  not merged: the door refuses it before a candidate, as the push does" — replaced on 2026-10-30: it held the door
  alone, and the pre-push hook still counted a record past the pushed commit (`reviewCoverage`); since JH 112
  (odd/tasks/gate-push-holes.md, L3) the push row, the plain rows and `codex-review` count none (`beyondTip: false`),
  so the cut is refused at the push as at the door; the door's test stands

### door-reads-pr-alone
The merge queue's door read each pull request merged onto main alone, while the push of main reads
the whole candidate: a sibling that turned the Codex review on, or took a `-codex-review` mark off,
let another's code pass the door and then fail the push.
- Class: tool
- Seen: 2026-10-29 — PR 663's body, "Finding 2", and
  docs/sessions/2026-10-29-jh-83-merge-door-reads-review-coverage-like-pre-push.md, "Left" — found by
  JH 83's independent verifier reading `reviewEvidence`; no land had hit it yet
- Control: check — bin/merge-queue.test.mjs — "a pull request that turns the Codex review on is read
  onto the candidate so far" — since 2026-10-29

### edit-during-review
A tracked file was edited in the worktree while Codex reviewed it, so the run read a tree that was
not the committed range, wrote no record and had to be run again.
- Class: delivery
- Seen: 2026-10-27 — this entry's own commit (JH 66, lens reader) — `docs/FAILURES.md` edited during
  the Codex review of `d6867d8..484df03`; 68,470 input tokens spent on a run that recorded nothing
- Seen: 2026-10-28 — `odd/tasks/f8-s1-reviews.md` L16 (JH 69, T7) — a tracked file edited during the
  Codex review of `9e167848..d153e61e` (run b2dfaa03 in `codex-review-runs.jsonl`); 79,701 input tokens spent
  on a run that recorded nothing, and the review ran again
- Seen: 2026-10-28 — `odd/tasks/f8-s5c-a-coverage.md` L6 (JH 73) — a test file written to fix a lens finding
  during the Codex review of `947ac91..62f4a62`; 353,663 input tokens spent on two parts of 8, nothing recorded
- Seen: 2026-10-29 — `odd/tasks/stretch-forecast.md` L5 (JH 89) — `docs/FAILURES.md` edited for T6 during the
  Codex review of `b60053a..5aed8af`; 181,101 input tokens spent on part 1 of 2, nothing recorded, run again
- Seen: 2026-10-30 — `odd/tasks/f8-s13-rehearsal.md` L12 (JH 90) — `docs/ROADMAP.md` committed during the Codex
  review of `bb6223b..1a21375`, with the lenses running beside it; 58,369 input tokens spent on part 1 of 3,
  nothing recorded, run again
- Seen: 2026-10-30 — `odd/tasks/f8-s12-migration.md` L11 (JH 93) — that document and `docs/ROADMAP.md` edited
  during the Codex review of `24c47ca..09ae012`, after the lenses had finished; 226,291 input tokens spent on part 3
  of 3, nothing recorded, that part run again (parts 1 and 2 kept)
- Control: check — bin/codex-review.test.mjs — "an edit of a tracked file made while Codex reviews
  leaves no record: the tree is no longer the committed range" — since 2026-10-12

### engram-listener-unseen-at-kill
A gate failed on one test of `evals/isolation-probe.test.mjs` (line 1734), "the probe stops what the
trial left listening on its engram port, by number, and leaves nothing behind", in a change that touched
nothing of the evals. The test asserts that its cleanup found exactly one listener on the trial's port
when it killed it (`killed` deep-equal to `[[port, 1]]`). That the stand-in server had not yet listened,
or had already gone, under load is assumed, not checked: the run's own assertion text was not read. Since
2026-10-16 the file is quarantined in docs/FLAKY.md: it still runs in every gate, and a pass on its rerun
does not block until the entry expires on 2026-10-23.
- Class: machine
- Seen: 2026-10-16 — the land of PR 350 in WSL2, gate log c603935e, under 59 percent load, by the lead's
  notice to JH 28 (a claim) — the only failure of that test in the gate logs; PR 350 touches nothing of
  the evals, and the file alone in WSL2 on 350 and main gave 120 pass, 0 fail (JH 24, by the same notice)
- Control: check — bin/check-flaky.test.mjs — "a red suite whose failed file passes alone and is
  quarantined does not block, and a rerun row says why" — since 2026-10-16

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
  (odd/tasks/session-channel.md, "Session channel"); counted, 15,467 (claimed by JH 6)
- Seen: 2026-10-13 — relief file, line 615 — "62 of 352, modest", the figure of JH 10's first
  version of a design, was told to him before its readers had read it; its readers made it about a
  third. A figure reaches him only from the version after the readers
- Seen: 2026-10-14 — this session's (JH 7) transcript 9265156a, its replies of about 05:20 and
  06:00 — "Contexto cerca del 35 %", said without a read; `get_usage` read 76 percent at 06:25,
  the first read after 26 percent at about 04:30
- Control: check — bin/guard.test.mjs — "a reply whose stated own share is more than 2 points off
  the recorded one is blocked from stopping, with the reason" — since 2026-10-15

### eval-interrupt-process-alive
A gate failed on one test of `evals/suite.test.mjs`, "an interrupt during a real trial against a
hanging fake agent leaves nothing of it", because the fake agent's process still answered (state R)
when the test looked, in a change that touched nothing of the evals. The fix is PR 198
(fix/sweep-waits-for-exit, on main 2026-10-15 at 11:15Z): a run ends only after the group it killed is
gone. The file was quarantined in docs/FLAKY.md from 2026-10-15; the quarantine was lifted on 2026-10-17,
since the test failed in none of the 408 gates with a tests sensor the gate log holds (from 2026-10-15
17:02Z) and passed 10 of 10 alone in WSL2, so it blocks again when it fails.
- Class: machine
- Seen: 2026-10-14 — JH 15's gate in WSL2, about 15:45, by the lead's notice of 2026-10-15 — `alive:
  [false, true]`, the grandchild in state R at the assertion; the file passes alone
- Seen: 2026-10-15 — JH 15's gate in WSL2, about 01:30, by the lead's notice — `alive: [false, true]`,
  the grandchild in state R; the file passed in the gate of cfee7ae
- Seen: 2026-10-15 — JH 10's gate of fix/pause-no-idle, in WSL2 — `alive: [false, true]` where
  `[false, false]` was expected, pid 22809; the only failing test of the run
- Seen: 2026-10-15 — JH 8's gate of fix/launcher-at-start, in WSL2 — the second entry of `alive` true
  where false was expected, pid 22900 "answers" at the exit; the only failing test of the run, in a
  change that touched nothing of the evals, and one of the files the shadow would have skipped
- Control: check — evals/runner.test.mjs — "a run ends only after what it killed is gone, and one that
  outlives the bound is reported as a sweep error" — since 2026-10-15

### eval-missing-login-workroot-kept
A run on GitHub failed on one test of `evals/codex-configs.test.mjs`, "a missing login stops the trial
before the agent starts", because the work root still held the trial's directory when the test read
it, in a change that touched nothing of the evals.
- Class: machine
- Seen: 2026-10-15 — PR 185's GitHub run 38705933668, on Linux, by the lead's notice — line 198,
  `readdirSync(workRoot)` gave `['eval-m3TuMV']` where `[]` was expected: its cleanup had not ended
- Seen: 2026-10-15 — PR 185's GitHub run 38722955417, on Linux, by the lead's message to JH 21 —
  `actual: [ 'eval-k9fHPH' ]` where `[]` was expected, under `--test-concurrency=2`; the only failing
  test of the run (odd/tasks/drop-github-gate.md L2)
- Control: check — evals/configs.test.mjs — "the fixture commit starts no git maintenance: nothing of
  it writes in the workspace once prepare has returned" — since 2026-10-15

### failure-cause-dropped
The facts the pages read of a stretch left out the words that say why a land or a Codex review
failed: `landFacts` dropped a land record's `said`, and `codexFacts` a run's `reason`, so a failure
read as an exit code or an outcome alone.
- Class: unseen-state
- Seen: 2026-10-29 — docs/sessions/2026-10-29-jh-79-visual-pages-the-harness-shows-its-moments-as-pages.md,
  "Left" — found closing visual pages; `stretch explain` was the only way to say why
- Control: check — bin/lib/throughput.test.mjs — "a land keeps the last line it said, and a Codex run
  the reason it was logged with" — since 2026-10-29

### fixture-refuses-late-check
The rules tests' fixture owed every check since the coverage register's baseline, which a rule
declared after the baseline cannot be, so a check control on such a rule turned eight tests red and
a weaker control was chosen to keep them green.
- Class: tool
- Seen: 2026-10-29 — docs/sessions/2026-10-29-jh-80-templates-everything-he-sees-made-by-a-command-and-hel.md,
  line 56 — a check-level control broke 8 tests of `bin/rules.test.mjs` and
  `bin/rules-coverage.test.mjs`; PR 662 used a protocol control instead
- Control: check — bin/rules.test.mjs — "the fixture owes the check of a rule declared after the
  baseline" — since 2026-10-29

### flags-guessed
A session ran a harness command with flags it guessed, instead of reading the command's usage first.
- Class: wrong-information
- Seen: 2026-10-30 — the lead's note to JH 106 at 17:20Z (claimed; the lead's own) — the lead guessed the flags of
  `js-harness notify` twice before reading its usage

### gate-at-its-bound
A gate reached, or came within seconds of, its bound of 1,200 s with no test failing, and the commit
was not made. Since 2026-10-11 a gate on a loaded machine names what loads it under its load row
(`bin/check.test.mjs`, "a gate on a loaded machine names what loads it in lines under the load
row"); that tells the load and stops nothing. Since 2026-10-14 this repository's gates run their
sensors in WSL2 (`sensorsInWsl` in harness.json), because the suite took 11 to 12 minutes on Windows
(odd/tasks/gate-wsl.md, "Why"); on 2026-10-14, 46 gates had a median of 137 s and a p90 of 240 s
(odd/tasks/exact-tests.md, "Why").
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
- Control: check — bin/check.test.mjs — "a gate on a machine whose switch file names a distribution
  runs its sensor there, from a mirror of its tree" — since 2026-10-14

### gate-mark-hides-failures
Tests passed in the gate and failed when run by hand. They inherited the gate's mark of a held turn
(`JS_HARNESS_GATE_HELD=1`), which changes what the code under test does, so no gate could see them fail.
The gate also runs its tests in WSL, so a failure that only Windows shows is out of its sight too. Only a
run by hand on Windows, out of a turn, sees both.
- Class: unseen-state
- Seen: 2026-10-15 — evals/review/compare.test.mjs — since e06cf68 ("run the review out of the gate
  lock"), six tests of the review comparison failed when run by hand and passed in the gate. The failure
  was taken for a Windows-only one until a bisect of the one test showed that the mark decided it, not
  the platform
- Control: check — evals/review/compare.test.mjs — "a cell out of a turn of the gate lock is refused before
  anything is made, with the command that runs it" — since 2026-10-15

### gate-narrow-pass-stood
A commit entered on the proof of a pass narrower than the run that had failed on its tree: its tests failed on
GitHub's machines, a check by hand of the same tree then passed in the WSL mirror, where the failing test skips itself
(no `.git` there), and the next commit's gate took that pass as `same` and ran nothing. The proof read only the last
pass with the tree's key, and a gate on CI wrote no key. main was never exposed: the merge queue runs the whole gate on
GitHub Actions.
- Class: tool
- Seen: 2026-10-30 — the gate log, lines 307-311 (`~/.js-harness/gate-log/log.jsonl`) — CI fail 789d081d, WSL pass
  efdfe8aa with 214 of 312 tests skipped, `same` by it; commit 98d4c7cb entered with
  `bin/lib/gentle-ai-absence.test.mjs` red (odd/tasks/f8-s9-host-watch.md, L8)
- Seen: 2026-10-30 — the gate log, lines 312-316 — CI fail 08d76a43, WSL pass ecc088b0, `same` by it; commit 60bddd22
  entered the same way; fixed in f3274d4c
- Control: check — bin/check.test.mjs — "a tree whose tests failed on CI is not proven by a narrower pass here: the
  next commit goes to CI again and is refused" — since 2026-10-30

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

### guard-off-when-copy-behind
The guard let sessions open with a title that carried no project code and number, because the
installed copy the hooks run was behind the project's rules file: `ruleHere` gave `off: 'behind'`
whenever the two lists differed by a byte, and every rule of this repository the guard holds
(session-title, the model, opening and effort rules) went off without a word after each landed rule
change. The free titles of 2026-10-19 came before the title guard existed; these came with it.
- Class: rule-not-acting
- Seen: 2026-10-23 — the lead's transcript 908805db, line 23255 — "Audit · ledger, inventory and
  checks" started with no JH number
- Seen: 2026-10-24 — the lead's transcript 908805db, line 36441 — "Codex hook trust: doctor,
  uninstall, README" proposed and started with no JH number
- Seen: 2026-10-24 — the lead's transcript 908805db, line 37307 — "Start sessions without his typed
  message" started with no JH number; the installed guard (pnpm global 0.97.0 at 9cb4eb28) passed a
  free title that the repository's guard refused
- Control: check — bin/lib/session-title-guard.test.mjs — "behind a project whose list declares
  session-title, a free title is refused as here" — since 2026-10-25

### hand-made-output
An output he sees again and again reached him made by hand, in a shape other than the one planned,
where a command should have made it; each escape `template shown` names is one more `- Seen:` line.
- Class: rule-not-acting
- Seen: 2026-10-27 — odd/tasks/memory-notes.md, "Moved out of memory" (claimed; the lead's own, from its memory note
  board-rows-through-notify) — hand-written rows of the live board gave the lead two `session` keys, so the board
  showed two orchestrators; his words: "necesito que hagas las cosas bien"
- Seen: 2026-10-29 — the lead's transcript `0f71b2c6`, lines 14687 and 14721 — the 02:44Z page went
  by `mcp__visualize__show_widget`, retyped, not the planned one; his words at 14721 (odd/tasks/templates.md, Specs)
- Control: check — bin/template.test.mjs — "gate --hook refuses a hand-made page by Artifact with the
  hooks contract" — since 2026-10-29

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
- Seen: 2026-10-15 — docs/FAILURES.md, gate-mark-hides-failures — JH 9 and its bisecting sub-agent each
  ran the whole of evals/review/compare.test.mjs (65 to 132 s) outside the lock, beside gates in line
  (their own reports)
- Seen: 2026-10-16 — odd/tasks/rule-hierarchy.md, Progress of 2026-10-16 — JH 7's verifier ran
  bin/lib/rules-change-run.test.mjs (about 200 s) outside the lock beside JH 7's own gate, which
  failed on a sensor test that passed alone three times
- Control: check — bin/lib/test-run-warning.test.mjs — "one test file the gate log times over a
  minute counts as several: refused while the lock is held" — since 2026-10-16
- Proof: the gate log shows no overlap; owed with 9 (`gate-ran-unseen`) (owed: nothing prints it
  yet)
- Was: protocol — bin/lib/manifest.mjs — "A whole test run of your own goes through" — replaced on
  2026-10-16, after two single test files ran beside gates past it (2026-10-15 and 2026-10-16), by
  the guard's refusal of odd/tasks/first-version.md, T6a: a file the gate log timed alone over a
  minute counts as several, and an eval batch's mark counts as a gate's holder

### hold-read-after-build
A session was told to hold before building, and built: the message waited behind its own turn
while it acted on another session's answer.
- Class: unseen-state
- Seen: 2026-10-13 — relief file, line 544 — the lead's hold on two pieces of JH 7 was written at
  00:41 and queued; JH 7 read it at 00:52, after JH 8's "start now" and with both pieces
  written (odd/tasks/rule-hierarchy.md, Progress of that day). Nothing was spent on Codex or
  pushed; one sub-agent and the session's own turns were. His answer later lifted the hold

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

### host-review-without-research
A host update was recorded as reviewed after a check that nothing the harness uses broke, with no study of what the
update brings and what the harness should adopt, adapt or ignore from it.
- Class: rule-not-acting
- Seen: 2026-10-30 — the lead's transcript 0f71b2c6, line 29697 (the lead's own) — `doctor --host-reviewed
  --stack-reviewed` recorded his Claude Desktop update at 13:12Z, though the row's fix list asks for a full account
  of the update; he said at line 33399 that he got no clear account of how it could improve the harness; the fix
  then: JH 105 researches the update (the lead's relief note, line 33432)
- Control: check — bin/doctor.test.mjs — "a refused review records nothing" — since 2026-10-30
- Proof: `js-harness failures weeks`: no sighting of this entry after the week of 2026-10-26
- Was: owed — odd/tasks/f8-lead-rigor.md — "S2 — the host review file and the `--host-reviewed` gate" — replaced on
  2026-10-30 by the check, which T3 of that document built

### hours-guessed
Hours written in the relief file were not read from a clock.
- Class: wrong-information
- Aka: failure 18 (odd/tasks/rule-hierarchy.md); unnumbered in relief file, line 202
- Seen: 2026-10-10 — relief file, line 96 — a roster line said 04:40 and was written about 04:29
- Seen: 2026-10-10 — relief file, line 172 — seven hours in lines 166, 169 and 171 were guessed
- Seen: 2026-10-12 — relief file, line 407 — three messages of the lead carried hours it guessed
  (13:02, 13:09, 13:10 for 13:00 to 13:06); the control stamps a relief line, not a message
- Seen: 2026-10-12 — relief file, line 436 — a message of JH 7 stamped 14:58 was sent at 14:53;
  a second one the same day said 16:47 for 16:45 (odd/tasks/rule-hierarchy.md, Progress of that
  day)
- Seen: 2026-10-12 — the orchestrator's transcript 65318fd5, line 4959 — a message of the lead
  stamped "14:46 local by date" was sent at 14:44; found by JH 15's reader
  (odd/tasks/honesty-audit.md, Log), the time read again here from the line's timestamp
- Seen: 2026-10-12 — the orchestrator's transcript 65318fd5, line 5409 — "15:47 local by date" was
  sent at 15:41; found by the same reader, read again here the same way
- Seen: 2026-10-13 — the lead's message to JH 7 at 20:17 (claimed; the lead's own) — the hours of
  its messages "by date" ran about seven minutes ahead, carried from an earlier read
- Seen: 2026-10-14 — odd/tasks/rule-hierarchy.md, Next step, commit 6e32a44 — JH 7 wrote "about
  05:40" in a block committed when the clock read 05:15; corrected in 16db546. The control stamps a
  relief line, not a feature document
- Seen: 2026-10-16 — the record of notices, D--js-harness.jsonl — 73 of the 74 lead notices that
  opened "HH:MM JH ORQ:" (10-15 to 10-16) were more than a minute off the local clock: notify text
  sent through Bash met no hour check (bin/guard.mjs:81 holds only message tools)
- Control: check — bin/notify.test.mjs — "a notice whose text stamps an hour more than a minute off
  the clock is refused, with the right hour, and not recorded" — since 2026-10-16
- Proof: messages to another session: bin/guard.test.mjs:54, "a message to another session, by
  either tool, is denied when its stamped hour is off the clock", on main since pull request 157
  (2026-10-14); a feature document or a committed block: the documents line below
  (bin/lib/document-hour-guard.mjs, T12b), which refuses only an hour ahead of the clock, since a
  document also records earlier events
- Proof: documents: bin/guard.test.mjs, "a Write or an Edit of a Markdown file whose line opens with
  today and an hour ahead of the clock is denied", since 2026-10-15; notices: the control above
  (odd/tasks/wake-and-flag.md, T4); the relief file stays out, as its opening hour is often an event
- Was: owed — odd/tasks/session-channel.md — "An hour a session writes in a feature document or a
  block it commits is read from the clock" — from 2026-10-15 until T12b was built the same day
- Was: check — bin/lib/channel.test.mjs — "a relief line is stamped with the local date and time
  of the clock, and says the command wrote it" — since 2026-10-11; seen again on 2026-10-12 to
  2026-10-14 in messages and a feature document, which it does not stamp; replaced on 2026-10-15

### init-leaves-codegraph-files
`init` runs `codegraph init`, which writes files under the home that no manifest records, so
`uninstall --global` leaves them: what the harness writes outside the repository is not undone
exactly.
- Class: tool
- Seen: 2026-10-14 — README.md, "## Remove" — after `install`, `init`, `uninstall` and `uninstall
  --global` in an empty temporary home, the home kept `.codegraph/telemetry-queue.jsonl` and
  `.codegraph/telemetry.json`, beside the empty `.claude/`, `.codex/` and `AppData/Roaming/`; the
  fix (record what `codegraph init` creates, or remove those two files on uninstall) is JH 9's, in
  docs/todo.md
- Control: check — bin/lib/project.test.mjs — "runCodegraphInit runs codegraph with DO_NOT_TRACK=1, so it
  writes nothing under the home, on every platform" — since 2026-10-14

### install-stop-strands-entries
An install that stopped after it wrote its hook entries and before it wrote its manifest left them
named by no record; the next install took them for the user's, and `uninstall` left live hooks of
a removed tool in the host files.
- Class: tool
- Seen: 2026-10-29 — docs/sessions/2026-10-29-jh-81-uninstall-keeps-a-users-hook-entry.md, "A lost
  manifest" and "Follow-ups" — found by JH 81's independent verifier on PR 657; reproduced by JH 84
  on main `8c45db81`, the Claude settings left with every hook of ours after install, install and
  uninstall
- Control: check — bin/lib/manifest.test.mjs — "an install that stops before its manifest is
  written leaves its entries recorded as its own, and uninstall takes them out" — since 2026-10-29

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

### land-took-pending-pr
`merge-queue --land` took a pull request that was open as ready while a step only he could do, a walk through
the console, was still pending.
- Class: delivery
- Seen: 2026-10-30 — the lead's note to JH 106 at 17:20Z (claimed; the lead's own) — the land took PR 596; the lead
  stopped it before any push (main unchanged at 04e3d29d) and turned 596 to a draft, which GitHub records at
  17:18:12Z; its timeline has no ready-for-review event, so it was opened ready

### language-server-load
A TypeScript language server per session works whenever tests write files, takes up to a whole
processor, and gates slow down or reach their bound. Since 2026-10-11 a gate on a loaded machine
names the server under its load row (`bin/check.test.mjs`, "a gate on a loaded machine names what
loads it in lines under the load row"); that row tells of it and stops nothing. Since 2026-10-14 a
project with no TypeScript has the language server's plugin off (`js-harness functions`), as this
repository has.
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
- Control: check — bin/lib/project-apply.test.mjs — "a project with JavaScript and no TypeScript: the
  paste off, the plugin off, an index made, the push check wired" — since 2026-10-14

### lens-refusal-unread
A Claude lens answer was refused as "not one JSON object" and neither the run's output nor its
record showed why: the reader parsed the whole text, so a line before or after the object was
enough, and the record keeps only the answer's first 300 characters. Whether the refused answers
held such a line or a broken object was never read; a rerun of the same range answered clean.
- Class: unseen-state
- Seen: 2026-10-27 — odd/tasks/f8-s1-reviews.md:164-168 (L10) — readability on
  `4834997f..023eceb9`; its answer was not kept, and a run alone after it was complete
- Seen: 2026-10-27 — `lens-reviews.jsonl` in the git directory, the incomplete runs of 23:09:08Z and
  23:10:12Z over `d6867d8..d90cd20` (JH 65) — risk, then reliability, each answer starting as the
  object; the range was recorded as a skip, which holds its pull request at the merge door
- Control: check — bin/lib/lens-result.test.mjs — "an answer that is not one complete object is still
  refused, and says what it holds" — since 2026-10-27

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
- Control: check — bin/lib/gate-lock.test.mjs — "a gate that arrives while an older one waits does
  not take the lock when it is free: the older one takes it, and the newer one after it" — since
  2026-10-12

### memory-note-overwritten
A session saved a memory note under a name another session had just used, without looking for
one, and the first text was lost.
- Class: rule-not-acting
- Seen: 2026-10-12 — the memory note `questions-through-the-question-tool` of this project, its
  last paragraph — written by another session at about 19:57 and overwritten by JH 7 a moment
  later; what is there is JH 7's rewrite, and the rule's fuller record is the note
  `questions-with-buttons`, untouched

### merge-review-covers-main
A merge of the default branch in which somebody wrote a few lines became a code commit whose
review covers everything the merge brought, code that already had its review.
- Class: delivery
- Seen: 2026-10-12 — JH 8's message to JH 7 (claimed) — the push check asked for a review of
  1,724 lines brought by a merge of `main` whose resolution decided nine lines of one test file;
  the rule that makes such a merge a code commit is `bin/lib/codex-review-coverage.mjs:207-215`.
  Narrowing the review to the lines written in the merge changes what a review covers, which is
  his to decide
- Seen: 2026-10-14 — the lead's notice to JH 7 at 16:20 (claimed) — in JH 12's pull request 144, a
  merge of `main` with a one-line conflict resolved in `bin/check.mjs` (fbad613) made the push row
  ask a review of the whole branch, 1,405 lines, about 1,030,000 Codex input tokens; the fix owed is
  JH 10's review of a merge's conflict hunks, with a record for each commit (no task line yet)
- Seen: 2026-10-15 — JH 7's run on `feat/rules-row` (observed) — for the merge c4b7a37 below HEAD
  5a57a17, `codex-review --base c4b7a37` said `--base c4b7a37^` reviews it; that run planned 6
  parts, 1,974 lines, about 1,620,000 input tokens, everything `main` brought in, and was stopped
  in its first part. A merge is read by what was written in it only at HEAD, so a detached
  worktree at c4b7a37 reviewed it in 1 part of 18 lines
- Seen: 2026-10-14 — JH 8's `odd/tasks/gate-first.md`, T7 (observed) — the merge `cd2b689` of a
  stacked base, `feat/gate-first` after it took `origin/main`, was read as the whole range from
  `origin/main`: 4 parts, about 1.2M input tokens, for commits that each had a record, so
  `5cccfc4..cd2b689` was recorded as a skip. Since T7 a stacked base whose own code commits each
  have a record is read as the default branch is
- Control: check — bin/codex-review.test.mjs — "is planned in two turns: the merge by what was
  written in it" — since 2026-10-16

### message-cap-ran-out
The lead's messages to sessions are limited to ten for each message he types; they ran out while he
was away, and the sessions it could no longer tell stopped.
- Class: tool
- Seen: 2026-10-14 — relief file, line 748 — ten of ten sent by 06:03 (the rule at line 714); from
  then the lead only merged what was ready; JH 8 never got its "merged" message (line 759). The fix
  owed is JH 5's `js-harness wait` and its rule, so no session waits on a message (line 760)

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
- Control: check — bin/check.test.mjs — "a gate samples the load once, before its first sensor and
  inside its turn, and says it in one INFO row named load" — since 2026-10-11

### permission-prompt-unseen
A tool call of a work session waited on its permission prompt for almost seven hours: he was not
asked through the lead, and the session could neither go on nor tell anyone, since the messages sent
to it were delivered only after the prompt was answered.
- Class: unseen-state
- Seen: 2026-10-13 — this session's (JH 7) transcript 9265156a, lines 16871 and 16883 — the call
  that committed with its message file outside the scratchpad was made at 17:02, and its result,
  "User rejected tool use", is written at 23:47; the lead's messages sent to the session meanwhile
  were delivered at 23:47 too (lines 16885 to 16900). His words, the lead's transcript ca93c7ef, line 957, read with `sessions --quote`: "pero
  no entiendo por que no me pasa la pregunta para aca como ya habiamos quedado y cementado". The
  lead's question to him said the command was refused at 17:50 (line 953); the transcript's times
  do not show that
- Control: protocol — bin/lib/manifest.mjs — "When the user refuses a tool call of yours or stops
  your turn, your next act is to tell the orchestrator what you need" — since 2026-10-14
- Was: owed — odd/tasks/session-channel.md — "T17 Questions to him go through the question tool and
  through the orchestrator" — replaced on 2026-10-16: T17 was found delivered and checked off
  (odd/tasks/session-channel.md, Progress of 2026-10-15), and the board has marked a session the
  user refused or stopped since 2026-10-14 (commit cb09dc0, which names this case)

### pnpm-cleanup-deleted-link-targets
A cleanup of pnpm's old install folders deleted folders that live installs still pointed to: in
`pnpm/global/v11` some hashed names are links to such folders, and nothing resolved the links
before deleting, so the commands behind them broke, and with them every session's hooks.
- Class: machine
- Seen: 2026-10-16 — relief file, line 1122 (claimed; the lead's) — the cleanup he allowed at line
  1120 ("Sí, borralas (Recomendada)", for the folders no process holds) deleted 73 temporary
  folders; four of them were the targets of links (js-harness, codex, ctx7, ccstatusline), so those
  commands and every session's hooks failed from about 03:58 to 04:05 local; fixed by a
  `pnpm add -g` of each, and all four then answered `--version`; the prevention named there is to
  resolve every link in `v11` before a folder is deleted and keep its target

### pnpm-pack-refuses-crlf
pnpm's own pack refuses this checkout on Windows, where `bin/js-harness.mjs` is checked out with
CRLF; whether an install by pnpm from the repository meets it is not measured.
- Class: tool
- Seen: 2026-10-13 — the lead's message to JH 7 at 19:02 (claimed; JH 8's) — `ERR_PNPM_BIN_CRLF`
  from pnpm's pack; the lead's install of that day from GitHub with `pnpm add -g` did complete; a
  `.gitattributes` line with `eol=lf` for `bin/` would be the fix if an install meets it
- Control: check — scripts/gitattributes.test.mjs — "every file under bin/ has the eol=lf attribute, so a checkout writes it with LF whatever core.autocrlf says" — since 2026-10-23

### pnpm-update-leaves-lock
The only road to update the installed command exits 1 on this machine and leaves a lock folder that
makes the next try wait five minutes and fail.
- Class: tool
- Aka: failure 21 (relief file, lines 201 and 202)
- Seen: 2026-10-09 — relief file, line 17 — "pnpm left the old copy's folder on disk"; the lock
  found on 2026-10-11 was dated 2026-10-09 17:40
- Seen: 2026-10-11 — relief file, line 201 — two tries, both exit 1; the lock folder left again,
  removed by hand twice
- Control: check — bin/doctor.test.mjs — "the pnpm-lock row stale for a global bin lock left over in
  the given PNPM_HOME" — since 2026-10-16

### ports-test-free-port-race
On GitHub's machines a port that `allocatePort` had just found free was held by something else when
the test asked again, so a gate failed on a commit that touched no port code.
- Class: tool
- Seen: 2026-10-20 — run 39403454493 of the gate on GitHub's machines — `evals/ports.test.mjs:80`
  "real allocations are distinct, bindable once released, and none is the real engram port" said
  "nothing holds it", actual true; 1 failure of 6692 tests, on the commit of the walk fix
  (`scripts/tui-walk.mjs`, `odd/tasks/release-095.md`)

### probe-end-hook-flake
A gate failed on `evals/codex-isolation-probe.test.mjs` as a whole, with no test of it red, and the
failure did not come back on the next run.
- Class: tool
- Seen: 2026-10-13 — relief file, line 561 — the first gate of the merge c05e1c6 failed in 470.9 s;
  JH 8's inference (claimed): the end hook's removal of its folder

### process-left-after-stop
Stopping a task from the app or with `pkill` ended what the app tracks and left the process under it
alive. Since 2026-10-15 a session's background loop runs under `js-harness loop`, whose stop kills
every process the loop started and looks again; since 2026-10-14 a waiting gate whose launcher
ended runs nothing (`bin/gate.test.mjs`, "gate whose launcher ends while it waits runs nothing").
- Class: machine
- Seen: 2026-10-07 — odd/tasks/session-board.md:942-945 — the stop ended the shell while `git
  commit` and the gate under it lived on
- Seen: 2026-10-10 — relief file, line 75 — the broken waiter, pid 10452, alive and reading the
  board through a gate after `TaskStop` (said at line 76, claimed)
- Seen: 2026-10-11 — relief file, line 233 — `pkill` did not stop the first watch; two ran at once
- Control: check — bin/loop.test.mjs — "stop --take-over kills the loop and every descendant by pid
  and creation time, looks again and removes the record" — since 2026-10-15

### project-migrate-maintenance-flake
A merge queue run failed on one test of `bin/lib/project-migrate.test.mjs`, "a CLAUDE.md deleted and not
committed is refused", which compares every file of its scratch project, `.git` included, before and after a
refused migrate: the first tree held `.git/objects/maintenance.lock` and the second did not (the assertion's diff
marks it `-`, expected only; the brief read it the other way). The fixture's commits started
`git maintenance run --auto --detach`, which held its lock while the first tree was read and let it go before the
second; the same test passed alone. The file's own global git config did not turn automatic maintenance off,
as `bin/check.test.mjs` and the shared `repoTemplate` do (rules-row-template-copy-enoent); it now sets
`maintenance.auto` false and `gc.auto` 0 for every repository the file makes. No other test file that snapshots a
tree with `.git` in it commits in that repository: `bin/update.test.mjs` snapshots projects it never commits in,
and `bin/lib/project.test.mjs` skips `.git` (searched: test files that walk a tree with `withFileTypes` or copy it
with `cpSync` and set `GIT_CONFIG_GLOBAL` without maintenance off).
- Class: machine
- Seen: 2026-10-30 — GitHub Actions run 41116514048, the merge queue's candidate 579e918 of pull request 714 —
  `deepStrictEqual` at `bin/lib/project-migrate.test.mjs:398`; the only failing test of the run
- Control: check — bin/lib/project-migrate.test.mjs — "a commit in a project these tests make starts no git
  maintenance" — since 2026-10-30

### proposal-unreviewed
A plan, a design or a protocol reached him to decide before any reader that did not write it had
read it, and he found its holes, or was asked to approve a version its next round replaced.
- Class: rule-not-acting
- Seen: 2026-10-11 — relief file, line 254 — the rule-change protocol reached him three times in
  one day, each round asked to approve the version before it; his words that day, transcript
  130317af, line 470: "Siempre me gustaria hacewr asi una doble revision con mejora"
- Seen: 2026-10-16 — the lead's transcript e152c9d8, line 14210 — the lead's improvement plan
  reached him with no reader: "siempre tenemos que hacer una doble revision a todo para que salga
  sin errores por favor cementa esto"
- Control: check — bin/lib/protocols-skill.test.mjs — "a proposal reaches the user only after two readers, and a handoff
  names the rule" — since 2026-10-16

### push-check-read-as-gate
The board counted the few seconds of a push's check as a second gate.
- Class: unseen-state
- Seen: 2026-10-07 — odd/tasks/session-board.md:978-984 — "gate started ... while another runs" for
  a pre-push hook

### push-waited-behind-measure
A session queued a long measure in the gate before the push of its reviewed commit, so the push, and
everything waiting on it, waited behind the measure.
- Class: delivery
- Seen: 2026-10-14 — relief file, line 727 — JH 8's review ended at 03:32 and its push went at about
  03:49, behind its pair measure; the WSL gate reached `main` late; his order to fix it so it never
  recurs (the lead's transcript ffe99ebf, line 3977)
- Control: check — bin/gate.test.mjs — "gate refuses a turn while a commit that a push takes now waits
  on a branch with an open pull request" — since 2026-10-14

### question-numbered-by-hand
A session wrote the `Pregunta <n>: ` prefix of a question by hand, guessing the next number, and `notify`
gave the question another, so the text he would see named a question that does not exist.
- Class: wrong-information
- Seen: 2026-10-27 — odd/tasks/f8-s1-reviews.md, L13 — JH 62 sent "Pregunta 94: ..." and `notify` recorded
  it as question 98 (its reply: `prefix: "Pregunta 98: "`); corrected by a note to the orchestrator at 21:42Z
- Control: check — bin/lib/channel.test.mjs — "the record numbers it, and a number guessed by hand named another" — since 2026-10-27
- Was: owed — odd/tasks/f8-s1-reviews.md — "numbered by hand before `notify` gave it 98"

### question-tool-holds-asker
The question tool holds the session that asks until he answers, so a question asked while he was
away held the lead, and the merges it owed, for seven hours.
- Class: tool
- Seen: 2026-10-13 — relief file, line 560 — asked at about 05:57 when his last word was of 04:2x,
  answered at about 13:05; pull request 98 waited from 06:30, 99 from 07:16, 100 from 07:32, and
  JH 8 had nothing to do from 07:32
- Control: protocol — bin/lib/manifest.mjs — "So it is called at once only when the user wrote in
  that session a short while ago" — since 2026-10-14
- Was: owed — odd/tasks/session-channel.md — "T17 Questions to him go through the question tool and
  through the orchestrator" — replaced on 2026-10-16: T17 was found delivered and checked off
  (odd/tasks/session-channel.md, Progress of 2026-10-15)

### record-order-over-time
The board read a session's state and place by the order of the channel record, and `sessions start`
appends a session's first row with the time of its launch, after a notice the session may have
appended since the start read the record: that notice lands behind the row, and the board shows the
session as just opened.
- Class: unseen-state
- Seen: 2026-10-29 — odd/tasks/visual-pages.md, L10 — Codex's recheck over `b70ac68..ca23a62`; left
  open by the lead's decision (L11) and fixed as T5e
- Control: check — bin/lib/sessions.test.mjs — "states and places by when they were written, and
  record order only for a tie" — since 2026-10-29

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
- Control: check — bin/check-citations.test.mjs — "a task the change checks off names a commit
  reachable from HEAD, unless it rides with staged work" — since 2026-10-17
- Was: owed — odd/tasks/commands-and-doctor.md — "a task the change checks off in a feature
  document names a commit, and that commit is reachable from HEAD" — replaced on 2026-10-17: T6 built
  the check in the row citations (odd/tasks/commands-and-doctor.md, L10)

### refresh-wait-false-way-out
`merge-queue --land --refresh-copy`, when sessions were still at work after its wait, said that the
next land with `--refresh-copy` brings the installed copy up; a land run from that copy is refused
before it lands while main's `bin/` differs from it, so it refreshes nothing.
- Class: wrong-information
- Seen: 2026-10-29 — bin/lib/merge-queue-refresh.mjs:88 on main `8c45db81` — read by JH 84 against
  `staleBin` (bin/merge-queue.mjs:902-908) and the "Nothing landed" path of `refreshCopy`
  (bin/lib/refresh-copy.mjs:222-225); the same day three lands from the installed copy were refused
  as behind main (the land record, 05:44Z, 11:04Z and 13:37Z), none of them after a refresh
- Control: check — bin/merge-queue.test.mjs — "a land run from that copy is refused while main" —
  since 2026-10-29

### refusal-in-system-words
A path helper let a system error through, so a run was refused in the system's words and not in
the harness's.
- Class: tool
- Seen: 2026-10-12 — relief file, line 425 — `evals/paths.mjs:6` lets `ENOTDIR` through for a
  path below a file (claimed; odd/tasks/gate-wait.md of `feat/gate-wait` at ea02144, line 1040);
  the run is still refused
- Control: check — evals/paths.test.mjs — "exists says a path below a file is not there, where the
  system says ENOTDIR" — since 2026-10-12

### remerge-chase
Each code merge sent every other open code pull request back to merge `main` and pass a whole gate
again, so the queue of gates grew with each merge. Since 2026-10-15 code reaches `main` through
`merge-queue --land` (bin/merge-queue.mjs), which tests `main` and the ready pull requests together
as one candidate (odd/tasks/drop-github-gate.md, "Why").
- Class: delivery
- Seen: 2026-10-14 — relief file, line 753 — by 06:14, 124 merged `main` three times and 130 twice
- Seen: 2026-10-14 — relief file, line 755 — by 06:27, 124 three times, 128, 130 and 129 twice, 134
  once
- Seen: 2026-10-14 — relief file, line 763 — after 129 merged at 14:12, 128, 130, 131 and 134 lacked
  `main` again. In place since 14:23, outside the repository: his decision to take the exchange (the
  lead's transcript ffe99ebf, line 5394), a code pull request merged on a green run on GitHub against
  the `main` it lands on, by the lead's script (relief file, line 764)
- Control: check — bin/merge-queue.test.mjs — "--land: the candidate green locally and on GitHub Actions
  becomes main, by fast-forward, and its queue branch is removed" — since 2026-10-15

### reopen-tested-old-base
A pull request reopened right after a merge was tested by GitHub against the old base, since GitHub
computes the merge ref later.
- Class: tool
- Seen: 2026-10-14 — relief file, line 765 — at 14:34; in place since 14:39, outside the repository:
  the lead's script reopens only once `refs/pull/<n>/merge^1` equals `main` (line 767)

### resume-names-wrong-maker
The resume hook said the host had compacted a session by itself when he had typed the command.
- Class: wrong-information
- Seen: 2026-10-12 — the lead's message to JH 7 (claimed; JH 5's candidate) — after his `/compact`
  the hook's text opened with "The host compacted this session by itself"; the hook says so
  whenever the boundary is not in the transcript yet (`bin/resume.mjs:651`), which it takes for
  the host's way alone

### review-tool-timeout
The bound status of a gentle-ai review failed with `operation_timeout`, the candidate was left
without that review, and the choice went to him.
- Class: tool
- Seen: 2026-10-07 — odd/tasks/codex-review-lean.md:796-806 — `b5c8766..b0053cf` has no gentle-ai
  review
- Seen: 2026-10-11 — relief file, line 228 — twice on one slice, beside a running gate (an
  observation, not a cause shown); JH 5 stopped on him
- Seen: 2026-10-15 — odd/tasks/host-update-check.md, L4 — the preflight status of `c307e33` timed
  out twice (`operation_timeout`, `retry_safe` false, next action stop); the candidate had no
  gentle-ai review, Codex reviewed it
- Seen: 2026-10-16 — odd/tasks/first-version.md, L10 — the preflight of T7b timed out three times
  with `--base-ref=origin/main` while the machine was at 100% CPU, and answered in 9 s with the
  merge-base commit; that candidate was reviewed
- Seen: 2026-10-17 — PR 353's session (odd/tasks/commit-gates-first.md, its transcript 987cadde) — the
  preflight status with `--base-ref origin/main --committed-only` ended `operation_timeout` (pre_native,
  retry_safe false) after about 25 s, on at least 5 runs between 03:22Z and 04:09Z (8 by the lead's count
  of 2026-10-17); reported as gentle-ai issue 5422, and the candidate's review was declined after it
- Control: check — bin/lib/guard.test.mjs — "a gentle-ai review whose --base-ref is off the first-parent line of
  its head is refused, naming the bases to give" — since 2026-10-17
- Proof: `js-harness guard --hook` denies a gentle-ai review whose `--base-ref` is off its head's first-parent line; the
  timeout itself is `js-harness-protocols` section 3 (one more run, then on, unreviewed, with Codex)

### rule-only-in-memory
A rule lived only in an agent's memory note, so he repeated it and sessions already open did not get
it or did not follow it.
- Class: rule-not-acting
- Aka: failure 2 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-08 — odd/tasks/codex-review-cost.md, "Codex review cost result" — two rules of that day existed only in memory; his
  wording rule said for the first time
- Seen: 2026-10-09 — relief file, line 3 — his wording rule again, with the lead
- Seen: 2026-10-10 — relief file, line 80 — "third time he states it"; also
  odd/tasks/rule-hierarchy.md:15-18
- Seen: 2026-10-10 — relief file, line 137 — a rule changed in a memory note; a session with the new
  note loaded still proposed the cut (line 138)
- Control: check — bin/doctor.test.mjs — "reports the rule notes of the project memory as the
  memory-rules gap" — since 2026-10-14
- Proof: `doctor`: no `memory-rules` gap

### rules-row-template-copy-enoent
A gate on GitHub failed on the first test of `bin/check-rules-row.test.mjs`, "a restated value of a rule
with no row is an INFO line", in a change that touched nothing of it: `fs.cpSync` stopped with ENOENT on
the `.git/objects` of the copy it was making of the test's template repository
(`bin/lib/git-fixture.testkit.mjs:41`, called from `bin/check-rules-row.test.mjs:40`). The template's
last step is a `git commit`, and since git 2.47 a commit starts `git maintenance run --auto --detach`,
which holds `.git/objects/maintenance.lock` after the commit returns; the first copy comes right after.
Node's native copy (`CpSyncCopyDir` in `src/node_file.cc`, 24.21.0) lists a directory and then copies each
regular file, and reports a file gone in between as ENOENT on the directory it copies into. That the lock
was the file is inferred, not observed: it is the one regular file of `.git/objects` a fresh repository's
commit leaves to a process still running, and 200 commits in WSL2 with nothing else running never left it
for a copy to see. The template now sets `maintenance.auto` to false before its commit. Since 76179ca the
shared helper does it for every fixture that copies a fresh repository: `repoTemplate` in
`bin/lib/git-fixture.testkit.mjs` builds with it off and writes it into every repository it made, the two
`copyOf` fixtures use the same exports, and `bin/check.test.mjs` puts it in its own global git config. The
same cause in another fixture is eval-missing-login-workroot-kept.
- Class: machine
- Seen: 2026-10-17 — the gate of fix/merge-commit-size (d83be66^..39665eb) on GitHub, run
  39007490864, Linux, git 2.55.0, node 24.21.0, by JH 24's odd/tasks/land-unattended.md L21 and the
  lead's notice to JH 28 — `ENOENT, No such file or directory '/tmp/js-harness-rules-row-67kYzh/.git/objects'`,
  syscall `cp`; the only failing test of the run, and the same tree passed on the next run
- Control: check — bin/check-rules-row.test.mjs — "a commit in the repository the tests copy starts no
  detached git maintenance" — since 2026-10-17

### rules-tests-red-on-lands
Four tests of `bin/rules.test.mjs` failed together in gates of changes that did not touch the rules list,
two of them land candidates: "render writes docs/RULES.md, and check then passes with its PASS line", "a
test file that reads an undeclared rule is not read", "a feature document that names an undeclared rule
fails check above its Progress line, and not below it" and "the real package passes rules check with the
default root". Their cause was not read: 2026-10-16 was the day the rules gained their patterns (more than
twenty `feat(rules)` commits), and the file passes today (34 of 34, 2026-10-17). Nothing recorded it until
this entry, so the lands it turned red have no cause.
- Class: tool
- Seen: 2026-10-16 — the gate log (~/.js-harness/gate-log), read by JH 28 on 2026-10-17 — each of the four
  failed in 4 gates: the land candidate merge-queue-108380 at 01:36Z and 01:39Z, rules-row at 02:10Z, and
  rule-first-patterns at 03:49Z or jh26-commit-size at 18:20Z; the first three also failed four more tests of
  the same file
- Control: check — bin/lib/throughput.test.mjs — "the table reads the gates, the pull requests and the
  Codex runs of every day of the window together" — since 2026-10-17
- Was: owed — odd/tasks/throughput-review.md — "Unit 4: section 7"; that task is checked off (49de368c),
  and the daily throughput table now names the failing tests of each day's gates

### scratch-run-opened-browser
A run in a scratch home started a command that opened a browser on his screen, and it outlived the run.
- Class: machine
- Seen: 2026-10-30 — odd/tasks/f8-s13-rehearsal.md, L5 — walk 1's `stack install --tool context7` ran the
  scratch Codex CLI's `codex mcp add context7 --url ...`, which left context7's OAuth login running and Brave open at
  its page; found only when the scratch root could not be removed, its tree (8 processes) stopped by hand
- Control: check — scripts/rehearsal.test.mjs — "openedBrowsers names a browser started under a scratch process,
  and none of his own" — since 2026-10-30

### script-ate-backslashes
Text with backslashes written through a shell script lost them, and a commit carries the broken
path.
- Class: tool
- Seen: 2026-10-10 — odd/tasks/practice-project.md:577-579 — `d639bdf` carries
  `D:js-harnesspractice`

### scripted-turn-hung-lock
A scripted measure run in a turn of the gate never returned, and it held the machine's lock while the
sessions waited.
- Class: machine
- Seen: 2026-10-14 — relief file, line 728 — `pair()` of the measure waited for all its children,
  the memory sampler among them, and held the lock from 03:32:27 to 03:56:31, 24 minutes
- Control: check — bin/gate.test.mjs — "gate hands its command a bound of wall time: the declared
  gate-max, or what --max says" — since 2026-10-15
- Was: check — bin/gate.test.mjs — "gate hands its command a bound of wall time: 30 minutes, or what
  --max says" — replaced on 2026-10-16: the test was renamed on `main` on 2026-10-15 (pull request
  213), when the bound became the declared rule gate-max

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

### session-never-woken
Sessions told to start after an event armed no wait for it, so nothing woke them when it came.
- Class: unseen-state
- Seen: 2026-10-14 — relief file, line 758 — JH 13 idle from 03:13 and JH 15 from 03:44, both told to
  start after the WSL gate reached `main` (line 759), never woken; the fix owed is the list of what
  is armed before he leaves, in the orchestrator skill (JH 5)
- Seen: 2026-10-16 — throughput-v3-measure.md (the lead's notes, the window 10-15T00Z to 10-17T00Z) — 31
  turn ends followed by more than 30 minutes of silence with no background task, 64.4 session-hours
  in two days (an upper bound: some had nothing to do)
- Control: check — bin/reply.test.mjs — "a work session that ends its turn holding handed work with
  nothing in the background is turned back once, with what to arm" — since 2026-10-16
- Was: protocol — bin/lib/manifest.mjs — "every session that waits has a declared wait running
  in its background work" — replaced on 2026-10-16, when the reply Stop hook began to check it
  (odd/tasks/wake-and-flag.md, T2)

### session-opened-unseen
A session was opened where he does not see it: a scheduled task opened it in the app's Routines, at
the medium effort it inherited, and the board showed it like any other.
- Class: unseen-state
- Seen: 2026-10-12 — transcript 130317af, line 3443 — he was told to archive sessions he could not
  find: "pero ninguna de esas las veo en el tablero de claude desktop, deben estar en otra parte y
  ese es el problema"; the two sessions, cbca9769 and dd949a0e, ran at medium (measured
  2026-10-15, odd/tasks/session-channel.md, section 17)
- Control: check — bin/guard.test.mjs — "a scheduled-task or cloud tool that opens a session is
  denied in the project that declares the rule, naming start_session" — since 2026-10-15
- Proof: owed — the command of T16's layer 2, which names such a session or task until none is
  left, exiting 0 on this machine (layer 1's board check is bin/sessions.test.mjs); the practice
  step `opening-tools` of scripts/practice.mjs runs the refusal on the candidate; and the one real
  try of layer 3 on his machine (a create_scheduled_task with no schedule, refused, nothing created)

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
- Control: check — bin/sessions.test.mjs — "a session whose transcript carries no title is on the
  board under the title of the opening it read, holds its role, and a title in its transcript wins"
  — since 2026-10-11

### short-name-judged-outside
A path spelled with a Windows 8.3 short name was judged outside the repository, so a hook was not
written.
- Class: tool
- Seen: 2026-10-12 — relief file, line 427 — on GitHub's Windows the runner's TEMP is
  `C:\Users\RUNNER~1\...`; `isWithinBase` (`bin/lib/project.mjs:186`) folds case and not short
  names (claimed; odd/tasks/gate-wait.md of `feat/gate-wait` at 6a9f605); on the safe side:
  nothing is written outside

### stacked-pr-base-order
A stacked pull request had its base changed after the one under it was merged; GitHub reported a
conflict git did not reproduce and the merge was refused.
- Class: delivery
- Seen: 2026-10-10 — relief file, line 164 — pull request 53: DIRTY, CONFLICTING; two merge bases
  found at lines 166 and 167
- Control: protocol — bin/lib/protocols-skill.mjs — "A stacked pull request is merged after its base, or its base is changed before the one under it is merged" — since 2026-10-16

### stale-prompts-sent
He could not tell a session that worked from one that waited on him, and sent prompts that were
already stale.
- Class: asked-of-him
- Seen: 2026-10-07 — docs/ROADMAP.md:355-357 — "sent stale prompts twice"; the day is that of his
  request, the days of the two sends are not stated
- Control: protocol — bin/lib/protocols-skill.mjs — "A reply ends in one of five states" — since
  2026-10-23
- Was: line — AGENTS.md — "End each reply with one state" — since 2026-10-09; replaced when PR 510
  (2026-10-23) moved the states into protocol 2 of js-harness-protocols, and PR 560 (8b525bce) left
  AGENTS.md only the pointer "End each reply in one of the five states of `js-harness-protocols`"

### status-report-without-facts
The status report reached him without the migration's share or whether the last stretch met its goals, and with
three sections saying no record holds them: the page read neither the plan's steps nor the stretch's record, and
nothing warned the lead that a report marked without notes leaves sections 3, 5 and 6 empty.
- Class: tool
- Seen: 2026-10-30 — lead transcript 0f71b2c6, line 25223 — "no aparecio en el como vamos, ni el mapa
  ni los porcentajes si se cumplio la meta"; the lead sent the report without notes and without the
  stretch (brief JH 91, odd/tasks/report-stretch-share.md)
- Seen: 2026-10-30 — lead transcript 0f71b2c6, line 26049 — "En la pagina como vamos no me aparece lo
  que me dices": the report page buried the numbers he asked for in section 4, below every commit of
  8 PRs and the sessions table, where his phone never reached them (brief JH 92)
- Control: check — bin/lib/report-status.test.mjs — "the numbers head the page before section 1: the
  migration now and at the cut, the map, the stretch goals each sí or no" — since 2026-10-30

### stop-read-as-refusal
The app words a turn stopped by another session as his refusal of a tool call, so the stopped
session believed he had rejected it and asked for his word.
- Class: unseen-state
- Seen: 2026-10-13 — relief file, line 565 — JH 5 asked the lead to put to him whether it goes on;
  he had rejected nothing: the lead had stopped that turn, and the app listed the session as running
  at 13:08 and at 14:10, which it would not after a refusal at 07:00

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
- Control: check — bin/check.test.mjs — "checkSensor on Windows points the module analysis cache of
  PowerShell into the throwaway home" — since 2026-10-12

### stretch-not-opened
He left with no stretch opened, though `rule:away-autonomy` asks for the departure, with its goals, in
the reply before he leaves; so the return had no goals to check and no forecast to measure against.
- Class: rule-not-acting
- Seen: 2026-10-29 — the lead's note to JH 89 at 16:33Z (claimed; the lead's own) — he was away about
  an hour with no stretch open; the stretch record holds none between the close at 08:11:36Z and the
  open at 16:07:51Z (`stretches.jsonl` under the throughput folder, read by JH 89)
- Control: protocol — bin/lib/manifest.mjs — "exits 1 when none is open) and show its departure in that reply" — since
  2026-10-29

### taskstop-leaves-work-alive
Stopping a background task of the host ends its shell and not what that shell started, so the work
went on, and a stop was taken for done without the process list confirming it. Since 2026-10-15 the
lead's loops run under `js-harness loop`, whose stop kills every process the loop started, looks
again and exits 1 when one survives; the fix owed for the gate's queue landed on 2026-10-14: a
waiting gate whose launcher ended runs nothing (`bin/gate.test.mjs`, "gate whose launcher ends while
it waits runs nothing").
- Class: tool
- Seen: 2026-10-14 — the lead's notice to JH 7 at 15:59 (claimed), first case — the lead's keeper,
  version 1, merged pull requests 141 and 143 after its stop
- Seen: 2026-10-14 — the lead's notice to JH 7 at 15:59 (claimed), second case — the lead's old
  heartbeat
- Seen: 2026-10-14 — the lead's notice to JH 7 at 15:59 (claimed), third case — the lead's monitor
  tail
- Seen: 2026-10-14 — the lead's notice to JH 7 at 15:59 (claimed), fourth case — JH 5's queued
  gate wait, whose node would have committed a half-edited tree
- Seen: 2026-10-14 — this session's (JH 7) transcript 9265156a — after both of its queued gate turns
  were stopped at about 14:50, their node waiters, pids 20948 and 19624, were still in the gate's
  queue; read in the process list by pid and stopped by pid. The fix owed is JH 8's: the gate refuses
  a turn whose starter is dead; until then every stop is confirmed in the process list
- Control: check — bin/loop.test.mjs — "a real loop: run in the background, status sees it alive,
  stop leaves no process of it" — since 2026-10-15

### temp-folders-left
A test run killed at the gate's bound never removes its temporary folders; 2,357 of them were on his
disk.
- Class: machine
- Aka: failure 13 (odd/tasks/rule-hierarchy.md; relief file, line 143)
- Seen: 2026-10-10 — relief file, line 101 — 2,357 `js-harness-*` folders dated 10-01 to 10-10,
  counted by the orchestrator; 2,358 at line 105; also odd/tasks/gate-lock.md:316-317

### test-matches-temp-path
A test read a run's output for words with a pattern that matched inside them, and the output names
the test's temporary folders, whose random letters can spell one: `/part/i` matched `rkpArT` in
`/tmp/js-harness-codex-review-rkpArT/`, and the test failed by the folder's name alone.
- Class: tool
- Seen: 2026-10-16 — CircleCI job 83 (claimed; the lead's notice to JH 27) — the land of PRs 338 and
  339 failed at `bin/codex-review.test.mjs:1593`, a test already on `main`
- Control: check — bin/codex-review.test.mjs — "what a run says of a launch is not read inside the
  random letters of a temporary folder its output names" — since 2026-10-16

### test-skipped-here-never-run
A test that this machine skips is run by no gate, so its expectation went stale and stood red with
nothing to say so.
- Class: unseen-state
- Seen: 2026-10-12 — relief file, line 425 — `bin/lib/project.test.mjs:1936` expects a reason that
  changed at ae471e7; Windows skips the test, and the first run on Linux (run 38296748258) showed
  it red (claimed; odd/tasks/gate-wait.md of `feat/gate-wait` at ea02144); the expectation was
  corrected by reading ae471e7 and no run has shown it green, since this machine skips the test

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
- Seen: 2026-10-09 — odd/tasks/subagent-model-routing.md, "Subagent models result" — a session told him its check "runs on GitHub", where
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
- Seen: 2026-10-13 — the lead's message to JH 7 at 19:54 (claimed; the lead's own) — he was told
  "that exchange is the one you did not take on the 12th", the sessions' wording repeated without
  reading his lines, 1384 and 1441, which say otherwise; corrected to him. A statement that he
  decided something is made only after his line is read with `sessions --quote`
- Seen: 2026-10-13 — the lead's message to JH 7 at 20:17 (claimed; the lead's own) — for an hour
  he was told the check had slowed because sessions were added, and a search was ordered on that
  reading; JH 8's measure found two Windows services (PcaSvc since about 17:00, and the antivirus)
  taking two to three of the eight processors while a check runs (odd/tasks/gate-wait.md, Progress);
  a gate now names the processes that spent the processor before its command
- Seen: 2026-10-20 — odd/tasks/memory-notes.md, "Moved out of memory" (claimed; the lead's own, from its memory note
  one-sample-is-not-a-diagnosis) — after one OpenSSL success the lead told him and three sessions that Schannel made
  `git ls-remote` fail; three OpenSSL fetches a minute later failed too, the path to github.com was flaky while
  api.github.com answered, and it corrected itself to him and to every session
- Seen: 2026-10-30 — odd/tasks/f8-s13-rehearsal.md, L5 and L7 — JH 90 offered the lead D3 on a cause marked
  assumed (a 30 s timeout that killed only the shell); the walk's own log already refuted it, since `stack install`
  passed its exit check and a timeout exits 1 (`bin/stack.mjs:245-250`); the lead chose on it, and was told the
  correction before anything was built on it
- Seen: 2026-10-30 — odd/tasks/f8-s13-rehearsal.md, run 8 — JH 90 told the lead that `lens-review --plan` leaves out
  the lens prompt, unread; `bin/lens-review.mjs:221` counts it, and the session corrected the notice within a minute,
  before the lead answered or anything was built on it
- Seen: 2026-10-30 — the channel, the lead's note to JH 106 at 19:08Z (the lead's own) — at 18:50Z the lead told him
  that stopping ccstatusline freed about 4 GB, read from its WorkingSet64; JH 107 measured 404 MB private and about
  260 MB of free memory gained; the claim came from the wrong measure, with no read of free memory before and after
  by the same probe
- Control: measured — odd/tasks/honesty-audit.md — "on 2026-10-15 the general honesty audit was measured not worth building" — since 2026-10-15

### turn-ended-waiting
Sessions ended their turn waiting for his `/compact` or for a message while he was away, so nothing
ran.
- Class: asked-of-him
- Seen: 2026-10-14 — relief file, line 747 — at 06:00 JH 5 stopped to wait for his `/compact`
  (claimed), the third of the night after JH 9 and JH 11
- Seen: 2026-10-14 — relief file, line 756 — at 06:27 JH 7 ended on a cut at 76 percent, the fourth
- Seen: 2026-10-14 — relief file, line 758 — nothing ran from about 06:40 to 13:34, seven hours: JH 7,
  9, 10, 12 and 14 waited for his `/compact`, JH 5 and JH 11 for an order, JH 8 for a message, and
  five code pull requests for a merge of `main` (line 759); his order to fix it, the lead's
  transcript ffe99ebf, line 5141. The fix owed is JH 5's `js-harness wait` and its rule: while he is
  not there, a turn never ends waiting; it arms a wait and works on (line 760)
- Control: protocol — bin/lib/manifest.mjs — "Never end a turn waiting for a message or an event,
  whether the user is present or not" — since 2026-10-15

### two-blocks-out-of-order
Two blocks were given in one reply, he sent them out of order, and it cost a session.
- Class: asked-of-him
- Seen: 2026-10-07 — AGENTS.md:81-82 — "two, sent out of order, once cost a session"; 2026-10-07 is
  the day of that record (the sentence, commit `9c9b00d`), and the incident itself is not later than
  it and is in no record read
- Control: line — CLAUDE.md — "two blocks out of order cost a session" — since 2026-10-27
- Was: line — AGENTS.md — "two blocks out of order cost a session" — replaced on 2026-10-27: the line moved, word
  for word, to CLAUDE.md when the instructions were split (`b94f525f`), so the control read as lost (the cleanup
  inventory of 2026-10-30, F4)
- Was: line — AGENTS.md — "two blocks sent out of order cost a session" — replaced on 2026-10-23:
  the line was reworded and no longer held that phrase, so the control read as lost (launch audit,
  C-d-8)
- Was: line — AGENTS.md — "Otherwise one block: two, sent out of order, once" — replaced on
  2026-10-16: the sentence was reworded on `main` on 2026-10-15 (pull request 239), where a cut
  carries what he sends in one code block of only that text

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

### uninstall-took-user-entry
A hook entry the user's host file already held, identical to one of ours, was recorded as ours by
`install`, and `uninstall` took it out of the user's file.
- Class: tool
- Seen: 2026-10-29 — bin/lib/manifest.mjs:583-585 and :744 on main `4b1a7b71` — found by JH 80's
  independent verifier on PR 653; a scratch home seeded with our own Claude and Codex entries came
  back with `"SessionStart": []` after install, install and uninstall
- Control: check — bin/lib/manifest.test.mjs — "an entry the Codex hooks.json already held,
  identical to ours, keeps its place and its trust through install and uninstall" — since 2026-10-29

### update-took-user-entry
A hook entry recorded as the user's, equal to an older form of ours, was taken out by an update's
cleanup of older forms, and the new form in its place was recorded as ours, so `uninstall` took
the user's hook out.
- Class: tool
- Seen: 2026-10-29 — docs/sessions/2026-10-29-jh-81-uninstall-keeps-a-users-hook-entry.md,
  "Follow-ups" — named by JH 81 at `isOlderOwnEntry`; reproduced by JH 84 on main `8c45db81`, the
  record of the new form without `createdEntry: false`
- Control: check — bin/lib/manifest.test.mjs — "equal to an older form of ours stays theirs when an
  update puts the new form in its place" — since 2026-10-29

### upgrade-cannot-work
`js-harness upgrade` cannot bring a copy up to date, and the hint it gives on a version mismatch
names something that does not exist.
- Class: tool
- Aka: the defect "upgrade cannot work" (relief file, line 17)
- Seen: 2026-10-09 — odd/tasks/session-board.md:1204-1211 — it asks a registry the package is not on
  (`404 Not Found`)
- Seen: 2026-10-10 — relief file, line 57 — on a mismatch the harness suggests installing from a tag
  `v0.1.0` and the repository has no tag; also odd/tasks/practice-project.md:194
- Seen: 2026-10-13 — bin/update.mjs:200-225 — read again for the first version: the name it asks
  the registry for is free (`npm view js-harness version`, 404), and the command would install
  and run whatever is published under it, with no check of its source; a task since that day
  (odd/tasks/install-update.md, T5)
- Control: check — bin/update.test.mjs — "upgrade with no source installs nothing and runs no
  sync, whatever a registry would answer" — since 2026-10-13

### wait-blind-to-notices
A session waited with `js-harness wait` on one event, and the lead's notices to it did not end the
wait, so it read them hours later.
- Class: unseen-state
- Seen: 2026-10-16 — the channel's record, the lead's notices to session 7 of 15:30Z to 18:17Z —
  JH 7 waited on pull request 284 with `js-harness wait --pr` and ended its turn; no wait watched its
  number, so none of the lead's notices woke it, and it saw them at 17:04 local (claimed; JH 7's own
  notice of 22:06Z)
- Control: check — bin/wait.test.mjs — "every wait also ends on a notice to the waiting session's own
  number, with exit 3, its notice and the wait to arm again" — since 2026-10-16

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
- Control: check — bin/sessions.test.mjs — "--watch does not return for a notice to another role,
  nor for one the watching session wrote itself" — since 2026-10-11
- Proof: reliefs per working day, from `relieved` lines: at most one (owed: T9 of
  odd/tasks/session-channel.md; nothing prints it yet)
- Was: owed — odd/tasks/session-channel.md — "the watch wakes on a notice for the orchestrator" —
  stale once T4 was checked off; replaced on 2026-10-15 by the tests T4 left, merged in pull
  request 65 (2026-10-11): bin/sessions.test.mjs:2095 holds the watch quiet for a notice to
  another role and for its own, and :2080 wakes it for a notice to the orchestrator

### written-question-buried
A question he had to answer in writing was put at the end of long reports, so it did not read as a question and
waited.
- Class: asked-of-him
- Seen: 2026-10-30 — the lead's transcript 0f71b2c6, line 30745 — question 113 needed his typed words, so it could
  not go through the question tool; the lead left it at the end of long reports and repeated it four times without
  it reading as a question, then sent it alone in a block to copy, and he answered at line 30759
- Control: owed — odd/tasks/instruction-homes.md — "a question he answers in writing goes alone in its message"
