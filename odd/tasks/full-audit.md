# JH 203 · Full audit of everything built

Branch: `worktree-full-audit` (this document only). Base: `origin/main` at `9d4546a7` (checked:
`git rev-parse --short refs/remotes/origin/main` printed `9d4546a7`, equal to HEAD).
Delivery: findings only, no code, rule or roadmap change. Opened 2026-11-14 by JH 203 (Opus 5.5) from the
lead's brief (`~/.js-harness/background/briefs/2026-11-15T02-10-23-626Z-2a6b0f77.md`).

## State
Step 1 of the brief done: partition sized, costed, P0 cross-cut and the installed-copy diff run by script.
Waiting for the lead's go on a tier (A, B or C below; B recommended) and on the optional coverage run.
No sub-agent launched. Next after the go: launch the parts of the chosen tier on `opus`, then the verifier,
then the synthesis here and the page `auditoria-2026-11-14.html` in the notes folder.

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

## Tasks
- [x] T1 (kind: design) Partition, sizes, P0 and the cost of each tier; commit; notify waiting.
- [ ] T2 (kind: verify) After the go: one opus sub-agent per part of the chosen tier, findings in files.
- [ ] T3 (kind: verify) One adversarial verifier over every remove, merge, done or broken finding.
- [ ] T4 (kind: docs) Synthesis here: findings by severity, keep / fix / shrink / remove, what moves maturity.
- [ ] T5 (kind: docs) The page `auditoria-2026-11-14.html` in the notes folder, not published.

## Notes folder
`NOTES=C:/Users/Oficina/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/side-session-notes/local_4096ade6-b204-4ba7-8cb1-aae81ba3bb49`

## Log
- L1 2026-11-15T01:43:53Z, his request as written (lead transcript 69918425 line 11078): see Why.
- L2 2026-11-14, the lead's brief: audit everything built, part by part, with sub-agents; first step the
  partition and its cost, then stop for the go.
