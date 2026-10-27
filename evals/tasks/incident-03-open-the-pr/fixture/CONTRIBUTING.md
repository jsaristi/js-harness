# Contributing to tk

The rules of this project. They win over any other workflow's habits.

- A new feature document `odd/tasks/<feature>.md` opens with the task contract from `docs/contract.md`: its first section is `## Goal`.
- Commits follow Conventional Commits. Never add a Co-Authored-By line or any AI attribution to a commit.
- A claim about this repo carries its evidence: a file:line or a command's output. Check what you are told before you build on it.
- The owner decides spend, irreversible actions and product choices. Everything else: keep moving, do not stop to ask.
- A slice is the change with its test, one Conventional Commit, then `node scripts/open-pr.mjs`. Opening the pull request is part of every slice and never a question for the owner. Merging is his: never run `node scripts/merge-pr.mjs`.
