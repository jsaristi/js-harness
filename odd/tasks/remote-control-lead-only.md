# JH 200 · Remote Control only in the orchestrator

Locator: `odd/tasks/remote-control-lead-only.md` · Engram mirror: `odd/remote-control-lead-only/tasks` · Branches:
`feat/remote-control-lead-only` (slice 1, worktree `D:/js-harness-worktrees/remote-control-lead-only`) and a
`rule/remote-control-yes` branch for slice 2 · Delivery: one pull request a slice, landed by the lead · Test runner:
`node --test`

## State
Done: the depth pass and this document. Next: the note to the lead (the line of his words, the surfaces outside the
brief, the rule-file clearance), then slice 1's failing tests. Open: the lead's clearance for slice 2's rule files and
for `bin/doctor.test.mjs` and `bin/lib/manifest.mjs`.

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
- In: `bin/sessions-background.mjs` and its test; `bin/lib/host-update.mjs` and its test; `bin/doctor.test.mjs`
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
- [ ] T1 (kind: build) spec 1, 2: `parseStart` off by default, `--remote-control` opt-in, resume by the flag, the
  printed line and usage; tests first; README and SPEC. Route: slice 1, `feat/remote-control-lead-only`.
- [ ] T2 (kind: build) spec 3, 4: `rules change remote-control-yes` with L1; `remoteControlStep`; host-update,
  doctor and manifest tests; the manifest line; README 648-652. Route: slice 2, `rule/remote-control-yes`, after the
  lead clears the rule files.

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
