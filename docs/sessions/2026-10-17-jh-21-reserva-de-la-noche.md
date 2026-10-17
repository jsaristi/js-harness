# JH 21 · reserva de la noche

File: docs/sessions/2026-10-17-jh-21-reserva-de-la-noche.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went.

## Goal
The project's reserve session: it waited with `js-harness wait --notice-to 21` and took whatever task the lead (JH ORQ) sent it as a note, each on its own branch and worktree under `D:\js-harness-worktrees\`, through the gate, gentle-ai and Codex, to a pull request the lead landed. After each compaction it resumed from the opening it stored with `notify --opening "JH 21 · reserva de la noche"`. Its notices in `C:\Users\Oficina\.js-harness\channel\D--js-harness.jsonl` run from 2026-10-15T13:29Z to 2026-10-17T09:29Z: 50 notes, 2 ready and 1 closed.

## The user's words
- "recuerda que no estoy asi que procede siempre con la respuesta recomendada por favor se autonomo, te voy a dejar unas 10 horas solo": `e152c9d8` line 20374, 2026-10-17T08:11:16Z, queued while that session worked. `sessions --quote` could not read it until PR 381; after it, the command prints these words.
- The order to write this summary: "Siempre archiva cuando ya hayan terminado y haz que hagan un resumen siempre que terminen, […] cuando terminen hacen el resumen y te lo pasan a ti". This is `e152c9d8` line 21112, 2026-10-17T09:20:53Z, typed as an answer to the lead's question, read with `sessions --quote`.
- Every other task came from the lead's notes. A note is the lead's claim and never his word.

## Delivered
All of these are merged unless marked otherwise. The state comes from `gh pr view <n>` at 2026-10-17T10:35Z.
- 210 `fix/queue-unknown-mergeable` (8f25db3): the merge queue decides a mergeable state that GitHub has not computed yet.
- 244 `fix/host-update-followups` (ab6c236): doctor reads the host app under `--home` only, and `--host-reviewed --json` is added.
- 250 `fix/host-update-remote-control` (f1a057a): Remote Control is turned back on after a host update, unasked.
- 256 `feat/gentle-ai-update-check` (a99a8e3): doctor's gentle-ai-sync row holds a new gentle-ai version for review.
- 260 `feat/web-fetch-failure-hook` (27fbde9): web-fetch-fallback T4, a PostToolUseFailure entry on WebFetch.
- 262 `feat/progress-table-tasks` (291dee3): first-version T2, where progress counts the rows of a feature's task table.
- 265 `test/clean-home-cycle` (632143b): the clean-home cycle test, and uninstall removes the empty folders install made (T5, T5a).
- 266 `docs/exact-tests-t4` (21f8529): exact-tests T4 closed with the gate time and wait after the flip.
- 269 `feat/release-source` (0b61492): first-version T4, T4b and T5's update step. Releases are found by the repository's `vX.Y.Z` tags.
- 270 `docs/ci-gates-design` (c644fca): T7, gates on CI machines, designed.
- 273 `feat/ci-gates` (fbcba2f): T7b. A gate whose lock turn would wait runs its tests on GitHub.
- 277 `docs/first-version-t1` (7125f28): first-version T1, its three open table rows closed in their own documents.
- 290 `perf/fixture-repos` (d6fc1c1): gate-wait T4 cut 3. Fixture repositories are built once and copied (`bin/lib/git-fixture.testkit.mjs`).
- 300 `docs/gate-wait-close` (40e25ad): gate-wait closed (T10), with its measured result in `docs/ROADMAP.md`.
- 318 `docs/first-version-t6e` (a95c6e8): T6e, the tests sensor's bound on Windows, designed.
- 327 `fix/eval-port-reuse` (a0bc8a0): the evals Linux flake. A trial no longer takes the port the one before it just released.
- 199 `feat/journey-channel-step` (2256cd6): a stale PR revived. main was merged in and its conflicts resolved.
- 257 `docs/t2-test-3` (6a8f765): carries 255's commit. 255 was closed as folded into it.
- 263 `feat/memory-hygiene-uninstall`: closed with a note and its branch kept. The lead asked for this.
- 374 `feat/memory-full-uninstall` (2d4776bf): memory-hygiene T10 (D7). `uninstall --full` removes the memory snapshots, and neither mode removes a pass.
- 377 `rule/memory-hygiene-budgets` (df268f3a): memory-hygiene T9. `memory-index-bytes` and `memory-pass-days` are declared by `rules change` and read by the memory sensor.
- 381 `fix/quote-queued-command` (906afea1): session-channel T23. `sessions --quote` and `notify --kind answer` read a queued message that host 2.1.299 writes as a list of blocks.

## Decisions
- T9: the two budgets are project rules, not his. His values were tapped options (memory-hygiene L4), which `rules change` refuses as the source of a rule of his. This session took the recommended choice under his words of 08:11Z, recorded as memory-hygiene L8.
- T23: only the leading run of `<system-reminder>` blocks in the first text block is the host's. A tag he types stays his. This session made that call on Codex's two P2 and its recheck, recorded in `odd/tasks/session-channel.md` T23.
- Stale PRs (2026-10-16 22:17Z): 199 revived, 257 kept, 255 folded, 263 closed. The list is the lead's call on this session's audit, in the shared notes as `jh21-stale-prs.md`.
- 269 and 290 took main by merge, never by rebase. That way the reviewed code commits kept their Codex records, as the notes of 2026-10-16 15:38Z and 16:04Z say.

## Failures and lessons
- 2026-10-17: this session edited `odd/tasks/session-channel.md` while `codex-review` ran on `8a50cd6..73428d3`. Codex wrote no record ("Tracked files changed while Codex was reviewing"). The run was repeated with a still tree and recorded `8a50cd6..0985899`. The lesson is in T23: nothing in a worktree is edited while its review runs.
- 2026-10-16 16:03Z: this session told the lead that PR 290's push was done, but the pre-push hook had refused it. The merge 3bf5127 resolved a code conflict and had no Codex record. A correction note followed one minute later, and the push went through after Codex reviewed `97bfafa..3bf5127`. The lesson is to read push's output before reporting it.
- 2026-10-16 02:33Z: TaskStop left the wait's node child (pid 100652) running, and it was killed by hand. The memory note "Background tasks" says the same.
- 2026-10-16 08:32Z: this session sent a "short test" note to the channel to probe notify's length limit, and a note one minute later said to ignore it. The limit is in code (`newNotice`, 500 characters); read it there.
- 2026-10-17: engram's `mem_save` was refused because the host session had already ended, so the lessons above live in feature documents and this file.

## Left
- `peerTextOf` (`bin/lib/sessions.mjs`) still reads only a string prompt. A message from another session in the list shape would not be read. Nobody holds this yet; it is named for the lead.
- The worktree `D:\js-harness-worktrees\quote-queued-command` and the merged branches of this session are the lead's to prune.

## Cost
- Time: the first notice in the channel was 2026-10-15T13:29Z, after an earlier compaction, so the session started before that. The last delivery notice was 2026-10-17T09:29Z.
- Context: 32% at the last notice (161,577 tokens), with ten "compacted at" notes from this session in the channel.
- Reviews in the last feature (T23): three gentle-ai reviews, all high and approved (lineages b1e9abe1c7d3de6e, 8ca44ae7bf3aaf32, 590e7f52c48d9770), and three Codex runs. The second used 91,903 input tokens and the third 46,203, as their output says; the first one's figure was not reread. Over the whole session the reviews and gate runs were not counted; each PR body names its own.

## Second stretch
After the summary above, from 2026-10-17 ~10:40Z to 13:25Z. The work came from the lead's notes of 11:59Z (items 8, 9 and 10 of its open-work triage) and 12:31Z ("drop the review-starts priority: JH 5 fixed it […] Commit (e) once it lands, then (f), (g)"). They are the lead's claims, not his words. The host compacted this session once in this stretch, at about 12:38Z.

### Delivered
The state comes from `gh pr view <n>` at about 13:25Z.
- 395 `docs/open-work-text` (67e04cb5), merged: stale text fixed and nine finished tasks ticked, from the open-work triage.
- 397 `fix/doctor-rules-row` (fdd47940), merged: doctor asks for main's rules beside the version lookups. A copy whose version cannot be read is unknown.
- 398 `fix/summary-fences` (1f2ff3f3), merged: a backtick line whose text holds a backtick opens no fence.
- 399 `fix/peer-text-blocks` (67896ece), merged: a queued message from another session, written as a list of blocks, is read. This closes the `peerTextOf` gap named under "Left" above.
- 402 `feat/landing-rule-hash` (1e5b2ee8), merged. This is rule-hierarchy T16e-f, item (e):
  - a relief proposal line hashes the rule together with its `docs/rule-sources.json` entry;
  - old lines still match.
- 404 `feat/citations-reachable`, open. This is commands-and-doctor T6, item (g):
  - the `citations` row reads each task a change checks off;
  - such a task must name a commit HEAD reaches, or ride with staged work;
  - the Control of `record-states-wrong-fact` in `docs/FAILURES.md` is now its test.
- 405 `feat/rules-reach-rest`, open. These are three of the parts left in rule-hierarchy T16f, item (f):
  - the practice proves the rules hook at its three events, in a real run on Claude Code 2.1.301 (0.0159 USD);
  - the orchestrator skill reads `js-harness rules`;
  - sync renders the harness's block of `AGENTS.md` again while it is unedited.
  - The fourth part, "which shipped rules reach an installed project", is his.

### Findings and decisions
- The count in commands-and-doctor T6b is 37 compactions told since PR 275, not 41 (PR 395).
- The control of `asked-yes-not-his` moved to section 1 of the protocols skill (PR 395).
- The `maintenance.auto` finding did not hold. The fixture kit already writes `maintenance.auto = false` into every template repository (`bin/lib/git-fixture.testkit.mjs:43-50`).
- (g) has a reading of its own: a task checked off beside staged work outside `odd/tasks/` needs no commit named, because a tick cannot name its own commit. Its own gate row said "1 task checked off, each in a commit HEAD reaches or in this one". This is recorded as commands-and-doctor L10.
- The lead asked Codex to read `ac6cf2c..9c3f41a` again. `codex-review --base ac6cf2c --again`, run from a detached worktree at `9c3f41a`, refused it as a second recheck of the review that ended at `12773f4`. The range keeps its skip record. The review of `db31c96..b9fd628` read the matching code that replaced it and found it correct. This is recorded in rule-hierarchy T16e-f.

### Reviews
- (e):
  - gentle-ai rated it high by escalation (item 3), with lenses risk and reliability, and approved it (`review-82c5317205449ba6`);
  - an advisory was fixed in `b9fd628`: a sources file that does not parse no longer blocks the declaration match;
  - Codex rated `db31c96..b9fd628` correct (0.91; 88,847 input tokens).
- (f):
  - gentle-ai rated `968f0fc` medium (`under_budget`);
  - gentle-ai rated `968f0fc..cf820d2` high by escalation (item 3), with lenses risk, resilience and reliability, and approved it (`review-442164ed6054f39b`);
  - an advisory was fixed in `1bf827e`: a block that could not be written now exits 1;
  - Codex found a P2 in `db31c96..1bf827e` (121,867 input tokens): sync wrote through an `AGENTS.md` that is a link. It was fixed in `37037bb`, and the recheck was correct (0.98; 32,356 input tokens).
- (g):
  - gentle-ai rated it medium (`under_budget`) twice;
  - Codex found two P2s in `db31c96..0308678` (87,653 input tokens): an unrelated history read as no claim, and a nested task borrowed its siblings' commit. Both were fixed in `96cd531`, and the recheck was correct (0.98; 39,295 input tokens).

### Failures and lessons
- Main's `bin/lib/review-starts.test.mjs:62` failed on every gate (a fixed NOW of 12:00Z), so the gate refused (e)'s commit. This session reported it to the lead and did not fix it. JH 5 fixed it in PR 400, and (e) was committed after that landed.
- A gentle-ai transaction opened on the wrong base (`16301239`) for an earlier slice. It was left uncaptured on the lead's word, and is recorded here only.
- (e)'s first `notify --kind ready` was refused: no gentle-ai line named `b9fd628`. Committing that line and running it again was refused once more, apparently because the pull request's head was read before GitHub held the push. The third run, after `gh pr view` showed the new head, was recorded. The lesson is that a fix commit needs its own gentle-ai line in the feature document before the push.
- Shell heredocs ate the backslashes of edit scripts twice (`g-docs.mjs`, `e-docs.mjs`). The Edit tool did those edits. This repeats the memory note "Heredoc backslashes".
- A `sed` meant for one function added `const lstat` to three others in `bin/lib/project.mjs`. It was caught in the diff and removed before the commit.

### Cost
- Gates: 14 commits through the gate on GitHub's machines in this stretch (4 for (e), 6 for (f), 4 for (g)), about 130-150 s each. Two of them were merges of main.
- Codex: five runs, 370,018 input tokens in all, as their outputs say. A sixth, on the skipped range, was refused before it started.
- gentle-ai: two reviews (two and three lenses). The other commits were assessed only.
- Context: 52% at the last notice (13:24Z).

## Third stretch
After the second stretch, from 2026-10-17 ~13:25Z to 15:05Z. The work came from the lead's note of 14:37Z: "triage item 14, the T6f verifier advisories", to be built "test first on their own branch and PR", and then this third stretch. That note is the lead's claim, not his words. The host compacted this session once in this stretch, at about 14:53Z, after `9a62f82` was committed and before Codex ran.

### Delivered
The state comes from `gh pr view <n>` at about 15:01Z.
- 404 `feat/citations-reachable`, 405 `feat/rules-reach-rest` and 406 `docs/jh21-second-stretch` were merged, as the lead's note said and `gh` confirms.
- 409 `fix/sensor-silence-advisories`, open. This is first-version T6h and T6i, item 14:
  - T6h: `runSensor` (`bin/check.mjs`) decides that a time ran out one turn of the loop later (`setImmediate`). A command that exited as its bound ran out is therefore reported by its exit, not as a timeout. RED came first.
  - T6i: a gate-level test where the silence bound stops a real hang. The row names the silence, and the child the sensor started is gone. It passed at once and stays as a pin. Its bound is 4 s, not the rule's 20 minutes; an existing test already covers the rule's value reaching `checkSensor`.

### Findings
- The verifier's text was not in JH 25's summary in full. It was recovered from JH 25's transcript (`2fd3f776`, line 10072) by a script, because a grep with large quantifiers over the transcript was too slow.
- Two `setTimeout` calls of one duration do not fire in one turn of the loop for certain. Each takes its start time from a fresh read of the clock, so two set apart can land a clock tick apart. The T6h test therefore emits the fake exit inside the sensor's own timer instead of from a second timer.

### Reviews
- gentle-ai rated `3586f40..22455a7` high by escalation (item 4: the order of a timer and an exit), with lenses resilience and reliability, and approved it (`review-cdd7f329fb92c696`). It gave three advisories:
  - one was fixed in `9a62f82`: the T6i test now waits up to 5 s for a killed child to be reaped;
  - one, the order of two timers, became Codex's finding below;
  - one stays open: no test breaks a silence with a chunk inside the deferred turn.
- gentle-ai rated `9a62f82` and `2531fa8` medium (`under_budget`).
- Codex found a P2 in `3586f40..9a62f82` (137,518 input tokens): the T6h test leaned on two timers firing in one turn. It was fixed in `2531fa8`, and the recheck was correct (0.98; 52,279 input tokens).

### Failures and lessons
- None new in this stretch. The second stretch's lesson held: each fix commit got its gentle-ai line in the feature document before the push, and `notify --kind ready` recorded 409 on its first run.

### Cost
- Gates: 4 commits through the gate on GitHub's machines (`22455a7`, `9a62f82`, `2531fa8`, `f6aa3c6`), about 140-155 s each, plus this summary's commit.
- Codex: two runs, 189,797 input tokens in all, as their outputs say.
- gentle-ai: one review (two lenses). The other commits were assessed only.
- Context: 27% at the last notice (15:01Z), after the compaction.

## Fourth stretch
After the third stretch, from 2026-10-17 ~15:35Z to 16:05Z. The work came from the lead's note of 15:34Z: "the advisories recorded as later work, outside gate-first" (gate-first's own were left to JH 5, who holds that document). Those were the two items of gate-wait T11 and the two of memory-hygiene T11 from `docs/sessions/2026-10-17-jh-5-canal-entre-sesiones.md`, plus this session's own R3 advisory. Each went "one branch and PR per feature document". The note is the lead's claim, not his words. PRs 409 and 410 had landed (main `5ea341af`).

### Delivered
The state comes from `gh pr create` and the `ready` notices, at about 16:02Z. All three PRs are open.
- 411 `test/sensor-silence-chunk`: first-version T6j, a pin. A chunk written between the silence running out and its deferred decision breaks the silence: nothing is killed, and the exit is reported. The test fails against a copy without the `chunks !== seen` check.
- 412 `fix/review-base-walk`: gate-wait T12 and T13.
  - The guard's first-parent lookup is now bounded by the base: `rev-list --first-parent --parents HEAD ^<base>`. A bound by count was rejected, because it cannot tell a base off the line from one deeper than the bound.
  - The real-repo test's temp dir has a space in its name and is quoted.
- 414 `fix/memory-pass-advisories`: memory-hygiene T12 and T13.
  - On Windows, a home with a curly double quote gets single quotes, and cmd.exe gets its own form.
  - While the index is as the pass left it, an after-index that is not that index's text is damaged, not older. Once the index has changed, the refusal names both readings.

No advisory was dropped: each one cost a few lines and a test.

### Findings
- The first version of T12 decided by the last commit the walk printed. gentle-ai's reliability lens warned that a walk git cuts late (committer dates out of order) prints more than that. The fix checks the first parent of every commit printed, which needs one git run fewer.
- A differential check of the old lookup against the new one, on this repository's history (32 bases, including second parents, a tree and the root), found 0 differences, before and after that fix.

### Reviews
- gate-wait: gentle-ai rated `5ea341af..a9109b1` high by escalation (item 2), with lenses risk and reliability, and approved it (`review-9cb629c08f739b2c`). Both of its advisories (the warning above, and tests for a root, a tree and a second parent) were fixed in `3d4194c`. Codex rated `5ea341a..3d4194c` correct (0.94; 65,042 input tokens).
- memory-hygiene: gentle-ai rated `5ea341af..76b06df` high by escalation (item 1), with lenses risk and reliability, and approved it (`review-e255530cff15e77c`). Its suggestion, to run the whole install file, was done in a gate turn: 82 pass. Codex rated `5ea341a..76b06df` correct (0.96; 75,545 input tokens).
- T6j: gentle-ai rated it medium (`under_budget`), a test only. Codex rated `5ea341a..8da9efa` correct (0.94; 58,767 input tokens).

### Failures and lessons
- To read origin/main, this session ran `git checkout --detach origin/main` in the shared checkout `D:\js-harness`. It noticed this within minutes and put the checkout back on `main` (clean, behind origin as before). Reads of another ref go through `git show <ref>:<path>` or a worktree, never a checkout of the shared folder.
- A `sed -i` on `odd/tasks/gate-wait.md` turned it from CRLF to LF and left a lone CR in the middle of a line. It was caught by `file` and `cat -A` before the commit. A script restored CRLF and split the line. This is the same trap JH 5 recorded: such edits go through the Edit tool.
- Another session's gate held the machine's lock, so the guard refused a `node --test` of two files. The files ran one at a time, and the long one ran in a `js-harness gate --` turn.

### Cost
- Gates: 7 commits through the gate (3 on gate-wait, 2 on memory-hygiene, 2 on first-version), plus one gate turn for the install file and this summary's commit.
- Codex: three runs, 199,354 input tokens in all, as their outputs say.
- gentle-ai: two reviews (two lenses each). The other commits were assessed only.
- Context: 50% at the last notice (16:02Z).
