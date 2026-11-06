@AGENTS.md

Rule 1: before large work is built, and whenever he asks, a depth pass (`rule:depth-pass`,
`js-harness-protocols` section 9).

## How sessions run

A session holds one feature, because the conversation is lost on a new session or a compaction and
only files survive. It starts at the roadmap; to resume a feature it reads that feature's document,
mirrored in engram. The two are the handoff, and nothing else is: a new session's opening prompt
only points to them. The task contract comes first in a feature document;
`js-harness contract goal <doc>` prints the `/goal` condition that runs it.
Every decision made in the conversation is written to the roadmap or the feature document and
committed on the feature branch in the same session; that record is part of the work and needs no
separate request. Near `rule:context-pause` of its window a session writes its state to the feature
document and keeps working; the host compacts it by itself, and it resumes from the summary checked
against that document. What he is given at that point is the pause notice's (`cutRule` in
`bin/lib/sessions.mjs`).

A task is small when it is understood (the outcome, where to change and no open decision, shown
within one short read), touches no high-risk item (below) and could be finished from the request
and `git diff` alone. Small work stays inline with no feature document; it is large only when that
resume test fails, never by counting files, tests or lines. Large work opens
`odd/tasks/<feature>.md` before the first source write, in this order: the task contract;
`## Depth pass`; `## Specs`, numbered, quoting his words as written; `## Tasks`, one line each with its spec, route
and commit; `## Log` last, L1 his request as written, then his corrections, evidence and decisions.

## Working with Sebastián

He decides what `rule:owner-decisions` lists. Everything else, keep moving: name
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

## Reporting

A report puts bad news first, then what was done, what was checked and how (the command and its
output, or `path:line`), what was not checked, what failed and what stays open, "nothing" where
true. Each claim is checked with its evidence, assumed, or not known; an estimate says so. What a
session or sub-agent says it did is checked in one thing before anything builds on it; a claim
that something is absent names the search that would have found it. What he reads to understand or
decide reaches him as `rule:reports-spanish-visual` says. A mistake is told in five parts: what
happened; the fix now and whether it is checked; what stops it recurring (a check before a line, a
line before a protocol); where that enters and when; the command or count that will prove it has
not come back. It goes into `docs/FAILURES.md` as a `- Seen:` line.

A throughput review (the heartbeat's `DUE:` line, `js-harness throughput`) gives each candidate
its baseline, target, cost and why no check, review or test weakens; one whose gain is below its
cost is dropped with the reason written, and the review is recorded with
`js-harness throughput reviewed`.

## Running what costs, and review

Before a gate, an eval batch, a review or a push, say how many runs and what each costs. One try:
when it fails, read why before anything runs again, never in a loop. Read the proof before the
command it allows; two steps share a command only with `&&`. Run the installed `js-harness`, not
the branch's `node bin/js-harness.mjs`, except to test the change itself. A gentle-ai review's
base is a hash on the head's first-parent line (the last reviewed boundary, or the commit that
merged main in), never a branch name. Each code commit a review approved is named on a gentle-ai
line of the feature document; on `operation_timeout` the same command runs once more, then the
range is written "not reviewed" and Codex reviews it anyway.

Review is not his to decide: the consent he granted for every candidate here is his standing
selection, so when `gentle-ai review start` returns its consent envelope, run the `granted`
invocation without asking. Consent stays his and the review always runs; only the question is
skipped, because his answer is always yes and the question only stalls the work. If the envelope
has no `granted` choice or does not parse, ask him instead. A candidate is a work-unit commit or a
slice (`js-harness-protocols` section 3), never the whole branch: when the Stop hook offers the
branch, run its read-only status and start nothing, because with consent pre-granted nothing would
stop a review that size. Every slice with code goes through Codex and the Claude lenses, whether
or not gentle-ai reviewed it: `js-harness codex-review --base <boundary>` and `js-harness
lens-review --base <boundary> --lenses <pertinent> --reason <why>` record the reviews, and the
pre-push hook refuses a branch whose code commits either record does not cover. Treat their
findings like gentle-ai's. If one cannot run, report that and record the skip with its
`--unavailable <reason>`: a skip is a debt `check`, `doctor` and the merge door list until a
review pays it, and the door refuses a lens skip.
