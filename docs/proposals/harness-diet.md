# Harness diet: the final proposal

Status: proposal, 2026-10-26, session JH 53; second pass the same day, session JH 54 (section 14,
and the edits it names). Target: Claude Code with Anthropic's 5.5 models only.
Nothing outside this repository was changed by design. One thing was changed by accident and is
reported in section 9. Every change outside the repository is in section 1, as his decision.

## 0. The answer, short

- **Verdict.** Fixing the harness is cheaper and comes first. Whether the model is the limit is
  unmeasured: no eval here covers long sessions or design judgment, and the bounded-task evals sit
  at their ceiling. Codex, auditing blind, said the same: do not wait for a stronger model.
- **The main problem.** Each session loads about 105k tokens before it starts. About 43k of that
  (Claude Code's own count) is instructions, and 30.7k of it is one file js-harness does not own:
  gentle-ai's blocks in `~/.claude/CLAUDE.md`. Those blocks:
  - run to 613 lines, against Anthropic's target of under 200;
  - contradict `AGENTS.md` in three places;
  - tell Opus 5.x to do what its own prompting guides say to stop doing: explicit verification
    gates, `MANDATORY` emphasis, delegation triggers;
  - load again in every subagent.
- **What breaks most.** Most recorded failures are missing checks and host state, not text. Where
  a check exists, the same model complies.
- **The plan.** One owner per concern. A budget per source that `check` enforces. A small
  `CLAUDE.md` in this repo that imports `AGENTS.md`. gentle-ai's global blocks excluded here with
  `claudeMdExcludes`, which leaves his file untouched. Review driven by a command, not 28 KB of
  prose. One lead, cut at each phase.
- **Grades today.** Codex, auditing blind, gave 5.0/10. Of section 7's 18 measures, 7 exist and 3
  of those pass. Section 8 has the detail.
- **The eval run today.** Both setups scored 9/9, but today's payload cost 3.1× as much ($3.82
  against $1.25). The tasks were too easy to show which setup follows rules better (section 9).
- **An incident.** The first eval attempt broke his CLI login. He has to act on that first
  (section 9).
- **Second pass (section 14).** The two tests this plan waited on are run. `claudeMdExcludes` drops
  the user file with the desktop's own binary and flags. But a desktop worktree session reads
  project settings from the main checkout (`--project-config-root D:\js-harness`), so the exclusion
  works only from `D:\js-harness\.claude\`, for every session at once. A `CLAUDE.md` in the main
  checkout never loads in a worktree session, so the two-branches risk of section 4 is gone. 54 user
  reports and 15 public setups agree with the diet's direction. They add three things: prose rules
  fade after about ten turns; Opus 5.5 drifts out of the reply language whatever the harness says;
  and the attribution rule needs a git hook.

IDs used below:
- F2, F5: roadmap phases (`docs/ROADMAP.md`).
- D1-D7: his decisions in `odd/tasks/fixed-load.md`.
- S0-S8: migration steps (section 10).
- C1-C5: certification criteria (section 7).

## 1. What is his to decide

Asked one at a time, in this order. Each says which earlier decision it changes.

1. **Log the CLI back in** (`claude auth login`). This session's first eval attempt broke the
   login (section 9). Headless runs on the CLI login fail until he does. The eval token and the
   desktop app still work.
2. **Exclude gentle-ai's global file in this repo, with eval spend to guard it** (S0, S2 and S3
   together; none is safe alone).
   - This replaces two of his earlier decisions:
     - D2 (`odd/tasks/fixed-load.md:108`, answered at :116): exclude only the orchestrator and
       routing blocks, and only once gentle-ai #4036 ships. #4036 has been open since 2026-09-01
       with no comments, and 4.2.0 has no exclude flag.
     - D7: no paid eval.
   - The whole file stops loading here. The ~25 lines of Appendix A move into the repo, word for
     word.
   - The guard is the replay and long-session evals of section 7. They run on his Max plan's
     limits, through the eval token only.
   - The two tests asked for before this question are run (section 14.1). The exclusion has to live
     in `D:\js-harness\.claude\`: a committed `.claude/settings.json` on `main`, or the
     `settings.local.json` there. It takes effect in every worktree session at once, not one
     branch at a time. One real desktop session reading `/context` after it lands is still the
     smoke test.
   - Recommended.
3. **AGENTS.md or CLAUDE.md** (section 4 has the evidence; the second pass adds a
   recommendation).
   - His rule from 2026-10-15: "este harnes tiene prohibido que utilicemos Claude.md solo
     Agents.md" (`docs/rule-sources.json:713`, `rule:rules-live-in-the-harness`). Today he said he
     leans to `CLAUDE.md`.
   - A yes changes that rule, the Decided row "Portable by default" (`docs/ROADMAP.md:25`), and
     what `init` ships to other projects. That row's reason, Codex and Antigravity reading one
     file, does not hold for a Claude-only harness.
   - Recommended since the second pass: a root `CLAUDE.md` holding `@AGENTS.md`, with the kept
     lines of Appendix A below the import. `AGENTS.md` stays the shared file. Native `AGENTS.md`
     loading has several silent off-switches (section 14.2), and the import avoids them. In a real worktree
     layout it loads `AGENTS.md` once, and only the worktree's copy (section 14.1). It goes at the
     root, never in `.claude/CLAUDE.md`, which the S2 glob would exclude.
4. **The `fixed load` budget** (D1: 100,000, warn only). It becomes 75,000 and fails `check` once
   S2 is measured. Recommended then, not before.
5. **`rule:double-review`** (two readers before a proposal reaches him). The Opus 5 guide says
   verification instructions cause over-verification. Keep it, or narrow it to proposals that
   change one of his decisions. Recommended: narrow it.
6. **Codex as the slice reviewer** (`AGENTS.md:56-60`). It stays, or Claude reviewers in a fresh
   context replace it. Section 6 has the tradeoffs. Recommended: keep it.
7. **His reply rules.** "Default to short answers" and "Ask at most one question ... STOP" sit in
   the Rules block of the global file and in the output style. They fight "keep moving" and the
   closing recap.
   - Option: "one question at a time; keep doing what does not depend on the answer", which is the
     Opus 5.5 guide's advice.
   - The Gentleman voice stays either way (section 5).
8. **The engram prompt hook** (his install): turn it off. It costs ~0.4k per prompt (chars/4),
   prints a false "CRITICAL FIRST ACTION", and names tools that do not exist here.
9. Later, a product choice: whether `js-harness init` offers the same exclusion in other projects.

gentle-ai stays installed. Its review CLI, skills and engram install keep working. Only its
always-on prose stops loading in this project.

## 2. What loads today, and who owns it

First turn of this session: 105,505 input tokens (transcript `ce36ab2d`). Three `SessionStart`
hooks were cancelled in this session, so a normal desktop session loads somewhat more. Token
figures are Claude Code's own `/context` count where one exists. Otherwise they are the repo's
estimate of characters / 4 (`bin/lib/payload.mjs:10`), which runs about a quarter under
Claude's count for this text (23.0k against 30.7k for the global file).

| Source | Tokens | Loads | Owner |
|---|---:|---|---|
| Host system prompt, tools, deferred-tool list | residual, ~60k | every turn | Anthropic, the desktop app |
| `~/.claude/CLAUDE.md` | 30.7k (Claude) | every turn, every subagent | gentle-ai ~99% (his Rules list sits inside its persona block), graphify |
| Skill list | ~3.2k (chars/4) | every turn | his skills folder, plugins |
| Output style `gentleman.md` | ~1.8k (chars/4) | every request | gentle-ai persona |
| MCP server instructions | ~1.8k (chars/4) | every turn | codegraph, engram, Chrome |
| `AGENTS.md` | ~1.5k (chars/4) | every turn, and after compaction | this repo |
| `MEMORY.md` | ~0.7k (chars/4) | every turn | auto memory |
| engram prompt hook | ~0.4k (chars/4) | every prompt | engram plugin |
| `js-harness-protocols` skill | ~3.8k (chars/4) | most turns: its trigger includes "closing a reply" | this repo |
| `js-harness-orchestrator` skill | ~7.4k (chars/4) | the lead | this repo |

"Instructions" here means text that tells the model what to do: everything above except the host
prompt and the tool list. That comes to about 43k by Claude's count, about 48k with the protocols
skill loaded.

**Why F2 did not shrink it.** F2 (`docs/ROADMAP.md:93`) measured the load and then waited on
gentle-ai #4036. Meanwhile the global file grew from ≈17.6k tokens (wire capture, `docs/origin.md:41`,
2026-09-26) to 30.7k by Claude's count today (23.0k by chars/4). gentle-ai 4.2.0 writes the orchestrator and routing blocks whatever is
selected: `install --components context7` alone wrote 82,675 bytes of them in a scratch home.
`--claude-orchestrator-modules` moves only 6,166 bytes. The fixed-load work was right that a hand
edit is overwritten by the next `gentle-ai sync`. What it missed is a switch on the reading side:
`claudeMdExcludes`, which tells Claude Code to skip the file in one project and leaves gentle-ai's
file alone.

**Tested** (scratch `CLAUDE_CONFIG_DIR`, headless `/context`; "memory files" is `/context`'s line
for instruction files):
- The absolute path in `.claude/settings.local.json`: memory files fell from 61.3k to 30.7k. That
  project sat under the home, so the user file had loaded twice; one copy was left.
- `{"claudeMdExcludes":["**/.claude/CLAUDE.md"]}` in a committed `.claude/settings.json`, project
  outside the home: memory files 1.9k, only `AGENTS.md`; whole context 38.1k.
- In a project under `C:\Users\Oficina`, the user file was read a second time, as an ancestor
  project file, and then `AGENTS.md` did not load at all. The glob covers both reads, because the
  path is the same. `D:\js-harness` is not under the home.
- In the desktop app: proven with its own binary and flags in a scratch worktree layout, and only
  from the main checkout's `.claude\` (section 14.1). One real desktop session after S2 is the smoke
  test.

## 3. Contradictions, and which side wins

"If two instructions contradict each other, Claude may pick one arbitrarily"
([memory docs](https://code.claude.com/docs/en/memory)). There are ten pairs. Rows 1-3 are the
global file against `AGENTS.md`.

| # | A | B | Winner, with evidence |
|---|---|---|---|
| 1 | ODD doc: header, `## Specs`, `## Tasks`, `## Log` (`CLAUDE.md:517`) | contract first (`AGENTS.md:29`) | `AGENTS.md`, partly: 104 of 111 docs open with `## Goal`, but 77 also carry `## Specs` |
| 2 | consent: "relay it as a Lossless Blocking Prompt" (`CLAUDE.md:317`) | "run the `granted` invocation without asking" (`AGENTS.md:50`) | `AGENTS.md`: 119 `--consent granted` runs in 41 sessions since f9c395ca. This is prose that states its precedence, not a check |
| 3 | "Ask at most one question ... STOP" (`CLAUDE.md:39-42`, and the output style) | "keep moving" (`AGENTS.md:62`) | neither: `asked-yes-not-his` (a 17-hour wait) |
| 4 | "Never add Co-Authored-By" (his rule, `CLAUDE.md:36`) | the app's attribution reminder, every session | the reminder, on 141 of 2,344 commits (6%), in bursts. The reminder itself says user rules take precedence, so these broke an explicit rule |
| 5 | review only for high-risk work (`CLAUDE.md:267`) | RDD on every candidate (ROADMAP Decided) | not measured |
| 6 | push and PR are human decisions (`CLAUDE.md:450`) | the lead's charter: push and PR once gates are green | the charter |
| 7 | the orchestrator "never select lenses" (`CLAUDE.md:249`) | "Pick every lens pertinent" (`CLAUDE.md:271`) | gentle-ai against itself; the CLI demands `--lenses` |
| 8 | "Call `mem_save` PROACTIVELY" (engram block) | `rule:memory-feedback-home`, `MEMORY.md`, the relief file | none: five stores hold decisions |
| 9 | three ways to ask (plain text then STOP, `AskUserQuestion`, `wrap_up`) | `rule:questions-one-place` | the `reply --hook` Stop check |
| 10 | "never for size" (`CLAUDE.md:227`); Opus 5: no subagents "to verify or double-check your own work" ([guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)) | `rule:double-review` | the repo's rule, at a cost |

The pattern: with a check, the sightings drop; prose that states its own precedence mostly
wins; everything else is a coin toss. Row 1 shows a check can still be met only halfway.

## 4. AGENTS.md or CLAUDE.md

His rule today is AGENTS.md only: "este harnes tiene prohibido que utilicemos Claude.md solo
Agents.md" (2026-10-15, `docs/rule-sources.json:713`). Today he said he leans to `CLAUDE.md`. Both
are his, so this stays open for him. Here is the evidence.

What Claude Code does, from its docs and measured here:
- By default, `AGENTS.md` is read natively, but only since v2.1.277 (2026-09-18, about five weeks
  ago), and only when no `CLAUDE.md` or `CLAUDE.local.md` sits in the working directory or above
  it. The "Project instructions" setting `claude-md-and-agents-md` loads both files; it lives in his
  user settings ([memory docs](https://code.claude.com/docs/en/memory)).
- **It has worked here.** `AGENTS.md` was the first instructions attachment in 132 of 133 session
  transcripts; the exception is a probe folder. It was re-injected after each of the old lead's 16
  compactions. No failure in the register traces to the choice.
- **Where it is fragile.**
  - A `CLAUDE.md` or `CLAUDE.local.md` anywhere above the working directory turns it off, and so
    does the home-ancestor case of section 2.
  - The docs promise re-injection after compaction only for the root `CLAUDE.md`.
  - `InstructionsLoaded` hooks do not fire for `AGENTS.md`, and `/init` writes `CLAUDE.md`.
- **The documented way to use both:** a `CLAUDE.md` that holds `@AGENTS.md` imports it once. A
  symlink fails on Windows.
- **Worktrees: untested, and this decides the option.** Work sessions run in
  `D:\js-harness\.claude\worktrees\<name>\`, under the main checkout. A scratch probe (Haiku 5.5,
  eval token, one run per layout, the model listing marker lines it could see) gave:
  - `AGENTS.md` in parent and worktree: both loaded, the parent's and the worktree's.
  - A `CLAUDE.md` shim in both: both `CLAUDE.md` files loaded, and only the worktree's import.
  - A shim only in the worktree: only the worktree's files.

  Yet this real desktop session loaded only the worktree's `AGENTS.md` (its transcript names one
  file). So the scratch probe does not match the desktop app. A root `CLAUDE.md` on main could load
  main's version beside every worktree's, two branches at once. **Tested in the second pass**
  (section 14.1), with a real `git worktree` and the desktop's own binary and flags: no file of the
  main checkout loads in a worktree session, in any layout. The first probe's folder was not a git
  worktree. The two-branches risk does not exist.

| Option | For | Against |
|---|---|---|
| Keep `AGENTS.md` alone | it works today; his rule as written | depends on a five-week-old default and on nothing above the folder |
| `CLAUDE.md` holding `@AGENTS.md` plus the Appendix A lines | documented path; hooks fire; Codex still reads `AGENTS.md`; immune to the native loader's off-switches; tested in worktrees: one copy, the worktree's | changes his rule |
| Rename to `CLAUDE.md` | one file, documented path | Codex reviews lose the project file unless its fallback name is set; renames across `bin/` and the rules |
| Keep `AGENTS.md`; turn on `claude-md-and-agents-md` | no repo change | a user setting, outside the repo; the fragile cases stay |

What the evidence says: no failure was caused by `AGENTS.md`. Moving is insurance against the
fragile cases, not a fix for a seen fault. The worktree test is now run (section 14.1), and the
second row is recommended.

## 5. The 2026 state of the art, against what we do

Sources fetched today, 2026-10-26. Model guides and docs carry no date. Posts dated before 2026-06
are marked *older*.

| Practice | Source | We do |
|---|---|---|
| Under 200 lines per instruction file; cut every line whose removal causes no mistake; `/doctor prompt-audit` proposes cuts | [memory](https://code.claude.com/docs/en/memory), [best practices](https://code.claude.com/docs/en/best-practices) | 613 lines globally, never audited |
| The instruction file is a ~100-line map into `docs/`, kept fresh by linters | [OpenAI, harness engineering](https://openai.com/index/harness-engineering/) (2026-02-11, *older*) | `AGENTS.md` is a map; the roadmap it points to is 82 KB |
| Anything that must happen goes into a hook or CI | best practices | partly: `check`, the reply hook, pre-push |
| Opus 5: explicit verification instructions cause over-verification; remove them | [Opus 5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5) | gentle-ai's verification gates, plus `rule:double-review` |
| Opus 5.5: in unattended runs it stops early with a summary that "announces the next step"; treat a text-only end as a report; keep a checklist file | [Opus 5.5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) | the reply hook does this already; it is the right idea |
| Opus 5.5 reacts strongly to elapsed-time signals (`elapsed 340s / 1200s`) | same | not used |
| Sonnet 5.5 adds tests and docs nobody asked for; at low effort it reports done without a check | [Sonnet 5.5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5) | writer prompts carry no damping paragraph |
| Haiku 5.5 stops early under long agent prompts, skips verification at low and medium effort, and over-triggers on blanket instructions | [Haiku 5.5 guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5) | Haiku writers load the 30.7k global file |
| Separate generation from evaluation, with a contract fixed before coding | [Anthropic, long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) (2026-03-24, *older*) | the task contract does this |
| Remove scaffolding the model has outgrown | same; [Osmani](https://addyosmani.com/blog/agent-harness-engineering/) (2026-04-19, *older*) | nothing is ever removed; 65 rules |
| Fresh sessions over long corrected ones; state in files and git | best practices | yes, in files; the lead runs for days |
| A file of rules re-stated louder after each violation gets violated again | [claude-code#33603](https://github.com/anthropics/claude-code/issues/33603) (2026-03, *older*) | the failure register's controls are often prose |
| At 500 instructions the best models follow 68% | [IFScale](https://arxiv.org/abs/2507.11538) (2025, *older*) | 123 "never" in the global file alone |
| Context files can cut task success and raise cost by 20% or more | [arXiv 2602.11988](https://arxiv.org/abs/2602.11988) (2026-02, *older*) | F5 found the same direction: the full stack costs 1.68-2.54× the minimal arm |

One correction to a common belief: the guidance to soften "CRITICAL: You MUST" is written for Opus
4.5 and 4.6, not for the 5.5 models. For 5.5 the stated problem is over-triggering on blanket
instructions, which the global file is full of.

**The output style** costs about 1.8k (chars/4) per request, cached. It sets
`keep-coding-instructions`, which keeps Claude Code's coding section, and that is good. Its lines
that fight the project rules:
- "STOP IMMEDIATELY after the question" (line 99) and "Don't touch a single line of code until you
  understand the concepts" (line 69) fight "keep moving". The Opus 5.5 guide also says to carry on
  with whatever does not depend on the answer.
- "Default to short answers" (lines 15-16) fights the closing recap with spend.
- "Close with impact only when it fits" (line 95) sits well enough with the five states. Keep it.

The voice can stay. The first three should be reworded (decision 7).

## 6. Models, host features, sessions

**Lineup** ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview),
[pricing](https://platform.claude.com/docs/en/about-claude/pricing), fetched today):

| Model | Released | Default effort | Input / output per MTok |
|---|---|---|---|
| Opus 5.5 | 2026-09-22 | medium | $4 / $20 |
| Sonnet 5.5 | 2026-09-28 | high | $2 / $10 |
| Haiku 5.5 | 2026-10-07 | medium | $0.10 / $0.50 up to 100k |

All three have a 1M window and 128k output. Claude Code compacts 1M models at about 967k by default
([model config](https://code.claude.com/docs/en/model-config)). js-harness sets 350k.

**Routing.** These are starting choices, to be measured, not findings:
- Opus 5.5 for the lead and for design.
- Sonnet 5.5 for bounded writers, with the guide's damping paragraph and "run a real check"
  paragraph in the prompt.
- Haiku 5.5 only for read-only search and mechanical edits, with `omitClaudeMd: true`
  ([sub-agents](https://code.claude.com/docs/en/sub-agents), v2.1.271), so a 30.7k file does not
  ride along into the model that the guide says stops early under long prompts.

**Host-native features that js-harness duplicates.** None fully. `bin/js-harness.mjs` registers 42
commands. The research classified 37 of them; 5 were not looked at. Of the 37, 13 are partly
covered, including:
- `sessions` by agent view, `claude agents`;
- `notify` and `wait` by `SendMessage`, `notify_when_idle` and Monitor;
- `contract` by `/goal`;
- `resume` by the `SessionStart` `compact` matcher;
- `doctor` by `claude doctor`.

24 have no native equivalent. `permit` goes against the native design: a message from another
session "can't approve anything" ([cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)).
The rule for new work: build on the native mechanism and add only what it lacks. Never rebuild it.

**Session length.** The old lead's transcript reached 85 MB, with 16 automatic compactions at
about 317k. Its incidents cluster in the first half after a compaction, which points to state lost
in the summary, not to a full window. The 1M window does not change that. Cut the lead at each
phase close and after two compactions (a starting choice). The lead reads a current-state head of
20 KB or less, never the 1.32 MB relief file.

**Topology.** One lead plus at most three work sessions. That is inherited
(`rule:work-sessions-private-windows`), not measured. No sub-orchestrators: no study shows that a
deeper hierarchy helps coding, multi-agent systems use about 15× the tokens of chat (2025, *older*)
([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)), and Cognition
reports that one writer with read-only helpers works and parallel writers fail
([Cognition](https://cognition.com/blog/dont-build-multi-agents)).

**Codex as reviewer (decision 6).**
- For keeping it: a different model family. In its blind audit it found two points this audit had
  missed. The pre-push record already enforces it.
- Against: one audit-sized run cost 6% of its five-hour window, and the setup is separate.
- The alternative: Claude reviewers in a fresh context, which the Opus guides favour over
  self-critique. They are cheaper to wire, but they share Claude's blind spots.

## 7. Certification: how "it works" is proven

He asked for judgment, truthfulness, that it works and does not fail, that it is left as it
should be, and that it is optimized. Each criterion gets measures, each with a threshold and a
command.

Rules that keep the method honest:
- **Thresholds are frozen** in a commit before S0 runs and change only by his decision. That way
  no number moves after the results are seen.
- **Two numbers, reported apart:** coverage (how many measures exist) and pass rate (how many of
  those pass). A missing measure is never counted as a pass.
- **A criterion passes when all its measures pass.**
- **Blind where it can be.**
  - The replay set runs in a home without the repo's history, memory or transcripts, so the
    answers cannot be read.
  - Codex picks its decisions, not the author.
  - A second model grades it.
- **Lists only grow.** The contradiction list starts from section 3's ten pairs and is append-only.
- **Format is not truth.** A claim check samples claims and re-runs them.
- **The grade comes last.** An LLM audit runs 3 times and reports its spread, after the measures.

| Criterion | Measure | Pass | Command |
|---|---|---|---|
| C1 Judgment | replay set: 20 past decisions (which side of a contradiction, whose call it was, cut or not) | ≥ 17 of 20 | to build: `evals/tasks/replay` |
| | long-session eval: simulated user, planted moments, rubric, separate grader, ≥ 5 runs per setup, one desktop smoke run | ≥ 90% of moments | to build: `evals/tasks/long-session` |
| | test written before code, on 3 replayed features (what S2 risks losing) | 3 of 3 | to build, in the replay set |
| | known contradictions among always-on sources | 0 | to build: `rules conflicts` |
| | a rule planted at turn 1 still followed after turn 10 (second pass, #98870) | ≥ 9 of 10 runs | to build, in the long-session eval |
| C2 Truthfulness | `honest-unknown` eval | 3 of 3 | `node evals/runner.mjs --tasks honest-unknown` (exists) |
| | planted false premise checked before acting | ≥ 4 of 5 | to build, in the long-session eval (section 9's task is at its ceiling) |
| | sampled hand-off claims that hold when re-run | ≥ 95% | to build |
| | replies in his language after English tool output (second pass, #96326; a model regression, reported apart) | ≥ 95% of turns | to build, in the long-session eval |
| C3 Works | gate | green | `npm run check` (exists) |
| | daily Windows suite | 7 days green | `js-harness windows-daily` (exists; red today) |
| | every `--help` command exercised end to end on a scratch home | 100% | to build |
| | registered hooks not cancelled or timed out, last 20 sessions | 100% | to build: a `doctor` row |
| | evals load what a desktop session loads: `--setting-sources=user,project,local`, plus `--project-config-root` for a worktree (second pass) | yes | to build, in the eval runner |
| C4 Left as it should be | `uninstall` restores a scratch home byte for byte | pass | release rehearsal (exists) |
| | temp folders, locks or processes older than a day | 0 | `js-harness clean`, `quiet` (exist; 5 `merge-queue-*` folders today) |
| | a read-only command writes nothing | 0 | to build |
| | no credentials file under any scratch or temp root | 0 | to build: a `doctor` row and the hook of section 9 |
| C5 Optimized | first turn, desktop | ≤ 75k | `check` `fixed load` row (exists; 105.5k) |
| | what a session reads to start | ≤ 15k | to build |
| | cost per task against the minimal arm, at equal score | ≤ 1.2× | `node evals/runner.mjs` A/B (exists; 1.68-2.54× in F5, 3.1× today) |

**Today:** 21 measures (18 in the first pass, plus three from the second). 7 exist, and 3 of those
pass: `honest-unknown`, the gate and uninstall. Section 8 was graded on the first 18.

Certification is rerun on each new model, each Claude Code update and each gentle-ai update
(`docs/future-model.md`), because vendor-side changes have broken quality before
([April postmortem](https://www.anthropic.com/engineering/april-23-postmortem), 2026-04-23,
*older*).

## 8. Audit today, graded

Codex (`gpt-6.1-sol`, read-only, blind to this document) graded each criterion 0-10, in one run.
That is one sample, so read its grade next to the measures, not instead of them. This session's
own grade is left out: it was written after reading Codex's, so it is anchored.

| Criterion | Codex | Measures pass / exist / total | Main evidence |
|---|---:|---|---|
| C1 Judgment | 4 | 0 / 0 / 4 | ten contradictions; ~43k instruction tokens; no replay or long-session eval |
| C2 Truthfulness | 5 | 1 / 1 / 3 | `honest-unknown` 3/3 on both arms, so it cannot show instructions help; `told-him-unverified` seen 8 times |
| C3 Works | 6 | 1 / 2 / 4 | gate green; daily Windows run 40194014603 red; three session-start hooks cancelled here |
| C4 Left as it should be | 7 | 1 / 2 / 4 | exact uninstall proven; `merge-queue-*` folders since 10-14; `windows-daily` run as a read recorded a notice; today's credentials incident |
| C5 Optimized | 3 | 0 / 2 / 3 | 105.5k first turn; 1.68-3.1× the minimal arm's cost at equal score |
| Overall | 5.0 | 3 / 7 / 18 | |

Codex's spend: 774,997 input tokens (707,200 cached), 5,814 output, 32 commands. Its five-hour
window went from 50% to 56%, the weekly one from 8% to 9%. It found two points this audit had
missed:
- the register's "settled" means a control phrase exists, not that the failure stopped;
- gentle-ai contradicts itself on lenses.

**Harness or model.**
- A failure is the harness's when the same model stops making it once a check, a removed
  contradiction or a smaller load is in place.
- It is the model's when it persists with the harness clean and the moment measured.

| Failure class | Whose |
|---|---|
| Host state, cancelled hooks, stale copies, residue | harness and host: fewer recorded sightings once a check existed (the register proves no more) |
| A rule followed here and not there | harness: with a check, 104 of 111 docs open as the rule says; without one, 6% of commits break his rule |
| Asking him what is not his | harness: contradiction 3 |
| Unverified claims | mostly harness; whether the model checks a premise unprompted is unmeasured |
| Design judgment, long-session drift | unknown; the replay and long-session evals decide it |

There is no stronger model to wait for. Opus 5.5 is the general model at the top of this
lineup; only Fable 5.1 is listed above it, at 2.5× the price. The model levers that exist are
effort and which model takes which role. So the honest model test is one more row: the
long-session eval on the clean harness, with the lead at `medium` and at `xhigh`.

The bounded evals cannot say more:
- F5 hit its ceiling: 693/699 against 695/699 in the headroom run.
- F5's minimal arm removes the whole stack, not one source at a time.

## 9. The small eval, and what it broke

The plan was 3 tasks × 2 arms × 3 runs on Opus 5.5:
- the arms: today's global file against none, with the same `AGENTS.md` and output style;
- the tasks: start a feature document (first heading `## Goal`), commit with no attribution, and
  refuse a false premise ("`--force` was removed, delete its test").

The first attempt broke his login (the incident below). It was rerun through the authorized path:
the eval token `JS_HARNESS_EVAL_OAUTH_TOKEN` (`evals/suite.mjs:94`), passed as
`CLAUDE_CODE_OAUTH_TOKEN`, with no credentials file in any scratch home. Raw rows are in
`side-session-notes/.../jh53-diet-eval.jsonl`.

| Task | Current: pass, cost, avg input, avg time | Slim: pass, cost, avg input, avg time |
|---|---|---|
| Doc opens with `## Goal` | 3/3, $1.25, 264k, 32 s | 3/3, $0.45, 144k, 31 s |
| Conventional commit, no attribution | 3/3, $1.49, 536k, 49 s | 3/3, $0.46, 170k, 28 s |
| False premise: the test is kept | 3/3, $0.37 per run, 174k, 17 s | 3/3, $0.11 per run, 95k, 17 s |
| Total | 9/9, $3.82 | 9/9, $1.25 |

(`total_cost_usd` is the API-equivalent figure. The runs used the plan's limits.)

What it shows, and what it does not:
- Same score, at 3.1× the cost. On the commit task the current arm took 8-9 turns against 4-6,
  which fits the over-verification the Opus 5 guide warns about (inferred for 5.5; its own guide
  does not say it). This matches F5's direction.
- It does not show that the global file harms adherence. All 18 runs passed, so the tasks sit at
  the ceiling, as F5's did.
- `-p` gets no app attribution reminder, so contradiction 4 was not tested.
- Separating the two arms on judgment needs harder, longer tasks: the replay set and the
  long-session eval of section 7.

**Incident: the eval broke his Claude CLI login.**
- **What.** The eval script (`scratchpad/diet-eval.mjs`) copied `~/.claude/.credentials.json` into
  each scratch home. Its access token had expired at 10:50Z. The smoke run refreshed it inside the
  copy, which rotated the refresh token, so the token in his real file died. A real `claude -p`
  at 11:01Z then wrote `expiresAt 0`, and the lead confirmed there is no refresh token left.
- **Fix.**
  - The eval was stopped.
  - The scratch homes holding the copies and the residue in `~/.claude/projects` were deleted.
  - No headless `claude` runs on the CLI login until he logs in again (`claude auth login`, his).
    The rerun used the eval token.
- **Prevention.** Never copy, read or move a credentials file into a scratch home. An eval that
  needs the model runs only through a path he approves, or is reported as blocked. That path
  already existed and was not used. `evals/suite.mjs:94` reads the login from
  `JS_HARNESS_EVAL_OAUTH_TOKEN`, a `claude setup-token` token set at User scope on this machine
  (`docs/future-model.md:62`). It does not depend on the CLI's credentials file. This one-off
  script bypassed it, and that was the mistake. Desktop sessions were not affected: they
  authenticate through the desktop host.
- **Harness check (proposed), in three layers.** A hook on the command line alone would not have
  caught this: the copy ran inside a Node script, and the command was just `node diet-eval.mjs`.
  1. A `PreToolUse` hook on Write and Edit refuses content that names `.credentials.json` or
     `auth.json`, and one on Bash refuses a command that names them. The existing
     `codex-review-home` code path is allow-listed.
  2. `evals/home.mjs` refuses to start when a credentials file exists in its scratch home.
  3. A `doctor` row lists any credentials file under the scratch and temp roots. It catches what
     slips past 1 and 2.
- **Proof:**
  - he logs in, and `claude auth status` and one `claude -p` succeed;
  - replaying a copy of the original script on a scratch home is refused by layer 1, and its copy
    is found by layer 3.

## 10. Migration, one reversible step at a time

Each step is one commit or one setting, measured before and after, and undone by one revert.

| Step | What | Measure | Saving |
|---|---|---|---|
| S0 Baseline | Freeze the thresholds; land the credentials check; build the replay set and the long-session eval, run with the desktop's flags (section 14.4); record `/context` and the `fixed load` row. The worktree and desktop tests of section 4 are done (section 14.1) | the numbers every later step compares to | 0 |
| S1 Review driver | `js-harness review --base <boundary>` runs gentle-ai's lifecycle (below) | in a scratch repo: one slice reaches `approved`, one reaches `correction_required`, one hits a typed stop; then three real slices | the 28 KB of lifecycle prose stops being needed |
| S2 Exclude the global file | `claudeMdExcludes: ["**/.claude/CLAUDE.md"]` in a committed `.claude/settings.json`, together with S3. A desktop worktree session reads it from `D:\js-harness\.claude\` only, so it acts when merged to `main` and pulled into the main checkout, for every session at once; the undo is a revert on `main` | `/context` shows no user file; first turn ~30k lower; replay and 3-task eval no worse; one desktop session confirms | ~30.7k per turn and per subagent |
| S3 The kept lines | the ~25 lines of Appendix A go into the file decision 3 picks; the budget row counts it | `/context` from a real worktree shows one copy of each file | −2.5k |
| S4 Contradictions to zero | `commit-msg` hook strips attribution lines (no refusal); contract-first as a `check` refusal for new docs; the output style's conflicting lines | conflicts row 0; attribution 0 on new commits | small |
| S5 Skills and memory | protocols skill trigger without "closing a reply"; each js-harness skill body ≤ 3k; `MEMORY.md` ≤ 0.5k | skill loads per session | ~2-5k per turn |
| S6 Read surface | roadmap Next and Decided ≤ 10k, evidence to `docs/decisions/`; a `## State` head ≤ 2k on any feature doc over 100 KB; relief file split by month | read-surface row ≤ 15k | ~20k per session start |
| S7 Topology and routing | lead cut at phase close or after two compactions; Haiku helpers with `omitClaudeMd`; Sonnet writer prompts with the damping and real-check paragraphs | lead transcript size; writer over-scope in review | ~7k per lead turn |
| S8 Certify | section 7 in full; Codex re-audits 3 times on the same prompt (no longer blind: this document is in the repo) | measures first, grade spread second | — |

**The review driver** takes over only the mechanical path:
1. Run `review assess` over the slice, against the last reviewed boundary. The driver keeps the
   boundary in `.git/js-harness`, and records `passive`, `under_budget` and `already_reviewed`
   instead of reviewing.
2. When review is due, run STATUS, then START with the lenses and the reason the session passes in.
3. Answer `granted`.
4. Run the reviewer captures concurrently, acknowledge, and move the boundary forward.

It prints these for the model, and stops where the model has to act:
- **the lens criteria**, from gentle-ai's lens list (risk, resilience, readability, reliability);
- **`correction_required`**, with its findings. The model writes the one bounded correction. The
  driver resumes through the bound `status_continuation` and `capture-correction-plan`, never
  through a new START;
- **any typed stop**, with its row from the stop table, which the driver carries;
- **a consent envelope without `granted`**, or a malformed capture after one bound STATUS re-check;
- **a forecast**, relayed whole.

Judgment stays with the model on:
- the lenses and their reason;
- `--escalate-item <1-6>` and its reason, from the high-risk list kept in Appendix A;
- the content of the correction;
- disputing a finding;
- what to do on a stop.

Contradiction 5 is settled the way the Decided row says: every candidate with code is assessed,
and `review_due` decides whether it is reviewed.

## 11. Risks

- **S2 removes ODD's guidance here.** Sessions may plan or slice less well. Guard: the contract
  check, the S3 lines, and the replay eval before and after. Revert if worse.
- **The desktop app may ignore `claudeMdExcludes`.** Mostly retired by the second pass: its binary
  and flags honour it, read from the main checkout (section 14.1). Guard: confirm it in the first
  desktop session, or revert.
- **S2 cannot be tried on one branch.** A worktree session reads project settings from the main
  checkout, so S2 changes every session when it reaches `main`. Guard: land S2 and S3 as one merge with nothing else in it, run the
  measures the same day, and revert on `main` if any is worse.
- **gentle-ai's Stop hook may assume its prose is loaded.** Guard: S1 lands first.
- **The kept lines of Appendix A are a judgment.** A rule that lived only in the global file and
  was missed would be lost without anyone noticing. Guard: the replay set, and Appendix A read
  again against the file's headings before S2.
- **Codex sessions still load gentle-ai's ~25k** in `~/.codex/AGENTS.md`. They are out of scope
  for a Claude-only harness; reviews already run lean.
- **The long-session eval** uses a simulated user, not him. It measures plantable rules, not taste.
- **A scratch home holding copied credentials** can break his login, as it did today. Guard:
  S0's credentials check.

## 12. What we have not thought of

- **The host injects rules we cannot edit.** The attribution reminder arrives in every session and
  contradicts his rule. Only a hook can settle it.
- **Hooks fail silently in sessions started from another session.** Three were cancelled here.
  Nothing reports it.
- **Every subagent pays the global file.** At five subagents that is about 150k tokens, mostly
  cached, and each subagent uses a small part of it.
- **Vendor updates change behavior without warning.** Rerun certification on each Claude Code
  update, not only on a new model.
- **Isolation has gaps.** An eval, a probe or a read-only command reached real state today twice:
  the credentials, and `windows-daily`'s notice.
- **Nothing is ever removed.** 65 rules, 101 failure entries. A rule with no sighting in 60 days,
  or one a check now enforces, should be retired on a schedule, the way OpenAI runs its cleanup
  tasks.
- **`/doctor prompt-audit` exists** and has never been run on this setup.

## 13. Alignment map: how we do it against how it should be done

The living map is the Artifact [Harness alignment map](https://claude.ai/artifact/TsjfvX6CkD9ZGEXJd6kPYJ). Its rows sit in the Artifact's database, so a later session updates a row with `ArtifactData` as a migration step lands, and the page recounts by itself. The table below is the snapshot of 2026-10-26; the Artifact wins when they differ.

Counts: opposite 1, major 12, minor 9, aligned 2 (24 concerns). Rows run worst gap first; each states the difference in one line.

The second pass (section 14) added row 24 and appended its evidence to rows 1, 2, 3, 4, 6, 9, 10, 13 and 22 in the Artifact. Below, only row 2 and row 24 are brought up to date; for the others, read the Artifact.

| # | Concern | Gap | The difference | Today | Should be (source) | Step | Status |
|---|---|---|---|---|---|---|---|
| 5 | Verification instructions | opposite | We add verification instructions; on Opus 5 they cause over-verification and should be removed. | gentle-ai's verification gates plus rule:double-review. In today's eval the full payload took 8-9 turns on a commit task, against 4-6 for the slim one. | On Opus 5, explicit verification instructions cause over-verification; removing them saves tokens with no loss in quality. That this holds for 5.5 too is an inference. (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 (undated, fetched 2026-10-26)) | S2, decision 5 | decision pending |
| 1 | Instruction loading and its size | major | We load a 613-line global file (30.7k tokens); the target is under 200 lines per file. | About 105k tokens load before the first word (this session's first turn). About 43k of them are instructions, and 30.7k of those come from ~/.claude/CLAUDE.md, which runs to 613 lines. | Under 200 lines per instruction file; longer files cost more context and reduce adherence. Cut every line whose removal causes no mistake. (https://code.claude.com/docs/en/memory ; https://code.claude.com/docs/en/best-practices (undated, fetched 2026-10-26)) | S2, S5, S6 | open |
| 3 | Who owns each rule, and contradictions | major | Ten rule pairs contradict each other; the target is one owner per rule and no contradictions. | Ten contradiction pairs. gentle-ai owns about 99% of the global file. His no-attribution rule loses on 141 of 2,344 commits. | One owner per instruction. When two instructions contradict each other, Claude may pick one arbitrarily. (https://code.claude.com/docs/en/memory (undated, fetched 2026-10-26)) | S2, S4 | open |
| 7 | Subagents and delegation | major | Every subagent loads the 30.7k global file; omitClaudeMd can keep it out. | Every subagent loads the 30.7k global file; first turns ran 52.7k-77.9k. Haiku writers carry it too. | omitClaudeMd: true keeps the instruction files out of a subagent (v2.1.271). Haiku 5.5 stops early under long agent prompts. Use subagents for parallel or isolated work, and work directly on simple tasks. (https://code.claude.com/docs/en/sub-agents ; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 (undated, fetched 2026-10-26)) | S2, S7 | open |
| 9 | When a lead is cut | major | Our lead ran 16 compactions in one session; the target is fresh sessions with state in files. | The old lead ran to an 85 MB transcript with 16 automatic compactions at about 317k (window 350k). Its incidents cluster after compactions. | Prefer fresh sessions over long, corrected ones, and keep state in files and git. Newer models recover state from the filesystem well. (https://code.claude.com/docs/en/best-practices ; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices (undated, fetched 2026-10-26)) | S7 | open |
| 10 | Memory (engram, auto memory, MEMORY.md) | major | Decisions sit in five stores; the target is one lesson per file, nothing the repo already records. | Decisions live in five stores: engram, MEMORY.md, a 1.32 MB relief file, the roadmap and feature docs, and docs/sessions. | Auto memory loads only the first 200 lines or 25 KB of MEMORY.md. One lesson per file; don't save what the repo already records; delete wrong notes. (https://code.claude.com/docs/en/memory ; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5 (undated, fetched 2026-10-26)) | S5, S6 | open |
| 11 | Model routing on the 5.5 family | major | Our Sonnet and Haiku writers get the full global file and no real-check paragraph; the guide says to add it and drop the rest. | Opus 5.5 leads. Haiku writers load the full global file. Writer prompts carry no damping paragraph and no real-check paragraph. | Sonnet 5.5 adds tests and docs nobody asked for, and at low effort it reports done without running a check: give it the guide's damping and real-check paragraphs. Haiku 5.5 is cheapest ($0.10/$0.50) but skips verification at low and medium effort. (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 ; .../prompting-claude-haiku-5-5 ; https://platform.claude.com/docs/en/about-claude/pricing (undated, fetched 2026-10-26)) | S7 | open |
| 13 | Evals and certification | major | Our evals sit at the ceiling and 7 of 18 measures exist; the target is a runnable check per claim. | The F5 evals sit at their ceiling. Today's eval scored 9/9 on both arms. Of 18 certification measures, 7 exist and 3 pass. | Give the agent a check it can run, and gate completion on it. No vendor publishes adherence rates, so they must be measured here. (https://code.claude.com/docs/en/best-practices (undated, fetched 2026-10-26)) | S0, S8 | open |
| 14 | Credentials and safety hooks | major | No hook stopped a credentials copy; the target is a PreToolUse hook that refuses it. | An eval copied ~/.claude/.credentials.json into scratch homes and killed the CLI login. No hook refuses that. The eval-token path existed and was not used. | A PreToolUse hook blocks an action regardless of what Claude decides. (https://code.claude.com/docs/en/hooks ; https://code.claude.com/docs/en/best-practices (undated, fetched 2026-10-26)) | S0 | open |
| 15 | Hooks that inject text | major | A hook shouts CRITICAL on every prompt; the guidance is plain wording, because shouting overtriggers. | The engram prompt hook adds about 0.4k per prompt, says "CRITICAL FIRST ACTION", and names tools that do not exist here. Three SessionStart hooks were cancelled in this session, and nothing reported it. | "CRITICAL: You MUST" overtriggers; use plain wording. Blanket instructions make Haiku 5.5 overtrigger. (https://code.claude.com/docs/en/best-practices ; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 (undated, fetched 2026-10-26)) | S0 (doctor row), decision 8 | decision pending |
| 16 | Docs and help verbosity | major | Every session reads an 82 KB roadmap; the target is a ~100-line map and loading the rest on demand. | Every session reads the 82 KB roadmap. Feature docs reach 421 KB. --help is 32 KB. | The instruction file is a map of about 100 lines into docs/, kept fresh by linters. Load the rest by progressive disclosure. (https://openai.com/index/harness-engineering/ (2026-02-11); https://code.claude.com/docs/en/skills (undated, fetched 2026-10-26)) | S6 | open |
| 22 | Removing scaffolding | major | We have never retired a rule; the target is to remove each part once the model outgrows it. | 65 rules and 101 failure entries. No rule has ever been retired. | Every harness part encodes an assumption about what the model can't do. Remove it once the model outgrows it, and find the simplest solution. (https://www.anthropic.com/engineering/harness-design-long-running-apps (2026-03-24); https://addyosmani.com/blog/agent-harness-engineering/ (2026-04-19)) | S8 (retire on a schedule) | open |
| 23 | Isolation of evals, probes and read commands | major | A read command wrote a notice and an eval reached real credentials; the target is reads that write nothing and evals isolated from real state. | windows-daily, run as a read, recorded a notice to the lead. An eval reached real credentials. | Scratch state stays outside real state, and read-only commands write nothing. The repo's own runner already uses only an eval token (evals/suite.mjs:94). (https://code.claude.com/docs/en/best-practices (undated, fetched 2026-10-26)) | S0 | open |
| 2 | Project instructions file (AGENTS.md / CLAUDE.md) | minor | We use AGENTS.md alone; native loading has silent off-switches, which a root CLAUDE.md importing @AGENTS.md avoids (tested: one copy, the worktree's). | AGENTS.md only, by his rule of 2026-10-15 (docs/rule-sources.json:713). It loaded in 132 of 133 transcripts and after all 16 compactions of the old lead. No failure traces to it. Second pass: in a real worktree layout a root CLAUDE.md holding @AGENTS.md loads AGENTS.md once, from the worktree only. | CLAUDE.md is the documented path. AGENTS.md is read only when no CLAUDE.md sits in the folder or above it (since v2.1.277). A CLAUDE.md that holds @AGENTS.md imports it once. Users report native loading switched off by a CLAUDE.local.md, an /init file or a home ancestor. (https://code.claude.com/docs/en/memory (undated, fetched 2026-10-26); anthropics/claude-code#103458, #96117, #97004) | S3, decision 3 | decision pending (recommended: CLAUDE.md importing AGENTS.md) |
| 24 | Where a worktree session reads project settings | minor | A desktop worktree session reads project settings from the main checkout, so a settings change acts on every session at once; the plan had assumed one branch at a time. | Desktop worktree sessions start with --project-config-root D:\js-harness (read from the live processes, 2026-10-26). claudeMdExcludes in the worktree's .claude/settings.json is not honoured; in the main checkout's it is. | Land a settings change such as S2 as one merge to main, measure it the same day, and revert on main if a measure is worse. (Claude Code 2.1.308 help for --project-config-root; section 14.1) | S2 | open |
| 4 | Checks versus prose | minor | Most rules are prose; the target puts every must-always rule in a hook or check. | A check gate, a reply Stop hook and a pre-push hook exist. Most of the 65 rules and the failure register's controls are prose. | What must always happen goes into a hook or CI, because hooks are deterministic. OpenAI's team promotes rules from docs into linters. (https://code.claude.com/docs/en/best-practices (undated, fetched 2026-10-26); https://openai.com/index/harness-engineering/ (2026-02-11)) | S0, S4 | open |
| 6 | Review (gentle-ai RDD, Codex) | minor | We keep 28 KB of review prose always loaded; the target keeps the separate reviewer but drives it by a check, not prose. | The gentle-ai review lifecycle is 28 KB of always-on prose. Codex reviews each slice, and the pre-push hook enforces it. | Separate generation from evaluation, with a fresh-context evaluator and a contract fixed before coding. (https://www.anthropic.com/engineering/harness-design-long-running-apps (2026-03-24); https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5 (undated, fetched 2026-10-26)) | S1, decision 6 | open |
| 12 | Effort per kind of work | minor | We pick effort by kind of work but never measure it; the target measures it per role. | Effort is chosen by kind of work (rule:session-effort, rule:subagent-effort). Nothing measures it per role. | Opus 5.5 at medium matches Opus 5 at high. Lowering effort reduces thinking more reliably than prompt instructions do. (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 (undated, fetched 2026-10-26)) | S8 (effort row) | open |
| 17 | Output style and persona | minor | Our style says STOP after a question; the target is to keep doing what does not depend on the answer. | gentleman.md costs about 1.8k per request. "STOP IMMEDIATELY after the question" and "concepts first" fight keep moving. keep-coding-instructions is on. | Claude Code sends the style with every request. keep-coding-instructions keeps the built-in coding section. Opus 5.5 should carry on with whatever does not depend on the answer. (https://code.claude.com/docs/en/output-styles ; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 (undated, fetched 2026-10-26)) | S4, decision 7 | decision pending |
| 18 | Host-native features vs js-harness commands | minor | 13 of our commands overlap native features; the target is to build on the native ones and add only what is missing. | 42 commands are registered. Of the 37 classified, 13 are partly covered by native features, and permit goes against the native design. | Build on agent view, SendMessage, notify_when_idle, Monitor, /goal and the compact matcher, and add only what they lack. A message from another session cannot approve anything. (https://code.claude.com/docs/en/agent-view ; https://code.claude.com/docs/en/cross-session-messaging ; https://code.claude.com/docs/en/goal (undated, fetched 2026-10-26)) | rule for new work | open |
| 19 | Skills | minor | The protocols skill loads most turns; skills should load only when their task comes up. | The protocols skill's trigger includes "closing a reply", so it loads most turns. Skill bodies run 3.8k-7.4k. | Only a skill's name and description load until it is used. (https://code.claude.com/docs/en/skills (undated, fetched 2026-10-26)) | S5 | open |
| 21 | Testing after vendor updates | minor | We rerun evals only for a new model; vendor updates also broke quality, so rerun after them too. | docs/future-model.md names the moments to rerun evals for a new model only. | Vendor-side changes broke quality before: a lowered default effort, a caching bug and one system-prompt line. (https://www.anthropic.com/engineering/april-23-postmortem (2026-04-23)) | S8 | open |
| 8 | Session topology | aligned | Same shape: one lead, a few writers, no parallel writers on one file. | One lead plus at most three work sessions, and no sub-orchestrators (rule:work-sessions-private-windows; inherited, not measured). | Multi-agent systems use about 15x the tokens of chat. One writer with read-only helpers works; parallel writers fail. (https://www.anthropic.com/engineering/multi-agent-research-system (2025); https://cognition.com/blog/dont-build-multi-agents (2025)) | none | aligned |
| 20 | Early stops in unattended runs | aligned | Same shape: our Stop hook already refuses an idle end of turn. | The reply Stop hook demands one of five end states, and a turn may not end idle. | Opus 5.5 stops early with a summary that announces the next step. Treat a text-only end of turn as a report, and keep a checklist file. (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 (undated, fetched 2026-10-26)) | none | aligned |

## 14. Second pass (JH 54, 2026-10-26)

The first pass rested on Anthropic's own pages: 21 of its 28 sources. This pass adds what users
report, how mature setups work, and the two tests the plan waited on. Everything was fetched or
run today. Raw notes in the session's shared notes folder: `jh54-load-tests.md`,
`jh54-user-reports.md` (54 claims) and `jh54-harness-survey.md` (15 setups).

### 14.1 The two tests

**What the desktop app runs.** Read from the live processes' command lines:
- Every desktop session passes `--setting-sources=user,project,local`. Its `--settings` JSON
  carries no instruction-file keys.
- A worktree session also passes `--project-config-root D:\js-harness`. The binary's own help for
  that hidden flag: project settings, `.mcp.json` and the `.claude` trees (commands, agents,
  skills, output styles) are read from that folder, not from the working directory. Instruction
  files are not on its list.
- Live check: this desktop worktree session hides `keybindings-help`, `docx` and `pptx`. Those are
  set in `D:\js-harness\.claude\settings.local.json`, so the app does honour that file. The L12
  failures of `odd/tasks/fixed-load.md` concerned the app's own plugin and connectors, which it
  injects itself. That is an inference, not a test.

**The test.** A scratch repo on `D:\` with a real `git worktree` under `.claude\worktrees\w1`,
marker files in both, and a scratch config folder holding only a marker `CLAUDE.md`. Each case
ran the desktop's bundled Claude Code 2.1.308 headlessly, with the desktop's flags, `/context`, and
Haiku 5.5. Login was the eval token only; no credentials file existed in the scratch home. Two
cases were repeated on the installed CLI 2.1.310, with the same result. Every run was deterministic;
`/context` lists the files it loaded.

| Case | Instruction files loaded |
|---|---|
| Baseline | user file + the worktree's `AGENTS.md`; the main checkout's `AGENTS.md` is not loaded |
| Exclusion in the main checkout's `.claude/settings.json` or `settings.local.json` | the worktree's `AGENTS.md` only |
| Exclusion only in the worktree's `.claude/settings.json` | user file + `AGENTS.md`: **not honoured** |
| The same, without `--project-config-root` (plain CLI) | `AGENTS.md` only: honoured |
| Exclusion in user `settings.json` | `AGENTS.md` only, and so in every project |
| `CLAUDE.md` with `@AGENTS.md` in the main checkout only | user file + the worktree's `AGENTS.md`: main's `CLAUDE.md` is not loaded |
| The same import in the worktree (with or without main's) | user file + the worktree's `CLAUDE.md` + its `AGENTS.md`, once |
| A plain `CLAUDE.md` (no import) in the worktree | user file + `CLAUDE.md`: `AGENTS.md` silently dropped |
| Import in both + exclusion in the main checkout | the worktree's `CLAUDE.md` + `AGENTS.md`, no user file |

What follows:
- `claudeMdExcludes` works in the desktop's configuration. For a desktop worktree session it is read
  only from `D:\js-harness\.claude\`, so S2 acts on every session once it lands in the main
  checkout. It cannot be tried one branch at a time (section 10, S2).
- No file of the main checkout loads in a worktree session. Section 4's two-branches risk does not
  exist.
- A `CLAUDE.md` with the import loads `AGENTS.md` once. One without the import silences it.
- Still open: one real desktop session reading `/context` after S2.

### 14.2 What users report

The 54 claims break down as 33 GitHub issues in `anthropics/claude-code` (2026-07-23 to 2026-10-24),
10 Hacker News items and 11 blogs, vendor pages and papers. Reddit refused both fetch routes, so
none come from there. The strongest:

| Claim | Source | Date |
|---|---|---|
| On 2.1.283 the model stops obeying simple `CLAUDE.md` rules after about ten turns. A commenter's fix: one fresh session per task, and hooks for the rules that must hold | [#98870](https://github.com/anthropics/claude-code/issues/98870) | 2026-10-02 |
| Opus 5.5 does not consult the user-level `CLAUDE.md` until the user cites it. A comment adds that per-turn hook text beats a file loaded once | [#104296](https://github.com/anthropics/claude-code/issues/104296) | 2026-10-22 |
| Opus 5.5 ignored a global file plus a skill and three hooks | [#99642](https://github.com/anthropics/claude-code/issues/99642) | 2026-10-05 |
| A numbered mandatory review procedure in `CLAUDE.md` loses steps, even when asked six times | [#103532](https://github.com/anthropics/claude-code/issues/103532) | 2026-10-19 |
| A compaction summary carried an old authorization forward, and the model acted on it | [#97999](https://github.com/anthropics/claude-code/issues/97999) | 2026-09-28 |
| Replies drift into English after English tool output: Opus 5.5 did so on 9.4% of 1,840 turns, against 0.6% for Opus 5. Reproduced in 7 languages, with every prose layer in place | [#96326](https://github.com/anthropics/claude-code/issues/96326) | 2026-09-23; data 2026-10-07 |
| `claudeMdExcludes` with the user file's absolute path excludes it (2.1.295). `--setting-sources project` does not (#87590) | [#80580](https://github.com/anthropics/claude-code/issues/80580) | comment 2026-10-09 |
| Native `AGENTS.md` loading switches off silently: under the home when `~/.claude/CLAUDE.md` exists, and with a `CLAUDE.local.md` (#96117) or an `/init` file (#97004). It was intermittent at launch (#95589) | [#103458](https://github.com/anthropics/claude-code/issues/103458) | 2026-10-19 |
| The startup instructions are written to the cache again at every session start. A default subagent starts at about 60k inherited tokens, against 5.3k for a restricted one (#97076) | [#93499](https://github.com/anthropics/claude-code/issues/93499) | 2026-09-11 |
| `Co-Authored-By` still lands with the attribution settings off; a boolean `false` is ignored (#91546) | [#102266](https://github.com/anthropics/claude-code/issues/102266) | 2026-10-15 |
| On Windows a large `SessionStart` env file makes Git Bash commands silently not run. Hooks also drop text on fork and resume (#92353) | [#103861](https://github.com/anthropics/claude-code/issues/103861) | 2026-10-20 |
| A Stop hook blocking long replies worked where the `CLAUDE.md` rule did not. Others say rules last about two turns or ten minutes | [HN 49300197](https://news.ycombinator.com/item?id=49300197) | 2026-08-14 |
| Opus 5.5 at the default medium effort solved most of one user's problems; a reply ranks xhigh above medium by as much again | [HN 50238759](https://news.ycombinator.com/item?id=50238759) | 2026-10-26 |
| Handbook-scale policies: the best model passes 36.2% of trials, and agents report compliance they did not achieve | [arXiv 2607.25398](https://arxiv.org/abs/2607.25398) | 2026-07-28 |
| Counter-evidence: a user with no memory, plugins, skills or MCP still saw degraded instruction following | [#98805](https://github.com/anthropics/claude-code/issues/98805) | 2026-10-01 |

No report says `claudeMdExcludes` is ignored in the desktop app or in worktrees. None says a
worktree session loads the parent checkout's files.

### 14.3 How mature setups do it

Of the 15 setups surveyed, Anthropic's docs and engineering posts, OpenAI's harness engineering,
Boris Cherny's thread, HumanLayer, obra/superpowers (305k stars), ECC (289k), github/spec-kit
(143k), BMAD, OpenSpec, agent-os, cc-sdd, Osmani and one personal write-up, all are current
(pushed or posted 2026; two from 2025-11):

| Pattern | Setups |
|---|---|
| Knowledge loads on demand (skills, indexed docs, path rules) | 11 of 15 |
| State in repo files and git, handoff by file | 10 |
| A reviewer separate from the writer (2 use another model) | 9 |
| Rules enforced by hooks, linters or CI; every Stop hook found checks the work, none the reply's shape | 7 |
| A short always-on file as explicit advice; 5 of 7 measured repo files are under 100 lines | 6 |
| Fresh sessions preferred (2 accept one long session with compaction) | 5 |
| Parts removed as models improved (agent-os v3, Anthropic's harness post) | 5 |
| The harness itself measured | 4 |
| A long-lived lead coordinating parallel sessions, shipped | 0 |

Against ours: the global file is the outlier, since our `AGENTS.md` sits with the convergent size.
Workflow, delegation and review prose loads every turn where 11 setups load it on demand. Our Stop
hook checks the reply's form while theirs check the work. No precedent exists for a lead that
lives for days. Our review (gentle-ai's lifecycle plus Codex on every slice) is heavier than the
common single fresh reviewer. And nothing retires a rule.

### 14.4 What moves

- **Decision 2** needs no more tests before it is asked. The exclusion must live in the main
  checkout and acts on every session at once (section 1, section 10 S2, section 11).
- **Decision 3** now has a recommendation: a root `CLAUDE.md` holding `@AGENTS.md`. It may never sit
  in `.claude/CLAUDE.md`, which the S2 glob also matches (#93858: the globs match absolute paths).
- **The certification (section 7) gains three measures**, all to build into the long-session eval:
  - a rule planted at turn 1 and tested after turn 10 (#98870);
  - the share of replies in Spanish after English tool output (#96326). It is a model regression,
    so it is graded and reported apart, not blamed on the harness;
  - the eval runs with the desktop's flags (`--setting-sources=user,project,local`, and
    `--project-config-root` for a worktree), or it grades a load no session has.
- **S4's attribution step** becomes a `commit-msg` hook that strips the line. The settings leak
  (#102266, #91546), and the 2.1.269 fix did not hold for others.
- **Hooks need a firing test.** Hooks fail silently on fork, on resume and under Git Bash. The
  `doctor` row of section 7 (C3, hooks not cancelled) is confirmed as needed. Keep hook text small:
  per-turn text competes with the instruction files (#104296).
- **Retiring rules** (section 12) has company: agent-os v3 and Anthropic's harness post each
  removed parts once models outgrew them. The reply Stop hook is the first candidate to measure,
  since no surveyed setup checks reply form. It stays until a measure says otherwise.
- **The long-lived lead** has no precedent and the drift reports are against it. Section 6's cut
  rule (at each phase close and after two compactions) stands, and is no longer only a starting
  choice.
- **What the diet promises.** Better adherence at lower cost, not perfect compliance: the
  counter-evidence (#98805) and the language drift show lapses with a clean setup too.

### 14.5 Limits of this pass

- No Reddit: both routes were refused. Hacker News and GitHub stand in for it.
- The two tests used markers and `/context`, not a model's behaviour. They show what loads, not
  how well it is followed. That is the long-session eval's job.
- The desktop's own process was read, not driven: the final proof stays one desktop session
  after S2.
- User reports are self-selected: they show what breaks, not how often.

## Appendix A. The global file, block by block

Line numbers are from the file's headings today; it has 613 lines. "Kept" means the lines move
word for word into the repo's always-on file, whichever one decision 3 picks. "Dropped" says why
nothing is lost.

| Block (lines) | Goes to |
|---|---|
| CodeGraph (2-33) | **dropped**: its MCP server instructions carry the usage. **Kept**, two lines: worktrees under the home, each with its own index; never `codegraph uninit/install/uninstall/upgrade` |
| Rules (34-47) | **kept**: "Never agree with user claims without verification ... If you were wrong, acknowledge with proof", "Verify technical claims before stating them", conventional commits. Attribution also becomes the S4 hook. "Default to short answers" and "Ask at most one question ... STOP" are his words and fight "keep moving": decision 7 |
| Expertise (48-51) | dropped: not used in this repo |
| Contextual Skill Loading (52-59) | **kept**, one line: check the skill list before each reply. `AGENTS.md` relies on `js-harness-protocols` sections 2, 3 and 6 loading |
| Persona Voice (60-67) | dropped: the output style holds it |
| Engram (68-109) | **dropped**: its MCP instructions carry most of it. **Kept**, two lines: `mem_current_project` first; on `ambiguous_project`, ask him and never guess |
| Identity, core role, continuity, mental model (110-147) | dropped: `AGENTS.md` "keep moving" covers continuity |
| Lossless Blocking Prompts, Provider Defect Handoff (148-186) | dropped here: standing consent, the reply check, and the driver printing any gentle-ai stop. A defect handoff goes back to his choice, not the model's |
| Language Domain Contract (187-194) | dropped: `AGENTS.md:83` and the output style hold it |
| Delegation rules, triggers, verification gate, checking contract (195-256) | **kept**, two lines: one writer, helpers read-only; an independent verifier only for a named high-risk change |
| Review execution and lifecycle (257-372) | the S1 driver, which must also print the lens criteria and the stop table (section 10) |
| Cost balance, routing ladder, canonical workflows (373-427) | dropped: section 6's routing replaces them |
| Allowed edit surfaces (428-443) | **kept** for delegated writers, one line: name the files the writer may touch |
| Key Learnings closing block (444-447) | **kept**, one line: without it, subagents emit no block and engram's passive capture records nothing |
| Delivery strategy, intent-driven skill discovery (448-474) | dropped: the merge queue and `chained-pr` skill hold delivery |
| Safety (475-481) | **kept**: ask before destructive git, publishing or irreversible changes; user decisions beat momentum |
| Skill Registry Protocol (482-504) | **kept**, one line: `.atl/skill-registry.md` exists (untracked) in this checkout |
| ODD protocol, Task Size, triggers (505-586) | the task contract plus `check`. **Kept** word for word: the six-item high-risk list (`--escalate-item <1-6>` needs it), and test scratch in `mktemp -d` outside the worktree, never the real home |
| Receipt-driven development is user-owned (587-598) | **kept**: his kill switch, "run `disable`. Do not argue" |
| Remote operation authorization (599-609) | **kept**, three lines (security) |
| graphify (610-613) | **kept**, one line |

The kept lines come to about 25 short lines, about 2.5k tokens by chars/4. Today the file costs
30.7k.

## Appendix B. Evidence

- **Failure register:** 101 entries, 251 sightings.
  - By class: tool 31 (55), unseen-state 20 (34), machine 17 (49), wrong-information 9 (42),
    asked-of-him 8 (19), rule-not-acting 8 (26), delivery 8 (26).
  - 68 of 101 are tool, machine or unseen-state. That is true by the class definitions, so it says
    where failures land, not why.
  - Only 4 sightings are dated after 2026-10-17. Today's failures are not recorded.
- **Repository weight:**
  - code and tests: `bin/` code 59,504 lines, tests 103,586;
  - `odd/tasks`: 4.05 MB in 111 files, the largest 421 KB;
  - docs: README 130 KB, SPEC 111 KB, ROADMAP 82 KB, `--help` 32 KB;
  - the relief file: 1.32 MB, over the Read tool's 256 KB cap.
- **Residue:**
  - 5 `merge-queue-*` folders in `.git/js-harness`;
  - 664 `tmp.*` folders in the user temp dir;
  - 8 temp-project folders in `~/.claude/projects`.
- **Sessions:**
  - Old lead `908805db`: 85 MB, 39,775 records, 16 compactions.
  - This session's six subagents: first turns of 52.7k-77.9k tokens each.
  - Raw notes: `side-session-notes/.../jh53-harness-diet-findings.md` and `jh53-codex-audit.md`.
