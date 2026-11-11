**v5.1231.2**

**v5.1231.0**

2026-11-10

Bundled Claude Code version: 2.1.321.

**General**

* Added run status to scheduled tasks that run on your computer, in Cowork and Code. A task's card can now say "Last run failed", "Last run failed, will try again", "Needs input" or "Didn't run", or why a run that is due hasn't started, such as "Waiting for its previous run to finish".
* Changed Claude on Windows so that it can stop at launch with the message "Claude could not start" when another program keeps using a file that Claude needs. When Windows starts Claude at sign-in, it stops with no message. Close other programs or restart the computer, then open Claude again.
* Changed Claude on Windows to keep its data in `%LOCALAPPDATA%\Claude-Data`: new installs start there (Windows 10 21H2 or later and Windows Server 2022, as on Windows 11), and existing data moves there on Windows 10 21H2 or later. The Microsoft Store version and third-party deployments are unchanged.
* Changed computer use on Windows to need the "Use system shortcuts" permission before it presses the Windows key with Tab, a number key or a symbol key.
* Changed file opening to refuse Windows file types that install or apply something at a double click (.msix, .appx, their bundles and encrypted forms, .msu, .ppkg, .xbap, .gadget, .sct, themes, styles and troubleshooter packs).
* Fixed a file sometimes being lost on Windows when two files with the same name were saved to Downloads at the same moment.
* Fixed an artifact in the side panel reloading when reopened within a few minutes of using Refresh on it, which could lose unsaved edits.
* Fixed an occasional crash on Linux when typing after the built-in browser was hidden.
* Fixed Claude being unable to read or act on pages in the built-in browser for some signed-in accounts until they signed out and in again.
* Fixed Claude Setup refusing to install with "Trusted app installs must be enabled" on Windows 11 24H2 and later where Windows itself allows the install. When Windows blocks apps from outside the Microsoft Store, the message now also gives the address of the Windows deployment guide.
* Fixed emailed sign-in links doing nothing when clicked again after a failed sign-in attempt.
* Fixed Run on startup not starting Claude at sign-in on Windows (Microsoft Store and other MSIX installs).
* Fixed scheduled task notifications saying "Scheduled task completed" when the run went on without a step. They now say "Scheduled task skipped a step" when the step needed your approval and nobody was there to give it, or "A safety check blocked a step" in Auto mode.
* Fixed the first "Sign in again" after a launch not renewing the Code tab's and Cowork's saved credentials.
* Fixed the saved sign-in being lost when a proxy answered its renewal with a "200 OK" of its own, and sessions failing to start while still signed in when a proxy or Wi-Fi portal answered a sign-in renewal with a web page.
* Fixed the window staying blank for a long time after a page stopped responding, on Windows and macOS.

**Code**

* Changed MCP servers added in the desktop app, desktop extensions included, to follow the MCP allow list, deny list and plugins-only setting in an administrator's Claude Code managed settings, in Code sessions on this computer. The session's MCP list says which servers are kept out.
* Changed SSH sessions on Mac and Linux behind several jump hosts: once a jump host has asked you for a password or code in this version, a dropped session no longer redials it over and over. It retries rarely and tells you to sign in.
* Changed the app on third-party deployments to stop updating your checked-out base branch in the background after it makes a worktree for a session. Use `git pull` to update that branch.
* Changed worktree sessions on SSH and WSL hosts: a folder whose `.git` Git can't use is now refused in most cases, and the card says why. Such a session used to start without a worktree.
* Fixed an SSH session that could miss a new sign-in made while the app was re-attaching to it, and stop later with an authentication error.
* Fixed deleting a session leaving files on disk: the oldest of over 1,700 earlier conversations, saved command output and temporary files after Claude moved to another folder mid-session, and on Windows the conversation file after the app had moved its data to a new folder by copying it.
* Fixed file edits on network paths (UNC shares, WSL folders, `/net` mounts) that could change only the first of several matches, replace a whole file, or delete or overwrite a notebook's first cell.
* Fixed pull request status, checks, and auto-fix failing with "HTTP 401" for GitHub Enterprise Server hosts behind an authenticating proxy that the GitHub CLI can pass.
* Fixed running sessions staying in Auto mode after a device policy turned it off, and added a notice when Claude Code takes a session out of auto mode on its own, saying if an admin's policy did it, or that the app couldn't check why.
* Fixed the automatic local cleanup on Windows not removing older sessions' records and unsent messages from folders that an earlier move of the app's data left behind, for organizations with the Claude Code + Cowork HIPAA configuration.
* Fixed the Code tab freezing when many sessions are open.

**Cowork**

* Changed Cowork so that edits Claude makes to a session's CLAUDE.md no longer update your global instructions. To change them, use Settings.
* Fixed a comment you were typing on a file being lost when Claude sent an updated version of that file.
* Fixed a crash when many pending approval requests closed at once.
* Fixed an earlier Cowork task not opening, with no message, on a computer that can't run Cowork. The task now opens read-only and says why.
* Fixed Automatically approve not switching on in a Cowork task right after you pick a model that can run Auto. The switch now works at once, without sending a message first.
* Fixed prompts in imported sessions: "Go back" on the first-message prompt showed your message as sent instead of returning it to the message box, and "Continue" or "Trust and resume" could send an earlier message a second time if the prompt was left unanswered and the session reopened.
* Fixed the automatic local cleanup on Windows not removing older tasks, uploads and cached project copies from folders that an earlier move of the app's data left behind, for organizations with the Claude Code + Cowork HIPAA configuration.
* Fixed your own message losing characters such as underscores and asterisks when copied with its Copy button and pasted back into an empty message box.

**3P**

* Added "Allow for 30 days" to the prompt shown before a scheduled Cowork task deletes files in one of its own folders. Later runs can then delete there without asking. `mcpScheduledTaskApprovalLifetimeDays` sets the number of days, and `0` turns the option off.
* Added `organizationAnnouncement`: a message from your organization that each person can close, shown as a card on the start screen or as a dialog. It shows again when you change its `id`, or its text if it has no `id`. Update all devices before you put it in a device profile.
* Added a warning when other Claude Code managed settings on a computer override this app's policy there. The diagnostic report shows it with the fix, local Code sessions show a notice, and your OTLP collector gets an event.
* Changed `autoModeEnabled` set to `false` through device management to take effect without a restart. At the app's next configuration check (every 10 minutes by default), running Cowork tasks and Code sessions, except WSL sessions, leave Auto mode and say so.
* Changed `claudeAiImport.automatic3pImport` to keep Cowork projects' descriptions and folders, and Cowork sessions' folders. The folders are connected again without asking the person, so Cowork can read and change their files as before the move. Copies made by earlier versions don't get them back.
* Changed `managedMcpServers`: a local server can leave out its own `command` if `platformOverrides` names only `win32`, `darwin` or `linux`, each with a `command`. It runs only on those systems. Update all devices first: older versions drop it, and block plugins' MCP tools if that empties the list.
* Changed Code sessions on Windows under an organization's configuration to ask before starting a project's dev server in the Auto and Bypass permission modes, as on macOS and Linux.
* Changed Cowork tasks in Auto mode to wait for Auto mode's check before each shell command, usually one more request to your provider. A command that the check blocks, or cannot check, does not run.
* Changed each model ID in `inferenceModels` to allow only the version it names, so `claude-opus-5` no longer also allows `claude-opus-5-5`. On the Claude API, a list of only retired Opus 4 or 4.1 models no longer starts sessions. List a current model.
* Changed scheduled tasks to retry a run that fails on a server error from your provider or gateway, such as 500 or 529, before Claude responds. Retries end six hours after the first failure. One refused token renewal no longer ends a sign-in through your gateway or identity provider.
* Changed sessions and scheduled tasks saved on a model that `inferenceModels` doesn't list to run on the default model, which is the first model in the list.
* Changed Sign in with Google on Vertex AI: hooks, MCP servers on the computer and commands in the Code tab that call Google Cloud now need the person's own Google Cloud credentials on that computer, for example from `gcloud auth application-default login`.
* Changed the credential, client-secret, headers and environment helpers set in managed configuration to start in `/` on macOS and Linux and in `System32` on Windows. A helper that reads or writes a file by a relative path must now use its full path.
* Changed what an unset `desktopHome` does where only Code is on. Versions 4.4212.0 to 4.23118.1 turn on Unified Claude there from 12:00 PM PT on November 10. This version waits until 12:00 PM PT on December 17, 2026. To keep only Code, set `desktopHome` to `off` wherever your settings come from.
* Removed the "Open external link" confirmation for most links to other websites, on third-party deployments too. It still shows for some links, such as private IP addresses, names ending in .local or .internal, punycode (xn--) host names, and email or phone links. No setting brings it back.
* Removed the Chat, Cowork and Advanced file analysis switches from the Setup window, starting 12:00 PM PT on November 10, 2026. The Unified Claude switch, which sets `desktopHome`, takes their place.
* Fixed `claudeAiImport.automatic3pImport` dropping project pins, sidebar groups and artifacts' earlier versions, and copying nothing when the computer had no earlier sessions. Computers moved by an earlier version get these once, at their next launch. Scheduled tasks copied then run if they were on.
* Fixed a saved provider API key on macOS not being read at launch when the first of two keychain prompts was closed and the second was answered, or when a device management tool opened Claude with the root account's home folder.
* Fixed Auto mode blocking every action it checks in sessions on a Fable or Mythos model when the model list has no Sonnet 5 and no Opus entry tagged with `anthropicFamilyTier`. The check now uses a listed Opus 4.5 or newer.
* Fixed connector tools set to `ask` in `toolPolicy` not showing an approval prompt in Auto mode on devices with their own Claude Code managed settings. They now ask, so unattended scheduled runs stop at them.
* Fixed connectors losing their sign-in when the sign-in server was slow to answer a token renewal or did not answer it. The Connectors page could also stay loading in that case.
* Fixed Cowork tasks and chats showing "Claude Code crashed" when your organization's managed settings for Claude Code, such as a minimum version, stop it from starting. They now show "Claude Code couldn't start" and the reason.
* Fixed new Code sessions starting on the model and effort of the folder's last session when `alwaysStartWithDefaultModel` is on. They now start on the default model and effort.
* Fixed the token limit set with `inferenceMaxTokensPerWindow` not counting the tokens that subagents and conversation compaction use. People now reach the limit sooner, most of all in tasks that use subagents.

**v4.23118.1**

2026-11-09

Bundled Claude Code version: 2.1.321.

**General**

* Changed how Claude Code finds the programs it starts itself on Windows, such as git: it no longer finds them through network (UNC) or relative PATH entries, or behind a link to a network share. Where Git is found only that way, sessions use PowerShell instead of Git Bash.
* Changed the certificate that signs Claude Code on macOS to a newer Developer ID certificate of the same Anthropic team (Team ID Q6L2SF6YDW). Rules that match the Team ID are unaffected; rules that pin the certificate itself need the new certificate added beside the old one.
* Fixed replies stopping with "API Error: EPROTO: The TLS handshake failed" when the connection broke partway through a reply. Claude now keeps what arrived and continues.

**Code**

* Changed skills in a subfolder's `.claude/skills` folder to no longer load during a session when Claude Code's sandbox is on. To use them, start the session in that subfolder.
* Fixed Bash commands sometimes running in the wrong folder when Claude sent several at once and an earlier one changed folders.
* Fixed the project's skills, commands and agents that a worktree lacks, such as files git does not track, disappearing from the menu after Claude entered that worktree. While there, the main project folder's copies are listed and run.

**Cowork**

* Fixed a task or chat showing "Claude Code crashed" at the next message when its saved state file was cut short.

**3P**

* Changed `fable` in `inferenceModels` to request the newest Fable model, unless your gateway's `/v1/models` has an ID `fable` or a model tagged Fable. Requests can fail if that model isn't served. To pick one, keep `fable` and add an entry with its exact ID and `anthropicFamilyTier` set to `fable`.
* Changed tool calls made by a plugin's own code (a mod), rather than by Claude, to never show an approval card. They now run where only the user's approval or Auto mode would have stopped them, including connector tools with no `toolPolicy` entry. Such calls to a tool set to `ask` are refused.
* Fixed Cowork's Progress panel not ticking steps that a subagent marked done.
