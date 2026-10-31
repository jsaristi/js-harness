# JH 126 · Align the harness to the depth pass, first the Claude and Codex double review

Locator: `odd/tasks/double-review-alignment.md` · Engram mirror: `odd/double-review-alignment/tasks` · Branch:
`rule/double-review` (worktree `harness-alignment`) · Delivery: one pull request to main · Test runner: `node --test`

## Goal
`rule:double-review` says, in one home, what he answered to questions 145 to 148: two blind reads, one of Claude and
one of Codex, on plans, designs, proposing documents and every small code change, beside code's two reviews, skipped
only by his words; a command runs both readers on the same frozen material and records every finding for the
judgement of 2026-11-16; below the Codex reserve a second Claude reader takes Codex's place and code keeps a Codex
debt the merge door lists; and the older texts that contradict rule 1 or this design are listed here and aligned.

## Why
On 2026-10-31 he asked to "alinear todo el arnes para que no vaya a quedar contradicciones o algo antiguo" (L1) once
rule 1 landed (PR 738). His answers 145 to 148 (L2 to L5) replaced the double review he narrowed on 2026-10-27 (his D5)
with a Claude reader and a Codex reader on everything, and decided what happens when Codex's weekly limit runs low.
That limit read 79% used this morning (`js-harness codex-meter`), and this week's 328 code reviews alone reach the
reserve before the reset on 2026-11-04 (Depth pass, item 2), so the reserve is built first.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/double-review-alignment.md` exits 0
- `node bin/js-harness.mjs rules codex-reserve` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node --test bin/double-review.test.mjs bin/lib/double-review-records.test.mjs bin/codex-review-reserve.test.mjs bin/lib/codex-reserve.test.mjs` exits 0
- `node --test bin/lib/protocols-skill.test.mjs bin/lib/project.test.mjs bin/lib/template-block.test.mjs bin/contract.test.mjs` exits 0, with `protocols-skill.test.mjs` asserting section 1's new text
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `rule:double-review` and a new rule, `codex-reserve`, through `js-harness rules change`; the protocols skill's
  source (`bin/lib/protocols-skill.mjs`, sections 1, 6, 7); `claudeBlock` (`bin/lib/project.mjs`); a new command
  `js-harness double-review` (`bin/double-review.mjs`, `bin/lib/double-review-*.mjs`, the dispatcher
  `bin/js-harness.mjs`, `README.md`); the reserve in `codex-review` (`bin/codex-review.mjs`, `bin/lib/codex-reserve.mjs`)
  and its debt in `codex-meter` (`bin/codex-meter.mjs`); the older texts of `## Older texts` below, each named there before it
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
  `bin/lib/protocols-skill.mjs:112` (section 7 restates the roles); `docs/ROADMAP.md:68` (the Review row: a spent
  limit is never a skip, 2026-10-11); `bin/lib/codex-review-coverage.mjs:291` (a skip covers a commit);
  `bin/lib/merge-queue-reviews.mjs:78` (the door lists a Codex skip, passes); `bin/lib/lens-review-rows.mjs:60` (the
  door refuses a lens skip); `CLAUDE.md:92` ("the merge door refuses until a review pays it", one rule for both);
  `CLAUDE.md:24` and `bin/lib/project.mjs:395` (the feature order; the init block holds none);
  `bin/contract.mjs:438` (`depthPassSince` read, written by nobody).
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
  is built first, and it acts on the meter, never on this estimate.
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

## Specs
1. "Y si mejor no hacemos dos lectores A y B sino que hacemos una de Claude y una de Codex para tener 2 perspectivas
   diferentes pero que sean dos revisiones ciegas independientes?" (L2)
2. "Me gustaria en todo, pero que me dieras la opcion de cuando si y cuando no, siento que siempre todo se debe
   revisar doble pero de la forma de nos de criterio y con la filosofia nueva que tenemos ya que todo es importante a
   menos que yo como usuario te diga que no quiero la revision, esa seria la unica opcion de que no se hiciera." (L3)
3. "Sí, pero también en el código chico" (L4, tapped, to question 147's corrected design).
4. "Claude reemplaza y Codex paga después (Recomendada)" (L5, tapped, to question 148).
5. "entiendo que tenemos que alinear todo el arnes para que no vaya a quedar contradicciones o algo antiguo" (L1).
6. The eval of PR 737's brief, with and without the rule, owed by 2026-11-30 (`docs/ROADMAP.md:716`): planned here.

## Older texts
Each text found that contradicts rule 1 or this design, before it changes; the search: `grep -rnE "two (read-only
)?readers|double review|double-review|attacks its claims|what is missing"` over the repository outside `odd/tasks/`,
`docs/sessions/`, `docs/origin.md` and `docs/proposals/`, the roadmap's list (`docs/ROADMAP.md:714`), and the two
readers of this plan (L8), who found items 11 to 17.
1. `bin/lib/protocols-skill.mjs:43`, section 1: D5's scope and two roles. Becomes his design (T4).
2. `bin/lib/project.mjs:411`, `claudeBlock`: a second scope text with the two roles. Becomes a pointer to
   `rule:double-review` (T4).
3. `bin/lib/protocols-skill.mjs:112`, section 7: restates the roles ("one rerunning the figures ..., one looking for
   what is missing"). Names the rule only (T4).
4. `docs/ROADMAP.md:68`, the Review row: a spent weekly limit is "never recorded as a skip" (2026-10-11). Below the
   reserve it now is, by question 148 (T2).
5. `CLAUDE.md:92`: "the merge door refuses until a review pays it" for any skip; the door lists a Codex skip and
   refuses a lens skip (raw material). Says each (T5).
6. `CLAUDE.md:24`: the feature document's order lacks `## Depth pass` after the contract. Gains it (T5).
7. The block `init` writes (`claudeBlock`): the roadmap says it holds the feature order; it holds none
   (`bin/lib/project.mjs:395`), so nothing changes there.
8. `js-harness contract template`: no `## Depth pass` skeleton. Gains it (T5).
9. `sync`: never offers `depthPassSince`, which `bin/contract.mjs:438` reads and nothing writes. Offers it (T5).
10. `docs/ROADMAP.md:897`: "Each item that needs a design passes two readers that did not write it". Names the
    double review (T5).
11. `docs/RULES.md:53` and `bin/lib/rules-data.mjs:197`: D5's subject and phrases, rendered. `rules change` rewrites
    both (T4).
12. `docs/ROADMAP.md:709`: "`codex-review` needs a mode that reviews a plan". Says the command of L7 (T5).
13. `bin/lib/protocols-skill.mjs:65`, section 3: a skip is only "a review that cannot run". Gains the reserve's skip,
    which `codex-review` records itself (T2).
14. `bin/lib/protocols-skill.test.mjs:130` and `:135`, `bin/lib/project.test.mjs:1980`: assert D5's text. Assert
    the new one (T4).
15. `docs/FAILURES.md:1219`: its control names the test of item 14 by its title. Follows the title (T4).
16. `docs/ROADMAP.md:704` to `:712`, the alignment item itself: ticked with this document's names when it lands (T6).
17. `bin/lib/protocols-skill.mjs:117`, section 7's cost: "two readers only with a candidate list". Still true, now
    of two families; left.
Checked and left: `bin/lib/manifest.mjs:140` and section 6 name the rule and its home; `bin/lib/onboard.mjs:747` and
the roadmap's "Design, past its two readers" items still have two readers, now of two families.

## Next step
State at the context pause (2026-10-31, after c1ce70e9). Open: question 150 to him through the lead (his typed
acceptance of 147 and 148, L9); it blocks only T2's rule commit and T4. Next, in order: T5, then T3, then T2 and T4
once 150 is answered. T5 progress: older texts 5 and 6 done in CLAUDE.md (3200 of 3200, `check`'s measure,
CRLF folded, 2cb04248, a code commit since it refreshed `rules-coverage-data.mjs`: it needs Codex and the lenses),
8, the contract template (5cbbca4c), and 9, 10 and 12 (`sync` offers `depthPassSince` from the next day, `null`
declines it; the roadmap's two lines): T5 is done (b042cddc). T3 is built without the reserve: `bin/double-review.mjs`,
`bin/lib/double-review-records.mjs`, their tests, the dispatcher and the README; `codex-review` exports `leanFlags`
and `leanEnv` with no line added. The Claude reader reads `rule:subagent-reader-model` through `ruleHere`, a rule of
this repository, and a project without it reads on the alias `opus`. Committed as bcd2dd4a (L10). Not run against
the real CLIs yet: T6's first read, announced with its cost, is that run. `bin/lib/rules-coverage-data.mjs` is at 988
of its 1,000-line ceiling, so T4's text changes must change spans in place or free lines first. Running: Codex
(`codex-review --base 3ac49fa8`, 4 parts, about 474k to 660k input tokens, meter 80% weekly before) and the lenses
risk, resilience and reliability over `d22f33ed..bcd2dd4a`. Next: their findings, then T2 and T4 once 150 is
answered. The lenses finished (risk 0, resilience 1, reliability 0); resilience's finding, a read whose record fails
loses both readers' findings, is fixed in the commit after bcd2dd4a, and Codex runs again over `d22f33e..` that commit
(L11). Codex recorded `d22f33e..1a7638c` (487,468 input tokens; meter 80% weekly before): 3 P2 in
`bin/double-review.mjs`, all checked and fixed in the next commit with tests (14 of 14 pass): `dispose`'s returned
diagnostic is said; the frozen diff passes `--no-ext-diff --no-textconv --no-color`; a reader that cannot be killed
past its timeout is said, its streams let go, and its lean home and copy kept (c59e58b0). Codex recorded
`1a7638c..c59e58b` correct (0.96); lenses resilience 0, reliability 1 (the timeout reason now in seconds, not
minutes), not taken: the command is unreleased and nothing reads that text. All code on the branch is reviewed by
both. Next: T2 and T4 once 150 is answered, else T6 (the first real read, announced with its cost; the verifier;
gate, push, PR). The gentle-ai Stop hook offers the whole branch (base 3ac49fa8): status only, start nothing.
Earlier notes: CLAUDE.md is at 3190 of 3200 tokens as `check` measures it; the two edits (`## Depth
pass` (rule 1) in the order at line 24, and line 92 "a skip is a debt `check`, `doctor` and the merge door list until
a review pays it, and the door refuses a lens skip") measured 3237 with `estimateTokens` after the Edit tool, likely
line endings; measure as `bin/lib/claude-md-budget.mjs` does before committing, and trim within the same paragraphs
if over. T3 drafts, outside the repository and not reviewed: `C:\Users\Oficina\.claude\jobs\9cc00bff\tmp\draft\`
(`double-review.mjs`, `double-review-records.mjs`, `codex-reserve.mjs`); T3 is built first without the reserve
(the sin Codex branch comes with T2, which declares the rule), tests first. The plan's two answers:
`...\tmp\read1\codex\answer.md` and the Claude reader's result in L8.

## Eval plan
The eval owed by 2026-11-30 (spec 6), not run here: the case built from PR 737's brief runs on the current arm and
on `current-without-rule-depth-pass` (`evals/without.mjs`), `MIN_TRIALS` 2 each (`evals/rule-proof.mjs`), and
`node evals/rule-proof.mjs <case> <current> <without>` records it; it proves the rule only when the arm without
scores lower. Cost, estimated from the two proofs on record ($2.00 and $4.43, `odd/tasks/depth-pass-rule.md`, L7):
$2 to $5, and Codex none. Run only on his word, through the lead.

## Tasks
- [x] T1 (kind: docs) This document with its depth pass, committed with documents alone; spec all; 0fc1287e.
- [ ] T2 (kind: build) `rules change codex-reserve` (after L9's answer), then `codex-review` reads the meter just
  before it launches and, under the reserve, records the `codex-reserve` skip itself (a failed or missing reading
  records none and says so; exactly 10% left is not under it; concurrent sessions each read before they launch, so
  use may still cross it, unguaranteed); `codex-meter` lists the reserve skips no review has paid, by commit, after
  their merge too, with the worktree command that pays each; older texts 4 and 13; spec 4; route codex-review.
- [ ] T3 (kind: build) `js-harness double-review`: `read` (the frozen copy, both readers started at once, each echoing
  its read tokens, the Claude reader on `rule:subagent-reader-model`, blind by sequence (L12), the reserve, `--plan`
  announces), `take` (taken and shared), `skip`, `tally`; records under the git common dir, which no review row
  reads, with the test that a read leaves code uncovered; spec 1, 2, 3, 4.
- [ ] T4 (kind: build) `rules change double-review` (after L9's answer): section 1's one text, `claudeBlock` and
  section 7 name it, D5 retired by name, his rules on disagreement and rounds kept; older texts 1 to 3, 11, 14, 15;
  spec 2.
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
