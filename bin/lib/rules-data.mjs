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
    "unit": "estimated tokens"
  },
  {
    "id": "codex-review-floor",
    "subject": "the most input tokens a Codex review may cost however small its commit",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 300000,
    "unit": "input tokens a review"
  },
  {
    "id": "codex-review-margin",
    "subject": "how far over its allowance the plan of a Codex review may read and still count as inside it",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-12",
    "value": 5,
    "unit": "percent of the allowance"
  },
  {
    "id": "codex-review-rate",
    "subject": "the most input tokens a Codex review may cost for each changed line of its slice, when that is more than the floor",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "input tokens a changed line"
  },
  {
    "id": "context-pause",
    "subject": "the share of its context window at which a session pauses, writes its state and judges whether what is left fits before the host compacts",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": 88,
    "unit": "percent of the context window",
    "flag": "--context-pause"
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
    "unit": "characters"
  },
  {
    "id": "gate-log-command",
    "subject": "the longest command a line of the gate log holds, since what follows gate -- can hold a secret",
    "owner": "project",
    "since": "2026-10-15",
    "value": 120,
    "unit": "characters"
  },
  {
    "id": "gate-log-size",
    "subject": "the size past which the gate log is renamed over its older file, so the log stays near a megabyte",
    "owner": "project",
    "since": "2026-10-15",
    "value": 512,
    "unit": "KiB"
  },
  {
    "id": "gate-max",
    "subject": "how long a command run under the gate lock may run before it is stopped with every process it started",
    "owner": "project",
    "since": "2026-10-15",
    "value": 30,
    "unit": "minutes",
    "flag": "--max"
  },
  {
    "id": "gate-wait",
    "subject": "how long a gate waits for its turn of the lock before it gives up, by default",
    "owner": "project",
    "since": "2026-10-11",
    "value": 60,
    "unit": "minutes",
    "flag": "--wait"
  },
  {
    "id": "person-present",
    "subject": "how long after the user last wrote in a session a question is put to them at once with the question tool",
    "owner": "project",
    "since": "2026-10-14",
    "value": 15,
    "unit": "minutes"
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
    "id": "review-effort",
    "subject": "the effort a Codex review runs at",
    "owner": "sebastian",
    "since": "2026-10-12",
    "value": "medium"
  },
  {
    "id": "review-model",
    "subject": "the one model a Codex review runs on",
    "owner": "sebastian",
    "since": "2026-10-08",
    "value": "gpt-6.1-sol"
  },
  {
    "id": "review-part-files",
    "subject": "the most files one part of a Codex review holds",
    "owner": "project",
    "since": "2026-10-09",
    "value": 40,
    "unit": "files"
  },
  {
    "id": "review-part-lines",
    "subject": "the most changed lines one part of a Codex review holds, by default",
    "owner": "project",
    "since": "2026-10-09",
    "value": 400,
    "unit": "changed lines",
    "flag": "--part-lines"
  },
  {
    "id": "review-parts-unflagged",
    "subject": "the most parts a Codex review runs in without being told its count",
    "owner": "project",
    "since": "2026-10-09",
    "value": 6,
    "unit": "parts",
    "flag": "--max-parts"
  },
  {
    "id": "review-timeout",
    "subject": "how long a Codex review may run before it is stopped as stalled",
    "owner": "project",
    "since": "2026-10-14",
    "value": 30,
    "unit": "minutes"
  },
  {
    "id": "reviewed-commit-lines",
    "subject": "about how many changed lines a commit that will be reviewed stays under",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "changed lines"
  },
  {
    "id": "sensor-timeout",
    "subject": "how long one sensor of the gate may run before it is stopped and the commit refused",
    "owner": "project",
    "since": "2026-10-15",
    "value": 20,
    "unit": "minutes"
  },
  {
    "id": "session-effort",
    "subject": "the effort a session runs at",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "high"
  },
  {
    "id": "session-model",
    "subject": "the model a session runs on",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "claude-opus-5-5"
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
    "value": "high"
  },
  {
    "id": "subagent-reader-model",
    "subject": "the model of a sub-agent that explores, reviews or verifies",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-10",
    "value": "claude-opus-5-5",
    "alias": "opus"
  },
  {
    "id": "subagent-writer-model",
    "subject": "the model of a sub-agent that writes scoped code, in this repository",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-11",
    "value": "claude-haiku-5-5",
    "alias": "haiku"
  },
  {
    "id": "wait-every",
    "subject": "how often js-harness wait checks its condition, unless --every says otherwise",
    "owner": "project",
    "since": "2026-10-15",
    "value": 120,
    "unit": "seconds",
    "flag": "--every"
  },
  {
    "id": "wait-for",
    "subject": "how long js-harness wait waits before it says the time ran out, unless --for says otherwise",
    "owner": "project",
    "since": "2026-10-15",
    "value": 480,
    "unit": "minutes",
    "flag": "--for"
  },
  {
    "id": "work-sessions",
    "subject": "the most work sessions open at one time",
    "owner": "sebastian",
    "scope": "repository",
    "since": "2026-10-09",
    "value": 3,
    "unit": "sessions"
  }
];
