# Project rules

Locator: `odd/tasks/project-rules.md` · Engram mirror: `odd/project-rules/tasks` · Branch:
`feat/project-rules`, cut from `main` at `b6bca66`. Session: `JH 11 · reglas del proyecto y prueba
final`; orchestrator: `JH ORQ · js-harness`. Delivery: `ask-on-risk`. Test runner: `node --test`.

## Goal
A project that only installs the harness can declare rules of its own, which the harness lists,
checks on every commit, and which `uninstall` leaves exactly as the project wrote them.

## Why
Today the only list of rules is the one the harness ships (`bin/lib/rules-data.mjs`); an installed
project has no place to declare one, and nothing reads a project's list (the explorer's map of
2026-10-13, `bin/rules.mjs:22,112-134` read only under the package root; `docs/` is not shipped,
`package.json:9-13`). Whether an installed project gets one at all was left open as the ninth
difference of the rule hierarchy (`odd/tasks/rule-hierarchy.md:624-628`), a product choice of his.
His words point to it: the projects where the harness is installed will each have "su propio
roadmap y arquitectura y ademas de specs" (S1), and he wants `AGENTS.md` to be "el orquestador de
las reglas principales" (S2). Without a list, a project's rule lives only in prose that nothing
checks, which is the failure the rule hierarchy exists to end here.

## Done when
- `npm run check` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/project-rules.md` exits 0
- `node --test bin/lib/project-rules.test.mjs` exits 0
- `node --test bin/rules.test.mjs` exits 0
- The practice journey, with this feature's step in it, passes on the machine that builds it
  (`node scripts/practice.mjs run`, inside `js-harness gate -- ...`)

## In scope / Out of scope
- In: a project's own list (`docs/rules.json`), its reader and validator, `js-harness rules` and
  `rules check` at the project, the `rules` row of `js-harness check` in a project, a line of
  `status`, the skill sentence and the template clause, help text and docs, a step of the
  practice journey.
- Out: overrides of the harness's own rules (a feature of their own, if he wants them); values in
  a project's list; the marked block of the template that `sync` renders (rule hierarchy, T16f, JH 7's); the
  rows that find a value stated in prose (rule hierarchy, T16d); the one command that changes a
  rule (T16c); a turn-start hook. Each is another feature's, and this one works without them.

## Constraints
- Nothing is loaded into a turn that is not already loaded — because every line in a turn is paid
  on every turn (`AGENTS.md`, "the design bet").
- The harness writes nothing of the project's list — because what it does not write it never has
  to undo (`AGENTS.md`, "recorded so it can be undone exactly").
- One validator for both lists — because two would drift.

## Effort
high

## Ask me before
The question under "Questions that are his" below; spend outside the plan; anything installed
or changed on his machine.

## Specs
- S1. His words, 2026-10-09 (`1cca9aae-c791-46e2-8b21-4f51f4019602.jsonl`, line 728, read with
  `js-harness sessions --quote`): "recuerda que la idea es que en otros proyectos donde instalemos
  el harness esto no se puede hacer ya que es fijo y ya tendremos un metodo que desarrollaremos
  apra cada proyectos con su propio roadmap y arquitectura y ademas de specs".
- S2. His words, 2026-10-08 (`593da809-8949-48b0-a2ea-48b490f58f0e.jsonl`, line 818, read the same
  way): "me gustaria que hubiera una forma de poder jerarquizar esto bien y que agents sea como el
  orquestador de las reglas principales y mas importantes y creo que el resto de la informacion
  del harness debe ir en otra parte importante".
- S3. His answer to what enters 1.0.0, 2026-10-13 (the lead's transcript
  `65318fd5-80e7-4bb8-92b5-06737140185b`, line 10519, tapped): "Todo lo que pedí, sin fecha".
- S4. Who takes it, 2026-10-14T03:28Z (same transcript, line 13854, tapped): "Una sexta sesión
  (Recomendada)", to the question "¿Quién toma la prueba final y el diseño de las reglas propias de
  un proyecto instalado?".
- S5. The design below, once its readers and his answers to the questions that are his have
  passed. Not his words: a design, with its path.
- S7. His answer to the question of the design, 2026-10-14T03:49Z (the lead's transcript, line
  15809, tapped, read with `sessions --quote`), to "Un proyecto donde se instala el harness,
  ¿puede tener una lista de reglas propias que el harness controle?": "Sí, en prosa y por sensor
  (Recomendada)". So version 2 is built as written, with no overrides.
- S6. How the material for `docs/SPEC.md` is gathered, 2026-10-14T03:37Z (the lead's transcript,
  line 14050, tapped, read with `sessions --quote`), to "¿Cómo dejan las sesiones la recopilación
  para el que documente al final?": "Que me lo manden a mí". The lead's reading (its message,
  a claim): at each feature's close, one note per capability built, in the SPEC's five parts, in
  English, about 400 words at most, his words only with their line; the lead appends it.

## Design (version 2, after its two readers)

Draft 1 was read on 2026-10-13 by two sub-agents that did not write it (opus, effort high): reader
A attacked it against the code, reader B looked only for what it lacks. What each changed is under
"What the readers changed" at the end of this section. Not built.

**What a project can declare.** A rule of the same shape as a shipped one, validated by the same
`readRules` (`bin/lib/rules.mjs:236-282`) through a new option, `{ keys, owner }`, whose default
leaves the shipped list's checks exactly as they are (a test holds the shipped list to the same
result). Three bodies:
- a rule in prose: `id`, `subject`, `since`, `path` (a file of the project, `AGENTS.md` first) and
  `phrases`, by which the rule is found in its file (at least `control-phrase-min` characters
  each). The rule itself is the prose; the list gives it an id and holds that it is still there.
- a rule a sensor enforces: `id`, `subject`, `since`, `sensor` (the name of a sensor `check` runs,
  from `harness.json` `sensors` or the project's `package.json` scripts, as `discoverSensors`
  finds them). This is the home of a rule about the code ("never import X", "no secret in Y"):
  the project writes the check as a sensor in any language, and the list holds that the sensor
  is still declared. The harness gets no pattern engine.
- a retired rule: `id`, `subject`, `since`, `retired`, `successors`.
Optional on any of them: `failure`, the id of an entry of the project's `docs/FAILURES.md`, so the
control of a failure can be a project rule; resolved against the register when it exists.
`owner` is left out and read as `project`; `owner: "sebastian"` is refused in a project's list.
Refused, each with its reason in the message: `scope` (the list is the project's by where it
is), `alias` (a host passes an alias, and only the harness speaks to a host), `flag` (only a
command of the harness parses one), `value` and `unit` (below), `patterns` and `row` (the rows of
the shipped list, rule hierarchy T16d).

**Why no values.** A value in the list needs a reader. A project's own scripts cannot import the
harness, and a script that calls a global `js-harness rules <id>` stops working the day the
harness is uninstalled, which is the coupling `uninstall` exists to avoid. A value the project's
code needs lives in the project's own config; a number a person must respect is a rule in prose
and gets its id that way.

**Why no overrides of the harness's rules, in this feature.** Every rule that takes a flag is read
once, when its module loads (`bin/lib/gate-lock.mjs:66`, `bin/lib/sessions.mjs:43`,
`bin/lib/codex-review-parts.mjs:22`, `bin/lib/codex-review-plan.mjs:48`), and each has uses the
draft did not name: the Codex debt row (`bin/check.mjs:1280`), `parseGateWait` before `--cwd` is
parsed (`bin/check.mjs:1329,1356`), the estimator's band (`bin/lib/codex-review-plan.mjs:108,155`),
the board and the help texts (`bin/lib/sessions.mjs:53,460`), the skill text installed for the
whole machine (`bin/lib/manifest.mjs:27`). Wiring some of them and not the rest brings back the
stale 73 percent: one place pauses at the project's value while another shows the harness's. Two
of the four are spend guards (`review-parts-unflagged`, `review-part-lines` change how many parts
a Codex review runs), and spend is his; `context-pause` is his and its hook runs after every tool
call, where a read of the project would be paid on each. If he wants overrides, they are a
setting of the project and live where its other settings live, `harness.json`, beside the
switches of the functions on demand (JH 9, `odd/tasks/on-demand-functions.md`), read through one
named function the rules scan recognises, and accepted for a rule only when every use of it is
wired: a feature of their own, after this one.

**Where it lives.** `docs/rules.json` at the git top of the project, beside `harness.json` and the
other register a project keeps, `docs/FAILURES.md`, which the gate also reads only when it exists
(`odd/tasks/rule-hierarchy.md:433-436`). Its text is an object with a format number,
`{ "format": 1, "rules": [ ... ] }`, the rules sorted by id, so that a later format is refused by
name ("format 2 is newer than this js-harness reads: run `js-harness sync`") instead of misread. A
UTF-8 byte-order mark is skipped and CRLF is accepted. Not `harness.json`: that file is the pin
and the settings, written by `init` (in the clone that ran `init` it is removed by `uninstall`
only while unchanged, and a fresh clone records it as kept, `bin/lib/project.mjs:730-747`); the
project's rules are text the project writes, like its `AGENTS.md`. No rendered Markdown copy:
`js-harness rules` prints the list on demand, so there is no second file to keep equal. A project
with no `docs/` folder simply has no list.

**How it reaches an agent.** Nothing is added to a turn. A rule in prose lives in its home, a line
of `AGENTS.md`, which Claude Code and Codex both load every turn; a rule whose home is another file
is loaded by neither, and the list says so in its listing ("not loaded by a host: `AGENTS.md`
should name it"). A rule a sensor enforces needs no reading: the gate runs it. So an agent learns
the list exists in three places that are paid only when read: one sentence in the js-harness skill
(`bin/lib/manifest.mjs:13-37`, one text for both hosts), one clause under `## Constraints` of the
`AGENTS.md` template (`bin/lib/project.mjs:337-354`: a constraint the project wants held gets an id
in `docs/rules.json`), and the dispatcher's help line for `rules`, which today says "the declared
rules of the harness" (`bin/js-harness.mjs:22`).

**How it is checked.**
- `js-harness rules check` checks the project at the git top of the working directory (or of
  `--cwd`), not the package root. When that project is the harness's own repository (it holds its
  own `bin/lib/rules-data.mjs`, as `rules applied` and `ruleHere` already decide,
  `bin/rules.mjs:245`) it checks the shipped list as today, and a `docs/rules.json` there is a
  finding: the shipped list is this repository's one home (rule hierarchy, letter B). Anywhere
  else it checks `docs/rules.json`: `readRules` faults; each prose rule's phrases still in its
  file; each sensor rule's sensor still declared; each `failure` resolving; and an id present in
  the list of `HEAD` and missing now (`git show HEAD:docs/rules.json`), which is refused with
  "retire it: `retired` and `successors`", so that a rule never disappears in silence, not even
  when its line of `AGENTS.md` and its entry are deleted in the same commit.
- The static row `rules` of `js-harness check`, first among the static rows, runs the same check
  and acts only when `docs/rules.json` exists. One row with two modes: in the harness's
  repository it is the row the rule hierarchy designs for the shipped list (letter D, T16d, which
  extends it with its patterns); in a project it is this check. A list that cannot be read fails
  the row and nothing else: no reader of a value depends on it, so it never takes the gate down
  before its rows print. It is refused by `js-harness check`, so by a pre-commit hook only where
  that hook runs `check` (`init` writes one only when none exists, `bin/lib/project.mjs:662`).
- `js-harness status` in a project gains one quiet line: how many rules of its own, and how many
  findings.

**How it meets the rules the harness ships.** The two lists never meet by id. `js-harness rules`
at a project prints the rules of the harness in force there (`scope` `repository` left out, as
today) and then the project's, under a heading of their own; `rules <id>` prints whichever holds
the id, both when both do. A project id equal to a shipped one is a note in `rules check`, never a
refusal, so that a later release of the harness that ships a new id never turns a project's
commit red. A project's rule says nothing about a rule of the harness; when they disagree in
meaning, the listing puts them side by side and a person decides.

**Letters F and G of the rule hierarchy.** Letter G (`AGENTS.md` changes only by a draft he
approves by its hash) is this repository's: a project's `AGENTS.md` is its own, and its rules
change by its own commits, whose log records who changed them. Letter F's marked block, when
T16f builds it, is rewritten by `sync`; so a phrase of a project rule found only inside that block
will be a finding, built with the block (T16f) and named here so it is not missed. No id or
marker of the list goes into `AGENTS.md`: the phrases find the rule where it is.

**How uninstall undoes it.** There is nothing to undo: no command of the harness writes
`docs/rules.json`, so it is in no manifest, and `uninstall` leaves it as it leaves the project's
`AGENTS.md` and `docs/FAILURES.md`, without naming it (the uninstall design reports no kept file,
`bin/lib/project.mjs:1256-1257`). The skill sentence and the template clause are text the harness
already owns and undoes.

**The practice journey's step (T7).** In the practice project: write `docs/rules.json` with one
prose rule on a phrase of its `AGENTS.md` and one rule a sensor enforces; `js-harness rules` lists
both under the project's heading; `rules check` exits 0; a commit that deletes the phrase is
refused by the `rules` row, and so is one that deletes the entry; the tree is restored; after
`uninstall` the file's hash is the one before it; a second run gives the same result.

**Questions that are his.** One, the ninth difference of the rule hierarchy: does an installed
project get a list of its own rules?
- Yes, in prose and by sensor, as above (recommended): no turn pays for it, nothing is written by
  the harness, and his words S1 ask that each project keep its own specs while the harness stays
  fixed there.
- Yes, and also with values that change the harness's own (an override), built as its own
  feature after this one, beside JH 9's switches: costs the per-project reading of every use of
  each rule changed, and the spend guards stay his.
- No: a project's rules stay prose in its `AGENTS.md`, checked by nothing.
The reading of S1 that goes with it, from the message he answered (the same transcript, line 725,
an assistant message, not his words): "esto" is the way of working on the harness itself, many
sessions polishing it as needs appear; in an installed project the harness is fixed and the
project has its own roadmap, architecture and specs. So S1 supports a project's own list and
does not ask for a project to change the harness.

**What the readers changed.**
- Reader A (the attack): the overrides came out (finding 1: no named reader knows its project, and
  the list of uses was incomplete; finding 2: two of them guard spend; finding 3: `context-pause`
  is his and a per-tool-call hook); how `rules check` tells the harness's repository from a
  project, and a `docs/rules.json` in the harness's repository as a finding (4); ids that never
  meet, so a release cannot turn a project red (5); `readRules` through an option with an
  unchanged default, and `owner: "sebastian"` refused (6); a byte-order mark, and an unreadable
  list failing only its row (7); one `rules` row with two modes, extended by T16d (8); "refused by
  `js-harness check`", not by every pre-commit (9); the git top, for a monorepo (10); `uninstall`
  names nothing (11); the sentence on `harness.json` corrected (12); the marked block (13).
- Reader B (what was missing): the overrides, if he wants them, beside JH 9's switches in
  `harness.json` and not in a third place (gap 1); how an agent learns the list exists (2); a rule
  that disappears in silence (3); a later shipped id (4); letters F and G (5); `failure` kept (6);
  the sensor body, for rules about the code (7); values left out, with their reason (8); which host
  each rule reaches (9); the line in `status` (10, without the `doctor --hook` line, which would
  add text to a session start for a finding the gate already refuses); the format number (11);
  the journey's step (12); the reading of S1 (13).
- Not taken: reader B's `js-harness rules <id> --value` (see "Why no values"); `rule:<id>` marks
  in a project's texts resolving against its list, which waits for a reader that needs them.
- Still not guaranteed: a machine whose global `js-harness` is older than this feature ignores
  `docs/rules.json` without a word, since that copy does not know the file exists; the format
  number protects only later formats.

**Files of other sessions this touches**, to agree through the lead before each is edited:
`bin/lib/rules.mjs`, `bin/rules.mjs` (JH 7's rules machinery); `bin/check.mjs` (the row; JH 8 and
JH 9); `bin/lib/project.mjs` (the template clause; JH 9 and JH 7's T9); `bin/lib/manifest.mjs`
(the skill sentence; JH 8); `bin/status.mjs` or wherever `status` prints (JH 8).

## Tasks
- [x] T1 The design: draft, his earlier words searched, two readers, the version after them sent
  to the lead with his questions (S1-S5; route: inline, readers delegated)
- [ ] T2 `readRules` with `{ keys, owner }` (default unchanged, proved on the shipped list) and the
  reader of `docs/rules.json`: format, byte-order mark, the three bodies, `failure` (S5; route:
  inline; `bin/lib/rules.mjs` is JH 7's, agreed through the lead first)
- [ ] T3 `js-harness rules` and `rules check` at the git top: the harness's repository or a
  project, the phrases, the sensors, a rule gone since `HEAD`, ids that meet as a note (S5;
  route: inline)
- [ ] T4 The `rules` row of `js-harness check`, one row with two modes, and the line of `status`
  (S5; route: inline; `bin/check.mjs` is shared with JH 8 and JH 9, agreed through the lead first)
- [ ] T5 How it reaches an agent: the skill sentence, the template clause, the help line; README
  and roadmap (S5; route: inline; files of JH 8, JH 9 and JH 7, agreed through the lead first)
- [ ] T6 The practice journey's step for a project's own rule (S5; route: inline)
- [ ] T7 At the close: one note per capability built, in the five parts of the SPEC
  (`docs/ROADMAP.md` 605-633), sent to the lead, who appends it (S6; route: inline)

## Log
- L1. 2026-10-13, the opening the lead wrote for this session (a claim, not his words; read with
  `js-harness sessions --opening "JH 11 · reglas del proyecto y prueba final"`): "THE DESIGN OF AN
  INSTALLED PROJECT'S OWN RULES. ... a design that says what an installed project can declare as
  its own rules, where they live, how the harness loads and checks them, how they meet the rules
  the harness ships, and how uninstall undoes them; a search of his earlier words on the matter;
  two independent readers who attack it ...; the version after them, saying what each changed,
  sent to the orchestrator with the questions that are his. Then build it task by task."
- L2. 2026-10-13, the search of his words: his typed messages in every transcript of this project
  were read for "regla" and for installed or other projects
  (`scratchpad/words.mjs`, a reader of user lines that are not tool results, pastes or
  cross-session messages). Two touch this matter, S1 and S2; none says where a project's rules
  live or whether a project may change a rule of the harness. A paraphrase in other words would
  have been missed.
- L3. 2026-10-13, the explorer's map (read-only, opus, high): no project-local rules file is read
  anywhere; only a project's `bin/lib/rules-data.mjs` is, by `rules applied` and the Codex
  allowance, and only as "equal to the shipped list or not"; the marked block of the template is
  not built; no turn-start hook is installed; `uninstall` keeps a changed recorded file.
- L4. 2026-10-13, draft 1 read by two readers (opus, effort high), A attacking it against the
  code, B looking for what it lacks; version 2 replaces it and says under "What the readers
  changed" what each changed. The biggest change: no overrides of the harness's rules in this
  feature (A: no reader knows its project, and two of them guard spend; B: they would make a
  third place for a project's settings beside JH 9's switches). The question that is his is now
  one.
- L5. 2026-10-14, his answers through the lead, each read with `sessions --quote` in the lead's
  transcript `65318fd5-80e7-4bb8-92b5-06737140185b`: line 15809 (S7); line 15828, the practice
  run with a real host session may run tonight within the plan (quoted in
  `odd/tasks/practice-project.md`, T5); line 15778, he is away about ten hours; line 15820, "Decidí
  vos lo reversible (Recomendada)", so the lead decides reversible questions meanwhile. T1 is done;
  T2 starts after the lead clears each file of another session.
- L6. 2026-10-14, T2 to T6 written in the worktree, tests first and each seen failing before its
  change: `readRules(list, { project: true })` and the `sensor` body (`bin/lib/rules.mjs`);
  `bin/lib/project-rules.mjs` and `bin/lib/project-rules-read.mjs`, 32 tests; `rules`, `rules <id>`
  and `rules check` at a project (`bin/rules.mjs`, `bin/rules-project.test.mjs`, 9 tests); the
  `rules` row of `check` (3 tests) and the line of `status` (1 test); the skill bullet and the
  template's clause (2 tests); the journey's step `project-rules` (3 tests of its pure part). The
  rules tests of the harness's own list still pass (198), and `rules check` here still prints
  `PASS rules 18 rules`. Not committed: the files of other sessions wait for the lead to clear them
  (its message of 2026-10-14 asks to be told each file before it is edited).

## Resume here (2026-10-14, context 76%)
- Worktree `D:\js-harness-worktrees\project-rules`, branch `feat/project-rules`, pushed at `2f49487`.
  Uncommitted and green: everything under L6, plus the host step's pure part in
  `scripts/practice-lib.mjs` (`HOST_STEP`, `hostEnv`, `redacted`, `parseArgs` `--no-host` and
  `--only`, `recordLine` `left` and `host`, `practiceLayout().hostHome`, the journey id
  `host-loads`; 94 tests pass in `scripts/practice-lib.test.mjs`).
- Waiting on the lead: a clear for the files of other sessions (the list in its message of
  2026-10-14 from this session, items 1 to 5), then one commit per task (T2, T3, T4, T5, T6).
- The host probe (try 1 of the three he allowed): `scratchpad/probe.mjs` run as `js-harness gate --
  node probe.mjs probe-out` in background task `bl6ztlhr6`, queued for the lock at 23:15. It writes
  `probe-out/call1..3.jsonl` (the stream of three Haiku 5.5 calls in the practice project, token
  redacted). Next: read their field names (init skills and tools, hook events, result usage and
  cost), check that the real `~/.claude/projects` has no practice folder, then write the parser of
  the stream with those files as its fixture (copied into `scripts/fixtures/`), and the step
  `host-loads` in `scripts/practice.mjs` (design: `odd/tasks/practice-project.md`, "T5: the step
  host-loads"). The step is not in `STEPS` yet, so the journey fails at it today: write it before
  any journey run.
- Then: the full journey inside `js-harness gate --` (tries 2 and 3), the README and roadmap
  lines (T5 docs), the SPEC notes to the lead (T7).
- Probe done (2026-10-14, try 1 of 3, Haiku 5.5, 0.0069 dollars over three calls, Claude Code
  2.1.296). The stream as it is, for the reader of `host-loads`: `system/init` has `skills` (both
  of ours listed), `tools` (`[]` with `--tools ""`), `model`, `claude_code_version`, `cwd`;
  `system/hook_response` has `hook_name` (`SessionStart:startup`, `SessionStart:resume`,
  `SessionStart:compact`, `PostToolUse:Skill`), `exit_code`, `outcome` (`success`), `stdout`,
  and NO command: the seeded hook prints `unrelated-claude-hook`, ours is told by its output
  (`doctor --hook` printed a `{"systemMessage":"js-harness: ...` line only because its gaps
  changed, so its proof is `home/.js-harness/doctor.json` rewritten; `resume --hook` on compact
  prints `js-harness resume: this session was just compacted...`; `PostToolUse:Skill` is ours
  alone). `result/success` has `is_error`, `num_turns` (1 with no tools; the call-1 answer was
  `# project`, so AGENTS.md loaded), `result`, `total_cost_usd`, `duration_ms`, `usage`
  (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`),
  `modelUsage` keyed by model. `/compact` gives a result with `num_turns` 0. New under
  `home/.claude` after the calls: `.claude.json`, `.last-cleanup`, `backups`, `policy-limits.json`
  and its stamp, `projects`, `remote-settings.json`, `session-env`, `sessions`; the real
  `~/.claude/projects` and `~/.claude.json` named no practice folder. Streams kept in the
  scratchpad `probe-out/`; to commit, trim them to those fields (no personal data was found in
  them; the init's `messaging_socket_path` is the child's own pipe).
- Update, context 85%: committed `9164790` (T2+T3) and `9302730` (T4+T5), each through a green gate.
  T6 written (both journey steps, `host-loads` with its stream reader held to
  `scripts/fixtures/host-call*.jsonl`, `--no-host`, `--only`, the record's `host` and `left`;
  101 tests in `scripts/practice-lib.test.mjs` and `scripts/practice-host.test.mjs`) and sent as
  background task `blw3n9s3v`: its commit through the gate, then `js-harness gate -- node
  scripts/practice.mjs run --root D:\js-harness-practice` (try 2 of 3). Next: read that output.
  If the journey failed on a fault of the step, fix it test first and use try 3; if it passed,
  mark T2 to T6 done here and T5 in `odd/tasks/practice-project.md`, then the README and roadmap
  lines (the lead cleared them), merge `origin/main` once (`c99abbc` or later), the Codex review
  of the code commits (`js-harness codex-review --plan` first, within 1.05 times the allowance),
  push, the pull request, and the SPEC notes to the lead (T7).
- Run 2 (`ed24609`, 2026-10-14): 9 of 13 steps passed; `project-uninstall` failed because the
  practice project had committed the AGENTS.md template of an earlier candidate and the second
  `init` wrote this candidate's (with the new clause). The host step was skipped, so no model was
  spent and the host allowance still has two runs. Fixed test first in `secondInitProblem`
  (`scripts/practice-lib.mjs`); the practice AGENTS.md was left as the last `init` wrote it (its
  hash matches the project manifest). Run 3 is background task `bk86xf7of`.
- PAUSED 2026-10-14 01:10 by his order (the lead's transcript `ffe99ebf`, line 1647, read with
  `sessions --quote`: "si pero la idea es pausar todo precisamente para hacer unicamente esta
  mejora implementarla y ahi si seguir con lo siguiente"; only the faster check goes on, JH 8 and
  JH 10). The queued turn (the fix's commit, then run 3) was cancelled before it took the lock.
  Uncommitted in the worktree and green (95 tests in `scripts/practice-lib.test.mjs`): the fix
  `secondInitProblem` in `scripts/practice-lib.mjs`, its test, and its use in
  `scripts/practice.mjs` (`project-uninstall`), plus `import { agentsTemplate }` there. The
  practice project's AGENTS.md is as the last `init` wrote it (hash equal to the project
  manifest), uncommitted there; the next run's `commit-passes` commits it. On resume: commit the
  fix through the gate, then `js-harness gate -- node scripts/practice.mjs run --root
  D:\js-harness-practice` (the host allowance still has two runs: run 2 never reached the host).
