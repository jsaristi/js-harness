## Goal
A committed design, reviewed twice, for a cost trial of four runs that tells the owner how much Fable a work session
spends on one real task when it runs on Opus 5.5 with a Fable 5.2 advisor, against the same task on Fable 5.2 at
medium, and whether the advisor's Fable counts on the weekly Fable meter, with what the trial would cost, put to him
through the lead before anything runs.

## Why
His request (L1) was to find out whether sessions and sub-agents should run on Opus 5.5 with the Fable 5.2 advisor
while the lead stays on Fable 5.2 at high. The quality trial of three arms (`odd/tasks/model-trial.md`) failed its
third double review; asked again, he chose to measure the advisor's cost on the Fable limit first (L2). His earlier
words (`odd/tasks/one-model-home.md` S1, 2026-11-10): "el Fable 5.2 en Medio no es mejor que Opus 5.5 en Max osea el
Fable 5.2 Alto es mejor tanto en precio como en inteligencia". On 2026-11-11 a Fable limit stopped the work sessions
for 3 h 24 min and he moved them to medium (S7); the lead recorded that only half of his weekly use can go to Fable
(L5, the lead's paraphrase; his typed line was not found, the search is in the depth pass, item 1). Which limit stopped them is
not known: the card at 10:16 read the weekly Fable meter at 0 % and showed no five-hour window (L5). By his own
measure Fable at medium was not better than Opus at max, and Opus with an advisor was never measured; this trial
measures cost only, and every outcome returns to him as a question.

## Done when
- `js-harness contract check odd/tasks/advisor-cost.md` exits 0
- The double-review record holds a `take` entry for both readers of every read of this document; no command checks
  this whole, so it is read in the record (`js-harness double-review tally --since 2026-11-11`)
- The lead holds a recorded question that puts the trial and its cost to him (`notify --kind question`), its text
  the one in `## The question` below, and this session's `waiting` or `closed` notice names it

## In scope / Out of scope
- In: this document; the session summary under `docs/sessions/`; this session's scratch.
- Out: running any run, the probe or the dry start included (his yes, not given); changing a rule, a model, an
  effort or the advisor setting (his); building the run folders, the watcher, the reader extension or the briefs
  before his yes; anything under `~/.claude`; the quality of the arms' work; the all-models meter as a measure (D8).

## Constraints
- Nothing runs before his yes — because the runs spend his plan and need his exception to two rules (D6).
- The criterion, the validity rules and the stops are fixed here, before any run — because a criterion written after
  the results bends toward them (JH 125's constraint, `odd/tasks/advisor-trial.md`).
- The size is what he chose: 2 to 4 runs (L2), each a bounded group of invocations (D2). No outcome changes a model,
  an effort or a rule: each ends in a question to him with the figures.
- It starts only with room on the weekly Fable meter (D7) — because the trial must not cause the stop it measures.

## Ask me before
The whole of `## The question`: the trial, its maximum, the exception for the Opus invocations, the threshold, the
Opus effort, the start time and the pause of every session for the probe. Then, during the trial: any rerun of a
void run; a consent prompt for usage credits; going past any maximum.

## Depth pass
- 1. Method: metering, the discipline of a capacity engineer who must know what a workload draws from a quota they
  can read only coarsely: calibrate the coarse meter against a fine record with every spender counted, measure the
  workload in the fine record, and spend an isolated reading of the coarse meter only on what the record cannot
  tell (whether the advisor's Fable counts on the Fable meter, and at what rate against ordinary Fable), timing the
  meter's ticks rather than reading its two ends. Every run is validated before its figure is used: models,
  advisor calls, the reader against the CLI's totals, the task done, no reach outside its folder. The smallest
  change: reuse `evals/transcript-usage.mjs` (committed and tested: per model, message ids, 5-minute and 1-hour
  writes apart, compared with the CLI's `modelUsage`), extended in one tested commit after his yes with the
  `advisor_message` iterations and a Fable 5.2 price row; the lead's `get_usage` readings; the recorded reader and
  lens spend (`.git/js-harness/double-reviews.jsonl`, `lens-reviews.jsonl`). Search: `grep -rn rate_limits bin`
  (Codex's reader only); `Glob evals/*usage*`; the relief file; `find ~/.js-harness ~/.claude/jobs -name
  '*8e1e332a*'` (nothing) and `grep 'two defects of the land'` over the transcripts (the brief, D4); for his line on
  half the week, the user lines of the lead transcript `f0959bbd` holding "50%" (none of his, read at line 76).
- 2. Raw material: his words, lead transcript `f0959bbd-5f7a-4360-b626-048caf21067f` lines 2320, 2446 and 4186;
  `812b728f` line 748 (L8); `odd/tasks/one-model-home.md` S1, S7; the relief file
  (`~/.js-harness/memory-backup/repo/js-harness-home/relief/D--js-harness.md`: lines 2100 to 2125, the meter around
  JH 125's arms; 2498 to 2566, the stop and the readings of 2026-11-11); the 54 transcripts written on 2026-11-11 and
  the two reader records, summed by window and by who spent (D1, L4); `odd/tasks/advisor-trial.md` (its L3, L4 and
  `## Result`); `bin/sessions-background.mjs:167-173`; `odd/tasks/land-two-defects.md` and its brief in transcript
  `ea85ec35-82e1-4aa9-abe3-98bd153a50b0` from line 6459; `evals/prices.mjs:29-32`; `evals/configs.mjs:10-20`.
- 3. The bar:
  spec 1: `js-harness contract check odd/tasks/advisor-cost.md`: PASS since `cbd75897`.
  spec 2: left out because no command proves every finding of a read answered; the record's `take` entries are read.
  spec 3: left out because its proof is the recorded question, which the lead reads.
- 4. Refutation: could the cost be known with no run? Three cheaper tests, run now. (a) Do the transcripts track the
  Fable meter? Yes, once the readers that leave no transcript are added: over four windows the meter moved 0.14 to
  0.20 points a Fable list-dollar, 0.18 overall (30 points for 163.2 USD, D1). (b) Did the advisor ever show on the
  meter? On 2026-10-31 JH 125's probe and four arms spent about 530,000 advisor tokens of `claude-fable-5-1`, about
  5 to 6 USD, and the weekly Fable meter stayed at 0 % through every reading (L6); at 0.18 that is about 1 point,
  inside the rounding, on another advisor model: it neither shows nor rules out that the advisor counts. (c) Does the
  estimate already decide it? Not quite: at 3 to 10 advisor calls a run the estimate predicts outcome B (D9), but the
  call count is the model's choice and JH 125 saw 1 to 2 a plan, so A is reachable only if a run calls it 2 or 3
  times; that is the unknown the runs measure.
  Verdict: supports
- 5. Request: his request rewritten for this stage, beside his words (L1, L2): "Measure, on one real task of this
  repository, how much Fable a session spends when it runs on Opus 5.5 with the Fable 5.2 advisor, against the
  same task on Fable 5.2 at medium, and whether the advisor's Fable counts on the weekly Fable limit, in two to four
  runs; tell me what that costs before anything runs."
  Adds: none

## Specs
1. "A: primero medir el costo del consejero en el límite de Fable (Recomendado)" (L2): a design of 2 to 4 runs
   that measure how much of the weekly Fable limit the advisor spends, with its cost.
2. The design passes its double review before it reaches him (`rule:double-review`).
3. The design and its cost reach him through the lead as one question, and nothing runs before his answer (L2).

## Tasks
- [x] T1 (kind: design) spec 1: this document, its depth pass and the design below · inline · cbd75897
- [ ] T2 (kind: verify) spec 2: double review, every finding answered · `double-review read` · L7, L9
- [ ] T3 (kind: docs) spec 3: the question recorded for the lead, the notice, the session summary · notify

## The design

### D1. What is measured, and why the reading can be trusted
- The fine record: each run's transcripts, read by `evals/transcript-usage.mjs` extended with the advisor's
  iterations (`message.usage.iterations`, type `advisor_message`) and a Fable 5.2 row whose prices are read from the
  price page with its date. One rule: a run's figures count only when the reader reproduces the CLI's per-model
  totals of that run (`--output-format stream-json`, so a stopped run still leaves its usage lines); otherwise the
  run is void (D5). This settles whether a reply's `usage` already holds its advisor iteration without the meter.
- The unit: Fable list USD, a yardstick. Every figure below was priced with the table JH 185 read from the claude-api
  skill (Fable 5.2 $8 input, $40 output, $0.20 cache read, $10 cache write; Opus 5.5 $4, $20, $0.20, $5), one write
  price a model, not verified here; the runs are priced with the read page and 1-hour writes apart, and the
  calibration is recomputed with the same reader before the probe.
- The coarse meter: the usage card (`get_usage`, a desktop-app tool): weekly Fable, weekly all models, and the
  five-hour share and extra usage when it shows them, whole points.
- The calibration, 2026-11-11, local time (L4): visible Fable is the transcripts; hidden is the reader and lens
  spend the records hold (`costUsd`, the CLI's pricing, assumed Fable).

  | Window | Visible | Hidden | Fable meter | Points a USD |
  |---|---|---|---|---|
  | 11:06-12:59 | 63.0 | 10.1 | 2 → 16 | 0.19 |
  | 12:59-13:56 | 20.0 | 7.9 | 16 → 20 | 0.14 |
  | 13:56-15:03 | 12.9 | 7.2 | 20 → 24 | 0.20 |
  | 15:03-17:02 | 34.6 | 7.5 | 24 → 32 | 0.19 |
  | 11:06-17:02 | 130.5 | 32.7 | 2 → 32 | 0.18 (0.17 to 0.20 with a point each end) |

  The rate is the ordinary one, r_o, for a mix where cache reads are 95 % of input tokens and about a third of the
  list USD; the advisor reads uncached, so its rate r_a is measured apart (D3). Of the 130.5 visible USD the work
  sessions' main threads spent 89.1 (68 %), the lead 34.2 (26 %), sub-agents 7.3 (6 %): the scheme touches about
  74 % of it. The all-models meter moved 16 → 31 in the same span; it is context only (D8).

### D2. The runs
| Order | Run (a bounded group) | Arm | What it answers | Isolated |
|---|---|---|---|---|
| 0 | dry start | each arm's exact command, to one advisor call | the commands, the reader, the watcher | no |
| 1 | probe | `claude-opus-5-5` + `claude-fable-5-2` advisor, a heavy-advisor prompt | r_a against r_o, and credits | yes |
| 2 | control | `claude-fable-5-2` at medium (today's scheme) | the Fable the task spends today | no |
| 3 | advisor 1 | `claude-opus-5-5` + `claude-fable-5-2` advisor | the Fable the task spends in his scheme | no |
| 4 | advisor 2 | same as advisor 1 | how much the advisor arm varies against itself | no |

- One command for every invocation, differing only in model, effort and advisor: `claude -p --model <id> --effort
  <level> [--advisor claude-fable-5-2] --output-format stream-json --verbose --strict-mcp-config --disallowedTools
  "Agent" "Task" "Bash(js-harness:*)" "Bash(*--land*)" "Bash(*--refresh-copy*)" --permission-mode bypassPermissions`
  with the frozen brief, in the user's own home (the login every calibrated session used, so the meter is his plan's)
  and the run's folder as its working directory. Full model ids: the short names ran `claude-fable-5-1` in 2026-10
  (L6). The CLI version is recorded at the dry start and every invocation must match it.
- The dry start, before any pause: each arm's command in a scratch folder until its first reply, and the advisor
  command until one `advisor_message` of `claude-fable-5-2` appears in its transcript and the CLI's totals; the
  extended reader reproduces those totals; the watcher stops a live invocation at a tiny cap and no descendant
  process survives (`taskkill /T`) while its transcript stops growing; the probe's meter reader (D3) returns a
  reading. Any failure stops the trial and goes to him. Its spend, about 3 to 6 USD, is inside the probe's group.
- Opus's effort: high is the lead's proposal; L1 names none, and S1 compared Opus at max; he chooses high or max in
  the question. The advisor has no effort setting (the advisor page as JH 185 quoted it), so his "Advisor de Fable
  5.2 alto" cannot be set as such.
- A run whose model ends its turn before the task's Done when holds is resumed once, in every arm alike, with
  `--resume <id>` and the fixed sentence "Continue until every command of the Done when exits 0, then stop."; a
  second early end makes it void.
- Why the fourth run is a second advisor run: the advisor's call count is the model's choice and swings most; the
  control's own spread stays unmeasured (D10).

### D3. The probe
- What runs: `claude-opus-5-5` at the chosen effort with the advisor, in a folder holding a frozen copy of about
  150,000 tokens of this repository's text, asked to consult the advisor before each of a series of steps.
  Invocations of at most 5 USD of advisor Fable each, two at a time, until the transcripts count 30 USD of advisor
  Fable or 45 minutes pass, whichever comes first; accepted from 15 USD.
- Isolation: for the window, no other Claude spend on the account: every work session reaches a commit and waits,
  no gate, no `codex-review`, `lens-review` or `double-review`, the lead rests on `js-harness wait`, nobody uses
  claude.ai or the phone. The probe is started by a detached script with a 5-minute delay. The check after it
  reads the transcripts, `double-reviews.jsonl`, `lens-reviews.jsonl`, `codex-review-runs.jsonl` and the
  process list over the window; any other Claude spend makes the probe void.
- The meter reader spends no Fable: the owner on the usage page, or a desktop session on a model other than Fable that
  calls `get_usage` every 2 minutes (proven at the dry start). It records the minute of each change of the weekly
  Fable figure, and of the extra usage and credit lines.
- The rate: r_a is fitted from the ticks against the cumulative advisor USD at each tick (points between the first
  and last tick over the USD between them), so the rounding of the two ends drops out; its interval comes from the
  2-minute reading lag at the spend rate. With 15 to 30 USD at 0.18 a USD, about 3 to 5 ticks are expected. A
  reading 10 minutes after the last invocation catches a late count.
- The ratio q = r_a / r_o, with the interval of both.

### D4. The task and its folders
`land-two-defects` (`odd/tasks/land-two-defects.md`): two defects of `merge-queue --land --refresh-copy`, with tests
first; on Fable 5.2 at high it took 1.7 h and about 14 USD at list (`odd/tasks/model-trial.md` L5). Real code of
this repository with tests, finished and merged, never run at medium. Its brief is the lead's text in transcript
`ea85ec35-82e1-4aa9-abe3-98bd153a50b0` from line 6459 (the file `2026-11-11T05-20-31-884Z-8e1e332a.md` is not on
disk), recovered whole, with these changes written beside it: no push, pull request, review, notify, gate or
sub-agent; never run the land or the refresh for real, only tests; the installed shims it must read are the
fixtures at `fixtures/pnpm-bin/` in the folder (copies of the pnpm 12.18.0 shims the task met, as
`odd/tasks/land-two-defects.md` L1 describes them). It is frozen with its sha256 before the dry start. Base:
`7525a4e5`, the parent of `ac2a22e1`, the task's first commit. Each folder is `git archive` of the base plus a fresh
`git init`, under `D:\advisor-cost-runs\<run>`. What still reaches outside: the sandbox is redirection only
(`evals/configs.mjs:10-20`), no OS boundary holds the run in its folder, and the folder's own hooks call the
installed `js-harness` as a real session's do. Two guards and a void rule answer it: the denied commands of D2; the
installed copy's head (`js-harness --version` and its `package.json`) read before and after each run, a change
stopping the trial at once and going to him with the refresh's undo; and D5's rule on paths.

### D5. A run's validity, fixed before any run
A run counts only when all hold; otherwise it is void, its spend is reported and counted against the maxima, and
it is not run again without his word:
- every executor reply is the run's model id, every `advisor_message` is `claude-fable-5-2`, the CLI version is the
  dry start's, and no sub-agent ran;
- the reader reproduces the CLI's per-model totals (D1);
- no tool call of the run names a path under `D:\js-harness`, `~/.js-harness` or the pnpm store;
- for the control and the advisor runs, the task is done, checked from outside the run: each test the run added
  fails on the base's code (its test files copied over a fresh archive of `7525a4e5`) and passes on the run's code,
  with at least one such test for each defect; and `node --test bin/` passes in the run's folder. The merged task's
  own tests from its pull request are run on each result too and reported, not gating, since they may name the
  functions differently;
- for the advisor runs, at least one advisor call (none: void as "no advisor", Opus alone, not judged here);
- for the probe, isolation held, the reader worked, and at least 15 USD of advisor Fable.

### D6. The rules the invocations need excepted
`js-harness sessions start` refuses Opus and any effort but the rule's (`bin/sessions-background.mjs:167-173`), and
`rule:session-model` names Fable 5.2 for every session. Every Opus invocation of the trial (the dry start's, the
probe's and the two advisor runs') needs his exception to `rule:session-model` and `rule:session-effort`, for this
trial alone. All invocations start with D2's command, outside `sessions start`, so the control is started the same
way. The exception changes no rule and ends with the trial.

### D7. The trial's cost, its maxima and when it can start (an estimate)
| Group | Fable list USD | Opus list USD | Weekly Fable points at 0.18 | Wall clock |
|---|---|---|---|---|
| dry start and probe | 33 to 41 | 4 to 10 | 6 to 7 | 1 to 1.5 h |
| control | 7 to 14 | 0 | 1 to 3 | 1 to 2 h |
| advisor 1 | 5 to 24 | 7 to 25 | 1 to 4 | 2 to 7 h |
| advisor 2 | 5 to 24 | 7 to 25 | 1 to 4 | 2 to 7 h |
| the driving session, the lead's wakes | 15 to 30 | 0 | 3 to 5 | through all |
| the pause: re-writing the paused sessions' caches | 2 to 6 | 0 | under 1 | once |
| Total | 67 to 139 | 18 to 60 | 12 to 25 | 4 to 10 h expected, 16 h at most |

How: the control at medium under the original 14 USD at high; each advisor call 150,000 to 250,000 uncached tokens
at $8 a million plus about 10,000 output tokens at $40, so 1.6 to 2.4 USD a call, 3 to 10 calls; the Opus executor
at half Fable's price per token but 1.8 to 3.3 times as long (JH 125); the pause as two sessions of up to 250,000
tokens re-written at $10 a million. Total at list price: about 85 to 200 USD.
- Maxima put to him: 200 USD at list and 35 weekly Fable points for the trial, enforced on the sum of every group,
  the void ones included; per group, the probe 45 USD Fable and 12 USD Opus, the control 25 USD Fable, each advisor
  run 25 USD Fable, 35 USD Opus and 7 hours (above 3.3 times the control's 2 hours). A watcher script with no model
  reads every group's transcripts every 2 minutes; no group starts when the spend so far plus that group's maxima
  would pass the trial's; at any maximum it stops every trial process with its tree. Overshoot: up to 2 minutes of
  spend plus one call in flight, whose usage is written only when it ends (an advisor call is up to about 2.4 USD).
- When: only with room. On 2026-11-11 at 17:02 local the meter read 32 % and rose about 5 points an hour with
  ordinary work, so the week runs out before its reset on 2026-11-13 09:00 local without any trial. The trial starts
  after that reset, or earlier only while 100 minus the meter is at least 35 plus a reserve he names. A limit
  message in any invocation stops the trial, voids that run, and goes to him with the spend; it would stop every
  work session too.

### D8. What the trial does not measure
The all-models meter is not attributed: the advisor runs share the account with other sessions, and in the probe
the Opus executor and the advisor move it together. Its readings are recorded account-wide, and the Opus list USD
of each run is reported, since his week holds both. Nor the limit that stopped the sessions on 2026-11-11, which the
card did not show (L5).

### D9. The criterion, fixed before any run
First the probe, read on q = r_a / r_o (D3):
- P1. The dry start fails, or the probe is void: the trial stops; the spend and the reason go to him.
- P2. The advisor's Fable counts clearly less on the meter (the upper bound of q under 0.5), or the interval of q
  holds both 0.5 and 1: the trial stops at the probe and he gets q, its interval, and the question whether to go
  on, since the comparison in USD below would not stand for the meter.
- P3. A credit balance or extra-usage line changed during the probe: the trial stops; the money goes to him.
- P4. The advisor counts about like ordinary Fable (the lower bound of q at least 0.5): the three task runs go on.
Then the task runs, compared in Fable list USD from the transcripts, the same instrument for both arms, with q
carrying the meter's difference: F_c is the control's Fable USD, F_1 and F_2 the advisor runs' advisor Fable USD,
T the threshold he sets.
- A. q_high × max(F_1, F_2) ≤ T × F_c: the scheme spends clearly less of the Fable limit on this task.
- B. q_low × min(F_1, F_2) > T × F_c: it clearly does not save that much.
- C. Anything else: not resolved at this size.
- The control void: no comparison; the figures and the void go to him. One advisor run void: the other is reported
  alone, and the outcome is at most C. Both void: no answer.
Each outcome reaches him with the figures in Fable points and Opus USD, the session share of D1, and a question:
A, whether to run a smaller quality trial; B, whether to drop the idea; C, whether to drop it or run more. Nothing
changes before his answer.
Operating points, worked now with T = 0.5 (his to change) and q measured near 1 within ±15 % (an estimate of what
3 to 5 ticks give): A needs each advisor run at or below 0.43 × F_c, that is 3 to 6 USD of advisor Fable against a
control of 7 to 14, about 2 or 3 advisor calls; B needs both above 0.59 × F_c. At the estimated 3 to 10 calls a run,
B is the likeliest outcome; A happens only if the model calls the advisor about as rarely as JH 125 saw.

### D10. Limits
- One task, of this repository's process work; one control run, so the control's own spread is unmeasured.
- No sub-agents and no MCP servers in any arm, unlike a real session: his idea includes sub-agents, and they
  inherit the advisor; their share is 6 % of the day's visible Fable (D1).
- Quality is not measured; completion is checked by tests only.
- The calibration rests on one day's mix and assumes the hidden reader spend is Fable (D1).
- The run's folder is not an OS boundary (D4).

### D11. Where the work continues
This document, on the branch `advisor-cost` cut from `worktree-model-trial` at `4e2ec314`, so that the model-trial
document, its log and JH 185's summary it cites travel with it, while the cost trial keeps a contract of its own
that `check` validates apart from the quality trial he did not choose. The runs, after his yes, continue here.

## The question
The text recorded for the lead, in his language:

"Pregunta: Para js-harness, la prueba de costo del consejero (JH 187, por tu respuesta A a la 265). Lo malo
primero: según la estimación, lo más probable es que la prueba muestre que el consejero NO reduce a la mitad el
gasto de Fable, porque relee toda la conversación sin caché en cada llamada; solo lo lograría si lo llamara 2 o 3
veces por sesión. Medí gratis con los registros de hoy: cada punto del límite semanal de Fable son unos 5,4 USD de
Fable a precio de lista, y las sesiones de trabajo gastan el 68 % del Fable, el líder el 26 %. La prueba: una sonda
de 45 minutos con todas las sesiones en pausa, que mide si el Fable del consejero cuenta en tu límite semanal, y
luego la tarea real land-two-defects una vez en Fable 5.2 medio y dos veces en Opus 5.5 con el consejero. Cuesta
unos 85 a 200 USD a precio de lista y 12 a 25 puntos del límite semanal de Fable, con tope de 200 USD y 35 puntos;
dura de 4 a 10 horas. Solo arranca después del reinicio del 13-11 a las 09:00, o antes si queda espacio. Un sí a A
autoriza esa prueba y una excepción a las reglas de modelo y esfuerzo solo para sus corridas en Opus, con Opus en
alto y el umbral en la mitad; no cambia ninguna regla ni ningún modelo, y cada resultado vuelve a ti como
pregunta. B: lo mismo con Opus en máximo, que es el que tú mediste. C: no correrla y dejar las sesiones en Fable
5.2 medio. Diseño: odd/tasks/advisor-cost.md en la rama advisor-cost."
Options: A, correr la prueba con Opus alto (Recomendado); B, correrla con Opus máximo; C, no correrla.

## State after the third review (for the session that takes this over)
The third read (`9d0cbfe1`, L10) still found real failures, so by `rule:double-review` this design reaches him as a
problem, not as the question above, and the work passes to Fable 5.2 at medium (his answer to question 266, L8).
The question text above is NOT to be asked as it stands. Open, in order of weight:
1. The premise of the calibration is in doubt (Claude 1, Codex 4): the card read weekly Fable 0 % at 10:16 on
   2026-11-11 after 50.4 Fable session-hours that week (relief line 2498), then 2 → 32 in six hours. So the meter
   did not track Fable at one steady rate, or it was reset about 10:00 and its shown reset date is not its own.
   r_o from D1 may not hold after a reset. Fix: an A-B-A probe in one isolated window (ordinary Fable, advisor,
   ordinary), q from the concurrent r_o only, and a stop when the ordinary block moves no tick. Before any of it,
   find out what the 0 % at 10:16 was: a free look at the card's reset time against the lead's readings.
2. The probe's estimator and table are not exhaustive (Claude 5, Codex 2): 0 or 1 tick undefined; q in 0.4 to 0.8
   uncovered; precision asserted. Accept by ticks, bounds for 0 and 1 tick, drop P2's second clause.
3. The completion rule voids a correct run (Claude 2, Codex 5): tests that pass on both are required by the task
   itself; red by import error passes; the base suite can be edited away. Per-defect assertion failures by a script
   committed before the dry start, a trusted copy of the base suite, held-out behaviour checks that gate.
4. A capped run should be censored, not void (Claude 3): its F is a lower bound, enough for B, never for A; size the
   advisor call from a real 2-hour session's context and state the executor's context window (`opus[1m]`).
5. One control cannot carry "clearly" (Claude 4): a spread factor fixed before the runs, outcomes "indicative", and
   his bar of five a side (`odd/tasks/audit-u9-eval-bar.md:148`) named as not met by his choice of 2 to 4 runs.
6. The maxima are soft (Claude 6, Codex 3): the points cap needs a stated conversion, group caps sum to 238 against
   200, two concurrent streams double the overshoot; bounded request sizes or a disclosed overshoot.
7. Containment (Claude 7, 13, Codex 1): PowerShell not denied, `node bin/js-harness.mjs notify` reaches the lead's
   record, deny rules untested under bypass, hooks at turn end unprobed, the answer reachable in `~/.claude/projects`
   and through `gh`. A filesystem boundary that keeps the login, or a disclosed residual risk he accepts.
8. The resume names a Done when the brief forbids (Claude 8): done is D5's outside check, decided by a script.
9. The question's figures (Claude 9, 10, 11, Codex 6, 7): prices unverified (read the page, free), shares over 163.2
   (55 %, 21 %, 4 %, reviewers 20 %), the day ran at high; reserve and start window as blanks, what he must not do
   in the probe, the risk of tripping the unknown limit, no sub-agents, option B priced apart, duration 6 to 17.5 h
   plus validation, the invocation count behind "four runs", ordinary sessions' own use after the probe.
10. Smaller: the search for his "50 %" line belongs in `ea85ec35` lines 11253 to 11679 (Claude 12); the lead's
   heartbeat, wait and quiet --wait stopped and restarted as probe steps, and L9's "S1 whole" reworded (Claude 14).
A cheaper first step these findings point to, not reviewed: before any trial, explain the 0 % reading of 10:16 from
records and the card (free); if the weekly Fable meter was reset that morning, the calibration has to be redone
after the next reset anyway, and the whole trial's premise changes.

## Runs
None. Nothing runs before his yes.

## Log
- L1 2026-11-11T19:14:42Z, his words to the lead (transcript `f0959bbd-5f7a-4360-b626-048caf21067f`, line 2320):
  "Me gustaria que investigaramos si seria mejor seguir utilizando Fable 5.2 Alto solo en el orquestador y Opus 5.5
  para las sesione sy subagente pero con el Advisor de Fable 5.2 alto que te parece?"
- L2 2026-11-11T22:35:04Z, his answer to question 265 (same transcript, line 4186, tapped): "A: primero medir el
  costo del consejero en el límite de Fable (Recomendado)". The question it answers said: a session on Fable 5.2
  medium, about 15 to 30 USD, that designs only a cost trial of 2 to 4 runs measuring how much of the weekly Fable
  limit the advisor spends, and returns with its cost before running anything; no run nor rule change authorized.
- L3 The brief (`~/.js-harness/background/briefs/2026-11-11T22-38-14-780Z-71d7af6e.md`): JH 187 continues JH 185's
  work; the design passes its double review, the Claude reader at high (his answer to question 260, at `f0959bbd`
  line 822 as `odd/tasks/one-model-home.md` cites it); report through the lead.
- L4 2026-11-11, the calibration of D1, by scratch scripts (`$CLAUDE_JOB_DIR/tmp/window.js`, `readers.js`): visible
  Fable list USD by window 63.0, 20.0, 12.9, 34.6 over 54 transcripts; hidden, `double-reviews.jsonl` 3.68, 7.91,
  0, 3.99 and `lens-reviews.jsonl` 6.42, 0, 7.22, 3.51; Opus 4.2 in the last window only; no `advisor:` row. Split of
  11:06-17:02 by who spent: work sessions 89.1, the lead (`f0959bbd`) 34.2, sub-agents 7.3. To be recomputed with the
  extended reader before the probe.
- L5 The lead's relief file, line 2498 (10:17 local, 2026-11-11): "the Fable limit was reached at 06:50 local"; the
  card at 10:16 "weekly all models 16%, weekly Fable 0%, resets 2026-11-13 09:00 local [...] it shows no 5-hour
  window, so which limit was hit is NOT known". Line 2501 (10:35): "His words: only 50% of his weekly use can go to
  Fable" (the lead's paraphrase; his typed line not found).
- L6 2026-10-31: `odd/tasks/advisor-trial.md` L4, the probe `claude -p --model opus --advisor fable` ran its advisor
  as `claude-fable-5-1`; the relief file, lines 2100 to 2125: the card read weekly Fable 0 % at 14:17Z, 15:27Z,
  15:57Z, 16:13Z, 16:25Z and 16:34Z, "Fable weekly meter stayed 0% despite ~530k Fable tokens", while the five-hour
  share went 9 → 12 % and the weekly all models 16 → 17 %.
- L7 Double review `dcf9c9a7` of `cbd75897` (Claude 13 findings, 872,331 tokens; Codex 8, 286,158; its cost said
  before it ran: about 1.1 M Claude and 0.9 M Codex tokens). All 21 taken and the design rewritten in `934035fe`;
  the confirming read (L9) found that several were fixed otherwise than asked, recorded there.
- L8 Which model wrote it: this session runs on `claude-opus-5-5` at medium, not Fable 5.2 at medium as question 265
  said (the lead started it naming no model). His answer to question 266 (lead transcript `812b728f`, line 748,
  2026-11-11T22:57:43Z, tapped): "Que termine en Opus (Recomendado)": the double review is finished on Opus, and
  the session moves to Fable 5.2 medium only if it fails. The readers ran on `claude-fable-5-2` and `gpt-6.1-sol`.
- L9 Confirming read `ce27e0ae` of `934035fe` (Claude 14 findings, 1,226,597 tokens; Codex 8, 346,705; cost said
  before it ran, the same). All 22 taken, rewritten here, each fixed as asked unless named: headroom and a start
  after the reset (Claude 1); operating points worked and the comparison moved to USD with q, so the threshold is
  the effective one (Claude 2, Codex 2); the dry start proves an advisor call, the home is his own login (the
  positive control), credits read on the card (Claude 3; fixed otherwise: no sandbox credential, the user's home);
  hidden reader spend added, r_o 0.18 (Claude 4); completion checked from outside, red on the base, the base suite
  green, the merged tests reported (Claude 5, Codex 6; fixed otherwise: no new held-out tests written now, the
  merged pull request's tests stand in); fixtures for the shims, paths void a run, denied commands, the installed
  copy's head watched, residual access said (Claude 6, Codex 7; fixed otherwise: no OS boundary); the probe sized in
  5-USD invocations, accepted from 15 USD, read by tick timing by a reader that spends no Fable (Claude 7, Codex 3,
  Codex 4); void runs in D9, P2 stops (Claude 8); the committed reader, one mismatch rule, stream-json (Claude 9);
  an enforced trial maximum, the kill proven in the dry start, 7 h cap (Claude 10, Codex 1); S1 whole, the
  question's text in the document, all-models and Opus USD as context (Claude 11; fixed otherwise: his line on half
  the week not found, kept as the lead's paraphrase); the 2026-10-31 readings read (Claude 12); figures (Claude 13);
  this per-finding record (Claude 14); groups bound the invocations and the exception covers them (Codex 5); wall
  clock (Codex 8). Rebutted: none.
- L10 Third read `9d0cbfe1` of `af629d67` (Claude 14 findings, 1,717,768 tokens; Codex 7, 535,366; cost said
  before it ran, the same). All 21 accepted and recorded as taken, not fixed: the third review is the last
  (`rule:double-review`), so they are the state above, for the next writer, and the problem put to him.
