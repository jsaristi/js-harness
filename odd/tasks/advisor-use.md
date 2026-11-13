# advisor-use

Every role the harness runs (the lead, the work sessions, their sub-agents) consults the Fable advisor at the
moments that decide, checked by a hook rather than asked for in prose; a proposing question carries its double
review; and the senior gets its missing pieces. Session JH 196, opened by the lead "JH ORQ · orquestador F8".
Delivery: this proposal, through the double review and then the lead as a question; nothing is built before his yes.
Runner: `node --test`.

## State
Measured and proposed; the double review read a229de6b (Claude 16 findings, Codex 7) is answered in this version, all
taken (Log L4). Next: the confirming read of this version, then a `question` notice to the lead. T1 has run (M6): a
hook sees the call, and a call made in the same response as the act gets no result. Open: a way to start a senior
with no advisor (two tried, M5); his three choices (Ask me before).

## Goal
Each of the lead, the work sessions and the sub-agents that has the advisor and is not on the advisor's own model
consults it (a call with a result) before it asks him a question, lands, opens a session, writes a new task document,
leaves plan mode or says a piece is ready or closed, and a hook refuses or flags the act where it did not; a proposing
question to him names its double review.

## Why
His words (S1 to S3): he saw the lead decide without the advisor, asked that it be fixed for the sub-agents and the
sessions too, and does not see the senior session. The host's advisor prompt asks for calls "before substantive
work", but nothing in the harness names a moment to call it: `git grep -n -i advisor` over `bin/lib/*skill*.mjs`,
`bin/lib/lead-protocols.mjs`, `CLAUDE.md`, `AGENTS.md` and `.claude/agents` finds only the lead protocols' lines on
the advisor's model (`bin/lib/lead-protocols.mjs:18-21`), none on when to call it. The measurement shows most of these
acts go out with no call. The lead adds (its message of 2026-11-13, 18:2x local): its question 279 went to him with
no double review, which `rule:double-review` requires of a proposal (P6).

## Done when
- `js-harness contract check odd/tasks/advisor-use.md` exits 0
- `js-harness double-review tally --since 2026-11-13` lists the reads of this document with every finding answered
- `js-harness failures proposal-unreviewed` prints the sighting of question 279
- His answer to the proposal is recorded in the channel (`notify --kind answer`) before any `bin/` file of this
  feature changes
- After the build (if he says yes): `node --test bin/advisor-gate.test.mjs` exits 0, and `js-harness advisor-gate
  report` a week later shows the gated acts covered, with the share decided unchecked (fail open) under 5%

## In scope / Out of scope
- In: this document; `docs/FAILURES.md` (one Seen line); the measurement script and its output in the lead's notes
  folder; after his yes, a hook command under `bin/`, its test, its install entry, `notify`'s question check, and the
  protocols line that names the hook.
- Out: `~/.claude/settings.json` (his `advisorModel`, line 281, stays his); the advisor's own level (the CLI has none,
  `odd/tasks/advisor-home.md`); the model rules themselves, except through `rules change` with his words (P4b). The
  lead's "avísame cuando pueda reiniciar" (S2's first half) is the lead's to answer, not this feature's.

## Constraints
- Cost — because his line 3271 of 812b728f asks that usage be saved: an advisor call forwards the whole transcript
  uncached and blocks the turn; measured here at about 208,000 Fable input tokens a lead call, 146,000 a work-session
  call and 81,000 a sub-agent call (M7). So the gate covers few acts, and one call covers a stretch (P1).
- Fail open, and say so — because a hook that cannot read a transcript must not stop the work: it lets the call
  through and records it, as the template gate does (`bin/template.mjs:236`); the report shows that share (Done when).
- No refusal without the tool, and a bounded outage — because a session the host gave no advisor, or whose advisor
  fails, would otherwise be refused forever (P1).

## Ask me before
(1) The proposal as a whole: a hook every session meets. (2) Refuse from the start, or a week of flags first (P3).
(3) Whether callers on Fable, the advisor's own model, are exempt (P1; today two work sessions and two sub-agents).
(4) P4b, P6 and P4a's fallback, each named there.

## Depth pass
- 1. Method: a control that runs at the act, not a line asking for it: the template gate refuses an `AskUserQuestion`
  whose question was not recorded first (`bin/template.mjs:289`); the same PreToolUse shape reads the caller's
  transcript and refuses an act with no advisor call before it. Searched: `js-harness rules` (advisor-model and
  senior-model name the model, nothing the use); the skills, `bin/lib/lead-protocols.mjs`, `CLAUDE.md`, `AGENTS.md`,
  `.claude/agents` (above); codegraph for the template gate and the guard. Weighed and set aside: a protocols line
  alone (with the tool on since 2026-11-12, the relieved lead made 3 calls in 594 tool calls, and the host's prompt
  already asks); a Stop hook on every reply (it gates every turn, the cost above).
- 2. Raw material: the transcripts under `~/.claude/projects/D--js-harness*` begun since 2026-11-12, read by
  `jh196-advisor-measure.mjs` in the lead's notes folder, its output frozen beside it
  (`jh196-advisor-measure-output.txt`, every figure below is from it); the tool list each request carried, in the
  `api-request-shape` lines (type `advisor_20260301`, model `claude-fable-5-2`); `~/.claude/settings.json:281`
  (`advisorModel`); the background record `~/.js-harness/background/sessions.jsonl:288` and `:290` (the two seniors,
  each started with `"advisor": null`); the template gate, `bin/template.mjs:289`; the T1 probe's record,
  `jh196-t1-probe-hook-seen.txt`; his words at lines 662, 757 and 771 of 69918425; question 279 at line 354 of 69918425.
- 3. The bar:
  spec 1: `node jh196-advisor-measure.mjs 2026-11-12T00:00:00Z`: lead questions covered 4 of 20, sessions opened 3 of 9; work sessions on Opus ready or closed 11 of 32; sub-agents on Opus 3 of 6 ends (policy R). Target: every gated act covered, exempt or recorded unchecked.
  spec 2: `node --test bin/advisor-gate.test.mjs`: none, new behaviour (no hook reads the advisor today).
  spec 3: `git grep -n "strongest model the rules name" bin/lib`: `bin/lib/protocols-skill.mjs:43`, `bin/lib/codex-review-recheck.mjs:21,41` and their tests (`protocols-skill.test.mjs:146`, `codex-review-recheck.test.mjs:218,224,234`) send the hardest work to `rule:session-model`, not the senior.
- 4. Refutation: the request would not hold if the roles already called the advisor at these acts, or did not have
  the tool. Run: `node jh196-advisor-measure.mjs 2026-11-12T00:00:00Z --rows`. Result: every transcript in the window
  with a recorded request had the tool, and 16 of the lead's 20 questions went with no call in their stretch.
  Verdict: supports
- 5. Request: "Measure advisor use by role at the acts that decide; propose a hook that refuses or flags those acts
  when no advisor call came before them, with its cost; make a proposing question carry its double review; and say
  what the senior still lacks, including why he does not see it."
  Adds: none

## Specs
1. "Trata de utilizar mas Fable como Advisor ya que estas tomando decisiones y no lo has utilizado ni una sola vez"
   (69918425, line 662, 2026-11-13).
2. "avísame cuando pueda reiniciar, pero por favor soluciona ese problema de no utilizar el advisor y debemos tambien
   tener ese mismo problema con las sub agente y sesiones" (69918425, line 757, 2026-11-13).
3. "y tambien no veo la sesion orquestadora senior que va a tener el fable para cosas de suma importancia o que
   necesiten mas potencia" (69918425, line 771, 2026-11-13).

## Measurement
Window: transcripts begun 2026-11-12 00:00Z to 2026-11-13 about 18:20Z (1.76 days). Read oldest first; each tool call
and each advisor call counted once across all files (resumes copy history). An advisor call counts only with a result
(`advisor_tool_result`); 2 calls had none. His messages: a typed `user` entry, or an `attachment` of type
`queued_command` with origin human (what he sends while a session works). Session events: side-sessions events, task
notifications, cross-session messages. Acts: a question (`notify --kind question`; an `AskUserQuestion` only when no
notify question came in the same stretch, since it asks the same one), a land (`merge-queue --land`, not a dry run), a
session opened (`start_session`, `sessions start`), a plan (`ExitPlanMode`, or the first Write of an `odd/tasks/*.md`
in that transcript), done (`notify --kind ready|closed`; a sub-agent's end). `js-harness` and `js-harness.mjs` both
match. Policy R: one call covers every act until his next message or the next session event. Policy E: each act needs
a call since the last act or his message.

| Caller | Transcripts (called at all) | Advisor calls / tool calls | Acts covered, policy R | A gate adds, R / E |
|---|---|---|---|---|
| lead, Opus | 2 (2) | 9 / 759 | question 4/20, session 3/9, land 1/1, done 1/2 | 10 / 28 |
| work, Opus | 10 (9) | 13 / 1,918 | done 11/32, plan 4/5, session 1/4, question 2/2 | 16 / 31 |
| sub-agent, Opus | 6 (3) | 4 / 131 | end 3/6 | 3 / 3 |
| work, Fable | 2 (0) | 0 / 110 | done 0/6 | 6 / 6 |
| sub-agent, Fable | 2 (0) | 0 / 170 | end 0/2 | 2 / 2 |
| senior, Fable | 2 (1) | 3 / 124 | done 0/3 | exempt |

- M1. Every transcript in the window whose requests are recorded carried the advisor tool, from his setting
  `~/.claude/settings.json:281`, sub-agents included (Opus, Fable and one Haiku). This is what the sample shows, not a
  promise for every future request, so the hook reads the tool list of the caller's own latest request.
- M2. The lead: the brief's "0 until he said so" holds for the lead begun 2026-11-10 (0 calls; the tool was not on
  then). The relieved lead made 3 calls in 594 tool calls; the current one 6 in 165, most after line 662. Its questions
  are the largest gap: 16 of 20 went with no call in their stretch.
- M3. Work sessions call it early (plans 4 of 5) and seldom before ready or closed (11 of 32).
- M4. Sub-agents on Opus: 3 of 6 called it. The two on Fable did not; a Fable caller's advisor is its own model.
- M5. The senior has the advisor. Evidence, checkable: `grep -c '"type":"advisor_20260301"'` over
  `~/.claude/projects/D--js-harness--claude-worktrees-rule-lead-effort-split-aac740/2da14d6d-2893-443b-8470-b15d04f7eaa6.jsonl`
  gives 1 (its `api-request-shape` line, model `claude-fable-5-2`); its `server_tool_use` advisor ids with a result: 3;
  its assistant entries: all `claude-fable-5-2`. The standing senior 9358a4b4
  (`~/.claude/projects/D--js-harness/9358a4b4-cdbe-47d7-88ad-f16d185f1031.jsonl`) carries the same tool line, and has
  made no call yet. Both records hold `"advisor": null` (`sessions.jsonl:288`, `:290`): that field says what `sessions
  start` passed, not what the host gave; the tool comes from his `advisorModel` setting. What this contradicts:
  `odd/tasks/senior-orchestrator.md:20` (Goal, "with no advisor") and the code texts `bin/lib/model-home.mjs:66`,
  `bin/lib/session-title-guard.mjs:16`, `bin/lib/guard.test.mjs:326`; that document's State already held the claim
  until a transcript showed it. Tried to turn it off, one run each on Fable at low: `claude -p --settings` with
  `{"advisorModel":""}` still carried the tool; `--advisor none` is refused ("The model \"none\" cannot be used as an
  advisor"). `claude --help` (2.1.322) lists no advisor flag.
- M6. T1, run once (`claude -p` on Opus with a PreToolUse hook on Bash, prompt: call the advisor, then run `echo` in
  the same response; record `jh196-t1-probe-hook-seen.txt`): the hook saw each `server_tool_use` advisor block before
  the Bash call it preceded (counts 1, 2, 3), so the hook can read it. But none of the three got a result: in the same
  response as a client tool call the advisor was not consulted, and the model said so. The 2 result-less calls of the
  window are of the same kind. So the hook counts only a call with a result, and its refusal says: call the advisor
  alone, read its answer, then act.
- M7. Cost a call, from the `advisor_message` usage entries: lead 207,726 input tokens (9 calls), senior 214,301 (3),
  work 145,603 (13), sub-agent 80,791 (4). It grows with the transcript.
- M8. Why he does not see the senior (S3): the first senior 2da14d6d lived from 08:18Z to 09:21Z and was removed
  (`sessions.jsonl:288`, `:289`); when he wrote line 771 at 16:47Z none was live; the lead started 9358a4b4 at 17:57Z.
  A senior started by `sessions start` is a background session: the desktop app's sidebar does not list it unless the
  app attaches it.
- Limits: 1.76 days; the plan act counts the first write of each task document, a rewrite is not counted; moments
  were spot-checked on 5 samples each; the lead's question 279 is in the window.

## Proposal
P1. A hook, `js-harness advisor-gate --hook`, on PreToolUse for `mcp__ccd_session__start_session`, `ExitPlanMode`,
`Write` (the first write of an `odd/tasks/*.md`) and the `Bash` calls whose command runs `js-harness` or `js-harness.mjs`
with `notify --kind question|ready|closed`, `merge-queue --land` (not a dry run) or `sessions start`, matched by the
words of the command wherever `js-harness` appears, with tests for `node bin/js-harness.mjs notify ...`, an env prefix
and a `gate --` wrapper. `AskUserQuestion` is not gated: the template gate already requires its `notify --kind
question` first, and that notify is the act. The hook reads the caller's transcript: `transcript_path`, or for a
sub-agent `<dirname(transcript_path)>/<session_id>/subagents/agent-<agent_id>.jsonl` (the convention of
`bin/lib/board-files.mjs:69`), with tests for both. It refuses the act when the caller's latest request carried the
advisor tool and no advisor call with a result came since his last message or the last session event (policy R);
the refusal says to call the advisor alone, read its answer, then repeat the act. It lets the act through and
records why: the transcript or its tool list cannot be read; the caller is the senior (by role, `seniorTitle`); an
advisor call since the anchor got an error or no result twice (an outage: recorded, never counted as a
consultation). Choice (3): exempt callers whose model is the advisor's (Fable work sessions and sub-agents), or not.
Each decision goes to a record under the harness home; `js-harness advisor-gate report` prints coverage by role and
the share let through unchecked, and warns above 5%, so a host change that stops writing the tool list is seen.
Cost, policy R, Opus callers, from the window: 29 more calls in 1.76 days (lead 10, work 16, sub-agents 3), about 16 a
day, about 2.6 million Fable input tokens a day at the M7 sizes, an estimate; Fable callers if not exempt, 8 more.
Policy E would add 62 calls, about 6.0 million a day. Recommended: R.
P2. Sub-agents: the same hook covers their acts by `agent_id`; their end is a `SubagentStop` hook that blocks once
(the host's `stop_hook_active` stops a loop) when the sub-agent had the tool and made no call with a result in its
run. Its cost is in P1's "sub-agents 3". Cheaper alternative: only the writer and verifier kinds.
P3. Choice (2): flag first (a week where the hook records and adds a notice, no refusal, then `advisor-gate report`,
then refusal), or refuse from the start. Recommended: flag first, since T1 shows a refusal loop is easy to hit.
P4. The senior's missing pieces. (a) Its advisor (M5): no way found to start a session with none; the fallback, his
choice, is to accept it and write in the senior's design and code texts that the senior has a Fable advisor (cost
M7, 214,301 tokens a call), or to ask the host for a way (an `advisorModel` override that works per process). (b)
`bin/lib/protocols-skill.mjs:43` and `bin/lib/codex-review-recheck.mjs:21,41` send work that three reviews did not
settle to `rule:session-model` as the strongest model; escalation was his rule `escalation-model`, retired on
2026-11-11 with `session-model` as its successor (`bin/lib/rules-data.mjs:233-246`). Pointing it at the senior is a rule
change: a `rules change` on a `rule/` branch with his words, which this proposal asks him for; its tests change with it
(spec 3). (c) The orchestrator skill's "A senior" section, held as `lead-protocols-senior.diff` in JH 192's notes
folder, lands with its coverage entries, with "no advisor" corrected per (a). (d) He sees the senior: the lead keeps one
live while a task needs it (`odd/tasks/senior-orchestrator.md` D3), says when it removes one and why, and `sessions
start` for a senior asks the app to list it (or the lead's status line names it), so "no veo" is answered by a place
to look.
P5. One protocols line, beside the double review's: the gated acts and that the hook holds them (the hook's refusal
carries the why).
P6. A proposing question carries its double review: `notify --kind question` takes an optional key `"review": "<read
id>"` naming a `double-review read` of the text it proposes, or `"fact": true` for a question of fact; with neither,
`notify` refuses it, and with a read id that does not exist in `.git/js-harness/double-reviews.jsonl`, too. A new
required key changes what `notify --kind question` accepts (high risk, item 3): his to approve. The sighting is in
`docs/FAILURES.md`, `proposal-unreviewed` (the Log's L5 has the five parts).

## Tasks
- [x] T1 (kind: verify) probe: a PreToolUse hook reads an advisor call made in the same turn (spec 2) — route: here — commit: this document, M6
- [ ] T2 (kind: design) confirming read of this version, then the question to him through the lead (specs 1-3) — route: here — commit: this document
- [ ] T3 (kind: build) after his yes: `bin/advisor-gate.mjs`, its test with a queued-message fixture, the hook entries, the report (specs 1, 2) — route: here
- [ ] T4 (kind: build) after his yes: P6 in `bin/notify.mjs` and its test (spec 2) — route: here
- [ ] T5 (kind: build) after his yes: the senior's pieces P4 (spec 3) — route: here, or the lead's JH 192 diff

## Log
- L1 (2026-11-13) His request, as written: S1, S2, S3 above; the lead's brief: `js-harness sessions --opening 'JH 196
  · every role consults the advisor when it should'`.
- L2 (2026-11-13) Advisor before writing: four fixes to the first measurement (dedupe by id, "had the tool" as the
  denominator, tighter moments, the relieved lead's titles as the lead); all taken.
- L3 (2026-11-13) The lead's message after the read began: (1) its question 279 went without a double review, so the
  control should catch a proposing question with none, and a Seen line goes in this PR; (2) name the senior transcript
  read and how the advisor was seen. Both taken: P6, L5, M5.
- L4 (2026-11-13) Double review read a229de6b: Claude 16 findings, Codex 7, all taken. Figures from one frozen output
  (C1, X6); his queued messages as anchors (C2); T1 run before asking (C3, M6); the recommended policy measured with
  session events (C4, X1); the Fable callers apart and the cost by role (C5, M7); the gated acts and the measured ones
  the same (C6, X2); `js-harness.mjs` matched (C7); P4b as a rule change for him (C8); S3's "no veo" answered (C9, M8,
  P4d); one global dedupe, oldest first (C10); the notify question and its `AskUserQuestion` as one act (C11); M5's
  citations and the settings probe (C12); the 1,295 calls out of the argument (C13); the lead protocols searched (C14);
  the sub-agent path (C15, X3); fail-open share in the report and P2's cost (C16); an outage path (X4); the senior
  exempt by role and the Fable callers his choice (X5); the restart notice named as the lead's (X7).
- L5 (2026-11-13) A mistake, the lead's, in five parts. What happened: question 279 ("cómo abre el orquestador las
  sesiones de trabajo...", a change to the orchestrator skill, 69918425 line 354, 16:15:02Z) reached him with no double
  review; `.git/js-harness/double-reviews.jsonl` holds no read between 01:45Z and 18:12Z. The fix now: none possible for
  279, answered at 16:16; recorded as a sighting. What stops it: P6, `notify` refuses a question with neither a read id
  nor `"fact": true`. Where and when: `bin/notify.mjs`, T4, after his yes. The count that proves it: `js-harness
  failures proposal-unreviewed` shows no sighting after T4 lands, and every `question` notice after it carries `review`
  or `fact`.
