# Reading js-harness cold

This page is the entry for a model, or a person, that has never seen js-harness and is asked to audit it
whole: what is right, wrong, improvable, redundant, blocking or unnecessary. It says what the project is,
which document is in force and which is history, and how to read all of it in pieces that each fit one
context. It does not repeat what the documents below say; it points to them.

## What the project is

js-harness is a small, zero-dependency Node package that sets up Claude Desktop's Code tab, with Codex as
its reviewer, on top of a stack it does not rebuild (engram, codegraph, `/goal`). Its bet, that a stronger
model needs a smaller harness, and how the repository works are in `AGENTS.md`, which every session loads.
How sessions work with the owner is in `CLAUDE.md`. The map is `docs/SPEC.md`: one entry per capability,
each with its problem, requirement, reason, proof, what was discarded and the files that hold it today,
then the architecture as it stands. The plan, with what is decided, done and open, is `docs/ROADMAP.md`;
the reasoning it came from is `docs/origin.md`, frozen. Each piece of work has a feature document under
`odd/tasks/`, opening with its contract and closing with its Log, where the owner's words and decisions are
quoted with their dates.

## How to read it

1. Run `js-harness docs plan` in a checkout. It prints every tracked file in exactly one slice, in four
   tiers read in order: the core (this page, the map, what loads every turn, the plan, the rules, the
   failures, then the source in the order of the map's capabilities), the tests, the feature documents
   (each with its state, open or closed, from its task boxes) and the rest. Figures are estimated tokens,
   characters over four, which undercounts code and Spanish by up to about 1.5 times.
2. A slice holds at most 400,000 estimated tokens, 40% of a 1M window, so the auditor keeps room for its
   instructions, its reasoning and its findings. For another window, pass `--budget` at 40% of it; a
   smaller budget reads deeper, in more slices. Every slice after the first opens with this page.
3. Read one slice a context, and keep a findings ledger across them, at most 50,000 estimated tokens, one
   entry a finding: the claim; its evidence, a `path:line` or a command and its output; the questions it
   leaves for another slice (a caller, a test, a rule read elsewhere); and what the slice covered. Each
   slice starts by reading the ledger and answers the questions it can.
4. Close with one pass over the ledger alone, for what only a comparison across slices shows: what is
   done twice, what blocks other work, and what nothing needs. The capabilities, rules and failure entries
   no other record reaches are where to look first for the last.

The earlier whole-harness audit, before the 1.0.0 tag (`odd/tasks/launch-audit.md`, closed), kept one
ledger with a stable id per finding and a refuter per judgment (`odd/tasks/launch-audit/`); its per-file
inventory, `odd/tasks/launch-audit/inventory.tsv`, is historical and stale, superseded by `docs plan`,
which computes the same placement each time instead of storing it.

Known open contradictions, so an auditor does not spend a slice finding them: `CLAUDE.md`, "Running what
costs, and review", still names gentle-ai reviews, though the workflow no longer depends on gentle-ai
since F8's S11 (`docs/ROADMAP.md`); those lines are the owner's to change.

## Statuses

- **live**: in force and kept true; a change of the code that falsifies it is a defect.
- **frozen**: kept as written on its date and never edited; read it as a record, not as today.
- **historical**: true when written, then superseded; the row names what supersedes it.
- **closed**: work that ended; the row names where its result lives.

A folder's row is the status of its files; a file inside it may have its own row, which overrides it. The
`docs` row of `js-harness check` fails when a file or folder of `docs/` has no row here, or a row names
nothing there.

## Index

| Document | Status | Superseded by, or where its result lives | What it is |
|---|---|---|---|
| `docs/README.md` | live | | this page: the entry of a cold audit |
| `docs/SPEC.md` | live | | the map: every capability with its reason and proof, then the architecture as it stands |
| `docs/ROADMAP.md` | live | | the plan: principles, phases, what is decided, done, next and open |
| `docs/RECORDS.md` | live | | the fields of each record the harness writes, a section per row of SPEC's "Where state lives" |
| `docs/RULES.md` | live | | the rules, rendered from `bin/lib/rules-data.mjs` by `js-harness rules render`; not edited by hand |
| `docs/rule-sources.json` | live | | the source of each rule: the owner's quoted words or the design that set it |
| `docs/FAILURES.md` | live | | the failures register: each failure, its sightings and the control that stops it |
| `docs/FLAKY.md` | live | | the quarantine ledger of flaky test files |
| `docs/GUIDE.md` | live | | the user's guide: what the harness does for the owner and how to use it |
| `docs/future-model.md` | live | | the protocol for a new model: measure, change one component at a time |
| `docs/todo.md` | live | | the inbox of what is not a task yet |
| `docs/live-board.html` | live | | the source of the live board's published page, whose rows `js-harness sessions live` gives |
| `docs/origin.md` | frozen | | the reasoning the plan came from |
| `docs/model-effort.md` | frozen | | the owner's decision on model and effort by kind of work, as of 2026-10-11 |
| `docs/sweep-2026-10-11.md` | historical | `docs/ROADMAP.md` and `docs/todo.md` hold what is open now; 47 of its items were left unchecked, not reconciled | the places where old information stood beside new on 2026-10-11 |
| `docs/research/` | frozen | | research the owner asked to keep for later use |
| `docs/proposals/` | historical | `docs/ROADMAP.md`, phase F8, which carries what was decided of them | proposals put to the owner, each with its status line |
| `docs/audits/` | historical | `docs/ROADMAP.md` for the state since; each record is true on its date | dated audits of the machine and the repository |
| `docs/host-updates/` | live | | one record per Claude app update, each change adopted, adapted or ignored, with its sources |
| `docs/sessions/` | historical | the feature documents of `odd/tasks/` and the channel | summaries of the early sessions |
