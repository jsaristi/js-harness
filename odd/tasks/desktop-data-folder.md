# Claude Desktop's moved data folder

A fix assigned by the lead to JH 36, on branch `fix/desktop-data-folder`. Test runner: `node --test`.

## Goal
The readers of Claude Desktop's own folder (sessions, unseen, backup) find it where the app keeps it now.

## Why
After the restart of 2026-10-21, Claude Desktop moved its folder from `%APPDATA%\Claude` to
`%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc`. The old folder now holds only the marker
`.user-data-left.claude_pzs8sxrjxfjjc`, so `appRoot` and backup's `desktopDir` read a folder that is empty.

## Done when
- `npm run check` exits 0
- `node --test bin/lib/app-record.test.mjs bin/lib/backup.test.mjs` exits 0, with these tests:
  - the marker is followed;
  - a stale marker, an invalid marker name and several moved folders keep the old folder;
  - with no LOCALAPPDATA, the home's AppData Local is used.

## In scope / Out of scope
- In: `bin/lib/app-record.mjs`, `bin/lib/backup.mjs`, their tests, this document.
- Out: macOS and Linux, where no move is known.

## Constraints
- A machine where the app did not move reads the same folder as before.

## Ask me before
Nothing: the lead assigned the fix.

## Specs
- S1 "appRoot finds the new location (for example, read the marker in the old folder or look for the one Claude-Data\claude_* folder) and falls back to the old one" (the lead's brief).

## Tasks
- [x] T1 (kind: build) S1, inline: `windowsFolder` resolves the folder for `appRoot` and `desktopDir` (`c103e8fc`, `c8bc62b3`).

## Log
- L1 (2026-10-21, the lead's brief): "bin/lib/app-record.mjs:10 appRoot still returns %APPDATA%\Claude, so sessions.mjs:560, unseen.mjs:178/220, and backup's desktop sources ... read a folder that is now empty."
- L2 (`c103e8fc`): RED was the marker test of `appRoot` and of `desktopDir`; GREEN 331 tests of app-record, backup, sessions and unseen. On this machine both now return the `claude_pzs8sxrjxfjjc` folder.
- L3 (`c8bc62b3`): gentle-ai's findings, taken. A marker is followed only while its folder holds something. Tests now pin the marker-name guard and the fallback to AppData Local.
- gentle-ai on `c103e8fc` (`2c1a257a..c103e8fc`, risk and reliability, lineage review-81a05ac813d4f660): approved and acknowledged, two warnings and one suggestion, all taken in `c8bc62b3`.
- gentle-ai on `c8bc62b3` (`c103e8fc..c8bc62b3`): assessed medium, not due (under budget).
- Codex: `2c1a257..c8bc62b` correct (0.86), recorded.
