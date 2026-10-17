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
