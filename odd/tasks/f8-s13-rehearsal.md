# F8 S13: the rehearsal on a scratch project

Locator: `odd/tasks/f8-s13-rehearsal.md` · Engram mirror: `odd/f8-s13-rehearsal/tasks` · Branch: `f8-s13-rehearsal`
Delivery: one pull request, a chain if it passes 400 lines · Test runner: `node --test`

## Goal
The whole path of the reverse-engineering document's 11.1 is walked once on a scratch project in a scratch home,
with the 11.3 guide, engram's recovery, the import row and a planted directive checked there, and a rehearsal
test beside `scripts/practice-lib.mjs` holds what runs free.

## Why
The roadmap's order puts S13 before S12 and S2: "the whole path is proven on a scratch project before his projects
move and before anything is removed" (`docs/ROADMAP.md`, F8 plan). S5c-a comes first "so the rehearsal shows
directive coverage and S12's migration carries it" (reverse-engineering document, 14.5).

## Done when
- `node --test scripts/rehearsal-lib.test.mjs scripts/rehearsal.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s13-rehearsal.md` exits 0
- `npm run check` exits 0
- `## Walk` below records one run of `node scripts/rehearsal.mjs` from a clean commit: each step's verdict, its
  cost beside its estimate, and the real home's files unchanged
- the rehearsal test fails on a planted break, and `## Log` names that run and the green one

## In scope / Out of scope
- In: `scripts/rehearsal-lib.mjs`, `scripts/rehearsal-lib.test.mjs`, `scripts/rehearsal.mjs`,
  `scripts/rehearsal.test.mjs`, this document, S13's line of `docs/ROADMAP.md`, `docs/FAILURES.md`, the session's
  summary under `docs/sessions/`; `bin/` only for a defect the walk finds, each its own test-first commit, named to
  the lead first when it touches install, uninstall or the manifest.
- Out: his real home (`~/.claude`, `~/.codex`, `~/.js-harness`'s install), any credential, gentle-ai's config, the
  installed copy (the lead refreshes it), S12's migration.

## Constraints
- Every install and uninstall runs in the scratch home (`mktemp -d`, outside the repo), with a PATH of only its own
  shims — because the real machine must stay untouched (high risk: installer and uninstall).
- No credential is copied or linked into the scratch home — because the brief forbids it.
- Nothing of gentle-ai, Orca or herdr is on the walk's PATH or among the commands it runs — the roadmap's pass line.
- A paid run reads its plan first, records its real cost beside the estimate, and stops at 1.5 times it — his
  words of 2026-10-29T10:40Z, as the brief quotes them.

## Ask me before
- A run that would pass 1.5 times its estimate.
- A `bin/` change to install, uninstall or the manifest.

## Specs
- S1 (ROADMAP, S13, Changes): "the whole path of the reverse-engineering document's 11.1 walked on a scratch project
  in a scratch home: `install` with a preset, `stack install`, `init`, a feature, a slice with both reviews, a push
  to a local bare remote, then `uninstall project` and `uninstall machine`".
- S2 (same): "the day-to-day guide of 11.3 checked there".
- S3 (same): "engram's recovery after a start and a compaction (13.3 row 11)"; row 11's check: "on S13's scratch
  project a session start and a compaction each bring back a planted observation within 16,384 bytes".
- S4 (same): "a `CLAUDE.md` planted above the project turns the import row red (row 16)".
- S5 (same): "a planted directive without a control makes `rules check` exit 1 (14.5)"; 14.5: "the step's probe
  test (S13's rehearsal test, run with `node --test`) plants it and passes only on that exit".
- S6 (ROADMAP, S13, Probe and pass): "the nine rows of 11.1 do what they say; nothing of gentle-ai, Orca or herdr
  takes part; after the uninstalls every path the manifests recorded is gone or back to its bytes".
- S7 (the brief): "A rehearsal test beside scripts/practice-lib.mjs, test first"; done when "the rehearsal test
  passes and fails on a planted break (say both runs)".

## Tasks
- [x] T1 (kind: docs) close S5c-a: T9 by the lead's decision, S5c-a's roadmap line — inline; `ef23c03e`
- [ ] T2 (kind: build) `scripts/rehearsal-lib.mjs`, the pure part: the walk's steps, what each must show, the planted
  fixtures, the comparison of recorded paths after the uninstalls, the absence of gentle-ai, Orca and herdr — S1 to
  S6; inline, test first
- [ ] T3 (kind: build) `scripts/rehearsal.test.mjs`, the free rehearsal test: a scratch project in a scratch home,
  `init`, the planted directive makes `rules check` exit 1 — S5, S7; inline, test first
- [ ] T4 (kind: build) `scripts/rehearsal.mjs`, the walk, run by hand — S1 to S6; inline
- [ ] T5 (kind: verify) one walk from a clean commit, recorded under `## Walk` with its cost — S1 to S6
- [x] T6 (kind: verify) the rehearsal test on a planted break, then green again — S7; L8
- [ ] T8 (kind: build) the `doctor` row of 13.3 row 16: the project's root `CLAUDE.md` imports `AGENTS.md` and no
  `CLAUDE.md` above it turns the import off, test first, its own commit (D1, L4) — S4; inline
- [x] T9 dropped by the lead (D3 corrected, L9): no run timed out (L7)
- [ ] T7 (kind: docs) Codex and the lenses on every code commit, gentle-ai lines, the independent verifier over
  the range, PR, ready notice, summary — inline

## Walk
- Run 1 (2026-10-30T02:04Z, `d4dd7199`, 1.3 minutes, host cost $0 of the $5 estimate): `real-home-before` PASS (19
  of his files hashed), `install` PASS (9 files and 20 hook entries recorded, 24 denies), `stack-install` FAIL:
  "engram setup claude-code exited 1: engram: the Claude Code plugin requires jq in PATH"; the rest skipped;
  `real-home-after` PASS (19 of his files as they were). Two findings, L5.
- Run 2 (2026-10-30 ~02:35Z, `4664012e`, host cost $0): `install` PASS; `stack-install` FAIL: "stack still lists codex",
  its manual `codex login`, which no scratch home can do since no credential enters it; the walk now takes that step
  as his, as it takes gh; `real-home-after` PASS (19 of 19); no process left, no browser. Walk 3 next.
- Run 3 (2026-10-30T02:35Z, `df754a6d`, 1.2 minutes, host cost $0.0112 of the $5 estimate): `install`, `stack-install`
  ("context7 in Claude as stack plans it; nothing missing but context7.codex, owed, and gh") and `init` PASS;
  `engram-start` FAIL: "no SessionStart:startup hook printed the planted observation: 0/0B, 0/0B, 0/0B, 0/71B,
  0/3168B". Cause, read in the kept root: the observation was saved (`engram search` in the scratch store finds it
  under project `project`), but the walk set `ENGRAM_URL`, which engram 0.1.19's `_helpers.sh` (lines 95-99) reads
  as an external server (`ENGRAM_MANAGED_LOCAL=0`), so `session-start.sh` started no server and its context fetch
  found nothing; the 3168 bytes are the protocol text alone. Fix: `engramEnv` sets only the port and the data
  folder, test first. One process left, a scratch codegraph binary under the pnpm prefix, stopped by the sweep; the
  sweep printed only the head of its command line, so it now prints the tail. `real-home-after` PASS.
- Run 4 (2026-10-30 ~02:50Z, `1e9d4458`, 1.8 minutes, host cost $0): `install` PASS; `stack-install` FAIL, `stack
  install` exited 1 where run 3's passed on the same rows: "codex installed: the command exited 0 and the probe cannot
  tell whether it worked", still unread at the end of the run (bin/stack.mjs:268-286), while `codex mcp add
  codegraph` ran after it. Not known why: the step keeps eight lines and stack does not say why its probe could not
  tell. In the kept root, `codex --version` answers `codex-cli 0.165.0` in about 200 ms three times, warm; a cold first
  run past `PROBE_TIMEOUT_MS` (5 s, bin/lib/stack.mjs:27) is a guess, not checked. No process left, no browser;
  `real-home-after` PASS. The walk now keeps every command's whole output in `commands.log` under its root.
- Run 5 (2026-10-30 ~03:00Z, `ddb28a02`, 2.3 minutes, host cost $0.0182 of the $5 estimate): `install`,
  `stack-install` (the probe answered this time, so run 4's failure did not come back), `init`, `engram-start`
  ("SessionStart:startup brought back s13-planted-33c3ec5e in 3421 bytes; MCP servers: codegraph, context7, engram")
  and `engram-compact` ("SessionStart:compact brought back s13-planted-33c3ec5e in 4097 bytes") PASS; `feature` FAIL:
  the walk's contract kept the template's "(kind: design | build | verify | docs)", which `contract check` refuses;
  `filledContract` now fills it, tested against `contract check`. One process left: `codegraph.js serve --mcp --path
  <scratch project>`, Claude's codegraph MCP server, running after its `claude -p` sessions ended (which session is not
  known); the walk now stops such a server after each host session and keeps it under `seen.hostLeftovers` as a
  finding for S12, while the final sweep still fails on any other. `real-home-after` PASS.
- Run 6 (2026-10-30T03:00Z, `38d1e348`, 1 minute, host cost $0): `install` PASS; `stack-install` FAIL as in run 4,
  "codex installed: the command exited 0 and the probe cannot tell whether it worked", now with the whole output in
  `commands.log`: no end-of-run read follows it. Cause proven and fixed in `bin/stack.mjs`, test first (L10).
  `real-home-after` PASS; no process left.
- Run 7 (2026-10-30T03:10Z, `dc8d0e33`, 2 minutes, host cost $0.0185 of the $5 estimate): `install`, `stack-install`,
  `init`, `engram-start` (3421 bytes), `engram-compact` (4151 bytes) and `feature` PASS; `push-main` FAIL: the first
  commit's gate ran `npm run test` and the walk's PATH had no npm ("\"npm\" no se reconoce como un comando interno o
  externo"); the walk now shims npm beside pnpm. `seen.hostLeftovers` holds two `codegraph.js serve --mcp` processes,
  one after each `claude -p` session: Claude Code leaves codegraph's MCP server running when a `-p` session ends on
  Windows, a finding for S12. `real-home-after` PASS; no other process left.

## Next step
State at the second context pause (2026-10-30 ~02:30Z, branch `f8-s13-rehearsal`, worktree
`D:js-harness.claudeworktrees8-s13-rehearsal`, HEAD after `1dacd138`, nothing pushed, no PR). Done: T1, T2,
T3, T4 (`d4dd7199`), T6 (L8), T8; walk guards `80d2a547`; D3 closed (L9), T9 dropped. Reviews: lenses and Codex
cover `f2110239..bb6223b9` (Codex verdict correct 0.96 on `34fc68e..bb6223b`; lenses 0 findings on
`6e5cd3e..bb6223b`); NOT yet reviewed: `d4dd7199`, `80d2a547` (scripts/rehearsal.mjs and its test). Running: walk 2,
`node scripts/rehearsal.mjs --keep` into `C:UsersOficina.claudejobsb7fa0ca	mpwalk-2.log`; read it, record it
under `## Walk` (cost beside $5, stop past $7.50), remove its kept root once no process holds it. If it fails, read
why before any rerun. Then: lens-review and codex-review of `bb6223b9..HEAD`; gentle-ai assess per slice (whole
branch read-only: medium, not due, under_budget, 1330 lines); S13's roadmap line; the independent verifier over
`f2110239..HEAD` (high risk); chained PRs (slice 1 `f2110239..57584e5d`, slice 2 `57584e5d..bb6223b9`, slice 3 the
rest); ready notice; summary `docs/sessions/2026-10-30-jh-90-f8-s13-the-rehearsal-on-a-scratch-project.md`; closed
notice. Owed to S12 for the report: engram's plugin needs jq (L5); Codex's mcp add leaves context7's login open (L7,
L9); the brief's surfaces gained `bin/lib/gentle-ai-absence.test.mjs` (NAMED list), `bin/lib/payload.mjs` (export).

## Log
- L1 (2026-10-29, the lead's brief `briefs/2026-10-29T19-21-42-028Z-0339f9b7.md`): "JH 90 · F8 S13: the rehearsal
  on a scratch project ... Then S13, its own feature document `odd/tasks/f8-s13-rehearsal.md`, opened before the
  first source write: the nine rows of 11.1 walked on a scratch project in a scratch home from `mktemp -d` (install
  with a preset, stack install, init, a feature, a slice with both reviews, a push to a local bare remote,
  uninstall project, uninstall machine), the 11.3 guide checked there, engram's recovery after a start and a
  compaction, a planted CLAUDE.md above the project turning the import row red, a planted directive without a
  control making `rules check` exit 1. Pass: as the roadmap's S13 block says (nothing of gentle-ai, Orca or herdr
  takes part; after the uninstalls every recorded path is gone or back to its bytes). A rehearsal test beside
  scripts/practice-lib.mjs, test first. Cost: the roadmap says one walk, about $5 [i] ... High risk (installer,
  uninstall, the real machine must stay untouched): every install and uninstall runs in the scratch home, never
  the real one; after its own checks, one independent verifier over the range ... Never touch credentials,
  ~/.claude, ~/.codex or gentle-ai config; never copy .credentials.json into a scratch home. Do not refresh the
  installed copy."
- L2 (2026-10-29, evidence, a read-only map of the code): `install` has no preset; the preset is `init --preset
  complete|lean|custom`, so row 1's "with a preset" is walked as `install` then `init --preset complete`. `stack
  install` runs codex, codegraph and context7 and leaves engram and its plugin as his steps
  (`bin/lib/stack-install.mjs:145-169`, F8 S11 L4), so the walk runs those steps as he would, from the printed
  fixes, and they are not in the manifest. `codex-review` links `auth.json` from the real Codex home into a lean
  home under the harness home (`bin/lib/codex-review-home.mjs`); `lens-review` runs on the CLI's own login and drops
  every token (`bin/lens-review.mjs:37`). Both pre-push rows pass a first push to a remote with no branch, so the
  walk pushes twice. The doctor row of 13.3 row 16 does not exist: `grep -rn "claudeMdExcludes\|@AGENTS\.md\|imports
  AGENTS\|above it" bin` finds only the payload row of `check` (`bin/lib/payload.mjs:232-267`); row 16 lands at S12.
- L3 (2026-10-29, decisions, the session's own): D2, the slice's two reviews run as any review of his runs, from
  his real environment with `--cwd` on the scratch project: the logins answer where they live, nothing is linked or
  copied into the scratch home, `lens-review` keeps no session (`--no-session-persistence`), and the records land in
  the scratch project's git folder. Only the reviews leave the scratch environment; every install and uninstall
  stays in it. D1, the lead's: row 16's import row does not exist, so S13 cannot turn it red as written. (a) S13
  builds it, test first, as a `doctor` row in `bin/` (S12 then uses it); (b) the step is recorded owed to S12 and the
  walk checks the rest. Recommended: (a), since S13's line is that the whole path is proven before S12, and the row
  is small. Until the answer, T2 to T4 build everything else.
- L4 (2026-10-29, the lead's note in the channel at 14:36 local): "Lead: D1 (a): build the doctor import row
  test-first in bin/doctor, its own commit; S12 reuses it. D2 yes: the two reviews run from his env with --cwd on the
  scratch project; nothing linked or copied into the scratch home, and the review records land in the scratch
  project's git dir, not this repo's." So T8 builds the row.
- L5 (2026-10-30, evidence, walk run 1): (1) engram's Claude Code plugin needs `jq` (and `curl`) on the PATH to set
  up; the walk's PATH had none, so the walk now links his `jq` beside `claude` (`curl` is System32's). Nothing in
  `bin/` names `jq` as a prerequisite of his engram step (`grep -rn "\bjq\b" bin` finds only `gh --jq`), so a machine
  without it fails at that step: owed to S12's guide. (2) The scratch Codex CLI stack installed (0.165.0) opened a
  browser: `stack install --tool context7` runs `codex mcp add context7 --url https://mcp.context7.com/mcp`
  (`bin/lib/stack-install.mjs`), which started context7's OAuth login and launched Brave with its profile in the
  scratch `LOCALAPPDATA`. The process tree read after the walk: node (the scratch codex launcher) -> codex.exe ->
  brave.exe at `https://clerk.context7.com/oauth/authorize?...`, still alive after the walk ended; killed by its tree
  (`taskkill /PID 23452 /T /F`, 8 processes), no Brave left, nothing entered in it. Assumed, not checked: the
  registration's 30 s timeout (`bin/lib/stack-run.mjs:12`) killed only the `.cmd` shim and left the tree. Not
  reproduced, since a rerun opens his browser again. D3, the lead's (an installer change): (a) `stack install`
  stops the whole tree of a timed-out run, and the walk keeps context7 out of Codex until a registration that opens
  no browser exists, recorded owed; (b) the walk runs without `--tool context7` and row 2 records it owed to S12;
  bin unchanged. Recommended: (a), since an orphaned login and browser on a timeout reach his real machine too.
- L6 (2026-10-30, the lead's note in the channel at 21:09 local): "Lead, D3: (a). Test first, its own commit: stack
  install stops a timed-out run's whole process tree (named to me: it touches install, so the independent verifier
  covers it). The walk leaves context7 out of Codex and records it owed, with why (codex mcp add starts context7's
  OAuth in a browser). Nothing in a walk may open his browser again: if another step would, stop it and tell me."
  So: T9 below; the walk runs `stack install --tool codex --tool codegraph` and registers Claude's context7 by
  stack's own plan (`RUNNABLE` of `bin/lib/stack-install.mjs`), and after every step a browser under a scratch
  process is stopped and fails the step.
- L7 (2026-10-30, a correction, JH 90's own): L5's assumed cause is refuted by evidence that was already in hand.
  A timed-out run makes `stack install` exit 1 (`bin/stack.mjs:245-250`; `bin/stack-install.test.mjs:293-300`),
  and walk 1's `stack install` passed its exit check, so no run timed out: `codex mcp add` itself returned and left
  context7's login running, its launcher's parent (pid 11288) already gone when the tree was read. T9 would not
  have stopped what happened. Recorded in `docs/FAILURES.md` (told-him-unverified, scratch-run-opened-browser). D3
  goes back to the lead with this: (a) T9 is dropped, and what Codex does after `mcp add` is owed to S12 (the walk
  keeps context7 out of Codex and its browser guard); (b) T9 is built anyway, for the latent case its comment
  already names (`bin/lib/stack-run.mjs:53`). Recommended: (a), since no run is known to have timed out.
- L8 (2026-10-30, evidence, T6): the planted break is `controlFaults` of `bin/lib/rules-coverage.mjs:193` returning
  no fault for a rule with no control. `node --test scripts/rehearsal.test.mjs` on it: exit 1, 6 pass and 1 fail, "in
  a scratch home, a planted directive without a control makes rules check exit 1 ...", with "rules check exited 1 but
  does not name the missing control of no-hand-deploy". The file restored with `git checkout`, the same command:
  exit 0, 7 pass.
- L9 (2026-10-30, the lead's note in the channel at 21:25 local): "Lead, D3 corrected: (a). Drop T9; Codex's mcp add
  leaving context7's login open is owed to S12 with the walk's log as evidence; the walk keeps context7 out of Codex
  and keeps its browser guard."
- L10 (2026-10-30, the lead's note in the channel at 22:02 local, on this session's notice that walks 4 and 6 fail
  in `stack install`): "Lead, (a): fix it in S13, test first, its own commit; the independent verifier covers it
  (install). First prove the cause you mark a guess (time the cold codex --version in the scratch home, or show the
  record left unverified in walk 4's log), as D3 taught; if the proof refutes it, tell me before building." Proof:
  a fresh copy of walk 6's `codex.exe` answered `--version` in 17977 ms the first time and 58 ms the second
  (`node cold-codex.mjs`, job tmp), past `PROBE_TIMEOUT_MS` of 5000; walk 6's manifest keeps `codex installed` with
  `applies: "0.165.0"`, so the record was read while its state was not, and bin/stack.mjs:267 queued only a record
  whose applies is null for the end-of-run read. The cause holds.
