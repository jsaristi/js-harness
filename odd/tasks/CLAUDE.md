# odd/tasks: feature documents

The host loads this file once a session reads or writes a file in this folder, so it reaches a session that opens a
feature document and a writer sub-agent too. It holds only what is bound to this place; each rule it rests on is named
by its id, and `js-harness rules <id>` prints the rule from its one home.

- Each file here is one feature's document, the task contract first. `js-harness contract template` prints its
  shape, `js-harness contract check <doc>` holds it, and `js-harness contract goal <doc>` prints its `/goal` line.
- The order of its sections and when a task is large are in `CLAUDE.md`, "How sessions run".
- The depth pass is written here before the first code commit: `rule:depth-pass`.
- A line he typed is quoted with `js-harness sessions --quote <transcript> <line>`, which refuses a line he did not send.
- Search the documents here before opening a new one, and amend the one that holds the feature: `rule:reuse-first`.
- The document is canonical and engram only mirrors it: `rule:documents-canonical`.
- Read a neighbour before writing the first one of a session: this file arrives after that first read or write.
