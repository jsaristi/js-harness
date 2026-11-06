**2.1.318**

**2.1.317**

November 3, 2026

**Added**

* Added a warning to `/schedule` when a new cloud scheduled task gets connectors you did not ask for, with how to remove them
* Added a check that asks before a web or shell tool call sends your account email address to the network
* Added `onFailure: "block"` for Agent SDK hook callbacks, so a callback that fails blocks the action instead of letting it run
* Added a notice in Claude Desktop's Code tab when your organization's remote managed settings haven't loaded for the session, and another once they do
* Added a notice when auto mode's check has no answer for a subagent's tool call, which used to leave nothing in the main view
* Added `anthropic.plan`, `anthropic.seat_type`, `anthropic.provider` and `anthropic.custom_base_url` to OTel metrics, events and spans
* Added a cost report to the Claude apps gateway admin API, `GET /v1/organizations/analytics/cost`, for reading past spend over a date range in total, per developer, per day or per IdP group
* Added a daily record of each developer's IdP groups on Claude apps gateways with `admin:` set, kept for `admin.identity_retention_days`, which the cost report groups by
* Added `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID`: set it to `1` on a self-hosted runner to have `claude -p` run inside a session use that session's ID and transcript, as in earlier versions
* \[Cloud sessions] Added a link card to cloud sessions, so you can open or decline a link an MCP server asks you to visit instead of the request going unseen

**Changed**

* Changed SendMessage so a message to a running background agent arrives earlier: its running command moves to the background, without being stopped
* Changed subagents and teammates on a different model from the main conversation to use that model's saved effort level or its default, instead of the session's effort level
* Changed exit to skip the "Background work is running" prompt for plugin monitors
* Changed the built-in `plugin-authoring` skill to offer once, after a mod you built works, to help share the mod
* Removed the Read tool's "file unchanged since your last Read" stub: reading an unchanged file again returns its content
* \[Cloud sessions] Changed the organization environment dialog in admin settings to the personal dialogs' short layout: each section opens from a row, and unsaved input asks before closing
* \[Claude Tag] Changed newly pasted artifact links in Slack to show a simpler card with an Open button that opens the artifact in Claude, instead of Slack's side panel

**8 improvements**

* Improved the error shown on Microsoft Foundry when Azure credentials can't be loaded: it now says to check or refresh them, and reports as `cloud_credential_error`
* Improved `/design-sync` to say up front when your design system has moved to Claude, and stop before building instead of failing at upload
* Improved the startup error when a required Claude apps gateway can't be reached: it points to the network instead of a sign-in, and says when the gateway's TLS certificate can't be verified
* Improved the "Resume this session with" hint shown at exit to repeat the flags you launched with (for example `--chrome --debug`) ahead of `--resume`
* Improved how self-hosted runners recover from server errors: after a 5xx other than 501 or 529, a runner's next poll now opens a new connection instead of reusing the one that failed
* Improved how self-hosted runner sessions recover from server errors: after a 5xx other than 501 or 529, a session now opens new connections instead of reusing the one that failed
* Improved how self-hosted runner sessions recover when connections stop answering: after a heartbeat gets no answer, a session now opens new connections instead of trying each idle one in turn
* Remote Control: Improved fork names when the app doesn't set one: a long name keeps its "(fork)" ending, and in sessions started with `claude remote-control` a fork of "Name (fork)" is "Name (fork 2)"

**62 bug fixes**

* Fixed project and local MCP servers disconnecting after the first turn in some Claude desktop sessions
* Fixed auto mode failing every turn when an LLM gateway set as the base URL answers 403 or 422 to its server-side safety check (a 403 with an apiKeyHelper is unchanged)
* Fixed `claude auth status` exiting before a slow token refresh was saved, which could sign you out on the next run
* Fixed a project's `effortLevel` setting being ignored by sessions that an app starts ahead of time and then opens in the project, such as new sessions in the desktop app's Code tab
* Fixed `claude --from-pr` reporting "No conversations found" in projects with many sessions when the linked session was older than the first page
* Fixed the second of two simultaneous permission prompts showing no file path or command on claude.ai and the mobile apps
* Fixed Remote Control and SDK hosts offering "don't ask again" on a mod's tool calls
* Fixed session titles being lost in cloud and SDK sessions when a new message or Stop arrived while the title was generating
* Fixed self-paced `/loop` wakeups sometimes not being scheduled when Claude left a field out of its request
* Fixed auto mode in cloud sessions stopping for approval when the Artifact tool uploaded, wrote to a database or saved a file through the outputs folder
* Fixed skills synced from claude.ai being lost or downloaded again every ten minutes when they can't be written to disk
* Fixed `/schedule` leaving a cloud scheduled task's next run time and link out of its results after creating or updating it
* Fixed screen readers speaking a running subagent's elapsed time and token count on every change in screen reader mode
* Fixed a region or network block (HTTP 403) being shown as a sign-in failure; the error now explains the block
* Fixed Claude saying a working claude.ai connector needed authorization or had failed in cloud sessions when a synced plugin included the same server
* Fixed `claude -p` exiting 0 when a full disk or quota lost its transcript or \~/.claude.json writes; it now prints an error and, in text and json output, exits 1. Full NFS exports may be missed
* Fixed edits to settings files made in the first second or so after launch not taking effect until a settings file changed again
* Fixed old transcripts not being cleaned up on machines where some runs skip cleanup, such as runs using `--setting-sources`
* Fixed deleted agent team inboxes being re-created by a teammate's late message
* Fixed a re-created agent teammate being removed from its team by an earlier shutdown approval
* Fixed stored scheduled tasks being impossible to list or delete after scheduled tasks were turned off
* Fixed Claude deleting your most recently updated `/team-onboarding` guide when asked to delete one without naming which
* Fixed Claude saying a `/team-onboarding` guide was deleted when the server refused the delete
* Fixed the Claude apps gateway hiding Amazon Bedrock's "Input is too long." error, which left sessions failing every turn with "upstream rejected the request" instead of compacting
* Fixed self-hosted runner sessions losing recent turns or the whole conversation when restarted while a plan waited for approval
* Fixed "Prompt is too long" after automatic compaction in sessions whose very large CLAUDE.md changed since it was last sent
* Fixed high memory use and slow startup in headless sessions with many plugins that register commands
* Fixed stdio MCP servers receiving an empty `AWS_BEARER_TOKEN_BEDROCK` when their env config sets it to empty; the variable is now unset, so the server can use the machine's own AWS credentials
* Fixed API requests failing with "unable to get local issuer certificate" behind some TLS-inspecting proxies after a root certificate renewal
* Fixed very long conversations losing their earlier summary when compaction had to shorten its own request
* Fixed a PDF's own metadata being able to make Read and @-mentions under-count its pages
* Fixed `DISABLE_PROMPT_CACHING_OPUS` and `DISABLE_PROMPT_CACHING_SONNET` having no effect on `[1m]`, other-region and undated spellings of the default model
* Fixed `/artifacts` and the Artifact tool's shared list showing no shared artifacts when you have 200 or more of your own
* Fixed Claude treating partial Grep and Glob results as complete when a search hit its time limit
* Fixed OpenTelemetry exports to an `https://` endpoint through a proxy never being sent when they started while another export was still in progress
* Fixed a flood of connection attempts to a proxy that blocks (HTTP 403) OpenTelemetry exports to an `http://` endpoint
* Fixed OpenTelemetry exports hanging indefinitely behind a proxy that never answers; they now time out after 10 seconds, or `OTEL_EXPORTER_OTLP_TIMEOUT` up to 30 seconds
* Fixed resumed sessions telling Claude again about a file change it already knew about
* Fixed Claude sometimes not using a built-in tool in a resumed session after an earlier call failed because the tool was switched off
* Fixed `/remote-control` answering "Unknown command" instead of saying that Remote Control is turned off by the `disableRemoteControl` setting
* Fixed agent team teammates in tmux or iTerm2 panes starting in auto mode when the lead session was in manual mode
* Fixed a background session sometimes losing a just-made change of permission mode when it was upgraded or retired
* Fixed Ctrl+C stopping all running background agents when pressed to clear typed text at the prompt
* Fixed /feedback showing "Enter to confirm" while a report is being sent
* Fixed child processes of a stopped shell command sometimes being sent SIGTERM twice, which could make some programs skip their cleanup
* Fixed `claude -p` run inside a cloud or self-hosted runner session sharing that session's ID: it wrote into the session's transcript, and a restart could resume the wrong conversation
* Fixed `claude -p` run inside a cloud or self-hosted runner session generating a title of its own and sending it to that session
* Windows: Fixed every tool call being refused on some volumes where the native path lookup fails; the working-directory check now compares the folder's identity instead
* Windows: Fixed the session scratchpad and other temporary paths growing with your project's path length in sessions not started by Claude Desktop, which made repositories cloned into them hit the 260-character path limit
* Gateway: Fixed the status line and `/usage` showing a developer's own spend limit as 100% used after their group's pooled budget ran out
* Self-hosted runner: Fixed Claude not seeing the interrupted tool call when a session moves to a new runner and the turn is older than `CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS`
* Self-hosted runner: Fixed an MCP server that was switched off coming back on after the session moved to a new machine, when the session service had refused to save the switch
* \[VSCode] Fixed forked conversations dropping messages: only one of the tool calls Claude ran in parallel was kept, and the last messages a compaction kept were lost, which could leave Claude's answer without the question it answered
* \[VSCode] Fixed a message being lost when Claude did not finish starting in time: the extension now starts Claude once more before showing the error
* \[VSCode] Fixed the sign-in screen opening when a request is blocked for its region or network
* \[VSCode] Fixed the Account panel showing the plan name with a lower-cased second word
* \[VSCode] Fixed file links in a Claude tab opening on top of the chat instead of in another editor group
* \[VSCode] Fixed attachment chips, menus, banners and dialogs in the Claude panel staying small when `chat.fontSize` is raised
* \[VSCode] Fixed `ultrathink` not raising effort for its turn or showing its rainbow when telemetry is off
* \[Cloud sessions] Fixed adding a network secret for a host that already has one silently replacing it; the Add secret form now refuses and points you to the existing secret
* \[Cloud sessions] Fixed new scheduled tasks ignoring your organization's default environment: the form now starts on the one an admin chose instead of the Anthropic-hosted default
* \[Remote Control] Fixed the next message to an idle session going unanswered after you restart `claude remote-control`, when you sent it within a minute of your previous message

**2.1.316**

October 31, 2026

**Added**

* Added `CLAUDE_CODE_DISABLE_ULTRATHINK`, which turns the `ultrathink` keyword off
* Added pooled group budgets to the Claude apps gateway: one monthly budget that a group's members share, on top of each member's own limit, set with `pooled_budget` on the spend limits admin API
* Added `CLAUDE_CODE_DISABLE_LOOPED_CROSS_CERT_DROP` to keep system cross-certificates that certify each other in a loop, for servers whose private CA needs one
* Added `CLAUDE_CODE_SUBAGENT_EFFORT` to set the effort level subagents run at when nothing else names one, instead of inheriting the session's
* Added `managed.policy_mode: layered` to the Claude apps gateway: every policy that matches a developer applies, each merged over the ones listed below it, not only the first
* Added `guardrail.input_tagging` on Claude apps gateway Bedrock upstreams, which wraps prompts in the input tags that an Amazon Bedrock guardrail's prompt attacks filter needs; `all_messages_and_system` also tags the system prompt
* \[VSCode] Added sign-in to a Claude apps gateway from the chat panel, with no terminal needed
* \[Cloud sessions] Added a form card to cloud sessions, so you can fill in or decline a form an MCP server asks for instead of the request being canceled without you seeing it
* \[Cloud sessions] Added a "Catching up…" line that shows while a cloud or Remote Control session you switch back to is still bringing its messages up to date
* \[Code Review] Added a findings-by-severity card to the Code Review analytics page, showing the period's total findings, a daily chart stacked by severity, and each severity's count

**Changed**

* Deprecated fast mode for Opus 4.8 as of October 30, 2026; it will be removed on November 30, 2026. After removal, fast mode requests on Opus 4.8 return an error and do not fall back to standard Opus 4.8. Migrate to Opus 5.5 to keep the speedup
* Changed auto mode so that an `autoMode.allow` list without `"$defaults"` no longer removes the built-in rule on scheduled-task prompts
* Changed server-managed settings for Team and Enterprise logins: settings fetched from Anthropic's API now apply without an approval prompt, and a stored copy that doesn't verify is refused
* \[VSCode] Changed `ultrathink` to run its turn at `xhigh` effort and show in a rainbow in the chat box, as in the terminal
* \[Cloud sessions] Changed network secrets so Enterprise members can add and delete them on their own cloud environments, instead of only viewing them
* \[Claude Tag] Changed a Slack channel's Respond automatically switch to a "How Claude participates" choice on the channel's Configure page and in Claude Tag admin settings

**5 improvements**

* Improved `/code-review` started from the Code tab in Claude Desktop or on the web: cloud and `claude remote-control` sessions now show the findings card, not a plain-text list
* Improved `/diff` on large repositories: each refresh usually runs one fewer full-repository git command, and refreshes are spaced out when git is slow
* Improved the messages shown when `/ultrareview`, a cloud session or a cloud agent finds no GitHub remote: they now say to create a repository at [https://github.com/new](https://github.com/new), and `/ultrareview` no longer suggests a `gh` command that `gh` rejects
* Improved SSL certificate errors to name the likely causes, among them a server that leaves out an intermediate certificate, and the fix for each
* \[Cloud sessions] Improved the Changes pane for cloud sessions: the note about what the list leaves out is now a badge beside the branch name, not a row above the diff

**34 bug fixes**

* Fixed shell commands being left running on macOS and Linux when Claude Code exits by itself, for example when credentials are refused or a cloud session is archived
* Fixed bash aliases with line breaks in their value (except in Git Bash), and functions whose names start with a dash, being garbled or lost in the Bash tool's shell
* Fixed bash scripts started from the Bash tool stopping after their first command when `SHELLOPTS` is exported
* Fixed PowerShell hooks not blocking on exit code 2 when the command begins with a type cast, `param`, `using` or an attribute
* Fixed some network requests hanging when a compressed response was cut off or corrupted
* Fixed `sonnet`, `opus` and `haiku` on Vertex AI and Amazon Bedrock showing an error mid-session instead of switching to an older model when the newest is not yet available to the account or region
* Fixed the Claude apps gateway not checking every model a request names against `availableModels`, `deniedModels` and `models`; a request that names a blocked model now gets a 400 naming the field
* Fixed `claude auth login` refusing to run where managed settings require a Claude apps gateway; in a terminal it now shows the gateway sign-in
* Fixed `--restricted` sessions uploading files from outside the working directories when a Read allow rule covered them
* Fixed prompts containing invisible characters needing a second Enter to send; plain prompts now send cleaned on the first Enter, and commands still wait for review
* Fixed sub-agents that inherited a parent sub-agent's model moving to the main model when a background job or message woke them
* Fixed a managed `autoMode.allow` list without `"$defaults"` getting the built-in exceptions back from a host app's `--settings`, a first rule added in `/permissions`, or `/auto-mode-setup`
* Fixed cloud sessions and cloud scheduled tasks not being marked as failed when auto mode stopped a turn because the server returned no safety verdict
* Fixed `claude -p` text output sometimes not saying why auto mode stopped a turn when a background agent was still running
* Fixed `CLAUDE_CODE_AUTO_MODE_SERVER=1` being ignored in sessions started by a host application (such as Claude Desktop) behind a proxy or LLM gateway with experimental betas turned off
* Fixed plugin MCP `headersHelper` scripts receiving a corrupted `CLAUDE_PLUGIN_ROOT` and server URL when a credential-named environment variable was set to a switch value such as `1`
* Fixed the SDK `register_repo_root` control request not loading the CLAUDE.md of a directory outside the working directory (with `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`)
* Fixed the Artifact tool showing `?` for artifact database access rules at the `self` level, and not quoting those rules back when it refuses a republish that would drop them
* Fixed `/model <id>` not warning when the model isn't recognized by this version and auto-compact will assume a 200K context window
* Fixed the "hold space to speak" hint using up its three showings in one session, and showing an empty key when push-to-talk is unbound
* Fixed Grep and Glob never returning when the search process is killed at the timeout but does not exit, seen on Windows
* Fixed a rare case where resuming a conversation did not restore its plan, when `/clear` or `/resume` had been run while part of that conversation was still being saved
* Fixed first-run setup dropping words from the security notes and the terminal-setup explanation in narrow terminals
* Fixed the Enterprise survey card taking a typed 1 or 0 after a short pause; a typed answer now needs Enter
* Self-hosted runner: Fixed a message sent while Claude was working being answered after a Stop, once the session's process had been replaced
* Self-hosted runner: Fixed an MCP server's on/off switch sometimes being lost when a session moved to a new machine
* Windows: Fixed the Bash tool losing your aliases and functions in Git Bash when the rc file sets errexit and pipefail and only winpty aliases, or none, are defined
* \[VSCode] Fixed the missing Effort slider, Ultracode switch and model name when the model setting has the `[1m]` tag, such as `opus[1m]`
* \[VSCode] Fixed saved `/btw` side-question history being deleted too early while a settings file has errors
* \[VSCode] Fixed a conversation coming back in Auto mode after a reload or restart when its plan was approved with "Yes, and manually approve edits"
* \[Cloud sessions] Fixed file search in a cloud session's Files pane showing folders as ../.. paths after Claude changed directory; results now show their path from the project's root
* \[Claude Tag] Fixed Claude refusing to edit or append to a canvas it made in a Slack channel, from that channel, once the canvas was also shared to another channel or a DM
* \[Claude Tag] Fixed untagged replies going unanswered in a Slack Connect thread when both organizations have installed Claude and Slack delivered the reply to the other organization's app
* \[Claude Tag] Fixed a cloud scheduled task's live status checklist in Slack staying half-done; a run can now edit the top-level messages it posted during that run

**2.1.314**

October 30, 2026

**Added**

* Added `permissions.blockWritesOutsideWorkingDirectories`: Write, Edit and NotebookEdit refuse paths outside the working directories in every permission mode
* Added an optional `groups` list to Claude apps gateway upstreams: only developers in the listed IdP groups are sent to that upstream, on failover too
* Added `guardrail_trace` to Claude apps gateway Bedrock upstreams, to log which Amazon Bedrock guardrail filter fired on a request, without the matched text
* Added idle compaction to VS Code and Claude Desktop's Code tab: a 200K+ token conversation left idle is summarized, and the summary is used on your next message if the prompt cache has expired
* \[Cloud sessions] Added an Include completed button to the Scheduled tasks page when finished one-off tasks are the only ones hidden, so you can show them without opening the Sort menu
* \[Claude Tag] Added a dismissible link to the Claude Tag API docs on the Bundles and Channels tabs in admin settings, for Enterprise organizations with Slack connected

**Changed**

* Updated the `/claude-api` skill: its Datadog setup for API tracing now sends the `dd-llmobs-enabled: true` header, as the Console does, and its `ant` install instructions drop the outdated macOS `xattr` step
* Updated the bundled dataviz skill to advise printing y-axis tick labels in full under 10,000, and horizontal ones in full under a million where they fit
* Updated the bundled dataviz skill to answer donut and pie chart requests with ranked bars or a segmented bar that prints its values
* Changed Claude's file tools to ask before editing the local copy of your organization's server-managed settings, as they do for your settings files
* Changed `/ultrareview` to check workspace trust before it runs git, as `claude ultrareview` does
* Changed the Bash tool's shell to clear any inherited `which` alias or function and to stop passing exported `which`/`unsetenv` functions to commands, so `which` is the system command or zsh builtin
* Changed `/permissions` Recently blocked to refuse approving a call you can't read in full, including one the terminal is too short to show
* Changed auto mode in Cowork cloud sessions: a hook's allow of an MCP tool call now counts as no answer, so the classifier or a permission prompt decides
* Changed hook `if` conditions such as `Monitor(tail *)` to match the Monitor tool's shell commands as `Bash(tail *)` matches Bash's
* Changed the `claude-api` skill to ask to read a Managed Agents workflow run's workflow before changing the agent to improve that run
* Changed flagged requests to retry on another model, not end in a refusal, when `ANTHROPIC_DEFAULT_OPUS_MODEL`, `availableModels` or `deniedModels` leaves only an older Opus model, or none
* Changed idle compaction to also run for subscribers with telemetry turned off, and on Bedrock, Vertex, Foundry and LLM gateways once the one-hour prompt cache is on
* Changed `FORCE_HYPERLINK=false` (also `no` and `off`) to turn hyperlinks off instead of on
* macOS: Changed `git grep` in most commands that Claude runs to use the C locale, to avoid a reported memory leak in macOS's regex library on files that aren't valid UTF-8
* \[VSCode] Changed `CLAUDE_CODE_DISABLE_CFC_PROMPT` to also stop the extension adding the Claude in Chrome instructions to a session's messages; the browser tools stay available
* \[Cloud sessions] Changed cloud sessions from the web, desktop and mobile apps to start even when a setup script exits with an error, instead of failing to start

**16 improvements**

* Improved memory use in long headless and SDK turns that run many subagents: the parent session no longer keeps each subagent's tool results until the turn ends
* Improved prompt history: Ctrl+R now matches text inside collapsed `[Pasted text]` pills
* Improved the `/design-sync` upload prompt to show the folder, the project and the files it will upload or delete
* Improved `/permissions` review tab, now called Recently blocked: the footer says what Esc will do with marked rows
* Improved auto mode's blocked calls: messages name the command, say Claude may retry and auto mode checks again, and point to `/permissions` to review
* Improved permission prompts: a long reason takes fewer rows, so it pushes the command being approved off the screen on fewer terminals
* Improved the cloud session error shown while a request refused for your claude.ai login is still being retried: it now also suggests `claude auth login`
* Improved the behavior of stored claude.ai, Team, and Enterprise logins when MDM and remote settings differ on base URL or `apiKeyHelper`
* Improved `/config` in agent view to say how to stop agent view opening by default
* Improved session auto-titles: a session that starts with a skill or a prompt-based command such as `/security-review` now gets a title from it instead of staying untitled
* Improved `--resume` speed and memory use on damaged transcripts
* Improved `/context` speed in sessions with ten thousand or more MCP tools
* Self-hosted runner: Improved the error shown when a session's branch isn't on the git remote: it now covers a never-pushed branch, says how to fix each case, and no longer suggests retrying
* \[Cloud sessions] Improved scheduled tasks: runs in Anthropic's cloud now load the plugins enabled on your claude.ai account
* \[Cloud sessions] Improved Test connection for GitHub Enterprise in admin settings to also connect the way cloud sessions do, and to warn you when that second test fails
* \[Cloud sessions] Improved cloud session transcripts: a rename row now names the new title, and repository and environment lists show as a table instead of one line of JSON

**81 bug fixes**

* Fixed sessions failing turn after turn with "Invalid effort level" when an organization's admin caps a model's effort: Claude Code now lowers the effort, retries, and says which level it uses
* Fixed `claude -p` exiting with code 0 and no output when startup failed; it now prints the error and exits 1
* Fixed Bedrock sessions with many images failing every turn and `/compact` with "400 Input is too long." instead of removing older images and compacting
* Fixed Microsoft Foundry sessions failing when the resource has no deployment for the default Sonnet, Opus or Haiku model: Claude Code now falls back to an older model of that family
* Fixed repeated refused requests behind a gateway that doesn't accept tool search's `tool_reference` blocks: the request is sent again once without tool search, and the session remembers
* Fixed TLS connections failing with `UNABLE_TO_GET_ISSUER_CERT` when the system certificate store holds a renewed root certificate that is cross-signed with its predecessor
* Fixed MCP servers that also work without sign-in showing "needs authentication" after their stored sign-in stopped working; they are now used signed out
* Fixed `claude mcp logout` reporting success when the MCP sign-in was not removed, for example while the macOS keychain is locked over SSH
* Fixed extra sign-in renewals when several sessions share an Anthropic profile login and the credentials lock is busy
* Fixed `claude ultrareview` and `claude remote-control` asking the workspace trust question in a CI job that has a terminal; with `CI` set they now refuse an untrusted folder at once
* Fixed an administrator's TLS trust settings in managed settings not being applied in Claude Desktop sessions
* Fixed model switching being refused on machines with managed plugin settings when one of your own `--plugin-dir` or `--plugin-url` plugins had a broken manifest or failed to download
* Fixed the Bedrock and Vertex model upgrade offer coming back at every start when managed settings pin the model
* Fixed `forceRemoteSettingsRefresh` set only in remote managed settings no longer applying once the stored copy had expired, which let sessions start without policy when the server could not be reached
* Fixed "Continue automatically at usage limit" continuing more than three times without a prompt from you when a task restarted itself between waits (a /goal check-in, a background or scheduled task)
* Fixed background and cloud sessions started with Ultracode turning it back on at their next start after it had been switched off
* Fixed the last broken reply and its retry prompts staying in the conversation after Claude gave up on a tool call that could not be parsed
* Fixed a PreCompact hook with very large output making compaction fail or repeat; each hook's output is now cut at 10,000 characters
* Fixed background diff refreshes briefly taking the repository's index lock, which could make a git command run at the same moment fail with "Unable to create '.git/index.lock': File exists"
* Fixed markdown tables jumping between grid and stacked layouts on half-typed rows while streaming, and long tables falling back to raw pipes
* Fixed the /resume picker showing the text of CLAUDE.md or CLAUDE.local.md as a session's title when the session only ran slash commands
* Fixed `/btw` answering from the main conversation when asked from a subagent's open transcript
* Fixed pasting an image over SSH to a Linux machine doing nothing silently; the prompt now says to copy the file over and paste its path
* Fixed `claude remote-control` sessions that failed to start when the session service was slow for a moment: the worker's registration is now retried with growing waits
* Fixed model switches over Remote Control that take over 8 seconds getting a "still pending" error instead of the final result
* Fixed the `sandbox.excludedCommands` setting description saying listed commands always run outside the sandbox; it now says every command in a call must match an entry
* Fixed shell and MCP calls that auto mode, a deny rule or a PreToolUse hook blocked, or that otherwise did not run, reading as if they ran in a collapsed tool group
* Fixed sandbox protections not applying to a worktree entered by `claude -p --resume` or `--continue`
* Fixed hooks matching Bash not running on shell commands started by the Monitor tool; such hooks can block or ask, but not approve or rewrite those commands
* Fixed a settings file excluded with `--setting-sources` still supplying some settings, such as auto mode rules and saved permission consents
* Fixed auto mode reporting a call as blocked, and listing it in `/permissions`, when its safety check gave no verdict
* Fixed a Claude apps gateway Vertex upstream hanging for minutes when a Google token endpoint accepts the connection and never answers
* Fixed the Claude apps gateway's start-up warning for a deprecated Claude Desktop key that it still serves as written saying "stops being accepted" after the key's end date
* Fixed `/upgrade` opening the browser and starting a new login for plans billed through the App Store or Google Play; it now says where to change the plan
* Fixed `--resume`, and rewinding past a switch to another model after a refusal, moving a session on a model name Claude Code doesn't recognize to a different model
* Fixed requests failing when a gateway or cloud provider refuses one of Claude Code's beta headers by name: the request is sent again without it
* Fixed model IDs spelled with a dot behind an LLM gateway, such as `claude-opus-4.8`, being treated as an older model with the wrong context window, output limit, effort, thinking mode and cost
* Fixed Remote Control clients showing a stray "Compacted (ctrl+o to see full summary)" row after /compact
* Fixed the cloud sessions tip and the Remote Control idle notice showing when an organization's policy turns those features off
* Fixed a resumed claude.ai cloud session making a model call nobody asked for when the previous worker stopped just after receiving a new chat's files
* Fixed WebFetch in Cowork cloud sessions silently dropping a PDF's text past 100,000 characters; it now says how much was unread and where to read on
* Fixed Claude being told only that a command was declined after you stopped it with Esc or Stop in a cloud session or the IDE; it now also hears that the command may have run
* Fixed blank lines at the top of a code block disappearing when the code block opens a quote
* Fixed a blank line appearing above some `⎿` rows in the transcript view (Ctrl+O)
* Fixed vim mode `dw`, `dW`, `yw` and `yW` carrying on past the end of the line, and made `w` and `W` stop on empty lines
* Fixed x and Enter in the agent panel sometimes acting on the wrong agent when another agent started or finished
* Fixed pasted text and dragged-in files being lost in Claude's question dialog unless the "Other" row had focus
* Fixed pasted text being lost when a row in the prompt footer was selected
* Fixed vim mode `p` over a character selection ignoring whether the yanked text was whole lines
* Fixed vim mode `aw` and `iw` taking the line break at the end of a line
* Fixed ↓ selecting footer items hidden by the ? help menu, the command list or a paste hint
* Fixed Esc on a command's panel, such as `/btw`, also interrupting the subagent whose transcript is open
* Fixed the welcome header in fullscreen mode showing the session's model while viewing a subagent or teammate that runs on a different model
* Fixed the fullscreen transcript being left mid-conversation after "Restore conversation" in the rewind menu while scrolled up
* Fixed a rare case where a deleted session could reappear in the resume list as an almost empty entry
* Fixed prompts containing tags such as `<bash-stdout>` or `<local-command-stdout>` not being acknowledged to a local stream-json host
* Fixed sessions staying untitled when the first prompt failed (for example on a usage limit) and the conversation continued afterward
* Fixed the skill file watcher checking every removed skill kept in `~/.claude/skills/.trash`, which added file system load that grew with each removal
* Fixed the session name from /rename disappearing while Claude asks for permission or a plan decision, so side-by-side sessions stay identifiable
* Fixed background sessions that fail to start being reported as a deleted daemon binary when the binary is still on disk
* Fixed the tip and idle reminder about push notifications appearing when the push settings in `/config` are hidden or your organization has turned off Remote Control
* Fixed `~/.claude/skills/.trash` and `~/.claude/plugins/.trash` growing without limit: each now holds about 1024 entries, whatever `cleanupPeriodDays` says
* Fixed the Bash edit diff listing a whole file as changed when a CRLF file under git's line-ending conversion was re-saved unchanged or had one line edited
* Self-hosted runner: Fixed an idle session moving to another runner instead of pausing when the runner's request to pause it lost its connection before Anthropic answered
* \[VSCode] Fixed "Clear authentication" for MCP servers reporting success when the saved sign-in could not be removed
* \[VSCode] Fixed missing spinner and Stop button while a queued message's hooks run
* \[VSCode] Fixed session group changes that cannot be saved, such as a delete, failing silently; an error notification now appears
* \[VSCode] Fixed Cmd+F / Ctrl+F not opening the find widget in the plan preview tab
* \[VSCode] Fixed the voice dictation shortcut (Ctrl+D) doing nothing under non-Latin keyboard layouts such as Russian, Greek or Hebrew
* \[VSCode] Fixed missed one-time saved scheduled tasks being deleted without asking when the extension opened without a chat
* \[Cloud sessions] Fixed recently used self-hosted environments never appearing among the recent environments on the new session card
* \[Cloud sessions] Fixed cloud sessions reporting uncommitted changes every turn after Claude moved a branch to a commit it had pushed from another worktree
* \[Cloud sessions] Fixed the self-hosted environment details dialog in admin settings squeezing its content out of view in very short windows or at high zoom; the dialog now scrolls
* \[Cloud sessions] Fixed the permission mode picker staying on Auto after a running cloud or Remote Control session refused the switch; it now shows the mode in use and tells you
* \[Remote Control] Fixed the permission mode button in Remote Control sessions showing the wrong mode until you typed; while your computer is online it now shows the real mode on open
* \[Claude Tag] Fixed `@Claude !restart` giving up after one failed workspace check in channels shared across Enterprise Grid workspaces; it now retries, then asks you to run it again
* \[Claude Tag] Fixed a second confirmation DM and channel note when you connect your Claude account from Slack twice from the same link within a few minutes
* \[Claude Tag] Fixed follow-up messages in Slack showing no sign of progress while Claude's session waits for a self-hosted runner; Claude now posts a wait notice in the thread
* \[Claude Tag] Fixed Claude sometimes not answering a tag in its own thread in Slack Connect channels where both organizations have installed Claude
* \[Claude Tag] Fixed Retry on plugin and skill pages in Claude Tag admin settings discarding unsaved access changes after a failed load; your edits now stay in place
* \[Claude Tag] Fixed the repositories control in Claude Tag admin settings showing the same action twice; its menu now lists only what the button doesn't already do

**2.1.312**

October 27, 2026

**Added**

* Added `oidc.user_id_claim` to the Claude apps gateway, to identify people by an id\_token claim other than `sub`, such as Microsoft Entra ID's `oid`
* Added click to send: in fullscreen, clicking the "to send now" hint under a queued message sends it right away, as its key does
* \[Cloud sessions] Added an effort level to the model picker when you create or edit a routine that runs in the cloud
* \[Cloud sessions] Added a Bash editor with colors, line numbers and a Copy button to the setup script box in cloud environment settings

**Changed**

* Changed Bedrock, Vertex, Foundry and Mantle to use the shorter system prompt for model names Claude Code doesn't recognize, such as custom deployment names and inference profile ARNs, even when they front Sonnet or Haiku; set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` to keep the full prompt
* Changed automatic model switches after a flagged message to also cover model names Claude Code doesn't recognize, such as custom deployment names; set `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1` to turn them off
* Changed usage limit messages to call the 5-hour window the "5-hour limit" instead of the "session limit"
* Changed cloud sessions started from the CLI to get their names and branch names from the server
* Changed prompt and agent hooks to run at most 24 at a time per session, sub-agents included, plus at most 12 that have waited longer than their event's timeout; a `timeout` under 1 second now counts as 1 second
* Changed a subagent's `autoCompactWindow` to lower the window set by `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, where it had no effect before; it still never raises that window
* Changed OpenTelemetry `mcp_server.name` to report the real name of fixed-URL remote MCP servers declared by plugins from the official Anthropic marketplace, instead of `custom`
* Changed Claude Code to stop sending the `claude_code.safety_event` OpenTelemetry event
* \[VSCode] Changed usage limit resets to show a clock time ("Resets at 3:10 PM") and to say "5-hour limit"

**Improved**

* Improved the prompt's effort indicator: a change made mid-task now says it may wait for your next message, and the note clears when it no longer applies
* Improved WebFetch errors in cloud sessions: a host that does not resolve is now explained as possibly outside the allowed network domains, so Claude names the host to allow
* \[Cloud sessions] Improved the step shown when Claude adds a repository to a cloud session: opening it now shows a short table of what happened instead of raw JSON
* \[Claude Tag] Improved Claude Tag's retry notice in Slack to name the model in use, or say rate limits were hit, instead of a generic API error

**22 bug fixes**

* Fixed managed settings and organization policy not being fetched for the rest of the session after signing in from the VS Code extension
* Fixed Claude overwriting a very large CLAUDE.md, rules file or @-included file in a subdirectory after seeing only its start; Write now asks Claude to read it all or edit in place
* Fixed per-directory and `paths:` skills not being found after a Bash `cd` deeper into a git repository
* Fixed a rare case where the first reply after resuming a session in the terminal could be missing the next time the session was resumed
* Fixed a command with an invalid name stopping all commands from loading, which could leave `claude -p` with no output
* Fixed the Read tool sometimes failing on PDF pages with "pdftoppm failed: Could not write image" when the clean-up of old session files ran at the same time
* Fixed the spinner, OpenTelemetry `effort` values and transcripts naming a newly picked effort level during a task before the model applied it; they now show the level in force
* Fixed the `/model` and `/effort` cache warning saying the re-read waits for your next message; a change made while Claude is working can trigger it sooner
* Fixed some sessions showing as waiting on you when the last message only mentioned items waiting on you mid-sentence
* Fixed agent view restoring input text on the next launch after it was cleared with Ctrl+C just before exiting
* Fixed agent view reopening in shell mode after exiting with Ctrl+D from an empty `!` input
* Fixed vim mode `d`, `c` and `y` with a `gj` or `gk` count larger than the lines left deleting or copying text; like Vim, they now only move the cursor
* Fixed `/verify` showing a long description meant for Claude in `/help` and the `/` command menu instead of a short one
* \[VSCode] Fixed sessions ending on a bare exit code when your organization's settings couldn't be loaded or were refused at startup; the tab now says why and offers Retry or Sign in again
* \[Cloud sessions] Fixed resending an unchanged message after a failed send in a cloud session sometimes running it twice
* \[Cloud sessions] Fixed a failed cloud environment creation showing its error only as a toast outside the open dialog; it now appears inside the dialog
* \[Cloud sessions] Fixed Edit in a routine's menu on the Routines page going to the routine's page without opening its edit dialog
* \[Remote Control] Fixed an unarchived Remote Control session showing as working until a computer reconnected; it now shows as idle
* \[Claude Tag] Fixed a Claude Tag channel's on/off switch and agent settings falling back to workspace defaults when an older private Slack channel goes public and gets a new ID
* \[Claude Tag] Fixed Claude in Slack not replying in channels whose environment has network access set to None
* \[Claude Tag] Fixed Claude in Slack sometimes posting a file in the wrong thread when it was answering in another thread of the same channel
* \[Code Review] Fixed Code Review reviewing an outdated commit, or none at all, when GitHub delivered a push event late; it now reviews the pull request's current commit

**2.1.311**

October 26, 2026

**Added**

* Added `--hold-idle-file` and `--max-hold-min` to `self-hosted-runner`, to keep an idle session while your host reports processes it left running
* Added a tip for the Explanatory output style, shown when you ask Claude for explanations
* \[VSCode] Added syntax coloring to code blocks in Claude's replies, in light, dark and high contrast dark themes
* \[VSCode] Added a "Running UserPromptSubmit hooks" spinner status and screen reader announcement for slow UserPromptSubmit hooks
* \[Claude Tag] Added a Skills view to Claude Tag analytics showing how often Claude runs each attached skill in Slack channels and which go unused, with Usage links in admin settings

**Changed**

* Changed `ultrathink` in the interactive terminal to run its turn at xhigh effort on Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1 through Anthropic's API; typed while Claude is working, it raises the rest of that turn
* Changed the `ultrathink` rainbow to appear only where the keyword can raise effort, and not when the word is quoted or part of a file path
* Changed Ctrl+D in agent view to match the prompt: on an empty input, pressing it twice exits
* Changed `--output-format json` and `stream-json` output to write DEL, C1 control and Unicode format characters inside strings as `\uXXXX` escapes; parsed values are unchanged
* Changed model names and IDs to drop the `[1m]` suffix and its label on models where the suffix has no effect; the suffix is still accepted
* Changed startup warnings about permission rules in settings files to show once per user until the rule changes
* Changed `/code-review` to tell Claude to put the effort level first and use max only when asked
* Changed `DISABLE_COMPACT` in settings files and in a mod's `$.env.set` so they can only turn compaction off, not back on
* Changed Claude Code on Bedrock, Mantle, Vertex, and Foundry to load model settings from a signed file on downloads.claude.ai; set CLAUDE\_CODE\_MODEL\_CATALOG=off to turn this off
* Changed sessions that set `CLAUDE_CODE_SYNC_SKILLS` with feature-flag fetching off to reuse a claude.ai skills list up to 10 minutes old that another session on the machine fetched
* Changed clicks on scrollbar arrows and bars in fullscreen lists to act when the mouse button is released, so moving off the scrollbar before letting go cancels the click
* Changed `claude purge` to say it deletes data only on this computer, not anything stored by Anthropic
* \[VSCode] Changed the extension to start Claude Code sessions with `DISABLE_TELEMETRY` set while VS Code's telemetry setting is off, so they send no usage metrics or error reports and fetch no feature flags
* \[VSCode] Changed the session list side bar to load Web sessions when the Web tab is first opened, not at startup
* \[Claude Tag] Changed Claude Tag admin settings to show a lock instead of # for private Slack channels that your own Slack account can see

**16 improvements**

* Improved startup time for Pro and Max accounts by skipping two network requests on launches within an hour of the last check
* Improved `/teleport` and `claude --teleport` to warn when a compacted cloud session loads from its last compaction, so the messages it summarized aren't in the local copy
* Improved the messages shown when a background session's process exits: they no longer promise a restart that isn't coming, and they say how to resume the session
* Improved artifacts with several views: Claude now routes each view on the link's `#name` and no longer says the address bar stays the same as you switch views
* Improved shell commands that reach their timeout: the result now shows the output so far and says the command is still running in the background
* Improved compaction: when the model's reply has no summary in it, Claude Code now usually asks for the summary once more before it replaces the conversation
* Improved the Artifact tool's choice between a page and a document: explainers and visual or interactive work become artifact pages; documents are for writing people keep editing or pass around
* Improved startup time for launches whose only arguments are options and their values, such as `claude --model opus`
* Improved the "Connection dropped" API error: it now says where to look first (the proxy or gateway in use, else VPN or firewall; Anthropic API only, Bedrock, Vertex and Foundry are unchanged)
* Improved screen reader mode: deleting a rule in /permissions says "Deleted allow rule …" right away
* Improved the message shown when a pasted sign-in code is refused: it now says the code may have expired or been used, and to sign in again
* Improved Slack connector sends: Claude now checks a channel's topic for posting rules before messaging a channel you didn't name
* Improved screen reader mode: Claude's questions are listed as "Questions: Color (answered), Pages", without arrows or symbols
* \[Claude Tag] Improved Claude Tag routines that run in a new session: a run with nothing to report can now end without posting a throwaway message to the channel
* \[Code Review] Improved Code Review's check run to say no further automatic review will start when the model still can't analyze a change on the automatic retry
* \[Code Review] Improved Code Review reliability: a review whose session fails to start because of a transient server fault is now retried once automatically, and its check run says so

**56 bug fixes**

* Fixed long freezes at startup and after reading or editing files when a CLAUDE.md file holds a very long list item
* Fixed interrupting Claude not taking effect until a timeout while an MCP server had not answered a resource read or a skill was still downloading
* Fixed standard-context sessions stopping with "Usage credits required for 1M context" when a request ran over 200K tokens; Claude Code now compacts the conversation and continues
* Fixed Write and Edit stalling for up to 5 seconds after they ran, and reporting 0 lines changed, when changing thousands of lines in a file
* Fixed subagents being unable to use MCP tools from servers that finish connecting after the subagent starts
* Fixed Claude seeing stale MEMORY.md and CLAUDE.md content right after automatic compaction when those files were edited earlier in the session
* Fixed `claude -p` and SDK sessions saving transcript messages out of order or keeping messages that were taken back
* Fixed `SubagentStop` hooks running about twice a minute for each running subagent instead of once when it finishes
* Fixed the @ file picker ignoring `.ignore`/`.rgignore` negation rules that re-include git-ignored files
* Fixed a subagent's isolated worktree being removed while a background subagent it started was still working in it
* Fixed background agents in auto mode that wait on their own shells starting a new main conversation turn on every wake
* Fixed the Bash tool description claiming the working directory always persists between calls
* Fixed the environment block naming a shell commands don't run in, such as fish when the Bash tool uses zsh
* Fixed `claude mcp add`, `claude mcp remove` and `/mcp` naming the current folder instead of the project entry in `~/.claude.json` that holds a local-scope server when run below a repository root
* Fixed `claude mcp list` and `claude mcp get` showing the error code twice on failed-connection lines (for example `ENOENT: ENOENT: …`)
* Fixed Remote Control sessions staying on "Connecting" for about two minutes when a network proxy blocks a startup request
* Fixed messages that Claude sends to a cloud or Remote Control session appearing as your own message in the Claude mobile apps
* Fixed Claude not being told the cause when a file attached to a message sent over Remote Control or to a cloud session could not be saved because the disk was full, or that a message's attachments past the first 20 were left out
* Fixed WebFetch and WebSearch hanging on a stalled response in Cowork cloud sessions; an unfinished request now fails after 300 seconds
* Fixed a background session that crashed between turns not being restarted while it was attached, pinned, or had a scheduled task or wake-up set
* Fixed the "background service did not respond" error suggesting the disabled `claude daemon restart`; it now suggests `claude daemon stop --any` and says it ends background sessions
* Fixed `claude respawn <id>` starting the background service before reporting that no background session matches the id
* Fixed `/effort` not warning about a prompt cache miss in plan mode when the plan model differs from the session model
* Fixed `/ide` saying the VS Code extension was installed before the install finished or when it failed
* Fixed the Write tool's file preview skipping rows and miscounting hidden lines when a line is wider than the terminal
* Fixed ↑ in an agent's chat tab recalling a message that was still waiting to be delivered, so resending it sent a second copy
* Fixed Cowork cloud sessions losing their connectors and most tools after a restart when a plugin or your settings named an `agent`; Cowork cloud sessions now ignore that setting
* Fixed agent teams sessions showing an empty task list when coming back with `--resume`, `--continue`, `/resume` or `--session-id`, including after `/clear` or a crash, and `/branch` writing to the original session's list
* Fixed pasting text that mentions an image file, such as `! open /tmp/shot.png` or `/review look at /tmp/shot.png`, attaching the image and dropping its path from the prompt
* Fixed the feedback draft card showing its 1/2/0 and Esc shortcuts while the prompt has text, when those keys act on the prompt instead of the card
* Fixed a lone backslash in quotes or brackets, like `"\"` or `(\)`, disappearing from Claude's responses
* Fixed agent teammates compacting their history when `DISABLE_COMPACT` is set
* Fixed the rewind menu offering "Summarize from here" and "Summarize up to here" when `DISABLE_COMPACT` is set
* Fixed a finished `/code-review`, or another skill that runs in a sub-agent, running a second time when a cloud or background session restarts
* Fixed long hidden thinking being cut off as idle on Google Vertex AI, Microsoft Foundry and Claude Platform on AWS, where the endpoint sends thinking progress updates
* Fixed `/ide` saying it had installed the JetBrains plugin when nothing was installed
* Fixed Claude Pro and Max subscribers being told to ask their admin when their subscription can't be used; the message now points to billing settings
* Fixed the diff pane opening by itself after an edit in wide fullscreen terminals when it had nothing to show
* Fixed `/mcp` showing a remote server as failed after "Clear authentication" when the server works without sign-in
* Fixed `/mcp` showing "authenticated" for a remote server that Claude Code sends no credentials to
* Fixed a `--plugin-dir` folder of plugins loading as one plugin when an empty `.mcp.json` was at its top
* Fixed `/usage` never showing large prompt-cache misses under "What's contributing to your limits usage?"
* Fixed status line links staying plain text in background sessions after you open them from a terminal that supports links
* Fixed the /rewind confirmation saying the conversation "will be forked" when the later messages are removed from the conversation
* Fixed the /rewind warning that wrongly said manual and Bash edits are never affected by a code restore
* Fixed plan approval in screen reader mode sending feedback you had dismissed with Escape
* Fixed Claude Code retrying requests the API marked not to retry, which could hold a turn for minutes or, in unattended retry mode (`CLAUDE_CODE_RETRY_WATCHDOG`), indefinitely
* Linux: Fixed sandboxed Bash commands failing with `bwrap: Can't create file` when a `--plugin-dir` folder was also an added directory and `permissions.blockReadsOutsideWorkingDirectories` was on
* Self-hosted runner: Fixed a session failing to start when a rate limit (HTTP 429, or a git wrapper that exits 75) blocks an added read-only repository; it now starts without that repository
* \[VSCode] Fixed custom skills and custom slash commands sent from the VS Code or JetBrains panel leaving out the open file or selected lines that ordinary messages include (anthropics/claude-code#102799)
* \[VSCode] Fixed the extension host freezing while the login shell ran its start-up files to read PATH on macOS and Linux
* \[VSCode] Fixed clicking an image in a tool result, or closing its preview, also opening the result's text in an editor tab
* \[VSCode] Fixed voice dictation continuing to record after a message was sent with the Send button; sending now stops dictation first, as pressing Enter already did
* \[Cloud sessions] Fixed routines in Anthropic-hosted environments staying locked after their owner left the organization and rejoined; the owner can now turn them back on
* \[Cloud sessions] Fixed a failed routine API token delete or regenerate showing nothing if the edit dialog had already closed; it now shows an error toast
* \[Cloud sessions] Fixed cloud environment dialogs, including the admin dialog, accepting duplicate names; they now refuse a name another listed environment already has

**2.1.310**

October 23, 2026

**Added**

* Added the Monitor tool and plugin monitors on Bedrock, Vertex, and Foundry, and when telemetry or nonessential traffic is disabled; long foreground sleeps are now blocked there too
* \[Cloud sessions] Added Claude Code cloud sessions and Remote Control permissions to Enterprise custom roles, so Owners can control access to each by role
* \[Cloud sessions] Added a Choose file button to load a cloud environment's setup script from a file

**Changed**

* Changed the error for an MCP tool call that times out in a non-interactive session while the server's elicitation is unanswered: it now tells Claude that no answer came and not to repeat the call
* \[Cloud sessions] Changed turning on Cloud sessions or Remote Control in admin settings to ask for confirmation and list the custom roles that have that permission
* \[Cloud sessions] Changed the cloud environment dialog to open network access, setup script and environment variables from rows instead of listing every editor at once

**6 improvements**

* Improved auto mode's prompt before the first read outside the working directories: it now says when blocking those reads makes shell commands ask for permission
* Improved memory use of non-interactive sessions (`-p`, Agent SDK) during compaction when the transcript file is very large
* Improved a mod's `Image` to draw inside tmux with `allow-passthrough` and `focus-events` on, in kitty, Ghostty, and iTerm2 3.5+ with fullscreen rendering, where it showed only its `alt` text
* Linux: Improved `/sandbox` and the sandbox startup warning to name Ubuntu's AppArmor restriction on user namespaces, and how to lift it, when it keeps bubblewrap from starting the sandbox
* \[Cloud sessions] Improved the session start checklist to show a cloud environment's setup script output in a scrolling box
* \[Code Review] Improved the Code Review admin section to retry the first load and show one Try again banner when it still fails

**14 bug fixes**

* Fixed requests failing behind some gateways and compatible servers that reject the `effort-2025-11-24` beta value or mid-conversation system messages; Claude Code now retries without them
* Fixed background cleanup deleting some recent files, such as pasted images, when `cleanupPeriodDays` is set to a very large value
* Fixed compaction after a "Prompt is too long" error keeping too much of a conversation with dense text, such as base64 or SVG, so the next request could fail again
* Fixed file read permission prompts not showing where a symbolic link leads
* Fixed a question's auto-continue timeout firing the moment the external editor closed after a long edit
* Windows: Fixed PreToolUse and PermissionRequest hooks letting a tool call through when Git Bash is missing and the hook's command is only quoted strings, such as a quoted path
* \[VSCode] Fixed pressing Enter on the plan review card's "Send feedback and keep planning" button approving the plan instead of sending your comments back
* \[VSCode] Fixed the panel showing "Something went wrong" after "Switch branch & continue" on a cloud session opened from Session history's Web tab
* \[Cloud sessions] Fixed failed saves and archives in the cloud environment edit dialog showing no error inside the dialog
* \[Cloud sessions] Fixed failed routine API token actions showing only a toast; the error now appears in the routine edit dialog
* \[Claude Tag] Fixed Claude Tag treating `!` commands such as `!restart` and `!help` as ordinary messages when sent in bold, italic or strikethrough
* \[Claude Tag] Fixed Claude Tag admin channel and workspace pages being replaced by a load error when a background refresh of the bundle list fails
* \[Claude Tag] Fixed Claude Tag's spend limits page in admin settings reporting that no channels match a filter while channel names are still loading
* \[Code Review] Fixed the Code Review admin section hiding its repositories and switches after a failed refresh of the repository list
