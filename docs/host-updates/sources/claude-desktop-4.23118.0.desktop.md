**v4.23118.0**

2026-11-05

Bundled Claude Code version: 2.1.317.

**General**

* Changed the organization setting that blocks other accounts on a computer: once a member has signed in there, the Claude API key and Console sign-in and the computer's own third-party setup are unavailable too while the block lasts.
* Fixed a new chat's saved draft being deleted when only spaces or blank lines were typed before the draft had loaded.
* Fixed connections failing with a certificate error on computers whose company root certificate was renewed with a new key.
* Fixed Enter or Tab in the "/" menu running a command you had not chosen, or sending your half-typed text, when more commands finished loading.
* Fixed losing the saved sign-in when a company proxy or firewall answered its renewal with a block page.
* Fixed permission and question cards and the "Paused" and "Switched to" notices being cut off, with some buttons out of reach or running out of the card, at 400% zoom or in very short or narrow windows, and the "Switched to" notice not closing there.
* Fixed the third-party history import, the Code tab's queued message and task list, and several saved app files not being read on Windows when the user profile lives in an FSLogix profile container.

**Code**

* Added a Minimize button to the Terminal, Browser, and iOS Simulator panes. A minimized pane stays as a small live view in a corner of the chat, or in the session rail when it's shown. You can expand it again or close it, and in a corner you can also move and resize it (not yet in third-party deployments).
* Changed SSH sessions to hold a message that has waited over a day for its host: it stays above the message box until you press Send now.
* Improved reconnecting SSH sessions through a slow proxy command or jump host on Mac and Linux: your message or Retry now waits up to 90 seconds, unless the SSH config sets `ConnectTimeout`.
* Improved SSH sessions on hosts that ask you to sign in at every connection: they can now ride out longer network gaps without a new sign-in.
* Fixed `SSL_CERT_FILE` and `SSL_CERT_DIR` in Claude Code's managed settings being overridden in Code sessions when the same variable is set on the computer.
* Fixed a Windows issue where quitting during a settings save could leave `~/.claude.json` empty.
* Fixed attached files sometimes failing to upload when the network connection changed during the upload.
* Fixed Claude being unable to read the files of plugins turned on in the managed-settings file when allowed workspace folders are set, for organizations with no server-managed settings.
* Fixed HTML previews in SSH and WSL sessions showing empty charts and tables that the page's own scripts draw. Organizations that set `disableBrowserExternalNavigation` in Claude Code's `managed-settings.json` keep scripts off in these previews.
* Fixed SSH sessions failing to start: "Couldn't start the remote server" on hosts whose home folder is on a slow network drive, and Claude Code start failures on Windows hosts that are not set to English, where low memory and similar causes are now retried and shown with their own message.
* Fixed SSH sessions losing background work on the host after your Claude account's sign-in ran out while the app was away.
* Fixed SSH sessions not reconnecting by themselves after the network drops during a sign-in (with a saved password: one more try while you are at the computer, and one about 30 minutes later if nobody is; Mac and Linux) or after a long outage when the host's firewall limits new connections.
* Fixed the app reconnecting over and over, signing in each time, to an SSH host whose shell start-up files print text or change HOME, now saying what to fix at the first refusal, and SSH sign-in questions from an earlier jump host getting lost when a later jump host shares connections.

**Cowork**

* Fixed a comment on a file seeming to send from a read-only task. It is now saved on the file.
* Fixed Cowork deletions left unsent on the few Windows PCs where an October update moved the app's data folder only part way.
* Fixed imported tasks sometimes starting without your organization's allowed domains when the app was slow to start.
* Fixed imported tasks using Memory after your admin or you turned Memory off.
* Fixed new cloud tasks requesting a model that isn't available to you.
* Fixed removing an import from Settings > Import leaving behind a task whose saved record could not be read.
* Fixed the app closing, reopening and setting up Claude's workspace again when the workspace could not download or set up its copy of Claude Code.

**3P**

* Added "Apps gateway admin" to the user menu, where a Claude apps gateway's spend admins set spend limits and pooled budgets, see spend, and export spend by group and the log of spend limit changes. It shows where people use the gateway's own sign-in and `bootstrapUrl` is on the gateway's address.
* Added `claudeCodeProcessWrapperEnabled`: starts Code sessions through the `processWrapper` launcher in Claude Code's managed settings, on the device or the SSH host. The launcher must supply the inference credential. Not used for sessions that run on Windows, in WSL or in Cowork.
* Added `disableDesktopLocalSessions`: turns off Code sessions that run on the device, WSL included, so Code offers only remote environments such as SSH. Set `sshHostAllowlist` too.
* Added `disableWslSessions` (MDM profile only): blocks Code sessions inside WSL. Unset, they stay blocked on managed devices, and only a machine-wide `false` allows them.
* Added `sshConfigs` (beta): SSH connections offered to everyone in Code's environment menu. Every connection is still checked against `sshHostAllowlist`.
* Added a "JSON config (redacted)" export to Setup on managed devices, for importing into the Admin Console. The values of API key, token and header settings are masked. Check URLs, arguments and text fields before sharing it.
* Added a "Your usage limits" card to Settings > Usage that shows your session and weekly usage limits, where you sign in to a gateway in the app and it reports them. Spend limits do not show there.
* Added a confirmation before you add, upload or turn on a plugin that your organization didn't provide.
* Added a dismissible in-app notice, where a device profile sets `forceLoginOrgUUID`, that the saved Claude Console sign-in will stop working after a future update because its organization is not on the list. It shows the organization's ID to add.
* Added memory to scheduled Cowork tasks that are not in a project: when memory is on, they can read what Cowork remembers but do not save new memories.
* Added sign-in for a plugin's own connector in Cowork and Chat. One sign-in serves all your tasks, chats and scheduled tasks.
* (breaking) Removed `organizationPluginsUrl`. Plugins it installed no longer load, even where the key is still set. Offer any you still need through `allowedPluginMarketplaces`.
* Changed `claudeAiImport.enabled`: Import now also brings projects, memory, scheduled tasks, saved skills, uploaded plugins and some preferences from a Claude Desktop export that the user confirms is their own. Memory and preferences apply at once. Tasks, plugins and skills arrive turned off.
* Changed `claudeAiImport.exportEnabled`: an export now also holds attached files, projects and their files, memory, scheduled tasks, saved skills, uploaded plugins, some preferences and local MCP servers. Passwords or API keys in them are included. Sign-ins and the servers' variable values are not.
* Changed `disableNonessentialServices` to also stop the Code tab from reading the status of GitLab merge requests and Gerrit changes. GitHub is not affected.
* Changed Chat and Cowork on macOS and Linux to ignore cross-certificates between old and renewed private root CAs. If a gateway's or proxy's issuing CA names one by serial number, requests can fail with a certificate error. Put both roots and that CA in the certificate store, then restart Claude.
* Changed Cowork and Chat so the line that shows what Claude is doing reads "Needs your input" while a task waits for you, and "Nothing new from Claude for 2 minutes", counting up, once Claude has sent nothing for two minutes while no tool is running.
* Changed Cowork and Chat to stay at your sent message while a long reply appears. To follow the reply, scroll to the end or press the round button above the message box.
* Changed downloaded updates on macOS and Windows to install sooner: Claude restarts by itself after ten minutes with no Claude window in use and no task running. `disableAutoUpdates` still turns updates off.
* Changed HTML previews in SSH and WSL sessions to run the page's inline scripts. To keep them off, set `disableBrowserExternalNavigation` in Claude Code's managed settings (it also limits the Browser pane to localhost). In a new file, add `parentSettingsBehavior: "merge"` to keep Desktop's policy.
* Changed local Code sessions on macOS and Linux: where an organization's configuration sets `allowedWorkspaceFolders`, or leaves `coworkEgressAllowedHosts` unset or without `*`, Claude can still read Terminal panel tabs but no longer opens or types in them. Your own use of the panel is unchanged.
* Changed profiles exported from Setup with Deployment mode set to Third-party only to also set `disableDeploymentModeChooser`, so that earlier versions hide Claude.ai sign-in too.
* Fixed `/etc/claude-desktop/managed-settings.json` on Linux refusing the unredacted JSON config that Setup's Export menu writes. Earlier versions still refuse it.
* Fixed live artifacts that failed on a connector tool nobody had approved, with nothing to click. The artifact now asks the person to allow the tool.
* Fixed Settings > Import & export asking for an app update, with no way to sign in or choose a file, on computers with an older Claude Code. Import now downloads the Claude Code it needs.
* Fixed the built-in GitHub connector's tools failing behind a proxy. They now follow `egressProxyPacUrl`, `egressProxyUrl` or the system proxy. For a ghe.com tenant, also allow `api.<tenant>.ghe.com`.
* Fixed uploaded plugins working only in the tab they were uploaded from, or missing on MSIX installs below Windows 11 and where the app's data folder is reached through a link. Upload earlier ones again, choosing Replace if asked, to use them in every tab.
* Fixed what you see at a Claude apps gateway's spend limit or group budget: the Code tab shows the gateway's own message instead of rate-limit errors, notices no longer offer a plan upgrade, and the "Billing issue" banner is hidden while those notices show.
