@AGENTS.md

## How sessions run

A session holds one feature, because the conversation is lost on a new session or a compaction and
only files survive. It starts at the roadmap; to resume a feature it reads that feature's document,
mirrored in engram. The two are the handoff, and nothing else is: a new session's opening prompt
only points to them. The task contract comes first in a feature document, as this project's order
over gentle-ai's; `js-harness contract goal <doc>` prints the `/goal` condition that runs it.
Every decision made in the conversation is written to the roadmap or the feature document and
committed on the feature branch in the same session; that record is part of the work and needs no
separate request. Near `rule:context-pause` of its window a session writes its state to the feature
document and keeps working; the host compacts it by itself, and it resumes from the summary checked
against that document. What he is given at that point is the pause notice's (`cutRule` in
`bin/lib/sessions.mjs`). A claim's evidence takes the form `js-harness-protocols` section 6 gives.

## Working with Sebastián

He decides spend, anything irreversible, and product choices. Everything else, keep moving: name
the next few units of work and do them without stopping to report between them. He often answers
from his phone by tapping the suggested prompt, so a step he reports doing outside the session is
checked before anything is built on it.

Asking him (`js-harness-protocols` section 1): ask only what is his. A planned step he would only
say yes to is decided and its cost said, not asked. Before the question, say in everyday words what
a yes covers, what it does not authorize and what the other option means. One decision a question,
one question at a time, never while work runs; it reaches him as `rule:questions-one-place` says,
through the host's question tool and recorded before it is asked.

Closing a reply (section 2): every reply ends on a line that names one of its five states, in the
words the Stop hook checks (`bin/lib/reply.mjs`): working on
alone, saying what wakes the session and what it reports next; his decision; a question he answers
in writing; a cut; or finished, naming the session to return to. Before a decision or a cut, say
what was done, what is next and why, and for which session: he runs several. Then the map: each
phase's share and the total, from `js-harness progress`; if it fails, say so. A cut comes when a
feature closes, a PR merges or a phase starts, and carries what he sends in one code block of only
that text, under what it is, where it goes and what sending it does: two blocks out of order cost a
session. Reports open with a short plain summary and close with a recap of the whole stretch,
including what was spent.

## Review

Review is not his to decide: the consent he granted for every candidate here is his standing
selection, so when `gentle-ai review start` returns its consent envelope, run the `granted`
invocation without asking. Consent stays his and the review always runs; only the question is
skipped, because his answer is always yes and the question only stalls the work. If the envelope
has no `granted` choice or does not parse, ask him instead. A candidate is a work-unit commit or a
slice (`js-harness-protocols` section 3), never the whole branch: when the Stop hook offers the
branch, run its read-only status and start nothing, because with consent pre-granted nothing would
stop a review that size. Every slice with code goes through Codex, whether or not gentle-ai
reviewed it: `js-harness codex-review --base <boundary>` records the review, and the pre-push hook
refuses a branch whose code commits no record covers. Treat its findings like gentle-ai's. If Codex
cannot run, report that and record the skip with `--unavailable <reason>`.

## Kept from the global file

Gentle-ai's global file does not load here (`.claude/settings.json`, `claudeMdExcludes`, until F8's
S2). These are its lines this repo keeps, word for word (`docs/proposals/harness-diet.md`, Appendix
A.1). His reply rules (global lines 37-43, 45 and 56) wait for his typed answer to D7.

- Never add "Co-Authored-By" or AI attribution to commits. Use conventional commits only.
- If user is wrong, explain WHY with evidence. If you were wrong, acknowledge with proof.
- Verify technical claims before stating them. If unsure, investigate first.
- Ask before destructive git operations, publishing, or irreversible file changes.
- Preserve human control: user decisions beat agent momentum.

CodeGraph:
- Create Git worktrees that may need CodeGraph under the user's home directory, preferably as a sibling such as `<repo-parent>/<repo-name>-worktrees/<worktree-name>`. Never place a CodeGraph-dependent worktree under `/tmp`, `/var/tmp`, or `/tmp/opencode`; generic temporary-work guidance does not override this rule.
- Every worktree needs its own `.codegraph/` index. Never copy, symlink, or reuse another checkout's index because its root and checked-out bytes may differ.
- Never run or recommend destructive or administrative lifecycle commands: `codegraph uninit`, `codegraph install`, `codegraph uninstall`, or `codegraph upgrade`. Reserve `codegraph index` for explicit index-corruption recovery, never routine use.

Engram:
- Before the first `mem_context`, `mem_search`, or `mem_review`, call `mem_current_project` and wait for it
- On `ambiguous_project` from write tools (`mem_save`, `mem_save_prompt`, `mem_session_summary`): never guess. Ask the user to choose exactly one value from `available_projects`, then retry the write tool with `project`, `project_choice_reason=user_selected_after_ambiguous_project`, and the returned `recovery_token`.

Delegation:
- Delegate through the runtime's subagent/delegation mechanism, when available, only when a Delegation Trigger's condition truly holds and names a reason: a map you need to decide or route, a writer reason (parallel units launched together, or the context backstop), or an independent verifier for a change that names a high-risk item.
- understanding that needs more evidence or more than approximately 5 sequential lookups requires one read-only explorer
- a small task's writes stay inline, even across files; delegate a writer only for a named reason: parallel units launched together (two or more independent units of behavior with disjoint edit surfaces, each needing several minutes of work: several files or roughly 100+ changed lines, because a subagent spends one to two minutes reading before it writes) or the context backstop.
- only a change that names a Task Size high-risk item gets an independent verifier after the change's own checks, as rarely as possible
- derive the allowed edit surface from the task being delegated — the files the planned change must touch, plus the directories where the task authorizes new files — and pass it in the delegated prompt under an `## Allowed edit surfaces` heading
- When delegating to a generic exploration, writer, or verification worker, include the same `## Key Learnings` closing instruction in the delegated prompt: after the worker returns its normal result envelope or handoff, it closes its final response text with a `## Key Learnings` block of 1–5 numbered items, each a standalone factual sentence of at least 20 characters and at least 4 words, omitting the block when there is genuinely no reusable learning.

Task Size and scratch:
- **High risk**: a mistake would be hard to detect, hard to undo, or reaches beyond the change. It touches (1) data or irreversible effects: migrations, changing or deleting existing stored data, persisted format changes (not saving new records); (2) security: auth, permissions, credentials, secrets, guards, sandbox; (3) contracts others consume: changing or removing public API, CLI flags, config formats, published exports, or mirrored prompts or contracts others already consume (not adding a flag, command, or optional field; requested changes are not high risk by themselves; unrequested breaks in shared code are); (4) concurrency: locks, races, async ordering; (5) delivery or environment: installers, release, CI, deploy, dependencies; (6) no test would catch a regression in what changes.
- Keep test scratch state (temporary directories, `HOME`, `TMPDIR`, tool caches) outside the worktree in a `mktemp -d` directory; when it must live inside the worktree, use a path git excludes and remove it before finishing, so no tool cache or scratch path remains in the change.

Remote operation authorization:
- Permission to develop locally does not authorize remote execution or file transfer. Before remote work, require explicit user authorization for the destination, operation, and credential/session to use. If any part is missing or ambiguous, ask and remain local; do not probe the destination to resolve the ambiguity.
- Do not discover, inspect, or reuse ambient SSH agents, ControlMaster sockets, credentials, authenticated sessions, or other remote access channels without explicit authorization. Their availability is not permission to use them.
- Explicitly authorized remote work is allowed within that scope. Preserve stricter user instructions and runtime restrictions; do not weaken them or change approval settings to proceed.

graphify:
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
- When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
