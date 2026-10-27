# js-harness

js-harness is a small package that sets up Claude Code and Codex for AI-assisted development, on
top of a stack it does not rebuild: gentle-ai owns the workflow, task documents, TDD and review;
engram owns memory; codegraph owns code structure; `/goal` owns the autonomy loop. What this repo
adds is the thin layer those leave open — a few lines of context and the checks that make them
true.

The design bet is that a stronger model needs a smaller harness. This file is what a reviewer such
as Codex reads, and Claude loads it on every turn through the import in `CLAUDE.md`, so it carries
only what an agent cannot learn from the code: what the project is for, how the repo works and what
good work looks like here. How Claude works with Sebastián lives in `CLAUDE.md`.
When something can be checked by a command, it belongs in `bin/`, not in prose.

## How the repo works

`bin/` holds plain Node commands with zero dependencies, so they run in any host on any machine
without an install step. Each command sits next to its `*.test.mjs`; `node --test` runs them all.
`npm run check` is the single gate: it runs the tests, holds this file to its token budget, and
says whether the pending change is due a gentle-ai review.
The pre-commit hook runs the same gate (`npm run hooks` wires it in a fresh clone), so a red check
means the commit is not ready yet.

The plan is `docs/ROADMAP.md`: what is decided, done, next and still open; `docs/origin.md`,
frozen, keeps the reasoning it came from. Feature work is tracked in `odd/tasks/<feature>.md`, the
gentle-ai ODD document. It opens with the task contract (`js-harness contract template`), so its
end is a set of commands that exit 0, not an opinion; `check` validates every contract.

## What good looks like

A behavior change arrives with the test that proves it, written first. A claim about this repo
carries its evidence.

Anything the harness writes outside this repo, such as a host's config or a project's files, is
recorded so it can be undone exactly: by `uninstall`, by deleting one file, or by git. The
predecessor stack needed four hand-written purge scripts to uninstall; that is the failure this
rule exists to prevent.

`D:\harness`, `D:\harness-lab` and `D:\harness-backups` are read-only references from earlier
attempts. Mine them for evidence and ideas and rewrite what earns a place here; building on them
would bring back the doctrine this rebuild exists to shrink.

Artifacts — code, docs, commits — are in English. Commits follow Conventional Commits, with a body
that explains why.
