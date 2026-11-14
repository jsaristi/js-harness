# JH 200 · Remote Control only in the orchestrator

Locator: `odd/tasks/remote-control-lead-only.md` · Branches:
`feat/remote-control-lead-only` (slice 1, worktree `D:/js-harness-worktrees/remote-control-lead-only`, landed as
pull request 870) and `rule/remote-control-yes` for slice 2 · Delivery: one pull request a slice, landed by the lead · Test runner:
`node --test`

## State
Done: T1 (pull request 870, landed) and T2 (d853a8c2, 7a7df32f on `rule/remote-control-yes` from main
83678e06), each reviewed by Codex, the three lenses and a verifier with no finding to fix (L5, L7). Next: slice 2's
pull request and its ready notice; the lead lands it. Open: nothing of this task.

## Goal
A session the orchestrator starts with `js-harness sessions start` has no Remote Control unless asked for, and the
host-update review turns Remote Control back on only in the orchestrator, so no ended work or senior session leaves an
offline row in his sidebar.

## Why
He talks only to the orchestrator; the sessions it tasks report by notices and cross-session messages (L1). Every
`sessions start` today passes `--remote-control <title>` (`bin/sessions-background.mjs:78`), so a session whose
process ends stays in his sidebar as an offline Remote Control row (two JH SR rows and an old JH 198 row on
2026-11-14), and no tool archives those rows (the audit's item A3b).

## Done when
- `node --test bin/sessions-background.test.mjs bin/lib/host-update.test.mjs bin/doctor.test.mjs bin/lib/manifest.test.mjs` exits 0
- `js-harness rules check` exits 0
- `npm run check` exits 0
- `js-harness contract check odd/tasks/remote-control-lead-only.md` exits 0
- once the installed copy carries both slices (a release and `js-harness upgrade`, the lead's), `js-harness sessions
  start` with no flag prints that Remote Control is off, and `js-harness doctor`'s host-update step names only the
  orchestrator
- both pull requests are landed by the lead

## In scope / Out of scope
- In: `bin/lib/rules-coverage-data.mjs` (one stale span, `rules coverage --refresh`) and the rule
  `sessions-open-in-sidebar`'s reading (L6); `bin/sessions-background.mjs` and its test; `bin/lib/host-update.mjs` and its test; `bin/doctor.test.mjs`
  (it asserts the step's words); `bin/lib/manifest.mjs` and its test (the orchestrator skill's resume step); the rule
  `remote-control-yes` through `js-harness rules change` (`docs/rule-sources.json`, `bin/lib/rules-data.mjs`,
  `docs/RULES.md`); README and `docs/SPEC.md` where they state the default; this document.
- Out: the app setting `connect_new_sessions_to_remote_control` (his own sessions, outside his words); the ghost rows
  already in his sidebar (his to archive); why the senior's process ended at about 10:56 on 2026-11-14;
  `bin/lib/background.mjs`, whose `startArgs` already takes `remoteControl` (cleared to JH 198).

## Constraints
- A CLI default others consume and an owner rule (high risk 3), so each slice gets Codex, the Claude lenses and an
  independent verifier; no edits while a Codex run goes; one commit a round of fixes.
- The rule files are queued behind JH 198's T6 and JH 199's T4: slice 2 starts only once the lead clears them.
- Test first: each behavior change lands with the test that proves it, written before the code.

## Ask me before
Nothing of his is open: his words (L1) settle the direction. The lead clears the shared files and lands the pull
requests.

## Depth pass
- 1. Method: least privilege for a capability that costs something when idle. A feature that exposes a session to
  outside clients is off unless the one who uses it asks, and the default is set where the session is made, not
  undone later. The smallest change that meets it: flip the default of `parseStart`, keep the flag that turns it on,
  and word the review's restart step for the one session that needs it.
- 2. Raw material:
  - his words, lead transcript `69918425-3b43-430f-9f50-62b6422422ce` line 7262, 2026-11-14T18:57:14Z (L1). The brief
    cited line 7277: `js-harness sessions --quote 69918425-3b43-430f-9f50-62b6422422ce 7277` answers "not the
    user's words: line 7277 … is an assistant entry", and 7262 prints his message (L2).
  - `bin/sessions-background.mjs:78` (`parsed = { remoteControl: true }`), `:81` (`--no-remote-control`), `:347`
    (the printed line), `:424` (resume: `parsed.remoteControl && entry.remoteControl !== false`), `START_USAGE`
    lines 28, 30, 34; `bin/lib/background.mjs:58-65` (`startArgs` passes `--remote-control <title>` only when asked).
  - `bin/lib/host-update.mjs:194-204` (`remoteControlStep`: "turn Remote Control back on in each work session", and
    the ask branch "in each work session"); `bin/lib/host-update.test.mjs:109,136`; `bin/doctor.test.mjs:2002-2018`.
  - `bin/lib/manifest.mjs:202` (the orchestrator skill): "resume each paused session by message … then turn its
    Remote Control back on".
  - the rule: `js-harness rules remote-control-yes` (subject "turning Remote Control back on in each work session
    after a restart of the Claude app …", value "a standing yes of 2026-10-15").
  - how a lead starts: the rotation in `bin/lib/manifest.mjs` (around line 222) starts a new lead "with the host's
    session-start tool", not with `sessions start`; `bin/guard.mjs:178` sends only a senior to `sessions start`.
  - readers of the recorded `remoteControl`: `git grep remoteControl bin` finds only `sessions-background.mjs`,
    `background.mjs` (`startArgs`) and its test; nothing reads the record's field but the resume.
  - docs stating the default: README 1416-1417, 1448 (slice 1) and 648-652 (slice 2); `docs/SPEC.md` 756.
- 3. The bar:
  spec 1: `node --test bin/sessions-background.test.mjs`: today the test at :180 asserts `--remote-control` with no
  flag; none asserts it off by default.
  spec 2: `node --test bin/sessions-background.test.mjs`: none, new behaviour (a resume with no flag of a record
  holding `remoteControl: true` passes `--remote-control` today).
  spec 3: `node --test bin/lib/host-update.test.mjs`: today asserts "in each work session" (:109).
  spec 4: `node --test bin/lib/manifest.test.mjs`: nothing asserts the resume step's Remote Control clause today.
- 4. Refutation: does any session the orchestrator tasks need Remote Control to work? A background session is
  reached by `SendMessage` to its title and reports by `js-harness notify` (`bin/lib/background.mjs:31`, the brief's
  closing), neither of which uses Remote Control; the one session he reaches from the phone is the lead, which the
  rotation starts with the host's tool.
  Verdict: supports
- 5. Request: `sessions start` and its resume leave Remote Control off unless `--remote-control` is given
  (`--no-remote-control` stays accepted, and both together are a usage error); the printed line says which; the rule
  `remote-control-yes` and the host-update step it words turn Remote Control back on only in the orchestrator, and so
  does the step's ask branch in a project without the rule, since no work session has it on anywhere now; the
  orchestrator skill's resume step stops turning it on in each paused session; README and SPEC say the new default.
  The ask branch's wording is beyond the brief, which names only the rule branch, and `bin/doctor.test.mjs` and
  `bin/lib/manifest.mjs` are outside its surfaces: both go to the lead in the first note.
  Adds: none

## Specs
1. His words (L1): "yo creo que esa sesion no la necesito con remote control por que la idea es que solo le coloca
   tareas el orquestador y solo se va a comunicar con el, yo no me voy a comunicar directamente con el, yo solo me
   comunico directamente con el orquestador entonces nisiquiera necesito teners a las demas con remote control". So
   `js-harness sessions start` passes no `--remote-control` unless `--remote-control` is given.
2. A resume (`--resume`) passes `--remote-control` only when that resume is given `--remote-control`, whatever the
   record holds: every record written before this change holds `true`.
3. The host-update review's step turns Remote Control back on only in the orchestrator session (with the rule,
   without asking; without it, after asking), and the rule `remote-control-yes` says so, quoting L1.
4. The orchestrator skill's resume after a restart turns Remote Control back on in no paused work session.

## Tasks
- [x] T1 (kind: build) spec 1, 2: `parseStart` off by default, `--remote-control` opt-in, resume by the flag, the
  printed line and usage; tests first; README and SPEC. Route: slice 1, `feat/remote-control-lead-only`, 88c92216.
- [x] T2 (kind: build) spec 3, 4: `rules change remote-control-yes` with L1; `remoteControlStep`; host-update,
  doctor and manifest tests; the manifest line; README 648-652. Route: slice 2, `rule/remote-control-yes`, d853a8c2 and
  7a7df32f, after the lead cleared the rule files (L4, L6).

## Log
- L1 (his request, lead transcript 69918425, line 7262, 2026-11-14T18:57:14Z, as written): "Como hacemos para que
  esto no suceda, osea yo creo que esa sesion no la necesito con remote control por que la idea es que solo le coloca
  tareas el orquestador y solo se va a comunicar con el, yo no me voy a comunicar directamente con el, yo solo me
  comunico directamente con el orquestador entonces nisiquiera necesito teners a las demas con remote control, como
  hacemos para cambiar esto para que seamos muchisimo mas eficientes y no carguemos el sistema con complejidad
  adicional y no vuelva a pasar esto"
- L2 (evidence, 2026-11-14): the brief cited line 7277; `sessions --quote` refuses it as an assistant entry, and line
  7262 is his. Every quote here uses 7262.
- L3 (decision, this session): a lead started through `sessions start` gets no special default; it passes
  `--remote-control`. The rotation starts a lead with the host's session-start tool, so no lead path depends on the
  default, and a default by title would add the complexity his words ask to avoid.
- L4 (the lead, 2026-11-14): line 7262 confirmed; L3, the ask branch and the resume agreed. Slice 2 cleared once
  JH 198's T6 landed (main 4187cb1): the rule files, and in `bin/lib/manifest.mjs` only the line at :202 and its test,
  the rest of that file staying JH 198's for its T7. JH 199's double-review rule change waits for slice 2.
- L5 (evidence, slice 1's reviews): Codex (75,809 input tokens, confidence 0.97) and the risk, readability and
  reliability lenses (about 33,000 input tokens) found nothing; the verifier ran `node --test
  bin/sessions-background.test.mjs` (58 pass) and found `bin/lib/manifest.mjs:157` still saying `sessions start`
  runs a session "with Remote Control on", a line the lead's clearance (L4) does not cover, and the reading of the rule
  `sessions-open-in-sidebar` in `docs/rule-sources.json` saying Remote Control keeps him seeing every session. Both
  go to the lead.
- L6 (the lead, 2026-11-14): slice 2 also changes the clause at `bin/lib/manifest.mjs:157` and its test, nothing
  else in that file; and the reading of the rule `sessions-open-in-sidebar`, by `rules change` quoting L1, its value
  and guard unchanged: he sees every session through the board and the lead, and the sidebar for start_session sessions.
- L7 (evidence, slice 2's reviews, range 83678e06..7a7df32f): Codex (79,932 input tokens, confidence 0.96) and the
  risk, readability and reliability lenses (about 48,000 input tokens) found nothing. The verifier ran the host-update
  (21 pass) and manifest (219 pass) tests, `rules check` and `rules coverage --strict`, and found two low points and a note,
  all answered and not changed: the ask branch names an orchestrator that a project without one lacks, which L4 accepted
  since `sessions start` gives no work session Remote Control anywhere and the sessions a user opens himself follow
  the app's own setting, outside these words; and "the sessions it tasks have none" passes over one started with
  `--remote-control`, which by L3 is a lead's opt-in, not a session the lead tasks. The other low point, that the step does not say
  how to find the orchestrator: the step is the orchestrator's own on its return (`bin/lib/manifest.mjs:202` gives
  it to the lead for its own session), and a host-watch session tells the lead, as the step's head says. Slice 2 was cherry-picked onto a
  straight branch from main so its review reads only its own two commits; the tree equals the earlier merge branch's.
