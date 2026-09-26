# Roadmap

The one living plan of js-harness: what is decided, what is done, what is next, and which
decisions are still open. Each fact lives in one place:

- **This file** — the plan. What comes next is read here and nowhere else.
- [origin.md](origin.md) — where the plan came from, frozen: the founding pre-plan with the
  reasoning and sources behind it. It is not edited; what changed since is recorded here.
- `odd/tasks/<feature>.md` — one feature's tasks, progress and evidence. Its next step covers
  only that feature.

## Origin

js-harness is the rebuild of an earlier harness (`D:\harness`, now a read-only reference). The
bet: a stronger model needs a smaller harness — little instruction, many executable checks — on
top of gentle-ai (workflow, TDD, review), engram (memory), codegraph (code graph), context7 (docs)
and native `/goal` (autonomy loop). This repo builds only what those leave open.

## Principles

1. **Few instructions, many sensors.** A check that runs costs zero tokens per turn and cannot be forgotten.
2. **Every component must earn its place.** Each new model: remove one piece, measure, keep what still matters.
3. **Do not rebuild the stack.** Workflow, task docs, TDD and review are gentle-ai's; memory is engram's; the code graph is codegraph's; the loop is `/goal`.
4. **Context, not commands.** What the project is, what good looks like, and the reason behind each real constraint.
5. **Portable by default.** `AGENTS.md` is the single source Claude Code, Codex and Antigravity read.
6. **Measure the real payload.** The budget gate counts everything that loads each turn, not only `AGENTS.md`.

## Measured starting point (2026-09-26)

First request of a one-word prompt, estimated tokens:

- Claude Code 2.1.283 in an empty folder: ~107.8k. Tools 77.4k — of which the claude.ai Magnific
  connector alone is 37.3k (150 tools) and nothing in the stack uses it; global `CLAUDE.md` 17.5k
  (the gentle-ai managed block is most of it); environment, MCP instructions and skills list 11k.
  Measured with `--print`, which defers no tools, so the tool figure is an upper bound.
- Codex CLI 0.157.1: ~14.5k of injected context measured (global `AGENTS.md` 7.3k). Through a
  custom provider Codex sent no tools and no base instructions, so this is partial.

## Decided

| Area | Decision |
|------|----------|
| Name, home | `js-harness`, `D:\js-harness`, `github.com/jsaristi/js-harness` (private) |
| Hosts | Claude Code and Codex (CLI + desktop) now; Antigravity later, once its model is worth adopting |
| Stack | gentle-ai (ODD, RDD review, strict TDD), engram v2 binary only, codegraph, context7, `typescript-lsp` plugin; graphify for non-code corpora only |
| Instruction source | `AGENTS.md` only — Claude Code reads it natively |
| Distribution | A zero-dependency npm package with a `js-harness` bin; semver, git tags, releases |
| Commands | `install`, `sync`, `status`, `update`, `upgrade`, `uninstall`, `check`, and a TUI |
| Reversibility | Every file written outside the repo is in a manifest (path + sha256); uninstall is exact |
| Per project | A project pins its version in a `harness.json` it commits (not built yet) |
| Review | gentle-ai RDD on every candidate; Sebastián pre-grants consent |
| Effort | `medium` by default, `high` for design; the cap is `maxEffortLevel: "high"` in user settings |
| Autonomy | Native `/goal <condition>`, not a loop of our own |
| Context | `autoCompactWindow: 500000`; `/compact` within a task, a fresh session for a new task; state lives in files, not a handoff ritual |

## Phases

| Phase | Done when | State |
|-------|-----------|-------|
| F0 Safeguard and baseline | Old repos committed and pushed; per-turn payload measured on Claude and Codex; old folders marked read-only | Done 2026-09-26 |
| F1 Skeleton | `AGENTS.md` ≤ ~1.5k tokens with the prompt audit applied; a dependency-free `check`; pre-commit wired | Done — `AGENTS.md` 691 tokens (`odd/tasks/f1-skeleton.md`) |
| Install and update | `npm run check` and `npm run e2e` pass; the TUI opens with no arguments in a terminal | Done and reviewed; merge PR `jsaristi/js-harness#1` open (`odd/tasks/install-update.md`) |
| F2 Context diet | The budget gate measures the full payload (global `CLAUDE.md` + hooks + `AGENTS.md`); codegraph prompt hook measured with and without; gentle-ai v4 adopted when released; block exclusion via gentle-ai #4036 if it ships | Next |
| F3 Task contract | The contract template in [origin.md](origin.md#task-contract-template) + a validator that rejects a contract without a done-when command + fit with the ODD feature doc and `/goal` | — |
| F4 Sensors | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | — |
| F5 Evals that discriminate | Tasks hard enough to separate configs (0 of 32 did at the start); A/B minimal vs current config at medium and high | — needs Sebastián's spend approval |
| F6 Codex parity | The eval tasks run on Codex; differences measured and written down | — |
| F7 Future-model protocol | A written procedure: measure payload, run evals, strip one component at a time | — |

## Next

1. Sebastián merges `jsaristi/js-harness#1`.
2. Open decision 1 below: where upgrades come from.
3. F2 Context diet.

## Open decisions (Sebastián's, asked one at a time)

1. Where upgrades come from: npm publish, or GitHub releases (a private repo needs auth to download).
2. Disconnecting the unused Magnific connector (the largest single per-turn item).
3. Permission mode: currently `bypassPermissions`; the documented alternative is auto mode. He changes it himself.
4. Whether the Gentleman persona stays part of the stack.
5. Spend ceiling for F5.

## Risks

- gentle-ai v4 may change formats mid-way.
- gentle-ai #4036 may never ship, leaving the largest block uncontrollable.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.
