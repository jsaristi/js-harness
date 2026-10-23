# Launch audit, stage 3: the instruction audit (N rows)
Read 36 repository files (most in part, by the lines cited), the 29 auto-memory notes and the user's global `~/.claude/CLAUDE.md` (for the stack's texts); sha `f45e78c2283ede14fb01c611bb23954e5d0fe4ad` (its only change from `fb9108c0` is `odd/tasks/launch-audit.md`, so every instruction text is the bytes of `fb9108c0`).

`memory/` below is `~\.claude\projects\D--js-harness\memory\`, read only. `CLAUDE.md` is `~\.claude\CLAUDE.md`, the gentle-ai/engram/codegraph text of the stack: reported, never edited.

## Directives

Every order js-harness gives a model, one row each, in under 15 words. Pure descriptions of a command (what it prints) are left out; the order a description carries is kept.

### AGENTS.md (loaded every turn)
| Source | Directive |
|---|---|
| AGENTS.md:12 | What a command can check belongs in `bin/`, not in prose. |
| AGENTS.md:18-21 | `npm run check` is the single gate; a red check means not ready. |
| AGENTS.md:23 | A session starts at `docs/ROADMAP.md`. |
| AGENTS.md:25-26 | Read the feature document before resuming; it and the roadmap are the handoff. |
| AGENTS.md:28 | A new feature document opens with the task contract. |
| AGENTS.md:34 | A behavior change arrives with its test, written first. |
| AGENTS.md:34-36 | A claim carries evidence: `path:line`, or the command and its output. |
| AGENTS.md:36-37 | A claim of absence names its search and why it could find it. |
| AGENTS.md:39-40 | What the harness writes outside the repo is recorded to be undone exactly. |
| AGENTS.md:44-46 | The three earlier-attempt folders are read-only; never build on them. |
| AGENTS.md:50 | Ask him spend, irreversible, product choices: one at a time, and wait. |
| AGENTS.md:51-53 | Run gentle-ai's `granted` consent invocation without asking. |
| AGENTS.md:54-55 | No `granted` choice, or an envelope that does not parse: ask him. |
| AGENTS.md:55-57 | A candidate is a commit or slice; a branch offer gets read-only status only. |
| AGENTS.md:57-59 | After gentle-ai approves a code slice, run `js-harness codex-review --base`. |
| AGENTS.md:59-60 | Treat Codex's findings like gentle-ai's. |
| AGENTS.md:60-61 | Codex cannot run: report it, record `--unavailable <reason>`. |
| AGENTS.md:63-64 | Keep moving: name the next units and do them without reporting between. |
| AGENTS.md:64-65 | Reports open with a plain summary, close with a recap and the spend. |
| AGENTS.md:66-67 | Check a step he reports doing outside before building on it. |
| AGENTS.md:69 | A session holds one feature. |
| AGENTS.md:70-71 | Write every decision to roadmap or feature document, committed that session. |
| AGENTS.md:72-73 | While he is here, say when to cut. |
| AGENTS.md:73-76 | Near 88%, write state and keep working; resume checked against the document. |
| AGENTS.md:76-77 | A stopped session gets its next prompt from the orchestrator, never him. |
| AGENTS.md:77-79 | End each reply with one of five states. |
| AGENTS.md:79-80 | A step he would only say yes to: state its cost, go on. |
| AGENTS.md:80 | The orchestrator asks a decision with the question tool. |
| AGENTS.md:80-82 | A cut: one code block of only his text, under what, where, effect. |
| AGENTS.md:82-83 | Before a cut: what was done, what is next, why, which session. |
| AGENTS.md:83-84 | Then the map from `js-harness progress`; if it fails, say so. |
| AGENTS.md:86-87 | Artifacts in English; Conventional Commits with a body saying why. |

### The `AGENTS.md` block `js-harness init` writes into every project (bin/lib/project.mjs)
| Source | Directive |
|---|---|
| bin/lib/project.mjs:417-420 | No shortcut; a rule is recorded only with a place in a check, file, protocol. |
| bin/lib/project.mjs:422-423 | A behavior change arrives with its test, written first; a finding with evidence. |
| bin/lib/project.mjs:424-425 | Codex review off: gentle-ai reviews every medium or high risk change. |
| bin/lib/project.mjs:427-429 | Claims checked, assumed or not known; check reported work; say what failed. |
| bin/lib/project.mjs:432-435 | Owner decides seven kinds of things; ask one at a time, never while work runs. |
| bin/lib/project.mjs:437-439 | The owner's wording is the need: say what you would do differently. |
| bin/lib/project.mjs:441-444 | Plans, designs, analyses, protocols pass two readers before the owner. |
| bin/lib/project.mjs:446-449 | A reply ends with one of five states. |
| bin/lib/project.mjs:381 | A constraint the gate holds gets an id in `docs/rules.json`. |

### Skill `js-harness` (bin/lib/manifest.mjs:19-87)
| Source | Directive |
|---|---|
| bin/lib/manifest.mjs:41 | Run `js-harness wait` in the background; stop it with TaskStop; check no node left. |
| bin/lib/manifest.mjs:43 | Turned back by `guard --stop`: correct the share in one line from get_usage. |
| bin/lib/manifest.mjs:45 | Turned back by `reply --hook`: write the close again. |
| bin/lib/manifest.mjs:53-54 | A rule belongs in a check, an `AGENTS.md` line or a protocol, not memory. |
| bin/lib/manifest.mjs:56-57 | Run a memory pass at a task boundary, never while a gate runs. |
| bin/lib/manifest.mjs:58-59 | `memory plan` names the files; edit only those. |
| bin/lib/manifest.mjs:60-62 | Alone: shorten index lines to 150, add missing ones, drop dead ones. |
| bin/lib/manifest.mjs:62-64 | A rule note leaves only after his words are in the repo; never delete alone. |
| bin/lib/manifest.mjs:64-65 | A contradiction his newer dated words settle is settled, told in the recap. |
| bin/lib/manifest.mjs:66-68 | `memory verify`; on refusal fix and verify again, or `memory undo`. |
| bin/lib/manifest.mjs:69 | Report index bytes before and after, checked, unchecked, waiting. |
| bin/lib/manifest.mjs:70 | Withdraw the hygiene protocol after six passes with only the clock due. |
| bin/lib/manifest.mjs:78-79 | Engram failed: read `RECENT.md`'s head first, then entries by line; never edit. |
| bin/lib/manifest.mjs:80-81 | Clone gone: find the private repo with `gh`, read the file with `gh api`. |
| bin/lib/manifest.mjs:82 | Tell the user Engram is down before work depending on past decisions. |
| bin/lib/manifest.mjs:83-85 | Restore with `backup restore --merge`; never `backup run --allow-shrink` after a wipe. |

### Skill `js-harness-orchestrator` (bin/lib/manifest.mjs:92-245; bin/lib/lead-prompt.mjs:4)
| Source | Directive |
|---|---|
| bin/lib/manifest.mjs:100 | Follow the part of the skill that is yours: lead or work session. |
| bin/lib/manifest.mjs:102 | A background task declares purpose, end and stopper; stop it once resolved. |
| bin/lib/manifest.mjs:104-110 | A change exists only in a file; each kind of record has its place. |
| bin/lib/manifest.mjs:109 | Read a rule in `js-harness rules`, not in the relief file. |
| bin/lib/manifest.mjs:114 | Every question goes through the orchestrator's question tool, one a call. |
| bin/lib/manifest.mjs:116 | A question opens with the work it serves and what its answer changes. |
| bin/lib/manifest.mjs:117 | Record a question with `notify --kind question` before asking it. |
| bin/lib/manifest.mjs:118 | Call the question tool at once only if the user wrote recently. |
| bin/lib/manifest.mjs:119 | Record the answer with `--kind answer`, its transcript and line. |
| bin/lib/manifest.mjs:120 | Bring a session held on a card to the user that turn. |
| bin/lib/manifest.mjs:121 | Lead holds the permit lease; allows own-work cards; brings the user's cards to them. |
| bin/lib/manifest.mjs:122 | A plan or design put to the user passed its double review. |
| bin/lib/manifest.mjs:128-132 | The lead runs the board, its watch, progress and owned loops. |
| bin/lib/manifest.mjs:129 | A watch that returns "nothing changed": relaunch, say nothing. |
| bin/lib/manifest.mjs:130 | Resting: stop timed watches; one `wait --notice-to orchestrator` (ends after 8 hours). |
| bin/lib/manifest.mjs:135 | Act inside the relief file's charter; ask before anything it does not name. |
| bin/lib/manifest.mjs:136 | The lead never implements, commits, writes in a worktree, or answers for him. |
| bin/lib/manifest.mjs:137 | Write no other session's prompts but openings; titles `<code> <n> · <purpose>`. |
| bin/lib/manifest.mjs:138 | Land ready pull requests with `merge-queue --land`, `--dry-run` first. |
| bin/lib/manifest.mjs:139 | Merge code on a green CI run of the merge with today's base. |
| bin/lib/manifest.mjs:140 | Documentation-only pull requests merge without CI when merge-tree is clean. |
| bin/lib/manifest.mjs:141 | No CI: check the gate proved the tree the merge produces. |
| bin/lib/manifest.mjs:142 | Before the user leaves: waits declared, none ended waiting, own watch runs. |
| bin/lib/manifest.mjs:144-147 | Place each request: open session, new session; note it in the relief file. |
| bin/lib/manifest.mjs:149 | Advice mode: show the teaching text unchanged; carry teaching changes at once. |
| bin/lib/manifest.mjs:151-159 | Interrupt the user only in seven named cases. |
| bin/lib/manifest.mjs:163-174 | Status report: `report --mark`, six sections as tables, user's language. |
| bin/lib/manifest.mjs:178-182 | Restart: pause sessions first, then the capitals line, then resume them. |
| bin/lib/manifest.mjs:186-191 | The recap carries sessions, archive list, Codex meter, waits, endings. |
| bin/lib/manifest.mjs:193 | Before the user leaves, ask for everything the stretch will need. |
| bin/lib/manifest.mjs:194 | While the user is away, give a waiting block once. |
| bin/lib/manifest.mjs:197-198 | Append one dated relief-file line per event; never rewrite it. |
| bin/lib/manifest.mjs:201 | Read your own board row; at the pause write state to the relief file. |
| bin/lib/manifest.mjs:202 | Never hand the user a compaction command or a resume prompt. |
| bin/lib/manifest.mjs:203 | Give the lead's opening prompt only when the user asks. |
| bin/lib/manifest.mjs:209 | A new lead reads rules, relief, board; archives old lead and finished sessions unasked. |
| bin/lib/manifest.mjs:210 | A relieved lead sends `notify --kind relieved`. |
| bin/lib/manifest.mjs:211 | The first lead asks the user for the charter. |
| bin/lib/manifest.mjs:212 | After a compaction do what a new lead does. |
| bin/lib/manifest.mjs:213 | Restart your own loops after a compaction; never touch another's. |
| bin/lib/manifest.mjs:216-219 | Rotate a lead by the session tool in a user's turn; never fork. |
| bin/lib/manifest.mjs:223-228 | Before a reinstall: `backup ready`, the private checklist, pause, then the order. |
| bin/lib/manifest.mjs:232 | Give prompts only for yourself; a prompt for another names it. |
| bin/lib/manifest.mjs:233 | Commit with a plain `git commit`; whole test runs through `js-harness gate --`. |
| bin/lib/manifest.mjs:234 | Push in the same step your last check passes. |
| bin/lib/manifest.mjs:235 | Nothing heavy beside a gate but a quote and a test file under 30 s. |
| bin/lib/manifest.mjs:236 | With an orchestrator, ask the user nothing: record the question and ring it. |
| bin/lib/manifest.mjs:237 | Advice mode: teach at the recorded level, naming the area's ADR. |
| bin/lib/manifest.mjs:238 | Refused or stopped by the user: tell the orchestrator what you need. |
| bin/lib/manifest.mjs:239 | A plan change goes into your feature document, committed. |
| bin/lib/manifest.mjs:240 | A ready pull request: `notify --kind ready --pr`. |
| bin/lib/manifest.mjs:241 | Finished: write the summary, commit, push, `notify --kind closed`. |
| bin/lib/manifest.mjs:242 | Free with nothing handed: `notify --kind waiting`. |
| bin/lib/manifest.mjs:243 | Not finished while your background work runs. |
| bin/lib/manifest.mjs:244 | Never end a turn waiting; write state, start `js-harness wait`. |
| bin/lib/lead-prompt.mjs:4 | A new lead follows the orchestrator skill and takes over. |

### Skill `js-harness-protocols` (bin/lib/protocols-skill.mjs)
| Source | Directive |
|---|---|
| bin/lib/protocols-skill.mjs:30 | Withdraw an unused section whose incident did not return; propose missing ones. |
| bin/lib/protocols-skill.mjs:36 | Ask only what is the user's; decide the rest, say its cost, go on. |
| bin/lib/protocols-skill.mjs:37 | Before a question, say what yes covers and what the other option means. |
| bin/lib/protocols-skill.mjs:38 | One decision a question, one at a time, never while work runs. |
| bin/lib/protocols-skill.mjs:39 | A repeated question says the earlier answer holds and what changed. |
| bin/lib/protocols-skill.mjs:40 | A short answer with two readings is asked about. |
| bin/lib/protocols-skill.mjs:41 | Plans, designs, analyses, protocols pass two read-only readers first. |
| bin/lib/protocols-skill.mjs:47 | A reply ends in one of five states. |
| bin/lib/protocols-skill.mjs:48 | Text the user copies: one labelled code block; two are numbered. |
| bin/lib/protocols-skill.mjs:49 | Before a decision or cut: done, next, why, which session. |
| bin/lib/protocols-skill.mjs:50 | Then the map from `js-harness progress`. |
| bin/lib/protocols-skill.mjs:51 | Cut at a task's end; never start a task the context will not hold. |
| bin/lib/protocols-skill.mjs:57 | Before a costly run, say how many runs and what each costs. |
| bin/lib/protocols-skill.mjs:58 | One try; read why it failed before anything runs again. |
| bin/lib/protocols-skill.mjs:59 | Read the proof before the command it allows; `&&`, never `;`. |
| bin/lib/protocols-skill.mjs:60 | Give gentle-ai a base on the head's first-parent line, by hash. |
| bin/lib/protocols-skill.mjs:61 | Merge a stacked pull request after its base, or retarget it first. |
| bin/lib/protocols-skill.mjs:62 | Run the installed `js-harness`, not the branch's copy, except to test it. |
| bin/lib/protocols-skill.mjs:63 | Review commits or slices; record gentle-ai lines; on timeout retry once, then go on. |
| bin/lib/protocols-skill.mjs:69 | A new rule or protocol passes five questions. |
| bin/lib/protocols-skill.mjs:70 | Record a rule where something acts on it; memory is never its home. |
| bin/lib/protocols-skill.mjs:71 | One home: a value is a code constant; others name the rule. |
| bin/lib/protocols-skill.mjs:72 | Change a harness rule only with `js-harness rules change` on a `rule/` branch. |
| bin/lib/protocols-skill.mjs:73 | Retire a rule, never delete it; remove superseded text. |
| bin/lib/protocols-skill.mjs:74 | A rule of the user's changes only with the user's quoted words. |
| bin/lib/protocols-skill.mjs:82-89 | Report a mistake in five parts; add a `- Seen:` line to `docs/FAILURES.md`. |
| bin/lib/protocols-skill.mjs:95 | Bad news first; "not checked" and "failed" always filled. |
| bin/lib/protocols-skill.mjs:96 | Each claim is checked, assumed or not known. |
| bin/lib/protocols-skill.mjs:97 | Check one thing of work reported done outside before building on it. |
| bin/lib/protocols-skill.mjs:98 | An absence claim names its search. |
| bin/lib/protocols-skill.mjs:99 | Sub-agents run on the model and effort the rules give their work. |
| bin/lib/protocols-skill.mjs:100 | A plan handed on has passed its double review. |
| bin/lib/protocols-skill.mjs:107-109 | Throughput candidates carry figures; drop those costing more than they gain. |
| bin/lib/protocols-skill.mjs:110 | User decides spend, protocol change, security setting, anything irreversible. |
| bin/lib/protocols-skill.mjs:119 | Before a new file, read two neighbours and write as they do. |
| bin/lib/protocols-skill.mjs:120 | Run `bin/conventions-*.test.mjs` before the commit. |
| bin/lib/protocols-skill.mjs:121 | A touched file on a legacy list is made to comply. |
| bin/lib/protocols-skill.mjs:122 | A new convention is a test with a legacy list, never a document. |

### Guard refusals and hints (PreToolUse and Stop)
| Source | Directive |
|---|---|
| bin/lib/guard.mjs:34-35 | Launch a sub-agent on a rule's model, or with none. |
| bin/lib/guard.mjs:57-59 | Open sessions with `start_session`, never Routines or cloud, even when asked. |
| bin/lib/guard.mjs:79-80 | `start_session`: pass effort at or under the rule, with context `fresh`. |
| bin/lib/guard.mjs:88-89 | A higher session effort is his to set. |
| bin/lib/guard.mjs:138-139 | Stamp the clock's hour in a message, or no hour. |
| bin/lib/guard.mjs:236-238 | No backticks in double quotes: a file, single quotes, or `$(...)`. |
| bin/lib/guard.mjs:254-256 | A command for his terminal ends with a four-word `NOTE:`. |
| bin/lib/guard.mjs:397-401 | A gentle-ai `--base-ref` is a hash on the head's first-parent line. |
| bin/lib/guard.mjs:433-436 | Scratch folders go below the worktrees folder or the scratchpad, not a drive's top. |
| bin/lib/session-title-guard.mjs:30-36 | Title sessions `<code> <n> · <purpose>` from `sessions --next-number`. |
| bin/lib/memory-index-guard.mjs:78-80 | A memory index line stays within 150 characters; detail goes in the note. |
| bin/lib/memory-feedback-guard.mjs:50-53 | A feedback note names its rule's home: `rule:<id>` or an `AGENTS.md` phrase. |
| bin/lib/document-hour-guard.mjs:45-47 | Write the clock's hour or none; a future hour as a plan. |
| bin/lib/test-run-warning.mjs:251-254 | A heavy `node --test` beside a gate runs through `js-harness gate --`. |
| bin/lib/wrapped-commit.mjs:110-117 | Commit with a plain `git commit`; test runs still go through `gate --`. |
| bin/lib/audit.mjs:186-189 | Correct a wrong stated context share from get_usage; state no unread share. |

### Hook outputs
| Source | Directive |
|---|---|
| bin/lib/pause.mjs:316 | At the pause: keep state current every step; store the resume prompt; say the share once. |
| bin/lib/pause.mjs:315 | Near compaction: write state and resume prompt now; never wait for compaction. |
| bin/lib/pause.mjs:313 | Never end a turn idle; keep a declared wait running. |
| bin/lib/sessions.mjs:2918 | Give the user nothing to send at a compaction, present or away. |
| bin/resume.mjs:92 | After a host compaction, say so to the user first. |
| bin/resume.mjs:96 | Tell the orchestrator by `notify` that you were compacted. |
| bin/resume.mjs:394, :397 | Trust the files over the summary; repeat any open question. |
| bin/resume.mjs:437 | The orchestrator reads its relief file's last lines first. |
| bin/resume.mjs:538, :549 | Say when the state is older than the pause's notice. |
| bin/resume.mjs:583 | Stop in-flight tasks whose condition resolved; record what stays running. |
| bin/resume.mjs:743-763 | Look before asking an open question; never re-ask an answered one; record it. |
| bin/lib/reply.mjs:113-117 | Close with exactly one state line and what it needs; rewrite the close. |
| bin/lib/reply.mjs:165 | A labelled block belongs only to a cut. |
| bin/lib/reply.mjs:188 | A cut carries one block. |
| bin/lib/rules-reach.mjs:115-117 | Main's rules differ; this branch's checks read the old ones until merged. |
| bin/lib/backup-fallback.mjs:73-77 | Engram short: read the fallback file, restore with `--merge`, tell the user. |
| bin/doctor.mjs:457 | Stack gap: run `js-harness doctor` (a `systemMessage`, shown to the user). |

### Rules (docs/RULES.md, rendered from bin/lib/rules-data.mjs)
| Source | Directive |
|---|---|
| docs/RULES.md:10 | announce-finished: say when finished and where to return. |
| docs/RULES.md:15 | ask-before-away: ask everything before he leaves; repeat nothing while away. |
| docs/RULES.md:20 | background-task-declared: a background task says purpose and end; stop it when resolved. |
| docs/RULES.md:25-41 | codex-review-floor/-margin/-rate: a Codex review's token allowance. |
| docs/RULES.md:43 | context-pause: at 88% of the window, write state and judge. |
| docs/RULES.md:48 | double-review: what reaches the user passes two read-only readers. |
| docs/RULES.md:54 | lead-charter: what the lead does alone, what stays his. |
| docs/RULES.md:59 | mistake-report: five parts. |
| docs/RULES.md:64 | question-context: a question opens with what it is for. |
| docs/RULES.md:69 | questions-one-place: every question in the orchestrator's chat, recorded first. |
| docs/RULES.md:74 | recap-effort-line: the recap names each session's effort mode. |
| docs/RULES.md:79 | reply-four-states: a reply ends in one of five states. |
| docs/RULES.md:84 | report-table: status report sections as tables. |
| docs/RULES.md:89 | restart-announce: pause everything, then tell him in capitals. |
| docs/RULES.md:94-103 | review-effort, review-model: Codex runs at medium on gpt-6.1-sol. |
| docs/RULES.md:104 | reviewed-commit-lines: a reviewed commit stays under 1,200 changed lines. |
| docs/RULES.md:110 | rules-live-in-the-harness: a rule he gives is cemented, never only in memory. |
| docs/RULES.md:115, :126 | session-effort high; session-model claude-opus-5-5. |
| docs/RULES.md:121 | session-housekeeping: name sessions to archive; the lead archives unasked. |
| docs/RULES.md:132 | session-prompts: prompts only for oneself; notices through the channel. |
| docs/RULES.md:137 | session-title: `<code> <n> · <purpose>`. |
| docs/RULES.md:143 | sessions-open-in-sidebar: open sessions only with start_session. |
| docs/RULES.md:149 | status-report: report everything since the last report, in detail. |
| docs/RULES.md:154-172 | subagent-effort high; reader opus; writer haiku. |
| docs/RULES.md:174 | wording-is-the-need: recommend the best, say where it differs. |
| docs/RULES.md:179 | work-sessions: at most 3 work sessions open. |
| docs/RULES.md:187-312 | 25 project values: budgets, gate bounds, waits, memory sizes, throughput cadence. |

### Auto-memory notes (loaded: MEMORY.md every turn; a note when opened)
| Source | Directive |
|---|---|
| memory/MEMORY.md:1-28 | 28 index lines; most restate a rule (five states, question tool, review consent). |
| memory/ask-before-he-leaves.md:11 (and 11 other pointer notes) | Read the rule in the repository, not here. |
| memory/claude-models-2026-10.md:13-15 | Trust the model page over the built-in list; recheck after months. |
| memory/codex-meter-is-readable.md:15 | Report Codex's meter in every recap; never ask him to look. |
| memory/compact-from-outside.md:13-15 | No model compacts another session; thresholds are his machine's. |
| memory/conflict-merge-costs-review.md:18 | Before merging main, check merge-tree; move a conflicting change instead. |
| memory/corrections-before-date.md:15 | A correction goes before a new capability; the date is reported. |
| memory/hidden-load-slows-gates.md:15 | Sample CPU by process before blaming a slow gate. |
| memory/one-sample-is-not-a-diagnosis.md:19-21 | Three probes and a comparison before naming a network cause. |
| memory/phone-cannot-open-local-session.md:19-26 | Check `remote status` first; `remote stop` needs his word; offer `/compact`. |
| memory/plan-max-20x.md:13 | His plan is Max 20x; never ask or guess it. |
| memory/reinstall-checklist.md:13 | Before he reinstalls, recall and recheck this list with him. |
| memory/restart-announce-caps.md:11-15 | Pause everything, then "YA PUEDES REINICIAR Y ACTUALIZAR!!!". |
| memory/sendmessage-cap-per-user-message.md:13 | While he is away, SendMessage only to wake; notes by `notify`. |
| memory/start-session-needs-fresh-session.md:19, :29, :35 | Lead must be new to start sessions; say where a session sits. |

## Findings

- N1. open. stack-conflict. AGENTS.md has the agent choose gentle-ai's `granted` consent itself, while gentle-ai's contract says enabled review never grants a candidate's consent and the invocation run is the one the human selected. Evidence: AGENTS.md:51-53 "run the `granted` invocation without asking"; CLAUDE.md:317 "it never grants consent for this candidate". Fix: his decision (keep it as a stated project override, or report it to gentle-ai). Refuter, amended: The quote cited, CLAUDE.md:317 "never grants consent for this candidate", is about the RDD switch being on, not a human's word; the real friction is the same line's "relay it as a Lossless Blocking Prompt" and "Run exactly the invocation selected by the human": AGENTS.md:51-53 is his standing selection, so it is a user override of the relay step (consent stays his), not a breach of consent authority; evidence should cite that clause, fix stays his.
- N2. open. stack-conflict. gentle-ai keeps push, pull request and merge as human decisions; the shipped skills tell a work session to push unasked and the lead to land pull requests. Evidence: bin/lib/manifest.mjs:234 "Push in the same step your last check passes"; :138 "Ready pull requests are landed with"; bin/lib/protocols-skill.mjs:34 "none of which was the user's to decide"; CLAUDE.md:450 "Push, PR creation, and merge remain human decisions". Fix: his decision. Refuter, amended: gentle-ai routes delivery to "ordinary repository policy" (CLAUDE.md:255, :363), and the lead lands only inside the charter he approved (bin/lib/manifest.mjs:135), so the land is a policy the contract allows; what survives is the unasked push (bin/lib/manifest.mjs:234) and protocol 1's "none of which was the user's to decide" (bin/lib/protocols-skill.mjs:34), shipped to projects whose owner never set that policy, against CLAUDE.md:450.
- N3. open. stack-conflict. After a second gentle-ai `operation_timeout`, protocol 3 sends the slice on unreviewed, where gentle-ai turns unavailable proof into one "Needs your decision" result. Evidence: bin/lib/protocols-skill.mjs:63 "the slice goes on without that review"; CLAUDE.md:253 "Unavailable, partial, declined, or exhausted proof becomes one actionable". Fix: his decision. Refuter: confirmed.
- N4. open. stack-conflict. The task contract puts six sections ahead of `## Specs` in every feature document, where gentle-ai fixes the order as a two- or three-line header, then Specs, Tasks, Log. Evidence: bin/lib/contract.mjs:6-29 (`## Goal` ... `## Ask me before`); AGENTS.md:28 "opens with the task contract"; CLAUDE.md:517 "a two- or three-line header; `## Specs`". Fix: his decision. Refuter: confirmed.
- N6. open. stack-conflict. The `AGENTS.md` block init writes into every project says gentle-ai reviews every medium or high risk change; gentle-ai enters review only when `review_due` (high risk) and leaves medium to the writer's self-verification. Evidence: bin/lib/project.mjs:424-425 "gentle-ai reviews every change of medium"; CLAUDE.md:267 "Enter this lifecycle only when `review_due` is true"; CLAUDE.md:236 "medium: writer self-verification stands". Fix: his decision (the block's wording is his, bin/lib/project.mjs:412-414). Refuter, amended: The block (bin/lib/project.mjs:424-425) contradicts CLAUDE.md:267 and observed behavior (odd/tasks/launch-audit.md:143, :145: medium, not due), but gentle-ai's own CLAUDE.md:585 says "Medium/high relays the existing candidate consent and follows the native plan", so the stack is split on medium; the fix is to say gentle-ai's assessment decides, not to pick a tier.
- N7. carried (I-SW-A1-12, I-SW-CD-2, I-SW-A1-28). contradiction. The list of the user's decisions has five versions in shipped text, from three items to seven. Evidence: AGENTS.md:50 "spend, anything irreversible, and product choices"; bin/lib/protocols-skill.mjs:110 "spend, a protocol change, a security or system setting"; bin/lib/manifest.mjs:121 "spend, publishing, anything irreversible outside the project, credentials"; bin/lib/contract.mjs:29 "spend, irreversible, product choices"; bin/lib/project.mjs:432-434 seven items ending "a report published outside this project". Fix: his decision; proposed one home: one prose rule (an id beside `lead-charter`) whose text the others name. Refuter, amended: The template line is bin/lib/contract.mjs:25, not :29, and it is a placeholder a project fills, not a version of the list; four live versions remain (AGENTS.md:50; bin/lib/protocols-skill.mjs:110; bin/lib/manifest.mjs:121, which is a card scope; bin/lib/project.mjs:432-434), and the sharp case is protocol 7 listing "a protocol change" (:110) while protocol 1 defers to AGENTS.md (:36), which omits it.
- N8. open. contradiction. AGENTS.md starts Codex only after gentle-ai approves a slice, but the push check wants a Codex record for every code commit, so a slice gentle-ai assessed not due still needs Codex. Evidence: AGENTS.md:57-58 "After gentle-ai approves a slice with code, Codex reviews"; bin/lib/manifest.mjs:35 "every code commit since the remote's default branch lies in a recorded Codex review"; odd/tasks/launch-audit.md:143-145 (L8, L10: not due, under_budget, and Codex ran). Fix: his decision (AGENTS wording). Refuter, amended: No text forbids Codex on a slice gentle-ai did not approve, and AGENTS.md:59 itself states the push refusal for uncovered code commits; it is a gap (AGENTS.md:57-58 and bin/lib/protocols-skill.mjs:63 name no trigger for a not-due slice), not two incompatible orders.
- N9. open. contradiction. The work-session skill says one test file under half a minute is free beside a gate; the guard counts one file as heavy only past 60 seconds. Evidence: bin/lib/manifest.mjs:235 "one test file that runs in under half a minute are free"; bin/lib/test-run-warning.mjs:17 `HEAVY_FILE_SECONDS = 60`. Fix: lead's triage (the skill reads the constant). Refuter, amended: bin/lib/manifest.mjs:235 (under half a minute free) is stricter than the guard's backstop bin/lib/test-run-warning.mjs:17 (`HEAVY_FILE_SECONDS = 60`), so obeying the skill never trips the guard; the kind is duplicate (one value, two figures, the skill's not read from the constant), fix unchanged.
- N10. open. contradiction. The pause notice heads its "nothing to send" sentence "The cut:", while AGENTS.md, protocol 2 and the reply check define a cut as the one block the user sends. Evidence: bin/lib/pause.mjs:315-316 "The cut: ${cutRule()}" with bin/lib/sessions.mjs:2918 "give the user nothing to send"; AGENTS.md:81 "a cut carries what he sends"; bin/lib/reply.mjs:116. Fix: lead's triage (another label, such as "The compaction:"). Refuter, amended: bin/lib/pause.mjs:315-316 labels cutRule (bin/lib/sessions.mjs:2918) "The cut:", which clashes with the defined term (AGENTS.md:81, bin/lib/reply.mjs:116), but no text orders an incompatible act for the same case; the kind is style (a misleading label), fix unchanged.
- N12. open. contract. The reply check refuses a `question` close while background work runs; AGENTS.md and protocol 2 put that limit on `decision` only. Evidence: bin/lib/reply.mjs:115 and :171-172 "a ${state} is never asked while work runs"; AGENTS.md:78 "decision (never while work runs), question (he answers in writing)"; bin/lib/protocols-skill.mjs:47. Fix: his decision (AGENTS wording), lead's triage (protocol). Refuter: confirmed.
- N13. open. contradiction. A memory note offers `/compact` as a cut, against the rule that he never compacts by hand. Evidence: memory/phone-cannot-open-local-session.md:26 "offer `/compact` or a new session"; AGENTS.md:73 "He never compacts by hand"; bin/lib/manifest.mjs:202 "never hand the user a compaction command". Fix: his decision (memory note). Refuter: confirmed.
- N14. open. contradiction. A memory note keeps merged text the orchestrator skill reverses, though protocol 4 removes superseded text. Evidence: memory/start-session-needs-fresh-session.md:29 "Work sessions are opened by him there (he pastes the opening prompt)" and :19 "Supersedes the "lead opens none" part"; bin/lib/manifest.mjs:137 "open the new session yourself"; bin/lib/protocols-skill.mjs:73 "removed, not annotated". Fix: his decision (memory note). Refuter, amended: memory/start-session-needs-fresh-session.md:29 sits under a heading that marks it as the merged note's verbatim text (:25) and :19 already says it is superseded, and protocol 4's "removed, not annotated" (bin/lib/protocols-skill.mjs:73) governs harness rules, not memory notes; the kind is stale text in memory, not a live contradiction, fix stays his.
- N16. open. contradiction. The orchestrator skill says the lead never commits, while the audit's ledger names the lead as its writer after stage 2. Evidence: bin/lib/manifest.mjs:136 "You never implement, never commit, never write in a worktree"; odd/tasks/launch-audit.md:25 "the session that runs stages 0–2 or the lead after it". Fix: lead's triage. Refuter: confirmed.
- N17. open. contradiction. A `reference` note holds his rule to report the Codex meter in every recap, a rule kept in memory where the feedback guard does not look, and no command reads the meter. Evidence: memory/codex-meter-is-readable.md:15 "report Codex's weekly and five-hour percentage ... in every recap"; bin/lib/protocols-skill.mjs:70 "A memory note is never its home."; bin/lib/memory-feedback-guard.mjs:46 (feedback notes only); bin/lib/manifest.mjs:189; I-HR-L48c. Fix: his decision. Refuter, amended: The recap rule has a harness home, bin/lib/manifest.mjs:189 ("the Codex meter, read at that moment"), so this is a duplicate, not a contradiction; what lives only in memory is "never ask him to look" and "before he leaves" (memory/codex-meter-is-readable.md:15), and "no command reads the meter" is I-HR-L48c, not this finding.
- N18. carried (I-SW-CD-39). contradiction. Still stands: the note says nothing shipped pins a Haiku id, and shipped code does. Evidence: memory/claude-models-2026-10.md:15 "nothing shipped pins a Haiku or Sonnet id"; `git grep -c claude-haiku-5-5 -- bin/lib/rules-data.mjs evals/configs.mjs evals/prices.mjs` → 1 each. Fix: his decision (memory note). Refuter: confirmed.
- N19. carried (I-SW-CD-37). contradiction. Still stands: the note calls the gate's own load reading planned; the gate reads it. Evidence: memory/hidden-load-slows-gates.md:15 "is planned for the next slice of the gate"; bin/check.mjs:32 `watchBusiest`, :1742 "reads the machine's load once". Fix: his decision (memory note). Refuter: confirmed.
- N20. open. contradiction. A note's description still says medium effort is a trial for closed-scope work; the rules give high to every session and sub-agent. Evidence: memory/effort-by-kind-of-work.md:3 "medium only as a trial on closed-scope work"; docs/RULES.md:115 and :154 (high). Fix: his decision (memory note). Refuter: confirmed.
- N21. carried (I-SW-A1-10). contradiction. Still stands at AGENTS.md:60-61 "If Codex cannot run, report that and record the skip"; protocol 3 covers only gentle-ai's timeout (bin/lib/protocols-skill.mjs:63). The counter-evidence is in the lead's relief file, outside the repository, not read here. Fix: his decision (AGENTS wording). Refuter, amended: Inside the read sources nothing opposes AGENTS.md:60-61 (`grep -rn "unavailable <reason>\|passed over\|weekly"` over AGENTS.md, both skills and RULES.md finds only the command's own description at bin/lib/manifest.mjs:32), and the counter-text is the relief file, unread; it is an open question for him (carried), not a shown contradiction.
- N22. carried (I-SW-A1-14). contradiction. Still stands: AGENTS.md:26 "it is the handoff, and nothing else is", while the shipped texts make the relief file the lead's record and store a session's resume prompt as an opening. Evidence: bin/lib/manifest.mjs:108; bin/lib/pause.mjs:310-311. Fix: his decision (AGENTS wording). Refuter, amended: The relief file is the lead's record for a role with no feature (bin/lib/manifest.mjs:108), a different case from resuming a feature (AGENTS.md:25-26); the part that survives is the resume prompt stored with `notify --opening` (bin/lib/pause.mjs:311), a third text a new session of the feature reads.
- N23. carried (I-SW-A1-27). contradiction. Still stands at AGENTS.md:54-55 "does not parse, ask him instead"; whether his later word covers it cannot be told from the repository. Fix: his decision. Refuter, amended: AGENTS.md:54-55 agrees with the stack (CLAUDE.md:154 also says to emit the envelope and stop), and the only opposing word is in the relief file, unread; the row is an open question for him, not a contradiction.
- N24. carried (I-SW-A2-52). duplicate. Still stands, moved to docs/ROADMAP.md:497-499 "Where this section and that document differ on the design, the document wins", beside docs/ROADMAP.md:4 "Each fact lives in one place"; :496 still names the branch `feat/failures-register`. Fix: lead's triage (T15 of rule-hierarchy, the pointer). Refuter: confirmed.
- N25. carried (I-SW-A3-89). contradiction. The history line moved to odd/tasks/session-channel.md:426 "relieved, not compacted"; the shipped skill settles it the other way. Evidence: bin/lib/manifest.mjs:200 "A compaction needs no one; a relief needs the user". Fix: lead's triage (close: shipped text holds the answer; the line is history). Refuter, amended: odd/tasks/session-channel.md:426 is a history-class file (odd/tasks/launch-audit.md:41, `history` is `odd/**`), so no live text contradicts bin/lib/manifest.mjs:200; the status is closed (history), not carried as a contradiction.
- N26. carried (M11). duplicate. Two of M11's five restated values are real: the context pause and the gate's wait. Evidence: scan (rules-scan `scanLines` over the five files) → `context-pause AGENTS.md:74 near 88%`, `gate-wait bin/check.mjs:1772 an hour at most`. Fix: AGENTS.md:74 his decision (name `rule:context-pause`); bin/check.mjs:1772 lead's triage (`rule:gate-wait`). Refuter: confirmed.
- N27. wrong (M11, three rows). bug. Three M11 rows are pattern false positives: "over a minute" there is a code constant, not the rule matched. Evidence: README.md:1381 and bin/lib/test-run-warning.mjs:6 say `HEAVY_FILE_SECONDS = 60` (test-run-warning.mjs:17), not gate-log-size (512 KiB); bin/check.mjs:1605 says `GATE_STALE_MS = 60_000` (bin/lib/gate-lock.mjs:65), not sensor-silence (20 minutes); rules-data.mjs:161-170 matches `gate log ... over {amount}` with any amount. Fix: lead's triage (narrow the gate-log-size and sensor-silence patterns). Refuter: confirmed.
- N28. open. duplicate. The rules scan misses a restated rule value in the orchestrator skill: "8 hours" is rule wait-for (480 minutes). Evidence: bin/lib/manifest.mjs:130 "It ends only on a notice to you or after 8 hours"; scan of bin/lib/manifest.mjs prints no finding; rules-data.mjs:610 needs "wait" within 50 characters of "for/after". Fix: lead's triage (`ruleValue('wait-for', ...)`). Refuter: confirmed.
- N29. open. duplicate. The skills restate code constants as literals, against protocol 4's one home for a value. Evidence: bin/lib/manifest.mjs:44 and :121 "9.5 minutes" (bin/permit.mjs:34 `WAIT_MS = 570 * 1000`); :121 "it lasts 40 minutes" (bin/permit.mjs:36); :43 and :60 "150 characters"; :43 "more than 2 points"; bin/lib/protocols-skill.mjs:71 "A value is a constant in code that messages, skills and tests read". Fix: lead's triage (interpolate). Refuter: confirmed.
- N30. open. contract. The `js-harness` skill's description of `guard --hook` leaves out five refusals the guard makes. Evidence: bin/lib/manifest.mjs:43 has no "Routines", "base-ref", "feedback", "Markdown" (grep exit 1) and says only "a `node --test` of several files"; bin/guard.mjs:44-52 lists the Routines tools, `--base-ref`, feedback notes and Markdown hours; bin/lib/test-run-warning.mjs:5-6 adds a heavy single file and an eval batch. Fix: lead's triage. Refuter: confirmed.
- N31. open. contract. RULES.md calls itself the one text that shows a value, while the skills show rule values. Evidence: docs/RULES.md:3 "this is the one text that shows a value"; bin/lib/manifest.mjs:33, :34, :41, :128, :242 (`ruleValue`). Fix: lead's triage (the rendered header). Refuter: confirmed.
- N32. open. contract. The Engram fallback notice says Engram "is not working" also in the `ok` state, where Engram answered with under nine tenths of the backup's count. Evidence: bin/lib/backup-fallback.mjs:62 `ok: Engram holds ...`, :74 "The Engram protocol shown at this start is not working for this project"; bin/backup.mjs:917-918. Fix: lead's triage (word the `ok` case as a shortfall). Refuter: confirmed.
- N33. carried (M7). useless. Protocols 1-3, 5 and 6 carry no "Reviewed by" date, no "Five questions" and no "Cost" line, and nothing records whether a section was used, so the withdrawal order cannot act. Evidence: bin/lib/protocols-skill.mjs:76, :113, :124 are the only dates; :30 "that nobody used is withdrawn"; :69 asks the five questions of every new protocol; `grep -rn "nobody used" bin` finds only :30. Fix: his decision (a protocol change is his, protocols-skill.mjs:110). Refuter: confirmed.
- N34. open. useless. Memory hygiene is to be withdrawn after six idle passes, but no command counts passes. Evidence: bin/lib/manifest.mjs:70; `grep -rn "in a row\|but the clock" bin/memory*.mjs bin/lib/memory*.mjs` (non-test) → nothing. Fix: lead's triage. Refuter, amended: Verified passes are journaled and listed (bin/lib/memory-pass.mjs:267, bin/memory.mjs:113-115), so passes can be counted; what no record holds is why each pass was due or whether anyone used the protocol, which bin/lib/manifest.mjs:70's condition needs.
- N35. open. dead. Rule `work-sessions` (3 sessions) has no reader. Evidence: docs/RULES.md:179-183 "Read by: none"; `git grep -n work-sessions -- bin ':!*.test.mjs'` → only bin/lib/rules-data.mjs:626. Fix: his decision (his rule). Refuter, amended: No code reads rule `work-sessions` (`git grep -n work-sessions -- bin ':!*.test.mjs'` finds only bin/lib/rules-data.mjs:626; docs/RULES.md:182 "Read by: none"), but the lead reads the rules list at its start (bin/lib/manifest.mjs:209), so it is unenforced, not dead.
- N36. open. style. Rule id `reply-four-states` declares five states. Evidence: bin/lib/rules-data.mjs:286; docs/RULES.md:80 "A reply ends in one of five states". Fix: his decision (retire with a successor id). Refuter: confirmed.
- N37. open. duplicate. Two rules anchor on the same sentence. Evidence: phrases of `status-report` and `report-table` both quote bin/lib/manifest.mjs:163 "how much is done, or what you have done, the answer is a report". Fix: his decision; one home: `status-report` holds the sentence, `report-table` keeps only :174. Refuter: confirmed.
- N38. open. duplicate. The five-state close is written five times, and AGENTS.md:12 says what a command checks belongs in `bin/`. Evidence: AGENTS.md:77-84; bin/lib/protocols-skill.mjs:47-51; bin/lib/reply.mjs:113-117 (the check); bin/lib/project.mjs:446-449; memory/MEMORY.md:2. Fix: his decision; one home: protocol 2 with the reply check, AGENTS.md naming it. Refuter: confirmed.
- N39. open. duplicate. Evidence and absence claims are stated in AGENTS.md, protocol 6 and the init block. Evidence: AGENTS.md:34-37; bin/lib/protocols-skill.mjs:95-98; bin/lib/project.mjs:427-429. Fix: his decision; one home: protocol 6, AGENTS.md naming it. Refuter: confirmed.
- N40. open. duplicate. The review procedure is in AGENTS.md and again in protocol 3 and the skills. Evidence: AGENTS.md:55-61 "A candidate is a work-unit commit or a slice"; bin/lib/protocols-skill.mjs:63 "A review candidate is a work-unit commit or a slice"; bin/lib/manifest.mjs:32, :35, :235. Fix: his decision; one home: protocol 3; AGENTS.md keeps only the consent grant, which is this project's. Refuter: confirmed.
- N41. open. duplicate. "Decide the rest, say its cost, go on" is in AGENTS.md twice, protocol 1 and the init block. Evidence: AGENTS.md:63-64, :79-80; bin/lib/protocols-skill.mjs:36; bin/lib/project.mjs:435. Fix: his decision; one home: protocol 1. Refuter: confirmed.
- N42. open. duplicate. "Check work reported done outside" is in AGENTS.md, protocol 6 and the init block. Evidence: AGENTS.md:66-67; bin/lib/protocols-skill.mjs:97; bin/lib/project.mjs:427-428. Fix: his decision; one home: protocol 6. Refuter: confirmed.
- N43. open. duplicate. The no-manual-compaction rule is in AGENTS.md, the orchestrator skill, the pause notice and memory. Evidence: AGENTS.md:73-77; bin/lib/manifest.mjs:202; bin/lib/sessions.mjs:2918; memory/MEMORY.md:4. Fix: his decision; one home: the pause notice (`cutRule`), which the hook delivers when it applies. Refuter: confirmed.
- N44. open. duplicate. "Ask with the question tool" is in AGENTS.md, the orchestrator skill, protocol 1 and memory. Evidence: AGENTS.md:80; bin/lib/manifest.mjs:114; bin/lib/protocols-skill.mjs:38; memory/MEMORY.md:17. Fix: his decision; one home: the orchestrator skill (`rule:questions-one-place`). Refuter: confirmed.
- N45. open. duplicate. "Never end a turn idle" is in the work-session part, the pause notice, the reply check and memory. Evidence: bin/lib/manifest.mjs:244, :45; bin/lib/pause.mjs:313; memory/MEMORY.md:13. Fix: lead's triage; one home: the reply hook's wake check, with one skill line naming it. Refuter: confirmed.
- N46. open. duplicate. AGENTS.md gives TDD to gentle-ai, then restates test-first, as does the init block. Evidence: AGENTS.md:4 "gentle-ai owns the workflow, task documents, TDD and review"; AGENTS.md:34 "written first"; bin/lib/project.mjs:422; CLAUDE.md:582 "Apply one default test-first policy". Fix: his decision. Refuter: confirmed.
- N47. open. duplicate. The work-session part restates protocol 3's base and timeout rules while pointing to it. Evidence: bin/lib/manifest.mjs:235 "Give that review a base on the head's first-parent line, and on `operation_timeout` run it once more"; bin/lib/protocols-skill.mjs:60, :63. Fix: lead's triage (keep the pointer only). Refuter: confirmed.
- N48. open. duplicate. This repository's AGENTS.md carries no js-harness block, so the harness's own instructions and the block it ships to every project word the same rules differently. Evidence: `grep -n "js-harness block" AGENTS.md` → exit 1; bin/lib/project.mjs:415-450 against AGENTS.md:34-84 (owner's decisions 7 vs 3, N7; five states, N38; double review only in the block and protocol 1). Fix: his decision. Refuter: confirmed.
- N49. open. dead. Nine wiki-links in memory notes point to notes that no longer exist. Evidence: compact-from-outside.md:15 `[[no-turn-ends-waiting]]`, `[[tell-lead-after-compaction]]`; conflict-merge-costs-review.md:18 `[[taskstop-leaves-node-child]]`; corrections-before-date.md:15 `[[work-continuously]]`, `[[no-turn-ends-waiting]]`; phone-cannot-open-local-session.md:28 `[[merge-from-chat]]`, `[[recap-before-prompt]]`; plan-max-20x.md:13 `[[subagent-effort-high]]`; start-session-needs-fresh-session.md:19 `[[no-sessions-outside-the-sidebar]]` (each checked for `<name>.md` in memory/). Fix: his decision (memory notes). Refuter: confirmed.
- N50. open. duplicate. MEMORY.md, read every turn, restates rules whose notes are now only pointers, and one line describes content its note no longer holds. Evidence: memory/MEMORY.md:2 "every reply ends in one of five states", :4, :13, :15, :17; :18 "TaskStop leaves the node child" while memory/background-tasks-declare-and-dismount.md:11 is a pointer; bin/lib/protocols-skill.mjs:70. Fix: his decision (index lines name the rule id only). Refuter: confirmed.
- N51. open. duplicate. A feedback note restates its whole rule while saying it only points to it. Evidence: memory/restart-announce-caps.md:11 (the rule in full) and :15 "this note only points to it"; bin/lib/manifest.mjs:178-181. Fix: his decision (memory note). Refuter: confirmed.

## Counts
After the refuter (refute-n.md): 33 confirmed, 15 amended, 3 refuted and removed here (their verdicts stay in refute-n.md).
- stack-conflict: 6 (N1-N6)
- contradiction: 17 (N7-N11, N13-N23, N25)
- contract: 4 (N12, N30, N31, N32)
- duplicate: 18 (N24, N26, N28, N29, N37-N48, N50, N51)
- useless: 2 (N33, N34)
- dead: 2 (N35, N49)
- style: 1 (N36)
- bug: 1 (N27)
- Total: 51 (open 40; carried 10: M7, M11, I-SW-A1-10, A1-12/CD-2/A1-28, A1-14, A1-27, A2-52, A3-89, CD-37, CD-39; wrong 1: three rows of M11). Lead's triage only: 15 (N9-N11, N16, N24, N25, N27-N32, N34, N45, N47); his decision, alone or in part: 36.

## Not read
- bin/lib/manifest.mjs:571-2012: the install engine's code, no instruction text (its hook comments at :397-566 were read).
- The texts `codex-review` sends to Codex as its prompt, and the evals' prompts: instructions to another model, outside this stage's list (AGENTS, skills, hooks, guards, rules, memory); stage 4 area b/e.
- The board and notice texts `sessions`, `notify` and the PostToolUse inbox notice print (bin/lib/inbox.mjs, bin/lib/sessions.mjs beyond :2905-2920): only their existence was checked.
- `permit --hook`'s card text and `doctor --hook` beyond its one `systemMessage` line.
- The lead's relief file and side-session notes (counter-evidence of I-SW-A1-10, A1-12, A1-27 lives there): outside the repository.
- docs/rule-sources.json and odd/tasks/memory-feedback-home.md (his words behind each rule): the rules' text was read from docs/RULES.md and rules-data.mjs.
- Scratch: one script, `~\AppData\Local\Temp\claude\D--js-harness--claude-worktrees-clean-5f4555\a120e3d8-c6f1-4cd5-8076-098353b715f4\scratchpad\scan-m11.mjs` (runs `rules-scan.mjs` `scanLines` over named files); nothing in the repository.
