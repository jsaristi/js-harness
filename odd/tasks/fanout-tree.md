# fanout-tree — fan-out reading and a tree of sub-agents (blocks 2 and 3, JH 210)

## State
Design only, no code. Depth pass done; the four Delegation lines drafted (Specs); a double review ran (read
f0835fa1: Claude 13 findings, Codex 7; all taken, Log L5) and this version answers it. It waits for his three answers
(Ask me before), carried by the lead; question 292 covered opening this document, not building. Next, once he
answers: T1 (synthetic fixture and terms), then the build of whichever lines he approved.

## Goal
In round one a session reads with several readers launched together, writers of disjoint declared units go out
together, and the verifier loop has a bound. Each order is held at the act where a hook can judge it, and the rest
is named as audit-only, never presented as held.

## Why
His words (Log L1): "quiero que funciones como enjambre ... que cuando lances una sesion esta pueda lanzar muchos sub
sesiones para hacer trabajos mas grandes y poderlos repartir bien ... nos quedamos cortos o tenemos un embudo".
Here "sub sesiones" is read as sub-agents inside one session, depth one: the plan's block 3. Sessions that launch
sessions, and their cap, are block 4 (plan, "Tope de sesiones"), not this document. Whether Fable was asked is
the lead's record ("en el orden de Fable", plan section 3b); this session did not ask it.
The record (Depth pass item 2): across JH 199, 206, 207 and 208, 1 pair of 23 sub-agent launches went out together.
Today no check reads either order: the guard sees each Agent call but reads only its model and effort
(`bin/guard.mjs:166-169`). Each refusal this design adds costs a turn (Log L4), against his "embudo" and "demasiado
lento"; so each refuses once and names the line, and the retry passes.

## Done when
- `js-harness contract check odd/tasks/fanout-tree.md` exits 0
- `npm run check` exits 0
- his answer to each of the three questions (Ask me before) is in the Log with its transcript line
- after his answers, each approved spec has its synthetic fixture named in Tasks before any build

## In scope / Out of scope
- In: this document. After his answers, in a build session: `bin/lib/rules-block.mjs` lines 45-48 and its test,
  `docs/proposals/harness-diet.md` A.1, `bin/lib/rules-coverage-data.mjs` (refresh); `bin/guard.mjs` and
  `bin/lib/guard.mjs` (the Agent branch, and the Read/Grep/Bash branch for spec 1); `bin/lib/subagent-count.mjs`
  (`callsOf` keeps `message.id`, `roleOf` reused); `bin/lib/contract.mjs` (`risk:` and `surfaces:` fields);
  `bin/check.mjs` (the launched-together column of `check --subagents`); `bin/notify.mjs` (the ready notice).
- Out: JH 207's surfaces (codex-review*, check-codex-reviews, lens rows, check's quiet line). JH 208's
  (advisor-gate*, stretch*, reply*, subagent-check; the brief, line 22): T2's `check --subagents` column waits for
  JH 208 to release subagent-check. JH 209's (the cap and growth-limit rules, pause.mjs, sessions.mjs readers).
  `docs/ROADMAP.md` until PR 888 lands.
- Out, his open decisions: the readers' model and effort (plan decision 6; the guard already refuses a level the
  rule does not set, Log L4); reversing "review on every slice" (`docs/SPEC.md:345`), which no line here asks; lens
  count by tier.

## Constraints
- PreToolUse cannot see a sibling call that is not yet written. Observed once, in this session: the host wrote each
  `tool_use` and ran its hook before the next streamed (call 1 refused at 20:00:31, call 2 written at 20:00:39,
  transcript c0430b6d lines 154-156). Not found in the host's hook documentation. So the first Agent call of a turn
  cannot be judged "alone" at the act; from the second on, the hook sees the earlier calls.
- A Stop hook turns a stop back once (`stop_hook_active`, consistent-orders.md Constraints), and a `check` row is an
  audit after the fact. Neither is presented here as a hold.
- Fail open, the gate's rule (`bin/advisor-gate.mjs:9-10`): a transcript the hook cannot read lets the act through,
  recorded.
- Reach: the lines install into his global `~/.claude/CLAUDE.md` (`holdRulesBlock`, `bin/lib/manifest.mjs:966`) and
  load in every project, js-harness or not. The guard is a global hook entry, but its Agent refusals read the
  project's own `bin/lib/rules-data.mjs` (`bin/guard.mjs:116`, :167); how they behave in a project without that
  file is not checked (T1). So the drafted lines must read safely where there is no feature document.
- The lines are pinned word for word to A.1 of `docs/proposals/harness-diet.md` (1447-1516) by
  `bin/lib/rules-block.test.mjs:55-69`, hash at :64. A rewording rewrites a frozen quote; its source is his approval,
  quoted with its date in A.1's note and in this Log. They are not declared rules, so `rules change` does not
  apply: it is a code change of the installer's text, high risk (items 3 and 5).
- The guard changes of T2-T4 are high risk too (item 2, guards): each gets the independent verifier.

## Ask me before
Three questions, one at a time, each his (the Rules block is his kept text, `bin/lib/rules-block.mjs:12-14`, :27-32):
1. Line 46, readers launched together (spec 1).
2. Line 48, a declared risk and a bounded verifier loop (spec 2).
3. Line 47, writers launched together when the document declares disjoint units (spec 3), three options.
Line 45 follows from the three answers (spec 4), its whole text given for the case where all three are approved.

## Depth pass
- 1. Method: concurrent work decomposition with a merge point, as in a build system or a review pipeline. Its
  standard: split by declared independence, never by guess; a bounded loop (one correction, one recheck, then a
  human); a refusal at launch where launch can be judged, and an audit, named as such, where it cannot. gentle-ai
  v4.3.1 does this in prompt text plus one refusing hook (`review_stop_hook.go`). The smallest change here: reword
  four lines, and add checks to the guard and the contract, which already receive every tool call and every
  feature document. No new hook entry, no new command. Searched first, by reuse-first: `guard --hook` (PreToolUse,
  matcher covers Agent, Read, Grep, Bash, `bin/lib/hook-entries.mjs:82`); `callsOf` and `roleOf`
  (`bin/lib/subagent-count.mjs:114-129`, :43-60); `tailLines` (`bin/advisor-gate.mjs:99-110`); `lens-review --plan`
  (`bin/lens-review.mjs:62`); `bin/lib/next-step.mjs:16-27`; the ready notice's verifier record, already a follow-up
  (consistent-orders.md F1).
- 2. Raw material:
  - The four lines as installed: `bin/lib/rules-block.mjs:45-48`; their source quote: `docs/proposals/harness-diet.md:1475-1481`.
  - Launches per session, from the transcripts and `subagents/*.meta.json` (script
    `C:\Users\Oficina\.claude\jobs\c0430b6d\tmp\measure.mjs`, rows in `rows.json`): JH 199 14 Agent calls (7 writers,
    7 general-purpose), JH 206 4, JH 207 0, JH 208 5 plus one claude-code-guide not matched to a parent call. Only
    JH 208's 2 Explore shared a message. The brief's baseline (JH 199 3, JH 208 2) does not match the measured 14
    and 5; no command prints a per-session count, so the measured numbers are used here.
  - Parent calls before the first edit, all four sessions: JH 199 45, JH 206 46, JH 207 28, JH 208 48. A proxy: it
    counts every Read, Grep, Glob, codegraph and Bash call and every planning turn before the first Edit or Write.
    Even so all four are far above line 46's ~5-lookup trigger, and JH 207 launched no explorer.
  - JH 199's writers: T1 and T2 share `bin/lib/codex-review-turns.mjs` and `bin/codex-review.mjs`
    (`odd/tasks/codex-spend.md:183-184`); the other five were fix rounds after a review ("Fix V1 and V2", "Fix W1,
    W3, W5, W6", "Fix Codex's three P2 findings"). 0 of 7 could have run together, judged from the launch
    descriptions and the Tasks, not from each diff.
  - Units built inline: JH 208 had no writers and built S1 (1a4ec235: 6 files, +16 -7) and S5 (617f6386: 5 files,
    +40 -2) inline, one after the other (11:25 and 11:47). Both were specs from its start. Both touch
    `odd/tasks/consistent-orders.md`; without that parent-owned document their surfaces are disjoint. Under today's
    line 47 they qualify by "several files", not by "roughly 100+ changed lines". JH 207 has no feature document
    of its own on main (`git grep -l 'JH 207' origin/main -- odd/tasks` finds only codex-spend.md and
    consistent-orders.md): not measured.
  - JH 199's verifier passes on one feature, on different commits ("Second verifier pass on 457bb1c9", "Third
    verifier pass on a5d528dc"): 12.1M and 9.9M raw tokens. So a bound keyed by commit would not catch it; keyed by
    slice it would. Nothing bounds the loop today.
  - gentle-ai v4.3.1 (local module copy; main is v4.5.0, not read): tier passive/medium/high in
    `internal/reviewtransaction/risk.go:220-239`; `review_due` only for high (`internal/cli/review_assess.go:151-154`),
    against its own doc comment at :61-67; lenses 0/1/4 (`risk.go:146-157`); an agent may raise its tier by citing a
    high-risk item, never lower it (`review_assess.go:198-205`).
  - js-harness keeps review on every slice: `docs/SPEC.md:345`, which also lists "Asking gentle-ai for a risk tier"
    as discarded. No verifier record exists: `verifier` in `bin/**/*.mjs` finds only comments, rule patterns and
    background-close text. The merge door is `check --door` (`bin/check.mjs:385-403`), run by
    `bin/merge-queue.mjs:338-361`, and it reads no feature document (`bin/lib/merge-queue-reviews.mjs:83-91`).
- 3. The bar:
  spec 1: `node --test bin/guard.test.mjs`: none, new behaviour (a reader in a later message of the same user turn is
  refused once unless marked as the correction or the recheck; reading past the threshold with no reader is refused
  once)
  spec 2: `node --test bin/guard.test.mjs bin/lib/contract.test.mjs`: none, new behaviour (a third verifier launch for
  one slice is refused; a feature document with no `risk:` is refused by `contract check`; a ready notice of a high
  feature with no passing verifier record of its head is refused)
  spec 3: `node --test bin/guard.test.mjs bin/lib/contract.test.mjs`: none, new behaviour (a writer by `roleOf` or by
  its heading, with no `## Allowed edit surfaces`, is refused; overlapping declared surfaces are refused)
  spec 4: `node --test bin/lib/rules-block.test.mjs`: passes today on the old text; after the change, with the new
  hash and A.1's new quote
  spec 5: `node --test bin/guard.test.mjs`: none, new behaviour (each refusal's reach: a project with feature
  documents, one without; install, update and uninstall leave the block exactly as recorded)
- 4. Refutation:
  - Block 2 (readers): could round one not split? This session's round one split into 4 independent questions run
    at once: `node C:\Users\Oficina\.claude\jobs\c0430b6d\tmp\mine.mjs` gave 4 readers, 2.32M raw tokens (2.06M cache
    read), about 640k weighted, 4.2 min of clock against 12.9 min summed. This session fanned out because the brief
    said so: how many past rounds held 3 or more independent questions is not measured.
  - Block 3 (writers): would the obligation have changed the record? JH 199: 0 of 7. JH 208: 1 pair (S1 and S5),
    qualifying only by file count, each under 50 changed lines, so splitting would have cost each writer its one to
    two minutes of reading for a small unit. The obligation can fire, but on today's record its gain is small.
  Verdict: supports (block 2 on one session's round; block 3 on one small pair). Question 3 says so.
- 5. Request: let a session read in parallel in round one (3-4 readers launched together when the questions are
  independent, then one correction and one recheck), bound the verifier loop by slice under a risk the feature
  document must declare, and launch writers together when the document declares disjoint ready units of real size.
  Hold each at launch where a hook can judge it, refusing once and naming the line; say plainly what is audit-only
  (a lone first launch; whether questions were truly independent).
  Adds: none

## Specs
1. Line 46, readers launched together (block 2). His words, L1: "poderlos repartir bien".
   - Today: "understanding that needs more evidence or more than approximately 5 sequential lookups requires one
     read-only explorer"
   - Drafted: "understanding that needs more evidence or more than approximately 5 sequential lookups starts with
     read-only readers launched together in one turn, one for each independent question (3–4 when the questions
     split, one when they do not), then at most one correction batch and one recheck of what they left open or
     contradict"
   - A yes covers: reading round one in parallel; the guard refusing once a reader launched in a later message of
     the same user turn that is not marked as the correction or the recheck, including a new question found
     mid-round (it waits for the correction batch); the guard refusing once the first read past the threshold in a
     turn of a session with a feature document when no reader was launched.
   - It does not cover: the readers' model or effort (decision 6), writers, the verifier.
   - The other option: keep one explorer. The questions then run one after another and the clock is longer (12.9
     against 4.2 min here, summed against measured). That the tokens per question would be similar is assumed: no
     serial run of the same questions exists.
   - Check, at the act: in the guard's Agent branch, a reader whose user turn already holds a reader in an earlier
     message is refused once, whatever that reader's state, unless its prompt opens `## Correction of the round` or
     `## Recheck of the round`, each allowed once per round. In the Read/Grep/Bash branch, the first call past a
     threshold (a constant in code, starting at 10) in a user turn with no reader is refused once, only in a
     session with an open feature document. Audit only: whether the questions really split; a lone first reader
     (Constraints); the `check --subagents` column counting launched-together groups per session.
   - Terms, fixed in T1: a user turn runs from a message the user sent to the next stop, and a reader still running
     from an earlier turn does not make the new turn's first reader serial; a call a hook refused does not count as
     launched, and a message that relaunches the refused calls of the message before it repairs the same round (the
     fixture models this session's refused and relaunched calls); a role is `roleOf`'s (writer, explorer, reviewer,
     verifier, other), so verifiers and reviewers are not counted as readers.
2. Line 48, a declared risk and a bounded verifier loop (block 2). Brief: "weigh one risk tier".
   - Today: "only a change that names a Task Size high-risk item gets an independent verifier after the change's own
     checks, as rarely as possible"
   - Drafted: "a change that names a Task Size high-risk item, in its feature document's `risk:` line or in the
     request, gets an independent verifier after the change's own checks, for each slice at most one correction batch
     and one recheck, then his decision; review stays due on every code slice whatever its risk"
   - A yes covers: every new feature document declares `risk: high (<items>)` or `risk: medium`, and a missing line
     is refused, so omission is not a silent medium; without a document a named item still calls the verifier; the
     guard refuses a third verifier launch for one slice; a ready notice of a high feature needs a passing verifier
     record of its head.
   - It does not cover: when review is due (`SPEC.md:345` stays); lens count by risk; a floor from touched paths.
     A floor (guard paths raise to item 2, installer paths to item 5, the document may only raise) is the stronger
     form; it is left out because a path list is a second home for the high-risk list, and is a separate question
     if he wants it.
   - The other option: keep "as rarely as possible". It is unbounded today (JH 199: two extra passes on one feature,
     9.9M and 12.1M raw) and no code computes it.
   - Check, at the act: the guard's Agent branch refuses a verifier (`roleOf`, and a prompt heading `## Verifier of
     <S#>`) when two verifiers of that slice already ran in the session. The record is derived from the launch and its
     sub-agent transcript (slice, head commit, PASS or not, agent id), never hand-written. `notify --kind ready` refuses
     a feature whose document says `risk: high` without a passing record for the head it names. `contract check`
     refuses a new document with no `risk:` line or an item outside 1-6.
3. Line 47, writers launched together (block 3). Brief: "writers launched together in one turn".
   - Today: "a small task's writes stay inline, even across files; delegate a writer only for a named reason: parallel
     units launched together (two or more independent units of behavior with disjoint edit surfaces, each needing
     several minutes of work: several files or roughly 100+ changed lines, because a subagent spends one to two
     minutes reading before it writes) or the context backstop."
   - Drafted: "a small task's writes stay inline, even across files; delegate a writer only for a named reason:
     parallel units launched together (two or more independent units of behavior with disjoint edit surfaces, each
     needing several minutes of work: roughly 100+ changed lines, not counting the feature document the session
     keeps, because a subagent spends one to two minutes reading before it writes) or the context backstop; when a
     feature document's Tasks declare such units ready with their `surfaces:`, their writers are launched together in
     one turn and the session keeps git, the feature document and the seam check."
   - Option A, keep line 47 as it is: no new text, no new check.
   - Option B, keep line 47 and add the two guard refusals below: holds today's permission, adds no obligation.
   - Option C, the drafted text: an obligation that fires only on declared units, and the size floor narrowed to
     lines (JH 208's S1 and S5 would then stay inline, as their size suggests).
   - A yes to C covers: the obligation, the narrowed floor, and the refusals. It does not cover a writer cap, writers
     touching `docs/ROADMAP.md` (the session writes it), or models. Without a feature document it reads as today.
   - Check, at the act: the guard refuses any call that `roleOf` marks a writer, or that carries `## Allowed edit
     surfaces`, unless it carries that heading and names a role (an unrecognized role with surfaces is refused as
     ambiguous); under C, a writer of a user turn that already holds a writer in an earlier message is refused once.
     `contract check` refuses two ready tasks declared parallel whose `surfaces:` overlap. Audit only: a turn that
     launched one writer while two declared units were ready (a Stop reminder, once).
4. Line 45, follows from 1-3. Today: "Delegate through the runtime's subagent/delegation mechanism, when available,
   only when a Delegation Trigger's condition truly holds and names a reason: a map you need to decide or route, a
   writer reason (parallel units launched together, or the context backstop), or an independent verifier for a change
   that names a high-risk item."
   - Drafted, with all three approved: "Delegate through the runtime's subagent/delegation mechanism, when available,
     only when a Delegation Trigger's condition truly holds and names a reason: a map you need to decide or route
     (readers launched together, one per independent question), a writer reason (declared disjoint units launched
     together, or the context backstop), or an independent verifier for a change that names a high-risk item, within
     its bound."
   - For each one not approved, its parenthesis or clause stays as today's text.
5. Reach (spec 5 of the bar). The drafted lines read as today where there is no feature document. T1 checks whether
   the guard's Agent refusals fire in a project without `bin/lib/rules-data.mjs`; each new refusal is gated the same
   way, so it fires only in a project that carries the harness's rules, and the tests cover a project with feature
   documents and one without.

## Tasks
- [ ] T1 (kind: design) after his answers: a synthetic fixture (types, ids, timestamps, headings only; no prompt text
  from a real transcript) of a turn with 4 Agent calls, 3 refused and relaunched together, a serial foreground pair,
  a zero-launch turn past the threshold, a background reader crossing user turns, a general-purpose writer without
  surfaces, and a verifier; spec 1's terms; the reach of today's Agent refusals in a project without rules-data —
  route: inline — commit `test(guard): fixture of parallel, serial and repaired Agent launches`
- [ ] T2 (kind: build) spec 1 — guard Agent and Read/Grep/Bash branches, `callsOf` keeps `message.id`;
  `check --subagents` column after JH 208 releases subagent-check — high risk 2, independent verifier — commit
  `feat(guard): readers of a round launch together`
- [ ] T3 (kind: build) spec 2 — `contract.mjs` `risk:`, guard verifier bound, verifier record, ready notice — fixture
  of a third launch, a stale record and a failing record — high risk 2, independent verifier — commit
  `feat(guard): a slice's verifier loop is bounded`
- [ ] T4 (kind: build) spec 3 — `contract.mjs` `surfaces:`, guard writer refusals — fixture of overlapping surfaces
  and an ambiguous role — high risk 2, independent verifier — commit `feat(guard): writers carry their surfaces and
  launch together`
- [ ] T5 (kind: build) spec 4 — `rules-block.mjs` 45-48, its test hash, A.1 with his quoted approval,
  `rules coverage --refresh` — high risk 3 and 5, independent verifier — commit `feat(rules-block): delegation
  lines as he approved them`
- [ ] T6 (kind: verify) the launched-together count per session two weeks after T2 lands, against the measured
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
  for the effort level passed (`rule:session-effort`), and they were relaunched together in the next turn: a fan-out
  turn can half-succeed, and a refused launch costs one turn. Cost of the 4 readers: 2.32M raw tokens (92 fresh
  input, 229k cache write, 2.06M cache read, 29k output), about 640k weighted by the usual price ratios (an
  estimate, not checked against the price list), about 1.8 times one median Explore of the past (1.66M raw, 356k
  weighted, n=2). Clock: 4.2 min, against 12.9 min summed. Not run: the correction batch and the recheck, so a full
  round's cost is not measured.
- L5 Plan review (`rule:double-review`), read f0835fa1, cost stated before it ran (about 1.1M Claude, 0.9M Codex,
  1% of Codex's weekly limit): Claude 13 findings on 1,433,302 tokens, Codex 7 on 323,995. All 20 taken; this
  version answers them. The largest: the first checks let serial and zero-launch reading through and bounded the
  verifier only at merge, after the spending; the writer/reader split could be bypassed; "reach nil" was false;
  the block 3 refutation misread "several files or roughly 100+ lines", so its verdict moved from refutes to
  supports. Shared by both readers: Claude 1 and Codex 4 (serial reading), Claude 2 and Codex 1 and 3 (the
  verifier bound and record), Claude 3 and Codex 7 (reach), Claude 4 and Codex 2 (roles), Claude 9 and Codex 6
  (omitted risk).
- L6 A slip, told: the first commit attempt carried an AI attribution line that his global CLAUDE.md forbids; the
  harness's commit reminder asks for it in every session. Stopped before the commit existed and redone without it.
