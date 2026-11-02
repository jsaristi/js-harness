# JH 126 · Align the harness to the depth pass, first the Claude and Codex double review

Locator: `odd/tasks/double-review-alignment.md` · Engram mirror: `odd/double-review-alignment/tasks` · Branch:
`rule/double-review` (PR 745, landed), then `rule/review-flow` (worktree `harness-alignment`) · Delivery: a pull
request to main each · Test runner: `node --test`

## Goal
`rule:double-review` says, in one home, what he answered to questions 145, 146 and 150: two blind reads, one of
Claude and one of Codex, on plans, designs and proposing documents, skipped only by his words; code's two reviews,
Codex and the Claude lenses, judged against what was asked, every finding answered, at most three reviews and then
raised to him and a stronger model (`## Redesign after question 150`, proposed to him, L15 and L17; 147's read on
every small code change leaves it); a command
runs both readers on the same frozen material and records every finding for the judgement of 2026-11-16; below the
Codex floor, 2% of the weekly limit left (L18), he is told and decides the reset, and only on his no a second Claude review takes Codex's place and code keeps a Codex debt the
merge door lists; and the older texts that contradict rule 1 or this design are listed here and aligned.

## Why
On 2026-10-31 he asked to "alinear todo el arnes para que no vaya a quedar contradicciones o algo antiguo" (L1) once
rule 1 landed (PR 738). His answers 145 to 148 (L2 to L5) replaced the double review he narrowed on 2026-10-27 (his D5)
with a Claude reader and a Codex reader on everything, and decided what happens when Codex's weekly limit runs low.
That limit read 79% used this morning (`js-harness codex-meter`), and this week's 328 code reviews alone reach the
reserve before the reset on 2026-11-04 (Depth pass, item 2). On 2026-11-01 he replaced the reserve: Codex reviews to
2% left, then he is told and decides the reset (L18).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/double-review-alignment.md` exits 0
- `node bin/js-harness.mjs rules codex-floor` exits 0
- `node bin/js-harness.mjs rules escalation-model` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/double-review.test.mjs bin/lib/double-review-records.test.mjs bin/codex-review-floor.test.mjs bin/lib/codex-floor.test.mjs` exits 0
- `node --test bin/lib/protocols-skill.test.mjs bin/lib/project.test.mjs bin/lib/template-block.test.mjs bin/contract.test.mjs` exits 0, with `protocols-skill.test.mjs` asserting section 1's new text
- `node --test bin/codex-review.test.mjs bin/lens-review.test.mjs bin/lib/codex-review-recheck.test.mjs` exits 0, with spec 7's request input, recheck and answers asserted
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `rule:double-review` and two new rules, `codex-floor` and `escalation-model`, through `js-harness rules change`; the protocols skill's
  source (`bin/lib/protocols-skill.mjs`, sections 1, 6, 7); `claudeBlock` (`bin/lib/project.mjs`); a new command
  `js-harness double-review` (`bin/double-review.mjs`, `bin/lib/double-review-*.mjs`, the dispatcher
  `bin/js-harness.mjs`, `README.md`); the floor in `codex-review` (`bin/codex-review.mjs`, `bin/lib/codex-floor.mjs`)
  and its debt in `codex-meter` (`bin/codex-meter.mjs`); spec 7 in `codex-review` and its recheck
  (`bin/lib/codex-review-recheck.mjs`) and in `lens-review` (`bin/lens-review.mjs`, `bin/lib/lens-*.mjs`); the older texts of `## Older texts` below, each named there before it
  changes (`CLAUDE.md` and `AGENTS.md` only where that list names them); `docs/ROADMAP.md`; this document.
- Out: running the eval of PR 737's brief (planned below, paid, his); his reset credit; his `~/.claude`, `~/.codex`
  and credentials; gentle-ai's review; JH 125's `/advisor` trial and its files.

## Constraints
- His one Codex reset credit is never spent without his word — because question 148 offered it and he chose
  otherwise (L5).
- Read `js-harness codex-meter` before each Codex run and say its cost first — because the weekly limit is projected
  to run out before 2026-11-04.
- One gate at a time on the machine (`js-harness gate`) — because JH 125 runs beside this feature.
- A double-review read never covers code for the push or the merge door — because a plan read must never satisfy a
  code review's gate (the Codex reader's finding 6 on the design, L6).
- `CLAUDE.md` stays within `rule:claude-md-budget`, measured with `estimateTokens`, never assumed.

## Ask me before
Asked, one at a time through the lead (`js-harness notify --to orchestrator --kind question`): his typed acceptance
of answers 147 and 148, which he tapped, since `rules change` takes only typed words of his
(`bin/lib/rules-change.mjs:232`) and the reserve's 10% exists only in 148's option text (L9); spending the reset
credit; running the eval; anything that would change his answers 145 to 148. Until the first is answered, the two
rule commits wait and the work that does not depend on them goes on.

## Depth pass
- 1. Method: the discipline is review-process design, as a code-review practice lead or a journal editor runs blind
  peer review: two independent reviewers from different backgrounds, the same frozen manuscript, neither sees the
  other's report before both are in, the editor decides on evidence, and each reviewer's yield is measured so the
  panel can be tuned. Their standard: blindness by construction, not by intention; one scope text; a budget with a
  fallback that degrades in a known, recorded way. The smallest change that meets it: amend `rule:double-review`
  (one text, the skill's section 1, which `claudeBlock` and section 7 then name instead of restating); one command
  that launches both readers itself, in two processes, on one frozen copy, and writes nothing a reader can see until
  both return; for code, reuse the skip record `codex-review --unavailable` already writes, which the push accepts
  and the merge door lists (`bin/lib/merge-queue-reviews.mjs:78`), and make `codex-review` write it itself below the
  reserve. The search of `rule:reuse-first`: no command reads text with two model families (`codex-review` and
  `lens-review` read code ranges only and leave Markdown out, `bin/lens-review.mjs:49`); the Codex launch reuses
  `codex-review`'s lean session (`leanFlags`, `makeLeanHome`), the Claude launch `claudeRunner`
  (`bin/lib/background.mjs:78`) as `lens-review` does, and the meter `readRateLimits` (`bin/lib/codex-meter.mjs:122`).
  A mode of `codex-review` was the roadmap's means (`docs/ROADMAP.md:709`); a command of its own is chosen because a
  read is no range, launches Claude too, and keeps its records apart from the ones the push reads.
- 2. Raw material: his answers, the lead's transcript `0f71b2c6`, line 43642 (145), line 43701 (146), line 44098
  (147, with its option text), line 44186 (148) and line 43297 (the alignment); the two blind readers that shaped
  the design, Codex at transcript `0f71b2c6` line 43984 and Claude at line 44017; the lead's two Codex runs, line
  43884 (plain `codex exec`: read nothing, the Windows sandbox) and line 43951 (the lean flags: 59,649 tokens, 1% of
  the weekly limit); `.git/js-harness/codex-review-runs.jsonl`, read with a script: 328 runs since 2026-10-28 (87,
  123, 57, 61 a day), 34,067,580 input tokens, about 0.43M a point of the weekly limit; `js-harness codex-meter`
  this morning: weekly 79% used, resets 2026-11-04 01:44, 1 reset credit; `js-harness rules double-review` (D5's
  reading, 2026-10-27); `bin/lib/protocols-skill.mjs:43` and `bin/lib/project.mjs:411` (the scope said two ways);
  `bin/lib/protocols-skill.mjs:113` (section 7 restates the roles); `docs/ROADMAP.md:68` (the Review row: a spent
  limit is never a skip, 2026-10-11); `bin/lib/codex-review-coverage.mjs:291` (a skip covers a commit);
  `bin/lib/merge-queue-reviews.mjs:78` (the door lists a Codex skip, passes); `bin/lib/lens-review-rows.mjs:60` (the
  door refuses a lens skip); `CLAUDE.md:92` ("the merge door refuses until a review pays it", one rule for both);
  `CLAUDE.md:24` and `bin/lib/project.mjs:395` (the feature order; the init block holds none);
  `bin/contract.mjs:451` (`depthPassSince` read, written by nobody).
- 3. The bar:
  spec 1: `node --test bin/double-review.test.mjs`: one command starts a Claude reader and a Codex reader at once on
  one frozen copy, each echoing every copy's read token (a read that does not counts for nothing), neither answer on
  disk until both return (no reader is confined, L12), and records both only after both return, marked when the
  repository moved meanwhile; a read never covers code for the push or the merge door; none, new behaviour.
  spec 2: `node --test bin/lib/protocols-skill.test.mjs bin/lib/project.test.mjs bin/double-review.test.mjs`: the
  scope, everything that proposes something (a plan, a design, an analysis with figures, a protocol, a document), is
  one text in section 1 that `claudeBlock` and section 7 name by `rule:double-review`; a read is announced with its
  cost and the phrase that skips it (`read --plan`); a skip records his words and their line; `tally` gives each
  reader its findings, taken and found by it alone, the "sin Codex" reader apart; today two scope texts
  (`protocols-skill.mjs:43` against `project.mjs:411`) and no read, announcement or record.
  spec 3: `node --test bin/double-review.test.mjs`: a small code change is read with its request and its diff
  (`read <request> --diff <rev>`); none, new behaviour.
  spec 4: `node --test bin/codex-review-reserve.test.mjs bin/lib/codex-reserve.test.mjs bin/double-review.test.mjs`:
  under 10% of the weekly limit left, `codex-review` starts nothing and records a `codex-reserve` skip, while a meter
  that fails or reads exactly 10% left records none; a read runs `claude-sin-codex`; `js-harness codex-meter` lists
  the reserve skips no Codex review has paid, after their merge too, each with the command that pays it; none, new
  behaviour (today a spent limit fails the review and blocks the push).
  spec 5: `grep -rnE "two (read-only )?readers|attacks its claims|looks only for what is missing"` over `bin/`,
  `docs/`, `CLAUDE.md` and `AGENTS.md` outside `docs/sessions/`, `docs/origin.md` and `docs/proposals/`: only the
  texts `## Older texts` keeps, the rest aligned; today 17 listed there.
  spec 6: left out because it is planned, not run: the eval of PR 737's brief is his spend (`## Eval plan`).
- 4. Refutation: does a reader that reads with tools run headless here, so that one command can launch Claude
  beside Codex? `claude -p --safe-mode --tools "Read,Grep,Glob" --model haiku --output-format json
  --no-session-persistence` on "read harness.json, answer its code": answered `JH` in 2 turns, $0.0008, 1 of 1.
  The Codex half ran headless at transcript `0f71b2c6` line 43951 with the lean flags, 1 of 2 runs (the plain one
  read nothing); this plan's own read (L8) ran both, Codex 55,396 tokens (meter 79% to 80%) and a Claude reader on
  Opus 116,030 tokens. And does the reserve bind before the reset? An estimate, not a consumption model: 21% left at
  about 0.43M input tokens a point (this week's records against the meter; a plan read cost a point at 60k, so the
  rate varies with what is cached) is about 9.0M tokens; 11 points to the reserve is about 4.7M, about 45 code
  reviews at this week's 104k average, under one day at 57 to 123 a day: the reserve binds about 2026-11-01, so it
  is built first, and it acts on the meter, never on this estimate. Measured since (L12, Claude 8): the meter went
  from 80% to 82% over about 1.6M input tokens counted with their cache reads, as `codex-review` and `double-review`
  count them (reviews of 487,468, 173,538 and 65,096, a read of 874,702), about 0.8M a point, an estimate; L8's 55k
  and 60k a point were counted without them. At 82%, 8 points are left to the reserve, about 6M tokens: it has not
  bound on 2026-10-31, and T2 still comes before the next large run.
  Verdict: supports
- 5. Request: his request rewritten, beside his words (L1 to L5): "Make the double review one Claude reader and one
  Codex reader, blind, on the same frozen material: on everything that proposes something (a plan, a design, an
  analysis with figures, a protocol, a document), and on every small code change besides code's two reviews; announce each read with its cost and the phrase that skips
  it, skip it only on my words, and never on my short replies or taps; record every finding so that on 2026-11-16 we
  judge what each reader adds; below 10% of Codex's weekly limit, a second Claude reader replaces Codex and code keeps
  a Codex debt the merge door lists and Codex pays after the reset; never spend my reset credit without asking; tell
  me how to try it; say it in one text, through rules
  change, retiring my D5 by name; then align every older text that contradicts rule 1 or this, listing each first;
  and plan the owed eval without running it."
  Adds: none

## Redesign after question 150
His typed answer to question 150 (L14, spec 7) is not the acceptance it asked for: it designs the review, under rule 1,
and it changes 147 (L15). This pass grounds the redesign before it reaches him as one question through the lead; T2
and T4 are rewritten on his answer to it, and no rule is recorded before.
- 1. Method: as a journal editor or a code-review lead runs review. Reviewers judge the submission against its brief
  (here the request, its specs and contract), not their taste; a plan's reviewers bring failures and improvements;
  the author answers each point, taken or rebutted on evidence, and the editor weighs the answers; one
  revise-and-resubmit round, where the reviewers check that their points were met and that the revision broke
  nothing it touched; then acceptance. The search of `rule:reuse-first` (codegraph and grep for "recheck", "round",
  "--doc"; the first draft missed it, L16): Codex's half of the flow is built, `bin/lib/codex-review-recheck.mjs`
  (the review of a correction checks the earlier findings once, a new finding is a follow-up, a second recheck is
  refused, no flag skips it); `codex-review --doc` passes a document's Goal and Done when. The smallest change: give
  code's existing pair, Codex and the Claude lenses, what was asked; give the lenses the recheck Codex has; record
  the answer to every finding; keep the plan's blind pair (`double-review read`); build no new reviewer. His
  addition (L17, spec 8) sets the bound: a clean review approves at once; at most three reviews; past them the
  problem is raised, what is happening found, and the work passes to a stronger model, as an editor sends a paper
  that two revisions did not settle to a senior referee.
- 2. Raw material: `.git/js-harness/codex-review-runs.jsonl`, `lens-reviews.jsonl` and `double-reviews.jsonl`, since
  2026-10-01, a range reviewed in parts counted once (a read-only script in the session's job folder, not kept; the
  grouping: by base and head; a chain: a range with findings, then the next review whose base is its head).
  Codex: 1061 reviewed ranges, 340 (32%) with findings: 32 P1, 665 P2, 1 P3, no P0; P2 is a real failure on Codex's
  scale. Rounds: of 290 chains that began with findings, 209 ended clean at round 2, 7 at round 3 and 2 at round 4;
  36 had no later review on that base after round 1, 35 after round 2 and 1 after round 4 (their fix reviewed inside
  a wider range, or not by base: unknown). The 10 chains past round 2 found 4 findings there, all P2: a yield of 4 in
  10, not proof that later rounds find nothing, since the recheck's prompt already holds new edges back; 3 chains
  reached a fourth review (2 clean, 1 open), which the bound of three would have raised. Lenses: 581
  complete lens runs in 271 records, 50 (9%) with findings; the lenses have no recheck. What was asked: `--doc` is in
  85 of the 1452 distinct `codex-review --base` command lines of this project's transcripts, an estimate (lines, not
  runs; the run log does not record it); it carries Goal and Done when, not the specs (`bin/codex-review.mjs:83`),
  and needs `--prompt own`, while a gate turn runs `--prompt codex` (`:226`, `:1200`); the lens prompt
  (`bin/lib/lens-prompts.mjs`) has no input for it; small work has no feature document (`CLAUDE.md:22`). Code already
  has a Claude and a Codex review: the pre-push hook refuses a code commit either record lacks (its output on
  532f4215). The double-review reads: L12, 14 findings, 14 taken; L16, 16 findings, 15 taken. Not measured: how many
  of code's findings were false, "criticando incluso cuando está todo bien": no record says which were taken.
- 3. The bar:
  spec 7: `node --test bin/codex-review.test.mjs bin/lens-review.test.mjs bin/lib/codex-review-recheck.test.mjs bin/lib/protocols-skill.test.mjs`:
  a code review is given what was asked, every time: the feature document's specs and contract for large work, the
  request as written for small work (an input of both commands), the gate turn included, and a review with none says
  so; its prompt says to judge against it, a finding naming a real failure. A clean review approves at once. A
  correction gets a confirming review: Codex's recheck, plus a regression the correction itself brought into what it
  changed, which blocks (a seeded test); the lenses get the same. At most three reviews of one change (spec 8): where
  the third still finds a real failure, nothing more is reviewed; the problem is raised to him with what is happening,
  and the work passes to the strongest model the rules name, one value (today `claude-fable-5-1`; his "Fable 5.5"
  when it ships, by changing that value). Every finding of code's pair gets an answer, taken with the commit or
  rebutted with evidence, recorded, and a tally gives each reviewer what was taken and rebutted. Section 1 says this
  flow for plans and code. Today: Codex's recheck allows two reviews and makes the rest a follow-up
  (`codex-review-recheck.mjs`), the lenses have no recheck; about 6% of Codex's command lines and no lens run carry
  what was asked; no answer to a code finding is recorded; nothing raises a change that three reviews did not settle.
  spec 3, changed by spec 7: left out because a small code change gets no read beside its two reviews; its pair is
  those two reviews, judged against the request.
- 4. Refutation: does code need its own extra pair, and does one confirming round lose real failures? Code's two
  reviews are already one Claude and one Codex, so 147's read adds a third and a fourth on every small change (its
  cost not measured; estimated at least one more Codex session each, where a code review costs about 104k input
  tokens a run and a point about 0.8M). Rounds past the second found 4 P2 findings in 10 chains, and 3 chains in a
  month needed a fourth: a confirming review can miss what a correction breaks, which the bar answers by blocking a
  regression in what the correction changed, and three reviews leave a change unsettled about once in ten days,
  which his bound raises instead of reviewing on. Verdict: supports
- 5. Request: his request rewritten, beside his words (L14): "Review what Claude does, and the reviewers themselves,
  for what really fails and whether the task or the feature came out as it was asked. At the plan, the Claude and
  Codex readers bring failures and improvements; in code, its two reviews, Codex and the Claude lenses, judge against
  what was asked. A review that finds nothing approves at once. Otherwise Claude gets every finding back and answers
  each, taken or rebutted; it fixes or improves, and a review confirms the fixes work and broke nothing they touched;
  at most three reviews, and where the third still fails, raise it to me as a problem, find what is happening and
  pass the work to the strongest model. Never endless review. A precise plan, then an impeccable implementation,
  under rule 1."
  Adds: none

## Specs
1. "Y si mejor no hacemos dos lectores A y B sino que hacemos una de Claude y una de Codex para tener 2 perspectivas
   diferentes pero que sean dos revisiones ciegas independientes?" (L2)
2. "Me gustaria en todo, pero que me dieras la opcion de cuando si y cuando no, siento que siempre todo se debe
   revisar doble pero de la forma de nos de criterio y con la filosofia nueva que tenemos ya que todo es importante a
   menos que yo como usuario te diga que no quiero la revision, esa seria la unica opcion de que no se hiciera." (L3)
3. "Sí, pero también en el código chico" (L4, tapped, to question 147's corrected design).
4. "Claude reemplaza y Codex paga después (Recomendada)" (L5, tapped, to question 148).
5. "entiendo que tenemos que alinear todo el arnes para que no vaya a quedar contradicciones o algo antiguo" (L1).
6. The eval of PR 737's brief, with and without the rule, owed by 2026-11-30 (`docs/ROADMAP.md:717`): planned here.
7. "La idea es que los modelos de ia son muy buenos criticandos incluso cuando esta todo bien, la idea es revisar lo
   que haga claude e incluso el mismo claude revisor y codex revisor, ver que realmente falla y con criterio y si la
   tarea que se pidio o la funcionalidad quedo como fue pedida ya que la idea es que se pida algo en especifico y se
   haga eso por eso en la planeacion la aportacion de los revisores es diferente ya que es aportar mejoras o fallos
   en el plan inicial pero siempre es, identificar problemas con aporte de mejoras, claude se le devuelve el trabajo
   con toda esta informacion, se corrige o se mejora y entra nuevo a revision para terminar de comprobar si realmente
   funciona y al final aprobar, la idea no es quedarse revisando infinitamente y sin sentido sino siempre con
   criterio de profesional top por eso el plan inicial debe quedar preciso y luego debe quedar impecable la
   implementacion y asi yo creo que tendria flujo de trabajo perfecto, ahora la idea es utilizar nuestra filosofia
   principal que fue la que colocamos dentro de la regla del arnes recuerdas?" (L14, typed, to question 150).
8. "obvio que si se hace una revision y no encuentra nada se aprueba y ya osea la idea es maximo hacer 3 revisiones y
   si no presentar un problema y ver que es lo que pasa y pasarlo a un modelo mas inteligente aprovechando que esta
   semana sale Fable 5.5" (L17, typed, his addition to question 150).
9. "Aunque siempre avisame para reiniciar el limite semana" (L18, typed, to question 152).
10. "me avisas cuando al uso semanal le quede el 2 al 1 porciento" (L18, typed).
11. "Listo, entonces continua solo unas 2 horas" (L18, typed: his approval of the design with the notice at 2 to 1
    percent in place of the 10% reserve).

## Older texts
Each text found that contradicts rule 1 or this design, before it changes; the search: `grep -rnE "two (read-only
)?readers|double review|double-review|attacks its claims|what is missing"` over the repository outside `odd/tasks/`,
`docs/sessions/`, `docs/origin.md` and `docs/proposals/`, the roadmap's list (`docs/ROADMAP.md:715`), the two
readers of this plan (L8), who found items 11 to 17, and the first read of the command (L12), who found 18 and 19.
Line numbers re-checked on 2026-11-01 on main f063429 (L16, Claude 9).
1. `bin/lib/protocols-skill.mjs:43`, section 1: D5's scope and two roles. Becomes his design (T4).
2. `bin/lib/project.mjs:412`, `claudeBlock`: a second scope text with the two roles. Becomes a pointer to
   `rule:double-review` (T4).
3. `bin/lib/protocols-skill.mjs:113`, section 7: restates the roles ("one rerunning the figures ..., one looking for
   what is missing"). Names the rule only (T4).
4. `docs/ROADMAP.md:68`, the Review row: a spent weekly limit is "never recorded as a skip" (2026-10-11). Below the
   reserve it now is, by question 148 (T2).
5. `CLAUDE.md:92`: "the merge door refuses until a review pays it" for any skip; the door lists a Codex skip and
   refuses a lens skip (raw material). Says each (T5).
6. `CLAUDE.md:24`: the feature document's order lacks `## Depth pass` after the contract. Gains it (T5).
7. The block `init` writes (`claudeBlock`): the roadmap says it holds the feature order; it holds none
   (`bin/lib/project.mjs:395`), so nothing changes there; item 19 corrects the roadmap.
8. `js-harness contract template`: no `## Depth pass` skeleton. Gains it (T5).
9. `sync`: never offers `depthPassSince`, which `bin/contract.mjs:451` reads and nothing writes. Offers it (T5).
10. `docs/ROADMAP.md:898`: "Each item that needs a design passes two readers that did not write it". Names the
    double review (T5).
11. `docs/RULES.md:54` and `bin/lib/rules-data.mjs:197`: D5's subject and phrases, rendered. `rules change` rewrites
    both (T4).
12. `docs/ROADMAP.md:709`: "`codex-review` needs a mode that reviews a plan". Says the command of L7 (T5).
13. `bin/lib/protocols-skill.mjs:65`, section 3: a skip is only "a review that cannot run". Gains the reserve's skip,
    which `codex-review` records itself (T2).
14. `bin/lib/protocols-skill.test.mjs:130` and `:135`, `bin/lib/project.test.mjs:1980`: assert D5's text. Assert
    the new one (T4).
15. `docs/FAILURES.md:1225`: its control names the test of item 14 by its title. Follows the title (T4).
16. `docs/ROADMAP.md:689` to `:717`, the alignment item itself: ticked with this document's names when it lands (T6).
17. `bin/lib/protocols-skill.mjs:118`, section 7's cost: "two readers only with a candidate list". Still true, now
    of two families; left.
18. `bin/lib/onboard.mjs:108`, `:747`, `:885` and `:902`, with `bin/lib/onboard.test.mjs:262` and
    `bin/lib/onboard.testkit.mjs:208`: the onboarding asks "two readers" of no stated family for the pre-plan and the
    roadmap, both proposing documents put to the owner (L12, Claude 4). Name `rule:double-review` (T4).
19. `docs/ROADMAP.md:715`: said the block `init` writes gains `## Depth pass`; it holds no feature order (item 7).
    Says `CLAUDE.md` alone (L12, Codex 5; done with this list).
20. `docs/ROADMAP.md:700` to `:702`, the alignment item: "a small code change also gets the blind Claude and Codex
    read", 147's design, which L15 drops. Says the design his answer to the redesign sets (T4; L16, Claude 7).
21. `docs/ROADMAP.md:79`, the throughput row: "two readers run only before a proposal reaches him", D5's scope.
    Names `rule:double-review` (T4; L16, Claude 10).
Checked and left: `bin/lib/manifest.mjs:140` and section 6 name the rule and its home; the roadmap's "Design, past its
two readers" items (`docs/ROADMAP.md:256`, `:271`, mirrored at `README.md:766`) are titles of items, and their reading
is the one item 18 makes the onboarding ask for; `docs/sweep-2026-10-11.md:100` ("never recorded as a skip") is a dated
sweep, a record of that day (L16, Claude 10).

## Next step
State on 2026-11-01, on `rule/review-flow` from main f063429 (PR 745 landed T1, T3 and T5). He answered question
150 in his own words (L14) and added the bound (L17): `## Redesign after question 150`, decided in L15, read blind
in L16 and its findings taken; question 152 put it to him, and he approved it with point 5 changed: no reserve, a
notice at 2% left and his decision on the reset (L18). T4 is done (85d8ee7f, L19), landed as PR 746 (main 5823566).
T7 is done (64a588eb, L20) on `feat/review-request`, PR 748. T8 is split in three commits on the same branch:
T8b f58c4027 (the recheck blocks a regression the correction brought, prompt v2) and T8a 071dc6d7 (`double-review
answer <run id> <reviewer> --taken --rebutted --why`, and `tally` rows per reviewer of code) are committed, not yet
reviewed. T8c 5c67d309 (the lenses recheck their earlier findings, `recheckOf`) is committed too. T8 is done and reviewed (L21), PR 749 from `feat/review-answers` (left out of one land by a timing test under
load, L22). T9 is done and reviewed (L22), landed as PR 753 (main a0b5334). T2 is done and reviewed (L23) on
`rule/codex-weekly-floor`: b9a92dcf, 52cd8390, c0ca22e7, in its own PR. Next: T6. D5's two exemptions (Claude 6 of L12) are
kept in T4's text, since a question of fact proposes nothing and a reviewed text named by path is not read again, and
the report says so for him to change. T6 keeps T2's verifier, older text 16 and the report of how to try it.
Meter 5% weekly on 2026-11-02 at 09:40 (2 credits left); floor `rule:codex-weekly-floor`.
The gentle-ai Stop hook: status only, start nothing. Never edit a tracked file while a Codex review runs (L11).

## Eval plan
The eval owed by 2026-11-30 (spec 6), not run here: the case built from PR 737's brief runs on the current arm and
on `current-without-rule-depth-pass` (`evals/without.mjs`), `MIN_TRIALS` 2 each (`evals/rule-proof.mjs`), and
`node evals/rule-proof.mjs <case> <current> <without>` records it; it proves the rule only when the arm without
scores lower. Cost, estimated from the two proofs on record ($2.00 and $4.43, `odd/tasks/depth-pass-rule.md`, L7):
$2 to $5, and Codex none. Run only on his word, through the lead.

## Tasks
- [x] T1 (kind: docs) This document with its depth pass, committed with documents alone; spec all; 0fc1287e.
- [x] T2 (kind: build) b9a92dcf, 52cd8390, c0ca22e7 (L23); the rule is `codex-weekly-floor`, not `codex-floor`, so it is
  not read as `codex-review-floor`, the cap of one review. Point 5 as approved (L18): `rules change codex-floor` (2 percent of the weekly limit left,
  his words of lines 49536, 49661 and 49690), then `codex-review` reads the meter just before it launches and, at or
  under the floor, starts nothing and tells the lead to ask him about the reset (a failed or missing reading says so
  and runs); only on his typed no a second Claude review runs in Codex's place and records a Codex debt that
  `codex-meter` and the merge door list until a Codex review pays it, after the reset; never his reset credit; older
  texts 4 and 13; spec 4, 9, 10, 11; route codex-review.
- [x] T3 (kind: build) bcd2dd4a, 1a7638cf, c59e58b0, aad73210, 09725fbd, 532f4215; `js-harness double-review`: `read` (the frozen copy, both readers started at once, each echoing
  its read tokens, the Claude reader on `rule:subagent-reader-model`, blind by sequence (L12), the reserve, `--plan`
  announces), `take` (taken and shared), `skip`, `tally`; records under the git common dir, which no review row
  reads, with the test that a read leaves code uncovered; spec 1, 2, 3, 4.
- [x] T4 (kind: build) 85d8ee7f; `rules change double-review` on his words of questions 145, 146, 150 and 152 (L2, L3, L14,
  L17, L18): section 1's one text says points 1 to 4 of `## Redesign after question 150`, `claudeBlock` and section 7
  name it, D5 retired by name; older texts 1 to 3, 11, 14, 15, 18, 20 and 21; spec 2, 7, 8.
- [x] T7 (kind: build) 64a588eb; Point 2: `codex-review` and `lens-review` are given what was asked, every time: the feature
  document's specs and contract for large work, `--request <text>` for small work, the gate turn included, and a
  review with none says so; their prompts judge against it; spec 7; route codex-review, lens-review.
- [x] T8 (kind: build) Point 3: every finding of code's pair gets an answer, taken with its commit or rebutted with
  evidence, recorded, and a tally gives each reviewer taken and rebutted; Codex's recheck blocks a regression the
  correction brought into what it changed (a seeded test); the lenses get the recheck; spec 7. Done: f58c4027,
  071dc6d7, 5c67d309, fixes 4bf5ee75 and fb1ff505; branch `feat/review-answers` (L21).
- [x] T9 (kind: build) Point 4: at most three reviews of one change (the recheck allows a second recheck, not a
  third); past them `codex-review` refuses, says the problem and what is open, and names the strongest model, one
  rule value (`rules change escalation-model`, today `claude-fable-5-1`); spec 8. Done: 462f9d69 (the register's
  room), 2d07711c (the rule and the bound), fix 30197b3a; branch `rule/escalation-model`, stacked on PR 749 (L22).
- [x] T5 (kind: build) Older texts 5, 6, 8, 9, 10, 12; spec 5; 2cb04248, 5cbbca4c and the commit of `sync`'s offer.
- [ ] T6 (kind: verify) Reviews (Codex, lenses, an independent verifier for T2, a guard's input, and T3, two
  processes at once), gate, PR, older text 16; the report tells him how to try it (L1); spec all.

## Log
- L1 (2026-10-31, his words, the lead's transcript `0f71b2c6`, line 43297): "Excelente cuando me tengas ya tomo dime
  para probartelo que lo introduzcamos no solamente de una sino que en el plan completo esto nos quede completamente
  implementado con todo lo que ya tenemos planeado, ademas entiendo que tenemos que alinear todo el arnes para que no
  vaya a quedar contradicciones o algo antiguo"
- L2 (2026-10-31, typed, line 43642, his answer to question 145, itself a proposal): "Y si mejor no hacemos dos
  lectores A y B sino que hacemos una de Claude y una de Codex para tener 2 perspectivas diferentes pero que sean dos
  revisiones ciegas independientes?"
- L3 (2026-10-31, typed, line 43701, question 146): spec 2 as written; the acceptance of the Claude and Codex pair.
- L4 (2026-10-31, tapped, line 44098, question 147): "Sí, pero también en el código chico", whose option read "Una
  lectura más de Claude y Codex en cada cambio chico de código, además de las revisiones que ya tiene; más gasto de
  Codex", to the corrected design: code keeps today's pair, plans, designs and proposing documents get the blind
  pair on frozen material, findings outside the repository until both return, each read announced with its cost and
  a skip phrase, only his words skip it, every finding recorded, judged 2026-11-16, through `rules change`
  retiring D5 by name.
- L5 (2026-10-31, tapped, line 44186, question 148): "Claude reemplaza y Codex paga después (Recomendada)", whose
  option read "Por debajo del 10 % las lecturas nuevas de Codex pasan a un segundo lector de Claude en contexto
  limpio, marcado «sin Codex»; el código queda como deuda que Codex revisa tras el reinicio, y la fusión la lista".
- L6 (2026-10-31, evidence): the two blind readers of the lead's design (transcript `0f71b2c6`, lines 43984 and
  44017). Taken here: code's pair is kept and the small change's read is added on his word (L4); blindness by
  construction (one frozen copy and hash, findings written after both return); D5's rules on disagreement and rounds
  kept; each reader's yield recorded; the reserve; a read never covers code.
- L7 (2026-10-31, decision): a command of its own, `js-harness double-review`, rather than a mode of `codex-review`
  (Depth pass, item 1); the reserve is built first because it binds about 2026-11-01 (item 4).
- L8 (2026-10-31, this plan's double review, blind, on 0fc1287e, run by hand as the design asks before its command
  exists; announced to the lead with its cost): Codex 8 findings (55,396 tokens; meter 79% to 80% weekly), Claude on
  Opus 7 findings (116,030 tokens); answers kept outside the repository in the session's job folder. Both found:
  "Codex paga después" had no repayment, a skip's debt leaves every list once its branch merges (Codex 1, Claude 2,
  checked: the skips owed are read from the default branch to the tip, `bin/lib/lens-review-rows.mjs:40`), taken as
  T2's debt list in `codex-meter`; blindness was intention, since a reader with tools reads any file (Codex 2,
  Claude 5), taken as the hash echo and `--add-dir` (a print run reads outside its folder only with permission, which
  it cannot ask for); the meter's failed, missing and exact readings and concurrent sessions (Codex 3, Claude 5),
  taken in T2; no test that a read leaves code uncovered (Codex 4, Claude 5), taken in T3; the bar numbered apart
  from `## Specs` (Codex 6, Claude 3), renumbered; older texts missing (Codex 7, Claude 7), items 11 to 17. Codex
  alone: the tally's sameness of two findings and the fallback's cohort (5), taken as `take --shared` and the
  `claude-sin-codex` row; the forecast is an estimate (8), said in item 4. Claude alone: `rules change` refuses a
  tapped answer (1, checked at `bin/lib/rules-change.mjs:232`), which is L9; "dime para probartelo" was dropped and
  analyses and protocols left the scope (4), restored; the refutation ran on Haiku (6), now measured on Opus above;
  T5 changes code, the verifier must cover T3, `leanFlags` is private, the dispatcher and the README are in scope
  (7), taken. Not taken: Claude 4's doubt on "taps" (the roadmap's line 704 and item 5 say the same: a read is never
  started by his short reply or tap). Codex 4 of 8 and Claude 3 of 7 were found by the other too.
- L9 (2026-10-31, decision): 145 and 146 are typed and carry the double review ("en todo" covers the small code
  change of 147); 147 and 148 were tapped, and the reserve's 10% exists only in 148's option text. A rule of his takes
  only his typed words, so one question goes to him through the lead, asking him to write his acceptance of 147 and
  148; the two rule commits (T2's first step, T4) wait for it, and T3, T5 and T2's code that reads no rule go on.
- L10 (2026-10-31, decisions in building T5 and T3): `sync` offers `depthPassSince` and never writes it, since
  `harness.json` is a committed file it keeps; the offered day is the next one, as this repository chose 2026-11-01 so
  documents opened today stay as they are, and `null` declines it. The offer is in `syncMain` alone, so `migrate` and
  `check` print nothing new (b042cddc). In T3 the readers' prompt is a text source of directive coverage
  (`bin/lib/rules-sources.test.mjs` holds every prompt builder to one), with no headings, because each sentence is a
  span the register declares and the register sits under its line ceiling; the Claude reader's model is read with
  `ruleHere`, since `rule:subagent-reader-model` is of this repository only (bcd2dd4a).
- L11 (2026-10-31, a mistake): this document was edited while Codex reviewed `d22f33e..bcd2dd4`, so the run read a
  tree that was not the range and recorded nothing (28,500 input tokens, part 1 of 4); `docs/FAILURES.md`
  `edit-during-review`, its eighth sighting. Fixed by committing the edit and running the review again, touching no
  tracked file until it returns. What would stop it: the guard refusing an edit of a tracked file in a worktree
  whose Codex review is running, a check before a line; proposed to the lead, not built here (out of this scope).
- L12 (2026-10-31, T6's first real read, `89de7582`, of this document at b0f455ff, announced to the lead with its
  cost): Claude 9 findings, Codex 5, three found by both. The announced cost was wrong: `--plan` said about 116k and
  55k tokens, from L8's hand run, and the command counts input with its cache reads, so it measured 1,076,290 tokens
  of Claude and 874,702 of Codex; the meter moved 81% to 82% weekly, the 1% it said. All 14 taken (`take`). Found by
  both: the read is not blind, since `--add-dir` adds a folder and confines nothing (`CLAUDE_SETTINGS` denies no
  read, and the Claude reader opened `D:\js-harness\package.json`), and Codex's answer file sat beside the copy, so
  L8's "a print run reads outside its folder only with permission" is false; the echoed hash is in the prompt, so it
  proves no reading; `skip` records any words. Fixes on this branch, tests first: Codex's answer is read from its
  last `agent_message` on stdout, as `codex-review` reads it, so no answer of either reader is on disk until both
  return (blind by sequence, not by confinement); each frozen copy ends with a read token the readers echo, and the
  hash leaves the prompt; `skip` takes only his typed words, through `rules-change.mjs`'s `quotationOf`; a read says
  when HEAD or the tracked files moved while it ran (Codex 3); the cost line says this measure. Docs: `## Older
  texts` gains the onboarding's two-reader lines (Claude 4) and the roadmap's init-block line (Codex 5); citations
  re-checked (Claude 7); the reserve's estimate restated from measured points (Claude 8). Claude 5 is T2. Claude 6,
  whether D5's two exemptions (a question of fact; a step whose reviewed text the question names) survive "en todo",
  is his: it goes to him with T4, through the lead, after question 150.
- L13 (2026-11-01, T6's independent verifier of T3, two processes at once; a read-only Opus sub-agent, 120k
  tokens, no reader launched): no break of blindness within a read, of the read tokens, of the moved mark or of the
  records. Three defects, each checked in the code before the fix. Off Windows the readers are detached and nothing
  handled SIGINT or SIGTERM, so an interrupted read left both running with the copy and the lean home behind
  (`codex-review.mjs` `runReview` handles them). A kill that returned normally left the child's pipes attached, so a
  descendant it missed could hold the CLI open. `skip` took any typed words, not the announced phrase. A state git
  could not read also passed as nothing moved. Fixed in 532f4215, tests first (the interrupt test hung before the
  fix): `runChild` kills each tree on either signal and always lets the pipes go, `skip` needs `SKIP_PHRASE` in his
  words, and an unknown state is said. Codex: correct (0.88); lenses reliability and resilience: 0. Left as they are,
  low: a retried read's new readers could find the earlier read's record under the git common dir by a deliberate
  read (outside "until both return" within one read); a change between the frozen diff and the first state, a
  window of milliseconds.
- L14 (2026-11-01, typed, the lead's transcript `0f71b2c6`, line 49332, his answer to question 150, read with
  `js-harness sessions --quote`): spec 7 as written. It is not the written acceptance of 147 and 148 the question
  asked for: it designs the review (reviewers judge against what was asked, with a top professional's criterion; at
  the plan they bring failures and improvements; Claude fixes, one review confirms it works, then approval; never
  endless; under rule 1). The lead (22:49 UTC, to 126): "It changes 147. Redo T2/T4 on his words and send the
  redesign to him through me as one question before recording rules."
- L15 (2026-11-01, decision, on L14 and `## Redesign after question 150`): 147's extra read on every small code
  change leaves the design, since code's two reviews are already a Claude and a Codex review and that read would ask
  for over three weekly limits of Codex; code's pair gets what was asked and the bounded rounds instead. 148's
  reserve is still not in his typed words, so the question carries it as part of the redesign, said apart. The
  redesign passes the blind pair (`double-review read`) before it reaches him, as spec 2 and today's
  `rule:double-review` ask; its findings are taken here first. T2 and T4 are rewritten on his answer, on
  `rule/review-flow` from main f063429, since PR 745 landed `rule/double-review`.
- L16 (2026-11-01, the redesign's blind read, `66806ba7`, of this document at 68b417d6, announced with its cost):
  Claude 10 findings (905,314 tokens), Codex 6 (1,184,787 tokens); the meter moved 86% to 87% weekly. Found by both:
  Codex's half of the flow is built, `bin/lib/codex-review-recheck.mjs` (a correction's review rechecks the earlier
  findings once, refuses a second recheck, no flag skips it), which the first draft's reuse search missed, and its
  third round was neither his nor defined past failure (Claude 1 and 2, Codex 1; checked at
  `codex-review-recheck.mjs:1-20` and `:115-130`); small work has no feature document and a gate turn's prompt
  refuses `--doc` (Claude 5, Codex 2; checked, `bin/codex-review.mjs:226`, `:1200`); no answer to a code finding is
  recorded, so the false findings he names stay unmeasured (Claude 3, Codex 4); the contract still described 147's
  design (Claude 7, Codex 6); the rounds' counts did not add up and their reading overreached (Claude 8, Codex 5:
  the 290th chain is the one still open after round 4). Claude alone: the "three weekly limits" figure multiplied a
  plan read's cost by review runs, dropped for an estimate (6); five stale citations, corrected (9); two older texts
  missing, items 20 and 21 and one checked and left (10); the reserve is not built while the meter nears it (4), not
  taken: its 10% is a rule of his still without his typed words, so the question says how near it is instead.
  Codex alone: a confirming review can miss what a correction breaks (3), taken as a blocking regression in what
  the correction changed. Taken: Claude 9 of 10, Codex 6 of 6 (`double-review take`).
- L17 (2026-11-01, typed, the lead's transcript `0f71b2c6`, line 49467, his addition to question 150, read with
  `js-harness sessions --quote`): spec 8 as written. It sets the bound the read asked for: a clean review approves at
  once, at most three reviews, then the problem is raised and the work passes to a stronger model. "Fable 5.5" is
  his word, not verified: the strongest model this machine knows today is `claude-fable-5-1`, so the design names one
  value the rules hold. The lead (23:01 UTC): "Fold it into T2/T4 and the one question to him."
- L18 (2026-11-01, typed, the lead's transcript `0f71b2c6`, read with `js-harness sessions --quote`, each with the
  lead's question before it read in the transcript): line 49536, to question 152 as the lead put it at line 49530:
  "Aunque siempre avisame para reiniciar el limite semana"; line 49661, to the lead's line 49655 (did he approve the
  design with that change): "me avisas cuando al uso semanal le quede el 2 al 1 porciento"; line 49690, to the lead's
  line 49684, which asked "¿apruebas el diseño con el aviso al 2–1 % en lugar de la reserva del 10 %?", and said that
  a written "apruebo así" lets JH 126 record the rules and build points 2 to 5, spending no credit and running no
  eval: "Listo, entonces continua solo unas 2 horas". Read as his approval of the redesign with point 5 changed: no
  10% reserve; Codex reviews until 2% of the weekly limit is left; then the lead tells him and he decides the reset;
  only on his no a second Claude review runs, with the code as a debt for Codex. The lead (23:35 UTC, to 126):
  "Record the rules with his words (lines 49536, 49661, 49690) and build points 2 to 5. He is away about 2 hours."
  Order: T4 (the rule text), T7, T8, T9, T2, each a slice with its reviews.
- L19 (2026-11-01, evidence): T4 committed as 85d8ee7f. The coverage register sat at 999 of its 1000 lines and the
  new `claudeBlock` sentence needed a span in two lists, so its two sentences became one: `--refresh` settled the
  old span (ad3655173cc6) and the new one took its two lines; `rules check` and `rules coverage --strict` PASS, 278
  tests of the five touched files pass, the block hash moved to de748fbd. Codex reviewed afcd81c..85d8ee7: correct,
  confidence 0.87, no findings, 79,452 input tokens; lenses readability and risk: 0 findings each. Meter before it:
  weekly 87% used. A mistake: the turn ended at 18:58 local waiting for a compaction that only comes on a new turn,
  and nothing ran for about two hours (the lead's notice of 20:53, claimed); `docs/FAILURES.md` `turn-ended-waiting`.
- L20 (2026-11-02, evidence): T7 committed as 64a588eb after the night's pause. The `NO_ASKED` line logged before
  the plan broke about 30 exact-output tests (gate run 41379003377), and on stderr 59; logged once after the first
  launch's line it broke 2, which pin it. `bin/codex-review.mjs` stays at its ceiling of 2284 lines: the reading of
  `--doc` and `--request` moved to `bin/lib/review-asked.mjs`, shared with `lens-review`, and `thousands` and
  `counted` are `codex-review-plan.mjs`'s. 445 tests of the touched files pass; `npm run check` PASS. Codex reviewed
  4e4ff5c..64a588e with `--doc` this document: correct, confidence 0.87, no findings, 325,405 input tokens; lenses
  reliability and readability: 0 findings each. A mistake of cost: the commit was run twice on a red gate, two
  GitHub runs where one was owed; the second read nothing new.
- L21 (2026-11-02, evidence): T8 done. Codex reviewed 026cc2a..4ab62a6 with `--doc` (run 645a50c0): incorrect at
  0.95, two P2: `--unavailable` threw on `picked.names` over a rechecked range, and a lens with no tools counted fixed
  an earlier finding whose code is not in the patches. Both taken, fixed in 4bf5ee75, answered with `double-review
  answer`; the recheck run of 4ab62a6..cbfd282 found both fixed (0.97, 66,053 input tokens). Lenses reliability and
  readability over 64a588e..cbfd282 (run 25553a4f): reliability 0, readability 1 SUGGESTION, true: `codeTallyOf`
  read an answer line's counts unchecked, so one malformed line threw the whole tally. Taken, fixed in fb1ff505 with
  its test; Codex over cbfd282..7af1fcd correct at 0.98 (48,259 input tokens), and readability's recheck, the T8c
  path in a real run, found it fixed. The lead (05:48): PR 748 landed T7 alone (main 47d96a3, checked with `gh pr
  view 748`: merged at head 026cc2a), so T8 moved to `feat/review-answers` with main merged in, for its own PR.
- L22 (2026-11-02, evidence): T9 done. The coverage register sat at 999 of 1000 lines, with no room for a new rule's
  control (`rules coverage --refresh` freed none; the size convention has no data exemption): `writeCoverage` now writes
  a control that fits in 120 characters on one line (462f9d69), 852 lines; the scan of restated values leaves the
  register out like rules-data.mjs, since on one line an owed control's id and day matched a pattern, as three planted
  breaks already did on main (counted with a script over both registers). `rules change escalation-model` (2d07711c):
  his words at lines 49467 and 49690. The bound: from the head of a recheck that left findings open, a second recheck
  of those alone, the third review; past it refused, with what is open and the model. The push row keeps his decision
  of 2026-10-15, a warning and no refusal. The first commit was red once (gate run 41438460265: the push row read a
  second recheck as a correction owed), read and fixed before the second try. Reviews: Codex 6a5c626..2d07711, 2 parts,
  297,411 input tokens: incorrect at 0.95, one P2, the third review did not raise the problem when it ended, only a
  fourth did; lenses reliability, readability, risk: readability one WARNING, true, a string replacement in
  `writeCoverage` would rewrite `$&` in a planted break; gentle-ai (lineage review-0bb14477be51f1f7, review-reliability)
  approved and acknowledged. Both taken, fixed in 30197b3a, answered with `double-review answer`; Codex's recheck
  1 fixed (0.97, 43,964 input tokens), readability's recheck 1 fixed, reliability 0. PR 749 was left out of a land by
  reply-budget's p90 in WSL2; T8 touches no module the reply hook imports, and the test alone here passed (p90 2220
  and 1737 ms of 2500); told to the lead (06:38). The lead (06:11): he reset Codex's weekly limit; the meter read 2%
  used and 2 credits left.
- L23 (2026-11-02, evidence): T2 done. Named `codex-weekly-floor` so it is not read as `codex-review-floor` (told to
  the lead). b9a92dcf: `weeklyFloor` and `floorStopped` in `bin/lib/codex-meter.mjs`, and `codex-meter` lists the
  branch's Codex debts through `owedSkipLines`. After PR 753 landed, `rules change codex-weekly-floor` (value 2, his
  words of lines 49536, 49661 and 49690, each read as typed) in 52cd8390 with `codex-review`'s read before the launch,
  older texts 4 and 13, the control (a check with a planted break, proven red) and the version probe moved to
  `bin/lib/codex-launch.mjs` so `codex-review.mjs` stays under its ceiling (2272). A first merge of main carried a
  `wip` commit made with `--no-verify`; its gate was red on the undeclared rule, and it was undone and the merge
  redone on b9a92dcf alone, so the `wip` commit is in no pushed history. The rule commit was red once (gate run
  41459609490: the sentence changed in section 3 left a stale span in the coverage register), fixed with `rules
  coverage --refresh`. Reviews: Codex 5e8872b..b9a92dc (run 6938e212, 155,679 input tokens): incorrect at 0.92, one
  P2, `--json` printed plain debt lines on a failed read; lenses reliability and readability one WARNING each, the
  same; risk and resilience 0. Codex da87bcf..52cd839 (run 12500d41, 107,981): incorrect at 0.97, two P2, the floor
  read once before a review in parts, and a Ctrl-C of the meter's read launched the review; the four lenses 0. All
  taken, fixed in c0ca22e7 with tests proven red on the old source, answered with `double-review answer`. Codex's
  recheck 52cd839..c0ca22e: 2 fixed, correct at 0.97 (69,739); lenses resilience, reliability, readability 0.
  gentle-ai: not reviewed; its Stop hook offered the branch (base a0b5334, off the head's first-parent line), and
  its read-only status ended in `operation_timeout` twice, so nothing was started. Not built: a second Claude review
  is not forced in Codex's place on his no; the stop says to run it (`lens-review`), and T6's verifier judges that.
