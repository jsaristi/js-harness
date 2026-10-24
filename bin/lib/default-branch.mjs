// The default branch of the repository the merge queue lands on: what origin names as its HEAD, else what GitHub
// names for the repository. Zero deps and no git of its own: the caller passes `answer`, which runs one command in
// the repository and returns `{ ok, out, err }` (bin/merge-queue.mjs's `answer`), so a test can fake both sources.
//
// Why not `defaultBranch` of lib/codex-review-coverage.mjs. That one reads origin's HEAD too, but then falls back to
// origin's main and master, and it has no GitHub step: a project whose default is named otherwise would be measured
// against a branch it does not have. The queue must never assume a name, so it reads one or refuses.

/** The default branch of the repository, read once per run: `{ name, from }` with `from` the source that named it
 * (`origin/HEAD` or `gh repo view`), or `{ name: null, why }` when neither names one. origin's HEAD is read first
 * because it is local and needs no network; gh is asked only when it is unset (for example after a clone that had
 * no commits, or a remote whose HEAD was removed). */
export function defaultBranchOf(answer) {
  const pointed = answer('git', ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  const ref = pointed.ok ? pointed.out.trim() : '';
  if (ref.startsWith('refs/remotes/origin/') && ref.length > 'refs/remotes/origin/'.length) {
    return { name: ref.slice('refs/remotes/origin/'.length), from: 'origin/HEAD' };
  }
  const viewed = answer('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name']);
  const named = viewed.ok ? viewed.out.trim() : '';
  if (named) return { name: named, from: 'gh repo view' };
  return {
    name: null,
    why: 'could not read the default branch: origin\'s HEAD names none (git symbolic-ref refs/remotes/origin/HEAD) and gh repo view --json defaultBranchRef gave none; set origin\'s HEAD with git remote set-head origin --auto, or give gh access to this repository',
  };
}
