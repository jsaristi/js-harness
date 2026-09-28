# F2 — Context diet

Locator: `odd/tasks/f2-context-diet.md` · Engram mirror: `odd/f2-context-diet/tasks` · Branch: `feat/context-diet`

## Objective
Make the budget gate see the whole payload that loads on every turn in Claude Code and Codex, not
only this repo's `AGENTS.md`, and measure the per-prompt hooks, so the diet targets the biggest
items with numbers instead of guesses.

## Why
Roadmap principle 6: measure the real payload. `bin/check.mjs:17` (`checkBudget`) reads only
`<cwd>/AGENTS.md` (691 tokens today) against a 1,500-token budget, while the global `CLAUDE.md`
alone is ~17.6k tokens. A gate that sees 4% of the payload cannot steer the diet.

## What loads today (measured 2026-09-27, chars / 4)
| Host | Source | Chars | ~Tokens |
|------|--------|------:|--------:|
| Claude | `~/.claude/CLAUDE.md` (gentle-ai managed block + user rules) | 70,593 | 17,649 |
| Claude | output style `~/.claude/output-styles/gentleman.md` | 6,451 | 1,613 |
| Claude, Codex | project `AGENTS.md` | 4,565 | 1,142 |
| Claude | auto-memory index `~/.claude/projects/D--js-harness/memory/MEMORY.md` | 233 | 59 |
| Codex | `~/.codex/AGENTS.md` | 29,128 | 7,282 |
| Codex | `model_instructions_file` `~/.codex/engram-instructions.md` | 9,422 | 2,356 |

Hooks that can add text to the context (stdout of `UserPromptSubmit` every turn, `SessionStart`
once per session):
- Claude `UserPromptSubmit`: `codegraph.cmd prompt-hook` (see T3), `gentle-ai skill-registry
  refresh --quiet` (0 bytes of stdout, measured), orca `claude-hook.cmd` (prints `{}`, a no-op).
- Claude `SessionStart`: `gentle-ai review stop-hook`, herdr state script, `js-harness doctor
  --hook` (`systemMessage` only), orca hook. Codex `SessionStart`: skill-registry refresh, herdr,
  `js-harness doctor --hook`.

Not measurable from files: tool schemas, MCP server instructions, the skills list and the host's
own system prompt (the roadmap's `--print` baseline covers those).

## Scope
- In: a payload measurement module, its report in `js-harness check`, the codegraph hook
  measurement, and the roadmap update.
- Out: editing any file outside this repo (the global `CLAUDE.md` is gentle-ai's; trimming it
  waits on gentle-ai #4036), executing hooks from `check` (some write files), and tool schemas.

## Constraints
- `check` stays deterministic and read-only: it reads files, it never runs a host hook.
- The hard budget stays on what this repo owns (`AGENTS.md`); the machine payload is reported
  per source, not failed on, because no commit here can shrink a file gentle-ai manages. A
  ceiling for the full payload is set once #4036 or v4 makes it controllable.
- Tests use a throwaway home and fixture files, never the real home.

## Acceptance criteria (done when)
- `js-harness check` prints, per host, each per-turn source with its path and estimated tokens,
  a host total, and the context-injecting hook commands; a missing source reads `not found`.
- The `budget` row still fails only on `AGENTS.md` over 1,500 tokens.
- The codegraph prompt hook cost is recorded with and without it.
- `npm run check` passes.

## TDD
Mode: strict (source: user global config). Runner: `node --test`.

## Delivery
Strategy: ask-on-risk. Forecast: ~300 authored lines (module, tests, check wiring) — one slice.

## Tasks
- [ ] T1 `bin/lib/payload.mjs`: per-host sources (Claude: global `CLAUDE.md`, output style from
  `settings.outputStyle`, project `AGENTS.md`/`CLAUDE.md`, auto-memory index; Codex: global
  `AGENTS.md` or `AGENTS.override.md`, `model_instructions_file`, project `AGENTS.md`) and hooks
  on `UserPromptSubmit`/`SessionStart`, with fixture tests — route: delegated writer (2
  non-trivial files)
- [ ] T2 `check` prints the payload report and takes `--home`; the budget row is unchanged —
  route: inline (one file plus its test, once T1 fixes the shape)
- [x] T3 codegraph prompt hook measured with and without, recorded in the roadmap — route: inline
  (measurement)
- [ ] T4 gentle-ai v4 adopted when released — blocked: latest is v3.7.0 (2026-09-23)
- [ ] T5 Block exclusion via gentle-ai #4036 — blocked: issue open, last update 2026-09-12

## Progress
- 2026-09-27: explored `bin/check.mjs`, both hosts' instruction files and hook configs; document
  created (`5291598`).
- T3: replayed the 55 user prompts in this project's Claude transcripts through `codegraph.cmd
  prompt-hook` (codegraph 1.6.0, today's index, `{prompt, cwd}` on stdin). Without the hook: 0
  tokens. With it: 33 of 55 prompts (60%) get an injection; 17 get a symbol pointer (~130–520
  tokens), 16 get a full exploration of ~4.0k tokens each (16,223 chars) — 65.8k tokens in all,
  ~1.2k per prompt on average, median 170 when it fires. The full explorations include prompts
  with no code intent (e.g. a request to add a line to `AGENTS.md` pulled 40 symbols from 4
  files). Each injection stays in the conversation, so it is paid again on every later turn
  (cached). Whether to keep, narrow or drop the hook is Sebastián's call (roadmap open
  decision 5); whether it improves the work is an F5 eval question. Script:
  scratchpad `cg.mjs`, not committed (it reads private transcripts).

## Next step
T1.
