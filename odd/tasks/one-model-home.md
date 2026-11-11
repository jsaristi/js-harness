# one-model-home

One declared model and one declared effort for everything Claude the harness starts, a second pair beside it for
Codex, and one command that switches either. Session JH 172, opened by the brief
`~/.js-harness/background/briefs/2026-11-11T04-55-04-184Z-d0d109fd.md`. Delivery: four pull requests, each landing
alone through the gate, Codex and the lenses. Runner: `node --test`.

## Goal
The model and the effort everything runs on are declared once for Claude and once for Codex, every launcher, guard,
check and text in force reads them from there, and the day a better model comes out the switch is one command and one
commit.

## Why
On 2026-11-10 he changed the model and the effort twice in one day. Each change was carried by hand through the
values of seven rules, three constants, one agent file, two readers that assumed a short name, two README lines and the tests that
wrote a value by hand (`docs/sessions/2026-11-10-jh-171-rule-every-model-on-fable-5-2-at-high.md`, "Left"). The lead's
session showed extra high in the app's menu for about an hour after he said high, and he had to say it three times (S1, S2,
S5). A value restated in many places goes stale in some of them: the failure section 4 of `js-harness-protocols`
exists for, met again one level up. He also said the reviewer's model will change soon (S4), so the same way has to
carry Codex.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/one-model-home.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/lib/model-home.test.mjs bin/lib/rules.test.mjs bin/lib/writer-agent.test.mjs` exits 0
- `node --test bin/conventions-model-home.test.mjs` exits 0
- `node --test bin/lib/guard.test.mjs bin/guard.test.mjs bin/sessions-background.test.mjs` exits 0
- `node --test bin/rules.test.mjs bin/lib/rules-applied.test.mjs bin/lib/app-record.test.mjs` exits 0
- `node --test bin/lib/sessions.test.mjs bin/sessions.test.mjs bin/doctor.test.mjs` exits 0
- `node --test bin/lib/rules-switch.test.mjs bin/lib/rules-change-run.test.mjs` exits 0
- `node --test bin/lib/manifest.test.mjs bin/codex-review.test.mjs bin/double-review.test.mjs bin/lens-review.test.mjs` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `npm run check` exits 0
- Each pull request is ready and the lead holds its `ready` notice; the last one's body says, in plain words, what he
  types the day a new model comes out, and names every exception to "everything" that stays and why.
- The lead holds one notice with the list `rules applied` gives of the sessions off the home, since the sessions
  are the lead's to set and the lead's own level is his to pick (S2, S3); and the closing summary carries a second
  run of `rules applied`, made after the lead says it acted, that names each session still off the home and why.

## In scope / Out of scope
- In: the rules of the two homes and the five rules that leave (`js-harness rules change`, his words as their source);
  every reader of a Claude or Codex model or effort in code that ships or runs here (`bin/`, `workshop/`,
  `scripts/`, `.claude/agents/`); `sessions start` and its `--resume`; the board's level mark; `doctor`;
  `rules applied`; the switch command; its protocol in the orchestrator skill; every text in force that states a
  model or an effort.
- Out: the model or the effort of any open session, which the lead sets with the app's session tools, and its own,
  which only he picks in the app's menu. This work gives the lead the list and the commands; the act is the lead's.
- Out: anything under `~/.claude` (his), the app's records and the host's job records: read, never written.
- Out: switching Codex's model now. The next model is not out and its id as the `codex` CLI takes it is not known; no
  id is guessed and the web is not asked (S4).
- Out: the records of the past, which stay as they are: `evals/results`, `docs/sessions`, `docs/origin.md`,
  `docs/model-effort.md`, the Log of every feature document, the test fixtures of a fake model, and the arms and
  prices of measurements already made (`evals/configs.mjs` `SUBAGENT_MODELS`, `evals/prices.mjs`). The inventory says
  which is which.

## Constraints
- A rule of his changes only through `js-harness rules change` with his words read from the transcript, because a
  hand edit of the list loses the quotation that makes it his (`js-harness-protocols` section 4).
- A rule that leaves is retired with its successor, never deleted, because an id is never reused and a reader of the
  old id must be told what replaces it (`liveRule`, `bin/lib/rules.mjs`).
- A rule's readers and its planted break move in the commit that retires it, never earlier, because a live rule
  that nothing reads is enforced by nothing and its control in the coverage register finds no text
  (`bin/lib/rules-coverage.mjs:196`, `:217`). `rules change` cannot do that today: it refuses a tree with changes
  (`bin/lib/rules-change-run.mjs:229-235`) and refuses a retirement while code reads the rule (`:266-269`; a dry run
  of each of the five on 2026-11-11 named its readers, L11). So pull request 1 first gives the runner
  `--with <path>...`: the changes of the paths named are admitted, the new list is checked against the tree as it
  then is, and any other change is refused as before.
- Every rule change sits on the one branch `rule/one-model-home`, because `rules change` refuses to run while
  another `rule/` branch holds a change that is not on `origin/main`.
- The guard's change gets an independent verifier, and every behaviour its test first, because a guard that fails
  open is not seen until a session runs on the wrong level.
- A probe of a model costs one cheap call a home and says so before it runs; Codex's is refused at or under
  `rule:codex-weekly-floor`, and his Codex reset credit is never spent without his word.
- Nothing heavy runs beside another session's gate: the machine is shared.

## Ask me before
- Every merge: each pull request lands after his yes, through the lead.
- Any switch of a model or an effort to another value than Fable 5.2 at high, Codex's included.
- Spending a Codex reset credit, and any spend past this plan's reviews (four pull requests: Codex once and the
  pertinent lenses once each, plus a recheck where a finding is fixed).
- Changing what `AGENTS.md` says of `rules change` ("changes one in a single commit"): the switch writes the rules of
  a home, two that change by one sentence of his, in one commit. His to refuse.
- Each exception to "TODO pero TODO" that this work leaves as it found it. None is changed here; each is named in
  the last pull request's body with what was measured, for him to decide one at a time:
  1. `sessions start --advisor <model>`, a second model the caller names for one session.
  2. The rehearsal hosts of `scripts/practice.mjs:272` and `scripts/rehearsal.mjs:248`, on `claude-haiku-5-5` under
     a cap of 0.5 USD a run (left to the lead by JH 171).
  3. The default model of a new eval run, `EVAL_MODEL` and `CODEX_EVAL_MODEL` (`evals/suite.mjs:65`, `:69`), the
     model of the recorded baseline, which `docs/future-model.md` changes and the switch does not.
  4. The host's agent types that set their own model: on 2026-11-11 a `claude-code-guide` launch of this session
     ran on `claude-haiku-5-5` at high, and a `general-purpose` one on `claude-fable-5-2` at high (L8).
  5. The escalation step: with one model, "pass the work to the strongest model the rules name" passes it to the
     model it already runs on. The rule retires into the home as the brief reads his words; whether the step stays
     in the protocols is his.
  6. Whether a sub-agent launch from a session that is off the home should be refused. Here it is shown and
     corrected, not refused (L9, Codex 2).
  7. A session he opens himself outside the harness starts on what his user settings say: the default model
     `opus[1m]` and, for Opus 5.5, medium. The two keys are his to set, or to let the lead set.
  8. Codex reviews at `review-effort`, medium, not at Alto: the brief reads his "Fable 5.2 Alto" as Claude's.

## Depth pass
- 1. Method: configuration management, where the practitioner's standard is one source of truth: a value is declared
  once, every consumer reads it by reference, a lint refuses a stray copy, a copy a foreign reader needs is
  generated and compared, and a change is one transaction that first tries the new value on the thing changed (how a
  release engineer pins a toolchain: one pin file, a check for stray pins, one bump command that builds on the new
  pin before it writes). The smallest change that meets it here, by the search of `rule:reuse-first`
  (`js-harness rules`, codegraph over `bin/`, the skills' texts): the home is two rules that already exist,
  `session-model` and `session-effort`, whose subjects widen on his words of S1, S2 and S5, a new source with a new
  reading (the reading stored today stops at sessions: `docs/rule-sources.json`, `session-model`, "The models of
  sub-agents, the escalation model and the review model are not named by these words"); five rules retire into
  them; three constants become readers and the one agent file a generated copy held by its test; Codex's home
  already exists as `review-model` and `review-effort`, read once in `bin/codex-review.mjs:204-205` and imported by
  the double review; the switch amends the runner of `rules change` (`bin/lib/rules-change-run.mjs`) to write the
  rules of a home in one pass; the level check amends the board row and the app-record reader that already read an
  effort (`bin/lib/sessions.mjs:3058`, `bin/lib/app-record.mjs:91`); the listing of sessions off the home amends
  `rules applied`, which already compares what ran with `session-model` and `session-effort`
  (`bin/rules.mjs:390-398`). One new module, `bin/lib/model-home.mjs`, because no file knows the ids of both homes
  today; one new sub-command, `rules switch`, because `rules change` takes one id and a JSON object and the switch
  is two to four ids by one sentence; one new convention test, because the patterns of the rules look for a
  restated value only after the word "session" and only in some of the texts (`bin/lib/rules-scan.mjs:15`).
- 2. Raw material:
  - His words: transcript `ea85ec35-82e1-4aa9-abe3-98bd153a50b0`, lines 4744, 5167, 5255, 5299, 5309, 5337 and 6185,
    each read whole with `js-harness sessions --quote` (the brief names 6183 for the last; that line is a
    `queue-operation` entry, his message is 6185, and the lead confirmed it at 00:29 local on 2026-11-11).
  - The list in force: `js-harness rules`, 78 declarations, 4 of them retired, hash `a1ee0c6e5e08`; the nine
    declarations at `bin/lib/rules-data.mjs:229`, `:321`, `:538`, `:549`, `:660`, `:692`, `:758`, `:770`, `:787`.
  - The command that changes a rule: `bin/lib/rules-change-run.mjs:101-330` (one id, a clean tree, a `rule/` branch
    that holds `origin/main`, no commit of its own, one open change at a time at `:152-180`) and
    `bin/lib/rules-change.mjs:57-80` (a form change sets `patterns`).
  - The check: `bin/lib/rules-check.mjs:236-248` (a `ruleOf` read of a retired rule and a read of a rule with no
    value are findings, seen only where the id is written out; a live rule nothing reads is none).
  - The guard: `bin/lib/guard.mjs:16-44` (two sub-agent model rules) and `:88-114` (the effort of a start, the lead's
    by its title, passing any level at or below the rule's at `:112`).
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
  - The host's settings, three keys read on 2026-11-11 and nothing written: his user settings hold
    `maxEffortLevel: "high"`, `model: "opus[1m]"` and `modelSettings.claude-opus-5-5.effortLevel: "medium"`; the
    project's `.claude/settings.local.json`, a file git ignores, holds `effortLevel: "high"`, which sets the level
    of a new Code tab session here (`docs/host-updates/claude-desktop-4.16336.0.md:93`).
  - The words he acted on: the lead's reply at line 5286, "abre el selector de modelo que está junto a la caja donde
    escribes y, en esfuerzo, elige Alto", and his "Listo ya lo cambié a Alto" two minutes later (line 5309).
  - The app's own refusal: "Refusing to change this session's own model or effort; ask the user to pick it in the
    model menu." (line 5261), and the tools that change another session, `set_session_model` and
    `set_session_effort` (the same transcript).
  - The record of background sessions, `~/.js-harness/background/sessions.jsonl`, on 2026-11-11: 124 starts, 108 of
    them with no model recorded, 6 at medium; `claude agents --json --all` lists 43 jobs and gives no model and no
    effort.
  - The lead's two `start_session` calls in that transcript (2026-11-10 01:01Z) name an effort and no model: no
    call shows whether the tool takes a full id.
  - The sub-agent documentation, read on 2026-11-11 (code.claude.com/docs/en/sub-agents.md): an agent file takes a
    full id or `inherit`, and with no `effort` the sub-agent "runs at the level you pick in the session"; the
    call's own `model` takes only short names.
  - `start_session`'s own description (the lead's transcript, line 5012): `model` is "a cheaper model id ... Omit to
    inherit yours", `effort` is "at or below yours. Omit to inherit".
- 3. The bar:
  spec 1: `node bin/js-harness.mjs rules`: 7 live rules hold a Claude model or effort today (counted with `grep -c`); the bar is 2, and 5 retired with a successor.
  spec 2: `node --test bin/conventions-model-home.test.mjs`: none, new behaviour; today 2 files of `bin/` outside the list hold a model id as a value (`bin/lens-review.mjs:33`, `bin/double-review.mjs:68`; `grep -nE` for a Claude or Codex id over the non-test files of `bin/` gives 7 more, all comments or sample text) and `.claude/agents/js-harness-writer.md` holds one that only its test compares.
  spec 3: `node --test bin/lib/rules.test.mjs`: today a list whose `session-model` is `fable` reads with no fault; the bar is a fault that names the full id.
  spec 4: `node --test bin/conventions-model-home.test.mjs`: none, new behaviour; a scratch count of 2026-11-11 over the nine texts the test will read finds 16 lines in the eight texts that restate a model or an effort (README 7, `docs/ROADMAP.md` 7, `docs/future-model.md` 2), and `rules check` passes with all of them; the bar is none outside a list of dated lines that only shrinks.
  spec 5: `node --test bin/sessions-background.test.mjs bin/lib/guard.test.mjs`: today a resume with no flag passes the record's model and effort (`bin/sessions-background.mjs:307-308`), a start with no `--model` passes none, and a start at medium passes (`bin/lib/guard.mjs:112`); the bar is the home's on both and any other level refused.
  spec 6: `node bin/js-harness.mjs rules applied`: today it compares transcripts alone and lists no desktop or background record; the bar is every session whose record or last reply differs from the home, each with what each source says of it.
  spec 7: `node bin/js-harness.mjs sessions`: today the board marks only `effort below high`, a level written by hand (`bin/lib/sessions.mjs:3058`), prefers the transcript's effort to the app's, and said `effort high` of the lead while its menu said extra high; the bar is a mark on any row whose app record differs from the home, both levels where they disagree, and for the session that reads the board the line he is given.
  spec 8: `node --test bin/lib/rules-switch.test.mjs`: none, new behaviour; today a switch of both homes is four runs of `rules change`, four JSON objects and four commits, with no try of the new id before it is written.
  spec 9: `node --test bin/lib/manifest.test.mjs`: none, new behaviour; the orchestrator skill holds no section for a new model, and `docs/future-model.md` covers the measuring, not the switch.
  spec 10: `node --test bin/codex-review.test.mjs`: Codex's model and effort are already read from their rules in one place (`bin/codex-review.mjs:204-205`), so the bar is what is left: the switch takes them, the probe asks the installed `codex` once, and the patterns of the two rules find an id that does not begin `gpt-`, which today they do not (`bin/lib/rules-data.mjs:545`, `:555`).
- 4. Refutation: the request holds only if the level his menu shows can be read by a command. The cheapest test: read
  the one field a command reads today, the transcript's, for the day of the incident. Run on 2026-11-11 over the
  lead's transcript, a scratch script counting the `effort` of every assistant entry: 1077 of 1077 say `high`, none
  `xhigh`, though the app answered `xhigh` at lines 5063 and 5263. So a check on the transcript would have said all
  was well, as the board did. The app's own record holds the level his menu shows, the harness already reads that
  file, and on 2026-11-11 it reads `claude-fable-5-2` and `high` for the lead, after his change. His user settings
  cap the effort at high (`maxEffortLevel`), which would fit both readings: the menu said extra high and the record
  stopped at the cap. A third reading, of the past: in the 126 transcripts of this project written since 2026-10-12, a
  scratch count finds 97,331 replies stamped `high` and none stamped above it, though `odd/tasks/harness-review.md:100`
  records two sessions the app said ran at max and a lead at xhigh on 2026-10-16 to 10-18. So a reply's stamp has
  never gone above the cap whatever the menu said. Whether the engine then worked at the cap or at the menu's level
  is not known: the stamp is what the record says, and this document calls it the recorded effort. A second test, on the claim that one place is possible:
  the one reader that is not ours, the host reading the writer's agent file, takes a full id, so that file is a
  copy a command writes and a test compares, not a second home. The request holds, with the app's record as what
  the mark is about and the transcript's stamp beside it as the recorded effort.
  Verdict: supports
- 5. Request: declare the Claude model and effort once, as the rules `session-model` and `session-effort` widened to
  everything Claude the harness starts, and retire the five rules that restate them; keep Codex's pair, `review-model`
  and `review-effort`, as the second home; make every launcher, guard and check a reader of a home and the one
  agent file a copy the switch writes, held by a test that refuses a model or an effort written by hand in code and
  in the texts in force; hold the home to full ids; make a start and a resume take the home's model and effort when
  they name none, and refuse any other; show on the board, in `doctor` and in `rules applied` every session whose
  app record, start record or last reply differs from the home, with the Spanish line he acted on for a session that
  cannot change itself, and in `doctor` what his own settings say that the home does not; and give the lead one
  command, `rules switch`, that takes the model, the effort and his quoted words for either home or both, tries each
  new model with one cheap question, then writes the rules in one pass for one commit on a `rule/` branch and prints
  what is left outside the repository; write the steps as a section of the orchestrator skill.
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

- S6. His words to the lead, 2026-11-11 00:26 local (line 6716, read with `js-harness sessions --quote`): "une lo
  que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion recomendada, no
  preguntes, avanza y se completamente autonomo." They are the lead's leave, not this session's: what "Ask me
  before" lists goes to the lead, who decides by them.

What they become, numbered as the bar of the depth pass. L13 of the Log, the answers to the third read, amends
specs 1, 4, 5, 8 and 10 and the tasks T3 and T4, and wins where it differs from the text below:

1. One home for Claude (S1, S2, S5). `session-model` and `session-effort` are the home: their subjects say that
   every session, the lead included, every sub-agent the harness defines or that inherits, the lenses, the double
   review's Claude reader and the escalation run on that model at that effort. `lead-effort` and `subagent-effort`
   retire into `session-effort`; `subagent-writer-model`, `subagent-reader-model` and `escalation-model` retire into
   `session-model`. Each of the seven changes carries the quotations of lines 4744, 5167 and 5255 and one reading:
   "Everything Claude the harness starts runs on this one model at this one effort: his 'todos los modelos de ahora
   en adelante', 'todo va a ser con Fable 5.2 Alto ... en un solo lugar' and 'TODO pero TODO'. That the lenses, the
   double review's reader and the escalation are part of 'todo' is the lead's reading in the brief of JH 172, and
   his to correct." The two stay of this repository only (`scope`), so the guard holds a project that installs the
   harness to nothing, as today; the harness's own launches (the lenses, the double review's reader) read the
   declared value wherever they run, as their constants did. A host's agent type that sets its own model is not
   the harness's to set and is named as an exception (Ask me before, 4).
2. Every reader reads the home (S2). `bin/lib/model-home.mjs` names the ids of both homes, gives the Claude home's
   values (`claudeHome()`, and what a guard holds of them in a project) and the one list of effort levels; the
   guard, the lenses, the double review, the recheck's escalation line, `rules applied`, the contract's modes, the
   sub-agent row of `check`, the host watch and the board read through it. Codex's two values keep their one read
   in `bin/codex-review.mjs`; the module names their ids for the switch and reads nothing of them twice.
   `.claude/agents/js-harness-writer.md` keeps a full id and a level, because a writer that inherits would run on
   whatever its parent runs on: the switch writes the two lines and `bin/lib/writer-agent.test.mjs` compares them
   with the home. A convention test refuses, in the code in force of `bin/`, `workshop/` and `scripts/`, a Claude
   or Codex model id written as a value and an effort level written at a launch (`--effort`, `effort:`), outside
   the list and the module, with a legacy list that only shrinks. Each rule of the home keeps a control in the
   coverage register that is a bundle, one planted break for each consumer that enforces it or launches on it (the
   guard's start, the guard's sub-agent call, the lenses, the double review's reader, the default of
   `sessions start`, the writer file's test), so going through one module does not shrink what is proven.
3. The home holds full ids (the alias trap JH 171 measured). `readRules` reports a fault for a `session-model` that
   is not a full Claude id (`claude-<family>-<version>`, no bracket), for a `session-effort` or a `review-effort`
   that is no level, and for a `review-model` that is empty, holds a space, is a Claude id or is a level;
   `rules check`, `check` and `rules change` all read through it. Codex's id has no shape to hold it to: the probe
   is its check.
4. The documentation (S2). Every text in force that states a model or an effort names the rule and does not repeat
   the value. The same convention test reads README, `AGENTS.md`, `CLAUDE.md`, `docs/SPEC.md`, `docs/GUIDE.md`,
   `docs/README.md`, `docs/future-model.md` and `docs/ROADMAP.md`, and refuses a line with a Claude model id, a
   value Codex's home holds or held (its `was`), a model's display name with its version, or a level beside the
   word effort, outside a list of dated lines that only shrinks (a conclusion of a past measurement, the sample of
   an attribution line). Help texts that must show the value print it from the home. The writer's agent file is
   not one of these texts: it is the copy the switch writes and its own test compares. The patterns of the rules
   that leave do not leave with them: each retirement carries its wordings (a sub-agent, a writer, a reader, a
   verifier, `effort: "<level>"`) onto the home's rule by a form change, with its planted case, so the skills' texts
   and the feature documents above their Log stay scanned as today. The test's search for a value Codex's home
   holds or held also reads the feature documents above their Log, since the patterns find only an id shaped as
   `{amount}` knows one (a hyphen and a digit).
5. A start and a resume take the home (S2, S3, S5). `sessions start` with no `--model` or `--effort` passes the
   home's where the home is in force; `--resume` with no flag passes the home's and never the record's; a `--model`
   or an `--effort` other than the home's is refused, lower as well as higher. The guard refuses a `start_session`
   that does not name the home's model and the home's effort, both written out, since what a start does not name
   it takes from the session that starts it; and one from a session whose own app record holds another model or a
   lower effort than the home's, since the tool's own words cap a start at its starter. Every such refusal names
   the way out, `js-harness sessions start`, which starts by the CLI with the home's values and is capped by no
   session, and a test holds that sentence. A model is compared with its date suffix and any bracket taken off,
   with a test for each shape the real records hold. A starter whose record is missing or unreadable is not
   refused, and is shown: the board and `doctor` mark a session with no readable record. Whether the tool takes a
   full id is not known (no call of the lead named a model): the protocol names it as the first thing to check
   the first time a start is refused for it. The guard also refuses a sub-agent call that names an effort, a
   level or `lower` or `higher`: a call that names none runs at its session's, which is the home's.
6. The sessions off the home (S3). `rules applied` lists every session, desktop or background, that differs from
   the home, and says what each source gives: for a desktop session the app record's model and effort and whether
   it is archived (he can unarchive one, and the record does not say whether an open one is running); for a
   background session the model and the recorded effort of its last reply beside what its start asked,
   where a start that named none says so, and its job's state as `claude agents` gives it, or that the harness
   removed it. It says of each which act corrects it: the lead's session tools, a resume, his menu, or none. It
   reads the records and writes none.
7. The session that cannot change itself (S5). The board marks any row whose app record differs from the home,
   says both levels where the app record and the last reply disagree (the menu's, and the recorded one), and for
   the session that reads it prints the line to give him; `doctor` has the same row. The line is modelled on the
   one he acted on, in the words his menu shows: "En esta sesión, abre el selector de modelo que está junto a la
   caja donde escribes y elige <modelo> con esfuerzo <nivel>", which for today's home reads "elige Fable 5.2 con
   esfuerzo Alto". The model's name is derived from its id (family and version) and the level from one map in
   `model-home.mjs`, whose Medio, Alto and Extra alto are his words and whose two ends are assumed. The `doctor` row also reads, and never writes, what his settings say that the home does not:
   the default model, the effort and its cap in his user settings, the entry of the home's model under
   `modelSettings`, and the project's `effortLevel`; today it would say that his default model is `opus[1m]`, a
   short name and not the home's, which a session started outside the harness runs on.
8. The switch (S1). `js-harness rules switch [--claude <model>@<effort>] [--codex <model>@<effort>] --quote
   <session>:<line> [--quote ...] --reading "<what his words mean>" --accepted "<where he accepted it>"`, run from
   a checkout of a `rule/` branch as `rules change` is. It first asks each new model one short question with the
   installed CLI at the effort given, saying the cost before, and writes nothing when the CLI refuses the id or
   the level, when another model answers, or when Codex is at or under its weekly floor. The question is asked as
   the lenses ask theirs, with no tools, no session kept and a temporary folder, so it leaves no record a listing
   would count. It proves which model answered and that the CLI took the level; the effort the model then works at
   is not proven, and the printout says so. Then it writes the rules of the homes named in one pass, the half of a
   home that does not change skipped and named, each with his words as its source, and the writer's agent file, and prints the
   commit to make with what the probe answered (model, CLI version, day). `rules change` refuses a new value for a
   rule of a home and names the switch, so no home changes untried. It prints what is left outside the
   repository: each open desktop session off the home with the session tool that sets it, the session that only
   he can change, the background sessions and what a resume does, what his settings hold that the new home does
   not (a cap below the new effort, a default model, no `modelSettings` entry), and the installed copy to refresh
   at the land. It also prints what a new model may make stale and no rule holds, each found by a check and not
   listed by hand: the context window the board assumes (`DEFAULT_CONTEXT_WINDOW`, `bin/lib/sessions.mjs:25`), a
   family name the commit-message hook does not know (`HOST_NAME`, `bin/commit-msg.mjs:31`), a model with no row in
   `evals/prices.mjs`, and the evals' default model where it is another. `--dry-run` probes nothing, prints and
   writes nothing. The probe tries the CLI only: that the app's `start_session` and `set_session_model` take the
   new id is not tried by any command, and the protocol says so.
9. The protocol (S1). A section of the orchestrator skill, "A new model", beside "Before a reinstall": the sentence
   he types, the branch, the switch with its probe, the commit, the gate and both reviews run from the branch's
   copy so Codex reviews the slice on the new model, the meter, his yes, the land with the installed copy
   refreshed, then the sessions, each set with the session tools and checked with `rules applied`.
   `docs/future-model.md` stays the measuring and points to it.
10. Codex's side, prepared and not switched (S4). `review-model` and `review-effort` are the second home, never
    mixed into Claude's; the switch and the probe take them; the patterns of the two rules lose their `gpt-` and
    find any id of the shape `{amount}` knows that is not Claude's, by a form change with a planted case; an id of
    another shape is found by the convention test, which searches the home's values as they are written, with a
    planted case of an id that has no hyphen and no digit; the protocol says what is checked the
    day before a Codex switch lands: the id the installed `codex` takes (the probe, one cheap call, said before it
    runs), that `js-harness codex-meter` still reads its limits, and that a review of one small slice runs end to
    end from the branch's copy. It also says what a Codex switch does to the figures: the plan of a review
    estimates from every measured part until five parts exist on the new model and effort
    (`bin/lib/codex-review-plan.mjs:107-115`), so its first estimates come from the model that leaves, and
    `rule:codex-review-rate`, `rule:codex-review-floor` and the double review's `MEASURED_COST`
    (`bin/double-review.mjs:71`) were measured on it.

## Tasks
- [x] T1 (kind: design) (1-10) This document, its depth pass and the inventory, committed with documents alone. Route: inline, with one read-only explorer for the inventory. Commit: f325a56e.
- [x] T2 (kind: design) (1-10) The double review of this design (`js-harness double-review read`), every finding answered, and one notice to the lead with its verdict. Route: inline. Commits: 0907ed7d, 9033dcf6, 649fbad1. Three reads, not passed; the lead's yes to build from L13 (L14).
- [ ] T3 (kind: build) (2, 3) Pull request 1, branch `feat/model-home-module`, cut from T2's commit: `bin/lib/model-home.mjs` and its test; the faults of the homes in `readRules`; the lenses and the double review's fallback and effort read the home; the writer's agent file compared with the home; the convention test over code; the runner of `rules change` takes `--with <path>...`, with its tests beside `bin/lib/rules-change-run.test.mjs:159` and `:172`; the check of marks stops at a document's `## Log`, as the scan of restated values does (`bin/lib/rules-scan.mjs:11`), since a Log tells what a rule was called. No reader of a rule that leaves moves here. Route: inline.
- [ ] T4 (kind: build) (1, 2, 5, 10) Pull request 2, branch `rule/one-model-home`, on main once pull request 1 lands: `rules change --with` nine times, a commit each, every commit with the readers, the tests, the marks, the patterns carried to the home and the planted break of its rule: the two subjects widened, each home's control made a bundle; `lead-effort` and `subagent-effort` retired with the guard's start held to the home's effort alone; the two sub-agent model rules and `escalation-model` retired with the guard, the double review, the contract's modes, the sub-agent row and the recheck reading the home; the guard's refusal of a sub-agent call that names an effort; the patterns of Codex's two rules. Before each retirement, its dry run, and a grep of its id as a bare word over `bin/`, `workshop/`, `.claude/agents/`, README, `docs/` and `odd/tasks/` above each Log. Then an independent verifier on the guard. Route: inline, then one verifier.
- [ ] T5 (kind: build) (5, 7) Pull request 3, branch `feat/model-home-sessions`: a start and a resume take the home and refuse another, in `sessions start` and in the guard's `start_session`, with the starter's own record; `appSessions` gives the model; the board's mark, both levels and the line. Route: inline.
- [ ] T6 (kind: build) (6, 7) Pull request 3: `rules applied` lists the sessions off the home from the app's records, the record of starts, the last replies and the jobs; the `doctor` row with his settings read. Then the list goes to the lead in one notice. Route: inline.
- [ ] T7 (kind: build) (8, 10) Pull request 4, branch `feat/model-home-switch`: the runner of `rules change` writes several rules in one pass and refuses a home's value alone; `rules switch` with its probe, the agent file, `--dry-run` and its printout. Route: inline.
- [ ] T8 (kind: docs) (4, 9, 10) Pull request 4: the section "A new model" of the orchestrator skill and its test; the convention test over the texts; README, `docs/ROADMAP.md`'s Decided rows, `docs/future-model.md`'s pointer, the help texts and the lead's start line name the rule. Route: inline.
- [ ] T9 (kind: verify) (1-10) Each pull request: gate, Codex and the pertinent lenses, one at a time; ready; `js-harness notify --to orchestrator --kind ready --pr <n>`; the next one starts from main once it lands. Then the summary and the closed notice. Route: inline.

## Next step
State at 2026-11-11 01:30 local, written at the context pause (86 percent). Nothing but documents is committed;
`origin/rule/one-model-home` holds them, `ec737551` and this commit. `js-harness wait --notice-to 172` runs.
Next, in order:
1. Cut `feat/model-home-module` from this branch's head (`git switch -c`), the branch of pull request 1 (T3).
2. Tests first, then code, one work unit a commit: (a) `bin/lib/model-home.mjs` with `bin/lib/model-home.test.mjs`:
   the ids of both homes, `claudeHome()` by `ruleOf`, what a guard holds (`guardHeld(ruleHere(...))`), the list of
   levels moved from `bin/lib/guard.mjs:73`, the menu's Spanish names and the display name of an id; (b) the faults
   of the homes in `ruleFaults` of `bin/lib/rules.mjs` (after line 264), tests in `bin/lib/rules.test.mjs`;
   (c) `LENS_MODEL`, `LENS_EFFORT` (`bin/lens-review.mjs:33`, `:36`) and `CLAUDE_FALLBACK`
   (`bin/double-review.mjs:68`) read the home, `workshop/bin/host-watch.mjs:288` through the module;
   (d) `rules change --with <path>...` in `bin/lib/rules-change-run.mjs` (the refusal at `:229-235`), tests beside
   `bin/lib/rules-change-run.test.mjs:159`, `:172`; the check of marks cuts at `## Progress` or `## Log`
   (`bin/rules.mjs:133-147`); (e) `bin/conventions-model-home.test.mjs` over code, with `ratchet` and
   `sourceModules` of `bin/lib/*.testkit.mjs` as `bin/conventions-errors.test.mjs` uses them. The writer's test and
   every reader of a rule that leaves stay as they are until T4.
3. `npm run check`; then, one at a time and their cost said first, `js-harness codex-review --base <the commit
   before the first code commit> --doc odd/tasks/one-model-home.md` and `js-harness lens-review --base <same>
   --lenses <pertinent> --reason <why> --doc odd/tasks/one-model-home.md`; fix or answer; push; `gh pr create`;
   `js-harness notify --to orchestrator --kind ready --pr <n>`.
4. The pull request's body says in plain words, for him, that the design did not pass three double reviews, the
   two high findings of the third (L13: Claude 1 with Codex 1, and Claude 2) and the answer to each; and that the
   lead said yes to building from L13 (L14).
Open with the lead, not blocking pull request 1: one `start_session` that names the home's model, and whether
the switch may write a home's rules in one commit.

## Inventory
Where a model or an effort is named, read on 2026-11-11 at `7525a4e5`. The table of pull request 813 was the start;
each row was read again. "Reader" means the value comes from a rule; "by hand" means it is written in the file.

| Place | Today | Becomes |
|---|---|---|
| rules `session-model`, `session-effort` (`bin/lib/rules-data.mjs:692`, `:660`) | claude-fable-5-2, high; "the model a session runs on" | the Claude home, subjects widened (T4) |
| rules `lead-effort`, `subagent-effort` (`:321`, `:758`) | high, high | retired into `session-effort` (T4) |
| rules `subagent-writer-model`, `subagent-reader-model`, `escalation-model` (`:787`, `:770`, `:229`) | claude-fable-5-2 each | retired into `session-model` (T4) |
| rules `review-model`, `review-effort` (`:549`, `:538`) | gpt-6.1-sol, medium; patterns that ask for `gpt-` | the Codex home, values unchanged, patterns freed of the prefix (T4) |
| `bin/lens-review.mjs:33`, `:36` `LENS_MODEL`, `LENS_EFFORT` | by hand | readers of the home (T3) |
| `bin/double-review.mjs:68` `CLAUDE_FALLBACK`, `:312` | by hand, beside a read of `subagent-reader-model` | reader of the home: the constant in T3, the rule read in T4 |
| `bin/codex-review.mjs:204-205` `REVIEW_MODEL`, `REVIEW_EFFORT` | readers; the double review's Codex reader imports them (`bin/double-review.mjs:31`, `:189`) | unchanged: the Codex home's one read |
| `bin/lib/guard.mjs:16-22`, `:88-96`, `:112` | reader of four rules; a level at or below passes | reader of the home; the home's level alone passes (T4) |
| `bin/lib/guard.mjs:73` `EFFORTS` | the levels a host takes, by hand | moves to `model-home.mjs`, the one list of levels (T3) |
| `bin/rules.mjs:389-398` `heldRules` | reader of five rules, two by a variable | reader of the home (T4) |
| `bin/check.mjs:1638`, `bin/lib/subagent-check.mjs:136`, `:163`, `:176` | reader of three sub-agent rules by a variable | reader of the home (T4) |
| `bin/lib/contract.mjs:288-307` `MODE_RULES`, `bin/contract.mjs:335-358`, `bin/resume.mjs:976-985` | name four rules by a variable, which `rules check` does not see: a retired one would throw when the line is printed | name the home; the line of a task's mode says one model and one effort (T4) |
| `bin/lib/contract.mjs:46` `EFFORTS` | `medium`, `high`: the levels a document's optional `## Effort` section may name | stays: what a document may ask, not what runs |
| `bin/lib/codex-review-recheck.mjs:39-40` | reader of `escalation-model` | reader of the home (T4) |
| `bin/sessions-background.mjs:184`, `:307-308` | passes what it is given; a resume the record's | the home's when none is given, another refused (T5) |
| `bin/lib/sessions.mjs:3058` | `effort below high`, the level by hand | a mark against the home (T5) |
| `bin/lib/app-record.mjs:91` | reads the app's effort, not its model | reads both (T5) |
| `workshop/bin/host-watch.mjs:288` | reader of `session-effort` by `ruleOf` | reader through the module (T3) |
| `.claude/agents/js-harness-writer.md:5-6` | `model: claude-fable-5-2`, `effort: high`, by hand, compared by a test with the rules that leave | a copy the switch writes, compared with the home (T3, T7) |
| his user settings: `model`, `maxEffortLevel`, `modelSettings` | `opus[1m]`, `high`, an entry for Opus 5.5 alone | his; read by `doctor` and the switch, never written (T6, T7) |
| the project's `.claude/settings.local.json` `effortLevel` | `high`, in a file git ignores | read by `doctor` and the switch, never written (T6, T7) |
| `bin/lib/manifest.mjs:156` (the lead's text) | `sessions start ... --effort <level>` | the flag leaves the example (T8) |
| `bin/lib/protocols-skill.mjs:43`, `:102`; `bin/guard.mjs:10`, `:56`, `:157`; `bin/sessions-background.mjs:6`, `:32`; `bin/codex-review.mjs:15`; `bin/lib/hook-entries.mjs:72`; `bin/lib/session-title-guard.mjs:11`; `README.md:214`, `:1060`, `:1324`, `:1657`, `:1711`; `docs/SPEC.md:636`, `:744`; `docs/ROADMAP.md:72`, `:723`, `:806`; `bin/lib/manifest.mjs:62`; `bin/double-review.mjs:65`, `:303`; `.claude/agents/js-harness-writer.md:4`; `odd/tasks/f8-s7-topology.md:29`, `:36`, `:96`; `odd/tasks/memory-notes.md:70`; `odd/tasks/onboarding.md:873`, `:897`, `:921`; `odd/tasks/double-review-alignment.md:319` | name a rule that leaves, by a mark or as a bare word | name the home, in the commit that retires the rule (T4) |
| `odd/tasks/double-review-alignment.md:396`, `odd/tasks/workshop-product-split.md:683` | a mark of a rule that leaves, inside a Log | stay: the check of marks stops at the Log (T3) |
| the two home rules' planted breaks, `bin/lib/rules-coverage-data.mjs:61`, `:63`, and the Read-by list pinned at `bin/rules.test.mjs:460` | one break each, on a read the module replaces | a bundle of breaks, one a consumer (T4) |
| tests that read a rule that leaves by its id: `bin/lib/guard.test.mjs:226`, `bin/guard.test.mjs:112`, `bin/sessions-background.test.mjs:681`, `bin/lib/codex-review-recheck.test.mjs:219`, `bin/double-review.test.mjs:145`, `bin/lib/protocols-skill.test.mjs:146` | would read `undefined`, or throw, after the retirement | read the home, in the commit that retires the rule (T4) |
| `bin/lib/subagent-count.mjs:57` | a launch on a haiku model counts as a writer | stays: it classifies recorded launches of the days a writer ran on Haiku, and gives nothing started now its model |
| `bin/commit-msg.mjs:31` `HOST_NAME` | the family names of a host's attribution line | stays; the switch says when the new id's family is not in it (T7) |
| `bin/lib/sessions.mjs:25`, `:37` | the model's context window and the app's compaction share, by hand | stay; the switch names the first as a value to read again on a new model (T7) |
| `bin/double-review.mjs:71` `MEASURED_COST`; rules `codex-review-rate`, `codex-review-floor`; `bin/lib/codex-review-plan.mjs:107-115` | measured on the models of today; the plan estimates from every part until five exist on the pair asked | stay; the protocol says what a switch does to them (T8) |
| `README.md:1070`, `:1293`, `:1334`, `:1015` (a sample of output) | values restated | name the rule; a sample shows `<model>` (T8) |
| `docs/ROADMAP.md:68`, `:72`, Decided rows "Review model" and "Effort" | values restated, `:72` stale: Opus 5.5, Haiku 5.5 for writers | name the rules: `:72` in T4, since it marks rules that leave; `:68` in T8 |
| `README.md:1812`, `:1824-1825` | "Claude Opus 5.5" as the sample of an attribution line the hook removes | stay, on the test's list: the name of a host in a sample, not a pick |
| tests that write today's value: `bin/lens-review.test.mjs:391`, `bin/double-review.test.mjs:136`, `:175`, `bin/rules.test.mjs:285`, `:409`, `:412`, `bin/resume.test.mjs:1881`, `bin/contract.test.mjs:620-657`, `bin/lib/sessions.test.mjs:2429-2432`, `bin/sessions.test.mjs:1472`, `bin/lib/writer-agent.test.mjs:32-33` | red the day a value changes | read the home (T3, T4, T5) |
| each retired rule's other records: `docs/rule-sources.json`, its planted break in `bin/lib/rules-coverage-data.mjs`, its entry of `PLANTED` in `bin/lib/rules-scan.test.mjs:56-87` | one a rule | move with the retirement (T4) |
| `scripts/practice.mjs:272`, `scripts/rehearsal.mjs:248` | `claude-haiku-5-5`, a rehearsal host under a cap of 0.5 USD a run | stay, on the convention's legacy list with that reason; his to decide (Ask me before, 2) |
| `evals/configs.mjs:314` `SUBAGENT_MODELS` | `sub-opus`, `sub-haiku`: the arms of a measurement, named by their model | stays: an arm named for a model cannot read another |
| `evals/suite.mjs:65`, `:69` `EVAL_MODEL`, `CODEX_EVAL_MODEL` | the default of a new eval run with no `--model`: the model of the recorded baseline | stay; the switch says when they differ from the home; his to decide (Ask me before, 3) |
| `evals/prices.mjs`; `evals/report.mjs`; `evals/isolation-probe.mjs:56-57`; `evals/codex-isolation-probe.mjs:60-61` | list prices by id, and the model a recorded probe was made on | stay: measurements made |
| `evals/results`, `docs/sessions`, `docs/origin.md`, `docs/model-effort.md`, `docs/workshop.md`'s sample, fixtures | history | stay |

## Log
- L1. His request as written: S1 to S5 above, read from the transcript on 2026-11-11.
- L2. The brief's reading (the lead, JH ORQ): points 1 to 5 of the brief named in this document's first lines.
- L3. Evidence against the brief, 2026-11-11. (a) His line on Codex is 6185, not 6183. (b) "The lead ran at xhigh
  for hours": the app's record said `xhigh`; the lead's transcript says `high` on every one of its 1077 replies of
  those days, and his user settings cap the effort at high. That the engine ran at high is assumed from the two.
  (c) "48 background jobs keep the model and effort they were started with in their record":
  `claude agents --json --all` gives 43 jobs with no model and no effort; the record that holds them is the
  harness's own, where 108 of 124 starts name no model. (d) `SUBAGENT_MODELS` of `evals/configs.mjs` is not a
  constant to unify: its two keys are the arms of a measurement (`sub-opus`, `sub-haiku`).
- L4. Decision, this session: the home is the two session rules widened, not two new ids. `rule:reuse-first`: the
  guard, `rules applied` and the host watch already read them, and two new ids would retire seven rules instead of
  five and rename every one of those readers for no change of behaviour. Cost: the ids say "session" for what the
  lenses and sub-agents run on; their subjects say the rest.
- L5. Decision, this session: `escalation-model` retires into `session-model` and the recheck's line keeps naming
  the model the rules give, which changes nothing of what a session is told today, since both rules already hold
  the same id. Whether the step stays is his (Ask me before, 5).
- L6. Decision, this session: the level check sits on the board and in `doctor`, not only at a start. The lead of
  2026-11-10 had started on 2026-10-27; the home changed under it, so a check at its start alone would never have
  run that day. The lead reads the board at its start and on every wake.
- L7. The inventory, 2026-11-11: one read-only explorer read every place a model or an effort is named (126 tool
  calls); its result is the table above. Checked of it before it was used: `bin/lib/subagent-count.mjs:57`,
  `bin/lib/contract.mjs:46`, `bin/lib/sessions.mjs:25` and the four README lines, each by a grep of this session.
  Not checked: its counts of the history folders. The host compacted this session at 00:15 local, after this
  document was written and before its first commit.
- L8. Measured, 2026-11-11, from the transcripts of this session's two sub-agent launches, neither given a model:
  the `general-purpose` explorer ran on `claude-fable-5-2` at high, the session's; the `claude-code-guide` one ran
  on `claude-haiku-5-5` at high, the model its type sets. So "every sub-agent" holds for the types that inherit
  and for the one the harness defines, and not for a host's type that sets its own.
- L9. The double review of this design, read `5e3c5c7d-5acc-4157-9f3d-01c2f45a199b`, 2026-11-11, on the copy of
  `f325a56e`: a Claude reader on claude-fable-5-2 (11 findings, 1,066,465 tokens) and a Codex reader on gpt-6.1-sol
  (7 findings, 1,745,095 tokens), blind. Verdict: the design stood in its aim and changed in fifteen places; three
  findings were high. What each changed, and what was rebutted:
  - Claude 1, Codex 5 (the lint for texts did not exist; the scan leaves out four of the surfaces; no check for an
    effort at a launch): taken. Spec 4 is now a convention test over nine named texts, with today's count of 18
    lines as its start, and spec 2's test also refuses a level at a launch. Rebutted in part: the rules' own
    patterns are not widened and not turned to refuse, since the test already refuses in the gate and a second
    refusal of the same line is a second home for one check.
  - Claude 2 (the slices broke the coverage register and left five live rules read by nothing through three pull
    requests): taken. A rule's readers and break now move in the commit that retires it (a constraint, with the
    precedent `238ee185`), and all nine rule changes are one pull request.
  - Claude 3, Codex 1 (a start at or below the home kept medium legal): taken. Spec 5 refuses any level but the
    home's, in `sessions start` and in the guard, and a `start_session` from a session whose own record holds
    another model or a lower level.
  - Claude 4, Codex 2 (a writer that inherits follows a parent that is off the home): taken for the writer, whose
    file keeps a full id and a level that the switch writes and a test compares; and the launches were measured
    (L8). Rebutted in part: `rules applied` does not fail on a launch of a host's type that sets its own model,
    which L8 shows exists; and a sub-agent launch from a session off the home is not refused. He asked that the
    level be seen and corrected; a refusal would stop every launch of a lead whose level only he can pick, for as
    long as he is away, and is a new behaviour that is his to ask for (Ask me before, 6). What stays unguaranteed:
    an inheriting sub-agent of a session that is off the home runs off the home until that session is corrected.
  - Claude 5 (the host's settings were in no inventory and may explain the incident): taken. Three keys read; the
    cap at high is now in the refutation as the assumed cause, spec 7 says which source the mark follows and
    prints both, and `doctor` and the switch read the settings. Not run: a session set above the cap to see its
    stamp, since no open session's level is this work's to change.
  - Claude 6, Codex 3 (his "cambies de una vez en todas las sesiones" had no closing condition; three exceptions
    were decided for him): taken. Done when holds the notice that hands the list to the lead, and Ask me before
    names six exceptions. Rebutted in part: `escalation-model` is not held back for a question, since the brief
    reads his words as covering it and its retirement changes nothing a session is told (L5).
  - Claude 7 (the Codex switch was not one commit; the probe was a separate step; no reading): taken. The patterns
    of Codex's rules lose the prefix now, the probe runs before any write at the effort given, `rules change`
    refuses a home's value alone, `--reading` is asked for, and `review-model` has a fault of shape. Rebutted in
    part: no record of a probe is asked of every value in the tree, since the values of today were never probed
    and the refusal sits at the one moment a value changes.
  - Claude 8 (Done when did not cover the bar): taken, a line for each spec's test.
  - Claude 9 (a start record with no model): taken, spec 6: the last reply is what ran, the record what was asked.
  - Claude 10 (the depth pass stretched the stored reading): taken, item 1 and spec 1 name the new source and its
    reading.
  - Claude 11 (marks and bare names the inventory missed; the branches): taken, one inventory row and T4's grep,
    and the tasks say where each branch is cut. Rebutted in part: no test refuses a retired id as a bare word in
    code, since a comment that tells what a rule was names it rightly.
  - Codex 4 (the plan's estimate after a switch was described wrongly): taken, spec 10 says what
    `bin/lib/codex-review-plan.mjs:107-115` does.
  - Codex 6 (the listing promised what the records cannot say): taken, spec 6 gives each source's own words and
    claims no state the records do not hold.
  - Codex 7 (the evals' defaults are not history): taken, their row is apart and they are his to decide.
- L10. The lead's notice, 00:29 local on 2026-11-11: his message on Codex is line 6185; and, by the lead's account
  of his line 6716 (00:26), he let the lead land what gets ready while he is away about ten hours, so a `ready`
  goes out as soon as a pull request is ready and each lands alone. Not checked by this session beyond the notice.
- L11. The confirming read of the corrected design, read `75e3c984-ffec-4c8e-a926-4b4f0e125eb8`, on the copy of
  `0907ed7d`: Claude 11 findings (2,932,508 tokens), Codex 7 (2,046,887 tokens), three high. All real; what each
  changed:
  - Claude 1, Codex 1 (the retirement in one commit cannot run through `rules change`): taken. Checked with a dry
    run of the five, after merging `origin/main` (`12bd856c`): each is refused for its readers, in the command's own
    words ("bin/lib/guard.mjs: reads rule "lead-effort", which has no value"). The runner gets `--with` in pull
    request 1, and the wrong precedent is gone from the constraint.
  - Claude 2 (marks in feature documents, the roadmap's line 72, two marks inside Logs): taken, from the same dry
    runs: the inventory names them, `:72` moves to T4, and the check of marks stops at a Log.
  - Claude 3 (the home's own planted breaks vanish behind the module): taken, a bundle of breaks, one a consumer.
  - Claude 4, Codex 4 (the patterns of the rules that leave left the skills' texts and the feature documents
    unscanned): taken, against L9's rebuttal, which was wrong: each retirement carries its wordings to the home.
  - Claude 5, Codex 3 (no closing condition after the lead acts; two exceptions missing): taken. Done when asks a
    second run; exceptions 7 and 8; a first list went to the lead from a scratch read (L12).
  - Claude 6, Codex 6 (the cap as cause could be tested on the past; a stamp is not what ran): taken. Measured:
    97,331 stamps at `high` and none above it in 126 transcripts since 2026-10-12, sessions the app showed at max
    among them. The stamp is now called the recorded effort, and what the engine worked at stays not known.
  - Claude 7, Codex 5 (a refused start was a dead end; an unreadable record failed open unseen): taken. The refusal
    names `sessions start`, a start names the home's model and effort outright, and a missing record is marked.
  - Codex 2 (a sub-agent call may name another effort): taken, the guard refuses one that names any.
  - Codex 7 (dropping `gpt-` does not find an id of another shape): taken, the convention test searches the values
    as written.
  - Claude 8, 9, 10, 11 (the line in his menu's words; `npm run check` and the tests that read a leaving rule; a
    half of a home that does not change, and the probe's flags; three wrong figures in Why and the bar): taken.
- L12. A scratch read for the lead, 2026-11-11 01:00 local, not the command of spec 6: `claude agents --json --all`
  gave 46 jobs, 16 not done. The starts of six asked for `claude-fable-5-2` at high. The starts of eight, stopped
  or blocked, asked for high and named no model (JH 126, 130, 134, 137, and two rows each of JH 160 and 166); what
  they ran on was not read from their transcripts. Two have no start record (JH 65, and the lead's own row). The
  four open desktop sessions read `claude-fable-5-2` at high in the app's records. The notice of 01:02 said the
  eight "ran on the host's default, opus[1m]": that was an inference from his settings, sent as a fact (L13).
- L13. The third read, `782a1dff-56c5-4425-9bb5-c972ab5359ec`, on the copy of `9033dcf6`: Claude 12 findings
  (3,175,121 tokens), Codex 5 (2,935,470 tokens), two high. The design did not pass in three reads, so by section 1
  of the protocols it goes to him as a problem, through the lead (a `waiting` notice of 2026-11-11), and no fourth
  read runs. No code is written until the lead answers. The answers, which amend the specs:
  - Claude 1, Codex 1, high (a second run of `rules change` on a home's id starts again from `origin/main`'s
    declaration and would undo the widening; `--with` does not carry a change of another declaration): taken. The
    order is one run an id, never two: first `session-model` and `session-effort`, each run carrying the widened
    subject, the new source and every pattern the rules that leave hold today; then the five retirements, each with
    `--with` for its readers; then Codex's two. For a few commits a wording is found by two rules, which only
    counts. `bin/lib/rules-scan.test.mjs`'s `PLANTED` takes several lines a rule. A test runs the whole order in a
    fixture and holds every step's list and the last one's patterns.
  - Claude 2, high (the guard would refuse every `start_session` that does not write a full id nobody has tried,
    and its way out sends starts to the background against `rule:sessions-open-in-sidebar`): taken. The guard asks
    for the home's effort written out and refuses a named model other than the home's; it does not ask for the
    model until one `start_session` of the lead that names the home's id is recorded here with the new session's
    `get_session` answer. A start from a session off the home is refused with who corrects that session (the
    lead's session tools, or his menu for the lead), and names `sessions start` only as the way where a card is
    enough.
  - Claude 3 (the escalation line outside this repository): taken. It reads the home's declared value wherever it
    runs, as the lenses do, with a test for a project that installs the harness; pull request 2's body says the
    shipped hash changes, since `escalation-model` is the one rule of the five with no scope.
  - Claude 4 (refusing the home's own level on a sub-agent call): taken. A call that names the home's level
    passes; another level, `lower` and `higher` are refused; its break joins `session-effort`'s bundle.
  - Claude 5 (the count gave nothing below high): taken. By level, every assistant entry parsed, 126 transcripts:
    high 97,431, medium 16 (two transcripts), low 10 (four), none above high, 22 with no stamp. The stamp varies
    below the cap and never above it, so it stays in specs 6 and 7 as the recorded effort. The cap was in his
    settings in October too (`docs/sweep-2026-10-11.md:177`), and his words of `odd/tasks/harness-review.md:100`
    on the usage spent bear on what the engine worked at, which stays not known.
  - Claude 6 (the leave to land was not checked): taken, S6. Which merges his words cover is the lead's to read;
    pull request 2 changes seven rules of his and the guard, and its `ready` notice says so.
  - Claude 7 (the switch's one commit against `AGENTS.md`'s sentence, with no path for a no): taken. The question
    is in the `waiting` notice. On a no the switch still is one command and prints one commit a rule, in order;
    both are tested. The runner's closing line is changed to say a home's rules land in one pull request.
  - Claude 8 (a third `gpt-` in the pattern carried from `subagent-effort`): taken, its exclusion becomes a line
    that names codex or the review, with a near miss planted on an id with no `gpt-`.
  - Claude 9 (no check knows a model's context window; `autoCompactWindow` unread): taken. The window is a
    reminder the switch always prints; `doctor` and the switch also read `autoCompactWindow`.
  - Claude 10, Codex 3 (the two isolation probes start real runs on their defaults): taken, they join exception 3
    and the switch names them when they differ from a home. `evals/` stays outside the convention test: its
    models are what a measurement was or will be made on, and `docs/future-model.md` owns changing them.
  - Claude 11 (six small disagreements): taken. The bar's count is over eight texts; the writer's test keeps
    reading the rules that leave until their commit in T4; the check of marks cuts at `## Progress` or `## Log`;
    `session-effort-<kind>` of `bin/lib/contract.mjs:288-307`, which no rule declares, stops being looked up in
    T4; the tests of `bin/lib/subagent-check.test.mjs`, `bin/lib/contract.test.mjs:321-323`,
    `bin/contract.test.mjs:17-18`, `bin/check.test.mjs:5596`, `:5630` and
    `bin/lib/session-title-guard.test.mjs:54` are read in T4; the bar's "7 more" is 8 with the testkit.
  - Claude 12 (lists that "only shrink" with nothing that holds it; the Codex probe's proof): taken. The lists use
    `bin/lib/ratchet.testkit.mjs`, as the other convention tests do. For Codex the probe proves that the CLI took
    the id and the level, and names the model only where `codex exec --json` gives it.
  - Codex 2 (the close allowed sessions still off the home): taken. The second run lists none that can run, or
    each one left is an exception he accepted or an item the summary leaves open by name.
  - Codex 4 (L12 turned what a start asked into what ran): taken, L12 is reworded.
  - Codex 5 (a tool list of `docs/host-updates/` names the wrong CLI build): rebutted for this document, on
    evidence: the file came with the merge of `origin/main` (`12bd856c`) and is JH 174's; it is passed to the lead.
- L14. The lead's answer, 01:24 local on 2026-11-11, to the `waiting` notice of 01:21: yes to the recommended way, by his lines 6716 and 6905 ("contesta TODAS las preguntas con recomendado TODAS y avanza los mas posible eres completamente autonomo", read with `js-harness sessions --quote`). No fourth read; build from L13, pull request 1 first, each through Codex and the lenses against this document; each body says in plain words that the design did not pass three double reviews, the two high findings of the third and the answer to each; a part a high finding disputes waits for the pull request that answers it.
- L15. Pull request 1, unit (a), 2026-11-11: `bin/lib/model-home.mjs` and its 8 tests, on `feat/model-home-module`. The test and the module were written in one step, so the test was not seen to fail first. Next: units (b) to (e) of "Next step".
- L16. Pull request 1, unit (b), 2026-11-11: `homeFaults` in `bin/lib/model-home.mjs`, read by `ruleFaults` of `bin/lib/rules.mjs`; seven tests in `bin/lib/rules.test.mjs`, three of them seen to fail first (`fable`, a level that is none, a Claude id as Codex's model). Two things differ from spec 3 as written: an empty value keeps the one fault every value already has ("the value is not a number or a text") and gets no second one; and `rules.mjs` and `model-home.mjs` now import each other, used only inside functions, each loaded first once to prove it (`node -e "import('./bin/lib/model-home.mjs')"`, `node -e "import('./bin/lib/rules.mjs')"`); `bin/` already held five such cycles, all through `bin/lib/manifest.mjs`. The session was compacted by the host at 01:53 local; nothing was lost, unit (a) was committed. Next: units (c) to (e).
- L17. Pull request 1, unit (e) before (c), 2026-11-11: `bin/conventions-model-home.test.mjs` over the code of `bin/`, `workshop/` and `scripts/` (7 tests). It came before unit (c) so that (c) has a test that is red first: its legacy lists hold `bin/lens-review.mjs` and `bin/double-review.mjs`, and the ratchet refuses a listed file that complies. Measured with it today: four modules write a model id as a value (those two, and `scripts/practice.mjs` and `scripts/rehearsal.mjs`, which stay listed as his to decide) and one writes an effort at a launch (`LENS_EFFORT`). The half over the texts is T8's. Next: units (c) and (d).
- L18. Pull request 1, unit (c), 2026-11-11: `LENS_MODEL`, `LENS_EFFORT` (`bin/lens-review.mjs`) and `CLAUDE_FALLBACK` (`bin/double-review.mjs`) are reads of `claudeHome()`; `workshop/bin/host-watch.mjs` reads the effort through the module; `bin/lib/guard.mjs` takes `EFFORTS` from it. Seen red first: the convention test, with the two files off its legacy lists, named both. The legacy list of efforts is empty; the one of models holds the two rehearsal scripts. Run one file at a time, all green: `bin/lens-review.test.mjs` 23, `bin/double-review.test.mjs` 22, `bin/rules.test.mjs` 37, `bin/lib/guard.test.mjs` 45, `workshop/bin/host-watch.test.mjs` 13. Next: unit (d), `rules change --with` and the cut of the marks at `## Log`.
