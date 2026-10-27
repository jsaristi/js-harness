# F8 S1: two reviews on every slice

Locator: `odd/tasks/f8-s1-reviews.md` · Engram mirror: `odd/f8-s1-reviews/tasks` · Branch: `worktree-f8-s1-reviews`
Delivery: chained pull requests, one a slice (L2, until the orchestrator says otherwise) · Test runner: `node --test`

## Goal
Every slice with code gets two reviews, Codex and Claude's lenses, each recorded against the slice's
commit range and its subject hash, and a push or a merge of a code commit that lacks either, or whose
review a later amend made stale, is refused unless a skip is recorded, which stays a listed debt until
the review is made.

## Why
His words of 2026-10-26 (G9, transcript `e41d1e8d`, line 2351): "revision siempre, ya que siempre
necesitamos una segunda opinion con un segundo modelo pero tambien una revision del mismo claude por
que asi nos aseguramos criterio y solidez". gentle-ai's review leaves at S2; its four lens prompts
are worth keeping, but they read only what gentle-ai's provider builds, so S1 builds what feeds them
(diet section 10, "S1, the Claude lens runner").

## Done when
- `node --test bin/lib/lens-candidate.test.mjs bin/lib/lens-result.test.mjs bin/lib/lens-reviews.test.mjs bin/lens-review.test.mjs bin/lib/lens-review-rows.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/f8-s1-reviews.md` exits 0
- `npm run check` exits 0, and its `review` row names no gentle-ai
- `grep -c gentle-ai AGENTS.md` prints 0
- `## Probe` below records the diet's six behaviours in a scratch repo, 6 of 6, and three real slices with tokens per lens
- `js-harness merge-queue --dry-run` lists each pull request as ready, and Codex has no open finding

## In scope / Out of scope
- In: new `bin/lens-review.mjs` and `bin/lib/lens-*.mjs` with their tests; `bin/js-harness.mjs`
  (the command); `bin/lib/codex-review-coverage.mjs` (records to read made a parameter);
  `bin/codex-review.mjs` and `bin/lib/codex-reviews.mjs` (the subject hash on Codex's record);
  `bin/check.mjs` (the push row, the `review` row); `bin/doctor.mjs` (the skip row);
  `bin/merge-queue.mjs` (the door); `AGENTS.md`, `CLAUDE.md` (the review lines);
  `docs/ROADMAP.md`, the diet and the reverse-engineering document where S1 changes them; this document.
- Out: S2 (removing gentle-ai, its hooks and agents), S10, S11 (the brief); `~/.claude`, `~/.codex`
  and gentle-ai's configuration, which this session never writes; the template block `init` ships
  (`bin/lib/template-block.test.mjs` pins its bytes; S12 moves projects).

## Constraints
- The lens runs are work on his plan's CLI login, never the eval token — so the child's environment
  drops `JS_HARNESS_EVAL_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY`.
- No credential file is read, copied or moved; no scratch home holds one (the 2026-10-26 incident).
- A rule's value changes only on a `rule/` branch — so a new value here is a constant in code.
- The machine is shared and ran out of memory once today — at most one sub-agent, gates take turns.

## Ask me before
The incident rerun (about $11 to $22 API-equivalent, S3's real cost was $16.95): asked through the
orchestrator before it runs. A lens review of a slice is work, not an eval (cents each).

## Specs
- S1 (brief): "the Claude lens runner built whole (the candidate as a commit range, an input
  packager, validation, launch and auth, records, invalidation, skips as a debt the merge path
  enforces)".
- S2 (brief): "the four lens prompts ported under our names".
- S3 (brief): "the pre-push gate and the skip debt".
- S4 (brief): "`AGENTS.md`'s review paragraph and `check`'s `review` row no longer naming gentle-ai".
- S5 (brief): "copiamos e implementamos solo lo que nos sirve el resto no": port only what has a
  named need, under our names.
- S6 (brief): "Every F8 decision ships to projects through init/install/update/uninstall."
- S7 (diet section 10, S1 row): "in a scratch repo: a range with both complete records pushes; one
  with an incomplete lens result is refused; one amended after its review is refused; one with a
  recorded skip pushes, is listed by `check` and `doctor`, and its PR is refused by the merge path
  until reviewed; then three real slices"; pass: "6 of 6 behave as stated; tokens per lens recorded
  (D2); incident set no worse".

## Tasks
- [x] T1 (kind: docs) this document, the forecast and the chain question to the orchestrator — all; inline; 82412009
- [x] T2 (kind: build) the candidate and its packager: identity (base, head, subject hash), ordered manifest, each path's patch; the four lens prompts from one text with four scopes; result validation; test first — S1, S2; inline; 6bc94451, fixed in 7ccc7033 and 2d0d2ef0
- [x] T3 (kind: build) launch and records: `js-harness lens-review --base <b> --lenses <list> --reason <why>`, one fresh tool-less run a lens, `--unavailable <reason>` as the skip; a record a run, beside Codex's; test first with a fake CLI — S1; inline; eb518c07, 2d0d2ef0
- [ ] T4 (kind: build) the gate: `check --push` refuses a code commit no complete lens record covers; a record counts only for its head commit and subject hash; Codex's record gains the subject hash; test first — S1, S3; inline
- [ ] T5 (kind: build) the skip debt: the `review` row of `check` lists both reviews' debt and skips with no gentle-ai, a `doctor` row lists skips, the merge door refuses a pull request that holds one; `AGENTS.md` and `CLAUDE.md` review lines — S3, S4; inline
- [ ] T6 (kind: verify) the probe in a scratch repo, three real slices, the incident rerun once asked — S7; inline

## Log
- L1 (2026-10-27, the brief from JH ORQ): "You are JH 62 · F8 S1: two reviews on every slice ...
  Scope (S1 as the diet defines it): the Claude lens runner built whole (the candidate as a commit
  range, an input packager, validation, launch and auth, records, invalidation, skips as a debt the
  merge path enforces), the four lens prompts ported under our names, the pre-push gate and the skip
  debt, and `AGENTS.md`'s review paragraph and `check`'s `review` row no longer naming gentle-ai. Not
  S2 (removal), not S10/S11. Open `odd/tasks/f8-s1-reviews.md` with the task contract first; this is a
  large task: work-unit commits, slices of about 400 lines, ask the orchestrator for the chain
  strategy when the forecast passes it." Decided and not re-asked: his "revision siempre" (every slice
  gets Codex plus Claude lens reviewers, picked by what changed, no risk-tier skip); "copiamos e
  implementamos solo lo que nos sirve el resto no"; every F8 decision ships to projects; Codex is an
  external reviewer only (D3).
- L2 (2026-10-27, design, the lead's by default; each can be reversed):
  - **Launch flags, probed** (the diet left them `[i]`): `claude -p --safe-mode --tools "" --system-prompt
    <lens> --model sonnet --output-format json --no-session-persistence`, the package on stdin. One probe
    run: 1,032 input tokens, so neither his global file nor a project `CLAUDE.md` loads; $0.004; the
    model answered as `claude-sonnet-5-5`. `--bare` is out: it reads only an API key, never his login.
  - **The prompts are ported from one text.** The four gentle-ai agents (`~/.claude/agents/review-*.md`,
    read only) differ in their name and their one `## Scope` line; the rest is shared. Ours keep the
    input contract, scope, admission, severity, evidence and output sections, rewritten to read our block;
    the codegraph, language and remote-authorization blocks gentle-ai appends are dropped (no tools, no
    artifact). The refuter and the `jd-*` agents are not ported (reverse-engineering doc, "Agents").
  - **The runner reads its prompts from the package**, so `install` ships them with `bin/` and nothing is
    written under `~/.claude/agents`: an agent file there would be a second copy no runner reads (S5),
    and one fewer thing to undo (S6). This changes §11.1's row 1 of the reverse-engineering document.
  - **What a lens reads is what Codex reads**: the files `codex-review-scope.mjs` does not leave out, so
    "code commit" means one thing to both gates.
  - **One record a run**, `<git common dir>/js-harness/lens-reviews.jsonl`, holding each lens's outcome,
    findings, tokens, cost and duration; the run is `reviewed` only when every picked lens is complete,
    else `incomplete`, which covers nothing. A rerun runs the picked lenses again (cents).
  - **"Of the same head commit and subject hash"** is read as: each record is pinned to its own head and
    hash, and the gate asks that each code commit be covered by both kinds. Codex already cuts a range
    into parts and rechecks; forcing one range on both would undo that.
  - **The gate follows the project's review switch** (`functions.codexReview`): where it is off there is
    no pre-push check to hold a lens gate, and a new switch would be a new config contract.
  - **A cutover**: code commits committed before the gate lands need no lens record, as the merge door's
    gentle-ai cutover did (`bin/lib/gentle-ai-evidence.mjs:11`).
- L3 (2026-10-27): forecast about 2,000 to 2,500 changed lines with tests over five slices (T2 to T5,
  each 400 to 600), past the 400 a slice; the chain strategy asked of the orchestrator, with chained pull
  requests as the default this session works by meanwhile.
- L4 (2026-10-27, JH ORQ): "Chain strategy: yes, chained PRs, one a slice, each based on main and landed in
  order with merge-queue as it becomes ready (stacked-to-main). Send a ready notice per PR."
- L5 (2026-10-27): the first real runs, which are the probe's "three real slices" (T6) as they happen.
  - Lenses on slice 1, `82412009..6bc94451` (risk, reliability, readability): complete, about 14,900 input and
    815 to 2,204 output tokens a lens; reliability found that the subject hash moved with `core.abbrev`, fixed
    test first in 7ccc7033 (`--full-index`). The answer came in Spanish, so the prompts now ask for English.
  - Lenses on slice 2, `6bc94451..7ccc7033` (all four): complete, about 18,600 input tokens a lens; three of them
    found `--plan` with `--unavailable` writing a skip, and reliability that the empty `--tools` value is lost
    through an npm shim.
  - Codex on `82412009..7ccc7033`, three parts, 319,251 input tokens: incorrect (0.99) on two parts, with the
    same two faults (P1 the shim, P2 `--plan`) and a third, P2: `diff.interHunkContext` moves the hash. All three
    fixed test first in 2d0d2ef0; the shim's run goes through `claudeRunner`, which already quoted for it.
  - Rechecks of `7ccc7033..2d0d2ef0`: Codex correct (0.97), every finding fixed; lenses risk and reliability
    complete with no finding, about 7,550 input tokens each.
  - The two reviews agreed on two of three faults, and each found one the other did not: what his "criterio y
    solidez" asked for.
- L6 (2026-10-27): the first pull request holds slices 1 and 2: slice 2 carries the fixes of slice 1's findings,
  so slice 1 alone would land with known faults. Every later slice is a pull request of its own, as L4 says.
- gentle-ai on `82412009..6bc94451`: medium, not due (under_budget, 436 lines), assessed by the commit's gate.
- gentle-ai on `6bc94451..eb518c07`: medium, not due (under_budget, 435 lines); on `eb518c07..7ccc7033`: medium, not due (under_budget, 16 lines).
- gentle-ai on `7ccc7033..2d0d2ef0`: medium, not due (under_budget, 81 lines).
