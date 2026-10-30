# F8 docs: the detailed plan and the full harness documentation

Locator: `odd/tasks/f8-docs.md` · Engram mirror: `odd/f8-docs/tasks` · Branch: `docs/f8-plan-and-docs`
Delivery: documentation pull requests, chained if a slice passes about 400 lines · Session: JH 70

## Goal
One complete and precise base that all later work builds on: F8's plan detailed step by step in the
roadmap, and the harness documented whole (what each piece is, why it exists, how the pieces connect
and the state each must reach once F8 is done) in `docs/SPEC.md`, with the README checked against
the commands and the guide kept as a newcomer's path.

## Why
His request (L1): everything later is built on top of this, so it must be as detailed and complete
as possible. Today the plan of F8's step 4 is one paragraph of history in the roadmap's checklist,
and the specification describes the harness as it stands, still on gentle-ai, with no map of how
the pieces connect and no statement of where each must end.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-docs.md` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs progress` exits 0
- the roadmap's `## F8 plan` gives every step of step 4 (S3, the directives pass, S1, S10, S11,
  S5c-a, S13, S12, S2, S4a, S4b, S5, S5c-b, S6, S7, S9) and S8 its change, files, probe and pass
  line, cost, order and dependencies, his decisions and state
- `docs/SPEC.md` holds the architecture map and the target after F8 of every capability, and the
  steps' new capabilities that do not exist yet
- two blind readers, one Claude and one Codex, read the result for completeness and accuracy, and
  what they found is fixed once (`## Review`)
- a Spanish visual Artifact page covers the plan and the map, and its link is in the ready notice

## In scope / Out of scope
- In: `docs/ROADMAP.md`, `docs/SPEC.md`, `docs/GUIDE.md`, `README.md`, this document, a session
  summary under `docs/sessions/`.
- Out: any file under `bin/`, `evals/` or `scripts/` (docs only, no code, no evals); the feature
  documents of JH 68 (S11) and JH 69 (the S1 records fix), and their files, which are being written
  now; the diet and the reverse-engineering document, which stay the depth the plan links to.

## Constraints
- One home per fact (`AGENTS.md`): the plan links to the diet for depth instead of copying it; each
  step's state is read in its own feature document and only summarised here.
- Every claim carries its evidence (`path:line` or a command) or is marked [i] — the brief's rule,
  and `CLAUDE.md`, "Reporting".
- The `spec` row of `check` refuses a capability field other than the six (`bin/lib/spec.mjs:15`,
  `:60`) and a Proof or Today file that does not exist (`:117-128`), so a capability not yet built
  cannot be a `### ` entry under `## Capabilities`; it is described in a section of its own.
- `progress` counts only the checkboxes under the roadmap's `## Checklist`
  (`bin/lib/progress.mjs:206-224`), so the plan's section holds no checkbox and changes no count.
- The read surface S6 measures is the roadmap's Next and Decided and the open feature document's
  head (diet, section 7, C5), so the plan does not go into Next or Decided.

## Ask me before
Nothing of this task is his: it spends nothing and changes no decision of his. A decision found open
on the way is named in the plan as his, not taken.

## Specs
1. His words (L1): "Listo ahora que tienes toda las investigaciones, las mediciones, mapa, las
   comparativas y todo el plan, quiero que ahora me hagas un plan detallado y de una vez la
   documentacion completa y detallada de todo el arnes, listo? tiene que ser lo mas detallado y
   completo posible por que sobre ese vamos a hacer todo"
2. The plan: each step gets what it changes, the files, the probe and pass line, its cost ([i] when
   estimated), its order and dependencies, which of his decisions it waits on, and its state (the
   brief).
3. The documentation: every capability with its target state after F8 (gentle-ai gone, the
   complements under js-harness, directive coverage); the architecture map; the README checked
   against `js-harness --help` and the code; the guide kept as a newcomer's path (the brief).

## Decisions
- **Where the plan lives:** a new `## F8 plan` section of `docs/ROADMAP.md`, after `## Checklist`,
  one subsection a step with the same fields. Not in `## Next` or `## Decided` (the read surface),
  not as checkboxes (the counts). The F8 step 4 checkbox keeps its paragraph, which is the step's
  history and which JH 68 and JH 69 append to when they close; it gains a pointer to the plan. The
  state in the plan is a summary that names the feature document holding it.
- **Where the target state lives:** `docs/SPEC.md` gains `## The architecture` before
  `## Capabilities` and `## After F8` after it: a table that gives each capability its target and
  the step that brings it, and the capabilities F8 adds that have no code yet. The six fields of each
  capability are unchanged, since the `spec` row holds them.
- **No new document.** The roadmap, the specification, the README and the guide hold all of it.

## Tasks
- [x] T1 (kind: docs) this document — all; inline — 89ccab6f
- [x] T2 (kind: docs) the roadmap's `## F8 plan`, and the step 4 pointer — S2; inline — d366daae
- [x] T3 (kind: docs) `docs/SPEC.md`: the problem and the bet as of F8, `## The architecture`, `## After F8` — S3; inline — 84e80169, bae1f72e
- [x] T4 (kind: docs) `README.md` checked against `js-harness --help`, each command's `--help` and the code; gaps fixed — S3; one sub-agent, README only — this commit
- [x] T5 (kind: docs) `docs/GUIDE.md` kept as the newcomer's path: the review step and the stack as they are now, and what F8 changes — S3; inline — ef3397b0
- [x] T6 (kind: verify) the double review, one Claude and one Codex blind reader; fixes once — all; inline — this commit
- [x] T7 (kind: verify) `npm run check`, push, pull requests (chained if large), the Spanish Artifact, the ready notice — all; inline — PR 626, https://claude.ai/artifact/RJheCkzoPdSFHZpA4A52fm

## Review
Two blind readers over `d2bc8ab2..4978e351` (docs, README), given the files and the two checks
(completeness, accuracy), not this document: a Claude Opus reader (an Explore sub-agent, 8
findings) and Codex (`codex exec -s read-only`, 4 findings; it could not run `--help`, so its
findings are source-checked). Each finding was checked against the code before it was fixed;
fixed once, in one commit:
- S12 said nothing refreshes a project; `sync` already rewires the pre-push check and writes the
  clone's style and denies (`bin/lib/project.mjs:1593-1639`): the plan and the SPEC's After F8 row
  now build the migration on `sync` (Claude reader).
- "Where state lives" lacked `harness.json`, `.claude/settings.local.json`, `docs/rules.json`,
  `lands.jsonl`, `~/.js-harness/remote/`, `memory-hygiene/`, `gate-first`, `gate-wsl.json`,
  `refresh-backups`, `codex-review-homes`; the throughput row lacked the heartbeat (both readers).
  Checked while fixing: `refresh-backups` is written by `merge-queue --land --refresh-copy`
  (`bin/lib/refresh-copy.mjs:287`), not by `install`.
- The per-turn table lacked the auto-memory index (`bin/lib/payload.mjs:266`) (Codex).
- GUIDE and SPEC said pre-push refuses code without both reviews; it does for each review the
  project turns on, and `lensReview` is off by default (`bin/lib/functions.mjs:134-135`) (Codex).
- README: `doctor --hook` exits 2 on an unknown argument (`bin/doctor.mjs:355-360`); `onboard`'s
  exit 1 includes a link in the way (`onboard --help`) (Claude reader).
- S3's and S10's Files lists lacked the modules those steps added (Claude reader).
- The architecture diagram lacked `.claude/settings.local.json` and the lands (Claude reader).
Not fixed, with the reason: the Claude reader counted 41 source files naming gentle-ai; the count
is 40 (`grep -rl gentle-ai bin --include=*.mjs | grep -vc test.mjs`).

## Log
- L1 (2026-10-28, JH 70's brief from the lead, his request sent to the orchestrator mid-turn): "Listo
  ahora que tienes toda las investigaciones, las mediciones, mapa, las comparativas y todo el plan,
  quiero que ahora me hagas un plan detallado y de una vez la documentacion completa y detallada de
  todo el arnes, listo? tiene que ser lo mas detallado y completo posible por que sobre ese vamos a
  hacer todo"
- L2 (2026-10-28): inputs read on main `d2bc8ab2`: the roadmap, the diet's sections 1, 7 and 10, the
  reverse-engineering document's sections 11, 13 and 14, `docs/SPEC.md`, `docs/GUIDE.md`, the F8
  feature documents. Of the lead's pages, `plan-f8.html` and `proyeccion.html` were read as
  summaries; `estado-28oct.html` is not in the scratchpad folder the brief names (ENOENT). JH 68's
  and JH 69's worktrees hold no feature document yet (`ls odd/tasks` in each), so S11 and the S1
  records fix are described from the diet and the reverse-engineering document, as planned.
- L3 (2026-10-28): the README sub-agent fixed about 30 sections against each `--help` and the
  code (`node --test bin/readme.test.mjs` 5/5, `rules check` PASS). Out of this surface and left
  open: `upgrade --help` says npm by default while `bin/update.mjs:50` picks `--pm`, then
  `JS_HARNESS_PM`, then the installing manager; `bin/lib/gentle-ai-update.mjs:2-3` still says
  js-harness never writes the global CLAUDE.md, stale since S10's Rules block.
- L4 (2026-10-28): one PR, not a chain: about 930 changed lines, all documentation, one commit a
  document; the review-fix commit spans all five files, so a chain would rewrite them. PR 626; the
  Spanish page published. Next step: none in this session; the lead lands PR 626.
