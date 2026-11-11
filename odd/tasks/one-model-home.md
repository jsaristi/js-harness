# one-model-home

One declared model and one declared effort for everything Claude the harness starts, a second pair beside it for
Codex, and one command that switches either. Session JH 172, opened by the brief
`~/.js-harness/background/briefs/2026-11-11T04-55-04-184Z-d0d109fd.md`. Delivery: four chained pull requests, each
through the gate, Codex and the lenses. Runner: `node --test`.

## Goal
The model and the effort everything runs on are declared once for Claude and once for Codex, every launcher, guard,
check and text in force reads them from there, and the day a better model comes out the switch is one command and one
commit.

## Why
On 2026-11-10 he changed the model and the effort twice in one day. Each change was carried by hand through seven
rules, three constants, one agent file, two readers that assumed a short name, two README lines and the tests that
wrote a value by hand (`docs/sessions/2026-11-10-jh-171-rule-every-model-on-fable-5-2-at-high.md`, "Left"). The lead's
session showed extra high in the app's menu for hours after he said high, and he had to say it three times (S1, S2,
S5). A value restated in many places goes stale in some of them: the failure section 4 of `js-harness-protocols`
exists for, met again one level up. He also said the reviewer's model will change soon (S4), so the same way has to
carry Codex.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/one-model-home.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/lib/model-home.test.mjs` exits 0
- `node --test bin/conventions-model-home.test.mjs` exits 0
- `node --test bin/lib/rules-switch.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs bin/sessions-background.test.mjs` exits 0
- Each pull request of the chain is ready and the lead holds its `ready` notice; the last one's body says, in plain
  words, what he types the day a new model comes out.

## In scope / Out of scope
- In: the rules of the two homes and the five rules that leave (`js-harness rules change`, his words as their source);
  every reader of a Claude or Codex model or effort in code that ships or runs here (`bin/`, `workshop/`, `.claude/agents/`);
  `sessions start` and its `--resume`; the board's level mark; `doctor`; `rules applied`; the switch command; its
  protocol in the orchestrator skill; every text in force that states a model or an effort.
- Out: the model or the effort of any open session, which the lead sets with the app's session tools, and its own,
  which only he picks in the app's menu.
- Out: anything under `~/.claude` (his), the app's records (read, never written) and the host's job records.
- Out: switching Codex's model now. The next model is not out and its id as the `codex` CLI takes it is not known; no
  id is guessed and the web is not asked (S4).
- Out: the records of the past, which stay as they are: `evals/results`, `docs/sessions`, `docs/origin.md`,
  `docs/model-effort.md`, the Log of every feature document, the test fixtures of a fake model, and the arms and
  prices of measurements already made (`evals/configs.mjs` `SUBAGENT_MODELS`, `evals/prices.mjs`). The inventory says
  which is which.
- Out: `sessions start --advisor`, a model the caller names for one session and no text makes a default.

## Constraints
- A rule of his changes only through `js-harness rules change` with his words read from the transcript, because a
  hand edit of the list loses the quotation that makes it his (`js-harness-protocols` section 4).
- A rule that leaves is retired with its successor, never deleted, because an id is never reused and a reader of the
  old id must be told what replaces it (`liveRule`, `bin/lib/rules.mjs`).
- Code stops reading a rule in a commit before the one that retires it, because `rules change` checks the new list
  against the tree and refuses a read of a rule with no value.
- Every rule change sits on the one branch `rule/one-model-home`, the last of the chain, because `rules change`
  refuses to run while another `rule/` branch holds a change that is not on `origin/main`.
- The guard's change gets an independent verifier, and every behaviour its test first, because a guard that fails
  open is not seen until a session runs on the wrong level.
- The probe of a model costs one cheap call a home and says so before it runs; Codex's is refused at or under
  `rule:codex-weekly-floor`, and his Codex reset credit is never spent without his word.
- Nothing heavy runs beside another session's gate: the machine is shared.

## Ask me before
- Every merge: each pull request lands after his yes, through the lead.
- Any switch of a model or an effort to another value than Fable 5.2 at high, Codex's included.
- Spending a Codex reset credit, and any spend past this plan's reviews (four slices: Codex once and the pertinent
  lenses once each, plus a recheck where a finding is fixed).
- Changing what `AGENTS.md` says of `rules change` ("changes one in a single commit"): the switch writes the rules of
  a home, two that change by one sentence of his, in one commit (T9). His to refuse.

## Depth pass
- 1. Method: configuration management, where the practitioner's standard is one source of truth: a value is declared
  once, every consumer reads it by reference, a lint refuses a stray copy, and a change is one transaction followed
  by a smoke test of the thing changed (how a release engineer pins a toolchain: one pin file, a check for stray
  pins, one bump command, one build on the new pin before it lands). The smallest change that meets it here, by the
  search of `rule:reuse-first` (`js-harness rules`, codegraph over `bin/`, the skills' texts): the home is two rules
  that already exist, `session-model` and `session-effort`, whose subjects widen, since the reading recorded for
  `session-model` already holds "the lead and the work sessions alike" (`docs/rule-sources.json`); five rules retire
  into them; three constants and one agent file become readers; Codex's home already exists as `review-model` and
  `review-effort`, read once in `bin/codex-review.mjs:204-205` and imported by the double review; the switch amends
  the runner of `rules change` (`bin/lib/rules-change-run.mjs`) to write the rules of a home in one pass; the level
  check amends the board row and the app-record reader that already read an effort (`bin/lib/sessions.mjs:3058`,
  `bin/lib/app-record.mjs:91`); the listing of sessions off the home amends `rules applied`, which already compares
  what ran with `session-model` and `session-effort` (`bin/rules.mjs:390-398`). One new module, `bin/lib/model-home.mjs`,
  because no file knows the ids of both homes today; one new sub-command, `rules switch`, because `rules change`
  takes one id and a JSON object and the switch is two to four ids by one sentence.
- 2. Raw material:
  - His words: transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, lines 4744, 5167, 5255, 5299, 5309, 5337 and 6185,
    each read whole with `js-harness sessions --quote` (the brief names 6183 for the last; that line is a
    `queue-operation` entry, and his message is 6185).
  - The list in force: `js-harness rules`, 78 rules, hash `a1ee0c6e5e08`; the nine declarations at
    `bin/lib/rules-data.mjs:229`, `:321`, `:538`, `:549`, `:660`, `:692`, `:758`, `:770`, `:787`.
  - The command that changes a rule: `bin/lib/rules-change-run.mjs:101-330` (one id, a clean tree, a `rule/` branch,
    no commit of its own, one open change at a time at `:152-180`) and `bin/lib/rules-change.mjs:159-212`.
  - The check: `bin/lib/rules-check.mjs:236-248` (a `ruleOf` read of a retired rule and a read of a rule with no
    value are findings; a live rule nothing reads is none).
  - The guard: `bin/lib/guard.mjs:16-44` (two sub-agent model rules) and `:88-114` (the effort of a start, the lead's
    by its title).
  - The launchers: `bin/lens-review.mjs:33`, `:36`, `:72` (two constants); `bin/double-review.mjs:68`, `:183`, `:312`
    (a fallback constant beside a rule read); `bin/codex-review.mjs:204-205`, `:359` (Codex's two, read from their
    rules); `bin/sessions-background.mjs:184`, `:307-308`, `:324` (a start passes what it is given, a resume the
    record's).
  - The lead's own record of 2026-11-10: its transcript stamps `effort: "high"` on all 1077 replies of 2026-11-09 to
    11-11 (the fields `effort` and `perTurnEffort` of each assistant entry, counted by a scratch script), while the
    app's answer to `get_session` at lines 5063 and 5263 says `"effort": "xhigh"` and at 5322, after his change,
    `"high"`. The app's record of a session is a file the harness already reads:
    `<app folder>/claude-code-sessions/<account>/<org>/local_<id>.json`, with `cliSessionId`, `model`, `effort`,
    `isArchived` and `title` (`bin/lib/app-record.mjs:80-101` reads all but `model`).
  - The words he acted on: the lead's reply at line 5286, "abre el selector de modelo que está junto a la caja donde
    escribes y, en esfuerzo, elige Alto", and his "Listo ya lo cambié a Alto" two minutes later (line 5309).
  - The app's own refusal: "Refusing to change this session's own model or effort; ask the user to pick it in the
    model menu." (line 5261), and the tools that change another session, `set_session_model` and
    `set_session_effort` (the same transcript).
  - The record of background sessions, `~/.js-harness/background/sessions.jsonl`, on 2026-11-11: 124 starts, 108 of
    them with no model recorded (they ran on the host's default), 6 at medium; `claude agents --json --all` lists 43
    jobs and gives no model and no effort.
  - The sub-agent documentation, read on 2026-11-11 (code.claude.com/docs/en/sub-agents.md): an agent file takes
    `model: inherit`, "use the same model as the main conversation", and with no `effort` the sub-agent "runs at the
    level you pick in the session"; the call's own `model` takes only short names.
  - `start_session`'s own description (the lead's transcript, line 5012): `model` is "a cheaper model id ... Omit to
    inherit yours", `effort` is "at or below yours. Omit to inherit".
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules`: 7 live rules hold a Claude model or effort today (counted with `grep -c`); the bar is 2, and 5 retired with a successor.
  spec 2: `node --test bin/conventions-model-home.test.mjs`: none, new behaviour; today 2 files of `bin/` outside the list hold a model id as a value (`bin/lens-review.mjs:33`, `bin/double-review.mjs:68`; `grep -nE` for a Claude or Codex id over the non-test files of `bin/` gives 7 more, all comments or sample text) and `.claude/agents/js-harness-writer.md` holds one more.
  spec 3: `node --test bin/lib/rules.test.mjs`: today a list whose `session-model` is `fable` reads with no fault; the bar is a fault that names the full id.
  spec 4: `node bin/js-harness.mjs rules check`: exits 0 today with the values restated in README, `docs/ROADMAP.md` and the skills' texts, since no pattern looks for them there; the bar is the same exit with those lines naming the rule, and the home's patterns finding none.
  spec 5: `node --test bin/sessions-background.test.mjs`: today a resume with no flag passes the record's model and effort (`bin/sessions-background.mjs:307-308`) and a start with no `--model` passes none; the bar is the home's on both.
  spec 6: `node bin/js-harness.mjs rules applied`: today it compares transcripts alone and lists no desktop or background record; the bar is every session whose record differs from the home, with whether it can still run.
  spec 7: `node bin/js-harness.mjs sessions`: today the board marks only `effort below high`, a level written by hand (`bin/lib/sessions.mjs:3058`), prefers the transcript's effort to the app's, and said `effort high` of the lead while its menu said extra high; the bar is a mark on any row whose app record differs from the home, and for the session that reads the board the line he is given.
  spec 8: `node --test bin/lib/rules-switch.test.mjs`: none, new behaviour; today a switch of both homes is four runs of `rules change`, four JSON objects and four commits.
  spec 9: `node bin/js-harness.mjs rules coverage`: none, new behaviour; the orchestrator skill holds no section for a new model, and `docs/future-model.md` covers the measuring, not the switch.
  spec 10: `node --test bin/codex-review.test.mjs`: Codex's model and effort are already read from their rules in one place (`bin/codex-review.mjs:204-205`), so the bar is what is left: the switch takes them, the probe asks the installed `codex` once, and the inventory's other mentions read the home.
- 4. Refutation: the request holds only if the level his menu shows can be read by a command. The cheapest test: read
  the one field a command reads today, the transcript's, for the day of the incident. Run on 2026-11-11 over the
  lead's transcript, a scratch script counting the `effort` of every assistant entry: 1077 of 1077 say `high`, none
  `xhigh`, though the app answered `xhigh` at lines 5063 and 5263. So a check on the transcript would have said all
  was well, as the board did. The app's own record holds the level his menu shows, the harness already reads that
  file, and on 2026-11-11 it reads `claude-fable-5-2` and `high` for the lead, after his change. Which of the two
  levels the engine ran at that day is not known. A second test, on the claim that one place is possible: the one
  reader that is not ours, the host reading the writer's agent file, takes `inherit` by its documentation, so that
  file can state no value. The request holds, with the app's record as the source of the check and the transcript
  beside it.
  Verdict: supports
- 5. Request: declare the Claude model and effort once, as the rules `session-model` and `session-effort` widened to
  everything Claude the harness starts, and retire the five rules that restate them; keep Codex's pair, `review-model`
  and `review-effort`, as the second home; make every launcher, guard, check and text in force a reader of a home,
  held by a test that refuses a model id written by hand and by the homes' patterns over the texts; hold the home to
  full ids; make a start and a resume take the home's model and effort when they name none, and refuse another
  model; show on the board, in `doctor` and in `rules applied` every session whose app record or start record
  differs from the home, with the Spanish line he acted on for a session that cannot change itself; and give the
  lead one command, `rules switch`, that takes the model, the effort and his quoted words for either home or both,
  writes them in one pass for one commit on a `rule/` branch, prints what is left outside the repository, and asks
  each new model one cheap question before the commit; write the steps as a section of the orchestrator skill.
  Adds: none

## Specs
- S1. His words, 2026-11-10 21:44 local (transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, line 4744): "Por que me
  equivoque, no podemos utilizar Fable 5.2 en Medio sino en Alto y este orquestador en Alto, por favor haz la
  correcion ya que medi el resultado y nos sale muchisimo mejor asi ya que el Fable 5.2 en Medio no es mejor que Opus
  5.5 en Max osea el Fable 5.2 Alto es mejor tanto en precio como en inteligencia haz la correcion completa osea
  todos los modelos de ahora en adelante va a ser Fable 5.2 Alto y debemos hacer un protocolo facil para que el dia
  de mañana salga un modelo mejor por der cambiar esta forma en como trabajamos tanto en el orquestador como con las
  sesiones"
- S2. His words, 22:31 local (line 5167): "Vamos a unificar y todo va a ser con Fable 5.2 Alto y necesito que lo
  cambies tanto en la documentacion y lo unifiques en un solo lugar y ademas cambies de una vez en todas las sesiones
  a este modelo con ese esfuerzo y que sea TODO"
- S3. His words on the sessions he saw, 22:39 local (line 5337): "Ya cambie el que estaba en medio a ALTO pero veo
  muchas sesiones que siguen en Medio y la idea es que todo quede en Alto"
- S4. His words on Codex, 23:53 local (line 6185): "Tambien ten en cuenta que pronto va a salir Astra y Sol 6.2 de
  openai o codez o chatgpt como le quieras decir y vamos a migrar en codex a ese para que vayas preparando camino."
- S5. His words on the lead's own level, 22:35 and 22:37 local (lines 5255 and 5299): "pero el orquestador quedo en
  extra y ya te dije, TODO pero TODO va a correr siempre en Fable 5.2 Alto" and "mi pregunta es por que no lo puedes
  hacer tu?"

What they become, numbered as the bar of the depth pass:

1. One home for Claude (S1, S2). `session-model` and `session-effort` are the home: their subjects say that every
   session, the lead included, every sub-agent, the lenses, the double review's Claude reader and the escalation run
   on that model at that effort. `lead-effort` and `subagent-effort` retire into `session-effort`;
   `subagent-writer-model`, `subagent-reader-model` and `escalation-model` retire into `session-model`. The two stay
   of this repository only (`scope`), so the guard holds a project that installs the harness to nothing, as today;
   the harness's own launches (the lenses, the double review's reader) read the declared value wherever they run, as
   their constants did.
2. Every reader reads the home (S2). `bin/lib/model-home.mjs` names the ids of both homes and gives their values;
   the guard, the lenses, the double review, the recheck's escalation line, `rules applied`, the contract's modes, the
   sub-agent row of `check`, the host watch and the board read through it. `.claude/agents/js-harness-writer.md` says
   `model: inherit` and no effort, so the host runs the writer on the session's. A convention test refuses a Claude or
   Codex model id written by hand in code in force outside the list, with a legacy list that only shrinks.
3. The home holds full ids (the alias trap JH 171 measured). `readRules` reports a fault for a `session-model` that
   is not a full Claude id, for one that declares an alias, and for a `session-effort` that is no level; `rules check`,
   `check` and `rules change` all read through it.
4. The documentation (S2). Every text in force that states a model or an effort names the rule and does not repeat
   the value; the homes' patterns find a restated one. Help texts that must show the value print it from the home.
5. A start and a resume take the home (S2, S3). `sessions start` with no `--model` or `--effort` passes the home's
   where the home is in force; `--resume` with no flag passes the home's and never the record's; a `--model` other
   than the home's is refused, and the guard refuses a `start_session` that names another model. An effort at or
   below the home's passes, as today.
6. The sessions off the home (S3). `rules applied` lists every session, desktop or background, whose app record or
   start record differs from the home, and says for each whether it still runs, is stopped and resumes on the
   home's, or is archived or removed and cannot run again. It reads the records and writes none.
7. The session that cannot change itself (S5). The board marks any row whose app record differs from the home, and
   for the session that reads it prints the line to give him; `doctor` has the same row. The line is the one he
   acted on: "En esta sesión, abre el selector de modelo que está junto a la caja donde escribes y elige <modelo>
   con esfuerzo <nivel>."
8. The switch (S1). `js-harness rules switch [--claude <model>@<effort>] [--codex <model>@<effort>] --quote
   <session>:<line> --accepted "<where>"`, run from a checkout of a `rule/` branch as `rules change` is: it writes
   the rules of the homes named in one pass, each with his words as its source, and prints what is left outside the
   repository: each open desktop session off the home with the session tool that sets it, the session that only he
   can change, the background sessions and what a resume does, and the installed copy to refresh at the land. It
   also prints what a new model may make stale and no rule holds, each found by a check and not listed by hand: the
   context window the board assumes (`DEFAULT_CONTEXT_WINDOW`, `bin/lib/sessions.mjs:25`), a family name the
   commit-message hook does not know (`HOST_NAME`, `bin/commit-msg.mjs:31`), a model with no row in
   `evals/prices.mjs`, and a Codex id that does not begin as the pattern of `review-model` expects.
   `--dry-run` prints and writes nothing. `rules switch --probe` asks each home's model one short question with the
   installed CLI and fails when another model answers.
9. The protocol (S1). A section of the orchestrator skill, "A new model", beside "Before a reinstall": the sentence
   he types, the branch, the switch, the probe, the commit, the gate and both reviews run from the branch's copy so
   Codex reviews the slice on the new model, the meter, his yes, the land with the installed copy refreshed, then the
   sessions. `docs/future-model.md` stays the measuring and points to it.
10. Codex's side, prepared and not switched (S4). `review-model` and `review-effort` are the second home, never
    mixed into Claude's; the switch and the probe take them; the inventory's other mentions of Codex's model read
    the home; the protocol says what is checked the day before a Codex switch lands: the id the installed `codex`
    takes (the probe, one cheap call, said before it runs), that `js-harness codex-meter` still reads its limits, and
    that a review of one small slice runs end to end from the branch's copy. It also says what a Codex switch resets
    and no command can restore: the plan of a review fits its estimate from the runs of the same model and effort
    (`bin/lib/codex-review-plan.mjs:69-81`), so the first five reviews on a new model are planned from
    `rule:codex-review-rate` alone, and that rate, `rule:codex-review-floor` and the double review's `MEASURED_COST`
    (`bin/double-review.mjs:71`) were measured on the model that leaves.

## Tasks
- [ ] T1 (kind: design) (1-10) This document, its depth pass and the inventory, committed with documents alone. Route: inline, with one read-only explorer for the inventory.
- [ ] T2 (kind: design) (1-10) The double review of this design (`js-harness double-review read`), every finding answered, and one notice to the lead with its verdict. Route: inline.
- [ ] T3 (kind: build) (2, 3) Slice A, branch `feat/model-home-readers`: `bin/lib/model-home.mjs` and its test; the full-id fault in `readRules`; the lenses, the double review, the recheck, `rules applied`, the contract's modes, the sub-agent row and the host watch read the home; the writer's agent file inherits; the convention test. Route: inline.
- [ ] T4 (kind: build) (1, 2) Slice A, the guard: `allowedModels` and `sessionEffortRefusal` read the home, a lead's start included; then an independent verifier on the guard. Route: inline, then one verifier.
- [ ] T5 (kind: build) (5, 7) Slice B, branch `feat/model-home-sessions`: a start and a resume take the home, another model is refused, in `sessions start` and in the guard's `start_session`; `appSessions` gives the model; the board's mark and line. Route: inline.
- [ ] T6 (kind: build) (6, 7) Slice B: `rules applied` lists the sessions off the home from the app's records and the record of starts; the `doctor` row. Route: inline.
- [ ] T7 (kind: build) (8, 10) Slice C, branch `feat/model-home-switch`: the runner of `rules change` writes several rules in one pass; `rules switch` with `--dry-run`, its printout and `--probe`. Route: inline.
- [ ] T8 (kind: build) (1, 3) Slice D, branch `rule/one-model-home`: the marks of the five rules move to the home in every text; then `rules change` seven times, a commit each: the two subjects widened, the five retirements. Route: inline.
- [ ] T9 (kind: docs) (4, 9, 10) Slice D: the section "A new model" of the orchestrator skill, the README, `docs/SPEC.md`, `docs/GUIDE.md`, `docs/ROADMAP.md`'s Decided rows, `docs/future-model.md`'s pointer, the help texts; the homes' patterns find none. Route: inline.
- [ ] T10 (kind: verify) (1-10) Each slice: gate, Codex and the pertinent lenses, one at a time; pull request ready; `js-harness notify --to orchestrator --kind ready --pr <n>`. Then the summary and the closed notice. Route: inline.

## Inventory
Where a model or an effort is named, read on 2026-11-11 at `7525a4e5`. The table of pull request 813 was the start;
each row was read again. "Reader" means the value comes from a rule; "by hand" means it is written in the file.

| Place | Today | Becomes |
|---|---|---|
| rules `session-model`, `session-effort` (`bin/lib/rules-data.mjs:692`, `:660`) | claude-fable-5-2, high; "the model a session runs on" | the Claude home, subjects widened (T8) |
| rules `lead-effort`, `subagent-effort` (`:321`, `:758`) | high, high | retired into `session-effort` (T8) |
| rules `subagent-writer-model`, `subagent-reader-model`, `escalation-model` (`:787`, `:770`, `:229`) | claude-fable-5-2 each | retired into `session-model` (T8) |
| rules `review-model`, `review-effort` (`:549`, `:538`) | gpt-6.1-sol, medium | the Codex home, unchanged |
| `bin/lens-review.mjs:33`, `:36` `LENS_MODEL`, `LENS_EFFORT` | by hand | readers of the home (T3) |
| `bin/double-review.mjs:68` `CLAUDE_FALLBACK`, `:312` | by hand, beside a read of `subagent-reader-model` | reader of the home (T3) |
| `bin/codex-review.mjs:204-205` `REVIEW_MODEL`, `REVIEW_EFFORT` | readers; the double review's Codex reader imports them (`bin/double-review.mjs:31`, `:189`) | unchanged: the Codex home's one read |
| `bin/lib/guard.mjs:16-22`, `:88-96` | reader of four rules | reader of the home (T4) |
| `bin/lib/guard.mjs:73` `EFFORTS` | the levels a host takes, by hand | moves to `model-home.mjs`, the one list of levels (T3) |
| `bin/rules.mjs:389-398` `heldRules` | reader of five rules | reader of the home (T3) |
| `bin/check.mjs:1638`, `bin/lib/subagent-check.mjs:136`, `:163`, `:176` | reader of three sub-agent rules | reader of the home (T3) |
| `bin/lib/contract.mjs:288-307` `MODE_RULES`, `bin/contract.mjs:335-358`, `bin/resume.mjs:976-985` | name four rules by a variable, which `rules check` does not see: a retired one would throw when the line is printed | name the home; the line of a task's mode says one model and one effort (T3) |
| `bin/lib/contract.mjs:46` `EFFORTS` | `medium`, `high`: the levels a document's optional `## Effort` section may name | stays: what a document may ask, not what runs |
| `bin/lib/subagent-count.mjs:57` | a launch on a haiku model counts as a writer | stays: it classifies recorded launches of the days a writer ran on Haiku, and gives nothing started now its model |
| `bin/commit-msg.mjs:31` `HOST_NAME` | the family names of a host's attribution line | stays; the switch says when the new id's family is not in it (T7) |
| `bin/lib/sessions.mjs:25`, `:37` | the model's context window and the app's compaction share, by hand | stay; the switch names the first as a value to read again on a new model (T7) |
| `bin/double-review.mjs:71` `MEASURED_COST`; rules `codex-review-rate`, `codex-review-floor`; `bin/lib/codex-review-plan.mjs:69-81` | measured on the models of today; the plan's sample is kept by model and effort | stay; the protocol says a switch resets them (T9) |
| rule patterns, `bin/lib/rules-data.mjs:545`, `:555`, `:705` | look for an id that begins `claude-` or `gpt-` | stay; the switch says when a new id begins another way (T7) |
| `bin/lib/codex-review-recheck.mjs:39-40` | reader of `escalation-model` | reader of the home (T3) |
| `bin/sessions-background.mjs:184`, `:307-308` | passes what it is given; a resume the record's | the home's when none is given (T5) |
| `bin/lib/sessions.mjs:3058` | `effort below high`, the level by hand | a mark against the home (T5) |
| `bin/lib/app-record.mjs:91` | reads the app's effort, not its model | reads both (T5) |
| `workshop/bin/host-watch.mjs` HOST line | reader of `session-effort` | unchanged |
| `.claude/agents/js-harness-writer.md:5-6` | `model: claude-fable-5-2`, `effort: high`, by hand, held by a test | `model: inherit`, no effort (T3) |
| `bin/lib/manifest.mjs:156` (the lead's text) | `sessions start ... --effort <level>` | the flag leaves the example (T9) |
| `bin/lib/protocols-skill.mjs:102` | names the three sub-agent rules | names the home (T8) |
| `README.md:1070`, `:1293`, `:1334`, `:1015` (a sample of output) | values restated | name the rule; a sample shows `<model>` (T9) |
| `docs/ROADMAP.md:68`, `:72`, Decided rows "Review model" and "Effort" | values restated, `:72` stale: Opus 5.5, Haiku 5.5 for writers, a `maxEffortLevel` cap no code writes | name the rules (T9) |
| `README.md:1812`, `:1824-1825` | "Claude Opus 5.5" as the sample of an attribution line the hook removes | stay: the name of a host in a sample, not a pick |
| tests that write today's value: `bin/lens-review.test.mjs:391`, `bin/double-review.test.mjs:136`, `:175`, `bin/rules.test.mjs:285`, `:409`, `:412`, `bin/resume.test.mjs:1881`, `bin/contract.test.mjs:620-657`, `bin/lib/sessions.test.mjs:2429-2432`, `bin/sessions.test.mjs:1472`, `bin/lib/writer-agent.test.mjs:32-33` | red the day a value changes | read the home (T3, T5, T8) |
| each retired rule's other records: `docs/rule-sources.json`, its planted break in `bin/lib/rules-coverage-data.mjs`, its entry of `PLANTED` in `bin/lib/rules-scan.test.mjs:56-87` | one a rule | move with the retirement (T8) |
| `scripts/practice.mjs:272`, `scripts/rehearsal.mjs:248` | `claude-haiku-5-5`, a rehearsal host under a cap of 0.5 USD a run | stays, on the convention's legacy list with that reason; the lead's to decide (JH 171) |
| `evals/configs.mjs:314` `SUBAGENT_MODELS` | `sub-opus`, `sub-haiku`: the arms of a measurement, named by their model | stays: an arm named for a model cannot read another |
| `evals/suite.mjs` `EVAL_MODEL`, `CODEX_EVAL_MODEL`; `evals/prices.mjs`; `evals/report.mjs` | the model a recorded run was made on, and list prices by id | stay: a run continues only on the model it was recorded on (`docs/future-model.md`, Step 1) |
| `evals/results`, `docs/sessions`, `docs/origin.md`, `docs/model-effort.md`, `docs/workshop.md`'s sample, fixtures | history | stay |

## Log
- L1. His request as written: S1 to S5 above, read from the transcript on 2026-11-11.
- L2. The brief's reading (the lead, JH ORQ): points 1 to 5 of the brief named in this document's first lines.
- L3. Evidence against the brief, 2026-11-11. (a) His line on Codex is 6185, not 6183. (b) "The lead ran at xhigh
  for hours": the app's record said `xhigh`; the lead's transcript says `high` on every one of its 1077 replies of
  those days. Which level the engine ran at is not known; the check reads both. (c) "48 background jobs keep the
  model and effort they were started with in their record": `claude agents --json --all` gives 43 jobs with no model
  and no effort; the record that holds them is the harness's own, where 108 of 124 starts name no model.
  (d) `SUBAGENT_MODELS` of `evals/configs.mjs` is not a constant to unify: its two keys are the arms of a measurement
  (`sub-opus`, `sub-haiku`).
- L4. Decision, this session: the home is the two session rules widened, not two new ids. `rule:reuse-first`: they
  already hold the lead and the work sessions, the guard, `rules applied` and the host watch already read them, and
  two new ids would retire seven rules instead of five and rename every one of those readers for no change of
  behaviour. Cost: the ids say "session" for what the lenses and sub-agents run on; their subjects say the rest.
- L5. Decision, this session: `escalation-model` retires into `session-model` and the recheck's line keeps naming
  the model the rules give. With one model the step passes the work to no stronger one (JH 171, "Nobody yet");
  whether the step stays is his, and is raised in the last pull request's body.
- L6. Decision, this session: the level check sits on the board and in `doctor`, not only at a start. The lead of
  2026-11-10 had started on 2026-10-27; the home changed under it, so a check at its start alone would never have
  run that day. The lead reads the board at its start and on every wake.
- L7. The inventory, 2026-11-11: one read-only explorer read every place a model or an effort is named (126 tool
  calls); its result is the table above. Checked of it before it was used: `bin/lib/subagent-count.mjs:57`,
  `bin/lib/contract.mjs:46`, `bin/lib/sessions.mjs:25` and the four README lines, each by a grep of this session.
  Not checked: its counts of the history folders. The host compacted this session at 00:15 local, after this
  document was written and before its first commit.
