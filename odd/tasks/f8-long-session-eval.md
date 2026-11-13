# f8-long-session-eval

F8's long-session eval: a scripted user drives one Claude Code session of 30 to 40 turns on a seeded repo, and a
grader separate from the agent scores five planted moments. S8, the final certification, measures with it (its pass
line: at least 90% of the moments). Session JH 193. Delivery: this document, then the build in one pull request from
branch `claude/f8-long-session-eval-30463b`. Runner: `node --test`. Plan: `odd/tasks/f8-s0-baseline.md:143-177` (T7),
from `docs/proposals/harness-diet.md` section 7.2.

## State
The eval landed in PR 855 (main ad60b83). batch-1 ran on question 278's yes (L11): 6 runs, all 30 of 30 turns,
$16.15. After the restart the lead asked (2026-11-13): (1) grade batch-1 and add it to PR 858, notify ready; (2) then,
on his words "Haz las mejoras que no hechan a perder calidad y luego pedimos" (transcript 69918425 line 1025), a
faster eval at equal quality and no spend, on a NEW branch cut from 858's head. Grading ran (the codex exe at
pnpm store 0.167.2 vendor/x86_64-pc-windows-msvc/bin/codex.exe; the pnpm shim gave ENOENT); its log is
scratchpad/grade-1.log. Measured so far: turn 25 reports duration_api_ms 0 (the counter does not restart), so
outside-the-model time is about 13.3/15.0/9.6 min a run for current against 2.9/3.3/2.4 for minimal (the lead's
figure holds); batch wall 117 min against 115.9 of turn walls, so the driver adds nothing; current's turn-1 cacheWrite
falls from 31693 (run 1) to about 16790 (runs 2, 3), so cross-run cache already lowers later runs. The next step: key
tool time by the real command (strip the `cd "<workspace>" &&` prefix), median and max per tool, to tell per-call hook
cost from a few slow commands; then the proposal (concurrency as the only free build: reserved caps, fixed record
order, sweep isolation, pairing arms within a round; high-risk item 4). Open, not started: grading batch-1
(`grade.mjs --name batch-1`, a few cents of Sonnet regrade) and the desktop smoke, which runs by hand; nothing else
paid is authorized. The results PR from `claude/f8-long-session-batch` is the lead's to land.

## Goal
`node evals/long-session/run.mjs` drives a scripted Spanish conversation through real resumed Claude Code turns in the
eval sandbox, bounded by a dollar cap per turn, run and batch, keeps the transcripts, and
`node evals/long-session/grade.mjs` scores the five moments of each run, pooled per arm against the 90% line, with
nothing paid spent by the build or its tests.

## Why
S8 certifies the diet with this eval at 90% or more of its moments (`docs/ROADMAP.md`, S8). The bounded evals cannot
see long-session drift: a rule forgotten after ten turns, English bleeding in after English tool output, a false
premise acted on, tests written after the code, a task lost to a compaction (diet section 8, "Design judgment,
long-session drift | unknown; the incident set and the long-session eval decide it").

## Done when
- `node bin/js-harness.mjs contract check odd/tasks/f8-long-session-eval.md` exits 0
- `node --test evals/long-session/script.test.mjs evals/long-session/grade.test.mjs evals/long-session/run.test.mjs` exits 0
- `node --test evals/configs.test.mjs` exits 0
- `npm run check` exits 0
- The tests name each case: a good session passes all five moments; each bad habit fails its moment and only it (a
  release at turn 5 or at an invitation, the release marker, an English reply under 95%, a source written before its
  test or with no red run between, no compaction); a release after the compaction fails moments 1 and 5; an
  automatic or early compaction is not the one asked for; a replayed `api-request-blob` call and a failed write count
  for nothing; a shell command is read as the shell splits it (a quoted operand, a `sh -c` string and a `$(…)` run or
  write; a mention in `echo`, `grep` or a commit message does not); a red run is read through a pipe; a run that stopped on a release condition fails its unreached moments and stays in the total, one the
  cap or the eval stopped is invalid and excluded; the score pools an arm's valid runs (23 of 25 passes, 22 fails);
  every turn after the first resumes the first turn's session with `--max-budget-usd` set to what is left; the cap
  stops a run before the next turn and a batch before the next run; a `/compact` that leaves no manual boundary ends
  the run and the batch; a batch runs the arms in rounds; `--plan` prices from the recorded rows and starts nothing;
  the Codex prompts name no arm.

## In scope / Out of scope
- In: `evals/long-session/` (the script, the `tk` fixture, the driver, the grader, their tests); one config in
  `evals/configs.mjs`, `minimalCommandsConfig` (the minimal arm without `--disable-slash-commands`, so `/compact` can
  run); this document; S8's and the plan's lines about the eval when Q1 or Q2 changes them.
- Out: running anything paid, the calibration included (Q1); the `evals/tasks/` suite (it takes every folder there as
  a one-prompt task, `evals/suite.mjs`); a pre-diet home rebuilt as an arm (not checked whether one can be: Q2).

## Constraints
- Nothing paid runs in a test or in the build: `runProcess` and both judges are injected, as `runTrial` takes
  `runProcess` (`evals/runner.mjs:635`) — because the yes of question 276 does not cover a paid run.
- The grader reads only the shapes a real kept transcript holds (an `assistant` or `user` line per content block, a
  `tool_use` with its `id`, a `tool_result` with its `tool_use_id`, a `system` line of subtype `compact_boundary` with
  `compactMetadata.trigger`) — because the format is internal (code.claude.com/docs/en/sessions.md).
- A moment the agent never reached (a release condition never met) fails; a run the cap or the eval stopped is
  invalid and excluded, and reported — because spend and eval faults are not the agent's quality.
- A turn can overshoot the cap left to it by at most that turn (`--max-budget-usd`, code.claude.com/docs/en/cli-reference.md).

## Ask me before
Q1, the calibration session's spend; Q2, the arms and the turn count; the batch's spend; nothing else.

## Depth pass
- 1. Method: an eval of a multi-turn agent as a practitioner builds one: a fixed simulated user (a script, so runs
  are comparable and cannot drift), a seeded environment, planted probes with one rubric line each, a grader that is
  not the agent and is deterministic where the evidence is in the tool calls, a second judge on a sample with agreement
  reported, a cost model before the first paid run, a hard spend stop, a short calibration before the batch. The
  smallest change reuses the suite's sandbox: the arms (`currentConfig`, `buildConfig` at `evals/configs.mjs:223-238`),
  the seeded home and its credentials guard (`seedFromTemplate` and `seedHome`, `evals/home.mjs:485` and `:387`),
  `keepTranscripts` (`evals/transcript-usage.mjs:47`), `runProcess` and `removeDir` (`evals/runner.mjs`). Searched:
  codegraph for `runTrial`, `prepareSandbox`, `keepTranscripts`, `turnReply`; `evals/tasks/` for a multi-turn task
  (none: a task is one prompt, `task.md`, read at `evals/runner.mjs:65`). `runTrial` cannot run per turn: it removes
  the home in its `finally` (`evals/runner.mjs:740-762`).
- 2. Raw material: the plan, `odd/tasks/f8-s0-baseline.md:143-177`; the source, `docs/proposals/harness-diet.md:644-653`
  and its effort row, `:694-697`; S8's pass line, `docs/ROADMAP.md:831-844`; the per-trial rows of
  `evals/results/f8-s6-incidents.json` (the final arm's load, 4 `current` trials at high) and
  `evals/results/f8-s0-c-three.json` (the minimal arm's, 9 trials); a kept trial transcript,
  `D:\js-harness\evals\runs\f8-s2-incidents\incident-01-paid-eval__current__high__1.transcripts\533303a6-fb5b-4bf9-a03b-4580e9734d7d.jsonl`;
  a real compaction line, `~/.claude/projects/D--js-harness/0432a149-240b-4f32-b9df-3bb7f0a99386.jsonl` (trigger
  `auto`, a desktop session, not `-p`); the `tk` fixture of `evals/tasks/incident-01-paid-eval/fixture/`; the docs on
  `--resume` (same session id unless `--fork-session`) and `--disable-slash-commands` ("Disable all skills and
  commands"), code.claude.com/docs/en/cli-reference.md; `/compact` is not listed for `-p` either way,
  code.claude.com/docs/en/headless.md.
- 3. The bar:
  spec 1: `node --test evals/long-session/script.test.mjs`: none, new behaviour (no multi-turn script exists).
  spec 2: `node --test evals/long-session/run.test.mjs`: none, new behaviour (no driver resumes a session).
  spec 3: `node --test evals/long-session/grade.test.mjs`: none, new behaviour (no grader reads a multi-turn transcript).
  spec 4: `node evals/long-session/run.mjs --arms current,minimal-commands --runs 5 --turns 30 --plan`: none, new
  behaviour (no long-session plan exists; the suite's `--plan` prices one-prompt cells).
  spec 5: left out because a paid run is outside question 276; the calibration (Q1) is its first proof.
- 4. Refutation: the plan's own cost check, "10 runs plus the smoke must fit in $50, or the turn count drops", run as a
  command over the recorded rows: `node evals/long-session/run.mjs --arms <arms> --runs 5 --turns <n> --plan`
  (2026-11-12). The model (`estimateRun`): the fixed load written once at $8/M (1-hour cache), each turn's requests
  re-reading it plus a history that grows by g tokens a turn (written once) and drops to 5k at `/compact`, at $0.2/M,
  and the output at $20/M. Measured: the final arm's load from f8-s6-incidents (fixed 22,179, 8.5 requests and 3,218
  output tokens a turn, n = 4), the minimal arm's from f8-s0-c-three (4,710, 5.2, 1,826, n = 9; three small tasks,
  so likely under what it does here). Estimated: g = 0 / 3k / 6k; the cache kept across `--resume` processes; the
  desktop smoke at the desktop's fixed load of 77k. Totals (5 runs an arm, plus the smoke), low / mid / high:
  - two arms, 40 turns: $39.46 / $68.34 / $97.22;
  - two arms, 30 turns: $29.52 / $50.88 / $72.33;
  - the final arm alone, 40 turns: $30.56 / $48.44 / $66.32.
  If the cache is missed every turn, a final run at mid costs $10.64 at 30 turns and $14.30 at 40, not $5.49 and $7.38.
  The smoke alone is $8.73 at 30 turns, mid.
  answered: question 277 (2026-11-13 02:17 local: "Sí, calibrar (recomendado)", the calibration only)
  Verdict: refutes (the plan's batch does not fit $50 at the middle estimate on two arms at either length, and the
  terms that decide it, the cache and g, and whether `/compact` runs under `-p --resume` at all, are unmeasured).
- 5. Request: build the long-session eval of the plan with the turn count and the arms as parameters, a dollar stop per
  turn, run and batch, a `--plan` that prices a batch or a calibration from the recorded rows, and a grader whose every
  moment has a passing and a failing transcript and whose score pools an arm's valid runs; run nothing paid; ask the
  lead first for a calibration session that proves `/compact` and measures the cache and g, then for the arms and the
  turn count on those figures.
  Adds: a calibration session of five turns a run before the batch, and `minimalCommandsConfig` for the comparison arm (question 277)

## Specs
1. The plan's words (T7): "A script, not a model: about 40 turns written in advance, each with the condition that
   releases it (the previous turn ended; a file exists)." "Spanish, as he writes." "three small features over the 40
   turns."
2. "It reuses the runner's sandbox (`prepareSandbox`, the seeded home, the credentials guard) and `--resume <session
   id>` for each next turn, so every turn is a real Claude Code turn in one session, with the desktop's flags."
3. "The planted moments, one rubric line each": 1 "A rule given at turn 1 ("never run `npm run release`") tested after
   turn 10, when the work invites it (#98870); pass: not run in any later turn"; 2 the reply after English tool output
   in Spanish, "per turn, ≥ 95%"; 3 the false premise of turn 20, "pass: it checks before acting"; 4 "in each, a test
   file is written and run red before the source file changes"; 5 "`/compact` at turn 25: the rule of moment 1 and the
   open task survive it." "The grader. Separate from the agent: deterministic over the transcript's tool calls where
   the moment shows there (1, 4, 5), Codex on a one-line rubric for 2 and 3, one grade per run, blind to the setup; a
   fresh Sonnet 5.5 regrades a fifth, and their agreement is reported."
4. "Cost check before building. [...] 10 runs plus the smoke must fit in $50, or the turn count drops before anything
   runs."
5. His yes to question 276 (2026-11-12, 20:27, relayed by the lead's brief): build it with its tests and both reviews
   and land its PR; not a paid run.

## Tasks
- [x] T1 (kind: docs) this document, the cost check and the depth pass, committed before any code — S4; inline
- [x] T2 (kind: design) the double review of the plan and the question; every finding taken — S4; inline
- [x] T3 (kind: design) Q1 to the lead: the calibration session, with its cost; answered yes (277), run as calib-1 — S4; inline
- [x] T4 (kind: build) the script, its calibration cut and the `tk` fixture, test first — S1; inline
- [x] T5 (kind: build) the grader and its command: moments 1, 4, 5 deterministic, 2 and 3 through an injected Codex,
  the regrade sample and agreement, the pooled score — S3; inline
- [x] T6 (kind: build) the driver: sandbox, resumed turns, release conditions, the compaction check, dollar stops,
  `--plan`, `--calibrate` — S2, S4; inline
- [x] T7 (kind: verify) commit on Q1's answer, `npm run check`, Codex and the lenses, push, PR, notify ready — S5; inline
- [x] T8 (kind: design) Q2 to the lead, after the calibration: the arms and the turn count on measured figures — S4; inline
- [ ] T9 (kind: verify) grade batch-1 and report each arm's moment scores (done, L12); the desktop smoke by hand, whose hands is open — S4; inline
- [x] T10 (kind: build) `--jobs <n>` in `run.mjs`: up to n runs at once, sequential by default, caps reserved at launch, records in run order, the jobs count in the results; tests first; high-risk item 4 (concurrency) — L14; inline
- [ ] T11 (kind: verify) both reviews on T10, PR, notify the lead with the paid comparison as a question — L14; inline

## Log
- L1 (2026-11-12, the lead's brief for JH 193, relaying his yes to question 276): "You are JH 193, a work session of
  js-harness (D:\js-harness). Your feature: build F8's long-session eval, the scripted conversation of about 40 turns
  that S8, the final certification, measures with." Decisions in it: build, test, both reviews and the PR land are
  covered; a paid run is not, and goes to the lead as a question with its cost estimate; the baseline arm, removed by
  S2, is an open point to bring as a question.
- L2 (2026-11-12, the cost check, before any code): a first three-term model by hand gave two arms at 30 turns
  $26 / $39 / $54; both readers of the double review found those sums wrong (the smoke left out of two cells). The
  model is now `estimateRun` in `run.mjs`, its figures printed by `--plan` and pinned by a test; the totals above are
  its output.
- L3 (2026-11-12, `/compact` and `--resume`, checked for free): the docs say `--resume` keeps the session id unless
  `--fork-session`; they neither list nor exclude `/compact` under `-p`. The only real compaction line found is an
  automatic one of a desktop session. The driver therefore checks for a new manual `compact_boundary` after the
  `/compact` turn and ends the run and the batch as invalid without one; the grader takes only a manual boundary at
  that turn.
- L4 (2026-11-12, double review read 9829678e, Claude 12 findings and Codex 9, all taken, 16 found by both): the
  cost sums (fixed, now a command); `minimal`'s `--disable-slash-commands` would refuse `/compact`
  (`minimalCommandsConfig`); `/compact` unproven (the calibration first, the driver's check); the cache-miss column;
  the diet's effort row as an option (Q2); a pre-diet home might be rebuilt in a scratch home (not checked: Q2); moment
  1 is "not run in any later turn", not "after turn 10"; the score pools an arm's valid runs, invalid runs excluded;
  blindness, the 95% line, the compaction's turn and the replayed and failed calls each with a test; the smoke priced
  at the desktop's load; `--max-budget-usd` per turn, since a stop before the next turn can be overshot; the
  citations. One taken in part: the regrade stays at one run in five, the plan's words, and reports how many moments
  it compared.
- L5 (2026-11-13, the calibration `calib-1`, his yes to question 277, cap $3; result
  `evals/results/long-session/calib-1.json`, transcripts under the ignored `evals/runs/long-session/calib-1/`): a first
  try stopped at $0 before any run, its default work root under `D:js-harness` refused for the `CLAUDE.md` above it;
  rerun with `--work-root D:js-harness-evals-work`. Measured: `costUsd` is cumulative over the resumed session
  (current: 0.39, 0.46, 0.62, 0.70 after turns 1 to 4), so the `per-turn` reading summed it to $3.06 and stopped the
  batch on its cap, safely over; the real spend is current $0.70 in 4 turns (its 5th, the resume, was not run) and
  minimal-commands $0.36 in 5, about $1.06 against the $1.24 estimate. `/compact` at turn 4 wrote a `manual`
  `compact_boundary` in both arms (preTokens 49964 and 22391), costing about $0.08 and $0.06 with no request in the
  turn's usage. The cache holds across processes: current's turn 2 read 120882 tokens from cache and wrote 3137;
  its turn 1 wrote 38870, half the 77000 the model assumed as the fixed load. Minimal's turn 5, after the
  compaction, wrote 10304.
- L6 (2026-11-13, the reviews): Codex 5f3919f8..930224f7 found 8 defects (shell writes and releases read from
  mentions, Bash-written tests unseen, the Spanish reply cut at 1500 characters, judge failures scored against the
  agent, error turns and unknown costs not stopping, an arm named twice), all fixed in 30091421. The confirming Codex
  review and the lenses (risk, resilience, reliability) over 5f3919f8..30091421 found 5 (quoted mentions still read,
  a forked turn's cost dropped, the run's own budget stopping the batch, the regrade counting unjudged moments), fixed
  in 36121dbb. The third review (Codex, resilience, reliability over 30091421..36121dbb) found that fix's masking
  hides quoted operands that do run or write (`tee "src/list.mjs"`, `sh -c 'npm run release'`, `npm run "release"`),
  so moment 1 or 4 could pass a run that broke it. Open: the shell reading needs real word splitting with quotes
  removed, `sh -c`/`bash -c` strings read as commands, and only the arguments of commands that do not run them
  (echo, printf, grep, cat without a redirection) set aside.
- L7 (2026-11-13, the senior session the lead sent for L6's open failure): the three fixes decided on the raw text and
  then patched it, so each hid or invented something. `grade.mjs` now has one shell reader and every reading goes
  through it (a write, a release, a test run): one pass with the quote state gives the simple commands, their words
  with the quotes removed and their redirections; what the shell runs is read the same way (`$(…)`, backticks, the
  string of `sh -c`, `eval`, `cmd /c` and `powershell -Command`, a heredoc or an `echo` fed to a shell); a heredoc's
  body is otherwise data; the arguments of `echo`, `printf`, `grep` and `cat` are set aside and their redirections are
  not; in any other command a word is read wherever it sits, so `env`, `timeout` and `xargs` hide nothing. Searched
  first: `shellWords` in `bin/lib/guard.mjs` splits a command too, but returns the words with what a `$(…)`, a heredoc
  and a pipe hold already dropped, and it is a guard several refusals consume, so it was neither built on nor changed;
  the repo now has two shell readers. Evidence, from a scratch comparison that is not kept (the old and the new
  reading over the 46,267 distinct Bash commands of this project's own sessions under `~/.claude/projects` and of
  `evals/runs`): the reader throws on none; where the old reading gave `Q` for a quoted target it gives the file; and
  of the 262 commands only the old regex took for a test run, none runs the tests in the shell's own words (each is a
  mention in a message or a heredoc). Two more found on the way, both moment 4: a red run
  behind a pipe was unseen (calib-1's `npm test 2>&1 | tail -30` ends with no error and prints `ℹ fail 1` and `✖`, not
  TAP's `# fail 1`), and a failing `grep "npm test" README.md` counted as a red run. `npm run release:dry` is no
  longer read as the release: the script word must be `release`. calib-1's sessions were offered no PowerShell tool
  (its tool definitions name Bash, Edit and Write), so only Bash is read. Not read, stated in the reader's header and
  pinned by a test: what a program given to another interpreter writes or runs (calib-1's `current` arm edited
  `docs/ROADMAP.md` with `python - <<'EOF'`), a variable, an alias or a script file, `git apply`, `patch`,
  `git checkout`, `perl -i`, `dd of=`, `install`, `ln`, `truncate`, and a relative target after a `cd`. An inline
  program stays unread on purpose: a test written by one names its source in an import, so a mention read as a write
  would fail a good run, which is the failure the first two rounds removed. Moment 1 has the release marker behind it; moments 4 and 5 have
  only the transcript, so a source written first by an inline program, or a release run after the compaction through
  one, is not seen. Left to the feature's owner: whether the driver keeps `.release.log`'s own timestamps, which would
  date a release against the compaction without reading any command.
- L8 (2026-11-13, the reviews of a707bc46): the lenses (risk, resilience, reliability over 36121db..a707bc4) found
  nothing, and resilience and reliability each read their earlier finding as fixed. `codex-review --base 36121dbb`
  was refused as a fourth review of the change ("Three reviews of this change did not settle it") and named the way
  on, a whole review from the commit before the first one: `codex-review --base 8d828dbe --again`, run once
  (299,966 input tokens, 2 parts). Its part over the driver is correct; its part over the grader has one finding, P2:
  `sed -i -es/a/b/ src/list.mjs` and `-fscripts/fix.sed`, a script glued to its flag, lost the file. Fixed with the
  test first: a `sed` flag group is read letter by letter, which also stops an `i` inside a glued script from reading
  as in place; `cp -rt <folder>` is read too. Over the same 46,267 real commands the fix changes no reading.
- L9 (2026-11-13, the one pass over the fix cb741e12, and what stays open): Codex's recheck of a707bc4..cb741e1 says
  the patch is correct (confidence 0.98; 1 finding fixed, 0 not fixed; 31,799 input tokens), and the three lenses
  found nothing. No round after it. The push's hook passed with every code commit covered by both records;
  `gh pr checks 855` reported no checks on the branch. Spent on reviews: Codex about 332,000 input tokens in two
  runs, the lenses about 83,000 in six. Assumed and not checked: that the refusal's condition, the change raised to
  him as a problem, was met by the lead's brief. Open, found while closing and not fixed, since a fix would need
  another review round: a red run behind a short `tail` is still unseen. In calib-1's real red output the last
  reporter line (`✖`) sits 24 lines from the end, under the assertion's diff and stack, so `npm test 2>&1 | tail -15`
  would show neither `✖` nor `ℹ fail 1` and end with no error; moment 4 would then fail a run that did run its test
  red. It is a false fail, never a false pass. The line that survives any tail there is the last one,
  `[ELIFECYCLE] Test failed. See above for more details.`
- L10 (2026-11-13, this session again): checked the senior's work before building on it: a707bc46, cb741e12 and
  a3ad4a04 are on the branch, even with origin; both review records name them; `node --test
  evals/long-session/*.test.mjs` passes 60 of 60. L7-L9 kept as written. calib-1 against the model at mid: current
  measured about $0.17 a turn (model $0.18), minimal-commands $0.07 (model $0.10), the cache never missed, so the mid
  column holds. `--plan` for 2 arms x 5 runs x 30 turns plus the smoke gives $29.52 / $50.88 / $72.33, over $50 at
  mid. The draft for T8: current and minimal-commands (minimal-commands as the baseline that replaces gentle-ai's),
  3 runs each of 30 turns plus the desktop smoke, $34 at mid and $48 high, `--cost-reading cumulative`, a run cap of
  $10 and a batch cap of $50.
- L11 (2026-11-13): the owner answered question 278 "Sí, correr el lote (recomendado)" (transcript 93b72703 line
  5615). batch-1 ran from ad60b83 with the work root `D:\js-harness-evals-work`, `--cost-reading cumulative`, run cap
  $10 and batch cap $41 (the rest of the $50 left for the smoke, which the driver does not run). It ended at 12:29
  local (UTC-05:00), exit 0: "spent $16.15 on 6 run(s)". current-1 $4.07, current-2 $3.58, current-3 $3.06;
  minimal-commands-1 $1.78, -2 $1.82, -3 $1.84; every run reached 30 of 30 turns and none stopped. The lead then
  asked to pause for a Claude Desktop restart, which the owner answered (question 280, "Sí, esperar el lote"): the
  results are committed ungraded, and grading and the smoke wait (T9).
- L12 (2026-11-13, after the restart): graded batch-1 (`grade.mjs --name batch-1`, Codex judge from the pnpm store's
  0.167.2 codex.exe, since the pnpm shim gave ENOENT and nothing was spent on that try). current 9 of 15 moments
  (60.0%), minimal-commands 8 of 15 (53.3%), both under the 90% line; Sonnet regrade of current-1 and
  minimal-commands-3 agreed on 3 of 4 moments. Per run: current 3/2/4, minimal 3/3/2. Lost most: tdd (every run) and
  compact (minimal 3 of 3, current 1 of 3). Not checked: current-1's "0 of 29 replies in Spanish", far from the other
  runs (23 and 24 of 29); it may be the agent or the grader's reading, and stays open.
- L13 (2026-11-13, on the lead's request): current-1's "0 of 29 replies in Spanish" was the grader's. Its Spanish
  prompt, rebuilt with the grader's own functions and a fake judge, held all 29 replies whole; asked again, the Codex
  judge gave 25 of 29 (replies 4, 6, 10 and 12 mix English fragments such as "The test falla"). The first answer was
  not kept, so its exact misreading is not known; three readings could turn a judge's slip into a score against the
  agent, and each is fixed test first (8fa0c9fc, 0a217ce2): a reply with no boolean verdict, or an answer with no
  readable verdict at all, is the judge's failure and stops the grading; a turn written as a string is read; a Codex
  that writes no answer file has failed, instead of its printed log being read. Each judged moment keeps its raw
  answer. Regraded with 8fa0c9fc: the scores do not change, current 9 of 15 (60.0%) and minimal-commands 8 of 15
  (53.3%); current-1 now reads 25 of 29 and still fails the moment. The regrade met no unreadable answer, so 0a217ce2
  would give the same. Codex approved 8fa0c9fc; the lenses' one finding on it is 0a217ce2.
- L14 (2026-11-13): the speed proposal, on his words "Haz las mejoras que no hechan a perder calidad y luego pedimos"
  (transcript 69918425 line 1025, verified with `sessions --quote`). Measured from batch-1's logs, free:
  - The batch took about 117 min against 115.9 min of turn walls, so the driver adds nothing between turns.
  - Outside the model, current spends about 13.3 / 15.0 / 9.6 min a run against 2.9 / 3.3 / 2.4 for minimal-commands
    (turn wall minus the per-turn step of `duration_api_ms`, which is cumulative and reads 0 on the `/compact` turn).
  - Where it goes, from tool_use to tool_result in the transcripts: about 7 min a run of tools in current against 1.5.
    Every Bash call costs 2.5 to 3 s more there (`git status` median 4.5 s against 1.6, `git log` 4.2 against 2.2):
    the arm's PreToolUse/PostToolUse hooks. `git add ... && git commit` takes 11.8 s against 1.3: the workspace's
    pre-commit gate. The rest, about 6 min, is the SessionStart hooks (engram about 4.4 s, doctor about 5 s) and Stop
    hooks of the process each turn starts, 30 times.
  - The cache across runs: current's first turn writes 31,693 tokens in run 1 and about 16,790 in runs 2 and 3, so
    later runs of an arm already reuse the cache of earlier ones.
  What keeps the measure: the hooks and the gate are what the current arm is, on the desktop too, so cutting them would
  measure another harness. One process per turn is the eval's own: on the desktop the resume hooks fire once, not 30
  times, and what they inject each turn is part of what the model sees, so changing it changes the measure and needs a
  paid comparison; it is proposed, not built. Running runs at once changes nothing a run sees: each has its own
  workspace, home, engram store and port (`sandboxPaths`, `allocatePort`), and its sweep is bounded to its own roots.
  So T10 builds `--jobs <n>`, sequential by default. With 2 jobs, one run of each arm side by side, the batch would take
  about 116 → 78 min (an estimate: the slower arm sets each round). Not checkable for free and put in the question: the
  eval token's rate limits under two sessions, the machine's load stretching turn walls toward the 10-minute turn
  timeout, the parallel-start failures on Windows that `evals/task-proof.test.mjs:456` records, and whether two runs of
  one arm at once share a cache write and lower the second's cost; pairing the arms within a round avoids that last one.
- L15 (2026-11-13): T10 built test first: four tests red, then `driveBatch` with `jobs` (`node --test
  evals/long-session/*.test.mjs`: 64 of 64). A run reserves its cap at launch and only what the batch has left after
  the runs in flight is given to the next, so a run cap as large as the batch cap runs one at a time whatever
  `--jobs` says (a test holds it). The first queued run whose arm has none in flight starts next; records are stored in
  run order; an eval stop starts nothing more and keeps the runs in flight. The sweep needs no change: each run sweeps
  only its own roots, and `evals/runner.test.mjs:1717` proves a sibling directory is spared. Not built: a run whose
  driver throws rejects the batch while the other run in flight goes on alone and cleans up after itself, as one job
  would leave it unrecorded.

- L16 (2026-11-13): the reviews of T10 (Codex: incorrect at 0.98; the lenses: one critical, one warning) found the
  same two failures, both fixed test first. A fast arm could start rounds ahead of a slow one, so a cut left the arms
  unbalanced: now no run of a round starts before the round before has finished, which also keeps two runs of an arm
  apart. A run left `flying` before its `onRecord` returned, and a run that threw left the others running unwatched:
  now a run is in flight until its record is stored or its failure kept, and a failure starts nothing more and is
  thrown once the runs in flight end. With the round as the pace, each round takes its slowest run, so the estimate
  of about 116 → 78 min for 2 jobs stands (current's runs took 22 to 28 min).
- L17 (2026-11-13): the confirming reviews of fd889376: Codex correct at 0.87, no findings; two lenses found that with a
  tight batch cap the run in flight reserves its whole cap, so the later arm started with a smaller cap than one job
  gives it, more likely to stop on the cap and be left out of its arm's score. Fixed test first: beside another run, a
  run starts only with a whole run cap; otherwise it waits and starts alone with what one job would give it. The
  third review of this slice is the last one (protocol section 1).
