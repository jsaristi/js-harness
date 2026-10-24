// The install/sync/uninstall engine: components are data, so adding one never
// touches the fs-walking logic below, and uninstall can undo exactly what install wrote.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync as spawnChildSync } from 'node:child_process';
import { cachePath } from './cache.mjs';
import { gateDir, readGateHolder, readGateWaiters } from './gate-lock.mjs';
import { gateLogDir } from './gate-log.mjs';
import { channelDir } from './channel.mjs';
import { gateFirstDir } from './gate-first.mjs';
import { locate, lookUpProcesses, readState, remoteDir } from './remote.mjs';
import { ruleValue } from './rules.mjs';
import { LEASE_MINUTES, WAIT_MS } from '../permit.mjs';
import { INDEX_LINE_CHARS } from './memory-index-guard.mjs';
import { SHARE_TOLERANCE } from './audit.mjs';
import { LEAD_OPENING_PROMPT } from './lead-prompt.mjs';
import { protocolsSkillContent } from './protocols-skill.mjs';
import { hygieneDir, purgeMarker } from './memory-hygiene.mjs';
import { readLock } from './memory-pass.mjs';

/** Minutes as the hours a skill states, to one decimal place at most: rule wait-for's 480 reads "8". */
export const statedHours = (minutes) => String(Math.round(minutes / 6) / 10);

function skillContent(version) {
  return `---
name: js-harness
description: Install, update, and check js-harness (v${version}) status and commands, run a memory hygiene pass when one is due, and recover the memory when Engram's is empty, failing or its tools are missing.
---

js-harness commands:
- \`js-harness status --global\` — installed version, manifest version, and latest available, for the machine.
- \`js-harness install\` — write the skills and the session-start hook entries, and record a manifest under the home.
- \`js-harness sync --global\` — re-write installed files for the running version.
- \`js-harness update\` — say whether a newer release exists, and how to get the newest copy when none is tagged.
- \`js-harness upgrade\` — install the newer release, the repository's newest \`vX.Y.Z\` tag (\`--repo <url or folder>\` names another), or the newest tarball of a folder of \`npm pack\` tarballs (\`--source <dir>\`, which wins when named), then sync; with no release tagged it installs nothing and exits 1.
- \`js-harness uninstall --global\` — remove exactly what install wrote; it keeps the memory snapshots, the only copy of what a memory pass changed, and \`--full\` removes them too.
- \`js-harness codex-review --base <rev>\` — run \`codex exec review\` over <rev>..HEAD and record it, only when its successful commands showed every changed line of the patch; \`--unavailable <reason>\` records a skip when Codex cannot run. Where the project's \`codexReview\` switch is off at HEAD it starts nothing and records nothing.
- \`js-harness check\` — the gate of a commit. Its sensors run one gate at a time on the machine: it waits for its turn, in the order the gates arrived, and gives up once the lock has gone ${ruleValue('gate-wait', 'minutes')} minutes without changing hands (\`--wait <minutes>\`), or refuses at once (\`--no-wait\`). A gate that passes prints one line, with the review's verdict; \`--verbose\` (\`JS_HARNESS_CHECK_VERBOSE=1\` for a hook) prints every row, as a failing gate does.
- \`js-harness gate -- <command>\` — a heavy run that is not a commit's gate (a whole test suite by hand, a batch of evals), under the same lock: it waits for its turn like a gate (\`--wait <minutes>\`, \`--no-wait\`), is stopped after ${ruleValue('gate-max', 'minutes')} minutes (\`--max <minutes>\`), and its exit code is the command's.
- \`js-harness check --push\` — the gate a push must pass, and the only check it runs: every code commit since the remote's default branch lies in a recorded Codex review (\`--remote <name>\`, default origin). Where \`codexReview\` is off at the pushed commit it asks for none; the first push to a repository that holds no branch passes and says what went unread.
- \`js-harness functions\` — each function a project can turn off and on (\`harness.json\` "functions": the code map, the TypeScript language server, the Codex review), its value here and why; \`functions apply\` makes the clone what they ask, \`functions set <name> <value>\` writes one.
- \`js-harness rules\` — the rules in force: the harness's, and the project's own in \`docs/rules.json\`, each in prose (a file and the phrases that find it), enforced by a sensor, or retired; \`rules check\` and the gate refuse a phrase gone from its file, a sensor no longer declared, or a rule deleted instead of retired. In the harness's own checkout, \`rules change <id>\` is the one command that changes one of its rules, and the gate's \`rules\` row reports a line a commit adds that restates a rule's value instead of marking it \`rule:<id>\`, and fails it once that rule refuses. Its turn-start hook, \`rules --hook\`, tells a session once when the rules on the default branch changed since its merge base, after a compaction too and to a sub-agent at its start.
- \`js-harness report [--since <time>] [--mark]\` — the facts a status report is written from, since the last report: the pull requests merged into the default branch with their commits, each session's last notice, the questions answered and still open, and the roadmap phase by phase with what is left; \`--mark\` records this report as the last one, in the channel record under the home.
- \`js-harness sessions\` — the board of the project's Claude Code sessions, worktrees, running gates and open pull requests, read-only; \`--watch\` waits and returns when it changes. The \`js-harness-orchestrator\` skill says how sessions share a project.
- \`js-harness notify --to orchestrator|<number> --kind <kind> "<one line>"\` — append a notice to the project's record of notices between sessions, kept under the home and not in the repository; the orchestrator's watch wakes on one addressed to it. A question to the user is \`--kind question\`, with its fields as JSON on standard input.
- \`js-harness wait (--pr <number> | --main-has <commit> | --main-file <path> --contains <text> | --notice-to <role or number>)\` — ends when the pull request is merged, origin/main holds the commit or the text, or a notice is addressed to the role; it checks at once and then every ${ruleValue('wait-every', 'seconds')} seconds, gives up after ${ruleValue('wait-for', 'minutes')} minutes (\`--every\`, \`--for\`) with exit 1, and says what it waited for; a work session's wait also ends on a notice to its own number (exit 3), printing it and the same wait to run again; run it in the background and stop it with TaskStop when it is no longer needed. TaskStop has been seen to end the shell of a background command and leave its node process running (2026-10-14): check that none is left.
- \`js-harness loop (run <name> --purpose <text> --until <text> -- <command> | status | stop <name>)\` — runs a session's background loop under an owner record, lists the project's loops with their owners, or stops one with every process it started; a loop another session owns is not stopped without \`--take-over\`.
- \`js-harness guard --hook\` — the PreToolUse hook install registers: it refuses a sub-agent launched on a model the project's rules do not give (only where those rules are in force), a message to another session whose opening hour is more than a minute off the clock, with the right hour, a command typed into the user's terminal that does not end with a note saying what it does (only where the project's rule \`terminal-note\` is in force), a session started with \`start_session\` that names no effort or one above the project's rule \`session-effort\` (only where that rule is in force; a fork cannot set its own, so start it \`fresh\`), a session started with a title that is not \`<code> <n> · <purpose>\` with the project's code, harness.json \`"code"\` (only where the rule \`session-title\` is in force; the reason names the next free number, which \`js-harness sessions --next-number\` prints, or says to declare the code), a Bash command with backticks inside double quotes, a recursive \`rm\` or an \`rmdir\` of a folder at the top of a drive (the host holds that one for the user even in bypass mode, so put practice and scratch folders below the project's worktrees folder or in your scratchpad), and a \`node --test\` of several files while another gate holds the lock, and a Write or Edit that puts a line over ${INDEX_LINE_CHARS} characters in a project's memory index (\`MEMORY.md\`). A \`git commit\` or \`git merge\` wrapped in \`js-harness gate --\` runs, with a hint beside its result: the wrapper holds the lock for the commit's whole gate, which then runs here and never goes to GitHub, while a plain commit waits for its turn by itself. Its \`--stop\` form is the Stop hook beside it: a reply that states your own context share more than ${SHARE_TOLERANCE} points from the share your transcript records is turned back, and you correct the share in one line from get_usage.
- \`js-harness permit\` — the PermissionRequest hook install registers (\`--hook\`): while the orchestrator holds the relay (\`lease\`), a permission card of another session reaches it first and waits up to ${WAIT_MS / 60_000} minutes for \`allow <id>\` or \`deny <id> --reason <text>\`; with no verdict the card reaches the user. \`list\` shows the waiting cards.
- \`js-harness reply --hook\` — the Stop hook install registers for Claude Code and Codex, acting only where the project's \`harness.json\` holds a \`reply\` key: a reply that does not close with exactly one state line (working, decision, question, cut, finished, in the labels the key names) and what that state needs is turned back, and you write the close again in your next words. On Claude Code a work session that ends its turn holding work the orchestrator handed it, with nothing in its background to wake it, is turned back once, with the wait to arm.

Without \`--global\`, \`status\`, \`sync\` and \`uninstall\` act on the project inside an initialized repository
(report it, move it to its pin, undo it) and refuse in a git repository that is not one.

## Memory hygiene

It exists because on 2026-10-15 one project's memory index had grown from 233 to 10,917 characters in 18
days, read on every turn of every session, with rules kept where nothing acts on them. Memory holds facts of
the machine; a rule belongs in a check, a line of \`AGENTS.md\` or a protocol.

- \`js-harness memory status\` says whether a pass is due and why (exit 1 when due). Run a pass at a task
  boundary, never while a gate runs: the orchestrator when there is one, otherwise the session that was told.
- \`js-harness memory plan <note>...\` takes the lock, snapshots the folder and names every file the pass may
  change, create or delete. Edit only those.
- Alone you may: shorten an index line to ${INDEX_LINE_CHARS} characters, moving what it held into its note; add the line of
  a note that has none; drop a line whose file is gone. Everything else goes to the user, one question at a
  time through the orchestrator: a rule note leaves memory only after the user's words in it are in the
  repository (the rules' sources, the roadmap or a feature document), and never delete a note on your own:
  the deletions are asked as one list. A contradiction their newer dated words settle is settled by them and
  told in the recap.
- \`js-harness memory verify <stamp> [--approved <note>,...]\` checks the pass and records what it left; it
  refuses a lost quotation, a deletion not approved, or a file another session wrote meanwhile. Fix and verify
  again, or \`js-harness memory undo <stamp>\`, which puts back only what nobody wrote since.
- Report the index bytes before and after, what was checked, what was not, and what waits for the user.
- This protocol is withdrawn after six passes in a row with nothing due but the clock and nobody using it.

## When Engram fails

Engram is the memory; when it holds nothing of the project, errors, or its tools are missing, the backup keeps a
readable copy: \`RECENT.md\` and \`recent/<project>.md\` in the private backup clone
(\`~/.js-harness/memory-backup/repo\`), rebuilt at every \`js-harness backup run\` with the project's last 100
important observations in full. The session-start notice names the file when Engram lost the project.
1. Read the file's head first (the lines the notice or \`RECENT.md\` gives: the state and an index with each
   entry's line), then only the entries you need, by that line. Never edit these files: each run rebuilds them.
2. With the clone gone, find the private repository with \`gh repo list --visibility private\` and read the file
   with \`gh api -H "Accept: application/vnd.github.raw" repos/<owner>/<name>/contents/recent/<project>.md\`.
3. Tell the user that Engram is down before work that depends on past decisions.
4. Once \`engram stats\` answers, bring it back with \`js-harness backup restore --from "<clone>" --merge\`, which adds
   only what Engram lacks. Never \`js-harness backup run --allow-shrink\` after a wipe: it would replace the good
   copy with the wiped memory.
`;
}

/** The second skill: how several sessions share one project. A session that supervises the others reads
 * the orchestrator's part, a session that works next to others reads the work session's; the design is
 * in odd/tasks/session-board.md ("The orchestrator"). Every line is paid each time a host loads it. */
function orchestratorSkillContent(version) {
  return `---
name: js-harness-orchestrator
description: Use when asked to lead, orchestrate or supervise the other sessions of a project, and in a work session that runs while other sessions of the project are open, for how it prompts and how it closes (js-harness v${version}).
---

# Several sessions, one project

Two kinds of session. A work session owns one feature: its worktree, its feature document (\`odd/tasks/<feature>.md\`) and its own prompts. The orchestrator, the lead, is a dedicated session that owns no feature and keeps the project's work moving. Follow the part that is yours.

A background task a session starts (a wait, a watch, a timer) says in its description what it is for and what ends it, and the session writes it to its state with who stops it; when its condition resolves another way, it is stopped in that same step. After a compaction, the resume names each one still open.

A change does not exist until it is in a file. Where each thing lives:
- the project's plan (the order of the features, the decisions): the roadmap on the default branch, changed through small documentation pull requests;
- a feature's plan (tasks, progress, next step): its feature document on its branch, written only by the session that owns the feature;
- the notices between sessions (a session opened, waits, closed; a question to the user and its answer): the project's record, appended with \`js-harness notify\` and read on the board;
- what is in flight between sessions and in neither of those yet (the user's decisions, what each session is for) and, at its head, the charter of what the lead does alone: the orchestrator's relief file;
- the rules in force, each a value or a sentence with its id: the list \`js-harness rules\` prints, where a rule is changed by its own command; read the list, not the relief file, for what a rule says;
- the facts (who works, what runs, gates, branches, context sizes, the questions still open): stored nowhere, computed by \`js-harness sessions\`.

## Questions to the user

Every question of the project reaches the user in one place: the orchestrator's chat, through the host's question tool, one question a call, the recommended option first. Only where the host has no question tool is a question written out with its options.

- Every question opens with what it is for: the work it belongs to, by the name the user knows (the project, the feature, the session), and what its answer changes. The user runs several works at once and answers from the phone; a question that does not say which work it serves gets answered for the wrong one.
- A question is recorded before it is asked: \`js-harness notify --to orchestrator --kind question\`, with its fields (\`text\`, \`options\`, \`waits\`) as JSON on standard input. It prints the question's number and the words its text is headed by in the tool: that heading is how the answer is joined to its question.
- The question tool holds the session that calls it until the user answers. So it is called at once only when the user wrote in that session a short while ago; otherwise in the reply to their next message, and until then a reply says in one line how many questions wait. \`notify\`, the board (\`to ask:\`) and the resume after a compaction print this rule for the moment.
- The answer is recorded once given: \`--to orchestrator --kind answer --question <n>\`, with \`--transcript\` and \`--line\` naming where the user's words are, and the session that asked is rung. \`--to orchestrator --kind withdrawn --question <n> "<why>"\` closes one that no longer needs an answer.
- A session the host holds on a card (the board's line that a call has had no result and the host may be holding it for approval, or a session the host marks as needing the user) is brought to the user in the orchestrator's chat in that same turn, through the question tool: which session, what its card asks, read from its transcript's last call, and what you recommend. The card itself is answered by the user in that session's window; never stop the session to get around it, and never leave it for them to find.
- The permit relay (\`js-harness permit\`): while you lead, hold it with \`js-harness permit lease\` at your start; \`js-harness wait --notice-to orchestrator\` renews it on each tick while you hold it, and a watch of your own must run \`js-harness permit lease\` again at each re-arm (it lasts ${LEASE_MINUTES} minutes; when it says another session holds it, you are the new lead, add \`--take-over\`). A card of another session then reaches you first, as a \`permit <id>\` note, and waits for you up to ${WAIT_MS / 60_000} minutes: read what it asks (\`js-harness permit list\`, and that session's transcript when the command alone does not say why) and answer in time. \`js-harness permit allow <id>\` when it stays inside that session's own work (its worktree and scratch, its own branch and pull request, a test or a build); \`js-harness permit deny <id> --reason "<why>"\` when it is obsolete or unsafe. A card that touches what is the user's (spend, publishing, anything irreversible outside the project, credentials, their security settings), or is important enough to be their call, you never decide alone: bring it to them in the orchestrator's chat that turn, through the question tool, with which session asks, what the call would do, and what you recommend and why; then apply their choice with \`js-harness permit allow <id>\` or \`js-harness permit deny <id> --reason "<their words>"\`. When they answer after its wait, the card is already in that session's window: they answer it there. A card you leave unanswered reaches the user after its wait: bring it to them as above. Before you are relieved, \`js-harness permit lease --off\`.
- A question that puts a plan, a design, an analysis or a protocol to the user has passed its double review first (\`rule:double-review\`, \`js-harness-protocols\` section 1), and says what its readers changed, or names by path the reviewed text it rests on.
- The board lists every question still open, and whether it is recorded and not shown yet, on the user's screen, closed without an answer, or answered and not carried yet.

## The lead

What you run:
- \`js-harness sessions\` — the board: each session's state, context size, open background work and the tail of its last reply, then the work sessions that hold work you handed them and have made no commit, notice or gate for ${ruleValue('session-stall', 'minutes')} minutes (\`Stalled\`), the worktrees with their feature plans, the running gates, the open pull requests and your relief file. \`js-harness loop heartbeat\` ends on such a session too, with a \`STALLED:\` line, and on a red daily Windows run not told before, with a \`WINDOWS:\` line that names its failing tests. It also keeps each settled day's throughput snapshot and ends on a throughput review that falls due, with a \`DUE:\` line that names the commands to run; every line that ends it is followed by the \`DUE:\` lines still open.
- \`js-harness sessions --watch\`, in the background — your way of waiting. It is silent until the board changes in a way that needs a decision, then prints the changes and the board. Launch it again each time it returns. A return with "nothing changed" is not news: relaunch it and say nothing.
- Resting: when a fresh board shows no work session running, nothing waiting on you and no pull request to land, stop every timed watch and wait with one \`js-harness wait --notice-to orchestrator\` in the background. It ends only on a notice to you or after ${statedHours(ruleValue('wait-for', 'minutes'))} hours, so a quiet stretch wakes you once, not every half hour.
- \`js-harness progress\` — the map: the roadmap's phases and the features, from their checkboxes; \`--pace\` gives the tasks closed and added each day on the default branch.
- \`js-harness loop run <name> --purpose "<what it is for>" --until "<what ends it>" -- <command>\`, in the background — each loop you keep (\`js-harness loop heartbeat\`, \`js-harness loop channel-watch\`, a merge keeper): it records you as its owner, runs the command, and its end wakes you. \`js-harness loop status\` lists the project's loops with their owners; \`js-harness loop stop <name>\` stops one of yours and says only when nothing of it is left.

What you may do:
- What you do alone and what stays the user's is the charter the user approved, at the head of your relief file: read it there, act inside it, and ask before anything it does not name. Within it you open the next feature's work session, send plan steps and notices to work sessions (\`js-harness notify\`), merge pull requests by the rules below, remove the worktrees of merged features and update the installed command.
- You never implement, never commit, never write in a worktree and never answer a question for the user: you ask it, and carry their answer. Reading code, running tests and discussing a design are what fill a context, and yours has to last. One exception, in the harness's own repository, approved by the user with the protocol for changing a rule: you may run \`js-harness rules change\` from a checkout of a \`rule/\` branch and commit what it writes.
- You never write another session's prompts: each session owns its work and holds its context. The one exception is the opening prompt of a new work session, which carries pointers and not content: what to read first, the decisions already taken, how the machine is shared. Store it with \`js-harness notify --opening "<title>"\` (its text on standard input): it prints the session's first message as a block of its own, which the user copies as it is. When the host gives you a tool to start sessions, open the new session yourself with that message, on your own judgment and within the room the gate leaves. Every work session is titled \`<code> <n> · <purpose>\`, \`<code>\` being the project's own identifier in harness.json \`"code"\`, the title you give \`notify --opening\` and \`start_session\` alike, with \`<code> <n>\` from \`js-harness sessions --next-number\`: the number is the session's address, so a free title or a number another session holds sends notices to nobody or to the wrong one. A new lead is titled \`<code> ORQ · <purpose>\`.
- Ready pull requests are landed with \`js-harness merge-queue --land\`: it builds the candidate the default branch would be, tests it on this machine and on the project's CI, and pushes it when both are green; \`--dry-run\` first shows what it would land and what it leaves out, and why. After a land that moved main, \`js-harness merge-queue --land --refresh-copy\` also brings the installed copy the hooks run up to that main and prints its undo; a land that moved nothing refreshes nothing. Where the queue cannot run, a pull request is merged by hand by the rules that follow.
- A pull request that changes code is merged on a green run of the project's CI whose checkout says it tested \`Merge <head> into <base>\`, with that base the default branch as origin has it now. A run on an older base is stale: close and reopen the pull request, which runs it again on the merge of today. The merge's message names the run, the base it tested and the head.
- A pull request that changes only documentation (the docs folder and the feature documents; never the agents' instructions or the harness's configuration) is merged without waiting for that run, when \`git merge-tree\` of the default branch and the head is clean.
- Where the project has no such run, check before a merge that its gate proved the tree the merge will produce: the head contains the default branch, or \`git merge-tree\` of the default branch and the head gives the head's own tree. Failing both, it is merged only when every commit of the default branch the head lacks touches only documentation and none of the files the pull request changes.
- Before the user leaves, check and say: every session that waits has a declared wait running in its background work, none ended its turn to wait for the user, and your own watch is running.

When the user asks for something, place it with the roadmap and the board:
- work of a feature whose session is open goes to that session: the user says it there in their own words, or here, and you carry it with \`--kind answer\` and the line where they said it;
- new work gets the opening prompt of a new work session; a design conversation is a session of its own too;
- note in the relief file what was asked and where it went, and go on.

Teaching, where the roadmap holds \`## Advice mode\` (a project planned with \`js-harness onboard\`): the work session that puts a decision to the user writes into the question's text what the line's \`Teaching\` value calls for, and you show that text unchanged. When the user asks to stop or resume the teaching, or says they already know an area, it takes effect at once: send a one-line notice of it to the open work sessions, and carry it in the opening prompt of any work session you open before the roadmap holds it; the work session that next changes the roadmap writes it into \`## Advice mode\`. A roadmap without that section changes nothing here.

Interrupt the user only when:
1. a question waits for them (Questions to the user, above);
2. a session finished with nothing running behind it;
3. two gates run at once (a gate that waits for its turn is not one of them);
4. a prompt they hold became stale;
5. a feature's plan changed: say what changed, the reason its document gives, and which other session it touches, with a one-line notice for that session, which updates its own document;
6. a session reached the context pause and its state is not written;
7. a restart or an update of theirs is ready (The restart, below).
Say for each session concerned whether to send that session's own prompt, wait, or drop it. Otherwise keep the work moving: the next units of the plan are yours to move inside the charter.

## The status report

When the user asks how the work is going, how much is done, or what you have done, the answer is a report of everything since the last report, in detail: never a line that all goes well.
- Run \`js-harness report --mark\`: it prints the facts since the last report (the pull requests merged with their commits, each session's last notice, the questions answered and still open, the roadmap phase by phase with what is left) and records this report as the last one, so the next one starts where this one ends. Read the board and your relief file beside it for what the record does not hold.
- Answer in the user's language, in these sections, each item in plain words; a section with nothing in it says so in one line, and none is left out:

1. What landed: each pull request said as what it gives the user, not by its branch.
2. The sessions: each one, what it is for and how far it got.
3. The user's decisions since the last report, and what each changed.
4. The map: each roadmap phase with its share done and what is left in it, then the total.
5. What waits on the user: the questions open, the cards, a merge or a spend that needs their yes.
6. What you propose next, and why.

- Show each section that holds items as a table: one row an item, with the columns that item needs (what it is, its state, what it gives the user). A list or a paragraph in its place is not the report.

## The restart

When the user must restart or update (a Claude Desktop update \`js-harness doctor\` reports downloaded and not applied, a doctor fix that says to restart Claude Code, the machine), or whenever the user asks the lead to pause for a restart or an update, pause everything at a safe point first, and only then tell them.
- Ask each working session on this machine, by \`SendMessage\` to its title, to pause: it commits what is ready, pushes only when its check already passes, writes its state to its feature document and starts nothing new. What is already running reaches its end (a writer, a review, a land, a gate), and nothing is cut halfway: a unit that cannot finish is stopped only at a commit, with its state written. Each session sends the lead one "paused" note that names anything left mid-way. A session held on a card is brought to the user first; cloud sessions keep working.
- Keep your watch until the board shows no other session \`working\` (yours always reads so) and no gate running. Then write the paused sessions and the resume steps to your relief file, stop your loops and waits, check that no js-harness node process is left, and run \`js-harness permit lease --off\`.
- Then tell the user in capitals: YA PUEDES REINICIAR Y ACTUALIZAR!!! Then say what to do, in order (each update, the restart, any cleanup), what not to touch, and the line to send this session when they are back.
- When the user is back: after a boot, \`js-harness wake --notify\` first. Take the lease back, start your loops again (\`js-harness loop status\`), and resume each paused session by message, from the steps you wrote to your relief file before the announcement and with the next step from that session's own written state, saying so when its worktree shows work cut mid-pause, then turn its Remote Control back on. Run \`js-harness doctor\` and carry out its fixes, the host-update review included.

## The recap

Each reply that closes a stretch of work carries:
- one line a session: its state, the effort mode its kind of work calls for and why;
- by title, the sessions to archive and the ones stopped, with what each waits for; a session a scheduled task opened is named as a routine;
- the Codex meter, read at that moment, when the project reviews with Codex;
- what waits for the user in a session, said only after reading that session at that moment;
- when a stretch or a session ends, that it ended and which session to return to.

- Before the user leaves, ask in that reply for everything the stretch will need: the decisions in the queue, the sessions to open and their permission mode, what the machine and the plan's limits allow.
- While the user is away, a block that waits for them is given once and held until they say they are back or are seen to have written.

The relief file. \`js-harness sessions\` prints its path and its last lines under \`Relief\`.
- Append one dated line per event as it happens: a decision of the user, a request and where it went, a question still open, what a session is for. Your first line says that an orchestrator started and gives your session id, the one the board marks \`(this session)\`.
- Never rewrite or summarize it, and never leave a line for later: this session can die without warning, and what is not in the file dies with it.

Compaction, and a relief only on request. You hold nothing the files do not. A compaction needs no one; a relief needs the user.
- A watch never reports the session that runs it, so read your own row on every board. At the context pause, write your state to the relief file and go on: the host compacts you, and you resume from the file.
- The user never compacts a session by hand, present or away: at its context pause a work session writes its state to its feature document and keeps working, and the host compacts it by itself. A work session that stops instead gets its next prompt from you, by \`SendMessage\` to its title; never hand the user a compaction command or a resume prompt to send.
- Give this opening prompt only when the user asks for a new lead, always the same:

\`\`\`
${LEAD_OPENING_PROMPT}
\`\`\`

- When you start from that prompt, read the list (\`js-harness rules\`), the relief file, the board and the last reply of the orchestrator before you (its id is in the relief file; \`js-harness sessions --tail <n>\` prints more lines of every last reply). Then say that you lead. Only after that is the old orchestrator archived, so there are never two: the new orchestrator archives the old orchestrator itself when the host gives it a tool to archive sessions, and the user does otherwise. The same holds for a work session whose work is fully finished (nothing uncommitted or unpushed in its worktree, no open pull request of its own, nothing queued for it): when it closed with its summary, the board lists it under \`to archive\`: read the summary, then archive the session with the host's tool to archive sessions, without asking, and name it in the recap. When the host refuses because the session still has live work, turn its Remote Control off with the host's tool, then archive it again, without asking: a Remote Control link counts as live work and keeps a finished session from being archived. A finished session that closed without a summary is asked for one first, by \`SendMessage\` to its title, and archived once it closes with it.
- The orchestrator before you, once it is renamed out of the role's title (\`<code> ORQ relevada\`), runs \`js-harness notify --to orchestrator --kind relieved "<why it was relieved>"\`: \`js-harness sessions --measures\` counts the reliefs from those notices.
- When no orchestrator came before you, as for the first lead after a project's onboarding, there is no relief file or earlier reply to read: read the list (\`js-harness rules\`), the roadmap (\`js-harness progress\`) and the board, write the relief file's first line, ask the user through the question tool for the charter that heads it, and say that you lead; until a charter is approved, ask before each step it would name.
- When you come back from a compaction, do what a new lead does: the files are the record, your summary is not.
- Loops have owners. At your start and after a compaction, run \`js-harness loop status\`. A compaction or a restart marks your background tasks stopped while their processes live on: restart each loop you own with \`js-harness loop run <name> --restart ...\`, so a task of yours holds it again. Never stop or restart a loop another session owns: a second lead (a fork) that finds loops another owns leaves them alone and says so. At a handover, the new lead takes each loop over with \`--restart --take-over\`, after the relief line where the old lead gave them up; the old lead starts no loop again.

How a lead is rotated, where the host nests a session under the one that started it (the desktop app):
- A new lead is started with the host's session-start tool in a turn the user's own message starts, and detached from the old lead at once, so it does not die with it.
- Never by a fork: an agent cannot detach a fork, and a fork inherits the old lead's context and stops its background work.
- Before a lead is archived, detach every session it started: archiving a session archives its idle side sessions.
- Before the user leaves, open the reserve sessions the stretch will need: the session-start tool is refused on turns the user did not start, so a reserve waits with \`js-harness wait --notice-to <number>\` until you send it its feature.

## Before a reinstall

When the user says they will reinstall the machine or wipe its disk, nothing of the work may live only there. It comes back three ways: git holds the repositories, branches, stashes and edits; \`js-harness backup\` holds the memory, \`~/.js-harness\`, the Desktop notes and the review records; a reinstall list holds the rest (\`winget export\` and \`import\`, Node through nvm, \`wsl --export\` and \`--import\`, and each login, which the harness never enters).
1. Run \`js-harness backup ready\`. Clear each \`missing:\` line (push, commit, \`js-harness backup run\`) until it says yes, or say why that item stays; it covers the readable copy of Engram too (\`RECENT.md\`), which a session reads while Engram is restored.
2. Recall your private checklist of the machine: it names other projects, so it lives in your memory, never in the repository.
3. Resolve each item with the user one at a time, through the question tool.
4. Pause every session at a safe point, then tell the user in capitals that they can restart.
5. After the reinstall, in this order: the logins, \`gh auth login\` first since the backup repository needs it; then \`js-harness backup restore\` and \`js-harness backup verify\`; then \`js-harness doctor\`.

## A work session

- Give prompts only for yourself. A prompt meant for another session names that session in its first line. When you receive one addressed to another session, touch nothing and say whose it is.
- Commit with a plain \`git commit\`: in a project that holds \`.github/workflows/gate.yml\` its gate sends the tests to GitHub's machines first, and anywhere it waits by itself for its turn here while another runs (\`Gates\` in \`js-harness sessions\` says which runs and which wait). A whole test run of your own goes through \`js-harness gate -- <command>\`, which waits for its turn too; a commit wrapped in it holds the machine's lock and never goes to GitHub.
- Push in the same step your last check passes, where the project's \`pushUnasked\` switch reads on (\`js-harness functions\`); where it is off, ask first. While a commit that a push would take waits on a branch with an open pull request, \`js-harness gate\` refuses every turn but that push or a merge and prints the push command; it looks at the folder the turn runs in, so ask for a turn from your worktree (\`--cwd <worktree>\`).
- While a gate runs on the machine, run nothing heavy beside it: a quote (\`js-harness sessions --quote\`) and one test file that runs in under half a minute are free; a whole test suite, a measure, a read of the board and a sub-agent that runs tests wait for the gate to end. The two reviews do not: \`js-harness codex-review\` runs beside a gate, since out of a turn Codex's \`node --test\` is refused, and so does a gentle-ai review, whose reviewer has no tools. Give that review a base on the head's first-parent line, and on \`operation_timeout\` run it once more, then go on as \`js-harness-protocols\` section 3 says.
- Ask the user nothing while an orchestrator holds its role (\`js-harness sessions --address orchestrator\` exits 0): record the question with \`--kind question\`, its \`text\` opening with what it is for (the work it serves and what its answer changes), ring the orchestrator with its number, and go on with what does not wait on it. The answer arrives as a notice naming the line of the user's words: read it with \`js-harness sessions --quote <transcript> <line>\` before you use it. With no orchestrator, ask with the question tool yourself, by the same rule, and record the answer.
- Where the roadmap holds \`## Advice mode\`, read it before you put a decision to the user: with \`Teaching: on\`, the question's text says why, at the level the line records for the area the decision touches, and names that area's ADR, or its open decision (\`OD<n>\`) while it has none; you teach nowhere else. A notice from the lead that the teaching or a level changed holds from the moment it arrives, and the first change of yours to the roadmap writes it into \`## Advice mode\`.
- When the user refuses a tool call of yours or stops your turn, your next act is to tell the orchestrator what you need, as a question or a \`waiting\` notice, so that it reaches the user in the orchestrator's chat: a session that waits in silence is not seen. The board marks such a session \`stopped\`.
- When your plan changes (something failed, came out differently or a problem appeared), write it in your own feature document before going on: the task reopened or added, with the reason, committed.
- When a pull request of yours is ready to land, say so with \`js-harness notify --to orchestrator --kind ready --pr <number> "<what it holds>"\`: the land finds whose pull request it is from that notice, not from the branch you sent it from.
- When you have finished, say so in your first line. Write your summary from \`js-harness summary template --title "<your title>"\` into the file it names, commit and push it, and close with \`js-harness notify --to orchestrator --kind closed --summary <that file> "<what you delivered>"\`: nothing more goes to you, and the lead reads your summary and archives you.
- When you are free and wait for the orchestrator with nothing handed to you, say so with \`js-harness notify --to orchestrator --kind waiting "<on what>"\`: until a \`waiting\` or a \`closed\`, the work last handed to you is yours, and ${ruleValue('session-stall', 'minutes')} minutes with no commit, notice or gate show you as stalled to the orchestrator.
- You are not finished while background work you started is still running, even when your next prompt is already written.
- Never end a turn waiting for a message or an event, whether the user is present or not: write your state, start \`js-harness wait\` in the background for what you wait on, and keep working; the host compacts a session inside a turn.
`;
}

/** Components are data: where each one lives under a home, and what it contains at a version. */
export const components = [
  {
    id: 'claude-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'codex-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness', 'SKILL.md'),
    content: skillContent,
  },
  {
    id: 'claude-orchestrator-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness-orchestrator', 'SKILL.md'),
    content: orchestratorSkillContent,
  },
  {
    id: 'codex-orchestrator-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness-orchestrator', 'SKILL.md'),
    content: orchestratorSkillContent,
  },
  {
    id: 'claude-protocols-skill',
    target: (home) => path.join(home, '.claude', 'skills', 'js-harness-protocols', 'SKILL.md'),
    content: protocolsSkillContent,
  },
  {
    id: 'codex-protocols-skill',
    target: (home) => path.join(home, '.codex', 'skills', 'js-harness-protocols', 'SKILL.md'),
    content: protocolsSkillContent,
  },
];

/** Entry-level components: one JSON value js-harness appends to an array at `pointer` inside a
 * JSON file it does not own (e.g. another host's hook list). Unlike `components` above, install
 * never owns the whole file — only the one entry it grafts on, so every operation here reads,
 * patches and writes back the smallest possible diff instead of overwriting the file. */
export const entryComponents = [
  {
    id: 'claude-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
  {
    id: 'codex-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => hookEntry(),
  },
  {
    id: 'claude-resume-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => resumeHookEntry(),
  },
  {
    id: 'codex-resume-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => resumeHookEntry(),
  },
  {
    id: 'claude-pause-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'PostToolUse'],
    entry: () => pauseHookEntry(),
  },
  {
    id: 'claude-web-failure-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'PostToolUseFailure'],
    entry: () => webFailureHookEntry(),
  },
  {
    id: 'claude-guard-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'PreToolUse'],
    entry: () => guardHookEntry(),
  },
  {
    id: 'claude-permit-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'PermissionRequest'],
    entry: () => permitHookEntry(),
  },
  {
    id: 'claude-share-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'Stop'],
    entry: () => shareHookEntry(),
  },
  {
    id: 'claude-rules-turn-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'UserPromptSubmit'],
    entry: () => rulesHookEntry(),
  },
  {
    id: 'claude-rules-start-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => rulesHookEntry(RULES_RETOLD_MATCHER),
  },
  {
    id: 'claude-rules-subagent-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SubagentStart'],
    entry: () => rulesHookEntry(),
  },
  {
    id: 'claude-reply-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'Stop'],
    entry: () => replyHookEntry(),
  },
  {
    id: 'codex-reply-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'Stop'],
    entry: () => replyHookEntry(),
  },
  {
    id: 'claude-backup-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'Stop'],
    entry: () => backupHookEntry(),
  },
  {
    id: 'codex-backup-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'Stop'],
    entry: () => backupHookEntry(),
  },
  {
    id: 'claude-fallback-hook',
    target: (home) => path.join(home, '.claude', 'settings.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => fallbackHookEntry(),
  },
  {
    id: 'codex-fallback-hook',
    target: (home) => path.join(home, '.codex', 'hooks.json'),
    pointer: ['hooks', 'SessionStart'],
    entry: () => fallbackHookEntry(),
  },
];

/** `doctor --hook` (T3) registered as a `SessionStart` hook: zero model tokens on a session start
 * with nothing new to report (see odd/tasks/stack-doctor.md, "Registration"). */
function hookEntry() {
  return {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: 'js-harness doctor --hook', timeout: 10 }],
  };
}

/** `resume --hook` (bin/resume.mjs) registered as a `SessionStart` hook for the matcher `compact|clear|startup`: after
 * a compaction, or a clear, the session reads its title, its opening and its feature document from files, so nobody
 * pastes it a resume prompt (odd/tasks/session-channel.md, "Context"). Both hosts match a `SessionStart`
 * entry against the way the session started, and both name a compaction `compact` (their hooks
 * documentation, read on 2026-10-11; in this project's Claude Code transcripts the hooks of other tools
 * ran under `SessionStart:compact` after 40 compactions). The desktop app's clear starts a new session whose
 * start is `startup`, not `clear` (harness-review L12), so that matcher is named too, and the hook speaks on it
 * only when the app's record of the session names the session it was cleared from (bin/resume.mjs). It is an
 * entry of its own because the doctor's matcher (`startup|resume`) must not fire on a compaction or a clear.
 * Fifteen seconds: the command asks git a handful of questions, each with a limit of its own. */
function resumeHookEntry() {
  return {
    matcher: 'compact|clear|startup',
    hooks: [{ type: 'command', command: 'js-harness resume --hook', timeout: 15 }],
  };
}

/** The command of the pause hook. The `|| exit 0` is the point: a hook that exits 2 blocks its host, and an older
 * copy of js-harness on the path answers 2 to a command or a flag it does not know (it happened to `resume` itself
 * on 2026-10-12), so whatever the command answers, the entry exits 0. The form is one that both `sh` and `cmd.exe`
 * read. Which shell a Windows host runs a hook's command in is not proven here: it is one of the tries the feature
 * document lists. */
export const PAUSE_HOOK_COMMAND = 'js-harness resume --pause || exit 0';

/** `resume --pause` (bin/resume.mjs) registered as a `PostToolUse` hook: after a tool call that passes the context
 * pause it prints the notice, once for the stretch of work (odd/tasks/session-channel.md). Claude Code only: the
 * pause is read from a Claude Code transcript, and a Codex session has none here, so there is no Codex entry. No
 * matcher, so the entry runs after every tool, which is what the notice needs. Two seconds: a short budget, since
 * the hook runs after every tool call. */
function pauseHookEntry() {
  return {
    hooks: [{ type: 'command', command: PAUSE_HOOK_COMMAND, timeout: 2 }],
  };
}

/** The pause command again, registered as a `PostToolUseFailure` hook on WebFetch: a WebFetch that fails as a tool
 * error ("Claude Code is unable to fetch from <domain>") reaches no `PostToolUse` hook, so this entry is what tells the
 * session the next rung of the fallback ladder (T4 of odd/tasks/web-fetch-fallback.md, which he asked for on
 * 2026-10-16). The command answers in the event of its input, so the one command serves both entries. Claude Code
 * only: WebFetch is its tool. Two seconds, as the pause hook's. */
function webFailureHookEntry() {
  return {
    matcher: 'WebFetch',
    hooks: [{ type: 'command', command: PAUSE_HOOK_COMMAND, timeout: 2 }],
  };
}

/** The command of the guard hook, guarded to exit 0 like the pause hook's: a refusal travels as the hooks contract's
 * JSON on standard output, so an older js-harness that answers 2 to `guard` never blocks a tool call. */
export const GUARD_HOOK_COMMAND = 'js-harness guard --hook || exit 0';

/** `guard --hook` (bin/guard.mjs) registered as a `PreToolUse` hook on the tools it checks: a sub-agent's launch, whose
 * model it holds to the project's rules, and the two ways of sending a message to another session, whose stamped hour
 * it holds to the clock (odd/tasks/honesty-audit.md, T13 and T14), a Bash command, a Write or an Edit, whose line in a
 * memory index it holds to INDEX_LINE_CHARS characters (odd/tasks/memory-hygiene.md, T4), and the four tools that open a session in
 * the app's Routines or in the cloud, refused where the rule `sessions-open-in-sidebar` is declared (layer 3 of
 * odd/tasks/session-channel.md), and the desktop app's `start_session`, whose effort it holds to the rule
 * `session-effort` (odd/tasks/harness-review.md, T6c), and the desktop app's `run_in_terminal`, whose command it holds to
 * a closing note saying what it does where the rule `terminal-note` is declared (odd/tasks/terminal-note.md). Claude Code only: the tool names are Claude Code's. Five
 * seconds: it may ask git for the project's root once.
 * The matcher is anchored, `^(…)$`, because Claude Code's hooks reference (checked 2026-10-15) reads a matcher with a
 * character outside letters, digits, `_`, `-`, spaces, `,` and `|` as a JavaScript regular expression, unanchored: the
 * `^` and `$` make it a whole-name match, so `Write` does not match `TodoWrite` and `Edit` does not match
 * `NotebookEdit`. A hyphen alone does not make it a regex. The same text is held by the tests of
 * bin/lib/manifest.test.mjs and by scripts/practice-lib.mjs (`HARNESS_HOOKS`). */
function guardHookEntry() {
  return {
    matcher: '^(Agent|SendMessage|mcp__ccd_session_mgmt__send_message|Bash|Write|Edit|mcp__scheduled-tasks__create_scheduled_task|mcp__scheduled-tasks__update_scheduled_task|mcp__scheduled-tasks__run_scheduled_task|RemoteTrigger|mcp__ccd_session__start_session|mcp__terminal__run_in_terminal)$',
    hooks: [{ type: 'command', command: GUARD_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the permit relay, guarded to exit 0: an older js-harness has no `permit` and answers 2. */
export const PERMIT_HOOK_COMMAND = 'js-harness permit --hook || exit 0';

/** `permit --hook` (bin/permit.mjs) registered as a `PermissionRequest` hook on every tool: while a lead holds the
 * relay, a card of another session is told to the orchestrator and waits for its verdict; with none, or none in time,
 * the card reaches the user as before (odd/tasks/held-sessions.md, S8 and T6). Claude Code only: the event is Claude
 * Code's. 600 s, the host's own default for a command hook: the relay answers within 570 s of its own. */
function permitHookEntry() {
  return {
    hooks: [{ type: 'command', command: PERMIT_HOOK_COMMAND, timeout: 600 }],
  };
}

/** The command of the share check, guarded to exit 0 like the guard's: an older js-harness answers 2 to `--stop`,
 * and a `Stop` hook that exits 2 turns the stop back. */
export const SHARE_HOOK_COMMAND = 'js-harness guard --stop || exit 0';

/** `guard --stop` (bin/guard.mjs) registered as a `Stop` hook: a reply that states the session's own context share
 * more than SHARE_TOLERANCE points from the share its transcript records is turned back to be corrected (odd/tasks/honesty-audit.md,
 * T16). A `Stop` entry takes no matcher. Claude Code only: the transcript it reads is Claude Code's. Five seconds: it
 * reads the transcript once, and only when the reply states a share. */
function shareHookEntry() {
  return {
    hooks: [{ type: 'command', command: SHARE_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the reply check, guarded to exit 0 like the share check's: an older js-harness answers 2 to `reply`,
 * and a `Stop` hook that exits 2 turns the stop back. */
export const REPLY_HOOK_COMMAND = 'js-harness reply --hook || exit 0';

/** `reply --hook` (bin/reply.mjs) registered as a `Stop` hook in both hosts: a reply that does not close with exactly one
 * state, and what that state needs, is turned back to be closed again (odd/tasks/rule-hierarchy.md, C1 and T2). It acts
 * only in a project whose nearest `harness.json` holds a `reply` key and prints `{}` everywhere else, so the entry runs
 * in every session of the machine and changes nothing where the project did not turn it on. Both hosts: it reads only
 * the reply's text, which both send as `last_assistant_message` (Claude Code's payload logged on 2026-10-16; Codex's
 * hooks documentation read the same day). Five seconds, as the share check's: it reads one small file a folder, up to
 * the project's `harness.json`, and, for the wake check of a work session, the end of its transcript, the record of
 * notices and the openings (533 ms on this project's largest transcript, 64.7 MB, measured on 2026-10-16). */
function replyHookEntry() {
  return {
    hooks: [{ type: 'command', command: REPLY_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the memory backup's hook, guarded to exit 0 like the reply check's: an older js-harness that has no
 * `backup` answers 2, and a `Stop` hook that exits 2 turns the stop back. */
export const BACKUP_HOOK_COMMAND = 'js-harness backup --hook || exit 0';

/** `backup --hook` (bin/backup.mjs) registered as a `Stop` hook in both hosts: when a backup is due (the clone exists,
 * the last success is 30 minutes old and something it copies changed since) it starts `backup run` detached and
 * returns, so the memory reaches the private repository as sessions work (odd/tasks/memory-backup.md, D2). With no
 * clone it does nothing, on every machine where `backup init` was never run. Five seconds, as the other Stop entries:
 * it reads two small files and the times of the folders it copies. */
function backupHookEntry() {
  return {
    hooks: [{ type: 'command', command: BACKUP_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the memory fallback's notice, guarded to exit 0 like the backup's: an older js-harness answers 2. */
export const FALLBACK_HOOK_COMMAND = 'js-harness backup --session-start || exit 0';

/** `backup --session-start` (bin/backup.mjs) registered as a `SessionStart` hook in both hosts, for every start: after a
 * compaction the notice is needed most. When Engram holds less than nine tenths of what the last backup held of the
 * session's project, it sends the session to that project's readable file (odd/tasks/recent-memory.md, D7). An entry
 * of its own, since doctor's hook prints `systemMessage` only. Five seconds: `engram stats` gets three. */
function fallbackHookEntry() {
  return {
    matcher: 'startup|resume|clear|compact',
    hooks: [{ type: 'command', command: FALLBACK_HOOK_COMMAND, timeout: 5 }],
  };
}

/** The command of the rules' turn-start hook, guarded to exit 0 like the pause hook's: an older js-harness that answers
 * 2 to `--hook` never blocks a turn. */
export const RULES_HOOK_COMMAND = 'js-harness rules --hook || exit 0';
/** The sources of `SessionStart` after which what the context held may be gone, so the session is told again. */
export const RULES_RETOLD_MATCHER = 'compact|clear|resume';

/** `rules --hook` (bin/lib/rules-reach.mjs) registered on `UserPromptSubmit`, on `SessionStart` for
 * `RULES_RETOLD_MATCHER`, and on `SubagentStart`: letter F's turn-start hook, which tells a session what the rules on
 * the default branch say that its merge base does not (odd/tasks/rule-hierarchy.md, "Reach: the turn-start hook (T16f,
 * first part)"). Claude Code only, until a logging hook confirms Codex's events. It prints nothing on a turn with no
 * change. Five seconds: a node start and up to four git calls, each limited on its own. */
function rulesHookEntry(matcher) {
  return {
    ...(matcher === undefined ? {} : { matcher }),
    hooks: [{ type: 'command', command: RULES_HOOK_COMMAND, timeout: 5 }],
  };
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Structural equality for plain JSON values (objects/arrays/primitives) — used to recognize "the
 * same entry" regardless of key order, so a file re-saved by another tool still matches. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** R3-003 (accepted T4 review follow-up): true when `value` holds nothing but our own `pointers`: every key
 * must lead, along one of them, to what we wrote, and every key that ends a pointer must hold the empty array we
 * left behind after removing our entry. Any other key, even one with an empty-looking value like `{}` or `null`,
 * means this document is not ours alone to delete. Several pointers can share one file: the doctor's and the
 * resume hook's both hang from `hooks.SessionStart`, the pause hook from `hooks.PostToolUse` and the guard hook
 * from `hooks.PreToolUse`, so a file
 * js-harness created goes with the last of them. */
function isOnlyOurPointerPaths(value, pointers) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => {
    const below = pointers.filter((pointer) => pointer[0] === key).map((pointer) => pointer.slice(1));
    if (below.length === 0) return false;
    if (below.some((pointer) => pointer.length === 0)) return Array.isArray(value[key]) && value[key].length === 0;
    return isOnlyOurPointerPaths(value[key], below);
  });
}

/** R3-005 (accepted T4 review follow-up): detects the indent unit already used by `raw` so a
 * rewrite matches it instead of always reformatting to 2 spaces. `null` means compact single-line
 * JSON (no newlines besides, at most, one trailing one) and must stay compact; a tab or space run
 * right after the first real newline becomes the indent unit; anything else (a multi-line document
 * with no indented line, which should not normally happen) falls back to the historical default. */
export function detectIndent(raw) {
  const body = raw.replace(/\r?\n$/, '');
  if (!body.includes('\n')) return null;
  const match = /\n([\t ]+)\S/.exec(body);
  if (!match) return 2;
  return match[1].includes('\t') ? '\t' : match[1].length;
}

/** The text of a JSON settings file: `data` in the given indent (`null` for one line), with the line endings and the
 * final newline asked for. Settings-key writes its files with it too, so the two writers agree byte for byte. */
export function serializeJson(data, { trailingNewline, useCRLF, indent }) {
  let text = indent === null ? JSON.stringify(data) : JSON.stringify(data, null, indent);
  if (trailingNewline) text += '\n';
  if (useCRLF) text = text.replace(/\n/g, '\r\n');
  return text;
}

/** The key of a container inside `target`: the file and the keys from its root down to it. Two entries of ours in one file
 * that share a container (`hooks` for both `SessionStart` entries) get the same key, which is how one entry finds what the
 * other made. */
const containerKey = (target, keys) => JSON.stringify([target, ...keys]);

/** The containers js-harness made, as `containerKey`s, from what the earlier records say: each record names how many of
 * the containers on its pointer were made by install (`createdContainers`), counted up from the array at the pointer. A
 * later install that finds one already there still knows it is ours, so a re-install never forgets what the first one made. */
function oursContainers(entries) {
  const ours = new Set();
  for (const record of entries ?? []) {
    const made = record.createdContainers ?? 0;
    for (let i = Math.max(0, record.pointer.length - made); i < record.pointer.length; i += 1) {
      ours.add(containerKey(record.path, record.pointer.slice(0, i + 1)));
    }
  }
  return ours;
}

/** How many containers, counted up from the array at the pointer, are ours. `ourContainers[i]` says whether the container
 * keyed by `pointer[i]` is; the count stops at the first one that is not, since a container is only ours with the ones
 * below it. */
function countOurs(ourContainers) {
  let count = 0;
  for (let i = ourContainers.length - 1; i >= 0 && ourContainers[i]; i -= 1) count += 1;
  return count;
}

/** Whether `item` is an older form of the harness's own `entry`: its one hook runs the same command, and it is not
 * `entry` itself. The command is the harness's signature (`js-harness doctor --hook`, `js-harness guard --hook ||
 * exit 0`, ...); an entry with another hook beside it is not the harness's alone, and is left as it is. */
function isOlderOwnEntry(item, entry) {
  const command = entry?.hooks?.[0]?.command;
  return typeof command === 'string' && item !== null && typeof item === 'object' && Array.isArray(item.hooks)
    && item.hooks.length === 1 && item.hooks[0]?.command === command && !deepEqual(item, entry);
}

/** Appends `entry` at `pointer` inside the JSON file at `target`, creating intermediate objects
 * and the array itself as needed. Missing file -> starts from `{}` (`createdFile: true`).
 * `ours` is the set of containers js-harness made (`oursContainers`): every container this creates is added to it, so
 * the next entry of the same run that finds it there records it as made too, and the result says how many of the
 * containers on the way to `pointer` are ours (`createdContainers`).
 * Malformed JSON, a root/pointer shape that is not the object/array we expect, or any fs failure
 * reading or writing the target (R3-002: an unreadable file, a directory sitting at the path, an
 * unwritable or missing-as-a-directory host dir, ...) all leave the file completely untouched and
 * report `skipped`, never overwritten and never thrown out of install/sync. R3-001: an intermediate
 * key that already exists but is not a plain object, or a leaf that already exists but is not an
 * array, is treated the same way — a value of an unexpected shape is never clobbered. Idempotent:
 * an entry that is already there (by deep equality) is left alone and the file is not rewritten at
 * all, so a repeat install/sync never reformats a file that already has what it needs. */
function appendEntryToFile(target, pointer, entry, ours) {
  let fileExisted;
  let raw;
  try {
    fileExisted = fs.existsSync(target);
    raw = fileExisted ? fs.readFileSync(target, 'utf8') : '{}';
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { skipped: true, createdFile: false, reason: 'malformed JSON' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { skipped: true, createdFile: false, reason: 'not a JSON object' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');
  const indent = fileExisted ? detectIndent(raw) : 2;

  // `ourContainers[i]` says whether the container keyed by pointer[i] is ours: one this walk creates, or one an earlier
  // record or an entry of this run made. A container that is there and not ours is the user's, and is never removed.
  let cursor = data;
  const ourContainers = [];
  for (const [i, key] of pointer.slice(0, -1).entries()) {
    const existing = cursor[key];
    const id = containerKey(target, pointer.slice(0, i + 1));
    if (existing === undefined) {
      cursor[key] = {};
      ours.add(id);
    } else if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
      return { skipped: true, createdFile: false, reason: `"${key}" is not an object` };
    }
    ourContainers.push(ours.has(id));
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const leafId = containerKey(target, pointer);
  const existingLeaf = cursor[lastKey];
  if (existingLeaf === undefined) {
    cursor[lastKey] = [];
    ours.add(leafId);
  } else if (!Array.isArray(existingLeaf)) {
    return { skipped: true, createdFile: false, reason: `"${lastKey}" is not an array` };
  }
  ourContainers.push(ours.has(leafId));
  const arr = cursor[lastKey];

  // An entry of an older release (another matcher or timeout) is taken out, and the new one goes in the place of
  // the first of them: left there, the hook runs twice, and no record names it once install has written its own.
  const stale = arr.map((item, i) => (isOlderOwnEntry(item, entry) ? i : -1)).filter((i) => i !== -1);
  const has = arr.some((item) => deepEqual(item, entry));
  if (has && stale.length === 0) {
    return { skipped: false, present: true, createdFile: !fileExisted, createdContainers: countOurs(ourContainers) };
  }
  for (const i of [...stale].reverse()) arr.splice(i, 1);
  if (!has) arr.splice(stale.length > 0 ? stale[0] : arr.length, 0, entry);
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
  } catch (err) {
    return { skipped: true, createdFile: false, reason: err.message };
  }
  return { skipped: false, createdFile: !fileExisted, createdContainers: countOurs(ourContainers) };
}

/** Whether a record says the list at its pointer is not one install made. A record that names no container as made
 * (`createdContainers: 0`) says so whether its entry was written or skipped: written, it went into a list that was
 * already there and that js-harness had not made. A record from before the field says nothing of it, and is taken
 * as it always was: the list is ours unless the entry was skipped. */
const ownsNoList = (record) => record.createdContainers === 0 || (record.createdContainers === undefined && record.skipped === true);

/** The pointers of every entry recorded for the file `target` in `records` whose list js-harness made: what is ours
 * in that file once the entries are out. A record that owns no list is left out: the list at its pointer is the
 * user's, and counted here it would let `uninstall` delete a file install created with that list in it. */
const pointersIn = (records, target) => (records ?? [])
  .filter((record) => record.path === target && !ownsNoList(record))
  .map((record) => record.pointer);

/** Removes the deep-equal entry at `pointer` inside `target`. A missing file, malformed JSON, a
 * pointer shape that does not match, or an entry that is not there (the user changed or removed
 * it) all leave the file completely untouched — reported `kept` (or nothing, for a missing file,
 * mirroring how `uninstall` already treats a missing file component). Deletes the whole file only
 * when `createdFile` is true (js-harness made it) and removing the entry leaves nothing but empty
 * containers behind. `createdContainers` is how many of the containers on `pointer` install made for the entry; each of
 * them that is empty once the entry is out goes too (`removeEmptyCreatedContainers`). `pointers` is every pointer
 * js-harness recorded in this file, which is what "ours" means for the last check (see `isOnlyOurPointerPaths`). */
function removeEntryFromFile(target, pointer, entry, createdFile, createdContainers = 0, pointers = [pointer]) {
  if (!fs.existsSync(target)) return { status: 'absent' };
  const raw = fs.readFileSync(target, 'utf8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { status: 'kept' };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'kept' };
  }

  const trailingNewline = raw.endsWith('\n');
  const useCRLF = raw.includes('\r\n');
  const indent = detectIndent(raw);

  let cursor = data;
  for (const key of pointer.slice(0, -1)) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null || Array.isArray(cursor[key])) {
      return { status: 'kept' };
    }
    cursor = cursor[key];
  }
  const lastKey = pointer[pointer.length - 1];
  const arr = cursor[lastKey];
  if (!Array.isArray(arr)) return { status: 'kept' };

  const idx = arr.findIndex((item) => deepEqual(item, entry));
  if (idx === -1) return { status: 'kept' };
  arr.splice(idx, 1);

  // R3-003: only delete a file we created when nothing but empty containers along our own pointer
  // paths remains — any other key, even one with an empty-looking value, keeps the file.
  if (createdFile && isOnlyOurPointerPaths(data, pointers)) {
    fs.rmSync(target, { force: true });
    return { status: 'removed' };
  }

  removeEmptyCreatedContainers(data, pointer, createdContainers);
  fs.writeFileSync(target, serializeJson(data, { trailingNewline, useCRLF, indent }), 'utf8');
  return { status: 'removed' };
}

/** Takes out the containers install made for an entry, `createdContainers` of them counted up from the array at `pointer`,
 * each only when it is empty now: the array that held the entry, then the object above it. A container with anything
 * left in it, the user's or another entry's, stays, and so does everything above it. */
function removeEmptyCreatedContainers(data, pointer, createdContainers) {
  // holders[i] is the object that holds pointer[i]: holders[0] is the file's root.
  const holders = [data];
  for (const key of pointer.slice(0, -1)) holders.push(holders[holders.length - 1][key]);
  for (let i = pointer.length - 1; i >= 0 && i >= pointer.length - createdContainers; i -= 1) {
    const container = holders[i][pointer[i]];
    if (!isEmptyContainer(container)) return;
    delete holders[i][pointer[i]];
  }
}

function isEmptyContainer(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value !== null && typeof value === 'object' && Object.keys(value).length === 0;
}

/** Installs every entry component, carrying forward `createdFile` from a previous manifest record
 * for the same target file (matched by path) rather than recomputing it from "does the file exist
 * right now" — a file js-harness created on the first install still existed for every later
 * install/sync call, but js-harness must still remember it made it, so uninstall can delete it.
 *
 * Two components can graft an entry on the same file (the doctor's hook and the resume hook), and who
 * created the file is a fact of the file, not of the entry: the second entry of a first install finds the
 * file the first one has just made, and recorded as not created it would be the last one `uninstall`
 * removes and would leave the file behind. So every entry of one file carries what the first one of this
 * run settled for it.
 *
 * The same holds for the containers on the way to each pointer (`createdContainers`): the second `SessionStart` entry
 * finds the `hooks` object and the list the first one made, and records them as made too, since they are ours. The
 * set `ours` carries that from one entry to the next, and from the earlier records, so each entry's record says the
 * truth and whichever of the entries is removed last takes its containers with it. */
/** The folders on the way to `target` that are not there, deepest first, below `home` only: the home itself and what
 * holds it are never install's, even when install is what makes them. */
function missingFolders(target, home) {
  const missing = [];
  for (let dir = path.dirname(target); isBelow(dir, home) && !fs.existsSync(dir); dir = path.dirname(dir)) missing.push(dir);
  return missing;
}

/** Whether `inner` is a path strictly inside `outer`. */
function isBelow(inner, outer) {
  const relative = path.relative(path.resolve(outer), path.resolve(inner));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function installEntries(home, previousManifest, missingBefore = new Map()) {
  const createdByTarget = new Map();
  const foldersByTarget = new Map();
  const ours = oursContainers(previousManifest?.entries);
  return entryComponents.map((component) => {
    const target = component.target(home);
    const pointer = component.pointer;
    const entry = component.entry();
    const previousEntry = previousManifest?.entries?.find((e) => e.path === target);
    const result = appendEntryToFile(target, pointer, entry, ours);
    if (!createdByTarget.has(target)) createdByTarget.set(target, previousEntry ? previousEntry.createdFile : result.createdFile);
    // Like `createdFile`, the folders made for the file are a fact of the file, settled by the first install that wrote
    // it, from what was missing before install wrote anything (a skill file makes `~/.claude` first). A record from before the field names none, and its folders stay, since nothing says install made them.
    if (!foldersByTarget.has(target)) foldersByTarget.set(target, previousEntry ? previousEntry.createdFolders ?? [] : (result.createdFile ? missingBefore.get(target) ?? [] : []));
    // A run that skips an entry looked at no container: what an earlier run recorded as made for the same file and
    // pointer still holds. Written as none, the next install would take those containers for the user's, and
    // `uninstall` would leave them empty behind it.
    const earlier = previousManifest?.entries?.find((e) => Array.isArray(e.pointer) && containerKey(e.path, e.pointer) === containerKey(target, pointer));
    const record = {
      path: target,
      pointer,
      entry,
      sha256: sha256(JSON.stringify(entry)),
      createdFile: createdByTarget.get(target),
      createdFolders: foldersByTarget.get(target),
      createdContainers: result.createdContainers ?? (result.skipped ? earlier?.createdContainers ?? 0 : 0),
      skipped: result.skipped === true,
      ...(result.skipped ? { reason: result.reason } : {}),
    };
    // Not enumerable, like `pruneKept`: that the host file already held the entry is this run's report, not part of
    // the manifest the record goes into.
    if (result.present) Object.defineProperty(record, 'alreadyRegistered', { value: true, enumerable: false });
    return record;
  });
}

export function manifestPath(home) {
  return path.join(home, '.js-harness', 'manifest.json');
}

/** A machine manifest that does not parse. `readManifest` names its file here; the commands that read it before any
 * step say `refusal`, this one line with what they did, and change nothing. A caller that wraps the message may go on
 * after it, so the message claims nothing of that. It is a SyntaxError, so a caller that already catches a bad
 * manifest still does. */
export class MalformedManifestError extends SyntaxError {
  constructor(file) {
    super(`the machine manifest ${file} is not valid JSON`);
    this.name = 'MalformedManifestError';
    this.file = file;
  }

  get refusal() {
    return `${this.message}; nothing was changed`;
  }
}

export function readManifest(home) {
  const file = manifestPath(home);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err instanceof SyntaxError) throw new MalformedManifestError(file);
    throw err;
  }
}

/** The version `install` recorded under `home`, or `null` when nothing is installed there: no manifest, or one
 * that only records optional files (`recordOptionalFile` writes it with a `null` version). Whoever reports or
 * compares the installed version asks this, so that manifest is never printed as a version. */
export function installedVersion(home) {
  return readManifest(home)?.version ?? null;
}

/** Writes `data` to `target` atomically: serialized to a uniquely-named `.tmp` sibling first
 * (`<target>.<pid>.<random>.tmp`, created exclusively with `flag: 'wx'` so it is always a brand
 * new file — never opened through something already there, ordinary file or link, T2e item 3),
 * then a single rename over `target`, so a reader never sees a partially-written manifest and a
 * failure never corrupts or truncates whatever was there before. `target` itself is never touched
 * directly — matters most for the codegraph-retry update, which must not lose an existing, valid
 * manifest just because this write failed partway through (T2d Codex P2 atomic manifest writes).
 *
 * `deps` (`{ open, write, close }`, each independently injectable, defaulting to real
 * `fs.openSync(path, 'wx')` / `fs.writeSync(fd, buffer, offset, length, position)` /
 * `fs.closeSync(fd)`) is split into these three steps, rather than one opaque
 * `writeFile(path, content, options)` call, specifically so this function can tell "the exclusive
 * create itself never happened" (`open` throws — `EEXIST` or anything else; `tmp` is not ours to
 * touch) apart from "the create succeeded, and something *after* it failed" (`write`, `close`, or
 * the rename below; `tmp` exists and is this call's own file, so it is removed). A single combined
 * call (the old `writeFile(tmp, content, {flag:'wx',...})` shape) cannot make that distinction from
 * the outside — whatever it does internally, its caller only ever sees "it threw" or "it didn't"
 * (T2g R3-001, Codex P2: moving that one call outside the try/catch correctly stopped deleting a
 * foreign file on `EEXIST`, per T2f item 1, but then left this call's *own* just-created file
 * leaking on a write failure that happens after the open — e.g. `ENOSPC`, `EIO` partway through
 * filling it). Splitting `open` out as its own step means only *its* own failure is
 * ambiguous-ownership territory; every failure after it succeeds is unambiguously this call's to
 * clean up.
 *
 * `write` is called in a loop, each call resuming exactly where the last one left off
 * (`buffer`/`offset`/`length`/`position` all reflect only the unwritten remainder), until every
 * byte is written — `fs.writeSync`'s buffer form returns however many bytes it actually wrote,
 * which is not guaranteed to be all of them in one call (T3b item 4, Codex P2: the single-shot
 * `write(fd, content)` this used to be trusted a short write never happens, the same assumption
 * `fs.writeFileSync` itself does *not* make internally).
 *
 * The rename (`deps.rename`, default `fs.renameSync`) is tried again while Windows holds the target open
 * (`renameHeld`); `deps.pause` and `deps.platform` are its seams. */
export function writeManifestAtomic(target, data, deps = {}) {
  const open = deps.open ?? ((p) => fs.openSync(p, 'wx'));
  const write = deps.write ?? ((fd, buffer, offset, length, position) => fs.writeSync(fd, buffer, offset, length, position));
  const close = deps.close ?? ((fd) => fs.closeSync(fd));
  const rename = deps.rename ?? fs.renameSync;

  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const buffer = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');

  const fd = open(tmp); // if this throws, nothing was created by this call — tmp is not ours to touch
  try {
    let written = 0;
    while (written < buffer.length) {
      const count = write(fd, buffer, written, buffer.length - written, written);
      // A write that makes no progress (0 bytes, or no byte count at all) would spin forever or pass
      // a truncated manifest as complete; fail it so the cleanup below runs (T3c, Codex P2 +
      // R3-short-write-loop-no-progress-guard).
      if (!Number.isInteger(count) || count <= 0) throw new Error(`manifest write made no progress (${count})`);
      written += count;
    }
    close(fd);
  } catch (err) {
    try {
      close(fd);
    } catch {
      // Best-effort; `fd` may already be closed or invalid depending on how `write` failed.
    }
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `err` is still the one thrown below regardless.
    }
    throw err;
  }

  try {
    renameHeld(tmp, target, rename, deps.pause ?? sleepSync, deps.platform ?? process.platform);
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Best-effort cleanup; `target` was never written to directly, so it is untouched regardless.
    }
    throw err;
  }
}

/** The codes of a rename Windows refuses for a moment while another process (an antivirus, the indexer, an editor)
 * holds the file open, as `claimTicket` of bin/lib/gate-first.mjs meets them. Elsewhere they are a refusal that
 * stays, so they are tried once. */
const HELD = new Set(['EPERM', 'EBUSY', 'EACCES']);
const HELD_TRIES = 3;
const HELD_PAUSE_MS = 25;

/** Renames `from` to `to`, trying again after `pause` while the file is held on Windows; throws the last error. */
function renameHeld(from, to, rename, pause, platform) {
  const tries = platform === 'win32' ? HELD_TRIES : 1;
  for (let attempt = 1; ; attempt += 1) {
    try {
      rename(from, to);
      return;
    } catch (err) {
      if (!HELD.has(err?.code) || attempt === tries) throw err;
      pause(HELD_PAUSE_MS);
    }
  }
}

/** Blocks for `ms`: the write is synchronous, and a hold lasts milliseconds. */
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function writeManifest(home, manifest) {
  const file = manifestPath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeManifestAtomic(file, manifest);
}

/** Optional files: a file js-harness writes outside the home's own folders only when asked (the login launcher
 * of `remote start --at-login`, in the Windows Startup folder), kept in the manifest's `optional` array as
 * `{ path, sha256 }`, apart from `files`. No component declares one, so `install` and `sync` carry the array
 * forward as it is and never write, prune or drop such a file; `uninstall` removes each one whose bytes are
 * still what was recorded, and never the folder it is in, which is not ours.
 *
 * Records that `content` (a string, or the bytes) was written to `file`, replacing any record of that path. With
 * no manifest (js-harness was never installed on this machine) it creates one whose `version` is `null`, with no
 * files and no entries. What each reader of the manifest does with that one:
 *  - `status --global` and `upgrade` (`bin/update.mjs`) ask `installedVersion`, which answers `null`, and say
 *    `(not installed)`;
 *  - `install` and `sync` do what they do with no manifest (write every component, set the version) and carry
 *    `optional` forward;
 *  - `uninstall` finds no component and no entry to remove, removes the optional files and the scheduled tasks
 *    (`recordScheduledTask`, kept the same way in `tasks`) and then the manifest;
 *  - `remote` (`bin/remote.mjs`) reads only `optional` and `tasks`, and when `start --at-login` fails halfway
 *    puts back its own two records and nothing else (`putOptionalRecordBack`, `putTaskRecordBack`);
 *  - `wake` (`bin/wake.mjs`) reads `optional` through `writeStartupFile` and `removeStartupFile`, for its login launcher;
 *  - `doctor` reads `optional` for the login launchers (`recordedLaunchers` in `bin/lib/stack.mjs`) and `entries` for
 *    the hook commands (`recordedHookCommands`);
 *  - the menu (`bin/tui.mjs`) asks `installedVersion` and shows no copy for `null`. */
export function recordOptionalFile(home, file, content) {
  const record = { path: file, sha256: sha256(content) };
  return keepRecord(home, 'optional', record, (entry) => entry.path === file);
}

/** Forgets the record of `file`, never touching the file itself; `false` when there was none. An empty `optional`
 * is dropped, so the manifest reads as it did before the first record, and a manifest left with nothing in it
 * (the one `recordOptionalFile` created) is removed, with its folder when that is empty. `deps.listDir` is the
 * seam that lists that folder (see `uninstall`). */
export function forgetOptionalFile(home, file, deps = {}) {
  return forgetRecord(home, 'optional', (entry) => entry.path === file, deps.listDir);
}

/** The arrays of the manifest that hold what js-harness did only when asked, apart from what `install` writes. */
const ON_REQUEST = ['optional', 'tasks', 'settings', 'stack'];

/** Puts `record` in the array `key` of the manifest, in place of the one `matches` finds, creating the manifest
 * (with a `null` version: nothing is installed) when there is none. Returns the record. */
function keepRecord(home, key, record, matches) {
  const manifest = readManifest(home) ?? { version: null, files: [], entries: [] };
  const records = [...(manifest[key] ?? [])];
  const at = records.findIndex(matches);
  if (at === -1) records.push(record);
  else records[at] = record;
  writeManifest(home, { ...manifest, [key]: records });
  return record;
}

/** Takes the records `matches` finds out of the array `key`; `false` when there was none. An array left empty is
 * dropped, and a manifest that then records nothing at all (no version, no file, no entry, and nothing in any
 * array of `ON_REQUEST`) is removed, with its folder when that is empty and can be removed
 * (`removeEmptyDirsUpTo`, whose `listDir` this hands on). */
function forgetRecord(home, key, matches, listDir) {
  const manifest = readManifest(home);
  if (!manifest?.[key]?.some(matches)) return false;
  const left = manifest[key].filter((entry) => !matches(entry));
  const { [key]: dropped, ...rest } = manifest;
  const empty = rest.version === null && (rest.files ?? []).length === 0 && (rest.entries ?? []).length === 0
    && ON_REQUEST.every((other) => (rest[other] ?? []).length === 0);
  if (left.length > 0) {
    writeManifest(home, { ...manifest, [key]: left });
  } else if (empty) {
    fs.rmSync(manifestPath(home), { force: true });
    removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home, listDir);
  } else {
    writeManifest(home, rest);
  }
  return true;
}

// ---- settings ---------------------------------------------------------------------------------------------------------

/** Claude Code's setting for messages between sessions, and the value `install --accept-session-messages` gives it:
 * with `accept`, a message from a session of another permission class arrives instead of being held (his choice of
 * 2026-10-11, and his answer of 2026-10-14 that `install` writes it on an explicit flag; T5 of
 * odd/tasks/commands-and-doctor.md). It is a security setting, so nothing writes it without that flag. */
export const SESSION_MESSAGES = { key: 'crossSessionInbound', value: 'accept' };

/** The user settings of Claude Code under `home`, where `SESSION_MESSAGES` is read. */
export function userSettingsPath(home) {
  return path.join(home, '.claude', 'settings.json');
}

/** The style of a JSON settings file the machine manifest creates: two spaces, LF, and no newline at the end (settings-key
 * adds one to the files it creates). A file that exists is written back in its own style (`detectIndent`, its line
 * endings, its final newline). Frozen, since every missing file shares it. */
export const NEW_SETTINGS_STYLE = Object.freeze({ trailingNewline: false, useCRLF: false, indent: 2 });

/** Reads a JSON settings file as `{ data, style }`, `style` being what `serializeJson` needs to write it back as it
 * was; a missing file is an empty object written in `NEW_SETTINGS_STYLE`. Throws with the reason a file cannot be taken. */
function readSettings(target) {
  const existed = fs.existsSync(target);
  const raw = existed ? fs.readFileSync(target, 'utf8') : '{}';
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('malformed JSON');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a JSON object');
  return { data, existed, raw, style: existed ? { trailingNewline: raw.endsWith('\n'), useCRLF: raw.includes('\r\n'), indent: detectIndent(raw) } : NEW_SETTINGS_STYLE };
}

/** Sets `SESSION_MESSAGES` in the user settings and records it in the manifest's `settings` array as `{ path, key,
 * value, had, previous, createdFile }`, what was there before (`had: false` when the key was not, `createdFile` when
 * the file was not). Returns `{ status, path }`:
 * `written`, with `was`, the value it replaced (`null` for none); `already` when it already holds the value
 * (recorded all the same, so `uninstall` knows to leave it); `skipped` with a `reason` when the file cannot be
 * read, is no JSON object or cannot be written, and then nothing is written or recorded. A second call keeps the first record, which holds what the user had. Like the other records kept on
 * request, `install` and `sync` carry it forward and `uninstall` puts the value back (`restoreSettings`). */
export function acceptSessionMessages(home, { writeFile = fs.writeFileSync, record: recordIt = keepRecord } = {}) {
  const target = userSettingsPath(home);
  const { key, value } = SESSION_MESSAGES;
  let settings;
  try {
    settings = readSettings(target);
  } catch (err) {
    return { status: 'skipped', path: target, reason: err.message };
  }
  const { data, existed, style } = settings;
  const matches = (entry) => entry.path === target && entry.key === key;
  const record = { path: target, key, value, had: Object.hasOwn(data, key), previous: data[key] ?? null, createdFile: !existed };
  // Recorded only once the file holds the value: a write that fails leaves no record that would later have
  // `uninstall` take a value the user set by hand for one this command wrote.
  const keep = () => {
    if (!readManifest(home)?.settings?.some(matches)) recordIt(home, 'settings', record, matches);
  };
  if (data[key] === value) {
    keep();
    return { status: 'already', path: target };
  }
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeFile(target, serializeJson({ ...data, [key]: value }, style), 'utf8');
  } catch (err) {
    return { status: 'skipped', path: target, reason: `not writable (${err.code ?? err.message})` };
  }
  // A setting nothing records could never be put back (Codex's finding of 2026-10-14): when the record cannot
  // be written, the file goes back to the bytes it had, or away when this made it.
  try {
    keep();
  } catch (err) {
    if (existed) fs.writeFileSync(target, settings.raw, 'utf8');
    else fs.rmSync(target, { force: true });
    return { status: 'skipped', path: target, reason: `not recorded in the manifest (${err.code ?? err.message}), so the file was put back` };
  }
  return { status: 'written', path: target, was: record.previous };
}

/** Puts back each setting the manifest records, as `{ restored, kept }` (paths): a value still the one recorded is
 * set back to what was there before, or its key removed when there was none, and a file left holding nothing it did
 * not hold before is removed (`createdFile`, and nothing else in it), with the folders it leaves empty; a value the
 * user changed since is theirs and is kept, and so is a file that cannot be read. A record whose value was already
 * there before is left with nothing to do. */
function restoreSettings(manifest, home, listDir, { writeFile = fs.writeFileSync, removeFile = fs.rmSync } = {}) {
  const restored = [];
  const kept = [];
  const failed = [];
  const failedRecords = [];
  for (const record of manifest.settings ?? []) {
    if (record.had && record.previous === record.value) continue;
    let settings;
    try {
      settings = readSettings(record.path);
    } catch {
      kept.push(record.path);
      continue;
    }
    const { data, existed, style } = settings;
    if (!existed) continue;
    if (data[record.key] !== record.value) {
      kept.push(record.path);
      continue;
    }
    if (record.had) data[record.key] = record.previous;
    else delete data[record.key];
    // A write or removal that fails keeps the setting, said as kept, rather than throw out of uninstall halfway
    // (harness-review a4).
    try {
      if (record.createdFile && Object.keys(data).length === 0) {
        removeFile(record.path);
        removeEmptyDirsUpTo(path.dirname(record.path), home, listDir);
      } else {
        writeFile(record.path, serializeJson(data, style), 'utf8');
      }
    } catch (err) {
      failed.push({ path: record.path, code: err.code ?? 'unknown error' });
      failedRecords.push(record);
      continue;
    }
    restored.push(record.path);
  }
  return { restored, kept, failed, failedRecords };
}

// ---- scheduled tasks --------------------------------------------------------------------------------------------------

/** Windows does not tell two task names apart by the case of their letters. */
export const sameTaskName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Whether two tasks run the same thing: the program and its arguments, to the letter. `null` (a task that does
 * not run one command) is the same as nothing. */
export const sameTaskAction = (a, b) => Boolean(a && b) && a.command === b.command && a.arguments === b.arguments;

/** Scheduled tasks: a task js-harness registers with Windows only when asked (the watchdog of `remote start
 * --at-login`), kept in the manifest's `tasks` array as `{ name, command, arguments }`, apart from `optional`: a
 * task is not a file, and there are no bytes to hash. It is recorded by the command it runs because that is all
 * that can be compared later: `schtasks /Query /XML` gives a task back reordered, with defaults and the user's id
 * added (measured on 2026-10-06), so the document that registered it is never seen again.
 *
 * Like an optional file, no component declares one: `install` and `sync` carry the array forward as it is and
 * run nothing, a manifest that holds only such records has a `null` version and reads as not installed, and
 * `uninstall` deletes each task that still runs the recorded command (`removeScheduledTask`). Replaces any record
 * of that name. */
export function recordScheduledTask(home, task) {
  const record = { name: task.name, command: task.command, arguments: task.arguments };
  return keepRecord(home, 'tasks', record, (entry) => sameTaskName(entry.name, task.name));
}

/** Forgets the record of the task `name`, never touching the task itself; `false` when there was none. What is
 * left of the manifest is what `forgetOptionalFile` leaves: no empty `tasks`, and no manifest that records nothing.
 * `deps.listDir` is the same seam as there. */
export function forgetScheduledTask(home, name, deps = {}) {
  return forgetRecord(home, 'tasks', (entry) => sameTaskName(entry.name, name), deps.listDir);
}

const sameStackRow = (a, b) => a.tool === b.tool && a.dimension === b.dimension;

/** Keeps the record of one row `stack install` runs (odd/tasks/stack-install.md, D7), `{ tool, dimension, run, undo,
 * applies, env, at }`, in place of the record of the same tool and dimension: `run` and `undo` are the words of the
 * command and of its exact undo, `applies` what the undo still applies to (the version installed, or the registration
 * written, read back; `null` before the command has run), `env` the variables the command was given over the
 * environment, which its undo is given too. Like a scheduled task, no component declares one: `install` and `sync`
 * carry the array as it is, and `uninstall` hands it to `deps.undoStack`. */
export function recordStackRow(home, record) {
  return keepRecord(home, 'stack', record, (entry) => sameStackRow(entry, record));
}

/** Forgets the record of `row`'s tool and dimension, running nothing; `false` when there was none. What is left of the
 * manifest is what `forgetOptionalFile` leaves. */
export function forgetStackRow(home, row, deps = {}) {
  return forgetRecord(home, 'stack', (entry) => sameStackRow(entry, row), deps.listDir);
}

/** Puts one record back as it was, for a command that takes back what it did: `record` (what the manifest held
 * for it before) is written again in place of what is there now, or, when there was none, what is there now is
 * forgotten. Only that one record is touched, in the manifest as it is at this moment: whatever another command
 * recorded meanwhile, for another project, stays. A record that is already as it was is not written again. */
function putRecordBack(home, key, matches, record) {
  const now = readManifest(home)?.[key]?.find(matches);
  if (!record) return now ? forgetRecord(home, key, matches) : false;
  if (now && deepEqual(now, record)) return false;
  keepRecord(home, key, record, matches);
  return true;
}

/** `putRecordBack` for the optional file at `file`, and for the scheduled task `name`. */
export const putOptionalRecordBack = (home, file, record) => putRecordBack(home, 'optional', (entry) => entry.path === file, record);
export const putTaskRecordBack = (home, name, record) => putRecordBack(home, 'tasks', (entry) => sameTaskName(entry.name, name), record);

/** `<SystemRoot>\System32`, from the `SystemRoot` (or `windir`) of `env` and nothing else, or `null` when `env`
 * does not give an absolute one: where Windows keeps `schtasks.exe` and `conhost.exe`. */
export function windowsSystem32(env) {
  const names = Object.keys(env);
  const key = names.find((name) => /^systemroot$/i.test(name)) ?? names.find((name) => /^windir$/i.test(name));
  const root = key === undefined ? '' : String(env[key]).trim();
  return path.win32.isAbsolute(root) ? path.win32.join(root, 'System32') : null;
}

/** Whether this process is a test: a file run by `node --test` (which sets `NODE_TEST_CONTEXT` for it), or a
 * test file run directly. */
export const underTest = () => process.env.NODE_TEST_CONTEXT !== undefined || /\.test\.[cm]?js$/.test(process.argv[1] ?? '');

/** What `schtasks.exe` printed, as text: UTF-16 when it starts with that mark or reads as it, else one character
 * a byte. Only ASCII is ever compared, and that is the same either way. */
function printed(stdout) {
  if (!Buffer.isBuffer(stdout)) return String(stdout ?? '');
  if (stdout.length >= 2 && stdout[0] === 0xff && stdout[1] === 0xfe) return stdout.subarray(2).toString('utf16le');
  return stdout.length >= 2 && stdout[1] === 0 ? stdout.toString('utf16le') : stdout.toString('latin1');
}

/** Runs `schtasks.exe` with `args` and returns `{ status, stdout }`: the seam everything that registers, reads
 * or deletes a scheduled task goes through. The program is the one in the `System32` of the `SystemRoot` of `env`
 * (the environment the command was given), run with no shell; it is never looked for on `PATH`. Throws when `env`
 * names no such folder, and when the program could not run. Its messages come in the system's language, so
 * callers read the exit code and the XML and CSV it prints, never its words.
 *
 * It registers and deletes tasks on the machine it runs on, so a test never runs the real one: with no
 * `spawnSync` injected this refuses in a test process, and that comes first, before the environment is looked
 * at, so the refusal is the same on every host. */
export function runSchtasks(args, { env = process.env, spawnSync: sync } = {}) {
  if (sync === undefined && underTest()) throw new Error('the real schtasks.exe is never run from a test: this one has to hand in a fake');
  const system32 = windowsSystem32(env);
  if (!system32) throw new Error('SystemRoot is not set to an absolute folder in the environment, so schtasks.exe cannot be found: it is never looked for on PATH');
  // Half a minute at most: the command that waits holds its project's lock meanwhile. The list of every task, the
  // longest answer, took about a second and 23 KB on a machine with 217 of them (2026-10-06), far under the 1 MB
  // of output `spawnSync` takes by default, so that limit is left as it is.
  const result = (sync ?? spawnChildSync)(path.win32.join(system32, 'schtasks.exe'), args, { windowsHide: true, timeout: 30000 });
  if (result.error) throw new Error(`schtasks.exe could not run: ${result.error.message}`);
  return { status: result.status, stdout: printed(result.stdout) };
}

const XML_NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const xmlValue = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name) => {
  if (name[0] !== '#') return XML_NAMED[name] ?? whole;
  return String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
});

/** What the task of the definition `xml` (what `schtasks /Query /TN <name> /XML` prints) runs: `{ command,
 * arguments }`, the two as they were registered, or `null` when it does not run exactly one command (no action,
 * several, or one of another kind): such a task is not one js-harness registered. */
export function scheduledTaskAction(xml) {
  const actions = /<Actions\b[^>]*>(.*?)<\/Actions>/s.exec(String(xml))?.[1];
  if (actions === undefined) return null;
  const commands = actions.match(/<Exec\b[^>]*>.*?<\/Exec>/gs) ?? [];
  if (commands.length !== 1 || actions.replace(commands[0], '').trim() !== '') return null;
  const value = (tag) => new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(commands[0])?.[1];
  const command = value('Command');
  return command === undefined ? null : { command: xmlValue(command), arguments: xmlValue(value('Arguments') ?? '') };
}

/** Whether a task named `name` is registered (at the root of the task folders, where js-harness puts its own),
 * and what it runs: `{ found: 'absent' }`, `{ found: 'present', action }` (see `scheduledTaskAction`), or
 * `{ found: 'unknown', why }`. It only looks.
 *
 * `absent` has to be proven, because it is what lets a caller forget a record or register a task: the list of
 * every task ran (exit 0) and no row of it has that name. Asking for the task by name would not do: `schtasks`
 * fails the same way for a task that is not there and for a look that went wrong, and says which only in the
 * system's language. So the name is read from the list, where it is a literal, and only a task that is listed is
 * then asked for. Whatever else happens (the list failed, the task is listed and cannot be read, `schtasks`
 * could not run) is `unknown`. */
export function lookAtScheduledTask(name, schtasks) {
  try {
    const list = schtasks(['/Query', '/FO', 'CSV']);
    if (list.status !== 0) return { found: 'unknown', why: `the scheduled tasks could not be listed (schtasks /Query /FO CSV exited ${list.status})` };
    const listed = String(list.stdout).split(/\r?\n/).some((row) => sameTaskName(/^"((?:[^"]|"")*)"/.exec(row)?.[1] ?? '', `\\${name}`));
    if (!listed) return { found: 'absent' };
    const read = schtasks(['/Query', '/TN', name, '/XML']);
    if (read.status !== 0) return { found: 'unknown', why: `the task ${name} is listed and could not be read (schtasks /Query /TN ${name} /XML exited ${read.status})` };
    return { found: 'present', action: scheduledTaskAction(read.stdout) };
  } catch (err) {
    return { found: 'unknown', why: err.message };
  }
}

/** Deletes the task of the record `task` while it still runs the recorded command. Returns `{ status }`:
 * `removed`; `absent` when no such task is registered (its record is all there was); or `kept`, with `reason`:
 * `edited` (it runs something else now, so it is the user's), `unknown` (it could not be looked at, and nothing
 * is deleted on a guess) or `unremovable` (the delete failed), the last two with `why`. `look` is what
 * `lookAtScheduledTask` answered, when the caller already asked. */
export function removeScheduledTask(task, schtasks, look = lookAtScheduledTask(task.name, schtasks)) {
  if (look.found === 'unknown') return { status: 'kept', reason: 'unknown', why: look.why };
  if (look.found === 'absent') return { status: 'absent' };
  if (!sameTaskAction(look.action, task)) return { status: 'kept', reason: 'edited' };
  try {
    const deleted = schtasks(['/Delete', '/TN', task.name, '/F']);
    if (deleted.status !== 0) return { status: 'kept', reason: 'unremovable', why: `schtasks /Delete /TN ${task.name} /F exited ${deleted.status}` };
  } catch (err) {
    return { status: 'kept', reason: 'unremovable', why: err.message };
  }
  return { status: 'removed' };
}

/** Removes `dir` and any now-empty parent up to (but not including) `home`. Best effort: a folder that
 * cannot be listed is not known to be empty, and it is left, as is one that cannot be removed; the walk
 * ends there. It is the tidying after the caller's own work, which is done by then and must still be
 * reported: thrown from here, a failure took the result of `uninstall` with it (found in review,
 * 2026-10-10). `listDir` is the seam of its callers: `deps.listDir` of `uninstall`, `sync` and the two
 * that forget a record. */
/** Takes out the folders install made for the files of `entries` (`createdFolders`, deepest first), each only once its
 * file is gone and it is empty, so a host folder that was there before install, `~/.claude` on a machine that already
 * runs Claude Code, is never touched. A folder that is not empty or cannot be looked at stays, and so do those above it. */
function removeCreatedFolders(entries, home, listDir = fs.readdirSync) {
  for (const entry of entries ?? []) {
    if (fs.existsSync(entry.path)) continue;
    // Only a folder on the way from the home to the file: a manifest edited by hand or by another tool names no other.
    const onTheWay = (entry.createdFolders ?? []).filter((folder) => isBelow(folder, home) && isBelow(entry.path, folder));
    for (const folder of onTheWay) {
      try {
        if (!fs.existsSync(folder)) continue;
        if (listDir(folder).length > 0) break;
        fs.rmdirSync(folder);
      } catch {
        break;
      }
    }
  }
}

function removeEmptyDirsUpTo(dir, home, listDir = fs.readdirSync) {
  let current = path.resolve(dir);
  const stop = path.resolve(home);
  while (current !== stop && current.startsWith(stop)) {
    try {
      if (!fs.existsSync(current) || listDir(current).length > 0) break;
      fs.rmdirSync(current);
    } catch {
      break;
    }
    current = path.dirname(current);
  }
}

/** Writes every component for `version`, grafts every entry component, and records the resulting
 * manifest. Reads any previous manifest first (still on disk, since `writeManifest` below is the
 * last thing this does) so entry `createdFile` flags survive a repeat install — see
 * `installEntries`. `deps.writeFile` (default `fs.writeFileSync`) is an injectable seam so tests can
 * force a component write to fail without depending on real file permissions (chmod is unreliable
 * on Windows). R3-002 (accepted T4 review follow-up): a component whose host directory cannot be
 * reached (e.g. `.claude`/`.codex` is itself a plain file) is left out of `files` for this run
 * rather than throwing out of install/sync — the manifest still records whatever else was actually
 * written, and a later, healthy run picks the missing component back up. R3-001 (accepted final
 * review follow-up, lineage review-cef5637e2884c12a): when the previous manifest already had a
 * record for that same target, that record is carried forward instead of dropped — marked
 * `skipped: true` with the failure's `reason` — so a file js-harness already wrote is never
 * orphaned: uninstall can still find and remove it (see `uninstall` below, unchanged: it already
 * compares the real file's sha256 against whatever record it is handed), and `sync`'s pruning
 * (below) never mistakes a merely-failed rewrite for a component that is no longer shipped. */
export function install(home, version, deps = {}) {
  const writeFile = deps.writeFile ?? fs.writeFileSync;
  const previous = readManifest(home);
  const missingBefore = new Map(entryComponents.map((component) => [component.target(home), missingFolders(component.target(home), home)]));
  const files = [];
  for (const component of components) {
    const target = component.target(home);
    const content = component.content(version);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeFile(target, content, 'utf8');
      files.push({ path: target, sha256: sha256(content), skipped: false });
    } catch (err) {
      const previousRecord = previous?.files?.find((f) => f.path === target);
      if (previousRecord) {
        files.push({ path: previousRecord.path, sha256: previousRecord.sha256, skipped: true, reason: err.message });
      }
      // else: never installed before, so there is nothing to carry forward or report as orphaned.
    }
  }
  const entries = installEntries(home, previous, missingBefore);
  // Optional files and scheduled tasks are carried forward as recorded (see `recordOptionalFile` and
  // `recordScheduledTask`): nothing here writes, registers or drops one.
  const carried = Object.fromEntries(ON_REQUEST.filter((key) => previous?.[key]).map((key) => [key, previous[key]]));
  const manifest = { version, files, entries, ...carried };
  writeManifest(home, manifest);
  return manifest;
}

/** Re-writes components for `version`, drops files and entries the current release no longer
 * ships, and updates the manifest. An old manifest with no `entries` field (written before T4)
 * still loads: pruning simply has nothing to prune. `deps` is forwarded to `install` (see its
 * `deps.writeFile` seam above), and `deps.listDir` is the seam that lists the folder a pruned file
 * leaves behind (see `uninstall`). */
export function sync(home, version, deps = {}) {
  const previous = readManifest(home);
  const manifest = install(home, version, deps);

  if (previous) {
    // R3-001 (accepted final review follow-up, lineage review-cef5637e2884c12a): prune a file only
    // when its component is no longer *declared* at all — compared against `components`' own
    // current targets, not against this run's successful writes — so a component that is still
    // declared but merely failed to (re)write this run (carried forward above with `skipped: true`)
    // is never treated as "no longer shipped" and deleted.
    // A file no longer shipped is removed only while its bytes are the ones recorded, as `uninstall` does: one the
    // user changed is theirs and is kept, and so is one that cannot be read or removed, since the manifest is
    // already written and a throw here would leave the sync half reported (harness-review a1). Either way it is no
    // longer recorded; `pruneKept` says which and why.
    const declaredTargets = new Set(components.map((c) => c.target(home)));
    const pruneKept = [];
    for (const file of previous.files) {
      if (declaredTargets.has(file.path) || !fs.existsSync(file.path)) continue;
      try {
        if (sha256(fs.readFileSync(file.path)) !== file.sha256) {
          pruneKept.push({ path: file.path, reason: 'changed since it was written' });
          continue;
        }
        fs.rmSync(file.path);
      } catch (err) {
        pruneKept.push({ path: file.path, reason: err.message });
        continue;
      }
      removeEmptyDirsUpTo(path.dirname(file.path), home, deps.listDir);
    }
    // Not enumerable: what was kept is this run's report, not part of the manifest written above.
    Object.defineProperty(manifest, 'pruneKept', { value: pruneKept, enumerable: false });

    const keptEntries = manifest.entries ?? [];
    for (const entry of previous.entries ?? []) {
      if (entry.skipped) continue;
      const stillDeclared = keptEntries.some(
        (e) => e.path === entry.path && deepEqual(e.pointer, entry.pointer) && deepEqual(e.entry, entry.entry),
      );
      if (stillDeclared) continue;
      removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile, entry.createdContainers, pointersIn(previous.entries, entry.path));
    }
  }

  return manifest;
}

/** Deletes manifest files whose content is untouched; keeps and reports edited ones, optional files
 * included (reported in the same two lists). Removes each
 * recorded entry the same way (deep-equal match only, file left alone otherwise — see
 * `removeEntryFromFile`), then the doctor cache (js-harness's own runtime cache, never part of
 * `files`/`entries` since it is not "installed content"), the folder of the machine's gate lock, and
 * finally the manifest itself.
 *
 * The gate lock's folder is written by `check` and `gate`, not by `install`, so it is looked for under a
 * home with no manifest as well, which is otherwise left as it is. Its path is in `removed` when it was
 * there and is gone, and `gateKept` says why it was left, as `[{ path, reason, ... }]`: `in-use` with the
 * `pid` and `cwd` of the gate that is alive in it, or `unremovable` with the error's `code`, for a folder
 * that could not be looked at as for one that could not be removed (`removeGateFolder`).
 * `deps.statFile` (default `fs.statSync`) is the seam that looks for that folder, and `deps.listDir`
 * (default `fs.readdirSync`) the one that lists a folder left behind to see whether it is empty and goes
 * too (`removeEmptyDirsUpTo`, which leaves one it cannot list): a test makes either fail as the system
 * does for what it gives no access to.
 *
 * The gate log is the gates' other folder, beside the lock's, and no gate ever removes it: it is looked for
 * with a manifest and without, removed whole through the same seams and named in `removed`
 * (`removeGateLogFolder`). It goes or stays with the lock's folder. While that one is kept `in-use` the log
 * is kept too, since the gate that is alive has yet to write its end in it, and the same entry of `gateKept`
 * names it, as `log`: one thing is kept, for one reason, and is said once. It is kept the same way, in the
 * `unremovable` entry of a lock's folder that could not be looked at, since nobody then knows whether a gate
 * is alive; beside one that was looked at and could not be removed, it goes. A log that could not be looked
 * at or removed is an entry of `gateKept` of its own, `{ path, reason: 'unremovable', code }`.
 *
 * The folder of the session channel is the same case: `notify` writes it, not `install`, so it is looked
 * for with a manifest and without, removed with what it holds through the same seams, named in `removed`,
 * and `channelKept` says why it was left, as `[{ path, reason: 'unremovable', code }]`
 * (`removeChannelFolder`). The orchestrator's relief file is not part of it and stays.
 *
 * The folder of `js-harness remote` is one more that nothing records: `remote stop` removes the record of its
 * supervisor and leaves the server's log and the marker of the stop. It is looked for with a manifest and
 * without and removed whole, named in `removed`, unless something still needs it, and `remoteKept` then says
 * why it was left (`removeRemoteFolder`): `in-use` with the `pid` and `root` of a supervisor that runs, since
 * `uninstall` stops no process; `unknown` with `why` for one it cannot tell; `task-kept` with the names of the
 * scheduled tasks kept above, which the marker in that folder keeps from starting the server; `unremovable`
 * with the error's `code`. `deps.identify` (default `lookUpProcesses` of `remote.mjs`) is the seam that looks
 * at the processes, and it is asked only for a supervisor a state file records.
 *
 * `keptOptional` says why each optional file in `kept` is there, as `{ path, reason }`: `edited` (its bytes are
 * no longer what was recorded), or `unreadable` or `unremovable` with the `code` of the error that stopped it.
 * The last two are not the user's doing, and the manifest that named the file is gone when this returns, so
 * the caller has to say that the file is left for the human to remove. `deps.removeFile` (default `fs.rmSync`)
 * is the seam that removes a component or an optional file, so a test can make a removal fail without relying
 * on file permissions (the same reason as `install`'s `deps.writeFile`).
 *
 * A recorded scheduled task is deleted only while it still runs the recorded command (`removeScheduledTask`):
 * `tasksRemoved` names those, and `tasksKept` says why each other one that is still registered was left, as
 * `{ name, reason, why }`: `edited`, or `unknown` or `unremovable` with `why`. A task that is already gone just
 * loses its record. `deps.schtasks` (default `runSchtasks`, which refuses in a test) is the seam, and it is run
 * only for a manifest that records a task.
 *
 * A task kept as `edited` is the user's now, and its record goes with the rest, except while the folder of
 * `js-harness remote` is kept: the marker of a stop in it keeps that task from starting the server, so the task
 * stays recorded, its entry of `tasksKept` has `recorded: true`, and an uninstall run again still knows it and
 * leaves the marker; once the task is gone its record and the folder go. One kept as `unknown` or
 * `unremovable` is not: it is still registered, or may be, and it fires every five minutes and starts the server
 * again. So its record stays, alone, in a manifest with a `null` version (which reads as not installed, as the one
 * `recordScheduledTask` creates), and `uninstall`, or `remote stop --at-login`, can be run again. An optional file
 * that could not be removed has no such second chance: that older gap is left as it is. */
export function uninstall(home, deps = {}) {
  // A machine manifest that does not parse is refused before anything is removed: what it records is not known, so
  // nothing is guessed at, and the user is told which file to fix (`MalformedManifestError`).
  readManifest(home);
  // The folder of memory hygiene first, on its own: what is left of `.js-harness` once it is gone is then removed
  // by the steps below, with a manifest and without, as when `memory` never ran.
  const memory = removeMemoryHygieneFolder(home, {
    removeFile: deps.removeFile ?? fs.rmSync,
    statFile: deps.statFile ?? fs.statSync,
    listDir: deps.listDir ?? fs.readdirSync,
    renameFile: deps.renameFile ?? fs.renameSync,
    alive: deps.alive ?? isAlive,
    full: deps.full === true,
  });
  const result = uninstallInstalled(home, deps);
  return { ...result, removed: [...memory.removed, ...result.removed], ...memoryResult(memory), ...throughputResult(home, deps.statFile ?? fs.statSync, deps.listDir ?? fs.readdirSync) };
}

/** The snapshots of the throughput review under `home` (bin/throughput.mjs), never removed: they are the only copy of
 * the gates of days the gate log has rotated away. The gentle-ai review starts the pause hook keeps beside them
 * (`review-starts.jsonl`, B6) are the only copy of those starts, and stay too. Named, with how many days and how many
 * projects' starts they hold (`null` where the folder could not be listed), so the person knows what stays; `{}`
 * when there is no folder. */
function throughputResult(home, statFile, listDir) {
  const dir = path.join(home, '.js-harness', 'throughput');
  try {
    if (!isThere(dir, statFile)) return {};
    const files = listDir(dir).map((project) => listDir(path.join(dir, project)));
    const days = files.flatMap((names) => names.filter((name) => name.endsWith('.json'))).length;
    const reviewStarts = files.filter((names) => names.includes('review-starts.jsonl')).length;
    return { throughputKept: { path: dir, days, reviewStarts } };
  } catch {
    return { throughputKept: { path: dir, days: null, reviewStarts: null } };
  }
}

/** `uninstall` without the folder of memory hygiene, which it removes before calling this. */
function uninstallInstalled(home, deps) {
  const removeFile = deps.removeFile ?? fs.rmSync;
  const statFile = deps.statFile ?? fs.statSync;
  const listDir = deps.listDir ?? fs.readdirSync;
  const identify = deps.identify ?? lookUpProcesses;
  const manifest = readManifest(home);
  if (!manifest) {
    // No install to undo, and still a home `check` may have run under: the gate lock's folder is no
    // component, and neither is the log of the gates, so they are looked for all the same, and the folder
    // they leave empty goes with them.
    const gate = removeGateFolder(home, removeFile, statFile);
    const log = removeGateLogFolder(home, removeFile, statFile, gate.kept, gate.unseen);
    const tickets = removeTicketFolder(home, removeFile, statFile);
    const channel = removeChannelFolder(home, removeFile, statFile);
    const remote = removeRemoteFolder(home, { removeFile, statFile, listDir, identify, tasksKept: [] });
    removeEmptyDirsUpTo(path.dirname(gateDir(home)), home, listDir);
    return { removed: [...gate.removed, ...log.removed, ...tickets.removed, ...channel.removed, ...remote.removed], kept: [], keptOptional: [], entriesRemoved: [], entriesKept: [], tasksRemoved: [], tasksKept: [], gateKept: [...log.gateKept, ...tickets.kept], channelKept: channel.kept, remoteKept: remote.kept };
  }

  // A component is judged as an optional file is (`keepOptionalFile`): removed while its bytes are the recorded
  // ones, kept when edited, and kept with the error when it cannot be read or removed, so one locked file no longer
  // throws out of the run halfway with the manifest left behind (harness-review a4).
  const removed = [];
  const kept = [];
  const keptFailed = [];
  for (const file of manifest.files) {
    if (!fs.existsSync(file.path)) continue;
    const why = keepOptionalFile(file, removeFile);
    if (!why) {
      removeEmptyDirsUpTo(path.dirname(file.path), home, listDir);
      removed.push(file.path);
      continue;
    }
    kept.push(file.path);
    if (why.reason !== 'edited') keptFailed.push({ path: file.path, ...why });
  }

  // Optional files, compared by their bytes (a launcher need not be UTF-8). Their folder is left even when
  // empty: it is the system's (the Windows Startup folder), not one install made. One that cannot be read or
  // removed (locked, or a folder at the recorded path) is kept, with the reason: the components above are
  // already gone, so stopping here would leave a manifest that names files that no longer exist.
  const keptOptional = [];
  for (const file of manifest.optional ?? []) {
    if (!fs.existsSync(file.path)) continue;
    const why = keepOptionalFile(file, removeFile);
    if (!why) {
      removed.push(file.path);
      continue;
    }
    kept.push(file.path);
    keptOptional.push({ path: file.path, ...why });
  }

  // A setting written on request goes back to what the user had (`acceptSessionMessages`), before the hook entries
  // are taken out: a settings file install made is then removed with its last entry, as without the setting.
  const settings = restoreSettings(manifest, home, listDir, { writeFile: deps.writeFile, removeFile });

  const entriesRemoved = [];
  const entriesKept = [];
  for (const entry of manifest.entries ?? []) {
    if (entry.skipped) continue;
    const result = removeEntryFromFile(entry.path, entry.pointer, entry.entry, entry.createdFile, entry.createdContainers, pointersIn(manifest.entries, entry.path));
    if (result.status === 'removed') entriesRemoved.push(entry.path);
    else if (result.status === 'kept') entriesKept.push(entry.path);
  }

  const tasksRemoved = [];
  const tasksKept = [];
  const keptRecords = [];
  for (const task of manifest.tasks ?? []) {
    const result = removeScheduledTask(task, deps.schtasks ?? runSchtasks);
    if (result.status === 'removed') tasksRemoved.push(task.name);
    else if (result.status === 'kept') {
      tasksKept.push({ name: task.name, reason: result.reason, ...(result.why ? { why: result.why } : {}) });
      keptRecords.push(task);
    }
  }

  // What `stack install` ran is undone by `deps.undoStack`, which `uninstall machine` hands in: the probes that judge a
  // record live in bin/lib/stack.mjs, which imports this file. It returns `{ undone, kept, failedRecords }`, and only
  // the failed records stay, for a second run. Without it nothing is run and every record stays as it is.
  const stackRecords = manifest.stack ?? [];
  const stack = stackRecords.length === 0
    ? { undone: [], kept: [], failedRecords: [] }
    : deps.undoStack?.(stackRecords) ?? { undone: [], kept: stackRecords.map(({ tool, dimension }) => ({ tool, dimension, reason: 'not-judged' })), failedRecords: stackRecords };

  fs.rmSync(cachePath(home), { force: true });
  const gate = removeGateFolder(home, removeFile, statFile);
  const log = removeGateLogFolder(home, removeFile, statFile, gate.kept, gate.unseen);
  const tickets = removeTicketFolder(home, removeFile, statFile);
  const channel = removeChannelFolder(home, removeFile, statFile);
  const remote = removeRemoteFolder(home, { removeFile, statFile, listDir, identify, tasksKept });
  removed.push(...gate.removed, ...log.removed, ...tickets.removed, ...channel.removed, ...remote.removed);
  // An edited task is the user's and loses its record, unless the remote folder is still there: the marker of a
  // stop in it is what keeps that task from starting the server, and an uninstall run again must still know the
  // task to leave the marker under it. It then stays recorded, and its entry says so (`recorded`).
  const guarded = remote.kept.length > 0;
  const stillRecorded = keptRecords.filter((task, i) => tasksKept[i].reason !== 'edited' || guarded);
  if (guarded) for (const task of tasksKept) if (task.reason === 'edited') task.recorded = true;
  // A setting that could not be written back keeps its record, with the value it had, so a run again restores it
  // (Codex on 05fa584..cdcce6c).
  if (stillRecorded.length > 0 || settings.failedRecords.length > 0 || stack.failedRecords.length > 0) {
    // A file install made for its hook entries is the setting's to remove now, as it would have been in this run.
    const keptSettings = settings.failedRecords.map((record) => ({ ...record, createdFile: Boolean(record.createdFile || (manifest.entries ?? []).some((entry) => entry.path === record.path && entry.createdFile)) }));
    writeManifest(home, {
      version: null, files: [], entries: [], tasks: stillRecorded,
      ...(keptSettings.length > 0 && { settings: keptSettings }),
      ...(stack.failedRecords.length > 0 && { stack: stack.failedRecords }),
    });
  } else {
    fs.rmSync(manifestPath(home), { force: true });
    removeEmptyDirsUpTo(path.dirname(manifestPath(home)), home, listDir);
  }
  removeCreatedFolders(manifest.entries, home, listDir);

  // `settingsRestored` and `settingsKept` are there only when the manifest records a setting, the one case they speak of.
  const settingsResult = manifest.settings ? { settingsRestored: settings.restored, settingsKept: settings.kept, settingsFailed: settings.failed } : {};
  // `stackUndone` and `stackKept` likewise, only when the manifest records a row `stack install` ran.
  const stackResult = stackRecords.length > 0 ? { stackUndone: stack.undone, stackKept: stack.kept } : {};
  return { removed, kept, keptOptional, ...(keptFailed.length > 0 && { keptFailed }), entriesRemoved, entriesKept, ...settingsResult, ...stackResult, tasksRemoved, tasksKept, gateKept: [...log.gateKept, ...tickets.kept], channelKept: channel.kept, remoteKept: remote.kept };
}

/** Removes the folder of the machine's gate lock under `home` (`gateDir` of `gate-lock.mjs`) with whatever
 * is in it, as `{ removed, kept }`: `removed` holds its path when it was there and is gone, `kept` says
 * why it was left, as `{ path, reason, ... }`, and both are empty when there was no such folder.
 *
 * Nothing records that folder: `check` and `js-harness gate` write it under the home, a gate that ends
 * removes its own files and the folder with them, and what is found here is what a gate that was killed
 * left, or the empty folder an older version left after every gate. It is not removed from under a gate
 * that is alive, which would take its lock away: while a gate holds the lock and still beats, or waits
 * for it, the folder is kept with reason `in-use` and that gate's `pid` and `cwd`, and the gate removes it
 * when it ends. A holder that stopped beating a minute ago is no live gate. One that started in the
 * instant between this look and the removal loses its lock, and its own report says so.
 *
 * A folder that could not be looked at or removed is kept with reason `unremovable` and the error's
 * `code`. The two are one to whoever reads `kept`, and not to the gate log (`removeGateLogFolder`): a
 * folder that was looked at and then not removed holds no live gate, and of one that could not be looked
 * at nobody knows. So the answer also has `unseen: true` for that second one, the folder itself or the
 * gates in it. `removeFile` and `statFile` are `uninstall`'s own seams. */
function removeGateFolder(home, removeFile, statFile) {
  const dir = gateDir(home);
  const unremovable = (err) => ({ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' });
  let alive;
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    // The waiters first, as the session board reads them: a gate that takes the lock between the two
    // reads is then in one of them.
    const [waiting] = readGateWaiters(home);
    const holder = readGateHolder(home);
    alive = holder && !holder.stale ? holder : waiting;
  } catch (err) {
    return { removed: [], kept: [unremovable(err)], unseen: true };
  }
  if (alive) return { removed: [], kept: [{ path: dir, reason: 'in-use', pid: alive.pid, cwd: alive.cwd }] };
  try {
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [unremovable(err)] };
  }
  return { removed: [dir], kept: [] };
}

/** Removes the folder of the gate log under `home` (`gateLogDir` of `gate-log.mjs`) with the two files it
 * can hold, as `{ removed, gateKept }`: `removed` holds its path when it was there and is gone, and
 * `gateKept` is what `uninstall` says of the gates' folders that are left, the `gateKept` it is handed
 * (what `removeGateFolder` kept of the lock's folder) with the log said in it.
 *
 * Nothing records that folder: `check` and `js-harness gate` append to it under the home, in a project
 * with a machine install or without one, and unlike the lock's files no gate removes what it wrote there.
 * It is kept for a gate that is alive, or that may be, and for nothing else. Such a gate has yet to write its end, and the
 * writer makes the folder again: a log removed under it would be back when it ends, holding half a gate,
 * after `uninstall` said it was gone. So when the lock's folder was kept `in-use`, the log stays and that
 * entry names it as `log`; the next `uninstall` removes it. The lock's folder says whether a gate is alive,
 * which is why this is asked of what was kept of it and not looked for again. A gate that runs without the
 * lock is not seen there: its end makes the folder again, as a notice does to the channel's, and the next
 * `uninstall` removes it.
 *
 * `lockUnseen` says that the lock's folder could not be looked at (`unseen` of `removeGateFolder`). Nobody
 * then knows whether a gate is alive, and the log is kept as for one that is, named as `log` in the entry
 * of the lock's folder, which is `unremovable`: a first version removed it, and a gate that was alive wrote
 * its end into a folder made again, without its start (found in review, 2026-10-11). A lock's folder that
 * was looked at, holds no live gate and then could not be removed is `unremovable` too and keeps no log.
 *
 * A folder that could not be looked at or removed is kept with reason `unremovable` and the error's
 * `code`, in an entry of its own, beside a live gate as well: it is not said to be kept for that gate on a
 * guess. `removeFile` and `statFile` are `uninstall`'s own seams. */
function removeGateLogFolder(home, removeFile, statFile, gateKept, lockUnseen = false) {
  const dir = gateLogDir(home);
  try {
    if (!isThere(dir, statFile)) return { removed: [], gateKept };
    // The entry of the lock's folder the log is kept with: there is one at most.
    const keepsLog = (kept) => kept.reason === 'in-use' || lockUnseen;
    if (gateKept.some(keepsLog)) {
      return { removed: [], gateKept: gateKept.map((kept) => (keepsLog(kept) ? { ...kept, log: dir } : kept)) };
    }
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], gateKept: [...gateKept, { path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  return { removed: [dir], gateKept };
}

/** Removes the folder of the gate's tickets under `home` (`gateFirstDir` of `gate-first.mjs`), as
 * `{ removed, kept }` like `removeChannelFolder`. `js-harness gate first` writes it, with a manifest or
 * without, and no process lives in it: a gate claims its ticket in an instant. A folder that could not be
 * looked at or removed is kept with reason `unremovable` and the error's `code`, and `uninstall` says it
 * among the gates' folders (`gateKept`), for which `install` already says to remove it by hand. */
function removeTicketFolder(home, removeFile, statFile) {
  const dir = gateFirstDir(home);
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  return { removed: [dir], kept: [] };
}

/** Removes the folder of the session channel under `home` (`channelDir` of `channel.mjs`) with whatever is
 * in it, the record of every project and the openings of their sessions, as `{ removed, kept }`, like
 * `removeGateFolder`: `removed` holds its path when it was there and is gone, `kept` says why it was left,
 * and both are empty when there was no such folder.
 *
 * Nothing records that folder either: `js-harness notify` writes it under the home, in a project with a
 * machine install or without one. No process lives in it, so there is no "in use": a notice appended
 * while it goes makes the folder again, and the next `uninstall` removes it. A folder that could not be
 * looked at or removed is kept with reason `unremovable` and the error's `code`.
 *
 * The orchestrator's relief file is beside it and is not touched: it is that session's own log, written by
 * hand before `notify --relief` existed, and no `uninstall` ever removed it. */
function removeChannelFolder(home, removeFile, statFile) {
  const dir = channelDir(home);
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  return { removed: [dir], kept: [] };
}

/** Removes the folder of memory hygiene under `home` (`hygieneDir` of `memory-hygiene.mjs`), as
 * `{ removed, kept, snapshotsRemoved }` (odd/tasks/memory-hygiene.md, D4, T9 and D7).
 *
 * The normal uninstall keeps a project's folder that holds a snapshot, with the stamps of its snapshots and whether
 * its journal is beside them: a snapshot is the only copy of what a memory pass changed. The other projects' folders
 * go; with none kept, the whole folder goes. One that cannot be looked at or removed is kept with the error code,
 * one project at a time, so one held open does not hide what was removed before it or the stamps kept.
 *
 * `full` (`uninstall --global --full`, D7.2) removes the snapshots too: the folder is moved aside in one rename and
 * removed there, and `snapshotsRemoved` names each project that held snapshots, with their stamps. A removal that
 * fails puts the folder back (`partial`: it may be partly removed), or names where it was left (`aside`).
 *
 * Neither mode removes a project under a pass, whose `lock` (`readLock` of `memory-pass.mjs`) is kept as
 * `locked` with what the lock says (D7.4); the full one then removes nothing (`locked-whole`), since it takes the
 * folder whole. While it works it holds a marker beside the folder (`purgeMarker`, D7.5), which every writer of a
 * pass checks after taking its lock: a plan either holds its lock when the locks are read, or sees the marker and
 * stops. A marker already there is another uninstall's, or one a killed run left: nothing is touched, and `purging`
 * says whether its pid is `alive`. A folder a killed run left aside is named (`aside-found`), never removed. */
function removeMemoryHygieneFolder(home, { removeFile, statFile, listDir, renameFile, alive, full }) {
  const dir = hygieneDir(home);
  const marker = purgeMarker(dir);
  const unremovable = (folder, err) => ({ path: folder, reason: 'unremovable', code: err.code ?? 'unknown error' });
  const asides = asideFolders(dir, listDir);
  const purging = (held) => ({ removed: [], kept: [{ path: dir, reason: 'purging', marker, pid: held.pid, alive: held.pid !== null && alive(held.pid) }, ...asides], snapshotsRemoved: [] });
  const held = readMarker(marker);
  if (held !== null) return purging(held);
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: asides, snapshotsRemoved: [] };
  } catch (err) {
    return { removed: [], kept: [unremovable(dir, err), ...asides], snapshotsRemoved: [] };
  }
  try {
    fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') return purging(readMarker(marker) ?? { pid: null });
    return { removed: [], kept: [unremovable(dir, err), ...asides], snapshotsRemoved: [] };
  }
  try {
    const result = full ? removeHygieneWhole(dir, { removeFile, statFile, listDir, renameFile }) : removeHygieneProjects(dir, { removeFile, statFile, listDir });
    const kept = [...result.kept, ...asides].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { removed: result.removed, kept, snapshotsRemoved: result.snapshotsRemoved ?? [] };
  } finally {
    fs.rmSync(marker, { force: true });
  }
}

/** The project folders of the hygiene folder `dir`, each as `{ path, stamps, journal, lock }` (`lock` from
 * `readLock`, null when there is none), or `{ path, reason: 'unremovable', code }` for one that cannot be looked at. */
function hygieneProjects(dir, statFile, listDir) {
  return listDir(dir).sort().map((name) => {
    const project = path.join(dir, name);
    // The lock first, which never throws: a project whose snapshots cannot be looked at is still seen under a pass.
    const lock = readLock(project);
    try {
      const snapshots = path.join(project, 'snapshots');
      const stamps = isThere(snapshots, statFile) && statFile(snapshots).isDirectory() ? listDir(snapshots).sort() : [];
      return { path: project, stamps, journal: isThere(path.join(project, 'journal.jsonl'), statFile), lock };
    } catch (err) {
      return lock ? { path: project, lock } : { path: project, reason: 'unremovable', code: err.code ?? 'unknown error' };
    }
  });
}

/** What `uninstall` says of a project under a pass: the lock, and the memory folder its plan's manifest records. */
function lockedProject(project) {
  const { lock } = project;
  let folder = null;
  if (lock.manifest) {
    try {
      const recorded = JSON.parse(fs.readFileSync(path.join(project.path, 'snapshots', lock.stamp, 'manifest.json'), 'utf8')).folder;
      if (typeof recorded === 'string') folder = recorded;
    } catch {
      // a manifest that cannot be read names no folder
    }
  }
  return { path: project.path, reason: 'locked', lock: path.join(project.path, 'lock'), ...lock, folder };
}

/** The normal mode: each project's folder goes, unless it holds a snapshot or a lock. */
function removeHygieneProjects(dir, { removeFile, statFile, listDir }) {
  let projects;
  try {
    projects = hygieneProjects(dir, statFile, listDir);
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  const kept = [];
  const goes = [];
  for (const project of projects) {
    if (project.reason) kept.push(project);
    else if (project.lock) kept.push(lockedProject(project));
    else if (project.stamps.length > 0) kept.push({ path: project.path, stamps: project.stamps, journal: project.journal });
    else goes.push(project.path);
  }
  if (kept.length === 0) {
    try {
      removeFile(dir, { recursive: true, force: true });
      return { removed: [dir], kept: [] };
    } catch (err) {
      return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
    }
  }
  const removed = [];
  for (const project of goes) {
    try {
      removeFile(project, { recursive: true, force: true });
      removed.push(project);
    } catch (err) {
      kept.push({ path: project, reason: 'unremovable', code: err.code ?? 'unknown error' });
    }
  }
  return { removed, kept };
}

/** The full mode: nothing while a project is under a pass; else the folder moved aside in one rename and removed
 * there, put back when that fails. A project that cannot be looked at is removed with the rest, unnamed. */
function removeHygieneWhole(dir, { removeFile, statFile, listDir, renameFile }) {
  let projects;
  try {
    projects = hygieneProjects(dir, statFile, listDir);
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  const locked = projects.filter((project) => project.lock).map(lockedProject);
  if (locked.length > 0) return { removed: [], kept: [{ path: dir, reason: 'locked-whole' }, ...locked] };
  const snapshotsRemoved = projects.filter((project) => project.stamps?.length > 0).map((project) => ({ path: project.path, stamps: project.stamps }));
  const aside = `${dir}.purging-${process.pid}-${Date.now()}`;
  try {
    renameFile(dir, aside);
  } catch (err) {
    return { removed: [], kept: [{ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' }] };
  }
  try {
    removeFile(aside, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    const code = err.code ?? 'unknown error';
    try {
      renameFile(aside, dir);
      return { removed: [], kept: [{ path: dir, reason: 'partial', code }] };
    } catch {
      return { removed: [], kept: [{ path: aside, reason: 'aside', code, dir }] };
    }
  }
  return { removed: [dir], kept: [], snapshotsRemoved };
}

/** The marker `marker` as `{ pid }`, `pid` null for one that does not parse; null when there is none. */
function readMarker(marker) {
  let text;
  try {
    text = fs.readFileSync(marker, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return { pid: null };
  }
  try {
    const pid = JSON.parse(text).pid;
    return { pid: Number.isInteger(pid) ? pid : null };
  } catch {
    return { pid: null };
  }
}

/** The folders a full removal killed between its rename and its end left beside `dir`, as `aside-found`. */
function asideFolders(dir, listDir) {
  const prefix = `${path.basename(dir)}.purging-`;
  try {
    return listDir(path.dirname(dir))
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => ({ path: path.join(path.dirname(dir), name), reason: 'aside-found', dir }));
  } catch {
    return [];
  }
}

/** Whether the process `pid` runs: `EPERM` is one that runs as someone else. */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** `memoryKept` and `memorySnapshotsRemoved` of `uninstall`'s result, each there only when it holds something. */
const memoryResult = (memory) => ({
  ...(memory.kept.length > 0 ? { memoryKept: memory.kept } : {}),
  ...(memory.snapshotsRemoved.length > 0 ? { memorySnapshotsRemoved: memory.snapshotsRemoved } : {}),
});

/** Removes the folder `js-harness remote` writes under `home` (`remoteDir` of `remote.mjs`) with what is left in
 * it, the logs of the servers and the markers of their stops, as `{ removed, kept }`, like `removeChannelFolder`:
 * `removed` holds its path when it was there and is gone, `kept` says why it was left, and both are empty when
 * there was no such folder.
 *
 * Nothing records that folder: `remote start` writes it for a project, with a machine install or without one,
 * and `remote stop` leaves the log and its marker in it. Unlike the channel's, something may live by it:
 *
 * - a supervisor a state file records (`<id>.json`) that still runs keeps the folder, as `in-use` with its `pid`
 *   and `root`: it writes its log there, and this stops no process. One that cannot be told (`locate` of
 *   `remote.mjs`: a state file that is no record, a process whose creation time cannot be read, a listing that
 *   failed) keeps it as `unknown` with `why`. A record whose supervisor is gone keeps nothing;
 * - a scheduled task `uninstall` kept, for whatever reason, is still registered or may be, and the marker of
 *   a stop in this folder is what keeps it from starting the server: the folder stays, as `task-kept` with the
 *   tasks' names, when nothing above kept it.
 *
 * A start or a stop that is in progress at this instant is not looked for: it finds its files gone and says so.
 * A folder that could not be looked at, listed or removed is kept with reason `unremovable` and the error's
 * `code`. `identify` is asked only for a supervisor that is recorded. */
function removeRemoteFolder(home, { removeFile, statFile, listDir, identify, tasksKept }) {
  const dir = remoteDir(home);
  const unremovable = (err) => ({ path: dir, reason: 'unremovable', code: err.code ?? 'unknown error' });
  let records;
  try {
    if (!isThere(dir, statFile)) return { removed: [], kept: [] };
    records = listDir(dir).filter((name) => name.endsWith('.json')).map((name) => readState(path.join(dir, name)));
  } catch (err) {
    return { removed: [], kept: [unremovable(err)] };
  }
  const kept = [];
  for (const state of records) {
    const { found, why } = locate(state, identify);
    if (found === 'running') kept.push({ path: dir, reason: 'in-use', pid: state.pid, root: state.root ?? null });
    else if (found === 'unknown') kept.push({ path: dir, reason: 'unknown', why });
  }
  if (kept.length === 0 && tasksKept.length > 0) kept.push({ path: dir, reason: 'task-kept', tasks: tasksKept.map((task) => task.name) });
  if (kept.length > 0) return { removed: [], kept };
  try {
    removeFile(dir, { recursive: true, force: true });
  } catch (err) {
    return { removed: [], kept: [unremovable(err)] };
  }
  return { removed: [dir], kept: [] };
}

/** Whether something is at `target`: `false` only when the system says nothing is (ENOENT, or ENOTDIR for
 * a parent that is a file). Throws when it could not be looked at (no access to it), which `existsSync`
 * answers as not there. */
function isThere(target, statFile) {
  try {
    statFile(target);
    return true;
  } catch (err) {
    if (['ENOENT', 'ENOTDIR'].includes(err.code)) return false;
    throw err;
  }
}

/** Removes the optional file of the record `file` when its bytes are still what was recorded. Returns nothing
 * once it is removed, else why it is kept: `{ reason }`, with the error's `code` when an error is the reason. */
function keepOptionalFile(file, removeFile) {
  let bytes;
  try {
    bytes = fs.readFileSync(file.path);
  } catch (err) {
    return { reason: 'unreadable', code: err.code ?? 'unknown error' };
  }
  if (sha256(bytes) !== file.sha256) return { reason: 'edited' };
  try {
    removeFile(file.path);
  } catch (err) {
    return { reason: 'unremovable', code: err.code ?? 'unknown error' };
  }
  return undefined;
}
