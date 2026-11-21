# docs: the plan, the map and the records

The host loads this file once a session reads or writes a file under `docs/`, `docs/host-updates/` included. It holds
only what is bound to this place; each rule it rests on is named by its id, and `js-harness rules <id>` prints the
rule from its one home.

- `docs/ROADMAP.md` is the plan and `docs/SPEC.md` the map; `docs/origin.md` is frozen and is never edited.
- A committed document here is canonical, and engram only mirrors it: `rule:documents-canonical`.
- A mistake is told as `rule:mistake-report` says and enters `docs/FAILURES.md` as a `- Seen:` line;
  `js-harness failures` reads that file.
- `docs/RULES.md` is generated: change a rule with `js-harness rules change <id>`, and `js-harness rules render`
  writes the file; a hand edit fails `js-harness rules check`.
- The rows of a `docs/host-updates/` review are drafted by `js-harness host-watch draft` and held by
  `js-harness host-watch check`.
- Search the documents here before adding one, and amend the one that holds the subject: `rule:reuse-first`.
