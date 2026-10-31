# JH 115 · lead duties: a check for the report on his return, and the list of duties nothing checks

Locator: `odd/tasks/lead-duty-checks.md` · Engram mirror: `odd/lead-duty-checks/tasks` · Branch: `worktree-lead-duty-checks`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
When he writes to the lead after a long absence, the lead's reply links the status page `js-harness report --html`
wrote since his message, or the reply hook turns it back once with what to run; and every duty of the lead is listed
with what checks it today.

## Why
On 2026-10-31 at 01:33Z he came back after about 7 hours away and the lead gave him the totals in one line, without the
status page `rule:reports-spanish-visual` asks for, until he asked ("en ningun momento me mostraste que tanto
avanzamos"). The duties a check enforces were done that night; the ones only written in the orchestrator skill were
not, and the skill reaches the lead cut after each compaction. A check is what makes a duty act; the list says which
duties have none.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/lead-duty-checks.md` exits 0
- `node --test bin/lib/return-report.test.mjs bin/lib/person-times.test.mjs bin/reply.test.mjs bin/lib/sessions.test.mjs bin/lib/stale-board.test.mjs` exits 0
- the four planted cases of spec 2 in `bin/lib/return-report.test.mjs` failed before the check existed and pass
  after it, both runs quoted in `## Log`
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code
- the question of spec 4 is recorded in the channel, its number in `## Log`

## In scope / Out of scope
- In: `bin/lib/return-report.mjs` and `bin/lib/person-times.mjs` (new) and their tests, `bin/reply.mjs` and its test
  (the hook's wiring), `bin/lib/stale-board.mjs` (the lead test it shares), `bin/lib/sessions.mjs` (two exports of
  `quoteOf`'s rule), `docs/FAILURES.md`, `docs/sessions/`.
- Out: the checks the list proposes (each a later brief, by his answer to the question); `~/.claude`, `~/.codex`,
  credentials, gentle-ai config.

## Constraints
- The person's messages are read by `quoteOf`'s one rule (`personAtOf`), never a second copy — because two copies of
  whose words an entry is would drift.
- The threshold is a constant in code with the reason for its value — because the brief asks it.
- Tests first, each planted case red before the check — because the brief asks it.
- Hooks are delivery (Task Size high risk, item 5): Codex and the Claude lenses on the code slice and an independent
  verifier after its own checks.

## Ask me before
Nothing here is his but the question of spec 4: it goes to the lead as a recorded question
(`js-harness notify --to orchestrator --kind question`, JSON, in Spanish).

## Specs
1. His decision, question 133 (`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f 38165`, answered
   2026-10-31T01:50:46Z): "Sí, ábrela". His words before it: "en ningun momento me mostraste que tanto avanzamos"
   (line 38011) and "por que olvidas tanto tus deberes?" (line 38126).
2. The brief: "A check in the reply hook (`bin/lib/reply.mjs`, where the live-board check already lives; read how that
   one decides and write as it does): when the user's latest message in the lead's transcript comes after an absence
   longer than a threshold (a constant in code, with the reason for its value), the lead's reply must link the page
   `js-harness report --html` wrote since that message, or the hook turns it back once with what to run. Tests first:
   a planted return without the page is turned back; one with the page passes; a message after a short gap is not
   touched; a work session's reply is not touched."
3. The brief: "The list: read the orchestrator skill (the source the harness ships, `js-harness rules`, and
   `bin/lib/protocols-skill.mjs`) and list every duty of the lead with what checks it today (a hook, a command, a test)
   or "nothing". Put it in the feature document". The board's `board/summary` miss goes first, with a proposed check.
4. The brief: "give the lead one recorded question (`js-harness notify --to orchestrator --kind question`, JSON, Spanish
   text) proposing which unchecked duties get a check next, in order of how often they failed (`js-harness failures`
   holds the record)."
5. The brief: "Write the `- Seen:` line for this miss into `docs/FAILURES.md` under the class it fits (search
   `js-harness failures` first; `told-him-unverified` or a reporting class may already hold it), with the check of step
   1 as its control."
6. The brief: "Ready notice with --pr per slice; summary under docs/sessions/."

## Tasks
- [x] T1 (kind: build) spec 2: the return check, tests first, the planted cases red then green — commits: `ceb2f3e8`
- [x] T2 (kind: docs) spec 3: the list of the lead's duties and what checks each — commits: this document's
- [x] T3 (kind: docs) spec 5: the `- Seen:` line and its control — commits: this document's
- [ ] T4 (kind: verify) spec 6: Codex, the lenses, an independent verifier, the PR and its ready notice — in progress
- [x] T5 (kind: docs) spec 4: the recorded question to the lead — question 135
- [ ] T6 (kind: docs) spec 6: the summary under `docs/sessions/` and the closed notice — pending

## The lead's duties and what checks each (T2)

Read from the orchestrator skill's source (`orchestratorSkillContent`, `bin/lib/manifest.mjs`, "manifest" below), the
lead's lines of the protocols skill (`bin/lib/protocols-skill.mjs`, "protocols"), `js-harness rules` and
`bin/lib/rules-coverage-data.mjs`, by one read-only explorer on 2026-10-31; each "checked by" is a `path:line` of the
enforcing code it read, never a run. "Text only" is a test that only finds the skill's words. Every hook here reminds
after the reply is shown (`bin/reply.mjs:3-5`); none refuses before. Checked by this session: row 1, against
`docs/live-board.html:512-518` and `bin/sessions-live.mjs:218-220`; row 2, by its own tests. Counts are sightings in
`docs/FAILURES.md` (`js-harness failures`, 2026-10-31).

| # | Duty | Written at | Checked by | Failures |
|---|---|---|---|---|
| 1 | Keep `board/summary` (`now`, `status`, `route`, `yours`, links) current | manifest:146 | Nothing. The page's freshness reads only the newest row and the `checked` stamp (`docs/live-board.html:512-518`); `sessions live --out` prints the stamp alone as the summary's update (`bin/sessions-live.mjs:218-220`); the stale-board hook counts rows only (`bin/lib/stale-board.mjs`) | `board-summary-stale` (1, this miss) |
| 2 | On his return after an absence, show the status page `report --html` writes | protocols:103 (`rule:reports-spanish-visual`) | Check, this feature: `bin/lib/return-report.mjs` in the reply hook | `return-without-report` (1, this miss) |
| 3 | A background task says what it is for and what ends it, and stops when that resolves | manifest:120 | Partly: `loop run` refuses a loop with no `--purpose` or `--until` (`bin/loop.mjs:127-128`); resume names work in flight (`bin/resume.mjs:585-590`) | none recorded |
| 4 | Change the roadmap only through small documentation pull requests | manifest:123 | Partly: pre-push refuses main pushed by hand (`.githooks/pre-push:11-15`) | none recorded |
| 5 | Every question through the question tool, one a call, recommended option first | manifest:132 | Check: the template gate (`bin/lib/template-gate.mjs:140-147`, `bin/lib/template-question.mjs:38-51`); a question in prose is not caught | `block-read-as-task` (1) |
| 6 | A question opens with what it is for | manifest:134 | Nothing (`bin/lib/channel.mjs:206-217` checks the line, the number and the options); text only: `bin/lib/manifest.test.mjs:3156` | none recorded |
| 7 | Recorded with `notify --kind question` before it is asked | manifest:135 | Check: `bin/lib/template-question.mjs:44`, `bin/lib/channel.mjs:208` | `question-numbered-by-hand` (1) |
| 8 | Ask at once only when he wrote a short while ago; otherwise say how many wait | manifest:136 | Nothing: the rule is printed (`bin/lib/sessions.mjs:2910`) | `question-tool-holds-asker` (1) |
| 9 | Record his answer with `--transcript`/`--line` and ring the asker | manifest:137 | Check: `bin/notify.mjs:167-183`; the board flags an answer not carried (`bin/lib/sessions.mjs:2715`) | `answer-line-wrong-entry` (2) |
| 10 | Bring a session held on a card to him in the same turn | manifest:138 | Board flag only (`bin/lib/sessions.mjs:2511`) | `permission-prompt-unseen` (1) |
| 11 | Take the permit lease, renew it, turn it off before relief | manifest:139 | Partly: `wait --notice-to orchestrator` renews it (`bin/wait.mjs:290-313`) | none recorded |
| 12 | Answer permit cards in time; his cards go to him | manifest:139 | Fallback only: a card reaches him after its wait (`bin/permit.mjs:8-11`) | none recorded |
| 13 | A plan or design question has passed its double review | manifest:140; protocols:42 | Text only: `bin/lib/protocols-skill.test.mjs:126-135` (the register calls it a check) | `proposal-unreviewed` (2) |
| 14 | At each wake send the board's rows, with `sesion`/`texto`, then `--sent` | manifest:146 | Partly: the stale-board hook, rows waiting past one check (`bin/lib/stale-board.mjs:69-102`) | none recorded (the 121 rows of 2026-10-28 are cited in the module only) |
| 15 | `sessions live --out --resting` before the resting wait | manifest:146 | Nothing | none recorded |
| 16 | Point every reply to the board's link | manifest:146 | Nothing; text only: `bin/lib/manifest.test.mjs:3013` | none recorded |
| 17 | Keep `sessions --watch` running, relaunch it on each return | manifest:147 | Nothing for the lead: the wake check is for work sessions (`bin/lib/stop-wake.mjs:122-123`) | `missed-wake` (1) |
| 18 | Resting: stop timed watches, wait with one `wait --notice-to orchestrator` | manifest:148 | Nothing | none recorded |
| 19 | Act on the heartbeat's `STALLED:`, `WINDOWS:`, `DUE:` lines | manifest:146 | The flags exist (`bin/loop.mjs:360`, `bin/lib/windows-daily.mjs:99`, `bin/lib/throughput.mjs:569`); acting is not checked | none recorded |
| 20 | Loops through `loop run --purpose --until` | manifest:150 | Check: `bin/loop.mjs:127-128` | none recorded |
| 21 | Act inside the charter; ask before what it does not name | manifest:153 | Nothing | none recorded |
| 22 | Never implement, commit or write in a worktree | manifest:154 | Nothing for the lead's role (`bin/guard.mjs:114-168`); `rules change` held by `check --door` (`bin/check.mjs:1756`) | none recorded |
| 23 | Never answer a question for him | manifest:154 | Check: `bin/notify.mjs:169` | `answer-line-wrong-entry` (2) |
| 24 | Never write another session's prompts; openings via `notify --opening` | manifest:155 | Partly: `bin/notify.mjs:425-447`; a `SendMessage` with content passes | `opening-pasted-no-line` (6) |
| 25 | Open sessions with `start_session` or `sessions start`, never Routines or the cloud | manifest:155 | Check: `bin/lib/guard.mjs:53-59`, `:75`; `bin/sessions-background.mjs:145-146` | `session-opened-unseen` (1) |
| 26 | Title `<code> <n> · <purpose>` with the number from `--next-number` | manifest:155 | Check of the shape (`bin/lib/session-title-guard.mjs:19-25`); the number is not | `session-title-not-role` (3) |
| 27 | Land through `merge-queue --land`, `--dry-run` first | manifest:156 | Partly: the queue's own refusals (`bin/merge-queue.mjs:7`, `:46`); the dry run and a pending step of his are not | `land-took-pending-pr` (1) |
| 28 | `--refresh-copy` after a land that moved main | manifest:156 | Flag: `doctor --hook` (`bin/doctor.mjs:519-520`) | `installed-copy-stale` (1) |
| 29 | A hand merge waits for CI on today's base and names the run | manifest:157 | Nothing | `reopen-tested-old-base` (1) |
| 30 | Documentation merge on a clean `merge-tree`, the gate's proof with no CI | manifest:158-159 | Nothing | none recorded |
| 31 | Before he leaves: every wait declared, no session ended its turn waiting, the watch runs; say so | manifest:160 | Partly: the wake check for work sessions (`bin/lib/stop-wake.mjs:106-139`) | `session-never-woken` (2); `turn-ended-waiting` (3) |
| 32 | While he is away, `quiet --wait` runs and a push notification ends it | manifest:160 | Nothing; text only: `bin/lib/manifest.test.mjs:3109` | none recorded |
| 33 | Route each request of his and note it in the relief file | manifest:162-165 | Nothing | none recorded |
| 34 | Carry teaching notices (`## Advice mode`) | manifest:167 | Nothing | none recorded |
| 35 | Interrupt him only on the seven events; per session say send, wait or drop | manifest:169-177 | Board flags three of the seven (`bin/lib/sessions.mjs:2481-2486`, `:2581`, `:2501`) | `stale-prompts-sent` (1) |
| 36 | Status report: `report --mark`, six sections, a table a section | manifest:181-192 | Partly: a hand-made page is refused (`bin/lib/template-gate.mjs:109-127`); its content is tested (`bin/lib/report-status.test.mjs:18`); running it when he asks is not | `status-report-without-facts` (2) |
| 37 | Restart: pause each session, relief, loops off, `lease --off`, then the line in capitals | manifest:196-199 | Nothing; text only: `bin/lib/manifest.test.mjs:3200` | none recorded |
| 38 | After a restart: `wake --notify`, lease, loops, resume, Remote Control, doctor | manifest:200 | Partly: `--host-reviewed` (`bin/lib/host-update.mjs:182-192`) | `host-review-without-research` (1) |
| 39 | Recap: each session with its effort mode and why | manifest:205 | Nothing; text only: `bin/lib/manifest.test.mjs:3221` | none recorded |
| 40 | Recap: sessions to archive and stopped ones, by title | manifest:206 | Board flag only (`bin/lib/sessions.mjs:3157`) | none recorded |
| 41 | Recap: the Codex meter, read then | manifest:207 | Nothing | none recorded |
| 42 | Recap: what waits on him, only after reading that session now | manifest:208 | Nothing | `told-him-unverified` (12, one of them) |
| 43 | Recap: name the session to return to | manifest:209 | Partly: a finished close names it (`bin/lib/reply.mjs:176`) | none recorded |
| 44 | While he is away: ask nothing; "away" and the time in the relief file | manifest:211 | Nothing | none recorded |
| 45 | Before he leaves, open a stretch and show its departure; on return close it and show its return | manifest:211 | Partly: a hand-made page is refused; a moment page never shown is not counted (`bin/template.mjs:341-349`) | `stretch-not-opened` (1) |
| 46 | While away: a block given once; replies close working or in that cut | manifest:212 | Nothing | none recorded |
| 47 | Relief file: a dated line per event, the first naming his id, never rewritten | manifest:215-216 | Partly: `notify --relief` stamps the clock (`bin/lib/channel.mjs:445-453`) | `hours-guessed` (9) |
| 48 | At the context pause, write state and keep working | manifest:219 | Check/flag: the pause notice (`bin/lib/hook-entries.mjs:44-48`), resume (`bin/resume.mjs:537-549`), `guard --stop` (`bin/guard.mjs:208-221`) | `context-fills-unnoticed` (4) |
| 49 | Never hand him a compaction command or a resume prompt | manifest:220 | Partly: an untested shell block is turned back (`bin/lib/reply-commands.mjs:273`); `/compact` in prose passes | `turn-ended-waiting` (3) |
| 50 | The fixed opening prompt only when asked | manifest:221-225 | Text only: `bin/lib/manifest.test.mjs:3025` | none recorded |
| 51 | New lead: read rules, relief, board, last reply; say you lead; archive the old one | manifest:227 | Partly: two leads flagged (`bin/lib/sessions.mjs:3150`); resume names the relief file (`bin/resume.mjs:918-922`) | none recorded |
| 52 | Archive finished sessions without asking; ask for a missing summary | manifest:227 | Board flag only (`bin/lib/sessions.mjs:3157`, `:3166`) | none recorded |
| 53 | The relieved lead sends `notify --kind relieved` | manifest:228 | Nothing (counted only, `bin/lib/measures.mjs:227-231`) | none recorded |
| 54 | First lead: the relief file's first line and the charter asked | manifest:229 | Text only: `bin/lib/manifest.test.mjs:4297` | none recorded |
| 55 | After a compaction, do what a new lead does | manifest:230 | Partly: resume (`bin/resume.mjs:447`, `:967`) | none recorded |
| 56 | `loop status` at start and after a compaction; restart your own, never another's | manifest:231 | Partly: another's loop refused without `--take-over` (`bin/loop.mjs:161`) | none recorded |
| 57 | Rotation: start the new lead on his typed turn, detach, never fork | manifest:233-237 | Partly: a fork with no effort refused (`bin/lib/guard.mjs:67-75`) | none recorded |
| 58 | Before a reinstall: `backup ready`, the checklist, the pause, the restore order | manifest:241-246 | Partly: `backup ready` prints `missing:` (`bin/backup.mjs:761-782`) | none recorded |
| 59 | Ask only what is his; decide the rest and say its cost | protocols:36 | Nothing | `asked-yes-not-his` (2) |
| 60 | Before a question, say what a yes covers and the other option | protocols:38 | Nothing | none recorded |
| 61 | One decision a question, never while work runs | protocols:39 | Partly: a decision close refused while tasks run (`bin/lib/reply.mjs:178`) | none recorded |
| 62 | A repeated question says the earlier answer holds; an ambiguous short answer is asked about | protocols:40-41 | Nothing | none recorded |
| 63 | Every reply ends in one of five states | protocols:48 | Check: `bin/lib/reply.mjs:154-183` via `bin/reply.mjs` | `stale-prompts-sent` (1) |
| 64 | Text he copies: one block under the three labels | protocols:49 | Check: `bin/lib/reply.mjs:186-197`; `bin/lib/reply-commands.mjs:273` | `two-blocks-out-of-order` (1); `command-handed-untested` (2) |
| 65 | Before a decision or a cut: done, next, why, which session; then the map | protocols:50-51 | Nothing | none recorded |
| 66 | Say how many runs and what each costs; one try, no loop | protocols:58-59 | Nothing | none recorded |
| 67 | Read the proof before the command; `&&`, never `;` | protocols:60 | Nothing (`bin/lib/guard.mjs:358` splits, for the review base only) | `chained-step-not-conditional` (10) |
| 68 | Change a rule only with `rules change` on a `rule/` branch | protocols:74 | Check: `bin/check.mjs:1756`; `rules check` | `old-rule-beside-new` (2) |
| 69 | Pages come from commands; a template request becomes `template new` | protocols:72, :103 | Partly: hand-made pages refused (`bin/lib/template-gate.mjs:109-127`) | `hand-made-output` (2) |
| 70 | A mistake in five parts with a `- Seen:` line | protocols:84-91 | Partly: `failures check` holds the form | none recorded |
| 71 | Reports: bad news first; not checked and failed always said | protocols:97, :100 | Nothing | none recorded |
| 72 | Each claim checked, assumed or not known; an estimate says so | protocols:98 | Partly: the context share only (`bin/guard.mjs:208-221`) | `estimate-passed-as-fact` (6) |
| 73 | Check one thing of another session's claim before telling or building on it | protocols:99 | Nothing: measured not worth building (`odd/tasks/honesty-audit.md`, 2026-10-15) | `told-him-unverified` (12); `checked-not-read` (6) |
| 74 | Sub-agents on the rules' model and effort | protocols:101 | Check of the model (`bin/lib/guard.mjs:29`) | none recorded |
| 75 | The throughput review when due, recorded | protocols:110-112 | The trigger repeats until recorded (`bin/lib/throughput.mjs:569`) | none recorded |

Of 75 duties, 12 have a check, about 30 a partial check or a board flag, and about 33 nothing or text only. Two
records misname their own coverage, found by the explorer and not changed here: `proposal-unreviewed`'s control in
`docs/FAILURES.md` names a phrase test as a check, and `bin/lib/rules-coverage-data.mjs` marks `live-board` and
`reply-five-states` as owed though the reply hook acts on them.

The unchecked duties, most failed first, each with the check proposed (spec 4's question carries the first ones):
1. Row 73 (and 42): a claim told unverified, 18 sightings; measured not worth building as a general audit on
   2026-10-15. Proposed: the reply hook turns back a lead reply that calls a pull request merged or a session closed
   when no notice or `origin/main` commit holds it.
2. Row 67: `&&`, never `;`, 10 sightings, its control a protocol line. Proposed: the guard refuses a `;` or a newline
   before `git push`, `git commit`, `gh pr`, `merge-queue` or `notify`.
3. Row 72: an estimate stated as a fact, 6 sightings. Proposed: `guard --stop` reads stated durations and forecasts
   as it reads the context share.
4. Row 1: `board/summary` stale, 1 sighting (this one, two days). Proposed: the stale-board hook warns once when the
   newest notice the summary describes is newer than the summary's last update carrying `now` or `status`, which the
   template gate's after-call hook can record from the `ArtifactData` call.
5. Row 59: asked what was not his, 2. Proposed: a recorded question names its item of `rule:owner-decisions`.
6. Row 13: a plan question not reviewed, 2. Proposed: the template gate refuses the question when its document's log
   has no two reader findings.
7. Row 36: no report when he asks how it goes, 2. Proposed: the reply hook, as the return check, on his "cómo vamos".
8. Rows 45, 8, 17, 27, 10: one sighting each (no stretch at his leaving, a question tool held, a missed wake, a land of
   a pending pull request, a card not brought).

## Log
- L1 (2026-10-31, the lead's brief JH 115, `C:\Users\Oficina\.js-harness\background\briefs\2026-10-31T01-55-03-340Z-7f5ced41.md`):
  "JH 115 · lead duties: a check for the report on his return, and the list of duties nothing checks", with the
  three steps quoted in the specs.
- L2 (2026-10-31, design of T1, searched first): the live-board check is `bin/lib/stale-board.mjs`, called from
  `bin/reply.mjs` (not `bin/lib/reply.mjs`, which judges the close alone); the return check is a module beside it,
  wired the same way, sharing its test of who the lead is (`isLeadTitle` on the newest notice the session sent). His
  messages are `personAtOf`'s rule (`bin/lib/sessions.mjs`, `quoteOf`), so a tapped answer counts as his. The page
  `report --html` wrote is a `status-report` line of the rendered record (`bin/lib/template-record.mjs`,
  `templates-rendered.jsonl`), with its path; it is linked when a reply since his message holds the URL of the
  `Artifact` call that published that path (the lead's line 38120 did: `https://claude.ai/artifact/6F8gsniNEjw4gUzwDf4f6e`
  from the call at 38106 and its result at 38111). Searched: codegraph and `grep` for `personAtOf`, `stale-board`,
  `recordPageRendered`, `templates-shown`; `js-harness rules` for `reports-spanish-visual` (protocol level, no check).
- L3 (2026-10-31, the threshold): `ABSENCE_MS` is 2 hours. In the four largest lead transcripts, 40 of 311 gaps
  between his messages are longer than 2 hours (58 longer than 1 hour, 29 longer than 3): about one or two a day,
  so the page costs one report run per such return. In the 16 hours to 01:46Z 27 pull requests landed, so after 2
  hours away about three have, and a line of totals no longer says what changed. The return of 2026-10-31 is the gap
  of 6.65 hours ending at 01:33:48Z.
- L4 (2026-10-31, a change from the brief's words, with its evidence): the brief reads the return as "the user's
  latest message ... after an absence". Replayed on the lead's transcript cut before its first reply (line 37935,
  01:43:11Z), that reading lets the real miss through: after "ya llegue" (01:33:48Z) he wrote three short messages
  (01:34:51Z, 01:42:11Z, 01:42:44Z), so his latest came after a gap of 33 s. The check reads his newest message whose
  gap to the one before is longer than the threshold (`lastReturn`), and stays on until a reply since it links the
  page or it has warned once for that return. A cost of that reading: a return never linked and never warned, as at
  the install, is warned once whatever its age; the lead's newest return (01:33:48Z) was linked at 01:47:49Z.
- L5 (2026-10-31, T1 evidence): red before the module, `node --test bin/lib/return-report.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND ... return-report.mjs`; green after, 14 of 14. `bin/reply.test.mjs` 28 of 28, with the hook's
  case of a return, a short gap and a work session. Replayed on the real transcript (scratch script, read only, his
  real records): cut at line 37934 with the reply of line 37935, the warning "he came back after 6.7 hours away (his
  message at 01:33 UTC, the one before at 18:54 UTC)"; cut at 38119 with the reply of 38120, which links the page,
  `null`. The fast read of his times equals the whole parse on five real transcripts (436 messages). The whole hook on
  the 59 MB lead transcript took 1.40 s on the branch and 1.79 s installed (one run each; the hook's timeout is 5 s).
  `sessions.mjs` may not grow (`bin/conventions-structure.test.mjs`, ceiling 3424), so the fast read is
  `bin/lib/person-times.mjs`, and `sessions.mjs` only exports `quoteEntry` and `questionCallsOf`, the rule it already
  had. A test caught a bug before the commit: a line's head of 256 characters ran into the next line, so a short line
  before a host record was dropped; the head now ends with its line.
- L6 (2026-10-31, T2): the list above, from one read-only explorer (`general-purpose`, 87 tool calls); this session
  checked its row 1 in the code before writing it.
- L7 (2026-10-31, T3): searched `js-harness failures` and `docs/FAILURES.md` for `told-him-unverified`,
  `status-report-without-facts`, `stretch-not-opened`, `hand-made-output`, "report", "page", "return", "summary";
  none holds a page not shown on his return, so two entries: `return-without-report` (`rule-not-acting`, controlled
  by the check of T1) and `board-summary-stale` (`unseen-state`, once, no control yet: row 1's proposal).
  `node bin/js-harness.mjs failures check` exits 0 (128 failures, 299 sightings).
- L8 (2026-10-31, reviews of `1f19c04..767b6b5`): Claude lenses reliability, resilience, readability: 0 findings
  each. Codex: part 2 correct (0.9); part 1 incorrect (0.95), two P2 findings, both real and fixed in the next commit,
  tests first (red 2 of 16, then 16 of 16): (1) a page published through the call's `files` (map, list, `root`, a
  relative path) was not recognized — the check now reads a call's files by the template gate's `pageTarget`,
  relative ones under the call's `cwd`; (2) a publish older than the render it would carry was accepted when the
  path was rendered again later — a publish now counts only after a render of its file since the return. The real
  replay still warns at line 37935 and passes at 38120. The independent verifier is running.
- L9 (2026-10-31, T5): question 135 recorded for the lead ("Los tres primeros (Recomendado)" | "Solo el del tablero" |
  "Los tres y afirmaciones" | "Ninguno por ahora"); nothing of JH 115 waits on it.

## Next step
Commit the Codex fix; read the verifier's findings and fix the real ones, tests first; run `codex-review` and
`lens-review` again from `767b6b5c`; push, open the PR, `notify --kind ready --pr <n>`; the summary under
`docs/sessions/` and `notify --kind closed --summary`.
