# Claude app native sessions: what the host now does, and what the harness can drop

Status: proposal, 2026-10-30, session JH 105 (started by the lead, `JH ORQ · orquestador F8`),
revised the same day after two blind readers (section 15). Nothing here changes a rule, a setting
or anything under `~/.claude` or `~/.codex`. Every removal below waits for his decision (section
13); every rule change goes through `js-harness rules change` with his quoted words, on a `rule/`
branch of its own.

His words this rests on, read with `js-harness sessions --quote` from the lead's transcript
`0f71b2c6-cbce-43ca-a031-276a4b2c381f`:

- line 33399, 2026-10-30T16:58:57Z: a session that researches every new release in depth,
  "a sabiendas que este arnes es solo y unicamente para claude desktop", with mods (the board as an
  example "que no se si es valido o no") and how the lead and nested sessions should run today.
- line 33574, 2026-10-30T17:03:55Z: "la idea es que este arnes funcione unicamente y exclusivamente
  para Claude Desktop y todas sus funcionalidades en conjunto con el revisor Codex [...] enfocado y
  especializado al maximo para que el entorno tanto de desarrollo como de investigacion sera el
  maximo y mejor posible". (The lead's message named line 33578; that line is a `last-prompt`
  entry and `--quote` refuses it. 33574 is the line he typed.)

Search for his earlier words on the subject: `grep '"type":"user"'` over that transcript for
"exclusiv", "especializ" and "claude desktop" returned five lines (7704, 29531, 30919, 33399,
33574); the two above decide.

Evidence legend: **[checked]** read or run in this session, with the command or `path:line`;
**[doc]** stated by the host's tool schema, the changelog or a docs page, not exercised here;
**[assumed]**; **[unknown]**. Token figures marked *estimate* are bytes divided by four.

## 0. The answer, short

- **"Claude 2.0" is not the name of what he has.** Anthropic used "Claude 2.0" for a model in
  2023. What he sees is Claude Desktop 4.4212.0 (released 2026-10-29) [checked: `js-harness doctor
  --json --offline`, `host-update` row; the Desktop changelog] with its Code tab running Claude
  Code 2.1.314 [checked: `claude --version`]. What changed is a run of desktop releases since
  2026-10-15: nested sessions that Claude starts, the plan and next-step box, PR Auto-fix and
  auto-archive, side chats, Windows cross-session messages, and mods.
- **The host replaces almost nothing outright today.** Of 25 pieces mapped (section 4): 1 is
  already done the host's way, 4 change how we use them now, 1 goes by his desktop-only decision,
  6 could move after a probe or a mod pilot, and 13 stay. The reasons repeat: host tools are called
  by the model, so a zero-token command moved onto them costs turns; `start_session` is refused on
  any turn he did not type; side-session wake-ups are batched and fade on long unattended runs; the
  host still shows permission cards in bypass mode, and only the harness relays them; and nothing
  about the phone is verified.
- **The real gains are in how sessions run, not in deleted lines.** Section 6 gives the design:
  `start_session` on his turns, the app's archive on merge for sessions that bound their PR,
  `wrap_up` for the close of a turn. Section 7 maps today's five frictions to fixes; three need no
  host feature at all, only cleanup and a check.
- **Mods (since Claude Code 2.1.287) are the one feature that could retire whole pieces:** they run
  inside the session's engine without the model, with timers, file reads, host commands, and a
  queued prompt that wakes a quiet session. They could replace each waiting session's node process,
  the lead's board pane, and the two node processes every tool call starts today. His board
  example is partly valid: a mod pane cannot replace the Artifact he opens from the phone. All of
  it needs a pilot in a real Code-tab session first (section 5).
- **Desktop-only (his line 33574):** the Decided row and the `AGENTS.md` wording are in this PR;
  the Codex copies of the skills and hooks leave `install` later. That is an install
  simplification: Codex reviews already run with hooks and skill instructions disabled
  (`bin/codex-review.mjs:365-386`), so the runtime saving there is zero. One cost was seen today:
  the `reply` Stop hook installed for Codex replaced the final answer of this proposal's Codex
  reader with a state line (section 15).
- **Token savings are small:** about 1.4k tokens of skill text itemized (section 10), against
  ~8.5k for the whole orchestrator skill. The larger savings are processes and steps, and they
  wait on the pilot.
- **A standing role for each host release** (his line 33399) is proposed in section 8.

## 1. What changed in the host, and since when

Versions: Claude Desktop 4.4212.0, Claude Code 2.1.314 [checked]. Sources: the CLI's changelog
copy `~/.claude/cache/changelog.md` (top entry 2.1.314) [checked]; the Desktop changelog at
`https://claude.com/docs/cowork/claude-desktop-changelog` (the page `bin/lib/host-update.mjs:13`
already reads; its first 100k of 245k characters were read, back to v2.2553.0 of 2026-09-17); the
docs pages at code.claude.com; and the tool schemas this session was given, for what no page
documents.

| Feature | What it does | Since | Limits that matter here | Windows | Phone |
|---|---|---|---|---|---|
| Nested sessions, `start_session` (`offer`, `user_asked`, `own_initiative`) | Claude starts a local, cloud or SSH session as a sidebar row nested under its starter, with its own worktree, model, effort, permission mode and `wake_when_done` | Desktop v2.42304.0, 2026-10-15; v3.1623.0, 2026-10-20 [doc] | `user_asked` only on a turn he typed; elsewhere only a card he clicks [doc: tool schema]. The docs page describes nesting only for suggested tasks | yes [checked: the lead started this session; `get_session self` → `parentSessionId`] | [unknown] |
| `<side-sessions-event>` | The starter is continued when the sessions it started end a turn | same [doc] | Only when **no** session it started is still working **and** the starter is idle; after many in a row with none from him, notes wait for his next turn; cloud sessions never report; 400 characters [doc: tool schema] | [assumed] | [unknown] |
| `SendMessage` / `ListAgents` across sessions | Message any of his sessions on any machine; `notify_when_idle` for one idle notice | 2.1.224; Windows 2.1.239 by the changelog, 2.1.234 by the docs page; `notify_when_idle` 2.1.236 [doc] | 100 queued messages; messages to a session in another permission mode wait for approval; relayed messages carry no user authority (2.1.166) [doc]; ten sends per typed message (`message-cap-ran-out`, 2026-10-14, not rechecked) | yes [checked: the lead's two messages reached this session] | Remote Control sessions addressable (2.1.225) [doc] |
| `ccd_session_mgmt` | list, get, archive, detach, stop, send, list_events, search, get_usage (context and plan limits), set model / effort / permission mode / title / Remote Control | [unknown] | Archive asks him except in bypass mode and refuses a working session; detach "unavailable in unattended sessions"; Remote Control "only when the user asks" [doc] | yes [checked: list, get, get_settings] | n/a |
| Plan and next-step box (`update_plan`, `wrap_up`) | Task list under the message; a box with a recap, one question and one or two buttons; `blocked` marks the session waiting | Desktop v2.42304.0 / v3.1623.0 [doc] | One question; does not hold the session [doc]. Not seen by the harness's question gate (`bin/lib/template-gate.mjs:132-134`) [checked] | yes [checked] | [unknown] |
| PR menu: Auto-fix, Merge when ready, auto-archive | Wakes the session on red CI, conflicts and review comments; archives it on merge | Desktop v2.42304.0 [doc] | Auto-fix only for a PR the session opened; "running sessions don't auto-archive" [doc: desktop page] | yes [assumed] | cloud Auto-fix can be enabled from the mobile app [doc] |
| `ccd_settings` | `auto_archive_on_pr_close` (**On**), `auto_archive_inactive_days` (0), `connect_new_sessions_to_remote_control` (**On**), keep-awake (**On**), notifications | inactive archive: CLI 2.1.265 [doc] | Each change is his, on a card | yes [checked] | account settings follow him [doc] |
| Side chats (`/btw`), split view, session rail, sidebar groups | A side chat in a pane; two sessions side by side; cards beside the conversation; group by environment | Desktop v2.42304.0, v3.1623.0 [doc] | — | yes [doc: Alt-click] | [unknown] |
| `hand_off_to_session`, fork as subagent | Moves the task in progress to its own session (a fork) | v3.1623.0 [doc] | A fork inherits the context and, per `SKILL.md:125`, cannot be detached | [assumed] | n/a |
| Worktrees made by the app | Per-session worktree; inactive cleanup (30/60/90 days, his card); removal about 30 days after archive | fixes through v3.1623.0 [doc] | Only worktrees the app made | yes [checked: `.claude/worktrees/` in `git worktree list`] | n/a |
| Monitor | Streams a background script's lines | 2.1.98 [doc] | Expires at 30 minutes | yes [assumed] | n/a |
| Workflow | Deterministic multi-agent scripts | 2.1.154 [doc] | His explicit opt-in | [assumed] | n/a |
| Scheduled tasks | Cron or one-shot prompts | Desktop 1.1.5368 [doc] | Open in Routines, unseen (`session-opened-unseen`) | yes | n/a |
| Remote Control | Follow and steer a local session from claude.ai/code or the mobile app | 2.1.53 or earlier [doc] | One remote session per interactive process; the machine must stay awake; a restart turns it off (`bin/lib/host-update.mjs:96-104`) [doc] | yes [checked: the lead's row `remoteControlActive: true`] | yes [doc] |
| PushNotification | Desktop notice, phone push under Remote Control | 2.1.152 or earlier [doc] | Skipped when he is at the screen | yes | yes [doc] |
| AskUserQuestion | 2-4 options | 2.0.55 or earlier | Holds the asker (`question-tool-holds-asker`); `askUserQuestionTimeout`'s timer "never starts" under Remote Control [doc: tools page] | yes | waits until answered [doc] |
| `Notification` hook | A command when the session needs him: `idle_prompt`, `agent_needs_input`, `agent_completed`, `permission_prompt` | [unknown] | Cannot block [doc: hooks page] | [unknown] | n/a |
| Artifacts + ArtifactData | A private page on claude.ai, with a database the model writes | CLI 2.1.281, Desktop 1.13576.0 [doc]; ArtifactData undocumented | Only the model writes the database | yes | yes, any browser [doc] |
| Mods | Function hooks inside the engine: panes, a band, status line, toasts, slash commands, hooks on tool calls and prompts, timers, `$.fs`, `$.process.run`, `$.prompt.submit`, `$.session.send`, `$.session.usage()` | **2.1.287** [doc] | See section 5 | [unknown] | [doc, not exercised] |
| Idle compaction | A 200k+ conversation left idle is summarized | 2.1.314 [doc] | On his next message, once the cache expired | yes | n/a |
| `blockWritesOutsideWorkingDirectories` | Write and Edit refuse paths outside the working directories | 2.1.314 [doc] | The harness writes `~/.js-harness` through its commands, not Write or Edit [assumed unaffected] | — | — |

Not found in any official page: `start_session`, `<side-sessions-event>`, `update_plan`,
`wrap_up`, `ccd_pr`, `ArtifactData`, `clean_up_worktrees` by those names (a claude-code-guide
read of code.claude.com, its `llms.txt` index, the changelog and the support release notes). Those
rows rest on the tool schemas, which the app can change without a note: one more reason section 8
diffs the tool list itself. Agent teams stay "experimental and disabled by default" [doc].

## 2. What the harness does for the same jobs

Sizes are `wc -l` of module/test. Skill sizes are bytes of the installed copy.

| Piece | Where | Size | Job |
|---|---|---|---|
| `sessions` board, `--watch` | `bin/sessions.mjs:480`, `:976`; `bin/lib/sessions.mjs` | 1008/2847; lib 3424/4873 | State, context, background work, reply tail; worktrees, gates, PRs, relief; returns when a decision is needed |
| `sessions start` / `stop` | `bin/sessions-background.mjs:116`, `:387` | 430/765 | `claude --bg` with Remote Control, on turns he did not type |
| `sessions --next-number`, `--address`, `--quote` | `bin/sessions.mjs:691`, `:852`, `:781` | — | Number, role address, his words at a line |
| `sessions live` | `bin/sessions-live.mjs:112` | 223/378 | Batches notices for the lead to send to the board by hand |
| `notify` | `bin/notify.mjs:274`; kinds `bin/lib/channel.mjs:40` | 624/1494 | The channel's only writer |
| `wait` | `bin/wait.mjs:249` | 357/483 | One node process per wait |
| `permit` | `bin/permit.mjs:304` | 350/330 | The only way a lead answers another session's card |
| `quiet` | `bin/quiet.mjs:83` | 162/311 | Whether the machine is quiet enough to turn off |
| `loop` | `bin/loop.mjs:542` | 620/389 | Owned loops whose stop kills every descendant |
| `template ask`, question gate | `bin/template.mjs:305`; `bin/lib/template-gate.mjs:132` | 442/428 | The question tool's input for a recorded question; refuses an unrecorded one |
| `reply` (Stop hook), stop-wake | `bin/reply.mjs:83`, `bin/lib/reply.mjs:19`, `bin/lib/stop-wake.mjs:106` | 133/302; 191/183 | The five states; a work session that ends with nothing armed is told to arm a wait |
| Relief file | `bin/lib/channel.mjs:89` | — | The lead's dated log |
| `stretch`, `report`, `merge-queue --land` | `bin/stretch.mjs:768`, `bin/report.mjs:108`, `bin/merge-queue.mjs:749` | 824/663; 202/329; 956/2002 | Stretches, status reports, the land |
| `remote` | `bin/remote.mjs:975` | 1118/2921 | `claude remote-control`, so the phone can start sessions here |
| `resume` | `bin/resume.mjs:1051` | 1123/1909 | Resume after compaction; the pause notice on every tool call |
| `clean`, worktrees | `bin/clean.mjs`, `bin/lib/worktrees.mjs` | — | Regenerable leftovers; worktrees safe to lose (151 of 184 once) |
| Orchestrator skill | `bin/lib/manifest.mjs:110` | 152 lines, 33,916 bytes, ~8.5k tokens *estimate* | How the lead and work sessions run |
| Protocols skill | `bin/lib/protocols-skill.mjs` | 116 lines, 16,209 bytes, ~4.1k *estimate* | Asking, closing, costs, rules, mistakes, handoffs |
| Codex install components | `bin/lib/manifest.mjs:277, 287, 297, 332, 344, 404, 416, 429` | 3 skills + 5 hook entries = 8 | The same skills and hooks for Codex |
| Rules | `bin/lib/rules-data.mjs` | 70 declarations, 4 retired | About 30 concern sessions |

Hooks `install` registers (`bin/lib/manifest.mjs:323-433`, `bin/lib/hook-entries.mjs`), each a
node process per firing:

| Event | Hook | Fires | Host equivalent | Verdict |
|---|---|---|---|---|
| PreToolUse | `guard --hook` (matcher includes Bash, Read, Grep, Write, Edit, Agent, SendMessage, `start_session`) | most tool calls | `permissions` deny rules cover paths only; mod `tool.call`/`tool.check` | keep; mod candidate |
| PreToolUse | `template gate --hook` | AskUserQuestion | none | keep |
| PostToolUse | `resume --pause` | every tool call | none (idle compaction is not the pause notice); mod with `$.session.usage()` | keep; mod candidate |
| PostToolUse | `template gate --shown` | AskUserQuestion | none | keep |
| PostToolUseFailure | `resume --pause` (WebFetch fallback) | failed WebFetch | none | keep |
| PermissionRequest | `permit --hook` | each card | none: the host gives no tool to answer another's card | keep (see row 1) |
| Stop | `guard --stop`, `reply --hook`, `backup --hook` | every turn end | `wrap_up` covers part of `reply` | keep; `reply` shrinks after its gate work |
| UserPromptSubmit, SubagentStart | `rules --hook` | each prompt, each subagent | none | keep |
| SessionStart | `doctor --hook`, `resume --hook`, `rules --hook`, `backup --session-start` | start, resume, compact | none | keep |

So every tool call starts at least two node processes (`guard`, `resume --pause`) [checked:
matchers]. Whether that is what drives today's low-memory kills is [unknown]; section 7 measures
it before anything is claimed.

Measured use [checked, `~/.js-harness/`]: 1,750 notices in the channel (1,028 notes, 289 ready,
125 questions, 102 answers, 87 closed, 55 waiting, 34 withdrawn, 30 opened) and 24 records of
other schemas; 44 background sessions registered by `sessions start`, 26 removed, so 18
registrations were never removed (not 18 live processes: `bin/lib/background.mjs:172-175`); 10
permit cards relayed, the last on 2026-10-18.

## 3. Why the strict reading

1. **Host tools are the model's.** A `js-harness` command costs no tokens and is deterministic.
   Moving the board onto `list_sessions` and `get_usage` would cost the lead turns and context,
   the failure the diet exists to cut (`wake-with-no-news`: about 60 wakes took a lead from 28 to
   72 percent). Mods are the exception: they run without the model.
2. **`start_session` needs his typed turn.** On a turn a notice, a background task, a compaction
   or another session's message started, the app refuses and leaves a card (`SKILL.md:45`). The
   lead wakes mostly on such turns.
3. **Side-session wake-ups are batched and fade.** One finished session waits for the slowest
   sibling; after many wake-ups with no message from him, they wait for his next turn, which is an
   unattended night.
4. **The host still asks in bypass mode.** `bin/permit.mjs:3-6`: on 2026-10-17 five sessions
   waited 12 to 38 hours on cards. The host gives no tool to answer another session's card.
5. **The phone is unverified** for every desktop surface but Remote Control and push. No row
   claims a phone replacement.

## 4. The map

Kinds: **done** (already the host's way), **use now** (change how we use it, no code removed),
**policy** (goes by his decision, not because the host replaces it), **probe** (moves only after a
probe or the mod pilot), **keep**.

| # | Harness piece | Host feature | Kind | Why, strictly | Saving |
|---|---|---|---|---|---|
| 1 | `permit` relay (`SKILL.md:29`) | none | **keep** | Section 3, point 4. Its use is low (10 relays, the last 2026-10-18), so whether he still wants it is his question, not a host replacement | — |
| 2 | Codex skill copies and Codex hooks in `install` | none needed: Codex only reviews (line 33574) | **policy** | Codex never leads or works; reviews already disable hooks and skills; today its `reply` hook overwrote a reader's answer | 8 install components; no runtime tokens |
| 3 | The lead's archive of a finished session (`SKILL.md:117`) | auto-archive on PR close (On) | **probe** | The app archives on merge, but the lead's checks (clean worktree, nothing queued, summary read, `manifest.mjs:227`) are not proven by a merge, and "running sessions don't auto-archive" while a background `wait` runs | ~150 tokens *estimate*; one lead turn per session |
| 4 | Recap prose (`SKILL.md:94-99`) | `wrap_up` recap | **use now** | The box carries 300 characters and one question; the effort line and the Codex meter stay in the reply | ~250 *estimate* |
| 5 | `reply` five states (`rule:reply-five-states`) | `wrap_up` `ask`, `blocked` | **probe** | "working" and "cut" have no field. Accepting a `wrap_up` decision needs the reply hook, stop-wake and the question gate taught it, with refusal tests | fewer blocked stops |
| 6 | Two-option questions held by AskUserQuestion (`SKILL.md:26`) | `wrap_up` ask + buttons | **probe** | Avoids holding the lead, but the gate (`template-gate.mjs:132-134`, matcher `hook-entries.mjs:188`) admits and tracks only AskUserQuestion; switching first needs that integration | ~300 *estimate*; no held lead |
| 7 | `sessions start` | `start_session` | **done** | Already the rule on his turns (`SKILL.md:45`); `sessions start` stays for the rest | — |
| 8 | `sessions stop`; 18 unremoved registrations | `archive_session`, inactive auto-archive | **use now** | Sessions from `start_session` end by archive; `claude --bg` registrations still need `sessions stop`, and the 18 need a cleanup of their own (section 7) | — |
| 9 | Lead rotation (`SKILL.md:123-127`) | `detach_session`, `start_session` | **keep** | Already written against these tools. `hand_off_to_session` is a fork: the "never by a fork" line stays | — |
| 10 | `wait` (a node process per wait) | side-session wake-ups, `notify_when_idle`, Monitor, a mod | **probe** | Wake-ups batch and fade; `notify_when_idle` is one-shot; Monitor dies at 30 minutes; a mod timer with `$.prompt.submit` is the candidate, and stop-wake must learn to see it (`stop-wake.mjs:106-112`) | after the pilot: a process per waiting session |
| 11 | `sessions --watch` | same | **keep** | Same reasons; it also sees gates, PRs and stalls | — |
| 12 | `notify` and the channel | `SendMessage` | **keep** | The channel is the record the board, report, stretch and land read | — |
| 13 | `sessions` board computation | `list_sessions`, `get_usage` | **keep** | Section 3, point 1 | — |
| 14 | Board: `sessions live` + ArtifactData by hand | mod pane; Artifacts | **probe** | The page is the only view from any browser; a mod pane lives in one session's view and does not feed the page. The rows owed by hand stay owed unless a mod can reach ArtifactData, which is [unknown] | after the pilot: most per-wake board turns on the desktop |
| 15 | `resume --pause` per tool call | mod hooks, `$.session.usage()` | **probe** | Same notice in-engine, without a process per call | after the pilot |
| 16 | `quiet --wait` + push | keep-awake setting | **keep** | The host keeps the PC awake; it never says when it may be turned off | — |
| 17 | `loop` | Monitor, TaskStop | **keep** | `taskstop-leaves-work-alive` still holds | — |
| 18 | `remote` | Remote Control | **keep** | Starting a local session from the phone still needs `claude remote-control` (memory note, not rechecked) | — |
| 19 | Remote Control after a restart (`host-update.mjs:96-104`) | `connect_new_sessions_to_remote_control` | **keep** | The setting covers new sessions; a restarted one is [unknown] | — |
| 20 | Relief file | transcript search | **keep** | Not a curated log | — |
| 21 | `stretch`, `report`, `merge-queue` | PR Auto-fix, Merge when ready | **keep** | Auto-fix does not build the candidate the land tests; Merge when ready would merge around the queue | — |
| 22 | Scheduled-task refusal | scheduled tasks | **keep** | Still Routines | — |
| 23 | Restart protocol | none | **keep** | No pause-all | — |
| 24 | Plan in replies | `update_plan` | **done** | No harness text duplicates it [checked: none in the skills] | — |
| 25 | `waiting` notices the model writes (`SKILL.md:148-150`) | `Notification` hook `idle_prompt` | **probe** | A hook could write `waiting` when a session goes idle, so silence is seen (`turn-ended-waiting`); whether `idle_prompt` fires in a desktop session is [unknown] | one model step per wait |

Counted: done 2 (7, 24), use now 2 (4, 8), policy 1 (2), probe 7 (3, 5, 6, 10, 14, 15, 25),
keep 13.

## 5. Mods

What a mod is [doc: the `plugin-authoring` skill, `reference.md` and `types/claude-code.d.ts`,
bundled build 2.1.309; the CLI is 2.1.314]: three files, a manifest and one hooks module. Its hooks
run in an environment with no DOM and no Node, and reach the world through `$`:

- **Drawing:** a pane beside the chat, a band above the prompt, a status-line entry, toasts, slash
  commands. A pane is "raised on every attached surface" (`terminal`, `desktop`, `vscode`,
  `mobile`); the mobile app draws no `Input` or `Select` yet; a pane opened unasked waits undrawn
  below 144 columns.
- **Work outside a turn:** `session.start` starts it; `$.clock.every` keeps it until the module
  reloads; `$.fs`, `$.process.run` (a host command by argv); `$.prompt.submit` queues a prompt that
  starts a turn once the session is idle; `$.session.send` messages another session;
  `$.session.usage()` gives the context fill and the plan windows without the model.
- **Hooks:** `tool.call`, `tool.check` (permissions), `prompt.submit`, `prompt.compose`, turn
  events.
- **Loading in the Code tab:** the install command is not available in a Code-tab session
  (`reference.md:130`). A mod loads there by hot reload, which asks him once per session ("Turn on
  the mods Claude writes in this session?") and writes under `~/.claude/dev-mods/`, or by an
  install at user scope from a terminal or the app's Plugins menu. Both are his decision.
- **Maturity:** "Added Claude Mods" in 2.1.287; 65 "Fixed" lines name a mod since then (counted in
  the changelog copy). A lost hooks worker restarts the module with its timers gone [doc].

His example, the board as a mod: **partly valid.** A pane in the lead can run `js-harness sessions
--json` on a timer and draw the board at zero model tokens on the desktop. It does not replace the
Artifact, which he opens from the phone without opening a session, and it does not send the page's
rows: those stay the lead's work unless a mod can reach ArtifactData.

The pilot, in a real Code-tab session (not `--plugin-dir`, which proves the terminal only):

1. He answers yes to loading mods in one scratch session (decision M1).
2. A wait mod reads a scratch channel every 120 s (`rule:wait-every`) and on a notice to its
   number calls `$.prompt.submit`.
3. A board pane in the same session runs `js-harness sessions --json`.
4. Checks, each recorded: the wake arrives within 130 s; how the transcript records the mod's
   prompt, and that `--quote`, `rule:person-present` and the reply hook do not read it as his
   words (`bin/lib/sessions.mjs:128-165`); whether a `start_session` on that turn is allowed;
   whether `$.process.run` runs the `js-harness` `.cmd` shim on Windows; memory of the session with
   the mod against one `wait` process; recovery after a module reload; whether a mod can call
   ArtifactData.
5. He opens that session from the phone over Remote Control and says what he sees.

## 6. How the lead and nested sessions should run today

1. **Starting.** On a turn he typed, `start_session` `user_asked`, `fresh`, its own worktree, its
   effort, `name` `jh-<n>`, title `JH <n> · <purpose>`. On any other turn, `js-harness sessions
   start`. Reserve sessions before he leaves, on his turn (`SKILL.md:127`).
2. **Waking.** The lead keeps `sessions --watch` and the resting `wait --notice-to orchestrator`;
   side-session wake-ups are a free extra, never the only wake. Work sessions keep `wait` until the
   pilot passes.
3. **Talking.** The channel stays the record; `SendMessage` to the session id carries steps and
   answers. `notify_when_idle` is not needed: the channel already says when a session waits.
4. **Questions.** Unchanged until row 6 is built: recorded first, AskUserQuestion under
   `rule:person-present`. After it, two-answer questions go in `wrap_up`.
5. **Closing a turn.** Every turn that worked ends with `wrap_up`, and the reply's last line still
   names its state for the Stop hook. A `sessions start` session has no `wrap_up` (step 5, below).
6. **Pull requests.** A work session binds its PR (`get_status`, `bind_pr`), sends `ready` and its
   `closed` with the summary before the land, and stops its own waits once `closed` is sent, so the
   app can archive it on merge. Auto-fix and Merge when ready stay off for PRs the merge queue
   lands.
7. **Ending.** Sessions from `start_session` end by archive; `claude --bg` ones by `sessions
   stop`. Before the lead is archived it detaches every session it started; a nested session whose
   lead is gone detaches itself (`detach_session self`) on the new lead's message.
8. **Research sessions** (his "entorno [...] de investigacion"): the built-in browser for pages,
   `WebFetch` with the harness's fallback, context7 for library docs, a claude-code-guide agent for
   the host's own docs, and a Spanish Artifact for what he reads. No new machinery.

## 7. Today's five frictions

| Friction | Cause | Fix | Check that it does not come back |
|---|---|---|---|
| Background sessions not stopped | `claude --bg` starts have no end but `sessions stop`; 18 registrations never removed | Start on his turns with `start_session` (archive ends them); `sessions stop` the stale registrations after reading each | `sessions` lists a registration with no live process and no notice for 24 hours as a gap [to build] |
| Stale worktrees | Worktrees of landed PRs; Orca workspaces (`git worktree list` shows 2 under `orca/workspaces`) | `js-harness clean` and `bin/lib/worktrees.mjs` list the safe ones; the app's own cleanup covers only its worktrees after 30+ days | `git worktree list` count against open PRs, in `doctor` [to build]. Today's list shows 7 entries on this repo [checked]; the 28 were counted elsewhere [unknown] |
| Sessions nested under an old lead | A side session is archived with its starter and reports only to it | Rotation detaches first (`SKILL.md:126`); a session already nested detaches itself on the new lead's message | `list_sessions` linked under the old lead is empty before it is archived |
| Waits killed by low memory | One node process per wait, plus two per tool call | Measure first: node processes and their memory over an hour of normal work; then the mod pilot | the measure, repeated after the pilot |
| Board rows owed by hand | Only the model writes ArtifactData | No host feature fixes it today; the pilot asks whether a mod can | rows sent against notices, from `sessions live` [exists] |

## 8. A standing role for each host release (proposal; a plan change, his)

Today the `host-update` row of `doctor` (`bin/lib/host-update.mjs:108-135`) turns an update into
review steps: read both changelogs, check the hooks, turn Remote Control back on, report, then
`doctor --host-reviewed`. Whichever session sees it does it inline, and it reads for breakage.
F8's S9 (`docs/ROADMAP.md:619`) watches gentle-ai alone, and gentle-ai leaves at S2.

Proposed: S9 becomes the **host watch**, run by a session of its own.

- **Wakes it:** the `host-update` row going `stale`. The lead opens `JH <n> · host watch
  <version>` on his next typed turn, or with `sessions start`.
- **Reads:** the Claude Code changelog from the reviewed version; the Desktop changelog for the
  same span; the host's tool list in a fresh session, diffed against the last recorded list (the
  desktop tools are undocumented, section 1); the `plugin-authoring` types when their build moves.
- **Delivers:** `docs/host-watch/<version>.md`, one row per new feature: adopt, adapt or ignore,
  the row of this map it touches, its evidence, Windows and phone checked or unknown; this map
  updated in the same PR; the review recorded only when that PR lands.
- **Reaches him:** a Spanish visual page (`rule:reports-spanish-visual`) and one recorded question
  per adoption (`rule:questions-one-place`).
- **Costs:** one session per release. The CLI shipped 2.1.304 to 2.1.314 recently and the desktop
  five releases from 2026-10-15 to 2026-10-29 [checked: the changelogs]; dates of the CLI entries
  are not in its file.
- **Probe:** `node --test bin/lib/host-watch.test.mjs` [to build]: a fixture changelog with one
  entry per class gives one row per entry; an entry it cannot place is listed for hand
  classification.

## 9. Desktop only

In this PR (his line 33574):
- `docs/ROADMAP.md`: a Decided row `Host (2026-10-30)` with his words; the `Hosts` row points to it;
  Principle 5 becomes "One host, one reviewer", Codex reading `AGENTS.md` alone. "Antigravity
  leaves the plan" is this proposal's reading of "unicamente y exclusivamente", his to confirm (D1).
- `AGENTS.md`: the opening says it sets up Claude Desktop's Code tab with Codex as its reviewer;
  line 17 says the commands run on any machine.

Later, each its own PR:
- `install`: drop the 8 Codex components, with `uninstall` removing earlier copies.
- What stays for Codex: `codex-review` and its isolated home, `codex-meter`, `codex-trust`, the
  Codex package install, and its codegraph registration while reviews use it [unknown whether they
  do].
- `init` and its template, `stack-install`'s Codex rows (`bin/lib/stack-install.mjs:22-37`), the
  Codex branches of `resume` (`bin/resume.mjs:986-994`), the reply hook's "both hosts" wording, and
  `rule:work-sessions-private-wsl`: each reread for desktop-only.
- Skill text: "where the host has no question tool" and "when the host gives you a tool" become
  plain statements.
- Rules, each through `rules change` with line 33574: `reply-five-states` (with row 5),
  `person-present` (with row 6), `live-board` (only if the pilot changes the board). None in this
  PR.

## 10. Savings

| Change | Code | Tokens (estimate) | Steps and processes |
|---|---|---|---|
| Recap and skill text to the host's way (rows 4, 7, 8, 9) | 0 | ~400 | — |
| Archive by the app (row 3, after its probe) | 0 | ~150 | one lead turn per session |
| `wrap_up` questions (row 6, after the gate work) | gate grows | ~300 | no held lead |
| Desktop-only skill text | 0 | ~300 | — |
| Codex components (row 2) | 8 entries and their tests | 0 at runtime | one less hook firing in Codex runs outside `codex-review` |
| Waits by mod (row 10, after the pilot) | `wait` stays for the lead | 0 | one process per waiting session |
| Pause and guard by mod (row 15, after) | hooks shrink | 0 | up to two processes per tool call |
| Board pane (row 14, after) | — | most per-wake board turns [unknown amount] | — |

About 1.2k to 1.4k tokens of skill text in all. The value is in processes and turns, measured
before and after the pilot.

## 11. Risks

- **The phone is unverified.** The pilot ends with him looking.
- **Auto-archive may not fire, or may fire early.** A running background wait blocks it; a merge
  does not prove the lead's checks. Probe before the skill changes (step 4).
- **Mods are young** (65 fixes since 2.1.287). `wait` stays as fallback until two weeks run
  clean.
- **Mods write under `~/.claude`** and must be recorded and undone exactly (`AGENTS.md`).
- **A mod's prompt may read as his words** to `--quote` and `person-present`. A pilot check.
- **The question gate** must learn `wrap_up` before any question moves there.
- **The Desktop tools are undocumented** and can change without a note.

## 12. Plan, in order

Each step is one PR and starts only on his yes. "Undo" is how it is reverted.

| Step | Change | Proof (exits 0) | Undo |
|---|---|---|---|
| 1 | Decided row and `AGENTS.md` wording (this PR) | `npm run check` | revert the commit |
| 2 | Cleanups: `sessions stop` the stale registrations after reading each; list and remove safe worktrees with `js-harness clean` | `sessions` shows no stale registration; `git worktree list` count recorded before and after | none needed for registrations; a removed worktree is recreated from its branch |
| 3 | Measure: node processes and memory over one hour of normal work | the measure file, committed | — |
| 4 | Probe auto-archive: a scratch session binds a scratch PR, sends `closed`, stops its waits; merge it | the session reads archived in `list_sessions include_archived` | unarchive |
| 5 | Skill text: rows 3 (if step 4 passed), 4, 8, 9 and the desktop-only wording | `node --test bin/install.test.mjs bin/lib/manifest.test.mjs`, `js-harness rules check` | revert; `install` rewrites the skill |
| 6 | Codex components out of `install`, `uninstall` of earlier copies, `HARNESS_HOOKS` in `scripts/practice-lib.mjs:351` and `bin/lib/manifest.test.mjs` updated | a scratch-home install and uninstall: nothing under `.codex/skills`, `.codex/hooks.json` without js-harness entries; `node --test bin/install.test.mjs` | revert and reinstall |
| 7 | Question gate and reply hook learn `wrap_up`; then `rules change reply-five-states` and `person-present` with line 33574 | new refusal tests in `bin/lib/template-gate.test.mjs` and `bin/reply.test.mjs`; `js-harness rules check` | revert; rules retire through `rules change` |
| 8 | Mod pilot (section 5), after M1 | the pilot's checks recorded in its feature document | turn the mods off for that session; delete its folder |
| 9 | His look from the phone | his answer, recorded | — |
| 10 | Work sessions wait by mod, after M2; stop-wake learns the mod's timer | `node --test bin/reply.test.mjs` with a mod-armed case (stop-wake is tested through the reply hook); the step 3 measure repeated | uninstall the mod; `wait` is still there |
| 11 | S9 becomes the host watch (section 8), after D2 | `node --test bin/lib/host-watch.test.mjs` | revert |

After each step: refresh the installed copy (`merge-queue --land --refresh-copy`), and move any
`docs/FAILURES.md` entry whose control the step removes to its new control.

### What each step found

Steps 2 to 5 ran in JH 107 on his answer to question 128 (the lead's transcript line 34672, "Sí, arranca el plan
(Recomendada)"); the detail is in `odd/tasks/f8-desktop-plan.md`.

- **Step 2, 2026-10-30.** Registrations: 18 recorded, 16 stale, each with its `closed` notice in the channel; the
  list went to the lead before anything was removed, and their `sessions stop` is the lead's, so the count is still 18
  until it runs. Worktrees: 9 → 8 in `git worktree list` [checked]: `merge-queue --prune` removed JH 105's
  `claude-app-native` once gentle-ai's ignored `.atl/` cache was deleted (the prune counts any ignored file as
  unsaved, rightly for an `.env`, needlessly for that cache). Kept: one with an open PR (596), Orca's two (S2), the
  land's two detached candidates (the lead's), the two live sessions. Five empty folders under `.claude/worktrees` stay
  "busy", held by a process [unknown which]. Found on the way, for row "Waits killed by low memory" of section 7: 111
  `node` processes of `ccstatusline`, the status line (`refreshInterval` 10), alive with no parent since 2026-10-28
  [checked: `wmic process`]; nothing was stopped by the step. They held about 4.3 GB of working set but only about
  0.4 GB private, as step 3 measured.
- **Step 3, 2026-10-30.** [`docs/audits/2026-10-30-process-hour.md`] Over one hour of normal work, about 20
  `claude.exe` held 4.2-4.7 GB private. All the `js-harness` processes together held 110-200 MB. A hook is never
  standing (at most one alive in a 10 s sample, about 1 MB mean), and a `wait` is about 36 MB while it runs. On his
  answer the lead stopped the 110 orphans at 18:48Z: 404 MB private, and free RAM rose by about 260 MB. No low-memory
  kill happened in the hour, so what drove the earlier ones is still [unknown]. For row 15 this means moving the
  hooks to a mod saves start time, not memory; for row 10, about 36 MB a waiting session.
- **Step 4, 2026-10-30: not run, the lead's to start.** JH 107 is a `claude --bg` session (`sessions start`), and
  none of the desktop's session tools is in its tool list (`ToolSearch` for `start_session`, `list_sessions`,
  `bind_pr`, `wrap_up`, `update_plan`: no match) [checked]; `start_session` also needs his typed turn. The steps and
  the scratch session's prompt are in `odd/tasks/f8-desktop-plan.md`, section "Step 4". Row 3 stays **probe**.
- **Step 5, 2026-10-30: no skill line removed; each row's reason.** [checked: `bin/lib/rules-data.mjs`,
  `bin/lib/manifest.mjs`]
  - Row 3: its line ("then archive the session with the host's tool to archive sessions, without asking") is a phrase
    of his rule `session-housekeeping`, homed in `bin/lib/manifest.mjs`; and step 4 has not passed.
  - Row 4: the recap's first two lines are the phrases of his rules `recap-effort-line` and `session-housekeeping`.
    Moving them to `wrap_up` is a rule change (R1), outside question 128. The other three lines (the Codex meter,
    what waits for him read at that moment, which session to return to) stay: the proposal keeps the meter in the
    reply, and a `sessions start` session has no `wrap_up` to carry the rest.
  - Row 8: the text already says it (`sessions stop <id>` "removes it once its work has landed"); the 16 stale
    registrations were practice, not text, and step 2 lists them.
  - Row 9: **keep** in the map; nothing to trim.
  - Desktop-only wording: "When the host gives you a tool to start sessions" and "when the host gives it a tool to
    archive sessions" stay true on the desktop alone, since a `sessions start` session runs without those tools. So
    section 9's "become plain statements" is wrong for them, and section 6.5's "every turn that worked ends with
    `wrap_up`" holds only for sessions the desktop app runs itself. "Only where the host has no question tool is a
    question written out" (`manifest.mjs:132`) could go, at about 16 tokens a load, against a Codex review and the
    lenses for a code commit. The gain is below the cost, so it is dropped.
  - Section 10's ~400 and ~300 tokens of skill text are therefore 0 within his yes; what remains needs R1.

## 13. His decisions

Each one asked alone, through the lead (`rule:questions-one-place`):

- **D1** Accept the `Host` row as written, including that Antigravity leaves the plan.
- **D2** S9 becomes the host watch (section 8).
- **D3** The removal plan's order (section 12), step by step.
- **D4** Drop the Codex install components (step 6).
- **D5** Keep the permit relay, or retire it knowing that cards in bypass mode then reach him in
  each session's window (row 1).
- **M1** Load mods in one scratch Code-tab session for the pilot (writes under `~/.claude`).
- **M2** Install the wait mod at user scope for every session (after the pilot).
- **S1** `auto_archive_inactive_days`: leave at never, or a number of days.
- **R1** The rule changes of step 7, each with its own words.
- Deleting stale sessions or worktrees with uncommitted work is never in step 2: each such case
  is his, one at a time.

## 14. What stays unguaranteed

- Every phone claim.
- The desktop tools' behaviour beyond their schemas.
- Whether two node processes per tool call cause the low-memory kills.
- Whether `idle_prompt` fires in a desktop session.
- Whether a mod can reach ArtifactData.

## 15. Review

Two blind readers, 2026-10-30, each given the whole text, his two lines and the cited paths.

**Codex** (`codex exec`, read-only, attacking the claims): "revise before acceptance;
specialization is faithful, but removal equivalence, savings, and acceptance proofs are not
established". Changed:
- The permit relay moved from drop to keep: the host shows cards in bypass mode
  (`bin/permit.mjs:3-6`), which the first draft missed (blocker).
- Questions in `wrap_up` now first need the question gate and the reply hook taught it
  (`template-gate.mjs:132-134`) (blocker).
- The Codex token saving went from ~12.6k to zero (`codex-review.mjs:365-386`), and the skill
  saving from 3.0k-4.5k to the itemized ~1.4k.
- The map's counts were split into done, use now, policy, probe and keep.
- Figures corrected: 8 Codex components, 1,750 notices plus 24 other records, 70 rule
  declarations, 65 mod fixes, 18 registrations rather than processes, 64.4 hours dropped.
- Auto-archive needs a probe; stop-wake must learn the mod's timer; proofs made specific.
- Its final answer was replaced by the Codex `reply` Stop hook's state line; the findings were read
  from its log, line 1912 on.

**Claude reader** (Opus 5.5, high effort, looking for what is missing): 19 items, 2 blockers.
Changed:
- The pilot runs in a real Code-tab session, since `--plugin-dir` does not reach it (blocker).
- Section 7 maps each of today's frictions to a fix and a check (blocker).
- The hook table and the missing host features (side chats, split view, hand-off, worktrees,
  `$.session.usage()`, `blockWritesOutsideWorkingDirectories`) were added.
- Section 13 lists his decisions; section 9 lists the Codex pieces that stay and the project-side
  pieces to reread; research sessions got a line; the Desktop changelog filled the "since" column;
  the pilot's checks for mod prompts and the `.cmd` shim were added; the plan got rollback,
  practice-lib, refresh and FAILURES steps.
- `AGENTS.md` line 17 now changes as the text said.

Second round: none run. No blocker is still open; what remains unproven is section 14.
