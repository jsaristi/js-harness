# bin: the commands and their modules

The host loads this file once a session reads or writes a file under `bin/`, `bin/lib/` included, so it reaches a
writer sub-agent that gets no root file. It holds only what is bound to this place; each rule it rests on is named by
its id, and `js-harness rules <id>` prints the rule from its one home.

- Before a new command, option or module, search with `codegraph_explore` and `js-harness rules`, and amend the one
  that does it: `rule:reuse-first`.
- What a command, its test and its header comment look like is in `AGENTS.md`, "What good looks like"; the
  conventions are the tests `bin/conventions-*.test.mjs`, run with `node --test bin/conventions-*.test.mjs`.
- A value a command reads is a declared rule, read with `ruleValue('<id>', '<unit>')` (`bin/lib/rules.mjs`);
  `js-harness rules check` finds every read and fails one of no declared rule.
- A module that builds a text an agent is sent is a source of `rules coverage`: a new one goes into
  `CUT_MESSAGE_SOURCES` (`bin/lib/rules-sources.mjs`), never into `MESSAGE_SOURCES`.
- A rule changes only through `js-harness rules change <id>`, on a rule/ branch: `rule:rules-live-in-the-harness`.
- `js-harness check` is the gate the commit runs; read a FAIL row's next step before running anything again.
