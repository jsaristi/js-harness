# A warning for a whole test run started beside a gate

Locator: `odd/tasks/test-run-warning.md` · Engram mirror: `odd/test-run-warning/tasks` · Branch:
`feat/test-run-warning` · Delivery: `ask-on-risk` · Runner: `node --test`

## Goal
A `node --test` of several files started by hand while another gate holds the machine's lock gets a
warning before it starts, which says how to run it in a turn.

## Why
On the night of 2026-10-14 JH 9 and JH 10 each started a whole test run outside a turn while a gate ran;
the two share the cores and both miss their time bounds with every test green.

## Done when
- `node --test bin/lib/test-run-warning.test.mjs` exits 0
- `npm run check` exits 0
- JH 15's `js-harness guard --hook` calls `testRunWarning` for a Bash command and says its line.

## In scope / Out of scope
- In: `bin/lib/test-run-warning.mjs` (the function and its conditions) and its test.
- Out: the hook itself, its entry in the host's config and its matcher, which are JH 15's
  (`bin/guard.mjs`, `bin/lib/guard.mjs`): the lead, 14:35, "do not add a second hook". Codex sessions are
  not covered: their hooks are another configuration, which this guard does not install.

## Constraints
- It warns only, never blocks — a guard must never stop a session's work.

## Effort
high

## Ask me before
Nothing planned.

## Specs

- **S1** (the lead, 2026-10-14 14:21): "(b) the turn guard warns when `node --test` of several files starts
  outside a turn while the lock is held (JH 9 and JH 10 both slipped tonight). Test first."
- **S2** (the lead, 14:35): "Your warning becomes one more Bash case in that guard. It only warns, under
  your conditions, and reads readGateHolder from your gate code. Give JH 15 the function and the
  conditions, and let JH 15 own the hook entry and the matcher (add Bash). Codex is not covered: say so in
  its doc line."
  - The conditions: the command runs `node --test` as a command of its own over two or more files, or
    over none (every test file); it is not run under `js-harness gate --`; the environment is not inside a
    turn (`JS_HARNESS_GATE_HELD=1`, or `JS_HARNESS_CHECK_INNER=1` in a gate's sensor); and
    `readGateHolder` finds the lock held now. One file stays free, as the skill says.

## Tasks

| ID | Specs | Route | Status | Evidence |
|----|-------|-------|--------|----------|
| T1 | S1, S2 | inline | done | RED: the module missing; GREEN: 3/3 |
| T2 | S2 | JH 15 | pending | the Bash case in `js-harness guard --hook` |

## Log

- **L1** (2026-10-14): the lead's two orders, S1 and S2, verbatim.
- **L2** (2026-10-14): his decision, `ffe99ebf` line 5718 (19:38:04Z, tapped): "Rechazar con candado tomado
  (Recomendada)": the guard refuses the Bash call with the line `testRunWarning` answers, only while another
  gate holds the lock (JH 15 found that a PreToolUse warning reaches the agent only after the call ran).
- **L3** (2026-10-14): commit `1b88b76`, gate passed in WSL2. Codex over `4fae01b..1b88b76` (118,200 input
  tokens): three P2, fixed in one batch, test first: a wildcard counts as several files; a command ends at
  an operator outside quotes only (`--test-name-pattern="foo|bar"`); only the run `js-harness gate --`
  wraps is in a turn, not every command after a gate nor a quoted mention of one. RED: the new test
  failed; GREEN: 4/4.
