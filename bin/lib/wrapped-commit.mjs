// A commit wrapped in `js-harness gate --` (odd/tasks/commit-gates-first.md, S4): the wrapper holds the machine's gate
// lock while it runs (`JS_HARNESS_GATE_HELD`), so the commit's hook runs its gate in that turn, here, and never sends
// it to GitHub (../check.mjs, `lock.held`). The commit still runs correctly, only slower and holding the lock, so the
// guard adds a hint beside its result instead of refusing it. A whole test run stays wrapped: the skill requires it.
import path from 'node:path';
import { CI_GATE_ENV, CI_WORKFLOW, onCiMachine } from './ci-gate.mjs';
import { commandsOf, gateCommands } from './test-run-warning.mjs';

const GIT = /(^|[\\/])git(\.exe)?$/i;
// git's own options that take the next word as their value (`git -C <dir> commit`).
const GIT_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix']);
// `git commit` options that take the next word as their value, so a message of `-n` is no option.
const COMMIT_VALUED = new Set(['--message', '--file', '--author', '--date', '--reuse-message', '--reedit-message', '--fixup', '--squash', '--template', '--cleanup', '--trailer']);
// A merge with one of these makes no merge commit, so no hook runs (`.githooks/pre-merge-commit`).
const MERGE_WITHOUT_COMMIT = new Set(['--ff-only', '--no-commit', '--squash', '--abort', '--quit']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

const withoutAssignments = (words) => words.slice(Math.max(0, words.findIndex((word) => !ASSIGNMENT.test(word.text))));

/** `{ verb, dir }` for the words of a `git commit` or `git merge` whose hook runs its gate, or `null`: `dir` is the
 * folder `git -C` names (joined when several do), else `null`. A commit with `--no-verify` or `-n` (alone or in a
 * cluster, before an option that takes the rest of its word) runs no hook, nor does a dry run; a merge with
 * `--no-verify` runs none, nor one that makes no commit. `git merge -n` is `--no-stat` and still commits. */
function commitOf(words) {
  if (!GIT.test(words[0]?.text ?? '')) return null;
  let dir = null;
  let at = 1;
  while (at < words.length && words[at].text.startsWith('-')) {
    const option = words[at].text;
    if (GIT_VALUED.has(option)) {
      if (option === '-C' && words[at + 1] !== undefined) dir = dir === null ? words[at + 1].text : path.join(dir, words[at + 1].text);
      at += 2;
    } else {
      at += 1;
    }
  }
  const verb = words[at]?.text;
  if (verb !== 'commit' && verb !== 'merge') return null;
  for (let index = at + 1; index < words.length; index += 1) {
    const option = words[index].text;
    if (option === '--') break;
    if (option === '--no-verify') return null;
    if (verb === 'merge') {
      if (MERGE_WITHOUT_COMMIT.has(option)) return null;
      continue;
    }
    if (option === '--dry-run') return null;
    if (COMMIT_VALUED.has(option)) {
      index += 1;
    } else if (/^-[^-]/.test(option)) {
      for (let place = 1; place < option.length; place += 1) {
        const flag = option[place];
        if (flag === 'n') return null;
        // `-m` ends the cluster: its value is the rest of the word, or the next word when nothing follows.
        if ('mFcCt'.includes(flag)) {
          if (place === option.length - 1) index += 1;
          break;
        }
        if ('uS'.includes(flag)) break;
      }
    }
  }
  return { verb, dir };
}

/** `{ verb, dir }` for the first `git commit` or `git merge` (see `commitOf`) that a `js-harness gate --` of the
 * command line `command` wraps, reading each wrapped command apart, or `null` where none does. A commit after the
 * wrapper (`js-harness gate -- npm test && git commit`) is outside it. */
export function wrappedCommit(command) {
  for (const words of commandsOf(command)) {
    const wrapped = gateCommands(withoutAssignments(words));
    if (wrapped === null) continue;
    for (const inner of wrapped) {
      const found = commitOf(withoutAssignments(inner));
      if (found !== null) return found;
    }
  }
  return null;
}

/** The hint for the command line `command`, run in the folder `cwd`, or `null` when it wraps no commit. Its words
 * follow the conditions of `ciGateWanted` (./ci-gate.mjs): where the project of the commit holds the workflow, the
 * switch is not off and this is no CI machine, a plain commit's gate goes to GitHub first, and the hint says so;
 * elsewhere it says only that the hook waits for its turn by itself. `projectRoot` gives the top of the work tree of
 * a folder, and `exists` whether a file is there. */
export function wrappedCommitHint(command, { cwd, env, projectRoot, exists }) {
  const found = wrappedCommit(command);
  if (found === null) return null;
  const root = projectRoot(found.dir === null ? cwd : path.resolve(cwd, found.dir));
  const toGithub = env[CI_GATE_ENV] !== '0' && !onCiMachine(env) && exists(path.join(root, CI_WORKFLOW));
  const plain = `${found.verb[0].toUpperCase()}${found.verb.slice(1)} with a plain \`git ${found.verb}\`: its hook waits for its turn by itself. `
    + 'A test run of your own still goes through `js-harness gate --`.';
  const ran = `js-harness guard: this \`git ${found.verb}\` ran inside \`js-harness gate --\`, so its gate held the machine's lock`;
  if (!toGithub) return `${ran} for the whole run. ${plain}`;
  return `${ran} and ran its tests here; it could not go to GitHub's machines, where a commit's gate goes first in a `
    + `project that holds ${CI_WORKFLOW}. ${plain}`;
}
