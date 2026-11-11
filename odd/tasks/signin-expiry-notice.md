# Doctor and the heartbeat say when the stored Claude sign-in ends

Locator: `odd/tasks/signin-expiry-notice.md` · Engram mirror: `odd/signin-expiry-notice/tasks` · Branch: `worktree-signin-expiry-notice`
Delivery: one pull request · Test runner: `node --test` · Session: JH 179

## Goal
`js-harness doctor` has a `claude-signin` row that says how many days the claude.ai sign-in stored on the machine has
left and its local end date, a gap from a named margin before the end; the lead's heartbeat says the same days left
once the margin is reached, and is quiet before it.

## Why
The sign-in stored on this PC ends on 2026-11-23T16:11:04.604Z. When it ends, everything that works alone fails at
once until he signs in again: the background sessions, the lens reviews and the remote server the phone uses. From
Claude Code 2.1.318 `claude auth status` prints the date (`loginExpiresAt`), and no harness command reads it
(`docs/host-updates/claude-desktop-5.1231.0.md:380`, the one `adapt` of that review). Said a week before, he signs in
again while he is at the PC.

## Done when
- `node --test bin/lib/signin-expiry.test.mjs bin/doctor.test.mjs bin/loop-bodies.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/signin-expiry-notice.md` exits 0
- `npm run check` exits 0
- each new test was red before its code and green after it, named in `## Log`
- the branch's `doctor`, run on this PC, prints the `claude-signin` row and the days left to 2026-11-23, named in
  `## Log`
- the branch's `loop heartbeat` prints its sign-in line with a reading inside the margin, named in `## Log`
- Codex and the lenses cover the code commits; a pull request is open and the lead has its `ready` notice

## In scope / Out of scope
- In: a new `bin/lib/signin-expiry.mjs` and its test; `bin/doctor.mjs` and `bin/loop.mjs` with their tests;
  `bin/lib/stack.mjs` only to let the reader use its probe; the tests that list the doctor rows; `docs/SPEC.md` where
  it lists the rows; this document; the session's summary under `docs/sessions/`.
- Out: signing in, signing out, refreshing, storing or moving a credential, printing a token, reading a credential
  file, a keychain or `~/.claude.json` (the harness only runs `claude auth status` and reads two fields of its
  answer); a new rule, document or command; any remote machine; the session-start hook (`doctor --hook`), which
  the reading's cost keeps out (D2).

## Constraints
- The reader runs `claude auth status` and nothing else, and keeps only `loginExpiresAt` and whether a claude.ai
  sign-in is stored — because the same answer carries his e-mail, organisation and plan, which no row needs.
- A reading that fails is a row that says why, never a throw — because `doctor` is a report and every probe under it
  fails open.
- Nothing is written outside the repository — because a live reading needs no record (D3).
- The tests give a fake answer of `claude auth status` through the spawn seam, never his — because the real one names
  his account.

## Ask me before
- Nothing of his is touched. He signs in again himself; the harness only says when.

## Depth pass
- 1. Method: an expiry monitor, to the standard of a certificate-expiry check: read the end date from the one
  authority that prints it, compare it with the clock, warn from a fixed margin, say what to do and who does it, and
  fail open with the reason when the date cannot be read. Never touch the secret to read its date. The smallest change
  that meets it: one module with a reader and two pure functions (the row, the heartbeat line), listed in `doctor` as
  the host-update row is and ticked in the heartbeat as the host watch is. Searched first (`rule:reuse-first`):
  `grep -rn -e "auth status" -e loginExpiresAt -e credential_expires_at -e "auth', 'status" bin/ workshop/
  --include=*.mjs` finds 0 on 2026-11-11; `checks` in `bin/lib/stack.mjs:595` holds `claude-account` (the CLI and the
  app on one account, read from files, another question, `bin/lib/stack.mjs:401`); `hostUpdateRow`, `hostNotice`
  (`bin/lib/host-update.mjs:211`, `:271`) and `hostRow` (`bin/doctor.mjs:254`) are the neighbours of the row;
  `hostTold` (`bin/loop.mjs:464`) is the neighbour of the tick; `spawnProbeOrThrow` (`bin/lib/stack.mjs:47`) already
  runs a CLI on Windows and elsewhere; `localMinute` and `localZone` (`bin/lib/local-time.mjs`) already say a local
  time (`rule:local-time`).
- 2. Raw material: the CLI's own answer on this PC (CLI 2.1.322, `claude.exe` in `~/.local/bin`), read four times on
  2026-11-11 from 06:25Z by `spawnSync('claude auth status')`: exit 0, JSON with the keys `loggedIn`, `authMethod`,
  `apiProvider`, `analyticsDisabled`, `projectsDirectory`, `configDirectory`, `loginExpiresAt`, `email`, `orgId`,
  `orgName`, `subscriptionType`, `storedClaudeAiLogin`, `planTier`; `loginExpiresAt` `2026-11-23T16:11:04.604Z`,
  `storedClaudeAiLogin` `true`, `authMethod` `claude.ai`, `loggedIn` `true`, nothing on stderr; it took 5859, 4398
  and 6030 ms, and 4896 ms with `HTTPS_PROXY`, `HTTP_PROXY` and `ALL_PROXY` set to a closed port, with the same
  answer. The host review's row `docs/host-updates/claude-desktop-5.1231.0.md:380`, and `:381` (the CLI's own warning
  is on `claude -p` text output from 10 days before; the harness runs `claude -p --output-format json`, which does not
  get it). His words: transcript ea85ec35 line 6716, printed by `js-harness sessions --quote ea85ec35 6716 --cwd
  D:/js-harness`. The brief: `~/.js-harness/background/briefs/2026-11-11T06-14-31-879Z-2075a3fa.md`.
- 3. The bar:
  spec 1: `node --test bin/lib/signin-expiry.test.mjs`: none, new behaviour; today no file reads the date.
  spec 2: `node --test bin/doctor.test.mjs`: none, new behaviour; today `doctor` on this PC prints no `claude-signin`
  row.
  spec 3: `node --test bin/loop-bodies.test.mjs`: none, new behaviour; today the heartbeat names no sign-in.
  spec 4: `node --test bin/lib/signin-expiry.test.mjs`: none, new behaviour; the margin is no constant yet.
- 4. Refutation: three ways the request could not hold, each tried now. (a) The date cannot be read by a command:
  `node $CLAUDE_JOB_DIR/tmp/measure.mjs` read it 4 of 4 times. (b) Something already says it: the search of item 1
  finds 0 readers, and `grep -n "output-format" bin/lens-review.mjs bin/double-review.mjs` shows both run `claude -p`
  with `--output-format json`, which the CLI's own warning does not reach. (c) The reading is too dear to run where
  the brief asks: 4.4 to 6.0 s a reading, over the probes' 5 s limit (`PROBE_TIMEOUT_MS`, `bin/lib/stack.mjs:29`).
  That does not refute the row or the line; it rules out the session-start hook and a reading on every tick (D2).
  Verdict: supports
- 5. Request: build a reader of `claude auth status` that returns the end date of the stored claude.ai sign-in or
  why it cannot be read; list a `claude-signin` row in the interactive `doctor` (never the session-start hook) with
  the days left and the local date, a gap with what to do from a margin of 7 days kept as one named constant; and
  have the heartbeat read it at its start and every few hours, say the days left once inside the margin, end the loop
  when the margin is crossed, and stay quiet before it. Read-only, no record, tests first with a fake answer.
  Adds: none

## Specs
- S1 (the brief, "What to build" 1): "A reader of the date, with its test written first: it runs `claude auth status`,
  parses the JSON and returns `loginExpiresAt` and whether a claude.ai sign-in is stored. It reads nothing else: no
  credential file, no token, no keychain. A CLI that is missing, older than 2.1.318, signed in another way or printing
  no date gives a row that says the date cannot be read and why, never a failure of `doctor`."
- S2 (same, 2): "A `doctor` row with the days left and the local date; it warns from a margin before the end (the
  question proposed a week) and says what to do: he signs in again while he is present."
- S3 (same, 3): "A heartbeat line for the lead with the same days left, quiet while the margin is far."
- S4 (same, 4): "The margin is a value: one constant in code, named, with the reason beside it."
- S5 (same, "Not known, to settle before building"): "Whether `claude auth status` costs a network call and how long it
  takes: a `doctor` row and a heartbeat that run it often need to know. Measure it once and say it." and "Whether the
  date moves when he signs in again or when the CLI refreshes its token by itself; if it moves alone, the row should
  say what it saw last and when."
- S6 (same, "Done when"): "`npm run check` exits 0 with the new tests; `js-harness doctor` prints the row on this PC
  with the days left to 2026-11-23; the heartbeat prints its line; both reviews (Codex and the lenses) cover the code
  commits; a pull request is open and the lead is told with `js-harness notify --to orchestrator --kind ready --pr
  <n>`. The merge is his."

## Tasks
- [ ] T1 (kind: build) the reader and the two pure functions, `bin/lib/signin-expiry.mjs`, with the margin — S1, S4;
  inline, test first
- [ ] T2 (kind: build) the `claude-signin` row in the interactive `doctor`, and the notes it prints — S2; inline,
  test first
- [ ] T3 (kind: build) the heartbeat's sign-in tick — S3; inline, test first
- [ ] T4 (kind: verify) `doctor` and the heartbeat run here; Codex and the lenses on the code commits; `npm run
  check`; the pull request, the ready notice, the summary — S5, S6

## Decisions
- D1 The row is `doctor`'s own, listed as the host-update row is (`buildReport` in `bin/doctor.mjs`, given by
  `doctorCommand`), not an entry of `checks` in `bin/lib/stack.mjs`: a check's row is built by `probeTool` from fixed
  cells and has no place for the days left or for why a date cannot be read, and the callers of `doctorMain` that
  give no reader (the tests, the TUI's stack block) run no CLI.
- D2 The reading is made by the interactive `doctor` only, never by `doctor --hook`: it takes 4.4 to 6.0 s here (item
  2), and the session-start hook runs at every session start. The reader has its own time limit, 20 s, since the
  probes' 5 s would cut a normal reading on a busy machine. Cost said: `js-harness doctor` takes about 5 s longer.
- D3 No record is kept. S5's second half is not known and cannot be learned without signing in, which is his: the
  four readings of item 2 and the host review's (`claude-desktop-5.1231.0.md:380`, hours earlier) give the same
  instant to the millisecond, which is what a date that does not move alone would show, and is no proof. A row that
  reads live every time says what the CLI says now, whether or not the date moved, so "what it saw last and when" has
  nothing to add; the heartbeat reads again every `SIGNIN_HOURS`, so a new sign-in is seen within that.
- D4 Network: the answer came the same, as fast, with every proxy variable pointed at a closed port, so a reading does
  not need the network (checked for the proxy variables only; whether the CLI honours them for every request it could
  make is assumed).
- D5 States, in the `claude` cell: `ok` with more than the margin left; `stale`, a gap, from the margin on and after
  the end, its fix saying he signs in again with `claude auth login` while he is present; `unknown`, no gap, when the
  date cannot be read, with why. `GAP_STATES` (`bin/lib/digest.mjs`) has no state for "ends soon", and `stale` is what
  the rows about something due use (`unseen`, `worktrees`, `review-skips`).
- D6 The days left and the local date are a `note` of the row, which `doctor` prints under the table for every row
  that has one: the table's cells hold a state each, the version cell is a tool's (and a version there would read as
  one), and a fix line is printed only for a gap, while S6 wants the days left printed with 12 of them, outside the
  margin. `--json` carries `note`, `expiresAt` and `daysLeft` on the row.
- D7 The margin is 7 days, `SIGNIN_WARN_DAYS`: the question he was asked proposed a week (question 258). It is under
  the CLI's own 10 days, which the harness does not see (item 2).
- D8 The heartbeat's tick is the product's, with a default reader, unlike the three workshop ticks: a stored sign-in
  that ends stops any project's unattended work, not only this repository's. It reads at the start and every
  `SIGNIN_HOURS` (6): a reading blocks the loop for about 5 s, and a date with a margin of days needs no more. Inside
  the margin the line is said at the start and after every line that ends the loop, as the reviews due are; the loop
  itself ends only when a reading crosses into the margin or past the end, so a heartbeat started inside the margin is
  not ended by what it just said. A date that cannot be read is said once, with why.
- D9 A CLI that reports no sign-in at all (`loggedIn` false) is `unknown` with that as the reason, not a gap: the
  brief lists what cannot be read and asks no new gap, and by then every session has already failed aloud.

## Log
- L1 (his request, as written; lead transcript ea85ec35 line 6716, 2026-11-11T05:26:36Z, printed by `js-harness
  sessions --quote ea85ec35 6716 --cwd D:/js-harness`): "une lo que quede listo y tienes autorizacion para poder
  avanzar en todo y escoger siempre la opcion recomendada, no preguntes, avanza y se completamente autonomo." Under
  it the lead answered question 258 yes, whose yes covers "construir ese aviso: una fila en doctor y una línea en el
  latido, con su prueba, en una sesión propia" and does not authorize "iniciar sesión por ti, guardar ni tocar
  credenciales: el arnés solo leería la fecha con claude auth status". The brief, written by JH 174 and started by
  the lead as JH 179: `~/.js-harness/background/briefs/2026-11-11T06-14-31-879Z-2075a3fa.md`, quoted in `## Specs`.
- L2 (evidence, measured 2026-11-11 from 06:25Z, this PC, CLI 2.1.322): the readings of item 2 of the depth pass.
- L3 (state, 2026-11-11 about 06:50Z): this document written before any code; next T1, test first.
