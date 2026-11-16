// Two protocols of the orchestrator skill that a lead runs on the user's word: before a reinstall of the machine, and
// a new model or effort (odd/tasks/backup-ready.md, L5; odd/tasks/one-model-home.md, specs 9 and 10); then the
// senior session the lead sends a task to (odd/tasks/audit-cement.md, T7). They are
// sections of the skill's text, which bin/lib/manifest.mjs gives between "The lead" and "A work session". They live
// in a module of their own because the manifest is over the size at which a module stops growing
// (bin/conventions-structure.test.mjs), and a protocol is read whole by whoever changes it. bin/lib/manifest.test.mjs
// holds their wording, beside the skill's other sections.

/** The one brief a senior is started with (odd/tasks/senior-orchestrator.md, D11): its first turn runs on the lead's
 * model, before `set_session_model` applies, so it carries no task. The guard's `seniorStartRefusal` holds a start to
 * it, and the senior section below gives it to the lead. */
export const SENIOR_WAIT_BRIEF = "You are the project's senior session. Run nothing: reply that you are waiting, and wait for the lead's first task.";

/** The one `background` a senior is started with (D14): the tool asks a fresh start for 80 characters of it, and it
 * reaches the first turn as the brief does, so it carries no task either. */
export const SENIOR_WAIT_BACKGROUND = "The lead starts you on its own model; it sets your model and level next, then sends each task as a message.";

export const LEAD_PROTOCOLS = `## Before a reinstall

When the user says they will reinstall the machine or wipe its disk, nothing of the work may live only there. It comes back three ways: git holds the repositories, branches, stashes and edits; \`js-harness backup\` holds the memory, \`~/.js-harness\`, the Desktop notes and the review records; a reinstall list holds the rest (\`winget export\` and \`import\`, Node through nvm, \`wsl --export\` and \`--import\`, and each login, which the harness never enters).
1. Run \`js-harness backup ready\`. Clear each \`missing:\` line (push, commit, \`js-harness backup run\`) until it says yes, or say why that item stays; it covers the readable copy of Engram too (\`RECENT.md\`), which a session reads while Engram is restored.
2. Recall your private checklist of the machine: it names other projects, so it lives in your memory, never in the repository.
3. Resolve each item with the user one at a time, through the question tool.
4. Pause every session at a safe point, then tell the user in capitals that they can restart.
5. After the reinstall, in this order: the logins, \`gh auth login\` first since the backup repository needs it; then \`js-harness backup restore\` and \`js-harness backup verify\`; then \`js-harness doctor\`.

## A new model

When the user says the sessions or the reviews move to another model or another effort, their sentence moves a whole home and nothing beside it: \`rule:session-model\`, \`rule:session-effort\`, \`rule:lead-effort\` and \`rule:lens-effort\` are the home of everything Claude the harness starts, with \`rule:advisor-model\` the advisor of each session \`js-harness sessions start\` starts or resumes, \`rule:review-model\` and \`rule:review-effort\` the home of a Codex review, and no other text holds a value. This is the switch; \`docs/future-model.md\` is the measuring of what the harness is worth on a new model, and neither waits for the other.
1. Take the user's sentence as the source: its session and line (\`js-harness sessions --quote\`), your reading of it, and where they accepted that reading. Switch nothing their words do not name, and never guess a model's id.
2. In a checkout of the harness, on a branch \`rule/<name>\` cut from \`origin/main\`, run \`node bin/js-harness.mjs rules switch [--claude <model>@<effort>] [--lead <effort>] [--lenses <effort>] [--advisor <model>] [--codex <model>@<effort>] --quote <session>:<line> --reading "<reading>" --accepted "<where>" --dry-run\`: it prints what it would write and what its probe costs, and asks no model.
3. Run it again without \`--dry-run\`. It asks each new model, at each new level, one short question through the installed CLI, and writes nothing when the CLI refuses the id or the level, when another model answers, or when Codex is at or under \`rule:codex-weekly-floor\`. A probe proves the id and that the CLI took the level, never the effort the model then works at. With an advisor, each pair is asked to consult it once, and nothing is written unless it answers.
4. Make the commit it prints: one commit for the rules of the home, or with \`--rule-by-rule\`, on the user's no to one commit, a commit a rule in the order it prints.
5. Run the gate and both reviews from the branch's copy (\`node bin/js-harness.mjs codex-review\`, \`node bin/js-harness.mjs lens-review\`), so the slice is reviewed on the new model; read \`js-harness codex-meter\` before the Codex review.
6. The pull request waits for the user's yes (\`rule:owner-decisions\`). Land it with \`js-harness merge-queue --land --refresh-copy\`: the hooks and every session read the installed copy.
7. Then the sessions. \`js-harness rules applied\` lists each one off the home with the act that corrects it, since no session changes its own model or effort: the host's session tools for another open session, the line it gives for the user's menu where the session is the user's to set, a resume for a background job. Run it again until it lists none, and say what it could not read.
8. Give the user, as it is printed, what the switch leaves outside the repository (their settings, which it reads and never writes) and what a new model may make stale that no rule holds.

The day before a switch of Codex's home lands, check three things: the id the installed \`codex\` takes (the probe of step 3, one cheap call, said before it runs); that \`js-harness codex-meter\` still reads its limits; and that a review of one small slice runs end to end from the branch's copy. A switch of Codex's home moves the figures too: the plan of a review estimates from every measured part until five parts exist on the new model and effort, so its first estimates come from the model that leaves, and \`rule:codex-review-rate\`, \`rule:codex-review-floor\` and the double review's measured cost were measured on that model.

## The senior

Where the project declares \`rule:senior-model\`, one senior session stands beside the work sessions: titled \`<code> SR · <purpose>\`, started by you as a visible app session on a turn the user typed: \`start_session\` with that title, \`initiation\` "user_asked", \`effort\` at \`rule:senior-effort\`, no \`model\` (the tool caps a start at yours) and its own worktree, with the \`prompt\` "${SENIOR_WAIT_BRIEF}" and the \`background\` "${SENIOR_WAIT_BACKGROUND}" and nothing more, since its first turn runs on your model; then, in that turn, \`set_session_model\` to \`rule:senior-model\`, \`set_session_effort\` to \`rule:senior-effort\` and \`detach_session\` to top level. No advisor is named, since its model under \`rule:senior-model\` is the advisor's (the user's settings still give it one). The guard refuses a start that breaks any of these, and a message to a senior whose app record is off \`rule:senior-model\` or \`rule:senior-effort\`, so send it messages by its \`local_…\` id. It is long-lived and runs nothing until you send it a task as a message; send it one when, in your judgment, the task needs more intelligence or complexity than a work session brings, such as a design, an audit or the strongest reader of a proposal. Its sub-agents name a model (\`opus\` where \`rule:session-model\` declares that alias), never inherit the senior's, and it reports through the same notices as any work session.`;

/** `LEAD_PROTOCOLS` without its last full stop, for a text that writes that stop itself after the placeholder. The
 * list of rules cuts a rule's sentence after the last full stop of its home's source (`sentenceOf` of
 * ./rules-check.mjs), and a placeholder holds none: without the stop, the sentence of the rule whose home follows
 * these sections would open with the placeholder's name. */
export const LEAD_PROTOCOLS_OPEN = LEAD_PROTOCOLS.replace(/\.$/, '');
