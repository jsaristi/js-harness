// The git hooks `init` writes into a project (bin/lib/project.mjs, `writeHookGate`): the name each takes under the
// hooks path, its text, and what a person adds by hand to a hook of that name the harness does not write. Data
// alone, so `project.mjs`, at its ceiling of lines, holds the steps and this the texts.

const PRE_COMMIT_HOOK =
  '#!/bin/sh\n# Written by js-harness init; js-harness uninstall removes it.\nexec js-harness check\n';

/** The push check, where the Codex review is on (odd/tasks/on-demand-functions.md, S6): one `check --push`
 * a pushed ref, as this repository's own `.githooks/pre-push` runs it; a delete pushes nothing. */
const PRE_PUSH_HOOK = [
  '#!/bin/sh',
  '# Written by js-harness; js-harness uninstall removes it. Refuses a push whose code commits no Codex',
  '# review record covers, where the project has the review on (harness.json "functions").',
  'status=0',
  'while read -r local_ref local_sha remote_ref remote_sha; do',
  '  case "$local_sha" in *[!0]*) ;; *) continue ;; esac',
  '  js-harness check --push --remote "$1" --head "$local_sha" < /dev/null || status=1',
  'done',
  'exit $status',
  '',
].join('\n');

/** The host's attribution lines out of every commit message (odd/tasks/strip-attribution.md): his answer was to take
 * them out and never stop the commit, so a copy of js-harness that is gone or cannot run the step lets it go. */
const COMMIT_MSG_HOOK = [
  '#!/bin/sh',
  "# Written by js-harness init; js-harness uninstall removes it. Takes the host's attribution lines out of the",
  '# commit message, and never stops the commit.',
  'js-harness commit-msg "$1" || exit 0',
  '',
].join('\n');

export const HOOKS = {
  preCommit: { name: 'pre-commit', content: PRE_COMMIT_HOOK, command: '`js-harness check`' },
  prePush: { name: 'pre-push', content: PRE_PUSH_HOOK, command: '`js-harness check --push` for each pushed ref' },
  commitMsg: { name: 'commit-msg', content: COMMIT_MSG_HOOK, command: '`js-harness commit-msg "$1"`' },
};
