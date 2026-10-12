// The rules of this project that are declared, one object each, sorted by id. For a rule with a value
// this is its home: the value is written here, in the unit a person says it in, and nowhere else; the
// code that needs it reads it with `ruleValue` of ./rules.mjs (odd/tasks/rule-hierarchy.md, "How a rule
// is declared"). This file is data and imports nothing. Its text is what `writeRules` of ./rules.mjs
// gives for the list, and a test holds it to that: a rule is changed there, never in another shape.
export const RULES = [
  {
    "id": "codex-review-floor",
    "subject": "the most input tokens a Codex review may cost however small its commit",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": 300000,
    "unit": "input tokens a review"
  },
  {
    "id": "codex-review-rate",
    "subject": "the most input tokens a Codex review may cost for each changed line of its slice, when that is more than the floor",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "input tokens a changed line"
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
    "id": "gate-wait",
    "subject": "how long a gate waits for its turn of the lock before it gives up, by default",
    "owner": "project",
    "since": "2026-10-11",
    "value": 60,
    "unit": "minutes",
    "flag": "--wait"
  },
  {
    "id": "review-effort",
    "subject": "the effort a Codex review runs at",
    "owner": "sebastian",
    "since": "2026-10-08",
    "value": "high"
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
    "id": "reviewed-commit-lines",
    "subject": "about how many changed lines a commit that will be reviewed stays under",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": 1200,
    "unit": "changed lines"
  },
  {
    "id": "subagent-effort",
    "subject": "the effort every sub-agent is launched with",
    "owner": "sebastian",
    "since": "2026-10-07",
    "value": "high"
  },
  {
    "id": "subagent-reader-model",
    "subject": "the model of a sub-agent that explores, reviews or verifies",
    "owner": "sebastian",
    "since": "2026-10-10",
    "value": "claude-opus-5-5"
  },
  {
    "id": "subagent-writer-model",
    "subject": "the model of a sub-agent that writes scoped code, in this repository",
    "owner": "sebastian",
    "since": "2026-10-11",
    "value": "claude-haiku-5-5"
  },
  {
    "id": "work-sessions",
    "subject": "the most work sessions open at one time",
    "owner": "sebastian",
    "since": "2026-10-09",
    "value": 3,
    "unit": "sessions"
  }
];
