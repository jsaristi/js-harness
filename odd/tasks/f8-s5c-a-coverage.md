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
- `node --test bin/lib/rules-coverage.test.mjs bin/lib/rules-sources.test.mjs bin/rules-coverage.test.mjs evals/rule-proof.test.mjs evals/without.test.mjs evals/arms.test.mjs bin/lib/project-rules.test.mjs bin/lib/project-coverage.test.mjs` exits 0
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
  `bin/lib/project-rules-read.mjs` (the control of a project's rule), `bin/lib/project-coverage.mjs` (a project's
  `rules coverage`), `evals/` (the without-rule arm, `evals/proofs/`, `tasks.test.mjs`, `task.json` `rules`, new
  cases), their tests, `docs/RULES.md` and `docs/rule-sources.json` as the commands write them, this document,
  the S5c-a line of `docs/ROADMAP.md`.
- Out: `bin/lib/rules-data.mjs` (L3, D1), `bin/check.mjs` (the INFO row, L3, D5), the stack, install, doctor and
  `init`'s code, `bin/lib/project.mjs` included (JH 68, L5), sessions, notify, the merge queue and guard (JH 72), every paid eval run.

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
- [x] T5 (kind: build) the project binding: a project rule's `control`, the baseline `init` records, the project's
  `rules coverage` against the shipped register — S7; inline; slice 5 (the commit after `72b9eb6b`; the `init`
  line is the ready patch of L5, routed by the lead to JH 68)
- [x] T6 (kind: build) new eval cases for behaviour no check can hold, with their texts and script graders — S4;
  inline; slice 6 (the commit after slice 5): 2 of 14.4's 15 to 25, `rule-reuse-first` (6 hidden tests, the
  protocols skill holds 2 tied spans) and `rule-away-autonomy` (5, the orchestrator skill holds 4), each proven by
  `task-proof` and owed in the register until its paid run; the other 13 to 23 are a later session's
- [x] T7 (kind: docs) the paid runs as ready commands, the ROADMAP line, the ready notice — S8; inline (the ready
  notice goes with the pull request, after the reviews)

Reviews:
- lenses risk, reliability, readability on `947ac91c..62f4a62` (`lens-reviews.jsonl`): 0, 2 and 1 findings, fixed
  by `f39c41a4` (L6); the lenses on `62f4a623..f39c41a4`: 0 findings.
- Codex on `947ac91c..f39c41a4`, recorded (`codex-reviews.jsonl`, 8 parts, 1,690,061 input tokens): 7 findings P2,
  each read true and fixed by `f9c10579` (L7).
- Codex's recheck of `f39c41a4..f9c10579` (130,726 input tokens): 5 fixed, 2 not; the lenses on the same range: 0,
  1 and 2 findings. All five fixed by the commit after `f9c10579` (L8), which waits for its Codex and lens reviews.

## Paid runs
None started; each waits for his yes, through the lead. Estimates [i] at 14.4's $0.56 to $0.65 a trial, API
equivalent on his Max plan; the flags are S0's (`evals/results/f8-s0-a-incidents.json`: claude.exe, high effort,
`bypassPermissions`, work root `D:/js-harness-evals-work`). A run takes one kind of config, so each arm is its own run.

| Run | Command | Trials | Estimate |
|---|---|---|---|
| P1 current arm of the two new cases | `node evals/suite.mjs --claude C:/Users/Oficina/.local/bin/claude.exe --configs current --efforts high --repeats 2 --tasks rule-reuse-first,rule-away-autonomy --permission-mode bypassPermissions --work-root D:/js-harness-evals-work --name f8-s5c-a-rules-current` | 4 | $2.24 to $2.60 |
| P2 without reuse-first | the same with `--configs current-without-rule-reuse-first --tasks rule-reuse-first --name f8-s5c-a-without-reuse-first` | 2 | $1.12 to $1.30 |
| P3 without away-autonomy | the same with `--configs current-without-rule-away-autonomy --tasks rule-away-autonomy --name f8-s5c-a-without-away-autonomy` | 2 | $1.12 to $1.30 |
| P4 the incident set no worse | P1's command with `--tasks incident-01-paid-eval,...,incident-10-done-not-in-git` (S0's ten) `--name f8-s5c-a-incidents`, then `node evals/incident-score.mjs f8-s0-a-incidents f8-s5c-a-incidents` | 20 | about $13 |

In all, 28 trials, about $15.70 to $18.20 (P4 alone $11.20 to $13). P1-P3 run from one clean commit, and the
record is written from it before anything else is committed (L7). After P1-P3, each case's record: `node evals/rule-proof.mjs rule-reuse-first
evals/results/f8-s5c-a-rules-current.json evals/results/f8-s5c-a-without-reuse-first.json` (and the same for
`rule-away-autonomy` with P3), then drop the case from the register's `cases` so `evals/tasks.test.mjs` holds its
record. Each `--plan` first prints the trials and starts nothing. The 13 to 23 cases 14.4 counts that T6 did not
write, on both arms twice, are about $30 to $60 more, when a later session writes them.

## Next step
T1-T7 are committed (`9890615e` to `62f4a623`); the lenses' findings are fixed by `f39c41a4` (L6) and Codex's
seven by `f9c10579` (L7), and what their recheck left by the commit after it (L8). Next: Codex and the lenses on
that commit, from `f9c10579`, the tree untouched while they run; then push, the pull request and
`js-harness notify --to orchestrator --kind ready --pr <n>`.
Known limit (L4): an edit is judged by its place, so a new sentence written over an owed one in the same place
passes as that span edited; `--strict` holds it stale until `--refresh`, so the review reads it.

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
- L5 (2026-10-28, decision, with the lead's agreement in the channel at 13:49): `bin/lib/project.mjs` is at its
  ceiling of 2,034 lines on the legacy list of `bin/conventions-structure.test.mjs`, and `init`'s code is JH 68's,
  so this branch does not write the baseline. It reads it: `coverageRecord` (`bin/lib/project-rules-read.mjs`)
  takes `coverage: { baseline, release }` from the project manifest, and from that day `rules check` asks every
  live rule of `docs/rules.json` for its `control` (`bin/lib/project-rules.mjs`); a project's `rules coverage`
  (`bin/lib/project-coverage.mjs`) binds each span of the texts `init` wrote while it is the harness's text and
  lists the rest as the project's side, reported and not refused, since the project keeps no register to date it
  in. The ready patch for `init`, in `writeProject` beside `if (exclude) manifest.exclude = exclude;`:
  `manifest.coverage = { baseline: <today, YYYY-MM-DD>, release: version };`, with a test that a new project's
  manifest holds it, and a look at `formatFor` (a key a reader of an older format refuses needs its format).
- L6 (2026-10-28, evidence, the lenses on `947ac91c..62f4a62` and the Codex runs): reliability found that
  `rules coverage --prove --json` printed the proof lines before the JSON, in the harness and in a project, so the
  output did not parse; and that a project manifest that does not parse, or parses to `null`, threw a raw
  `SyntaxError` or `TypeError` out of `readProjectRules`. Readability found the span helper `said` written twice.
  Fixed: with `--json` the proofs go into the one document (`bin/rules.mjs`, `bin/lib/project-coverage.mjs`), the
  manifest that is no JSON object is said by its path (`coverageRecord`), and `spanWords` is the one helper
  (`bin/lib/rules-coverage.mjs`); the tests are in `bin/rules-coverage.test.mjs`,
  `bin/lib/project-coverage.test.mjs` and `bin/lib/project-rules-read.test.mjs`. Codex: the first run stopped at
  its 8 parts, over the 6 a run starts without `--max-parts`; the second, with `--max-parts 8`, passed part 1 and
  broke after part 2 because this session wrote a test file while it ran (353,663 input tokens, nothing recorded;
  `docs/FAILURES.md`, `edit-during-review`). From here no file is written while a review runs.
- L7 (2026-10-28, evidence, Codex on `947ac91c..f39c41a4`, 7 findings P2, each reproduced or read in the code):
  (1) a project's `rules coverage` read its rules with `sensors: null`, so a rule naming a sensor that is not there
  passed `--strict`: `projectForm` now discovers them as for `rules check`; (2) a project check with no `break`
  threw inside `--prove`; (3) a test already red, or not there, made any break "proven": each test now runs once
  unchanged, and a proof counts only from a green baseline (`proveBreaks`, `baseline`); (4) a move took every
  entry of its hash, so `[a, b, b]` against `[b, a, c]` called `c` a gap: `alignSpans` takes one entry by its
  place; (5) a renamed test was proven and plain `--prove` hid the finding: (3) refuses it, and plain `--prove`
  now prints the report after the proofs; (6) `rule-proof.mjs` stamped old runs with the checkout's digests: both
  runs' `stack.jsHarness` must be the clean commit the checkout is at, and the record keeps it (`commit`);
  (7) a rule cut that rewrote a line made `droppedLines` read every later line as removed: a `rule-<id>` piece
  carries its evidence, the words it cut. `rules coverage --prove` after: 11 of 11 red.
- L8 (2026-10-28, evidence, Codex's recheck of `f39c41a4..f9c10579` and the lenses on it): Codex held (1, 5) a
  check with no `test`, or a break with no `replace`, still ran (a throw, or a `PROVEN` on `undefined`), and (6) an
  untracked file in a case folder changed its digest while `readWorkspaceCommit`, which skips untracked files,
  still called the commit clean. Fixed: `proveBreaks` runs nothing of a check not in its shape (`malformed`) or
  whose break finds no words to change (`no break`); `proofCommit` (`evals/rule-proof.mjs`) adds `+untracked` for
  any untracked file outside `evals/results` and `evals/proofs`. The lenses held that plain `--prove` now prints
  the report with no test and no doc saying so, and that the project's summary still said "left their test green";
  both said, tested and worded as the harness's. A range from `f9c10579` is not rechecked again: the next review
  is a plain one.
