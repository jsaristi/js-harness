# Flaky tests

The quarantine ledger of the gate (odd/tasks/flaky-ledger.md). When the suite fails, the gate runs the
failed test files once more, alone. A file that passes on that rerun does not block while it has a
current entry here; it still runs in every gate. A file that passes on rerun and has no entry blocks,
and the `rerun` row names the entry to add: an entry is written by hand and committed, so a quarantine
is always in git.

An entry is one `### <test file>` heading, the path from the top of the repository, with three lines:

- `- Owner:` who fixes it, or decides to remove the entry.
- `- Expires: YYYY-MM-DD` the last day it counts. After it, the file blocks again.
- `- Failure:` the id of its entry in docs/FAILURES.md, where each time it failed is recorded.

The heading form is a contract with another reader: the exact-tests selection (odd/tasks/exact-tests.md)
reads only the `### <path>` headings, expired entries included, to keep a quarantined file from being
skipped. A change to that form is agreed with it first.

The gate's `flaky` row reads this file: a malformed entry, a path that is no test file of the
repository, or a failure that docs/FAILURES.md does not hold fails the gate; an expired entry is listed.
Other lines are for people.

### evals/suite.test.mjs
- Owner: JH 10
- Expires: 2026-10-22
- Failure: eval-interrupt-process-alive

The test "an interrupt during a real trial against a hanging fake agent leaves nothing of it" finds the
fake agent's grandchild still running at the suite's exit, under load. The fix is fix/sweep-waits-for-exit:
after its kills, a run waits, bounded, until the killed process group is gone.

### evals/codex-configs.test.mjs
- Owner: JH 10
- Expires: 2026-10-22
- Failure: eval-missing-login-workroot-kept

The test "a missing login stops the trial before the agent starts" finds the trial's directory still in
the work root under load: its removal had not ended when the test read the folder.
