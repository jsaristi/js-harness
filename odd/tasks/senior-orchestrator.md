# senior-orchestrator

A senior session on Fable 5.2 at high that the lead sends tasks needing more intelligence or complexity. Session
JH 192, slice 3 of the lead's brief. Delivery: this design, then one pull request, branch `rule/senior-orchestrator`
(`rules change` runs only on a `rule/` branch, `bin/lib/rules-change-run.mjs:170`). Runner: `node --test`.

## State
Committed: fd309617 senior-model; 8fc7a92b senior-effort; e25ab304 the reporters hold a senior by role (heldOfRole);
a258b450 only the lead starts a senior, one at a time. Reviewed 1a5061d..a258b45 (Codex 2 parts, lenses risk and
reliability). Their findings, fixed in the next commit, each with a test: a background senior was judged against the
home's advisor (home-sessions.mjs); rules switch's target home carried no senior (rules-switch.mjs homesOf); projectCode
refused the code SR, valid before (back to valid: its titles still parse); the default app-record reader was untested.
40089ace fixed them; its recheck was clean (Codex 0.95, lenses 0). Merged in PR 852, after PR 853 made
bin/clean-home.test.mjs independent of the machine's tools. Follow-ups: the lead-protocols "A senior" section (T5, its
spans need coverage), the rule texts of session-model, session-effort and advisor-model ("every session but a
senior"). "No advisor" is claimed only after the first senior's transcript shows it.

T6 (2026-11-15, specs 3 and 4): the lead starts the senior as a visible app session with `start_session`, then sets
its model and level with its session tools and detaches it; the guard lets that start through and holds the senior to
its rules where the lead sends it work. `sessions start --title "<code> SR · …"` stays, unused by the protocol.
cb830c3e built it; Codex's review (7619fc9..25e7f82, verdict incorrect at 0.92) found one P2: any brief passed, so a
task in it ran on the lead's model before `set_session_model`. The next commit holds the brief to `SENIOR_WAIT_BRIEF`
(D11). Lenses: risk and reliability 0, resilience 1 warning, answered (D12). Codex recheck: fixed (0.98). The
verifier's findings are fixed in a95fd076 (D13), reviewed clean (Codex 0.94, lenses 0); the background is held in
the next commit (D14). Left: its reviews, the PR. Then T7 (question 306, yes), then T8.

## Goal
The lead starts a senior session, titled `<code> SR · <purpose>`, as a visible app session with `start_session`
(then `set_session_model`, `set_session_effort` and `detach_session`), and no task reaches it while its app record
is off the senior's model and level, read from two rules; every other session stays on the home, and no reporter
calls the senior off it.

## Why
His words (S1, S2): a senior orchestrator on Fable 5.2 high that the orchestrator sends specific tasks needing more
intelligence or complexity. Today a start on Fable is refused (the guard and `sessions start` hold every start to
`rule:session-model`), and a title `JH SR · x` is refused before that (`TITLE_SHAPE`, `bin/lib/sessions.mjs:1248`).

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/senior-orchestrator.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `node bin/js-harness.mjs rules coverage` exits 0
- `node --test bin/lib/sessions.test.mjs bin/lib/session-title-guard.test.mjs bin/guard.test.mjs bin/lib/guard.test.mjs` exits 0
- `node --test bin/sessions-background.test.mjs bin/lib/model-home.test.mjs bin/lib/home-sessions.test.mjs bin/lib/home-doctor.test.mjs` exits 0
- `npm run check` exits 0
- The tests name each case: `sessions start --title "JH SR · x"` passes `--model claude-fable-5-2 --effort high` and no
  `--advisor`; its resume does the same whatever its record holds; `JH 7 · x` on `claude-fable-5-2` is refused; an SR
  start naming `--advisor`, another model or another level is refused; an SR start from a session not titled as the
  lead is refused; a second live senior is refused; an SR session on Fable at high is on its home for `doctor`,
  `rules applied` and the board.
- T6's tests name each case: `start_session` with an SR title from the lead, at `rule:senior-effort`, naming no model,
  in its own worktree, passes; the same from a session not titled as the lead, from no session, or from one with no
  readable record is refused, a title-only offer too; naming no effort, another level, any model, or
  `use_worktree: false` is refused; a second live (not archived) senior of the code is refused; a message
  (`SendMessage`, `send_message`) to an SR session whose app record holds another model or level than the senior's
  is refused, naming `set_session_model` and `set_session_effort`, and one on Fable at high passes; a start whose
  `prompt` is other than `SENIOR_WAIT_BRIEF`, or whose `background` is other than `SENIOR_WAIT_BACKGROUND` (blanks
  around them aside), is refused, giving the text to copy.
  So is one whose `initiation` is not "user_asked", one from another project's lead, and one naming `target` other
  than "local", `cwd`, `preset`, `host` or a `use_worktree` other than true; `send_message` is read by its
  `session_id` and `SendMessage` by its `to`.

## In scope / Out of scope
- In: two rules, `senior-model` and `senior-effort`, joined to the Claude home (`CLAUDE_HOME`, `claudeHome`,
  `claudeHeld`, `homeFaults`: a full Claude id and an effort level); the title contract: `TITLE_SHAPE` and
  `roleOfTitle` with a role `senior` for `SR`, `projectCode` refusing `SR` as a code, `rule:session-title`'s text by
  `rules change`, `notify --to` and `sessions --address` taking `SR`; the guard's start (refuse `start_session` for an
  SR title, refuse an SR start whose starter is not the lead's title); `sessions start` and its resume (the senior's
  model and level, an explicit no-advisor state, `--advisor` refused, the starter's title, one live senior at most);
  the reporters' hold by role (`heldOf(title)` in `bin/lib/home-sessions.mjs`, `bin/lib/home-doctor.mjs`,
  `bin/rules.mjs`, the switch's `outsideLines`, `bin/lib/roster-home.mjs`); the texts of `rule:session-model`,
  `rule:session-effort` and `rule:advisor-model` by `rules change` ("every session but a senior"); the orchestrator's
  protocol, `bin/lib/lead-protocols.mjs`. T6: the guard's start of a senior by `start_session` and its message check;
  `appSessions` giving each record's app id (`sessionId`); the lead protocol's senior paragraph.
- Out: the values of the other rules of the home; a senior that starts sessions of its own (it is a session the lead
  sends tasks to, S2 "que le manden tareas", not a second lead; the lead's own role stays the lead's).

## Constraints
- The guard is high risk (security: guards): tests first, an independent verifier after its own checks.
- Each rule lands with its first reader in one commit (`rules change --with`); a rule changes once per pull request,
  since `rules change` and `rules switch` both compute from origin/main's declaration (JH 192, lead-effort-split L6).
- Before the first senior starts, one probe of `claude-fable-5-2` at high with no advisor (`claudeProbeArgs`), its
  cost said first.

## Ask me before
Nothing before it lands; his go-ahead (lead transcript 93b72703, line 896, "aplica todos los cambios ya") covers
this slice once its gate and both reviews pass, as the lead read it in its note of 2026-11-12 10:29 local.

## Depth pass
- 1. Method: a role is a title, as the lead's is: `leadTitle` holds a start to its own level by the title, so a senior
  is one more role with its own model and level, read from rules, through every reader of a title and of the home.
  Searched: `js-harness rules` (no rule names a senior); `roleOfTitle`, `TITLE_SHAPE` and `projectCode` in
  `bin/lib/sessions.mjs:1248-1299`; the hold by title in `bin/lib/guard.mjs` (`sessionStartRefusal` 88-118,
  `starterRefusal` 126-143, `sessionStartHome` 149-153); the resume in `bin/sessions-background.mjs:343-351`. Weighed
  and set aside: a sub-agent on Fable (it shares the lead's context and ends with its turn; his words name a session).
- 2. Raw material: his words, `js-harness sessions --quote 812b728f 1444` and `--quote 93b72703 775`; the double
  review read 134b8277 (`.git/js-harness`), whose findings each cite a path and line; the title parser,
  `bin/lib/sessions.mjs:1248`; the resume's home, `bin/sessions-background.mjs:343`; the reporters' hold,
  `bin/lib/home-sessions.mjs:51`.
- 3. The bar:
  spec 1: `node --test bin/lib/sessions.test.mjs`: none, new behaviour (`roleOfTitle('JH SR · x')` is null today).
  spec 2: `node --test bin/sessions-background.test.mjs bin/lib/guard.test.mjs`: none, new behaviour (a start on Fable is refused today).
  spec 3: `node --test bin/guard.test.mjs`: none, new behaviour (a start_session of an SR title is refused at 7619fc94).
  spec 4: `node --test bin/guard.test.mjs`: none, new behaviour (the lead starts the senior; same tests as spec 3).
  spec 5: `node --test bin/guard.test.mjs`: none, new behaviour (`js-harness sessions start` passes the guard today).
  spec 6: `node bin/js-harness.mjs rules applied`: lists no lead off `rule:lead-effort` when its title lacks the "·" (seen 2026-11-16).
- 4. Refutation: the request fails if a senior can be started today. Run: `node -e` importing `roleOfTitle` from
  `bin/lib/sessions.mjs` on `JH SR · x`. Result: null, so the title guard refuses it before any model is read.
  Verdict: supports
- 5. Request: "Let the lead start a senior session, `<code> SR · <purpose>`, on Fable 5.2 at high read from rules,
  and send it the tasks it judges need more intelligence or complexity; keep every other session on the home."
  The decisions D1 to D5 of the Log are the session's reading of his words, written there since the lead asked for no
  question (2026-11-12 10:29 local); his to correct.
  Adds: none

## Specs
1. "Yo creo que nos va a tocar que seguir como antes Opus 5.5 Extra para orquestador y Opus 5.5 Medio para sesiones y
   subagentes pero todos con Advisor de Fable 5.2 Alto y lo que podemos hacer es depronto tener una sesion de
   Orquestador Senior que tenga Fable 5.2 Alto para cosas especiales que le coloque el orquestador Opus 5.5 Extra
   Alto, que te parece así?" (2026-11-11)
2. "pero tanto los sub agentes como el orquestador deben tener el advisor fable 5.2 alto tambien y ademas debe haber
   un orquestador senior fable 5.2 alto que le manden tareas de ciertas cosas especificas que se requiera mas
   inteligencia o complejidad" (2026-11-12)
3. "vuelve a abrir el JH SR y nunca anides la sesiones ademas de que ya ninguna va con remote control solo el
   Orquestador" (2026-11-15, lead transcript 69918425 line 20757)
4. "necesitamos hacer que el orquestador controle todo" (2026-11-15, line 20853, typed answer to question 305)
5. "has lanzados sesiones que nisiquiera veo pensando que tenemos el tablero desocupado y eso no me gusta ni es
   practico ni funcional nunca debemos permitir eso" (2026-11-15, line 21275)
6. "ademas la sesion orquestadora siempre debe estar en alto y es algo que el harness pueda revisar y cuadrar por
   ejemplo en este momento estamos en medio" (2026-11-16, lead transcript 699d7c29 line 519)

## Tasks
- [x] T1 (kind: design) (1, 2) This document and its double review. Route: inline.
- [ ] T2 (kind: build) (1, 2) `senior-model` and `senior-effort` in the home, with the title contract (`SR`, the
  session-title rule's text) and the probe. Route: inline.
- [ ] T3 (kind: build) (1, 2) The start and the resume: the guard and `sessions start`, starter, one live senior, no
  advisor; an independent verifier after. Route: inline, then one verifier.
- [ ] T4 (kind: build) (1, 2) The reporters' hold by role, and the texts of session-model, session-effort and
  advisor-model. Route: inline.
- [ ] T5 (kind: docs) (2) `bin/lib/lead-protocols.mjs`: when and how the lead sends a senior a task. Route: inline.
- [ ] T6 (kind: build) (3, 4) The lead starts the senior visibly with `start_session`; the guard holds the start and
  the messages to it. Route: inline, then one verifier. Commits: cb830c3e, the D11 fix.
- [ ] T7 (kind: build) (5) The guard refuses `js-harness sessions start` for every title; `rule:sessions-open-in-sidebar`
  drops its exception by `rules change`, his to approve. Route: inline.
- [ ] T8 (kind: build) (6) The lead held to `rule:lead-effort`: a lead whose title drifts off `<code> ORQ · …` keeps
  its role or is named (channel `--address orchestrator` still resolves it, `heldOfRole` does not), and the board,
  the heartbeat and the lead's start say a lead off `rule:lead-effort`, with the act that corrects it (his menu).
  Route: inline.

## Log
- L1 2026-11-12, his words at 93b72703:775 (S2); his "aplica todos los cambios ya" at 93b72703:896.
- L2 2026-11-12, the lead's notes of 10:29 and later: decide inside his words, no question, a lean design; the
  double review found lean too short, and this rewrite follows the findings.
- D1 The code is `SR`, beside `ORQ`: the session's choice.
- D2 No advisor: the home's advisor is Fable 5.2 itself, and an advisor that is the model adds nothing and cannot be
  told from none (`odd/tasks/advisor-home.md`, spec 6); so "todos con Advisor de Fable 5.2 Alto" of S1 does not reach
  the senior.
- D3 Long-lived: S2's "que le manden tareas" is tasks over time, so the lead sends the next one as a message to the
  senior's session, which a resume holds to its rules; the senior does not start sessions.
- D4 Cost: the weekly Fable meter is not read per call, so at most one live senior, and each start is a channel
  notice naming why and the meter before it.
- D6 Scope cut after the role sweep: the lead talks to its senior by the host's messages, and the senior reports to
  the orchestrator, so `roleNamed` does not take SR and no notice is addressed to a senior; this drops `notify --to`
  and `sessions --address` from In scope.
- D7 The senior's rules sit in SENIOR_HOME, apart from CLAUDE_HOME: a switch of the home leaves the senior on its own
  model (his Fable 5.2), so `rules switch` takes no flag for it and `rules change` alone moves it.
- D5 When: the lead's judgment that the task needs more intelligence or complexity is the condition; a design, a
  depth pass of high-risk work or a failure seen twice are examples, not triggers.
- L3 2026-11-15, his words S3 and S4 (lead transcript 69918425): every session visible, started by the lead, none
  nested; the guard's refusal of `start_session` for an SR title was the one thing that kept the senior invisible.
- D8 The guard's other reason, the advisor: `start_session` takes no advisor, and both ways his settings'
  `advisorModel` gives the senior one (D2), so it does not tell the two ways apart; nothing in code answers it.
- D9 The check that runs is `seniorMessageRefusal` (`bin/lib/session-title-guard.mjs`), called by the guard's
  PreToolUse hook on `SendMessage` and `send_message`: a message to a session whose app record is titled SR and holds
  another model or level than `rule:senior-model` and `rule:senior-effort` is refused. The start itself names no
  model (the tool caps one at the caller's, so a named Fable would be silently Opus) and names `rule:senior-effort`;
  its first turn runs on the caller's model, so its brief is only to wait for the lead's first task. A target the
  guard cannot match to a record (a short name, no record) passes: the protocol sends by the `local_…` id. If the
  record's `model` changed only at the next turn, the first message would be refused until a turn ran; the first
  senior start checks it.
- D10 Lead only, fail closed: no caller id, no readable record or a caller not titled as the lead refuses an SR
  start, a title-only offer too, as `seniorStarterRefusal` does for the command. One live senior counts the app's
  records not archived with an SR title of the code, since a `start_session` senior writes nothing to the command's
  record. `use_worktree: false` is refused, since `detach_session` refuses a session that shares a worktree.
- L4 2026-11-15 17:50 local, the lead's note: T7's scope, from S5. 17:55: pause for a machine restart; resume from
  this document's State.
- D11 2026-11-15, Codex's P2 on cb830c3e: a start held only to a non-empty brief let a task run on the lead's model
  before `set_session_model`. The brief is one constant, `SENIOR_WAIT_BRIEF` in `bin/lib/lead-protocols.mjs` (no
  imports, so the guard's load stays light), compared after a trim; the protocol prints it. Not checked: whether the
  app record's `model` changes at `set_session_model` or at the next turn (D9); the first senior start shows it.
- D12 2026-11-15, the resilience lens on cf5bd6f..1fc6100 (WARNING, `bin/guard.mjs:128-142`): the message check passes
  when the app records cannot be read or none carries the target's id. Kept as D9 decided: the check cannot tell a
  senior from a work session without the record, so failing closed would refuse every message the lead sends to any
  `local_…` session while the records are unreadable, stopping the lead's whole channel; what it guards against, one
  task run on the lead's model, costs quality and spend, not security, and the start itself fails closed (D10).
- D13 2026-11-15, the independent verifier (all run against `guardMain` unless marked): an offer, then its
  `proposal_id` start, carried any task, since the later call has no title (fixed: only "user_asked"); a `to` beside
  `send_message`'s `session_id` hid it (fixed: each tool's own field); another project's lead started this code's
  senior (fixed); `target` "cloud", `cwd`, `preset`, `host` and `use_worktree` "false" passed (fixed: a senior starts
  here, in its own worktree). Left open, recorded: two "user_asked" starts in one message both pass before either
  record exists (reasoned; the lead protocol starts one); a session renamed to an ORQ or off an SR title by
  `set_session_title` escapes the title checks, which nothing guards; a lead whose record writes no effort is not
  held to senior-effort (the tool still caps the start at the lead's, and the message check holds the senior's); the
  rule subject of senior-model still names `sessions start` (T7, question 306); a message `to` such as
  `"local_x [ref]"` or one with a leading space passes unmatched (run; whether the app resolves those is unknown).
- L5 2026-11-16, question 306 answered "Sí, quita la excepción (Recomendada)" (tapped, lead transcript 699d7c29 line
  505); his typed words for T7's rule change: 699d7c29 line 402, "ok recuerda que no se puede abrir ninguna sesion en
  segundo plano", and 69918425 line 21275 (spec 5). The lead: T6's PR first, T7 in its own PR, landed only after JH SR
  opens visibly on Fable through T6's path; then T8.
- L6 2026-11-16, the lead's note: T8 from spec 6. Seen tonight: the lead ran at medium titled "JH ORQ orquestador F8"
  (no "·"), and `rules applied` listed no session off the home, since the role comes from the title; after a rename
  it listed the lead "corrected by his menu".
- D14 2026-11-16, the advisor before the PR: `start_session` requires a `background` of 80 characters for a fresh
  start, and it reaches the first turn as the brief does, yet the guard read only `prompt`. It is held the same way to
  one constant, `SENIOR_WAIT_BACKGROUND`, which the protocol prints beside the brief.
