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
carries its evidence, as `js-harness-protocols` section 6 says.

Anything the harness writes outside this repo, such as a host's config or a project's files, is
recorded so it can be undone exactly: by `uninstall`, by deleting one file, or by git. The
predecessor stack needed four hand-written purge scripts to uninstall; that is the failure this
rule exists to prevent.

`D:\harness`, `D:\harness-lab` and `D:\harness-backups` are read-only references from earlier
attempts. Mine them for evidence and ideas and rewrite what earns a place here; building on them
would bring back the doctrine this rebuild exists to shrink.

## Working with Sebastián

He decides spend, anything irreversible, and product choices; ask those one at a time and wait.
Review is not one of them: the consent he granted for every candidate here is his standing
selection, so when `gentle-ai review start` returns its consent envelope, run the `granted`
invocation without asking. Consent stays his and the review always runs; only the question is
skipped, because his answer is always yes and the question only stalls the work. If the envelope
has no `granted` choice or does not parse, ask him instead. A candidate is a work-unit commit or a
slice (`js-harness-protocols` section 3), never the whole branch: when the Stop hook offers the branch, run its read-only status and
start nothing, because with consent pre-granted nothing would stop a review that size. Every slice
with code goes through Codex, whether or not gentle-ai reviewed it: `js-harness codex-review --base
<boundary>` records the review, and the pre-push hook refuses a branch whose code commits no record
covers. Treat its findings like gentle-ai's. If Codex cannot run, report that and record the skip
with `--unavailable <reason>`.

Everything else, keep moving: name the next few units of work and do them without stopping to
report between them. Reports open with a short plain summary and close with a recap of
the whole stretch, including what was spent. He often answers from his phone by tapping the
suggested prompt, so a step he reports doing outside the session is checked before anything is
built on it.

A session holds one feature, because the conversation is lost on a new session or a compaction
and only files survive. So every decision made in the conversation is written to the roadmap or
the feature document and committed on the feature branch in the same session; that record is
part of the work and needs no separate request. While he is here, say when to cut: a new session
when a feature closes, a PR merges or a phase starts. He never compacts by hand, here or away:
near `rule:context-pause` of its window a session writes its state to the feature document and keeps working,
the host compacts it by itself, and it resumes from the summary checked against that document,
repeating any open question. A session that stops instead gets its next prompt from the
orchestrator, never from him. End each reply in one of the five states of `js-harness-protocols`
section 2. A planned step he would only say yes to is decided and its cost said, as its section 1
says. The orchestrator asks a decision with the question tool (`js-harness-orchestrator`); a cut
carries what he sends, in one code block of only that text, under what it is, where
it goes, what sending it does: two blocks out of order cost a session. Before it, say what was
done, what is next and why, and for which session: he runs several. Then the map: each phase's
share and the total, from `js-harness progress`; if it fails, say so.

Artifacts — code, docs, commits — are in English. Commits follow Conventional Commits, with a body
that explains why.
