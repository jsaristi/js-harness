**v5.11492.2**

2026-11-13

Bundled Claude Code version: 2.1.321.

For administrators of SSH hosts: SSH helper version 87375cc7c944eb9d45c8d9267edc70a4b4827961.

**General**

* No user-facing changes.

**Code**

* No user-facing changes.

**Cowork**

* No user-facing changes.

**3P**

* No user-facing changes.

**v5.11492.0**

2026-11-12

Bundled Claude Code version: 2.1.321.

**General**

* Added Developer > Export Configuration Template, which exports ADMX and Profile Manifest policy templates for the settings of standard Claude Desktop, third-party inference, or both.
* (breaking) Changed the built-in browser and preview panes to send a client certificate only to sites that device management lists in `builtinBrowserClientCertificateHosts`. A site that requires one stops loading there until it is listed. Behind a proxy that asks for one on every site, use `*`.
* Changed `builtinToolPolicy`: `ask` rules with arguments, such as `Bash(curl *)` in Code or `Read(~/.ssh/**)`, now show the approval prompt on devices with their own Claude Code managed settings, unless those settings set `allowManagedPermissionRulesOnly`.
* Changed automatic restarts for updates on macOS to wait while the keychain is locked, for up to 72 hours. A locked keychain doesn't delay restarts timed by `autoUpdaterEnforcementHours` or `installedUpdateEnforcementHours`.
* Fixed a likely cause of brief freezes on Windows when opening a session or answering an approval after its notification had left the screen.
* Fixed Claude reopening as a blank window on Windows after it was closed while minimized.
* Fixed Claude Setup on Windows offering people without administrator rights an install that removes their working MSIX install of Claude; it now opens that Claude instead.
* Fixed Code and Cowork losing a Claude.ai sign-in when a company proxy or gateway answers its background renewal with a JSON error.
* Fixed edits to an artifact being lost when you left your chats or Cowork tasks within a few seconds of typing.
* Fixed the app on macOS restarting by itself after ten idle minutes to install an update while the keychain was locked, which left it unable to read its stored secrets until the next restart.
* Fixed the import from Claude (third-party) leaving out scheduled tasks, projects with no session, and accepted project instructions from a Claude Desktop export that the user confirmed as their own.

**Code**

* Changed Auto mode in local Code sessions: a session that Claude started can now start more sessions for its task with no approval, if Auto's check allows it. The limits are 10 per message you type and 5 at once.
* Changed local, SSH and WSL Code tab sessions, except scheduled runs, to ask before using a connector tool that the organization limits to "Needs approval" in claude.ai, in every permission mode. Outside Auto and plan mode the prompt can offer "Allow for this session". Not in third-party deployments.
* Changed SSH sessions on the built-in SSH library, including with `sshTransport` (beta) set to `builtin`: on Mac and Linux hosts, MCP servers from `claude_desktop_config.json` now run under Claude Code on the host, as they do over OpenSSH. They follow the host's MCP rules and stop with the session.
* Changed which `cleanupPeriodDays` the app follows: one set on the computer in Claude Code's managed settings now counts if server-managed settings set none and the person's own (default 30 days) isn't shorter. Not in third-party deployments.
* Fixed a rare case on Windows where ending an SSH sign-in could close an unrelated program.
* Fixed an administrator's `env` values for tool and workflow variables in Claude Code's managed settings being ignored in local sessions when the computer already set the same variable.
* Fixed local scheduled tasks and Remote Control sessions with no model of their own ignoring the `model` in an organization's Claude Code managed settings. Not in third-party deployments.
* Fixed most automatic SSH connects over the built-in SSH library sending phone sign-in prompts again and again while nobody is at the computer. These connects now try the SSH key alone, and a host that needs more waits until the person is back.
* Fixed new sessions starting in Manual when settings make Don't ask the default permission mode.
* Fixed Rewind saying a code restore had failed, and offering another try, while the first restore could still be changing files.
* Fixed SSH and WSL tasks staying interrupted when Claude Code was lost while an automatic message was waiting, and messages to an SSH task running while the app was closed waiting 30 seconds or longer; in most cases they now reach Claude at once.
* Fixed SSH sessions getting no worktree, and working in the real checkout, on hosts where Git is only on the login shell's PATH (nix, conda, Homebrew on Linux).
* Fixed SSH sessions getting stuck, asking for approval again, or running a connector's tool twice or late after the app quit, updated or lost its connection while the tool was being called.
* Fixed SSH sessions whose key stops being accepted redialling so often that the server blocked the computer's address, and sessions behind a proxy command or jump host that is slow after a wake staying on "Reconnecting" instead of reconnecting by themselves once you are back (Mac, Linux).
* Fixed the model menu offering models outside an administrator's managed-settings `availableModels` list when a user or project settings file listed others. Not in third-party deployments that set `inferenceModels`.
* Fixed Try again in SSH and WSL sessions sending the words "Try again" instead of your message, after Claude Code stopped before reading it.

**Cowork**

* Added Download to the menu of files from tasks that run on your computer, so you can save a copy wherever you choose.
* Changed connecting a folder by its path to a task that runs on your computer: Claude now refuses a path that goes through a link inside a folder such a task uses, if the link leads outside that folder. Choose the folder where it really is, not a link to it.
* Changed GitHub access in tasks with restricted network access to clone and fetch only. In these tasks, `git push`, Git LFS and SSH remotes no longer work. Deployments that use the organization's own model provider see no change.
* Changed what commands Claude runs can do on `registry.npmjs.org`, `registry.yarnpkg.com` and `crates.io`: downloads and `npm audit` still work, but publish, login and other requests are refused. Not affected: tasks whose Domain allowlist is "All domains", and third-party deployments.
* Improved ejecting external drives on macOS: Claude now tries to release a drive shortly after a command on it ends, so that you can eject the drive while Claude is open.
* Fixed a connected folder that you renamed, moved or deleted coming back as an empty folder the next time Claude ran a shell command.
* Fixed a Cowork task or third-party chat staying blank, with no reply or notice, after safeguards flagged a message.
* Fixed a task that kept asking before each web search after the administrator lifted an `ask` on web search.
* Fixed attached files missing from new copies of Cowork and Chat sessions from an earlier organization or another Claude profile, and file cards and files from earlier turns not opening in copies. Also fixed new imports from an export file failing at every message behind some inference gateways.
* Fixed Cowork tasks going missing on Windows 11 and later after Claude switched back to an earlier copy of its data. Third-party deployments are not affected.

**3P**

* Added `autoModeClassifierModel`, which chooses the model for Auto mode's built-in safety check in Code and Cowork. Actions your provider reviews itself don't use it. If unset, Claude Code chooses the model. A device's `CLAUDE_CODE_AUTO_MODE_MODEL` environment variable no longer counts in Code.
* Added `builtinBrowserClientCertificateHosts`: the sites that get a client certificate in the built-in browser and preview panes. Behind a proxy that asks on every site, use `*`. Only machine-wide device management can set it. On Linux, or as a Windows policy's only key, add it after updating.
* Added `deploymentLogo`, which shows your organization's logo beside the organization announcement. Paste a PNG image as a base64 `data:` URI. Update all devices before you put it in a device profile.
* Added `enforceConsoleSignInOrgList` (device profile only): when on with `forceLoginOrgUUID` set, only listed organizations can use Claude Console sign-in, so add your Console organization's ID first. Off or unset, others still work with a log warning. The block announced earlier now needs this key.
* Added `remoteFileDownloads` (beta), which controls which files users can download from an SSH host or WSL in Code sessions. When it is unset, users can download documents, images and small text files. Read its help before you set it in an MDM profile: devices can lose settings or WSL sessions.
* Added `sensitivityLabels` to the configuration reference. On the built-in Microsoft 365 entry of `managedMcpServers`, it blocks OneDrive and SharePoint files and Outlook email that carry the Microsoft Purview labels you list. Update first: versions before 5.1231.0 block only files, or nothing.
* Added Mermaid diagrams for `mermaid` code blocks in replies and Markdown file previews in Chat, Cowork, and the Code tab.
* Added Web search and Web fetch under Connectors in the + menu and in Customize > Connectors. Each person can set either one to Always ask or Blocked, but can't loosen `builtinToolPolicy` or `disabledBuiltinTools`. On Bedrock, only Web fetch is listed.
* (breaking) Changed the built-in browser and preview panes to send a client certificate only to sites in `builtinBrowserClientCertificateHosts`. With `builtinBrowserEnabled` on, a site that requires one stops loading there until you list it. Gateway and connector connections are not affected.
* Changed `allowedWorkspaceFolders` on Windows SSH hosts: sessions and Claude's file tools now refuse a junction or folder link in an allowed folder that leads outside the list. To keep using it, add the folder it leads to.
* Changed `autoUpdaterEnforcementHours` and `installedUpdateEnforcementHours`: with no number set, the restart on macOS now waits while the keychain is locked, for up to 72 hours, so that a saved provider API key still opens afterwards. With a number set, a locked keychain doesn't delay it.
* Changed `claudeAiImport.automatic3pImport`: most Cowork and Chat sessions it copies from this version on now continue at the user's first message, with no "Continue this conversation?" prompt. Code sessions and sessions copied by earlier versions still ask.
* Changed a connector tool set to `blocked` through device management to take effect without a restart. At the app's next configuration check (every 10 minutes by default), open sessions refuse it. This covers connectors that the app itself connects to.
* Changed connectors on a Claude apps gateway: some people need to reconnect theirs once after this update. This can happen on a computer login that several people share, or on one that used another sign-in method before the gateway.
* Changed connectors that the app itself connects to: in Auto and bypass modes, a tool set to `ask` now shows the approval prompt whether the policy names the connector by name or by URL. In an unattended scheduled run, the tool does not run unless a person approves it.
* Changed the Code tab's model menu when `inferenceModels` is set: an `availableModels` list in a Claude Code settings file, managed or not, no longer greys out models, unless Claude Code's managed settings name a policy helper.
* Removed the in-app deprecation warning about `coworkTabEnabled`, `chatTabEnabled` and `chatAdvancedFileAnalysisEnabled`. Versions 4.16336.0 to 5.1231.2 can still show it from November 17, 2026. From 4.16336.0 on, the app stops reading these settings at 12:00 PM PT on December 17, 2026.
* Updated the help for `orgPluginSettings` and `managedMcpServers`: write a plugin server's name exactly as the plugin declares it, capitals included.
* Fixed `claudeAiImport.automatic3pImport` dropping Auto mode from scheduled tasks. From this version on, a copied task on Auto or Skip all approvals arrives on Auto. If the task was switched on, it runs in Auto. Cowork tasks need `autoModeEnabled` set to `true`. Code tasks need it unset or `true`.
* Fixed `claudeAiImport.automatic3pImport` leaving behind sessions imported from a file or folder, and projects and scheduled tasks brought from another computer with "Import as my own". Computers that already ran the copy get those projects and tasks at their next launch, with the tasks turned off.
* Fixed scheduled tasks copied by `claudeAiImport.automatic3pImport`: History now lists their earlier runs, and a Cowork task can open its own task folder when its prompt gives the full path. Tasks copied by earlier versions do not change.
* Fixed sessions stuck on "Authentication failed" after a slow sign-in refresh. Claude now asks you to try again in a moment and keeps your message.
* Fixed the Setup window showing Unified Claude on for a configuration that leaves only Code on. Until December 17, 2026, saving, exporting or importing such a configuration in Setup writes `desktopHome` as `off`.
