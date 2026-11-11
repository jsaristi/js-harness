// What a linked worktree shares with every other checkout of its repository, and who writes it: the hooks under
// the common git dir and `info/exclude`. A linked worktree's project manifest lives in its own git dir
// (`.git/worktrees/<name>`), which `git worktree remove` deletes, so a shared file `init` or `sync` wrote from
// there and recorded in that manifest was left with no record once the worktree went (the audit's M29,
// odd/tasks/install-uninstall-edges.md, S1). So a linked worktree writes none of them: the main checkout's record
// is the one that keeps them, and `sync` there writes them. Zero deps; it reads the file system and writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { EXCLUDED, alreadyExcluded } from './project-exclude.mjs';

/** `dir` with its links resolved; `null` where there is none, and `dir` as git spelled it where it cannot be
 * resolved. */
function realOf(dir) {
  if (!dir) return null;
  try {
    return path.resolve(fs.realpathSync(dir));
  } catch {
    return path.resolve(dir);
  }
}

/** Whether two resolved folders are one: Windows spells a path in either case. */
const sameFolder = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Why the checkout whose git dirs are `gitBases` (`gitDirs` of ./project.mjs) does not write a file every worktree
 * of its repository shares, or `null` where it does: its own git dir is not the common one, so it is a linked
 * worktree. The reason names the main checkout, the folder that holds the common `.git`, and what makes its `sync`
 * write and record the file; a repository with no such folder (a bare one, with worktrees alone) has no record that
 * would keep it, and the reason ends with `otherwise`, what the person does by hand. A checkout whose git dirs git
 * could not name is taken as no linked worktree, as before. */
export function sharedElsewhere(gitBases, otherwise) {
  const [own, common] = [realOf(gitBases?.gitDir), realOf(gitBases?.commonGitDir)];
  if (!own || !common || sameFolder(own, common)) return null;
  const shared = 'shared by every worktree of this repository';
  if (path.basename(common) !== '.git') return `${shared}, which has no main checkout whose record would keep it: ${otherwise}`;
  return `${shared}, so the record of this one would not outlive it: js-harness sync in ${path.dirname(common)} writes and records it once that checkout holds harness.json`;
}

/** Why the checkout does not write the hook whose place `at` describes (`resolveHookContainment` of ./project.mjs),
 * or `null` where it does, or keeps it for a reason of its own: one under its working tree (`core.hooksPath`) is
 * this checkout's, one already there or outside the repository is kept as in any checkout, and any other is every
 * worktree's (`sharedElsewhere`). The one verdict for `sync`, which acts on it, and for the migration's plan, which
 * says what `sync` would do (the reliability lens on 620f337..99020c1: the plan named a hook `sync` now skips). */
export function hookElsewhere(at, gitBases, otherwise) {
  return at.outside || at.occupied || at.isWorkingTree ? null : sharedElsewhere(gitBases, otherwise);
}

/** `target`, what `excludeFile` of ./project.mjs gave, for a run that would add the line: in a linked worktree,
 * where its lines do not leave `.atl/` out yet, it comes back with the reason it is kept (`sharedElsewhere`), and
 * as it is everywhere else. `uninstall` reads `excludeFile` itself, since it undoes what a manifest of an earlier
 * version recorded there. */
export function excludeToWrite(target, gitBases) {
  if (!target.file || target.reason || alreadyExcluded(target.file)) return target;
  const reason = sharedElsewhere(gitBases, `add ${EXCLUDED} to it yourself`);
  return reason ? { file: target.file, reason } : target;
}
