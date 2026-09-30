# js-harness

js-harness is a small package that sets up Claude Code and Codex for AI-assisted development, on
top of a stack it does not rebuild: gentle-ai owns the workflow, task documents, TDD and review;
engram owns memory; codegraph owns code structure; `/goal` owns the autonomy loop. What this repo
adds is the thin layer those leave open — a few lines of context and the checks that make them
true.

The design bet is that a stronger model needs a smaller harness. Every line in this file is paid
on every turn of every session, so it carries only what an agent cannot learn from the code: what
the project is for, what good work looks like here, and the reason behind each real constraint.
When something can be checked by a command, it belongs in `bin/`, not in prose.

## How the repo works

`bin/` holds plain Node commands with zero dependencies, so they run in any host on any machine
without an install step. Each command sits next to its `*.test.mjs`; `node --test` runs them all.
`npm run check` is the single gate: it runs the tests, holds this file to its token budget, and
says whether the pending change is due a gentle-ai review.
The pre-commit hook runs the same gate (`npm run hooks` wires it in a fresh clone), so a red check
means the commit is not ready yet.

The plan is `docs/ROADMAP.md`: what is decided, done, next and still open. A session starts there;
`docs/origin.md`, frozen, keeps the reasoning it came from. Feature work is tracked in
`odd/tasks/<feature>.md`, the gentle-ai ODD document, mirrored in engram. Read it before resuming
a feature; together with the roadmap it is the handoff, and nothing else is.

A new feature document opens with the task contract (`js-harness contract template`), so its end
is a set of commands that exit 0, not an opinion. `check` validates every contract; `js-harness
contract goal <doc>` prints the `/goal` condition that runs them.

## What good looks like

A behavior change arrives with the test that proves it, written first. A claim about this repo
carries its evidence — `path:line` for code, the command and its output for behavior — because
reports are only useful if they are true. A claim that something is absent names the search that
proves it and why that search could have found it.

Anything the harness writes outside this repo, such as a host's config or a project's files, is
recorded so it can be undone exactly: by `uninstall`, by deleting one file, or by git. The
predecessor stack needed four hand-written purge scripts to uninstall; that is the failure this
rule exists to prevent.

`D:\harness`, `D:\harness-lab` and `D:\harness-backups` are read-only references from earlier
attempts. Mine them for evidence and ideas and rewrite what earns a place here; building on them
would bring back the doctrine this rebuild exists to shrink.

## Working with Sebastián

He decides spend, anything irreversible, and product choices; ask those one at a time and wait.
Review is not one of them: he has pre-granted gentle-ai review consent for every candidate here,
so when `gentle-ai review start` returns its consent envelope, run the `granted` invocation
without asking. The review itself always runs; only the question is skipped, because his answer
is always yes and the question only stalls the work. If the envelope has no `granted` choice or
does not parse, ask him instead. After gentle-ai approves a slice with code, Codex reviews the
same range with `js-harness codex-review --base <boundary>`, which records the review; the
pre-push hook refuses a branch whose code commits no record covers. Treat its findings like
gentle-ai's. If Codex cannot run, report that and record the skip with `--unavailable <reason>`.

Everything else, keep moving: name the next few units of work and do them without stopping to
report between them. Reports open with a short plain-language summary and close with a recap of
the whole stretch, including what was spent.

A session holds one task, because the conversation is lost on a new session or a compaction and
only files survive. So every decision made in the conversation is written to the roadmap or the
feature document and committed in the same session. Tell him when to cut: a new session when a
feature closes, a PR merges or a phase starts; `/compact` with what to keep when a task is still
open but the conversation has grown long. End every reply with the next prompt he should send, as
plain quoted text (a code block may not show in the app): the next step in this chat, and when
cutting, the opening prompt for the new session or the full `/compact` command. He never writes
the handoff himself. In every reply, just before that prompt, show the map: each roadmap phase with
its percentage and the total, from `js-harness progress`; if it fails, say so instead of guessing.

Artifacts — code, docs, commits — are in English. Commits follow Conventional Commits, with a body
that explains why.
