# JH 119 · reply hook: a 15 s timeout, as he answered question 138

Locator: `odd/tasks/reply-hook-timeout.md` · Engram mirror: `odd/reply-hook-timeout/tasks` · Branch: `worktree-reply-hook-timeout`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
`install` writes the reply hook's `Stop` entry with a 15-second timeout, and a home that holds the 5-second entry gets
the 15-second one in its place on its next install.

## Why
JH 116 (`odd/tasks/reply-hook-latency.md`, `## Measure`, T5) measured that at a stop, starting a process beside nine
`Stop` hooks eats the 5 s: the reply hook is cancelled in about one stop in ten, as often as lighter hooks, so its
checks are skipped. Its work is under half the 5 s; the timeout is what removes the skipped stops. He answered question
138 "Sí, 15 s".

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/reply-hook-timeout.md` exits 0
- `node --test bin/lib/manifest.test.mjs bin/reply-budget.test.mjs` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code

## In scope / Out of scope
- In: `replyHookEntry` (`bin/lib/hook-entries.mjs`), its test in `bin/lib/manifest.test.mjs`, the budget of
  `bin/reply-budget.test.mjs`, the 0.97.0 Codex entries of `bin/lib/earlier-codex.testkit.mjs`, `docs/sessions/`.
- Out: the timeouts of `guard --stop`, `backup --hook` and gentle-ai's hook (his yes covers the reply hook only);
  `bin/lib/guard.mjs` (JH 118 works on it); his `~/.claude/settings.json` (the lead applies it with the refresh).

## Constraints
- The reply hook's work budget does not loosen with the timeout — because the 10 s added are room for the load of a
  stop, not for the hook's own work, and no check weakens (AGENTS.md).
- Run only the tests the change needs before the gate — because the machine is short of memory.

## Ask me before
Any timeout other than the reply hook's.

## Specs
1. "Sí, 15 s" (question 138: raise the reply hook's timeout from 5 to 15 s in his settings and in what install writes).

## Tasks
- [x] T1 (kind: build) spec 1: the entry's test at 15 and the upgrade test, red; then `replyHookEntry` at 15, green.
- [x] T2 (kind: build) spec 1: the budget held at 2500 ms apart from the timeout; the 0.97.0 Codex entry frozen at 5.
- [ ] T3 (kind: verify) Codex, the Claude lenses and an independent verifier over the code slice; PR; ready notice.

## Log
- L1 (2026-10-31, his request: the lead's brief `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T06-23-14-249Z-33f1ddcd.md`,
  "JH 119 · reply hook: a 15 s timeout, as he answered question 138"; his answer, read with `js-harness sessions
  --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 40819`: "Sí, 15 s", tapped 2026-10-31T06:22:32Z).
- L2 (2026-10-31, searched before writing): `grep` over the repo for `replyHookEntry`, `REPLY_HOOK_COMMAND`, `timeout:
  5`, `2500` and for the reply hook beside "5 s", "five seconds" or "timeout"; codegraph over how install replaces an
  entry; `js-harness rules` (no rule names a hook's timeout). Readers of the value: `bin/lib/manifest.mjs:375` (the
  component), `bin/lib/manifest.test.mjs:1511` (asserts 5), `bin/reply-budget.test.mjs:35` (budget = half the timeout),
  `bin/lib/earlier-codex.testkit.mjs:25` (the 0.97.0 Codex entry, built from today's function). `doctor` reads no
  hook's timeout; `scripts/practice-lib.mjs` holds the command only; no doc but JH 116's feature document states the
  reply hook's 5 s. Install already replaces an older form of its own entry, matcher or timeout
  (`isOlderOwnEntry`, `bin/lib/manifest.mjs:461`), so no migration code is needed; a test holds it for this entry.
- L3 (2026-10-31, decided): the budget stays 2500 ms, written as its own constant, no longer half the timeout. Half of
  15 s would let the hook's own work triple before the test turned red; the 10 s added are for the load of a stop.
  The 0.97.0 Codex entry in the testkit is frozen at 5 s, what that version wrote, so the Codex cleanup tests keep
  holding a real home's record.
- L4 (2026-10-31, T1 and T2, tests first): `manifest.test.mjs`'s declaration test at 15 was red on the old entry
  (expected 15, got 5) and green after; the new upgrade test (an install with the 5 s entry, then today's) passed on
  the old code too, since both sides were 5 there: it holds the replacement, not the change. After the change
  (Windows): `node --test` over `bin/lib/manifest.test.mjs`, `bin/install.test.mjs`, `bin/codex-hook-trust.test.mjs`,
  `bin/lib/spec.test.mjs`, `scripts/practice-lib.test.mjs` and `scripts/reply-hook-time.test.mjs` exits 0;
  `bin/reply-budget.test.mjs` 4 of 4, lead p90 696 ms, work p90 658 ms, budget 2500 ms.
- L5 (2026-10-31, T3): the first commit's gate failed on CI: `bin/lib/gentle-ai-absence.test.mjs` refused the comment
  of `replyHookEntry`, which named gentle-ai in a file not on its list; the comment now says "a slower Stop hook".
  The second gate passed: `af847c22`.
- L6 (2026-10-31, T3, reviews of `b0c658ce..af847c22`): Codex correct (0.97), no finding, 69,543 input tokens; the
  Claude lenses risk, resilience and reliability 0 findings each; gentle-ai (lineage `review-61bd159f2559ffe5`, lens
  reliability) approved and acknowledged, one SUGGESTION: name the tests that consume the testkit. They are
  `bin/lib/manifest.test.mjs` and `bin/codex-hook-trust.test.mjs`, both green (L4).
- L7 (2026-10-31, T3, the independent verifier, read-only, over `af847c22`): claims 1, 3, 4 and 5 held (temp homes:
  `sync` over a 5 s home, a hand edit to 30 s, a stopped install, a fresh install; only the reply entry changed;
  `git show v0.97.0:bin/lib/manifest.mjs` shows the Codex reply entry at 5 s). Claim 2 did not: the comment of
  `COMMANDS_DEADLINE_MS` (`bin/lib/reply-commands.mjs:309`) tied its 4000 ms to "the 5 seconds" (my search had no
  "5 seconds" pattern); reworded, the deadline kept, since the 10 s added are not for that check. A reflowed comment
  line of `bin/reply-budget.test.mjs` was 205 characters; rewrapped. And a finding for applying it: a hand edit of his
  settings to 15 s before an `install` makes the entry be recorded as his (`createdEntry: false`), so `uninstall`
  would leave it; the value reaches his settings through `install` (the lead's refresh), never by hand.
- L8 (2026-10-31, T3, reviews of `af847c22..1ffe7d02`, the verifier's fixes, comments only): Codex correct (0.99), no
  finding, 32,217 input tokens; the Claude lens readability 0 findings; gentle-ai (lineage `review-15705bd6ae8edb04`,
  lens reliability) approved with no finding, acknowledged. Every code commit of the branch is covered by both records.

## Reviews
- gentle-ai: `af847c22` (lineage `review-61bd159f2559ffe5`), approved, acknowledged.
- gentle-ai: `1ffe7d02` (lineage `review-15705bd6ae8edb04`), approved, acknowledged.

## Next step
Push, PR, `notify --kind ready --pr <n>`; the summary under `docs/sessions/`; `notify --kind closed`. After the land,
the lead's refresh (`js-harness install` through `merge-queue --land --refresh-copy`) writes 15 s into his settings.
