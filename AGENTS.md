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
`npm run check` is the single gate: it runs the tests and holds this file to its token budget.
The pre-commit hook runs the same gate, so a red check means the commit is not ready yet.

Feature work is tracked in `odd/tasks/<feature>.md`, the gentle-ai ODD document, mirrored in engram.
Read it before resuming a feature; it is the handoff, and nothing else is.

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
Everything else, keep moving: name the next few units of work and do them without stopping to
report between them. Reports open with a short plain-language summary and close with a recap of
the whole stretch, including what was spent.

Artifacts — code, docs, commits — are in English. Commits follow Conventional Commits, with a body
that explains why.
