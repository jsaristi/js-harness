// The rules of this project that are declared, one object each, sorted by id. For a rule with a value
// this is its home: the value is written here, in the unit a person says it in, and nowhere else; the
// code that needs it reads it with `ruleValue` of ./rules.mjs (odd/tasks/rule-hierarchy.md, "How a rule
// is declared"). This file is data and imports nothing. Its text is what `writeRules` of ./rules.mjs
// gives for the list, and a test holds it to that: a rule is changed there, never in another shape.
export const RULES = [
  {
    "id": "agents-budget",
    "subject": "the most estimated tokens AGENTS.md may hold, since every session pays it on every turn",
    "owner": "project",
    "since": "2026-10-15",
    "value": 1500,
    "unit": "estimated tokens",
    "patterns": [
      "^(?!.*\\bruleValue\\().*AGENTS\\.md.{0,60}\\bbudget\\b.{0,30}{amount}",
      "^(?!.*\\bruleValue\\().*\\bbudget\\b\\W{0,3}{amount}\\s*(?:estimated )?tokens"
    ]
  },
  {
    "id": "announce-finished",
    "subject": "a session says when it finished and where to return, watches its context, and a rule has one home",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "when a stretch or a session ends, that it ended and which session to return to.",
      "The user never compacts a session by hand, present or away"
    ]
  },
  {
    "id": "ask-before-away",
    "subject": "before he leaves, the lead asks for everything the stretch needs, and while he is away repeats nothing",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "Before the user leaves, ask in that reply for everything the stretch will need",
      "While the user is away, a block that waits for them is given once and held until they say they are back"
    ]
  },
  {
    "id": "background-task-declared",
    "subject": "a background task says what it is for and what ends it, and is stopped when its condition resolves",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "A background task a session starts (a wait, a watch, a timer) says in its description what it is for and what ends it"
    ]
  },
  {
    "id": "ci-gate-bound",
    "subject": "how long a commit gate sent to GitHub waits for its run to end, from the push, before it cancels the run and runs the gate on this machine",
    "owner": "project",
    "since": "2026-10-16",
    "value": 8,
    "unit": "minutes",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:runs?|jobs?)\\b.{0,60}\\b(?:not done|cancelled|stopped)\\b.{0,15}\\b(?:after|within|past)\\s+{amount}"
    ]
  },
  {
    "id": "codex-review-floor",
    "subject": "the most input tokens a Codex review may cost however small its commit",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 300000,
    "unit": "input tokens a review",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bfloor\\b(?!\\s*\\().{0,40}(?<![\\w:.\\x60-]){amount}\\s*input tokens",
      "^(?!.*\\bruleValue\\().*(?<![\\w:.\\x60-]){amount}\\s*input tokens (?:a|per|for each) review\\b"
    ]
  },
  {
    "id": "codex-review-margin",
    "subject": "how far over its allowance the plan of a Codex review may read and still count as inside it",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-12",
    "value": 5,
    "unit": "percent of the allowance",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bmargin\\b.{0,40}(?<![\\w:.-]){amount}(?<=(?:%|\\bpercent))",
      "^(?!.*\\bruleValue\\().*(?<![\\w:.-]){amount}(?<=(?:%|\\bpercent)).{0,20}\\bof the allowance\\b"
    ]
  },
  {
    "id": "codex-review-rate",
    "subject": "the most input tokens a Codex review may cost for each changed line of its slice, when that is more than the floor",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "input tokens a changed line",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:rate|cap|put at)\\b.{0,20}(?<![\\w:.-]){amount}\\s*(?:input )?tokens (?:a|per|for each) changed line"
    ]
  },
  {
    "id": "context-pause",
    "subject": "the share of its context window at which a session pauses, writes its state and judges whether what is left fits before the host compacts",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": 88,
    "unit": "percent of the context window",
    "flag": "--context-pause",
    "patterns": [
      "^(?!.*\\bruleValue\\()(?=.*\\b(?:paus\\w*|compact\\w*|writes? its state)\\b).*(?<![\\w:.\\x60-]){amount}(?<=(?:%|\\bpercent))\\s*of (?:its|the|a|this session's|the session's) (?:context )?window",
      "^(?!.*\\bruleValue\\().*\\bcontext pause\\b.{0,30}(?<![\\w:.\\x60-]){amount}(?<=(?:%|\\bpercent))"
    ]
  },
  {
    "id": "contract-run-timeout",
    "subject": "how long each done-when command of a contract run may run, unless the run says otherwise",
    "owner": "project",
    "since": "2026-10-14",
    "value": 30,
    "unit": "minutes",
    "flag": "--timeout",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bcontract\\b.{0,60}\\b(?:stopped|timeout|times? out|at most)\\b.{0,30}{amount}"
    ]
  },
  {
    "id": "control-phrase-min",
    "subject": "the shortest phrase by which a control or a rule in prose is found in its file",
    "owner": "project",
    "since": "2026-10-11",
    "value": 12,
    "unit": "characters",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bcontrol\\b.{0,50}{amount}\\s*characters"
    ]
  },
  {
    "id": "double-review",
    "subject": "a design before it is built, and what reaches the user to decide, passes two read-only readers that did not write it",
    "owner": "sebastian",
    "since": "2026-10-16",
    "path": "bin/lib/protocols-skill.mjs",
    "phrases": [
      "first passes two read-only readers that did not write it",
      "one attacks its claims, one looks only for what is missing"
    ],
    "failure": "proposal-unreviewed",
    "review": "2026-11-16"
  },
  {
    "id": "gate-log-command",
    "subject": "the longest command a line of the gate log holds, since what follows gate -- can hold a secret",
    "owner": "project",
    "since": "2026-10-15",
    "value": 120,
    "unit": "characters",
    "patterns": [
      "^(?!.*\\bruleValue\\().*(?:\\bgate log\\b.{0,50}\\bcommand\\b|`command`).{0,50}\\b(?:cut|truncated|shortened|at most|kept to)\\b.{0,20}{amount}\\s*characters"
    ]
  },
  {
    "id": "gate-log-size",
    "subject": "the size past which the gate log is renamed over its older file, so the log stays near a megabyte",
    "owner": "project",
    "since": "2026-10-15",
    "value": 512,
    "unit": "KiB",
    "patterns": [
      "^(?!.*\\bruleValue\\().*(?:\\bgate log\\b|\\blog\\.jsonl\\b|\\blog file\\b).{0,80}\\b(?:past|over|above|at most|up to)\\s+{amount}"
    ]
  },
  {
    "id": "gate-max",
    "subject": "how long a command run under the gate lock may run before it is stopped with every process it started",
    "owner": "project",
    "since": "2026-10-15",
    "value": 30,
    "unit": "minutes",
    "flag": "--max",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bgate\\b.{0,50}\\b(?:stopped|killed|ends|at most|longest|max(?:imum)?)\\b.{0,30}(?<![\\w:.\\x60-]){amount}(?<=\\b(?:minutes?|min|hours?|h))"
    ]
  },
  {
    "id": "gate-wait",
    "subject": "how long a gate waits for its turn of the lock before it gives up, by default",
    "owner": "project",
    "since": "2026-10-11",
    "value": 60,
    "unit": "minutes",
    "flag": "--wait",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bwaits?\\b.{0,40}\\b(?:turn|lock)\\b.{0,40}(?<![\\w:.\\x60-]){amount}(?<=\\b(?:minutes?|min|hours?|h))",
      "^(?!.*\\bruleValue\\().*\\b(?:turn|lock)\\b.{0,40}\\bwaits?\\b.{0,30}(?<![\\w:.\\x60-]){amount}(?<=\\b(?:minutes?|min|hours?|h))"
    ]
  },
  {
    "id": "lead-charter",
    "subject": "what the lead does alone and tells him after, and what stays his, asked one at a time",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "merge pull requests by the rules below",
      "Within it you open the next feature's work session"
    ]
  },
  {
    "id": "memory-feedback-home",
    "subject": "where a rule he states lives: a feedback note of the project's Claude Code memory folder is written only when it names the rule's home in the repository, and js-harness guard refuses it otherwise",
    "owner": "project",
    "scope": "repository",
    "since": "2026-10-22",
    "value": "a declared rule:<id>, or a phrase of AGENTS.md quoted on a line that names it"
  },
  {
    "id": "memory-index-bytes",
    "subject": "the bytes the memory index may hold before a memory hygiene pass is due",
    "owner": "project",
    "since": "2026-10-17",
    "value": 4000,
    "unit": "bytes"
  },
  {
    "id": "memory-pass-days",
    "subject": "the days after a verified memory hygiene pass when the next is due, if a note was written since",
    "owner": "project",
    "since": "2026-10-17",
    "value": 7,
    "unit": "days"
  },
  {
    "id": "mistake-report",
    "subject": "a mistake is reported with what it was, its fix, what prevents it, how it enters the harness and how it is proven later",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/protocols-skill.mjs",
    "phrases": [
      "What stops it from happening again: a check before a line, a line before a protocol.",
      "How it will be proven later that it has not come back"
    ]
  },
  {
    "id": "person-present",
    "subject": "how long after the user last wrote in a session a question is put to them at once with the question tool",
    "owner": "project",
    "since": "2026-10-14",
    "value": 15,
    "unit": "minutes",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:(?:is|was|counts as|stays) (?:present|here)|last wrote|wrote last)\\b.{0,40}\\b(?:within|in the last)\\s+{amount}"
    ]
  },
  {
    "id": "question-context",
    "subject": "every question to the user opens with what it is for: the work it serves and what its answer changes",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "Every question opens with what it is for: the work it belongs to",
      "opening with what it is for (the work it serves and what its answer changes)"
    ]
  },
  {
    "id": "questions-one-place",
    "subject": "every question of the project reaches the user in the orchestrator's chat, through the host's question tool, recorded before it is asked",
    "owner": "sebastian",
    "since": "2026-10-14",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "Every question of the project reaches the user in one place",
      "Ask the user nothing while an orchestrator holds its role"
    ]
  },
  {
    "id": "recap-effort-line",
    "subject": "the lead's recap names each session's effort mode for its kind of work, and why",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "one line a session: its state, the effort mode its kind of work calls for and why;"
    ]
  },
  {
    "id": "reply-four-states",
    "subject": "a reply ends in one of four states, and a question is his decision alone, explained before it is asked",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/protocols-skill.mjs",
    "phrases": [
      "A reply ends in one of four states.",
      "One decision a question, one question at a time, never while work runs.",
      "Before the question, say what a yes covers in everyday words"
    ]
  },
  {
    "id": "report-table",
    "subject": "when the user asks what was done, the lead's status report shows each section that holds items as a table",
    "owner": "sebastian",
    "since": "2026-10-20",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "how much is done, or what you have done, the answer is a report",
      "Show each section that holds items as a table: one row an item"
    ]
  },
  {
    "id": "restart-announce",
    "subject": "before the user restarts or updates, the lead pauses every session at a safe point, and only then tells them in capitals",
    "owner": "sebastian",
    "since": "2026-10-20",
    "path": "bin/lib/manifest.mjs",
    "phrases": [
      "tell the user in capitals: YA PUEDES REINICIAR Y ACTUALIZAR!!!",
      "pause everything at a safe point first, and only then tell them"
    ]
  },
  {
    "id": "review-effort",
    "subject": "the effort a Codex review runs at",
    "owner": "sebastian",
    "since": "2026-10-12",
    "value": "medium",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bcodex\\b.{0,60}\\bat `?{amount}`? effort",
      "^(?!.*\\bruleValue\\().*\\b(?:runs?|is run|set to)\\b.{0,30}\\bgpt-[\\w.-]+`?\\s+at\\s+`?{amount}`?"
    ]
  },
  {
    "id": "review-model",
    "subject": "the one model a Codex review runs on",
    "owner": "sebastian",
    "since": "2026-10-08",
    "value": "gpt-6.1-sol",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:codex|review)\\b.{0,60}\\bon `?(?=gpt-){amount}"
    ]
  },
  {
    "id": "review-part-files",
    "subject": "the most files one part of a Codex review holds",
    "owner": "project",
    "since": "2026-10-09",
    "value": 40,
    "unit": "files",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bparts?\\b.{0,40}(?<!:\\s?){amount}\\s*files\\b"
    ]
  },
  {
    "id": "review-part-lines",
    "subject": "the most changed lines one part of a Codex review holds, by default",
    "owner": "project",
    "since": "2026-10-09",
    "value": 400,
    "unit": "changed lines",
    "flag": "--part-lines",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bparts?\\b.{0,40}\\b(?:up to|at most|holds?)\\s+{amount}\\s*(?:changed )?lines",
      "^(?!.*\\bruleValue\\().*{amount}\\s*(?:changed )?lines\\b.{0,20}\\b(?:a|per|each) part\\b"
    ]
  },
  {
    "id": "review-parts-unflagged",
    "subject": "the most parts a Codex review runs in without being told its count",
    "owner": "project",
    "since": "2026-10-09",
    "value": 6,
    "unit": "parts",
    "flag": "--max-parts",
    "patterns": [
      "^(?!.*\\bruleValue\\().*{amount}\\s*parts\\b.{0,40}(?:--max-parts|\\bunflagged\\b|\\bits flag\\b)",
      "^(?!.*\\bruleValue\\().*\\bwithout\\b.{0,30}--max-parts.{0,30}{amount}\\s*parts"
    ]
  },
  {
    "id": "review-timeout",
    "subject": "how long a Codex review may run before it is stopped as stalled",
    "owner": "project",
    "since": "2026-10-14",
    "value": 30,
    "unit": "minutes",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:review|codex)\\b.{0,50}\\b(?:stalled|stopped|timeout|times? out)\\b.{0,40}(?<![\\w:.]){amount}"
    ]
  },
  {
    "id": "reviewed-commit-lines",
    "subject": "about how many changed lines a commit that will be reviewed stays under",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "changed lines",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bcommits?\\b.{0,50}\\b(?:up to|at most|under|no more than|holds?)\\s+(?:about\\s+)?(?<![\\w:.-]){amount}\\s*changed lines"
    ]
  },
  {
    "id": "rules-live-in-the-harness",
    "subject": "a rule he gives is cemented in the harness where something acts on it, never only in memory",
    "owner": "sebastian",
    "since": "2026-10-22",
    "path": "bin/lib/protocols-skill.mjs",
    "phrases": [
      "A rule is recorded only where something acts on it",
      "A memory note is never its home."
    ]
  },
  {
    "id": "sensor-silence",
    "subject": "how long one sensor of the gate may write nothing before it is stopped and the commit refused",
    "owner": "project",
    "since": "2026-10-16",
    "value": 20,
    "unit": "minutes",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bsensors?\\b.{0,50}\\b(?:silent|silence|writes nothing|wrote nothing)\\b.{0,30}{amount}"
    ]
  },
  {
    "id": "sensor-timeout",
    "subject": "how long one sensor of the gate may run before it is stopped and the commit refused",
    "owner": "project",
    "since": "2026-10-16",
    "value": 60,
    "unit": "minutes",
    "was": [
      {
        "value": 20,
        "until": "2026-10-16"
      }
    ],
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bsensors?\\b.{0,50}\\b(?:stopped|timeout|times? out|after|at most)\\b.{0,30}{amount}"
    ]
  },
  {
    "id": "session-effort",
    "subject": "the effort a session runs at",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "high",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bsessions?\\b.{0,50}\\b(?:at|on) `?{amount}`? effort"
    ]
  },
  {
    "id": "session-model",
    "subject": "the model a session runs on",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "claude-opus-5-5",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bsessions?\\b.{0,50}\\bon `?(?=claude-){amount}"
    ]
  },
  {
    "id": "session-stall",
    "subject": "how long a work session that holds handed work may make no commit, send no notice and run no gate before the board and the lead's heartbeat name it stalled",
    "owner": "project",
    "since": "2026-10-16",
    "value": 60,
    "unit": "minutes",
    "flag": "--stall"
  },
  {
    "id": "session-title",
    "subject": "the shape of the title of a session started with start_session: <code> is the project's own identifier, declared in harness.json \"code\", and the number is the next free one of that code, as js-harness sessions --next-number prints it (a new lead takes ORQ for the number)",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-19",
    "value": "<code> <n> · <purpose>, <code> from harness.json \"code\""
  },
  {
    "id": "sessions-open-in-sidebar",
    "subject": "the one way a session opens another in this repository, so that it is a row in his sidebar: the tools that open one in the app's Routines or in the cloud are refused",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-15",
    "value": "start_session",
    "failure": "session-opened-unseen"
  },
  {
    "id": "subagent-effort",
    "subject": "the effort every sub-agent is launched with",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-07",
    "value": "high",
    "patterns": [
      "^(?!.*\\bruleValue\\().*(?<![\\w/.-])(?:subagents?|sub-agents?|agent calls?|writers?|verifiers?|readers?)\\b(?![\\w-]*\\.\\w).{0,40}\\b(?:runs?|launched|launch(?:es)?|go(?:es)?)\\b.{0,20}\\b(?:at|with) `?{amount}`? effort",
      "^(?!.*\\bruleValue\\()(?!.*\\bgpt-).*\\beffort: \"{amount}\""
    ]
  },
  {
    "id": "subagent-reader-model",
    "subject": "the model of a sub-agent that explores, reviews or verifies",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "claude-opus-5-5",
    "alias": "opus",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:readers?|verifiers?|reviewers?)\\b.{0,50}\\bon `?(?=claude-){amount}"
    ]
  },
  {
    "id": "subagent-writer-model",
    "subject": "the model of a sub-agent that writes scoped code, in this repository",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": "claude-haiku-5-5",
    "alias": "haiku",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bwriters?\\b.{0,50}\\bon `?(?=claude-){amount}"
    ]
  },
  {
    "id": "throughput-backfill-days",
    "subject": "how many closed days back the heartbeat writes a missing throughput snapshot for",
    "owner": "project",
    "since": "2026-10-17",
    "value": 14,
    "unit": "days"
  },
  {
    "id": "throughput-compare-days",
    "subject": "how many days a side a throughput comparison needs before it judges a change",
    "owner": "project",
    "since": "2026-10-17",
    "value": 7,
    "unit": "days"
  },
  {
    "id": "throughput-quiet-days",
    "subject": "how many days after the last recorded throughput review the next is due once the review has gone quiet",
    "owner": "project",
    "since": "2026-10-17",
    "value": 7,
    "unit": "days"
  },
  {
    "id": "throughput-quiet-runs",
    "subject": "how many recorded throughput reviews in a row that found nothing make the review weekly instead of daily",
    "owner": "project",
    "since": "2026-10-17",
    "value": 2,
    "unit": "reviews"
  },
  {
    "id": "wait-every",
    "subject": "how often js-harness wait checks its condition, unless --every says otherwise",
    "owner": "project",
    "since": "2026-10-15",
    "value": 120,
    "unit": "seconds",
    "flag": "--every",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bwait\\b.{0,50}(?<![-\\w])every\\s+{amount}",
      "^(?!.*\\bruleValue\\()\\s*wait\\s.*--every seconds\\W{0,3}{amount}"
    ]
  },
  {
    "id": "wait-for",
    "subject": "how long js-harness wait waits before it says the time ran out, unless --for says otherwise",
    "owner": "project",
    "since": "2026-10-15",
    "value": 480,
    "unit": "minutes",
    "flag": "--for",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\bwait\\b.{0,50}(?<![-\\w])(?:for|up to|at most|gives up after)\\s+{amount}",
      "^(?!.*\\bruleValue\\()\\s*wait\\s.*--for minutes\\W{0,3}{amount}"
    ]
  },
  {
    "id": "work-sessions",
    "subject": "the most work sessions open at one time",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-09",
    "value": 3,
    "unit": "sessions",
    "patterns": [
      "^(?!.*\\bruleValue\\().*\\b(?:at most|up to|no more than)\\s+{amount}\\s*(?:work )?sessions\\b",
      "^(?!.*\\bruleValue\\().*{amount}\\s*work sessions\\b"
    ]
  }
];
