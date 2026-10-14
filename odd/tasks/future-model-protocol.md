# Future-model protocol

Locator: `odd/tasks/future-model-protocol.md` · Engram mirror: `odd/future-model-protocol/tasks` ·
Branch: `docs/future-model-protocol` · Delivery: `ask-on-risk` · Runner: `node --test` · Session:
`JH 14 · protocolo para modelos futuros`, opened by the lead on 2026-10-14.

## Goal
When a new model arrives, a written procedure says how to measure the harness's payload, run the
evals, strip one component at a time and keep what still earns its place, with the cost of every
run stated before any spend; and the rule hierarchy's seven signals are read and recorded.

## Why
The design bet of `AGENTS.md`, "a stronger model needs a smaller harness", is only a bet until
something tests it on each new model. Principle 2 of the roadmap ("Each new model: remove one
piece, measure, keep what still matters") has had no procedure since the founding plan
(`docs/origin.md:75`, `:92`), and F5 measured the current stack at 1.68 to 2.54 times the cost of
the minimal one for the same score.

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/future-model-protocol.md` exits 0
- `npm run check` exits 0
- `docs/future-model.md` holds the procedure, each step naming its command or its gap, and the
  roadmap's F7 row points to it (the roadmap is JH 7's: the change goes through the lead)
- The seven signals are read and recorded under "The seven signals" below, each with the command
  that showed it

## In scope / Out of scope
- In: `docs/future-model.md` (new), this document; the gaps G1 to G7 once he or the lead clears
  them as tasks of this feature (`evals/`, a payload command, a check row).
- Out: `docs/ROADMAP.md` and `odd/tasks/rule-hierarchy.md`, which are JH 7's (what changes there
  goes through the lead); running any eval, which is spend and his.

## Constraints
- No gate turn until the WSL gate is on main (the opening, 2026-10-14) — because everything else
  is paused for it; a documents-only commit runs no sensor and takes no lock.
- No spend without his yes, asked through the lead — because spend is his.

## Effort
high

## Ask me before
Any eval run; building the gaps if the lead does not clear them as this feature's work.

## Specs

S1. F7, as the roadmap states it (`docs/ROADMAP.md:88`, `:179-180`): "A written procedure: measure
payload, run evals, strip one component at a time". The opening adds, a claim of the lead: "The
design bet of AGENTS.md ("a stronger model needs a smaller harness") is what it tests. Spend on
evals is his: the procedure says what a run costs and asks before any."

S2. T15 of `odd/tasks/rule-hierarchy.md:1619-1622`, verbatim: "T15 The seven signals read and
recorded; the roadmap's section replaced by a pointer only after what it holds and this document
does not (the reading of the specification, "how far is far enough", the bullets on bias and
research, the team rules) is in `docs/SPEC.md` or here". "Here" is `rule-hierarchy.md`; this
session does not edit it, so the reading and the carry list are written below and the pointer
waits for JH 7.

S3. The gaps of `docs/future-model.md`, version 2: G1 the payload of the eval home, G2 arms of
one component, G3 a cost statement before a run, G4 the whole first request measured by a
committed script, G5 the eval model chosen per run, G6 the setup recorded with a run, G7 a new
model noticed. Proposed, not asked for: each becomes a task only when cleared.

## The seven signals (read 2026-10-14, on `origin/main` at `d3f6ac1`)

From `odd/tasks/rule-hierarchy.md`, "Signals of done". One holds.

| Signal | Read with | Reading | Closed by |
|---|---|---|---|
| Six principles stated once | `rg -n -i "properly\|not to comply\|for the sake" AGENTS.md bin/lib/project.mjs bin/lib/manifest.mjs` | no hit: the first principle is in no file that should carry it | rule hierarchy T8, T9 |
| No principle without a control | `eza docs` | `docs/SPEC.md` does not exist | T1 |
| No rule living only in memory | `rg -n "memory-rules" bin` | no hit: the row of `doctor` is not built | T6 |
| `AGENTS.md` within its budget | `node -e "import('./bin/check.mjs').then(m=>console.log(JSON.stringify(m.checkBudget('.'))))"` | holds: `1499 estimated tokens (budget 1500)` | — |
| Honesty eval passes, line moves the score | `eza evals/tasks` | no honesty task: five tasks, those of F5 | T10 |
| No repeated mistake | `node bin/js-harness.mjs failures check --settled` | exit 1: 69 failures, 39 seen more than once, 17 not settled | the register's owners |
| No protocol without its incident | `rg -n "protocols" bin/lib/manifest.mjs` | no hit: the protocols skill is not built | T7 |

## What the roadmap's section holds and the rule hierarchy does not (S2)

Read by comparing `docs/ROADMAP.md:416-646` ("Rule hierarchy") with `odd/tasks/rule-hierarchy.md`
(C3 at `:228`, the `AGENTS.md` outline and the protocols at `:1290-1385`). For JH 7 to carry into
`docs/SPEC.md` or its document before the section becomes a pointer. Covered already: the five
parts and the "today" line of the specification (C3), the six principles (outline item 1), the
three words of a claim (item 4), the handoff shape and bad news first (protocol 6), the five
questions and a missing protocol proposed (protocol 4), C4 and C5 for "research well" and
"invent nothing".

Missing:

1. The reading of the specification: his correction, that the document says what the harness
   really is so a more capable model of a later generation could rebuild it from nothing and
   better, from that document alone; that the eval tasks are the measure of "better" and belong
   to the kit with it; that it is not loaded on every turn; and its limit, that the check proves
   every capability named and provable, not its reason well told (roadmap `:606-640`).
2. "How far is far enough": no point where a model never errs, and more text makes it worse; the
   three aims (a mistake cannot do damage that cannot be undone, it is seen quickly, it is not
   repeated); and "from there a rule enters only by replacing another" (`:557-564`).
3. Bias and research: what a reviewer is told to look for (a test weakened so that it passes, a
   hook skipped, a failing check left out of the report); bias answered by a second look that
   does not share it, a reviewer handed the code and not the conclusion, and before a conclusion
   that costs, the question of what would show it wrong; before running an unknown command, read
   its code; and "where it lives, judged twice", with the global `CLAUDE.md` line checked and the
   eval as the line's price (`:488-512`).
4. The team rules: each thing has one owner (a session writes its feature, one place writes the
   shared plan); what looks wrong is said, with its evidence, before it is done; reversible by
   default (what cannot be undone asks first, the rest records how it is undone) (`:513-539`).

## Design of G5, G6 and G3 (2026-10-14, read-only, not built)

By one planner on opus at high, from the code; the parent checked `evals/suite.test.mjs:75`,
`evals/codex-configs.mjs:80`, `evals/runner.mjs:515` and `evals/transcript-usage.mjs:300-315`.
Order of commits: G5, G6a, G6b, G3. Every results file stays readable: fields are only added,
`FORMAT` stays 1.

G5, `--model <id>` on `evals/suite.mjs`. `parseArgs` takes it as optional and adds it to the
parsed shape only when given; a Claude id must be a full `claude-…` id (the rule of
`evals/configs.mjs:281`); `--summary` refuses it. `model = args.model ?? (codex ? CODEX_EVAL_MODEL
: EVAL_MODEL)` replaces the constants where they are used (`:747`, `:749`, `:782`, `:785`), which
carry it to Claude's `--model` (`evals/configs.mjs:218`) and Codex's `-m`; the constants stay
exported as defaults. It is recorded as today's top-level `doc.model`; `runChanges` (`:306`) and
`checkRuns` (`evals/report.mjs:317`) already compare it, so a resume on another model, or without
the flag of a run recorded on another, is refused with the file untouched, and the message names
`--model <recorded>`. A model with no price row is warned about, not refused. The plan line names
the model. RED: parsed and absent shapes; alias, empty and `--summary` refused; Claude args and
`doc.model`; Codex `-m`; both refusals with unchanged bytes; both warnings; with no flag
`doc.model` is `EVAL_MODEL`. `evals/suite.test.mjs:75` asserts `--model` is unknown: it changes to
another unknown flag in the same commit. About 35 lines of source, 90 of tests.

G6a, the fingerprint. `sealTemplate` (`evals/home.mjs:250`) returns `fingerprint: { sha256, items
}`, sha256 over the sorted `path\0sha256(normalized bytes)` lines, taken before seeding so no
trial path is in it. Left out or normalized: the marker (`builtAt`, `warnings`); `.claude.json`
reduced to `mcpServers`; `.gentle-ai/state.json` without `last_update_check`, `last_synced_at`,
`rdd_mode_recorded_at`; Codex `config.toml` without `[projects.*]` and `[notice*]`
(`[hooks.state.*]` is trust, kept, to be checked first). Before trusting it: build the template
twice, hours apart, and diff the fingerprints (free). Also recorded: codegraph's version (missing
from `STACK_FIELDS`, `evals/suite.mjs:273`) and the js-harness commit of the workspace
(`evals/home.mjs:312`).

G6b, the refusal. Stored as top-level `setup`, not under `stack` (under it the report would refuse
to pool F5's minimal-only file with its current one). The suite compares it after `buildTemplate`
(`:774`) when `current` is in the run, as a new change kind `setup`, naming the items that
changed; exit 1, nothing written. `checkRuns` compares `setup` among runs holding `current`
trials; a missing one is "missing", so the F5 files still pool. RED: volatile keys leave it
unchanged and a `CLAUDE.md` change moves it; a resume on a changed setup refused with no runner
call; a minimal-only run records none; `checkRuns` refuses differing setups and still pools the
old fixtures; the build warnings at `evals/home.test.mjs:140` unchanged. About 110 and 190 lines;
hashing reads about 94 MB of the Codex plugin cache per invocation.

G3, `--plan`. A pure `evals/plan.mjs` on the pattern of `bin/lib/codex-review-plan.mjs`; the branch
runs after the results file is read, needs no token, login, stack probe or template, writes
nothing, exits 0. Per cell (task, config, effort, model, agent), the newest results file holding
it gives the mean `wallMs` and the cost (`costUsd` for Claude, `estimateCodexCost` for Codex); a
cell with no trial on this model is "unknown", never borrowed from another model or effort; the
cap line always says unknown; the source line names each file and date and says the time is
agent time without setup and the cost is list, not billed. RED: a known cell; an empty cell; other
models ignored; newest file wins; the cap line; no `runTrial`, stack read, template or file, and
no token; without `--plan` the plan line unchanged. About 140 and 160 lines.

## Tasks

- [x] T1 `docs/future-model.md`, version 1: the procedure, its cost table and its gaps (S1; route:
  inline; commit `43e9fdd`)
- [x] T2 A reader that did not write it attacks the procedure and looks for what is missing; its
  fixes taken or answered here, as version 2 (S1; route: one read-only reader on opus at high;
  L5)
- [x] T3 The seven signals read and recorded, and the carry list for the roadmap's section (S2;
  route: inline)
- [ ] T4 The roadmap's F7 row and checkbox point to `docs/future-model.md`, through the lead (S1)
- [ ] T5 G5 and G6, the eval model per run and the setup recorded with it: without G5 no step
  that spends can run on a new model (S3; after the WSL gate, if cleared)
- [ ] T6 G3, a cost statement before a run (S3; after the WSL gate, if cleared)
- [ ] T7 G2, arms of one component (S3; after the WSL gate, if cleared)
- [ ] T8 G1 and G4, the payload of the eval home and the whole first request (S3; after the WSL
  gate, if cleared)
- [ ] T9 G7, a new model noticed (S3; after the WSL gate, if cleared)

## Log

L1 (2026-10-14, the lead's opening, a claim; his words behind it are the founding plan,
`docs/origin.md:75` and `:92`): "F7, the future-model protocol (docs/ROADMAP.md line 88 and section
"F7 Future-model protocol" at line 179, owner none): a written procedure for when a new model
arrives: measure the payload, run the evals, strip one component at a time, keep what still earns
its place. The design bet of AGENTS.md ("a stronger model needs a smaller harness") is what it
tests. Spend on evals is his: the procedure says what a run costs and asks before any." And: "From
JH 7's odd/tasks/rule-hierarchy.md, T15 (line 1619): the seven signals read and recorded; the
roadmap's section replaced by a pointer only."

L2 (2026-10-14) The map, by one read-only explorer, spot-checked at `evals/suite.mjs:86`: the
payload is measured only inside `check` (`bin/lib/payload.mjs`, `measurePayload`); the suite takes
only the arms `minimal` and `current`; nothing estimates a run's cost before it spends; the
whole-request figure of 2026-09-26 has no committed script. Hence the gaps G1 to G4. Also read:
`evals/prices.mjs` gives no cost for a model it does not list, so pricing the new model is the
procedure's first step.

L3 (2026-10-14) T1 and T3 written. The cost table is derived from F5's means ($0.76 and $1.57 a
trial, about 3 minutes 40 seconds) and F6's per-trial range; a strip arm is costed at the
`current` figure, an upper bound. Next: T2, the reader.

L4 (2026-10-14) Committed as `43e9fdd`. Its pre-commit, a documents-only check, printed the
payload rows with no sensor run and no lock: Claude 25,104 estimated tokens per turn from files
(global `CLAUDE.md` 21,827, output style 1,778, project `AGENTS.md` 1,499), Codex 30,482 (global
`AGENTS.md` 26,001, model instructions 2,982, project `AGENTS.md` 1,499); tools and hook output not
counted. So the payload rows already come without a whole check, by a documents-only commit: G1 is
narrower than version 1 says.

L5 (2026-10-14) T2. One reader on opus at high, which did not write the procedure, found six
blockers and nine advisories; the parent checked three of them in the code
(`evals/suite.mjs:47-53`, the two model constants; `evals/report.mjs:162`, the Claude cost is
`costUsd`; `odd/tasks/codex-parity.md:723-792`, the cap windows) and all held. Version 2 takes
every one:
- Blockers: the eval model is a constant, so Step 4 could not run on a new model (G5, and Step 1
  says so); Step 1 priced only `evals/prices.mjs` while the Claude report reads Claude Code's
  `costUsd` and Codex's prices live in `evals/report.mjs` (both tables, and the smoke trials'
  `costUsd` checked against `listCost`); the Codex report needs `--results-dir
  evals/results/codex` and its suite command was not spelled out; Step 6 did not say how five
  tasks combine and its escape kept everything (a rule over the five tasks, a threshold fixed and
  told before spend, proposed at 10 percent, and an escape narrowed to a failure entry or a proof
  command); the component list was incomplete and called his machine js-harness's (read from
  `CLAUDE_ITEMS`, `CODEX_ITEMS`, the MCP servers and plugins, by kind and owner, with no size
  order until measured); nothing kept the base and the arms on one setup (frozen setup, one
  invocation, G6).
- Advisories: the cost table used pooled means and called a strip arm an upper bound (now F5's
  `medium` cells, $9.75 and $20.28, and a scale, not a bound; the Codex row in cap windows, about
  18 trials in the first and five of `current` in each later one, and the reviews that wait on the
  same cap); "minimal plus one" added beside "current minus one", chosen from Step 4, with pairs
  run together and a rule for a confirming run that loses; Step 5 gated on a discriminating task
  or his acceptance of cost alone; the trigger said "major version", which Claude Code 2.1.x never
  reaches (now B1's wording, and G7); B1's stale mark is not built (said); the preconditions
  (token, login hours, isolation probes, permission modes); Step 2's comparison is by hand;
  Step 3 is chars over four whatever the tokenizer, and the home that matters is the eval's;
  Codex's `current` sessions end on gentle-ai's questions.
- Not checked by the reader: the pricing pages, the carry list of S2. Next: T4 and the gaps,
  through the lead.

L6 (2026-10-14) PR jsaristi/js-harness#120 opened; the lead told of it, of T4, of the carry list
and of the gaps' order (G5+G6, G3, G2, then G1, G4, G7), not yet answered. A slip of this
session: a message to the lead gave the context share as "about 30%" without reading it;
`get_usage` read 42%, corrected in the next message; the same class as the register's
`hours-guessed` (a figure in a message not read in the step before), told to the lead for the
register. The design of G5, G6 and G3 written above, by a planner; it found five places where
version 2 did not match the code, taken into the procedure: the A/B arms keep no `listCost`, so
Step 1's cost check prices `modelUsage` as a range; base and arms in one invocation share one
template, so G6 matters across invocations (a resume after a cap, pooling); a plain hash would
refuse every resume; codegraph and the js-harness commit are not recorded; no results file
records a cap stop, so G3 leaves cap windows unknown.
