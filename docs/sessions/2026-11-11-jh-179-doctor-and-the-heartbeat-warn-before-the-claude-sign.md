# JH 179 · doctor and the heartbeat warn before the Claude sign-in expires

## Goal
Build the sign-in expiry notice the host review of Claude Desktop 5.1231.0 proposed (its one `adapt`,
`docs/host-updates/claude-desktop-5.1231.0.md:380`): a `doctor` row and a heartbeat line that say when the claude.ai
sign-in stored on the machine ends, read with `claude auth status` and nothing else. The opening it read is the brief
`~/.js-harness/background/briefs/2026-11-11T06-14-31-879Z-2075a3fa.md`, written by JH 174 and started by the lead.
The feature document is `odd/tasks/signin-expiry-notice.md`.

## The user's words
"une lo que quede listo y tienes autorizacion para poder avanzar en todo y escoger siempre la opcion recomendada, no
preguntes, avanza y se completamente autonomo." (lead transcript ea85ec35, line 6716, 2026-11-11T05:26:36Z, printed
by `js-harness sessions --quote ea85ec35 6716 --cwd D:/js-harness`). Under them the lead answered question 258 yes,
whose yes covers "construir ese aviso: una fila en doctor y una línea en el latido, con su prueba, en una sesión
propia" and does not authorize "iniciar sesión por ti, guardar ni tocar credenciales: el arnés solo leería la fecha
con claude auth status".

## Delivered
- Pull request 818, merged at 2026-11-11T08:32:07Z (`gh pr view 818 --json mergedAt`): `bin/lib/signin-expiry.mjs`,
  the reader of `claude auth status`, and `doctor`'s `claude-signin` row with its `Notes:` block. Commits `fa682dde`
  (the slice), `06e24923` (a signed-out CLI is a `missing` gap), `5f35d1a3` (a test's path spellings).
- Pull request 823, open against main, its ready notice sent after this file was pushed: the heartbeat's sign-in tick and `signinTold`. Commits `94d9d5c3` (the tick),
  `8e7a0fd6` (news and the line are confirmed by a reading at that tick), `f70902d9` (a line that could not be
  confirmed says when its date was read), two merges of `origin/main` (`e54847c5` resolved its conflict with pull request 820) and `ec517abb` (the line is said at the start).
- On this PC, the branch's own copy: `node bin/js-harness.mjs doctor --offline` prints `claude-signin   n/a       ok
  n/a       n/a       n/a` and, under `Notes:`, `claude-signin: the claude.ai sign-in stored on this machine ends in
  12 days, on 2026-11-23 11:11 (UTC-05:00)` (Log, L8). `node bin/js-harness.mjs loop heartbeat --quiet 1 --every 20
  --max 1`, stopped after 40 s, opens with "every 6 hours, the end of the stored claude.ai sign-in is read, and one
  that comes within 7 days, or passes, ends it" and says no sign-in line, 12 days being outside the margin; with this
  PC's real reading and a clock moved 6 days ahead, `signinTold` returns the `SIGN-IN:` line (Log, L14).
- Tests: `bin/lib/signin-expiry.test.mjs` 22, `bin/doctor-signin.test.mjs` 8, `bin/loop-bodies.test.mjs` 36 of this
  branch (45 with main's), each new one written first and seen red (Log, L4, L6, L7, L11, L14, L16, L17).
- The feature document, `odd/tasks/signin-expiry-notice.md`: contract, depth pass, specs, decisions D1 to D11, Log
  L1 to L21.

## Decisions
All this session's, under the lead's yes to question 258; each is in `## Decisions` of the feature document.
- D1, D6: the row is `doctor`'s own, with a `note` printed under the table; not an entry of `checks`.
- D2: only the interactive `doctor` reads, never `doctor --hook`: a reading takes 4.4 to 6.0 s (measured four times).
- D3: no record of past readings. Whether the date moves by itself is not known and cannot be learned without
  signing in, which is the user's.
- D4: no network is needed (same answer with the proxy variables pointed at a closed port).
- D7: the margin is 7 days, `SIGNIN_WARN_DAYS`, the week question 258 proposed.
- D8: the heartbeat's tick is the product's; it reads at the start and every 6 hours (`SIGNIN_HOURS`), ends the loop
  only when the level rises, and confirms with a reading at that tick before it ends or says its line.
- D9: a CLI that says it is not signed in is a `missing` gap and the heartbeat's top level, since an ended sign-in
  may read exactly so. Changed after the lenses' first review.
- D10: only the user's own home is read; another `--home` gives `n/a` and runs no CLI, since `claude auth status`
  answers for the OS user whatever home the harness was given.
- D11: two pull requests, the first over 400 lines because of its tests.
- The lead's: the go to rerun the stopped commit (its message of 2026-11-11, 04:41 local in its text).

## Failures and lessons
- Hours estimated, not read: nine hours in the feature document were written as "about HH:MMZ" without reading the
  clock, up to 100 minutes ahead. Found when a notice printed the clock; replaced by the commits' hours in `94d9d5c3`;
  a `- Seen:` line of `hours-guessed` in `docs/FAILURES.md`. The documents control reads only a line that opens with
  the date and an hour. It happened once more while writing L16 (three hours, caught before the commit by reading
  `date -u` and `git log --format=%cI`).
- A test read the real account: `bin/js-harness.test.mjs` runs the real `doctor` with a temp home, and the reader as
  first written would have run the real `claude auth status` from it. Found while writing the row (Log, L5); D10.
- A quiet state at the moment the row warns of: `loggedIn` false was first `unknown`. Two lenses found it (L11); D9.
- A stale warning: the heartbeat told a date up to 6 hours old, so a renewed sign-in was still told. A lens found it
  (L16); the confirming reading.
- A test that failed on some Windows checkout paths: Codex's one P2 (L12), fixed in `5f35d1a3`.
- A gate that failed once and passed on the second try at commit `421f994c`: which test failed was not read (L12).
  Not known.
- A stacked pull request met a moved main: 823 conflicted with pull request 820 in `bin/loop.mjs` (L18). While its
  merge commit waited for the gate, Claude Code stopped the session's background commands for low memory; the lead
  gave the go to rerun (L19).
- A decision written and not built: D8 said the sign-in line is said at the start, the code only saved it and no test asked for it. Three Codex and three lens reviews missed it; Codex found it in the review of the merge (L20). Fixed in `ec517abb`; a `- Seen:` line of `record-states-wrong-fact`. Past the three reviews of `rule:double-review`, so it was raised to the lead, who gave the go for a fifth round (L21).

## Left
- Two lens findings of the fifth round, answered with no code change (L21): a guard read as clock-dependent, and the name `signinNews` used twice in the heartbeat.
- One lens suggestion, not blocking, open after the three reviews of the second slice: the heartbeat's default
  reader is proved by a pattern over the source, not by an observable result (answered in L16 and L17). The lead
  holds whether it is worth a seam.
- Not checked: a real heartbeat crossing the margin (the crossing is a test with a made-up reading); what `claude
  auth status` prints after the end date; macOS and Linux beyond the gate's tests.
- The installed `js-harness doctor` shows the row once the installed copy is refreshed from main: the lead's.
- The merge of 823: his.

## Cost
- Time: the brief at 2026-11-11T06:14Z; the first ready notice at 08:07Z, the waiting notice at 09:30Z, the last
  notice the closed notice that follows this file.
- Context: 28% at the first ready notice, 72% at the waiting notice, after one compaction.
- Codex: 8 reviews, the last two 98,067 and 37,634 input tokens; the first six (151,593; one whose tokens were not read; 33,819; 129,583; 80,459; 99,307 input tokens).
- Claude lenses: 6 reviews, 16 lens passes (4, 3, 4, 2, 1, 2), one more stopped for memory.
- Gate runs: one a commit, 16 commits on the two branches, plus one that failed its first try (L12) and one stopped for memory (L18).
