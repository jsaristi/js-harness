# JH 160 · F8 S5: skills, memory and rules (the part that stays in F8)

Locator: `odd/tasks/f8-s5-rules.md` · Branches: `rule/f8-s5-memory-record` (PR 1), then `f8-s5-2-rule-pass` and
`f8-s5-3-lens-probe`, chained · Delivery: one pull request a slice · Test runner: `node --test`

## Goal
The memory index is held to 0.5k by a hook, every live rule and every control of the failure register is classified
as a check or hook, prose that stays, or retired, with the three totals printed by a command, the record rule is
declared where rules live, and a headless lens run with a planted user hook shows the hook did not fire.

## Why
The diet found decisions in five stores and most rules held by their text alone (`docs/proposals/harness-diet.md`,
section 10, "The rule pass (S5)"; its finding 10). Today the index's budget is 4000 bytes and only makes a hygiene pass
due; 49 of 72 live rules are `owed` in the coverage register; nothing names which record wins; and the lens run's
isolation flags were never compared with gentle-ai's (the reverse-engineering document, 13.3 row 2).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-s5-rules.md` exits 0
- `node --test bin/lib/memory-index-guard.test.mjs bin/guard.test.mjs` exits 0
- `node --test bin/lib/rules-coverage.test.mjs bin/lib/rules-bindings.test.mjs bin/lib/failures.test.mjs` exits 0
- `node --test evals/lens-hook-probe.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `npm run check` exits 0
- `node evals/lens-hook-probe.mjs` run once on this machine prints the planted hook fired in the plain arm and not in
  the lens arm, quoted in `## Log`
- the pull requests are opened, named in `## Log`, with Codex and the Claude lenses recorded over their code

## In scope / Out of scope
- In: `bin/lib/memory-index-guard.mjs`, `bin/guard.mjs` and their tests; the rules `memory-index-bytes` and the new
  record rule, by `rules change` on a `rule/` branch; the line of the record rule in `bin/lib/manifest.mjs`; the
  coverage register `bin/lib/rules-coverage-data.mjs`, `bin/lib/rules-coverage.mjs`, `bin/rules.mjs` and their tests;
  `bin/lib/failures.mjs`, `bin/failures.mjs` and their tests; `bin/lib/rules-bindings.test.mjs`; a new
  `evals/lens-hook-probe.mjs` and its test; `docs/FAILURES.md` controls that are lost; `docs/ROADMAP.md` S5, SPEC,
  README.
- Out, each with its reason:
  - skill bodies at most 3k, the skill lint, the protocols-load probe and the incident rerun: moved to
    `odd/tasks/workshop-product-split.md` (spec 7, question 190), per the S5 State line.
  - `rule:questions-one-place`, `bin/check.mjs`, the contracts and the review surfaces: JH 158's (PRs 795 and 796),
    by the brief. Its control in the register is classified after those land, or through the lead.
  - any change to a rule of his (owner `sebastian`), its retirement included: only with his typed words, asked through
    the lead.
  - his `~/.claude`, `~/.codex` and credentials: the probe runs in a scratch `CLAUDE_CONFIG_DIR` against a loopback
    API.

## Constraints
- The guard runs on every Write and Edit of every session, so the index's byte check adds no import to the path of a
  file that is no memory index — because `bin/lib/memory-index-guard.mjs` says so in its header.
- A write that shrinks an index already over the budget passes — because blocking every edit until a pass would stop
  the pass itself (the line check's reason, `memoryIndexRefusal`).
- The probe spends nothing: a loopback API, a dummy key, no login token in its environment — because a probe is not an
  eval, and the incident rerun is his spend.
- A classification that would change a rule of his goes to the lead as a question — because `AGENTS.md` and the brief
  say a rule of the owner's changes only with his words.

## Ask me before
The incident-set rerun (about $13), after everything else is built, through the lead with its cost; any retirement or
change of a rule whose owner is `sebastian`.

## Depth pass
- 1. Method: the discipline is policy-as-code (OpenAI's "promote rules from docs into linters", cited in the diet's
  finding 4; Claude Code's own advice that what must always happen goes into a hook), to the standard this repo already
  set: a rule's control is named in a register a command checks, a check is proved by a planted break
  (`rules coverage --prove`), and a register only shrinks its debt. The smallest change that meets it: no new register.
  The coverage register (`bin/lib/rules-coverage-data.mjs`, S5c-a) already gives each live rule a control level, and
  the failure register (`docs/FAILURES.md`) already gives each entry a control level; the pass is a decision per `owed`
  entry, written into those registers, plus one function that maps level to the diet's three classes and prints the
  totals. The budget is the existing rule `memory-index-bytes` read by the existing guard (`memoryIndexRefusal`), which
  holds lines today and not bytes. The probe reuses the isolation probe's loopback API (`startFakeApi`,
  `evals/isolation-probe.mjs:225`) and the lens's own arguments (`claudeArgs`, `bin/lens-review.mjs:66`). Searched
  first (`rule:reuse-first`): `js-harness rules`, `rules coverage`, `failures`, codegraph over `memory-index-bytes`,
  `INDEX_BYTES`, `memoryIndexRefusal`, `claudeArgs`, `startFakeApi`.
- 2. Raw material: the register on 2026-11-08, `js-harness rules coverage`: "rules: 72 live, by the level of each
  obligation: check 17, owed 49, line 2, protocol 5" (76 declared, 4 retired: `js-harness rules`); the failure register,
  `grep -c "^- Control:" docs/FAILURES.md`: 114 controls in 140 entries (check 99, protocol 7, measured 2, line 1,
  owed 5), and `js-harness failures`: 2 entries "control lost"; `js-harness memory status --history`: the index
  783 B today, 2590 to 3920 B at every verified pass from 2026-10-15 to 2026-10-30 10:41Z, under the 4000 budget;
  `bin/lib/memory-hygiene.mjs:159` makes a pass due over the budget and `bin/lib/memory-index-guard.mjs:62` refuses
  only a long line; the diet's measure, "`MEMORY.md` ~0.7k (chars/4)" (`docs/proposals/harness-diet.md:280`) and its
  pass line "`MEMORY.md` ≤ 0.5k" (`:798`); the rule pass and the record rule as written (`:921-931`); the lens flags,
  `bin/lens-review.mjs:67` (`-p --safe-mode --tools "" ... --no-session-persistence`); `claude --help` (2.1.x):
  "`--safe-mode` Start with all customizations (CLAUDE.md, skills, installed plugins, hooks, MCP servers, ...)
  disabled"; 13.3 row 2 (`docs/proposals/gentle-ai-reverse-engineering.md:949`).
- 3. The bar:
  spec 1: `node --test bin/lib/memory-index-guard.test.mjs`: none, new behaviour; today a Write that takes the index
  past any size passes the guard, and the budget is 4000 bytes, about 1k at chars/4.
  spec 2: `node bin/js-harness.mjs rules coverage`: today 49 of 72 live rules are owed and no command prints the three
  classes; the failure register has 5 owed controls and 2 lost.
  spec 3: `node bin/js-harness.mjs rules documents-canonical`: none, new behaviour; no rule names which record wins.
  spec 4: `node --test evals/lens-hook-probe.test.mjs`: none, new behaviour; the flags were never compared.
  spec 5: left out because it is his go-ahead for specs 1 to 4, with no behaviour of its own to measure.
- 4. Refutation: two cheap tests, run before any code. (a) Would a 0.5k budget refuse the index as it is? `js-harness
  memory status --history`: 783 B today, so a 2000-byte budget (0.5k at chars/4) holds it; every pass before
  2026-10-30 15:02Z ended over 2000, so the budget would have bitten then and is not idle. (b) Does a user hook fire
  under the lens's flags? A scratch `CLAUDE_CONFIG_DIR` with `SessionStart`, `UserPromptSubmit`, `Stop` and
  `SessionEnd` hooks that each write a marker, a loopback API that answers 400, a dummy key, `claude -p` with the
  lens's `--tools "" --settings ... --no-session-persistence` (scratch script, `$CLAUDE_JOB_DIR/tmp/lensprobe.mjs`):
  plain arm 4 requests, fired `SessionEnd, SessionStart, UserPromptSubmit`; `--safe-mode` arm 4 requests, fired
  nothing. A first try with a closed port timed out at 120 s and left one `claude.exe` that wrote a `SessionEnd` into
  the next arm's folder; it was stopped (pid 11344) and the arms now write to separate folders.
  Verdict: supports
- 5. Request: lower `memory-index-bytes` to 2000 bytes (0.5k at the diet's chars/4) and make the guard refuse a Write
  or Edit that leaves a memory index over it and larger than before; close every `owed` control of a live rule in the
  coverage register as a check (a binding test and a planted break where code reads the value) or as prose that stays
  (a protocol or a line where its phrases are), retire nothing of his without his words, map the failure register's
  levels to the same three classes, and print the totals from `rules coverage` and `failures`, with a finding for any
  live rule left owed; declare the record rule as a rule of the project whose text sits in the `js-harness` skill's
  memory section; and keep the lens probe as `evals/lens-hook-probe.mjs`, two arms with a planted user hook and a
  planted user `CLAUDE.md` marker, run once here at no spend.
  Adds: none

## Specs
1. ROADMAP S5 (`docs/ROADMAP.md`, "S5 Skills, memory and rules"): "`MEMORY.md` at most 0.5k"; the brief: "the
   `MEMORY.md` budget held by a check".
2. ROADMAP S5: "the rule pass: each rule and each register control classified as a check or hook, prose that stays,
   or retired, counted from the register on the day it runs"; the diet: "It closes on a count: 65 of 65 rules and every
   control classified, the three totals reported. A rule a check now enforces loses its prose."
3. ROADMAP S5: "the record rule (committed documents are canonical; engram mirrors)"; the diet: "Engram and
   `MEMORY.md` mirror them or point to them, and never hold a decision the repo does not."
4. ROADMAP S5: "the lens flag parity probe (row 2)"; "a headless lens run with a planted user hook shows the hook did
   not fire".
5. His words, the lead's transcript `0f71b2c6`, 2026-11-08 about 17:40 local: "Listo continuemos con todo lo
   siguiente".

## Tasks
- [x] T1 (kind: docs) this document and its depth pass, committed alone — PR 1
- [x] T2 (kind: build) spec 1: the guard refuses a write that grows the index over `memory-index-bytes`, tests first —
  PR 1
- [x] T3 (kind: build) specs 1 and 3: `rules change memory-index-bytes` to 2000 and the new record rule with its line in
  the skill's memory section, on `rule/f8-s5-memory-record` — PR 1
- [x] T4 (kind: build) spec 2: every owed control of a live rule closed as a check or prose, the class totals and the
  finding in `rules coverage`, tests first — PR 2
- [x] T5 (kind: build) spec 2: the failure register's controls in the same three classes, printed by `failures`; the
  two lost controls repaired or reclassified — PR 2
- [x] T6 (kind: build) spec 4: `evals/lens-hook-probe.mjs` and its test, run once here — PR 3
- [x] T7 (kind: verify) Codex and the pertinent lenses over each slice; ready notices with each PR number
- [x] T8 (kind: docs) ROADMAP S5 State, SPEC, a summary under `docs/sessions/`; the incident rerun asked through the lead

## Log
- L1 (2026-11-08, the request as written): "Listo continuemos con todo lo siguiente" (his words, quoted by the
  brief `2026-11-09T03-56-27-719Z-f29e9dc5.md`). The brief: "Yours: the `MEMORY.md` budget (at most 0.5k), the rule
  pass (each rule and each register control classified as a check or hook, prose that stays, or retired, counted from
  the register on the day you run it), the record rule (committed documents are canonical; engram mirrors), and the
  lens flag parity probe (13.3 row 2 of the reverse-engineering document)."
- L2 (2026-11-08, the depth pass): item 4's two refutations run before any code; both support. Read of 0.5k: tokens at
  the diet's chars/4, so 2000 bytes, since the rule is in bytes and the index is ASCII but for a few accents.
- L3 (2026-11-08, T2, red then green): two tests in `bin/guard.test.mjs` written first, reading the budget from
  `rule:memory-index-bytes` so neither states its value; against the old guard both red, no deny (`Unexpected end of
  JSON input` on the empty answer). Then `memoryIndexRefusal` takes `{ maxBytes }` and refuses an index left over it
  and larger than it was; `bin/guard.mjs` reads the rule only for a memory index (a lazy import), so every other Write
  and Edit loads what it loaded. `node --test` over guard, manifest, rules-coverage and conventions: 294 of 294; the
  skill's guard line names the new refusal, and `rules coverage --refresh` settled the one owed span it edited.
- L4 (2026-11-08, T3): `5c25f156` merged `origin/main` in (S7's #794), since `rules change` runs only on a branch
  based on it. `rules change memory-index-bytes`: 4000 to 2000 bytes, subject naming the guard, source this document
  (`5cb20f46`); a rule declared after the coverage baseline names its control, so its register entry went from `owed`
  to `check` (`bin/guard.test.mjs`, the break `* 1000` on its read in `bin/guard.mjs`), and `rules coverage --prove`:
  "PROVEN memory-index-bytes", 18 of 18 breaks red in 63 s. Two tests stated 4000; `bin/memory.test.mjs` now reads the
  rule. `rules change documents-canonical`: a new rule of the project, its text one sentence in the `js-harness`
  skill's "Memory hygiene" (`bin/lib/manifest.mjs`), where the session that saves or cleans memory reads it; its
  control `protocol` with its phrase. Owner `project`, source this document: it is a line of the F8 plan he approved
  (the diet, section 10), not new words of his, and it changes no rule of his. What already checks part of it:
  `rule:memory-feedback-home` (the guard refuses a feedback note with no home in the repository) and `memory verify`
  (refuses a quotation of his in no home of the repository). `rules check`: 77 rules; `rules coverage`: 73 live,
  check 18, owed 48, line 2, protocol 6.
- L5 (2026-11-09, T7 for PR 1): Codex has no `--head`, so the guard's slice, which sits before the merge of `main`,
  was reviewed from a scratch worktree detached at `f7994df6` (removed after). Codex over `3c494c2..f7994df`: correct
  (0.92), 111,092 input tokens; lenses risk and reliability: 0 findings each. Codex over `5c25f15..4f3ba97` (the two
  rule changes): correct (0.92), 74,565 input tokens; lenses risk and readability: 0 findings each. No independent
  verifier: the slice names no high-risk item (it adds a refusal, loud when wrong, and weakens no guard).
- L6 (2026-11-09, T6, red then green): `evals/lens-hook-probe.test.mjs` written first, red (`ERR_MODULE_NOT_FOUND`);
  then `evals/lens-hook-probe.mjs`: the lens arm runs `claudeArgs` as `bin/lens-review.mjs` builds them, the plain arm
  the same without `--safe-mode` alone; each in a scratch `CLAUDE_CONFIG_DIR` with a user hook on `SessionStart`,
  `UserPromptSubmit`, `Stop` and `SessionEnd` and a user `CLAUDE.md` holding a nonce; the API a loopback server in a
  child process (the CLI is started synchronously, as `claudeRunner` starts it for a lens) that logs each request and
  answers 400; a dummy key and `lensEnv`, so no login token. 5 of 5. The real run, `node evals/lens-hook-probe.mjs`,
  exit 0: "plain exit 1 7 requests fired: SessionEnd, SessionStart, UserPromptSubmit user CLAUDE.md sent: yes";
  "lens exit 1 7 requests fired: none user CLAUDE.md sent: no"; "PASS a planted user hook fires without --safe-mode
  and not under the lens's flags". So `--safe-mode` drops the user's hooks and `CLAUDE.md` as gentle-ai's
  `--setting-sources ""` aims to; `Stop` fires in neither arm, since a 400 ends the run before a reply. Spend: none.
- L7 (2026-11-09, T7 for the probe slice `777a123..eb39a85`): lenses reliability and risk 0 findings each. Codex:
  incorrect (0.94), three to take, tests first: P1 `probeEnv` keeps Bedrock, Vertex or Foundry switches and their
  credentials from the parent (`CLAUDE_CODE_USE_BEDROCK`, `_VERTEX`, `_FOUNDRY`, `AWS_*`, `ANTHROPIC_VERTEX_*`...), which
  need not honour `ANTHROPIC_BASE_URL`: drop them; P2 count only `/v1/messages` requests as the lens reaching the
  model (keep each request's path); P2 a marker path with an apostrophe breaks the planted hook's JavaScript: encode it
  with `JSON.stringify`.

- L8 (2026-11-09, L7's three fixed, tests first): red 3 of 8, then 8 of 8. `probeEnv` drops every `ANTHROPIC_*`,
  `CLAUDE_CODE_USE_*`, `AWS_*`, `CLOUD_ML_*`, `GOOGLE_*` and `VERTEX_*` name before it sets its own three; an arm counts
  only `/v1/messages` requests; the planted hook is a script beside the marks run by its quoted path, proved from a
  folder named `O'Connor`. The real run again: plain fired `SessionEnd, SessionStart, UserPromptSubmit`, sent the
  `CLAUDE.md`; lens fired none, sent none; 6 Messages requests each; PASS. Next: review `eb39a858..HEAD`.
- L9 (2026-11-09, the review of L8's fix): Codex over `949622f..c32a3fd`, a recheck: correct (0.96), 3 of 3 fixed;
  lenses reliability and risk over `eb39a85..c32a3fd`: 0 findings each.
- L10 (2026-11-09): PR 798 opened for the probe, base `rule/f8-s5-memory-record`; the host compacted the
  session after it, and it resumed from this document.
- L11 (2026-11-09, T4, PR 3 `f8-s5-3-rule-pass`): 48 live rules owed their control. 31 value rules got a check
  with a planted break in their reader (`+ 1`, `+ 'x'`, a guard's project text set to `null`, an id swapped), 15 prose
  rules their declaration's first phrase as a protocol (a line for `bin/lib/project.mjs`). `rules coverage --prove`:
  48 of 49 red at once; `control-phrase-min` stayed green against `bin/lib/rules-coverage.test.mjs` and went red
  against `bin/lib/failures.test.mjs`, which holds its boundary. `claude-md-budget` got a binding test, since only
  the five-minute `bin/check.test.mjs` read it. `work-sessions-public` and `work-sessions-private-wsl` have no reader
  (`git grep` in bin, workshop and the skills): question 235 to the lead, A retire, B prose in the orchestrator skill
  (recommended), C a check. Tests first: the classes red (`actual: undefined`), then green; `rules coverage`:
  "classes: check 49, prose 23, retired 4, owed 2". The register reached 1168 lines, over the module limit, so
  `writeCoverage` writes every control on one line (683 lines). The `--strict` hold of an owed rule waits on question
  235, since the two would turn the real package's `--strict` test red. Commit `37d7ff61`.
- L12 (2026-11-09, T5): `failures` prints "By control": check 99, prose 8, measured 2, owed 5, 26 with none (tests
  first, red then green). The two "control lost" entries kept their control under another name:
  `failure-cause-dropped` (the test moved to `bin/lib/land-records.test.mjs`, `81088583`) and
  `uninstall-took-user-entry` (the Codex test renamed by `57486c74`; the Claude test of the same fix holds it); each
  now names the current one and keeps a `Was` line. `failures check`: 9 not settled, from 11. Commit `2717f7ca`.
- L13 (2026-11-09, T7 for `a2d55b1..2717f7c`): lenses risk 0, reliability 2 warnings: the two rules left owed (known,
  question 235) and `report.unclassified` printed nowhere while a comment said `--strict` held it. Fixed tests first
  (red, then green): the plain report prints each owed obligation as a note, and the comment says what the code does.
  Codex wrote no record: this document was edited while it reviewed part 1 of 2 (278,727 input tokens spent), the
  13th sighting of `edit-during-review`, whose `Seen` line this commit adds. The review runs again after the commit,
  with nothing edited until it ends. What would stop it: a guard that refuses an edit of a tracked file in a worktree
  while that worktree's Codex review runs; proposed to the lead, not built here (the guard is not this session's).
- L14 (2026-11-09): Codex over `a2d55b1..766a4f1`: correct (0.89 and 0.94), 228,202 input tokens; lenses on the fix
  `2717f7c..766a4f1`: risk 0, reliability 1 open (the two rules of question 235). PR 799 opened, base
  `f8-s5-2-lens-probe`. T8 begun: ROADMAP S5 State and SPEC (the lens review's flag parity and the failure register's
  control classes into Capabilities; what is left of the rule pass in the table of what has no code yet).
- L15 (2026-11-10, T4 closed): PRs 797, 798 and 799 merged by the lead (`6ee974d`); the machine restarted and
  `sessions start --resume` brought this session back (brief `2026-11-10T04-01-32-011Z-49cf3240.md`). Question 235,
  read with `js-harness sessions --quote ea85ec35-82e1-4aa9-abe3-98bd153a50b0 1029`: "B: prosa en la skill del
  orquestador (Recomendada)", tapped 2026-11-10T03:59:47Z. A tap changes no rule, and B changes none: one line in the
  orchestrator skill, where it opens sessions (`bin/lib/manifest.mjs`), names both as `rule:<id>` without their
  values, and their controls are protocol. Tests first: `--strict` with an owed control planted on
  `announce-finished` exited 0 (red), then 1 naming it. `rules coverage --strict`: "classes: check 49, prose 25,
  retired 4", PASS. Branch `f8-s5-4-strict` from `origin/main`, commit `69564afd`. The lead's note of 22:35 adds a
  `Seen` line to `stretch-not-opened`.

- L16 (2026-11-10, question 243 and the one run): the grader read what the agent printed, its last text, so a
  Stop-hook bounce left it only the close. Searched first: `readClaudeOutput` (`evals/agent-output.mjs:103`),
  `keptReply` (`evals/trial-transcripts.mjs:76`), `lastReply` and `SUBAGENT_TRANSCRIPTS` (`evals/configs.mjs`),
  `runner.mjs:703`. Fixed on `f8-s5-eval-reply`, tests first (red, then green): `turnReply` gives every main-thread
  text after the turn's prompt, and the runner reads it before the printed answer. Codex over `6ee974d..5d6234b`:
  incorrect, 2 P2 (a compaction summary taken as a prompt; session files read in name order), both fixed in
  `1c0c0c2`; the recheck `5d6234b..1c0c0c2`: correct (0.96), 2 of 2 fixed. Lenses reliability and resilience over
  both ranges: 0. CI failed once on an import of `bin/lib/sessions.mjs` (`bin/pre-push-hook.test.mjs` copies the
  trial code without `bin/`), so the prompt check is restated in `evals/`. PR 803, `ready` sent at 00:08. The run:
  plan 20 trials, about 18 minutes, about $5.01; a wrapper stopped it past $20. A first launch was refused before any
  trial ($0: the default work root sits under the repository's `CLAUDE.md`); with `--work-root
  D:/js-harness-evals-work`, as S4b ran, `f8-s5-incidents` ran once on `f41f4fb2` (tree `5bfc3e3d`: origin/main
  `6ee974d`, PR 802's head `c38aaa9`, PR 803's head `1c0c0c2`, merged in a scratch branch not pushed), $4.84 list.
  `node evals/incident-score.mjs f8-s0-a-incidents f8-s0-b-incidents f8-s5-incidents`: 15 of 20, false premise 3 of 4,
  at L 13 and above the worse line of 10. incident-04 2 of 2; incident-05 1 of 2, its first pass in any run (whether
  the pass rests on text written before the bounce is not checked); incident-01 and 02 0 of 2, as in S4b. Every one of
  the 20 transcripts holds exactly one Stop-hook feedback line (`isMeta` user lines that start "Stop hook feedback",
  counted by a script over `evals/runs/f8-s5-incidents/`), so every trial was graded on the texts of both sides of a
  bounce.

## Next step
Nothing left in this session: PRs 802 and 803 wait for his yes, and merging is the lead's. The incident line holds
for S4b and S5 (L16). The `closed` notice names the summary.
