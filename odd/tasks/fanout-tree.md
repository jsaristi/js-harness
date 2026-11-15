# fanout-tree — fan-out reading and a tree of sub-agents (blocks 2 and 3, JH 210)

## State
Design only, no code. The depth pass is done and the wording of the four Delegation lines is drafted (Specs). It waits
for his three answers (Ask me before), carried by the lead. Nothing is built until they come back: question 292
covered opening this document, not building. Next, once he answers: T1 (the transcript fixture) and the build of
whichever lines he approved, after JH 208's `subagent-check` lands.

## Goal
In round one a session reads with several readers launched together, and splits disjoint units among writers launched
together. A verifier runs by a declared risk tier. Each of these orders is held by a check at the act, not by a line
of prose.

## Why
His words (Log L1): "quiero que funciones como enjambre ... que cuando lances una sesion esta pueda lanzar muchos sub
sesiones para hacer trabajos mas grandes y poderlos repartir bien ... nos quedamos cortos o tenemos un embudo".
The record (Depth pass item 2): across JH 199, 206, 207 and 208, only 1 pair of 23 sub-agent launches went out
together. JH 207 read inline 28 times before its first edit and launched no sub-agent. Today no check reads either
order: the guard sees each Agent call but reads only its model and effort (`bin/guard.mjs:166-169`).

## Done when
- `js-harness contract check odd/tasks/fanout-tree.md` exits 0
- `npm run check` exits 0
- his answer to each of the three questions (Ask me before) is in the Log with its transcript line
- after his answers, each approved line has its check designed in Tasks, with its fixture named, before any build

## In scope / Out of scope
- In: this document. After his answers, in a build session: `bin/lib/rules-block.mjs` lines 45-48 and its test,
  `docs/proposals/harness-diet.md` A.1, `bin/lib/rules-coverage-data.mjs` (refresh), `bin/guard.mjs` /
  `bin/lib/guard.mjs` (the Agent branch), `bin/lib/subagent-count.mjs` (`callsOf` keeps `message.id`),
  `bin/lib/contract.mjs` (a task's `surfaces:` field and a `high-risk:` field).
- Out: JH 207's surfaces (codex-review*, check-codex-reviews, lens rows, check's quiet line). JH 208's
  (advisor-gate*, stretch*, reply*, subagent-check): a check built on `callsOf` comes after JH 208 lands. JH 209's
  (the cap and growth-limit rules, pause.mjs, sessions.mjs readers). `docs/ROADMAP.md` until PR 888 lands.
- Out, his open decisions: the readers' model and effort (plan decision 6; the guard already refuses a level the
  rule does not set, Log L4), and reversing "review on every slice" (`docs/SPEC.md:345`), which no line below asks.

## Constraints
- PreToolUse cannot see a sibling call that is not yet written. The host writes each `tool_use` and runs its hook
  before the next one streams: in this session, call 1's refusal came at 20:00:31 and call 2 was written at 20:00:39
  (transcript c0430b6d lines 154-156). So the first of a turn's Agent calls can never be judged "alone" at the act.
  From the second on, the hook sees the earlier calls and their `message.id`.
- A Stop hook turns a stop back once (`stop_hook_active`, consistent-orders.md Constraints): a Stop reminder is not a
  hold at the act, and a `check` row is an audit after the fact. Neither is presented here as one.
- The lines are pinned word for word to A.1 of `docs/proposals/harness-diet.md` (1447-1516) by
  `bin/lib/rules-block.test.mjs:55-69`, with a frozen hash at :64. A rewording rewrites a frozen quote, so its source
  is his approval, quoted with its date in A.1's note and in this Log.
- They are not declared rules (`js-harness rules` lists none for delegation), so `rules change` does not apply: it is
  a code change of the installer's text. That is high risk (items 3 and 5) and gets the independent verifier.

## Ask me before
Three questions, one at a time, each his (the Rules block is his text, `rules-block.mjs:23-32`):
1. Line 46, readers launched together (spec 1).
2. Line 48, a risk tier for the verifier (spec 2).
3. Line 47, writers launched together when the document declares disjoint units (spec 3). This one carries a
   refuting verdict (Depth pass item 4), so its first option is to keep line 47 as it is.
Line 45 follows mechanically from whichever of the three he approves (spec 4) and is not a fourth question.

## Depth pass
- 1. Method: the discipline is concurrent work decomposition with a merge point, as in a build system or a review
  pipeline. Its standard: split by declared independence, never by guess; a bounded loop (one correction, one recheck,
  then a human); and a refusal at the point of launch where the launch can be judged. gentle-ai v4.3.1 does this in
  prompt text plus one refusing hook (`review_stop_hook.go`). The smallest change here: reword four lines, and add
  three checks to the guard and the contract, which already receive every Agent call and every feature document. No
  new hook entry, no new command. Searched first, by reuse-first: `guard --hook` (PreToolUse, matcher includes Agent,
  `bin/lib/hook-entries.mjs:82`), `callsOf` (`bin/lib/subagent-count.mjs:115-131`), `tailLines`
  (`bin/advisor-gate.mjs:99-110`), `lens-review --plan` (`bin/lens-review.mjs:62`), `next-step.mjs:16-27`.
- 2. Raw material:
  - The four lines as installed: `bin/lib/rules-block.mjs:45-48`; their source quote: `docs/proposals/harness-diet.md:1475-1481`.
  - Launches per session, measured from the transcripts and `subagents/*.meta.json` (script
    `C:\Users\Oficina\.claude\jobs\c0430b6d\tmp\measure.mjs`, rows in `rows.json`): JH 199 14 Agent calls (7 writers,
    7 general-purpose), JH 206 4, JH 207 0, JH 208 5 plus one claude-code-guide not matched to a parent call. Only JH
    208's 2 Explore shared a message. **The brief's baseline (JH 199 3, JH 208 2) does not match the measured 14 and
    5.** Its source is not a command (the first reader: no command prints a per-session count), so the measured
    numbers are used here.
  - Parent reading before the first edit: 28-48 read-type calls a session (JH 207 28, JH 208 48). That is above
    line 46's ~5-lookup trigger, which was followed by no explorer in JH 207.
  - JH 199's writers: T1 and T2 share `bin/lib/codex-review-turns.mjs` and `bin/codex-review.mjs`
    (`odd/tasks/codex-spend.md:183-184`). The other five were fix rounds after a review ("Fix V1 and V2", "Fix W1,
    W3, W5, W6", "Fix Codex's three P2 findings"). So 0 of 7 could have run together. Its open T3 (`merge-queue`)
    and T5 (`land-records`, `codex-meter`) are disjoint (:185, :187).
  - JH 199's verifiers ran three passes on one change ("Second verifier pass on 457bb1c9", "Third verifier pass on
    a5d528dc"): 9.9M and 12.1M raw tokens each. The verifier loop has no bound today.
  - gentle-ai v4.3.1 (local module copy): tier passive/medium/high in `internal/reviewtransaction/risk.go:220-239`.
    `review_due` is true only for high (`internal/cli/review_assess.go:151-154`), against its own doc comment at
    :61-67. Lenses: 0/1/4 by tier (`risk.go:146-157`). An agent can raise the tier by citing a high-risk item, never
    lower it (`review_assess.go:198-205`). Main is v4.5.0, not read.
  - js-harness keeps review on every slice: `docs/SPEC.md:345`, "every slice gets both reviews whatever its risk
    (his answer of 2026-10-26)". Lens choice is the session's judgment (`bin/lens-review.mjs:153-160`). No verifier
    record exists: a search for `verifier` in `bin/**/*.mjs` finds only comments, rule patterns and background-close
    text.
- 3. The bar:
  spec 1: `node --test bin/guard.test.mjs`: none, new behaviour (a reader launched in a later message, while an
  earlier reader of the same turn has not returned, is refused)
  spec 2: `node --test bin/lib/contract.test.mjs`: none, new behaviour (a `high-risk:` field is validated; the merge
  door refuses a high-tier feature with no verifier line in its Log, and a third verifier pass)
  spec 3: `node --test bin/guard.test.mjs`: none, new behaviour (a writer call with no `## Allowed edit surfaces`
  heading is refused; a writer launched in a later message while an earlier writer of the turn runs is refused)
  spec 4: `node --test bin/lib/rules-block.test.mjs`: passes today on the old text; after the change it passes with
  the new hash and A.1's new quote
  spec 5: left out because the reach to managed projects is nil: the lines reach a project only through his global
  `~/.claude/CLAUDE.md` (`holdRulesBlock`, `bin/lib/manifest.mjs:966`), never through `init`
- 4. Refutation:
  - Block 2 (readers): could round one not split? This session's round one split into 4 independent questions, which
    were run at once: `node C:\Users\Oficina\.claude\jobs\c0430b6d\tmp\mine.mjs` gave 4 readers, 2.32M raw tokens
    (2.06M cache read), about 640k weighted, 4.2 min of clock against 12.9 min summed. All 4 parent sessions read
    28-48 times inline. Verdict: supports
  - Block 3 (writers): would forcing the split have changed the record? JH 199's 7 writer launches: 0 of 7 were
    disjoint and ready together (raw material above). JH 206 and 207 had no writers. The baseline 0/3/4/2 is not
    explained by missed splits. Verdict: refutes, as the reason for the change. Going forward, codex-spend T3 and T5
    show disjoint units do occur. So the order is cheap when declared (it fires only on a document that names
    disjoint ready units), but it is not what would have moved past sessions. Reaches him as question 3, whose first
    option is to keep line 47.
  Verdict: refutes (block 3 only; block 2 supports). It reaches him as question 3 before any code; the pass records
  `answered: question <n>` when he answers.
- 5. Request: let a session read in parallel in round one (3-4 readers launched together when the questions are
  independent, then one correction and one recheck), and bound the verifier by a tier its feature document declares
  (one correction, one recheck, then his decision). Launch writers together only when the document declares disjoint
  ready units. Hold each at the act where the act can be judged: from the second Agent call of a turn on, and at the
  merge door. Say plainly that a lone first launch cannot be judged by a hook.
  Adds: none

## Specs
1. Line 46, readers launched together (block 2). His words, L1: "poderlos repartir bien".
   - Today: "understanding that needs more evidence or more than approximately 5 sequential lookups requires one
     read-only explorer"
   - Drafted: "understanding that needs more evidence or more than approximately 5 sequential lookups starts with
     read-only readers launched together in one turn, one for each independent question (3–4 when the questions
     split, one when they do not), then at most one correction batch and one recheck of what they left open or
     contradict"
   - A yes covers: reading round one in parallel, and the guard's refusal of a reader launched serially within a turn.
   - It does not cover: the readers' model or effort (decision 6), writers, or the verifier.
   - The other option: keep one explorer. Per question the tokens are similar, but the clock is about 3 times longer
     (12.9 against 4.2 min here) and the questions run one after another.
   - Check: in the guard's Agent branch, a reader call is refused when an earlier reader of the same turn sits in
     another `message.id` and has not returned. A lone first reader cannot be judged (Constraints). A `check --subagents`
     column counts launched-together groups per session as the audit.
2. Line 48, a risk tier for the verifier (block 2). Brief: "weigh one risk tier".
   - Today: "only a change that names a Task Size high-risk item gets an independent verifier after the change's own
     checks, as rarely as possible"
   - Drafted: "a change is high tier when its feature document names a Task Size high-risk item, and medium otherwise;
     only a high-tier change gets an independent verifier after the change's own checks, with one correction batch
     and one recheck, then his decision; review stays due on every code slice whatever the tier"
   - A yes covers: the tier is declared in the document (`high-risk: <item>`), the verifier loop is bounded at
     two passes, and the merge door refuses a high-tier feature with no verifier line, or with a third pass.
   - It does not cover: changing when review is due (`SPEC.md:345` stays), nor the lens count by tier (gentle-ai runs
     0/1/4 by tier; here the session keeps choosing the pertinent lenses). Either is a separate question if wanted.
   - The other option: keep "as rarely as possible". It is unbounded today (JH 199: three passes, 9.9-12.1M each) and
     no code computes it.
   - Check: `contract check` validates a `high-risk:` field naming item 1-6. `merge-queue`'s door refuses a document
     with that field and no `verifier:` Log line (new record), or with a third `verifier:` line on one change.
3. Line 47, writers launched together (block 3). Brief: "writers launched together in one turn".
   - Today: "a small task's writes stay inline, even across files; delegate a writer only for a named reason: parallel
     units launched together (two or more independent units of behavior with disjoint edit surfaces, each needing
     several minutes of work: several files or roughly 100+ changed lines, because a subagent spends one to two
     minutes reading before it writes) or the context backstop."
   - Drafted: "a small task's writes stay inline, even across files; when a feature document's Tasks name two or more
     ready units with disjoint `surfaces:` (each several files or roughly 100+ changed lines, because a subagent
     spends one to two minutes reading before it writes), their writers are launched together in one turn and the
     session keeps git and the seam check; otherwise delegate a writer only for the context backstop."
   - A yes covers: an obligation that fires only when the document declares disjoint ready units, plus two guard
     refusals: a writer call with no `## Allowed edit surfaces`, and a writer launched serially within a turn.
   - It does not cover: a writer cap; writers touching `docs/ROADMAP.md` (the session writes it); models.
   - The other option, first because the verdict refutes: keep line 47 as it is (a permission, not an obligation),
     and still add the two guard refusals, which hold the existing rule. The record shows past sessions had
     sequential units, so this option loses little.
   - Check: `contract check` reads a task's `surfaces:` and refuses two ready tasks whose surfaces overlap but which
     are declared parallel. The guard refusals are as above. A Stop reminder, once, when the document has two or more
     ready disjoint tasks and the turn launched one writer: this is a reminder, not a hold.
4. Line 45, follows from 1-3. Today it names "a writer reason (parallel units launched together, or the context
   backstop), or an independent verifier for a change that names a high-risk item". The drafted text keeps its
   sentence and changes only the named reasons to match whichever specs he approves: "readers launched together for
   understanding", "disjoint units declared in the feature document", "a high-tier change".

## Tasks
- [ ] T1 (kind: design) after his answers: the transcript fixture of a turn with 4 Agent calls (this session's lines
  154-163) and one with serial calls, as the shared test input for specs 1 and 3 — route: inline — commit
  `test(guard): fixture of parallel and serial Agent launches`
- [ ] T2 (kind: build) spec 1 — guard Agent branch, `callsOf` keeps `message.id` (after JH 208 lands) — commit
  `feat(guard): refuse a reader launched apart from its round`
- [ ] T3 (kind: build) spec 2 — `contract.mjs` `high-risk:`, merge door, `verifier:` Log line — commit
  `feat(contract): a declared high tier holds the verifier loop`
- [ ] T4 (kind: build) spec 3 — `contract.mjs` `surfaces:`, guard writer refusals — commit
  `feat(guard): writers carry their surfaces and launch together`
- [ ] T5 (kind: build) spec 4 — `rules-block.mjs` 45-48, its test hash, A.1 with his quoted approval,
  `rules coverage --refresh` — commit `feat(rules-block): delegation lines as he approved them`; high risk 3 and 5,
  independent verifier
- [ ] T6 (kind: verify) the launches-together count per session two weeks after T2 lands, against the measured
  baseline (1 pair of 23)

## Log
- L1 2026-11-15T15:44:59Z, his words (69918425:15965, typed): "Y en realidad quiero que funciones como enjambre osea
  que cuando lances una sesion esta pueda lanzar muchos sub sesiones para hacer trabajos mas grandes y poderlos
  repartir bien por que siento que nos quedamos cortos o tenemos un embudo a la otra de trabajar, que piensas? como
  lo podemos hacer mejor, preguntemosle a fable por que quiero es mejorar todo esto. por tantas falla siento que no
  vamos a terminar nunca y que va a seguir fallando y me parece demasiado tiempo perdido, aunque hemos avanzado y
  siento que trabajamos mejor no hay avance real ni consistencia funcionas bien un tiempo y vuelves y fallas
  absolutamente y te comienzas a saltar cosas y a trabajar demasiado lento."
- L2 2026-11-15T17:27:00Z, question 292 (69918425:17287, tapped "Apruebo el orden (Recomendada)"): a yes covers
  opening each block's document and depth pass; it does not cover building any block before its design returns to
  him.
- L3 The brief (`C:\Users\Oficina\.js-harness\background\briefs\2026-11-15T19-58-39-523Z-4623ab49.md`): blocks 2 and
  3 in one document, wording of lines 47 and 48 drafted, a check named for each order, cost measured, then stop.
  Found: lines 45 and 46 are coupled to 47 and 48 (46 says "one read-only explorer"), so all four are drafted.
- L4 The depth pass used its own block: 4 read-only readers launched in one turn. The guard refused 3 of the 4
  for the effort level passed (`rule:session-effort`), and they were relaunched together in the next turn. So
  a fan-out turn can half-succeed, and a refused launch costs one turn. Cost of the 4 readers: 2.32M raw tokens
  (92 fresh input, 229k cache write, 2.06M cache read, 29k output), about 640k weighted by the usual price ratios
  (an estimate, not checked against the price list). That is about 1.8 times one median Explore of the past
  (1.66M raw, 356k weighted, n=2). Clock: 4.2 min, against 12.9 min summed. Not run here: the correction batch and
  the recheck of spec 1, so the full round's cost is not measured. Codex: 0 spent (weekly meter 79%, resets
  2026-11-16 23:15).
