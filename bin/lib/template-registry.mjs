// The registry of templates (odd/tasks/templates.md, "The registry"): one entry an output that reaches the user
// again and again, with its five parts. This file is data and imports nothing. Its text is what `writeRegistry` of
// ./template.mjs gives for the list, and a test holds it to that: `js-harness template new` adds an entry, and a
// person changes one in the same shape.
export const TEMPLATES = [
  {
    "id": "question",
    "kind": "rendered",
    "surface": "ask",
    "plantilla": {
      "what": "the questions to the user",
      "when": "when a decision is his, recorded by notify --kind question",
      "looks": "templates/question/sample.json",
      "where": "the question tool of the lead's chat"
    },
    "sample": {
      "path": "templates/question/sample.json",
      "sha256": "9156a6f763ca4960295a9cfeedf2c0413d9992fb075dbf8f3fae25d2bd77c265",
      "source": "0f71b2c6:17978"
    },
    "records": "templates/question/records.json",
    "render": "js-harness template ask <n>",
    "module": "bin/lib/template-question.mjs",
    "exports": {
      "render": "render",
      "admit": "admit"
    },
    "tests": {
      "file": "bin/lib/template-question.test.mjs",
      "golden": "template:question golden",
      "refusal": "template:question refuses a hand-made one"
    },
    "draft": false
  }
];
