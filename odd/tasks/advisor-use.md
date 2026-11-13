# advisor-use

Every role the harness runs (the lead, the work sessions, their sub-agents) consults the Fable advisor at the
moments that decide, checked by a hook rather than asked for in prose; and the senior gets its missing pieces.
Session JH 196, opened by the lead "JH ORQ · orquestador F8". Delivery: this proposal, through the double review and
then the lead as a question; nothing is built before his yes. Runner: `node --test`.

## State
Measured (below, "Measurement") and proposed (below, "Proposal"). Next: the double review of this document
(`js-harness double-review read odd/tasks/advisor-use.md`), then a `question` notice to the lead with the proposal.
Open: whether a PreToolUse hook sees an advisor call made earlier in the same assistant message (T1 probe, not run);
how to turn a senior's advisor off (no CLI flag found, see Measurement, M5).

## Goal
Each of the lead, the work sessions and the sub-agents that has the advisor calls it before it asks him a question,
lands, opens a session, writes a plan or declares a piece ready, and a hook refuses or flags the act where it did not.

## Why
His words (S1 to S3): he saw the lead decide without the advisor, asked that it be fixed for the sub-agents and the
sessions too, and did not see the senior session. The host's advisor prompt asks for calls "before substantive work",
but nothing in the harness names its moments: `git grep -n -i advisor` over `bin/lib/*skill*.mjs`, `CLAUDE.md`,
`AGENTS.md` and `.claude/agents` finds nothing, and the measurement shows most decisions go out with no call.

## Done when
- `js-harness contract check odd/tasks/advisor-use.md` exits 0
- `js-harness double-review tally --since 2026-11-13` lists a read of this document with both readers' findings answered
- His answer to the proposal is recorded in the channel (`notify --kind answer`) before any `bin/` file of this feature changes
- After the build (if he says yes): `node --test bin/advisor-gate.test.mjs` exits 0, and the measurement re-run a
  week later shows the gated moments covered (the bar in the Depth pass)

## In scope / Out of scope
- In: this document; the measurement scripts and their output in the lead's notes folder; after his yes, a hook
  command under `bin/`, its test, its install entry, and the protocols line that names it.
- Out: `~/.claude/settings.json` (his `advisorModel`, line 281, stays his); the advisor's own level (the CLI has
  none, `odd/tasks/advisor-home.md`); the model rules themselves (`rule:advisor-model`, `rule:senior-model`).

## Constraints
- Cost — because his line 3271 of 812b728f asks that usage be saved: an advisor call forwards the whole transcript
  uncached, 145,437 Fable input tokens and 8,412 output in the one call measured (`odd/tasks/advisor-home.md:106`), and
  it blocks the turn; so the gate covers few moments, not every turn.
- Fail open — because a hook that cannot read a transcript must not stop the work: it lets the call through and
  records it, as the template gate does (`bin/template.mjs:236`).
- No refusal without the tool — because a session the host gave no advisor would be refused forever.

## Ask me before
The proposal as a whole (it adds a hook every session meets); refuse or only flag; the moments it covers.

## Depth pass
- 1. Method: a control that runs at the act, not a line asking for it: the template gate on questions refuses an
  `AskUserQuestion` whose question was not recorded first (`bin/template.mjs:289-304`); the same PreToolUse shape can
  read the caller's transcript and refuse an act with no advisor call before it. Searched: `js-harness rules`
  (advisor-model and senior-model name the model, nothing the use); the skills, `CLAUDE.md`, `AGENTS.md`,
  `.claude/agents` (no mention of the advisor, above); codegraph for the template gate and the guard. Weighed and set
  aside: a line in the protocols alone (the host's own prompt already asks, and the lead still made no call for 1,295
  tool calls on 2026-11-10 to 11, when the tool was not yet on; and 4 in 594 after); a Stop hook on every reply (it
  would gate every turn, the cost above).
- 2. Raw material: the transcripts under `~/.claude/projects/D--js-harness*` since 2026-11-12, read by
  `jh196-advisor-measure.mjs` and `jh196-advisor-measure-gates.mjs` in the lead's notes folder (output beside them,
  `jh196-advisor-measure-2026-11-13.txt`); the tool list each request carried, in the `api-request-shape` lines (type
  `advisor_20260301`, model `claude-fable-5-2`); `~/.claude/settings.json:281` (`advisorModel`); the background
  record `~/.js-harness/background/sessions.jsonl:288` (the senior started with `"advisor": null`); the template gate,
  `bin/template.mjs:289`; the call's cost, `odd/tasks/advisor-home.md:106`; his words at lines 662, 757 and 771 of
  69918425.
- 3. The bar:
  spec 1: `node jh196-advisor-measure.mjs 2026-11-12`: the lead covers 1 of 20 questions, 2 of 10 session openings,
  1 of 1 land; work sessions 7 of 37 ready or closed notices, 2 of 6 plans, 0 of 1 question; sub-agents 3 of 8 ends.
  Target after the build: every gated moment covered or recorded as exempt.
  spec 2: `node --test bin/advisor-gate.test.mjs`: none, new behaviour (no hook reads the advisor today).
  spec 3: `git grep -n "strongest model the rules name" bin/lib`: `bin/lib/protocols-skill.mjs:43` and
  `bin/lib/codex-review-recheck.mjs:21,41` still send the hardest work to `rule:session-model`, not the senior.
- 4. Refutation: the request would not hold if the roles already called the advisor at these moments, or if they did
  not have the tool. Run: `node jh196-advisor-measure.mjs 2026-11-12 --rows`. Result: every transcript since 2026-11-12 whose requests are recorded had the
  tool (offered=yes in all 23), and 3 of 20 lead questions, 9 of 44 work-session moments were covered.
  Verdict: supports
- 5. Request: "Measure advisor use by role at the moments that decide; propose a hook that refuses or flags those
  acts when no advisor call came before them, with its cost; and list what the senior still lacks."
  Adds: none

## Specs
1. "Trata de utilizar mas Fable como Advisor ya que estas tomando decisiones y no lo has utilizado ni una sola vez"
   (69918425, line 662, 2026-11-13).
2. "avísame cuando pueda reiniciar, pero por favor soluciona ese problema de no utilizar el advisor y debemos tambien
   tener ese mismo problema con las sub agente y sesiones" (69918425, line 757, 2026-11-13).
3. "y tambien no veo la sesion orquestadora senior que va a tener el fable para cosas de suma importancia o que
   necesiten mas potencia" (69918425, line 771, 2026-11-13).

## Measurement
Window: transcripts begun since 2026-11-12 00:00 (about 1.75 days), each tool call counted once (resumed transcripts
copy their history), each advisor call once by its `srvtoolu_` id. A moment is covered when an advisor call came
after his last typed message and after the last gated moment. Moments: a question (`AskUserQuestion`, `notify --kind
question`), a land (`merge-queue --land`, not a dry run), a session opened (`start_session`, `sessions start`), a plan
(`ExitPlanMode`, a Write of `odd/tasks/*.md`), done (`notify --kind ready|closed`; for a sub-agent, its last 15 calls).

| Role | Transcripts (called at all) | Advisor calls / tool calls | Moments covered |
|---|---|---|---|
| lead | 2 (2) | 10 / 740 | question 1/20, session 2/10, land 1/1, done 0/1 |
| work | 11 (8) | 12 / 2,044 | done 7/37, plan 2/6, question 0/1 |
| sub-agent | 8 (3) | 4 / 301 | end 3/8 |
| senior | 2 (1) | 3 / 124 | done 1/3 |

- M1. Every role has the tool: all 23 transcripts carry it in their recorded requests, from `~/.claude/settings.json:281`,
  sub-agents included (Opus, Fable and one Haiku). So the gap is use, not reach; the brief's open question is answered.
- M2. The lead: the brief's "0 until he said so" holds for the lead begun 2026-11-10 (0 in 1,295 calls; before the
  setting); the current lead made 6, 4 of them after line 662. Its questions are the largest gap: 19 of 20 bare.
- M3. Work sessions call it, mostly early (the plan) and seldom before ready or closed: 30 of 37 bare.
- M4. Sub-agents: 3 of 8 called it; the 5 that did not include two on Fable and one on Haiku.
- M5. The senior `2da14d6d` ("JH SR · the long-session grader's shell reading"), started with `"advisor": null` (record
  line 288), ran on Fable and still had a Fable advisor (from the setting) and called it 3 times: Fable reading
  Fable's transcript, the cost with no stronger reader. `odd/tasks/senior-orchestrator.md` says it runs with no
  advisor; it does not. `claude --help` (2.1.322) lists no advisor flag; `--advisor none` is unbuilt and untested
  (`odd/tasks/advisor-home.md:81`).
- Limits: the window is short and the lead's stretches are woken by side-session events more than by his messages, so
  "after his last message" is a loose anchor for it; "plan" counts every rewrite of a task document; the moment
  regexes were spot-checked on 5 samples each, not all.

## Proposal
P1. A hook, `js-harness advisor-gate --hook`, on PreToolUse for `AskUserQuestion`, `mcp__ccd_session__start_session`,
`ExitPlanMode` and the `Bash` calls that run `js-harness notify --kind question|ready`, `js-harness merge-queue --land`
(not a dry run) and `js-harness sessions start`. It reads the caller's transcript (`transcript_path`; a sub-agent's,
`subagents/agent-<agent_id>.jsonl` beside it) and refuses the act when the requests there carried the advisor tool
and no advisor call came since the last gated act or his last typed message. The refusal says what to do: call the
advisor, then repeat the act. It lets the act through, and records why, when the transcript cannot be read, when no
request shape is recorded, or when the session's own model is the advisor's (a senior). Each decision goes to a record
under the harness home, so the measurement above becomes a command (`js-harness advisor-gate report`) instead of a
script. Cost, from the measurement: refusing at each gated act would have forced about 63 more calls in 1.75 days
(lead 28, work 35), about 36 a day, at about 145,000 Fable input tokens each, about 5 million a day, an estimate; one
call per stretch between his messages would have forced 13 (about 7 a day). Recommended: one call covers every gated
act until his next message or the next session event, so the floor is one call per decision stretch.
P2. Sub-agents: the same hook covers their acts by `agent_id`; their end is a `SubagentStop` hook that blocks once
(the host's `stop_hook_active` stops a loop) when the sub-agent had the tool, ran more than a few calls, and made no
call. Cheaper alternative: only the writer and verifier kinds.
P3. Flag first: a week where the hook only records and adds a notice (no refusal), then the re-measure, then refusal.
His choice: refuse from the start, or flag first.
P4. The senior's missing pieces: (a) its advisor (M5): find a way to start it with none (probe `--advisor` with an
empty or `none` value on a throwaway session, one cheap call), else write in its design that it has one and why;
(b) `bin/lib/protocols-skill.mjs:43` and `bin/lib/codex-review-recheck.mjs:41` name `rule:session-model` as the
strongest model; since PR 852 the senior is: they say "pass the work to the senior (`rule:senior-model`)"; (c) the
orchestrator skill's "A senior" section, held as `lead-protocols-senior.diff` in JH 192's notes folder, lands with its
coverage entries (it still says "with no advisor", which (a) decides).
P5. One protocols line, beside the double review's: the gated moments and that the hook holds them (the line points
to the hook; the hook carries the why in its refusal).

## Tasks
- [ ] T1 (kind: verify) probe: a PreToolUse hook reads an advisor call made earlier in the same assistant turn (spec 2) — route: here — commit: none
- [ ] T2 (kind: design) double review of this document, then the question to him through the lead (specs 1-3) — route: here — commit: this document
- [ ] T3 (kind: build) after his yes: `bin/advisor-gate.mjs` and its test, the hook entry, the report (specs 1, 2) — route: here
- [ ] T4 (kind: build) after his yes: the senior's pieces P4 (spec 3) — route: here or the lead's JH 192 diff

## Log
- L1 (2026-11-13) His request, as written: S1, S2, S3 above; the lead's brief: `js-harness sessions --opening 'JH 196
  · every role consults the advisor when it should'`.
- L2 (2026-11-13) Advisor before writing: four fixes to the first measurement (dedupe by id, "had the tool" as the
  denominator, tighter moments, the lead's relieved titles as the lead); all taken. The first count of 6 lead calls
  matched; the grep's higher counts were the same id printed twice.
- L3 (2026-11-13) Found: the senior on Fable has the advisor (M5), and every session has it from his setting (M1).
