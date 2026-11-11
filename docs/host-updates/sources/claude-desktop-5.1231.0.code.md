**2.1.322**

**2.1.321**

November 9, 2026

**Added**

* Added Claude Fable 5.2 (`claude-fable-5-2`), now the default Fable model — 1M context, $8/$40 per Mtok with \$0.20/Mtok cache reads
* Added `--settings <file>` to `claude remote-control`, which applies a settings file to every session it starts; if the file changes, no new session starts until you restart `claude remote-control`
* \[VSCode] Added a warning above the prompt box when both an auth token and an API key are set, matching the terminal's startup warning

**Changed**

* Updated the session-feedback message and the `allowedProviders` setting description to name Ultra alongside Pro and Max, and the `forceLoginMethod` description to cover every paid Claude plan
* Updated the bundled dataviz skill to suggest a list of meters, one row per item, for several ratios that each have their own limit
* Updated the "Upgrade to Max" options to say "Upgrade to Max or Ultra"
* Changed mods Claude writes to turn on without asking in auto and bypass modes, even with managed `allowUnsandboxedCommands: false` or `allowManagedDomainsOnly`, and not to load in `dontAsk` mode
* Changed mods' own tool calls (`$.tool.call`, `$.mcp.call`) to raise no permission prompt, even under your own ask rules or in `dontAsk` and `-p` runs; deny rules and organization policy still apply
* Changed saved Fable 5.1 model picks to move to `fable`: on Pro and Max plans at once, on Team and Enterprise plans once your organization allows it; use `/model claude-fable-5-1` to switch back
* Changed the fast mode labels in `/fast`, `/config` and `/model` to name your current model when it supports fast mode, and removed "(Opus only)" from the VS Code row
* Changed nested skill loading: `.claude/skills` folders inside `~/.claude/plugins` no longer load when Claude works on files there
* Self-hosted runner: Changed an on-demand runner that the server refuses because it is not needed (session ended or paused, work order superseded) to exit 0 instead of 1
* Windows: Changed how Claude Code finds programs it starts itself, such as git, to skip relative and UNC PATH entries and links onto a network share, and to pick up PATH changes from settings
* Changed OpenTelemetry hook events in non-interactive sessions to leave two built-in hooks out of `num_hooks` and `num_success` after Bash and PowerShell calls
* Changed the number of messages a Claude Desktop Code tab session can send to your other sessions before it waits for you to type again from 10 to 20
* Changed `AskUserQuestion` in `claude -p` and SDK sessions to deny a host's permission answer that sets the undocumented `afkTimeoutMs` input field
* Changed managed `extraKnownMarketplaces`: a declared name can't be added from another source, an entry from elsewhere is hidden, and plugins the declared marketplace lists are reinstalled from it
* Changed Claude in Chrome tools that an app running Claude Code provides, such as the Claude desktop app's Code tab, to follow your organization's Claude in Chrome policy
* Changed `policy_mode: layered` in the Claude apps gateway: managed MCP servers now add up over every matching policy, `match: {}` included, so a gateway already on it serves more after the upgrade
* Gateway: Changed Bedrock, Vertex and Foundry upstreams to ignore the `ANTHROPIC_*_BASE_URL` variables in the gateway's environment. Set `base_url` on the upstream to use another endpoint
* Changed headless sessions to reload mods in `.claude/skills` when their files change; set `CLAUDE_CODE_PLUGIN_DIR_WATCH=0` to turn this off
* Changed the Cyber Verification Program sentence on a cyber safeguard block to use the same words as claude.ai
* Changed Cowork cloud sessions: a PostToolUse hook can no longer replace the answer to AskUserQuestion or the plan in ExitPlanMode's result; Claude reads the originals
* Changed `cp` and `mv` spelled by a path, such as `/bin/cp`, to get the same path checks as `cp` and `mv`
* Changed background command notifications and TaskStop results to show Claude only the start and end of a command over 1,000 characters, which saves context
* Changed artifact design guidance to treat Inter and Space Grotesk as good default typefaces
* Changed the account email check to refuse only a shell command that holds your email and names a User-Agent, without asking, so other commands and scheduled runs no longer stop at its prompt
* Changed Remote Control sessions to keep the folder they were started in: a connected client can no longer move a session to another folder
* Changed managed `extraKnownMarketplaces` take-overs from an undeclared source: saved data is set aside for `cleanupPeriodDays`, and options and secrets until `claude plugin restore-set-aside`

**15 improvements**

* Improved the `/model` picker: "More models" is now an unnumbered row below every other, and older models open under it without renumbering the rest
* Gateway: Improved spend limits on a busy replica, which now skips fewer checks and records spend sooner
* Improved the Claude apps gateway's sign-in limit messages in Claude Code and on the `/device` page: they no longer name gateway settings, which the gateway's own log still names
* Improved `claude install` and the install scripts: they finish 2 to 4 seconds sooner
* Improved how soon a Remote Control session whose process crashed can pick up a new message
* Windows: Improved startup and first-command time by finding programs on PATH without starting a helper process
* Improved auto mode in headless sessions, the desktop app and VS Code: reports from background subagents that wait together are answered in one model call, as in the terminal
* Improved the agent view's row for a `claude --bg --worktree` session that couldn't set up its worktree: it now shows the error from its beginning, not an internal tag or its last 200 characters
* Improved the messages shown when an artifact is in another organization: `/login` is offered only if it's one of yours, and Claude now says where a copy may be after an account move
* Improved sessions with more images than fit in one request: Claude is told whether it has already seen a dropped image, and repeat reads of an unchanged image are limited
* Improved `claude remote-control`'s messages for an unanswered first-run question: each now says what to do next
* Improved start-up time by loading trusted TLS certificates faster
* Improved Claude apps gateway error messages to show the gateway's address without any user name or password
* Improved the Claude apps gateway's spend limit error: the reset now shows in your local time, such as "resets 4pm (America/Los\_Angeles)"
* Windows: Improved startup time with a standard Git for Windows install by no longer checking which git.exe to run on every launch

**74 bug fixes**

* Fixed MCP OAuth requests sending secrets such as refresh tokens to another host when a server redirected them
* Fixed a case where a read-only Bash command ran outside the sandbox without a permission prompt
* Fixed a case where Bash permission checks judged a file write from the wrong folder and didn't prompt
* Fixed deny rules and protected-file prompts not applying to the file that a `cp` or `mv` into a directory writes
* Fixed the "Draws from usage credits" note showing after a switch to Fable on Enterprise seats whose plan includes Fable
* Fixed the fallback model sometimes declining a request or mentioning a stopped response when the first model was blocked before replying
* Fixed `claude mcp login` printing a SEP-2352 issuer warning each time you sign in again to a server that Claude Code registered with
* Fixed `NotebookEdit` deleting or overwriting a notebook's first cell when the call named no cell, on network paths (UNC shares, WSL folders, `/net` mounts)
* Fixed Edit changing the first of several matches, replacing a whole file on an empty `old_string`, or editing a notebook as text, on network paths (UNC shares, WSL folders, `/net` mounts)
* Fixed `/config` showing Manual as the default permission mode when new sessions start in auto mode; pressing Space on "Auto (default)" now saves Don't Ask, not Plan
* Windows: Fixed `FileChanged` hooks stopping for paths set through `watchPaths` after the first shell command, when the session's working directory had a lowercase drive letter
* Fixed `--plugin-dir .` and `--plugin-dir ./builtin` writing generated type files for Claude Code's built-in plugins into a `builtin` folder
* Fixed context usage estimates overcounting tool definitions when exact token counts are unavailable
* Fixed `/compact` showing twice in Remote Control on web and mobile
* Fixed plugin auto-updates and `/plugin` marketplace updates downloading a plugin again for each worktree or folder of a repository
* Fixed auto mode losing a background subagent's report that had started a turn when the conversation was compacted before Claude answered it
* Fixed project skills, commands and agents staying missing after their folder was removed and came back mid-session, such as with `git stash`, including after entering a worktree
* Fixed `claude -p` sometimes telling Claude that background commands get 30 minutes when they are stopped after 10
* Fixed `pkill`, `pgrep` and `pidwait` in cloud sessions matching the session's own parent processes
* Fixed Claude in Chrome and computer use server processes staying alive after their parent exits behind a proxy that stalls connections
* Fixed a large hook output pointing Claude to a file that held another hook's output from the same tool call
* Fixed apps that embed Claude Code getting their own PreToolUse hook's `ask` reason instead of another hook's when both asked
* Fixed a PreToolUse hook's `ask` being lost when another hook's `defer` finished first and could not be honored
* Fixed a rare crash on permission prompts and background tasks
* Fixed project skills, commands and agents disappearing from the menu in SDK and desktop sessions after Claude entered a worktree
* Fixed `/desktop` on macOS saying Claude Desktop is not installed when it is in `~/Applications`
* Fixed OpenTelemetry repository attributes (`vcs.*`) missing from Claude Desktop sessions that start on a pre-started process
* Fixed WebFetch passing "No response from model" to Claude as page content when the model reading the page returned no text; the call now fails with a clear error
* Fixed screen reader mode delaying the prompt at startup when the system clock moved back while Claude Code was starting
* Fixed a command's panel sometimes not coming back after a dialog closed, leaving no panel or prompt on screen until the next redraw
* Fixed a project's MCP server being disconnected after the first message in a Claude Desktop Code tab session when the desktop app has an MCP server or extension of the same name
* Fixed a turn ending with "API Error: EPROTO: The TLS handshake failed" when the connection broke partway through a reply; the partial reply is kept or the request is retried, as before 2.1.302
* Fixed high memory use in long sessions that repeatedly read single lines from large files
* Fixed fast mode losing replies, switching models or retrying for minutes when fast serving is rate-limited, overloaded or failing; it now tries standard speed on the same model first
* Fixed one request carrying far more background agent reports than intended after Claude was stopped while several were waiting
* Fixed messages from a Claude Desktop Code tab session to your other sessions staying paused after you typed while Claude was still working
* Fixed `claude agents` ignoring `--permission-mode`, `--dangerously-skip-permissions`, `--model`, `--effort` or `--agent` typed before `agents` when a flag such as `--verbose` was also on the line
* Fixed a case where Remote Control showed as off with "login expired" in the desktop app while its connection was still up, because the app was briefly unable to hand over a sign-in token
* Fixed a Remote Control message sent with "Queue for later" reaching Claude in the middle of the running turn
* Fixed the git status given to Claude at session start reading as clean when git status failed; it now reads as unavailable
* Fixed the git status given to Claude at session start showing the first listed file as staged when its changes were not staged
* Fixed a hang or out-of-memory crash when a connector in a cloud session lists resources with very long names
* Fixed Remote Control showing as connected after its connection closed for good while the session's history was still uploading
* Fixed screen reader mode turning off when you return to a conversation from agent view
* Fixed screen reader mode y/n questions taking as yes a stray "y" at the end of text typed as the question opened
* Fixed cloud sessions telling Claude that a host is probably not allowed when it is allowed and the network proxy could not connect to it
* Fixed an MCP server sometimes showing as connected with no tools after it was reconnected or the session's directory changed while its tools were still loading
* Fixed Bash commands sometimes running in the wrong folder when Claude sent several at once and an earlier one changed folders
* Fixed files Claude sends from cloud and Remote Control sessions failing at once when an upload gets an HTTP 507 from a proxy; the upload now gets a second try
* Fixed new messages not being saved, and `claude -p`, SDK and VS Code sessions hanging, when memory ran out while the transcript was being read
* Fixed sign-in, token refresh and logout waiting indefinitely when something on the network accepts the connection but never answers the TLS handshake
* Fixed a sent file showing under a different name in the Claude apps when its name hid text-direction or control characters; Claude now refuses to send such a file
* Fixed sub-agent progress summaries running a request to its end after the model replied with a tool call
* Fixed Bash reads such as `grep -r foo "$PWD/src"` asking for permission when the same command with the path typed out runs without asking
* Fixed Claude apps gateway refusing to start when a `desktop` setting holds a field newer than the gateway, such as a managed MCP server's `oauth.omitResource`; it now warns and serves it
* Fixed Bash commands coming back empty for zsh users whose `.zshrc` sets `KSH_OPTION_PRINT`
* macOS: Fixed "Unable to read managed policy settings" at startup when a valid MDM profile was slow to read: the read is retried once, and a timeout is now reported as a timeout
* Fixed agent view erasing another agent view's saved input text when it restarted for an update with nothing typed
* Fixed remote sessions giving no reply after a restart when a `UserPromptSubmit` hook blocked a replayed permission answer; these hooks no longer run on that replay
* Fixed `claude remote-control` accepting a `y` typed without Enter at its first-run question when the terminal's input ended
* Fixed Claude Desktop not showing spend limit warnings behind a Claude apps gateway whose policy has no `code:` rules
* Fixed fullscreen sessions with some plugins ending with an error when a tool result that had got shorter scrolled off the top of the screen
* Fixed prompt suggestions making extra API requests when the model replied with a tool call
* Fixed `PreToolUse` `mcp_tool` hooks on stdio and HTTP MCP servers being skipped when their answer was over 16 MiB; the tool call is now refused
* Fixed skill and command names holding a Bamum letter that some fonts draw as blank: they are now refused
* Fixed `claude -p` on Linux exiting 0 in silence when a full NFS export or a used-up NFS quota lost transcript lines: it now prints an error and, in text and json output, exits 1
* Fixed background agents being reported as stopped by the user, and refused a resume, when a service interrupted a cloud session and nobody pressed Stop
* Fixed NotebookEdit reporting success to hooks and telemetry when the edit failed, for example when the notebook changed while the permission prompt was open
* Fixed a blank screen or no answer at startup, and empty `claude mcp list` output, when a stored MCP sign-in record was null
* Fixed the Artifact tool telling Claude to add filters when an artifact's database collection is too large to sort; it now says to read the collection page by page and sort the results
* Fixed a restarted cloud session dropping a message with a large image when the restart came before Claude's first reply to it
* Fixed a restarted cloud session leaving a subagent's message to the main conversation unanswered
* Fixed Claude not being told when you stop or pause a running workflow, so it no longer says the workflow is still running
* \[VSCode] Fixed a plugin's permission request showing a name with hidden characters: it now reads "a plugin"

**2.1.319**

November 6, 2026

**Added**

* Added support for MCP tasks in the terminal: when an MCP server runs a tool call as a task, Claude Code moves it to the background right away and tells Claude the result when it finishes
* Added the `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND` environment variable to make Claude Code wait for an MCP task inside its tool call instead of moving it to the background right away
* Added `permissions.denyInsteadOfPrompting` setting: a tool call that would wait on a permission prompt is denied and the turn continues, in terminal sessions, subagents and teammates
* Added `/claude-api latency-optimize` to find where your Claude API code makes people wait and try faster settings against your eval
* Added the `CLAUDE_CODE_DISABLE_FEATURE_FLAGS` environment variable, which stops feature-flag fetching without turning off telemetry; every flag then uses its built-in default
* Added spend for today, this week and this month to `/usage` for developers behind a Claude apps gateway who have no spend limit, when the gateway runs this version or later
* Added `admin.pooled_conflict_rule` and `admin.pooled_priority_order` to the Claude apps gateway, to set which pooled group budget pays first for a developer in several groups
* Added an optional `login_notice` setting to the Claude apps gateway that shows an operator-defined message on the gateway's browser verification page and on Claude Code's sign-in screen
* Added `CLAUDE_GATEWAY_LOG_FORMAT=json` to the Claude apps gateway: operational log lines become JSON with `severity`, `time` and `message`, for log collectors that read the level from a field
* Added a Claude apps gateway boot warning for a case where another policy's `availableModels` also allows a custom model id that one policy lists by name
* Added start-up warnings to the Claude apps gateway for policies with no `desktopHome` that rely on `coworkTabEnabled: false` or `chatSessionRetentionDays`, ahead of Claude Desktop's November 10 change
* Added a warning when your claude.ai login ends and Claude Code continues on the sign-in from `ant auth login`, which bills usage to your Claude Console organization
* Added a line at startup naming the Claude Console organization that is billed in a case where Claude Code uses the sign-in from `ant auth login`
* Added an "Earlier in this session" row to `/tasks` that lists finished subagents, so you can reopen one and message it even after it leaves the list or you restart
* Added a note to `/loop` confirmations in cloud sessions that a timer stops with its container, with an offer of a loop that survives
* Gateway: Added startup warnings for upstreams that mix AWS GovCloud with other upstreams, and for base URL variables in the gateway's environment
* Gateway: Added a start-up log warning when managed settings name an Amazon Bedrock guardrail in a header, which the gateway doesn't forward, and no `bedrock` upstream sets a `guardrail`
* \[Claude Tag] Added a Claude Tag row to the Models admin page for Enterprise orgs with Claude Tag connected, linking to where its model defaults are managed

**Changed**

* Changed auto mode with telemetry or feature flags off, including behind LLM gateways: calls the server can't check are asked about or denied, with no fallback to the built-in classifier; set `CLAUDE_CODE_AUTO_MODE_SERVER=0` to keep using it (Bedrock, Vertex and Foundry are unchanged)
* Changed auto mode behind an LLM gateway: `CLAUDE_CODE_AUTO_MODE_SERVER=1` turns on the server-side check even with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set; if managed settings set the latter, they must set the `1` too
* Changed MCP tasks to work in the terminal without feature-flag fetching (Bedrock, Vertex, Foundry, LLM gateways, `DISABLE_TELEMETRY`); set `CLAUDE_CODE_DISABLE_MCP_TASKS=1` to turn them off
* Changed auto mode so that a project's settings files or a plugin can no longer switch its server-side check back on once you have switched it off outside the project
* Changed Monitor's WebSocket watch to follow a rule on every Bash command: a deny refuses it, and under an ask rule an allow on Monitor, bypass mode or auto mode no longer skips the prompt
* Changed `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` so that settings files can no longer set it where the host manages the network; set it in the process environment
* Changed a session's exact Bash or PowerShell ask rule to be refused, not asked about, when a broader deny rule covers the command
* Changed the Bash tool to ask for permission before running `which` with flags outside a lookup/display set
* Changed `--add-dir` directories to register plugin marketplaces only once that directory's own trust dialog has been accepted
* Changed nested skill loading: with the Bash sandbox on, skills in `.claude/skills` folders below the starting folder load only if you start Claude Code there or `/cd` there
* Changed self-paced `/loop` to end when a turn finishes without rescheduling, instead of scheduling a fallback wakeup; set `CLAUDE_CODE_LOOP_KEEPALIVE=1` to keep the old behavior
* Changed PostToolUse hooks to run, with up to 10 seconds to finish, on tool calls that finish after a new message interrupts the turn
* Changed what Claude is told after safeguards stop a subagent: retry with a narrower prompt or tell you, instead of doing the work itself
* Changed cloud sessions to drop session-scoped allow rules at a move to a new worker when their deny and ask rules can't all be kept, so you may be asked again
* Changed the automatic certificate repair behind a TLS-inspecting proxy: it no longer runs when `ALL_PROXY` is the only proxy variable set. Set `HTTPS_PROXY` to the proxy's http\:// URL instead
* Changed artifact database saves of rows others may have written: each file gets a hidden marker file, and existing files without one, earlier versions' exports among them, are left alone and reported
* Updated `/claude-api managed-agents-onboard` templates to match the Claude Console: removed Performance tuner, renamed two, and turned off web search and fetch in five whose prompts don't use them
* Removed `shortcuts_list` and `shortcuts_execute`, which listed and started shortcuts saved in the extension, from Claude Code's built-in Claude in Chrome tools
* Self-hosted runner: Changed `CLAUDE_RUNNER_CHECKOUT_PATH` so that each repository in a session gets its own folder: a folder name already taken in the session gets `-2`, `-3`, … at the end
* Self-hosted runner: Removed the end-of-session upload of a session's debug log; a failed session's log stays on the runner host unless `--remove-session-state` is set
* \[VSCode] Changed links in Claude's replies that point at Claude sign-in, connector or API addresses to show as text with the address, instead of opening in the browser
* \[Code Review] Changed unlinking a GitHub organization to also turn off its All repositories setting in Code Review; it stays off after you relink until you turn it back on

**16 improvements**

* Improved config saves on Windows: Claude Code waits longer for a file another program has open, so a kill during a save is less likely to leave `~/.claude.json` empty
* Improved Claude in Chrome after a brief disconnect: it waits up to 6 seconds for the session's own browser to return before picking another
* Improved Claude in Chrome: `javascript_tool` results of up to 60,000 characters now stay in the conversation instead of being saved to a file
* Improved `claude purge` and the clean-up of old sessions to retry a folder that could not be fully deleted, and to report it as an error if it remains
* Improved the refusal for a path outside the working directories on macOS and Windows: when only its letter case differs from a path inside them, the message names that spelling
* Improved the contrast of faint gray secondary text, such as hints, details in `/stats`, `/model` and `/sandbox`, and rejected-action messages
* Improved the artifact database error when an update targets a document that does not exist, and when the service pauses repeated refused writes
* Improved the Claude apps gateway's warnings about a failed upstream call: each now names the upstream, not only its provider
* Improved the Claude apps gateway's spend limit error: it reads "spend limit reached · resets Dec 1", then `admin.blocked_message` if one is set
* Improved the `/model` picker: older models are now grouped under a "More models" row instead of being listed after the current ones
* Improved `/context` at the terminal so the table Claude reads stays short: each list keeps its 10 largest rows, and MCP tools that load on demand share one row per server until they're called
* Improved `/usage` in cloud sessions: it now links to Settings → Usage on claude.ai in a case where plan limits can't be shown
* \[VSCode] Improved the confirmation for removing a plugin marketplace: it now checks which of its plugins are installed at that moment
* \[VSCode] Improved the "not signed in" message behind a Claude apps gateway: it now looks like an error and has a Sign in link
* \[VSCode] Improved the chat panel's diagnostics tool for large workspaces: it leaves out files with no problems, returns compact JSON, and accepts an optional minimum severity
* \[Cloud sessions] Improved the stalled-setup warning on self-hosted environments: its link now prefers your organization's default or an environment with a live runner, and names it

**90 bug fixes**

* Fixed MCP servers on the older handshake failing to connect, or returning empty results, because Claude Code declared an extension that it only uses with newer servers
* Fixed a long-running MCP tool call on a claude.ai connector sometimes never reporting its result after `--resume`
* Fixed a session's diff failing to load on claude.ai and the mobile apps when the folder Claude Code runs in has a file or folder named `HEAD`
* Fixed `/diff` showing "Diff unavailable" when a git repository has a file or folder named `HEAD` at its top level
* Fixed the `/diff` pane opening blank in sessions where 64 or more turns edited files
* Fixed slash commands typed after a leading space, tab or newline being sent to Claude as plain text instead of running
* Fixed a request that kept failing with a 401 refreshing your login on every retry and causing 401s in your other sessions
* Fixed `/context` sending its full visual grid to Claude on every later turn; Claude now reads only the table
* Fixed `claude -p` exiting 0 in auto mode when its actions were refused because no safety check was available: text and JSON output now exit 1
* Fixed a case where Claude Code listed every project file at start on Linux for projects on a network file system (NFS, SMB, Lustre and similar)
* Fixed a case where auto mode was wrongly refused when a client sent a model change and a request for auto mode back to back
* Fixed `/status` showing "Auto mode server: Enabled" when the server-side review isn't reaching the session, for example behind an LLM gateway that drops it
* Fixed Claude-drafted feedback, surveys and `/feedback` continuing to appear after the server refused feedback for your organization
* Fixed Claude drafting feedback on third-party gateways, where it can't be sent
* Fixed auto mode refusing actions without saying why when permission rules or `autoMode` settings are very large: it now explains and, unless `autoMode` deny rules are set, asks you in the terminal
* Fixed a case where Bash deny and ask rules missed commands written with quoted words
* Fixed subagent hand-back reports showing an internal marker and provenance note when expanded outside verbose mode
* Fixed `claude -p --resume` with a prompt losing a deferred tool call when its MCP server is missing: the run now exits 1, keeps the call and refuses later input
* Fixed a case where text was dropped from informational messages sent to SDK clients
* Fixed a case where Agent SDK hosts got a generic exit-code error instead of a failed run's own error message when the disk was full
* Fixed `CLAUDE_CODE_RESUME_INTERRUPTED_TURN` re-running a turn that was interrupted in plan mode when the session resumes in another permission mode
* Fixed edits to a settings file being ignored when made within a few seconds of Claude Code writing that file
* Fixed a config file left at the legacy name hiding your setup with no warning: Claude Code now says on stderr when a home holds two config files, and which is in use
* Fixed `~/.claude.json`, settings and edited files ending up empty or cut off when the disk fills during a save in a read-only folder or to a bind-mounted file (one session saving at a time)
* Fixed Write ending the turn as a refusal when it couldn't read the file to overwrite
* Fixed background Bash commands that finish almost instantly losing their output while being reported as completed
* Fixed the Bash tool's diff of changed files missing a file that the command wrote just before it ended
* Fixed a mistyped model name, such as `opus-5-5`, telling you to update Claude Code instead of suggesting the model you meant
* Fixed a case where `NotebookEdit` changed the wrong cell when the notebook changed while a permission prompt was open
* Fixed a \~0.5s hang after pressing Enter on the `/login` success screen: the dialog now dismisses immediately and the post-login refresh runs in the background
* Fixed Ctrl+G not opening the external editor while typing an "Other" answer to a question in screen reader mode
* Fixed Monitor's WebSocket watch failing with "could not resolve" behind a proxy when `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` is set and the machine has no DNS of its own
* Fixed `claude plugin eval` warnings suggesting `max: 0` for a tool that must not be called, which could never pass
* Fixed background plugin auto-update not installing a dependency added by the updated plugin version
* Fixed Cmd+click not opening links in Ghostty over tmux in sessions opened from the agents view
* Fixed a mod's hot reload in `.claude/skills` missing a file that was deleted just after it appeared, and missing its return
* Fixed `/rewind` failing with "No files were restored" when restoring code to a checkpoint from before `/branch`
* Fixed the `/claude-api` skill saying Console web settings don't apply to Managed Agents sessions, and tightened its credential and permission examples
* Fixed needless permission prompts for read-only commands wrapped in a plain `timeout DURATION`, such as `timeout 30 rg foo`
* Fixed WebFetch describing claude.ai shared-chat links as empty pages; it now says shared chats can't be read and to paste the conversation instead
* Fixed Artifact database calls being re-sent to artifacts without a database; errors now say whether republishing helps
* Fixed a case where artifact database reads that save to a folder (`out_dir`) were refused
* Fixed detailed beta tracing not presenting `CLAUDE_CODE_CLIENT_CERT` to collectors that require a client certificate
* Fixed the OpenTelemetry `claude_code.session.count` metric counting Agent SDK `prewarm()` processes that were never claimed; a pre-started process now counts once, when it is claimed
* Fixed `/clear` killing running commands of background agents, teammates and workflows that keep running, and foreground subagents of background agents and teammates
* Fixed a terminal whose Claude apps gateway sign-in had expired sending telemetry and managed-settings requests that the gateway refused and logged as `invalid_token`
* Fixed the agents view appearing to send a reply to a background session waiting on a permission prompt; the reply now stays in the box with a hint to open the session and answer
* Fixed agent view removing a draft saved by another agent view in the same directory when exiting
* Fixed a case where agent view came back with another agent view's input text after restarting itself for an update
* Fixed the agents view preview cutting off long commands, results and status lines without an ellipsis, and dropping `**`, backticks and tags from commands waiting for approval
* Fixed Claude in Chrome reporting the extension as not connected when the connection dropped mid-action; Claude now checks the page before repeating an action that may have run
* Fixed Remote Control sessions still showing "Limit reached" on other devices after a usage limit was lifted outside the session
* Fixed the file card sometimes missing in the Claude iOS app when Claude sent a single file
* Fixed self-hosted runner sessions failing with no explanation when the server keeps refusing to renew model access: the runner now retries sooner and posts a warning in the session
* Fixed `/permissions` in cloud sessions replying only that it isn't available; it now says where the session's rules live and how to change them
* Fixed cloud sessions losing session-scoped deny and ask permission rules, such as those a PermissionRequest hook adds, when the session moves to a new worker
* Fixed mod hot-reloading turning off for the session when you typed three messages instead of answering its question in a cloud session
* Fixed background tasks that keep running after `/clear` disappearing from the task list in Claude Code on the web until another task started or ended
* Fixed hidden commands appearing in the slash command menu of cloud sessions on mobile and web
* Fixed a case where `/rewind` could restore or delete a file through a directory symlink
* Fixed a case where a `sed` command could skip the permission check in accept-edits and auto mode
* Fixed a case where `CLAUDE_CODE_AUTO_MODE_SERVER=1` in managed settings was ignored behind an LLM gateway when the gateway's URL is set only there and server-managed settings can't be fetched
* Fixed a Bash permission bypass where a crafted environment prefix could hide part of a command from permission checks
* Fixed a case where deny and ask rules, hook matchers and `disallowedTools` entries written with a claude.ai connector's terminal name (`mcp__claude_ai_Slack`) were ignored in Claude Desktop (takes effect once Claude Desktop includes this version)
* Fixed a sandbox escape when creating a worktree
* Fixed self-hosted runners: `--trust-workspace false` now also stops hooks in the repository's settings files and skills from running
* Fixed a case where idle background sessions started through a shell-exported LLM gateway left the gateway after an update
* Fixed help links in `/status` and the auto mode billing notice opening only part of the address when they wrap
* Fixed a case where certificate errors behind a TLS-inspecting proxy persisted when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` was set. With it set, Claude Code now makes a TLS handshake with the configured API host after a certificate failure, through your http\:// proxy if one is set; it sends no API request
* Fixed `claude remote-control` exiting silently with status 0 when a first-run question gets no answer (scripts, services, batch jobs, Ctrl+C); it now says why and exits 1
* Fixed `claude remote-control` ignoring a piped `y` that has no newline after it at the first-run question; it now counts as a yes
* Fixed `/rename` reporting plain success when the new name could not be saved to the session transcript; it now warns that the new name may not last
* Fixed `${CLAUDE_PLUGIN_ROOT}` not being substituted in a plugin-provided `subagentStatusLine` command, which can now reference the plugin's own scripts
* Fixed `claude plugin update` and `/plugin` "Update now" not installing dependencies added by the new plugin version
* Fixed subagents being told after compaction to expect a completion notice for background agents they neither started nor took over
* Fixed a case where a background agent's later report was lost silently: the notification now says it was refused and how to ask for it
* Gateway: Fixed Claude Desktop offering a web search tool that always failed when every upstream is Amazon Bedrock
* Self-hosted runner: Fixed a runner started with `--use-anthropic-git-proxy` or `--configure-git` registering before a failed startup check made it exit; it now exits first
* \[VSCode] Fixed prompts over 50,000 characters being cut off silently: the prompt now stays in the chat box with a notice, and a paste over the limit is refused with a notice
* \[VSCode] Fixed a click on the survey or "Report a problem" buttons sending the unfinished prompt
* \[VSCode] Fixed cloud sessions opened from the extension's Web tab bringing back turns that `/clear`, or Retry or Edit of a typed prompt, had removed
* \[VSCode] Fixed a deleted session's file coming back when that session was renamed in the extension
* \[VSCode] Fixed Claude carrying out an unapproved plan after a window reload: a step interrupted in plan mode now stops with a notice when the session comes back in another permission mode
* \[VSCode] Fixed a possible chat panel freeze when a dropped item's path contains a very long run of "/" characters
* \[VSCode] Fixed the `claude-vscode.toggleDictation` command starting dictation in every open Claude view at once; it now acts only in the view you are using, and a second press stops it
* \[VSCode] Fixed the chat panel slowing down while a reply with many unclosed `$$` math fences, each shorter than the last, streams in
* \[Cloud sessions] Fixed scheduled tasks silently dropping a connector named memory: runs now keep it, mounted under that name plus a short suffix
* \[Cloud sessions] Fixed Send now on a waiting message in cloud sessions ending running background agents; they now keep running
* \[Claude Tag] Fixed Claude Tag setup blocking launch when the channel list couldn't fully load; admins can now launch without picking a channel
* \[Claude Tag] Fixed saving auto mode allow rules in Claude Tag admin settings overwriting another admin's changes; the save is now refused with a message

**2.1.318**

November 4, 2026

**Added**

* Added a record of your answer when Claude Code asks to turn on the mods it writes in a session
* Added `assume_role` on `mantle` upstreams of the Claude apps gateway, for a role in another AWS account and for per-developer AWS cost attribution
* Added an `effort` option to a mod's `$.model.fork`, so a quick side job can run at `low` whatever effort the session uses; the result reports the effort sent
* Added the date a stored claude.ai sign-in ends to `claude auth status` (`loginExpiresAt`) and to `claude -p` JSON results (`credential_expires_at`)
* Added a one-line stderr warning to `claude -p` text output, starting 10 days before a stored claude.ai sign-in ends
* Gateway: Added a log warning when the Google access token from a federation (`external_account`) credentials file is about to expire
* Self-hosted runner: Added `CLAUDE_RUNNER_SPAWN_REASON` to the orchestrator's spawn-runner hook environment: why Anthropic sent the request (e.g. `runner_lost`, `resumed`); unset when none was sent
* Self-hosted runner: Added a startup warning when `--release-idle-session-min` is the last argument with no value (still ignored) or has a value of only spaces (still read as `0`)
* \[Cloud sessions] Added a No repository option: a cloud session on an Anthropic-hosted environment can now start without picking a repository
* \[Cloud sessions] Added the usual Chrome names to cloud sessions, so tools other than Playwright can find the built-in Chromium through google-chrome and CHROME\_PATH
* \[Cloud sessions] Added a New session button to the card shown when a cloud session's environment was deleted, where the message box is hidden

**Changed**

* Changed Claude Code to no longer install or update the IDE extension when started in an IDE terminal; use `/ide` from an outside terminal or your editor's extensions view
* Changed subagents to stop instead of switching models when "Switch models when a message is flagged" is set to "Ask each time"
* Changed background subagents to move a shell command to the background after 3 minutes on all providers, so the prompt cache doesn't expire while it runs
* Changed subagent progress summaries on Bedrock, Vertex, Foundry, or with telemetry off: on a cold prompt cache, one can now wait up to 5 minutes for the subagent's pending response
* Changed what a mod attaches at `prompt.submit` to stay in the user's turn rather than go out as a system message
* Changed `deniedMcpServers` URL entries to also block Anthropic-provided servers whose upstream URL matches, and connectors in cloud sessions and on self-hosted runners, where the session is given the connector's own URL; otherwise deny a connector by name
* Changed the `/permissions` rule details, built-in rules and delete confirmation views to use the standard dialog; pressing Ctrl+C twice there now goes back or cancels instead of quitting
* Changed `/claude-api managed-agents-onboard` to give a new agent's built-in tools, and a quickstart template's MCP tools, the `auto` permission policy ("Judge risky actions") by default, matching the Claude Console; say "run without asking" to opt out
* Removed the 2.1.288 fix that kept the model's earlier thinking when resuming a conversation started on 2.1.286 or earlier; that thinking can now be dropped
* Self-hosted runner: Changed the orchestrator's log lines: `ok session=…` now prints at every log level on stdout (was debug only, stderr) with `reason=…` after `jti=…`, and `nack session=…` ends its fields with `reason=…` after `retryable=…`; update scripts that match `retryable=true:` or `retryable=false:`
* \[Cloud sessions] Changed connector search results to tell Claude that the search covers only part of the connector directory

**15 improvements**

* Improved how `~/.claude.json`, settings files and the stored login survive saves on shared network home directories: they are less often deleted, briefly emptied or replaced by a near-empty or older copy
* Improved sessions on network file systems to look again when the configuration file is wrongly reported as missing, so fewer start without your MCP servers and trusted folders
* Improved MCP tool errors: a call made before the tool is loaded now returns its input schema
* Improved the reliability of git commits and pull request creation when the Bash tool runs macOS's built-in `/bin/bash`
* Improved "Ask your admin for more usage" in the usage limit menu to send the request in one step
* Improved how fast remote sessions reconnect after a pause or sleep
* Improved You should know toasts to say "try again" instead of "press 2", which only works in the terminal
* Improved auto-update reliability: a brief network failure while verifying a release is now retried right away instead of waiting for the next check
* Improved unattended runs (`claude -p`, SDK apps) to stop rewriting `~/.claude.json` on every run when nothing in it changed
* Gateway: Improved the log hints about `listen.trusted_proxies`: they now say to list only a proxy that adds the connecting address to `X-Forwarded-For` itself
* Gateway: Improved the warning when AWS CountTokens fails on Amazon Bedrock: it says Claude Code, not the gateway, counts after the 501, and points at IAM only when AWS denies access
* Remote Control: Improved the title a fork of a terminal fork is created with when the app doesn't set one: "Name (fork 2)"
* \[VSCode] Improved the sign-in screen to show what Claude Code printed when its sign-in status check fails
* \[Cloud sessions] Improved most Create PR failure messages in cloud and Remote Control sessions: they now give the reason or a link to GitHub instead of saying Try again
* \[Code Review] Improved the Code Review analytics page to retry once after a server or network failure, then show a Try again banner instead of empty cards

**47 bug fixes**

* Fixed `--continue` sometimes losing the earlier conversation after a malformed tool call's retries ran out (regression in 2.1.314)
* Fixed macOS sessions with many running Bash commands stalling while memory grew
* Fixed permission prompts being answered by keys typed just after sending a message, or before a slow prompt appeared
* Fixed `/logout`, `claude auth logout` and `claude mcp remove` reporting success, and changes to trust, consent or MCP settings being dropped with no word, when the config file could not be updated on a shared network home directory
* Fixed jobs exiting with `Not logged in` when another terminal or host signs in again to the same account and organization on the same home
* Fixed `claude mcp add` and `remove` writing the config without its lock: they now wait for it or exit 1, though another job's save can still replace a saved server
* Fixed `claude plugin` commands exiting before a slow token refresh was saved, which could sign you out on the next run
* Fixed `claude plugin validate` passing a custom-named marketplace file that `claude plugin marketplace add` rejects
* Fixed stdio MCP servers that exit on the version probe being re-probed on every start; a server that dies in under 3s for its own reason is also pinned to the legacy handshake for 7 days
* Fixed sessions being refused at startup by an `allowedProviders` list that another login on the same machine had stored
* Fixed idle compaction replacing a conversation with a reply that was not a summary
* Fixed the "Now using usage credits" notice reappearing about every 30 seconds while a background subagent is running
* Fixed custom slash commands that fail, or that only Claude can invoke, printing nothing in `claude -p` and SDK sessions
* Fixed `claude -p` and Agent SDK sessions reporting success when an API error cut off a reply while a mod hooked `turn.step`
* Fixed a message sent right after a model change still running after Stop in headless sessions: Stop now cancels or stops it as it would a queued message
* Fixed a deleted session transcript being re-created with its last prompt when an idle non-interactive session exited
* Fixed `claude remote-control` hosts, the background daemon and self-hosted runners failing to start new sessions (`spawn ENOENT`) after an update or version cleanup removed the binary of a still-running process
* Fixed a running Claude Code process owned by another user (for example one left by `sudo claude`) being treated as dead by version cleanup, which could delete its binary
* Fixed `/remote-control` showing a session as available after a failed connection
* Fixed `/design revoke` reporting success when the request failed with a 404
* Fixed a shell command approved after a self-hosted runner or cloud session restart running in the session's start folder, not the folder it was asked in; if that folder can't be entered, it is not run
* Fixed Claude not being told when an approved connector tool was unavailable after a cloud session restart
* Fixed cloud sessions being stopped in the middle of a turn when the service refuses uploads for several minutes
* Fixed variables a `Setup` hook writes to `CLAUDE_ENV_FILE` not reaching the Bash tool in some cloud sessions
* Fixed the iPhone app showing a cloud session's turn as finished while it kept running, after a response was cut off at a tool call or a refused image or document was removed
* Fixed a restarted session re-sending a message that failed with an API error, ahead of the newer message waiting behind it
* Fixed a restarted session dropping its interrupted turn when the restart came right after Claude read a large image or retried a tool call
* Fixed every connection failing when the `NODE_EXTRA_CA_CERTS` file is empty, not PEM, or starts with a damaged certificate: readable certificates are now used, with a warning on stderr
* Fixed workflows re-running finished agents when resumed after a usage limit
* Fixed `/mcp` in cloud sessions counting tools the model can't use; a server's row now shows how many of its tools are available
* Fixed a duplicate notification when Claude left the status field out of a PushNotification call
* Fixed the error for a too-large image in a request with more than 20 images always saying the limit was 2000px; it now shows the API's limit
* Fixed the runtime in background shell details not updating while the dialog is open
* Fixed a mod's `turn.step` hook making a stopped reply finish as a success in headless runs
* Fixed retention cleanup leaving a home that only runs `claude -p` with no `~/.claude.json` backup: it now takes a fresh backup before deleting the last good one
* Fixed the stored login being replaced by an empty file when a network home directory has no room left for data but still takes new files
* Fixed tokens from `setup-token` being refused at start on machines with `forceLoginOrgUUID`, when the token belongs to a permitted organization
* Fixed non-interactive launches replacing a `~/.claude.json` that isn't valid JSON with defaults; the start now fails, says how to restore the file, and leaves it as is (anthropics/claude-code#87551)
* Fixed an empty `~/.claude.json` with no backup being reported as corrupted; Claude Code now starts as it does when the file is missing
* Fixed the restore command printed for a damaged or missing `~/.claude.json` naming an empty or cut-off backup, or failing on a read-only file
* Fixed the sign-in failure when a stored claude.ai login reaches its time limit: it now says so, and in `claude -p` names `claude auth login` and `claude setup-token`
* Remote Control: Fixed a misleading "spawn error: ENOENT" when a session's working folder is missing; the error now names the folder
* \[VSCode] Fixed a window whose sign-in the organization's settings refuse starting a new Claude Code process in the background every minute
* \[VSCode] Fixed a long word in the chat panel's error banner pushing its close button out of view
* \[Cloud sessions] Fixed reading GitHub Actions logs in cloud sessions: `gh run view --log` and `gh api` log requests now get the log in most environments, not an unreachable redirect
* \[Remote Control] Fixed side-by-side checkouts of one repository looking identical in the environment menu's Remote Control rows; each now shows its own folder name
* \[Claude Tag] Fixed keyboard focus and screen reader announcements in Claude Tag admin setup; pressing Escape in the connect form no longer also closes the Add dialog
