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
- [x] T2 (kind: build) S2 — the engram-plugin cell: cause in `## Engram plugin`, fix text for a clone with no tag;
  inline, test first (L6, L7)
- [x] T3 (kind: build) S3 — one call records both reviews; inline, test first (L9, L10)
- [x] T4 (kind: verify) Codex and the lenses on the code commits; `npm run check`; PR, ready notice, summary (L11)

## Engram plugin
Why the cell is `unknown`: the latest version of the plugin is the one the engram binary's tag ships, read with
`git show v<binary>:.claude-plugin/marketplace.json` from Claude Code's clone of the engram marketplace
(`readEngramPluginAtTag`, `bin/lib/latest.mjs`; decision D2 of `odd/tasks/engram-plugin-lag.md`). D2 rested on
"Claude Code fetches that clone with its tags". On 2026-10-27 23:13 (-05:00) Claude Code cloned it again, shallow and
with main alone: its `.git` holds `shallow`, `config` fetches `+refs/heads/main:refs/remotes/origin/main` only, and
`packed-refs` names `refs/remotes/origin/main` and no tag. The binary is 3.6.0, so `v3.6.0` is not there, the read
returns `null` and `computeUpToDate` says `unknown`. The reader does what D2 says; what changed is the clone. So this
is a real "cannot tell" offline, not a harness defect.

What changed (T2): the cell stays `unknown` (no network read, as D2 decided), and its fix, when the engram binary's
version is known, says what lets doctor tell: `git -C <clone> fetch --depth 1 origin tag v<binary>`, which writes one
tag into Claude Code's clone and nothing else. A test with real git proves it on a shallow clone of main with no tags:
null before the fetch, the tag's plugin version after. The old fix, `claude plugin marketplace update engram` then
`claude plugin update engram@engram`, would not help: Claude Code refreshes the clone the same shallow way. The fix
shows in `--json` only, since `unknown` is no gap (`rowGaps`). Not run here: the clone is his.
A network read at the tag (GitHub's raw file) would make the cell answer without that step; it is the choice D2 left
out, so it is the lead's to put on the roadmap or not.

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
- L6 (red, then green): with the tests first, `node --test --test-name-pattern=engram-plugin bin/lib/latest.test.mjs
  bin/lib/stack.test.mjs` failed 1 of 14 (the fix-text test); the real-git test passed already, since it proves the
  command, not doctor's code. After the change, `latest`, `stack` and `doctor` tests 236 of 236.
- L7 (evidence): on this machine the branch's `doctor --offline --json` gives `engram-plugin` `upToDate: unknown` with
  the fix `git -C C:\Users\Oficina\.claude\plugins\marketplaces\engram fetch --depth 1 origin tag v3.6.0`. Not run.
- L8 (open, out of scope): `README.md` names `js-harness doctor --gentle-ai-reviewed`, a flag doctor's `KNOWN` list no
  longer takes (`grep -rn gentle-ai-reviewed bin` finds nothing). Left for the lead.
- L9 (decision): one call records both, rather than refusing the pair: the lead's need was one call. Each review
  records or fails on its own, as alone; one that records nothing says why on stderr and the call exits 1, the other
  still recorded. `--json` prints `{ reviewed }` for one flag, as before, and `{ host: { reviewed }, stack: { reviewed } }`
  for both, so the output stays one JSON document.
- L10 (red, then green): the two tests first, `node --test --test-name-pattern=reviewed bin/doctor.test.mjs` failed 2
  of 9; after `recordReviews`, `bin/doctor.test.mjs` 95 of 95.
- L11 (reviews): Codex review of `65483fc..ec56696`, 1 part, recorded: correct (0.88), no finding; 118,679 input
  tokens. The Claude lenses risk, reliability, readability and resilience over the same range, recorded: 0 findings
  each (13,756, 13,754, 28,247 and 28,207 input tokens). The gentle-ai Stop hook offered the whole branch: only its
  read-only status ran (`action: start`), nothing was started, as `CLAUDE.md` says for a branch-wide candidate.
- L12 (the lead's request, 2026-10-30 after the ready notice): "One more commit on PR 702 before I land it, please:
  your L8, README.md naming `js-harness doctor --gentle-ai-reviewed`, a flag doctor no longer takes. Fix the line to
  what doctor takes now [...]. The network read for the engram cell is mine to put to him; leave it." Searched:
  `grep -rn gentle-ai-reviewed bin` and `gentle-ai-sync` in `bin/` find nothing; `git log -S gentle-ai-sync --
  bin/doctor.mjs` names `8b724f3d feat(doctor): drop the gentle-ai-sync row and --gentle-ai-reviewed`; SPEC.md:929
  says the row left at F8 S11. So the README paragraph describing that row went whole, and the `stack-update` one
  after it says "the tools of the stack", no longer "the other tools". Doctor's review flags now: `--host-reviewed`,
  `--stack-reviewed` (`KNOWN`, `bin/doctor.mjs`). Markdown only: no code for Codex or the lenses.
