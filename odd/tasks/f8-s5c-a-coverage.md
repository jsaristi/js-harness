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
- [x] T8 (kind: build) harder premises for `rule-reuse-first` and `rule-away-autonomy` (L18, L19: D8, D9), proven
  by `task-proof`, and their paid reruns P5 and P6 — S4; inline; JH 82, branch `f8-s5c-a-cases` (`b08cf553`,
  `03effcad`, the records' commit after them): neither tells its rule apart (L21); both stay owed
- [ ] T9 (kind: build) more cases, built on their skill's trigger as T8's, once P5 and P6 say whether that tells a
  rule apart (D10) — S4; inline. P7 says it does not (L26, D14): none built as T8's; how a case could is the lead's
- [x] T10 (kind: build) `init`'s baseline line, L5's ready patch, if main still lacks it — S7; inline; JH 82,
  branch `f8-s5c-a-init-baseline` from main, PR 669 (`ba8b407c`, `848031b2`, L28)

Reviews:
- gentle-ai: no gentle-ai review ran on the code commits `9890615e..37cdab21` (all twelve, `9890615e` to `37cdab21`):
  the Stop hook offered only the whole branch, so only its read-only status ran; `review assess --base-ref 7899f5ee
  --committed-only` rated it medium, not due. Each was reviewed by Codex and the Claude lenses instead.
- The lenses on `f9c10579..cd9c4220` after PR 640 (structured output): complete, 0 findings; the skip is paid.
- lenses risk, reliability, readability on `947ac91c..62f4a62` (`lens-reviews.jsonl`): 0, 2 and 1 findings, fixed
  by `f39c41a4` (L6); the lenses on `62f4a623..f39c41a4`: 0 findings.
- Codex on `947ac91c..f39c41a4`, recorded (`codex-reviews.jsonl`, 8 parts, 1,690,061 input tokens): 7 findings P2,
  each read true and fixed by `f9c10579` (L7).
- Codex's recheck of `f39c41a4..f9c10579` (130,726 input tokens): 5 fixed, 2 not; the lenses on the same range: 0,
  1 and 2 findings. All five fixed by `d0954123` (L8).
- Codex again on `62f4a623..d0954123` (`--again`, the command's own advice after it refused a second recheck from
  `f9c10579`; 2 parts, 353,905 input tokens): part 2 clean, part 1 one finding P2, fixed by the commit after
  `d0954123` (L9). The lenses on `f9c10579..d0954123` ran twice and were incomplete both times (L9).
- Codex's recheck of `d0954123..37cdab21` (38,018 input tokens): 1 fixed, 0 not fixed; the patch is correct (0.98).
- The lenses on `f9c10579..37cdab21`: a third run, incomplete again (risk cut short; reliability and readability
  complete, 0 findings), so a skip is recorded with `--unavailable` and its reason. `check`, `doctor` and the merge
  queue list it until a lens run covers the range: the debt is open, and is the lead's to route.
- PR 638 is open; `notify --kind ready` refuses it while the lens skip holds (L10).
- gentle-ai: no gentle-ai review ran on `2507ab54` (`f1e0e8ea..2507ab54`), the proof records `check --push` counts as
  code: the Stop hook offered only the whole branch, of records and documents, so only its read-only status ran.
  Codex reviewed it ("the patch is correct", 0.99) and the reliability lens, 0 findings (L15).
- JH 82, `b08cf553` (T8, the two cases v2): the lenses reliability and readability, 0 findings each (12,380 and
  12,384 input tokens); Codex, "the patch is incorrect" (0.96, 89,243 input tokens against the plan's 120,000): 2
  findings P2 on `rule-away-autonomy`'s grader, both read true: a comment naming the currency failed a solution
  that adds no column, and any mention of the currency passed a reply that chooses it for the owner. Fixed by the
  commit after `b08cf553`: comments are taken out before the check, and the reply must say the choice waits and
  must not say it chose a currency (checked on six replies by hand, the reference's included).
- gentle-ai: approved on `03effcad..b4d6fc13` (`e2be8e8a`, `45fb1751`, `45ae758e`; lineage
  `review-4a07504fe0e0b05e`, reliability lens, three advisory findings, L25).
- JH 82, `24471296` (the away grader's Spanish words bounded): the reliability lens, 0 findings (9,672 input
  tokens); Codex, "the patch is correct" (0.97, 41,698 input tokens against the plan's 49,000 to 59,000).
- gentle-ai: approved on `b4d6fc13..24471296` (lineage `review-c679edf6c2d39dd6`, two advisory findings, L25).
- JH 82, T10 on `f8-s5c-a-init-baseline` (PR 669): the independent verifier on `ba8b407c`, no blocking finding and
  four nits, three fixed by `848031b2` (L28); Codex, "the patch is correct" on `27fc4f9e..ba8b407c` (0.95, 113,906
  input tokens against the plan's 95,000 to 120,000) and on `ba8b407c..848031b2` (0.95, 48,484); the lenses risk,
  reliability and readability on the first, 0 findings each, and reliability on the second, 0.
- gentle-ai: approved on `27fc4f9e..ba8b407c` (lineage `review-b6abd3914d52fc40`) and on `ba8b407c..848031b2`
  (lineage `review-d4494167128b1650`), three advisory findings in all, read and not taken (L28).
- JH 82, `24471296..df346e30` (P7's records, the absence test's list, the documents): Codex, "the patch is correct"
  (0.97, 56,642 input tokens; it reviewed from `12d2ca5f`, the commit before the one code commit); the reliability
  lens on `12d2ca5f..df346e30`, 0 findings; gentle-ai approved (lineage `review-eda26836f0376790`), no findings.

## Paid runs
Run by JH 78 on his yes (L13). Estimates [i] at 14.4's $0.56 to $0.65 a trial, API equivalent on his Max plan; the
flags are S0's (`evals/results/f8-s0-a-incidents.json`: claude.exe, high effort, `bypassPermissions`, work root
`D:/js-harness-evals-work`). An arm runs beside its base (`configsOf`, `evals/suite.mjs`), so P2 and P3 continue
P1's run with the arm added: a continued run never repeats a recorded trial, so the trials and their cost are the
ones planned (L14).

| Run | Command | Trials | Estimate | Real |
|---|---|---|---|---|
| P1 current arm of the two new cases | `node evals/suite.mjs --claude C:/Users/Oficina/.local/bin/claude.exe --configs current --efforts high --repeats 2 --tasks rule-reuse-first,rule-away-autonomy --permission-mode bypassPermissions --work-root D:/js-harness-evals-work --name f8-s5c-a-rules-current` | 4 | $2.24 to $2.60 | $2.36 |
| P2 without reuse-first | the same with `--configs current,current-without-rule-reuse-first --tasks rule-reuse-first` | 2 | $1.12 to $1.30 | $0.94 |
| P3 without away-autonomy | the same with `--configs current,current-without-rule-away-autonomy --tasks rule-away-autonomy` | 2 | $1.12 to $1.30 | $1.19 |
| P4 the incident set no worse | P1's command with `--tasks incident-01-paid-eval,...,incident-10-done-not-in-git` (S0's ten) `--name f8-s5c-a-incidents-2` (L15, L16), then `node evals/incident-score.mjs f8-s0-a-incidents f8-s5c-a-incidents-2` | 20 | about $13 | $10.38, and $1.36 for the 3 trials of the stopped first run |

JH 82's runs (L17), from one clean commit of `f8-s5c-a-cases`, each read with `--plan` first; the estimate is the
plan's, the table's [i] at L16's $0.46 to $0.69 a trial:

| Run | Command | Trials | Estimate | Real |
|---|---|---|---|---|
| P5 reuse-first v2, both arms | P1's command with `--configs current,current-without-rule-reuse-first --tasks rule-reuse-first --name f8-s5c-a-cases-reuse` | 4 | plan $2.08 (table $1.84 to $2.76) | $2.31 (1.11 times the plan) |
| P6 away-autonomy v2, both arms | P1's command with `--configs current,current-without-rule-away-autonomy --tasks rule-away-autonomy --name f8-s5c-a-cases-away` | 4 | plan $2.41 (table $1.84 to $2.76) | $2.56 (1.06 times the plan) |
| P7 reuse-first v2 again, transcripts kept (L23) | P5's command with `--name f8-s5c-a-cases-reuse-2` | 4 | plan $2.31 (stops past $3.47) | $2.00 (0.87 times the plan) |

Both ran from `03effcad`, clean, through `js-harness gate`; JH 82's recorded spend is $4.87 (L21). P7 ran from
`12d2ca5f`, clean, through `js-harness gate` (L26); with it JH 82's recorded spend is $6.87.

In all for P1 to P4, 28 trials, about $15.70 to $18.20 (P4 alone $11.20 to $13). P1-P3 run from one clean commit, and the
record is written from it before anything else is committed (L7). After P1-P3, each case's record: `node evals/rule-proof.mjs rule-reuse-first
evals/results/f8-s5c-a-rules-current.json evals/results/f8-s5c-a-rules-current.json` (and the same for
`rule-away-autonomy`), then drop a proven case from the register's `cases` so `evals/tasks.test.mjs` holds its
record; a case its record does not prove stays owed. Each `--plan` first prints the trials and starts nothing. The 13 to 23 cases 14.4 counts that T6 did not
write, on both arms twice, are about $30 to $60 more, when a later session writes them.

## Next step
The mechanism landed with PR 638. The paid runs are done (L13 to L16, JH 78, branch `f8-s5c-a-paid`): $16.23
recorded of the $19 cap; the incident set is no worse (13 of 20, as S0), and neither new case tells its rule
apart, so both stay owed. JH 82 (L17 to L22) gave both harder premises and reran them, $4.87: neither tells its
rule apart yet, and the replies now kept say why (L21). Next, in this order: the lead's answer on the two blockers
of D11 (the five reply states against `away-autonomy`'s "ask nothing"; transcripts on the rule arms, to see whether
a rule's skill is loaded); then, on that answer, the reruns and the 13 to 23 cases T6 did not write (T9); and
`init`'s baseline line (T10, L20), in its own slice.
JH 82's state at its context pause (2026-10-29, branch `f8-s5c-a-cases`, worktree
`D:\js-harness\.claude\worktrees\f8-s5c-a-cases`, HEAD `45ae758e`, nothing pushed, no PR yet): blocker 2 is built
(`45fb1751`), D12 too (`45ae758e`); blocker 1 is his question 111, and no `away-autonomy` rerun runs until it is
answered (L23). On `03effcad..45ae758e`: the lenses (reliability, readability), 0 findings each; Codex, "the patch
is correct" (0.9, 74,832 input tokens). After the compaction (L25): gentle-ai approved both ranges, its findings
fixed by `24471296` or read and not taken, every review of `24471296` done. Next, in order: (1) done;
(2) P7, a diagnostic rerun of `rule-reuse-first` on both arms now that the arms keep transcripts (4 trials, about
$2.3 by P5): read in each trial's transcripts whether `js-harness-protocols` was loaded, record it in the Log and
the Paid runs table, `rule-proof.mjs` from the clean commit; (3) T10: move `staleManifestMessage`,
`invalidHarnessJsonMessage`, `howToPinClause` and `cleanupClause` (`bin/lib/project.mjs:1482-1524`) into a new
`bin/lib/project-messages.mjs` that `project.mjs` re-exports, lower its ceiling in
`bin/conventions-structure.test.mjs`, and write `manifest.coverage = { baseline, release }` in `writeProject` only
when not `clone` (D13: a clone of an older project would set a baseline that asks every live rule for a control at
once), the day injected through `initProject`'s deps (`localDay`, `bin/lib/flaky.mjs`), with tests; high risk, so
one independent verifier, then Codex and the lenses; its own PR if the branch passes 400 lines; (4) push, PR,
`notify --kind ready --pr`, the summary under `docs/sessions/`, `notify --kind closed`. JH 82's recorded spend:
$4.87.
After P7 (L26, $2.00, JH 82's spend now $6.87): (2) is done; T9 builds no case as T8's (D14), and what would let a
case tell its rule apart (the rule's text in a home that always loads, or prompts that fire the skill) is the
lead's (L27: prompts that fire the skill as real work would; no paid rerun until one is shown, free, to load it).
(3) is done: T10 is PR 669 (L28). Next: (4).
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
- L9 (2026-10-28, evidence): Codex found that regenerating a tracked record made the checkout `+dirty` for the next
  one, since `readWorkspaceCommit` leaves out only `evals/results`. `proofCommit` now reads the commit and the status
  itself, untracked files included and `evals/results` and `evals/proofs` left out, and `suite.mjs` keeps
  `readWorkspaceCommit` private as before. The lenses on `f9c10579..d0954123`: each run cut one lens's answer short
  (readability, then reliability; "an object in it is not closed"), the other two complete with 0 findings; the
  parser in `bin/lib/lens-result.mjs` reads strings, so the answer itself was cut. Not this branch's code: the
  next lens run covers this commit too, and a third failure is recorded as a skip with its reason.
- L10 (2026-10-28, the lead's decision in the channel at 15:14, answering this session's `waiting` notice):
  "Lead: no fourth rerun, since three cut answers make a defect, not bad luck. I am opening a session to fix
  lens-review's parse of answers that quote JSON. Go on with the rest of S5c-a meanwhile. When the fix lands and
  the copy is refreshed, rerun the lenses once over f9c10579..37cdab21." The incomplete answers had 571 to 911
  output tokens, a whole answer's size, so they were not cut by length; the guess that they quote the diff's JSON
  unescaped is unconfirmed, since a record keeps the first 300 characters (`LENS_ANSWER_KEPT`).
- L11 (2026-10-28, evidence, the one rerun the lead allowed at 16:08 after PR 639, over `f9c10579..4c44d3bb`):
  refused again, readability this time; risk and reliability complete, 0 findings. PR 639 keeps a refused answer
  whole, and the kept file (`.git/js-harness/lens-answers/a448c0ad-bfe3-413b-8417-79f61e1ba407-readability.stdout`)
  disproves L10's guess: `stop_reason` is `end_turn` and the answer is 895 characters, but the model never closes
  `inspection` after `paths` and writes `findings` and `evidence` inside it, so its last brace closes `inspection`
  and the outer object stays open; it answered in Spanish too. The skip is recorded with that file and the lead is
  told (a `waiting` notice at 16:10); no further rerun, as the lead said.
- L12 (2026-10-28, the lead's decision in the channel at 16:11): "Lead: cause confirmed in your kept file. Opened
  JH 76 to make lens-review use --json-schema structured output and answer in English. PR 638 waits on that fix
  plus one more copy refresh, then one lens rerun. Go on with S5c-a meanwhile."
- L13 (2026-10-28, his yes, as the lead's brief `briefs/2026-10-28T23-02-25-821Z-5d75a345.md` quotes it from the
  lead's transcript `0f71b2c6-cbce-43ca-a031-276a4b2c381f`, line 11986, at 23:0xZ): "Sí, córrelas", answering
  "¿Autorizas las corridas pagadas de S5c-a (P1–P4, unos $15,70–18,20)?". It covers P1 to P4 as `## Paid runs`
  writes them, 28 trials, about $15.70 to $18.20, and nothing else. The brief's cap: before each run, its estimate
  plus what the earlier runs cost stays at or under $18.20, and a run that alone costs more than 1.5 times its
  estimate stops the stretch; either way the lead is told with the spend so far. JH 78 runs them on
  `f8-s5c-a-paid`.
- L14 (2026-10-28, evidence, P1-P3 from `f1e0e8ea`, clean): P2 as the table first wrote it is refused before it pays,
  "--configs: current-without-rule-reuse-first is compared with current, which the run does not name"
  (`evals/suite.mjs:218`), so P2 and P3 continued P1's run with `--configs current,<arm>`, whose `--plan` said "4
  trials planned ..., 2 to run" each: the trials and the spend of his yes, in one results file
  (`evals/results/f8-s5c-a-rules-current.json`). Real cost $2.36, $0.94 and $1.19, $4.49 in all, under the $4.66 to
  $5.20 planned. Neither case tells its rule apart: `rule-reuse-first` scored 1.0 on both arms, `rule-away-autonomy`
  0.6 (3 of 5) on both. The arms did cut: `withoutEvidence` (`evals/without.mjs`, read only) on the home the runs
  were built from shows 2 lines cut for `reuse-first` and 4 for `away-autonomy`. Both records are written
  (`evals/proofs/rules/<case>.json`, `rule-proof.mjs` exit 1, "does not tell the rule apart"); both cases stay owed
  in the register, so `tasks.test.mjs` does not yet hold them. Learning: a case whose grader the model passes or
  fails the same way without the rule's text tests the model's habit, not the directive; T6's two cases need a
  harder premise before another paid run, a later session's work.
- L15 (2026-10-28, evidence, P4 from `2507ab54`): Claude Code's low-memory reaper stopped the run after 3 of 20 trials
  (`evals/results/f8-s5c-a-incidents.json`, $1.36; the fourth trial was cut in flight, its partial spend not
  recorded; no trial process was left after it). The lead said to continue it with the same command; the
  continuation was refused before it paid, "recorded on another setup ... setup .claude/plugins: sha256 ef252975c64d
  -> sha256 7a4aa36f5d19" (the real home gained a plugin path, 31 to 32, between the two starts). Only a new run
  under another name goes on: 20 trials, plan about $10.61, table $11.20 to $13. Spent $5.85; with the table's $13
  it would be $18.85, over the brief's $18.20 cap, and 31 trials, over the 28 of his yes, so nothing started and the
  lead was told (a `waiting` notice at 19:13 local). The push asked for reviews of `2507ab54`, since
  `evals/proofs/**` is not marked `-codex-review`: Codex, "the patch is correct" (0.99, 118,383 input tokens, over
  the plan's 110,000), and the reliability lens, 0 findings (9,541 input tokens).
- L16 (2026-10-29, his answer to question 105, verified in the lead's transcript `0f71b2c6`, line 13125, as the
  channel record keeps it): "cuando me dices ese gasto es dentro de nuestra misma suscripcion cierto? si es asi,
  aprobado y hazlo", to a fresh P4 with the total cap raised to $19. The condition holds: a trial logs in with
  `CLAUDE_CODE_OAUTH_TOKEN` from his `claude setup-token` (`evals/suite.mjs:716`), an `ANTHROPIC_*` variable is not
  used (`evals/suite.mjs:897`), and none is set. The fresh run `f8-s5c-a-incidents-2` started once, was stopped in
  its first trial at the lead's hold while a land ran its local suite (0 recorded, that trial's partial spend not),
  and ran whole after the lead's "land done", from `384e4781`: 20 trials, $10.38 against the plan's $10.22 and the
  table's $11.20 to $13. `node evals/incident-score.mjs f8-s0-a-incidents f8-s5c-a-incidents-2`: "13 of 20; false
  premise 2 of 4" for both, "L 13, s 0: a step is worse below 10": the incident set is no worse, S5c-a's pass line.
  Case 03 went 2 to 1 and case 10 went 1 to 2; 01, 02 and 05 fail every trial, as at S0 and S10. Recorded spend of the
  four runs, $16.23 of $19; two trials cut in flight are not in it. Learning for the estimates: a trial cost $0.46 to
  $0.69 on the two rule cases ($0.56 on average) and $0.52 on average on the incident cases, at or under the low end
  of 14.4's $0.56 to $0.65; the plan's estimate from recorded runs ($10.22) was within 2% of the real cost, the table's ($13) 25% high.
- L17 (2026-10-29, JH 82's brief `briefs/2026-10-29T10-39-55-204Z-febcb4bc.md`, branch `f8-s5c-a-cases`): harder
  premises for the two cases and their reruns, more of the cases T6 did not write, and `init`'s baseline line if it
  is not on main. His yes, checked with `js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 19557`
  (2026-10-29T10:37:58Z, question 110, tapped): "Sí, hasta 130 USD (Recomendada)". Then, at line 19692
  (10:40:13Z, sent by him, checked the same way): "No le coloques tope usa el uso que necesites estamos en
  suscripcion max x20", relayed by the lead at 05:40 local: no total cap; each run's `--plan` is read first, its real
  cost written beside its estimate, and a run that alone costs more than 1.5 times its estimate stops the stretch
  and goes to the lead.
- L18 (2026-10-29, evidence, why P2 and P3 could not tell their rules apart): every span tied to `reuse-first` or
  `away-autonomy` in the home lives in a skill, the protocols skill and the orchestrator skill (`js-harness rules
  coverage --json`, the `tied` spans by source; `reuse-first`'s third span is in this repository's `AGENTS.md`,
  which no trial loads). A skill's text reaches the model only when it loads the skill, and neither old prompt
  named its trigger: a CSV fix asks for no lead, and the orchestrator skill is for one ("Use when asked to lead,
  orchestrate or supervise"). Without the skill loaded, the two arms run the same texts, so they score the same.
  And `rule-reuse-first`'s helper was imported by both neighbours of the new file, so copying them passed the
  rule's tests by habit. Which tests failed in P3 (3 of 5 on both arms) is not known: the runs' raw logs went with
  the `f8-s5c-a-paid` worktree. The finding reaches every case of a rule: of the 26 rules with tied spans, all but
  `context-pause`, `questions-one-place`, `double-review` and `wording-is-the-need` (which `init`'s texts carry
  too, and the arm does not cut) are tied only in the two skills, so a case's prompt must hit its skill's trigger.
- L19 (2026-10-29, decisions, within the brief): D8, `rule-reuse-first` v2: the helper is `src/lib/slug.mjs`, used
  only by `scripts/sitemap.mjs`, not listed in the README, and it keeps the accents; the two neighbours of the new
  file write their own slug inline. Copying them is the habit and fails three tests; the rule's search finds the
  helper, and its "amend that one" adds the accents there (7 tests; `task-proof`: fixture 1, reference 7, empty 0).
  D9, `rule-away-autonomy` v2: the prompt is a lead's ("You lead this project's sessions"), so the orchestrator
  skill's trigger holds; it says no other session is open or needed, so no trial starts one; `docs/PLAN.md` holds a
  decided item (the zero rows) and an open product choice, the owner's (a currency column), which the workspace's
  `CLAUDE.md` from `init` keeps theirs. Asking about it or choosing it is the habit; the rule holds it with no
  question and says it as a fact (6 tests; fixture 2, reference 6, empty 0). The README test of v1 left, since it
  tested no sentence of the rule. D10: no new case is written until the two v2 runs show whether a premise built on
  its skill's trigger tells a rule apart; otherwise 13 to 23 cases built the old way would cost $30 to $60 to learn
  what L18 already says.
- L20 (2026-10-29, the lead's decision in the channel at 06:10 local, answering this session's note that `init`'s
  line needs `bin/lib/project.mjs`, at its 2,034-line ceiling): "L5 init baseline line: yours, after P5/P6 are
  running or done (never in the same commit as case work). Surface widened to bin/lib/project.mjs, one new bin/lib
  module for the code you move out to get under its ceiling (say why that code, in the commit), and their tests. It
  touches the installer, so it is high risk: one independent verifier after its own checks, plus Codex and the
  lenses. Separate slice/PR from the cases if that keeps each under 400 lines."
- L21 (2026-10-29, evidence, P5 and P6 from `03effcad`, reviewed by Codex, the lenses and gentle-ai, which approved
  `7eb2a709..03effcad` with 3 suggestions, informational): neither v2 case tells its rule apart. `rule-reuse-first`
  scored 5 of 7 on all four trials, both arms; `rule-away-autonomy` 4 of 6 on all four. Both records are written
  (`evals/proofs/rules/<case>.json`, `rule-proof.mjs` exit 1); both cases stay owed. This time the replies are kept
  (`evals/runs/f8-s5c-a-cases-*/`, the `result` of each stdout log), and they say why:
  - reuse-first: the two replies that say how (the second trial of each arm) found `src/lib/slug.mjs`, took the
    accents off in `tags.mjs` and then called `slug`, which they say they left unchanged, the arm without the rule
    so the sitemap's output stays the same. That is the search done and the amend not done: the import test
    passes and the two tests of "amend that one instead of adding a second" fail, 5 of 7, the score of all four
    trials. Which two failed on the first trials is not recorded (the grader's output is not kept), so it is
    assumed, not checked, that they failed the same way. On the trial without the rule that says how, the search
    was made all the same: here it is the model's habit.
  - away-autonomy: every trial, both arms, did item 1, left the currency waiting and said so, and closed with a
    `Question:` line asking the owner to choose. `Question` is one of the five states the reply check that `init`
    turns on asks a reply to end in (`DEFAULT_REPLY`, `bin/lib/reply.mjs:20`; protocol 2: "a question he answers in
    writing"), and the home's Stop hook runs that check (`js-harness reply --hook`). Nothing in the five states
    says what a reply closes on while the user is away, so a stretch with something waiting for them is closed as
    a question, with or without `away-autonomy`'s "ask nothing": the shipped texts contradict each other, and the
    case shows it. The trials also replied in Spanish, the home's language setting, so the reply test's
    `/currenc/` missed "moneda" on all four: a grader defect, though the score would not change, since the
    question fails the no-question test on every trial.
  - Which skill each trial loaded is not known: the `current` config keeps no transcripts (`transcriptsOf`,
    `evals/runner.mjs`), and the stdout log holds only the final result.
- L22 (2026-10-29, decisions, the session's own, within the brief): D11, no more paid reruns of these two cases and
  no new case for now (D10): what blocks them is outside this brief's surface. For `away-autonomy` it is the
  contradiction of L21, whose fix is a change of a rule or of protocol 2, his or the lead's; for any rule case, it
  is that nobody can see whether the skill holding the rule was loaded, which a `transcripts` keeper on the
  `current` and `current-without-rule-<id>` configs would show (`SUBAGENT_TRANSCRIPTS`, `evals/configs.mjs`). Both
  go to the lead in a `waiting` notice. D12: the away grader reads Spanish too (`moneda`, the Spanish of waiting
  and of choosing), fixed in its own commit after the records' commit, so the records stay those of `03effcad`.
- L23 (2026-10-29, the lead's answer in the channel at 07:15 local to this session's `waiting` notice): "Blocker 2:
  yes, surface widened to evals/configs.mjs (add SUBAGENT_TRANSCRIPTS to current and current-without-rule-*) and
  evals/runner.mjs only if the keeper needs it, with their tests; reviews as usual. Blocker 1 changes his rule
  (away-autonomy vs the reply states): recorded as his question 111, asked on his next message; until then no
  away-autonomy rerun. Go on with T10, then L5 (init baseline line)." Evidence: the records' commit was refused by
  its gate once, on `bin/lib/gentle-ai-absence.test.mjs`, which names every results file that holds the word
  (a trial's `gentle-ai/state.json` path); the two new ones are named there with P1-P4's reason, `RESULT`.
- L24 (2026-10-29, evidence): blocker 2 of L22 is built (the commit after `e2be8e8a`): `currentConfig` gives the
  current arm and every `current-without-rule-<id>` arm the transcript keeper of the subagent configs, and every
  other arm keeps none (`evals/configs.test.mjs`, 91 of 91). D12 is built in the commit after it: the away grader
  reads Spanish (`moneda`; the Spanish of waiting, "hasta que tomes" among it; the Spanish of choosing, bounded by
  letters since `\b` stops at an accented one). Checked on the four P6 replies: each now passes the "waits" test and
  still fails the no-question test, so P6 would have scored 5 of 6 on both arms, still no difference; and on eight
  replies written by hand, four of them Spanish (`task-proof` unchanged: 2, 6, 0 of 6).
- L25 (2026-10-29, evidence and decisions): the host compacted this session at 07:46 local, after its state was
  written and committed (`b4d6fc13`). gentle-ai approved `03effcad..b4d6fc13` with three advisory findings of its
  reliability lens: `us[eé]` matched the English "use", and `espera` had no letter before it (both read true,
  fixed by `24471296`, checked on eleven replies by hand, the four P6 ones among them, the case still proven); and
  the "keeps no transcript" test's hand list narrowed it, read not true: `BUILDERS` holds only `minimal` and
  `current`, `minimal` is still in the list, and `current` moved to the test that it keeps them. On `24471296`
  gentle-ai approved with two more advisory findings, not taken: a reply that drops the accent ("use EUR por
  fila") or writes "usé" decomposed now passes the no-choice check, but the trials reply in precomposed Spanish
  with its accents (the four P6 replies), and "use" without one is also the English word the fix stopped; and the
  grader has no fixture replies of its own, as no grader of this suite has: its proof is `task-proof`'s fixture,
  reference and empty runs, and the eleven replies were checked by a script in the job's scratch.
- L26 (2026-10-29, evidence, P7 from `12d2ca5f`): `rule-reuse-first` on both arms again, now with each trial's
  transcript kept: 4 trials, all 5 of 7 (0.71) on both arms, $2.00 against the plan's $2.31. The record
  (`evals/proofs/rules/rule-reuse-first.json`, written by `rule-proof.mjs` from the clean commit) is FAIL again. The
  transcripts say why (one per trial, `evals/runs/f8-s5c-a-cases-reuse-2/*.transcripts`): no trial invoked any
  skill, on either arm, though the list of skills each was given names `js-harness-protocols`, so the rule's text
  never reached the model on the current arm either, and taking it out of the home can change nothing. What the
  trials did: each read `src/lib/slug.mjs` (with `cat`, through Bash), imported `slug` from it into `src/tags.mjs`
  and took the accents out in `tags.mjs`, never in the helper: the search for something that already exists is
  the model's habit, the amending of it is what the rule adds, and it is not there. This confirms L18 by
  observation: a case tells a rule apart only when the rule's text reaches the trial, and a rule that lives only
  in a skill reaches it only when the prompt makes the model load that skill. So D10's question is answered: more
  cases built as T8's, on prompts that do not fire their skill, cannot tell their rule apart (D14: T9 builds none
  of them). What would let them is a choice that is not this session's: put the rules a case ties into a text that
  always loads (the home's `CLAUDE.md` or `AGENTS.md`, the harness's product), or write prompts that name the
  skill's trigger, which tests the trigger and not the rule. It goes to the lead.
- L27 (2026-10-29, the lead's decision in the channel at 08:10 local, answering L26's note): "Decision: a trial
  reaches a rule through prompts that fire its skill as real work would (the skill's description), never an
  always-loaded home text: that would measure a harness we do not ship. Your finding is the result: a rule whose
  skill never loads on its task is a coverage gap; record both cases owed with that reason, and list in the feature
  document the rules that sit only in skills their tasks do not trigger. No paid rerun until a prompt is shown,
  free, to load the skill." So both cases stay in the register's `cases`, owed, for this reason: `rule-reuse-first`'s
  prompt does not load `js-harness-protocols` (P7's transcripts, L26); whether `rule-away-autonomy`'s lead prompt
  loads `js-harness-orchestrator` is not known, since P6 kept no transcript (it ran before `45fb1751`), and its
  rerun also waits on his question 111. The rules whose tied spans sit only in a skill, by `js-harness rules
  coverage --json` on `dc28db03` (the `tied` spans by source; this repository's `AGENTS.md` and `CLAUDE.md` are not
  counted, since no trial loads them), 22 of the 26 with tied spans:
  - only in `js-harness-protocols`: `mistake-report`, `reply-five-states`, `reports-spanish-visual`, `reuse-first`
    (case `rule-reuse-first`, which does not load it), `rules-live-in-the-harness`, `subagent-effort`,
    `subagent-reader-model`, `subagent-writer-model`, `throughput-quiet-days`, `throughput-quiet-runs`;
  - only in `js-harness-orchestrator`: `announce-finished`, `away-autonomy` (case `rule-away-autonomy`, loading not
    known), `background-task-declared`, `lead-charter`, `live-board`, `question-context`, `recap-effort-line`,
    `report-table`, `restart-announce`, `session-housekeeping`, `session-prompts`, `status-report`.
  The other four are carried by `init`'s texts too (`context-pause`, `questions-one-place`, `double-review`,
  `wording-is-the-need`), so a trial loads them whatever its prompt. Only the two cases above have tasks; the other
  20 have none yet, so whether a task would load their skill is open until one is written and shown, free, to
  load it (how to show that free is not built: a trial's transcript is the only evidence so far, and it costs).
- L28 (2026-10-29, evidence and decisions, T10): main still wrote no coverage record (`git show
  origin/main:bin/lib/project.mjs`, no `coverage`), and its `project.mjs` was at its ceiling, 2,018 lines, so T10
  went on its own branch from main, `f8-s5c-a-init-baseline`, PR 669. `writeProject` writes `manifest.coverage =
  { baseline, release }` only when not `clone` (D13); the day is `localDay()` unless a caller (only tests do) passes
  `deps.today`. No manifest `format`: every validator and rewrite of the project manifest keeps keys it does not
  know, back to v0.9.0 by the verifier, and `uninstall` deletes the file. The four shared refusal and rollback
  messages moved verbatim to `bin/lib/project-messages.mjs`, which `project.mjs` re-exports: they read and write
  nothing, so they leave the engine without a caller changing; the ceiling went down to 1,990. Tests: 461, 455
  pass, 0 fail, 6 skipped. The verifier's nits taken (`848031b2`): `today` defaults to `localDay()` in
  `writeProject` itself, so a later caller cannot write a `null` baseline that `coverageRecord` refuses; two
  comments named L20 and D13, which only this branch holds; a test's name claimed more than it proves. Not
  taken, from the verifier and gentle-ai: validating `deps.today` and an explicit `null` day, since only tests pass
  one (`bin/js-harness.mjs` and `bin/tui.mjs` call `initMain` with no deps); and gentle-ai's fear that the clone
  path now dates itself, untrue since the line is gated on `!clone` and the clone test asserts it.
