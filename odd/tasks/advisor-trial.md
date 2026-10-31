## Goal
Measure, on two tasks already done, whether an Opus 5.5 session with a Fable advisor plans better than the same
session without one, and what each spends, so the owner can decide on adopting the advisor.

## Why
His answer to question 149 (L1): a trial with two tasks, measuring the usage it spends in real time (L2). Adoption
stays his; this feature only gives him the result and its limits.

## Done when
- `js-harness contract check odd/tasks/advisor-trial.md` exits 0
- `gh pr view 740 --json state -q .state` prints MERGED or OPEN (the `--advisor` option, T1)
- The answer key, the arm briefs and the criterion below are committed before the first arm starts (`git log` shows
  their commit earlier than the `## Arms` record)
- `## Result` holds a row per arm (defects anticipated, tokens, advisor calls, minutes), the criterion's verdict and
  what four arms cannot show

## In scope / Out of scope
- In: `bin/` for `sessions start --advisor` and its test; this document; the arms' folders under
  `C:\Users\Oficina\advisor-trial-arms\` and this session's scratch.
- Out: adopting the advisor in the harness (his call); buying credits or turning on extra usage; `/advisor` and
  `/model` (both write to `~/.claude`); any edit under `~/.claude` or `~/.claude.json`.

## Constraints
- Blind scoring — because a key written after reading the plans would bend toward them: the key, the briefs and the
  criterion are committed before any arm runs.
- Same model (`claude-opus-5-5`), effort (`high`, both originals') and brief in each pair — because the advisor is the
  only variable.
- An arm with the advisor counts only when its transcript shows advisor calls; a failed arm is rerun once after
  reading why — because the advisor degrades silently.
- Each arm reads a copy of the tree at its frozen base with no `.git` (`git archive`) — because a worktree shares the
  refs, and `git log main` would show the arm the work it is planning.

## Ask me before
Adopting the advisor; any spend beyond the plan (credits, extra usage); a Fable usage-credits consent prompt.

## Tasks
- [x] T1 (kind: build) spec 1: `sessions start --advisor <model>`, test first · inline · f36c272f, PR 740
- [x] T2 (kind: design) spec 2: answer key, arm briefs and criterion committed · inline · this commit
- [ ] T3 (kind: verify) spec 3: four arms, one at a time, notes to the lead at each start and end · sessions start
- [ ] T4 (kind: verify) spec 4: usage per arm from its transcript · scratch `usage.js`
- [ ] T5 (kind: verify) spec 5: blind scoring by a fresh read-only subagent per task · Agent
- [ ] T6 (kind: docs) spec 6: result table, verdict, limits; notify the lead

## Depth pass
- 1. Method: a controlled A/B evaluation of a model configuration, the work of an ML evaluation engineer: fix the
  task set, the inputs and the scoring rubric before any run, hold every other variable equal, score blind, and
  report the effect with its sample size. The smallest change: one option on the command that already starts
  sessions (`sessions start`), no new command; the search found no advisor option (`bin/sessions-background.mjs`
  VALUED, `bin/lib/background.mjs` startArgs).
- 2. Raw material: his words, lead transcript `0f71b2c6`, line 44747 and the 14:16Z line (L1, L2); claude 2.1.314's
  changelog cache, lines 678, 4247, 4267; a probe transcript of `claude -p --model opus --advisor fable`
  (session cf994d28, L4); the two tasks' original briefs (`~/.js-harness/background/briefs/2026-10-31T12-05-16-782Z-cf44cfd8.md`,
  `2026-10-31T11-38-41-752Z-e68fabfa.md`); their feature documents and Codex and lens records
  (`.git/js-harness/codex-review-runs.jsonl`, `lens-reviews.jsonl`).
- 3. The bar:
  spec 1: `node --test bin/sessions-background.test.mjs`: `--advisor` reaches `claude --bg` and the record, and a
  resume keeps it; 0 of 2 changed tests pass before (exit 2, unknown argument), 284 pass after.
  spec 2: `git log` order: the key's commit precedes the first arm's note; none before.
  spec 3: four transcripts, each with a `PLAN.md`; the two advisor arms each show at least one `advisor_message`
  iteration; none before.
  spec 4: `node usage.js <transcript>` reproduces the probe's `result` line exactly (executor 4 / 62,788 / 63,330 /
  134; advisor 1 call, 64,485 in, 1,092 out); it did, L4.
  spec 5: one verdict per task, D-number by D-number, from a scorer that sees the plans under random labels.
  spec 6: left out because its proof is this document's `## Result`, which no command reads.
- 4. Refutation: could the advisor's effect be invisible to a plan-only arm, because Fable only sees what the executor
  has read? The probe shows the advisor gets the whole conversation (64,485 input tokens against the executor's
  63,330 cached), so a plan written after reading the brief and the code is in its view. Could the key leak to an
  arm? At JH 124's base b5bf7484 the document already holds the double review that shaped the rule, so those
  findings are marked visible at base and left out of the key. Verdict: supports
- 5. Request: his request rewritten, beside his words (L1, L2): "Try the Fable advisor on two tasks we already
  finished: run each as a plan with and without it, score the plans against the defects our reviews actually found,
  and tell me what each run spent, live and at the end, so I can decide." Adds: none

## Specs
1. "Sí, con dos tareas" (question 149, 2026-10-31 14:15Z): `sessions start --advisor <model>` passes `--advisor` to
   `claude --bg`, recorded with the start so `--resume` keeps it.
2. The two tasks, their frozen bases, the exact brief each arm gets and the answer key, committed before any arm.
3. Four plan-only arms, one at a time, same model and effort, each in a copy of its task's base.
4. "Por favor midamos cuanto uso nos gasta y revisamos en tiempo real y me pasas el dato cuando vuelva." (14:16Z):
   a note to the lead before and after each arm; each transcript's usage summed.
5. Blind scoring against the key.
6. The report: a table per arm, the criterion's verdict, what one trial of four arms cannot show.

## The trial, fixed before any arm runs

### Tasks and bases
- Task A, JH 124 (rule 1, the depth pass). Base `b5bf7484`, the last commit before its build (`1722be2d`): the rule's
  text was decided (his yes to 143 and 144) and nothing was built. Start record: `e6e7ad0f`, model default, effort
  high. Brief: `~/.js-harness/background/briefs/2026-10-31T12-05-16-782Z-cf44cfd8.md`.
- Task B, JH 123 (the departure check). Base `6bee9e5b`, the fork point of `worktree-departure-stretch` from main
  (`git merge-base 3ac49fa8^1 3ac49fa8^2`); its feature document did not exist there. Start record: `4e7f696c`,
  model default, effort high. Brief: `~/.js-harness/background/briefs/2026-10-31T11-38-41-752Z-e68fabfa.md`. The
  branch merged as PR 739 before this session began, so its base and brief were read from git and the start record,
  not asked of JH 123.

### What every arm gets
`js-harness sessions start --title "JH 125 · trial arm <x>" --brief <arm brief> --cwd <arm folder> --model
claude-opus-5-5 --effort high --no-remote-control`, plus `--advisor fable` for the advisor arms. The arm folder is
`C:\Users\Oficina\advisor-trial-arms\<x>`, a `git archive` of the base. The arm brief is the preamble below, then the
original brief as recorded (its own `## How you report` section dropped; `sessions start` appends that section
again, and the preamble overrides it).

Preamble (identical for all four arms):

> This is a planning run. Write no code, change no file except `PLAN.md` in the folder you start in, commit
> nothing, push nothing, and run no gate, review, eval or `js-harness notify`/`sessions` command. Nobody can answer a
> question during this run. The folder is a copy of the repository at the commit where the work below began; it has
> no git history. The brief below was written for the session that did this work; read it and the code it points to
> as that session would, then write in `PLAN.md` the plan you would follow to do the work: the steps in order, what
> each changes and how it is proved, and the risks, defects and review findings you expect, each with how the plan
> prevents it. Where the brief names a transcript, a record or a tool you cannot reach from here, say so in the plan
> and go on. The section `## How you report` at the end of this brief is not for this run: send no notice; your
> report is `PLAN.md`. Stop when `PLAN.md` is written.

### Order
A-without, A-with, B-with, B-without: one at a time, each started after the previous one ends and its folder is
removed.

### Answer key
Extracted by a read-only subagent from the feature documents, the fix commits' bodies and
`.git/js-harness/codex-review-runs.jsonl` and `lens-reviews.jsonl`; each item states the defect as a planner could
have anticipated it. Left out of both keys: process slips that are not defects of the work, points raised and left
unfixed by decision, and (task A) findings already written in the document at the base.

Task A, JH 124, after `b5bf7484` (16 defects):
- A1 History reads did not follow renames: a renamed document lost its opening date, and a pass renamed after its
  code read as code before its verdict. Codex P2 and the verifier (runs `5a2aa4d9`, `9aeca849`; fixed e2d46f3f,
  ff8c61aa).
- A2 Text outside the real pass was read as the pass: a quoted or example `Verdict:` in an earlier documents-only
  commit, or a fenced example, satisfied the check. Codex P2 and the verifier (`5a2aa4d9`; e2d46f3f).
- A3 The validator did its own I/O (read `harness.json`, ran git) inside `validateEntries`, against reading at the
  command's edge. Codex P2, not fixed on the first recheck (`5a2aa4d9`, `9aeca849`; ff8c61aa).
- A4 The rule's text did not match its check: section 9 did not say the bar's command goes in a code span, which the
  validator requires. Codex P2 (`cee05183`; e2d46f3f).
- A5 Shallow clones (CI) and folders with no git broke the date check: every document looked added in the boundary
  commit. Lenses reliability and resilience (`42d22d0e`; 999d36ba).
- A6 Judging the whole history gave false reds on the trunk (a squash merge; a refuted plan already on main once
  later code existed). Verifier (L23 of JH 124; e2d46f3f).
- A7 One `git show` over a long history overflowed on Windows and was read as "no code", a false pass; per-document
  git calls were slow. Verifier (e2d46f3f).
- A8 Code committed on the branch before the document opened was not seen. Verifier (e2d46f3f).
- A9 A project in a subfolder of its repository read every document as opened today (git paths are relative to the
  repository root). Verifier (e2d46f3f, `--relative`).
- A10 Documents whose verdict was already on the trunk were judged again when a branch edited them next to code.
  Lens reliability (`56db2b56`; ff8c61aa).
- A11 Staged code was blamed on every held document. Verifier (L23).
- A12 A stale doc comment of `validateEntries` named `root` after the signature became `{ depthPass }`, so a caller
  passing `{ root }` would skip the check silently. Lens readability (`8bf2f4dc`; e972fecf).
- A13 A dead import (`isDocument`) left in `bin/contract.mjs` after the split. Lens readability (`8bf2f4dc`).
- A14 The pointer added to `claudeBlock` had unescaped backticks that broke the template literal. The session itself
  (L19).
- A15 The plan quoted his tapped answer (line 43370), which `rules change` refuses as a quote; only his typed lines
  can be quoted. The session itself (L19).
- A16 The phrases planned for the rule's declaration left four of section 9's obligations untied in the rules'
  coverage. The session itself (L19, 1722be2d body).

Task B, JH 123, after `6bee9e5b` (13 defects; left out: the `stretch open --draft` cost cut, deferred unbuilt; the
file overlap with JH 124, a session that did not exist at the base; the "sin medir" reason and the present-silence
return, raised and not taken; the summary's missing sections, a process slip):
- B1 Wrong root cause: the plan treated the miss as detecting his departure words, while the lead had seen both
  departures (it ran `quiet --wait` each time) and skipped `stretch open` because it needs a hand-written plan; the
  deterministic signals (`quiet --wait` with no stretch open, the return check's 2 h gap, `ABSENCE_MS`) were already
  there. Blind readers A and B, the lead (JH 123's L10; replaced in 4d5e7605).
- B2 The word detector's accuracy was never measured: 18 patterns fitted to the 20 messages they were scored on, no
  labelled holdout, a known misfire ("te respondo las preguntas despues"). Readers A and B (818b1eeb, L6, L11).
- B3 It turned the lead back at every stop until the stretch closed, where its sibling checks warn once per return
  (242 and 300 stops on the replay). Readers A and B, minor (L4, L6).
- B4 The plan did not fix the report he complained about: the status page drew no step chain and the notes'
  proposals no estimate, so a "cómo vamos" without a stretch still lacked the map and estimate against actual; his
  complaint was not listed item by item with its source. Readers A (most severe) and B, the lead (built in 8be755d2).
- B5 Wrong hook: the brief's `guard --stop` is the 5 s hook that reads no transcript; the lead's checks and the 15 s
  budget tests belong to `reply --hook`. Readers A and B, the lead (fixed in 4d5e7605's document).
- B6 Unreadable plan steps did not stop `report --mark --html` from recording, so the cut moved past facts the page
  never showed. Codex P2, 0.98 (`bin/report.mjs:188`, run `c2406735`; a4ecfc3c).
- B7 With no `docs/ROADMAP.md`, `report --html` exited 1 and `report --mark --html` recorded nothing, the command the
  return warning names, with no reason on the page and no test of `--html` without a roadmap. CRITICAL, gentle-ai
  reliability and resilience lenses and the verifier (718858fd).
- B8 Extracting `leadReturnOf` left `returnReportWarning`'s doc comment above the wrong function. Lens readability
  (`lens-reviews.jsonl` run `249451f6`; 23c028a5).
- B9 `quiet`'s help and refusal spoke of "he" where the rest says "you", and its `--wait` usage line missed
  `--no-stretch <reason>`. gentle-ai readability (718858fd).
- B10 The feature document fell behind its own log (tasks still pending after their commit; a wrong spec number).
  gentle-ai readability (718858fd).
- B11 A duplicate, out-of-order import in `bin/reply-budget.test.mjs`. gentle-ai readability (718858fd).
- B12 Editing the reply hook's line in `bin/lib/manifest.mjs` without `rules coverage --refresh` failed three tests
  of `bin/rules-coverage.test.mjs`. The first gate run (L7b).
- B13 A test comment named the review tool, which `bin/lib/gentle-ai-absence.test.mjs:140` forbids. A gate run on
  GitHub (L24).

### Arm briefs as fixed
`C:\Users\Oficina\advisor-trial-arms\briefs\arm-brief-a.md`, sha256
`d3141f1b7b0eeca4db78a3f5616691e166ed2a1e9578bab20aca9330263ae931` (original
`59a2bc2f33a94be37c97c7b39611ca08ca44bc78966e8c853fa82f3e47218731`); `arm-brief-b.md`, sha256
`b91ea593fee2cdf61a09f71b7a78aaea2ee33bbd50815d787e7ba576ba961cc5` (original
`ec66af6cdb0d89f883f49850a99336f1753f32b684083ded91bf182d9f8b1e4e`).

### Criterion
The advisor is recommended only if, on each of the two tasks, the arm with Fable anticipates at least 2 more of the
key's defects than the arm without, and its transcript shows the advisor ran. A defect counts as anticipated when
the scorer finds it named as a risk or prevented by a step of the plan.

## Log
- L1 2026-10-31 14:15Z, his answer to question 149 (lead transcript `0f71b2c6`, line 44747): "Sí, con dos tareas".
- L2 2026-10-31 14:16Z, his words: "Por favor midamos cuanto uso nos gasta y revisamos en tiempo real y me pasas el
  dato cuando vuelva."
- L3 The lead's facts (brief, 2026-10-31): claude 2.1.314; `--advisor` absent from `claude --help` but in the
  changelog; plan meter at 14:17Z: plan Ultra, 5-hour 4%, weekly all models 15%, weekly Fable 0%, extra usage off.
- L4 Probe, 15:29Z: `claude -p --model opus --advisor fable --output-format stream-json` in scratch ran one advisor
  call by `claude-fable-5-1` with no consent prompt: executor 4 input, 62,788 cache read, 63,330 cache creation, 134
  output; advisor 64,485 input (none cached), 1,092 output; list cost $0.52 executor and $0.70 advisor. The
  transcript records the advisor in `message.usage.iterations` (type `advisor_message`, with its model and tokens);
  the advisor's text is encrypted (`advisor_redacted_result`), so what it said cannot be read. `~/.claude/settings.json`
  unchanged (sha1 before and after).
- L5 T1: f36c272f. Codex review of 3ac49fa..f36c272: correct, confidence 0.97, no findings; lenses reliability and
  readability: 0 findings. Pushed as `advisor-option`, PR 740, ready notice sent 15:44Z.
