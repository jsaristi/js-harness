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

## Design of G2, arms of one component (2026-10-14, read-only, not built)

By one planner on opus at high, from the code and the marker lines of the real global files only
(never their text); the parent checked the config-name pattern (`evals/runner.mjs:771`).

Names. `--configs minimal,current,current-without-<id>,minimal-with-<id>`; a pair for
"current minus" only, ids sorted and joined by `_` (the runner refuses any name outside
`^[A-Za-z0-9.-]+(_[A-Za-z0-9.-]+)*$`, and the name is part of the trial key and of the raw logs'
file names, so no `:` or `+`). An arm needs its base in the run. A pure `evals/arms.mjs`
(`parseArm(name)` to `{ base, direction, components }`) replaces the fixed lists of the suite and
the report. A component must hold at least one file, key or marker pair in the template, or the
suite exits 1 before any trial: otherwise the arm is its base under another name.

Claude components: `claude-md`; the five gentle-ai blocks of the global `CLAUDE.md`
(`gentle-ai-codegraph-guidance`, `-persona`, `-engram-protocol`, `-orchestrator`,
`-agent-routing`, cut by their marker lines with a depth counter, refusing an unbalanced,
duplicated or missing marker); `claude-md-own` (the lines outside every block); `skills`;
`js-harness` (its skill folders and its hook entries, from `entryComponents` of
`bin/lib/manifest.mjs`); `agents`; `output-style`; `hooks` (the settings key and the folder:
22 entries over 12 events from at least four owners, kept whole); `plugin-<name>`
(`enabledPlugins` false and its cache folder); `mcp-<name>`; `project` (no `js-harness init` in
the workspace). Codex: `agents-md`, the same five blocks in `.codex/AGENTS.md`, `hooks`,
`skills`, `plugin-<name>` and `mcp-<name>` (TOML tables, with the scanner behind
`withoutDesktopApp`), `project`; the engram instruction files go with `mcp-engram`.

"Minimal plus" is not general: minimal's `--setting-sources ""`, `--strict-mcp-config` and
`--disable-slash-commands` switch off settings, every MCP server and all skills. Addable:
`mcp-<name>` (by `--mcp-config`); `claude-md`, the blocks, `claude-md-own`, `agents`,
`output-style`, `hooks` by seeding only X and `--setting-sources user`, unverified. Only as
"current minus": `skills`, `js-harness`, `plugin-*`, `project`, and all of Codex. Before any
spend, `evals/isolation-probe.mjs` (a fake local API, no spend) is extended to check each arm has
its component and its base has not; every unverified entry stays refused until it passes.

"Current minus" is one template plus a filter per arm (`seedFromTemplate(dir, { without })`,
after the seed), not a template per arm, which would read the real home twice and break the
freeze. The setup stays one per run; each arm is pinned like a subagent config,
`doc.arms[name] = { base, components, sha256 }`, compared on a resume as a change kind `arm`. G6's
checks on `config === 'current'` (`evals/suite.mjs` template build and `setupChanges`,
`evals/report.mjs` `holdsCurrent`) widen to every config built from the template.

Results and report. An arm goes into its base's results file: Step 5 continues the Step 4 file
with the arm added, the base trials skipped as recorded and G6 refusing another setup. The report
keeps the minimal-against-current table, its JSON and `checkDiscriminating` byte-identical over
the committed F5 and F6 files (a preserving test first), and adds an arms section only when arm
trials exist: `compareCells(base, arm)` per task and effort, relabelled "with X" or "without X",
and one Step 6 line (tasks where X scores higher; total cost with and without X; the ratio; the
spread of the totals, which the report does not print today). `--plan` needs no change, one test.

Commits: C1 `arms.mjs` (about 110 / 120 lines of source / tests); C2 the suite's parsing (50 / 100);
C3a filters of paths and JSON (140 / 190); C3b markers and TOML (120 / 160); C4 the suite's wiring
and pins (80 / 160); C5 the report (150 / 210); C6a the probe, C6b `minimal-with` for Claude (about
120 / 150 each); C7 the documents. Risks: `enabledPlugins: false` and `--setting-sources user`
unverified, settled by the probe before spend; long arm names lengthen raw-log paths on Windows.

What it showed wrong in `docs/future-model.md`, Steps 5 and 6, to correct with C7: the global
`CLAUDE.md` is five gentle-ai blocks and a short section of his, not "a block and his sections";
"hooks" are settings entries of several owners, not a folder; "minimal plus one" holds only for
some components; whether Claude Code loads the project's `AGENTS.md` is unverified (`init` writes
no `CLAUDE.md`); "one invocation" contradicts the 15 trials an arm costs (the base is continued);
the report prints a pooled cost SD per task only, so the spread of a total must be defined.

## Tasks

- [x] T1 `docs/future-model.md`, version 1: the procedure, its cost table and its gaps (S1; route:
  inline; commit `43e9fdd`)
- [x] T2 A reader that did not write it attacks the procedure and looks for what is missing; its
  fixes taken or answered here, as version 2 (S1; route: one read-only reader on opus at high;
  L5)
- [x] T3 The seven signals read and recorded, and the carry list for the roadmap's section (S2;
  route: inline)
- [x] T4 The roadmap's F7 row and checkbox point to `docs/future-model.md`, through the lead (S1; the lead cleared this session to make the one-hunk edit itself, JH 7 being paused)
- [x] T5 G5 and G6, the eval model per run and the setup recorded with it: without G5 no step
  that spends can run on a new model (S3; route: inline). G5 `a23f834` and G6a `f6e09fc`, each
  assessed medium and under budget by gentle-ai; G6b, the record and the refusal, next; left of
  G6: codegraph's version and the js-harness commit
- [x] T6 G3, a cost statement before a run (S3; route: inline): `--plan` on `evals/suite.mjs`, with `evals/plan.mjs`
- [ ] T7 G2, arms of one component (S3; route: inline; designed, see "Design of G2"; commits C1 to C7;
  C1 `fa39244` and C2 `21a06bf` merged in #141; C3a `776b03a`, the filters of paths and JSON keys,
  see L17; C3b `9d82100`, the marker blocks, see L18; C3c `dde2216`, Codex's TOML tables and hook
  trust, see L19; C4 `8ce28f0`, the suite's wiring and pins; C5, the report's arms section, see
  L21, in #426; C6a, the probe, see L26, in #428; C6b, `minimal-with-mcp-<name>`, and C7, the
  documents, see L29)
- [ ] T8 G1 and G4, the payload of the eval home and the whole first request (S3; after the WSL
  gate, if cleared)
- [ ] T9 G7, a new model noticed (S3; after the WSL gate, if cleared)
- [x] T10 G6, last part: the version of codegraph and the js-harness commit of the workspace recorded
  with a run and compared on a resume (S3; route: inline; the lead, 2026-10-14 06:03)
- [ ] T11 The fingerprint held hours apart: the real templates of both hosts built twice, hours
  apart, outside the home, and their fingerprints compared; a difference names a volatile key to
  leave out (S3; route: inline, free)
- [x] T12 PR 130 holds main: once jsaristi/js-harness#124 is merged, `origin/main` merged in once,
  the gate passed, pushed, the lead told

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
register. It happened again at 03:00 ("45%", read next as 46%): twice, so the control proposed to
the lead is that the channel between sessions adds the sender's context share itself. The design of G5, G6 and G3 written above, by a planner; it found five places where
version 2 did not match the code, taken into the procedure: the A/B arms keep no `listCost`, so
Step 1's cost check prices `modelUsage` as a range; base and arms in one invocation share one
template, so G6 matters across invocations (a resume after a cap, pooling); a plain hash would
refuse every resume; codegraph and the js-harness commit are not recorded; no results file
records a cap stop, so G3 leaves cap windows unknown.

L7 (2026-10-14) The lead's answer, a claim of the lead and not his word: "Cleared: build G5, G6,
G3 and G2 after the WSL gate is on main (origin/main harness.json sensorsInWsl true; arm a
background loop that waits for it). G1, G4 and G7 come later, and G7 asks me first. T4: you are
cleared to make the one-hunk roadmap edit yourself (F7 row line 88 and the checklist item line
180), because JH 7 is paused." Done the same hour: `origin/main` merged (`bf2c312`; the merge
staged main's code, so its pre-merge-commit ran a whole check under the lock, a gate turn the
opening had paused, told to the lead as it ran); T4 (`85e873b`); the PR's body given its review
line (gentle-ai passive, not due). The wait for the WSL gate is armed; T5 to T7 start when it
fires.

L8 (2026-10-14) State at the context pause (75 percent by get_usage, after T6). Branch
`feat/eval-model-per-run`, cut from `origin/main` at `8aa93c3` once the WSL gate was there (PR #120
merged in it). Commits: G5 `a23f834`, G6a `f6e09fc`, G6b `148d5dd`, each assessed medium and under
budget by gentle-ai (pending in the slice), each gate passed in WSL2; G3 (`--plan`, `evals/plan.mjs`
and its tests, the suite's tests) written, RED then GREEN observed, committed next. Nothing pushed
yet: the pre-push hook needs a Codex review record over `8aa93c3..HEAD`. Next, in order: the
slice's gentle-ai assessment over `8aa93c3..HEAD` (`--base-ref 8aa93c3 --committed-only`), then
`js-harness codex-review --base 8aa93c3 --plan` and the review if within the allowance; push; a pull
request; tell the lead. Then T7, G2 (arms of one component), the largest: design it from the
section "Design of G5, G6 and G3" and `docs/future-model.md` Step 5 before writing. Free check
still owed: rebuild the real templates hours after 04:27 (read from the file's time; an earlier reply of this session said 04:49 without reading it, the third unread figure of the day) and compare with the baseline saved in
the session's scratchpad (`fp-baseline.json`); a later session redoes it from scratch (two builds
hours apart, both hosts), since the scratchpad does not survive.

L9 (2026-10-14) G3 committed (`41cbc41`). The slice `8aa93c3..41cbc41`: gentle-ai medium, not due
(under budget). Codex reviewed it in a gate turn, `codex-review --plan` first (estimate about
390,000 input tokens against an allowance of 688,800): 2 parts, 514,228 input tokens (399,360
cached), recorded. Two P2 findings, both real, fixed test-first in the next commit: the report
compared setups only against the first run, so a minimal-only first run let differing current
setups pool (now each current-bearing run against the first of them); and `--plan` counted the
trials of a run recorded on another model as done (now it says the run would be refused).

L10 (2026-10-14, 06:00 by `date`) The fix `91f1dc3` passed its gate; Codex reviewed
`41cbc41..91f1dc3` (87,575 input tokens, no finding, recorded). Pushed; PR jsaristi/js-harness#130
opened and told to the lead. T5 stays open for G6's last part (codegraph's version and the
js-harness commit) and the owed check of the fingerprint hours apart. Context 80 percent by
`get_usage`: compacting at this task end, since T7 (G2) does not fit. Resume: read this document
until the end of the Log, then design G2 before writing it.

L11 (2026-10-14) The lead's message of 06:03, a claim of the lead: do not stop for a compaction
(an idle session is never compacted), write the state and go on with G2; watch PR 124 and, once
merged, merge `origin/main` into PR 130 once, pass the gate, push and tell the lead; the owed
checks become tasks (T10, T11). Done: T10 to T12 added; PR 124 merged at 06:06; `origin/main`
merged as `5b37fac` in a gate turn (tests passed in WSL2); G2 designed (section above), next C1.

L12 (2026-10-14) State at the context pause (87 percent by get_usage). PR #130
(`feat/eval-model-per-run`, G5, G6, G3 and the fix) holds main and is MERGEABLE, waiting for the
lead. G2 goes on `feat/eval-arms`, cut from it at `258bf6e`: C1 `fa39244` (`evals/arms.mjs`,
`parseArm`, `armNames`, `ArmError`), C2 (`--configs` takes arms beside their base, a run naming an
arm stops with exit 2 until the filters exist, `--plan` states them) committing under the gate.
Next: C3a, the template filters of paths and JSON keys (`seedFromTemplate(dir, { without })` and
its Codex twin, after the seed; each component removes exactly its pieces, the rest byte-equal; a
component absent from the template refused), then C3b (marker blocks of the global CLAUDE.md and
Codex AGENTS.md with a depth counter; TOML tables), C4 (wiring, `doc.arms` pins, the exit-2 stop
lifted, G6's `config === 'current'` checks widened to every template-built config), C5 (report arms
section, F5/F6 output byte-identical first), C6 (probe, `minimal-with` beyond MCP), C7 (documents).
No branch for G2 is pushed yet; push it with a pull request after C4 at the latest. Owed: T10,
T11; Codex review of the G2 slice before its push.

L13 (2026-10-14) The lead at 13:58, a claim: work on without waiting for a compaction, never end a
turn waiting for a message (arm a background wait), merge main into #130 again, then G2's review,
push and PR. Done at 14:15: `origin/main` `c33b7bf` merged into #130 as `d2367dc` in a gate turn,
pushed. The lead at 14:21, citing his decision (the lead's transcript ffe99ebf, line 5394, not read
here): a code pull request now merges on a green GitHub run against the main it lands on; main is
not merged into #130 again, only on a conflict or when its code is needed. G2's Codex review
(`258bf6e..`, about 130,000 input tokens estimated, allowance 300,000) runs in a gate turn.

L14 (2026-10-14, 14:44 by `date`) PAUSED by the lead's message of 14:45, citing his order (the
lead's transcript ffe99ebf, lines 5906 and 5853, not read here): everything pauses for the
corrections; G2 is pushed with its pull request if committed and reviewed, else parked. At the
pause: C1 `fa39244` and C2 `21a06bf` committed; their Codex review was running in a gate turn,
chained to push `feat/eval-arms` and open its pull request (based on #130) only with a review
record and no P0 to P2 finding. Resume when origin/main's `docs/todo.md` holds "JH 14 resume"
(the wait armed at the pause); then read this Log to its end, check the review's outcome and the
pull request, and go on with C3a.

L15 (2026-10-15, 01:15 by the lead) PAUSED by the lead for gate load (median wait 5.9 min over his 5-minute line). PRs #130 and #141 merged. Nothing in progress: C3a not started. Resume on this branch, `feat/eval-arms-filters` from `origin/main` `eab3eff`, with C3a (template filters), then C3b to C7; open T5, T8 to T11. No gate taken until a new orchestrator wakes this session.

L16 (2026-10-15, 04:05 by `date`) Woken by the new lead (JH ORQ, since 01:20; its message of 04:04, a claim): the gate queue is empty, resume from L15. Rebased this branch onto `origin/main` `149e1d8`. Found the head of this document (lines 1 to 156) copied into the design of G2 since `258bf6e`, by a `$`` in a `String.replace` replacement; removed after a byte-equal check, recorded in `docs/todo.md`. The lead at 04:07: main is frozen for #167; a new pull request opens as a draft until it lands. Next: C3a, test-first.

L17 (2026-10-15, 04:22 by `date`) C3a built: `evals/without.mjs` (`checkWithout`, `applyWithout`)
takes an arm's components out of a trial's home after the seed; `seedFromTemplate` and
`seedFromCodexTemplate` take `without`, check it against the template when the seed is made, and
skip `js-harness init` for `project`. RED observed (`evals/without.test.mjs`, no module), then 11
GREEN; `evals/home.test.mjs` 41 GREEN (248 s beside another worktree's gate, over the half-minute
line; the Codex seed test and the whole suite run in the commit's gate turn). Decisions: the
components are disjoint, so `skills` and `hooks` leave js-harness's own skill folders and hook
entries (an entry whose every command starts `js-harness `), which are the `js-harness` component,
now one of Codex's too; `plugin-<name>` switches the plugin off in `enabledPlugins` and keeps its
files, so Claude Code has no missing plugin to fetch at startup (the design said the cache folder
goes too; the probe of C6 settles whether off is enough); `output-style` takes the `outputStyle`
setting with its folder; an edited JSON file is written back with two-space indent. Refused until
C3b: `claude-md-own`, the `gentle-ai-*` blocks, Codex's `plugin-*` and `mcp-*`. A slip: a board
read chained after a test's output while the gate ran (`docs/FAILURES.md`,
`board-read-loads-gate`). Next: C3b.

L18 (2026-10-15, 04:39 by `date`) C3a committed `776b03a` (gate green in WSL2; gentle-ai medium,
`under_budget`, pending in the slice). C3b built: `gentle-ai-<name>` takes its top-level block out
of `.claude/CLAUDE.md` or `.codex/AGENTS.md`, nested blocks and other markers with it, the file's
line endings kept; `claude-md-own` keeps the block lines only; a marker out of balance, a block
twice or one left open is refused naming the line. RED observed (5 failing), then 16 GREEN. A
read-only check found all five blocks in both real files and own lines in the real CLAUDE.md.
Split from the design's C3b: C3c, Codex's `plugin-*` and `mcp-*` (TOML tables, `withoutDesktopApp`
generalized; `mcp-engram` with its two instruction files and the two config keys naming them).
Found while planning C3c: Codex keys a hook's trust by its place
(`[hooks.state.'<hooks.json>:<event>:<group>:<hook>']`), so C3a's Codex `hooks` and `js-harness`
move the places of the hooks they keep; C3c remaps those tables (dropped with their hooks, renamed
to the new places), assuming the trusted hash is of the hook, not its place: the probe of C6
checks. And the real `SessionStart` has four groups but trust for three (`docs/todo.md`).

L19 (2026-10-16, 11:40 by `date`) JH 14 stopped answering; JH 23 took the feature over from the lead
(JH ORQ), with no eval run and nothing that spends his model allowance. Found in the worktree: C3c
begun and not committed (the scanner moved to `evals/codex-toml.mjs`, the tests written). Set aside
in the session's scratchpad, `origin/main` merged as `924d29e` (gate green), then put back. C3c
built: Codex `mcp-<name>` takes its `[mcp_servers.<name>]` tables out, sub-tables too; `mcp-engram`
also takes its two instruction files and the two top-level keys naming them; `plugin-<name>` turns
`enabled = true` to `false` in its `[plugins."<name>@…"]` table; `hooks` and `js-harness` drop the
trust table of each hook they take out and rename the trust of each hook that moves to its new group
(`[hooks.state.'<.codex>/hooks.json:<event>:<group>:<hook>']`, read on the real file: five tables,
snake-case events, literal strings), leaving a plugin's own hooks.json and stale places alone. Every
spelling a cut could miss (dotted keys, inline tables, arrays of tables) and every line the scan
cannot read is an `ArmError` before anything is touched. `withoutDesktopApp` now calls the shared
`withoutTables`, its 40 tests unchanged and green. RED observed (6 failing), then 22 GREEN.

L20 (2026-10-17, 22:21 by `date`; the clock jumped ten hours during a template build, likely a sleep)
C3c committed `dde2216d` (gate green; the first try failed on a flaky `bin/check.test.mjs` test,
"checkSensor stops a command that never exits", passed alone, not mine). STATE for a resume: C4 and
C5 are written and GREEN in the session scratchpad, not yet in this worktree: `scratchpad/c4/evals/`
holds C4 alone (home.mjs `settledBytes`; without.mjs `withoutDigest`; configs.mjs and
codex-configs.mjs `name` on the current config; suite.mjs arms seeded from the template with a
filter, pinned as `doc.arms[name] = { base, components, sha256 }`, a cut that moved refused as kind
`arm`, minimal-with still exit 2; report.mjs `holdsCurrent` widened; tests in suite.test.mjs and
report.test.mjs, RED then 7 GREEN); `scratchpad/tree/evals/` holds C4 plus C5 (report.mjs arms
section: `armSection`, `costTotal`, `armLines`, `checkTrial` takes arms; 4 tests RED then GREEN).
Next: copy C4 in, run the whole evals tests once, commit; then C5 the same way, plus a differential
check that `node evals/report.mjs` over the committed F5 and F6 files prints the same bytes before and
after; then gentle-ai assess over the slice from `924d29e`, Codex review, push, PR. T11: first
fingerprints at 22:20 in `scratchpad/fp-1.json` (claude `a021507a2128`, codex `8fbed9dbd3b9`),
built by `scratchpad/fp-build.mjs <worktree> <out> D:/jh23-fp-scratch`; rebuild hours later.

L21 (2026-10-17, 22:38 by `date`) The host compacted this session at 22:34; resumed from L20. C4
committed `8ce28f0` (gate green; the whole evals suite was 336 tests, 0 failing, before it). C5,
the report's arms section: `checkTrial` takes the arms `parseArm` names; the minimal-against-current
tables are built from `minimal` and `current` cells only; an `arms` section is added last, and only
when a run holds arm trials, each arm compared with its base per task and effort through
`compareCells`, its verdict named "with X" or "without X", and a summary line per effort (tasks
scored higher with and without, total cost with its standard error, the with/without ratio).
RED observed, then 62 report tests GREEN. Differential check, the report of `8ce28f0` against
this one over the committed results (`evals/results`, `evals/results/codex`), with no flag,
`--json`, `--min-discriminating 3`, `--require-complete` and `--codex-results-dir`: every output
and exit code the same bytes.

L22 (2026-10-17, 22:52 by `date`) C5 committed `9936192`. The slice from `924d29e` (C3c, C4, C5)
assessed by gentle-ai: medium, `review_due` false, `under_budget` (926 changed lines), so no
review was started. Codex reviewed `75bb361..9936192` (the whole branch, C3a on; 4 parts, about
958,000 input tokens, recorded): parts 2 and 4 correct, three P2 findings in parts 1 and 3, all
three checked against the code and fixed, each test RED on `9936192` first: (1) runs of an arm
alone left the minimal-against-current tables empty, so both gates passed on nothing: the report
now refuses an arm whose base has no trial in the runs; (2) the trust regex wanted a separator
before the `.codex` placeholder, which in the template stands for the whole path, so the pin
(`withoutDigest`, read on the template) missed the trust edits that `applyWithout` makes after
the seed: the separator is now optional; (3) a pair of a whole file and a part of it
(`claude-md` with a block or `claude-md-own`, Codex's `agents-md` with a block) is the arm
without the whole alone under another name: `parseArm` refuses it. T10 is written and GREEN in
the scratchpad (`scratchpad/tree/evals/suite.mjs`, `suite.test.mjs`: `codegraph` and `jsHarness`
in both stacks, the commit read by `git -C <checkout>` with `+dirty` for a changed tracked file
outside `evals/results`, null when git cannot say), for its own commit after the push.

L23 (2026-10-17, JH 21, on the lead's triage of open work; written as L15 on main and renumbered
when JH 23 merged main into this branch) T5 checked off: G5 `a23f834`, G6a `f6e09fc` and G6b `148d5dd` are on origin/main through pull request 130 (merged as 2f45666e; `git merge-base --is-ancestor 148d5dd origin/main` exits 0). G6's last part, codegraph's version and the js-harness commit, is T10's and stays open there.

L24 (2026-10-17, 23:07 by `date`) Main merged into the branch as `d2a3a8a` (pull request 426 had
conflicts in two documents) and pushed. T10 done: both stacks record `codegraph` (asked as `doctor`
asks) and `jsHarness`, the commit of the checkout whose `js-harness init` lays out the workspace
(`git -C <checkout> rev-parse HEAD`, `+dirty` when a tracked file outside `evals/results` differs,
null when git cannot say); a resume compares both like every stack field, so a file that recorded
neither is refused on a resume. Tests RED (8 failing) then GREEN; 112 suite tests pass on the
merged tree. Checked against the real checkout: `1.6.2` and the head's commit. State of C6a, which
is half written in the session scratchpad, is in the shared notes folder (`jh23-state.md`).

L25 (2026-10-17, 23:12 UTC by `date`) Evidence for the merge queue, which left pull request 426 out
gentle-ai assessed `8ce28f0..8fbfa22` (C4, C5, the Codex fixes) from `924d29e`: medium, not due (`under_budget`).
gentle-ai assessed T10 `3bb5871` from `d2a3a8a`: medium, not due (`under_budget`, 151 changed lines).
No review was started for either, by the rule that a slice under budget waits in the slice.

L26 (2026-10-17, 23:25 UTC by `date`) Pull request 426 landed (main `3badd8b`); C6a on a new branch,
`feat/eval-arms-probe` from it. The isolation probe runs an arm of one component beside its base:
`--arm current-without-<id>` (or `arms: ['current', <arm>]`) seeds the arm as the eval does (the
template, then `applyWithout`), and the fake API tracks, on every `/v1/messages` request, whether it
carries each component, by what `withoutEvidence` (`evals/without.mjs`) reads of it in the template
before the cut: its MCP tool prefixes, the markers of the lines it is sent whole, the first characters
of its skill and agent descriptions. The base must carry it on its main-model request, the arm on no
request; a component a request carries nothing of (`hooks`, `project`) is reported unseen, a warning
that fails nothing. An arm without its base, a `minimal-with` arm and a name `parseArm` refuses are
refused before anything is made. The engram controls do not apply to an arm without `mcp-engram`,
`plugin-engram` or `hooks`; the contamination check is skipped for an arm that cuts the global
`CLAUDE.md` or a part of it, where the component check speaks instead. Tests RED (5, written first),
then GREEN; 161 tests of the probe, `without` and `arms` pass. No probe was run against the real
`claude`: that is a run on this machine, though with no spend, and it waits for the lead's word.

L27 (2026-10-17, 23:35 UTC by `date`) Codex reviewed C6a (`3badd8b..cb9f1f3`, 221,074 input tokens,
recorded): three P2 findings, all checked against the code and real, each test RED first, then fixed.
(1) A plugin's evidence was a tool prefix it may not have: a plugin with no MCP server (the stack's
`typescript-lsp`) failed the current arm. Now a plugin's evidence is read from its installed folder
(`installed_plugins.json`, under the home placeholder): its tool prefix only when it declares a
server (`.mcp.json` or `plugin.json`), and the descriptions of its skills, agents and commands, less
those kept from the model (`disable-model-invocation: true`). (2) Descriptions and line markers were
one pool needing two hits, so an arm that kept one skill of several passed: one description is now
enough, two markers still are for the lines of one file. (3) Every installed output style gave lines;
now only the style `settings.json` selects does. Found in passing, the same class: any other Markdown
of a removed folder (a README in `hooks`) gave lines no request carries; now only `CLAUDE.md` and
`AGENTS.md` do. `HOME_TOKEN` moved to `evals/without.mjs`, which reads it back, and `home.mjs`
imports it. 205 tests of the probe, `without`, `home` and `arms` pass.

L28 (2026-10-17, 23:39 UTC by `date`) Codex rechecked `cb9f1f3..3f3d59a` (48,783 input tokens, recorded): all three fixed, no new finding.
gentle-ai assessed C6a `cb9f1f3` from `3badd8b`: medium, not due (`under_budget`, 338 changed lines).
gentle-ai assessed the slice `cb9f1f3..3f3d59a` (C6a and its fixes) from `3badd8b`: medium, not due (`under_budget`, 498 changed lines).

L29 (2026-10-17, 23:55 UTC by `date`) C6b and C7, on `feat/eval-arms-minimal-with` from `b743fd0`
(#428 landed; the old worktree was removed by the land, so this one is new at the same path). C6b:
`minimal-with-mcp-<name>` runs for Claude. `minimalWithConfig` is minimal's flags plus `--mcp-config`
of `<home>/.claude/mcp-with.json`; `seedMinimalWith` writes there only the chosen server of the current
template's `.claude.json`, engram's given the trial's own data dir and port by `trialEngram`, which
`seedHome` now shares, and refuses a non-MCP id or a server the template lacks. The suite drops its
"not built yet" refusal, builds the template for any arm, records `setup` only with `current`, and
pins the arm's server like a cut. The probe takes `--arm minimal-with-mcp-<name>` beside `minimal`
and checks the reverse of a cut: the arm offers `mcp__<name>__` tools on its main-model request, the
base none. C7: Step 5 of `docs/future-model.md` rewritten from what the design found (arms continue
Step 4's run and cost their own 15 trials; `minimal-with` holds only for MCP servers on Claude; five
gentle-ai blocks and `claude-md-own`; `hooks` are settings entries; the project's `AGENTS.md` unverified;
the probe before any spend), Step 6's spread defined as the standard error of the totals the report
prints, and G2 marked built. 410 tests of the probe, suite, configs, home, without and arms: 409 pass, 0 fail.

L30 (2026-10-18, 00:01 UTC by `date`) Codex reviewed `d7dc0a1..fe56f2f` (297,789 input tokens,
recorded): one P2, taken. A minimal-with arm was pinned by `withoutDigest`, the digest of what is
left once its server is cut, so a change to that server continued a run and a change to any other
server stopped it; with `current` absent the setup check no longer caught it. Its pin is now
`minimalWithDigest`, the SHA-256 of the servers it puts in as the template holds them; a test
first shows another server changing continues the run and its own changing stops it, the file
untouched.
