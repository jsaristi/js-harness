**v4.16336.0**

2026-11-03

Bundled Claude Code version: 2.1.317.

**General**

* Changed sessions to ignore cross-certificates between old and renewed private root CAs in the certificate store. If a proxy's or gateway's issuing CA names one by serial number (Authority Key Identifier), requests can fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Add that issuing CA to the store.
* Deprecated fast mode for Claude Opus 4.8 as of October 30, 2026; it will be removed on November 30, 2026, after which fast mode requests on Opus 4.8 return an error and do not fall back to standard Opus 4.8.
* Removed claude.ai from the sites the built-in browser can import cookies for from another browser. If you imported claude.ai before, you are signed out of it in the built-in browser at the next launch.
* Removed the tools that let Claude list and start shortcuts saved in the Claude in Chrome extension.
* Fixed Claude on Windows staying open with no window after Windows declines an update.
* Fixed dictated words being lost: Quick Entry dictation on Mac could close without adding what you said, and words still arriving in one message box could be discarded when a message was sent from another box on the same page.
* Fixed files chosen in the message box being added after the signed-in account changed.
* Fixed scheduled tasks failing silently: Claude now notifies you when a run couldn't use a connector that needs reconnecting, and when a run can't start.
* Fixed the app coming back hidden or behind other apps, or the Dock icon on macOS showing no window, when the app was opened again (from its Dock icon, a link, a file, or a tray or menu bar item) while it was restarting to install an update or restarting on its own.
* Fixed the Windows installer closing Claude and then failing on computers where an organization's policy blocks apps from outside the Microsoft Store, and leaving Claude closed when an installation fails after it has closed the running app.

**Code**

* Changed worktree sessions: Claude Desktop no longer runs git's `post-checkout` hook when it makes a worktree; Claude Code's own worktrees run none either. `pre-commit` and other hooks still run for commits there. To copy ignored files like `.env` into new worktrees, list them in `.worktreeinclude`.
* Removed the Windows fallback that read Claude Code's `managed-settings.json` from `C:\ProgramData\ClaudeCode`. Keep the file in `C:\Program Files\ClaudeCode`, the only folder that Claude Code itself reads.
* Fixed "Trust new key" failing for SSH hosts on Windows virtual desktops that use FSLogix or similar profile containers.
* Fixed `desktopSessionCleanupPeriodDays` (in Claude Code's settings) not deleting old transcripts of sessions still in the sidebar. Claude Code's cleanup now deletes them at the age its settings give, and they can't be restored.
* Fixed a missing warning in SSH sessions when a sandbox that an organization's managed settings turn on can't start on the remote machine.
* Fixed messages to SSH sessions being lost or stuck with no notice when the connection dropped or Claude Code couldn't start on the host, after the host was rebuilt, or after signing in on the New session page when the first try couldn't connect; they now send, retry, or return to the message box.
* Fixed project and local MCP servers disconnecting after the first turn in some sessions.
* Fixed SSH reconnects on Windows setting off a jump host's phone push at every retry with nobody at the computer.
* Fixed SSH sessions left running overnight stopping with a sign-in error, after Remote Control was denied for the account or after an unrelated crash whose message mentioned "401" or "unauthorized".
* Fixed the previous account's sessions showing in the list after an account change that keeps the page open.

**Cowork**

* Changed HTML and SVG file previews: alert, confirm and print dialogs are removed, including from buttons you click in the page; a page can start a download only shortly after you click in it; and a hung preview no longer stays on screen under the next file's name or keeps running after it closes.
* Changed Reset App Data to also delete the signed-in account's Cowork tasks from Anthropic servers before it resets, where its confirmation dialog says so. Help > Troubleshooting > Delete Cowork VM Sessions and Restart is now named Delete Cowork Data and Restart.
* Fixed a case where resetting memory could clear another signed-in account's local Cowork memories if the account changed during the reset.
* Fixed buttons such as Deny being cut off or out of view on the web fetch, scheduled task, computer use and workflow permission cards in a small or zoomed window.
* Fixed files added while creating a project from an existing folder emptying or replacing a file already in that folder.
* Fixed some links in Claude's replies to files on a Windows computer not opening.
* Fixed the app reinstalling the Cowork workspace (and, on a stop, quitting and relaunching) when the workspace was stopped or Claude was quit while it was still starting, for example by signing out or choosing Help > Troubleshooting > Delete Cowork Data and Restart.
* Fixed the notice shown when a network blocks, interrupts, or alters the download of Claude's workspace, which advised a restart or a reinstall and could not be closed. It now offers Retry, says what to ask an IT administrator to allow, and can be closed where tasks go on without the workspace.
* Fixed workspace notices such as "Additional setup needed" covering a permission request or the message box in a short or zoomed-in window, which hid the request and could make Deny and Allow once unclickable.

**3P**

* Added `deploymentMode` (not read from a bootstrap server): the app runs only on your third-party setup (`3p`), only signed in to Claude.ai (`1p`), or as each person chooses (`any`). Older versions read only `disableDeploymentModeChooser`, which Setup no longer offers: for `3p`, set it to `true` too.
* Added `inferenceGatewayAutoModeServerChecks`, a temporary setting, off unless you turn it on, that has the provider behind your gateway check risky Auto mode actions by sending it session details such as folder paths and a user name.
* Added `platformOverrides` to `sessionStatusLine`, to run a different status line program on Windows, macOS or Linux. An older version rejects the whole setting when this is present and shows no status line, so add it only after all devices are updated.
* Added a warning to the app's log and diagnostic report when a Claude Console sign-in's organization is missing from a device profile's `forceLoginOrgUUID` list. A coming release will allow only listed organizations, so add your Console organization's ID to the list now.
* Added the Monitor tool to Code sessions where Bash is available: each new batch of a watched command's output starts a turn, with nobody typing. Turn it off with `Monitor` in `disabledBuiltinTools`.
* (breaking) Changed an unset `desktopHome` to read as `standard` at launches after 12:00 PM PT on November 10, 2026, even where `chatSessionRetentionDays` is set. New conversations that are Cowork tasks are deleted by `coworkSessionRetentionDays`, not `chatSessionRetentionDays`, so set both.
* (breaking) Changed SSH on Windows to reach hosts new to the device (every host, on PCs that keep no app data) through Microsoft OpenSSH 9.4 or newer, not the built-in library. To stay on the library, set `sshTransport` to `builtin` everywhere you manage settings. Mac and Linux then use it too.
* Changed `inferenceModelPricingEnabled`: when on, each session's estimated cost now shows above the message box in Cowork, Chat and Code, not only on the Usage page. Where `sessionStatusLine` is set, its program's line shows there instead.
* Changed a `PreToolUse` or `PermissionRequest` hook whose command is only a quoted path or string, with no `shell`, `args` or `"onFailure": "continue"`, to block calls on PCs without Git for Windows. Install Git and reopen Claude, or for an `.exe` unquote it, add `"args": []`, `"onFailure": "block"`.
* Changed a setting left past its deprecation date, such as `organizationPluginsUrl`, to be ignored, not an error. A device profile holding only such settings no longer locks local settings or sets aside the Admin Console's configuration, whose retention periods then delete idle sessions for good.
* Changed Code sessions on Linux hosts where AppArmor stops the sandbox, such as Ubuntu 24.04 over SSH: shell commands that failed now run unsandboxed, so `coworkEgressAllowedHosts` and `allowedWorkspaceFolders` don't limit them. An AppArmor profile for bubblewrap on the host restores it.
* Changed how `autoMode` lists in Claude Code's `managed-settings.json` apply in local Code sessions and Cowork tasks: an `allow` list without `"$defaults"` replaces the built-in exceptions, and a `soft_deny` or `environment` list without it adds to the built-in rules. Auto mode may ask or block more.
* Changed recurring scheduled tasks to retry for up to about three and a half hours, up from about one, when the inference provider can't be reached. Claude notifies you of the first failure and the final outcome, and when tasks are waiting for you to sign in again.
* Changed SSH from Windows over OpenSSH: each connection signs in at least twice and keeps the sign-ins open, so a per-user login limit must leave room and a one-time code or push is asked at each. The sign-in dialog offers Remember password, and the SSH sessions docs page says how to turn it off.
* Changed the Code tab on devices whose only configuration is a local file, even one copied by a script: with `coworkEgressAllowedHosts` unset and `blockReadsOutsideWorkingDirectories` off, shell commands can reach the network. An empty list still blocks them where Claude Code's sandbox runs.
* Changed which program opens SSH connections from Windows over OpenSSH, now the default: `ssh.exe`, not `Claude.exe`. Where a firewall or endpoint rule allows SSH by program, allow `ssh.exe` too. If it starts but can't reach the network, the connection fails and the built-in library does not step in.
* Deprecated `coworkTabEnabled`, `chatTabEnabled` and `chatAdvancedFileAnalysisEnabled`: `desktopHome` replaces them. Remove them before 12:00 PM PT on December 17, 2026. Users see a warning from November 17 while one is still set.
* Deprecated `sessionRetentionHold` (Suspend session deletion): ignored from 12:00 PM PT on December 17, 2026, when retention periods permanently delete idle sessions it kept. To keep them, first set all three periods to 3650 days where they are set. Once devices have the new periods, remove the key.
* Removed the Chat and Cowork switch from a project's page under Unified Claude. A message sent there now starts a Cowork task, or a chat on a computer that can't run Cowork.
* Removed the Send to Anthropic button from the diagnostic report. To share a report, export it to a file from Help > Troubleshooting > Generate Diagnostic Report.
* Updated the app to the new Claude look: new colors, icons and type. In Cowork and Chat, Claude's steps and progress notes now sit behind one status row, which opens with a click.
* Fixed a "Get set up for agent mode" download prompt appearing in chats and tasks.
* Fixed cases where remote connectors asked people to sign in again: after a brief server or network error while their sign-in renewed in the background, after their organization plugin's folder was briefly missing, or when they signed in just as the connector reconnected by itself.
* Fixed certificate settings such as `NODE_EXTRA_CA_CERTS` in the `env` of Claude Code's `managed-settings.json` not taking effect in some sessions, such as Chat and Cowork. Settings already in that file now take effect, so review them before rolling out.
* Fixed Claude Desktop opening on Code, or showing "Code has been disabled by your organization’s administrator.", at launch when the Admin Console or a configuration server turns Chat on and Cowork off.
* Fixed local and WSL Code sessions that stopped when the app quit or restarted for an update. When you return to one within a day, the app sends one automatic message, shown as yours, asking Claude to continue. That turn uses tokens on your organization's provider.
* Fixed skills that could not be renamed or edited on some Windows virtual desktops with redirected user profiles.
* Fixed the app window and the Setup window growing larger than the screen on small displays or with Windows Text size or Display scale set high, which left the window buttons, the message box and Apply Changes out of reach.
