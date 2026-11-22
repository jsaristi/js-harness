# JH 296 · hooks that time out or are cancelled

Locator: `odd/tasks/hook-timeouts.md` · Branch: `claude/jh296-hook-timeouts`, from `origin/main` (6ee70c0b)
Delivery: one draft pull request per unit · Test runner: `node --test`

## State
U1, the diagnosis, is written below (`## Diagnosis`). Next: U2, the one slow js-harness hook whose files are free,
`doctor --hook`, through `bin/lib/stack.mjs`. Open: `resume --pause`, the likely source of the PostToolUse cancels,
lives in files open pull requests edit (968, 950), so it is said here and left.

## Goal
Each js-harness hook finishes inside its timeout on this machine, and the hooks that do not are named with their
evidence.

## Why
A timed-out or cancelled hook does none of its work: a guard that times out guards nothing, a pause notice that is
cancelled is never said. PR 963 measured 1,168 of 5,964 hook invocations ending that way (80.4% clean), against
C3.4's 100% (`odd/tasks/f8-s8-certification.md:138`).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/hook-timeouts.md` exits 0
- `node --test bin/lib/stack.test.mjs` exits 0
- `npm run check` exits 0
- `## Diagnosis` names each hook entry that timed out or was cancelled, with its count, durations and whether
  js-harness owns it

## In scope / Out of scope
- In: this document; `bin/lib/stack.mjs` and its test (U2).
- Out: `bin/resume.mjs` (PR 968), `bin/js-harness.mjs` (PR 950), `bin/doctor.mjs` and `bin/lib/hook-health.mjs`
  (PR 963), `bin/guard.mjs` (a guard file, and three open PRs edit it). Hook timeouts in his settings and in
  `bin/lib/hook-entries.mjs`: a setting, not this task's.

## Constraints
- A version doctor shows is never stale after an upgrade — because doctor's rows tell him what to update.
- No Codex run before 2026-11-23 23:45 — the weekly meter is at 70%; the skip is recorded with `--unavailable`.

## Ask me before
Nothing: the lead's brief `brief-296-hook-timeouts.md`, from his request below.

## Depth pass
- 1. Method: measure before changing (the host's own end records per hook), then cut the work a hook does, never its
  checks; the bar is a test that counts the work through a seam, as `reply-hook-latency.md` did.
- 2. Raw material: the 20 newest transcripts of `C:\Users\Oficina\.claude\projects\D--js-harness\` by write time;
  `~/.claude/settings.json` hooks; CPU profiles of `doctor --hook` and `resume --pause` (2026-11-22); the reader
  PR 963 adds, `bin/lib/hook-health.mjs:5` on its head; `bin/lib/stack.mjs:785`, `probeStack`; commit 417927fd.
- 3. The bar:
  spec 1: left out because it is a reading, held by `## Diagnosis` and its Done when line, not by a command.
  spec 2: `node --test bin/lib/stack.test.mjs`: none, new behaviour.
- 4. Refutation: if `doctor --hook` were fast alone and slow only under load, U2 would change nothing. Run alone at
  rest it took 3,249 and 3,204 ms of its 10,000 ms (`js-harness doctor --hook`, real home), so it is slow on its own.
  Verdict: supports
- 5. Request: name the hooks that end badly and why; make the slow js-harness one whose files are free do less.
  Adds: none

## Specs
1. His words, 0cdab702 line 12702 (2026-11-22): "sigue llenando las horas con más sesiones". The lead's brief: unit 1,
   which hook entries time out and which are cancelled, how long each runs, and whether a js-harness hook is the slow one.
2. The brief's unit 2: make each slow js-harness hook finish inside its timeout, with a test that fails today; a file
   an open pull request edits is skipped and said; a cancel caused by the host alone is reported, not fixed.

## Diagnosis
Read on 2026-11-22 from the 20 newest top-level transcripts of the `D--js-harness` project only, by write time
(host versions 2.1.286 to 2.1.326); PR 963 reads the 20 newest of every project, so its totals differ. Script:
a reader of every `hook_*` attachment, deduplicated by uuid, grouped by event and command.

How the host records a hook:
- Since host 2.1.317, a hook from `settings.json` is named `command hook N`, not by its command; N is its place among
  the event's matched entries and moves when the settings change. Plugin hooks keep their command. The table names each
  by its `timeoutMs` and its standard output, matched against today's `~/.claude/settings.json`.
- A hook that ends with empty standard output writes no attachment at all; only its timeout does. So `guard --hook`,
  `guard --stop`, `backup --hook` and `rules --hook` show only their timeouts, and how many runs they had is not known
  from the transcripts.
- A PostToolUse cancel carries no command and no `timedOut`: one attachment for the tool use.

| Event | Hook (owner) | Timeout | Ended badly | Clean recorded | p50 / p95 / max ms of recorded runs |
|---|---|---|---|---|---|
| PostToolUse | no command (see below) | — | 2,269 cancelled | — | — |
| PreToolUse | `js-harness guard --hook` (js-harness) | 5 s | 460 + 30 timed out | silent | 7,218 / 11,026 / 18,104 (timeouts) |
| PreToolUse | `js-harness advisor-gate --hook` (js-harness) | 5 s | 270 timed out | 4,661 | 905 / 5,501 / 23,926 |
| PreToolUse | `js-harness template gate --hook` (js-harness) | 5 s | 33 timed out | 671 | 917 / 4,636 / 29,724 |
| Stop | `js-harness guard --stop` (js-harness) | 5 s | 148 + 5 timed out | silent | 7,082 / 12,571 / 15,922 |
| Stop | `js-harness backup --hook` (js-harness) | 5 s | 155 + 6 timed out | silent | 7,141 / 11,596 / 19,742 |
| Stop | `js-harness reply --hook` (js-harness) | 15 s, 5 s before | 25 + 4 timed out | 1,707 | 1,882 / 9,409 / 25,563 |
| UserPromptSubmit | `js-harness rules --hook` (js-harness) | 5 s | 125 + 4 timed out | silent | 6,890 / 9,295 / 17,688 |
| SessionStart | `js-harness doctor --hook` (js-harness) | 10 s | 14 timed out of 26 | 12 | 9,013–10,408 p50, max 12,495 |
| SessionStart | `js-harness backup --session-start` (js-harness) | 5 s | 8 timed out | silent | 5,634–7,844 |
| SessionStart:compact | `js-harness resume --hook` (js-harness) | 15 s | 6 timed out | 66 | 3,402 / 15,252 / 19,806 |
| SessionStart:compact | `js-harness rules --hook` (js-harness) | 5 s | 12 timed out | silent | 7,066 / 9,340 |
| SessionStart | engram's memory load (plugin) | 10 s | 16 timed out | 72 | 3,173–8,304 p50, max 15,229 |
| Stop | orca's `claude-hook.cmd` (not js-harness) | 10 s | 1 timed out | 268 | 616 / 1,833 / 10,631 |
| UserPromptSubmit | `codegraph.cmd prompt-hook` (codegraph) | none | 1 cancelled | 70 | 1,621 / 5,210 / 6,193 |
| SessionStart:compact | gentle-ai, herdr, codex plugin (not js-harness) | 5–30 s | 1 timed out each | — | 7,905–33,732 |

Most timeouts are the machine, not the hook. A timed-out run of every js-harness hook took about 7 s, whatever the
hook, and the same stretches time out engram, gentle-ai and herdr. Run alone at rest on 2026-11-22: `guard --hook`
327–352 ms, `rules --hook` 319–357 ms, `resume --pause` 383–400 ms on a 57 MB transcript, bare `node -e 0` 116–130 ms.
Of a run, most of the CPU is loading modules (110 of 165 ms in `resume --pause`'s profile), so a loaded machine
stretches every hook alike. These are reported, not fixed.

The PostToolUse cancels are most likely `js-harness resume --pause`, the only PostToolUse hook with a 2 s timeout,
reaching it (likely, not proven):
- every recorded `resume --pause` run is at most 2,223 ms, p50 910, p95 1,798, with 60 of 2,527 over 1,900 ms;
- no cancelled tool use, of 24,141 across all projects, carries a pause notice;
- orca's PostToolUse hook, run beside it, took p50 994 / p90 2,406 ms on cancelled tool uses and 235 / 526 ms on the
  others: the cancels come when the machine is loaded, and 2 s is the first limit reached;
- against it: the hook came in 417927fd (2026-10-12) and the first cancel is in host 2.1.295 (2026-10-15); 2.1.293
  recorded none in 1,259 tool uses, so the host may have begun recording the cancel then.
It loads 46 modules for a notice that needs a handful. The cut is a lazy import in `bin/resume.mjs` or the dispatcher,
both edited by open pull requests (968, 950): skipped here and said to the lead.

The one js-harness hook slow on its own is `doctor --hook`: 3.2 s alone of its 10 s, 14 of 26 runs timed out. Its
profile: 1,809 ms in `probeStack` (`bin/lib/stack.mjs`), of which the version probes spawn `engram version`,
`codegraph --version`, `codex --version` and `codex login status`, and the remote server check takes a PowerShell
process snapshot (718 ms). U2 is there.

## Tasks
- [x] T1 (kind: verify) the diagnosis — spec 1; inline; this commit
- [ ] T2 (kind: build) `doctor --hook` spawns less in `bin/lib/stack.mjs`, test first — spec 2; inline

## Log
- L1. 2026-11-22, his request: "sigue llenando las horas con más sesiones" (0cdab702 line 12702); the lead's brief
  `brief-296-hook-timeouts.md` names the units.
- L2. 2026-11-22, the probes of this diagnosis ran two `js-harness doctor --hook` against the real home with session
  id `jh296-probe`, and three `resume --pause` with ids `jh296-probe-1..3`; no state file of those ids was found under
  `~/.js-harness` afterwards (`grep -rl jh296-probe`).
