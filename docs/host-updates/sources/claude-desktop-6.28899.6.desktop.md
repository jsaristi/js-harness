**v6.28899.6**

2026-11-20

Bundled Claude Code version: 2.1.330.

For administrators of SSH hosts: SSH helper version e7672c0ae0f00f48e6a334d0647132f6490a5f6c. SSH host launcher contracts: 1 (sessions), 2 (plugin commands).

**General**

* No user-facing changes.

**Code**

* Added message styles and sound to plugin themes. Sound plays only after you press the speaker in the session's title bar.
* Changed the Claude Code version that SSH hosts need to 2.1.330. If you install Claude Code on your SSH hosts yourself, or serve it from your own mirror, add 2.1.330 there before computers take this update. Until you do, updated computers can't start SSH sessions there and may not reach running ones.

**Cowork**

* Changed attachments on Windows: a file encrypted with EFS is no longer attached from a local drive other than the app's data drive, or from some sync folders. The app says it couldn't attach the file. The message or scheduled task goes ahead without it, and Claude is told.
* Changed connected folders on macOS and Linux to stay closed while the app can't open a folder that it has to check. Meanwhile, where file tools run on your computer, as in third-party deployments, tasks with a connected folder don't start. The error names the folder to fix.

**3P**

* Added `/resume` in a new SSH session on Amazon Bedrock, to continue a Bedrock-only Claude Code terminal session on the host. The session is copied to this computer.
* Changed new recurring tasks in a Code session, such as `/loop`, to run for up to 30 days instead of 7. On an SSH host they can keep using your provider with the app closed. Setting `scheduledTasksEnabled` to `false` turns off all scheduled tasks from each session's next start.
* Fixed the Cowork workspace failing to start, and organization plugins not loading, on Windows versions that keep Claude's data inside the app package, such as Windows 10 and Windows Server 2022.
* Fixed imported Code sessions being deleted without notice soon after the import when their last activity was older than `codeSessionRetentionDays`. The period now counts from the import, or from later activity.
