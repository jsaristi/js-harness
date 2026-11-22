// Convention: a test makes its temporary folders with `tempDir` (bin/lib/temp-dir.testkit.mjs), which removes each
// when its test ends or the process exits. A test that calls `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` itself
// leaves the folder behind unless it also removes it on every path, failures included; 9,601 such folders were in the
// temporary folder on 2026-11-21, and a run of six test files measured on 2026-11-22 left 149 more (JH 295).
//
// How to comply: `tempDir(prefix, t)` inside a test, or `tempDir(prefix)` in a fixture shared by several tests. A
// folder made somewhere else than the OS temporary folder (under a scratch root the test removes) is not refused.
//
// What is read: every `*.test.mjs` under bin/, workshop/, scripts/ and evals/, outside comment lines
// (bin/lib/source.testkit.mjs); a file breaks the convention when it calls `mkdtemp` or `mkdtempSync` and names
// `tmpdir()` anywhere, so a call split over lines or a temp path kept in a variable is refused too (the reliability
// lens on 8a575816). A file that needs `tmpdir()` for something else and makes folders elsewhere uses tempDir all the
// same, or goes without mkdtemp. This file is not read: its examples name both. LEGACY lists the files that broke it
// on 2026-11-22; it only shrinks (bin/lib/ratchet.testkit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ratchet } from './lib/ratchet.testkit.mjs';
import { withoutComments } from './lib/source.testkit.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const FOLDERS = ['bin', 'workshop', 'scripts', 'evals'];
const SELF = 'bin/conventions-temp-dir.test.mjs';
const MKDTEMP = /\bmkdtemp(?:Sync)?\(/;
const TMPDIR = /\btmpdir\(\)/;

const WHY = 'made its temporary folders with mkdtemp under os.tmpdir() on 2026-11-22, before tempDir';
const LEGACY = Object.fromEntries([
  'bin/advisor-gate.test.mjs',
  'bin/backup.test.mjs',
  'bin/check-ci-gate.test.mjs',
  'bin/check-ci-record.test.mjs',
  'bin/check-citations.test.mjs',
  'bin/check-codex-reviews.test.mjs',
  'bin/check-commit-size.test.mjs',
  'bin/check-exact-tests.test.mjs',
  'bin/check-exit.test.mjs',
  'bin/check-flaky.test.mjs',
  'bin/check-functions.test.mjs',
  'bin/check-quiet.test.mjs',
  'bin/check-rules-row.test.mjs',
  'bin/check-shadow-wsl.test.mjs',
  'bin/check-shadow.test.mjs',
  'bin/check-test-concurrency.test.mjs',
  'bin/check.test.mjs',
  'bin/clean-home.test.mjs',
  'bin/clean.test.mjs',
  'bin/codex-hook-trust.test.mjs',
  'bin/codex-meter.test.mjs',
  'bin/codex-review-switch.test.mjs',
  'bin/codex-review.test.mjs',
  'bin/commit-msg.test.mjs',
  'bin/contract.test.mjs',
  'bin/conventions-arguments.test.mjs',
  'bin/conventions-structure.test.mjs',
  'bin/doctor-hook.test.mjs',
  'bin/doctor-signin.test.mjs',
  'bin/doctor.test.mjs',
  'bin/double-review.test.mjs',
  'bin/failures.test.mjs',
  'bin/functions.test.mjs',
  'bin/gate.test.mjs',
  'bin/guard-feedback.test.mjs',
  'bin/guard.test.mjs',
  'bin/init.test.mjs',
  'bin/install-session-messages.test.mjs',
  'bin/install.test.mjs',
  'bin/js-harness.test.mjs',
  'bin/lens-review.test.mjs',
  'bin/lib/background-close.test.mjs',
  'bin/lib/background.test.mjs',
  'bin/lib/backup-restore.test.mjs',
  'bin/lib/backup-transcripts.test.mjs',
  'bin/lib/backup.test.mjs',
  'bin/lib/batch-mark.test.mjs',
  'bin/lib/cache.test.mjs',
  'bin/lib/channel.test.mjs',
  'bin/lib/ci-gate.test.mjs',
  'bin/lib/claude-import.test.mjs',
  'bin/lib/clones.test.mjs',
  'bin/lib/codex-daemon.test.mjs',
  'bin/lib/codex-review-allowance.test.mjs',
  'bin/lib/codex-review-answer.test.mjs',
  'bin/lib/codex-review-coverage.test.mjs',
  'bin/lib/codex-review-home.test.mjs',
  'bin/lib/codex-review-runs.test.mjs',
  'bin/lib/codex-review-scope.test.mjs',
  'bin/lib/codex-review-turns.test.mjs',
  'bin/lib/codex-reviews.test.mjs',
  'bin/lib/codex-trust.test.mjs',
  'bin/lib/codex-usage.test.mjs',
  'bin/lib/component-write.test.mjs',
  'bin/lib/depth-pass.test.mjs',
  'bin/lib/double-review-records.test.mjs',
  'bin/lib/engram-prompt-hook.test.mjs',
  'bin/lib/engram-release.test.mjs',
  'bin/lib/fixed-load.test.mjs',
  'bin/lib/flaky.test.mjs',
  'bin/lib/gate-first.test.mjs',
  'bin/lib/gate-lock.test.mjs',
  'bin/lib/gate-log.test.mjs',
  'bin/lib/gate-tree.test.mjs',
  'bin/lib/gate-wsl.test.mjs',
  'bin/lib/git-fixture.test.mjs',
  'bin/lib/guard.test.mjs',
  'bin/lib/home-sessions-read.test.mjs',
  'bin/lib/hook-count.test.mjs',
  'bin/lib/host-update.test.mjs',
  'bin/lib/inbox.test.mjs',
  'bin/lib/jsonl-tail.test.mjs',
  'bin/lib/land-records.test.mjs',
  'bin/lib/latest.test.mjs',
  'bin/lib/launcher.test.mjs',
  'bin/lib/lens-candidate.test.mjs',
  'bin/lib/lens-review-rows.test.mjs',
  'bin/lib/lens-reviews.test.mjs',
  'bin/lib/machine-busiest.test.mjs',
  'bin/lib/manifest-settings.test.mjs',
  'bin/lib/manifest-stack.test.mjs',
  'bin/lib/manifest.test.mjs',
  'bin/lib/memory-hygiene.test.mjs',
  'bin/lib/memory-pass.test.mjs',
  'bin/lib/memory-rules.test.mjs',
  'bin/lib/merge-queue-refresh-now.test.mjs',
  'bin/lib/merge-queue-reviews.test.mjs',
  'bin/lib/merge-queue-stale-bin.test.mjs',
  'bin/lib/no-test-outside-turn.test.mjs',
  'bin/lib/pages-rendered.test.mjs',
  'bin/lib/pause.test.mjs',
  'bin/lib/payload.test.mjs',
  'bin/lib/permissions.test.mjs',
  'bin/lib/pnpm-lock.test.mjs',
  'bin/lib/project-apply.test.mjs',
  'bin/lib/project-coverage.test.mjs',
  'bin/lib/project-exclude.test.mjs',
  'bin/lib/project-functions.test.mjs',
  'bin/lib/project-migrate.test.mjs',
  'bin/lib/project-rules-read.test.mjs',
  'bin/lib/project-shared.test.mjs',
  'bin/lib/project-switches.test.mjs',
  'bin/lib/project.test.mjs',
  'bin/lib/read-surface.test.mjs',
  'bin/lib/refresh-consent.test.mjs',
  'bin/lib/refresh-copy.test.mjs',
  'bin/lib/remote.test.mjs',
  'bin/lib/rules-applied-read.test.mjs',
  'bin/lib/rules-block.test.mjs',
  'bin/lib/rules-coverage-read.test.mjs',
  'bin/lib/rules-installed.test.mjs',
  'bin/lib/rules-reach.test.mjs',
  'bin/lib/rules-sources.test.mjs',
  'bin/lib/select-tests.test.mjs',
  'bin/lib/session-classes.test.mjs',
  'bin/lib/session-env.test.mjs',
  'bin/lib/settings-key.test.mjs',
  'bin/lib/spec.test.mjs',
  'bin/lib/stack-backup-walk.test.mjs',
  'bin/lib/stack-backup.test.mjs',
  'bin/lib/stack-run.test.mjs',
  'bin/lib/stack.test.mjs',
  'bin/lib/stall.test.mjs',
  'bin/lib/status-line-program.test.mjs',
  'bin/lib/status-line.test.mjs',
  'bin/lib/subagent-records.test.mjs',
  'bin/lib/template-record.test.mjs',
  'bin/lib/test-run-warning.test.mjs',
  'bin/lib/trace-reads.test.mjs',
  'bin/lib/user-settings.test.mjs',
  'bin/lib/version.test.mjs',
  'bin/lib/worktrees.test.mjs',
  'bin/memory.test.mjs',
  'bin/merge-queue.test.mjs',
  'bin/migrate.test.mjs',
  'bin/notify.test.mjs',
  'bin/onboard.test.mjs',
  'bin/permit.test.mjs',
  'bin/pre-push-hook.test.mjs',
  'bin/progress.test.mjs',
  'bin/quiet.test.mjs',
  'bin/release-tags.test.mjs',
  'bin/remote.test.mjs',
  'bin/reply-budget.test.mjs',
  'bin/reply.test.mjs',
  'bin/report-feature.test.mjs',
  'bin/report-phase.test.mjs',
  'bin/report.test.mjs',
  'bin/resume.test.mjs',
  'bin/rules-coverage.test.mjs',
  'bin/rules-project.test.mjs',
  'bin/rules.test.mjs',
  'bin/sessions-background.test.mjs',
  'bin/sessions-live.test.mjs',
  'bin/sessions.test.mjs',
  'bin/stack-install.test.mjs',
  'bin/stack-upgrade.test.mjs',
  'bin/stack.test.mjs',
  'bin/status-line.test.mjs',
  'bin/stretch.test.mjs',
  'bin/summary.test.mjs',
  'bin/template.test.mjs',
  'bin/tui.test.mjs',
  'bin/uninstall-kinds.test.mjs',
  'bin/unseen.test.mjs',
  'bin/update.test.mjs',
  'bin/wait.test.mjs',
  'bin/workshop-load.test.mjs',
  'bin/writing-flags.test.mjs',
  'evals/codex-configs.test.mjs',
  'evals/codex-home.test.mjs',
  'evals/codex-isolation-probe.test.mjs',
  'evals/configs.test.mjs',
  'evals/home.test.mjs',
  'evals/honest-unknown.test.mjs',
  'evals/honesty-report.test.mjs',
  'evals/incident-score.test.mjs',
  'evals/isolation-probe.test.mjs',
  'evals/lens-hook-probe.test.mjs',
  'evals/long-session/grade.test.mjs',
  'evals/long-session/run.test.mjs',
  'evals/paths.test.mjs',
  'evals/report.test.mjs',
  'evals/review/compare.test.mjs',
  'evals/review/login-proof.test.mjs',
  'evals/review/report.test.mjs',
  'evals/review/seeded.test.mjs',
  'evals/rule-proof.test.mjs',
  'evals/runner.test.mjs',
  'evals/subagents-report.test.mjs',
  'evals/suite.test.mjs',
  'evals/task-proof.test.mjs',
  'evals/tasks.test.mjs',
  'evals/transcript-usage.test.mjs',
  'evals/without.test.mjs',
  'scripts/audit-citations.test.mjs',
  'scripts/audit-expiry.test.mjs',
  'scripts/audit-exports.test.mjs',
  'scripts/audit-flags.test.mjs',
  'scripts/audit-hygiene.test.mjs',
  'scripts/count-git.test.mjs',
  'scripts/diet-measure.test.mjs',
  'scripts/e2e.test.mjs',
  'scripts/gitattributes.test.mjs',
  'scripts/inventory.test.mjs',
  'scripts/migration.test.mjs',
  'scripts/practice.test.mjs',
  'scripts/rehearsal.test.mjs',
  'scripts/release-gate.test.mjs',
  'scripts/reply-hook-time.test.mjs',
  'scripts/s2-verify.test.mjs',
  'scripts/stack-scratch.test.mjs',
  'workshop/bin/audit.test.mjs',
  'workshop/bin/docs.test.mjs',
  'workshop/bin/host-watch.test.mjs',
  'workshop/bin/idea-watch.test.mjs',
  'workshop/bin/subagents.test.mjs',
  'workshop/bin/throughput.test.mjs',
  'workshop/bin/ticks.test.mjs',
  'workshop/lib/docs-records.test.mjs',
  'workshop/lib/windows-daily.test.mjs',
].map((name) => [name, WHY]));

/** Every test file under the folders of FOLDERS, as its path from the repository root with `/`, sorted. */
function testFiles() {
  return FOLDERS.flatMap((folder) =>
    fs
      .readdirSync(path.join(ROOT, folder), { recursive: true })
      .map((name) => `${folder}/${name.split(path.sep).join('/')}`)
      .filter((name) => name.endsWith('.test.mjs') && name !== SELF),
  ).sort();
}

/** Whether `text`, outside its comment lines, calls mkdtemp and names the OS temporary folder. */
function makesOwnTemp(text) {
  const code = withoutComments(text);
  return MKDTEMP.test(code) && TMPDIR.test(code);
}

test('no test file makes its own folder under the OS temporary folder but the legacy ones: tempDir does, and removes it', () => {
  const checked = testFiles();
  assert.ok(checked.length >= 300, `only ${checked.length} test files were read`);
  const broken = checked.filter((name) => makesOwnTemp(fs.readFileSync(path.join(ROOT, name), 'utf8')));
  const problems = ratchet({ checked, broken, legacy: LEGACY });
  assert.deepEqual(problems, [], `${problems.join('\n')}\n\nmake the folder with tempDir from bin/lib/temp-dir.testkit.mjs`);
});

test('mkdtemp with tmpdir() is refused on one line, split over lines or through a variable; in a comment or under another root it is not', () => {
  const call = (name, root) => `const dir = fs.${name}(path.join(${root}, 'x-'));`;
  assert.ok(makesOwnTemp(call('mkdtempSync', 'os.tmpdir()')));
  assert.ok(makesOwnTemp(call('mkdtempSync', 'tmpdir()')));
  assert.ok(makesOwnTemp(`await fsp.${'mkdtemp'}(join(tmpdir(), 'x-'));`));
  assert.ok(makesOwnTemp(`const dir = fs.mkdtempSync(\n  path.join(\n    os.tmpdir(),\n    'x-',\n  ),\n);`));
  assert.ok(makesOwnTemp(`const base = os.tmpdir();\n${call('mkdtempSync', 'base')}`));
  assert.ok(!makesOwnTemp(`// ${call('mkdtempSync', 'os.tmpdir()')}`));
  assert.ok(!makesOwnTemp(call('mkdtempSync', 'scratchRoot')));
  assert.ok(!makesOwnTemp("const dir = tempDir('x-', t);"));
});
