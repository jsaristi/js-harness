// The third skill, `js-harness-protocols`: what to do in eight situations, loaded only when a session is in one of
// them. One skill and not eight, because the description of every installed skill is read on every turn. The design
// is in odd/tasks/rule-hierarchy.md ("Protocols", T7). Each section opens with the incident it came for and its
// date, so that it can be withdrawn when the incident has not come back; a rule it relies on is named by its id
// (`rule:<id>`), never restated, so `js-harness rules change` reaches it with nothing to carry by hand.

/** The eight situations, in the order of the index and of the sections. */
export const PROTOCOLS = [
  'Asking the user for a decision',
  'Closing a reply',
  'Running something that costs: a gate, an eval batch, a review, a push',
  'Changing a rule, a new one included',
  'Reporting a mistake',
  'Handing off, to the user, to a session or to a sub-agent',
  'Reviewing throughput',
  'Writing a new command, module or document',
];

export function protocolsSkillContent(version) {
  return `---
name: js-harness-protocols
description: Use before asking the user for a decision, closing a reply, running something that costs (a gate, a review, a push), changing a rule, reporting a mistake, handing work off, reviewing throughput or writing a new command, module or document (js-harness v${version}).
---

# Protocols

Read the section of the situation you are in:
${PROTOCOLS.map((title, i) => `${i + 1}. ${title}.`).join('\n')}

Each section opens with the incident it came for and its date. A section whose incident has not come back is withdrawn when the user decides. A situation that has no section is reported and proposed to the user, never written as a protocol by the session that met it.

## 1. ${PROTOCOLS[0]}

Incident (2026-10-09): a session stopped and waited 17 hours for the user's yes to run its own gate, push and pull request, none of which was the user's to decide.

- Ask only what is the user's; the project's \`CLAUDE.md\` or \`AGENTS.md\` says what that is. Decide everything else, say what it costs, and go on.
- A push goes unasked where the project's \`pushUnasked\` switch reads on (\`js-harness functions\`); where it is off, a push is asked first, as any other decision.
- Before the question, say what a yes covers in everyday words, what it does to the user, what it does not authorize, and what the other option means. Put a choice as an everyday situation with its options A and B.
- One decision a question, one question at a time, never while work runs. Where an orchestrator holds its role, the question goes through it (\`js-harness-orchestrator\`, "Questions to the user").
- A question asked again says first that the earlier answer still holds, and what changed since.
- A short answer that fits two readings is asked about, not guessed.
- A proposal that changes one of the user's decisions, whether a design before it is built, a plan, an analysis with figures, a protocol or a change of the charter, asked or reported, first passes two read-only readers that did not write it: one attacks its claims, one looks only for what is missing. The writer searches the user's earlier words on the subject and names the search. Each reader gets the whole text, the user's words and the paths it cites; the findings go in the feature document, or the orchestrator's notes when there is none. The version the user gets says what each reader changed and what stays unguaranteed; where readers disagree the writer decides on evidence, and what is not settled is unguaranteed. A second round reads only the first round's blockers; what is still open after it goes to the user as unguaranteed, never a third round. Readers run on the reader model the rules give, or where none is declared on the session's own model; a host with no sub-agents asks another session. Code is not this: it has its reviews (section 3). Not for a question of fact (a figure or an outcome looked up, nothing proposed), nor for a step or a choice whose reviewed text the question names by path.

## 2. ${PROTOCOLS[1]}

Incident (2026-10-07): a block meant to hold the user's answer was worded as an instruction ("run the lean review on Codex 0.160.1") and was read three times as a task for the user to run.

- A reply ends in one of five states. Working: the user sends nothing; say what wakes you and what you report next. Decision: one question, never while work runs. Question: an open question of the conversation that the user answers in writing, not with buttons, asked on that line, so the session is taken as neither working nor finished. Cut: what the user sends to open the next session. Finished: name the session to return to.
- Text the user copies sits in one code block that holds only that text, under what it is, where it goes and what sending it does; never an instruction to the user. Two such blocks are numbered in the order they are sent.
- Before a decision or a cut, say what was done, what is next and why, and for which session.
- Then the map: each phase's share and the total, from \`js-harness progress\`; if it fails, say so.
- A cut comes at the end of a task: a new session when a feature closes, a pull request merges or a phase starts. Do not start a task the context will not hold.

## 3. ${PROTOCOLS[2]}

Incident (2026-10-10): a check and the step it should allow were joined by a semicolon in one command; the check printed that a gate was alive, and the reviewer ran beside that gate anyway.

- Say its count first: how many runs, and what each costs.
- One try. When it fails, read why before anything runs again; never retry in a loop.
- The proof is read before the command it allows. Two steps share one command only when the second is conditional on the first (\`&&\`, never \`;\`).
- A review's verdict is read before the next command. Give a review, by its hash, a base on the head's first-parent line: the last reviewed boundary, the commit that merged the default branch in, or \`git merge-base <default branch> HEAD\` when it never was; never the name of a branch that moves, since a base the head is behind puts the newer work of that branch in the range, reversed. After the default branch is merged into a branch, the base of the range to review is that merge commit, even where an older boundary was reviewed.
- A stacked pull request is merged after its base, or its base is changed before the one under it is merged.
- Run the installed \`js-harness\`, not your branch's \`node bin/js-harness.mjs\`, except to test your own change: a branch's copy lacks what main gained since it was cut, and five ready notices were never sent because their branch's notify had no \`--pr\` (2026-10-17).
- A review candidate is a work-unit commit or a slice, never the whole branch. Before the push, every slice of code goes through Codex where the project's \`codexReview\` switch is on (\`js-harness codex-review --base <boundary>\`) and through the Claude lenses where its \`lensReview\` switch is on (\`js-harness lens-review --base <boundary> --lenses <pertinent> --reason <why>\`): the push and the merge queue refuse a code commit the record of a review that is on does not cover. A review that cannot run is recorded with its \`--unavailable <reason>\`, a debt that \`check\` lists until a review pays it.

## 4. ${PROTOCOLS[3]}

Incident (2026-10-11): the user found a 73 percent mark still read as in force after the share of its context at which a session writes its state had changed three times in two days, each time carried by hand to the places that stated it; the old value stayed beside the new one, and the user called it systemic and repeated.

- A new rule or a new protocol first passes five questions: did it happen; twice, or once at a cost; can a check do it; can an existing one be amended, the search of \`rule:reuse-first\`; what does it cost and what leaves.
- A rule is recorded only where something acts on it, in this order of preference: a check a command runs, a line of \`CLAUDE.md\` or \`AGENTS.md\`, a protocol. A memory note is never its home.
- One home. A value is a constant in code that messages, skills and tests read; a rule in prose is one text with its id. Every other text names the rule and does not repeat it. A rule of another tool is not copied.
- One act. In the harness's own checkout, \`js-harness rules change <id>\`, on a \`rule/\` branch, writes the declaration, its source and the rendered list in one commit; a revert and an urgent change are the same command. In a project, its own rules are \`docs/rules.json\`, edited by hand, and \`js-harness rules check\` refuses a phrase gone from its file or a rule deleted instead of retired.
- A rule that leaves is retired, never deleted: it keeps its id, with its date and its successor. Text it superseded is removed, not annotated.
- A rule of the user's changes only with the user's words: the quotation, its date, and where they accepted the reading of it.
- Done: \`js-harness rules check\` exits 0.
- Cost: one command and one commit a change, and this section, read only when a rule changes. Reviewed by 2026-11-16.

## 5. ${PROTOCOLS[4]}

Incident (2026-10-10): a mistake was reported only as what had gone wrong; the user had to ask how it would be fixed now, what would stop it recurring and how that would enter the harness.

Five parts, in everyday words:
1. What happened.
2. The fix now, and whether it is checked or only sent.
3. What stops it from happening again: a check before a line, a line before a protocol.
4. Where that enters: which level, which feature and session build it, and when.
5. How it will be proven later that it has not come back: a command that exits 0, or a count read from files. "We will watch for it" is no proof.

Where the project keeps \`docs/FAILURES.md\`, the mistake is a new \`- Seen:\` line of its entry, or a new entry; \`js-harness failures\` computes its state.

## 6. ${PROTOCOLS[5]}

Incident (2026-10-10): a figure that was arithmetic and never measured, that three shards would bring the gate near 500 seconds, was passed to the user as what brings the gate down, and the user approved on it.

- Bad news first. Then what was done; what was checked and how (the command and its output, or \`path:line\`); what was not checked; what failed; what stays open. "Not checked" and "failed" are always filled, with "nothing" when that is true.
- Every claim is one of three: checked, with its evidence; assumed; or not known. An estimate says that it is one.
- What another session, a sub-agent or the user reports as done outside the session is a claim: check one thing of it before building on it.
- A claim that something is absent names the search that proves it, and why that search could have found it.
- A sub-agent runs on the model and effort that the rules in force give its kind of work (\`rule:subagent-reader-model\`, \`rule:subagent-writer-model\`, \`rule:subagent-effort\`; \`js-harness rules <id>\` prints one); the guard refuses another model where those rules are in force.
- A plan or a design handed on has passed its double review first (\`rule:double-review\`, section 1).
- What the user reads to understand or decide (research, a proposal, an audit, a map, a report) reaches them in their language as a visual, didactic page (\`rule:reports-spanish-visual\`): an Artifact with diagrams, bars and cards, never a raw markdown file; the repository's English document stays the source.

## 7. ${PROTOCOLS[6]}

Incident (2026-10-16): JH 28 sat 239 minutes idle, 194 of them after its pull request landed, and a red land from a flaky test was relayed as a guess while the gate log held the failing test names; neither was seen until the user asked where the time went.

The measure, the trigger and the re-measure are commands: the heartbeat's \`DUE:\` line names the review and what to run, and \`js-harness throughput\` prints the table. This section is the judgment no command makes.
- Candidates: each with its baseline, target, cost, owner, risk item, and why quality is unchanged: no check, review or test is removed or weakened, and the land's proof never shrinks. Each figure is marked measured (with the row of the table it comes from), derived, or estimate.
- Readers: only when a candidate list goes to the user, never on the daily review: it first passes the two readers of section 1 (\`rule:double-review\`), one rerunning the figures and attacking the reasoning, one looking for what is missing; the version the user gets lists what they changed.
- Stop rule: a candidate whose gain is less than its cost is dropped, and why is written down. Record each review with \`js-harness throughput reviewed --day <day> --found nothing|candidates\`, and what ships with \`js-harness throughput shipped <item>\`. After \`rule:throughput-quiet-runs\` reviews in a row that found nothing, the review comes every \`rule:throughput-quiet-days\` instead of daily; one that finds candidates makes it daily again.
- The user's decisions: spend, a protocol change, a security or system setting, anything irreversible, one question at a time (section 1). The lead assigns everything else.
- Five questions: it happened (the incident); twice in a day, at a cost of up to 64.4 session-hours of turns that ended in silence over two days; a check does the measuring, the trigger, the snapshots and the re-measure, so only this judgment is prose; no section held a recurring review, and sections 1 and 4 are named, not copied; its cost and what leaves follow.
- What leaves: the hand-written measure scripts in the lead's notes.
- Cost: one command a day, weekly once quiet, and two readers only with a candidate list. Reviewed by 2026-11-16.

## 8. ${PROTOCOLS[7]}

Incident (2026-10-21): the user found the harness written one way in one part and another way in the next, with nothing that would make a later model write the way the rest is written; the drift stood exactly where no rule was written: the wording of a refused flag, how an error is signalled, how shipped text names the user.

- Before adding a command, an option, a function, a protocol, a rule or a document, search for one that already does it (codegraph_explore, \`js-harness rules\`, the protocols and the skills); amend that one instead of adding a second, and say in the commit what was searched.
- Read two neighbours of the same kind first, and write the way they do: the header comment that says what the file is for and why, the shape of its exports and errors, the test beside it.
- The project's conventions are held by tests that state each rule in their header and say how to comply; in js-harness, \`bin/conventions-*.test.mjs\`. Run them before the commit, not after a red gate.
- A file on a convention's legacy list that you touch is made to comply, and leaves the list in the same commit: the list only shrinks.
- A new convention is a test with its legacy list, written once where it is enforced; never a conventions document, which restates the rules and is not read while code is written. What no test can judge (a pure core with the I/O at the command's edge, the voice of the text, how precise a name is) is the reviewer's, on each diff.
- Five questions: it happened (the incident); the drift was found in three places at once; the checks do the holding, and this section only points at them before the first line is written; no section covered writing; it costs one section read when a new file is written, and no conventions document leaves because none was written.
- Cost: this section, read only when a new command, module or document is written. Reviewed by 2026-11-21.
`;
}
