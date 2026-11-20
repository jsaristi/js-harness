**v6.28899.2**

2026-11-19

Bundled Claude Code version: 2.1.328.

For administrators of SSH hosts: SSH helper version e7672c0ae0f00f48e6a334d0647132f6490a5f6c. SSH host launcher contracts: 1 (sessions), 2 (plugin commands).

**General**

* Changed Claude Code's managed `allowedMcpServers` and `deniedMcpServers` back to how they were before 6.6395.0. In Chat and Cowork they don't apply to servers under Settings > Developer, so stopped servers run again. To apply them there, set `desktopMcpServersListScope` to `all` where you set them.
* Changed `PostToolUse` hooks in Claude Code's managed settings to no longer run for tool calls refused before the tool started, so logs that these hooks write lose those entries.
* Changed text typed while a page is loading to be cleared if you switch organization in another window. A first message that is waiting to send isn't sent, and a notice says so.
* Improved recovery from a failed Claude Code download: the app tries again on its own within minutes instead of waiting for a restart.
* Fixed a likely cause of brief freezes on Windows PCs with no Claude Code managed settings in the registry. If you add them, the app's own checks, such as allowed SSH hosts, can take about 6 hours to see them, not 30 minutes, unless the app is fully quit and reopened.
* Fixed a message in Chat or Cowork looking sent and then disappearing when you pressed Stop before Claude had read it. It now shows as Stopped, with Retry.
* Fixed Claude on Linux turning off hardware acceleration and showing a crash notice after a logout or shutdown.
* Fixed Claude staying closed after an update on Windows Server. Starting with the next update, it opens again by itself. This fix doesn't apply to third-party deployments.
* Fixed file previews and live artifacts: right-click opened no menu, pages stayed small when the app was zoomed in, Find showed no results after clicking in, and the keyboard could get stuck. F6 now returns to the app.
* Fixed MCP servers added to `claude_desktop_config.json` while the app is running being removed again, and a brief network error interrupting replies and uploads in progress.
* Fixed plugins turned on in Claude Code's managed settings on the device never installing when they have their own git repository. Sessions now fetch them in the background, unless nonessential traffic is off (`disableNonessentialTelemetry` in third-party deployments). This adds git and npm traffic.
* Fixed Quick Entry messages sometimes being lost without notice when sent while the main window was loading.
* Fixed remote MCP servers staying disconnected after a long outage such as a VPN drop. Most https servers are now retried in the background for about a day. In third-party deployments, this doesn't cover servers in `managedMcpServers`: the app tries those again when they're next used.
* Fixed sessions failing to start on Windows when the organization sets hundreds of tool rules, allows marketplaces with very many plugins, or a session has very many saved approvals.
* Fixed the window freezing when opening, resuming, or hovering a Code session or local Cowork task that contains very large connector results.

**Code**

* (breaking) Changed SSH sessions to ignore a project's plugin settings on your computer. Project- and local-scope plugins no longer reach the same path on the host (install them there or at user scope), and user-scope plugins the project turned off now do, unless managed or user settings stop them.
* Changed `allowedWorkspaceFolders` in local sessions so that Plan mode works. Claude can now read plans in Claude Code's `plans` folder, and write them there in Plan mode, though that folder is outside the listed folders.
* Changed Auto mode to ignore allow rules that run any package, such as `Bash(pnpm dlx *)`, so its safety check decides those commands. This covers `pnpm dlx`, `npm exec`, `yarn dlx`, `bun x` and `pnpx`. A rule that names the package, such as `Bash(pnpm dlx cowsay:*)`, keeps working.
* Changed files that Claude creates over SSH or WSL to follow a stricter login-shell umask. Other accounts may be unable to read them.
* Changed local file previews. Claude no longer runs code in a PDF, picture or video, and only looks at PDFs. Sites that an HTML or SVG file embeds or calls show as signed out. If Claude opened the file, it loads web content and follows links only after you choose Load web content or open it yourself.
* Changed sessions to start without environment variables that can change how Claude Code loads. The environment editor names any you saved and says where to move them.
* Changed SSH sessions saved in Auto, Accept edits or Bypass permissions to stay in Plan or Manual at launch if they moved there while the app was closed.
* Changed SSH setup to not connect to a Linux, macOS, or Git Bash host whose login wrapper, `ForceCommand`, or startup file drops or changes the first line that setup's first command prints. A banner printed before that line doesn't cause this. `ssh.log` on your computer shows what came instead.
* Changed the built-in browser so Claude can't use claude.ai or artifact pages in Code sessions at organizations with zero data retention for Claude Code. This doesn't apply to third-party deployments.
* Fixed a new session sometimes running an MCP server that had just been removed from `~/.claude.json`, when the app could not read that file. This fix doesn't apply to third-party deployments.
* Fixed edits on Sonnet 4.6, Opus 4.7 and newer models failing with "File has not been read yet" after a long conversation is compacted, for an unchanged file outside the project that Claude had already read in full.
* Fixed shell commands in zsh stopping with a "not found" error at a word that starts with `=`, such as `[ a == b ]`.
* Fixed SSH sessions failing to start with "The proxy setting isn't a valid URL" on a host whose `https_proxy` or `HTTPS_PROXY` is a host and port with no `http://` in front.
* Fixed the Terminal, Changes, Files and Rewind keyboard shortcuts doing nothing in a session opened in its own window.
* Fixed WSL sessions starting a `wsl.exe` process for every folder when listing files, which could slow down or freeze the computer.

**Cowork**

* Changed Record a skill to stop recording when the screen locks, the computer sleeps or, on Mac, you switch users. The recording waits for you to choose Done or Discard, and is discarded after an hour.
* Improved how soon a new task is saved, which makes it far less likely to go missing from the task list if the app closes unexpectedly just after the task was started.
* Improved steps that Auto mode stops: the collapsed step now says "Blocked", the line above a group of steps counts them, and a blocked file or agent step opens to show why.
* Fixed "Not enough disk space" appearing on macOS and Linux when the workspace update would have fit.
* Fixed a case where the workspace failed to start, and the app could restart to download and set it up again, after the computer went to sleep while the workspace was starting.
* Fixed Claude not finding your plugins and skills in scheduled tasks, and in other Cowork tasks that aren't open on screen, in third-party deployments.
* Fixed Claude reinstalling its workspace and restarting on Windows when the computer didn't have enough memory.
* Fixed Cowork and Chat failing at every start where `disableSideloadFlags` reaches Claude Code but the app can't read it first, as with a policy helper. A card now says so, and Try again continues without the desktop's plugins.
* Fixed Cowork sometimes failing to start on slower Windows and Linux computers.
* Fixed deleting a single Cowork task sometimes leaving part of its conversation on the computer.
* Fixed Global instructions opening empty and overwriting the saved instructions when the file could not be read.
* Fixed tasks on Windows sometimes failing to start when a task folder was briefly locked or unreadable.
* Fixed the workspace download failing when the computer went to sleep several times before it finished, and starting over when an app update was installed before it finished.

**3P**

* (breaking) Changed Auto mode, Code's default, on Gateway connections: your gateway's provider now runs the safety check. If no result comes back, Code waits five minutes for someone to pick Continue, then ends the turn. [Check your gateway](https://claude.com/docs/third-party/claude-desktop/gateway.md#gateway-requirements-for-auto-mode-checks), or [set `inferenceGatewayAutoModeServerChecks` to `false`](https://claude.com/docs/third-party/claude-desktop/gateway#turn-off-server-side-auto-mode-checks).
* Changed Auto mode where a Claude apps gateway serves your settings: sessions use the provider's check. Don't add `inferenceGatewayAutoModeServerChecks` to `gateway.yaml`, or the gateway won't start. To avoid the check, set `autoModeEnabled` to `false` in each policy, which turns Auto mode off.
* Changed Auto mode requests on Gateway connections to carry session details such as rules, folder paths, a user name and Git state. If the gateway refuses them with a 401 or 404, the turn fails. `false` in `inferenceGatewayAutoModeServerChecks` avoids this until Claude Code drops the built-in check.
* (breaking) Changed `userPluginMarketplacesEnabled`: when it's off, plugins kept in skills folders usually no longer load, so their hooks and servers stop. `/plugin-authoring` is off too. Plain skills still load. Only a local session with such a folder and no launcher shows a notice.
* Changed SSH sessions left running through this update where `userPluginMarketplacesEnabled` is off: Claude's questions and prompts go unanswered. When someone opens or messages a session, Claude Code restarts, and a running tool call and background shells are lost. Let work finish before updating.
* Added `autoModeRules`, which tells Auto mode in Cowork and Code what your organization trusts and what to block or allow. A model applies these rules, so a block isn't guaranteed. To keep the built-in rules, start each list with `$defaults`. A malformed value turns Auto mode off until you fix it.
* Added `sshHostSandboxUnavailable` (beta). Set it to `refuse` to stop new SSH sessions on all Windows hosts, and on other hosts where Claude Code's sandbox can't start. The key's help lists the cases it doesn't cover.
* Added an "Allow for all tasks" choice for tools of a plugin's remote MCP server, in Chat and in Cowork's Manually approve mode. It also covers unattended scheduled Cowork tasks, unless `mcpScheduledTaskApprovalLifetimeDays` is set. To turn it off, set `mcpPersistentAlwaysAllowEnabled` to `false`.
* Added Auto mode as a choice for Opus 4.6 and Sonnet 4.6 with Bedrock, Vertex AI, Foundry or a Claude apps gateway. People can pick it in Code, and in Cowork where `autoModeEnabled` is `true`. It isn't the default on these models. Setting `autoModeEnabled` to `false` ends Auto mode on every model.
* Changed `chatSessionRetentionDays` and `coworkSessionRetentionDays`: soon after updating, the app can permanently delete idle chats, with their artifacts, and Cowork tasks that older versions kept. To keep them, before updating, set all three periods to 3650 days in the configuration that sets them.
* Changed `chatSessionRetentionDays` and `coworkSessionRetentionDays`: when both are set, the app can also delete folders left by chats and Cowork tasks it has no record of, for example if the app stopped in a task's first seconds. A folder is deleted once it is unchanged for the longer of the two.
* Changed `chatSessionRetentionDays`, `coworkSessionRetentionDays` and Free up space: an idle chat or Cowork task no longer lasts one more period each time a person turns a connector or tool on or off. Renaming, pinning or moving it to a project no longer counts as activity. Sending a message does.
* Changed `egressProxyPacUrl` and system PAC files in local Code sessions, except on the Claude API. Where the script answers `DIRECT` for a GitHub host, tools can now skip your proxy, and fail if your firewall blocks GitHub. To keep a host on the proxy, have the script return your proxy for it.
* Changed `mcpPersistentAlwaysAllowEnabled`: when it's `false`, Claude now asks again before it reads or acts on a saved private-network site in the built-in browser.
* Changed `otlpResourceAttributes`: a `service.name` set there now replaces `claude-code-desktop` in what Code sessions send to your collector. Dashboards that filter on the old name stop matching. Cowork and Chat still send `cowork`.
* Changed Auto mode in Cowork on macOS and Linux. Where `autoModeEnabled` is `true`, its safety check, not an approval card, now decides whether Claude can save a skill, request a folder or change a scheduled task. A folder outside `allowedWorkspaceFolders` is still refused. Windows keeps the card.
* Changed Plan mode, which Claude can enter by itself, on Opus 4.6 and Sonnet 4.6 with Bedrock, Vertex AI, Foundry or a Claude apps gateway. Auto mode's safety check now decides on shell commands instead of asking. To keep prompts, set `autoModeEnabled` to `false`. That ends Auto mode on every model.
* Changed scheduled Cowork tasks to stop at 10,000 turns instead of 100, so long tasks can finish. A task stuck in a loop can use far more tokens on your provider. `inferenceMaxTokensPerWindow` with `inferenceTokenWindowHours` stops it, but cached tokens don't count toward that limit.
* Changed the built-in browser (`builtinBrowserEnabled`) where Auto mode is available: each click and drag now goes to Auto mode's safety check, in every permission mode. Your provider runs each check, which adds usage. A click is refused if the check gives no verdict.
* Changed the built-in browser in Cowork (`builtinBrowserEnabled`) to hide recognized password, one-time code, card and Social Security number fields from Claude. Screenshots show grey boxes, and page text leaves them out. It can miss fields, and screenshots still show numbers that a page prints.
* Changed the Up arrow in an empty message box to move focus to the last message in Chat and Cowork. Cmd+Up (Ctrl+Up on Windows and Linux, after Insert+3 with JAWS) now brings back the last prompt.
* Changed what happens when a person's MCP server from `claude_desktop_config.json` or an extension has the same or a similar name as your organization's. Your organization's server is now used in Chat, Cowork and Code. The person's stays off, and the app says why. Renaming it there brings it back.
* Improved recovery from "Prompt is too long" in Cowork, Chat and Code when one reply's tool results overfill the context window. Claude now compacts without the largest results and goes on, or the next message works. Scheduled tasks, very large PDFs and some gateways can still end the session.
* Improved the error people see when they click Connect on a managed connector's page and your server answers with HTTP 403. If the response body is a JSON-RPC error, the error can now show its message, so you can tell them whom to ask. Any other body shows the usual error.
* Fixed `allow` not removing the prompt for MCP tools of plugins from `allowedPluginMarketplaces`, in Chat and in Cowork's Manually approve mode. Set it in `orgPluginSettings` or a `policy-only` entry under the server's exact name. An `allow` already set applies when you update, so check yours first.
* Fixed responses from a gateway being cut off after about 5 minutes of silence, however high `inferenceStreamIdleTimeoutSec` was set. On the Code tab, values above 900 seconds add nothing.

**v6.6395.1**

2026-11-18

Bundled Claude Code version: 2.1.326.

For administrators of SSH hosts: SSH helper version 13047a5194346a68538f5525406bf5f861013d73. SSH host launcher contracts: 1 (sessions), 2 (plugin commands).

**General**

* No user-facing changes.

**Code**

* No user-facing changes.

**Cowork**

* No user-facing changes.

**3P**

* No user-facing changes.
