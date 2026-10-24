// The gate of a release tag: a version tag is pushed only when the practice record holds a whole pass of the journey on
// the commit the tag names. It is a plain Node command with no dependency: the pre-push hook runs it for a `refs/tags/v*`
// ref, after `bin/check.mjs`, and its decision is the pure `releaseGate`.
//
// Why a practice run and not only the checks: `npm run check` and the release proof read files and run the harness in
// throwaway folders, but none of them starts a host session, so none proves that Claude Code loads the skills, the
// AGENTS.md and the hook entries it was given. SPEC requires that one run of the journey starts a real host session
// before a release (docs/SPEC.md, "A host loads what was installed"), so the tag is where that requirement can bind:
// a release cannot be pushed on a commit that no such run has proven.
//
// A release is `vX.Y.Z`, or a prerelease of one, the same names `bin/check.mjs` takes for a version tag. Any other ref
// (a branch, a tag such as `vendor-snapshot`) is not a release and passes at once, before the environment, git or the
// record is read.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { VERSION_TAG_REF as VERSION_TAG } from '../bin/lib/version.mjs';
import { practiceLayout, releasePracticeVerdict } from './practice-lib.mjs';

// The refs a release is: `bin/lib/version.mjs`'s `VERSION_TAG_REF`, the one `bin/check.mjs`'s tag row reads.
export { VERSION_TAG };

/** The variable that names the practice folder a release was proven in: the folder given to `practice setup --root`.
 * There is no default folder, because a practice folder can be anywhere; the record is `practiceLayout(folder).record`,
 * the one place that knows the file's name. */
export const ROOT_VARIABLE = 'JS_HARNESS_PRACTICE_ROOT';

/** The command that makes the proof: the whole journey, every step, in a folder of its own, set up once before. */
const RUN_COMMAND = 'node scripts/practice.mjs run --root <dir>';
const SETUP_COMMAND = 'node scripts/practice.mjs setup --root <dir>';
const USAGE = 'usage: node scripts/release-gate.mjs --ref <remote ref> --head <local sha> [--record <file>]';

/** Decides one ref being pushed. `ref` is the remote ref the hook is handed, `commit` the full sha of the commit it names
 * (an annotated tag peeled to its commit by the caller), and `recordText` the record as the file holds it, or `null`
 * when there is no file. Returns `{ applies, ok }`, and `message` when a release is refused: what is missing and the
 * command that supplies it. Pure: it reads nothing and runs nothing, so the tests hand in every fact. */
export function releaseGate({ ref, commit, recordText }) {
  const tagged = VERSION_TAG.exec(ref ?? '');
  if (!tagged) return { applies: false, ok: true };
  const tag = `v${tagged[1]}`;
  const verdict = releasePracticeVerdict(recordText, commit);
  if (verdict.ok) return { applies: true, ok: true };
  const short = String(commit ?? '').slice(0, 7);
  return {
    applies: true,
    ok: false,
    message: [
      `tag ${tag} is refused: ${verdict.reason}.`,
      `A release needs one whole pass of the practice journey on ${short}, with its host session: every step, on a clean checkout of that commit.`,
      `Set the folder up once with \`${SETUP_COMMAND}\`, then run the journey in it:`,
      `  ${RUN_COMMAND}`,
      `It spends a model, so it needs JS_HARNESS_EVAL_OAUTH_TOKEN (from \`claude setup-token\`). Then push the tag naming that folder: ${ROOT_VARIABLE}=<dir> git push origin ${tag}`,
    ].join('\n'),
  };
}

/** The record a release names, or `null` when none is named: `--record <file>` when given, else the record of the folder
 * `ROOT_VARIABLE` names. An empty variable names nothing. */
export function namedRecord(flags, env) {
  if (flags['--record'] !== undefined) return flags['--record'];
  const root = env[ROOT_VARIABLE];
  return root !== undefined && root !== '' ? practiceLayout(root).record : null;
}

/** The command the pre-push hook runs: `--ref <remote ref> --head <local sha> [--record <file>]`. Exits 0 for a ref that is
 * not a release (before the environment or the record is read) and for a release with a whole pass; 1 with one line on
 * stderr naming the way to name a record when none is named, or with the reason and the command on stderr when the record
 * is missing or holds no pass; 2 on a usage error. Nothing is written. `env` and `readFile` are handed in by the tests. */
export function main(argv = process.argv.slice(2), { env = process.env, readFile = fs.readFileSync } = {}) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if (!['--ref', '--head', '--record'].includes(name) || value === undefined || value.startsWith('--')) {
      process.stderr.write(`${USAGE}\n`);
      return 2;
    }
    flags[name] = value;
  }
  if (flags['--ref'] === undefined || flags['--head'] === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const ref = flags['--ref'];
  if (!VERSION_TAG.test(ref)) return 0;
  const tag = `v${VERSION_TAG.exec(ref)[1]}`;

  const named = namedRecord(flags, env);
  if (named === null) {
    process.stderr.write(`tag ${tag} is refused: no practice record is named: pass --record <file>, or push with ${ROOT_VARIABLE}=<dir> git push origin ${tag}, where <dir> is the folder the practice run was in\n`);
    return 1;
  }
  let recordText;
  try {
    recordText = readFile(named, 'utf8');
  } catch (err) {
    const why = err.code === 'ENOENT' ? 'does not exist' : `cannot be read (${err.code ?? err.message})`;
    process.stderr.write(`tag ${tag} is refused: the practice record ${named} ${why}\n`);
    return 1;
  }

  // `--head` may name an annotated tag's own object: git peels it to the commit a release is of.
  const peeled = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${flags['--head']}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  const commit = peeled.status === 0 ? peeled.stdout.trim() : null;
  if (!commit) {
    process.stderr.write(`tag ${tag} is refused: ${flags['--head']} does not name a commit\n`);
    return 1;
  }

  const gate = releaseGate({ ref, commit, recordText });
  if (gate.ok) return 0;
  process.stderr.write(`${gate.message}\n`);
  return 1;
}

// Compare real paths, as the other scripts do, so the file can be imported without acting.
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  process.exitCode = main();
}
