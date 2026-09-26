# Harness v2 — pre-plan: rebuild small, on the stack we chose

> **Status (imported 2026-09-26).** Copied in full from `D:\harness\docs\harness-v2-preplan.md`,
> the founding document of js-harness; the text below is unchanged. Since it was written: open
> decision 1 (location and name) is resolved as `js-harness` in `D:\js-harness`; F0, F1 and
> install/update are done, per [ROADMAP.md](ROADMAP.md). Paths below that point into `D:\harness`
> (`PLAN.md`, `bin/payload-probe.mjs`, `npm run budget:wire`) belong to that read-only repo.
>
> **Frozen.** This file is history — the reasoning and sources behind the plan — and is not edited.
> The living plan, including what is next and every open decision, is [ROADMAP.md](ROADMAP.md).

Decided 2026-09-25/26 with Sebastián. The harness is rebuilt **from scratch**, for Claude Opus 5.5
and the models after it, on top of gentle-ai (ODD), engram, codegraph and context7. The thesis,
confirmed by three independent sources below: a stronger model needs a **smaller** harness —
less instruction, more executable checks. This file is the starting point of the next session;
`PLAN.md` decision 14 points here.

## Quick path — how the next session starts

1. Read this file, then `PLAN.md` decision 13 and 14. Nothing else is needed to start.
2. Take the first open decision below (repo location and name) — it blocks F1.
3. Run F0. Its done-when is in the phase table.

## Decisions already made

| Area | Decision |
|------|----------|
| Scope | Rebuild from scratch. `D:\harness`, `D:\harness-lab` and `D:\harness-backups` become read-only references; mine them, never copy. |
| Hosts | Claude Code and Codex (CLI + desktop) now; Antigravity later, once its model is worth adopting. Gemini, Kilo, OpenCode and Copilot CLI were uninstalled. |
| Stack | gentle-ai (ODD workflow, RDD review, strict TDD), engram v2 **binary only** (no plugin), codegraph, context7, `typescript-lsp` plugin. graft and graphify's role in code were dropped; graphify stays for non-code corpora only. |
| Instruction source | `AGENTS.md` only — Claude Code 2.1.283 reads it natively (wire-measured, decision 13). |
| Effort | `medium` by default, `high` for architecture/design. Never `low`, never `xhigh`/`max`: enforced by `maxEffortLevel: "high"` in user settings, not by memory. |
| Autonomy | Use native `/goal <condition>` instead of building a loop. |
| Context | `autoCompactWindow: 500000`; `/compact <what to keep>` within a task, a fresh session for a new task. State lives in files (ODD feature doc, commits, engram), not in a handoff ritual. |

## What was measured (and where)

| Fact | Evidence |
|------|----------|
| The doctrine was sent twice per turn (native `AGENTS.md` + the old projection) | `npm run budget:wire`, 2026-09-25 — fixed in commit `e9c568c` |
| ~21.6k tokens of instructions load every turn; the harness governed 1.7k of them | Wire capture: `~/.claude/CLAUDE.md` ≈17.6k (the gentle-ai `sdd-orchestrator` block alone ≈10.8k), codegraph prompt hook ≈4k per prompt, `AGENTS.md` ≈1.7k |
| Rules did not buy points on a strong model | `PLAN.md` "Phase 1's first measured number": `b-bare` scored the same as configs with rules |
| Over-prescriptive prompts reduce quality on current models; prohibition lists can anchor the failure | Anthropic prompt-audit guide and Opus 5.5 migration guide (claude-api skill) |
| Opus 5.5 at `medium` matches or beats Opus 5 at `high` on coding; $4/$20 per MTok, cache reads $0.20 | Opus 5.5 migration guide |
| SDD is retired from gentle-ai; ODD becomes the only workflow | gentle-ai PR #4967, merged 2026-09-25, ships in v4 (unreleased at writing) |
| Retiring SDD shrinks the managed block only ~10–20%; ODD (~3.6k), review contract (~3.5k), defect handoff (~2k) remain | Section sizes of the installed block, 2026-09-26 |
| Excluding managed CLAUDE.md blocks is not supported yet | gentle-ai issue #4036 (open) |
| codegraph vs graft on this repo: graft ~half the tokens per answer but missed the pre-commit hook codegraph found | 3-question A/B, 2026-09-26 |

## F0 baseline — per-turn payload, 2026-09-26

First request of a one-word prompt, estimated tokens (chars / 4). Raw captures are machine-local.

| Host | Where | Total | Breakdown |
|------|-------|-------|-----------|
| Claude Code 2.1.283, `claude --print` via `bin/payload-probe.mjs` | empty folder | ~107.8k | tools 77.4k (213: claude.ai **Magnific connector 37.3k / 150 tools**, builtin 32.3k, engram 5.0k, Claude Docs 1.2k, context7 1.2k, codegraph 0.4k) · global `CLAUDE.md` 17.5k · environment + MCP instructions + skills list 11.0k · system 1.6k |
| same | `D:\harness` | ~110.7k | as above + `AGENTS.md` 1.8k + session-start hook output |
| Codex CLI 0.157.1, `codex exec` via a loopback custom provider | empty folder | ~14.5k measured | global `~/.codex/AGENTS.md` 7.3k · skills list 3.5k · engram protocol 2.3k · multi-agent role 0.6k · rest 0.7k |

Limits of this measurement:
- `--print` sent all 213 tools with none deferred; interactive sessions defer MCP tools behind
  tool search, so 77.4k is an upper bound for interactive turns.
- Through a custom provider Codex sent **no tools and no base instructions**, so its figure is
  the injected context only, not the full payload.
- The single largest item on Claude is a claude.ai connector (Magnific) that no part of the stack
  uses. Disconnecting it is an account setting — Sebastián's call; F2 re-measures after.

Safeguard: `harness-lab` pushed to `origin/codex/consumer-recovery`; `abogadaclaudiajimenez` pushed
to `origin/wip/harness-v2-f0-safeguard` — **not `main`, because `main` deploys to production** —
and its local checkout was left on that branch. Its `.codegraph/` index stays local and untracked.

## Principles

1. **Few instructions, many sensors.** A check that runs costs zero tokens per turn and cannot be forgotten.
2. **Every component must earn its place.** Each new model: remove one piece, measure, keep what still matters.
3. **Do not rebuild the stack.** Workflow, task docs, TDD and review are gentle-ai's; memory is engram's; the code graph is codegraph's; the loop is `/goal`.
4. **Context, not commands.** What the project is, what good looks like, and the reason behind each real constraint. No "MANDATORY", no prohibition lists.
5. **Portable by default.** `AGENTS.md` is the single source Claude Code, Codex and Antigravity read.
6. **Measure the real payload.** The budget gate counts everything that loads each turn, not only `AGENTS.md`.

## Phases

| Phase | Goal | Done when | Effort |
|-------|------|-----------|--------|
| **F0 Safeguard and baseline** | Lose nothing; know the starting point | `harness-lab` (162 uncommitted files) and `abogadaclaudiajimenez` (27) committed and pushed; per-turn payload measured on Claude **and** Codex; the three old folders marked read-only reference | medium |
| **F1 Skeleton** | New minimal repo | `AGENTS.md` ≤ ~1.5k tokens written with the prompt audit applied; a dependency-free `check` command; pre-commit wired | high |
| **F2 Context diet** | Shrink what loads each turn | Budget gate measures the full payload (global CLAUDE.md + hooks + AGENTS.md); codegraph prompt hook measured with/without; gentle-ai v4 adopted when released; block exclusion via #4036 if it ships | medium |
| **F3 Task contract** | The loop with a stop condition | Template below + a validator that rejects a contract without a done-when command + fit with the ODD feature doc + `/goal` | high |
| **F4 Sensors** | Quality without tokens | Tests, lint/LSP diagnostics, budget and RDD-by-risk wired to pre-commit and `check` | medium |
| **F5 Evals that discriminate** | Answer "does this help?" | Tasks hard enough to separate configs (today 0 of 32 do); A/B minimal vs current config at medium and high — **needs Sebastián's spend approval** | high |
| **F6 Codex parity** | Same behavior on Codex | The eval tasks run on Codex; differences measured and written down | medium |
| **F7 Future-model protocol** | Ready for the next model | Written procedure: measure payload, run evals, strip one component at a time | medium |

Estimate: ~9–12 sessions, 2–3 calendar weeks. The bottlenecks are F2 (waiting for gentle-ai v4)
and F5 (spend), not the building. Recalibrate after F0–F1.

## Task contract template

```markdown
## Goal
<one sentence: the outcome, not the steps>

## Why
<the reason — lets the model make judgment calls you didn't foresee>

## Done when
- `<command>` exits 0            # executable, never prose
- <observable behavior a human can check>

## In scope / Out of scope
- In: <areas it may touch>
- Out: <areas it must not touch, and why>

## Constraints
- <real constraint> — because <reason>

## Effort
medium | high

## Ask me before
<the few decisions that are mine: spend, irreversible, product choices>
```

## Not built (the stack already does it)

Workflow and task tracking (ODD), review (RDD), memory (engram), code graph (codegraph), autonomy
loop (`/goal`), context meter (status line, `/context`), handoff machinery (ODD doc + `/resume`),
usage census (`/usage`, `/insights`).

## Worth mining from the old folders (rewrite, never copy)

- `D:\harness`: `payload-probe` (wire capture), `budget-check`, the eval runner, evidence discipline.
- `D:\harness-lab`: verification receipts and the `status` command idea.

## Risks

- gentle-ai v4 may change formats mid-way.
- #4036 may never ship, leaving the largest block uncontrollable.
- Opus 5.5 defaults may shift after launch.
- Discriminating evals cost money.

## Open decisions (ask one at a time)

1. Location and name of the new repo — blocks F1.
2. Permission mode: currently `bypassPermissions`; the documented alternative is auto mode. Sebastián changes it himself.
3. Whether the Gentleman persona stays part of the stack.
4. Spend ceiling for F5.

## Session environment as of 2026-09-26

User settings: `modelSettings.claude-opus-5-5.effortLevel = medium`, `maxEffortLevel = high`,
`autoCompactWindow = 500000`, status line = locally installed `ccstatusline@2.2.30`.
Plugins: `codex@openai-codex`, `typescript-lsp@claude-plugins-official` (with
`typescript-language-server@6.0.1` and `typescript@6.0.3` on npm global — TS 7 ships no tsserver).
MCP: codegraph, context7, engram. RDD review is on; `claude auth login` is required for its reviewer.

## Sources

- [Harness design for long-running apps — Anthropic](https://anthropic.com/engineering/harness-design-long-running-apps)
- [Effective harnesses for long-running agents — Anthropic](https://anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Session management and 1M context — Anthropic](https://claude.com/blog/using-claude-code-session-management-and-1m-context)
- [`/goal` — Claude Code docs](https://code.claude.com/docs/en/goal) · [Costs](https://code.claude.com/docs/en/costs) · [Model config](https://code.claude.com/docs/en/model-config)
- [Harness engineering — Martin Fowler](https://martinfowler.com/articles/harness-engineering.html)
- [Harness Engineering: eleven systems (arXiv 2609.00006)](https://arxiv.org/pdf/2609.00006)
- gentle-ai: releases v3.0.0–v3.7.0, PR #4967, issues #4959 and #4036
