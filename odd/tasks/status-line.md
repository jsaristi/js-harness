# JH 113 · status line: the harness's state above the Code tab's message box

Locator: `odd/tasks/status-line.md` · Engram mirror: `odd/status-line/tasks` · Branch: `worktree-status-line`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
Decide, with evidence from the app itself, whether and how `sessionStatusLine` can show the session board's line
above the Code tab's message box on his machine, and leave the host review, the map and the review's draft true to it.

## Why
Question 131 opened this feature on the premise of the first host review (`docs/host-updates/claude-desktop-4.4212.0.md`,
row desktop 4.4212.0 #24): that Claude Desktop 4.4212.0's `sessionStatusLine` could carry the harness's state. That
premise was never checked against the app: the entry sits in the changelog's `**3P**` section, and the review read it
as a Code tab feature. Building a program and an administrator install for a key the app does not read here would
spend a session and a question on nothing.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/status-line.md` exits 0
- `node --test bin/lib/host-watch.test.mjs` exits 0, with the test "a 3P entry left to decide says its decision needs
  evidence that a claude.ai install reads it", red without its fix and green with it, both runs quoted in `## Log`
- `node bin/js-harness.mjs host-watch check docs/host-updates/claude-desktop-4.4212.0.md` exits 0
- `node bin/js-harness.mjs failures check` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- two blind readers attacked the design below, their findings and what was done with each in `## Log`
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code
- the lead holds one recorded question on whether the feature closes here, its number in `## Log`

## In scope / Out of scope
- In: this document; `bin/lib/host-watch.mjs` (`draftRow`, `renderBrief`) and its test; row #24 of
  `docs/host-updates/claude-desktop-4.4212.0.md`; row 14 of `docs/proposals/claude-app-native-sessions.md`;
  `docs/ROADMAP.md`; `docs/FAILURES.md`; a summary under `docs/sessions/`.
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai config, Program Files, any managed setting or registry policy
  (the brief forbids them); ccstatusline (removed on 2026-10-30 at his request); any install as administrator, which
  waits for his yes; writing a mod, which loads only on his yes (decision M1 of the proposal).

## Constraints
- Every host behaviour is shown from the app's docs or a probe; an unknown is written as unknown — because the brief
  asks it, and the review this corrects stated one without either.
- The probe reads the installed app and writes nothing outside the job's scratch folder — because Program Files and
  the managed configuration are out of bounds.
- Tests first for the draft's change — because AGENTS.md asks a behaviour change to arrive with the test that proves it.

## Ask me before
Installing anything as administrator, writing any policy key, switching the app to third-party inference, or loading a
mod: his. Whether the feature closes here or builds a program the app would not run today: his, asked through the lead
(`js-harness notify --to orchestrator --kind question`, in Spanish).

## Specs
1. His answer to question 131 (2026-10-31T01:34:51Z, read with `js-harness sessions --quote
   0f71b2c6-cbce-43ca-a031-276a4b2c381f 37796`): "Sí, ábrela". The question said: "Un sí abre una feature que diseña
   la línea, cómo se instala y cómo se deshace, y te vuelve a pedir el sí antes de instalar nada como administrador;
   no autoriza instalar ni tocar la configuración administrada ahora."
2. The brief (lead, 2026-10-31): "The design, which passes two blind readers before any code: what the line says (one
   line, from the board), the program it runs and its cost per refresh, where it is installed, the managed setting it
   needs, how `uninstall` records and undoes it exactly [...], and what it does on a machine without admin rights.
   Evidence for every host behaviour from the app's docs or a probe; an unknown is written as unknown."
3. The brief: "The program and its tests, tests first, buildable and testable without admin rights (a scratch home,
   no managed setting touched)."
4. The brief: "The install step that needs admin rights is NOT run: it goes to the lead as one recorded question
   [...] with the exact PowerShell commands it would run and their undo, each tried first in a scratch place where
   that is possible."
5. The brief: "Search first (codegraph, `js-harness rules`) for a status-line or statusline piece the harness already
   has (ccstatusline was removed on 2026-10-30 at his request; do not bring it back) and amend what exists."

## Tasks
- [x] T1 (kind: design) specs 2 and 5: the evidence, the search and the design below — commits: 6da7b04b, and the
  revision after the readers in this document's second commit
- [x] T2 (kind: build) the mistake's control: a 3P entry left to decide says what its decision must show, and the
  review brief's step 2 asks that evidence, tests first — commits: 6b37f498, 33246b02, and the rework after reader A
  (L4)
- [x] T3 (kind: docs) row #24 of the host review, row 14 of the map, the ROADMAP, the failure entry — commits: with
  this document's second commit
- [x] T4 (kind: verify) two blind readers of the design (L3); Codex and the lenses over T2's commits (L6)
- [x] T5 (kind: docs) specs 3 and 4 were deferred to question 134; he answered "Construir el programa igual" (L8)
- [x] T6 (kind: verify) pull request 726 (merged into main as 9f61429), its ready notice, question 134, the summary
- [ ] T7 (kind: build) spec 3, slice 2 on branch `feat/status-line-program` from main 7aac3e43: `bin/lib/status-line.mjs`
  (`statusLineOf(board)` pure, the line file written atomically under the harness home), `bin/status-line.mjs`
  (`js-harness status-line write` runs the board and writes the line; `program` prints the program's path),
  `bin/lib/status-line.ps1` (the program: reads the line file, prints it, marks it stale past 10 minutes, prints
  nothing when it is missing), their tests first, the program timed in a scratch home — commits: pending
- [ ] T8 (kind: verify) Codex, the lenses and an independent verifier over T7; spec 4's question to the lead with the
  exact PowerShell commands and their undo, each tried in a scratch place; pull request, ready, summary, closed — pending

## Next step
T7, tests first. Done: `bin/lib/status-line.mjs` and its test (red: module not found; green: 4 pass);
`bin/lib/status-line.ps1` and `bin/lib/status-line-program.test.mjs`, run through `powershell.exe` in a scratch
USERPROFILE, skipped off win32 (red: 2 fail, no file; green: 2 pass). The script is ASCII: Windows PowerShell 5.1 reads
a script without a BOM as ANSI, so the middle dot is `[char]0x00B7`. Next: `bin/status-line.mjs` and its registration
in `bin/js-harness.mjs`. Decided (L8): the writer is `js-harness status-line write`, run by a per-user scheduled task every 5
minutes that is part of the deferred install (nothing runs today: the app does not read the key); the board takes about
24 s, so the program never runs it. The line, Spanish, from the board: open questions (`questions.open`), sessions
`working` and `waiting` (`sessions[].state`), open pull requests (`pullRequests.items`), the gate (`gateLock.holder`),
red when a question waits. `bin/sessions.mjs` and `bin/lib/sessions.mjs` are at their size ceilings, so nothing is added
there. The package ships `bin/` whole (`package.json` files), so the `.ps1` ships too.

## Design

### What the harness already has (spec 5)

Searched: `Grep "statusline|status line|sessionStatusLine"` over `docs`, `bin` and `odd`, and codegraph for a one-line
board output. The harness has no status line of its own: `bin/remote.test.mjs` names a `statusLine` helper of the login
launcher, unrelated, and the rest are records of ccstatusline, removed. The board has no one-line output either
(`renderBoard`, `bin/lib/sessions.mjs:3400`, prints sections). The nearest existing route is a mod: the proposal's
section 5 lists "a band above the prompt, a status-line entry" (`docs/proposals/claude-app-native-sessions.md`, Mods),
and its pilot waits for his decision M1.

### What the app does with `sessionStatusLine` (evidence)

1. **It is documented as a key of Claude Desktop on third-party inference.** The changelog lists it under the `**3P**`
   section of v4.4212.0 (`docs/host-updates/sources/claude-desktop-4.4212.0.desktop.md:38` heads the section, `:41`
   holds the entry). Its documentation lives only under the 3P pages:
   https://claude.com/docs/third-party/claude-desktop/status-line.md ("Show a status line above the message box in
   Claude Desktop on 3P") and https://claude.com/docs/third-party/claude-desktop/configuration.md, whose header reads
   "Every managed-configuration key Claude Desktop on 3P supports" (`### sessionStatusLine`, "Since 4.4212.0"). 3P is a
   deployment mode that routes inference through a provider the organization configures (Bedrock, Vertex, Foundry, a
   gateway or the Anthropic API), with a bundled web app and conversations kept on the device
   (https://claude.com/docs/third-party/claude-desktop/overview.md, the comparison table); its users have only a device
   identity unless an Enterprise organization manages it from the claude.ai admin console.
2. **The installed app reads it only in its 3P class.** A read-only probe of the installed bundle
   (`C:\Program Files\WindowsApps\Claude_4.4212.0.0_x64__pzs8sxrjxfjjc\app\resources\app.asar`, `package.json`
   version `4.4212.0`, read in place by a script in the job's scratch folder that parses the archive's header; nothing
   extracted or written there). Offsets are within `.vite/build/index.chunk-2SHPxESV.js` unless named:
   - the status line's reader starts `read:async e=>{if(!G().showsOrganizationStatusLine())return M9;...` (6373402);
   - two classes define that method: `Bzn`, whose constructor sets `this.type="3p"` (2929608), returns
     `showsOrganizationStatusLine(){return!0}` (2949362); `iBn`, `constructor(e){this.deps=e,this.type="1p"` (2998100),
     returns `showsOrganizationStatusLine(){return!1}` (3001499);
   - the selector `oBn` (3006905) builds `iBn` unless `dd(config)` holds, and `dd` holds only when a key that
     activates third-party mode is set (`inferenceProvider`, `bootstrapUrl`) and the user has not chosen the claude.ai
     mode (reader A, L3);
   - no other path reaches the program: the runner (`.vite/build/index.chunk-8Pf3d6YK.js`) exports only
     `statusLineCommand`, which only the gated reader starts (reader A, L3);
   - the key's schema entry says `support:{enabled:{scopes:["3p"],availableInVersion:"@next"}}` (737062), where 36
     other entries carry a `"1p"` scope, and its warnings are tagged `[custom-3p]` (`index.chunk-8Pf3d6YK.js`, 867).
3. **His app runs in the claude.ai class.** Every launch in `%LOCALAPPDATA%\Claude\Logs\main*.log` logs
   `[managedConfig] configuration at launch { type: 'none', remote: false, managedKeys: [] }`, and none logs the
   `3P mode active` line `oBn` writes when it builds `Bzn` (reader A, L3). No policy key exists:
   `reg query 'HKLM\SOFTWARE\Policies\Claude'` and `reg query 'HKCU\SOFTWARE\Policies\Claude'` both answer that the
   key was not found. There is no `%LOCALAPPDATA%\Claude-3p` folder. He signs in with claude.ai on the Max 20x plan.
4. **Unknown, and why it does not matter here:** `availableInVersion:"@next"` is read only by an OIDC helper (`uEe`
   from `TMe`, reader A, L3), so it is no general gate; whether the key works in 3P mode on 4.4212.0 was not run.
   Running the app in 3P mode was not probed: it needs a provider, and the bundle's mode chooser (`deploymentMode`,
   `setDeploymentMode`) would switch his app away from claude.ai for that launch.

### What follows

- **On his machine the status line never shows.** With the claude.ai class, `showsOrganizationStatusLine()` is false
  and the reader returns before it reads the key, so a program under Program Files and a policy key would sit there
  doing nothing. Seeing it would take running the app in 3P mode, with inference through a provider or an Anthropic API
  key outside his plan. Recommendation: not worth it for a status line; that trade is his.
- **The design asked for, item by item**, recorded for the day the gate opens to claude.ai installs. That day may come
  with no changelog entry, as a silent change of the schema's scope, so a later host review would have to probe the
  bundle again (`showsOrganizationStatusLine`):
  - *What the line says*: one line, at most 200 characters, the first non-empty line of the output, over 64 KiB the
    program is stopped (status-line doc, "Output"; configuration reference, "Limits"). From the board, in the board's
    order: the open questions to him, the sessions working and waiting, the pull requests ready, and whether the gate
    is held, as `2 preguntas · 3 trabajando · 1 esperando · PR #724 lista · gate libre`; red (ANSI 31) when a question
    waits for him. Proposed, not built.
  - *The program and its cost per refresh*: started with no arguments, as the signed-in user, in `System32`, with a
    `PATH` of only System32, Windows and Windows PowerShell; a `.ps1` runs in Windows PowerShell 5.1; 10 seconds
    including PowerShell's start; at most 10 runs in 10 s and 4 sessions at once (the bundle's `eeo=10`, `teo=1e4`,
    `$9a=4`, reader A, L3). It runs when a session opens, a turn ends, the model changes or the app regains focus, with
    no timer. Measured here, through Windows PowerShell 5.1 (L5): an empty PowerShell start 1,275 ms, node's start
    574 ms, `js-harness sessions --json` 24,135 ms. The board is more than twice the limit, so the program cannot run
    it: it would print a line a separate job writes (the docs' own sample reads a file "your own scheduled job keeps up
    to date"), and cost about 1.3 s of PowerShell a refresh.
  - *Where it is installed and the setting it needs*: the program under `Program Files` or `Program Files (x86)` on the
    Windows drive, which needs administrator rights. In 3P the key itself can be set in a managed source (`REG_SZ` JSON
    under `HKLM\SOFTWARE\Policies\Claude` or `HKCU\SOFTWARE\Policies\Claude`) or in the per-user local configuration
    file, `%LOCALAPPDATA%\Claude-3p\configLibrary\` (configuration reference: "a key can be set in an MDM profile or
    the local configuration file"; configuration-format doc, "Where Claude Desktop reads configuration"). That
    `HKCU\SOFTWARE\Policies` needs administrator rights is assumed (Windows' default ACL), not checked.
  - *A risk the docs name*: a managed source that sets any key other than the app-behavior keys makes the managed
    configuration take effect (configuration-format doc, "Which configuration source applies on a device"). A static
    read says a lone `sessionStatusLine` does not switch the app to 3P, since only keys marked
    `activatesThirdPartyMode` do (reader A, L3); untested.
  - *Undo*: deferred with the install. It would have to remove exactly what the install wrote: the program's folder
    under Program Files, and the policy value or the local configuration entry, run as administrator where it wrote as
    administrator. `uninstall` records and undoes per-user files; whether it can carry an elevated step was not
    checked, since nothing is installed.
  - *Without admin rights*: no program can be placed where the app runs it, by the host's own rule.

### What this means for specs 3 and 4

Spec 3 (the program) and spec 4 (the administrator install question) assume a key the app reads. On a claude.ai
install it does not, so a program could be tested in a scratch home but never seen, and an install would ask him for
administrator rights to change nothing. They are deferred pending one question through the lead (T6), which says that
the brief's Done-when is not met without his word: close here, or build the program for a future host. The line above
the message box he wanted is closer through a mod's `AbovePrompt` band, per user and with no administrator rights: a
user-scope mod's `ui.render` hooks "draw for the `desktop` surface" (`plugin-authoring` skill, `reference.md:130`), not
exercised; that is the proposal's mod pilot, which asks its own decision (M1), and the question names it.

### The mistake behind the premise

`classify` once drafted #24 outside ("outside the Code tab: Cowork", from the word); commit deede289 added `CODE_TAB`
so an entry naming the Code tab is left `?` for the session, and the session then decided adapt without checking
which deployment reads the key. The draft's label was not the cause, and the 3P section also repeats features a
claude.ai install has (#26 repeats #1; #30 changes Code sessions), so drafting the whole section outside would hide
those. The control is where the decision is made: a 3P entry left `?` says in its Reason that it is adopted or adapted
only with evidence that a claude.ai install reads it, and step 2 of the review brief says the same.

## Log
- L1 — his request, question 131 answered "Sí, ábrela" (spec 1).
- L2 — 2026-10-31, evidence: the changelog section, the 3P docs and the bundle probe (Design). Bad news first: the key
  is 3P-only on the installed 4.4212.0, so the feature as asked cannot show anything on his machine. PowerShell cannot
  be launched from this session's shell (the worktree guard refuses it); it runs through a node runner in the job's
  scratch folder (`spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ...])`), which
  printed the package's install location and Windows PowerShell 5.1.19041.7802.
- L3 — two blind readers (general-purpose agents, read-only; scripts only under the job's scratch folder).
  Reader A confirmed the central claim on every source and added the stronger evidence now in Design items 2 to 4 (the
  `type="3p"`/`"1p"` constructors, the selector, the launch log line, no ungated path). Its findings and what was done:
  item 3's indirect evidence (tool-list line, folders) replaced by the launch log; the classes named by their `type`;
  T2's rule "the 3P section is outside" too broad, since the section repeats claude.ai features (#26, #30): reworked
  (L4); the 3P trade told as his choice with the mode chooser; "no claude.ai account" narrowed; `@next` and the lone
  policy risk narrowed; the 64 KiB cap and the run throttle added; the `uninstall` claim marked not checked.
  Reader B confirmed the probe and the soundness of not building a program for a key the app does not read, and
  found: the mod route missing from the question, and no search recorded (both added: Design, "What the harness
  already has", and the question); T2 alone does not stop the mistake (the brief's step 2 now asks the evidence,
  33246b02); the 3P check's place and the old test name (reworked, and the test renamed to "the Cowork section"); the
  key settable per user in 3P, and the HKCU ACL unsupported (added; the ACL marked assumed); cost per refresh
  measurable now (measured, L5); the line's content not designed (proposed); "They are not built" against T5
  (now "deferred pending the answer", with the Done-when gap said in the question); a value judgement written as a
  finding (now a recommendation); undo not exact (listed, deferred); Program Files (x86), the admin-console sign-in,
  a silent scope change and `main1` to `main4.log` (added; reader A read every `main*.log`).
- L4 — T2 reworked after reader A. Commit 6b37f498 drafted every 3P entry outside; that would draft #30 (Code sessions
  and `launch.json`, a 3P entry a claude.ai install likely has) as ignore. The rule now keeps `classify` as on main and
  adds the evidence check to the Reason of a 3P `?` row. Red, with the Reason's check removed:
  `node --test --test-name-pattern="a 3P entry left to decide" bin/lib/host-watch.test.mjs` → exit 1, "The input did not
  match the regular expression /3P section: adopt or adapt only with evidence that a claude\.ai install reads it/";
  green with it: `node --test bin/lib/host-watch.test.mjs` → exit 0, 25 pass. The brief's step-2 line was red first:
  the brief test failed (exit 1, 0 pass, 1 fail) before the line, and passed after it.
- L5 — cost per refresh, measured with `Measure-Command` in Windows PowerShell 5.1 through the node runner: empty
  `powershell.exe -NoProfile` 1,275 ms; `node -e 0` 574 ms; `js-harness sessions --json` from `D:\js-harness`
  24,135 ms. One run each: an estimate of the order, not a distribution.
- L6 — reviews of 1f19c04..ceffbc0 (code commits 6b37f498, 33246b02, 15fd8749). Codex (`js-harness codex-review --base
  1f19c04e`, gpt-6.1-sol at medium, 41 changed lines in 2 files, 68,616 input tokens): "the patch is correct
  (confidence 0.96) [...] no actionable defects were found". The Claude lenses (`js-harness lens-review --base 1f19c04e
  --lenses reliability,readability`): reliability 0 findings (14,142 input tokens), readability 0 findings (6,707).
  Both recorded under `.git/js-harness/`. gentle-ai: the Stop hook offered the whole branch (base 1f19c04e, every path);
  its read-only `review status` was run and nothing started, as `CLAUDE.md` says for a branch candidate: not reviewed
  by gentle-ai. No independent verifier: no Task Size high-risk item is touched (no installer was written; the
  administrator install was not built).
- L8 — 2026-10-31, his answer to question 134 (`js-harness sessions --quote 0f71b2c6-cbce-43ca-a031-276a4b2c381f
  38878`, 02:58:07Z): "Construir el programa igual". The lead's brief: build the program and its tests in a scratch
  home, reading a precomputed board file, saying who writes it and how often; nothing under Program Files, no managed
  setting; the admin install a recorded question with exact PowerShell commands and their undo; Codex, the lenses and
  an independent verifier (installer, high risk item 5).
- L7 — pull request 726, ready notice at 2026-10-31T02:11:25Z; question 134 to the lead (close here, or build the
  program for a future host) at 02:09:17Z; summary `docs/sessions/2026-10-31-jh-113-status-line-the-harness-s-state-above-the-code-tab-s.md`.
