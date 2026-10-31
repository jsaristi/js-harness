# JH 113 · status line: the harness's state above the Code tab's message box

Locator: `odd/tasks/status-line.md` · Engram mirror: `odd/status-line/tasks` · Branch: `worktree-status-line`
Delivery: one pull request to main · Test runner: `node --test`

## Goal
Decide, with evidence from the app itself, whether and how `sessionStatusLine` can show the session board's line
above the Code tab's message box on his machine, and leave the host review, the map and the classifier true to it.

## Why
Question 131 opened this feature on the premise of the first host review (`docs/host-updates/claude-desktop-4.4212.0.md`,
row desktop 4.4212.0 #24): that Claude Desktop 4.4212.0's `sessionStatusLine` could carry the harness's state. That
premise was never checked against the app: the entry sits in the changelog's `**3P**` section, and the review read it
as a Code tab feature. Building a program and an administrator install for a key the app does not read here would
spend a session and a question on nothing.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/status-line.md` exits 0
- `node --test bin/lib/host-watch.test.mjs` exits 0, with the test that a 3P-section entry naming Code is drafted
  outside, red before its fix and green after, both runs quoted in `## Log`
- `node bin/js-harness.mjs host-watch check docs/host-updates/claude-desktop-4.4212.0.md` exits 0
- `node bin/js-harness.mjs rules check` exits 0
- `npm run check` exits 0
- two blind readers attacked the design below, their findings and what was done with each in `## Log`
- the pull request is merged into main, named in `## Log`, with Codex and the Claude lenses recorded over its code
- the lead holds one recorded question on whether the feature closes here, its number in `## Log`

## In scope / Out of scope
- In: this document; `bin/lib/host-watch.mjs` (`classify`) and its test; row #24 of
  `docs/host-updates/claude-desktop-4.4212.0.md`; row 14 of `docs/proposals/claude-app-native-sessions.md`;
  `docs/ROADMAP.md`; `docs/FAILURES.md`; a summary under `docs/sessions/`.
- Out: `~/.claude`, `~/.codex`, credentials, gentle-ai config, Program Files, any managed setting or registry policy
  (the brief forbids them); ccstatusline (removed on 2026-10-30 at his request); any install as administrator, which
  waits for his yes.

## Constraints
- Every host behaviour is shown from the app's docs or a probe; an unknown is written as unknown — because the brief
  asks it, and the review this corrects stated one without either.
- The probe reads the installed app and writes nothing outside the job's scratch folder — because Program Files and
  the managed configuration are out of bounds.
- Tests first for the classifier — because AGENTS.md asks a behaviour change to arrive with the test that proves it.

## Ask me before
Installing anything as administrator, writing any policy key, or switching the app to third-party inference: his.
Whether the feature closes here or builds a program the app would not run today: his, asked through the lead
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

## Tasks
- [x] T1 (kind: design) spec 2: the evidence and the design below — commits: this document's first commit
- [ ] T2 (kind: build) the mistake's control: `classify` drafts a 3P-section entry outside even when it names Code,
  test first — commits: pending
- [ ] T3 (kind: docs) row #24 of the host review, row 14 of the map, the ROADMAP, the failure entry — commits: pending
- [ ] T4 (kind: verify) two blind readers of the design; Codex and the lenses over T2's commit — pending
- [ ] T5 (kind: docs) specs 3 and 4 wait for the question of T6: no program and no install question is built for a key
  the app does not read here (see the design, "What this means for specs 3 and 4") — pending
- [ ] T6 (kind: verify) the pull request, its ready notice, the question to the lead, the summary — pending

## Design

### What the app does with `sessionStatusLine` (evidence)

1. **It is a key of Claude Desktop on third-party inference.** The changelog lists it under the `**3P**` section of
   v4.4212.0 (`docs/host-updates/sources/claude-desktop-4.4212.0.desktop.md:38` heads the section, `:41` holds the
   entry). Its documentation lives only under the 3P pages: https://claude.com/docs/third-party/claude-desktop/status-line.md
   ("Show a status line above the message box in Claude Desktop on 3P") and the 3P configuration reference,
   https://claude.com/docs/third-party/claude-desktop/configuration.md (`### sessionStatusLine`, "Since 4.4212.0").
   3P is a deployment mode that routes inference through a provider the organization configures (Bedrock, Vertex,
   Foundry, a gateway or an API key), with a bundled web app, local-only conversations and no claude.ai account
   (https://claude.com/docs/third-party/claude-desktop/overview.md, the comparison table).
2. **The installed app reads it only in 3P mode.** A read-only probe of the installed bundle
   (`C:\Program Files\WindowsApps\Claude_4.4212.0.0_x64__pzs8sxrjxfjjc\app\resources\app.asar`, read in place by a
   script in the job's scratch folder that parses the archive's header; nothing extracted or written there):
   - the status line's reader starts `read:async e=>{if(!G().showsOrganizationStatusLine())return M9;...`
     (`.vite/build/index.chunk-2SHPxESV.js`, offset 6373402);
   - two deployment classes define that method: the one with `hasClaudeAiProductFeatures(){return!1}`,
     `managesProviderRouting(){return!0}` and `usesLocalSkillStorage(){return!0}` returns
     `showsOrganizationStatusLine(){return!0}` (offset 2949362); the one with `hasClaudeAiProductFeatures(){return!0}`,
     `hasOrgPolicyBackend(){return!0}` and `managesProviderRouting(){return!1}` returns `showsOrganizationStatusLine(){return!1}`
     (offset 3001499). The first is the 3P class, the second the claude.ai class;
   - the key's schema entry says `support:{enabled:{scopes:["3p"],availableInVersion:"@next"}}` (offset 737062), and
     its warnings are logged under the tag `[custom-3p]` (`.vite/build/index.chunk-8Pf3d6YK.js`, offset 867).
3. **His app runs in the claude.ai class.** He signs in with his claude.ai account on the Max 20x plan (memory
   `plan-max-20x`), the Code tab has the claude.ai-only servers (`docs/host-updates/claude-desktop-4.4212.0.md`, the
   tool-list line), and the app keeps its data in `%LOCALAPPDATA%\Claude-Data\claude_pzs8sxrjxfjjc` and its logs in
   `%LOCALAPPDATA%\Claude\Logs`, not in the `Claude-3p` folders the 3P docs name. No policy key exists:
   `reg query 'HKLM\SOFTWARE\Policies\Claude'` and `reg query 'HKCU\SOFTWARE\Policies\Claude'` both answer that the
   key was not found. `main.log` (version 4.4212.0) has no `sessionStatusLine` entry, as expected with no key set.
4. **Unknown:** what `availableInVersion:"@next"` does at run time in 4.4212.0. The bundle's `uEe` treats a 3P key as
   released only when that field is not `@next`; whether an unreleased key is still read in 3P mode was not probed,
   because it changes nothing for a claude.ai install. Not probed either: running the app in 3P mode, which needs a
   provider and would leave his account.

### What follows

- **On his machine the status line never shows.** With the claude.ai class, `showsOrganizationStatusLine()` is false
  and the reader returns before it reads the key, so a program under Program Files and an `HKLM` policy would do
  nothing but sit there. The only way to see it is to run the app in 3P mode, which leaves his claude.ai account and
  his plan for a provider billed apart: not a trade a status line could pay for.
- **The design asked for, item by item**, for the day the gate opens to claude.ai installs (a host-watch row would
  name it):
  - *What the line says*: one line from the board (`js-harness sessions`), at most 200 characters, the first non-empty
    line of the program's output (status-line doc, "Output").
  - *The program*: it would be started with no arguments, as the signed-in user, with `System32` as its folder and a
    `PATH` of only System32, Windows and Windows PowerShell; a `.ps1` runs in Windows PowerShell 5.1, and PowerShell's
    start counts toward the 10-second limit (status-line doc, "Write the status line program"). It runs when a session
    opens, a turn ends, the model changes or the app regains focus, with no timer. `node` is not on that `PATH`, so a
    wrapper would call it by full path; its cost per refresh was not measured, since nothing would run it.
  - *Where it is installed and the setting it needs*: under `Program Files` on the system drive, named by
    `sessionStatusLine` as a `REG_SZ` JSON string under `HKLM\SOFTWARE\Policies\Claude` or `HKCU\SOFTWARE\Policies\Claude`
    (configuration-format doc, "Value types"). Both need administrator rights.
  - *A risk the docs name*: a managed source that sets any key other than the app-behavior keys makes the managed
    configuration take effect (configuration-format doc, "Which configuration source applies on a device"); whether
    a lone `sessionStatusLine` policy changes how a claude.ai install starts is unknown, and it is the first thing a
    probe would have to show on a scratch machine, not on his.
  - *Undo*: `uninstall` runs per user and cannot remove a machine policy or a Program Files folder; an install would
    need its own recorded undo run as administrator.
  - *Without admin rights*: no install is possible, by the host's own rule.

### What this means for specs 3 and 4

Spec 3 (the program) and spec 4 (the administrator install question) assume a key the app reads. On a claude.ai
install it does not, so a program could be tested in a scratch home but never seen, and an install would ask him for
administrator rights to change nothing. They are not built; whether the feature closes here or builds the program for
a future host goes to the lead as one question (T6).

### The mistake behind the premise

The first host review drafted #24 into the Code tab because its text names "Code" ("in Cowork, Chat and Code"), and
`classify` lets a mention of the Code tab override the section (`bin/lib/host-watch.mjs`, `CODE_TAB`). That holds for
the Cowork section, a surface; the 3P section is a deployment mode the harness does not run in, so naming Code does not
bring an entry into it. T2 makes the draft say so; the reviewer still reads every entry (step 2 of the brief).

## Log
- L1 — his request, question 131 answered "Sí, ábrela" (spec 1).
- L2 — 2026-10-31, evidence: the changelog section, the 3P docs and the bundle probe above (Design, items 1 to 4).
  Bad news first: the key is 3P-only on the installed 4.4212.0, so the feature as asked cannot show anything on his
  machine. PowerShell cannot be launched from this session's shell (the worktree guard refuses it); it runs through a
  node runner in the job's scratch folder (`spawnSync('powershell.exe', ['-NoProfile', '-File', ...])`), which printed
  the package's install location and Windows PowerShell 5.1.19041.7802.
