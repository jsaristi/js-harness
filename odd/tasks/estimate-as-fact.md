# Guard: a forecast said as a fact is turned back

Locator: `odd/tasks/estimate-as-fact.md` · Engram mirror: `odd/estimate-as-fact/tasks` · Branch:
`worktree-estimate-as-fact` (worktree `.claude/worktrees/estimate-as-fact`) · Session: JH 122.
Delivery: one slice, one pull request. Test runner: `node --test`.

## Goal
`js-harness guard --stop` turns back a reply that states a forecast (a duration, a time of arrival or a cost of
what has not happened yet) with no estimate mark and no measurement named, in the same reading of stated figures
that already turns back a wrong context share.

## Why
Row 72 of the lead's duties ("Each claim checked, assumed or not known; an estimate says so", protocols:98) has
failed 6 times (`estimate-passed-as-fact` in `docs/FAILURES.md`), and only its context-share half has a check. A
figure of the future cannot have been measured, so a reply that states one bare is stating an estimate as a fact.

## Done when
- `node --test bin/lib/audit.test.mjs bin/guard.test.mjs` exits 0
- `node --test bin/reply-budget.test.mjs` exits 0 (the Stop hooks' budget), and the check's own cost per stop is
  written in the log
- `npm run check` exits 0
- Row 72 of `odd/tasks/lead-duty-checks.md` names this check as its control, and the failure's `Control:` line is
  the check.
- The change is on main through a pull request that passed Codex and the Claude lenses, and an independent
  verifier read it.

## In scope / Out of scope
- In: `bin/lib/audit.mjs` (amend `ownShares`'s reading of a reply into one reading of stated figures, no second
  parser), `bin/guard.mjs`'s `stopRefusalOf`, their tests, the guard's help and header lines, the hook entry's
  comment (`bin/lib/hook-entries.mjs`), README's and SPEC's lines on `guard --stop`, `docs/FAILURES.md`'s control
  line, row 72. ROADMAP is not touched, as JH 118 and JH 120 did not touch it: `odd/tasks/lead-duty-checks.md` holds
  the list.
- Out: a count or a past figure with no source ("some fifty thousand git processes", "62 of 352"): measured over
  the lead's transcript, reading them turns back 77 of 595 replies, nearly all measured figures that name no command
  (L4). A premise with no figure ("most of its time is fixtures"). A forecast in present tense ("JH 69 termina a las
  10:30") or in the first person future ("volveré a las 10:30", a plan of the writer's own). Figures inside code
  blocks, inline code, quote lines or quoted text: they are not the writer's words.

## Constraints
- Amend the share reader of `bin/lib/audit.mjs` — because the brief and AGENTS.md ask for one reading of stated
  figures, not a second parser.
- The share check's behavior stays exactly as it is — because it is its own control with its own tests.
- A reply's text is read from the host's `last_assistant_message` when it gives one, so the forecast reading costs no
  transcript read — because the Stop hooks share a 15 s stop with eight others.
- Run only the tests the change needs before the gate — because the machine is short of memory (brief).
- A Stop hook guard is Task Size high risk (items 2 and 6) — so Codex and the Claude lenses on the slice, then an
  independent verifier.

## Ask me before
Nothing: his answer to question 135 (2026-10-31, "Los tres primeros (Recomendado)") authorizes this check and says it
changes no rule of his. Spend: one gate, one Codex review, the Claude lenses, one verifier.

## Specs
- S1. Brief of JH 122, from his answer to question 135 ("Los tres primeros (Recomendado)", transcript 0f71b2c6, line
  38994, which named it "una estimación dicha como hecho (6 veces)"): "`guard --stop` reads stated durations and
  forecasts as it reads the context share".
- S2. Cases, from the brief: a forecast with no estimate mark (turned back), the same with one (passes), a measured
  figure that names its command or file (passes), and a quoted figure inside a code block or a quote (passes).
- S3. False positives stay rare, with a count over the lead's real transcript and a sample (brief).
- S4. The check's cost per stop is said, and the Stop hook's budget stays green (brief).

## Tasks
- [x] T1 (S1-S4, kind: build): `statedFigures` in `bin/lib/audit.mjs` (shares and forecasts in one walk; `ownShares`
  reads its shares) and `forecastRefusal`; `stopRefusalOf` in `bin/guard.mjs` checks both; tests first. Route:
  inline. RED: `bin/lib/audit.test.mjs` could not load (`forecastRefusal` not exported); then each false positive of
  L4 added as a case before its fix (1 failing each round). GREEN: audit 20/20, guard 39/39.
- [x] T2 (kind: docs): FAILURES control line, row 72, help, README, SPEC and header lines. `failures check` passes.
- [x] T3 (kind: verify): gate, Codex review, Claude lenses, independent verifier, pull request, ready notice. Each
  code commit gated and reviewed (L6, L8); verifier on 41f774d8 (L7); budget tests (L9). Merge: the lead's.

## Log
- L1 (2026-10-31, the brief as written,
  `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T08-49-27-830Z-11e16d1d.md`): "JH 122 · guard --stop: an
  estimate said as a fact is turned back". His decision: question 135, answered "Los tres primeros (Recomendado)";
  the question said "Un sí abre una sesión por chequeo, una tras otra, cada una con sus pruebas y sus revisiones
  (Codex y los lentes), dentro del plan; no cambia ninguna regla tuya."
- L2 (2026-10-31, search): codegraph and grep for the stop check found `stopRefusalOf` (`bin/guard.mjs:212`) calling
  `lastShare` and `shareRefusal` of `bin/lib/audit.mjs`, whose `ownShares` splits a reply into clauses and reads the
  writer's own share in each. `js-harness rules` holds no rule for estimates (grep "estimat": only the two token
  budgets); the duty lives in the protocols skill's line 98. `bin/reply-budget.test.mjs` times the reply hook
  (`js-harness reply --hook`), a separate Stop hook: `guard --stop` is not in its process. Decision: one walk over a
  reply's lines and clauses (`statedFigures`) yields both the shares, read exactly as `ownShares` read them, and the
  forecasts; `ownShares` becomes its share half.
- L3 (2026-10-31, the six sightings read, what the check reaches): (1) gate-lock.md:927, "most of its time is
  fixtures", from notes: no figure, out of reach. (2) relief line 183 and gate-lock.md:1088, "three shards would bring
  the gate near 500 s": marked ("near", "arithmetic and not measured"), so it passes; its failure was a decision taken
  on a marked estimate, which no reading of the words reaches. Its bare form, "three shards will bring the gate to
  500 s", is turned back. (3) relief line 186, context shares between two reads, unmarked: the share check. (4)
  relief line 220, "some fifty thousand git processes": a count, marked "some", out of reach (L4). (5) relief line
  615, "62 of 352, modest": a count told before its readers, out of reach. (6) JH 7's "Contexto cerca del 35 %"
  without a read: the share check. So the new reading alone would have caught none of the six as they were written;
  it holds the class's bare forecast, which the sightings show in their unmarked forms, and the share check keeps
  two of six.
- L4 (2026-10-31, false positives, measured with `count.mjs` in the job's scratch folder over each transcript's
  `end_turn` replies, the replies a Stop hook sees; read only). How they stay rare, decided: (a) a forecast is read
  only where a figure (a duration, a time of day, a cost) stands within 6 words of a future (third person future or
  conditional, "va a", "dentro de N minutos", "faltan N", "will", "would", "should take", "by 10:30"), never a figure
  alone; (b) any estimate mark, range or bound anywhere in the clause lets it pass, so the check errs toward passing;
  (c) code blocks, inline code, quote lines and quoted text are not read; (d) the writer's own plans (first person
  future, "voy a", "para las 3:05" of a schedule) and figures inside a "si"/"if" condition are not read. Counts and
  past figures are not read at all: over the lead's transcript, reading every time or cost figure with no mark and no
  source turned back 77 of 595 replies, nearly all measured figures that name no command ("costaron $12,31 en
  total", "lleva 37 minutos"). Counts: the first draft turned back 12 of 595 of the lead's replies, then 1; the
  version built turns back 0 of 596 (0f71b2c6). Over the 40 newest other transcripts of `D--js-harness` (set A,
  which the cases were tuned on) 35 of 3,263, then 3: one true ("escribirlos ahora costaría otro gate de 17 minutos",
  43523cfc), two false (the voseo imperative "Esperá a que pasen las 16:45:10", read as a future; "1.030.000 tokens
  de JH 12, que se va a evitar", a measured figure beside a future). Over the next 40 (set B, held out) 3 of 1,947,
  two fixed after (a budget "dentro de los 638.400"; a sentence ending inside bold marks). Over the next 40 (set C,
  held out) 8 of 2,378 before the last two marks ("después de", a range "3 o 4"), 6 after, of which most are forks
  of the same sessions: "466.240 tokens de Codex, que podría pasar el tope" and the 1.030.000 one (false), "faltan 3
  días y 13 horas" of the plan's week (a computed reset, false), "Lo medí sobre los 491 registros ...: solo 4
  re-revisiones se habrían evitado en 17 días" (measured, naming no command: turned back by design). Altogether,
  10 of 7,588 replies of 120 work transcripts, and 0 of the lead's 596. Left as known: a voseo imperative in "-erá"
  and a measured figure within 6 words of an unrelated future.
- L5 (2026-10-31, cost per stop, measured): the reading costs per reply p50 0.05 to 0.07 ms and p90 0.19 to 0.32 ms
  warm, at most 7.4 ms (`count.mjs`, all sets). In a fresh process, as the hook runs, the first `forecastRefusal` on
  a reply of 3,588 characters takes 19 to 22 ms beside an import of 65 to 81 ms (`cold.mjs`, three runs); a whole
  `guard --stop` process on the lead's longest reply (3,780 characters) took a median of 159 to 179 ms against 120
  to 133 ms for the shared checkout's guard (`stopcost.mjs`, 10 runs each, twice). It reads no file when the host
  sends the reply's text, so the transcript read stays where it was: only for a reply that states a share. The reply
  hook's budget tests (`bin/reply-budget.test.mjs`) time `js-harness reply --hook`, another process, which this
  change does not touch; they are run before the push (T3).
- L6 (2026-10-31, reviews of 9e22eb36..41f774d8): the Claude lenses reliability and risk, 0 findings (recorded).
  Codex, "the patch is incorrect" (0.99), one P2: quoted text or inline code holding a sentence's end ("Ready. The
  gate will take 12 minutes.") was cut into clauses before `proseOf` masked it, so the part after the cut was read
  as the writer's. Fixed: each prose line is masked first, with masks padded to the same length (`CODE`, `QUOTE`), its
  clauses cut from the masked line (`clauseSpans`, which also takes the cut after bold marks) and quoted from the
  line as written. RED: 1 (Codex's two inputs); GREEN: audit 20/20, guard 39/39; counts unchanged (0 of 597, 10 of
  7,588).
- L7 (2026-10-31, the independent verifier on 41f774d8, read from `git archive 41f774d8`): `ownShares` identical to
  before on 100,236 inputs at 4 windows and on 2,043 real replies (0 differences); `guard --stop` identical on 768
  payload combinations, an old reason always kept, a throw always letting the stop through. Two WARNINGs, fixed:
  `\b` knows no accented letter, so "lo medí" and "leí" never named a measurement (a real false positive in the
  status-line worktree's transcript); "I'll" and "I will", the writer's own plan, were read. NOTEs fixed: quadratic
  time on long single-line clauses (10.2 s on 49 KB of "5 s "): word indexes found by halving over the word starts
  read once, the future words marked in one array, the path pattern read from a word's start and the cost pattern's
  adjacent `\s*` made `\s?`; an ISO date read as a range; a curly apostrophe; euros; "Irán" read as a future. NOTEs
  left, written as known: a scheduled time said in the future tense ("la próxima corrida será a las 3:05", none in
  the transcripts); a forecast with no future verb ("Listo en 12 minutos", "Quedan 20 minutos"); marks that pass a
  clause from anywhere in it ("~/repo", "y/o"); a reply stating a share and a forecast with an unreadable transcript,
  or none sent and no reply with usage, stops quietly (fail open, as every failure of the hook); "-ería" nouns past
  the list; a counterfactual past ("habría tardado"); indented code and HTML comments read as prose. RED: 3 (the
  verifier's inputs, and 21 s on the long-line test); GREEN: audit 21/21, guard 39/39. Counts after: 0 of the
  lead's 597; 9 of 7,588 over the 120 work transcripts, 5 distinct (forks repeat them), 1 true. Cold cost after: the
  first `forecastRefusal` on 3,588 characters 10.7 to 11.7 ms, import 31 to 34 ms (`cold.mjs`, three runs, a
  quieter machine than L5's).
- L8 (2026-10-31, reviews of 41f774d8..638e27fe): Codex, "the patch is correct" (0.98), a recheck of its finding
  (fixed); the lenses reliability and risk, 0 findings. gentle-ai: its stop hook offered the whole branch (base
  9e22eb3); the status was read and nothing started (CLAUDE.md), so no gentle-ai line names these commits.
- L9 (2026-10-31, the Stop budget before the push, the lead's 09:30Z ask): `node --test bin/reply-budget.test.mjs`
  on 638e27fe, on Windows (not WSL2, where PR 736's land was red), 4/4: the lead's stop p90 729 ms, a work session's
  p90 646 ms, budget 2500 ms. Those tests time `reply --hook`, which does not load `bin/lib/audit.mjs`; this check
  runs in `guard --stop`, its own process, at 11 to 22 ms for its first reading (L5, L7).
- L10 (2026-10-31, his decision, question 142, answered "Descartarlo (Recomendada)", transcript 0f71b2c6, line
  42276, 11:31:54Z, read with `js-harness sessions --quote`; relayed by the lead): PR 737 is closed without merging.
  Why the check did not earn its place: it catches none of the six sightings that motivated it (three were already
  marked as estimates, two were counts and one a premise with no figure, L3); over real replies it turned back 0 of
  the lead's 597 and 9 of 7,588 of work sessions (5 distinct, 1 a true forecast, L7); and it costs 11 to 22 ms a
  stop (L5, L7). A net for bare forecasts that have not happened yet was not worth that cost and the code to keep.
  Row 72 of `odd/tasks/lead-duty-checks.md` stays without its own control on main: its share half is still checked
  by `shareRefusal`, as before; this branch's edits to row 72, item 3 and `docs/FAILURES.md` do not land. The branch
  is kept: deleting it is his yes, still unasked.
