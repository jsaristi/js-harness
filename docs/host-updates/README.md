# Host update reviews

One file per Claude Desktop version reviewed, `claude-desktop-<version>.md`: what the update brings and what the
harness does with each change. `js-harness doctor --host-reviewed` records a review of an update only once this
folder holds that version's file, whole (`hostReviewRefusal`, `bin/lib/host-update.mjs`); the row `host-update`
names the file to write. The review is recorded per machine; the file lives in the project that keeps the reviews,
this one. Why: the lead once recorded an update as reviewed after a check that nothing broke, with no account of
what it brought (`docs/FAILURES.md`, `host-review-without-research`; `odd/tasks/f8-lead-rigor.md`, S2).

A file holds:
- a line `Code tab CLI: <version>`, the CLI the app bundles, when doctor reads one;
- a table with the columns `Change`, `Decision` and `Reason`, one row at least: each `Decision` is `adopt`, `adapt`
  or `ignore`, each `Reason` says why; a version the changelog has no entry for is a row that says so;
- a `## Sources` list of what was read, holding the changelog of each part that changed:
  `https://claude.com/docs/cowork/claude-desktop-changelog` for the desktop,
  `https://code.claude.com/docs/en/changelog` for the CLI.

```markdown
# Claude Desktop 2.42304.0

Code tab CLI: 2.1.299

| Change | Decision | Reason |
|---|---|---|
| Mods: panels beside the chat | adapt | the board could be a mod instead of an HTML page |
| Side sessions | ignore | the harness opens its sessions through `sessions start` |

## Sources
- https://claude.com/docs/cowork/claude-desktop-changelog (2.37337.1 to 2.42304.0)
- https://code.claude.com/docs/en/changelog (2.1.295 to 2.1.299)
```

The research that fills a file is the role JH 105's proposal describes; the format above is the gate's.
