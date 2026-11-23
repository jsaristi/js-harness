**v6.6395.0**

2026-11-17

Bundled Claude Code version: 2.1.326.

For administrators of SSH hosts: SSH helper version 13047a5194346a68538f5525406bf5f861013d73. SSH host launcher contracts: 1 (sessions), 2 (plugin commands).

**General**

* (breaking) Changed Claude Desktop on macOS to ignore a user-level configuration profile where a machine (computer-level) profile exists. Before updating, move settings you still need, including retention periods, to the machine profile. Afterward, the diagnostic report lists the settings lost.
* Changed approval shortcuts to need a second press when keyboard focus is outside the approval card. The first press moves focus to the button. Press the same key again after a moment to confirm.
* Changed local MCP servers added under Settings > Developer: Claude Code's managed `allowedMcpServers` and `deniedMcpServers` now apply to them in Chat and Cowork too, not only in Code. A refused server stops after the update, and a notice says so.
* Changed sessions to wait for the Claude Code download after an app update, instead of starting a much older copy left on the computer. In third-party deployments only Code sessions wait, and an older copy still starts if the download doesn't finish in time.
* Removed the Transcript text size setting. Transcripts now read at one size. Use zoom to make them larger.
* Fixed dictation sometimes dropping your last words after you stop it.
* Fixed keys and pastes being entered twice on macOS, in Claude and sometimes in other apps, while another app was intercepting Claude's keyboard input.
* Fixed MCP servers added in Claude Desktop, and desktop extensions, staying available in open Cowork and Code sessions after an admin turned them off in the admin console. This fix doesn't apply to third-party deployments.
* Fixed menu shortcuts doing nothing or showing the wrong keys on German, French, Swiss and other non-US keyboard layouts on macOS and Windows, and letter shortcuts such as Ctrl+K doing nothing on Russian, Greek, Arabic, Hebrew and Thai keyboards on Windows and Linux.
* Fixed React and Mermaid file previews loading forever when the network blocks the preview host. After 20 seconds they now name the host and offer View source and Try again.
* Fixed the app ignoring Increase contrast on macOS and contrast themes on Windows. A change to the setting takes effect the next time the app starts.
* Fixed update problems: Check for Updates saying nothing when a download failed, some updates that Windows refused not being retried after the computer restarts, a failed newer download putting off the automatic restart, and one cause of Macs coming back on the same version after an update restart.
* Fixed windows on macOS 27 sometimes staying frozen or blank after switching between windows that cover each other.

**Code**

* Added iPhone Duo support to the iOS Simulator pane: test your app on an iPhone Duo simulator and fold it closed, half open, or open. Requires Xcode 27.1 or later (not yet in third-party deployments).
* Changed admin restrictions on the built-in browser and saved SSH passwords to be remembered from an earlier launch, so they hold while your organization's settings load or can't be reached. This doesn't apply to third-party deployments.
* Changed Auto mode to ignore some wildcard shell allow rules, such as ones that name no program or that start with `$HOME`, in managed settings too. The safety check then decides those commands.
* Changed sandboxed shell commands: after each one, a symlink that appeared in a repository's `.git` folder during the session is renamed to `.<name>.claude-sandbox-quarantine-<id>`, or deleted if the disk is full or the name too long. To keep one, rename it back once no session uses the repository.
* Changed worktree sessions to stop updating your local base branch, and your checkout's files with it, in the background. Use `git pull` to update that branch.
* Fixed "Archive all" and "Delete all" ending an SSH task that was still running after the app quit or updated, with no warning.
* Fixed a case where the iPhone Duo simulator ignored taps shortly after the phone was closed.
* Fixed a half-written reply being lost when the app quit while Claude was responding.
* Fixed an automatic archive deleting new, uncommitted files written in a session after its pull request merged.
* Fixed Auto mode being offered again at launch when your organization turned it off and its settings couldn't be loaded. This fix doesn't apply to third-party deployments.
* Fixed messages queued before quitting occasionally going missing after the app restarts.
* Fixed resumed sessions losing earlier conversation history when Claude Code ran low on memory, and losing recent turns after a crash when the previous turn ended with an empty reply.
* Fixed Settings > Storage offering to remove a worktree with a detached HEAD, which could lose commits that aren't on any branch.
* Fixed SSH sessions losing their conversation, and the message you had just sent, when Claude Code was started on a host whose home folder was not back yet.
* Fixed the app deleting the files a session with no folder left behind after it moved to a folder.
* Fixed the last words of a dictated message being left out when it was sent with the microphone still on or right after stopping it.

**Cowork**

* Added a prompt on macOS to keep a folder connected to a cloud session when the folder is renamed or moved, so you don't have to connect it again.
* Changed the card where Claude asks to delete a scheduled task: it now warns that sessions the task started may be removed too, and Delete needs a click instead of Enter.
* Changed website permission cards to show Deny first and the main Allow button last, so the first button that Tab reaches is now Deny.
* Removed Ghostscript, so Claude can no longer convert or render `.eps` and `.ps` files, or run `gs`, `ps2pdf` or `pdf2ps` (for example to shrink a PDF).
* Fixed computer use on macOS often refusing clicks and typing when it could not read an app's window, and refusing Command-A in the file name box, forward delete, shift-click and the expand arrow while a Save dialog is open. Input is still not sent to an app that is not responding.
* Fixed Cowork asking for a new sign-in when a firewall, proxy, or VPN blocked the sign-in request.
* Fixed scheduled tasks' attached files: the automatic move to the cloud skipped some tasks, cloud tasks couldn't read a file after it was attached to another chat, and removing an unreachable trusted folder took files from other tasks. On Windows, a task with a web download can still stay local.
* Fixed shell commands stopping after about 3 minutes when Claude asked for a longer time limit, up to 10 minutes.
* Fixed some tasks showing "This page ran into a problem" each time you opened them, when their saved history held an incomplete entry.
* Fixed tasks on Windows showing "Something went wrong" instead of starting when many plugins are enabled.
* Fixed the app sometimes quitting and relaunching itself on Windows and Linux when Cowork was slow to start.
* Fixed the built-in browser carrying on with its remaining batched actions after you stop a cloud task.
* Fixed the workspace failing to start: on Windows after its virtual machine had stopped unexpectedly, and with "Claude Code setup failed" when the computer blocked the app from rewriting an unused file in its data folder.

**3P**

* Added a side panel in Cowork and Chat that keeps a connector's interactive app open next to the conversation.
* Added an automatic restart for tasks on Linux SSH hosts. If the app closes in a crash, an update or similar and Claude Code ends mid-task, the app restarts it when it next reaches the host. It continues in the saved permission mode, with nobody at the computer. A normal quit prevents this.
* Changed `allowedWorkspaceFolders` in local Code sessions: Claude can now use the Read tool on a long tool result that its own session saved, though that file lies outside the listed folders.
* Changed `builtinToolPolicy` and `disabledBuiltinTools` to use the tool name `SetGoal` in place of `ProposeGoal`. Entries that say `ProposeGoal` are still accepted.
* Changed `remoteFileDownloads` (beta): when unset, it now allows all but blocked file types from SSH hosts and WSL in Code. Device policy for this app, a configuration server, Admin Console or managed Claude Code settings keep it `limited`. A script-installed file doesn't, so set `limited` in it.
* Changed an `environment` list under `autoMode` in Claude Code's `managed-settings.json` to replace the built-in entries, as it does in a terminal, so Auto mode may judge some actions differently. To keep those entries, add `"$defaults"` to the list.
* Changed Code-tab preview pages to follow `coworkEgressAllowedHosts` while `builtinBrowserEnabled` is off, its default. With a list other than `*`, even an empty one, content from unlisted hosts stops loading and a notice says so. Loopback addresses always load. An unset list changes nothing.
* Changed first-time sign-in where Claude Code's managed settings, such as `forceLoginMethod`, restrict it. Someone with no third-party setup yet can't use a Claude API key, and can't use Claude Console sign-in if those settings require another method. Setups in use and other providers keep working.
* Changed SSH sessions to skip an `mcp_tool` hook that calls a `managedMcpServers` server on the person's computer. The action then gets only the usual permission check. To keep the hook, set the tool's exact name to `allow` in the server's `toolPolicy`. Cowork and Chat then stop asking for that tool.
* Changed the `.mobileconfig` export in Setup to a machine (computer-level) profile. On a Mac with a machine profile, Claude now ignores a user-level profile. A connection set only at user level stops working, and Claude usually opens the claude.ai sign-in page. Move it to the machine profile first.
* Changed the token limit set with `inferenceMaxTokensPerWindow`, and the figures in Settings > Usage, to also count Auto mode's built-in safety check and requests that were stopped. People reach the limit sooner, most of all in Auto mode.
* Removed the 100 MB limits on project files, attached files and output files in an export (`claudeAiImport.exportEnabled`). An export can now hold up to 20 GB of files, the most an import accepts. A file or sub-folder that can't be read no longer leaves out all of a project's files.
* Fixed "Merge into existing" leaving an imported project's memory behind. The memory now comes into the project that you keep. Projects already merged on an earlier version don't get that memory back.
* Fixed `autoModeEnabled` turned off from a configuration server or Admin Console having no effect on a running app until a relaunch. Running sessions now leave Auto mode. The app still asks for a restart.
* Fixed `coworkSessionRetentionDays` and `chatSessionRetentionDays` deleting some Cowork tasks and chats up to one retention period late on Amazon Bedrock with IAM Identity Center and Vertex AI with Google sign-in. The app can delete overdue ones soon after the update. Free up space now offers them.
* Fixed `cp` being refused when copying a single file out of a read-only folder, such as a plugin's own folder or one that `allowedWorkspaceFolders` marks as read-only.
* Fixed a web filter's block page signing people out of AWS IAM Identity Center on Bedrock. When such a page stops a new sign-in, the app now names the AWS hosts to allow.
* Fixed remote connectors asking to reconnect when a network or proxy error kept their background sign-in renewal from finding the sign-in server. The app now keeps the sign-in and tries again.
* Fixed sessions with many images on Vertex AI stopping at the 30 MB request limit. Claude now compacts the conversation and goes on.
* Fixed SSH sessions on Linux and Mac hosts refusing file work under `allowedWorkspaceFolders`, or in a worktree after a reconnect, with the app closed or the computer asleep. The host now uses the folders the session started with, so a tighter list reaches a running session only when the app is back.
* Fixed Web search showing as "Blocked by your admin" under Connectors where your organization replaces it with its own search connector. A web tool listed in `disabledBuiltinTools` now has no row there, so Connectors doesn't show that it is off.

**v5.11492.5**

2026-11-13

Bundled Claude Code version: 2.1.325.

For administrators of SSH hosts: SSH helper version 87375cc7c944eb9d45c8d9267edc70a4b4827961.

**General**

* No user-facing changes.

**Code**

* Changed sandboxed shell commands on macOS and Linux: most ask first in Manual and Accept edits, and Auto mode checks many of them. A routine can stop at a prompt. To undo this, add `"autoAllowBashIfSandboxed": true` to the `sandbox` block of `~/.claude/settings.json`, creating it if needed.
* Changed sandboxed shell commands so that `git worktree add`, `move` and `remove` fail, as does a commit in a worktree the session was not started in or given.
* Changed some shell allow rules that name a variable, such as `Bash(NODE_ENV*)`, to stop matching, so those commands ask for approval.
* Changed workflows in local sessions to pause at your Claude plan's usage limit and continue after it resets, if the reset is within a day and Auto-continue when limits reset is on.
* Fixed a session staying busy after another of your sessions sent it the same message twice or many messages at once.

**Cowork**

* No user-facing changes.

**3P**

* Changed certificate checks: under a company CA that limits DNS names, a certificate with IP addresses but no DNS name is refused if its common name is an IP address or a domain the CA does not allow. Turns to such a gateway fail until its certificate lists an allowed DNS name.
* Changed most shell commands in Claude Code's sandbox (default on managed macOS and Linux) to ask first (see Code). To undo, add `"autoAllowBashIfSandboxed": true` to the `sandbox` block of its `managed-settings.json` (SSH: on the host). A new file needs top-level `"parentSettingsBehavior": "merge"`.
* Fixed sessions failing to start on Windows when the organization's managed settings are very long, for example a long model list or many allowed hosts.
* Fixed turns failing when a gateway answers with 403 for an expired token from a credential helper, or for a sign-in past its stated expiry. Claude now gets a fresh token and retries.
