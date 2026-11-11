## Goal
`AGENTS.md` holds his high-risk list, the six items word for word, and `CLAUDE.md` names `AGENTS.md` where it sizes a
task by that list, so Codex and a fresh clone read what a session reads.

## Why
Work unit 11 of the audit triage (docs/proposals/2026-11-10-audit-triage.md:235-242), closing M20 of the Fable 5.2
audit (docs/audits/2026-11-09-fable-5-2-audit.md:231-234). `CLAUDE.md:21` says a small task "touches no high-risk
item (below)", and nothing is below: the list lives in the block `install` writes into his own global `CLAUDE.md`,
which a Codex review is started without and a fresh clone does not have. A reviewer told to treat a high-risk change
apart cannot tell which change that is.

## Done when
- `git grep -c -i "high risk" -- AGENTS.md` exits 0
- `node --test bin/lib/rules-block.test.mjs` exits 0
- `npm run check` exits 0

## In scope / Out of scope
- In: `AGENTS.md` (the list, and nothing else: L6); line 21 of `CLAUDE.md`; one test in
  bin/lib/rules-block.test.mjs; the doc comments of the two constants of bin/lib/rules-block.mjs, which still say the
  root `CLAUDE.md` keeps these lines; the two entries the list's spans need in the coverage register,
  bin/lib/rules-coverage-data.mjs (L6); this document.
- Out: any word of the six items (his yes covers copying them as they are, not changing them); any other line of
  `CLAUDE.md` (JH 172 changes nine rules in that file tonight); the block `install` writes and its hash; the template
  other projects get from `init`; declaring the list as a rule of `js-harness rules` (it is none today, L3, and
  making it one is his decision and was not put to him); merging (the lead's).

## Constraints
- The list is copied, never retyped: the test reads the line from `KEPT_GROUPS` and looks for it whole in `AGENTS.md`
  — because two copies kept by hand drift, and the first copy left the repository exactly that way (L4).
- `AGENTS.md` stays within `rule:agents-budget` — because every session and every review pays it on every turn; if it
  did not fit, nothing would change and the lead would be told what had to leave.
- The test is written first and seen red — because no test holds either text today (high risk, item 6, beside item 3).

## Ask me before
- Nothing beyond the brief: a decision that is his goes to the lead with `js-harness notify`.

## Depth pass
- 1. Method: single-sourcing, as technical writers and API maintainers do it: one text is the source, every other
  place either points at it or is a copy a machine holds equal to it. His answer chose a copy, since Codex cannot
  follow a pointer into his private file, so the standard to meet is the second half: the copy is held to its source
  by a test, and the pointer that names it resolves. The smallest change that meets it: one paragraph in `AGENTS.md`,
  one word group in `CLAUDE.md:21`, one test beside the tests that already freeze the source. No new file, no new
  command, no new rule. Searched first: codegraph and `git grep -i "high.risk"` over `bin/`, `CLAUDE.md`,
  `AGENTS.md`, `docs/SPEC.md` and the skills (the list is in bin/lib/rules-block.mjs:53 alone; bin/lib/ported-skills.mjs:52
  and bin/lib/rules-block.mjs:42-45 name "a high-risk item" and do not list them); `js-harness rules` (78 rules, none
  is the list, none names it); the test files that read the root `AGENTS.md` or `CLAUDE.md` (36, of which
  bin/lib/rules-block.test.mjs is the one that holds this text).
- 2. Raw material (line numbers as at 52925c7b; T2 moved those of bin/lib/rules-block.mjs down by three, so the
  list is at `:56` since f6a2be08): `CLAUDE.md:20-22` (the sizing sentence and its "(below)"); `AGENTS.md:1-61` (61 lines, no mention
  of risk); bin/lib/rules-block.mjs:50-56 (`KEPT_GROUPS`, the group "Task Size and scratch", whose first line is the
  list) and `:68` (`rulesBody`, what `install` writes); bin/lib/rules-block.test.mjs:33-35 and `:55-69` (the lines
  are held to Appendix A.1 of docs/proposals/harness-diet.md and frozen by a hash, since "that copy left");
  his global file, `~/.claude/CLAUDE.md:33`, read on 2026-11-11 and equal to that constant character for character
  (L2); commit 85d17a02 of 2026-11-04 ("the global file loads here again, and the repo's copy leaves"), which took
  the list out of the root `CLAUDE.md`, and cfe1291f of 2026-10-27, which wrote "(below)" while the list was below;
  bin/codex-review.mjs:28-32 and `:228` (a review gets "the project's AGENTS.md, and none of your Codex
  configuration"); bin/check.mjs:56-70 (`checkBudget`: the LF text's length over 4, rounded up, against
  `rule:agents-budget`, 1500).
- 3. The bar:
  spec 1: `node --test bin/lib/rules-block.test.mjs`: today 23 pass, 3 skipped, and no test reads `AGENTS.md`; `git
  grep -c -i "high.risk" -- AGENTS.md` finds nothing (exit 1) at 52925c7b; none, new behaviour.
  spec 2: `node --test bin/lib/rules-block.test.mjs`: today `CLAUDE.md:21` reads "(below)" and no test holds it;
  none, new behaviour.
- 4. Refutation: two things could show the request does not hold: Codex already reads the list by another way, or
  the list does not fit the budget.
  `git grep -c -i "high.risk" -- AGENTS.md bin/codex-review.mjs bin/lib/codex-review-prompt.mjs`: 0 matches, exit 1:
  neither the file a review is given nor the prompt this repository writes for it holds the list or names it.
  The fit, measured with `KEPT_GROUPS` read by a one-line node script over the root `AGENTS.md`: 1010 estimated
  tokens today, 1246 with the line and its one sentence, of 1500. It fits with 254 to spare.
  Verdict: supports
- 5. Request: copy the line "**High risk**: … (6) no test would catch a regression in what changes." whole into
  `AGENTS.md`, wrapped as the file wraps and changed in nothing else; in `CLAUDE.md:21` put `AGENTS.md` where "below"
  is; hold both by one test that reads the line from `KEPT_GROUPS`. What it costs: 200 estimated tokens more in
  `AGENTS.md` on every turn of every session and in every review, and a session of Claude on his machine now loads
  the list twice, once from his global file and once from here. (As first written this item added one sentence that
  named the other copy, and counted 236; the sentence left before any code was committed, L6.)
  Adds: none

## Specs
1. "Copiar la lista a `AGENTS.md` (Recomendada), que es lo que lee Codex, si cabe en su presupuesto de tokens"; "Un
   sí cubre copiar tus seis puntos tal como están. No cubre cambiarlos."
2. "y que `CLAUDE.md` la nombre."

The question as the triage wrote it (docs/proposals/2026-11-10-audit-triage.md:306-312), and the option taken:

> **Pregunta 4 (unidad 11: la lista de alto riesgo).** El `CLAUDE.md` del repo dice que una tarea pequeña "no toca nada
> de alto riesgo (abajo)", pero esa lista está solo en tu archivo global privado, así que Codex y un clon nuevo nunca
> la leen. ¿Qué hacemos?
>
> 1. **Copiar la lista a `AGENTS.md` (Recomendada),** que es lo que lee Codex, si cabe en su presupuesto de tokens, y
>    que `CLAUDE.md` la nombre. Un sí cubre copiar tus seis puntos tal como están. No cubre cambiarlos.
> 2. **Quitar "(abajo)"** y apuntar a tu archivo global, aceptando que Codex no la lea.

It was not asked of him one by one: he answered every question of the triage at once, with the recommended option,
in the lead's chat (transcript ea85ec35-82e1-4aa9-abe3-98bd153a50b0), on 2026-11-11:

- line 6716, 00:26 local (2026-11-11T05:26:36Z): "une lo que quede listo y tienes autorizacion para poder avanzar en
  todo y escoger siempre la opcion recomendada, no preguntes, avanza y se completamente autonomo."
- line 6905, 00:30 local (2026-11-11T05:30:20Z): "contesta TODAS las preguntas con recomendado TODAS y avanza los mas
  posible eres completamente autonomo"

## Tasks
- [x] T1 (kind: docs) this document: the contract, the depth pass, the specs. Specs 1 and 2; inline; this commit.
- [x] T2 (kind: build) specs 1 and 2: the test first and red, then the line in `AGENTS.md`, `AGENTS.md` named in
  `CLAUDE.md:21`, the two doc comments of bin/lib/rules-block.mjs and the register's two entries; inline; one commit.
- [x] T3 (kind: verify) an independent verifier reads T2 against the request (high risk, item 3 in part: instructions
  others consume); one read-only sub-agent: "holds" at f6a2be08, three defects that do not block, answered in L7.
- [x] T4 (kind: verify) the gate, then Codex and the pertinent lenses on the slice, one at a time; findings fixed or
  answered: Codex no finding, the lenses one warning rebutted (L8).
- [x] T5 (kind: docs) main merged in (9e29880a), the pull request ready, the ready notice, the session summary, the
  closed notice.

## Log
- L1 The brief (the lead, 2026-11-11T10:46Z, with an addition of 05:48 local): "You own one feature: the high-risk
  list where Codex reads it (the triage's work unit 11)." It gives the decision as question 4 of the triage answered
  with its recommended option by his two lines above, the six items as his global file holds them, and the limits:
  nothing changes if the list does not fit; only `AGENTS.md` and the one line of `CLAUDE.md`; if the list is a rule
  text, it moves as a rule moves.
- L2 Checked before this document was written. His two lines, read with `js-harness sessions --quote
  ea85ec35-82e1-4aa9-abe3-98bd153a50b0 6716` and `6905`: both are his, typed, as the brief quotes them. The list: the
  line of `~/.claude/CLAUDE.md:33`, less its list mark, compared in node with the brief's copy and with
  `KEPT_GROUPS` of bin/lib/rules-block.mjs:53: equal, character for character. M20 at 52925c7b: true, `git grep -c
  -i "high.risk" -- AGENTS.md CLAUDE.md` gives `CLAUDE.md:1` alone.
- L3 Is the list a rule text? No. `js-harness rules` lists 78 rules and none is the list or has a phrase of it;
  `js-harness rules check` passes before the change. Its home is a constant of code that `install` renders, frozen
  by a hash in its test. So it does not move by `js-harness rules change` on a `rule/` branch, and no sentence of
  his is missing: the copy rests on question 4 alone. The lead was told in the opened notice (05:50 local).
- L4 Why the pointer dangles: cfe1291f (2026-10-27) wrote "(below)" when the root `CLAUDE.md` held the list under
  "Kept from the global file"; 85d17a02 (2026-11-04) took that copy out once his global file loaded in this
  repository again, and left the pointer. The two doc comments of bin/lib/rules-block.mjs:12-13 and `:26-29` still
  say the root `CLAUDE.md` keeps the lines and that a test holds the two together; neither is true since that
  commit, so they are corrected in T2.
- L5 The plan had no double read of its own: it is the option of question 4, whose reviewed text is named by path
  above, and it proposes nothing beyond it (`Adds: none`).
- L6 T2, test first: `node --test bin/lib/rules-block.test.mjs` gave 23 pass, 1 fail and 3 skipped before the change
  (the new test, on "the line whole"), and 24 pass, 3 skipped after it. The line was written into `AGENTS.md` by a
  script that reads it from `KEPT_GROUPS` and wraps it at 100 columns, never typed. Then `js-harness rules check`,
  which passed before, failed with three findings: each new span of `AGENTS.md` "is declared nowhere" and either
  names its rule or is listed as context with its reason in bin/lib/rules-coverage-data.mjs. The depth pass missed
  this: it searched for the list and not for what holds every sentence of `AGENTS.md`. What the register says of
  the same words in their home: the source `rules-block` holds them as owed since the baseline of 2026-10-28, an
  obligation no rule carries yet; a span written after the baseline cannot be owed. Two ways were open. Taken, and
  mine: the list's two spans are context, since they define a term and oblige nothing by themselves (the sentences
  that act on it do: the sizing sentence of `CLAUDE.md`, the kept Delegation lines), and the test holds the copy to
  the line the register already counts. Not taken, his and not put to him: declaring the list a rule of his with
  `js-harness rules change`, which needs his words; the lead was told in one note (05:56 local) and nothing here
  waits on it. The third finding was the sentence this session had added to say where the other copy is: it was not
  among the six items his yes covers, it cost 36 estimated tokens a turn, and the test's message and the constant's
  comment say the same, so it left. `AGENTS.md` measures 1210 of 1500. The sizing sentence of `CLAUDE.md` is an owed
  span edited in place, so `rules coverage --refresh` renamed its hash; the debt did not grow (`rules coverage`
  counted 454 owed with the three findings open and 454 with them settled). `js-harness rules check` passes again.
- L7 T3, the independent verifier (a fresh sub-agent, read-only, given commit f6a2be08, the question and his option,
  and not this document): "holds". What it checked, each by a command: the paragraph of `AGENTS.md` equals the kept
  line and the line of his global file, 797 characters, and the diff of `AGENTS.md` adds those nine lines and a
  blank one alone; `CLAUDE.md` changed in line 21 alone and its pointer is true; `checkBudget` gives 1210 of 1500;
  the two context entries are honest by the register's own kind (the same words stay owed in their home, hash
  26d30c169b1b of the source `rules-block`), and `rules check` passes; every statement of the two doc comments is
  true against `85d17a02^:CLAUDE.md`. One thing of it was checked here before building on it: the list is at
  bin/lib/rules-block.mjs:56, as it said. Its three defects. First, taken: the test looked for the line anywhere
  in `AGENTS.md`, so it passed with a seventh item appended, with "No longer in force:" before it, inside an HTML
  comment and beside a second copy, and only `rules check` caught those; the test now takes the paragraphs of
  `AGENTS.md` that hold the mark `**High risk**` and wants exactly one, equal to the line. Proven in memory on
  eight altered copies: those four, a sentence added after it and a changed word are refused, the file as it is
  passes, and so does another paragraph that only names "a high-risk item". Second, taken: this document cited
  bin/lib/rules-block.mjs by lines the commit itself moved; item 2 of the depth pass now says at which commit they
  are read. Third, answered and left: `CLAUDE.md:21` is 102 columns wide; rewrapping it would change lines 22 to 26
  of a file another session edits tonight, and line 25 is already 115. Not checked by the verifier, by its own
  list: `npm run check` (the commit hook ran it), the count of 36 test files, the 454 owed and the red-first run,
  which are this session's own measures above.
- L8 T4, the reviews of the slice 52925c7b..a16a9e3 (f6a2be08 and a16a9e3), each run once. The gate: `npm run check`
  passed in the hook of each of the three commits. Codex (gpt-6.1-sol, medium, 42,838 input tokens, 22 s, given this
  document): "the patch is correct (confidence 0.96)", no finding. The Claude lenses, run d10f1702 (risk,
  readability, reliability; about 7,150 input tokens each): risk 0 findings, readability 0, reliability 1 warning,
  rebutted with evidence and recorded with `js-harness double-review answer`: it read that "the range carries no
  patch for either file" and that the test would fail at head. A lens is not given Markdown (3 files left out), so
  it could not see them; `git diff --stat 52925c7b..a16a9e3 -- AGENTS.md CLAUDE.md` gives 10 insertions and 1
  changed line, and at head the test file gives 24 pass, 3 skipped.
- L9 Main merged in at 9e29880a (8007f0fe, pull request 825 of JH 172: `rules change --with` and its fixes), with no
  conflict; the merge wrote nothing of its own, so no review is owed for it. On the merged tree `rules check`
  passes, bin/lib/rules-block.test.mjs gives 24 pass and 3 skipped, and the hook's `npm run check` passed.
- L10 The close against the depth pass. Item 3: predicted 2 of 2 specs, measured 2 of 2: `git grep -c -i "high
  risk" -- AGENTS.md` gives `AGENTS.md:2` and exits 0, and the one test holds the list as its own paragraph and the
  pointer of `CLAUDE.md`. Item 4: the verdict held; the list fits at 1210 of 1500, 36 under the figure measured
  there because the added sentence left. What the pass did not foresee: `rules check` holds every sentence of
  `AGENTS.md` to a rule or to a listed reason (L6), which added one file to the change and one decision that stays
  his, whether the list becomes a declared rule.
