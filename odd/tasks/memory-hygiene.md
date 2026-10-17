# Memory hygiene

Locator: `odd/tasks/memory-hygiene.md` · Engram mirror: `odd/memory-hygiene/tasks` · Branch:
`feat/memory-hygiene` in `D:/js-harness-worktrees/memory-hygiene` · Session: `JH 16 · higiene de
memoria`, opened by the lead on 2026-10-15. Test runner: `node --test`. Delivery: `ask-on-risk`.

## Goal
The project's memory holds only facts of his machine, its index stays within the host's own
limits, and it stays that way by itself: a rule does not settle in memory unnoticed, a sensor says
when a pass is due where a session reads it, and every change a pass makes is undone exactly by
one command — here and in any project where the harness is installed.

## Why
"Memory files" cost 34,485 tokens on every turn of every session (get_usage, 2026-10-15 02:03),
with six sessions open. The memory index grew from 233 to 10,917 characters in 18 days
(`odd/tasks/f2-context-diet.md`, "What loads today"), 36 of its 41 lines over the host's own limit
of about 150 characters (the longest 844), one note with no line, and nothing told anyone. Of 42
notes, 37 are of type `feedback` or `project`: rules living where nothing acts on them, against
the roadmap's "An agent's memory is the place of nothing" and his rule that only `AGENTS.md` and
`bin/` hold the harness's rules (`S8`). His order: "Listo adelgacemos la memoria y hagamos un
protocolo para que eso suceda cada cierto tiempo y se limpie solo un protocolo de higiene con
reglas bien establecidad para que sea un protocolo robusto y funcione bien" (2026-10-15, typed to
the lead).

What this feature reaches, said plainly: the index is about 2,700 of the roughly 26,000 tokens
the harness's estimator reads from these files each turn (about 10 percent); the rest is the
global `~/.claude/CLAUDE.md`, whose diet is F2's (`S5`, "Options for F2" below).

## Done when
- `node --test bin/memory.test.mjs bin/lib/memory-hygiene.test.mjs bin/lib/memory-rules.test.mjs bin/lib/guard.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/memory-hygiene.md` exits 0
- `node bin/js-harness.mjs memory status` exits 0 on this project after the first pass
- `npm run check` exits 0
- A write of an index line over 150 characters is refused by the guard hook, with a planted line
  as its test
- A pass on this project's memory, journaled, with the bytes before and after of each file, and
  `memory undo <stamp>` restoring its own write set byte for byte in a scratch copy while a note
  another session wrote during the pass survives (a planted write as its test)
- No quotation of his in a note before the pass is missing afterwards from the notes and the
  repository's homes, unless his answer approved that note's deletion (`memory verify`, a
  planted lost quote as its test)

## In scope / Out of scope
- In: a `memory` command and its library; the memory index in the guard hook's checks; a
  `memory-hygiene` line where a session reads it (D5); the protocol section in the installed
  skill; this project's memory folder by the protocol, after his answer; help text and docs.
- Out: any `CLAUDE.md` (`S8`). The global `~/.claude/CLAUDE.md` is the installers' file and its
  diet is F2's (`odd/tasks/f2-context-diet.md`, T5): measured here and handed to F2. `AGENTS.md`
  (its budget is `check`'s, at 1,500 of 1,500 tokens, and its rewrite is rule-hierarchy's T8).
  Asked of their owners through the lead before they are touched: the rules list and
  `docs/rule-sources.json` and the wording of `MEMORY_RULES_FIX` (rule-hierarchy, JH 7, whose T11
  is "Every rule moved: the memory notes placed and, on his word, deleted"); the hooks' entries in
  `bin/lib/manifest.mjs` and `bin/lib/guard.mjs` (JH 8); `bin/resume.mjs` (session channel). The
  three contradictions the audit found in shipped text (`bin/lib/manifest.mjs:113`, the
  orchestrator skill's line 37, the js-harness skill's line 20) are follow-ups sent to the lead.

## Constraints
- No note loses his words — because every note records a rule or fact he gave: before a note
  leaves, each quotation of his is in a repository home (`docs/rule-sources.json` for a declared
  rule, else the feature document or the roadmap), and the deletion itself is on his word (T11).
- Nothing runs from a scheduled task — because a session it opens lands outside the sidebar,
  where he does not see it (memory note `no-sessions-outside-the-sidebar`).
- Zero dependencies, plain Node — because `bin/` runs in any host without an install step.
- The sensor fails open and costs zero model tokens when nothing is due — because it rides hooks
  that must never break or slow a session.
- Every write outside the repo is undone exactly — because `AGENTS.md` asks it of everything the
  harness writes (the four purge scripts of the predecessor).

## Ask me before
- The deletion of the notes whose words reached a home: one question, with the list in a file.
- The real ties among contradictions, one at a time through the lead, the recommendation first.
- Anything toward gentle-ai upstream ("Options for F2").

## Specs
- S1 His order, verbatim: "Listo adelgacemos la memoria y hagamos un protocolo para que eso
  suceda cada cierto tiempo y se limpie solo un protocolo de higiene con reglas bien
  establecidad para que sea un protocolo robusto y funcione bien".
- S2 The memory diet: the saving per file, measured, from what is duplicated, stale, too long in
  the index, or a rule that belongs in a command or a check (the lead's brief, 2026-10-15).
- S3 When a pass runs: a time or size budget (the lead's brief). Proposed in "Design", D1.
- S4 What a pass checks: a budget per file, index-line length, stale notes judged by date and by
  a fresh check of what they name, duplicates, notes that have become harness rules (the lead's
  brief). Design D2.
- S5 `~/.claude/CLAUDE.md`: measure what each installer rewrites on its next sync, then bring
  options; do not edit it (the lead's brief). Measurements below.
- S6 What a pass may change alone and what goes to him; how every change is undone exactly (the
  lead's brief). Design D3, D4.
- S7 It runs where he sees it, and works in a project where the harness is installed (the lead's
  brief). Design D5.
- S8 His correction, verbatim (2026-10-15, typed to the lead): "este harnes tiene prohibido que
  utilicemos Claude.md solo Agents.md". The harness never creates, writes or relies on a
  `CLAUDE.md`, here or in an installed project; a rule the diet or the protocol keeps goes to
  `AGENTS.md` within its budget, or into a command or a check in `bin/`. The global
  `~/.claude/CLAUDE.md` is measured only; its diet goes through F2 (the lead's reading, which he
  confirmed by tapping "Sí, que siga (Recomendada)").

## Measurements (2026-10-15, before any change)

Per turn, from files (`get_usage` "Memory files" 34,485 tokens; the harness estimator,
`bin/lib/payload.mjs`, reads about a quarter less, so bytes are the comparable unit):

| File | Bytes | Estimator tokens | Owner | Rewritten by |
|---|---|---|---|---|
| `~/.claude/CLAUDE.md` | 87,432 | 21,827 | gentle-ai 4.1.1 (98.8 percent), graphify (1,045 B tail) | `gentle-ai sync`: the file's mtime equals `last_synced_at` in `~/.gentle-ai/state.json` (2026-10-12 17:37:25Z), so every byte inside a marker is the sync's output and a hand edit there is lost at the next one |
| `D:/js-harness/AGENTS.md` | 6,010 | 1,500 | this repo | budgeted at 1,500 by `check` |
| memory `MEMORY.md` | 10,917 | 2,708 | Claude Code auto-memory | sessions, at any time (it was 10,759 at 02:03) |

The 42 notes (97,936 B) load only on demand, not on every turn.

Growth since F2 measured the same files on 2026-09-27 (`odd/tasks/f2-context-diet.md`, "What
loads today", in characters): the memory index went from 233 to 10,917, 47 times in 18 days, with
nothing watching it; `~/.claude/CLAUDE.md` from 70,593 to 87,432; `~/.codex/AGENTS.md` from
29,128 to 104,141. gentle-ai #4036 ("allow excluding managed CLAUDE.md components") is still open
with no comment, last updated 2026-09-12 (`gh issue view 4036`, read 2026-10-15). For F2, not for
this feature: the two blocks below that apply only in one situation are where an exclusion or an
on-demand skill would save most.

Inside gentle-ai's blocks: orchestrator 51,150 B, agent-routing 26,411 B (with remote-authorization
1,352 B), codegraph-guidance 4,139 B, engram-protocol 2,635 B, persona 2,077 B. Two parts apply
only in one situation and load every turn anyway: the review lifecycle ("Native Compact Review
Orchestration" to "Cost and Context Balance", 17,143 B, about 4,282 estimator tokens) and the
provider-defect handoff (7,765 B, about 1,942) — 28 percent of the file. No sentence over 60
characters of agent-routing repeats one of orchestrator verbatim. `~/.codex/AGENTS.md` is
104,141 B and paid by every Codex session that loads the user's configuration (the lean review
session does not).

## The diet, measured (audit of 2026-10-15)

A read-only sub-agent read all 42 notes against `AGENTS.md`, `docs/RULES.md`,
`docs/rule-sources.json`, `bin/` and the installed skills; its full table, with his words, the
evidence and a draft index per note, is in the group's shared notes folder,
`jh16-memory-notes-audit.md` (one claim spot-checked by this session: `bin/resume.mjs:87` already
tells a compacted session to notify the orchestrator, so `tell-lead-after-compaction` met its own
drop condition).

- Index: 10,917 B and 41 lines today; the draft is 27 lines and 3,120 B, every line under 120
  characters: 7,797 B (71 percent) less on every turn of every session. Short lines alone, with
  no merge, save about 55 percent; those are changes a pass makes alone (D3).
- One orphan: `questions-through-the-question-tool.md` has no index line.
- Seven clusters where one rule is spread over several notes (reply closing and questions;
  several sessions; context and compaction; while he is away; what the lead does alone; effort
  and models; where a rule lives). 15 merges or deletions proposed, each to him (D3).
- Ten contradictions, among them who merges code, who archives and who opens sessions, where
  older notes and the installed orchestrator skill say the opposite of his words of 2026-10-15.
  No number disagrees with `docs/RULES.md`.
- Eleven notes stale by a fresh check (a branch merged, a command built, a fix landed), each with
  its commit or `path:line`.
- No rule can move to `AGENTS.md` without one leaving: it stands at 1,500 of its 1,500 tokens.
- The `memory-rules` row of `doctor` says "then delete the note" once its rule is placed; for
  about nine notes his words exist nowhere in the repository, so a note's words need a home first
  (`docs/rule-sources.json` keeps his quotes for declared rules). D3 never deletes alone.

## Options for F2 (`S5`)

Measured here, decided in F2 and by him; nothing below touches the file.
1. Keep waiting on gentle-ai #4036. Cost: nothing; it has had no comment since 2026-09-12.
2. A comment on #4036 with these figures (the review lifecycle and the defect handoff, 24,908 B,
   28 percent of the file, apply only during a review or a defect), or a pull request upstream.
   Outward-facing: his decision.
3. What gentle-ai already offers: `install --components <list>` exists (seen in the binary's help
   text, 4.1.1), and `~/.gentle-ai/state.json` lists eight components; the orchestrator and
   agent-routing blocks map to none of them by name. Whether any of the 77 KB can be left out
   today is not known; reading gentle-ai's source comes before any claim.
4. Nothing: the memory diet alone, about 10 percent of the figure.

## Design, version 2 (after two readers)

The readers' findings and what each changed are under "Review of the design".

### D0 The five questions (roadmap, "say so when a protocol is missing")
1. Did it happen? Yes: the index grew 47 times in 18 days, and failure 2 of the rule hierarchy,
   "A rule changed in a memory note did not reach open sessions" (`odd/tasks/rule-hierarchy.md`).
2. Twice, or at a cost? Every turn of every session pays the index; six sessions open today.
3. Can a check do it? Mostly: the guard refuses the bloat when it is written (D1), and a sensor
   finds the rest (D2). Only the judgment of what a note's words are, and where they go, is left
   to a protocol.
4. Does a protocol cover part of it? Yes: rule-hierarchy's T11 and "One home for every rule"
   (T16) say where a rule goes. This feature does not repeat them: a pass hands rule notes to
   that protocol and keeps only the mechanics, the sensor and the undo.
5. What it costs and what leaves: D6.
The skill section opens with the incident (2026-10-15, the index at 10,917 characters) and
expires: withdrawn after six passes in a row with nothing due but the clock, and nobody using it.

### D1 Prevent, before cleaning
The guard hook (`guard --hook`, a `PreToolUse` hook already installed) also looks at a `Write` or
`Edit` of the project's memory index and refuses an index line over 150 characters (the host's
own figure, `consolidate-memory`: a constant with one home, not a rule, as rule-hierarchy settled
for host figures). A new note of type `feedback` or `project` is not refused, since his words
must land somewhere at once; the guard adds one line saying it is a rule waiting for its home.

### D2 When a pass is due (sensor)
`js-harness memory status` reads the project's memory folder (the main checkout's slug, as
`bin/lib/memory-rules.mjs` does, so a worktree reads the same notes) and is due when any holds:
1. the index is over its byte budget: 4,000 B, about the draft's 3,120 with room for eight more
   lines (his choice, 2026-10-15, L4);
2. an index line is over 150 characters (code points);
3. an index link names no file, or a note has no line;
4. a note of type `feedback` or `project` exists that was not there at the last pass: a rule
   waiting for a home;
5. the cadence: 7 days since the last verified pass, with at least one note written since (his
   choice, 2026-10-15, L4). "The last pass" is the stamp `memory verify` records, so a pass's own
   writes do not make it due again. With no journal (a fresh install) the folder is due once.
A note's size, the names it cites that no longer exist (re-checked with the resolver of
`bin/lib/citations.mjs`), and pairs of notes that cite the same rule id are printed as
candidates, not as reasons to be due: notes load on demand, so their size costs nothing per turn,
and a judgment cannot be a trigger. `--history` prints the index bytes at each pass.
On Codex the row is `n/a`: Codex has no such folder, and `~/.codex/AGENTS.md` is F2's.

### D3 What a pass does alone, and what goes to him
Alone, because nothing of his is lost and each is undone by one command:
- an index line rewritten within 150 characters that keeps every number, rule id and name the old
  line held (the verify step compares them);
- a line added for an orphan note, or removed for a link with no file.
Everything else goes to him, settled by evidence first:
- A rule note leaves memory, by T11: each quotation of his goes to its home
  (`docs/rule-sources.json` for a declared rule, asked of rule-hierarchy's owner; else the feature
  document or the roadmap, with the date), and the deletions are asked in one question with the
  list in a file. No "pointer note" state exists: a pointer keeps the rule in memory and the
  `memory-rules` row red for good.
- A contradiction his newer dated words settle (rule-hierarchy T16, letter C: his dated words are
  the source) is settled by them and told to him in the recap; only a real tie is asked, one at a
  time, through the lead, the recommendation first.
- A note stale by evidence (what it names is gone, a branch merged, a fix landed) is listed with
  its evidence in the same deletion list.
- `user` and `reference` notes stay: facts of the machine are memory's one job.

### D4 Undo
1. `js-harness memory plan <files...>` takes a lock (the pattern of `bin/lib/gate-lock.mjs`),
   snapshots the whole folder with each file's sha256 under
   `~/.js-harness/memory-hygiene/<slug>/snapshots/<stamp>/`, and records the write set: the files the pass
   may change, create or delete.
2. The pass edits only those files.
3. `memory verify <stamp>` records the after-hashes always, even when it refuses, since a failed
   pass is when undo is wanted; then refuses when a file outside the write set changed since the
   snapshot (another session wrote it; it is named and left alone), when a quotation of his is
   gone from both the notes and the homes and his answer did not approve that note's deletion,
   when a kept line lost a number or a rule id, or when a due reason the pass owned still holds.
   It stamps the pass and releases the lock.
4. `memory undo <stamp>` restores only the write set: a note byte for byte when its hash is the
   recorded after-hash, a created note removed, a deleted note restored; a file someone wrote since
   is refused by name. The index is undone line by line: the pass's own lines are put back and the
   lines others added since are kept.
5. Snapshots are kept, the last ten per project; `uninstall` lists the open stamps and keeps them
   unless `--full` is given (D7), since they are the only copy of what a pass changed. `install` records
   the folder.
Line endings and bytes are compared raw; the notes are LF today.

### D5 Where a session is told
Not the `SessionStart` `systemMessage` of `doctor --hook`: that line reaches him, not the model
(`docs/ROADMAP.md`, the reading of hook output), carries only a count, and its machine-wide digest
re-notifies when a gap is fixed. Instead, a line of its own, `js-harness: memory hygiene due
(<reasons>) — see the protocol "memory hygiene"`, given where a model reads it: in the
`additionalContext` the session channel's `PostToolUse` hook already gives (`bin/resume.mjs`), so a
long-lived orchestrator is told too, at most once a day per project while due, addressed to the
orchestrator when the board names one and to the session that receives it otherwise; and as a row
of the board (`js-harness sessions`). Its own per-project stamp, cleared only by `memory verify`;
zero tokens when nothing is due. The surface is asked of `bin/resume.mjs`'s owner first.

### D6 Who runs a pass, what it costs, how it reports
The orchestrator when there is one, at a task boundary and never while a gate runs; otherwise the
session told. A first pass costs what the audit cost: one reader sub-agent, 229,271 tokens, 15
minutes. A later pass reads only the notes written since the last verified one. Judging is
verification, so high effort, by his effort rule. It reports in the shape of every handoff (done,
checked and how, not checked, failed, open), closes with his reply states, sends its one question
through the lead, and gives the index bytes before and after.

### D7 The full uninstall (L7, his answer to L6.2; design, version 2, after two readers)

His words (L7): "Debe dar la opcion de guardar las copias osea desintalacion completa o la desintalacion
normal que deja las copias". Two ways out, and he picks: the normal uninstall keeps the snapshots, the
full one removes them. Today there is only the first (T9's "The folder at uninstall"), and its output
tells him to remove a kept folder by hand.

1. *The normal uninstall* is `uninstall --global` as T9 built it (`removeMemoryHygieneFolder`,
   `bin/lib/manifest.mjs`): a project folder that holds a snapshot is kept, with its journal, and its
   stamps are named; every other project folder goes, and the hygiene folder goes when nothing is
   kept. Its line "remove the folder by hand to drop them" becomes "`js-harness uninstall --global
   --full` removes them", so the choice is offered when it matters (the two assertions of
   `bin/install.test.mjs` that hold the old words are rewritten).
2. *The full uninstall* is `uninstall --global --full`: everything the normal one removes, and the
   snapshots too, so `~/.js-harness/memory-hygiene` is gone. Each project removed with snapshots is
   named with its stamps ("removed <project>: N snapshot(s) of a memory pass (<stamps>)"). `--full` is
   his "completa"; since "full" could be read as more, the help says what it adds and what it never
   removes: "--full also removes the memory snapshots, the only copy of what a pass changed; files you
   modified and the memory notes themselves are kept either way".
3. *Only with `--global`.* The snapshots live under the machine's home, one folder per project
   (`<home>/.js-harness/memory-hygiene/<slug>/snapshots/<stamp>/`). `--full` without `--global` is
   refused, exit 2 ("--full removes the memory snapshots of the machine: it goes with --global"), even
   outside a git repository where `uninstall` alone is the machine one: a flag that deletes the only
   copy is asked for in full words. `uninstallMain` filters it out before `parseScopeArgs`, which `sync`
   shares, so `sync --full` stays an unknown flag. The project uninstall gains one stdout line when that
   project's hygiene folder holds snapshots: where it is, and that `uninstall --global --full` removes
   them; a project-scope `--full` waits until he asks.
4. *Never under a pass.* A project whose `<slug>/lock` exists is never removed. The lock is read by a
   new export of `bin/lib/memory-pass.mjs`, `readLock(stateDir)`, which never throws: `null` when there
   is none, else `{ stamp, pid, manifest }` with `stamp` null for a lock that is empty or does not
   parse, and `manifest` whether that stamp's `manifest.json` exists. Its line follows what can release
   it:
   - a stamp with a manifest: "a memory pass is planned (<stamp>) for the memory folder <the memory
     folder the manifest records>; from that project's checkout run js-harness memory verify <stamp>
     --home "<home>" or js-harness memory undo <stamp> --home "<home>", then uninstall again" (verify
     and undo run from the project's checkout, which no file records, against the uninstall's home);
   - an empty or unreadable lock, or a stamp with no manifest (a plan killed between its lock and its
     snapshot, which verify and undo cannot release): "<lock path> holds no finished plan (pid <pid>);
     if that process is not running, remove the file and uninstall again".
   `planPass`'s own refusal of a held lock takes the same two lines.
   The normal uninstall keeps such a project and exits 1, since the uninstall did not finish. This part
   is not his request but T9's open advisory ("a `memory plan` started during an uninstall could lose
   its snapshot"), and is recorded as that.
   The full uninstall with any lock present removes nothing of the hygiene folder, names every lock as
   above, and exits 1 (as PR 263 did): one rename takes the folder whole, or not at all.
5. *Every writer sees the uninstall.* When the hygiene folder exists, and only then (so an empty home
   gets no `.js-harness`), the uninstall first creates the marker `<home>/.js-harness/
   memory-hygiene.purge` with `wx`, holding `{ pid, startedAt }`; then lists the projects; then reads
   the locks. It removes the marker in `finally`, and before `uninstallInstalled` runs, so the marker
   never keeps `.js-harness` alive. The writers:
   - `planPass` checks the marker after it takes its lock (and takes an ENOENT of its folder, moved away
     meanwhile, as the same refusal); when it is there it releases the lock, removes the folders it made
     empty, and refuses, naming the marker.
   - `undoPass`, which today only reads the lock, takes it with `wx` for its whole run when no pass holds
     it (a verified pass), checks the marker after, and releases it at the end; refused, it writes
     nothing. Before it writes, it checks that every file of the snapshot is there with the hash the
     manifest records, so a damaged snapshot is refused by name.
   - `verifyPass` already needs the lock, and a locked project is kept: covered by 4.
   - `dueNotice` writes no `told` stamp while the marker is there.
   Either a writer's lock is there when the uninstall reads the locks (4 keeps it), or the writer sees
   the marker and stops. A marker already there is another uninstall, or a stale one: when its pid is
   alive, refused with exit 1; when not (a killed run skips `finally`), the refusal says the run that
   made it ended and to remove the file. The refusals of the writers name the file and say the same.
6. *A removal that cannot finish.* The full uninstall moves the folder aside in one rename
   (`memory-hygiene.purging-<pid>-<time>`), then removes that with `maxRetries: 3`. If the removal fails,
   the folder is renamed back and the error says it may be partly removed and to run `uninstall --global
   --full` again; the hash check of 5 refuses an undo from a snapshot it damaged. Only when the rename
   back fails too is the aside name reported. Either mode names a `memory-hygiene.purging-*` folder it
   finds beside the hygiene folder (left by a killed run), with what to do: rename it back when no
   `memory-hygiene` is there, else remove it.
7. *What is reused.* Closed PR 263 (`feat/memory-hygiene-uninstall`, kept) built 3 to 6 on the code T9
   replaced: its flag parsing, marker, lock rule, rename aside and rename back are carried over and
   rewritten on T9's per-project shape (`{ path, stamps, journal }`, now with `lock`), on `hygieneDir`,
   and on `readLock`. Not reused: its default, which kept the whole folder, and its flag's name.
8. *The menu.* `bin/tui.mjs`'s Uninstall asks, after its yes and only when snapshots exist, "Remove
   the memory snapshots too, the only copy of what a pass changed? (y/N)"; yes adds `--full`.
9. *Tests, first* (`bin/lib/manifest.test.mjs`, `bin/install.test.mjs`, `bin/lib/memory-pass.test.mjs`,
   `bin/tui.test.mjs`), one per rule: the normal line names `--full` (1); the full uninstall removes the
   snapshots and the folder and names each stamp, exit 0 (2); `--full` without `--global` exits 2, `sync
   --full` is an unknown flag, the project uninstall names a project's snapshots (3); a locked project
   is kept by the normal uninstall with exit 1, a full uninstall with one locked and one other project
   removes nothing with exit 1, a lock with no manifest and an empty one get the remove-the-file line
   (4); `planPass` and `undoPass` refuse while the marker is there and write nothing, an undo of a
   damaged snapshot is refused, an uninstall refuses a live marker and names a stale one, no folder means
   no marker and an output identical to today's, the marker is gone after a run (5); a failed removal
   leaves the folder in place and a `purging-*` folder is named (6); the menu's second question (8).
10. *Docs.* The help line of `uninstall` (`bin/js-harness.mjs`, `bin/install.mjs` usage), README's
   "Remove", its command reference ("### js-harness uninstall") and its memory hygiene section, the
   installed skill's line in `bin/lib/manifest.mjs`, D4.5 ("unless asked to purge" becomes "unless
   `--full` is given"), and D4.1's layout, which is `<slug>/snapshots/<stamp>/`.
11. *Risk.* Item 1 (it deletes stored data that is the only copy of what a pass changed) and item 4 (the
    marker and the locks order several processes): an independent verifier after the build, and the
    gentle-ai review of the slice. The Codex review of this slice reads the lock fix `2e082ca` (T8),
    since it touches `bin/lib/memory-pass.mjs`.

#### Review of D7 (two readers, 2026-10-16)
Version 1 went to two independent readers (data safety and races; fit to his words and the code). Every
finding taken, with where:
- Both: a full uninstall cannot keep a locked project inside a folder it renames whole; now nothing is
  removed while any lock is there (4). Both: an undo of a verified pass takes no lock, so a full
  uninstall could delete its snapshot mid-copy; undo now takes the lock and checks the marker, and
  refuses a damaged snapshot (5).
- A lock left by a killed plan cannot be released by verify or undo, so "run verify or undo" led
  nowhere; the lines now follow what releases it (4). The marker comes before the listing, since a plan
  could start between the two (5). A marker or an aside folder left by Ctrl+C, which skips `finally`,
  is detected by pid and named (5, 6). Windows: retries on removal, and a partly removed folder is said
  so (6). `dueNotice` writes into the folder too (5). `lockHolder` is private and throws on an empty
  lock, so `readLock` (4). An ENOENT in `planPass` when the folder moved (5).
- The menu offers the choice (8). The help says what `--full` never removes (2). The skill text and the
  command reference were missing (10). The marker only when the folder exists, released before the rest
  of the uninstall (5). The two old assertions are rewritten, not kept (1). The normal mode's lock rule
  is T9's advisory, not his request (4). The project uninstall names its snapshots (3). Refusing `--full`
  without `--global` outside a repository is kept, with its reason (3).

## Review of the design

Two independent read-only readers, 2026-10-15, neither the writer.
- Reader A (mechanism): the `systemMessage` never reaches the model (D5 rewritten); the digest
  tells once both too often and never (own stamp, daily repeat); undo could restore over a note
  another session wrote mid-pass, and an index undo would almost always be refused (write set,
  lock, line-wise index undo, after-hashes even on refusal); the quote guard must ignore backticks
  and front matter and accept approved deletions (D3, D4); "mechanical" index rewrites can drop a
  number (verify compares them); a 3,000 B note budget keeps the folder due forever (now a
  candidate); the 6,000 B budget had no source (4,000 B, derived from the draft); the note total
  was 97,936 B, not 107,657 (corrected). Taken: all.
- Reader B (what is missing, his words): pointer notes keep rules in memory against `S8` and T11
  (removed: rule notes leave by T11); `S5` measured but no options (added "Options for F2", and
  the share this feature reaches stated in Why); no five questions and no expiry (D0); the line
  limit is a host figure, not his rule (now a constant); clean-up instead of prevention (D1); a
  one-time notice is not robust (D5); one batch question breaks his one-at-a-time rule (settle by
  his dated words, ask real ties one at a time, deletions as one list); nobody owned three
  contradictions in shipped text (follow-ups to the lead); no cost or report shape (D6); no
  measure over time (`--history`); reuse `citations.mjs` (D2). Taken: all.

## Tasks
- [x] T1 (kind: design) This document: measured, audited, attacked by two readers, sent to the
  lead, approved by him (commit `5397771`, L4)
- [x] T2 (kind: build) `memory status`, its library, candidates and `--history`, tests first.
  Built (route: inline): `bin/memory.mjs`, `bin/lib/memory-hygiene.mjs`; 10 library and 6 CLI
  tests, red first; on this project it is due for no-pass, index-bytes, line-chars and one
  orphan. Reviewed: gentle-ai under budget, Codex 4 findings fixed (T8); in PR #188 with T3, T5, T6.
  Landed: #188, merge `483f09c`, 2026-10-15
- [x] T3 (kind: build) `memory plan`, `verify`, `undo`, the lock, the journal and the install record.
  Built (route: inline): `bin/lib/memory-pass.mjs`, 15 library and 2 more CLI tests (the library's
  red was not run apart: the module was missing; the CLI's and the index-quote test's red were
  seen). On a copy of the live folder (43 notes): an unchanged pass reports no quotation falsely;
  the mechanical pass (each note gets its old index line verbatim, the index gets short lines)
  takes the index from 11,077 B to 3,920 B, verifies, leaves `status` with nothing due, and `undo`
  makes the copy byte-identical to the live folder (`diff -rq`). The install record of
  `~/.js-harness/memory-hygiene/` waits on `bin/lib/manifest.mjs` (JH 8). Reviewed with T2; PR #188.
  Landed: #188, merge `483f09c`; the install record is not built and moves to T9
- [x] T4 (kind: build) The index rule in the guard hook (asked of JH 8 first). PR #191 (draft), branch
  `feat/guard-memory-index`: gentle-ai high (item 3), approved twice; verifier blocker fixed; Codex P2 fixed and
  rechecked. Merges after #188. Landed: #191, merge `d7a22da`, 2026-10-15. Its install left a second guard entry
  on this machine; fixed by #220 (install replaces its own entry by command), merged
- [x] T5 (kind: build) The due line in the channel's hook and the board row (asked of their owner first).
  The due line landed with #188: `js-harness resume --pause` says, at most once a day for the project, that a
  pass is due (`bin/resume.mjs`, D5). The board row is not built and moves to T9
- [x] T6 (kind: docs) The protocol section of the installed skill, with its incident and expiry; help text.
  Landed with #188: the skill's "Memory hygiene" section (`bin/lib/manifest.mjs`) and the `memory` help line
  (`bin/js-harness.mjs`)
- [x] T7 (kind: verify) The first pass on this project with T11's owner, after his answers, journaled and measured.
  Mechanical part done 2026-10-15 (pass `20261015T120606108Z`, verified and journaled): each of the 42 index
  lines appended verbatim to its note, the index replaced by 43 short lines; index 11,077 B -> 3,920 B (65
  percent less on every turn), `memory status`: nothing due; `memory undo 20261015T120606108Z` restores it.
  His answer, 2026-10-15 20:56Z, to the lead's question tool (JH ORQ transcript `e152c9d8`, line 3588): "Sí,
  borrá y fusioná (Recomendada)". Pass `20261015T205843597Z`, verified with the 15 notes that go named in
  `--approved`: each of the 15 (the two deletions too, so no word is lost) appended verbatim to its sibling
  under "Merged from ... on 2026-10-15", the file and its index line removed; index 3,920 B -> 2,590 B, 43 -> 28
  lines. Rehearsed first on a copy, whose undo was byte-identical (`diff -rq`). Then pass
  `20261015T210012224Z` (write set `MEMORY.md` only) rewrote the 11 sibling lines to name what each absorbed
  ("no CLAUDE.md, only AGENTS.md" in Dogfooding's), all under 150 characters: **index 2,879 B, 28 lines, 28
  notes, nothing due; 11,077 B -> 2,879 B in all (74 percent)**. Each pass undoes with `memory undo <stamp>`,
  the latest first

### T7: what goes to him (one list)

Delete (superseded or duplicate):
- `merge-from-chat.md`: code merges are the lead's (charter, `docs/ROADMAP.md:1047`); its one fact, "he cannot
  merge from the phone app", moves to `orchestrator-autonomy-charter.md`.
- `questions-through-the-question-tool.md`: duplicates `questions-with-buttons.md`.

Merge into the sibling note, his words copied verbatim, the source file removed:
- `agents-md-ordered-corrections.md`, `work-continuously.md` -> `orchestrator-autonomy-charter.md`
- `archive-finished-sessions.md` -> `session-housekeeping-reminder.md` (replaces "Archiving is his")
- `main-session-orchestrates.md` -> `cross-session-prompts.md` (its quotes)
- `narrow-writers-no-gate-wait.md`, `subagent-effort-high.md` -> `effort-by-kind-of-work.md`
- `no-claude-md-only-agents-md.md` -> `dogfooding-rules-go-in-the-harness.md`
- `no-sessions-outside-the-sidebar.md` -> `start-session-needs-fresh-session.md`
- `no-turn-ends-waiting.md`, `while-away-no-repeats.md` -> `ask-before-he-leaves.md`
- `recap-before-prompt.md` -> `one-prompt-per-reply.md`
- `taskstop-leaves-node-child.md` -> `background-tasks-declare-and-dismount.md`
- `tell-lead-after-compaction.md` -> `notify-when-done.md` (its quote; `bin/resume.mjs` already tells a
  compacted session to notify the lead)

The audit with the evidence for each is `jh16-memory-notes-audit.md` in the group's shared notes folder.
- [x] T8 (kind: verify) Follow-up of the Codex recheck of 3fbfb31..b3dac0f, which left finding 2 open ("Require
  the active lock before recording after-state"): the fix (verify refuses a stamp that does not hold the lock) is
  committed after b3dac0f with its test, and a second recheck is refused by design; a Codex review of the next
  slice that touches `bin/lib/memory-pass.mjs` reads it. That slice (JH 26, 2026-10-16, branch
  `fix/memory-lock-holder`, route: inline) moves every read of the lock into `lockHolder`, so the diff holds the
  lines of 2e082ca, and closes two edges of the same rule, test first (RED: 2 of 3 new tests; then `node --test
  bin/lib/memory-pass.test.mjs` 22 pass, `node --test bin/memory.test.mjs` 8 pass): `memory undo` of a pass
  while another pass holds the lock is refused and writes nothing, since it would write under that pass and its
  verify would take the undo as its own after-state; and a lock that does not parse, or names no stamp, is a
  refusal naming the lock file from plan, verify and undo, where it was a `SyntaxError` the command does not
  catch. Codex on `6a6ce9e..13619cb` (commit `13619cb`, gate PASS; gentle-ai: medium, 86 lines, not due): "the
  patch is correct (confidence 0.94)", no finding, 92,937 input tokens, recorded
- [x] T9 (kind: build) What T3 and T5 left unbuilt, each waiting on its owner: the install record of
  `~/.js-harness/memory-hygiene/` (so `uninstall` can remove it; `bin/lib/manifest.mjs`), the board row of a due
  pass (`js-harness sessions`), and the rule ids `memory-index-bytes` and `memory-pass-days` the sensor's budgets
  are to be read from
  - [x] The folder at uninstall (JH 27, 2026-10-16, inline, branch `feat/memory-hygiene-t9`). Nothing records the
    folder, like the channel's: `uninstall --global` removes it, with a manifest and without. A project's folder
    that holds snapshots is kept with its journal, and its stamps are named on stdout (D4.5: the only copy of what
    a pass changed). One that cannot be looked at or removed goes to stderr and exits 1. `hygieneDir`
    (`bin/lib/memory-hygiene.mjs`) is the one home of the path. RED: manifest's import failed, then install's
    printed "nothing installed"; GREEN: manifest 160/160, install 72/72.
  - [x] The board row (same branch). `js-harness sessions` prints "Memory hygiene" after the pull requests: due
    with the ids of its reasons, nothing due, n/a with no memory folder, or unavailable with its reason
    (`boardMemory`, `memoryLines`); `--json` carries it as `memory`. RED: both tests failed; GREEN:
    lib/sessions 296/296, sessions 232/232.
  - [x] The rule ids (JH 21, 2026-10-17, inline, branch `rule/memory-hygiene-budgets`; L8): `memory-index-bytes`
    and `memory-pass-days` are declared by `rules change`, each in its own commit (`adf4328`, `2019114`), and
    `hygieneState` reads them from the declared list, which a test can replace. RED: the test that gives a list
    with 10 bytes and 2 days failed; GREEN: memory-hygiene 15, memory 8, rules 34 pass, `rules check` PASS.
  - Verified (item 1: uninstall now deletes the journal, stamp and lock of a project with no snapshot): an
    independent verifier on `498b418` found no blocker. Twelve uninstall cases never deleted a snapshot, and
    with no folder the output was identical to the baseline. Three of its advisories are fixed test first:
    - a project that could not be removed now no longer hides the others or the kept stamps;
    - the journal is named only when it is there;
    - a doc comment is back over `reliefLines`.
    Left as advisories:
    - a `memory plan` started during an uninstall could lose its snapshot, since uninstall takes no lock;
    - the board reads the memory folder from `--claude-home`/`CLAUDE_CONFIG_DIR`, `memory status` from
      `<home>/.claude`;
    - an unreadable journal reads as `no-pass` (already so at the baseline).

- [x] T10 (kind: build) The full uninstall, D7: `uninstall --global --full` removes the snapshots, the normal one
  offers it, neither removes a project under a pass; from closed PR 263's pieces, on T9's code, tests first
  (L7; route: inline; risk items 1 and 4, so an independent verifier and the slice's review)
- [ ] T11 (kind: verify) Follow-up of the Codex recheck of 7fe1b24..5018d1b, which left findings 1 ("Point
  recovery commands at the project checkout") and 4 ("Validate the after-index against its recorded hash") fixed
  only in part: both are fixed in `b761aef` with their tests (gentle-ai approved, `review-66e30d0a70858dbd`), and a
  second recheck is refused by design, so `5018d1b..b761aef` is recorded as a skip. A Codex review of the next
  slice that touches `bin/lib/memory-pass.mjs` or `memoryKeptLine` in `bin/install.mjs` reads them. Open with it,
  from gentle-ai's advisories: a snapshot verified before `b761aef` whose index is not UTF-8 is now refused as
  damaged (nothing is written); a home holding `"` or `$` prints a command that does not run as copied.

## Log
- L1 2026-10-15, his order, verbatim: "Listo adelgacemos la memoria y hagamos un protocolo para
  que eso suceda cada cierto tiempo y se limpie solo un protocolo de higiene con reglas bien
  establecidad para que sea un protocolo robusto y funcione bien".
- L2 2026-10-15, his correction through the lead, verbatim: "este harnes tiene prohibido que
  utilicemos Claude.md solo Agents.md". He confirmed going on under it ("Sí, que siga
  (Recomendada)"). `S8` added; `~/.claude/CLAUDE.md` moved from "options for the lead" to
  "measured for F2".
- L3 2026-10-15, two independent readers attacked version 1; every finding taken ("Review of the
  design"). Version 2: rule notes leave memory by T11 instead of becoming pointers, the guard
  prevents index bloat, the due line goes where a model reads it, undo works on a declared write
  set under a lock, "Options for F2" added.
- L4 2026-10-15 about 03:03, his answers to the lead's three questions, tapped (the lead's
  transcript 987548fe): "Sí, construilo (Recomendada)" to build version 2; "Sí, 4.000 bytes
  (Recomendada)" for the index budget; "Cada 7 días (Recomendada)" for the cadence. The lead's
  routing the same message: slices after the payload fix, test first, gentle-ai then Codex per
  slice; JH 7 is paused, so T11's moves come through the lead; JH 8 owns `guard.mjs` and the
  manifest and is asked first; the three contradictions in shipped text are this feature's, in
  D3, settled by his words of 2026-10-15; the deletions go to him as one list.
- L5 2026-10-15 evening, the lead (JH ORQ), after #188, #191, #202, #220 and #235 landed: mark T2-T7 done on
  main by a short branch. T2-T6 marked with where each landed; the pieces T3 and T5 left unbuilt became T9.
- L6 2026-10-16, the lead (JH ORQ) at 17:00, after JH 16 did not answer: "take memory-hygiene T9 items that need
  no choice of his, per odd/tasks/memory-hygiene.md; write any choice of his as a question in its Log". JH 27 built
  the folder at uninstall and the board row. **Two questions for him, open:**
  1. *The rule ids.* `memory-index-bytes` (4,000 bytes) and `memory-pass-days` (7 days) are his values (L4). But
     both answers were tapped options, and `js-harness rules change` refuses a tapped answer as the source of a
     rule of his ("the option's text was written by a session, not typed by him", `bin/lib/rules-change.mjs`). Should
     the two rules be his, which needs him to type the two values once, or the project's, with this document as
     their source? Until he answers, the values stay constants in `bin/lib/memory-hygiene.mjs`, where they are
     today.
  2. *A purge at uninstall.* D4.5 keeps the snapshots "unless asked to purge". Nothing asks yet: `uninstall` keeps a
     project's folder that holds snapshots and says to remove it by hand. Should `uninstall` take a flag that deletes
     them? They are the only copy of what a pass changed.

- L7 2026-10-16, his answer to L6.2, typed in place of the options "No, se borran a mano (Recomendada)" and
  "Sí, con un flag --purge" (the lead's question 13, transcript `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line
  13602, 19:30:08Z, read by JH 21 with `sessions --quote`): "Debe dar la opcion de guardar las copias osea
  desintalacion completa o la desintalacion normal que deja las copias". The lead (JH ORQ, 17:19 local) gave it
  to JH 21 with closed PR 263's branch, test first, two readers on its design: D7 and T10.
- L8 2026-10-17, L6.1 answered with the recommended choice. His words (transcript
  `e152c9d8-53bc-4366-8fa5-526b1576bcb6`, line 20374, a message queued at 08:11:16Z, read by JH 21 from the file
  because `sessions --quote` reads no text in a queued message): "recuerda que no estoy asi que procede siempre con
  la respuesta recomendada por favor se autonomo, te voy a dejar unas 10 horas solo". The lead (JH ORQ, 08:20Z)
  gave the recommendation: `memory-index-bytes` (4,000 bytes) and `memory-pass-days` (7 days) become the project's
  rules, with this document as their source, and the sensor reads them, not constants. He can make them his later
  by typing the two values once (`js-harness rules change`, a change of owner). The harness's own rules live in
  `bin/lib/rules-data.mjs`, not `docs/rules.json`, which is a project's list, so the branch is
  `rule/memory-hygiene-budgets`.

## Next step (2026-10-16)
- T10 (JH 21, branch `feat/memory-full-uninstall`, worktree `D:\js-harness-worktrees\memory-full-uninstall`): built
  test first, every rule of D7.9 seen RED before its code, in two commits: the pass library (`readLock`, `lockLine`,
  the marker in `planPass`, `undoPass` and `dueNotice`, the snapshot hash check) and the uninstall (`--full`, the
  lock rule, the marker, rename aside and back, the project line, the menu's second question, the docs). Per file:
  memory-pass 27, memory-hygiene 13, manifest 169, install 77, tui 79 tests pass. Beyond D7: `readLock` takes as a
  stamp only the shape `planPass` writes, and a lock it cannot read counts as held. Commits `155af74` and `a0501e6`.
  The independent verifier and the gentle-ai review of the slice (three lenses) found one blocker: a refused undo
  released the lock of a pass still planned; fixed in `e6417d9`, and gentle-ai approved the slice
  (`review-d7256531515c8365`, acknowledged). Their warnings are fixed in the commit after it: the full uninstall reads
  a project's lock before its snapshots, so one it cannot look at is still seen under a pass, and an undo whose
  folder was moved away names the uninstall's marker. Advisories left open, all needing a filesystem error or a race
  of milliseconds: `dueNotice` checks the marker and then writes its stamp, with no lock between; a stale marker with no folder blocks and names the folder. State for a
  resume: next the gentle-ai assess of the last commit, Codex over `155af74^..HEAD` reading `2e082ca`, a PR, tell
  the lead. L6.2 is answered (L7).
- T10 after Codex (e36005a..7fe1b24, recorded): four P2 findings open, to fix test first in one commit: the locked
  line points at the memory folder instead of the project; `--home --full <path>` slips past the value check; `lockLine`
  of a lock released meanwhile throws; the damage check of an undo skips `after-index.txt`. All four fixed, each
  seen RED first: the line names the project, a `--full` right after `--cwd`/`--home` is that flag's missing value,
  `lockLine` of a released lock says to run again, and an undo refuses a snapshot without `after-index.txt`.
  Per file: memory-pass 30, install 77 pass. Commit `5018d1b`; gentle-ai approved it (risk and reliability lenses,
  `review-0edbd08ed86951bf`, acknowledged).
- Codex rechecked them over `7fe1b24..5018d1b` (recorded): two fixed, two only in part. Fixed in the commit after
  it, each seen RED first: the locked line gives both commands in full, with the stamp and `--home "<home>"`, from
  that project's checkout (no file records the checkout's path, and the slug cannot be turned back into it); verify
  keeps the index after the pass byte for byte, and undo refuses an `after-index.txt` whose hash is not the one
  `after.json` records, before it merges anything. Per file: memory-pass 32, install 77 pass. Commit `b761aef`;
  gentle-ai approved it (`review-66e30d0a70858dbd`); Codex refused a second recheck, so that range is a recorded
  skip and T11 carries it to the next slice. Then the PR.
- T1-T7 are done and on main. Open: T8 (a Codex review of the next slice touching `bin/lib/memory-pass.mjs`
  reads the lock fix `2e082ca`; the T9 slice does not touch that file) and T9's rule ids, which wait on his answer
  to L6.1; L6.2 adds a flag only if he wants one. The folder at uninstall and the board row are on
  `feat/memory-hygiene-t9`.

## Next step, earlier (2026-10-15 evening)
- T1-T7 are done and on main. Open: T8 (a Codex review of the next slice touching `bin/lib/memory-pass.mjs`
  reads the lock fix `2e082ca`) and T9 (install record, board row, rule ids; each waits on its owner).
  The sections below are the history of the build.

## Next step, history (2026-10-15, context pause at 88%)
- Commit `feat(memory): a hygiene sensor, a safe pass, a daily due line and the protocol` (T2, T3, T5, T6,
  1,228 lines) is in the gate from `D:/js-harness-worktrees/memory-hygiene` (background). The first try failed
  only on `bin/readme.test.mjs` (no README section for `memory`), fixed. After it lands: gentle-ai assess with
  `--base-ref $(git merge-base HEAD origin/main) --committed-only`, then `codex-review --plan` and the review,
  then push and a PR; tell the lead the size (over the 400-line heuristic: chain or single PR is the lead's call).
- T4 is its own branch `feat/guard-memory-index` in `D:/js-harness-worktrees/guard-memory-index`, from
  origin/main `a68a340`, uncommitted: `bin/lib/memory-index-guard.mjs` (new, zero imports), `bin/guard.mjs`
  (async, lazy imports), `bin/guard.test.mjs` (9 pass), `bin/lib/manifest.mjs` matcher `|Write|Edit` +
  `bin/lib/manifest.test.mjs` (134 pass, the sync-replaces-older-matcher test), `README.md`, `bin/js-harness.mjs`
  usage. Waiting on the lead's clearance for `scripts/practice-lib.mjs:333`, `scripts/practice-lib.test.mjs:807`,
  `bin/install.test.mjs:314` (the matcher pinned). Still to do: the guard line of `skillContent` in manifest,
  those three files, the gate, gentle-ai assess with `--escalate-item 3`, an independent verifier, Codex, PR with
  the timing: guard on a non-memory Write median 170 ms quiet / 305 ms loaded = the same as main's guard
  (interleaved, 20 runs); the cost is the node start plus the dispatcher.
- T7: the mechanical pass is simulated on a copy (`scratchpad/apply-index-pass.mjs`, `new-index.md`: index
  11,077 -> 3,920 B, verify passes, undo byte-identical). Run it on the live folder only after the feature commit
  is reviewed; the live folder now has 43 notes, so regenerate `new-index.md` for any new note first.
- Payload fix: PR jsaristi/js-harness#183, reviewed, waiting for the lead's merge.
- Update: the lead cleared the three matcher files; T4 is committed through the gate in the background from
  `D:/js-harness-worktrees/guard-memory-index` (manifest 134/134, practice-lib 95/95, merge-tree clean against
  origin/main). Lead's calls: the feature commit is ONE PR, not a chain; T4 its own PR with gentle-ai assess
  `--escalate-item 3 --escalate-reason "installed hook matcher changes for every session"`, an independent
  verifier, Codex, and the timing in the body (170 ms quiet / 305 ms loaded, all of it new per Write/Edit,
  since main runs no guard there today). After a compaction: one line to the lead (title, hour by date, context
  share, what resumes).
- Update: the feature commit landed as `3fbfb31`; next its gentle-ai assess (base 5397771), Codex review of 2832ad8..3fbfb31 range code, push, ONE PR.
- Update: gentle-ai assess of 5397771..3fbfb31: medium, not due (under_budget). Codex review of that range running in the background (4 parts, estimate ~910,000 of a 1,406,400 allowance); its output is the background task of this session. Then push feat/memory-hygiene and open ONE PR.
- Update: the first Codex run refused (this doc was uncommitted); it runs again from the clean detached worktree D:/js-harness-worktrees/mh-review at 3fbfb31 (remove it after). The doc additions get their own docs commit later.
- BLOCKER, next action: the Codex review of 5397771..3fbfb31 passed (4 parts correct, 573,463 tokens, recorded) but
  `git push` was refused by the pre-push check: "the Codex review that ended at 3fbfb31 owes a correction: 4 findings
  open, not rechecked". Read the findings in that run's answer (see bin/lib/codex-review-recheck.mjs: classifyRecheck,
  runAnswerFindings, and `codex-review --again`/recheck flow in bin/codex-review.mjs), fix or answer them, then push
  feat/memory-hygiene and open ONE PR (body drafted in this session: what, why, checks, Risk item 3). The branch is
  not on origin yet. T4's commit is still in the gate (background) in D:/js-harness-worktrees/guard-memory-index.
- Update: T4 commit result: see git log of feat/guard-memory-index (next: gentle-ai assess --escalate-item 3, verifier, Codex, PR).
- Update (after the host's compaction at 04:07): the 4 findings of the Codex review ending at 3fbfb31 are fixed with a
  test each, red seen first: `./note.md` links match their note; a second verify of a verified pass is refused and
  keeps its after-state; undo reverses only the pass's own index changes (a line another session removed stays
  removed); a kept number counts only as a whole token ("88" is not in "1880"). Next: commit, `codex-review --base
  3fbfb31` (the recheck), push, ONE PR; then T4's chain.
- Update: PR #188 (draft) holds T2, T3, T5, T6 (head 2e082ca); PR #191 (draft) holds T4 (head 2ad347e). Both are
  drafts by the lead's freeze (only 183, 185, 186 merge until JH 10 lands 167). Next: T7, the live pass, after #188 is
  reviewed by the lead: regenerate `new-index.md` for the 43 notes, then the deletion list goes to him through the lead.
- Update (2026-10-15, after #188 landed): T7's mechanical pass ran on the live folder (see T7). The list of 2
  deletions and 13 merges went to him through the lead as one question (`notify --kind question`, waits T7). #191
  (T4) was merged with main eec4ee3 to clear two adjacent-line conflicts; its resolution gets its own Codex record.
