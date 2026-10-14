# Two guards on a turn of `js-harness gate`

Locator: `odd/tasks/gate-turn-guards.md` · Engram mirror: `odd/gate-turn-guards/tasks` · Branch:
`feat/gate-turn-guards` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A turn of `js-harness gate` is neither asked for while a commit that is ready waits for its push, nor
held past a bound of wall time by a command that hung.

## Why
On 2026-10-14 two turns held the lock for nothing. A Codex review and the pair measure shared one
background command, so the push of pull request 121 waited about 16 minutes behind a measure it did
not need. Then the measure's script waited for its own memory sampler, which never ends, and held the
lock from 03:32:27 to 03:56:31 while the sessions the lead had woken queued behind it.

## Done when
- `node --test bin/gate.test.mjs` exits 0
- `npm run check` exits 0
- A `gate` asked from a worktree whose branch has an open pull request and unpushed commits that the
  pre-push check would accept runs nothing, exits 75 and prints the push command.
- A `gate` whose command outlives its bound has its process tree killed, exits 1 and says so.

## In scope / Out of scope
- In: `bin/gate.mjs`, `bin/gate.test.mjs`, a new `bin/lib/push-waits.mjs` (tested through `gate`), the
  orchestrator skill's text in `bin/lib/manifest.mjs`, `docs/`, this document.
- Out: the pre-commit and pre-push hooks and `check` (a commit's gate and a push take no `gate`
  turn), the lock itself (`bin/lib/gate-lock.mjs`).

## Constraints
- `gh` may be missing or offline — so the pull request is asked last, and a `gh` that cannot answer
  refuses nothing: a guard must never stop the gates of a machine.

## Effort
high

## Ask me before
Nothing planned: both orders come from the lead with his word quoted.

## Specs

- **S1** (the push first). His words, `ffe99ebf` line 3977 (2026-10-14T08:51:48Z): "ese problema de
  esperar una medicion que no la necesibata hay que corregirlo para que no vuelva a pasar". The lead's
  order (this session's transcript, line 2370): "Build it into `js-harness gate`, first in your queue,
  before the measure's follow-ups. When the asking worktree's branch has an open pull request and local
  commits that passed their gate and their Codex record but are not pushed, a turn that is not that
  push or a merge is refused. It prints the push command, so nothing that does not need the lock delays
  a merge. Add one line to the orchestrator-facing docs: a session pushes in the same step its last
  check passes. Test first; record it in faster-check.md and docs/todo.md as done when merged."
  - The asking worktree is the folder the gate runs its command in (`--cwd`, else the current one).
  - Assumption: a commit on the branch passed its gate when it exists, since the pre-commit hook runs
    the gate; it passed its Codex record when the pre-push check (`checkCodexReviews`) accepts the
    branch's head. So the refusal holds exactly when a push would go through now.
  - A turn is that push or a merge when its command line runs `git push`, `git merge` or `gh pr merge`.
- **S2** (a bound on the wall time of a turn). The lead, 2026-10-14 03:58: "Add to your gate-refusal
  feature: a measure or any scripted turn under the lock gets a wall-time cap, so a hung script cannot
  hold the lock for everyone. Record both in faster-check.md."
  - Default 30 minutes: the longest turn in the gate log of 2026-10-13 and 2026-10-14 took 974 s.
    `--max <minutes>` sets another.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1 | inline | done | RED: the 2 refusal tests failed and the 2 that keep today's runs passed (2026-10-14, before 04:09 by `date`); GREEN: all 10 of the focused run pass |
| T2 | S2 | inline | done | RED: the default bound read 0 and the real overrun ran unbounded; GREEN as T1 |
| T3 | S1, S2 | inline | done | the help, the two skill lines and their tests (RED 3, GREEN 3); `faster-check.md` T3, L3, L4; `docs/todo.md` |

## Log

- **L1** (2026-10-14, his words, `ffe99ebf` line 3977): "ese problema de esperar una medicion que no
  la necesibata hay que corregirlo para que no vuelva a pasar".
- **L2** (2026-10-14, the lead at 03:58): the pair measure hung on a bare `wait`. The numbers: alone
  107.6 s, peak memory 1,144 MB of 3,917; pair 1: 238.8 s and 242.7 s, slower than two in a row
  (215 s). Decision: the lock keeps one slot, the WSL sensors being bound by the processor and not by
  memory; the pairs are not run again.
- **L3** (2026-10-14): commit `9ed9f60` (T1-T3); its gate passed in WSL2 after one fix of the bound's
  real test, which ran `node` with no PATH there (exit 127). gentle-ai's assessment: medium,
  `under_budget`, no review due. Codex reviewed `8aa93c3..9ed9f60` (218,153 input tokens, allowance
  332,640): three P2, all taken in one batch, test first: the guard's git and gh calls get a 10 s
  timeout and a gh that hangs refuses nothing; a branch that came apart from its remote one waits for no
  push (the push printed would not be a fast-forward); a push or a merge counts only as a command the
  shell runs, not as words in an argument (`echo git push && node --test` is refused). The recheck is
  Codex on the fix's range alone; a new finding there is a follow-up, not another round.
