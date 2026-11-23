# JH 203 · Full audit of everything built

Branch: `worktree-full-audit` (this document only). Base: `origin/main` at `9d4546a7` (checked:
`git rev-parse --short refs/remotes/origin/main` printed `9d4546a7`, equal to HEAD).
Delivery: findings only, no code, rule or roadmap change. Opened 2026-11-14 by JH 203 (Opus 5.5) from the
lead's brief (`~/.js-harness/background/briefs/2026-11-15T02-10-23-626Z-2a6b0f77.md`).

## State
T1-T5 done; the Synthesis and the page reconciled with `verifier.md`'s Verdicts and every part's `## Not checked`
(the advisor's close review). Last: `js-harness contract run`, then `notify --kind closed --summary
docs/sessions/2026-11-15-jh-203-auditoria-completa-de-lo-construido.md`.
The notes folder this document's Done when, Depth pass specs 1, 2 and 4 and the Synthesis's
sources point to was found gone on 2026-11-22 (L6), when it was removed not known, with the 13 findings files, `verifier.md`, the coverage summary, `p0-v2.md` and the page.
The Synthesis below is the surviving copy of the audit. Those checks now fail (the Done when line on the branch at origin still holds), and no replacement proof is written.

## Goal
Tell, part by part with evidence, what of js-harness to keep, fix, shrink or remove so the harness matures.

## Why
His words, 2026-11-15T01:43:53Z (lead transcript 69918425 line 11078, quoted with `js-harness sessions --quote`):
"Estoy desde el movil y me surgio una duda, recuerda que tenemos una ventana de contexto reducida de
aproximadamente 350 mil tokens y este proyecto se ha hecjo grande, si lo vamos a revisar yo creo que lo mejor
seria colocar una sesion aparte con varios sub agentes que los revisen a fondo y por partes y hacer hacer el
trabajo mejor o que opina? No es solo ver el plan sino ver completamente todo que se ha hecho". js-harness is the
core of his long-maintained enterprise projects, and he judges it immature: 0 of the 64 steps open on 11-13
closed, and the week added more steps than it closed (the lead's figures, from the brief; not re-measured here).

## Done when
- `node -e "require('fs').accessSync('C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49/full-audit/verifier.md')"` exits 0
- `grep -c "^## Synthesis" odd/tasks/full-audit.md` prints 1
- `node -e "require('fs').accessSync('C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49/auditoria-2026-11-14.html')"` exits 0
- `git ls-remote origin worktree-full-audit` prints this branch's head
- The lead has the `ready` or `closed` notice.

## In scope / Out of scope
- In: every tracked file at `9d4546a7`, through the parts below; the installed copy of js-harness and what it
  installs under `~/.claude`.
- Out: any code, rule or roadmap change (the brief); `odd/tasks/` beyond grep, because the plan review of
  2026-11-14 and its verifier already judged the 74 open steps; whether each of his directives is applied,
  because the directives audit of 2026-11-13 (`lead-audit-report.md`) and `odd/tasks/audit-cement.md` did it.

## Constraints
- Sub-agents on `opus` only — because the guard refuses Fable for sub-agents.
- Each sub-agent's only allowed edit surface is its own findings file, `$NOTES/full-audit/<part>.md` — because
  the branch carries only this document and findings are read from files, never from chat summaries.
- No sub-agent before the lead's go — because the brief stops here.
- Each part's fresh read stays under about 220k tokens — because his window is about 350k and a sub-agent that
  compacts loses its evidence.
- No Codex — because nothing here is code to review (the brief). This partition was not double-reviewed for
  the same reason; the lead decides whether it needs to be.
- No `codegraph index`: this worktree has no `.codegraph/` (`ls -d .codegraph`: no such file), so sub-agents use
  Grep and Read.

## Ask me before
The lead decides: the tier; the coverage run; launching more than one wave of sub-agents at once.

## Depth pass
- 1. Method: a software audit as a reviewer of an inherited codebase does it: a mechanical inventory first
  (import graph, test pairing, what ships), then reading by part with each finding pinned to `path:line` or a
  command's output, then an adversarial pass on every "remove, merge, done, broken" verdict before it is
  believed. Reuse: the plan review and the directives audit are inputs, not redone; the Fable 5.2 audit of
  2026-11-09 (`docs/audits/2026-11-09-fable-5-2-audit.md`, its triage in `odd/tasks/audit-u*.md`) gives each part
  its earlier findings to re-check, not to re-find.
- 2. Raw material: the tree at `9d4546a7` (`git ls-tree -r -l`); the installed copy at
  `C:/Users/Oficina/AppData/Local/pnpm/store/v11/links/@/js-harness/0.97.0/8c4d…/node_modules/js-harness` (the
  pnpm shim's `cmd-shim-target`); `$NOTES/plan-review-2026-11-14.md` (28 KB),
  `$NOTES/plan-review-verify-2026-11-14.md` (17 KB), `$NOTES/lead-audit-report.md` (147 KB, the audit
  `audit-cement.md` names), `docs/audits/2026-11-09-fable-5-2-audit.md` (115 KB).
- 3. The bar:
  spec 1: `node -e "console.log(require('fs').readdirSync('C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49/full-audit').length)"`: none, new behaviour (one findings file per part, each finding with evidence)
  spec 2: `node -e "require('fs').accessSync('C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49/full-audit/verifier.md')"`: none, new behaviour
  spec 3: `grep -c "^## Synthesis" odd/tasks/full-audit.md`: 0 today
  spec 4: `node -e "require('fs').accessSync('C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49/auditoria-2026-11-14.html')"`: none, new behaviour
- 4. Refutation: the request fails if the harness is already sound and covered, so nothing would come of an
  audit. Run now: the P0 script below found 35 `bin` sources with no sibling test, 2 lib files imported only by
  tests, 3 imported by nothing, and the installed copy differing from main in 4 files.
  Verdict: supports
- 5. Request: read every part of js-harness at `9d4546a7` through about 13 opus sub-agents, each under 220k
  fresh tokens, seeded by a mechanical cross-cut and by the earlier audits' findings for its part; attack every
  remove, merge, done or broken verdict with one verifier; and give him a Spanish page that says what to keep,
  fix, shrink or remove and what most moves maturity.
  Adds: none

## Specs
1. The audit he asked for, in his words (L1): "colocar una sesion aparte con varios sub agentes que los revisen a
   fondo y por partes" — one sub-agent per part, findings in files.
2. "No es solo ver el plan sino ver completamente todo que se ha hecho" — every tracked file is in a part or
   named as excluded with the input that already covers it.
3. Under his window: "una ventana de contexto reducida de aproximadamente 350 mil tokens" — each part sized to fit.

## Partition

### Sizes at 9d4546a7
From `git ls-tree -r -l 9d4546a7`, classified by `$NOTES/full-audit/part2.mjs`. The parts sum to the tree:
28,119,890 bytes, 0 files unassigned.

| Part | What | src files | src bytes | test files | test bytes |
|---|---|---:|---:|---:|---:|
| A1 | sessions board, machine load, process tree | 15 | 418,710 | 16 | 843,408 |
| A2 | background sessions, channel, notify, wait, wake | 24 | 361,455 | 18 | 493,783 |
| A3 | stretch, resume, loop, tui, reply, pause, status line | 23 | 418,670 | 24 | 605,442 |
| B1 | codex review | 14 | 409,718 | 16 | 784,416 |
| B2 | lenses, double review, merge queue, land, codex meters | 27 | 328,979 | 26 | 440,017 |
| C | guard, gate, hooks | 37 | 515,230 | 33 | 737,621 |
| D | rules and protocols | 28 | 463,128 | 29 | 577,454 |
| E1 | install, update, stack, doctor, CLI entry | 35 | 533,292 | 42 | 950,123 |
| E2 | project, manifest, profiles, onboard, migrate | 20 | 552,540 | 21 | 749,666 |
| F | backup, remote, clean, memory | 18 | 365,846 | 16 | 540,541 |
| G | check, contract, template, progress, report, pages | 44 | 553,707 | 68 | 1,167,557 |
| H | docs and root files | 197 | 3,240,541 | 0 | 0 |
| I | evals, scripts, workshop, CI, git hooks | 567 | 3,534,703 | 78 | 1,808,910 |
| X | `odd/tasks` (excluded, grep only) | 241 | 6,724,433 | 0 | 0 |

`bin` totals: 4.92 MB sources, 7.89 MB tests (12.8 MB). Test titles alone (`grep -hE "^\s*(test|it|describe)\("`)
are 7,337 lines, 856,833 bytes in `bin`, and 1,620 lines, 182,380 bytes in evals, scripts and workshop.

### P0, the mechanical cross-cut (run, by script, before any part)
Per-part readers cannot see dead or duplicated code across parts, so a script did it first; its output goes to
every sub-agent as input (`$NOTES/full-audit/p0.md` and `p0.edges.tsv`, made by `graph.mjs` there; the installed diff by `instdiff.sh`, its output in `installed-vs-main.txt`).
- Import graph of 982 `.mjs/.cjs/.js` files (outside `odd`, `docs`, `.claude`).
- Lib files imported only by tests: `bin/lib/hook-count.mjs`, `bin/lib/template-registry.mjs`.
- Imported by nothing (to check for a spawn by path): `bin/lib/no-test-outside-turn.cjs` (5 text mentions),
  `bin/lib/project-messages.mjs` (1), `bin/lib/rules-coverage-data.mjs` (24).
- 35 `bin` sources with no sibling `.test.mjs`; 20 of them with no test importing them directly (transitive cover
  not measured). 56 tests with no same-name source (mostly `check-*.test.mjs` slices of `check.mjs`).
- Installed copy vs main: 289 shipped files hashed with `git hash-object` against the tree; 4 differ
  (`bin/lib/pages-sections.mjs`, `report-pages.mjs`, `stretch-forecast.mjs`, `stretch-render.mjs`, all last
  changed by PR 879's commits, e.g. `066e3895`; the copy's link is dated 20:51 local, assumed to predate that
  merge); 0 shipped files absent from main.
- Assumed, not checked: the regex grouping of files into parts; the import edges let each sub-agent move a file
  whose importers mostly sit in another part, and say so in its findings.

### What every sub-agent gets and does
- Reads: its part's sources in full (data tables — `profiles-data.mjs`, `rules-data.mjs`,
  `rules-coverage-data.mjs` — by structure, not line by line); its part's test titles, at most 15k tokens, and
  test bodies only where a finding needs them; P0; the Fable 5.2 audit's findings for its files, re-checked;
  the plan review's rows that touch its part.
- Does not read: `odd/tasks/` (grep only), `docs/sessions/`, `docs/host-updates/`, `docs/proposals/`,
  `docs/sweep-2026-10-11.md`, `evals/results/`, other parts' sources (only their import edges).
- Writes: `$NOTES/full-audit/<part>.md`, at most about 8k tokens, in five sections (works reliably; broken or
  fragile; dead or duplicated; not covered by a test or check; docs claim, code does not), each finding with
  `path:line`, a command and its output, or a commit, and a verdict keep / fix / shrink / remove.
- Its prompt carries the `## Allowed edit surfaces` heading (its findings file only) and the `## Key Learnings`
  closing instruction.

Per part, beyond that: A1–A3, B1–B2, C, D, E2, F, G read their `bin` files as listed in the table. E1 also
compares what `install` writes under `~/.claude` (hooks, skills, output style) with what main renders. H reads
`README.md` (158 KB), `docs/SPEC.md`, the decided and done parts of `docs/ROADMAP.md`, `docs/RECORDS.md`,
`docs/RULES.md`, `docs/GUIDE.md`, `docs/README.md`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `harness.json`, and
`docs/FAILURES.md` through `js-harness failures`; it checks each command and claim the docs make against the
code. I reads the eval runner and suite entry points, the scripts and workshop headers, what runs each of them
(CI, hooks, `package.json`, the heartbeat), and their largest files up to about 450 KB; not `evals/tasks/` data,
`evals/results/`, `evals/review/` or `evals/long-session/` beyond their listings.

### Cost of each tier
Estimate, not measured: 3.5 bytes a token for code and 4 for prose, plus 15% for the line numbers Read adds,
plus 20k tokens a part for its brief, P0, and earlier findings. These are fresh tokens read; every turn re-reads
the context from cache, so the bill is several times the fresh figure, most of it cache reads.

| Part | B: sources full, titles ≤15k | C: entry and largest files |
|---|---:|---:|
| A1 | 173k | 75k |
| A2 | 154k | 70k |
| A3 | 173k | 75k |
| B1 | 170k | 75k |
| B2 | 143k | 65k |
| C | 204k | 85k |
| D | 164k | 70k |
| E1 | 210k | 85k |
| E2 | 188k | 80k |
| F | 155k | 70k |
| G | 217k | 85k |
| H | 206k | 80k |
| I | 183k | 80k |
| Verifier | 190k | 120k |
| Total | about 2.5M, 14 sub-agents | about 1.0M, 7 sub-agents (parts merged in pairs) |

- A, everything read: 28.1 MB, about 9.2M fresh tokens, over 60 sub-agent windows at 150k each. Not proposed:
  `odd/tasks/` alone is 6.7 MB of plan text already judged by the plan review.
- B, recommended: every `bin` source read whole, which is where the six questions of the brief are answered;
  tests by title, since "what no test covers" needs the titles and P0, not the bodies.
- C: each part's command and its three or four largest libs whole, the rest by header comment (first 25 lines).
  It misses fragile code in small files, which is where P0's untested sources sit.

Optional, for the lead to decide, not run: one `node --test --experimental-test-coverage` over `bin` to measure
"what no test covers" instead of inferring it. Cost: one full suite run on this machine (its time not measured
here), and a few thousand tokens to read a summary written to a file.

## Synthesis

Sources: the 13 findings files `$NOTES/full-audit/{A1,A2,A3,B1,B2,C,D,E1,E2,F,G,H,I}.md` (each finding carries its
`path:line`, probe or commit there; ids below point to them), the verifier's `$NOTES/full-audit/verifier.md`, the
coverage run `$NOTES/full-audit/coverage-summary.md`, and P0 (`p0-v2.md`). Every finding below is the reader's
claim unless marked **verified** (the verifier re-derived it, re-ran it where noted).

### Bad news first
- **The checks that decide "ready" can pass while what they check is false.** The review gate can say "covered"
  for code no reviewer read (B1-1, B1-2, B2-1, verified by reading; B1's two by the reader's probe), a session can
  forge a Codex review record the push accepts (C-3 + B2-12: the guard bypass is **verified, re-run** — the guard
  passes `sort -o` and `awk` writes to `codex-reviews.jsonl`; that the push then accepts it is verified by reading
  only: `isValidCodexReview` admits a record on shape alone, `bin/lib/codex-reviews.mjs:117-125`), the gate runs unlocked after one stray file (C-12, **verified on Windows**:
  `EPERM` in 1,353 ms, `gate-turn.mjs:171-172`), and, by the readers' word, not attacked by the verifier:
  `rules check` passes with 52 hits of its own patterns (D-1..3), the size ceiling counts lines while a file packs
  2,811-character lines (E2-24, verified, medium), and a backup is recorded as a success while a repository went
  unbundled (F-2; F-4 verified). This is the core of "immature": the harness's own proofs
  are weaker than its prose says.
- **The lead can miss notices.** `wait` misses a notice stamped before it started but appended after (A2-1,
  verified by reading), and a blocked session's notice went to a record no lead reads (A2-2, partly verified: JH
  199's message that 878's land removed its worktree sits in `D--js-harness-worktrees-codex-spend.jsonl`, unseen;
  the cause is that land removing the worktree under the session, so `mainCheckout` fell back to the folder, and
  the reader's proposed fix would not have fired).
- **Security guards have holes.** Any session can approve a permission card meant for the lead (C-2, verified by
  reading). By the readers' word, not attacked: the guard never sees the host's `PowerShell` tool (C-1); 8.3 short
  names pass the secret-path guard (C-5); `remote` accepts `bypassPermissions` and nothing shows it afterwards
  (F-10); hooks fail open on any error (C-9).
- **The undo promise of AGENTS.md holds for `~/.claude` only.** Installed hooks, skills and output style match main
  and are recorded (E1, probe), but about 20 folders under `~/.js-harness` survive `uninstall machine` silently
  (E1-3), a killed `init` leaves writes unrecorded (E2-1), the `@AGENTS.md` import is not recorded (E2-2), and a
  replaced user file is never restored (E2-3).
- **The earlier whole-code audit (Fable 5.2, 2026-11-09) is mostly unpaid.** Per the readers' re-check tables:
  A1 3 fixed / 7 open; A2 4 / 18; A3 3 (+1 partly) / 21; B1 1 / most; B2 3 / 18; C 1 / most; D 4 / 14; E1 0 / 15;
  E2 4 / most; F 2 / 5; G 5 / most; H 7 / 16; I 4 (+3 partly) / about 25. Roughly 30 fixed against 170 or more
  still open, five days later (counts assumed from the readers' files, not re-tallied here).
- **The workshop heartbeat has been down since 2026-11-11** (I-1, **verified, re-run**: `ticks` exits 1, all three
  ticks stale), so nobody reads the daily Windows run, and SPEC's "a Windows regression is found within a day"
  (`docs/SPEC.md:397`) is false today.

### What works reliably
- Install into `~/.claude`: every file and hook recorded, hashes match main (E1).
- The rules registry and `rules change` on `rule/` branches: 60 merged PRs since 2026-10-16, quotes checked against
  transcripts (D).
- The Codex launch on Windows: shim, PATH, stdin prompt, tree kill, all tested (B1).
- Backup restore never overwrites newer data (F); `clean` confines each kind to its folder and logs deletions (F).
- CI `gate.yml` runs what AGENTS.md says, Linux plus the Windows `remote` job (I).
- The test suite: 7,692 tests passed in one coverage run; every `bin` source but one data file and three `.ps1`
  scripts is loaded by a test (`coverage-summary.md`). The 4 failures were 3 timing tests under machine load and
  `report-feature.test.mjs:120`, not reproduced in 20 runs (G-8).
- Docs: every backticked command and flag but one exists, every path exists, 17 of 17 sampled defaults match (H).

### Findings by severity (after the verifier)
High, held by the verifier:
| Id | What | Verdict |
|---|---|---|
| B1-1 | removing a `-codex-review` mark leaves unreviewed code "covered" | fix |
| B1-2 | an `--unavailable` skip erases an owed correction | fix |
| B2-1 | commits before a `codexReview: false` commit are asked by no review | fix |
| C-3 + B2-12 | forged Codex record accepted by `check --push` | fix (one evidence rule for both reviews) |
| C-2 | any session can approve the lead's permission card | fix |
| C-12 | one stray file in `gate/lock/` and every gate runs unlocked | fix |
| A1-1 | copied transcript entries rewind the reported context size | fix |
| A2-1 | `wait` misses a notice in flight | fix (stamp at append, or cursor by count) |
| E2-1 | killed `init` leaves its writes unrecorded | fix |
| I-1 | workshop heartbeat down since 2026-11-11 | fix |
| I-5 | `release-gate.mjs` has never gated a release, and accepts any record file | fix |
Partly held (verifier): A2-2 (mechanism holds; cause is a land removing the session's worktree, so the fix must
cover a vanished folder, not a worktree being created), A3-1 (installed copy one land behind: normal lag, but the F8
share it shows is wrong; main also drops one finished step, G-1), E1-1 (`stack backup` leftovers: the next run
refuses and names them). Holds with severity lowered to medium: E2-24 (line-count ceiling).

Medium, the recurring patterns: lens findings never block (B2-2); `check`'s quiet line hides Codex debt (G-2);
contract, spec and failures rows check shape only (G-13); a documents-only commit runs two test files (G-3);
backup mirrors deletions with no shrink guard (F-1) and judges "on a remote" from stale refs (F-3); the engram swap
can leave no binary (E1-2); `wake` misses worktree sessions (A2-3); PowerShell started by bare name (A1-2);
non-atomic writes of shared or user files (A2-6, A2-8, E1-12, B2-10: `codex-trust` rewrites `config.toml` in
place); each Bash call pays two node starts, 1.1 s and 1.5-2.1 s on a loaded machine (C-8); docs describe three
times what the code does, and the prose drifted to features that left or moved to the workshop (H).

### Keep, fix, shrink, remove
- **Keep:** install's `~/.claude` side, the rules registry and `rules change`, `rules-sources`, the Codex launcher,
  backup restore, `clean`, CI `gate.yml`, `process-tree`, `machine-busiest`, `stall`, `pause`, `land-records`,
  `default-branch`, the testkits and convention tests, `GUIDE.md`, `RULES.md`, `FAILURES.md`.
- **Fix first (the high table above), then:** B2-2, G-2, G-3, G-13, F-1..4, E1-2..4, E2-2..4, A2-3, C-1, C-5,
  C-9, F-10, H-1, H-2.
- **Shrink:** `bin/lib/sessions.mjs` (227 KB, 48% comments; split by consumer, 71 of 76 exports live, A1 S1);
  `bin/codex-review.mjs` (159 KB, 52% comments, one 1,166-line function, B1-21); `bin/lib/manifest.mjs` (135 KB, 50 KB
  skill prose, to about 60 KB, E2-25); `bin/check.mjs`; rules coverage, `rules switch`, `rules applied` (roughly
  90-120 KB, an estimate, D); the merge queue's refresh-copy machinery (about 44 KB, B2-20); onboarding profiles (1
  of 11 kinds used, E2-26); `resume --pause` load cost (A3); README and SPEC to one home each, with `--help` the
  source for command prose (H).
- **Remove, cleared by the verifier (no caller found):** `RELIEF_LINES` re-export and `QUESTION_DISMISSED` (A1-12);
  the TUI's `sync` action and `computeStackState` (core-04-11); the never-read `kind:'stretch'` page record
  (core-07-11); the excused mechanism (B1-12, 0 firings; then C-11's fix is moot); `runPrompt`, `runFindings` and
  `runSession`'s `current` branch (B1-13, B1-14); the gentle-ai `--base-ref` guard (C-20); `traceName` (C-23); dead
  parameters in `update.mjs` (E1-19); the `trustConfigs` write path (E2-19, its reader stays); dead imports in
  `remote.mjs` (F-18); `branchMatches` (G); workshop `audit` (I-29, weakly).
- **Remove, the reader's claim, not attacked:** `docs/sweep-2026-10-11.md`; the other unused exports named per part;
  the old scripts of I-6/I-28 beyond what the verifier checked.
- **Not to remove as written** (verifier): E2-18 (`--home` is passed by `tui.mjs:461`); I-14 (`rules-switch.mjs:289`
  reads the Codex probe by path); I-17 (`rehearsal*` is imported by `scripts/migration.test.mjs:15-16`, and
  `rehearsal*` and `s2-verify` are listed by path in `conventions-model-home.test.mjs:43` and
  `gentle-ai-absence.test.mjs:58-59,109-110`); `stack backup` (E1-15: unused, but a documented command, a ROADMAP
  line and `s2-verify` reference it: his call); `docs/todo.md` (indexed as the live inbox); G's `## Effort` (47 task
  documents carry it; only the validation may go); D-13 (a project-rules key, a config-format change).
- **His call:** the Codex-as-agent eval (about 250 KB, one result from 2026-10-13, I-14), the status line (A3-4
  says remove, E1 says keep and test), `JS_HARNESS_MERGE_QUEUE=1` as the only guard of main pushes (I-4, B2-3).

### What most moves maturity
1. **One honest review gate.** Fix B1-1, B1-2, B2-1, B2-2 and the forged-record hole with one evidence rule shared
   by Codex and lens records, and make `check`'s quiet line show both debts (G-2). Today the land's proof is the
   weakest point and the most consequential.
2. **A notice path that cannot lose a notice.** A2-1 and A2-2, then `wake` for worktrees (A2-3). Sessions run in
   the background; a lost notice is a lost session.
3. **Close the guard holes before adding guards.** C-2, C-1, C-5, C-12, F-10 visibility; decide fail-open vs
   fail-closed per hook (C-9).
4. **Pay the backlog before new mechanisms.** About 170 earlier-audit findings are open and the plan added more
   steps than it closed this week; a slice that fixes findings is maturity, a new command is not.
5. **Shrink to what is read.** Split the three largest files, remove what the verifier cleared, give docs one home.
   Half the code is comment prose that no test checks.
6. **Restore the heartbeat and make "installed = main" visible.** I-1 now; bump the version (unchanged since
   2026-10-27 across 1,098 commits, H-6) so the label tells copies apart.

### Disagreements between readers (from the verifier)
M36 fixed (A3, E2) vs folders still left (E1-3): both hold, different scope. Excused mechanism: remove (B1-12) vs
fix (C-11). Status line: remove (A3-4) vs keep and test (E1). F8 share: main's 16/22 also drops one finished step
(G-1). Severity of non-atomic writes applied unevenly (A2-6, A2-8, E1-12, B2-10).

### How it was taken, and its limits
- 13 opus readers in three waves, one verifier: the sum of their reported `subagent_tokens` is about 3.3M (66k
  to 304k each), against the 2.5M fresh estimate; whether that field is the final context or the total spent is not
  known, and the bill, with cache re-reads, is a multiple of it.
- Not checked: the verifier attacked 43 findings (all 15 high, 21 remove, a 7-row convenience sample of medium),
  not the rest; its error rate is 1 refuted of 43, with remove verdicts wrong or incomplete 7 of 21. B1-1, B1-2,
  B2-1, A2-1, C-2 and E2-1 were re-read, not re-probed, by the verifier. `evals/`, `scripts/`, `workshop/` have no
  line coverage. Wave 1 (A1, A2, A3, B1, B2) ran before the coverage summary existed, against the lead's ask that
  every part get it; each of those five says so and inferred coverage from test titles. Wave 1 readers ran their
  part tests under load, which made timing tests fail; waves 2 and 3 ran none.
- Not read (from each part's `## Not checked`): `odd/tasks/` (6.7 MB, grep only); `docs/sessions/`,
  `docs/host-updates/`, `docs/proposals/`; SPEC `:274-1005` beyond three capabilities, ROADMAP from `:157`, RECORDS
  past line 60 (H); `resume.mjs:300-454,720-829` and most of `stretch-render.mjs` (A3); `reviewCoverage` and
  `codexReviewCoverage` bodies behind B2-5 and B2-12 (B2); `test-run-warning.mjs:120-237`, `permit.mjs` parsing,
  parts of `trace-reads.cjs` (C); `rules-switch.mjs` outside `switchRules`, `rules-applied-read.mjs`, parts of
  `rules-coverage.mjs` (D, by structure); `stack-backup.mjs` past line 330 (E1); large spans of `lib/onboard.mjs`,
  `profiles.mjs`, `project-coverage.mjs`, `share-check.mjs`, `bin/migrate.mjs` (E2); `pages*.mjs`, `summary`,
  `measures` beyond cited lines, the 56 `check-*.test.mjs` bodies (G); `practice*`, workshop `throughput` and `docs`
  by structure (I). Test bodies were read only where a finding cites them. A1 (66k reported tokens), E1 (107k) and
  G (105k) finished well under their sized parts; their `Not checked` lists are the record of what they skipped.
  So "28.1 MB in parts" means every file was assigned, not every byte read.
- Two inputs were wrong and corrected during the run: P0's first import graph missed `export … from` (fixed in
  `p0-v2.md`; it had made `hook-count.mjs` and `project-messages.mjs` look dead), and `rules-coverage-data.mjs` and
  `template-registry.mjs` are read as text by path, not dead.

## Tasks
- [x] T1 (kind: design) Partition, sizes, P0 and the cost of each tier; commit; notify waiting.
- [x] T2 (kind: verify) After the go: one opus sub-agent per part of the chosen tier, findings in files.
- [x] T3 (kind: verify) One adversarial verifier over every remove, merge, done or broken finding.
- [x] T4 (kind: docs) Synthesis here: findings by severity, keep / fix / shrink / remove, what moves maturity.
- [x] T5 (kind: docs) The page `auditoria-2026-11-14.html` in the notes folder, not published.

## Notes folder
`NOTES=C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49`

## Log
- L1 2026-11-15T01:43:53Z, his request as written (lead transcript 69918425 line 11078): see Why.
- L2 2026-11-14, the lead's brief: audit everything built, part by part, with sub-agents; first step the
  partition and its cost, then stop for the go.
- L3 2026-11-14 22:43 and 22:44 local, the lead (channel notes, its claim): "go for JH 203: tier B"; "14 opus
  sub-agents as your doc sizes it, in waves of at most 5 at a time to hold machine load; the verifier after all
  parts. Run the optional coverage run once over bin (summary to a file in your notes path) before the wave with G
  and C, and give it to every part." It also asked why the waiting notice never reached the channel: it was never
  sent. No guard or gate refused it; the session had committed and pushed `b8683009` and was at the brief's gate
  step (advisor, then one call, then the notice) when the go arrived from the pushed document. The advisor tool
  answered this session at the partition step (before the commit), so it was not down here then.
- L4 2026-11-14 to 15, mid-run decisions of this session: coverage run started at the go, alongside wave 1; after
  wave 1's parallel part-test runs (about 200 node processes, timing tests failing) the common brief forbade part
  test runs for waves 2 and 3; P0 re-run as `p0-v2.md` after readers C and E2 showed it missed `export … from`;
  reader C used one nested general-purpose sub-reader for the gate files and marked its claims suspected.
- L5 2026-11-15, the close against the depth pass. Item 3: spec 1 met (13 files), spec 2 met (`verifier.md`), spec 3
  met (one `## Synthesis`), spec 4 met (the page). Item 4: predicted the request holds (P0: 35 untested sources, 4
  installed files differing); measured 15 high findings, 12 held and 3 partly by the verifier, so the refutation
  test pointed the right way. Commits: `b8683009` 2026-11-14 21:23 local, `04a29a7a` 2026-11-15 00:55,
  `26aae220` 00:59.
- L6 2026-11-22, JH 301 at the lead's word, after PR 892 landed this document: the notes folder is gone.
  `ls C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49`
  printed "No such file or directory", and so did `ls` on its `full-audit/verifier.md` and `auditoria-2026-11-14.html`.
  So the Done when's first and third commands, and Depth pass specs 1, 2 and 4, were found failing that day (when the folder was removed is not known); `git ls-remote origin worktree-full-audit` still prints the branch. They are left as
  written, since they record what was proven on 2026-11-15, and no new proof replaces them.
