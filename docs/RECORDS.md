# Records

The fields of each record the harness writes. Where each one lives, who writes it and who reads it is the table
"Where state lives" in `docs/SPEC.md`, the one map of records; this file holds only the fields, one section per row
of that table, named as its row, with a subsection for each variant of a record that holds several (each file of a
folder, each kind of line). `node workshop/js-harness-workshop.mjs docs check` fails where a row has no section here or a section names no row,
and where the table drifts from the source (`workshop/lib/docs-records.mjs`).

The fields were written from each writer's code, which each section names by file and function: that function is
where an auditor checks them, since no schema holds the fields and nothing checks them against the code.

## The project's settings

`harness.json`, at the repository's top, is the committed file that opts a project into the harness and holds its settings. `bin/lib/project.mjs` `writeProject` (through `initProject`) writes it once as a JSON object indented by two spaces with a final line end. `bin/functions.mjs` `setSwitch` (through `functionsMain`, `functions set`) changes one switch in place and keeps the file's indent, line ends and byte-order mark. `syncProject` reads the pin and never writes the file.

### Keys `init` writes

- `version`: string, a semver version without a leading `v`; the js-harness version the project pins. `readPin` refuses a value that is not a non-empty semver string. If the key is absent, the project has no pin and its `harness.json` holds settings alone.
- `code`: string of capitals and digits, the project's identifier that its sessions' titles start with (`codeOfName`: the initials of up to four words of the folder's name, or the first two letters of a one-word name; never `ORQ`). It is left out when the folder's name has no ASCII letter or digit. Read by `bin/lib/sessions.mjs` `projectCode`.
- `reply`: the reply check (`bin/lib/reply.mjs`). `init` writes `true`, which gives the English words of `DEFAULT_REPLY`. `false` or no key turns the check off. An object `{ states, labels }` replaces any of those words: `states` takes `working`, `decision`, `question`, `cut` and `finished`, `labels` takes `what`, `where` and `effect`, and each value is a non-blank string.
- `functions`: object of switch names to values. It is written only by `init --preset` (`bin/lib/functions.mjs` `PRESETS`: `complete`, `lean` and `custom` each set `codexReview` and `lensReview` to `on`; `lean` also sets `codeMap` to `off`) or by `functions set`. The switches (`SWITCHES`) are `codeMap` (`auto`, `on-demand`, `always`, `off`), and `languageServer`, `codexReview`, `pushUnasked`, `lensReview` and `engramPlugin` (each `auto`, `on`, `off`), and `remoteGate` (`auto`, `private`, `on`, `off`: whether the tree of a commit being made may be pushed for its gate, read by `bin/lib/ci-gate.mjs` `remoteGateKeeps`). A missing switch takes its fallback, `auto`. An unknown name, or a value its switch does not take, is an error, and the switch is then read as its strict value.

### Keys a project writes by hand

- `sensors`: object of names to non-empty command strings, the commands the gate runs (`bin/check.mjs` `discoverSensors`). An empty object declares none. With no key, the gate uses the `test`, `lint` and `typecheck` scripts of `package.json`.
- `documents`: array of paths from the top, with forward slashes; one ending in `/` is a folder. A commit that touches only these runs no sensor (`discoverDocuments`).
- `documentSensors`: object of names to commands, run on a commit that touches only documents. It needs `documents` (`discoverDocumentSensors`).
- `sameTree`: the string `"skip"`, its only value: a tree a gate already passed is not run again (`discoverSameTree`).
- `sensorsInWsl`: boolean; `true` lets the sensors of a gate's turn run in WSL2 where the machine opts in (`discoverSensorsInWsl`).
- `exactTests`: `"shadow"` or `"skip"`, how the tests sensor runs with exact test selection (`discoverExactTests`).
- `depthPassSince`: a day written `YYYY-MM-DD`. Feature documents opened on or after it must hold a `## Depth pass` (`bin/lib/depth-pass.mjs`, read by `bin/contract.mjs` `depthPassFor`).
- `templates`: boolean; `true` turns the template gate on (`bin/template.mjs` `templatesOn`, `bin/reply.mjs`).

## The clone's Claude keys

`.claude/settings.local.json` holds Claude's settings for this clone alone (git does not track it). `bin/lib/project-apply.mjs` `applySettings` writes the keys that `planFunctions` asks for out of `SETTINGS_KEYS`, never overwrites a value someone else put there, and records each key in the clone's manifest so that `uninstall` can remove it. Only these keys are the harness's:

- `outputStyle`: string `"js-harness"` (`OUTPUT_STYLE_NAME`), always held.
- `permissions.deny`: array of strings, always held. The harness adds the 24 entries of `bin/lib/deny-paths.mjs` `PERMISSIONS_DENY`: four `Bash(rm -rf …)` and `Bash(sudo rm -rf …)` wipes of `/` and `~`, and `Read(<place>)` and `Edit(<place>)` for each secret place (`.env`, `.env.*`, `.ssh/*`, `.credentials/*`, `Library/Keychains/*`, `.aws/credentials`, `.config/gh/hosts.yml`, `**/*.pem`, `**/*.key`, `**/secrets/*`). Other entries already in the list are kept.
- `env.CODEGRAPH_NO_PROMPT_HOOK`: string `"1"`, held where the `codeMap` switch resolves to `off` or `on-demand`, so codegraph does not paste the code map into every prompt.
- `enabledPlugins["typescript-lsp@claude-plugins-official"]`: `false`, held where the `languageServer` switch resolves to `off`.

## The project's instructions

`AGENTS.md` and `CLAUDE.md` at the repository's top are the instructions loaded on every turn: Codex reads `AGENTS.md`, and Claude reads `CLAUDE.md`, which imports it. `bin/lib/project.mjs` `writeProject` (through `initProject` and `syncProject`) writes either file only when the project has none, from `bin/lib/project-template.mjs` `agentsFile` and `claudeFile`. `syncTemplateBlock` renders the harness's marked block again on every sync while nobody has edited it. `bin/lib/claude-import.mjs` `addImport` adds the import to a `CLAUDE.md` the project already had.

### AGENTS.md

- Opening comment: `<!-- Written by \`js-harness init\`. This file loads on every turn: keep it short. -->`.
- `# <folder name>`, then `## What this project is` and `## How it works`, each holding a placeholder in angle brackets for the project to fill in.
- The marked block: an opening mark `<!-- js-harness block <12 hex>: sync renders the lines to the end mark again while they are unedited -->`, the harness's lines, and `<!-- js-harness block end -->`. The 12 hex digits open the sha256 of the lines with LF line ends. `renderBlock` reports the block as `edited` once the lines no longer match that hash, and leaves it alone. The lines are the whole block, `templateBlock`, or with the split, `agentsBlock`.
- `## Constraints`: a placeholder constraint with its reason, and a line pointing to `docs/rules.json`.
- `check` holds the file to the token budget of `rule:agents-budget`.

### CLAUDE.md

- Opening comment, `<!-- Written by \`js-harness init\`. … -->`.
- `@AGENTS.md`: the import line. `addImport` puts it, plus an empty line, at the top of an existing file. It does so only where git can give the file back byte for byte, and keeps the file's line ends and any UTF-8 byte-order mark. `bin/lib/claude-import.mjs` `importsAgents` recognises the import as a line of its own outside a code fence.
- The marked block, as in `AGENTS.md`, holding `claudeBlock` once the project has the split. `bin/lib/claude-md-budget.mjs` holds the file to `rule:claude-md-budget`.

## The project's own rules

`docs/rules.json` is a project's own list of rules, written by hand and never by the harness. `bin/lib/project-rules.mjs` `parseProjectRules` reads it, and `checkProjectRules` (through `bin/lib/project-rules-read.mjs` `readProjectRules`) holds it to its homes, its sensors, `docs/FAILURES.md` and its own state at `HEAD`. The fields of each rule are checked by `bin/lib/rules.mjs` `readRules` with `project: true`.

- `format`: integer `1`. A higher number is refused by name.
- `rules`: array of rule objects sorted by `id`. A rule present at `HEAD` cannot be deleted, only retired. Each rule holds:
  - `id`: string of lower-case words joined by hyphens, each word starting with a letter.
  - `subject`: non-empty string, what the rule is about.
  - `owner`: `"project"`, or absent.
  - `since`: day `YYYY-MM-DD`.
  - One body, exactly:
    - prose: `path` (a repository path with forward slashes) and `phrases` (a non-empty array of strings, each at least `rule:control-phrase-min` characters, all of which `path` must hold);
    - `sensor`: the name of a sensor that `check` runs in the project;
    - `retired`: day `YYYY-MM-DD`, with `successors`, an array of the ids that replace it.
  - `failure` (optional): the id of an entry of `docs/FAILURES.md`.
  - `differs` (optional): string.
  - `review` (optional): day `YYYY-MM-DD`.
  - `control` (optional until the project's coverage baseline, then required on every live rule): the control of `bin/lib/rules-coverage.mjs` `controlFaults`, in the shape of the harness's register (see "Rules").
  - The keys `scope`, `alias`, `flag`, `value`, `unit`, `was`, `patterns` and `row` are refused, each with its reason (`HARNESS_ONLY`).

## The plan

`docs/ROADMAP.md` is the project's living plan, written by hand; `js-harness onboard template roadmap --write` writes its skeleton (`bin/lib/onboard.mjs` `roadmapTemplate`). `docs/origin.md` is the frozen pre-plan the roadmap came from (`originTemplate`). The commands read only these headings:

### docs/ROADMAP.md

- `## Checklist`: one `### <phase>` heading per phase, followed by its steps, each a `- [ ]` or `- [x]` checkbox. The section ends at the next `## ` heading. A checkbox before the first `###` counts under `(unassigned)`. `bin/lib/progress.mjs` `parseRoadmap` counts each phase's steps done and in total, for `progress`, `report` (`bin/lib/report.mjs` `mapOf`), `stretch` and the backup's summary.
- `## <name> plan`: a plan section, such as `## F8 plan`. Each of its steps is a `### <id> <title>` heading whose id is the first word when it reads `S<number>…`, and which holds a `- **State:** <text>` bullet. That bullet is read for the state it opens with (`done`, `built`, `applied`, `in progress`, `started`, `designed`, `to do`, `not started`, or else `other`) and for the `odd/tasks/<feature>.md` documents and backticked names it cites (`bin/lib/report-pages.mjs` `planOf`). A heading with no `State` bullet is not a step.
- For a project that went through onboarding, `onboard check` (`bin/lib/onboard.mjs` `roadmapFindings`) also reads:
  - `## Phases`: a table with a `Phase` column and a `Done when` column, one row per Checklist phase, each Done when naming a command written `` `<command>` exits 0 ``;
  - `## Next`;
  - `## Decided`: the accepted ADRs, `ADR-<nnnn>`;
  - `## Advice mode`: one line, `Teaching: on|off · Mode: full|fast · Level: A:<id> new|some|experienced, …`;
  - `## Open decisions`: the pre-plan's `OD<n>` ids still open.

### docs/origin.md

- Free prose, frozen once onboarding closes.
- `onboard check` asks for the sections `Status`, `Goal`, `Why`, `What exists`, `Decisions already made`, `Stack and architecture`, `Owner steps`, `Principles`, `Phases`, `Not built`, `Risks`, `Open decisions` and `Sources` (`ORIGIN_SECTIONS`).
- It reads the `Phase` column of the `## Phases` table and the `- OD<n>` items of `## Open decisions` against the roadmap.

## A feature

`odd/tasks/<feature>.md` is the document of one piece of large work, written by hand by the session that holds it and mirrored in engram under the topic `odd/<feature>/tasks`. Its head is the task contract of `bin/lib/contract.mjs` `CONTRACT_TEMPLATE`. `parseContract` reads each `## ` section outside a fence, with HTML comments stripped, and the readers take these parts:

- `## Goal`: one sentence. A document is a contract when it has this heading (`isContract`).
- `## Why`, `## In scope / Out of scope`, `## Constraints`, `## Ask me before`: required and non-empty (`validateContract`, for `contract` and `check`'s `contracts` row).
- `## Done when`: list items. An item that opens with an inline code span and says `exits 0` is a command `/goal` runs; any other item is a check for a person (`doneWhen`). At least one command is required, and none may still be a `<placeholder>`; on Windows, where it runs in cmd.exe, none may use `$( )`, a backtick, a `$VAR` or single quotes outside the double-quoted code of `bash -c`, `sh -c`, `pwsh` or `powershell` `-c`/`-Command`, or `node -e`/`-p` (`cmdShellGap`).
- `## Effort` (optional, legacy): `medium` or `high`.
- `## Depth pass`: required for documents opened on or after `harness.json` `depthPassSince`. It holds the items `1. Method`, `2. Raw material`, `3. The bar`, `4. Refutation` and `5. Request` in that order, a `Verdict: supports|refutes` line, and an `Adds: none` (or `Adds: … (question <n>)`) line (`bin/lib/depth-pass.mjs` `depthPassText`, `verdictOf`).
- `## Specs`: numbered items `<n>. …` quoting the owner's words. The depth pass's bar refers to them, and the Codex review prompt carries the section (`bin/lib/codex-review-prompt.mjs`).
- `## Tasks`: checklist lines `- [ ] <id> …` or `- [x] <id> …`, where `<id>` is one to six letters, a number and an optional letter (`bin/lib/sessions.mjs` `taskId`). An optional `(kind: design|build|verify|docs)` sets the task's mode (`tasksOf`, `taskModes`). A table with `ID` and `Status` columns counts too, a row being done when its status starts with `done` (`bin/lib/progress.mjs` `parseFeature`).
- `# <title>`: the first level-1 heading titles the feature on `progress` and the board (`parseFeature`, `bin/lib/sessions.mjs` `planOf`).
- `## Next step` (optional): every non-blank line, which the board compares between readings (`planOf`).
- `## Log`: `L<n>` items, the owner's request and corrections; no command parses it in a feature document.

## Onboarding

Onboarding is the conversation that produces a new project's approved pre-plan and roadmap. `bin/onboard.mjs` `onboardMain` (`template feature --write`) writes `odd/tasks/onboarding.md` from `bin/lib/onboard.mjs` `featureTemplate`, and `writeAdr` (`template adr <slug> --write`) writes the next numbered decision record from `adrTemplate`. The session fills both by hand, and `onboard check` (`checkOnboarding`) reads them.

### odd/tasks/onboarding.md

- `## Goal`, `## Why`, `## Done when`, `## In scope / Out of scope`, `## Constraints`, `## Ask me before`: the task contract.
- `## What exists`: free text, each item with its evidence.
- `## Setup`: lines `- <Key>: <value>` for the keys `Kind`, `Size` (`small|large (L<n>)`), `Level`, `Teaching` (`on`/`off`, with `(L<n>)`), `Mode` (`full`, or `fast (L<n>)`) and `Areas` (`+<area> (L<n>)`, separated by commas) (`bin/lib/profiles.mjs` `setupValues`).
- `## Interview`: the eleven topic checkboxes `- [ ] <n> <topic>` of `TOPICS` and the closing `- [ ] S Summary given and deepening questions answered`. A topic is checked with `— answered (L<n>)`, `— deduced (L<n>)`, `— confirmed (L<n>)` or `— unknown (OD<n>)`.
- `## Advice`: one checkbox per area `A:<id>`, with `— proposed|asked|the owner's, ADR-<nnnn> (L<n>)` or `— open (OD<n>)`. In fast mode it also holds a `- Given up (fast, L<n>): …` line.
- `## Tasks`: `O1` to `O6` (repository read, pre-plan written, approved, roadmap written, approved, closed). An approval records `<name> sha256:<12 hex>`, where the name is `answers`, `origin`, `roadmap` or `adrs`, as `onboard hash` prints it, and the Log line of the owner's yes.
- `## Reviews`: items opening `Pre-plan round <n>:` or `Roadmap round <n>:`.
- `## Log`: `- L<n> <date> …` items, the owner's words as written.

### docs/adr/<nnnn>-<slug>.md

- `<nnnn>`: four digits, the next free number.
- While a number is being claimed, a `docs/adr/.<nnnn>.claim` file exists; it is removed once the ADR is written.
- `# ADR-<nnnn>: <decision>`, then these sections:
  - `## Status`: first line, e.g. `proposed (L<n>); accepted with the pre-plan (O3)`, or one starting `superseded` or `withdrawn`;
  - `## Area`: `A:<id>`;
  - `## Context`, `## Decision`, `## Alternatives considered`, `## Consequences`;
  - `## Sources`: one item each, `<URL> — <what it says> (read <YYYY-MM-DD>)`, `profile: <kind> A:<id> (js-harness <version>)` (fast mode only), or `not read: <why> (<YYYY-MM-DD>)`;
  - `## The owner's words`: optional.
- `readAdr` reads `Area`, the first line of `Status`, and the items of `Sources`.

## Rules

This record is the harness's own list of rules, its sources and its rendering, plus the coverage register that ties each rule to a control. `js-harness rules change` (`bin/lib/rules-change-run.mjs` `changeRule`), run on a `rule/` branch, writes a rule's declaration through `bin/lib/rules.mjs` `writeRules`, its source through `bin/lib/rules-change.mjs` `sourceOf`, and `docs/RULES.md` through `renderList`, all together. `bin/lib/rules-coverage.mjs` `writeCoverage` writes the register.

### bin/lib/rules-data.mjs

`export const RULES = [...]`: one object per rule, sorted by `id`, in the exact text `writeRules` gives.

- `id`: string of lower-case words joined by hyphens.
- `subject`: string with no digit, a label of what the rule is about.
- `owner`: `sebastian` or `project`.
- `scope` (optional): `repository`, for a rule in force only in this repository (read with `ruleHere`).
- `since`: day `YYYY-MM-DD`.
- One body:
  - a value: `value` (a number, or a string) with `unit` (a string, required with a number), optional `flag` (`--name`, which overrides the value for one run) and optional `alias` (one short lower-case word a host passes);
  - prose: `path` and `phrases` (strings at least `rule:control-phrase-min` characters long, which the file must hold);
  - a retirement: `retired` (a day) and `successors` (an array of ids).
- `was` (optional, with a value or a retirement): earlier values `{ value, until: YYYY-MM-DD }`, newest first, all numbers or all strings.
- `patterns` (optional): regular expressions, each holding `{amount}`, that find the value written elsewhere.
- `row` (optional): `{ refuses: <day> }` or `{ reports: <reason>, since: <day> }`.
- `failure`, `differs`, `review` (optional): an id of `docs/FAILURES.md`, a string, a day.

### docs/rule-sources.json

An object keyed by rule id. Each value has one of two shapes:

- `{ kind: "design", path }`: the repository file the rule comes from.
- `{ kind: "words", quotes, reading, accepted, checked }`: the owner's words.
  - `quotes`: a non-empty array of `{ quote, date: YYYY-MM-DD, session: <transcript id>, line: <positive integer> }`, each read from its transcript (`bin/lib/rules-change.mjs` `quotationOf`).
  - `reading`: string, how his words were read.
  - `accepted`: string, where he accepted that reading.
  - `checked`: `{ date: YYYY-MM-DD, by: "session" | "command" }`.

`bin/lib/rules-check.mjs` holds the shapes.

### docs/RULES.md

Rendered by `renderList`; not to be edited.

- `# Rules`, then a note, then the line `Hash \`<12 hex>\`. In force: <n> (<n> of Sebastián, <n> of the project). Retired: <n>.` (`rulesHash`).
- `## Sebastián's`, `## The project's`, `## Retired`: one `### <id>` block per rule, or `None.`.
  - A rule with a value gives its subject and amount, then `- Read by:` and its since line.
  - A rule in prose gives its subject and quoted sentence, then `- Home:` and its since line.
  - A retired rule gives the day it was retired, its successors and `- Source:`.

### bin/lib/rules-coverage-data.mjs

`export const COVERAGE = {...}`, in the exact text `writeCoverage` gives.

- `baseline`: day `YYYY-MM-DD`, the day the coverage debt was seeded.
- `controls`: object of rule id to its control, sorted by id. A control is one object, or an array of them that each name their obligation in `of`. By `level` (`LEVEL_KEYS`):
  - `check`: `test` (the path of the test) and `break` (`{ path, find, replace }`, a planted break the test must catch);
  - `eval`: `cases`, task names in `evals/tasks`;
  - `line`, `protocol` and `measured`: `path` and `phrase`, at least `rule:control-phrase-min` characters;
  - `owed`: `since`, a day no later than `baseline`.
- `cases`: sorted array of eval case names owed since the baseline.
- `messages`: sorted array of source files whose messages are owed.
- `sources`: object of file path to its spans of directive text that no rule holds, in order. Each span is a 12-hex hash when owed, or `{ hash, context }` when declared context, with the reason.

## Failures

`docs/FAILURES.md` is the project's register of what went wrong, each entry tied to the control that corrects it. Sessions write it by hand, adding a `- Seen:` line for each sighting. `bin/lib/project.mjs` `writeProject` (through `initProject`) writes it empty from `bin/lib/project-template.mjs` `FAILURES_TEMPLATE` when the project has none. `bin/lib/failures.mjs` `parseRegister` reads it for `failures` and `check`'s `failures` row. No state is written in the file: `entryState` computes each entry's state from its fields, one of `STATES`: `once`, `repeated`, `owed`, `owed, stale`, `measured`, `measured, seen again`, `measure lost`, `controlled`, `control lost`, `seen again`.

- `## Classes`: list items `` - `<id>` <what it means> ``, each id declared once.
- `## Entries`: `### <id>` entries in alphabetical order of their ids, each id lower-case words joined by hyphens. Each entry opens with free text saying what happened, followed by `- <Field>: <value>` lines (an indented line continues the field above it):
  - `Class`: exactly one, a declared class id.
  - `Aka` (any number): another name of the failure.
  - `Seen` (at least one): `<YYYY-MM-DD> — <where the evidence is> — <a note>`, cut at the first two ` — `. Two lines with the same date and evidence count as one sighting (`sightings`).
  - `Control` (at most one), in one of these forms:
    - `owed — <document> — "<phrase>"`;
    - `<check|line|protocol> — <path> — "<phrase>" — since <YYYY-MM-DD>`;
    - `measured — <path> — "<phrase>" — since <YYYY-MM-DD>`, whose phrase holds its date.
    In every form the path is not the register itself, a check is never a `.md` file, and the phrase is at least `rule:control-phrase-min` characters.
  - `Proof` (any number): text.
  - `Was` (any number): a control that left.

## Flaky tests

`docs/FLAKY.md` is the committed ledger that quarantines test files which failed and then passed when rerun alone. It is written by hand, and `bin/lib/flaky.mjs` `parseLedger` reads it for `check`'s `flaky` row (`ledgerRow`) and its rerun (`judgeRerun`). Text before the first entry is for people and is skipped. Each entry is a `### <test file>` heading, a path from the repository's root that must be a test file of the repository, with one each of:

- `Owner`: non-empty text, who holds the quarantine.
- `Expires`: day `YYYY-MM-DD`. The entry counts through that day, and afterwards its file blocks again.
- `Failure`: the id of an entry of `docs/FAILURES.md`.

## This specification

`docs/SPEC.md` is the harness's specification, written by hand. `bin/lib/spec.mjs` `parseSpec` and `specFindings` hold it to its shape for `check`'s `spec` row, and the `docs` row and `node workshop/js-harness-workshop.mjs docs` read its capabilities and its record table.

### Capabilities

- `## Capabilities`: each `### <title>` heading under it is a capability. Each capability has the six fields `**Problem:**`, `**Requirement:**`, `**Reason:**`, `**Proof:**`, `**Discarded:**` and `**Today:**`, each written once and non-empty. A field runs until the next field, a blank line or a heading, and lines inside a fence are text.
- `Proof`: at least one command in backticks. Every `.mjs`, `.js` or `.md` file a command runs must exist.
- `Today`: items in backticks, each one of:
  - a file of the repository, with an optional `:line` or `:from-to`;
  - `js-harness <command>`;
  - an id of the machine manifest;
  - a path under `~/`.

  In the harness's own repository, every command of the dispatcher, every manifest entry, and `~/.js-harness/manifest.json` and `~/.claude/settings.json` must be claimed by some capability's Today. `workshop/lib/docs-plan.mjs` `capabilityFiles` and `workshop/lib/docs-cross.mjs` also read Today, Proof and the `odd/tasks/` documents a capability cites.

### Where state lives

The table under the `### Where state lives` heading, with the columns `Record`, `Where`, `Written by` and `Read by` (`workshop/lib/docs-records.mjs` `parseRecordTable`).

- `Record`: the record's name, matched by a section of `docs/RECORDS.md`.
- `Where`: code spans, a folder followed by the patterns of its children, with placeholders written `<…>`.
- `Written by`: code spans, each `bin/….mjs` file followed by the functions it names. The words `by hand` mark a record no source file needs to name.
- `Read by`: free text.

## The audit entry

`docs/README.md` and `docs/RECORDS.md` are the documents an auditor starting cold reads first; sessions write both by hand. `node workshop/js-harness-workshop.mjs docs` and `check`'s `docs` row read them.

### docs/README.md

The index table under `## Index`, up to the next `## ` heading. Its columns are `Document`, `Status`, `Superseded by, or where its result lives` and `What it is`; `workshop/lib/docs-entry.mjs` `parseIndex` reads the first three.

- `Document`: a path in backticks. Every file and folder directly under `docs/` (a folder with its closing `/`) has exactly one row. A tracked file inside one of those folders may have its own row, which overrides its folder's.
- `Status`: `live`, `frozen`, `historical` or `closed` (`STATUSES`).
- `Superseded by, or where its result lives`: required unless the status is `live` or `frozen`.
- `What it is`: free text, not parsed.

`workshop/lib/docs-plan.mjs` reads the file as the preamble of every reading slice after the first.

### docs/RECORDS.md

- `## <record>`: one section per row of the table in `docs/SPEC.md`, named exactly as its `Record` cell (`workshop/lib/docs-records.mjs` `parseRecordSections`, `recordFindings`). A section that matches no row fails, as does a row with no section.
- `### <variant>`: a file or kind of the record above it. The fields below it are not checked against code.

## Host updates

`docs/host-updates/` holds the in-depth reviews of each Claude Desktop update and the evidence beside them. `workshop/bin/host-watch.mjs` `hostWatchMain` runs the subcommands that make them: `draft` prints a review file and writes its excerpts, `tools --record` writes a tool list, and `brief` prints the brief of the session that reviews an update.

### claude-desktop-<desktop>.md

The review file. `draft` prints it from `workshop/lib/host-watch.mjs` `draftReview`, the session saves it under this name, and `check` holds it to its span (`checkReview`).

- `# Claude Desktop <version>`, then the line `Code tab CLI: <version>`.
- The line `Desktop tool list: baseline|diff|owed`, with optional words after it.
- A table with the columns `Change`, `Decision`, `Reason`, `Map row`, `Evidence`, `Windows` and `Phone`, one row per changelog entry of the span:
  - `Decision`: `adopt`, `adapt` or `ignore`. The draft writes `?` for a decision still to be made.
  - `Reason`: non-empty text.
  - `Map row`: the rows of the proposal's map it touches, or `—`.
  - `Evidence`: the entry's id, `desktop|code <version> #<n>`. A version with no changelog entry gets the id `<desktop|code> <version> none`. Each id appears exactly once.
  - `Windows` and `Phone`: `checked: <how>`, `unknown`, `unknown (named)` or `n/a`.
- `## To classify by hand`: `- <id>: <text>` items, which must be empty when the review is done (`handListCount`).
- `## Sources`: each changelog with its span, `- <changelog URL> (<from> to <to>)`.

### sources/claude-desktop-<desktop>.<key>.md

- `<key>` is `desktop` or `code`.
- Each file holds the excerpt of that changelog over the update's span, as published (`cutSpan`).
- `draft --sources <dir>` writes it.
- `check` reads it to find the entries a review must hold.

### tools-<surface>.txt

`tools --record` writes this list of the host's tools, read on the `desktop` or `background` surface, from `renderToolList`. `parseToolList` reads it back for the next diff.

- Four `#` lines:
  - `# surface: <surface>`;
  - `# Claude Desktop <version>, Code tab CLI <version>`;
  - `# recorded: <YYYY-MM-DD>`;
  - `# provenance: …`.
- Then the tool names, one per line, sorted, each once.

### host-watch-<desktop>.md (the brief)

The brief of the background session that reviews an update. `brief` prints it from `renderBrief`, and the heartbeat's line redirects it to `~/.js-harness/background/host-watch-<desktop>.md` (`hostWatchTick`).

- `# <session title>`.
- The update's frozen span.
- `## Steps`: numbered steps.

`hostWatchTick` also writes `~/.js-harness/channel/host-watch/<project>/asked`, which holds one ISO time: the last time the heartbeat read the host.

## The idea watch's record

`odd/tasks/gentle-ai-update-check.md`, under its `## Releases read` heading, holds what the idea watch read of each stable gentle-ai release (`odd/tasks/idea-watch.md`). A session writes it by hand from what `node workshop/js-harness-workshop.mjs idea-watch draft` prints (`workshop/lib/idea-watch.mjs` `draftRelease`); `lastRead` reads it for `idea-watch status` and `doctor`'s `idea-watch` row.

- A batched line `- v<version> (from v<version>, read <YYYY-MM-DD>): ignore; <n> paths, all in ignored areas, +<added> -<deleted>`, for a release whose paths all fall in ignored areas; the first line, `- v4.3.1 (read 2026-10-28): …`, is the baseline the full review read.
- Any other release is a section `### v<version> (from v<version>, read <YYYY-MM-DD>)`: a table `| Area | What we look for | Paths | Lines | Verdict | Evidence |` with one row an area (the reader splits a row into one a change), the verdict `adopt`, `adapt`, `ignore`, or `?` until decided; `To classify by hand:` with one `- <path> (+a -d)` line a path no area matches, or `(none)`; `Paths by area:` with one `- <area>: <path> (+a -d)` line a changed path.
- A section counts as read only when every row of its table has a verdict that starts with `adopt`, `adapt` or `ignore` (any case) and a non-empty evidence cell, and its hand list, read up to `Paths by area:` across blank lines, holds no path.

## The idea watch's clone

`~/.js-harness/upstream/gentle-ai` is a bare clone of the gentle-ai repository, with no working tree: nothing in it is built or run, and only git reads it. `workshop/bin/idea-watch.mjs` `fetchClone` records it in the machine manifest's `clones` (`bin/lib/clones.mjs` `recordClone`) before it clones it, and fetches its tags when it is already there; `js-harness uninstall machine` removes it whole, with the `upstream` folder it leaves empty.

## Session summaries

`docs/sessions/<date>-<slug>.md` is the committed summary a work session leaves when it finishes. The lead reads it before archiving the session; it is kept to reconstruct later how the work went. `bin/summary.mjs` `summaryMain` prints the template (`bin/lib/summary.mjs` `summaryTemplate`) or only the file's path (`summaryPath`), and the session fills, commits and pushes it. `<date>` is the UTC day `YYYY-MM-DD` and `<slug>` the title's slug (`bin/lib/channel.mjs` `titleSlug`).

- `# <session title>`, then a line `File: <path>. …` saying what the file is for and how to close with it.
- Seven sections, each required and filled with something other than its template placeholder (`summaryProblems`, checked by `notify --kind closed --summary` through `closeProblems`, which also requires the file to be pushed):
  - `## Goal`: what the session was opened for, and the opening it read.
  - `## The user's words`: his words that started the work, quoted with their transcript and line.
  - `## Delivered`: each pull request, commit and feature document, with its state (merged, ready, open).
  - `## Decisions`: each decision, whose it was, and where it is recorded.
  - `## Failures and lessons`: what failed, how it was found, and what changed so it does not come back.
  - `## Left`: what is not done, and who holds it.
  - `## Cost`: time (first and last notice), context share at the end, reviews run and gate runs.

## The machine manifest

The record of everything js-harness wrote on the machine outside a repository, so `uninstall` can undo exactly that and `status` and `doctor` can compare it with the disk. `bin/lib/manifest.mjs` `install` builds its core (`version`, `files`, `entries`, `permissions`, `rulesBlock`) and carries forward the arrays the commands that act on request keep through `keepRecord` (`recordOptionalFile`, `recordScheduledTask`, `recordStackRow`, `recordClone` of `bin/lib/clones.mjs`, and `acceptSessionMessages` in `bin/lib/user-settings.mjs`). It is one JSON object, written whole by `writeManifestAtomic`.

- `version`: string, the js-harness version installed; `null` in a manifest created only to hold records kept on request, which reads as not installed.
- `files`: array of `{ path, sha256, skipped, edited?, reason? }`, one per whole file written (the skills under `~/.claude/skills/`, the output style), built by `writeComponent` in `bin/lib/component-write.mjs`: `path` absolute, `sha256` hex of the bytes written, `skipped` boolean (`true` when this run did not write it and carried the earlier record forward), `edited` `true` when the user changed the file since, `reason` why it was skipped.
- `entries`: array, one per hook entry grafted into a JSON file the harness does not own, built by `installEntries`: `path` (the file), `pointer` (array of keys to the list, such as `["hooks", "SessionStart"]`), `entry` (the JSON value appended), `sha256` (hex of the entry's JSON), `createdFile` (boolean), `createdFolders` (array of absolute folders install made, deepest first), `createdContainers` (number of containers on the pointer install made, counted up from the list), `skipped` (boolean), `reason` (when skipped), `createdEntry` (`false` only when the file already held the entry, so it is the user's), `trustConfigs` (array of Codex `config.toml` paths, only on a Codex entry an earlier version wrote).
- `permissions`: object `{ path, added: { allow, deny }, defaultMode, wroteMode, createdFile, createdObject, createdLists }` from `holdPermissions` in `bin/lib/permissions.mjs`: `added` the permission strings install added to each list, `defaultMode` the mode adopted (string or `null`), `wroteMode` whether install wrote it back, `createdLists` the names (`allow`, `deny`) of lists install created; absent when the settings could not be held.
- `rulesBlock`: object `{ path, createdFile, separator }` from `holdRulesBlock` in `bin/lib/rules-block.mjs`: `separator` the text put before the block, one of `""`, `"\n"`, `"\r\n"`, `"\n\n"`, `"\r\n\r\n"`.
- `optional`: array of `{ path, sha256 }`, a file written only on request (the login launcher of `remote start --at-login`), from `recordOptionalFile`.
- `tasks`: array of `{ name, command, arguments }`, a Windows scheduled task registered on request, from `recordScheduledTask`.
- `settings`: array of `{ path, key, value, had, previous, createdFile }`, a user setting written on request (`crossSessionInbound: "accept"`), from `acceptSessionMessages`: `had` whether the key was there before, `previous` its earlier value or `null`.
- `stack`: array of `{ tool, dimension, run, undo, applies, env, at }`, one row `stack install` ran, from `recordStackRow`: `run` and `undo` the words of the command and its undo, `applies` what the undo still applies to (`null` before it ran), `env` the variables given.
- `pluginHooks`: array of `{ path, event, original, written, at }`, a plugin's hooks file D8 changed on request (`js-harness stack engram-prompt off`), from `bin/lib/engram-prompt-hook.mjs` `promptHookOff`: `event` the entry taken out (`UserPromptSubmit`), `original` and `written` the file's whole text before and after. `stack engram-prompt on` and `uninstall` write `original` back while the file still reads `written`.
- `clones`: array of `{ path, url }`, a git repository fetched on request (the idea watch's bare clone), from `bin/lib/clones.mjs` `recordClone`: `path` the absolute folder, `url` the repository fetched. `uninstall` removes a recorded clone only inside `~/.js-harness`, both as written and as it resolves through links.

## The host's files the harness edits

The keys and blocks js-harness puts into Claude Code's own files, each recorded in the machine manifest so `uninstall` takes out only them. `bin/lib/manifest.mjs` `install` grafts the hook entries and writes the output style; `bin/lib/rules-block.mjs` `holdRulesBlock` writes the Rules block; `bin/lib/permissions.mjs` `holdPermissions` (called by `install`) and `bin/lib/user-settings.mjs` `acceptSessionMessages` write the settings keys.

### `~/.claude/settings.json`

- `hooks.<event>`: one entry appended to each list, `{ matcher?, hooks: [{ type: "command", command, timeout }] }` (the values in `bin/lib/hook-entries.mjs`): `SessionStart` (`js-harness doctor --hook`, `js-harness resume --hook`, `js-harness rules --hook`, `js-harness backup --session-start`), `PostToolUse` (`js-harness resume --pause`, `js-harness template gate --shown`), `PostToolUseFailure` (`js-harness resume --pause`, matcher `WebFetch`), `PreToolUse` (`js-harness guard --hook`, `js-harness template gate --hook`, `js-harness advisor-gate --hook`), `SubagentStop` (`js-harness advisor-gate --stop`), `PermissionRequest` (`js-harness permit --hook`), `Stop` (`js-harness guard --stop`, `js-harness reply --hook`, `js-harness backup --hook`), `UserPromptSubmit` and `SubagentStart` (`js-harness rules --hook`).
- `permissions.allow` and `permissions.deny`: the strings of `PERMISSIONS_ALLOW` and `PERMISSIONS_DENY` (`bin/lib/deny-paths.mjs`) the lists lack, appended.
- `permissions.defaultMode`: written back only when a mode install adopted earlier has gone missing; never invented.
- `crossSessionInbound`: `"accept"`, only with `install --accept-session-messages`.

### `~/.claude/CLAUDE.md`

- The Rules block: an opening line `<!-- js-harness rules <12-hex hash of the lines>: ... -->`, the heading `## Rules` and the nine lines of `RULES_LINES` as a list, then `<!-- js-harness rules end -->`; put at the end of the file after a line break or a blank line, re-rendered while its lines match the hash and left as the user's once edited. Nothing else of the file is touched.

### `~/.claude/output-styles/js-harness.md`

- The whole file, the text of `outputStyleContent` (`bin/lib/output-style.mjs`); recorded in the manifest's `files`.

### `~/.claude/plugins/cache/engram/engram/<version>/hooks/hooks.json`

- `hooks.UserPromptSubmit`: taken out, only with `js-harness stack engram-prompt off` (D8); the rest of the file is written back with its own layout. Recorded in the manifest's `pluginHooks`.

### `~/.codex/hooks.json`

- No key today: `install` declares no Codex component. Entries an earlier version grafted there (up to 0.97.0) stay recorded in the manifest's `entries`, and `sync` and `uninstall` take them out and move their Codex trust with them.

## A clone's manifest

The record of what `init` (or `sync` in a fresh clone) wrote into one repository, kept under its git common dir so every worktree shares it and `uninstall` in the project undoes exactly that. `bin/lib/project.mjs` `initProject` builds it (in `writeProject`) and writes it with `writeManifestAtomic` before `harness.json`. One JSON object.

- `version`: string, the js-harness version that wrote it.
- `files`: array of `{ path, sha256, gitDir? }`, each file written (`harness.json`, `AGENTS.md`, `CLAUDE.md`, `docs/FAILURES.md`, the git hooks): `path` repository-relative with `/`, or absolute with `/` for a file inside a git dir outside the working tree, which then carries `gitDir: true`.
- `kept`: array of `{ path, reason, outside?, gitDir? }`, a file left as it was and never removed (`reason` such as `committed` or `exists`; `outside: true` for a link that sends the path out of the repository).
- `codegraph`: `{ createdDir, status }`: `createdDir` boolean, whether this run made `.codegraph/`; `status` one of `ok`, `failed`, `exists`, `off`.
- `dirs`: array of `{ path, gitDir? }`, folders this run created, in the shape of `files` without a hash.
- `settings`: array of records of the keys written into `.claude/settings.local.json` (`applySettings` in `bin/lib/project-apply.mjs`), absent when none: `key` (`outputStyle`, `denies`, `paste`, `languageServer`), `path` (`.claude/settings.local.json`), `pointer` (array of keys), `value` (for a single key) or `entries` (array of strings added) with `createdList` (boolean) for a list key, `createdFile`, `createdDir` (booleans), `createdContainers` (number).
- `exclude`: `{ line, separator, createdFile, createdDir }`, the line `.atl/` added to the clone's exclude file (`addExclude` in `bin/lib/project-exclude.mjs`): `separator` whether a line break was put before it.
- `coverage`: `{ baseline, release }`, the day (`YYYY-MM-DD`) the project's rule controls are owed from and the version that set it; never in a clone.
- `format`: number, 1 to 3 (`MANIFEST_FORMAT`), what a copy must know to undo the manifest (1 for `settings`, 2 for `exclude`, 3 for the style and the denies); absent when any copy reads it.

## Review records

The evidence a push and the merge door read that each code commit was reviewed by Codex and by the Claude lenses, with the run lines that measured each attempt, all in `<git common dir>/js-harness/`. `bin/lib/codex-reviews.mjs` `appendCodexReview` appends the record that `codexReviewMain` in `bin/codex-review.mjs` builds (`writeRecord`), whose run lines `appendCodexReviewRun` in `bin/lib/codex-review-runs.mjs` appends; `bin/lib/lens-reviews.mjs` `startLensRun`, `appendLensReview` and `keepLensAnswer` write the lens files from `bin/lens-review.mjs`. Every `.jsonl` file holds one JSON object a line.

### `codex-reviews.jsonl`

- `schema`: `js-harness.codex-review/v1`.
- `base`, `head`: full commit ids of the range.
- `reviewedAt`: ISO time.
- `outcome`: `reviewed`, `unavailable` (a skip recorded with `--unavailable`) or `nothing-to-review`.
- `reason`: string, why there is no review (for `unavailable` and `nothing-to-review`).
- `subjectHash`: 64-hex hash of the range's subject (`lensCandidate`), absent when git could not diff the range.
- `run`: id of the run line that completed the review; `runs`: array of the run-line ids of each part, `null` where a part's line was not written.
- `leftOut`: `{ files, changedLines, documents: { files, changedLines }, marked: { files, changedLines } }`, what the review did not read (`reviewScope`).
- `diff`: `remerge`, for a merge reviewed by what was written in it.
- `recheckOf`: commit id whose findings this review rechecked.
- `excused`: `refused-tests`, an `incorrect` that rested only on refused test runs.

### `codex-review-runs.jsonl`

- `schema`: `js-harness.codex-review-run/v1`; `id`: UUID that also named the run's Codex home.
- `startedAt`: ISO time; `durationMs`: number or `null`.
- `base`, `from`, `head`: commit ids of the whole range and where this attempt started.
- `part`: `{ index, of, files, changedLines }`, absent for a whole range.
- `plan`: `{ estimate, high, method }`, the planned input tokens and the method version, absent when the plan had no estimate.
- `outcome`: `reviewed`, `failed`, `timed-out`, `interrupted` or `not-inspected`; `reason`: string when not reviewed.
- `cli`: the Codex CLI version, or `null`.
- `session`: `lean` (old lines may say `current`).
- `model`, `effort`: what the command passed; `sessionModel`, `sessionEffort`: what the session's rollout file says ran, or `null`.
- `prompt`: `codex` or `own`; `promptVersion`: the version of the own prompt, or `null`.
- `diff`: `remerge`, only for a merge review.
- `usage`: `{ inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens }`, each a number or `null`; `usageSource`: `rollout` or `null`.
- `requests`, `firstRequestInputTokens`, `threads`: numbers or `null`, read from the rollout files.
- `turns`: number; `items`: object of item type to count; `commands`: `{ total, failed }`.
- `coverage`: `{ seen, total }`, the patch lines Codex's commands showed out of those expected.
- `findings`: `{ total, bySeverity: { P0, P1, P2, P3, none } }` or `null`; `verdict`: `correct`, `incorrect` or `null`; `answerSource`: `rollout` or `null`.
- `answer`: `{ findings, verdict, excused? }`, the findings whole (file, lines, severity, title, body, confidence), on a reviewed attempt; else `null`.
- `kept`: `{ key, review, rendered }`, a passed part's answer for reuse, with `key` the 64-hex hash of what its session was sent.
- `recheck`: `{ of, findings, fixed, notFixed, followUps, blocking, unmarked }`, on a recheck.

### `lens-reviews.jsonl`

- `schema`: `js-harness.lens-review/v1`.
- `base`, `head`: full commit ids; `subjectHash`: 64-hex hash of the subject.
- `paths`: number of paths the review reads; `leftOut`: `{ files, marked: { files } }`.
- `run`: id of the run line this record claims.
- `outcome`: `reviewed`, `incomplete`, `unavailable` or `nothing-to-review`; `reason`: string for the last two.
- `lenses`: array of lens names (`risk`, `resilience`, `readability`, `reliability`); `lensReason`: the `--reason` given.
- `results`: array, one per lens: `lens`, `outcome` (`complete` or `incomplete`), `findings` (array of `{ location, severity, claim, evidence_class, causal_disposition, proof_refs }`, `severity` one of `BLOCKER`, `CRITICAL`, `WARNING`, `SUGGESTION`), `evidence` (array of strings, when complete), `why` and `answered` (the first 300 characters of the answer) when incomplete, `stopReason`, `inputTokens`, `outputTokens`, `costUsd` (number or `null`), `durationMs`, `model`, `answerFile` or `answerNotKept`.
- `reviewedAt`: ISO time.

### `lens-review-runs.jsonl`

- `schema`: `js-harness.lens-review-run/v1`.
- `id`: UUID; `base`, `head`, `subjectHash`: the range and its hash; `startedAt`: ISO time.

### `lens-answers/`

- One plain-text file `<run>-<lens>.stdout` per incomplete lens: the whole standard output of its CLI. No check reads it.

## Review turns

A detached git worktree at a merge commit, where the merge's turn of a cut range is reviewed by what was written in it, so Codex reads that commit's files. `bin/lib/codex-review-turns.mjs` `addTurnWorktree` makes it with `git worktree add --detach`; it is a folder, not a record of fields.

- Folder name: `review-turn-<pid>-<ms>`, the process id of the run and the time it was made in milliseconds; `sweepTurnWorktrees` removes one whose process no longer runs or that is older than 24 hours (`TURN_WORKTREE_MAX_AGE_MS`).
- Contents: the checked-out files of the merge commit and git's worktree link; nothing js-harness writes itself.

## Double review reads

The record of the double review, two readers of different model families reading the same frozen copy, kept to measure what each reader adds; no push and no merge door reads it. `bin/double-review.mjs` `doubleReviewMain` builds each line (in `readCommand`, `takeCommand` and `skipCommand`) and `appendDoubleReview` in `bin/lib/double-review-records.mjs` appends it with `schema: js-harness.double-review/v1`. One JSON object a line, of three kinds.

### `read`

- `kind`: `read`; `id`: UUID; `at`: ISO time.
- `files`: array of repository-relative paths read; `diff`: the revision of `--diff`, when given.
- `hash`: hex SHA-256 of the frozen copies, read tokens left out.
- `moved`: `true` when the repository changed while the readers read.
- `readers`: array of `{ reader, model, durationMs, outcome, ... }`: `reader` `claude` or `codex`; `outcome` `answered` or `failed`; a failed one has `reason`; an answered one has `findings` (array of `{ severity, claim, evidence, fix }`, `severity` one of `high`, `medium`, `low`), `sound` and `unchecked` (arrays of strings) and `usage` (`{ inputTokens, outputTokens }` or `null`), and the Claude reader `costUsd`.

### `take`

- `kind`: `take`; `at`: ISO time; `read`: the read's id; `reader`: `claude` or `codex`.
- `taken`: array of finding numbers (from 1) the writer took; `shared`: array of those the other reader also found; `why`: string, when given.

### `skip`

- `kind`: `skip`; `at`: ISO time; `what`: what was not read.
- `words`: the user's typed words; `transcript`: the session the words are in; `line`: their line number; `date`: the date of his words.

## Lands

One line per `merge-queue --land`, what the throughput review measures lands by: what was looked at, left out, timed and landed. `bin/merge-queue.mjs` `mergeQueueMain` fills it through `landLog` and appends it once as the land ends; a dry run writes none.

- `v`: `1`.
- `startedAt`, `endedAt`: ISO times.
- `session`: the Claude Code session id that ran the land, or `null`.
- `main`: commit id of `origin/<default branch>` at the start.
- `considered`: array of pull-request numbers looked at.
- `leftOut`: array of `{ pr, reason, said, failing?, told? }`: `reason` one of `red`, `door`, `merge`, `not-ready`, `conflict`, `review`; `said` the line given; `failing` the failing tests of a red; `told` the number of the work session told, or `null`.
- `phases`: array of `{ phase, startedAt, seconds, ok }`: `phase` `suite`, `actions` or `push` (older lines `circleci`); `ok` `true`, `false` or `null` when nothing was judged.
- `actions`: `{ state, name, conclusion, url }` of the GitHub Actions run: `state` `green`, `red`, `none` or `dropped`; or `null`.
- `candidate`: commit id of the candidate built, or `null`.
- `landed`: array of pull-request numbers landed.
- `removed`: array of `{ pr, path }`, worktrees of landed pull requests removed.
- `exit`: the land's exit code.
- `said`: the last line the land printed, or `null`.

## Test traces

The result memory of exact test selection: for each test file, what it read on a passing run, so a gate can skip a file whose inputs have not changed. `bin/check.mjs` `tracesDir` names the folder and `startShadow` points the tracer at it; the traces themselves are written by the preload `bin/lib/trace-reads.cjs` (`writeTrace`) as each test file's process exits.

### `<place>/<test>/<key>.json`

`<place>` is `windows` (or the platform name) for a run here and `wsl-<distro>` for a run in WSL2; `<test>` is the test's repository path, URI-encoded; `<key>` is 32 hex of the hash of everything below but `v` and `test`. At most 8 are kept for a test, and a test seen to fail loses all of them.

- `v`: `1`.
- `test`: the test file's path from the repository root, `/`-separated.
- `tracer`: `js-harness.trace-reads/v1`; `tracerHash`: hash of the preload's content.
- `node`: `process.version`; `os`: `process.platform`.
- `env`: object of the run's environment variables a trace keys on (`TRACE_ENV`).
- `untraced`: string saying why some of the run could not be traced, or `null`.
- `reads`: object from each path read (relative, a listed directory ending in `/`) to its state then: `absent`, `directory`, `listing:<hash>`, or the hash of its content.

### `results-<pid>-<ms>/`

- Temporary, for a gate in shadow: one JSON file a test file, `{ test, code, seconds }` (exit code and run time); `endShadow` removes the folder.

### `parts/<run>/`

- Temporary: one JSON file a child process, `{ reads, untraced }`, merged into its test file's trace on exit and then removed.

## Codex review homes

The Codex home a lean review runs in: an empty folder of the run's own, so Codex loads nothing of the user's home but the login. `bin/lib/codex-review-home.mjs` `createLeanHome` makes one per run; it is a folder, not a record of fields.

- Folder name: `<id>`, the run's UUID (the `id` of its run line in `codex-review-runs.jsonl`).
- `auth.json`: a hard link to the real Codex login (`<CODEX_HOME>/auth.json`), never a copy; its name is removed first when the home goes.
- What Codex writes as its home during the run, such as the rollout files under `sessions/` that the run reads its tokens and answer from.
- The run removes its folder at the end unless `--keep-home`, which leaves it without the login's name; `sweepStaleLeanHomes` removes folders older than twice the review timeout.

## The channel

How the sessions of a project tell each other what happened: an append-only record per project, the openings a new session is given by title, and the lead's relief log. `bin/lib/channel.mjs` `appendNotice` (with `newNotice`), `writeOpening` and `appendRelief` write them for `bin/notify.mjs`; `appendReading` and `appendReport` add the record's other two line kinds.

### `channel/<project>.jsonl`: a notice

- `schema`: `js-harness.channel-notice/v1`.
- `at`: ISO time.
- `from`: `{ host, id, source, title, permissionMode, context }` (`senderOf`): `host` `claude-code` or `unknown`; `source` `environment`, `flag`, `hook` or `null`; `context` `{ tokens, percent }` or `null`.
- `to`: `{ role, number }`: `role` `orchestrator` (number `null`) or `work` (the session's number).
- `kind`: one of `opened`, `waiting`, `closed`, `note`, `answer`, `relieved`, `question`, `withdrawn`, `ready`.
- `text`: one line of at most 500 characters (a question's text up to 2,000).
- `cwd`, `worktree`, `branch`: where it was sent from, each `null` when unknown.
- A `question` adds `id` (string), `options` (array of at most 6 `{ label, description }`, the recommended first), `waits` (one line) and `applies` (`{ pr }`, when it asks to apply a pull request).
- A `ready` adds `pr` (number); a `withdrawn` adds `question` (number); a `closed` may add `summary` (a path under `docs/sessions/`).
- An `answer` adds `transcript` (a file or session id) and `line` (number), and with a question `question` (number), `verified` (boolean) and `copy` (`{ tool, answers: [{ question, options, answer, how }] }` or `null`, `how` `tapped`, `typed` or `typed in the chat`); a verified one may add `shownAt` and `answeredAt` (ISO times).

### `channel/<project>.jsonl`: a reading

- `schema`: `js-harness.channel-reading/v1`; `at`: ISO time.
- `reader`: `{ host, id, source }`, the session that read an opening; `title`: the opening's title.

### `channel/<project>.jsonl`: a report

- `schema`: `js-harness.channel-report/v1`; `at`: ISO time.
- `by`: session id or `null`; `head`: the default branch's commit the report read, or `null`.
- `proposals`: array of `{ step, estimate }` (`estimate` string or `null`), absent when none.

### `channel/openings/<project>/<slug>-<hash>.json`

One file a session title, its name the title's letters and digits and 12 hex of its hash; one JSON object.

- `schema`: `js-harness.channel-opening/v1`.
- `title`: the session's title, one line of at most 120 characters.
- `at`: ISO time; `from`: the sender, as a notice's `from`.
- `text`: the opening prompt, at most 100,000 characters.

### `relief/<project>.md`

- The lead's log in prose, one line an event; a line the command writes starts with `YYYY-MM-DD HH:MM:SS local (<command>).` (`reliefStamp`, `notify` unless another command says so), then the text, at most 6,000 characters.

## A session's pause and reach

Per-session state of three hooks, so each tells a session a thing once: the context pause, the rules that changed on the default branch, and the channel notices addressed to it. `bin/lib/pause.mjs` `pauseNotice` writes the pause state, `bin/lib/rules-reach.mjs` `reachHook` the rules seen, and `bin/lib/inbox.mjs` `inboxNotice` the inbox state (through `writeStateFile` of `bin/lib/pause.mjs`). Each is one pretty-printed JSON object, written through a temp file and a rename.

### `channel/pause/<session>.json` and `js-harness-pause-<session>.json`

The temporary folder's copy is written only when the home cannot be; a read takes the newer of the two.

- `compaction`: the session's measured compaction point, a token count, or `null`.
- `armed`: boolean, whether the next crossing of the pause tells the session.
- `lastArmed`: boolean, whether the last notice before compaction may still be given.
- `told`: array of `{ at, tokens }`, each time the session was told (ISO time and the tokens it held).
- `written`: ISO time of this write.

### `channel/rules-seen/<session>.json`

- `top`: the project's git top folder.
- `main`: the ref read, `origin/HEAD`, `origin/main` or `main`.
- `commit`: that ref's commit id.
- `seen`: array of the rules last told, each reduced to `id`, `scope`, `value`, `unit`, `flag`, `alias`, `path`, `phrases`, `retired`, `successors`, `sensor`.
- A file not written for 30 days is pruned at another session's write.

### `channel/inbox/<session>.json`

- `cwd`: the folder the session last ran in; `slug`: the project's record it reads.
- `title`: the session's title, or `null`.
- `recordSize`: the record's size in bytes at the last look.
- `seen`: the number of notices the record held at the last look.
- `told`: ISO time, only in a state written before the count cursor.

## The live board's cursor

What the live board artifact has been sent from the channel record, and the stamp of the lead's last check, so `sessions live` exports only new rows. `bin/sessions-live.mjs` `sessionsLiveMain` writes both files; `bin/lib/live-rows.mjs` `liveCursorPath` names the cursor's.

### `channel/live/<project>.json`

- `schema`: `js-harness.live-cursor/v1`.
- `upto`: number, every notice of the record below this index was sent.
- `sent`: array of indexes above `upto` already sent.
- `url`: the board's link, when recorded with `--url`.
- `through` and `ids`: the cursor's older form (an ISO time and an array of row ids), turned into `upto` and `sent` on the first run.

### `board-checked.json`

- `checked`: ISO time the record was read; `until`: ISO time the check holds to.
- `resting`: boolean, whether the lead rests (`--resting`).
- `stretch`: the open stretch (`boardStretch`: `{ id, openedAt, returnAt, hours, elapsedHours, measuredAt, goals: { met, total, checkedAt }, lostHours, items }`), `null` when none is open, or `{ unavailable }`.
- `running`: `{ at, until, items }`, `items` an array of `{ kind, pid, since, where }` of the work running on the machine, or `{ at, until, unavailable }`.
- `questions`: array of `{ number, from, at, row, text, ask }`, the questions still open.

## The permit relay

The relay through which the lead answers another session's permission card while it holds the lease. `bin/permit.mjs` `permitMain` writes every file (the hook in `hook`, the lease and the verdicts in their subcommands); the hook also tells the lead with a channel notice of kind `note`.

### `lease.json`

- `schema`: `js-harness.permit/v1`.
- `session`: the lead's session id; `until`: ISO time the lease ends.

### `requests/<id>.json`

`<id>` is `p`, the time in base 36 and 4 hex characters.

- `schema`, `id`; `at`: ISO time the card arrived.
- `session`, `transcript`, `cwd`, `mode`: the asking session's id, transcript path, folder and permission mode (`null` when not given).
- `tool`: the tool's name; `input`: the tool's input as the host gave it.

### `verdicts/<id>.json`

- `schema`, `id`; `behavior`: `allow` or `deny`; `reason`: string, for a denial; `at`: ISO time.

### `log.jsonl`

- One line an outcome: `at` (ISO time), `id`, `outcome` (`allow`, `deny` or `timeout`), `reason` (with a denial's reason).

## Background sessions

The sessions the lead starts with `claude --bg`, which are no row in the user's sidebar, so each start is recorded and undone from here. `bin/sessions-background.mjs` `sessionsStartMain` builds a start's entry (and `resumeStart` a resumed job's) and writes the brief's copy; `bin/lib/background.mjs` `appendRecord` appends lines with `schema: js-harness.background-session/v1`, and `strandEntry` keeps an entry the record would not take.

### `sessions.jsonl`: `started`

- `schema`; `event`: `started`; `at`: ISO time.
- `id`: the short job id `claude --bg` printed; `sessionId`: the conversation's id, or `null`.
- `title`: the session's title; `root`: the project's main checkout; `cwd`: the folder it started in.
- `worktree`: the worktree name asked for, or `null`; `worktreePath`: its path, or `null`.
- `model`, `effort`: as given, or `null`; `advisor`: the one passed to `claude --advisor`, the home's where the project
  declares `rule:advisor-model`, or `null`; `remoteControl`: boolean.
- `brief`: path of the brief's copy.
- `resumedFrom`: the job id this one resumed, only on a resumed job.

### `sessions.jsonl`: `removed`

- `schema`; `event`: `removed`; `at`: ISO time; `id`: the job removed.

### `briefs/<time>-<8 hex>.md`

- The brief as given, then the section `## How you report`, which tells the session to report with `js-harness notify`; `<time>` is the ISO time with `:` and `.` made `-`.

### `stranded/<id>.json`

- One `started` entry, with its schema, whose line the record would not take after `claude` ran; read as a line of the record until the session is removed.

## Loops

The owner record of one background loop a session runs, so a stop or a status can tell whose it is and whether its processes still run; `bin/loop.mjs` `claimLoop` builds it and `bin/lib/loops.mjs` `writeRecord` writes it whole (a temporary file, then a hard link for a new claim or a rename for an update). A `<name>.json.lock` file beside it, holding a token line, is held while a session reads, claims or removes the record (`bin/lib/loops.mjs` `withRecordLock`).

- `schema`: string, always `js-harness.loop/v1`; a file with another value is read as unreadable.
- `name`: string, the loop's name, matching `LOOP_NAME` (lower-case letters, digits and dashes, 1 to 40 characters) and the file's name.
- `owner`: string, the session id that owns the loop (`--owner`, else `CLAUDE_CODE_SESSION_ID`).
- `pid`: number, the pid of the `js-harness loop run` process.
- `createdAt`: number, that process's creation time as the process table gives it, which with `pid` names the process.
- `child`: `null` until the command starts, then `{ pid, createdAt }` of the command the loop runs (`createdAt` may be `null` when the table did not show it).
- `startedAt`: ISO time the loop was claimed.
- `purpose`: string, the `--purpose` text.
- `until`: string, the `--until` end condition.
- `command`: array of strings, the command and its arguments given after `--`.
- `cwd`: string, the folder the command runs in.
- `survivors`: array of `{ pid, createdAt }`, present only after a `stop` that left processes alive (`bin/loop.mjs` `stopLoop`), so the next stop still finds them.

### `cuts/<session>.json`

The count of compactions the heartbeat last told a session's lead with a `CUT:` line (`bin/loop.mjs` `heartbeat`), so a cut due when a heartbeat starts wakes the lead once and a relaunch is not woken again until another compaction. Written whole on each `CUT:`; a missing or unreadable file reads as 0.

- `told`: integer, the compactions counted in the session's transcript when the last `CUT:` line was told.

### `away/<session>.json`

The absence of the user the lead was last told of with an `AWAY:` line, by the heartbeat or by the lead's `wait --notice-to orchestrator`, which keep this one mark (`bin/lib/lead-away.mjs` `leadAbsence`), so an absence is told once and a relaunch of either is not woken by it again. Written whole on each `AWAY:`; a missing or unreadable file reads as none told.

- `told`: ISO time of the user's last message to the session when the absence was told.
- `at`: ISO time the line was told.
- `heldSince`: ISO time of the question call that held the session when the absence started, or `null`.

## Gates

The machine's record of every gate and of the lock that serializes them: one JSON line per gate event in a rotating log, the lock's holder and waiting files, and the gate-first tickets. `bin/lib/gate-log.mjs` `gateRecord` builds the log lines and `appendGateEvent` appends them; `bin/lib/gate-lock.mjs` `takeGateLock` writes the holder file; `bin/lib/gate-first.mjs` `issueTicket` writes a ticket and `logTicket` its log lines.

### `gate-log/log.jsonl` (rotated to `log.1.jsonl`)

One JSON line per event; past the `gate-log-size` rule the file is renamed to `log.1.jsonl` and a new one started. Every line has the head:

- `v`: number, the line format version, `1`; a reader skips lines of another version.
- `event`: string, one of `start`, `end`, `refused`, `stopped`, `same`, `ci-fallback`, `first-issued`, `first-claimed`, `first-expired`, `first-cancelled`, `first-unclaimed`.
- `id`: string, a random UUID shared by all lines of one gate, or the ticket's id for a `first-` line.
- `at`: ISO time of the event.

The lines of a gate (`start`, `refused`, `stopped`, `same`, `ci-fallback`) also carry what `gateRecord` was told of it:

- `cwd`: string, the folder the gate checks.
- `command`: string, what the gate runs, cut at the `gate-log-command` rule's length.
- `pid`: number, the gate's process.
- `session`: string, the host session that ran it, when the host gives one.

Per kind:

- `start`: `lock` (string: `own`, `parent` or `none`), `waitedSeconds` (number), `waitedFor` (array of `{ cwd, pid, command }` of the gates it waited for, each command cut), `load` (object from `bin/lib/machine-load.mjs`: `busy`, `processors`, `share`, `sampleMs`, or `notRead` with why; left out when no sample was taken).
- `end`: `seconds` (number, the run's length to a tenth), `result` (string: `pass`, `fail` or `timeout` for `check`, `exit <code>` or `killed` for `js-harness gate`, `error`), `sensors` (array of objects, one per sensor, as `check` gives them; `workshop/lib/throughput.mjs` `gateFacts` reads `name`, `failing`, `ranIn`, `shadow`, `skip`), and, where the gate has them, `code`, `files` and `tried` (each a tree key, 64 lowercase hex characters: the key the pass proves, the key of the files, the key it ran under). It carries no `cwd`, `command`, `pid` or `session`.
- `refused`: `reason` (string, the lock's word, such as `held`, `timeout`, `ahead`, `launcher gone`), `waitedSeconds`, `waitedFor`.
- `stopped`: `rows` (array of strings, the rows that had already failed).
- `same`: `code` (tree key) and `by` (string, the gate that passed the same tree).
- `ci-fallback`: `seconds` (number, what the wait for GitHub's machines cost) and `reason` (string, when given).
- `first-issued`, `first-claimed`, `first-expired`, `first-cancelled`, `first-unclaimed`: the ticket's `session`, `tree` (when it names one), `reason`, `by` (when it names one) and `until`; `first-claimed` adds `cwd`, `pid` and `passed` (array of `{ cwd, pid }` of the gates it went before); `first-unclaimed` adds `error` (the code of the held file), `cwd` and `pid`.

### `gate-log/busiest.jsonl` (rotated to `busiest.1.jsonl`)

One line per gate that kept who spent the processor over its run (`gateRecord`'s `busiest`, appended by `appendGateBusiest`).

- `v`: number, `1`.
- `id`: string, the gate's id in the log.
- `at`: ISO time written.
- `seconds`: number, the run's seconds.
- `busiest`: array of `{ pid?, name, script?, cpuSeconds }`, the heaviest first.

### `gate-log/test-times.jsonl` (rotated to `test-times.1.jsonl`)

One line per gate that traced its tests (`gateRecord`'s `testTimes`, appended by `appendGateTestTimes`).

- `v`: number, `1`.
- `id`: string, the gate's id in the log.
- `at`: ISO time written.
- `files`: array of `{ test, seconds }`, each test file and its seconds.

### `gate-log/failed.jsonl` (rotated to `failed.1.jsonl`)

A copy of every `end` line whose result is not `pass` and that carries `files` and `sensors`, whole, so a later proof of the same tree still sees the failure after the log rotates (`gateRecord`'s `end`, appended by `appendGateFailure`). Its fields are the `end` line's.

### `gate/lock/holder-<token>.json` and `gate/wait-<token>/holder-<token>.json`

A gate that waits writes its file in its own folder `gate/wait-<token>/`; it takes the lock by renaming that folder to `gate/lock/`, so the holder's file is the same file. The holder touches the file every `GATE_BEAT_MS` (5 s) and a waiter at every poll; the file's modification time is its beat, and one older than `GATE_STALE_MS` (60 s) is a dead gate's. The file is one JSON line written by `takeGateLock`'s `stage`:

- `token`: string, `<pid>-<12 hex>`, also in the file's and folder's names.
- `pid`: number, the gate's process.
- `cwd`: string, the gate's folder.
- `command`: string, what the gate runs, whole.
- `startedAt`: ISO time the file was written.
- `waitingSince`: ISO time the gate arrived, its place in the line.
- `line`: number, `1`, marking a gate that keeps the line (a file without it is an older version's).
- `session`: string or `null`, the session that started the gate.
- `first`: string, the id of the gate-first ticket the gate claimed, only when it claimed one.
- `firstReason`: string or `null`, that ticket's reason, only with `first`.

### `gate-first/<id>.json`

A ticket that puts one session's next whole check first in the lock's line, written by `issueTicket` under a `.pending` name and renamed into place once the count of open tickets (two at most) allows it; a gate of that session claims it by renaming it away and removes it.

- `v`: number, `1`.
- `id`: string, 8 hex characters, also the file's name.
- `session`: string, the session whose next check it is for.
- `tree`: string or `null`, the absolute path of the tree that check must be of.
- `reason`: string, why it goes first.
- `by`: string or `null`, the issuer's session id.
- `issuedAt`: ISO time issued.
- `until`: ISO time after which it can no longer be claimed (60 minutes at most).

## The WSL gate

The machine's switch that runs a gate's sensors in WSL2 instead of on Windows; the person who sets it up writes it by hand, and `bin/lib/gate-wsl.mjs` `readGateWsl` parses it (a missing file means the sensors run on Windows, and `JS_HARNESS_GATE_WSL=0` overrides it for one run).

- The file is one JSON object; anything else fails the gate as a broken declaration.
- `distro`: string, the distribution's name as `wsl -l` gives it (letters, digits, `.`, `_`, `-`).
- `node`: string, an absolute Linux path to the folder holding the `node` binary.

## Throughput snapshots

The facts of one closed UTC day, kept once so a later throughput review reads what that day was rather than what a rotating gate log still holds, and the record of review outcomes; `workshop/bin/throughput.mjs` `throughputMain` writes both, the snapshot through `snapshot` and `keepDay`, the outcomes through `reviewed`, `shipped` and `appendOutcome`.

### `<day>.json`

Written whole beside its place and renamed in; a day is written again only by a snapshot that covers more of it.

- `schema`: string, `js-harness.throughput-day/v1`.
- `day`: string, the UTC day as `YYYY-MM-DD`.
- `writtenAt`: ISO time written.
- `from`: array of strings, the copies of the gate log read (newer first), or `["the live gate log"]`.
- `partialFrom`: ISO time or `null`, where the log read begins when it does not reach the day's start.
- `partialUntil`: ISO time or `null`, where copies made before the day settled end.
- `gates`: array, one per gate that started that day (`workshop/lib/throughput.mjs` `gateFacts`): `id`, `kind` (`land`, `check`, `commit`, `copy` or `run`), `lock`, `session`, `startedAt`, `endedAt`, `seconds`, `waitedSeconds`, `result`, `ranIn` (`windows` or `wsl`, `null` without a tests sensor), `traced` (boolean), `failing` (array of test files), `land` (the merge-queue candidate's folder name or `null`), `load` (the machine's busy share at the start, or `null`).
- `fallbacks`: array of `{ id, at, seconds, reason }`, the day's `ci-fallback` events.
- `testTimes`: `{ gates, files: [{ test, runs, seconds, max }] }` from `test-times.jsonl`, only when the live log was read.
- `unavailable`: object, from what was not read (`gate log`, `times`) to why.
- `replaced`: `{ at, partialFrom, partialUntil }` of the partial snapshot this one replaced, only when it replaced one.

### `outcomes.jsonl`

One JSON line per review outcome, appended.

- `v`: number, `1`.
- `kind`: string, `reviewed` or `shipped`.
- `day`: string `YYYY-MM-DD`, the day reviewed (a `reviewed` of a day) or the day an item shipped (`shipped`).
- `shipped`: string `YYYY-MM-DD`, on a `reviewed` that re-measures what shipped that day, in place of `day`.
- `found`: string, `nothing` or `candidates`, on `reviewed` lines.
- `item`: string, what shipped, on `shipped` lines.
- `at`: ISO time recorded.

## Pages shown

The numbers of each page made at the harness's moments, so the next page of the same kind and subject compares with them; `bin/lib/pages-record.mjs` `appendPage` appends one JSON line unless the last page of that kind and subject read the same head. Its callers are `bin/report-feature.mjs` (`featureNumbers`), `bin/report-phase.mjs` (`phaseNumbers`) and `bin/stretch.mjs` `recordPage`.

- `schema`: string, `js-harness.page/v1`.
- `kind`: string, `feature`, `phase` or `stretch`.
- `subject`: string, the feature document's path relative to the repository, `map` for a phase page, or the stretch's id.
- `at`: ISO time of the page.
- `head`: string, the default branch's commit the page read.
- `numbers`: object, by kind. `feature` (`bin/lib/report-feature.mjs` `featureNumbers`): `tasks`, `prs`, `realHours`, `estimate`, `covered`, `commits`, `codexInputTokens`, `lensCostUsd`, `failures`, `map`. `phase` (`bin/lib/report-phase.mjs` `phaseNumbers`): `map`, `phases` (`{ title, ... }` of each phase's after-state), `steps` (`{ plan, id, reported }`). `stretch`: `goals`, `work` (`{ met, of }`), `outside` (number of sessions outside the plan), `map` (the map's total or `null`), `steps` (`{ plan, id, reported, change }`).

## Stretches

The record of each stretch of work, one JSON line per event, from which the stretch's measure and the next stretches' corrected estimates are read; `bin/stretch.mjs` `stretchMain` appends every event through `appendEvent`, which adds the schema. Every line has `schema` (string, `js-harness.stretch/v1`), `event` (string, the kind below), `id` (string, the stretch's id, its opening ISO time) and `at` (ISO time of the event).

### `open`

Written by `open` once the plan is accepted (`bin/lib/stretch.mjs` `parsePlan`).

- `head`: string or `null`, the default branch's commit at the opening.
- `plan`: object: `hours` (number above 0), `slots` (integer, work sessions at once), `goals` (array of `{ id, text, command }`, each command one that exits 0 when the goal is met; on Windows `open` refuses one cmd.exe cannot run, `cmdShellGap` of `bin/lib/contract.mjs`), `items` (array of `{ id, title, kind, hours: [low, high], session, waitsFor?, closes?: [{ in, step }] }`, `kind` one of `design`, `build`, `verify`, `docs`, `session` a string or `null`), `waits` (array of strings).
- `corrections`: object keyed by task kind, each `{ factor, samples, from }`, `from` one of `kind`, `all`, `none` (`bin/lib/stretch.mjs` `corrections`).

### `bind`

- `item`: string, the plan item's id.
- `session`: string, the session the item got.

### `closes`

- `item`: string, the plan item's id.
- `in`: string, a roadmap phase or a plan.
- `step`: string, the start of an open step's text or a plan step's id.

### `check`

Written when the goals are run (`status --goals`, and at `close`).

- `goals`: array of `{ id, met, said }`, `met` boolean and `said` the outcome (`exit 0`, `exit <n>`, `timed out after <n> min`, `error <code>`).

### `explain`

- `kind`: string, `goal`, `item` or `failure`.
- `target`: string, the goal's or item's id, or the failure's start as an ISO time.
- `why`, `fix`, `open`: strings, each present only when given.
- `fixed`: `true`, present only when given.
- `source`: object, `{ kind: 'commit', ref }` with the full hash, or `{ kind: 'notice', at, from }` with the notice's time and sender.

### `close`

- `items`: array of `{ id, kind, estimate: [low, high], corrected: [low, high], realHours, lostHours, state, finished, clipped }`, `state` one of `queued`, `running`, `finished`, `stopped`, `silent`.
- `goals`: `{ checkedAt, met, total, list }`, `list` each goal with its `met` (boolean or `null`) and `said`.
- `totals`: `{ estimate: [low, high], realHours, lostHours, lostShare }`.

## Templates

The two records of the template gate: what a page command rendered, and what the gate decided before a call and what was shown after it; `bin/lib/template-record.mjs` `recordRendered` and `recordShown` append one JSON line each, ending first a line left without its newline (`appendRecord`).

### `templates-rendered.jsonl`

- `schema`: string, `js-harness.rendered/v1`.
- `template`: string, the template's id.
- `subject`: string, the moment's subject.
- `sha256`: string, hex hash of the page's bytes as written on disk.
- `normal`: string, hex hash of the page's normal text (`bin/lib/template.mjs` `normalText`).
- `bytes`: number, the page's size.
- `at`: ISO time.
- `head`: string, the default branch's commit the page read.
- `path`: string, the page's file.

### `templates-shown.jsonl`

- `schema`: string, `js-harness.shown/v1`.
- `at`: ISO time.
- `session`: string or `null`, the host session.
- `tool`: string, the tool of the call.
- `call`: string or `null`, the call's `tool_use_id`.
- `template`: string or `null`.
- `subject`: string or `null`; `board/summary` for a write of the board's summary.
- `decision`: string, one of `refused`, `admitted`, `free`, `unchecked` (before a call) or `shown` (after one).
- `sha256`: string or `null`, the page's hash.
- `reason`: string or `null`; on a board-summary write (`recordSummary`, tool `ArtifactData`, no template) it is `fields: <JSON array>` of the top-level fields written, or `fields unknown: <why>`.
- `board`: string or `null`, only on a board-summary write: the artifact URL it wrote to.
- `yours`: array of strings or `null`, only on a board-summary write that touched the summary's `yours` (`yoursAfter` of `bin/lib/template-gate.mjs`): the list it left, `null` when it is not known (a file not read). `template gate --hook` refuses the next write to the same `board` that drops an item of the last such list with no `yoursDropped: [{ item, reason }]` entry of its own for it, and a `str_replace` of `yours` (`decideSummary`).
- `dropped`: array of `{ item, reason }`, only on a board-summary write whose `yoursDropped` gave reasons: what left `yours` and why.

## The remote server

What each project keeps for the `claude remote-control` server the harness keeps alive, all in one folder and named by the project's id (`bin/lib/remote.mjs` `remoteId`: the folder's name cut to 40 characters, a dash and 12 hex characters of a hash of its path); `bin/remote.mjs` `remoteMain` writes the record, the lock, the stop marker and the task file, and `bin/lib/remote.mjs` `supervise` writes the log.

### `<id>.json`

The record of the detached supervisor, written by `remote start`.

- `pid`: number, the supervisor's process.
- `startedAt`: number, its creation time in milliseconds, which with `pid` names it.
- `root`: string, the project's folder.
- `name`: string, the environment name the phone shows.
- `logPath`: string, the path of `<id>.log`.
- `startedAtIso`: ISO time of `startedAt`.

### `<id>.lock`

Held while a `remote start` or `remote stop` runs, created exclusively: one JSON line, `{ pid, createdAt }` of that command's process.

### `<id>.log`

Text: the server's own output, and the supervisor's notes as lines starting `[js-harness remote] ` (`logNote`). Trimmed in place past `LOG_MAX_BYTES` (5 MiB) to about its last `LOG_KEEP_BYTES` (1 MiB) (`trimLog`).

### `<id>.stopped`

Text, one line: `stopped on purpose by js-harness remote stop at <ISO time>; ...`. While it is there the watchdog starts nothing; the next `remote start` removes it.

### `<id>.task.xml`

The Task Scheduler definition of the watchdog task that `remote start --at-login` registers (`bin/lib/remote.mjs` `watchdogTaskXml`): a task of the user, every five minutes, running the same command as the login launcher.

## Refresh backups

Copies taken before `merge-queue --land --refresh-copy` installs main over the installed copy, named by the undo line it prints; `bin/lib/refresh-copy.mjs` `refreshCopy` writes them through `backupSettings` and `backupManifest`. `<stamp>` is the UTC time as `YYYYMMDDTHHMMSSZ`.

- `settings-<stamp>.json`: a byte copy of the Claude settings (`<home>/.claude/settings.json`); the newest 5 are kept.
- `package.json.<stamp>`: a byte copy of pnpm's global `package.json` that the js-harness shim names, which `pnpm add -g` rewrites; the newest 5 are kept.

## The advisor gate's decisions

What `advisor-gate --hook` and `--stop` decided for each act that decides (odd/tasks/advisor-use.md, P1, P2), one line a
decision; `bin/advisor-gate.mjs` `record` appends it under the home. Nothing prunes it yet; the report reads it.

### `advisor-gate/decisions.jsonl`

- `schema`: string, `js-harness.advisor-gate/v1`.
- `at`: ISO time.
- `session`: string or `null`, the host session; `agent`: string or `null`, the sub-agent's id.
- `act`: string, `question`, `land`, `session`, `plan`, `done` or `end` (a sub-agent's end); `tool`: string or `null`; `toolUseId`: string or `null`, the tool call's id from the payload, which the report matches the act by; `cwd`: string.
- `secondStop`: boolean, on an `end` only, whether the host had already turned that stop back.
- `decision`: string, `covered`, `flagged`, `outage`, `unchecked`, `exempt-senior` or `exempt-same-model`; `mode`: string, `warn` or `refuse`, on a `flagged` one.
- `transcript`: string, the transcript read; `model`, `calls`, `errors`, `toolCalls`, `broken`: what the stretch held, present once the transcript was read. `advisor-gate report` reads the transcript of each flagged decision again for the advisor calls that followed it.
- `reason`: string, on an `unchecked` one; `title`: string, on an `exempt-senior` one.

## Session env trims

What `backup --session-start` leaves when it rewrites a session's SessionStart env file that the codex plugin grew past
2,048 bytes to the last occurrence of each line (`odd/tasks/session-env-trim.md`); `bin/lib/session-env.mjs`
`trimSessionEnv` writes both, the backup before the rewrite and the record after it. Nothing prunes them yet.

- `<session>/sessionstart-hook-<n>.<stamp>.sh`: a byte copy of the file before the rewrite; `<stamp>` is the UTC time
  with `:` and `.` as `-`, and a `.<k>` before `.sh` when that name is taken.
- `trims.jsonl`, one line a rewrite: `at` (ISO time), `file` (the env file rewritten), `backup` (its copy), `bytesBefore`
  and `bytesAfter` (numbers), `sha256Before` (string, of the text copied), `undo` (string, the `cp -p` that puts the copy
  back).

## The doctor's cache

The doctor's cache of the latest versions fetched and of what was last notified; `bin/lib/cache.mjs` `writeCache` writes the whole object by a temporary file and a rename, and `bin/doctor.mjs` builds each key it changes. A cache that does not parse reads as empty.

- `latest`: `{ checkedAt, versions }`: `checkedAt` an ISO time or `null` (refetched once it is 6 hours old), `versions` an object from a row's id to its latest version string, or `null` when looked up and not found.
- `notified`: string or `null`, the sha256 digest of the gap list last told by `doctor --hook` (`bin/lib/digest.mjs` `gapDigest`).
- `host`, `stack`: the reviews an earlier version kept here, in the shape of the record below; kept as they were, and read only into the record when there is none yet.

## The reviewed versions

The record of the versions last reviewed, moved out of the cache so a torn cache cannot turn a pending update into a reviewed one (M10 of the Fable 5.2 audit, `odd/tasks/audit-u5-atomic-state.md`); `bin/lib/cache.mjs` `recordReviewed` writes it whole by a temporary file and a rename, and `readReviewed` reads it. A key left out was never recorded, so its first reading is; `null`, or a record that does not parse, is unknown: nothing is taken as reviewed until `doctor --host-reviewed` or `--stack-reviewed` records it.

- `host`: `{ reviewed: { desktop, code, at } }` or `null`, the Claude Desktop version and its Code tab CLI version (string or `null`) last recorded as reviewed, and when.
- `stack`: `{ reviewed: { versions, at } }` or `null`, each stack tool's version last reviewed, by id, and when.

## Clean

The measure of the regenerable leftovers on the machine, which doctor's `clean` row reads, and the record of every deletion; `bin/lib/clean.mjs` `writeMeasure` writes the measure (and `cleanRow` marks a background measure's start), `applyKinds` appends the deletions.

### `clean.json`

- `measuredAt`: ISO time of the measure.
- `total`: number, bytes of the kinds measured exactly.
- `upTo`: number, bytes a kind can free at most (the pnpm prune).
- `kinds`: array of `{ id, bytes, items, upTo? }`, `id` one of `codex-releases`, `claude-versions`, `claude-desktop-cli`, `codex-staging`, `temp-scratch`, `npm-cache`, `pnpm-store`, `go-modcache`, `uv-cache`.
- `startedAt`: ISO time a background measure was started, present from then until the measure rewrites the file.

### `clean-log.jsonl`

One JSON line per item deleted, refused or failed.

- `at`: ISO time.
- `kind`: string, the kind's id.
- `path`: string, the item's path, or the tool's command for a cache kind.
- `bytes`: number, bytes freed (0 when refused or failed).
- `result`: string, `deleted`, `failed` or `refused`.
- `error`: string, the error or the refusal's reason, when not `deleted`.
- `after`: number, bytes a cache kind still holds after its tool ran, on cache kinds only.

## The status line

The board said in one line, kept in a file so the host's status-line program only prints it; `bin/lib/status-line.mjs` `writeStatusLine` writes it whole (a file beside it, then a rename), and `statusLineOf` builds the line. It is text of two lines:

- Line 1: ISO time it was written.
- Line 2: the line, at most 200 characters, its parts joined by ` · `: the open questions (`<n> pregunta(s)`, in red when any, `? preguntas` when unknown), `<n> trabajando`, `<n> esperando`, `<n> PR` (`? PR`), and the gate (`gate libre`, `gate ocupado[, <n> en cola]`, `gate ?`).

## The memory backup

The state of the memory backup and the local clone of the private backup repository it pushes; `bin/backup.mjs` `runBackup` fills the clone and `backupMain` records each run, `bin/lib/backup.mjs` `exportEngram` writes the Engram export, and `bin/lib/backup-transcripts.mjs` `copyTranscripts` fills the transcripts clones.

### `config.json`

Written by `backup init` (and by `--transcripts-repo`) whole by rename; `scope` is set by hand.

- `repo`: string, `owner/name` of the private backup repository.
- `bundles`: array of strings, the git checkouts whose unpushed commits, worktree edits and `.git/js-harness` records are backed up.
- `summaryRepo`: string, the checkout whose main the public summary reads, only when `--summary-repo` named one.
- `transcripts`: `{ repos }`, the `owner/name` of each transcripts repository, oldest first; the last takes new transcripts.
- `scope`: string, `all` or one Engram project's name; `js-harness` when absent.

### `last.json`

The record of the memory runs, merged into on each write.

- `lastRun`: ISO time of the last run.
- `lastSuccess`: `{ at, counts, live, committed, pushed, redacted, unreadable, summary, recent }`: `counts` the export's `sessions`, `observations`, `prompts`, `relations`; `live` Engram's `sessions`, `observations`, `prompts`; `committed` boolean; `pushed` number of commits pushed; `redacted` number of files with blanked secrets; `unreadable` the bundle entries git could not read; `summary` a word for the summary step (`off`, `not due`, ...); `recent` the manifest's `recent` entries.
- `lastFailure`: `{ at, error, projects? }`, `projects` the names of projects whose observations shrank, when that was the refusal.
- `lastSummary`: `{ at, pushedAt, commit, hash }` of the public summary last pushed or found current.
- `summaryError`: `{ at, error }` of the last summary that could not be built or pushed.

### `transcripts.json`

The transcripts run's own record, merged into on each write under the transcripts lock.

- `lastSuccess`: `{ at, files, pushed }`, the files held across the transcripts clones and the commits pushed.
- `lastFailure`: `{ at, error }`.
- `rollover`: string or `null`, the next transcripts repository to open when the last one is full.

### `transcripts.lock`

Held while the transcripts run works, created exclusively: one JSON line `{ pid, at }`, `at` an ISO time; taken over after 8 hours.

### `repo/manifest.json`

What the backup holds and the figures a restore checks against (`bin/lib/backup.mjs` `buildManifest`, extended by `runBackup`). It holds no time, so a run with nothing new commits nothing.

- `format`: number, `1`.
- `machine`: string, the machine that made it; another machine needs `--adopt`.
- `engramVersion`: string, `engram version`'s output.
- `export`: the export's counts, `{ sessions, observations, prompts, relations }`.
- `live`: Engram's counts from `engram stats`, `{ sessions, observations, prompts }`.
- `files`: array of `{ path, bytes, sha256 }`, every file copied into the clone, by path relative to it (`claude/projects/<slug>/memory/...`, `js-harness-home/...`, `config/...`, `git/<key>/...`).
- `redacted`: array of `{ path, kinds }`, each file whose secrets were blanked and the kinds found.
- `scope`: string, the scope backed up.
- `bundles`: array, one per configured checkout: `source` (absolute path), `commits` (number on no remote), `refs` (sorted `<sha> <ref>` lines the bundle holds), `folder` (the key of its `git/` folder), `worktrees` (array of `{ path, key, patch, untracked, binary, deletedBinary }`), `skipped` (array of `{ path, bytes?, kind }`), and `unreadable` (string) when git could not read it.
- `recent`: array of `{ project, file, entries, newest, head, observations, directories }`, one per project file of the readable fallback (`bin/lib/backup-recent.mjs` `buildRecent`).

### `repo/RECENT.md`

Markdown, the index of the readable fallback (`buildRecent`): a `# Recent memory` heading, a `format: 1` line, and one line per project naming its file under `recent/<project>.md`, its entry count and its newest day. Each project file holds that project's state and up to 100 important observations.

### `repo/RESTORE.md`

Markdown written on every run and by `init` (`bin/backup.mjs` `restoreSteps`): the steps that rebuild a machine from this repository, the bundled checkouts it clones back into their paths with their origins (credentials removed), and the transcripts repositories.

### `repo/engram/export.json`

`engram export`'s JSON for the scope with its secrets blanked, put in place only when it does not shrink any count by more than a tenth against the last one, and left untouched when only `exported_at` differs. `exportCounts` reads its `sessions`, `observations`, `prompts` and `relations` arrays.

### `transcripts/<repo>/`

A clone per transcripts repository (`copyTranscripts`), holding each `~/.claude/projects/**/*.jsonl` as text, a file over 40 MiB cut by line into `.partNNN` files, and a `manifest.json`: `format` (`1`) and `files`, an array of `{ path, bytes, sha256, modified, parts: [{ path, bytes, sha256 }] }`, `path` relative to the projects folder and `modified` an ISO time; beside them `.gitattributes` and a `RESTORE.md`.

## A restore

What `backup restore` leaves in the home besides the restored memory; `bin/lib/backup-restore.mjs` `restoreBackup` writes all three.

### `restore-progress.json`

The mark that the Engram import is done, so a re-run does not import twice; trusted only while that Engram still holds observations.

- `manifest`: string, the sha256 of the backup's `manifest.json` file.
- `dataDir`: string, the Engram data folder imported into (`<home>/.engram`).
- `importedAt`: ISO time of the import.

### `restored-config/`

The backup's `config/` files copied as reference copies to compare with the live files, overwritten on each restore; never placed over a live file.

### `restored-bundles/`

The backup's `git/` files: each `<path key>.bundle` of commits on no remote, and each checkout's `<key>/` folder with its `worktrees/<key>.patch`, `.untracked` and `.binary` copies and its `.git/js-harness` records. The restore prints the command that uses each one.

## A memory pass

The undo state of memory hygiene passes for one project, kept outside the host's memory folder; `bin/lib/memory-pass.mjs` `planPass`, `verifyPass` and `undoPass` write the pass's files, and `bin/lib/memory-hygiene.mjs` `dueNotice` writes `told`. `<stamp>` is the pass's UTC time with `-`, `:` and `.` removed (`YYYYMMDDTHHMMSSmmmZ`).

### `journal.jsonl`

One JSON line per step; every line has `kind`, `stamp` and `at` (ISO time).

- `plan`: `writeSet` (array of the note names the pass may change) and `notes` (array of the `.md` notes before it).
- `verify`: `indexBytes` (number, `MEMORY.md`'s size after) and `notes` (array of the notes after).
- `verify-refused`: `problems` (array of strings, each what would be lost or changed outside the write set).
- `undo`: `restored`, `removed` (arrays of names) and `refused` (array of `<name> (written since the pass)`).

### `snapshots/<stamp>/`

One folder per pass, the newest 10 kept.

- `manifest.json` (`planPass`): `stamp`, `at` (ISO time), `folder` (the memory folder), `writeSet` (array of note names), `before` (object from each file's name to its sha256 before the pass).
- `files/`: a byte copy of every file of the memory folder before the pass.
- `after.json` (`verifyPass`): object from each file's name to its sha256 after the pass.
- `after-index.txt` (`verifyPass`): the bytes of `MEMORY.md` after the pass, which `undoPass` merges with lines written since.

### `lock`

Held from `planPass` until a verify that passes or an undo: JSON `{ stamp, pid }`, created exclusively.

### `told`

Text, one ISO time: when `dueNotice` last looked at the folder, so the hook looks at most once a day.

## Memory

Engram's store and the host's memory folders, which the harness reads and backs up but does not write: engram writes its store, and the host and sessions write the memory folders. The backup reads the store only through `engram export` and `engram stats` (`bin/lib/backup.mjs` `exportEngram`, `parseStats`).

### engram's store (`~/.engram`)

- `engram stats` output: the `Sessions:`, `Observations:` and `Prompts:` lines, each a count (`parseStats`).
- `engram export` JSON: `sessions`, `observations`, `prompts`, `relations` arrays (`exportCounts`); `buildRecent` also reads each observation's `project`, `type`, `created_at`, `updated_at`, `deleted_at`, and each session's `project` and `directory`.
- `.engram/config.json` in a checkout: `project_name`, the Engram project of sessions there (`bin/lib/backup-fallback.mjs` `projectOf`).

### Claude's memory folders (`<CLAUDE_CONFIG_DIR or ~/.claude>/projects/<slug>/memory/`)

Parsed by `bin/lib/memory-hygiene.mjs` `readMemory`, `<slug>` being the main checkout's path as Claude names it (`D--js-harness`).

- `MEMORY.md`: the index; each non-empty line is read with its number, text, length in code points and the `.md` file its first Markdown link `](<file>.md)` names.
- `<note>.md`: one note each; its `type` is the `type:` key of a front matter opened and closed by `---` lines (`bin/lib/memory-index-guard.mjs` `memoryNoteType`), and its bytes, modification time and text are read.
