# The js-harness specification

What the harness must achieve and why, written so that a later model could rebuild it from
nothing, and better, with this document alone. It never says how the code is written today:
a rebuild that copied today's pieces would copy their accidents too. The one line tied to the
present in each entry is **Today**, which names the files that hold the capability now; it is
what an agent about to change a piece reads to find it.

## The problem and the bet

An AI coding agent works inside a host (Claude Code, Codex) on top of a stack this harness does
not rebuild: engram owns memory; codegraph owns code structure; context7 owns library
documentation; the host's `/goal` owns the autonomy loop. The workflow, the task documents,
test-first work and review were gentle-ai's until F8, which replaces it: js-harness carries them
itself, installs the three complements, and gentle-ai leaves the machine at F8's S2 (`docs/ROADMAP.md`,
Decided, "Direction"; "After F8" below). Left there, three things go wrong. Rules live in prose the agent reads every turn and forgets, so
the same mistake comes back. Work spreads over several sessions that cannot see each other,
so a finished feature sits undelivered and a question reaches nobody. And whatever is written
into a machine to make this work cannot be taken out again: the predecessor stack needed four
hand-written purge scripts to uninstall (`docs/origin.md`, `AGENTS.md`).

The bet, from `docs/origin.md`: a stronger model needs a smaller harness, with less
instruction and more executable checks. Every line loaded on every turn is paid on every turn,
so the harness carries in prose only what an agent cannot learn from the code, and turns every
rule it can into a command that exits 0 or does not. When something can be checked, it is
checked; when it cannot, it is said once, in one place.

Four constraints hold across every capability below:

- Zero dependencies: every command is plain Node with no install step, so it runs in any host
  on any machine.
- Everything written outside a repository is recorded so it can be undone exactly.
- The person who owns the machine decides spend, anything irreversible and product choices;
  everything else keeps moving without asking.
- A claim carries its evidence, and a check that could not look never passes.

## How an entry reads

Each capability under "Capabilities" has six fields: **Problem**, the incident or measurement
that showed it; **Requirement**, what must be true; **Reason**; **Proof**, the commands that
show a rebuild meets it (each exits 0); **Discarded**, what was tried and dropped, so a later
model does not pay for the same lesson twice; and **Today**, the files, commands
(`js-harness <name>`), manifest entries and files under the home that hold it now.

The `spec` row of `js-harness check` holds this file to that shape at every commit: it fails
when a capability lacks a field or a proof command, when a test file its Proof names does not
exist, when a file its Today line names does not exist, and when a command of the dispatcher, an entry the manifest installs or a file the
harness writes under the home is claimed by no capability. It proves that every piece is named
and provable, not that its reason is well told; that part stays with review.

The eval tasks under `evals/tasks/` are the measure of "better": a rebuild is proved by these
proofs and by those tasks.

Two sections stand outside that shape. "The architecture", next, is the map: the pieces and how
they connect, so a reader knows where a capability sits before reading it. "After F8", after the
capabilities, is where each capability must end once F8 is done, and the capabilities F8 adds that
have no code yet: a capability enters "Capabilities" only when its proof exists, since the `spec`
row refuses a proof or a file that does not.

## The architecture

This is today's map, as the Today lines are: it says where each piece sits and what it talks to,
so an agent can find its way and see what a change touches. A rebuild is held to the requirements
of the capabilities, not to this layout ("The specification stays alive", Discarded).

### The pieces

```
 the owner ── decides spend, anything irreversible, product choices; reads Spanish Artifact pages
     │  one question at a time, through the orchestrator (`notify --kind question`)
     ▼
 the host: Claude Code works, Codex reviews
     │  loads every turn: CLAUDE.md → @AGENTS.md, ~/.claude/CLAUDE.md, the output style,
     │  skill descriptions, the MCP servers' instructions, what hooks print
     │  runs hooks: `js-harness <command> --hook` (13 Claude entries, 5 Codex entries)
     ├──────────────────────────────┬────────────────────────────────────┐
     ▼                              ▼                                    ▼
 js-harness (bin/, the package)    the stack (MCP servers, CLIs)        the owner's other tools
  the gate and its sensors          engram: memory                       gentle-ai, Orca, herdr:
  the two reviews                   codegraph: the code map              leave at S2
  rules, failures, the plan         context7: library docs
  sessions, the lead, the channel   Codex CLI: the review model
  install, doctor, stack            Claude CLI: the lens runs, evals
  evals (evals/, not shipped)
     │
     ├── writes in the project: harness.json, AGENTS.md, CLAUDE.md, docs/, .githooks or the hooks path,
     │   and the clone's .claude/settings.local.json
     ├── writes in the clone's git data: js-harness/manifest.json, the review records and the lands
     └── writes in the home: ~/.js-harness (the manifest, the channel, the gate log, ...),
         and recorded entries in ~/.claude
```

- **The host** is Claude Code, in the desktop app or the CLI, where every session works; Codex reads
  only what a review hands it (the diff, read access to the repository and `AGENTS.md`, `bin/codex-review.mjs:30`, `:222`). Antigravity is
  later (`docs/ROADMAP.md`, Decided, "Hosts").
- **js-harness** is a zero-dependency Node package with one dispatcher, `bin/js-harness.mjs`, whose
  `COMMANDS` the README and this file are held to. It is installed once per machine and enabled per
  project with `init` (`docs/ROADMAP.md`, Decided, "Two levels").
- **The stack** is installed and reported, never rebuilt: `doctor` reads each tool's state and
  prints its own fix, `stack install` runs an install it can undo exactly (The stack doctor, The
  stack install).
- **The owner** is reached only through the channel and the orchestrator: a question is a numbered
  notice first (Questions to the owner, through one place), a report is a Spanish visual page
  (`rule:reports-spanish-visual`).

### What loads on every turn

What a session pays before any work, in the order the host assembles it. The `payload` and
`fixed load` rows of every gate measure it (The payload and the fixed load); S0 measured a
first-turn median of 105,565 tokens over five desktop sessions (`odd/tasks/f8-s0-baseline.md`,
`## Baseline`).

| Source | Owner | Bound |
|---|---|---|
| The host's system prompt and tool definitions | the host | none of ours |
| The root `CLAUDE.md`, how Claude works here, which imports `@AGENTS.md` | the repository | `rule:claude-md-budget` (3,200 estimated tokens) |
| `AGENTS.md`, what the project is and what good work looks like; Codex reads it alone | the repository | `rule:agents-budget` (1,500) |
| `~/.claude/CLAUDE.md`: gentle-ai's blocks and the Rules block `install` writes (G12) | gentle-ai until S2, then js-harness's block only | excluded in this repository by `.claude/settings.json` (`claudeMdExcludes`) until S2 |
| The output style `js-harness` (neutral Spanish with tú) | js-harness (`claude-output-style`) | pinned by hash |
| Skill descriptions: `js-harness`, the orchestrator, the protocols, the two ported skills; gentle-ai's until S2 | js-harness (`claude-skill`, ...) | one line each; bodies load on demand |
| The auto-memory index, `memory/MEMORY.md` of the main checkout's project folder (`bin/lib/payload.mjs:266`) | the host, written by sessions | measured by `payload`; S5 holds it to 0.5k |
| The MCP servers' instructions: engram, codegraph, context7 | each tool | reported by `payload` |
| What hooks print at session start and each prompt | each hook's owner | the doctor's notice is a `systemMessage`, which costs no model tokens |

### The hooks

Every hook is an entry `install` grafts into the host's settings and records by file, pointer and
entry, so `uninstall` removes exactly it (`bin/lib/manifest.mjs`, `entryComponents`; the commands in
`bin/lib/hook-entries.mjs`). Each ends with `|| exit 0` where it must never block the host. Every entry is
Claude Code's: Codex only reviews, so `install` writes nothing under `~/.codex` (D4,
`odd/tasks/drop-codex-components.md`). Versions up to 0.97.0 also wrote the doctor, resume, fallback,
reply and backup entries in `~/.codex/hooks.json`; the next `install` or `sync` takes them out.

| Event | Claude entry | Command | What it does |
|---|---|---|---|
| SessionStart | `claude-hook` | `js-harness doctor --hook` | the stack's gaps, only when they changed |
| SessionStart | `claude-resume-hook` | `js-harness resume --hook` | after a compaction, the files to resume from |
| SessionStart | `claude-rules-start-hook` | `js-harness rules --hook` | the rules main has that the session's base does not, once |
| SessionStart | `claude-fallback-hook` | `js-harness backup --session-start` | sends a session to the readable memory when Engram lost its project |
| UserPromptSubmit | `claude-rules-turn-hook` | `js-harness rules --hook` | as at start, at each turn |
| SubagentStart | `claude-rules-subagent-hook` | `js-harness rules --hook` | as at start, for a sub-agent |
| PreToolUse | `claude-guard-hook` | `js-harness guard --hook` | refuses a tool call that breaks a held rule |
| PreToolUse | `claude-template-gate-hook` | `js-harness template gate --hook` | refuses an output to the owner no template command made |
| PermissionRequest | `claude-permit-hook` | `js-harness permit --hook` | relays another session's permission card to the orchestrator |
| PostToolUse | `claude-pause-hook` | `js-harness resume --pause` | the context pause and the inbox |
| PostToolUse | `claude-template-shown-hook` | `js-harness template gate --shown` | records what the template gate let through as shown |
| PostToolUseFailure | `claude-web-failure-hook` | `js-harness resume --pause` | the next rung after a failed web fetch |
| Stop | `claude-share-hook` | `js-harness guard --stop` | turns back a reply whose stated context share is off its transcript's |
| Stop | `claude-reply-hook` | `js-harness reply --hook` | turns back a reply that closes with no state |
| Stop | `claude-backup-hook` | `js-harness backup --hook` | starts a memory backup when one is due |

On this machine on 2026-10-28, `~/.claude/settings.json` held 32 hook entries: js-harness 13,
Orca 12, gentle-ai 5, herdr 1, codegraph 1 (read with a one-off count by owner). S2 takes it to 14,
and S4a's row holds it there.

### The life of a change

1. **Plan.** Large work opens `odd/tasks/<feature>.md` with the task contract first (`js-harness
   contract template`; The task contract); small work stays inline (`CLAUDE.md`, "How sessions
   run").
2. **Commit.** `.githooks/pre-commit` (or the project's hooks path, written by `init`) runs
   `js-harness check`: the static rows first, each a second or less, then the sensors. A commit's
   gate runs its tests on CI first, on a `gate/` branch (`.github/workflows/gate.yml`), and falls
   back to the local gate under the machine's lock (The commit gate; A commit's gate runs its tests
   on CI first; One gate at a time on the machine). A commit of documents alone runs only the
   document sensors.
3. **Review.** Each slice with code gets two reviews over its commit range: `js-harness
   codex-review --base <boundary>` (Codex, in a lean home) and `js-harness lens-review --base
   <boundary> --lenses <list> --reason <why>` (one to four Claude lenses, fresh and tool-less). Each
   writes its record under the git common directory (The Codex review; The Claude lens review).
   Until S2, gentle-ai's own review also runs where its consent envelope offers it.
4. **Push.** `.githooks/pre-push` runs `check --push`, which refuses a code commit that a complete
   record of each review does not cover, where the project turns that review on (`codexReview` is on
   by default where Codex is installed, `lensReview` off until the project turns it on,
   `bin/lib/functions.mjs:131-135`; this repository turns both on), unless a skip is recorded; a skip is a debt that `check`'s
   `review` row and `doctor`'s `review-skips` row list.
5. **Land.** `js-harness merge-queue` builds main plus each ready pull request, tests the candidate
   on CI (a `queue/` branch) and on this machine, refuses a pull request whose commits hold a lens
   skip or lack a record, and moves main by fast-forward; pre-push refuses a push of main from
   anywhere else (The merge queue).
6. **After.** The daily Windows suite runs the whole suite on Windows once a day; the gate log keeps
   every gate; `throughput` reads both.

### Where state lives

Each fact has one home. Committed documents are canonical; engram and `MEMORY.md` mirror or point
to them (diet section 10, "The rule pass").

| Record | Where | Written by | Read by |
|---|---|---|---|
| The project's settings | `harness.json`: the pin, `code`, `functions`, the reply check | `init`, `functions apply`, `sync` | nearly every command |
| The clone's Claude keys | `.claude/settings.local.json`: the style and the denies | `init`, `sync` (`bin/lib/project-apply.mjs:12`) | the host; `uninstall` by the clone's manifest |
| The project's own rules | `docs/rules.json` | sessions | `rules`, `rules check` |
| The plan | `docs/ROADMAP.md`; frozen origin `docs/origin.md` | sessions, by hand | `progress`, `report`, every session at start |
| A feature | `odd/tasks/<feature>.md`, mirrored in engram (`odd/<feature>/tasks`) | the session that holds it | `contract`, `check`'s `contracts` row, `resume` |
| Rules | `bin/lib/rules-data.mjs`, sources in `docs/rule-sources.json`, rendered to `docs/RULES.md` | `js-harness rules change` on a `rule/` branch | `ruleValue` in code, `rules check`, `rules --hook` |
| Failures | `docs/FAILURES.md` | sessions, one `Seen:` line per sighting | `failures`, `check`'s row |
| Flaky tests | `docs/FLAKY.md` | sessions, by hand | `check` |
| This specification | `docs/SPEC.md` | sessions | `check`'s `spec` row |
| Session summaries | `docs/sessions/<date>-<slug>.md` | `summary`, then the session | the lead, the 1.0.0 review |
| The machine manifest | `~/.js-harness/manifest.json` | `install`, `stack install`, opt-ins | `uninstall`, `status`, `doctor` |
| A clone's manifest | `js-harness/manifest.json` at `git rev-parse --git-path` (`bin/lib/project.mjs:1063`) | `init` | `uninstall` in the project, `sync` |
| Review records | `<git common dir>/js-harness/codex-reviews.jsonl`, `codex-review-runs.jsonl`, `lens-reviews.jsonl`, `lens-review-runs.jsonl`, and an incomplete lens's whole stdout in `lens-answers/`, which no check reads | `codex-review`, `lens-review` | `check --push`, the merge door, `doctor`, `throughput` |
| Lands | `<git common dir>/js-harness/lands.jsonl` | `merge-queue --land` | `throughput` |
| Codex review homes | `~/.js-harness/codex-review-homes` (`bin/lib/codex-review-home.mjs:65`) | `codex-review` | `codex-review` (`--keep-home`) |
| The channel | `~/.js-harness/channel/<project>.jsonl`; the lead's relief file in `~/.js-harness/relief/` | `notify` | `wait`, `sessions`, `report`, `sessions live`, `resume` |
| Background sessions | `~/.js-harness/background/` | `sessions start` | `sessions`, `sessions stop`, `uninstall` |
| Loops | `~/.js-harness/loops/<project>/` | `loop` | `loop status`, the heartbeat |
| Gates | `~/.js-harness/gate-log`; the lock under `~/.js-harness/gate`; the gate-first tickets in `gate-first` (`bin/lib/gate-first.mjs:41`); the WSL gate's state in `gate-wsl.json` (`bin/lib/gate-wsl.mjs:38`) | `gate`, `check` | `gate`, `throughput`, `quiet` |
| Throughput snapshots | `~/.js-harness/throughput/` | `throughput snapshot`, and each tick of `loop heartbeat` for settled days without one | `throughput` |
| The remote server | `~/.js-harness/remote/`: the supervisor record, log, lock, stop marker and task file (`bin/lib/remote.mjs:632-643`) | `remote` | `remote status`, `remote stop` |
| Refresh backups | `~/.js-harness/refresh-backups` (`bin/lib/refresh-copy.mjs:287`) | `merge-queue --land --refresh-copy`, the settings before it brings the installed copy up to main | the undo line that refresh prints |
| The doctor's cache and reviews | `~/.js-harness/doctor.json` | `doctor` | `doctor` and its hook |
| Clean | `~/.js-harness/clean.json`, `clean-log.jsonl` | `clean` | `clean`, `doctor` |
| Memory | engram's store (`~/.engram`); Claude's memory folders; the backup clones under `~/.js-harness/memory-backup/`; a memory pass's lock, snapshots and journal under `~/.js-harness/memory-hygiene/<project>` (`bin/lib/memory-hygiene.mjs:37-52`) | engram, the host, `backup run`, `memory` | sessions; `backup`, the fallback hook |

### Sessions and the lead

The owner runs several sessions; one is the orchestrator (the lead), found by its title, and the
others are work sessions that each hold one feature (A role is the address, and there is one
orchestrator). Sessions cannot see each other's screens, so everything between them goes through
files: a notice is a line of the channel written by `notify` (The record of notices between
sessions); a session that waits keeps `js-harness wait` running, which ends on its condition or on a
notice to its own number (Waiting and waking); the lead reads the board, computed from transcripts,
worktrees, gates and pull requests at each read (The board knows every session), starts background
sessions with `sessions start` (The lead starts a session on a turn he did not type), relays
permission cards (The permit relay), asks the owner's questions one at a time (Questions to the
owner, through one place) and reports from `report` (The status report). Every reply closes on one
of five states that the reply hook holds (The reply check); near the context limit a session writes
its state and keeps working, and after a compaction it resumes from files (The context pause and
the inbox; A compaction resumes from files). The orchestrator skill holds how the lead works; the
protocols skill holds the eight protocols (The installed skills).

### Rules, failures and coverage

A rule lives where something acts on it: a check before a line in `CLAUDE.md` or `AGENTS.md`, a line
before a protocol, never a memory note (`AGENTS.md`). Each rule is declared once with an id, owner
and source, as a value code reads by id or as prose held by phrases (Declared rules); `rules check`
runs as a document sensor and refuses a renamed reader, a lost phrase or a deleted rule; `rules
--hook` tells a session at start, at each turn and in each sub-agent what main's rules say that its
base does not. A failure is registered with its class and its control, whose state is computed
(The failures register). A project keeps its own list in `docs/rules.json` (A project's own
rules). What none of this proves yet is that a directive is followed: S5c ties every directive to a
check or an eval case ("After F8", directive coverage).

## Capabilities

### The commit gate

**Problem:** F1 asked that `git commit` run the gate (`odd/tasks/f1-skeleton.md`). Later a static row that failed was printed only after about seventeen minutes of sensors and the wait for the lock (`odd/tasks/gate-turn.md`), and git runs no pre-commit hook for the commit a merge makes by itself.
**Requirement:** One command is the single gate: the same gate runs before every commit a person makes, and refuses it when red. A merge's commit that git makes by itself runs this repository's own `pre-merge-commit` hook (`.githooks/pre-merge-commit`), because git runs no pre-commit hook for it; an installed project's hook is the pre-commit one only, so its merge commits made by git are not gated. Its static rows (the project's rules, the failures register, the instruction budget, the contracts, the citations, the functions, the payload, the fixed load, the commit size where this repository's `reviewed-commit-lines` rule is in force, the exact tests of a project that declares them, the flaky ledger, this specification) run first, each in a second or less, and a failing one stops the gate before it waits for the machine's lock or runs a sensor. A row that informs never stops it.
**Reason:** A red check means the commit is not ready yet (`AGENTS.md`); a fault known in a second must not cost a whole gate.
**Proof:** `node --test bin/check.test.mjs`, `node --test bin/check-exit.test.mjs`
**Discarded:** Setting `core.hooksPath` in a project: it silently disables `.git/hooks`; `init` writes into the hooks path instead.
**Today:** `bin/check.mjs`, `.githooks/pre-commit`, `.githooks/pre-merge-commit`, `package.json`, `js-harness check`

### The instruction budget

**Problem:** No incident; the founding bet (`docs/origin.md`) and F1, which asked for `AGENTS.md` at about 1.5k tokens and a check that fails over it (`odd/tasks/f1-skeleton.md`). It landed at 691 tokens and stood at 1,478 of 1,500 on 2026-10-15 (`odd/tasks/drop-github-gate.md`).
**Requirement:** A commit fails when an instruction file every session pays on every turn exceeds its declared token budget: `AGENTS.md`, and since F8's S3 the root `CLAUDE.md` that imports it, each with its own rule; a budget is a declared rule, not a literal in code.
**Reason:** Every line of `AGENTS.md` is paid on every turn of every session, and a check costs no tokens and cannot be forgotten.
**Proof:** `node --test bin/check.test.mjs`
**Discarded:** Failing on the whole payload of the machine: no commit here can shrink a file gentle-ai manages, so the hard budget stays on what the repository owns.
**Today:** `bin/check.mjs`, `bin/lib/claude-md-budget.mjs`, `bin/lib/rules-data.mjs`, `AGENTS.md`, `CLAUDE.md`

### The project's sensors

**Problem:** The gate hardcoded `node --test`, the wrong runner for most projects, so a project's real tests and lint never ran at commit time; a test that forgot its throwaway home once wrote into the real one; a bound of ten minutes refused commits whose tests were green while other programs held two of eight cores (`odd/tasks/sensors.md`).
**Requirement:** Every commit runs the project's own named commands that must exit 0, declared in `harness.json` in any language (an empty map is a named opt-out), or else the package's test, lint and typecheck scripts. Each runs under a throwaway home with a bounded time that is a declared rule, and a sensor that times out leaves no process behind.
**Reason:** Quality without tokens: a sensor runs on every commit whatever the agent remembers.
**Proof:** `node --test bin/check.test.mjs`
**Discarded:** One fixed runner for all projects. Installing or configuring a linter from the harness. A ten-minute bound.
**Today:** `bin/check.mjs`, `harness.json`, `bin/lib/process-tree.mjs`, `bin/lib/gate-wsl.mjs`

### The payload and the fixed load

**Problem:** The budget row read only `AGENTS.md` (691 tokens) while the global `CLAUDE.md` alone was about 17.6k; a one-word prompt cost about 107.8k tokens in Claude Code (`docs/ROADMAP.md`, F2). A desktop session started at 109,514 tokens before anyone typed; the owner's words: "solo inicar la sesion gasta 100 mil" (`odd/tasks/fixed-load.md`). gentle-ai v4 grew the payload instead of shrinking it.
**Requirement:** Every gate reports, per host, each source loaded on every turn with its path and estimated tokens, a host total and the hook commands that can inject context; and the first-turn input tokens of the project's five newest sessions, read from the host's own transcripts, with their median against a budget and a warning over it. These rows inform and never fail; they spawn nothing. A cut to what is loaded is moved, never deleted, measured before and after, proven by an eval and undoable.
**Reason:** A gate that sees a few per cent of the payload cannot steer it, and a measure that stays on shows a regression on the next commit instead of in a compaction.
**Proof:** `node --test bin/lib/payload.test.mjs`, `node --test bin/lib/fixed-load.test.mjs`
**Discarded:** Running the hosts' hooks from the gate to measure their output: some write files, and the gate stays read-only. An estimate from files alone: it misses tools, servers and the system prompt (63.5k measured against about 110k). Editing files outside the repository: a hand edit of gentle-ai's block is overwritten by its next sync.
**Today:** `bin/lib/payload.mjs`, `bin/lib/fixed-load.mjs`, `bin/check.mjs`

### Whether a change is due a review

**Problem:** Whether a change was due a review was known only if the agent remembered to ask gentle-ai (`odd/tasks/sensors.md`); since every slice gets two reviews (`odd/tasks/f8-s1-reviews.md`), what matters is which code still waits for them.
**Requirement:** Every gate's `review` row names the code commits since the default branch that no Claude lens record covers, with the command that makes one, and the skips of both reviews that still owe one; with the Codex review off it says the lenses are the one review. It informs and fails open: a debt it cannot read is said, never a failure. Where the rule `reviewed-commit-lines` is in force, the gate fails a staged change with more changed lines a review reads than that rule gives, so it is split before it is made, not refused by the reviewer after (`docs/FAILURES.md`, commit-too-large-to-review).
**Reason:** The push refuses the debt (`lens-review`, `codex-review`); a commit only shows it, so a slice is committed before it is reviewed and the debt is in sight before the push.
**Proof:** `node --test bin/lib/lens-review-rows.test.mjs`, `node --test bin/check.test.mjs`, `node --test bin/check-commit-size.test.mjs`
**Discarded:** A review that blocks a commit: a slice is committed before it is reviewed. Asking gentle-ai for a risk tier: every slice gets both reviews whatever its risk (his answer of 2026-10-26), and gentle-ai leaves at F8's S2.
**Today:** `bin/check.mjs`, `bin/lib/lens-review-rows.mjs`

### Contracts and citations

**Problem:** F3 asked that a task contract with no executable done-when never reach the autonomy loop (`odd/tasks/task-contract.md`). False citations lived in prose: the first full read found 1,857 citations, 190 unresolved (`odd/tasks/commands-and-doctor.md`).
**Requirement:** Every gate validates every contract under `odd/tasks/` statically, never running a done-when command (one may be the gate itself). It resolves the `path:line` citations the pending change adds against the commit's index and reports how many do not resolve, and each task the change checks off that names no commit HEAD reaches, unless the change stages the work beside it.
**Reason:** A feature's end stays a set of commands, and a citation is evidence only if it points at something.
**Proof:** `node --test bin/lib/contract.test.mjs`, `node --test bin/lib/citations.test.mjs`, `node --test bin/check-citations.test.mjs`
**Discarded:** Running the done-when commands in the gate: it recurses through the gate. Citations as a failing row: documents cite other branches and repositories on purpose, so the row informs.
**Today:** `bin/check.mjs`, `bin/lib/contract.mjs`, `bin/lib/citations.mjs`

### Exact tests

**Problem:** On 2026-10-14, 46 gates in 109 minutes each ran the whole suite: median 137 s, p90 240 s, and a median wait of 30 minutes for a turn (`odd/tasks/exact-tests.md`).
**Requirement:** A commit's gate skips a test file only on the trace of a passing run whose every recorded read is unchanged, and runs the whole suite whenever the record cannot be trusted. A shadow count must reach a set number of gates that would have skipped and saw no skipped file fail before the skip is switched on.
**Reason:** A skipped test that should have run is a defect nobody sees, and the whole suite is always the safe answer.
**Proof:** `node --test bin/lib/trace-reads.test.mjs`, `node --test bin/lib/select-tests.test.mjs`, `node --test bin/check-exact-tests.test.mjs`
**Discarded:** A tracer installed on the machine: a change to the machine is the owner's. Skipping "unaffected" tests by a static map: none exists, and a wrong one is a silent hole.
**Today:** `bin/lib/trace-reads.mjs`, `bin/lib/trace-reads.cjs`, `bin/lib/select-tests.mjs`, `bin/check.mjs`

### The flaky ledger

**Problem:** A test failing by timing under load turned a whole gate red and cost a turn with nothing wrong in the change (`odd/tasks/flaky-ledger.md`).
**Requirement:** When the suite fails, the failed test files are run once more alone. A file that passes then does not block only while a committed ledger entry with an owner, an expiry and a failure id stands; a failure that does not pass again, or a file with no current entry, still blocks; an expired or malformed entry blocks again.
**Reason:** Only a pass on a second run says the test, not the change, is at fault, and a quarantine nobody can read in git is a hidden pass.
**Proof:** `node --test bin/lib/flaky.test.mjs`, `node --test bin/check-flaky.test.mjs`
**Discarded:** A gate that writes the ledger entry itself: it would pass on a file nobody committed.
**Today:** `bin/lib/flaky.mjs`, `bin/check.mjs`, `docs/FLAKY.md`

### One gate at a time on the machine

**Problem:** "Never two gates at once" was kept by hand: two gates together missed the 20-minute sensor bound with every test green, and three sessions kept private wait scripts and still collided (`odd/tasks/gate-lock.md`). Later a commit waited an hour and lost its turn to later arrivals (`odd/tasks/gate-turn.md`).
**Requirement:** Only one gate runs sensors on the machine at a time, across every project; waiting gates take turns in arrival order and say whose they are; a dead holder is taken over safely. Any heavy run (a whole suite, a batch of evals) goes under the same lock with a bound that stops its whole process tree. While a branch's open pull request has commits a push would take, a turn is refused to anything but that push or a merge.
**Reason:** The rule cannot be kept from outside the gate: two sessions that look, see none and start have both kept it. The cores are the machine's, not a project's.
**Proof:** `node --test bin/lib/gate-lock.test.mjs`, `node --test bin/gate.test.mjs`
**Discarded:** A lock per project. A lock by message between sessions: no one is listening. Making the lock folder and then writing it: an empty lock folder let two gates hold it.
**Today:** `bin/lib/gate-lock.mjs`, `bin/gate.mjs`, `bin/check.mjs`, `bin/lib/launcher.mjs`, `bin/lib/push-waits.mjs`, `js-harness gate`

### A commit's gate runs its tests on CI first

**Problem:** Measured on 2026-10-16: two suites at once on this machine take 303 and 305 s against 158 s alone, so the limit is the CPU and a second local line gains nothing; the gate was the limit on how many sessions fit (`odd/tasks/first-version.md`, S7).
**Requirement:** A commit's gate (the gate a commit's or a merge's hook runs, not a check by hand, which tests the working tree) runs its tests on a CI machine first, whether or not the machine's lock is free, on the exact tree being committed (written as a commit object and pushed to a branch of its own, deleted after), and the commit is made only on green, with the same tree; red prints the failing tests and refuses. The client is asked before anything is pushed, and a push never prompts for credentials. Anything that is not a green or red run (no network, no signed-in client, no run, a run cancelled or past its bound) falls back to the local gate and says why, so CI never makes a gate impossible. The workflow runs only for a push to those branches, never for a pull request or the default branch, reads and writes nothing else, names no secret and pins its actions; a test holds every one of those bounds. Each gate on CI leaves its record in the gate log.
**Reason:** A commit never lands without its own proof, wherever it ran; a gate on GitHub took a median of 144 s from the push against 218 s here with a free lock, ran the whole suite and cost nothing on a public repository, while the machine's lock was busy 14-17 hours a day (`odd/tasks/commit-gates-first.md`); and a bound written in a workflow a pull request could change must be held by a test, not by care.
**Proof:** `node --test bin/lib/ci-gate.test.mjs`, `node --test bin/check-ci-gate.test.mjs`, `node --test scripts/github-workflows.test.mjs`
**Discarded:** CI only when the lock would wait (2026-10-16 to 10-17): a free lock kept a gate here, slower than CI. A second local line: the CPU is shared. A run on every pull request: each merge made every other run stale, and minutes were scarce while the repository was private. Windows runners for each gate: 22 billed minutes a run while the repository was private, and a gate would wait on a suite of 14 minutes. What CI cannot prove (it is Linux) is run once a day on Windows (the next section).
**Today:** `bin/lib/ci-gate.mjs`, `bin/check.mjs`, `.github/workflows/gate.yml`, `scripts/github-workflows.test.mjs`

### The daily Windows suite

**Problem:** The gates run on Linux (CI) and in WSL2 (the merge queue's run), so no gate ran the Windows code paths; the README promised a Windows run after each landed batch, and none of 84 land suites ran on Windows (`odd/tasks/commit-gates-first.md`, S5). One after each batch would hold the gate lock 15 to 19 hours a day.
**Requirement:** The whole suite runs once a day on GitHub's Windows machines, on a schedule and by hand only, never for a push or a pull request, so it holds up no gate and no land; its token reads, it names no secret and its actions are pinned, held by a test. A red run (failure, timed out or cancelled) not told before is told to the orchestrator once, with its failing test names and how many failed, unless every file it failed in is quarantined; a red run whose names cannot be read is told all the same, and so is a schedule with no run in 26 hours. The lead's heartbeat reads it every hour and ends on a red one.
**Reason:** A regression that only Windows shows is found within a day instead of never, at no cost on a public repository and without the gate lock. He chose the cadence: "Una vez por día (Recomendada)".
**Proof:** `node --test bin/lib/windows-daily.test.mjs`, `node --test bin/windows-daily.test.mjs`, `node --test bin/loop-bodies.test.mjs`, `node --test scripts/github-workflows.test.mjs`
**Discarded:** A Windows run after each landed batch: 15 to 19 lock-hours a day. Telling only through the channel: the heartbeat runs in the lead's session, and the lead's channel watch passes over its own notices, so the heartbeat's end line wakes the lead. Silence on a red run whose files cannot be found: it would read as all of them quarantined.
**Today:** `.github/workflows/windows-daily.yml`, `bin/lib/windows-daily.mjs`, `bin/windows-daily.mjs`, `bin/loop.mjs`, `js-harness windows-daily`

### The gate log

**Problem:** On 2026-10-11 one gate timed out at 1,200 s and another took 1,069 s against 832 s for the same tree, beside a video and a language server nobody saw; which gates ran beside which was a session's memory (`odd/tasks/gate-log.md`). A failed run's test names were lost with its report.
**Requirement:** Every gate, a commit's included, appends when it ran, its seconds, its result, the machine's load, whom it waited for, its folder and the names of failed tests to one bounded log under the home, which a command prints and uninstall removes.
**Reason:** A slow gate is explained by a file, not by a recollection.
**Proof:** `node --test bin/lib/gate-log.test.mjs`, `node --test bin/lib/machine-load.test.mjs`
**Discarded:** Reading the load through PowerShell on every gate: seconds, and Windows only. Whole command lines: a secret gets logged. One line written at the end: a killed gate vanishes. Trimming by rewrite: it loses appends.
**Today:** `bin/lib/gate-log.mjs`, `bin/lib/machine-load.mjs`, `bin/gate.mjs`, `~/.js-harness/gate-log`

### Install and undo exactly

**Problem:** The predecessor stack needed four hand-written purge scripts to uninstall (`AGENTS.md`, `odd/tasks/install-update.md`). Sessions of two permission classes could not message each other: Claude Code delivers only within a class unless a user setting says otherwise (`odd/tasks/commands-and-doctor.md`).
**Requirement:** Every file written outside a repository is recorded in a manifest under the home with its hash; uninstall removes exactly those and keeps, and reports, a file the user edited; install and sync, likewise, leave a recorded file whose bytes are neither the recorded ones nor this version's, carry its record forward and say it was kept as the user's with how to take this version's text, while a file deleted is written again. An entry grafted into a JSON file the harness does not own (a hook in a host's settings) is recorded by file, pointer and entry: install adds no duplicate, uninstall removes only that entry and deletes the file only if the harness created it and it is now empty. An opt-in sets the user setting that lets sessions of other permission classes message each other, and uninstall puts back what was there. Each command acts on the project inside one and on the machine elsewhere; each kind of uninstall (project, machine, machine and memory snapshots, everything) also has a name that never acts by location, in the CLI and as an item of the TUI's Uninstall submenu, each saying what it removes and what it keeps; a status says what is pinned, installed and latest.
**Reason:** Anything written outside the repository must come out exactly, or removing the harness costs a purge script.
**Proof:** `node --test bin/install.test.mjs`, `node --test bin/lib/manifest.test.mjs`, `node --test bin/codex-hook-trust.test.mjs`, `node --test bin/lib/component-write.test.mjs`, `node --test bin/install-session-messages.test.mjs`, `node --test bin/uninstall-kinds.test.mjs`, `node --test bin/tui.test.mjs`
**Discarded:** Assuming npm: on this machine `npm` is a pnpm shim. Owning a host's settings file whole instead of one entry.
**Today:** `bin/install.mjs`, `bin/lib/manifest.mjs`, `bin/lib/component-write.mjs`, `bin/tui.mjs` (the menu and its Uninstall submenu), `scripts/e2e.mjs`, `js-harness install`, `js-harness sync`, `js-harness uninstall`, `js-harness status`, `~/.js-harness/manifest.json`, `~/.claude/settings.json` (hook entries), and the installed skills under `~/.claude/skills` (`bin/lib/manifest.mjs`, claimed by id)

### Releases

**Problem:** Update and upgrade asked the npm registry for a name nobody holds and installed what it printed with no comparison (`odd/tasks/install-update.md`, T5); until a release source existed no command could update a machine (`odd/tasks/first-version.md`).
**Requirement:** The newest release is the highest tag named exactly `vX.Y.Z` in the harness's own repository, listed with the machine's own git and credentials within a time bound; upgrade installs that tag and then syncs; tags that cannot be listed exit 1 with the reason and install nothing; no registry is ever asked; a folder of packed tarballs can stand in; a pushed `vX.Y.Z` tag is refused by `check --push` when `package.json` at the tagged commit names another version than the tag without its `v`; `scripts/release-proof.mjs` installs a tag with real npm or pnpm into throwaway folders, upgrades to a second tag, moves a project's pin and uninstalls, and the home must be as it started; `js-harness --version`, `-v` and `version` print the running copy's version alone on one line, which upgrade asks of the copy on the path before it lets that copy sync.
**Reason:** The machine's git already holds what the repository needs to be read, and no registry holds the package; tagging starts at v0.9.0, a rehearsal release, and v1.0.0 is the first definitive one (`docs/ROADMAP.md`, "Versioning").
**Proof:** `node --test bin/update.test.mjs`, `node --test bin/release-tags.test.mjs`, `node --test bin/lib/version.test.mjs`, `node --test bin/check.test.mjs`, `node --test scripts/release-proof-lib.test.mjs`, `node --test bin/js-harness.test.mjs`
**Discarded:** The npm registry as the source. An npm publish, planned for a public repository and left without a date.
**Today:** `bin/update.mjs`, `bin/lib/version.mjs`, `bin/check.mjs`, `.githooks/pre-push`, `scripts/release-proof.mjs`, `scripts/release-proof-lib.mjs`, `bin/js-harness.mjs`, `js-harness update`, `js-harness upgrade`

### Project init

**Problem:** No incident; the roadmap decided two levels, installed per machine and enabled per project like `git init` (`docs/ROADMAP.md`, `odd/tasks/project-init.md`).
**Requirement:** In a git repository, init writes a committed `harness.json` pinning the version, a base `AGENTS.md` only where none exists and, where the project has neither file, a root `CLAUDE.md` that imports it and holds the half of the harness's lines Claude works from (a project with its own `CLAUDE.md` gets the whole block in `AGENTS.md`, so no line is lost), an empty failures register (`docs/FAILURES.md`, declaring no class, since the classes are the project's own) only where none exists, the pre-commit gate in the hooks path and, where the project's Codex review switch resolves on, the pre-push check, keeping any hook already there; it writes into the clone's own `.claude/settings.local.json`, never the tracked settings, the keys its switches ask for, the `js-harness` output style and the deny list among them; it prepares the code map where it is on. Every file and key is recorded in a per-clone project manifest so uninstall restores the repository exactly. Outside a git repository it writes nothing and exits 1. Migrate brings a project an older release initialized to what init writes, keeping the project's edits and recording each write the same way; `migrate --check` and `migrate list` only read.
**Reason:** Every file init writes inside a project must be undone exactly, like what install writes on the machine.
**Proof:** `node --test bin/init.test.mjs`, `node --test bin/lib/project.test.mjs`, `node --test bin/lib/project-apply.test.mjs`, `node --test bin/lib/project-migrate.test.mjs`, `node --test bin/migrate.test.mjs`, `node --test scripts/migration.test.mjs`
**Discarded:** Changing `core.hooksPath`: it silently disables `.git/hooks`. A committed manifest: it is per clone, like the hook.
**Today:** `bin/init.mjs`, `bin/lib/project.mjs`, `bin/lib/project-apply.mjs`, `bin/lib/project-migrate.mjs`, `bin/migrate.mjs`, `js-harness init`, `js-harness migrate`

### The stack doctor

**Problem:** A gap was found only by accident: codegraph was registered in Claude Code but not in Codex (`odd/tasks/stack-doctor.md`).
**Requirement:** The doctor reports each tool of the stack as installed, configured per host and project, and up to date, or unknown, with that tool's own fix command; it caches the latest versions, fails open offline and never installs or configures another tool. A session-start hook speaks only when the list of gaps changed, as a message to the person and never as text for the model, and always exits 0, but for an argument it does not know: that exits 2 with the usage on stderr, because an installed entry carries only `--hook`, so such an argument means the copy on PATH is older than the install, and a session-start hook's exit 2 shows its one line without stopping the session. A tool of the stack, or the Claude CLI on PATH, whose version moved since the versions last reviewed is a gap until its review is recorded (`docs/FAILURES.md`, cli-updated-itself). While engram's Claude Code plugin is installed and enabled, it is compared with the plugin the engram binary's own release tag ships, read offline from the marketplace clone at that tag, so a plugin left behind by an update of the binary alone is `outdated` with both versions and its update commands (`odd/tasks/engram-plugin-lag.md`); engram's latest release is its highest `v<semver>` tag, never one of its `pi-v*` releases. The installed copy's rules with no scope are compared, by their hash, with the default branch's, read fresh and never cached, so that a copy behind main is `outdated` with its fix and a list that cannot be read is `unknown`. Further rows: the Claude account check (the CLI and the desktop app name one account, neither identifier printed), the remote server check (`remote`), the `host-update` row for the Claude desktop app and its CLI (reviewed by `--host-reviewed`), the `gentle-ai-sync` row (`--gentle-ai-reviewed`), the `stack-update` row (`--stack-reviewed`), the `unseen` row, and, interactively, the `worktrees` row and the `review-skips` row (the skips of both reviews that still owe one, `odd/tasks/f8-s1-reviews.md`).
**Reason:** A notice costs no model tokens when it comes only on start or resume, and only when something changed. A tool that updates itself was seen only when a measurement was about to run on it.
**Proof:** `node --test bin/doctor.test.mjs`, `node --test bin/doctor-hook.test.mjs`, `node --test bin/lib/stack.test.mjs`, `node --test bin/lib/stack-update.test.mjs`, `node --test bin/lib/rules-installed.test.mjs`, `node --test bin/lib/latest.test.mjs`
**Discarded:** Plain-text hook output: it enters the model's context. Recommending another tool's own upgrade command where that tool says not to.
**Today:** `bin/doctor.mjs`, `bin/lib/stack.mjs`, `bin/lib/stack-update.mjs`, `bin/lib/cache.mjs`, `bin/lib/latest.mjs`, `bin/lib/rules-installed.mjs`, `js-harness doctor`, `claude-hook`

### The stack install

**Problem:** The doctor named a fix for each gap and nothing ran it, in an order that matters and with no record of what it wrote, so a new machine was set up by hand and nothing could undo it (`odd/tasks/stack-install.md`).
**Requirement:** `stack` lists, read-only, the tools the harness requires that are missing for this project, in run order, each with its command and its exact undo: the Codex CLI while codexReview is not off, codegraph while codeMap is not off, and codegraph's registrations in both hosts. A tool whose undo is not exact (gentle-ai's own installer, and engram, which it brings), a login and a prerequisite are named as the person's steps and never run; context7 and typescript-lsp are optional. The package manager is named, or read from the copy, never from the word `npm`. Each row run is recorded in the machine manifest before it starts, with its undo, the environment it was given and, read back after it, what that undo applies to; `uninstall machine` undoes the records the last first, drops the record of a tool already gone, keeps and names one that changed since, and keeps the record of an undo that failed for a run again. No test runs a real command.
**Reason:** Every write outside the repository must be undoable exactly; gentle-ai's uninstall removes whole settings keys and leaves binaries and PATH entries behind, so the harness does not run it (his answer to F1, 2026-10-19).
**Proof:** `node --test bin/lib/stack-install.test.mjs`, `node --test bin/stack.test.mjs`, `node --test bin/lib/stack-run.test.mjs`, `node --test bin/lib/manifest-stack.test.mjs`, `node --test bin/stack-install.test.mjs`
**Discarded:** A flag on `install`: install writes the harness's own files and is safe to run unasked. Running gentle-ai's installer with only its own uninstall as the undo.
**Today:** `bin/stack.mjs`, `bin/lib/stack-install.mjs`, `bin/lib/stack-run.mjs`, `js-harness stack`

### Progress

**Problem:** "Where are we" was answered by a model reading the roadmap and every feature document, which costs tokens and drifts; states written as prose could not be counted (`odd/tasks/progress-view.md`).
**Requirement:** The plan and each feature document hold their steps as checkboxes, and a read-only command prints each phase and feature with its checked and pending steps and percentages. Its pace reads the default branch's first-parent history and prints, a day, the tasks closed, reopened, added and removed, counted by the same parsers as the map.
**Reason:** Progress is computed by a command, not reinterpreted by a model.
**Proof:** `node --test bin/progress.test.mjs`, `node --test bin/lib/progress.test.mjs`
**Discarded:** A published page. Editing checkboxes from the command.
**Today:** `bin/progress.mjs`, `bin/lib/progress.mjs`, `bin/lib/progress-pace.mjs` (progress --pace), `js-harness progress`

### The status report

**Problem:** On 2026-10-20 the owner asked the lead how the work was going and got two lines; he asked for a protocol so the answer carries everything since the last report, in detail, and what the lead proposes (`odd/tasks/status-report.md`, S1).
**Requirement:** A command prints, since a cut, the pull requests merged into the default branch with their commits, each session's last notice, the questions answered and still open, and the roadmap phase by phase with what is left. The cut is a given time, else the last report recorded, else the last day; reading writes nothing, and `--mark` records the report's time and the default branch's commit as a line of the channel record, from which the next report lists what that branch gained; a report a section of which could not be read is not recorded. The orchestrator skill tells the lead to answer from it in six sections.
**Reason:** "Since the last report" is a time read from a file, not a guess, and the facts come from git and the record, not from a model's memory of the day.
**Proof:** `node --test bin/report.test.mjs`, `node --test bin/lib/report.test.mjs`, `node --test bin/lib/manifest.test.mjs`
**Discarded:** `progress --since`: `progress` counts checkboxes and runs no git without `--pace`. The report's time as a notice: a notice to the orchestrator wakes its own wait. Marking on every read: a report looked at and not given would hide its facts from the next one.
**Today:** `bin/report.mjs`, `bin/lib/report.mjs`, `js-harness report`

### Onboarding

**Problem:** A project set up with `init` had no plan, and js-harness's own was made by hand (pre-plan, then roadmap); his request of 2026-10-19 asks for the pre-plan and the plan to be made with the AI when the harness is installed (`odd/tasks/onboarding.md`).
**Requirement:** The session the owner talks to writes, from a guided conversation in which it advises each area of the project's kind, its decision records (`docs/adr/`), an onboarding document, a pre-plan (`docs/origin.md`) and a roadmap (`docs/ROADMAP.md`) that `progress` reads; the command calls no model, writes skeletons that never overwrite a file, prints the hashes an approval records, and checks statically that the roadmap carries the pre-plan's phases and open decisions, that each phase's done-when names a command, that both approvals hold the files as they are, that both reviews ran, and that `AGENTS.md` points every session at the roadmap. With no verb it prints the stage the onboarding is in, read from the files and git alone, so any session resumes it, and names the branch and worktree of one in progress elsewhere; once onboarded it hands off to the build orchestrator with the lead's opening prompt the orchestrator skill gives; `init` points a project with no roadmap at it. `onboard profile` prints the advice the session gives from, by kind of project, one area at a time, each bar target with its source and its measuring command, and a shape test holds every kind to the same parts.
**Reason:** Work follows the objective and the plan (principle 7), so a project starts from a plan the owner approved, and its shape is held by a check, not by a model's memory.
**Proof:** `node --test bin/onboard.test.mjs`, `node --test bin/lib/onboard.test.mjs`, `node --test bin/init.test.mjs`, `node --test bin/lib/profiles.test.mjs bin/lib/profiles-data.test.mjs`
**Discarded:** A model called by the command: an interview needs the owner in the loop, and spend from a hidden child is not seen. A skill of its own: every turn would pay for it.
**Today:** `bin/onboard.mjs`, `bin/lib/onboard.mjs`, `bin/lib/profiles.mjs`, `bin/lib/profiles-data.mjs`, `js-harness onboard`

### The throughput review

**Problem:** The 2026-10-17 measure of where a task's wall-clock goes took hand-written scripts in the lead's notes, and its gate figures could not be taken again a few days later: the gate log rotates in about 2.3 days, so a before/after comparison had nothing to read (`odd/tasks/throughput-review.md`).
**Requirement:** A read-only command prints a fixed table of a window of UTC days in which every figure names its source, and a fact no record holds yet says which recorder it waits for, never a zero. A settled day's gates are kept in a dated snapshot under the home, which the table reads in place of the rotated log; append-only records are read live.
**Reason:** A measure taken again the same way is what tells a change that helped from noise, and it cannot depend on someone keeping scripts.
**Proof:** `node --test bin/throughput.test.mjs`, `node --test bin/lib/throughput.test.mjs`
**Discarded:** Snapshotting main's history and the Codex runs, which are append-only: a snapshot would freeze what a stale fetch had not seen. GitHub's `mergedAt`, which needs the network on every read.
**Today:** `bin/throughput.mjs`, `bin/lib/throughput.mjs`, `js-harness throughput` (with snapshot, status, reviewed and shipped)

### The stretch

**Problem:** Before an absence the lead wrote by hand what would run and for how long, and on the user's return a report by hand: nothing checked the goals, nothing measured the time against the estimate, and the next estimate learned nothing (the user's words of 2026-10-28, `odd/tasks/stretch-protocol.md`).
**Requirement:** A stretch opens from a plan whose goals are commands and whose items are one session's work each; the departure says whether the queued work fills the hours, each estimate corrected by the last stretches; the open stretch is measured from the records (each item's span, its failed gates as lost time, what no record holds named); the close checks the goals and records estimate against real by kind, which the next opening reads. The departure and the return are rendered from the command's JSON.
**Reason:** A goal graded by the session that ran it, or a time guessed after the fact, is a claim; read from the records it is a measure the next plan can learn from.
**Proof:** `node --test bin/stretch.test.mjs`, `node --test bin/lib/stretch.test.mjs`, `node --test bin/lib/stretch-render.test.mjs`
**Discarded:** One correction for every kind (the user asked by kind; every kind together is the fallback until a kind has three items); measuring tasks by the commits that close them (an item is one session's work, as a session holds one feature); running the goals on every heartbeat (a gate as a goal would take the lock the sessions need).
**Today:** `bin/stretch.mjs`, `bin/lib/stretch.mjs`, `bin/lib/stretch-render.mjs`, `js-harness stretch` (with open, bind, status and close)

### The task contract

**Problem:** The host's `/goal` stops when a small model judges a condition from the transcript, so a condition in prose is judged by opinion (`odd/tasks/task-contract.md`). One effort setting covered design and build tasks alike, and nothing applied or printed it (`odd/tasks/effort-by-task.md`).
**Requirement:** A feature document opens with a contract whose done-when items are commands that exit 0; a contract with no command is rejected with the reason; one command runs them, one prints the `/goal` condition, and one prints each open task's effort and sub-agent models from the kind of work it names.
**Reason:** A feature's end is a set of commands that exit 0, not an opinion.
**Proof:** `node --test bin/contract.test.mjs`, `node --test bin/lib/contract.test.mjs`
**Discarded:** A contract as a second file beside the ODD document. A loop of the harness's own instead of the host's `/goal`.
**Today:** `bin/contract.mjs`, `bin/lib/contract.mjs`, `js-harness contract`

### The Codex review

**Problem:** The Codex review of each approved slice depended on the agent remembering, and nothing noticed a skip (`odd/tasks/project-init.md`). On 2026-09-29 every shell command of a review failed after a Codex update, and in 6 of 41 reviews the model never read the diff yet answered (`odd/tasks/codex-exec-review.md`).
**Requirement:** A command runs Codex's review of a range and records it only on evidence that the reviewer read the diff (a completed turn, and every changed line of the patch in the output of its successful commands), never on its wording; an explicit skip is recorded with its reason; the pre-push hook refuses a push whose code commits no record covers, and a push whose head is a Codex review that owes a correction never rechecked (a recheck that left findings open passes with a warning; `check --push`, `bin/check.mjs` `correctionOwed`). A merge of the default branch, or of a stacked base whose own code commits each have a record (`odd/tasks/gate-first.md`, T7), is reviewed by what was written in it: at HEAD as the range, and below HEAD, after code commits that each have a record, in a turn of its own before the commits after it, where two turns cost less than one review (`odd/tasks/merge-below-head.md`).
**Reason:** A second reviewer after gentle-ai, and a skip must be explicit, never silent.
**Proof:** `node --test bin/codex-review.test.mjs`, `node --test bin/check-codex-reviews.test.mjs`, `node --test bin/pre-push-hook.test.mjs`, `node --test bin/lib/codex-reviews.test.mjs`
**Discarded:** The Codex plugin's review: it passes no per-thread setting and returns only text. Reading gentle-ai's or the plugin's own state as the record: pruned, opaque and free to change.
**Today:** `bin/codex-review.mjs`, `bin/lib/codex-reviews.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/lib/codex-review-turns.mjs`, `.githooks/pre-push`, `js-harness codex-review`

### The Claude lens review

**Problem:** One review by a second model is not enough: he asked for Claude's own review as well, on every slice (G9, 2026-10-26: "revision siempre ... una segunda opinion con un segundo modelo pero tambien una revision del mismo claude"). gentle-ai's four lens prompts were worth keeping, but they read only what gentle-ai's provider builds, and gentle-ai leaves at F8's S2 (`odd/tasks/f8-s1-reviews.md`).
**Requirement:** A command runs one to four Claude lenses the session picks by consequence (risk, resilience, readability, reliability) over a commit range, each a fresh tool-less `claude -p` on the user's CLI login, never the eval token, reading only the packaged range: its two commits, a subject hash of its patch, the paths a review reads and each path's patch. A result counts only when it echoes the hash and inspected every path; a run with an incomplete lens is recorded and covers nothing; an explicit skip is recorded with its reason.
**Reason:** Codex is the second opinion; the lenses are Claude's own criterion, recorded so a check can hold it.
**Proof:** `node --test bin/lens-review.test.mjs`, `node --test bin/lib/lens-candidate.test.mjs`, `node --test bin/lib/lens-result.test.mjs`, `node --test bin/lib/lens-reviews.test.mjs`
**Discarded:** Installing the prompts as agents under `~/.claude/agents`: a second copy no runner reads. `--bare`: it reads only an API key, never his login. gentle-ai's refuter and judgment-day agents: the lens findings go to the session and Codex is the second opinion.
**Today:** `bin/lens-review.mjs`, `bin/lib/lens-candidate.mjs`, `bin/lib/lens-prompts.mjs`, `bin/lib/lens-result.mjs`, `bin/lib/lens-reviews.mjs`, `js-harness lens-review`

### The Codex meter

**Problem:** No command read Codex's rate limits, so the five-hour window, the weekly one and the reset credits could be seen only in the app (`odd/tasks/launch-audit/b.md`, C-b-37). The owner's note `codex-meter-is-readable.md` named a scratchpad script that no longer exists; `grep -rn "rateLimits\|rate_limits\|app-server" bin --include=*.mjs` found no reader outside the release cleanup.
**Requirement:** A command reads the five-hour window, the weekly window and the reset credits left from the local `codex app-server` (`account/rateLimits/read`), without running a model, so without tokens. Each read starts one process and kills it on every outcome. It prints a line per window and the credits, or `--json` numbers; a field the answer lacks is unknown. It exits 1 with one line when codex is missing, does not answer within its timeout, answers with an error or exits first, and it never prints an account identifier.
**Reason:** The owner asked for the limits at the moment he looks, at no model's cost; the price he accepted is one process per read.
**Proof:** `node --test bin/codex-meter.test.mjs`, `node --test bin/lib/codex-meter.test.mjs`
**Discarded:** `rate_limits` from the rollout files `codex-usage` reads: they hold `null` in the sessions this repository ran. A flag of `codex-review --plan`: a read runs no review and writes no record.
**Today:** `bin/codex-meter.mjs`, `bin/lib/codex-meter.mjs`, `bin/lib/process-tree.mjs`, `js-harness codex-meter`

### The merge queue

**Problem:** Each merge made every other pull request's green run stale: 205 minutes of a 2,000-minute monthly allowance on 2026-10-14, and GitHub's merge queue is not offered for a private personal repository (`odd/tasks/merge-queue.md`).
**Requirement:** The queue builds the default branch plus each ready pull request merged in number order, naming each one left out and why. The default branch is read once a run: what origin's HEAD names, else what `gh repo view` names, and the queue refuses, naming both, when neither does. It tests the candidate on this machine under the lock and on one CI system, and when both are green moves the default branch to it by fast-forward, leased on the branch it was built from; a red batch is bisected to the pull request that broke it; after a land, each open pull request based on a branch that land merged is retargeted to the default branch (`gh pr edit --base`); the pre-push hook refuses a push of the default branch from anywhere but the queue. No CI runs for a pull request.
**Reason:** A second pusher makes the tested candidate a tree the default branch never was, and minutes are the scarce resource.
**Proof:** `node --test bin/merge-queue.test.mjs`, `node --test bin/lib/default-branch.test.mjs`, `node --test bin/lib/pull-request.test.mjs`, `node --test bin/lib/refresh-copy.test.mjs`, `node --test scripts/github-workflows.test.mjs`
**Discarded:** A GitHub Actions run on every pull request, with its bounds held by a test (`odd/tasks/drop-github-gate.md`). Windows on GitHub for each pull request: 22 billed minutes a run while the repository was private (it now runs once a day, "The daily Windows suite"). A self-hosted runner on the same machine: the same eight threads and the same lock. Merging on GitHub's side: it bypasses the hook.
**Today:** `bin/merge-queue.mjs`, `bin/lib/default-branch.mjs`, `bin/lib/pull-request.mjs`, `.github/workflows/gate.yml`, `js-harness merge-queue`

### Evals that discriminate

**Problem:** The predecessor's 32 tasks could not tell configurations apart: the bare configuration scored 94%, 30 of 32 at the maximum, graded by text rubrics (`odd/tasks/evals.md`).
**Requirement:** Tasks are graded by hidden tests copied in after the agent exits, in isolated homes that never touch the owner's memory, projects or review state, with auto-update and auto-memory off; tokens and time are recorded per trial with a clean stop on a cap; the verdict takes the score as the floor and lets cost decide between equal scores. Any spend is stated and approved first.
**Reason:** "Every component must earn its place" needs data, not opinion. F5 found the current stack 1.68x to 2.54x the minimal one's cost for the same score (`odd/tasks/evals.md`, "F5 result").
**Proof:** `node --test evals/runner.test.mjs`, `node --test evals/tasks.test.mjs`
**Discarded:** Text rubrics. A visible grader ("make these tests pass"). Discrimination by score alone.
**Today:** `evals/runner.mjs`, `evals/suite.mjs`, `evals/report.mjs`, `evals/home.mjs`, `evals/tasks`

### The future-model protocol

**Problem:** The founding plan's principle that each new model is tested against a smaller harness had no procedure (`docs/origin.md`), and F5 measured the stack at 1.68x to 2.54x the minimal cost for the same score (`odd/tasks/future-model-protocol.md`).
**Requirement:** A written procedure, read on demand, measures the payload, runs the evals, strips one component at a time and keeps what still earns its place; every spend is stated and approved before it starts; the setup is frozen during a run; each step names its command or its gap, and a step with an open gap does not run. This specification is the document it rebuilds from.
**Reason:** The bet that a stronger model needs a smaller harness is only a bet until each new model tests it.
**Proof:** `node bin/js-harness.mjs contract check odd/tasks/future-model-protocol.md`
**Discarded:** None recorded. Still open: nothing notices a new model (gap G7 of `docs/future-model.md`).
**Today:** `docs/future-model.md`

### The practice journey

**Problem:** On 2026-10-09 three defects were found on the owner's machine by accident: `install` acted on `--help`, the command on the path was an old copy, and `upgrade` could not work; no test committed through the hook init writes (`odd/tasks/practice-project.md`).
**Requirement:** One command proves a version in a project outside this repository, reached only through the installed command (install, init, a commit through the gate, sync, uninstall), everything under one folder, and checks after every run that the real home was not changed. Each capability that a project receives has a step in it.
**Reason:** Neither the tests nor using the harness on itself runs what a project receives.
**Proof:** `node --test scripts/practice-lib.test.mjs`
**Discarded:** Relying on the tests and self-use alone. Repairing defects inside the practice feature.
**Today:** `scripts/practice.mjs`, `scripts/practice-lib.mjs`

### Remote sessions

**Problem:** The owner could not open a new local session from the phone, and four attempts by hand on 2026-10-03 showed that the server must run in a plain environment, the command line must be signed into the phone's account, and the server exits after about ten minutes offline. Later its supervisor was killed from outside and nothing restarted it for about twelve hours, and its log reached 71 MB in two days (`odd/tasks/remote-control.md`).
**Requirement:** In any git repository one command keeps the host's remote-control server alive (start, stop, status; a second start refused), with no inherited host variables, sessions in the project folder and the user's own permission mode; its log is capped; an opt-in brings it back at login, with no window, and within five minutes whenever it died; a restart adds no session to the app's list; a plain stop stays stopped; every file or task written outside the repository is recorded and removed exactly. The doctor reports an account mismatch without printing either identifier.
**Reason:** The phone is the owner's main interface, and the facts a human learned by hand belong in a command. A process is killed only by its id and its creation time, because a kill by id alone once closed unrelated programs.
**Proof:** `node --test bin/remote.test.mjs`, `node --test bin/lib/remote.test.mjs`
**Discarded:** A login launcher alone: a killed supervisor stayed down twelve hours. Rotating the log by renaming it: the server holds its append handle, so it is trimmed in place. A watchdog that restarts after a deliberate stop. A `.cmd` login launcher: it opened a console at every login. Reattaching to the previous session with `--session-id` or `--continue`: on CLI 2.1.310 either turns the server into a single session and refuses `--spawn` (`odd/tasks/login-launchers.md`). Codex: it has no remote-control server.
**Today:** `bin/remote.mjs`, `bin/lib/remote.mjs`, `bin/lib/remote-launcher.mjs`, `bin/lib/process-tree.mjs`, `js-harness remote`

### Loops with owners

**Problem:** On 2026-10-15 the lead's loops were unversioned shell scripts; in one night a compaction left background tasks marked stopped while they lived on, a second lead killed the first one's loops because nothing said whose they were, and an update failed blind because a tool was not on the path under the host's shell (`odd/tasks/lead-tools.md`).
**Requirement:** A loop runs in the foreground of a background task under an owner record (the owner session, the process by id and creation time, its purpose, what ends it); a live loop of the same name is refused; a status lists live and stale loops; stop refuses a live loop another session owns unless taken over, kills the whole tree by identity and succeeds only when a second look finds nothing alive.
**Reason:** The end of a background task is what wakes a session, so a detached daemon would wake no one; process ids are reused fast; the host shell's path is not the user's.
**Proof:** `node --test bin/loop.test.mjs`, `node --test bin/loop-bodies.test.mjs`
**Discarded:** Compare-and-remove of a stale record by moving it aside: a third session could claim the freed name, so a lock per name replaced it. One-shot jobs as loops.
**Today:** `bin/loop.mjs`, `bin/lib/loops.mjs`, `bin/lib/stall.mjs` (the stalled work sessions that the heartbeat names and the board lists, from the session-stall rule), `js-harness loop`

### Waiting and waking

**Problem:** On 2026-10-14 nothing ran for seven hours while sessions waited; twice a session near compaction ended its turn waiting with nothing to wake it, because the host compacts only inside a turn (`odd/tasks/pause-no-idle.md`); after a restart the lead woke seven sessions by hand and each re-armed its waits from memory (`odd/tasks/boot-wake.md`); on 2026-10-16 a session waiting on a pull request read five of the lead's notices hours late (`wait-blind-to-notices`, `docs/FAILURES.md`).
**Requirement:** A wait ends with one line when its one condition holds (a pull request merged, the default branch holding a commit or a text, a notice for a role), says what it waits for and when it ends, and gives up with exit 1 after a bound. A work session's wait also ends, with exit 3, on a notice to that session's own number, and names the same wait to run again. After a boot, a command lists the sessions open in the hours before it with the command for each stored opening and the waits the boot killed, leaves each a note and the orchestrator the list to wake, once per boot, and a channel record or openings folder that is there and cannot be read makes it exit 1 with a line on standard error: it still lists the sessions and records no note; an opt-in runs it at each login through a recorded startup file that uninstall removes.
**Reason:** A background task that ends is the only thing that wakes an idle session, and nothing can push a prompt into one; so the harness leaves notes and the orchestrator wakes sessions.
**Proof:** `node --test bin/wait.test.mjs`, `node --test bin/wake.test.mjs`, `node --test bin/lib/wake.test.mjs`, `node --test bin/lib/startup-file.test.mjs`
**Discarded:** Ending a turn idle while waiting for a message, an event or the compaction. Pushing a prompt into an idle session from a command: no path exists. Recording each wait as it is armed: waits are read from the transcripts.
**Today:** `bin/wait.mjs`, `bin/wake.mjs`, `bin/lib/wake.mjs`, `bin/lib/startup-file.mjs`, `js-harness wait`, `js-harness wake`

### What the app opened out of sight

**Problem:** Sessions opened through scheduled tasks landed outside the owner's sidebar; his words (transcript `130317af`, lines 3443 and 3549): "no debes abrir sesiones en otra parte que no sea aca", "Tenemo que encontrar una forma que esto no vuelva a pasar" (`odd/tasks/session-channel.md`).
**Requirement:** A read-only command names as a failure an enabled scheduled task that runs in this project and a session of the project that a schedule opened and that is not archived; a disabled task, a leftover folder or a session a command of the harness opened is information; a location it cannot read is a failure line, never a pass. The guard refuses the tools that open such sessions where the project's rules say so.
**Reason:** A session opened there runs where the owner does not see it; the app's files are undocumented, so they are read as optional.
**Proof:** `node --test bin/unseen.test.mjs`, `node --test bin/lib/app-record.test.mjs`
**Discarded:** A row of the gate: a failure on one machine would block every commit until the owner cleaned up. Reading every transcript at each session start: about 11 s.
**Today:** `bin/unseen.mjs`, `bin/lib/app-record.mjs`, `js-harness unseen`

### Memory hygiene

**Problem:** The host's memory files cost 34,485 tokens on every turn of every session; the index grew from 233 to 10,917 characters in 18 days, 36 of 41 lines over the host's limit of about 150 characters, and 37 of 42 notes were rules living where nothing acts (`odd/tasks/memory-hygiene.md`).
**Requirement:** Memory holds only facts of the machine, and its index stays within its limits by itself. A sensor says when a pass is due (the index over its size, a line too long, a link to nothing, a new rule note, a week with notes written since). A pass is planned (a lock, a snapshot, the files it may touch), verified (it refuses a file outside that set that changed, a lost quotation of the owner's, an unapproved deletion, an index line that lost a number) and undone exactly while keeping what others wrote; its lock, snapshots and journal live under the harness's home, never in the memory folder.
**Reason:** The index is read on every turn, so every byte is paid always; and only `AGENTS.md` and the commands hold the harness's rules.
**Proof:** `node --test bin/memory.test.mjs`, `node --test bin/lib/memory-hygiene.test.mjs`, `node --test bin/lib/memory-pass.test.mjs`, `node --test bin/lib/memory-rules.test.mjs`
**Discarded:** Cleaning without prevention: the guard refuses a long index line when it is written. Telling the session through the doctor's message: it reaches the person, not the model.
**Today:** `bin/memory.mjs`, `bin/lib/memory-hygiene.mjs`, `bin/lib/memory-pass.mjs`, `bin/lib/memory-rules.mjs`, `js-harness memory`

### Counting sub-agents and auditing claims

**Problem:** Sub-agents were said to take about 59 per cent of a day's tokens, a figure in no file; the first count found 19 per cent of input (`odd/tasks/effort-by-task.md`). Sessions stamped wrong hours in 33 of 153 messages and stated 93 of 267 of their own context shares wrong over three days (`odd/tasks/honesty-audit.md`).
**Requirement:** One command counts a day's sub-agents by role, model and effort asked and run, with their tokens and share of the day, across the main checkout and every worktree. Another counts, per session, the claims a transcript itself can check (a message's stated hour against its own time; a stated context share against the one its reply records) and prints each wrong one by transcript and line. Neither keeps or prints the text of any message.
**Reason:** What to launch and measure comes from a count, not a guess; and each audited claim has its answer in the transcript, so no reader has to judge it.
**Proof:** `node --test bin/subagents.test.mjs`, `node --test bin/lib/subagent-count.test.mjs`, `node --test bin/audit.test.mjs`, `node --test bin/lib/audit.test.mjs`
**Discarded:** A general honesty audit: a transcript reader reaches 2 or 3 of the 14 recorded cases. Keyword rules for hours and shares: precision of about 8 and 33 per cent.
**Today:** `bin/subagents.mjs`, `bin/lib/subagent-count.mjs`, `bin/audit.mjs`, `bin/lib/audit.mjs`, `js-harness subagents`, `js-harness audit`

### The guard

**Problem:** Sub-agents ran on models the owner's rule of 2026-10-10 did not allow; hours were wrong in 33 of 153 messages; backticks inside double quotes ate a command's name; two whole test runs beside a gate both missed their bounds; memory index lines reached 844 characters; 93 of 267 stated context shares were wrong (`odd/tasks/honesty-audit.md`, `odd/tasks/test-run-warning.md`).
**Requirement:** A hook before each tool call refuses, with the host's deny and a reason: a sub-agent on a model the project's rules do not give (only where those rules are in force), a message to another session whose stated hour is more than a minute off the clock (after its label, or first, before it), a document hour ahead of the clock, a shell command with backticks inside double quotes, a test run of several files, or of the whole suite (`node --test` or `npm test`), outside a gate's turn while another gate holds the lock, a `js-harness sessions` read of the board (`--watch` too) in the same case, a command for the user's Terminal panel (`run_in_terminal`) with no note at its end saying what it does, four words or more, where the project declares the rule `terminal-note`, a line over the limit in a memory index, a feedback note of a memory folder that names no home of its rule where the project declares `memory-feedback-home`, the tools that open sessions out of sight where the project says so, a `start_session` with a brief that names no effort or one above the project's `session-effort` rule where that rule is declared (a fork included), a `start_session` whose title is not `<code> <n> · <purpose>` (or `<code> ORQ · <purpose>` for a new lead) with the project's own code, harness.json `"code"`, where the project's `session-title` rule is declared, naming the next free number (one past the highest of that code in the project's channel and openings, also printed by `js-harness sessions --next-number`), or saying to declare the code where the project declares none, a recursive `rm` or `rmdir` of a drive's root or of a folder at its top, and a gentle-ai review (`assess`, `status`, `start`) whose `--base-ref` is off the head's first-parent line. A stop hook turns the stop back when a reply states its own context share more than 2 points from the recorded one, and never loops. Both write nothing and always exit 0, so an older copy can never block.
**Reason:** Each rule had a measured failure and the owner's order to refuse it; a refusal at the call is the one reader every call meets.
**Proof:** `node --test bin/guard.test.mjs`, `node --test bin/lib/guard.test.mjs`, `node --test bin/lib/session-title-guard.test.mjs`, `node --test bin/lib/test-run-warning.test.mjs`
**Discarded:** Reading effort: a hook before a tool call cannot. Taking back a reply with a wrong share: impossible; turning the stop back is the nearest. A warning instead of a refusal for test runs. The first backtick detector: 20 hits for 1 real.
**Today:** `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/test-run-warning.mjs`, `bin/lib/memory-index-guard.mjs`, `bin/lib/document-hour-guard.mjs`, `bin/lib/session-title-guard.mjs`, `bin/lib/memory-feedback-guard.mjs`, `js-harness guard`, `claude-guard-hook`, `claude-share-hook`

### The permit relay

**Problem:** The host asks the user before some tool calls even in bypass mode, and the session waits in its own window: on 2026-10-17 five sessions waited 12 to 38 hours on such cards while the owner was away.
**Requirement:** While the orchestrator holds the relay, a permission card of another session reaches it first and waits up to 570 seconds for its explicit allow or deny; with no verdict, no orchestrator, the orchestrator's own card or any failure, the card reaches the user as before. Nothing is allowed by a rule. Only the session holding the relay gives a verdict, and that is a convention between cooperating sessions, not a credential: the check reads the caller's session id from its environment and the holder's from `lease.json` in plain text, which any process of the user can read and set, and README says so (launch audit C-b-3).
**Reason:** The owner's order of 2026-10-18 (odd/tasks/held-sessions.md, S8): the orchestrator judges what each card asks and lets the safe ones proceed. The host's `PermissionRequest` hook is the one documented way to answer a card for the user.
**Proof:** `node --test bin/permit.test.mjs`, `node --test bin/lib/manifest.test.mjs`
**Discarded:** A hook that allows by a fixed list of safe paths (S7: the owner chose the orchestrator's judgment). Answering a card already on screen: the host gives a session no tool for it.
**Today:** `bin/permit.mjs`, `js-harness permit`, `claude-permit-hook`

### The context pause and the inbox

**Problem:** Of 13 automatic compactions in 57 transcripts, three had no turn end between the pause and the compaction, and none wrote state to a feature document after the pause (`odd/tasks/session-channel.md`). Sessions at the pause ended turns idle and were never woken (`odd/tasks/pause-no-idle.md`). On 2026-10-14 the lead hit the host's cap of ten messages to other sessions, and its note waited until the session looked.
**Requirement:** After every tool call of a session in a project with `harness.json`, a hook reads only the end of the transcript and, once per stretch between compactions, tells the session it passed the pause: write its state to the feature document, never end the turn idle, keep a declared wait running, never hand anyone a compaction command. At most once a day it says a memory hygiene pass is due. The notices for that session that it was not told are said once each. It is silent and cheap otherwise, ignores sub-agents' calls, and always exits 0.
**Reason:** The host compacts only inside a turn, so a reminder must arrive inside one; a model reads the hook's added context, not a message to the person; and a note must reach a session without a message, which the host caps.
**Proof:** `node --test bin/lib/pause.test.mjs`, `node --test bin/lib/inbox.test.mjs`, `node --test bin/resume.test.mjs`
**Discarded:** A notice at the end of a reply only: it misses compactions inside a turn. A cut of two blocks handed to the owner. A new hook entry for each notice: they ride this one.
**Today:** `bin/resume.mjs`, `bin/lib/pause.mjs`, `bin/lib/inbox.mjs`, `bin/lib/memory-hygiene.mjs`, `claude-pause-hook`

### The web fetch fallback

**Problem:** The owner's words: "muchas veces con el webfetch y websearch las pagina te tienen bloqueado al ser una ia". Measured on 2026-10-15: eight of nine pages blocked the host's fetch, a reader service read four and the browser three more, and three of four blocks of the reader came back as HTTP 200 with a challenge page (`odd/tasks/web-fetch-fallback.md`).
**Requirement:** After a fetch the site answered 402, 403, 429 or 503, or one that failed as a tool error, the session is told the next rung: the harness's own fetch, then the built-in browser. The fetch reads a public page through the reader service, reads the body for a block, and exits 0 with the page or 3 naming the next rung; it refuses a host that is not public, a URL with credentials or a query that names a secret, and sends no cookie and no key.
**Reason:** What was missing was knowing when to switch, and a status code alone takes a block for a page; the URL goes to a third party, so nothing of the owner's sign-ins may leave.
**Proof:** `node --test bin/fetch.test.mjs`, `node --test bin/resume.test.mjs`
**Discarded:** A tool with Python dependencies and cookie files on disk. A line in `AGENTS.md`. Trusting the reader's status alone.
**Today:** `bin/fetch.mjs`, `bin/lib/web-block.mjs`, `bin/resume.mjs`, `js-harness fetch`, `claude-web-failure-hook`

### The installed skills

**Problem:** No incident for the harness's own skill: it is the first component of install's design (`odd/tasks/install-update.md`). For the orchestrator's: on 2026-10-06 three failures in one afternoon came from no session seeing the others, and a session that led and built at once compacted twice in a day (`odd/tasks/session-board.md`). For the protocols: what to do when asking the owner for a decision, closing a reply, running something that costs, changing a rule, reporting a mistake and handing off lived only in memory notes and the lead's relief file, and two failures of the register owed their control to a place that did not exist (`odd/tasks/rule-hierarchy.md`, T7).
**Requirement:** Install writes, for each host, a skill that teaches the commands and the memory hygiene protocol, and a skill that teaches how several sessions share one project: the lead and the work sessions, where each thing lives, how questions reach the owner, the lead's commands and charter, a work session's notices and close, and a third that holds the eight protocols, each section opening with the incident it came for and its date and naming the rules it relies on by id, never restating them. They load on demand, and each is recorded and removed exactly.
**Reason:** A protocol that applies only in some situations loads on demand, while a rule for every reply needs a line in `AGENTS.md` and a check; the lead does not implement because reading code fills a context that has to last.
**Proof:** `node --test bin/lib/manifest.test.mjs`, `node --test bin/install.test.mjs`, `node --test bin/lib/protocols-skill.test.mjs`
**Discarded:** A watchman skill: replaced by a lead with a charter the owner decided. Six protocol skills: every installed skill's description is read on every turn. Teaching in a skill what a check now enforces. Asking the owner to compact a session.
**Today:** `bin/lib/manifest.mjs`, `bin/install.mjs`, `claude-skill`, `claude-orchestrator-skill`, `bin/lib/protocols-skill.mjs`, `claude-protocols-skill`

### What a session took from gentle-ai is ours

**Problem:** F8's S2 removes gentle-ai, and with it the output style that sets how a session talks, the skills that say how to cut a commit and split a large change, and, by its uninstall, the whole `permissions` object of the user's Claude settings (`docs/proposals/gentle-ai-reverse-engineering.md`, section 3; `odd/tasks/f8-s10-port.md`).
**Requirement:** Install writes, for Claude Code, an output style named `js-harness` (neutral Spanish with tú, no voseo, no persona; Claude Code's coding instructions kept) and two skills adapted from gentle-ai under our names, `js-harness-work-units` and `js-harness-chained-prs`, each recorded and removed exactly; the package ships the notices of what it ports, the Apache License 2.0 text among them. Install also holds the `permissions` object of the user's Claude settings: it adds the allow entry and the 24 denies gentle-ai writes where they are missing, puts back a `defaultMode` it adopted once that has gone missing and never invents one, and records only what it wrote, so uninstall takes out exactly that and never an entry it found; `doctor`'s `permissions` row names each entry missing. `guard` refuses a Read, Write, Edit, MultiEdit, NotebookEdit or Grep of a place those denies name, or of Claude Code's login file, whatever the settings hold and however the path is spelled (dot segments, doubled separators, an NTFS stream, trailing dots); and every clone's `.claude/settings.local.json` holds the `js-harness` style, recorded as a switch's keys are, and the denies its deny list lacks, added after the user's own entries and recorded one by one, so uninstall takes out only those. Install also writes, into the user's own `~/.claude/CLAUDE.md`, a small marked block of his Rules lines as his answer D7 left them, rendered again while unedited and his once he edits it, recorded and undone by uninstall, and it touches nothing else of that file (G12, question 99). A test pins the style's and the two skills' text by hash, so a change to what is shipped changes its pin in the same commit.
**Reason:** The owner's voice decision G10 ("la 7 la voz hazlo en neutro", 2026-10-26) and the order of F8: port first, remove last. Under gentle-ai's names install would write over gentle-ai's own files.
**Proof:** `node --test bin/lib/manifest.test.mjs`, `node --test bin/package.test.mjs`, `node --test bin/lib/permissions.test.mjs`, `node --test bin/lib/deny-paths.test.mjs`, `node --test bin/guard.test.mjs`, `node --test bin/lib/rules-block.test.mjs`, `node --test bin/lib/output-style.test.mjs`, `node --test bin/lib/ported-skills.test.mjs`
**Discarded:** Copying gentle-ai's persona or its 14 skills. Installing the skills for Codex, which only reviews here. Moving the first skills' text out of the engine, which would move 13 rules' phrases. Holding the denies as hook-style entries, whose engine does not remember an entry that was there before it, so uninstall would take gentle-ai's denies out of the user's settings.
**Today:** `bin/lib/output-style.mjs`, `bin/lib/ported-skills.mjs`, `claude-output-style`, `claude-work-units-skill`, `claude-chained-prs-skill`, `THIRD_PARTY_NOTICES.md`, `bin/lib/permissions.mjs`, `bin/lib/deny-paths.mjs`, `bin/lib/rules-block.mjs`

### The record of notices between sessions

**Problem:** On 2026-10-10 a finished feature sat undelivered for six hours: a session opened from the phone runs in another permission mode, and the app held its messages (the orchestrator's relief file, lines 58-61 and 143, as `odd/tasks/session-channel.md` cites them).
**Requirement:** Every notice between sessions is written by a command to one record per project, outside any repository, with the time read from the clock, the sender, the role it is for, its kind and one line of text. A notice that a pull request is ready carries its number, so the land reads whose pull request it is from the record and not from a branch. A text that stamps its own sending with an hour more than a minute off the clock is refused and nothing is written; an answer, which quotes the owner, is not held to it. A usage error writes nothing. The orchestrator learns of a notice by watching the record, never by depending on a message arriving. A session titled with another project's code writes to the record where that project's orchestrator last wrote, and is refused when no single record is found.
**Reason:** Messages between sessions can be held, can expire, or do not exist at all (Codex has none); a file every host can append to is the one channel all of them share. A session a lead starts in a new project, to onboard it, otherwise wrote where no orchestrator listens (JH 43, 2026-10-21).
**Proof:** `node --test bin/lib/channel.test.mjs`, `node --test bin/notify.test.mjs`
**Discarded:** The repository's git folder as the record's home: there is none outside a repository. Messages as the channel.
**Today:** `bin/lib/channel.mjs`, `bin/notify.mjs`, `js-harness notify`

### A finished session leaves a summary

**Problem:** On 2026-10-17 the owner asked that every session hand the lead a summary when it finishes, so the work can be reverse-engineered later, and that the lead always archive finished sessions (lead transcript e152c9d8, line 21112); the archiving had lived only in a memory note, and was not kept.
**Requirement:** A command prints the template of a session's summary, headed by its title and naming its file, `docs/sessions/<date>-<title-slug>.md`, where the slug is the one an opening's file name takes from the title. Its sections are one list that every check of a summary reads: the goal, the user's words that started the work, what was delivered, the decisions and whose, the failures and lessons, what is left and who holds it, and the cost. A session gives its work back with a closed notice that names that file, and the record keeps it; the command refuses a closed notice without one, and writes nothing while a section is missing or empty or while no branch on origin among its default branch, main and the session's own branch holds the file as it is. The board lists a session closed with its summary and not yet archived as `to archive`, naming the file, and the orchestrator skill tells the lead to read it and archive the session without asking, and tells a work session to write it before it closes.
**Reason:** A session's record is otherwise spread over its transcript, feature documents and notices, and a transcript is lost on a new session or a compaction; one committed file per session is what survives for the lead and for later study.
**Proof:** `node --test bin/summary.test.mjs`, `node --test bin/notify.test.mjs`, `node --test bin/lib/sessions.test.mjs`, `node --test bin/lib/manifest.test.mjs`
**Discarded:** A summary in the closed notice's text: a notice is one line, outside any repository. Requiring the summary of every closed notice the library builds: the record already holds closed notices without one.
**Today:** `bin/summary.mjs`, `bin/lib/summary.mjs`, `js-harness summary`, `bin/notify.mjs`, `bin/lib/sessions.mjs`, `bin/lib/manifest.mjs`

### A closed session whose process still runs is named

**Problem:** On 2026-10-18 the work session JH 20 sent its closed notice at 01:14Z, yet its Claude Code host process ran on for hours; the desktop app held it as running and refused to archive it, stopping its turn changed nothing, and only ending that process let the lead archive it (odd/tasks/harness-review.md, L50 and T12).
**Requirement:** The board's roster lists each session that closed or was relieved by its own notice, is not this session and is not archived, while a host process whose command line names it with `--resume` still runs: the session's title, when it ended, the process's pid and when it started, and that the app refuses to archive it until that process ends. The hosts come from the same process listing as the gates; when that listing cannot be read, the roster says the hosts were not read, wherever a closed session could still be running, and never reads it as no process running. `--json` gives each roster row its `host`, `{ pid, createdAt }` or `null`.
**Reason:** A session that said it closed but still runs costs a refused archive and the lead's time to find why; the process that holds it is on the machine and can be named.
**Proof:** `node --test bin/lib/sessions.test.mjs`, `node --test bin/sessions.test.mjs`
**Discarded:** Archiving or ending the process from the command: archiving is the desktop app's, and ending a session's process is the lead's decision, made with the line in front of it. A second process listing for the hosts: each look would start PowerShell twice.
**Today:** `bin/sessions.mjs`, `bin/lib/sessions.mjs`, `js-harness sessions`

### A role is the address, and there is one orchestrator

**Problem:** A notice reached an orchestrator that had been relieved: it was sent to the reply address of an earlier message, which belongs to a session and not to the role (relief file, line 78).
**Requirement:** A session's title, `<code> <role> · <what it does>`, is the address of its role. Asking for a role's address answers with the one other session that holds it (exit 0), none with every transcript read (exit 1), or that the answer is not clean (exit 2); it never counts the session that asks. A session takes the orchestrator's role only on "none", unless it is opened as a relief, and a handover goes through two titles that mark the new and the relieved lead.
**Reason:** A session ends or is relieved; a role continues.
**Proof:** `node --test bin/sessions.test.mjs`, `node --test bin/lib/sessions.test.mjs`
**Discarded:** A transcript's file date as liveness: the app appends untimed entries to old transcripts. Telling restarts apart by transcripts that overlap in time: a resumed session copies old entries.
**Today:** `bin/lib/sessions.mjs`, `bin/sessions.mjs`, `js-harness sessions`

### The board knows every session

**Problem:** Orchestrators rewrote the roster by hand in the relief file, and "no gate runs" was said while one ran (relief file, lines 122 and 172).
**Requirement:** The board is computed at each read and stored nowhere: every session with its role, purpose, worktree, permission mode, context size and room left, last activity and its last word in the record; the last notices and messages; each running gate with the session it hangs from; the open pull requests and the feature plans. A stopped task and an archived session do not read as live, and what the board cannot know is printed as such ("silent since"), never as alive. A watch mode returns only when the board changes in a way that needs a decision.
**Reason:** A list kept by hand is wrong the moment it is written.
**Proof:** `node --test bin/sessions.test.mjs`, `node --test bin/lib/sessions.test.mjs`
**Discarded:** The first line of a message in the channel section: the reader keeps no body, so the sender's summary is printed instead. "Held" as a state: no transcript shows it.
**Today:** `bin/lib/sessions.mjs`, `bin/sessions.mjs`, `js-harness sessions`

### A session the owner opens starts at once

**Problem:** An opening pasted with no line of the owner's own was not taken as his assignment, twice, the second time after 28 minutes of waiting (relief file, lines 129 and 175).
**Requirement:** The orchestrator stores a new session's opening as a file; the owner sends one short line of his own; the session prints its opening by its title, and the record keeps which session read which title, which gives a session opened from the phone, whose transcript carries no title, its title.
**Reason:** Pasted text is not the owner's word, and a file survives a compaction.
**Proof:** `node --test bin/notify.test.mjs`, `node --test bin/sessions.test.mjs`
**Discarded:** Pasting the opening. The orchestrator opening sessions through a scheduled task: it lands where the owner does not see it.
**Today:** `bin/notify.mjs`, `bin/sessions.mjs`, `bin/lib/channel.mjs`

### The lead starts a session on a turn he did not type

**Problem:** The desktop app's `start_session` starts a session only on a turn the owner typed; on a turn a notice, a background task or a compaction started, it leaves a card he must tap, so the lead waited on him for what he had asked it to do alone (his words of 2026-10-24: "Quiero que que puedas iniciarla sin el mensaje mio escrito").
**Requirement:** `js-harness sessions start --title --brief` starts the session with `claude --bg`, with Remote Control on unless `--no-remote-control`, a copy of the brief that ends by telling it to report through `js-harness notify --to orchestrator`, and the title and effort the rules `session-title` and `session-effort` hold `start_session` to, where they are declared. Each start is recorded under the harness home; `sessions stop <id>` removes a recorded session (`claude stop`, `claude rm`) and no other, and `uninstall machine` removes every recorded one not at work and fails while one is. The board lists the project's background sessions from `claude agents --json --all` with what each waits for, and a watch returns when one starts waiting. The lead uses it only where `start_session` would leave a card.
**Reason:** He asked the lead to start sessions itself, and a session the harness starts is undone exactly by the harness.
**Proof:** `node --test bin/sessions-background.test.mjs`, `node --test bin/lib/background.test.mjs`
**Discarded:** The brief as the prompt itself: a `.cmd` shim of the CLI runs through `cmd.exe`, which cannot carry a line break. Removing the transcript with the session: `claude rm` keeps it, as every session's is kept. Stopping a session at work from `uninstall`: its work would be lost unseen.
**Today:** `bin/sessions-background.mjs`, `bin/lib/background.mjs`, `bin/sessions.mjs`, `bin/install.mjs`, `js-harness sessions`

### The user follows the sessions on a live board

**Problem:** He watches several sessions at once and the harness was a black box to him; the lead republished a status page by hand (his words of 2026-10-27: "Esto se podria hacer de una forma dinamica para estar informado en tiempo real?").
**Requirement:** `js-harness sessions live` turns the channel record's notices the live board has not been sent into rows (time, session, kind, text, state), writes them with `--out <dir>` as batch files of one database document each with the `ArtifactData` call that sends one, and moves its cursor past a file with `--sent <file>`; the lead adds to each row a `sesion` and a `texto` in the user's language before it sends, since the record stays in English; with nothing sent yet it starts at the last `--hours` (24). Each `--out` also writes the time it read the record for `board/summary` (`checked`, and `until`, the lead's next wake: 45 minutes, or `wait-for` with `--resting`), sent after the batches and with no row to send too, and the page's header reads a recent row or a check that still holds as up to date: a quiet stretch reads as checked or resting, not as a board nobody keeps. The cursor and the board's link live under the channel's folder, which `uninstall` deletes.
**Reason:** Sessions already write every event as a notice, and only a Claude session can write an artifact's database, so the record is the feed and the lead the one writer (rule `live-board`).
**Proof:** `node --test bin/sessions-live.test.mjs`, `node --test bin/lib/live-rows.test.mjs`
**Discarded:** A hook that sends the rows: no hook or command reaches an artifact's database. Rewriting a session's status document on each event: a write to an existing document needs the version it was read at, so rows are only ever created.
**Today:** `bin/sessions-live.mjs`, `bin/lib/live-rows.mjs`, `bin/sessions.mjs`, `js-harness sessions`

### Each host update is reviewed in depth

**Problem:** A Claude Desktop update was recorded as reviewed after a check that nothing broke, with no account of what it brought (`docs/FAILURES.md`, host-review-without-research); he asked for a session that researches each release in depth and says how the harness should use it (F8's S9, question 129).
**Requirement:** `js-harness host-watch draft` cuts the update's span of the desktop and CLI changelogs, from the reviewed record to the versions doctor reads (or a frozen span), and prints the review file with one row an entry: each entry placed in every harness area it touches, an entry outside the Code tab decided `ignore`, every other `?`; a version with no entry is a row; a changelog older than the version reviewed is refused; `--sources` writes the span's excerpts. `host-watch check` holds a review file to the span read from its excerpts: one decided row an entry by its id, Windows and Phone `checked: <how>`, `unknown` or `n/a`, the hand list empty, the desktop tool list's status said. `host-watch tools` diffs the app's tool list, as a session transcribes it, with the one recorded for its surface (desktop, the only one given `start_session`, or background), a first capture a baseline. The gate of `doctor --host-reviewed` refuses a review whose hand list still holds entries.
**Reason:** The changelogs are long and most entries do not touch the harness; placing them keeps the session's reading on what does, and a check by entry id keeps one decided row from passing for a whole release.
**Proof:** `node --test bin/host-watch.test.mjs bin/lib/host-watch.test.mjs`
**Discarded:** Deciding `adopt` or `adapt` by pattern: a decision is a reading, and his yes in question 129 covers no adoption. Dropping Cowork entries unread: they default to `ignore` only when no harness area matches, and stay visible rows.
**Today:** `bin/host-watch.mjs`, `bin/lib/host-watch.mjs`, `bin/lib/host-update.mjs`, `js-harness host-watch`

### The machine says when nothing runs

**Problem:** The owner leaves the lead alone for 8 hours or more; once every session has finished the PC stays on for nothing, and a session that waits for him moves only when he answers (his words of 2026-10-25: "cuando no haya nada ejecutandose me avises para ver que en vez de dejandote trabajar solo pueda apagar el pc").
**Requirement:** `js-harness quiet` takes one look at the machine and says quiet (exit 0), busy (exit 1) or unknown (exit 3), with what runs: a session `claude agents --json --all` lists as busy, the gate lock's live holder and the gates that wait for it, a `merge-queue --land`, a `codex exec` or `codex-review` process. A session waiting on a permission prompt or a question is named as needing him and is not work; the session that runs the command (`--self`, else `CLAUDE_CODE_SESSION_ID`) is left out. A source that could not be read is never quiet. `quiet --wait` exits 0 once nothing has run for `--settle` minutes, with the last work it saw and what needs him, and exits 1 after `--for` minutes with no settle. The orchestrator skill keeps the wait running while he is away and sends him a push notification when it ends.
**Reason:** A quiet that is wrong turns off a PC with work on it, so every source is read by the board's own reader, and an unread one keeps the count from settling.
**Proof:** `node --test bin/quiet.test.mjs`
**Discarded:** Sending the notification from the command: the push notification is a tool of the host, which no command can call. Counting a waiting session as work: it never ends on its own, and the wait would never settle while it waits for him.
**Today:** `bin/quiet.mjs`, `bin/lib/quiet.mjs`, `bin/lib/process-list.mjs`, `js-harness quiet`

### The owner's words, when they travel

**Problem:** The owner decided on 2026-10-10 (relief file, line 149) that an answer he gives in the orchestrator's chat travels to the session that asked, with his exact words and where they are.
**Requirement:** Quoting a transcript line prints it only when the person sent it (typed, tapped as an answer to the question tool, or queued while the session worked); it exits 1 for a message of another session, a notification or an assistant entry, and warns when the text was only pasted. An answer notice carries the transcript and the line.
**Reason:** A message from another session is a claim, never the owner's word.
**Proof:** `node --test bin/sessions.test.mjs`, `node --test bin/lib/sessions.test.mjs`
**Discarded:** Taking another session's message as the owner's.
**Today:** `bin/lib/sessions.mjs`, `bin/sessions.mjs`

### Questions to the owner, through one place

**Problem:** His words in the lead's transcript `65318fd5`: "siempre hazme las preguntas como te pedi que me la dieras SIEMPRE tienes que cementarlo en el harnes" (line 12735) and "todas las preguntas de todas las sesiones me las haces aca" (line 13110).
**Requirement:** A question from any session is recorded first as a numbered notice with its text, options and what waits on it; its text is headed by its number; the orchestrator asks it with the host's question tool, one at a time. The board computes each question's state (not shown, on screen, closed unanswered, answered and not carried) from the record and the tool's calls. An answer is recorded with its number and checked against the asker's transcript; an unverified claim gives way to a verified answer. After a compaction the resume lists the open ones.
**Reason:** A question asked in a work session goes unseen; one asked twice costs the owner twice.
**Proof:** `node --test bin/lib/channel.test.mjs`, `node --test bin/notify.test.mjs`, `node --test bin/resume.test.mjs`
**Discarded:** Finding the orchestrator by its address to decide who asks: the address never answers about the asker. Recording an answer outside the project folder under the session id: it would read another file.
**Today:** `bin/lib/channel.mjs`, `bin/notify.mjs`, `bin/lib/sessions.mjs`, `bin/sessions.mjs`, `bin/resume.mjs`

### A compaction resumes from files

**Problem:** A compaction arrived with nothing saved (the owner's words of 2026-10-11, `odd/tasks/session-channel.md`, Progress 22:03).
**Requirement:** After a compaction, a session-start hook prints, read from files: the title, the stored opening, the feature document and whether it was written after the pause, and for one document the lines to read in it (its resume sections, the open task its first resume section names first, that task's specs and its last five log entries, each range with its size) and the mode of that task, the worktree's state, the work in flight, what the owner wrote, the messages of other sessions and the open questions; it tells the session to notify the orchestrator. After a clear, the same title, opening, feature document and questions are printed under a first line that says the session was cleared, with none of the compaction's lines: a clear is a new session with a new transcript, which the host reports as `startup`, and that start is a clear's only when the desktop app's record of the session names the session it was cleared from (`priorCliSessionIds`). It speaks only in a project with a `harness.json`, writes nothing and always exits 0. Installed for Claude Code.
**Reason:** The compaction's summary is not the record.
**Proof:** `node --test bin/resume.test.mjs`, `node --test bin/lib/feature-parts.test.mjs`, `node --test bin/lib/app-record.test.mjs`
**Discarded:** Trusting the summary. Naming the first unchecked task: in the two largest open documents it was stale (`odd/tasks/resume-open-task.md`).
**Today:** `bin/resume.mjs`, `bin/lib/feature-parts.mjs`, `js-harness resume`, `claude-resume-hook`

### A project declares which functions it runs

**Problem:** The harness prepared and charged for programming in every project: the code map's prompt hook fired on 33 of 55 real prompts here, 16 of them pasting about 4,000 tokens, often with no code intent (`odd/tasks/f2-context-diet.md`, T3). The owner's order (lead's transcript `65318fd5`, line 8250): "hagamos el harnes para que funcione con codigo y sin codigo ... osea que sea a demanda".
**Requirement:** Switches under `harness.json` "functions" (the code map, the language server, the Codex review) take on, off or auto, except that the code map takes auto, on-demand, always or off and refuses on (`bin/lib/functions.mjs`, `SWITCHES`); a missing key is auto and never an error. Auto resolves from the names of the project's files by a closed, positive list of program extensions and build files, and every resolution carries its reason. An unknown name or value is an error and reads as on; files that cannot be listed read as on. A person sees each switch, its value here and why; applying them makes the clone what they ask (the index, the push check, the keys of the clone's local settings), recorded so uninstall undoes it. The switches can be read from a commit as well as from the working tree, so a check reads the switches of the commit it judges.
**Reason:** The work itself, not a guess about it, says what it needs; the list is positive because by a negative rule a research project's data and papers would be "code". A check that could not look must not turn itself off.
**Proof:** `node --test bin/lib/functions.test.mjs`, `node --test bin/lib/project-functions.test.mjs`, `node --test bin/functions.test.mjs`
**Discarded:** A watcher of the conversation that flips a mode (the prompt hook above was one). Presets or a "kind" key: a second place that says what the files say and can disagree with them. Reading the switch from the remote's default branch so a branch cannot exempt itself: it trapped a person with no Codex plan, whose commit turning the review off is itself a code commit.
**Today:** `bin/lib/functions.mjs`, `bin/lib/project-functions.mjs`, `bin/functions.mjs`, `js-harness functions`

### A setting in a file the harness does not own is written and undone exactly

**Problem:** The code map's paste and the TypeScript plugin are turned off by keys in Claude Code's settings; here they had been set by hand in an untracked file no worktree had. The predecessor stack needed four hand-written purge scripts to uninstall (`AGENTS.md`).
**Requirement:** One key is written beside what is there, in the file's own indent, line endings and final newline, never over another value (that is a conflict, reported). Its record lets it be undone in any order, taking with the last key the objects, file and folder the harness made; a key changed since is kept; an unreadable file is a problem reported, never a crash. A manifest of a newer format is refused by uninstall and sync, which then touch nothing.
**Reason:** Whatever the harness writes into a file someone else owns must come out exactly, or uninstalling it costs a purge script.
**Proof:** `node --test bin/lib/settings-key.test.mjs`
**Discarded:** The tracked `.claude/settings.json`: written by a per-clone command it breaks the next checkout in every worktree, and one clone's uninstall would remove the key for all. A record of the earlier value: a key that held one is never written.
**Today:** `bin/lib/settings-key.mjs`

### Declared rules

**Problem:** The share of its context at which a session writes its state changed three times in two days (85, then 90, then 88), and each change was carried by hand to every place that stated it. The sweep of that day found 278 stale or contradictory statements in 247 places (`odd/tasks/rule-hierarchy.md`, "Why"). The owner's words: "Ese error con el 73% es un problema sistemico y repetitivo" (transcript `7d2ae675`, lines 1745 and 1822).
**Requirement:** Every rule is declared once, with an id, subject, owner, since date and exactly one body: a value with its unit, a text found by phrases, or retired with successors. A value lives only in its declaration; code reads it by id and unit, and a wrong unit or an unknown id throws. Every rule has a source: the owner's words at a transcript line, or a design path. The list page is rendered, never written by hand. A rule is changed by one command on a branch of its own. The check fails on a lost phrase, a read of an undeclared or retired rule, a missing source, a data file not in canonical shape, or a page that differs from its rendering.
**Reason:** If a rule lives in one place and nothing restates it, an old copy cannot stand beside the new one.
**Proof:** `node bin/js-harness.mjs rules check`, `node --test bin/rules.test.mjs`, `node --test bin/lib/rules.test.mjs`
**Discarded:** An index plus a list of retired phrases: two sample phrases caught 2 of 11 wordings, derived values escaped, and nothing forced the list to be written. "Declared beside its home", which is still two places. Storing the engine and date a rule was checked on: a mark written by hand can be false.
**Today:** `bin/lib/rules-data.mjs`, `bin/lib/rules.mjs`, `bin/lib/rules-check.mjs`, `bin/rules.mjs`, `docs/rule-sources.json`, `docs/RULES.md`, `js-harness rules`, `bin/lib/rules-reach.mjs`, `claude-rules-turn-hook`, `claude-rules-start-hook`, `claude-rules-subagent-hook`

### A project's own rules

**Problem:** The harness held one list of rules, the one it ships. A project that only installs it had no place to declare a rule, and nothing read one, so a project's rule lived only in prose nothing checked (`odd/tasks/rule-hierarchy.md`, the ninth difference). The owner asked that each installed project have "su propio roadmap y arquitectura y ademas de specs".
**Requirement:** An installed project declares its rules in one file it owns. Each rule has an id, a subject, a since date and one body: prose (a file and phrases that must stay in it), a sensor (a name the project still declares) or retired (with successors). Every commit is refused when a phrase leaves its file, a sensor is no longer declared, a failure id is not in the register, or a rule present at HEAD is gone, including by deleting the whole list. An id the harness also ships is a note, never a refusal. The harness never writes the list.
**Reason:** A rule nobody can name is a rule nobody can hold, and the gate is the one reader every commit meets. Rules are retired, never deleted, so a constraint never disappears in silence; leaving the list to the project keeps uninstall exact.
**Proof:** `node --test bin/lib/project-rules.test.mjs`, `node --test bin/lib/project-rules-read.test.mjs`, `node --test bin/rules-project.test.mjs`
**Discarded:** Values and overrides of the harness's rules from a project: no reader knows its project, two of them guard spend, and the context pause is the owner's. A pattern engine for rules about code: a sensor in any language does it. Judging a stale list by its bytes: a checkout under `core.autocrlf` rewrites them.
**Today:** `bin/lib/project-rules.mjs`, `bin/lib/project-rules-read.mjs`, `bin/rules.mjs`, `bin/check.mjs`, `bin/update.mjs`

### The failures register

**Problem:** Failures were numbered by hand in two places that already disagreed, and nothing counted them (`odd/tasks/rule-hierarchy.md`, "The failures register"). The owner asked for "una forma de guardar logs de fallos o informacion erronea para poder llevar un registro y poder hacer correciones a futuro y ver que tan repetitivo hacemos algo" (transcript `7d2ae675`, line 1360).
**Requirement:** One record, sorted by id. Each entry has a declared class, one line per sighting, and a control that is absent, owed (a phrase of an unchecked task) or in place (a phrase a file must hold). The state is computed, never written. The gate's row refuses only faults the register itself shows; states that depend on other files are counted and listed. A settled check exits 1 while an entry is unsettled.
**Reason:** Each mistake is tied to what corrects it, and how often each comes back is visible. Refusing a state that changes with no author would block a bystander.
**Proof:** `node bin/js-harness.mjs failures check --settled`, `node --test bin/failures.test.mjs`, `node --test bin/lib/failures.test.mjs`
**Discarded:** Numeric ids: two branches take the same next number. Order of time: it conflicts at the file's end. A written state field. A row that refuses unsettled states: it would be obeyed by not recording sightings. Failing by the calendar.
**Today:** `docs/FAILURES.md`, `bin/lib/failures.mjs`, `bin/failures.mjs`, `js-harness failures`

### The Codex review's allowance

**Problem:** Three of the owner's rules set what a review may cost without asking him; nothing read them, and each session did the sum by hand, differently (`odd/tasks/rule-hierarchy.md`, "The Codex review's allowance").
**Requirement:** The review's plan adds one line: the allowance is the larger of a floor and a rate times the changed lines of the files the review reads. The verdict is on the estimate, in whole numbers: inside, over within the margin (which counts as inside), over, or no estimate. No line where the project does not declare the rules. The exit stays 0, and a run never prints the line.
**Reason:** Every session gets the same sum, and only this project's rules are shown as its rules. The figure that decides was the owner's: "Dejarla como está" (lead's transcript `65318fd5`, line 8668).
**Proof:** `node --test bin/lib/codex-review-allowance.test.mjs`
**Discarded:** Refusing a run for its cost, with a flag to pass it: not built. The higher figure deciding: it would ask the owner more often.
**Today:** `bin/lib/codex-review-allowance.mjs`, `bin/codex-review.mjs`, `bin/lib/rules-data.mjs`

### The README held to the dispatcher

**Problem:** No incident. The owner's answer "Una página y cada comando" (lead's transcript `65318fd5`, line 10979), with the order that a test hold the README's commands to the dispatcher's, so it cannot go stale silently.
**Requirement:** Under "Commands", exactly one section per command of the help, in the same order and no other, each with a fenced example from a real run; "Install", then "Remove", then "Commands". Headings inside fences are not headings of the page. Every command answers `--help` (or `-h`), given alone, with its usage line and exit 0, and runs nothing. A user guide, `docs/GUIDE.md`, linked from the top of the README, takes a new user from the install to a working project.
**Reason:** A command added, renamed or removed without its section fails a test instead of going stale.
**Proof:** `node --test bin/readme.test.mjs`, `node --test bin/js-harness.test.mjs`
**Discarded:** None recorded.
**Today:** `README.md`, `docs/GUIDE.md`, `bin/readme.test.mjs`, `bin/js-harness.mjs`

### A process is named by the image it runs

**Problem:** The port and process helpers named a POSIX process by its main thread's name, which a program sets; on Linux Node v24 answers `MainThread`, so a Node listener was "not node" and left alone (Linux run 38296748258, `evals/ports.test.mjs`), and any process could take another program's name.
**Requirement:** On Linux a process's name is the basename of the image it runs (" (deleted)" stripped); the printed name serves only where that link cannot be read; no other system is asked for the link.
**Reason:** The name decides what may be killed.
**Proof:** `node --test evals/ports.test.mjs`
**Discarded:** The first word of the arguments: a process sets it itself. `ps -o exe=`: not in every `ps`. Still open: a target launched through a wrapper script is named by its interpreter.
**Today:** `evals/ports.mjs`

### The gate's report reaches its reader whole

**Problem:** On Linux a failed gate's log stopped mid-line after 523 passing tests, with no failure and no summary (run 38504042140): the gate printed and exited at once, and on POSIX a write to a pipe is asynchronous. Windows writes pipes at once, so the owner's machine never showed it.
**Requirement:** The gate exits only after standard output and then standard error have taken everything printed; the exit stays immediate after that, and a stream whose reader is gone still ends in the exit with the gate's code.
**Reason:** A red gate whose failures cannot be read cannot be fixed; and a process a sensor left running must never keep a finished gate alive.
**Proof:** `node --test bin/check-exit.test.mjs`
**Discarded:** Setting the exit code alone and waiting for the natural end: a leftover process would hold the gate open.
**Today:** `bin/check.mjs`, `bin/check-exit.test.mjs`

### A host loads what was installed

**Problem:** The practice journey installed the harness into a stand-in home and a small project, committed and uninstalled, but started no host session, so nothing proved that Claude Code loads the skills, `AGENTS.md` and the hook entries it was given (defect f of 2026-10-13). A broken hook entry or an unread skill would pass every other check.
**Requirement:** Before a release, one run of the journey starts a real host session in the practice project, under a home of its own, and shows from the host's own stream that it lists both installed skills, answers a word only `AGENTS.md` holds with no file tools, runs every session-start and after-tool hook entry with the practice copy of the command, runs the rules hook at a turn, a compaction and a sub-agent's start, and leaves no trace in the real home. A host that cannot answer (a cap, a login, a timeout) is told apart from a fault of the harness, and the spend of every call is recorded. The push of a version tag is refused without a whole pass of that run on the tagged commit (every step, the host session included, on a clean checkout of that commit): the pre-push hook runs `scripts/release-gate.mjs` for a `refs/tags/v*` ref, and the practice folder is named by `JS_HARNESS_PRACTICE_ROOT`, with no default.
**Reason:** Every other check reads files; only a host session proves the host reads them. It spends a model, so it is small (four calls on the cheapest model) and can be turned off.
**Proof:** `node --test scripts/practice-host.test.mjs`, `node --test scripts/practice-lib.test.mjs`, `node --test scripts/release-gate.test.mjs`, `node --test bin/pre-push-hook.test.mjs`
**Discarded:** Telling the hooks apart by their command: the stream carries none. Proving the sandbox by a new projects folder: an earlier session leaves one. The model alias: it may resolve to an older model, so the model is named. Not proven: that Codex loads its hooks and skills.
**Today:** `scripts/practice.mjs`, `scripts/practice-lib.mjs`, `scripts/release-gate.mjs`, `.githooks/pre-push`

### The reply check

**Problem:** `AGENTS.md` asks every reply to end with one of five states (working, decision, question, cut, finished; the question since 2026-10-23, after an onboarding session that waited for the owner's written answer closed as working, `odd/tasks/reply-question-state.md`), because the owner often answers from his phone by tapping the suggested prompt and reads only the last lines; the rule acted only through each session's memory, and replies closed with no state, with two, with a decision asked while work ran, or with a block to send outside a cut (`odd/tasks/rule-hierarchy.md`, C1). Work sessions also ended their turns holding handed work with nothing armed to wake them: 31 turn ends followed by more than 30 minutes of silence in two days (`odd/tasks/wake-and-flag.md`, S2).
**Requirement:** Where the nearest `harness.json` asks for it, a stop hook reads the reply that ends a turn and turns it back, with the shape to follow, when it does not close with exactly one state in the labels the project names, or when that state lacks what it needs: working says what wakes the session, a decision is never asked while background work runs, a question (an open one the owner answers in writing) is written on its line and never asked while background work runs, a cut carries exactly one block of only what the owner sends under its three labels, finished names the session to return to. Anywhere else it answers that the session may stop; a `harness.json` that is not JSON is said on standard error, never taken for a project that did not ask. It writes nothing and always exits 0. It also turns back, once a handing, a work session that ends its turn holding work the orchestrator handed it (a notice to its number or its opening, not given back by its own closed or relieved) with nothing running in its background and no cron of its own, naming the wait to arm; a later background task that has ended allows it again. It turns back a reply that hands the owner a shell command in a fenced block not tagged for his platform's shell, not run with success by the session first (each command word for word, a run proving only what its exit proves), or rejected by his shell's parser; a block marked `ran` is evidence matched to a run whatever its exit, one marked `own` is his alone and parsed instead (`odd/tasks/f8-lead-rigor.md`, S1).
**Reason:** A rule that only memory holds is the failure the rule hierarchy exists to end; a stop hook is the one reader every reply meets. It acts only where a project asks, so installing it changes nothing elsewhere.
**Proof:** `node --test bin/lib/reply.test.mjs`, `node --test bin/reply.test.mjs`, `node --test bin/lib/reply-commands.test.mjs`
**Discarded:** A check of the cut's resume prompt and `/compact` shapes: the owner never compacts by hand any more. Naming the owner's open items in the reply: the board already computes them.
**Today:** `bin/lib/reply.mjs`, `bin/lib/reply-commands.mjs`, `bin/lib/stop-wake.mjs`, `bin/reply.mjs`, `js-harness reply`, `claude-reply-hook`

### The memory survives the machine

**Problem:** The owner's machine is slow and he cleans it with PC Manager; a past cleanup lost Engram's memories, and a cleanup or a reinstall would lose the project's whole history ("voy a perder todo lodel proyecto y me tocaria instalar todo desde cero", 2026-10-19, `odd/tasks/memory-backup.md`, S1). The only copy was one made by hand on the same disk.
**Requirement:** A Stop hook of Claude Code starts a backup, detached, when one is due: the Engram export and the Claude memory folders of its scope (one project, js-harness by default, or every project), the js-harness home and reference copies of the config, every secret value blanked and the commits on no remote bundled, pushed to a private GitHub repository through a clone under the home. A run refuses an export that lost more than a tenth of any count of the last backup, a clone whose fetch or push URL is not the configured repository on github.com or is the public one, a repository that does not read `PRIVATE` just before the push, and a backup another machine made unless adopted; a run with nothing new commits nothing; the outcome of each run is kept for `status`. Once a day a run also pushes a public summary, built from an allowlist (roadmap shares and open items, feature documents in flight, decision titles) with every line checked against the clone's private terms, as one orphan commit on the `memory-summary` branch, only to a checkout whose every origin URL is `jsaristi/js-harness` on github.com; a summary that cannot be pushed is recorded and never fails the backup. `backup restore` puts a backup into a home, refusing an Engram that already holds observations unless merged and never writing over a live file; `backup verify` restores into a scratch home and checks the counts and every file, and the public summary's sections and privacy; `doctor` shows the backup stale when no run succeeded in a day. For each repository it is configured for, a run also bundles every stash entry and keeps each worktree's uncommitted edits and the `.git/js-harness` records; it copies the plugin lists and Claude Desktop's notes and presets. `backup ready` writes nothing and exits 1 while anything configured has no copy off the machine, naming each, and names with its size what the backup never copies (the transcripts, Claude Desktop's data).
**Reason:** A copy on the same disk dies with it; a private repository survives a reinstall and a lost machine. A wiped Engram looks like a smaller export, and a backup that wrote it over the good copy would lose exactly what it exists to keep. A private repository is one leaked token or one visibility flip away from public, so secrets never go in, and the visibility is read before every push.
**Proof:** `node --test bin/lib/backup.test.mjs`, `node --test bin/backup.test.mjs`, `node --test bin/lib/backup-summary.test.mjs`, `node --test bin/lib/backup-restore.test.mjs`
**Discarded:** A filter that left out every file with a secret-like line: `sk-` matched `task-`, 63 lines of the Engram export, and would have left the export itself out (reader A, `odd/tasks/memory-backup.md`, "Readers"). Watching `engram.db` for changes: Engram writes through its WAL and the database file stayed untouched for hours. `SessionEnd`: a session left open never reaches it, and Codex's events are unconfirmed.
**Today:** `bin/lib/backup.mjs`, `bin/lib/backup-summary.mjs`, `bin/lib/backup-restore.mjs`, `bin/lib/backup-repos.mjs`, `bin/lib/backup-ready.mjs`, `bin/backup.mjs`, `js-harness backup`, `claude-backup-hook`

### The memory is readable when Engram fails

**Problem:** A wiped or broken Engram leaves a session with no memory at all until someone restores it, and the backup's export is a JSON file of thousands of observations no session reads. The owner asked for the last important observations in full, regenerated at every backup, kept clean and current, and used when Engram fails (`odd/tasks/recent-memory.md`, S1).
**Requirement:** Every `backup run` writes, from the export its shrink guard accepted, `RECENT.md` and one file per project in `recent/` of the private clone: at most 100 important observations, pinned first and decisions favoured, each in full with its day, type and why, an observation another one superseded left out and one under an unjudged conflict marked, under a head that holds the project's state and an index with the line of each entry. A run refuses an export in which a project of at least 20 observations lost more than a tenth of them, as it refuses a total drop, and the refusal names the restore with `--merge` before `--allow-shrink`. `verify` and `ready` rebuild the files from the clone's export and say, by count and never by name, when one differs, and note one of another format; `status` names the projects and the newest entry; `doctor` calls the backup stale when a success left no `RECENT.md`. A SessionStart hook of Claude Code, for every start, reads the session's project and asks `engram stats` for it within 3 seconds: when Engram holds less than nine tenths of what the last backup held of it, it tells the session to read that project's file, head first, and how to restore Engram; otherwise it says nothing, and it always exits 0.
**Reason:** A readable file is the memory a session can use while Engram is down, and the notice is what makes a session reach it: nothing else tells a session that the memory protocol it was shown is not working. Counts by observations, not sessions, because Engram's own start registers a session. The file lives in the private repository, since the memory names clients and private projects.
**Proof:** `node --test bin/lib/backup-recent.test.mjs`, `node --test bin/lib/backup-fallback.test.mjs`, `node --test bin/backup.test.mjs`
**Discarded:** A summary written by a model: it costs a call at every run and can drop what matters. Writing back to Engram from the file: the export already restores it whole. A cap on each entry's content: the owner asked for the full content.
**Today:** `bin/lib/backup-recent.mjs`, `bin/lib/backup-fallback.mjs`, `bin/backup.mjs`, `claude-fallback-hook`

### The transcripts survive the machine

**Problem:** The Claude Code transcripts hold everything the owner wrote and every session's work, 1.7 GB on 2026-10-23 and growing about 400 MB a month, and no backup held them; a repository that stores a new copy each day fills up, and GitHub refuses a file of 100 MiB and warns past 1 GB of repository. He asked for them as plain text on GitHub, rebuilt into their format when needed with nothing lost, in a private repository of their own (`odd/tasks/transcripts-backup.md`, S1, S2).
**Requirement:** `backup init --transcripts-repo <owner/name>` creates a private repository when it does not exist, refuses the public one and the memory backup's own, reads it `PRIVATE` and clones it. Once a day, after the memory backup and under a lock of its own, `backup run` copies every `~/.claude/projects/**/*.jsonl` into the transcripts clones, a file over 40 MiB cut by line into parts as long as they can be, and records each file's and part's size and sha256 in the clone's manifest; it commits and pushes each clone after the memory backup's origin and `PRIVATE` checks. A file stays in the repository that holds it, a transcript Claude Code deleted stays in the backup, and a line of 100 MiB or more is named, never pushed. Once the last repository's objects reach 800 MB it takes no new transcript, and `run`, `status` and `doctor` name the next to open. A transcripts failure is recorded and never fails the memory backup, unless `--transcripts` asked for them. `restore --transcripts` rejoins every file into the home, byte-identical by sha256, never over a live file; `verify --transcripts` rejoins them in memory and checks every part and file; `ready` calls a transcript in no backup or changed since missing, one that only grew in the last 15 minutes a note.
**Reason:** Parts cut from the start stay the same as a session grows, so a day pushes its new lines, not the whole file again. The transcripts are not blanked, since the owner asked for them identical, so the `PRIVATE` check before every push is their only guard, and a repository of their own keeps the memory backup small and quick.
**Proof:** `node --test bin/lib/backup-transcripts.test.mjs`, `node --test bin/backup.test.mjs`
**Discarded:** A gzip of all the transcripts each day: a new 430 MB file every day, which git cannot store as a change. One repository per year: a year of growth passes 1 GB well before it ends. Creating the next repository by itself: creating one is asked first.
**Today:** `bin/lib/backup-transcripts.mjs`, `bin/lib/backup-ready.mjs`, `bin/backup.mjs`, `js-harness backup`

### The machine sheds its leftovers

**Problem:** After a restart on 2026-10-20 the owner cleaned about 9 GB by hand with PC Manager: old Codex app-server releases, old Claude Code versions, package caches and test scratch in the temp folder, most of them made by the stack, which nothing deleted and nothing pointed out ("Listo hagamos esto", and "Quiero que ese js-harness clean sea tambien inteligente y cada cierto tiempo le pida permiso al usuario", `odd/tasks/clean.md`, S1-S2).
**Requirement:** `js-harness clean` lists each known kind of regenerable leftover with why it is safe to delete, each item's size and a total, and deletes nothing. `--apply` deletes only the kinds confirmed (y/N per kind in a terminal, else named with `--kind`), package caches only through their own tools, renames a folder before removing it so one in use fails whole, and appends every deletion, failure and refusal to the home's clean log. It never deletes the transcripts, engram's store, the harness's home, the current Codex runtime, the running Claude, anything inside a git worktree, or anything its own scan did not find. `doctor` and its session-start hook start a detached measure at most once every 7 days for the machine's own home, and the `clean` row recommends the clean once the measured total reaches 2 GB, noticed once per measure.
**Reason:** Leftovers that regenerate cost nothing to delete and gigabytes to keep, but only the user may say yes to a deletion, and a record makes it auditable. A measure inside the hook would take half a minute; detached, the session start stays inside its 10 seconds.
**Proof:** `node --test bin/lib/clean.test.mjs`, `node --test bin/clean.test.mjs`
**Discarded:** A question sent to the orchestrator from the hook: it needs an orchestrator running, and every session that starts would send it. Deleting the package cache folders by hand: the tools own their layout. Counting the whole pnpm store in the total: prune frees only the packages no project uses, so it would recommend a clean that frees little, every week.
**Today:** `bin/lib/clean.mjs`, `bin/clean.mjs`, `js-harness clean`, `~/.js-harness/clean.json`, `~/.js-harness/clean-log.jsonl`

### The specification stays alive

**Problem:** The owner asked for one complete document that says what the harness is, alive and updated as changes are made, from which a more capable model could rebuild it "perfecto solo con ese documento" (lead's transcript `65318fd5`, line 13936; `docs/ROADMAP.md`, "The specification of the harness").
**Requirement:** This file holds one entry per capability with the six fields, and a commit is refused when an entry lacks a field or a proof command, when a file its Today line names does not exist, or when a command of the dispatcher, an entry the manifest installs or a file written under the home is claimed by no entry.
**Reason:** A document kept alive by remembering goes stale; one held by the gate cannot lose a piece silently.
**Proof:** `node --test bin/lib/spec.test.mjs`
**Discarded:** A description of the pieces as they stand in place of the requirements: it reads as today's architecture, and a rebuild would copy it; the map under "The architecture" is kept apart from the entries and says it is today's. Principles alone: nothing can be rebuilt from a philosophy.
**Today:** `docs/SPEC.md`, `bin/lib/spec.mjs`, `bin/check.mjs`

### An output the owner sees again is a template of five parts

**Problem:** On 2026-10-29 the owner saw a page made by hand where a command should have made it, and asked that everything he sees again and again be made by a command and held by a gate, so a model's taste cannot reach him (transcript `0f71b2c6`, lines 14721 and 15262; `odd/tasks/templates.md`, Specs).
**Requirement:** Each such output is a registered template with five parts: the sample he approved, pinned by its sha256 and the words that approved it; the command that renders it from the records; a golden test; a gate on the path to him; and a test that the gate refuses a hand-made one. `js-harness template new <id>` scaffolds the five parts from his line `Plantilla: qué quiero ver · cuándo aparece · cómo se ve · dónde me llega` and names only the first field missing, so he is asked for that one alone; `template check` fails on a draft, a missing part, a sample whose bytes changed, a scaffold body left, a skipped test, a surface no hook entry of the harness watches, or a repeated id; `template list` prints the registry. Where a project's `harness.json` holds `"templates": true`, `template gate --hook` refuses before the call a page no template command recorded, naming the command to run, and a question whose text or options are not those `template ask <n>` prints for an open question of the channel's record; `--shown` records after it what was shown; `template shown` and `doctor`'s `templates` row list the escapes.
**Reason:** An output held only by prose drifts with the model that writes it; one held by a command, its golden test and a gate cannot reach him by hand without the refusal saying so.
**Proof:** `node --test bin/template.test.mjs`, `node --test bin/lib/template.test.mjs`, `node --test bin/lib/template-check.test.mjs`, `node --test bin/lib/template-scaffold.test.mjs`, `node --test bin/lib/template-gate.test.mjs`, `node --test bin/lib/template-record.test.mjs`, `node --test bin/lib/template-question.test.mjs`
**Discarded:** A skeleton a session fills, as `contract template` prints: the model still writes what he sees. A checklist in a skill: nothing refuses an output that skips it.
**Today:** `bin/template.mjs`, `bin/lib/template.mjs`, `bin/lib/template-check.mjs`, `bin/lib/template-scaffold.mjs`, `bin/lib/template-registry.mjs`, `bin/lib/template-gate.mjs`, `bin/lib/template-record.mjs`, `bin/lib/template-question.mjs`, `js-harness template`, `claude-template-gate-hook`, `claude-template-shown-hook`

## After F8

Where the harness must stand once F8 is done (`docs/ROADMAP.md`, "F8 plan"), so a step can be
judged against its end and a later model knows what was intended, not only what was built. A
capability moves into its entry above when its step lands, with its proof; until then this section
is the record of the intent. The register of the owner's decisions is the diet's section 1
(`docs/proposals/harness-diet.md`); a decision named here as open is his until answered.

### The whole, at the end of F8

- **One harness.** gentle-ai, Orca and herdr are gone from the machine (S2). Nothing of them loads,
  runs a hook or is named by `bin/` or `evals/` except the idea watch, named historical fixtures and
  the tests that assert their absence (S11, S9). gentle-ai's repository is read for ideas, never
  installed (`docs/ROADMAP.md`, Decided, "Direction").
- **The complements are ours to install.** js-harness installs and registers engram and its plugin,
  codegraph and context7 with their own commands, records each and undoes each exactly, under a
  preset: complete, lean (no codegraph) or custom, never without context7 or the two reviews (S11,
  G11, G14).
- **What loads.** A session loads the root `CLAUDE.md` and `AGENTS.md` within their budgets (3,200
  and 1,500 estimated tokens), the Rules block `install` writes into `~/.claude/CLAUDE.md` (G12),
  our output style and our skills, and the complements' own instructions, one engram text among
  them. The first turn is at most 80,000 tokens once S2 is measured and 75,000 after S5 and S6, a
  failing `check` row (D4, by default), against 105,565 at S0.
- **Hooks.** 14 entries in `~/.claude/settings.json`, js-harness 13 and codegraph 1, held by a
  `check` row that fails above that or on a new owner (S4a); 32 today.
- **Two reviews on every slice with code**, Codex and the Claude lenses, recorded only by the
  commands that ran them; a skip is a debt the merge door refuses (S1, its records fix).
- **Every directive tied to its proof.** Every source the harness ships or sends to an agent is
  listed, every obligation in it names a control (a check with a planted break, an eval case whose
  arm without the rule scores lower, or a dated `owed`), and `owed` is at most 10% at S8 (S5c).
- **Every project works the same.** `init` gives a new project, and the migration gives an
  initialized one, the same split, style, denies, complements, gates, reviews and coverage baseline,
  each write recorded (S12, `docs/proposals/gentle-ai-reverse-engineering.md`, section 11).
- **Proven.** The incident set at least 17 of 20, the S0 and S8 measures at their frozen lines, a
  Claude and a Codex audit three runs each, and the failure classes' closing counts (S8).

### Each capability's target

Only the capabilities F8 changes; every other one stands as written above.

| Capability | Step | Target after F8 |
|---|---|---|
| The payload and the fixed load | S2, D4 | The gentle-ai source is gone and the interim exclusion reverted; the `fixed load` row fails over 80,000, then over 75,000 after S5 and S6, instead of warning over `rule:fixed-load-budget` (100,000, `bin/lib/fixed-load.mjs:138-147`). |
| The commit gate | S4a, S4b, S5c-a | New static rows: the hook count by event and owner (S4a); a new feature document without `## Goal` refused (S4b); directive coverage's totals as an INFO row (S5c-a). A refusal with a next step ends with the exact command, bound to the commit range it was computed for (S4b; reverse-engineering document, 13.3 row 1). |
| Project init | S11, S4a, S5c-a, S12 | Also: context7 enabled and codegraph by preset (S11); the `commit-msg` hook that strips attribution (S4a); the coverage baseline, the coverage row and an example eval case (S5c-a); the check that the root `CLAUDE.md` imports `AGENTS.md` and nothing above turns it off (S12). The style and the denies already ship (S10). |
| The stack doctor | S11, S12, S8 | The `gentle-ai` and `gentle-ai-sync` rows leave; context7 is required and a project with it off is flagged; a row turns red when engram's binary and plugin serve different protocol versions (S11); a row for the `CLAUDE.md` import (S12); a row for hooks cancelled or timed out in the last 20 sessions and one for a credentials file under the scratch and temp roots (diet sections 7 and 9; neither exists, `grep -i "cancel\|credential" bin/doctor.mjs`). |
| The stack install | S11, S2 | engram, its plugin, codegraph and context7 are rows js-harness runs and undoes, chosen by preset; no tool is the person's step because gentle-ai brings it. `stack backup` takes S2's full backup and runs its restore drill (S2). |
| Install and undo exactly | S11, S5 | `install` writes by preset and ships the trimmed skills; after S2 the only output style and skills are ours. |
| The installed skills | S5, S7 | Each skill's description is one line with its trigger first and its body at most 3k, held by a test; the protocols skill loads in at most 3 of 10 sessions (S5). The orchestrator skill cuts the lead at a phase's close or after two compactions, routes helpers to Haiku 5.5 with `omitClaudeMd` and writers' briefs name their `S#` (S7). |
| The Codex review | S1 records fix | A record counts only when the command wrote it, named by its run line; `guard` refuses any other write to the records. Its reason no longer reads "after gentle-ai": it is one of two reviews on every slice. |
| The Claude lens review | S1 records fix, S5 | A lens record is admitted only when it names a run line the command wrote first; a headless lens run is shown not to fire a planted user hook (flag parity, reverse-engineering document 13.3 row 2). |
| The guard | S1 records fix | Refuses a file tool or shell write to `codex-reviews.jsonl`, `codex-review-runs.jsonl` and `lens-reviews.jsonl` under the git common directory. |
| Declared rules | S5, S5c | Every rule and every register control classified as a check or hook, prose that stays, or retired, counted from the register on the day (S5); every rule's obligations carry a control and `rules check` refuses a new gap (S5c). |
| A project's own rules | S5c-a | The `Control` field, optional in `docs/rules.json` until the project's baseline is set, required by `rules check` after it. |
| The failures register | S5, S8 | Each of the 68 tool, machine and unseen-state entries assigned by id to its class repair or named open; S8 reports each class's closing count (diet section 10, "The failures outside prose"). |
| Evals that discriminate | S11, S5c, S8 | gentle-ai's block arms kept only as named historical fixtures (S11); each case names its rules in `task.json`, with a recorded run where its arm without them scored lower (S5c); the long-session eval (S8). |
| Releases | S8 | Every tag runs `scripts/release-proof.mjs` on the tagged commit before it is announced, and its record names that run (reverse-engineering document, 13.3 row 13). |
| What a session took from gentle-ai is ours | S2 | After S2, the only style, skills and permissions on the machine are these; the Rules block stays. |
| The memory survives the machine | S11 | Engram's protocol and its context recovery come from engram alone (its MCP instructions and plugin); js-harness writes no engram text of its own. |
| The future-model protocol | S8, G7 | Certification reruns on each new model and each Claude Code or Codex CLI update, at most once a week by G7's default (about $25 each, $70 to $80 with directive coverage [i]); a gentle-ai release reruns nothing. |

### What F8 adds that has no code yet

Each is designed, with its step, and enters "Capabilities" with its proof when it lands.

| Capability | Step | What it must do | Its proof, planned |
|---|---|---|---|
| Directive coverage | S5c-a, S5c-b | `js-harness rules coverage` lists every source, every span tied to a rule or listed as context, and every obligation's control; `--strict` exits 1 on a gap the pass line forbids, `--prove` applies each planted break in a scratch copy and its test must go red; a new gap is refused by `rules check`; projects get the same, bound to the release that wrote their text (reverse-engineering document, section 14) | `rules coverage --strict` and `--prove` exit 0; `node --test evals/tasks.test.mjs` |
| The migration of an initialized project | S12 | Builds on `sync`, which already rewires the pre-push check and writes the clone's style and denies (`bin/lib/project.mjs:1593-1639`): reads the version the project's manifest recorded, writes what later versions add and `sync` does not (the split, context7, the baseline), keeps the owner's edits (merged or left with a note, never overwritten) and records each write | a test on a copy of a project an old release initialized |
| The full backup and restore drill | S2 | `js-harness stack backup`, run from a plain terminal with every session closed: one backup outside the repository, recorded; a drill on a scratch home that hashes it, restores it, puts back a deleted file and removes a created one, and proves engram answers an observation recorded before | the drill's own checks, which stop at the first failure |
| The attribution hook and the hook count | S4a | A `commit-msg` hook strips attribution lines; a `check` row counts hook entries by event and owner and fails above 14 or on a new owner | a scratch commit lands without `Co-Authored-By`; one extra `Stop` entry turns the row red |
| The rehearsal | S13 | The whole path of a project, from `install` to `uninstall machine`, walked on a scratch project, comparing only the paths the manifests recorded | every row of the reverse-engineering document's 11.1 does what it says; exact undo |
| The idea watch | S9 | Each gentle-ai release read by area and classified adopt, adapt or ignore; nothing installs | a fixture diff with one path per area and one unmatched |
| The long-session eval | beside, run at S8 | A scripted user drives one session of about 40 turns with five planted moments; a separate grader | at least 90% of moments, five runs per setup (`odd/tasks/f8-s0-baseline.md`, its build plan) |
| Certification | S8 | The S0 and S8 measures, one row each with its own frozen line and no combined score; Claude and Codex audits, three runs each | the incident set at least 17 of 20; 17 measures pass, 4 deferred reported as not built |
