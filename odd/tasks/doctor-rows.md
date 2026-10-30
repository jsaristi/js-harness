# Doctor: three rows it reports wrong

Locator: `odd/tasks/doctor-rows.md` · Engram mirror: `odd/doctor-rows/tasks` · Branch: `fix-doctor-rows`
Delivery: one pull request · Test runner: `node --test`

## Goal
Doctor reads `claude-account` from the desktop app's moved folder, explains or fixes the `engram-plugin` row's
`unknown` up-to-date cell, and records both reviews when `--host-reviewed --stack-reviewed` come in one call.

## Why
Since 2026-10-21 the desktop app keeps its folder at `%LOCALAPPDATA%\Claude-Data\claude_<id>` and leaves a marker in
`%APPDATA%\Claude`, so `claudeAccountState` (`bin/lib/stack.mjs`) finds no `config.json` and says `unknown` on this
machine. The engram plugin's up-to-date cell says `unknown` with plugin 0.1.19 installed and enabled. And the two
review flags in one call record only the host review, silently: the lead had to run them one at a time.

## Done when
- `node --test bin/lib/stack.test.mjs bin/doctor.test.mjs bin/lib/latest.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/doctor-rows.md` exits 0
- `npm run check` exits 0
- each fix's test was red before it and green after, named in `## Log`
- the branch's `node bin/js-harness.mjs doctor --offline --json` on this machine reads `claude-account` `ok`

## In scope / Out of scope
- In: `bin/lib/stack.mjs`, `bin/doctor.mjs`, `bin/lib/latest.mjs` and their tests; doctor's help and docs where they
  name these rows or flags; this document; the session's summary under `docs/sessions/`.
- Out: writing to `~/.claude`, `~/.codex`, gentle-ai's config or credentials (read only); `claude plugin update` or
  any marketplace write; anything that opens a browser.

## Constraints
- A fixture home, never his real files, and no account identifier printed or stored — because they are his.
- The account check reads paths under the home it is given, never the environment — because a fixture home must be
  all it reads (the check's own contract).

## Ask me before
- Nothing of his is touched; any command written for him is his to run.

## Specs
- S1 (the lead's brief `briefs/2026-10-30T14-31-10-145Z-c2c640e2.md`, item 1): "claude-account reads `unknown` on this
  machine. [...] `desktopDir` (bin/lib/backup.mjs:128) and `windowsFolder` (bin/lib/app-record.mjs) already resolve
  the move: use them, so the row reads ok on the moved layout. A fixture home, never his real files; never print an
  account id."
- S2 (same, item 2): "engram-plugin's up-to-date cell reads `unknown` (plugin 0.1.19 installed and enabled). Find why
  from the code that judges it and from what it reads; if it is a harness defect, fix it test first; if it is a real
  "cannot tell" (for example no marketplace cache), say so in the document and make the cell's fix text say what to
  run. Read-only on ~/.claude: no `claude plugin update`, no marketplace write."
- S3 (same, item 3): "`js-harness doctor --host-reviewed --stack-reviewed` in one call records only one of the two
  reviews [...]. Make one call record both, or refuse the pair with a message that says to run them one at a time;
  test first."

## Tasks
- [x] T1 (kind: build) S1 — `claudeAccountState` reads the app config from `desktopDir`; inline, test first (L3, L4)
- [ ] T2 (kind: build) S2 — the engram-plugin cell: cause in `## Engram plugin`, fix text for a clone with no tag;
  inline, test first
- [ ] T3 (kind: build) S3 — one call records both reviews; inline, test first
- [ ] T4 (kind: verify) Codex and the lenses on the code commits; `npm run check`; PR, ready notice, summary

## Engram plugin
Why the cell is `unknown`: the latest version of the plugin is the one the engram binary's tag ships, read with
`git show v<binary>:.claude-plugin/marketplace.json` from Claude Code's clone of the engram marketplace
(`readEngramPluginAtTag`, `bin/lib/latest.mjs`; decision D2 of `odd/tasks/engram-plugin-lag.md`). D2 rested on
"Claude Code fetches that clone with its tags". On 2026-10-27 23:13 (-05:00) Claude Code cloned it again, shallow and
with main alone: its `.git` holds `shallow`, `config` fetches `+refs/heads/main:refs/remotes/origin/main` only, and
`packed-refs` names `refs/remotes/origin/main` and no tag. The binary is 3.6.0, so `v3.6.0` is not there, the read
returns `null` and `computeUpToDate` says `unknown`. The reader does what D2 says; what changed is the clone. So this
is a real "cannot tell" offline, not a harness defect.

## Log
- L1 (the lead's brief, as written): "JH 99 · doctor: three defects it reports wrong" — items 1 to 3 quoted in S1 to S3.
- L2 (evidence, read only): `engram version` → `engram 3.6.0`; `~/.claude/plugins/marketplaces/engram/.git` listed
  2026-10-27 23:13, with `shallow`, `claude-code-sparse-paths.json` (`{"sparsePaths":[]}`), one reflog line `clone:
  from https://github.com/Gentleman-Programming/engram.git`, and the refs written in `## Engram plugin`.
- L3 (red, then green): the moved-layout test first, `node --test --test-name-pattern=claude-account
  bin/lib/stack.test.mjs` failed 1 of 8 (`actual: 'unknown', expected: 'ok'`); the env test passed already, kept
  as a guard that the check reads under the home and never `APPDATA`. After the fix, `bin/lib/stack.test.mjs` 112 of
  112.
- L4 (evidence): on this machine, the branch's `node bin/js-harness.mjs doctor --offline --json` gives
  `claude-account` `claude: ok`; the installed `js-harness doctor` gives `unknown`. Only the state was printed.
- L5 (decision): `desktopDir` is called with an empty env, so AppData is placed under the given home: on this machine
  `APPDATA` is `<home>AppDataRoaming`, and reading the env would let a fixture home read the real app config.
