# advisor-use

Every role the harness runs (the lead, the work sessions, their sub-agents) consults the Fable advisor before the
acts that decide, checked by a hook rather than asked for in prose; a proposing question carries its double review;
and the senior gets its missing pieces. Session JH 196, opened by the lead "JH ORQ · orquestador F8". Delivery: this
proposal, through the double review and then the lead as a question; nothing is built before his yes. Runner:
`node --test`.

## State
2026-11-14 08:15Z: slice 1 committed (1de6ed65: hook, tests, entries, HOOK_ENTRY_LIMIT 15 -> 17, the notice as a cut text source in bin/lib/advisor-gate.mjs, its record in RECORDS and SPEC, README section); main 236f720 merged in (af986f03); the lead told. Codex review running (codex-review --base cc546781, 3 parts); next the lenses (lens-review --base cc546781), then push and PR, then slice 2: `advisor-gate report` (decisions by day and act; added Fable tokens a day, the advisor_message input tokens of calls following a flag in its stretch, against 2.4M, labelled as calls the warnings prompted). Choices under the yes in L9; P4a moved to JH 198 (L10). Closing steps before ready (auto-archive on PR close); ready with --pr.

## Goal
Each of the lead, the work sessions and the sub-agents that has the advisor consults it (a call with a result, made
in a response of its own) before it asks him a question, lands, opens a session, creates a task document, leaves plan
mode or says a piece is ready or closed, within a bounded stretch (P1); a hook refuses or flags the act where it did
not, and says so in a report checked against the acts themselves; a proposing question to him names the reviewed
text and its double review.

## Why
His words (S1 to S3): he saw the lead decide without the advisor, asked that it be fixed for the sub-agents and the
sessions too, and does not see the senior session. His line 3271 of 812b728f (2026-11-12) sets the frame: "necesito
que me pases todo lo que puedas a Opus como habiamos quedado con el advisor de Fable por que o sino nos vamos a comer
todo el uso": Opus with the Fable advisor, to save usage. The host's advisor prompt asks for calls "before substantive
work", but nothing in the harness names a moment to call it: `git grep -n -i advisor` over `bin/lib/*skill*.mjs`,
`bin/lib/lead-protocols.mjs`, `CLAUDE.md`, `AGENTS.md` and `.claude/agents` finds only the lead protocols' lines on the
advisor's model (`bin/lib/lead-protocols.mjs:18-21`). The lead adds (L3): its question 279 reached him with no double
review (P6).

## Done when
- `js-harness contract check odd/tasks/advisor-use.md` exits 0
- In `.git/js-harness/double-reviews.jsonl`, the `take` lines of each read whose `files` hold
  `odd/tasks/advisor-use.md` cover every finding of that read
- `js-harness failures proposal-unreviewed` prints the sighting of question 279
- His answer to the proposal is recorded in the channel (`notify --kind answer`) before any `bin/` file of this
  feature changes
- After the build (if he says yes): `node --test bin/advisor-gate.test.mjs` exits 0; a week later `js-harness
  advisor-gate report` reconciles the hook's decisions with the acts found in the transcripts, and the acts with no
  decision and those let through unchecked are each under 5%
- He sees a live senior: the board or the lead's status line names it while one is live (P4d)

## In scope / Out of scope
- In: this document; `docs/FAILURES.md` (one Seen line); the measurement script, its output and the probes' records
  in the lead's notes folder; after his yes, a hook command under `bin/`, its test, its hook entries (written into the
  host's settings as `install` writes every hook, recorded for `uninstall`), the question check in
  `bin/lib/channel.mjs`, and the protocols line that names the hook.
- Out: his `advisorModel` key in `~/.claude/settings.json:281`; the advisor's own level (the CLI has none,
  `odd/tasks/advisor-home.md`); the model rules, except through `rules change` with his words (P4b). The lead's
  "avísame cuando pueda reiniciar" (S2's first half) is the lead's to answer.

## Constraints
- Cost — because of his line 3271 above: an advisor call forwards the whole transcript and blocks the turn; measured at
  about 216,000 Fable input tokens a lead call, 154,000 a work-session call and 81,000 a sub-agent call (M7). So the
  gate covers few acts, and one call covers a bounded stretch (P1).
- Fail open, and say so — because a hook that cannot read a transcript must not stop the work: it lets the call
  through and records it, as the template gate does (`bin/template.mjs:236`); the report shows that share.
- No refusal without the tool, and a bounded outage — because a session the host gave no advisor, or whose advisor
  fails, would otherwise be refused forever (P1).

## Ask me before
(1) The proposal as a whole: a hook every session meets. (2) Refuse from the start, or a week of flags first (P3), with policy R (one call covers 60 tool calls of acts).
(3) Whether callers on Fable, the advisor's own model, are gated (P1; in the window two work sessions and two
sub-agents). (4) P4b, a rule change. (5) P6, a stricter question check. (6) P4a's fallback and P4d's start.

## Depth pass
- 1. Method: a control that runs at the act, not a line asking for it: the template gate refuses an `AskUserQuestion`
  whose question was not recorded first (`bin/template.mjs:289`); the same PreToolUse shape reads the caller's
  transcript and refuses an act with no advisor call before it. Searched: `js-harness rules` (advisor-model and
  senior-model name the model, nothing the use); the skills, `bin/lib/lead-protocols.mjs`, `CLAUDE.md`, `AGENTS.md`,
  `.claude/agents` (above); codegraph for the template gate and the guard. Weighed and set aside: a protocols line
  alone (with the tool on since 2026-11-12, the relieved lead made 3 calls in 594 tool calls, and the host's prompt
  already asks); a Stop hook on every reply (it gates every turn, the cost above).
- 2. Raw material: the transcripts under `~/.claude/projects/D--js-harness*` begun since 2026-11-12, read by
  `odd/tasks/advisor-use-evidence/measure-script.md`, its output frozen beside it (`measure-output.md`, every figure
  below is from it); the tool list in the `api-request-shape` lines
  (type `advisor_20260301`, model `claude-fable-5-2`); `~/.claude/settings.json:281`; the background record
  `~/.js-harness/background/sessions.jsonl:288` to `:290`; the template gate, `bin/template.mjs:289`; the probes'
  records `probe1-hook-seen.md`, `probe2-retry-seen.md` and `probe3-subagentstop-seen.md` in the same folder; his words at lines 662, 757 and 771 of
  69918425; question 279 at line 354 of 69918425.
- 3. The bar:
  spec 1: `node jh196-advisor-measure.mjs 2026-11-12T00:00:00Z`: lead questions covered 6 of 20 and sessions opened 3 of 9 (policy R); work sessions on Opus ready or closed 15 of 35 under R, 7 under E; sub-agents on Opus 3 of 5 ends. Target: every gated act covered, exempt, or recorded unchecked.
  spec 2: `node --test bin/advisor-gate.test.mjs`: none, new behaviour (no hook reads the advisor today).
  spec 3: `git grep -n "strongest model the rules name" bin/lib`: `bin/lib/protocols-skill.mjs:43`, `bin/lib/codex-review-recheck.mjs:21,41`, `bin/lib/protocols-skill.test.mjs:146` and `bin/lib/codex-review-recheck.test.mjs:224,234` send the hardest work to `rule:session-model`, Opus, while his `senior-model` names Fable for it.
- 4. Refutation: the request would not hold if the roles already called the advisor before these acts, or did not
  have the tool. Run: `node jh196-advisor-measure.mjs 2026-11-12T00:00:00Z --rows`. Result: its "tool offered" column
  is yes for all 24 transcripts of the window (none without a shape line), and 14 of the lead's 20 questions went with
  no call in their stretch.
  Verdict: supports
- 5. Request: "Measure advisor use by role before the acts that decide; propose a hook that refuses or flags those
  acts when no advisor call came before them, with its cost; and say what the senior still lacks, including why he
  does not see it."
  P6 (the lead's addition, L3) and P4b, P4c (named by the lead's brief) are outside this request; each is asked of
  him on its own (Ask me before).
  Adds: none

## Specs
1. "Trata de utilizar mas Fable como Advisor ya que estas tomando decisiones y no lo has utilizado ni una sola vez"
   (69918425, line 662, 2026-11-13).
2. "avísame cuando pueda reiniciar, pero por favor soluciona ese problema de no utilizar el advisor y debemos tambien
   tener ese mismo problema con las sub agente y sesiones" (69918425, line 757, 2026-11-13).
3. "y tambien no veo la sesion orquestadora senior que va a tener el fable para cosas de suma importancia o que
   necesiten mas potencia" (69918425, line 771, 2026-11-13).

## Measurement
Window: transcripts begun 2026-11-12 00:00Z to 2026-11-13 about 18:55Z (1.79 days). Read oldest first; each tool call
and each advisor call counted once across all files (resumes copy history). An advisor call counts only with a result
(`advisor_tool_result`); 2 calls had none. His messages: a typed `user` entry, or an `attachment` of type
`queued_command` with origin human. Session events: side-sessions events and cross-session messages (news from
another session); a session's own task notifications are not. Acts: a question (`notify --kind question`; an
`AskUserQuestion` counted only when no notify question came in its stretch), a land (`merge-queue --land`, not a dry
run), a session opened (`start_session`, `sessions start`), a plan (`ExitPlanMode`, or the first Write of an
`odd/tasks/*.md` in that transcript), done (`notify --kind ready|closed`; a sub-agent's end). `js-harness` and
`js-harness.mjs` both match. Policy R: one call covers the acts after it until his next message, the next session
event, or 60 tool calls. Policy E: each act needs a call since the last act or his message. A forced call is priced
at the size of the request before the act it covers.

| Caller | Transcripts (called at all) | Advisor calls / tool calls | Acts covered, R (E) | A gate adds, R / E |
|---|---|---|---|---|
| lead, Opus | 2 (2) | 10 / 772 | question 6 (2)/20, session 3 (0)/9, land 2/2, done 1/2 | 8 / 28 |
| work, Opus | 10 (9) | 14 / 2,043 | done 15 (7)/35, plan 4 (3)/5, session 2/4, question 3 (2)/4 | 13 / 34 |
| sub-agent, Opus | 5 (3) | 4 / 117 | end 3/5 | 2 / 2 |
| sub-agent, Haiku | 1 (0) | 0 / 14 | end 0/1 | 1 / 1 |
| work, Fable | 2 (0) | 0 / 110 | done 0/6 | 4 / 6 |
| sub-agent, Fable | 2 (0) | 0 / 170 | end 0/2 | 2 / 2 |
| senior, Fable | 2 (1) | 3 / 124 | done 3 (1)/3 | exempt |

- M1. All 24 transcripts of the window carry the advisor tool in a recorded request, from his setting
  `~/.claude/settings.json:281`, sub-agents included. A shape line is written rarely (one in the senior's 122 tool
  calls), while every assistant entry carries `advisorModel` (`odd/tasks/advisor-home.md:102`, read by
  `bin/lib/home-sessions.mjs:19`): the hook decides "had the advisor" from the `advisorModel` of the caller's last
  assistant entry when it differs from that entry's own model; equality decides nothing (JH 172 `483dbb12`, on Fable, carries the
  tool in its shape lines though `odd/tasks/advisor-home.md:103` lists it as "no advisor"), so it reads the latest
  shape line instead, and with no shape line it lets the act through recorded unchecked.
- M2. The lead: the brief's "0 until he said so" holds for the lead begun 2026-11-10 (0 calls, before the tool was on).
  The relieved lead made 3 calls in 594 tool calls; the current one 7, all after his line 660 (S1's first record),
  so his "ni una sola vez" was true of the lead he spoke to. Its questions are the
  largest gap: 14 of 20 went with no call in their stretch. It stored 6 briefs (`notify --opening`) and sent 26 `SendMessage` calls in the window. A brief is followed by
  the gated `sessions start` of its session, in the same stretch; the messages, not sampled, are left out of the gate,
  a gap the report counts (P1).
- M3. Work sessions call it early (plans 4 of 5) and seldom before ready or closed (15 of 35 under R, 7 under E).
- M4. Sub-agents on Opus: 3 of 5 called it; the Haiku one and the two on Fable did not.
- M5. The senior has the advisor. Evidence: `grep -c '"type":"advisor_20260301"'` over
  `~/.claude/projects/D--js-harness--claude-worktrees-rule-lead-effort-split-aac740/2da14d6d-2893-443b-8470-b15d04f7eaa6.jsonl`
  gives 1 (its shape line, model `claude-fable-5-2`), with 3 advisor calls with a result, every assistant entry on
  `claude-fable-5-2`; the standing senior 9358a4b4 (`~/.claude/projects/D--js-harness/9358a4b4-cdbe-47d7-88ad-f16d185f1031.jsonl`)
  carries the same line and has made no call. Both records hold `"advisor": null` (`sessions.jsonl:288`, `:290`):
  what `sessions start` passed, not what the host gave. What rests on "a senior has no advisor" (`git grep -n "no
  advisor" bin odd/tasks/senior-orchestrator.md`): behaviour, `bin/lib/guard.mjs:109-115` (refuses an advisor named for
  a senior), `bin/sessions-background.mjs:218,406` (passes none), `bin/lib/home-sessions.mjs:51,74` (does not judge a
  senior's advisor), `bin/guard.mjs:168` (refuses `start_session` for a senior, giving "no advisor" as the reason);
  `bin/lib/guard.mjs:117` (skips the advisor check for a senior); text and tests, `bin/lib/model-home.mjs:66`,
  `bin/lib/session-title-guard.mjs:16`, `bin/lib/guard.test.mjs:326-334`, `bin/lib/home-sessions.test.mjs:150,162`,
  `bin/lib/model-home.test.mjs:110`, `bin/lib/rules-coverage-data.mjs:8`, `bin/sessions-background.test.mjs:810`,
  `odd/tasks/senior-orchestrator.md:20,59,113` (113 reads "No advisor"; `git grep -n -i`). Tried to turn it off, one run
  each on Fable at low: `claude -p --settings` with `{"advisorModel":""}` still carried the tool; `--advisor none` is
  refused ("The model \"none\" cannot be used as an advisor"). `claude --help` (2.1.322) lists no advisor flag.
- M6. The probes. First (`probe1-hook-seen.md`): a PreToolUse hook on Bash saw each advisor block before the
  call it preceded, but an advisor call made in the same response as the Bash call got no result, three times, and
  the model said it had not consulted it. Second (`probe2-retry-seen.md`): a hook that refuses until the
  transcript holds an advisor result: in the main session and inside an `Agent` sub-agent, the first try was refused,
  the model called the advisor alone, and the retry's hook saw the result (0, then 1) and let it through. The
  sub-agent's payload carries `agent_id` and `agent_type`, and its transcript resolves at
  `<dirname(transcript_path)>/<session_id>/subagents/agent-<agent_id>.jsonl`. Third (`probe3-subagentstop-seen.md`): a `SubagentStop` hook that blocks once: the sub-agent called the advisor
  (1 result in its transcript), stopped again with `stop_hook_active: true`, and the payload carries
  `agent_transcript_path` and `last_assistant_message`.
- M7. Size of a call, from the `advisor_message` usage entries, all uncached (every one of the 189 entries on this
  machine shows `cache_read_input_tokens: 0`), so each is full-price Fable input: lead 215,544 tokens (10 calls), senior 214,301 (3), work 153,525 (14), sub-agent 80,791
  (4).
- M8. Why he does not see the senior (S3): the first senior 2da14d6d lived from 08:18Z to 09:21Z and was removed
  (`sessions.jsonl:288`, `:289`), against D3's "long-lived" (`odd/tasks/senior-orchestrator.md:116`); at his line 771
  (16:47Z) none was live; the lead started 9358a4b4 at 17:57Z. Every senior is a background session because
  `bin/guard.mjs:168` refuses `start_session` for one, and the reason it gives ("no advisor") is void after M5; a
  background session is not in the app's sidebar, though both seniors ran with `"remoteControl": true`.
- Limits: 1.79 days; the 6 briefs and 26 messages counted, not gated; a rewrite of a task document is not counted; moments spot-checked on 5 samples each.

## Proposal
P1. A hook, `js-harness advisor-gate --hook`, on PreToolUse for `AskUserQuestion`, `mcp__ccd_session__start_session`,
`ExitPlanMode`, `Write` creating a new `odd/tasks/*.md`, and the `Bash` calls whose command runs
`js-harness` or `js-harness.mjs` with `notify --kind question|ready|closed`, `merge-queue --land` (not a dry run) or
`sessions start`, matched wherever `js-harness` appears, with tests for `node bin/js-harness.mjs notify ...`, an env
prefix and a `gate --` wrapper. A task document created by a shell command is not gated: the report finds every new task
document from `git log --diff-filter=A -- odd/tasks` on the session's branch, so a creation with no hook decision (by
shell, or a second one the hook missed) is counted as an escape. `SendMessage` is left out (26 in the window, not sampled): the report counts them, so the gap is seen. A caller on
Haiku is gated like one on Opus. The hook reads the caller's transcript
(`transcript_path`, or the sub-agent's path of M6). It refuses the act when the caller had the advisor (M1) and no
advisor call with a result came in the stretch: since his last message (typed or queued), the last session event, and
within the last 60 tool calls (policy R). An `AskUserQuestion` reuses its `notify` question's consultation while the
stretch holds, and is checked again when the stretch was broken between them. The refusal says: call the advisor
alone, in a response of its own, read its answer, then repeat the act (M6). It lets the act through, and records why:
the transcript cannot be read; the caller is the senior: its title, looked up from the payload's `session_id` in
`~/.js-harness/background/sessions.jsonl` (the latest `started` with no later `removed`) or the app's record, read by
`seniorTitle`; an unknown title is not exempt, and the senior's own sub-agents fall under choice (3); an outage, meaning two advisor calls
made alone in the stretch came back with an error. A call made beside a tool call (no result) is not an outage: the
refusal repeats its instruction. Choice (3): gate callers whose model is the advisor's, or not. Each decision goes to a
record under the harness home; `js-harness advisor-gate report` reconciles it with the acts found by scanning the
transcripts (the measurement's reading, moved into `bin/`), so an act with no decision (a hook missing or a command
unmatched) is counted, and `doctor` says whether the hook entries are installed. Cost, from the window, Opus and Haiku
callers, senior exempt, a forced call counted again each time a stretch passes 60 tool calls: policy R adds 24 calls in
1.79 days (lead 8, work 13, sub-agents 3), about 13 a day, about 2.4 million Fable input tokens a day priced at each
act's request size, an estimate; policy E would add 65, about 7.0 million a day; Fable callers if gated, R adds 6 more
(about 1.0 million). Under R, one call covers every gated act for up to 60 tool calls until news arrives: a session
can plan, consult once and send ready 50 calls later on that one call. Recommended: R.
P2. Sub-agents: the same hook covers their acts by `agent_id`; their end is a `SubagentStop` hook that blocks once when
the sub-agent had the tool and no call with a result in its stretch, computed exactly as P1's policy R (M6's third
probe shows the block, the call and the second stop); at a second stop (`stop_hook_active`) it records the end covered
when a fresh call is there, and otherwise lets it through recorded unchecked, named by the lead's next `wait`. Its
cost is in P1's "sub-agents 3" (Opus 2, Haiku 1). Cheaper
alternative: only the writer and verifier kinds.
P3. Choice (2): flag first (a week where the hook records and adds a notice, then the report, then refusal), or refuse
from the start. Recommended: flag first.
P4. The senior's missing pieces. (a) Its advisor (M5): no way found to start a session with none. Fallback, his choice:
accept it, and change the behaviour and texts M5 lists to say the senior runs with the Fable advisor his setting gives
(cost M7), or ask the host for a per-process override. (b) The escalation text is false today: "the strongest model
the rules name (rule:session-model)" names Opus, while his `senior-model` names Fable for the hardest work
(`bin/lib/rules-data.mjs:648-653`). Escalation was his rule `escalation-model`, retired on 2026-11-11 with
`session-model` as successor (`bin/lib/rules-data.mjs:233-246`): pointing it at the senior is a `rules change` on a
`rule/` branch with his words, which this proposal asks him for; spec 3's lines change with it. (c) The orchestrator
skill's "A senior" section, held as `lead-protocols-senior.diff` in JH 192's notes folder, lands with its coverage
entries, corrected per (a). (d) He sees the senior: the board and the lead's status line name the live senior, and the lead keeps it live per D3
and says when and why it ends one. Starting it by `start_session` so it opens in the sidebar is not offered: the
guard has a second reason (`bin/guard.mjs:165-171`, a start there is held to the home's model), the tool is capped at
its caller's model (`bin/lib/guard.mjs:128-150`), his `senior-model` subject names `sessions start` as the starter, and
no probe shows an Opus lead opening a Fable session that way; it would need that probe and a rules change.
P5. One protocols line, beside the double review's: the gated acts and that the hook holds them.
P6. A proposing question carries its double review. In `checkedQuestion` (`bin/lib/channel.mjs:208`), a `question`
notice takes `"document": "<path>"` and `"review": "<read id>"`, or `"skip": "<skip record id>"` (his words that skip
it, `double-review skip`), or `"fact": "<why it proposes nothing>"`. A `review` must name a read whose `files` hold that
path, whose readers both answered, and whose findings all have a `take`. The read's hash bundles every file and diff
(`bin/double-review.mjs:312-327`) and the last read is answered by edit, so no byte match is required: what changed
after the read is the answers to its findings, said in the question. Anything else, and a question with none of the
three, is refused. The board lists every `fact` question, so they are audited. A stricter check on what `notify
--kind question` accepts is high risk (item 3): his to approve.

## Unguaranteed
What the three reads left that this proposal does not settle, for him to weigh:
- P6 cannot prove the text shown is the one reviewed: it checks that the document was read and every finding taken,
  and trusts the question to say what changed after; a byte check would refuse every question after a last read.
- The cost against his allowance: 2.4 million uncached Fable input tokens a day under R is an estimate, and his weekly
  Fable allowance in tokens is not known; the benefit is not measured, and the advisor trial's criterion was not met
  (`odd/tasks/advisor-trial.md`, Result).
- The lead's 26 messages to sessions are neither gated nor sampled; P5's protocols line could land before the hook,
  his call.
- The report finds escapes by shell from git, after the fact.
- Every Bash and Write call on the machine starts the hook's Node process (about 60 ms measured with a transcript read, L11), beside the guard's own on Bash; folding it into the guard would save it, and `bin/guard.mjs` is JH 198's now.

## Tasks
- [x] T1 (kind: verify) probes: a hook reads an advisor call; refuse, consult alone, retry; the sub-agent's payload (spec 2) — route: here — commit: this document, M6
- [ ] T2 (kind: design) the last read, then the question to him through the lead (specs 1-3) — route: here — commit: this document
- [ ] T3 (kind: build) after his yes: `bin/advisor-gate.mjs`, its test (a queued-message fixture, a stale shape line, a broken stretch between notify and ask, two outage cases, a SubagentStop second stop), the hook entries, the report (specs 1, 2) — route: here
- [ ] T4 (kind: build) after his yes: P6 in `bin/lib/channel.mjs` and its test (unrelated read, changed file, a failed reader, an untaken finding, a skip) — route: here
- [ ] T5 (kind: build) after his yes: the senior's pieces P4 (spec 3), but P4a, moved to JH 198 (L10) — route: here, or the lead's JH 192 diff

## Log
- L1 (2026-11-13) His request, as written: S1, S2, S3 above; the lead's brief: `js-harness sessions --opening 'JH 196
  · every role consults the advisor when it should'`.
- L2 (2026-11-13) Advisor before writing: four fixes to the first measurement; all taken.
- L3 (2026-11-13) The lead's message after the first read began: (1) question 279 went without a double review, so the
  control should catch a proposing question with none, and a Seen line goes in this PR; (2) name the senior transcript
  read and how the advisor was seen. Both taken: P6, L5, M5.
- L4 (2026-11-13) Read a229de6b: Claude 16 findings, Codex 7, all taken (figures from one output, queued messages as
  anchors, T1 run, the recommended policy measured, cost by role, the gated and measured acts the same, the command
  forms, P4b as his rule change, S3's "no veo", one dedupe, notify and ask as one act, M5's sources, the lead protocols
  searched, the sub-agent path, the fail-open share, an outage path, the senior exempt by role).
- L5 (2026-11-13) A mistake, the lead's, in five parts. What happened: question 279 ("cómo abre el orquestador las
  sesiones de trabajo...", a change to the orchestrator skill, 69918425 line 354, 16:15:02Z) reached him with no double
  review; `.git/js-harness/double-reviews.jsonl` holds no read between 01:45Z and 18:12Z. The fix now: none for 279,
  answered at 16:16Z; recorded as a sighting of `proposal-unreviewed`. What stops it: P6. Where and when:
  `bin/lib/channel.mjs`, T4, after his yes. The count that proves it: each week, the share of `question` notices whose
  check passed by `fact`, sampled by hand against their text; a proposing one among them is a new sighting.
- L6 (2026-11-13) Read baa660cd: Claude 15 findings, Codex 7, all taken: P6 bound to the reviewed text and its takes,
  with the skip and an audited `fact` (C1, X1); policy R bounded by 60 tool calls, task notifications no longer break a
  stretch, E beside R (C2); the retry and the sub-agent probed (C3, M6); `advisorModel` per entry for "had the advisor"
  (C4); the "offered" count back in the output (C5); S3's cause and a Done-when (C6, M8, P4d); every "no advisor" site
  (C7); Haiku apart (C8); `SendMessage` and briefs measured and left out (C9); Adds and the choices made consistent,
  the exemption out of the Goal (C10); a per-document check of the takes (C11, X7); cost at each act's request size,
  "uncached" dropped (C12); P4b says the text is false (C13); the install entry in scope, `AskUserQuestion` gated (C14,
  X3); line 3271 quoted (C15); an outage counts only calls made alone (X2); a second sub-agent stop recorded (X4); a task
  document by shell is an escape the report lists (X5); the report reconciled with the transcripts (X6).
- L7 (2026-11-13) The advisor, before the last read: nine fixes, all applied. "29 transcripts" was 24; the briefs count
  was 0 from a regex whose backslashes a patch lost (6 now); "mostly relays" dropped; R's cost re-measured with a call
  expiring after 60 tool calls (24 calls, not 21); M1's `advisorModel` reading made to work for Fable callers; P2 bound to
  60 tool calls; Haiku gated; `SubagentStop` probed; L6's partial items finished here (R's consequence in Ask me
  before and P1, the sub-agent probe in M6, the Haiku row, the Adds line).
- L8 (2026-11-13) Read 95b51156, the last: Claude 10 findings, Codex 5, all taken, some as Unguaranteed. P6 no longer
  matches bytes and names the document (C1, X2); M2's lead calls 3 and 7 (C2, X5); P4d's start_session route withdrawn
  with its reasons (C3, X1); the senior looked up by session id, its sub-agents under choice (3) (C4); the messages and
  P5 as unguaranteed (C5); cost uncached, its weighing unguaranteed (C6); P2's "sub-agents 3" and its stretch as R's, a
  second stop covered when a fresh call is there (C7, X4); M5's full list (C8); M1's equality premise (C9); the evidence
  copied into `odd/tasks/advisor-use-evidence/`, Edit dropped from P1 (C10); escapes found from git (X3).
- L9 (2026-11-13) His yes to question 282 ("Sí, avisos primero (Recomendada)"), relayed by the lead with two constraints: the report measures added Fable tokens a day against 2.4M, and the edit surface goes to the lead first. Advisor before the build: the choices in State.
- L10 (2026-11-13) Probe 4 (`odd/tasks/advisor-use-evidence/probe4-notice-seen.md`): a PreToolUse `additionalContext` without a deny reaches the model, so the warning week speaks. The lead moved P4a (the texts saying the senior runs with no advisor: `bin/lib/guard.mjs:109,115`, `bin/guard.mjs:168`, `bin/lib/home-sessions.mjs:51`) to JH 198, which holds those files: out of this scope. Slice 1 built: `bin/advisor-gate.mjs` (--hook, --stop), its test (21 cases), the entries in `bin/lib/hook-entries.mjs` and their registration; slice 2 is the report.
- L11 (2026-11-14) Reviews of slice 1. Codex (cc54678..13fba26, 3 parts): two P2, both fixed in b3043fb9 (the harness home through harnessHome; a quoted `--kind` value kept). The Claude lenses (risk 0, resilience 1, reliability 2): a gated command named only inside quotes was an act, fixed (the whole command read unquoted, tests); an advisor call sharing its response with a tool call counted, answered: M6 shows such a call gets no result, so a call with one was made alone; a Node process on every Bash and Write call machine-wide, answered: 61 ms measured on this session's transcript (covered, 31 tool calls), the guard already runs on every Bash, and folding the two waits on `bin/guard.mjs` (JH 198), so it is listed under Unguaranteed.
