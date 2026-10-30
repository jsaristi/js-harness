**v4.4212.0**

2026-10-29

Bundled Claude Code version: 2.1.309.

**General**

* Added a per-site "Local network access" setting to the built-in browser's menu, with a question the first time a site tries, for sign-in pages that check a desktop agent such as Okta Verify and for sites that talk to devices on your network.
* Added Cowork's notes to the import from Claude (third-party): where device management turned it on and no HIPAA restriction applies, Settings > Import shows the notes Cowork kept there and can add them to your Claude memory, where memory import is available.
* Added Send to options for partner apps, such as Canva, in the Share menu when a Claude Doc is open on its own page.
* Changed `disableBrowserExternalNavigation` and `browserExternalPageTools` in a device's Claude Code managed settings (`managed-settings.json`, or its MDM or HKLM policy) to apply even when the claude.ai admin console also has managed settings.
* Removed opening the application menu by pressing Alt on its own on GNOME, so that switching keyboard layouts with Alt+Shift no longer opens it. F10 still opens the menu.
* Fixed a reply with two or more cards, such as weather or message drafts, showing only one of them, or showing a card with the wrong pictures or places.
* Fixed background computer use treating a window that had been closed as still open on another desktop, which made Claude click into nothing or ask for full-screen control.
* Fixed the message box sometimes opening without its saved draft, and not keeping what you typed as a draft, when two windows loaded at the same time, for example right after signing in.
* Fixed the side panel opening on its own over the conversation in a narrow window when a reply created an artifact or shared a file, which hid the reply and the message box, including from screen readers.

**Code**

* Changed `remoteControlAtStartup: false` in a device's Claude Code managed settings (`managed-settings.json`, or its MDM or HKLM policy) to apply even when the claude.ai admin console also has managed settings.
* Changed SSH connections through a proxy command or jump host on Mac and Linux, where your SSH config sets no ConnectTimeout, to get a longer second try so a slow route has time to come up; the sign-in dialog for a jump host (ProxyJump) no longer closes after 30 seconds.
* Fixed a message to a new or just-cleared SSH session being refused while the host was unreachable: it now waits and is sent when the host is back, and messages waiting for an unreachable host no longer send by themselves before your organization's settings have loaded.
* Fixed Rewind on the first message shown in a very large session clearing the whole conversation.
* Fixed sessions on an SSH machine losing their connection when an `sshHostCommands` command makes a new one; "Replace …'s host" is now "Create another …", available a minute after the last machine is made.
* Fixed SSH set-up failing at once when Anthropic's download server is busy, and sessions showing only "Reconnecting" when Claude Code couldn't be set up on the host: the app now tries again, names the cause, and offers Retry now.
* Fixed the first message after an SSH session starts or reconnects sometimes silently running without your MCP servers.

**Cowork**

* Fixed a generic error banner sometimes appearing beside the Paused card after safeguards flagged a message.
* Fixed a stopped tool call showing a message written for Claude as a failure.
* Fixed Cmd+Shift+S and Cmd+Shift+B answering on their QWERTY keys under Dvorak and other remapped keyboard layouts.
* Fixed dismissed notices under a reply, such as crisis support or election information, coming back after leaving a chat and returning to it.
* Fixed furigana (readings above Japanese text) in replies showing as raw HTML tags, and Find counting the hidden tag text and missing words under two readings.
* Fixed Return in a background Mac app's text field adding a line break to the field instead of submitting it.

**3P**

* Added `projectsEnabled`. Set it to `false` to hide projects in Chat and Cowork. Projects are not deleted, and they come back when the setting is turned on again.
* Added `sessionStatusLine` to show one line of text above the message box in Cowork, Chat and Code, printed by a program that the app runs. On macOS and Linux the program and every folder above it must be writable only by root, and on Windows it must be in Program Files on the system drive.
* Added `skillScanningEnabled` (beta): run a security scan on each skill a user creates or uploads before it can be used. Skills that fail the security scan are blocked.
* Added a per-site "Local network access" setting to the built-in browser (`builtinBrowserEnabled`). When an https site first tries to reach an app on this computer or a device on your network, the user is asked whether to allow it. `builtinBrowserBlockedDomains` can block devices, not local apps.
* Added Escape to close a side pane of a chat or Cowork task, such as a file or connector pane, when focus is in the pane, and return focus to what opened it. While Claude is replying, Escape in a pane closes the pane, and a second Escape stops the reply.
* (breaking) Changed an unset `desktopHome` to read as `standard` at launches after 12:00 PM PT on November 10, 2026: Unified Claude opens with Cowork on, even where `coworkTabEnabled` is `false`.
* Changed `sshClientPath` (beta) on Windows to accept a path starting with `%LOCALAPPDATA%\` when machine-wide policy (HKLM) sets it, with `sshTransport: system-openssh`, and Claude does not run as administrator. Whoever replaces a program there can see SSH passwords and get around `sshHostAllowlist`.
* Changed Code sessions to ask for approval before starting a dev server from `launch.json` in Auto and Bypass permissions modes, where Claude Code's sandbox (the default on macOS, Linux and WSL) or deny or ask rules in managed settings limit shell commands.
* Changed Cowork to show "Billing issue", with no Try again button, in place of "Something went wrong" when your inference provider or gateway refuses a request with HTTP 402.
* Changed provider API keys saved in Setup to be encrypted where the computer has secure storage. Keys saved earlier are encrypted at the next launch. Versions below 4.29 cannot read them, so after a rollback below 4.29, or a move of the app's data to another computer or account, enter the key again.
* Fixed Settings > Usage and the token limit set with `inferenceMaxTokensPerWindow` leaving out requests that the app makes itself, such as naming a session. These now count toward the limit, and once it is reached the app stops making them, except its connection check.
* Fixed the connection banner's Details and "Copy report for IT" not mentioning managed settings that were not fully applied. Each one is now listed as a warning, and when the connection works, apps configured from a local file also show the "Configuration may need attention" banner.
