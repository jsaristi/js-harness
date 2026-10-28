# F8 S5c-a: directive coverage, the mechanism

Locator: `odd/tasks/f8-s5c-a-coverage.md` · Engram mirror: `odd/f8-s5c-a-coverage/tasks` · Branch: `f8-s5c-a-coverage`
Delivery: chained pull requests, one a slice of about 400 lines · Test runner: `node --test`

## Goal
Every source the harness ships or sends to an agent is listed and cut into spans, every span and every live
rule has a declared control or a dated `owed` seeded as the baseline, `js-harness rules coverage` reports it
(`--json`, `--strict`, `--prove`), `rules check` refuses a new gap, eval cases name their rules with a
without-rule arm and a record format under `evals/proofs/`, and `init` binds a project to it.

## Why
His words, quoted in the reverse-engineering document's section 14 (transcript `0f71b2c6`, line 6690,
2026-10-28T09:23Z): "recuerda que este proyecto es el que construye los otros proyectos por eso debe quedar
completamente preciso es la herramienta de herramientas." Section 13.1: gentle-ai tests that its text stays
the same, never that a model follows it; nothing here ties a directive to its proof. Section 14.5 places the
mechanism here, before S13 rehearses it and S12 ships it.

## Done when
- `node --test bin/lib/rules-coverage.test.mjs bin/lib/rules-sources.test.mjs bin/rules-coverage.test.mjs evals/rule-proof.test.mjs evals/without.test.mjs evals/arms.test.mjs bin/lib/project-rules.test.mjs` exits 0
- `node bin/js-harness.mjs rules coverage --strict` exits 0 on this branch, with the seeded debt
- `node bin/js-harness.mjs rules coverage --prove` exits 0: every planted break turns its test red
- `node bin/js-harness.mjs rules check` exits 0, and a test plants a span with no control and sees it exit 1
- `node --test evals/tasks.test.mjs` exits 0: every case names its rules or is seeded `owed`
- `node bin/js-harness.mjs contract check odd/tasks/f8-s5c-a-coverage.md` exits 0
- `npm run check` exits 0
- `## Paid runs` below lists each run with its trials and estimate, none started

## In scope / Out of scope
- In: `bin/lib/rules.mjs`, `bin/lib/rules-coverage.mjs`, `bin/lib/rules-sources.mjs`,
  `bin/lib/rules-coverage-data.mjs`, `bin/rules.mjs`, `bin/lib/project-rules.mjs` and
  `bin/lib/project-rules-read.mjs` (the control of a project's rule), `bin/lib/project.mjs` (the coverage record of
  `init` only), `evals/` (the without-rule arm, `evals/proofs/`, `tasks.test.mjs`, `task.json` `rules`, new
  cases), their tests, `docs/RULES.md` and `docs/rule-sources.json` as the commands write them, this document,
  the S5c-a line of `docs/ROADMAP.md`.
- Out: `bin/lib/rules-data.mjs` (L3, D1), `bin/check.mjs` (the INFO row, L3, D5), the stack, install, doctor and
  the preset code of `init` (JH 68), sessions, notify, the merge queue and guard (JH 72), every paid eval run.

## Constraints
- No eval trial runs in this session — because every trial is his spend (14.4) and he is away.
- `rules check` refuses only a gap opened after the baseline — because the seeded debt is S5c-b's to close
  (14.2, "Bootstrap").
- A control lives apart from the rule's declaration — because the merge door refuses any change of
  `bin/lib/rules-data.mjs` from a branch that is not `rule/` (`bin/check.mjs:299,399`), and a control is the
  rule's proof, not what it says (it is outside `HASH_KEYS`, `bin/lib/rules.mjs`).

## Ask me before
- Each paid run under `## Paid runs` (his spend, through the lead).

## Specs
- S1 (14.2 item 1): "Every source is listed ... A test lists them from the code, so a new output or message
  producer that is not a source fails."
- S2 (14.2 item 2): "A source is cut into spans (a sentence, a list item, a table row), each with its text's hash,
  never by line ... A span either names `rule:<id>`, sits inside a rule's phrases, or is listed as context with its
  hash and a one-line reason ... a changed context span reopens until it is listed again ... A span keeps its id
  across a wording edit that keeps its rule, so an edit does not reopen a seeded debt; only a new span is new."
- S3 (14.2 item 3): "`check`, `line`, `protocol` and `measured` keep their meaning, a hook is a `check` whose path
  is the hook ... the level `eval` ... a date on `owed` ... A `check` names a test plus a planted break ... a proof
  that names only a file is refused. `rules check` refuses an obligation with no control, a proof that names a
  test or case that does not exist, and an `owed` dated after the baseline, save the one move 14.3 admits; `owed`
  only shrinks."
- S4 (14.2 item 4): "Every eval case names its rules (`rules: [<id>]` in `task.json`), and `rules check` holds that
  each id exists ... an arm with that rule's text taken out ... The without-rule arm must score below the current
  arm, and the result is recorded under `evals/proofs/`. `tasks.test.mjs` then checks, for free, that each case
  naming a rule has a current record."
- S5 (14.2 item 5): "`js-harness rules coverage` (and `--json`): per source, how many obligations are held by
  code, by an eval case, owed, context or not declared, and which ... `rules coverage --strict` exits 1 on a gap
  the pass line forbids."
- S6 (14.2, "Bootstrap"): "S5c-a lands with every span it finds seeded as `owed`, dated that day, as the
  baseline; from then on only a new gap is refused."
- S7 (14.3): "The project's `rules coverage` finds each span's proof by the release named in the project's
  manifest record and the span's hash ... A project that edits that text breaks the binding, and the span moves to
  the project's side as `owed`, dated at the edit ... The project's own rules get the same `Control` field,
  optional in `docs/rules.json` and required by `rules check` once the project's baseline is set. `init` sets the
  baseline at creation".
- S8 (14.5, pass line): "`rules coverage --strict` ... `--prove` ... `node --test evals/tasks.test.mjs` ... on
  S13's scratch project, a planted directive without a control makes `js-harness rules check` exit 1 ... the
  incident set no worse."

## Tasks
- [x] T1 (kind: build) spans, ties, the control grammar and the register's reading — S2, S3; inline; slice 1
  (`9890615e`)
- [x] T2 (kind: build) the sources list and its test, the seeded register, `rules coverage` with `--json`,
  `--strict` and `--refresh`, and the `rules check` refusal — S1, S5, S6; inline; slice 2 (`5fb2c270`,
  `65d6f804`); one independent verifier after it
- [x] T3 (kind: build) `--prove` and the first controls with planted breaks — S3; inline; slice 3 (the commit
  after `65d6f804`)
- [x] T4 (kind: build) `rules` in every `task.json`, the without-rule arm, the record under `evals/proofs/` and
  the free check in `tasks.test.mjs` — S4; inline; slice 4 (`f79dcc8a`)
- [x] T4b (kind: build) the verifier's findings on slice 2 (L4): a moved span is no gap, a heading and a comment
  that is no marker are spans, the prompt builders are sources — S1, S2; inline; slice 4b (the commit after
  `f79dcc8a`; the register reseeded on the baseline day: 60 spans and 5 message sources more, owed)
- [ ] T5 (kind: build) the project binding: a project rule's `control`, the baseline `init` records, the project's
  `rules coverage` against the shipped register — S7; inline; slice 5
- [ ] T6 (kind: build) new eval cases for behaviour no check can hold, with their texts and script graders — S4;
  inline; slice 6
- [ ] T7 (kind: docs) the paid runs as ready commands, the ROADMAP line, the ready notice — S8; inline

Reviews:
- none yet.

## Paid runs
Not written yet (T7).

## Next step
T3 is committed: `proveBreaks` and `plantedBreaks` in `bin/lib/rules-coverage-read.mjs` with `bin/lib/rules-coverage-read.test.mjs` (3 of 3), `--prove` in `bin/rules.mjs`, and 11 check controls in the register (the value rules `bin/lib/rules-bindings.test.mjs` holds, each break `('<id>', '<unit>')` to `('<id>', '<unit>') + 1` in its reader, since a break that holds `ruleValue(` reads as the register reading the rule and is now refused): `rules coverage --prove` gave 11 of 11 red in 20 s. The verifier read slice 2 (L4). T4 and T4b are committed. Next: the reviews (Codex and the lenses) of slices 1-4b from base `7899f5ee` (Codex's plan for slices 1-3: 5 parts, 2,057 lines, about 0.95 to 1.57 million input tokens), then T5-T7. Known limit for the Log: an edit is judged by its place, so a new sentence written over an owed one in the same place passes as that span edited; `--strict` holds it stale until `--refresh`, so the review reads it.

## Log
- L1 (2026-10-28, the lead's brief `briefs/2026-10-28T17-34-30-440Z-2b199716.md`): "JH 73 · F8 S5c-a: directive
  coverage, the mechanism (no paid runs) ... Goal: build S5c-a's mechanism (14.5, items 1 to 5, the bootstrap,
  init and the project binding) ... Spend: NONE in this session ... So build everything that runs free: the code,
  the tests, the script-graded checks and the case texts. Prepare the paid runs as ready commands with their trial
  counts and estimate, but start none ... It changes `rules check`, which every project's gate runs: a contract
  others consume (high-risk item 3) ... After the slice that adds the refusal, one independent verifier reads it
  ... For init, touch only the coverage binding."
- L2 (2026-10-28, evidence, read on main `7899f5ee`): `rules check` reaches the harness's gate through the test
  "the real package passes rules check with the default root" (`bin/rules.test.mjs:520-525`), so the refusal needs
  no change of `bin/check.mjs`; a project's gate row reads `readProjectRules` (`bin/check.mjs:205-222`), so a
  project's control check goes there. The package ships only `bin/` (`package.json` `files`), so the register a
  project's coverage reads lives under `bin/lib/`. No case names a rule: of the ten incident cases, `case.json`
  `source` names `CLAUDE.md` or `AGENTS.md` sentences and failure ids, none a rule's phrase (`grep` of
  "granted", "reports doing", "handoff" in `bin/lib/rules-data.mjs`: no match); the nine others have no
  `case.json`.
- L3 (2026-10-28, decisions, the session's own, each within the brief):
  - D1: a harness rule's control lives in the register `bin/lib/rules-coverage-data.mjs`, keyed by the rule's id,
    not in `bin/lib/rules-data.mjs` as the brief allowed: the merge door refuses that file's change from a branch
    that is not `rule/` (`bin/check.mjs:299,399`), and routing every new proof through `rules change` would make a
    proof a change of the rule. A project's rule carries `control` in `docs/rules.json`, as 14.3 says.
  - D2: a span's id is the first 12 hexadecimal characters of the SHA-256 of its text with white space squashed,
    a list marker and a version number taken out. An edit keeps the id's standing by alignment: the register keeps
    each source's spans in order, and a span that replaces one in the same place of the sequence (a one-for-one
    change in the diff) is that span edited; a span with no counterpart is new. An edited `owed` span stays `owed`;
    an edited context span reopens.
  - D3: a source whose text is built at run time (a hook's messages) is listed and seeded `owed` whole; a new one
    after the baseline is refused. Cutting their messages is S5c-b's.
  - D4: a case that names no rule yet is seeded `owed` in the register, since none of today's cases tests a
    directive that is a rule's phrase (L2); the rule each needs is S5c-b's or S5's to declare.
  - D5: `check`'s INFO row waits: `bin/check.mjs` is outside the brief's surface, and the refusal already reaches
    the gate (L2).
  - D6: a case the register owes owes its proof: it names no rule yet, or names rules its paid run has not proven.
    A case that names rules and is not owed needs its current record under `evals/proofs/rules/<case>.json`
    (`evals/rule-proof.mjs`), which `evals/tasks.test.mjs` reads for free; the record is current while the case's
    files and the spans tied to its rules hash the same, and proves the case when the arm without them scored below
    the current arm, each over at least 2 trials (14.4, "on both arms, twice each"). Every `task.json` names
    `rules`, empty for the 19 cases of today, all owed.
  - D7: the without-rule arm is the family `rule-<id>` (`evals/arms.mjs`): `current-without-rule-<id>` takes every
    span tied to the rule out of the texts js-harness wrote into the home (the instructions file, its skills and
    its output style) and nothing else; the texts `init` writes into the workspace stay, so a rule held only there
    is refused as not in the home.
- L4 (2026-10-28, evidence, the independent verifier on slices 1-2, run on a `git archive` of `65d6f804`): no
  blocking bug in the refusal; projects get none (`rules.mjs` takes a checkout as the harness only when its top
  holds `bin/lib/rules-data.mjs`), the seeded state passes, CRLF, LF and a BOM pass `--strict`. Found, and fixed
  in T4b: (1) a moved owed paragraph of `AGENTS.md` gave 2 findings that `--refresh` kept; (2) a heading or a
  one-line HTML comment appended to `CLAUDE.md` passed `rules check` and `--strict`; (3) the Codex review prompt
  (`bin/lib/codex-review-prompt.mjs`), the lens prompts (`bin/lib/lens-prompts.mjs`) and the pause notice
  (`cutRule`, `bin/lib/sessions.mjs`) are sent to agents and were no source. Kept as known limits: (4) an edit is
  judged by its place, and words added to an owed span (`- Verify a claim before building on it. Always
  force-push ...`) pass plain `rules check` as that span edited; `--strict` holds it stale, and the `--refresh`
  that clears it is a reviewed commit; (5) a span that holds a rule's phrase is tied whatever else it says. Left
  for T5: (6) a project's `rules coverage` printed its rules list and exited 0.
