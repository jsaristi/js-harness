# The js-harness specification

What the harness must achieve and why, written so that a later model could rebuild it from
nothing, and better, with this document alone. It never says how the code is written today:
a rebuild that copied today's pieces would copy their accidents too. The one line tied to the
present in each entry is **Today**, which names the files that hold the capability now; it is
what an agent about to change a piece reads to find it.

## The problem and the bet

An AI coding agent works inside a host (Claude Code, Codex) on top of a stack this harness does
not rebuild: gentle-ai owns the workflow, task documents, test-first work and review; engram
owns memory; codegraph owns code structure; the host's `/goal` owns the autonomy loop. Left
there, three things go wrong. Rules live in prose the agent reads every turn and forgets, so
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
when a capability lacks a field or a proof command, when a file its Today line names does not
exist, and when a command of the dispatcher, an entry the manifest installs or a file the
harness writes under the home is claimed by no capability. It proves that every piece is named
and provable, not that its reason is well told; that part stays with review.

The eval tasks under `evals/tasks/` are the measure of "better": a rebuild is proved by these
proofs and by those tasks.

## Capabilities

### The commit gate

**Problem:** F1 asked that `git commit` run the gate (`odd/tasks/f1-skeleton.md`). Later a static row that failed was printed only after about seventeen minutes of sensors and the wait for the lock (`odd/tasks/gate-turn.md`), and git runs no pre-commit hook for the commit a merge makes by itself.
**Requirement:** One command is the single gate: the same gate runs before every commit, a merge's commit included, and refuses it when red. Its static rows (the project's rules, the failures register, the instruction budget, the contracts, the citations, the functions, the payload, the fixed load, the flaky ledger, this specification) run first, each in a second or less, and a failing one stops the gate before it waits for the machine's lock or runs a sensor. A row that informs never stops it.
**Reason:** A red check means the commit is not ready yet (`AGENTS.md`); a fault known in a second must not cost a whole gate.
**Proof:** `node --test bin/check.test.mjs`, `node --test bin/check-exit.test.mjs`
**Discarded:** Setting `core.hooksPath` in a project: it silently disables `.git/hooks`; `init` writes into the hooks path instead.
**Today:** `bin/check.mjs`, `.githooks/pre-commit`, `.githooks/pre-merge-commit`, `package.json`, `js-harness check`

### The instruction budget

**Problem:** No incident; the founding bet (`docs/origin.md`) and F1, which asked for `AGENTS.md` at about 1.5k tokens and a check that fails over it (`odd/tasks/f1-skeleton.md`). It landed at 691 tokens and stood at 1,478 of 1,500 on 2026-10-15 (`odd/tasks/drop-github-gate.md`).
**Requirement:** A commit fails when the instruction file every session pays on every turn exceeds a declared token budget; the budget is a declared rule, not a literal in code.
**Reason:** Every line of `AGENTS.md` is paid on every turn of every session, and a check costs no tokens and cannot be forgotten.
**Proof:** `node --test bin/check.test.mjs`
**Discarded:** Failing on the whole payload of the machine: no commit here can shrink a file gentle-ai manages, so the hard budget stays on what the repository owns.
**Today:** `bin/check.mjs`, `bin/lib/rules-data.mjs`, `AGENTS.md`

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

**Problem:** Whether a change was due a review was known only if the agent remembered to ask gentle-ai (`odd/tasks/sensors.md`).
**Requirement:** Every gate shows gentle-ai's risk tier and whether the pending change is due a review. It informs and fails open: no gentle-ai, review switched off or no change are said, never a failure. Where the rule `reviewed-commit-lines` is in force, the gate fails a staged change with more changed lines a review reads than that rule gives, so it is split before it is made, not refused by the reviewer after (`docs/FAILURES.md`, commit-too-large-to-review).
**Reason:** Review is gentle-ai's; a missing or failing gentle-ai must not turn a commit red.
**Proof:** `node --test bin/check.test.mjs`, `node --test bin/check-commit-size.test.mjs`
**Discarded:** A review that blocks a commit or a push: review is the owner's switch, and a slice under budget is committed before it is reviewed.
**Today:** `bin/check.mjs`

### Contracts and citations

**Problem:** F3 asked that a task contract with no executable done-when never reach the autonomy loop (`odd/tasks/task-contract.md`). False citations lived in prose: the first full read found 1,857 citations, 190 unresolved (`odd/tasks/commands-and-doctor.md`).
**Requirement:** Every gate validates every contract under `odd/tasks/` statically, never running a done-when command (one may be the gate itself). It resolves the `path:line` citations the pending change adds against the commit's index and reports how many do not resolve.
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

### A gate that would wait runs its tests on CI

**Problem:** Measured on 2026-10-16: two suites at once on this machine take 303 and 305 s against 158 s alone, so the limit is the CPU and a second local line gains nothing; the gate was the limit on how many sessions fit (`odd/tasks/first-version.md`, S7).
**Requirement:** A commit's gate runs here when the machine's lock is free. When its turn would wait, the tests run on a CI machine instead, on the exact tree being committed (written as a commit object and pushed to a branch of its own, deleted after), and the commit is made only on green, with the same tree; red prints the failing tests and refuses. Anything that is not a green or red run (no network, no signed-in client, no run, a run cancelled or past its bound) falls back to the local gate and says why, so CI only ever shortens a wait. The workflow runs only for a push to those branches, never for a pull request or the default branch, reads and writes nothing else, names no secret and pins its actions; a test holds every one of those bounds. Each gate on CI leaves its record in the gate log.
**Reason:** A commit never lands without its own proof, wherever it ran; the local machine stays the fast path for one session; and a bound written in a workflow a pull request could change must be held by a test, not by care.
**Proof:** `node --test bin/lib/ci-gate.test.mjs`, `node --test bin/check-ci-gate.test.mjs`, `node --test scripts/github-workflows.test.mjs`
**Discarded:** A second local line: the CPU is shared. A run on every pull request: each merge made every other run stale, and minutes were scarce while the repository was private. Windows runners: 22 billed minutes a run. What CI cannot prove (it is Linux) is caught by the merge queue's local run before the default branch moves.
**Today:** `bin/lib/ci-gate.mjs`, `bin/check.mjs`, `.github/workflows/gate.yml`, `scripts/github-workflows.test.mjs`

### The gate log

**Problem:** On 2026-10-11 one gate timed out at 1,200 s and another took 1,069 s against 832 s for the same tree, beside a video and a language server nobody saw; which gates ran beside which was a session's memory (`odd/tasks/gate-log.md`). A failed run's test names were lost with its report.
**Requirement:** Every gate, a commit's included, appends when it ran, its seconds, its result, the machine's load, whom it waited for, its folder and the names of failed tests to one bounded log under the home, which a command prints and uninstall removes.
**Reason:** A slow gate is explained by a file, not by a recollection.
**Proof:** `node --test bin/lib/gate-log.test.mjs`, `node --test bin/lib/machine-load.test.mjs`
**Discarded:** Reading the load through PowerShell on every gate: seconds, and Windows only. Whole command lines: a secret gets logged. One line written at the end: a killed gate vanishes. Trimming by rewrite: it loses appends.
**Today:** `bin/lib/gate-log.mjs`, `bin/lib/machine-load.mjs`, `bin/gate.mjs`, `~/.js-harness/gate-log`

### Install and undo exactly

**Problem:** The predecessor stack needed four hand-written purge scripts to uninstall (`AGENTS.md`, `odd/tasks/install-update.md`). Sessions of two permission classes could not message each other: Claude Code delivers only within a class unless a user setting says otherwise (`odd/tasks/commands-and-doctor.md`).
**Requirement:** Every file written outside a repository is recorded in a manifest under the home with its hash; uninstall removes exactly those and keeps, and reports, a file the user edited. An entry grafted into a JSON file the harness does not own (a hook in a host's settings) is recorded by file, pointer and entry: install adds no duplicate, uninstall removes only that entry and deletes the file only if the harness created it and it is now empty. An opt-in sets the user setting that lets sessions of other permission classes message each other, and uninstall puts back what was there. Each command acts on the project inside one and on the machine elsewhere; a status says what is pinned, installed and latest.
**Reason:** Anything written outside the repository must come out exactly, or removing the harness costs a purge script.
**Proof:** `node --test bin/install.test.mjs`, `node --test bin/lib/manifest.test.mjs`, `node --test bin/install-session-messages.test.mjs`
**Discarded:** Assuming npm: on this machine `npm` is a pnpm shim. Owning a host's settings file whole instead of one entry.
**Today:** `bin/install.mjs`, `bin/lib/manifest.mjs`, `scripts/e2e.mjs`, `js-harness install`, `js-harness sync`, `js-harness uninstall`, `js-harness status`, `~/.js-harness/manifest.json`, `~/.claude/settings.json`

### Releases

**Problem:** Update and upgrade asked the npm registry for a name nobody holds and installed what it printed with no comparison (`odd/tasks/install-update.md`, T5); until a release source existed no command could update a machine (`odd/tasks/first-version.md`).
**Requirement:** The newest release is the highest tag named exactly `vX.Y.Z` in the harness's own repository, listed with the machine's own git and credentials within a time bound; upgrade installs that tag and then syncs; tags that cannot be listed exit 1 with the reason and install nothing; no registry is ever asked; a folder of packed tarballs can stand in.
**Reason:** The machine's git already holds what the repository needs to be read, and no registry holds the package; tagging starts at 1.0.0, the first complete version (`docs/ROADMAP.md`).
**Proof:** `node --test bin/update.test.mjs`, `node --test bin/release-tags.test.mjs`, `node --test bin/lib/version.test.mjs`
**Discarded:** The npm registry as the source. An npm publish, planned for a public repository and left without a date.
**Today:** `bin/update.mjs`, `bin/lib/version.mjs`, `js-harness update`, `js-harness upgrade`

### Project init

**Problem:** No incident; the roadmap decided two levels, installed per machine and enabled per project like `git init` (`docs/ROADMAP.md`, `odd/tasks/project-init.md`).
**Requirement:** In a git repository, init writes a committed `harness.json` pinning the version, a base `AGENTS.md` only where none exists, an empty failures register (`docs/FAILURES.md`, declaring no class, since the classes are the project's own) only where none exists, and the pre-commit gate in the hooks path, keeping any hook already there; it prepares the code map where it is on. Every file is recorded in a per-clone project manifest so uninstall restores the repository exactly. Outside a git repository it writes nothing and exits 1.
**Reason:** Every file init writes inside a project must be undone exactly, like what install writes on the machine.
**Proof:** `node --test bin/init.test.mjs`, `node --test bin/lib/project.test.mjs`
**Discarded:** Changing `core.hooksPath`: it silently disables `.git/hooks`. A committed manifest: it is per clone, like the hook.
**Today:** `bin/init.mjs`, `bin/lib/project.mjs`, `js-harness init`

### The stack doctor

**Problem:** A gap was found only by accident: codegraph was registered in Claude Code but not in Codex (`odd/tasks/stack-doctor.md`).
**Requirement:** The doctor reports each tool of the stack as installed, configured per host and project, and up to date, or unknown, with that tool's own fix command; it caches the latest versions, fails open offline and never installs or configures another tool. A session-start hook speaks only when the list of gaps changed, as a message to the person and never as text for the model, and always exits 0. A tool of the stack, or the Claude CLI on PATH, whose version moved since the versions last reviewed is a gap until its review is recorded (`docs/FAILURES.md`, cli-updated-itself).
**Reason:** A notice costs no model tokens when it comes only on start or resume, and only when something changed. A tool that updates itself was seen only when a measurement was about to run on it.
**Proof:** `node --test bin/doctor.test.mjs`, `node --test bin/doctor-hook.test.mjs`, `node --test bin/lib/stack.test.mjs`, `node --test bin/lib/stack-update.test.mjs`
**Discarded:** Plain-text hook output: it enters the model's context. Recommending another tool's own upgrade command where that tool says not to.
**Today:** `bin/doctor.mjs`, `bin/lib/stack.mjs`, `bin/lib/stack-update.mjs`, `bin/lib/cache.mjs`, `bin/lib/latest.mjs`, `js-harness doctor`, `claude-hook`, `codex-hook`

### Progress

**Problem:** "Where are we" was answered by a model reading the roadmap and every feature document, which costs tokens and drifts; states written as prose could not be counted (`odd/tasks/progress-view.md`).
**Requirement:** The plan and each feature document hold their steps as checkboxes, and a read-only command prints each phase and feature with its checked and pending steps and percentages. Its pace reads the default branch's first-parent history and prints, a day, the tasks closed, reopened, added and removed, counted by the same parsers as the map.
**Reason:** Progress is computed by a command, not reinterpreted by a model.
**Proof:** `node --test bin/progress.test.mjs`, `node --test bin/lib/progress.test.mjs`
**Discarded:** A published page. Editing checkboxes from the command.
**Today:** `bin/progress.mjs`, `bin/lib/progress.mjs`, `js-harness progress`

### The task contract

**Problem:** The host's `/goal` stops when a small model judges a condition from the transcript, so a condition in prose is judged by opinion (`odd/tasks/task-contract.md`). One effort setting covered design and build tasks alike, and nothing applied or printed it (`odd/tasks/effort-by-task.md`).
**Requirement:** A feature document opens with a contract whose done-when items are commands that exit 0; a contract with no command is rejected with the reason; one command runs them, one prints the `/goal` condition, and one prints each open task's effort and sub-agent models from the kind of work it names.
**Reason:** A feature's end is a set of commands that exit 0, not an opinion.
**Proof:** `node --test bin/contract.test.mjs`, `node --test bin/lib/contract.test.mjs`
**Discarded:** A contract as a second file beside the ODD document. A loop of the harness's own instead of the host's `/goal`.
**Today:** `bin/contract.mjs`, `bin/lib/contract.mjs`, `js-harness contract`

### The Codex review

**Problem:** The Codex review of each approved slice depended on the agent remembering, and nothing noticed a skip (`odd/tasks/project-init.md`). On 2026-09-29 every shell command of a review failed after a Codex update, and in 6 of 41 reviews the model never read the diff yet answered (`odd/tasks/codex-exec-review.md`).
**Requirement:** A command runs Codex's review of a range and records it only on evidence that the reviewer read the diff (a completed turn, and every changed line of the patch in the output of its successful commands), never on its wording; an explicit skip is recorded with its reason; the pre-push hook refuses a push whose code commits no record covers. A merge of the default branch is reviewed by what was written in it: at HEAD as the range, and below HEAD, after code commits that each have a record, in a turn of its own before the commits after it, where two turns cost less than one review (`odd/tasks/merge-below-head.md`).
**Reason:** A second reviewer after gentle-ai, and a skip must be explicit, never silent.
**Proof:** `node --test bin/codex-review.test.mjs`, `node --test bin/check-codex-reviews.test.mjs`, `node --test bin/pre-push-hook.test.mjs`, `node --test bin/lib/codex-reviews.test.mjs`
**Discarded:** The Codex plugin's review: it passes no per-thread setting and returns only text. Reading gentle-ai's or the plugin's own state as the record: pruned, opaque and free to change.
**Today:** `bin/codex-review.mjs`, `bin/lib/codex-reviews.mjs`, `bin/lib/codex-review-coverage.mjs`, `bin/lib/codex-review-turns.mjs`, `.githooks/pre-push`, `js-harness codex-review`

### The merge queue

**Problem:** Each merge made every other pull request's green run stale: 205 minutes of a 2,000-minute monthly allowance on 2026-10-14, and GitHub's merge queue is not offered for a private personal repository (`odd/tasks/merge-queue.md`).
**Requirement:** The queue builds the default branch plus each ready pull request merged in number order, naming each one left out and why; it tests the candidate on this machine under the lock and on one CI system, and when both are green moves the default branch to it by fast-forward, leased on the branch it was built from; a red batch is bisected to the pull request that broke it; the pre-push hook refuses a push of the default branch from anywhere but the queue. No CI runs for a pull request.
**Reason:** A second pusher makes the tested candidate a tree the default branch never was, and minutes are the scarce resource.
**Proof:** `node --test bin/merge-queue.test.mjs`, `node --test scripts/circleci-config.test.mjs`, `node --test scripts/github-workflows.test.mjs`
**Discarded:** A GitHub Actions run on every pull request, with its bounds held by a test (`odd/tasks/drop-github-gate.md`). Windows on GitHub: 22 billed minutes a run. A self-hosted runner on the same machine: the same eight threads and the same lock. Merging on GitHub's side: it bypasses the hook.
**Today:** `bin/merge-queue.mjs`, `bin/lib/pull-request.mjs`, `.circleci/config.yml`, `js-harness merge-queue`

### Evals that discriminate

**Problem:** The predecessor's 32 tasks could not tell configurations apart: the bare configuration scored 94%, 30 of 32 at the maximum, graded by text rubrics (`odd/tasks/evals.md`).
**Requirement:** Tasks are graded by hidden tests copied in after the agent exits, in isolated homes that never touch the owner's memory, projects or review state, with auto-update and auto-memory off; tokens and time are recorded per trial with a clean stop on a cap; the verdict takes the score as the floor and lets cost decide between equal scores. Any spend is stated and approved first.
**Reason:** "Every component must earn its place" needs data, not opinion. F5 found the current stack 1.68x to 2.54x the minimal one's cost for the same score (`docs/ROADMAP.md`).
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
**Requirement:** In any git repository one command keeps the host's remote-control server alive (start, stop, status; a second start refused), with no inherited host variables, sessions in the project folder and the user's own permission mode; its log is capped; an opt-in brings it back at login and within five minutes whenever it died; a plain stop stays stopped; every file or task written outside the repository is recorded and removed exactly. The doctor reports an account mismatch without printing either identifier.
**Reason:** The phone is the owner's main interface, and the facts a human learned by hand belong in a command. A process is killed only by its id and its creation time, because a kill by id alone once closed unrelated programs.
**Proof:** `node --test bin/remote.test.mjs`, `node --test bin/lib/remote.test.mjs`
**Discarded:** A login launcher alone: a killed supervisor stayed down twelve hours. Rotating the log by renaming it: the server holds its append handle, so it is trimmed in place. A watchdog that restarts after a deliberate stop. Codex: it has no remote-control server.
**Today:** `bin/remote.mjs`, `bin/lib/remote.mjs`, `bin/lib/process-tree.mjs`, `js-harness remote`

### Loops with owners

**Problem:** On 2026-10-15 the lead's loops were unversioned shell scripts; in one night a compaction left background tasks marked stopped while they lived on, a second lead killed the first one's loops because nothing said whose they were, and an update failed blind because a tool was not on the path under the host's shell (`odd/tasks/lead-tools.md`).
**Requirement:** A loop runs in the foreground of a background task under an owner record (the owner session, the process by id and creation time, its purpose, what ends it); a live loop of the same name is refused; a status lists live and stale loops; stop refuses a live loop another session owns unless taken over, kills the whole tree by identity and succeeds only when a second look finds nothing alive.
**Reason:** The end of a background task is what wakes a session, so a detached daemon would wake no one; process ids are reused fast; the host shell's path is not the user's.
**Proof:** `node --test bin/loop.test.mjs`, `node --test bin/loop-bodies.test.mjs`
**Discarded:** Compare-and-remove of a stale record by moving it aside: a third session could claim the freed name, so a lock per name replaced it. One-shot jobs as loops.
**Today:** `bin/loop.mjs`, `bin/lib/loops.mjs`, `js-harness loop`

### Waiting and waking

**Problem:** On 2026-10-14 nothing ran for seven hours while sessions waited; twice a session near compaction ended its turn waiting with nothing to wake it, because the host compacts only inside a turn (`odd/tasks/pause-no-idle.md`); after a restart the lead woke seven sessions by hand and each re-armed its waits from memory (`odd/tasks/boot-wake.md`).
**Requirement:** A wait ends with one line when its one condition holds (a pull request merged, the default branch holding a commit or a text, a notice for a role), says what it waits for and when it ends, and gives up with exit 1 after a bound. After a boot, a command lists the sessions open in the hours before it with the command for each stored opening and the waits the boot killed, leaves each a note and the orchestrator the list to wake, once per boot; an opt-in runs it at each login through a recorded startup file that uninstall removes.
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
**Requirement:** A hook before each tool call refuses, with the host's deny and a reason: a sub-agent on a model the project's rules do not give (only where those rules are in force), a message to another session whose stated hour is more than a minute off the clock, a document hour ahead of the clock, a shell command with backticks inside double quotes, a test run of several files outside a gate's turn while another gate holds the lock, a line over the limit in a memory index, and the tools that open sessions out of sight where the project says so. A stop hook turns the stop back when a reply states its own context share more than 2 points from the recorded one, and never loops. Both write nothing and always exit 0, so an older copy can never block.
**Reason:** Each rule had a measured failure and the owner's order to refuse it; a refusal at the call is the one reader every call meets.
**Proof:** `node --test bin/guard.test.mjs`, `node --test bin/lib/guard.test.mjs`, `node --test bin/lib/test-run-warning.test.mjs`
**Discarded:** Reading effort: a hook before a tool call cannot. Taking back a reply with a wrong share: impossible; turning the stop back is the nearest. A warning instead of a refusal for test runs. The first backtick detector: 20 hits for 1 real.
**Today:** `bin/guard.mjs`, `bin/lib/guard.mjs`, `bin/lib/test-run-warning.mjs`, `bin/lib/memory-index-guard.mjs`, `bin/lib/document-hour-guard.mjs`, `js-harness guard`, `claude-guard-hook`, `claude-share-hook`

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
**Requirement:** Install writes, for each host, a skill that teaches the commands and the memory hygiene protocol, and a skill that teaches how several sessions share one project: the lead and the work sessions, where each thing lives, how questions reach the owner, the lead's commands and charter, a work session's notices and close, and a third that holds the six protocols, each section opening with the incident it came for and its date and naming the rules it relies on by id, never restating them. They load on demand, and each is recorded and removed exactly.
**Reason:** A protocol that applies only in some situations loads on demand, while a rule for every reply needs a line in `AGENTS.md` and a check; the lead does not implement because reading code fills a context that has to last.
**Proof:** `node --test bin/lib/manifest.test.mjs`, `node --test bin/install.test.mjs`, `node --test bin/lib/protocols-skill.test.mjs`
**Discarded:** A watchman skill: replaced by a lead with a charter the owner decided. Six protocol skills: every installed skill's description is read on every turn. Teaching in a skill what a check now enforces. Asking the owner to compact a session.
**Today:** `bin/lib/manifest.mjs`, `bin/install.mjs`, `claude-skill`, `codex-skill`, `claude-orchestrator-skill`, `codex-orchestrator-skill`, `bin/lib/protocols-skill.mjs`, `claude-protocols-skill`, `codex-protocols-skill`

### The record of notices between sessions

**Problem:** On 2026-10-10 a finished feature sat undelivered for six hours: a session opened from the phone runs in another permission mode, and the app held its messages (the orchestrator's relief file, lines 58-61 and 143, as `odd/tasks/session-channel.md` cites them).
**Requirement:** Every notice between sessions is written by a command to one record per project, outside any repository, with the time read from the clock, the sender, the role it is for, its kind and one line of text. A usage error writes nothing. The orchestrator learns of a notice by watching the record, never by depending on a message arriving.
**Reason:** Messages between sessions can be held, can expire, or do not exist at all (Codex has none); a file every host can append to is the one channel all of them share.
**Proof:** `node --test bin/lib/channel.test.mjs`, `node --test bin/notify.test.mjs`
**Discarded:** The repository's git folder as the record's home: there is none outside a repository. Messages as the channel.
**Today:** `bin/lib/channel.mjs`, `bin/notify.mjs`, `js-harness notify`

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
**Requirement:** After a compaction, a session-start hook prints, read from files: the title, the stored opening, the feature document and whether it was written after the pause, the worktree's state, the work in flight, what the owner wrote, the messages of other sessions and the open questions; it tells the session to notify the orchestrator. It speaks only in a project with a `harness.json`, writes nothing and always exits 0. Installed for both hosts.
**Reason:** The compaction's summary is not the record.
**Proof:** `node --test bin/resume.test.mjs`
**Discarded:** Trusting the summary.
**Today:** `bin/resume.mjs`, `js-harness resume`, `claude-resume-hook`, `codex-resume-hook`

### A project declares which functions it runs

**Problem:** The harness prepared and charged for programming in every project: the code map's prompt hook fired on 33 of 55 real prompts here, 16 of them pasting about 4,000 tokens, often with no code intent (`odd/tasks/f2-context-diet.md`, T3). The owner's order (lead's transcript `65318fd5`, line 8250): "hagamos el harnes para que funcione con codigo y sin codigo ... osea que sea a demanda".
**Requirement:** Switches under `harness.json` "functions" (the code map, the language server, the Codex review) take on, off or auto; a missing key is auto and never an error. Auto resolves from the names of the project's files by a closed, positive list of program extensions and build files, and every resolution carries its reason. An unknown name or value is an error and reads as on; files that cannot be listed read as on. A person sees each switch, its value here and why; applying them makes the clone what they ask (the index, the push check, the keys of the clone's local settings), recorded so uninstall undoes it. The switches can be read from a commit as well as from the working tree, so a check reads the switches of the commit it judges.
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
**Requirement:** Under "Commands", exactly one section per command of the help, in the same order and no other, each with a fenced example from a real run; "Install", then "Remove", then "Commands". Headings inside fences are not headings of the page.
**Reason:** A command added, renamed or removed without its section fails a test instead of going stale.
**Proof:** `node --test bin/readme.test.mjs`
**Discarded:** None recorded.
**Today:** `README.md`, `bin/readme.test.mjs`, `bin/js-harness.mjs`

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
**Requirement:** Before a release, one run of the journey starts a real host session in the practice project, under a home of its own, and shows from the host's own stream that it lists both installed skills, answers a word only `AGENTS.md` holds with no file tools, runs every session-start and after-tool hook entry with the practice copy of the command, and leaves no trace in the real home. A host that cannot answer (a cap, a login, a timeout) is told apart from a fault of the harness, and the spend of every call is recorded.
**Reason:** Every other check reads files; only a host session proves the host reads them. It spends a model, so it is small (three calls on the cheapest model) and can be turned off.
**Proof:** `node --test scripts/practice-host.test.mjs`
**Discarded:** Telling the hooks apart by their command: the stream carries none. Proving the sandbox by a new projects folder: an earlier session leaves one. The model alias: it may resolve to an older model, so the model is named. Not proven: that Codex loads its hooks and skills.
**Today:** `scripts/practice.mjs`, `scripts/practice-lib.mjs`

### The reply check

**Problem:** `AGENTS.md` asks every reply to end with one of four states (working, decision, cut, finished), because the owner often answers from his phone by tapping the suggested prompt and reads only the last lines; the rule acted only through each session's memory, and replies closed with no state, with two, with a decision asked while work ran, or with a block to send outside a cut (`odd/tasks/rule-hierarchy.md`, C1).
**Requirement:** Where the nearest `harness.json` asks for it, a stop hook reads the reply that ends a turn and turns it back, with the shape to follow, when it does not close with exactly one state in the labels the project names, or when that state lacks what it needs: working says what wakes the session, a decision is never asked while background work runs, a cut carries exactly one block of only what the owner sends under its three labels, finished names the session to return to. Anywhere else it answers that the session may stop; a `harness.json` that is not JSON is said on standard error, never taken for a project that did not ask. It writes nothing and always exits 0, on both hosts.
**Reason:** A rule that only memory holds is the failure the rule hierarchy exists to end; a stop hook is the one reader every reply meets. It acts only where a project asks, so installing it changes nothing elsewhere.
**Proof:** `node --test bin/lib/reply.test.mjs`, `node --test bin/reply.test.mjs`
**Discarded:** A check of the cut's resume prompt and `/compact` shapes: the owner never compacts by hand any more. Naming the owner's open items in the reply: the board already computes them.
**Today:** `bin/lib/reply.mjs`, `bin/reply.mjs`, `js-harness reply`, `claude-reply-hook`, `codex-reply-hook`

### The specification stays alive

**Problem:** The owner asked for one complete document that says what the harness is, alive and updated as changes are made, from which a more capable model could rebuild it "perfecto solo con ese documento" (lead's transcript `65318fd5`, line 13936; `docs/ROADMAP.md`, "The specification of the harness").
**Requirement:** This file holds one entry per capability with the six fields, and a commit is refused when an entry lacks a field or a proof command, when a file its Today line names does not exist, or when a command of the dispatcher, an entry the manifest installs or a file written under the home is claimed by no entry.
**Reason:** A document kept alive by remembering goes stale; one held by the gate cannot lose a piece silently.
**Proof:** `node --test bin/lib/spec.test.mjs`
**Discarded:** A description of the pieces as they stand: it reads as today's architecture, and a rebuild would copy it. Principles alone: nothing can be rebuilt from a philosophy.
**Today:** `docs/SPEC.md`, `bin/lib/spec.mjs`, `bin/check.mjs`
