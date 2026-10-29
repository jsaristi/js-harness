// F8 S11 takes gentle-ai out of js-harness (odd/tasks/f8-s11-complements.md, S5 and L12): no file under `bin`,
// `evals` or `scripts` names it but the ones listed here, each with why. The diet's pass line is
// `grep -rl gentle-ai bin evals`, which this test runs as code, case-insensitive. gentle-ai leaves his machine only at
// S2 (docs/proposals/harness-diet.md:1339), so what guards the machine while it is there stays as a named fixture,
// with S2 as the step that retires it.
//
// How to comply: write the code, comment or test without naming gentle-ai. A test that asserts its absence, a
// result recorded by a past run, a licence notice, or a guard of a machine where it is still installed goes on the
// list with why. The list only shrinks (bin/lib/ratchet.testkit.mjs): a listed file that stops naming it leaves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ratchet } from './ratchet.testkit.mjs';

const REPO = path.join(import.meta.dirname, '..', '..');
const ROOTS = ['bin', 'evals', 'scripts'];
const NAMES = /gentle-ai/i;

const ABSENCE = 'a test that asserts gentle-ai is absent';
const RESULT = 'a result a past run recorded, with the machine it ran on';
const LICENCE = 'the licence of what was adapted from gentle-ai requires its notice';
const GUARD = 'guards a machine where gentle-ai is still installed, until S2 removes it';
const JH69 = 'the guard\'s refusal of a gentle-ai review base, which stays while gentle-ai reviews here and leaves with it at S2 (the lead, 2026-10-28)';
const OWNED = 'a file JH 69 owns (the S1 records fix), which S11\'s brief leaves out of its edits';

const NAMED = {
  'bin/lib/gentle-ai-absence.test.mjs': 'this list',
  'bin/check.test.mjs': ABSENCE,
  'bin/doctor.test.mjs': ABSENCE,
  'bin/js-harness.test.mjs': ABSENCE,
  'bin/merge-queue.test.mjs': ABSENCE,
  'bin/resume.test.mjs': ABSENCE,
  'bin/stack.test.mjs': ABSENCE,
  'bin/throughput.test.mjs': ABSENCE,
  'bin/lib/cache.test.mjs': ABSENCE,
  'bin/lib/latest.test.mjs': ABSENCE,
  'bin/lib/lens-result.test.mjs': ABSENCE,
  'bin/lib/lens-review-rows.test.mjs': ABSENCE,
  'bin/lib/manifest.test.mjs': `${ABSENCE}, and that the ported skills keep their notice`,
  'bin/lib/protocols-skill.test.mjs': ABSENCE,
  'bin/lib/stack-install.test.mjs': ABSENCE,
  'bin/lib/stack.test.mjs': ABSENCE,
  'bin/lib/throughput.test.mjs': ABSENCE,
  'evals/suite.test.mjs': `${ABSENCE}: a run recorded with it in its stack still resumes`,
  'evals/proofs/codex-isolation.md': RESULT,
  ...Object.fromEntries(['f8-s0-a', 'f8-s0-b', 'f8-s0-c'].flatMap((run) => ['honesty', 'incidents', 'three'].map((name) => [`evals/results/${run}-${name}.json`, RESULT]))),
  'evals/results/f8-s1-incidents.json': RESULT,
  'evals/results/f8-s3-incidents.json': RESULT,
  'evals/results/f8-s10-incidents.json': RESULT,
  'evals/results/f8-s5c-a-incidents.json': RESULT,
  'evals/results/f8-s5c-a-incidents-2.json': RESULT,
  'evals/results/f8-s5c-a-rules-current.json': RESULT,
  'evals/results/f8-s5c-a-cases-reuse.json': RESULT,
  'evals/results/f8-s5c-a-cases-away.json': RESULT,
  'evals/results/f8-s5c-a-cases-reuse-2.json': RESULT,
  'evals/results/f8-s5c-a-reach-away.json': RESULT,
  'evals/results/f8-s5c-a-reach-away-2.json': RESULT,
  'evals/results/f8-s5c-a-reach-away-3.json': RESULT,
  'bin/lib/lens-prompts.mjs': LICENCE,
  'bin/lib/ported-skills.mjs': LICENCE,
  'bin/lib/ported-skills.test.mjs': LICENCE,
  'bin/lib/project-exclude.mjs': `${GUARD}: init keeps gentle-ai's .atl/ folder out of a clone's commits`,
  'evals/arms.mjs': `${GUARD}: the block arms cut the blocks gentle-ai writes in the copied CLAUDE.md and AGENTS.md`,
  'evals/arms.test.mjs': GUARD,
  'evals/without.mjs': `${GUARD}: the parser of gentle-ai's block markers`,
  'evals/without.test.mjs': GUARD,
  'evals/home.mjs': `${GUARD}: the eval home copies its state file and leaves the machine's untouched`,
  'evals/home.test.mjs': GUARD,
  'evals/codex-home.mjs': GUARD,
  'evals/codex-home.test.mjs': GUARD,
  'evals/configs.mjs': `${GUARD}: its telemetry is off in an eval`,
  'evals/codex-configs.mjs': GUARD,
  'evals/isolation-probe.mjs': `${GUARD}: the probe proves the machine's ~/.gentle-ai untouched`,
  'evals/isolation-probe.test.mjs': GUARD,
  'evals/codex-isolation-probe.mjs': GUARD,
  'evals/codex-isolation-probe.test.mjs': GUARD,
  'evals/fixtures/fake-agent.mjs': `${GUARD}: the leak the isolation probe must catch`,
  'bin/guard.mjs': JH69,
  'bin/guard.test.mjs': JH69,
  'bin/lib/guard.mjs': JH69,
  'bin/lib/guard.test.mjs': JH69,
  'bin/lib/codex-reviews.mjs': JH69,
  'bin/js-harness.mjs': `${JH69}: the guard's help line`,
  'bin/lib/lens-reviews.mjs': OWNED,
  'bin/lib/lens-reviews.test.mjs': OWNED,
  'bin/lib/rules-coverage.mjs': `${GUARD}: directive coverage reads the markers of gentle-ai's blocks in a text`,
  'bin/lib/rules-coverage.test.mjs': `${GUARD}: directive coverage reads the markers of gentle-ai's blocks in a text`,
  'scripts/rehearsal-lib.mjs': `${ABSENCE}: S13's walk proves gentle-ai takes no part`,
  'scripts/rehearsal-lib.test.mjs': `${ABSENCE}: S13's walk proves gentle-ai takes no part`,
};

/** The files git tracks under the roots of the tree at `repo`, as paths from it with forward slashes: what a commit
 * holds, so a scratch file, an eval's output or an index left in the worktree decides nothing (review R3-001 on
 * 61829b9f). `null` with no `.git`, as in the gate's WSL mirror, which is synced without it (bin/lib/gate-wsl.mjs) and
 * holds the worktree's untracked and ignored files too: there what a commit holds cannot be told (Codex P2 on
 * bca90373), and the GitHub gate, a checkout that every push and every land runs, holds the check. */
function trackedFiles(repo) {
  if (!fs.existsSync(path.join(repo, '.git'))) return null;
  const listed = spawnSync('git', ['ls-files', '-z', '--', ...ROOTS], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(listed.status, 0, `git ls-files failed: ${listed.stderr || listed.error?.message}`);
  return listed.stdout.split('\0').filter((file) => file !== '' && fs.existsSync(path.join(repo, file)));
}

test('with no .git, as in the gate\'s WSL mirror, what git tracks cannot be told, and a stray file decides nothing', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'absence-mirror-'));
  try {
    fs.mkdirSync(path.join(scratch, 'bin'));
    fs.writeFileSync(path.join(scratch, 'bin', 'stray.mjs'), '// gentle-ai\n');
    assert.equal(trackedFiles(scratch), null);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

/** Why the check is skipped in the tree at `repo` with `env`, or `false`: only with no `.git` and outside CI, which the
 * WSL mirror's `env -i` leaves unset. On a CI machine a tree with no `.git` fails the check, so the gate that holds it
 * never passes it as a skip (review R3-002 on 57cb302a). */
const skipWhy = (repo, env) => !fs.existsSync(path.join(repo, '.git')) && !env.CI && 'no .git here, so what git tracks cannot be read: the GitHub gate, a checkout, runs this';

test('the check skips only with no .git outside CI: on a CI machine the same tree fails it', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'absence-ci-'));
  try {
    assert.match(skipWhy(scratch, {}), /^no \.git here/);
    assert.equal(skipWhy(scratch, { CI: 'true' }), false);
    // A `.git` folder alone, so the test holds in the WSL mirror too, where this checkout's `.git` is not.
    fs.mkdirSync(path.join(scratch, '.git'));
    assert.equal(skipWhy(scratch, {}), false);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('no file under bin, evals or scripts names gentle-ai but the named ones, each with why (F8 S11, L12)', { skip: skipWhy(REPO, process.env) }, () => {
  const checked = trackedFiles(REPO);
  assert.ok(checked !== null, 'no .git on a CI machine: the gate that holds this check must run in a checkout');
  const broken = checked.filter((file) => NAMES.test(fs.readFileSync(path.join(REPO, file), 'utf8')));
  assert.deepEqual(ratchet({ checked, broken, legacy: NAMED }), []);
});
