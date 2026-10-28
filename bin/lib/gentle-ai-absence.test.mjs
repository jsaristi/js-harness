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
import fs from 'node:fs';
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
const Q104 = 'init\'s AGENTS.md line on a project with the Codex review off, until question 104 is answered (L11)';

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
  'bin/lib/project.mjs': Q104,
  'bin/lib/project.test.mjs': Q104,
  'bin/lib/template-block.test.mjs': Q104,
};

/** Every file under `dir`, as a path from the repository with forward slashes. */
function filesUnder(dir) {
  return fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }).flatMap((entry) => {
    const name = `${dir}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(name) : entry.isFile() ? [name] : [];
  });
}

test('no file under bin, evals or scripts names gentle-ai but the named ones, each with why (F8 S11, L12)', () => {
  const checked = ROOTS.flatMap(filesUnder);
  const broken = checked.filter((file) => NAMES.test(fs.readFileSync(path.join(REPO, file), 'utf8')));
  assert.deepEqual(ratchet({ checked, broken, legacy: NAMED }), []);
});
