// The words the project commands share when they refuse or report a rollback: `init`, `sync`, `status` and
// `functions` say the same thing about a stale manifest, an unreadable pin, a missing pin and what a failed write
// left behind. They read nothing and write nothing, so they moved out of `project.mjs`, which re-exports them, to
// give that module room under its size ceiling for the coverage baseline `init` records (F8 S5c-a, L20 of
// odd/tasks/f8-s5c-a-coverage.md). Zero deps.

/** The refusal `init` and `sync` share for a manifest that survives without `harness.json` (T2c item 1):
 * this clone was initialized before, then lost `harness.json`, so neither builds on the stale record. */
export function staleManifestMessage(manifestPath) {
  return (
    `this clone was initialized before (manifest: ${manifestPath}) but harness.json is missing: ` +
    'restore harness.json, or run js-harness uninstall first'
  );
}

/** The refusal `sync` and `status` share for a `harness.json` whose pin cannot be used (T4 design, T5
 * design): the file and the reason `readPin` gave, without a claim about writes — `sync` adds its own. */
export function invalidHarnessJsonMessage(harnessJsonPath, reason) {
  return `cannot read the pin from ${harnessJsonPath}: ${reason}`;
}

/** How a project with no pin gets one, the clause `status` and `sync` share (install-update T6): the
 * pin is one line written by hand, since no command writes into a `harness.json` that already exists.
 * `version` is the running js-harness, never a value read from the project. */
export function howToPinClause(version) {
  return `add "version": "${version}" to harness.json and commit it`;
}

/** What an `InitWriteError`'s best-effort rollback actually left behind, in one clause — never
 * overclaiming "nothing was left behind" when something could not be removed (T2c
 * R3-nothing-left-behind-overclaims). Shared by `init` and `sync`, which both throw `InitWriteError`.
 * `.codegraph/` is part of the same rollback as everything else whenever the failed run is the one that
 * created it (T2e item 2), so a failure to remove it shows up in `notRemoved` like any other path. The
 * one case where `.codegraph/` is deliberately left untouched (a retry whose directory already existed,
 * still truthfully owned by the older, unrewritten manifest) is not a removal failure at all, so it never
 * reaches `notRemoved` and needs no disclosure here. */
export function cleanupClause(err) {
  if (err.notRemoved.length === 0) return 'nothing was left behind';
  return `could not remove: ${err.notRemoved.join(', ')}`;
}
